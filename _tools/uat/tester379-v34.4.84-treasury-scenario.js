/* tester379 — opening → deficit → call → skip/overpay → next call offsets credit */
'use strict';
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var assert = require('assert');
var root = path.resolve(__dirname, '../..');

function loadCtx() {
  var store = {};
  var seq = 0;
  var ctx = {
    console: console, JSON: JSON, Math: Math, Array: Array, Object: Object, String: String, Date: Date,
    parseInt: parseInt, isFinite: isFinite, Number: Number,
    localStorage: {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
      setItem: function (k, v) { store[k] = String(v); }
    },
    escP: function (x) { return String(x == null ? '' : x); },
    genCode: function (p) { seq++; return p + '-' + seq; },
    faDate: function () { return '1405/05/21'; },
    faDateTime: function () { return '1405/05/21 10:00'; },
    audit: function () {},
    ptfToast: function () {},
    curRole: function () { return 'admin'; },
    curSession: function () { return { user: 'admin', name: 'ادمین' }; },
    alert: function (m) { ctx._alerts.push(String(m)); },
    confirm: function () { return true; },
    _alerts: [],
    setInterval: function () { return 0; },
    setTimeout: function () { return 0; },
    document: { getElementById: function () { return null; }, body: { insertAdjacentHTML: function () {} } },
    ptfDialog: function (opt) { if (opt && typeof opt.onOk === 'function') opt.onOk({ note: '', amt: ctx._nextAmt, files: [] }); }
  };
  ctx.window = ctx;
  ctx.getData = function (k) {
    try {
      var raw = ctx.localStorage.getItem(k);
      if (raw == null || raw === '') return [];
      return JSON.parse(raw);
    } catch (e) { return []; }
  };
  ctx.setData = function (k, v) { ctx.localStorage.setItem(k, JSON.stringify(v)); };
  vm.createContext(ctx);
  ['crm/shareholders.js', 'crm/treasury.js', 'crm/treasury-call.js'].forEach(function (rel) {
    vm.runInContext(fs.readFileSync(path.join(root, rel), 'utf8'), ctx, { filename: rel });
  });
  return ctx;
}

var BIL = 1000000000;
var ctx = loadCtx();

ctx.setData('ptf_crm_shareholders', [
  { cd: 'SHR-A', name: 'سهامدار الف', pct: 40, active: true },
  { cd: 'SHR-B', name: 'سهامدار ب', pct: 60, active: true }
]);
ctx.setData('ptf_crm_fiscal_snapshots', [{
  cd: 'FOB-1', type: 'opening_balance_v281', fiscalYear: '1405',
  category: 'cash_bank', amountIrr: BIL, status: 'posted'
}]);
ctx.setData('ptf_crm_opex', [{ cd: 'OPX-1', amt: 1500000000, cat: 'خرید', month: '1405/05', desc: 'خروج بزرگ' }]);
ctx.setData('ptf_crm_invoices', []);
ctx.setData('ptf_crm_offers', []);
ctx.setData('ptf_crm_supplier_finance', { payments: [] });
ctx.setData('ptf_crm_petty_tx', []);
ctx.setData('ptf_crm_cheques', []);
ctx.setData('ptf_crm_cheques_issued', []);
ctx.setData('ptf_crm_cheques_received', []);
ctx.setData('ptf_crm_sharetx', []);
ctx.setData('ptf_crm_treasury_calls', []);
ctx.setData('ptf_crm_finance', []);

var cash0 = ctx.window.ptfTreasuryDerivedCash();
assert.strictEqual(cash0.opening, BIL, 'opening 1e9');
assert.strictEqual(cash0.outflow, 1500000000, 'opex out');
assert.strictEqual(cash0.derived, -500000000, 'cash -500m');

ctx.window.ptfTreasuryCallCreate();
var calls = ctx.getData('ptf_crm_treasury_calls');
assert.strictEqual(calls.length, 1, 'one call');
var call1 = calls[0];
var dueA = call1.shares.filter(function (s) { return s.shCd === 'SHR-A'; })[0].due;
var dueB = call1.shares.filter(function (s) { return s.shCd === 'SHR-B'; })[0].due;
assert.strictEqual(dueA + dueB, 500000000, 'frozen shares sum to gap');
assert.strictEqual(dueA, 200000000, 'A 40%');
assert.strictEqual(dueB, 300000000, 'B 60%');

assert.strictEqual(ctx.window.ptfShareholderBalance('SHR-A').callRemain, 200000000, 'A owes 200m');
assert.strictEqual(ctx.window.ptfShareholderBalance('SHR-B').callRemain, 300000000, 'B owes 300m');

ctx._nextAmt = 400000000;
ctx.window.ptfTreasuryCallPay(call1.cd, 'SHR-B');

var cash1 = ctx.window.ptfTreasuryDerivedCash();
assert.strictEqual(cash1.inflow, 400000000, 'only real cash in');
assert.strictEqual(cash1.derived, -100000000, 'after B pay: -100m');
assert.strictEqual(ctx.window.ptfShareholderBalance('SHR-A').callRemain, 200000000, 'A still owes first-call share');
assert.strictEqual(ctx.window.ptfShareholderBalance('SHR-B').callRemain, 0, 'B first share cleared');
assert.strictEqual(ctx.window.ptfShareholderBalance('SHR-B').callCredit, 100000000, 'B claim 100m');

var opex = ctx.getData('ptf_crm_opex');
opex.push({ cd: 'OPX-2', amt: 200000000, cat: 'اجاره', month: '1405/05' });
ctx.setData('ptf_crm_opex', opex);
assert.strictEqual(ctx.window.ptfTreasuryDerivedCash().derived, -300000000, 'second hole -300m');

ctx.window.ptfTreasuryCallCreate();
var call2 = ctx.getData('ptf_crm_treasury_calls')[0];
assert.strictEqual(call2.gap, 300000000, 'second gap is current hole');
assert.strictEqual(call2.shares.filter(function (s) { return s.shCd === 'SHR-A'; })[0].due, 120000000, 'A 40% of 300m');
assert.strictEqual(call2.shares.filter(function (s) { return s.shCd === 'SHR-B'; })[0].due, 180000000, 'B 60% of 300m');

var balB3 = ctx.window.ptfShareholderBalance('SHR-B');
assert.strictEqual(balB3.callCredit, 0, 'B credit consumed');
assert.strictEqual(balB3.callRemain, 80000000, 'B leftover of call2 after 100m credit');

var cash2 = ctx.window.ptfTreasuryDerivedCash();
assert.strictEqual(cash2.inflow, 400000000, 'credit offset did not add cash');
assert.strictEqual(cash2.derived, -300000000, 'cash unchanged by tahaator');
assert.strictEqual(ctx.window.ptfShareholderBalance('SHR-A').callRemain, 320000000, 'A unpaid both calls');

console.log('PASS tester379 treasury scenario (skip/overpay/offset)');
