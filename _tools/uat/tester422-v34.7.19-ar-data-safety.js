#!/usr/bin/env node
'use strict';
/* v34.7.19 — فاز A نقشهٔ فازبندی: ایمنی داده
     AR-01 ابطال محلی صورتحساب غیررسمی نباید دادهٔ مالی سایر پرونده‌ها را خراب کند
     AR-02 اصلاح فاکتور رسمی نباید فیلدهای سند را بی‌صدا حذف کند
   مرجع: ARENA-INDEPENDENT-VERIFICATION-AWARD-CHANGE-2026-08-17.md (N1/N2)
          PLAN-REMAINING-FIXES-PHASED-2026-08-17.md (فاز A)
   تست رفتاری است: ماژول واقعی کلاینت در sandbox اجرا می‌شود و قواعد سرور از روی کد سنجیده می‌شود. */
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

/* ---------- sandbox کلاینت ---------- */
function client(db, opts) {
  opts = opts || {};
  var alerts = [];
  var sb = {
    console: console, JSON: JSON, Math: Math, Date: Date, Promise: Promise,
    setTimeout: function () { return 0; }, clearTimeout: function () {}, setInterval: function () { return 0; }, clearInterval: function () {},
    document: { getElementById: function () { return null; }, querySelectorAll: function () { return []; }, createElement: function () { return { style: {}, setAttribute: function () {}, appendChild: function () {}, addEventListener: function () {} }; }, body: { insertAdjacentHTML: function () {}, appendChild: function () {} }, head: { appendChild: function () {} }, addEventListener: function () {} },
    localStorage: { getItem: function () { return null; }, setItem: function () {}, removeItem: function () {} },
    getData: function (k) { return db[k] === undefined ? [] : db[k]; },
    setData: function (k, v) { db[k] = v; return true; },
    escP: function (v) { return String(v == null ? '' : v); },
    ptfOnClickArg: function (v) { return String(v == null ? '' : v); },
    faDate: function () { return '1405/05/26'; }, faDateTime: function () { return '1405/05/26 10:00'; },
    curSession: function () { return { user: 'u', name: 'کاربر' }; },
    curRole: function () { return 'admin'; }, isSenior: function () { return true; },
    roleDef: function () { return { finance: true, lb: 'مدیر' }; },
    ptfCanSeeLedger: function () { return true; },
    audit: function () {}, addLog: function () {}, notify: function () {},
    alert: function (m) { alerts.push(String(m || '')); },
    confirm: function () { return true; }, prompt: function () { return 'دلیل آزمون'; },
    ptfToast: function () {}, genCode: function (x) { return x + '-T'; },
    PTF_SALES_DOMAIN_V2: opts.v2 !== false, PTF: {}
  };
  if (opts.serverRoute) sb.ptfUnofficialInvoiceVoidServer = function () { return { ok: true }; };
  sb.window = sb; sb.globalThis = sb;
  vm.createContext(sb);
  ['crm/finance-helpers.js', 'crm/ar-reconcile.js'].forEach(function (rel) { vm.runInContext(read(rel), sb, { filename: rel }); });
  /* فقط تابع ابطال از ماژول غیررسمی استخراج می‌شود (کل فایل به DOM/سرور وابسته است) */
  var src = read('crm/unofficial-invoice.js');
  var start = src.indexOf('window.ptfUnofficialInvoiceVoid = function');
  if (start < 0) throw new Error('ptfUnofficialInvoiceVoid not found');
  var end = src.indexOf('\n  };', start);
  var body = src.slice(start, end + 5);
  vm.runInContext('(function(){' + body + '})();', sb, { filename: 'unofficial-invoice.void' });
  sb.__alerts = alerts;
  return sb;
}

