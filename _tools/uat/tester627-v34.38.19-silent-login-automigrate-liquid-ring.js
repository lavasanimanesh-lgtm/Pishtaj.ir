#!/usr/bin/env node
'use strict';
/* tester627 — v34.38.20 (SILENT-LOGIN + AUTO-MIGRATE-001 + LIQUID-RING)
   گزارش کارفرما (۲۰۲۶-۰۹-۱۰): «بعد از رفتن پردهٔ بوت، هشدارها در نوار زرد و
   سفید پایین باقی می‌مانند و با هر رفرش/هارد‌رفرش دوباره می‌آیند.
   ۱) هشدارها در زمان ورود نمایش داده نشوند؛
   ۲) انتقال یک‌باره و همگرایی با سرور بدون زدن دکمه‌ای، اتوماتیک انجام شود؛
   ۳) گرافیک چرخش دور لوگو بهتر شود: کل لوگو (به‌جز متن PTF زیر آن) داخل
      دایره باشد و گرافیک چرخش مثل مایعِ جاذبه‌دار در حلقه‌ای باریک دور لوگو
      کار کند — فرود: سریع‌تر + بازتر، صعود: کُندتر + کم‌حجم‌تر.»

   این تستر قرارداد اجرا را پین می‌کند:
   ① بنر زرد #ptfUnsavedBanner در sync.js حین سکوت بوت (ptfBootQuiet) هرگز
     باز نمی‌شود و با رویداد «ptf:boot-quiet-end» دوباره رندر می‌شود؛
   ② نوار سفید #ptfMigBar در index.html ابتدا انتقالِ خودکار را راه‌اندازی
     می‌کند (تا ۳ تلاش در نشست) و فقط برای موردِ نیازمند-انسان/ناموفقِ ماندگار
     و پس از سکوت بوت نمایش داده می‌شود؛
   ③ مسیر خودکار مهاجرت در client-server.js (ptfBAutoMigrate / ptfBMigrationNeeded
     / ptfBAutoMigState / opts.autoBoot / ctl.silent) بدون confirm/alert/reload
     است درحالی‌که مسیر دستی (تنظیمات) عیناً حفظ شده و همهٔ گاردهای داده‌ای
     مهاجرت (ACK تک‌کلید، نشانگر فقط پس از تأیید کامل) دست‌نخورده باقی‌اند؛
   ④ sync.js پس از snapshot سالم، آماده‌اعلان‌کردن ورود را تا پایان مهاجرتٔ
     خودکار به‌تأخیر می‌اندازد (finishReady + failsafe ۴۰ثانیه — fail-open) و
     پرده مرحلهٔ «migrate» را نشان می‌دهد؛
   ⑤ boot-splash.js: حلقهٔ مایع جاذبه‌دار (Canvas) با مدل انرژی
     v(θ)=v₀√(۱+k·cosθ) — سرعت در پایین بیشینه و در بالا کمینه است؛ طول قوس
     و ضخامت توابع افزایش سرعت‌اند؛ reduced-motion فریم ایستا؛ نبود Canvas →
     حلقهٔ CSS قدیمی (fallback)؛ لوگو با ptf-logo-mark.png (بدون متن PTF)
     و fallback زنجیره‌ای به نسخهٔ کامل و سپس ایموجی؛ مرحلهٔ «migrate» از
     تایمر «مشکل واقعی» مستثناست (failsafe خود sync.js)؛
   ⑥ نسخه‌ها هماهنگ‌اند (VERSION.json / manifest / sw.js / RELEASE / همهٔ
     queryهای ?v=34.38.20 در index.html) و داراییِ برش لوگو موجود است. */
var fs = require('fs'), path = require('path'), assert = require('assert');
var ROOT = path.resolve(__dirname, '../..');
function read(p) { return fs.readFileSync(path.join(ROOT, p), 'utf8'); }
function section(src, from, to) { var a = src.indexOf(from), b = src.indexOf(to, a + from.length); return a < 0 ? '' : src.slice(a, b < 0 ? src.length : b); }

var boot = read('crm/boot-splash.js');
var sync = read('crm/sync.js');
var cs = read('crm/client-server.js');
var idx = read('crm/index.html');
var sw = read('crm/sw.js');

