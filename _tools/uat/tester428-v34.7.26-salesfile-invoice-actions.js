#!/usr/bin/env node
'use strict';
/* v34.7.26 — فاز S1: رفع باگ «🗑 ابطال کنترل‌شده» و «✏️ اصلاح سندی» در کشوی پروندهٔ فروش
     F1-1 findInvoice متقارن (هم _id هم cd؛ شناسهٔ تهی هرگز تطبیق نمی‌کند)
     F1-2 فرستنده‌ها (salesfiles.js / rbac.js) با قرارداد iid = _id||cd هم‌راستا شدند
     F1-3 پایان «شکست خاموش»: هر خروج بدون اقدام پیام صریح می‌دهد
     F1-4 showInvModal با editId ناموجود دیگر در حالت «ثبت جدید» باز نمی‌شود + گارد سند غیررسمی
     F1-5 تعریف مردهٔ ptfInvoiceVoid در rbac.js به ptfInvoiceVoidLegacy تغییر نام یافت
   مرجع: ASSESSMENT-SALESFILE-3ISSUES-2026-08-17.md بند ۱ */
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

/* ---------- sandbox رفتاری برای official-invoice-v2.js ---------- */
function client(db, opts) {
  opts = opts || {};
  var log = { alerts: [], prompts: [], confirms: [], api: [], toasts: [] };
  var sb = {
    console: console, JSON: JSON, Math: Math, Date: Date, Promise: Promise,
    setTimeout: function () { return 0; },
    document: {
      getElementById: function () { return null; },
      querySelectorAll: function () { return []; },
      body: { insertAdjacentHTML: function () {} }
    },
    getData: function (k) { return db[k] === undefined ? [] : db[k]; },
    setData: function (k, v) { db[k] = v; return true; },
    escP: function (v) { return String(v == null ? '' : v); },
    ptfOnClickArg: function (v) { return String(v == null ? '' : v); },
    ptfNum: function (v) { return +String(v == null ? '' : v).replace(/[^\d.-]/g, '') || 0; },
    ptfVatCalc: function (b, pct) { var vat = Math.round((+b || 0) * (+pct || 0) / 100); return { base: +b || 0, vat: vat, total: (+b || 0) + vat }; },
    faDate: function () { return '1405/05/26'; }, faDateTime: function () { return '1405/05/26 10:00'; },
    curSession: function () { return { user: 'u', name: 'کاربر' }; },
    curRole: function () { return opts.role || 'admin'; },
    isSenior: function () { return true; },
    alert: function (m) { log.alerts.push(String(m)); },
    prompt: function () { return opts.reason === undefined ? 'اشتباه ثبت' : opts.reason; },
    confirm: function () { return opts.confirm !== false; },
    ptfToast: function (m, k) { log.toasts.push([m, k]); },
    audit: function () {}, genCode: function (x) { return x + '-T'; },
    attachUploadWidget: function () {},
    renderInvoices: function () {},
    ptfSalesDomainApi: function (a, payload) { log.api.push({ action: a, payload: payload }); return Promise.resolve({ ok: true }); },
    fetch: function () { return Promise.reject(new Error('offline')); },
    PTF_SALES_DOMAIN_V2: true, PTF: {}
  };
  sb.window = sb; sb.globalThis = sb;
  vm.createContext(sb);
  vm.runInContext(read('crm/official-invoice-v2.js'), sb, { filename: 'crm/official-invoice-v2.js' });
  sb._log = log;
  return sb;
}

/* فاکتور سروری واقعی: هم _id دارد هم cd (و این دو برابر نیستند) */
function baseDb() {
  return {
    ptf_crm_invoices: [
      { _id: 'INV-UUID-1', cd: 'INV-1405-001', no: '1405-001', offerNo: 'CO-1', amount: 1000, status: 'active', files: [] },
      { _id: 'INV-UUID-2', cd: 'INV-1405-002', no: '1405-002', offerNo: 'CO-2', amount: 500, status: 'void', files: [] },
      { _id: 'INV-UUID-U', cd: 'UN-INV-CO-3', no: 'UN-3', offerNo: 'CO-3', amount: 300, status: 'active', isUnofficial: true, files: [] }
    ],
    ptf_crm_offers: [{ _id: 'OF-1', no: 'CO-1', buyerCd: 'CU-1' }, { no: 'CO-3', buyerCd: 'CU-1' }],
    ptf_crm_deals: [{ _id: 'CASE-1', cd: 'D-1', wonOffer: 'CO-1', buyerCd: 'CU-1', st: 'open' }],
    ptf_crm_case_receipts: [], ptf_crm_receipt_allocations: []
  };
}

/* ---------- F1-1/F1-2: ابطال از هر دو شناسه کار می‌کند ---------- */
(function voidByBothIds() {
  var s = client(baseDb());
  s.ptfInvoiceVoid('INV-UUID-1');
  T('F1-1 ابطال با _id فرمان سرور می‌فرستد', s._log.api.length === 1 && s._log.api[0].action === 'void_invoice', JSON.stringify(s._log.api));
  T('F1-1 شناسهٔ ارسالی به سرور = _id', s._log.api.length === 1 && s._log.api[0].payload.invoiceId === 'INV-UUID-1', JSON.stringify(s._log.api[0] && s._log.api[0].payload));

  var s2 = client(baseDb());
  s2.ptfInvoiceVoid('INV-1405-001');
  T('F1-2 ابطال با cd (مسیر کشوی پروندهٔ فروش) دیگر بی‌صدا رد نمی‌شود', s2._log.api.length === 1 && s2._log.api[0].action === 'void_invoice', JSON.stringify(s2._log.alerts));
  T('F1-2 حتی با ورودی cd، شناسهٔ سرور همچنان _id است', s2._log.api.length === 1 && s2._log.api[0].payload.invoiceId === 'INV-UUID-1', JSON.stringify(s2._log.api[0] && s2._log.api[0].payload));
})();

