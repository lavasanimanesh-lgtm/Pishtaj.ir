/* =====================================================================
 PTF CRM — client-server.js — DB-MIG-001 (فاز B) — v33.21.0
 کلاینت نازک: سرور (MySQL) منبع حقیقت؛ localStorage فقط کش/صف آفلاین.

 v33.21.0 (PTF-SCALE-P0 — ارتقای فناوری برای افزایش تعداد کاربران):
 getData قبلاً به‌ازای هر خواندن کلید منقضی‌شده یک پول اسنپ‌شات کامل (~۴MB) می‌زد
 (نه single-flight نه حد نرخ) — بزرگ‌ترین هزینهٔ پنهان این معماری. حالا همهٔ
 خواندن‌ها روی «پول مشترک دلتا» سوار می‌شوند: تک‌پرواز، حداقل فاصلهٔ ۲ثانیه،
 rev هرکلید (مشترک با sync.js)، پاسخ‌دهی مرکزی به کش+آینهٔ همهٔ کلیدهای تازه.
 در تب مخفی پول زمین می‌ماند. سرور: data_pull پارامتر krevs (سازگار با عقب).

 v33.20.0 (آینهٔ خالدار — PTF-B-IDB-MIRROR، درخواست کارفرما):
   مشکل: با فاز B فعال هم localStorage از آینهٔ کامل سرور پر می‌شد (۸۰٪+) چون sync.js
   هر بار لود همهٔ کلیدها را در localStorage می‌نوشت و پاک‌سازی کش بی‌اثر می‌ماند.
   راه‌حل: کلیدهای سنگین (فهرست IDB_KEYS + خودکار >۱۲۰هزار کاراکتر) فقط در «حافظهٔ نشست
   + IndexedDB» نگهداری می‌شوند (سقف IDB صدها برابر localStorage است)؛ کلیدهای سبک
   همچنان آینهٔ localStorage‌اند (آفلاین/رندر فوری حفظ می‌شود).
   فعال‌سازی فقط وقتی: فاز B فعال + هم‌گرایی موفق (ptf_b_synced_<user>) + IndexedDB موجود.

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

  /* ---------- v33.20.0: آینهٔ خالدار (کلیدهای سنگین → حافظهٔ نشست + IndexedDB) ----------
     localStorage فقط برای کلیدهای سبک آینه می‌شود؛ سنگین‌ها در idbMem (بدون TTL) + IDB
     با پیشوند «bdata:» نگهداری می‌شوند تا سقف ۵MB لمس نشود. آفلاین/رندر فوری حفظ است. */
  var IDB_KEYS = ['ptf_crm_avatars','ptf_crm_deleted_archive','ptf_crm_packinglists','ptf_crm_letters','ptf_crm_contracts','ptf_crm_techproposals','ptf_crm_calc_runs','ptf_crm_fiscal_snapshots','ptf_crm_inqreads','ptf_crm_inqitems'];
  var IDB_AUTO_LIMIT = 120000; /* ≈۲۴۰KB (UTF-16) — هر کلید بزرگ‌تر از این خودکار سنگین می‌شود */
  var idbMem = {};   /* آینهٔ حافظهٔ کلیدهای سنگین (منبع همین نشست) */
  var idbKnown = {}; /* کلیدهایی که در این نشست «سنگین» تشخیص داده شده‌اند */
  function idbUsable() {
    try { return !!(window.indexedDB && typeof window.ptfStorageIdbSet === 'function' && typeof window.ptfStorageIdbGet === 'function'); } catch (e) { return false; }
  }
  function idbPrefix() { return 'bdata:'; }
  function heavyList(k, str) {
    if (IDB_KEYS.indexOf(k) > -1) return true;
    if (idbKnown[k]) return true;
    try { if (str != null && String(str).length > IDB_AUTO_LIMIT) return true; } catch (e) {}
    return false;
  }
  window.ptfBIsHeavyKey = heavyList;
  /* آینهٔ خالدار فقط وقتی: فاز B فعال + هم‌گرایی موفق + IndexedDB موجود */
  window.ptfBMirrorActive = function () { return getFlag() && isSynced() && idbUsable(); };
  /* نویسندهٔ آینه برای sync.js/هوک‌ها: سنگین → حافظه+IDB (true)؛ نه → false (خواننده به localStorage برگردد) */
  window.ptfBMirror = function (k, str) {
    if (!window.ptfBMirrorActive()) return false;
    if (!heavyList(k, str)) return false;
    idbKnown[k] = 1;
    idbMem[k] = String(str);
    try { window.ptfStorageIdbSet(idbPrefix() + k, String(str), function () {}); } catch (e) {}
    /* هر نسخهٔ محلیِ قدیمی همین کلید حذف می‌شود تا localStorage خلوت بماند */
    try { if (localStorage.getItem(k) !== null) localStorage.removeItem(k); } catch (e) {}
    return true;
  };

  /* v34.7.14 — projection قطعیِ یک فرمان سرور باید هر سه نمای خواندن را با هم
     عوض کند: cache سی‌ثانیه‌ای getData، آینهٔ IDB/حافظه و localStorage. مسیر قبلی
     sync.js فقط آینهٔ پایدار را می‌نوشت؛ در فاز B، getData تا ۳۰ ثانیه همان آرایهٔ
     قدیمی (مثلاً دو پرونده قبل از ادغام) را از closure cache پس می‌داد. این تابع
     عمداً setData/queueAdd را دور می‌زند چون داده قبلاً روی سرور commit شده است. */
  window.ptfBApplyServerProjection = function (k, value, rev) {
    try {
      var str = typeof value === 'string' ? value : JSON.stringify(value);
      var incomingRev = +rev || 0;
      var revs = bPullRevs();
      var knownRev = +revs[k] || 0;
      /* پاسخ دیررس یک فرمان نباید projection جدیدتری را که pull دیده بازنویسی کند. */
      if (incomingRev && knownRev > incomingRev) return false;
      /* A command/pull projection must not silently drop local physical financial rows
         that have not reached the server yet. The sync module preserves such rows and
         marks the key dirty for the protected merge path. */
      if ((k === 'ptf_crm_sharetx' || k === 'ptf_crm_shareholders') && typeof window.ptfSyncMergeServerProjection === 'function') {
        var currentProjection = null;
        try { if (typeof window.ptfBRead === 'function') currentProjection = window.ptfBRead(k); } catch (eCurrentMirror) {}
        if (currentProjection === null || currentProjection === undefined) currentProjection = localGet(k);
        str = window.ptfSyncMergeServerProjection(k, currentProjection, str);
      }

      var stored = false;
      if (window.ptfBMirrorActive() && heavyList(k, str)) {
        idbKnown[k] = 1;
        idbMem[k] = str;
        try { window.ptfStorageIdbSet(idbPrefix() + k, str, function () {}); } catch (eI) {}
        localDel(k);
        stored = true;
      } else stored = localSet(k, str) !== false;
      if (!stored) { delete cache[k]; return false; }

      cache[k] = { t: Date.now(), v: str, rev: incomingRev || knownRev };
      if (incomingRev > knownRev) {
        revs[k] = incomingRev;
        localStorage.setItem('ptf_sync_krevs', JSON.stringify(revs));
      }
      /* rev سراسری فقط پس از موفقیت همهٔ کلیدهای یک projection در sales-domain
         پذیرفته می‌شود؛ ارتقای آن در این تابع per-key می‌توانست شکست نوشتن کلید
         بعدی را پشت پاسخ fresh پنهان کند. */
      return true;
    } catch (e) {
      try { delete cache[k]; } catch (e2) {}
      return false;
    }
  };
  /* خوانندهٔ آینه برای sync.js: رشته از حافظه — شبیه localStorage.getItem (null = نسخه‌ای در دست نیست) */
  window.ptfBRead = function (k) {
    if (!window.ptfBMirrorActive()) return null;
    if (Object.prototype.hasOwnProperty.call(idbMem, k)) return idbMem[k];
    return null;
  };
  /* بوت: مهاجرت نسخه‌های localStorage کلیدهای سنگین → حافظه/IDB (آزادسازی واقعی) + پرکردن حافظه از IDB */
  var _idbPreloadDone = false;
  /* v34.38.1 (COLD-BOOT-HYDRATE): پرچم/انتظار «آب‌رسانی سرد آینه».
     ریشه «بعد از هر رفرش، رکوردهای پیشنهاد/درخواست/پرونده/تأمین خیلی دیر می‌آیند»:
     کلیدهای کسب‌وکاری offloadشده (خارج از فهرست ثابت ۱۰تایی IDB_KEYS) پس از رفرش نه
     در localStorage بودند (حذف شده) نه در idbMem (حافظه نشست خالی)؛ پس پنل‌ها []
     می‌دیدند و اولین pull مجبور بود کل دیتاست چندمگابایتی را کامل از سرور دانلود کند.
     حالا همه کلیدهای bdata: در IDB شمارش و آب‌رسانی می‌شوند و pull اول بوت
     (sync.js) با حد صبورانه منتظر همین آب‌رسانی می‌ماند تا به‌جای دانلود کامل،
     پاسخ fresh/دلتا بگیرد. fail-open در همه مسیرها: خرابی IDB هرگز pull/رندر را
     متوقف نمی‌کند. */
  window.ptfBIdbHydrated = false;
  var _idbHydrateWaiters = [];
  window.ptfBWhenHydrated = function (cb) {
    if (typeof cb !== 'function') return;
    if (window.ptfBIdbHydrated || !window.ptfBMirrorActive()) { try { cb(); } catch (eH) {} return; }
    _idbHydrateWaiters.push(cb);
  };
  function _idbHydrateFinish() {
    if (window.ptfBIdbHydrated) return;
    window.ptfBIdbHydrated = true;
    var ws = _idbHydrateWaiters; _idbHydrateWaiters = [];
    ws.forEach(function (f) { try { f(); } catch (eW) {} });
  }
  window.ptfBIdbPreload = function (cb) {
    function finish() {
      _idbHydrateFinish();
      if (typeof cb === 'function') { try { cb(); } catch (eCb) {} }
    }
    if (_idbPreloadDone) { finish(); return; }
    if (!window.ptfBMirrorActive()) { finish(); return; }
    _idbPreloadDone = true;
    var list = [];
    var seen = {};
    function push(k) { k = String(k || '').trim(); if (k && !seen[k]) { seen[k] = 1; list.push(k); } }
    try {
      bKeys().forEach(function (k) {
        var lv = null;
        try { lv = localStorage.getItem(k); } catch (e0) {}
        if (heavyList(k, lv)) push(k);
      });
    } catch (e0) {}
    /* کلیدهای offloadشده‌ای که نسخه localStorage ندارند و در فهرست ثابت نیستند،
       از خود IDB کشف می‌شوند (اجتماع با فهرست LS-scan — رفتار قبلی حفظ می‌شود). */
    function afterEnum(ids) {
      try {
        var allowed = {};
        bKeys().forEach(function (k) { allowed[String(k)] = 1; });
        (ids || []).forEach(function (id) {
          var k = String(id || '');
          if (k.indexOf(idbPrefix()) === 0) k = k.slice(idbPrefix().length);
          if (allowed[k]) push(k);
        });
      } catch (eE) {}
      hydrate();
    }
    function hydrate() {
      if (!list.length) { finish(); return; }
      var n = 0, finished = false;
      var movedAny = false;
      var hydratedAny = false;
      /* سقف صبورانه: IDB محلی است و باید میلی‌ثانیه‌ای جواب دهد؛ گیر کردنش نباید
         بوت را قفل کند — pull سرور بقیه را پوشش می‌دهد (fail-open). */
      var hardTimer = null;
      try { hardTimer = setTimeout(function () { doneAll(true); }, 4000); } catch (eT0) {}
      function done() { if (++n >= list.length) doneAll(false); }
      function doneAll() {
        if (finished) return;
        finished = true;
        try { if (hardTimer) clearTimeout(hardTimer); } catch (eT) {}
        try { if (typeof addLog === 'function') addLog('🧊 آینه خالدار فعال شد — ' + list.length + ' کلید سنگین از IndexedDB آب‌رسانی شد تا localStorage سبک بماند'); } catch (eL) {}
        /* v34.8.28 (T3-2 COLD-BOOT-RACE): اگر در همین بوت کلیدی جابه‌جا شده، نماهای
           رندرشده پیش از آب‌رسانی ممکن است [] دیده باشند — یک رندر قطعی پس از اتمام.
           v34.38.1: آب‌رسانی خالص از IDB (بدون مهاجرت LS) هم همان رندر قطعی را
           می‌خواهد؛ وگرنه پنل‌ها تا پایان pull سرور خالی می‌مانند. */
        if ((movedAny || hydratedAny) && typeof window.ptfScheduleDataRefresh === 'function') {
          try { window.ptfScheduleDataRefresh('__cold_boot__'); } catch (eR) {}
        }
        finish();
      }
      list.forEach(function (k) {
        idbKnown[k] = 1;
        var local = null;
        try { local = localStorage.getItem(k); } catch (e) {}
        if (local !== null) {
          movedAny = true;
          idbMem[k] = local;
          try { localStorage.removeItem(k); } catch (e2) {}
          try { window.ptfStorageIdbSet(idbPrefix() + k, local, done); } catch (e3) { done(); }
        } else {
          try {
            window.ptfStorageIdbGet(idbPrefix() + k, function (row) {
              try {
                if (row && row.value != null && !Object.prototype.hasOwnProperty.call(idbMem, k)) {
                  idbMem[k] = String(row.value);
                  hydratedAny = true;
                }
              } catch (e4) {}
              done();
            });
          } catch (e5) { done(); }
        }
      });
    }
    /* شمارش پیشوندی bdata: — اگر API نبود/خطا داد، همان فهرست LS-scan امروز (fail-open). */
    try {
      if (typeof window.ptfStorageIdbKeysByPrefix === 'function') {
        var enumDone = false, enumTimer = null;
        try { enumTimer = setTimeout(function () { if (!enumDone) { enumDone = true; afterEnum(null); } }, 1500); } catch (eT1) {}
        window.ptfStorageIdbKeysByPrefix(idbPrefix(), function (ids) {
          if (enumDone) return;
          enumDone = true;
          try { if (enumTimer) clearTimeout(enumTimer); } catch (eT2) {}
          afterEnum(ids);
        });
      } else afterEnum(null);
    } catch (eEnum) { afterEnum(null); }
  };
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
      var known = ['ptf_crm_rfqs','ptf_crm_suppliers','ptf_crm_customers','ptf_crm_products','ptf_crm_catalog_reviews','ptf_crm_catalog_merges','ptf_crm_surplus','ptf_crm_offers','ptf_crm_leads','ptf_crm_reminders','ptf_crm_buyquotes','ptf_crm_invoices','ptf_crm_notifs','ptf_crm_sendqueue','ptf_crm_audit','ptf_crm_inqitems','ptf_crm_deals','ptf_crm_projects','ptf_crm_packinglists','ptf_crm_letters','ptf_crm_contracts','ptf_crm_sigprofiles','ptf_crm_smsbook','ptf_crm_rfqsmart','ptf_crm_settings','ptf_crm_finance','ptf_crm_order_prices','ptf_crm_payables','ptf_crm_supplier_finance','ptf_crm_opex','ptf_crm_shareholders','ptf_crm_sharetx','ptf_crm_fiscal_snapshots','ptf_crm_techcases','ptf_crm_calc_runs','ptf_crm_techproposals','ptf_crm_leadfinder_jobs','ptf_crm_leadfinder_sources','ptf_crm_management_actions','ptf_crm_management_reports','ptf_crm_commission_records','ptf_crm_notifprefs','ptf_crm_trash','ptf_crm_petty','ptf_crm_petty_tx','ptf_crm_petty_periods','ptf_crm_perms','ptf_crm_avatars','ptf_crm_buycmp','ptf_crm_inqreads','ptf_crm_cheques_issued','ptf_crm_cheques_received','ptf_crm_cheque_books','ptf_crm_msgtpls','ptf_crm_deleted_archive','ptf_crm_tax_returns','ptf_crm_sales_returns','ptf_crm_treasury_calls','ptf_crm_bank_recon','ptf_crm_case_receipts','ptf_crm_receipt_allocations','ptf_crm_fin_attachments','ptf_crm_corrections','ptf_crm_fin_findings','ptf_crm_fin_events','ptf_crm_personal_cheques'];
      /* v34.36.1 (F6): فهرست ناقص را cache نکن. هر دو کلید مالی جاافتاده
         (ptf_crm_fin_events / ptf_crm_personal_cheques) اضافه شدند و اگر sync.js
         دیرتر بار شود، کش‌نکردن اجازه می‌دهد فهرست مرجعِ ۶۶ کلیدی بعداً جایگزین
         شود؛ پیش از این، کش شدنِ فهرست دست‌نویس باعث می‌شد کلیدهای جامانده هرگز
         در «انتقال یک‌باره» ارسال نشوند («۴۸ از ۴۹ کلید» دائمی). */
      return known;
    } catch (e) { return []; }
  }

  /* ---------- اتصال به سرور (data_pull / data_push موجود) ---------- */
  function authHeaders(json) {
    var h = json ? { 'Content-Type': 'application/json' } : {};
    try { var t = (typeof ptfAuthToken === 'function' ? ptfAuthToken() : ''); if (t) h['X-CRM-Token'] = t; } catch (e) {}
    try { h['X-CRM-Role'] = curRole(); } catch (eR) {}
    return h;
  }
  function serverPull(since, cb, krevs) {
    var url = API + '?action=data_pull&since=' + (since || 0);
    /* v33.21.0 (PTF-SCALE-P0): krevs → سرور v33.21.0+ فقط کلیدهای جدیدتر را می‌فرستد (سرور قدیمی: نادیده → کامل) */
    if (krevs) { try { url += '&krevs=' + encodeURIComponent(JSON.stringify(krevs)); } catch (eKr) {} }
    fetch(url, { headers: authHeaders(false) })
      .then(function (r) { return r.json(); })
      .then(function (d) { cb && cb(d); })
      .catch(function (error) { cb && cb({ ok: false, error: 'network', transportError: String(error || '') }); });
  }

  /* ---------- v33.21.0: پول مشترک دلتا (رفع بحرانی‌ترین هزینهٔ پنهان مقیاس) ----------
     قبل: هر خواندن کلید منقضی‌شده از کش (TTL ۳۰ثانیه) یک پول اسنپ‌شات کامل (~۴MB) می‌زد؛ نه
     ادغامی در کار بود نه حد نرخ — UI فعال در هر دقیقه چند پول کامل تولید می‌کرد.
     حالا: تک‌پرواز (single-flight) + حداقل فاصلهٔ ۲ ثانیه (خواندن‌های پیاپی روی یک پول سوار
     می‌شوند) + دلتا بر اساس rev هرکلید (مشترک با sync.js در ptf_sync_krevs).
     پاسخ، کش+آینهٔ همهٔ کلیدهای برگشتی را یک‌جا تازه می‌کند؛ در تب مخفی پول زمین می‌ماند. */
  var _pullInflight = false, _pullWaiters = [], _pullLastAt = 0, _pullTimer = null;
  var PULL_MIN_GAP = 2000;
  function bPullRevs() { try { return JSON.parse(localStorage.getItem('ptf_sync_krevs') || '{}'); } catch (e) { return {}; } }
  function bSaveRevsFromMeta(meta, globalRev) {
    try {
      var gr = +globalRev || 0;
      var currentGlobal = parseInt(localStorage.getItem('ptf_sync_rev') || '0', 10) || 0;
      var responseIsCurrentOrNewer = gr >= currentGlobal;
      if (meta) {
        var m = bPullRevs();
        /* A successful pull with a current/newer global revision is authoritative for
           the exact per-key watermarks. The old max-only rule left a client watermark
           above server meta forever (observed: local sharetx=10480, server sharetx=10209)
           and caused future deltas to be skipped. An older response still cannot move a
           watermark backwards. */
        Object.keys(meta).forEach(function (k) {
          if (k === '_global' || !meta[k] || meta[k].rev == null) return;
          var incoming = +meta[k].rev || 0;
          if (responseIsCurrentOrNewer) m[k] = incoming;
          else if (incoming > (+m[k] || 0)) m[k] = incoming;
        });
        localStorage.setItem('ptf_sync_krevs', JSON.stringify(m));
      }
      if (gr > currentGlobal) localStorage.setItem('ptf_sync_rev', String(gr));
    } catch (e) {}
  }
  function bPullSince() { try { return parseInt(localStorage.getItem('ptf_sync_rev') || '0', 10) || 0; } catch (e) { return 0; } }
  function sharedPull(cb) {
    /* sync.js is the single pull coordinator once loaded. Keeping a second independent
       data_pull loop here allowed a stale B response to race the main pull. The fallback
       below remains for isolated legacy harnesses where sync.js is not present. */
    if (typeof window.ptfSyncPullNow === 'function') {
      if (cb) _pullWaiters.push(cb);
      if (_pullInflight) return;
      _pullInflight = true;
      try {
        window.ptfSyncPullNow(function (d) {
          _pullInflight = false;
          _pullLastAt = Date.now();
          var waiters = _pullWaiters; _pullWaiters = [];
          waiters.forEach(function (f) { try { f(d || { ok: true }); } catch (eW) {} });
        });
      } catch (ePull) {
        _pullInflight = false;
        var failedWaiters = _pullWaiters; _pullWaiters = [];
        failedWaiters.forEach(function (f) { try { f({ ok: false, error: 'pull_exception', transportError: String(ePull || '') }); } catch (eW2) {} });
      }
      return;
    }
    if (cb) _pullWaiters.push(cb);
    if (_pullInflight) return;
    /* تب مخفی: پول لازم نیست — منتظرها خالی می‌شوند و در برگشت به فوکوس، خواندن بعدی تازه می‌کند */
    if (typeof document !== 'undefined' && document.hidden) {
      var hs = _pullWaiters; _pullWaiters = [];
      hs.forEach(function (f) { try { f({ ok: false, hidden: true }); } catch (eH) {} });
      return;
    }
    var now = Date.now();
    if (now - _pullLastAt < PULL_MIN_GAP) {
      /* پنجرهٔ ادغام: رکوئست‌های نزدیک روی یک پولِ نزدیکِ آینده سوار می‌شوند */
      if (!_pullTimer) _pullTimer = setTimeout(function () { _pullTimer = null; if (!_pullInflight) sharedPull(); }, PULL_MIN_GAP - (now - _pullLastAt));
      return;
    }
    _pullInflight = true; _pullLastAt = now;
    /* since واقعی → اگر همگام باشیم پاسخ fresh (~۶۰ بایت)؛ وگرنه دلتا بر اساس krevs */
    var pullSince = bPullSince();
    serverPull(pullSince, function (d) {
      _pullInflight = false;
      try {
        if (d && d.ok && d.data) {
          /* حتی فاز B نباید پاسخ v2 ناقص را per-key روی mirror بنویسد؛ sync.js
             validator قرارداد count/bytes/shape را قبل از projection اجرا می‌کند. */
          if (typeof window.ptfSyncValidatePull === 'function') {
            var projectionIntegrity = window.ptfSyncValidatePull(d);
            if (!projectionIntegrity || projectionIntegrity.ok === false) {
              _pullWaiters.splice(0).forEach(function (f) { try { f({ ok: false, reason: 'integrity', detail: projectionIntegrity && projectionIntegrity.reason }); } catch (eIntegrityWaiter) {} });
              return;
            }
          }
          var t = Date.now();
          var knownRevs = bPullRevs();
          var responseGlobal = +((d && d.rev) || 0);
          var currentGlobal = bPullSince();
          var responseIsCurrentOrNewer = responseGlobal >= currentGlobal;
          Object.keys(d.data).forEach(function (k) {
            if (typeof d.data[k] !== 'string') return;
            var incomingRev = +(((d.meta || {})[k] || {}).rev) || 0;
            /* A current/newer global response may legitimately carry a lower per-key
               watermark after metadata repair; do not reject its authoritative value
               merely because a command had stamped the global rev into this key. */
            if (incomingRev && (+knownRevs[k] || 0) > incomingRev && !responseIsCurrentOrNewer) return;
            var v = d.data[k];
            if ((k === 'ptf_crm_sharetx' || k === 'ptf_crm_shareholders') && typeof window.ptfSyncMergeServerProjection === 'function') {
              var currentProjection = null;
              try { if (typeof window.ptfBRead === 'function') currentProjection = window.ptfBRead(k); } catch (eProjectionMirror) {}
              if (currentProjection === null || currentProjection === undefined) currentProjection = localGet(k);
              v = window.ptfSyncMergeServerProjection(k, currentProjection, v);
            }
            /* v34.8.8: نقشه‌های نسخه‌دار (آواتار/پروفایل امضا) در پول فاز B هم
               merge می‌شوند؛ overwrite خام، مقدار محلی {v,ts} را می‌پراند و چرخهٔ
               dirty/overwrite می‌سازد. همان قرارداد ptfSmartMerge کلاینت. */
            if (k === 'ptf_crm_avatars' || k === 'ptf_crm_sigprofiles') {
              try {
                var curMap = null;
                try { if (typeof window.ptfBRead === 'function') curMap = window.ptfBRead(k); } catch (eMapMirror) {}
                if (curMap === null || curMap === undefined) curMap = localGet(k);
                if (curMap && typeof window.ptfSmartMerge === 'function') v = window.ptfSmartMerge(k, curMap, v);
              } catch (eMapMerge) {}
            }
            cache[k] = { t: t, v: v, rev: incomingRev };
            if (!(window.ptfBMirror && window.ptfBMirror(k, v))) localSet(k, v);
          });
        }
        if (d && d.ok) bSaveRevsFromMeta(d.meta, d.rev);
      } catch (eP) {}
      var ws = _pullWaiters; _pullWaiters = [];
      ws.forEach(function (f) { try { f(d); } catch (eW) {} });
    }, bPullRevs());
  }
  /* v33.19.0: تشخیص نشست منقضی/توکن نامعتبر (data_push توکن الزامی دارد؛ تست اتصال از users_get عمومی است و همیشه سبز می‌ماند)
     v34.8.6 (AUTH-TOKEN-RACE): تشخیص قبلیِ «هر خطای حاوی کلمهٔ token» نشست سالم را
     پاک می‌کرد (مثل token_issue_failed). فقط نشانه‌های قطعی auth را بپذیر. */
  function isNeedLogin(d, status) {
    if (status === 401) return true;
    if (!d) return false;
    if (d.needLogin === true) return true;
    var e = String(d.error || '');
    return e === 'authentication_required' || e === 'Authentication required' || /^invalid or expired token/i.test(e);
  }
  function serverPush(payload, cb, attempt, base) {
    attempt = attempt || 0;
    var body = {
      by: (function () { try { return (curSession() || {}).name || ''; } catch (e) { return ''; } }()),
      data: payload,
      /* Phase B used to omit base entirely, so its whole-array payload could bypass
         the server's stale-writer conflict path. Every batch now carries the same
         per-key baseline used by sync.js. */
      base: base || bPullRevs()
    };
    var controller = null, timeout = null;
    try { if (typeof AbortController === 'function') controller = new AbortController(); } catch (eAbort) {}
    if (controller) timeout = setTimeout(function () { try { controller.abort(); } catch (eAbortTimer) {} }, 20000);
    var fetchOptions = {
      method: 'POST', headers: authHeaders(true), body: JSON.stringify(body)
    };
    if (controller) fetchOptions.signal = controller.signal;
    fetch(API + '?action=data_push', fetchOptions)
      .then(function (r) {
        var st = (r && r.status) || 0;
        return r.json().then(function (d) { return { d: d, st: st }; }, function () { return { d: { ok: false, error: 'HTTP ' + st }, st: st }; });
      })
      .then(function (res) {
        if (timeout) clearTimeout(timeout);
        var d = res.d;
        /* v33.19.0: needLogin/401 → بازسازی نشست + یک بار تلاش مجدد. */
        if (isNeedLogin(d, res.st)) {
          d.needLogin = true;
          if (attempt === 0 && typeof window.ptfSyncRefreshAuth === 'function') {
            window.ptfSyncRefreshAuth(function (ok) {
              if (ok) { serverPush(payload, cb, 1, base); return; }
              cb && cb(d);
            });
            return;
          }
        }
        cb && cb(d);
      })
      .catch(function (error) {
        if (timeout) clearTimeout(timeout);
        cb && cb({ ok: false, error: error && error.name === 'AbortError' ? 'timeout' : 'network', transportError: String(error || '') });
      });
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
  /* Read the durable Phase-B mirror without ever calling getData (which can schedule
     a pull). The synchronous path covers normal localStorage keys; the asynchronous
     fallback covers heavy keys migrated to the IDB mirror. */
  function bReadValueSync(k) {
    try {
      if (typeof window.ptfBRead === 'function') {
        var mirrored = window.ptfBRead(k);
        if (mirrored !== null) return String(mirrored);
      }
    } catch (eMirror) {}
    return localGet(k);
  }
  function bReadValue(k, cb) {
    var sync = bReadValueSync(k);
    if (sync !== null) { cb && cb(sync, 'local'); return; }
    var ids = ['bdata:' + k, k], index = 0;
    function next() {
      if (index >= ids.length || typeof window.ptfStorageIdbGet !== 'function') { cb && cb(null, 'missing'); return; }
      var id = ids[index++], finished = false;
      function done(value) {
        if (finished) return;
        finished = true;
        if (value !== null && value !== undefined) {
          idbKnown[k] = 1;
          idbMem[k] = String(value);
          cb && cb(String(value), 'idb');
          return;
        }
        next();
      }
      try {
        window.ptfStorageIdbGet(id, function (row) { done(row && row.value != null ? row.value : null); });
        setTimeout(function () { done(null); }, 1500);
      } catch (eIdb) { done(null); }
    }
    next();
  }

  /* ---------- صف آفلاین ---------- */
  var flushRescueRound = 0; /* v34.8.7: سقف نوبت‌های نجات تعارض فاز B در هر چرخه */
  function queueKey() { return 'ptf_b_queue'; }
  /* ---------- v34.8.23 (T3-3 / OFFLINE-OUTBOX-IDB): صف آفلاین روی IndexedDB ----------
     ROADMAP-THIN-CLIENT T3-3 (تأیید کارفرما): صف، write-ahead record حیاتی است و
     نباید در همان localStorage‌ای باشد که ممکن است ۱۰۰٪ پر باشد (ریشهٔ حادثهٔ
     «ثبت کاربر در دقیقهٔ پر بودن شکست خورد»). نگهداری: حافظهٔ نشست (همگام) +
     IDB (پایدار) + LS فقط به‌عنوان seed اولیه. سقف: ۵۰۰ رکورد/۷۲ ساعت (S7). */
  var idbQueueMem = null;          /* کش نشست صف — منبع زنده */
  var idbQueueLoaded = false;      /* seed از LS/IDB انجام شد */
  function qCapCheck(q) {
    /* سقف S7: بیش از ۵۰۰ کلید معلق = وضعیت اضطراری آفلاین طولانی؛ قدیمی‌ترین‌ها حذف */
    var keys = Object.keys(q);
    if (keys.length > 500) {
      keys.slice(0, keys.length - 500).forEach(function (k) { delete q[k]; });
    }
    return q;
  }
  function queueRead() {
    if (idbQueueLoaded && idbQueueMem !== null) return idbQueueMem;
    /* seed یک‌باره از LS (نسخهٔ قدیمی) — بعد از این، LS دیگر مرجع نیست */
    try {
      idbQueueMem = JSON.parse(localStorage.getItem(queueKey()) || '{}');
      if (idbQueueMem === null || typeof idbQueueMem !== 'object') idbQueueMem = {};
      idbQueueMem = qCapCheck(idbQueueMem);
      idbQueueLoaded = true;
      try { window.ptfStorageIdbSet('q:' + queueKey(), JSON.stringify(idbQueueMem), function () {}); } catch (eI) {}
      try { localStorage.removeItem(queueKey()); } catch (eR) {}
      return idbQueueMem;
    } catch (e) { idbQueueMem = {}; idbQueueLoaded = true; return idbQueueMem; }
  }
  function queueWrite(q) {
    qCapCheck(q);
    idbQueueMem = q;
    try { window.ptfStorageIdbSet('q:' + queueKey(), JSON.stringify(q), function () {}); } catch (eI) { return false; }
    return true;
  }
  function queueAdd(k) {
    var q = queueRead(); q[k] = (q[k] || 0) + 1;
    /* صف آفلاین، write-ahead record است. اگر پایدار نشود نباید caller تصور کند
       داده قابل بازیابی است؛ خطا به setData برمی‌گردد. */
    if (!queueWrite(q)) return false;
    return true;
  }
  /* آب‌رسانی نشست از IDB در بوت — قبل از اولین flush */
  window.ptfBQueueIdbPreload = function (cb) {
    try {
      window.ptfStorageIdbGet('q:' + queueKey(), function (row) {
        try {
          if (row && row.value && !idbQueueLoaded) {
            try { idbQueueMem = qCapCheck(JSON.parse(row.value) || {}); } catch (eP) { idbQueueMem = {}; }
            idbQueueLoaded = true;
          } else if (!idbQueueLoaded) {
            queueRead(); /* seed از LS + انتقال به IDB */
          }
        } catch (e1) {}
        if (typeof cb === 'function') cb();
      });
    } catch (e2) { if (typeof cb === 'function') cb(); }
  };
  /* Bridge for the single pending registry in sync.js. This also reconstructs a
     missing Phase-B queue entry from persisted dirty state after a refresh, without
     copying or rewriting the business payload. */
  window.ptfBEnqueueKeys = function (keys) {
    var q = queueRead();
    (Array.isArray(keys) ? keys : [keys]).forEach(function (k) {
      if (!k || bKeys().indexOf(k) < 0) return;
      if (!q[k]) q[k] = 1;
    });
    return queueWrite(q);
  };
  window.ptfBPendingKeys = function () { return Object.keys(queueRead()); };
  function queueClear(keys) {
    var q = queueRead(); (keys || []).forEach(function (k) { delete q[k]; }); return queueWrite(q);
  }

  /* ---------- v33.19.0: ارسال دسته‌ای (هر بار حداکثر ۲۰ کلید) ----------
     ریشهٔ باگ: روی دستگاه‌های پرحافظه، ارسال همهٔ کلیدها یک‌جا → payload چند مگابایتی
     → رد/تایم‌اوت سرور؛ درحالی‌که تست اتصال (users_get عمومی) سبز می‌ماند.
     شکست یک دسته → فقط همان دسته ناموفق است؛ needLogin → توقف کامل (ادامه بی‌فایده است). */
  var BATCH_SIZE = 20;
  window.ptfBPushBatch = function (payload, cb, options) {
    options = options || {};
    var keys = Object.keys(payload || {}).filter(function (k) {
      try { return !(typeof window.ptfSyncCommandKeyHeld === 'function' && window.ptfSyncCommandKeyHeld(k)); } catch (e) { return true; }
    });
    var blocked = Object.keys(payload || {}).filter(function (k) { return keys.indexOf(k) < 0; });
    if (!keys.length) { cb && cb({ ok: !blocked.length, pushed: 0, total: Object.keys(payload || {}).length, failed: blocked, blocked: blocked, protectedConflicts: [] }); return; }
    var batches = [];
    for (var i = 0; i < keys.length; i += BATCH_SIZE) batches.push(keys.slice(i, i + BATCH_SIZE));
    /* Capture one baseline for the entire batch sequence; reading krevs again between
       chunks could make later chunks compare against a revision committed by chunk 1. */
    var batchBase = options.base || bPullRevs();
    var savedKeys = [], failed = blocked.slice(), rejected = [], skipped = [], forbidden = [], conflicts = [], lastError = '';
    var lastRev = 0; /* v34.36.1: rev سراسری سرور از پاسخ push — برای ثبت دقیق watermark پس از ACK */
    /* v34.36.1 (PROTECTED-RESCUE-REACHABLE — RCA بن‌بست ptf_crm_opex، ۲۰۲۶-۰۹-۰۴):
       سرور برای کلیدهای مالی محافظت‌شده هم conflicts و هم protectedConflicts را
       می‌فرستد (api/crm.php:2152,2237) ولی این تابع هرگز protectedConflicts را
       نمی‌خواند؛ در نتیجه در ptfBFlushQueue عبارت (result.protectedConflicts || [])
       همیشه [] بود و شاخهٔ نجاتِ محافظت‌شدهٔ v34.8.10 (کد مرده) هرگز اجرا نشد —
       opex همیشه به merge عمومیِ «محلی-برتر» می‌افتاد و هر push دوباره conflict
       می‌داد (حلقهٔ بی‌پایان + قفل شدن «انتقال یک‌باره»). حالا عیناً مثل conflicts
       تجمع و منتقل می‌شود. */
    var protectedConflicts = [];
    var serverDataAgg = {}, krevsAgg = {}; /* v34.8.7: برای نجات تعارض در flush */
    function addUnique(target, values) {
      (Array.isArray(values) ? values : []).forEach(function (k) { if (target.indexOf(k) < 0) target.push(k); });
    }
    function finish() {
      cb && cb({
        ok: !failed.length && !rejected.length && !skipped.length && !forbidden.length && !conflicts.length,
        pushed: savedKeys.length,
        total: Object.keys(payload || {}).length,
        savedKeys: savedKeys,
        failed: failed,
        rejected: rejected,
        skipped: skipped,
        forbidden: forbidden,
        conflicts: conflicts,
        protectedConflicts: protectedConflicts, /* v34.36.1 */
        serverData: serverDataAgg,
        krevs: krevsAgg,
        rev: lastRev, /* v34.36.1 */
        blocked: blocked,
        error: lastError
      });
    }
    function step(idx) {
      if (idx >= batches.length) { finish(); return; }
      var batchKeys = batches[idx], sub = {};
      batchKeys.forEach(function (k) { sub[k] = payload[k]; });
      /* Pass the stable per-key baseline for the whole batch. */
      serverPush(sub, function (d) {
        if (d && d.needLogin) {
          for (var j = idx; j < batches.length; j++) addUnique(failed, batches[j]);
          lastError = 'needLogin';
          cb && cb({ ok: false, pushed: savedKeys.length, total: Object.keys(payload || {}).length, savedKeys: savedKeys, failed: failed, rejected: rejected, skipped: skipped, forbidden: forbidden, conflicts: conflicts, protectedConflicts: protectedConflicts, error: lastError, needLogin: true });
          return;
        }
        if (!d || !d.ok) {
          addUnique(failed, batchKeys);
          lastError = (d && d.error) || 'network';
          step(idx + 1);
          return;
        }
        /* d.ok means request processing completed, not that every key was stored.
           A missing savedKeys list is treated as an ambiguous/failed ACK. */
        if (!Array.isArray(d.savedKeys)) {
          addUnique(failed, batchKeys);
          lastError = 'missing_saved_keys';
          step(idx + 1);
          return;
        }
        var dRejected = Array.isArray(d.rejected) ? d.rejected : [];
        var dSkipped = Array.isArray(d.skipped) ? d.skipped : [];
        var dForbidden = Array.isArray(d.forbidden) ? d.forbidden : [];
        var dConflicts = Array.isArray(d.conflicts) ? d.conflicts : [];
        var dProtected = Array.isArray(d.protectedConflicts) ? d.protectedConflicts : []; /* v34.36.1 */
        addUnique(rejected, dRejected);
        addUnique(skipped, dSkipped);
        addUnique(forbidden, dForbidden);
        addUnique(conflicts, dConflicts);
        addUnique(protectedConflicts, dProtected); /* v34.36.1 */
        /* v34.8.7: پاسخ هر دسته serverData/krevs تعارض‌ها را هم با خودش بیاورد. */
        if (d.serverData && typeof d.serverData === 'object') Object.keys(d.serverData).forEach(function (k) { serverDataAgg[k] = d.serverData[k]; });
        if (d.krevs && typeof d.krevs === 'object') Object.keys(d.krevs).forEach(function (k) { krevsAgg[k] = d.krevs[k]; });
        if (+d.rev > lastRev) lastRev = +d.rev; /* v34.36.1 */
        /* A malformed response that lists a key both saved and rejected must fail
           closed; only the intersection-free savedKeys are eligible for queue clear. */
        addUnique(savedKeys, d.savedKeys.filter(function (k) {
          return batchKeys.indexOf(k) >= 0 &&
            dRejected.indexOf(k) < 0 && dSkipped.indexOf(k) < 0 &&
            dForbidden.indexOf(k) < 0 && dConflicts.indexOf(k) < 0 &&
            dProtected.indexOf(k) < 0; /* v34.36.1: fail-closed روی کلید مالی محافظت‌شده */
        }));
        batchKeys.forEach(function (k) {
          if (savedKeys.indexOf(k) >= 0 || rejected.indexOf(k) >= 0 || skipped.indexOf(k) >= 0 || forbidden.indexOf(k) >= 0 || conflicts.indexOf(k) >= 0) return;
          failed.push(k);
        });
        if (d.error) lastError = d.error;
        step(idx + 1);
      }, 0, batchBase);
    }
    step(0);
  };

  function bSamePayload(a, b) {
    if (a === b) return true;
    try {
      function normalize(value) {
        if (!value || typeof value !== 'object') return value;
        if (Array.isArray(value)) return value.map(normalize);
        var out = {};
        Object.keys(value).sort().forEach(function (key) { out[key] = normalize(value[key]); });
        return out;
      }
      return JSON.stringify(normalize(JSON.parse(a))) === JSON.stringify(normalize(JSON.parse(b)));
    } catch (e) { return false; }
  }
  function queueClearMatching(keys, submitted) {
    var q = queueRead(), kept = [];
    (keys || []).forEach(function (k) {
      /* A newer write after the request began must keep its queue entry. */
      var current = bReadValueSync(k);
      if (submitted && Object.prototype.hasOwnProperty.call(submitted, k) && !bSamePayload(current, submitted[k])) kept.push(k);
      else delete q[k];
    });
    var ok = queueWrite(q);
    return { ok: ok, kept: kept };
  }

  function readQueuePayload(keys, cb) {
    var payload = {}, missing = [], left = (keys || []).length;
    if (!left) { cb && cb(payload, missing); return; }
    (keys || []).forEach(function (k) {
      bReadValue(k, function (value) {
        if (value === null || value === undefined) missing.push(k);
        else payload[k] = value;
        left--;
        if (!left) cb && cb(payload, missing);
      });
    });
  }

  /* ---------- flush صف به سرور ---------- */
  window.ptfBFlushQueue = function (cb) {
    var q = queueRead();
    var allKeys = Object.keys(q);
    var keys = allKeys.filter(function (k) {
      try { return !(typeof window.ptfSyncCommandKeyHeld === 'function' && window.ptfSyncCommandKeyHeld(k)); } catch (e) { return true; }
    });
    var blocked = allKeys.filter(function (k) { return keys.indexOf(k) < 0; });
    if (!keys.length) {
      try { if (blocked.length && typeof window.ptfSyncMarkPendingKeys === 'function') window.ptfSyncMarkPendingKeys(blocked); } catch (eBlocked) {}
      cb && cb({ ok: !blocked.length, pushed: 0, blocked: blocked });
      return;
    }
    function pushPayloadAndFinish(payload) {
      window.ptfBPushBatch(payload, function (d) {
        var saved = (d && d.savedKeys) || [];
        var clear = saved.length ? queueClearMatching(saved, payload) : { ok: true, kept: [] };
        var kept = clear.kept || [];
        var failed = (d && d.failed || []).slice();
        if (!clear.ok) {
          saved.forEach(function (k) { if (failed.indexOf(k) < 0) failed.push(k); });
        }
        var acked = saved.filter(function (k) { return kept.indexOf(k) < 0 && failed.indexOf(k) < 0; });
        try { if (acked.length && typeof window.ptfSyncAcknowledgeKeys === 'function') window.ptfSyncAcknowledgeKeys(acked, payload); } catch (eAck) {}
        var result = Object.assign({}, d || {}, { ok: !!(d && d.ok && clear.ok && !failed.length && !blocked.length && !kept.length), pushed: acked.length, failed: failed, blocked: blocked, pending: kept });
        if (!clear.ok && !result.error) result.error = 'queue_persist_failed';
        /* v34.36.1 (WATERMARK-ACK — R3): پاسخ push موفق، watermark هر کلید را جلو
           می‌بَرد (پیش از این فقط شاخهٔ نجات تعارض این کار را می‌کرد ⇒ کلیدِ
           ACK‌شده در push بعدی با base کهنه conflict می‌شد). */
        bAdvanceWatermarksFromPush(result.krevs, result.rev, saved);
        /* v34.8.36 (FORBIDDEN-DROP — RCA نوار زرد پایدار personal_cheques، 2026-08-28):
           قرارداد مسیر legacy — کلیدی که سرور صراحتاً «خارج از allowlist نقش» اعلام
           کرد نباید در صف IDB و dirty ابدی بماند (هر flush دوباره forbidden می‌داد و
           نوار زرد هرگز سبز نمی‌شد). از صف حذف، dirty پاک، نشانگر 🟠 forbidden.
           rejected/conflicts/skipped قابل‌تلاش‌اند و مثل قبل pending می‌مانند. */
        var forbiddenKeys = (result.forbidden || []).slice();
        if (forbiddenKeys.length) {
          try { queueClear(forbiddenKeys); } catch (eQForbidden) {}
          try { if (typeof window.ptfSyncDropForbiddenKeys === 'function') window.ptfSyncDropForbiddenKeys(forbiddenKeys); } catch (eDropForbidden) {}
        }
        var pending = failed.concat(result.rejected || [], result.skipped || [], result.conflicts || [], blocked, kept);
        try { if (pending.length && typeof window.ptfSyncMarkPendingKeys === 'function') window.ptfSyncMarkPendingKeys(pending); } catch (ePending) {}
        /* v34.8.7 (SHARED-KEY-CONVERGENCE): تعارض در مسیر فاز B دیگر بن‌بست نیست.
           مقدار سرورِ کلیدهای conflicted (غیر مالیِ محافظت‌شده) merge محلی می‌شود،
           watermark کلید از krevs پاسخ تازه می‌شود و یک flush مجدد (حداکثر ۳ نوبت)
           همان کلید را با base درست می‌فرستد. */
        try {
          var conflKeys = (result.conflicts || []).slice();
          if (conflKeys.length && (result.serverData || result.krevs)) {
            /* v34.36.1: منطق نجات به rescueConflictedKeys منتقل شد تا مسیر
               «انتقال یک‌باره» هم همان درمان را داشته باشد (پیش از این فقط اینجا بود
               و برای کلید مالی محافظت‌شده عملاً مرده — protectedConflicts نمی‌رسید). */
            var rescuedKeys = rescueConflictedKeys(result, payload);
            if (rescuedKeys.length && (flushRescueRound || 0) < 3) {
              flushRescueRound = (flushRescueRound || 0) + 1;
              setTimeout(function () { try { window.ptfBFlushQueue(function () {}); } catch (eRetry) {} }, 900);
            }
          } else if (!conflKeys.length) {
            flushRescueRound = 0;
          }
        } catch (eRescue) {}
        cb && cb(result);
      });
    }
    readQueuePayload(keys, function (payload, missing) {
      if (missing.length) {
        /* v34.8.8 (PHANTOM-QUEUE-ENTRY): ردیف صفی که مقدار محلی‌اش در هیچ لایه‌ای
           (آینهٔ IDB/localStorage) موجود نیست، phantom است — push آن همیشه
           local_payload_missing می‌شود و dirty را ابدی نگه می‌دارد (گزارش:
           ptf_crm_avatars). یک بازخوانی مجدد؛ اگر باز هم نبود، ردیف صف و dirtyِ
           همان کلیدها پاک می‌شود و pull بعدی مقدار معتبر سرور را برمی‌گرداند. */
        readQueuePayload(missing, function (payload2, missing2) {
          (missing2 || []).slice().forEach(function (k) {
            queueClear([k]);
            try { if (typeof window.ptfSyncAcknowledgeKeys === 'function') window.ptfSyncAcknowledgeKeys([k], null); } catch (ePhantom) {}
            try { if (typeof audit === 'function') audit('سیستم', '🧹 ردیف صفِ بدون مقدار محلی پاک شد: ' + k + ' — مقدار معتبر از سرور در pull بعدی می‌آید', 'SYNC'); } catch (eAuditPhantom) {}
            missing.splice(missing.indexOf(k), 1);
          });
          var remaining = Object.keys(payload || {});
          if (!remaining.length) { cb && cb({ ok: !blocked.length, pushed: 0, pruned: (missing2 || []).slice(), blocked: blocked }); return; }
          pushPayloadAndFinish(payload);
        });
        return;
      }
      pushPayloadAndFinish(payload);
    });
  };

  /* ---------- v34.36.1 (MIGRATION-CONVERGENCE) — کمکی‌های مشترکِ صف و مهاجرت ----------
     RCA بن‌بست «۴۸ از ۴۹ کلید» (۲۰۲۶-۰۹-۰۴): مسیر «انتقال یک‌باره» یک تیرِ
     همه-یا-هیچ بود، پاسخ سرور (serverData/krevs/protectedConflicts) را دور می‌ریخت،
     هیچ تلاش مجددی نداشت و نشانگرها را پیش از ارسال پاک می‌کرد. این سه تابع منطق
     همگرایی را بین صف (ptfBFlushQueue) و مهاجرت (ptfBFinalize) مشترک می‌کنند. */
  function bAdvanceWatermarksFromPush(krevsPlain, globalRev, ackedKeys) {
    /* WATERMARK-ACK (R3): کلیدی که همین لحظه ACK شده باید watermark‌اش جلو برود؛
       وگرنه push بعدی با base کهنه می‌رود و سرور دوباره conflict می‌دهد. مسیر legacy
       همین کار را با applyKrevs(d.krevs) می‌کند (sync.js).
       ackedKeys (اختیاری) = فهرست سفیدِ کلیدهایی که سرور واقعاً ذخیره کرد. سرور برای
       کلیدِ «در تعارض/رد شده» هم krevs می‌فرستد؛ اگر watermark آن‌ها جلو برود، push
       بعدی با base برابرِ سرور می‌رود ⇒ دیگر conflict نمی‌دهد ⇒ کپی محلیِ همگرانشده
       نسخهٔ معتبر سرور را **کورکورانه بازنویسی** می‌کند (از دست رفتن ردیف). پس فقط
       کلیدهای ACK‌شده جلو می‌روند؛ بقیه کهنه می‌مانند تا pull نسخهٔ سرور را بیاورد. */
    try {
      var kr = krevsPlain || {}, meta = {};
      var onlyAcked = Array.isArray(ackedKeys);
      Object.keys(kr).forEach(function (k) {
        if (!(+kr[k] > 0)) return;
        if (onlyAcked && ackedKeys.indexOf(k) < 0) return;
        /* کلیدهای مشترکِ union (audit/avatars/notifs) عمداً جلو نمی‌روند: مقدار
           ذخیره‌شدهٔ سرور unionِ چند دستگاه است نه عینِ payload ما، و pull بعدی باید
           آن نسخهٔ کامل‌تر را بیاورد (پیش‌رفتن watermark = گم شدن ردیف سایر دستگاه‌ها). */
        try { if (typeof window.ptfSyncIsSharedUnionKey === 'function' && window.ptfSyncIsSharedUnionKey(k)) return; } catch (eUnion) {}
        meta[k] = { rev: +kr[k] };
      });
      if (Object.keys(meta).length) bSaveRevsFromMeta(meta, globalRev);
    } catch (eAdvance) {}
  }
  function rescueConflictedKeys(result, payload) {
    /* درمان تعارض با نسخهٔ معتبر سرور؛ فهرست کلیدهای نجات‌یافته را برمی‌گرداند. */
    var rescued = [];
    try {
      var conflKeys = ((result && result.conflicts) || []).slice();
      var protectedKeys = ((result && result.protectedConflicts) || []).slice();
      if (!conflKeys.length || !((result && result.serverData) || (result && result.krevs))) return rescued;
      conflKeys.forEach(function (k) {
        var srvStr = (result.serverData || {})[k];
        if (typeof srvStr !== 'string') return;
        /* کلید مالی محافظت‌شده → merge محافظت‌شده (VERBATIM-CONVERGENCE: کپی محلی
           عیناً نسخهٔ سرور می‌شود تا امضای snapshot در push بعدی مطابقت کند)؛
           کلید عادی → merge هوشمند عمومی. تا v34.36.1 شاخهٔ محافظت‌شده در فاز B
           کدِ مرده بود چون protectedConflicts هرگز از ptfBPushBatch عبور نمی‌کرد. */
        if (protectedKeys.indexOf(k) >= 0) {
          if (typeof window.ptfSyncResolveProtectedConflictFromServer === 'function' && window.ptfSyncResolveProtectedConflictFromServer(k, srvStr, (payload || {})[k])) rescued.push(k);
        } else if (typeof window.ptfSyncResolveConflictFromServer === 'function' && window.ptfSyncResolveConflictFromServer(k, srvStr)) rescued.push(k);
      });
      if (rescued.length) {
        var metaLike = {}, krMap = (result && result.krevs) || {};
        rescued.forEach(function (k) { if (+krMap[k]) metaLike[k] = { rev: +krMap[k] }; });
        bSaveRevsFromMeta(metaLike, result && result.rev);
      }
    } catch (eRescueKeys) {}
    return rescued;
  }
  /* «ردِ بی‌ضرر»: کپی محلیِ کلید آرایهٔ خالی است و سرور به‌خاطر سپر ضد داده‌صفر
     آن را رد کرده. روی این دستگاه چیزی نیست که از دست برود و pull بعدی همان کلید
     را از سرور پر می‌کند ⇒ مانعِ پایان انتقال نیست. هر مقدار ناخالی همچنان
     fail-closed می‌ماند (هرگز بی‌صدا رها نمی‌شود). */
  function isEmptyArrayPayload(str) {
    try { var v = JSON.parse(str); return Array.isArray(v) && v.length === 0; } catch (e) { return false; }
  }

  /* ---------- هم‌گرایی یک‌باره (تأیید کاربر) ---------- */
  function flushRequired() {
    try {
      /* v34.8.6/F0-1: old builds marked flushed before the request. Require the
         separate successful-convergence marker too, so a pre-ACK crash cannot make
         the one-time migration permanently look complete. */
      return localStorage.getItem(flushKey()) !== '1' || localStorage.getItem(syncedKey()) !== '1';
    } catch (e) { return true; }
  }
  function markFlushed() { try { localStorage.setItem(flushKey(), '1'); } catch (e) {} }
  var MIGRATION_ROUNDS = 3;
  function shortKeyName(k) { return String(k || '').replace('ptf_crm_', ''); }
  var MIGRATION_CLASSES = [
    ['conflicts', 'تعارض داده با نسخهٔ سرور'],
    ['forbidden', 'خارج از allowlist نقش فعلی'],
    ['rejected', 'رد شده توسط سپر داده/یکپارچگی'],
    ['skipped', 'بزرگ‌تر از سقف ۸MB یا payload نامعتبر'],
    ['failed', 'شکست ارسال/تایم‌اوت'],
    ['blocked', 'در انتظار پایان فرمان دامنه']
  ];
  /* کلاسِ هر کلید از همهٔ نوبت‌ها انباشته می‌شود: نوبتِ آخر ممکن است کلیدی را که در
     نوبتِ اول forbidden شده دیگر ارسال نکند، ولی کاربر باید همان کلید را ببیند. */
  function noteMigrationClasses(d, seen) {
    MIGRATION_CLASSES.forEach(function (pair) {
      ((d && d[pair[0]]) || []).forEach(function (k) { if (seen[k] === undefined) seen[k] = pair[0]; });
    });
  }
  function migrationBlockers(seen, unresolved) {
    var out = [];
    MIGRATION_CLASSES.forEach(function (pair) {
      var keys = unresolved.filter(function (k) { return seen[k] === pair[0]; });
      if (keys.length) out.push({ cls: pair[0], label: pair[1], keys: keys });
    });
    return out;
  }

  window.ptfBFinalize = function (opts) {
    opts = opts || {};
    /* هم‌گرایی یک‌باره: دادهٔ محلی → سرور. در حالت خودکار فقط دستگاه تازه
       (بدون payload کسب‌وکاری) مجاز است؛ دادهٔ موجود هرگز بدون تأیید overwrite نمی‌شود. */
    /* v34.36.1 (F1): opts.force = «اجرای دوبارهٔ مهاجرت» بدون پاک‌کردن نشانگرها. */
    if (!opts.force && !flushRequired()) {
      window.ptfBFlushQueue(function () {});
      return;
    }
    /* Keep the automatic path explicitly fail-closed before any asynchronous IDB
       read. Existing local business data always requires a human-reviewed merge. */
    if (opts.auto && hasLocalBusinessPayload()) return { ok: false, reason: 'local_data_requires_review' };
    var keys = bKeys();
    /* Include the IDB mirror in the convergence payload. Missing keys are ordinary
       absent keys; only the values that exist locally are sent. */
    readQueuePayload(keys, function (payload) {
      if (!Object.keys(payload).length) {
        markFlushed();
        markSynced();
        /* v34.8.9: مسیر خالی هم (دستگاه بدون دادهٔ محلی) فاز B را فعال می‌کند. */
        try { window.ptfBEnableAfterConvergence(); } catch (eEnableEmpty) {}
        window.ptfBFlushQueue(function () {});
        return;
      }
      if (opts.auto) {
        /* Never push an existing local payload in auto-mode. */
        return { ok: false, reason: 'local_data_requires_review' };
      }
      var ok = confirm('🌐 هم‌گرایی داده با سرور\n\nدادهٔ محلی مرورگر شما یک‌بار به سرور منتقل می‌شود تا با دیتابیس یکپارچه شود (localStorage پس از آن فقط کش می‌شود).\n\nادامه می‌دهید؟');
      if (!ok) { alert('می‌توانید بعداً از «تنظیمات ← بک‌آپ و بازگردانی ← وضعیت دستگاه» این کار را انجام دهید.'); return; }
      /* v34.36.1 (P0-1): معیارِ پایان = تأییدِ تک‌تک کلیدها روی سرور، با همان
         موتور نجات/تلاش‌مجددِ صف. «flushed» فقط پس از ACK کامل ثبت می‌شود. */
      convergeMigration(payload, { acked: {}, submitted: {}, seen: {} }, 0);
    });
  };

  /* یک نوبت همگرایی. acked/submitted بین نوبت‌ها انباشته می‌شود تا کلیدهای
     تأییدشده هرگز دوباره ارسال نشوند و گزارش نهایی دقیق باشد. */
  function convergeMigration(payload, st, round) {
    var acked = st.acked, submitted = st.submitted, seen = st.seen;
    Object.keys(payload || {}).forEach(function (k) { submitted[k] = payload[k]; });
    window.ptfBPushBatch(payload, function (d) {
      d = d || {};
      var ackedList = ((d.savedKeys) || []).slice();
      /* R3: watermark فقط کلیدهای واقعاً ACK‌شده را از همین پاسخ جلو ببر. */
      bAdvanceWatermarksFromPush(d.krevs, d.rev, ackedList);
      var benignRejected = ((d.rejected) || []).filter(function (k) { return isEmptyArrayPayload((payload || {})[k]); });
      ackedList.concat(benignRejected).forEach(function (k) { if (acked[k] === undefined) acked[k] = 1; });
      /* P0-1: همان درمان تعارضِ صف — نسخهٔ معتبر سرور را محلی کن تا نوبت بعد مطابقت کند. */
      var rescued = rescueConflictedKeys(d, payload);
      noteMigrationClasses(d, seen);
      /* معیارِ پایان، مجموعهٔ تجمعیِ همهٔ کلیدهایی است که یک‌بار ارسال شدند — نه فقط
         کلیدهای نوبتِ آخر. کلیدی که سرور آن را forbidden/skipped اعلام کرده از payload
         نوبت‌های بعد بیرون می‌رود ولی هرگز «همگراشده» حساب نمی‌شود: تنها کپیِ محلیِ
         آن هنوز روی سرور نیست و «پاک‌سازی کش محلی» نباید مجاز شود (fail-closed). */
      var unresolved = Object.keys(submitted).filter(function (k) { return acked[k] === undefined; });
      var unresolvedRound = Object.keys(payload || {}).filter(function (k) { return acked[k] === undefined; });
      /* کلیدهای تأییدشده: dirty پاک + صف آفلاین تمیز (نسل تازه‌ترِ نوشته‌شده حفظ می‌شود). */
      try { if (ackedList.length && typeof window.ptfSyncAcknowledgeKeys === 'function') window.ptfSyncAcknowledgeKeys(ackedList, payload); } catch (eAckMig) {}
      try { if (ackedList.length) queueClearMatching(ackedList, payload); } catch (eQClearMig) {}
      try {
        if (benignRejected.length) {
          queueClear(benignRejected);
          if (typeof window.ptfSyncAcknowledgeKeys === 'function') window.ptfSyncAcknowledgeKeys(benignRejected, null);
        }
      } catch (eBenign) {}

      if (d.needLogin) {
        try { if (typeof window.ptfSyncNoteError === 'function') window.ptfSyncNoteError('migration', 'needLogin', 'نشست منقضی — انتقال یک‌باره متوقف شد', 'needLogin:' + unresolved.join('|')); } catch (eNoteLogin) {}
        alert('⚠️ نشست شما منقضی شده است؛ دوباره وارد شوید، سپس «تکمیل انتقال یک‌باره» را از «تنظیمات ← بک‌آپ و بازگردانی ← وضعیت دستگاه» بزنید. دادهٔ محلی شما محفوظ است.');
        return;
      }
      if (!unresolved.length) {
        markFlushed();
        markSynced();
        /* v34.8.9 (STORAGE-INDEPENDENCE): موفقیت همگرایی = پایان وابستگی به
           localStorage: فاز B خودکار فعال و کلیدهای حجیم به IndexedDB تخلیه می‌شوند. */
        try { window.ptfBEnableAfterConvergence(); } catch (eEnable) {}
        try {
          if (typeof audit === 'function') audit('سیستم', '✅ انتقال یک‌باره کامل شد — ' + Object.keys(acked).length + ' کلید روی سرور تأیید شد' +
            (benignRejected.length ? ' (' + benignRejected.map(shortKeyName).join('، ') + ' با کپی محلی خالی از سرور بازخوانی می‌شود)' : ''), 'SYNC');
        } catch (eAuditOk) {}
        alert('✅ هم‌گرایی انجام شد.\nحالت سرور-محور هم خودکار فعال شد: دادهٔ حجیم به IndexedDB منتقل و localStorage از این پس فقط کش سبک است.');
        location.reload();
        return;
      }
      /* نوبت بعد فقط با کلیدهای «قابل‌تلاش» و با مقدارِ الانِ محلی (rescue آن‌ها را
         بازنویسی کرده). کلیدهای غیرقابل‌حل (forbidden/skipped/…) fail-closed می‌مانند. */
      /* چه چیزی ارزشِ تلاشِ دوباره دارد؟
           - rescued: کپی محلی با نسخهٔ سرور جایگزین شد ⇒ push بعدی مطابقت می‌کند.
           - failed/blocked: موقتی‌اند (شبکه/فرمان دامنه).
         تعارضی که نجات نیافت (سرور serverData نفرستاد) با همان payload و همان base
         دوباره همان تعارض را می‌دهد ⇒ تلاشِ مجدد فقط ترافیک بیهوده است؛ فوراً گزارش
         می‌شود. forbidden/skipped/rejected هم قطعی‌اند (نقش/حجم/سپر داده). */
      var retryable = unresolvedRound.filter(function (k) {
        return rescued.indexOf(k) >= 0 ||
          ((d.failed) || []).indexOf(k) >= 0 ||
          ((d.blocked) || []).indexOf(k) >= 0;
      });
      if (retryable.length && round < MIGRATION_ROUNDS) {
        setTimeout(function () {
          readQueuePayload(retryable, function (nextPayload) {
            if (!Object.keys(nextPayload || {}).length) { reportMigrationBlocked(d, st, round); return; }
            convergeMigration(nextPayload, st, round + 1);
          });
        }, 900);
        return;
      }
      reportMigrationBlocked(d, st, round);
    });
  }

  /* P0-3: گزارشِ دقیق و عملی به‌جای «network» مبهم + ثبت دائمی برای تشخیص. */
  function reportMigrationBlocked(d, st, round) {
    var acked = st.acked;
    var unresolved = Object.keys(st.submitted).filter(function (k) { return acked[k] === undefined; });
    var blockers = migrationBlockers(st.seen, unresolved);
    var ackCount = Object.keys(acked || {}).length;
    var total = ackCount + unresolved.length;
    var lines = blockers.map(function (b) { return '• ' + b.label + ': ' + b.keys.map(shortKeyName).join('، '); });
    var listed = [];
    blockers.forEach(function (b) { b.keys.forEach(function (k) { listed.push(k); }); });
    var orphan = unresolved.filter(function (k) { return listed.indexOf(k) < 0; });
    if (orphan.length) lines.push('• بدون تأیید سرور ماند: ' + orphan.map(shortKeyName).join('، '));
    var reasonCode = blockers.length ? blockers[0].cls : 'unacknowledged';
    /* noteSyncError(scope, status, reason, detail):
         status = کد ماشین (نگاشت برچسب در جعبهٔ وضعیت دستگاه)،
         reason = متن خوانا برای کاربر (شمار نوبت و خطای سرور)،
         detail = فقط «کلاس:کلید|کلید» تا جعبهٔ دستگاه بتواند نام کلیدها را تمیز
                  رندر کند (نویز فنی داخل detail = کلیدِ جعلی در UI). */
    var detail = blockers.map(function (b) { return b.cls + ':' + b.keys.join('|'); }).join(' ; ') || 'no-ack';
    var reasonText = 'انتقال یک‌باره ناتمام ماند (نوبت ' + (round + 1) + (((d && d.error)) ? '، خطای سرور: ' + d.error : '') + ')';
    try { if (typeof window.ptfSyncNoteError === 'function') window.ptfSyncNoteError('migration', reasonCode, reasonText, detail); } catch (eNote) {}
    try { if (typeof audit === 'function') audit('سیستم', '⛔ انتقال یک‌باره ناتمام — ' + ackCount + ' از ' + total + ' کلید تأیید شد؛ باقی‌مانده: ' + (lines.join(' / ') || 'نامشخص'), 'SYNC'); } catch (eAuditMig) {}
    var guide = [];
    if (blockers.some(function (b) { return b.cls === 'conflicts'; })) guide.push('تعارض: در «تنظیمات ← بک‌آپ و بازگردانی ← تشخیص همگام‌سازی» دکمهٔ «تلاش مجدد ارسال» را بزنید، ۳۰ ثانیه صبر کنید، سپس دوباره «تکمیل انتقال یک‌باره» را بزنید.');
    if (blockers.some(function (b) { return b.cls === 'forbidden'; })) guide.push('نقش: این کلیدها در allowlist نقش فعلی نیستند؛ انتقال را با نقش بالاتر (مدیر / مدیر بازرگانی، یا حسابدار برای کلیدهای مالی) انجام دهید.');
    if (blockers.some(function (b) { return b.cls === 'rejected'; })) guide.push('سپر داده: کپی محلی این کلید با نسخهٔ ناخالی سرور ناسازگار است؛ یک‌بار «تلاش مجدد ارسال» بزنید و صفحه را رفرش کنید تا نسخهٔ سرور جایگزین شود.');
    if (blockers.some(function (b) { return b.cls === 'skipped'; })) guide.push('حجم: این کلید از سقف ۸MB بزرگ‌تر است؛ نیاز به تخلیهٔ پیوست/آرشیو دارد — با پشتیبانی هماهنگ کنید.');
    if (blockers.some(function (b) { return b.cls === 'failed'; })) guide.push('ارسال: اتصال پایدار لازم است' + ((d && d.error) ? ' — خطای سرور: ' + d.error : '') + '.');
    if (blockers.some(function (b) { return b.cls === 'blocked'; })) guide.push('فرمان دامنه: تا پایان اجرای فرمان جاری صبر کنید و دوباره تلاش کنید.');
    alert('⚠️ انتقال یک‌باره کامل نشد — ' + ackCount + ' از ' + total + ' کلید روی سرور تأیید شد.\n\nکلیدهای باقی‌مانده:\n' + (lines.join('\n') || '• نامشخص') +
      '\n\n' + (guide.join('\n') || '') + '\n\nدادهٔ محلی شما محفوظ است و نشانگرهای این دستگاه دست‌نخورده ماندند (دوباره تلاش کنید).');
  }

  window.ptfBConfirmFlush = function () {
    /* v34.36.1 (F1 — دامِ «سبز→کهربایی»): قبلاً پیش از هر تلاش، ptf_b_flushed و
       ptf_b_synced پاک می‌شد؛ یک درخواستِ شکست‌خورده دستگاهِ همگراشده را کهربایی
       می‌کرد، آینهٔ IndexedDB را خاموش می‌کرد و pullهای بعدی دوباره localStorage را
       پمپ می‌کردند. حالا همان «اجرای دوبارهٔ مهاجرت» با opts.force و بدونِ لمسِ
       نشانگرها انجام می‌شود (نشانگر فقط پس از ACK کامل در convergeMigration ثبت می‌شود). */
    window.ptfBFinalize({ force: true });
  };

  /* کاربران جدید نباید تنظیمات را بدانند. فقط در دستگاه واقعاً تازه (هیچ key
     کسب‌وکاری محلی و هیچ صفی ندارد) فاز B بی‌صدا فعال می‌شود؛ در هر حالت مبهم
     هیچ داده‌ای push/merge/پاک نمی‌شود و Sync استاندارد همچنان محافظت می‌کند. */
  function hasLocalBusinessPayload() {
    var ignore = { ptf_crm_settings: 1, ptf_crm_audit: 1, ptf_crm_notifs: 1, ptf_crm_notifprefs: 1, ptf_crm_sendqueue: 1 };
    try {
      return bKeys().some(function (k) {
        if (ignore[k]) return false;
        var raw = localGet(k);
        if (!raw || raw === '[]' || raw === '{}' || raw === 'null') return false;
        try { var v = JSON.parse(raw); return Array.isArray(v) ? v.length > 0 : !!(v && typeof v === 'object' && Object.keys(v).length); }
        catch (e) { return raw.length > 2; }
      });
    } catch (e2) { return true; } /* عدم قطعیت = محافظه‌کاری */
  }
  window.ptfBAutoBootstrap = function () {
    try {
      var u = (typeof curSession === 'function' ? curSession() : {}) || {};
      if (!u.user) return { ok: false, reason: 'no_session' };
      if (getFlag()) {
        if (flushRequired() && !hasLocalBusinessPayload()) window.ptfBFinalize({ auto: true });
        return { ok: true, enabled: true, reason: 'already_enabled' };
      }
      if (hasLocalBusinessPayload() || Object.keys(queueRead()).length) return { ok: false, reason: 'existing_local_data' };
      localStorage.setItem(flagKey(), '1');
      hook();
      window.ptfBFinalize({ auto: true });
      try { if (typeof addLog === 'function') addLog('حالت سرور-محور برای دستگاه تازه به‌صورت خودکار فعال شد'); } catch (eL) {}
      return { ok: true, enabled: true, reason: 'fresh_device' };
    } catch (e) { return { ok: false, reason: 'error' }; }
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
      alert('⚠️ داده‌های این دستگاه هنوز به سرور منتقل نشده است.\nبرای امنیت داده، پاک‌سازی کش فقط پس از «انتقال یک‌باره» ممکن است: تنظیمات → وضعیت دستگاه → «انتقال یک‌بارهٔ داده‌های این دستگاه» را با اینترنت پایدار اجرا کنید؛ پس از آن پاک‌سازی کش فعال می‌شود.'); /* v34.8.52: اصطلاح جدید جعبهٔ وضعیت دستگاه */
      return;
    }
    if (flushRequired() || !isSynced()) {
      /* v34.8.9: نشانگر همگرایی per-user بود و با تعویض اکانت، کاربر تازه گیر
         می‌کرد در حالی که دادهٔ شرکت مشترک و از قبل روی سرور است. اگر همین دستگاه
         با هر کاربری هم‌گرایی موفق داشته، پاک‌سازی مجاز است. */
      var deviceSynced = false;
      try {
        for (var i = 0; i < localStorage.length; i++) {
          var kk = localStorage.key(i);
          if (kk && String(kk).indexOf('ptf_b_synced_') === 0 && localStorage.getItem(kk) === '1') { deviceSynced = true; break; }
        }
      } catch (eScan) {}
      if (!deviceSynced) {
        alert('⚠️ انتقال یک‌بارهٔ داده‌ها هنوز کامل نشده است.\nابتدا از «تنظیمات → وضعیت دستگاه» انتقال را انجام دهید و پیام موفقیت را ببینید؛ سپس پاک‌سازی کش را اجرا کنید.');
        return;
      }
    }
    var qs = queueRead();
    var qn = Object.keys(qs).length;
    if (qn) {
      alert('⚠️ ' + qn + ' تغییر هنوز به سرور نرسیده است.\nپاک‌سازی متوقف شد تا هیچ داده‌ای گم نشود. با اتصال پایدار صبر کنید تا صف آفلاین خودکار ارسال شود؛ سپس پاک‌سازی کنید.');
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
    alert('✅ پاک‌سازی کش محلی انجام شد.\n' + removed + ' کلید حذف شد و حدود ' + Math.round(freed / 1024) + ' KB از حافظهٔ مرورگر آزاد شد.\nدادهٔ اصلی روی سرور است و موقع استفاده دوباره بارگیری می‌شود.\n(کلیدهای سنگین از v33.20.0 به‌صورت خودکار در IndexedDB نگهداری می‌شوند و localStorage را پر نمی‌کنند.)');
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

    /* getData: کش ۳۰ ثانیه → سرور → کش محلی (v33.20.0: سنگین‌ها از آینهٔ حافظه/IDB) */
    window.getData = function (k) {
      try {
        if (!getFlag()) return _get(k);
        if (!bKeys().indexOf) return _get(k);
        if (bKeys().indexOf(k) === -1) return _get(k);
        var now = Date.now();
        if (cache[k] && (now - cache[k].t) < CACHE_TTL) return JSON.parse(cache[k].v);
        /* v33.20.0: کلید سنگین → آینهٔ حافظه (IDB-backed)؛ localStorage خلوت می‌ماند */
        var local = null;
        if (window.ptfBMirrorActive() && idbKnown[k] && Object.prototype.hasOwnProperty.call(idbMem, k)) local = idbMem[k];
        if (local === null) local = localGet(k);
        var localArr = [];
        try { localArr = local ? JSON.parse(local) : []; } catch (e) {}
        /* v33.21.0: روی پول مشترک دلتا سوار می‌شویم (به‌جای پول کاملِ مستقل برای هر خواندن).
           پاسخ، کش+آینهٔ همهٔ کلیدهای تغییرکرده را مرکزی تازه می‌کند؛ اگر k در پاسخ نبود یعنی
           روی سرور تغییر نکرده → فقط عمر کش همان کلید تمدید می‌شود تا رکوئست بعدی لازم نشود. */
        sharedPull(function (d) {
          if (d && d.ok && !(d.data && Object.prototype.hasOwnProperty.call(d.data, k)) && cache[k]) {
            cache[k].t = Date.now();
          }
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
        /* audit داخلی در نقش محدود محلی می‌ماند و sync.js آن را dirty نمی‌کند؛
           آن را مثل دادهٔ کسب‌وکاریِ نقش‌ممنوع block نکنید. */
        if (k !== 'ptf_crm_audit' && typeof window.ptfSyncCanWriteKey === 'function' && !window.ptfSyncCanWriteKey(k)) {
          if (typeof window.ptfSyncNotifyWriteFailure === 'function') window.ptfSyncNotifyWriteFailure(k, 'نقش فعلی اجازهٔ ثبت/همگام‌سازی این بخش را ندارد');
          return false;
        }
        var s = JSON.stringify(d);
        cache[k] = { t: Date.now(), v: s };
        /* v33.20.0: کلید سنگین → حافظهٔ نشست + IndexedDB (نه localStorage) تا سقف ۵MB لمس نشود */
        var localOk = true;
        if (window.ptfBMirrorActive() && heavyList(k, s)) {
          idbKnown[k] = 1; idbMem[k] = s;
          /* IDB asynchronous است؛ تا وقتی ACK سرور نیامده، queue پایدار localStorage
             مانع از گم‌شدن تغییر در crash/refresh می‌شود. */
          try { window.ptfStorageIdbSet(idbPrefix() + k, s, function () {}); } catch (eI) {}
          localDel(k);
        } else {
          localOk = localSet(k, s) !== false;
        }
        if (!localOk || !queueAdd(k)) {
          delete cache[k];
          if (typeof window.ptfSyncNotifyWriteFailure === 'function') window.ptfSyncNotifyWriteFailure(k, 'صف آفلاین یا حافظهٔ مرورگر پایدار نشد');
          return false;
        }
        /* v34.38.1 (LIST-RENDER-N1): ابطال کش کوتاه‌مدت نام مشتری پس از نوشتن موفق. */
        if (k === 'ptf_crm_customers' && typeof window.ptfCustCacheDrop === 'function') { try { window.ptfCustCacheDrop(); } catch (eCC) {} }
        if (pushTimer) clearTimeout(pushTimer);
        pushTimer = setTimeout(function () {
          /* Route the debounce through sync.js when available so pull and push share
             one in-memory busy flag; isolated legacy harnesses keep the direct fallback. */
          try {
            if (typeof window.ptfSyncFlushNow === 'function') window.ptfSyncFlushNow(function () {});
            else window.ptfBFlushQueue(function () {});
          } catch (eFlushTimer) {}
        }, 4000);
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
  /* ---------- v34.8.9 (STORAGE-INDEPENDENCE) ----------
     RCA: روی دستگاه‌های قدیمی، «هم‌گرایی» انجام می‌شد اما پرچم فاز B روشن نمی‌شد؛
     در نتیجه آینهٔ IDB هیچ‌وقت فعال نمی‌شد، کل دیتاست در localStorage می‌ماند و
     «پاک‌سازی کش» هم با گاردِ «حالت سرور-محور فعال نیست» رد می‌شد — بن‌بست ۱۰۰٪.
     از این پس موفقیت همگرایی = فعال‌سازی خودکار فاز B + تخلیهٔ کلیدهای
     کسب‌وکار از localStorage به IndexedDB (localStorage فقط کش سبک می‌ماند). */
  window.ptfBOffloadBusinessKeysToIdb = function (opts) {
    opts = opts || {};
    if (!getFlag() || !isSynced() || !idbUsable()) return { ok: false, reason: 'phase_b_not_ready' };
    if (Object.keys(queueRead()).length && !opts.force) return { ok: false, reason: 'queue_not_empty' };
    var freed = 0, moved = 0;
    try {
      bKeys().forEach(function (k) {
        try {
          var v = localStorage.getItem(k);
          if (v === null) return;
          var bytes = (k.length + v.length) * 2;
          if (bytes <= 8 * 1024) return; /* v34.8.10: آستانه ۸KB — کلیدهای سبک محلی می‌مانند */
          if (window.ptfBMirror(k, v)) { freed += bytes; moved++; } /* mirror خودش localStorage را حذف می‌کند */
        } catch (eKey) {}
      });
    } catch (eAll) {}
    if (moved) {
      try { localStorage.setItem('ptf_b_offload_last', JSON.stringify({ at: new Date().toISOString(), moved: moved, freedBytes: freed })); } catch (eM) {}
      try { if (typeof audit === 'function') audit('سیستم', '📦 تخلیهٔ امن ' + moved + ' کلید به IndexedDB — حدود ' + Math.round(freed / 1024) + ' KB از localStorage آزاد شد (داده روی سرور معتبر است)', 'STORAGE'); } catch (eA) {}
    }
    return { ok: true, moved: moved, freedBytes: freed };
  };
  window.ptfBEnableAfterConvergence = function () {
    try { localStorage.setItem(flagKey(), '1'); } catch (e) {}
    hook();
    var off = window.ptfBOffloadBusinessKeysToIdb({ force: true });
    try { if (typeof ptfToast === 'function') ptfToast('حالت سرور-محور فعال شد و دادهٔ حجیم به IndexedDB منتقل شد — وابستگی به localStorage پایان یافت' + (off && off.moved ? ' (' + off.moved + ' کلید)' : ''), 'ok'); } catch (eT) {}
    return off;
  };
  /* ---------- v34.8.51 (PRE-PROD): وضعیت شفاف دستگاه برای UI تنظیمات ----------
     جعبهٔ تنظیماتِ «وضعیت دستگاه» به‌جای دکمه‌های خاموش/روشن قدیمی، از این
     خوانندهٔ واحد استفاده می‌کند. دستگاه دارای دادهٔ محلیِ همگرایی‌نشده =
     «در انتظار انتقال یک‌باره» (مسیر مهاجرت پروداکشن پس از دیپلوی v34.9.1). */
  window.ptfBStatus = function () {
    try {
      return {
        enabled: !!getFlag(),
        synced: !!isSynced(),
        queue: Object.keys(queueRead()).length,
        localPayload: hasLocalBusinessPayload()
      };
    } catch (e) { return { enabled: false, synced: false, queue: 0, localPayload: false, error: '' + e }; }
  };
  window.ptfBDisable = function () {
    /* v33.20.0: کلیدهای سنگینِ منتقل‌شده به حافظه/IDB را به localStorage برگردان تا حالت قدیمی سالم بماند */
    try {
      Object.keys(idbMem).forEach(function (k) {
        try { localStorage.setItem(k, idbMem[k]); } catch (e1) {}
      });
    } catch (e) {}
    try { localStorage.removeItem(flagKey()); } catch (e) {}
    if (typeof ptfToast === 'function') ptfToast('حالت سرور-محور غیرفعال شد (بازگشت به حالت قبلی)', 'warn');
  };

  /* ---------- بوت: هوک + اگر فعال بود، هم‌گرایی + preload آینهٔ خالدار ---------- */
  var tries = 0;
  var t = setInterval(function () {
    tries++;
    if (hook() || tries > 40) {
      clearInterval(t);
      /* راه‌اندازی بدون تنظیمات برای دستگاه تازه؛ دستگاه دارای دادهٔ محلی عمداً
         وارد مسیر خودکار destructive نمی‌شود. */
      try { window.ptfBAutoBootstrap(); } catch (e) {}
      try { if (typeof window.ptfStorageRequestPersistentAuto === 'function') window.ptfStorageRequestPersistentAuto(); } catch (ePst) {}
      /* v33.20.0: مهاجرت/پرکردن حافظهٔ کلیدهای سنگین (فقط فاز فعال + هم‌گرایی موفق + IDB) */
      try { window.ptfBIdbPreload(function () {}); } catch (eP) {}
      /* v34.8.23 (T3-3): آب‌رسانی صف آفلاین از IndexedDB — قبل از هر flush */
      try { window.ptfBQueueIdbPreload(function () {}); } catch (eQ) {}
      /* v34.8.9 (STORAGE-INDEPENDENCE): تخلیهٔ هرچه در localStorage مانده به IDB —
         حتی کلیدهایی که مسیرهای قدیمی مستقیم نوشته‌اند. یک‌بار در هر بوت کافی است. */
      try { window.ptfBOffloadBusinessKeysToIdb({ force: true }); } catch (eOff) {}
    }
  }, 300);
  /* ورود کاربر ممکن است بعد از پایان interval بوت رخ دهد؛ پس auto bootstrap را
     یک‌بار پس از showCrm هم اجرا می‌کنیم تا کاربر تازه هیچ تنظیمی لازم نداشته باشد. */
  var _ptfBShowCrm = window.showCrm;
  if (_ptfBShowCrm && !window._ptfBAutoShowHooked) {
    window._ptfBAutoShowHooked = true;
    window.showCrm = function () {
      _ptfBShowCrm.apply(this, arguments);
      setTimeout(function () { try { window.ptfBAutoBootstrap(); } catch (e) {} }, 900);
    };
  }
})();
