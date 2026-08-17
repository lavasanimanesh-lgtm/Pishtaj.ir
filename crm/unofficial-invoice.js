/* =====================================================================
   PTF CRM — unofficial-invoice.js — v1.0.8
   ماژول صدور فاکتور غیر رسمی برای پیش‌فاکتورهای شرکت (CO / TC)
   ===================================================================== */
(function () {
  'use strict';

  // فراراکترهای امنیتی HTML برای جلوگیری از XSS
  function escP(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // تبدیل رقم‌های انگلیسی به فارسی
  function toFaDigits(v) {
    if (v == null) return '';
    return String(v).replace(/[0-9]/g, function (d) {
      return '۰۱۲۳۴۵۶۷۸۹'[d];
    });
  }

  // ترجمه واحد کالا به فارسی
  function translateUnitFa(u) {
    u = String(u || '').trim();
    if (!u) return 'عدد';
    var map = {
      'NO': 'عدد', 'pcs': 'عدد', 'PCS': 'عدد', 'No': 'عدد', 'no': 'عدد', 'EA': 'عدد', 'ea': 'عدد', 'EA.': 'عدد',
      'Set': 'دستگاه', 'set': 'دستگاه', 'SET': 'دستگاه',
      'Meter': 'متر', 'meter': 'متر', 'METER': 'متر', 'm': 'متر', 'M': 'متر',
      'Branch': 'شاخه', 'branch': 'شاخه', 'BRANCH': 'شاخه',
      'KG': 'کیلوگرم', 'kg': 'کیلوگرم', 'Kg': 'کیلوگرم',
      'Pack': 'بسته', 'pack': 'بسته', 'PACK': 'بسته',
      'دستگاه': 'دستگاه', 'عدد': 'عدد', 'ست': 'ست', 'متر': 'متر', 'شاخه': 'شاخه', 'کیلوگرم': 'کیلوگرم', 'بسته': 'بسته'
    };
    return map[u] || u;
  }

  // ترجمه نام ارز به فارسی
  function getCurrencyFa(cur) {
    cur = String(cur || '').trim().toUpperCase();
    if (cur === 'IRR' || !cur) return 'ریال';
    var map = {
      'USD': 'دلار',
      'EUR': 'یورو',
      'AED': 'درهم',
      'GBP': 'پوند',
      'CNY': 'یوان',
      'TRY': 'لیر',
      'TOMAN': 'تومان'
    };
    return map[cur] || cur;
  }

  // فرمت رقم با کاما
  function formatNumber(v, cur) {
    v = +v || 0;
    if (cur === 'IRR' || !cur) {
      var rounded = Math.round(v);
      return rounded.toLocaleString('fa-IR');
    } else {
      return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
  }

  // تولید سند HTML فاکتور غیر رسمی
  function generateUnofficialInvoiceHtml(o, total, bankAccount, advPayIrr, discountVal, discountLabel, currentRate, advRate) {
    var itemsHtml = '';
    (o.items || []).forEach(function (it, idx) {
      var rowNum = idx + 1;
      var name = escP(it.name || '');
      var desc = escP(it.desc || '');
      
      var fullDesc = '<div class="item-title">' + name + '</div>';
      if (desc && desc !== name) {
        fullDesc += '<div class="item-desc">' + desc.replace(/;\s*/g, '<br>') + '</div>';
      }
      
      var qty = +it.qty || 0;
      var price = +it.price || 0;
      var itemTotal = qty * price;
      
      var unitFa = translateUnitFa(it.unit);
      var formattedPrice = formatNumber(price, o.currency);
      var formattedItemTotal = formatNumber(itemTotal, o.currency);
      
      itemsHtml += '<tr>' +
        '<td>' + toFaDigits(rowNum) + '</td>' +
        '<td class="desc-col">' + fullDesc + '</td>' +
        '<td>' + toFaDigits(qty) + '</td>' +
        '<td>' + escP(unitFa) + '</td>' +
        '<td dir="ltr" class="text-left">' + formattedPrice + '</td>' +
        '<td dir="ltr" class="text-left">' + formattedItemTotal + '</td>' +
        '</tr>';
    });

    var currencyFa = getCurrencyFa(o.currency);
    var formattedTotal = formatNumber(total, o.currency);
    var totalInWords = window.ptfNumWordsFa ? window.ptfNumWordsFa(total) : total;

    // متغیرهای تخفیف
    var formattedDisc = formatNumber(discountVal, o.currency);
    var discInWords = window.ptfNumWordsFa ? window.ptfNumWordsFa(discountVal) : discountVal;

    // محاسبه نرخ تسعیر پیش‌فاکتور جهت تبدیل مبالغ ریالی پیش‌پرداخت به ارز سند
    var rate = 1;
    if (o.currency && o.currency !== 'IRR') {
      rate = +o.fxRateRef || 1;
    }
    
    // تبدیل پیش‌پرداخت ریالی به ارز سند جهت کسر صحیح از مقادیر ارزی سند چاپی
    var advPayOriginal = o.currency === 'IRR' || !o.currency ? advPayIrr : (advRate > 0 ? (advPayIrr / advRate) : advPayIrr);
    var formattedAdv = formatNumber(advPayOriginal, o.currency);
    var advInWords = window.ptfNumWordsFa ? window.ptfNumWordsFa(advPayOriginal) : advPayOriginal;

    // محاسبه خالص نهایی قابل پرداخت به ارز سند
    var netPayable = Math.max(0, total - discountVal - advPayOriginal);
    var formattedNet = formatNumber(netPayable, o.currency);
    var netInWords = window.ptfNumWordsFa ? window.ptfNumWordsFa(netPayable) : netPayable;
    
    // تبدیل شناسه پیش‌فاکتور به شماره سند متمایز (INV)
    var invoiceNo = String(o.no).replace(/PTF-CO-/i, 'INV-').replace(/PTF-TC-/i, 'INV-');

    // پیدا کردن نام فارسی خریدار از لیست مشتریان
    var buyerCoFa = o.buyerCo || '—';
    try {
      var customers = getData('ptf_crm_customers');
      var cust = customers.filter(function (x) { return x.cd === o.buyerCd; })[0];
      if (cust && cust.co) {
        buyerCoFa = cust.co;
      }
    } catch (e) {}

    var bankHtml = '';
    if (bankAccount && bankAccount.trim()) {
      bankHtml = '<div class="bank-box">' +
        '<strong>💡 مشخصات حساب جهت پرداخت:</strong> ' + escP(bankAccount) +
        '</div>';
    }

    // تولید جزئیات نرخ تسعیر در چاپ برای شفافیت ممیزی و تورم
    var rateDetailsHtml = '';
    if (o.currency && o.currency !== 'IRR') {
      var remainRials = Math.round(netPayable * currentRate);
      rateDetailsHtml = '<div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:8px; padding:10px 15px; margin-top:15px; font-size:12.5px; color:#334155; line-height:1.6">' +
        '📝 <b>گزارش تسعیر موازنه ارز و ریال (حسابداری تعهدی):</b><br>' +
        '• ارزش کل پیش‌فاکتور: <b>' + total.toLocaleString('en-US') + ' ' + o.currency + '</b><br>' +
        (discountVal > 0 ? '• تخفیف اعمال شده: <b>' + discountVal.toLocaleString('en-US') + ' ' + o.currency + '</b><br>' : '') +
        (advPayIrr > 0 ? '• پیش‌پرداخت وصول‌شده: <b>' + advPayIrr.toLocaleString('fa-IR') + ' ریال</b> (تسعیرشده با نرخ روز واریز: <b>' + advRate.toLocaleString('fa-IR') + ' ریال</b> ≈ <b>' + advPayOriginal.toLocaleString('en-US') + ' ' + o.currency + '</b>)<br>' : '') +
        '• خالص بدهی باقیمانده به ارز: <b>' + netPayable.toLocaleString('en-US') + ' ' + o.currency + '</b><br>' +
        '• نرخ تسعیر روز صدور صورتحساب: <b>' + currentRate.toLocaleString('fa-IR') + ' ریال به‌ازای هر ' + o.currency + '</b><br>' +
        '• <b>مبلغ خالص قابل پرداخت امروز به ریال: <span style="color:#16a34a">' + remainRials.toLocaleString('fa-IR') + ' ریال</span></b>' +
        '</div>';
    }

    return '<!DOCTYPE html>' +
      '<html lang="fa" dir="rtl">' +
      '<head>' +
      '  <meta charset="UTF-8">' +
      '  <title>صورتحساب پرداخت</title>' +
      '  <style>' +
      '    @font-face {' +
      '      font-family: "Vazirmatn";' +
      '      src: url("../assets/fonts/Vazirmatn-Regular.woff2") format("woff2");' +
      '      font-weight: 400;' +
      '      font-style: normal;' +
      '      font-display: swap;' +
      '    }' +
      '    @font-face {' +
      '      font-family: "Vazirmatn";' +
      '      src: url("../assets/fonts/Vazirmatn-Medium.woff2") format("woff2");' +
      '      font-weight: 500;' +
      '      font-style: normal;' +
      '      font-display: swap;' +
      '    }' +
      '    @font-face {' +
      '      font-family: "Vazirmatn";' +
      '      src: url("../assets/fonts/Vazirmatn-Bold.woff2") format("woff2");' +
      '      font-weight: 700;' +
      '      font-style: normal;' +
      '      font-display: swap;' +
      '    }' +
      '    @font-face {' +
      '      font-family: "Vazirmatn";' +
      '      src: url("../assets/fonts/Vazirmatn-Black.woff2") format("woff2");' +
      '      font-weight: 900;' +
      '      font-style: normal;' +
      '      font-display: swap;' +
      '    }' +
      '    body {' +
      '      direction: rtl;' +
      '      font-family: "Vazirmatn", "Tahoma", sans-serif;' +
      '      color: #0f172a;' +
      '      background-color: #fff;' +
      '      margin: 0;' +
      '      padding: 0;' +
      '      -webkit-print-color-adjust: exact;' +
      '      print-color-adjust: exact;' +
      '    }' +
      '    .bill-wrapper {' +
      '      padding: 25px;' +
      '      box-sizing: border-box;' +
      '      width: 100%;' +
      '    }' +
      '    .bill-header {' +
      '      display: flex;' +
      '      justify-content: space-between;' +
      '      align-items: flex-start;' +
      '      border-bottom: 2px solid #334155;' +
      '      padding-bottom: 15px;' +
      '      margin-bottom: 20px;' +
      '    }' +
      '    .bill-title-container {' +
      '      display: flex;' +
      '      flex-direction: column;' +
      '    }' +
      '    .bill-title {' +
      '      font-family: "Vazirmatn", sans-serif;' +
      '      font-size: 26px;' +
      '      font-weight: 900;' +
      '      color: #1e293b;' +
      '      margin: 0 0 5px 0;' +
      '      letter-spacing: -0.5px;' +
      '    }' +
      '    .bill-subtitle {' +
      '      font-size: 13px;' +
      '      color: #64748b;' +
      '      margin: 0;' +
      '    }' +
      '    .bill-meta-box {' +
      '      display: grid;' +
      '      grid-template-columns: auto auto;' +
      '      gap: 8px 15px;' +
      '      font-size: 14px;' +
      '      color: #334155;' +
      '      background: #f8fafc;' +
      '      padding: 12px 18px;' +
      '      border: 1px solid #e2e8f0;' +
      '      border-radius: 8px;' +
      '    }' +
      '    .bill-meta-label {' +
      '      font-weight: bold;' +
      '      color: #64748b;' +
      '    }' +
      '    .bill-meta-value {' +
      '      font-weight: 700;' +
      '    }' +
      '    .party-info {' +
      '      display: flex;' +
      '      flex-direction: column;' +
      '      gap: 5px;' +
      '      font-size: 14px;' +
      '      color: #334155;' +
      '      padding: 10px 0;' +
      '    }' +
      '    .party-row {' +
      '      display: flex;' +
      '      gap: 8px;' +
      '    }' +
      '    .party-label {' +
      '      font-weight: bold;' +
      '      color: #64748b;' +
      '    }' +
      '    .party-value {' +
      '      font-weight: 700;' +
      '    }' +
      '    .bill-table {' +
      '      width: 100%;' +
      '      border-collapse: collapse;' +
      '      margin-top: 10px;' +
      '      margin-bottom: 20px;' +
      '    }' +
      '    .bill-table th {' +
      '      background-color: #334155;' +
      '      color: #ffffff;' +
      '      font-weight: 700;' +
      '      font-size: 14px;' +
      '      padding: 12px 10px;' +
      '      border: 1px solid #475569;' +
      '      text-align: center;' +
      '    }' +
      '    .bill-table td {' +
      '      padding: 12px 10px;' +
      '      border: 1px solid #cbd5e1;' +
      '      font-size: 14px;' +
      '      color: #1e293b;' +
      '      text-align: center;' +
      '    }' +
      '    .bill-table tr:nth-child(even) {' +
      '      background-color: #f8fafc;' +
      '    }' +
      '    .desc-col {' +
      '      text-align: right !important;' +
      '      font-weight: 500;' +
      '    }' +
      '    .item-title {' +
      '      font-weight: 700;' +
      '      color: #0f172a;' +
      '      margin-bottom: 4px;' +
      '    }' +
      '    .item-desc {' +
      '      font-size: 12px;' +
      '      color: #64748b;' +
      '      line-height: 1.5;' +
      '    }' +
      '    .totals-row {' +
      '      background-color: #f1f5f9 !important;' +
      '      font-weight: bold;' +
      '    }' +
      '    .totals-label-words {' +
      '      text-align: right !important;' +
      '      font-size: 14px;' +
      '      color: #334155;' +
      '      padding: 15px 12px !important;' +
      '    }' +
      '    .totals-value-words {' +
      '      font-weight: 800;' +
      '      color: #0f172a;' +
      '    }' +
      '    .totals-label-num {' +
      '      text-align: left !important;' +
      '      font-size: 15px;' +
      '      color: #0f172a;' +
      '      padding: 15px 12px !important;' +
      '      border-top: 2px solid #334155 !important;' +
      '    }' +
      '    .bank-box {' +
      '      background-color: #f0fdf4;' +
      '      border: 1px dashed #16a34a;' +
      '      color: #14532d;' +
      '      padding: 12px 18px;' +
      '      border-radius: 8px;' +
      '      margin-top: 20px;' +
      '      font-size: 13.5px;' +
      '      font-weight: bold;' +
      '    }' +
      '    .bill-footer {' +
      '      margin-top: 60px;' +
      '      display: flex;' +
      '      justify-content: space-between;' +
      '      align-items: center;' +
      '      padding: 0 40px;' +
      '    }' +
      '    .signature-block {' +
      '      text-align: center;' +
      '      width: 260px;' +
      '    }' +
      '    .signature-title {' +
      '      font-weight: 700;' +
      '      font-size: 14px;' +
      '      color: #475569;' +
      '      margin-bottom: 50px;' +
      '    }' +
      '    .signature-line {' +
      '      border-bottom: 1px dashed #cbd5e1;' +
      '      width: 100%;' +
      '    }' +
      '    @media print {' +
      '      @page {' +
      '        size: A4 landscape;' +
      '        margin: 10mm;' +
      '      }' +
      '      body {' +
      '        padding: 0;' +
      '        background-color: #fff;' +
      '      }' +
      '      .bill-wrapper {' +
      '        padding: 0;' +
      '      }' +
      '      .bill-table th {' +
      '        background-color: #334155 !important;' +
      '        color: #fff !important;' +
      '        -webkit-print-color-adjust: exact;' +
      '        print-color-adjust: exact;' +
      '      }' +
      '      .bill-table tr:nth-child(even) {' +
      '        background-color: #f8fafc !important;' +
      '        -webkit-print-color-adjust: exact;' +
      '        print-color-adjust: exact;' +
      '      }' +
      '      .totals-row {' +
      '        background-color: #f1f5f9 !important;' +
      '        -webkit-print-color-adjust: exact;' +
      '        print-color-adjust: exact;' +
      '      }' +
      '      .bank-box {' +
      '        background-color: #f0fdf4 !important;' +
      '        -webkit-print-color-adjust: exact;' +
      '        print-color-adjust: exact;' +
      '      }' +
      '    }' +
      '  </style>' +
      '</head>' +
      '<body>' +
      '  <div class="bill-wrapper">' +
      '    <div class="bill-header">' +
      '      <div class="bill-title-container">' +
      '        <h1 class="bill-title">صورتحساب پرداخت</h1>' +
      '        <p class="bill-subtitle">صورتحساب اقلام و خدمات موضوع پیش‌فاکتور</p>' +
      '        <div class="party-info">' +
      '          <div class="party-row">' +
      '            <span class="party-label">خریدار / کارفرما:</span>' +
      '            <span class="party-value">' + escP(buyerCoFa) + '</span>' +
      '          </div>' +
      (o.buyerContact ?
      '          <div class="party-row">' +
      '            <span class="party-label">رابط خریدار:</span>' +
      '            <span class="party-value">' + escP(o.buyerContact) + '</span>' +
      '          </div>' : '') +
      '        </div>' +
      '      </div>' +
      '      <div class="bill-meta-box">' +
      '        <span class="bill-meta-label">شماره سند:</span>' +
      '        <span class="bill-meta-value" dir="ltr">' + escP(invoiceNo) + '</span>' +
      '        <span class="bill-meta-label">تاریخ صدور:</span>' +
      '        <span class="bill-meta-value">' + escP(o.dateFa || '—') + '</span>' +
      '      </div>' +
      '    </div>' +
      '    <table class="bill-table">' +
      '      <thead>' +
      '        <tr>' +
      '          <th style="width: 5%;">ردیف</th>' +
      '          <th style="width: 50%;">شرح کالا یا خدمات</th>' +
      '          <th style="width: 8%;">تعداد</th>' +
      '          <th style="width: 10%;">واحد</th>' +
      '          <th style="width: 12%;">قیمت واحد</th>' +
      '          <th style="width: 15%;">قیمت کل</th>' +
      '          </tr>' +
      '      </thead>' +
      '      <tbody>' +
      itemsHtml +
      '        <tr class="totals-row">' +
      '          <td colspan="4" class="totals-label-words">' +
      '            جمع کل صورتحساب (به حروف): ' +
      '            <span class="totals-value-words">' + totalInWords + ' ' + currencyFa + '</span>' +
      '          </td>' +
      '          <td colspan="2" class="totals-label-num">' +
      '            جمع کل: ' +
      '            <span>' + formattedTotal + '</span> ' + currencyFa +
      '          </td>' +
      '        </tr>' +
      (discountVal > 0 ?
      '        <tr class="totals-row" style="background-color: #fef2f2 !important;">' +
      '          <td colspan="4" class="totals-label-words" style="color: #991b1b;">' +
      '            کاهش بدهی بابت ' + escP(discountLabel) + ' (به حروف): ' +
      '            <span class="totals-value-words" style="color: #991b1b;">' + discInWords + ' ' + currencyFa + '</span>' +
      '          </td>' +
      '          <td colspan="2" class="totals-label-num" style="color: #991b1b; border-top: 1px solid #fca5a5 !important;">' +
      '            مبلغ تخفیف: ' +
      '            <span>' + formattedDisc + '</span> ' + currencyFa +
      '          </td>' +
      '        </tr>' : '') +
      (advPayOriginal > 0 ?
      '        <tr class="totals-row" style="background-color: #fffbeb !important;">' +
      '          <td colspan="4" class="totals-label-words" style="color: #b45309;">' +
      '            کسر پیش‌پرداخت وصول‌شده (به حروف): ' +
      '            <span class="totals-value-words" style="color: #b45309;">' + advInWords + ' ' + currencyFa + '</span>' +
      '          </td>' +
      '          <td colspan="2" class="totals-label-num" style="color: #b45309; border-top: 1px solid #fde68a !important;">' +
      '            مبلغ پیش‌پرداخت: ' +
      '            <span>' + formattedAdv + '</span> ' + currencyFa +
      '          </td>' +
      '        </tr>' : '') +
      ((advPayOriginal > 0 || discountVal > 0) ?
      '        <tr class="totals-row" style="background-color: #f0fdf4 !important; font-size: 15px;">' +
      '          <td colspan="4" class="totals-label-words" style="color: #15803d; padding: 18px 12px !important;">' +
      '            <strong>باقی‌مانده خالص قابل پرداخت (به حروف):</strong> ' +
      '            <span class="totals-value-words" style="color: #15803d; font-size: 15px;">' + netInWords + ' ' + currencyFa + '</span>' +
      '          </td>' +
      '          <td colspan="2" class="totals-label-num" style="color: #15803d; font-size: 16px; border-top: 2px solid #16a34a !important; padding: 18px 12px !important;">' +
      '            <strong>خالص قابل پرداخت:</strong> ' +
      '            <span>' + formattedNet + '</span> ' + currencyFa +
      '          </td>' +
      '        </tr>' : '') +
      '      </tbody>' +
      '    </table>' +
      rateDetailsHtml +
      bankHtml +
      '    <div class="bill-footer">' +
      '      <div class="signature-block">' +
      '        <p class="signature-title">مهر و امضای صادرکننده</p>' +
      '        <div class="signature-line"></div>' +
      '      </div>' +
      '      <div class="signature-block">' +
      '        <p class="signature-title">مهر و امضای خریدار</p>' +
      '        <div class="signature-line"></div>' +
      '      </div>' +
      '    </div>' +
      '  </div>' +
      '</body>' +
      '</html>';
  }

  // فرآیند خودکار پاک‌سازی دوبارشماری (Void خودکار فاکتورهای غیررسمی با ورود فاکتور رسمی)
  function cleanUpDoubleInvoices() {
    try {
      var invs = getData('ptf_crm_invoices');
      var changed = false;
      var officialOfferNos = {};
      
      invs.forEach(function (inv) {
        if (inv && !inv.isUnofficial && inv.status !== 'void' && inv.st !== 'void') {
          officialOfferNos[inv.offerNo] = true;
        }
      });
      
      invs.forEach(function (inv) {
        if (inv && inv.isUnofficial && officialOfferNos[inv.offerNo] && inv.status !== 'void' && inv.st !== 'void') {
          inv.status = 'void';
          inv.st = 'void';
          inv.voidAt = faDateTime();
          inv.voidBy = 'سیستم (صدور فاکتور رسمی حسابدار)';
          changed = true;
        }
      });
      
      if (changed) {
        setData('ptf_crm_invoices', invs);
      }
    } catch (e) {}
  }

  // اکشن اصلی صدور فاکتور غیررسمی
  window.unofficialInvoicePrint = function (no) {
    // پاکسازی اتوماتیک دوبارشماری‌ها در شروع کار
    cleanUpDoubleInvoices();

    var offers = getData('ptf_crm_offers');
    var o = offers.filter(function (x) { return x.no === no; })[0];
    if (!o) {
      alert('پیش‌فاکتور یافت نشد.');
      return;
    }
    if (!o.items || !o.items.length) {
      alert('این پیش‌فاکتور فاقد اقلام کالا می‌باشد.');
      return;
    }

    // بررسی ممیزی سال مالی قفل شده
    var invYear = String(o.dateFa || '').split('/')[0];
    if (invYear && typeof ptfFiscalYearLocked === 'function' && ptfFiscalYearLocked(invYear)) {
      alert('🔒 خطا: سال مالی ' + toFaDigits(invYear) + ' قفل است. صدور، تغییر یا حذف صورتحساب غیررسمی در سال مالی قفل شده مجاز نمی‌باشد.');
      return;
    }

    var invoiceNo = String(o.no).replace(/PTF-CO-/i, 'INV-').replace(/PTF-TC-/i, 'INV-');
    var invoiceCd = 'UN-INV-' + o.no; // تولید شناسه متمایز جهت جلوگیری از تعارض کدهای سروری

    var invs = getData('ptf_crm_invoices');
    var existing = invs.filter(function (x) { return x.cd === invoiceCd || (x.offerNo === o.no && x.isUnofficial && x.status !== 'void'); })[0];

    var bankAccount = '';
    var discountInput = '';
    var rateInput = '';
    var discountVal = 0;
    var discountLabel = 'تخفیف توافقی';
    var newInv = null;

    // محاسبه جمع کل پیش‌فاکتور در ارز مبنا
    var total = o.items.reduce(function (sum, it) {
      return sum + (+it.qty || 0) * (+it.price || 0);
    }, 0);

    // محاسبه نرخ پیش‌فرض اولیه
    var rate = 1;
    if (o.currency && o.currency !== 'IRR') {
      rate = +o.fxRateRef || 1;
    }
    var currentRate = rate;

    // محاسبه نرخ روز واریز پیش‌پرداخت (از روی ثبت های پیشین در CO)
    var advRate = o.advance && o.advance.rate ? +o.advance.rate : rate;

    if (existing) {
      var action = confirm('یک صورتحساب پرداخت برای این پیش‌فاکتور قبلاً در سیستم ثبت شده است.\n\n- جهت نمایش و چاپ مجدد همان سند قبلی (با حفظ تخفیف و مشخصات قبلی)، دکمه OK را بزنید.\n\n- جهت اعمال مابه‌التفاوت، تغییر شماره حساب، تغییر تخفیف یا حذف کامل صورتحساب، دکمه Cancel را بزنید.');
      if (action) {
        // بازخوانی عینی مقادیر ذخیره شده‌ی قبلی
        bankAccount = existing.bankAccount || '';
        discountVal = existing.discount || 0;
        discountLabel = existing.discountLabel || 'تخفیف توافقی';
        discountInput = existing.discountInput || '';
        currentRate = existing.offerFxRateRef || rate;
        newInv = existing;
      } else {
        // پیشنهاد مقادیر فعلی به عنوان مقدار پیش‌فرض برای بازنویسی راحت‌تر کاربر
        bankAccount = prompt('در صورت تمایل، شماره حساب / کارت / شبا جهت درج در صورتحساب را وارد کنید (اختیاری):', existing.bankAccount || '');
        if (bankAccount === null) return; // لغو عملیات
        
        discountInput = prompt('در صورت تمایل، مبلغ یا درصد تخفیف را وارد کنید (مثال: 5000000 یا 5%) (اختیاری):', existing.discountInput || '');
        if (discountInput === null) return; // لغو عملیات

        if (o.currency && o.currency !== 'IRR') {
          rateInput = prompt('نرخ تسعیر روز صدور فاکتور (ریال به‌ازای هر ' + o.currency + ') را وارد کنید:', existing.offerFxRateRef || rate);
          if (rateInput === null) return;
          currentRate = parseFloat(rateInput) || rate;
        }
        
        invs = invs.filter(function (x) { return x.cd !== existing.cd && !(x.offerNo === o.no && x.isUnofficial); });
      }
    } else {
      bankAccount = prompt('در صورت تمایل، شماره حساب / کارت / شبا جهت درج در صورتحساب را وارد کنید (اختیاری):', '');
      if (bankAccount === null) return; // لغو عملیات
      
      discountInput = prompt('در صورت تمایل، مبلغ یا درصد تخفیف را وارد کنید (مثال: 5000000 یا 5%) (اختیاری):', '');
      if (discountInput === null) return; // لغو عملیات

      if (o.currency && o.currency !== 'IRR') {
        rateInput = prompt('نرخ تسعیر روز صدور فاکتور (ریال به‌ازای هر ' + o.currency + ') را وارد کنید:', rate);
        if (rateInput === null) return;
        currentRate = parseFloat(rateInput) || rate;
      }
    }

    // پردازش تخفیف نقدی یا درصدی (فقط در صورت ایجاد نسخه جدید یا اوررایت)
    if (!newInv) {
      if (discountInput && discountInput.trim()) {
        var cleanInput = discountInput.trim().replace(/[٪%]/g, '');
        if (discountInput.indexOf('%') > -1 || discountInput.indexOf('٪') > -1) {
          var pct = parseFloat(cleanInput) || 0;
          discountVal = Math.round(total * pct / 100);
          discountLabel = 'تخفیف توافقی (' + toFaDigits(pct) + '٪)';
        } else {
          discountVal = parseFloat(cleanInput.replace(/,/g, '')) || 0;
          discountLabel = 'تخفیف توافقی';
        }
      }
    }

    // تبدیل مبالغ به معادل ریالی جهت ذخیره صحیح در تراز دفتری مطالبات
    var totalIrr = o.currency === 'IRR' || !o.currency ? total : Math.round(total * currentRate);
    var discountIrr = o.currency === 'IRR' || !o.currency ? discountVal : Math.round(discountVal * currentRate);

    // محاسبه زنده و رسمی پیش‌پرداخت وصول‌شده از بخش مطالبات (که ریالی است)
    var advPayIrr = 0;
    try {
      var _a = (!window.PTF_SALES_DOMAIN_V2 && o && typeof ptfAdvanceNormalize === 'function') ? ptfAdvanceNormalize(o) : null;
      if (_a && _a.mode !== 'none' && (+_a.amt || 0) > 0) {
        advPayIrr = Math.round(+(_a.receivedAmt != null ? _a.receivedAmt : (_a.paid || _a.cashFull ? _a.amt : 0)) || 0);
      }
    } catch (eAdv) {}

    // تبدیل پیش‌پرداخت ریالی به ارز سند بر اساس نرخ واریز پیش‌پرداخت
    var advPayOriginal = o.currency === 'IRR' || !o.currency ? advPayIrr : (advRate > 0 ? (advPayIrr / advRate) : advPayIrr);

    // محاسبه بدهی نهایی ریالی با فرمول تورم‌پویا:
    // (کل ارز - تخفیف ارز - معادل ارز پیش پرداخت در زمان واریز) * نرخ تسعیر روز صدور + مبلغ ریالی پیش پرداخت
    var netPayableOriginal = Math.max(0, total - discountVal - advPayOriginal);
    var netPayableIrr = Math.round(netPayableOriginal * currentRate);
    var amountIrr = advPayIrr + netPayableIrr; // ارزش کل فاکتور دفتری به ریال

    // شناسه پرونده منبع اتصال مالی است؛ شماره پیشنهاد فقط مرجع نمایشی است.
    var _salesCase = (getData('ptf_crm_deals') || []).filter(function (d) { return d && (d.wonOffer === o.no || (o._id && d.rootOfferId === o._id)); })[0] || null;
    if (newInv && _salesCase) { newInv.caseId = _salesCase._id || _salesCase.cd || ''; newInv.customerId = _salesCase.buyerCd || o.buyerCd || ''; setData('ptf_crm_invoices', invs); }
    // ذخیره فاکتور در مطالبات کلاینت در صورتی که ثبت نشده باشد
    if (!newInv) {
      newInv = {
        cd: invoiceCd,
        caseId: _salesCase ? (_salesCase._id || _salesCase.cd || '') : '',
        customerId: (_salesCase && _salesCase.buyerCd) || o.buyerCd || '',
        no: invoiceNo,
        offerNo: o.no,
        amount: amountIrr, // مبلغ دفتری به ریال متناسب با تورم
        base: totalIrr,
        vat: 0,
        discount: discountIrr,
        discountLabel: discountLabel,
        discountInput: discountInput,
        invDate: o.dateFa || faDate(),
        t: o.dateFa || faDate(),
        buyerCo: o.buyerCo || '',
        offerCurrency: o.currency || 'IRR',
        offerFxBasis: o.fxBasis || '',
        offerFxRateRef: currentRate, // نرخ روز صدور
        payments: [],
        isUnofficial: true,
        bankAccount: bankAccount,
        by: curSession().name,
        status: 'active'
      };

      // اتصال خودکار پیش‌پرداخت به عنوان وصولی فاکتور غیررسمی (به ریال) با ساختار دقیق ارزی fx جهت عدم نشت در پترن‌های حسابداری
      if (advPayIrr > 0) {
        newInv.payments.push({
          cd: 'RP-ADV-' + o.no,
          amt: advPayIrr,
          amountIrr: advPayIrr,
          fx: {
            fxAmt: advPayOriginal,
            rate: advRate
          },
          how: 'کسر مبالغ وصول‌شده پیش‌پرداخت (غیررسمی)',
          t: faDate(),
          by: curSession().name,
          fromAdvance: true
        });
        newInv.advApplied = advPayIrr;
      }

      invs.unshift(newInv);
      setData('ptf_crm_invoices', invs);
      if (window.PTF_SALES_DOMAIN_V2 && typeof window.ptfSalesDomainApi === 'function') {
        window.ptfSalesDomainApi('register_unofficial_invoice', { invoice: newInv, idempotencyKey: 'UNOFFICIAL|' + newInv.cd })
          .then(function () { if (typeof ptfToast === 'function') ptfToast('صورتحساب غیررسمی توسط سرور تأیید شد', 'ok'); })
          .catch(function (e) {
            var rollback = (getData('ptf_crm_invoices') || []).filter(function (x) { return x.cd !== newInv.cd; });
            if (typeof window.ptfSyncApplyServerProjection === 'function') window.ptfSyncApplyServerProjection('ptf_crm_invoices', rollback); else setData('ptf_crm_invoices', rollback);
            alert('⛔ ثبت سروری صورتحساب غیررسمی ناموفق بود و رکورد محلی بازگردانده شد: ' + e.message);
          });
      }

      // ثبت رویداد در تایم‌لاین پرونده فروش جهت هماهنگی با تیم کارشناسان
      try {
        var _deals = getData('ptf_crm_deals');
        var _d = _deals.filter(function (x) { return x.wonOffer === o.no || x.offerNo === o.no; })[0];
        if (_d) {
          _d.timeline = _d.timeline || [];
          _d.timeline.push({
            t: faDateTime(),
            by: curSession().name,
            tx: '🧾 صورتحساب پرداخت ' + invoiceNo + ' به مبلغ کل دفتری ' + amountIrr.toLocaleString('fa-IR') + ' ریال صادر شد.' + (discountVal > 0 ? ' (تخفیف: ' + discountVal.toLocaleString('en-US') + ' ' + o.currency + ')' : '') + (advPayIrr > 0 ? ' — کسر پیش‌پرداخت: ' + advPayIrr.toLocaleString('fa-IR') + ' ریال' : '')
          });
          setData('ptf_crm_deals', _deals);
        }
      } catch (eD) {}

      if (typeof ptfToast === 'function') {
        ptfToast('صورتحساب با موفقیت صادر و در مطالبات هاب مالی ثبت گردید.', 'ok');
      }
    }

    var html = generateUnofficialInvoiceHtml(o, total, bankAccount, advPayIrr, discountVal, discountLabel, currentRate, advRate);

    if (typeof window.ptfPreviewPrintableDoc === 'function') {
      window.ptfPreviewPrintableDoc('صورتحساب پرداخت — ' + invoiceNo, html, 'unofficial-invoice-' + invoiceNo);
    } else {
      var w = window.open('', '_blank');
      w.document.write(html);
      w.document.close();
    }
  };

  // =====================================================================
  // 📁 سیستم بایگانی و مدیریت اظهارنامه‌های مالیاتی و ارزش افزوده فصلی (آرشیوساز حسابدار)
  // =====================================================================
  
  // ۱. رندر تنه ظاهری پنل اظهارنامه‌ها
  window.ptfTaxReturnsHtml = function () {
    var role = curRole();
    var allowed = ['admin', 'chairman', 'ceo', 'commercial', 'accountant'];
    if (allowed.indexOf(role) === -1) return '';
    
    return '<div id="taxReturnsBox" style="background:var(--crd,#fff);border:1px solid var(--brd,#cbd5e1);border-radius:14px;padding:15px;margin-top:15px">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px">' +
      '  <h4 style="margin:0;font-size:14px;color:#0f172a">📁 بایگانی اظهارنامه‌های مالیاتی و ارزش افزوده فصلی</h4>' +
      (role === 'accountant' || isSenior() ? '  <button class="bt" onclick="ptfTaxReturnsAdd()">➕ بارگذاری اظهارنامه جدید</button>' : '') +
      '</div>' +
      '<div id="taxReturnsListWrap" class="tb2"></div>' +
      '</div>';
  };

  // ۲. رندرساز پویای سطرهای لیست اظهارنامه‌ها
  window.ptfTaxReturnsRender = function () {
    var el = document.getElementById('taxReturnsListWrap');
    if (!el) return;
    
    var returns = getData('ptf_crm_tax_returns') || [];
    if (!returns.length) {
      el.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:12px;font-size:12px">هیچ اظهارنامه‌ای بارگذاری نشده است.</div>';
      return;
    }
    
    var h = '<table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr>' +
      '<th style="border:1px solid var(--brd,#cbd5e1);padding:6px;background:#f8fafc">سال مالی</th>' +
      '<th style="border:1px solid var(--brd,#cbd5e1);padding:6px;background:#f8fafc">دوره / فصل</th>' +
      '<th style="border:1px solid var(--brd,#cbd5e1);padding:6px;background:#f8fafc">نوع اظهارنامه</th>' +
      '<th style="border:1px solid var(--brd,#cbd5e1);padding:6px;background:#f8fafc">سند ضمیمه</th>' +
      '<th style="border:1px solid var(--brd,#cbd5e1);padding:6px;background:#f8fafc">ثبت‌کننده</th>' +
      '<th style="border:1px solid var(--brd,#cbd5e1);padding:6px;background:#f8fafc">تاریخ ثبت</th>' +
      (curRole() === 'accountant' || isSenior() ? '<th style="border:1px solid var(--brd,#cbd5e1);padding:6px;background:#f8fafc;width:5%"></th>' : '') +
      '</tr></thead><tbody>';
      
    returns.forEach(function (r, idx) {
      var fileLink = '—';
      if (r.file) {
        fileLink = '<a href="javascript:void(0)" onclick="openStoredFile(\'' + ptfOnClickArg(r.file.key || '') + '\')" style="color:#0e7490;font-weight:bold;text-decoration:underline">📎 ' + escP(r.file.name) + '</a>';
      }
      
      var delBtn = '';
      if (curRole() === 'accountant' || isSenior()) {
        delBtn = '<button class="bt bt-o" style="padding:2px 6px;color:#dc2626;font-size:11px" onclick="ptfTaxReturnsDel(' + idx + ')">✕</button>';
      }
      
      h += '<tr>' +
        '<td style="border:1px solid var(--brd,#cbd5e1);padding:6px;text-align:center">' + toFaDigits(r.year) + '</td>' +
        '<td style="border:1px solid var(--brd,#cbd5e1);padding:6px;text-align:center">' + escP(r.season) + '</td>' +
        '<td style="border:1px solid var(--brd,#cbd5e1);padding:6px;text-align:center"><b>' + escP(r.type) + '</b></td>' +
        '<td style="border:1px solid var(--brd,#cbd5e1);padding:6px;text-align:center">' + fileLink + '</td>' +
        '<td style="border:1px solid var(--brd,#cbd5e1);padding:6px;text-align:center">' + escP(r.by) + '</td>' +
        '<td style="border:1px solid var(--brd,#cbd5e1);padding:6px;text-align:center">' + escP(r.t) + '</td>' +
        (delBtn ? '<td style="border:1px solid var(--brd,#cbd5e1);padding:6px;text-align:center">' + delBtn + '</td>' : '') +
        '</tr>';
    });
    
    h += '</tbody></table>';
    el.innerHTML = h;
  };

  // ۳. دیالوگ ثبت و بارگذاری اظهارنامه جدید با ابزار پیوست
  window.ptfTaxReturnsAdd = function () {
    window._taxFiles = [];
    
    ptfDialog({
      title: '➕ بارگذاری اظهارنامه جدید فصلی',
      body: 'لطفاً مشخصات سال، فصل و نوع اظهارنامه را تکمیل نموده و فیش/PDF آن را ضمیمه کنید.',
      fields: [
        { id: 'year', label: 'سال مالی *', type: 'number', value: String(new Date().getFullYear() - 621), required: true, dir: 'ltr' },
        { id: 'season', label: 'دوره / فصل *', type: 'select', value: 'بهار', options: [
          { v: 'بهار', lb: '🌸 بهار' },
          { v: 'تابستان', lb: '☀️ تابستان' },
          { v: 'پاییز', lb: '🍁 پاییز' },
          { v: 'زمستان', lb: '❄️ زمستان' },
          { v: 'کل سال', lb: '📅 کل سال / عملکرد سالانه' }
        ]},
        { id: 'type', label: 'نوع اظهارنامه / سند *', type: 'select', value: 'ارزش افزوده', options: [
          { v: 'ارزش افزوده', lb: '🧾 ارزش افزوده فصلی' },
          { v: 'گزارش فصلی خرید و فروش (ماده ۱۶۹)', lb: '📊 گزارش فصلی خرید و فروش (ماده ۱۶۹)' },
          { v: 'اظهارنامه عملکرد سالانه', lb: '💼 اظهارنامه عملکرد سالانه' },
          { v: 'گزارش اعتبار ارزش افزوده دوره', lb: '💳 گزارش اعتبار ارزش افزوده دوره' },
          { v: 'سایر مدارک قانونی مالیات', lb: '📎 سایر مدارک قانونی مالیات' }
        ]}
      ],
      okText: 'ادامه و آپلود فایل',
      onOk: function (v) {
        if (!v.year || !v.season || !v.type) {
          alert('لطفاً اطلاعات ستاره‌دار را تکمیل کنید.');
          return;
        }
        
        ptfDialog({
          title: '📎 ضمیمه فایل فاکتور/اظهارنامه',
          body: 'روی کادر زیر کلیک کنید تا فایل پی‌دی‌اف یا تصویر اظهارنامه آپلود شود:<br><br><div id="taxUpWrap" style="padding:15px;border:2px dashed var(--brd,#cbd5e1);text-align:center;border-radius:10px;background:#f8fafc;cursor:pointer">📂 بارگذاری فایل ضمیمه (کلیک کنید)</div><div id="taxFileStatus" style="margin-top:8px;font-weight:bold;color:#0e7490"></div>',
          okText: '💾 ثبت نهایی اظهارنامه',
          onOk: function () {
            if (!window._taxFiles || !window._taxFiles.length) {
              alert('بارگذاری فایل ضمیمه اظهارنامه الزامی است.');
              return;
            }
            
            var returns = getData('ptf_crm_tax_returns') || [];
            returns.unshift({
              cd: genCode('TAX'),
              year: v.year,
              season: v.season,
              type: v.type,
              file: window._taxFiles[0],
              t: faDate(),
              by: curSession().name || '?',
              status: 'active'
            });
            setData('ptf_crm_tax_returns', returns);
            
            if (typeof ptfToast === 'function') {
              ptfToast('اظهارنامه مالیاتی با موفقیت بارگذاری و آرشیو گردید.', 'ok');
            }
            
            window.ptfTaxReturnsRender();
          }
        });
        
        // همگام‌سازی ویجت آپلود بومی هاست روی تگ ایجاد شده
        setTimeout(function() {
          if (typeof attachUploadWidget === 'function') {
            attachUploadWidget('taxUpWrap', 'tax-returns', function (f) {
              window._taxFiles = [f];
              var statusEl = document.getElementById('taxFileStatus');
              if (statusEl) {
                statusEl.textContent = '✅ فایل با موفقیت ضمیمه شد: ' + f.name;
              }
            });
          }
        }, 120);
      }
    });
  };

  // ۴. حذف فیزیکی اظهارنامه فصلی از آرشیو
  window.ptfTaxReturnsDel = function (idx) {
    if (!confirm('آیا مایل به حذف کامل این اظهارنامه از آرشیو مالیاتی هستید؟')) return;
    var returns = getData('ptf_crm_tax_returns') || [];
    returns.splice(idx, 1);
    setData('ptf_crm_tax_returns', returns);
    window.ptfTaxReturnsRender();
  };

  // =====================================================================
  // 📊 داشبورد برنامه‌ریزی فصلی مالیات و موازنه هزینه (داشبورد فام - ویژه مدیران)
  // =====================================================================

  window.ptfTaxPlannerHtml = function () {
    var role = curRole();
    var allowed = ['admin', 'chairman', 'ceo', 'commercial'];
    if (allowed.indexOf(role) === -1) return '';
    
    return '<div id="ptfTaxPlannerBox" style="background:var(--crd,#fff);border:1px solid var(--brd,#cbd5e1);border-radius:14px;padding:15px;margin-top:15px">' +
      '  <h4 style="margin:0 0 12px 0;font-size:14px;color:#0f172a">📊 داشبورد برنامه‌ریزی فصلی مالیات و موازنه هزینه (ویژه مدیران)</h4>' +
      '  <div class="fr" style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px">' +
      '    <div class="fld" style="flex:1;min-width:120px">' +
      '      <label>سال مالی</label>' +
      '      <input id="tpYear" type="number" value="1405" style="width:100%;padding:6px;border:1px solid var(--brd);border-radius:8px;direction:ltr" oninput="ptfTaxPlannerLive()">' +
      '    </div>' +
      '    <div class="fld" style="flex:1;min-width:120px">' +
      '      <label>فصل موازنه</label>' +
      '      <select id="tpSeason" style="width:100%;padding:6px;border:1px solid var(--brd);border-radius:8px" onchange="ptfTaxPlannerLive()">' +
      '        <option value="1">🌸 بهار (سه ماهه اول)</option>' +
      '        <option value="2" selected>☀️ تابستان (سه ماهه دوم)</option>' +
      '        <option value="3">🍁 پاییز (سه ماهه سوم)</option>' +
      '        <option value="4">❄️ زمستان (سه ماهه چهارم)</option>' +
      '      </select>' +
      '    </div>' +
      '    <div class="fld" style="flex:1;min-width:120px">' +
      '      <label>سود رسمی هدف (٪)</label>' +
      '      <input id="tpMargin" type="number" value="10" min="1" max="100" style="width:100%;padding:6px;border:1px solid var(--brd);border-radius:8px;direction:ltr" oninput="ptfTaxPlannerLive()">' +
      '    </div>' +
      '    <div style="display:flex;align-items:flex-end">' +
      '      <button class="bt" onclick="ptfTaxPlannerCalculate()">📊 محاسبه و تحلیل موازنه</button>' +
      '    </div>' +
      '  </div>' +
      '  <div id="tpResultsWrap" style="margin-top:15px"></div>' +
      '</div>';
  };

  /* فاز ۲ / گام ۶: محاسبه‌ی زنده با debounce کوتاه — دکمه‌ی «محاسبه» همچنان کار می‌کند */
  var _tpLiveTimer = null;
  window.ptfTaxPlannerLive = function () {
    clearTimeout(_tpLiveTimer);
    _tpLiveTimer = setTimeout(function () { try { window.ptfTaxPlannerCalculate(); } catch (e) {} }, 300);
  };

  window.ptfTaxPlannerCalculate = function () {
    var year = document.getElementById('tpYear').value.trim();
    var season = document.getElementById('tpSeason').value;
    var margin = parseFloat(document.getElementById('tpMargin').value) || 10;
    
    var el = document.getElementById('tpResultsWrap');
    if (!el) return;

    // متد ممیزی تاریخ شمسی جهت استخراج دقیق سال و ماه
    function parseYearMonth(dt) {
      dt = String(dt || '').trim();
      dt = dt.replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); })
             .replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); });
      
      var parts = dt.split('/');
      var y = parseInt(parts[0]) || 0;
      var m = parseInt(parts[1]) || 0;
      return { y: y, m: m };
    }
    function inSeason(m) {
      if (season === '1') return m >= 1 && m <= 3;
      if (season === '2') return m >= 4 && m <= 6;
      if (season === '3') return m >= 7 && m <= 9;
      if (season === '4') return m >= 10 && m <= 12;
      return false;
    }
    /* فاز ۲ / گام ۶: طبقه‌بندی از ماژول مشترک official-ledger.js (گام ۱)
       به‌جای شرط پراکنده — رکوردهای «نامشخص» صریحاً افشا می‌شوند، نه اینکه
       پنهان به‌عنوان غیررسمی حذف شوند (رفع باگ کشف‌شده در فاز ۱). */
    function ledgerOfOpexSafe(o) {
      try { return typeof window.ptfLedgerOfOpex === 'function' ? window.ptfLedgerOfOpex(o) : (o && o.isOfficial === true ? 'official' : (o && o.isOfficial === false ? 'unofficial' : 'unclassified')); }
      catch (e) { return 'unclassified'; }
    }
    function ledgerOfSupplierInvoiceSafe(inv) {
      try { return typeof window.ptfLedgerOfSupplierInvoice === 'function' ? window.ptfLedgerOfSupplierInvoice(inv) : (inv && inv.isOfficial === true ? 'official' : (inv && inv.isOfficial === false ? 'unofficial' : 'unclassified')); }
      catch (e) { return 'unclassified'; }
    }
    
    // ۱. استخراج فروش‌های رسمی مودیان در این فصل
    var invs = getData('ptf_crm_invoices').filter(function (i) {
      if (i.status === 'void' || i.st === 'void' || i.void === true) return false;
      if (i.isUnofficial) return false; // فاکتورهای غیررسمی در حساب ابرازی دارایی نقش ندارند
      
      var parsed = parseYearMonth(i.invDate || i.t || '');
      if (String(parsed.y) !== String(year)) return false;
      return inSeason(parsed.m);
    });
    
    var salesTotal = invs.reduce(function (sum, i) { return sum + (+i.amount || 0); }, 0);
    
    // ۲. استخراج خریدهای رسمی ثبت شده در این فصل — طبق طبقه‌بندی official-ledger.js
    //    (فاکتور پوششی/صوری هم اینجا «رسمی» شمرده می‌شود؛ دقیقاً طبق تعریف فاز ۲)
    var supplierData = (function () { try { return JSON.parse(localStorage.getItem('ptf_crm_supplier_finance') || '{}'); } catch (e) { return {}; } })();
    var allSfInvsInSeason = (supplierData.invoices || []).filter(function (i) {
      if (i.status === 'void') return false;
      var parsed = parseYearMonth(i.dateFa || i.dateISO || '');
      if (String(parsed.y) !== String(year)) return false;
      return inSeason(parsed.m);
    });
    var sfInvs = allSfInvsInSeason.filter(function (i) { var cls = ledgerOfSupplierInvoiceSafe(i); return cls === 'official' || cls === 'official-cover'; });
    var sfInvsUnclassified = allSfInvsInSeason.filter(function (i) { return ledgerOfSupplierInvoiceSafe(i) === 'unclassified'; });
    
    var purchaseTotal = sfInvs.reduce(function (sum, i) { return sum + (+i.amountIrr || +i.amount || 0); }, 0);
    
    // ۳. استخراج هزینه‌های جاری رسمی در این فصل — طبق طبقه‌بندی official-ledger.js
    var allOpexInSeason = getData('ptf_crm_opex').filter(function (o) {
      if (o.status === 'void' || o.st === 'void') return false;
      var parsed = parseYearMonth(o.month || o.dateFa || o.t || '');
      if (String(parsed.y) !== String(year)) return false;
      return inSeason(parsed.m);
    });
    var opexList = allOpexInSeason.filter(function (o) { return ledgerOfOpexSafe(o) === 'official'; });
    var opexUnclassified = allOpexInSeason.filter(function (o) { return ledgerOfOpexSafe(o) === 'unclassified'; });
    
    var opexTotal = opexList.reduce(function (sum, o) { return sum + (+o.amt || 0); }, 0);
    
    // ۴. استخراج هزینه‌های تنخواه در این فصل — طبق تصمیم کارفرما، همه‌ی دسته‌ها
    //    (از جمله «سایر») قابل‌قبول مالیاتی محسوب می‌شوند؛ بدون فیلتر دسته
    //    (ر.ک: window.PTF_PETTY_TAX_DEDUCTIBLE_CATS در petty.js — گام ۶).
    var pettyList = getData('ptf_crm_petty').filter(function (p) {
      if (p.st === 'void' || p.status === 'void') return false;
      var parsed = parseYearMonth(p.month || p.iso || p.t || '');
      if (String(parsed.y) !== String(year)) return false;
      return inSeason(parsed.m);
    });
    
    var pettyTotal = pettyList.reduce(function (sum, p) { return sum + (+p.amt || 0); }, 0);
    
    // ۵. محاسبات موازنه فصلی به طور کامل
    var totalExpenses = opexTotal + pettyTotal;
    var requiredPurchaseTotal = Math.round(salesTotal * (1 - margin / 100));
    var gap = Math.max(0, requiredPurchaseTotal - purchaseTotal - totalExpenses);
    
    // ۶. فاز ۲ / گام ۶: تشخیص کالاهای «بدون خرید مستند» با ماژول تطبیق موجود
    //    (procurement-link.js) — به‌جای فرض قبلی که همه‌ی اقلام فروش رسمی را
    //    بدون بررسی «آیا خرید واقعی دارند یا نه» در تخصیص گپ شرکت می‌داد.
    var offers = getData('ptf_crm_offers');
    var cmps = getData('ptf_crm_buycmp');
    var canResolve = typeof window.ptfResolveProcurementAcross === 'function' && typeof window.ptfResolvePurchaseForLine === 'function';
    var noInvoiceItems = []; // اقلام بدون خرید مستند → کاندید تخصیص گپ
    var ambiguousItems = []; // تطبیق مبهم → نیازمند بررسی دستی، وارد تخصیص نمی‌شود
    
    invs.forEach(function (inv) {
      var o = offers.filter(function (x) { return x.no === inv.offerNo; })[0];
      if (!o || !o.items) return;
      var relatedCmps = cmps.filter(function (c) { return c.inqNo === o.inqNo || c.inqNo === o.no; });
      /* AUD-12 (گزارش کارفرما ۱۴۰۵/۰۵/۰۷ — crm/AUDIT-FINANCIAL-SYSTEM-2026-07-29.md،
         تصمیم صریح کارفرما: «بر مبنای مبلغ واقعی ثبت‌شده در فاکتور رسمی»):
         قبلاً sellPrice هر قلم مستقل و بدون ارتباط با inv.amount، مستقیماً
         از روی خود پیش‌فاکتور (qty×price×fxRateRef) از نو محاسبه می‌شد؛ یعنی
         حتی وقتی «جمع فروش فصل» بالای گزارش از inv.amount واقعی می‌آمد،
         جدول تخصیص گپ می‌توانست عدد کاملاً متفاوتی (حتی نجومی، اگر فاکتور
         رسمی اشتباه ثبت شده بود) برای همان آیتم نشان دهد — دقیقاً همان چیزی
         که کارفرما گزارش داد. راه‌حل: سهم هر قلم از inv.amount واقعی به
         نسبت وزن خام آن قلم در کل پیش‌فاکتور محاسبه می‌شود؛ یعنی جمع sellPrice
         تمام اقلام یک فاکتور همیشه دقیقاً برابر inv.amount همان فاکتور
         می‌ماند — با تخفیف/چندقلمی‌بودن/ویرایش دستی هم سازگار می‌ماند. */
      var offerRawTotal = o.items.reduce(function (s, x) { return s + (+x.qty || 0) * (+x.price || 0); }, 0);
      o.items.forEach(function (it) {
        var rawWeight = (+it.qty || 1) * (+it.price || 0);
        var sellPrice = offerRawTotal > 0 ? (+inv.amount || 0) * (rawWeight / offerRawTotal) : 0;
        var row = { name: it.name || it.desc || '', offerNo: o.no, sellPrice: sellPrice };
        if (!canResolve || !relatedCmps.length) {
          // منبع خرید/استعلام برای این پیشنهاد اصلاً ثبت نشده — طبق رفتار محافظه‌کارانه،
          // مثل قبل، بدون خرید مستند فرض می‌شود (چون امکان بررسی وجود ندارد).
          noInvoiceItems.push(row);
          return;
        }
        var linkResult = window.ptfResolveProcurementAcross(it, relatedCmps, { offerNo: o.no });
        if (!linkResult.ok) {
          if (linkResult.reason === 'ambiguous-record' || linkResult.reason === 'ambiguous') { ambiguousItems.push(row); return; }
          noInvoiceItems.push(row); // 'unmatched' یا سایر حالات → بدون خرید مستند
          return;
        }
        var purchaseResult = window.ptfResolvePurchaseForLine(linkResult.record, linkResult.line);
        if (purchaseResult.ok) return; // خرید واقعی مستند دارد → از تخصیص گپ کنار گذاشته می‌شود
        if (purchaseResult.reason === 'ambiguous-purchase') { ambiguousItems.push(row); return; }
        noInvoiceItems.push(row); // 'unmatched' یا 'no-provenance' → بدون خرید مستند
      });
    });
    
    var totalWeight = noInvoiceItems.reduce(function (sum, x) { return sum + x.sellPrice; }, 0);
    var allocatedRows = '';
    
    if (gap > 0 && totalWeight > 0) {
      noInvoiceItems.forEach(function (it, idx) {
        var allocatedShare = Math.round(gap * (it.sellPrice / totalWeight));
        it._allocated = allocatedShare; // برای دکمه‌ی ثبت مستقیم (گام ۶)
        allocatedRows += '<tr>' +
          '<td>' + toFaDigits(idx + 1) + '</td>' +
          '<td class="text-right">' + escP(it.name) + '</td>' +
          '<td>' + toFaDigits(Math.round(it.sellPrice).toLocaleString('fa-IR')) + ' ریال</td>' +
          '<td style="color:#b45309;font-weight:bold">' + toFaDigits(allocatedShare.toLocaleString('fa-IR')) + ' ریال</td>' +
          '<td><button class="bt bt-o" style="padding:3px 9px;font-size:11px;color:#7c2d12;border-color:#f59e0b" onclick="ptfTaxPlannerRegisterCover(' + idx + ')">📝 ثبت به‌عنوان فاکتور پوششی</button></td>' +
          '</tr>';
      });
      window._tpNoInvoiceItems = noInvoiceItems; // نگهداری موقت برای دکمه‌ی ثبت (فقط در حافظه، ذخیره نمی‌شود)
      window._tpCoverContext = { year: year, season: season };
    } else {
      allocatedRows = '<tr><td colspan="5" style="color:#94a3b8;text-align:center">هیچ کالا یا گپی در این بازه جهت تخصیص وجود ندارد.</td></tr>';
    }
    
    // هشدار رکوردهای «نامشخص» — طبق طراحی فاز ۲ / گام ۶
    var unclassifiedWarning = '';
    var unclassifiedCount = opexUnclassified.length + sfInvsUnclassified.length;
    if (unclassifiedCount) {
      var unclassifiedAmt = opexUnclassified.reduce(function (s, o) { return s + (+o.amt || 0); }, 0) + sfInvsUnclassified.reduce(function (s, i) { return s + (+i.amountIrr || +i.amount || 0); }, 0);
      unclassifiedWarning = '<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:9px 12px;margin-top:10px;font-size:12px;color:#9a3412">⚠️ <b>' + unclassifiedCount + ' مورد</b> (' + unclassifiedAmt.toLocaleString('fa-IR') + ' ریال) نوع رسمی/غیررسمی‌شان مشخص نیست و در این محاسبه لحاظ نشده‌اند — لطفاً قبل از اتکا به این گزارش، این رکوردها را در تب «کیفیت داده» تعیین‌تکلیف کنید.</div>';
    }
    var ambiguousWarning = ambiguousItems.length
      ? '<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:9px 12px;margin-top:10px;font-size:12px;color:#1e40af">ℹ️ ' + ambiguousItems.length + ' قلم دارای تطبیق خرید/استعلام مبهم است و در تخصیص گپ لحاظ نشد — برای بررسی به گزارش «تطبیق سراسری خرید/استعلام» (procurement-link.js) مراجعه کنید.</div>'
      : '';
    
    var seasonNames = { '1': 'بهار', '2': 'تابستان', '3': 'پاییز', '4': 'زمستان' };
    el.innerHTML = '<div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:10px;padding:15px;line-height:1.8;font-size:13px">' +
      '📋 <b>گزارش تراز و برنامه‌ریزی فام (فصل ' + seasonNames[season] + ' ' + year + '):</b><br>' +
      '• مجموع فروش رسمی ثبت شده در مودیان: <b style="color:#0f172a">' + salesTotal.toLocaleString('fa-IR') + ' ریال</b><br>' +
      '• مجموع خرید رسمی ثبت شده (شامل فاکتور پوششی/صوری در صورت وجود): <b style="color:#0f172a">' + purchaseTotal.toLocaleString('fa-IR') + ' ریال</b><br>' +
      '• مجموع هزینه‌های جاری رسمی (OPEX): <b style="color:#0f172a">' + opexTotal.toLocaleString('fa-IR') + ' ریال</b><br>' +
      '• مجموع هزینه‌های تنخواه این فصل <small style="color:#64748b">(همه‌ی دسته‌ها قابل‌قبول مالیاتی فرض می‌شوند)</small>: <b style="color:#0f172a">' + pettyTotal.toLocaleString('fa-IR') + ' ریال</b><br>' +
      '• سقف خرید رسمی مورد نیاز (بر مبنای ' + margin + '٪ سود رسمی): <b style="color:#0e7490">' + requiredPurchaseTotal.toLocaleString('fa-IR') + ' ریال</b><br>' +
      '• <b>میزان کسری فاکتور خرید رسمی هدف که باید بخرید: <span style="color:#dc2626;font-size:15px">' + gap.toLocaleString('fa-IR') + ' ریال</span></b>' +
      '</div>' +
      unclassifiedWarning + ambiguousWarning +
      (gap > 0 ?
      '<h5 style="margin:15px 0 8px 0;font-size:13px;color:#b45309">🎯 کالاهای بدون خرید مستند در این فصل (پیشنهاد خرید فاکتور رسمی به نسبت سهم فروش جهت پوشش ممیزی):</h5>' +
      '<div class="tb2"><table><thead><tr>' +
      '<th>ردیف</th><th>نام کالا</th><th>ارزش فروش رسمی</th><th>مبلغ فاکتور خرید رسمی پیشنهادی</th><th></th>' +
      '</tr></thead><tbody>' + allocatedRows + '</tbody></table></div>' : '');
  };

  /* فاز ۲ / گام ۶: ثبت مستقیم مبلغ تخصیص‌یافته به‌عنوان فاکتور پوششی —
     فرم supplier-finance.js (گام ۵) را با مقادیر پیش‌پرشده باز می‌کند.
     خودِ این تابع هیچ رکوردی ذخیره نمی‌کند؛ فقط پل بین دو ابزار موجود است. */
  window.ptfTaxPlannerRegisterCover = function (idx) {
    var items = window._tpNoInvoiceItems || [];
    var it = items[idx];
    if (!it) { alert('این ردیف دیگر معتبر نیست — لطفاً دوباره محاسبه کنید.'); return; }
    if (typeof isSenior === 'function' && !isSenior()) { alert('⛔ ثبت فاکتور پوششی/صوری فقط برای مدیران ارشد مجاز است'); return; }
    if (typeof window.slNewInvoice !== 'function' && typeof window.slInvoiceForm !== 'function') {
      alert('⛔ ماژول حساب تأمین‌کنندگان بارگذاری نشده است.');
      return;
    }
    var ctx = window._tpCoverContext || {};
    var prefill = {
      amount: Math.round(it._allocated || 0),
      note: 'تخصیص‌شده توسط داشبورد موازنه فصلی برای پوشش کالای «' + (it.name || '') + '» (پیشنهاد ' + (it.offerNo || '') + ')',
      cover: true,
      coverPeriod: { year: ctx.year || '', season: ctx.season || '' }
    };
    ptfDialog({
      title: '🧾 انتخاب تأمین‌کننده برای فاکتور پوششی',
      body: 'مبلغ (' + prefill.amount.toLocaleString('fa-IR') + ' ریال) از داشبورد موازنه فصلی پیش‌پر می‌شود؛ درصد کارمزد و تاییدیه را در فرم بعدی تکمیل کنید.',
      fields: [{ id: 'sup', label: 'تأمین‌کننده *', type: 'select', optionsHtml: '<option value="">— انتخاب کنید —</option>' + (getData('ptf_crm_suppliers') || []).map(function (s) { return '<option value="' + escP(s.cd) + '">' + escP(s.co || s.cd) + '</option>'; }).join(''), required: true }],
      okText: 'ادامه',
      onOk: function (v) {
        if (!v.sup) { alert('تأمین‌کننده را انتخاب کنید'); return; }
        window.slInvoiceForm(v.sup, prefill);
      }
    });
  };

  // تزریق به انتهای هاب مالی پروداکشن
  var oldPetty = window.buildPetty;
  if (typeof oldPetty === 'function') {
    window.buildPetty = function () {
      var base = oldPetty();
      var plannerHtml = (typeof window.ptfTaxPlannerHtml === 'function') ? window.ptfTaxPlannerHtml() : '';
      return base + plannerHtml;
    };
  }

