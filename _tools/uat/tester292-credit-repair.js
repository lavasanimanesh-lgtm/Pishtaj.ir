/* tester292 — v33.12.0 (CREDIT-REPAIR + HUB-TAXPLANNER):
 * 1) اعتبار مشتری: تطبیق مقاوم مرجوعی↔فاکتور (مرجوعی قدیمی بدون invoiceCd دیگر گم نمی‌شود)
 *    + cfRepairReturnLinks (ترمیم خودکار) + cfCreditAudit (گزارش اجزا)
 * 2) «داشبورد برنامه‌ریزی فصلی مالیات» فقط در تب سال مالی (نه همهٔ تب‌ها)
 * 3) دارک‌مود برای slLiquidity و ptfTaxPlannerBox
 */
'use strict';
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var cf = fs.readFileSync(path.join(BASE, 'customer-finance.js'), 'utf-8');
var hub = fs.readFileSync(path.join(BASE, 'financehub.js'), 'utf-8');

/* ---------- استاب‌ها ---------- */
global.curSession = function () { return { user: 'u1', name: 'علی' }; };
global.curRole = function () { return 'admin'; };
global.faDate = function () { return '1405/05/11'; };
global.faDateTime = function () { return '1405/05/11 10:00'; };
global.genCode = function (p) { return p + '-' + (++global._cdc); };
global._cdc = 0;
global.audit = function () {};
global.ptfToast = function () {};
global.alert = function () {};
global.confirm = function () { return true; };
global.ptfCanSeeLedger = function () { return true; };
global.ptfSurplusAdd = function () { return { cd: 'STK1' }; };
function makeEl(ov) {
  return Object.assign({ value: '', innerHTML: '', textContent: '', style: {},
    remove: function () {}, insertAdjacentHTML: function () {}, setAttribute: function () {},
    addEventListener: function () {}, querySelectorAll: function () { return []; }, querySelector: function () { return null; },
    appendChild: function () {}, options: [], checked: false,
    classList: { add: function () {}, remove: function () {}, contains: function () { return false; } } }, ov || {});
}
global._domGet = {};
global.document = {
  getElementById: function (id) { return global._domGet[id] || makeEl(); },
  querySelector: function () { return makeEl(); },
  querySelectorAll: function () { return []; },
  createElement: function () { return makeEl(); },
  head: makeEl({ appendChild: function () {} }), body: makeEl({ insertAdjacentHTML: function () {} }),
  addEventListener: function () {}
};
global._domGet['panels'] = makeEl({ insertAdjacentHTML: function () {} });
global.window = global;

/* دادهٔ اولیه */
setData('ptf_crm_customers', [{ cd: 'C1', co: 'مشتری الف' }]);
setData('ptf_crm_offers', [{ no: 'O1', buyerCd: 'C1', items: [{ name: 'کالا ۱', qty: 10, price: 100000 }] }]);
setData('ptf_crm_invoices', [
  { cd: 'INV1', no: 'F-1', offerNo: 'O1', amount: 1000000, payments: [{ cd: 'P1', amt: 1000000, status: 'posted' }] }
]);
setData('ptf_crm_sales_returns', [
  /* مرجوعی قدیمی بدون invoiceCd (فقط offerNo) — ریشهٔ «اعتبار از بین رفته» */
  { cd: 'SRET1', offerNo: 'O1', customerCd: 'C1', items: [{ item: 'کالا ۱', qty: 2 }], totalAmount: 200000, status: 'approved', disposition: 'stock', stockStatus: 'stocked', t: '1405/02/01' }
]);
setData('ptf_crm_products', [{ cd: 'P1', nm: 'کالا ۱' }]);
setData('ptf_crm_deals', []);

eval.call(global, cf);

SECTION('اعتبار مشتری: مرجوعی قدیمی بدون invoiceCd');
T('اعتبار زنده = پرداخت + مرجوعی(بدون invoiceCd از طریق offerNo یکتا) − مبلغ', (function () {
  var rows = cfAccountRows('مشتری الف');
  return rows.length === 1 && rows[0].credit === 200000;
})());
T('cfCreditAudit اجزای اعتبار را نشان می‌دهد', (function () {
  var a = cfCreditAudit('C1');
  return a.credit === 200000 && a.rows.length === 1 && a.rows[0].returned === 200000 && a.rows[0].credit === 200000;
})());
T('ترمیم خودکار در بوت: مرجوعی بدون invoiceCd به فاکتور پیوند خورد', getData('ptf_crm_sales_returns')[0].invoiceCd === 'INV1');
T('cfRepairReturnLinks: فراخوانی مجدد idempotent (۰ ترمیم جدید)', cfRepairReturnLinks() === 0);
T('پس از ترمیم، اعتبار همچنان ۲۰۰هزار است', cfAccountRows('مشتری الف')[0].credit === 200000);

SECTION('مرجوعی با invoiceCd مستقیم (رفتار قبلی)');
setData('ptf_crm_sales_returns', [
  { cd: 'SRET2', invoiceCd: 'INV1', items: [{ item: 'کالا ۱', qty: 1 }], totalAmount: 100000, status: 'approved' }
]);
T('اعتبار = ۱۰۰هزار (مرجوعی مستقیم)', cfAccountRows('مشتری الف')[0].credit === 100000);
setData('ptf_crm_sales_returns', []);

SECTION('هاب مالی: برنامه‌ریزی فصلی مالیات فقط در تب سال مالی + دارک‌مود');
T('ptfTaxPlannerBox در finHubApply فقط با fiscal نمایش داده می‌شود', hub.indexOf("show('ptfTaxPlannerBox', t === 'fiscal')") > -1);
T('ptfTaxPlannerBox در finHubOrder هست', hub.indexOf("'fiscalBox', 'ptfTaxPlannerBox'") > -1);
T('دارک‌مود slLiquidity و ptfTaxPlannerBox اضافه شد', hub.indexOf('body.ptf-dark #slLiquidity') > -1 && hub.indexOf('body.ptf-dark #ptfTaxPlannerBox') > -1 && hub.indexOf('background:#1e293b') > -1);

DONE('tester292-credit-repair');