/* ══ ① سکوت بنر زرد در ورود (sync.js) ══ */
assert.ok(sync.indexOf('v34.38.19 (BOOT-BAR-QUIET') > -1, 'sync: مهر BOOT-BAR-QUIET موجود است');
var badgeFn = section(sync, 'function setSyncBadge(st)', 'function injectBadge()');
assert.ok(badgeFn.indexOf("window.ptfBootQuiet === true") > -1 && badgeFn.indexOf("banner.style.display = 'none';") > -1,
  'setSyncBadge: حین سکوت بوت بنر پایین صفحه مخفی می‌ماند (ولی نشانگر به‌روز می‌شود)');
assert.ok(badgeFn.indexOf("'ptfUnsavedBanner'") > -1 && badgeFn.indexOf('تغییر هنوز به سرور نرسیده') > -1,
  'setSyncBadge: منطق هشدارِ تغییرات معلق برای پس از بوت حفظ شده است');
assert.ok(sync.indexOf("addEventListener('ptf:boot-quiet-end'") > -1,
  'sync: شنوندهٔ پایان سکوت، بنر را با وضعیت واقعی دوباره رندر می‌کند');

/* ══ ② نوار سفید مهاجرت — خودکار اول، نوار فقط برای انسان (index.html) ══ */
var tick = section(idx, 'function ptfMigBannerTick()', 'setInterval(ptfMigBannerTick');
assert.ok(idx.indexOf('AUTO-MIGRATE-001') > -1, 'index: مهر AUTO-MIGRATE-001 موجود است');
assert.ok(tick.indexOf("ptfBAutoMigrate({ source: 'mig-bar-tick' })") > -1,
  'index: تیکِ نوار ابتدا انتقالِ خودکار را راه‌اندازی می‌کند');
assert.ok(tick.indexOf('window._ptfMigTries < 3') > -1,
  'index: تلاشِ خودکار حداکثر ۳ بار در هر نشست صفحه است');
assert.ok(tick.indexOf("am.running || am.ok") > -1,
  'index: در جریان/موفق‌بودن مهاجرت خودکار، نوار هرگز نمایش داده نمی‌شود');
assert.ok(tick.indexOf('window.ptfBootQuiet === true') > -1,
  'index: نوار یادآورِ نیازمند-انسان حین سکوت بوت مخفی است');
assert.ok(tick.indexOf("ptfBConfirmFlush") > -1,
  'index: دکمهٔ دستی «تکمیل انتقال» برای موردِ نیازمند-انسان حفظ شده است');
assert.ok(idx.indexOf('window.PTF_CRM_RELEASE = \'v34.38.20\'') > -1, 'index: نسخهٔ ریلیز v34.38.20 است');
assert.ok(idx.indexOf('SILENT-LOGIN') > -1, 'index: یادداشت تغییرِ v34.38.20 آمده است');

/* ══ ③ مهاجرت خودکار در client-server.js — بی‌صدا ولی پُرگارد ══ */
assert.ok(cs.indexOf('AUTO-MIGRATE-001') > -1, 'client-server: مهر AUTO-MIGRATE-001 موجود است');
assert.ok(cs.indexOf('window.ptfBAutoMigrate = function (opts)') > -1
  && cs.indexOf('window.ptfBMigrationNeeded = function') > -1
  && cs.indexOf('window.ptfBAutoMigState = function') > -1,
  'client-server: APIهای انتقال خودکار + وضعیت + نیاز تعریف شده‌اند');
assert.ok(cs.indexOf("_autoMigRunning") > -1, 'client-server: گارد اجرای هم‌زمانِ مهاجرت خودکار هست');
var finFn = section(cs, 'window.ptfBFinalize = function (opts)', 'function convergeMigration');
assert.ok(finFn.indexOf("opts.autoBoot") > -1 && finFn.indexOf("{ silent: true, cb: opts.cb }") > -1,
  'ptfBFinalize: مسیر autoBoot بدون تأیید کاربر به convergeMigrationِ بی‌صدا می‌رود');
assert.ok(finFn.indexOf("confirm('🌐 هم‌گرایی داده با سرور") > -1,
  'ptfBFinalize: مسیر دستیِ قدیمی (confirm) دست‌نخورده باقی مانده است');
var conv = section(cs, 'function convergeMigration', 'window.ptfBConfirmFlush');
assert.ok(conv.indexOf("ctl.cb({ code: 'needLogin', human: true })") > -1
  && conv.indexOf("ctl.silent) { if (ctl.cb") > -1,
  'convergeMigration: نیازمندی انسان در مسیر بی‌صدا فقط گزارش می‌شود (بدون alert)');
