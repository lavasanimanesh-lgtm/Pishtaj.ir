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
        var salesFileOffers = {};
        arr('ptf_crm_deals').concat(arr('ptf_crm_projects')).forEach(function (d) {
          [d.wonOffer, d.offerNo].filter(Boolean).forEach(function (no) { salesFileOffers[String(no)] = true; });
        });
        ptfProcurementLinkAuditAll().forEach(function (x) {
          if (!(x.issues || []).length) return;
          var offer = x.offer || {};
          if (!salesFileOffers[String(offer.no || '')]) return;
          var aliases = [offer.inqNo, offer.no].filter(Boolean);
          var payableIds = {};
          allPayablesForProc.forEach(function (p) { if (aliases.indexOf(p.inqNo) > -1 && p.cd) payableIds[p.cd] = true; });
          var relatedInvoices = (supplierDataForProc.invoices || []).filter(function (inv) {
            return (inv.legacyPayableCds || []).some(function (cd) { return payableIds[cd]; });
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
      if (d.type === 'opex' && typeof ptfOpexEdit === 'function') action = '<button type="button" class="bt bt-o" style="padding:3px 9px;font-size:11px;margin-top:7px" onclick="ptfOpexEdit(\'' + escP(d.cd) + '\')">✏️ اصلاح هزینه</button>';
      else if (d.type === 'supplier-invoice' && typeof slInvoiceEdit === 'function') action = '<button type="button" class="bt bt-o" style="padding:3px 9px;font-size:11px;margin-top:7px" onclick="slInvoiceEdit(\'' + escP(d.cd) + '\')">✏️ اصلاح فاکتور خرید</button>';
      else if (d.type === 'cheque' && typeof chEdit === 'function') action = '<button type="button" class="bt bt-o" style="padding:3px 9px;font-size:11px;margin-top:7px" onclick="chEdit(\'' + escP(d.cd) + '\')">✏️ اصلاح چک</button>';
      else if (d.type === 'procurement' && typeof ptfOpenProcurementLinkAudit === 'function') action = '<button type="button" class="bt bt-o" style="padding:3px 9px;font-size:11px;margin-top:7px" onclick="ptfOpenProcurementLinkAudit(\'' + escP(d.offerNo) + '\')">🔎 بررسی پیش‌فاکتور و اقلام</button>';
      var invoiceActions = d.type === 'procurement' && (d.relatedInvoices || []).length
        ? '<div style="margin-top:9px;padding-top:7px;border-top:1px solid #e2e8f0"><b style="display:block;color:#475569;font-size:11px">فاکتورهای خرید مرتبط</b>' + d.relatedInvoices.map(function (inv) { return '<div style="margin-top:4px"><span>' + escP(inv.label) + '</span><br><button type="button" class="bt bt-o" style="padding:3px 9px;font-size:11px;margin-top:3px" onclick="slInvoiceEdit(\'' + escP(inv.cd) + '\')">✏️ اصلاح همین فاکتور</button></div>'; }).join('') + '</div>'
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
    return '<div id="qualityBox" style="display:none;background:var(--crd);border:1px solid var(--brd);border-radius:14px;padding:14px;margin-top:12px"><div style="display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap"><div><h4 style="margin:0">🧪 کیفیت دادهٔ مالی</h4><small style="color:#64748b">گزارش فقط‌خواندنی است؛ اصلاح فقط از مسیر ماژول اصلی و با تأیید کاربر انجام می‌شود.</small></div><button class="bt bt-o" onclick="ptfDataQualityRender()">↻ بازخوانی</button></div><div style="margin:10px 0;background:' + (total ? '#fff7ed;border:1px solid #fed7aa;color:#9a3412' : '#ecfdf5;border:1px solid #bbf7d0;color:#065f46') + ';border-radius:10px;padding:8px 11px;font-size:12px">' + (total ? '⚠️ ' + total + ' مورد نیازمند بررسی' : '✅ مورد کیفیت داده‌ای شناسایی نشد') + '</div><div class="tb2"><table><thead><tr><th>موارد نیازمند بررسی و اصلاح</th></tr></thead><tbody>' + (body || '<tr><td>موردی نیست</td></tr>') + '</tbody></table></div></div>';
  };
  window.ptfDataQualityRender = function () { var el = document.getElementById('qualityBox'); if (el) { var html = window.ptfDataQualityHtml(); var tmp = document.createElement('div'); tmp.innerHTML = html; var next = tmp.firstElementChild; el.replaceWith(next); } };
})();
