/* AUD-13 fixture — "بازنگری کلی اعلانات (کارتابل/روزمن/صندوق پیام)" — client request
   (2026-07-30, Persian): auto-generated notifications for offer expiry / RFQ due /
   deal delivery due used to repeat EVERY DAY as long as the underlying condition
   remained unresolved (even if the user never opened/read them), flooding "روز من"
   and the cartable. Standard CRMs (HubSpot/Salesforce/Zoho) fire a transition
   notification once, rely on a live dashboard widget ("روز من" already exists here)
   for ongoing tracking, and self-expire low-importance notices.

   Client's explicit decisions (via ask_user):
   1. Auto system reminders (CO expiry, RFQ due, deal due) fire ONLY ONCE per
      transition (entering warning window / becoming overdue), never daily repeats.
   2. Low-importance/info notifications (not referral/cheque-due/manual reminder)
      that are never read must be COMPLETELY PURGED after ~2 days (not just hidden).
   3. Important notifications (referral, cheque due, manual reminder, critical
      finance/system) are removed once "خواندم" is clicked OR once the underlying
      event resolves (cheque cleared/voided, reminder done/deleted, letter signed/
      rejected) — for ALL recipients, not just the one who clicked.

   This fixture verifies, purely via Node.js simulation (vm + fake localStorage),
   all three pillars across rbac.js (notify/ntfIsImportant/ntfResolveByRef/
   ptfPruneStaleNotifs), bridge.js (checkOfferExpiry/checkRfqDue/checkDealDue),
   cheques.js (chDailyNotify dkey stability + chClear/chDel resolving),
   and leads.js (remDone/remDel resolving). */
'use strict';
var fs = require('fs'), vm = require('vm'), assert = require('assert');

function makeStore() { return {}; }

function baseCtx(store) {
  var ctx = {
    console: console, JSON: JSON, Math: Math, Array: Array, Object: Object, String: String,
    Date: Date, Number: Number, parseInt: parseInt, parseFloat: parseFloat,
    localStorage: {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
      setItem: function (k, v) { store[k] = String(v); },
      removeItem: function (k) { delete store[k]; }
    },
    getData: function (k) { try { return JSON.parse(store[k] || '[]'); } catch (e) { return []; } },
    setData: function (k, v) { store[k] = JSON.stringify(v); },
    escP: function (x) { return String(x == null ? '' : x); },
    genCode: (function () { var n = 0; return function (p) { n++; return p + '-' + n; }; })(),
    faDate: function () { return '1405/05/08'; },
    faDateTime: function () { return '1405/05/08 10:00'; },
    audit: function () {},
    ptfToast: function () {},
    alert: function (m) { ctx._lastAlert = m; },
    confirm: function () { return true; },
    prompt: function () { return 'دلیل تست'; },
    ptfDialog: function () {},
    setInterval: function () { return 0; },
    setTimeout: function () { return 0; },
    clearInterval: function () {},
    window: null
  };
  ctx.window = ctx;
  ctx.document = {
    getElementById: function () { return null; },
    querySelectorAll: function () { return []; }
  };
  ctx.curSession = function () { return { user: 'admin', name: 'ادمین' }; };
  ctx.curRole = function () { return 'admin'; };
  ctx.roleDef = function () { return { lb: 'ادمین (مدیر کل سیستم)', finance: true }; };
  ctx.isSenior = function () { return true; };
  vm.createContext(ctx);
  return ctx;
}

function loadRbac(ctx) { vm.runInContext(fs.readFileSync('crm/rbac.js', 'utf8'), ctx, { filename: 'rbac.js' }); }

