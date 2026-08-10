/* CHQ-DOC-002 fixture (client follow-up, 2026-08-10, Persian):
   "بررسی کن ببین مشکل عدم نمایش ضمیمه‌ها در پنجره مودال باز شده چیه و چرا بعضا باید
   در تب تجدید مشاهده کرد ضمیمه‌ها رو و پنجره‌ای که باز می‌شود مثلاً ضمیمهٔ تنخواه را
   نمایش نمی‌دهد؟"

   Root cause found:
   - sync.js polls the server every 20s (slower in background tabs) and merges fresh
     data into localStorage, but refreshCurrentPanel() DELIBERATELY skips re-rendering
     while ANY modal (.md-b/.ptfdlg-b) is open — "don't jump mid-user-action". That is
     correct for editing forms, but it means attachment-VIEWER modals (petty expense
     docs, cheque docs, supplier invoice/payment ledger) that read localStorage exactly
     once at open time never pick up a document that was just uploaded from another
     device/session until the user closes the modal, navigates to a different CRM tab
     (forcing a fresh render call) and comes back — exactly the symptom reported.
   - Worse: if the record itself didn't exist locally yet (created moments ago on
     another device), ptfPettyFilesUi() silently did nothing (no modal, no error).

   Fix:
   - sync.js: window.ptfSyncPullNow(cb) — an on-demand pull bypassing the 20s/background
     throttle, usable by any UI code.
   - storage.js: window.ptfAttachRefreshOnOpen(dlgId, getSignature, reopenFn) — shared
     helper used by attachment-viewer modals: fires a pull-now right after opening and,
     if the signature (file keys) actually changed, tears down and rebuilds just that
     modal (never the whole panel) with fresh data.
   - petty.js / cheque-panel.js / supplier-finance.js wired into this helper; petty's
     viewer additionally retries once via pull-now if the record isn't found locally
     yet, instead of silently doing nothing. */
'use strict';
var fs = require('fs'), vm = require('vm'), assert = require('assert');

/* ===================== Part 1: sync.js — window.ptfSyncPullNow (functional, vm) ===================== */
(function () {
  var fetchCalls = [];
  var serverInvoices = JSON.stringify([{ cd: 'INV-1' }]);
  var ctx = {
    console: console, JSON: JSON, Math: Math, Array: Array, Object: Object, String: String, Date: Date, Promise: Promise,
    localStorage: (function () {
      var store = { ptf_crm_token: 'tok-123' };
      return {
        getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
        setItem: function (k, v) { store[k] = String(v); },
        removeItem: function (k) { delete store[k]; }
      };
    })(),
    curSession: function () { return { user: 'accountantUser', name: 'حسابدار' }; },
    curRole: function () { return 'accountant'; },
    document: { hidden: false, hasFocus: function () { return true; }, querySelector: function () { return null; }, activeElement: null, addEventListener: function () {}, getElementById: function () { return null; } },
    window: null,
    setInterval: function () { return 0; }, setTimeout: function (fn, ms) { return setTimeout(fn, 0); }, clearTimeout: function () {},
    fetch: function (url) {
      fetchCalls.push(url);
      return Promise.resolve({ json: function () { return Promise.resolve({ ok: true, rev: 5, meta: {}, data: { ptf_crm_petty: serverInvoices } }); } });
    },
    addLog: function () {}, audit: function () {}, ptfToast: function () {},
    ptfUpdateGuardCounts: function () {}, updateInboxBadge: function () {}
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('crm/sync.js', 'utf8'), ctx, { filename: 'sync.js' });

  assert.strictEqual(typeof ctx.window.ptfSyncPullNow, 'function', 'CHQ-DOC-002: window.ptfSyncPullNow باید در sync.js تعریف شده باشد');
  var called = false;
  ctx.window.ptfSyncPullNow(function () { called = true; });
  /* fetch is async (Promise-based); flush microtasks synchronously via a drain loop */
  return new Promise(function (resolve) {
    setTimeout(function () {
      assert.ok(fetchCalls.length > 0, 'CHQ-DOC-002: ptfSyncPullNow باید فوراً یک pull واقعی (fetch) بزند، نه منتظر تایمر ۲۰ثانیه‌ای بماند');
      assert.strictEqual(called, true, 'CHQ-DOC-002: ptfSyncPullNow باید callback را بعد از اتمام pull صدا بزند');
      console.log('PASS tester179 Part 1: sync.js ptfSyncPullNow triggers an immediate, on-demand pull (2 checks)');
      resolve();
    }, 30);
  });
})()

