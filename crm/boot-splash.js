/* =====================================================================
   PTF CRM — boot-splash.js — v34.38.19 (LIQUID-RING + AUTO-MIGRATE-AWARE)
   «پردهٔ آماده‌سازی» + «سکوت بوت» — رفع سیل پیام‌های لحظهٔ ورود.

   v34.38.19 (2026-09-10 — درخواست کارفرما):
   الف) حلقهٔ چرخان ساده جای خود را به «حلقهٔ مایع جاذبه‌دار» داد (Canvas):
        قطره/تودهٔ مایع در کانال باریک حلقه‌ای دور لوگو؛ هنگام فرود از بالا
        به پایین شتاب می‌گیرد و باز/کشیده می‌شود و هنگام بالارفتن کُند و
        کم‌حجم می‌شود (مدل انرژی: سرعت ∝ √(۱+k·cosθ)، طول و ضخامت تابع
        سرعت). برای reduced-motion فقط یک فریم ایستا رسم می‌شود و برای
        مرورگر بدون Canvas همان حلقهٔ CSS قبلی fallback است.
   ب) لوگو: کل نشان (چرخ‌دنده+شعله) داخل دایره نمایش داده می‌شود — متن
        «پی‌تی‌اف» زیر لوگو با سندِ بریده‌شدهٔ ptf-logo-mark.png حذف شده
        است؛ با خطای بارگذاری، نسخهٔ کامل و سپس ایموجی 🏢 جایگزین است.
   ج) مرحلهٔ جدید 'migrate' برای «انتقال یک‌بارهٔ خودکار» (AUTO-MIGRATE-001
        در sync.js/client-server.js): پنجرهٔ مشکل‌واقعی (۴۵ثانیه) هنگام
        این مرحله از نو مسلح می‌شود تا ورود گیر نکند.
   د) پایان سکوت بوت رویداد 'ptf:boot-quiet-end' می‌فرستد تا sync.js بنر
        پایین صفحه را با وضعیت واقعی دوباره رندر کند (BOOT-BAR-QUIET).

   قرارداد این ماژول (مانند v34.38.17):
   ۱) به‌محض ورود به CRM (showCrm) یک پردهٔ تمام‌صفحه با حلقهٔ مایعِ دور
      لوگو + مراحل (اتصال ← دریافت ← آماده‌سازی) نمایش داده می‌شود.
   ۲) از همان لحظه «سکوت بوت» فعال است: ptfToast سراسری گیت می‌شود و
      پیام‌های گذرا (warn/info/ok) به‌جای نمایش، در صف کوتاه‌مدت (حداکثر
      ۸ پیام، بدون تکرار) نگه داشته می‌شوند.
   ۳) با آماده‌شدن واقعی (رویداد ptf:sync-ready یا فراخوانی مستقیم از
      sync.js) پرده با پیام «سامانه آماده شد» محو و صفِ گذرا بی‌صدا
      دور ریخته می‌شود؛ فقط یک پیام واقعاً مهم (صریحِ ready یا آخرین
      خطای err) نمایش داده می‌شود.
   ۴) اگر تا ۱۲ ثانیه آماده نشود، پیام اطمینان‌بخش «کند است، صبر کنید»
      می‌آید (بدون لحن خطا)؛ اگر تا ۴۵ ثانیه snapshot موفق نیاید، پرده
      وارد حالت «مشکل واقعی» می‌شود: یک پیام روشن + [تلاش مجدد]
      + [ادامه با دادهٔ محلی]. سیگنال‌های ماندگار (نشانگر وضعیت،
      کارتابل، تشخیص همگام‌سازی) دست‌نخورده می‌مانند.
   ۵) fail-open در همه‌جا: نبودِ sync/ptfToast/… هیچ‌وقت ورود را
      نمی‌شکند؛ سکوت حداکثر ۷۵ ثانیه عمر می‌کند.
   ===================================================================== */