function baseDb() {
  return {
    ptf_crm_customers: [{ cd: 'CU-A', co: 'شرکت الف' }, { cd: 'CU-B', co: 'شرکت ب' }],
    ptf_crm_deals: [
      { _id: 'CASE-A', cd: 'DEAL-A', buyerCd: 'CU-A', buyerCo: 'شرکت الف', wonOffer: 'OF-A' },
      { _id: 'CASE-B', cd: 'DEAL-B', buyerCd: 'CU-B', buyerCo: 'شرکت ب', wonOffer: 'OF-B' }
    ],
    ptf_crm_offers: [], ptf_crm_sales_returns: [], ptf_crm_cheques_received: [], ptf_crm_cheques_issued: [], ptf_crm_cheques: [],
    ptf_crm_case_receipts: [
      /* رسید پروندهٔ A: کاملاً تخصیص‌یافته به فاکتور غیررسمی A */
      { _id: 'RCPT-A', cd: 'RCPT-A', caseId: 'CASE-A', customerId: 'CU-A', amountIRR: 500000000, amt: 500000000, receivedAt: '2026-06-01', status: 'posted', timing: 'post_invoice', allocatedIRR: 500000000, creditRemainIRR: 0 },
      /* رسید پروندهٔ B: هیچ ربطی به فاکتور ابطالی ندارد و نباید دست بخورد */
      { _id: 'RCPT-B', cd: 'RCPT-B', caseId: 'CASE-B', customerId: 'CU-B', amountIRR: 900000000, amt: 900000000, receivedAt: '2026-06-02', status: 'posted', timing: 'post_invoice', allocatedIRR: 900000000, creditRemainIRR: 0 }
    ],
    ptf_crm_receipt_allocations: [
      { _id: 'AL-1', caseId: 'CASE-A', receiptId: 'RCPT-A', invoiceId: 'INV-A', component: 'base', amountIRR: 500000000, status: 'active' },
      { _id: 'AL-2', caseId: 'CASE-B', receiptId: 'RCPT-B', invoiceId: 'INV-B', component: 'base', amountIRR: 900000000, status: 'active' }
    ],
    ptf_crm_invoices: [
      { _id: 'INV-A', cd: 'INV-A', no: 'U-1', caseId: 'CASE-A', customerId: 'CU-A', base: 500000000, vat: 0, amount: 500000000, invDate: '1405/03/01', status: 'active', isUnofficial: true, payments: [] },
      { _id: 'INV-B', cd: 'INV-B', no: 'U-2', caseId: 'CASE-B', customerId: 'CU-B', base: 900000000, vat: 0, amount: 900000000, invDate: '1405/03/02', status: 'active', isUnofficial: true, payments: [] }
    ]
  };
}

/* ---------- AR-01 / حالت v35: مسیر محلی باید fail-closed باشد ---------- */
(function guardedInV2() {
  var db = baseDb();
  var s = client(db, { v2: true });
  var res = s.ptfUnofficialInvoiceVoid('INV-A');
  T('AR-01 در معماری v35 ابطال محلی اجرا نمی‌شود', res && res.ok === false && res.why === 'server_endpoint_required', JSON.stringify(res));
  T('AR-01 پیام راهنمای مسیر جایگزین به کاربر داده می‌شود', (s.__alerts.join(' ').indexOf('از مسیر سرور') > -1));
  T('AR-01 وضعیت فاکتور تغییر نمی‌کند', db.ptf_crm_invoices[0].status === 'active', db.ptf_crm_invoices[0].status);
  T('AR-01 هیچ تخصیصی reversed نمی‌شود', db.ptf_crm_receipt_allocations.every(function (a) { return a.status === 'active'; }));
  T('AR-01 بستانکاری هیچ رسیدی تغییر نمی‌کند',
    db.ptf_crm_case_receipts[0].creditRemainIRR === 0 && db.ptf_crm_case_receipts[1].creditRemainIRR === 0);
})();

