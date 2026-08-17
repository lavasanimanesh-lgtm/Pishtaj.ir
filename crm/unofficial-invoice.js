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

  // ========================================================================
  // ARENA-2026-08-17 / گام ۱ طرح جداسازی: ابطال ریشه‌کن فاکتور غیررسمی
  // الزام ۴ (ریشه‌کن: تمام آثار متصل به فاکتور پاک/باطل می‌شوند)
  // الزام ۵ (حفاظتی: وصولی‌های مندرج و چک‌های متصل حذف/ابطال خودکار نمی‌شوند)
  // راهکار: cascade ۵ مرحله‌ای + بستانکاری‌سازی خودکار مبلغ آزادشده از FIFO
  // طراحی: فقط برای غیررسمی‌ها؛ فاکتور رسمی از مسیر ptfInvoiceVoid سرور-محور رسمی عبور می‌کند
  // مجوز: فقط نقش‌های ارشد (admin/chairman/ceo/commercial) یا نقش حسابدار.
  // سازگاری: PTF_SALES_DOMAIN_V2 فعال → علاوه بر محلی، فراخوان سرور ptfSalesDomainApi('void_unofficial_invoice', ...) در مسیر بعدی.
  // ========================================================================
  window.ptfUnofficialInvoiceVoid = function (invCd) {
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
      var _allocs = getData('ptf_crm_receipt_allocations') || [];
      _allocs.forEach(function (a) {
        if (a && a.invoiceCd === _inv.cd && a.status !== 'reversed') {
          var _freed = +a.amount || 0;
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

      // ۳.۲) بازسازی creditRemainIRR روی receiptهای آزادشده
      // پس از ابطال تخصیص، هر receipt ممکن است «سهم آزاد» داشته باشد که به
      // بستانکاری مشتری تبدیل می‌شود. این مقدار به عنوان creditRemainIRR ذخیره می‌شود.
      var _recs = getData('ptf_crm_case_receipts') || [];
      var _stillAllocated = {};
      (getData('ptf_crm_receipt_allocations') || []).forEach(function (a2) {
        if (a2.status !== 'reversed' && a2.receiptId) {
          _stillAllocated[a2.receiptId] = (_stillAllocated[a2.receiptId] || 0) + (+a2.amount || 0);
        }
      });
      var _recChanged = false;
      _recs.forEach(function (r) {
        if (r && r.status === 'posted' && !r.voided) {
          var _alloc = _stillAllocated[r._id || r.cd] || 0;
          var _newCredit = Math.max(0, (+r.amountIRR || +r.amt || 0) - _alloc);
          if ((+r.creditRemainIRR || 0) !== _newCredit) {
            r.creditRemainIRR = _newCredit;
            _recChanged = true;
          }
        }
      });
      if (_recChanged) setData('ptf_crm_case_receipts', _recs);
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