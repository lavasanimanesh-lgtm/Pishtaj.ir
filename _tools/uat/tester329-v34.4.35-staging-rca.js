'use strict';
/* v34.4.35 — regression for staging RCA:
   1) an attachment refresh must perform a real pull even with dirty local data;
   2) attachment conflicts merge file keys and respect deletion tombstones;
   3) cheque books participate in client/server sync + backup;
   4) Arvan CORS subresource uses a valid SigV4 canonical query;
   5) cloud metadata is removed only after confirmed object deletion. */
var fs = require('fs');
var vm = require('vm');
var assert = require('assert');

function wait(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }

async function syncRuntimeChecks() {
  var store = {
    ptf_crm_token: 'token',
    ptf_sync_dirty: JSON.stringify({ ptf_crm_petty: true }),
    ptf_crm_petty: JSON.stringify([{ cd: 'PTY-1', files: [{ key: 'local.jpg' }], updatedAtISO: '2026-08-11T08:00:00Z' }])
  };
  var calls = [];
  var intervalFns = [];
  var ctx = {
    console: console, JSON: JSON, Math: Math, Array: Array, Object: Object, String: String,
    Date: Date, Promise: Promise, Blob: function () {}, navigator: { sendBeacon: function () {} },
    localStorage: {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
      setItem: function (k, v) { store[k] = String(v); },
      removeItem: function (k) { delete store[k]; }
    },
    curSession: function () { return { user: 'acc', name: 'حسابدار' }; },
    curRole: function () { return 'accountant'; },
    getData: function (k) { try { return JSON.parse(store[k] || '[]'); } catch (e) { return []; } },
    setData: function (k, v) { store[k] = JSON.stringify(v); },
    document: {
      hidden: false, activeElement: null,
      hasFocus: function () { return true; },
      querySelector: function () { return null; },
      getElementById: function (id) { return id === 'crmL' ? { style: { display: 'block' } } : null; },
      addEventListener: function () {}, body: { appendChild: function () {} }, documentElement: { style: { setProperty: function () {} } }
    },
    addEventListener: function () {},
    setInterval: function (fn) { intervalFns.push(fn); return intervalFns.length; },
    clearInterval: function () {}, clearTimeout: clearTimeout,
    setTimeout: setTimeout,
    fetch: function (url) {
      calls.push(url);
      if (url.indexOf('action=data_rev') > -1) {
        return Promise.resolve({ json: function () { return Promise.resolve({ ok: true, rev: 1 }); } });
      }
      if (url.indexOf('action=data_pull') > -1) {
        return Promise.resolve({ json: function () { return Promise.resolve({
          ok: true, rev: 2, meta: { ptf_crm_petty: { rev: 2 } },
          data: { ptf_crm_petty: JSON.stringify([{ cd: 'PTY-1', files: [{ key: 'remote.jpg' }], updatedAtISO: '2026-08-11T08:01:00Z' }]) }
        }); } });
      }
      if (url.indexOf('action=data_push') > -1) {
        return Promise.resolve({ json: function () { return Promise.resolve({ ok: true, rev: 3, conflicts: [], krevs: { ptf_crm_petty: 3 } }); } });
      }
      throw new Error('unexpected fetch ' + url);
    },
    ptfToast: function () {}, audit: function () {}, addLog: function () {},
    ptfUpdateGuardCounts: function () {}, updateInboxBadge: function () {}
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('crm/sync.js', 'utf8'), ctx, { filename: 'crm/sync.js' });

  /* Run only the boot interval once; the initial full pull finishes bootstrap while
     preserving the persisted dirty marker for the on-demand pull regression. */
  assert.ok(intervalFns.length, 'sync boot interval must be registered');
  intervalFns[0]();
  await wait(10);
  calls.length = 0;

  var result = null;
  ctx.ptfSyncPullNow(function (r) { result = r; });
  await wait(30);
  assert.ok(calls.some(function (u) { return u.indexOf('action=data_pull') > -1; }), 'dirty state must not turn pull-now into push-only/no-op');
  assert.ok(result && result.ok, 'pull-now callback must report the completed pull result');
  var petty = JSON.parse(store.ptf_crm_petty);
  var fileKeys = petty[0].files.map(function (f) { return f.key; }).sort();
  assert.deepStrictEqual(fileKeys, ['local.jpg', 'remote.jpg'], 'concurrent petty attachments must merge by file key');

  var localCheque = JSON.stringify([{ cd: 'CHQ-1', files: [{ key: 'old.jpg' }, { key: 'local.jpg' }], _deletedFileKeys: ['old.jpg'], updatedAtISO: '2026-08-11T09:00:00Z' }]);
  var remoteCheque = JSON.stringify([{ cd: 'CHQ-1', files: [{ key: 'old.jpg' }, { key: 'remote.jpg' }], updatedAtISO: '2026-08-11T08:59:00Z' }]);
  var merged = JSON.parse(ctx.ptfSmartMerge('ptf_crm_cheques_issued', localCheque, remoteCheque));
  assert.deepStrictEqual(merged[0].files.map(function (f) { return f.key; }).sort(), ['local.jpg', 'remote.jpg'], 'file tombstone must prevent deleted attachment resurrection');

  var localSf = JSON.stringify({ invoices: [], payments: [{ cd: 'PAY-1', files: [{ key: 'local-pay.jpg' }], updatedAtISO: '2026-08-11T09:00:00Z' }] });
  var remoteSf = JSON.stringify({ invoices: [], payments: [{ cd: 'PAY-1', files: [{ key: 'remote-pay.jpg' }], updatedAtISO: '2026-08-11T08:59:00Z' }] });
  var mergedSf = JSON.parse(ctx.ptfSmartMerge('ptf_crm_supplier_finance', localSf, remoteSf));
  assert.deepStrictEqual(mergedSf.payments[0].files.map(function (f) { return f.key; }).sort(), ['local-pay.jpg', 'remote-pay.jpg'], 'supplier payment attachment conflicts must merge');
}

