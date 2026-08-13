'use strict';
/* Regression: supplier ledger invoice/payment attachments survive modal close/reopen. */
var fs = require('fs');
var vm = require('vm');
var assert = require('assert');
var sf = fs.readFileSync('crm/supplier-finance.js', 'utf8');
var storage = fs.readFileSync('crm/storage.js', 'utf8');

/* Active ledger renderer must carry and display persisted files. */
assert.ok(sf.indexOf("files: (i.files || []).slice(), link: { kind: 'invoice'") > -1, 'invoice files must enter final ledger event rows');
assert.ok(sf.indexOf("files: (p.files || []).slice(), link: { kind: 'payment'") > -1, 'payment files must enter final ledger event rows');
assert.ok(sf.indexOf('function slLedgerFilesHtml') > -1 && sf.indexOf('displayRef += slLedgerFilesHtml(e)') > -1, 'final ledger table must render files below document/reference');
assert.ok(sf.indexOf('sl-ledger-files') > -1 && sf.indexOf("openStoredFile(\\'") > -1, 'persistent view links must be rendered');
assert.ok(sf.indexOf("var oldLedger = document.getElementById('slLedgerDlg')") > -1, 'ledger reopen must replace its old modal');

/* Edit upload widgets are initialized only after ptfDialog creates their containers. */
var invEdit = sf.indexOf('window.slInvoiceEdit = function');
var payEdit = sf.indexOf('window.slPaymentEdit = function');
assert.ok(invEdit > -1 && payEdit > invEdit);
assert.ok(sf.indexOf("ptfDialog({", invEdit) < sf.indexOf("attachUploadWidget('slInvEditFilesUp'", invEdit), 'invoice uploader must initialize after dialog render');
assert.ok(sf.indexOf("ptfDialog({", payEdit) < sf.indexOf("attachUploadWidget('slPayEditFilesUp'", payEdit), 'payment uploader must initialize after dialog render');
assert.ok(sf.indexOf("window.slPersistFile('invoice'", invEdit) > -1, 'invoice upload must persist immediately');
assert.ok(sf.indexOf("window.slPersistFile('payment'", payEdit) > -1, 'payment upload must persist immediately');
assert.ok(sf.indexOf("var d = data(), i = fileRecord('invoice'", invEdit) > -1, 'invoice Save must reload fresh data and preserve files');
assert.ok(sf.indexOf("var d=data(), p=fileRecord('payment'", payEdit) > -1, 'payment Save must reload fresh data and preserve files');
assert.ok(storage.indexOf('_ptfUploadRemoveHandlers') > -1 && storage.indexOf("typeof onRemove === 'function'") > -1, 'persist-immediate widget deletion must remove metadata too');
assert.ok(sf.indexOf("_slInvEditCd === cd && document.querySelector('.ptfdlg-b')") > -1 && sf.indexOf("_slPayEditCd === cd && document.querySelector('.ptfdlg-b')") > -1, 'ledger-row delete must not reopen a stale edit dialog');

/* Functional source-of-truth persistence across a simulated close/reopen. */
var start = sf.indexOf('(function () {');
var end = sf.indexOf('  function nrm', start);
assert.ok(start > -1 && end > start);
var code = sf.slice(start, end) + '\n})();';
var initial = {
  schema: 1,
  invoices: [{ cd: 'INV-1', supplierCd: 'SUP-1', files: [] }],
  payments: [{ cd: 'PAY-1', supplierCd: 'SUP-1', files: [] }]
};
var store = { ptf_crm_supplier_finance: JSON.stringify(initial) };
function makeCtx() {
  var ctx = {
    window: null, JSON: JSON, Date: Date,
    localStorage: { getItem: function (k) { return store[k] || null; }, setItem: function (k, v) { store[k] = String(v); } },
    setData: function (k, v) { store[k] = JSON.stringify(v); },
    curSession: function () { return { name: 'حسابدار' }; }
  };
  ctx.window = ctx; vm.createContext(ctx); vm.runInContext(code, ctx, { filename: 'supplier-finance-persist.js' }); return ctx;
}
var ctx1 = makeCtx();
assert.ok(ctx1.slPersistFile('invoice', 'INV-1', { key: 'supplier/invoice.jpg', name: 'invoice.jpg' }).ok);
assert.ok(ctx1.slPersistFile('payment', 'PAY-1', { key: 'supplier/payment.pdf', name: 'payment.pdf' }).ok);
var afterUpload = JSON.parse(store.ptf_crm_supplier_finance);
assert.strictEqual(afterUpload.invoices[0].files.length, 1);
assert.strictEqual(afterUpload.payments[0].files.length, 1);
assert.ok(afterUpload.invoices[0].updatedAtISO && afterUpload.payments[0].updatedAtISO);

/* New JS context = modal/page reopened; metadata must still be in local source of truth. */
var ctx2 = makeCtx();
var reopened = JSON.parse(store.ptf_crm_supplier_finance);
assert.strictEqual(reopened.invoices[0].files[0].key, 'supplier/invoice.jpg');
assert.strictEqual(reopened.payments[0].files[0].key, 'supplier/payment.pdf');
ctx2.slPersistFile('invoice', 'INV-1', { key: 'supplier/invoice.jpg', name: 'invoice.jpg' });
assert.strictEqual(JSON.parse(store.ptf_crm_supplier_finance).invoices[0].files.length, 1, 'same callback must not duplicate metadata');
assert.ok(ctx2.slForgetPersistedFile('invoice', 'INV-1', 'supplier/invoice.jpg').ok);
var removed = JSON.parse(store.ptf_crm_supplier_finance).invoices[0];
assert.strictEqual(removed.files.length, 0);
assert.deepStrictEqual(Array.from(removed._deletedFileKeys), ['supplier/invoice.jpg']);

var version = JSON.parse(fs.readFileSync('VERSION.json', 'utf8')).crm_version;
assert.ok(/^v34\.(?:4\.(?:3[8-9]|[4-9]\d|\d{3,})|[5-9]\.\d+|\d{2,}\.\d+\.\d+)$/.test(version), 'release must retain or advance the v34.4.38 supplier attachment baseline');
var current = version.slice(1);
['crm/index.html','crm/sw.js','crm/manifest.json','crm/clear-cache.html','crm/shell.js'].forEach(function (file) {
  assert.ok(fs.readFileSync(file, 'utf8').indexOf(current) > -1, file + ' version drift');
});
console.log('PASS tester332-v34.4.38: supplier invoice/payment attachment metadata persists immediately and final ledger shows it after reopen');
