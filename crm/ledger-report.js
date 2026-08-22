/* =====================================================================
   PTF CRM — ledger-report.js — v1.0 (Phase 2 / Step 3)
   تب «تراز رسمی/غیررسمی/تجمیعی» در هاب مالی مدیریتی
   (ر.ک: crm/DESIGN-OFFICIAL-UNOFFICIAL-SEPARATION-PHASE2.md)

   اصول این فایل:
   - فقط‌خواندنی و فقط نمایشی — هیچ رکوردی را نمی‌خواند برای نوشتن، هیچ
     localStorage.setItem/setData ندارد.
   - هیچ فرمول موجود (fiscal.js سود سهامداران، working-capital.js گزارش
     تجمیعی، commission.js پورسانت) را صدا نمی‌زند یا تغییر نمی‌دهد — فقط
     از داده‌های خام (ptf_crm_invoices، ptf_crm_opex،
     ptf_crm_supplier_finance) با ماژول مشترک official-ledger.js
     (گام ۱) می‌خواند و مستقل محاسبه می‌کند.
   - دسترسی: فقط ۴ نقش ارشد (admin/chairman/ceo/commercial) — طبق تصمیم
     کارفرما، حسابدار به این تب دسترسی ندارد (فقط به بخش فاکتورها برای
     ثبت فاکتور رسمی دسترسی دارد).
   - بخش «دفتر واقعی» (ptfLedgerRealPurchaseAmount/ptfLedgerCoverNetBenefit)
     پیشاپیش برای فاز ۵ (فاکتور پوششی/صوری) آماده شده؛ تا وقتی آن گام
     پیاده نشده، این بخش صرفاً برابر با «خرید واقعی معمولی» (بدون تفاوت
     محسوس) نمایش داده می‌شود چون هنوز هیچ رکوردی isCover ندارد.
   ===================================================================== */
