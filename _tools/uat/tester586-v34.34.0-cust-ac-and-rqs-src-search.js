#!/usr/bin/env node
'use strict';
/* ═══ v34.36.4 (UX-R3) — گزارش کارفرما: انتخاب مشتری در مودال ثبت درخواست باید مثل فرم پیشنهاد باشد؛
   و در مودال درخواست تامین، فهرست اتصال باید با نام مشتری/شماره درخواست جستجو شود ═══
   ① هِلپر مشترک اتوکامپلیت مشتری (ptfCustAc*) در bridge.js
   ② مودال ثبت درخواست: ورودی جستجو + سلکت پنهان سازگار + دکمه لیست کامل
   ③ مودال درخواست تامین: جعبه جستجوی فهرست اتصال (rqsSrcSearch/rfqsFilterSrc) با حفظ منطق همگام‌سازی */
var fs = require('fs'); var path = require('path');
var ROOT = path.resolve(__dirname, '../..');
function read(p) { return fs.readFileSync(path.join(ROOT, p), 'utf8'); }
var failed = [];
function T(name, ok) { if (!ok) failed.push(name); console.log((ok ? '✔ ' : '✘ ') + name); }

var bridge = read('crm/bridge.js');
var rfqsmart = read('crm/rfqsmart.js');

/* ① هِلپر مشترک */
T('هیلپر عمومی اتوکامپلیت مشتری تعریف شده است', ['ptfCustAcHtml', 'ptfCustAcSearch', 'ptfCustAcPick', 'ptfCustAcToggle', 'ptfCustAcSync', 'ptfCustAcLabel'].every(function (k) {
  return bridge.indexOf('window.' + k + ' = function') > -1;
}));
T('انتخاب از جعبهٔ نتایج، رویداد change سلکت را آتش می‌زند', bridge.indexOf("sel.dispatchEvent(new Event('change'))") > -1);
T('جعبهٔ نتایج با کلیک بیرون بسته می‌شود', bridge.indexOf("[id$=\"AcBox\"]") > -1);

/* ② مودال ثبت درخواست */
var SEG = bridge.slice(bridge.indexOf('function rfqModalHtml'));
SEG = SEG.slice(0, SEG.indexOf('window.rfqNewItemRow'));
T('مودال ثبت درخواست از هیلپر مشترک استفاده می‌کند', SEG.indexOf("ptfCustAcHtml('nR2Cust')") > -1);
T('سلکت مشتری برای سازگاری منطق‌های موجود حفظ و پنهان شده', SEG.indexOf('<select id="nR2Cust" onchange="rfqCustChanged()" style="display:none">') > -1);
T('دکمهٔ ثبت مشتری جدید همچنان در دسترس است', SEG.indexOf('showCustModal()') > -1);
T('پس از ثبت مشتری جدید، ورودی جستجو هم همگام می‌شود', bridge.indexOf("window.ptfCustAcSync('nR2Cust')") > -1);

/* ③ مودال درخواست تامین */
T('جعبهٔ جستجو در فهرست اتصال وجود دارد', rfqsmart.indexOf('id="rqsSrcSearch"') > -1 && rfqsmart.indexOf('rfqsFilterSrc(this.value)') > -1);
T('فیلتر اتصال با نام مشتری، شماره درخواست، شماره کارفرما و موضوع', /rfqsFilterSrc = function[\s\S]{0,900}r\.inqNo[\s\S]{0,200}r\.co[\s\S]{0,120}r\.subj/.test(rfqsmart));
T('سلکت اتصال و همگام‌سازی اقلام دست‌نخورده باقی مانده', rfqsmart.indexOf('<select id="rqsSrc" onchange="rfqsSyncSrcInqUI()">') > -1);
T('انتخاب فعلی هنگام فیلتر حفظ می‌شود', rfqsmart.indexOf('if (cur && hits.some(function (r) { return r.cd === cur; })) sel.value = cur;') > -1);

if (failed.length) {
  console.log(failed.map(function (f) { return ' • ' + f; }).join('\n'));
  process.exit(1);
}
console.log('PASS tester586: اتوکامپلیت مشتری + جستجوی فهرست اتصال');