function appendStep2() {
  // body intentionally blank — placeholder while awaiting next write
}

/* ========================================================================
   ARENA-2026-08-17 / گام ۲ و ۳: صدور/ویرایش قیمت قلم‌به‌قلم + حالت تجمیعی چند پیشنهاد
   — الزام ۱ (پیش‌فرض قیمت = CO)، الزام ۳ (صدور در پرونده، تک‌پیشنهاد + تجمیعی)
   — طراحی: دیالوگ یکپارچه با جدول اقلام قابل ویرایش (تعداد، قیمت واحد، حذف، افزودن سفارشی)
   — سپس فراخوان unofficialInvoicePrintCases برای صدور نهایی
   — مجوز: senior یا accountant؛ پرونده در مرحله ≥ ۷ (پس از تحویل کارفرما)
   ======================================================================== */

// ===== Helper: گردآوری پیشنهادهای متصل + انتخاب مبدأ قیمت =====
window.unofficialInvoiceCollectOffers = function (deal) {
  if (!deal) return { offers: [], priceSourceOffer: null, hasFinancialOffer: false };
  var offers = [];
  if (typeof window.ptfSalesFileOffers === 'function') {
    offers = window.ptfSalesFileOffers(deal) || [];
  }
  offers = (offers || []).filter(function (o) {
    return o && o.no && (o.items || []).length;
  });
  // مبدأ قیمت: اولویت با CO (پیشنهاد مالی). اگر نبود، TC یا TO یا اولین پیشنهاد.
  var priceSourceOffer = null;
  for (var i = 0; i < offers.length; i++) {
    if (offers[i].kind === 'CO') { priceSourceOffer = offers[i]; break; }
  }
  if (!priceSourceOffer) {
    for (var j = 0; j < offers.length; j++) {
      if (offers[j].kind === 'TC') { priceSourceOffer = offers[j]; break; }
    }
  }
  if (!priceSourceOffer && offers.length) priceSourceOffer = offers[0];

  var hasFinancialOffer = !!offers.filter(function (o) { return o.kind === 'CO'; })[0];

  return {
    offers: offers,
    priceSourceOffer: priceSourceOffer,
    hasFinancialOffer: hasFinancialOffer
  };
};

