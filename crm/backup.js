/* =====================================================================
   PTF CRM — Sprint 71 (backup.js)
   US-146: بک‌آپ خودکار ساعتی (آروان + سرور) + بازگردانی از تنظیمات
   US-147: اختیارات ادمین (بازگشت از برنده + حذف پرونده خودکار)
   ===================================================================== */
(function () {
  'use strict';
  var API = '../api/crm.php';
  function ptfBackupAuthHeaders(json) {
    var h = json ? { 'Content-Type': 'application/json' } : {};
    try { h['X-CRM-Role'] = curRole(); var t = localStorage.getItem('ptf_crm_token'); if (t) h['X-CRM-Token'] = t; } catch (e) {}
    return h;
  }

  /* ============ US-146: جمع‌آوری کل داده‌ها ============ */
  /* v33.13.0 (F0-5): ptf_storage_queue (صف موقت آپلود فایل‌ها) از بکاپ حذف شد —
     حجیم و موقتی است و فایل‌ها در ابری/IndexedDB جدا نگهداری می‌شوند. */
  var DATA_KEYS = [
    'ptf_crm_rfqs', 'ptf_crm_suppliers', 'ptf_crm_customers', 'ptf_crm_users',
    'ptf_crm_products', 'ptf_crm_catalog_reviews', 'ptf_crm_catalog_merges', 'ptf_crm_offers', 'ptf_crm_leads', 'ptf_crm_reminders',
    'ptf_crm_buyquotes', 'ptf_crm_invoices', 'ptf_crm_surplus', 'ptf_crm_notifs', 'ptf_crm_sendqueue',
    'ptf_crm_audit', 'ptf_crm_inqitems', 'ptf_crm_deals', 'ptf_crm_projects',
    'ptf_crm_packinglists', 'ptf_crm_letters', 'ptf_crm_contracts',
    'ptf_crm_sigprofiles', 'ptf_crm_settings', 'ptf_crm_finance',
    'ptf_crm_order_prices', 'ptf_crm_notifprefs', 'ptf_crm_trash', 'ptf_crm_smsbook', 'ptf_crm_rfqsmart', 'ptf_crm_petty', 'ptf_crm_petty_tx', 'ptf_crm_petty_periods', 'ptf_crm_shareholders', 'ptf_crm_sharetx', 'ptf_crm_fiscal_snapshots', 'ptf_crm_techcases', 'ptf_crm_calc_runs', 'ptf_crm_techproposals', 'ptf_crm_leadfinder_jobs', 'ptf_crm_leadfinder_sources', 'ptf_crm_perms', 'ptf_crm_avatars', 'ptf_crm_buycmp', 'ptf_crm_inqreads', 'ptf_crm_cheques_issued', 'ptf_crm_cheques_received', 'ptf_crm_msgtpls', 'ptf_crm_deleted_archive', 'ptf_crm_tax_returns', 'ptf_crm_sales_returns', 'ptf_crm_payables', 'ptf_crm_supplier_finance', 'ptf_crm_opex'
  ];

  /* v33.13.0 (F0-6): کاهش حجم payload — کلیدهای لاگ/اعلان در بکاپ به N رکورد آخر محدود
     می‌شوند (دادهٔ کامل در localStorage محفوظ است؛ بکاپ فقط برای بازگردانی/بایگانی). */
  var PAYLOAD_CAPS = { 'ptf_crm_audit': 1000, 'ptf_crm_notifs': 500 };

  function collectBackup() {
    var data = {};
    DATA_KEYS.forEach(function (k) {
      var v = localStorage.getItem(k);
      if (v === null) return;
      var cap = PAYLOAD_CAPS[k];
      if (cap) {
        try {
          var arr = JSON.parse(v);
          if (Array.isArray(arr) && arr.length > cap) { data[k] = JSON.stringify(arr.slice(0, cap)); return; }
        } catch (e) {}
      }
      data[k] = v;
    });
    return {
      app: 'PTF-CRM', ver: 71,
      t: new Date().toISOString(),
      tFa: faDateTime(),
      by: curSession().name || '?',
      counts: summarize(data),
      data: data
    };
  }

  function summarize(data) {
    var c = {};
    Object.keys(data).forEach(function (k) {
      try {
        var v = JSON.parse(data[k]);
        c[k] = Array.isArray(v) ? v.length : 1;
      } catch (e) { c[k] = 1; }
    });
    return c;
  }

  /* ============ ارسال بک‌آپ به سرور (→ آروان) ============ */
  /* v33.13.0 (فوریت): 
     - F0-4: همهٔ fetchهای بکاپ timeout دارند (۲۰ ثانیه، AbortController).
     - F0-3: پاسخ 401/needLogin → refresh توکن (ptfSyncRefreshAuth) و یک بار تلاش مجدد.
     - F0-1: در آفلاین هرگز دادهٔ حجیم در localStorage نوشته نمی‌شود — فقط IndexedDB؛
       اگر IDB هم fail شد → فقط marker کوچک با پیام (حافظهٔ مرورگر پر نمی‌شود). */
  function backupFetch(url, opts, timeoutMs) {
    var ctrl = (typeof AbortController === 'function') ? new AbortController() : null;
    var to = null;
    if (ctrl) { to = setTimeout(function () { try { ctrl.abort(); } catch (e) {} }, timeoutMs || 20000); }
    return fetch(url, Object.assign({}, opts || {}, ctrl ? { signal: ctrl.signal } : {}))
      .then(function (r) { return r.json(); })
      .finally(function () { if (to) clearTimeout(to); });
  }
  function backupStoreLocalFallback(payload, raw) {
    /* F0-1: هرگز دادهٔ حجیم مستقیم در localStorage. فقط IDB؛ در غیر این صورت marker کوچک. */
    var stored = false, bytes = 0;
    try { bytes = raw.length; } catch (eB) {}
    if (typeof ptfStorageIdbSet === 'function') {
      try {
        ptfStorageIdbSet('ptf_backup_local', raw, function (ok, b) {
          try {
            var marker = { storedIn: ok ? 'indexedDB' : 'none', key: 'ptf_backup_local', bytes: b || bytes, updatedAt: new Date().toISOString(), error: ok ? '' : 'IDB write failed' };
            if (typeof ptfStorageSafeSetItem === 'function') ptfStorageSafeSetItem('ptf_backup_local', JSON.stringify(marker), { noWarn: true });
            else localStorage.setItem('ptf_backup_local', JSON.stringify(marker));
          } catch (eM) {}
        });
        stored = true;
      } catch (eI) {}
    }
    if (!stored) {
      /* فقط marker — نه خود داده (حافظهٔ مرورگر پر نمی‌شود) */
      try {
        var m2 = { storedIn: 'none', key: 'ptf_backup_local', bytes: bytes, updatedAt: new Date().toISOString(), error: 'IndexedDB not available; raw backup NOT stored locally' };
        if (typeof ptfStorageSafeSetItem === 'function') ptfStorageSafeSetItem('ptf_backup_local', JSON.stringify(m2), { noWarn: true });
        else localStorage.setItem('ptf_backup_local', JSON.stringify(m2));
      } catch (eM2) {}
    }
  }
  function pushBackup(manual, cb, attempt) {
    attempt = attempt || 0;
    var payload = collectBackup();
    backupFetch(API + '?action=save_backup', {
      method: 'POST',
      headers: ptfBackupAuthHeaders(true),
      body: JSON.stringify(payload)
    })
      .then(function (d) {
        if (d && d.ok) {
          try { localStorage.setItem('ptf_backup_last', JSON.stringify({ t: payload.tFa, iso: payload.t, mode: d.mode })); } catch (eL) {}
          if (manual) alert('✅ بک‌آپ ثبت شد (' + (d.mode === 'arvan' ? 'فضای ابری آروان + سرور' : 'سرور هاست') + ')');
          cb && cb(d);
          return;
        }
        /* F0-3: 401/needLogin → refresh توکن و یک بار تلاش مجدد */
        if (d && (d.needLogin || /token|unauthorized|401/i.test(String(d.error || ''))) && attempt === 0 && typeof window.ptfSyncRefreshAuth === 'function') {
          window.ptfSyncRefreshAuth(function (ok) {
            if (ok) pushBackup(manual, cb, 1);
            else {
              if (manual) alert('⚠️ نشست شما منقضی شده است — لطفاً دوباره وارد شوید و سپس بک‌آپ بگیرید.');
              cb && cb({ ok: false, error: 'needLogin' });
            }
          });
          return;
        }
        if (manual) alert('⚠️ خطا در بک‌آپ سروری: ' + ((d && d.error) || 'نامشخص') + (d && d.needLogin ? ' — ابتدا دوباره وارد شوید.' : ''));
        cb && cb(d);
      })
      .catch(function (e) {
        /* F0-1: fallback فقط IndexedDB — هرگز localStorage حجیم */
        try {
          var raw = JSON.stringify(payload);
          backupStoreLocalFallback(payload, raw);
        } catch (eS) {}
        if (manual) alert('⚠️ سرور در دسترس نیست یا پاسخ نداد — نسخهٔ اضطراری تا حد امکان در IndexedDB نگهداری شد (حافظهٔ مرورگر پر نمی‌شود). بعداً تلاش مجدد می‌شود.');
        cb && cb({ ok: false, error: String((e && e.message) || 'network') });
      });
  }
  window.ptfBackupNow = function () {
    /* v33.16.0: بکاپ فوری = کامل + آپدیت امضای per-key (برای دلتاهای بعدی) */
    pushBackup(true, function (d) { if (d && d.ok) { backupMarkSent(); deltaSaveSentKeys(DATA_KEYS); } });
  };
  /* export برای تست/یکپارچگی (فاز ۲) */
  window.ptfBackupRestore = doRestore;
  window.ptfBackupPushDelta = function (manual, cb) { pushBackupDelta(manual, cb); };
  window.ptfBackupPushFull = function (manual, cb) { pushBackup(manual, cb); };

  // AC1: بک‌آپ خودکار هر ۱ ساعت (+ یک بک‌آپ ۲ دقیقه بعد از ورود)
  /* v14.0 (US-263): هرس دوره‌ای صف‌ها — همراه چرخه بک‌آپ (بدون polling جدید) */
  function pruneQueues() {
    try {
      var changed = false;
      /* sendqueue: ارسال‌شده‌های قدیمی‌تر از ۳۰ روز حذف */
      var cutoff = new Date(Date.now() - 30 * 86400000).toISOString();
      var q = getData('ptf_crm_sendqueue');
      var q2 = q.filter(function (x) { return !(x.st === 'sent' && (x.iso || x.t || '') < cutoff); });
      if (q2.length !== q.length) { setData('ptf_crm_sendqueue', q2); changed = true; }
      /* wfLog: حداکثر ۵۰ رویداد per درخواست */
      var rfqs = getData('ptf_crm_rfqs');
      var wfCut = false;
      rfqs.forEach(function (r) {
        if (r.wfLog && r.wfLog.length > 50) { r.wfLog = r.wfLog.slice(-50); wfCut = true; }
      });
      if (wfCut) { setData('ptf_crm_rfqs', rfqs); changed = true; }
      if (changed && typeof addLog === 'function') addLog('هرس دوره‌ای صف‌ها انجام شد (US-263)');
    } catch (e) {}
  }

  /* ============ v33.15.0 — فاز ۱: بکاپ هوشمند + بررسی اتصال سرور ============ */

  /* F1-1: بررسی وضعیت اتصال/توکن سرور (پینگ سبک users_get — اکشن عمومی) */
  window.ptfBackupServerStatus = function (cb) {
    backupFetch(API + '?action=users_get', { headers: ptfBackupAuthHeaders(false) })
      .then(function (d) {
        var st = (d && (d.ok || d.users || Array.isArray(d))) ? 'online' : (d && d.needLogin ? 'needLogin' : 'error');
        cb && cb({ status: st, error: (d && d.error) || '' });
      })
      .catch(function () { cb && cb({ status: 'offline', error: 'عدم دسترسی به سرور' }); });
  };
  window.ptfBackupServerCheck = function () {
    var box = document.getElementById('ptfBackupConn');
    if (box) box.innerHTML = '<span style="color:#94a3b8">در حال بررسی اتصال...</span>';
    window.ptfBackupServerStatus(function (r) {
      if (box) {
        if (r.status === 'online') box.innerHTML = '<span style="color:#047857;font-weight:800">✅ سرور در دسترس است — توکن معتبر</span>';
        else if (r.status === 'needLogin') box.innerHTML = '<span style="color:#b45309;font-weight:800">⚠️ نشست منقضی شده — دوباره وارد شوید</span>';
        else if (r.status === 'offline') box.innerHTML = '<span style="color:#dc2626;font-weight:800">❌ سرور در دسترس نیست (' + escP(r.error || '') + ')</span>';
        else box.innerHTML = '<span style="color:#dc2626;font-weight:800">⚠️ خطای سرور: ' + escP(r.error || '') + '</span>';
      }
      try { if (typeof ptfToast === 'function') ptfToast(r.status === 'online' ? 'اتصال سرور برقرار است' : 'اتصال سرور برقرار نیست', r.status === 'online' ? 'ok' : 'warn'); } catch (eT) {}
    });
  };

  /* F1-2: امضای داده — بکاپ خودکار فقط وقتی داده تغییر کرده باشد.
     v33.15.0: hash محتوای کامل (djb2) — نسخهٔ اول فقط «طول» کلیدها را می‌شمرد و
     اگر داده عوض می‌شد ولی طولش ثابت می‌ماند، امضا تغییر نمی‌کرد (بکاپ نمی‌رفت). */
  function backupSignature() {
    var h = 5381;
    try {
      DATA_KEYS.forEach(function (k) {
        var v = localStorage.getItem(k);
        h = ((h << 5) + h + k.length) | 0;
        if (v) {
          var n = v.length;
          h = ((h << 5) + h + n) | 0;
          /* djb2 روی محتوا — برای کل حجم چند MB حدود چند ده ms (یک بار در ساعت) */
          for (var i = 0; i < n; i++) {
            h = ((h << 5) + h + v.charCodeAt(i)) | 0;
          }
        } else {
          h = ((h << 5) + h + 999) | 0;
        }
      });
    } catch (e) {}
    return String(h);
  }
  function backupChangedSinceLast() {
    try {
      var last = localStorage.getItem('ptf_backup_sig') || '';
      return backupSignature() !== last;
    } catch (e) { return true; }
  }
  window.ptfBackupSignature = backupSignature;
  window.ptfBackupChanged = backupChangedSinceLast;
  function backupMarkSent() {
    try { localStorage.setItem('ptf_backup_sig', backupSignature()); } catch (e) {}
  }

  /* ============ v33.16.0 — فاز ۲: بکاپ دلتا (فقط کلیدهای تغییرکرده) ============ */
  function hashString(s) {
    var h = 5381;
    s = String(s == null ? '' : s);
    for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return String(h);
  }
  function deltaSigs() {
    try { var o = JSON.parse(localStorage.getItem('ptf_backup_delta_sig') || '{}'); return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; }
  }
  function deltaSaveSigs(o) { try { localStorage.setItem('ptf_backup_delta_sig', JSON.stringify(o || {})); } catch (e) {} }
  function deltaSaveSentKeys(keys) {
    var o = deltaSigs();
    (keys || []).forEach(function (k) {
      try { o[k] = hashString(localStorage.getItem(k)); } catch (e) {}
    });
    deltaSaveSigs(o);
  }
  /* جمع‌آوری دلتا: فقط کلیدهایی که امضای per-key‌شان تغییر کرده (یا امضایی ندارند) */
  window.ptfBackupDeltaCollect = function () {
    var sigs = deltaSigs();
    var delta = {}, changed = [];
    DATA_KEYS.forEach(function (k) {
      var v = localStorage.getItem(k);
      var cur = hashString(v);
      if (sigs[k] !== cur) { delta[k] = v; changed.push(k); }
    });
    return { delta: delta, changed: changed };
  };
  /* ارسال دلتا به سرور؛ اگر سرور بکاپ پایه نداشت → fallback به بکاپ کامل */
  function pushBackupDelta(manual, cb) {
    var c = window.ptfBackupDeltaCollect();
    if (!c.changed.length) { cb && cb({ ok: true, skipped: 'no_change' }); return; }
    backupFetch(API + '?action=save_backup_delta', {
      method: 'POST',
      headers: ptfBackupAuthHeaders(true),
      body: JSON.stringify({ delta: c.delta, tFa: faDateTime(), by: curSession().name || '?' })
    })
      .then(function (d) {
        if (d && d.ok) {
          deltaSaveSentKeys(c.changed);
          if (manual) alert('✅ بک‌آپ دلتا ثبت شد (' + c.changed.length + ' بخش تغییرکرده)');
          cb && cb(d);
          return;
        }
        if (d && (d.needLogin || /token|unauthorized|401/i.test(String(d.error || ''))) && typeof window.ptfSyncRefreshAuth === 'function') {
          window.ptfSyncRefreshAuth(function (ok) { if (ok) pushBackupDelta(manual, cb); else { if (manual) alert('⚠️ نشست منقضی — دوباره وارد شوید.'); cb && cb({ ok: false, error: 'needLogin' }); } });
          return;
        }
        if (d && d.needFull) {
          /* سرور بکاپ پایه ندارد → بکاپ کامل */
          pushBackup(manual, function (d2) { if (d2 && d2.ok) backupMarkSent(); cb && cb(d2 || { ok: false }); });
          return;
        }
        if (manual) alert('⚠️ خطا در بک‌آپ دلتا: ' + ((d && d.error) || 'نامشخص'));
        cb && cb(d);
      })
      .catch(function (e) {
        /* آفلاین → نگهداری محلی (فقط IDB) مثل قبل */
        try {
          var payload = collectBackup();
          backupStoreLocalFallback(payload, JSON.stringify(payload));
        } catch (eS) {}
        if (manual) alert('⚠️ سرور در دسترس نیست — تغییرات محلی حفظ شد؛ بعداً تلاش مجدد می‌شود.');
        cb && cb({ ok: false, error: String((e && e.message) || 'network') });
      });
  }

  /* هستهٔ تصمیم بکاپ خودکار — v33.16.0: دلتا به‌جای بکاپ کامل */
  window.ptfBackupMaybeAuto = function () {
    if (!curSession() || !curSession().user) return { ok: false, why: 'no_session' };
    if (!backupChangedSinceLast()) return { ok: true, skipped: 'no_change' };
    pruneQueues();
    /* اگر امضای per-key نداریم (نسخهٔ قدیمی) → بکاپ کامل اولیه */
    var sigs = deltaSigs();
    if (!Object.keys(sigs).length) {
      pushBackup(false, function (d) { if (d && d.ok) { backupMarkSent(); deltaSaveSentKeys(DATA_KEYS); } });
      return { ok: true, pushed: 'full_initial' };
    }
    pushBackupDelta(false, function (d) { if (d && d.ok) backupMarkSent(); });
    return { ok: true, pushed: 'delta' };
  };
  function scheduleBackups() {
    if (window._ptfBakT) return;
    window._ptfBakT = setInterval(function () { window.ptfBackupMaybeAuto(); }, 3600000);
    setTimeout(function () { window.ptfBackupMaybeAuto(); }, 120000);
  }

  /* ============ دانلود بک‌آپ (فایل محلی) ============ */
  window.ptfBackupDownload = function () {
    var payload = collectBackup();
    var blob = new Blob([JSON.stringify(payload, null, 1)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'ptf-crm-backup-' + new Date().toISOString().slice(0, 16).replace(/[T:]/g, '-') + '.json';
    a.click();
    addLog('فایل بک‌آپ دانلود شد');
    markMonthlySaved('دانلود دستی فایل بک‌آپ');
  };

  /* ============ US-283 (v122.3): دانلود بک‌آپ ماهانه سروری ============ */
  window.ptfDownloadMonthly = function () {
    var tryNames = ['monthly-latest.json.gz', 'monthly-latest.json'];
    (function attempt(i) {
      if (i >= tryNames.length) { alert('⚠️ هنوز نسخه ماهانه روی سرور ساخته نشده — از «⬇️ دانلود فایل بک‌آپ» استفاده کنید'); return; }
      backupFetch(API + '?action=get_backup&name=' + tryNames[i], { headers: ptfBackupAuthHeaders(false) })
        .then(function (t) {
          var j = null; try { j = JSON.parse(t); } catch (e) {}
          if (!j || j.app !== 'PTF-CRM') { attempt(i + 1); return; }
          var blob = new Blob([t], { type: 'application/json' });
          var a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = 'ptf-crm-monthly-backup-' + new Date().toISOString().slice(0, 10) + '.json';
          a.click();
          addLog('بک‌آپ ماهانه سرور دانلود شد');
          markMonthlySaved('دانلود بک‌آپ ماهانه سرور');
        })
        .catch(function () { attempt(i + 1); });
    })(0);
  };

  /* ============ US-283: یادآور ماهانه ذخیره فایل بک‌آپ — رییس هیات مدیره + ادمین ============ */
  function bakMonthKey() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2); }
  function bakSettings() { try { return JSON.parse(localStorage.getItem('ptf_crm_settings') || '{}'); } catch (e) { return {}; } }
  function markMonthlySaved(how) {
    try {
      var st = bakSettings();
      var mk = bakMonthKey();
      if (st.bakMonthlySaved === mk) return;
      st.bakMonthlySaved = mk;
      setData('ptf_crm_settings', st);
      if (typeof audit === 'function') audit('سیستم', 'ذخیره ماهانه فایل بک‌آپ انجام شد (' + how + ')', mk);
    } catch (e) {}
  }
  function checkMonthlyBackupReminder() {
    try {
      var role = curRole();
      if (['admin', 'chairman', 'ceo', 'commercial'].indexOf(role) < 0) return; // یادآور برای مدیران ارشد (v14.9 US-383)
      var st = bakSettings();
      var mk = bakMonthKey();
      if (st.bakMonthlySaved === mk) return;      // این ماه ذخیره شده — یادآور لازم نیست
      if (st.bakMonthlyNotified === mk) return;   // این ماه قبلاً اعلان رفته (سراسری — کلید settings سینک می‌شود)
      st.bakMonthlyNotified = mk;
      setData('ptf_crm_settings', st);
      if (typeof notify === 'function') {
        notify({
          toRoles: ['admin', 'chairman'],
          title: '📥 یادآور ماهانه بک‌آپ (' + mk + '): فایل بک‌آپ این ماه را دانلود و خارج از سامانه نگه دارید',
          body: 'تنظیمات → «📥 دانلود بک‌آپ ماهانه سرور» (یا «⬇️ دانلود فایل بک‌آپ»). سرور و فضای ابری فقط آخرین نسخه‌ها را چرخشی نگه می‌دارند؛ نسخه خارج از سامانه، بیمه نهایی داده‌هاست.',
          kind: 'system', channels: ['cart'], link: { panel: 'set' }, actionable: true
        });
      }
    } catch (e) {}
  }

  /* ============ AC4: بازگردانی از فایل بک‌آپ (فقط ادمین) ============ */
  window.ptfRestorePick = function () {
    if (curRole() !== 'admin') { alert('⛔ بازگردانی اطلاعات فقط توسط ادمین ممکن است'); return; }
    var inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.json,application/json';
    inp.onchange = function () {
      var f = inp.files[0];
      if (!f) return;
      var rd = new FileReader();
      rd.onload = function () {
        var j = null;
        try { j = JSON.parse(rd.result); } catch (e) {}
        if (!j || j.app !== 'PTF-CRM' || !j.data) { alert('❌ فایل بک‌آپ معتبر PTF-CRM نیست'); return; }
        showRestorePreview(j);
      };
      rd.readAsText(f);
    };
    inp.click();
  };

  function showRestorePreview(j) {
    var rows = Object.keys(j.counts || {}).map(function (k) {
      var lb = k.replace('ptf_crm_', '').replace('ptf_storage_', 'storage-');
      return '<tr><td style="font-size:11.5px;direction:ltr">' + escP(lb) + '</td><td>' + j.counts[k] + '</td></tr>';
    }).join('');
    var html = '<div class="md-b" style="display:grid;z-index:70" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:520px;max-height:90vh;overflow:auto">' +
      '<h3>⏪ پیش‌نمایش بازگردانی</h3>' +
      '<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:10px 14px;font-size:12.5px;color:#b91c1c;margin-bottom:10px">' +
      '⚠️ با بازگردانی، <b>تمام داده‌های فعلی جایگزین</b> می‌شوند و هر تغییری بعد از تاریخ این بک‌آپ از بین می‌رود.<br>' +
      'قبل از جایگزینی، یک بک‌آپ اضطراری خودکار از وضعیت فعلی گرفته می‌شود.</div>' +
      '<div style="font-size:13px;margin-bottom:8px">📅 تاریخ بک‌آپ: <b>' + escP(j.tFa || j.t) + '</b> | ثبت‌کننده: ' + escP(j.by || '?') + '</div>' +
      '<div class="tb2" style="max-height:220px;overflow:auto"><table><thead><tr><th>بخش</th><th>تعداد رکورد</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">' +
      '<button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">انصراف</button>' +
      '<button class="bt" style="background:#dc2626" id="restoreGo">⏪ تایید و بازگردانی</button></div></div></div>';
    document.getElementById('panels').insertAdjacentHTML('beforeend', html);
    document.getElementById('restoreGo').onclick = function () {
      // تایید دومرحله‌ای (AC4)
      var word = prompt('برای تایید نهایی، کلمه «بازگردانی» را تایپ کنید:');
      if (word !== 'بازگردانی') { alert('لغو شد'); return; }
      doRestore(j);
    };
  }

  function doRestore(j) {
    // AC5: بک‌آپ اضطراری از وضعیت فعلی قبل از جایگزینی
    try {
      var cur = collectBackup();
      var curRaw = JSON.stringify(cur);
      if (typeof ptfStorageIdbSet === 'function') {
        ptfStorageIdbSet('ptf_backup_prerestore', curRaw, function (ok, bytes) {
          try {
            var marker = { storedIn: ok ? 'indexedDB' : 'localStorage', key: 'ptf_backup_prerestore', bytes: bytes || curRaw.length, updatedAt: new Date().toISOString() };
            if (typeof ptfStorageSafeSetItem === 'function') ptfStorageSafeSetItem('ptf_backup_prerestore', JSON.stringify(marker), { noWarn: true });
            else localStorage.setItem('ptf_backup_prerestore', JSON.stringify(marker));
          } catch (eM) {}
        });
      } else localStorage.setItem('ptf_backup_prerestore', curRaw);
    } catch (e) {}
    pushBackup(false, function () {
      /* v33.13.0 (F0-2 — فوریت): بازگردانی با گارد ظرفیت.
         - ابتدا کلیدهای موقت/کش پاک می‌شوند تا فضا آزاد شود.
         - هر کلید با ptfStorageSafeSetItem نوشته می‌شود (در خطای Quota تلاش می‌کند فضا آزاد کند).
         - کلیدهای ناموفق جمع و در پایان گزارش می‌شوند — بازگردانی نیمه‌کارهٔ بی‌صدا دیگر رخ نمی‌دهد. */
      /* v33.16.0 (F2-3): بازگردانی تراکنشی (تمام‌یا-هیچ) با rollback خودکار —
         ابتدا مقادیر قبلی snapshot می‌شوند؛ اگر هر کلیدی نتوانست نوشته شود،
         همه‌چیز به حالت قبل برمی‌گردد (دادهٔ قبلی هرگز نیمه‌کاره نمی‌ماند). */
      var prev = {};
      DATA_KEYS.forEach(function (k) { try { prev[k] = localStorage.getItem(k); } catch (eP) { prev[k] = undefined; } });
      var failedKeys = [];
      DATA_KEYS.forEach(function (k) {
        try { localStorage.removeItem(k); } catch (eR) {}
      });
      Object.keys(j.data).forEach(function (k) {
        if (DATA_KEYS.indexOf(k) === -1) return;
        try {
          if (typeof ptfStorageSafeSetItem === 'function') {
            var ok = ptfStorageSafeSetItem(k, j.data[k], { noWarn: true });
            if (ok === false) failedKeys.push(k);
          } else {
            localStorage.setItem(k, j.data[k]);
          }
        } catch (eW) { failedKeys.push(k); }
      });
      if (failedKeys.length) {
        /* ROLLBACK کامل — دادهٔ قبلی برگردانده می‌شود */
        DATA_KEYS.forEach(function (k) {
          try {
            var old = prev[k];
            if (old === null || old === undefined) { try { localStorage.removeItem(k); } catch (eD) {} }
            else if (typeof ptfStorageSafeSetItem === 'function') ptfStorageSafeSetItem(k, old, { noWarn: true });
            else localStorage.setItem(k, old);
          } catch (eR2) {}
        });
        if (typeof audit === 'function') audit('سیستم', '⛔ بازگردانی ناموفق (ظرفیت حافظه) — دادهٔ قبلی کامل برگردانده شد؛ کلیدهای مشکل‌دار: ' + failedKeys.join('، '), 'RESTORE-FAIL');
        alert('⛔ بازگردانی ناموفق — حافظهٔ محلی ظرفیت دادهٔ این بک‌آپ را نداشت و دادهٔ قبلی شما کامل برگردانده شد.\n\nابتدا از «تنظیمات → حافظه محلی CRM → پاک‌سازی امن فوری» استفاده کنید، سپس دوباره بازگردانی را اجرا کنید.');
        return; /* بدون reload — دادهٔ قبلی سالم است */
      }
      if (typeof audit === 'function') audit('سیستم', 'بازگردانی کامل داده‌ها از بک‌آپ ' + (j.tFa || j.t), 'RESTORE');
      /* ===== v15.0 (US-384 — ریشه «بازگردانی اثر نکرد»): =====
         قبلا فقط localStorage برمی‌گشت ولی فایل‌های سینک سرور (crm/data/sync) دست‌نخورده می‌ماند؛
         ۲۰ ثانیه بعد pull دوره‌ای، همان داده خراب سرور را روی داده بازگردانده می‌ریخت!
         حالا: داده بازگردانده با فلگ restore مستقیم به سرور سینک push می‌شود (سپر داده‌صفر
         آگاهانه برای این مسیر ادمین کنار می‌رود) و شمارنده‌های سینک محلی نو می‌شوند. */
      var syncData = {};
      Object.keys(j.data).forEach(function (k) {
        if (DATA_KEYS.indexOf(k) > -1 && k !== 'ptf_crm_users' && k !== 'ptf_storage_queue') syncData[k] = j.data[k];
      });
      localStorage.removeItem('ptf_guard_counts'); /* baseline نو از داده سالم */
      var finishReload = function (syncFail) {
        alert('✅ بازگردانی انجام شد (محلی + سرور سینک)' + (failedKeys.length ? '\n⚠️ کلیدهایی که به دلیل کمبود حافظه نوشته نشدند: ' + failedKeys.join('، ') + ' — از «بازگردانی» دوباره بعد از پاک‌سازی حافظه اقدام کنید.' : '') + (syncFail ? '\n⚠️ سرور سینک در دسترس نبود — بعد از اتصال، دوباره «بازگردانی» را اجرا کنید.' : '') + '\n(نسخه اضطراری وضعیت قبلی در ptf_backup_prerestore نگهداری شد)');
        location.reload();
      };
      /* F0-3+F0-4: data_push با timeout و refresh توکن در صورت 401 */
      var tryPushServer = function (attempt) {
        backupFetch(API + '?action=data_push', {
          method: 'POST',
          headers: ptfBackupAuthHeaders(true),
          body: JSON.stringify({ by: curSession().name + ' (RESTORE)', restore: true, data: syncData })
        })
          .then(function (d) {
            if (d && d.needLogin && attempt === 0 && typeof window.ptfSyncRefreshAuth === 'function') {
              window.ptfSyncRefreshAuth(function (ok) { if (ok) tryPushServer(1); else finishReload(true); });
              return;
            }
            try {
              if (d && d.rev) localStorage.setItem('ptf_sync_rev', String(d.rev));
              if (d && d.krevs) localStorage.setItem('ptf_sync_krevs', JSON.stringify(d.krevs));
            } catch (e2) {}
            finishReload(false);
          })
          .catch(function () { finishReload(true); });
      };
      tryPushServer(0);
    });
  }

  /* ============ AC3: باکس بک‌آپ در تنظیمات ============ */
  function backupBoxHtml() {
    var last = null;
    try { last = JSON.parse(localStorage.getItem('ptf_backup_last') || 'null'); } catch (e) {}
    return '<hr style="border:none;border-top:1px solid var(--brd);margin:16px 0">' +
      '<h4 style="margin:0 0 8px">🗄 بک‌آپ و بازگردانی</h4>' +
      '<div style="background:#f8fafc;border:1px solid var(--brd);border-radius:12px;padding:12px 14px;font-size:12.5px;margin-bottom:10px">' +
      '⏱ بک‌آپ خودکار <b>هر ۱ ساعت</b> روی سرور و فضای ابری انجام می‌شود (نسخه‌های قدیمی چرخشی و خودکار هرس می‌شوند).<br>' +
      '📥 <b>وظیفه ماهانه:</b> ادمین ابتدای هر ماه یک فایل بک‌آپ را دانلود و خارج از سامانه نگه می‌دارَد (یادآور خودکار در کارتابل می‌آید).<br>' +
      '📌 آخرین بک‌آپ موفق: <b id="bakLast">' + (last ? escP(last.t) + ' (' + (last.mode === 'arvan' ? 'ابری' : 'سرور') + ')' : 'هنوز ثبت نشده') + '</b></div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
      '<button class="bt" onclick="ptfBackupNow()">🗄 بک‌آپ فوری</button>' +
      '<button class="bt bt-o" onclick="ptfBackupDownload()">⬇️ دانلود فایل بک‌آپ</button>' +
      '<button class="bt bt-o" style="color:#0e7490;border-color:#bae6fd" onclick="ptfDownloadMonthly()">📥 دانلود بک‌آپ ماهانه سرور</button>' +
      '<button class="bt bt-o" style="color:#dc2626" onclick="ptfRestorePick()">⏪ بازگردانی از فایل</button>' +
      '<button class="bt bt-o" onclick="ptfServerBackups()">📂 بک‌آپ‌های سرور</button>' +
      ' <button class="bt bt-o" style="color:#b45309;border-color:#fed7aa" onclick="ptfDuplicateRepairOpen()">⚠️ بررسی کدهای تکراری</button>' +
      '</div>' +
      /* v33.22.2: «بررسی اتصال سرور» و «پاک‌سازی زباله‌های ابری» از UI حذف شدند (سردرگمی کاربر) —
         توابعشان (window.ptfBackupServerCheck / ptfBackupServerStatus / ptfPurgeCloudOrphans) دست‌نخورده باقی‌اند. */
      '<div id="ptfBackupConn" style="font-size:12.5px;margin-top:8px"></div>';
  }

  window.ptfServerBackups = function () {
    backupFetch(API + '?action=list_backups', { headers: ptfBackupAuthHeaders(false) })
      .then(function (d) {
        if (!d.ok) { alert('خطا در دریافت فهرست'); return; }
        var list = (d.backups || []).map(function (b) {
          return '<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 10px;border:1px solid var(--brd);border-radius:9px;margin-bottom:5px;font-size:12px">' +
            '<span style="direction:ltr">' + escP(b.name) + ' <small style="color:#94a3b8">(' + Math.round(b.size / 1024) + 'KB — ' + escP(b.t) + ')</small></span>' +
            (curRole() === 'admin' ? '<button class="bt bt-o" style="padding:3px 9px;font-size:11px" onclick="ptfRestoreServer(\'' + ptfOnClickArg(b.name) + '\')">⏪ بازگردانی</button>' : '') + '</div>';
        }).join('') || '<div style="color:#94a3b8;text-align:center;padding:14px;font-size:12.5px">بک‌آپی روی سرور نیست</div>';
        var html = '<div class="md-b" style="display:grid;z-index:70" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:480px">' +
          '<h3>📂 بک‌آپ‌های سرور</h3><div style="font-size:11.5px;color:#64748b;margin-bottom:8px">hourly-latest = آخرین ساعتی | daily-… = ۳ روز اخیر | weekly-latest = هفتگی | monthly-latest = ماهانه (چرخشی US-282 — پسوند .gz یعنی فشرده؛ بازگردانی/دانلود خودکار بازش می‌کند)</div>' + list +
          '<div style="display:flex;justify-content:flex-end;margin-top:8px"><button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">بستن</button></div></div></div>';
        document.getElementById('panels').insertAdjacentHTML('beforeend', html);
      })
      .catch(function () { alert('سرور در دسترس نیست'); });
  };

  window.ptfRestoreServer = function (name) {
    if (curRole() !== 'admin') { alert('⛔ فقط ادمین'); return; }
    backupFetch(API + '?action=get_backup&name=' + encodeURIComponent(name), { headers: ptfBackupAuthHeaders(false) })
      .then(function (j) {
        if (!j || j.app !== 'PTF-CRM') { alert('فایل بک‌آپ معتبر نیست'); return; }
        var mds = document.querySelectorAll('.md-b');
        for (var _mi = mds.length - 1; _mi >= 0; _mi--) { if ((mds[_mi].style || {}).display !== 'none') { mds[_mi].remove(); break; } } /* v16.2 BUG-017 */
        showRestorePreview(j);
      })
      .catch(function () { alert('خطا در دریافت فایل'); });
  };

  /* ============ v31.7.50 STORAGE-QUOTA-FOUNDATION-001: سنجه/هشدار/پاک‌سازی امن ============ */
  function storageUsage() {
    try {
      if (typeof ptfStorageLocalUsage === 'function') return ptfStorageLocalUsage().used;
    } catch (e) {}
    var total = 0;
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i), v = localStorage.getItem(k) || '';
        total += (k.length + v.length) * 2;
      }
    } catch (e2) {}
    return total;
  }
  var STORAGE_LIMIT = 5 * 1024 * 1024; // سقف محافظه‌کارانه localStorage؛ قابل افزایش مستقیم توسط سایت نیست
  function storageHealth() {
    try { if (typeof ptfStorageHealthSync === 'function') return ptfStorageHealthSync(); } catch (e) {}
    var used = storageUsage();
    var pct = Math.min(100, Math.round(used * 100 / STORAGE_LIMIT));
    return { used: used, softLimit: STORAGE_LIMIT, percent: pct, level: pct >= 95 ? 'critical' : (pct >= 85 ? 'danger' : (pct >= 70 ? 'warning' : 'ok')), topKeys: [] };
  }
  function fmtBytes(n) {
    try { if (typeof ptfStorageFormatBytes === 'function') return ptfStorageFormatBytes(n); } catch (e) {}
    n = Number(n) || 0;
    return n >= 1048576 ? (n / 1048576).toFixed(2) + ' MB' : Math.round(n / 1024) + ' KB';
  }

  window.ptfStorageMeterHtml = function () {
    var h = storageHealth();
    var pct = h.percent || 0;
    var color = pct >= 85 ? '#dc2626' : pct >= 70 ? '#d97706' : '#059669';
    var top = (h.topKeys || []).slice(0, 6).map(function (r) {
      return '<div style="display:flex;justify-content:space-between;gap:8px;border-bottom:1px solid #eef2f7;padding:4px 0"><span style="direction:ltr;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:330px">' + escP(r.key) + '</span><b>' + fmtBytes(r.bytes) + '</b></div>';
    }).join('') || '<div style="color:#64748b">اطلاعات کلیدها در دسترس نیست.</div>';
    return '<hr style="border:none;border-top:1px solid var(--brd);margin:16px 0">' +
      '<h4 style="margin:0 0 8px">حافظه محلی CRM</h4>' +
      '<div style="font-size:12px;color:#475569;line-height:1.9;margin-bottom:8px">این فضای کوچکِ کش مرورگر است (سقف حدود ۵MB که از طرف مرورگر تعیین می‌شود). دادهٔ اصلی روی <b>سرور</b> است؛ اگر اینجا پر شد، فقط کش دستگاه شما پر شده — با دکمهٔ پاک‌سازی رفع می‌شود.</div>' +
      '<div style="background:#f1f5f9;border-radius:10px;height:20px;position:relative;overflow:hidden;max-width:520px;border:1px solid #e2e8f0">' +
      '<div style="position:absolute;right:0;top:0;bottom:0;width:' + pct + '%;background:' + color + '"></div>' +
      '<span style="position:absolute;inset:0;display:grid;place-items:center;font-size:11px;font-weight:800;color:#111827">' + pct + '٪ (' + fmtBytes(h.used) + ' از ' + fmtBytes(h.softLimit || STORAGE_LIMIT) + ')</span></div>' +
      (pct >= 85 ? '<div style="color:#b91c1c;font-size:12px;margin-top:6px;font-weight:800">هشدار: حافظه محلی به محدوده خطر رسیده است. ابتدا «🗄 بک‌آپ فوری» و سپس «پاک‌سازی امن فوری» را بزنید.</div>' : (pct >= 70 ? '<div style="color:#b45309;font-size:12px;margin-top:6px">هشدار: حافظه محلی رو به پرشدن است — یک بار «پاک‌سازی امن فوری» را بزنید.</div>' : '')) +
      /* v33.22.2 (ساده‌سازی UI به درخواست کارفرما): توضیح فنی و دکمه‌های مضاعف حذف شد؛
         توابع (ptfStorageMigrateToIdb/ShowLargeKeys/ShowArchiveIndex/RequestPersistent) دست‌نخورده — «پاک‌سازی امن فوری» خودش ابتدا مهاجرت به IndexedDB را هم انجام می‌دهد. */
      '<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap"><button class="bt bt-o" onclick="ptfStorageCleanup()">پاک‌سازی امن فوری</button></div>' +
      /* v33.18.0 (فاز B): فعال‌سازی حالت سرور-محور (کلاینت نازک) + v33.19.0: دکمهٔ پاک‌سازی کش — v33.22.2: متن کوتاه‌تر شد (دیتابیس MySQL هم‌اکنون فعال است) */
      '<div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:12px;padding:10px 12px;margin-top:10px;font-size:12.5px;color:#065f46;line-height:1.9"><b>🌐 حالت سرور-محور</b> — راه‌حل دائمی پر شدن حافظه<br>اگر حافظهٔ این دستگاه پر است یا می‌خواهید داده فقط روی سرور باشد: این گزینه را فعال کنید تا داده از سرور خوانده/نوشته شود و حافظهٔ مرورگر فقط کش شود. سپس با «پاک‌سازی کش محلی» حافظه کاملاً آزاد می‌شود (داده روی سرور می‌ماند).' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">' +
      '<button class="bt" style="background:#059669" onclick="ptfBEnable()">✅ فعال‌سازی</button>' +
      '<button class="bt bt-o" onclick="ptfBConfirmFlush()">🔄 هم‌گرایی دادهٔ محلی</button>' +
      '<button class="bt bt-o" style="color:#b45309" onclick="if(window.ptfBClearLocalCache)ptfBClearLocalCache()">🗑 پاک‌سازی کش محلی</button>' +
      '<button class="bt bt-o" style="color:#dc2626" onclick="ptfBDisable()">⛔ غیرفعال‌سازی</button>' +
      '</div></div>';
  };

  window.ptfStorageCleanup = function () {
    // قبل از پاک‌سازی، بک‌آپ سروری؛ سپس اگر IndexedDB فعال باشد اول archive و بعد compact می‌کنیم.
    pushBackup(false, function () {
      function done(res, label) {
        if (typeof audit === 'function') audit('سیستم', label + ' — آزادسازی حدود ' + fmtBytes((res && res.freed) || 0), '');
        var freed = (res && res.freed) || 0;
        /* v33.14.0: اگر آزادسازی ناچیز بود، علت را صریح بگو (بزرگ‌ترین کلیدها معمولاً دادهٔ اصلی‌اند) */
        var tip = '';
        if (freed < 256 * 1024 && typeof window.ptfStorageTopKeys === 'function') {
          try {
            var tk = window.ptfStorageTopKeys(5) || [];
            tip = '\n\nبزرگ‌ترین کلیدها (اگر از نوع دادهٔ اصلی‌اند، پاک‌سازی امن آن‌ها را حذف نمی‌کند):\n' + tk.map(function (r) { return '• ' + r.key + ' — ' + fmtBytes(r.bytes); }).join('\n') + '\n\nراه‌حل دائمی: در همین صفحه «حالت سرور-محور» را فعال کنید تا داده از سرور خوانده شود و حافظهٔ مرورگر فقط کش بماند.'; /* v33.22.2: MySQL فعال است؛ ارجاع به دکمهٔ حذف‌شده اصلاح شد */
          } catch (eT) {}
        }
        alert(label + ' انجام شد. حدود ' + fmtBytes(freed) + ' از localStorage آزاد شد. رکوردهای اصلی کسب‌وکاری حذف نشدند.' + tip);
        if (typeof goPanelByName === 'function') goPanelByName('set');
      }
      if (typeof ptfStorageMigrateVolatileToIdb === 'function') {
        ptfStorageMigrateVolatileToIdb({ source: 'manual-cleanup', toast: true, fallbackCompact: true }, function (res) { done(res, 'مهاجرت/پاک‌سازی امن'); });
      } else if (typeof ptfStorageEmergencyCompact === 'function') done(ptfStorageEmergencyCompact({ source: 'manual', toast: true }), 'پاک‌سازی امن');
      else {
        var beforeAll = storageUsage();
        var cutoff = new Date(Date.now() - 90 * 86400000).toISOString();
        var notifs = getData('ptf_crm_notifs');
        notifs = notifs.filter(function (n, i) { if (i < 100) return true; var read = (n.readBy || []).length > 0; return !(read && (n.iso || '') < cutoff); });
        setData('ptf_crm_notifs', notifs);
        var logs = getData('ptf_crm_audit');
        if (logs.length > 1000) setData('ptf_crm_audit', logs.slice(0, 1000));
        setData('ptf_crm_sendqueue', getData('ptf_crm_sendqueue').filter(function (x) { return x.st !== 'sent'; }));
        done({ freed: Math.max(0, beforeAll - storageUsage()) }, 'پاک‌سازی امن');
      }
    });
  };

  window.ptfStorageMigrateToIdb = function () {
    pushBackup(false, function () {
      if (typeof ptfStorageMigrateVolatileToIdb !== 'function') { alert('موتور مهاجرت IndexedDB در این مرورگر/نسخه در دسترس نیست.'); return; }
      ptfStorageMigrateVolatileToIdb({ source: 'manual-idb', toast: true, fallbackCompact: false }, function (res) {
        alert('مهاجرت امن به IndexedDB انجام شد. آرشیو: ' + fmtBytes((res && res.archivedBytes) || 0) + ' — آزادسازی localStorage: ' + fmtBytes((res && res.freed) || 0) + '. رکوردهای اصلی کسب‌وکاری حذف نشدند.');
        if (typeof goPanelByName === 'function') goPanelByName('set');
      });
    });
  };

  // هشدار خودکار هنگام ورود اگر >85٪
  function checkStorageWarn() {
    try {
      var h = storageHealth();
      if (h.percent >= 85 && typeof notify === 'function') {
        var last = localStorage.getItem('ptf_storage_warned') || '';
        var today = new Date().toISOString().slice(0, 10);
        if (last !== today) {
          if (typeof ptfStorageSafeSetItem === 'function') ptfStorageSafeSetItem('ptf_storage_warned', today, { noWarn: true });
          else localStorage.setItem('ptf_storage_warned', today);
          notify({ toRoles: ['admin', 'chairman'], title: 'حافظه محلی CRM بیش از ۸۵٪ پر است — از تنظیمات، بک‌آپ و پاک‌سازی امن را اجرا کنید', kind: 'system', channels: ['cart'], link: { panel: 'set' } });
        }
      }
    } catch (e) {}
  }

  // تزریق باکس بک‌آپ و Storage Health در تنظیمات
  var _buildSettings = window.buildSettings;
  if (_buildSettings) {
    window.buildSettings = function () {
      return _buildSettings() + '<div style="max-width:620px">' + backupBoxHtml() + ptfStorageMeterHtml() + '</div>';
    };
  }

  /* ============ US-147: اختیارات ادمین ============ */
  // AC1/AC2: بازگشت CO برنده به وضعیت قبل + حذف پرونده خودکار
  window.adminUnwin = function (no) {
    if (curRole() !== 'admin') { alert('⛔ فقط ادمین می‌تواند وضعیت «برنده» را بازگرداند'); return; }
    var offers = getData('ptf_crm_offers');
    var o = offers.filter(function (x) { return x.no === no; })[0];
    if (!o || o.st !== 'won') return;
    var prj = getData('ptf_crm_projects').filter(function (p) { return p.offerNo === no; })[0];
    var msg = '⚠️ بازگشت ' + no + ' از وضعیت «برنده»:\n' +
      '• وضعیت به «ارسال‌شده» برمی‌گردد و قفل باز می‌شود\n' +
      (prj ? '• پرونده خودکار ' + prj.no + (prj.auto ? '' : ' (دستی!)') + ' به همراه مدارک سیستمی آن حذف می‌شود\n' : '') +
      (o.invRef ? '• ارجاع فاکتور این CO نیز لغو می‌شود\n' : '') +
      '\nادامه می‌دهید؟';
    if (!confirm(msg)) return;
    o.st = 'sent';
    delete o.wonAt; delete o.wonBy; delete o.invRef;
    setData('ptf_crm_offers', offers);
    if (prj) {
      setData('ptf_crm_projects', getData('ptf_crm_projects').filter(function (p) { return p.no !== prj.no; }));
      audit('پرونده پروژه', 'حذف پرونده ' + prj.no + ' در پی بازگشت از برنده (ادمین)', prj.no);
    }
    audit('پیشنهادها', 'بازگشت از وضعیت برنده توسط ادمین', no);
    addLog('⏪ ' + no + ' از برنده بازگردانده شد (ادمین)');
    if (typeof notify === 'function') notify({ toRoles: SENIOR_ROLES, title: '⏪ پیشنهاد ' + no + ' توسط ادمین از وضعیت برنده بازگردانده شد' + (prj ? ' و پرونده ' + prj.no + ' حذف شد' : ''), kind: 'admin', channels: ['cart'], link: { panel: 'off' } });
    renderOffers();
  };

  // AC3: حذف ادمینی رکوردهای قفل‌شده — دکمه در رندر پیشنهادها اضافه می‌شود
  var _renderOffers = window.renderOffers;
  window.renderOffers = function () {
    _renderOffers();
    if (curRole() !== 'admin') return;
    // افزودن دکمه بازگشت/حذف برای ردیف‌های برنده (بعد از رندر پایه)
    var tb = document.getElementById('oTb');
    if (!tb) return;
    var offers = getData('ptf_crm_offers');
    var rows = tb.querySelectorAll('tr');
    rows.forEach(function (tr) {
      var noCell = tr.querySelector('td strong');
      if (!noCell) return;
      var no = noCell.textContent.trim();
      var o = offers.filter(function (x) { return x.no === no; })[0];
      if (o && o.st === 'won' && !tr.querySelector('.adm-unwin')) {
        var td = tr.querySelectorAll('td');
        var last = td[td.length - 1];
        last.insertAdjacentHTML('beforeend',
          ' <button class="bt bt-o adm-unwin" style="padding:4px 9px;font-size:12px;color:#dc2626" title="فقط ادمین: بازگشت از برنده + حذف پرونده خودکار" onclick="adminUnwin(\'' + ptfOnClickArg(no) + '\')">⏪ بازگشت</button>' +
          ' <button class="bt bt-o adm-unwin" style="padding:4px 9px;font-size:12px;color:#dc2626" onclick="adminDelOffer(\'' + ptfOnClickArg(no) + '\')">🗑️</button>');
      }
    });
  };

  window.adminDelOffer = function (no) {
    if (curRole() !== 'admin') { alert('⛔ فقط ادمین'); return; }
    if (!confirm('⚠️ حذف ادمینی پیشنهاد قفل‌شده ' + no + '؟\nپرونده خودکار مرتبط نیز حذف می‌شود.')) return;
    var prj = getData('ptf_crm_projects').filter(function (p) { return p.offerNo === no; })[0];
    if (prj) setData('ptf_crm_projects', getData('ptf_crm_projects').filter(function (p) { return p.no !== prj.no; }));
    setData('ptf_crm_offers', getData('ptf_crm_offers').filter(function (o) { return o.no !== no; }));
    audit('پیشنهادها', 'حذف ادمینی پیشنهاد برنده' + (prj ? ' + پرونده ' + prj.no : ''), no);
    renderOffers();
  };

  /* ============ شروع ============ */
  var tries = 0;
  var t = setInterval(function () {
    tries++;
    var vis = document.getElementById('crmL') && document.getElementById('crmL').style.display !== 'none';
    if (vis) { scheduleBackups(); checkStorageWarn(); checkMonthlyBackupReminder(); clearInterval(t); }
    if (tries > 60) clearInterval(t);
  }, 500);
  var _showCrm = window.showCrm;
  if (_showCrm) {
    window.showCrm = function () { _showCrm(); setTimeout(function () { scheduleBackups(); checkStorageWarn(); checkMonthlyBackupReminder(); }, 1000); };
  }
})();
