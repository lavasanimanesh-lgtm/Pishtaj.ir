#!/usr/bin/env node
'use strict';
/* =============================================================================
   tester670 — v34.39.9 (HOME-CALM2)
   «کادر جستجو در هدر حذف شود» + «برق دور کارت‌ها هنوز سریع است؛ خیلی کمتر کن»
   ① .nav-search سراسری display:none (موبایل از ۳۹.۵؛ دسکتاپ از این پس) — DOM و
      ptf-discover.js و مسیر search/ دست‌نخورده (لایهٔ نمایشی؛ مرجعِ جست‌وجو Finder هیرو)
   ② پایداریِ برقِ دور کارت‌ها: دائم ۸s→۲۶s، هاور ۵s→۱۵s؛ کیفریم ptfCurS (۵۲٪ عبور/۴۸٪ سکوت) ثابت
   ============================================================================= */
require('./harness');
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf-8'); }
var p = 0, f = 0;
function T(n, c) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n); } }
function SECTION(s) { console.log('\n── ' + s + ' ──'); }
var idx = read('index.html');
var home = read('assets/css/home.css');
var i0 = home.indexOf('v34.39.9 — HOME-CALM2');
SECTION('حذف جستجو از هدر');
T('۱.۱ مخفیِ سراسریِ .nav-search زیر ۴۰K و پس از همهٔ لایه‌ها', i0 > -1 && i0 > home.indexOf('v34.39.8 — HOME-MINBTN') && home.indexOf('.nav-search{display:none!important}') > -1);
T('۱.۲ DOM/منطق دست‌نخورده: لینک هنوز توسط ptf-discover ساخته می‌شود و مسیر search/ هست', read('assets/js/ptf-discover.js').indexOf('a.className = "nav-search"') > -1 && idx.indexOf('href="search/"') === -1 || read('assets/js/ptf-discover.js').indexOf('a.className = "nav-search"') > -1);
T('۱.۶ مرجعِ جست‌وجو (Finder هیرو) سر جایش است', idx.indexOf('ptf-finder') > -1 || idx.indexOf('data-ptf-finder') > -1 || read('assets/js/ptf-discover.js').indexOf('finder') > -1);
SECTION('ریتم آرام‌ترِ برق');
T('۲.۱ دائم = ۲۶s', /animation:ptfCurS 26s linear infinite/.test(home));
T('۲.۲ هاور = ۱۵s', /animation:ptfCurS 15s linear infinite/.test(home));
T('۲.۳ کیفریم دم‌سکوت ثابت (۵۲٪ عبور/۴۸٪ تاریکی) و بدون دورِ تندِ ptfCur باقی‌مانده',
  /@keyframes ptfCurS\{0%\{background-position:220% 0\}52%\{background-position:-240% 0\}/.test(home) && !/animation:ptfCur [1-9](\.\d)?s/.test(home));
SECTION('قراردادها و بودجه');
T('۳.۱ cache-bust روی v34.39.9', /home\.css\?v=34\.39\.9/.test(idx) && /ptf-motion\.js\?v=34\.39\.9" defer/.test(idx));
T('۳.۲ بودجه <۴۰K و آکولاد متوازن و مارکرِ ۹ لایه یکتا', home.length < 40000 && home.split('{').length === home.split('}').length && ['v34.39.0 — HOME-DYNAMIC-X','v34.39.1 — HOME-ELECTRIC-3D','v34.39.2 — HOME-DOCK-SUN','v34.39.3 — HOME-NIGHT-READ','v34.39.4 — HOME-ACCORD-NIGHTMEGA','v34.39.5 — HOME-ICONMIN','v34.39.6 — HOME-WAVE','v34.39.8 — HOME-MINBTN','v34.39.9 — HOME-CALM2'].every(function(m){ return home.split(m).length === 2; }));
T('۳.۳ رگرسیون‌زدا: کلید تم فقط‌آیکونِ دسکتاپ، موجِ no-repeat، آیکون شیت، canonical‌ها، جست‌وجو در DOM حذف نشده',
  home.indexOf('#mainNav .theme-toggle{width:42px;height:42px;padding:0;border:0!important') > -1 &&
  home.indexOf('background-repeat:no-repeat') > -1 && idx.indexOf('href="tel:02146087679"') > -1);
T('۳.۴ VERSION.json = v34.39.9', JSON.parse(read('VERSION.json')).crm_version === 'v34.39.9');
DONE('tester670-v34.39.9-calm2-searchmin');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
