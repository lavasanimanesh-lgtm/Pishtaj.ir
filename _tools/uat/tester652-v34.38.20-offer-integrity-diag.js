#!/usr/bin/env node
'use strict';
/* tester652 — v34.38.20 (OFFER-INTEGRITY-DIAG): قفلِ دو اصلاح برای بن‌بست «کلید آفرز زرد».
   ریشه: data_push عمومی حق ایجاد پیشنهاد تازه را ندارد (فقط register_offer). وقتی یک
   پیش‌نویس روی دستگاه ثبت‌نشده می‌ماند، سرور کل کلید ptf_crm_offers را rejected+conflicts
   رد می‌کند و دکمهٔ ذخیره هم چون کلید dirty است قفل می‌شود — بن‌بست ابدی با «تلاش مجدد» و
   «رفرش». دو اصلاح:
     ۱) OFFER-SAVE-DEADLOCK (sales-domain-v2.js): اگر فقط ptf_crm_offers dirty است و پیش‌نویسِ
        بازِ فعلی روی سرور ثبت‌نشده است، «ذخیره» همان پیش‌نویس را رسماً ثبت می‌کند.
     ۲) OFFER-INTEGRITY-DIAG (sync.js): پنل تشخیص، علت و دکمهٔ «بررسی پیشنهادهای ثبت‌نشده»
        را نشان می‌دهد و «بررسی اتصال» دیگر خطای واقعی را بازنویسی نمی‌کند. */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

var sync = read('crm/sync.js');
var sdv2 = read('crm/sales-domain-v2.js');

/* ── ۱) OFFER-SAVE-DEADLOCK (sales-domain-v2.js) ── */
T('OFFER-SAVE-DEADLOCK: بلوک قفل فقط برای ptf_crm_offers نرم می‌شود (_softBlock)',
  /_softBlock\s*=\s*blockers\.length\s*===\s*1\s*&&\s*blockers\[0\]\s*===\s*'ptf_crm_offers'/.test(sdv2));
T('OFFER-SAVE-DEADLOCK: شماره‌های سرور از ptfSyncOfferServerNos گرفته می‌شود',
  /window\.ptfSyncOfferServerNos\(function\s*\(nos\)/.test(sdv2));
T('OFFER-SAVE-DEADLOCK: پیش‌نهادهای ثبت‌نشده با ptfSyncOfferUnregisteredNos پیدا می‌شود',
  /window\.ptfSyncOfferUnregisteredNos\(nos\)/.test(sdv2));
T('OFFER-SAVE-DEADLOCK: اگر شمارهٔ فعلی ثبت‌نشده باشد proceed می‌شود',
  /_unreg\.indexOf\(_curNo\)\s*>=\s*0/.test(sdv2) && /_proceed\s*=\s*true/.test(sdv2));
T('OFFER-SAVE-DEADLOCK: بدنهٔ ذخیره به offerSaveBody منتقل شده و wrapper آن را صدا می‌زند',
  /function offerSaveBody\(\)\s*\{/.test(sdv2) && /return offerSaveBody\(\);/.test(sdv2));
T('OFFER-SAVE-DEADLOCK: پاسخ async با checkingRegistration برمی‌گردد',
  /checkingRegistration:\s*true/.test(sdv2));
T('OFFER-SAVE-DEADLOCK: وقتی پیش‌نهاد دیگری ثبت‌نشده است، نام آنها در پیام می‌آید',
  /پیشنهادهای ثبت‌نشده مانع ارسال هستند/.test(sdv2));

/* ── ۲) OFFER-INTEGRITY-DIAG (sync.js) ── */
T('OFFER-INTEGRITY-DIAG: ptfSyncOfferServerNos موجود است (صفحه‌بندی تا آخرین صفحه)',
  /window\.ptfSyncOfferServerNos\s*=\s*function/.test(sync) && /page\s*<\s*\(r\.pages\s*\|\|\s*1\)/.test(sync));
T('OFFER-INTEGRITY-DIAG: ptfSyncOfferUnregisteredNos موجود است', /window\.ptfSyncOfferUnregisteredNos\s*=\s*function/.test(sync));
T('OFFER-INTEGRITY-DIAG: دکمهٔ اسکن (ptfSyncOfferIntegrityScan) دارد', /window\.ptfSyncOfferIntegrityScan\s*=\s*function/.test(sync));
T('OFFER-INTEGRITY-DIAG: پنل تشخیص وقتی offers rejected/conflicts است خط مخصوص نشان می‌دهد',
  /سپر یکپارچگی/.test(sync) && /_offerRej/.test(sync) && /_offerCnf/.test(sync));
T('OFFER-INTEGRITY-DIAG: «بررسی اتصال» دیگر خطای واقعی را با diag-ok بازنویسی نمی‌کند',
  /if\s*\(\s*r\.status\s*!==\s*'online'\s*\)\s*noteSyncError\('diag'/.test(sync));
T('OFFER-INTEGRITY-DIAG: ثبت diag-ok حذف شده است', !/noteSyncError\('diag',\s*'ok'/.test(sync));

/* ── ۳) رفتار واقعی: ptfSyncOfferUnregisteredNos (کد واقعیِ sync.js) ── */
(function () {
  var m = sync.match(/window\.ptfSyncOfferUnregisteredNos\s*=\s*function\s*\(([^)]*)\)\s*\{([\s\S]*?)\n  \};/);
  T('BEHAV: تابع از sync.js استخراج شد', !!m);
  if (!m) return;
  var fn;
  eval('fn = function (' + m[1] + ') {' + m[2] + '\n};');
  var store = {};
  /* rd در بدنهٔ تابع sync.js ارجاع می‌شود؛ چون fn در همین scope ساخته شده،
     closure آن همین rd را می‌بیند. */
  var rd = function (k) { return store[k] || null; };
  var local = [
    { no: 'PTF-TO-1405-3220' },       // ثبت‌نشده (روی سرور نیست)
    { no: 'PTF-CO-1405-0487' },       // روی سرور هست
    { no: '' },                        // بدون شماره → نادیده
    null,
    { no: 'PTF-TO-1405-3220' }        // تکراری → نباید دوباره شمرده شود
  ];
  store['ptf_crm_offers'] = JSON.stringify(local);
  var serverNos = { 'PTF-CO-1405-0487': 1, 'PTF-CO-1405-0199': 1 };
  var unreg = fn(serverNos);
  T('BEHAV: فقط شمارهٔ ثبت‌نشده برمی‌گردد (بدون تکراری/خالی/موجود)',
    Array.isArray(unreg) && unreg.length === 1 && unreg[0] === 'PTF-TO-1405-3220', JSON.stringify(unreg));
  var unreg2 = fn(null);
  T('BEHAV: serverNos=null → همهٔ شماره‌های غیرخالی «ثبت‌نشده» شمرده می‌شوند (fail-safe)',
    Array.isArray(unreg2) && unreg2.indexOf('PTF-TO-1405-3220') >= 0 && unreg2.indexOf('PTF-CO-1405-0487') >= 0, JSON.stringify(unreg2));
  store['ptf_crm_offers'] = 'not-json';
  var unreg3 = fn({ 'PTF-TO-1405-3220': 1 });
  T('BEHAV: JSON خراب → بدون crash، خالی', Array.isArray(unreg3) && unreg3.length === 0, JSON.stringify(unreg3));
})();

console.log('=== tester652: ' + p + ' PASS / ' + f + ' FAIL ===');
process.exit(f ? 1 : 0);
