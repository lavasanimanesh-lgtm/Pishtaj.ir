/* AUD-08 fixture (crm/AUDIT-FINANCIAL-SYSTEM-2026-07-29.md) — protects the
   "اعتبار نزد تأمین‌کنندگان" (supplier credit) card on the fiscal-year
   dashboard from silently showing 0 regardless of real data. Before this
   fix, fiscal.js checked `typeof balance === 'function'`, but balance() is
   a private function inside supplier-finance.js's IIFE and is never exposed
   on window — so that branch was always false and the dead-code fallback
   (which computes nothing) always ran instead. */
'use strict';
var fs = require('fs'), vm = require('vm'), assert = require('assert');

function freshContext() {
  var store = {};
  var capturedHtml = '';
  var fakeEl = {};
  Object.defineProperty(fakeEl, 'outerHTML', { set: function (v) { capturedHtml = v; }, get: function () { return capturedHtml; } });
  var ctx = {
    console: console, JSON: JSON, Math: Math, Array: Array, Object: Object, String: String, Date: Date,
    localStorage: { getItem: function (k) { return store[k] != null ? store[k] : null; }, setItem: function (k, v) { store[k] = String(v); } },
    escP: function (x) { return String(x == null ? '' : x); },
    genCode: function (p) { return p + '-' + Math.floor(Math.random() * 100000); },
    faDate: function () { return '1405/04/29'; }, faDateTime: function () { return '1405/04/29 10:00'; },
    audit: function () {}, ptfToast: function () {},
    curSession: function () { return { user: 'admin', name: 'ادمین' }; },
    curRole: function () { return 'admin'; }, isSenior: function () { return true; },
    roleDef: function () { return { buyPrice: true }; },
    dedupNorm: function (v) { return String(v || '').trim().toLowerCase(); },
    setInterval: function () { return 0; }, setTimeout: function () { return 0; },
    document: { getElementById: function (id) { return id === 'fiscalBox' ? fakeEl : null; } }
  };
  ctx.getData = function (k) { try { return JSON.parse(ctx.localStorage.getItem(k) || (k === 'ptf_crm_supplier_finance' ? '{}' : '[]')); } catch (e) { return k === 'ptf_crm_supplier_finance' ? {} : []; } };
  ctx.setData = function (k, v) { ctx.localStorage.setItem(k, JSON.stringify(v)); };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('crm/supplier-finance.js', 'utf8'), ctx, { filename: 'supplier-finance.js' });
  vm.runInContext(fs.readFileSync('crm/fiscal.js', 'utf8'), ctx, { filename: 'fiscal.js' });
  return { ctx: ctx, getHtml: function () { return capturedHtml; } };
}

function setupBaseData(ctx) {
  ['ptf_crm_cheques', 'ptf_crm_petty', 'ptf_crm_fiscal_snapshots', 'ptf_crm_projects', 'ptf_crm_deals', 'ptf_crm_opex', 'ptf_crm_shareholders', 'ptf_crm_invoices'].forEach(function (k) { ctx.setData(k, []); });
}

/* AUD-08: تابع مرجع باید اعتبار واقعی را محاسبه کند. */
(function () {
  var f = freshContext();
  f.ctx.setData('ptf_crm_suppliers', [{ cd: 'SUP-1', co: 'شرکت آزمایشی' }]);
  f.ctx.setData('ptf_crm_supplier_finance', { schema: 1, invoices: [], payments: [{ cd: 'SFPAY-1', supplierCd: 'SUP-1', amount: 5000000, cur: 'IRR', status: 'posted', allocations: [] }] });
  assert.strictEqual(f.ctx.window.slSupplierOpenTotalsIRR().credit, 5000000, 'AUD-08: تابع مرجع باید اعتبار واقعی را محاسبه کند');
})();

/* AUD-08 (end-to-end): کارت داشبورد سال مالی باید مبلغ واقعی را نشان دهد، نه صفر. */
(function () {
  var f = freshContext();
  f.ctx.setData('ptf_crm_suppliers', [{ cd: 'SUP-1', co: 'شرکت آزمایشی' }]);
  f.ctx.setData('ptf_crm_supplier_finance', { schema: 1, invoices: [], payments: [{ cd: 'SFPAY-1', supplierCd: 'SUP-1', amount: 5000000, cur: 'IRR', status: 'posted', allocations: [] }] });
  setupBaseData(f.ctx);
  f.ctx.window._fiscalYear = '1405';
  f.ctx.window.ptfFiscalRender();
  var html = f.getHtml();
  assert.ok(html.indexOf((5000000).toLocaleString('fa-IR')) > -1, 'AUD-08: کارت داشبورد باید مبلغ واقعی اعتبار را نمایش دهد');
})();

/* رگرسیون: بدون تأمین‌کننده/اعتبار، رندر بدون خطا و با صفر انجام شود. */
(function () {
  var f = freshContext();
  f.ctx.setData('ptf_crm_suppliers', []);
  f.ctx.setData('ptf_crm_supplier_finance', { schema: 1, invoices: [], payments: [] });
  setupBaseData(f.ctx);
  f.ctx.window._fiscalYear = '1405';
  f.ctx.window.ptfFiscalRender();
  assert.ok(f.getHtml().indexOf('اعتبار نزد تأمین‌کنندگان') > -1, 'رگرسیون: بدون داده، رندر باید بدون خطا انجام شود');
})();

/* رگرسیون: بدهی (نه اعتبار) نباید با این تابع اشتباه گرفته شود. */
(function () {
  var f = freshContext();
  f.ctx.setData('ptf_crm_suppliers', [{ cd: 'SUP-1', co: 'شرکت آزمایشی' }]);
  f.ctx.setData('ptf_crm_supplier_finance', { schema: 1, invoices: [{ cd: 'SFINV-1', supplierCd: 'SUP-1', amount: 1000000, amountIrr: 1000000, cur: 'IRR', status: 'open' }], payments: [] });
  var totals = f.ctx.window.slSupplierOpenTotalsIRR();
  assert.strictEqual(totals.credit, 0, 'رگرسیون: بدون اعتبار واقعی، credit باید صفر باشد');
  assert.strictEqual(totals.debt, 1000000, 'رگرسیون: بدهی باید جدا محاسبه شود');
})();

/* رگرسیون: چند تأمین‌کننده باید صحیح جمع شوند. */
(function () {
  var f = freshContext();
  f.ctx.setData('ptf_crm_suppliers', [{ cd: 'SUP-1', co: 'اول' }, { cd: 'SUP-2', co: 'دوم' }]);
  f.ctx.setData('ptf_crm_supplier_finance', { schema: 1, invoices: [], payments: [
    { cd: 'P1', supplierCd: 'SUP-1', amount: 2000000, cur: 'IRR', status: 'posted', allocations: [] },
    { cd: 'P2', supplierCd: 'SUP-2', amount: 3000000, cur: 'IRR', status: 'posted', allocations: [] }
  ] });
  assert.strictEqual(f.ctx.window.slSupplierOpenTotalsIRR().credit, 5000000, 'رگرسیون: اعتبار چند تأمین‌کننده باید جمع شود');
})();

console.log('PASS: tester169-v33.2.7-fiscal-supplier-credit-fix.js (AUD-08)');
