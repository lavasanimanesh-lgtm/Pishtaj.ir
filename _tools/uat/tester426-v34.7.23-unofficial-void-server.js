#!/usr/bin/env node
'use strict';
/* v34.7.23 — فاز E نقشهٔ فازبندی: ابطال سروری صورتحساب غیررسمی (INV-01)
   قرارداد: سند void می‌شود، رسید حذف نمی‌شود، تخصیص همان پرونده بازسازی و مبلغ آزادشده
   به بستانکاری همان پرونده برمی‌گردد؛ آثار غیرمالی فقط پس از تأیید سرور اجرا می‌شوند.
   مرجع: گزارش تلفیقی §۷.۲ | PLAN-REMAINING-FIXES-PHASED-2026-08-17.md (فاز E) */
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
var php = read('api/sales-domain.php');
var uni = read('crm/unofficial-invoice.js');
var sd2 = read('crm/sales-domain-v2.js');

/* ---------- E1: قرارداد فرمان سروری ---------- */
(function serverAction() {
  T('E1 اکشن void_unofficial_invoice تعریف شده', php.indexOf("elseif ($action === 'void_unofficial_invoice')") > -1);
  var block = php.slice(php.indexOf("elseif ($action === 'void_unofficial_invoice')"), php.indexOf("elseif ($action === 'replace_invoice_attachment')"));
  T('E1 فقط نقش‌های مالی مجازند', block.indexOf('sd_require_role(SD_FIN_ROLES);') > -1 &&
    block.indexOf('sd_require_role(SD_FIN_ROLES);') < block.indexOf('$id = sd_text($body[\'invoiceId\']'));
  T('E1 سند رسمی از این مسیر رد می‌شود', block.indexOf("'official_invoice_requires_void_invoice'") > -1);
  T('E1 ابطال دوباره رد می‌شود', block.indexOf("'already_void'") > -1);
  T('E1 قفل دورهٔ مالی رعایت می‌شود', block.indexOf('sd_is_locked($snaps') > -1 && block.indexOf("'fiscal_period_locked'") > -1);
  T('E1 دلیل اجباری است', block.indexOf("'reason_required'") > -1);
  T('E1 رکورد correction با snapshot قبلی ثبت می‌شود',
    block.indexOf("'entityType'=>'unofficial_invoice'") > -1 && block.indexOf("'beforeSnapshot'=>$inv") > -1);
  T('E1 سند حذف نمی‌شود، فقط void می‌شود', block.indexOf("$inv['status'] = 'void'") > -1 && block.indexOf('array_splice') === -1);
  T('E1 هیچ رسیدی حذف یا ابطال نمی‌شود', block.indexOf("unset($receipts") === -1 && block.indexOf("['status'] = 'void'; $receipts") === -1);
  T('E1 تخصیص‌ها با قواعد قطعی و با فهرست پرونده‌ها بازسازی می‌شوند',
    block.indexOf('sd_rebuild_allocations($caseId, $receipts, $invoices, $allocations, $cases)') > -1);
  T('E1 بستانکاری آزادشدهٔ پرونده در پاسخ برمی‌گردد', block.indexOf("'caseCreditIRR'=>$freed") > -1);
  T('E1 کلیدهای تغییر شامل فاکتور/تخصیص/رسید/اصلاحات است',
    block.indexOf("'ptf_crm_invoices'=>$invoices") > -1 && block.indexOf("'ptf_crm_receipt_allocations'=>$allocations") > -1 &&
    block.indexOf("'ptf_crm_case_receipts'=>$receipts") > -1 && block.indexOf("'ptf_crm_corrections'=>$corrections") > -1);
})();