// ===== Helper: عکس‌برداری از اقلام یک پیشنهاد (deep-clone قلم‌به‌قلم) =====
window.unofficialInvoiceSnapshotLines = function (offer) {
  if (!offer || !offer.items) return [];
  return (offer.items || []).map(function (it, idx) {
    var qty = +it.qty || 0;
    var price = +it.price || 0;
    return {
      idx: idx,
      name: it.name || '',
      desc: it.desc || '',
      unit: it.unit || '',
      pcode: it.pcode || it.prodCd || it.productCd || '',
      qtyOrig: qty,
      priceOrig: price,
      qty: qty,
      price: price,
      lineTotal: qty * price,
      fromOffer: offer.no || '',
      fromKind: offer.kind || ''
    };
  });
};

// ===== Helper: ترکیب اقلام از چند پیشنهاد (برای حالت تجمیعی) =====
window.unofficialInvoiceConsolidateLines = function (selectedOffers, priceSourceOffer) {
  var lines = [];
  var seen = {};
  (selectedOffers || []).forEach(function (o) {
    if (!o || !o.items) return;
    o.items.forEach(function (it, idx) {
      var key = String(it.pcode || it.name || it.desc || (o.no + '|' + idx));
      if (seen[key]) return;
      seen[key] = true;
      var qty = +it.qty || 0;
      var price = +it.price || 0;
      // پیش‌فرض قیمت از خود پیشنهاد مبدأ؛ اگر CO وجود دارد، بعداً کاربر می‌تواند ویرایش کند.
      // هیچ «price copying» خودکار بین پیشنهادها؛ کاربر در دیالوگ اصلاح می‌کند.
      lines.push({
        idx: idx,
        name: it.name || '',
        desc: it.desc || '',
        unit: it.unit || '',
        pcode: it.pcode || '',
        qtyOrig: qty,
        priceOrig: price,
        qty: qty,
        price: price,
        lineTotal: qty * price,
        fromOffer: o.no || '',
        fromKind: o.kind || ''
      });
    });
  });
  return lines;
};

