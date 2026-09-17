#!/usr/bin/env node
'use strict';
/* =============================================================================
   tester661-v34.38.25-home-modern-fab-chat.js
   گزارش کارفرما (۱۴۰۵/۰۶/۲۶):
     «می‌خواهم ببینی آیا می‌توان ظاهر خیلی مدرن‌تر و داینامیک‌تر و کاربرپسندتر با
     حفظ پرستیژ محتوا و تم شرکت به صفحهٔ اول داد؟ اندازهٔ آیکون‌های چت و تماس و
     واتساپ بزرگ و غیرمتناسب هستند — درستشان کن. پنجرهٔ چت هوشمند هم زیر آیکون
     واتساپ باز می‌شود و مزاحمت ایجاد میکند.»

   قراردادهایی که این تستر قفل می‌کند:
   ① FAB-CHAT-HARMONY — پنجرهٔ چت (ptf-chat.js) بالاتر از هر دکمهٔ شناور است
     (z-index پنجره > واتساپ > لانچر/تماس)؛ هنگام باز بودن چت، تماس/واتساپ با
     کلاس body.ptf-chat-open کنار می‌روند؛ بستن با ESC هم کار می‌کند.
   ② اندازهٔ یکنواخت و متناسب دکمه‌های شناور صفحهٔ اول (۴۸px دسکتاپ/۴۴px موبایل،
     پشتهٔ چت→تماس→واتساپ با فاصلهٔ یکنواخت) — دیگر سه قطر ناهماهنگ ۵۴/۵۸ نیست.
   ③ HOME-MODERN — لایهٔ مدرن صفحهٔ اول فقط نمایشی است: ورود سینمایی هیرو،
     هالهٔ زندهٔ اورلی، ورود پلکانی reveal، پولیش کارت‌ها، نوار پیشرفت اسکرول،
     prefers-reduced-motion. هیچ هوک/متن/اسکیمایی عوض نمی‌شود (رجیکس‌های نگهبان).
   ============================================================================= */
require('./harness');
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf-8'); }
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function SECTION(s) { console.log('\n── ' + s + ' ──'); }

var chat = read('assets/js/ptf-chat.js');
var idx = read('index.html');
var home = read('assets/css/home.css');
var style = read('assets/css/style.css');

