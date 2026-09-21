#!/usr/bin/env node
'use strict';
/* =============================================================================
   tester671 — v34.39.19 (HOME-NOFRAME)
   «کادر دور جستجو در هدر حذف بشه» — یعنی خودِ جست‌وجو بماند و قابش برود:
   Finder هیرو بدون border/glass/blur/سایه؛ فیدبک فوکوس = تنِ تیره بدون خط.
   (کادرِ لینکِ .nav-search از ۳۹.۹ سراسری مخفی است — چک رگرسیون.)
   ============================================================================= */
require('./harness');
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf-8'); }
var p = 0, f = 0;
function T(n, c) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n); } }
var idx = read('index.html');
var home = read('assets/css/home.css');
var i0 = home.indexOf('v34.39.10 — HOME-NOFRAME');

console.log('\n── بی‌قابِ Finder ──');
T('۰.۱ لایهٔ NOFRAME در EOF پس از CALM2', i0 > -1 && i0 > home.indexOf('v34.39.9 — HOME-CALM2'));
T('۱.۱ قاعدهٔ پایه: border/blur/glass/سایه حذف، بستر شفاف',
  home.indexOf('.ptf-finder{display:flex;align-items:center;gap:8px;margin:26px 0 0;padding:7px 7px 7px 20px;border-radius:999px;background:transparent;transition:background .25s}') > -1);
T('۱.۲ هیچ backdrop-filter در قاعدهٔ پایه نمانده', /\.ptf-finder\{[^}]*backdrop-filter/.test(home) === false);
T('۱.۳ فیدبک فوکوس = تنِ تیرهٔ ملایم (بدون خطِ دور/هاله)',
  home.indexOf('.ptf-finder:focus-within{background:rgba(2,8,20,.24)}') > -1);
T('۱.۴ شب هم بی‌قاب', home.indexOf('html.ptf-dark .ptf-finder{background:transparent}') > -1);

console.log('\n── کارکرد جست‌وجو حفظ شد ──');
T('۲.۱ فرم GET به /search/ با name="q" و role="search" (قرارداد ۶۶۲)',
  /class="ptf-finder"[^>]*action="\/search\/"[^>]*method="get"/.test(idx) && /name="q"/.test(idx) && /role="search"/.test(idx));
T('۲.۲ ورودی و دکمهٔ جست‌وجو بدون تغییر (فقط قاب حذف)',
  /\.ptf-finder input\{flex:1;min-width:0;background:transparent;border:0/.test(home) && home.indexOf('.ptf-finder-ico') > -1);
T('۲.۳ رگرسیون ۳۹.۹: لینکِ قاب‌دارِ هدر همچنان سراسری مخفی', home.indexOf('.nav-search{display:none!important}') > -1);

console.log('\n── قراردادها ──');
T('۳.۱ cache-bust روی v34.39.14', /home\.css\?v=34\.39\.14/.test(idx) && /ptf-motion\.js\?v=34\.39\.14" defer/.test(idx));
T('۳.۲ بودجه <۴۰K، آکولاد متوازن، مارکرِ ۱۰ لایه یکتا',
  home.length < 40000 && home.split('{').length === home.split('}').length &&
  ['v34.39.0 — HOME-DYNAMIC-X','v34.39.1 — HOME-ELECTRIC-3D','v34.39.2 — HOME-DOCK-SUN','v34.39.3 — HOME-NIGHT-READ','v34.39.4 — HOME-ACCORD-NIGHTMEGA','v34.39.5 — HOME-ICONMIN','v34.39.6 — HOME-WAVE','v34.39.8 — HOME-MINBTN','v34.39.9 — HOME-CALM2','v34.39.10 — HOME-NOFRAME'].every(function(m){ return home.split(m).length === 2; }));
T('۳.۳ رگرسیونِ کلی: برقِ ۲۶s/۱۵s، موجِ no-repeat، canonical‌ها',
  /animation:ptfCurS 26s linear infinite/.test(home) && /animation:ptfCurS 15s linear infinite/.test(home) &&
  home.indexOf('background-repeat:no-repeat') > -1 && idx.indexOf('href="tel:02146087679"') > -1 && idx.indexOf('wa.me/989925868479') > -1);
T('۳.۴ VERSION.json = v34.39.19', JSON.parse(read('VERSION.json')).crm_version === 'v34.39.19');

DONE('tester671-v34.39.19-noframe');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
