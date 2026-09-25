/* tester677 — v34.39.32 (RENT-CASH-UNTIL-PAID)
   تکرارشونده و اجارهٔ متصل به چک تا پرداخت نهایی خروج نقدی نیست.
   تعهدی (total) صفر نمی‌شود. هزینهٔ یک‌بارهٔ بدون چک و چک مستقل دست نمی‌خورند.
   حقوق تا draw خروج نیست. گیت سررسید فقط ptfTodayISO است و دو تقویم با هم مقایسه نمی‌شوند. */
'use strict';
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var assert = require('assert');
var root = path.resolve(__dirname, '../..');

function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
var opexSrc = read('crm/opex.js');
var fiscalSrc = read('crm/fiscal.js');
var treasurySrc = read('crm/treasury.js');

assert.ok(/opex: d\.opexCashTotal/.test(fiscalSrc), 'fiscal cash still uses opexCashTotal');
assert.ok(/function isShareholderSalaryOpex/.test(opexSrc), 'salary classifier remains');
assert.ok(/window\.ptfChequeDueReached/.test(opexSrc), 'due gate is shared');
assert.ok(/ptfTodayISO/.test(opexSrc) && /ptfChequeDueReached[\s\S]{0,700}ptfTodayISO/.test(opexSrc), 'due gate clock is ptfTodayISO');
assert.ok(/opexHeldForCheque/.test(treasurySrc), 'treasury does not also count a cheque-covered opex row');
assert.ok(/window\.ptfChequeDueReached/.test(treasurySrc), 'treasury uses the same due gate');

