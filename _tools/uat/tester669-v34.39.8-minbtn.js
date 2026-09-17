#!/usr/bin/env node
'use strict';
/* =============================================================================
   tester669 — v34.39.11 (HOME-MINBTN)
   درخواست کارفرما: «در دسکتاپ کلمهٔ نمای روز و کادر دور آن حذف، فقط آیکون ماه/خورشید؛
   در زبان هم کلمهٔ EN حذف و فقط آیکون پرچمِ مینیمال، کادر هم حذف.»
   قرارداد:
   ① دسکتاپ (>۷۹۰): کلید تم = آیکون ۴۲px بی‌قابِ شفاف در انتهای نوبار؛ برچسب display:none
   ② پرچم SVG اینلاین (یونیون‌جک مینیمال) به‌جای اموجی+EN — روی ویندوز هم رندر می‌شود
   ③ لینک href="en/" و aria-label حفظ شده‌اند (SEO/دسترس‌پذیری)؛ onmouseover اینلاین حذف
   ④ بودجه: home.css < ۴۰٬۰۰۰ نویسه؛ مارکرِ هر هشت لایه یکتا
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
var i0 = home.indexOf('v34.39.8 — HOME-MINBTN');
var lay = i0 > -1 ? home.slice(i0) : '';

SECTION('کلید تمِ فقط‌آیکون در دسکتاپ');
T('۰.۱ لایهٔ HOME-MINBTN پس از HOME-WAVE است', i0 > -1 && i0 > home.indexOf('v34.39.6 — HOME-WAVE'));
T('۱.۱ مدیای دسکتاپ: ۴۲px، بدون border/بک‌گراند/سایه، گریدِ مرکزی',
  lay.indexOf('@media(min-width:791px){#mainNav .theme-toggle{width:42px;height:42px;padding:0;border:0!important;background:transparent;box-shadow:none;display:grid;place-items:center}') > -1);
T('۱.۲ برچسبِ «نمای شب/روز» در دسکتاپ مخفی',
  lay.indexOf('#mainNav .theme-toggle .tt-txt{display:none}') > -1);
T('۱.۳ شب: رنگ آیکونِ روشن (بدون بکس/بدرِ کورکننده)',
  lay.indexOf('html.ptf-dark #mainNav .theme-toggle{color:#cfe0f5}') > -1);
T('۱.۴ هاورِ موجود (آبنِ کهرباییِ ۲۴٪ از ۳۹.۲) بدون تغییرِ مارکرِ شیت باقی است',
  home.indexOf('#mainNav .theme-toggle:hover{background:rgba(247,148,0,.12)') > -1 &&
  home.indexOf('#mainNav .theme-toggle{position:absolute;top:10px;left:10px;width:42px;height:42px;padding:0;border:0!important') > -1);

SECTION('پرچمِ زبان');
T('۲.۱ اموجی و کلمهٔ EN حذف؛ لینک href="en/" حفظ',
  idx.indexOf('🇬🇧') === -1 && idx.indexOf('href="en/" class="lang-switch"') > -1 && !/>EN</.test(idx));
T('۲.۲ پرچمِ SVG اینلاین با viewBox و یونیون‌جکِ مینیمال (۵ شکل + clipPath)',
  /class="lang-switch"[^>]*><svg viewBox="0 0 60 45"[^>]*>[\s\S]{0,700}?#012169[\s\S]{0,300}?#C8102E/.test(idx));
T('۲.۳ نامِ دسترس‌پذیری و title (aria-label انگلیسی)',
  idx.indexOf('aria-label="English — نسخه انگلیسی"') > -1 && idx.indexOf('title="English"') > -1);
(function(){ var a=idx.slice(idx.indexOf('class="lang-switch"'), idx.indexOf('</a>', idx.indexOf('class="lang-switch"')));
  T('۲.۴ هندلِرِ onmouseover/onmouseout اینلاینِ لینکِ زبان حذف (هاور به CSS منتقل شد)', a.indexOf('onmouseover') === -1 && a.indexOf('onmouseout') === -1); })();
T('۲.۵ CSS: کادر/پس‌زمینهٔ قرصی حذف — بستر شفاف با هاورِ ملایمِ روز و شب',
  home.indexOf('.lang-switch{width:42px;height:42px;display:inline-grid!important;place-items:center;border-radius:50%;background:transparent!important}') > -1 &&
  home.indexOf('.lang-switch:hover{background:rgba(239,75,26,.12)!important}') > -1 &&
  home.indexOf('html.ptf-dark .lang-switch{color:#cfe0f5}') > -1 &&
  home.indexOf('html.ptf-dark .lang-switch:hover{background:rgba(255,176,51,.13)!important}') > -1);

SECTION('قراردادهای کلی');
T('۳.۱ cache-bust روی v34.39.14', /home\.css\?v=34\.39\.14/.test(idx) && /ptf-motion\.js\?v=34\.39\.14" defer/.test(idx));
T('۳.۲ بودجه و آکولاد: home.css<۴۰K متوازن', home.length < 40000 && home.split('{').length === home.split('}').length);
T('۳.۳ مارکرِ هر هشت لایه یکتا', ['v34.39.0 — HOME-DYNAMIC-X','v34.39.1 — HOME-ELECTRIC-3D','v34.39.2 — HOME-DOCK-SUN','v34.39.3 — HOME-NIGHT-READ','v34.39.4 — HOME-ACCORD-NIGHTMEGA','v34.39.5 — HOME-ICONMIN','v34.39.6 — HOME-WAVE','v34.39.8 — HOME-MINBTN'].every(function(m){ return home.split(m).length === 2; }));
T('۳.۴ رگرسیون‌زدا: موجِ پنل، آیکونِ شیت، آکاردئون، مگای شب، canonical‌ها، no-repeat',
  home.indexOf('background-repeat:no-repeat') > -1 &&
  /#mainNav \.nav-drop\.open>\.nav-drop-menu\{max-height:240px/.test(home) &&
  home.indexOf('html.ptf-dark #mainNav .nav-mega') > -1 &&
  idx.indexOf('href="tel:02146087679"') > -1 && idx.indexOf('wa.me/989925868479') > -1);
T('۳.۵ VERSION.json = v34.39.11', JSON.parse(read('VERSION.json')).crm_version === 'v34.39.11');

DONE('tester669-v34.39.11-minbtn');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
