/* tester383 — chairman holds company cash vs personal claim */
'use strict';
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var assert = require('assert');
var root = path.resolve(__dirname, '../..');

function loadCtx() {
  var store = {};
  var seq = 0;
  var kpi = { innerHTML: '' };
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
    document: {
      getElementById: function (id) {
        if (id === 'treasuryKpi') return kpi;
        if (id === 'treasuryBox') return { style: {} };
        if (id === 'treasuryMoves' || id === 'treasuryFocus') return { innerHTML: '' };
        return null;
      },
      body: { insertAdjacentHTML: function () {} }
    },
    ptfDialog: function (opt) { if (opt && typeof opt.onOk === 'function') opt.onOk({ amt: ctx._nextAmt, note: '' }); }
  };
  ctx.window = ctx;
  ctx._kpi = kpi;
  ctx.getData = function (k) {
    try { var raw = ctx.localStorage.getItem(k); return raw ? JSON.parse(raw) : []; } catch (e) { return []; }
  };
  ctx.setData = function (k, v) { ctx.localStorage.setItem(k, JSON.stringify(v)); };
  vm.createContext(ctx);
  ['crm/shareholders.js', 'crm/treasury.js'].forEach(function (rel) {
    vm.runInContext(fs.readFileSync(path.join(root, rel), 'utf8'), ctx, { filename: rel });
  });
  return ctx;
}

var ctx = loadCtx();
ctx.setData('ptf_crm_shareholders', [
  { cd: 'SHR-A', name: 'الف', pct: 40, active: true },
  { cd: 'SHR-B', name: 'ب رییس', pct: 60, active: true }
]);
ctx.setData('ptf_crm_users', [{ username: 'ch', name: 'ب رییس', roleId: 'chairman' }]);
['ptf_crm_sharetx', 'ptf_crm_invoices', 'ptf_crm_offers', 'ptf_crm_opex', 'ptf_crm_petty_tx',
  'ptf_crm_cheques', 'ptf_crm_cheques_issued', 'ptf_crm_cheques_received', 'ptf_crm_finance',
  'ptf_crm_fiscal_snapshots', 'ptf_crm_treasury_calls'].forEach(function (k) { ctx.setData(k, []); });
ctx.setData('ptf_crm_supplier_finance', { payments: [] });

var sh = ctx.window.ptfTreasuryCustodianSh();
assert.ok(sh && sh.cd === 'SHR-B', 'chairman matched by user name');

var before = ctx.window.ptfTreasuryDerivedCash().derived;
ctx._nextAmt = 200000000;
ctx.window.ptfTreasuryChairIn();
assert.strictEqual(ctx.window.ptfTreasuryDerivedCash().inflow, 200000000, 'inject is cash in');
assert.strictEqual(ctx.window.ptfShareholderBalance('SHR-B').callCredit, 200000000, 'inject is claim');
var pos = ctx.window.ptfTreasuryChairPosition();
assert.strictEqual(pos.claim, 200000000, 'position claim');
assert.strictEqual(pos.companyCash, before + 200000000, 'company cash up');

ctx._nextAmt = 50000000;
ctx.window.ptfTreasuryChairOut();
assert.strictEqual(ctx.window.ptfShareholderBalance('SHR-B').callCredit, 150000000, 'claim after settle');
assert.strictEqual(ctx.window.ptfTreasuryDerivedCash().outflow, 50000000, 'settle is cash out');

ctx.window.ptfTreasuryRender();
assert.ok(ctx._kpi.innerHTML.indexOf('نقد شرکت نزد رییس') > -1, 'ui cash label');
assert.ok(ctx._kpi.innerHTML.indexOf('طلب رییس از شرکت') > -1, 'ui claim label');

console.log('PASS tester383 chair-cash');
