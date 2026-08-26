/* tester507 — v34.8.13/F2: server-owned salary registration and shareholder movements. */
'use strict';
var fs = require('fs');
var vm = require('vm');
var assert = require('assert');
var shareholders = fs.readFileSync('crm/shareholders.js', 'utf8');
var treasury = fs.readFileSync('crm/treasury.js', 'utf8');
var api = fs.readFileSync('api/sales-domain.php', 'utf8');

function storage() {
  var data = {};
  return {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
    setItem: function (k, v) { data[k] = String(v); },
    removeItem: function (k) { delete data[k]; }
  };
}
function section(source, start, end) {
  var a = source.indexOf(start), b = source.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, 'section missing: ' + start);
  return source.slice(a, b);
}

console.log('── Phase 2 static contract ──');
assert.ok(/register_shareholder_salary/.test(api), 'salary command exists');
assert.ok(/register_chair_in/.test(api) && /register_shareholder_draw/.test(api) && /register_chair_out/.test(api), 'movement commands exist');
assert.ok(/function sd_salary_find_indexes[\s\S]*type.*salary/.test(api), 'salary matcher is type-safe');
assert.ok(/sd_salary_find_indexes\(\$sharetx,\$key,\$shCd,\$month\)/.test(api), 'reconcile uses type-safe salary matcher');
assert.ok(/alreadyRegistered.*true/.test(api) && /projectionMode.*no-op-existing-identity/.test(api), 'existing salary is no-op');
assert.ok(/atomic-salary-opex/.test(api) && /'ptf_crm_sharetx'=>\$sharetx,'ptf_crm_opex'=>\$opex/.test(api), 'salary and OPEX commit together');
assert.ok(/paymentFor.*salary/.test(api) && /type.*draw/.test(api), 'actual salary payment uses draw metadata');
assert.ok(shareholders.indexOf('window.ptfShareRegisterSalary = function') > -1, 'per-shareholder salary button');
assert.ok(shareholders.indexOf("register_shareholder_salary") > -1, 'salary UI calls server command');
assert.ok(shareholders.indexOf("salary_payment')") > -1 && shareholders.indexOf("shareDrawOnServer(s, amt") > -1, 'new salary payment route uses draw');
assert.ok(section(shareholders, 'window.ptfShareDraw = function', 'window.ptfSharePaySalary = function').indexOf("addTx('draw'") < 0, 'draw UI has no local fallback');
assert.ok(section(treasury, 'window.ptfTreasuryChairIn = function', 'window.ptfTreasuryChairOut = function').indexOf('register_chair_in') > -1, 'chair in calls domain command');
assert.ok(section(treasury, 'window.ptfTreasuryChairOut = function', 'window.ptfTreasuryRender = function').indexOf('register_chair_out') > -1, 'chair out calls domain command');
console.log('  ✔ salary, draw and chair movements use server commands');

console.log('── Phase 2 shareholder UI runtime ──');
var ls = storage();
var dialog = null;
var commands = [];
var held = [];
var released = [];
var c = {
  window: null, console: console, localStorage: ls,
  getData: function (k) { try { return JSON.parse(ls.getItem(k) || '[]'); } catch (e) { return []; } },
  setData: function (k, v) { ls.setItem(k, JSON.stringify(v)); return true; },
  curRole: function () { return 'admin'; },
  curSession: function () { return { user: 'admin', name: 'Admin' }; },
  faDate: function () { return '1405/06/03'; },
  faDateTime: function () { return '1405/06/03 10:00'; },
  genCode: function (prefix) { return prefix + '-DRAFT-1'; },
  ptfOnClickArg: function (value) { return String(value); },
  ptfToast: function () {}, audit: function () {},
  ptfFiscalYearLocked: function () { return false; }, ptfFiscalYearOf: function (m) { return String(m).split('/')[0]; },
  ptfSyncFlushKeysNow: function (keys, cb) { cb(true, { keys: keys }); },
  ptfSyncHoldCommandKeys: function (keys) { held.push(keys.slice()); },
  ptfSyncReleaseCommandKeys: function (keys) { released.push(keys.slice()); },
  ptfSalesDomainCommand: function (action, payload) {
    commands.push({ action: action, payload: payload });
    return Promise.resolve({ state: 'acked', response: { result: { registered: true, transactionCd: 'SHT-CMD-1', alreadyRegistered: false } } });
  },
  ptfDialog: function (opts) { dialog = opts; },
  document: { getElementById: function () { return null; }, querySelector: function () { return null; }, body: { insertAdjacentHTML: function () {} }, addEventListener: function () {} },
  Date: Date, Intl: Intl, Promise: Promise, JSON: JSON, Math: Math, Object: Object, Array: Array, String: String, Number: Number, RegExp: RegExp, Error: Error, setTimeout: setTimeout, clearTimeout: clearTimeout
};
c.window = c;
vm.createContext(c);
vm.runInContext(shareholders, c, { filename: 'shareholders-phase02.js' });
ls.setItem('ptf_crm_shareholders', JSON.stringify([{ cd: 'SH1', name: 'سهامدار یک', pct: 100, duty: true, salary: 400000000, active: true }]));
ls.setItem('ptf_crm_sharetx', '[]');
ls.setItem('ptf_crm_opex', '[]');

c.ptfShareRegisterSalary('SH1');
assert.ok(dialog && /ماه حقوق/.test(dialog.fields[0].label));
dialog.onOk({ month: '1405/05' });
var returnPromise = new Promise(function (resolve) { setTimeout(resolve, 0); });
returnPromise.then(function () {
  assert.strictEqual(commands[0].action, 'register_shareholder_salary');
  assert.strictEqual(commands[0].payload.shareholderCd, 'SH1');
  assert.strictEqual(commands[0].payload.month, '1405/05');
  assert.strictEqual(Object.prototype.hasOwnProperty.call(commands[0].payload, 'amountIRR'), false, 'salary amount came from UI');
  assert.ok(held.some(function (x) { return x.indexOf('ptf_crm_opex') >= 0 && x.indexOf('ptf_crm_sharetx') >= 0; }));

  dialog = null;
  c.ptfShareDraw('SH1');
  dialog.onOk({ amt: '300000000', desc: 'برداشت', files: [] });
  return new Promise(function (resolve) { setTimeout(resolve, 0); });
}).then(function () {
  assert.strictEqual(commands[1].action, 'register_shareholder_draw');
  assert.strictEqual(commands[1].payload.amountIRR, 300000000);
  assert.strictEqual(commands[1].payload.month, '1405/06');
  assert.strictEqual(commands[1].payload.salaryMonth, undefined);

  dialog = null;
  c.ptfSharePaySalary('SH1');
  dialog.onOk({ amt: '400000000', desc: 'پرداخت حقوق', files: [] });
  return new Promise(function (resolve) { setTimeout(resolve, 0); });
}).then(function () {
  assert.strictEqual(commands[2].action, 'register_shareholder_draw');
  assert.strictEqual(commands[2].payload.salaryMonth, '1405/06');
  assert.strictEqual(commands[2].payload.amountIRR, 400000000);
  assert.strictEqual(released.length, held.length);
  console.log('  ✔ UI ماه مستقل، مبلغ profile-only، salary claim و draw پرداخت را جدا نگه می‌دارد');
  console.log('PASS tester507 v34.8.13 phase02 shareholder commands');
}).catch(function (error) {
  console.error(error && error.stack || error);
  process.exitCode = 1;
});
