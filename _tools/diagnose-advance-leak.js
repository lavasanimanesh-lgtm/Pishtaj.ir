#!/usr/bin/env node
'use strict';
/* ============================================================================
   تشخیص «نشت پیش‌پرداخت/دریافت بین مشتریان» — S2 (v34.7.26)
   مرجع: ASSESSMENT-SALESFILE-3ISSUES-2026-08-17.md بند ۳

   این ابزار هیچ داده‌ای را تغییر نمی‌دهد؛ فقط می‌خواند و گزارش می‌دهد.

   اجرا:
     node _tools/diagnose-advance-leak.js                 # پیش‌فرض: crm/data/sync سپس crm/data
     node _tools/diagnose-advance-leak.js <پوشه>          # پوشهٔ حاوی *.json کالکشن‌ها
     node _tools/diagnose-advance-leak.js <فایل.json>     # خروجی یکجای localStorage (شیء کلید⇒آرایه)
     node _tools/diagnose-advance-leak.js <...> --json    # خروجی ماشین‌خوان

   چهار مسیر نشتی که بررسی می‌شود (هر چهار مورد در کد اثبات شده‌اند):
     A) انتساب فاکتورِ بدون offerNo به پرونده/مشتری با تطبیق '' === ''  (api/sales-domain.php:1108)
     B) کلید تهی در نقشهٔ پرونده‌های مشتری ⇒ بلعیدن رسیدهای بدون caseId
        (customer-finance.js:84 و :375، ar-reconcile.js:226 و :242)
     C) تطبیق مبتنی بر نام شرکت در invs(cd)  (customer-finance.js:29)
     D) تطبیق undefined===undefined در یافتن پیشنهاد  (customer-finance.js:27، rbac.js:744/872)
   ========================================================================== */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '..');
var args = process.argv.slice(2).filter(function (a) { return a !== '--json'; });
var asJson = process.argv.indexOf('--json') > -1;

var KEYS = ['ptf_crm_invoices', 'ptf_crm_deals', 'ptf_crm_offers', 'ptf_crm_customers', 'ptf_crm_case_receipts', 'ptf_crm_receipt_allocations'];

function loadStore(src) {
  var store = {}, from = '';
  function readJson(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; } }
  var candidates = src ? [src] : [path.join(ROOT, 'crm/data/sync'), path.join(ROOT, 'crm/data')];
  for (var i = 0; i < candidates.length; i++) {
    var c = candidates[i];
    if (!fs.existsSync(c)) continue;
    if (fs.statSync(c).isDirectory()) {
      var found = 0;
      KEYS.forEach(function (k) {
        var p = path.join(c, k + '.json');
        if (fs.existsSync(p)) { var v = readJson(p); if (Array.isArray(v)) { store[k] = v; found++; } else if (v && Array.isArray(v.rows)) { store[k] = v.rows; found++; } }
      });
      if (found) { from = c; break; }
    } else {
      var obj = readJson(c);
      if (obj) {
        KEYS.forEach(function (k) { if (Array.isArray(obj[k])) store[k] = obj[k]; else if (obj[k] && Array.isArray(obj[k].rows)) store[k] = obj[k].rows; });
        if (Object.keys(store).length) { from = c; break; }
      }
    }
  }
  KEYS.forEach(function (k) { if (!store[k]) store[k] = []; });
  return { store: store, from: from };
}

function S(v) { return String(v == null ? '' : v); }
function idOf(x) { return S((x && (x._id || x.cd)) || ''); }
function activeRec(x) { var s = S(x && (x.status || x.st)).toLowerCase(); return !!x && ['void', 'voided', 'deleted', 'superseded', 'replaced', 'cancelled'].indexOf(s) < 0 && !x.voided && !x.deleted; }
function normalizeName(v) { return S(v).replace(/[\u200c\u200e\u200f\s\-_.،,؛;]/g, '').toLowerCase(); }
function money(v) { return (+v || 0).toLocaleString('fa-IR'); }

var loaded = loadStore(args[0]);
var db = loaded.store;
var invoices = db.ptf_crm_invoices, cases = db.ptf_crm_deals, offers = db.ptf_crm_offers,
    customers = db.ptf_crm_customers, receipts = db.ptf_crm_case_receipts;

var report = { source: loaded.from, counts: {}, A: [], B: { emptyIdCases: [], orphanReceipts: [], affectedCustomers: [] }, C: [], D: [], advanceRows: [] };
KEYS.forEach(function (k) { report.counts[k] = db[k].length; });

var caseById = {};
cases.forEach(function (c) { if (idOf(c)) caseById[idOf(c)] = c; });
var custByCd = {};
customers.forEach(function (c) { if (S(c && c.cd)) custByCd[S(c.cd)] = c; });
function custName(cd) { var c = custByCd[S(cd)]; return c ? S(c.co || c.name || cd) : S(cd); }

