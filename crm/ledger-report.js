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

  window.ptfLedgerReportData = function () {
    var invoices = (getData('ptf_crm_invoices') || []).filter(active);
    var opex = (getData('ptf_crm_opex') || []).filter(active);
    var sfData = (function () { try { return JSON.parse(localStorage.getItem('ptf_crm_supplier_finance') || '{}'); } catch (e) { return {}; } })();
    var supplierInvoices = (sfData.invoices || []).filter(active);

    var salesSplit = splitSafe(invoices, ledgerOfInvoiceSafe, function (i) { return +i.amount || 0; });
    var opexSplit = splitSafe(opex, ledgerOfOpexSafe, function (o) { return +o.amt || 0; });
    var purchaseSplit = splitSafe(supplierInvoices, ledgerOfSupplierInvoiceSafe, function (i) { return +i.amountIrr || +i.amount || 0; });
    /* v34.0.8-alpha (هماهنگ با موتور سود سال مالی): خرید «واقعی» بدون مبلغ اسمی فاکتورهای
       پوششی/صوری — فاکتور پوششی خرید واقعی نیست، فقط منفعتِ خالص (اعتبار ارزش‌افزوده − کارمزد)
       اثر دارد. برای هماهنگی سود رسمی/غیررسمی/تجمیعی، خریدِ پوششی از کسر هزینه حذف و منفعتش
       جدا افزوده می‌شود (مثل fiscal.js). */
    var realPurchaseSplit = splitSafe(supplierInvoices, ledgerOfSupplierInvoiceSafe, realPurchaseSafe);
    var coverBenefitTotal = supplierInvoices.reduce(function (s, i) { return s + coverNetBenefitSafe(i); }, 0);
    var coverCount = supplierInvoices.filter(function (i) { return i.isCover === true; }).length;

    /* دفتر واقعی (بدون فاکتور پوششی) — مبلغ اسمیِ پوششی در خرید واقعی نیست */
    var realPurchaseTotal = realPurchaseSplit.total;

    return {
      sales: salesSplit,
      opex: opexSplit,
      purchase: purchaseSplit,
      /* سود بر مبنای خرید واقعی + منفعت پوششی (نه مبلغ اسمی پوششی) */
      officialProfit: salesSplit.official - opexSplit.official - realPurchaseSplit.official + coverBenefitTotal,
      unofficialProfit: salesSplit.unofficial - opexSplit.unofficial - realPurchaseSplit.unofficial,
      aggregateProfit: salesSplit.total - opexSplit.total - realPurchaseSplit.total + coverBenefitTotal,
      realPurchaseTotal: realPurchaseTotal,
      coverBenefitTotal: coverBenefitTotal,
      coverCount: coverCount
    };
  };

  function unclassifiedNote(splitData, label) {
    if (!splitData.unclassifiedCount) return '';
    return '<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:6px 10px;margin-top:6px;font-size:11.5px;color:#9a3412">⚠️ ' + splitData.unclassifiedCount + ' مورد ' + esc(label) + ' نوع رسمی/غیررسمی‌شان مشخص نیست (' + money(splitData.unclassified) + ') — در «رسمی» و «غیررسمی» زیر لحاظ نشده‌اند. فهرست کامل در تب «کیفیت داده» است.</div>';
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
      block('سود ناخالص رسمی', d.officialProfit, d.officialProfit >= 0 ? '#059669' : '#dc2626') +
      '</div>' +

      '<h5 style="margin:16px 0 6px;font-size:13px;color:#0f172a">🗂 دفتر غیررسمی</h5>' +
      '<div class="sr" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">' +
      block('فروش غیررسمی', d.sales.unofficial, '#059669') +
      block('خرید غیررسمی', d.purchase.unofficial, '#dc2626', d.purchase.unofficialCount ? d.purchase.unofficialCount + ' فاکتور' : '') +
      block('هزینه جاری غیررسمی', d.opex.unofficial, '#b45309') +
      block('سود ناخالص غیررسمی', d.unofficialProfit, d.unofficialProfit >= 0 ? '#059669' : '#dc2626') +
      '</div>' +

      '<h5 style="margin:16px 0 6px;font-size:13px;color:#0f172a">📊 تراز تجمیعی <small style="color:#64748b;font-weight:400">(رسمی + غیررسمی + نامشخص — همان چیزی که «گزارش تجمیعی مالی» نشان می‌دهد)</small></h5>' +
      '<div class="sr" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">' +
      block('کل فروش', d.sales.total, '#059669') +
      block('کل خرید', d.purchase.total, '#dc2626') +
      block('کل هزینه جاری', d.opex.total, '#b45309') +
      block('سود ناخالص تجمیعی', d.aggregateProfit, d.aggregateProfit >= 0 ? '#059669' : '#dc2626') +
      '</div>' +
      unclassifiedNote(d.opex, 'هزینه جاری') + unclassifiedNote(d.purchase, 'فاکتور خرید تأمین‌کننده') +

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
})();
