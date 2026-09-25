#!/usr/bin/env node
'use strict';
/* =============================================================================
   tester666 — v34.39.32 (HOME-ACCORD-NIGHTMEGA)
   گزارش کارفرما:
     «در نمای موبایل اخبار و وبلاگ زیر درباره‌ما باید باز شوند؛ زیرمنوهای محصولات
     در نمای شب خوانایی ندارند.»
   قراردادها:
   ① SHEET-ACCORDION — در شیت موبایل، دربارهٔ‌ما آکاردئون واقعی است: .nav-drop-menu
     بسته (max-height:0/visibility:hidden) و با کلاس .nav-drop باز؛ شِورونِ CSS
     (۴۵deg↔-135deg)؛ JS در فاز capture روی #mainNav — کلیک اول preventDefault +
     stopImmediatePropagation (سدِ بستنِ شیت توسط main.js)، کلیکِ دوم پیمایش آزاد؛
     بستن شیت = جمع‌شدن همهٔ دراپ‌ها (در sync).
   ② NIGHT-MEGA — همهٔ اوررایدها با ارجحیتِ #mainNav + !important تا MEGA_CSSِ
     تزریق‌شده در runtime (که بعد از home.css می‌آید) را بشکنند؛ هیچ رنگِ تاریقی
     روی پس‌زمینهٔ شب باقی نمی‌ماند؛ نمای روز دست‌نخورده.
   ③ KEEP — لینک‌های index بدون تغییر؛ حجم‌ها زیر بودجه؛ A10؛ صفر کتابخانه.
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
var i0 = home.indexOf('v34.39.4 — HOME-ACCORD-NIGHTMEGA');
var lay = i0 > -1 ? home.slice(i0) : '';

SECTION('۰. لایه');
T('۰.۱ لایهٔ HOME-ACCORD-NIGHTMEGA پس از ۳۹.۳ است', i0 > -1 && i0 > home.indexOf('v34.39.3 — HOME-NIGHT-READ'));

SECTION('① آکاردئون دربارهٔ‌ما (شیت موبایل)');
T('۱.۱ .nav-drop-menu پیش‌فرض جمع (max-height:0 + visibility:hidden + transition)',
  /#mainNav \.nav-drop-menu\{display:flex!important;flex-direction:row;flex-wrap:wrap;gap:6px;padding:0 6px;max-height:0;overflow:hidden;opacity:0;visibility:hidden;transition:max-height \.34s cubic-bezier\(\.16,1,\.3,1\),opacity \.24s ease,visibility \.3s\}/.test(home));
T('۱.۲ حالت باز: ارتفاع/محو/دیدنی + استگر فرزند‌ها',
  /#mainNav \.nav-drop\.open>\.nav-drop-menu\{max-height:240px;opacity:1;visibility:visible;padding:2px 6px 8px\}/.test(home) &&
  /#mainNav \.nav-drop\.open \.nav-drop-menu a\{animation:ptfSheetItem \.3s cubic-bezier\(\.16,1,\.3,1\) both\}/.test(home));
T('۱.۳ شِورونِ CSS روی لینک parent با چرخشِ فنری',
  /#mainNav \.nav-drop>a\[aria-haspopup\]::after\{content:'';flex:0 0 auto;width:8px;height:8px/.test(home) &&
  /#mainNav \.nav-drop\.open>a\[aria-haspopup\]::after\{transform:rotate\(-135deg\)/.test(home));
T('۱.۴ JS: هندلِرِ capture با stopImmediatePropagation (مهارِ بستنِ شیتِ main.js)',
  /nav\.addEventListener\('click', function \(e\) \{/.test(motion) &&
  motion.indexOf("e.target.closest('#mainNav .nav-drop>a[aria-haspopup]')") > -1 &&
  /e\.preventDefault\(\); e\.stopImmediatePropagation\(\);/.test(motion) &&
  /\}, true\);/.test(motion));
T('۱.۵ قفلِ مدیا: فقط ≤۷۹۰؛ کلیکِ دوم (باز) = پیمایشِ آزاد',
  /max-width:790px\)'\)\.matches\)\)\s*return;/.test(motion) &&
  /if \(d\.classList\.contains\('open'\)\) return;/.test(motion));
T('۱.۶ هم‌خوانی با بستنِ شیت: sync همهٔ .open را پاک می‌کند',
  /if \(!open\) Array\.prototype\.forEach\.call\(nav\.querySelectorAll\('\.nav-drop\.open'\)/.test(motion));
T('۱.۷ تک‌باز شدن (آکاردئون): قبل از بازکردن، بقیه جمع می‌شوند',
  /querySelectorAll\('\.nav-drop\.open'\), function \(o\) \{ o\.classList\.remove\('open'\); \}\);\s*d\.classList\.add\('open'\)/.test(motion));
T('۱.۸ محتوا دست‌نخورده: لینک/زیرلینک‌های index همان‌اند',
  /<span class="nav-drop"><a href="about\/" aria-haspopup="true">درباره ما<\/a><span class="nav-drop-menu"><a href="news\/">اخبار<\/a><a href="blog\/">وبلاگ<\/a><\/span><\/span>/.test(idx.replace(/\s+/g, ' ').replace(/> </g, '><')) ||
  (idx.indexOf('href="about/" aria-haspopup') > -1 && idx.indexOf('href="news/"') > -1 && idx.indexOf('href="blog/"') > -1));
T('۱.۹ reduce: ترنزیشن/انیمیشنِ آکاردئون خاموش',
  /@media \(prefers-reduced-motion: reduce\)\{#mainNav \.nav-drop-menu,#mainNav \.nav-drop>a\[aria-haspopup\]::after\{transition:none\}#mainNav \.nav-drop\.open \.nav-drop-menu a\{animation:none\}\}/.test(home));

SECTION('② خواناییِ شبِ مگای محصولات');
T('۲.۱ پنل/ستون‌ها: اوررایدِ #mainNav+!important (برندهٔ MEGA_CSSِ بعدی)',
  /html\.ptf-dark #mainNav \.nav-mega \.nav-mega-inner\{background:#0f1a2e!important/.test(lay) &&
  /html\.ptf-dark #mainNav \.nav-mega-col\{background:#111d35!important;border-color:rgba\(255,255,255,\.08\)!important\}/.test(lay));
T('۲.۲ هِدها و شمارنده‌ها روشن/کهربایی',
  /html\.ptf-dark #mainNav \.nav-mega-head,html\.ptf-dark #mainNav \.nav-mega-col\.open \.nav-mega-head\{color:#e8eef8!important\}/.test(lay) &&
  /html\.ptf-dark #mainNav \.nav-mega-count\{color:#ffb033!important;background:rgba\(247,148,0,\.15\)!important\}/.test(lay));
T('۲.۳ آیتم‌های لینکی: #c9d6ea + هاورِ کهربایی',
  /html\.ptf-dark #mainNav \.nav-mega \.nav-mega-items-in a,html\.ptf-dark #mainNav \.nav-mega a\{color:#c9d6ea!important\}/.test(lay) &&
  /html\.ptf-dark #mainNav \.nav-mega a:hover\{background:rgba\(247,148,0,\.15\)!important;color:#ffb033!important\}/.test(lay));
T('۲.۴ تریگر/«همهٔ محصولات» هم تیره‌پس‌زمینهٔ خوانا',
  /html\.ptf-dark #mainNav \.nav-mega-trigger\{background:#131f38!important/.test(lay) &&
  /html\.ptf-dark #mainNav \.nav-mega-all\{background:linear-gradient\(135deg,#c73616,#e07b00\)!important/.test(lay));
T('۲.۵ صفر باقی‌ماندهٔ رنگ‌تاریکِ بدونِ اورراید در بلاک شب (head/items همگی !important‌اند)',
  (function () {
    var block = lay.slice(lay.indexOf('html.ptf-dark #mainNav .nav-mega .nav-mega-inner'));
    var rules = block.match(/html\.ptf-dark #mainNav \.nav-mega[^{]*\{[^}]*\}/g) || [];
    return rules.length >= 7 && rules.every(function (r) { return !/color:#(0f|33|64|94)/.test(r); });
  })());
T('۲.۶ ptf-discover.js دست‌نخورده (MEGA_CSS همان است — جنگِ ارجحیت در سمت home.css حل شد)',
  read('assets/js/ptf-discover.js').indexOf('.nav-mega-head{display:flex;align-items:center;gap:8px;width:100%;min-height:48px') > -1);

SECTION('③ قرارداد کلی');
T('۳.۱ cache-bust روی v34.39.14', /home\.css\?v=34\.39\.14/.test(idx) && /ptf-motion\.js\?v=34\.39\.14" defer/.test(idx));
T('۳.۲ حجم‌ها: home.css<۴۰K (گارد ۶۶۲) و ptf-motion<۱۲K', home.length < 40000 && motion.length < 12000);
T('۳.۳ پارس JS', (function () { try { new Function(motion); new Function(read('assets/js/main.js')); return true; } catch (e) { return false; } })());
T('۳.۴ بدون localStorage/eval/CDN؛ کوکی تنها ماندگاری',
  !/localStorage\.(get|set)Item|eval\(/.test(motion) && !/<(script|link)[^>]+src="https?:/.test(idx));
T('۳.۵ پایداری‌های ۳۹.۲/۳۹.۳ برجا: reparent، z-index، داک، غروبِ NOAA، اعداد فارسی',
  motion.indexOf('doc.body.insertBefore(nav, bd2)') > -1 && /#mainNav\{z-index:9535/.test(home) &&
  /<a href="rfq\/" class="dock-cta"/.test(idx) && idx.indexOf('Math.floor(jd-0.5)-2451544') > -1 &&
  /<b>۳<\/b>/.test(idx) && /<b>۶\+<\/b>/.test(idx) && home.indexOf('#ptfDockChat::before') === -1);
T('۳.۶ نگهبان بی‌تغییری: h1/canonical/۱۰‌بخش',
  idx.indexOf('تامین‌کننده تجهیزات صنعتی — تجهیزات حیاتی پروژه‌ها را <strong>مطمئن، سریع و دقیق</strong> تامین کنید') > -1 &&
  /rel="canonical" href="https:\/\/pishtaj\.ir\/"/.test(idx) &&
  ['home', 'journey', 'why-ptf', 'about', 'services', 'brands', 'projects', 'stats', 'home-faq', 'contact'].every(function (id) { return idx.indexOf('id="' + id + '"') > -1; }));
T('۳.۷ VERSION.json = v34.39.32', JSON.parse(read('VERSION.json')).crm_version === 'v34.39.32');

DONE('tester666-v34.39.32-accord-nightmega');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