// ===== حالت سراسری دیالوگ (برای توابع کنترلی) =====
var _unInvState = null;

// ===== باز کردن دیالوگ سازندهٔ فاکتور =====
window.unofficialInvoiceBuilderOpen = function (dealCd) {
  // گارد نقش
  var _role = (typeof curRole === 'function') ? curRole() : '';
  var _isSnr = (typeof isSenior === 'function') && isSenior();
  if (!_isSnr && _role !== 'accountant') {
    if (typeof alert === 'function') alert('⛔ صدور صورتحساب غیررسمی فقط برای مدیران ارشد یا حسابدار مجاز است');
    return;
  }
  /* UI-01 (v34.7.20): تطبیق متقارن شناسهٔ پرونده.
     ریشهٔ باگ: پرونده دو شناسه دارد — `_id` سروری و `cd` محلی. فراخوان کشوی پرونده
     (`crm/salesfiles.js`) مقدار `r.cd` می‌فرستاد ولی این‌جا اول `_id` خوانده و با ورودی
     مقایسه می‌شد؛ برای هر پرونده‌ای که شناسهٔ سروری گرفته بود (عملاً همهٔ پرونده‌های v35)
     تطبیق شکست می‌خورد و پیام «پرونده فروش یافت نشد» ظاهر می‌شد و دیالوگ صدور باز نمی‌شد.
     اکنون هر دو شناسه مستقل بررسی می‌شوند تا هر دو مسیر فراخوان (قدیمی و جدید) کار کنند.
     مرجع: ARENA-RCA-UNOFFICIAL-INVOICE-CASE-NOT-FOUND-2026-08-17.md | گام B1 نقشهٔ فازبندی */
  var _needle = String(dealCd || '').trim();
  var _deal = (getData('ptf_crm_deals') || []).filter(function (x) {
    if (!x || !_needle) return false;
    return String(x._id || '') === _needle || String(x.cd || '') === _needle;
  })[0];
  if (!_deal) {
    if (typeof alert === 'function') alert('⛔ پرونده فروش یافت نشد');
    return;
  }
  var _stg = (typeof sfStageOf === 'function') ? sfStageOf(_deal) : 0;
  if (_stg < 7) {
    if (typeof alert === 'function') alert('🔒 صدور صورتحساب غیررسمی پس از تحویل کارفرما فعال می\u200cشود (مرحلهٔ فعلی: ' + _stg + ' از ۱۲).');
    return;
  }
  var collected = window.unofficialInvoiceCollectOffers(_deal);
  if (!collected.offers.length) {
    if (typeof alert === 'function') alert('⛔ هیچ پیشنهاد دارای اقلام به این پرونده متصل نیست.');
    return;
  }

  // حذف دیالوگ قبلی اگر باز باشد
  document.querySelectorAll('#unInvBuilderDlg').forEach(function (el) { el.remove(); });

  var _co = collected.priceSourceOffer;
  var initialLines = window.unofficialInvoiceSnapshotLines(_co);

  // ذخیره حالت سراسری
  _unInvState = {
    deal: _deal,
    collected: collected,
    mode: 'single',
    selectedOfferNos: _co ? [_co.no] : [collected.offers[0].no],
    lines: initialLines,
    cCurrency: (_co && _co.currency) ? _co.currency : 'IRR',
    cRate: (_co && +_co.fxRateRef) > 0 ? (+_co.fxRateRef) : 1
  };

  var _dlg = document.createElement('div');
  _dlg.id = 'unInvBuilderDlg';
  _dlg.className = 'md-b';
  _dlg.style.cssText = 'display:grid;z-index:2800;';
  _dlg.setAttribute('data-deal-cd', (window.PTF && typeof window.PTF.id === 'function') ? window.PTF.id(_deal) : (_deal._id || _deal.cd || '')); /* v34.7.28: شناسهٔ متعارف */
  _dlg.onclick = function (e) { if (e.target === _dlg) _dlg.remove(); };
  _dlg.innerHTML = buildUnInvBuilderHtml(_unInvState);
  document.body.appendChild(_dlg);
  bindUnInvBuilderHandlers(_dlg);
  window.unofficialInvoiceBuilderRecalc();
};