/* ===================== Part 2: storage.js — ptfAttachRefreshOnOpen (functional, vm) ===================== */
.then(function () {
  var pulled = 0;
  var sig = ['old-key'];
  var mutateSigOnNextPull = null; /* simulates the pull discovering a new file on the server */
  var reopened = false;
  var elements = { myDlg: {} };
  var ctx = {
    console: console, JSON: JSON,
    document: { getElementById: function (id) { return elements[id] || null; } },
    ptfToast: function () {},
    ptfSyncPullNow: function (cb) {
      pulled++;
      setTimeout(function () {
        if (mutateSigOnNextPull) { sig = mutateSigOnNextPull; mutateSigOnNextPull = null; }
        cb();
      }, 0);
    }
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  /* storage.js has heavier top-level deps (DOM upload widgets, fetch, etc.) that aren't
     needed for this unit; extract just the two new functions to keep the vm sandbox
     minimal and avoid unrelated ReferenceErrors from unrunnable code above them. */
  var src = fs.readFileSync('crm/storage.js', 'utf8');
  var start = src.indexOf('window.ptfAttachRefreshOnOpen');
  assert.ok(start > -1, 'ptfAttachRefreshOnOpen باید در storage.js وجود داشته باشد');
  var end = src.indexOf('\n};', start) + 3;
  vm.runInContext(src.slice(start, end), ctx, { filename: 'storage.js#ptfAttachRefreshOnOpen' });

  var removed = false;
  elements.myDlg.remove = function () { removed = true; };
  ctx.window.ptfAttachRefreshOnOpen('myDlg', function () { return sig; }, function () { reopened = true; });
  return new Promise(function (resolve) {
    setTimeout(function () {
      assert.strictEqual(pulled, 1, 'باید یک pull فوری درخواست شود');
      assert.strictEqual(removed, false, 'اگر امضا تغییر نکرده، نباید مودال بسته شود');
      assert.strictEqual(reopened, false, 'اگر امضا تغییر نکرده، نباید مودال دوباره باز شود');

      /* Now simulate a document that just appeared on another device: the pull itself
         will change the signature AFTER 'before' is captured but BEFORE 'after' is read. */
      mutateSigOnNextPull = ['old-key', 'new-key-from-another-device'];
      ctx.window.ptfAttachRefreshOnOpen('myDlg', function () { return sig; }, function () { reopened = true; });
      setTimeout(function () {
        assert.strictEqual(removed, true, 'CHQ-DOC-002: اگر امضای اسناد تغییر کرد، مودال باید حذف شود تا دوباره ساخته شود');
        assert.strictEqual(reopened, true, 'CHQ-DOC-002: reopenFn باید صدا زده شود تا مودال با دادهٔ تازه دوباره باز شود');
        console.log('PASS tester179 Part 2: storage.js ptfAttachRefreshOnOpen refreshes only when the signature changed (4 checks)');
        resolve();
      }, 10);
    }, 10);
  });
})

/* ===================== Part 3: structural wiring checks (petty.js / cheque-panel.js / supplier-finance.js) ===================== */
.then(function () {
  var petty = fs.readFileSync('crm/petty.js', 'utf8');
  assert.ok(/if \(!r\) \{[\s\S]{0,400}ptfSyncPullNow/.test(petty), 'CHQ-DOC-002: اگر رکورد تنخواه محلی یافت نشد، باید pull فوری بزند و دوباره تلاش کند (نه سکوت کامل)');
  assert.ok(petty.indexOf("ptfAttachRefreshOnOpen('ptfPettyFilesDlg'") > -1, 'CHQ-DOC-002: مودال اسناد تنخواه باید به ptfAttachRefreshOnOpen وصل باشد');

  var cheque = fs.readFileSync('crm/cheque-panel.js', 'utf8');
  assert.ok(cheque.indexOf("ptfAttachRefreshOnOpen('ptfChFilesDlg'") > -1, 'CHQ-DOC-002: مودال اسناد چک باید به ptfAttachRefreshOnOpen وصل باشد');

  var supf = fs.readFileSync('crm/supplier-finance.js', 'utf8');
  assert.ok(supf.indexOf("ptfAttachRefreshOnOpen('slLedgerDlg'") > -1, 'CHQ-DOC-002: مودال گردش حساب تأمین‌کننده باید به ptfAttachRefreshOnOpen وصل باشد');
  assert.ok(/var _slLedgerDocRefresh = window\.slOpenLedger;/.test(supf), 'CHQ-DOC-002: اصلاح باید نسخهٔ نهاییِ فعالِ slOpenLedger را wrap کند، نه یک نسخهٔ میانی را');

  console.log('PASS tester179 Part 3: petty.js / cheque-panel.js / supplier-finance.js wiring (5 structural checks)');
  console.log('PASS tester179-v34.4.31-attachment-modal-stale-sync-fix: all parts green');
})
.catch(function (e) { console.error(e); process.exit(1); });
