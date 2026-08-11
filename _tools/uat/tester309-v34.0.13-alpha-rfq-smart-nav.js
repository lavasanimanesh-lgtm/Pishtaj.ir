/* tester309 — v34.0.13-alpha (رفع باگ ناوبری/جستجوی تأمین‌کنندگان در «ثبت استعلام تامین»)
   پوشش:
     ۱) دکمهٔ «▼ نمایش/سایر تأمین‌کنندگان» به‌جای دسترسی مستقیم به _st (که داخل IIFE است و از
        onclick/oninput inline در دسترس نیست → ReferenceError) از wrapper سراسری rfqsToggleOther
        استفاده می‌کند.
     ۲) جستجوی زنده از rfqsSetSearch استفاده می‌کند.
     ۳) «تخصیص تأمین‌کننده به کالا» در خرید واقعی (buycompare) موجود است (lot/splitLot per item). */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var rfq = fs.readFileSync(path.join(BASE, 'rfqsmart.js'), 'utf-8');
var bc = fs.readFileSync(path.join(BASE, 'buycompare.js'), 'utf-8');
var vjson = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../VERSION.json'), 'utf-8'));

SECTION('نسخه');
T('lockstep نسخهٔ جاری', /^v\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/i.test(vjson.crm_version));

SECTION('رفع باگ ناوبری «سایر تأمین‌کنندگان»');
T('wrapper rfqsToggleOther تعریف شده (داخل IIFE، ولی سراسری)', rfq.indexOf('window.rfqsToggleOther = function') > -1);
T('دکمهٔ نمایش/جمع‌کردن از rfqsToggleOther استفاده می‌کند (نه _st مستقیم)',
  rfq.indexOf('onclick="rfqsToggleOther()"') > -1 && rfq.indexOf('onclick="_st._tgOtherOpen=') === -1);
T('جستجوی زنده از rfqsSetSearch استفاده می‌کند',
  rfq.indexOf('oninput="rfqsSetSearch(this.value)"') > -1 && rfq.indexOf('oninput="_st._tgQ=') === -1);

SECTION('تخصیص تأمین‌کننده به کالا (خرید واقعی)');
T('در خرید واقعی تأمین‌کننده per-item تخصیص می‌یابد (purchases با idx+sup)', bc.indexOf('c.purchases.push') > -1 && bc.indexOf('sup:') > -1);
T('تقسیم lot به تأمین‌کنندگان مختلف موجود است (splitLot)', bc.indexOf('splitLot') > -1);

SECTION('عدم استفاده از _st مستقیم در inline (کل ماژول)');
var direct = (rfq.match(/on(click|input|change)="[^"]*_st\./g) || []).length;
T('هیچ inline دیگری به _st مستقیم دسترسی ندارد', direct === 0);

DONE('tester309-v34.0.13-alpha');