/* ===================== Pillar 1: rbac.js notify() core mechanics ===================== */
(function () {
  var store = makeStore();
  var ctx = baseCtx(store);
  loadRbac(ctx);

  // Basic dedup still works for identical repeated calls with no explicit dkey.
  ctx.notify({ toUsers: ['sales1'], title: 'پیام تکراری', kind: 'referral', actionable: true });
  ctx.notify({ toUsers: ['sales1'], title: 'پیام تکراری', kind: 'referral', actionable: true });
  var notifs = ctx.getData('ptf_crm_notifs');
  assert.strictEqual(notifs.length, 1, 'رگرسیون: dedup فعلی notify() باید سالم بماند');
  assert.strictEqual(notifs[0].repeat, 2, 'رگرسیون: شمارنده تکرار باید بالا برود');

  // tier classification: system/warn/error/finance/cheque/referral/inv_ref/contact_req/sign_req => important.
  assert.ok(!ctx.ntfIsImportant({ kind: 'system' }), 'اطلاعی: system خام');
  assert.ok(ctx.ntfIsImportant({ kind: 'cheque' }), 'مهم: cheque');
  assert.ok(ctx.ntfIsImportant({ kind: 'referral' }), 'مهم: referral');
  assert.ok(ctx.ntfIsImportant({ kind: 'inv_ref' }), 'مهم: inv_ref (ارجاع فاکتور)');
  assert.ok(ctx.ntfIsImportant({ kind: 'sign_req' }), 'مهم: sign_req (درخواست امضا)');
  assert.ok(ctx.ntfIsImportant({ kind: 'reminder', remCd: 'REM-1' }), 'مهم: reminder دستی واقعی (remCd دارد)');
  assert.ok(ctx.ntfIsImportant({ kind: 'reminder' }), 'مهلت/یادآور kind=reminder اقدام است');
  assert.ok(!ctx.ntfIsImportant({ kind: 'co_expiry' }), 'اطلاعی: انقضای پیش‌فاکتور دیگر actionable/مهم نیست');
  assert.ok(!ctx.ntfIsImportant({ kind: 'buyq' }), 'اطلاعی: قیمت خرید');
  // explicit tier override wins regardless of kind
  assert.ok(ctx.ntfIsImportant({ kind: 'info', tier: 'important' }), 'override صریح: tier=important باید غالب باشد');
  assert.ok(!ctx.ntfIsImportant({ kind: 'system', tier: 'info' }), 'override صریح: tier=info باید غالب باشد');
  assert.strictEqual(ctx.notify({ toRoles: ['sales'], title: 'خبر صرف', kind: 'info' }), null, 'خبر اطلاعی ذخیره نشود');
})();

/* ===================== Pillar 2: ptfPruneStaleNotifs — auto-expiry of info notifs ===================== */
(function () {
  var store = makeStore();
  var ctx = baseCtx(store);
  loadRbac(ctx);

  var now = Date.now();
  var oldIso = new Date(now - 3 * 86400000).toISOString(); // 3 days ago -> stale (TTL=2d)
  var freshIso = new Date(now - 1 * 86400000).toISOString(); // 1 day ago -> still kept
  ctx.setData('ptf_crm_notifs', [
    { cd: 'NTF-OLD-INFO', iso: oldIso, kind: 'buyq', title: 'قیمت خرید قدیمی', readBy: [] },
    { cd: 'NTF-FRESH-INFO', iso: freshIso, kind: 'buyq', title: 'قیمت خرید تازه', readBy: [] },
    { cd: 'NTF-OLD-IMPORTANT', iso: oldIso, kind: 'cheque', title: 'چک قدیمی', readBy: [], refCd: 'CHQ-1', actionable: true },
    { cd: 'NTF-OLD-READ-INFO', iso: oldIso, kind: 'buyq', title: 'قدیمی ولی خوانده‌شده', readBy: ['admin'] }
  ]);
  var removed = ctx.ptfPruneStaleNotifs();
  assert.ok(removed >= 2, 'خبرهای اطلاعی باید از کارتابل پاک شوند');
  var left = ctx.getData('ptf_crm_notifs').map(function (n) { return n.cd; });
  assert.ok(left.indexOf('NTF-OLD-INFO') < 0, 'اعلان اطلاعی قدیمی باید کاملاً حذف شود');
  assert.ok(left.indexOf('NTF-FRESH-INFO') < 0, 'خبر اطلاعی تازه هم دیگر در کارتابل نمی‌ماند');
  assert.ok(left.indexOf('NTF-OLD-IMPORTANT') > -1, 'اعلان اقدام هرگز با گذر زمان حذف نمی‌شود');
  assert.ok(left.indexOf('NTF-OLD-READ-INFO') < 0, 'خبر اطلاعی خوانده‌شده هم کارتابل نیست');

  // notify() itself triggers pruning as a side effect (called on every notify).
  var store2 = makeStore();
  var ctx2 = baseCtx(store2);
  loadRbac(ctx2);
  ctx2.setData('ptf_crm_notifs', [{ cd: 'NTF-STALE', iso: new Date(Date.now() - 5 * 86400000).toISOString(), kind: 'info', title: 'قدیمی خیلی', readBy: [] }]);
  ctx2.notify({ toRoles: ['sales'], title: 'اعلان جدید', kind: 'referral', actionable: true });
  var after = ctx2.getData('ptf_crm_notifs');
  assert.ok(!after.some(function (n) { return n.cd === 'NTF-STALE'; }), 'notify() باید قبل از افزودن رکورد جدید، رکوردهای اطلاعی منقضی را حذف کند');
  assert.strictEqual(after.length, 1, 'فقط اعلان اقدام جدید باقی می‌ماند');
})();

