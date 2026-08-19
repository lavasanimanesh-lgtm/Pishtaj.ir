#!/usr/bin/env node
'use strict';
/* v34.7.18 — یکپارچگی «وصولی» بین مطالبات، حساب مشتری و پرونده.
   مرجع: ARENA-AR-RECEIPT-INTEGRATION-RCA-2026-08-16.md
     R1 ارزش‌افزودهٔ تخصیص‌نیافته | R2 فاکتور بدون پرونده | R3 سقف amount
     R4/R10 مسیرهای نوشتن و ابطال | R6 پروجکشن کهنه | R7 انتقال بستانکاری
     R8 فاکتور superseded | R9 اتحادهای تسویه
   تست رفتاری است: ماژول‌های واقعی در sandbox اجرا می‌شوند. */
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function num(v) { return +v || 0; }

/* ---------- sandbox کلاینت ---------- */
function client(db) {
  var sb = {
    console: console, JSON: JSON, Math: Math, Date: Date, Promise: Promise,
    setTimeout: function () { return 0; }, clearTimeout: function () {},
    document: { getElementById: function () { return null; }, querySelectorAll: function () { return []; } },
    localStorage: { getItem: function () { return null; }, setItem: function () {}, removeItem: function () {} },
    getData: function (k) { return db[k] === undefined ? [] : db[k]; },
    setData: function (k, v) { db[k] = v; return true; },
    escP: function (v) { return String(v == null ? '' : v); },
    faDate: function () { return '1405/05/25'; }, faDateTime: function () { return '1405/05/25 10:00'; },
    curSession: function () { return { user: 'u', name: 'کاربر' }; }, curRole: function () { return 'admin'; },
    ptfCanSeeLedger: function () { return true; }, audit: function () {}, alert: function () {}, ptfToast: function () {},
    genCode: function (x) { return x + '-1'; },
    PTF_SALES_DOMAIN_V2: true, PTF: {}
  };
  sb.window = sb; sb.globalThis = sb;
  vm.createContext(sb);
  ['crm/finance-helpers.js', 'crm/ar-reconcile.js', 'crm/customer-finance.js'].forEach(function (rel) {
    vm.runInContext(read(rel), sb, { filename: rel });
  });
  return sb;
}

/* ---------- ۱) موتور سرور: قواعد کلیدی در کد هست ---------- */
(function serverRules() {
  var php = read('api/sales-domain.php');
  T('R3 سقف تخصیص بر مبنای amount تعریف شده', php.indexOf('function sd_invoice_caps') > -1 && php.indexOf("\$caps['base']") > -1);
  T('R1 مجوز ارزش‌افزوده دیگر از timing منجمد خوانده نمی‌شود',
    php.indexOf("$allowVat = (string)($receipts[$ri]['timing'] ?? 'pre_invoice') === 'post_invoice'") === -1 && php.indexOf('$invoiceIssued') > -1);
  T('R1 فیلد timing پس از تخصیص به‌روز می‌شود', php.indexOf("$receipts[$ri]['timing'] = 'post_invoice'") > -1);
  T('R2 اتصال فاکتور بی‌پرونده با تطبیق یکتا در سرور', php.indexOf('function sd_bind_orphan_invoices') > -1 && php.indexOf('auto-unique-offer') > -1);
  T('R2 پروندهٔ مبهم اتصال خودکار نمی‌گیرد', php.indexOf('foreach ($cases as $other)') > -1);
  T('R9 گزارش تسویه در سرور محاسبه و در پاسخ برگردانده می‌شود',
    php.indexOf('function sd_reconcile_case') > -1 && php.indexOf("$result['reconcile']=$GLOBALS['sd_last_reconcile']") > -1);
  T('R7 انتقال بستانکاری فقط از مسیر اصلاح رسمی و با تطبیق مشتری', php.indexOf('target_case_customer_mismatch') > -1 && php.indexOf('movedFromCaseId') > -1);
  T('همهٔ فراخوانی‌های بازسازی، فهرست پرونده‌ها را می‌گیرند', (php.match(/sd_rebuild_allocations\([^;]*?,\$cases\)/g) || []).length >= 8);
  T('openAmountIRR همچنان تولید می‌شود (سازگاری عقب‌رو)', php.indexOf("['openAmountIRR']") > -1);
})();