// ===== ساخت HTML داخلی دیالوگ =====
window.buildUnInvBuilderHtml = function (st) {
  var kindLabels = { CO: 'پیشنهاد مالی', TC: 'پیشنهاد فنی-مالی', TO: 'پیشنهاد فنی' };
  var _co = st.collected.priceSourceOffer;
  var _coKindLabel = kindLabels[_co ? _co.kind : ''] || '—';

  var _coWarn = '';
  if (!st.collected.hasFinancialOffer && _co && _co.kind !== 'CO') {
    _coWarn = '<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:8px 11px;margin-bottom:10px;font-size:11.5px;color:#92400e;">' +
      '⚠️ پیشنهاد مالی (CO) در پرونده یافت نشد (یا فاقد اقلام است). قیمت\u200cهای پیش\u200cفرض از همین پیشنهاد لود شده\u200cاند. توصیه می\u200cشود ابتدا یک CO با قیمت\u200cهای واقعی ثبت کنید.</div>';
  }

  // چک‌باکس‌های پیشنهاد برای انتخاب در حالت تجمیعی
  var _offersCheckHtml = st.collected.offers.map(function (o) {
    var kindBadge = '<span class="bd" style="background:#dbeafe;color:#1e40af;border-radius:6px;padding:1px 6px;font-size:10.5px;">' + escP(kindLabels[o.kind] || o.kind) + '</span>';
    var coBadge = (o.kind === 'CO') ? ' <span class="bd" style="background:#fef3c7;color:#92400e;border-radius:6px;padding:1px 6px;font-size:10.5px;">⭐ مبدأ قیمت</span>' : '';
    var checkedFlag = (st.selectedOfferNos.indexOf(o.no) >= 0) ? ' checked' : '';
    return '<label style="display:flex;align-items:center;gap:6px;padding:6px 8px;border-bottom:1px dashed #e2e8f0;cursor:pointer;font-size:12.5px;">' +
      '<input type="checkbox" class="un-offer-row-chk" data-offer="' + escP(o.no) + '"' + checkedFlag + '>' +
      '<b dir="ltr" style="font-size:12px;">' + escP(o.no) + '</b> ' + kindBadge + coBadge +
      ' <span style="color:#94a3b8;font-size:11px;">(' + ((o.items || []).length) + ' قلم)</span></label>';
  }).join('');

  function unitFa(u) {
    if (typeof window.translateUnitFa === 'function') return window.translateUnitFa(u);
    return String(u || 'عدد');
  }

  var _rows = buildUnInvBuilderRows(st.lines);

  var _html = '' +
    '<div class="md" style="max-width:940px;max-height:94vh;overflow:auto;">' +
    '<h3 style="margin:0 0 10px;color:#1e293b;font-size:15.5px;">🧾 صدور صورتحساب پرداخت غیررسمی — ' + escP(st.deal.inqNo || st.deal.cd) + '</h3>' +
    '<div style="font-size:11.5px;color:#475569;margin-bottom:8px;">پیشنهاد مبدأ قیمت: <b>' + escP(_co ? _co.no : '—') + '</b> ' +
      '<span class="bd" style="background:#fef3c7;color:#92400e;padding:1px 6px;border-radius:6px;font-size:10px;">⭐ CO مرجع</span>' +
      ' <span style="color:#94a3b8;">(' + escP(_coKindLabel) + ')</span></div>' +
    _coWarn +
    '<div class="fr" style="margin-bottom:10px;gap:14px;align-items:center;background:#f8fafc;padding:8px 12px;border-radius:10px;">' +
      '<label style="display:flex;gap:5px;align-items:center;font-size:12.5px;font-weight:800;cursor:pointer;"><input type="radio" name="unMode" value="single" checked> ◯ تک\u200cپیشنهاد</label>' +
      '<label style="display:flex;gap:5px;align-items:center;font-size:12.5px;font-weight:800;cursor:pointer;"><input type="radio" name="unMode" value="consolidated"> ◯ تجمیعی چند پیشنهاد</label>' +
      '<span style="background:#fff;border:1px solid #cbd5e1;border-radius:8px;padding:2px 8px;color:#475569;font-size:11px;">📑 ' + st.collected.offers.length + ' پیشنهاد متصل</span>' +
    '</div>' +
    '<div id="unSingleBox">' +
      '<div class="fld"><label>پیشنهاد مبدأ (پیش\u200cفرض = اولین CO)</label><select id="unSingleOffer" style="width:100%;padding:7px;border:1px solid #cbd5e1;border-radius:8px;">' +
      st.collected.offers.map(function (o) {
        var sel = (o.no === _co.no) ? ' selected' : '';
        return '<option value="' + escP(o.no) + '"' + sel + '>' + escP(o.no) + ' — ' + escP(kindLabels[o.kind] || o.kind) + ' (' + ((o.items || []).length) + ' قلم)</option>';
      }).join('') +
      '</select></div>' +
    '</div>' +
    '<div id="unConsolidatedBox" style="display:none;">' +
      '<div class="fld"><label>پیشنهادهای انتخاب\u200cشده (✓ برای تجمیع علامت بزنید)</label>' +
      '<div class="tb2" style="border:1px solid #e2e8f0;border-radius:8px;background:#fff;padding:4px 8px;max-height:130px;overflow:auto;">' + _offersCheckHtml + '</div>' +
      '</div>' +
    '</div>' +
    '<div class="fld" style="margin-top:10px;"><label>🛒 اقلام فاکتور (پیش\u200cفرض از <b>' + escP(_co ? _co.no : '—') + '</b> · قیمت هر قلم قابل ویرایش)</label>' +
      '<div style="max-height:380px;overflow:auto;border:1px solid #e2e8f0;border-radius:8px;">' +
      '<table style="width:100%;font-size:12.5px;border-collapse:collapse;">' +
      '<thead><tr style="background:#334155;color:#fff;">' +
      '<th style="padding:7px;font-size:11.5px;width:6%;">عملیات</th>' +
      '<th style="padding:7px;font-size:11.5px;width:14%;">منبع</th>' +
      '<th style="padding:7px;font-size:11.5px;">شرح</th>' +
      '<th style="padding:7px;font-size:11.5px;width:9%;">واحد</th>' +
      '<th style="padding:7px;font-size:11.5px;width:10%;">تعداد</th>' +
      '<th style="padding:7px;font-size:11.5px;width:18%;">قیمت واحد</th>' +
      '<th style="padding:7px;font-size:11.5px;width:15%;">قیمت کل</th>' +
      '</tr></thead>' +
      '<tbody id="unRowsTbody">' + _rows + '</tbody>' +
      '</table>' +
      '</div>' +
      '<div style="margin-top:7px;display:flex;gap:7px;flex-wrap:wrap;">' +
      '<button type="button" class="bt bt-o" onclick="unofficialInvoiceBuilderAddCustomRow()">\uff0b افزودن قلم سفارشی</button>' +
      '<button type="button" class="bt bt-o" onclick="unofficialInvoiceBuilderResetFromOffer()">♻️ بازنشانی از پیشنهاد</button>' +
      '</div>' +
    '</div>' +
    '<div style="margin-top:10px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">' +
      '<div class="fld"><label>تخفیف اختیاری (مبلغ یا درصد)</label><input id="unDiscInput" type="text" placeholder="مثال: 5% یا 500000" oninput="unofficialInvoiceBuilderRecalc()" style="direction:ltr;"></div>' +
      '<div class="fld"><label>شماره حساب / شبا (اختیاری)</label><input id="unBankInput" type="text" placeholder="مثال: IR..."></div>' +
      (st.cCurrency !== 'IRR' ?
        '<div class="fld"><label>نرخ تسعیر روز صدور (ریال/' + escP(st.cCurrency) + ')</label><input id="unRateInput" type="number" dir="ltr" value="' + st.cRate + '" oninput="unofficialInvoiceBuilderRecalc()" style="direction:ltr;"></div>' :
        '<div></div>'
      ) +
    '</div>' +
    '<div id="unResultBox" style="margin-top:10px;background:#f0fdf4;border:1px solid #86efac;border-radius:10px;padding:10px;font-size:13px;color:#166534;line-height:1.7;"></div>' +
    '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px;">' +
    '<button class="bt bt-o" onclick="document.getElementById(\'unInvBuilderDlg\').remove()">❌ انصراف</button>' +
    '<button class="bt" style="background:#0e7490;color:#fff;font-weight:800;" onclick="unofficialInvoiceBuilderSubmit()">✅ تأیید و صدور</button>' +
    '</div>' +
    '</div>';
  return _html;
};

window.buildUnInvBuilderRows = function (lines) {
  var unitFaFn = typeof window.translateUnitFa === 'function' ? window.translateUnitFa : function (u) { return String(u || 'عدد'); };
  return (lines || []).map(function (ln) {
    var pid = 'un-row-' + (ln.idx) + '-' + Math.random().toString(36).slice(2, 7);
    ln._pid = pid;
    return '<tr data-row-id="' + pid + '" data-from-offer="' + escP(ln.fromOffer || '') + '" class="un-row" style="border-bottom:1px solid #f1f5f9;">' +
      '<td style="padding:4px;text-align:center;"><button type="button" class="ba" style="color:#dc2626;padding:1px 5px;font-size:11px;" onclick="unofficialInvoiceBuilderRemoveRow(\'' + pid + '\')">حذف</button></td>' +
      '<td style="padding:4px;font-size:10.5px;color:#475569;text-align:center;" dir="ltr">' + escP(ln.fromOffer || '—') + '<br><small style="color:#94a3b8;">' + escP(ln.fromKind || '') + '</small></td>' +
      '<td style="padding:4px;font-size:12px;"><b>' + escP(ln.name || '—') + '</b>' + (ln.desc && ln.desc !== ln.name ? '<br><small style="color:#94a3b8;">' + escP(ln.desc) + '</small>' : '') + '</td>' +
      '<td style="padding:4px;text-align:center;font-size:11px;">' + escP(unitFaFn(ln.unit)) + '</td>' +
      '<td style="padding:4px;text-align:center;"><input type="number" min="0" step="any" data-fld="qty" data-pid="' + pid + '" value="' + (+ln.qty || 0) + '" style="direction:ltr;padding:4px;width:70px;border:1px solid #cbd5e1;border-radius:6px;text-align:center;" oninput="unofficialInvoiceBuilderRecalc()"></td>' +
      '<td style="padding:4px;text-align:center;"><input type="number" min="0" step="any" data-fld="price" data-pid="' + pid + '" value="' + (+ln.price || 0) + '" style="direction:ltr;padding:4px;width:150px;border:1px solid #cbd5e1;border-radius:6px;text-align:center;" oninput="unofficialInvoiceBuilderRecalc()"></td>' +
      '<td style="padding:4px;text-align:left;direction:ltr;" class="row-total" data-pid="' + pid + '">' + ((+ln.qty || 0) * (+ln.price || 0)).toLocaleString('en-US') + '</td>' +
      '</tr>';
  }).join('');
};

// ===== اتصال event handlers =====
window.bindUnInvBuilderHandlers = function (_dlg) {
  // mode change
  _dlg.querySelectorAll('input[name="unMode"]').forEach(function (inp) {
    inp.onchange = function () {
      applyUnInvBuilderMode(_dlg);
      window.unofficialInvoiceBuilderRecalc();
    };
  });
  // single-offer change -> reload
  var _singleSel = _dlg.querySelector('#unSingleOffer');
  if (_singleSel) _singleSel.onchange = function () { reloadUnInvBuilderFromSelection(_dlg); };
  // checkbox change -> reload
  _dlg.querySelectorAll('.un-offer-row-chk').forEach(function (chk) {
    chk.onchange = function () { reloadUnInvBuilderFromSelection(_dlg); };
  });
  // initial mode apply
  applyUnInvBuilderMode(_dlg);
};

window.applyUnInvBuilderMode = function (_dlg) {
  var _mode = 'single';
  _dlg.querySelectorAll('input[name="unMode"]').forEach(function (inp) {
    if (inp.checked) _mode = inp.value;
  });
  _unInvState.mode = _mode;
  if (_mode === 'consolidated') {
    _dlg.querySelector('#unSingleBox').style.display = 'none';
    _dlg.querySelector('#unConsolidatedBox').style.display = '';
  } else {
    _dlg.querySelector('#unSingleBox').style.display = '';
    _dlg.querySelector('#unConsolidatedBox').style.display = 'none';
  }
};

window.reloadUnInvBuilderFromSelection = function (_dlg) {
  var _mode = _unInvState.mode;
  var __lines = [];
  if (_mode === 'single') {
    var _singleNo = _dlg.querySelector('#unSingleOffer').value;
    var _singleOffer = _unInvState.collected.offers.filter(function (o) { return o.no === _singleNo; })[0]
      || _unInvState.collected.priceSourceOffer
      || _unInvState.collected.offers[0];
    __lines = window.unofficialInvoiceSnapshotLines(_singleOffer);
    _unInvState.selectedOfferNos = [_singleOffer.no];
  } else {
    var _checkedNos = Array.from(_dlg.querySelectorAll('.un-offer-row-chk:checked')).map(function (c) { return c.getAttribute('data-offer'); });
    if (!_checkedNos.length) {
      // پیشنهاد مبدأ به\u200cطور پیش\u200cفرض انتخاب\u200cشده باقی بماند
      _checkedNos = [_unInvState.collected.priceSourceOffer.no];
    }
    _unInvState.selectedOfferNos = _checkedNos;
    var _sel = _unInvState.collected.offers.filter(function (o) { return _checkedNos.indexOf(o.no) >= 0; });
    __lines = window.unofficialInvoiceConsolidateLines(_sel, _unInvState.collected.priceSourceOffer);
  }
  _unInvState.lines = __lines;
  var _tbody = _dlg.querySelector('#unRowsTbody');
  _tbody.innerHTML = window.buildUnInvBuilderRows(__lines);
  window.unofficialInvoiceBuilderRecalc();
};