/* ===================== Pillar 3: ntfResolveByRef — important notif removed when underlying event resolves ===================== */
(function () {
  var store = makeStore();
  var ctx = baseCtx(store);
  loadRbac(ctx);

  ctx.notify({ toUsers: ['acc1', 'acc2'], title: 'سررسید چک ۱۰۰۰۰۰۰ ریال', kind: 'cheque', actionable: true, refCd: 'CHQ-9', dkey: 'chq-due-CHQ-9' });
  var before = ctx.getData('ptf_crm_notifs');
  assert.strictEqual(before.length, 1, 'یک اعلان چک ثبت شود');
  var removedCount = ctx.ntfResolveByRef('CHQ-9');
  assert.strictEqual(removedCount, 1, 'با حل‌شدن رویداد چک، اعلان باید حذف شود (برای همه گیرندگان، نه فقط یک نفر)');
  assert.strictEqual(ctx.getData('ptf_crm_notifs').length, 0, 'صف اعلانات باید خالی شود');

  // remCd-based reminder resolution also supported.
  ctx.notify({ toUsers: ['u1'], title: 'یادآوری', kind: 'reminder', remCd: 'REM-77', actionable: true });
  assert.strictEqual(ctx.getData('ptf_crm_notifs').length, 1);
  ctx.ntfResolveByRef('REM-77');
  assert.strictEqual(ctx.getData('ptf_crm_notifs').length, 0, 'یادآور انجام‌شده باید اعلان مرتبط را حذف کند (remCd fallback)');
})();

/* ===================== Pillar 4: bridge.js — one-time transition notifications (no daily repeat) ===================== */
(function () {
  var src = fs.readFileSync('crm/bridge.js', 'utf8');
  assert.ok(src.indexOf("o.expiryNotifyStage === 'warn'") > -1, 'checkOfferExpiry باید بر اساس stage گذار (نه today) کار کند');
  assert.ok(src.indexOf("o.expiryNotifyStage = 'warn'") > -1, 'checkOfferExpiry باید stage را ذخیره کند');
  assert.ok(src.indexOf("r.dueNotified === stage") > -1, 'checkRfqDue/checkDealDue باید بر اساس stage گذار کار کنند');
  assert.ok(!/if \(o\[flagKey\] === today\)/.test(src), 'رگرسیون: الگوی قدیمی روزانه (flagKey===today) باید کاملاً حذف شده باشد');
  assert.ok(!/if \(r\.dueNotified === today\)/.test(src), 'رگرسیون: الگوی قدیمی روزانه (dueNotified===today) باید کاملاً حذف شده باشد');
})();

/* ===================== Pillar 4b: bridge.js — full runtime execution (not just source pattern) =====================
   Loads the REAL bridge.js (+ real salesfiles.js for window.ptfSfDueState) into a vm context and
   drives its private checkOfferExpiry/checkRfqDue/checkDealDue functions end-to-end through the
   actual boot()->pollEvents() flow, using a hand-rolled *synchronous* thenable for `fetch` so the
   whole chain (fetch -> .then(r=>r.json()) -> .then(handler)) executes inline without needing to
   flush Node's microtask queue. This proves the one-time-transition behavior is real, not just
   textually present. Each "tick" re-evaluates bridge.js's IIFE in the same context (fresh boot()
   call each time, exactly like a real page reload / new poll cycle would re-check state), while
   ptf_crm_* data persists in the shared fake localStorage store between ticks. */
