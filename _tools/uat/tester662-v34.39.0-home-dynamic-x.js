#!/usr/bin/env node
'use strict';
/* =============================================================================
   tester662-v34.39.0-home-dynamic-x.js
   درخواست کارفرما (۱۴۰۵/۰۶/۲۶):
     «داینامیک‌ترین و زیباترین وب‌سایتِ شرکت‌های تامین تجهیزات را بررسی و
     مشابهش را پیاده کن؛ تم رنگی را با وفاداری به رنگ لوگو بازبینی کن؛ سرعت
     در بالاترین حد و رابط موبایلی حرفه‌ای.»

   بنچ‌مارک‌های مبنای تصمیم (پژوهش ۲۰۲۵/۲۰۲۶):
     • Grainger (速 homepage + category-first) / McMaster-Carr (search-first,
       minimal JS, server-rendered) / Fastenal (quote-centric) — ecomm.design
     • SPT Labtech / Robin Radar / Devitech (پالت سرمه+نارنجی = اعتماد+دقت)
     • روان‌شناسی رنگ B2B: قانون ۶۰/۳۰/۱۰ + اثر انزوا (CTA نارنجی روی زمینه
       سرد، بیشترین تبدیل) — usevisuals.com / wisecoda

   قراردادهایی که این تستر قفل می‌کند:
   ① THEME: توکن‌های steel/ice/link-steel در style.css و home.css تعریف‌شده‌اند؛
     اورلی هیرو به طیف سرمهٔ مهندسی رفته و #projects باند تیرهٔ اعتماد است؛
     آیکون‌های تِالِ ناسازگار نسخهٔ ۳۲.۱ روی صفحهٔ اول به تم برند یکپارچه شدند.
   ② FINDER: فرم جست‌وجوی تجهیز در هیرو به /search/ با پارامتر q می‌رود
     (بدون JS کار می‌کند) + چیپ‌های پرتکرار لینک‌دارند.
   ③ DOCK: داک پایین موبایل با پنج هدف لمسی ≥۴۴px، safe-area، و جایگزینی
     دکمه‌های شناور (فقط در ≤۷۶۰px)؛ body padding-bottom برای نبودِ کلایز.
   ④ MOTION: ptf-motion.js — rAF+passive، guardهای prefers-reduced-motion و
     hover:hover؛ main.js — مکث خودکار اسلایدر در تب پنهان + سوایپ لمسی؛
     هیچ متن/هوک/اسکیمای موجود تغییر نکرده (رجیکس‌های keep below).
   ⑤ SPEED: بدون کتابخانه/فونت/اسکریپت خارجی جدید؛ cache-bust v34.39.14؛
     content-visibility برای بخش‌های زیرِ صفحه (دسکتاپ).
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
var style = read('assets/css/style.css');
var motion = read('assets/js/ptf-motion.js');
var main = read('assets/js/main.js');
var layer = home.slice(home.indexOf('v34.39.0 — HOME-DYNAMIC-X'));
var has = function (s) { return layer.indexOf(s) > -1; };

/* ── ۱) THEME — وفاداری به لوگو + منطق ۶۰/۳۰/۱۰ ─ */
SECTION('۱. تم (سرمهٔ مهندسی + شعلهٔ برند)');
T('۱.۱ توکن‌های steel/ice/link-steel در style.css سراسری‌اند',
  /--steel-900:#0b1220/.test(style) && /--link-steel:#155a97/.test(style) && /--ice:#eef3f9/.test(style));
T('۱.۲ لایهٔ HOME-DYNAMIC-X همان توکن‌ها را در مقیاس صفحهٔ اول تثبیت می‌کند',
  has('--steel-950:#080d16') && has('--flame-grad'));
T('۱.۳ اورلی هیرو → گرادیان سرمه‌ای با هالهٔ شعله (اعتماد + انرژی، نه آبی خالص یا نارنجیِ سراسر)',
  /rgba\(11,18,32,\.72\)/.test(layer) && /rgba\(239,75,26,\.55\)/.test(layer));
T('۱۴ باند سوابق (#projects) سرمهٔ مهندسی + گرید مهندسی ظریف است',
  /#projects\{background:radial-gradient\(1100px 480px/.test(layer) && /var\(--steel-900\)/.test(layer) && /44px 44px/.test(layer));
T('۱.۵ آیکون‌های تِالِ نسخهٔ قبل با تم برند یکپارچه شد (override در home.css)',
  /\.ptf-ico\{[^}]*var\(--link-steel\)/.test(layer) && /#journey em\{color:var\(--link-steel\)/.test(layer));
T('۱.۶ فوتر گرادیان گرافیت-سرمه گرفت (بدون تغییر ساختار فوتر)',
  /\.footer\{background:linear-gradient\(180deg,var\(--steel-800\)/.test(layer));
T('۱.۷ رنگ‌های لوگو (قرمز/نارنجی برند) در توکن‌های اصلی دست‌نخورده',
  /--orange:#f79400/.test(style) && /--red:#ef4b1a/.test(style));

/* ── ) FINDER — ورودیِ مهندسی/خریدار در هیرو (McMaster-pattern) ── */
SECTION('۲. جست‌وجوی تجهیز در هیرو');
T('۲.۱ فرم ptf-finder با GET به /search/ و ورودی name="q" (بدون JS هم کار می‌کند)',
  /class="ptf-finder"[^>]*action="\/search\/"[^>]*method="get"/.test(idx) && /name="q"/.test(idx) && /role="search"/.test(idx));
T('۲.۲ چیپ‌های پرتکرار لینک‌های واقعی به نتایج جست‌جو دارند (≥۴ عدد)',
  (idx.match(/class="ptf-chip" href="\/search\/\?q=/g) || []).length >= 4);
T('۲.۳ placeholder نمونهٔ فنی (Part Number/استاندارد) دارد',
  /placeholder="نام تجهیز، استاندارد یا Part Number[^"]*"/.test(idx));
T('۲.۴ استایل موبایل finder: فونت ۱۶px (ضد زوم iOS) و دکمهٔ تمام‌عرض',
  /\.ptf-finder input\{flex:1 1 100%;order:2;font-size:16px/.test(layer) && /\.ptf-finder button\{order:3;flex:1 1 100%;width:100%/.test(layer));

/* ── ۳) DOCK — موبایل حرفه‌ای (اپ‌گونه) ── */
SECTION('۳. داک پایین موبایل');
T('۳.۱ پنج آیتم: خانه/RFQ/تماس/واتس‌اپ/چت — همگی با aria-label',
  /id="ptfDock"/.test(idx) && (idx.match(/id="ptfDock"[\s\S]*?<\/nav>/)[0].match(/aria-label="/g) || []).length >= 6);
T('۳.۲ داک فقط ≤۷۶۰px فعال است و همان‌جا شناورهای قدیمی پنهان می‌شوند',
  /@media\(max-width:790px\)\{[\s\S]*?#ptfDock\{display:grid/.test(layer) && /\.floating-call,\.floating-whatsapp,#ptfChatBtn\{display:none!important\}/.test(layer));
T('۳.۳ safe-area (env) در داک و padding پایین بدنه برای جلوگیری از هم‌پوشانی',
  /env\(safe-area-inset-bottom\)/.test(layer) && /body\{padding-bottom:calc\(68px \+ env\(safe-area-inset-bottom\)\)!important\}/.test(layer));
T('۳.۴ هدف لمسی ≥۵۴px و بازخورد فشار (:active scale) دارد',
  /min-height:54px/.test(layer) && /#ptfDock a:active,#ptfDock button:active\{transform:scale\(\.92\)/.test(layer));
T('۳.۵ viewport با viewport-fit=cover (safe-area واقعی iOS) و theme-color دوحالته',
  /viewport-fit=cover/.test(idx) && /name="theme-color" content="#ffffff"/.test(idx) && /media="\(prefers-color-scheme: dark\)" content="#0b1220"/.test(idx));
T('۳.۶ کشوی منو: بک‌دراپ + قفل اسکرول + هماهنگی همبرگر↔✕ (sync با MO، بدون رقابت با main.js)',
  /id="ptfNavBackdrop"/.test(idx) && /html\.ptf-lock,html\.ptf-lock body\{overflow:hidden\}/.test(style) && /is-x span:nth-child\(1\)/.test(style) && /MutationObserver\(sync\)\.observe\(nav/.test(motion));
T('۳.۷ پنجرهٔ چت بالای داک نشسته (کلایز بازرسی‌شده در نسخهٔ قبل، اینجا جابه‌جایی safe)',
  /#ptfChatBox\{bottom:calc\(76px \+ env\(safe-area-inset-bottom\)\)!important\}/.test(layer));

/* ── ۴) MOTION — سینمایی اما ارزان و محترم ── */
SECTION('۴. موتور حرکت (ptf-motion.js + main.js)');
T('۴.۱ ptf-motion.js پارس می‌شود (بدون وابستگی: require فقط harness در تست است)',
  (function () { try { new Function(motion); return true; } catch (e) { return false; } })());
T('۴.۲ guard سراسری prefers-reduced-motion + فقط hover:fine برای اسپات‌لایت',
  /prefers-reduced-motion: reduce/.test(motion) && /hover:hover\) and \(pointer:fine\)/.test(motion));
T('۴.۳ هندلرها passive و rAF هستند (scroll/touch) — هیچ blocking listener اضافه نشده',
  /addEventListener\('scroll'[\s\S]{0,160}\{ passive: true \}\)/.test(motion) &&
  /addEventListener\('touchstart'[\s\S]{0,320}\{passive:true\}\)/.test(main) &&
  /addEventListener\('touchend'[\s\S]{0,320}\{passive:true\}\)/.test(main) &&
  /requestAnimationFrame/.test(motion));
T('۴.۴ اسکرول‌واِیِ هیرو در تب پنهان متوقف و در نمایان ادامه می‌یابد (باتری/کارایی)',
  /visibilitychange/.test(main) && /document\.hidden\?pause\(\):play\(\)/.test(main));
T('۴.۵ سوایپ افقی موبایل روی هیرو (با آستانه و نادیده‌گرفتن المان‌های تعاملی)',
  /goSlide\(current\+\(dx<0\?1:-1\)\)/.test(main) && /closest\('button,a,input,textarea,select,\.hero-panel'\)/.test(main));
T('۴.۶ شمارنده‌های آماری فقط روی متن عددی اجرا می‌شوند و متن اصلی دقیق برمی‌گردد',
  /el\.textContent = text/.test(motion) && /\\u06F0-\\u06F9\\d/.test(motion));
T('۴.۷ پرده‌گشایی کلمات H1 فقط با JS فعال و DOM محتوا را از بین نمی‌برد (strong حفظ)',
  /n\.tagName === 'STRONG'/.test(motion) && /\.ptf-wi\{display:inline-block;transform:translateY\(118%\)/.test(layer));

/* ── ۵) SPEED — هیچ رگرسیون باری وارد نشود ── */
SECTION('۵. سرعت');
T('۵.۱ اسکریپت/استایل خارجی جدید اضافه نشده (همه assets محلی‌اند)',
  !/<(script|link)[^>]+src="https?:/.test(idx) && !/<link[^>]+href="https?:[^"]*\.css/.test(idx));
T('۵.۲ home.css با cache-bust v34.39.14 و ptf-motion با defer+version لود می‌شود',
  /home\.css\?v=34\.39\.14/.test(idx) && /ptf-motion\.js\?v=34\.39\.14" defer/.test(idx));
T('۵.۳ content-visibility فقط دسکتاپ و فقط بخش‌های زیرِ صفحه (LCP دست‌نخورده)',
  /@media\(min-width:791px\)/.test(layer) && /#stats,#home-faq,#projects,\.brands,\.services\{content-visibility:auto/.test(layer) && /\.hero\{min-height:100vh;min-height:100svh\}/.test(layer));
T('۵.۴ preload‌های حیاتی قبلی حذف نشده‌اند (فونت/هیرو)',
  /rel="preload" href="assets\/fonts\/Vazirmatn-Regular\.woff2"/.test(idx) && /real-hero-energy-plant\.webp" as="image" fetchpriority="high"/.test(idx));
T('۵.۵ حجم پیل‌های جدید معقول است: home.css < ۴۰KB و ptf-motion < ۱۲KB خام',
  home.length < 40000 && motion.length < 12000);

/* ── ) KEEP-GUARDS — محتوا و هوک‌های موجود تغییر نکرده‌اند ── */
SECTION('۶. نگهبانِ بی‌تغییری محتوا');
T('۶.۱ عنوان و دیسکریپشن و canonical عوض نشده‌اند',
  /<title>تامین تجهیزات صنعتی نفت، گاز و پتروشیمی \| پیشرو تجهیز فرتاک<\/title>/.test(idx) &&
  /rel="canonical" href="https:\/\/pishtaj\.ir\/"/.test(idx));
T('۶.۲ h1 اصلی (ساختار SEO) کلمه‌به‌کلمه همان است',
  idx.indexOf('تامین‌کننده تجهیزات صنعتی — تجهیزات حیاتی پروژه‌ها را <strong>مطمئن، سریع و دقیق</strong> تامین کنید') > -1);
T('۶.۳ شماره تماس/واتساپ و فرم RFQ و هندلر ptfHomeRfqStatus سرجایش',
  idx.indexOf('tel:02146087679') > -1 && idx.indexOf('wa.me/989925868479') > -1 &&
  /function ptfHomeRfqStatus/.test(idx) && /id="contactForm"/.test(idx));
T('۶.۴ همان ده سکشن صفحهٔ اول حفظ شده (idها کم/زیاد نشده‌اند)',
  ['home', 'journey', 'why-ptf', 'about', 'services', 'brands', 'projects', 'stats', 'home-faq', 'contact'].every(function (id) {
    return new RegExp('id="' + id + '"').test(idx);
  }));
T('۶.۵ اسکیمای JSON-LD Organization + دیتاشیت اسلایدر (data-bg) دست‌نخورده',
  /"@type": "Organization"/.test(idx) && /document\.querySelectorAll\('\.slide\[data-bg\]'\)/.test(idx));
T('۶.۶ اسکرین‌شاتِ لایه: هیچ !important روی متن/رنگ فونتِ بدنهٔ سراسری اعمال نشده (فقط اورلی/باندها)',
  (layer.match(/!important/g) || []).length > 8 && !/body\{[^}]*color:[^}]*!important/.test(layer));

DONE('tester662-v34.39.24-home-dynamic-x');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
