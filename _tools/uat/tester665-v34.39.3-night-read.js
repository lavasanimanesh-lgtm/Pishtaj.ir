#!/usr/bin/env node
'use strict';
/* =============================================================================
   tester665 — v34.39.22 (HOME-NIGHT-READ + Sheet-reparent)
   گزارش کارفرما:
     «در ویو موبایل روی دکمهٔ منو که می‌زنم فقط تار می‌شه و منو نمایش داده نمی‌شه؛
     برق دور چت هوشمند برداشته شود؛ تغییر رنگ کارت‌ها به سفید در شب نوشتهٔ برخی
     کارت‌ها را ناخوانا می‌کند؛ فونت پرسش‌های رایج ناخوانا؛ دکمهٔ استعلام ناخوانا؛
     قسمت رئیس هیئت‌مدیره ناخوانا.»
   قراردادها:
   ① SHEET-REPARENT — تنها فیکسِ قطعی در برابرِ هر containing-block سازِ ancestors:
     منتقل‌شدنِ خودِ گرهٔ #mainNav به body در ≤۷۹۰ (بدون تغییر محتوا؛ در >۷۹۰ برمی‌گردد)
     و z-index:9535 (بالای بک‌دراپ، زیر داک) تا ✕ همیشه قابل‌دسترس بماند.
   ② NO-RING-ON-DOCK-CHAT — #ptfDockChat از همهٔ لیست‌های current-ring بیرون؛
     هستهٔ سفید حلقهٔ دائم .95→.7 (ضد خیرگی روی متن ۱۰.۵px).
   ③ NIGHT-READ — هاور کارت‌ها/تراست/journey/why در شب = گرانیتِ گرم (نه سفید)؛
     summary پرسش‌های رایج روشن؛ خاکستری‌های درون‌خطیِ بیشتر (#475569/#60646d/#4b4d55)؛
     دکمهٔ استعلامِ داک در شب = سفیدِ خالص با فلرِ پرکنتراست + text-shadow.
   ④ KEEP — ردیف تم/ترتیب داک/غروب NOAA/ریتم ptfCurS بدون تغییر؛ A10؛ صفر کتابخانه.
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
var i0 = home.indexOf('v34.39.3 — HOME-NIGHT-READ');
var lay = i0 > -1 ? home.slice(i0) : '';

SECTION('۰. لایه و لنگرها');
T('۰.۱ لایهٔ HOME-NIGHT-READ پس از لایهٔ ۳۹.۲ آمده', i0 > -1 && i0 > home.indexOf('v34.39.2 — HOME-DOCK-SUN'));
T('۰.۲ هر چهار لایهٔ ۳۸.۲۵→۳۹.۳ بدون‌آسیب‌از‌بایکوتِ کامنت موجودند',
  ['v34.39.0 — HOME-DYNAMIC-X', 'v34.39.1 — HOME-ELECTRIC-3D', 'v34.39.2 — HOME-DOCK-SUN', 'v34.39.3 — HOME-NIGHT-READ'].every(function (m) { return home.indexOf(m) > -1; }));

SECTION('① REPARENT — فیکسِ نهایی «منو باز نمی‌شود»');
T('۱.۱ JS: ناوبری در ≤۷۹۰ قبلِ #ptfNavBackdrop به body منتقل می‌شود',
  motion.indexOf('doc.body.insertBefore(nav, bd2)') > -1);
T('۱.۲ شرطِ مچِ مدیا + بازگشت به nav-wrap در دسکتاپ',
  /var mqN = win\.matchMedia \? win\.matchMedia\('\(max-width:790px\)'\) : null;/.test(motion) &&
  motion.indexOf('nav.parentNode === wrap') > -1 &&
  motion.indexOf('wrap.appendChild(nav)') > -1);
T('۱.۳ گوش‌سپاری به change (افکت زندهٔ تغییر اندازه)',
  /mqN\.addEventListener\) mqN\.addEventListener\('change', placeNav\)/.test(motion));
T('۱.۴ z-index شیت = 9535 (بالای بک‌دراپ ۵۵، زیر داک ۹۵۴۰ تا ✕ مرئی/کلیک‌پذیر بماند)',
  /#mainNav\{z-index:9535;top:auto!important;bottom:calc\(86px \+ env\(safe-area-inset-bottom\)\)!important/.test(home));
T('۱.۵ همان گره، همان لینک‌ها — ساختارِ index تغییری نکرده (reparent فقط در JS)',
  (idx.match(/id="mainNav"/g) || []).length === 1 && idx.indexOf('doc.body') === -1);

SECTION('② حذف برقِ «چت هوشمندِ داک» + نرم‌سازی خیرگی');
T('۲.۱ #ptfDockChat::before هیچ‌جای home.css نیست (base + reduce)', home.indexOf('#ptfDockChat::before') === -1);
T('۲.۲ لیست دائم حلقه دقیقاً چهارهدفی شد',
  home.indexOf('.btn-primary::before,.header-call::before,#ptfDock .dock-cta::before,.ptf-finder button::before{content:') > -1);
T('۲.۳ هستهٔ سفیدِ حلقهٔ دائم .7 شد (نه .95) — متن ریز زیر فلاش گم نمی‌شود',
  home.indexOf('rgba(255,255,255,.7) 50%') > -1 && home.indexOf('rgba(255,255,255,.95) 50%') === -1);
T('۲.۴ بقیهٔ حلقه‌ها (CTA/فایندر/دکمه‌ها) دست‌نخورده‌اند',
  /animation:ptfCurS 26s linear infinite/.test(home) && /animation:ptfCurS 15s linear infinite/.test(home));

SECTION('③ خوانایی شب');
T('۳.۱ هاور کارت خدمات در شب = گرانیتِ گرم، تیتر کهربایی (نه سفیدِ کور)',
  /html\.ptf-dark \.service-card:hover\{background:linear-gradient\(180deg,#14203a,#1a2949\)/.test(lay) &&
  /html\.ptf-dark \.service-card:hover \.card-body h3\{color:var\(--orange2\)\}/.test(lay));
T('۳.۲ تراست/journey/why هم همین قاعده',
  lay.indexOf('html.ptf-dark .trust-item:hover{background:linear-gradient(180deg,#131f38,#182645)') > -1 &&
  lay.indexOf('html.ptf-dark #journey a.reveal:hover{background:linear-gradient(160deg,#131f38,#1a2949)!important') > -1 &&
  lay.indexOf('html.ptf-dark #why-ptf div.reveal:hover{') > -1);
T('۳.۳ سؤالات متداول: summary و جواب‌ها در شب روشن',
  /html\.ptf-dark #home-faq summary\{color:#eef3fb\}/.test(lay) &&
  /html\.ptf-dark #home-faq details p\{color:#b7c6de\}/.test(lay));
T('۳.۴ خاکستری‌هایِ درون‌خطیِ بیشتر پوشش داده شدند (رئیس هیئت‌مدیره: #475569 → روشن)',
  /html\.ptf-dark \[style\*="color:#475569"\],html\.ptf-dark \[style\*="color:#60646d"\],html\.ptf-dark \[style\*="color:#4b4d55"\]\{color:#a9bdd8!important\}/.test(home));
T('۳.۵ دکمهٔ استعلام داک در شب: سفیدِ خالص روی فلرِ پرکنتراست + سایهٔ متن',
  /html\.ptf-dark #ptfDock \.dock-cta\{color:#fff;background:linear-gradient\(135deg,#e0431a,#f28a00\)\}/.test(lay) &&
  /html\.ptf-dark \.btn-primary,html\.ptf-dark \.header-call,html\.ptf-dark #ptfDock \.dock-cta\{text-shadow:0 1px 2px rgba\(60,16,0,\.45\)\}/.test(lay));
T('۳.۶ پالت روزِ هاور (سفید کرمی) برای نمای روز دست‌نخورده ماند',
  /html:not\(\.ptf-dark\) \.service-card:hover/.test(home) === false && /@media \(hover:hover\)\{[\s\S]*?\.service-card:hover\{background:linear-gradient\(180deg,#fff,#fff6e9\)/.test(home));

SECTION('④ قرارداد کلی');
T('۴.۱ cache-bust: home.css و ptf-motion روی v34.39.14',
  /home\.css\?v=34\.39\.14/.test(idx) && /ptf-motion\.js\?v=34\.39\.14" defer/.test(idx));
T('۴.۲ پارس JS: ptf-motion و main.js', (function () {
  try { new Function(motion); new Function(read('assets/js/main.js')); return true; } catch (e) { return false; }
})());
T('۴.۳ حجم‌ها: home.css<۴۰K نویسه (بودجهٔ سرعتِ ۶۶۲) و ptf-motion<۱۲K',
  home.length < 40000 && motion.length < 12000);
T('۴.۴ بدون localStorage در مسیر تم؛ صفر اسکریپت/CDN خارجی',
  !/localStorage\.(get|set)Item/.test(motion) && !/<(script|link)[^>]+src="https?:/.test(idx));
T('۴.۵ ردیف تم در منو و ترتیب داک و غروبِ NOAA از ۳۹.۲ حفظ‌شدند',
  idx.indexOf('id="ptfThemeToggle"') > idx.indexOf('id="mainNav"') &&
  idx.indexOf('<a href="rfq/" class="dock-cta"') > -1 &&
  idx.indexOf('Math.floor(jd-0.5)-2451544') > -1 &&
  /<button type="button" id="ptfDockMenu" class="dock-menu"/.test(idx));
T('۴.۶ نگهبان بی‌تغییری: h1، canonical، ۱۰ بخش، اعداد فارسی پنل',
  idx.indexOf('تامین‌کننده تجهیزات صنعتی — تجهیزات حیاتی پروژه‌ها را <strong>مطمئن، سریع و دقیق</strong> تامین کنید') > -1 &&
  /rel="canonical" href="https:\/\/pishtaj\.ir\/"/.test(idx) &&
  ['home', 'journey', 'why-ptf', 'about', 'services', 'brands', 'projects', 'stats', 'home-faq', 'contact'].every(function (id) { return idx.indexOf('id="' + id + '"') > -1; }) &&
  /<b>۳<\/b>/.test(idx) && /<b>۶\+<\/b>/.test(idx));
T('۴.۷ VERSION.json = v34.39.22', JSON.parse(read('VERSION.json')).crm_version === 'v34.39.22');
T('۴.۸ reduce-motion: کیل‌سوئیچِ شیت هم در لایهٔ جدید',
  /@media \(prefers-reduced-motion: reduce\)\{#mainNav,#mainNav\.open\{transition:none\}\}/.test(lay));

DONE('tester665-v34.39.22-night-read');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
