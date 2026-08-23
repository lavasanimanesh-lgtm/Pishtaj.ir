#!/usr/bin/env node
'use strict';
/* v34.7.26 — فاز S3: بستن مسیرهای «نشت پیش‌پرداخت/دریافت بین مشتریان»
     F2-A (سرور) انتساب فاکتور به پرونده فقط با offerNo ناتهی و تطبیق یکتا
     F2-B کلید تهی در نقشهٔ پرونده‌های مشتری (customer-finance.js ×۲، ar-reconcile.js ×۲)
     F2-C تطبیق نامی فقط برای نام یکتا (مشتریان هم‌نام دیگر حساب هم را نمی‌بینند)
     F2-D یافتن پیشنهاد فقط با شمارهٔ ناتهی (customer-finance.js، ar-reconcile.js، rbac.js)
   مرجع: ASSESSMENT-SALESFILE-3ISSUES-2026-08-17.md بند ۳ */
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
    ptfOnClickArg: function (v) { return String(v == null ? '' : v); },
    faDate: function () { return '1405/05/26'; }, faDateTime: function () { return '1405/05/26 10:00'; },
    curSession: function () { return { user: 'u', name: 'کاربر' }; }, curRole: function () { return 'admin'; },
    isSenior: function () { return true; }, ptfCanSeeLedger: function () { return true; },
    ptfJToISO: function (v) { return String(v || ''); }, ptfISOToJ: function (v) { return String(v || ''); },
    alert: function () {}, audit: function () {}, ptfToast: function () {}, genCode: function (x) { return x + '-T'; },
    fetch: function () { return Promise.reject(new Error('offline')); },
    PTF_SALES_DOMAIN_V2: true, PTF: {}
  };
  sb.window = sb; sb.globalThis = sb;
  vm.createContext(sb);
  ['crm/finance-helpers.js', 'crm/metrics-shared.js', 'crm/ar-reconcile.js', 'crm/customer-finance.js'].forEach(function (r) {
    vm.runInContext(read(r), sb, { filename: r });
  });
  return sb;
}

/* سناریو: دو مشتری مستقل.
   CU-1 «شرکت الف» — یک پروندهٔ سالم و یک پروندهٔ بدون _id/cd (مولد کلید تهی)
   CU-2 «شرکت الف» (رکورد تکراری هم‌نام) — یک فاکتور با پیش‌پرداخت
   رسید یتیم (بدون caseId) متعلق به CU-2 است و نباید در حساب CU-1 دیده شود. */
function baseDb() {
  return {
    ptf_crm_customers: [{ cd: 'CU-1', co: 'شرکت الف' }, { cd: 'CU-2', co: 'شرکت الف' }, { cd: 'CU-3', co: 'شرکت ب' }],
    ptf_crm_deals: [
      { _id: 'CASE-1', cd: 'D-1', buyerCd: 'CU-1', buyerCo: 'شرکت الف', wonOffer: 'CO-1' },
      { buyerCd: 'CU-1', buyerCo: 'شرکت الف', inqNo: 'RFQ-BAD' },              /* بدون _id و بدون cd */
      { _id: 'CASE-2', cd: 'D-2', buyerCd: 'CU-2', buyerCo: 'شرکت الف', wonOffer: 'CO-2' }
    ],
    ptf_crm_offers: [
      { _id: 'OF-1', no: 'CO-1', buyerCd: 'CU-1' },
      { _id: 'OF-2', no: 'CO-2', buyerCd: 'CU-2' },
      { _id: 'OF-NONO', buyerCd: 'CU-3', advance: { amt: 900000, paid: true, payments: [{ cd: 'ADP-X', amt: 900000 }] } } /* پیشنهاد بدون شماره */
    ],
    ptf_crm_invoices: [
      { _id: 'INV-1', cd: 'I-1', no: '1405-1', offerNo: 'CO-1', caseId: 'CASE-1', customerId: 'CU-1', buyerCo: 'شرکت الف', amount: 1000000, status: 'active', payments: [] },
      { _id: 'INV-2', cd: 'I-2', no: '1405-2', offerNo: 'CO-2', caseId: 'CASE-2', customerId: 'CU-2', buyerCo: 'شرکت الف', amount: 2000000, status: 'active',
        payments: [{ cd: 'RP-ADV-CO-2', amt: 500000, fromAdvance: true, how: 'پیش‌پرداخت' }] },
      /* فاکتور بدون offerNo و بدون مالک صریح: نباید از راه پیشنهاد بی‌شماره به CU-3 نسبت داده شود */
      { _id: 'INV-3', cd: 'I-3', no: '1405-3', offerNo: '', amount: 300000, status: 'active', payments: [] }
    ],
    ptf_crm_case_receipts: [
      { _id: 'RCPT-ORPHAN', caseId: '', customerId: 'CU-2', amountIRR: 700000, creditRemainIRR: 700000, status: 'posted', receivedAt: '1405/05/20' },
      { _id: 'RCPT-OK', caseId: 'CASE-1', customerId: 'CU-1', amountIRR: 400000, creditRemainIRR: 400000, status: 'posted', receivedAt: '1405/05/21' }
    ],
    ptf_crm_receipt_allocations: [], ptf_crm_sales_returns: [], ptf_crm_cheques: []
  };
}

