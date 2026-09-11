/* ================================================================
   tester622 — v34.38.16 · DEVICE-RECONNECT (اتصال مجدد امن مرورگر)
 ---------------------------------------------------------------
   پس‌زمینه: پس از حادثهٔ حذف درخواست‌های تامین، همان مرورگر مُسبّب به
   چرخهٔ «وصل نمی‌شود» گیر کرد: صف ارسال آفلاینِ پایدار (q:ptf_b_queue
   در IndexedDB + مجموعهٔ ptf_sync_dirty) هر بار تلاش می‌کرد دادهٔ کهنه را
   روی سرور بنویسد و سپر حذف‌انبوهٔ سرور آن را رد می‌کرد.
   ابزار crm/device-reconnect.html این چرخه را با ۴ مرحله می‌بندد:
   تشخیص → بک‌آپ اجباری → خنثی‌سازی جراحی‌وار صف/نشانه‌ها → ورود مجدد.

   این تستر، عوارض امنیتی ابزار را ساختاراً قفل می‌کند:
   A) امکان خنثی‌سازی بدون دانلود بک‌آپ وجود ندارد (فرمان ب).
   B) دامنهٔ خنثی‌سازی دقیقاً «وضعیت معلق» است — رکوردهای کسب‌وکار
      (ptf_crm_*) و نشانگرهای «انتقال یک‌باره» (پیش‌فرض) دست نمی‌خورند.
   C) پروبها به سرور صرفاً خواندنی‌اند (users_get + data_pull با since
      بزرگ) — هیچ data_push/login از این صفحه انجام نمی‌شود.
   D) پاکسازی صف در IDB با مقدار معتبر (∴ قابل‌خواندن برای seed) انجام
      می‌شود و ردیف‌های idem واقعاً حذف می‌شوند.
   E) مسیر پایانی (ورود مجدد) به index.html با cache-buster می‌رسد.
================================================================ */
'use strict';
const fs = require('fs');
const path = require('path');

let P = 0, F = 0;
function T(name, ok, extra) { if (ok) { P++; console.log('PASS ' + name); } else { F++; console.log('FAIL ' + name + (extra ? ' | ' + extra : '')); } }
function head(t) { console.log('\n── ' + t + ' ──'); }

const root = path.join(__dirname, '..', '..');
const page = path.join(root, 'crm', 'device-reconnect.html');
T('صفحهٔ device-reconnect.html موجود است', fs.existsSync(page));
const src = fs.readFileSync(page, 'utf8');

