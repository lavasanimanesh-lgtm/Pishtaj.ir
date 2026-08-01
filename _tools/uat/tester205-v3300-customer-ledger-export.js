/* S3 — UR-2026-08-01-03/08: خروجی گردش حساب مشتری (PDF/اکسل/چاپ) */
'use strict';
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var code = fs.readFileSync(path.join(BASE, 'customer-finance.js'), 'utf-8');

global.curSession = function () { return { user: 'tester', name: 'تستر حساب' }; };
global._alerts = [];
global.alert = function (m) { global._alerts.push(String(m)); };
global._downloads = [];
global._prints = [];

function makeEl(ov) {
  return Object.assign({ value: '', innerHTML: '', textContent: '', style: {},
    remove: function () {}, insertAdjacentHTML: function () {}, setAttribute: function () {},
    addEventListener: function () {}, querySelectorAll: function () { return []; },
    appendChild: function () {}, classList: { add: function () {}, remove: function () {}, contains: function () { return false; } } }, ov || {});
}
global._domGet = {}; global._domQSA = {}; global._domQuery = {}; global._inserted = [];
global.document = {
  getElementById: function (id) { return global._domGet[id] || makeEl(); },
  querySelector: function (sel) { return global._domQuery[sel] || makeEl(); },
  querySelectorAll: function (sel) { return global._domQSA[sel] || []; },
  createElement: function () { return makeEl({ click: function () {}, href: '' }); },
  head: makeEl(), body: makeEl(), addEventListener: function () {}
};
global.URL = { createObjectURL: function (b) { global._downloads.push(b); return 'blob:test'; } };
global.Blob = function (parts, opts) { this.parts = parts; this.opts = opts; };
global.window.open = function () { return { document: { write: function (h) { global._prints.push(h); }, close: function () {} }, print: function () {} }; };
global._domGet['panels'] = makeEl({ insertAdjacentHTML: function (_, h) { global._inserted.push(h); } });

eval.call(global, code);

/* ---------- دادهٔ پایه ---------- */
setData('ptf_crm_customers', [{ cd: 'C1', co: 'مشتری الف' }]);
setData('ptf_crm_offers', [{ no: 'O1', buyerCd: 'C1', currency: 'IRR', items: [{ name: 'شیر کنترلی', qty: 2, price: 100000, unit: 'عدد' }] }]);
setData('ptf_crm_invoices', [{ cd: 'INV1', no: 'INV-100', offerNo: 'O1', amount: 350000, invDate: '1405/03/10', payments: [{ cd: 'RPAY-1', amt: 100000, t: '1405/03/12' }] }]);
setData('ptf_crm_sales_returns', [{ cd: 'SRET-1', invoiceCd: 'INV1', totalAmount: 50000, reason: 'عدم نیاز مشتری', items: [{ item: 'شیر کنترلی', qty: 1 }], t: '1405/03/15', status: 'approved' }]);

SECTION('ساختار');
T('توابع گردش/خروجی موجودند', code.indexOf('window.cfLedgerRows') > -1 && code.indexOf('window.cfLedgerCsv') > -1 && code.indexOf('window.cfLedgerPrint') > -1);
T('مودال حساب دکمه‌های PDF/اکسل دارد', (function () {
  cfOpen('C1');
  return global._inserted.some(function (h) { return h.indexOf('cfLedgerPrint') > -1 && h.indexOf('cfLedgerCsv') > -1 && h.indexOf('__CF_ACTIONS__') === -1; });
})());

SECTION('ردیف‌های گردش (cfLedgerRows)');
var rows = cfLedgerRows('C1');
T('۳ ردیف: فاکتور، وصولی، مرجوعی', rows.length === 3);
T('فاکتور = بدهکار ۳۵۰,۰۰۰', rows[0].type === 'فاکتور فروش' && rows[0].debit === 350000 && rows[0].credit === 0);
T('وصولی = بستانکار ۱۰۰,۰۰۰', rows[1].type === 'وصولی' && rows[1].credit === 100000 && rows[1].debit === 0);
T('مرجوعی = بستانکار ۵۰,۰۰۰', rows[2].type === 'مرجوعی فروش' && rows[2].credit === 50000);
T('ترتیب زمانی درست است', rows[0].date === '1405/03/10' && rows[1].date === '1405/03/12' && rows[2].date === '1405/03/15');
T('ماندهٔ تجمعی: ۳۵۰ → ۲۵۰ → ۲۰۰', rows[0].balance === 350000 && rows[1].balance === 250000 && rows[2].balance === 200000);

SECTION('خروجی اکسل (cfLedgerCsv)');
cfLedgerCsv('C1');
T('دانلود CSV با BOM و سرستون‌ها انجام شد', (function () {
  if (!global._downloads.length) return false;
  var txt = global._downloads[0].parts[0];
  return txt.indexOf('\uFEFF') === 0 && txt.indexOf('تاریخ') > -1 && txt.indexOf('بدهکار') > -1 && txt.indexOf('بستانکار') > -1 && txt.indexOf('مانده') > -1 && txt.indexOf('مرجوعی فروش') > -1 && txt.indexOf('350000') > -1;
})());

SECTION('خروجی PDF/چاپ (cfLedgerPrint)');
cfLedgerPrint('C1');
T('سند چاپی با عنوان و جدول ساخته شد', (function () {
  return global._prints.length === 1 && global._prints[0].indexOf('گردش حساب مشتری') > -1 && global._prints[0].indexOf('<table>') > -1 && global._prints[0].indexOf('فاکتور فروش') > -1;
})());

DONE('tester205-v3300-customer-ledger-export');
