#!/usr/bin/env node
'use strict';
/* =============================================================================
   tester663 — v34.39.1 (HOME-ELECTRIC-3D)
   دستور کارفرما:
     «جریان برق روی کارت‌ها/دکمه‌ها؛ هاور رنگی زیبا؛ حذف منوی بالای موبایل و
     انتقال به شیت پایین؛ انیمیشن منوها؛ کلید روز/شب؛ RFQ از داک حذف و دکمهٔ
     منو وسط با جلوه سه‌بعدی؛ فلش‌های مینیمال‌تر؛ اعداد پنل هیرو فارسی.»
   قراردادها:
   ① CURRENT-RING — حلقهٔ جریان فقط زیر media(no-preference)؛ دائم روی دکمه‌های
     اصلی/داک، هاور روی کارت‌ها؛ همه CSS خالص، صفر JS اضافه.
   ② MOBILE-NAV-SHEET — menu-toggle در ≤۷۹ حذف؛ #mainNav شیت پایین بالای داک
     با استگر ورودی؛ داک پنج‌تایی منومحور بدون RFQ.
   ③ THEME — کلید هدر + بوت‌استرپ کوکی در head (بدون localStorage — A10) +
     پالت html.ptf-dark + هماهنگی theme-color.
   ④ ARROWS/NUMBERS — درپوش <i class="arw"> و اعداد فارسی پنل.
   ⑤ KEEP — محتوای حیاتی (h1/canonical/tel/wa/۱۰بخش/مسیر RFQ) سرجا.
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
var i0 = home.indexOf('v34.39.1 — HOME-ELECTRIC-3D');
T('۰.۱ لایهٔ HOME-ELECTRIC-3D در home.css موجود است', i0 > -1);
var lay = home.slice(i0);

SECTION('۱. جریان برق + هاور رنگی');
T('۱.۱ کیفریم جریان + فقط زیر no-preference',
  /@media \(prefers-reduced-motion: no-preference\)/.test(lay) &&
  /@keyframes ptfCur\{from\{background-position:220% 0\}to\{background-position:-240% 0\}\}/.test(lay));
T('۱.۲ حلقهٔ دائم روی .btn-primary/.header-call/CTA داک/چت داک/دکمهٔ فایندر',
  lay.indexOf('.btn-primary::before,.header-call::before,#ptfDock .dock-cta::before,#ptfDockChat::before,.ptf-finder button::before') > -1);
T('۱.۳ حلقهٔ هاور روی کارت‌های خدمات/مسیر/چرایی',
  /\.service-card::after,#journey a\.reveal::after,#why-ptf div\.reveal::after/.test(lay) &&
  /\.service-card:hover::after,#journey a\.reveal:hover::after,#why-ptf div\.reveal:hover::after\{opacity:\.95;animation:ptfCur 2\.2s linear infinite\}/.test(lay));
T('۱.۴ کاهش‌حرکت: ارجاع خاموش‌کننده در بلاک reduce انتهای لایه',
  lay.slice(lay.lastIndexOf('prefers-reduced-motion: reduce')).indexOf('.btn-primary::before') > -1);
T('۱.۵ هاور رنگی: گرادیان کرمی کارت + لیفت فیلتر دکمه + تب‌ها زیر media(hover)',
  /\.service-card:hover\{background:linear-gradient\(180deg,#fff,#fff6e9\)/.test(lay) &&
  /\.btn-ghost:hover\{background:rgba\(247,148,0,\.30\)/.test(lay) &&
  /@media \(hover:hover\)\{/.test(lay));

SECTION('۲. موبایل: شیت پایین + داک منومحور');
T('۲.۱ دکمهٔ منوی بالا ≤۷۹۰ حذف', /\.menu-toggle\{display:none!important\}/.test(lay));
T('۲.۲ شیت پایین بالای داک با استگر ورودی و اسکرول داخلی',
  /#mainNav\{top:auto!important;bottom:calc\(86px \+ env\(safe-area-inset-bottom\)\)!important/.test(lay) &&
  /#mainNav\.open>\*\{animation:ptfSheetItem \.42s cubic-bezier\(\.16,1,\.3,1\) both\}/.test(lay));
T('۲.۳ داک پنج‌تایی و بدون RFQ', (function () {
  var block = (idx.match(/id="ptfDock"[\s\S]*?<\/nav>/) || [''])[0];
  var items = (block.match(/<a |<button /g) || []).length;
  return items === 5 && block.indexOf('href="rfq/"') === -1 && block.indexOf('ptfDockMenu') > -1;
})());
T('۲.۴ منو وسط است (بعد از تماس، قبل از واتس‌اپ) با dock-cta و مروف ✕',
  /data-ptf-event="dock_call"[\s\S]*?<button type="button" id="ptfDockMenu" class="dock-cta"[\s\S]*?class="dock-wa"/.test(idx) &&
  /#ptfDockMenu\.is-x \.dm-bars i:nth-child\(1\)\{top:6px;transform:rotate\(45deg\)\}/.test(lay) &&
  /#ptfDockMenu\.is-x \.dm-bars i:nth-child\(3\)/.test(lay));
T('۲.۵ مسیر استعلام حفظ شده (منوی بالا + هیرو) — «استعلام کافیه»',
  /<a href="rfq\/">استعلام<\/a>/.test(idx) && /<a class="btn btn-primary" href="rfq\/">/.test(idx));
T('۲.۶ JS: تاگل شیت از داک + sync دکمهٔ مخفیِ اصلی + بک‌دراپ/ESC',
  /dm\.addEventListener\('click', function \(\) \{ nav\.classList\.toggle\('open'\); \}\)/.test(motion) &&
  /var dm = doc\.getElementById\('ptfDockMenu'\)/.test(motion));
T('۲.۷ داک هنگام باز بودن شیت مخفی نمی‌شود',
  /var sheetOpen = nav && nav\.classList\.contains\('open'\)/.test(motion));
T('۲.۸ قفل اسکرول کشو سراسری در style.css (ترجیح موبایل ≤۷۹۰)',
  /@media\(max-width:790px\)\{html\.ptf-lock,html\.ptf-lock body\{overflow:hidden\}\}/.test(style));

SECTION('۳. روز/شب');
T('۳.۱ کلید تم در هدر، قبل از سوییچ زبان، با aria-pressed',
  /id="ptfThemeToggle"[^>]*aria-pressed="false"/.test(idx) && idx.indexOf('ptfThemeToggle') < idx.indexOf('class="lang-switch"'));
T('۳.۲ بوت‌استرپ ضدFOUC با کوکی در head (A10-safe؛ بدون localStorage)',
  idx.indexOf('ptf_theme=(dark|light)') > -1 && idx.indexOf('document.documentElement.className+=" ptf-dark"') > -1 &&
  idx.indexOf('document.documentElement.className+=" ptf-dark"') < idx.indexOf('</head>'));
T('۳.۳ ماندگاری فقط با کوکی؛ ptf-motion هیچ فراخوانی localStorage ندارد',
  motion.indexOf("doc.cookie = 'ptf_theme='") > -1 && !/localStorage\.(get|set)Item/.test(motion));
T('۳.۴ پالت شب: بدنه/کارت/فرم/داک/شیت + فلش‌های آبی‌روشن',
  /html\.ptf-dark body\{background:#0a1120;color:#d7e0ef\}/.test(lay) &&
  /html\.ptf-dark #contactForm input/.test(lay) && /html\.ptf-dark #ptfDock\{/.test(lay) &&
  /html\.ptf-dark #mainNav\{/.test(lay));
T('۳.۵ ترجیح سیستم فقط بار اول (نبود کوکی) و sync تگ theme-color',
  idx.indexOf('m?m[1]==="dark":!!(window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches)') > -1 &&
  /mc\.setAttribute\('content', dark \? '#0a1120' : '#ffffff'\)/.test(motion));

SECTION('۴. فلش‌ها + اعداد + سه‌بعدی');
T('۴.۱ درپوش arw برای ←/→ انتهای لینک‌ها (متن بدون JS سالم)',
  motion.indexOf('class="arw"') > -1 && /\.arw\{display:inline-block/.test(lay) &&
  /a:hover \.arw,\.btn:hover \.arw\{transform:translateX\(-5px\);opacity:1/.test(lay));
T('۴.۲ اعداد فارسی پنل هیرو: ۳ و ۶+',
  /<b>۳<\/b><span>دپارتمان تامین<\/span>/.test(idx) && /<b>۶\+<\/b><span>صنعت هدف<\/span>/.test(idx));
T('۴.۳ سه‌بعدی: perspective گرید + rx/ry از JS + translateZ بدنهٔ کارت + لیفت دکمه‌ها',
  /\.service-cards\{perspective:1500px\}/.test(lay) &&
  /service-card\.ptf-lift\{transform:perspective\(1050px\) rotateX\(var\(--rx,1\.5deg\)\) rotateY\(var\(--ry,0deg\)\)/.test(lay) &&
  /setProperty\('--rx'/.test(motion) && /card-body\{transform:translateZ\(26px\)\}/.test(lay) &&
  /\.hero-actions \.btn:hover\{transform:perspective\(640px\) rotateX\(5deg\)/.test(lay));
T('۴.۴ پنل هیرو تیلت ملایم + سایهٔ فیزیکی داک CTA',
  /\.hero-panel:hover\{transform:rotateY\(-3deg\) rotateX\(2deg\) translateY\(-4px\)\}/.test(lay) &&
  /inset 0 1\.5px 0 rgba\(255,255,255,\.4\)/.test(lay));

SECTION('۵. قرارداد کلی');
T('۵.۱ cache-bust: home.css و ptf-motion روی v34.39.1',
  /home\.css\?v=34\.39\.1/.test(idx) && /ptf-motion\.js\?v=34\.39\.1" defer/.test(idx));
T('۵.۲ بدون اسکریپت/CDN خارجی جدید', !/<(script|link)[^>]+src="https?:/.test(idx));
T('۵.۳ پارس JS: ptf-motion و main.js', (function () {
  try { new Function(motion); new Function(read('assets/js/main.js')); return true; } catch (e) { return false; }
})());
T('۵.۴ حجم‌ها: home.css<۴۸KB، ptf-motion<۱۲KB', home.length < 48000 && motion.length < 12000);
T('۵.۵ تعادل هدر موبایل: تماس ≤۵۶ حذف و تم‌توگل ۴۰px',
  /@media\(max-width:560px\)\{\.header-call\{display:none!important\}\}/.test(lay) &&
  /@media\(max-width:790px\)\{\.theme-toggle\{width:40px;height:40px/.test(lay));
T('۵.۶ VERSION.json = v34.39.1', JSON.parse(read('VERSION.json')).crm_version === 'v34.39.1');
T('۵.۷ نگهبان بی‌تغییری: h1، canonical، tel/wa، ۱۰ بخش، theme-color دوحالته',
  idx.indexOf('تامین‌کننده تجهیزات صنعتی — تجهیزات حیاتی پروژه‌ها را <strong>مطمئن، سریع و دقیق</strong> تامین کنید') > -1 &&
  /rel="canonical" href="https:\/\/pishtaj\.ir\/"/.test(idx) &&
  idx.indexOf('tel:02146087679') > -1 && idx.indexOf('wa.me/989925868479') > -1 &&
  ['home', 'journey', 'why-ptf', 'about', 'services', 'brands', 'projects', 'stats', 'home-faq', 'contact'].every(function (id) { return idx.indexOf('id="' + id + '"') > -1; }) &&
  /name="theme-color" content="#ffffff"/.test(idx));

DONE('tester663-v34.39.1-home-electric-3d');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
