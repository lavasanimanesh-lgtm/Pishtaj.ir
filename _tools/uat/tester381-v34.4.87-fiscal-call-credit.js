/* tester381 — fund claim (callCredit) is cash inject but not double-counted as profit */
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
    parseInt: parseInt, isFinite: isFinite, Number: Number, Intl: Intl,
    localStorage: {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
      setItem: function (k, v) { store[k] = String(v); }
    },
    escP: function (x) { return String(x == null ? '' : x); },
    genCode: function (p) { seq++; return p + '-' + seq; },
    faDate: function () { return '1405/05/21'; },
    faDateTime: function () { return '1405/05/21 10:00'; },
    faYear: function () { return '1405'; },
    audit: function () {}, ptfToast: function () {},
    curRole: function () { return 'admin'; },
    curSession: function () { return { user: 'admin', name: 'ادمین' }; },
    alert: function (m) { ctx._alerts.push(String(m)); },
    confirm: function () { return true; },
    _alerts: [],
    setInterval: function () { return 0; },
    setTimeout: function () { return 0; },
    document: { getElementById: function () { return null; }, body: { insertAdjacentHTML: function () {} } },
    ptfJToISO: function (j) {
      var t = String(j || '').replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); });
      var m = t.match(/(14\d{2})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
      if (!m) return '';
      return m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2);
    }
  };
  ctx.window = ctx;
  ctx.getData = function (k) {
    try { var raw = ctx.localStorage.getItem(k); return raw ? JSON.parse(raw) : []; } catch (e) { return []; }
  };
  ctx.setData = function (k, v) { ctx.localStorage.setItem(k, JSON.stringify(v)); };
  vm.createContext(ctx);
  ['crm/shareholders.js', 'crm/fiscal.js'].forEach(function (rel) {
    vm.runInContext(fs.readFileSync(path.join(root, rel), 'utf8'), ctx, { filename: rel });
  });
  return ctx;
}

var ctx = loadCtx();
ctx.setData('ptf_crm_shareholders', [
  { cd: 'SHR-A', name: 'الف', pct: 40, active: true },
  { cd: 'SHR-B', name: 'ب', pct: 60, active: true }
]);
['ptf_crm_projects', 'ptf_crm_deals', 'ptf_crm_invoices', 'ptf_crm_opex', 'ptf_crm_petty',
  'ptf_crm_cheques', 'ptf_crm_cheques_issued', 'ptf_crm_cheques_received', 'ptf_crm_payables',
  'ptf_crm_fiscal_snapshots'].forEach(function (k) { ctx.setData(k, []); });
ctx.localStorage.setItem('ptf_crm_supplier_finance', JSON.stringify({ invoices: [], payments: [], adjustments: [] }));

ctx.setData('ptf_crm_sharetx', [
  { cd: 'SHT-1', shCd: 'SHR-B', type: 'call_due', amt: 300000000, t: '1405/05/21 10:00' },
  { cd: 'SHT-2', shCd: 'SHR-B', type: 'call_pay', amt: 300000000, t: '1405/05/21 10:00' },
  { cd: 'SHT-3', shCd: 'SHR-B', type: 'call_over', amt: 100000000, t: '1405/05/21 10:00' },
  { cd: 'SHT-4', shCd: 'SHR-B', type: 'call_over', amt: 50000000, t: '1405/05/21 10:00', status: 'void', voided: true },
  { cd: 'SHT-5', shCd: 'SHR-A', type: 'call_pay', amt: 20000000, t: '1405/05/21 10:00', fromCredit: true, noCash: true }
]);

var cash = ctx.window.ptfFiscalCashData('1405');
assert.strictEqual(cash.shareholderInject, 400000000, 'cash inject = pay+over, not void, not fromCredit');

var d = ctx.window.ptfFiscalCashDistribution('1405', 60);
assert.strictEqual(d.fundCreditTotal, 100000000, 'open fund claim = 100m');
assert.strictEqual(d.cashEnd, 400000000, 'cashEnd includes inject');
assert.strictEqual(d.overFloor, 300000000, 'over = cashEnd - floor - fundCredit (not double)');
assert.strictEqual(d.distributable, 180000000, '60% of 300m');

var b = d.shareholders.filter(function (s) { return s.cd === 'SHR-B'; })[0];
assert.strictEqual(b.fundCredit, 100000000, 'B claim column');
assert.strictEqual(b.advYear, 0, 'call_over is not advYear');
assert.strictEqual(b.gross, 108000000, 'B 60% of 180m');
assert.strictEqual(b.settleYear, 108000000, 'settle not reduced by fund claim');

var src = fs.readFileSync(path.join(root, 'crm/fiscal.js'), 'utf8');
assert.ok(src.indexOf('طلب صندوق') > -1 && src.indexOf('fundCredit') > -1, 'ui columns');
console.log('PASS tester381 fiscal-call-credit');
