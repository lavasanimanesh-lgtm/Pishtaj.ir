#!/usr/bin/env node
'use strict';
/* v34.7.14 — duplicate-case command projection must replace Phase-B cache immediately. */
var fs = require('fs'), vm = require('vm'), assert = require('assert');
var syncSrc = fs.readFileSync('crm/sync.js', 'utf8');
var bSrc = fs.readFileSync('crm/client-server.js', 'utf8');
var salesSrc = fs.readFileSync('crm/sales-domain-v2.js', 'utf8');
var apiSrc = fs.readFileSync('api/sales-domain.php', 'utf8');

function storage(seed) {
  var data = Object.assign({}, seed || {});
  return {
    _data: data,
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
    setItem: function (k, v) { data[k] = String(v); },
    removeItem: function (k) { delete data[k]; },
    key: function (i) { return Object.keys(data)[i] || null; },
    get length() { return Object.keys(data).length; }
  };
}

/* Runtime regression: exact production load order (sync -> client-server), Phase B on. */
(function phaseBCacheProjection() {
  var ls = storage({ ptf_crm_token: 'token', ptf_sync_rev: '10', ptf_sync_krevs: JSON.stringify({ ptf_crm_deals: 10 }) });
  var ctx = {
    window: null, console: console, JSON: JSON, Math: Math, Date: Date, Promise: Promise,
    Array: Array, Object: Object, String: String,
    localStorage: ls, indexedDB: null,
    getData: function (k) { try { return JSON.parse(ls.getItem(k) || '[]'); } catch (e) { return []; } },
    setData: function (k, v) { ls.setItem(k, JSON.stringify(v)); return true; },
    curSession: function () { return { user: 'admin', name: 'مدیر' }; },
    curRole: function () { return 'admin'; },
    document: {
      hidden: true, activeElement: null,
      hasFocus: function () { return true; },
      getElementById: function () { return null; },
      querySelector: function () { return null; },
      addEventListener: function () {}
    },
    navigator: {}, location: { reload: function () {} },
    setInterval: function () { return 0; }, clearInterval: function () {},
    setTimeout: function () { return 0; }, clearTimeout: function () {},
    addEventListener: function () {},
    fetch: function () { return new Promise(function () {}); },
    confirm: function () { return false; }, alert: function () {},
    ptfStorageSafeSetItem: function (k, v) { ls.setItem(k, v); return true; }
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(syncSrc, ctx, { filename: 'sync.js' });
  vm.runInContext(bSrc, ctx, { filename: 'client-server.js' });
  ctx.ptfBEnable();

  ctx.setData('ptf_crm_offers', [{ _id: 'OFFER-1', no: 'CO-X', st: 'won', inqNo: 'INQ-X', buyerCd: 'C-X', currency: 'IRR' }]);
  ctx.setData('ptf_crm_deals', [
    { _id: 'CASE-KEEP', cd: 'D-KEEP', rootOfferId: 'OFFER-1', wonOffer: 'CO-X', inqNo: 'INQ-X', buyerCd: 'C-X', currency: 'IRR' },
    { _id: 'CASE-DROP', cd: 'D-DROP', rootOfferId: 'OFFER-1', wonOffer: 'CO-X', inqNo: 'INQ-X', buyerCd: 'C-X', currency: 'IRR' }
  ]);
  vm.runInContext(salesSrc, ctx, { filename: 'sales-domain-v2.js' });
  var queueBefore = ls.getItem('ptf_b_queue');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(ctx.getData('ptf_crm_deals').map(function (x) { return x.cd; }))), ['D-KEEP', 'D-DROP']);
  assert.strictEqual(ctx.ptfSalesIntegrityScan().filter(function (x) { return x.type === 'duplicate_case'; }).length, 1, 'fixture must start with duplicate-case finding');

  var applied = ctx.ptfSyncApplyServerProjection('ptf_crm_deals', [{ _id: 'CASE-KEEP', cd: 'D-KEEP', rootOfferId: 'OFFER-1', wonOffer: 'CO-X', inqNo: 'INQ-X', buyerCd: 'C-X', currency: 'IRR' }], 41);
  assert.strictEqual(applied, true, 'authoritative projection should apply');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(ctx.getData('ptf_crm_deals').map(function (x) { return x.cd; }))), ['D-KEEP'], 'Phase-B getData cache must expose merged list immediately');
  assert.strictEqual(ctx.ptfSalesIntegrityScan().filter(function (x) { return x.type === 'duplicate_case'; }).length, 0, 'duplicate-case finding must disappear immediately without refresh');
  assert.strictEqual(ls.getItem('ptf_b_queue'), queueBefore, 'server projection must not enqueue a second client write');
  assert.strictEqual(JSON.parse(ls.getItem('ptf_sync_krevs')).ptf_crm_deals, 41, 'exact command rev must become per-key watermark');
  assert.strictEqual(ls.getItem('ptf_sync_rev'), '10', 'per-key apply must not advance global rev before the whole projection succeeds');
  ctx.ptfSyncAcceptServerRevision(41);
  assert.strictEqual(ls.getItem('ptf_sync_rev'), '41', 'aggregate projection ACK must advance global watermark');

  var stale = ctx.ptfSyncApplyServerProjection('ptf_crm_deals', [{ _id: 'CASE-KEEP', cd: 'D-KEEP' }, { _id: 'CASE-DROP', cd: 'D-DROP' }], 40);
  assert.strictEqual(stale, false, 'late older projection must be rejected');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(ctx.getData('ptf_crm_deals').map(function (x) { return x.cd; }))), ['D-KEEP'], 'older projection must not resurrect duplicate');
  console.log('PASS Phase-B projection cache + exact rev + stale-response guard');
})();

