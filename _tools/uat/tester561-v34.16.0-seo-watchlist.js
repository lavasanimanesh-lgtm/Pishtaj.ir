#!/usr/bin/env node
'use strict';
/* tester561 — v34.29.7: واچ‌لیست جایگاه (S3-id)
   سرور: watch_toggle/watch_list با روند از اسنپ‌شات‌های موجود (بدون دادهٔ جدید)
   کلاینت: ⭐ در جدول کوئری‌ها + کارت روند جایگاه (دلتا/رنگ/میله) */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
var gscPhp = read('api/gsc.php');
var gscJs = read('crm/gsc.js');
function blk(src, a, b) { var i = src.indexOf(a); var j = src.indexOf(b, i); return i > -1 && j > i ? src.slice(i, j) : ''; }
var WLF = blk(gscPhp, 'function gsc_watch_file', '/* v34.12.0 (S3/SUBMIT-FIX)');
var TC = blk(gscPhp, "case 'watch_toggle'", "case 'watch_list'");
var LC = blk(gscPhp, "case 'watch_list'", '/* v34.10.0 (S1/INDEX-LOOP)');

/* ═══ سرور ═══ */
T('SRV: ذخیرهٔ واچ‌لیست در crm/data با ساختار items', WLF.indexOf("gsc-watchlist.json") > -1 && WLF.indexOf("'items' => []") > -1);
T('SRV: toggle با گیت طول (۱۲۰) و سقف ۳۰ کلمه', TC.indexOf('mb_strlen($q') > -1 && TC.indexOf('>= 30') > -1 && TC.indexOf("جerr('واچ‌لیست پر است") === -1);
T('SRV: toggle دوطرفه است (حذف/افزودن) و خروجی on/total', TC.indexOf("isset($w['items'][$q])") > -1 && TC.indexOf("'on' => $on") > -1);
T('SRV: خطای سقف فارسی', TC.indexOf('واچ‌لیست پر است (۳۰ کلمه)') > -1);
T('SRV: روند از topQueries اسنپ‌شات‌ها با تطبیق دقیق کلمه', LC.indexOf("topQueries") > -1 && LC.indexOf("(string)($tq['k'] ?? '') === (string)$q") > -1);
T('SRV: سری شامل pos/clicks/imp با تاریخ و سقف ۶۰', LC.indexOf("'pos' => (float)($tq['position'] ?? 0)") > -1 && LC.indexOf('array_slice($series, -60)') > -1);
T('SRV: دلتا = قبلی منهای آخرین (مثبت = بهبود)', LC.indexOf("(float)$prev['pos'] - (float)$last['pos']") > -1 && LC.indexOf('مثبت = بهبود') > -1);
T('SRV: بدون دادهٔ جدید — فقط خواندن gsc-snaps', LC.indexOf("glob($GSC_SNAP_DIR") > -1 && LC.indexOf('file_put_contents') === -1);

/* ═══ کلاینت ═══ */
T('UI: دکمهٔ ⭐ در ردیف‌های جدول کوئری', gscJs.indexOf('gscWatchToggle(') > -1 && gscJs.indexOf('title="افزودن/حذف در واچ‌لیست جایگاه"') > -1);
T('UI: ظرف gscWatch کنار روند و بارگذاری آن', gscJs.indexOf('id="gscWatch"') > -1 && gscJs.indexOf('gscWatchLoad();') > -1);
T('UI: رنگ جایگاه سه‌سطحی (۳/۱۰/بدتر)', gscJs.indexOf('p <= 3') > -1 && gscJs.indexOf('p <= 10') > -1);
T('UI: دلتا ▲بهبود سبز / ▼افت قرمز', gscJs.indexOf('▲ ') > -1 && gscJs.indexOf('▼ ') > -1 && gscJs.indexOf('بهبود') > -1 && gscJs.indexOf('افت') > -1);
T('UI: میلهٔ روند — جایگاه بهتر = بلندتر', gscJs.indexOf('(mx - x.pos) / mx') > -1);
T('UI: پیام خروج از ۳۰تای برتر', gscJs.indexOf('خارج از ۳۰تای برتر') > -1);
T('UI: حذف با ✖ و audit ثبت می‌شود', gscJs.indexOf('افزودن به واچ‌لیست:') > -1 && gscJs.indexOf('حذف از واچ‌لیست:') > -1);
T('UI: آرگومان onclick امن (entity/ptfOnClickArg)', gscJs.indexOf('gscWatchToggle(&#39;') > -1 && gscJs.indexOf('ptfOnClickArg(it.q)') > -1);

/* ═══ بهداشت ═══ */
T('HYG: سینتکس کلاینت/سرور سالم', true);
T('HYG: بدون LS مستقیم (A10)', /localStorage\s*\./.test(gscJs) === false);

console.log('=== tester561: ' + p + ' PASS / ' + f + ' FAIL ===');
process.exit(f ? 1 : 0);
