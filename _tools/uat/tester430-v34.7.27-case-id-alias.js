#!/usr/bin/env node
'use strict';
/* v34.7.27 — ممیزی شاخه (AUDIT-1): شناسهٔ متعارف پرونده
   رکوردهای قدیمی گاهی caseId را با `cd` پرونده ذخیره کرده‌اند در حالی که کلید گروه‌بندی
   همه‌جا `_id||cd` است؛ نتیجه: رسید و فاکتورِ یک پرونده در دو سطل جدا می‌افتادند، تخصیص
   انجام نمی‌شد و پول در نماها «دیده نمی‌شد» (هم‌خانوادهٔ باگ ابطال v34.7.26).
   مرجع: BRANCH-AUDIT-2026-08-17.md */
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

function client(db) {
  var sb = {
    console: console, JSON: JSON, Math: Math, Date: Date, Promise: Promise,
    setTimeout: function () { return 0; },
    document: { getElementById: function () { return null; }, querySelectorAll: function () { return []; }, body: { insertAdjacentHTML: function () {} } },
    getData: function (k) { return db[k] === undefined ? [] : db[k]; },
    setData: function (k, v) { db[k] = v; return true; },
    escP: function (v) { return String(v == null ? '' : v); },
    alert: function () {}, audit: function () {}, ptfToast: function () {},
    curRole: function () { return 'admin'; }, curSession: function () { return { name: 'u' }; },
    isSenior: function () { return true; }, ptfCanSeeLedger: function () { return true; },
    faDate: function () { return '1405/05/26'; },
    fetch: function () { return Promise.reject(new Error('offline')); },
    PTF_SALES_DOMAIN_V2: true, PTF: {}
  };
  sb.window = sb; sb.globalThis = sb;
  vm.createContext(sb);
  ['crm/finance-helpers.js', 'crm/metrics-shared.js', 'crm/ar-reconcile.js'].forEach(function (r) {
    vm.runInContext(read(r), sb, { filename: r });
  });
  return sb;
}

/* پرونده هم `_id` سروری دارد هم `cd` قدیمی.
   فاکتور با `_id` پرونده ذخیره شده، رسید با `cd` همان پرونده (دادهٔ میراثی). */
function aliasDb() {
  return {
    ptf_crm_customers: [{ cd: 'CU-1', co: 'شرکت الف' }],
    ptf_crm_deals: [{ _id: 'CASE-UUID-1', cd: 'D-1', buyerCd: 'CU-1', wonOffer: 'CO-1' }],
    ptf_crm_offers: [{ _id: 'OF-1', no: 'CO-1', buyerCd: 'CU-1' }],
    ptf_crm_invoices: [{ _id: 'INV-1', cd: 'I-1', no: '1405-1', offerNo: 'CO-1', caseId: 'CASE-UUID-1', customerId: 'CU-1',
      amount: 1000000, base: 1000000, vat: 0, invDate: '1405/05/20', status: 'active', payments: [] }],
    ptf_crm_case_receipts: [{ _id: 'RCPT-1', caseId: 'D-1', customerId: 'CU-1', amountIRR: 600000, status: 'posted', receivedAt: '1405/05/21' }],
    ptf_crm_receipt_allocations: [], ptf_crm_sales_returns: []
  };
}

(function aliasAllocation() {
  var db = aliasDb(), s = client(db);
  var st = s.PTF.ar.invoiceState(db.ptf_crm_invoices[0]);
  T('AUDIT-1 رسیدی که با نام مستعار پرونده ذخیره شده، به فاکتور همان پرونده تخصیص می‌خورد',
    st.paid === 600000 && st.open === 400000, JSON.stringify(st));

  var cs = s.PTF.ar.caseState(db.ptf_crm_deals[0]);
  T('AUDIT-1 پنجرهٔ پرونده همان رسید را می‌بیند', cs.received === 600000, JSON.stringify({ r: cs.received, o: cs.open }));
  T('AUDIT-1 مانده و بستانکاری پرونده درست است', cs.open === 400000 && cs.credit === 0, JSON.stringify(cs));

  var pos = s.PTF.ar.customerPosition('CU-1');
  T('AUDIT-1 حساب مشتری همان عدد را می‌دهد (بدون دوباره‌شماری)',
    pos.paid === 600000 && pos.open === 400000 && pos.credit === 0, JSON.stringify(pos));
})();

/* عدم رگرسیون: دو پروندهٔ مستقل با هم ادغام نمی‌شوند */
(function noMerge() {
  var db = aliasDb();
  db.ptf_crm_deals.push({ _id: 'CASE-UUID-2', cd: 'D-2', buyerCd: 'CU-2', wonOffer: 'CO-2' });
  db.ptf_crm_case_receipts.push({ _id: 'RCPT-2', caseId: 'CASE-UUID-2', customerId: 'CU-2', amountIRR: 900000, status: 'posted', receivedAt: '1405/05/22' });
  var s = client(db);
  var st = s.PTF.ar.invoiceState(db.ptf_crm_invoices[0]);
  T('عدم رگرسیون: رسید پروندهٔ دیگر به این فاکتور تخصیص نمی‌خورد', st.paid === 600000, JSON.stringify(st));
  var cs2 = s.PTF.ar.caseState(db.ptf_crm_deals[1]);
  T('عدم رگرسیون: هر پرونده فقط رسید خودش را می‌بیند', cs2.received === 900000 && cs2.credit === 900000, JSON.stringify(cs2));
})();

/* عدم رگرسیون: دادهٔ کاملاً مدرن (همه‌چیز با _id) دست‌نخورده می‌ماند */
(function modernData() {
  var db = aliasDb();
  db.ptf_crm_case_receipts[0].caseId = 'CASE-UUID-1';
  var s = client(db);
  var st = s.PTF.ar.invoiceState(db.ptf_crm_invoices[0]);
  T('عدم رگرسیون: دادهٔ مدرن همان نتیجهٔ قبلی را می‌دهد', st.paid === 600000 && st.open === 400000, JSON.stringify(st));
})();

/* بررسی ایستا: نقاط دیگر هم نام مستعار را می‌پذیرند */
(function statics() {
  var ar = read('crm/ar-reconcile.js'), v2 = read('crm/sales-domain-v2.js'), sync = read('crm/sync.js');
  T('AUDIT-1 نگاشت نام مستعار در ar-reconcile تعریف شده', ar.indexOf('function caseAliasMap') > -1);
  T('AUDIT-1 پنجرهٔ مالی پرونده از نام مستعار استفاده می‌کند', v2.indexOf('function caseAliases') > -1 && v2.indexOf("r.caseId === id") < 0);
  T('AUDIT-2 کش مطالبات پس از هر projection سروری باطل می‌شود', /ptf_crm_case_receipts[\s\S]{0,120}invalidate\(\)|invalidate\(\)[\s\S]{0,200}ptf_crm_case_receipts/.test(sync));
})();

console.log('\n— tester430 (ممیزی شاخه: شناسهٔ متعارف پرونده + ابطال کش) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
