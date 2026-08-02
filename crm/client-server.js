/* =====================================================================
   PTF CRM — client-server.js — DB-MIG-001 (فاز B) — v33.19.0
   کلاینت نازک: سرور (MySQL) منبع حقیقت؛ localStorage فقط کش/صف آفلاین.

   v33.19.0 (رفع باگ هم‌گرایی کاربران — ۱۴۰۵/۰۸/۱۱):
   - serverPush: needLogin/401 → بازسازی نشست (ptfSyncRefreshAuth) + یک بار retry (الگوی backup.js).
     قبلاً خطای توکن با پیام اشتباه «سرور در دسترس نیست» نمایش داده می‌شد.
   - ptfBPushBatch: ارسال دسته‌ای (هر بار حداکثر ۲۰ کلید) — در flush صف و هم‌گرایی یک‌باره؛
     payload چندمگابایتی یک‌جا روی دستگاه‌های پرحافظه رد/تایم‌اوت می‌شد.
   - هم‌گرایی موفق → نشانگر ptf_b_synced_<user> (پیش‌نیاز پاک‌سازی کش).
   - ptfBClearLocalCache: پاک‌سازی امن کش محلی — فقط با فاز B فعال + هم‌گرایی موفق + صف خالی
     + تأیید صریح با تایپ کلمهٔ «پاک».

   تصمیمات کارفرما (۱۴۰۵/۰۸/۱۱):
   ۱) آفلاین: صف محلی + همگام‌سازی مجدد خودکار (تغییرات در صف می‌ماند و با برگشت اینترنت می‌رود)
   ۲) هم‌گرایی دادهٔ محلی: انتقال یک‌باره با تأیید کاربر (اولین ورود پس از فعال‌سازی)
   ۳) دامنه: همهٔ کلیدها (فاز B کامل)

   مکانیزم:
   - روی getData/setData (تعریف‌شده در index.html) هوک می‌زنیم:
     * getData: اول سرور (کش ۳۰ ثانیه)؛ آفلاین/خطا → کش محلی؛ نبود → []
     * setData: در صف محلی (دادهٔ محلی) + push به سرور (debounced)؛ خطا → صف می‌ماند
   - یک «پرچم فاز B» (در settings سینک‌شونده) فعال‌سازی/غیرفعال‌سازی را کنترل می‌کند؛
     تا وقتی فاز B فعال نشده، رفتار قبلی (localStorage محور) حفظ می‌شود.
   - هم‌گرایی یک‌باره: اگر فلگ «هم‌گرایی انجام شد» نبود → مودال تأیید → flush دادهٔ محلی به سرور.
   ===================================================================== */
