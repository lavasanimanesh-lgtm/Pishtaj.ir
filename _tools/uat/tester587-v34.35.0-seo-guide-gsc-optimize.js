#!/usr/bin/env node
'use strict';
/* ═══ v34.36.0 (UX-R4) — گزارش کارفرما: ① راهنمای سئو باید پیش‌فرض بسته باشد ولی باز است و بسته نمی‌شود؛
   ② دکمهٔ «بهینه‌سازی» سرچ کنسول به صفحهٔ مرتبط هدایت نمی‌کند و فقط به مدیریت سایت می‌رود ═══ */
var fs = require('fs'); var path = require('path');
var ROOT = path.resolve(__dirname, '../..');
function read(p) { return fs.readFileSync(path.join(ROOT, p), 'utf8'); }
var failed = [];
function T(name, ok) { if (!ok) failed.push(name); console.log((ok ? '✔ ' : '✘ ') + name); }

var cms = read('crm/cms.js');
var gsc = read('crm/gsc.js');

/* ① راهنمای سئو: پیش‌فرض بسته + بسته‌شدن ماندگار */
T('راهنما پیش‌فرض بسته است (فقط با ذخیرهٔ صریح «1» باز می‌شود)', /cmsSeoGuideOpen = function[\s\S]{0,260}return v === '1'; \/\* پیش‌فرض: بسته/.test(cms) || cms.indexOf("return v === '1'; /* پیش‌فرض: بسته */") > -1);
T('ماندگاری حالت از لایهٔ داده (اصل A10 — بدون storage مستقیم)', cms.indexOf("getData('ptf_seo_guide_pref')") > -1 && cms.indexOf("setData('ptf_seo_guide_pref', to)") > -1);
T('وقتی ذخیره ممکن نیست هم دکمهٔ بستن کار می‌کند (حافظهٔ جایگزین)', /cmsSeoGuideToggle = function[\s\S]{0,400}_seoGuideMem = to;/.test(cms));
T('الگوی قدیمی «باز به‌صورت پیش‌فرض» حذف شده است', cms.indexOf("sessionStorage.getItem('ptfSeoGuide') !== '0'") === -1 && cms.indexOf("localStorage.getItem('ptfSeoGuide')") === -1);

/* ② بهینه‌سازی سرچ کنسول: هدایت واقعی + راهنما */
T('ناوبری با پولینگ به‌جای تایم‌شانس ثابت (تا ۱۰ ثانیه)', /gscOptimize = function[\s\S]{0,1500}setInterval/.test(gsc) && gsc.indexOf('tries > 40') > -1);
T('سوییچ به تب سئو فقط پس از آماده‌بودن پنل انجام می‌شود', gsc.indexOf("document.getElementById('cmsWrap') && typeof cmsTab === 'function'") > -1);
T('فیلتر جستجوی صفحات مرتبط اعمال می‌شود', /if \(f\) \{[\s\S]{0,200}f\.value = query;[\s\S]{0,120}cmsSeoSearch/.test(gsc));
T('بنر «چطور بهینه کنم» تعریف و در رندر تب سئو هوک شده است', gsc.indexOf('window.ptfGscOptimizeBannerHtml = function') > -1 && cms.indexOf("typeof ptfGscOptimizeBannerHtml === 'function'") > -1);
T('بنر گام‌های عملی بهینه‌سازی را توضیح می‌دهد', ['✏️', '💡', '🚀 ایندکس‌یاب'].every(function (k) { return gsc.indexOf(k) > -1; }) && gsc.indexOf('ptfGscOptimizeDismiss') > -1);

if (failed.length) {
  console.log(failed.map(function (f) { return ' • ' + f; }).join('\n'));
  process.exit(1);
}
console.log('PASS tester587: راهنمای سئو پیش‌فرض بسته + بهینه‌سازی سرچ کنسول');
