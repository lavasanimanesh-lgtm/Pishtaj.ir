/* tester678 — v34.39.23 (SUP-FX-RATE-EDIT)
   ویرایش فاکتور و پرداخت ارزی نرخ تسعیر را می‌گیرد و amountIrr را دوباره حساب می‌کند.
   ارز سند عوض نمی‌شود. فاکتور ریالی فیلد نرخ ندارد. سال قفل، پیوست و manualAmountEdit می‌مانند. */
'use strict';
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var assert = require('assert');
var root = path.resolve(__dirname, '../..');
var sf = fs.readFileSync(path.join(root, 'crm/supplier-finance.js'), 'utf8');

assert.ok(sf.indexOf('SUP-FX-RATE-EDIT') > -1, 'rate-edit marker');
assert.ok(/if \(\(initial\.cur \|\| 'IRR'\) !== 'IRR'\) invEditFields\.push\(\{id:'rate'/.test(sf), 'invoice edit adds rate only for FX');
assert.ok(/if \(\(initial\.cur \|\| 'IRR'\) !== 'IRR'\) payEditFields\.push\(\{id:'rate'/.test(sf), 'payment edit adds rate only for FX');
assert.ok(/if \(Math\.round\(\+initial\.amount \|\| 0\) !== Math\.round\(amt\)\) i\.manualAmountEdit = true/.test(sf), 'manualAmountEdit still follows amount, not rate');
var invEdit = sf.indexOf('window.slInvoiceEdit = function');
var payEdit = sf.indexOf('window.slPaymentEdit = function');
assert.ok(invEdit > -1 && payEdit > invEdit);
assert.ok(sf.indexOf('ptfDialog({', invEdit) < sf.indexOf("attachUploadWidget('slInvEditFilesUp'", invEdit));
assert.ok(sf.indexOf('ptfDialog({', payEdit) < sf.indexOf("attachUploadWidget('slPayEditFilesUp'", payEdit));
assert.ok(sf.indexOf("var d = data(), i = fileRecord('invoice'", invEdit) > -1);
assert.ok(sf.indexOf("var d=data(), p=fileRecord('payment'", payEdit) > -1);

function el() {
  return { value: '', innerHTML: '', style: {}, insertAdjacentHTML: function () {}, closest: function () { return null; }, querySelector: function () { return null; }, remove: function () {} };
}
function boot(store) {
  var alerts = [];
  var ctx = {
    console: console, JSON: JSON, Math: Math, Date: Date, Object: Object, Array: Array, String: String, Number: Number,
    parseInt: parseInt, isFinite: isFinite, setTimeout: function () { return 0; },
    localStorage: {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
      setItem: function (k, v) { store[k] = String(v); }
    },
    document: {
      getElementById: function (id) { return id === 'panels' ? el() : null; },
      querySelector: function () { return null; },
      querySelectorAll: function () { return []; }
    },
    escP: function (x) { return String(x == null ? '' : x); },
    ptfOnClickArg: function (x) { return String(x == null ? '' : x); },
    genCode: function (p) { return p + '-X'; },
    faDate: function () { return '1405/06/02'; },
    faDateTime: function () { return '1405/06/02 12:00'; },
    curRole: function () { return 'admin'; },
    isSenior: function () { return true; },
    roleDef: function () { return { buyPrice: true, finance: true }; },
    curSession: function () { return { name: 'مالی', user: 'fin' }; },
    audit: function () {}, ptfToast: function () {},
    alert: function (m) { alerts.push(String(m)); },
    confirm: function () { return true; },
    ptfJToISO: function (j) { return String(j || '').indexOf('1404') === 0 ? '2026-03-01' : '2026-08-20'; },
    ptfISOToJ: function () { return '1405/05/29'; },
    ptfNum: function (v) { return +String(v || '').replace(/[^\d.-]/g, '') || 0; },
    ptfDialog: function (opts) { ctx._dlg = opts; }
  };
  ctx.window = ctx;
  ctx._alerts = alerts;
  ctx.getData = function (k) {
    try {
      var raw = ctx.localStorage.getItem(k);
      if (!raw) return k === 'ptf_crm_supplier_finance' ? { invoices: [], payments: [], adjustments: [] } : [];
      return JSON.parse(raw);
    } catch (e) { return []; }
  };
  ctx.setData = function (k, v) { ctx.localStorage.setItem(k, JSON.stringify(v)); return true; };
  vm.createContext(ctx);
  vm.runInContext(sf, ctx, { filename: 'supplier-finance.js' });
  return ctx;
}

var store = {};
var ctx = boot(store);
ctx.setData('ptf_crm_suppliers', [{ cd: 'SUP-1', co: 'تأمین ارزی' }]);
['ptf_crm_payables', 'ptf_crm_fiscal_snapshots', 'ptf_crm_cheques', 'ptf_crm_invoices', 'ptf_crm_offers', 'ptf_crm_customers', 'ptf_crm_buycmp'].forEach(function (k) { ctx.setData(k, []); });
ctx.setData('ptf_crm_supplier_finance', {
  schema: 1,
  invoices: [
    { cd: 'SFINV-1', supplierCd: 'SUP-1', no: 'FX-100', dateISO: '2026-08-20', dateFa: '1405/05/29', cur: 'USD', rate: 500000, amount: 1000, amountIrr: 500000000, status: 'open', files: [{ key: 'k1', name: 'a.pdf' }] },
    { cd: 'SFINV-IRR', supplierCd: 'SUP-1', no: 'IRR-1', dateISO: '2026-08-20', dateFa: '1405/05/29', cur: 'IRR', rate: 1, amount: 25000000, amountIrr: 25000000, status: 'open', files: [] }
  ],
  payments: [{ cd: 'SFPAY-1', supplierCd: 'SUP-1', dateISO: '2026-08-25', dateFa: '1405/06/03', cur: 'USD', rate: 520000, amount: 400, amountIrr: 208000000, method: 'bank', allocations: [{ invoiceCd: 'SFINV-1', amount: 400 }], unallocated: 0, status: 'posted', files: [{ key: 'p1', name: 'r.pdf' }] }],
  adjustments: []
});

ctx.slInvoiceEdit('SFINV-1');
assert.ok(ctx._dlg.fields.some(function (f) { return f.id === 'rate' && +f.value === 500000; }), 'FX invoice edit shows current rate');
assert.ok(!ctx._dlg.fields.some(function (f) { return f.id === 'cur'; }), 'currency is not editable');
ctx._dlg.onOk({ no: 'FX-100', date: '1405/05/29', amount: 1000, rate: 900000, note: 'فقط نرخ', isOfficial: '' });
var inv = ctx.getData('ptf_crm_supplier_finance').invoices[0];
assert.strictEqual(inv.cur, 'USD');
assert.strictEqual(inv.rate, 900000);
assert.strictEqual(inv.amount, 1000);
assert.strictEqual(inv.amountIrr, 900000000);
assert.strictEqual(inv.manualAmountEdit, undefined, 'rate-only edit must not set manualAmountEdit');
assert.strictEqual(inv.files[0].key, 'k1', 'attachment survives rate edit');

ctx.slInvoiceEdit('SFINV-1');
ctx._alerts.length = 0;
ctx._dlg.onOk({ no: 'FX-100', date: '1405/05/29', amount: 1000, rate: 0, note: '', isOfficial: '' });
inv = ctx.getData('ptf_crm_supplier_finance').invoices[0];
assert.strictEqual(inv.rate, 900000, 'zero rate is rejected');
assert.ok(ctx._alerts.length > 0);

ctx.slInvoiceEdit('SFINV-1');
ctx._dlg.onOk({ no: 'FX-100', date: '1405/05/29', amount: 1200, rate: 900000, note: 'مبلغ', isOfficial: '' });
inv = ctx.getData('ptf_crm_supplier_finance').invoices[0];
assert.strictEqual(inv.amount, 1200);
assert.strictEqual(inv.amountIrr, 1080000000);
assert.strictEqual(inv.manualAmountEdit, true);

ctx.slInvoiceEdit('SFINV-IRR');
assert.ok(!ctx._dlg.fields.some(function (f) { return f.id === 'rate'; }), 'IRR invoice edit has no rate field');
ctx._dlg.onOk({ no: 'IRR-1', date: '1405/05/29', amount: 26000000, note: '', isOfficial: '' });
var irr = ctx.getData('ptf_crm_supplier_finance').invoices[1];
assert.strictEqual(irr.cur, 'IRR');
assert.strictEqual(irr.amountIrr, 26000000);
assert.strictEqual(irr.rate, 1);

ctx.slPaymentEdit('SFPAY-1');
assert.ok(ctx._dlg.fields.some(function (f) { return f.id === 'rate' && +f.value === 520000; }));
ctx._dlg.onOk({ date: '1405/06/03', amount: 400, rate: 610000, note: 'نرخ پرداخت' });
var pay = ctx.getData('ptf_crm_supplier_finance').payments[0];
assert.strictEqual(pay.cur, 'USD');
assert.strictEqual(pay.rate, 610000);
assert.strictEqual(pay.amountIrr, 244000000);
assert.strictEqual(pay.allocations[0].amount, 400, 'FX allocation is not rewritten in rials');
assert.strictEqual(pay.files[0].key, 'p1');
assert.notStrictEqual(pay.rate, inv.rate, 'payment rate stays independent of invoice rate');

ctx._alerts.length = 0;
ctx.slPaymentEdit('SFPAY-1');
ctx._dlg.onOk({ date: '1405/06/03', amount: 400, rate: 0, note: '' });
pay = ctx.getData('ptf_crm_supplier_finance').payments[0];
assert.strictEqual(pay.rate, 610000);
assert.ok(ctx._alerts.length > 0);

ctx.setData('ptf_crm_fiscal_snapshots', [{ year: '1405', locked: true }]);
ctx.localStorage.setItem('ptf_crm_fiscal_snapshots', JSON.stringify([{ year: '1405', locked: true }]));
ctx._dlg = null;
ctx._alerts.length = 0;
ctx.slInvoiceEdit('SFINV-1');
assert.strictEqual(ctx._dlg, null, 'locked year blocks invoice edit');
assert.ok(ctx._alerts.some(function (m) { return m.indexOf('قفل') > -1; }));
var locked = ctx.getData('ptf_crm_supplier_finance').invoices[0];
assert.strictEqual(locked.rate, 900000);

var version = JSON.parse(fs.readFileSync(path.join(root, 'VERSION.json'), 'utf8')).crm_version;
assert.strictEqual(version, 'v34.39.23');
console.log('PASS tester678 v34.39.23 supplier fx rate edit');
