'use strict';
/* v34.38.15 — snapshot integrity, resumable full pull, atomic staging and query route regression. */
var fs = require('fs');
var vm = require('vm');
var assert = require('assert');
var api = fs.readFileSync('api/crm.php', 'utf8');
var sync = fs.readFileSync('crm/sync.js', 'utf8');
var clientServer = fs.readFileSync('crm/client-server.js', 'utf8');
var index = fs.readFileSync('crm/index.html', 'utf8');
var sw = fs.readFileSync('crm/sw.js', 'utf8');
var manifest = JSON.parse(fs.readFileSync('crm/manifest.json', 'utf8'));
var version = JSON.parse(fs.readFileSync('VERSION.json', 'utf8')).crm_version;

function test(name, condition) {
  assert.ok(condition, name);
  console.log('PASS ' + name);
}

/* Server contract is deliberately checked as source too: this test does not need a
   production database and therefore remains useful in the repository UAT runner. */
test('data_pull publishes contract, complete snapshot, key list, count, bytes and checksum',
  api.indexOf("'contract' => 'ptf-sync-v2'") > -1 &&
  api.indexOf("'complete' => true") > -1 &&
  api.indexOf("'snapshotId' => 'S-' . (int)$globalRev") > -1 &&
  api.indexOf("'keyList' => array_keys($integrity)") > -1 &&
  api.indexOf("'checksum' => sync_snapshot_checksum($out)") > -1 &&
  api.indexOf("'sha256' => hash('sha256', $raw)") > -1 && api.indexOf("'canonicalSha256'") > -1);
test('resumable manifest/chunk endpoints pin every chunk to a revision',
  api.indexOf("case 'data_manifest':") > -1 && api.indexOf("case 'data_chunk':") > -1 &&
  api.indexOf("'error'=>'snapshot_changed'") > -1 && api.indexOf("'nextOffset'") > -1);
test('collection_query does not treat action as a record filter',
  api.indexOf("$cq_reserved = ['action','collection'") > -1);
test('client uses atomic snapshot pull with bounded workers and retry',
  sync.indexOf('window.ptfSyncPullAtomic') > -1 && sync.indexOf('Math.min(4, keys.length)') > -1 &&
  sync.indexOf('maxAttempts = 4') > -1 /* v34.38.15: تلاش بیشتر با backoff برای drift اسنپ‌شات */ && sync.indexOf('250 * Math.pow(2, retryNo)') > -1);
test('phase B validates the whole response before per-key projection',
  clientServer.indexOf('window.ptfSyncValidatePull') > -1 && clientServer.indexOf("reason: 'integrity'") > -1);

var store = { ptf_crm_token: 'tok', ptf_sync_rev: '10' };
var ctx = {
  console: console, JSON: JSON, Date: Date, Math: Math, Array: Array, Object: Object,
  Promise: Promise, TextEncoder: TextEncoder, localStorage: {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem: function (k, v) { store[k] = String(v); }, removeItem: function (k) { delete store[k]; }
  },
  document: { hidden: false, hasFocus: function () { return true; }, addEventListener: function () {},
    querySelector: function () { return null; }, querySelectorAll: function () { return []; }, getElementById: function () { return null; } },
  navigator: { onLine: true }, location: { href: 'index.html' }, setTimeout: function () { return 1; },
  clearTimeout: function () {}, setInterval: function () { return 1; }, clearInterval: function () {},
  curSession: function () { return { user: 'u1' }; }, curRole: function () { return 'admin'; },
  ptfAuthToken: function () { return 'tok'; }, ptfToast: function () {}, audit: function () {},
  addLog: function () {}, fetch: function () { throw new Error('not used'); }
};
ctx.window = ctx;
vm.runInNewContext(sync, ctx, { filename: 'crm/sync.js' });
var payload = '[{"id":"A"}]';
var good = { ok: true, rev: 11, contract: 'ptf-sync-v2', data: { ptf_crm_leads: payload }, snapshot: {
  id: 'S-11', rev: 11, complete: true, keyList: ['ptf_crm_leads'], count: 1,
  checksum: 'a'.repeat(64), keys: { ptf_crm_leads: { kind: 'array', count: 1, bytes: Buffer.byteLength(payload), sha256: 'b'.repeat(64) } }
} };
test('valid v2 response passes shape/count/byte validation', ctx.ptfSyncValidatePull(good).ok === true);
good.snapshot.keys.ptf_crm_leads.bytes++;
test('truncated or mismatched payload is rejected before write', ctx.ptfSyncValidatePull(good).ok === false);

test('release cache contract is aligned', version === 'v34.38.15' && index.indexOf("window.PTF_CRM_RELEASE = 'v34.38.15'") > -1 &&
  sw.indexOf("var RELEASE = 'v34.38.15'") > -1 && manifest.version === '34.38.15');
console.log('PASS tester617-v34.38.10-snapshot-integrity');
