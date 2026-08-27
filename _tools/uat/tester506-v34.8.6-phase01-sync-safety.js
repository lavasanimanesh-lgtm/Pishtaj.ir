/* tester506 — v34.8.29/F0-1: Phase-B single transport, financial projection safety
 * and server per-key identity/revision guards. This test is intentionally non-mutating
 * and uses only isolated in-memory fixtures. */
'use strict';
var fs = require('fs');
var vm = require('vm');
var assert = require('assert');
var sync = fs.readFileSync('crm/sync.js', 'utf8');
var clientServer = fs.readFileSync('crm/client-server.js', 'utf8');
var api = fs.readFileSync('api/crm.php', 'utf8');

function storage() {
  var data = {};
  return {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
    setItem: function (k, v) { data[k] = String(v); },
    removeItem: function (k) { delete data[k]; }
  };
}
function context() {
  var ls = storage();
  var c = {
    window: null, console: console, localStorage: ls,
    setData: function (k, v) { ls.setItem(k, JSON.stringify(v)); return true; },
    getData: function (k) { try { return JSON.parse(ls.getItem(k) || '[]'); } catch (e) { return []; } },
    curRole: function () { return 'admin'; },
    curSession: function () { return { user: 'admin', name: 'Phase 1 Admin' }; },
    ptfToast: function () {}, audit: function () {}, notify: function () {},
    document: {
      hidden: true,
      hasFocus: function () { return true; },
      activeElement: null,
      getElementById: function () { return null; },
      querySelector: function () { return null; },
      querySelectorAll: function () { return []; },
      addEventListener: function () {},
      documentElement: { style: { setProperty: function () {} } }
    },
    navigator: {}, location: {},
    setInterval: function () { return 1; }, clearInterval: function () {},
    setTimeout: function () { return 1; }, clearTimeout: function () {},
    addEventListener: function () {},
    fetch: function () { return Promise.resolve({ json: function () { return Promise.resolve({ ok: true, fresh: true, rev: 1, meta: {} }); } }); },
    Promise: Promise, Date: Date, JSON: JSON, Math: Math, Object: Object,
    Array: Array, String: String, Number: Number, RegExp: RegExp, Error: Error,
    isFinite: isFinite, parseInt: parseInt
  };
  c.window = c;
  c.ptfBPhaseActive = function () { return true; };
  c.ptfBEnqueueKeys = function () { return true; };
  c.ptfBPendingKeys = function () { return []; };
  c.ptfBFlushQueue = function (cb) { if (cb) cb({ ok: true, savedKeys: [] }); };
  vm.createContext(c);
  vm.runInContext(sync, c, { filename: 'sync-phase01.js' });
  return c;
}

console.log('── Phase 1 static contract ──');
assert.ok(api.indexOf("['ptf_crm_opex','ptf_crm_sharetx','ptf_crm_shareholders']") > -1, 'all protected finance keys');
assert.ok(api.indexOf('function sync_protected_identity_index') > -1, 'physical identity helper');
assert.ok(api.indexOf('if ($saved > 0) $meta[\'_global\'] = [\'rev\' => $pushNextRev') > -1, 'single push revision');
assert.ok(api.indexOf("'fresh' => true, 'meta' => $meta") > -1, 'fresh pull carries per-key metadata');
assert.ok(clientServer.indexOf('base: base || bPullRevs()') > -1, 'Phase B sends per-key base');
assert.ok(clientServer.indexOf('Array.isArray(d.savedKeys)') > -1, 'Phase B requires explicit savedKeys ACK');
assert.ok(clientServer.indexOf('function bReadValue') > -1 && clientServer.indexOf('ptfStorageIdbGet') > -1, 'queue reads IDB mirror');
assert.ok(clientServer.indexOf('window.ptfBEnqueueKeys') > -1, 'shared dirty-to-Phase-B bridge');
assert.ok(sync.indexOf('window.ptfSyncAcknowledgeKeys') > -1, 'generation-safe common ACK');
assert.ok(sync.indexOf('window.ptfSyncMergeServerProjection') > -1, 'financial projection merge guard');
assert.ok(sync.indexOf('if (typeof window.ptfBPhaseActive') > -1, 'Phase B suppresses second push engine');
assert.ok(sync.indexOf('function applyServerMeta') > -1 && sync.indexOf('if (d.fresh)') > -1, 'authoritative metadata on fresh pull');
console.log('  ✔ server/client Phase 1 contract is present');

