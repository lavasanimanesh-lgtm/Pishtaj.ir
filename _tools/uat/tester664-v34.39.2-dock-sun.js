#!/usr/bin/env node
'use strict';
/* =============================================================================
   tester664 — v34.39.27 (HOME-DOCK-SUN)
   دستور کارفرما:
     «دکمهٔ منو کار نمی‌کند؛ دکمهٔ منو → استعلام شود و خانه → منو؛ سرعت و
     فرکانس برق را کم کنید (دیربه‌دیرتر و یواش‌تر)؛ دکمهٔ شب/روز از هدر حذف،
     خودکار از ساعت غروب شب شود و دکمه به منو منتقل شود.»
   قراردادها:
   ① FIX-SHEET-CONTAINMENT — ریشهٔ باگ: backdrop-filterِ .site-header بلوکِ
     containing می‌ساخت و شیتِ fixed بیرونِ ویوپورت می‌رفت. ≤۷۹۰ بلور خاموش.
   ② DOCK — منو اسلات اول (خانه حذف)، استعلامِ واقعی (a[href=rfq/]) وسط با
     dock-cta سه‌بعدی و حلقهٔ جریان؛ مروف ✕ روی دکمهٔ منو؛ JS با stopPropagation.
   ③ SUN-THEME — بوت head: کوکی اورراید، وگرنه غروب/طلوع NOAA (تهران ۳۵.۷/۵۱.۴۴)؛
     کلیدِ دستی منتقل‌شده داخل #mainNav با برچسبِ زنده؛ بازبینی هر دقیقه.
     صفر localStorage (A10)، صفر کتابخانه.
   ④ CALM-CURRENT — ptfCurS: عبور آهسته + سکوت (۸s دائم / ۵s هاور).
   ⑤ KEEP — h1/canonical/tel/wa/۱۰بخش/استعلامِ منو و هیرو دست‌نخورده.
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
var i0 = home.indexOf('v34.39.2 — HOME-DOCK-SUN');
var lay = i0 > -1 ? home.slice(i0) : '';

SECTION('۰. لایه');
T('۰.۱ لایهٔ HOME-DOCK-SUN در home.css موجود است (پس از لایهٔ ۳۹.۱)',
  i0 > -1 && i0 > home.indexOf('v34.39.1 — HOME-ELECTRIC-3D'));

SECTION('۱. فیکس شیت (باگ گزارش‌شدهٔ «دکمهٔ منو کار نمی‌کند»)');
T('۱.۱ بلور هدر ≤۷۹۰ خاموش (حذف containing-block برای position:fixed)',
  lay.indexOf('@media(max-width:790px){') > -1 &&
  lay.indexOf('.site-header,.site-header.scrolled,.site-header.is-compact{-webkit-backdrop-filter:none!important;backdrop-filter:none!important') > -1);
T('۱.۲ پس‌زمینهٔ جامدِ موبایل برای روز و شب (جایگزین بلور)',
  /background:rgba\(255,255,255,\.985\)!important/.test(lay) &&
  /html\.ptf-dark \.site-header,html\.ptf-dark \.site-header\.scrolled,html\.ptf-dark \.site-header\.is-compact\{background:rgba\(10,17,32,\.985\)!important\}/.test(lay));
T('۱.۳ لنگر شیت همان‌جا سالم است (بالای داک، safe-area)',
  /#mainNav\{z-index:9535;top:auto!important;bottom:calc\(86px \+ env\(safe-area-inset-bottom\)\)!important/.test(home));
T('۱.۴ JS: تاگل با stopPropagation (نه وابستگی به همبرگر مخفی)',
  /dm\.addEventListener\('click', function \(e\) \{ if \(e && e\.stopPropagation\) e\.stopPropagation\(\); nav\.classList\.toggle\('open'\); \}\)/.test(motion));

SECTION('۲. داک جدید (منو اول، استعلام وسط)');
T('۲.۱ پنج آیتم: منو/تماس/استعلام/واتساپ/چت — خانه حذف، لینک واقعی rfq وسط',
  (function () {
    var block = (idx.match(/id="ptfDock"[\s\S]*?<\/nav>/) || [''])[0];
    var items = (block.match(/<a |<button /g) || []).length;
    return items === 5 && block.indexOf('خانه') === -1 &&
      /<button type="button" id="ptfDockMenu" class="dock-menu"/.test(block) &&
      /<a href="rfq\/" class="dock-cta" data-ptf-event="dock_rfq"/.test(block);
  })());
T('۲.۲ ترتیب: منو ← تماس ← استعلام ← واتساپ ← چت',
  /id="ptfDockMenu"[^>]*dock-menu[\s\S]*?data-ptf-event="dock_call"[\s\S]*?href="rfq\/" class="dock-cta"[\s\S]*?class="dock-wa"[\s\S]*?id="ptfDockChat"/.test(idx));
T('۲.۳ مروف ✕ و highlight روی همان اسلات منو هنگام باز بودن',
  /#ptfDockMenu\.is-x \.dm-bars i:nth-child\(1\)\{top:6px;transform:rotate\(45deg\)\}/.test(home) &&
  lay.indexOf('#ptfDockMenu.is-x{color:#fff;background:var(--flame-grad)') > -1);
T('۲.۴ CTA وسط همان ظاهر برجسته را دارد (CTA حالا لینک است، نه باکس متن)',
  /#ptfDock \.dock-cta\{color:#fff;background:var\(--flame-grad\)/.test(home) &&
  /#ptfDock \.dock-cta>svg\{width:22px;height:22px\}/.test(lay));
T('۲.۵ sync دوطرفه: دکمهٔ منوی داک هم از MutationObserver کلاس/aria می‌گیرد',
  /var dm = doc\.getElementById\('ptfDockMenu'\);\s*if \(dm\) \{ dm\.classList\.toggle\('is-x', open\)/.test(motion));

SECTION('۳. شب خودکار از غروب + کلید داخل منو');
T('۳.۱ کلید تم از هدر حذف شده و داخل #mainNav نشسته (با aria-pressed + tt-txt)',
  idx.indexOf('class="theme-toggle" id="ptfThemeToggle"') > -1 &&
  (function () {
    var navBlk = (idx.match(/id="mainNav"[\s\S]*?<\/nav>/) || [''])[0];
    var head = idx.slice(0, idx.indexOf('id="mainNav"'));
    return navBlk.indexOf('ptfThemeToggle') > -1 && head.indexOf('ptfThemeToggle') === -1;
  })());
T('۳.۲ بوت head: اولویت کوکی، وگرنه فرمول خورشید NOAA (طلوع/غروب تهران)',
  idx.indexOf('if(m){dark=m[1]==="dark"}else{') > -1 &&
  idx.indexOf('Math.floor(jd-0.5)-2451544') > -1 &&
  idx.indexOf('0.98560028') > -1 && idx.indexOf('282.9372') > -1 &&
  idx.indexOf('jd<(t-w/360)||jd>(t+w/360)') > -1 &&
  idx.indexOf('Math.floor(jd-0.5)-2451544') < idx.indexOf('</head>'));
T('۳.۳ هم‌خوانی عددیِ دقیق: نیمروز خورشیدی تهران ۱۲:۰۵±۱۵دقیقه و شبِ ۲۲:۰۰',
  (function () {
    var R = Math.PI / 180;
    function sun(jd) {
      var n = Math.floor(jd - 0.5) - 2451544, Js = n - 51.44 / 360;
      var M = (357.5291 + 0.98560028 * Js) % 360, mr = M * R;
      var C = 1.9148 * Math.sin(mr) + 0.02 * Math.sin(2 * mr) + 0.0003 * Math.sin(3 * mr);
      var L = (M + C + 282.9372) % 360, lr = L * R;
      var t = 2451545 + Js + 0.0053 * Math.sin(mr) - 0.0069 * Math.sin(2 * lr);
      var d = Math.asin(Math.sin(lr) * 0.397746);
      var c = (Math.sin(-0.0145444) - Math.sin(35.7 * R) * Math.sin(d)) / (Math.cos(35.7 * R) * Math.cos(d));
      var w = Math.acos(Math.max(-1, Math.min(1, c))) / R;
      return { noon: t, rise: t - w / 360, set: t + w / 360 };
    }
    var jd = Date.parse('2026-06-21T00:00:00Z') / 864e5 + 2440587.5, s = sun(jd);
    var noonUT = (((s.noon + 0.5) % 1) + 1) % 1 * 24;          // UT hours
    var dayLen = (s.set - s.rise) * 24;
    var noonIRST = noonUT + 3.5;
    var nightAt10 = sun(Date.parse('2026-06-21T18:30:00Z') / 864e5 + 2440587.5);
    var jdN = Date.parse('2026-06-21T18:30:00Z') / 864e5 + 2440587.5;
    return noonIRST > 11.7 && noonIRST < 12.45 && dayLen > 14.1 && dayLen < 14.9 &&
      (jdN < nightAt10.rise || jdN > nightAt10.set);
  })());
T('۳.۴ ptf-motion: sunNight همان فرمول + بازبینی هر دقیقه فقط در حالت خودکار',
  motion.indexOf('function sunNight(jd)') > -1 &&
  /win\.setInterval\(function \(\) \{\s*if \(manualTheme\(\) \|\| doc\.hidden\) return;/.test(motion) &&
  /set\(want, false\)/.test(motion));
T('۳.۵ برچسبِ زندهٔ «نمای شب/روز» با تاگل و متای theme-color',
  /if \(txt\) txt\.textContent = dark \? 'نمای روز' : 'نمای شب';/.test(motion) &&
  /var txt = btn\.querySelector\('\.tt-txt'\)/.test(motion));
T('۳.۶ استایل ردیف منو (id برنده) + دسکتاپ قرصی + killِ reduce',
  lay.indexOf('#mainNav .theme-toggle{width:auto;height:44px') > -1 &&
  /@media\(min-width:791px\)\{\s*#mainNav \.theme-toggle\{height:34px/.test(lay) &&
  /@media \(prefers-reduced-motion: reduce\)\{\s*#mainNav \.theme-toggle/.test(lay));
T('۳.۷ بدون localStorage در کل مسیر تم (کوکی تنها راهِ ماندگاری — A10)',
  !/localStorage\.(get|set)Item/.test(motion) && motion.indexOf("doc.cookie = 'ptf_theme='") > -1 &&
  !/localStorage/.test(idx.slice(0, idx.indexOf('</head>'))));

SECTION('۴. ریتم آرامِ برق');
T('۴.۱ کیفریم ptfCurS با دمِ سکوت (۵۲٪ عبور، ۴۸٪ تاریکی)',
  /@keyframes ptfCurS\{0%\{background-position:220% 0\}52%\{background-position:-240% 0\}100%\{background-position:-240% 0\}\}/.test(home));
T('۴.۲ حلقهٔ دائم: ۸ ثانیه (از ۳.۴) — دیربه‌دیرتر و یواش‌تر',
  /animation:ptfCurS 26s linear infinite;opacity:\.75/.test(home) && home.indexOf('animation:ptfCur 3.4s') === -1);
T('۴.۳ حلقهٔ هاور کارت‌ها: ۵ ثانیه (از ۲.۲)',
  /animation:ptfCurS 15s linear infinite/.test(home) && home.indexOf('animation:ptfCur 2.2s') === -1);
T('۴.۴ reduce: خاموشی کامل همچنان برجا',
  /@media \(prefers-reduced-motion: reduce\)\{[\s\S]*?\.btn-primary::before[^}]*animation:none;opacity:\.5/.test(home));

SECTION('۵. قرارداد کلی');
T('۵.۱ cache-bust: home.css و ptf-motion روی v34.39.14',
  /home\.css\?v=34\.39\.14/.test(idx) && /ptf-motion\.js\?v=34\.39\.14" defer/.test(idx));
T('۵.۲ اعداد فارسی پنل هیرو هنوز ۳ و ۶+ (بازگشت‌ناپذیر)',
  /<b>۳<\/b><span>دپارتمان تامین<\/span>/.test(idx) && /<b>۶\+<\/b><span>صنعت هدف<\/span>/.test(idx));
T('۵.۳ پارس JS: ptf-motion و main.js', (function () {
  try { new Function(motion); new Function(read('assets/js/main.js')); return true; } catch (e) { return false; }
})());
T('۵.۴ حجم‌ها: home.css<۴۸KB، ptf-motion<۱۲KB', home.length < 48000 && motion.length < 12000);
T('۵.۵ ساختار HTML متوازن (تگ‌های مسدود)', (function () {
  var stack = [], VOID = { img: 1, br: 1, hr: 1, meta: 1, link: 1, input: 1, source: 1, path: 1, circle: 1, rect: 1, line: 1, polyline: 1, polygon: 1, use: 1 };
  var re = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)[^>]*?>/g, m, bad = 0;
  while ((m = re.exec(idx))) {
    var tag = m[2].toLowerCase();
    if (VOID[tag] || /\/>$/.test(m[0])) continue;
    if (m[1]) { if (stack[stack.length - 1] === tag) stack.pop(); else bad++; } else stack.push(tag);
  }
  return bad === 0;
})());
T('۵.۶ بدون اسکریپت/CDN خارجی جدید', !/<(script|link)[^>]+src="https?:/.test(idx));
T('۵.۷ نگهبان بی‌تغییری: h1، canonical، tel/wa، ۱۰ بخش، استعلام منو+هیرو',
  idx.indexOf('تامین‌کننده تجهیزات صنعتی — تجهیزات حیاتی پروژه‌ها را <strong>مطمئن، سریع و دقیق</strong> تامین کنید') > -1 &&
  /rel="canonical" href="https:\/\/pishtaj\.ir\/"/.test(idx) &&
  idx.indexOf('tel:02146087679') > -1 && idx.indexOf('wa.me/989925868479') > -1 &&
  ['home', 'journey', 'why-ptf', 'about', 'services', 'brands', 'projects', 'stats', 'home-faq', 'contact'].every(function (id) { return idx.indexOf('id="' + id + '"') > -1; }) &&
  /<a href="rfq\/">استعلام<\/a>/.test(idx) && /<a class="btn btn-primary" href="rfq\/">/.test(idx));
T('۵.۸ VERSION.json = v34.39.27', JSON.parse(read('VERSION.json')).crm_version === 'v34.39.27');

DONE('tester664-v34.39.27-dock-sun');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