(function () {
  'use strict';

  function canLedger() { try { return ['admin', 'chairman', 'ceo', 'commercial'].indexOf(curRole()) > -1; } catch (e) { return false; } }
  function money(v) { return Math.round(+v || 0).toLocaleString('fa-IR') + ' ریال'; }
  function esc(v) { return typeof escP === 'function' ? escP(v == null ? '' : String(v)) : String(v == null ? '' : v); }
  function active(o) { return !!o && o.status !== 'void' && o.st !== 'void' && o.void !== true && o.deleted !== true; }

  function ledgerOfInvoiceSafe(inv) {
    try { return typeof window.ptfLedgerOfInvoice === 'function' ? window.ptfLedgerOfInvoice(inv) : (inv && inv.isUnofficial === true ? 'unofficial' : 'official'); }
    catch (e) { return 'official'; }
  }
  function ledgerOfOpexSafe(o) {
    try { return typeof window.ptfLedgerOfOpex === 'function' ? window.ptfLedgerOfOpex(o) : (o && o.isOfficial === true ? 'official' : (o && o.isOfficial === false ? 'unofficial' : 'unclassified')); }
    catch (e) { return 'unclassified'; }
  }
  function ledgerOfSupplierInvoiceSafe(inv) {
    try { return typeof window.ptfLedgerOfSupplierInvoice === 'function' ? window.ptfLedgerOfSupplierInvoice(inv) : (inv && inv.isOfficial === true ? 'official' : (inv && inv.isOfficial === false ? 'unofficial' : 'unclassified')); }
    catch (e) { return 'unclassified'; }
  }
  function realPurchaseSafe(inv) {
    try { return typeof window.ptfLedgerRealPurchaseAmount === 'function' ? window.ptfLedgerRealPurchaseAmount(inv) : (+inv.amountIrr || +inv.amount || 0); }
    catch (e) { return (+inv.amountIrr || +inv.amount || 0); }
  }
  function coverNetBenefitSafe(inv) {
    try { return typeof window.ptfLedgerCoverNetBenefit === 'function' ? window.ptfLedgerCoverNetBenefit(inv) : 0; }
    catch (e) { return 0; }
  }
  function splitSafe(list, classifierFn, amountFn) {
    try {
      if (typeof window.ptfLedgerSplit === 'function') return window.ptfLedgerSplit(list, classifierFn, amountFn);
    } catch (e) {}
    /* fallback ایمن اگر official-ledger.js بارگذاری نشده باشد */
    var out = { official: 0, unofficial: 0, unclassified: 0, officialCount: 0, unofficialCount: 0, unclassifiedCount: 0, total: 0, totalCount: 0 };
    (list || []).forEach(function (rec) {
      var amt = +(amountFn ? amountFn(rec) : (rec.amountIrr || rec.amount || 0)) || 0;
      var cls = classifierFn(rec);
      out.total += amt; out.totalCount++;
      if (cls === 'official' || cls === 'official-cover') { out.official += amt; out.officialCount++; }
      else if (cls === 'unofficial') { out.unofficial += amt; out.unofficialCount++; }
      else { out.unclassified += amt; out.unclassifiedCount++; }
    });
    return out;
  }

  function ledgerOfPettySafe(p) {
    try { return typeof window.ptfLedgerOfPetty === 'function' ? window.ptfLedgerOfPetty(p) : (p && p.isOfficial === false ? 'unofficial' : 'official'); }
    catch (e) { return 'official'; }
  }

  window.ptfLedgerReportData = function () {
    var invoices = (getData('ptf_crm_invoices') || []).filter(active);
    var opex = (getData('ptf_crm_opex') || []).filter(function (o) {
      return active(o) && !o.fromCoverInvoice && !o.coverInvoiceCd;
    });
    var petty = (getData('ptf_crm_petty') || []).filter(active);
    var sfData = (function () { try { return JSON.parse(localStorage.getItem('ptf_crm_supplier_finance') || '{}'); } catch (e) { return {}; } })();
    var supplierInvoices = (sfData.invoices || []).filter(active);

    var salesSplit = splitSafe(invoices, ledgerOfInvoiceSafe, function (i) { return +i.amount || 0; });
    var opexSplit = splitSafe(opex, ledgerOfOpexSafe, function (o) { return +o.amt || 0; });
    var pettySplit = splitSafe(petty, ledgerOfPettySafe, function (p) { return +p.amt || 0; });
    var purchaseSplit = splitSafe(supplierInvoices, ledgerOfSupplierInvoiceSafe, function (i) { return +i.amountIrr || +i.amount || 0; });
    /* خرید واقعی = رسمیِ غیرپوششی + غیررسمی. مبلغ اسمی پوششی فقط در دفتر رسمی است. */
    var realPurchaseSplit = splitSafe(supplierInvoices, ledgerOfSupplierInvoiceSafe, realPurchaseSafe);
    var coverBenefitTotal = supplierInvoices.reduce(function (s, i) { return s + coverNetBenefitSafe(i); }, 0);
    var coverCount = supplierInvoices.filter(function (i) { return i.isCover === true; }).length;

    var officialExpense = (+opexSplit.official || 0) + (+pettySplit.official || 0);
    var unofficialExpense = (+opexSplit.unofficial || 0) + (+pettySplit.unofficial || 0);
    var aggregateSales = (+salesSplit.official || 0) + (+salesSplit.unofficial || 0);
    var aggregatePurchase = (+realPurchaseSplit.official || 0) + (+realPurchaseSplit.unofficial || 0);
    var aggregateExpense = officialExpense + unofficialExpense;

    return {
      sales: salesSplit,
      opex: opexSplit,
      petty: pettySplit,
      purchase: purchaseSplit,
      officialExpense: officialExpense,
      unofficialExpense: unofficialExpense,
      /* دفتر رسمی: فروش رسمی − خرید رسمی (شامل پوششی) − هزینه رسمی (جاری + تنخواه) */
      officialProfit: (+salesSplit.official || 0) - (+purchaseSplit.official || 0) - officialExpense,
      unofficialProfit: (+salesSplit.unofficial || 0) - (+purchaseSplit.unofficial || 0) - unofficialExpense,
      /* تراز تجمیعی = فعالیت حقیقی: فروش رسمی+غیررسمی، خرید غیرپوششی،
         هزینه رسمی+غیررسمی، به‌علاوه منفعت خرید فاکتور پوششی */
      aggregateSales: aggregateSales,
      aggregatePurchase: aggregatePurchase,
      aggregateExpense: aggregateExpense,
      aggregateProfit: aggregateSales - aggregatePurchase - aggregateExpense + coverBenefitTotal,
      realPurchaseTotal: aggregatePurchase,
      coverBenefitTotal: coverBenefitTotal,
      coverCount: coverCount
    };
  };

  function unclassifiedNote(splitData, label) {
    if (!splitData.unclassifiedCount) return '';
    return '<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:8px 11px;margin-top:8px;font-size:12px;color:#9a3412;display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap"><span><b>⚠️ ' + splitData.unclassifiedCount + ' مورد ' + esc(label) + '</b> (به‌مبلغ ' + money(splitData.unclassified) + ') نوع رسمی/غیررسمی‌شان مشخص نیست — برای همین «رسمی+غیررسمی» با «کل» یکی نیست و در «دفتر واقعی/سود» لحاظ نشده‌اند.</span><button class="bt bt-o" style="font-size:11.5px;color:#9a3412;border-color:#fed7aa" onclick="ptfLedgerGoQuality()">🔍 باز در کیفیت داده</button></div>';
  }

  function block(title, value, color, sub) {
    return '<div class="sc" style="text-align:center"><b style="color:' + color + '">' + money(value) + '</b><span>' + esc(title) + '</span>' + (sub ? '<br><small style="color:#94a3b8">' + sub + '</small>' : '') + '</div>';
  }

  window.ptfLedgerReportHtml = function () {
    if (!canLedger()) return '';
    var d = window.ptfLedgerReportData();
    return '<div id="ledgerReportBox" style="display:none;background:var(--crd);border:1px solid var(--brd);border-radius:14px;padding:14px;margin-top:12px">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px"><div><h4 style="margin:0">📒 تراز رسمی / غیررسمی / تجمیعی</h4><small style="color:#64748b">فقط‌خواندنی — از فاکتورهای فروش، هزینه جاری و فاکتور خرید تأمین‌کننده محاسبه می‌شود؛ هیچ سندی را تغییر نمی‌دهد.</small></div><button class="bt bt-o" onclick="ptfLedgerReportRender()">↻ بازخوانی</button></div>' +

      '<h5 style="margin:12px 0 6px;font-size:13px;color:#0f172a">🏛 دفتر رسمی <small style="color:#64748b;font-weight:400">(برای ممیزی/اظهارنامه)</small></h5>' +
      '<div class="sr" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">' +
      block('فروش رسمی', d.sales.official, '#059669') +
      block('خرید رسمی', d.purchase.official, '#dc2626', d.purchase.officialCount ? d.purchase.officialCount + ' فاکتور' : '') +
      block('هزینه جاری رسمی', d.opex.official, '#b45309') +
      (d.petty && d.petty.official ? block('تنخواه رسمی', d.petty.official, '#b45309') : '') +
      block('سود رسمی', d.officialProfit, d.officialProfit >= 0 ? '#059669' : '#dc2626', 'فروش − خرید − هزینه رسمی') +
      '</div>' +

      '<h5 style="margin:16px 0 6px;font-size:13px;color:#0f172a">🗂 دفتر غیررسمی</h5>' +
      '<div class="sr" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">' +
      block('فروش غیررسمی', d.sales.unofficial, '#059669') +
      block('خرید غیررسمی', d.purchase.unofficial, '#dc2626', d.purchase.unofficialCount ? d.purchase.unofficialCount + ' فاکتور' : '') +
      block('هزینه جاری غیررسمی', d.opex.unofficial, '#b45309') +
      block('سود غیررسمی', d.unofficialProfit, d.unofficialProfit >= 0 ? '#059669' : '#dc2626') +
      '</div>' +

      '<style>#ledgerAggBox{background:linear-gradient(180deg,#eef2ff 0%,#e0e7ff 100%);border:1px solid #c7d2fe}body.ptf-dark #ledgerAggBox{background:linear-gradient(180deg,#1e1b4b 0%,#312e81 100%);border-color:#6366f1}body.ptf-dark #ledgerAggBox h5{color:#e0e7ff!important}body.ptf-dark #ledgerAggBox h5 small{color:#a5b4fc!important}</style>' +
      '<div id="ledgerAggBox" style="margin-top:16px;border-radius:14px;padding:12px">' +
      '<h5 style="margin:0 0 8px;font-size:13px;color:#312e81">📊 تراز تجمیعی <small style="color:#4338ca;font-weight:400">(فعالیت حقیقی — رسمی + غیررسمی + منفعت فاکتور پوششی)</small></h5>' +
      '<div class="sr" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">' +
      block('کل فروش', d.aggregateSales, '#047857', 'رسمی + غیررسمی') +
      block('کل خرید', d.aggregatePurchase, '#b91c1c', 'رسمی غیرپوششی + غیررسمی') +
      block('کل هزینه', d.aggregateExpense, '#c2410c', 'جاری رسمی+غیررسمی' + (d.petty && (d.petty.official || d.petty.unofficial) ? ' + تنخواه' : '')) +
      block('منفعت خرید فاکتور پوششی', d.coverBenefitTotal, d.coverBenefitTotal >= 0 ? '#4f46e5' : '#dc2626', d.coverCount ? d.coverCount + ' فاکتور — اعتبار ارزش‌افزوده − کارمزد' : 'هنوز فاکتور پوششی ثبت نشده') +
      block('سود تجمیعی', d.aggregateProfit, d.aggregateProfit >= 0 ? '#047857' : '#dc2626', 'فروش − خرید − هزینه + منفعت پوششی') +
      '</div>' +
      '<div class="sr" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr));margin-top:6px">' +
      (d.purchase.unclassifiedCount ? block('خرید نامشخص', d.purchase.unclassified, '#b45309', d.purchase.unclassifiedCount + ' مورد — در سود نیست') : '') +
      (d.opex.unclassifiedCount ? block('هزینه‌جاری نامشخص', d.opex.unclassified, '#b45309', d.opex.unclassifiedCount + ' مورد — در سود نیست') : '') +
      (d.sales.unclassifiedCount ? block('فروش نامشخص', d.sales.unclassified, '#b45309', d.sales.unclassifiedCount + ' مورد') : '') +
      '</div>' +
      unclassifiedNote(d.opex, 'هزینه جاری') + unclassifiedNote(d.purchase, 'فاکتور خرید تأمین‌کننده') +
      '</div>' +

      '<h5 style="margin:16px 0 6px;font-size:13px;color:#0f172a">💰 دفتر واقعی <small style="color:#64748b;font-weight:400">(مبنای پیشنهادی تقسیم سود — رسمی+غیررسمی واقعی، بدون فاکتور پوششی/صوری)</small></h5>' +
      '<div style="background:#f8fafc;border:1px solid var(--brd);border-radius:10px;padding:9px 11px;font-size:12px;color:#475569;margin-bottom:8px">فرمول تقسیم سود سهامداران در «سال مالی» فعلاً <b>تغییر نکرده</b> و این بخش صرفاً گزارشی است (طبق تصمیم کارفرما). خرید واقعی = خرید رسمی+غیررسمی <i>به‌جز</i> فاکتورهای پوششی/صوری؛ سود/زیان خالص فاکتورهای پوششی (اعتبار ارزش‌افزوده منهای کارمزد) جداگانه نشان داده می‌شود.</div>' +
      '<div class="sr" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">' +
      block('خرید واقعی (بدون فاکتور پوششی)', d.realPurchaseTotal, '#dc2626') +
      block('سود/زیان خالص فاکتورهای پوششی', d.coverBenefitTotal, d.coverBenefitTotal >= 0 ? '#059669' : '#dc2626', d.coverCount ? d.coverCount + ' فاکتور پوششی ثبت‌شده' : 'هنوز فاکتور پوششی ثبت نشده') +
      '</div>' +
      '</div>';
  };

  window.ptfLedgerReportRender = function () {
    var el = document.getElementById('ledgerReportBox');
    if (!el) return;
    var html = window.ptfLedgerReportHtml();
    if (!html) { el.remove(); return; }
    var tmp = document.createElement('div');
    tmp.innerHTML = html;
    el.replaceWith(tmp.firstElementChild);
  };
  /* v34.0.10-alpha: رفتن به تب «کیفیت داده» (که لیست رکوردهای نامشخص را دارد) */
  window.ptfLedgerGoQuality = function () {
    try {
      if (typeof window.finHubSet === 'function') { window.finHubSet('quality'); }
      var qEl = document.getElementById('qualityBox');
      if (qEl) setTimeout(function () { qEl.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 120);
    } catch (e) {}
  };
})();