/* ---------- E2: اتصال کلاینت و حذف مسیر نوشتن محلی در v35 ---------- */
(function clientWiring() {
  T('E2 wrapper سروری در ماژول دامنهٔ فروش تعریف شده', sd2.indexOf('window.ptfUnofficialInvoiceVoidServer = function') > -1);
  T('E2 wrapper از فرمان درست و کلید idempotency استفاده می‌کند',
    sd2.indexOf("api('void_unofficial_invoice'") > -1 && sd2.indexOf("'VOID-UNOFFICIAL|'") > -1);
  T('E2 wrapper گارد نقش مالی دارد', sd2.indexOf('if (!canFinance()) return Promise.reject') > -1);

  var entry = uni.slice(uni.indexOf('window.ptfUnofficialInvoiceVoid = function (invCd)'));
  var v35Block = entry.slice(0, entry.indexOf('// ── گارد ۱: نقش مجاز'));
  T('E2 مسیر v35 به سرور واگذار می‌شود', v35Block.indexOf('window.ptfUnofficialInvoiceVoidServer(') > -1);
  T('E2 پیام fail-closed قدیمی فاز A حذف شده (گارد جای خود را به مسیر واقعی داد)',
    uni.indexOf('server_endpoint_required') === -1);
  T('E2 اگر ماژول سرور بارگذاری نشده باشد، هیچ نوشتنی انجام نمی‌شود',
    v35Block.indexOf("why: 'server_module_missing'") > -1);
  T('E2 در شکست سرور هیچ تغییری ثبت نمی‌شود', v35Block.indexOf('ابطال انجام نشد و هیچ تغییری ثبت نشد') > -1);
  T('E2 آثار غیرمالی فقط پس از تأیید سرور اجرا می‌شوند',
    v35Block.indexOf('ptfUnofficialInvoiceVoidAfterEffects') > v35Block.indexOf('ptfUnofficialInvoiceVoidServer('));
  T('E2 کش مطالبات پس از ابطال باطل می‌شود', v35Block.indexOf('PTF.ar.invalidate()') > -1);

  /* بلوک نوشتن مالی محلی هنوز برای legacy هست ولی در مسیر v35 اجرا نمی‌شود */
  T('بلوک محلی بازسازی بستانکاری هنوز برای مسیر legacy موجود است', uni.indexOf('۳.۲) بازسازی creditRemainIRR فقط روی رسیدهای «همین پرونده»') > -1);
  T('بلوک محلی همچنان محدود به همان پرونده است (حفاظت فاز A پابرجاست)',
    uni.indexOf('خارج از پروندهٔ این فاکتور دست نمی‌خورد') > -1);
})();