/* ---------- F2-B: رسید یتیم به مشتری دیگر نشت نمی‌کند ---------- */
(function emptyKeyLeak() {
  var s = client(baseDb());
  var rows = s.cfLedgerRows('CU-1', {});
  var leaked = rows.filter(function (r) { return r.link && r.link.kind === 'case-receipt' && r.no === 'RCPT-ORPHAN'; });
  T('F2-B دفتر مشتری: رسید بدون caseId متعلق به مشتری دیگر دیده نمی‌شود', leaked.length === 0, JSON.stringify(rows.map(function (r) { return r.no; })));
  var mine = rows.filter(function (r) { return r.link && r.link.kind === 'case-receipt' && r.no === 'RCPT-OK'; });
  T('عدم رگرسیون: رسید واقعی همان مشتری همچنان در دفتر هست', mine.length === 1, JSON.stringify(rows.map(function (r) { return r.no; })));

  var pos = s.PTF.ar.customerPosition('CU-1');
  /* رسید ۴۰۰٬۰۰۰ این مشتری روی فاکتور خودش تخصیص می‌خورد ⇒ بستانکاری باقیمانده صفر است؛
     نکتهٔ آزمون این است که ۷۰۰٬۰۰۰ رسید یتیمِ مشتری دیگر به هیچ عنوان اینجا نیاید. */
  T('F2-B بستانکاری مشتری شامل رسید یتیم مشتری دیگر نیست', pos.credit === 0 && pos.paid === 400000, JSON.stringify(pos));

  var pos2 = s.PTF.ar.customerPosition('CU-2');
  T('عدم رگرسیون: رسید یتیم با customerId صریح، در حساب صاحب واقعی‌اش می‌ماند', pos2.credit === 700000, JSON.stringify(pos2));

  var acc = s.cfAccountRows('');
  var cu1 = acc.filter(function (r) { return r.cd === 'CU-1'; })[0];
  T('F2-B اعتبار در فهرست حساب‌ها هم پاک است (بدون ۷۰۰٬۰۰۰ نشتی)', cu1 && cu1.credit < 700000, JSON.stringify(cu1));
})();

/* ---------- F2-C: مشتریان هم‌نام حساب یکدیگر را نمی‌بینند ---------- */
(function duplicateNameLeak() {
  var s = client(baseDb());
  var audit1 = s.cfCreditAudit('CU-1');
  var seen = audit1.rows.map(function (r) { return r.invoiceCd; });
  T('F2-C فاکتور مشتری هم‌نام دیگر در فهرست فاکتورهای این مشتری نیست', seen.indexOf('I-2') < 0, JSON.stringify(seen));
  T('F2-C فاکتور خودِ مشتری همچنان هست', seen.indexOf('I-1') > -1, JSON.stringify(seen));

  var rows = s.cfLedgerRows('CU-1', {});
  var advLeak = rows.filter(function (r) { return String(r.note || '').indexOf('پیش‌پرداخت') > -1 || String(r.ref || '').indexOf('پیش‌پرداخت') > -1; });
  T('F2-C ردیف پیش‌پرداخت فاکتور مشتری دیگر در دفتر این مشتری ظاهر نمی‌شود', advLeak.length === 0, JSON.stringify(advLeak));
})();

