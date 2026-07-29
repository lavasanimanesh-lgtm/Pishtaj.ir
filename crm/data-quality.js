/* PTF CRM — FIN-WF-015 / read-only financial data quality dashboard */
(function () {
  'use strict';
  function arr(k) { var v = getData(k); return Array.isArray(v) ? v : []; }
  function add(map, id, label, ref, amount) {
    if (!map[id]) map[id] = { id: id, label: label, count: 0, amount: 0, refs: [] };
    map[id].count++;
    map[id].amount += +amount || 0;
    if (ref && map[id].refs.length < 8) map[id].refs.push(String(ref));
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
    var q = {}, invoices = arr('ptf_crm_invoices'), payables = arr('ptf_crm_payables'), cheques = arr('ptf_crm_cheques');
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
      if (c.st === 'open' && !c.ownership) add(q, 'cheque-ownerless', 'چک باز با مالکیت نامشخص', c.sayad || c.no || c.cd, c.amt);
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
      try { ptfProcurementLinkAuditAll().forEach(function (x) { (x.issues || []).forEach(function (i) { add(q, 'procurement-ambiguous', 'قلم خرید/استعلام نیازمند تطبیق', (x.offer || {}).no || i.index, 0); }); }); } catch (e) {}
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

  window.ptfDataQualityHtml = function () {
    if (typeof curRole === 'function' && ['admin', 'chairman'].indexOf(curRole()) < 0) return '';
    var rows = window.ptfDataQualityData();
    var total = rows.reduce(function (s, x) { return s + x.count; }, 0);
    var body = rows.map(function (r) { return '<tr><td>' + escP(r.label) + '</td><td>' + r.count + '</td><td>' + (r.amount ? (+r.amount).toLocaleString('fa-IR') + ' ریال' : '—') + '</td><td dir="ltr">' + escP(r.refs.join(', ')) + '</td></tr>'; }).join('');
    return '<div id="qualityBox" style="display:none;background:var(--crd);border:1px solid var(--brd);border-radius:14px;padding:14px;margin-top:12px"><div style="display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap"><div><h4 style="margin:0">🧪 کیفیت دادهٔ مالی</h4><small style="color:#64748b">فقط‌خواندنی؛ این داشبورد هیچ رکوردی را اصلاح یا حذف نمی‌کند.</small></div><button class="bt bt-o" onclick="ptfDataQualityRender()">↻ بازخوانی</button></div><div style="margin:10px 0;background:' + (total ? '#fff7ed;border:1px solid #fed7aa;color:#9a3412' : '#ecfdf5;border:1px solid #bbf7d0;color:#065f46') + ';border-radius:10px;padding:8px 11px;font-size:12px">' + (total ? '⚠️ ' + total + ' مورد نیازمند بررسی' : '✅ مورد کیفیت داده‌ای شناسایی نشد') + '</div><div class="tb2"><table><thead><tr><th>نوع</th><th>تعداد</th><th>مبلغ</th><th>نمونه شناسه‌ها</th></tr></thead><tbody>' + (body || '<tr><td colspan="4">موردی نیست</td></tr>') + '</tbody></table></div></div>';
  };
  window.ptfDataQualityRender = function () { var el = document.getElementById('qualityBox'); if (el) { var html = window.ptfDataQualityHtml(); var tmp = document.createElement('div'); tmp.innerHTML = html; var next = tmp.firstElementChild; el.replaceWith(next); } };
})();