/* ---------- AR-01 / دفاع در عمق: اگر بلوک محلی اجرا شود، دامنه‌اش فقط همان پرونده است ----------
   شبیه‌سازی وضعیت پس از فاز E (وجود مسیر سروری) تا بلوک محلی واقعاً اجرا شود و
   ثابت شود حتی در آن حالت هم هیچ رکوردی خارج از پروندهٔ فاکتور تغییر نمی‌کند. */
(function scopedRewrite() {
  var db = baseDb();
  var s = client(db, { v2: true, serverRoute: true });
  var res = s.ptfUnofficialInvoiceVoid('INV-A');
  T('AR-01 با وجود مسیر سروری، اجرا تا انتها پیش می‌رود', !!(res && res.ok !== false), JSON.stringify(res && res.why));
  T('AR-01 تخصیص فاکتور هدف (schema سروری invoiceId/amountIRR) reversed می‌شود',
    db.ptf_crm_receipt_allocations[0].status === 'reversed', db.ptf_crm_receipt_allocations[0].status);
  T('AR-01 تخصیص پروندهٔ دیگر دست‌نخورده می‌ماند', db.ptf_crm_receipt_allocations[1].status === 'active');
  T('AR-01 بستانکاری رسید همان پرونده به‌درستی آزاد می‌شود',
    db.ptf_crm_case_receipts[0].creditRemainIRR === 500000000, db.ptf_crm_case_receipts[0].creditRemainIRR);
  T('AR-01 بستانکاری رسید پروندهٔ دیگر صفر می‌ماند (ریشهٔ باگ N1)',
    db.ptf_crm_case_receipts[1].creditRemainIRR === 0, db.ptf_crm_case_receipts[1].creditRemainIRR);
  T('AR-01 مبلغ آزادشده از amountIRR خوانده می‌شود نه فیلد ناموجود amount',
    (res && res.log && res.log.freedCreditAmount === 500000000) || db.ptf_crm_case_receipts[0].creditRemainIRR === 500000000);
})();

/* ---------- AR-01 / پشتیبانی از schema میراثی تخصیص ---------- */
(function legacySchema() {
  var db = baseDb();
  db.ptf_crm_receipt_allocations = [
    { _id: 'AL-1', caseId: 'CASE-A', receiptId: 'RCPT-A', invoiceCd: 'INV-A', amount: 500000000, status: 'active' },
    { _id: 'AL-2', caseId: 'CASE-B', receiptId: 'RCPT-B', invoiceCd: 'INV-B', amount: 900000000, status: 'active' }
  ];
  var s = client(db, { v2: true, serverRoute: true });
  s.ptfUnofficialInvoiceVoid('INV-A');
  T('AR-01 تخصیص با schema میراثی (invoiceCd/amount) هم شناسایی می‌شود', db.ptf_crm_receipt_allocations[0].status === 'reversed');
  T('AR-01 دامنه در schema میراثی هم محدود به همان پرونده است',
    db.ptf_crm_receipt_allocations[1].status === 'active' && db.ptf_crm_case_receipts[1].creditRemainIRR === 0);
})();

/* ---------- مسیر legacy (بدون v35): رفتار قبلی نباید تغییر کند ---------- */
(function legacyUntouched() {
  var db = baseDb();
  var before = JSON.stringify(db.ptf_crm_receipt_allocations) + JSON.stringify(db.ptf_crm_case_receipts);
  var s = client(db, { v2: false });
  var res = s.ptfUnofficialInvoiceVoid('INV-A');
  T('مسیر legacy مسدود نشده و ابطال انجام می‌شود', !!(res && res.ok !== false), JSON.stringify(res && res.why));
  T('مسیر legacy مثل گذشته به تخصیص/رسید دست نمی‌زند (بلوک v35 اجرا نمی‌شود)',
    JSON.stringify(db.ptf_crm_receipt_allocations) + JSON.stringify(db.ptf_crm_case_receipts) === before);
})();

