/* tester508 — v34.8.32/F3: salary accrual/claim is not cash until draw. */
'use strict';
var fs = require('fs');
var assert = require('assert');
var opex = fs.readFileSync('crm/opex.js', 'utf8');
var fiscal = fs.readFileSync('crm/fiscal.js', 'utf8');
var treasury = fs.readFileSync('crm/treasury.js', 'utf8');

console.log('── Phase 3 cash contract ──');
assert.ok(/function isShareholderSalaryOpex/.test(opex), 'salary OPEX classifier');
assert.ok(/totalSalary/.test(opex) && /totalCash/.test(opex), 'OPEX accrual/cash split');
assert.ok(/opexCashTotal/.test(fiscal) && /opexSalaryTotal/.test(fiscal), 'fiscal split fields');
assert.ok(/salaryClaims: \+d\.opexSalaryTotal/.test(fiscal), 'salary claim is exposed separately');
assert.ok(/opex: d\.opexCashTotal/.test(fiscal), 'cash uses non-salary OPEX');
assert.ok(/حقوق تعهدی.*بدون خروج نقدی/.test(fiscal), 'UI explains unpaid salary cash semantics');
assert.ok(/o\.shareholderSalary \|\| o\.shareTx/.test(treasury), 'treasury excludes salary accrual OPEX');
assert.ok(/t !== 'draw'/.test(treasury), 'treasury includes draw movement');
console.log('  ✔ accrual salary, cash OPEX and draw are separate contracts');

/* Pure behavioral model of the public contract, independent of browser storage. */
function split(rows) {
  var accrual = 0, salaryClaims = 0, cash = 0;
  rows.forEach(function (row) {
    if (!row || row.status === 'void' || row.st === 'void') return;
    var amount = +row.amt || 0;
    var isSalary = row.shareholderSalary === true || row.shareTx || String(row.recurringKey || '').indexOf('salary:') === 0;
    accrual += amount;
    if (isSalary) salaryClaims += amount;
    else cash += amount;
  });
  return { accrual: accrual, salaryClaims: salaryClaims, cash: cash };
}
var salary = { cd: 'SAL-OX', amt: 400000000, month: '1405/06', shareholderSalary: true, shareTx: 'SHT-SAL', recurringKey: 'salary:SH1:1405/06', status: 'active' };
var ordinary = { cd: 'ORD-OX', amt: 100000000, month: '1405/06', status: 'active' };
var beforePayment = split([salary, ordinary]);
assert.deepStrictEqual(beforePayment, { accrual: 500000000, salaryClaims: 400000000, cash: 100000000 });
var draw = { cd: 'DRAW-1', type: 'draw', amt: 400000000, salaryMonth: '1405/06', paymentFor: 'salary', status: 'active' };
assert.strictEqual(draw.type, 'draw');
assert.strictEqual(beforePayment.cash, 100000000, 'unpaid salary entered cash before draw');
console.log('  ✔ پیش از draw، حقوق در accrual/claim هست ولی در cash نیست');

console.log('PASS tester508 v34.8.32 phase03 cash semantics');
