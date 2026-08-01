/* S2 — برگشت فروش + اعتبار مشتری (جریان ۷۱ کامیت برنچ 019fb322) */
'use strict';
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var code = fs.readFileSync(path.join(BASE, 'customer-finance.js'), 'utf-8');

/* ---------- محیط شبیه‌سازی ---------- */
global.curSession = function () { return { user: 'tester', name: 'تستر حساب' }; };
global._alerts = [];
global.alert = function (m) { global._alerts.push(String(m)); };
global._surplusCalls = [];
global.ptfSurplusAdd = function (cd, qty, loc, ref, note) {
  global._surplusCalls.push({ cd: cd, qty: qty, loc: loc, ref: ref, note: note });
  return { cd: 'STK-' + global._surplusCalls.length };
};

function makeEl(ov) {
  return Object.assign({ value: '', innerHTML: '', textContent: '', style: {},
    remove: function () {}, insertAdjacentHTML: function () {}, setAttribute: function () {},
    addEventListener: function () {}, querySelectorAll: function () { return []; },
    appendChild: function () {}, classList: { add: function () {}, remove: function () {}, contains: function () { return false; } } }, ov || {});
}
global._domGet = {}; global._domQSA = {}; global._domQuery = {};
global.document = {
  getElementById: function (id) { return global._domGet[id] || makeEl(); },
  querySelector: function (sel) { return global._domQuery[sel] || makeEl(); },
  querySelectorAll: function (sel) { return global._domQSA[sel] || []; },
  createElement: function () { return makeEl(); },
  head: makeEl(), body: makeEl(), addEventListener: function () {}
};

eval.call(global, code); /* کل IIFE فایل — همهٔ window.* ها تعریف می‌شوند */

/* ---------- دادهٔ پایه ---------- */
setData('ptf_crm_customers', [{ cd: 'C1', co: 'مشتری الف' }]);
setData('ptf_crm_offers', [{ no: 'O1', buyerCd: 'C1', currency: 'IRR', items: [
  { name: 'شیر کنترلی', qty: 2, price: 100000, unit: 'عدد', pcode: 'P1' },
  { name: 'ترانسمیتر', qty: 3, price: 50000, unit: 'عدد' }
] }]);
setData('ptf_crm_invoices', [{ cd: 'INV1', no: 'INV-100', offerNo: 'O1', amount: 350000, payments: [{ amt: 350000, status: 'paid' }] }]);
setData('ptf_crm_sales_returns', []);
setData('ptf_crm_products', [{ cd: 'P1', nm: 'شیر کنترلی' }]);

SECTION('ساختار');
T('ماژول حساب مشتری شامل برگشت فروش است', code.indexOf('window.cfSalesReturnPreviewSelected') > -1 && code.indexOf('ptf_crm_sales_returns') > -1);
T('سند برگشت در backup/sync تعریف شده', (function () {
  var b = fs.readFileSync(path.join(BASE, 'backup.js'), 'utf-8');
  var s = fs.readFileSync(path.join(BASE, 'sync.js'), 'utf-8');
  var a = fs.readFileSync(path.resolve(BASE, '../api/crm.php'), 'utf-8');
  return b.indexOf('ptf_crm_sales_returns') > -1 && s.indexOf('ptf_crm_sales_returns') > -1 && a.indexOf('ptf_crm_sales_returns') > -1;
})());

SECTION('ثبت مرجوعی — محاسبه مبلغ و اعتبار');
/* انتخاب: قلم ۰ با ۲ عدد (کل) — مجموع خط ۲۰۰,۰۰۰ از ۳۵۰,۰۰۰ */
global._domQSA['#cfReturnDlg .cfReturnLine:checked'] = [{ value: '0' }];
global._domQuery['#cfReturnDlg .cfReturnQty[data-idx="0"]'] = { value: '2' };
global._domGet['cfReturnReason'] = { value: 'عدم نیاز مشتری' };
global._domGet['cfReturnDisposition'] = { value: 'supplier' };
global._domGet['cfReturnNote'] = { value: '' };
cfSalesReturnPreviewSelected('INV1');
var returns = getData('ptf_crm_sales_returns');
T('سند مرجوعی با مبلغ ۲۰۰,۰۰۰ ثبت شد', returns.length === 1 && returns[0].totalAmount === 200000);
T('اعتبار مشتری = ۲۰۰,۰۰۰ (پرداخت کامل + مرجوعی - مبلغ)', returns[0].creditAmount === 200000);
T('متادیتای سند کامل است', returns[0].invoiceCd === 'INV1' && returns[0].customerCd === 'C1' && returns[0].offerNo === 'O1' && returns[0].status === 'approved' && returns[0].reason === 'عدم نیاز مشتری' && returns[0].items[0].qty === 2 && returns[0].items[0].productCd === 'P1');
T('سرنوشت غیر انبار: stockStatus ندارد', returns[0].stockStatus == null);

SECTION('اثر روی حساب مشتری (cfAccountRows)');
var rows = cfAccountRows('مشتری الف');
T('مطالبات باز صفر و اعتبار ۲۰۰,۰۰۰ شد', rows.length === 1 && rows[0].balance === 0 && rows[0].credit === 200000);

SECTION('ثبت مرجوعی دوم — مرجع برگشتی قبلی در مانده لحاظ می‌شود');
/* فاکتور دوم نیمه‌پرداخت */
setData('ptf_crm_invoices', [{ cd: 'INV1', no: 'INV-100', offerNo: 'O1', amount: 350000, payments: [{ amt: 350000, status: 'paid' }] },
  { cd: 'INV2', no: 'INV-101', offerNo: 'O1', amount: 350000, payments: [{ amt: 100000, status: 'paid' }] }]);
