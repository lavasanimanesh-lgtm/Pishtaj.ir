/* AUD-10 fixture (crm/AUDIT-FINANCIAL-SYSTEM-2026-07-29.md) — protects
   saveInv() (official sales invoice registration in rbac.js) from allowing
   two different quotes (offers) to register an invoice with the exact same
   accounting invoice number. supplier-finance.js#slInvoiceSave already had
   this guard (FIN-EX-01); the sales-invoice path never did. */
'use strict';
var fs = require('fs'), vm = require('vm'), assert = require('assert');

function freshContext() {
  var store = {};
  var formValues = {};
  var ctx = {
    console: console, JSON: JSON, Math: Math, Array: Array, Object: Object, String: String, Date: Date,
    localStorage: { getItem: function (k) { return store[k] != null ? store[k] : null; }, setItem: function (k, v) { store[k] = String(v); } },
    escP: function (x) { return String(x == null ? '' : x); },
    genCode: function (p) { return p + '-' + Math.floor(Math.random() * 100000); },
    faDate: function () { return '1405/04/29'; }, faDateTime: function () { return '1405/04/29 10:00'; },
    audit: function () {}, ptfToast: function () {},
    curSession: function () { return { user: 'accountant', name: 'حسابدار' }; },
    curRole: function () { return 'accountant'; }, isSenior: function () { return false; },
    roleDef: function () { return { finance: false }; },
    ptfNum: function (v) { return +String(v).replace(/,/g, '') || 0; },
    alert: function (m) { ctx._lastAlert = m; },
    confirm: function () { return true; }, hideModal: function () {}, notify: function () {},
    setInterval: function () { return 0; }, setTimeout: function () { return 0; },
    _lastAlert: null,
    document: { getElementById: function (id) { return (id in formValues) ? formValues[id] : null; } }
  };
  ctx.getData = function (k) { try { return JSON.parse(ctx.localStorage.getItem(k) || '[]'); } catch (e) { return []; } };
  ctx.setData = function (k, v) { ctx.localStorage.setItem(k, JSON.stringify(v)); };
  ctx.window = ctx;
  ctx.window.renderInvoices = function () {};
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('crm/rbac.js', 'utf8'), ctx, { filename: 'rbac.js' });
  return { ctx: ctx, formValues: formValues };
}

/* AUD-10: دو پیش‌فاکتور مختلف نباید بتوانند شماره‌ی فاکتور یکسان بگیرند. */
(function () {
  var f = freshContext();
  f.ctx.setData('ptf_crm_offers', [{ no: 'CO-1', buyerCo: 'شرکت الف' }, { no: 'CO-2', buyerCo: 'شرکت ب' }]);
  f.ctx.setData('ptf_crm_invoices', [{ cd: 'INV-1', offerNo: 'CO-1', no: 'F-100', amount: 1000000, payments: [] }]);
  f.formValues.nInvNo = { value: 'F-100' };
  f.formValues.nInvAmt = { value: '2000000' };
  f.formValues.nInvVat = { value: '0' };
  f.formValues.nInvDate = { value: '1405/04/29' };
  f.ctx.window.saveInv('CO-2');
  assert.strictEqual(f.ctx.getData('ptf_crm_invoices').length, 1, 'AUD-10: فاکتور با شماره‌ی تکراری نباید ثبت شود');
  assert.ok(f.ctx._lastAlert && f.ctx._lastAlert.indexOf('تکراری') > -1, 'AUD-10: پیام خطا باید نمایش داده شود');
})();

/* رگرسیون: شماره‌ی جدید باید عادی ثبت شود. */
(function () {
  var f = freshContext();
  f.ctx.setData('ptf_crm_offers', [{ no: 'CO-1', buyerCo: 'شرکت الف' }]);
  f.ctx.setData('ptf_crm_invoices', []);
  f.formValues.nInvNo = { value: 'F-200' };
  f.formValues.nInvAmt = { value: '1000000' };
  f.formValues.nInvVat = { value: '0' };
  f.formValues.nInvDate = { value: '1405/04/29' };
  f.ctx.window.saveInv('CO-1');
  var invs = f.ctx.getData('ptf_crm_invoices');
  assert.strictEqual(invs.length, 1, 'رگرسیون: فاکتور جدید باید ثبت شود');
  assert.strictEqual(invs[0].no, 'F-200', 'رگرسیون: شماره درست ذخیره شود');
})();

/* رگرسیون حیاتی: ویرایش فاکتور با همان شماره‌ی خودش نباید به‌عنوان تکراری رد شود. */
(function () {
  var f = freshContext();
  f.ctx.setData('ptf_crm_offers', [{ no: 'CO-1', buyerCo: 'شرکت الف' }]);
  f.ctx.setData('ptf_crm_invoices', [{ cd: 'INV-1', offerNo: 'CO-1', no: 'F-300', amount: 1000000, base: 1000000, vat: 0, invDate: '1405/04/20', payments: [] }]);
  f.ctx.window._invEditCd = 'INV-1';
  f.formValues.nInvNo = { value: 'F-300' };
  f.formValues.nInvAmt = { value: '1500000' };
  f.formValues.nInvVat = { value: '0' };
  f.formValues.nInvDate = { value: '1405/04/20' };
  f.ctx.window.saveInv('CO-1');
  assert.strictEqual(f.ctx.getData('ptf_crm_invoices')[0].amount, 1500000, 'رگرسیون: ویرایش با همان شماره نباید رد شود');
})();

/* رگرسیون: فاکتور ابطال‌شده نباید مانع استفاده‌ی مجدد از شماره شود. */
(function () {
  var f = freshContext();
  f.ctx.setData('ptf_crm_offers', [{ no: 'CO-1', buyerCo: 'شرکت الف' }, { no: 'CO-2', buyerCo: 'شرکت ب' }]);
  f.ctx.setData('ptf_crm_invoices', [{ cd: 'INV-1', offerNo: 'CO-1', no: 'F-400', amount: 1000000, payments: [], status: 'void' }]);
  f.formValues.nInvNo = { value: 'F-400' };
  f.formValues.nInvAmt = { value: '2000000' };
  f.formValues.nInvVat = { value: '0' };
  f.formValues.nInvDate = { value: '1405/04/29' };
  f.ctx.window.saveInv('CO-2');
  var active = f.ctx.getData('ptf_crm_invoices').filter(function (i) { return i.status !== 'void'; });
  assert.strictEqual(active.length, 1, 'رگرسیون: فاکتور ابطال‌شده نباید مانع شود');
})();

/* رگرسیون: تشخیص تکراری باید نسبت به حروف بزرگ/کوچک بی‌تفاوت باشد. */
(function () {
  var f = freshContext();
  f.ctx.setData('ptf_crm_offers', [{ no: 'CO-1', buyerCo: 'شرکت الف' }, { no: 'CO-2', buyerCo: 'شرکت ب' }]);
  f.ctx.setData('ptf_crm_invoices', [{ cd: 'INV-1', offerNo: 'CO-1', no: 'inv-500', amount: 1000000, payments: [] }]);
  f.formValues.nInvNo = { value: 'INV-500' };
  f.formValues.nInvAmt = { value: '2000000' };
  f.formValues.nInvVat = { value: '0' };
  f.formValues.nInvDate = { value: '1405/04/29' };
  f.ctx.window.saveInv('CO-2');
  assert.strictEqual(f.ctx.getData('ptf_crm_invoices').length, 1, 'رگرسیون: تشخیص باید case-insensitive باشد');
})();

console.log('PASS: tester171-v33.2.9-sales-invoice-number-uniqueness.js (AUD-10)');