var okIdx = conv.indexOf("ctl.cb(null, { ok: true, migrated: true");
var alertIdx = conv.indexOf("alert('✅ هم‌گرایی انجام شد");
var reloadIdx = conv.indexOf('location.reload();');
assert.ok(okIdx > -1 && alertIdx > -1 && reloadIdx > -1 && okIdx < alertIdx && alertIdx < reloadIdx,
  'convergeMigration: موفقیت بی‌صدا پیش از alert/reload بازمی‌گردد (ریلود حین بوت نیست) و مسیر دستی حفظ است');
assert.ok(conv.indexOf('markSynced();') > -1 && conv.indexOf('markFlushed();') > -1,
  'convergeMigration: نشانگرهای flushed/synced همچنان فقط در شاخهٔ موفقیت ثبت می‌شوند');
assert.ok(conv.indexOf('convergeMigration(nextPayload, st, round + 1, ctl);') > -1,
  'convergeMigration: ctl در نوبت‌های بازتلاش ترد می‌شود');

/* ══ ④ به‌تأخیرانداختن آماده‌شدن ورود تا پایان مهاجرت (sync.js) ══ */
assert.ok(sync.indexOf("function finishReady()") > -1
  && sync.indexOf("readyDone = true;") > -1,
  'sync: finishReady یک‌باره و idempotent تعریف شده است');
assert.ok(sync.indexOf("ptfBAutoMigrate({ source: 'login', cb: function") > -1,
  'sync: پس از snapshot سالم، مهاجرت خودکار با منشأ login شروع می‌شود');
assert.ok(sync.indexOf("ptfBootSplashStep('migrate', {})") > -1,
  'sync: پردهٔ بوت مرحلهٔ migrate را نشان می‌دهد');
assert.ok(sync.indexOf('}, 40000);') > -1,
  'sync: failsafe چهل‌ثانیهٔ fail-open برای آماده‌شدن ورود هست');
assert.ok(sync.indexOf('ptfBMigrationNeeded()') > -1,
  'sync: مهاجرت خودکار فقط وقتی واقعاً لازم است راه می‌افتد');

/* ══ ⑤ حلقهٔ مایع جاذبه‌دار (boot-splash.js) ══ */
assert.ok(boot.indexOf('v34.38.19 (LIQUID-RING') > -1, 'boot-splash: مهر LIQUID-RING موجود است');
assert.ok(boot.indexOf('function liquidStart()') > -1 && boot.indexOf('function liquidSlug(') > -1
  && boot.indexOf('ptfBootLiquid') > -1,
  'boot-splash: موتور Canvas مایع + عنصر canvas تعریف شده است');
assert.ok(boot.indexOf(' LIQ_GRAV_K = 0.82;') > -1
  && boot.indexOf('return Math.sqrt(Math.max(0.16, 1 + LIQ_GRAV_K * c));') > -1,
  'boot-splash: مدل انرژیِ سرعت (بیشینه پایین / کمینه بالا) پیاده شده است');
assert.ok(boot.indexOf('halfArc = Math.min(1.15') > -1 && boot.indexOf('Math.pow(sr, 1.50)') > -1
  && boot.indexOf('Math.pow(sr, 1.40)') > -1,
  'boot-splash: طول قوس و ضخامت مایع توابعِ افزایش سرعت‌اند (فرود بازتر — صعود کوچک‌تر)');
/* ارزیابی واقعی فرمول: سرعت پایین باید از بالا بیشتر باشد */
var srSrc = boot.match(/function liquidSpeedRatio\(theta\) \{[\s\S]*?\n  \}/);
assert.ok(!!srSrc, 'boot-splash: liquidSpeedRatio قابل استخراج است');
var LIQ_GRAV_K = 0.82;
var sr = new Function('Math', 'var LIQ_GRAV_K = 0.82; return (' + srSrc[0] + ');')(Math);
var vBottom = sr(0), vTop = sr(Math.PI);
assert.ok(Math.abs(vBottom - Math.sqrt(1 + 0.82)) < 1e-9, 'فیزیک: سرعت در پایین حلقه بیشینه است (√(۱+k))');
assert.ok(Math.abs(vTop - Math.sqrt(1 - 0.82)) < 1e-9, 'فیزیک: سرعت در بالای حلقه کمینه است (√(۱−k))');
assert.ok(vBottom / vTop > 2.5, 'فیزیک: نسبت شتاب فرود به صعود محسوس است (>۲.۵×)');
assert.ok(boot.indexOf("liquidReduced()") > -1 && boot.indexOf('liquidPaint(0);') > -1,
  'boot-splash: prefers-reduced-motion → فقط فریم ایستا (بدون انیمیشن)');