console.log('── Phase 1 runtime projection safety ──');
var c = context();
var local = [{ cd: 'LOCAL-CHAIR', type: 'chair_in', amt: 5000000000 }];
var remote = [{ cd: 'SERVER-SAL', type: 'salary', recurringKey: 'salary:SH1:1405/06', amt: 400 }];
c.localStorage.setItem('ptf_crm_sharetx', JSON.stringify(local));
var merged = JSON.parse(c.ptfSyncMergeServerProjection('ptf_crm_sharetx', JSON.stringify(local), JSON.stringify(remote)));
assert.ok(merged.some(function (r) { return r.cd === 'LOCAL-CHAIR'; }), 'local financial row was dropped by projection');
assert.ok(merged.some(function (r) { return r.cd === 'SERVER-SAL'; }), 'server financial row missing after projection');
assert.ok(c.ptfSyncPendingKeys().indexOf('ptf_crm_sharetx') >= 0, 'preserved local row was not marked dirty');
console.log('  ✔ omitted local financial rows are preserved and re-queued');

var duplicateRemote = [
  { cd: 'SAL-A', type: 'salary', recurringKey: 'salary:SH1:1405/06', amt: 400 },
  { cd: 'SAL-B', type: 'salary', recurringKey: 'salary:SH1:1405/06', amt: 400 }
];
var duplicateMerged = JSON.parse(c.ptfSyncMergeServerProjection('ptf_crm_sharetx', '[]', JSON.stringify(duplicateRemote)));
assert.strictEqual(duplicateMerged.filter(function (r) { return r.recurringKey === 'salary:SH1:1405/06'; }).length, 2);
console.log('  ✔ recurringKey مشترک، دو cd فیزیکی را collapse نمی‌کند');

console.log('── Phase 1 generation-safe ACK ──');
c.localStorage.setItem('ptf_crm_settings', JSON.stringify({ generation: 'new' }));
c.ptfSyncNotifyDirty('ptf_crm_settings');
c.ptfSyncAcknowledgeKeys(['ptf_crm_settings'], { ptf_crm_settings: JSON.stringify({ generation: 'old' }) });
assert.ok(c.ptfSyncPendingKeys().indexOf('ptf_crm_settings') >= 0, 'older ACK cleared newer generation');
c.ptfSyncAcknowledgeKeys(['ptf_crm_settings'], { ptf_crm_settings: JSON.stringify({ generation: 'new' }) });
assert.strictEqual(c.ptfSyncPendingKeys().indexOf('ptf_crm_settings'), -1);
console.log('  ✔ ACK قدیمی نسل جدید را پاک نمی‌کند و ACK هم‌نسل آن را پاک می‌کند');

console.log('PASS tester506 v34.8.29 phase01 sync safety');