/* ---------- F1-3: هیچ خروجی بدون بازخورد ---------- */
(function noSilentFailure() {
  var s = client(baseDb());
  s.ptfInvoiceVoid('NO-SUCH-ID');
  T('F1-3 شناسهٔ ناموجود ⇒ پیام صریح (نه سکوت)', s._log.alerts.length === 1 && /یافت نشد/.test(s._log.alerts[0]), JSON.stringify(s._log.alerts));
  T('F1-3 شناسهٔ ناموجود ⇒ هیچ فرمانی به سرور نمی‌رود', s._log.api.length === 0, JSON.stringify(s._log.api));

  var s2 = client(baseDb());
  s2.ptfInvoiceVoid('INV-UUID-2'); /* از قبل void */
  T('F1-3 فاکتور ابطال‌شده ⇒ پیام وضعیت (نه سکوت)', s2._log.alerts.length === 1 && /فعال نیست/.test(s2._log.alerts[0]), JSON.stringify(s2._log.alerts));
  T('F1-3 فاکتور ابطال‌شده ⇒ ابطال دوباره ارسال نمی‌شود', s2._log.api.length === 0, JSON.stringify(s2._log.api));

  var s3 = client(baseDb());
  s3.ptfInvoiceVoid('');
  T('F1-1 شناسهٔ تهی هرگز با رکورد تهی تطبیق نمی‌شود', s3._log.api.length === 0 && s3._log.alerts.length === 1, JSON.stringify(s3._log));

  var s4 = client(baseDb());
  s4.ptfOfficialInvoiceFilesUi('NO-SUCH-ID');
  T('F1-3 پنجرهٔ اسناد با شناسهٔ ناموجود پیام می‌دهد', s4._log.alerts.length === 1 && /یافت نشد/.test(s4._log.alerts[0]), JSON.stringify(s4._log.alerts));
})();

/* ---------- F1-4: اصلاح سندی ---------- */
(function editGuards() {
  var s = client(baseDb());
  s.showInvModal('CO-1', 'NO-SUCH-ID');
  T('F1-4 editId ناموجود ⇒ فرم «ثبت جدید» باز نمی‌شود و پیام می‌دهد',
    s._log.alerts.length === 1 && /یافت نشد/.test(s._log.alerts[0]), JSON.stringify(s._log.alerts));

  var s2 = client(baseDb());
  s2.showInvModal('CO-3', 'UN-INV-CO-3');
  T('F1-4 سند غیررسمی از فرم فاکتور رسمی اصلاح نمی‌شود',
    s2._log.alerts.length === 1 && /غیررسمی/.test(s2._log.alerts[0]), JSON.stringify(s2._log.alerts));
})();

/* ---------- F1-2 (ایستا): فرستنده‌های UI با قرارداد iid هم‌راستا هستند ---------- */
(function callerContract() {
  var sf = read('crm/salesfiles.js'), rb = read('crm/rbac.js');
  T('F1-2 کشوی پرونده: ابطال رسمی با _id||cd صدا زده می‌شود',
    /ptfInvoiceVoid\(\\'' \+ ptfOnClickArg\(i\._id \|\| i\.cd\)/.test(sf), 'salesfiles');
  T('F1-2 کشوی پرونده: هیچ فراخوانی با اولویت cd باقی نمانده',
    sf.indexOf('ptfOnClickArg(i.cd || i._id)') < 0, 'salesfiles');
  T('F1-2 پنل مطالبات (rbac): ابطال با _id||cd صدا زده می‌شود',
    /ptfInvoiceVoid\(\\'' \+ ptfOnClickArg\(inv\._id \|\| inv\.cd\)/.test(rb), 'rbac');
  T('F1-5 تعریف مردهٔ هم‌نام در rbac.js حذف/تغییرنام یافته',
    rb.indexOf('window.ptfInvoiceVoid = function') < 0 && rb.indexOf('window.ptfInvoiceVoidLegacy = function') > -1, 'rbac');
  T('F1-4 ردیف صورتحساب غیررسمی در کشو به مسیر غیررسمی می‌رود (نه فرم رسمی)',
    /sfUnofficialInvoiceNew\(\\'' \+ ptfOnClickArg\(r\._id \|\| r\.cd\)/.test(sf), 'salesfiles');
})();

/* ---------- عدم رگرسیون: مسیر سالم پنل رسمی دست‌نخورده ---------- */
(function noRegression() {
  var s = client(baseDb(), { confirm: false });
  s.ptfInvoiceVoid('INV-UUID-1');
  T('عدم رگرسیون: انصراف کاربر در confirm ⇒ هیچ فرمانی نمی‌رود', s._log.api.length === 0, JSON.stringify(s._log.api));

  var s2 = client(baseDb(), { role: 'sales' });
  s2.ptfInvoiceVoid('INV-UUID-1');
  T('عدم رگرسیون: گارد نقش سر جای خود است', s2._log.api.length === 0 && s2._log.alerts.length === 1 && /مجاز/.test(s2._log.alerts[0]), JSON.stringify(s2._log.alerts));
})();

console.log('\n— tester428 (S1: ابطال/اصلاح فاکتور از کشوی پروندهٔ فروش) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