(function () {
  'use strict';
  if (window.__ptfBootSplashLoaded) return;
  window.__ptfBootSplashLoaded = true;

  var MIN_SHOW_MS = 1200;    /* حداقل نمایش تا پرده چشمک نزند */
  var SLOW_AFTER_MS = 12000; /* پس از این: پیام اطمینان‌بخش (نه خطا) */
  var FAIL_AFTER_MS = 45000; /* پس از این بدون snapshot موفق = مشکل واقعی */
  var QUIET_CAP_MS = 75000;  /* سقف fail-open سکوتِ توست‌ها */

  var shown = false, done = false, t0 = 0, slowT = 0, failT = 0;
  var lastReason = '', lastAttempt = 0;

  function $(id) { try { return document.getElementById(id); } catch (e) { return null; } }
  function faNum(n) { return String(n).replace(/\d/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'[+d]; }); }
  function clearTimers() {
    try { if (slowT) clearTimeout(slowT); } catch (e1) {}
    try { if (failT) clearTimeout(failT); } catch (e2) {}
    slowT = 0; failT = 0;
  }
  function endQuiet(discard) {
    try { window.ptfBootQuiet = false; } catch (e) {}
    try { window.ptfBootQuietUntil = 0; } catch (e2) {}
    if (discard !== false) { try { window._ptfBootToastQueue = []; } catch (e3) {} }
    /* v34.38.19 (BOOT-BAR-QUIET): پایان سکوت → sync.js بنر پایین صفحه را با
       وضعیت واقعی لحظهٔ رفع سکوت دوباره رندر می‌کند (در حین بوت پنهان است). */
    try {
      if (typeof window.CustomEvent === 'function' && window.dispatchEvent) window.dispatchEvent(new window.CustomEvent('ptf:boot-quiet-end'));
    } catch (eEv) {}
  }
  function faReason(r) {
    r = String(r == null ? '' : r);
    if (!r || r === 'timeout') return 'پاسخ سرور بیش از حد طول کشید.';
    if (/network|fetch|timeout|offline|failed/i.test(r)) return 'به نظر می‌رسد اینترنت یا سرور در دسترس نیست.';
    if (/integrity|snapshot|checksum|manifest|bytes|count|kind/i.test(r)) return 'پاسخ سرور ناقص بود؛ تلاش خودکار ادامه دارد.';
    if (/busy/i.test(r)) return 'یک درخواست دیگر در حال اجراست…';
    if (/auth|token|login|session|401|forbidden/i.test(r)) return 'نشست منقضی شده است؛ لطفاً دوباره وارد شوید.';
    return 'خطا: ' + r.slice(0, 90);
  }

  /* ---------- سکوت بوت: گیت سراسری توست‌ها ---------- */
  function queueToast(msg, kind) {
    try {
      var q = window._ptfBootToastQueue || (window._ptfBootToastQueue = []);
      var key = String(kind || 'info') + '|' + String(msg == null ? '' : msg).slice(0, 160);
      for (var i = 0; i < q.length; i++) if (q[i].key === key) return true;
      q.push({ key: key, msg: msg, kind: kind || 'info', at: Date.now() });
      if (q.length > 8) q.shift();
      return true;
    } catch (e) { return false; }
  }
  function installToastGate() {
    try {
      if (typeof window.ptfToast !== 'function') return false;
      if (window.ptfToast._ptfGated) return true;
      var real = window.ptfToast;
      window._ptfToastReal = real;
      var gated = function (msg, kind) {
        try {
          if (window.ptfBootQuiet) {
            /* انقضای سقف: صفِ کهنه دور ریخته می‌شود و رفتار عادی برمی‌گردد. */
            if (Date.now() > (+window.ptfBootQuietUntil || 0)) { endQuiet(true); }
            else { queueToast(msg, kind); return; }
          }
        } catch (eGate) {}
        return real.apply(this, arguments);
      };
      gated._ptfGated = true;
      window.ptfToast = gated;
      return true;
    } catch (e) { return false; }
  }
  if (!installToastGate()) {
    var gateTries = 0;
    var gateIv = setInterval(function () {
      gateTries++;
      try { if (installToastGate() || gateTries > 25) clearInterval(gateIv); }
      catch (e) { try { clearInterval(gateIv); } catch (e2) {} }
    }, 100);
  }

  /* ---------- v34.38.19: موتور حلقهٔ مایع جاذبه‌دار (Canvas) ----------
     مدل: تودهٔ مایع در کانال حلقه‌ای باریک دور لوگو. θ از پایین حلقه سنجیده
     می‌شود؛ سرعت طبق انرژی: v(θ)=v₀·√(max(ε، ۱+k·cosθ)) ⇒ شتاب در فرود،
     کندی در صعود. طولِ قوسِ مایع و ضخامت شعاعی توابعِ افزایش سرعت‌اند ⇒
     پایین «باز/کشیده» و بالا «کم‌حجم». دنبالهٔ قطره‌ای کوتاه هم هست. */
  var LIQ = { cv: null, ctx: null, raf: 0, theta: Math.PI, last: 0, ok: false };
  var LIQ_SIZE = 134;         /* هم‌اندازهٔ .ptf-boot-logo-wrap */
  var LIQ_R = 56;             /* شعاع کانال مایع */
  var LIQ_TRACK = 6.5;        /* ضخامت کانال */
  var LIQ_GRAV_K = 0.82;      // انرژیِ جاذبه (کمی زیر ۱ تا در قله گیر نکند)
  var LIQ_BASE_W = (Math.PI * 2) / 1900;  /* rad/ms ⇒ دور کامل ≈ ۱.۹ ثانیه در سرعت پایه */
  function liquidXY(theta, r, out) {
    out.x = LIQ_SIZE / 2 + r * Math.sin(theta);
    out.y = LIQ_SIZE / 2 + r * Math.cos(theta);
    return out;
  }
  function liquidSpeedRatio(theta) {
    var c = Math.cos(theta); /* +۱ پایین، −۱ بالا */
    return Math.sqrt(Math.max(0.16, 1 + LIQ_GRAV_K * c));
  }
  /* قوسِ نوک‌باریک مایع: دو لبهٔ بیرونی/درونی با پروفیلِ پهنای سینوسی */
  function liquidSlug(ctx, cDeg, halfArc, halfW, color, alpha) {
    var M = 26, ob = {}, ib = {};
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    for (var i = 0; i <= M; i++) {
      var t = -1 + (2 * i) / M;                          /* −۱ دنباله ← +۱ پیشرو */
      var skew = t < 0 ? 1.22 : 0.92;                    /* دنباله کمی کشیده‌تر (قطره‌ریز) */
      var a = cDeg + t * halfArc * skew;
      var w = halfW * Math.pow(Math.max(0.001, 1 - Math.pow(Math.abs(t), 1.5)), 0.8);
      var po = liquidXY(a, LIQ_R + w, ob);
      ctx.lineTo(po.x, po.y);
    }
    for (var j = M; j >= 0; j--) {
      var t2 = -1 + (2 * j) / M;
      var skew2 = t2 < 0 ? 1.22 : 0.92;
      var a2 = cDeg + t2 * halfArc * skew2;
      var w2 = halfW * Math.pow(Math.max(0.001, 1 - Math.pow(Math.abs(t2), 1.5)), 0.8);
      var pi = liquidXY(a2, LIQ_R - Math.max(w2, 0.4), ib);
      ctx.lineTo(pi.x, pi.y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  function liquidPaint(dt) {
    var ctx = LIQ.ctx;
    if (!ctx) return;
    /* توقف قدرت‌گرفته از دید کاربر: مایعِ ساکن در مکانِ همیشگی (نه دنباله‌دار) */
    var sr = liquidSpeedRatio(LIQ.theta);
    if (dt > 0) LIQ.theta += LIQ_BASE_W * sr * dt;
    LIQ.theta = LIQ.theta % (Math.PI * 2);
    ctx.clearRect(0, 0, LIQ_SIZE, LIQ_SIZE);
    /* کانال: ریلِ باریکِ حلقه‌ای که مایع داخل آن است */
    ctx.save();
    ctx.lineWidth = LIQ_TRACK;
    ctx.strokeStyle = 'rgba(148,163,184,.16)';
    ctx.beginPath();
    ctx.arc(LIQ_SIZE / 2, LIQ_SIZE / 2, LIQ_R, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = 'rgba(148,163,184,.12)';
    ctx.beginPath();
    ctx.arc(LIQ_SIZE / 2, LIQ_SIZE / 2, LIQ_R - LIQ_TRACK / 2 - 1.6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(LIQ_SIZE / 2, LIQ_SIZE / 2, LIQ_R + LIQ_TRACK / 2 + 1.6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    /* طول و ضخامت تابع سرعت: پایین باز/کشیده و حجیم — بالا کوتاه و کم‌حجم */
    var halfArc = Math.min(1.15, Math.max(0.15, 0.34 * Math.pow(sr, 1.50)));
    var halfW = Math.min(LIQ_TRACK * 0.85, Math.max(LIQ_TRACK * 0.36, LIQ_TRACK * 0.33 * Math.pow(sr, 1.40)));
    /* تودهٔ اصلی + هستهٔ روشن‌تر برای حسِ مایع */
    liquidSlug(ctx, LIQ.theta, halfArc, halfW, '#ef4b1a', 0.96);
    liquidSlug(ctx, LIQ.theta + halfArc * 0.10, halfArc * 0.80, halfW * 0.52, '#f79400', 0.92);
    /* درخشش لبهٔ پیشرو */
    var hb = liquidXY(LIQ.theta + halfArc * 0.52, LIQ_R - halfW * 0.10, {});
    ctx.save();
    ctx.globalAlpha = 0.42;
    ctx.fillStyle = '#fff7ed';
    ctx.beginPath();
    ctx.arc(hb.x, hb.y, Math.max(0.8, halfW * 0.42), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    /* قطرهٔ کوچکِ دنباله */
    var tr = liquidXY(LIQ.theta - halfArc * 1.38, LIQ_R, {});
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = '#ef4b1a';
    ctx.beginPath();
    ctx.arc(tr.x, tr.y, Math.max(0.7, halfW * 0.30), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  function liquidLoop(ts) {
    if (!LIQ.ok) return;
    var dt = 0;
    if (LIQ.last && ts) { dt = Math.min(90, ts - LIQ.last); }
    LIQ.last = ts || Date.now();
    liquidPaint(dt);
    LIQ.raf = requestAnimationFrame(liquidLoop);
  }
  function liquidReduced() {
    try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; }
  }
  function liquidStart() {
    try {
      var cv = $('ptfBootLiquid');
      if (!cv || !cv.getContext) return;                 /* مرورگر قدیمی → fallback حلقهٔ CSS */
      var ctx = cv.getContext('2d');
      if (!ctx) return;
      var dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
      cv.width = LIQ_SIZE * dpr;
      cv.height = LIQ_SIZE * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      LIQ.cv = cv; LIQ.ctx = ctx; LIQ.ok = true;
      var root = $('ptfBootSplash');
      if (root) root.setAttribute('data-liquid', '1');  /* CSS: مخفی‌کردن حلقهٔ CSS fallback */
      if (liquidReduced()) {
        /* حرکت هیچ؛ یک فریم ایستا از مایعِ نیمه‌راه رسم می‌شود. */
        LIQ.theta = 0.9;
        liquidPaint(0);
        return;
      }
      if (LIQ.raf) cancelAnimationFrame(LIQ.raf);
      LIQ.last = 0;
      LIQ.raf = requestAnimationFrame(liquidLoop);
    } catch (e) {}
  }
  function liquidStop() {
    try { if (LIQ.raf) cancelAnimationFrame(LIQ.raf); } catch (e1) {}
    LIQ.raf = 0;
    LIQ.ok = false;
    try { if (LIQ.ctx) LIQ.ctx.clearRect(0, 0, LIQ_SIZE, LIQ_SIZE); } catch (e2) {}
  }

  /* ---------- ظاهر پرده ---------- */
  function injectCss() {
    try {
      if ($('ptfBootSplashCss')) return;
      var css = document.createElement('style');
      css.id = 'ptfBootSplashCss';
      css.textContent =
        '#ptfBootSplash{position:fixed;inset:0;z-index:1500000;display:grid;place-items:center;padding:20px;background:linear-gradient(135deg,rgba(21,21,23,.94),rgba(45,45,49,.94));backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px);opacity:1;transition:opacity .38s ease;box-sizing:border-box}' +
        '#ptfBootSplash.ptf-boot-hide{opacity:0;pointer-events:none}' +
        '#ptfBootSplash .ptf-boot-card{width:min(430px,94vw);max-height:calc(100vh - 40px);max-height:calc(100dvh - 40px);overflow:auto;background:#fff;border-radius:26px;padding:32px 26px 26px;text-align:center;box-shadow:0 34px 90px rgba(0,0,0,.45);position:relative;box-sizing:border-box}' +
        '#ptfBootSplash .ptf-boot-card::before{content:"";position:absolute;top:0;right:0;left:0;height:5px;background:linear-gradient(90deg,#ef4b1a,#f79400,#ef4b1a);background-size:200% 100%;animation:ptfBootShimmer 2.4s linear infinite}' +
        '#ptfBootSplash .ptf-boot-logo-wrap{position:relative;width:134px;height:134px;margin:0 auto 12px}' +
        '#ptfBootSplash .ptf-boot-liquid{position:absolute;inset:0;width:134px;height:134px;display:none;pointer-events:none}' +
        '#ptfBootSplash[data-liquid="1"] .ptf-boot-liquid{display:block}' +
        '#ptfBootSplash[data-liquid="1"] .ptf-boot-ring{display:none}' + /* Canvas سالم = حلقهٔ CSS fallback پنهان */
        '#ptfBootSplash .ptf-boot-ring{position:absolute;inset:14px;border-radius:50%;border:5px solid #f1f5f9;border-top-color:#ef4b1a;border-left-color:#f79400;animation:ptfBootRing 1.1s linear infinite;box-sizing:border-box}' +
        '#ptfBootSplash .ptf-boot-ring2{position:absolute;inset:26px;border-radius:50%;border:2px dashed rgba(239,75,26,.22);animation:ptfBootRingRev 7s linear infinite;box-sizing:border-box;pointer-events:none}' +
        '#ptfBootSplash .ptf-boot-logo{position:absolute;inset:22px;width:90px;height:90px;object-fit:contain;border-radius:50%;background:radial-gradient(circle at 50% 42%,#ffffff 58%,#f8fafc 100%);animation:ptfBootPulse 2.4s ease-in-out infinite;box-sizing:border-box}' +
        '#ptfBootSplash .ptf-boot-logo.fb-full{inset:29px;width:76px;height:76px}' + /* نسخهٔ کامل با متن PTF — کمی کوچک‌تر درج می‌شود */
        '#ptfBootSplash .ptf-boot-logo-wrap.no-logo::after{content:"🏢";position:absolute;inset:22px;display:grid;place-items:center;font-size:46px;background:#fff7ed;border-radius:50%}' +
        '#ptfBootSplash h2{margin:0 0 4px;font-size:17px;font-weight:900;color:#0f172a;line-height:1.6}' +
        '#ptfBootSplash .ptf-boot-steps{display:flex;gap:6px;justify-content:center;margin:12px 0;flex-wrap:wrap}' +
        '#ptfBootSplash .ptf-boot-steps span{font-size:11px;font-weight:800;color:#94a3b8;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:999px;padding:4px 11px;transition:all .25s}' +
        '#ptfBootSplash .ptf-boot-steps span.on{color:#c2410c;background:#fff7ed;border-color:#fed7aa;box-shadow:0 0 0 3px rgba(247,148,0,.13)}' +
        '#ptfBootSplash .ptf-boot-steps span.done{color:#047857;background:#ecfdf5;border-color:#a7f3d0}' +
        '#ptfBootSplash .ptf-boot-bar{height:8px;border-radius:999px;background:#f1f5f9;overflow:hidden;margin:2px 2px 12px}' +
        '#ptfBootSplash .ptf-boot-bar i{display:block;height:100%;width:36%;border-radius:999px;background:linear-gradient(90deg,#ef4b1a,#f79400);animation:ptfBootSlide 1.5s ease-in-out infinite}' +
        '#ptfBootSplash .ptf-boot-msg{margin:0;font-size:13.5px;font-weight:800;color:#334155;line-height:1.9;min-height:26px}' +
        '#ptfBootSplash .ptf-boot-hint{margin:6px 0 0;font-size:12px;color:#94a3b8;line-height:1.9}' +
        '#ptfBootSplash .ptf-boot-actions{display:flex;gap:8px;justify-content:center;margin-top:16px;flex-wrap:wrap}' +
        '#ptfBootSplash .ptf-boot-actions[hidden]{display:none}' +
        '#ptfBootSplash .ptf-boot-btn{font-family:inherit;font-weight:900;font-size:13px;border-radius:13px;padding:11px 18px;cursor:pointer;min-height:46px}' +
        '#ptfBootSplash .ptf-boot-retry{background:linear-gradient(135deg,#ef4b1a,#f79400);color:#fff;border:0}' +
        '#ptfBootSplash .ptf-boot-local{background:#f8fafc;color:#334155;border:1.5px solid #e2e8f0}' +
        '#ptfBootSplash[data-state="fail"] .ptf-boot-liquid{display:none}' +
        '#ptfBootSplash[data-state="fail"] .ptf-boot-ring{display:block;animation-play-state:paused;border-top-color:#f59e0b;border-left-color:#f59e0b;opacity:.5}' +
        '#ptfBootSplash[data-state="fail"] .ptf-boot-ring2{animation-play-state:paused;opacity:.4}' +
        '#ptfBootSplash[data-state="fail"] .ptf-boot-bar{display:none}' +
        '#ptfBootSplash[data-state="fail"] .ptf-boot-card::before{background:linear-gradient(90deg,#f59e0b,#fbbf24,#f59e0b);background-size:200% 100%}' +
        '#ptfBootSplash[data-state="session"] .ptf-boot-bar{display:none}' +
        '@keyframes ptfBootRing{to{transform:rotate(360deg)}}' +
        '@keyframes ptfBootRingRev{to{transform:rotate(-360deg)}}' +
        '@keyframes ptfBootPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.045)}}' +
        '@keyframes ptfBootSlide{0%{transform:translateX(185%)}100%{transform:translateX(-185%)}}' +
        '@keyframes ptfBootShimmer{to{background-position:-200% 0}}' +
        '@media(prefers-reduced-motion:reduce){#ptfBootSplash .ptf-boot-ring,#ptfBootSplash .ptf-boot-ring2,#ptfBootSplash .ptf-boot-logo,#ptfBootSplash .ptf-boot-bar i,#ptfBootSplash .ptf-boot-card::before{animation:none}}' +
        '@media(max-width:420px){#ptfBootSplash .ptf-boot-card{padding:26px 18px 22px}#ptfBootSplash h2{font-size:15.5px}}';
      document.head.appendChild(css);
    } catch (e) {}
  }

  function setText(id, txt) { try { var n = $(id); if (n) n.textContent = txt; } catch (e) {} }
  function setTitle(t) { setText('ptfBootSplashTitle', t); }
  function setMsg(t) { setText('ptfBootSplashMsg', t); }
  function setHint(t) { setText('ptfBootSplashHint', t); }

  function paintSteps(active) {
    try {
      var box = $('ptfBootSplashSteps');
      if (!box) return;
      var order = ['connect', 'sync', 'finish'];
      var ai = order.indexOf(active);
      var spans = box.querySelectorAll('span');
      for (var i = 0; i < spans.length; i++) {
        var s = spans[i], ki = order.indexOf(s.getAttribute('data-s'));
        s.classList.remove('on');
        s.classList.remove('done');
        if (active === 'done' || ki < ai) {
          s.classList.add('done');
          var tx = String(s.textContent || '').replace(/^✓\s*/, '');
          if (s.textContent.indexOf('✓') < 0) s.textContent = '✓ ' + tx;
        } else if (ki === ai) s.classList.add('on');
      }
    } catch (e) {}
  }

  function buildDom() {
    var old = $('ptfBootSplash');
    if (old) return old;
    var root = document.createElement('div');
    root.id = 'ptfBootSplash';
    root.dir = 'rtl';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-labelledby', 'ptfBootSplashTitle');
    root.setAttribute('data-state', 'loading');
    root.innerHTML =
      '<div class="ptf-boot-card">' +
        '<div class="ptf-boot-logo-wrap"><canvas class="ptf-boot-liquid" id="ptfBootLiquid" width="134" height="134" aria-hidden="true"></canvas><div class="ptf-boot-ring" aria-hidden="true"></div><div class="ptf-boot-ring2" aria-hidden="true"></div>' +
        '<img class="ptf-boot-logo" src="../assets/images/ptf-logo-mark.png" alt="پیشرو تجهیز فرتاک" onerror="if(!this._fb){this._fb=1;this.classList.add(\'fb-full\');this.src=\'../assets/images/ptf-logo.png\'}else{this.onerror=null;this.style.display=\'none\';this.parentNode.classList.add(\'no-logo\');}"></div>' +
        '<h2 id="ptfBootSplashTitle">در حال آماده‌سازی سامانه…</h2>' +
        '<div class="ptf-boot-steps" id="ptfBootSplashSteps"><span data-s="connect">۱. اتصال به سرور</span><span data-s="sync">۲. دریافت اطلاعات</span><span data-s="finish">۳. آماده‌سازی محیط کار</span></div>' +
        '<div class="ptf-boot-bar" aria-hidden="true"><i></i></div>' +
        '<p class="ptf-boot-msg" id="ptfBootSplashMsg" role="status" aria-live="polite">در حال اتصال به سرور…</p>' +
        '<p class="ptf-boot-hint" id="ptfBootSplashHint">لطفاً چند لحظه صبر کنید</p>' +
        '<div class="ptf-boot-actions" id="ptfBootSplashActions" hidden>' +
          '<button type="button" class="ptf-boot-btn ptf-boot-retry" id="ptfBootSplashRetry">🔄 تلاش مجدد</button>' +
          '<button type="button" class="ptf-boot-btn ptf-boot-local" id="ptfBootSplashLocal">📂 ادامه با دادهٔ محلی</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(root);
    try { $('ptfBootSplashRetry').addEventListener('click', onRetry); } catch (e1) {}
    try { $('ptfBootSplashLocal').addEventListener('click', onLocal); } catch (e2) {}
    return root;
  }

  function armTimers() {
    clearTimers();
    try {
      slowT = setTimeout(function () {
        try {
          if (!shown || done) return;
          var root = $('ptfBootSplash');
          if (!root || root.getAttribute('data-state') !== 'loading') return;
          root.setAttribute('data-state', 'slow');
          setHint('اتصال کمی کند است؛ تلاش خودکار ادامه دارد — لطفاً صبر کنید…');
        } catch (e) {}
      }, SLOW_AFTER_MS);
    } catch (eS) {}
    try {
      failT = setTimeout(function () {
        try {
          if (!shown || done) return;
          var root = $('ptfBootSplash');
          if (!root) return;
          var st = root.getAttribute('data-state');
          /* v34.38.19: حین انتقال خودکار (migrate) تایمر «مشکل واقعی» ساکت است؛
             failsafe اختصاصی ۴۰ثانیه‌ای sync.js خودش ready را صدا می‌زند. */
          if (st === 'fail' || st === 'session' || st === 'done' || st === 'migrate') return;
          goFail('');
        } catch (e) {}
      }, FAIL_AFTER_MS);
    } catch (eF) {}
  }

  function goFail(reason) {
    if (!shown || done) return;
    var root = $('ptfBootSplash');
    if (!root) return;
    clearTimers();
    liquidStop();
    if (reason) lastReason = String(reason);
    /* سکوت تا تصمیم کاربر تمدید می‌شود تا تلاش‌های پس‌زمینه سیل نسازند. */
    try { window.ptfBootQuiet = true; window.ptfBootQuietUntil = Date.now() + QUIET_CAP_MS; } catch (eQ) {}
    root.setAttribute('data-state', 'fail');
    setTitle('⚠️ اتصال به سرور برقرار نشد');
    setMsg(faReason(lastReason));
    setHint('اطلاعات شما روی این دستگاه حفظ شده است.');
    try { $('ptfBootSplashActions').hidden = false; } catch (e) {}
  }

  function finishSplash() {
    clearTimers();
    liquidStop();
    endQuiet(true);
    done = true;
    try {
      var root = $('ptfBootSplash');
      if (root) {
        root.classList.add('ptf-boot-hide');
        setTimeout(function () { try { if (root.parentNode) root.parentNode.removeChild(root); } catch (eR) {} }, 420);
      }
    } catch (e) {}
  }

  function onRetry() {
    try {
      var root = $('ptfBootSplash');
      if (!root || done) return;
      root.setAttribute('data-state', 'loading');
      try { $('ptfBootSplashActions').hidden = true; } catch (e) {}
      setTitle('در حال آماده‌سازی سامانه…');
      setMsg('تلاش مجدد برای اتصال…');
      setHint('لطفاً چند لحظه صبر کنید');
      paintSteps('sync');
      liquidStart();
      armTimers();
      try { window.ptfBootQuiet = true; window.ptfBootQuietUntil = Date.now() + QUIET_CAP_MS; } catch (eQ) {}
      var verdict = false;
      try {
        verdict = (typeof window.ptfSyncRetryBootstrap === 'function') ? window.ptfSyncRetryBootstrap() : 'reload';
      } catch (eR) { verdict = false; }
      if (verdict === 'reload') { try { location.reload(); } catch (eL) {} }
      else if (!verdict) setMsg('درخواست قبلی هنوز در جریان است…');
    } catch (e) {}
  }

  function onLocal() {
    try {
      if (done) return;
      finishSplash();
      var real = window._ptfToastReal || window.ptfToast;
      try {
        if (typeof real === 'function') real('📂 در حالت محلی ادامه می‌دهید؛ همگام‌سازی خودکار در پس‌زمینه ادامه دارد.', 'info');
      } catch (eT) {}
    } catch (e) {}
  }

  /* ---------- API عمومی ---------- */
  window.ptfBootSplashShow = function () {
    try {
      if (shown || done) return;
      if (window._ptfSyncBootstrapped === true) return;
      if ($('ptfVerShield')) return; /* بارگذاری مجدد نسخه در راه است */
      if (!document.body) {
        setTimeout(function () { try { window.ptfBootSplashShow(); } catch (e) {} }, 120);
        return;
      }
      injectCss();
      buildDom();
      shown = true;
      t0 = Date.now();
      lastReason = '';
      lastAttempt = 0;
      window.ptfBootQuiet = true;
      window.ptfBootQuietUntil = t0 + QUIET_CAP_MS;
      paintSteps('connect');
      setTitle('در حال آماده‌سازی سامانه…');
      setMsg('در حال اتصال به سرور…');
      setHint('لطفاً چند لحظه صبر کنید');
      liquidStart();
      armTimers();
    } catch (e) {}
  };

  window.ptfBootSplashStep = function (name, info) {
    try {
      if (!shown || done) return;
      var root = $('ptfBootSplash');
      if (!root) return;
      var st = root.getAttribute('data-state');
      if (st === 'fail' || st === 'session' || st === 'done') return; /* حالت پایانی قفل است */
      info = info || {};
      if (name === 'connect') { paintSteps('connect'); setMsg('در حال اتصال به سرور…'); }
      else if (name === 'sync') { paintSteps('sync'); setMsg('در حال دریافت اطلاعات از سرور…'); }
      else if (name === 'migrate') {
        /* v34.38.19 (AUTO-MIGRATE-001): انتقال یک‌بارهٔ خودکار — پنجرهٔ «مشکل
           واقعی» از نو مسلح می‌شود تا انتقالِ طولانی پرده را خطایی نکند. */
        var r0 = $('ptfBootSplash');
        if (r0) r0.setAttribute('data-state', 'migrate');
        paintSteps('finish');
        setMsg('در حال انتقال و همگرایی داده‌های این دستگاه با سرور…');
        setHint('فقط بار اول کمی طول می‌کشد؛ لطفاً تب را نبندید و صفحه را رفرش نکنید');
        armTimers();
      }
      else if (name === 'retry') {
        paintSteps('sync');
        lastAttempt = +info.attempt || lastAttempt;
        if (info.reason) lastReason = String(info.reason);
        setMsg('تلاش مجدد برای دریافت اطلاعات…' + (lastAttempt > 0 ? ' (تلاش ' + faNum(lastAttempt) + ')' : ''));
      }
      else if (name === 'finish') { paintSteps('finish'); setMsg('در حال آماده‌سازی محیط کار…'); }
    } catch (e) {}
  };

  window.ptfBootSplashReady = function (detail, noticeMsg) {
    try {
      if (!shown || done) return;
      done = true;
      clearTimers();
      var root = $('ptfBootSplash');
      var applied = 0;
      try { applied = (detail && (+detail.applied || 0)) || 0; } catch (eD) {}
      if (root) {
        paintSteps('done');
        root.setAttribute('data-state', 'done');
        setTitle('✅ سامانه آماده شد');
        setMsg(applied > 0 ? ('✅ ' + faNum(applied) + ' بخش به‌روز شد') : '✅ اطلاعات به‌روز است');
        try { $('ptfBootSplashActions').hidden = true; } catch (eA) {}
      }
      var wait = Math.max(0, MIN_SHOW_MS - (Date.now() - t0)) + 450;
      setTimeout(function () {
        var q = [];
        try { q = (window._ptfBootToastQueue || []).slice(); } catch (eQ0) {}
        try {
          if (root) root.classList.add('ptf-boot-hide');
          setTimeout(function () { try { if (root && root.parentNode) root.parentNode.removeChild(root); } catch (eR) {} }, 420);
        } catch (eF) {}
        liquidStop();
        endQuiet(true);
        /* حداکثر یک پیام پس از آماده‌شدن: خطای err از همه مهم‌تر است،
           وگرنه فقط پیام صریحِ ready (مثل بخش‌های ناخوانای سرور). */
        try {
          var real = window._ptfToastReal;
          if (typeof real === 'function') {
            var lastErr = null;
            for (var i = 0; i < q.length; i++) if (q[i] && q[i].kind === 'err') lastErr = q[i];
            if (lastErr) real(lastErr.msg, 'err');
            else if (noticeMsg) real(noticeMsg, 'warn');
          }
        } catch (eN) {}
      }, wait);
    } catch (e) { try { liquidStop(); endQuiet(true); } catch (e2) {} }
  };

  window.ptfBootSplashFail = function (reason) {
    try { goFail(reason); } catch (e) {}
  };

  window.ptfBootSplashSessionExpired = function () {
    try {
      if (!shown || done) return;
      var root = $('ptfBootSplash');
      if (!root) return;
      clearTimers();
      liquidStop();
      root.setAttribute('data-state', 'session');
      try { $('ptfBootSplashActions').hidden = true; } catch (eA) {}
      setTitle('🔐 نشست منقضی شده');
      setMsg('در حال انتقال به صفحهٔ ورود…');
      setHint('');
      paintSteps('connect');
    } catch (e) {}
  };

  window.ptfBootSplashHide = function () {
    try {
      clearTimers();
      liquidStop();
      endQuiet(true);
      var root = $('ptfBootSplash');
      if (root && root.parentNode) root.parentNode.removeChild(root);
      shown = false; done = false; t0 = 0; lastReason = ''; lastAttempt = 0;
    } catch (e) {}
  };

  window.ptfBootSplashState = function () {
    try {
      return {
        shown: shown, done: done,
        quiet: !!window.ptfBootQuiet,
        queued: (window._ptfBootToastQueue || []).length,
        attempt: lastAttempt, reason: lastReason,
        liquid: !!LIQ.ok /* v34.38.19: تشخیص سلامت موتور مایع برای تسترها */
      };
    } catch (e) { return {}; }
  };

  /* مسیر اصلی موفقیت: sync.js پس از snapshot سالم این رویداد را می‌فرستد. */
  try {
    window.addEventListener('ptf:sync-ready', function (ev) {
      try { window.ptfBootSplashReady(ev && ev.detail); } catch (e) {}
    });
  } catch (eL) {}
})();