/* ---------- F2-C: نام یکتا همچنان کار می‌کند (عدم رگرسیون) ---------- */
(function uniqueNameStillWorks() {
  var db = baseDb();
  db.ptf_crm_customers = [{ cd: 'CU-1', co: 'شرکت الف' }, { cd: 'CU-3', co: 'شرکت ب' }];
  db.ptf_crm_invoices.push({ _id: 'INV-N', cd: 'I-N', no: '1405-9', offerNo: '', buyerCo: 'شرکت الف', amount: 150000, status: 'active', payments: [] });
  var s = client(db);
  var seen = s.cfCreditAudit('CU-1').rows.map(function (r) { return r.invoiceCd; });
  T('عدم رگرسیون: با نام یکتا، تطبیق نامی فاکتور بدون مالک همچنان برقرار است', seen.indexOf('I-N') > -1, JSON.stringify(seen));
})();

/* ---------- F2-D: پیشنهاد بی‌شماره مالکیت را جابه‌جا نمی‌کند ---------- */
(function emptyOfferNo() {
  var s = client(baseDb());
  var invCu3 = s.PTF.ar.customerInvoices('CU-3').map(function (i) { return i._id; });
  T('F2-D فاکتور بدون offerNo از راه پیشنهاد بی‌شماره به مشتری بی‌ربط نمی‌چسبد', invCu3.indexOf('INV-3') < 0, JSON.stringify(invCu3));
  T('F2-D تابع کمکی با ورودی تهی null برمی‌گرداند', s.cfFindOfferByNo('') === null && s.cfFindOfferByNo(null) === null);
  T('عدم رگرسیون: تابع کمکی با شمارهٔ واقعی همان پیشنهاد را می‌دهد', (s.cfFindOfferByNo('CO-2') || {})._id === 'OF-2');
})();

/* ---------- بررسی ایستا: هیچ نقطهٔ کلید-تهی باقی نمانده ---------- */
(function staticGuards() {
  var cf = read('crm/customer-finance.js'), ar = read('crm/ar-reconcile.js'), rb = read('crm/rbac.js'), php = read('api/sales-domain.php');
  T('F2-B هیچ نقشهٔ پرونده‌ای بدون گارد کلید تهی نمانده (customer-finance)',
    cf.indexOf("cases[String(d._id || d.cd || '')] = true") < 0 && cf.indexOf("customerCases[String(d._id || d.cd || '')] = true") < 0);
  T('F2-B هیچ نقشهٔ پرونده‌ای بدون گارد کلید تهی نمانده (ar-reconcile)',
    ar.indexOf('myCases[idOf(c)] = true') < 0);
  T('F2-D الگوی ناامن یافتن پیشنهاد در rbac.js حذف شده',
    rb.indexOf('filter(function (x) { return x.no === offerNo; })') < 0 &&
    rb.indexOf('filter(function (x) { return x.no === inv.offerNo; })') < 0);
  T('F2-D همهٔ پنج مسیر باقی‌ماندهٔ پیشنهاد در rbac.js گارد شمارهٔ تهی دارند',
    (rb.match(/String\(x\.no \|\| ''\) === String\(offerNo\)/g) || []).length === 5, (rb.match(/String\(x\.no \|\| ''\) === String\(offerNo\)/g) || []).length);
  T('F2-A گارد سرور: offerNo تهی هرگز به پرونده وصل نمی‌شود',
    php.indexOf("if($offerNo==='')continue;") > -1 && php.indexOf('invoice_case_bind_ambiguous') > -1);
  T('F2-A تطبیق چندگانه ⇒ انتساب انجام نمی‌شود',
    /if\(count\(\$matches\)!==1\)\{[\s\S]{0,160}continue;\}/.test(php));
})();

console.log('\n— tester429 (S3: بستن نشت پیش‌پرداخت بین مشتریان) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
