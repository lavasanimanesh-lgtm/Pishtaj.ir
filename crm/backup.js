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
    try { h['X-CRM-Role'] = curRole(); var t = (typeof ptfAuthToken === 'function' ? ptfAuthToken() : ''); if (t) h['X-CRM-Token'] = t; } catch (e) {}
    return h;
  }
  function canRestoreBackup() { try { return ['admin','chairman'].indexOf(curRole()) > -1; } catch (e) { return false; } }
  window.ptfCanRestoreBackup = canRestoreBackup;

  /* ═════════ v34.38.9 (BACKUP-BLIND-SPOT — ریشهٔ «دکمهٔ بازیابی تماس‌ها چیزی پیدا نمی‌کند») ═════════
     RCA: از فاز B (client-server.js v34.8.9 STORAGE-INDEPENDENCE) هر کلید کسب‌وکاریِ
     بزرگ‌تر از ۸KB با ptfBOffloadBusinessKeysToIdb/ptfBMirror به IndexedDB منتقل و
     «از localStorage حذف» می‌شود (localStorage.removeItem داخل ptfBMirror).
     اما این ماژول همچنان مستقیماً localStorage.getItem می‌خواند؛ نتیجه:
       ① collectBackup آن کلید را اصلاً در payload نمی‌گذارد (v === null → return)
          → بک‌آپ‌های چرخشی سرور «هیچ مشتری/پیشنهاد/فاکتوری» ندارند.
       ② ptfBackupDeltaCollect همان کلید را با مقدار null در دلتا می‌فرستد و سرور
          data[k] = null می‌کند → آخرین بک‌آپ کاملِ پایه هم مسموم می‌شود.
     هر دو در سکوت رخ می‌دادند (پاسخ ok=true). درمان: خواندن از «آینهٔ فاز B» و در
     نبود آن، localStorage و در نهایت getData (کش/آینه/سرور-محور). */
  function bkRead(k) {
    var v = null;
    try {
      if (typeof window.ptfBRead === 'function') {
        var m = window.ptfBRead(k);
        if (m !== null && m !== undefined && m !== '') return String(m);
      }
    } catch (e) {}
    try { v = localStorage.getItem(k); } catch (e2) { v = null; }
    if (v !== null && v !== undefined) return v;
    /* آخرین سنگر: لایهٔ دادهٔ استاندارد (getData در فاز B از آینه/کش می‌خواند).
       فقط دادهٔ واقعیِ غیرخالی برمی‌گردد تا کلیدِ هرگز-نساخته وارد بک‌آپ نشود. */
    try {
      if (typeof window.getData === 'function') {
        var d = window.getData(k);
        if (Array.isArray(d)) { if (d.length) return JSON.stringify(d); }
        else if (d && typeof d === 'object' && Object.keys(d).length) return JSON.stringify(d);
      }
    } catch (e3) {}
    return null;
  }
  window.ptfBackupReadKey = bkRead;
  /* آینهٔ فاز B هنوز از IndexedDB آب‌رسانی نشده = هیچ‌کدام از کلیدهای سنگین در دست
     نیست. در این پنجره بک‌آپ گرفتن یعنی ثبت یک «تصویر کور». عمداً به تعویق می‌افتد. */
  function mirrorPending() {
    try {
      return !!(typeof window.ptfBMirrorActive === 'function' && window.ptfBMirrorActive() && !window.ptfBIdbHydrated);
    } catch (e) { return false; }
  }
  window.ptfBackupMirrorPending = mirrorPending;
  /* سپر پوشش: بک‌آپی که کلیدهای حیاتیِ «موجود روی دستگاه» را ندارد نباید ارسال شود. */
  var BACKUP_CRITICAL_KEYS = ['ptf_crm_customers', 'ptf_crm_suppliers', 'ptf_crm_rfqs', 'ptf_crm_offers', 'ptf_crm_invoices'];
  function backupCoverageGap(data) {
    var gap = [];
    BACKUP_CRITICAL_KEYS.forEach(function (k) {
      if (data && data[k] != null) return;
      try {
        var d = (typeof window.getData === 'function') ? window.getData(k) : null;
        if (Array.isArray(d) && d.length) gap.push(k);
      } catch (e) {}
    });
    return gap;
  }
  window.ptfBackupCoverageGap = backupCoverageGap;

  function mountModal(html) {
    /* مهم: مودال‌ها را به document.body اضافه می‌کنیم نه #panels.
       settings-accordion.js یک MutationObserver روی #panels دارد که هنگام
       افزوده‌شدن فرزند، کل پنل تنظیمات را rebuild می‌کند و این کار هم
       آکاردئون را می‌بندد و هم مودال را از DOM پاک می‌کرد (باگ «فقط منو
       بسته می‌شود و هیچ اتفاقی نمی‌افتد»). */
    var host = document.body || document.getElementById('panels');
    var wrap = document.createElement('div');
    wrap.setAttribute('data-ptf-modal-host', '1');
    wrap.innerHTML = html;
    while (wrap.firstChild) host.appendChild(wrap.firstChild);
  }
  document.addEventListener('click', function (ev) {
    var t = ev.target;
    if (!t || t.nodeType !== 1) return;
    /* وقتی روی پس‌زمینه کلیک شد (همان المان .md-b) آن را ببند؛
       کلیک روی دکمه‌ها/محتوای درون مودال نباید باعث بسته‌شدن شود. */
    if (t.classList && t.classList.contains('md-b')) t.remove();
  });
  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape') {
      var open = document.querySelectorAll('.md-b');
      if (open.length) open[open.length - 1].remove();
    }
  });



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
    'ptf_crm_order_prices', 'ptf_crm_notifprefs', 'ptf_crm_trash', 'ptf_crm_smsbook', 'ptf_crm_rfqsmart', 'ptf_crm_petty', 'ptf_crm_petty_tx', 'ptf_crm_petty_periods', 'ptf_crm_shareholders', 'ptf_crm_sharetx', 'ptf_crm_fiscal_snapshots', 'ptf_crm_techcases', 'ptf_crm_calc_runs', 'ptf_crm_techproposals', 'ptf_crm_leadfinder_jobs', 'ptf_crm_leadfinder_sources','ptf_crm_management_actions','ptf_crm_management_reports','ptf_crm_commission_records', 'ptf_crm_perms', 'ptf_crm_avatars', 'ptf_crm_buycmp', 'ptf_crm_inqreads', 'ptf_crm_cheques_issued', 'ptf_crm_cheques_received', 'ptf_crm_cheque_books', 'ptf_crm_msgtpls', 'ptf_crm_deleted_archive', 'ptf_crm_tax_returns', 'ptf_crm_sales_returns', 'ptf_crm_payables', 'ptf_crm_supplier_finance', 'ptf_crm_opex', 'ptf_crm_treasury_calls', 'ptf_crm_fin_events', 'ptf_crm_bank_recon', 'ptf_crm_case_receipts', 'ptf_crm_receipt_allocations', 'ptf_crm_fin_attachments', 'ptf_crm_corrections', 'ptf_crm_fin_findings' /* v34.5.11: ژورنال مالی append-only و خزانه — قبلاً از بکاپ جا مانده بودند (tester173) */
  ];

  /* v33.13.0 (F0-6): کاهش حجم payload — کلیدهای لاگ/اعلان در بکاپ به N رکورد آخر محدود
     می‌شوند (دادهٔ کامل در localStorage محفوظ است؛ بکاپ فقط برای بازگردانی/بایگانی). */
  var PAYLOAD_CAPS = { 'ptf_crm_audit': 1000, 'ptf_crm_notifs': 500 };

  function collectBackup() {
    var data = {};
    DATA_KEYS.forEach(function (k) {
      /* v34.38.9: خواندن از آینهٔ فاز B (نه فقط localStorage) — وگرنه کلیدهای
         offloadشده (مشتریان، پیشنهادها، فاکتورها…) بی‌صدا از بک‌آپ حذف می‌شدند. */
      var v = bkRead(k);
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
      .then(function (r) {
        if (r && typeof r.text === 'function') return r.text().then(function (txt) {
          var d = null; try { d = JSON.parse(txt); } catch (e) { throw new Error('پاسخ نامعتبر بک‌آپ (HTTP ' + r.status + '): ' + txt.slice(0, 180)); }
          if (d && typeof d === 'object') d._httpStatus = r.status;
          return d;
        });
        /* سازگاری با WebView/تسترهای قدیمی که فقط response.json دارند. */
        if (r && typeof r.json === 'function') return r.json().then(function(d){if(d&&typeof d==='object')d._httpStatus=r.status||200;return d;});
        throw new Error('پاسخ خالی بک‌آپ');
      })
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
    /* v34.38.9 (BACKUP-BLIND-SPOT): تصویر کور نفرست. */
    if (mirrorPending()) {
      if (manual) alert('⏳ آینهٔ داده هنوز از IndexedDB بارگذاری نشده است. چند ثانیه بعد دوباره «بک‌آپ فوری» را بزنید تا تصویر کامل ثبت شود.');
      cb && cb({ ok: false, error: 'mirror_not_hydrated', deferred: true });
      return;
    }
    var payload = collectBackup();
    var gap = backupCoverageGap(payload.data);
    if (gap.length) {
      try { console.error('[PTF] بک‌آپ ناقص متوقف شد — کلیدهای حیاتیِ غایب:', gap); } catch (eC) {}
      try { if (typeof audit === 'function') audit('یکپارچگی داده', '⛔ ارسال بک‌آپ متوقف شد چون کلیدهای حیاتی در تصویر نبودند: ' + gap.join('، '), 'BACKUP'); } catch (eA) {}
      if (manual) alert('⛔ بک‌آپ ارسال نشد: دادهٔ این کلیدها روی دستگاه هست ولی در تصویر بک‌آپ نیامد — ' + gap.join('، ') + '\n(برای جلوگیری از جایگزینی بک‌آپ سالم با نسخهٔ ناقص متوقف شد.)');
      cb && cb({ ok: false, error: 'coverage_gap', gap: gap });
      return;
    }
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
      if (q2.length !== q.length) { if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection('ptf_crm_sendqueue', q2, { reason: 'w4' }); else setData('ptf_crm_sendqueue', q2); changed = true; }
      /* wfLog: حداکثر ۵۰ رویداد per درخواست */
      var rfqs = getData('ptf_crm_rfqs');
      var wfCut = false;
      rfqs.forEach(function (r) {
        if (r.wfLog && r.wfLog.length > 50) { r.wfLog = r.wfLog.slice(-50); wfCut = true; }
      });
      if (wfCut) { if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection('ptf_crm_rfqs', rfqs, { reason: 'w2' }); else setData('ptf_crm_rfqs', rfqs); changed = true; }
      if (changed && typeof addLog === 'function') addLog('هرس دوره‌ای صف‌ها انجام شد (US-263)');
    } catch (e) {}
  }

  /* ============ v33.15.0 — فاز ۱: بکاپ هوشمند + بررسی اتصال سرور ============ */

  /* F1-1: بررسی وضعیت اتصال/توکن سرور (پینگ سبک users_get — اکشن عمومی)
     v34.7.91 (SYNC-DIAG-001): اگر ماژول همگام‌سازی موجود باشد، اول تست دقیق با
     data_rev (محافظت‌شده) انجام می‌شود تا «معتبر بودن نشست» هم تأیید شود؛ در غیر
     این صورت همان مسیر قدیمی users_get به‌عنوان fallback حفظ می‌شود. */
  window.ptfBackupServerStatus = function (cb) {
    if (typeof window.ptfSyncServerStatus === 'function') {
      window.ptfSyncServerStatus(cb);
      return;
    }
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
        var v = bkRead(k); /* v34.38.9: آینهٔ فاز B — امضا باید کل داده را ببیند */
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
      try { o[k] = hashString(bkRead(k)); } catch (e) {}
    });
    deltaSaveSigs(o);
  }
  /* جمع‌آوری دلتا: فقط کلیدهایی که امضای per-key‌شان تغییر کرده (یا امضایی ندارند) */
  window.ptfBackupDeltaCollect = function () {
    var sigs = deltaSigs();
    var delta = {}, changed = [], missing = [];
    DATA_KEYS.forEach(function (k) {
      var v = bkRead(k); /* v34.38.9: آینهٔ فاز B */
      /* v34.38.9 (BACKUP-BLIND-SPOT ②): کلید بدون مقدار هرگز در دلتا نرود.
         قبلاً delta[k] = null ارسال می‌شد و سرور data[k] = null می‌کرد — یعنی
         آخرین بک‌آپ کاملِ پایه هم همان کلید را از دست می‌داد. «نبودِ کلید» یعنی
         «چیزی برای گفتن ندارم»، نه «پاکش کن». */
      if (v === null || v === undefined) { missing.push(k); return; }
      var cur = hashString(v);
      if (sigs[k] !== cur) { delta[k] = v; changed.push(k); }
    });
    return { delta: delta, changed: changed, missing: missing };
  };
  /* ارسال دلتا به سرور؛ اگر سرور بکاپ پایه نداشت → fallback به بکاپ کامل */
  function pushBackupDelta(manual, cb) {
    if (mirrorPending()) {
      if (manual) alert('⏳ آینهٔ داده هنوز بارگذاری نشده است — بک‌آپ دلتا به تعویق افتاد تا تصویر ناقص ثبت نشود.');
      cb && cb({ ok: false, error: 'mirror_not_hydrated', deferred: true });
      return;
    }
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
      if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection('ptf_crm_settings', st, { reason: 'w4' }); else setData('ptf_crm_settings', st);
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
      if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection('ptf_crm_settings', st, { reason: 'w4' }); else setData('ptf_crm_settings', st);
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
    if (!canRestoreBackup()) { alert('⛔ بازگردانی اطلاعات فقط توسط ادمین یا رئیس هیئت‌مدیره ممکن است'); return; }
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
    function backupRows(key){try{var v=JSON.parse((j.data||{})[key]||'[]');return Array.isArray(v)?v:[];}catch(e){return[];}}
    var dealCount=backupRows('ptf_crm_deals').length,projectCount=backupRows('ptf_crm_projects').length,offerCount=backupRows('ptf_crm_offers').length;
    var rows = Object.keys(j.counts || {}).map(function (k) {
      var lb = k.replace('ptf_crm_', '').replace('ptf_storage_', 'storage-');
      return '<tr><td style="font-size:11.5px;direction:ltr">' + escP(lb) + '</td><td>' + j.counts[k] + '</td></tr>';
    }).join('');
    var html = '<div class="md-b" style="display:grid;z-index:70" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:520px;max-height:90vh;overflow:auto">' +
      '<h3>⏪ پیش‌نمایش بازگردانی</h3>' +
      '<div style="background:#eff6ff;border:1px solid #93c5fd;border-radius:12px;padding:9px 12px;font-size:12px;margin-bottom:9px"><b>نسخه انتخابی:</b> ' + escP(j.tFa || j.t || 'بدون تاریخ') + '<br>پرونده فعال: <b>' + dealCount.toLocaleString('fa-IR') + '</b> | بایگانی: <b>' + projectCount.toLocaleString('fa-IR') + '</b> | پیشنهاد: <b>' + offerCount.toLocaleString('fa-IR') + '</b></div>' +
      '<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:10px 14px;font-size:12.5px;color:#b91c1c;margin-bottom:10px">' +
      '⚠️ با بازگردانی، <b>تمام داده‌های فعلی جایگزین</b> می‌شوند و هر تغییری بعد از تاریخ این بک‌آپ از بین می‌رود.<br>' +
      'قبل از جایگزینی، یک بک‌آپ اضطراری خودکار از وضعیت فعلی گرفته می‌شود.</div>' +
      '<div style="font-size:13px;margin-bottom:8px">📅 تاریخ بک‌آپ: <b>' + escP(j.tFa || j.t) + '</b> | ثبت‌کننده: ' + escP(j.by || '?') + '</div>' +
      '<div class="tb2" style="max-height:220px;overflow:auto"><table><thead><tr><th>بخش</th><th>تعداد رکورد</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">' +
      '<button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">انصراف</button>' +
      '<button class="bt" style="background:#dc2626" id="restoreGo">⏪ تایید و بازگردانی</button></div></div></div>';
    mountModal(html);
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
    /* وضعیت فعلی در ptf_backup_prerestore ذخیره شد؛ هنگام حادثه نباید با ارسال
       همان وضعیت خراب، hourly/daily سالم سرور را درست قبل از restore بازنویسی کنیم. */
    (function () {
      /* v33.13.0 (F0-2 — فوریت): بازگردانی با گارد ظرفیت.
         - ابتدا کلیدهای موقت/کش پاک می‌شوند تا فضا آزاد شود.
         - هر کلید با ptfStorageSafeSetItem نوشته می‌شود (در خطای Quota تلاش می‌کند فضا آزاد کند).
         - کلیدهای ناموفق جمع و در پایان گزارش می‌شوند — بازگردانی نیمه‌کارهٔ بی‌صدا دیگر رخ نمی‌دهد. */
      /* v33.16.0 (F2-3): بازگردانی تراکنشی (تمام‌یا-هیچ) با rollback خودکار —
         ابتدا مقادیر قبلی snapshot می‌شوند؛ اگر هر کلیدی نتوانست نوشته شود،
         همه‌چیز به حالت قبل برمی‌گردد (دادهٔ قبلی هرگز نیمه‌کاره نمی‌ماند). */
      var prev = {};
      DATA_KEYS.forEach(function (k) { try { prev[k] = localStorage.getItem(k); } catch (eP) { prev[k] = undefined; } });
      function restorePreviousLocal() {
        DATA_KEYS.forEach(function (k) { try { var old=prev[k]; if(old===null||old===undefined)localStorage.removeItem(k); else if(typeof ptfStorageSafeSetItem==='function')ptfStorageSafeSetItem(k,old,{noWarn:true}); else localStorage.setItem(k,old); } catch(e){} });
      }
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
              window.ptfSyncRefreshAuth(function (ok) { if (ok) tryPushServer(1); else { restorePreviousLocal(); alert('⛔ نشست سرور تمدید نشد؛ بازگردانی انجام نشد و داده قبل از عملیات حفظ شد.'); } });
              return;
            }
            if (!d || !d.ok) throw new Error((d && d.error) || 'server_restore_rejected');
            try {
              if (d.rev) localStorage.setItem('ptf_sync_rev', String(d.rev));
              if (d.krevs) localStorage.setItem('ptf_sync_krevs', JSON.stringify(d.krevs));
            } catch (e2) {}
            finishReload(false);
          })
          .catch(function (e) { restorePreviousLocal(); alert('⛔ بازگردانی روی سرور ثبت نشد؛ داده محلی به وضعیت قبل برگشت.\n' + (e && e.message ? e.message : 'خطای سرور')); });
      };
      tryPushServer(0);
    })();
  }

  /* ============ AC3 / US-282: باکس بک‌آپ چرخشی در تنظیمات ============ */
  function backupBoxHtml() {
    var last = null;
    try { last = JSON.parse(localStorage.getItem('ptf_backup_last') || 'null'); } catch (e) {}
    return '<hr style="border:none;border-top:1px solid var(--brd);margin:16px 0">' +
      '<h4 style="margin:0 0 8px">🗄 بک‌آپ و بازگردانی + وضعیت دستگاه</h4>' + /* v34.9.2: عنوان ردیف گویا (پین تستر8 حفظ شد) */
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
      /* v34.38.13 (RECORD-RECOVERY): بازگرداندن رکوردهای غایب یک مجموعه از بک‌آپ — فقط افزایشی */
      '<button class="bt bt-o" style="color:#047857;border-color:#a7f3d0" onclick="ptfOpenRecordRecovery()" title="بازگرداندن رکوردهایی که در سامانه نیستند ولی در بک‌آپ‌های سرور هستند (بدون حذف/ویرایش رکوردهای فعلی)">🛟 بازیابی رکوردهای گم‌شده</button>' +
      ' <button class="bt bt-o" style="color:#b45309;border-color:#fed7aa" onclick="ptfDuplicateRepairOpen()">⚠️ بررسی کدهای تکراری</button>' +
      '</div>' +
      /* v33.22.2: «بررسی اتصال سرور» و «پاک‌سازی زباله‌های ابری» از UI حذف شدند (سردرگمی کاربر) —
         توابعشان (window.ptfBackupServerCheck / ptfBackupServerStatus / ptfPurgeCloudOrphans) دست‌نخورده باقی‌اند. */
      '<div id="ptfBackupConn" style="font-size:12.5px;margin-top:8px"></div>';
  }

  window.ptfServerBackups = function () {
    document.querySelectorAll('#ptfServerBackupsDlg').forEach(function(x){x.remove();});
    var loading='<div class="md-b" id="ptfServerBackupsDlg" style="display:grid;z-index:3700"><div class="md" style="max-width:620px"><h3>📂 بک‌آپ‌های سرور</h3><div id="ptfServerBackupsBody" style="padding:22px;text-align:center">در حال دریافت فهرست از سرور…</div></div></div>';
    mountModal(loading);
    backupFetch(API + '?action=list_backups', { headers: ptfBackupAuthHeaders(false) })
      .then(function (d) {
        if (!d || !d.ok) throw new Error((d&&d.error)||'خطا در دریافت فهرست');
        var list = (d.backups || []).map(function (b) {
          return '<div class="server-backup-row" style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:9px 10px;border:1px solid var(--brd);border-radius:9px;margin-bottom:6px;font-size:12px">' +
            '<span style="direction:ltr;min-width:0;overflow-wrap:anywhere">' + escP(b.name) + ' <small style="color:#94a3b8">(' + Math.round(b.size / 1024) + 'KB — ' + escP(b.t) + ')</small></span>' +
            (canRestoreBackup() ? '<button class="bt bt-o" style="padding:5px 9px;font-size:11px;flex:none" onclick="ptfRestoreServer(\'' + ptfOnClickArg(b.name) + '\')">⏪ بازگردانی</button>' : '<small style="color:#b45309">فقط ادمین/رئیس</small>') + '</div>';
        }).join('') || '<div style="color:#94a3b8;text-align:center;padding:14px;font-size:12.5px">بک‌آپی روی سرور نیست</div>';
        var body=document.getElementById('ptfServerBackupsBody');if(body)body.innerHTML='<div style="font-size:11.5px;color:#64748b;margin-bottom:8px">جدیدترین نسخه بالاست. برای حادثه حذف، نسخه‌ای را انتخاب کنید که زمان آن دقیقاً قبل از حذف بوده است؛ hourly-latest ممکن است بعد از حادثه بازنویسی شده باشد.</div>'+list+'<div style="display:flex;justify-content:flex-end;margin-top:8px"><button class="bt bt-o" onclick="document.getElementById(\'ptfServerBackupsDlg\').remove()">✕ بستن</button></div>';
      })
      .catch(function (e) { var body=document.getElementById('ptfServerBackupsBody');if(body)body.innerHTML='<div style="color:#b91c1c">⛔ '+escP(e&&e.message?e.message:'سرور در دسترس نیست')+'</div><button class="bt bt-o" style="margin-top:8px" onclick="ptfServerBackups()">🔄 تلاش دوباره</button>'; });
  };

  window.ptfRestoreServer = function (name) {
    if (!canRestoreBackup()) { alert('⛔ بازگردانی فقط برای ادمین یا رئیس هیئت‌مدیره مجاز است'); return; }
    backupFetch(API + '?action=get_backup&name=' + encodeURIComponent(name), { headers: ptfBackupAuthHeaders(false) })
      .then(function (j) {
        if (j && j.ok === false) { alert('⛔ دریافت بک‌آپ رد شد: ' + (j.error || 'خطای دسترسی')); return; }
        if (!j || j.app !== 'PTF-CRM') { alert('فایل بک‌آپ معتبر نیست'); return; }
        var listDlg=document.getElementById('ptfServerBackupsDlg');if(listDlg)listDlg.remove();
        showRestorePreview(j);
      })
      .catch(function (e) { alert('⛔ خطا در دریافت فایل بک‌آپ: ' + (e && e.message ? e.message : 'نامشخص')); });
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
      /* v34.8.51 (PRE-PROD): جعبهٔ وضعیت دستگاه جایگزین دکمه‌های خاموش/روشن قدیمی —
         معماری فعلی سرور-محور است؛ تنها کار معنادارِ کاربر در این جعبه:
         (الف) دستگاه منتقل‌نشده → «انتقال یک‌باره» (همگرایی = همان مسیر مهاجرت
         پروداکشن)، (ب) دستگاه منتقل‌شده → پاک‌سازی کش. دکمه‌های «فعال‌سازی»/
         «غیرفعال‌سازی» از UI حذف شدند: فعال‌سازیِ بدون همگرایی برای دستگاه دارای
         دادهٔ قدیمی ناامن بود و بازگشت به موتور legacy با حذف آن در v34.9.1
         ناسازگار می‌شد (توابع ptfBEnable/ptfBDisable برای سازگاری ابزارها باقی‌اند). */
      (function () {
        var st = (typeof window.ptfBStatus === 'function') ? (window.ptfBStatus() || {}) : {};
        /* v34.9.1 (TRAP-FIX): حالت «سبزِ ناتمام» (enabled && !synced — فعال‌شده با دکمهٔ قدیمی)
           دکمهٔ «تکمیل انتقال» می‌گیرد؛ پیش از این جعبه سبز بود و هیچ در نجات نداشت. */
        var on = !!st.enabled, synced = !!st.synced, qN = st.queue || 0;
        var green = on && synced;
        var h2 = '<div style="border-radius:12px;padding:10px 12px;margin-top:10px;font-size:12.5px;line-height:1.9;border:1px solid ' + (green ? '#a7f3d0' : '#fde68a') + ';background:' + (green ? '#ecfdf5' : '#fffbeb') + ';color:' + (green ? '#065f46' : '#92400e') + '">' +
          '<b>' + (green ? '🖥 وضعیت دستگاه: سرور-محور فعال' : (on ? '🖥 وضعیت دستگاه: فعال — در انتظار تکمیل انتقال' : '🖥 وضعیت دستگاه: در انتظار انتقال یک‌باره')) + '</b><br>';
        if (green) {
          h2 += 'دادهٔ اصلی این سامانه روی <b>سرور</b> است و حافظهٔ مرورگر فقط کش است. نیازی به هیچ تنظیمی نیست.' +
            (qN > 0 ? '<br>⏳ ' + qN + ' تغییر در صف آفلاین است و با اتصال پایدار خودکار ارسال می‌شود.' : '');
        } else if (on) {
          h2 += 'حالت سرور-محور روشن شده اما «انتقال یک‌باره» هنوز کامل نشده است؛ تا تکمیل آن، دادهٔ سنگین در همین حافظهٔ کوچک می‌ماند و مرورگر پر می‌شود. تکمیل انتقال چند دقیقه با اینترنت پایدار طول می‌کشد و دادهٔ محلی در تمام مراحل محفوظ می‌ماند.';
        } else {
          h2 += 'داده‌های این دستگاه هنوز یک‌بار به سرور منتقل نشده است (حالت قدیمی). این انتقال <b>یک‌بار برای هر دستگاه</b> لازم است و چند دقیقه با اینترنت پایدار طول می‌کشد؛ دادهٔ محلی شما در تمام مراحل محفوظ می‌ماند.';
        }
        h2 += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">' +
          (green
            ? '<button class="bt bt-o" style="color:#b45309" onclick="if(window.ptfBClearLocalCache)ptfBClearLocalCache()">🗑 پاک‌سازی کش محلی</button>'
            : '<button class="bt" style="background:#059669" onclick="ptfBConfirmFlush()">⬆️ ' + (on ? 'تکمیل انتقال یک‌باره' : 'انتقال یک‌بارهٔ داده‌های این دستگاه') + '</button><span style="align-self:center;font-size:11.5px">پس از انتقال، «پاک‌سازی کش محلی» برای آزادسازی حافظه در دسترس می‌شود.</span>') +
          '</div>';
        /* v34.9.1 (TRANSPARENCY): کلیدهای در انتظار ارسال با سن — بدون کنسول؛
           «رها کردن امن» فقط برای کلیدهای لاگ/اعلان با مرجع سروری (union-merge). */
        try {
          var dInfo = (typeof window.ptfSyncDirtyInfo === 'function') ? (window.ptfSyncDirtyInfo() || []) : [];
          if (dInfo.length) {
            var SAFE_DROP = ['ptf_crm_audit', 'ptf_crm_notifs', 'ptf_crm_avatars'];
            var fmtAge = function (sec) { if (!(sec >= 0)) return 'نامشخص'; if (sec < 90) return 'چند لحظه'; if (sec < 3600) return Math.round(sec / 60) + ' دقیقه'; if (sec < 86400) return Math.round(sec / 3600) + ' ساعت'; return Math.round(sec / 86400) + ' روز'; };
            h2 += '<div style="margin-top:8px;padding-top:6px;border-top:1px dashed #d97706">⏳ <b>در انتظار ارسال به سرور:</b> ' +
              dInfo.slice(0, 6).map(function (d) {
                var nm = String(d.k).replace('ptf_crm_', '');
                return escP(nm) + ' <small>(از ' + fmtAge(d.ageSec) + ' پیش)</small>' +
                  (SAFE_DROP.indexOf(d.k) > -1
                    ? ' <a href="javascript:void(0)" style="color:#b45309;font-weight:700" onclick="if(window.ptfSyncDropDirtyKey&&window.ptfSyncDropDirtyKey(\'' + escP(d.k) + '\')){if(typeof ptfToast===\'function\')ptfToast(\'کلید ' + escP(nm) + ' از صف ارسال آزاد شد\',\'ok\');if(typeof goPanelByName===\'function\')goPanelByName(\'set\');}">↺ رها کردن امن</a>'
                    : '');
              }).join('، ') + (dInfo.length > 6 ? ' …' : '') +
              '<br><small>«رها کردن امن» فقط برای کلیدهای لاگ/اعلان است (نسخهٔ مرجع روی سرور). برای سایر کلیدها «⬆ تلاش مجدد ارسال» را در «تشخیص همگام‌سازی» همان تنظیمات بزنید.</small></div>';
          }
        } catch (eDirtyBox) {}
        /* v34.36.1 (P0-3/F4 — فارِنزیک روی صفحه): علتِ آخرین شکستِ «انتقال یک‌باره»
           در همان جعبهٔ کهربایی نشان داده می‌شود. پیش از این، شکستِ مهاجرت هیچ ردِ
           پایداری به جا نمی‌گذاشت و کاربر فقط یک alert مبهم («network») می‌دید؛
           برای همین بن‌بست «۴۸ از ۴۹ کلید» بدون کنسول قابل تشخیص نبود. */
        try {
          var mLast = (typeof window.ptfSyncLastError === 'function') ? (window.ptfSyncLastError() || null) : null;
          if (!green && mLast && mLast.scope === 'migration') {
            var M_LABEL = {
              conflicts: 'تعارض داده با نسخهٔ سرور', forbidden: 'خارج از allowlist نقش فعلی',
              rejected: 'رد شده توسط سپر داده/یکپارچگی', skipped: 'بزرگ‌تر از سقف ۸MB',
              failed: 'شکست ارسال/تایم‌اوت', blocked: 'در انتظار پایان فرمان دامنه',
              needLogin: 'نشست منقضی', unacknowledged: 'بدون تأیید سرور ماند'
            };
            h2 += '<div style="margin-top:8px;padding-top:6px;border-top:1px dashed #d97706">⛔ <b>آخرین تلاشِ انتقال ناتمام ماند:</b> ' +
              escP(M_LABEL[mLast.status] || mLast.status || 'علت نامشخص') +
              (mLast.reason ? ' — ' + escP(mLast.reason) : '') +
              ' <small style="color:#94a3b8">(' + escP(mLast.fa || mLast.t || '') + ')</small>' +
              (function () {
                /* detail = «cls:key|key ; cls:key (round n, error x)» ⇒ فقط نام کلیدها
                   (بدون پیشوند ptf_crm_) نشان داده می‌شود؛ در صورت پارس‌نشدن، همان
                   متن خامِ بریده‌شده (شفافیت قبل از زیبایی). */
                try {
                  var names = String(mLast.detail || '').split(/\s*;\s*/).map(function (part) {
                    var kv = part.split(':');
                    if (!M_LABEL[kv[0]]) return ''; /* فقط کلاس‌های شناخته‌شده */
                    return String(kv[1] || '').split('|').map(function (n) { return n.replace('ptf_crm_', '').trim(); }).filter(Boolean).join('، ');
                  }).filter(Boolean).join(' / ');
                  return names ? '<br><small>کلیدهای درگیر: ' + escP(names) + '</small>' : '';
                } catch (eDet) {
                  return mLast.detail ? '<br><small>کلیدهای درگیر: ' + escP(String(mLast.detail).slice(0, 240)) + '</small>' : '';
                }
              })() +
              '<br><small>دوباره «⬆️ تکمیل انتقال یک‌باره» را بزنید؛ نشانگرهای این دستگاه پاک نشده‌اند و دادهٔ محلی محفوظ است.</small></div>';
          }
        } catch (eMigBox) {}
        h2 += '</div>';
        return h2;
      })();
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
            tip = '\n\nبزرگ‌ترین کلیدها (اگر از نوع دادهٔ اصلی‌اند، پاک‌سازی امن آن‌ها را حذف نمی‌کند):\n' + tk.map(function (r) { return '• ' + r.key + ' — ' + fmtBytes(r.bytes); }).join('\n') + '\n\nراه‌حل دائمی: از «تنظیمات → وضعیت دستگاه» «انتقال یک‌بارهٔ داده‌ها» را اجرا کنید تا داده از سرور خوانده شود و حافظهٔ مرورگر فقط کش بماند.'; /* v34.8.52: ارجاع به جعبهٔ وضعیت دستگاه */
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
        if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection('ptf_crm_notifs', notifs, { reason: 'w2' }); else setData('ptf_crm_notifs', notifs);
        var logs = getData('ptf_crm_audit');
        if (logs.length > 1000) { /* v34.8.27 (W4) */ if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection('ptf_crm_audit', logs.slice(0, 1000), { reason: 'w4' }); else setData('ptf_crm_audit', logs.slice(0, 1000)); }
        if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection('ptf_crm_sendqueue', getData('ptf_crm_sendqueue').filter(function (x) { return x.st !== 'sent'; }), { reason: 'w4' }); else setData('ptf_crm_sendqueue', getData('ptf_crm_sendqueue').filter(function (x) { return x.st !== 'sent'; }));
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
          notify({ toRoles: ['admin', 'chairman'], title: 'حافظه محلی CRM بیش از ۸۵٪ پر است — از تنظیمات، بک‌آپ و پاک‌سازی امن را اجرا کنید', kind: 'data_risk', channels: ['cart'], link: { panel: 'set' }, actionable: true, dkey: 'quota-85' });
        }
      }
    } catch (e) {}
  }

  // تزریق باکس بک‌آپ و Storage Health در تنظیمات (+ تشخیص همگام‌سازی v34.7.91)
  var _buildSettings = window.buildSettings;
  if (_buildSettings) {
    window.buildSettings = function () {
      var html = _buildSettings() + '<div style="max-width:620px">' + backupBoxHtml() + ptfStorageMeterHtml() +
        (typeof window.ptfSyncDiagnosticsHtml === 'function' ? window.ptfSyncDiagnosticsHtml() : '') + '</div>';
      /* بعد از رندر الگوی تنظیمات، باکس تشخیص با آخرین وضعیت پر می‌شود. */
      setTimeout(function () { if (typeof window.ptfSyncDiagnosticsRefresh === 'function') window.ptfSyncDiagnosticsRefresh(); }, 50);
      return html;
    };
  }

  /* ============ US-147: اختیارات اصلاح برد ============ */
  /* alias سازگاری: از این پس هیچ بردی در backup.js و localStorage دست‌کاری نمی‌شود؛
     فرمان کنترل‌شده sales-domain وابستگی‌ها را روی سرور بررسی و audit می‌کند. */
  window.adminUnwin = function (no) {
    if (typeof window.ptfRevokeOfferWin !== 'function') {
      alert('⛔ موتور اصلاح کنترل‌شده هنوز بارگذاری نشده است؛ صفحه را تازه‌سازی کنید.');
      return;
    }
    return window.ptfRevokeOfferWin(no);
  };

  window.adminDelOffer = function (no) {
    if (typeof window.ptfAdminHardDelete !== 'function') {
      alert('⛔ موتور حذف کنترل‌شده هنوز بارگذاری نشده است؛ صفحه را تازه‌سازی کنید.');
      return;
    }
    return window.ptfAdminHardDelete('offer', no, function () {
      if (typeof renderOffers === 'function') renderOffers();
    });
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
