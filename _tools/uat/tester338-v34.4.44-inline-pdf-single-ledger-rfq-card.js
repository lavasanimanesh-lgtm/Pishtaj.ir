'use strict';
/* Regression: inline PDF CSP, single supplier-ledger attachment flow, compact RFQ cards. */
var fs = require('fs');
var vm = require('vm');
var assert = require('assert');

var htaccess = fs.readFileSync('.htaccess', 'utf8');
var storage = fs.readFileSync('crm/storage.js', 'utf8');
var supplier = fs.readFileSync('crm/supplier-finance.js', 'utf8');
var rfq = fs.readFileSync('crm/rfqsmart.js', 'utf8');

/* A fetched authenticated PDF is rendered from a Blob URL. CSP must explicitly allow
   that URL inside the in-page frame/object; default-src 'self' does not cover blob:. */
assert.ok(/frame-src\s+'self'\s+blob:/.test(htaccess), 'CSP must allow Blob PDF inside the document-viewer iframe');
assert.ok(storage.indexOf("kind === 'pdf'") > -1 && storage.indexOf('<iframe src="') > -1, 'PDF must use the internal document viewer');
assert.ok(storage.indexOf('URL.createObjectURL(blob)') > -1, 'authenticated PDF must become a local Blob URL');

/* A delayed attachment pull must never act on a newer modal that happens to reuse id. */
var refreshStart = storage.indexOf('window.ptfAttachRefreshOnOpen = function');
var refreshEnd = storage.indexOf('\n};', refreshStart) + 3;
assert.ok(refreshStart > -1 && refreshEnd > refreshStart, 'attachment refresh helper missing');
var activeDlg = null, pendingPull = null, signature = [], reopened = 0;
var refreshCtx = {
  window: null,
  JSON: JSON,
  Array: Array,
  document: { getElementById: function () { return activeDlg; } },
  ptfSyncPullNow: function (cb) { pendingPull = cb; }
};
refreshCtx.window = refreshCtx;
vm.createContext(refreshCtx);
vm.runInContext(storage.slice(refreshStart, refreshEnd), refreshCtx, { filename: 'attachment-refresh.js' });
var oldDlg = { isConnected: true, removes: 0, remove: function () { this.removes++; this.isConnected = false; } };
activeDlg = oldDlg;
refreshCtx.ptfAttachRefreshOnOpen('slLedgerDlg', function () { return signature; }, function () { reopened++; });
assert.strictEqual(typeof pendingPull, 'function');
var replacementDlg = { isConnected: true, removes: 0, remove: function () { this.removes++; this.isConnected = false; } };
activeDlg = replacementDlg;
oldDlg.isConnected = false;
signature = ['new-file.pdf'];
pendingPull({ ok: true });
assert.strictEqual(replacementDlg.removes, 0, 'stale pull must not remove a replacement ledger');
assert.strictEqual(reopened, 0, 'stale pull must not reopen another ledger');

/* With the same modal still active, a real remote signature change refreshes once. */
signature = [];
activeDlg = replacementDlg;
refreshCtx.ptfAttachRefreshOnOpen('slLedgerDlg', function () { return signature; }, function () { reopened++; });
signature = ['remote-file.pdf'];
pendingPull({ ok: true });
assert.strictEqual(replacementDlg.removes, 1, 'current modal should refresh on a real remote change');
assert.strictEqual(reopened, 1, 'current modal should reopen exactly once');

/* Execute the attachment-modal flow: opening removes every ledger, upload persists without
   rebuilding one underneath, and closing returns to exactly one refreshed ledger. */
