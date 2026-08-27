/* =====================================================================
   PTF CRM — Procurement line identity / reconciliation
   BUG-PROC-LINK-287: never map a CO item to procurement/RFQ data merely
   because their array indexes happen to be equal.
   ===================================================================== */
(function () {
  'use strict';

  function arr(v) { return Array.isArray(v) ? v : []; }
  function esc(v) { return typeof escP === 'function' ? escP(v == null ? '' : String(v)) : String(v == null ? '' : v); }
  function norm(v) {
    try { if (typeof dedupNorm === 'function') return dedupNorm(v); } catch (e) {}
    return String(v || '').replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); }).replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); }).replace(/[\u200c\u200f\u200e]/g, '').replace(/[\s\-_.،,؛;()\/\\]/g, '').toLowerCase();
  }
  function first(o, keys) { for (var i = 0; i < keys.length; i++) if (o && o[keys[i]] != null && String(o[keys[i]]).trim()) return String(o[keys[i]]); return ''; }
  function codeOf(it) { return norm(first(it, ['pcode', 'prodCd', 'productCd', 'sourcePcode', 'itemCode', 'cd'])); }
  function nameOf(it) { return norm(first(it, ['name', 'nm', 'en', 'item'])); }
  function specOf(it) { return norm(first(it, ['spec', 'st', 'desc', 'detail'])); }
  function modelOf(it) { return norm(first(it, ['model', 'md'])); }
  /* FC-3 (v34.7.30): واحدها بین ماژول‌ها هم‌ارز ولی نانویس‌اند («عدد» در اقلام درخواست،
     'NO' در فرم پیشنهاد). چون در تطبیق نام‌محور، اختلاف واحد امتیاز را صفر می‌کند، همان
     ناسازگاری نگارشی باعث می‌شد نرخ مرجع هیچ‌وقت پیدا نشود. این نگاشت فقط هم‌ارزهای
     قطعی را یکی می‌کند و هیچ واحد متفاوتی را یکسان نمی‌شمارد. */
  var UNIT_ALIAS = {
    'no': 'ea', 'nos': 'ea', 'pc': 'ea', 'pcs': 'ea', 'piece': 'ea', 'pieces': 'ea', 'ea': 'ea', 'each': 'ea',
    'عدد': 'ea', 'دستگاه': 'ea', 'قطعه': 'ea',
    'set': 'set', 'sets': 'set', 'ست': 'set',
    'm': 'm', 'mtr': 'm', 'meter': 'm', 'metre': 'm', 'متر': 'm',
    'kg': 'kg', 'kgs': 'kg', 'کیلوگرم': 'kg', 'کیلو': 'kg',
    'lt': 'lt', 'liter': 'lt', 'litre': 'lt', 'لیتر': 'lt',
    'box': 'box', 'جعبه': 'box', 'کارتن': 'box',
    'roll': 'roll', 'رول': 'roll', 'شاخه': 'bar', 'bar': 'bar', 'branch': 'bar'
  };
  function unitOf(it) {
    var u = norm(first(it, ['unit', 'un']));
    return UNIT_ALIAS[u] || u;
  }
  window.ptfNormUnit = unitOf;

  /* Deterministic signature for new source records. It is not a database key and
     does not mutate legacy data; a pcode remains the strongest identity. */
  window.ptfProcLineKey = function (it) {
    if (it && (it.sourceItemKey || it.procLineKey || it.lineKey)) return String(it.sourceItemKey || it.procLineKey || it.lineKey);
    var c = codeOf(it);
    if (c) return 'P:' + c;
    return 'S:' + [nameOf(it), modelOf(it), specOf(it), unitOf(it)].join('|');
  };

  /* Returns {ok,index,item,mode,score} or {ok:false,reason,candidates}.
     There is intentionally NO positional/index fallback. */
  window.ptfResolveProcurementLine = function (offerItem, sourceItems) {
    var sources = arr(sourceItems), targetKey = window.ptfProcLineKey(offerItem), targetCode = codeOf(offerItem), targetName = nameOf(offerItem), targetModel = modelOf(offerItem), targetSpec = specOf(offerItem), targetUnit = unitOf(offerItem);
    var candidates = [];
    sources.forEach(function (src, index) {
      var sourceKey = window.ptfProcLineKey(src), sourceCode = codeOf(src), sourceName = nameOf(src), sourceModel = modelOf(src), sourceSpec = specOf(src), sourceUnit = unitOf(src);
      var score = 0, mode = '', evidence = [];
      if (targetCode && sourceCode && targetCode === sourceCode) { score = 100; mode = 'pcode'; evidence.push('کد کالا'); }
      else if (targetKey && sourceKey && targetKey === sourceKey && targetKey.indexOf('S:') !== 0) { score = 95; mode = 'source-key'; evidence.push('شناسه پایدار'); }
      else if (targetName && sourceName && targetName === sourceName) {
        score = 50; mode = 'name'; evidence.push('نام');
        if (targetModel && sourceModel && targetModel === sourceModel) { score += 20; evidence.push('مدل'); }
        if (targetSpec && sourceSpec && targetSpec === sourceSpec) { score += 15; evidence.push('مشخصات'); }
        if (targetUnit && sourceUnit && targetUnit === sourceUnit) { score += 10; evidence.push('واحد'); }
        if ((targetModel && sourceModel && targetModel !== sourceModel) || (targetUnit && sourceUnit && targetUnit !== sourceUnit)) score = 0;
      }
      if (score >= 50) candidates.push({ index: index, item: src, score: score, mode: mode, evidence: evidence });
    });
    candidates.sort(function (a, b) { return b.score - a.score; });
    if (!candidates.length) return { ok: false, reason: 'unmatched', candidates: [] };
    if (candidates.length > 1 && candidates[0].score === candidates[1].score) return { ok: false, reason: 'ambiguous', candidates: candidates };
    return { ok: true, index: candidates[0].index, item: candidates[0].item, score: candidates[0].score, mode: candidates[0].mode, candidates: candidates };
  };

  /* Select one procurement/RFQ record only when exactly one record has an
     unambiguous line match. A stale/duplicate request is therefore not silently
     used merely because it appeared first in localStorage. */
  window.ptfResolveProcurementAcross = function (offerItem, records, opt) {
    opt = opt || {};
    var hits = [];
    arr(records).forEach(function (rec) {
      var r = window.ptfResolveProcurementLine(offerItem, rec && rec.items);
      if (r.ok) hits.push({ record: rec, line: r });
    });
    if (!hits.length) return { ok: false, reason: 'unmatched', hits: [] };
    var sourceOfferHits = opt.offerNo ? hits.filter(function (h) { return h.record && h.record.sourceOfferNo === opt.offerNo; }) : [];
    if (sourceOfferHits.length === 1) return { ok: true, record: sourceOfferHits[0].record, line: sourceOfferHits[0].line, mode: 'source-offer' };
    if (hits.length === 1) return { ok: true, record: hits[0].record, line: hits[0].line, mode: hits[0].line.mode };
    return { ok: false, reason: 'ambiguous-record', hits: hits };
  };

  /* Resolve a real purchase inside an already-resolved comparison record.
     A purchase.idx is deliberately not an identity and is never used here. */
  window.ptfResolvePurchaseForLine = function (record, line) {
    var purchases = arr(record && record.purchases), target = (line && line.item) || {};
    var targetKey = target.sourceItemKey || target.procLineKey || target.lineKey || '';
    var targetCode = codeOf(target);
    var hits = [];
    purchases.forEach(function (p) {
      var pKey = p && (p.sourceItemKey || p.procLineKey || p.lineKey || '');
      var pCode = codeOf(p);
      if (targetKey && pKey && String(targetKey) === String(pKey)) hits.push({ purchase: p, mode: 'source-key' });
      else if (targetCode && pCode && targetCode === pCode) hits.push({ purchase: p, mode: 'pcode' });
    });
    if (!hits.length) return { ok: false, reason: 'unmatched', hits: [] };
    if (hits.length > 1) return { ok: false, reason: 'ambiguous-purchase', hits: hits };
    return { ok: true, purchase: hits[0].purchase, mode: hits[0].mode };
  };

  /* Resolve the CO/comparison item belonging to a purchase without trusting
     purchase.idx. Legacy records that have neither provenance nor a stable
     product code intentionally remain unresolved. */
  window.ptfResolveItemForPurchase = function (record, purchase) {
    var items = arr(record && record.items), p = purchase || {};
    var targetKey = p.sourceItemKey || p.procLineKey || p.lineKey || '';
    var targetCode = codeOf(p), hits = [];
    items.forEach(function (it, index) {
      var itemKey = window.ptfProcLineKey(it), itemCode = codeOf(it);
      if (targetKey && itemKey && String(targetKey) === String(itemKey)) hits.push({ index: index, item: it, mode: 'source-key' });
      else if (targetCode && itemCode && targetCode === itemCode) hits.push({ index: index, item: it, mode: 'pcode' });
    });
    if (!targetKey && !targetCode) return { ok: false, reason: 'no-provenance', hits: [] };
    if (!hits.length) return { ok: false, reason: 'unmatched', hits: [] };
    if (hits.length > 1) return { ok: false, reason: 'ambiguous-item', hits: hits };
    return { ok: true, index: hits[0].index, item: hits[0].item, mode: hits[0].mode };
  };

  window.ptfProcurementLinkAuditData = function (offer) {
    var o = offer || {}, aliases = [o.inqNo, o.no].filter(Boolean);
    var cmps = getData('ptf_crm_buycmp').filter(function (c) { return aliases.indexOf(c.inqNo) > -1; });
    var rfqs = getData('ptf_crm_rfqsmart').filter(function (r) { return aliases.indexOf(r.srcRfq) > -1 || aliases.indexOf(r.no) > -1; });
    return arr(o.items).map(function (it, i) {
      var c = window.ptfResolveProcurementAcross(it, cmps, { offerNo: o.no });
      var r = window.ptfResolveProcurementAcross(it, rfqs, { offerNo: o.no });
      return { index: i, item: it, cmp: c, rfq: r };
    });
  };

  window.ptfProcurementLinkAuditAll = function () {
    return getData('ptf_crm_offers').filter(function (o) { return o && (o.kind === 'CO' || o.kind === 'TC'); }).map(function (o) {
      var rows = window.ptfProcurementLinkAuditData(o);
      var hasSources = getData('ptf_crm_buycmp').some(function (c) { return c.inqNo === o.inqNo || c.inqNo === o.no; }) || getData('ptf_crm_rfqsmart').some(function (r) { return r.srcRfq === o.inqNo || r.no === o.inqNo; });
      var issues = rows.filter(function (x) { return hasSources && !x.cmp.ok && !x.rfq.ok; });
      return { offer: o, rows: rows, hasSources: hasSources, issues: issues };
    });
  };

  window.ptfOpenProcurementGlobalAudit = function () {
    var all = window.ptfProcurementLinkAuditAll();
    var rows = all.filter(function (x) { return x.issues.length; }).map(function (x) {
      return '<tr><td><b>' + esc(x.offer.no || '') + '</b></td><td>' + esc(x.offer.buyerCo || '') + '</td><td>' + x.offer.items.length + '</td><td style="color:#b45309;font-weight:800">' + x.issues.length + ' قلم نیازمند تطبیق</td><td><button class="ba" onclick="this.closest(\'.md-b\').remove();ptfOpenProcurementLinkAudit(\'' + esc(x.offer.no || '') + '\')">🔎 بررسی</button></td></tr>';
    }).join('');
    var html = '<div class="md-b" style="display:grid;z-index:3000" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:960px;max-height:92vh;overflow:auto"><h3>🔎 تطبیق سراسری خرید/استعلام با پیشنهادهای مالی</h3><div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:9px 12px;font-size:12px;color:#9a3412;margin-bottom:10px">این گزارش فقط‌خواندنی است. ارقام مشکوک را تغییر نمی‌دهد؛ فقط پیشنهادهایی را نشان می‌دهد که منبع خرید/استعلام دارند اما اقلامشان تطبیق قطعی نشده است.</div><div class="tb2"><table><thead><tr><th>پیشنهاد</th><th>مشتری</th><th>اقلام</th><th>وضعیت</th><th></th></tr></thead><tbody>' + (rows || '<tr><td colspan="5" style="color:#047857">✅ مورد مبهمی در پیشنهادهای دارای منبع خرید/استعلام دیده نشد.</td></tr>') + '</tbody></table></div><div style="text-align:left;margin-top:12px"><button class="bt" onclick="this.closest(\'.md-b\').remove()">بستن</button></div></div></div>';
    (document.getElementById('panels') || document.body).insertAdjacentHTML('beforeend', html);
  };

  function supplierInvoicesForProcurement() {
    try {
      var d = JSON.parse(localStorage.getItem('ptf_crm_supplier_finance') || '{}');
      return arr(d.invoices).filter(function (i) { return i && i.status !== 'void'; });
    } catch (e) { return []; }
  }
  function itemLinkForProcurement(invoice, offerNo, itemKey) {
    return arr(invoice && invoice.itemLinks).filter(function (x) { return x.offerNo === offerNo && x.itemKey === itemKey; })[0] || null;
  }
  function supplierInvoiceForLine(offer, row, invoices) {
    var itemKey = window.ptfProcLineKey(row.item);
    var explicit = invoices.filter(function (inv) { return !!itemLinkForProcurement(inv, offer.no, itemKey); })[0];
    if (explicit) return explicit;
    var cmp = getData('ptf_crm_buycmp').filter(function (c) { return c.inqNo === offer.inqNo; })[0];
    if (cmp && row.cmp && row.cmp.line) {
      var purchase = window.ptfResolvePurchaseForLine(cmp, row.cmp.line);
      if (purchase && purchase.ok && purchase.purchase && purchase.purchase.supplierInvoiceCd) {
        var byPurchase = invoices.filter(function (inv) { return inv.cd === purchase.purchase.supplierInvoiceCd; })[0];
        if (byPurchase) return byPurchase;
      }
    }
    var payable = getData('ptf_crm_payables').filter(function (p) { return (p.inqNo === offer.inqNo || p.inqNo === offer.no) && (+p.idx === +row.index); })[0];
    if (payable && payable.sfInvoiceCd) return invoices.filter(function (inv) { return inv.cd === payable.sfInvoiceCd; })[0] || null;
    return null;
  }
  window.ptfProcurementLinkInvoice = function (offerNo, itemIndex) {
    var offer = getData('ptf_crm_offers').filter(function (x) { return x.no === offerNo; })[0];
    if (!offer) return;
    var rows = window.ptfProcurementLinkAuditData(offer), row = rows[itemIndex];
    if (!row) return;
    var itemKey = window.ptfProcLineKey(row.item);
    var invoices = supplierInvoicesForProcurement();
    if (!invoices.length) { alert('برای این قلم هنوز فاکتور خریدی ثبت نشده است. ابتدا فاکتور خرید را در حساب تأمین‌کننده ثبت کنید.'); return; }
    var current = supplierInvoiceForLine(offer, row, invoices);
    var options = '<option value="">— انتخاب فاکتور خرید —</option>' + invoices.map(function (i) {
      return '<option value="' + esc(i.cd) + '"' + (current && current.cd === i.cd ? ' selected' : '') + '>فاکتور ' + esc(i.no || i.cd) + ' — ' + esc(i.supName || '') + '</option>';
    }).join('');
    ptfDialog({
      title: '🔗 لینک قلم به فاکتور خرید',
      body: 'قلم: <b>' + esc(first(row.item, ['name', 'nm', 'desc'])) + '</b><br><small>فقط همین قلم تغییر می‌کند؛ اقلام دیگر خودکار جابه‌جا نمی‌شوند.</small>',
      fields: [{ id: 'invoiceCd', label: 'فاکتور خرید', type: 'select', optionsHtml: options }],
      okText: 'ذخیره لینک',
      onOk: function (v) {
        var invoiceCd = String(v.invoiceCd || '').trim();
        if (!invoiceCd) { alert('لطفاً فاکتور خرید را انتخاب کنید.'); return; }
        var d = {};
        try { d = JSON.parse(localStorage.getItem('ptf_crm_supplier_finance') || '{}'); } catch (e) { d = {}; }
        d.invoices = arr(d.invoices);
        var target = d.invoices.filter(function (i) { return i.cd === invoiceCd; })[0];
        if (!target) { alert('فاکتور خرید یافت نشد.'); return; }
        var link = { offerNo: offerNo, inqNo: offer.inqNo || '', itemKey: itemKey, itemIndex: itemIndex, itemLabel: first(row.item, ['name', 'nm', 'desc']), linkedAt: faDateTime(), linkedBy: curSession().name };
        d.invoices.forEach(function (i) { i.itemLinks = arr(i.itemLinks).filter(function (x) { return !(x.offerNo === offerNo && x.itemKey === itemKey); }); });
        target.itemLinks = arr(target.itemLinks);
        target.itemLinks.push(link);
        var cmpList = getData('ptf_crm_buycmp');
        var cmp = cmpList.filter(function (c) { return c.inqNo === offer.inqNo; })[0];
        var purchase = cmp ? window.ptfResolvePurchaseForLine(cmp, row.cmp && row.cmp.line) : null;
        if (purchase && purchase.ok) purchase.purchase.supplierInvoiceCd = invoiceCd;
        var payableList = getData('ptf_crm_payables');
        var payable = payableList.filter(function (p) { return (p.inqNo === offer.inqNo || p.inqNo === offer.no) && (+p.idx === +itemIndex); })[0];
        if (payable) {
          d.invoices.forEach(function (i) { i.legacyPayableCds = arr(i.legacyPayableCds).filter(function (cd) { return cd !== payable.cd; }); });
          target.legacyPayableCds = arr(target.legacyPayableCds);
          if (target.legacyPayableCds.indexOf(payable.cd) < 0) target.legacyPayableCds.push(payable.cd);
          payable.sfInvoiceCd = invoiceCd;
          if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection('ptf_crm_payables', payableList, { reason: 'w4' }); else setData('ptf_crm_payables', payableList);
        }
        if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection('ptf_crm_supplier_finance', d, { reason: 'w4' }); else setData('ptf_crm_supplier_finance', d);
        if (cmp && purchase && purchase.ok) if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection('ptf_crm_buycmp', cmpList, { reason: 'w4' }); else setData('ptf_crm_buycmp', cmpList);
        try { audit('تطبیق خرید', 'لینک قلم «' + link.itemLabel + '» از پیشنهاد ' + offerNo + ' به فاکتور خرید ' + (target.no || target.cd), offerNo); } catch (eA) {}
        var dlg = document.querySelector('.ptfdlg-b,.md-b'); if (dlg) dlg.remove();
        window.ptfOpenProcurementLinkAudit(offerNo);
      }
    });
  };

  window.ptfOpenProcurementLinkAudit = function (offerNo) {
    var o = getData('ptf_crm_offers').filter(function (x) { return x.no === offerNo; })[0];
    if (!o) return;
    var rows = window.ptfProcurementLinkAuditData(o).map(function (x) {
      function lb(r, kind) {
        if (r.ok) return '<span style="color:#047857">✓ ' + esc(kind) + ' — ' + esc((r.record || {}).id || (r.record || {}).no || '') + ' / ردیف ' + (r.line.index + 1) + ' (' + esc(r.mode || '') + ')</span>';
        var why = { unmatched: 'بدون تطبیق قطعی', ambiguous: 'تطبیق مبهم', 'ambiguous-record': 'چند منبع هم‌زمان' }[r.reason] || 'نامشخص';
        return '<span style="color:#b45309">⚠️ ' + esc(kind) + ': ' + why + '</span>';
      }
      var itemKey = window.ptfProcLineKey(x.item);
      var linkedInvoice = supplierInvoiceForLine(o, x, supplierInvoicesForProcurement());
      var invoiceLabel = linkedInvoice ? 'فاکتور ' + (linkedInvoice.no || linkedInvoice.cd) + (linkedInvoice.supName ? ' — ' + linkedInvoice.supName : '') : 'بدون فاکتور خرید';
      return '<tr><td>' + (x.index + 1) + '</td><td><b>' + esc(first(x.item, ['name', 'nm', 'desc'])) + '</b><br><small>' + esc(first(x.item, ['pcode', 'prodCd'])) + '</small></td><td>' + lb(x.cmp, 'خرید واقعی') + '</td><td>' + lb(x.rfq, 'استعلام تامین') + '</td><td><span style="color:' + (linkedInvoice ? '#047857' : '#b45309') + '">' + esc(invoiceLabel) + '</span><br><button class="ba" style="margin-top:4px" onclick="ptfProcurementLinkInvoice(\'' + esc(offerNo) + '\',' + x.index + ')">' + (linkedInvoice ? '🔁 تغییر فاکتور' : '🔗 لینک فاکتور') + '</button></td></tr>';
    }).join('');
    var html = '<div class="md-b" style="display:grid;z-index:3000" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:960px;max-height:92vh;overflow:auto"><h3>🔎 گزارش تطبیق اقلام خرید/استعلام — ' + esc(offerNo) + '</h3><div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:9px 12px;font-size:12px;color:#9a3412;margin-bottom:10px">این گزارش تطبیق را در سطح هر قلم نشان می‌دهد، اما لینک فاکتور خرید روی همان ردیف انجام می‌شود. اصلاح نوع رسمی/غیررسمی فقط در خود فاکتور خرید انجام می‌شود.</div><div class="tb2"><table><thead><tr><th>#</th><th>قلم CO</th><th>خرید واقعی</th><th>استعلام تامین</th><th>فاکتور خرید</th></tr></thead><tbody>' + (rows || '<tr><td colspan="5">قلمی نیست</td></tr>') + '</tbody></table></div><div style="text-align:left;margin-top:12px"><button class="bt" onclick="this.closest(\'.md-b\').remove()">بستن</button></div></div></div>';
    (document.getElementById('panels') || document.body).insertAdjacentHTML('beforeend', html);
  };
})();