/* ---------- ۲) سناریو R1: پرداخت کامل پیش از صدور فاکتور ---------- */
(function vatCase() {
  var caseId = 'C1';
  var db = {
    ptf_crm_customers: [{ cd: 'CU-1', co: 'شرکت الف' }],
    ptf_crm_deals: [{ _id: caseId, cd: caseId, buyerCd: 'CU-1', buyerCo: 'شرکت الف', wonOffer: 'OF-1' }],
    ptf_crm_offers: [], ptf_crm_sales_returns: [],
    ptf_crm_case_receipts: [{ _id: 'R1', cd: 'R1', caseId: caseId, customerId: 'CU-1', amountIRR: 1090000000,
      receivedAt: '2026-05-01', status: 'posted', timing: 'pre_invoice' }],
    ptf_crm_invoices: [{ _id: 'I1', cd: 'I1', no: '1001', caseId: caseId, customerId: 'CU-1',
      base: 1000000000, vat: 90000000, amount: 1090000000, invDate: '2026-06-01', status: 'active',
      allocatedBase: 1000000000, allocatedVat: 0, openAmountIRR: 90000000, payments: [] }]
  };
  var s = client(db), st = s.PTF.ar.invoiceState(db.ptf_crm_invoices[0]);
  T('R1 مانده فاکتور با پرداخت کامل صفر می‌شود (ارزش‌افزوده هم پوشش داده شد)', st.open === 0, st.open);
  T('R1 مبلغ پرداختی کامل شمرده می‌شود', st.paid === 1090000000, st.paid);
  T('R1 اختلاف با تخصیص ذخیره‌شدهٔ سرور به‌عنوان «کهنه» علامت می‌خورد', st.stale === true);
  var pos = s.PTF.ar.customerPosition('CU-1');
  T('R1 حساب مشتری هم‌زمان بدهی و اعتبار نشان نمی‌دهد', pos.open === 0 && pos.credit === 0, pos.open + '/' + pos.credit);
  var cs = s.PTF.ar.caseState({ _id: caseId });
  T('R1 پرونده و مطالبات یک عدد می‌دهند', cs.open === st.open && cs.credit === 0, cs.open + '/' + cs.credit);
})();

/* ---------- ۳) سناریو R2 + R6: فاکتور بدون پرونده و پروجکشن نرسیده ---------- */
(function orphanAndStale() {
  var caseId = 'C2';
  var db = {
    ptf_crm_customers: [{ cd: 'CU-2', co: 'شرکت ب' }],
    ptf_crm_deals: [{ _id: caseId, cd: caseId, buyerCd: 'CU-2', buyerCo: 'شرکت ب', wonOffer: 'OF-2' }],
    ptf_crm_offers: [], ptf_crm_sales_returns: [],
    ptf_crm_case_receipts: [{ _id: 'R2', cd: 'R2', caseId: caseId, customerId: 'CU-2', amountIRR: 500000000, receivedAt: '2026-06-10', status: 'posted', timing: 'post_invoice' }],
    ptf_crm_invoices: [{ _id: 'I2', cd: 'I2', no: '2002', caseId: '', offerNo: 'OF-2', customerId: 'CU-2',
      base: 1200000000, vat: 0, amount: 1200000000, invDate: '2026-06-01', status: 'active', isUnofficial: true, payments: [] }]
  };
  var s = client(db), inv = db.ptf_crm_invoices[0], st = s.PTF.ar.invoiceState(inv);
  T('R2 دریافت پرونده از فاکتور بی‌پرونده (با تطبیق یکتا) کسر می‌شود', st.open === 700000000, st.open);
  T('R2 اتصال پیشنهادی گزارش می‌شود بدون تغییر رکورد', st.caseBinding === 'auto-unique-offer' && inv.caseId === '', inv.caseId);
  T('R6 وضعیت «کهنه» برای تخصیص نرسیده علامت می‌خورد', st.stale === true);
  var rep = s.PTF.ar.reconcile();
  T('گزارش تسویه، فاکتور بدون پرونده را دسته‌بندی می‌کند', rep.findings.some(function (x) { return x.category === 'invoice_without_case'; }));
  T('گزارش تسویه، تخصیص کهنه را دسته‌بندی می‌کند', rep.findings.some(function (x) { return x.category === 'stale_allocation'; }));
})();

