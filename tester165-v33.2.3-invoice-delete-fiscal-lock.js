/* AUD-04 fixture (crm/AUDIT-FINANCIAL-SYSTEM-2026-07-29.md) — protects the
   "🗑 حذف فاکتور" button (slInvoiceDelete, Sprint 270) from bypassing the
   fiscal-year lock guard that slInvoiceVoid/slInvoiceEdit/slPaymentEdit
   already had. Before this fix, a locked-year invoice could still be
   soft-deleted (status set to 'void') through this second entry point. */
'use strict';
var fs = require('fs'), vm = require('vm'), assert = require('assert');

function freshContext() {
  var store = {};
  var ctx = {
    console: console, JSON: JSON, Math: Math, Array: Array, Object: Object, String: String, Date: Date,
    localStorage: { getItem: function (k) { return store[k] != null ? store[k] : null; }, setItem: function (k, v) { store[k] = String(v); } },
    escP: function (x) { return String(x == null ? '' : x); },
    genCode: function (p) { return p + '-' + Math.floor(Math.random() * 100000); },
    faDate: function () { return '1405/04/29'; },
    faDateTime: function () { return '1405/04/29 10:00'; },
    audit: function () {}, ptfToast: function () {},
    curRole: function () { return 'admin'; }, isSenior: function () { return true; },
    roleDef: function () { return { buyPrice: true }; },
    curSession: function () { return { user: 'admin', name: 'ادمین' }; },
    confirm: function () { return true; }, alert: function () {},
    ptfISOToJ: function (iso) { return iso; },
    document: { getElementById: function () { return null; }, querySelectorAll: function () { return []; } }
  };
  ctx.getData = function (k) { try { return JSON.parse(ctx.localStorage.getItem(k) || (k === 'ptf_crm_supplier_finance' ? '{}' : '[]')); } catch (e) { return k === 'ptf_crm_supplier_finance' ? {} : []; } };
  ctx.setData = function (k, v) { ctx.localStorage.setItem(k, JSON.stringify(v)); };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('crm/supplier-finance.js', 'utf8'), ctx, { filename: 'supplier-finance.js' });
  ctx.window.slOpenLedger = function () {};
  ctx.window.slRefreshSupplierPanel = function () {};
  return ctx;
}

/* AUD-04: سال قفل - slInvoiceDelete باید مسدود شود (پیش از رفع، این باگ بود). */
(function () {
  var ctx = freshContext();
  ctx.setData('ptf_crm_fiscal_snapshots', [{ cd: 'FSY-1', year: '1404', locked: true }]);
  ctx.setData('ptf_crm_suppliers', [{ cd: 'SUP-1', co: 'تامین‌کننده' }]);
  ctx.setData('ptf_crm_supplier_finance', { schema: 1, invoices: [{ cd: 'SFINV-1', supplierCd: 'SUP-1', no: 'F-100', dateISO: '1404-05-01', amount: 10000000, amountIrr: 10000000, cur: 'IRR', status: 'open' }], payments: [] });
  ctx.window.slInvoiceDelete('SFINV-1');
  assert.strictEqual(ctx.getData('ptf_crm_supplier_finance').invoices[0].status, 'open', 'AUD-04: حذف فاکتور روی سال قفل‌شده باید مسدود شود');
})();

/* رگرسیون: سال باز - slInvoiceDelete باید مثل قبل کار کند. */
(function () {
  var ctx = freshContext();
  ctx.setData('ptf_crm_fiscal_snapshots', []);
  ctx.setData('ptf_crm_suppliers', [{ cd: 'SUP-1', co: 'تامین‌کننده' }]);
  ctx.setData('ptf_crm_supplier_finance', { schema: 1, invoices: [{ cd: 'SFINV-2', supplierCd: 'SUP-1', no: 'F-200', dateISO: '1405-05-01', amount: 5000000, amountIrr: 5000000, cur: 'IRR', status: 'open' }], payments: [] });
  ctx.window.slInvoiceDelete('SFINV-2');
  assert.strictEqual(ctx.getData('ptf_crm_supplier_finance').invoices[0].status, 'void', 'رگرسیون: حذف فاکتور روی سال باز باید همچنان کار کند');
})();

/* رگرسیون: slInvoiceVoid همچنان روی سال قفل مسدود می‌شود. */
(function () {
  var ctx = freshContext();
  ctx.setData('ptf_crm_fiscal_snapshots', [{ cd: 'FSY-1', year: '1404', locked: true }]);
  ctx.setData('ptf_crm_suppliers', [{ cd: 'SUP-1', co: 'تامین‌کننده' }]);
  ctx.setData('ptf_crm_supplier_finance', { schema: 1, invoices: [{ cd: 'SFINV-3', supplierCd: 'SUP-1', no: 'F-300', dateISO: '1404-05-01', amount: 1000000, amountIrr: 1000000, cur: 'IRR', status: 'open' }], payments: [] });
  ctx.window.slInvoiceVoid('SFINV-3');
  assert.strictEqual(ctx.getData('ptf_crm_supplier_finance').invoices[0].status, 'open', 'رگرسیون: slInvoiceVoid دست‌نخورده بماند');
})();

/* رگرسیون: slPaymentDelete (که به slPaymentVoid دلگیت می‌کند) همچنان مسدود می‌شود. */
(function () {
  var ctx = freshContext();
  ctx.setData('ptf_crm_fiscal_snapshots', [{ cd: 'FSY-1', year: '1404', locked: true }]);
  ctx.setData('ptf_crm_suppliers', [{ cd: 'SUP-1', co: 'تامین‌کننده' }]);
  ctx.setData('ptf_crm_supplier_finance', { schema: 1, invoices: [], payments: [{ cd: 'SFPAY-1', supplierCd: 'SUP-1', dateISO: '1404-05-01', amount: 1000000, amountIrr: 1000000, cur: 'IRR', status: 'posted', allocations: [] }] });
  ctx.window.slPaymentDelete('SFPAY-1');
  assert.strictEqual(ctx.getData('ptf_crm_supplier_finance').payments[0].status, 'posted', 'رگرسیون: slPaymentDelete دست‌نخورده بماند');
})();

console.log('PASS: tester165-v33.2.3-invoice-delete-fiscal-lock.js (AUD-04)');