/* Runtime: API promise must not resolve/render before the final pull callback. */
(async function commandWaitsForPull() {
  var pendingPull = null, passedRev = 0, acceptedRev = 0, resolved = false;
  var response = { ok: true, rev: 77, result: { keptCaseId: 'CASE-KEEP' }, data: { ptf_crm_deals: [{ _id: 'CASE-KEEP', cd: 'D-KEEP' }] } };
  var ctx = {
    window: null, console: console, JSON: JSON, Math: Math, Date: Date, Promise: Promise,
    localStorage: storage({ ptf_crm_token: 'token' }),
    getData: function () { return []; }, setData: function () {}, curRole: function () { return 'admin'; },
    setInterval: function () { return 0; }, clearInterval: function () {},
    document: { getElementById: function () { return null; }, querySelectorAll: function () { return []; } },
    ptfSyncApplyServerProjection: function (k, v, rev) { passedRev = rev; return true; },
    ptfSyncAcceptServerRevision: function (rev) { acceptedRev = rev; },
    ptfSyncPullNow: function (cb) { pendingPull = cb; },
    fetch: function () { return Promise.resolve({ ok: true, status: 200, text: function () { return Promise.resolve(JSON.stringify(response)); } }); }
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(salesSrc, ctx, { filename: 'sales-domain-v2.js' });
  var request = ctx.ptfSalesDomainApi('duplicate_case_merge', { idempotencyKey: 'TEST-MERGE' }).then(function () { resolved = true; });
  await new Promise(function (r) { setImmediate(r); });
  assert.strictEqual(passedRev, 77, 'sales API must pass exact response rev into projection apply');
  assert.strictEqual(acceptedRev, 77, 'global rev must be accepted after all projection keys apply');
  assert.strictEqual(typeof pendingPull, 'function', 'post-command pull must be requested');
  assert.strictEqual(resolved, false, 'command promise/render path must wait for final pull callback');
  pendingPull({ ok: true, rev: 77 });
  await request;
  assert.strictEqual(resolved, true, 'command promise must resolve after final pull');

  /* Partial persistence failure: never advance global rev before recovery pull. */
  response = { ok: true, rev: 78, result: {}, data: { ptf_crm_deals: [{ cd: 'D-KEEP' }], ptf_crm_projects: [] } };
  acceptedRev = 0; pendingPull = null;
  ctx.ptfSyncApplyServerProjection = function (k) { return k !== 'ptf_crm_projects'; };
  var partial = ctx.ptfSalesDomainApi('duplicate_case_merge', { idempotencyKey: 'TEST-PARTIAL' });
  await new Promise(function (r) { setImmediate(r); });
  assert.strictEqual(acceptedRev, 0, 'partial projection failure must not advance global rev');
  assert.strictEqual(typeof pendingPull, 'function', 'partial projection must still request recovery pull');
  pendingPull({ ok: true, rev: 78 });
  await partial;

  assert.ok(apiSrc.indexOf("'rev'=>sd_current_rev()") > -1, 'idempotent retry response must include a revision');
  console.log('PASS command waits for pull, partial apply is recoverable, idempotent retry carries rev');
})().catch(function (e) {
  console.error(e && e.stack || e);
  process.exitCode = 1;
});
