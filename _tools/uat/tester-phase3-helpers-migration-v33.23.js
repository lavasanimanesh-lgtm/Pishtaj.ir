/* =====================================================================
   تست فاز ۳ — Migration of PTF.* Helpers across CRM financial modules
   هدف: هر ماژول مالی (cheque-module, commission, fx, offers, supplier-finance,
   fiscal, working-capital) که از الگوی concat(inv.payments, inv.pays) استفاده می‌کند
   باید از PTF.invPaidSum و PTF.isPaymentActive به‌عنوان fallback امن استفاده کند.
   ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
const failedTests = [];
function t(name, expected, actual) {
  const ok = JSON.stringify(expected) === JSON.stringify(actual);
  if (ok) { pass++; console.log('  ✔ ' + name); }
  else {
    fail++; failedTests.push(name);
    console.log('  ✘ ' + name);
    console.log('    Expected:', JSON.stringify(expected));
    console.log('    Actual:  ', JSON.stringify(actual));
  }
}
function section(name) { console.log('\n── ' + name + ' ──'); }

// تست: هر فایل که قبلاً concat(inv.payments داشت، حالا باید از PTF.invPaidSum استفاده کند
// یا الگوی concat را با fallback به PTF داشته باشد
const files = [
  'crm/cheque-module.js',
  'crm/commission.js',
  'crm/fx.js',
  'crm/offers.js',
  'crm/supplier-finance.js',
  'crm/fiscal.js',
  'crm/working-capital.js'
];

section('بررسی refactor در فایل‌های مالی');
for (const f of files) {
  const full = path.join('/home/user/Pishtaj.ir', f);
  if (!fs.existsSync(full)) {
    t('فایل موجود: ' + f, true, false);
    continue;
  }
  const src = fs.readFileSync(full, 'utf-8');
  // بررسی: هر جا concat(inv.payments, inv.pays) باقی‌مانده باید PTF.isPaymentActive filter یا PTF.invPaidSum داشته باشد
  const concatMatches = src.match(/concat\(inv\.(?:payments|pays)[^)]*\)/g) || [];
  let allSafe = true;
  const issues = [];
  for (const m of concatMatches) {
    // اطراف concat رو چک کن
    const idx = src.indexOf(m);
    const context = src.substring(Math.max(0, idx - 200), Math.min(src.length, idx + m.length + 200));
    if (!/PTF\.(invPaidSum|isPaymentActive|paymentAmtIrr)/.test(context)) {
      allSafe = false;
      issues.push(m);
    }
  }
  t(f + ' — همه concat با PTF محافظت می‌شوند', true, allSafe || concatMatches.length === 0);
  if (issues.length) {
    console.log('    مشکلات:', issues.join(', '));
  }
}

// ============================================================================
section('بررسی syntax فایل‌های refactor شده');
const syntaxFiles = [
  'crm/cheque-module.js',
  'crm/commission.js',
  'crm/fx.js',
  'crm/offers.js',
  'crm/supplier-finance.js',
  'crm/fiscal.js',
  'crm/working-capital.js'
];

// basic syntax check: try to load via Node vm
const vm = require('vm');
for (const f of syntaxFiles) {
  const full = path.join('/home/user/Pishtaj.ir', f);
  if (!fs.existsSync(full)) {
    t('فایل موجود: ' + f, true, false);
    continue;
  }
  const src = fs.readFileSync(full, 'utf-8');
  const sandbox = {
    window: {},
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    document: { getElementById: () => null, addEventListener: () => {}, querySelectorAll: () => [] },
    console: { log: () => {}, error: () => {}, warn: () => {} },
    setInterval: () => 0, clearInterval: () => {},
    setTimeout: () => 0, clearTimeout: () => {}
  };
  sandbox.window = sandbox;
  sandbox.window.localStorage = sandbox.localStorage;
  sandbox.window.document = sandbox.document;
  vm.createContext(sandbox);
  try {
    vm.runInContext(src, sandbox, { timeout: 3000 });
    t('syntax: ' + f, true, true);
  } catch (e) {
    t('syntax: ' + f + ' — خطا: ' + (e.message || e).slice(0, 80), true, false);
  }
}

// ============================================================================
section('بررسی فاز ۲: helpers helpers در PTF موجودند');
const helperSrc = fs.readFileSync(
  path.join('/home/user/Pishtaj.ir/crm/finance-helpers.js'),
  'utf-8'
);
const sandbox2 = { window: {}, localStorage: { getItem: () => null, setItem: () => {} }, document: {}, console };
sandbox2.window = sandbox2;
vm.createContext(sandbox2);
vm.runInContext(helperSrc, sandbox2);
const P = sandbox2.window.PTF;

t('PTF.toFaEnNum', 'function', typeof P.toFaEnNum);
t('PTF.isPaymentVoided', 'function', typeof P.isPaymentVoided);
t('PTF.isPaymentActive', 'function', typeof P.isPaymentActive);
t('PTF.paymentAmtIrr', 'function', typeof P.paymentAmtIrr);
t('PTF.invPaidSum', 'function', typeof P.invPaidSum);
t('PTF.invRemain', 'function', typeof P.invRemain);
t('PTF.isInvPaid', 'function', typeof P.isInvPaid);
t('PTF.dealTotalCosts', 'function', typeof P.dealTotalCosts);
t('PTF.matchBySupplierCd', 'function', typeof P.matchBySupplierCd);
t('PTF.cashIsoOf', 'function', typeof P.cashIsoOf);
t('PTF.isInDateRange', 'function', typeof P.isInDateRange);

// ============================================================================
section('تست رفتار paymentAmtIrr در الگوهای مختلف');
t('amountIrr اولویت اول', 1500, P.paymentAmtIrr({ amountIrr: 1500, amt: 1000, amount: 500 }));
t('amt اولویت دوم وقتی amountIrr نبود', 1000, P.paymentAmtIrr({ amt: 1000, amount: 500 }));
t('amount اولویت سوم', 500, P.paymentAmtIrr({ amount: 500 }));
t('همه صفر', 0, P.paymentAmtIrr({}));
t('null', 0, P.paymentAmtIrr(null));
t('مقادیر نامعتبر (رشته) → 0', 0, P.paymentAmtIrr({ amt: 'abc' }));

// ============================================================================
section('تست isPaymentActive فیلتر کردن');
t('void = inactive', false, P.isPaymentActive({ status: 'void' }));
t('voided=true = inactive', false, P.isPaymentActive({ voided: true }));
t('reversal = inactive', false, P.isPaymentActive({ status: 'reversal' }));
t('reversalCd = inactive', false, P.isPaymentActive({ reversalCd: 'RV-1' }));
t('voided=1 = inactive', false, P.isPaymentActive({ voided: 1 }));
t('null = false (defensive)', false, P.isPaymentActive(null));
t('active بدون status = true', true, P.isPaymentActive({ amt: 100 }));
t('پرداخت عادی = active', true, P.isPaymentActive({ status: 'posted', amt: 100 }));

// ============================================================================
section('تست ترکیبی: استفاده از PTF.invPaidSum و isPaymentActive همان نتیجه می‌دهد');
// سناریو: فاکتور با ۳ پرداخت (۲ فعال، ۱ void)
const testInv = {
  payments: [
    { amt: 1000000, status: 'posted' },
    { amt: 500000, status: 'posted' },
    { amt: 200000, status: 'void' }
  ],
  pays: [
    { amt: 300000, status: 'posted' }
  ]
};
// Manual computation (الگوی اصلی)
const manualActive = testInv.payments.concat(testInv.pays)
  .filter(p => p && p.status !== 'void' && p.status !== 'reversal' && !p.voided && !p.reversalCd)
  .reduce((s, p) => s + (p.amt || 0), 0);
const ptfResult = P.invPaidSum(testInv);
t('manual vs PTF.invPaidSum (active only)', manualActive, ptfResult);
t('manual expected', 1800000, manualActive);
t('PTF result', 1800000, ptfResult);

// ============================================================================
console.log('\n========================================');
console.log('=== Phase 3 Migration: ' + pass + ' PASS / ' + fail + ' FAIL ===');
console.log('========================================');
if (failedTests.length) {
  console.log('\nFailed tests:');
  failedTests.forEach(n => console.log('  - ' + n));
}
if (fail > 0) process.exit(1);