/* ─────────── A) استقلال و بک‌آپ اجباری ─────────── */
head('A) استقلال ابزار + دروازهٔ بک‌آپ (فرمان ب)');
A1: {
  const scripts = src.match(/<script\s+src=/gi) || [];
  T('A1 ابزار کاملاً مستقل است (بدون وابستگی به اسکریپت برنامه)', scripts.length === 0, String(scripts.length));
}
T('A2 متادیتای no-store دارد (صفحهٔ شفارساندن از کش قدیمی آزاد می‌ماند)',
  /Cache-Control"\s+content="no-store"/.test(src));
T('A3 دکمهٔ خنثی‌سازی پیش‌فرض disabled است و با محضر بک‌آپ فعال می‌شود',
  /id="btnNeutralize"[^>]*disabled/.test(src.replace(/\n/g, ' ')) &&
  /checkNeutralizeGate/.test(src) &&
  /getElementById\('ackBackup'\)\.checked/.test(src));
T('A4 محضر بک‌آپ پیش از فعال‌سازی، خودش تا دانلود بک‌آپ disabled است',
  /getElementById\('ackBackup'\)\.disabled = true/.test(src));
T('A5 بک‌آپ کامل است (localStorage + sessionStorage + IndexedDB KV)',
  /localStorage:\s*ls/.test(src.replace(/\n+/, ' ')) || /localStorage:\s*ls,/.test(src.replace(/\s+/g, ' ')) && /sessionStorage:\s*ss/.test(src) &&
  /indexedDB:\s*\{\s*store:\s*'kv'/.test(src.replace(/\s+/g, ' ')) && src.indexOf('idbDump') > -1);

/* ─────────── B) دامنهٔ جراحی‌وار خنثی‌سازی ─────────── */
head('B) دامنهٔ دقیق خنثی‌سازی — بدون دست‌خوردن کسب‌وکار');
T('B1 صف ارسال آفلاین هدف است (IDB q:ptf_b_queue + بقایای LS)',
  src.indexOf("idbPut('q:ptf_b_queue', '{}')") > -1 && src.indexOf("rmLS('ptf_b_queue')") > -1);
T('B2 سمِ بازتولیدکنندهٔ صف خنثی می‌شود (ptf_sync_dirty)',
  src.indexOf("rmLS('ptf_sync_dirty')") > -1);
T('B3 قفل اجرای sync معلق (ptf_sync_run) هدف است',
  src.indexOf("rmLS('ptf_sync_run')") > -1);
T('B4 واترمارک‌ها صفر می‌شوند تا pull کامل از سرور بیاید',
  src.indexOf("rmLS('ptf_sync_rev')") > -1 && src.indexOf("rmLS('ptf_sync_krevs')") > -1);
T('B5 پایان نشست روی هر دو ذخیره (LS/SS) و سه کلید رسمی auth',
  src.indexOf("'ptf_crm_token', 'ptf_crm_token_role', 'ptf_crm_session'") > -1 &&
  src.indexOf('.forEach(function (k) { rmLS(k); rmSS(k); })') > -1);
{
  /* هیچ rmLS روی رکوردهای کسب‌وکار: فقط کلیدهای فهرست سفید مجازند */
  const rm = [...src.matchAll(/rmLS\('([^']+)'\)/g)].map(m => m[1]);
  const WL = ['ptf_b_queue', 'ptf_sync_dirty', 'ptf_sync_run', 'ptf_sync_rev', 'ptf_sync_krevs'];
  const bad = rm.filter(k => WL.indexOf(k) < 0);
  T('B6 هیچ رکورد کسب‌وکاری مستقیماً حذف نمی‌شود (فهرست سفید rmLS)', bad.length === 0, bad.join(','));
  const touchedBiz = bad.filter(k => k.indexOf('ptf_crm_') === 0 && ['ptf_crm_token', 'ptf_crm_token_role', 'ptf_crm_session'].indexOf(k) < 0);
  T('B7 هیچ رکورد ptf_crm_* (جز کلیدهای نشست) حذف نمی‌شود', touchedBiz.length === 0, touchedBiz.join(','));
}
T('B8 نشانگرهای «انتقال یک‌باره» پیش‌فرض‌خاموش و اختیاری‌اند (بدون آن انتقال دوباره راه نمی‌افتد)',
  /\{ id: 'mig', def: false/.test(src) && src.indexOf('ptf_b_flushed_') > -1);
T('B9 صف فرمان‌های دامنه (idem:) اختیاری و هشداردار است',
  /\{ id: 'idem', def: false, danger: true/.test(src));
T('B10 ردیف‌های idem واقعاً DELETE می‌شوند (نه بازنویسی null)',
  src.indexOf('idbDelete(k)') > -1 && src.indexOf('idbPut(k, null)') === -1);

/* ─────────── C) پروبهای خواندنی ─────────── */
head('C) پروب صرفاً خواندنی');
T('C1 هیچ ارسال‌دهی به سرور از این صفحه انجام نمی‌شود',
  src.indexOf('data_push') === -1 && src.indexOf('auth_login') === -1 && src.indexOf('data_delete') === -1);
T('C2 پروب سرور با اکشن عمومی users_get انجام می‌شود',
  src.indexOf('?action=users_get') > -1);
T('C3 پروب نشست با data_pull سبک (since بزرگ) انجام می‌شود',
  src.indexOf('data_pull&since=999999999') > -1);

/* ─────────── D) مسیر پایانی و پین‌ها ─────────── */
head('D) مسیر اتصال + کشف‌پذیری + پین‌ها');
T('D1 مقصد ورود مجدد ./index.html با cache-buster است',
  /window\.location\.href='[^']*index\.html\?v=34\.38\.20'/.test(src));
{
  const vj = JSON.parse(fs.readFileSync(path.join(root, 'VERSION.json'), 'utf8'));
  const m = src.match(/var VER = '([^']+)';/);
  T('D2 پین نسخهٔ ابزار هم‌خوان با VERSION.json است', !!m && String(vj.crm_version || '') === m[1], String(m && m[1]));
}
{
  const cc = fs.readFileSync(path.join(root, 'crm', 'clear-cache.html'), 'utf8');
  T('D3 از clear-cache به ابزار لینک وجود دارد (کشف‌پذیری)',
    cc.indexOf('./device-reconnect.html') > -1);
}
T('D4 گزارش عملیات خروجی می‌دهد (diag + steps)',
  src.indexOf('copyReport') > -1 && src.indexOf('R.diag') > -1 && src.indexOf('R.steps') > -1);
T('D5 پیش‌بینی box دستورالعمل: مسیر sync-diagnostics برای تشخیص بعدی',
  src.indexOf('sync-diagnostics.html') > -1);

console.log('\n=== tester622: ' + (F ? F + ' FAIL' : 'ALL PASSED') + ' ===');
process.exit(F ? 1 : 0);