/* ---------- گاردهای مشترک: رفتار واقعی ---------- */
(function sharedGuards() {
  T('گاردهای ابطال یک‌بار و مشترک تعریف شده‌اند', uni.indexOf('window.ptfUnofficialInvoiceVoidLocalGuards = function') > -1);

  function client(db, opts) {
    opts = opts || {};
    var alerts = [], prompts = 0, serverCalls = [];
    var sb = {
      console: console, JSON: JSON, Math: Math, Date: Date, Promise: Promise,
      getData: function (k) { return db[k] === undefined ? [] : db[k]; },
      setData: function (k, v) { db[k] = v; return true; },
      alert: function (m) { alerts.push(String(m || '')); },
      prompt: function () { prompts++; return opts.reason === undefined ? 'اشتباه در صدور' : opts.reason; },
      confirm: function () { return opts.confirm !== false; },
      curRole: function () { return opts.role || 'admin'; }, isSenior: function () { return (opts.role || 'admin') !== 'sales'; },
      curSession: function () { return { name: 'کاربر' }; },
      faDateTime: function () { return '1405/05/26 10:00'; }, faDate: function () { return '1405/05/26'; },
      audit: function () {}, ptfToast: function () {},
      PTF_SALES_DOMAIN_V2: true, PTF: { ar: { invalidate: function () {} } },
      ptfUnofficialInvoiceVoidServer: opts.noServer ? undefined : function (id, reason) {
        serverCalls.push({ id: id, reason: reason });
        return opts.serverFails ? Promise.reject(new Error('fiscal_period_locked')) : Promise.resolve({ voided: true, caseCreditIRR: 500000000 });
      }
    };
    sb.window = sb; sb.globalThis = sb;
    vm.createContext(sb);
    var src = uni;
    ['window.ptfUnofficialInvoiceVoidLocalGuards = function', 'window.ptfUnofficialInvoiceVoidAfterEffects = function', 'window.ptfUnofficialInvoiceVoid = function (invCd)'].forEach(function (sig) {
      var i = src.indexOf(sig);
      var end = src.indexOf('\n  };', i);
      vm.runInContext('(function(){' + src.slice(i, end + 5) + '})();', sb, { filename: 'void-fn' });
    });
    sb.__alerts = alerts; sb.__prompts = prompts; sb.__serverCalls = serverCalls;
    return sb;
  }
  function baseDb() {
    return {
      ptf_crm_invoices: [{ _id: 'INV-U', cd: 'INV-U', no: 'U-9', caseId: 'CASE-9', isUnofficial: true, status: 'active',
        amount: 500000000, invDate: '1405/03/01', files: [{ key: 'k1', name: 'f1.pdf' }], payments: [] }],
      ptf_crm_deals: [{ _id: 'CASE-9', cd: 'DEAL-9', docs: [{ key: 'k1', name: 'f1.pdf' }], timeline: [] }],
      ptf_crm_sales_returns: [{ cd: 'SR-9', invoiceCd: 'INV-U', totalAmount: 100000000, status: 'active' },
                              { cd: 'SR-8', invoiceCd: 'INV-OTHER', totalAmount: 70000000, status: 'active' }],
      ptf_crm_case_receipts: [{ _id: 'R9', caseId: 'CASE-9', amountIRR: 500000000, status: 'posted', creditRemainIRR: 0 }],
      ptf_crm_receipt_allocations: [{ _id: 'A9', caseId: 'CASE-9', receiptId: 'R9', invoiceId: 'INV-U', amountIRR: 500000000, status: 'active' }]
    };
  }

  /* مسیر موفق */
  var db = baseDb(), s = client(db);
  var out = s.ptfUnofficialInvoiceVoid('INV-U');
  T('مسیر v35 فرمان سروری را با شناسه و دلیل صدا می‌زند',
    s.__serverCalls.length === 1 && s.__serverCalls[0].id === 'INV-U' && s.__serverCalls[0].reason === 'اشتباه در صدور');
  T('کلاینت هیچ تخصیصی را خودش reverse نمی‌کند', db.ptf_crm_receipt_allocations[0].status === 'active');
  T('کلاینت هیچ بستانکاری‌ای را خودش بازنویسی نمی‌کند', db.ptf_crm_case_receipts[0].creditRemainIRR === 0);
  T('کلاینت وضعیت فاکتور را خودش void نمی‌کند (کار سرور است)', db.ptf_crm_invoices[0].status === 'active');
  T('خروجی یک Promise است', !!(out && typeof out.then === 'function'));

  /* دلیل خالی → توقف پیش از فراخوان سرور */
  var db2 = baseDb(), s2 = client(db2, { reason: '   ' });
  var r2 = s2.ptfUnofficialInvoiceVoid('INV-U');
  T('دلیل خالی، ابطال را متوقف می‌کند و سرور صدا زده نمی‌شود', r2 && r2.why === 'no_reason' && s2.__serverCalls.length === 0);

  /* انصراف کاربر */
  var db3 = baseDb(), s3 = client(db3, { confirm: false });
  var r3 = s3.ptfUnofficialInvoiceVoid('INV-U');
  T('انصراف کاربر، سرور را صدا نمی‌زند', r3 && r3.why === 'canceled' && s3.__serverCalls.length === 0);

  /* نقش غیرمجاز */
  var db4 = baseDb(), s4 = client(db4, { role: 'sales' });
  var r4 = s4.ptfUnofficialInvoiceVoid('INV-U');
  T('نقش غیرمجاز رد می‌شود', r4 && r4.why === 'role' && s4.__serverCalls.length === 0);

  /* سند رسمی */
  var db5 = baseDb(); db5.ptf_crm_invoices[0].isUnofficial = false;
  var s5 = client(db5); var r5 = s5.ptfUnofficialInvoiceVoid('INV-U');
  T('سند رسمی از این مسیر رد می‌شود', r5 && r5.why === 'not_unofficial' && s5.__serverCalls.length === 0);

  /* ماژول سرور بارگذاری نشده */
  var db6 = baseDb(), s6 = client(db6, { noServer: true });
  var r6 = s6.ptfUnofficialInvoiceVoid('INV-U');
  T('نبود ماژول سرور = هیچ نوشتنی', r6 && r6.why === 'server_module_missing' &&
    db6.ptf_crm_invoices[0].status === 'active' && db6.ptf_crm_sales_returns[0].status === 'active');
})();

