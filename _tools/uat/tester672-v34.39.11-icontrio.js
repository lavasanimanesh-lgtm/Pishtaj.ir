#!/usr/bin/env node
'use strict';
/* =============================================================================
   tester672 — v34.39.11 (HOME-ICONTRIO)
   «در هدر دسکتاپ سمت چپ، جستجو با آیکون مینیمال ذره‌بین جایگزین شود؛ سه آیکون
   ماه/خورشید، ذره‌بین، تغییر زبان — هر سه مینیمال.»
   قرارداد: هر سه = ۴۲px دایرهٔ بی‌قابِ شفاف؛ ذره‌بین لینک واقعی به search/ با aria-label؛
   شمارهٔ تماسِ متنیِ هدر فقط در دسکتاپ مخفی نمایشی (DOM/dock/فوتر سالم)؛ موبایل دست‌نخورده.
   ============================================================================= */
require('./harness');
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf-8'); }
var p = 0, f = 0;
function T(n, c) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n); } }
var idx = read('index.html');
var home = read('assets/css/home.css');
var i0 = home.indexOf('v34.39.11 — HOME-ICONTRIO');
var lay = i0 > -1 ? home.slice(i0) : '';

console.log('\n── سه‌گانهٔ مینیمال ──');
T('۰.۱ لایهٔ ICONTRIO در EOF پس از NOFRAME', i0 > -1 && i0 > home.indexOf('v34.39.10 — HOME-NOFRAME'));
T('۱.۱ ذره‌بینِ هدر: ۴۲px دایرهٔ شفاف بی‌قاب با ترنزیشن نرم',
  lay.indexOf('.hdr-search{width:42px;height:42px;display:grid;place-items:center;border-radius:50%;color:#475569;background:transparent;text-decoration:none;transition:background .3s,color .3s}') > -1);
T('۱.۲ آیکون SVG ۲۱px + رنگِ روشن در شب',
  lay.indexOf('.hdr-search svg{width:21px;height:21px;display:block}') > -1 && lay.indexOf('html.ptf-dark .hdr-search{color:#cfe0f5}') > -1);
T('۱.۳ پرچمِ زبان هم دقیقاً همان هندسه (۴۲ دایرهٔ گرید)',
  home.indexOf('.lang-switch{width:42px;height:42px;display:inline-grid!important;place-items:center;border-radius:50%;background:transparent!important}') > -1);
T('۱.۴ کلید تم دسکتاپ: همان آیکون ۴۲ (۳۹.۸) + آیکونِ ۲۰px هم‌خانوادهٔ ذره‌بین/پرچم',
  home.indexOf('#mainNav .theme-toggle{width:42px;height:42px;padding:0;border:0!important;background:transparent;box-shadow:none;display:grid;place-items:center}') > -1 &&
  home.indexOf('#mainNav .theme-toggle svg{width:20px;height:20px}') > -1);
T('۱.۵ هاورِ واحدِ هر سه: روز شعله‌ای ۱۲٪ / شب کهربایی ۱۳٪',
  lay.indexOf('.hdr-search:hover,.lang-switch:hover{background:rgba(239,75,26,.12)!important}') > -1 &&
  lay.indexOf('html.ptf-dark .hdr-search:hover,html.ptf-dark .lang-switch:hover{background:rgba(255,176,51,.13)!important}') > -1);

console.log('\n── لینک‌ها و DOM ──');
T('۲.۱ ذره‌بین = لینک واقعی به search/ با aria-label و title و SVG ذره‌بین',
  /<a href="search\/" class="hdr-search" aria-label="جستجو" title="جستجو"><svg viewBox="0 0 24 24"[^>]*><circle cx="11" cy="11" r="7"\/><path d="M20 20l-3\.8-3\.8"\/>/.test(idx));
T('۲.۲ لینکِ پرچمِ زبان بی‌درنگ بعد از ذره‌بین است (خوشهٔ چپ)',
  idx.indexOf('</a>\n      <a href="en/" class="lang-switch"') > -1 || /class="hdr-search"[\s\S]{0,220}<a href="en\/" class="lang-switch"/.test(idx));
T('۲.۳ شمارهٔ تماسِ هدر سراسری حذف نشده — فقط دسکتاپ display:none (DOM/dock/فوتر/JSON-LD هست)',
  lay.indexOf('@media(min-width:791px){.header-call{display:none}}') > -1 && idx.indexOf('href="tel:02146087679"') > -1 && home.indexOf('@media(max-width:560px){.header-call{display:none!important}}') > -1);
T('۲.۴ رگرسیون: لینکِ nav-search همچنان سراسری مخفی (ذره‌بین جایگزینش است، نه بازش)',
  home.indexOf('.nav-search{display:none!important}') > -1);
T('۲.۵ رگرسیونِ شیت موبایل: تم آیکونیِ ۴۲ گوشهٔ شیت + جست‌وجوی شیت مخفی + آکاردئون + canonical‌ها',
  home.indexOf('#mainNav .theme-toggle{position:absolute;top:10px;left:10px;width:42px;height:42px;padding:0;border:0!important') > -1 &&
  /#mainNav \.nav-drop\.open>\.nav-drop-menu\{max-height:240px/.test(home) && idx.indexOf('wa.me/989925868479') > -1);
T('۲.۶ رگرسیون: موجِ no-repeatِ پنل و برقِ آرام ۲۶s/۱۵s',
  home.indexOf('background-repeat:no-repeat') > -1 && /animation:ptfCurS 26s/.test(home) && /animation:ptfCurS 15s/.test(home));

console.log('\n── قراردادها ──');
T('۳.۱ cache-bust روی v34.39.14', /home\.css\?v=34\.39\.14/.test(idx) && /ptf-motion\.js\?v=34\.39\.14" defer/.test(idx));
T('۳.۲ بودجه <۴۰K، آکولاد متوازن، مارکرِ ۱۱ لایه یکتا',
  home.length < 40000 && home.split('{').length === home.split('}').length &&
  ['v34.39.0 — HOME-DYNAMIC-X','v34.39.1 — HOME-ELECTRIC-3D','v34.39.2 — HOME-DOCK-SUN','v34.39.3 — HOME-NIGHT-READ','v34.39.4 — HOME-ACCORD-NIGHTMEGA','v34.39.5 — HOME-ICONMIN','v34.39.6 — HOME-WAVE','v34.39.8 — HOME-MINBTN','v34.39.9 — HOME-CALM2','v34.39.10 — HOME-NOFRAME','v34.39.11 — HOME-ICONTRIO'].every(function(m){ return home.split(m).length === 2; }));
T('۳.۳ VERSION.json = v34.39.30', JSON.parse(read('VERSION.json')).crm_version === 'v34.39.30');
DONE('tester672-v34.39.30-icontrio');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
