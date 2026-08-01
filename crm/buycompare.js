/* =====================================================================
   PTF CRM — buycompare.js — Sprint 84
   US-186: چرخه استعلام قیمت خرید و مقایسه:
     دور ۱ (قبل از CO) و دور ۲ (بعد از برنده شدن) per آیتم per تامین‌کننده،
     تشخیص خودکار پایین‌ترین قیمت، انتخاب تامین‌کننده خرید per آیتم توسط
     کاربر مجاز و ثبت قیمت خرید نهایی.
   US-187: ادغام تامین‌کننده ثبت‌شده از سایت با رکورد موجود (تایید کاربر مجاز).
   داده: ptf_crm_buycmp = [{id, inqNo, items:[{nm,qty,un}], quotes:[{sup,idx,price,round,t,by,note}],
         purchases:[{idx,sup,price,t,by}], t, by}]
   ===================================================================== */
(function () {
  'use strict';

  function cmpAll() { return getData('ptf_crm_buycmp').filter(function (x) { return !x.mergedInto; }); }
  function mergeCmpRecordsForInquiry(inqNo) {
    var all = getData('ptf_crm_buycmp'), records = all.filter(function (x) { return x.inqNo === inqNo && !x.mergedInto; });
    if (!records.length) return null;
    var primary = records[0], base = (primary.items || []).length, mergedIds = primary.mergedRecords || [primary.id];
    for (var ri = 1; ri < records.length; ri++) {
      var source = records[ri], offset = base;
      (source.items || []).forEach(function (it, itemIdx) { it = JSON.parse(JSON.stringify(it)); it._mergedFromCmp = source.id; it._mergedFromIdx = itemIdx; primary.items = primary.items || []; primary.items.push(it); });
      (source.quotes || []).forEach(function (q) { var nq = JSON.parse(JSON.stringify(q)); nq.idx = (+q.idx || 0) + offset; nq._mergedFromCmp = source.id; primary.quotes = primary.quotes || []; primary.quotes.push(nq); });
      (source.purchases || []).forEach(function (p) { var np = JSON.parse(JSON.stringify(p)); np.idx = (+p.idx || 0) + offset; np._mergedFromCmp = source.id; primary.purchases = primary.purchases || []; primary.purchases.push(np); });
      base += (source.items || []).length;
      mergedIds.push(source.id);
      source.mergedInto = primary.id;
      source.mergedAt = faDateTime();
      source.mergedBy = curSession().name;
    }
    var knownKeys = {};
    (primary.items || []).forEach(function (it) { knownKeys[String(it.sourceItemKey || (typeof window.ptfProcLineKey === 'function' ? window.ptfProcLineKey(it) : it.nm || ''))] = true; });
    var salesOffers = typeof window.ptfSalesFileOffers === 'function' ? window.ptfSalesFileOffers({ inqNo: inqNo, wonOffer: primary.sourceOfferNo }) : [];
    salesOffers.forEach(function (offer) {
      (offer.items || []).forEach(function (it) {
        var key = String(typeof window.ptfProcLineKey === 'function' ? window.ptfProcLineKey(it) : (it.pcode || it.prodCd || it.name || it.desc || ''));
        if (!key || knownKeys[key]) return;
        primary.items = primary.items || [];
        primary.items.push({ nm: it.name || it.desc || '', qty: +it.qty || 1, un: it.unit || 'عدد', pcode: it.pcode || it.prodCd || '', spec: it.spec || it.desc || '', model: it.model || '', sourceOfferNo: offer.no, sourceItemKey: key });
        knownKeys[key] = true;
        base++;
      });
    });
    function normItem(v) { return String(v || '').trim().toLowerCase().replace(/[\u0600-\u06ff]/g, function (d) { return d; }).replace(/[\s\-_.،,؛;()\/\\]/g, ''); }
    function sameItem(a, b) {
      var ak = String(a.sourceItemKey || a.procLineKey || a.lineKey || '').trim();
      var bk = String(b.sourceItemKey || b.procLineKey || b.lineKey || '').trim();
      if (ak && bk && ak === bk) return true;
      var ac = normItem(a.pcode || a.prodCd || a.productCd), bc = normItem(b.pcode || b.prodCd || b.productCd);
      if (ac && bc && ac === bc) return true;
      var an = normItem(a.nm || a.name || a.desc), bn = normItem(b.nm || b.name || b.desc);
      if (!an || !bn || an !== bn) return false;
      var am = normItem(a.model || a.md), bm = normItem(b.model || b.md);
      var as = normItem(a.spec || a.st), bs = normItem(b.spec || b.st);
      return (!am || !bm || am === bm) && (!as || !bs || as === bs);
    }
    var compact = [], remap = [];
    (primary.items || []).forEach(function (it, oldIdx) {
      var duplicate = -1;
      for (var ci = 0; ci < compact.length; ci++) { if (sameItem(compact[ci], it)) { duplicate = ci; break; } }
      if (duplicate > -1) remap[oldIdx] = duplicate;
      else { remap[oldIdx] = compact.length; compact.push(it); }
    });
    if (compact.length !== (primary.items || []).length) {
      (primary.purchases || []).forEach(function (p) { if (remap[p.idx] != null) p.idx = remap[p.idx]; });
      (primary.quotes || []).forEach(function (q) { if (remap[q.idx] != null) q.idx = remap[q.idx]; });
      primary.items = compact;
      base = compact.length;
    }
    primary.mergedRecords = mergedIds;
    primary.mergedAt = faDateTime();
    primary.mergedBy = curSession().name;
    var idx = all.indexOf(primary);
    if (idx > -1) all[idx] = primary;
    setData('ptf_crm_buycmp', all);
    try { audit('قیمت خرید', 'تجمیع جدول‌های خرید واقعی برای ' + inqNo + ' — ' + base + ' قلم', primary.id); } catch (e) {}
    return primary;
  }
  function cmpSave(l) { setData('ptf_crm_buycmp', l); }
  function canBuy() { return !!roleDef().buyPrice; }
  function fmtP(v) { return (+v || 0).toLocaleString('fa-IR'); }
  window.ptfPurchaseLotsForItem = function (cmp, idx) {
    var item = (cmp && cmp.items || [])[idx] || {}, purchases = (cmp && cmp.purchases || []).filter(function (p) { return +p.idx === +idx; });
    return purchases.map(function (p) {
      return {
        cd: p.cd || '',
        qty: p.qty != null ? (+p.qty || 0) : (purchases.length === 1 ? (+item.qty || 1) : 1),
        supplier: p.sup || '',
        price: p.srcCur && p.priceFx != null ? (+p.priceFx || 0) : (+p.price || 0),
        currency: p.srcCur || p.cur || 'IRR',
        rate: +p.rate || 0,
        invoiceCd: p.supplierInvoiceCd || p.invoiceCd || '',
        status: p.status || 'purchased',
        returnedQty: +p.returnedQty || 0,
        stockedQty: +p.stockedQty || 0,
        availableQty: Math.max(0, (p.qty != null ? (+p.qty || 0) : (purchases.length === 1 ? (+item.qty || 1) : 1)) - (+p.returnedQty || 0) - (+p.stockedQty || 0))
      };
    });
  };
  window.ptfPurchaseQtyForItem = function (cmp, idx) {
    return window.ptfPurchaseLotsForItem(cmp, idx).reduce(function (sum, lot) { return sum + (lot.availableQty != null ? (+lot.availableQty || 0) : (+lot.qty || 0)); }, 0);
  };

  /* ---------- فهرست درخواست‌های دارای اقلام ---------- */
  function inqChoices() {
    var seen = {}, out = [];
    getData('ptf_crm_inqitems').forEach(function (r) {
      if (!seen[r.inqNo]) { seen[r.inqNo] = []; out.push({ no: r.inqNo, items: seen[r.inqNo] }); }
      seen[r.inqNo].push({ nm: r.en || r.nm, qty: r.qty || 1, un: r.un || '' });
    });
    // CO های دارای اقلام (اگر inqitems نبود)
    getData('ptf_crm_offers').forEach(function (o) {
      if (o.kind !== 'CO' || !o.inqNo || seen[o.inqNo]) return;
      seen[o.inqNo] = (o.items || []).map(function (it) { return { nm: it.name || it.desc, qty: it.qty || 1, un: it.unit || '' }; });
      out.push({ no: o.inqNo, items: seen[o.inqNo] });
    });
    return out;
  }
  function isWonInq(inqNo) {
    return getData('ptf_crm_offers').some(function (o) { return o.kind === 'CO' && o.inqNo === inqNo && o.st === 'won'; });
  }

  /* ---------- پنل بازسازی‌شده «قیمت‌های خرید» ---------- */
  window.buildBuyQuotes = function () {
    return '<div class="ph"><h3>🛒 قیمت‌های خرید و مقایسه تامین‌کنندگان</h3>' +
      '<div class="sb2"><button class="bt" onclick="cmpNew()">+ استعلام قیمت جدید (انتخاب درخواست)</button></div></div>' +
      '<div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:12px;padding:9px 13px;font-size:12px;color:#0c4a6e;margin-bottom:10px">' +
      'روند کار (US-186): ① درخواست را انتخاب کنید ② قیمت‌های <b>دور ۱</b> (قبل از پیشنهاد مالی) را per آیتم per تامین‌کننده ثبت کنید ③ بعد از برنده شدن، قیمت‌های <b>دور ۲</b> را از تامین‌کنندگان جدید بگیرید ④ سیستم پایین‌ترین قیمت هر آیتم را ✅ نشان می‌دهد ⑤ تامین‌کننده خرید نهایی را انتخاب و ثبت کنید.</div>' +
      '<div id="cmpWrap"></div>';
  };

  window.renderBuyQuotes = function () {
    var el = document.getElementById('cmpWrap');
    if (!el) return;
    if (!canBuy()) { el.innerHTML = '<div style="color:#dc2626;padding:20px;text-align:center">⛔ شما به قیمت‌های خرید دسترسی ندارید</div>'; return; }
    var list = cmpAll();
    // سازگاری قدیمی: buyquotes ساده قبلی هم فهرست شود
    var legacy = getData('ptf_crm_buyquotes');
    var h = list.map(function (c) {
      var won = isWonInq(c.inqNo);
      var nQ = (c.quotes || []).length;
      var nP = (c.purchases || []).length;
      return '<div style="border:1px solid var(--brd);border-radius:12px;padding:10px 14px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">' +
        '<div><b style="direction:ltr;display:inline-block">' + escP(c.inqNo) + '</b>' +
        (won ? ' <span style="background:#d1fae5;color:#059669;border-radius:8px;padding:1px 8px;font-size:10.5px">🏆 برنده — دور ۲ فعال</span>' : ' <span style="background:#e0e7ff;color:#4338ca;border-radius:8px;padding:1px 8px;font-size:10.5px">دور ۱</span>') +
        '<div style="font-size:11.5px;color:#64748b;margin-top:3px">' + (c.items || []).length + ' آیتم | ' + nQ + ' قیمت ثبت‌شده | ' + nP + ' خرید نهایی | ' + escP(c.t || '') + '</div></div>' +
        '<button class="bt" style="font-size:12px" onclick="cmpOpen(\'' + escP(c.id) + '\')">📊 جدول مقایسه</button></div>';
    }).join('');
    if (legacy.length) {
      h += '<details style="margin-top:10px"><summary style="cursor:pointer;font-size:12px;color:#64748b">📜 قیمت‌های خرید قدیمی (' + legacy.length + ' رکورد — فرمت قبل از v84)</summary><div class="tb2"><table><thead><tr><th>مرجع</th><th>تامین‌کننده</th><th>شرح</th><th>قیمت</th><th>تاریخ</th></tr></thead><tbody>' +
        legacy.map(function (b) { return '<tr><td>' + escP(b.ref || '-') + '</td><td>' + escP(b.sup) + '</td><td>' + escP(b.desc) + '</td><td>' + fmtP(b.price) + ' ریال</td><td>' + escP(b.t) + '</td></tr>'; }).join('') +
        '</tbody></table></div></details>';
    }
    el.innerHTML = h || '<div style="text-align:center;color:#94a3b8;padding:24px">استعلام قیمتی ثبت نشده — با دکمه بالا شروع کنید</div>';
  };

  /* ---------- ایجاد استعلام قیمت از یک درخواست ---------- */
  window.cmpNew = function () {
    if (!canBuy()) { alert('⛔ دسترسی ندارید'); return; }
    var choices = inqChoices();
    if (!choices.length) { alert('درخواستی با اقلام ثبت نشده.\nابتدا در «استعلامات» درخواست و اقلامش را ثبت/ایمپورت کنید.'); return; }
    var exist = {};
    cmpAll().forEach(function (c) { exist[c.inqNo] = true; });
    var opts = choices.map(function (c) {
      return '<option value="' + escP(c.no) + '"' + (exist[c.no] ? ' disabled' : '') + '>' + escP(c.no) + ' (' + c.items.length + ' قلم)' + (exist[c.no] ? ' — قبلاً ساخته شده' : '') + '</option>';
    }).join('');
    var html = '<div class="md-b" style="display:grid" onclick="if(event.target===this)hideModal()"><div class="md" style="max-width:440px">' +
      '<h3>🛒 استعلام قیمت جدید</h3>' +
      '<div class="fld"><label>شماره درخواست (از استعلام‌های ثبت‌شده) *</label><select id="cmpInq" style="direction:ltr">' + opts + '</select></div>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end"><button class="bt bt-o" onclick="hideModal()">انصراف</button>' +
      '<button class="bt" onclick="cmpCreate()">ایجاد جدول مقایسه</button></div></div></div>';
    document.getElementById('panels').insertAdjacentHTML('beforeend', html);
  };
  window.cmpCreate = function () {
    var inq = document.getElementById('cmpInq').value;
    if (!inq) return;
    var ch = inqChoices().filter(function (c) { return c.no === inq; })[0];
    if (!ch) return;
    var list = cmpAll();
    if (list.some(function (c) { return c.inqNo === inq; })) { alert('برای این درخواست قبلاً جدول ساخته شده'); return; }
    var rec = { id: genCode('CMP'), inqNo: inq, items: ch.items, quotes: [], purchases: [], t: faDate(), by: curSession().name };
    list.unshift(rec);
    cmpSave(list);
    hideModal();
    audit('قیمت خرید', 'ایجاد جدول مقایسه برای ' + inq, rec.id);
    renderBuyQuotes();
    cmpOpen(rec.id);
  };

  /* ---------- جدول مقایسه ---------- */
  window.cmpOpen = function (id, opts) {
    var c = cmpAll().filter(function (x) { return x.id === id; })[0];
    if (!c) return;
    var won = isWonInq(c.inqNo);
    /* v17.2 (US-412 — کیس استادی R8): حالت قفل‌شده مسیر پرونده فروش —
       قیمت‌های استعلامی (دور۱/۲) فقط‌خواندنی؛ استعلام جدید فقط از سامانه استعلام تامین */
    var locked = !!(opts && opts.realbuy);
    window._cmpRealbuyMode = locked; /* برای cmpBuy: منبع قیمت + تسعیر الزامی */
    // تامین‌کنندگانی که قیمت داده‌اند (ستون‌ها)
    var sups = [];
    (c.quotes || []).forEach(function (q) { if (sups.indexOf(q.sup) < 0) sups.push(q.sup); });
    var head = '<tr><th style="min-width:150px">آیتم</th><th>تعداد</th>' +
      sups.map(function (s) { return '<th style="min-width:110px">' + escP(s) + '</th>'; }).join('') +
      '<th>کمترین 💡</th><th>خرید نهایی</th></tr>';
    var rows = (c.items || []).map(function (it, idx) {
      var cells = '', best = null, bestSup = '';
      sups.forEach(function (s) {
        // آخرین قیمت این تامین‌کننده برای این آیتم (دور ۲ بر دور ۱ اولویت)
        var qs = (c.quotes || []).filter(function (q) { return q.sup === s && q.idx === idx; });
        var q2 = qs.filter(function (q) { return q.round === 2; }).pop();
        var q = q2 || qs.pop();
        if (q && (best === null || +q.price < best)) { best = +q.price; bestSup = s; }
        cells += '<td style="font-size:12px">' + (q
          ? fmtP(q.price) + ' <small style="color:#94a3b8">(دور' + (q.round || 1) + ')</small>'
          : '<span style="color:#cbd5e1">—</span>') + '</td>';
      });
      // هایلایت کمترین
      if (best !== null) {
        var re = new RegExp('<td style="font-size:12px">' + fmtP(best).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        cells = cells.replace(re, '<td style="font-size:12px;background:#ecfdf5;font-weight:800">✅ ' + fmtP(best));
      }
      var purchasedQty = window.ptfPurchaseQtyForItem(c, idx);
      var requiredQty = +it.qty || 1;
      var qtySummary = '<small style="display:block;color:' + (purchasedQty >= requiredQty ? '#047857' : purchasedQty > 0 ? '#b45309' : '#64748b') + '">نیاز: ' + requiredQty + ' ' + escP(it.un || '') + ' | خرید: ' + purchasedQty + ' ' + escP(it.un || '') + '</small>';
      var lots = ptfPurchaseLotsForItem(c, idx);
      var lotSummary = lots.map(function (lot) { return escP(lot.supplier) + ' — ' + lot.qty + ' ' + escP(it.un || '') + ' × ' + fmtP(lot.price) + ' ریال'; }).join('<br>');
      var editPurchaseAction = lots.length > 1 ? "cmpSplitOpen('" + escP(id) + "'," + idx + ")" : "cmpBuy('" + escP(id) + "'," + idx + ")";
      var editPurchaseLabel = lots.length > 1 ? '✏️ اصلاح تقسیم خرید' : '✏️ اصلاح خرید';
      var dispositionButton = lots.length ? '<br><button class="bt bt-o" style="margin-top:4px;font-size:10.5px;padding:3px 8px;color:#0e7490" data-id="' + escP(id) + '" data-idx="' + idx + '" onclick="cmpPurchaseDispositionOpen(this.dataset.id,+this.dataset.idx)">📦 تعیین‌تکلیف</button>' : '';
      var splitPurchaseButton = lots.length > 1 ? '' : '<br><button class="bt bt-o" style="margin-top:4px;font-size:10.5px;padding:3px 8px;color:#7c3aed" data-id="' + escP(id) + '" data-idx="' + idx + '" onclick="cmpSplitOpen(this.dataset.id,+this.dataset.idx)">🔀 تقسیم خرید</button>';
      var pu = (c.purchases || []).filter(function (p) { return p.idx === idx; })[0];
      var puCell = pu
        ? '<td style="background:#fef3c7;font-size:11.5px"><b>' + (lots.length > 1 ? 'چند lot' : escP(pu.sup)) + '</b><br>' + (lots.length > 1 ? lotSummary : fmtP(pu.price) + ' ریال') + (pu.srcCur ? '<br><small dir="ltr">' + (+pu.priceFx || 0).toLocaleString('en-US') + ' ' + escP(pu.srcCur) + ' × ' + (+pu.rate || 0).toLocaleString('fa-IR') + '</small>' : '') + (pu.dueISO ? '<br><small style="color:#0e7490">تعهد تحویل: ' + escP(pu.dueISO) + '</small>' : '') + ((pu.files||[]).length ? '<br><small>📎 رسید</small>' : '') + ' <small>' + escP(pu.t) + '</small><br><button class="bt bt-o" style="margin-top:4px;font-size:10.5px;padding:3px 8px;color:#0e7490" onclick="' + editPurchaseAction + '">' + editPurchaseLabel + '</button>' + splitPurchaseButton + dispositionButton + '</td>'
        : '<td><button class="bt" style="font-size:11px;padding:4px 9px;background:#059669" onclick="cmpBuy(\'' + escP(id) + '\',' + idx + ')">🛍 ثبت خرید</button><br><button class="bt bt-o" style="margin-top:4px;font-size:10.5px;padding:3px 8px;color:#7c3aed" onclick="cmpSplitOpen(\'' + escP(id) + '\',' + idx + '\')">🔀 تقسیم خرید</button></td>';
      return '<tr><td style="text-align:right;font-size:12px"><b>' + escP(it.nm) + '</b>' + qtySummary + '</td><td>' + (it.qty || 1) + ' ' + escP(it.un || '') + '</td>' + cells +
        '<td style="font-size:11.5px;color:#059669">' + (best !== null ? escP(bestSup) + '<br>' + fmtP(best) : '—') + '</td>' + puCell + '</tr>';
    }).join('');
    var html = '<div class="md-b" id="cmpModal_' + escP(id) + '" style="display:grid" onclick="if(event.target===this)hideModal()"><div class="md" style="max-width:960px;max-height:94vh;overflow:auto">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">' +
      '<h3 style="margin:0">📊 مقایسه قیمت خرید — <span style="direction:ltr;display:inline-block">' + escP(c.inqNo) + '</span></h3>' +
      '<div data-noix style="width:100%;font-size:11.5px;color:#64748b;margin-top:2px">قیمت‌های دور۱/دور۲ = <b>استعلامی (کشف قیمت)</b> | ستون «خرید نهایی» = <b>خرید واقعی</b> که مبنای سود پروژه است (US-392)</div>' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap">' +
      ((c.items || []).filter(function (it2, ix2) { return !(c.purchases || []).some(function (p2) { return p2.idx === ix2; }); }).length > 1
        ? '<button class="bt" style="font-size:12px;background:#0e7490" onclick="cmpBulkBuy(\'' + escP(id) + '\')" title="قیمت خرید هر قلم جداگانه در یک جدول — تامین‌کننده/ارز ردیف ۱ با یک کلیک روی همه (US-441)">🛒 ثبت گروهی خرید</button>'
        : '') +
      (locked
        ? '<span class="bd" style="background:#fef3c7;color:#b45309;padding:6px 12px" title="در مسیر پرونده فروش، قیمت‌های استعلامی فقط قابل مشاهده‌اند (US-412)">📌 استعلامی — فقط مشاهده</span>' +
          '<button class="bt" style="font-size:12px;background:#7c3aed" onclick="ptfRealBuyNewInquiry(\'' + escP(c.inqNo) + '\')" title="هر تغییر/استعلام قیمت (دور ۱ و ۲) فقط از سامانه استعلام تامین">🤖 استعلام جدید از تامین‌کننده</button>'
        : '<button class="bt" style="font-size:12px" onclick="cmpAddQuote(\'' + escP(id) + '\',1)">+ قیمت دور ۱</button>' +
          (won ? '<button class="bt" style="font-size:12px;background:#7c3aed" onclick="cmpAddQuote(\'' + escP(id) + '\',2)">+ قیمت دور ۲ (پس از برد)</button>' : '<span style="font-size:11px;color:#94a3b8;padding:6px">دور ۲ پس از برنده شدن CO فعال می‌شود</span>')) +
      '</div></div>' +
      (won ? '<div style="background:#ecfdf5;border:1px solid #10b981;border-radius:10px;padding:6px 12px;font-size:12px;color:#047857;margin:8px 0">🏆 CO این درخواست برنده شده — می‌توانید از تامین‌کنندگان جدید هم قیمت دور ۲ بگیرید و بهترین را انتخاب کنید.</div>' : '') +
      '<div class="tb2" style="margin-top:8px"><table>' + head + rows + '</table></div>' +
      '<div style="display:flex;justify-content:flex-end;margin-top:10px"><button class="bt bt-o" onclick="hideModal()">بستن</button></div></div></div>';
    document.getElementById('panels').insertAdjacentHTML('beforeend', html);
  };

  /* ---------- ثبت قیمت (دور ۱ یا ۲) ---------- */
  window.cmpAddQuote = function (id, round) {
    var c = cmpAll().filter(function (x) { return x.id === id; })[0];
    if (!c) return;
    var sups = getData('ptf_crm_suppliers');
    if (!sups.length) { alert('ابتدا تامین‌کننده ثبت کنید'); return; }
    var supOpts = sups.map(function (s) { return '<option>' + escP(s.co) + '</option>'; }).join('');
    var itemRows = (c.items || []).map(function (it, i) {
      return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">' +
        '<span style="flex:1;font-size:12px">' + (i + 1) + '. ' + escP(it.nm) + ' <small style="color:#94a3b8">(' + (it.qty || 1) + ' ' + escP(it.un || '') + ')</small></span>' +
        '<input type="text" inputmode="numeric" data-money="1" autocomplete="off" id="cmpP' + i + '" placeholder="قیمت واحد (ریال)" style="width:150px;padding:6px;border:1px solid var(--brd);border-radius:8px;direction:ltr;font-size:12px"></div>';
    }).join('');
    var html = '<div class="md-b" style="display:grid;z-index:65" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:560px;max-height:92vh;overflow:auto">' +
      '<h3>💰 ثبت قیمت دور ' + round + ' — ' + escP(c.inqNo) + '</h3>' +
      '<div class="fld"><label>تامین‌کننده *</label>' + (typeof window.ptfSupPickerHtml === 'function' ? window.ptfSupPickerHtml('cmpSup', '', '') : '<select id="cmpSup">' + supOpts + '</select>') + '</div>' +
      '<h4 style="margin:10px 0 6px;font-size:13px">قیمت هر آیتم (خالی = قیمت نداده)</h4>' + itemRows +
      '<div class="fld" style="margin-top:8px"><label>یادداشت (شرایط/اعتبار قیمت)</label><input type="text" id="cmpNote"></div>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end"><button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">انصراف</button>' +
      '<button class="bt" onclick="cmpQuoteSave(\'' + escP(id) + '\',' + round + ', this)">ثبت قیمت‌ها</button></div></div></div>';
    document.getElementById('panels').insertAdjacentHTML('beforeend', html);
  };
  window.cmpQuoteSave = function (id, round, btn) {
    var list = cmpAll();
    var c = list.filter(function (x) { return x.id === id; })[0];
    if (!c) return;
    var sup = document.getElementById('cmpSup').value;
    var note = (document.getElementById('cmpNote') || {}).value || '';
    var added = 0;
    (c.items || []).forEach(function (it, i) {
      var v = ptfNum((document.getElementById('cmpP' + i) || {}).value);
      if (v > 0) {
        c.quotes = c.quotes || [];
        c.quotes.push({ sup: sup, idx: i, price: v, round: round, note: note, t: faDate(), by: curSession().name });
        added++;
      }
    });
    if (!added) { alert('حداقل یک قیمت وارد کنید'); return; }
    cmpSave(list);
    audit('قیمت خرید', 'ثبت ' + added + ' قیمت دور ' + round + ' از ' + sup + ' برای ' + c.inqNo, id);
    btn.closest('.md-b').remove();
    document.querySelectorAll('.md-b').forEach(function (m) { if ((m.style || {}).display !== 'none') m.remove(); }); /* v16.2 BUG-017: مینیمایزها محفوظ */
    renderBuyQuotes();
    cmpOpen(id);
    if (typeof ptfToast === 'function') ptfToast('✅ ' + added + ' قیمت دور ' + round + ' ثبت شد', 'ok');
  };


  function rbFindDeal(inqNo) {
    return getData('ptf_crm_deals').filter(function (d) { return d.inqNo === inqNo || d.offerNo === inqNo || d.wonOffer === inqNo; })[0];
  }
  function rbDeleteCloudKeys(keys) {
    keys = (keys || []).filter(Boolean);
    if (!keys.length) return;
    try {
      fetch((typeof STORAGE_API !== 'undefined' ? STORAGE_API : '../api/storage.php') + '?action=delete_batch', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keys: keys })
      }).catch(function () {});
    } catch (e) {}
  }
  window.ptfRealBuyReceiptUpload = function (cmpId, idx, pcd) {
    if (typeof attachUploadWidget !== 'function') return;
    var html = '<div class="md-b" style="display:grid;z-index:2600" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:460px"><h3>📎 رسید پرداخت خرید واقعی</h3><div style="font-size:12px;color:#64748b;margin-bottom:8px">رسید پرداخت به تامین‌کننده را پیوست کنید تا در پرونده فروش هم ثبت شود.</div><div id="rbPayUp"></div><div style="text-align:left;margin-top:10px"><button class="bt" onclick="this.closest(\'.md-b\').remove()">تمام</button></div></div></div>';
    (document.getElementById('panels') || document.body).insertAdjacentHTML('beforeend', html);
    attachUploadWidget('rbPayUp', 'realbuy/' + cmpId + '/' + pcd, function (f) {
      var list = cmpAll();
      var c = list.filter(function (x) { return x.id === cmpId; })[0]; if (!c) return;
      var pu = (c.purchases || []).filter(function (p) { return p.cd === pcd || p.idx === idx; })[0]; if (!pu) return;
      pu.files = pu.files || []; pu.files.push(f); cmpSave(list);
      var d = rbFindDeal(c.inqNo);
      if (d) {
        d.docs = d.docs || [];
        if (f.key && !d.docs.some(function (x) { return x.key === f.key; })) d.docs.push({ folder: 'fin', name: 'رسید پرداخت خرید واقعی — ' + ((c.items[idx]||{}).nm || ''), key: f.key, t: faDate(), by: curSession().name, note: 'خرید واقعی از ' + (pu.sup || '') });
        var deals = getData('ptf_crm_deals').map(function (x) { return x.cd === d.cd ? d : x; });
        setData('ptf_crm_deals', deals);
      }
      if (typeof ptfToast === 'function') ptfToast('رسید پرداخت به خرید واقعی و پرونده فروش پیوست شد', 'ok');
    });
  };
  function ptfProjectCostLabels() {
    return {
      shipping: 'حمل/باربری',
      customs: 'گمرک/ترخیص',
      inspection: 'بازرسی/تست',
      bank: 'کارمزد بانکی',
      warranty: 'گارانتی/خدمات پس از تحویل',
      other: 'سایر'
    };
  }
  window.ptfProjectCostOpen = function (inqNo, costCd) {
    var d = rbFindDeal(inqNo);
    if (!d) { alert('پرونده فروش مرتبط پیدا نشد'); return; }
    var old = costCd ? ((d.costEvents || []).filter(function (x) { return x.cd === costCd; })[0] || null) : null;
    var labels = ptfProjectCostLabels();
    ptfDialog({ title: (old ? '✏️ اصلاح' : '➕ ثبت') + ' هزینه مرتبط با پرونده فروش', body: 'هزینه‌های حمل، گمرک، ترخیص، بازرسی، کارمزد، گارانتی و سایر هزینه‌های مستقیم پروژه را اینجا ثبت کنید تا در سود پروژه لحاظ شود.', fields: [
      { id: 'amt', label: 'مبلغ هزینه (ریال)', type: 'number', required: true, dir: 'ltr', value: old ? old.amt : '' },
      { id: 'cat', label: 'نوع هزینه', type: 'select', value: old ? old.cat : 'shipping', options: [{v:'shipping',lb:'حمل/باربری'},{v:'customs',lb:'گمرک/ترخیص'},{v:'inspection',lb:'بازرسی/تست'},{v:'bank',lb:'کارمزد بانکی'},{v:'warranty',lb:'گارانتی/خدمات پس از تحویل'},{v:'other',lb:'سایر'}] },
      { id: 'desc', label: 'شرح هزینه', type: 'textarea', rows: 2, required: true, value: old ? old.desc : '' }
    ], okText: (old ? 'ذخیره اصلاح' : 'ثبت هزینه'), onOk: function (v) {
      var amt = +v.amt || 0; if (!amt) { alert('مبلغ هزینه الزامی است'); return; }
      d.costEvents = d.costEvents || [];
      var ev = old || { cd: genCode('CST'), by: curSession().name, t: faDateTime(), files: [] };
      var prevAmt = +ev.amt || 0;
      ev.amt = amt; ev.cat = v.cat; ev.desc = v.desc;
      ev.updatedBy = curSession().name; ev.updatedT = faDateTime();
      if (old) {
        d.costEvents = d.costEvents.map(function (x) { return x.cd === ev.cd ? ev : x; });
      } else {
        d.costEvents.unshift(ev);
      }
      d.timeline = d.timeline || [];
      d.timeline.push({ t: faDateTime(), by: curSession().name, tx: (old ? '✏️ اصلاح' : '➕ ثبت') + ' هزینه مستقیم پروژه: ' + amt.toLocaleString('fa-IR') + ' ریال — ' + (labels[v.cat] || v.cat) + ' — ' + v.desc + (old ? ' (قبلی: ' + prevAmt.toLocaleString('fa-IR') + ')' : '') });
      setData('ptf_crm_deals', getData('ptf_crm_deals').map(function (x) { return x.cd === d.cd ? d : x; }));
      audit('هزینه پروژه', (old ? 'اصلاح' : 'ثبت') + ' هزینه مستقیم ' + amt.toLocaleString('fa-IR') + ' ریال برای ' + (d.inqNo || ''), ev.cd);
      if (typeof ptfToast === 'function') ptfToast(old ? 'هزینه مستقیم پروژه اصلاح شد' : 'هزینه مستقیم پروژه ثبت شد', 'ok');
      if (!old && confirm('برای این هزینه مدرک/رسید پیوست می‌کنید؟') && typeof attachUploadWidget === 'function') ptfProjectCostUpload(d.cd, ev.cd);
      if (typeof renderDeals === 'function') renderDeals();
    }});
  };
  window.ptfProjectCostUpload = function (dealCd, costCd) {
    var html = '<div class="md-b" style="display:grid;z-index:2600" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:460px"><h3>📎 پیوست هزینه پروژه</h3><div id="prjCostUp"></div><div style="text-align:left;margin-top:10px"><button class="bt" onclick="this.closest(\'.md-b\').remove()">تمام</button></div></div></div>';
    (document.getElementById('panels') || document.body).insertAdjacentHTML('beforeend', html);
    attachUploadWidget('prjCostUp', 'project-cost/' + dealCd + '/' + costCd, function (f) {
      var ds = getData('ptf_crm_deals'); var d = ds.filter(function (x) { return x.cd === dealCd; })[0]; if (!d) return;
      var ev = (d.costEvents || []).filter(function (x) { return x.cd === costCd; })[0]; if (!ev) return;
      ev.files = ev.files || []; ev.files.push(f);
      d.docs = d.docs || []; if (f.key) d.docs.push({ folder: 'fin', name: 'رسید هزینه پروژه — ' + (ev.desc || ''), key: f.key, t: faDate(), by: curSession().name, note: 'هزینه مستقیم پروژه', costCd: ev.cd });
      setData('ptf_crm_deals', ds.map(function (x) { return x.cd === dealCd ? d : x; }));
    });
  };
  window.ptfProjectCostDel = function (inqNo, costCd) {
    var d = rbFindDeal(inqNo);
    if (!d) return;
    var ev = (d.costEvents || []).filter(function (x) { return x.cd === costCd; })[0];
    if (!ev) return;
    if (!confirm('هزینه «' + (ev.desc || '') + '» حذف شود؟')) return;
    var deadKeys = (d.docs || []).filter(function (x) { return x.costCd === costCd && x.key; }).map(function (x) { return x.key; });
    d.costEvents = (d.costEvents || []).filter(function (x) { return x.cd !== costCd; });
    d.timeline = d.timeline || [];
    d.timeline.push({ t: faDateTime(), by: curSession().name, tx: '🗑 حذف هزینه مستقیم پروژه: ' + (ev.desc || '') + ' — ' + (+ev.amt || 0).toLocaleString('fa-IR') + ' ریال' });
    d.docs = (d.docs || []).filter(function (x) { return x.costCd !== costCd; });
    setData('ptf_crm_deals', getData('ptf_crm_deals').map(function (x) { return x.cd === d.cd ? d : x; }));
    rbDeleteCloudKeys(deadKeys);
    audit('هزینه پروژه', 'حذف هزینه مستقیم پرونده ' + (d.inqNo || ''), costCd);
    if (typeof ptfToast === 'function') ptfToast('هزینه مستقیم پروژه حذف شد', 'warn');
    if (typeof renderDeals === 'function') renderDeals();
  };


  window.ptfRealBuyEnsureStatus = function (inqNo) {
    if (!inqNo) return;
    try {
      var rfqs = getData('ptf_crm_rfqs');
      var r = rfqs.filter(function (x) { return x.cd === inqNo || x.inqNo === inqNo; })[0];
      if (!r) return;
      var done = ['st8','st9','st6','st7','stInv','stPay','stX'];
      if (done.indexOf(r.st) > -1) return;
      var txt = '🏭 در حال تامین توسط تامین‌کننده';
      if (typeof ptfRfqSetStatus === 'function') ptfRfqSetStatus(r.cd, 'st8', txt);
      else { r.st = 'st8'; r.stxt = txt; setData('ptf_crm_rfqs', rfqs); }
    } catch (e) {}
  };

  /* ===== v19.9 (BUG-032 + US-441 — مصوبه تیم چابکی): ثبت گروهی خرید واقعی =====
     مساله: درخواست ۱۲۰ قلمی = ۱۲۰ بار مودال؛ و کاربر قیمت کل را در فیلد تک‌قلم می‌گذاشت.
     راه‌حل: یک جدول — هر ردیف قیمت واحد (کامادار US-438) + تامین‌کننده؛ «اعمال ردیف ۱ روی همه»؛
     ارز/نرخ مشترک اختیاری؛ جمع کل زنده؛ ردیف خالی رد می‌شود (ثبت جزئی مجاز).
     هسته قابل تست: هر ردیف از همان مسیر ثبت purchases/payables موجود می‌گذرد. */
  window.cmpBulkBuyCommit = function (id, rows, shared) {
    /* rows: [{idx, price, sup, pay}] — price=واحد به ارز shared.cur؛ shared: {cur, rate, dueISO} */
    if (!canBuy()) return { ok: false, why: 'perm' };
    shared = shared || {};
    var list = cmpAll();
    var c2 = list.filter(function (x) { return x.id === id; })[0];
    if (!c2) return { ok: false, why: 'nocmp' };
    var cur = shared.cur || 'IRR';
    var rate = +shared.rate || 0;
    if (cur !== 'IRR' && !rate) return { ok: false, why: 'rate' }; /* تسعیر الزامی — US-412 */
    var done = 0, skipped = 0, total = 0;
    (rows || []).forEach(function (rw) {
      var idx = +rw.idx;
      var price = (typeof ptfNum === 'function') ? ptfNum(rw.price) : (+String(rw.price || '').replace(/[^\d.-]/g, '') || 0);
      var sup = String(rw.sup || '').trim();
      if (!price || !sup) { skipped++; return; } /* ردیف ناقص = رد (ثبت جزئی مجاز) */
      if ((c2.purchases || []).some(function (p) { return p.idx === idx; })) { skipped++; return; } /* خریده‌شده دست نمی‌خورد */
      var priceFx = 0, buyPrice = price;
      if (cur !== 'IRR') { priceFx = price; buyPrice = Math.round(price * rate); }
      var pcd = genCode('PUR');
      c2.purchases = c2.purchases || [];
      var srcItem = (c2.items || [])[idx] || {};
      c2.purchases.push({ cd: pcd, idx: idx, sourcePcode: srcItem.pcode || srcItem.prodCd || '', sourceItemKey: srcItem.sourceItemKey || (typeof window.ptfProcLineKey === 'function' ? window.ptfProcLineKey(srcItem) : ''), sup: sup, price: buyPrice, cur: 'IRR', srcCur: cur !== 'IRR' ? cur : '', priceFx: priceFx, rate: cur !== 'IRR' ? rate : 0, pay: rw.pay || 'cash', dueISO: shared.dueISO || '', dueNote: '', manual: true, bulk: true, t: faDate(), by: curSession().name, files: [] });
      /* خرید واقعی فقط operational است؛ تعهد یا فاکتور تأمین‌کننده اینجا ساخته نمی‌شود. */
      total += buyPrice * (+(c2.items[idx] || {}).qty || 1);
      done++;
    });
    if (done) {
      cmpSave(list);
      if (typeof ptfRealBuyEnsureStatus === 'function') ptfRealBuyEnsureStatus(c2.inqNo); /* BUG-029: گذار st8 */
      try { audit('قیمت خرید', 'ثبت گروهی خرید واقعی (US-441): ' + done + ' قلم — جمع ' + total.toLocaleString('fa-IR') + ' ریال' + (cur !== 'IRR' ? ' (تسعیر ' + cur + '×' + rate.toLocaleString('fa-IR') + ')' : '') + ' — ' + c2.inqNo, c2.id); } catch (e) {}
      if (typeof notify === 'function') { try { notify({ toRoles: SENIOR_ROLES, title: '🛒 ثبت گروهی خرید: ' + done + ' قلم درخواست ' + c2.inqNo + ' — جمع ' + total.toLocaleString('fa-IR') + ' ریال', kind: 'buyq', channels: ['cart'], link: { panel: 'deals' } }); } catch (e2) {} }
    }
    return { ok: true, done: done, skipped: skipped, total: total };
  };
  window.cmpBulkBuy = function (id) {
    if (!canBuy()) { alert('⛔ دسترسی ندارید'); return; }
    var c = cmpAll().filter(function (x) { return x.id === id; })[0];
    if (!c) return;
    var pend = (c.items || []).map(function (it, ix) { return { it: it, ix: ix }; }).filter(function (x) { return !(c.purchases || []).some(function (p) { return p.idx === x.ix; }); });
    if (!pend.length) { alert('همه اقلام قبلا خرید واقعی دارند ✅'); return; }    var supList = [];
    try { supList = getData('ptf_crm_suppliers')||[]; } catch(e){}
    var supOptsHtml = '<option value="">— انتخاب تامین‌کننده —</option>' + supList.map(function(s){ return '<option value="'+escP(s.co)+'" data-cd="'+escP(s.cd)+'">'+escP(s.co)+' ('+escP(s.cd)+')</option>'; }).join('') + '<option value="__manual__">✍️ ورود دستی</option>';
    var rowsHtml = pend.map(function (x, n) {
      return '<tr><td style="text-align:right;font-size:12px"><b>' + escP(x.it.nm) + '</b><br><small style="color:#94a3b8">تعداد: ' + (x.it.qty || 1) + ' ' + escP(x.it.un || '') + '</small></td>' +
        '<td><input type="text" inputmode="numeric" data-money="1" data-nohint="1" autocomplete="off" id="blkP' + x.ix + '" oninput="cmpBulkTotal(\'' + escP(id) + '\')" placeholder="قیمت واحد" style="width:120px;padding:6px;border:1px solid var(--brd);border-radius:8px;direction:ltr;font-size:12px"></td>' +
        '<td><select id="blkS' + x.ix + '" style="width:170px;padding:6px;border:1px solid var(--brd);border-radius:8px;font-size:12px">' + supOptsHtml + '</select>' +
        (n === 0 ? '<br><button type="button" class="bt bt-o" style="font-size:10.5px;padding:2px 8px;margin-top:3px;color:#0e7490" onclick="cmpBulkApplySup(\'' + escP(id) + '\')">⚡ اعمال روی همه</button>' : '') + '</td>' +
        '<td><select id="blkPay' + x.ix + '" style="padding:6px;border:1px solid var(--brd);border-radius:8px;font-size:12px"><option value="cash">💵 نقدی</option><option value="credit">🧾 غیرنقدی</option></select></td></tr>';
    }).join('');
    var html = '<div class="md-b" id="blkDlg" style="display:grid;z-index:2600" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:760px;max-height:92vh;overflow:auto">' +
      '<h3>🛒 ثبت گروهی خرید واقعی — ' + escP(c.inqNo) + ' <small style="color:#64748b">(' + pend.length + ' قلم بدون خرید)</small></h3>' +
      '<div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:8px 12px;font-size:12px;color:#0c4a6e;margin-bottom:10px">قیمت <b>واحد</b> هر قلم را جدا وارد کنید (BUG-032) — ردیف خالی ثبت نمی‌شود (ثبت جزئی مجاز). تامین‌کننده ردیف ۱ با «⚡ اعمال روی همه» تکثیر می‌شود (US-441).</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;align-items:end">' +
      '<div class="fld" style="margin:0"><label>ارز قیمت‌ها</label><select id="blkCur" onchange="cmpBulkTotal(\'' + escP(id) + '\')" style="padding:7px;border:1px solid var(--brd);border-radius:8px"><option value="IRR">ریال (IRR)</option><option value="USD">دلار (USD)</option><option value="EUR">یورو (EUR)</option><option value="CNY">یوان (CNY)</option></select></div>' +
      '<div class="fld" style="margin:0"><label>نرخ تسعیر (ریال per واحد ارز — برای ارزی الزامی)</label><input type="text" inputmode="numeric" data-money="1" data-nohint="1" autocomplete="off" id="blkRate" oninput="cmpBulkTotal(\'' + escP(id) + '\')" style="width:150px;padding:7px;border:1px solid var(--brd);border-radius:8px;direction:ltr"></div>' +
      '<div class="fld" style="margin:0"><label>تعهد تحویل تامین‌کننده (شمسی/اختیاری)</label>' + (typeof ptfDatePicker==='function' ? ptfDatePicker('blkDueJ','') : '<input type="text" id="blkDueJ" placeholder="1405/04/19" style="padding:7px;border:1px solid var(--brd);border-radius:8px;direction:ltr">') + '</div></div>' +
      '<div class="tb2"><table style="width:100%"><thead><tr><th>قلم</th><th>قیمت واحد</th><th>تامین‌کننده</th><th>پرداخت</th></tr></thead><tbody>' + rowsHtml + '</tbody></table></div>' +
      '<div id="blkTot" style="font-size:13.5px;font-weight:900;color:#0e7490;margin-top:10px;text-align:left;direction:ltr"></div>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px">' +
      '<button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">انصراف</button>' +
      '<button class="bt" style="background:#0e7490" onclick="cmpBulkBuyGo(\'' + escP(id) + '\')">🛒 ثبت خریدهای واردشده</button>' +
      '</div></div></div>';
    (document.getElementById('panels') || document.body).insertAdjacentHTML('beforeend', html);
    window._blkPend = pend.map(function (x) { return x.ix; });
  };
  window.cmpBulkApplySup = function (id) {
    var ixs = window._blkPend || [];
    if (!ixs.length) return;
    var first = (document.getElementById('blkS' + ixs[0]) || {}).value || '';
    if (!first.trim()) { alert('اول تامین‌کننده ردیف ۱ را وارد کنید'); return; }
    ixs.forEach(function (ix) { var el = document.getElementById('blkS' + ix); if (el && !el.value.trim()) el.value = first; });
    if (typeof ptfToast === 'function') ptfToast('⚡ تامین‌کننده روی ردیف‌های خالی اعمال شد', 'ok');
  };
  window.cmpBulkTotal = function (id) {
    var c = cmpAll().filter(function (x) { return x.id === id; })[0];
    if (!c) return;
    var ixs = window._blkPend || [];
    var cur = (document.getElementById('blkCur') || {}).value || 'IRR';
    var rate = (typeof ptfNum === 'function') ? ptfNum((document.getElementById('blkRate') || {}).value) : 0;
    var tot = 0, totFx = 0, n = 0;
    ixs.forEach(function (ix) {
      var p = (typeof ptfNum === 'function') ? ptfNum((document.getElementById('blkP' + ix) || {}).value) : 0;
      if (!p) return;
      var qty = +(c.items[ix] || {}).qty || 1;
      if (cur === 'IRR') tot += p * qty; else { totFx += p * qty; if (rate) tot += Math.round(p * rate) * qty; }
      n++;
    });
    var el = document.getElementById('blkTot');
    if (el) el.innerHTML = n ? ('جمع کل (اطلاعاتی) — ' + n + ' قلم = ' + (cur !== 'IRR' ? totFx.toLocaleString('en-US') + ' ' + cur + (rate ? ' ≈ ' + tot.toLocaleString('fa-IR') + ' ریال' : ' (نرخ تسعیر؟)') : tot.toLocaleString('fa-IR') + ' ریال') + ' <small>(قیمت واحد هر قلم را وارد کنید — جمع فقط برای اطلاع است)</small>') : '';
  };
  window.cmpBulkBuyGo = function (id) {
    var ixs = window._blkPend || [];
    var cur = (document.getElementById('blkCur') || {}).value || 'IRR';
    var rate = (typeof ptfNum === 'function') ? ptfNum((document.getElementById('blkRate') || {}).value) : 0;
    var due = (typeof ptfJToISO === 'function') ? ptfJToISO(((document.getElementById('blkDueJ') || {}).value || '')) : (((document.getElementById('blkDueJ') || {}).value || ''));
    var rows = ixs.map(function (ix) {
      return { idx: ix, price: (document.getElementById('blkP' + ix) || {}).value, sup: (document.getElementById('blkS' + ix) || {}).value, pay: (document.getElementById('blkPay' + ix) || {}).value || 'cash' };
    });
    var res = cmpBulkBuyCommit(id, rows, { cur: cur, rate: rate, dueISO: due });
    if (!res.ok) { alert(res.why === 'rate' ? '⛔ خرید ارزی بدون نرخ تسعیر ثبت نمی‌شود (US-412)' : res.why === 'perm' ? '⛔ دسترسی ندارید' : '⛔ ثبت نشد'); return; }
    if (!res.done) { alert('هیچ ردیف کاملی (قیمت + تامین‌کننده) وارد نشده'); return; }
    var dlg = document.getElementById('blkDlg'); if (dlg) dlg.remove();
    if (typeof ptfToast === 'function') ptfToast('🛒 ' + res.done + ' خرید ثبت شد' + (res.skipped ? ' — ' + res.skipped + ' ردیف ناقص رها شد' : ''), 'ok');
    var wasRealbuy = window._cmpRealbuyMode;
    var oldCmp = document.getElementById('cmpModal_' + id); if (oldCmp) oldCmp.remove();
    renderBuyQuotes();
    cmpOpen(id, wasRealbuy ? { realbuy: true } : undefined);
  };

  window.cmpPurchaseStockOpen = function (id, idx, purchaseCd) {
    var c = cmpAll().filter(function (x) { return x.id === id; })[0]; if (!c) return;
    var item = c.items[idx] || {}, p = (c.purchases || []).filter(function (x) { return x.cd === purchaseCd; })[0];
    if (!p) return;
    var purchased = p.qty != null ? (+p.qty || 0) : (+item.qty || 1), available = Math.max(0, purchased - (+p.returnedQty || 0) - (+p.stockedQty || 0));
    if (!available) { alert('مقدار قابل انتقال به انبار صفر است.'); return; }
    var products = getData('ptf_crm_products') || [], options = '<option value="">— انتخاب کالا —</option>' + products.map(function (x) { return '<option value="' + escP(x.cd) + '"' + (x.cd === (item.pcode || item.prodCd) ? ' selected' : '') + '>' + escP(x.nm || x.cd) + ' — ' + escP(x.cd) + '</option>'; }).join('');
    ptfDialog({ title: '📦 انتقال خرید به موجودی — ' + (item.nm || ''), body: 'این مرحله فقط موجودی عملیاتی را ثبت می‌کند و بدهی تأمین‌کننده یا فاکتور را تغییر نمی‌دهد.', fields: [{ id: 'prodCd', label: 'کالا *', type: 'select', optionsHtml: options, required: true }, { id: 'qty', label: 'مقدار انتقالی (حداکثر ' + available + ')', type: 'number', value: available, required: true }, { id: 'location', label: 'محل نگهداری', value: 'انبار', required: true }, { id: 'note', label: 'یادداشت', type: 'textarea', value: 'انتقال از پرونده ' + (c.inqNo || '') }], okText: 'ثبت انتقال به انبار', onOk: function (v) {
      var qty = +v.qty || 0; if (!v.prodCd || qty <= 0 || qty > available) { alert('کالا و مقدار معتبر الزامی است.'); return; }
      if (typeof ptfSurplusAdd !== 'function') { alert('ماژول موجودی انبار در دسترس نیست.'); return; }
      var stock = ptfSurplusAdd(v.prodCd, qty, v.location || 'انبار', c.inqNo || '', v.note || 'انتقال خرید به موجودی');
      if (!stock) { alert('ثبت موجودی انجام نشد.'); return; }
      var stored = getData('ptf_crm_buycmp'), storedCmp = stored.filter(function (x) { return x.id === id; })[0], storedP = storedCmp && (storedCmp.purchases || []).filter(function (x) { return x.cd === purchaseCd; })[0];
      if (!storedP) return;
      storedP.stockedQty = (+storedP.stockedQty || 0) + qty; storedP.stockedAt = faDateTime(); storedP.stockedBy = curSession().name;
      var totalDisposition = (+storedP.returnedQty || 0) + (+storedP.stockedQty || 0); storedP.status = totalDisposition >= purchased ? ((+storedP.returnedQty || 0) >= purchased ? 'returned_to_supplier' : 'transferred_to_stock') : 'partially_disposed';
      setData('ptf_crm_buycmp', stored); try { audit('موجودی انبار', 'انتقال ' + qty + ' از قلم ' + (item.nm || '') + ' به موجودی — بدون اثر مالی', purchaseCd); } catch (e) {}
      var dlg = document.getElementById('cmpDispositionDlg'); if (dlg) dlg.remove(); cmpPurchaseDispositionOpen(id, idx);
    } });
  };
  window.cmpPurchaseReturnOpen = function (id, idx, purchaseCd) {
    var c = cmpAll().filter(function (x) { return x.id === id; })[0]; if (!c) return;
    var item = c.items[idx] || {}, p = (c.purchases || []).filter(function (x) { return x.cd === purchaseCd; })[0];
    if (!p) return;
    var purchased = p.qty != null ? (+p.qty || 0) : (+item.qty || 1), returned = +p.returnedQty || 0, available = Math.max(0, purchased - returned);
    if (!available) { alert('مقدار قابل برگشت این lot صفر است.'); return; }
    ptfDialog({ title: '↩️ برگشت به تأمین‌کننده — ' + (item.nm || ''), body: 'تأثیر این ثبت در این مرحله فقط operational است و حساب تأمین‌کننده را تغییر نمی‌دهد.', fields: [{ id: 'qty', label: 'مقدار برگشتی (حداکثر ' + available + ')', type: 'number', value: available, required: true }, { id: 'reason', label: 'دلیل برگشت *', type: 'select', options: [{ v: 'عدم تأیید مشتری', lb: 'عدم تأیید مشتری' }, { v: 'عدم نیاز مشتری', lb: 'عدم نیاز مشتری' }, { v: 'مغایرت فنی/کیفی', lb: 'مغایرت فنی/کیفی' }, { v: 'مقدار اضافی یا اشتباه', lb: 'مقدار اضافی یا اشتباه' }, { v: 'لغو یا تغییر پروژه', lb: 'لغو یا تغییر پروژه' }, { v: 'درخواست تأمین‌کننده', lb: 'درخواست تأمین‌کننده' }, { v: 'سایر', lb: 'سایر' }] }, { id: 'reasonOther', label: 'توضیح تکمیلی (برای سایر یا شرح بیشتر)', type: 'textarea', rows: 2 }], okText: 'ثبت برگشت', onOk: function (v) {
      var qty = +v.qty || 0, reason = String(v.reason || '').trim(), detail = String(v.reasonOther || '').trim(); if (qty <= 0 || qty > available || !reason || (reason === 'سایر' && !detail)) { alert('مقدار معتبر و دلیل برگشت الزامی است؛ برای «سایر» توضیح وارد کنید.'); return; }
      var stored = getData('ptf_crm_buycmp'), storedCmp = stored.filter(function (x) { return x.id === id; })[0], storedP = storedCmp && (storedCmp.purchases || []).filter(function (x) { return x.cd === purchaseCd; })[0];
      if (!storedP) { alert('رکورد lot برای ذخیره پیدا نشد؛ صفحه را بازخوانی کنید.'); return; }
      storedP.returnedQty = (+storedP.returnedQty || 0) + qty;
      storedP.returnReason = reason + (detail ? ' — ' + detail : '');
      storedP.returnedAt = faDateTime();
      storedP.returnedBy = curSession().name;
      var storedPurchased = storedP.qty != null ? (+storedP.qty || 0) : (+item.qty || 1);
      storedP.status = storedP.returnedQty >= storedPurchased ? 'returned_to_supplier' : 'partially_returned';
      setData('ptf_crm_buycmp', stored);
      try { audit('خرید واقعی', 'ثبت برگشت ' + qty + ' از قلم ' + (item.nm || '') + ' به تأمین‌کننده — بدون اثر مالی خودکار', purchaseCd); } catch (e) {}
      var dlg = document.getElementById('cmpDispositionDlg'); if (dlg) dlg.remove(); if (typeof ptfToast === 'function') ptfToast('برگشت عملیاتی ثبت شد؛ اثر مالی هنوز ایجاد نشده است.', 'ok'); cmpPurchaseDispositionOpen(id, idx);
    } });
  };
  window.cmpPurchaseDispositionOpen = function (id, idx) {
    var c = cmpAll().filter(function (x) { return x.id === id; })[0]; if (!c) return;
    var item = c.items[idx] || {}, lots = ptfPurchaseLotsForItem(c, idx);
    if (!lots.length) { alert('برای این قلم خرید ثبت نشده است.'); return; }
    var rows = lots.map(function (lot) {
      var statusLabel = lot.status === 'returned_to_supplier' ? 'برگشت کامل' : lot.status === 'partially_returned' ? 'برگشت جزئی' : lot.status === 'transferred_to_stock' ? 'انتقال کامل به انبار' : lot.status === 'partially_disposed' ? 'تعیین‌تکلیف جزئی' : 'خرید ثبت‌شده';
      var returnButton = lot.status === 'returned_to_supplier' || lot.availableQty <= 0 ? '<span style="color:#64748b">—</span>' : '<button class="bt bt-o" style="padding:3px 8px;font-size:11px;color:#b45309" onclick="cmpPurchaseReturnOpen(\'' + escP(id) + '\',' + idx + ',\'' + escP(lot.cd) + '\')">↩️ برگشت کامل/جزئی</button>';
      var stockButton = lot.availableQty > 0 ? '<button class="bt bt-o" style="padding:3px 8px;font-size:11px;color:#047857;margin-top:3px" onclick="cmpPurchaseStockOpen(\'' + escP(id) + '\',' + idx + ',\'' + escP(lot.cd) + '\')">📦 انتقال انبار</button>' : '';
      return '<tr><td>' + escP(lot.supplier || '-') + '</td><td>' + lot.qty + ' ' + escP(item.un || '') + '</td><td>' + fmtP(lot.price) + ' ریال</td><td>' + statusLabel + '</td><td>' + lot.availableQty + ' ' + escP(item.un || '') + '</td><td>' + returnButton + '<br>' + stockButton + '</td></tr>';
    }).join('');
    var purchased = lots.reduce(function (s, lot) { return s + (+lot.availableQty || 0); }, 0);
    var html = '<div class="md-b" id="cmpDispositionDlg" style="display:grid;z-index:3200" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:820px;max-height:90vh;overflow:auto"><h3>📦 تعیین‌تکلیف خرید — ' + escP(item.nm || '') + '</h3><div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:9px 11px;font-size:12px;line-height:1.9">این مرحله فقط پیش‌نمایش است و هیچ بدهی تأمین‌کننده، فاکتور، موجودی یا سند مالی را تغییر نمی‌دهد.</div><div style="margin:10px 0;font-size:13px">مقدار موردنیاز: <b>' + (+item.qty || 1) + ' ' + escP(item.un || '') + '</b> | مقدار خریدشده: <b>' + purchased + ' ' + escP(item.un || '') + '</b> | قابل تعیین‌تکلیف: <b>' + purchased + ' ' + escP(item.un || '') + '</b></div><div class="tb2"><table><thead><tr><th>تأمین‌کننده</th><th>مقدار</th><th>قیمت واحد</th><th>وضعیت</th><th>قابل تعیین‌تکلیف</th><th>عملیات</th></tr></thead><tbody>' + rows + '</tbody></table></div><div style="text-align:left;margin-top:12px"><button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">بستن</button></div></div></div>';
    (document.getElementById('panels') || document.body).insertAdjacentHTML('beforeend', html);
  };

  function cmpSplitSuppliers() {
    return getData('ptf_crm_suppliers').map(function (s) { return s.co || s.name || s.cd; }).filter(Boolean);
  }
  function cmpSplitMoney(v, cur) { return (+v || 0).toLocaleString('en-US') + ' ' + (cur || 'ریال'); }
  function cmpSplitIrr(r) { return r.cur === 'IRR' ? (+r.qty || 0) * (+r.price || 0) : (+r.qty || 0) * (+r.price || 0) * (+r.rate || 0); }
  function cmpSplitNumber(v) { return String(v == null ? '' : v).replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); }).replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); }).replace(/,/g, ''); }
  window.cmpSplitNumber = cmpSplitNumber;
  /* UR-2026-08-01-06: همگام‌سازی انتخاب پیکر تامین‌کننده با سلکت «منبع قیمت» و فیلد «ورود دستی» در ptfDialog ثبت خرید */
  window.cmpBuySupPick = function (name) {
    var sel = null, manualInput = null;
    try {
      document.querySelectorAll('.ptfdlg select').forEach(function (s) {
        if (sel) return;
        for (var i = 0; i < s.options.length; i++) { if (s.options[i].value === '__manual__') { sel = s; break; } }
      });
      document.querySelectorAll('.ptfdlg input[type=text]').forEach(function (inp) {
        if (!manualInput && String(inp.placeholder || '').indexOf('ورود دستی') > -1) manualInput = inp;
      });
    } catch (e) { return; }
    var found = false;
    if (sel) {
      for (var j = 0; j < sel.options.length; j++) { if (sel.options[j].value === name) { sel.value = name; found = true; break; } }
      if (!found) { sel.value = '__manual__'; if (manualInput) manualInput.value = name; }
    } else if (manualInput) { manualInput.value = name; }
  };
  function cmpSplitUpdateSummary() {
    var st = window._cmpSplitState; if (!st) return;
    var item = st.c.items[st.idx] || {};
    var qty = st.rows.reduce(function (s, r) { return s + (+r.qty || 0); }, 0);
    var total = st.rows.reduce(function (s, r) { return s + cmpSplitIrr(r); }, 0);
    var sum = document.getElementById('cmpSplitSummary');
    if (sum) sum.innerHTML = 'نیاز: <b>' + (+item.qty || 1) + ' ' + escP(item.un || '') + '</b> | تخصیص: <b>' + qty + ' ' + escP(item.un || '') + '</b> | جمع کل (اطلاعاتی): <b>' + cmpSplitMoney(total) + '</b>';
  }
  window.cmpSplitRender = function () {
    var st = window._cmpSplitState; if (!st) return;
    var item = st.c.items[st.idx] || {}, sups = cmpSplitSuppliers();
    var rows = st.rows.map(function (r, ri) {
      var opts = '<option value="">— تامین‌کننده —</option>' + sups.map(function (s) { return '<option value="' + escP(s) + '"' + (r.sup === s ? ' selected' : '') + '>' + escP(s) + '</option>'; }).join('');
      var curOpts = '<option value="IRR"' + (r.cur === 'IRR' ? ' selected' : '') + '>ریال</option><option value="USD"' + (r.cur === 'USD' ? ' selected' : '') + '>دلار</option><option value="EUR"' + (r.cur === 'EUR' ? ' selected' : '') + '>یورو</option><option value="CNY"' + (r.cur === 'CNY' ? ' selected' : '') + '>یوان</option>';
      var total = (+r.qty || 0) * (+r.price || 0), totalIrr = cmpSplitIrr(r);
      var supField = typeof window.ptfSupPickerHtml === 'function'
        ? window.ptfSupPickerHtml('cmpSplitSup' + ri, r.sup || '', "cmpSplitField(" + ri + ",'sup',name)")
        : '<select onchange="cmpSplitField(' + ri + ',\'sup\',this.value)">' + opts + '</select>';
      return '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:8px;margin:6px 0"><div style="display:grid;grid-template-columns:1.25fr .6fr .9fr .65fr .9fr auto;gap:6px;align-items:end"><label class="fld" style="margin:0"><span>تامین‌کننده</span>' + supField + '</label><label class="fld" style="margin:0"><span>مقدار</span><input type="text" inputmode="decimal" value="' + escP(r.qty) + '" oninput="cmpSplitField(' + ri + ',\'qty\',this.value)" onblur="this.value=cmpSplitNumber(this.value)"></label><label class="fld" style="margin:0"><span>قیمت واحد</span><input type="text" inputmode="decimal" value="' + escP(r.price) + '" oninput="cmpSplitField(' + ri + ',\'price\',this.value)" onblur="this.value=Number(cmpSplitNumber(this.value)||0).toLocaleString(\"en-US\")"></label><label class="fld" style="margin:0"><span>ارز</span><select onchange="cmpSplitField(' + ri + ',\'cur\',this.value)">' + curOpts + '</select></label><label class="fld" style="margin:0"><span>نرخ تسعیر</span><input type="text" inputmode="decimal" value="' + escP(r.rate || '') + '" oninput="cmpSplitField(' + ri + ',\'rate\',this.value)" onblur="this.value=Number(cmpSplitNumber(this.value)||0).toLocaleString(\"en-US\")"></label><button type="button" class="bt bt-o" style="padding:5px 8px;color:#dc2626" onclick="cmpSplitRemove(' + ri + ')">✕</button></div><div style="font-size:11.5px;color:#0e7490;margin-top:6px">مبلغ lot: <b>' + cmpSplitMoney(total, r.cur === 'IRR' ? 'ریال' : r.cur) + '</b>' + (r.cur !== 'IRR' ? ' | معادل ریالی: ' + cmpSplitMoney(totalIrr, 'ریال') : '') + '</div></div>';
    }).join('');
    var qty = st.rows.reduce(function (s, r) { return s + (+r.qty || 0); }, 0);
    var total = st.rows.reduce(function (s, r) { return s + cmpSplitIrr(r); }, 0);
    var el = document.getElementById('cmpSplitRows'); if (el) el.innerHTML = rows;
    var sum = document.getElementById('cmpSplitSummary'); if (sum) sum.innerHTML = 'نیاز: <b>' + (+item.qty || 1) + ' ' + escP(item.un || '') + '</b> | تخصیص: <b>' + qty + ' ' + escP(item.un || '') + '</b> | جمع کل (اطلاعاتی): <b>' + cmpSplitMoney(total) + '</b>';
  };
  window.cmpSplitField = function (ri, key, value) { if (window._cmpSplitState && window._cmpSplitState.rows[ri]) { window._cmpSplitState.rows[ri][key] = (key === 'sup' || key === 'cur') ? value : (+cmpSplitNumber(value) || 0); cmpSplitUpdateSummary(); } };
  window.cmpSplitAdd = function () { if (window._cmpSplitState) { window._cmpSplitState.rows.push({ sup: '', qty: 0, price: 0, cur: 'IRR', rate: 0 }); cmpSplitRender(); } };
  window.cmpSplitRemove = function (ri) { if (window._cmpSplitState && window._cmpSplitState.rows.length > 1) { window._cmpSplitState.rows.splice(ri, 1); cmpSplitRender(); } };
  window.cmpSplitOpen = function (id, idx) {
    var c = cmpAll().filter(function (x) { return x.id === id; })[0]; if (!c) return;
    var item = c.items[idx] || {}, lots = ptfPurchaseLotsForItem(c, idx);
    window._cmpSplitState = { id: id, idx: idx, c: c, rows: lots.length ? lots.map(function (l) { return { sup: l.supplier, qty: l.qty, price: l.price, cur: l.currency || 'IRR', rate: l.rate || 0 }; }) : [{ sup: '', qty: +item.qty || 1, price: 0, cur: 'IRR', rate: 0 }] };
    var html = '<div class="md-b" id="cmpSplitDlg" style="display:grid;z-index:3100" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:760px;max-height:92vh;overflow:auto"><h3>🔀 تقسیم خرید — ' + escP(item.nm || '') + '</h3><div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:8px 10px;font-size:12px">قیمت واحد هر lot را وارد کنید؛ مبلغ کل فقط توسط سیستم محاسبه می‌شود.</div><div id="cmpSplitSummary" style="margin:9px 0;font-size:12px;color:#0e7490"></div><div id="cmpSplitRows"></div><div style="display:flex;gap:7px;justify-content:flex-end;margin-top:9px"><button class="bt bt-o" onclick="cmpSplitAdd()">+ lot دیگر</button><button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">انصراف</button><button class="bt" onclick="cmpSplitSave()">ذخیره تقسیم خرید</button></div></div></div>';
    (document.getElementById('panels') || document.body).insertAdjacentHTML('beforeend', html); cmpSplitRender();
  };
  window.cmpSplitSave = function () {
    var st = window._cmpSplitState; if (!st) return;
    var item = st.c.items[st.idx] || {}, required = +item.qty || 1, qty = 0;
    st.rows.forEach(function (r) { qty += +r.qty || 0; });
    if (qty <= 0 || qty > required) { alert('مجموع مقدار lotها باید بیشتر از صفر و حداکثر ' + required + ' باشد.'); return; }
    if (st.rows.some(function (r) { return !String(r.sup || '').trim() || !(+r.qty > 0) || !(+r.price > 0) || (r.cur !== 'IRR' && !(+r.rate > 0)); })) { alert('تامین‌کننده، مقدار و قیمت واحد الزامی است؛ برای ارز خارجی نرخ تسعیر نیز لازم است.'); return; }
    var list = cmpAll(), c = list.filter(function (x) { return x.id === st.id; })[0]; if (!c) return;
    c.purchases = (c.purchases || []).filter(function (p) { return +p.idx !== +st.idx; });
    st.rows.forEach(function (r) { var priceFx = r.cur === 'IRR' ? 0 : +r.price, buyPrice = r.cur === 'IRR' ? +r.price : Math.round(+r.price * (+r.rate || 0)); c.purchases.push({ cd: genCode('PUR'), idx: st.idx, qty: +r.qty, sourceItemKey: item.sourceItemKey || '', sup: String(r.sup).trim(), price: buyPrice, cur: 'IRR', srcCur: r.cur !== 'IRR' ? r.cur : '', priceFx: priceFx, rate: r.cur !== 'IRR' ? (+r.rate || 0) : 0, pay: 'cash', t: faDate(), by: curSession().name, splitLot: true, files: [] }); });
    cmpSave(list); try { audit('قیمت خرید', 'تقسیم خرید قلم ' + (item.nm || '') + ' بین ' + st.rows.length + ' تامین‌کننده', c.inqNo); } catch (e) {}
    var dlg = document.getElementById('cmpSplitDlg'); if (dlg) dlg.remove();
    var baseDlg = document.getElementById('cmpModal_' + c.id); if (baseDlg) baseDlg.remove();
    window._cmpSplitState = null;
    cmpOpen(c.id, { realbuy: true });
  };

  /* ---------- انتخاب تامین‌کننده خرید نهایی per آیتم ---------- */
  window.cmpBuy = function (id, idx) {
    if (!canBuy()) { alert('⛔ دسترسی ندارید'); return; }
    var c = cmpAll().filter(function (x) { return x.id === id; })[0];
    if (!c) return;
    var realbuy = !!window._cmpRealbuyMode; /* v17.2 US-412: مسیر پرونده فروش */
    var qs = (c.quotes || []).filter(function (q) { return q.idx === idx; });
    // آخرین قیمت هر تامین‌کننده (دور۱/۲ جدول مقایسه)
    var last = {};
    qs.forEach(function (q) { if (!last[q.sup] || q.round >= last[q.sup].round) last[q.sup] = q; });
    /* v17.2 (US-412): منابع استعلامی تکمیلی — قیمت‌های ثبت‌شده در سامانه استعلام تامین (rfqsmart)
       per همین قلم (تطبیق نرمال نام) + ارز استعلام (quoteCur) برای تسعیر */
    var it = c.items[idx];
    var _nrm = function (x) { return (typeof dedupNorm === 'function') ? dedupNorm(x) : String(x || '').trim().toLowerCase(); };
    var rqsQuotes = []; /* {sup, price, cur, src} */
    try {
      getData('ptf_crm_rfqsmart').forEach(function (r2) {
        if (!r2.srcRfq || (r2.srcRfq !== c.inqNo && _nrm(r2.srcRfq) !== _nrm(c.inqNo))) return;
        var qCur = r2.quoteCur || 'IRR';
        (r2.items || []).forEach(function (ri) {
          if (_nrm(ri.name || ri.nm) !== _nrm(it.nm)) return;
          Object.keys(ri.quotes || {}).forEach(function (supCd) {
            var p = +ri.quotes[supCd] || 0;
            if (p <= 0) return;
            var supRec = getData('ptf_crm_suppliers').filter(function (s2) { return s2.cd === supCd; })[0];
            rqsQuotes.push({ sup: (supRec ? supRec.co : supCd), price: p, cur: qCur, src: r2.no });
          });
        });
      });
    } catch (eRQ) {}
    if (!qs.length && !rqsQuotes.length && !realbuy) { alert('برای این آیتم هنوز قیمتی ثبت نشده'); return; }
    var best = null;
    Object.keys(last).forEach(function (s) { if (best === null || +last[s].price < +last[best].price) best = s; });
    var opts = Object.keys(last).map(function (s) {
      return '<option value="' + escP(s) + '" data-cur="IRR"' + (s === best ? ' selected' : '') + '>' + escP(s) + ' — ' + fmtP(last[s].price) + ' ریال (دور' + last[s].round + ')' + (s === best ? ' ✅ کمترین' : '') + '</option>';
    }).join('');
    /* گزینه‌های استعلام تامین (ارز-دار) + ورود دستی */
    rqsQuotes.forEach(function (rq) {
      opts += '<option value="' + escP(rq.sup) + '" data-price="' + rq.price + '" data-cur="' + escP(rq.cur) + '">' + escP(rq.sup) + ' — ' + rq.price.toLocaleString('en-US') + ' ' + escP(rq.cur) + ' (استعلام ' + escP(rq.src) + ')</option>';
    });
    if (realbuy) {
      var existingSupNames = {};
      Object.keys(last).forEach(function (s) { existingSupNames[String(s)] = true; });
      rqsQuotes.forEach(function (rq) { existingSupNames[String(rq.sup)] = true; });
      getData('ptf_crm_suppliers').forEach(function (s) {
        var supName = String(s.co || s.name || '').trim();
        if (!supName || existingSupNames[supName]) return;
        existingSupNames[supName] = true;
        opts += '<option value="' + escP(supName) + '" data-cur="IRR">' + escP(supName) + ' — تامین‌کننده ثبت‌شده</option>';
      });
    }
    opts += '<option value="__manual__">✍️ ورود دستی (تامین‌کننده/قیمت دلخواه)</option>';
    /* v17.2 (US-412): پیشنهاد نرخ زنده برای تسعیر (فقط راهنما — تصمیم با کاربر) */
    var fxHint = '';
    try {
      var L = window._ptfFxLive && window._ptfFxLive.rates;
      if (L) fxHint = ' | نرخ زنده: دلار آزاد ' + (L.usd_free || 0).toLocaleString('fa-IR') + ' — یورو آزاد ' + (L.eur_free || 0).toLocaleString('fa-IR');
    } catch (eH) {}
    ptfDialog({
      title: '🛍 ثبت خرید واقعی: ' + (it ? it.nm : ''),
      body: '<b style="color:#b45309">⚠️ قیمت واحد فقط همین قلم را وارد کنید — نه جمع کل اقلام (BUG-032).</b> برای ثبت همه اقلام یکجا از «🛒 ثبت گروهی خرید» استفاده کنید.<br>' + (realbuy ? '💡 منبع قیمت: از استعلامی‌های موجود انتخاب کنید یا «ورود دستی». خرید ارزی حتما نرخ تسعیر می‌خواهد — همه محاسبات سود به ریال است (US-412).' : 'سیستم کمترین قیمت را پیش‌فرض انتخاب کرده — در صورت صلاحدید تغییر دهید.') + fxHint +
        '<div class="fld" style="margin:8px 0 4px"><label>🔍 جستجوی تامین‌کننده (نام یا برند)</label>' + (typeof window.ptfSupPickerHtml === 'function' ? window.ptfSupPickerHtml('cmpBuySupPick', '', "cmpBuySupPick(name)") : '') + '</div>',
      fields: [
        { id: 'sup', label: 'منبع قیمت / تامین‌کننده', type: 'select', optionsHtml: opts },
        { id: 'supName', label: 'نام تامین‌کننده (فقط برای ورود دستی)', type: 'text' },
        { id: 'price', label: 'قیمت خرید نهایی واحد — قابل اصلاح', type: 'number', value: best ? last[best].price : 0, dir: 'ltr' },
        /* v16.0 (US-390 — نظام سود چندارزی): خرید یا ریالی است یا با ارز آزاد */
        { id: 'cur', label: 'ارز خرید', type: 'select', optionsHtml: '<option value="IRR" selected>ریال (IRR)</option><option value="EUR">یورو (EUR)</option><option value="USD">دلار (USD)</option>' },
        { id: 'rate', label: 'نرخ تسعیر (ریال per واحد ارز) — برای خرید ارزی الزامی', type: 'number', dir: 'ltr' },
        /* v18.7 US-430: تاریخ تعهد تحویل تامین‌کننده — ورودی امتیازدهی کیفیت تحویل */
        { id: 'dueISO', label: 'تاریخ تحویل تعهدشده تامین‌کننده (میلادی/اختیاری)', type: 'date', dir: 'ltr' },
        { id: 'dueNote', label: 'یادداشت تعهد تحویل تامین‌کننده (اختیاری)', type: 'text' },
        /* v16.6 (US-400 — ابلاغ کارفرما): نحوه پرداخت — نقدی=تسویه همان لحظه؛ غیرنقدی=بستانکاری تامین‌کننده باز می‌ماند */
        { id: 'pay', label: 'نحوه پرداخت به تامین‌کننده', type: 'select', optionsHtml: '<option value="cash" selected>💵 نقدی (همین لحظه تسویه می‌شود)</option><option value="credit">🧾 غیرنقدی / اعتباری (بستانکاری باز — پرداخت مرحله‌ای)</option>' }
      ],
      okText: 'ثبت خرید',
      onOk: function (v) {
        var list = cmpAll();
        var c2 = list.filter(function (x) { return x.id === id; })[0];
        if (!c2) return;
        /* v17.2 (US-412): حل منبع قیمت — دستی / استعلام تامین (ارزدار) / دور۱-۲ */
        var supName = v.sup;
        var srcPrice = null, srcCur = null;
        if (v.sup === '__manual__') {
          supName = String(v.supName || '').trim();
          if (!supName) { alert('⛔ برای ورود دستی، نام تامین‌کننده الزامی است'); return; }
        } else {
          var rqSel = rqsQuotes.filter(function (rq) { return rq.sup === v.sup; })[0];
          if (rqSel) { srcPrice = rqSel.price; srcCur = rqSel.cur; }
        }
        var buyCur = v.cur || 'IRR';
        var buyPrice = +v.price || (last[v.sup] ? +last[v.sup].price : 0);
        /* اگر گزینه استعلام تامین ارزی انتخاب شده و کاربر قیمت/ارز را دست نزده → همان مبنا */
        if (srcPrice !== null && (!+v.price || +v.price === (best ? +last[best].price : 0))) buyPrice = srcPrice;
        if (srcCur && srcCur !== 'IRR' && buyCur === 'IRR') buyCur = srcCur;
        if (!buyPrice) { alert('⛔ قیمت خرید معتبر نیست'); return; }
        var buyRate = +v.rate || 0;
        /* v17.2 (US-412 — کیس استادی): تسعیر ارزی الزامی — معادل ریالی مبنای قطعی سود */
        var priceFx = 0;
        if (buyCur !== 'IRR') {
          if (!buyRate) { alert('⛔ خرید ارزی (' + buyCur + ') بدون «نرخ تسعیر» ثبت نمی‌شود (US-412).\nنرخ توافقی/روز را وارد کنید' + (fxHint ? ' —' + fxHint : '') + '.'); return; }
          priceFx = buyPrice;
          buyPrice = Math.round(priceFx * buyRate); /* معادل ریالی = قیمت خرید واقعی */
        }
        c2.purchases = (c2.purchases || []).filter(function (p) { return p.idx !== idx; });
        var pcd = genCode('PUR');
        var srcItem = (c2.items || [])[idx] || {};
        c2.purchases.push({ cd: pcd, idx: idx, sourcePcode: srcItem.pcode || srcItem.prodCd || '', sourceItemKey: srcItem.sourceItemKey || (typeof window.ptfProcLineKey === 'function' ? window.ptfProcLineKey(srcItem) : ''), sup: supName, price: buyPrice, cur: 'IRR', srcCur: buyCur !== 'IRR' ? buyCur : '', priceFx: priceFx, rate: buyCur !== 'IRR' ? buyRate : 0, pay: v.pay || 'cash', dueISO: v.dueISO || '', dueNote: v.dueNote || '', manual: v.sup === '__manual__', t: faDate(), by: curSession().name, files: [] });
        cmpSave(list);
        /* v18.9 BUG-029: هر خرید واقعی موفق باید وضعیت درخواست را به «در حال تامین» ببرد؛ مستقل از باز بودن حالت realbuy */
        if (typeof ptfRealBuyEnsureStatus === 'function') ptfRealBuyEnsureStatus(c2.inqNo);
        /* v16.6 (US-400): ثبت بستانکاری تامین‌کننده — نقدی = تسویه فوری؛ غیرنقدی = باز تا ثبت پرداخت‌های مرحله‌ای
           v17.2: مبلغ = معادل ریالی قطعی (تسعیرشده) — بدهی ارزی بی‌نرخ دیگر پیش نمی‌آید */
        /* خرید واقعی فقط operational است؛ تعهد یا فاکتور تأمین‌کننده اینجا ساخته نمی‌شود. */
        // ثبت در buyquotes قدیمی هم برای گزارش‌های موجود
        var bq = getData('ptf_crm_buyquotes');
        bq.unshift({ cd: genCode('BQ'), ref: c2.inqNo, sup: supName, desc: (c2.items[idx] || {}).nm || '', price: buyPrice, note: 'خرید واقعی' + (priceFx ? ' (تسعیر ' + priceFx.toLocaleString('en-US') + ' ' + (c2.purchases[c2.purchases.length-1].srcCur || '') + ' × ' + buyRate.toLocaleString('fa-IR') + ')' : ''), t: faDate(), by: curSession().name });
        setData('ptf_crm_buyquotes', bq);
        audit('قیمت خرید', 'خرید واقعی آیتم «' + ((c2.items[idx] || {}).nm || '') + '» از ' + supName + ' — ' + fmtP(buyPrice) + ' ریال' + (priceFx ? ' (تسعیرشده)' : ''), c2.inqNo);
        notify({ toRoles: SENIOR_ROLES, title: '🛍 خرید واقعی: ' + ((c2.items[idx] || {}).nm || '') + ' از ' + supName + ' (' + fmtP(buyPrice) + ' ریال' + (priceFx ? ' — تسعیرشده' : '') + ')' + (v.dueISO ? ' — تعهد تحویل: ' + v.dueISO : ''), kind: 'buyq', channels: ['cart'], link: { panel: 'deals' } });
        var wasRealbuy = window._cmpRealbuyMode;
        var oldCmp = document.getElementById('cmpModal_' + id); if (oldCmp) oldCmp.remove(); /* v18.6: فقط ماتریس خرید بازسازی می‌شود؛ پرونده فروش/استعلام تامین بسته نمی‌شود */
        renderBuyQuotes();
        cmpOpen(id, wasRealbuy ? { realbuy: true } : undefined); /* v17.2: حالت قفل حفظ شود */
        if (wasRealbuy) {
          setTimeout(function () { if (confirm('رسید پرداخت این خرید واقعی را پیوست می‌کنید؟')) ptfRealBuyReceiptUpload(id, idx, pcd); }, 80);
          setTimeout(function () { if (confirm('هزینه مستقیم دیگری برای این پرونده ثبت می‌کنید؟ (حمل، گمرک، ترخیص، بازرسی و...)')) ptfProjectCostOpen(c2.inqNo); }, 180);
        }
      }
    });
  };

  /* ===================================================================
     v16.3 (US-392 — تایید کارفرما از بک‌لاگ R4): جریان «خرید واقعی» پس از برد
     - ptfRealBuyOpen(inqNo): جدول مقایسه موجود را باز می‌کند؛ نبود → خودکار از اقلام
       CO برنده (یا اقلام درخواست) می‌سازد — کاربر هیچ‌وقت به بن‌بست «ماژول مخفی» نمی‌خورد
     - بخش «🛒 خرید واقعی اقلام» روی کشوی پرونده فروش (hook sfDrawerHtml — بدون دست زدن به salesfiles)
     - واژگان شفاف: «قیمت استعلامی (کشف قیمت)» جدا از «خرید واقعی»
     =================================================================== */
  window.ptfRealBuyOpen = function (inqNo) {
    if (!inqNo) { alert('شماره درخواست نامشخص است'); return; }
    var list = cmpAll();
    var c = mergeCmpRecordsForInquiry(inqNo) || list.filter(function (x) { return x.inqNo === inqNo; })[0];
    if (!c) {
      /* ساخت خودکار جدول از اقلام CO برنده؛ نبود → اقلام درخواست */
      var items = [];
      var co = getData('ptf_crm_offers').filter(function (o) { return (o.kind === 'CO' || o.kind === 'TC') && o.inqNo === inqNo && o.st === 'won'; })[0]
            || getData('ptf_crm_offers').filter(function (o) { return (o.kind === 'CO' || o.kind === 'TC') && o.inqNo === inqNo; })[0];
      if (co && (co.items || []).length) {
        items = co.items.filter(function (it) { return it.name || it.desc; }).map(function (it) {
          return { nm: it.name || it.desc || '', qty: +it.qty || 1, un: it.unit || 'عدد', pcode: it.pcode || it.prodCd || '', spec: it.spec || it.desc || '', model: it.model || '', sourceOfferNo: co.no, sourceItemKey: typeof window.ptfProcLineKey === 'function' ? window.ptfProcLineKey(it) : '' };
        });
      }
      if (!items.length) {
        getData('ptf_crm_inqitems').forEach(function (r) {
          if (r.inqNo === inqNo && r.nm) items.push({ nm: r.nm, qty: +r.qty || 1, un: r.un || 'عدد', pcode: r.pcode || r.prodCd || '', spec: r.st || '', model: r.model || r.md || '', sourceItemKey: typeof window.ptfProcLineKey === 'function' ? window.ptfProcLineKey(r) : '' });
        });
      }
      if (!items.length) { alert('برای این درخواست نه CO دارای اقلام هست و نه اقلام درخواست — ابتدا اقلام را ثبت کنید.'); return; }
      c = { id: genCode('CMP'), inqNo: inqNo, sourceOfferNo: co ? co.no : '', items: items, quotes: [], purchases: [], t: faDate(), by: curSession().name, src: 'auto-realbuy' };
      list.unshift(c);
      cmpSave(list);
      audit('قیمت خرید', 'ساخت خودکار جدول خرید واقعی برای ' + inqNo + ' (US-392)', c.id);
    }
    var complete = mergeCmpRecordsForInquiry(inqNo);
    if (complete) c = complete;
    cmpOpen(c.id, { realbuy: true }); /* v17.2 (US-412): مسیر پرونده فروش = نمای قفل‌شده */
  };

  /* v17.2 (US-412): استعلام جدید از داخل پرونده — فقط از درگاه سامانه استعلام تامین */
  window.ptfRealBuyNewInquiry = function (inqNo) {
    document.querySelectorAll('[id^="cmpModal_"]').forEach(function (m) { m.remove(); });
    if (typeof goPanelByName === 'function') goPanelByName('rfqs');
    setTimeout(function () {
      /* اگر استعلامی برای همین درخواست هست → کارت رهگیری؛ وگرنه ویزارد جدید */
      var q = getData('ptf_crm_rfqsmart').filter(function (x) { return x.srcRfq === inqNo; })[0];
      if (q && typeof rfqsOpen === 'function') rfqsOpen(q.no);
      else if (typeof rfqsNew === 'function') { rfqsNew(); if (typeof ptfToast === 'function') ptfToast('🤖 استعلام جدید — درخواست «' + inqNo + '» را در گام مبدا انتخاب کنید', 'info'); }
    }, 350);
  };

  /* وضعیت خرید واقعی یک درخواست: {total, done, pendingFx} — مصرف: پرونده فروش */
  window.ptfRealBuyStatus = function (inqNo) {
    var records = cmpAll().filter(function (x) { return x.inqNo === inqNo; });
    if (!records.length) return { total: 0, done: 0, pendingFx: 0, has: false };
    var total = 0, done = 0, full = 0, partial = 0, pendingFx = 0;
    records.forEach(function (c) {
      (c.items || []).forEach(function (it, idx) {
        total++;
        var requiredQty = +it.qty || 1;
        var lots = window.ptfPurchaseLotsForItem(c, idx);
        var purchasedQty = lots.reduce(function (sum, lot) { return sum + (+lot.qty || 0); }, 0);
        if (purchasedQty > 0) done++;
        if (purchasedQty >= requiredQty) full++;
        else if (purchasedQty > 0) partial++;
        lots.forEach(function (lot) {
          if (lot.currency && lot.currency !== 'IRR') {
            var raw = (c.purchases || []).filter(function (p) { return p.cd === lot.cd; })[0] || {};
            if (!(+raw.rate > 0)) pendingFx++;
          }
        });
      });
    });
    return { total: total, done: done, full: full, partial: partial, pendingFx: pendingFx, has: true };
  };

  /* hook روی renderDeals: بخش خرید واقعی در کشوی پرونده‌های دارای CO برنده */
  function patchDealsRealBuy() {
    if (window._rbDealsHooked || typeof window.renderDeals !== 'function') return false;
    window._rbDealsHooked = true;
    var _rd = window.renderDeals;
    window.renderDeals = function () {
      _rd();
      try {
        var wrap = document.getElementById('dealWrap');
        if (!wrap || !window._sfOpen) return;
        var deal = getData('ptf_crm_deals').filter(function (x) { return x.cd === window._sfOpen; })[0];
        if (!deal || !deal.inqNo || !deal.wonOffer) return; /* فقط پرونده‌های برنده */
        var host = wrap.querySelector('[id="sfUp_' + deal.cd + '"]');
        if (!host || document.getElementById('rbBox_' + deal.cd) || document.getElementById('sfRealBuyBtn_' + deal.cd)) return;
        var st = ptfRealBuyStatus(deal.inqNo);
        var adv = ''; try { var wo = getData('ptf_crm_offers').filter(function(o){return o.no===deal.wonOffer;})[0]; if (wo && typeof ptfAdvanceLabel === 'function') adv = ' | پیش‌پرداخت: ' + ptfAdvanceLabel(wo); } catch(eAdv) {}
        var costs = (deal.costEvents || []).reduce(function(s,x){return s+(+x.amt||0);},0);
        var costTxt = costs ? ' | هزینه‌های مستقیم: ' + costs.toLocaleString('fa-IR') + ' ریال' : '';
        var lb = !st.has || !st.done
          ? '<span style="color:#b45309">هنوز خریدی ثبت نشده</span>'
          : st.full + ' از ' + st.total + ' قلم کامل' + (st.partial ? ' — ' + st.partial + ' قلم ناقص' : '') + (st.pendingFx ? ' — <span style="color:#dc2626">' + st.pendingFx + ' خرید ارزی بدون نرخ ⚠️</span>' : ' ✅');
        host.closest('div').insertAdjacentHTML('beforebegin',
          '<div id="rbBox_' + escP(deal.cd) + '" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:8px 12px;margin-top:8px;display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;font-size:12.5px">' +
          '<span>🛒 <b>خرید واقعی اقلام</b> <small style="color:#64748b">(پس از برد — مبنای سود واقعی؛ جدا از قیمت استعلامی)</small><br><small>' + lb + adv + costTxt + '</small></span>' +
          '<span style="display:flex;gap:6px;flex-wrap:wrap"><button class="bt" style="font-size:12px;background:#059669" onclick="event.stopPropagation();ptfRealBuyOpen(\'' + escP(deal.inqNo) + '\')">🛍 ثبت / مشاهده / اصلاح خرید</button>' +
          ((deal.wonOffer && typeof ptfAdvanceOpen === 'function') ? '<button class="bt bt-o" style="font-size:12px;color:#0e7490" onclick="event.stopPropagation();ptfAdvanceOpen(\'' + escP(deal.wonOffer) + '\')">💰 اصلاح پیش‌پرداخت</button>' : '') +
          '<button class="bt bt-o" style="font-size:12px;color:#7c3aed" onclick="event.stopPropagation();ptfRealBuyNewInquiry(\'' + escP(deal.inqNo) + '\')">🤖 استعلام مجدد</button><button class="bt bt-o" style="font-size:12px;color:#b45309" onclick="event.stopPropagation();ptfProjectCostOpen(\'' + escP(deal.inqNo) + '\')">➕ هزینه پرونده</button></span></div>');
      } catch (e) {}
    };
    return true;
  }
  var rbT = 0;
  var rbI = setInterval(function () { rbT++; if (patchDealsRealBuy() || rbT > 50) clearInterval(rbI); }, 400);

  /* ============ US-187: ادغام تامین‌کننده سایت با رکورد موجود ============ */
  /* جایگزین supApprove قبلی: اگر dedup تشخیص تکرار داد، به جای رد/ثبت کورکورانه،
     دیالوگ «ادغام یا ثبت جدید» با نمایش رکورد قبلی. ادغام: فیلدهای غیرتکراری
     (ایمیل/برند/تلفن جدید/دسته) روی رکورد موجود تکمیل می‌شود. */
  function patchSupApprove() {
    var _approve = window.supApprove;
    if (typeof _approve !== 'function') return false;
    window.supApprove = function (code) {
      var s = (JSON.parse(localStorage.getItem('ptf_site_suppliers') || '[]')).filter(function (x) { return x.code === code; })[0];
      if (!s) { _approve(code); return; }
      var recTest = { co: s.company, ph: s.phone, people: [], coTels: [] };
      var dups = (typeof ptfCheckDup === 'function') ? ptfCheckDup('supplier', recTest, null) : [];
      if (!dups.length) { _approve(code); return; }
      // US-187: تکراری → دیالوگ ادغام
      var exist = getData('ptf_crm_suppliers').filter(function (x) { return x.cd === dups[0].cd; })[0];
      if (!exist) { _approve(code); return; }
      var html = '<div class="md-b" style="display:grid;z-index:70" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:520px">' +
        '<h3>🔗 تامین‌کننده تکراری تشخیص داده شد</h3>' +
        '<div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:10px;padding:9px 12px;font-size:12.5px;color:#92400e;margin-bottom:10px">' +
        'این تامین‌کننده قبلاً' + dups[0].who + ' در سیستم ثبت شده است:<br>' +
        '<b>' + escP(exist.co) + '</b> (' + escP(exist.cd) + ')' + '</div>' +
        '<div style="font-size:12px;line-height:2.1;margin-bottom:10px">' +
        '<b>ثبت‌نام جدید سایت:</b> ' + escP(s.company) + ' — ' + escP(s.name || '') + ' — <span dir="ltr">' + escP(s.phone || '') + '</span>' +
        (s.email ? ' — ' + escP(s.email) : '') + (s.brands ? '<br>برندها: ' + escP(s.brands) : '') + '</div>' +
        '<div style="font-size:12px;color:#0c4a6e;background:#f0f9ff;border-radius:10px;padding:8px 12px;margin-bottom:12px">با «ادغام»، اطلاعات غیرتکراری (ایمیل، برند، تلفن جدید، دسته) به رکورد موجود اضافه می‌شود و به ثبت‌کننده سایت پیام تایید می‌رود. رکورد تکراری جدید ساخته نمی‌شود.</div>' +
        '<div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap">' +
        '<button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">انصراف</button>' +
        '<button class="bt bt-o" style="color:#7c3aed" onclick="supMergeForce(\'' + escP(code) + '\')">ثبت به‌عنوان رکورد جدید</button>' +
        '<button class="bt" style="background:#059669" onclick="supMergeDo(\'' + escP(code) + '\',\'' + escP(exist.cd) + '\')">🔗 ادغام و تایید</button></div></div></div>';
      document.getElementById('panels').insertAdjacentHTML('beforeend', html);
    };
    window.supMergeForce = function (code) {
      document.querySelectorAll('.md-b').forEach(function (m) { if ((m.style || {}).display !== 'none') m.remove(); }); /* v16.2 BUG-017: مینیمایزها محفوظ */
      _approve(code); // مسیر قبلی (با confirm هشدار v81)
    };
    window.supMergeDo = function (code, existCd) {
      var s = (JSON.parse(localStorage.getItem('ptf_site_suppliers') || '[]')).filter(function (x) { return x.code === code; })[0];
      if (!s) return;
      var items = getData('ptf_crm_suppliers');
      var e = items.filter(function (x) { return x.cd === existCd; })[0];
      if (!e) return;
      var merged = [];
      // فیلدهای غیرتکراری تکمیل شوند
      if (s.email && !e.email) { e.email = s.email; merged.push('ایمیل'); }
      if (s.brands && !e.brands) { e.brands = s.brands; merged.push('برندها'); }
      if (s.category && !e.ca) { e.ca = s.category; merged.push('دسته'); }
      var newPh = String(s.phone || '').trim();
      if (newPh) {
        var phones = (typeof dedupPhones === 'function') ? dedupPhones(e) : [];
        var norm = (typeof dedupNormPhone === 'function') ? dedupNormPhone(newPh) : newPh;
        if (phones.indexOf(norm) < 0) {
          e.phones = e.phones || [];
          e.phones.push({ k: 'mob', n: newPh, lb: 'ثبت سایت' });
          if (!e.ph) e.ph = newPh;
          merged.push('تلفن جدید');
        }
      }
      if (s.name && !e.nm) { e.nm = s.name; merged.push('نام رابط'); }
      e.siteCode = code;
      e.mergedAt = faDateTime();
      e.mergedBy = curSession().name;
      setData('ptf_crm_suppliers', items);
      // تایید سمت سرور برای رهگیری ثبت‌کننده سایت
      if (typeof api === 'function') {
        api('set_status', { type: 'supplier', code: code, status: 'approved', statusText: 'تایید شد — اطلاعات شما با پروفایل موجودتان ادغام گردید', by: curSession().name }, function () { if (typeof syncServerInbox === 'function') syncServerInbox(); });
      }
      audit('تامین‌کنندگان', 'ادغام ثبت‌نام سایت ' + code + ' با ' + existCd + (merged.length ? ' (' + merged.join('، ') + ')' : ''), existCd);
      if (typeof notify === 'function') notify({ toRoles: SENIOR_ROLES, title: '🔗 ثبت‌نام سایت «' + s.company + '» با رکورد موجود ادغام شد' + (merged.length ? ' — تکمیل: ' + merged.join('، ') : ''), kind: 'supplier_ok', channels: ['cart'], link: { panel: 'sup' } });
      document.querySelectorAll('.md-b').forEach(function (m) { if ((m.style || {}).display !== 'none') m.remove(); }); /* v16.2 BUG-017: مینیمایزها محفوظ */
      if (typeof renderSuppliers === 'function') renderSuppliers();
      if (typeof updateInboxBadge === 'function') updateInboxBadge();
      if (typeof ptfToast === 'function') ptfToast('✅ ادغام انجام شد' + (merged.length ? ' — تکمیل: ' + merged.join('، ') : ' — اطلاعات جدیدی نبود'), 'ok');
    };
    return true;
  }
  // bridge.js دیرتر supApprove را می‌سازد → تلاش تا موفق
  var tries = 0;
  var t = setInterval(function () {
    tries++;
    if (patchSupApprove() || tries > 40) clearInterval(t);
  }, 300);


  /* v18.6+: هزینه‌های مستقیم پرونده/بایگانی در سود پروژه کسر می‌شود؛ بدون تکرار موتور سود */
  function hookProjectCostsProfit() {
    if (window._costProfitHooked || typeof window.ptfProjectProfitIRR !== 'function') return false;
    window._costProfitHooked = true;
    var _orig = window.ptfProjectProfitIRR;
    window.ptfProjectProfitIRR = function (prj) {
      var r = _orig(prj);
      try {
        var d = null;
        if (prj && prj._kind === 'deal') d = prj;
        else d = rbFindDeal(prj && (prj.inqNo || prj.offerNo || prj.no));
        var dealCosts = (d && d.costEvents || []).reduce(function (s, x) { return s + (+x.amt || 0); }, 0);
        var archCosts = 0;
        if (prj && (prj.origin === 'salesfile' || prj.state === 'archived')) {
          archCosts += ((prj.costEvents || []).reduce(function (s, x) { return s + (+x.amt || 0); }, 0));
          archCosts += ((prj.postArchiveCosts || []).reduce(function (s, x) { return s + (+x.amt || 0); }, 0));
        }
        var costs = Math.max(dealCosts, archCosts);
        if (costs && r && r.profit != null) {
          r.projectCostIrr = costs;
          r.profit -= costs;
          if (r.sellIrr > 0) r.pct = Math.round(r.profit * 100 / r.sellIrr);
          r.warnings = r.warnings || [];
          r.warnings.push('➕ هزینه‌های مستقیم پرونده/بایگانی در سود کسر شد: ' + costs.toLocaleString('fa-IR') + ' ریال');
        }
      } catch (e) {}
      return r;
    };
    return true;
  }
  var cpT = 0; var cpI = setInterval(function(){ cpT++; if (hookProjectCostsProfit() || cpT > 80) clearInterval(cpI); }, 300);
  hookProjectCostsProfit();

})();
