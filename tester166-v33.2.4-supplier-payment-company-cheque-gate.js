/* AUD-05 fixture (crm/AUDIT-FINANCIAL-SYSTEM-2026-07-29.md) — protects the
   supplier-payment form (slPaymentSave -> slChequeCreate) from letting a
   non-senior role (e.g. "buyer", who has buyPrice:true and thus canWrite()
   access to this form) issue a real company cheque. Before this fix, only
   the generic cheque form (cheques.js) enforced canCreateCompanyCheque();
   the supplier-finance payment path had no equivalent role gate. */
'use strict';
var fs = require('fs'), vm = require('vm'), assert = require('assert');

function freshContext(role) {
  var store = {};
  var formValues = {
    slChNo: '1234567', slChDue: '1405-06-01', slChBank: 'ملت',
    slPayDate: '1405-06-01', slPayMethod: 'company_cheque', slPayAmt: '5000000', slPayNote: 'تست'
  };
  var ctx = {
    console: console, JSON: JSON, Math: Math, Array: Array, Object: Object, String: String, Date: Date,
    localStorage: { getItem: function (k) { return store[k] != null ? store[k] : null; }, setItem: function (k, v) { store[k] = String(v); } },
    escP: function (x) { return String(x == null ? '' : x); },
    genCode: function (p) { return p + '-' + Math.floor(Math.random() * 100000); },
    faDate: function () { return '1405/04/29'; }, faDateTime: function () { return '1405/04/29 10:00'; },
    audit: function () {}, ptfToast: function () {},
    curRole: function () { return role; },
    isSenior: function () { return ['admin', 'chairman', 'ceo', 'commercial'].indexOf(role) > -1; },
    roleDef: function () { return { buyPrice: true }; },
    curSession: function () { return { user: role + 'User', name: role }; },
    confirm: function () { return true; }, alert: function () {},
    ptfNum: function (v) { return +String(v).replace(/,/g, '') || 0; },
    setInterval: function () { return 0; }, setTimeout: function () { return 0; },
    document: {
      getElementById: function (id) { return (id in formValues) ? { value: formValues[id] } : null; },
      querySelectorAll: function () { return []; }
    }
  };
  ctx.getData = function (k) { try { return JSON.parse(ctx.localStorage.getItem(k) || (k === 'ptf_crm_supplier_finance' ? '{}' : '[]')); } catch (e) { return k === 'ptf_crm_supplier_finance' ? {} : []; } };
  ctx.setData = function (k, v) { ctx.localStorage.setItem(k, JSON.stringify(v)); };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('crm/cheques.js', 'utf8'), ctx, { filename: 'cheques.js' });
  vm.runInContext(fs.readFileSync('crm/supplier-finance.js', 'utf8'), ctx, { filename: 'supplier-finance.js' });
  ctx.window.slOpenLedger = function () {};
  return { ctx: ctx, formValues: formValues };
}

/* AUD-05: نقش buyer نباید بتواند از فرم پرداخت تأمین‌کننده چک شرکتی صادر کند. */
(function () {
  var f = freshContext('buyer');
  f.ctx.setData('ptf_crm_suppliers', [{ cd: 'SUP-1', co: 'تامین‌کننده تست' }]);
  try { f.ctx.window.slPaymentSave('SUP-1', 'IRR'); } catch (e) {}
  var cheques = f.ctx.getData('ptf_crm_cheques');
  assert.ok(!cheques.some(function (c) { return c.ownership === 'company'; }), 'AUD-05: buyer نباید چک شرکتی ثبت کند');
})();

/* رگرسیون: chairman/ceo/commercial باید همچنان مجاز باشند. */
['chairman', 'ceo', 'commercial'].forEach(function (role) {
  var f = freshContext(role);
  f.ctx.setData('ptf_crm_suppliers', [{ cd: 'SUP-1', co: 'تامین‌کننده تست' }]);
  f.ctx.window.slPaymentSave('SUP-1', 'IRR');
  var cheques = f.ctx.getData('ptf_crm_cheques');
  assert.ok(cheques.some(function (c) { return c.ownership === 'company'; }), 'رگرسیون: ' + role + ' باید بتواند چک شرکتی ثبت کند');
});

/* رگرسیون: accountant هم نباید بتواند (مثل buyer، نقش غیرمجاز). */
(function () {
  var f = freshContext('accountant');
  f.ctx.setData('ptf_crm_suppliers', [{ cd: 'SUP-1', co: 'تامین‌کننده تست' }]);
  try { f.ctx.window.slPaymentSave('SUP-1', 'IRR'); } catch (e) {}
  var cheques = f.ctx.getData('ptf_crm_cheques');
  assert.ok(!cheques.some(function (c) { return c.ownership === 'company'; }), 'رگرسیون: accountant هم نباید چک شرکتی ثبت کند');
})();

/* رگرسیون: پرداخت نقدی برای buyer باید همچنان کار کند (فقط چک شرکتی مسدود شده). */
(function () {
  var f = freshContext('buyer');
  f.formValues.slPayMethod = 'cash';
  f.ctx.setData('ptf_crm_suppliers', [{ cd: 'SUP-1', co: 'تامین‌کننده تست' }]);
  f.ctx.window.slPaymentSave('SUP-1', 'IRR');
  var d = f.ctx.getData('ptf_crm_supplier_finance');
  assert.strictEqual((d.payments || []).length, 1, 'رگرسیون: پرداخت نقدی buyer باید دست‌نخورده بماند');
})();

/* رگرسیون: چک ثالث منتقل‌شده تحت تاثیر این گیت قرار نگیرد. */
(function () {
  var f = freshContext('buyer');
  f.formValues.slPayMethod = 'third_party_cheque';
  f.formValues.slThirdCust = ''; f.formValues.slThirdInv = '';
  f.ctx.setData('ptf_crm_customers', []); f.ctx.setData('ptf_crm_invoices', []);
  f.ctx.setData('ptf_crm_suppliers', [{ cd: 'SUP-1', co: 'تامین‌کننده تست' }]);
  f.ctx.window.slPaymentSave('SUP-1', 'IRR');
  var cheques = f.ctx.getData('ptf_crm_cheques');
  assert.ok(cheques.some(function (c) { return c.ownership === 'third_party'; }), 'رگرسیون: چک ثالث منتقل‌شده نباید محدود شود');
})();

console.log('PASS: tester166-v33.2.4-supplier-payment-company-cheque-gate.js (AUD-05)');
