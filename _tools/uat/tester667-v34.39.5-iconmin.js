#!/usr/bin/env node
'use strict';
/* =============================================================================
   tester667 — v34.39.40 (HOME-ICONMIN)
   گزارش کارفرما:
     «جستجو از منو حذف شود؛ در موبایل کادر دور کلید شب/روز حذف و فقط آیکون شود؛
     انتخابِ دستیِ روز در شب بعد از چند ثانیه به شب برمی‌گشت (باگ)؛ تماس/واتس‌اپ
     — شماره‌ها تأیید شد، لینک‌ها همان canonical‌های سایت‌اند.»
   قراردادها:
   ① SHEET-NO-SEARCH — پیوند «جستجو» (تزریق ptf-discover) در شیت موبایل با
     #mainNav .nav-search{display:none!important} حذف نمایشی؛ DOM دست‌نخورده.
   ② ICON-ONLY-TOGGLE — کلید تم در شیت = آیکونِ ۴۲px بی‌قاب (بدون border/bg/shadow،
     بدون برچسبِ tt-txt) گوشهٔ چپ‌بالای شیت؛ دسکتاپ همان قرصِ برچسب‌دار.
   ③ PERSIST-FIX — اوررایدِ دستی در حافظه (memManual) قفل می‌شود و بازبینیِ
     هر-دقیقه آن را گشود نمی‌کند؛ کوکی best-effort (در iframeهای سخت‌گیر کوکی
     third-party مسدود است — پیش‌تر همین باعث برگشت بود).
   ④ NUMBERS — داک/هدر/واتساپ = همان شماره‌های رسمی سایت (تأیید کارفرما).
   ============================================================================= */
require('./harness');
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf-8'); }
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function SECTION(s) { console.log('\n── ' + s + ' ──'); }

var idx = read('index.html');
var home = read('assets/css/home.css');
var motion = read('assets/js/ptf-motion.js');
var i0 = home.indexOf('v34.39.5 — HOME-ICONMIN');
var lay = i0 > -1 ? home.slice(i0) : '';

SECTION('۰. لایه');
T('۰.۱ لایهٔ HOME-ICONMIN پس از ۳۹.۴ است', i0 > -1 && i0 > home.indexOf('v34.39.4 — HOME-ACCORD-NIGHTMEGA'));

SECTION('① حذف جستجو از شیت');
T('۱.۱ مخفیِ سراسریِ .nav-search (v34.39.40 هدر دسکتاپ هم پوشش داده شد)',
  /\.nav-search\{display:none!important\}/.test(home));
T('۱.۲ DOM/تزریق‌کننده دست‌نخورده (پیمایش دسکتاپِ جستجو باقی است)',
  read('assets/js/ptf-discover.js').indexOf('a.className = "nav-search"') > -1 &&
  idx.indexOf('id="mainNav"') > -1);

SECTION('② کلید تمِ فقط‌آیکونی در شیت');
T('۲.۱ بی‌قاب مطلق ۴۲px گوشهٔ شیت',
  lay.indexOf('#mainNav .theme-toggle{position:absolute;top:10px;left:10px;width:42px;height:42px;padding:0;border:0!important') > -1);