/* ---------- ۴) سناریو R3 + R8 ---------- */
(function capsAndSuperseded() {
  var caseId = 'C3';
  var db = {
    ptf_crm_customers: [{ cd: 'CU-3', co: 'شرکت ج' }],
    ptf_crm_deals: [{ _id: caseId, cd: caseId, buyerCd: 'CU-3', buyerCo: 'شرکت ج', wonOffer: 'OF-3' }],
    ptf_crm_offers: [], ptf_crm_sales_returns: [],
    ptf_crm_case_receipts: [{ _id: 'R3', cd: 'R3', caseId: caseId, customerId: 'CU-3', amountIRR: 900000000, receivedAt: '2026-06-20', status: 'posted', timing: 'post_invoice' }],
    ptf_crm_invoices: [
      { _id: 'I3', cd: 'I3', no: '3003', caseId: caseId, customerId: 'CU-3', base: 1000000000, vat: 0, amount: 900000000,
        discount: 100000000, invDate: '2026-06-01', status: 'active', isUnofficial: true, payments: [] },
      { _id: 'I3U', cd: 'I3U', no: '3003-U', caseId: caseId, customerId: 'CU-3', base: 500000000, vat: 0, amount: 500000000,
        invDate: '2026-04-01', status: 'superseded', isUnofficial: true, supersededByInvoiceId: 'I3', payments: [] }
    ]
  };
  var s = client(db);
  var st = s.PTF.ar.invoiceState(db.ptf_crm_invoices[0]);
  T('R3 سقف تخصیص برابر مبلغ قطعی فاکتور است (نه base ناخالص)', st.billed === 900000000 && st.open === 0, st.billed + '/' + st.open);
  var pos = s.PTF.ar.customerPosition('CU-3');
  T('R8 فاکتور superseded در بدهی مشتری شمرده نمی‌شود', pos.billed === 900000000 && pos.open === 0, pos.billed + '/' + pos.open);
  T('R8 تعریف فعال‌بودن با پنل مطالبات یکی است', s.PTF.ar.activeInvoice(db.ptf_crm_invoices[1]) === false);
})();

/* ---------- ۵) پرداخت‌های میراثی و ابطال ---------- */
(function legacyAndVoid() {
  var db = {
    ptf_crm_customers: [{ cd: 'CU-4', co: 'شرکت د' }], ptf_crm_deals: [], ptf_crm_offers: [], ptf_crm_sales_returns: [], ptf_crm_case_receipts: [],
    ptf_crm_invoices: [{ _id: 'I4', cd: 'I4', no: '4004', caseId: '', customerId: 'CU-4', base: 1000000000, vat: 0, amount: 1000000000,
      invDate: '2026-06-01', status: 'active', payments: [
        { cd: 'P1', amt: 300000000, how: 'حواله', status: 'posted', sourcePath: 'legacy_receivables' },
        { cd: 'P2', amt: 200000000, how: 'چک وارده 12', status: 'void', voided: true, chequeCd: 'CHQ-1', sourcePath: 'cheque_module' }
      ] }]
  };
  var s = client(db), st = s.PTF.ar.invoiceState(db.ptf_crm_invoices[0]);
  T('وصولی میراثی فعال همچنان از مانده کسر می‌شود (رفتار قبلی حفظ شد)', st.paid === 300000000, st.paid);
  T('وصولی ابطال‌شدهٔ چک اثر مالی ندارد ولی رکوردش باقی است',
    st.open === 700000000 && db.ptf_crm_invoices[0].payments.length === 2, st.open);
  var rep = s.PTF.ar.reconcile();
  T('وصولی بدون رسید پرونده در گزارش تسویه دیده می‌شود', rep.findings.some(function (x) { return x.category === 'legacy_payment_no_receipt'; }));
})();

