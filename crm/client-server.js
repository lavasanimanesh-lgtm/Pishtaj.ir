/* =====================================================================
   PTF CRM — client-server.js — DB-MIG-001 (فاز B) — v33.18.0
   کلاینت نازک: سرور (MySQL) منبع حقیقت؛ localStorage فقط کش/صف آفلاین.

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
  function serverPush(payload, cb) {
    fetch(API + '?action=data_push', {
      method: 'POST', headers: authHeaders(true),
      body: JSON.stringify({ data: payload })
    })
      .then(function (r) { return r.json(); })
      .then(function (d) { cb && cb(d); })
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

  /* ---------- flush صف به سرور ---------- */
  window.ptfBFlushQueue = function (cb) {
    var q = queueRead(); var keys = Object.keys(q);
    if (!keys.length) { cb && cb({ ok: true, pushed: 0 }); return; }
    var payload = {};
    keys.forEach(function (k) { var v = localGet(k); if (v !== null) payload[k] = v; });
    serverPush(payload, function (d) {
      if (d && d.ok) { queueClear(keys); cb && cb({ ok: true, pushed: keys.length }); }
      else cb && cb({ ok: false, error: (d && d.error) || 'network' });
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
        serverPush(payload, function (d) {
          if (d && d.ok) { alert('✅ هم‌گرایی انجام شد.'); location.reload(); }
          else alert('⚠️ سرور در دسترس نیست — دادهٔ محلی محفوظ است؛ از «تنظیمات → هم‌گرایی داده» بعداً تلاش کنید.');
        });
      } else markFlushed();
    }
    /* صف آفلاین را هم خالی کن */
    window.ptfBFlushQueue(function () {});
  };
  window.ptfBConfirmFlush = function () {
    try { localStorage.removeItem(flushKey()); } catch (e) {}
    window.ptfBFinalize();
  };

  /* ---------- هوک getData / setData ----------
     فقط وقتی فاز B فعال است (پرچم). غیرفعال = رفتار قبلی. */
  function hook() {
    var _get = window.getData, _set = window.setData;
    if (typeof _get !== 'function' || typeof _set !== 'function') return false;

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