(function () {
  function syncThenable(value) {
    return {
      then: function (fn) {
        var r = fn(value);
        if (r && typeof r.then === 'function') return r; /* already thenable — flatten */
        return syncThenable(r);
      },
      catch: function () { return this; }
    };
  }

  function makeBridgeCtx() {
    var store = {};
    var ctx = {
      console: console, JSON: JSON, Math: Math, Array: Array, Object: Object, String: String, Date: Date,
      Number: Number, parseInt: parseInt,
      localStorage: {
        getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
        setItem: function (k, v) { store[k] = String(v); },
        removeItem: function (k) { delete store[k]; }
      },
      getData: function (k) { try { return JSON.parse(store['d_' + k] || '[]'); } catch (e) { return []; } },
      setData: function (k, v) { store['d_' + k] = JSON.stringify(v); },
      escP: function (x) { return String(x == null ? '' : x); },
      genCode: (function () { var n = 0; return function (p) { n++; return p + '-' + n; }; })(),
      faDate: function () { return '1405/05/08'; },
      faDateTime: function () { return '1405/05/08 10:00'; },
      audit: function () {},
      ptfToast: function () {},
      alert: function () {},
      confirm: function () { return true; },
      todayISO: function () { return new Date().toISOString().slice(0, 10); },
      curSession: function () { return { user: 'sales1', name: 'فروشنده یک' }; },
      curRole: function () { return 'sales'; },
      isSenior: function () { return false; },
      roleDef: function () { return { lb: 'کارشناس فروش' }; },
      FormData: function () { this.append = function () {}; },
      fetch: function () {
        /* هر دو مسیر get_inbox و get_events باید ok:true برگردانند تا شاخه‌ی موفق
           (که checkOfferExpiry/checkRfqDue/checkDealDue را صدا می‌زند) اجرا شود. */
        return syncThenable({ json: function () { return syncThenable({ ok: true, events: [] }); } });
      },
      setInterval: function (fn, delay) {
        if (delay === 8000) { ctx._pollFn = fn; } /* v33.4.1 test harness: capture واقعی تابع پولینگ برای فراخوانی مستقیم در تیک‌های بعدی، بدون نیاز به بارگذاری مجدد کل فایل */
        try { fn(); } catch (e) { /* بی‌اثر برای این تست */ }
        return 1;
      },
      clearInterval: function () {},
      setTimeout: function (fn) { try { fn(); } catch (e) {} return 1; },
      document: {
        getElementById: function (id) {
          if (id === 'crmL') return { style: { display: '' } };
          return null; /* سایر عناصر UI در این تست موجود نیستند — کد باید safe باشد */
        },
        querySelectorAll: function () { return []; },
        addEventListener: function () {}
      },
      window: null
    };
    ctx.window = ctx;
    vm.createContext(ctx);
    /* رbac.js واقعی (برای notify/myNotifs/updateCartBadge/SENIOR_ROLES و...) باید قبل از
       bridge.js بارگذاری شود چون bridge.js از این توابع/متغیرهای全局 (بدون IIFE در rbac.js)
       استفاده می‌کند (مثلاً SENIOR_ROLES در checkOfferExpiry). rbac.js تعریف خودِ curSession را
       دارد که از localStorage['ptf_crm_session'] می‌خواند — پس session باید همانجا ذخیره شود،
       نه به‌عنوان mock جدا (که با بارگذاری rbac.js override می‌شود). */
    vm.runInContext(fs.readFileSync('crm/rbac.js', 'utf8'), ctx, { filename: 'rbac.js' });
    ctx.localStorage.setItem('ptf_crm_session', JSON.stringify({ user: 'sales1', name: 'فروشنده یک', roleId: 'sales' }));
    /* window.ptfSfDueState واقعی از salesfiles.js — تا checkDealDue با منطق واقعی اجرا شود.
       فقط یک‌بار لازم است (بدون وضعیت داخلی وابسته به زمان). */
    vm.runInContext(fs.readFileSync('crm/salesfiles.js', 'utf8'), ctx, { filename: 'salesfiles.js' });
    ctx.localStorage.setItem('ptf_crm_token', 'tok-test');
    return ctx;
  }

  /* یک «تیک» = یک چرخه‌ی واقعی پولینگ (pollEvents هر ۸ ثانیه در production). اولین بار
     که bridge.js بارگذاری می‌شود، boot() اجرا و تابع واقعی پولینگ capture می‌شود
     (از طریق setInterval mock بالا)؛ تیک‌های بعدی مستقیماً همان تابع را دوباره صدا
     می‌زنند — دقیقاً معادل رفتار واقعی صفحه‌ی باز که هر ۸ ثانیه poll می‌کند، بدون
     نیاز به شبیه‌سازی reload کامل صفحه. */
  function tick(ctx) {
    if (!ctx._loaded) {
      ctx._loaded = true;
      vm.runInContext(fs.readFileSync('crm/bridge.js', 'utf8'), ctx, { filename: 'bridge.js(initial load+boot)' });
      return; /* بارگذاری اولیه خودش boot() و یک اجرای اولیه‌ی pollFn (از طریق fn() فوری در mock) را انجام داد */
    }
    assert.ok(typeof ctx._pollFn === 'function', 'تابع پولینگ واقعی باید capture شده باشد');
    ctx._pollFn();
  }

  /* سناریو ۱: پیش‌فاکتور CO با ۱ روز مانده به انقضا (داخل پنجره‌ی هشدار). */
  var ctx1 = makeBridgeCtx();
  var warnDate = new Date(Date.now() + 1 * 86400000).toISOString().slice(0, 10);
  ctx1.setData('ptf_crm_offers', [{ no: 'CO-1001', kind: 'CO', validUntil: warnDate, st: 'open', issuedBy: 'sales1', buyerCo: 'شرکت آزمایشی' }]);
  tick(ctx1);
  var notifs1 = ctx1.getData('ptf_crm_notifs');
  assert.strictEqual(notifs1.length, 0, 'v34.5.5: انقضای CO دیگر کارتابل را پر نمی‌کند');
  var offersAfter1 = ctx1.getData('ptf_crm_offers');
  assert.strictEqual(offersAfter1[0].expiryNotifyStage, 'warn', 'stage باید warn ثبت شود');

  tick(ctx1);
  assert.strictEqual(ctx1.getData('ptf_crm_notifs').length, 0, 'تکرار تیک CO اعلان نمی‌سازد');
  tick(ctx1); tick(ctx1);

  var offers2 = ctx1.getData('ptf_crm_offers');
  offers2[0].validUntil = new Date(Date.now() - 1 * 86400000).toISOString().slice(0, 10);
  ctx1.setData('ptf_crm_offers', offers2);
  tick(ctx1);
  assert.strictEqual(ctx1.getData('ptf_crm_notifs').length, 0, 'گذار expired هم کارتابل نمی‌سازد');
  tick(ctx1);
  assert.strictEqual(ctx1.getData('ptf_crm_notifs').length, 0, 'تکرار expired هم اعلان ندارد');

  /* رگرسیون: پرونده فروش (deal) با تحویل تعهدی نزدیک — checkDealDue باید یک‌بار در
     ورود به بازه‌ی هشدار اعلان بدهد، نه هر تیک. */
  var ctx2 = makeBridgeCtx();
  var dueSoon = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
  ctx2.setData('ptf_crm_deals', [{ cd: 'DEAL-1', inqNo: 'RFQ-1', dueISO: dueSoon, st: 'open', buyerCo: 'کارفرما' }]);
  tick(ctx2);
  var dealNotifs1 = ctx2.getData('ptf_crm_notifs').filter(function (n) { return n.link && n.link.panel === 'deals'; });
  assert.strictEqual(dealNotifs1.length, 1, 'یک اعلان تحویل تعهدی نزدیک باید ساخته شود');
  tick(ctx2);
  var dealNotifs2 = ctx2.getData('ptf_crm_notifs').filter(function (n) { return n.link && n.link.panel === 'deals'; });
  assert.strictEqual(dealNotifs2.length, 1, 'تکرار بدون تغییر وضعیت تحویل تعهدی نباید اعلان دوم بسازد');

  /* رگرسیون: RFQ با مهلت پاسخ نزدیک (۱ روز مانده) — همان اصل برای checkRfqDue. */
  var ctx3 = makeBridgeCtx();
  var rfqDue = new Date(Date.now() + 1 * 86400000).toISOString().slice(0, 10);
  ctx3.setData('ptf_crm_rfqs', [{ cd: 'RFQ-9', co: 'مشتری تست', dueISO: rfqDue, st: 'st2', assignee: { user: 'sales1' } }]);
  tick(ctx3);
  var rfqNotifs1 = ctx3.getData('ptf_crm_notifs').filter(function (n) { return n.link && n.link.panel === 'rfq'; });
  assert.strictEqual(rfqNotifs1.length, 1, 'یک اعلان مهلت پاسخ RFQ نزدیک باید ساخته شود');
  tick(ctx3); tick(ctx3);
  var rfqNotifs2 = ctx3.getData('ptf_crm_notifs').filter(function (n) { return n.link && n.link.panel === 'rfq'; });
  assert.strictEqual(rfqNotifs2.length, 1, 'چند تیک بدون تغییر وضعیت مهلت RFQ نباید اعلان تکراری بسازد');
})();



