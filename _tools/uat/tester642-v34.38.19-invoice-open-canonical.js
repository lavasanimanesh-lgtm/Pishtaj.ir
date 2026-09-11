/* tester642 — v34.38.20 (INV-OPEN-CANONICAL): رفع باگ «فاکتورِ تسویه‌شده در «مطالبات»
   تسویه‌شده نشان داده می‌شد ولی در پنل «فاکتورها» مطالبهٔ باز داشت».
   ریشه: پنل فاکتورها (official-invoice-v2.js) مانده را با فرمول خصوصی خودش حساب می‌کرد
   (openAmountIRR یا amount−allocatedBase−allocatedVat) و وصولی میراثی (invoice.payments/
   pays)، مرجوعی فروش و بازسازی محلی FIFO را نادیده می‌گرفت؛ در حالی که پنل مطالبات/
   حساب مشتری/پرونده از منبع واحد PTF.ar.invoiceState استفاده می‌کنند.
   اصلاح: openIrr پنل فاکتورها و ستون «مطالبه باز» جدول فاکتورهای پرونده، از همان
   منبع واحد می‌خوانند (با fallback فرمول قدیم). این تستر همان تابعِ واقعی openIrr را
   در sandbox با موتور واقعی PTF.ar اجرا می‌کند. */
'use strict';
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

/* ---------- قرارداد استاتیک ---------- */
var invPanel = read('crm/official-invoice-v2.js');
var sdv2 = read('crm/sales-domain-v2.js');
T('پنل فاکتورها: openIrr از منبع واحد PTF.ar.invoiceState می‌خواند',
  /window\.PTF\.ar\.invoiceState/.test(invPanel) && /function openIrr\(i\)/.test(invPanel));
T('پنل فاکتورها: فرمول قدیم فقط به‌عنوان fallback باقی مانده است',
  invPanel.indexOf('openAmountIRR != null ? +i.openAmountIRR') > -1);
T('جدول فاکتورهای پرونده: ستون «مطالبه باز» از invoiceState می‌خواند',
  /arCore\.invoiceState\(i\)\.open/.test(sdv2));

/* ---------- sandbox با موتور واقعی PTF.ar ---------- */
function client(db) {
  var sb = {
    console: console, JSON: JSON, Math: Math, Date: Date, Promise: Promise, Number: Number,
    setTimeout: function () { return 0; }, clearTimeout: function () {},
    getData: function (k) { return db[k] === undefined ? [] : db[k]; },
    setData: function (k, v) { db[k] = v; return true; },
    escP: function (v) { return String(v == null ? '' : v); },
    faDate: function () { return '1405/05/25'; }, faDateTime: function () { return '1405/05/25 10:00'; },
    curSession: function () { return { user: 'u', name: 'کاربر' }; }, curRole: function () { return 'admin'; },
    PTF: {}
  };
  sb.window = sb; sb.globalThis = sb;
  vm.createContext(sb);
  vm.runInContext(read('crm/ar-reconcile.js'), sb, { filename: 'ar-reconcile.js' });
  return sb;
}

/* استخراج تابعِ واقعی openIrr از official-invoice-v2.js با تطبیق آکولاد */
function extractOpenIrr(src) {
  var start = src.indexOf('function openIrr(i) {');
  if (start < 0) return null;
  var depth = 0, i = src.indexOf('{', start);
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(start, i + 1); }
  }
  return null;
}
var openIrrSrc = extractOpenIrr(invPanel);
T('تابع openIrr قابل استخراج است', !!openIrrSrc);

/* ---------- سناریو ۱: تسویه با وصولی میراثیِ روی خود فاکتور ----------
   فرمول قدیم: amount − allocatedBase − allocatedVat = 1000 − 0 − 0 = 1000 (باز!)
   منبع واحد: legacyPaidIRR=1000 ⇒ open=0 (تسویه). */
