/* tester385 — cheque can create remaining-year rent months that do not exist yet */
'use strict';
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var assert = require('assert');
var root = path.resolve(__dirname, '../..');

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
  audit: function () {}, ptfToast: function () {},
  curRole: function () { return 'admin'; },
  curSession: function () { return { user: 'admin', name: 'ادمین' }; },
  roleDef: function () { return { finance: true }; },
  alert: function () {}, confirm: function () { return true; },
  setInterval: function () { return 0; },
  clearInterval: function () {},
  document: { getElementById: function () { return null; }, body: { insertAdjacentHTML: function () {} } }
};
ctx.window = ctx;
ctx.getData = function (k) {
  try { var raw = ctx.localStorage.getItem(k); return raw ? JSON.parse(raw) : (k === 'ptf_crm_settings' ? {} : []); } catch (e) { return []; }
};
ctx.setData = function (k, v) { ctx.localStorage.setItem(k, JSON.stringify(v)); };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'crm/opex.js'), 'utf8'), ctx, { filename: 'opex.js' });

ctx.setData('ptf_crm_opex', [
  { cd: 'OPX-1', _opexRowId: 'R1', cat: 'اجاره‌بها', amt: 320000000, month: '1405/05', tplId: 'TPL-RENT' }
]);
ctx.localStorage.setItem('ptf_crm_settings', JSON.stringify({
  opexTpl: [{ id: 'TPL-RENT', cat: 'اجاره‌بها', amt: 320000000, desc: 'اجاره دفتر' }]
}));

var fut = ctx.window.ptfOpexFutureMonthsForTpl('TPL-RENT', '1405');
var months = fut.map(function (x) { return x.month; });
assert.ok(months.indexOf('1405/05') < 0, 'current posted month not future');
assert.ok(months.indexOf('1405/06') > -1 && months.indexOf('1405/12') > -1, 'rest of year listed');

var made = ctx.window.ptfOpexCreateMonthsForCheque('CHQ-1', [
  { tplId: 'TPL-RENT', month: '1405/06' },
  { tplId: 'TPL-RENT', month: '1405/07' }
]);
assert.strictEqual(made.ids.length, 2, 'two months created');
var all = ctx.getData('ptf_crm_opex');
var jun = all.filter(function (x) { return x.month === '1405/06'; })[0];
assert.ok(jun && jun.chequeCd === 'CHQ-1', 'june linked');
var again = ctx.window.ptfOpexFutureMonthsForTpl('TPL-RENT', '1405').map(function (x) { return x.month; });
assert.ok(again.indexOf('1405/06') < 0, 'created month no longer future');
assert.ok(ctx.window.ptfAutoApplyRecurring, 'auto still skips existing tpl+month');

var src = fs.readFileSync(path.join(root, 'crm/cheque-panel.js'), 'utf8');
assert.ok(src.indexOf('ptf-ch-opex-future') > -1, 'ui future ticks');
console.log('PASS tester385 opex-future-cheque');