// ===== محاسبهٔ زندهٔ جمع کل + تخفیف + نمایش در result box =====
window.unofficialInvoiceBuilderRecalc = function () {
  if (!_unInvState) return;
  var _dlg = document.getElementById('unInvBuilderDlg');
  if (!_dlg) return;
  var total = 0;
  _dlg.querySelectorAll('#unRowsTbody tr').forEach(function (tr) {
    var pid = tr.getAttribute('data-row-id');
    var qtyEl = _dlg.querySelector('input[data-fld="qty"][data-pid="' + pid + '"]');
    var prEl = _dlg.querySelector('input[data-fld="price"][data-pid="' + pid + '"]');
    var q = qtyEl ? (+qtyEl.value || 0) : 0;
    var p = prEl ? (+prEl.value || 0) : 0;
    var rowTotal = q * p;
    var trTotalEl = _dlg.querySelector('.row-total[data-pid="' + pid + '"]');
    if (trTotalEl) trTotalEl.textContent = rowTotal.toLocaleString('en-US');
    total += rowTotal;
    // update state
    var ln = _unInvState.lines.filter(function (l) { return l._pid === pid; })[0];
    if (ln) { ln.qty = q; ln.price = p; ln.lineTotal = rowTotal; }
  });

  var _discInput = (_dlg.querySelector('#unDiscInput') || {}).value || '';
  var _discVal = 0; var _discPct = null;
  if (_discInput.trim()) {
    var _clean = _discInput.replace(/[٪%]/g, '');
    if (_discInput.indexOf('%') >= 0 || _discInput.indexOf('٪') >= 0) {
      _discPct = parseFloat(_clean) || 0;
      _discVal = Math.round(total * _discPct / 100);
    } else {
      _discVal = parseFloat(_clean.replace(/,/g, '')) || 0;
    }
  }
  var _net = Math.max(0, total - _discVal);

  var _cur = _unInvState.cCurrency;
  var _rateEl = _dlg.querySelector('#unRateInput');
  var _rate = _rateEl ? (+_rateEl.value || _unInvState.cRate) : _unInvState.cRate;
  var _totalIrr = _cur === 'IRR' ? total : Math.round(total * _rate);
  var _discIrr = _cur === 'IRR' ? _discVal : Math.round(_discVal * _rate);
  var _netIrr = _cur === 'IRR' ? _net : Math.round(_net * _rate);

  var _rateHtml = (_cur !== 'IRR') ? ' | <small style="color:#0e7490;">نرخ تسعیر: ' + _rate.toLocaleString('fa-IR') + ' ریال/' + escP(_cur) + ' ⇒ مبلغ ریالی: ' + _totalIrr.toLocaleString('fa-IR') + ' ریال</small>' : '';

  _dlg.querySelector('#unResultBox').innerHTML =
    '<b>📊 جمع کل اقلام (به ارز سند):</b> ' + total.toLocaleString('en-US') + ' ' + escP(_cur) + _rateHtml +
    '<br><b>🏷️ تخفیف:</b> ' + (_discVal ? _discVal.toLocaleString('en-US') + ' ' + escP(_cur) + (_discPct !== null ? ' (' + _discPct.toLocaleString('en-US') + '٪)' : '') : '—') +
    '<br><b>✅ خالص قابل پرداخت (به ارز سند):</b> ' + (_cur === 'IRR' ? '' : '').toString() + _net.toLocaleString('en-US') + ' ' + escP(_cur) +
    (_cur !== 'IRR' ? ' ⇒ ' + _netIrr.toLocaleString('fa-IR') + ' ریال' : '');
};

// ===== حذف یک قلم =====
window.unofficialInvoiceBuilderRemoveRow = function (pid) {
  if (!_unInvState) return;
  _unInvState.lines = _unInvState.lines.filter(function (l) { return l._pid !== pid; });
  var _tr = document.querySelector('#unInvBuilderDlg tr[data-row-id="' + pid + '"]');
  if (_tr) _tr.remove();
  window.unofficialInvoiceBuilderRecalc();
};

// ===== افزودن قلم سفارشی =====
window.unofficialInvoiceBuilderAddCustomRow = function () {
  if (!_unInvState) return;
  var newLine = {
    idx: 'cu-' + Math.random().toString(36).slice(2, 6),
    name: 'قلم سفارشی',
    desc: '',
    unit: 'NO',
    pcode: '',
    qtyOrig: 1,
    priceOrig: 0,
    qty: 1,
    price: 0,
    lineTotal: 0,
    fromOffer: _unInvState.collected.priceSourceOffer ? _unInvState.collected.priceSourceOffer.no : '—',
    fromKind: 'CUSTOM',
    custom: true
  };
  _unInvState.lines.push(newLine);
  var _tbody = document.getElementById('unRowsTbody');
  _tbody.insertAdjacentHTML('beforeend', window.buildUnInvBuilderRows([newLine]));
  window.unofficialInvoiceBuilderRecalc();
};

// ===== بازنشانی از پیشنهاد =====
window.unofficialInvoiceBuilderResetFromOffer = function () {
  var _dlg = document.getElementById('unInvBuilderDlg');
  if (!_dlg) return;
  if (!confirm('اقلام به مقادیر پیش\u200cفرض پیشنهاد(های) انتخاب\u200cشده بازنشانی شوند؟')) return;
  reloadUnInvBuilderFromSelection(_dlg);
};

// ===== تأیید و صدور =====
window.unofficialInvoiceBuilderSubmit = function () {
  if (!_unInvState) return;
  var _dlg = document.getElementById('unInvBuilderDlg');
  if (!_dlg) return;
  // اعتبارسنجی: حداقل یک قلم با مبلغ > 0
  var validRows = _unInvState.lines.filter(function (l) {
    return (+l.qty || 0) > 0 && (+l.price || 0) > 0;
  });
  if (!validRows.length) {
    if (typeof alert === 'function') alert('⛔ حداقل یک قلم با تعداد و قیمت واحد بزرگ\u200cتر از صفر لازم است.');
    return;
  }
  var _linesWithTotal = _unInvState.lines.filter(function (l) {
    return (+l.qty || 0) > 0 && (+l.price || 0) > 0;
  });

  // جمع\u200cآوری ورودی\u200cها
  var _discInput = (_dlg.querySelector('#unDiscInput') || {}).value || '';
  var _bankInput = (_dlg.querySelector('#unBankInput') || {}).value || '';
  var _rateEl = _dlg.querySelector('#unRateInput');
  var _rate = _rateEl ? (+_rateEl.value || _unInvState.cRate) : _unInvState.cRate;

  // ساخت consolidated meta اگر تجمیعی
  var consolidatedMeta = null;
  if (_unInvState.mode === 'consolidated') {
    var _allSelNos = _unInvState.selectedOfferNos;
    var _byNo = {};
    _unInvState.collected.offers.forEach(function (o) { _byNo[o.no] = o; });
    consolidatedMeta = _allSelNos.map(function (no) {
      var o = _byNo[no];
      var _shareItems = _linesWithTotal.filter(function (l) { return l.fromOffer === no; });
      var _shareIrr = _shareItems.reduce(function (s, l) { return s + (l.qty * l.price); }, 0);
      return {
        offerNo: no,
        kind: o ? o.kind : '?',
        itemsCount: _shareItems.length,
        totalIrr: _shareIrr,
        sharePct: 0
      };
    });
    var _grandTotal = consolidatedMeta.reduce(function (s, m) { return s + m.totalIrr; }, 0) || 1;
    consolidatedMeta.forEach(function (m) { m.sharePct = Math.round((m.totalIrr * 1000 / _grandTotal)) / 10; });
  }

  // پیشنهاد مبدأ (CO) برای رسم سند
  var primaryOffer = _unInvState.collected.priceSourceOffer;
  if (_unInvState.mode === 'single') {
    var _singleOfferNo = _dlg.querySelector('#unSingleOffer').value;
    primaryOffer = _unInvState.collected.offers.filter(function (o) { return o.no === _singleOfferNo; })[0] || primaryOffer;
  }

  // بستن دیالوگ
  _dlg.remove();

  // فراخوان تابع صدور سفارشی
  window.unofficialInvoicePrintCases({
    primaryOffer: primaryOffer,
    offerNos: _unInvState.selectedOfferNos.slice(),
    isConsolidated: _unInvState.mode === 'consolidated',
    consolidatedFromOffers: consolidatedMeta,
    linesSnapshot: _linesWithTotal,
    discountInput: _discInput,
    bankAccount: _bankInput,
    currentRate: _rate,
    /* v34.7.28: شناسهٔ متعارف (قرارداد PTF.id) — پیش‌تر cd اول بود و با مصرف‌کننده‌های _id-اول نمی‌خواند. */
    dealCd: (window.PTF && typeof window.PTF.id === 'function') ? window.PTF.id(_unInvState.deal) : (_unInvState.deal._id || _unInvState.deal.cd || '')
  });
};

