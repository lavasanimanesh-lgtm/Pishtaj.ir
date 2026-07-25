/* =====================================================================
   PTF CRM — unofficial-invoice.js — v1.0.6
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
  function generateUnofficialInvoiceHtml(o, total, bankAccount, advPay, discountVal, discountLabel) {
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

    // متغیرهای پیش‌پرداخت
    var formattedAdv = formatNumber(advPay, o.currency);
    var advInWords = window.ptfNumWordsFa ? window.ptfNumWordsFa(advPay) : advPay;

    // محاسبه خالص نهایی قابل پرداخت
    var netPayable = Math.max(0, total - discountVal - advPay);
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
      (advPay > 0 ?
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
      ((advPay > 0 || discountVal > 0) ?
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

    var invoiceNo = String(o.no).replace(/PTF-CO-/i, 'INV-').replace(/PTF-TC-/i, 'INV-');
    var invoiceCd = 'UN-INV-' + o.no; // تولید شناسه متمایز جهت جلوگیری از تعارض کدهای سروری

    var invs = getData('ptf_crm_invoices');
    var existing = invs.filter(function (x) { return x.cd === invoiceCd || (x.offerNo === o.no && x.isUnofficial && x.status !== 'void'); })[0];

    var bankAccount = '';
    var discountInput = '';
    var discountVal = 0;
    var discountLabel = 'تخفیف توافقی';
    var newInv = null;

    // محاسبه جمع کل پیش‌فاکتور
    var total = o.items.reduce(function (sum, it) {
      return sum + (+it.qty || 0) * (+it.price || 0);
    }, 0);

    if (existing) {
      var action = confirm('یک صورتحساب پرداخت برای این پیش‌فاکتور قبلاً در سیستم ثبت شده است.\n\n- جهت نمایش و چاپ مجدد همان سند قبلی (با حفظ تخفیف و مشخصات قبلی)، دکمه OK را بزنید.\n\n- جهت اعمال مابه‌التفاوت، تغییر شماره حساب، تغییر تخفیف یا حذف کامل صورتحساب، دکمه Cancel را بزنید.');
      if (action) {
        // بازخوانی عینی مقادیر ذخیره شده‌ی قبلی
        bankAccount = existing.bankAccount || '';
        discountVal = existing.discount || 0;
        discountLabel = existing.discountLabel || 'تخفیف توافقی';
        discountInput = existing.discountInput || '';
        newInv = existing;
      } else {
        var confirmDel = confirm('آیا مایل به حذف و ابطال کامل این صورتحساب غیررسمی از هاب مالی و کسر بدهی مشتری هستید؟\n\n(برای حذف صورتحساب قبلی گزینه OK، و جهت بازنویسی و اعمال تخفیف/حساب جدید گزینه Cancel را بزنید)');
        if (confirmDel) {
          // حذف کامل صورتحساب غیررسمی
          invs = invs.filter(function (x) { return x.cd !== existing.cd && !(x.offerNo === o.no && x.isUnofficial); });
          setData('ptf_crm_invoices', invs);
          if (typeof ptfToast === 'function') {
            ptfToast('صورتحساب غیررسمی با موفقیت حذف گردید و از مطالبات مشتری کسر شد.', 'info');
          }
          return; // خروج از تابع
        }

        // پیشنهاد مقادیر فعلی به عنوان مقدار پیش‌فرض برای بازنویسی راحت‌تر کاربر
        bankAccount = prompt('در صورت تمایل، شماره حساب / کارت / شبا جهت درج در صورتحساب را وارد کنید (اختیاری):', existing.bankAccount || '');
        if (bankAccount === null) return; // لغو عملیات
        
        discountInput = prompt('در صورت تمایل، مبلغ یا درصد تخفیف را وارد کنید (مثال: 5000000 یا 5%) (اختیاری):', existing.discountInput || '');
        if (discountInput === null) return; // لغو عملیات
        
        invs = invs.filter(function (x) { return x.cd !== existing.cd && !(x.offerNo === o.no && x.isUnofficial); });
      }
    } else {
      bankAccount = prompt('در صورت تمایل، شماره حساب / کارت / شبا جهت درج در صورتحساب را وارد کنید (اختیاری):', '');
      if (bankAccount === null) return; // لغو عملیات
      
      discountInput = prompt('در صورت تمایل، مبلغ یا درصد تخفیف را وارد کنید (مثال: 5000000 یا 5%) (اختیاری):', '');
      if (discountInput === null) return; // لغو عملیات
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

    // محاسبه زنده و رسمی پیش‌پرداخت وصول‌شده از بخش مطالبات
    var advPay = 0;
    try {
      var _a = (o && typeof ptfAdvanceNormalize === 'function') ? ptfAdvanceNormalize(o) : null;
      if (_a && _a.mode !== 'none' && (+_a.amt || 0) > 0) {
        var received = Math.round(+(_a.receivedAmt != null ? _a.receivedAmt : (_a.paid || _a.cashFull ? _a.amt : 0)) || 0);
        // پیش‌پرداخت کسر شده نباید از کل مبلغ با احتساب تخفیف بیشتر شود
        var totalWithDisc = Math.max(0, total - discountVal);
        advPay = _a.cashFull ? totalWithDisc : Math.min(totalWithDisc, Math.max(0, received));
      }
    } catch (eAdv) {}

    // ذخیره فاکتور در مطالبات کلاینت در صورتی که ثبت نشده باشد
    if (!newInv) {
      newInv = {
        cd: invoiceCd,
        no: invoiceNo,
        offerNo: o.no,
        amount: Math.max(0, total - discountVal), // میزان مطالبه برابر است با مبلغ پس از کسر تخفیف
        base: total,
        vat: 0,
        discount: discountVal,
        discountLabel: discountLabel,
        discountInput: discountInput,
        invDate: o.dateFa || faDate(),
        t: o.dateFa || faDate(),
        buyerCo: o.buyerCo || '',
        offerCurrency: o.currency || 'IRR',
        offerFxBasis: o.fxBasis || '',
        offerFxRateRef: +o.fxRateRef || 0,
        payments: [],
        isUnofficial: true,
        bankAccount: bankAccount,
        by: curSession().name,
        status: 'active'
      };

      // اتصال خودکار پیش‌پرداخت به عنوان وصولی فاکتور غیررسمی
      if (advPay > 0) {
        newInv.payments.push({
          cd: 'RP-ADV-' + o.no,
          amt: advPay,
          how: 'کسر مبالغ وصول‌شده پیش‌پرداخت (غیررسمی)',
          t: faDate(),
          by: curSession().name,
          fromAdvance: true
        });
        newInv.advApplied = advPay;
      }

      invs.unshift(newInv);
      setData('ptf_crm_invoices', invs);

      // ثبت رویداد در تایم‌لاین پرونده فروش جهت هماهنگی با تیم کارشناسان
      try {
        var _deals = getData('ptf_crm_deals');
        var _d = _deals.filter(function (x) { return x.wonOffer === o.no || x.offerNo === o.no; })[0];
        if (_d) {
          _d.timeline = _d.timeline || [];
          _d.timeline.push({
            t: faDateTime(),
            by: curSession().name,
            tx: '🧾 صورتحساب پرداخت ' + invoiceNo + ' به مبلغ کل ' + (total - discountVal).toLocaleString('fa-IR') + ' ریال صادر شد.' + (discountVal > 0 ? ' (تخفیف: ' + discountVal.toLocaleString('fa-IR') + ' ریال)' : '') + (advPay > 0 ? ' — کسر پیش‌پرداخت: ' + advPay.toLocaleString('fa-IR') + ' ریال' : '')
          });
          setData('ptf_crm_deals', _deals);
        }
      } catch (eD) {}

      if (typeof ptfToast === 'function') {
        ptfToast('صورتحساب با موفقیت صادر و در مطالبات هاب مالی ثبت گردید.', 'ok');
      }
    }

    var html = generateUnofficialInvoiceHtml(o, total, bankAccount, advPay, discountVal, discountLabel);

    if (typeof window.ptfPreviewPrintableDoc === 'function') {
      window.ptfPreviewPrintableDoc('صورتحساب پرداخت — ' + invoiceNo, html, 'unofficial-invoice-' + invoiceNo);
    } else {
      var w = window.open('', '_blank');
      w.document.write(html);
      w.document.close();
    }
  };

  // اجرای پاک‌سازی خودکار در لود اسکریپت
  try {
    cleanUpDoubleInvoices();
  } catch (eInit) {}
})();