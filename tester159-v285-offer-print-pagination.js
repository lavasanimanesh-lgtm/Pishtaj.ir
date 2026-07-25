/* Emergency print-pagination fixture — does not open browser windows or print. */
'use strict';
var fs = require('fs'), vm = require('vm'), assert = require('assert');
var captured = '';
var context = {
  console: console, JSON: JSON, Math: Math, Date: Date, Array: Array, Object: Object, String: String,
  localStorage: { getItem: function () { return null; }, setItem: function () {}, removeItem: function () {} },
  getData: function () { return []; }, setData: function () {}, curSession: function () { return { user: 'chair', name: 'Chair' }; },
  escP: function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); },
  ptfOfferUnitEn: function (v) { return v || 'PCS'; }, ptfPhoneNorm: function (v) { return v; },
  document: { getElementById: function () { return null; }, querySelectorAll: function () { return []; }, addEventListener: function () {}, createElement: function () { return { style: {}, appendChild: function () {}, setAttribute: function () {} }; }, body: { appendChild: function () {} } },
  setTimeout: function () { return 1; }, clearTimeout: function () {}, setInterval: function () { return 1; }, clearInterval: function () {},
  confirm: function () { return true; }, alert: function () {}, audit: function () {}, notify: function () {}
};
context.window = context; context.window.addEventListener = function () {};
vm.createContext(context);
vm.runInContext(fs.readFileSync('crm/offers.js', 'utf8'), context, { filename: 'offers.js' });
vm.runInContext(fs.readFileSync('crm/offers-pro.js', 'utf8'), context, { filename: 'offers-pro.js' });
context.ptfPreviewPrintableDoc = function (title, html) { captured = html; };
var items = [];
for (var i = 1; i <= 13; i++) items.push({ name: 'Valve ' + i, desc: 'Technical description ' + i, model: 'M-' + i, qty: 1, unit: 'PCS', brand: 'PTF', price: 1000 });
context.offerPrintTpl({ no: 'CO-DEMO-1', kind: 'CO', currency: 'IRR', dateEn: '2026-07-14', inqNo: 'RFQ-DEMO', buyerCo: 'Demo Client', buyerContact: 'Demo', buyerTel: '000', sellerContact: 'PTF', items: items, terms: ['Delivery as agreed.'] }, 'letterhead', true);
assert.ok(captured.indexOf('@page{size:A4 landscape;margin:13mm 14mm 24mm 14mm}') > -1, 'Letterhead must reserve top/bottom page margins on every page.');
assert.ok(captured.indexOf('Page 1 of 3') > -1, 'First item page number must be rendered.');
assert.ok(captured.indexOf('Page 2 of 3') > -1, 'Second item page number must be rendered.');
assert.ok(captured.indexOf('Page 3 of 3') > -1, 'Final terms/address page number must be rendered.');
assert.strictEqual((captured.match(/doc-item-page/g) || []).length, 2, '13 CO rows must produce two explicit item pages at 12 rows per page.');
assert.strictEqual((captured.match(/class="doc-page doc-tail-page"/g) || []).length, 1, 'Multi-page proposal must create a final tail page.');
assert.strictEqual((captured.match(/class="doc-last-address"/g) || []).length, 1, 'Address marker must occur only on final page.');
assert.ok((captured.match(/<thead>/g) || []).length >= 2, 'Each explicit item page must retain its own table header.');
['executive', 'mono', 'minimal', 'classic'].forEach(function (tpl) {
  captured = '';
  context.offerPrintTpl({ no: 'CO-DEMO-1', kind: 'CO', currency: 'IRR', dateEn: '2026-07-14', inqNo: 'RFQ-DEMO', buyerCo: 'Demo Client', buyerContact: 'Demo', buyerTel: '000', sellerContact: 'PTF', items: items, terms: ['Delivery as agreed.'] }, tpl, true);
  assert.ok(captured.indexOf('Page 1 of 3') > -1 && captured.indexOf('Page 3 of 3') > -1, tpl + ' must number all generated pages.');
  assert.strictEqual((captured.match(/class="doc-last-address"/g) || []).length, 1, tpl + ' must mark address only on final page.');
});
console.log('PASS tester159-v285-offer-print-pagination: 16 pagination/header/footer checks');
