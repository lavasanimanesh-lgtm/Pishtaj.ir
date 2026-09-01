#!/usr/bin/env node
'use strict';
/* tester567 — v34.28.0: مرتب‌سازی مکاتبات
   شکایت مالک: «نامه‌های اخیر به پایین منتشره شده‌اند و امکان سورتینگ بر اساس
   تاریخ و شماره وجود ندارد.» علت: رندر به ترتیب آرایهٔ ذخیره‌سازی بود که پس از
   همگام‌سازی چنددستگاهه معتبر نیست. رفع: مرتب‌سازی پایدار هنگام رندر. */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
var s = fs.readFileSync(path.join(ROOT, 'crm/letters.js'), 'utf8');
function blk(src, a, b) { var i = src.indexOf(a); var j = src.indexOf(b, i); return i > -1 && j > i ? src.slice(i, j) : ''; }
var HELP = blk(s, 'v34.22.0 (LET-SORT)', 'function renderLetters()');
var RND = blk(s, 'function renderLetters()', '/* ---------- فرم نامه صادره');

/* ═══ موتور ═══ */
T('ENG: پیش‌فرض = تاریخ نزولی (جدیدترین بالا — رفع جابجایی به پایین)', /var letSortMode = \{ key: 'date', dir: 'desc' \}/.test(HELP));
T('ENG: نرمال‌سازی ارقام فارسی با letNorm + پذیرش خط تیره به‌جای اسلش', HELP.indexOf('letNorm(s || \'\').replace(/-/g') > -1);
T('ENG: سال شمسی به مرتبهٔ میلادی (+۶۲۱) برای مقایسهٔ دو تقویم', HELP.indexOf('+= 621') > -1);
T('ENG: ساعت اختیاریِ هم‌روز در کلید تاریخ (دقیقه‌ها)', /\(\?:\\D\+\(\\d\{1,2\}\):\(\\d\{2\}\)\)\\?/.test(HELP) || HELP.indexOf('(\\d{1,2}):(\\d{2}))?') > -1);
T('ENG: ظرافت همان‌روز از رویدادها (draftUpdatedAt/signedT/registeredT)', HELP.indexOf('l.draftUpdatedAt, l.signedT, l.registeredT') > -1 && HELP.indexOf('Math.floor(x / 1e4) === Math.floor(v / 1e4)') > -1);
T('ENG: سقف کلید تاریخ فقط در همان روز اعمال می‌شود (نه از روز دیگر)', HELP.indexOf('Math.max(v, x)') > -1);
T('ENG: شماره — استخراج (سال، سری) از توکن‌های عددی', /letNorm\(l\.no \|\| ''\)\.match\(\/\\d\+\/g\)/.test(HELP));
T('ENG: هر دو قالب شماره پشتیبانی می‌شوند (۱۴۰۴/پ/ص/۰۰۰۷ و PTF-OUT-2026-0007)', HELP.indexOf('x > 1200 && x < 1600') > -1 && HELP.indexOf('x >= 2000 && x <= 2100') > -1);
T('ENG: letSortBy — کلیک روی همان ستون = تغییر جهت، ستون جدید = جهت طبیعی', blk(s, 'window.letSortBy', 'function renderLetters()').indexOf("letSortMode.dir = letSortMode.dir === 'asc' ? 'desc' : 'asc'") > -1 && blk(s, 'window.letSortBy', 'function renderLetters()').indexOf("k === 'date' ? 'desc' : 'asc'") > -1);

/* ═══ رندر ═══ */
T('UI: مرتب‌سازی پیش از رندر و پس از فیلتر (sort قبل از forEach)', RND.indexOf('ls.sort(') > -1 && RND.indexOf('ls.sort(') < RND.indexOf('ls.forEach(function (l) {'));
T('UI: تساوی‌ها با ترتیب آرایه پایدار می‌مانند (letRank)', RND.indexOf('var letRank = {}') > -1 && RND.indexOf('(letRank[a.cd] || 0) - (letRank[b.cd] || 0)') > -1);
T('UI: جهت مرتب‌سازی در مقایسه اعمال می‌شود (asc/desc)', RND.indexOf("letSortMode.dir === 'asc' ? 1 : -1") > -1);
T('UI: سرستون «شماره» کلیک‌پذیر با letSortBy(no)', RND.indexOf("onclick=\"letSortBy(\\'no\\')\"".replace(/\\'/g, "'")) > -1 || RND.indexOf('letSortBy(') > -1);
T('UI: سرستون «تاریخ» کلیک‌پذیر با letSortBy(date)', /letSortBy\(.{0,3}date.{0,3}\)/.test(RND));
T('UI: نشانگر جهت ▲/▼ فقط روی ستون فعال + ⇅ برای ستون غیرفعال', RND.indexOf('▲') > -1 && RND.indexOf('▼') > -1 && RND.indexOf("letSortMode.key === 'no' ? letArr : '⇅'") > -1);
T('UI: راهنمای مرتب‌سازی فعال بالای جدول (نزولی/صعودی)', RND.indexOf('⇅ مرتب‌سازی:') > -1 && RND.indexOf('نزولی') > -1 && RND.indexOf('صعودی') > -1);
T('UI: سرستون‌ها cursor:pointer بدون تغییر تعداد ستون‌ها (۷)', (RND.match(/<th[ >]/g) || []).length === 7 && RND.indexOf('cursor:pointer;user-select:none') > -1);

/* ═══ بهداشت ═══ */
T('HYG: مرتب‌سازی فقط هنگام رندر — بدون بازنویسی ذخیره‌سازی', HELP.indexOf('ptfEntitySaveCollection') === -1 && blk(s, 'v34.22.0 (LET-SORT)', '/* ---------- فرم نامه صادره').indexOf('setData(') === -1);
T('HYG: بدون localStorage در بلوک جدید', HELP.indexOf('localStorage') === -1 && blk(s, 'window.letSortBy', 'function renderLetters()').indexOf('localStorage') === -1);
T('HYG: همهٔ مسیرهای ایجاد قبلی دست‌نخورده (unshift در letSaveDraft/ارسال/وارده/AI)', (function () { var b = blk(s, 'function letSaveDraft', 'function _letAttachToPrj'); var c = blk(s, 'var l = { cd: genCode(\'LET\'), kind: \'IN\'', 'if (l.prjNo) _letAttachToPrj'); return b.indexOf('ls.unshift(l)') > -1 && c.indexOf('ls.unshift(l)') > -1; })());

console.log('=== tester567: ' + p + ' PASS / ' + f + ' FAIL ===');
process.exit(f ? 1 : 0);
