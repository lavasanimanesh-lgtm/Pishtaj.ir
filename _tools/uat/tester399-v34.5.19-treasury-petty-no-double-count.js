'use strict';
/* بانک/خزانه: شارژ تنخواه انتقال وجه بانک→تنخواه است. تسویه هزینه از همان
   تنخواه نباید بار دوم خروجی بانک ساخته شود؛ پرداخت مستقیم فقط یک‌بار خروجی است. */
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var assert = require('assert');
var root = path.resolve(__dirname, '../..');
var store = {};
var ctx = {
  window: null, JSON: JSON, Math: Math, Array: Array, Object: Object, String: String,
  Date: Date, Intl: Intl, isFinite: isFinite, console: console,
  localStorage: { getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; }, setItem: function (k, v) { store[k] = String(v); } },
  ptfTodayISO: function () { return '2026-08-13'; }
};
ctx.window = ctx;
ctx.getData = function (k) { try { return JSON.parse(store[k] || '[]'); } catch (e) { return []; } };
ctx.setData = function (k, v) { store[k] = JSON.stringify(v); };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'crm/treasury.js'), 'utf8'), ctx, { filename: 'treasury.js' });

/* ۱m از بانک شارژ تنخواه می‌شود؛ ۲۵۰k هزینه از همان تنخواه تسویه شده است.
   خروجی بانک باید فقط ۱m باشد، نه ۱.۲۵m. */
ctx.setData('ptf_crm_petty_tx', [
  { cd: 'PTX-CHARGE', type: 'charge', amt: 1000000, t: '2026-08-01', st: 'posted' },
  { cd: 'PTX-SETTLE', type: 'settle', amt: 250000, ref: 'PTY-1', t: '2026-08-02', st: 'posted' }
]);
ctx.setData('ptf_crm_petty', [{ cd: 'PTY-1', amt: 250000, st: 'settled', t: '2026-08-02' }]);
var c1 = ctx.window.ptfTreasuryDerivedCash();
assert.strictEqual(c1.outflow, 1000000, 'شارژ تنخواه یک‌بار خروجی بانک است؛ تسویه هزینه دوباره نباید جمع شود');
assert.strictEqual(ctx.window.ptfTreasuryCrmMoves().filter(function (m) { return m.src === 'شارژ تنخواه'; }).length, 1, 'یک حرکت شارژ ثبت می‌شود');
assert.strictEqual(ctx.window.ptfTreasuryCrmMoves().filter(function (m) { return /تسویه تنخواه/.test(m.src || ''); }).length, 0, 'تسویه از مانده تنخواه خروجی بانک نیست');

/* پرداخت مستقیم از بانک/تنخواه، انتقال شارژ نیست و فقط یک‌بار خروجی مستقل دارد. */
ctx.setData('ptf_crm_petty_tx', ctx.getData('ptf_crm_petty_tx').concat([{ cd: 'PTX-DIRECT', type: 'direct', amt: 50000, ref: 'PTY-2', t: '2026-08-03', st: 'posted' }]));
ctx.setData('ptf_crm_petty', ctx.getData('ptf_crm_petty').concat([{ cd: 'PTY-2', amt: 50000, st: 'settled', payMode: 'direct', t: '2026-08-03' }]));
var c2 = ctx.window.ptfTreasuryDerivedCash();
assert.strictEqual(c2.outflow, 1050000, 'پرداخت مستقیم فقط یک خروجی مستقل به بانک اضافه می‌کند');
console.log('PASS tester399 treasury-petty-no-double-count');