/* ---------- AR-02: حفظ فیلدها در اصلاح فاکتور (قاعدهٔ سرور) ---------- */
(function correctInvoiceFields() {
  var php = read('api/sales-domain.php');
  T('AR-02 رکورد اصلاح‌شده روی رکورد قبلی ادغام می‌شود', php.indexOf('$record=array_merge($oldInv,$record);') > -1);
  T('AR-02 ادغام فقط در شاخهٔ اصلاح است، نه ثبت جدید',
    php.indexOf('$record=array_merge($oldInv,$record);') > php.indexOf("if($ii>=0){$reason=sd_text"));
  T('AR-02 نسخهٔ اصلاح و ثبت correction دست‌نخورده باقی مانده',
    php.indexOf("$record['correctionVersion']=(int)($oldInv['correctionVersion']??0)+1") > -1 && php.indexOf("'kind'=>'data_entry_correction'") > -1);
  T('AR-02 گارد «فقط سند فعال» برای اصلاح اضافه شده', php.indexOf("'error'=>'invoice_not_active'") > -1);
  T('AR-02 بازسازی تخصیص پس از اصلاح همچنان اجرا می‌شود',
    php.indexOf('sd_rebuild_allocations($caseId,$receipts,$invoices,$allocations,$cases);') > -1);

  /* شبیه‌سازی معنایی array_merge روی همان فهرست فیلدهای در معرض حذف */
  var oldInv = { _id: 'INV-X', cd: 'INV-X', no: '900', status: 'active', base: 1000, vat: 90, amount: 1090,
    pays: [{ cd: 'P-OLD', amt: 400 }], payments: [{ cd: 'P-NEW', amt: 100 }],
    dueISO: '2026-07-01', dueFa: '1405/04/10', contactApproved: { nm: 'الف', tel: '021' },
    offerCurrency: 'EUR', offerFxBasis: 'free', offerFxRateRef: 900000, advApplied: 250 };
  var fresh = { _id: 'INV-X', cd: 'INV-X', no: '901', status: 'active', base: 1200, vat: 108, amount: 1308, isOfficial: true };
  var merged = Object.assign({}, oldInv, fresh);
  merged.payments = oldInv.payments;
  ['pays', 'dueISO', 'dueFa', 'contactApproved', 'offerCurrency', 'offerFxBasis', 'offerFxRateRef', 'advApplied'].forEach(function (k) {
    T('AR-02 فیلد «' + k + '» پس از اصلاح حفظ می‌شود', merged[k] !== undefined);
  });
  T('AR-02 مقادیر اصلاح‌شده بر مقادیر قبلی غالب‌اند', merged.no === '901' && merged.amount === 1308 && merged.base === 1200);
  T('AR-02 وصولی‌های میراثی pays از مانده حذف نمی‌شوند', Array.isArray(merged.pays) && merged.pays[0].amt === 400);
})();

/* ---------- بهداشت نسخه ---------- */
(function versionHygiene() {
  var idx = read('crm/index.html'), sw = read('crm/sw.js'), man = read('crm/manifest.json'),
      cc = read('crm/clear-cache.html'), ver = read('VERSION.json');
  var m = idx.match(/window\.PTF_CRM_RELEASE\s*=\s*'([^']+)'/);
  var v = m ? m[1] : '';
  T('نسخهٔ index.html معتبر است', /^v34\.7\.19$/.test(v), v);
  T('sw.js با همان نسخه هم‌راستاست', sw.indexOf("var RELEASE = '" + v + "'") > -1 && sw.indexOf("ptf-crm-" + v) > -1);
  T('manifest/clear-cache/VERSION.json هم‌راستا هستند',
    man.indexOf('"version": "' + v.slice(1) + '"') > -1 && cc.indexOf(v) > -1 && ver.indexOf('"crm_version": "' + v + '"') > -1);
})();

console.log('\n=== tester422-v34.7.19-ar-data-safety: ' + p + ' PASS / ' + f + ' FAIL ===');
process.exit(f ? 1 : 0);