/* ---------- ۵ب) حفظ رفتارهای موجود: اضافه‌پرداخت، مرجوعی و فاکتور ارزی ---------- */
(function noRegression() {
  var db = {
    ptf_crm_customers: [{ cd: 'CU-5', co: 'شرکت ه' }], ptf_crm_deals: [], ptf_crm_offers: [], ptf_crm_case_receipts: [],
    ptf_crm_sales_returns: [{ cd: 'SR-1', invoiceCd: 'I5', totalAmount: 100000000, status: 'active' }],
    ptf_crm_invoices: [{ _id: 'I5', cd: 'I5', no: '5005', caseId: '', customerId: 'CU-5', base: 1000000000, vat: 0, amount: 1000000000,
      invDate: '2026-06-01', status: 'active', payments: [{ cd: 'P1', amt: 1100000000, how: 'حواله', status: 'posted' }] }]
  };
  var s = client(db), st = s.PTF.ar.invoiceState(db.ptf_crm_invoices[0]);
  T('اضافه‌پرداخت همچنان به‌عنوان اعتبار قابل تشخیص است (سقف‌گذاری نشده)', st.paid === 1100000000 && st.overPaid === 100000000, st.paid + '/' + st.overPaid);
  T('مانده منفی نمی‌شود', st.open === 0, st.open);
  var audit = s.cfCreditAudit('CU-5');
  T('اعتبار مشتری (اضافه‌پرداخت + مرجوعی) مثل قبل محاسبه می‌شود', audit.credit === 200000000, audit.credit);
})();

/* ---------- ۶) مسیرهای نوشتن و رابط‌ها ---------- */
(function wiring() {
  var chq = read('crm/cheque-module.js'), rbac = read('crm/rbac.js'), cf = read('crm/customer-finance.js'),
      sd = read('crm/sales-domain-v2.js'), fh = read('crm/finance-helpers.js'), idx = read('crm/index.html'), sw = read('crm/sw.js');
  T('R10 ابطال چک دیگر رکورد وصولی را حذف فیزیکی نمی‌کند',
    chq.indexOf("inv.payments = (inv.payments || []).filter(function (p) { return p.chequeCd !== cd; })") === -1 && chq.indexOf("p.voidReason = String(reason") > -1);
  T('مسیر وصولی چک و مطالبات برچسب منبع می‌گیرند',
    chq.indexOf("sourcePath: 'cheque_module'") > -1 && rbac.indexOf("sourcePath: 'legacy_receivables'") > -1);
  T('پنل مطالبات از منبع واحد PTF.ar می‌خواند', rbac.indexOf('PTF.ar.invoiceState(inv)') > -1);
  T('حساب مشتری از منبع واحد PTF.ar می‌خواند', cf.indexOf('window.PTF.ar.invoiceState(i).paid') > -1);
  T('پنجرهٔ مالی پرونده از منبع واحد PTF.ar می‌خواند', sd.indexOf('arCore.caseState(c)') > -1);
  T('PTF.invPaidSum به لایهٔ واحد وصل است و fallback دارد', fh.indexOf('window.PTF.ar.invoiceState(inv).paid') > -1 && fh.indexOf('opts.legacyOnly') > -1);
  T('کش تسویه پس از هر پروجکشن سرور باطل می‌شود', sd.indexOf('window.PTF.ar.invalidate()') > -1);
  T('ar-reconcile.js در index و service worker ثبت شده',
    idx.indexOf('ar-reconcile.js') > -1 && sw.indexOf("'./ar-reconcile.js'") > -1);
  T('گزارش تسویه از کیفیت داده و پنل مطالبات قابل باز کردن است',
    read('crm/data-quality.js').indexOf('ptfArReconcileOpen()') > -1 && rbac.indexOf('ptfArReconcileOpen()') > -1);
  T('انتقال بستانکاری در فرم اصلاح دریافت وجود دارد', sd.indexOf("id:'targetCase'") > -1);
})();

console.log('\n=== tester421-v34.7.18-ar-receipt-integrity: ' + p + ' PASS / ' + f + ' FAIL ===');
process.exit(f ? 1 : 0);
