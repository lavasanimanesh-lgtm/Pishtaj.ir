'use strict';
/* Regression: a forbidden local audit entry must not recreate the yellow unsaved banner forever. */
var fs = require('fs');
var vm = require('vm');
var assert = require('assert');
var src = fs.readFileSync('crm/sync.js', 'utf8');

assert.ok(src.indexOf('BUG-SYNC-DIRTY-BANNER-001') > -1, 'RCA marker missing');
assert.ok(src.indexOf('dirty: loadPersistedDirty()') > -1, 'persisted dirty state must be normalized before boot/banner');
assert.ok(src.indexOf("k === 'ptf_crm_audit' && !syncAllowedKey(k)") > -1, 'forbidden audit must not become dirty again');
assert.ok(src.indexOf('if (before !== after) window.ptfSyncNotifyDirty(k)') > -1, 'no-op setData writes must not become unsaved changes');
assert.ok(src.indexOf('window.ptfSyncPendingKeys') > -1, 'pending-key diagnostic helper missing');
assert.ok(src.indexOf('window._ptfSyncRecoveryNoticeT = setTimeout') > -1 && src.indexOf('}, 6000)') > -1, 'startup banner must wait for a real recovery attempt');
assert.strictEqual(src.indexOf("تغییر ذخیره‌نشده از جلسه قبل یافت شد"), -1, 'old eager hard-refresh toast must be removed');

var start = src.indexOf('(function () {');
var end = src.indexOf('  function schedulePush()', start);
assert.ok(start > -1 && end > start, 'sync bootstrap boundary missing');
var snippet = src.slice(start, end) + [
  '  function schedulePush() { window.__scheduled = (window.__scheduled || 0) + 1; }',
  '  window.__syncStateForTest = state;',
  '})();'
].join('\n');

function makeContext(role, dirty, initialData) {
  var store = { ptf_sync_dirty: JSON.stringify(dirty || {}), ptf_sync_rev: '0' };
  Object.keys(initialData || {}).forEach(function (k) { store[k] = JSON.stringify(initialData[k]); });
  var writes = [];
  var ctx = {
    window: null, JSON: JSON, Object: Object, Array: Array, Date: Date,
    console: console, Blob: function () {},
    localStorage: {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
      setItem: function (k, v) { store[k] = String(v); },
      removeItem: function (k) { delete store[k]; }
    },
    curRole: function () { return role; },
    curSession: function () { return { user: 'tester', name: 'تستر' }; },
    setData: function (k, value) { writes.push([k, value]); store[k] = JSON.stringify(value); },
    rd: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setTimeout: function () { return 0; }, clearTimeout: function () {},
    fetch: function () { throw new Error('not executed'); }
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(snippet, ctx, { filename: 'sync-dirty-bootstrap.js' });
  return { ctx: ctx, store: store, writes: writes };
}

/* Exact production symptom: sales-like role persisted one audit dirty key. */
var sales = makeContext('sales', {
  ptf_crm_audit: true,
  ptf_crm_customers: true,
  ptf_crm_removed_legacy_key: true,
  ptf_crm_payables: false
});
assert.deepStrictEqual(Array.from(sales.ctx.ptfSyncPendingKeys()), ['ptf_crm_customers'], 'boot must remove false audit/legacy dirt without dropping a valid pending customer change');
assert.deepStrictEqual(JSON.parse(sales.store.ptf_sync_dirty), { ptf_crm_customers: true }, 'clean state must be persisted before the banner reads it');

sales.ctx.ptfSyncNotifyDirty('ptf_crm_audit');
assert.deepStrictEqual(Array.from(sales.ctx.ptfSyncPendingKeys()), ['ptf_crm_customers'], 'sync-internal audit must not recreate the forbidden dirty key');
sales.ctx.setData('ptf_crm_audit', [{ action: 'sync cleanup' }]);
assert.deepStrictEqual(Array.from(sales.ctx.ptfSyncPendingKeys()), ['ptf_crm_customers'], 'wrapped setData(audit) must not restart the false-warning loop');
sales.ctx.ptfSyncNotifyDirty('ptf_crm_customers');
assert.ok(sales.ctx.__scheduled > 0, 'real allowed changes must still schedule a push');

/* Senior role may legitimately sync audit; do not remove valid pending data globally. */
var admin = makeContext('admin', { ptf_crm_audit: true });
assert.deepStrictEqual(Array.from(admin.ctx.ptfSyncPendingKeys()), ['ptf_crm_audit']);
admin.ctx.ptfSyncNotifyDirty('ptf_crm_audit');
assert.ok(admin.ctx.__scheduled > 0, 'admin audit changes must remain syncable');

/* Startup repair writes the same settings object: it must not create dirty at all. */
var noOp = makeContext('admin', {}, { ptf_crm_settings: { dupCodeAck: '' } });
noOp.ctx.setData('ptf_crm_settings', { dupCodeAck: '' });
assert.deepStrictEqual(Array.from(noOp.ctx.ptfSyncPendingKeys()), [], 'identical boot-time settings write must not show an unsaved banner');
assert.ok(!noOp.ctx.__scheduled, 'identical write must not schedule a push');
noOp.ctx.setData('ptf_crm_settings', { dupCodeAck: 'changed' });
assert.deepStrictEqual(Array.from(noOp.ctx.ptfSyncPendingKeys()), ['ptf_crm_settings'], 'real settings change must remain dirty');
assert.ok(noOp.ctx.__scheduled > 0, 'real change must schedule a push');

var version = JSON.parse(fs.readFileSync('VERSION.json', 'utf8')).crm_version;
assert.ok(/^v34\.4\.(?:4[2-9]|[5-9]\d|\d{3,})$/.test(version), 'release must retain or advance the v34.4.42 sync banner baseline');
var current = version.slice(1);
['crm/index.html','crm/sw.js','crm/manifest.json','crm/clear-cache.html','crm/shell.js'].forEach(function (file) {
  assert.ok(fs.readFileSync(file, 'utf8').indexOf(current) > -1, file + ' version drift');
});
console.log('PASS tester336-v34.4.42: stale audit/no-op writes are not dirty and startup waits for a real sync failure before showing the yellow banner');