function load(today) {
  var store = {};
  var ctx = {
    console: console, JSON: JSON, Math: Math, Date: Date, Object: Object, Array: Array, String: String, Number: Number,
    parseInt: parseInt, isFinite: isFinite, Intl: Intl,
    localStorage: {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
      setItem: function (k, v) { store[k] = String(v); }
    },
    escP: function (x) { return String(x == null ? '' : x); },
    genCode: function (p) { return p + '-1'; },
    faDate: function () { return '1405/06/31'; },
    faDateTime: function () { return '1405/06/31 10:00'; },
    faYear: function () { return '1405'; },
    curRole: function () { return 'admin'; },
    curSession: function () { return { name: 'مالی آزمون' }; },
    roleDef: function () { return { finance: true }; },
    isSenior: function () { return true; },
    audit: function () {}, alert: function () {}, confirm: function () { return true; },
    setInterval: function () { return 0; }, clearInterval: function () {},
    document: { getElementById: function () { return null; }, querySelectorAll: function () { return []; }, body: { insertAdjacentHTML: function () {} } },
    ptfTodayISO: function () { return today; },
    ptfJToISO: function (j) {
      var t = String(j || '');
      var m = t.match(/(14\d{2})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
      if (!m) return '';
      var key = m[1] + '/' + ('0' + m[2]).slice(-2) + '/' + ('0' + m[3]).slice(-2);
      var map = {
        '1405/01/01': '2026-03-21',
        '1406/01/01': '2027-03-21',
        '1405/04/01': '2026-06-22',
        '1405/06/15': '2026-09-06',
        '1405/11/15': '2027-02-03'
      };
      return map[key] || '2026-08-23';
    },
    ptfISOToJ: function () { return '1405/06/31'; },
    ptfFaMonthNow: function () { return '1405/06'; },
    ptfNum: function (v) { return +v || 0; }
  };
  ctx.window = ctx;
  ctx.getData = function (k) {
    try {
      var raw = ctx.localStorage.getItem(k);
      if (!raw) return k === 'ptf_crm_supplier_finance' ? { invoices: [], payments: [], adjustments: [] } : [];
      return JSON.parse(raw);
    } catch (e) { return []; }
  };
  ctx.setData = function (k, v) { ctx.localStorage.setItem(k, JSON.stringify(v)); return true; };
  vm.createContext(ctx);
  ['crm/opex.js', 'crm/treasury.js', 'crm/fiscal.js'].forEach(function (rel) {
    vm.runInContext(read(rel), ctx, { filename: rel });
  });
  ['ptf_crm_projects', 'ptf_crm_deals', 'ptf_crm_invoices', 'ptf_crm_petty', 'ptf_crm_sharetx',
    'ptf_crm_shareholders', 'ptf_crm_cheques', 'ptf_crm_cheques_received', 'ptf_crm_payables',
    'ptf_crm_fiscal_snapshots', 'ptf_crm_offers', 'ptf_crm_petty_tx', 'ptf_crm_finance',
    'ptf_crm_cheques_issued', 'ptf_crm_opex'].forEach(function (k) { ctx.setData(k, []); });
  ctx.localStorage.setItem('ptf_crm_supplier_finance', JSON.stringify({ invoices: [], payments: [], adjustments: [] }));
  return ctx;
}

function cashOf(ctx) {
  var treasury = ctx.ptfTreasuryDerivedCash();
  var fiscal = ctx.ptfFiscalCashData('1405');
  var sum = ctx.ptfOpexSumFiscal('1405');
  return {
    treasury: treasury.outflow,
    fiscalOpex: fiscal.outflows.opex,
    independent: fiscal.outflows.independentCheques,
    accrual: sum.total,
    cash: sum.totalCash
  };
}

var future = load('2026-09-22');
future.setData('ptf_crm_opex', [
  { cd: 'OPX-1', _opexRowId: 'R1', cat: 'اجاره‌بها', amt: 320000000, month: '1405/04', t: '1405/04/01', status: 'active' },
  { cd: 'OPX-2', _opexRowId: 'R2', cat: 'اجاره‌بها', amt: 320000000, month: '1405/05', t: '1405/05/01', status: 'active' }
]);
future.setData('ptf_crm_cheques_issued', [{
  cd: 'CHQ-RENT', amt: 640000000, kind: 'finance', ownership: 'company', st: 'open',
  dueISO: '1405-11-15', issueISO: '2026-08-01', opexRowIds: ['R1', 'R2']
}]);
var beforeLink = cashOf(future);
assert.strictEqual(beforeLink.treasury, 0, 'uncashed cheque must not exit with the one-time rows');
assert.strictEqual(beforeLink.fiscalOpex, 0, 'fiscal must not cash the rent before the cheque is due');
assert.strictEqual(beforeLink.independent, 0, 'linked cheque is not a second expense');
assert.strictEqual(beforeLink.accrual, 640000000, 'accrual stays; unpaid expense is not zeroed globally');
assert.strictEqual(beforeLink.treasury + beforeLink.fiscalOpex + beforeLink.independent, 0, '640 rent must not become 1280 outflow');
assert.ok(future.ptfOpexLinkCheque('CHQ-RENT', ['R1', 'R2']).ok);
var afterLink = cashOf(future);
assert.strictEqual(afterLink.treasury, 0);
assert.strictEqual(afterLink.fiscalOpex, 0);
assert.strictEqual(future.ptfChequeDueReached(future.getData('ptf_crm_cheques_issued')[0]), false, 'future jalali due is not matured against gregorian today');

var matured = load('2026-09-22');
matured.setData('ptf_crm_opex', [
  { cd: 'OPX-1', _opexRowId: 'R1', cat: 'اجاره‌بها', amt: 320000000, month: '1405/04', t: '1405/04/01' },
  { cd: 'OPX-2', _opexRowId: 'R2', cat: 'اجاره‌بها', amt: 320000000, month: '1405/05', t: '1405/05/01' }
]);
matured.setData('ptf_crm_cheques_issued', [{
  cd: 'CHQ-DUE', amt: 640000000, kind: 'finance', ownership: 'company', st: 'open',
  dueISO: '2026-09-06', issueISO: '2026-06-22', opexRowIds: ['R1', 'R2']
}]);
matured.ptfOpexLinkCheque('CHQ-DUE', ['R1', 'R2']);
var dueCash = cashOf(matured);
assert.strictEqual(dueCash.treasury, 640000000, 'matured cheque exits once');
assert.strictEqual(dueCash.fiscalOpex, 640000000, 'fiscal expense is the rent, once');
assert.strictEqual(dueCash.independent, 0, 'matured linked cheque is not added again');
assert.strictEqual(dueCash.treasury, dueCash.fiscalOpex, 'treasury and fiscal each count the matured rent once, not 1280 inside one report');

var tpl = load('2026-09-22');
tpl.setData('ptf_crm_opex', [
  { cd: 'OPX-N', _opexRowId: 'N1', cat: 'اداری', amt: 300, month: '1405/06', t: '2026-08-20' },
  { cd: 'OPX-R', _opexRowId: 'ROW-R', cat: 'اجاره', amt: 500, month: '1405/06', tplId: 'TPL-1', t: '2026-08-20' },
  { cd: 'OPX-C', _opexRowId: 'ROW-C', cat: 'اینترنت', amt: 700, month: '1405/06', tplId: 'TPL-2', chequeCd: 'CH-1', payHow: 'cheque', t: '2026-08-20' }
]);
tpl.setData('ptf_crm_cheques_issued', [{ cd: 'CH-1', amt: 700, kind: 'finance', ownership: 'company', st: 'open', dueISO: '2027-02-03', issueISO: '2026-08-20', opexRowIds: ['ROW-C'] }]);
var openTpl = cashOf(tpl);
assert.strictEqual(openTpl.accrual, 1500, 'profit accrual still includes unsettled recurring');
assert.strictEqual(openTpl.cash, 300, 'only the ordinary row is cash before settlement');
assert.strictEqual(openTpl.fiscalOpex, 300);
assert.strictEqual(tpl.ptfTreasuryCrmMoves().filter(function (m) { return m.key === 'opex:ROW-R' || m.key === 'opex:ROW-C'; }).length, 0);
var rows = tpl.getData('ptf_crm_opex');
rows[1].st = 'settled';
rows[1].settleISO = '2026-09-01';
rows[1].settledT = '1405/06/10';
rows[1].settleDoc = 'حواله ۱۲۳';
tpl.setData('ptf_crm_opex', rows);
var paidTpl = cashOf(tpl);
assert.strictEqual(paidTpl.accrual, 1500, 'settlement does not double-count profit');
assert.strictEqual(paidTpl.cash, 800, 'settled recurring joins cash; cheque-linked recurring waits for due');
assert.strictEqual(tpl.ptfTreasuryCrmMoves().filter(function (m) { return m.key === 'opex:ROW-R'; }).length, 1);
assert.ok(tpl.ptfTreasuryCrmMoves().every(function (m) { return m.key !== 'opex:ROW-C'; }));

var ordinary = load('2026-09-22');
ordinary.setData('ptf_crm_opex', [{ cd: 'OPX-N', _opexRowId: 'N1', cat: 'اداری', amt: 1000000, month: '1405/06', t: '2026-08-20' }]);
ordinary.setData('ptf_crm_cheques_issued', [{ cd: 'CH-IND', amt: 40000000, kind: 'finance', ownership: 'company', st: 'open', issueISO: '2026-08-20', t: '2026-08-20' }]);
var ord = cashOf(ordinary);
assert.strictEqual(ord.fiscalOpex, 1000000, 'one-time expense without a cheque still exits');
assert.strictEqual(ord.independent, 40000000, 'independent issued cheque remains an outflow');
assert.strictEqual(ord.treasury, 1000000, 'treasury counts the one-time row and not an undated open cheque');

var salary = load('2026-09-22');
salary.setData('ptf_crm_opex', [{ cd: 'SAL', _opexRowId: 'S1', cat: 'حقوق', amt: 400000000, month: '1405/06', shareholderSalary: true, shareTx: 'SHT', recurringKey: 'salary:SH1:1405/06' }]);
var sal = cashOf(salary);
assert.strictEqual(sal.cash, 0, 'salary claim is not cash');
assert.strictEqual(sal.fiscalOpex, 0);
assert.strictEqual(sal.accrual, 400000000);

var version = JSON.parse(read('VERSION.json')).crm_version;
assert.strictEqual(version, 'v34.39.32');
console.log('PASS tester677 v34.39.32 rent cash until paid');