global._domQSA['#cfReturnDlg .cfReturnLine:checked'] = [{ value: '1' }];
global._domQuery['#cfReturnDlg .cfReturnQty[data-idx="1"]'] = { value: '1' };
cfSalesReturnPreviewSelected('INV2');
returns = getData('ptf_crm_sales_returns');
T('مرجوعی دوم با مبلغ ۵۰,۰۰۰ ثبت شد (قلم ۱ × ۱ عدد)', returns.length === 2 && returns[0].invoiceCd === 'INV2' && returns[0].totalAmount === 50000);
T('اعتبار این سند صفر است (پرداخت ۱۰۰هزار < مبلغ ۳۵۰هزار)', returns[0].creditAmount === 0);
T('BUG-001 رفع شد: مانده و اعتبار ناخالص (هرکدام ۲۰۰هزار) نمایش داده می‌شوند + خالص صفر', (function () { var r = cfAccountRows('مشتری الف'); return r.length === 1 && r[0].balance === 200000 && r[0].credit === 200000 && r[0].net === 0; })());

SECTION('گاردها');
T('دلیل الزامی است', (function () {
  global._alerts.length = 0;
  global._domGet['cfReturnReason'] = { value: '' };
  var before = getData('ptf_crm_sales_returns').length;
  cfSalesReturnPreviewSelected('INV2');
  return global._alerts.length === 1 && getData('ptf_crm_sales_returns').length === before;
})());
T('مقدار صفر رد می‌شود', (function () {
  global._alerts.length = 0;
  global._domGet['cfReturnReason'] = { value: 'سایر' };
  global._domQSA['#cfReturnDlg .cfReturnLine:checked'] = [{ value: '1' }];
  global._domQuery['#cfReturnDlg .cfReturnQty[data-idx="1"]'] = { value: '0' };
  var before = getData('ptf_crm_sales_returns').length;
  cfSalesReturnPreviewSelected('INV2');
  return global._alerts.length === 1 && getData('ptf_crm_sales_returns').length === before;
})());

SECTION('گارد ناسازگاری مبلغ فاکتور تک‌خط');
setData('ptf_crm_offers', [{ no: 'O2', buyerCd: 'C1', currency: 'IRR', items: [{ name: 'فشارسنج', qty: 1, price: 200000, unit: 'عدد' }] }]);
setData('ptf_crm_invoices', [{ cd: 'INV3', no: 'INV-102', offerNo: 'O2', amount: 999999, payments: [] }]);
global._alerts.length = 0;
global._domQSA['#cfReturnDlg .cfReturnLine:checked'] = [{ value: '0' }];
global._domQuery['#cfReturnDlg .cfReturnQty[data-idx="0"]'] = { value: '1' };
global._domGet['cfReturnReason'] = { value: 'عدم تأیید مشتری' };
cfSalesReturnPreviewSelected('INV3');
T('مبلغ ناسازگار → هشدار و عدم ثبت', global._alerts.length === 1 && global._alerts[0].indexOf('سازگار نیست') > -1 && getData('ptf_crm_sales_returns').filter(function (r) { return r.invoiceCd === 'INV3'; }).length === 0);

SECTION('سرنوشت انبار — ورود به موجودی');
setData('ptf_crm_offers', [{ no: 'O3', buyerCd: 'C1', currency: 'IRR', items: [{ name: 'فلنج', qty: 4, price: 25000, unit: 'عدد', pcode: 'P2' }] }]);
setData('ptf_crm_invoices', [{ cd: 'INV4', no: 'INV-103', offerNo: 'O3', amount: 100000, payments: [] }]);
global._alerts.length = 0; global._surplusCalls.length = 0;
global._domQSA['#cfReturnDlg .cfReturnLine:checked'] = [{ value: '0' }];
global._domQuery['#cfReturnDlg .cfReturnQty[data-idx="0"]'] = { value: '2' };
global._domGet['cfReturnDisposition'] = { value: 'stock' };
cfSalesReturnPreviewSelected('INV4');
var r4 = getData('ptf_crm_sales_returns')[0];
T('با کد کالا → وارد موجودی شد (stocked)', r4.stockStatus === 'stocked' && r4.stockRefs.length === 1 && global._surplusCalls.length === 1 && global._surplusCalls[0].cd === 'P2' && global._surplusCalls[0].qty === 2);

SECTION('سرنوشت انبار — کالای بدون کد → نیازمند تعریف');
setData('ptf_crm_offers', [{ no: 'O4', buyerCd: 'C1', currency: 'IRR', items: [{ name: 'کالای ناشناخته', qty: 1, price: 10000, unit: 'عدد' }] }]);
setData('ptf_crm_invoices', [{ cd: 'INV5', no: 'INV-104', offerNo: 'O4', amount: 10000, payments: [] }]);
global._alerts.length = 0; global._surplusCalls.length = 0;
global._domQSA['#cfReturnDlg .cfReturnLine:checked'] = [{ value: '0' }];
global._domQuery['#cfReturnDlg .cfReturnQty[data-idx="0"]'] = { value: '1' };
cfSalesReturnPreviewSelected('INV5');
var r5 = getData('ptf_crm_sales_returns')[0];
T('بدون کد و بدون تطبیق نام → pending_product_definition', r5.stockStatus === 'pending_product_definition' && r5.stockPendingItems.length === 1 && global._surplusCalls.length === 0);

DONE('tester200-v3300-sales-returns');