function staticContracts() {
  var sync = fs.readFileSync('crm/sync.js', 'utf8');
  var api = fs.readFileSync('api/crm.php', 'utf8');
  assert.ok(/function otp_token_ok[\s\S]{0,300}strlen\(\$CAPTCHA_SECRET\) < 32/.test(api), 'OTP verifier must reject missing/short HMAC secret, not only token generation');
  assert.ok(api.indexOf('$captchaAge < 0') > -1 && api.indexOf('$otpAge < 0') > -1, 'captcha/OTP tokens from the future must be rejected');
  var backup = fs.readFileSync('crm/backup.js', 'utf8');
  var bridge = fs.readFileSync('crm/client-server.js', 'utf8');
  [sync, api, backup, bridge].forEach(function (src, i) {
    assert.ok(src.indexOf('ptf_crm_cheque_books') > -1, 'cheque-book sync contract missing in source #' + i);
  });
  var cors = fs.readFileSync('api/fix-arvan-cors.php', 'utf8');
  assert.ok((cors.match(/query='cors='/g) || []).length >= 2, 'GET/PUT CORS SigV4 canonical query must be cors=');
  assert.ok(cors.indexOf("REQUEST_METHOD") > -1 && cors.indexOf("method_not_allowed") > -1, 'CORS mutation must require POST');

  var storage = fs.readFileSync('crm/storage.js', 'utf8');
  var cheque = fs.readFileSync('crm/cheque-panel.js', 'utf8');
  var petty = fs.readFileSync('crm/petty.js', 'utf8');
  var supplier = fs.readFileSync('crm/supplier-finance.js', 'utf8');
  assert.ok(storage.indexOf('window.ptfDeleteStoredFile') > -1, 'confirmed cloud delete helper is required');
  [cheque, petty, supplier].forEach(function (src, i) {
    assert.ok(src.indexOf('ptfDeleteStoredFile') > -1, 'attachment module #' + i + ' must wait for cloud deletion');
    assert.ok(src.indexOf('_deletedFileKeys') > -1, 'attachment module #' + i + ' must persist file tombstones');
  });

  var version = JSON.parse(fs.readFileSync('VERSION.json', 'utf8')).crm_version;
  assert.strictEqual(version, 'v34.4.35');
  ['crm/index.html', 'crm/sw.js', 'crm/manifest.json', 'crm/clear-cache.html', 'crm/shell.js'].forEach(function (f) {
    assert.ok(fs.readFileSync(f, 'utf8').indexOf('34.4.35') > -1, f + ' must use the release cache version');
  });
}

syncRuntimeChecks().then(function () {
  staticContracts();
  console.log('PASS tester329-v34.4.35-staging-rca: real instant pull, attachment conflict merge/tombstones, confirmed delete, CORS SigV4, cheque-book sync, version hygiene');
}).catch(function (err) {
  console.error(err && err.stack || err);
  process.exit(1);
});
