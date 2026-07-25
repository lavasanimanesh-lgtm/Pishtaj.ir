/* =====================================================================
   PTF CRM — unofficial-invoice.js — v1.0.0
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
  function generateUnofficialInvoiceHtml(o, total) {
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

    var totalInWords = window.ptfNumWordsFa ? window.ptfNumWordsFa(total) : total;
    var currencyFa = getCurrencyFa(o.currency);
    var formattedTotal = formatNumber(total, o.currency);

    return '<!DOCTYPE html>' +
      '<html lang="fa" dir="rtl">' +
      '<head>' +
      '  <meta charset="UTF-8">' +
      '  <title>صورتحساب پرداخت</title>' +
      '  <style>' +
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
      '      font-size: 24px;' +
      '      font-weight: 800;' +
      '      color: #1e293b;' +
      '      margin: 0 0 5px 0;' +
      '      letter-spacing: -0.5px;' +
      '    }' +
      '    .bill-subtitle {' +
      '      font-size: 12px;' +
      '      color: #64748b;' +
      '      margin: 0;' +
      '    }' +
      '    .bill-meta-box {' +
      '      display: grid;' +
      '      grid-template-columns: auto auto;' +
      '      gap: 6px 15px;' +
      '      font-size: 13px;' +
      '      color: #334155;' +
      '      background: #f8fafc;' +
      '      padding: 12px 16px;' +
      '      border: 1px solid #e2e8f0;' +
      '      border-radius: 8px;' +
      '    }' +
      '    .bill-meta-label {' +
      '      font-weight: bold;' +
      '      color: #64748b;' +
      '    }' +
      '    .bill-meta-value {' +
      '      font-weight: 600;' +
      '    }' +
      '    .party-info {' +
      '      display: flex;' +
      '      flex-direction: column;' +
      '      gap: 4px;' +
      '      font-size: 13px;' +
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
      '      font-weight: 600;' +
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
      '      font-size: 13px;' +
      '      padding: 12px 10px;' +
      '      border: 1px solid #475569;' +
      '      text-align: center;' +
      '    }' +
      '    .bill-table td {' +
      '      padding: 12px 10px;' +
      '      border: 1px solid #cbd5e1;' +
      '      font-size: 13px;' +
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
      '      font-size: 11px;' +
      '      color: #64748b;' +
      '      line-height: 1.5;' +
      '    }' +
      '    .totals-row {' +
      '      background-color: #f1f5f9 !important;' +
      '      font-weight: bold;' +
      '    }' +
      '    .totals-label-words {' +
      '      text-align: right !important;' +
      '      font-size: 13px;' +
      '      color: #334155;' +
      '      padding: 15px 12px !important;' +
      '    }' +
      '    .totals-value-words {' +
      '      font-weight: 800;' +
      '      color: #0f172a;' +
      '    }' +
      '    .totals-label-num {' +
      '      text-align: left !important;' +
      '      font-size: 14px;' +
      '      color: #0f172a;' +
      '      padding: 15px 12px !important;' +
      '      border-top: 2px solid #334155 !important;' +
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
      '      font-size: 13px;' +
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
      '    }' +
      '  </style>' +
      '</head>' +
      '<body>' +
      '  <div class="bill-wrapper">' +
      '    <div class="bill-header">' +
      '      <div class="bill-title-container">' +
      '        <h1 class="bill-title">صورتحساب پرداخت</h1>' +
      '        <p class="bill-subtitle">صورتحساب غیررسمی اقلام و خدمات موضوع پیش‌فاکتور</p>' +
      '        <div class="party-info">' +
      '          <div class="party-row">' +
      '            <span class="party-label">خریدار / کارفرما:</span>' +
      '            <span class="party-value">' + escP(o.buyerCo || '—') + '</span>' +
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
      '        <span class="bill-meta-value" dir="ltr">' + escP(o.no) + '</span>' +
      '        <span class="bill-meta-label">تاریخ صدور:</span>' +
      '        <span class="bill-meta-value">' + escP(o.dateFa || '—') + '</span>' +
      (o.inqNo ?
      '        <span class="bill-meta-label">شماره استعلام:</span>' +
      '        <span class="bill-meta-value" dir="ltr">' + escP(o.inqNo) + '</span>' : '') +
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
      '      </tbody>' +
      '    </table>' +
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

  // اکشن اصلی صدور فاکتور غیررسمی
  window.unofficialInvoicePrint = function (no) {
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
    
    // محاسبه جمع کل
    var total = o.items.reduce(function (sum, it) {
      return sum + (+it.qty || 0) * (+it.price || 0);
    }, 0);
    
    var html = generateUnofficialInvoiceHtml(o, total);
    
    if (typeof window.ptfPreviewPrintableDoc === 'function') {
      window.ptfPreviewPrintableDoc('صورتحساب پرداخت غیر رسمی — ' + o.no, html, 'unofficial-invoice-' + o.no);
    } else {
      var w = window.open('', '_blank');
      w.document.write(html);
      w.document.close();
    }
  };
})();