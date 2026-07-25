/* Emergency rollback verification — restore pre-v28.5 print behavior only. */
'use strict';
var fs = require('fs'), vm = require('vm'), assert = require('assert');
var captured = '';
var context = {
  console: console, JSON: JSON, Math: Math, Date: Date, Array: Array, Object: Object, String: String,
  localStorage: { getItem: function () { return null; }, setItem: function () {}, removeItem: function () {} },
  getData: function () { return []; }, setData: function () {}, curSession: function () { return { user: 'chair', name: 'Chair' }; },
  escP: function (v) { return String(v == null ? '' : v); }, ptfOfferUnitEn: function (v) { return v || 'PCS'; }, ptfPhoneNorm: function (v) { return v; },
  document: { getElementById: function () { return null; }, querySelectorAll: function () { return []; }, addEventListener: function () {}, createElement: function () { return { style: {}, appendChild: function () {}, setAttribute: function () {} }; }, body: { appendChild: function () {} } },
  setTimeout: function () { return 1; }, clearTimeout: function () {}, setInterval: function () { return 1; }, clearInterval: function () {}, confirm: function () { return true; }, alert: function () {}, audit: function () {}, notify: function () {}
};
context.window = context; context.window.addEventListener = function () {};
vm.createContext(context);
vm.runInContext(fs.readFileSync('crm/offers.js', 'utf8'), context, { filename: 'offers.js' });
vm.runInContext(fs.readFileSync('crm/offers-pro.js', 'utf8'), context, { filename: 'offers-pro.js' });
context.ptfPreviewPrintableDoc = function (title, html) { captured = html; };
var items = [];
for (var i = 1; i <= 13; i++) items.push({ name: 'Valve ' + i, desc: 'Description ' + i, model: 'M-' + i, qty: 1, unit: 'PCS', brand: 'PTF', price: 1000 });
context.offerPrintTpl({ no: 'CO-ROLLBACK-1', kind: 'CO', currency: 'IRR', dateEn: '2026-07-14', inqNo: 'RFQ-DEMO', buyerCo: 'Demo Client', buyerContact: 'Demo', buyerTel: '000', sellerContact: 'PTF', items: items, terms: ['Delivery as agreed.'] }, 'letterhead', true);
assert.ok(captured.indexOf('@page{size:A4 landscape;margin:0}') > -1, 'Rollback restores the pre-v28.5 letterhead page model.');
assert.ok(captured.indexOf('padding:13mm 14mm 26mm') > -1, 'Rollback restores the pre-v28.5 letterhead body spacing.');
assert.strictEqual(captured.indexOf('docPagedHtml'), -1, 'Rollback must remove the explicit pagination renderer.');
assert.strictEqual(captured.indexOf('doc-page-footer'), -1, 'Rollback must remove generated page footer blocks.');
assert.ok(captured.indexOf('Page 1 of 2') > -1, 'Rollback restores the former approximate page label.');
assert.ok(captured.indexOf('<td>13</td>') > -1, 'All item rows remain in one source table, preserving sequential row numbers.');
assert.strictEqual((captured.match(/<thead>/g) || []).length, 1, 'Rollback restores one source table; browser handles page breaks as before.');
console.log('PASS tester160-v286-offer-print-rollback: 7 rollback checks');
