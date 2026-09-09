'use strict';
/* v34.38.16 — PULL-RESILIENCE: کلیدِ دارای manifestِ ناقص (مثل commission_records که
   مقدارش شیء/تهی است و سرور count/kind درست نمی‌دهد) نباید کلِ snapshot را fail کند؛
   در فهرست unavailable می‌رود تا نسخهٔ سالم محلی حفظ شود و بقیهٔ کلیدها اعمال شوند.
   integrity-mismatch واقعی همچنان fail-closed می‌ماند. */
var fs = require('fs');
var vm = require('vm');
var assert = require('assert');
var sync = fs.readFileSync('crm/sync.js', 'utf8');
var clientServer = fs.readFileSync('crm/client-server.js', 'utf8');

function test(name, condition) {
  assert.ok(condition, name);
  console.log('PASS ' + name);
}

test('validator marks v2 manifest-missing key unavailable instead of failing the snapshot',
  sync.indexOf('unavailable.push(k)') > -1 && sync.indexOf('integrity-manifest-missing') > -1);
test('legacy pull caller drops unavailable keys from projection (keeps last good local)',
  sync.indexOf('delete d.data[k]') > -1 && sync.indexOf('var pullUnavailable = (pullIntegrity && pullIntegrity.unavailable) || []') > -1);
test('phase B mirror also skips unavailable keys',
  clientServer.indexOf('var _unavailSet = {}') > -1 && clientServer.indexOf('if (_unavailSet[k]) return;') > -1);

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

var goodPayload = '[]';
/* کلید «خوب» entry کامل دارد؛ کلیدِ مشکل (مثل commission_records) در keyList هست ولی
   stats ناقص دارد (count=null) → باید unavailable شود، نه fail کل. */
var partial = { ok: true, rev: 11, contract: 'ptf-sync-v2',
  data: { ptf_crm_leads: goodPayload, ptf_crm_commission_records: '{}' },
  snapshot: { id: 'S-11', rev: 11, complete: true,
    keyList: ['ptf_crm_leads', 'ptf_crm_commission_records'], count: 2,
    checksum: 'a'.repeat(64),
    keys: {
      ptf_crm_leads: { kind: 'array', count: 0, bytes: Buffer.byteLength(goodPayload), sha256: 'b'.repeat(64) },
      ptf_crm_commission_records: { kind: 'NULL', count: null, bytes: 2, sha256: 'c'.repeat(64) }
    }
  } };

var r = ctx.ptfSyncValidatePull(partial);
test('snapshot with one manifest-missing key still passes (ok:true)', r.ok === true);
test('the manifest-missing key is reported in unavailable', Array.isArray(r.unavailable) &&
  r.unavailable.indexOf('ptf_crm_commission_records') > -1 && r.unavailable.length === 1);

/* integrity-mismatch واقعی (expected کامل ولی bytes درست نیست) باید همچنان fail شود. */
var broken = { ok: true, rev: 11, contract: 'ptf-sync-v2', data: { ptf_crm_leads: goodPayload },
  snapshot: { id: 'S-11', rev: 11, complete: true, keyList: ['ptf_crm_leads'], count: 1,
    checksum: 'a'.repeat(64), keys: { ptf_crm_leads: { kind: 'array', count: 0, bytes: Buffer.byteLength(goodPayload) + 1, sha256: 'b'.repeat(64) } } } };
test('true integrity-mismatch is still rejected (fail-closed)', ctx.ptfSyncValidatePull(broken).ok === false);

console.log('PASS tester624-v34.38.16-pull-resilience');