var flowStart = supplier.indexOf('  function slRemoveAllDialogs');
var flowEnd = supplier.indexOf('  window.slInvoiceAddFile=', flowStart);
var flowTailEnd = supplier.indexOf('\n', flowEnd);
assert.ok(flowStart > -1 && flowEnd > flowStart, 'single-modal supplier attachment flow missing');
var dialogs = { slLedgerDlg: [], slAttachDlg: [] };
function dialog(id) {
  return { id: id, removed: false, remove: function () {
    this.removed = true;
    dialogs[id] = dialogs[id].filter(function (x) { return x !== this; }, this);
  } };
}
var uploadDone = null, removeDone = null, ledgerOpens = 0, persisted = 0;
dialogs.slLedgerDlg.push(dialog('slLedgerDlg'), dialog('slLedgerDlg'));
var flowCtx = {
  window: null, Array: Array, String: String,
  data: function () { return { invoices: [{ cd: 'INV-1', supplierCd: 'SUP-1' }], payments: [] }; },
  ptfOnClickArg: function (v) { return v; },
  document: {
    querySelectorAll: function (selector) { return (dialogs[selector.slice(1)] || []).slice(); },
    getElementById: function (id) {
      if (id === 'panels') return { insertAdjacentHTML: function () { dialogs.slAttachDlg.push(dialog('slAttachDlg')); } };
      return (dialogs[id] || [])[0] || null;
    }
  },
  attachUploadWidget: function (id, folder, onUpload, onRemove) { uploadDone = onUpload; removeDone = onRemove; },
  slPersistFile: function () { persisted++; return { ok: true, record: { supplierCd: 'SUP-1' } }; },
  slForgetPersistedFile: function () { return { ok: true }; },
  slOpenLedger: function () { ledgerOpens++; dialogs.slLedgerDlg.push(dialog('slLedgerDlg')); },
  audit: function () {}
};
flowCtx.window = flowCtx;
vm.createContext(flowCtx);
vm.runInContext('(function(){\n' + supplier.slice(flowStart, flowTailEnd) + '\n})();', flowCtx, { filename: 'supplier-attachment-flow.js' });
flowCtx.slInvoiceAddFile('INV-1');
assert.strictEqual(dialogs.slLedgerDlg.length, 0, 'opening the paperclip flow must clear all underlying ledgers');
assert.strictEqual(dialogs.slAttachDlg.length, 1, 'paperclip flow must create one attachment modal');
uploadDone({ key: 'supplier/invoice.pdf', name: 'invoice.pdf' });
assert.strictEqual(persisted, 1, 'upload must persist attachment metadata immediately');
assert.strictEqual(ledgerOpens, 0, 'upload callback must not create a ledger below the still-open attachment modal');
assert.strictEqual(dialogs.slAttachDlg.length, 1);
flowCtx.slAttachClose('SUP-1');
assert.strictEqual(dialogs.slAttachDlg.length, 0, 'attachment modal must close cleanly');
assert.strictEqual(ledgerOpens, 1, 'closing attachment flow must reopen ledger once');
assert.strictEqual(dialogs.slLedgerDlg.length, 1, 'only one supplier ledger may remain');
assert.strictEqual(typeof removeDone, 'function');

/* Item fields remain searchable but are no longer previewed in request cards. */
assert.ok(rfq.indexOf('it.name || it.nm') > -1 && rfq.indexOf('it.spec || it.st || it.desc') > -1 && rfq.indexOf('it.model || it.md') > -1 && rfq.indexOf('it.brand || it.br') > -1, 'item name/spec/model/brand must remain in the search index');
var renderStart = rfq.indexOf('window.renderRfqSmart = function');
var renderEnd = rfq.indexOf('window.rfqsSetListSearch', renderStart);
var renderBlock = rfq.slice(renderStart, renderEnd);
assert.strictEqual(renderBlock.indexOf('itemPreview'), -1, 'RFQ cards must not build an item-name preview');
assert.strictEqual(renderBlock.indexOf('📦'), -1, 'RFQ card title must not display item names');
assert.ok(renderBlock.indexOf('var sourceMeta =') > -1, 'request-source metadata must remain on the card');
assert.ok(renderBlock.indexOf('شماره درخواست کارفرما:') > -1 && renderBlock.indexOf('| کارفرما:') > -1, 'customer request number and customer name must remain visible');

var version = JSON.parse(fs.readFileSync('VERSION.json', 'utf8')).crm_version;
assert.ok(/^v34\.(?:4\.(?:4[4-9]|[5-9]\d|\d{3,})|[5-9]\.\d+|\d{2,}\.\d+\.\d+)$/.test(version), 'release must retain or advance the v34.4.44 attachment-view baseline');
var current = version.slice(1);
['crm/index.html','crm/sw.js','crm/manifest.json','crm/clear-cache.html','crm/shell.js'].forEach(function (file) {
  assert.ok(fs.readFileSync(file, 'utf8').indexOf(current) > -1, file + ' version drift');
});
console.log('PASS tester338-v34.4.44: Blob PDF is CSP-visible in-page, supplier attachments keep one ledger, RFQ cards stay compact while item search remains');