assert.ok(boot.indexOf("root.setAttribute('data-liquid', '1')") > -1
  && boot.indexOf('[data-liquid="1"] .ptf-boot-ring{display:none}') > -1
  && boot.indexOf('.ptf-boot-ring{position:absolute;inset:14px') > -1,
  'boot-splash: حلقهٔ CSS قدیمیِ fallback حفظ شده و فقط با Canvas سالم پنهان می‌شود');
assert.ok(boot.indexOf('../assets/images/ptf-logo-mark.png') > -1
  && boot.indexOf("../assets/images/ptf-logo.png") > -1
  && boot.indexOf("this._fb=1") > -1 && boot.indexOf('no-logo') > -1,
  'boot-splash: زنجیرهٔ لوگو — نشان بدون PTF → نسخهٔ کامل → ایموجی fallback');
assert.ok(boot.indexOf("fb-full") > -1, 'boot-splash: نسخهٔ fallback لوگوی کامل کوچک‌تر رندر می‌شود');
assert.ok(boot.indexOf("window.CustomEvent('ptf:boot-quiet-end')") > -1,
  'boot-splash: پایان سکوت، رویداد boot-quiet-end می‌فرستد');
assert.ok(boot.indexOf("st === 'fail' || st === 'session' || st === 'done' || st === 'migrate'") > -1,
  'boot-splash: تایمر «مشکل واقعی» حین migrate خاموش است (failsafe مختص sync.js)');
assert.ok(boot.indexOf("name === 'migrate'") > -1 && boot.indexOf("setAttribute('data-state', 'migrate')") > -1,
  'boot-splash: مرحلهٔ migrate پیام/راهنمای خود را دارد');
assert.ok(boot.indexOf('liquid: !!LIQ.ok') > -1,
  'boot-splash: وضعیت موتور مایع در ptfBootSplashState در دسترس است');

/* ══ ⑥ هماهنگی نسخه‌ها + داراییِ لوگو ══ */
var vj = JSON.parse(read('VERSION.json'));
assert.ok(vj.crm_version === 'v34.38.20', 'VERSION.json با v34.38.20 هماهنگ است');
assert.ok(read('crm/manifest.json').indexOf('"version": "34.38.20"') > -1, 'manifest.json با نسخهٔ جدید هماهنگ است');
assert.ok(sw.indexOf("var RELEASE = 'v34.38.20';") > -1 && sw.indexOf("var ASSET_VERSION = '34.38.20';")
  > -1 && sw.indexOf("var CACHE = 'ptf-crm-v34.38.20';") > -1,
  'sw.js: RELEASE/ASSET_VERSION/CACHE هر سه v34.38.20 هستند');
assert.ok(idx.indexOf('?v=34.38.16') === -1, 'index: هیچ query نسخهٔ قدیمی باقی نمانده است');
assert.ok(idx.indexOf('boot-splash.js?v=34.38.20') > -1 && idx.indexOf('sync.js?v=34.38.20') > -1
  && idx.indexOf('client-server.js?v=34.38.20') > -1,
  'index: هر سه فایلِ تغییرکرده با query نسخهٔ جدید بارگذاری می‌شوند (شکستن کش کهنه)');
/* داراییِ بریده‌شدهٔ لوگو: PNG واقعی و کوچک‌تر از نسخهٔ کامل (برش متن PTF) */
var mark = fs.readFileSync(path.join(ROOT, 'assets/images/ptf-logo-mark.png'));
var full = fs.readFileSync(path.join(ROOT, 'assets/images/ptf-logo.png'));
function pngDims(buf) {
  assert.ok(buf.length > 32 && buf[0] === 0x89 && buf[1] === 0x50, 'PNG signature معتبر');
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}
var dm = pngDims(mark), df = pngDims(full);
assert.ok(df.w === 1200 && df.h === 1715, 'ابعاد لوگوی کاملِ مرجع تغییر نکرده است');
assert.ok(dm.h < df.h, 'دارایی: ptf-logo-mark.png کوتاه‌تر از نسخهٔ کامل است (متن PTF بریده شده)');
assert.ok(dm.h >= df.h * 0.72 && dm.h <= df.h * 0.78,
  'دارایی: برش دقیقاً در ناحیهٔ انتظار است (نشان کامل + بدون کپشن PTF، ~%۷۵ ارتفاع اصلی)');

console.log('PASS tester627-v34.38.20 SILENT-LOGIN + AUTO-MIGRATE-001 + LIQUID-RING');
