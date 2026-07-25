/* Procurement line identity fixture — protects CO profit matrix from positional mapping. */
'use strict';
var fs = require('fs'), vm = require('vm'), assert = require('assert');
var db = {};
var context = {
  console: console, JSON: JSON, Math: Math, Array: Array, Object: Object, String: String,
  getData: function (k) { return db[k] || []; }, setData: function (k, v) { db[k] = v; },
  escP: function (v) { return String(v == null ? '' : v); }, dedupNorm: function (v) { return String(v || '').replace(/[\s\-_.،,؛;()\/\\]/g, '').toLowerCase(); },
  document: { getElementById: function () { return null; }, body: { insertAdjacentHTML: function () {} } },
  localStorage: { getItem: function () { return null; }, setItem: function () {} }
};
context.window = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync('crm/procurement-link.js', 'utf8'), context, { filename: 'procurement-link.js' });

var offerA = { pcode: 'P-A', name: 'Valve A', desc: 'Class 150', model: 'MA', unit: 'PCS' };
var offerB = { pcode: 'P-B', name: 'Valve B', desc: 'Class 300', model: 'MB', unit: 'PCS' };
var reversedSource = [
  { pcode: 'P-B', nm: 'Valve B', spec: 'Class 300', model: 'MB', un: 'PCS' },
  { pcode: 'P-A', nm: 'Valve A', spec: 'Class 150', model: 'MA', un: 'PCS' }
];
var rA = context.ptfResolveProcurementLine(offerA, reversedSource);
var rB = context.ptfResolveProcurementLine(offerB, reversedSource);
assert.strictEqual(rA.ok, true, 'Code-matched offer line A must resolve.');
assert.strictEqual(rA.index, 1, 'Line A must resolve to its reversed source row, not CO array index 0.');
assert.strictEqual(rB.ok, true, 'Code-matched offer line B must resolve.');
assert.strictEqual(rB.index, 0, 'Line B must resolve to its reversed source row, not CO array index 1.');
var ambiguous = context.ptfResolveProcurementLine({ name: 'Pipe', unit: 'M' }, [{ nm: 'Pipe', un: 'M' }, { nm: 'Pipe', un: 'M' }]);
assert.strictEqual(ambiguous.ok, false, 'Duplicate identity must be marked ambiguous.');
assert.strictEqual(ambiguous.reason, 'ambiguous', 'Ambiguous line must not silently pick first index.');
var across = context.ptfResolveProcurementAcross(offerA, [{ id: 'CMP-old', items: reversedSource }, { id: 'CMP-current', sourceOfferNo: 'CO-1', items: reversedSource }], { offerNo: 'CO-1' });
assert.strictEqual(across.ok, true, 'Source-offer provenance must disambiguate matching records.');
assert.strictEqual(across.record.id, 'CMP-current', 'Provenance record must win over stale duplicate record.');

db.ptf_crm_buycmp = [{ id: 'CMP-1', inqNo: 'INQ-1', sourceOfferNo: 'CO-1', items: reversedSource, purchases: [{ idx: 1, price: 1000, sup: 'Supplier A' }] }];
db.ptf_crm_rfqsmart = [{ no: 'RFQS-1', srcRfq: 'INQ-1', items: reversedSource }];
var audit = context.ptfProcurementLinkAuditData({ no: 'CO-1', inqNo: 'INQ-1', items: [offerA, offerB] });
assert.strictEqual(audit[0].cmp.ok, true, 'Audit must safely map first CO line.');
assert.strictEqual(audit[0].cmp.line.index, 1, 'Audit must preserve reversed identity mapping.');

var offers = fs.readFileSync('crm/offers.js', 'utf8');
var buy = fs.readFileSync('crm/buycompare.js', 'utf8');
assert.ok(offers.indexOf('ptfResolveProcurementAcross(it, cmps') > -1, 'Optimizer must call identity resolver for real purchases.');
assert.ok(offers.indexOf('ptfResolveProcurementAcross(it, rfqs') > -1, 'Optimizer must call identity resolver for RFQ fallback.');
assert.ok(offers.indexOf('خرید/استعلامی نمایش داده نشد') > -1, 'Unmatched mappings must be visibly withheld.');
assert.ok(buy.indexOf('sourceItemKey') > -1 && buy.indexOf('sourcePcode') > -1, 'New purchases must preserve source-line provenance.');
var optimizer = offers.slice(offers.indexOf('window.offOpenProfitOptimizer'), offers.indexOf('\nfunction offerSetSt', offers.indexOf('window.offOpenProfitOptimizer')));
assert.strictEqual(/rfq\.items\s*\[\s*i\s*\]/.test(optimizer), false, 'Optimizer must not use CO row index for RFQ fallback.');
assert.strictEqual(/p\.idx\s*===\s*i/.test(optimizer), false, 'Optimizer must not use CO row index for purchase matching.');
var rfq = fs.readFileSync('crm/rfqsmart.js', 'utf8');
var lock = fs.readFileSync('crm/offerlock.js', 'utf8');
assert.ok(rfq.indexOf('referenceAmbiguousCount') > -1, 'Reference-price commit must record ambiguous product mappings without changing them.');
assert.ok(lock.indexOf('مرجع خرید مبهم است؛ انتخاب خودکار نشد') > -1, 'CO price UI must visibly withhold an ambiguous product reference.');
console.log('PASS tester161-v287-procurement-line-integrity: 18 identity/no-index checks');