(function legacySettle() {
  var db = {
    ptf_crm_customers: [{ cd: 'CU-1', co: 'شرکت الف' }],
    ptf_crm_deals: [{ _id: 'C1', cd: 'C1', buyerCd: 'CU-1', buyerCo: 'شرکت الف', wonOffer: 'OF-1' }],
    ptf_crm_offers: [], ptf_crm_sales_returns: [], ptf_crm_case_receipts: [],
    ptf_crm_invoices: [{ _id: 'I1', cd: 'I1', no: '1001', caseId: 'C1', customerId: 'CU-1',
      base: 1000000000, vat: 0, amount: 1000000000, invDate: '2026-06-01', status: 'active',
      allocatedBase: 0, allocatedVat: 0, openAmountIRR: null,
      payments: [{ cd: 'P1', amt: 1000000000, how: 'حواله', t: '1405/03/10', status: 'posted' }] }]
  };
  var sb = client(db);
  vm.runInContext(openIrrSrc, sb, { filename: 'openIrr.js' });
  var open = sb.openIrr(db.ptf_crm_invoices[0]);
  T('سناریو میراثی: openIrr واقعی تسویه را تشخیص می‌دهد (۰، نه ۱۰۰۰)', open === 0, open);
})();

/* ---------- سناریو ۲: تسویه با دریافت پرونده‌ای که پروجکشن آن هنوز نرسیده ----------
   فاکتور allocatedBase/Vat=0 و openAmountIRR کهنه (۹۰٬۰۰۰٬۰۰۰ = سهم VAT قدیم).
   منبع واحد: بازسازی محلی FIFO از Receipt ⇒ open=0. */
(function staleProjectionSettle() {
  var db = {
    ptf_crm_customers: [{ cd: 'CU-1', co: 'شرکت الف' }],
    ptf_crm_deals: [{ _id: 'C1', cd: 'C1', buyerCd: 'CU-1', buyerCo: 'شرکت الف', wonOffer: 'OF-1' }],
    ptf_crm_offers: [], ptf_crm_sales_returns: [],
    ptf_crm_case_receipts: [{ _id: 'R1', cd: 'R1', caseId: 'C1', customerId: 'CU-1', amountIRR: 1090000000,
      receivedAt: '2026-05-01', status: 'posted' }],
    ptf_crm_invoices: [{ _id: 'I1', cd: 'I1', no: '1001', caseId: 'C1', customerId: 'CU-1',
      base: 1000000000, vat: 90000000, amount: 1090000000, invDate: '2026-06-01', status: 'active',
      allocatedBase: 0, allocatedVat: 0, openAmountIRR: 90000000, payments: [] }]
  };
  var sb = client(db);
  vm.runInContext(openIrrSrc, sb, { filename: 'openIrr.js' });
  var open = sb.openIrr(db.ptf_crm_invoices[0]);
  T('سناریو پروجکشن کهنه: openIrr واقعی از بازسازی محلی FIFO استفاده می‌کند (۰)', open === 0, open);
})();

/* ---------- سناریو ۳: فاکتور واقعاً باز باید باز بماند (عدم false-negative) ---------- */
(function stillOpen() {
  var db = {
    ptf_crm_customers: [{ cd: 'CU-1', co: 'شرکت الف' }],
    ptf_crm_deals: [{ _id: 'C1', cd: 'C1', buyerCd: 'CU-1', buyerCo: 'شرکت الف', wonOffer: 'OF-1' }],
    ptf_crm_offers: [], ptf_crm_sales_returns: [],
    ptf_crm_case_receipts: [{ _id: 'R1', cd: 'R1', caseId: 'C1', customerId: 'CU-1', amountIRR: 400000000,
      receivedAt: '2026-05-01', status: 'posted' }],
    ptf_crm_invoices: [{ _id: 'I1', cd: 'I1', no: '1001', caseId: 'C1', customerId: 'CU-1',
      base: 1000000000, vat: 90000000, amount: 1090000000, invDate: '2026-06-01', status: 'active',
      allocatedBase: 0, allocatedVat: 0, openAmountIRR: null, payments: [] }]
  };
  var sb = client(db);
  vm.runInContext(openIrrSrc, sb, { filename: 'openIrr.js' });
  var open = sb.openIrr(db.ptf_crm_invoices[0]);
  T('سناریو باز: فاکتور نیمه‌وصول ماندهٔ درست (۶۹۰٬۰۰۰٬۰۰۰) نشان می‌دهد', open === 690000000, open);
})();

console.log('=== tester642: ' + p + ' PASS / ' + f + ' FAIL ===');
process.exit(f ? 1 : 0);