(function () {
  'use strict';
  if (window.__ptfClientServerLoaded) return;
  window.__ptfClientServerLoaded = true;

  var API = '../api/crm.php';
  var CACHE_TTL = 30000; /* کش ۳۰ ثانیه */
  var cache = {};        /* key → {t, v} */

  function flagKey() { return 'ptf_b_phase'; }
  function flushKey() {
    var u = '';
    try { u = (curSession() || {}).user || ''; } catch (e) {}
    return 'ptf_b_flushed_' + (u || '_');
  }
  /* v33.19.0: نشانگر «هم‌گرایی موفق» — فقط با موفقیت کامل ارسال دسته‌ای ست می‌شود (پیش‌نیاز پاک‌سازی کش) */
  function syncedKey() {
    var u = '';
    try { u = (curSession() || {}).user || ''; } catch (e) {}
    return 'ptf_b_synced_' + (u || '_');
  }
  function markSynced() { try { localStorage.setItem(syncedKey(), '1'); } catch (e) {} }
  function isSynced() { try { return localStorage.getItem(syncedKey()) === '1'; } catch (e) { return false; } }
  function getFlag() { try { return localStorage.getItem(flagKey()) === '1'; } catch (e) { return false; } }
  window.ptfBPhaseActive = getFlag;

  /* کلیدهایی که از سرور می‌آیند (همه — فاز B کامل) — از sync.SYNC_KEYS واقعی می‌خوانیم */
  function bKeys() {
    try {
      if (window.__ptfBKeys && window.__ptfBKeys.length) return window.__ptfBKeys;
    } catch (e) {}
    return bKeysFallback();
  }
  function bKeysFallback() {
    try {
      if (window.__ptfBKeys) return window.__ptfBKeys;
      /* سعی می‌کنیم از state/sync.js لیست را بگیریم — fallback: کلیدهای معروف */
      if (window._ptfSyncKeys) { window.__ptfBKeys = window._ptfSyncKeys.slice(); return window.__ptfBKeys; }
      var known = ['ptf_crm_rfqs','ptf_crm_suppliers','ptf_crm_customers','ptf_crm_products','ptf_crm_catalog_reviews','ptf_crm_catalog_merges','ptf_crm_surplus','ptf_crm_offers','ptf_crm_leads','ptf_crm_reminders','ptf_crm_buyquotes','ptf_crm_invoices','ptf_crm_notifs','ptf_crm_sendqueue','ptf_crm_audit','ptf_crm_inqitems','ptf_crm_deals','ptf_crm_projects','ptf_crm_packinglists','ptf_crm_letters','ptf_crm_contracts','ptf_crm_sigprofiles','ptf_crm_smsbook','ptf_crm_rfqsmart','ptf_crm_settings','ptf_crm_finance','ptf_crm_order_prices','ptf_crm_payables','ptf_crm_supplier_finance','ptf_crm_opex','ptf_crm_shareholders','ptf_crm_sharetx','ptf_crm_fiscal_snapshots','ptf_crm_techcases','ptf_crm_calc_runs','ptf_crm_techproposals','ptf_crm_leadfinder_jobs','ptf_crm_leadfinder_sources','ptf_crm_notifprefs','ptf_crm_trash','ptf_crm_petty','ptf_crm_petty_tx','ptf_crm_petty_periods','ptf_crm_perms','ptf_crm_avatars','ptf_crm_buycmp','ptf_crm_inqreads','ptf_crm_cheques_issued','ptf_crm_cheques_received','ptf_crm_msgtpls','ptf_crm_deleted_archive','ptf_crm_tax_returns','ptf_crm_sales_returns'];
      window.__ptfBKeys = known;
      return known;
    } catch (e) { return []; }
  }

  /* ---------- اتصال به سرور (data_pull / data_push موجود) ---------- */
  function authHeaders(json) {
    var h = json ? { 'Content-Type': 'application/json' } : {};
    try { var t = localStorage.getItem('ptf_crm_token'); if (t) h['X-CRM-Token'] = t; } catch (e) {}
    try { h['X-CRM-Role'] = curRole(); } catch (eR) {}
    return h;
  }
  function serverPull(since, cb) {
    fetch(API + '?action=data_pull&since=' + (since || 0), { headers: authHeaders(false) })
      .then(function (r) { return r.json(); })
      .then(function (d) { cb && cb(d); })
      .catch(function () { cb && cb({ ok: false }); });
  }
  /* v33.19.0: تشخیص نشست منقضی/توکن نامعتبر (data_push توکن الزامی دارد؛ تست اتصال از users_get عمومی است و همیشه سبز می‌ماند) */
  function isNeedLogin(d, status) {
    if (status === 401) return true;
    if (!d) return false;
    if (d.needLogin === true) return true;
    return /token|unauthorized|401/i.test(String(d.error || ''));
  }
  function serverPush(payload, cb, attempt) {
    attempt = attempt || 0;
    fetch(API + '?action=data_push', {
      method: 'POST', headers: authHeaders(true),
      body: JSON.stringify({ data: payload })
    })
      .then(function (r) {
        var st = (r && r.status) || 0;
        return r.json().then(function (d) { return { d: d, st: st }; }, function () { return { d: { ok: false, error: 'HTTP ' + st }, st: st }; });
      })
      .then(function (res) {
        var d = res.d;
        /* v33.19.0: needLogin/401 → بازسازی نشست (ptfSyncRefreshAuth) + یک بار تلاش مجدد (الگوی backup.js F0-3).
           اگر بازسازی نشست ممکن نبود، needLogin به بالا برمی‌گردد تا پیام دقیق «نشست منقضی» نمایش داده شود. */
        if (isNeedLogin(d, res.st)) {
          d.needLogin = true;
          if (attempt === 0 && typeof window.ptfSyncRefreshAuth === 'function') {
            window.ptfSyncRefreshAuth(function (ok) {
              if (ok) { serverPush(payload, cb, 1); return; }
              cb && cb(d);
            });
            return;
          }
        }
        cb && cb(d);
      })
      .catch(function () { cb && cb({ ok: false }); });
  }

  /* ---------- کش محلی ---------- */
  function localGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function localSet(k, v) {
    try {
      if (typeof ptfStorageSafeSetItem === 'function') return ptfStorageSafeSetItem(k, v, { noWarn: true });
      localStorage.setItem(k, v); return true;
    } catch (e) { return false; }
  }
  function localDel(k) { try { localStorage.removeItem(k); } catch (e) {} }

  /* ---------- صف آفلاین ---------- */
  function queueKey() { return 'ptf_b_queue'; }
  function queueRead() { try { return JSON.parse(localStorage.getItem(queueKey()) || '{}'); } catch (e) { return {}; } }
  function queueWrite(q) { try { localStorage.setItem(queueKey(), JSON.stringify(q)); } catch (e) {} }
  function queueAdd(k) {
    var q = queueRead(); q[k] = (q[k] || 0) + 1; queueWrite(q);
    try { if (window.ptfSyncNotifyDirty) window.ptfSyncNotifyDirty(k); } catch (e) {}
  }
  function queueClear(keys) {
    var q = queueRead(); (keys || []).forEach(function (k) { delete q[k]; }); queueWrite(q);
  }

  /* ---------- v33.19.0: ارسال دسته‌ای (هر بار حداکثر ۲۰ کلید) ----------
     ریشهٔ باگ: روی دستگاه‌های پرحافظه، ارسال همهٔ کلیدها یک‌جا → payload چند مگابایتی
     → رد/تایم‌اوت سرور؛ درحالی‌که تست اتصال (users_get عمومی) سبز می‌ماند.
     شکست یک دسته → فقط همان دسته ناموفق است؛ needLogin → توقف کامل (ادامه بی‌فایده است). */
  var BATCH_SIZE = 20;
  window.ptfBPushBatch = function (payload, cb) {
    var keys = Object.keys(payload || {});
    if (!keys.length) { cb && cb({ ok: true, pushed: 0, total: 0 }); return; }
    var batches = [];
    for (var i = 0; i < keys.length; i += BATCH_SIZE) batches.push(keys.slice(i, i + BATCH_SIZE));
    var done = 0, failed = [], lastError = '';
    function step(idx) {
      if (idx >= batches.length) {
        cb && cb({ ok: !failed.length, pushed: done, failed: failed, total: keys.length, error: lastError });
        return;
      }
      var sub = {};
      batches[idx].forEach(function (k) { sub[k] = payload[k]; });
      serverPush(sub, function (d) {
        if (d && d.ok) { done += batches[idx].length; step(idx + 1); return; }
        if (d && d.needLogin) {
          /* نشست منقضی: باقی دسته‌ها هم شکست می‌خورند — همهٔ کلیدهای باقی‌مانده تا ورود دوباره نگه داشته می‌شوند */
          for (var j = idx; j < batches.length; j++) failed = failed.concat(batches[j]);
          cb && cb({ ok: false, pushed: done, failed: failed, total: keys.length, error: 'needLogin', needLogin: true });
          return;
        }
        failed = failed.concat(batches[idx]);
        lastError = (d && d.error) || 'network';
        step(idx + 1);
      });
    }
    step(0);
  };

  /* ---------- flush صف به سرور ---------- */
  window.ptfBFlushQueue = function (cb) {
    var q = queueRead(); var keys = Object.keys(q);
    if (!keys.length) { cb && cb({ ok: true, pushed: 0 }); return; }
    var payload = {};
    keys.forEach(function (k) { var v = localGet(k); if (v !== null) payload[k] = v; });
    /* v33.19.0: ارسال دسته‌ای — کلیدهای موفق از صف خارج، شکست‌خورده‌ها برای تلاش مجدد می‌مانند */
    window.ptfBPushBatch(payload, function (d) {
      var failed = (d && d.failed) || [];
      var okKeys = keys.filter(function (k) { return failed.indexOf(k) === -1; });
      if (okKeys.length) queueClear(okKeys);
      if (d && d.ok) { cb && cb({ ok: true, pushed: d.pushed }); return; }
      cb && cb(Object.assign({ ok: false }, d));
    });
  };

  /* ---------- هم‌گرایی یک‌باره (تأیید کاربر) ---------- */
  function flushRequired() { try { return localStorage.getItem(flushKey()) !== '1'; } catch (e) { return false; } }
  function markFlushed() { try { localStorage.setItem(flushKey(), '1'); } catch (e) {} }
  window.ptfBFinalize = function () {
    /* هم‌گرایی یک‌باره: دادهٔ محلی → سرور (با تأیید کاربر) */
    if (flushRequired()) {
      var keys = bKeys();
      var payload = {};
      keys.forEach(function (k) { var v = localGet(k); if (v !== null) payload[k] = v; });
      if (Object.keys(payload).length) {
        var ok = confirm('🌐 هم‌گرایی داده با سرور\n\nدادهٔ محلی مرورگر شما یک‌بار به سرور منتقل می‌شود تا با دیتابیس یکپارچه شود (localStorage پس از آن فقط کش می‌شود).\n\nادامه می‌دهید؟');
        if (!ok) { alert('می‌توانید بعداً از «تنظیمات → هم‌گرایی داده» این کار را انجام دهید.'); return; }
        /* v33.18.0: فلگ را قبل از ارسال ست می‌کنیم تا در همان session دوباره نپرسد؛
           اگر push ناموفق بود، دادهٔ محلی محفوظ است و دکمهٔ «هم‌گرایی» دوباره در دسترس است. */
        markFlushed();
        /* v33.19.0: ارسال دسته‌ای (دستگاه‌های پرحافظه payload چندمگابایتی داشتند و یک‌جا رد می‌شدند)
           + پیام دقیق انقضای نشست (به‌جای «سرور در دسترس نیست» که با تست اتصال سبز تناقض داشت) */
        window.ptfBPushBatch(payload, function (d) {
          if (d && d.ok) {
            markSynced();
            alert('✅ هم‌گرایی انجام شد.');
            location.reload();
            return;
          }
          if (d && d.needLogin) {
            alert('⚠️ نشست شما منقضی شده است؛ دوباره وارد شوید، سپس هم‌گرایی را از «تنظیمات → هم‌گرایی داده» انجام دهید. دادهٔ محلی شما محفوظ است.');
            return;
          }
          alert('⚠️ فقط ' + (d.pushed || 0) + ' از ' + (d.total || Object.keys(payload).length) + ' کلید هم‌گرایی شد (' + ((d && d.error) || 'network') + '). دادهٔ محلی شما محفوظ است؛ از «تنظیمات → هم‌گرایی داده» دوباره تلاش کنید.');
        });
      } else { markFlushed(); markSynced(); }
    }
    /* صف آفلاین را هم خالی کن */
    window.ptfBFlushQueue(function () {});
  };
  window.ptfBConfirmFlush = function () {
    try { localStorage.removeItem(flushKey()); localStorage.removeItem(syncedKey()); } catch (e) {}
    window.ptfBFinalize();
  };

  /* ---------- v33.19.0: پاک‌سازی امن کش محلی ----------
     دکمهٔ «🗑 پاک‌سازی کش محلی» در باکس فاز B در تنظیمات (backup.js).
     برای دستگاه‌های پرحافظه پس از مهاجرت: حافظهٔ localStorage آزاد می‌شود چون
     منبع حقیقت روی سرور است و کش هنگام استفاده دوباره از سرور پر می‌شود.
     گاردهای امنیتی (همه الزامی):
       ۱) حالت سرور-محور (فاز B) فعال باشد
       ۲) هم‌گرایی یک‌باره با موفقیت انجام شده باشد (نشانگر ptf_b_synced_<user>)
       ۳) صف آفلاین خالی باشد (هیچ داده‌ای منتظر ارسال نباشد)
       ۴) تأیید صریح کاربر با تایپ کلمهٔ «پاک» */
  window.ptfBClearLocalCache = function () {
    if (!getFlag()) {
      alert('⚠️ حالت سرور-محور (فاز B) فعال نیست.\nبرای امنیت داده، پاک‌سازی کش فقط در حالت سرور-محور ممکن است. ابتدا «فعال‌سازی حالت سرور-محور» را بزنید و هم‌گرایی را کامل کنید.');
      return;
    }
    if (flushRequired() || !isSynced()) {
      alert('⚠️ هم‌گرایی دادهٔ محلی با سرور هنوز کامل نشده است.\nابتدا از «تنظیمات → 🔄 هم‌گرایی دادهٔ محلی» هم‌گرایی را انجام دهید و موفقیت آن را ببینید؛ سپس پاک‌سازی کش را اجرا کنید.');
      return;
    }
    var qs = queueRead();
    var qn = Object.keys(qs).length;
    if (qn) {
      alert('⚠️ ' + qn + ' کلید در صف آفلاین هنوز به سرور ارسال نشده است.\nپاک‌سازی متوقف شد تا هیچ داده‌ای گم نشود. با اتصال پایدار «🔄 هم‌گرایی دادهٔ محلی» را بزنید تا صف خالی شود؛ سپس پاک‌سازی کنید.');
      return;
    }
    var word = prompt('🗑 پاک‌سازی کش محلی\n\nاین کار کش localStorage را برای کلیدهای اصلی CRM خالی می‌کند. دادهٔ اصلی روی سرور است و حذف نمی‌شود؛ هنگام استفاده دوباره از سرور بارگیری می‌شود.\n\nبرای تأیید، کلمهٔ «پاک» را بنویسید:');
    if (word === null) return; /* کاربر لغو کرد */
    if (String(word).trim() !== 'پاک') { alert('پاک‌سازی لغو شد — کلمهٔ تأیید درست نبود.'); return; }
    var keys = bKeys(), removed = 0, freed = 0;
    keys.forEach(function (k) {
      try {
        var v = localStorage.getItem(k);
        if (v !== null) { freed += (k.length + v.length) * 2; localStorage.removeItem(k); removed++; }
      } catch (e) {}
    });
    try { cache = {}; } catch (e) {}
    try { if (typeof addLog === 'function') addLog('🗑 پاک‌سازی کش محلی (فاز B) — ' + removed + ' کلید، حدود ' + Math.round(freed / 1024) + ' KB آزاد شد'); } catch (eL) {}
    try { if (typeof audit === 'function') audit('سیستم', '🗑 پاک‌سازی کش محلی (فاز B) — ' + removed + ' کلید', ''); } catch (eA) {}
    alert('✅ پاک‌سازی کش محلی انجام شد.\n' + removed + ' کلید حذف شد و حدود ' + Math.round(freed / 1024) + ' KB از حافظهٔ مرورگر آزاد شد.\nدادهٔ اصلی روی سرور است و موقع استفاده دوباره بارگیری می‌شود.');
    try { if (typeof goPanelByName === 'function') goPanelByName('set'); } catch (eG) {}
  };

  /* ---------- هوک getData / setData ----------
     فقط وقتی فاز B فعال است (پرچم). غیرفعال = رفتار قبلی. */
  function hook() {
    var _get = window.getData, _set = window.setData;
    if (typeof _get !== 'function' || typeof _set !== 'function') return false;
    /* v33.19.0: جلوگیری از دوباره‌هوک‌شدن — boot interval و ptfBEnable هر دو hook را صدا می‌زنند؛
       بدون این گارد، getData چند لایه روی هم قرار می‌گرفت و مرورگر چند بار serverPull می‌زد. */
    if (_get.__ptfB && _set.__ptfB) return true;

    /* getData: کش ۳۰ ثانیه → سرور → کش محلی */
    window.getData = function (k) {
      try {
        if (!getFlag()) return _get(k);
        if (!bKeys().indexOf) return _get(k);
        if (bKeys().indexOf(k) === -1) return _get(k);
        var now = Date.now();
        if (cache[k] && (now - cache[k].t) < CACHE_TTL) return JSON.parse(cache[k].v);
        /* خواندن از کش محلی بلافاصله (تا سرور بیاید) */
        var local = localGet(k);
        var localArr = [];
        try { localArr = local ? JSON.parse(local) : []; } catch (e) {}
        /* درخواست سرور (async) — مقدار کش را بعداً به‌روز می‌کند؛ فعلاً محلی برمی‌گردد */
        serverPull(0, function (d) {
          try {
            if (d && d.ok && d.data && Object.prototype.hasOwnProperty.call(d.data, k)) {
              var v = d.data[k];
              cache[k] = { t: now, v: v };
              localSet(k, v);
            }
          } catch (e) {}
        });
        return localArr;
      } catch (e) { return _get(k); }
    };

    /* setData: صف + push (debounced) */
    var pushTimer = null;
    window.setData = function (k, d) {
      try {
        if (!getFlag()) return _set(k, d);
        if (!bKeys().indexOf) return _set(k, d);
        if (bKeys().indexOf(k) === -1) return _set(k, d);
        var s = JSON.stringify(d);
        cache[k] = { t: Date.now(), v: s };
        localSet(k, s);
        queueAdd(k);
        if (pushTimer) clearTimeout(pushTimer);
        pushTimer = setTimeout(function () { window.ptfBFlushQueue(function () {}); }, 4000);
        try { if (window.ptfSyncNotifyDirty) window.ptfSyncNotifyDirty(k); } catch (e) {}
        return true;
      } catch (e) { return _set(k, d); }
    };
    window.getData.__ptfB = true;
    window.setData.__ptfB = true;
    return true;
  }

  /* ---------- فعال‌سازی/غیرفعال‌سازی (از تنظیمات) ---------- */
  window.ptfBEnable = function () {
    try { localStorage.setItem(flagKey(), '1'); } catch (e) {}
    hook();
    window.ptfBFinalize();
    if (typeof ptfToast === 'function') ptfToast('حالت سرور-محور فعال شد — localStorage فقط کش می‌شود', 'ok');
  };
  window.ptfBDisable = function () {
    try { localStorage.removeItem(flagKey()); } catch (e) {}
    if (typeof ptfToast === 'function') ptfToast('حالت سرور-محور غیرفعال شد (بازگشت به حالت قبلی)', 'warn');
  };

  /* ---------- بوت: هوک + اگر فعال بود، هم‌گرایی ---------- */
  var tries = 0;
  var t = setInterval(function () {
    tries++;
    if (hook() || tries > 40) {
      clearInterval(t);
      try { if (getFlag() && flushRequired()) window.ptfBFinalize(); } catch (e) {}
    }
  }, 300);
})();
