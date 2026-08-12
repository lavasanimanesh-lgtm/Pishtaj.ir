/* tester384 — rent cheque linked to monthly opex is not double-counted */
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
    roleDef: function () { return { finance: true }; },
    alert: function () {}, confirm: function () { return true; },
    setInterval: function () { return 0; },
    clearInterval: function () {},
    document: { getElementById: function () { return null; }, body: { insertAdjacentHTML: function () {} } },
    ptfJToISO: function (j) {
      var t = String(j || '');
      var m = t.match(/(14\d{2})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
      if (!m) return '';
      return m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2);
    },
    ptfTodayISO: function () { return '1405-07-01'; }
  };
  ctx.window = ctx;
  ctx.getData = function (k) {
    try { var raw = ctx.localStorage.getItem(k); return raw ? JSON.parse(raw) : []; } catch (e) { return []; }
  };
  ctx.setData = function (k, v) { ctx.localStorage.setItem(k, JSON.stringify(v)); };
  vm.createContext(ctx);
  ['crm/opex.js', 'crm/treasury.js', 'crm/fiscal.js'].forEach(function (rel) {
    vm.runInContext(fs.readFileSync(path.join(root, rel), 'utf8'), ctx, { filename: rel });
  });
  return ctx;
}

var ctx = loadCtx();
['ptf_crm_projects', 'ptf_crm_deals', 'ptf_crm_invoices', 'ptf_crm_petty', 'ptf_crm_sharetx',
  'ptf_crm_shareholders', 'ptf_crm_cheques', 'ptf_crm_cheques_received', 'ptf_crm_payables',
  'ptf_crm_fiscal_snapshots', 'ptf_crm_offers', 'ptf_crm_petty_tx', 'ptf_crm_finance'].forEach(function (k) { ctx.setData(k, []); });
ctx.localStorage.setItem('ptf_crm_supplier_finance', JSON.stringify({ invoices: [], payments: [], adjustments: [] }));

ctx.setData('ptf_crm_opex', [
  { cd: 'OPX-1', _opexRowId: 'R1', cat: 'اجاره‌بها', amt: 320000000, month: '1405/04', t: '1405/04/01' },
  { cd: 'OPX-2', _opexRowId: 'R2', cat: 'اجاره‌بها', amt: 320000000, month: '1405/05', t: '1405/05/01' }
]);
ctx.setData('ptf_crm_cheques_issued', [{
  cd: 'CHQ-RENT', amt: 640000000, kind: 'finance', ownership: 'company', st: 'open',
  dueISO: '1405-06-15', issueISO: '1405-04-10', opexRowIds: ['R1', 'R2']
}]);
assert.ok(ctx.window.ptfOpexLinkCheque('CHQ-RENT', ['R1', 'R2']).ok, 'link');
assert.strictEqual(ctx.getData('ptf_crm_opex')[0].chequeCd, 'CHQ-RENT');

var cash = ctx.window.ptfTreasuryDerivedCash();
assert.strictEqual(cash.outflow, 640000000, 'treasury: only matured cheque, not 32+32+64');

var fis = ctx.window.ptfFiscalCashData('1405');
assert.strictEqual(fis.outflows.opex, 640000000, 'fiscal expense = two months rent');
assert.strictEqual(fis.outflows.independentCheques, 0, 'linked cheque not extra expense');

var un = ctx.window.ptfOpexUnlinkCheque('CHQ-RENT');
assert.strictEqual(un, 2, 'unlink');

console.log('PASS tester384 opex-cheque');