console.log('── Phase B queue ACK and payload recovery ──');
function clientContext() {
  var ls = storage();
  var calls = [], responseMode = 'ok';
  var c = {
    window: null, console: console, localStorage: ls,
    getData: function (k) { try { return JSON.parse(ls.getItem(k) || '[]'); } catch (e) { return []; } },
    setData: function (k, v) { ls.setItem(k, JSON.stringify(v)); return true; },
    curRole: function () { return 'admin'; },
    curSession: function () { return { user: 'admin', name: 'Phase 1 Admin' }; },
    ptfToast: function () {}, audit: function () {}, notify: function () {},
    ptfSyncNotifyDirty: function () {}, ptfSyncCanWriteKey: function () { return true; },
    ptfSyncCommandKeyHeld: function () { return false; },
    ptfSyncAcknowledgeKeys: function () {},
    ptfSyncRefreshAuth: function (cb) { cb(false); },
    ptfStorageSafeSetItem: function (k, v) { ls.setItem(k, v); return true; },
    /* v34.8.29 (T3-3): صف آفلاین حالا روی IDB است — استور کوچک برای تست */
    _idb: {},
    ptfStorageIdbSet: function (id, v, cb) { this._idb[id] = v; if (cb) cb(true); },
    ptfStorageIdbGet: function (id, cb) { cb(id === 'bdata:ptf_crm_heavy' ? { value: 'idb-payload' } : (this._idb[id] !== undefined ? { value: this._idb[id] } : null)); },
    document: { hidden: true, getElementById: function () { return null; }, querySelector: function () { return null; }, querySelectorAll: function () { return []; }, createElement: function () { return { style: {} }; }, head: { appendChild: function () {} }, body: { appendChild: function () {} }, addEventListener: function () {} },
    navigator: {}, location: { reload: function () {} },
    setInterval: function () { return 1; }, clearInterval: function () {}, setTimeout: function (fn) { return 1; }, clearTimeout: function () {},
    addEventListener: function () {}, alert: function () {}, confirm: function () { return true; },
    fetch: function (url, options) {
      calls.push({ url: String(url), body: JSON.parse(options.body) });
      var body = calls[calls.length - 1].body;
      var response;
      if (responseMode === 'reject') response = { ok: true, savedKeys: [], rejected: Object.keys(body.data), rev: 7 };
      else response = { ok: true, savedKeys: Object.keys(body.data), rejected: [], skipped: [], forbidden: [], conflicts: [], rev: 7, krevs: {} };
      return Promise.resolve({ status: 200, json: function () { return Promise.resolve(response); } });
    },
    Promise: Promise, Date: Date, JSON: JSON, Math: Math, Object: Object, Array: Array, String: String, Number: Number, RegExp: RegExp, Error: Error, AbortController: undefined, isFinite: isFinite, parseInt: parseInt
  };
  c.window = c;
  vm.createContext(c);
  vm.runInContext(clientServer, c, { filename: 'client-server-phase01.js' });
  c._calls = calls;
  c._setResponseMode = function (mode) { responseMode = mode; };
  return c;
}

(async function () {
  var cc = clientContext();
  cc.localStorage.setItem('ptf_sync_krevs', JSON.stringify({ ptf_crm_settings: 4 }));
  var batchResult = await new Promise(function (resolve) {
    cc.ptfBPushBatch({ ptf_crm_settings: '{"v":1}' }, resolve);
  });
  assert.strictEqual(batchResult.ok, true);
  assert.ok(cc._calls[0].body.base && cc._calls[0].body.base.ptf_crm_settings === 4, 'Phase B did not send base');
  assert.strictEqual(batchResult.savedKeys.join(','), 'ptf_crm_settings');
  /* v34.8.29: صف روی IDB — seed از LS هنوز انجام نشده است (اولین flush همین است) */
  cc.localStorage.setItem('ptf_b_queue', JSON.stringify({ ptf_crm_settings: 1 }));
  cc.localStorage.setItem('ptf_crm_settings', '{"v":1}');
  cc._setResponseMode('reject');
  var rejected = await new Promise(function (resolve) { cc.ptfBFlushQueue(resolve); });
  assert.strictEqual(rejected.ok, false);
  assert.ok(JSON.parse(cc._idb['q:ptf_b_queue'] || '{}').ptf_crm_settings, 'rejected queue entry was cleared (persisted on IDB)');
  cc._setResponseMode('ok');
  var recovered = await new Promise(function (resolve) { cc.ptfBFlushQueue(resolve); });
  assert.strictEqual(recovered.ok, true);
  assert.strictEqual(Object.keys(JSON.parse(cc._idb['q:ptf_b_queue'] || '{}')).length, 0);
  assert.strictEqual(cc.localStorage.getItem('ptf_b_queue'), null, 'queue no longer lives in localStorage');
  console.log('  ✔ Phase B base، ACK صریح و نگه‌داشتن rejected queue');
})().catch(function (error) { console.error(error && error.stack || error); process.exitCode = 1; });


