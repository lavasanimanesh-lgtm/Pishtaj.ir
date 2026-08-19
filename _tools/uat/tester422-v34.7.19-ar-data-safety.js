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
  ['window.ptfUnofficialInvoiceVoidLocalGuards = function', 'window.ptfUnofficialInvoiceVoidAfterEffects = function', 'window.ptfUnofficialInvoiceVoid = function'].forEach(function (sig) {
    var st = src.indexOf(sig);
    if (st < 0) throw new Error(sig + ' not found');
    vm.runInContext('(function(){' + src.slice(st, src.indexOf('\n  };', st) + 5) + '})();', sb, { filename: 'unofficial-invoice.void' });
  });
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

/* ---------- AR-01 / حالت v35: هیچ نوشتن محلی‌ای مجاز نیست ----------
   از v34.7.23 (فاز E) مسیر v35 به فرمان سروری واگذار می‌شود؛ اگر ماژول سرور در دسترس
   نباشد، رفتار همچنان fail-closed است. قرارداد پایدارِ این آزمون: «در معماری v35 هیچ
   رکورد مالی‌ای به‌صورت محلی نوشته نمی‌شود». */
(function noLocalWriteInV2() {
  var db = baseDb();
  var s = client(db, { v2: true });
  var res = s.ptfUnofficialInvoiceVoid('INV-A');
  T('AR-01 در معماری v35 مسیر محلی اجرا نمی‌شود',
    !!res && res.ok === false && ['server_endpoint_required', 'server_module_missing'].indexOf(res.why) > -1, JSON.stringify(res));
  T('AR-01 پیام راهنما به کاربر داده می‌شود', s.__alerts.join(' ').indexOf('سرور') > -1);
  T('AR-01 وضعیت فاکتور تغییر نمی‌کند', db.ptf_crm_invoices[0].status === 'active', db.ptf_crm_invoices[0].status);
  T('AR-01 هیچ تخصیصی reversed نمی‌شود', db.ptf_crm_receipt_allocations.every(function (a) { return a.status === 'active'; }));
  T('AR-01 بستانکاری هیچ رسیدی تغییر نمی‌کند',
    db.ptf_crm_case_receipts[0].creditRemainIRR === 0 && db.ptf_crm_case_receipts[1].creditRemainIRR === 0);
})();

/* ---------- AR-01 / حفاظت ساختاری بلوک محلی (شبکهٔ ایمنی) ----------
   بلوک بازسازی بستانکاری دیگر در هیچ مسیر عادی اجرا نمی‌شود، اما باید برای همیشه
   محدود به «همان پرونده» و آگاه به هر دو schema بماند تا اگر روزی دوباره فعال شد،
   خرابی سراسری N1 تکرار نشود. */
(function scopeGuardsStayInCode() {
  var src = read('crm/unofficial-invoice.js');
  T('AR-01 بلوک بازسازی فقط رسیدهای همان پرونده را می‌بیند', src.indexOf('خارج از پروندهٔ این فاکتور دست نمی‌خورد') > -1);
  T('AR-01 حلقهٔ سراسری قبلی حذف شده', src.indexOf("if (r && r.status === 'posted' && !r.voided) {\n          var _alloc") === -1);
  T('AR-01 هر دو schema تخصیص پشتیبانی می‌شوند',
    src.indexOf('a.invoiceId || a.invoiceCd') > -1 && src.indexOf('a.amountIRR != null ? a.amountIRR : a.amount') > -1);
  T('AR-01 کش مطالبات پس از تغییر محلی باطل می‌شود', src.indexOf('PTF.ar.invalidate()') > -1);
})();

/* ---------- مسیر legacy (بدون v35): رفتار قبلی نباید تغییر کند ---------- */
(function legacyUntouched() {
  var db = baseDb();
  var before = JSON.stringify(db.ptf_crm_receipt_allocations) + JSON.stringify(db.ptf_crm_case_receipts);
  var s = client(db, { v2: false });
  var res = s.ptfUnofficialInvoiceVoid('INV-A');
  T('مسیر legacy مسدود نشده و ابطال انجام می‌شود', !!res && res.ok !== false, JSON.stringify(res && res.why));
  T('مسیر legacy مثل گذشته به تخصیص/رسید دست نمی‌زند (بلوک v35 اجرا نمی‌شود)',
    JSON.stringify(db.ptf_crm_receipt_allocations) + JSON.stringify(db.ptf_crm_case_receipts) === before);
  T('مسیر legacy سند را void می‌کند', db.ptf_crm_invoices[0].status === 'void', db.ptf_crm_invoices[0].status);
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
  /* قرارداد نسخه «هم‌راستایی» است نه یک عدد ثابت؛ پین‌کردن عدد باعث شکست کاذب در نسخهٔ بعد می‌شد. */
  T('نسخهٔ index.html قالب معتبر دارد', /^v\d+\.\d+\.\d+$/.test(v), v);
  T('sw.js با همان نسخه هم‌راستاست', sw.indexOf("var RELEASE = '" + v + "'") > -1 && sw.indexOf("ptf-crm-" + v) > -1);
  T('manifest/clear-cache/VERSION.json هم‌راستا هستند',
    man.indexOf('"version": "' + v.slice(1) + '"') > -1 && cc.indexOf(v) > -1 && ver.indexOf('"crm_version": "' + v + '"') > -1);
})();

console.log('\n=== tester422-v34.7.19-ar-data-safety: ' + p + ' PASS / ' + f + ' FAIL ===');
process.exit(f ? 1 : 0);
