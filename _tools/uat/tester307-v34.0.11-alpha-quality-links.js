/* tester307 — v34.0.11-alpha (لینک موارد «کیفیت داده» به بخش مربوطه)
   پوشش: فاکتور خرید / هزینه جاریِ بدون طبقه‌بندی باید در تب کیفیت داده، دارای
   action لینک‌شده به ماژول اصلی (slInvoiceEdit / ptfOpexEdit) و نام تأمین‌کننده باشد
   تا کاربر مستقیماً به بخش مربوطه هدایت شود. */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');

var dq = fs.readFileSync(path.join(BASE, 'data-quality.js'), 'utf-8');
var vjson = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../VERSION.json'), 'utf-8'));

SECTION('نسخه');
T('lockstep نسخهٔ جاری', /^v[0-9.]+-alpha$/.test(vjson.crm_version));

SECTION('opex-unclassified → لینک اصلاح هزینه');
T('opex-unclassified با detail.type=opex ثبت می‌شود', /'opex-unclassified'[\s\S]*?type: 'opex'/.test(dq));
T('action اصلاح هزینه (ptfOpexEdit) در qualityRefsHtml هست', dq.indexOf("d.type === 'opex' && typeof ptfOpexEdit === 'function'") > -1 && dq.indexOf('ptfOpexEdit') > -1);

SECTION('supplier-invoice-unclassified → لینک فاکتور خرید');
T('supplier-invoice-unclassified با detail.type=supplier-invoice ثبت می‌شود', /'supplier-invoice-unclassified'[\s\S]*?type: 'supplier-invoice'/.test(dq));
T('action اصلاح فاکتور خرید (slInvoiceEdit) در qualityRefsHtml هست', dq.indexOf("d.type === 'supplier-invoice' && typeof slInvoiceEdit === 'function'") > -1 && dq.indexOf('slInvoiceEdit') > -1);
T('نام تأمین‌کننده در label فاکتور خرید لحاظ می‌شود', dq.indexOf("supName ? ' — ' + supName : ''") > -1 && dq.indexOf('فاکتور خرید ') > -1);

SECTION('سایر actionهای موجود حفظ شدند');
T('action چک (chEdit) حفظ شد', dq.indexOf("d.type === 'cheque' && typeof chEdit === 'function'") > -1);
T('action بررسی پیش‌فاکتور (procurement) حفظ شد', dq.indexOf('ptfOpenProcurementLinkAudit') > -1);

DONE('tester307-v34.0.11-alpha');
