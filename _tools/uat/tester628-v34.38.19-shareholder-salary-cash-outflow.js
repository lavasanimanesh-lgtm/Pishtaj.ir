/* tester628 — v34.38.20 (SH-SALARY-CASH-OUTFLOW): پرداخت واقعی حقوق (draw با
   paymentFor:'salary'/salaryMonth) خروج نقدی دوره است؛ تعهد حقوق فقط سود را کم می‌کند.
   قراردادها:
   ۱) drawِ حقوق از advRows/ستون «مانده قابل تسویهٔ امسال» خارج است (B1).
   ۲) drawِ حقوق در outflowsTotal/cashEnd شمرده می‌شود (B2) و بدون دوباره‌شماری با opex
      تعهدی (چون opexCashTotal حقوق را کنار می‌گذارد).
   ۳) حقوق پرداخت‌نشده = تعهد − پرداخت‌شده (B3) و در UI/گزارش/CSV جدا نمایش داده می‌شود. */
'use strict';
var fs = require('fs');
var assert = require('assert');
var fiscal = fs.readFileSync('crm/fiscal.js', 'utf8');

console.log('── salary cash-outflow contract (v34.38.20) ──');
/* قرارداد استاتیک کد */
assert.ok(/out\.salaryPaid = Math\.round\(salaryPaid\)/.test(fiscal), 'salaryPaid computed from salary draws');
assert.ok(/out\.salaryUnpaid = Math\.max\(0, \(\+d\.opexSalaryTotal \|\| 0\) - out\.salaryPaid\)/.test(fiscal), 'salaryUnpaid = claims - paid');
assert.ok(/chairRepay \+ out\.salaryPaid/.test(fiscal), 'salaryPaid joins outflowsTotal');
assert.ok(/salaryPaid: out\.salaryPaid/.test(fiscal) && /salaryUnpaid: out\.salaryUnpaid/.test(fiscal), 'salaryPaid/salaryUnpaid exposed in cash data');
assert.ok(/paymentFor === 'salary' \|\| !!x\.salaryMonth/.test(fiscal), 'salary draw is not advYear (B1 filter)');
assert.ok(/حقوق پرداخت‌شده با draw/.test(fiscal), 'UI shows paid salary KPI');
assert.ok(/حقوق تعهدیِ پرداخت‌نشده \(بدون خروج نقدی\)/.test(fiscal), 'UI shows unpaid salary KPI');
assert.ok(/حقوق پرداخت‌شده با draw \(خروج نقدی\)/.test(fiscal) && /حقوق پرداخت‌نشده \(تعهد باقی‌مانده\)/.test(fiscal), 'report/CSV rows for paid/unpaid');
console.log('  ✔ استاتیک: salaryPaid/salaryUnpaid در خروجی نقدی، UI و گزارش');

/* مدل رفتاری مستقل از storage مرورگر — همان قواعد fiscal.js */
function isSalaryPayDraw(x) { return x && x.type === 'draw' && (x.paymentFor === 'salary' || !!x.salaryMonth); }
function isSalaryOpex(o) { return !!(o.shareholderSalary === true || o.shareTx || String(o.recurringKey || '').indexOf('salary:') === 0); }
function cashModel(opex, sharetx, year) {
  var opexCash = 0, salaryClaims = 0;
  opex.forEach(function (o) {
    if (!o || o.status === 'void') return;
    var a = +o.amt || 0;
    if (isSalaryOpex(o)) salaryClaims += a; else opexCash += a;
  });
  var salaryPaid = 0, adv = 0;
  sharetx.forEach(function (x) {
    if (!x || x.status === 'void' || x.voided) return;
    if (x.fy !== year) return;
    if (isSalaryPayDraw(x)) { salaryPaid += (+x.amt || 0); return; }
    if (x.type === 'draw' || x.type === 'advance' || x.type === 'debit') adv += (+x.amt || 0);
  });
  var salaryUnpaid = Math.max(0, salaryClaims - salaryPaid);
  var outflowsTotal = opexCash + salaryPaid; /* بقیهٔ خروجی‌ها صفر در این مدل */
  return { opexCash: opexCash, salaryClaims: salaryClaims, salaryPaid: salaryPaid, salaryUnpaid: salaryUnpaid, advYear: adv, outflowsTotal: outflowsTotal, netCash: 1000000000 - outflowsTotal, cashEnd: 1000000000 - outflowsTotal };
}

var opex = [
  { cd: 'SAL-OX', amt: 400000000, shareholderSalary: true, shareTx: 'SHT-SAL', recurringKey: 'salary:SH1:1405/06', status: 'active' },
  { cd: 'ORD-OX', amt: 100000000, status: 'active' }
];
var txNone = [];
var before = cashModel(opex, txNone, '1405');
assert.strictEqual(before.salaryClaims, 400000000, 'claims accrual');
assert.strictEqual(before.salaryPaid, 0, 'no paid salary before draw');
assert.strictEqual(before.salaryUnpaid, 400000000, 'all salary unpaid before draw');
assert.strictEqual(before.outflowsTotal, 100000000, 'only cash OPEX before draw');
console.log('  ✔ پیش از draw: حقوق فقط تعهد است و خروج نقدی نیست');

var txPaid = [
  { cd: 'D1', type: 'draw', amt: 400000000, paymentFor: 'salary', salaryMonth: '1405/06', status: 'active', fy: '1405' },
  { cd: 'A1', type: 'advance', amt: 250000000, status: 'active', fy: '1405' }
];
var after = cashModel(opex, txPaid, '1405');
assert.strictEqual(after.salaryPaid, 400000000, 'salary draw counted as cash outflow');
assert.strictEqual(after.salaryUnpaid, 0, 'fully paid => no unpaid remainder');
assert.strictEqual(after.outflowsTotal, 100000000 + 400000000, 'outflows = cash OPEX + paid salary');
assert.strictEqual(after.advYear, 250000000, 'advance draw stays in advYear, not salaryPaid');
console.log('  ✔ پس از draw: پرداخت حقوق خروج نقدی است و advance در advYear می‌ماند');

var txPartial = [{ cd: 'D2', type: 'draw', amt: 100000000, paymentFor: 'salary', salaryMonth: '1405/06', status: 'active', fy: '1405' }];
var partial = cashModel(opex, txPartial, '1405');
assert.strictEqual(partial.salaryPaid, 100000000, 'partial payment counted');
assert.strictEqual(partial.salaryUnpaid, 300000000, 'unpaid = claims - paid');
console.log('  ✔ پرداخت جزئی: ماندهٔ پرداخت‌نشده درست محاسبه می‌شود');

var txAdvOnly = [{ cd: 'A2', type: 'draw', amt: 70000000, status: 'active', fy: '1405' }]; /* draw بدون paymentFor = علی‌الحساب */
var advOnly = cashModel(opex, txAdvOnly, '1405');
assert.strictEqual(advOnly.salaryPaid, 0, 'plain draw (no salary marker) is not salaryPaid');
assert.strictEqual(advOnly.advYear, 70000000, 'plain draw remains advYear');
console.log('  ✔ draw بدون نشان حقوق = علی‌الحساب (نه خروج حقوق)');

console.log('PASS tester628 v34.38.20 shareholder salary cash outflow');
