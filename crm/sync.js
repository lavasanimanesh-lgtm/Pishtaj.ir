/* =====================================================================
   PTF CRM — Sprint 79 (sync.js)
   US-151 فاز ۲: همگام‌سازی کل داده CRM بین دستگاه‌ها/مرورگرها
   مدل: server-authoritative با نسخه (rev) سراسری
   - هر تغییر محلی → push بدهکار (debounced ۴ ثانیه)
   - هر ۲۰ ثانیه چک rev سرور → در صورت جلوتر بودن، pull و ادغام
   - تعارض: آخرین نویسنده می‌برد (LWW) + ثبت در لاگ
   - آفلاین: تغییرات محلی می‌مانند و با اولین اتصال push می‌شوند
   ===================================================================== */
(function () {
  'use strict';
  var API = '../api/crm.php';
  var SYNC_KEYS = [
    'ptf_crm_rfqs', 'ptf_crm_suppliers', 'ptf_crm_customers', 'ptf_crm_products', 'ptf_crm_catalog_reviews', 'ptf_crm_catalog_merges', 'ptf_crm_surplus',
    'ptf_crm_offers', 'ptf_crm_leads', 'ptf_crm_reminders', 'ptf_crm_buyquotes',
    'ptf_crm_invoices', 'ptf_crm_notifs', 'ptf_crm_sendqueue', 'ptf_crm_audit',
    'ptf_crm_inqitems', 'ptf_crm_deals', 'ptf_crm_projects', 'ptf_crm_packinglists',
    'ptf_crm_letters', 'ptf_crm_contracts', 'ptf_crm_sigprofiles', 'ptf_crm_smsbook',
    'ptf_crm_rfqsmart', 'ptf_crm_settings', 'ptf_crm_finance', 'ptf_crm_order_prices', 'ptf_crm_payables', 'ptf_crm_supplier_finance', 'ptf_crm_opex', 'ptf_crm_shareholders', 'ptf_crm_sharetx', 'ptf_crm_fiscal_snapshots', 'ptf_crm_techcases', 'ptf_crm_calc_runs', 'ptf_crm_techproposals', 'ptf_crm_leadfinder_jobs', 'ptf_crm_leadfinder_sources','ptf_crm_management_actions','ptf_crm_management_reports','ptf_crm_commission_records',
    'ptf_crm_notifprefs', 'ptf_crm_trash', 'ptf_crm_petty', 'ptf_crm_petty_tx', 'ptf_crm_petty_periods', 'ptf_crm_perms', 'ptf_crm_avatars', 'ptf_crm_buycmp', 'ptf_crm_inqreads', 'ptf_crm_cheques_issued', 'ptf_crm_cheques_received', 'ptf_crm_cheque_books', 'ptf_crm_msgtpls', 'ptf_crm_deleted_archive', 'ptf_crm_tax_returns', 'ptf_crm_sales_returns', 'ptf_crm_fin_events', 'ptf_crm_bank_recon', 'ptf_crm_treasury_calls', 'ptf_crm_case_receipts', 'ptf_crm_receipt_allocations', 'ptf_crm_fin_attachments', 'ptf_crm_corrections', 'ptf_crm_fin_findings', 'ptf_crm_personal_cheques'
  ];
  // v31.7.3 BUG-AUDIT-005-SYNC-TIMING: کلیدهای بحرانی که باید فوری sync شوند
  var URGENT_SYNC_KEYS = [
    'ptf_crm_cheques_issued', 'ptf_crm_cheques_received', 'ptf_crm_cheque_books', 'ptf_crm_invoices', 'ptf_crm_payables', 'ptf_crm_supplier_finance', 'ptf_crm_fin_events',
    'ptf_crm_petty', 'ptf_crm_petty_tx', 'ptf_crm_petty_periods', 'ptf_crm_fiscal_snapshots',
    'ptf_crm_shareholders', 'ptf_crm_sharetx', 'ptf_crm_offers', 'ptf_crm_deals',
    'ptf_crm_projects', 'ptf_crm_opex', 'ptf_crm_case_receipts', 'ptf_crm_receipt_allocations', 'ptf_crm_fin_attachments', 'ptf_crm_corrections', 'ptf_crm_personal_cheques'
  ];
  var SYNC_FULL_ROLES = ['admin','chairman','ceo','commercial'];
  var SYNC_ROLE_KEYS = {
    sales: ['ptf_crm_rfqs','ptf_crm_suppliers','ptf_crm_customers','ptf_crm_products','ptf_crm_catalog_reviews','ptf_crm_catalog_merges','ptf_crm_offers','ptf_crm_leads','ptf_crm_reminders','ptf_crm_buyquotes','ptf_crm_surplus','ptf_crm_notifs','ptf_crm_sendqueue','ptf_crm_inqitems','ptf_crm_deals','ptf_crm_projects','ptf_crm_packinglists','ptf_crm_letters','ptf_crm_contracts','ptf_crm_sigprofiles','ptf_crm_rfqsmart','ptf_crm_notifprefs','ptf_crm_avatars','ptf_crm_buycmp','ptf_crm_inqreads','ptf_crm_msgtpls','ptf_crm_deleted_archive','ptf_crm_personal_cheques'],
    buyer: ['ptf_crm_rfqs','ptf_crm_suppliers','ptf_crm_customers','ptf_crm_products','ptf_crm_catalog_reviews','ptf_crm_catalog_merges','ptf_crm_offers','ptf_crm_leads','ptf_crm_reminders','ptf_crm_buyquotes','ptf_crm_surplus','ptf_crm_notifs','ptf_crm_sendqueue','ptf_crm_inqitems','ptf_crm_deals','ptf_crm_projects','ptf_crm_packinglists','ptf_crm_letters','ptf_crm_contracts','ptf_crm_sigprofiles','ptf_crm_rfqsmart','ptf_crm_notifprefs','ptf_crm_avatars','ptf_crm_buycmp','ptf_crm_inqreads','ptf_crm_msgtpls','ptf_crm_deleted_archive','ptf_crm_supplier_finance','ptf_crm_payables','ptf_crm_personal_cheques'],
    accountant: ['ptf_crm_rfqs','ptf_crm_customers','ptf_crm_products','ptf_crm_catalog_reviews','ptf_crm_catalog_merges','ptf_crm_offers','ptf_crm_reminders','ptf_crm_invoices','ptf_crm_notifs','ptf_crm_sendqueue','ptf_crm_inqitems','ptf_crm_deals','ptf_crm_projects','ptf_crm_letters','ptf_crm_contracts','ptf_crm_rfqsmart','ptf_crm_finance','ptf_crm_payables','ptf_crm_supplier_finance','ptf_crm_opex','ptf_crm_petty','ptf_crm_petty_tx','ptf_crm_petty_periods','ptf_crm_cheques_issued', 'ptf_crm_cheques_received','ptf_crm_cheque_books','ptf_crm_fiscal_snapshots','ptf_crm_notifprefs','ptf_crm_avatars','ptf_crm_msgtpls','ptf_crm_deleted_archive','ptf_crm_tax_returns','ptf_crm_sales_returns','ptf_crm_fin_events','ptf_crm_bank_recon','ptf_crm_commission_records','ptf_crm_case_receipts','ptf_crm_receipt_allocations','ptf_crm_fin_attachments','ptf_crm_corrections','ptf_crm_fin_findings','ptf_crm_personal_cheques'],
    collector: ['ptf_crm_customers','ptf_crm_offers','ptf_crm_invoices','ptf_crm_reminders','ptf_crm_notifs','ptf_crm_sendqueue','ptf_crm_deals','ptf_crm_projects','ptf_crm_cheques_issued', 'ptf_crm_cheques_received','ptf_crm_notifprefs','ptf_crm_avatars','ptf_crm_personal_cheques']
  };
  function syncAllowedKey(k) {
    var role = typeof curRole === 'function' ? String(curRole()).toLowerCase().trim() : 'sales';
    role = role.replace(/[^a-z0-9]/g, '');
    var isFullRole = SYNC_FULL_ROLES.indexOf(role) > -1 || role.indexOf('commercial') > -1 || role.indexOf('manager') > -1;
    return isFullRole || (SYNC_ROLE_KEYS[role] || SYNC_ROLE_KEYS.sales).indexOf(k) > -1;
  }

  /* v34.4.42 BUG-SYNC-DIRTY-BANNER-001:
     نقش‌های غیرارشد اجازهٔ sync کلید audit و برخی کلیدهای مدیریتی را ندارند. نسخهٔ قبلی
     dirty ذخیره‌شدهٔ این کلیدها را در boot می‌خواند و قبل از پاکسازی push، بنر زرد
     «۱ تغییر ذخیره‌نشده» را نشان می‌داد. بدتر: pushDirty کلید ممنوع را حذف و همان حذف
     را با audit() ثبت می‌کرد؛ audit از setData می‌گذشت و همان کلید ممنوع را دوباره dirty
     می‌کرد، بنابراین حلقه بعد از هر hard refresh تکرار می‌شد. dirty persisted پیش از
     ساخت state از audit غیرقابل‌ارسال و کلیدهای منسوخ پاک می‌شود تا بنر فقط تغییر
     واقعی را بشمارد، بدون اینکه dirtyهای یک کاربر دیگر هنگام تعویض نقش حذف شوند. */
  function loadPersistedDirty() {
    var raw = {};
    try { raw = JSON.parse(localStorage.getItem('ptf_sync_dirty') || '{}') || {}; } catch (eRead) {}
    var clean = {};
    Object.keys(raw).forEach(function (k) {
      if (!raw[k] || SYNC_KEYS.indexOf(k) < 0) return;
      /* audit تنها کلیدی است که خودِ cleanup سینک آن را دوباره تولید می‌کند. سایر
         dirtyهای موقتِ نامجاز تا زمان ورود با نقش درست حفظ می‌شوند و pushDirty طبق
         قرارداد قبلی درباره‌شان تصمیم می‌گیرد. */
      if (k === 'ptf_crm_audit' && !syncAllowedKey(k)) return;
      clean[k] = true;
    });
    try { localStorage.setItem('ptf_sync_dirty', JSON.stringify(clean)); } catch (eSave) {}
    return clean;
  }
  window._ptfSyncBootstrapped = false; /* v16.7 BUG-018: فلگ عمومی برای ماژول‌هایی که rebuild خودکار دارند (sms) */
  /* readiness مالی فقط بعد از پاسخ موفق pull اعلام می‌شود؛ bootstrapped ممکن است در
     مسیر خطا نیز برای سازگاری ماژول‌های قدیمی true شود و معیار امنی نیست. */
  window._ptfSyncSnapshotReady = false;
  function announceSnapshotReady(result) {
    if (!result || result.ok === false) return false;
    window._ptfSyncSnapshotReady = true;
    try {
      var detail = { ok: true, rev: result.rev, applied: +result.applied || 0, fresh: !!result.fresh };
      var ev;
      if (typeof window.CustomEvent === 'function') ev = new window.CustomEvent('ptf:sync-ready', { detail: detail });
      else if (document && typeof document.createEvent === 'function') { ev = document.createEvent('CustomEvent'); ev.initCustomEvent('ptf:sync-ready', false, false, detail); }
      if (ev && typeof window.dispatchEvent === 'function') window.dispatchEvent(ev);
    } catch (eReady) {}
    return true;
  }
  var state = {
    dirty: loadPersistedDirty(),  // کلید معتبر، بدون audit غیرقابل‌ارسال؛ v34.4.42 ضد بنر کاذب
    pushTimer: null,
    pulling: false,
    /* v34.4.34: `pulling` فقط هنگام اعمال localStorage فعال است؛ برای جلوگیری از
       دو fetch هم‌زمان به یک فلگ جدا نیاز داریم، وگرنه پاسخ قدیمی‌تر می‌تواند بعد
       از پاسخ جدیدتر برسد و rev/ضمیمهٔ تازه را عقب ببرد. */
    pullRequesting: false,
    pushing: false,
    lastRev: parseInt(localStorage.getItem('ptf_sync_rev') || '0', 10),
    online: true,
    bootstrapped: false, /* v15.0 (US-384): تا سینک اولیه کامل نشده، push ممنوع — جلوی ارسال داده کهنه هنگام رفرش */
    initialReconcile: false, /* v31.7.2: local records created before sync.js must be merged, not overwritten */
    lastBgPull: 0, /* v33.21.x: آخرین پول مسیر آهسته (غیرمتمرکز ۱۲۰ثانیه / مخفی ۱۸۰ثانیه) */
    lastPingPull: 0, /* v33.21.1: آخرین پول فوریِ برگرفته از پینگ بین‌تبی (حد نرخ ۵ثانیه) */
    /* نوشتنی که حتی در مرورگر پایدار نشده، نباید با badge سبز/پیام موفقیت پنهان شود.
       این وضعیت عمداً جدا از dirty است: dirty = در انتظار ACK سرور؛ writeFailure =
       همان دستگاه حتی نتوانسته نسخهٔ قابل بازیابی بسازد. */
    writeFailures: {},
    lastPushResult: null,
    lastPullResult: null,
    projectionPreserved: {}
  };

  function setRev(r) { state.lastRev = r; localStorage.setItem('ptf_sync_rev', String(r)); }
  /* Apply the server's exact per-key watermark only when its global response is not
     older than the revision already accepted by this tab. This repairs command-stamped
     global revs without allowing a late pull to move the global cursor backwards. */
  function applyServerMeta(meta, globalRev) {
    var gr = +globalRev || 0;
    var current = +state.lastRev || 0;
    if (!gr || gr < current) return false;
    var m = krevs();
    Object.keys(meta || {}).forEach(function (k) {
      if (k === '_global' || !meta[k] || meta[k].rev == null) return;
      m[k] = +meta[k].rev || 0;
    });
    saveKrevs(m);
    if (gr > current) setRev(gr);
    return true;
  }
  window.ptfSyncApplyServerMeta = applyServerMeta;
  /* v34.8.7 (SHARED-KEY-CONVERGENCE): مسیر فاز B (مالک انتقال) برای کلیدهای
     conflicted بن‌بست داشت — مقدار سرور را merge محلی می‌کنیم، dirty می‌ماند و
     flush بعدی با base تازه ارسال می‌کند. منطق همان US-384 مسیر legacy است. */
  window.ptfSyncResolveConflictFromServer = function (k, serverStr) {
    try {
      if (typeof serverStr !== 'string' || SYNC_KEYS.indexOf(k) < 0) return false;
      var merged = (typeof window.ptfSmartMerge === 'function') ? window.ptfSmartMerge(k, rd(k), serverStr) : serverStr;
      if (typeof window.ptfApplyDeletionTombstones === 'function') merged = window.ptfApplyDeletionTombstones(k, merged);
      state.pulling = true; wr(k, merged); state.pulling = false;
      state.dirty[k] = true; saveDirty();
      try { setSyncBadge('warn'); } catch (eBadge) {}
      return true;
    } catch (eResolve) { return false; }
  };
  /* v34.8.10 (PROTECTED-CONFLICT-RESCUE): ptf_crm_opex/sharetx/shareholders کلیدهای
     مالی محافظت‌شده‌اند — سرور پاسخ merge محافظت‌شده برمی‌گرداند و امضای آن تقریباً
     هیچ‌وقت با snapshot خام مرورگر یکی نیست؛ بدون اعمال این merge، push بعدی باز
     conflict می‌دهد (بن‌بست گزارش‌شده برای مدیر بازرگانی). همین منطق US-384/مسیر
     legacy، حالا برای فاز B هم مهیاست. */
  window.ptfSyncResolveProtectedConflictFromServer = function (k, serverStr, submittedStr) {
    try {
      if (typeof serverStr !== 'string' || SYNC_KEYS.indexOf(k) < 0) return false;
      /* v34.8.11 (VERBATIM-CONVERGENCE): اگر لوکال از لحظهٔ ارسال تغییر نکرده،
         canonical سرور عیناً پذیرفته می‌شود (بدون merge مجدد و بدون پاس tombstone —
         سرور خودش tombstones را قبل از merge اعمال کرده). این تضمین می‌کند push
         بعدی امضای یکسان بدهد و ACK شود؛ پاس‌های قبلی (merge سه‌طرفه/tombstone)
         می‌توانستند تفاوت جزئی بازتولید کنند و حلقهٔ بی‌نهایت بسازند. */
      var current = rd(k);
      var merged;
      if (typeof submittedStr === 'string' && sameSyncJson(current, submittedStr)) {
        merged = serverStr;
      } else if (typeof window.ptfMergeProtectedFinanceConflict === 'function') {
        merged = window.ptfMergeProtectedFinanceConflict(k, current, typeof submittedStr === 'string' ? submittedStr : current, serverStr);
      } else merged = serverStr;
      state.pulling = true; wr(k, merged); state.pulling = false;
      state.dirty[k] = true; saveDirty();
      try { setSyncBadge('warn'); } catch (eBadge2) {}
      return true;
    } catch (eResolveP) { return false; }
  };

  /* ===== v15.0 (US-384 — رفع ریشه‌ای Lost Update) =====
     نسخه per-key که این دستگاه از سرور می‌شناسد؛ با هر push به‌عنوان «مبنا» می‌رود.
     اگر دستگاه دیگری بعد از ما نوشته باشد، سرور نوشتن کورکورانه را رد و نسخه خودش را
     برمی‌گرداند تا اینجا با ptfSmartMerge ادغام و دوباره ارسال شود — رکورد هیچ‌کس گم نمی‌شود. */
  function krevs() { try { return JSON.parse(localStorage.getItem('ptf_sync_krevs') || '{}'); } catch (e) { return {}; } }
  function saveKrevs(m) { try { localStorage.setItem('ptf_sync_krevs', JSON.stringify(m)); } catch (e) {} }
  function applyKrevs(newOnes) {
    if (!newOnes) return;
    var m = krevs();
    Object.keys(newOnes).forEach(function (k) { m[k] = +newOnes[k] || 0; });
    saveKrevs(m);
  }

  function saveDirty() { try { localStorage.setItem('ptf_sync_dirty', JSON.stringify(state.dirty)); } catch (e) {} }
  /* v34.7.39 — فرمان‌های دامنه باید تا ACK سرور، کلیدهای projection خود را از
     مسیر عمومی whole-array sync جدا نگه دارند. وگرنه همان رکورد پیش از
     register_offer از data_push عبور می‌کند و boundary سروری عملاً دور زده می‌شود. */
  var commandHeldKeys = {};
  function syncKeyHeld(k) { return (+commandHeldKeys[k] || 0) > 0; }
  window.ptfSyncHoldCommandKeys = function (keys) {
    (Array.isArray(keys) ? keys : [keys]).forEach(function (k) {
      if (SYNC_KEYS.indexOf(k) > -1) commandHeldKeys[k] = (+commandHeldKeys[k] || 0) + 1;
    });
  };
  window.ptfSyncReleaseCommandKeys = function (keys) {
    (Array.isArray(keys) ? keys : [keys]).forEach(function (k) {
      if (!commandHeldKeys[k]) return;
      commandHeldKeys[k]--;
      if (commandHeldKeys[k] <= 0) delete commandHeldKeys[k];
    });
    if (Object.keys(state.dirty).some(function (k) { return !syncKeyHeld(k); })) schedulePush();
  };
  window.ptfSyncAcknowledgeCommandKeys = function (keys) {
    (Array.isArray(keys) ? keys : [keys]).forEach(function (k) {
      delete state.dirty[k];
      clearWriteFailure(k);
    });
    saveDirty();
  };
  /* Phase B and command projections use the same per-key ACK contract. A key is
     cleared only when the value acknowledged by the server is still the value in
     this tab; a newer local generation remains dirty for the next push. */
  window.ptfSyncAcknowledgeKeys = function (keys, submitted) {
    (Array.isArray(keys) ? keys : [keys]).forEach(function (k) {
      if (submitted && Object.prototype.hasOwnProperty.call(submitted, k) && !sameSyncJson(rd(k), submitted[k])) {
        state.dirty[k] = true;
        return;
      }
      delete state.dirty[k];
      clearWriteFailure(k);
    });
    saveDirty();
    try { setSyncBadge(Object.keys(state.dirty).length ? 'warn' : 'ok'); } catch (eBadge) {}
  };
  window.ptfSyncCommandKeyHeld = syncKeyHeld;
  /* قرارداد عمومی برای فرم‌ها: قبل از باز کردن عملیات حساس نیز می‌توانند همین
     گارد را بخوانند؛ اما wrapper setData پایین آخرین سد سراسری است. */
  window.ptfSyncCanWriteKey = function (k) { return SYNC_KEYS.indexOf(k) < 0 || syncAllowedKey(k); };
  window.ptfSyncPendingKeys = function () { return Object.keys(state.dirty); };
  window.ptfSyncMarkPendingKeys = function (keys) {
    (Array.isArray(keys) ? keys : [keys]).forEach(function (k) {
      if (SYNC_KEYS.indexOf(k) > -1) state.dirty[k] = true;
    });
    saveDirty();
    if (Object.keys(state.dirty).length) { try { setSyncBadge('warn'); } catch (eBadge) {} }
  };
  window.ptfSyncWriteFailures = function () { return Object.keys(state.writeFailures); };
  /* Read-only diagnostic baseline. It intentionally exposes counts/revisions and
     result classes, never tokens or business payloads. */
  window.ptfSyncDiagnosticsSnapshot = function () {
    var dirty = Object.keys(state.dirty || {}), queue = [];
    try { queue = Object.keys(JSON.parse(localStorage.getItem('ptf_b_queue') || '{}') || {}); } catch (eQueue) {}
    try {
      if (typeof window.ptfBPendingKeys === 'function') {
        window.ptfBPendingKeys().forEach(function (k) { if (queue.indexOf(k) < 0) queue.push(k); });
      }
    } catch (eBQueue) {}
    return {
      readOnly: true,
      phaseB: !!(typeof window.ptfBPhaseActive === 'function' && window.ptfBPhaseActive()),
      dirtyKeys: dirty,
      queueKeys: queue,
      writeFailures: Object.keys(state.writeFailures || {}),
      localRevision: state.lastRev,
      localKeyRevisions: krevs(),
      lastPushResult: state.lastPushResult,
      lastPullResult: state.lastPullResult,
      projectionPreserved: Object.assign({}, state.projectionPreserved),
      lastError: readSyncLastError()
    };
  };
  function noteWriteFailure(k, reason) {
    state.writeFailures[k] = String(reason || 'ذخیرهٔ پایدار مرورگر ناموفق بود');
    try { setSyncBadge('writefail'); } catch (eB) {}
    try {
      if (typeof ptfToast === 'function') ptfToast('⛔ تغییر در «' + String(k).replace('ptf_crm_', '') + '» حتی روی این دستگاه پایدار نشد؛ ثبت را تکرار کنید و تب را نبندید. علت: ' + state.writeFailures[k], 'warn');
    } catch (eT) {}
  }
  function clearWriteFailure(k) { if (state.writeFailures[k]) delete state.writeFailures[k]; }
  window.ptfSyncNotifyWriteFailure = noteWriteFailure;
  var pushWaiters = [];
  function notifyPushWaiters(ok, extra) {
    var w = pushWaiters.splice(0);
    w.forEach(function (fn) { try { fn(!!ok, extra || {}); } catch (eW) {} });
  }

  /* ---------- رهگیری تغییرات: wrap setData ---------- */
  window.ptfSyncNotifyDirty = function (k) {
    if (SYNC_KEYS.indexOf(k) > -1 && !state.pulling) {
      /* projection یک فرمان درحال اجرا نباید هم‌زمان وارد data_push عمومی شود؛
         اما ویرایش هم‌زمان نباید ناپدید شود. باقیماندهٔ dirty پس از release ارسال می‌شود. */
      if (syncKeyHeld(k)) {
        state.dirty[k] = true;
        saveDirty();
        try { setSyncBadge('warn'); } catch (eHeldBadge) {}
        return;
      }
      /* کلیدی که سرور برای نقش فعلی نمی‌پذیرد نباید «تغییر ذخیره‌نشده» محسوب شود؛
         به‌ویژه audit داخلیِ خود sync نباید dirty را پس از پاکسازی دوباره بسازد. */
      if (k === 'ptf_crm_audit' && !syncAllowedKey(k)) {
        if (state.dirty[k]) { delete state.dirty[k]; saveDirty(); }
        return;
      }
      state.dirty[k] = true;
      saveDirty(); // v33.2.1: persist dirty keys
      try { setSyncBadge('warn'); } catch (eBdg) {}
      /* With Phase B active, client-server.js owns the transport timer/queue. Keeping
         state.dirty for the shared banner/ACK is useful, but a second push engine is
         not allowed to send the same generation in parallel. */
      try {
        if (typeof window.ptfBPhaseActive === 'function' && window.ptfBPhaseActive()) {
          if (typeof window.ptfBEnqueueKeys === 'function') window.ptfBEnqueueKeys([k]);
          return;
        }
      } catch (ePhase) {}
      schedulePush();
    }
  };

  /* یکسان‌بودن داده باید معنایی باشد، نه صرفاً برابر بودن رشته JSON. بعضی migrationها
     یا فرم‌ها همان object را با ترتیب property متفاوت دوباره می‌نویسند؛ مقایسهٔ رشته‌ای
     آن را «تغییر جدید» می‌دید، push می‌کرد و پس از refresh بنر زرد دائمی می‌ساخت.
     ترتیب آرایه عمداً حفظ می‌شود، چون در رکوردهای CRM می‌تواند معنا داشته باشد. */
  function sameSyncJson(a, b) {
    if (a === b) return true;
    try {
      function normalize(v) {
        if (!v || typeof v !== 'object') return v;
        if (Array.isArray(v)) return v.map(normalize);
        var out = {};
        Object.keys(v).sort().forEach(function (key) { out[key] = normalize(v[key]); });
        return out;
      }
      return JSON.stringify(normalize(JSON.parse(a))) === JSON.stringify(normalize(JSON.parse(b)));
    } catch (e) { return false; }
  }
  var _setData = window.setData;
  window.setData = function (k, d) {
    /* آخرین سد سراسری: هیچ فرم نباید بتواند دادهٔ یک کلید Sync را با نقش
       نامجاز فقط محلی بنویسد و بعد پیام «ثبت شد» نشان دهد. */
    /* audit یک log داخلی و غیرکسب‌وکاری است: نقش محدود آن را محلی ثبت می‌کند،
       اما ptfSyncNotifyDirty طبق گارد اختصاصی آن را به سرور نمی‌فرستد. جلوگیری
       از write محلی audit باعث بنر قرمز کاذب بعد از هر عملیات می‌شد. */
    if (SYNC_KEYS.indexOf(k) > -1 && k !== 'ptf_crm_audit' && !syncAllowedKey(k)) {
      noteWriteFailure(k, 'نقش فعلی اجازهٔ ثبت/همگام‌سازی این بخش را ندارد');
      return false;
    }
    /* چند migration/repair در boot همان مقدار قبلی را دوباره setData می‌کنند
       (نمونه قطعی: ptfDupAckSet("") روی ptf_crm_settings). فقط تغییر واقعی dirty است. */
    var before = SYNC_KEYS.indexOf(k) > -1 ? rd(k) : null;
    var saveResult;
    try { saveResult = _setData(k, d); }
    catch (eWrite) {
      noteWriteFailure(k, (eWrite && eWrite.message) || 'خطای نوشتن در حافظهٔ مرورگر');
      return false;
    }
    var after = SYNC_KEYS.indexOf(k) > -1 ? rd(k) : null;
    /* storage-quota و فاز B در خطای پایدارسازی false برمی‌گردانند. اگر نویسندهٔ
       قدیمی undefined برگرداند، فقط تفاوت واقعی before/after ملاک است. */
    if (saveResult === false) {
      noteWriteFailure(k, 'فضای مرورگر یا صف آفلاین نتوانست تغییر را پایدار کند');
      return false;
    }
    clearWriteFailure(k);
    if (!sameSyncJson(before, after)) window.ptfSyncNotifyDirty(k);
    return saveResult;
  };

  function schedulePush() {
    /* Phase B has the single transport owner. Rebuild its queue from the shared dirty
       registry (important after refresh) and never schedule sync.js pushDirty in
       parallel. */
    try {
      if (typeof window.ptfBPhaseActive === 'function' && window.ptfBPhaseActive()) {
        if (typeof window.ptfBEnqueueKeys === 'function') window.ptfBEnqueueKeys(Object.keys(state.dirty));
        clearTimeout(state.pushTimer);
        state.pushTimer = setTimeout(function () {
          try { pushViaPhaseB(); } catch (eBFlush) {}
        }, 500);
        return;
      }
    } catch (ePhase) {}
    // v31.7.3 BUG-AUDIT-005-SYNC-TIMING: کاهش debounce برای کلیدهای بحرانی
    // کاربر می‌خواهد تغییرات مالی بلافاصله sync شوند — نه پس از ۴ ثانیه.
    // برای کلیدهای حیاتی: ۵۰۰ms debounce. برای بقیه: ۴s.
    var hasUrgent = Object.keys(state.dirty).some(function(k) {
      return URGENT_SYNC_KEYS.indexOf(k) > -1;
    });
    clearTimeout(state.pushTimer);
    state.pushTimer = setTimeout(pushDirty, hasUrgent ? 500 : 4000);
  }

  /* ===== v14.7 (US-382 — سپر ضد داده‌صفر، ریشه حادثه پاک شدن مشتریان) =====
     ① کلاینت: کلید اصلی که آخرین pull آن ناخالی بود، با فهرست خالی push نمی‌شود (هشدار یک‌باره).
     ② آشکارساز افت انبوه: کاهش >۵۰٪ رکورد کلیدهای حیاتی → audit + اعلان فوری admin/chairman. */
  var GUARD_KEYS = ['ptf_crm_customers', 'ptf_crm_rfqs', 'ptf_crm_offers', 'ptf_crm_suppliers', 'ptf_crm_products', 'ptf_crm_invoices', 'ptf_crm_deals', 'ptf_crm_projects', 'ptf_crm_smsbook', 'ptf_crm_payables', 'ptf_crm_opex', 'ptf_crm_petty', 'ptf_crm_petty_tx', 'ptf_crm_petty_periods', 'ptf_crm_shareholders', 'ptf_crm_sharetx', 'ptf_crm_fiscal_snapshots', 'ptf_crm_techcases', 'ptf_crm_calc_runs', 'ptf_crm_techproposals', 'ptf_crm_leadfinder_jobs', 'ptf_crm_tax_returns', 'ptf_crm_sales_returns', 'ptf_crm_case_receipts', 'ptf_crm_receipt_allocations', 'ptf_crm_fin_attachments', 'ptf_crm_corrections']; /* v16.7 BUG-018 + v18.1 R9: کلیدهای مالی/تنخواه/سهامداران/سال مالی زیر سپر داده‌صفر | v34.5.10: مرجوعی‌های مالیاتی/فروش به‌دلیل ماهیت مالی به سپر داده‌صفر اضافه شدند (tester341) */
  function guardCounts() { try { return JSON.parse(localStorage.getItem('ptf_guard_counts') || '{}'); } catch (e) { return {}; } }
  function saveGuardCounts(c) { try { localStorage.setItem('ptf_guard_counts', JSON.stringify(c)); } catch (e) {} }
  window.ptfUpdateGuardCounts = function () {
    var c = guardCounts();
    GUARD_KEYS.forEach(function (k) {
      try { var a = JSON.parse(rd(k) || '[]'); if (Array.isArray(a)) c[k] = a.length; } catch (e) {}
    });
    saveGuardCounts(c);
  };
  function massDropCheck() {
    try {
      var c = guardCounts();
      GUARD_KEYS.forEach(function (k) {
        var prev = +c[k] || 0;
        if (prev < 4) return; /* داده کم — افت معنادار نیست */
        var now = 0;
        try { var a = JSON.parse(rd(k) || '[]'); now = Array.isArray(a) ? a.length : prev; } catch (e) { return; }
        if (now < prev / 2) {
          var lbl = k.replace('ptf_crm_', '');
          try { audit('سیستم', '🚨 هشدار افت انبوه داده (US-382): ' + lbl + ' از ' + prev + ' به ' + now + ' رکورد کاهش یافت', k); } catch (eA) {}
          if (typeof notify === 'function') {
            try { notify({ toRoles: ['admin', 'chairman'], title: '🚨 هشدار: تعداد رکوردهای «' + lbl + '» از ' + prev + ' به ' + now + ' کاهش یافت — اگر عمدی نبوده فورا از تنظیمات → بک‌آپ‌های سرور بازگردانی کنید', kind: 'data_risk', channels: ['cart'], link: { panel: 'set' }, actionable: true, dkey: 'data-drop-' + lbl }); } catch (eN) {}
          }
        }
        c[k] = now;
      });
      saveGuardCounts(c);
    } catch (e) {}
  }

  function authHeaders(json) {
    var h = json ? { 'Content-Type': 'application/json' } : {};
    try { var t = localStorage.getItem('ptf_crm_token'); if (t) h['X-CRM-Token'] = t; } catch (e) {}
    if (json) h['X-CRM-Role'] = curRole();
    return h;
  }
  function hasSyncToken() { try { return !!localStorage.getItem('ptf_crm_token'); } catch (e) { return false; } }

  /* ============ v34.7.91 (SYNC-DIAG-001) — خود-تشخیص همگام‌سازی ============
     تغییر منطق نوشتن/سینک نمی‌دهد؛ فقط:
       ۱) آخرین خطای push/pull را ثبت می‌کند (برای مشاهده در تنظیمات).
       ۲) «تست اتصال» با اکشن محافظت‌شده data_rev انجام می‌شود تا علاوه بر رسیدن
          به سرور، معتبر بودن نشست/توکن هم بررسی شود (users_get اکشن عمومی است و
          با نشست منقضی هم 200 می‌گرفت — ریشهٔ پیام گمراه‌کننده «اتصال برقرار است»).
       ۳) باکس «تشخیص همگام‌سازی» در تنظیمات نمایش داده شده و فقط‌خواندنی است. */
  function noteSyncError(scope, status, reason, detail) {
    try {
      var detailText = '';
      if (detail && typeof detail === 'object') {
        detailText = detail.error || detail.reason || detail.transportError || detail.detail || '';
      } else detailText = detail == null ? '' : String(detail);
      localStorage.setItem('ptf_sync_last_error', JSON.stringify({
        t: new Date().toISOString(),
        fa: (typeof faDateTime === 'function' ? faDateTime() : String(new Date().toLocaleString('fa-IR'))),
        scope: scope, status: status || '', reason: reason || '',
        detail: String(detailText || ''),
        keys: Object.keys(state.dirty || {})
      }));
    } catch (e) {}
  }
  function readSyncLastError() {
    try { return JSON.parse(localStorage.getItem('ptf_sync_last_error') || 'null'); } catch (e) { return null; }
  }
  window.ptfSyncLastError = readSyncLastError;
  window.ptfSyncServerStatus = function (cb) {
    /* اگر توکن نیست، نیازی به درخواست نیست: data_rev محافظت‌شده است و 401 می‌دهد. */
    if (!hasSyncToken()) { if (cb) cb({ status: 'needLogin', error: 'نشست/توکن یافت نشد' }); return; }
    var revStatusUrl = API + '?action=' + 'data_rev';
    fetch(revStatusUrl, { headers: authHeaders(false) })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d && d.ok) { if (cb) cb({ status: 'online', error: '' }); return; }
        /* v34.8.6: فقط نشانه‌های قطعی auth نشست را needLogin می‌کند (نه هر خطای حاوی «token») */
        var _e = String((d && d.error) || '');
        if (d && (d.needLogin === true || _e === 'authentication_required' || _e === 'Authentication required' || /^invalid or expired token/i.test(_e))) {
          if (cb) cb({ status: 'needLogin', error: _e || 'نشست منقضی' });
          return;
        }
        if (cb) cb({ status: 'error', error: _e || 'خطای سرور' });
      })
      .catch(function () { if (cb) cb({ status: 'offline', error: 'عدم دسترسی به سرور' }); });
  };
  function diagCounts() {
    var dirty = {}, queue = {};
    try { dirty = JSON.parse(localStorage.getItem('ptf_sync_dirty') || '{}') || {}; } catch (e) {}
    try { queue = JSON.parse(localStorage.getItem('ptf_b_queue') || '{}') || {}; } catch (e) {}
    var writeFail = Object.keys(state.writeFailures || {});
    return {
      dirty: Object.keys(dirty || {}), queue: Object.keys(queue || {}),
      writeFailures: writeFail, hasToken: hasSyncToken()
    };
  }
  window.ptfSyncDiagnosticsHtml = function () {
    return '<hr style="border:none;border-top:1px solid var(--brd);margin:16px 0">' +
      '<h4 style="margin:0 0 8px">🔎 تشخیص همگام‌سازی</h4>' +
      '<div id="ptfSyncDiagBody" style="background:#f8fafc;border:1px solid var(--brd);border-radius:12px;padding:12px 14px;font-size:12.5px;line-height:1.9"></div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">' +
      '<button class="bt" onclick="ptfSyncRunDiagnostics()">🔄 بررسی اتصال/نشست</button>' +
      '<button class="bt bt-o" onclick="ptfSyncFlushNow(function(ok){ if(typeof ptfToast===\'function\') ptfToast(ok?\'همگام‌سازی انجام شد؛ همهٔ تغییرات ارسال شد\':\'هنوز تغییرات ارسال‌نشده در صف است؛ نوار وضعیت را ببینید\', ok?\'ok\':\'warn\'); })">⬆ تلاش مجدد ارسال</button>' +
      '</div>';
  };
  window.ptfSyncDiagnosticsRefresh = function () {
    var el = document.getElementById('ptfSyncDiagBody');
    if (!el) return;
    var c = diagCounts();
    var last = readSyncLastError();
    var statusLine = last
      ? ('<b>آخرین خطا:</b> ' + escP(last.scope === 'push' ? 'ارسال (push)' : 'دریافت (pull)') + ' — ' +
         escP(last.status || '') + ' ' + escP(last.reason || '') + (last.detail ? ' — ' + escP(last.detail) : '') +
         ' <small style="color:#94a3b8">(' + escP(last.fa || last.t || '') + ')</small>')
      : '<b>آخرین خطا:</b> <span style="color:#059669">در این نشست خطای ثبت‌شده‌ای نیست</span>';
    var tokenLine = c.hasToken
      ? '<span style="color:#059669">✅ توکن نشست روی این دستگاه هست</span>'
      : '<span style="color:#b45309">⚠️ توکن نشست موجود نیست — اگر ذخیره/تغییرات رد می‌شود، دوباره وارد شوید</span>';
    var dirtyLine = c.dirty.length
      ? '<span style="color:#b45309">⚠️ ' + c.dirty.length + ' کلید در صف ارسال (dirty): ' + escP(c.dirty.slice(0, 8).join('، ')) + (c.dirty.length > 8 ? ' ...' : '') + '</span>'
      : '<span style="color:#059669">✅ تغییر معلق‌ای در صف نیست</span>';
    var queueLine = c.queue.length
      ? '<span style="color:#b45309">⚠️ ' + c.queue.length + ' کلید در صف آفلاین (فاز B): ' + escP(c.queue.slice(0, 8).join('، ')) + '</span>'
      : '<span style="color:#059669">🔵 صف آفلاین فاز B خالی است</span>';
    var writeLine = c.writeFailures.length
      ? '<span style="color:#b91c1c">🔴 ' + c.writeFailures.length + ' کلید مشکل حافظهٔ محلی؛ تب را نبندید: ' + escP(c.writeFailures.join('، ')) + '</span>'
      : '<span style="color:#059669">✅ حافظهٔ محلی برای رکوردها در این نشست خطای ثبت نداده</span>';
    el.innerHTML = '<div>' + tokenLine + '</div>' +
      '<div>' + dirtyLine + '</div>' +
      '<div>' + queueLine + '</div>' +
      '<div>' + writeLine + '</div>' +
      '<div style="border-top:1px dashed var(--brd);margin-top:6px;padding-top:6px">' + statusLine + '</div>';
  };
  window.ptfSyncRunDiagnostics = function () {
    var el = document.getElementById('ptfSyncDiagBody');
    if (el) el.innerHTML = '<div style="color:#0e7490">در حال بررسی اتصال و نشست…</div>';
    window.ptfSyncServerStatus(function (r) {
      if (r.status === 'online') noteSyncError('diag', 'ok', '', { error: '' });
      else noteSyncError('diag', r.status || 'error', r.error || '', r);
      /* اول وضعیت پایه را بازنویسی کن، سپس خط «نتیجهٔ بررسی» را بالای آن بگذار تا پاک نشود. */
      if (el) window.ptfSyncDiagnosticsRefresh();
      if (el) el.insertAdjacentHTML('afterbegin', '<div style="margin:0 0 6px;padding:6px 8px;border-radius:8px;background:' +
        (r.status === 'online' ? '#ecfdf5' : r.status === 'needLogin' ? '#fef3c7' : r.status === 'offline' ? '#fee2e2' : '#fef3c7') + ';border:1px solid ' +
        (r.status === 'online' ? '#a7f3d0' : r.status === 'needLogin' ? '#fde68a' : r.status === 'offline' ? '#fecaca' : '#fde68a') + '">' +
        (r.status === 'online'
          ? '<span style="color:#047857">✅ سرور در دسترس است و نشست/توکن معتبر است</span>'
          : r.status === 'needLogin'
            ? '<span style="color:#b45309">⚠️ نشست/توکن منقضی شده — دوباره وارد شوید</span>'
            : r.status === 'offline'
              ? '<span style="color:#b91c1c">❌ عدم دسترسی به سرور — وای‌فای/اینترنت را بررسی کنید</span>'
              : '<span style="color:#b45309">⚠️ خطای سرور: ' + escP(r.error || 'نامشخص') + '</span>') +
        '</div>');
    });
  };
  /* v33.20.0 (آینهٔ خالدار): کلیدهای سنگین فاز B در حافظه/IndexedDB نگهداری می‌شوند.
     rd/wr مسیر «رشتهٔ کلید» را از client-server.js می‌پرسند؛ fallback = localStorage مثل قبل. */
  function rd(k) {
    try { if (typeof window.ptfBRead === 'function') { var v = window.ptfBRead(k); if (v !== null) return v; } } catch (e) {}
    try { return localStorage.getItem(k); } catch (e) { return null; }
  }
  function wr(k, s) {
    /* همهٔ writeهای داخلی sync (pull/merge/projection) باید cache خواندن فاز B را
       نیز عوض کنند؛ این مسیر setData و صف push را عمداً فعال نمی‌کند. */
    try {
      if (typeof window.ptfBApplyServerProjection === 'function') return window.ptfBApplyServerProjection(k, s, 0);
      if (typeof window.ptfBMirror === 'function' && window.ptfBMirror(k, s)) return true;
    } catch (e) {}
    try { localStorage.setItem(k, s); return true; } catch (e2) { return false; }
  }
  /* v35: پاسخ یک فرمان اتمیک sales-domain قبلاً روی سرور commit شده است؛ اعمال
     Projection آن روی cache نباید دوباره dirty/push شود و با نسخه خودش تعارض بسازد.
     v34.7.14: rev دقیق پاسخ و cache فاز B نیز بخشی از همین قرارداد اتمیک هستند. */
  /* v34.8.5 — OPEX command responses are identity-scoped merge deltas.
     Omission never deletes a row; _opexRowId, recurringKey, then cd are aliases. */
  function ptfOpexIdentityValue(row, field) {
    return row && typeof row === 'object' ? String(row[field] == null ? '' : row[field]).trim() : '';
  }
  function ptfOpexHasIdentity(row) {
    return !!(ptfOpexIdentityValue(row, '_opexRowId') || ptfOpexIdentityValue(row, 'recurringKey') || ptfOpexIdentityValue(row, 'cd'));
  }
  function ptfProtectedFinanceAliases(key, row) {
    /* recurringKey is a domain identity and duplicates may legitimately share it. A
       physical row ID/code must win before that migration fallback. */
    var fields = key === 'ptf_crm_opex' ? ['_opexRowId', 'cd', 'recurringKey'] : ['cd', 'recurringKey'];
    return fields.map(function (field) { var value = ptfOpexIdentityValue(row, field); return value ? field + ':' + value : ''; }).filter(Boolean);
  }
  function ptfProtectedFinanceFind(rows, key, row) {
    var aliases = ptfProtectedFinanceAliases(key, row);
    /* Field-first search is significant: candidate-first would let the first sibling's
       shared recurringKey shadow a later exact _opexRowId/cd match. */
    for (var a = 0; a < aliases.length; a++) {
      for (var i = 0; i < rows.length; i++) if (ptfProtectedFinanceAliases(key, rows[i]).indexOf(aliases[a]) >= 0) return i;
    }
    return -1;
  }
  /* A protection conflict is not an ordinary stale-revision conflict: the returned
     snapshot already contains every accepted local annotation and intentionally omits
     forged recurring identities/core fields. Begin with that protected result so it
     converges instead of reintroducing the rejected payload forever. Fields edited
     again while the request was in flight are preserved by a small three-way check. */
  function ptfMergeProtectedFinanceConflict(key, currentStr, submittedStr, protectedStr) {
    try {
      var current = JSON.parse(currentStr || '[]'), submitted = JSON.parse(submittedStr || '[]'), protectedRows = JSON.parse(protectedStr || '[]');
      if (!Array.isArray(current) || !Array.isArray(submitted) || !Array.isArray(protectedRows)) return protectedStr;
      var out = protectedRows.slice();
      current.forEach(function (localRow) {
        if (!localRow || typeof localRow !== 'object') return;
        var remoteAt = ptfProtectedFinanceFind(out, key, localRow);
        var sentAt = ptfProtectedFinanceFind(submitted, key, localRow);
        if (remoteAt < 0) {
          /* Present in submitted but absent from protected = rejected new recurring.
             A genuinely new edit made after this request remains queued for next push. */
          if (sentAt < 0) out.push(localRow);
          return;
        }
        var remoteRow = out[remoteAt] || {}, merged = {}, sentRow = sentAt >= 0 ? submitted[sentAt] : null;
        /* Protected is already server+accepted-submission. Do not copy loser fields:
           absence here is an intentional removal of a server-owned forged value. */
        Object.keys(remoteRow).forEach(function (field) { merged[field] = remoteRow[field]; });
        if (sentRow) {
          var fields = {};
          Object.keys(localRow).forEach(function (field) { fields[field] = true; });
          Object.keys(sentRow).forEach(function (field) { fields[field] = true; });
          Object.keys(fields).forEach(function (field) {
            var localHas = Object.prototype.hasOwnProperty.call(localRow, field), sentHas = Object.prototype.hasOwnProperty.call(sentRow, field);
            var changedAfterSend = localHas !== sentHas || (localHas && JSON.stringify(localRow[field]) !== JSON.stringify(sentRow[field]));
            if (!changedAfterSend) return;
            if (localHas) merged[field] = localRow[field]; else delete merged[field];
          });
        }
        out[remoteAt] = merged;
      });
      return JSON.stringify(out);
    } catch (e) { return protectedStr; }
  }
  window.ptfMergeProtectedFinanceConflict = ptfMergeProtectedFinanceConflict;
  function ptfOpexExplicitTombstone(row) {
    return !!(row && (row.explicitDeletion || row.manualVoid || String(row.voidIntent || '') === 'explicit'));
  }
  function ptfOpexTerminal(row) {
    if (!row) return false;
    var terminal = ['void', 'voided', 'cancelled', 'deleted', 'replaced', 'superseded'];
    var status = String(row.status || '').toLowerCase(), st = String(row.st || '').toLowerCase();
    return terminal.indexOf(status) >= 0 || terminal.indexOf(st) >= 0 || !!row.voided || !!row.deleted;
  }
  function ptfOpexFindIdentityIndex(rows, incoming) {
    var incomingRowId = ptfOpexIdentityValue(incoming, '_opexRowId');
    var i, value;
    if (incomingRowId) {
      for (i = 0; i < rows.length; i++) if (ptfOpexIdentityValue(rows[i], '_opexRowId') === incomingRowId) return i;
      /* Alias an un-migrated local row to its new server ID, but never merge into a
         sibling that already owns a different physical ID. This preserves an active
         canonical row and its duplicate tombstone as two independently addressable rows. */
      for (var f = 0; f < 2; f++) {
        var field = f === 0 ? 'cd' : 'recurringKey'; value = ptfOpexIdentityValue(incoming, field);
        if (!value) continue;
        for (i = 0; i < rows.length; i++) {
          var candidateId = ptfOpexIdentityValue(rows[i], '_opexRowId');
          if ((!candidateId || !rows[i].serverOwnedIdentity) && ptfOpexIdentityValue(rows[i], field) === value) return i;
        }
      }
      return -1;
    }
    /* Legacy snapshots without row IDs prefer cd; recurringKey is only the final
       migration fallback because duplicate materializations share it by design. */
    for (var legacyField = 0; legacyField < 2; legacyField++) {
      var fieldName = legacyField === 0 ? 'cd' : 'recurringKey'; value = ptfOpexIdentityValue(incoming, fieldName);
      if (!value) continue;
      for (i = 0; i < rows.length; i++) if (ptfOpexIdentityValue(rows[i], fieldName) === value) return i;
    }
    return -1;
  }
  function ptfOpexMergeRecord(localRow, remoteRow, preferRemote) {
    localRow = localRow && typeof localRow === 'object' ? localRow : {};
    remoteRow = remoteRow && typeof remoteRow === 'object' ? remoteRow : {};
    var winnerRemote = !!preferRemote;
    var remoteRestore = String(remoteRow.restoreIntent || '') === 'explicit';
    /* A pull used for ACK recovery must still accept server-owned recurring fields;
       local-only annotations survive because the loser object is copied first. */
    if (remoteRow.serverReconciled || remoteRow.serverMaterialized || remoteRestore) winnerRemote = true;
    /* Automatic active materialization cannot resurrect an explicit local tombstone. */
    if (ptfOpexExplicitTombstone(localRow) && !ptfOpexTerminal(remoteRow) && !remoteRestore) winnerRemote = false;
    /* A server terminal row is an upserted tombstone, not an instruction to filter. */
    if (ptfOpexTerminal(remoteRow) && (ptfOpexExplicitTombstone(remoteRow) || remoteRow.serverReconciled)) winnerRemote = true;
    var winner = winnerRemote ? remoteRow : localRow;
    var loser = winnerRemote ? localRow : remoteRow;
    var merged = {};
    Object.keys(loser).forEach(function (key) { merged[key] = loser[key]; });
    Object.keys(winner).forEach(function (key) { merged[key] = winner[key]; });
    /* JSON cannot carry `undefined` removals. An authoritative active/explicit-restore
       row therefore clears stale local terminal markers after field preservation. */
    if (winnerRemote && !ptfOpexTerminal(remoteRow)) {
      ['voided','voidAt','voidedAt','voidBy','voidedBy','voidReason','deleted','deletedAt','deletedBy','deleteReason','explicitDeletion','manualVoid','voidIntent','eligibilityVoid'].forEach(function (key) { delete merged[key]; });
      /* `st=settled` is an active payment state, not a tombstone. Preserve any st that
         the authoritative row actually carries; only clear a stale local st when the
         authoritative active row omits it. */
      if (Object.prototype.hasOwnProperty.call(remoteRow, 'st')) merged.st = remoteRow.st; else delete merged.st;
      merged.status = remoteRow.status || 'active';
    }
    return merged;
  }
  function ptfOpexMergeArrays(localRows, remoteRows, preferRemote) {
    var out = Array.isArray(localRows) ? localRows.slice() : [];
    (Array.isArray(remoteRows) ? remoteRows : []).forEach(function (remoteRow) {
      if (!remoteRow || typeof remoteRow !== 'object' || !ptfOpexHasIdentity(remoteRow)) return;
      var at = ptfOpexFindIdentityIndex(out, remoteRow);
      if (at < 0) out.push(remoteRow);
      else out[at] = ptfOpexMergeRecord(out[at], remoteRow, preferRemote);
    });
    return out;
  }
  function ptfOpexMergeStrings(localStr, remoteStr, preferRemote) {
    try {
      var localRows = JSON.parse(localStr || '[]'), remoteRows = JSON.parse(remoteStr || '[]');
      if (!Array.isArray(localRows) || !Array.isArray(remoteRows)) return localStr || '[]';
      return JSON.stringify(ptfOpexMergeArrays(localRows, remoteRows, preferRemote));
    } catch (e) { return localStr || '[]'; }
  }
  function ptfOpexEnvelopeValid(key, envelope, revision) {
    if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) return false;
    if (envelope.mode !== 'merge-v1' || envelope.collection !== key || envelope.identityVersion !== 'opex-v1') return false;
    var er = Number(envelope.revision), outer = Number(revision);
    /* Every mutating command commits at a positive revision. Missing/zero revisions
       cannot participate in stale-response ordering and are therefore rejected. */
    if (!isFinite(er) || !isFinite(outer) || Math.floor(er) !== er || er <= 0 || outer <= 0 || er !== outer) return false;
    if (!Array.isArray(envelope.upserts) || !Array.isArray(envelope.tombstones)) return false;
    var valid = true;
    envelope.upserts.forEach(function (row) { if (!row || typeof row !== 'object' || !ptfOpexHasIdentity(row) || ptfOpexTerminal(row)) valid = false; });
    envelope.tombstones.forEach(function (row) { if (!row || typeof row !== 'object' || !ptfOpexHasIdentity(row) || !ptfOpexTerminal(row)) valid = false; });
    return valid;
  }
  function ptfOpexApplyEnvelope(localStr, envelope) {
    var rows;
    /* A delta cannot safely recover a malformed/unknown local snapshot. Starting from
       [] here would make every unrelated expense disappear, so reject atomically and
       let the catch-up pull recover the authoritative collection. */
    try { rows = JSON.parse(localStr || '[]'); } catch (e) { return null; }
    if (!Array.isArray(rows)) return null;
    rows = ptfOpexMergeArrays(rows, envelope.upserts, true);
    rows = ptfOpexMergeArrays(rows, envelope.tombstones, true);
    return JSON.stringify(rows);
  }
  window.ptfOpexMergeProjection = function (localRows, envelope) {
    var revision = Number(envelope && envelope.revision);
    if (!ptfOpexEnvelopeValid('ptf_crm_opex', envelope, revision)) return null;
    try { return JSON.parse(ptfOpexApplyEnvelope(JSON.stringify(Array.isArray(localRows) ? localRows : []), envelope)); } catch (e) { return null; }
  };
  /* ptfSmartMerge is declared in the legacy global section after this IIFE; expose the
     closure-safe implementation explicitly instead of relying on an out-of-scope name. */
  window.ptfOpexMergeSnapshots = function (localStr, remoteStr, preferRemote) {
    /* Manual OPEX conflicts are resolved from sync state, never by comparing mixed
       Gregorian/Jalali timestamp fields: clean/startup/ACK pulls prefer server fields;
       an explicitly dirty key keeps the local edit until its conflict re-push. */
    return ptfOpexMergeStrings(localStr, remoteStr, preferRemote === true);
  };

  /* v34.8.6/F0-1 — financial projection safety for sharetx/shareholders.
     A full server projection may omit a local row that has not reached the server yet.
     Omission is therefore not deletion: preserve the local physical identity, mark the
     key dirty, and let the protected server merge receive it on the next push. Existing
     rows use cd as the physical identity; recurringKey is never a substitute because it
     is shared by duplicate/legacy salary rows. */
  function ptfProjectionFilesUnion(a, b) {
    var out = [], seen = {};
    (Array.isArray(a) ? a : []).concat(Array.isArray(b) ? b : []).forEach(function (file) {
      if (!file || typeof file !== 'object') return;
      var id = String(file.key || file.id || '');
      if (!id) { try { id = JSON.stringify(file); } catch (e) { id = String(out.length); } }
      if (seen[id]) return;
      seen[id] = true;
      out.push(file);
    });
    return out;
  }
  function ptfMergeIdentityProjection(key, localStr, remoteStr) {
    try {
      var localRows = JSON.parse(localStr || '[]'), remoteRows = JSON.parse(remoteStr || '[]');
      if (!Array.isArray(localRows) || !Array.isArray(remoteRows)) return { str: remoteStr, preserved: 0 };
      var out = remoteRows.slice(), index = {};
      out.forEach(function (row, at) {
        var id = String(row && row.cd || '').trim();
        if (id && !Object.prototype.hasOwnProperty.call(index, id)) index[id] = at;
      });
      var preserved = 0;
      localRows.forEach(function (localRow) {
        if (!localRow || typeof localRow !== 'object') return;
        var id = String(localRow.cd || '').trim();
        if (!id) return;
        if (!Object.prototype.hasOwnProperty.call(index, id)) {
          out.push(localRow);
          index[id] = out.length - 1;
          preserved++;
          return;
        }
        var at = index[id], remoteRow = out[at] || {}, merged = {};
        /* Remote fields win when both sides have a value; local-only fields are not
           erased by omission (for example payment evidence or legacy annotations). */
        Object.keys(localRow).forEach(function (field) { merged[field] = localRow[field]; });
        Object.keys(remoteRow).forEach(function (field) { merged[field] = remoteRow[field]; });
        if (Array.isArray(localRow.files) || Array.isArray(remoteRow.files)) merged.files = ptfProjectionFilesUnion(localRow.files, remoteRow.files);
        out[at] = merged;
      });
      return { str: JSON.stringify(out), preserved: preserved };
    } catch (e) { return { str: remoteStr, preserved: 0 }; }
  }
  window.ptfSyncMergeServerProjection = function (key, localStr, remoteStr) {
    if (key !== 'ptf_crm_sharetx' && key !== 'ptf_crm_shareholders') return remoteStr;
    var result = ptfMergeIdentityProjection(key, localStr, remoteStr);
    if (result.preserved > 0) {
      state.projectionPreserved[key] = (+state.projectionPreserved[key] || 0) + result.preserved;
      state.dirty[key] = true;
      saveDirty();
      try { setSyncBadge('warn'); } catch (eBadge) {}
      try {
        if (typeof window.ptfBEnqueueKeys === 'function') window.ptfBEnqueueKeys([key]);
        schedulePush();
      } catch (ePreservedPush) {}
    }
    return result.str;
  };
  window.ptfSyncApplyServerProjection = function (k, value, serverRev) {
    try {
      var incomingRev = +serverRev || 0;
      var m = krevs();
      var cur = +m[k] || 0;
      /* پاسخ دیررس فرمان قدیمی حق بازنویسی projection جدیدتری را که pull دیده ندارد. */
      if (incomingRev && cur > incomingRev) return false;
      var serialized;
      if (k === 'ptf_crm_opex') {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          /* Envelope validation is fail-closed and atomic. */
          if (!ptfOpexEnvelopeValid(k, value, incomingRev)) {
            try { console.warn('[PTF Sync] rejected invalid OPEX projection envelope'); } catch (eWarn) {}
            return false;
          }
          serialized = ptfOpexApplyEnvelope(rd(k) || '[]', value);
          if (serialized === null) {
            try { console.warn('[PTF Sync] rejected OPEX delta over malformed local snapshot'); } catch (eMalformed) {}
            return false;
          }
        } else if (Array.isArray(value)) {
          /* Compatibility for non-recurring commands: merge, never replace/delete. */
          serialized = ptfOpexMergeStrings(rd(k) || '[]', JSON.stringify(value), true);
        } else return false;
      } else serialized = typeof value === 'string' ? value : JSON.stringify(value);

      var applied;
      if (typeof window.ptfBApplyServerProjection === 'function') {
        applied = window.ptfBApplyServerProjection(k, serialized, incomingRev);
      } else applied = wr(k, serialized);
      if (applied === false) return false;

      /* برخلاف v34.7.13، از کف global قدیمی استفاده نمی‌کنیم؛ خود rev فرمان،
         watermark دقیق همهٔ کلیدهای commitشده است. */
      if (incomingRev > cur) {
        m[k] = incomingRev;
        saveKrevs(m);
      }
      /* v34.7.26 (ممیزی شاخه): هر projection پذیرفته‌شده روی کلیدهای مالی، کش محاسبهٔ
         مطالبات را باطل می‌کند. بدون این خط، تا ۱٫۵ ثانیه ممکن بود نماها عدد قبلی را
         نشان دهند (خودترمیم، ولی در لحظهٔ پس از همگام‌سازی گیج‌کننده بود). */
      try {
        if (window.PTF && window.PTF.ar && typeof window.PTF.ar.invalidate === 'function' &&
            ['ptf_crm_invoices', 'ptf_crm_case_receipts', 'ptf_crm_receipt_allocations', 'ptf_crm_deals', 'ptf_crm_sales_returns'].indexOf(k) > -1) {
          window.PTF.ar.invalidate();
        }
      } catch (eArInv) {}
      return true;
    } catch (e) { return false; }
  };
  /* rev سراسری فقط بعد از اعمال موفق همهٔ کلیدهای projection پذیرفته می‌شود. */
  window.ptfSyncAcceptServerRevision = function (serverRev) {
    var incomingRev = +serverRev || 0;
    if (incomingRev > state.lastRev) setRev(incomingRev);
    return state.lastRev;
  };

  /* v31.6.24 BUG-SYNC-AUTH-RACE: a stale/expired token used to make
     data_pull return 401; pullCheck then called done(), bootstrapped the stale
     local dataset, and never retried. Refresh the same server token used by
     showCrm, then retry the pending full/incremental pull. */
  /* v31.8 SEC-AUTH-SESSION-001: coalesce concurrent refresh requests in one
     browser tab. A transient 401 must not result in many parallel auth_login calls. */
  function refreshAuthToken(cb) {
    /* v33.0.1 SEC-AUTH-REAUTH: no silent passhash login. The raw password is not
       available here and the server intentionally accepts only real login/refresh.
       Stop 401 loops and force an explicit server-side login.
       v34.8.6 (AUTH-TOKEN-RACE): token+role+session are cleared together, in one
       synchronous block, in this single place — retryPullAfterAuth no longer deletes
       the token by itself, so the inconsistent «session بدون token» zombie state
       (source of the misleading «توکن معتبر وجود ندارد» screen) cannot appear. */
    try {
      localStorage.removeItem('ptf_crm_token');
      localStorage.removeItem('ptf_crm_token_role');
      localStorage.removeItem('ptf_crm_session');
    } catch (eClear) {}
    setSyncBadge('warn');
    try { if (typeof ptfToast === 'function') ptfToast('نشست سرور منقضی شده است؛ لطفاً دوباره وارد شوید.', 'warn'); } catch (eT) {}
    setTimeout(function () {
      try { location.href = 'index.html?reauth=' + Date.now(); } catch (eR) {}
    }, 800);
    if (cb) cb(false);
  }
  window.ptfSyncRefreshAuth = refreshAuthToken;
  function retryPullAfterAuth(done, forceFull, opts) {
    state.authWait = (state.authWait || 0) + 1;
    setSyncBadge('warn');
    if (state.authWait > 3) { if (done) done({ ok: false, reason: 'auth' }); return; }
    refreshAuthToken(function (ok) {
      /* گزینهٔ instant باید در retry حفظ شود؛ نسخهٔ قبلی بعد از refresh توکن دوباره
         وارد throttle تب پس‌زمینه می‌شد و «pull فوری» تا سه دقیقه عقب می‌افتاد. */
      if (ok) setTimeout(function () { pullCheck(done, forceFull, opts); }, 0);
      else setTimeout(function () { pullCheck(done, forceFull, opts); }, 1000);
    });
  }
  function pushViaPhaseB(done) {
    try {
      if (typeof window.ptfBFlushQueue !== 'function') return false;
      var dirtyKeys = Object.keys(state.dirty);
      if (typeof window.ptfBEnqueueKeys === 'function' && !window.ptfBEnqueueKeys(dirtyKeys)) {
        dirtyKeys.forEach(function (k) { noteWriteFailure(k, 'صف فاز B روی مرورگر پایدار نشد'); });
        if (typeof done === 'function') done(false, { reason: 'phase-b-queue-persist-failed' });
        return true;
      }
      if (state.pushing) {
        if (typeof done === 'function') setTimeout(function () { pushViaPhaseB(done); }, 50);
        return true;
      }
      state.pushing = true;
      window.ptfBFlushQueue(function (result) {
        state.pushing = false;
        state.lastPushResult = result || null;
        if (typeof done === 'function') { try { done(!!(result && result.ok), result || {}); } catch (eDone) {} }
      });
      return true;
    } catch (ePhasePush) {
      state.pushing = false;
      state.lastPushResult = { ok: false, reason: 'phase-b-exception', error: String(ePhasePush || '') };
      if (typeof done === 'function') done(false, state.lastPushResult);
      return true;
    }
  }
  function pushDirty() {
    try {
      if (typeof window.ptfBPhaseActive === 'function' && window.ptfBPhaseActive()) {
        pushViaPhaseB();
        return;
      }
    } catch (ePhase) {}
    var keys = Object.keys(state.dirty).filter(function (k) { return !syncKeyHeld(k); });
    var forbiddenLocal = keys.filter(function (k) { return !syncAllowedKey(k); });
    forbiddenLocal.forEach(function (k) { delete state.dirty[k]; });
    if (forbiddenLocal.length) { saveDirty(); setSyncBadge('forbidden'); try { audit('سیستم', '⛔ کلیدهای خارج از allowlist نقش در sync ارسال نشد: ' + forbiddenLocal.join('، '), 'SYNC-RBAC'); } catch (eF) {} }
    keys = keys.filter(function (k) { return forbiddenLocal.indexOf(k) < 0; });
    if (!keys.length) { notifyPushWaiters(true, { empty: true }); return; }
    if (state.pushing) return;
    if (!curSession().user) { notifyPushWaiters(false, { reason: 'session' }); return; }
    /* v15.0 (US-384): قبل از کامل شدن سینک اولیه، هیچ push‌ای نرود —
       ریشه کیس استادی: رفرش کاربر دوم، حین رندر (مهاجرت وضعیت‌ها/فلگ‌های انقضا) setData روی
       داده کهنه می‌زد و لیست قدیمی را قبل از pull به سرور می‌فرستاد → پیش‌نویس کاربر اول حذف می‌شد. */
    if (!state.bootstrapped) { schedulePush(); return; }
    if (!hasSyncToken()) { setSyncBadge('warn'); notifyPushWaiters(false, { reason: 'token' }); return; }
    /* v14.7 (US-382 AC2): سد push خالی روی کلید حیاتی که قبلا ناخالی بوده */
    if (!window._ptfGoLiveWipe) {
      var gc = guardCounts();
      keys = keys.filter(function (k) {
        if (GUARD_KEYS.indexOf(k) < 0) return true;
        if ((+gc[k] || 0) < 4) return true;
        try {
          var arr = JSON.parse(rd(k) || '[]');
          if (Array.isArray(arr) && arr.length === 0) {
            delete state.dirty[k];
            saveDirty();
            if (!window._ptfZeroWarned) {
              window._ptfZeroWarned = true;
              alert('🛡 سپر داده (US-382): فهرست «' + k.replace('ptf_crm_', '') + '» در این دستگاه خالی است ولی سرور نسخه ناخالی دارد — ارسال متوقف شد تا داده سرور پاک نشود.\n(در صورت نیاز واقعی به پاک‌سازی، از «شروع بهره‌برداری واقعی» در تنظیمات استفاده کنید)');
            }
            try { audit('سیستم', '🛡 سپر داده‌صفر: push خالی ' + k + ' مسدود شد (US-382)', k); } catch (eG) {}
            return false;
          }
        } catch (e2) {}
        return true;
      });
      if (!keys.length) { notifyPushWaiters(true, { empty: true }); return; }
    }
    massDropCheck(); /* v14.7 US-382 AC3 */
    state.pushing = true;
    var data = {}, submittedLocal = {};
    keys.forEach(function (k) {
      var v = rd(k);
      if (v !== null) {
        /* Keep the exact local generation captured for this request. If setData writes
           the same key while fetch is in flight, this ACK must not clear that newer
           dirty generation merely because the server accepted the older payload. */
        submittedLocal[k] = v;
        data[k] = (typeof window.ptfApplyDeletionTombstones === 'function') ? window.ptfApplyDeletionTombstones(k, v) : v;
      }
    });
    /* v15.0 (US-384): مبنای نسخه هر کلید همراه push — سرور نوشتن روی نسخه جدیدتر را رد می‌کند */
    var base = {};
    var km = krevs();
    keys.forEach(function (k) { base[k] = +km[k] || 0; });
    fetch(API + '?action=data_push', {
      method: 'POST',
      headers: authHeaders(true),
      body: JSON.stringify({ by: curSession().name, data: data, base: base })
    }).then(function (r) { return r.json(); })
      .then(function (d) {
        state.pushing = false;
        state.lastPushResult = d || null;
        if (d.ok) {
          applyKrevs(d.krevs); /* v15.0 */
          var confl = d.conflicts || [];
          var rejected = d.rejected || [];
          var skipped = d.skipped || [];
          var forbidden = d.forbidden || [];
          /* پاسخ ok فقط یعنی درخواست پردازش شد، نه اینکه همهٔ کلیدها ذخیره شدند.
             حذف dirty صرفاً با ACK صریح هر کلید مجاز است؛ در غیر این صورت پیام زرد
             باید بماند تا کاربر با سبزشدن کاذب، تغییرِ نرسیده را امن تصور نکند. */
          var hasAckList = Array.isArray(d.savedKeys);
          var savedKeys = hasAckList ? d.savedKeys : [];
          var unacknowledged = [];
          savedKeys.forEach(function (k) {
            if (keys.indexOf(k) < 0 || confl.indexOf(k) >= 0 || rejected.indexOf(k) >= 0 || skipped.indexOf(k) >= 0 || forbidden.indexOf(k) >= 0) return;
            /* ACK belongs to submittedLocal[k], not to an edit made after fetch began. */
            if (Object.prototype.hasOwnProperty.call(submittedLocal, k) && sameSyncJson(rd(k), submittedLocal[k])) delete state.dirty[k];
            else state.dirty[k] = true;
          });
          keys.forEach(function (k) {
            if (!hasAckList || (savedKeys.indexOf(k) < 0 && confl.indexOf(k) < 0 && rejected.indexOf(k) < 0 && skipped.indexOf(k) < 0 && forbidden.indexOf(k) < 0)) {
              if (unacknowledged.indexOf(k) < 0) unacknowledged.push(k);
              state.dirty[k] = true;
            }
          });
          if (!hasAckList) noteSyncError('push', 'ack', 'savedKeys_missing', d);
          saveDirty();
          state.lastPushResult = Object.assign({}, d, { unacknowledged: unacknowledged });
          if (+d.rev > (+state.lastRev || 0)) setRev(d.rev);
          pingTabs(); /* v33.21.1: پوش موفق → تب‌های دیگر همین مرورگر فوری دلتا-پول بزنند */
          /* v15.0 (US-384): تعارض = دستگاه دیگری زودتر نوشته → ادغام هوشمند با نسخه سرور و ارسال مجدد */
          if (confl.length) {
            var protectedConfl = Array.isArray(d.protectedConflicts) ? d.protectedConflicts : [];
            confl.forEach(function (k) {
              try {
                var srvStr = (d.serverData || {})[k];
                if (typeof srvStr !== 'string') return;
                var merged;
                if (protectedConfl.indexOf(k) >= 0 && typeof window.ptfMergeProtectedFinanceConflict === 'function') {
                  merged = window.ptfMergeProtectedFinanceConflict(k, rd(k), data[k], srvStr);
                } else merged = (typeof window.ptfSmartMerge === 'function') ? window.ptfSmartMerge(k, rd(k), srvStr) : srvStr;
                if (typeof window.ptfApplyDeletionTombstones === 'function') merged = window.ptfApplyDeletionTombstones(k, merged);
                state.pulling = true; /* جلوگیری از حلقه dirty هنگام اعمال */
                wr(k, merged);
                state.pulling = false;
                state.dirty[k] = true; /* نتیجه ادغام دوباره push می‌شود (این‌بار با base جدید پذیرفته می‌شود) */
              } catch (eM) {}
            });
            try { audit('سیستم', '🔀 تعارض همزمانی سینک روی ' + confl.join('، ') + ' — ادغام هوشمند انجام و مجدد ارسال شد (US-384)', 'SYNC'); } catch (eA) {}
            refreshCurrentPanel();
            schedulePush();
          }
          if (forbidden.length) {
            setSyncBadge('forbidden');
            try { audit('سیستم', '⛔ سرور کلیدهای خارج از allowlist نقش را رد کرد: ' + forbidden.join('، '), 'SYNC-RBAC'); } catch (eF2) {}
          } else if (rejected.length || skipped.length || unacknowledged.length) {
            setSyncBadge('warn');
            try { if (typeof ptfToast === 'function') ptfToast('⚠️ ' + Math.max(rejected.length + skipped.length, unacknowledged.length) + ' تغییر هنوز روی سرور تأیید نشده است؛ تب را نبندید و وضعیت همگام‌سازی را بررسی کنید.', 'warn'); } catch (eAck) {}
            schedulePush();
          } else setSyncBadge('ok');
          notifyPushWaiters(!confl.length && !forbidden.length && !rejected.length && !skipped.length && !unacknowledged.length, { conflicts: confl, forbidden: forbidden, rejected: rejected, skipped: skipped, savedKeys: savedKeys, unacknowledged: unacknowledged });
        } else {
          setSyncBadge('warn');
          /* v34.7.91 (SYNC-DIAG-001): ثبت علت دقیق رد شدن push برای تشخیص/نمایش */
          noteSyncError('push', d.needLogin ? 'needLogin' : (d.error === 'Forbidden: role not allowed' ? 'forbidden' : 'server'), d.error || (d.needLogin ? 'نشست منقضی' : ''), d);
          /* v33.2.1 HOTFIX: اگر push ناموفق بود، هشدار واضح بده — تغییرات محلی حفظ می‌شوند */
          if (d.needLogin) {
            refreshAuthToken();
          } else if (d.error === 'Forbidden: role not allowed') {
            setSyncBadge('forbidden');
            try { if (typeof ptfToast === 'function') ptfToast('⛔ تغییرات شما ذخیره نشد — نقش فعلی اجازه ویرایش این بخش را ندارد. تغییرات محلی حفظ شده‌اند.', 'warn'); } catch (eT) {}
          } else {
            try { if (typeof ptfToast === 'function') ptfToast('⚠️ ذخیره در سرور ناموفق — تغییرات محلی حفظ شده‌اند و بعداً تلاش مجدد می‌شود. خطا: ' + (d.error || ''), 'warn'); } catch (eT) {}
          }
          saveDirty(); // v33.2.1: dirty keys persisted for recovery after refresh
          schedulePush(); // دوباره تلاش
          notifyPushWaiters(false, { reason: d.error || 'push-fail' });
        }
      })
      .catch(function (error) {
        state.pushing = false;
        state.lastPushResult = { ok: false, reason: 'network', error: String(error || '') };
        state.online = false;
        noteSyncError('push', 'network', '', error || '');
        setSyncBadge('offline');
        notifyPushWaiters(false, { reason: 'network' });
        setTimeout(schedulePush, 15000); // آفلاین: تلاش مجدد
      });
  }

  window.ptfSyncFlushNow = function (cb) {
    /* Phase B owns the write transport. The public retry/barrier API stays the same,
       but delegates to the keyed queue and returns its exact per-key ACK result. */
    try {
      if (typeof window.ptfBPhaseActive === 'function' && window.ptfBPhaseActive()) {
        if (pushViaPhaseB(function (ok, result) {
          if (typeof cb === 'function') { try { cb(!!ok, result || {}); } catch (eBcb) {} }
        })) return;
      }
    } catch (ePhaseFlush) {}
    if (typeof cb === 'function') pushWaiters.push(cb);
    if (!Object.keys(state.dirty).length) { notifyPushWaiters(true, { empty: true }); return; }
    clearTimeout(state.pushTimer);
    pushDirty();
  };
  /* A domain command that derives rows from another store needs a stronger barrier
     than a generic "some push completed" callback. In particular, a write may occur
     while an older generation of that same key is already in flight. Wait until the
     requested keys themselves have no unacknowledged generation before issuing the
     command; never let an unrelated/in-flight ACK release this barrier. */
  window.ptfSyncFlushKeysNow = function (requestedKeys, cb) {
    var keys = (Array.isArray(requestedKeys) ? requestedKeys : [requestedKeys]).map(function (k) { return String(k || ''); }).filter(function (k, i, a) { return !!k && a.indexOf(k) === i; });
    var finished = false, deadline = Date.now() + 30000;
    function finish(ok, extra) {
      if (finished) return;
      finished = true;
      if (typeof cb === 'function') { try { cb(!!ok, extra || {}); } catch (eCb) {} }
    }
    if (!keys.length || keys.some(function (k) { return SYNC_KEYS.indexOf(k) < 0; })) { finish(false, { reason: 'invalid-key' }); return; }
    if (keys.some(function (k) { return !!state.dirty[k] && !syncAllowedKey(k); })) { finish(false, { reason: 'forbidden-dirty-key' }); return; }
    function attempt() {
      if (finished) return;
      if (keys.some(function (k) { return !!state.writeFailures[k]; })) { finish(false, { reason: 'local-write-failure' }); return; }
      var pending = keys.filter(function (k) { return !!state.dirty[k]; });
      if (!pending.length) { finish(true, { keys: keys.slice(), empty: true }); return; }
      if (Date.now() >= deadline) { finish(false, { reason: 'key-flush-timeout', keys: pending }); return; }
      /* Do not attach to the current request: it may carry an older generation. */
      if (state.pushing) { setTimeout(attempt, 50); return; }
      window.ptfSyncFlushNow(function (ok, extra) {
        var remaining = keys.filter(function (k) { return !!state.dirty[k]; });
        if (ok && !remaining.length) { finish(true, { keys: keys.slice(), savedKeys: (extra && extra.savedKeys) || [] }); return; }
        /* Conflict recovery creates a new dirty generation. It is safe to retry the
           barrier, but transport/RBAC/rejection failures must stay fail-closed. */
        if (remaining.length && extra && Array.isArray(extra.conflicts) && extra.conflicts.length && Date.now() < deadline) { setTimeout(attempt, 0); return; }
        finish(false, extra || { reason: 'key-not-acknowledged', keys: remaining });
      });
    }
    attempt();
  };
  window.ptfConfirmCloudSave = function (localMsg) {
    /* سازگاری عقب‌رو با string؛ فرم‌های جدید key/id/label می‌دهند تا رسید دقیق
       همان رکورد را نمایش دهیم. */
    if (localMsg && typeof localMsg === 'object') {
      window.ptfSyncTrackRecordSave(localMsg);
      return;
    }
    if (typeof ptfToast === 'function') ptfToast((localMsg || 'روی این دستگاه ذخیره شد') + ' — در حال ارسال به سرور…', 'info');
    window.ptfSyncFlushNow(function (ok) {
      if (typeof ptfToast !== 'function') return;
      if (ok) ptfToast('روی سرور هم ثبت شد. در دستگاه دیگر بعد از تازه‌سازی دیده می‌شود.', 'ok');
      else ptfToast('هنوز به سرور نرسید. تب را نبندید تا نوار زرد پایین صفحه خاموش و نشانگر همگام سبز شود.', 'warn');
    });
  };

  /* رسید قابل‌فهم برای فرم‌های اصلی: ثبت محلی را با «تأیید سرور» یکی نکنید.
     کلید یک store کامل است، بنابراین ACK همان key یعنی رکوردی که همین لحظه داخل
     snapshot آن قرار گرفته نیز روی سرور نوشته شده است. */
  window.ptfSyncTrackRecordSave = function (opts) {
    opts = opts || {};
    var key = String(opts.key || '');
    var label = String(opts.label || 'رکورد');
    var id = String(opts.id || '');
    if (!key) return;
    try { if (typeof ptfToast === 'function') ptfToast('🟡 ' + label + (id ? ' «' + id + '»' : '') + ' روی این دستگاه ثبت شد؛ در انتظار تأیید سرور…', 'info'); } catch (eT) {}
    function finish(ok, extra) {
      extra = extra || {};
      var ack = (extra.savedKeys || []).indexOf(key) > -1 || (!!extra.empty && Object.keys(state.dirty).indexOf(key) < 0);
      if (ok && ack) {
        try { if (typeof ptfToast === 'function') ptfToast('🟢 ' + label + (id ? ' «' + id + '»' : '') + ' روی سرور تأیید شد.', 'ok'); } catch (eOk) {}
      } else {
        try { if (typeof ptfToast === 'function') ptfToast('🟡 ' + label + (id ? ' «' + id + '»' : '') + ' هنوز تأیید سرور ندارد؛ تب را نبندید.', 'warn'); } catch (eWarn) {}
      }
    }
    /* push در حال اجرا باشد: callback همان push جاری نیست؛ یک تلاش کوتاه بعدی
       رسید را به ACK واقعی وصل می‌کند. */
    if (state.pushing) { setTimeout(function () { window.ptfSyncTrackRecordSave(opts); }, 700); return; }
    window.ptfSyncFlushNow(finish);
  };

  /* ---------- pull دوره‌ای ---------- */
  /* v33.21.1 (به انتخاب کارفرما): پینگ بین‌تبی — هر تب که دادهٔ تازه اعمال کرد یا پوش موفق داشت،
     این نشانگر کوچک را می‌نویسد؛ رویداد storage در بقیهٔ تب‌های همین مرورگر (حتی پنهان) فوری
     می‌شلیکد و یک دلتا-پولِ فوری می‌دهند — همگام‌سازی لحظه‌ای بین تب‌ها بدون رکوئست اضافهٔ دوره‌ای. */
  function pingTabs() {
    try { localStorage.setItem('ptf_sync_ping', JSON.stringify({ rev: state.lastRev, t: Date.now() })); } catch (e) {}
  }

  function pullCheck(done, forceFull, opts) {
    if (!curSession().user) { if (done) done({ ok: false, reason: 'session' }); return; }
    if (state.pushing || state.pullRequesting) { if (done) done({ ok: false, reason: 'busy' }); return; }
    /* v33.21.x (مدیریت تب برای کاهش بار سرور — پیکربندی به تأیید کارفرما):
       متمرکز: هر ۲۰ثانیه | غیرمتمرکزِ دیده‌شده: حداکثر هر ۱۲۰ثانیه | مخفی: حداکثر هر ۱۸۰ثانیه.
       (v33.21.0 مخفی را کامل متوقف می‌کرد که «رکورد دیر ظاهر می‌شود» را به همراه داشت.)
       پینگ بین‌تبی (opts.instant) و forceFull این آهسته‌سازی را دور می‌زنند.
       جبران: focus/visibilitychange → پول فوری (listener در بوت). */
    if (!forceFull && !(opts && opts.instant) && typeof document !== 'undefined') {
      var _isHidden = !!document.hidden;
      var _unfocused = !_isHidden && (typeof document.hasFocus === 'function' && !document.hasFocus());
      if (_isHidden || _unfocused) {
        var _bgNow = Date.now();
        var _bgGap = _isHidden ? 180000 : 120000;
        if (state.lastBgPull && (_bgNow - state.lastBgPull) < _bgGap) { if (done) done({ ok: true, skipped: 'throttled' }); return; }
        state.lastBgPull = _bgNow;
      }
    }
    /* v15.0 (US-384): اگر تغییر محلی معلق داریم، اول push — سرور با base-rev محافظت می‌کند
       (در فاز بوت این مسیر اجرا نمی‌شود چون pushDirty تا bootstrapped صبر می‌کند) */
    if (!forceFull && state.bootstrapped && Object.keys(state.dirty).length && !(opts && opts.allowDirtyMerge)) {
      pushDirty();
      if (done) done({ ok: false, reason: 'dirty-deferred' });
      return;
    }
    if (!hasSyncToken()) { retryPullAfterAuth(done, forceFull, opts); return; }
    state.authWait = 0;
    /* v31.6.23 BUG-SYNC-DIVERGENCE: startup reconciliation must not trust a
       browser's cached global rev. Two browsers can have the same rev marker
       but different localStorage contents; force=0 pulls the complete server
       snapshot and makes the server authoritative before normal polling. */
    var pullSince = forceFull ? 0 : state.lastRev;
    /* v33.21.0 (PTF-SCALE-P0 — دلتا-پول): نقشهٔ rev هرکلید می‌رود تا سرور فقط کلیدهای جدیدتر را بفرستد.
       سرور قدیمی‌تر krevs را نادیده می‌گیرد و مثل قبل اسنپ‌شات کامل می‌فرستد — سازگار با عقب.
       v34.5.2: حتی startup/forceFull هم krevs می‌فرستد تا کلیدهای تازه دوباره دانلود نشوند.
       کلید بدون دادهٔ محلی در krevs نیست → سرور rev=-1 می‌گیرد و آن کلید را می‌فرستد. */
    var pullUrl = API + '?action=data_pull&since=' + pullSince;
    try {
      var kmSend = krevs();
      var kmOut = {};
      Object.keys(kmSend).forEach(function (k) {
        if (SYNC_KEYS.indexOf(k) < 0) return;
        var loc = rd(k);
        if (loc != null && String(loc).length > 2) kmOut[k] = +kmSend[k] || 0;
      });
      pullUrl += '&krevs=' + encodeURIComponent(JSON.stringify(kmOut));
    } catch (eKr) {}
    state.pullRequesting = true;
    function finishPull(result) {
      state.pullRequesting = false;
      result = result || { ok: true };
      state.lastPullResult = result;
      /* پس از bootstrap، هر pull موفق snapshot-ready را دوباره اعلام می‌کند تا
         expected setهای تازه‌رسیده (قالب/سهامدار) نیز entity-level reconcile شوند. */
      if (state.bootstrapped && result.ok !== false) announceSnapshotReady(result);
      if (done) done(result);
    }
    fetch(pullUrl, { headers: authHeaders(false) })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        state.online = true;
        if (!d.ok) {
          /* v34.8.6 (AUTH-TOKEN-RACE): فقط نشانه‌های قطعی auth پول را به مسیر needLogin
             می‌برد؛ خطاهای دیگر (حتی حاوی کلمهٔ token مثل token_issue_failed) نشست را
             نمی‌پاکند. */
          var _pe = String(d.error || '');
          if (d.needLogin === true || _pe === 'authentication_required' || _pe === 'Authentication required' || /^invalid or expired token/i.test(_pe)) {
            noteSyncError('pull', 'needLogin', 'نشست منقضی', d);
            state.pullRequesting = false;
            retryPullAfterAuth(done, forceFull, opts);
            return;
          }
          noteSyncError('pull', 'server', (d.error || 'server') + ' — نوار وضعیت با پیام «سرور در دسترس نیست» خودِ پول است، نه لزوماً قطع شبکه', d);
          finishPull({ ok: false, reason: d.error || 'server' });
          return;
        }
        if (d.fresh) {
          applyServerMeta(d.meta, d.rev);
          setSyncBadge('ok');
          finishPull({ ok: true, fresh: true, rev: d.rev });
          return;
        }
        // سرور جلوتر است → اعمال داده‌ها
        state.pulling = true;
        /* v33.2.1: snapshot خودکار قبل از pull — اگر dirty keys هست و merge اشتباهی انجام شود،
           کاربر از audit log می‌تواند داده‌های قبلی را بازیابی کند */
        var dirtyKeys = Object.keys(state.dirty);
        if (dirtyKeys.length > 0) {
          try {
            var snap = {};
            dirtyKeys.forEach(function (k) { var v = rd(k); if (v) snap[k] = v; });
            if (Object.keys(snap).length > 0) {
              var snapKey = 'ptf_pre_pull_snap_' + Date.now();
              localStorage.setItem(snapKey, JSON.stringify(snap));
              // فقط ۳ snapshot آخر حفظ شود
              var allSnaps = Object.keys(localStorage).filter(function (x) { return x.indexOf('ptf_pre_pull_snap_') === 0; }).sort();
              while (allSnaps.length > 3) { localStorage.removeItem(allSnaps.shift()); }
            }
          } catch (eSnap) {}
        }
        var applied = 0;
        // Sprint 104: Smart Array Merging & Concurrency Control
        Object.keys(d.data || {}).forEach(function (k) {
          if (SYNC_KEYS.indexOf(k) < 0) return;
          var curStr = rd(k);
          var newStr = (typeof window.ptfApplyDeletionTombstones === 'function') ? window.ptfApplyDeletionTombstones(k, d.data[k], (d.data || {})['ptf_crm_deleted_archive']) : d.data[k];
          if (curStr === newStr) return;
          /* command-held side projection (مثلاً catalog پیشنهاد) هنوز عمداً dirty
             نشده است. catch-up pull باید آن را با تغییر دستگاه دیگر merge کند، نه
             اینکه چون state.dirty=false است کورکورانه overwrite کند. */
          if (syncKeyHeld(k) && curStr && typeof window.ptfSmartMerge === 'function') {
            try {
              var heldMerged = window.ptfSmartMerge(k, curStr, newStr, { preferRemoteOpex: !state.dirty[k] });
              if (typeof window.ptfApplyDeletionTombstones === 'function') heldMerged = window.ptfApplyDeletionTombstones(k, heldMerged, (d.data || {})['ptf_crm_deleted_archive']);
              if (heldMerged && heldMerged !== curStr) { wr(k, heldMerged); applied++; }
            } catch (eHeldMerge) {}
            return;
          }
          /* v31.7.2 BUG-SYNC-LOCAL-LOSS: records created before sync.js
             loaded cannot be marked dirty by the wrapper. During the first
             authoritative pull, merge the local/server arrays before any
             overwrite, then push the union with per-record timestamps. */
          if (forceFull && state.initialReconcile && curStr && typeof window.ptfSmartMerge === 'function') {
            try {
              var startupMerged = window.ptfSmartMerge(k, curStr, newStr, { preferRemoteOpex: !state.dirty[k] });
              if (typeof window.ptfApplyDeletionTombstones === 'function') startupMerged = window.ptfApplyDeletionTombstones(k, startupMerged, (d.data || {})['ptf_crm_deleted_archive']);
              if (startupMerged && startupMerged !== curStr) {
                wr(k, startupMerged);
                /* فقط اگر این دستگاه چیزی بیش از نسخهٔ سرور داشته باشد دوباره push شود.
                   اختلاف صرفِ ترتیب کلید/نرمال‌سازی نباید بعد از هر hard refresh dirty بسازد. */
                if (startupMerged !== newStr) state.dirty[k] = true;
                applied++;
              }
            } catch (eStartupMerge) {}
            return;
          }
          
          // If dirty, try smart merge instead of dumb ignore!
          if (state.dirty[k] && typeof window.ptfSmartMerge === 'function') {
            try {
              var merged = window.ptfSmartMerge(k, curStr, newStr);
              if (typeof window.ptfApplyDeletionTombstones === 'function') merged = window.ptfApplyDeletionTombstones(k, merged, (d.data || {})['ptf_crm_deleted_archive']);
              if (merged && merged !== curStr) {
                wr(k, merged);
                applied++;
              }
            } catch(e) {}
            return;
          }
          if (state.dirty[k]) return;
          
          wr(k, newStr);
          applied++;
        });
        state.pulling = false;
        applyServerMeta(d.meta, d.rev);
        if (forceFull && typeof window.ptfAutoRepairSafeDuplicates === 'function') { try { setTimeout(window.ptfAutoRepairSafeDuplicates, 0); } catch (eRepair) {} }
        /* v15.0 (US-384): نسخه per-key سرور ثبت شود تا pushهای بعدی مبنای درست داشته باشند */
        if (typeof ptfUpdateGuardCounts === 'function') ptfUpdateGuardCounts(); /* v14.7 US-382: پس از pull موفق، baseline شمار رکوردها به‌روز شود */
        if (applied) {
          setSyncBadge(Object.keys(state.dirty).length ? 'warn' : 'ok');
          refreshCurrentPanel();
          if (state.bootstrapped && !forceFull && typeof ptfToast === 'function') ptfToast('🔄 ' + applied + ' بخش از دستگاه دیگر به‌روز شد', 'info');
          if (typeof updateInboxBadge === 'function') updateInboxBadge();
          pingTabs(); /* v33.21.1: بقیهٔ تب‌های همین مرورگر را لحظه‌ای مطلع کن */
        }
        finishPull({ ok: true, applied: applied, rev: d.rev }); /* v34.4.34: نتیجه واقعی برای refresh مودال */
      })
      .catch(function (err) {
        state.pulling = false;
        state.online = false;
        noteSyncError('pull', 'network', '', err);
        setSyncBadge('offline');
        finishPull({ ok: false, reason: 'network', error: err });
      });
  }

  // رندر مجدد پنل فعلی پس از دریافت/ثبت داده جدید (بدون پرش وسط مودال)
  function refreshCurrentPanel() {
    if (document.querySelector('.md-b') || document.querySelector('.ptfdlg-b')) return false; // وسط کار کاربر نپر
    /* باگ ۲: جلوگیری از رندر مجدد پنل هنگامی که کاربر روی یک فیلد ورودی/جدول کار می‌کند */
    var ae = document.activeElement;
    if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'SELECT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)) return false;
    if (window.ptfActivePanel === 'rfqs' && (ae && ae.closest && ae.closest('#panels'))) return false;
    /* MOB-003: در mobile سایدبار مخفی است؛ class act ممکن است وجود نداشته باشد.
       active panel مستقل از DOM نگهداری می‌شود و fallback desktop هم حفظ شده است. */
    var id = window.ptfActivePanel || '';
    var act = document.querySelector('.sb-i.act');
    if (!id && act) {
      var m = (act.getAttribute('onclick') || '').match(/goPanel\('([a-z]+)'/);
      id = m ? m[1] : '';
    }
    if (!id || typeof goPanel !== 'function') return false;
    try {
      var btn = (typeof window.ptfFindPanelButton === 'function') ? window.ptfFindPanelButton(id) : act;
      window._ptfNavIsRefresh = true;
      goPanel(id, btn);
      return true;
    } catch (e) {
      return false;
    } finally {
      window._ptfNavIsRefresh = false;
    }
  }
  var _dataRefreshTimer = 0;
  window.ptfRefreshCurrentPanel = refreshCurrentPanel;
  /* CHQ-DOC-002 (۱۴۰۵/۰۵/۱۹): پول فوری و به‌درخواست — برای مودال‌هایی که سند/ضمیمه
     نمایش می‌دهند (چک، تنخواه، فاکتور/پرداخت تأمین‌کننده). این مودال‌ها هنگام باز شدن
     یک‌بار از localStorage محلی می‌خوانند؛ اگر آخرین pull دوره‌ای (هر ۲۰ثانیه، یا کندتر
     در تب پس‌زمینه) هنوز سندِ تازه‌ثبت‌شده (از دستگاه/کاربر دیگر) را نیاورده باشد، و چون
     refreshCurrentPanel() عمداً هنگام باز بودن هر مودالی رندر خودکار را متوقف می‌کند
     («وسط کار کاربر نپر»)، مودال هرگز به‌خودی‌خود به‌روز نمی‌شد — کاربر باید به تب دیگری
     می‌رفت و برمی‌گشت تا goPanel() دوباره از localStorage (که تا آن لحظه pull دوره‌ای
     به‌روزش کرده بود) بخواند. این تابع امکان درخواست pull فوری (بدون منتظر ماندن برای
     تایمر ۲۰ثانیه‌ای) را به آن مودال‌ها می‌دهد تا خودشان را (بدون رندر کل پنل) به‌روز کنند. */
  /* v34.4.34 RCA: نسخهٔ قبلی در دو حالت بدون هیچ pull واقعی callback را فوراً صدا
     می‌زد: وقتی push در جریان بود، یا وقتی dirty key وجود داشت (push async شروع می‌شد
     اما callback همان لحظه اجرا می‌شد). مودال سپس before/after یکسان می‌دید و همان
     ضمیمهٔ کهنه را نگه می‌داشت. درخواست‌های فوری اکنون coalesce می‌شوند، تا پایان push/
     pull جاری صبر می‌کنند و با allowDirtyMerge یک pull واقعی و conflict-safe می‌زنند. */
  var instantPullWaiters = [];
  var instantPullRunning = false;
  var instantPullRetryTimer = 0;
  function drainInstantPulls() {
    if (instantPullRunning || !instantPullWaiters.length) return;
    if (state.pushing || state.pullRequesting || state.pulling) {
      clearTimeout(instantPullRetryTimer);
      instantPullRetryTimer = setTimeout(drainInstantPulls, 60);
      return;
    }
    instantPullRunning = true;
    var waiters = instantPullWaiters.splice(0);
    try {
      pullCheck(function (result) {
        instantPullRunning = false;
        waiters.forEach(function (fn) { try { fn(result || { ok: true }); } catch (eCb) {} });
        if (instantPullWaiters.length) setTimeout(drainInstantPulls, 0);
      }, false, { instant: true, allowDirtyMerge: true });
    } catch (e) {
      instantPullRunning = false;
      waiters.forEach(function (fn) { try { fn({ ok: false, reason: 'exception', error: e }); } catch (eCb2) {} });
      if (instantPullWaiters.length) setTimeout(drainInstantPulls, 0);
    }
  }
  window.ptfSyncPullNow = function (cb) {
    instantPullWaiters.push(typeof cb === 'function' ? cb : function () {});
    drainInstantPulls();
  };
  /* v34.8.22 (T5-1): نوشتن بی‌صدا — فقط برای ترفندهای نمایش (مثل فیلتر کالاهای
     مخفی حین رندر)؛ نه dirty می‌سازد نه push. تغییر «داده» هرگز از این مسیر نیست. */
  window.ptfSilentWrite = function (k, str) {
    try {
      state.pulling = true;
      wr(k, String(str == null ? '' : str));
    } catch (eSW) {}
    finally { state.pulling = false; }
  };
  /* ============ v34.8.31 (T3-1): خواندن سرور-محور ============
     collectionQuery: فیلتر/مرتب/صفحهٔ سروری — مصرف اصلی بوت دستگاه جدید و
     پنل‌های فهرست‌محور، بدون دانلود کل دیتاست. فقط-خواندنی؛ نوشتن همچنان فقط
     از مسیر فرمان/setData (لایهٔ داده). */
  window.ptfCollectionQuery = function (collection, opts, cb) {
    opts = opts || {};
    try {
      var t = localStorage.getItem('ptf_crm_token');
      /* v34.8.33: نبود توکن = خطای قطعی محلی — بدون fetch (caller فوراً fallback می‌کند) */
      if (!t) { cb && cb({ ok: false, error: 'no_token', needLogin: true }); return; }
      var params = new URLSearchParams({ action: 'collection_query', collection: collection });
      if (opts.q) params.append('q', String(opts.q));
      if (opts.sortBy) params.append('sortBy', String(opts.sortBy));
      if (opts.sortDir) params.append('sortDir', String(opts.sortDir));
      if (opts.page) params.append('page', String(opts.page));
      if (opts.pageSize) params.append('pageSize', String(opts.pageSize));
      if (opts.fields) params.append('fields', String(opts.fields));
      Object.keys(opts).forEach(function (k) {
        if (['q','sortBy','sortDir','page','pageSize','fields','eq'].indexOf(k) > -1) return;
        if (typeof opts[k] === 'string' || typeof opts[k] === 'number') params.append(k, String(opts[k]));
      });
      var h = { 'Cache-Control': 'no-store' };
      if (t) h['X-CRM-Token'] = t;
      fetch('../api/crm.php?' + params.toString(), { method: 'GET', headers: h, cache: 'no-store' })
        .then(function (r) { return r.json(); })
        .then(function (d) { cb && cb(d); })
        .catch(function (e) { cb && cb({ ok: false, error: (e && e.message) || 'network' }); });
    } catch (eQ) { cb && cb({ ok: false, error: String(eQ) }); }
  };
  window.ptfScheduleDataRefresh = function (key) {
    /* باگ ۲: ماژول درخواست تامین (rfqsmart) خودش DOM را حین کار به‌روز می‌کند؛ رندر مجدد کل صفحه ممنوع */
    if ((key === 'ptf_crm_rfqsmart' || key === 'ptf_crm_rfqs') && window.ptfActivePanel === 'rfqs') return;
    clearTimeout(_dataRefreshTimer);
    _dataRefreshTimer = setTimeout(function tryRefresh() {
      /* A save often happens from a modal. Wait for its close, then refresh;
         this keeps the modal usable and removes the need for F5. */
      if (document.querySelector('.md-b') || document.querySelector('.ptfdlg-b')) {
        _dataRefreshTimer = setTimeout(tryRefresh, 120);
        return;
      }
      refreshCurrentPanel();
    }, 0);
  };

  /* ---------- نشانگر وضعیت سینک ---------- */
  var _lastSyncBadge = 'ok';
  var _noticeResizeBound = false;
  var _noticeBannerObserver = null;

  /* MOB-004: banner پایدار sync و toast کوتاه‌مدت باید بالای bottom-nav و به
     صورت stack دیده شوند. ارتفاع banner به CSS variable داده می‌شود تا toast
     حتی وقتی پیام banner چندخطی است با آن هم‌پوشانی نداشته باشد. */
  /* v34.8.20 (STAGING-BANNER-LIFT): بنر نارنجی «محیط تست» هم bottom:0 و z-index بالاتر
     دارد و نوار زرد/بنر قرمز را می‌پوشاند — گزارش کارفرما: «متن نوار زرد دیده نمی‌شود».
     ارتفاع آن (وقتی موجود است) به آفست نوار و toast ها اضافه می‌شود. در پروداکشن این
     عنصر وجود ندارد ⇒ همه‌چیز مثل قبل، صفر. */
  function stagingBannerH() {
    try {
      var sb = document.getElementById('ptf-staging-banner');
      if (!sb) return 0;
      var h = sb.getBoundingClientRect().height || sb.offsetHeight || 0;
      return h ? Math.ceil(h) : 0;
    } catch (e) { return 0; }
  }
  function ensureNoticeMobileStyle() {
    if (document.getElementById('ptfSyncNoticeMobileCss')) return;
    var sbAdd = stagingBannerH() ? (' + ' + stagingBannerH() + 'px') : '';
    var css = document.createElement('style');
    css.id = 'ptfSyncNoticeMobileCss';
    css.textContent = '@media(max-width:768px), (max-width:900px) and (max-height:600px) and (orientation:landscape){#ptfUnsavedBanner{bottom:calc(74px + env(safe-area-inset-bottom,0px) + 8px' + sbAdd + ')!important;left:8px!important;right:8px!important;width:auto!important;max-width:calc(100vw - 16px)!important;box-sizing:border-box!important;border-radius:14px!important;padding:10px 12px!important;min-height:48px!important;line-height:1.55!important;overflow-wrap:anywhere!important;pointer-events:auto!important}#ptfUnsavedBanner>span{min-width:0!important;overflow-wrap:anywhere!important}}' +
      '@media(max-width:900px) and (max-height:600px) and (orientation:landscape){#ptfUnsavedBanner{bottom:calc(52px + env(safe-area-inset-bottom,0px) + 8px' + sbAdd + ')!important}}';
    document.head.appendChild(css);
  }
  function syncNoticeStackOffset() {
    var root = document.documentElement;
    var banner = document.getElementById('ptfUnsavedBanner');
    if (!root) return;
    var sbH = stagingBannerH();
    /* v34.8.20: دسکتاپ — بنر بالای بنر استیجینگ بنشیند (استایل inline، بدون مدیا کوئری). */
    try { if (banner) banner.style.bottom = sbH ? (sbH + 2) + 'px' : ''; } catch (eB) {}
    var compactLandscape = window.innerWidth <= 900 && window.innerHeight <= 600 && window.matchMedia && window.matchMedia('(orientation:landscape)').matches;
    var visible = banner && (window.innerWidth <= 768 || compactLandscape) && window.getComputedStyle(banner).display !== 'none';
    var offset = (visible ? Math.ceil(banner.getBoundingClientRect().height || banner.offsetHeight || 0) + 12 : 0) + sbH;
    root.style.setProperty('--ptf-unsaved-banner-offset', offset + 'px');
  }
  function queueNoticeStackOffset() {
    /* یک frame برای اعمال display/content و یک frame برای layout نهایی؛ در غیر این
       صورت banner چندخطی ممکن است با ارتفاع نسخهٔ قبلی اندازه‌گیری شود. */
    if (typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(function () { window.requestAnimationFrame(syncNoticeStackOffset); });
    } else setTimeout(syncNoticeStackOffset, 32);
  }
  function watchNoticeBanner(banner) {
    if (!banner || _noticeBannerObserver || typeof window.ResizeObserver !== 'function') return;
    _noticeBannerObserver = new window.ResizeObserver(queueNoticeStackOffset);
    _noticeBannerObserver.observe(banner);
  }
  function setSyncBadge(st) {
    _lastSyncBadge = st;
    var el = document.getElementById('syncBadge');
    if (!el) return;
    var map = {
      ok: ['🟢', 'همگام با سرور'],
      warn: ['🟡', 'در حال تلاش مجدد...'],
      offline: ['🔴', 'آفلاین — تغییرات محلی ذخیره و بعداً ارسال می‌شود'],
      forbidden: ['🟠', 'برخی بخش‌ها برای نقش فعلی قابل sync نیستند'],
      writefail: ['🔴', 'ثبت پایدار روی این دستگاه ناموفق بوده است']
    };
    var x = map[st] || map.ok;
    el.textContent = x[0];
    el.title = x[1];
    /* v33.2.1: بنر هشدار تغییرات ذخیره‌نشده */
    var banner = document.getElementById('ptfUnsavedBanner');
    if (banner) {
      var dirtyCount = Object.keys(state.dirty).length;
      var failedKeys = Object.keys(state.writeFailures);
      if (failedKeys.length > 0) {
        banner.style.display = 'flex';
        banner.style.background = '#dc2626'; banner.style.color = '#fff';
        banner.innerHTML = '<span style="flex:1">🔴 ' + failedKeys.length + ' تغییر حتی در حافظهٔ پایدار این دستگاه ذخیره نشد — تب را نبندید؛ فضا/دسترسی را بررسی و ثبت را دوباره انجام دهید. (' + failedKeys.map(function (k) { return k.replace('ptf_crm_', ''); }).join('، ') + ')</span>';
      } else if (dirtyCount > 0) {
        banner.style.display = 'flex';
        banner.style.background = '#f59e0b'; banner.style.color = '#1e293b';
        /* v34.8.19 (YELLOW-BAR-DIAG): تشخیص درجا — کدام کلیدها گیر کرده‌اند + آخرین خطای sync.
           تا امروز بنر فقط «تعداد» می‌داد؛ گزارش کارفرما قابل‌پیگیری نبود. */
        var dkeys = Object.keys(state.dirty).map(function (k) { return k.replace('ptf_crm_', ''); }).slice(0, 6).join('، ') + (dirtyCount > 6 ? '…' : '');
        var le = null;
        try { le = JSON.parse(localStorage.getItem('ptf_sync_last_error') || 'null'); } catch (eLe) {}
        /* v34.8.25: خطا فقط اگر «تازه» باشد (≤۱۵ دقیقه) — خطای ساعت‌های قبل نباید روی نوار فعلی باشد. */
        var leFresh = false;
        try { leFresh = !!(le && le.t && (Date.now() - new Date(le.t).getTime()) < 15 * 60 * 1000); } catch (eLd) {}
        var leTxt = (le && leFresh) ? (' — آخرین خطا: ' + (le.reason || le.detail || le.scope || 'نامشخص') + ' (' + le.fa + ')') : '';
        var msg = st === 'forbidden'
          ? ('⚠️ ' + dirtyCount + ' تغییر روی این دستگاه است — نقش فعلی اجازه ارسال به سرور ندارد [' + dkeys + ']')
          : st === 'offline'
            ? ('🔴 ' + dirtyCount + ' تغییر آفلاین — تب را نبندید تا وصل شود [' + dkeys + ']')
            : ('🟡 ' + dirtyCount + ' تغییر هنوز به سرور نرسیده — تب را نبندید تا نشانگر همگام سبز شود [' + dkeys + ']' + leTxt);
        banner.innerHTML = '<span style="flex:1">' + msg + '</span>';
      } else {
        banner.style.display = 'none';
      }
    }
    queueNoticeStackOffset();
  }

  function injectBadge() {
    var tb = document.querySelector('.tb');
    if (!tb || document.getElementById('syncBadge')) return;
    ensureNoticeMobileStyle();
    if (!_noticeResizeBound) {
      _noticeResizeBound = true;
      window.addEventListener('resize', queueNoticeStackOffset);
    }
    var s = document.createElement('span');
    s.id = 'syncBadge';
    s.style.cssText = 'font-size:11px;cursor:default;margin-right:8px';
    s.textContent = '🟢';
    s.title = 'همگام با سرور';
    tb.appendChild(s);
    /* v33.2.1: بنر هشدار تغییرات ذخیره‌نشده */
    var banner = document.createElement('div');
    banner.id = 'ptfUnsavedBanner';
    banner.style.cssText = 'display:none;position:fixed;bottom:0;left:0;right:0;z-index:9999;background:#f59e0b;color:#1e293b;padding:8px 16px;font-size:13px;font-weight:600;align-items:center;gap:8px;box-shadow:0 -2px 8px rgba(0,0,0,0.15)';
    document.body.appendChild(banner);
    watchNoticeBanner(banner);
    queueNoticeStackOffset();
  }

  /* ---------- مهاجرت اولیه: seed یا دریافت ---------- */
  function initialSync() {
    /* v34.5.2: یک رفت‌وبرگشت به‌جای data_rev + snapshot کامل.
       pull با since=0 و krevs محلی: کلیدهای تازه فقط دلتا؛ سرور خالی (rev=0/fresh) → seed. */
    if (!hasSyncToken()) {
      retryPullAfterAuth(function (res) {
        state.bootstrapped = true; window._ptfSyncBootstrapped = true;
        /* خطای auth/network هرگز readiness کاذب تولید نمی‌کند. */
        if (res && res.ok !== false) announceSnapshotReady(res);
      }, true);
      return;
    }
    state.initialReconcile = true;
    pullCheck(function (res) {
      state.initialReconcile = false;
      state.bootstrapped = true; window._ptfSyncBootstrapped = true;
      if (!res || res.ok === false) {
        if (res && res.reason === 'network') setSyncBadge('offline');
        return;
      }
      announceSnapshotReady(res);
      var serverEmpty = !!(res.fresh && !(+res.rev));
      if (serverEmpty) {
        var hasData = SYNC_KEYS.some(function (k) { return (rd(k) || '[]').length > 10; });
        if (hasData) {
          SYNC_KEYS.forEach(function (k) { if (rd(k) !== null) state.dirty[k] = true; });
          pushDirty();
          if (typeof addLog === 'function') addLog('داده‌های این دستگاه به سرور منتقل شد (seed اولیه)');
        }
        return;
      }
      if (Object.keys(state.dirty).length) schedulePush();
    }, true);
  }

  /* ---------- شروع ---------- */
  function boot() {
    if (!curSession().user) return;
    injectBadge();
    /* v34.4.42: dirty persisted ابتدا فقط «کاندید بازیابی» است، نه اثبات خطا.
       بنر قدیمی پیش از اولین تلاش sync روشن می‌شد و حتی برای no-op/stale dirty یک
       هشدار زرد کاذب می‌پراند. تا ۶ ثانیه فرصت reconcile/push می‌دهیم؛ فقط اگر کلید
       واقعاً باقی ماند هشدار نمایش داده می‌شود. خطای شبکه/احراز در مسیرهای خودشان
       بلافاصله offline/warn را فعال می‌کند. */
    var dirtyKeys = Object.keys(state.dirty);
    if (dirtyKeys.length > 0) {
      clearTimeout(window._ptfSyncRecoveryNoticeT);
      window._ptfSyncRecoveryNoticeT = setTimeout(function () {
        var remaining = Object.keys(state.dirty).length;
        if (!remaining) return;
        setSyncBadge(state.online ? 'warn' : 'offline');
        try { if (typeof ptfToast === 'function') ptfToast('🔄 ' + remaining + ' تغییر واقعی هنوز در انتظار همگام‌سازی است.', 'info'); } catch (eDR) {}
      }, 6000);
    }
    try { if (typeof ptfUpdateGuardCounts === 'function' && !localStorage.getItem('ptf_guard_counts')) ptfUpdateGuardCounts(); } catch (eB) {} /* v14.7 US-382: baseline اولیه */
    initialSync();
    if (!window._ptfSyncPullT) {
      window._ptfSyncPullT = setInterval(pullCheck, 20000);
    }
    /* v33.21.0: برگشت به تب (فوکوس یا خروج از حالت مخفی) → پول فوری برای جبران پول‌های ردشده */
    if (!window._ptfSyncFocusP) {
      window._ptfSyncFocusP = true;
      window.addEventListener('focus', function () {
        try { if (state.bootstrapped && !state.pulling && !state.pushing) pullCheck(); } catch (eF) {}
      });
      if (typeof document !== 'undefined' && document.addEventListener) {
        document.addEventListener('visibilitychange', function () {
          try { if (!document.hidden && state.bootstrapped && !state.pulling && !state.pushing) pullCheck(); } catch (eV) {}
        });
      }
    }
    /* v33.21.1: پینگ بین‌تبی (رویداد storage — در تب پنهان هم فوری می‌شلیکد) → دلتا-پول فوری.
       حلقهٔ برگشتی نداریم: فقط تب «اعمال‌شده» پینگ می‌نویسد و برابری rev مقایسه می‌شود. */
    if (!window._ptfSyncPingL) {
      window._ptfSyncPingL = true;
      window.addEventListener('storage', function (e) {
        try {
          if (!e || e.key !== 'ptf_sync_ping' || !e.newValue) return;
          var p = JSON.parse(e.newValue);
          if (!p || typeof p.rev === 'undefined') return;
          if (+p.rev <= state.lastRev) return; /* این تب همین rev یا جدیدتر را دارد */
          if (!state.bootstrapped || state.pulling || state.pushing) return;
          var _pn = Date.now();
          if (state.lastPingPull && (_pn - state.lastPingPull) < 5000) return; /* حد نرخ ۵ثانیه برای طوفان ping */
          state.lastPingPull = _pn;
          pullCheck(null, false, { instant: true });
        } catch (eS) {}
      });
      /* نشانگر قدیمیِ نشست قبل مانع مقایسهٔ rev نشود */
      try { localStorage.removeItem('ptf_sync_ping'); } catch (eP0) {}
    }
    // هنگام بستن صفحه، push معلق را بفرست
    window.addEventListener('beforeunload', function (ev) {
      var keys = Object.keys(state.dirty).filter(function (k) { return !syncKeyHeld(k); });
      if (!keys.length) return;
      try { ev.preventDefault(); ev.returnValue = ''; } catch (eU) {}
      /* Phase B's queue is the durable hand-off. A second unload beacon without a
         response/ACK could race the coordinator and reintroduce a stale whole snapshot. */
      try {
        if (typeof window.ptfBPhaseActive === 'function' && window.ptfBPhaseActive()) {
          if (typeof window.ptfBEnqueueKeys === 'function') window.ptfBEnqueueKeys(keys);
          return;
        }
      } catch (eBUnload) {}
      var data = {};
      keys.forEach(function (k) { var v = rd(k); if (v !== null) data[k] = (typeof window.ptfApplyDeletionTombstones === 'function') ? window.ptfApplyDeletionTombstones(k, v) : v; });
      try {
        /* v15.0 (US-384): beacon هم با base — اگر دستگاه دیگری جلوتر نوشته باشد، سرور رد می‌کند */
        var kb = krevs(); var bb = {};
        keys.forEach(function (k) { bb[k] = +kb[k] || 0; });
        navigator.sendBeacon(API + '?action=data_push', new Blob([JSON.stringify({ by: curSession().name, data: data, base: bb })], { type: 'application/json' }));
      } catch (e) {}
    });
  }

  var tries = 0;
  var t = setInterval(function () {
    tries++;
    var vis = document.getElementById('crmL') && document.getElementById('crmL').style.display !== 'none';
    if (vis) { boot(); clearInterval(t); }
    if (tries > 60) clearInterval(t);
  }, 400);
  var _showCrm = window.showCrm;
  if (_showCrm) {
    window.showCrm = function () { _showCrm(); setTimeout(boot, 900); };
  }
})();

  /* v31.7.2 BUG-SYNC-DUP-COLLAPSE: the old generic merge used cd/no as a
     unique map key. That is unsafe precisely when two devices created the
     same RFQ/offer code; one record was silently dropped. Preserve every
     distinct payload until the duplicate-repair workflow resolves it. 
     
     v31.7.3 BUG-AUDIT-004-MERGE-ORDERING: JSON.stringify is order-dependent.
     If two devices have the same object but with keys in different order,
     they are incorrectly treated as duplicates. Normalize keys before stringify. */
  function ptfMergeNoCollapse(key, localStr, remoteStr) {
    try {
      var loc=JSON.parse(localStr||'[]'), rem=JSON.parse(remoteStr||'[]');
      if(!Array.isArray(loc)||!Array.isArray(rem)) return remoteStr;
      
      // Helper: normalize object keys for consistent stringify
      function normalizeKeys(obj) {
        if(!obj || typeof obj !== 'object') return obj;
        if(Array.isArray(obj)) return obj.map(normalizeKeys);
        var sorted = {};
        Object.keys(obj).sort().forEach(function(k) {
          sorted[k] = normalizeKeys(obj[k]);
        });
        return sorted;
      }
      
      var out=[], exact={};
      function add(r){
        if(!r||typeof r!=='object') return;
        var normalized = normalizeKeys(r);
        var sig=JSON.stringify(normalized);
        if(exact[sig]) return;
        exact[sig]=1; out.push(r);
      }
      rem.forEach(add); loc.forEach(add);
      return JSON.stringify(out);
    } catch(e){ return remoteStr; }
  }

  /* v31.7.38 BUG-DUP-GROW-001:
     RFQ/Offer codes are business identities. The previous ptfMergeNoCollapse
     deliberately preserved distinct payloads with the same cd/no to avoid silent
     loss during historical codegen incidents, but once those incidents were fixed
     the same rule made legacy duplicate records reappear/grow through sync and
     polluted «روز من». Canonical merge below collapses same-code business records
     into one representative, preserves a lightweight merge history, and is used
     both by sync and by an explicit cleanup action. */
  function ptfObjClone(x) { try { return JSON.parse(JSON.stringify(x || {})); } catch (e) { return x || {}; } }
  function ptfCodeIdentity(key, r) {
    if (!r || typeof r !== 'object') return '';
    return String(key === 'ptf_crm_offers' ? (r.no || r.cd || r.id || '') : (r.cd || r.no || r.id || r.code || '')).trim();
  }
  /* v31.7.97 BUG-SYNC-TOMBSTONE-001:
     حذف در سیستم چندکاربره باید برنده باشد. اگر دستگاه B رکورد حذف‌شده را
     هنوز در cache داشته باشد، merge نباید آن را از نو زنده کند. Tombstoneها
     از ptf_crm_deleted_archive خوانده می‌شوند و روی keyهای کسب‌وکاری اعمال می‌گردند. */
  function ptfArchiveKindsForKey(key) {
    var map = {
      ptf_crm_offers: ['offer','offers','to','co','tc'],
      ptf_crm_rfqs: ['rfq','request','inq','inquiry'],
      ptf_crm_customers: ['customer','customers','cust'],
      ptf_crm_suppliers: ['supplier','suppliers','sup'],
      ptf_crm_products: ['product','products','prod'],
      ptf_crm_leads: ['lead','leads'],
      ptf_crm_invoices: ['invoice','invoices','inv'],
      ptf_crm_payables: ['payable','payables','pay'],
      ptf_crm_cheques: ['cheque','check','chq'],
      ptf_crm_cheques_issued: ['cheque','check','chq','issued'],
      ptf_crm_cheques_received: ['cheque','check','chq','received'],
      ptf_crm_deals: ['deal','deals','salesfile'],
      ptf_crm_projects: ['project','projects','salesfile'],
      ptf_crm_letters: ['letter','letters'],
      ptf_crm_contracts: ['contract','contracts'],
      ptf_crm_rfqsmart: ['rfqsmart','supplyrfq'],
      ptf_crm_buycmp: ['buycmp','buycompare'],
      ptf_crm_inqitems: ['inqitem','inqitems','iqi'],
      ptf_crm_case_receipts: ['receipt','case_receipt','rpay'],
      ptf_crm_receipt_allocations: ['allocation','receipt_allocation'],
      ptf_crm_fin_attachments: ['attachment','financial_attachment'],
      ptf_crm_sharetx: ['sharetx','share_transaction','shareholder_salary','chair_in','chair_out','draw','salary','salary_payment'],
      ptf_crm_opex: ['opex','expense','recurring_opex','shareholder_salary'],
      ptf_crm_shareholders: ['shareholder','shareholders'],
      ptf_crm_corrections: ['correction']
    };
    return map[key] || [];
  }
  function ptfRecordIdentityForKey(key, r) {
    if (!r || typeof r !== 'object') return '';
    if (key === 'ptf_crm_offers') return String(r.no || r.cd || r.id || '').trim();
    return String(r._id || r.cd || r.no || r.id || r.code || r.invoiceCd || r.feedbackId || '').trim();
  }
  /* v33.21.0 (BUG-SYNC-RD-SCOPE-001 — خطای تولید v33.20.0): rd داخل IIFE بالای فایل تعریف
     شده و اینجا (اسکوپ سراسری پس از پایان IIFE) قابل رؤیت نیست؛ فراخوانی tombstone روی هر
     کلید کسب‌وکاری با ReferenceError می‌افتاد → شکست پول، نشان «آفلاین» کذب و عدم اعمال
     تغییرات دستگاه‌های دیگر. (تسترها با rd تزریقی sandbox سبز می‌ماندند و نقص را می‌پوشاندند.)
     حالا خواندن آرشیو با همان منطق rd به‌صورت خودکفا در همین اسکوپ انجام می‌شود. */
  function ptfReadDeletedArchiveStr() {
    try { if (typeof window.ptfBRead === 'function') { var v = window.ptfBRead('ptf_crm_deleted_archive'); if (v !== null) return v; } } catch (e) {}
    try { return localStorage.getItem('ptf_crm_deleted_archive'); } catch (e2) { return null; }
  }
  function ptfReadArchive(extraArchiveStr) {
    var out = [];
    function addFrom(str) {
      try { var a = JSON.parse(str || '[]'); if (Array.isArray(a)) out = out.concat(a); } catch (e) {}
    }
    addFrom(ptfReadDeletedArchiveStr() || '[]');
    if (extraArchiveStr) addFrom(extraArchiveStr);
    return out;
  }
  window.ptfApplyDeletionTombstones = function (key, jsonStr, extraArchiveStr) {
    if (key === 'ptf_crm_deleted_archive') {
      var aliases={};ptfReadArchive(extraArchiveStr).forEach(function(d){if(d&&String(d.kind||'').toLowerCase()==='archive_purge')(d.aliases||[]).forEach(function(a){a=String(a||'').trim();if(a.length>=6)aliases[a]=true;});});
      var aliasList=Object.keys(aliases);if(!aliasList.length)return jsonStr;try{var rows=JSON.parse(jsonStr||'[]');if(!Array.isArray(rows))return jsonStr;return JSON.stringify(rows.filter(function(row){if(!row||typeof row!=='object')return false;if(String(row.kind||'').toLowerCase()==='archive_purge')return true;var encoded=JSON.stringify(row);return!aliasList.some(function(a){return encoded.indexOf(a)>-1;});}));}catch(e){return jsonStr;}
    }
    var kinds = ptfArchiveKindsForKey(key);
    var kindSet = {}; kinds.forEach(function (k) { kindSet[String(k).toLowerCase()] = true; });
    var ids = {}, purgeAliases = {};
    ptfReadArchive(extraArchiveStr).forEach(function (d) {
      if (!d || typeof d !== 'object') return;
      var kind = String(d.kind || '').toLowerCase();
      if (kind === 'archive_purge' && d.identities && Array.isArray(d.identities[key])) {
        d.identities[key].forEach(function (purgedId) { purgedId=String(purgedId||'').trim(); if(purgedId)ids[purgedId]=true; });
        (d.aliases||[]).forEach(function(alias){alias=String(alias||'').trim();if(alias.length>=6)purgeAliases[alias]=true;});
      }
      if (!kindSet[kind]) return;
      var id = String(d.id || d.no || d.cd || '').trim();
      if (id) ids[id] = true;
    });
    if (!Object.keys(ids).length && !Object.keys(purgeAliases).length) return jsonStr;
    try {
      var arr = JSON.parse(jsonStr || '[]');
      if (!arr || typeof arr !== 'object') return jsonStr;
      if(key==='ptf_crm_supplier_finance'&&!Array.isArray(arr)){
        ['invoices','payments','adjustments'].forEach(function(bucket){if(!Array.isArray(arr[bucket]))return;arr[bucket]=arr[bucket].filter(function(r){var id=String((r&&(r._id||r.cd))||'').trim();return!id||!ids[id];});});
        (arr.payments||[]).forEach(function(payment){if(Array.isArray(payment.allocations))payment.allocations=payment.allocations.filter(function(a){return!ids[String((a&&a.invoiceCd)||'').trim()];});});
        return JSON.stringify(arr);
      }
      if (!Array.isArray(arr)) return jsonStr;
      var purgeAliasList=Object.keys(purgeAliases);
      var filtered = arr.filter(function (r) { var id = ptfRecordIdentityForKey(key, r); if(id&&ids[id])return false;var encoded='';try{encoded=JSON.stringify(r||{});}catch(e){}return !purgeAliasList.some(function(alias){return encoded.indexOf(alias)>-1;}); });
      return JSON.stringify(filtered);
    } catch (e) { return jsonStr; }
  };
  function ptfValScore(v) {
    if (v == null) return 0;
    if (Array.isArray(v)) return v.length ? 3 + v.length : 0;
    if (typeof v === 'object') return Object.keys(v).length ? 3 + Object.keys(v).length : 0;
    return String(v).trim() ? 1 : 0;
  }
  function ptfStateRank(r) {
    var st = String((r && (r.st || r.tst || r.status)) || '');
    var map = { won: 90, approved: 80, sent: 70, registered: 60, revise: 50, draft: 30, pending: 20, lost: 10, rejected: 5 };
    return map[st] || 0;
  }
  function ptfRecTimestamp(r) { return String((r && (r.wfUpdatedAtISO || r.updatedAtISO || r.updatedAt || r.iso || r.ts || r.t || r.dateEn || r.dueISO || r.dt || r.dateFa)) || ''); }
  function ptfRecCompleteness(r) {
    var n = 0;
    if (!r || typeof r !== 'object') return 0;
    Object.keys(r).forEach(function (k) { n += ptfValScore(r[k]); });
    return n;
  }
  function ptfPreferRecord(a, b) {
    var sa = ptfStateRank(a), sb = ptfStateRank(b);
    if (sa !== sb) return sb > sa ? b : a;
    var ca = ptfRecCompleteness(a), cb = ptfRecCompleteness(b);
    if (ca !== cb) return cb > ca ? b : a;
    return ptfRecTimestamp(b) >= ptfRecTimestamp(a) ? b : a;
  }
  function ptfMergeArrayUnique(a, b) {
    var out = [], seen = {};
    function add(x) { var sig; try { sig = JSON.stringify(x); } catch (e) { sig = String(x); } if (!seen[sig]) { seen[sig] = 1; out.push(x); } }
    (Array.isArray(a) ? a : []).forEach(add); (Array.isArray(b) ? b : []).forEach(add);
    return out;
  }
  /* v31.8 BUG-OFFER-SYNC-INTEGRITY-001: an offer is a commercial document.
     Its items are an atomic snapshot, not a generic array that can be unioned.
     Exact duplicate legacy lines are safely collapsed; different snapshots are
     resolved by the winning record and recorded in _itemSyncConflict. */
  function ptfOfferExactItemSignature(item) {
    try { return JSON.stringify(item || {}); } catch (e) { return String(item || ''); }
  }
  function ptfNormalizeOfferSnapshot(items) {
    var out = [], seen = {}, removed = 0;
    (Array.isArray(items) ? items : []).forEach(function (it) {
      if (!it || typeof it !== 'object') return;
      var key = String(it.lineId || '').trim();
      key = key ? ('id:' + key) : ('exact:' + ptfOfferExactItemSignature(it));
      if (seen[key]) { removed++; return; }
      seen[key] = true; out.push(it);
    });
    return { items: out, removed: removed };
  }
  function ptfMergePlainObject(a, b) {
    var out = ptfObjClone(a);
    Object.keys(b || {}).forEach(function (k) {
      if (out[k] == null || out[k] === '') out[k] = b[k];
      else if (Array.isArray(out[k]) || Array.isArray(b[k])) out[k] = ptfMergeArrayUnique(out[k], b[k]);
      else if (typeof out[k] === 'object' && typeof b[k] === 'object') out[k] = Object.assign({}, b[k], out[k]);
    });
    return out;
  }
  /* v34.4.34: ضمیمه یک فیلد تو‌در‌توی رکورد است. merge عمومی قبلی کل رکورد را
     بر اساس timestamp اولیهٔ `t` انتخاب می‌کرد؛ افزودن/حذف فایل `t` را عوض نمی‌کرد و
     در conflict ضمیمه بی‌صدا گم یا فایل حذف‌شده دوباره زنده می‌شد. فایل‌ها بر اساس key
     union می‌شوند و tombstone سطح فایل (`_deletedFileKeys`) همیشه بر union مقدم است. */
  function ptfMergeAttachmentFields(out, a, b) {
    a = a || {}; b = b || {}; out = out || {};
    if (!Array.isArray(a.files) && !Array.isArray(b.files) && !Array.isArray(a._deletedFileKeys) && !Array.isArray(b._deletedFileKeys)) return out;
    var deleted = {};
    (a._deletedFileKeys || []).concat(b._deletedFileKeys || []).forEach(function (k) { if (k) deleted[String(k)] = 1; });
    var files = {}, noKey = [];
    function addFile(f) {
      if (!f || typeof f !== 'object') return;
      var k = String(f.key || '');
      if (!k) { noKey.push(f); return; }
      if (!deleted[k]) files[k] = f;
    }
    (b.files || []).forEach(addFile);
    (a.files || []).forEach(addFile);
    out.files = Object.keys(files).map(function (k) { return files[k]; }).concat(noKey);
    if (Object.keys(deleted).length) out._deletedFileKeys = Object.keys(deleted);
    return out;
  }
  function ptfMergeBusinessRecord(key, a, b, code) {
    var winner, authoritativeOfferReplay = false;
    var markerA = !!(a && (a._serverState || a._serverOpId));
    var markerB = !!(b && (b._serverState || b._serverOpId));
    if (key === 'ptf_crm_offers' && markerA !== markerB && ((markerA ? b : a) || {}).serverRegisteredAt) {
      /* ویرایش pending یک offer قدیمی نیز serverRegisteredAt قبلی را دارد؛ نسخهٔ
         clean سرور باید marker و فیلدهای پاسخ‌نامعلوم را کنار بزند. */
      winner = markerA ? b : a;
      authoritativeOfferReplay = true;
    } else if (key === 'ptf_crm_offers' && !!(a && a.serverRegisteredAt) !== !!(b && b.serverRegisteredAt)) {
      /* دو دستگاه/پاسخ گم‌شده: projection ثبت‌شدهٔ سرور باید عیناً بر نسخهٔ
         local sending/rejected همان شماره مقدم باشد. merge فیلدی marker محلی را
         دوباره روی canonical می‌نشاند و offer تأییدشده را pending جلوه می‌داد. */
      winner = (a && a.serverRegisteredAt) ? a : b;
      authoritativeOfferReplay = true;
    } else if (key === 'ptf_crm_rfqs' && String((a && a.wfUpdatedAtISO) || '') !== String((b && b.wfUpdatedAtISO) || '')) {
      /* workflow یک transition نسخه‌دار است؛ طول wfLog/کامل‌بودن رکورد نباید
         WF50 کهنه را بر اصلاح authoritative جدیدتر مقدم کند. */
      winner = String((b && b.wfUpdatedAtISO) || '') > String((a && a.wfUpdatedAtISO) || '') ? b : a;
    } else winner = (typeof window.ptfFinanceVoidWins === 'function' && (key === 'ptf_crm_invoices' || key.indexOf('cheque') > -1))
      ? (window.ptfFinanceVoidWins(a, b) || ptfPreferRecord(a, b))
      : ptfPreferRecord(a, b);
    var loser = winner === a ? b : a;
    if (authoritativeOfferReplay) {
      var canonicalOffer = ptfMergePlainObject(winner, {});
      delete canonicalOffer._serverState; delete canonicalOffer._serverOpId; delete canonicalOffer._serverError;
      canonicalOffer.no = code;
      return canonicalOffer;
    }
    var out = ptfMergeAttachmentFields(ptfMergePlainObject(winner, loser), winner, loser);
    if (key === 'ptf_crm_offers') {
      var clean = ptfNormalizeOfferSnapshot(winner.items || []);
      out.items = clean.items; /* never union winner/loser offer lines */
      if (clean.removed || JSON.stringify(winner.items || []) !== JSON.stringify(loser.items || [])) {
        out._itemSyncConflict = { at: new Date().toISOString(), winnerTs: ptfRecTimestamp(winner), loserTs: ptfRecTimestamp(loser), duplicateLinesRemoved: clean.removed, policy: 'atomic-winner-snapshot-v31.8' };
      }
    }
    var idField = key === 'ptf_crm_offers' ? 'no' : 'cd';
    out[idField] = code;
    out._dupMerged = ptfMergeArrayUnique(out._dupMerged || [], [{ at: new Date().toISOString(), key: key, code: code, loserTs: ptfRecTimestamp(loser), reason: 'same-code-canonical-merge' }]).slice(-10);
    return out;
  }
  function ptfMergeByCodeCanonical(key, localStr, remoteStr) {
    try {
      var loc = JSON.parse(localStr || '[]'), rem = JSON.parse(remoteStr || '[]');
      if (!Array.isArray(loc) || !Array.isArray(rem)) return remoteStr;
      var by = {}, order = [], noId = [];
      function add(r) {
        if (!r || typeof r !== 'object') return;
        var code = ptfCodeIdentity(key, r);
        if (!code) { noId.push(r); return; }
        if (!by[code]) { by[code] = r; order.push(code); }
        else by[code] = ptfMergeBusinessRecord(key, by[code], r, code);
      }
      rem.forEach(add); loc.forEach(add);
      var out = order.map(function (c) { return by[c]; }).concat(noId);
      return window.ptfApplyDeletionTombstones ? window.ptfApplyDeletionTombstones(key, JSON.stringify(out)) : JSON.stringify(out);
    } catch (e) { return remoteStr; }
  }
  window.ptfCollapseDuplicateBusinessRecords = function (opts) {
    opts = opts || {};
    if (opts.confirm !== 'PTF-COLLAPSE-DUP') return { ok: false, why: 'confirmation' };
    var keys = opts.keys || ['ptf_crm_rfqs', 'ptf_crm_offers'];
    var result = { ok: true, fixed: [], unchanged: [] };
    keys.forEach(function (key) {
      try {
        var cur = rd(key) || '[]';
        var merged = ptfMergeByCodeCanonical(key, cur, '[]');
        var before = JSON.parse(cur || '[]'), after = JSON.parse(merged || '[]');
        if (after.length < before.length) {
          if (typeof setData === 'function') setData(key, after); else localStorage.setItem(key, JSON.stringify(after));
          result.fixed.push({ key: key, before: before.length, after: after.length, removed: before.length - after.length });
          try { if (typeof audit === 'function') audit('سیستم', 'پاکسازی رکوردهای تکراری هم‌کد ' + key + ': ' + before.length + ' → ' + after.length, key); } catch (eA) {}
        } else result.unchanged.push({ key: key, count: after.length });
      } catch (e) { result.unchanged.push({ key: key, error: String(e) }); }
    });
    return result;
  };

  // Sprint 104: Smart Array Merging for concurrent users (Manager & Sales Engineer)
  window.ptfSmartMerge = function (key, localStr, remoteStr, mergeOptions) {
    try {
      /* v31.7.11 BUG-AVATAR-001: عکس پروفایل حذف‌شده با رفرش برمی‌گشت.
         علت: ptf_crm_avatars آبجکت map است نه آرایه؛ مسیر عمومی merge برای
         غیرآرایه‌ها remoteStr (server-wins) برمی‌گرداند و حذف محلی گم می‌شد.
         راه‌حل: merge per-user با timestamp — هر ورودی {v,ts} جدیدتر برنده است؛
         tombstone {v:null} حذف را در تمام دستگاه‌ها ماندگار می‌کند. */
      if (key === 'ptf_crm_avatars') {
        try {
          var locA = JSON.parse(localStr || '{}');
          var remA = JSON.parse(remoteStr || '{}');
          if (Array.isArray(locA) || Array.isArray(remA) || typeof locA !== 'object' || typeof remA !== 'object') return remoteStr;
          function avTs(e) { return (e && typeof e === 'object' && e.ts) ? String(e.ts) : ''; }
          var outA = {};
          var allU = {};
          Object.keys(locA).forEach(function (u) { allU[u] = 1; });
          Object.keys(remA).forEach(function (u) { allU[u] = 1; });
          Object.keys(allU).forEach(function (u) {
            var lv = locA[u], rv = remA[u];
            var winner;
            if (lv === undefined) winner = rv;
            else if (rv === undefined) winner = lv;
            else winner = (avTs(lv) >= avTs(rv)) ? lv : rv; /* legacy رشته‌ای ts ندارد → نسخه‌دار برنده */
            /* tombstone قدیمی‌تر از ۳۰ روز پاک می‌شود تا map بی‌نهایت بزرگ نشود */
            if (winner && typeof winner === 'object' && winner.v == null) {
              try { if (winner.ts && (Date.now() - new Date(winner.ts).getTime()) > 30 * 864e5) return; } catch (eTs) {}
            }
            if (winner !== undefined) outA[u] = winner;
          });
          return JSON.stringify(outA);
        } catch (eAv) { return remoteStr; }
      }

      /* BUG-LETTER-SIG-SYNC-001: پروفایل امضا map کاربرهاست، نه آرایه.
         remote-wins عمومی می‌توانست امضای تازهٔ دسکتاپ را با نسخهٔ قدیمی/خالی
         موبایل جایگزین کند. هر پروفایل با updatedAtISO جداگانه ادغام می‌شود. */
      if (key === 'ptf_crm_sigprofiles') {
        try {
          var locS = JSON.parse(localStr || '{}'), remS = JSON.parse(remoteStr || '{}');
          if (Array.isArray(locS) || Array.isArray(remS) || !locS || !remS || typeof locS !== 'object' || typeof remS !== 'object') return remoteStr;
          var outS = {}, usersS = {};
          Object.keys(locS).forEach(function (u) { usersS[u] = 1; });
          Object.keys(remS).forEach(function (u) { usersS[u] = 1; });
          Object.keys(usersS).forEach(function (u) {
            var lv = locS[u], rv = remS[u];
            if (lv === undefined) outS[u] = rv;
            else if (rv === undefined) outS[u] = lv;
            else {
              var lt = String((lv && lv.updatedAtISO) || ''), rt = String((rv && rv.updatedAtISO) || '');
              /* دادهٔ نسخه‌دار بر legacy بی‌تاریخ مقدم است؛ در تساوی local حفظ می‌شود. */
              outS[u] = lt >= rt ? lv : rv;
            }
          });
          return JSON.stringify(outS);
        } catch (eSig) { return remoteStr; }
      }

      /* Sprint 283 + AUD-01 (ممیزی ۱۴۰۵/۰۵/۰۷ — crm/AUDIT-FINANCIAL-SYSTEM-2026-07-29.md):
         fiscal lock/unlock is a state transition on one snapshot, not an ordinary
         display timestamp. A chairman unlock has lockStateAtISO; keep that transition
         through a per-key sync conflict so an older locked server copy cannot silently
         re-lock the year after a local unlock.
         نکته‌ی حیاتی: این بلوک باید پیش از چک عمومی «if (!Array.isArray(loc) ...)»
         بیاید، چون ptf_crm_supplier_finance یک OBJECT است نه آرایه — قبلاً این بلوک
         بعد از آن چک بود و همیشه Array.isArray(loc)===false باعث می‌شد بدون رسیدن به
         اینجا، remoteStr برگردانده شود (کد مرده — AUD-01: هر فاکتور/پرداخت/تعدیل محلی
         که هنوز sync نشده، در هر تعارضی به‌طور کامل و بی‌صدا از بین می‌رفت). */
      if (key === 'ptf_crm_fin_events') {
        try {
          var locE = JSON.parse(localStr || '[]'), remE = JSON.parse(remoteStr || '[]');
          var unionE = (typeof window.ptfFinanceUnionEvents === 'function')
            ? window.ptfFinanceUnionEvents(locE, remE)
            : (Array.isArray(locE) ? locE : []).concat(Array.isArray(remE) ? remE : []);
          return JSON.stringify(unionE);
        } catch (eEv) { return remoteStr; }
      }

      if (key === 'ptf_crm_bank_recon') {
        try {
          var locB = JSON.parse(localStr || '[]'), remB = JSON.parse(remoteStr || '[]');
          var byCd = {};
          function takeB(it) {
            if (!it || !it.cd) return;
            var prev = byCd[it.cd];
            if (!prev || String(it.t || '') >= String(prev.t || '')) byCd[it.cd] = it;
          }
          (Array.isArray(locB) ? locB : []).forEach(takeB);
          (Array.isArray(remB) ? remB : []).forEach(takeB);
          return JSON.stringify(Object.keys(byCd).map(function (k) { return byCd[k]; }));
        } catch (eB) { return remoteStr; }
      }

      if (key === 'ptf_crm_supplier_finance') {
        try {
          var locO = JSON.parse(localStr||'{}'); var remO = JSON.parse(remoteStr||'{}');
          if(typeof locO!=='object' || typeof remO!=='object' || Array.isArray(locO) || Array.isArray(remO)) return remoteStr;
          var merged={};
          var allKeys = {};
          Object.keys(locO).forEach(function(k){ allKeys[k]=1; });
          Object.keys(remO).forEach(function(k){ allKeys[k]=1; });
          Object.keys(allKeys).forEach(function(k){
            var lv=locO[k], rv=remO[k];
            if(!Array.isArray(lv) && !Array.isArray(rv)){
              merged[k]= rv!=null ? rv : lv;
            } else if(Array.isArray(lv) && Array.isArray(rv)){
              // merge by cd — P4: void wins; allocations/files union
              var mm={};
              rv.forEach(function(it){ if(it&&it.cd) mm[it.cd]=it; });
              lv.forEach(function(it){
                if(!it||!it.cd){ return; }
                if(!mm[it.cd]){
                  mm[it.cd]=it;
                } else {
                  var remoteRec=mm[it.cd];
                  var voidW = typeof window.ptfFinanceVoidWins === 'function' ? window.ptfFinanceVoidWins(it, remoteRec) : null;
                  var lt=it.updatedAtISO||it.updatedAt||it.iso||it.t||it.date||'';
                  var rt=remoteRec.updatedAtISO||remoteRec.updatedAt||remoteRec.iso||remoteRec.t||remoteRec.date||'';
                  var winner=voidW || (lt>=rt?it:remoteRec);
                  var loser=winner===it?remoteRec:it;
                  var rec=ptfMergeAttachmentFields(ptfObjClone(winner),winner,loser);
                  if (Array.isArray(it.allocations) || Array.isArray(remoteRec.allocations)) {
                    rec.allocations = ptfMergeArrayUnique(it.allocations || [], remoteRec.allocations || []);
                  }
                  if (voidW) { rec.status = voidW.status || 'void'; rec.st = voidW.st || rec.st; }
                  mm[it.cd]=rec;
                }
              });
              merged[k]=Object.values(mm);
            } else {
              merged[k]= Array.isArray(rv) ? rv : (Array.isArray(lv)? lv : (rv!=null?rv:lv));
            }
          });
          try {
            var evLoc = JSON.parse((typeof window.ptfBRead === 'function' ? window.ptfBRead('ptf_crm_fin_events') : null) || localStorage.getItem('ptf_crm_fin_events') || '[]');
            if (typeof window.ptfFinanceReplaySupplier === 'function') merged = window.ptfFinanceReplaySupplier(merged, evLoc);
          } catch (eRep) {}
          return JSON.stringify(merged);
        } catch(e){ return remoteStr; }
      }

      /* AUD-02 / AUD-03 (ممیزی ۱۴۰۵/۰۵/۰۷ — crm/AUDIT-FINANCIAL-SYSTEM-2026-07-29.md):
         ptf_crm_invoices و ptf_crm_deals هرکدام یک رکورد با شناسه (cd) هستند که
         آرایه‌های تودرتوی حیاتی درون خودشان دارند (payments[]/pays[] برای فاکتور،
         costEvents[]/timeline[]/lossEvents[] برای پرونده‌ی فروش). merge عمومی زیر این
         خط، برای رکوردهای هم‌شناسه فقط «رکورد کامل جدیدتر» را نگه می‌دارد، نه این‌که
         دو آرایه‌ی تودرتو را ادغام کند — یعنی اگر دو کاربر هم‌زمان (مثلاً دو تحصیلدار)
         روی همان فاکتور دو وصولی مستقل ثبت کنند، یکی از دو وصولی در merge کاملاً و
         بی‌صدا گم می‌شود. راه‌حل: از همان مسیر canonical-merge موجود برای offers/rfqs
         استفاده شود که به‌ازای هر کد، رکورد برنده را انتخاب می‌کند اما فیلدهای آرایه‌ای
         (payments/pays/costEvents/timeline/lossEvents) را با ptfMergeArrayUnique واقعاً
         union می‌کند — نه جایگزین. */
       if (key === 'ptf_crm_rfqs' || key === 'ptf_crm_offers' || key === 'ptf_crm_invoices' || key === 'ptf_crm_deals' || key === 'ptf_crm_cheques_issued' || key === 'ptf_crm_cheques_received' || key === 'ptf_crm_cheque_books' || key === 'ptf_crm_petty') return ptfMergeByCodeCanonical(key, localStr, remoteStr);
      if (key === 'ptf_crm_opex' && typeof window.ptfOpexMergeSnapshots === 'function') return window.ptfOpexMergeSnapshots(localStr, remoteStr, !!(mergeOptions && mergeOptions.preferRemoteOpex));
      var loc = JSON.parse(localStr || '[]');
      var rem = JSON.parse(remoteStr || '[]');
      if (!Array.isArray(loc) || !Array.isArray(rem)) return remoteStr;

      /* v31.7.26 BUG-SYNC-OSC-001 (گزارش کارفرما: دفتر تلفن مدام زیاد/کم می‌شود):
         smsBookSyncAll در هر rebuild برای رکوردهای auto با genCode('PB') کد «تصادفی جدید» می‌ساخت؛
         دو دستگاه برای همان مخاطب دو cd متفاوت داشتند → merge با کلید cd هر دو را نگه می‌داشت
         (تکراری/رشد) و rebuild بعدی dedup می‌کرد (کاهش) → نوسان دائمی.
         رفع: هویت واقعی مخاطب شماره موبایل است — merge دفترچه با کلید mob. */
      if (key === 'ptf_crm_smsbook') {
        var bm = {};
        function bAdd(r) {
          if (!r || !r.mob) return;
          var k2 = String(r.mob);
          var ex = bm[k2];
          if (!ex) { bm[k2] = r; return; }
          /* دستی بر auto مقدم؛ سپس جدیدتر */
          var exManual = ex.src !== 'auto', rManual = r.src !== 'auto';
          if (rManual && !exManual) { bm[k2] = r; return; }
          if (!rManual && exManual) return;
          if (String(r.t || '') > String(ex.t || '')) bm[k2] = r;
        }
        rem.forEach(bAdd); loc.forEach(bAdd);
        return JSON.stringify(Object.keys(bm).map(function (k3) { return bm[k3]; }));
      }

      /* v31.7.10 BUG-NTF-002: وضعیت «خوانده‌شده» اعلان‌ها پس از sync برمی‌گشت.
         علت: ntfRead فقط readBy را تغییر می‌دهد و timestamp رکورد ثابت می‌ماند؛
         قاعده عمومی «newer wins» نسخه سرور (خوانده‌نشده) را برنده می‌کرد.
         راه‌حل: merge مخصوص اعلان‌ها — readBy اجتماع دو طرف، done/repeat حداکثری. */
      if (key === 'ptf_crm_notifs') {
        var nMap = {};
        rem.forEach(function (item) { if (item && item.cd) nMap[item.cd] = item; });
        loc.forEach(function (item) {
          if (!item || !item.cd) return;
          var ex = nMap[item.cd];
          if (!ex) { nMap[item.cd] = item; return; }
          var rb = {};
          (ex.readBy || []).concat(item.readBy || []).forEach(function (u) { if (u) rb[u] = 1; });
          ex.readBy = Object.keys(rb);
          ex.done = !!(ex.done || item.done);
          if ((item.repeat || 1) > (ex.repeat || 1)) { ex.repeat = item.repeat; ex.lastT = item.lastT || ex.lastT; ex.lastISO = item.lastISO || ex.lastISO; }
        });
        var nOut = Object.keys(nMap).map(function (k2) { return nMap[k2]; });
        /* نسخه‌های قدیمی یا event-poll ممکن است برای یک ارجاع پایدار cd جدید
           ساخته باشند. در merge، referral با dkey یکسان باید یک کار بماند؛
           readBy/done اتحاد می‌شود و زمان ایجاد نخستین ارجاع حفظ می‌گردد. */
        var byTask = {}, nDedup = [];
        nOut.forEach(function (item) {
          var dk = String(item && item.dkey || '');
          var isReferral = item && item.kind === 'referral' && /^referral\|/.test(dk);
          if (!isReferral || !byTask[dk]) { if (isReferral) byTask[dk] = item; nDedup.push(item); return; }
          var keep = byTask[dk], rb2 = {};
          (keep.readBy || []).concat(item.readBy || []).forEach(function (u) { if (u) rb2[u] = 1; });
          keep.readBy = Object.keys(rb2); keep.done = !!(keep.done || item.done);
          if (String(item.iso || '') && (!keep.iso || String(item.iso) < String(keep.iso))) { keep.t = item.t; keep.iso = item.iso; }
        });
        nDedup.sort(function (a, b) { return String(b.iso || '').localeCompare(String(a.iso || '')); });
        return JSON.stringify(nDedup);
      }

      if (key === 'ptf_crm_fiscal_snapshots') {
        var fiscalMap = {};
        rem.forEach(function (item) { if (item && item.cd) fiscalMap[item.cd] = item; });
        loc.forEach(function (item) {
          if (!item || !item.cd) return;
          var old = fiscalMap[item.cd];
          if (!old) { fiscalMap[item.cd] = item; return; }
          var lState = item.lockStateAtISO || item.unlockedAtISO || item.updatedAtISO || '';
          var rState = old.lockStateAtISO || old.unlockedAtISO || old.updatedAtISO || '';
          if ((lState && !rState) || (lState && rState && lState > rState)) fiscalMap[item.cd] = item;
        });
        return JSON.stringify(Object.keys(fiscalMap).map(function (k) { return fiscalMap[k]; }));
      }
      
      var idFields = ['cd', 'no', 'id', 'code'];
      var idF = null;
      if (loc.length > 0) {
        for (var i=0; i<idFields.length; i++) { if (loc[0][idFields[i]]) { idF = idFields[i]; break; } }
      }
      if (!idF && rem.length > 0) {
        for (var j=0; j<idFields.length; j++) { if (rem[0][idFields[j]]) { idF = idFields[j]; break; } }
      }
      if (!idF) return remoteStr; // Fallback if not an array of objects with ID
      
      var map = {};
      /* v31.7.26 BUG-SYNC-OSC-001: رکورد بدون فیلد شناسه (legacy/واردشده با فیلد متفاوت)
         قبلاً در merge بی‌صدا حذف می‌شد → «کم شدن خودکار» تامین‌کنندگان/مشتریان؛ و چون
         دستگاه دیگر هنوز داشت و push می‌کرد دوباره برمی‌گشت → نوسان. اکنون این رکوردها
         با امضای JSON یکتا حفظ می‌شوند. */
      var noId = [], noIdSig = {};
      function keepNoId(item) {
        try { var g = JSON.stringify(item); if (!noIdSig[g]) { noIdSig[g] = 1; noId.push(item); } } catch (eN) {}
      }
      rem.forEach(function (item) { if (item && !item[idF]) keepNoId(item); });
      loc.forEach(function (item) { if (item && !item[idF]) keepNoId(item); });
      rem.forEach(function (item) { if (item[idF]) map[item[idF]] = item; });
      loc.forEach(function (item) {
        if (!item[idF]) return;
        if (!map[item[idF]]) {
          // Added locally by this user, preserve it!
          map[item[idF]] = item;
        } else {
          // Exists in both, pick the one with newer timestamp if available, else local
          var lTs = item.iso || item.ts || item.t || item.date || '';
          var rTs = map[item[idF]].iso || map[item[idF]].ts || map[item[idF]].t || map[item[idF]].date || '';
          if (lTs > rTs) map[item[idF]] = item;
        }
      });
      
      var out = Object.values(map).concat(noId);
      return window.ptfApplyDeletionTombstones ? window.ptfApplyDeletionTombstones(key, JSON.stringify(out)) : JSON.stringify(out);
    } catch (e) { return remoteStr; }
  };