T('۲.۲ برچسبِ متنی در شیت پنهان؛ دسکتاپ قرصِ برچسب‌دار سالم',
  lay.indexOf('#mainNav .theme-toggle .tt-txt{display:none}') > -1 &&
  /@media\(min-width:791px\)\{\s*#mainNav \.theme-toggle\{height:34px/.test(home));
T('۲.۳ پالت شب هم بی‌قاب (شفاف) + هایلایت لمسی',
  lay.indexOf('html.ptf-dark #mainNav .theme-toggle{background:transparent;border:0;color:#cfe0f5}') > -1 &&
  /#mainNav \.theme-toggle:hover,#mainNav \.theme-toggle:focus-visible\{background:rgba\(247,148,0,\.12\)/.test(lay));
T('۲.۴ reduce: بدون ترنزیشن/اسکیل',
  lay.indexOf('@media (prefers-reduced-motion: reduce){#mainNav .theme-toggle,#mainNav .theme-toggle:hover{transition:none;transform:none}') > -1);

SECTION('③ فیکسِ بازگشتِ تم (انتخابِ دستی محبوس می‌شد)');
T('۳.۱ قفلِ حافظه‌ای: memManual قبل از کوکی خوانده می‌شود',
  motion.indexOf("var memManual = '';") > -1 &&
  motion.indexOf('if (memManual) return memManual;') > -1);
T('۳.۲ تاگلِ دستی هم حافظه هم کوکی (best-effort) را ست می‌کند',
  motion.indexOf("if (persist) { memManual = dark ? 'dark' : 'light'; try { doc.cookie = 'ptf_theme='") > -1);
T('۳.۳ نگهبانِ بازبینیِ هر-دقیقه همان manualTheme است → در iframe هم دیگر گشود نمی‌شود',
  /win\.setInterval\(function \(\) \{\s*if \(manualTheme\(\) \|\| doc\.hidden\) return;/.test(motion));
T('۳.۴ بوت head بی‌تغییر: اولویتِ کوکی سپس خورشیدِ NOAA',
  idx.indexOf('if(m){dark=m[1]==="dark"}else{') > -1 && idx.indexOf('Math.floor(jd-0.5)-2451544') > -1);
T('۳.۵ صفر localStorage (کوکی تنها راهِ ماندگاریِ پایدار — A10)',
  !/localStorage\.(get|set)Item/.test(motion));

SECTION('④ شماره‌های رسمی (تأیید کارفرما)');
T('۴.۱ داک تماس = تلفن رسمی سایت و همان tel در هدر/فوتر/JSON-LD',
  /<a href="tel:02146087679" data-ptf-event="dock_call"/.test(idx) &&
  (idx.match(/href="tel:02146087679"/g) || []).length >= 3 &&
  idx.indexOf('"+982146087679"') > -1);
T('۴.۲ داک واتساپ = همان wa.me رسمی (+موبایل 09925868479 با همان لینک شناور)',
  /class="dock-wa"[^>]*aria-label="واتس‌اپ"|href="https:\/\/wa\.me\/989925868479\?[^"]*" target="_blank" rel="noopener" class="dock-wa"/.test(idx) &&
  (idx.match(/wa\.me\/989925868479/g) || []).length >= 2);
T('۴.۳ هر دو آیتمِ داک لینکِ واقعی‌اند (<a href>) نه دکمهٔ تزئینی',
  /id="ptfDock"[\s\S]*?<a href="tel:02146087679"[\s\S]*?<a href="https:\/\/wa\.me\//.test(idx));

SECTION('⑤ قرارداد کلی');
T('۵.۱ cache-bust روی v34.39.14', /home\.css\?v=34\.39\.14/.test(idx) && /ptf-motion\.js\?v=34\.39\.14" defer/.test(idx));
T('۵.۲ حجم‌ها زیر بودجه‌ها (home.css<۴۰K، ptf-motion<۱۲K)', home.length < 40000 && motion.length < 12000);
T('۵.۳ پارس JS + تعادلِ آکولادِ CSS', (function () {
  try { new Function(motion); new Function(read('assets/js/main.js')); } catch (e) { return false; }
  return home.split('{').length === home.split('}').length;
})());
T('۵.۴ رگرسیون‌زدا: reparent شیت، z-index، آکاردئونِ درباره‌ما، مگای شب، برقِ آرام، اعداد فارسی',
  motion.indexOf('doc.body.insertBefore(nav, bd2)') > -1 && /#mainNav\{z-index:9535/.test(home) &&
  /#mainNav \.nav-drop\.open>\.nav-drop-menu\{max-height:240px/.test(home) &&
  home.indexOf('html.ptf-dark #mainNav .nav-mega') > -1 &&
  /animation:ptfCurS 26s linear infinite/.test(home) && /<b>۳<\/b>/.test(idx) && /<b>۶\+<\/b>/.test(idx));
T('۵.۵ نگهبان بی‌تغییری: h1/canonical/۱۰‌بخش/صفر CDN',
  idx.indexOf('تامین‌کننده تجهیزات صنعتی — تجهیزات حیاتی پروژه‌ها را <strong>مطمئن، سریع و دقیق</strong> تامین کنید') > -1 &&
  /rel="canonical" href="https:\/\/pishtaj\.ir\/"/.test(idx) &&
  ['home', 'journey', 'why-ptf', 'about', 'services', 'brands', 'projects', 'stats', 'home-faq', 'contact'].every(function (id) { return idx.indexOf('id="' + id + '"') > -1; }) &&
  !/<(script|link)[^>]+src="https?:/.test(idx));
T('۵.۶ VERSION.json = v34.39.40', JSON.parse(read('VERSION.json')).crm_version === 'v34.39.40');

DONE('tester667-v34.39.40-iconmin');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
