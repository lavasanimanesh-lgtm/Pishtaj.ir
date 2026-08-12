/* tester380 — void/edit capital-call cash pay restores share, claim, and cash */
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
    audit: function () {}, ptfToast: function () {},
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
    try { var raw = ctx.localStorage.getItem(k); return raw ? JSON.parse(raw) : []; } catch (e) { return []; }
  };
  ctx.setData = function (k, v) { ctx.localStorage.setItem(k, JSON.stringify(v)); };
  vm.createContext(ctx);
  ['crm/shareholders.js', 'crm/treasury.js', 'crm/treasury-call.js'].forEach(function (rel) {
    vm.runInContext(fs.readFileSync(path.join(root, rel), 'utf8'), ctx, { filename: rel });
  });
  return ctx;
}

var ctx = loadCtx();
ctx.setData('ptf_crm_shareholders', [
  { cd: 'SHR-A', name: 'الف', pct: 40, active: true },
  { cd: 'SHR-B', name: 'ب', pct: 60, active: true }
]);
ctx.setData('ptf_crm_fiscal_snapshots', [{ cd: 'FOB-1', type: 'opening_balance_v281', fiscalYear: '1405', category: 'cash_bank', amountIrr: 1000000000, status: 'posted' }]);
ctx.setData('ptf_crm_opex', [{ cd: 'OPX-1', amt: 1500000000, cat: 'خرید', month: '1405/05' }]);
['ptf_crm_invoices', 'ptf_crm_offers', 'ptf_crm_petty_tx', 'ptf_crm_cheques', 'ptf_crm_cheques_issued', 'ptf_crm_cheques_received', 'ptf_crm_sharetx', 'ptf_crm_treasury_calls', 'ptf_crm_finance'].forEach(function (k) { ctx.setData(k, []); });
ctx.setData('ptf_crm_supplier_finance', { payments: [] });

ctx.window.ptfTreasuryCallCreate();
var call = ctx.getData('ptf_crm_treasury_calls')[0];
ctx._nextAmt = 400000000;
ctx.window.ptfTreasuryCallPay(call.cd, 'SHR-B');
assert.strictEqual(ctx.window.ptfTreasuryDerivedCash().inflow, 400000000, 'cash in after pay');
assert.strictEqual(ctx.window.ptfShareholderBalance('SHR-B').callCredit, 100000000, 'overpay claim');
assert.strictEqual(ctx.window.ptfShareholderBalance('SHR-B').callRemain, 0, 'share cleared');

var payCd = ctx.getData('ptf_crm_treasury_calls')[0].pays.filter(function (p) { return p.shCd === 'SHR-B' && p.status !== 'void'; })[0].cd;
assert.ok(ctx.window.ptfTreasuryCallVoidPay(call.cd, payCd, true), 'void pay');
assert.strictEqual(ctx.window.ptfTreasuryDerivedCash().inflow, 0, 'cash restored');
assert.strictEqual(ctx.window.ptfShareholderBalance('SHR-B').callCredit, 0, 'claim gone');
assert.strictEqual(ctx.window.ptfShareholderBalance('SHR-B').callRemain, 300000000, 'share back');

ctx._nextAmt = 300000000;
ctx.window.ptfTreasuryCallPay(call.cd, 'SHR-B');
assert.strictEqual(ctx.window.ptfShareholderBalance('SHR-B').callRemain, 0, 'exact pay clears');
assert.strictEqual(ctx.window.ptfShareholderBalance('SHR-B').callCredit, 0, 'no claim on exact');

payCd = ctx.getData('ptf_crm_treasury_calls')[0].pays.filter(function (p) { return p.shCd === 'SHR-B' && p.status !== 'void'; })[0].cd;
ctx._nextAmt = 400000000;
ctx.window.ptfTreasuryCallEditPay(call.cd, payCd);
assert.strictEqual(ctx.window.ptfTreasuryDerivedCash().inflow, 400000000, 'edit to 400 is cash');
assert.strictEqual(ctx.window.ptfShareholderBalance('SHR-B').callCredit, 100000000, 'edit leftover is claim');
assert.strictEqual(ctx.window.ptfShareholderBalance('SHR-B').callRemain, 0, 'still cleared');

var src = fs.readFileSync(path.join(root, 'crm/treasury-call.js'), 'utf8');
assert.ok(src.indexOf('ptfTreasuryCallVoidPay') > -1 && src.indexOf('ptfTreasuryCallEditPay') > -1, 'ui fns');
console.log('PASS tester380 call-pay-edit');