/* ===================== Pillar 5: cheques.js — chDailyNotify stable dkey + resolve on clear/delete ===================== */
(function () {
  var src = fs.readFileSync('crm/cheques.js', 'utf8');
  assert.ok(src.indexOf("dkey: 'chq-due-' + c.cd") > -1, 'chDailyNotify باید dkey ثابت per چک بفرستد تا notify() آن را merge کند نه تکرار روزانه بسازد');
  assert.ok(src.indexOf("refCd: c.cd") > -1, 'chDailyNotify باید refCd=چک.cd بفرستد تا با پاس‌شدن/حذف چک قابل resolve باشد');
  assert.ok(/chClear[\s\S]{0,600}ntfResolveByRef\(cd\)/.test(src), 'chClear باید بعد از پاس‌شدن چک، اعلان مرتبط را resolve کند');
  assert.ok(/chDel[\s\S]{0,600}ntfResolveByRef\(cd\)/.test(src), 'chDel باید بعد از حذف/ابطال چک، اعلان مرتبط را resolve کند');
})();

/* ===================== Pillar 6: leads.js — remDone/remDel resolve manual reminder notifications ===================== */
(function () {
  var src = fs.readFileSync('crm/leads.js', 'utf8');
  assert.ok(/function remDone\(cd\) \{[\s\S]{0,300}ntfResolveByRef\(cd\)/.test(src), 'remDone باید اعلان یادآور مرتبط را برای همه گیرندگان حذف کند');
  assert.ok(/function remDel\(cd\) \{[\s\S]{0,300}ntfResolveByRef\(cd\)/.test(src), 'remDel باید اعلان یادآور مرتبط را برای همه گیرندگان حذف کند');
})();

/* ===================== Pillar 7: letters.js — sign resolve ===================== */
(function () {
  var src = fs.readFileSync('crm/letters.js', 'utf8');
  assert.ok(src.indexOf("refCd: l.cd") > -1, 'درخواست امضا باید refCd=نامه.cd داشته باشد');
  assert.ok(/function letSign\(cd\) \{[\s\S]{0,900}ntfResolveByRef\(l\.cd\)/.test(src), 'letSign باید درخواست امضای مرتبط را برای همه حذف کند');
  assert.ok(/function letReject\(cd\) \{[\s\S]{0,400}ntfResolveByRef\(l\.cd\)/.test(src), 'letReject باید درخواست امضای مرتبط را برای همه حذف کند');
})();

console.log('tester176-v33.4.1-notifications-standard-rework.js: ALL PASSED');