/* ── ۱) FAB-CHAT-HARMONY: سلسله‌مراتب z-index از خودِ سورس خوانده و مقایسهٔ عددی می‌شود ── */
SECTION('۱. سلسله‌مراتب z-index (پنجرهٔ چت زیر واتساپ نمی‌ماند)');
function zOf(src, sel) {
  var m = src.match(new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\{[^}]*z-index:(\\d+)'));
  return m ? +m[1] : 0;
}
var zBox = zOf(chat, '#ptfChatBox');
var zWa = zOf(style, '.floating-whatsapp');
var zBtn = zOf(chat, '#ptfChatBtn');
var zCall = zOf(style, '.floating-call');
T('۱.۱ z-index پنجرهٔ چت از واتساپ بالاتر است (' + zBox + ' > ' + zWa + ')', zBox > zWa && zWa > 0);
T('۱.۲ z-index پنجرهٔ چت از تماس شناور هم بالاتر است (' + zBox + ' > ' + zCall + ')', zBox > zCall);
T('۱.۳ لانچر چت زیر پنجرهٔ خودش است (' + zBtn + ' < ' + zBox + ')', zBtn > 0 && zBtn < zBox);

SECTION('۲. هماهنگی باز/بسته — کلاس body و ESC');
T('۲.۱ syncOpen کلاس ptf-chat-open روی body را همگام می‌کند',
  /function syncOpen\(\)[\s\S]{0,200}classList\.toggle\('ptf-chat-open'/.test(chat));
T('۲.۲ مسیر باز‌شدن (کلیک لانچر) syncOpen را صدا می‌زند',
  /btn\.addEventListener\('click'[\s\S]{0,120}syncOpen\(\)/.test(chat));
T('۲.۳ هر دو مسیر بستن (دکمهٔ ✕ و ESC) syncOpen را صدا می‌زنند',
  /ptfcClose'\)\.addEventListener\('click'[\s\S]{0,90}syncOpen\(\)/.test(chat) &&
  /e\.key === 'Escape'[\s\S]{0,120}syncOpen\(\)/.test(chat));
T('۲.۴ CSS ویجت: هنگام ptf-chat-open دکمه‌های تماس/واتساپ محو و غیرقابل‌کلیک می‌شوند',
  /body\.ptf-chat-open \.floating-call,body\.ptf-chat-open \.floating-whatsapp\{opacity:0!important;pointer-events:none!important/.test(chat));
T('۲.۵ پنجرهٔ چت انیمیشن بازشدن نرم دارد', /@keyframes ptfcIn/.test(chat) && /#ptfChatBox\.open\{display:flex;animation:ptfcIn/.test(chat));

/* ── ۳) اندازه‌های متناسب دکمه‌های شناور (نظام واحد ۴۸/۴۴) ── */
SECTION('۳. اندازه و پشتهٔ دکمه‌های شناور صفحهٔ اول');
var fabBlock = home.slice(home.indexOf('v34.38.25 (HOME-MODERN'));
T('۳.۱ هر دو دکمهٔ تماس و واتساپ ۴۸px شده‌اند (قبلاً ۵۸/۵۴ ناهماهنگ)',
  /\.floating-call,\s*\n?\.floating-whatsapp\{[\s\S]{0,120}width:48px;height:48px;left:18px/.test(fabBlock));
T('۳.۲ پشته با فاصلهٔ یکنواخت: چت ۲۰ → تماس ۸۲ → واتساپ ۱۴۴',
  /\.floating-call\{bottom:82px/.test(fabBlock) && /\.floating-whatsapp\{bottom:144px/.test(fabBlock));
T('۳.۳ موبایل: ۴۴px با پایه‌های ۷۶/۱۳۰ هماهنگ با لانچر چت (۱۴px)',
  /\.floating-call\{bottom:76px;width:44px;height:44px/.test(fabBlock) && /\.floating-whatsapp\{bottom:130px;width:44px;height:44px/.test(fabBlock) &&
  /@media\(max-width:600px\)\{#ptfChatBtn\{width:44px;height:44px;bottom:14px/.test(chat));
T('۳.۴ آیکون واتساپ متناسب شده (svg ثابت ۲۳px داخل دکمهٔ ۴۸px، موبایل ۲۱px)',
  /\.floating-whatsapp svg\{width:23px;height:23px/.test(fabBlock) && /\.floating-whatsapp svg\{width:21px;height:21px/.test(fabBlock));
T('۳.۵ هندلرهای درون‌خطی hover از آیکون واتساپ حذف شده (CSS صاحب hover است)',
  idx.indexOf('onmouseover="this.style.transform=\'scale(1.1)\'"') === -1);
T('۳.۶ hover سه دکمه یک زبان واحد است (بالا-کمی-بزرگ‌تر) — بدون scale(1.1) خام قدیمی',
  /\.floating-whatsapp:hover\{transform:translateY\(-3px\) scale\(1\.06\)/.test(fabBlock) &&
  /\.floating-call:hover\{transform:translateY\(-3px\) scale\(1\.06\)/.test(fabBlock));

/* ── ۴) لایهٔ مدرن صفحهٔ اول — فقط نمایشی، بدون دست‌زدن به محتوا ── */
SECTION('۴. HOME-MODERN — داینامیک اما باوقار');
T('۴.۱ ورود سینمایی هیرو + هالهٔ زندهٔ اورلی + پالس ابرو',
  /@keyframes ptfHeroUp/.test(home) && /@keyframes ptfHeroGlow/.test(home) && /@keyframes ptfEyebrow/.test(home));
T('۴.۲ ورود پلکانی reveal (stagger) تا فرزند پنجم',
  /\.reveal:nth-child\(5\)\{transition-delay:\.28s\}/.test(home));
T('۴.۳ پولیش کارت‌ها: journey/why-ptf/stats/trust همه hover دارند',
  /#journey a\.reveal:hover::before/.test(home) && /#why-ptf div\.reveal:hover/.test(home) &&
  /#stats \[style\*="border-top"\]:hover/.test(home) && /\.trust-item:hover/.test(home));
T('۴.۴ نوار پیشرفت اسکرول در صفحه هست (div + اسکریپت rAF passive)',
  idx.indexOf('id="ptfScrollProgress"') > -1 &&
  /getElementById\('ptfScrollProgress'\)[\s\S]{0,600}requestAnimationFrame\(update\)/.test(idx));
T('۴.۵ prefers-reduced-motion رعایت شده (CSS + اسکریپت)',
  /@media \(prefers-reduced-motion: reduce\)/.test(home) &&
  /\(prefers-reduced-motion: reduce\)/.test(idx));
T('۴.۶ مارکی برندها روی hover مکث می‌کند (انیمیشن اصلی دست‌نخورده)',
  /\.logo-marquee:hover \.logo-track\{animation-play-state:paused\}/.test(home) &&
  /@keyframes marquee\{to\{transform:translateX\(50%\)\}\}/.test(style));

/* ── ۵) نگهبان محتوا — پرستیژ و هوک‌ها دست‌نخورده (رجیکس‌های سبک، مرجع: tester210/216/220/318) ── */
SECTION('۵. نگهبان محتوا و هوک‌ها');
T('۵.۱ مسیرهای نقش‌محور journey سر جایشان است',
  ['journey_buyer_rfq', 'journey_engineer_tools', 'journey_customer_tracking', 'journey_supplier_signup'].every(function (k) { return idx.indexOf(k) > -1; }));
T('۵.۲ چهار آیکون خطی journey هنوز هست', (idx.match(/<section class="section" id="journey"[\s\S]*?<\/section>/) || [''])[0].split('ptf-line-icon').length - 1 === 4);
T('۵.۳ فرم استعلام سریع همان wiring قبلی را دارد',
  idx.indexOf('data-ptf-custom-submit="home-rfq"') > -1 && idx.indexOf('api/crm.php?action=add_rfq_site') > -1);
T('۵.۴ h1 و eyebrow صفحه دست‌نخورده است',
  idx.indexOf('تامین‌کننده تجهیزات صنعتی') > -1 && idx.indexOf('تامین پروژه‌ای، واردات و سورسینگ اقلام صنعتی') > -1);
T('۵.۵ home.css با cache-bust جدید لود می‌شود', idx.indexOf('home.css?v=34.39.14') > -1);
T('۵.۶ شماره‌ها و لینک‌های تماس/واتساپ عوض نشده‌اند',
  idx.indexOf('tel:02146087679') > -1 && idx.indexOf('wa.me/989925868479') > -1);

/* ── ۶) سینتکس JS تغییر‌یافته ── */
SECTION('۶. سینتکس');
try { new Function(chat); T('۶.۱ ptf-chat.js پارس می‌شود', true); }
catch (e) { T('۶.۱ ptf-chat.js پارس می‌شود', false, e.message); }
try { new Function(read('assets/js/main.js')); T('۶.۲ main.js پارس می‌شود', true); }
catch (e) { T('۶.۲ main.js پارس می‌شود', false, e.message); }

DONE('tester661-v34.39.11-home-modern-fab-chat');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
