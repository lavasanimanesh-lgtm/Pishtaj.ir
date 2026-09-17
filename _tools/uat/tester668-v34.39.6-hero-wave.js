#!/usr/bin/env node
'use strict';
/* =============================================================================
   tester668 — v34.39.7 (HOME-WAVE)
   درخواست کارفرما: «یک موج مورب رنگی روی کادرِ «دپارتمان تامین / صنعت هدف / RFQ»
   (پنل شیشه‌ای هیرو) هر چند ثانیه یک‌بار عبور کند.»
   قرارداد:
   ① CSS خالص روی .hero-panel::after — صفر JS، صفر المان اضافه، صفر درخواست شبکه
   ② مورب ۱۱۵deg با طیف برند (کهربایی→سفیدِ نرم→شعله‌ای) روی mix-blend screen
   ③ سیکل ۸ ثانیه (عبور ~۴s + سکوت ~۴s) با کیفریم ptfWave دم‌تاریک
   ④ شب پررنگ‌تر؛ reduce-motion = خاموش؛ pointer-events:none روی متن‌ها
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
var i0 = home.indexOf('v34.39.6 — HOME-WAVE');
var lay = i0 > -1 ? home.slice(i0) : '';

SECTION('لایه و موج');
T('۰.۱ لایهٔ HOME-WAVE پس از ۳۹.۵ است', i0 > -1 && i0 > home.indexOf('v34.39.5 — HOME-ICONMIN'));
T('۱.۱ موج روی ::after پنل، بدون المان/JS اضافه',
  lay.indexOf(".hero-panel::after{content:'';position:absolute;inset:0;border-radius:inherit;pointer-events:none;z-index:3;mix-blend-mode:screen") > -1);
T('۱.۲ موربِ ۱۱۵deg با طیف برند (کهربایی/سفید/شعله) و tile بزرگ',
  lay.indexOf('linear-gradient(115deg,transparent 34%,rgba(255,184,80,.18) 44%,rgba(255,255,255,.3) 50%,rgba(239,75,26,.2) 56%,transparent 66%)') > -1 &&
  lay.indexOf('background-size:260% 100%') > -1);
T('۱.۳ سیکل ۸ ثانیه: عبور ۵۲٪ اول، سکوتِ تاریک تا پایان (هر چند ثانیه یک‌بار)',
  lay.indexOf('animation:ptfWave 8s ease-in-out infinite') > -1 &&
  /@keyframes ptfWave\{0%\{background-position:210% 0\}52%\{background-position:-150% 0\}100%\{background-position:-150% 0\}\}/.test(lay));
T('۱.۳b تایل‌بندی خاموش (no-repeat) و موقعیت اولیه بیرونِ قاب — فیکسِ «موج ثابت» (بازگشتِ تکراریِ tile در دمِ سکوت باعث فریزشدنِ نوار می‌شد)', home.indexOf('background-size:260% 100%;background-repeat:no-repeat;background-position:210% 0;animation:ptfWave 8s') > -1 && home.indexOf('transparent 66%);background-size:260% 100%;background-repeat:no-repeat;background-position:210% 0}') > -1);
T('۱.۴ شب پررنگ‌تر',
  lay.indexOf('html.ptf-dark .hero-panel::after{background:linear-gradient(115deg,transparent 34%,rgba(255,196,110,.24)') > -1);
T('۱.۵ reduce: کاملاً خاموش (بدون حرکت، بدون روشنایی)',
  lay.indexOf('@media (prefers-reduced-motion: reduce){.hero-panel::after{animation:none;opacity:0}}') > -1);
T('۱.۶ پنل base نسبی است و متن‌ها زیرِ لایهٔ موج کلیپ نمی‌شوند (position:relative صریح)',
  lay.indexOf('.hero-panel{position:relative}') > -1);

SECTION('رگرسیون و قرارداد کلی');
T('۲.۱ تیلتِ ۳بعدی و هاورِ پنل از قبل دست‌نخورده',
  /\.hero-panel\{transform-style:preserve-3d;transition:transform/.test(home.replace(/\n/g, ' ')) || home.indexOf('.hero-panel:hover{transform:rotateY(-3deg)') > -1 || /#mainNav \.nav-drop-menu/.test(home) && home.indexOf('rotateY(-3deg)') > -1);
T('۲.۲ cache-bust روی v34.39.7', /home\.css\?v=34\.39\.7/.test(idx) && /ptf-motion\.js\?v=34\.39\.7" defer/.test(idx));
T('۲.۳ حجم زیرِ بودجه و آکولادِ متوازن', home.length < 40000 && home.split('{').length === home.split('}').length);
T('۲.۴ رگرسیون‌زدا: ردیفِ تم آیکونی، آکاردئون، مگای شب، ریتم برق، اعداد فارسی، canonical‌ها',
  home.indexOf('#mainNav .nav-search{display:none!important}') > -1 &&
  /#mainNav \.nav-drop\.open>\.nav-drop-menu\{max-height:240px/.test(home) &&
  home.indexOf('html.ptf-dark #mainNav .nav-mega') > -1 &&
  /animation:ptfCurS 8s linear infinite/.test(home) && /<b>۳<\/b>/.test(idx) && /<b>۶\+<\/b>/.test(idx) &&
  idx.indexOf('href="tel:02146087679"') > -1 && idx.indexOf('wa.me/989925868479') > -1);
T('۲.۵ VERSION.json = v34.39.7', JSON.parse(read('VERSION.json')).crm_version === 'v34.39.7');

DONE('tester668-v34.39.7-hero-wave');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