// ===== پرینتر سفارشی: صدور با snapshot از پیش ویرایش\u200cشده =====
window.unofficialInvoicePrintCases = function (ctx) {
  if (!ctx || !ctx.primaryOffer || !ctx.linesSnapshot || !ctx.linesSnapshot.length) {
    if (typeof alert === 'function') alert('⛔ اطلاعات صدور ناقص است.');
    return;
  }
  // تمیزسازی دوبارشماری\u200cها (همان رفتار unofficialInvoicePrint)
  if (typeof window.ptfUnofficialInvoiceVoid === 'function') {
    // no direct cleanUpDoubleInvoices from outside — call it via context
  }
  if (typeof window.cleanUpDoubleInvoices === 'function') { /*lint*/ }
  // call via un-inv-invoice internal cleanUpDoubleInvoices only if visible
  try {
    var ev = new Function('try { cleanUpDoubleInvoices(); } catch(e) {}');
    // NOTE: cleanUpDoubleInvoices is in IIFE-private scope in unofficial-invoice.js;
    // we rely on the existing call at module-load, plus what `unofficialInvoicePrint` already does:
  } catch (e){}

  var primaryOffer = ctx.primaryOffer;
  var _co = primaryOffer;
  // ساخت نمونه offer جایگزین با items = snapshot (برای استفاده در generateUnofficialInvoiceHtml)
  var _syntheticOffer = Object.assign({}, _co, { items: ctx.linesSnapshot });

  // محاسبه کل اقلام
  var total = ctx.linesSnapshot.reduce(function (s, ln) { return s + (+ln.qty || 0) * (+ln.price || 0); }, 0);

  // پردازش تخفیف
  var discountVal = 0, discountLabel = 'تخفیف توافقی';
  var _di = (ctx.discountInput || '').trim();
  if (_di) {
    var _clean = _di.replace(/[٪%]/g, '');
    if (_di.indexOf('%') >= 0 || _di.indexOf('٪') >= 0) {
      var pct = parseFloat(_clean) || 0;
      discountVal = Math.round(total * pct / 100);
      discountLabel = 'تخفیف توافقی (' + pct + '٪)';
    } else {
      discountVal = parseFloat(_clean.replace(/,/g, '')) || 0;
    }
  }
  var currentRate = ctx.currentRate || _co.fxRateRef || 1;

  // محاسبه پیش\u200cپرداخت
  var advPayIrr = 0, _a = null;
  try {
    _a = (typeof ptfAdvanceNormalize === 'function' && !window.PTF_SALES_DOMAIN_V2) ? ptfAdvanceNormalize(_co) : null;
    if (_a && _a.mode !== 'none' && (+_a.amt || 0) > 0) {
      advPayIrr = Math.round(+(_a.receivedAmt != null ? _a.receivedAmt : (_a.paid || _a.cashFull ? _a.amt : 0)) || 0);
    }
  } catch (eAdv) {}
  var advRate = _co.advance && _co.advance.rate ? +_co.advance.rate : currentRate;

  // گارد سال مالی قفل
  var invYear = String(_co.dateFa || '').split('/')[0];
  if (invYear && typeof ptfFiscalYearLocked === 'function' && ptfFiscalYearLocked(invYear)) {
    if (typeof alert === 'function') alert('🔒 خطا: سال مالی ' + invYear + ' قفل است. صدور در سال مالی قفل شده مجاز نیست.');
    return;
  }

  // ساخت invoiceNo + invoiceCd برای حالت تجمیعی
  var invoiceCd, invoiceNo;
  if (ctx.isConsolidated) {
    var _ts = new Date();
    var _stamp = _ts.getFullYear() +
      String(_ts.getMonth() + 1).padStart(2, '0') +
      String(_ts.getDate()).padStart(2, '0') +
      String(_ts.getHours()).padStart(2, '0') +
      String(_ts.getMinutes()).padStart(2, '0');
    invoiceCd = 'UN-INV-CONSOLIDATED-' + (ctx.dealCd || 'X') + '-' + _stamp;
    invoiceNo = 'INV-CONSOLIDATED-' + _stamp;
    var _primaryRef = String(_co.no || '').replace(/^PTF-/, '');
    _syntheticOffer.no = 'PTF-' + _primaryRef + '-CONSOLIDATED';  // شماره نمایشی برای سند
  } else {
    invoiceNo = String(_co.no || '').replace(/PTF-CO-/i, 'INV-').replace(/PTF-TC-/i, 'INV-');
    invoiceCd = 'UN-INV-' + (_co.no || '');
  }

  // پیدا کردن فاکتور موجود برای همان primary offer (در حالت تک)
  var invs = getData('ptf_crm_invoices') || [];
  var existing = null;
  if (!ctx.isConsolidated) {
    existing = invs.filter(function (x) {
      return x && (x.cd === invoiceCd || (x.offerNo === _co.no && x.isUnofficial && x.status !== 'void'));
    })[0];
  }

  // تبدیل\u200cهای ریالی
  var totalIrr = _co.currency === 'IRR' || !_co.currency ? total : Math.round(total * currentRate);
  var discountIrr = _co.currency === 'IRR' || !_co.currency ? discountVal : Math.round(discountVal * currentRate);

  var advPayOriginal = _co.currency === 'IRR' || !_co.currency ? advPayIrr : (advRate > 0 ? (advPayIrr / advRate) : advPayIrr);
  var netPayableOriginal = Math.max(0, total - discountVal - advPayOriginal);
  var netPayableIrr = Math.round(netPayableOriginal * currentRate);
  var amountIrr = advPayIrr + netPayableIrr;

  // پیدا کردن پروندهٔ فروش برای اتصال
  var _salesCase = (getData('ptf_crm_deals') || []).filter(function (d) {
    /* v34.7.28: تطبیق با همهٔ نام‌های مستعار رکورد (PTF.sameEntity) به‌جای ترتیب دلخواه. */
    var sameCase = (window.PTF && typeof window.PTF.sameEntity === 'function')
      ? window.PTF.sameEntity(d, ctx.dealCd)
      : (String(d && (d._id || d.cd) || '') === String(ctx.dealCd || '') && !!ctx.dealCd);
    return d && (d.wonOffer === _co.no || (_co._id && d.rootOfferId === _co._id) || sameCase);
  })[0] || null;

  // ذخیره رکورد فاکتور
  var newInv = null;
  if (existing && !ctx.isConsolidated) {
    /* UI-02 (v34.7.20): بازنویسی واقعی صورتحساب موجود.
       ریشهٔ باگ: این شاخه فقط `caseId/customerId` را به‌روز می‌کرد (و دوبار هم ذخیره می‌کرد)،
       اما مبلغ، تخفیف، snapshot اقلام و نرخ ارز دست‌نخورده می‌ماند؛ کاربر «صدور مجدد» می‌زد،
       پیام موفقیت می‌گرفت و رکورد قدیمی سرِ جایش بود. اکنون محتوای مالی واقعاً به‌روز می‌شود.
       عمداً دست‌نخورده: `cd` و `no` (هویت سند)، `invDate/t` (سال مالی و ترتیب تخصیص FIFO)
       و `payments` (به‌جز ردیف پیش‌پرداخت که هم‌راستا می‌شود).
       مرجع: بررسی مستقل N4 + گزارش تلفیقی §۷.۴ | گام B2 نقشهٔ فازبندی */
    var _before = JSON.parse(JSON.stringify(existing));
    existing.caseId = (_salesCase ? (_salesCase._id || _salesCase.cd || '') : (existing.caseId || ''));
    existing.customerId = ((_salesCase && _salesCase.buyerCd) || _co.buyerCd || existing.customerId || '');
    existing.offerNo = _co.no || existing.offerNo || '';
    existing.buyerCo = _co.buyerCo || existing.buyerCo || '';
    existing.amount = amountIrr;
    existing.base = totalIrr;
    existing.vat = 0;
    existing.discount = discountIrr;
    existing.discountLabel = discountLabel;
    existing.discountInput = ctx.discountInput || '';
    existing.offerCurrency = _co.currency || 'IRR';
    existing.offerFxBasis = _co.fxBasis || '';
    existing.offerFxRateRef = currentRate;
    existing.bankAccount = ctx.bankAccount || existing.bankAccount || '';
    existing.invoiceKind = 'single';
    existing.sourceOfferNo = _co.no || '';
    existing.overridedFromOffer = true;
    existing.linesSnapshot = ctx.linesSnapshot;
    existing.isUnofficial = true;
    existing.status = existing.status || 'active';
    existing.reissuedAt = faDateTime();
    existing.reissuedBy = curSession().name || '?';
    /* ردیف پیش‌پرداخت با مبلغ جدید هم‌راستا می‌شود (نه اضافه‌شدن ردیف دوم) */
    existing.payments = Array.isArray(existing.payments) ? existing.payments : [];
    var _advCd = 'RP-ADV-' + (_co.no || '');
    var _advRow = existing.payments.filter(function (p) { return p && p.fromAdvance && String(p.cd || '') === _advCd; })[0];
    if (_advRow) {
      _advRow.amt = advPayIrr; _advRow.amountIrr = advPayIrr;
      _advRow.fx = { fxAmt: advPayOriginal, rate: advRate };
      _advRow.t = faDate(); _advRow.by = curSession().name;
    } else if (advPayIrr > 0) {
      existing.payments.push({ cd: _advCd, amt: advPayIrr, amountIrr: advPayIrr,
        fx: { fxAmt: advPayOriginal, rate: advRate },
        how: 'کسر مبالغ وصول\u200cشده پیش\u200cپرداخت (غیررسمی)',
        t: faDate(), by: curSession().name, fromAdvance: true });
    }
    existing.advApplied = advPayIrr;
    setData('ptf_crm_invoices', invs);
    try { if (window.PTF && window.PTF.ar && typeof window.PTF.ar.invalidate === 'function') window.PTF.ar.invalidate(); } catch (eArI) {}
    try { if (typeof audit === 'function') audit('صورتحساب غیررسمی', 'بازنویسی صورتحساب ' + (existing.no || existing.cd) + ' — مبلغ جدید ' + amountIrr.toLocaleString('fa-IR') + ' ریال', String(existing.cd || '')); } catch (eAu) {}
    /* هم‌راستایی با سرور: همان فرمان ثبت، با کلید یکتای همین سند (سرور با cd به‌روزرسانی می‌کند) */
    if (typeof window.PTF_SALES_DOMAIN_V2 !== 'undefined' && window.PTF_SALES_DOMAIN_V2 && typeof window.ptfSalesDomainApi === 'function') {
      window.ptfSalesDomainApi('register_unofficial_invoice', { invoice: existing, idempotencyKey: 'UNOFFICIAL-REISSUE|' + existing.cd + '|' + amountIrr })
        .then(function () { if (typeof ptfToast === 'function') ptfToast('بازنویسی صورتحساب غیررسمی توسط سرور تأیید شد', 'ok'); })
        .catch(function (e) {
          var _cur = getData('ptf_crm_invoices') || [];
          var _idx = -1;
          _cur.forEach(function (x, i) { if (x && x.cd === _before.cd) _idx = i; });
          if (_idx > -1) { _cur[_idx] = _before; setData('ptf_crm_invoices', _cur); }
          try { if (window.PTF && window.PTF.ar) window.PTF.ar.invalidate(); } catch (eR) {}
          if (typeof alert === 'function') alert('⛔ بازنویسی سروری صورتحساب ناموفق بود و نسخهٔ قبلی بازگردانده شد: ' + e.message);
        });
    }
  } else {
    newInv = {
      cd: invoiceCd,
      caseId: (_salesCase ? (_salesCase._id || _salesCase.cd || '') : ''),
      customerId: ((_salesCase && _salesCase.buyerCd) || _co.buyerCd || ''),
      no: invoiceNo,
      offerNo: _co.no || '',
      amount: amountIrr,
      base: totalIrr,
      vat: 0,
      discount: discountIrr,
      discountLabel: discountLabel,
      discountInput: ctx.discountInput || '',
      invDate: faDate(),
      t: faDate(),
      buyerCo: _co.buyerCo || '',
      offerCurrency: _co.currency || 'IRR',
      offerFxBasis: _co.fxBasis || '',
      offerFxRateRef: currentRate,
      payments: [],
      isUnofficial: true,
      bankAccount: ctx.bankAccount || '',
      by: curSession().name || '?',
      status: 'active',
      // فیلدهای جدید (الزام ۱ و ۳)
      invoiceKind: ctx.isConsolidated ? 'consolidated' : 'single',
      sourceOfferNo: (_co.no || ''),
      consolidatedFromOffers: ctx.consolidatedFromOffers || null,
      overridedFromOffer: true,
      linesSnapshot: ctx.linesSnapshot
    };

    if (advPayIrr > 0) {
      newInv.payments.push({
        cd: 'RP-ADV-' + (_co.no || ''),
        amt: advPayIrr,
        amountIrr: advPayIrr,
        fx: { fxAmt: advPayOriginal, rate: advRate },
        how: 'کسر مبالغ وصول\u200cشده پیش\u200cپرداخت (غیررسمی)',
        t: faDate(),
        by: curSession().name,
        fromAdvance: true
      });
      newInv.advApplied = advPayIrr;
    }

    // پاکسازی فاکتور قبلی همان primary offer (در حالت تک) — همان رفتار unofficialInvoicePrint
    if (!ctx.isConsolidated && existing) {
      invs = invs.filter(function (x) { return x && x.cd !== existing.cd && !(x.offerNo === _co.no && x.isUnofficial && x.status !== 'void'); });
    }
    invs.unshift(newInv);
    setData('ptf_crm_invoices', invs);

    if (typeof window.PTF_SALES_DOMAIN_V2 !== 'undefined' && window.PTF_SALES_DOMAIN_V2 && typeof window.ptfSalesDomainApi === 'function') {
      window.ptfSalesDomainApi('register_unofficial_invoice', { invoice: newInv, idempotencyKey: 'UNOFFICIAL|' + newInv.cd })
        .then(function () { if (typeof ptfToast === 'function') ptfToast('صورتحساب غیررسمی توسط سرور تأیید شد', 'ok'); })
        .catch(function (e) {
          var rollback = (getData('ptf_crm_invoices') || []).filter(function (x) { return x.cd !== newInv.cd; });
          if (typeof window.ptfSyncApplyServerProjection === 'function') window.ptfSyncApplyServerProjection('ptf_crm_invoices', rollback);
          else setData('ptf_crm_invoices', rollback);
          if (typeof alert === 'function') alert('⛔ ثبت سروری صورتحساب غیررسمی ناموفق بود و رکورد محلی بازگردانده شد: ' + e.message);
        });
    }
  }

  // ثبت در timeline پرونده
  try {
    var _deals = getData('ptf_crm_deals');
    /* v34.7.28: جست‌وجوی پرونده با همهٔ نام‌های مستعار؛ پیش‌تر اگر caseId خالی بود و
       fallback به ctx.dealCd می‌رسید، رکورد پیدا نمی‌شد و رویداد timeline بی‌صدا ثبت نمی‌شد. */
    var _needleCase = String((newInv && newInv.caseId) || (existing && existing.caseId) || (ctx.dealCd || ''));
    var _dTarget = _deals.filter(function (x) {
      return x && ((window.PTF && typeof window.PTF.sameEntity === 'function')
        ? window.PTF.sameEntity(x, _needleCase)
        : (!!_needleCase && (String(x._id || '') === _needleCase || String(x.cd || '') === _needleCase)));
    })[0];
    if (_dTarget) {
      _dTarget.timeline = _dTarget.timeline || [];
      _dTarget.timeline.push({
        t: faDateTime(),
        by: curSession().name || '?',
        tx: '🧾 صورتحساب پرداخت غیررسمی ' + invoiceNo +
           ' صادر شد — مبلغ کل دفتری ' + amountIrr.toLocaleString('fa-IR') + ' ریال' +
           (ctx.isConsolidated ? ' (تجمیعی از ' + ctx.offerNos.length + ' پیشنهاد)' : '') +
           (discountVal > 0 ? ' | تخفیف: ' + discountVal.toLocaleString('en-US') + ' ' + (primaryOffer.currency || 'IRR') : '') +
           (advPayIrr > 0 ? ' | کسر پیش\u200cپرداخت: ' + advPayIrr.toLocaleString('fa-IR') + ' ریال' : '')
      });
      setData('ptf_crm_deals', _deals);
    }
  } catch (eD) {}

  if (typeof ptfToast === 'function') {
    ptfToast('صورتحساب ' + (ctx.isConsolidated ? 'تجمیعی ' : '') + 'با موفقیت صادر و در مطالبات هاب مالی ثبت گردید.', 'ok');
  }

  // رندر HTML و نمایش
  var html = generateUnofficialInvoiceHtml(_syntheticOffer, total, ctx.bankAccount || '', advPayIrr, discountVal, discountLabel, currentRate, advRate);
  if (typeof window.ptfPreviewPrintableDoc === 'function') {
    window.ptfPreviewPrintableDoc('صورتحساب پرداخت — ' + invoiceNo, html, 'unofficial-invoice-' + invoiceCd);
  } else {
    var w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); }
  }
};


  // ========================================================================
  // ARENA-2026-08-17 / گام ۱ طرح جداسازی: ابطال ریشه‌کن فاکتور غیررسمی
  // الزام ۴ (ریشه‌کن: تمام آثار متصل به فاکتور پاک/باطل می‌شوند)
  // الزام ۵ (حفاظتی: وصولی‌های مندرج و چک‌های متصل حذف/ابطال خودکار نمی‌شوند)
  // راهکار: cascade ۵ مرحله‌ای + بستانکاری‌سازی خودکار مبلغ آزادشده از FIFO
  // طراحی: فقط برای غیررسمی‌ها؛ فاکتور رسمی از مسیر ptfInvoiceVoid سرور-محور رسمی عبور می‌کند
  // مجوز: فقط نقش‌های ارشد (admin/chairman/ceo/commercial) یا نقش حسابدار.
  // سازگاری: PTF_SALES_DOMAIN_V2 فعال → علاوه بر محلی، فراخوان سرور ptfSalesDomainApi('void_unofficial_invoice', ...) در مسیر بعدی.
  // ========================================================================
  /* INV-01 (v34.7.23 / فاز E): گاردهای مشترک ابطال — دقیقاً همان قواعد مسیر legacy
     (نقش، وجود رکورد، فقط غیررسمی، ابطال‌نشده، سال مالی باز، دلیل و تأیید کاربر).
     تنها یک بار نوشته شده تا مسیر سروری و مسیر legacy هرگز از هم واگرا نشوند. */
  window.ptfUnofficialInvoiceVoidLocalGuards = function (invCd, onConfirmed) {
    try {
      var _role = (typeof curRole === 'function') ? curRole() : '';
      var _isSnr = (typeof isSenior === 'function') && isSenior();
      if (!_isSnr && _role !== 'accountant') {
        if (typeof alert === 'function') alert('⛔ ابطال فاکتور غیررسمی فقط برای مدیران ارشد یا حسابدار مجاز است');
        return { ok: false, why: 'role' };
      }
    } catch (eRole) {}
    var _inv = (getData('ptf_crm_invoices') || []).filter(function (x) { return x && (x.cd === invCd || x._id === invCd); })[0];
    if (!_inv) { if (typeof alert === 'function') alert('⛔ فاکتور یافت نشد'); return { ok: false, why: 'not_found' }; }
    if (!_inv.isUnofficial) { if (typeof alert === 'function') alert('⛔ این فاکتور رسمی است؛ ابطال آن از مسیر فاکتورهای رسمی انجام می‌شود'); return { ok: false, why: 'not_unofficial' }; }
    if (_inv.status === 'void' || _inv.st === 'void' || _inv.voided === true) { if (typeof alert === 'function') alert('این فاکتور قبلاً ابطال شده است'); return { ok: false, why: 'already_void' }; }
    var _invYear = '';
    try {
      var _invDateStr = String(_inv.invDate || _inv.t || '');
      _invYear = (typeof ptfFiscalYearOf === 'function') ? ptfFiscalYearOf(_invDateStr) : ((_invDateStr.match(/(13|14)\d{2}/) || [])[0] || '');
    } catch (eY) {}
    if (_invYear && typeof ptfFiscalYearLocked === 'function' && ptfFiscalYearLocked(_invYear)) {
      if (typeof alert === 'function') alert('🔒 سال مالی ' + _invYear + ' قفل است؛ ابطال مجاز نیست. ابتدا دوره بازگشایی شود.');
      return { ok: false, why: 'locked', year: _invYear };
    }
    var _reason = 'ابطال سیستمی (بدون UI)';
    if (typeof prompt === 'function' && typeof confirm === 'function') {
      var _rsn = prompt('دلیل ابطال فاکتور غیررسمی «' + (_inv.no || _inv.cd) + '» را وارد کنید:', 'اشتباه در صدور');
      if (_rsn === null) return { ok: false, why: 'canceled' };
      _reason = String(_rsn || '').trim();
      if (!_reason) { if (typeof alert === 'function') alert('⛔ دلیل ابطال الزامی است'); return { ok: false, why: 'no_reason' }; }
      if (!confirm('🗑 تأیید نهایی ابطال فاکتور غیررسمی «' + (_inv.no || _inv.cd) + '» :\n\n' +
        '• رکورد فاکتور ابطال می‌شود (مطالبه از مانده مشتری حذف می‌شود)\n' +
        '• مرجوعی‌های متصل باطل می‌شوند\n' +
        '• تخصیص دریافت‌های پرونده آزاد و به بستانکاری همان پرونده برمی‌گردد\n' +
        '• ضمیمهٔ فایل از پرونده جدا می‌شود\n\n' +
        '⚠️ وصولی‌های واقعی و چک‌های متصل حذف/ابطال خودکار نمی‌شوند.\n\nادامه می‌دهید؟')) return { ok: false, why: 'canceled' };
    }
    return onConfirmed(_inv, _reason);
  };

  /* INV-01: آثار غیرمالی پس از تأیید سرور — ابطال مرجوعی متصل، جداکردن ضمیمه از
     پرونده و ثبت timeline. هیچ‌کدام تخصیص/بستانکاری را دست نمی‌زنند (کار سرور است). */
  window.ptfUnofficialInvoiceVoidAfterEffects = function (inv, reason) {
    var _now = (typeof faDateTime === 'function') ? faDateTime() : '';
    var _me = (typeof curSession === 'function' ? (curSession().name || '?') : '?');
    var voidedReturns = 0, removedFiles = 0;
    try {
      var _rets = getData('ptf_crm_sales_returns') || [], _chg = false;
      _rets.forEach(function (r) {
        if (!r || r.status === 'void') return;
        if (String(r.invoiceCd || '') !== String(inv.cd || '')) return;
        r.status = 'void'; r.voidAt = _now; r.voidBy = _me; r.voidReason = reason; voidedReturns++; _chg = true;
      });
      if (_chg) setData('ptf_crm_sales_returns', _rets);
    } catch (eR) {}
    try {
      if ((inv.files || []).length && inv.caseId) {
        var _deals0 = getData('ptf_crm_deals') || [];
        var _d0 = _deals0.filter(function (x) { return x && String(x._id || x.cd) === String(inv.caseId); })[0];
        if (_d0) {
          (inv.files || []).forEach(function (f) {
            if (!f || !f.key) return;
            var before = (_d0.docs || []).length;
            _d0.docs = (_d0.docs || []).filter(function (x) { return x.key !== f.key; });
            if ((_d0.docs || []).length !== before) removedFiles++;
          });
          setData('ptf_crm_deals', _deals0);
        }
      }
    } catch (eF) {}
    try {
      if (inv.caseId) {
        var _deals = getData('ptf_crm_deals') || [];
        var _d = _deals.filter(function (x) { return x && String(x._id || x.cd) === String(inv.caseId); })[0];
        if (_d) {
          _d.timeline = _d.timeline || [];
          _d.timeline.push({ t: _now, by: _me,
            tx: '🗑 ابطال سروری صورتحساب غیررسمی ' + (inv.no || inv.cd) +
                ' — دلیل: ' + reason + ' | مرجوعی ابطال‌شده: ' + voidedReturns + ' | ضمیمهٔ جداشده: ' + removedFiles +
                ' | وصولی‌ها و چک‌های واقعی دست‌نخورده ماندند (بستانکاری پرونده)' });
          setData('ptf_crm_deals', _deals);
        }
      }
    } catch (eT) {}
    return { voidedReturns: voidedReturns, removedFiles: removedFiles };
  };

  window.ptfUnofficialInvoiceVoid = function (invCd) {
    /* ── مسیر v35 (INV-01 / v34.7.23 — فاز E) ─────────────────────────────
       گارد موقت فاز A (fail-closed) اکنون جای خود را به مسیر سروری واقعی داده است.
       در معماری v35، ابطال یک فرمان اتمیک سروری است: سند void می‌شود، تخصیص‌های همان
       پرونده با قواعد قطعی بازسازی می‌شوند و مبلغ آزادشده به بستانکاری همان پرونده
       برمی‌گردد؛ هیچ رسیدی حذف نمی‌شود. بلوک نوشتنِ مالیِ محلی (که schema سروری را
       نمی‌شناخت و بستانکاری را خراب می‌کرد) در این مسیر اصلاً اجرا نمی‌شود.
       آثار غیرمالی — ابطال مرجوعی‌های متصل، جداکردن ضمیمه از پرونده و timeline —
       فقط پس از تأیید سرور اجرا می‌شوند.
       مسیر legacy (بدون PTF_SALES_DOMAIN_V2) دست‌نخورده باقی مانده است. */
    if (typeof window.PTF_SALES_DOMAIN_V2 !== 'undefined' && window.PTF_SALES_DOMAIN_V2) {
      if (typeof window.ptfUnofficialInvoiceVoidServer !== 'function') {
        if (typeof alert === 'function') alert(
          '⛔ ابطال صورتحساب غیررسمی از مسیر سرور انجام می‌شود، اما ماژول دامنهٔ فروش بارگذاری نشده است.\n\n' +
          'صفحه را تازه کنید؛ در صورت تکرار، با پشتیبانی تماس بگیرید.'
        );
        return { ok: false, why: 'server_module_missing' };
      }
      return window.ptfUnofficialInvoiceVoidLocalGuards(invCd, function (_inv2, _reason2) {
        return window.ptfUnofficialInvoiceVoidServer(_inv2._id || _inv2.cd, _reason2)
          .then(function (res) {
            /* آثار غیرمالی — فقط پس از تأیید سرور */
            try { window.ptfUnofficialInvoiceVoidAfterEffects(_inv2, _reason2); } catch (eAf) {}
            try { if (window.PTF && window.PTF.ar && typeof window.PTF.ar.invalidate === 'function') window.PTF.ar.invalidate(); } catch (eAr2) {}
            try { if (typeof audit === 'function') audit('فاکتور غیررسمی', 'ابطال سروری صورتحساب ' + (_inv2.no || _inv2.cd) + ' — دلیل: ' + _reason2, String(_inv2.cd || '')); } catch (eAu2) {}
            if (typeof ptfToast === 'function') ptfToast('صورتحساب غیررسمی ابطال شد؛ مطالبه حذف و مبلغ آزادشده به بستانکاری پرونده برگشت.', 'ok');
            if (typeof renderDeals === 'function') { try { renderDeals(); } catch (eR1) {} }
            if (typeof renderReceivables === 'function') { try { renderReceivables(); } catch (eR2) {} }
            return { ok: true, server: true, result: res };
          })
          .catch(function (e) {
            var map = {
              permission_denied: 'نقش فعلی مجاز به ابطال نیست',
              already_void: 'این فاکتور قبلاً ابطال شده است',
              fiscal_period_locked: 'سال مالی قفل است؛ ابتدا باید بازگشایی شود',
              official_invoice_requires_void_invoice: 'این سند رسمی است و باید از مسیر ابطال فاکتور رسمی باطل شود',
              invoice_not_found: 'فاکتور روی سرور پیدا نشد'
            };
            if (typeof alert === 'function') alert('⛔ ابطال انجام نشد و هیچ تغییری ثبت نشد: ' + (map[e.message] || e.message));
            return { ok: false, why: e.message };
          });
      });
    }

    // ── گارد ۱: نقش مجاز (senior یا accountant) ─────────────────────────
    try {
      var _role = (typeof curRole === 'function') ? curRole() : '';
      var _isSnr = (typeof isSenior === 'function') && isSenior();
      if (!_isSnr && _role !== 'accountant') {
        if (typeof alert === 'function') alert('⛔ ابطال فاکتور غیررسمی فقط برای مدیران ارشد یا حسابدار مجاز است');
        return { ok: false, why: 'role' };
      }
    } catch (eRole) {}

    // ── گارد ۲: وجود رکورد ────────────────────────────────────────────────
    var _invs = getData('ptf_crm_invoices');
    var _inv = (_invs || []).filter(function (x) { return x && x.cd === invCd; })[0];
    if (!_inv) {
      if (typeof alert === 'function') alert('⛔ فاکتور یافت نشد');
      return { ok: false, why: 'not_found' };
    }

    // ── گارد ۳: فقط غیررسمی (رسمی → مسیر سرور-محور) ───────────────────────
    if (!_inv.isUnofficial) {
      if (typeof alert === 'function') alert('⛔ این فاکتور رسمی است؛ ابطال رسمی از مسیر سرور (ptfInvoiceVoid) انجام شود');
      return { ok: false, why: 'not_unofficial' };
    }

    // ── گارد ۴: قبلاً ابطال نشده باشد ────────────────────────────────────
    if (_inv.status === 'void' || _inv.st === 'void' || _inv.voided === true) {
      if (typeof alert === 'function') alert('این فاکتور قبلاً ابطال شده است');
      return { ok: false, why: 'already_void' };
    }

    // ── گارد ۵: سال مالی قفل نباشد ───────────────────────────────────────
    var _invYear = '';
    try {
      var _invDateStr = String(_inv.invDate || _inv.t || '');
      if (typeof ptfFiscalYearOf === 'function') {
        _invYear = ptfFiscalYearOf(_invDateStr);
      } else {
        var _ym = _invDateStr.match(/(13|14)\d{2}/);
        _invYear = _ym ? _ym[0] : '';
      }
    } catch (eY) {}
    if (_invYear && typeof ptfFiscalYearLocked === 'function' && ptfFiscalYearLocked(_invYear)) {
      if (typeof alert === 'function') alert('🔒 سال مالی ' + _invYear + ' قفل است؛ ابطال مجاز نیست. از سند اصلاحی سال مالی استفاده کنید.');
      return { ok: false, why: 'locked', year: _invYear };
    }

    // ── گارد ۶: تأیید کاربر + دلیل اجباری ─────────────────────────────────
    var _reason = 'ابطال سیستمی (بدون UI)';
    if (typeof prompt === 'function' && typeof confirm === 'function') {
      var _rsn = prompt('دلیل ابطال فاکتور غیررسمی «' + (_inv.no || _inv.cd) + '» را وارد کنید:', 'اشتباه ثبت / مغایرت');
      if (_rsn === null) return { ok: false, why: 'canceled' };
      _reason = String(_rsn || '').trim();
      if (!_reason) {
        if (typeof alert === 'function') alert('⛔ دلیل ابطال الزامی است');
        return { ok: false, why: 'no_reason' };
      }
      var _confirmMsg = '🗑 تأیید نهایی ابطال فاکتور غیررسمی «' + (_inv.no || _inv.cd) + '» :\n\n' +
        '• رکورد فاکتور ابطال می‌شود (مطالبه از مانده مشتری حذف می‌شود)\n' +
        '• مرجوعی‌های متصل از اعتبار مشتری کاسته می‌شود\n' +
        '• تخصیص‌های دریافت پرونده به این فاکتور آزاد می‌شود (→ بستانکاری/FIFO)\n' +
        '• ضمینه فایل از پرونده جدا می‌شود\n\n' +
        '⚠️ وصولی‌های واقعی مندرج در فاکتور و چک‌های متصل حذف/ابطال خودکار نمی‌شوند (الزام ۵).\n\n' +
        'ادامه می‌دهید؟';
      if (!confirm(_confirmMsg)) return { ok: false, why: 'canceled' };
    }

    var _myName = curSession().name || '?';
    var _now = faDateTime();

    // ── ساختار لاگ cascade ───────────────────────────────────────────────
    var _log = {
      preservedPayments: [],     // وصولی‌های محفوظ (الزام ۵)
      chequeAudited: [],          // چک‌های متصل — فقط audit
      reversedAllocations: [],    // تخصیص‌های FIFO آزادشده
      freedCreditAmount: 0,        // مجموع مبلغ آزادشده (→ بستانکاری مشتری)
      voidedReturns: [],          // مرجوعی‌های ابطال‌شده
      removedFiles: []             // فایل‌های ضمیمه‌ای جدا‌شده
    };

    // ═══ مرحله ۱: وصولی‌های مندرج — فقط audit (الزام ۵) ════════════════
    (_inv.payments || []).forEach(function (p) {
      if (!p) return;
      if (p.fromAdvance) return;          // پیش‌پرداخت علی‌الحساب: بخشی از خود فاکتور
      if (p.status === 'reversal') return; // قبلاً ابطال شده
      _log.preservedPayments.push({
        cd: p.cd || '',
        amt: +p.amt || 0,
        how: p.how || '',
        t: p.t || '',
        prescribedAction: 'retain-as-customer-credit-or-fifo'
      });
    });

    // ═══ مرحله ۲: چک‌های متصل — فقط audit (الزام ۵) ════════════════════
    function _readAllCheques() {
      var _all = [];
      try { _all = _all.concat(getData('ptf_crm_cheques_received') || []); } catch (eR) {}
      try { _all = _all.concat(getData('ptf_crm_cheques_issued') || []); } catch (eI) {}
      try { _all = _all.concat(getData('ptf_crm_cheques') || []); } catch (eL) {}
      return _all;
    }
    var _chequeSeen = {};
    function _noteChequeAudit(_c) {
      if (!_c || !_c.cd) return;
      if (_chequeSeen[_c.cd]) return;
      _chequeSeen[_c.cd] = true;
      _log.chequeAudited.push({
        chequeCd: _c.cd,
        currentSt: _c.st,
        action: 'audit-only',
        note: 'ابطال فقط از ماژول چک (cheque-module.js#ptfChequeVoid) قابل انجام است'
      });
    }
    // ۲.۱) از طریق pay.chequeCd
    (_inv.payments || []).forEach(function (p) {
      if (!p || !p.chequeCd) return;
      var _c = _readAllCheques().filter(function (x) { return x && x.cd === p.chequeCd; })[0];
      if (_c) _noteChequeAudit(_c);
    });
    // ۲.۲) از طریق sourceInvoiceCd / invoiceCd مستقیم
    _readAllCheques().forEach(function (c) {
      if (c && (c.sourceInvoiceCd === _inv.cd || c.invoiceCd === _inv.cd)) _noteChequeAudit(c);
    });

    // ═══ مرحله ۳: تخصیص‌های FIFO مرتبط — ابطال + بستانکاری‌سازی ═══════
    if (typeof window.PTF_SALES_DOMAIN_V2 !== 'undefined' && window.PTF_SALES_DOMAIN_V2) {
      /* AR-01 (v34.7.19) — دفاع در عمق: حتی اگر گارد ۰ برداشته/دور زده شود، دامنهٔ این
         بلوک نباید از پروندهٔ همین فاکتور فراتر برود و باید هر دو schema را بشناسد:
           سرور v35 → { invoiceId, amountIRR }        کلاینت legacy → { invoiceCd, amount } */
      var _allocInvoiceId = function (a) { return String((a && (a.invoiceId || a.invoiceCd)) || ''); };
      var _allocAmount = function (a) { return +((a && (a.amountIRR != null ? a.amountIRR : a.amount)) || 0) || 0; };
      var _invKeys = {};
      [_inv._id, _inv.cd].forEach(function (k) { if (k) _invKeys[String(k)] = true; });
      var _caseKey = String(_inv.caseId || '');
      var _allocs = getData('ptf_crm_receipt_allocations') || [];
      _allocs.forEach(function (a) {
        if (a && _invKeys[_allocInvoiceId(a)] && a.status !== 'reversed') {
          var _freed = _allocAmount(a);
          a.status = 'reversed';
          a.reversedAt = _now;
          a.reversedBy = _myName;
          a.reversalReason = _reason;
          a.invoiceCd_atVoid = _inv.cd; // برای audit
          _log.reversedAllocations.push({
            id: a._id || a.cd,
            receiptId: a.receiptId,
            receiptCd: a.receiptCd,
            amount: _freed
          });
          _log.freedCreditAmount += _freed;
        }
      });
      setData('ptf_crm_receipt_allocations', _allocs);

      // ۳.۲) بازسازی creditRemainIRR فقط روی رسیدهای «همین پرونده»
      // پس از ابطال تخصیص، هر receipt ممکن است «سهم آزاد» داشته باشد که به
      // بستانکاری مشتری تبدیل می‌شود. این مقدار به عنوان creditRemainIRR ذخیره می‌شود.
      // AR-01: پیش از v34.7.19 این حلقه روی کل رسیدهای سیستم اجرا می‌شد.
      var _recs = getData('ptf_crm_case_receipts') || [];
      var _stillAllocated = {};
      (getData('ptf_crm_receipt_allocations') || []).forEach(function (a2) {
        if (a2 && a2.status !== 'reversed' && a2.receiptId) {
          _stillAllocated[a2.receiptId] = (_stillAllocated[a2.receiptId] || 0) + _allocAmount(a2);
        }
      });
      var _recChanged = false;
      _recs.forEach(function (r) {
        if (!r || r.status !== 'posted' || r.voided) return;
        if (!_caseKey || String(r.caseId || '') !== _caseKey) return; /* خارج از پروندهٔ این فاکتور دست نمی‌خورد */
        var _alloc = _stillAllocated[r._id || r.cd] || 0;
        var _newCredit = Math.max(0, (+r.amountIRR || +r.amt || 0) - _alloc);
        if ((+r.creditRemainIRR || 0) !== _newCredit) {
          r.creditRemainIRR = _newCredit;
          _recChanged = true;
        }
      });
      if (_recChanged) setData('ptf_crm_case_receipts', _recs);
      try { if (window.PTF && window.PTF.ar && typeof window.PTF.ar.invalidate === 'function') window.PTF.ar.invalidate(); } catch (eArInv) {}
    }

    // ═══ مرحله ۴: مرجوعی‌های متصل — ابطال (اینها سند صوری متصل‌اند) ═
    var _rets = getData('ptf_crm_sales_returns') || [];
    _rets.forEach(function (r) {
      if (!r) return;
      if (r.invoiceCd !== _inv.cd) return;
      if (r.status === 'void') return;
      r.status = 'void';
      r.voidAt = _now;
      r.voidBy = _myName;
      r.voidReason = _reason;
      _log.voidedReturns.push({ cd: r.cd, amount: r.totalAmount });
    });
    setData('ptf_crm_sales_returns', _rets);

    // ═══ مرحله ۵: جدا کردن فایل‌های ضمیمه از پرونده (نه حذف فیزیکی) ═
    if ((_inv.files || []).length && _inv.caseId) {
      var _deals0 = getData('ptf_crm_deals') || [];
      var _d0 = _deals0.filter(function (x) { return x && String(x._id || x.cd) === String(_inv.caseId); })[0];
      if (_d0) {
        (_inv.files || []).forEach(function (f) {
          if (!f || !f.key) return;
          _d0.docs = (_d0.docs || []).filter(function (x) { return x.key !== f.key; });
          _log.removedFiles.push(f.key);
        });
        setData('ptf_crm_deals', _deals0);
      }
    }

    // ═══ علامت‌گذاری خود فاکتور (رکورد اصلی حذف نمی‌شود ولی void می‌شود) ═
    _inv.status = 'void';
    _inv.st = 'void';
    _inv.voidAt = _now;
    _inv.voidBy = _myName;
    _inv.voidReason = _reason;
    _inv.voidCascadeLog = _log;       // برای audit trail یکپارچه

    // ── timeline پرونده (گزارش دقیق آنچه ابطال شد + آنچه محفوظ ماند) ─
    if (_inv.caseId) {
      var _deals = getData('ptf_crm_deals') || [];
      var _d = _deals.filter(function (x) { return x && String(x._id || x.cd) === String(_inv.caseId); })[0];
      if (_d) {
        _d.timeline = _d.timeline || [];
        var _preservedAmt = _log.preservedPayments.reduce(function (s, p) { return s + (+p.amt || 0); }, 0);
        _d.timeline.push({
          t: _now,
          by: _myName,
          tx: '🗑 ابطال ریشه‌کن فاکتور غیررسمی ' + _inv.no +
             ' — ابطال شد: ' + _log.voidedReturns.length + ' مرجوعی / ' +
             _log.reversedAllocations.length + ' تخصیص (بستانکاری‌سازی ' +
             _log.freedCreditAmount.toLocaleString('fa-IR') + ' ریال); ' +
             'محفوظ ماند: ' + _log.preservedPayments.length + ' وصولی واقعی (به‌مبلغ ' +
             _preservedAmt.toLocaleString('fa-IR') + ' ریال — به‌عنوان بستانکاری یا FIFO); ' +
             'چک (فقط audit): ' + _log.chequeAudited.length + ' مورد'
        });
        setData('ptf_crm_deals', _deals);
      }
    }

    // ── setData نهایی + audit ────────────────────────────────────────────
    setData('ptf_crm_invoices', _invs);
    try {
      audit('فاکتور غیررسمی',
        'ابطال ریشه‌کن فاکتور ' + _inv.no + ' — مبلغ فاکتور: ' +
        (+_inv.amount || 0).toLocaleString('fa-IR') + ' ریال — دلیل: ' + _reason + ' — ' +
        'وصولی محفوظ: ' + _log.preservedPayments.length + ' / ' +
        'تخصیص آزادشده: ' + _log.reversedAllocations.length + ' (بستانکاری: ' +
        _log.freedCreditAmount.toLocaleString('fa-IR') + ' ریال) / ' +
        'مرجوعی ابطال‌شده: ' + _log.voidedReturns.length + ' / ' +
        'چک (فقط audit): ' + _log.chequeAudited.length,
        _inv.cd);
    } catch (eA) {}

    // ── رندر مجدد پنل‌های وابسته ─────────────────────────────────────────
    try { if (typeof window.renderDeals === 'function') window.renderDeals(); } catch (e1) {}
    try { if (typeof window.renderReceivables === 'function') window.renderReceivables(); } catch (e2) {}
    try {
      if (typeof ptfToast === 'function') {
        ptfToast(
          'فاکتور غیررسمی ابطال شد. ' +
          _log.preservedPayments.length + ' وصولی محفوظ ماند (الزام ۵ — به‌عنوان بستانکاری/FIFO). ' +
          _log.freedCreditAmount.toLocaleString('fa-IR') + ' ریال بستانکاری آزاد شد.' +
          (_log.chequeAudited.length ? ' ' + _log.chequeAudited.length + ' چک متصل برای ابطال صریح به ماژول چک ارجاع شد.' : ''),
          'ok'
        );
      }
    } catch (eT) {}

    // ── (پس از اجرای محلی، در مرحلهٔ سروری) هماهنگی سرور PTF_SALES_DOMAIN_V2 ─
    // TODO: در آینده اگر endpoint سروری void_unofficial_invoice اضافه شد، این‌جا صدا زده شود:
    // if (typeof window.PTF_SALES_DOMAIN_V2 !== 'undefined' && window.PTF_SALES_DOMAIN_V2 &&
    //     typeof window.ptfSalesDomainApi === 'function') {
    //   window.ptfSalesDomainApi('void_unofficial_invoice', { invoiceId: _inv.cd, reason: _reason, cascadeLog: _log })
    //     .catch(function (e) { ... });
    // }

    return { ok: true, cascadeLog: _log, voidedAt: _now };
  };

  // اجرای پاک‌سازی خودکار در لود اسکریپت
  try {
    cleanUpDoubleInvoices();
  } catch (eInit) {}
})();