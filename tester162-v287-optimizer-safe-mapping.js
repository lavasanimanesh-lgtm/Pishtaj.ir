/* Runtime optimizer mapping test: reversed procurement rows must never attach by position. */
'use strict';
var fs = require('fs'), vm = require('vm'), assert = require('assert');
var db = {
  ptf_crm_offers: [{ no: 'CO-1', kind: 'CO', inqNo: 'INQ-1', currency: 'IRR', items: [
    { pcode: 'P-A', name: 'Valve A', desc: 'Class 150', model: 'MA', unit: 'PCS', qty: 1, price: 1000 },
    { pcode: 'P-B', name: 'Valve B', desc: 'Class 300', model: 'MB', unit: 'PCS', qty: 1, price: 2000 }
  ] }],
  ptf_crm_buycmp: [{ id: 'CMP-1', inqNo: 'INQ-1', sourceOfferNo: 'CO-1', items: [
    { pcode: 'P-B', nm: 'Valve B', spec: 'Class 300', model: 'MB', un: 'PCS' },
    { pcode: 'P-A', nm: 'Valve A', spec: 'Class 150', model: 'MA', un: 'PCS', sourceItemKey: 'P:P-A' }
  ], purchases: [{ idx: 1, sourcePcode: 'P-A', sourceItemKey: 'P:P-A', price: 100, sup: 'Supplier A' }] }],
  ptf_crm_rfqsmart: [{ no: 'RFQS-1', srcRfq: 'INQ-1', quoteCur: 'IRR', items: [
    { pcode: 'P-B', name: 'Valve B', spec: 'Class 300', model: 'MB', unit: 'PCS', bestBuyPrice: 14000 },
    { pcode: 'P-A', name: 'Valve A', spec: 'Class 150', model: 'MA', unit: 'PCS', bestBuyPrice: 35000 }
  ] }]
};
var html = '';
var context = {
  console: console, JSON: JSON, Math: Math, Array: Array, Object: Object, String: String,
  getData: function (k) { return db[k] || []; }, setData: function () {},
  localStorage: { getItem: function () { return null; }, setItem: function () {}, removeItem: function () {} },
  escP: function (v) { return String(v == null ? '' : v); }, dedupNorm: function (v) { return String(v || '').replace(/[\s\-_.،,؛;()\/\\]/g, '').toLowerCase(); },
  ptfMoney: function (v) { return String(+v || 0); }, ptfOfferUnitEn: function (v) { return v || 'PCS'; }, ptfAdvanceLabel: function () { return 'ندارد'; },
  curSession: function () { return { user: 'chair', name: 'Chair' }; }, faDate: function () { return '1405/04/23'; }, faDateTime: function () { return '1405/04/23 10:00'; }, genCode: function (x) { return x + '-1'; },
  document: { getElementById: function () { return null; }, querySelectorAll: function () { return []; }, addEventListener: function () {}, body: { insertAdjacentHTML: function (pos, s) { html = s; } }, createElement: function () { return { style: {}, appendChild: function () {}, setAttribute: function () {} }; } },
  setTimeout: function () { return 1; }, clearTimeout: function () {}, setInterval: function () { return 1; }, clearInterval: function () {}, alert: function () {}, confirm: function () { return true; }, audit: function () {}, notify: function () {}
};
context.window = context; context.window.addEventListener = function () {};
vm.createContext(context);
vm.runInContext(fs.readFileSync('crm/procurement-link.js', 'utf8'), context, { filename: 'procurement-link.js' });
vm.runInContext(fs.readFileSync('crm/offers.js', 'utf8'), context, { filename: 'offers.js' });
context.offOpenProfitOptimizer('CO-1');
assert.ok(html.indexOf('Supplier A') > -1, 'Valve A must use actual purchase at reversed CMP row index 1.');
assert.ok(html.indexOf('استعلامی: 14000') > -1, 'Valve B must use its own RFQ reference at reversed RFQ row index 0.');
assert.ok(html.indexOf('35000') === -1, 'Valve A RFQ reference must not be incorrectly displayed when actual purchase exists.');
assert.ok(html.indexOf('تطبیق قطعی') > -1 || html.indexOf('تطبیق: pcode') > -1, 'Optimizer must disclose identity-based mapping.');
assert.strictEqual(html.indexOf('تطبیق مبهم'), -1, 'Unique coded fixture must not be marked ambiguous.');
console.log('PASS tester162-v287-optimizer-safe-mapping: 5 reversed-order mapping checks');