/* ---------- A: فاکتور بدون offerNo که caseId/customerId گرفته است ---------- */
invoices.forEach(function (i) {
  if (!i) return;
  if (S(i.offerNo) !== '') return;
  if (S(i.caseId) === '' && S(i.customerId) === '') return;
  var c = caseById[S(i.caseId)];
  var advRows = (i.payments || []).concat(i.pays || []).filter(function (pp) { return pp && pp.fromAdvance; });
  report.A.push({
    invoice: idOf(i), no: S(i.no), amount: +i.amount || 0,
    boundCase: S(i.caseId), boundCustomer: S(i.customerId), boundCustomerName: custName(i.customerId),
    caseWonOffer: c ? S(c.wonOffer || c.offerNo) : '(پرونده پیدا نشد)',
    caseBuyer: c ? S(c.buyerCd) : '',
    suspicious: !!(c && S(c.wonOffer || c.offerNo) === ''),
    advanceRows: advRows.length,
    advanceAmount: advRows.reduce(function (s, pp) { return s + (+pp.amt || +pp.amount || 0); }, 0)
  });
});

/* ---------- B: کلید تهی در نقشهٔ پرونده‌ها + رسیدهای بدون caseId ---------- */
cases.forEach(function (c) { if (c && idOf(c) === '') report.B.emptyIdCases.push({ buyerCd: S(c.buyerCd), buyerCo: S(c.buyerCo), inqNo: S(c.inqNo), wonOffer: S(c.wonOffer) }); });
receipts.forEach(function (r) {
  if (!r || !activeRec(r)) return;
  if (S(r.caseId) !== '') return;
  report.B.orphanReceipts.push({ receipt: idOf(r), customerId: S(r.customerId), customerName: custName(r.customerId), amount: +r.amountIRR || +r.amt || 0, credit: +r.creditRemainIRR || 0, receivedAt: S(r.receivedAt || r.dateISO || r.t), legacyPaymentRef: S(r.legacyPaymentRef) });
});
/* مشتری‌هایی که هر دو شرط را دارند ⇒ نشت فعال است */
var buyersWithEmptyKey = {};
report.B.emptyIdCases.forEach(function (x) { if (x.buyerCd) buyersWithEmptyKey[x.buyerCd] = true; });
Object.keys(buyersWithEmptyKey).forEach(function (cd) {
  var leaked = report.B.orphanReceipts.filter(function (r) { return r.customerId !== cd; });
  if (leaked.length) report.B.affectedCustomers.push({ customerCd: cd, customerName: custName(cd), leakedReceipts: leaked.length, leakedAmount: leaked.reduce(function (s, r) { return s + r.amount; }, 0), leakedCredit: leaked.reduce(function (s, r) { return s + r.credit; }, 0) });
});

/* ---------- C: نام مشتری تکراری پس از نرمال‌سازی ---------- */
var byName = {};
customers.forEach(function (c) {
  if (!c) return;
  [c.co || c.name, c.coEn].filter(Boolean).forEach(function (n) {
    var k = normalizeName(n); if (!k) return;
    (byName[k] = byName[k] || []).push(S(c.cd));
  });
});
Object.keys(byName).forEach(function (k) {
  var cds = byName[k].filter(function (v, i, a) { return v && a.indexOf(v) === i; });
  if (cds.length < 2) return;
  var invCount = invoices.filter(function (i) { return i && activeRec(i) && normalizeName(i.buyerCo) === k; }).length;
  report.C.push({ normalizedName: k, customerCds: cds, names: cds.map(custName), sharedInvoices: invCount });
});

/* ---------- D: پیشنهاد بدون شماره / فاکتور بدون offerNo ---------- */
var offersNoNo = offers.filter(function (o) { return o && S(o.no) === ''; });
if (offersNoNo.length) {
  report.D.push({
    kind: 'offers_without_no', count: offersNoNo.length,
    sample: offersNoNo.slice(0, 5).map(function (o) { return { _id: S(o._id), buyerCd: S(o.buyerCd), advance: o.advance ? (+((o.advance || {}).amt) || 0) : 0 }; }),
    invoicesWithoutOfferNo: invoices.filter(function (i) { return i && S(i.offerNo) === ''; }).length,
    note: 'الگوی offers.filter(x=>x.no===i.offerNo) با هر دو مقدار تهی تطبیق می‌دهد ⇒ buyerCd/advance پیشنهاد بی‌ربط خوانده می‌شود.'
  });
}

/* ---------- فهرست همهٔ ردیف‌های پیش‌پرداخت برای بازبینی چشمی ---------- */
invoices.forEach(function (i) {
  if (!i) return;
  (i.payments || []).concat(i.pays || []).forEach(function (pp) {
    if (!pp || !pp.fromAdvance) return;
    var c = caseById[S(i.caseId)];
    report.advanceRows.push({
      invoice: idOf(i), no: S(i.no), offerNo: S(i.offerNo), amount: +pp.amt || +pp.amount || 0,
      invoiceCustomer: S(i.customerId || i.buyerCd), invoiceCustomerName: custName(i.customerId || i.buyerCd),
      caseId: S(i.caseId), caseBuyer: c ? S(c.buyerCd) : '',
      mismatch: !!(c && S(c.buyerCd) && S(i.customerId || i.buyerCd) && S(c.buyerCd) !== S(i.customerId || i.buyerCd))
    });
  });
});

