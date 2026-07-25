/* Runtime fixture UAT tester — Sprint 282 / BUG-TO-SAVE-282
   Reproduces the reported path: editing an existing technical proposal whose
   legacy status is won/lost, then pressing Save. */
'use strict';
require('./_tools/uat/harness');
var fs = require('fs'), vm = require('vm'), assert = require('assert');

/* offers.js has no required startup DOM; supply only the controls read by offerSave. */
var controls = {
  ofBuyer: { value: 'C-1' }, ofInq: { value: 'RFQ-1' },
  ofDateJ: { value: '1405/04/23' }, ofSeller: { value: '' },
  ofPrintAs: { value: '' }, ofUseSig: { checked: false }, ofSignAs: { value: '' }
};
global.document.getElementById = function (id) { return controls[id] || null; };
global.hideModal = function () {};
global.renderOffers = function () {};
global.addLog = function () {};
global.ptfToast = function () {};
global.ptfJToISO = function () { return '2026-07-14'; };
global.curSession = function () { return { user: 'admin', name: 'Admin' }; };
global.confirm = function () { return true; };
var alerts = [];
global.alert = function (m) { alerts.push(String(m)); };

/* Execute the actual production file, rather than a copy of offerSave. */
vm.runInThisContext(fs.readFileSync('crm/offers.js', 'utf8'), { filename: 'crm/offers.js' });

assert.strictEqual(typeof global.toStMigrate, 'function', 'Canonical TO status migration helper must be globally callable.');
assert.strictEqual(global.toStMigrate({ kind: 'TO', st: 'won' }), 'approved', 'Legacy won TO must normalize to approved.');
assert.strictEqual(global.toStMigrate({ kind: 'TO', st: 'lost' }), 'rejected', 'Legacy lost TO must normalize to rejected.');

var previous = { no: 'PTF-TO-1405-OLD', kind: 'TO', st: 'won', rev: 0, buyerCd: 'C-1', inqNo: 'RFQ-1', items: [{ name: 'Old valve', qty: 1, unit: 'NO' }] };
var editing = { no: 'PTF-TO-1405-OLD', kind: 'TO', st: 'registered', rev: 0, buyerCd: 'C-1', inqNo: 'RFQ-1', items: [{ name: 'Updated valve', qty: 2, unit: 'NO' }], terms: [], extraCols: [] };
setData('ptf_crm_offers', [previous]);
setData('ptf_crm_customers', [{ cd: 'C-1', co: 'Customer One', coEn: 'Customer One' }]);
setData('ptf_crm_rfqs', []);
setData('ptf_crm_products', []);
setData('ptf_crm_deals', []);
global.ptfSetOffState(editing);
global.offerSave();

var saved = getData('ptf_crm_offers')[0];
assert.strictEqual(alerts.length, 0, 'Save must not raise the reported error alert.');
assert.strictEqual(saved.items[0].name, 'Updated valve', 'The edited TO must be persisted.');
assert.strictEqual(saved.rev, 1, 'Editing a legacy won TO must create revision 1 after normalized status detection.');
assert.strictEqual(saved.st, 'registered', 'The user-selected current TO status must be preserved.');
console.log('PASS tester155-v282-to-save-scope: 7 runtime checks');
