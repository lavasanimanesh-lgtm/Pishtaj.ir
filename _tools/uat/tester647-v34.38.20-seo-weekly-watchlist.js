#!/usr/bin/env node
'use strict';
/* tester647 — v34.38.20 (SEO-WEEKLY-WATCHLIST): قفلِ ابزار واچ‌لیست هفتگی / گیت پیشرفت (گام E رودمپ ۰۹-۰۲).
   ابزار _tools/seo_weekly_watchlist.py دو کلمهٔ پول‌ساز + کوئری‌های «صفحهٔ ۱.۵» را از تازه‌ترین اسنپ‌شات GSC
   می‌خواند، روند را در _audit/SEO-WATCHLIST.json نگه می‌دارد و گزارش هفتگی markdown می‌سازد؛ کلمهٔ غایب از
   اسنپ‌شات = خارج از ۱۰۰ نتیجه. این تستر سازوکار (فهرست کلمات، ناپذیر-تکرار بودن، ساختار خروجی) و رفتار
   روی دادهٔ فعلی (کلمات هدف هنوز نمایش ندارند، کوئری‌های صفحهٔ ۱.۵ نمایش دارند) را با مدل مستقل قفل می‌کند. */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function exists(rel) { return fs.existsSync(path.join(ROOT, rel)); }

var tool = read('_tools/seo_weekly_watchlist.py');

/* ── ۱) سازوکار ابزار ── */
T('SEO-WL: ابزار seo_weekly_watchlist.py موجود است', exists('_tools/seo_weekly_watchlist.py'));
T('SEO-WL: کلمهٔ هدف پایپینگ با صفحهٔ درست ثبت شده', /'تامین تجهیزات پایپینگ',\s*'services\/piping-supply\.html'/.test(tool));
T('SEO-WL: کلمهٔ هدف ابزار دقیق با صفحهٔ درست ثبت شده', /'تامین تجهیزات ابزار دقیق',\s*'services\/instrumentation-supply\.html'/.test(tool));
T('SEO-WL: کوئری‌های صفحهٔ ۱.۵ (روزمونت 3051، لوله x42، نمایندگی روزمونت) در فهرست‌اند',
  /'ترانسمیتر فشار روزمونت 3051'/.test(tool) && /'لوله x42'/.test(tool) && /'نمایندگی روزمونت'/.test(tool));
T('SEO-WL: ناپذیر-تکرار است (اجرای دوبارهٔ همان روز سطر را به‌روز می‌کند، نه append)',
  /k\['history'\]\[-1\]\['date'\] == today/.test(tool));
T('SEO-WL: قضاوت «گیت پیشرفت» (فرمان هفته) دارد', /فرمان هفته/.test(tool) || /verdict/.test(tool));

/* ── ۲) وضعیت تجمعی (state) ── */
var st = exists('_audit/SEO-WATCHLIST.json') ? JSON.parse(read('_audit/SEO-WATCHLIST.json')) : null;
T('SEO-WL: state در _audit/SEO-WATCHLIST.json ساخته شده', !!st);
T('SEO-WL: state همهٔ ۹ کلمهٔ هدف را دارد', !!st && Object.keys(st.keywords || {}).length === 9,
  st ? String(Object.keys(st.keywords).length) : '');
T('SEO-WL: هر کلمه history با فیلدهای date/impressions/clicks/position دارد', !!st && Object.keys(st.keywords).every(function (k) {
  var h = st.keywords[k].history;
  return Array.isArray(h) && h.length >= 1 && h.every(function (e) {
    return 'date' in e && 'impressions' in e && 'clicks' in e && 'position' in e;
  });
}));

/* ── ۳) گزارش هفتگی ── */
var reports = fs.readdirSync(path.join(ROOT, '_audit')).filter(function (fn) { return /^SEO-WEEKLY-\d{4}-\d{2}-\d{2}\.md$/.test(fn); });
T('SEO-WL: گزارش هفتگی SEO-WEEKLY-*.md تولید شده', reports.length >= 1);
if (reports.length) {
  var rep = read('_audit/' + reports.sort().reverse()[0]);
  T('SEO-WL: گزارش هر دو کلمهٔ هدف را دارد', /تامین تجهیزات پایپینگ/.test(rep) && /تامین تجهیزات ابزار دقیق/.test(rep));
  T('SEO-WL: گزارش بخش «فرمان هفته» دارد', /فرمان هفته/.test(rep));
}

/* ── ۴) مدل رفتاری مستقل: کلمات هدف در اسنپ‌شات فعلی نمایش ندارند ── */
(function () {
  var snaps = fs.readdirSync(path.join(ROOT, '_audit')).filter(function (fn) { return /^GSC-SNAPSHOT-\d{4}-\d{2}-\d{2}\.csv$/.test(fn); }).sort().reverse();
  var latest = read('_audit/' + snaps[0]);
  var money = ['تامین تجهیزات پایپینگ', 'تامین تجهیزات ابزار دقیق'];
  var lines = latest.split('\n').slice(1);
  var queries = {};
  lines.forEach(function (l) {
    var c = l.split(',');
    if (c[0] === 'query') queries[c[1].trim()] = c[3].trim();
  });
  var absent = money.filter(function (q) { return !(q in queries); });
  var seen = money.filter(function (q) { return (q in queries); });
  T('BEHAV: مدل مستقل تأیید می‌کند هر دو کلمهٔ هدف در اسنپ‌شات ۰۸-۳۰ نمایش ندارند',
    absent.length === 2 && seen.length === 0, 'absent=' + absent.length + ' seen=' + seen.length);
  // و کوئری‌های صفحهٔ ۱.۵ نمایش دارند
  T('BEHAV: کوئری‌های صفحهٔ ۱.۵ (روزمونت 3051 / لوله x42) در اسنپ‌شات نمایش دارند',
    'ترانسمیتر فشار روزمونت 3051' in queries && 'لوله x42' in queries);
})();

console.log('=== tester647: ' + p + ' PASS / ' + f + ' FAIL ===');
process.exit(f ? 1 : 0);