if (asJson) { console.log(JSON.stringify(report, null, 2)); process.exit(0); }

function h(t) { console.log('\n' + t + '\n' + '─'.repeat(t.length)); }
console.log('گزارش تشخیص نشت پیش‌پرداخت — ' + (report.source || '(هیچ منبع داده‌ای پیدا نشد)'));
if (!report.source) {
  console.log('\nهیچ فایل دادهٔ محلی پیدا نشد. مسیر پوشهٔ crm/data/sync سرور یا یک فایل export را به‌عنوان آرگومان بدهید:');
  console.log('  node _tools/diagnose-advance-leak.js /path/to/crm/data/sync');
  process.exit(2);
}
console.log(KEYS.map(function (k) { return k.replace('ptf_crm_', '') + '=' + report.counts[k]; }).join(' | '));

h('A) فاکتور بدون offerNo که به پرونده/مشتری چسبیده (تطبیق تهی سمت سرور)');
if (!report.A.length) console.log('موردی یافت نشد. ✅');
report.A.forEach(function (x) {
  console.log((x.suspicious ? '🔴' : '🟡') + ' فاکتور ' + (x.no || x.invoice) + ' — ' + money(x.amount) + ' ریال ⇒ مشتری ' + x.boundCustomerName + ' (' + x.boundCustomer + ')' +
    ' | پرونده ' + x.boundCase + ' با wonOffer="' + x.caseWonOffer + '"' + (x.advanceRows ? ' | ردیف پیش‌پرداخت: ' + x.advanceRows + ' به مبلغ ' + money(x.advanceAmount) : ''));
});

h('B) کلید تهی در نقشهٔ پرونده‌ها + رسیدهای بدون caseId');
console.log('پرونده‌های بدون _id و بدون cd: ' + report.B.emptyIdCases.length);
report.B.emptyIdCases.slice(0, 10).forEach(function (x) { console.log('  • مشتری ' + (x.buyerCo || x.buyerCd) + ' | استعلام ' + x.inqNo); });
console.log('رسیدهای فعال بدون caseId: ' + report.B.orphanReceipts.length);
report.B.orphanReceipts.slice(0, 10).forEach(function (r) { console.log('  • رسید ' + r.receipt + ' — ' + money(r.amount) + ' ریال (بستانکاری ' + money(r.credit) + ') | مشتری ثبت‌شده: ' + r.customerName + (r.legacyPaymentRef ? ' | مهاجرت‌شده از ' + r.legacyPaymentRef : '')); });
if (report.B.affectedCustomers.length) {
  console.log('🔴 نشت فعال برای این مشتریان (هم پروندهٔ بی‌شناسه دارند هم رسید یتیم در سامانه هست):');
  report.B.affectedCustomers.forEach(function (x) { console.log('  • ' + x.customerName + ' (' + x.customerCd + ') ⇒ ' + x.leakedReceipts + ' رسید غیرخودی، ' + money(x.leakedAmount) + ' ریال، بستانکاری نشتی ' + money(x.leakedCredit)); });
} else console.log('نشت فعال از این مسیر یافت نشد. ✅');

h('C) مشتریان هم‌نام (تطبیق نامی فاکتورها)');
if (!report.C.length) console.log('نام تکراری یافت نشد. ✅');
report.C.forEach(function (x) { console.log('🔴 ' + x.names.join(' / ') + ' ⇒ کدها: ' + x.customerCds.join(', ') + ' | فاکتورهای هم‌نام: ' + x.sharedInvoices); });

h('D) پیشنهاد بدون شماره (تطبیق undefined===undefined)');
if (!report.D.length) console.log('موردی یافت نشد. ✅');
report.D.forEach(function (x) { console.log('🔴 ' + x.count + ' پیشنهاد بدون شماره | ' + x.invoicesWithoutOfferNo + ' فاکتور بدون offerNo\n  ' + x.note); });

h('ردیف‌های پیش‌پرداخت (fromAdvance) و تطابق مالکیت');
var mism = report.advanceRows.filter(function (r) { return r.mismatch; });
console.log('کل ردیف‌های پیش‌پرداخت: ' + report.advanceRows.length + ' | ناسازگار با مالک پرونده: ' + mism.length);
mism.slice(0, 20).forEach(function (r) { console.log('🔴 فاکتور ' + (r.no || r.invoice) + ' — ' + money(r.amount) + ' ریال | مشتری فاکتور: ' + r.invoiceCustomerName + ' ≠ مالک پرونده: ' + custName(r.caseBuyer)); });

var total = report.A.filter(function (x) { return x.suspicious; }).length + report.B.affectedCustomers.length + report.C.length + report.D.length + mism.length;
console.log('\nجمع‌بندی: ' + (total ? '🔴 ' + total + ' یافتهٔ نیازمند اقدام' : '✅ هیچ نشتی در دادهٔ فعلی یافت نشد'));
process.exit(0);
