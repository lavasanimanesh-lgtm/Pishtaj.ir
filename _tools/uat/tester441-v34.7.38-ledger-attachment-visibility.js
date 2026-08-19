'use strict';
/* v34.7.38: ledger attachment visibility — objectKey + getData + fin_attachments merge. */
var fs = require('fs');
var vm = require('vm');
var assert = require('assert');

var storage = fs.readFileSync('crm/storage.js', 'utf8');
var sf = fs.readFileSync('crm/supplier-finance.js', 'utf8');
var cf = fs.readFileSync('crm/customer-finance.js', 'utf8');

assert.ok(storage.indexOf('window.ptfFileStorageKey') > -1, 'shared key helper');
assert.ok(storage.indexOf('window.ptfNormalizeFileRec') > -1, 'normalize helper');
assert.ok(sf.indexOf('getData(KEY)') > -1, 'supplier finance reads durable getData');
assert.ok(sf.indexOf('ptfNormalizeFileRec') > -1, 'supplier persist accepts objectKey');
assert.ok(sf.indexOf('ptfFileStorageKey') > -1, 'supplier ledger renders objectKey');
assert.ok(cf.indexOf('function cfMergeOwnerFiles') > -1, 'customer ledger merges fin attachments');
assert.ok(cf.indexOf("ownerType === type") > -1 || cf.indexOf("a.ownerType") > -1, 'merge reads ownerType');
assert.ok(cf.indexOf('ptfNormalizeFileRec') > -1, 'customer persist normalizes key');

var helperStart = storage.indexOf('window.ptfFileStorageKey');
var helperEnd = storage.indexOf('function openStoredFile', helperStart);
assert.ok(helperStart > -1 && helperEnd > helperStart);
var helperCode = storage.slice(helperStart, helperEnd);
var ctx = { window: {}, console: console };
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(helperCode, ctx);
assert.strictEqual(ctx.ptfFileStorageKey({ objectKey: 'fin/a.pdf', name: 'a.pdf' }), 'fin/a.pdf');
assert.strictEqual(ctx.ptfFileStorageKey({ fileKey: 'x/y.jpg' }), 'x/y.jpg');
assert.strictEqual(ctx.ptfNormalizeFileRec({ objectKey: 'fin/a.pdf', name: 'فاکتور.pdf' }).key, 'fin/a.pdf');

var start = sf.indexOf('(function () {');
var end = sf.indexOf('  function nrm', start);
var code = sf.slice(start, end) + '\n})();';
var store = {
  ptf_crm_supplier_finance: JSON.stringify({
    schema: 1,
    invoices: [{ cd: 'INV-1', supplierCd: 'SUP-1', files: [] }],
    payments: [{ cd: 'PAY-1', supplierCd: 'SUP-1', files: [] }]
  })
};
var sctx = {
  window: null, JSON: JSON, Date: Date,
  localStorage: { getItem: function (k) { return store[k] || null; }, setItem: function (k, v) { store[k] = String(v); } },
  getData: function (k) { try { return JSON.parse(store[k] || 'null'); } catch (e) { return null; } },
  setData: function (k, v) { store[k] = JSON.stringify(v); },
  curSession: function () { return { name: 'حسابدار' }; },
  ptfFileStorageKey: ctx.ptfFileStorageKey,
  ptfNormalizeFileRec: ctx.ptfNormalizeFileRec
};
sctx.window = sctx;
vm.createContext(sctx);
vm.runInContext(code, sctx);
var r = sctx.slPersistFile('invoice', 'INV-1', { objectKey: 'supplier/inv.jpg', name: 'inv.jpg' });
assert.ok(r.ok, 'persist objectKey');
var saved = JSON.parse(store.ptf_crm_supplier_finance);
assert.strictEqual(saved.invoices[0].files[0].key, 'supplier/inv.jpg');

assert.ok(cf.indexOf("cfMergeOwnerFiles(i.files, 'invoice'") > -1);
assert.ok(cf.indexOf("cfMergeOwnerFiles(p.files, 'receipt'") > -1);

var version = JSON.parse(fs.readFileSync('VERSION.json', 'utf8')).crm_version;
assert.strictEqual(version, 'v34.7.38');
var current = version.slice(1);
['crm/index.html', 'crm/sw.js', 'crm/manifest.json', 'crm/clear-cache.html', 'crm/shell.js'].forEach(function (file) {
  assert.ok(fs.readFileSync(file, 'utf8').indexOf(current) > -1, file + ' version drift');
});
console.log('PASS tester441-v34.7.38: ledger attachments visible via objectKey/getData/fin_attachments');