/* ---------- آثار غیرمالی ---------- */
(function afterEffects() {
  var sb = {
    console: console, JSON: JSON, Date: Date,
    db: null, getData: function (k) { return sb.db[k] || []; }, setData: function (k, v) { sb.db[k] = v; return true; },
    faDateTime: function () { return '1405/05/26 10:00'; }, curSession: function () { return { name: 'کاربر' }; }
  };
  sb.window = sb; sb.globalThis = sb; vm.createContext(sb);
  var i = uni.indexOf('window.ptfUnofficialInvoiceVoidAfterEffects = function');
  vm.runInContext('(function(){' + uni.slice(i, uni.indexOf('\n  };', i) + 5) + '})();', sb);
  sb.db = {
    ptf_crm_sales_returns: [{ cd: 'SR-9', invoiceCd: 'INV-U', totalAmount: 100000000, status: 'active' },
                            { cd: 'SR-8', invoiceCd: 'INV-X', totalAmount: 70000000, status: 'active' }],
    ptf_crm_deals: [{ _id: 'CASE-9', cd: 'DEAL-9', docs: [{ key: 'k1' }, { key: 'k2' }], timeline: [] }]
  };
  var res = sb.ptfUnofficialInvoiceVoidAfterEffects({ cd: 'INV-U', no: 'U-9', caseId: 'CASE-9', files: [{ key: 'k1' }] }, 'اشتباه در صدور');
  T('مرجوعی متصل به همین فاکتور باطل می‌شود', sb.db.ptf_crm_sales_returns[0].status === 'void' && res.voidedReturns === 1);
  T('مرجوعی فاکتور دیگر دست‌نخورده می‌ماند', sb.db.ptf_crm_sales_returns[1].status === 'active');
  T('ضمیمهٔ همین فاکتور از اسناد پرونده جدا می‌شود', sb.db.ptf_crm_deals[0].docs.length === 1 && sb.db.ptf_crm_deals[0].docs[0].key === 'k2');
  T('timeline پرونده با شرح ابطال ثبت می‌شود', sb.db.ptf_crm_deals[0].timeline.length === 1 && sb.db.ptf_crm_deals[0].timeline[0].tx.indexOf('ابطال سروری') > -1);
})();

/* ---------- بهداشت نسخه ---------- */
(function versionHygiene() {
  var idx = read('crm/index.html'), sw = read('crm/sw.js'), man = read('crm/manifest.json'),
      cc = read('crm/clear-cache.html'), ver = read('VERSION.json');
  var v = (idx.match(/window\.PTF_CRM_RELEASE\s*=\s*'([^']+)'/) || [])[1] || '';
  T('نسخهٔ index.html قالب معتبر دارد', /^v\d+\.\d+\.\d+$/.test(v), v);
  T('sw.js با همان نسخه هم‌راستاست', sw.indexOf("var RELEASE = '" + v + "'") > -1 && sw.indexOf('ptf-crm-' + v) > -1);
  T('نسخهٔ سرویس سرور هم‌راستاست', php.indexOf("const SD_SERVICE_VERSION = '" + v.slice(1) + "';") > -1);
  T('manifest/clear-cache/VERSION.json هم‌راستا هستند',
    man.indexOf('"version": "' + v.slice(1) + '"') > -1 && cc.indexOf(v) > -1 && ver.indexOf('"crm_version": "' + v + '"') > -1);
})();

console.log('\n=== tester426-v34.7.23-unofficial-void-server: ' + p + ' PASS / ' + f + ' FAIL ===');
process.exit(f ? 1 : 0);
