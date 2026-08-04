/* PTF CRM — FIN-WF-015 / read-only financial data quality dashboard */
(function () {
  'use strict';
  function arr(k) { var v = getData(k); return Array.isArray(v) ? v : []; }
  function add(map, id, label, ref, amount, detail) {
    if (!map[id]) map[id] = { id: id, label: label, count: 0, amount: 0, refs: [], details: [] };
    map[id].count++;
    map[id].amount += +amount || 0;
    if (ref && map[id].refs.length < 50) map[id].refs.push(String(ref));
    if (detail && map[id].details.length < 50) map[id].details.push(detail);
  }
  function yearOf(v) { return typeof ptfFiscalYearOf === 'function' ? ptfFiscalYearOf(v) : ((String(v || '').match(/(13|14)\d{2}/) || [])[0] || ''); }
  /* فاز ۲ / گام ۲ (crm/DESIGN-OFFICIAL-UNOFFICIAL-SEPARATION-PHASE2.md):
     تشخیص رکوردهای هزینه جاری (OPEX) و فاکتور خرید تأمین‌کننده که هیچ‌گاه
     نوع رسمی/غیررسمی‌شان تعیین نشده (مثلاً رکوردهای ساخته‌شده توسط
     ptfOpexApplyTpl یا همگام‌سازی حقوق سهامداران در shareholders.js —
     ر.ک: فاز ۱ ANALYSIS-OFFICIAL-UNOFFICIAL-SEPARATION-PHASE1.md).
     این تابع فقط از official-ledger.js می‌خواند؛ هیچ پیش‌فرضی حدس نمی‌زند
     و هیچ رکوردی را تغییر نمی‌دهد — صرفاً فهرست برای بررسی دستی کارفرما/حسابدار. */
  function ledgerOfOpexSafe(o) {
    try { return typeof window.ptfLedgerOfOpex === 'function' ? window.ptfLedgerOfOpex(o) : (o && o.isOfficial === true ? 'official' : (o && o.isOfficial === false ? 'unofficial' : 'unclassified')); }
    catch (e) { return 'unclassified'; }
  }
  function ledgerOfSupplierInvoiceSafe(inv) {
    try { return typeof window.ptfLedgerOfSupplierInvoice === 'function' ? window.ptfLedgerOfSupplierInvoice(inv) : (inv && inv.isOfficial === true ? 'official' : (inv && inv.isOfficial === false ? 'unofficial' : 'unclassified')); }
    catch (e) { return 'unclassified'; }
  }
  window.ptfDataQualityData = function () {
    var q = {}, invoices = arr('ptf_crm_invoices'), payables = arr('ptf_crm_payables');
    /* CHQ-MOD-001: چک‌ها از دو کلید جدید (issued/received) + legacy */
    var cheques = (typeof window.ptfChequeAll === 'function') ? window.ptfChequeAll() : arr('ptf_crm_cheques');
    invoices.forEach(function (i) {
      if (!yearOf(i.invDate || i.dateISO || i.t)) add(q, 'invoice-undated', 'فاکتور بدون سال مالی معتبر', i.no || i.cd, i.amount);
      var paid = (i.payments || []).concat(i.pays || []).reduce(function (s, p) { return s + (+p.amt || 0); }, 0);
      if (Math.max(0, (+i.amount || 0) - paid) > 0 && !i.offerNo) add(q, 'invoice-unlinked', 'فاکتور باز بدون پیشنهاد مرتبط', i.no || i.cd, i.amount);
    });
    payables.forEach(function (p) {
      if (!yearOf(p.dateISO || p.date || p.t)) add(q, 'payable-undated', 'تعهد تأمین بدون سال مالی معتبر', p.cd || p.inqNo, p.amount);
      if ((p.cur || 'IRR') !== 'IRR' && !(+p.rate > 0)) add(q, 'payable-fx-rate', 'تعهد ارزی بدون نرخ تسعیر', p.cd || p.inqNo, p.amount);
    });
    cheques.forEach(function (c) {
      if (c.st === 'open' && !c.ownership) add(q, 'cheque-ownerless', 'چک باز با مالکیت نامشخص', c.sayad || c.no || c.cd, c.amt, { type: 'cheque', cd: c.cd, label: 'چک ' + (c.sayad || c.no || c.cd) + (c.toWhom ? ' — ' + c.toWhom : c.bank ? ' — ' + c.bank : '') });
      if (c.st === 'open' && !c.dueISO) add(q, 'cheque-undated', 'چک باز بدون تاریخ سررسید', c.sayad || c.no || c.cd, c.amt);
    });
    /* فاز ۲ / گام ۲: هزینه‌های جاری (OPEX) بدون تعیین نوع رسمی/غیررسمی —
       این‌ها در گزارش‌های تراز فصلی/سال مالی عمداً به‌عنوان «نامشخص» کنار
       گذاشته می‌شوند تا پنهان و به‌اشتباه غیررسمی حساب نشوند. */
    arr('ptf_crm_opex').forEach(function (o) {
      if (o.st === 'void') return;
      if (ledgerOfOpexSafe(o) === 'unclassified') add(q, 'opex-unclassified', 'هزینه جاری بدون تعیین نوع رسمی/غیررسمی', o.cd, o.amt);
    });
    /* فاز ۲ / گام ۲: فاکتور خرید تأمین‌کننده بدون تعیین نوع رسمی/غیررسمی */
    try {
      var sfData = JSON.parse(localStorage.getItem('ptf_crm_supplier_finance') || '{}');
      (sfData.invoices || []).forEach(function (inv) {
        if (inv.status === 'void') return;
        if (ledgerOfSupplierInvoiceSafe(inv) === 'unclassified') add(q, 'supplier-invoice-unclassified', 'فاکتور خرید تأمین‌کننده بدون تعیین نوع رسمی/غیررسمی', inv.no || inv.cd, inv.amountIrr || inv.amount);
      });
    } catch (eSf) {}
    /* فاز ۲ / گام ۵: فاکتور پوششی/صوری با سود خالص منفی — یعنی کارمزد فاکتورساز
       از اعتبار ارزش‌افزوده بیشتر انتخاب شده (به‌احتمال زیاد ورودی اشتباه). */
    try {
      var sfData2 = JSON.parse(localStorage.getItem('ptf_crm_supplier_finance') || '{}');
      (sfData2.invoices || []).forEach(function (inv) {
        if (inv.status === 'void' || inv.isCover !== true) return;
        var net = inv.coverNetBenefit != null ? +inv.coverNetBenefit : ((+inv.coverVatAmount || 0) - (+inv.coverCommissionAmount || 0));
        if (net < 0) add(q, 'cover-invoice-negative-benefit', 'فاکتور پوششی/صوری با سود خالص منفی (کارمزد بیش از ارزش‌افزوده)', inv.no || inv.cd, Math.abs(net));
      });
    } catch (eCover) {}
    if (typeof ptfProcurementLinkAuditAll === 'function') {
      try {
        var supplierDataForProc = JSON.parse(localStorage.getItem('ptf_crm_supplier_finance') || '{}');
        var allPayablesForProc = arr('ptf_crm_payables');
        var salesFileOffers = {}, salesFileInqs = {};
        arr('ptf_crm_deals').concat(arr('ptf_crm_projects')).forEach(function (d) {
          [d.wonOffer, d.offerNo].filter(Boolean).forEach(function (no) { salesFileOffers[String(no)] = true; });
          if ((d.wonOffer || d.offerNo) && d.inqNo) salesFileInqs[String(d.inqNo)] = true;
        });
        var auditedOffers = ptfProcurementLinkAuditAll();
        auditedOffers.forEach(function (x) {
          var directOffer = x.offer || {};
          if (salesFileOffers[String(directOffer.no || '')] && directOffer.inqNo) salesFileInqs[String(directOffer.inqNo)] = true;
        });
        auditedOffers.forEach(function (x) {
          if (!(x.issues || []).length) return;
          var offer = x.offer || {};
          var isDirectSalesOffer = !!salesFileOffers[String(offer.no || '')];
          var isAddendumOfSalesOffer = !!(offer.altOf && salesFileOffers[String(offer.altOf)]) || !!(offer.srcToNo && salesFileOffers[String(offer.srcToNo)]);
          var isWonOfferForSalesFile = !!(offer.inqNo && salesFileInqs[String(offer.inqNo)] && (offer.st === 'won' || offer.status === 'won'));
          if (!isDirectSalesOffer && !isAddendumOfSalesOffer && !isWonOfferForSalesFile) return;
          var aliases = [offer.inqNo, offer.no].filter(Boolean);
          var payableIds = {};
          allPayablesForProc.forEach(function (p) { if (aliases.indexOf(p.inqNo) > -1 && p.cd) payableIds[p.cd] = true; });
          var relatedInvoices = (supplierDataForProc.invoices || []).filter(function (inv) {
            return inv.status !== 'void' && (inv.legacyPayableCds || []).some(function (cd) { return payableIds[cd]; });
          }).map(function (inv) { return { cd: inv.cd, label: 'فاکتور ' + (inv.no || inv.cd) + (inv.supName ? ' — ' + inv.supName : '') }; });
          add(q, 'procurement-ambiguous', 'پیشنهاد دارای اقلام نیازمند تطبیق', offer.no || offer.inqNo, 0, {
            type: 'procurement',
            offerNo: offer.no || '',
            label: 'پیش‌فاکتور ' + (offer.no || offer.inqNo || '—') + (offer.buyerCo ? ' — ' + offer.buyerCo : '') + ' — ' + x.issues.length + ' قلم',
            issueCount: x.issues.length,
            relatedInvoices: relatedInvoices
          });
        });
      } catch (e) {}
    }
    /* AUD-12 (گزارش کارفرما ۱۴۰۵/۰۵/۰۷ — crm/AUDIT-FINANCIAL-SYSTEM-2026-07-29.md):
       فاکتور فروش رسمی مبنی بر پیش‌فاکتور ارزی که مبلغ ریالی‌اش با معادل
       واقعی (ارز خام × نرخ تسعیر مرجع) به‌شدت مغایرت دارد — نشانه‌ی
       احتمالی ورود رقم ارزی خام به‌جای معادل ریالی (نمونه‌ی واقعی: سند
       ۱۵۰۰ دلاری با مبلغ فاکتور «۱۵۰۰ ریال»). این بررسی صرفاً افشا می‌کند؛
       هیچ رکوردی را اصلاح نمی‌کند — اصلاح باید دستی توسط حسابدار/مدیر
       ارشد در همان فرم ویرایش فاکتور رسمی انجام شود. */
    try {
      var offersForFxCheck = arr('ptf_crm_offers');
      var offerByNoForFxCheck = {};
      offersForFxCheck.forEach(function (o) { if (o && o.no) offerByNoForFxCheck[o.no] = o; });
      invoices.forEach(function (i) {
        if (i.status === 'void' || i.st === 'void' || i.void === true || i.isUnofficial) return;
        var o = offerByNoForFxCheck[i.offerNo];
        if (!o) return;
        var sanity = (typeof window.ptfLedgerOfficialFxSanity === 'function') ? window.ptfLedgerOfficialFxSanity(o, i.amount) : { applicable: false, ok: true };
        if (sanity.applicable && !sanity.ok) {
          add(q, 'invoice-fx-mismatch', 'فاکتور رسمی با مبلغ مغایر شدید نسبت به پیش‌فاکتور ارزی (احتمال ورود رقم ارزی خام)', i.no || i.cd, i.amount);
        }
      });
    } catch (eFxCheck) {}
    return Object.keys(q).map(function (k) { return q[k]; }).sort(function (a, b) { return b.count - a.count || a.id.localeCompare(b.id); });
  };

  function qualityRefsHtml(r) {
    var details = r.details || [];
    if (!details.length) return r.refs && r.refs.length ? escP(r.refs.join(', ')) : '—';
    return details.map(function (d) {
      var action = '';
      if (d.type === 'opex' && typeof ptfOpexEdit === 'function') action = '<button type="button" class="bt bt-o" style="padding:3px 9px;font-size:11px;margin-top:7px" onclick="ptfOpexEdit(\'' + ptfOnClickArg(d.cd) + '\')">✏️ اصلاح هزینه</button>';
      else if (d.type === 'supplier-invoice' && typeof slInvoiceEdit === 'function') action = '<button type="button" class="bt bt-o" style="padding:3px 9px;font-size:11px;margin-top:7px" onclick="slInvoiceEdit(\'' + ptfOnClickArg(d.cd) + '\')">✏️ اصلاح فاکتور خرید</button>';
      else if (d.type === 'cheque' && typeof chEdit === 'function') action = '<button type="button" class="bt bt-o" style="padding:3px 9px;font-size:11px;margin-top:7px" onclick="chEdit(\'' + ptfOnClickArg(d.cd) + '\')">✏️ اصلاح چک</button>';
      else if (d.type === 'procurement' && typeof ptfOpenProcurementLinkAudit === 'function') action = '<button type="button" class="bt bt-o" style="padding:3px 9px;font-size:11px;margin-top:7px" onclick="ptfOpenProcurementLinkAudit(\'' + ptfOnClickArg(d.offerNo) + '\')">🔎 بررسی پیش‌فاکتور و اقلام</button>';
      var invoiceActions = d.type === 'procurement' && (d.relatedInvoices || []).length
        ? '<div style="margin-top:9px;padding-top:7px;border-top:1px solid #e2e8f0"><b style="display:block;color:#475569;font-size:11px">فاکتورهای خرید مرتبط</b>' + d.relatedInvoices.map(function (inv) { return '<div style="margin-top:4px"><span>' + escP(inv.label) + '</span><br><button type="button" class="bt bt-o" style="padding:3px 9px;font-size:11px;margin-top:3px" onclick="slInvoiceEdit(\'' + ptfOnClickArg(inv.cd) + '\')">✏️ اصلاح همین فاکتور</button></div>'; }).join('') + '</div>'
        : '';
      var explanation = d.type === 'procurement'
        ? 'این پیش‌فاکتور ' + (d.issueCount || 0) + ' قلم نیازمند تطبیق دارد؛ تطبیق باید در سطح فاکتور خرید انجام شود، نه تک‌تک اقلام.'
        : d.type === 'opex' ? 'نوع سند این هزینه مشخص نشده است.'
        : d.type === 'supplier-invoice' ? 'نوع این فاکتور خرید مشخص نشده است.'
        : d.type === 'cheque' ? 'مالکیت یا تاریخ سررسید این چک نیازمند تکمیل است.'
        : 'این مورد نیازمند بررسی است.';
      return '<details style="margin:6px 0;background:#fff;border:1px solid #e2e8f0;border-radius:9px;padding:6px 9px"><summary style="cursor:pointer;font-weight:700;color:#334155">' + escP(d.label || d.cd || '') + '</summary><div style="padding:8px 2px 2px;color:#64748b;font-size:11.5px;line-height:1.8">' + explanation + '<div>' + action + '</div>' + invoiceActions + '</div></details>';
    }).join('');
  }
  window.ptfDataQualityHtml = function () {
    if (typeof curRole === 'function' && ['admin', 'chairman', 'ceo', 'commercial'].indexOf(curRole()) < 0) return '';
    var rows = window.ptfDataQualityData();
    var total = rows.reduce(function (s, x) { return s + x.count; }, 0);
    var body = rows.map(function (r) { return '<tr><td><details style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:8px"><summary style="cursor:pointer;font-weight:800;color:#334155">' + escP(r.label) + ' — ' + r.count + ' مورد' + (r.amount ? ' — ' + (+r.amount).toLocaleString('fa-IR') + ' ریال' : '') + '</summary><div style="padding-top:7px">' + qualityRefsHtml(r) + '</div></details></td></tr>'; }).join('');
    return '<div id="qualityBox" style="display:none;background:var(--crd);border:1px solid var(--brd);border-radius:14px;padding:14px;margin-top:12px"><div style="display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap"><div><h4 style="margin:0">🧪 کیفیت دادهٔ مالی</h4><small style="color:#64748b">گزارش فقط‌خواندنی است؛ اصلاح فقط از مسیر ماژول اصلی و با تأیید کاربر انجام می‌شود.</small></div><span style="display:flex;gap:6px;flex-wrap:wrap"><button class="bt bt-o" onclick="ptfDataQualityRender()">↻ بازخوانی</button><button class="bt bt-o" onclick="ptfCatalogIdentityAudit()">🔎 ممیزی هویت کالا</button><button class="bt bt-o" onclick="ptfCatalogSimilarAudit()">🧠 تشخیص کالاهای مشابه</button><button class="bt bt-o" onclick="ptfCatalogMergeHistory()">🧩 تاریخچهٔ ادغام</button></span></div><div style="margin:10px 0;background:' + (total ? '#fff7ed;border:1px solid #fed7aa;color:#9a3412' : '#ecfdf5;border:1px solid #bbf7d0;color:#065f46') + ';border-radius:10px;padding:8px 11px;font-size:12px">' + (total ? '⚠️ ' + total + ' مورد نیازمند بررسی' : '✅ مورد کیفیت داده‌ای شناسایی نشد') + '</div><div class="tb2"><table><thead><tr><th>موارد نیازمند بررسی و اصلاح</th></tr></thead><tbody>' + (body || '<tr><td>موردی نیست</td></tr>') + '</tbody></table></div></div>';
  };
  window.ptfDataQualityRender = function () { var el = document.getElementById('qualityBox'); if (el) { var html = window.ptfDataQualityHtml(); var tmp = document.createElement('div'); tmp.innerHTML = html; var next = tmp.firstElementChild; el.replaceWith(next); } };

  /* Phase 1 catalog identity audit: read-only, no auto-link and no catalog writes. */
  window.ptfCatalogIdentityAudit = function () {
    function norm(v) { return String(v || '').replace(/[\u200c\u200e\u200f\s\-_.،,؛;()\/\\]/g, '').toLowerCase(); }
    function signature(x) { return [norm(x.name || x.nm || x.desc), norm(x.model || x.md), norm(x.spec || x.st || x.detail), norm(x.unit || x.un)].join('|'); }
    var products = getData('ptf_crm_products') || [], offers = getData('ptf_crm_offers') || [], lines = [], counts = { linked: 0, exactCandidate: 0, ambiguous: 0, missing: 0 };
    offers.forEach(function (offer) { (offer.items || []).forEach(function (item, idx) {
      var code = item.pcode || item.prodCd || item.productCd || '', candidates = products.filter(function (p) {
        return (code && p.cd === code) || (signature(item) !== '|||' && signature(p) === signature(item));
      });
      var status = code ? 'linked' : candidates.length === 1 ? 'exactCandidate' : candidates.length > 1 ? 'ambiguous' : 'missing';
      counts[status]++;
      lines.push({ offerNo: offer.no || '', line: idx + 1, item: item.name || item.nm || item.desc || '', status: status, candidates: candidates.slice(0, 8).map(function (p) { return (p.nm || p.name || p.cd) + ' [' + p.cd + ']'; }), candidateCodes: candidates.slice(0, 8).map(function (p) { return p.cd || ''; }) });
    }); });
    var report = { readOnly: true, offerCount: offers.length, productCount: products.length, lineCount: lines.length, counts: counts, lines: lines };
    console.table({ offers: report.offerCount, products: report.productCount, lines: report.lineCount, linked: counts.linked, exactCandidate: counts.exactCandidate, ambiguous: counts.ambiguous, missing: counts.missing });
    console.log(JSON.stringify(report, null, 2));
    var problem = lines.filter(function (x) { return x.status !== 'linked'; });
    var body = problem.slice(0, 100).map(function (x) { var action = x.status === 'exactCandidate' && x.candidateCodes && x.candidateCodes[0] ? '<br><button class="ba" data-offer="' + escP(x.offerNo) + '" data-line="' + x.line + '" data-product="' + escP(x.candidateCodes[0]) + '" onclick="ptfCatalogIdentityLink(this.dataset.offer, this.dataset.line, this.dataset.product)">✅ اتصال دقیق</button>' : x.status === 'missing' ? '<br><button class="ba" data-offer="' + escP(x.offerNo) + '" data-line="' + x.line + '" onclick="ptfCatalogReviewQueue(this.dataset.offer, this.dataset.line)">📝 ثبت در صف بررسی</button> <button class="ba" data-offer="' + escP(x.offerNo) + '" data-line="' + x.line + '" data-base="' + escP(x.item) + '" onclick="ptfCatalogIdentityReview(this.dataset.offer, this.dataset.line, this.dataset.base)">🔎 انتخاب دستی</button>' : '<br><button class="ba" data-offer="' + escP(x.offerNo) + '" data-line="' + x.line + '" data-base="' + escP(x.item) + '" onclick="ptfCatalogIdentityReview(this.dataset.offer, this.dataset.line, this.dataset.base)">🔎 بررسی و انتخاب</button>'; return '<tr><td>' + escP(x.offerNo) + '</td><td>' + escP(x.item) + '</td><td>' + escP(x.status === 'exactCandidate' ? 'یک پیشنهاد دقیق' : x.status === 'ambiguous' ? 'چند پیشنهاد' : 'بدون پیشنهاد') + '<br><small>' + escP((x.candidates || []).join('، ')) + '</small>' + action + '</td></tr>'; }).join('');
    var html = '<div class="md-b" id="catalogAuditDlg" style="display:grid;z-index:9999" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:900px;max-height:90vh;overflow:auto"><h3>🔎 ممیزی هویت کالا — فقط‌خواندنی</h3><div style="background:#eff6ff;padding:9px;border-radius:9px;font-size:12px;margin-bottom:9px">مرتبط: ' + counts.linked + ' | پیشنهاد دقیق: ' + counts.exactCandidate + ' | مبهم: ' + counts.ambiguous + ' | بدون پیشنهاد: ' + counts.missing + '<br>هیچ خط پیشنهاد یا کالایی در این گزارش تغییر نمی‌کند.</div><div class="tb2"><table><thead><tr><th>پیشنهاد</th><th>قلم</th><th>وضعیت / نامزدها / اقدام</th></tr></thead><tbody>' + (body || '<tr><td colspan="3">همه اقلام به کالا متصل هستند.</td></tr>') + '</tbody></table></div>' + (problem.length > 100 ? '<small>۱۰۰ مورد اول نمایش داده شد؛ جزئیات کامل در Console موجود است.</small>' : '') + '<div style="text-align:left;margin-top:10px"><button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">بستن</button></div></div></div>';
    document.getElementById('panels').insertAdjacentHTML('beforeend', html);
    return report;
  };
  window.ptfCatalogReviewQueue = function (offerNo, lineNo) {
    var offers = getData('ptf_crm_offers') || [], offer = offers.filter(function (x) { return x.no === offerNo; })[0], item = offer && offer.items && offer.items[+lineNo - 1];
    if (!offer || !item) { alert('قلم پیشنهاد پیدا نشد.'); return; }
    var queue = getData('ptf_crm_catalog_reviews') || [], exists = queue.filter(function (x) { return x.offerNo === offerNo && +x.lineNo === +lineNo && x.status === 'pending_review'; })[0];
    if (exists) { if (typeof ptfToast === 'function') ptfToast('این قلم قبلاً در صف بررسی است.', 'info'); return; }
    queue.unshift({ cd: 'CATREV-' + Date.now(), offerNo: offerNo, lineNo: +lineNo, item: JSON.parse(JSON.stringify(item)), status: 'pending_review', t: typeof faDateTime === 'function' ? faDateTime() : new Date().toISOString(), by: typeof curSession === 'function' ? curSession().name : '' });
    setData('ptf_crm_catalog_reviews', queue);
    try { audit('کاتالوگ', 'ثبت قلم بدون تطبیق در صف بررسی', offerNo); } catch (e) {}
    if (typeof ptfToast === 'function') ptfToast('قلم در صف بررسی هویت کالا ثبت شد؛ کاتالوگ تغییر نکرد.', 'ok');
  };
  window.ptfCatalogMergeOpen = function (index) {
    var report = window._ptfCatalogSimilarReport || {}, group = (report.groups || [])[+index];
    if (!group) return;
    document.querySelectorAll('#catalogMergeDlg').forEach(function (el) { el.remove(); });
    var opts = group.products.map(function (p, i) { return '<option value="' + escP(p.cd) + '"' + (!i ? ' selected' : '') + '>' + escP(p.name || p.cd) + ' — ' + escP(p.cd) + '</option>'; }).join('');
    var html = '<div class="md-b" id="catalogMergeDlg" style="display:grid;z-index:9999" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:700px"><h3>🧩 بررسی ادغام کالاهای مشابه</h3><div style="background:#fff7ed;padding:9px;border-radius:9px;font-size:12px;margin-bottom:10px">این عملیات فقط پس از انتخاب کالای اصلی و تأیید نهایی انجام می‌شود. کالاهای فرعی حذف نمی‌شوند و سابقهٔ ادغام نگهداری می‌شود.</div><div class="fld"><label>کالای اصلی و کد نهایی *</label><select id="ptfMergeCanonical">' + opts + '</select></div><div class="fld"><label>شرح نهایی کالا *</label><input id="ptfMergeName" value="' + escP(group.products[0].name || '') + '"></div><div style="font-size:12px;color:#64748b;margin-top:8px">کالاهای این گروه:<br>' + group.products.map(function (p) { return '• ' + escP(p.name || p.cd) + ' — ' + escP(p.cd); }).join('<br>') + '</div><div style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px"><button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">انصراف</button><button class="bt" onclick="ptfCatalogMergeConfirm(' + (+index) + ')">تأیید ادغام</button></div></div></div>';
    document.getElementById('panels').insertAdjacentHTML('beforeend', html);
  };
  window.ptfCatalogMergeConfirm = function (index) {
    var report = window._ptfCatalogSimilarReport || {}, group = (report.groups || [])[+index], canonicalCd = (document.getElementById('ptfMergeCanonical') || {}).value || '', finalName = ((document.getElementById('ptfMergeName') || {}).value || '').trim();
    if (!group || !canonicalCd || !finalName) { alert('کالای اصلی و شرح نهایی الزامی است.'); return; }
    var from = group.products.map(function (p) { return p.cd; }).filter(function (cd) { return cd && cd !== canonicalCd; });
    if (!from.length) { alert('برای ادغام حداقل یک کالای فرعی لازم است.'); return; }
    if (!confirm('این گروه در کد «' + canonicalCd + '» ادغام شود؟ کالاهای فرعی حذف نمی‌شوند و فقط به‌عنوان ادغام‌شده علامت می‌خورند.')) return;
    var products = getData('ptf_crm_products') || [], canonical = products.filter(function (p) { return p.cd === canonicalCd; })[0];
    if (!canonical) { alert('کالای اصلی پیدا نشد.'); return; }
    canonical.nm = finalName; canonical.aliases = (canonical.aliases || []).concat(group.products.filter(function (p) { return p.cd !== canonicalCd; }).map(function (p) { return p.name; }).filter(Boolean));
    products.forEach(function (p) { if (from.indexOf(p.cd) > -1) { p.hidden = true; p.status = 'merged'; p.mergedInto = canonicalCd; p.mergedAt = typeof faDateTime === 'function' ? faDateTime() : new Date().toISOString(); } });
    var merge = { cd: 'CATMERGE-' + Date.now(), canonicalCd: canonicalCd, mergedCds: from, finalName: finalName, fingerprint: group.fingerprint, status: 'approved', t: typeof faDateTime === 'function' ? faDateTime() : new Date().toISOString(), by: typeof curSession === 'function' ? curSession().name : '' };
    /* Re-point known product-identity fields; never delete the source records. */
    var refKeys = ['ptf_crm_offers', 'ptf_crm_rfqs', 'ptf_crm_inqitems', 'ptf_crm_buycmp', 'ptf_crm_surplus', 'ptf_crm_deals', 'ptf_crm_projects', 'ptf_crm_invoices', 'ptf_crm_sales_returns', 'ptf_crm_catalog_reviews'];
    var identityFields = { pcode: true, prodCd: true, productCd: true, productCode: true, sourcePcode: true, itemCode: true };
    function rewriteRefs(value) { if (Array.isArray(value)) { value.forEach(rewriteRefs); return; } if (!value || typeof value !== 'object') return; Object.keys(value).forEach(function (k) { if (identityFields[k] && from.indexOf(String(value[k])) > -1) value[k] = canonicalCd; else rewriteRefs(value[k]); }); }
    refKeys.forEach(function (key) { var data = getData(key); if (!Array.isArray(data) || !data.length) return; rewriteRefs(data); setData(key, data); });
    merge.referenceKeys = refKeys;
    setData('ptf_crm_products', products);
    var merges = getData('ptf_crm_catalog_merges') || []; merges.unshift(merge); setData('ptf_crm_catalog_merges', merges);
    try { audit('کاتالوگ', 'ادغام کنترل‌شده کالاها در ' + canonicalCd + ' — ' + from.join(', '), merge.cd); } catch (e) {}
    var dlg = document.getElementById('catalogMergeDlg'); if (dlg) dlg.remove();
    if (typeof ptfToast === 'function') ptfToast('ادغام کنترل‌شده ثبت شد؛ کالاهای فرعی حذف نشدند.', 'ok');
    /* به‌جای بازکردن دوبارهٔ پنجرهٔ تشخیص مشابه (که باعث می‌شد کاربر فکر کند هیچ اتفاقی نیفتاده)،
       پنجره بسته می‌شود و نتیجه با toast تأیید می‌شود؛ دفعهٔ بعد که گزارش باز شود،
       کالاهای ادغام‌شده دیگر پیشنهاد نمی‌شوند (فیلتر hidden/merged در ptfCatalogSimilarAudit). */
    document.querySelectorAll('#catalogSimilarDlg').forEach(function (el) { el.remove(); });
  };
  /* ============ S3: تاریخچهٔ ادغام کاتالوگ + بازگشت امن ============ */
  window.ptfCatalogMergeHistory = function () {
    document.querySelectorAll('#catalogMergeHistoryDlg').forEach(function (el) { el.remove(); });
    var merges = getData('ptf_crm_catalog_merges') || [];
    var rows = merges.map(function (m) {
      var st = m.status === 'reverted'
        ? '<span style="color:#dc2626;font-weight:bold">↩️ بازگشت داده شد</span>'
        : '<span style="color:#047857;font-weight:bold">فعال</span>';
      var act = m.status === 'reverted'
        ? '<span style="color:#94a3b8">—</span>'
        : '<button class="ba" style="color:#dc2626" onclick="ptfCatalogMergeUndo(\'' + ptfOnClickArg(m.cd) + '\')">↩️ بازگشت</button>';
      return '<tr><td>' + escP(m.t || '') + '</td><td><b>' + escP(m.canonicalCd) + '</b><br><small>' + escP(m.finalName || '') + '</small></td><td>' + escP((m.mergedCds || []).join('، ')) + '</td><td>' + escP(m.by || '') + '</td><td>' + st + '</td><td>' + act + '</td></tr>';
    }).join('') || '<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:20px">هنوز ادغامی ثبت نشده است</td></tr>';
    var html = '<div class="md-b" id="catalogMergeHistoryDlg" style="display:grid;z-index:9999" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:840px;max-height:90vh;overflow:auto"><h3>🧩 تاریخچهٔ ادغام کالاها</h3><div style="background:#eff6ff;padding:9px;border-radius:9px;font-size:12px;margin-bottom:9px">بازگشت فقط نشانه‌گذاری کالاها را برمی‌گرداند؛ ارجاع‌های بازنویسی‌شدهٔ قبلی (کدهای جایگزین‌شده در اسناد) دست‌نخورده می‌مانند — چون پس از بازنویسی قابل تشخیص از کدهای اصلی نیستند.</div><div class="tb2"><table><thead><tr><th>تاریخ</th><th>کالای اصلی</th><th>کالاهای فرعی</th><th>توسط</th><th>وضعیت</th><th>عملیات</th></tr></thead><tbody>' + rows + '</tbody></table></div><div style="text-align:left;margin-top:10px"><button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">بستن</button></div></div></div>';
    document.getElementById('panels').insertAdjacentHTML('beforeend', html);
  };

  window.ptfCatalogMergeUndo = function (mergeCd) {
    var merges = getData('ptf_crm_catalog_merges') || [];
    var merge = merges.filter(function (m) { return m.cd === mergeCd; })[0];
    if (!merge) { alert('رکورد ادغام پیدا نشد.'); return; }
    if (merge.status === 'reverted') { alert('این ادغام قبلاً بازگردانده شده است.'); return; }
    if (!confirm('بازگشت این ادغام؟ کالاهای فرعی دوباره فعال می‌شوند و aliasهای افزوده حذف می‌شوند. ارجاع‌های بازنویسی‌شدهٔ قبلی دست‌نخورده می‌مانند.')) return;
    var products = getData('ptf_crm_products') || [];
    var aliasNames = (merge.mergedCds || []).map(function (cd) { var p0 = products.filter(function (x) { return x.cd === cd; })[0]; return p0 ? (p0.nm || p0.name || '') : ''; }).filter(Boolean);
    products.forEach(function (p) {
      if ((merge.mergedCds || []).indexOf(p.cd) > -1 && p.status === 'merged') {
        p.hidden = false; p.status = 'active';
        delete p.mergedInto; delete p.mergedAt;
      }
    });
    var canonical = products.filter(function (p) { return p.cd === merge.canonicalCd; })[0];
    if (canonical && Array.isArray(canonical.aliases) && aliasNames.length) {
      canonical.aliases = canonical.aliases.filter(function (a) { return aliasNames.indexOf(a) === -1; });
    }
    merge.status = 'reverted';
    merge.revertedAt = typeof faDateTime === 'function' ? faDateTime() : new Date().toISOString();
    merge.revertedBy = typeof curSession === 'function' ? curSession().name : '';
    setData('ptf_crm_products', products);
    setData('ptf_crm_catalog_merges', merges);
    try { audit('کاتالوگ', 'بازگشت ادغام ' + merge.cd + ' — کالاهای فرعی دوباره فعال شدند', mergeCd); } catch (e) {}
    if (typeof ptfToast === 'function') ptfToast('ادغام بازگردانده شد؛ ارجاع‌های بازنویسی‌شدهٔ قبلی دست‌نخورده ماندند.', 'ok');
    window.ptfCatalogMergeHistory();
  };
  window.ptfCatalogIdentityReviewFilter = function () {
    var input = document.getElementById('ptfCatReviewSearch'), select = document.getElementById('ptfCatReviewProduct');
    if (!input || !select) return;
    var q = String(input.value || '').replace(/[\u200c\u200e\u200f\s\-_.،,؛;()\/\\]/g, '').toLowerCase(), products = getData('ptf_crm_products') || [];
    var rows = products.filter(function (p) { var text = [p.nm || p.name || '', p.cd || '', p.en || '', p.st || '', p.br || '', p.md || ''].join(' ').replace(/[\u200c\u200e\u200f\s\-_.،,؛;()\/\\]/g, '').toLowerCase(); return !q || text.indexOf(q) > -1; }).slice(0, 100);
    select.innerHTML = '<option value="">— انتخاب کالا —</option>' + rows.map(function (p) { return '<option value="' + escP(p.cd) + '">' + escP(p.nm || p.name || p.cd) + ' — ' + escP(p.cd) + '</option>'; }).join('');
  };
  window.ptfCatalogIdentityReview = function (offerNo, lineNo, base) {
    document.querySelectorAll('#catalogReviewDlg').forEach(function (el) { el.remove(); });
    var html = '<div class="md-b" id="catalogReviewDlg" style="display:grid;z-index:9999" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:620px"><h3>🔎 بررسی و انتخاب کالای متناظر</h3><div style="background:#fff7ed;padding:9px;border-radius:9px;font-size:12px;margin-bottom:10px">این قلم تطبیق قطعی ندارد. انتخاب فقط با تأیید شما انجام می‌شود و کالای جدید خودکار ساخته نمی‌شود.</div><div style="margin-bottom:8px"><b>قلم پیشنهاد:</b> ' + escP(base) + '</div><input id="ptfCatReviewSearch" placeholder="جست‌وجوی نام، کد، مدل یا برند" oninput="ptfCatalogIdentityReviewFilter()" style="width:100%;box-sizing:border-box;margin-bottom:7px"><select id="ptfCatReviewProduct" style="width:100%"><option value="">— انتخاب کالا —</option></select><div style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px"><button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">انصراف</button><button class="bt" onclick="ptfCatalogIdentityReviewSave(\'' + ptfOnClickArg(offerNo) + '\',' + lineNo + '\')">تأیید اتصال</button></div></div></div>';
    document.getElementById('panels').insertAdjacentHTML('beforeend', html);
    var input = document.getElementById('ptfCatReviewSearch'); if (input) { input.value = base || ''; ptfCatalogIdentityReviewFilter(); }
  };
  window.ptfCatalogIdentityReviewSave = function (offerNo, lineNo) {
    var productCd = (document.getElementById('ptfCatReviewProduct') || {}).value || '';
    if (!productCd) { alert('ابتدا یک کالا انتخاب کنید.'); return; }
    var offers = getData('ptf_crm_offers') || [], offer = offers.filter(function (x) { return x.no === offerNo; })[0], item = offer && offer.items && offer.items[+lineNo - 1];
    if (!offer || !item) { alert('قلم پیشنهاد پیدا نشد.'); return; }
    if (!confirm('اتصال این قلم به کالای انتخاب‌شده ثبت شود؟')) return;
    item.pcode = productCd; setData('ptf_crm_offers', offers);
    var dlg = document.getElementById('catalogReviewDlg'); if (dlg) dlg.remove();
    if (typeof ptfToast === 'function') ptfToast('اتصال دستی کالا ثبت شد.', 'ok');
    window.ptfCatalogIdentityAudit();
  };
  /* Phase 1 semantic duplicate detector: read-only suggestions only. */
  window.ptfCatalogSimilarAudit = function () {
    function norm(v) { return String(v || '').toLowerCase().replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); }).replace(/[\u200c\u200e\u200f]/g, ' ').replace(/\b(schedule|sch|رده|class)\b/g, 'sch').replace(/\b(seamless|بدون درز)\b/g, 'seamless').replace(/\b(inch|in|اینچ)\b/g, 'in').replace(/[^a-z0-9.]+/g, ' ').replace(/\s+/g, ' ').trim(); }
    function field(p) { return [p.nm || p.name || '', p.en || '', p.st || p.spec || '', p.br || p.brand || '', p.md || p.model || ''].join(' '); }
    function token(text, re) { var m = text.match(re); return m ? m[1] : ''; }
    function fp(p) {
      var t = norm(field(p)), size = token(t, /(?:^|\s)(\d+(?:\.\d+)?)\s*(?:in|\")(?=\s|$)/), sch = token(t, /(?:^|\s)sch\s*(\d+(?:\.\d+)?)/), std = token(t, /\b(a\s*\d{3,4}(?:\s*gr\s*[a-z0-9-]+)?|api\s*\d+|astm\s*[a-z]\s*\d+)\b/), seamless = t.indexOf('seamless') > -1 ? 'seamless' : '', pipe = /(^|\s)(pipe|لوله)(\s|$)/.test(t) ? 'pipe' : '';
      return [pipe, size, sch, std.replace(/\s/g, ''), seamless].join('|');
    }
    var products = getData('ptf_crm_products') || [];
    /* کالاهای ادغام‌شده/مخفی دیگر در گروه‌های پیشنهادی نمی‌آیند (رفع چرخهٔ «ادغام → همان گروه دوباره»). */
    var activeProducts = products.filter(function (p) { return p.hidden !== true && p.status !== 'merged'; });
    var buckets = {};
    activeProducts.forEach(function (p) { var key = fp(p); if (key !== '||||' && key.split('|').filter(Boolean).length >= 3) { (buckets[key] = buckets[key] || []).push(p); } });
    var groups = Object.keys(buckets).map(function (key) { return { fingerprint: key, confidence: key.split('|').filter(Boolean).length >= 4 ? 'high' : 'medium', products: buckets[key].map(function (p) { return { cd: p.cd || '', name: p.nm || p.name || '', technicalText: field(p) }; }) }; }).filter(function (g) { return g.products.length > 1; });
    var report = { readOnly: true, productCount: activeProducts.length, groupCount: groups.length, candidateCount: groups.reduce(function (n, g) { return n + g.products.length; }, 0), groups: groups, note: 'این گزارش فقط پیشنهاد می‌دهد؛ هیچ ادغام یا حذف خودکاری انجام نشده است.' };
    window._ptfCatalogSimilarReport = report;
    console.table({ products: report.productCount, groups: report.groupCount, candidates: report.candidateCount }); console.log(JSON.stringify(report, null, 2));
    var body = groups.slice(0, 100).map(function (g, i) { return '<tr><td>' + (i + 1) + '</td><td>' + escP(g.confidence === 'high' ? 'بالا' : 'متوسط') + '</td><td>' + g.products.map(function (p) { return '<div style="padding:4px 0;border-bottom:1px dashed #e2e8f0"><b>' + escP(p.name || p.cd) + '</b> <small dir="ltr">' + escP(p.cd) + '</small><br><small>' + escP(p.technicalText) + '</small></div>'; }).join('') + '</td><td>فقط پیشنهاد؛ ادغام انجام نشده<br><button class="ba" data-index="' + i + '" onclick="ptfCatalogMergeOpen(this.dataset.index)">🧩 بررسی و ادغام</button></td></tr>'; }).join('');
    var html = '<div class="md-b" id="catalogSimilarDlg" style="display:grid;z-index:9999" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:1000px;max-height:90vh;overflow:auto"><h3>🧠 تشخیص کالاهای مشابه — مرحلهٔ گزارش</h3><div style="background:#eff6ff;padding:9px;border-radius:9px;font-size:12px;margin-bottom:9px">این مرحله فقط بر اساس مشخصات فنی مشترک گروه‌های مشابه را پیشنهاد می‌دهد. هیچ شرح، کد، ارجاع یا سابقه‌ای تغییر نمی‌کند.</div><div class="tb2"><table><thead><tr><th>#</th><th>اطمینان</th><th>کالاهای پیشنهادی</th><th>وضعیت</th></tr></thead><tbody>' + (body || '<tr><td colspan="4">گروه مشابهی با مشخصات کافی پیدا نشد.</td></tr>') + '</tbody></table></div>' + (groups.length > 100 ? '<small>۱۰۰ گروه اول نمایش داده شد؛ گزارش کامل در Console موجود است.</small>' : '') + '<div style="text-align:left;margin-top:10px"><button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">بستن</button></div></div></div>';
    document.getElementById('panels').insertAdjacentHTML('beforeend', html);
    return report;
  };
  window.ptfCatalogIdentityLink = function (offerNo, lineNo, productCd) {
    var offers = getData('ptf_crm_offers') || [], products = getData('ptf_crm_products') || [];
    var offer = offers.filter(function (x) { return x.no === offerNo; })[0], item = offer && offer.items && offer.items[+lineNo - 1];
    var product = products.filter(function (x) { return x.cd === productCd; })[0];
    if (!offer || !item || !product) { alert('قلم پیشنهاد یا کالای انتخاب‌شده پیدا نشد.'); return; }
    function norm(v) { return String(v || '').replace(/[\u200c\u200e\u200f\s\-_.،,؛;()\/\\]/g, '').toLowerCase(); }
    function sig(x) { return [norm(x.name || x.nm || x.desc), norm(x.model || x.md), norm(x.spec || x.st || x.detail), norm(x.unit || x.un)].join('|'); }
    var candidates = products.filter(function (p) { return sig(item) !== '|||' && sig(p) === sig(item); });
    if (candidates.length !== 1 || candidates[0].cd !== productCd) { alert('این اتصال دیگر تطبیق دقیق یکتا نیست؛ گزارش را دوباره بازخوانی کنید.'); return; }
    if (!confirm('اتصال دقیق این قلم به «' + (product.nm || product.name || product.cd) + '» ثبت شود؟')) return;
    item.pcode = productCd;
    setData('ptf_crm_offers', offers);
    try { audit('کاتالوگ', 'اتصال دقیق قلم پیشنهاد به کالا ' + productCd, offerNo); } catch (e) {}
    var dlg = document.getElementById('catalogAuditDlg'); if (dlg) dlg.remove();
    if (typeof ptfToast === 'function') ptfToast('اتصال دقیق کالا ثبت شد؛ پیشنهاد و گزارش به‌روزرسانی شد.', 'ok');
    window.ptfCatalogIdentityAudit();
  };
})();