console.log('── Phase B + sync.js single transport ──');
(async function () {
  var ls = storage(), pushCalls = [];
  var c = {
    window: null, console: console, localStorage: ls,
    getData: function (k) { try { return JSON.parse(ls.getItem(k) || '[]'); } catch (e) { return []; } },
    setData: function (k, v) { ls.setItem(k, JSON.stringify(v)); return true; },
    curRole: function () { return 'admin'; }, curSession: function () { return { user: 'admin', name: 'Phase 1 Admin' }; },
    ptfToast: function () {}, audit: function () {}, notify: function () {},
    document: { hidden: true, hasFocus: function () { return true; }, activeElement: null, getElementById: function () { return null; }, querySelector: function () { return null; }, querySelectorAll: function () { return []; }, createElement: function () { return { style: {}, setAttribute: function () {}, appendChild: function () {}, addEventListener: function () {} }; }, head: { appendChild: function () {} }, body: { appendChild: function () {} }, addEventListener: function () {}, documentElement: { style: { setProperty: function () {} } } },
    navigator: {}, location: { reload: function () {} }, setInterval: function () { return 1; }, clearInterval: function () {}, setTimeout: function () { return 1; }, clearTimeout: function () {}, addEventListener: function () {}, alert: function () {}, confirm: function () { return true; },
    fetch: function (url, options) {
      if (String(url).indexOf('data_push') < 0) return Promise.resolve({ status: 200, json: function () { return Promise.resolve({ ok: true, fresh: true, rev: 1, meta: {} }); } });
      var body = JSON.parse(options.body); pushCalls.push(body);
      return Promise.resolve({ status: 200, json: function () { return Promise.resolve({ ok: true, savedKeys: Object.keys(body.data), rejected: [], skipped: [], forbidden: [], conflicts: [], rev: 2, krevs: {} }); } });
    },
    Promise: Promise, Date: Date, JSON: JSON, Math: Math, Object: Object, Array: Array, String: String, Number: Number, RegExp: RegExp, Error: Error, isFinite: isFinite, parseInt: parseInt
  };
  c.window = c;
  ls.setItem('ptf_b_phase', '1');
  ls.setItem('ptf_b_flushed_admin', '1');
  ls.setItem('ptf_b_synced_admin', '1');
  vm.createContext(c);
  vm.runInContext(sync, c, { filename: 'sync-single.js' });
  vm.runInContext(clientServer, c, { filename: 'client-single.js' });
  c.ptfBEnable();
  c.setData('ptf_crm_settings', { phase: 1 });
  await new Promise(function (resolve) {
    c.ptfSyncFlushNow(function (ok) { assert.strictEqual(ok, true); resolve(); });
  });
  assert.strictEqual(pushCalls.length, 1, 'two sync engines sent the same generation');
  assert.ok(pushCalls[0].base && pushCalls[0].by === 'Phase 1 Admin');
  assert.strictEqual(Object.keys(parseLocal(ls, 'ptf_sync_dirty')).length, 0);
  assert.strictEqual(Object.keys(parseLocal(ls, 'ptf_b_queue')).length, 0);
  console.log('  ✔ Phase B و sync.js برای یک تغییر فقط یک transport و ACK مشترک دارند');
})().catch(function (error) { console.error(error && error.stack || error); process.exitCode = 1; });

function parseLocal(ls, key) {
  try { return JSON.parse(ls.getItem(key) || '{}'); } catch (e) { return {}; }
}
