/* tester657 — v34.39.3 (RECEIPT-BUTTON-FIX): رفع باگ «دکمهٔ دریافت در پروندهٔ فروش کار نمی‌کند».
   ریشه: از v34.38.19 (INV-OPEN-CANONICAL) ستون «مطالبه باز» جدول فاکتورهای پنجرهٔ
   «💳 دریافت و حساب پرونده» (ptfCaseFinanceOpen در sales-domain-v2.js) به `arCore` ارجاع
   می‌داد که فقط داخل caseTotals با `var arCore=(window.PTF||{}).ar` تعریف شده بود.
   در حالت 'use strict'، برای هر پروندهٔ دارای دست‌کم یک فاکتور، همان ابتدای رندر
   ReferenceError: arCore is not defined پرتاب می‌شد و دیالوگ هرگز insert نمی‌شد —
   یعنی دقیقاً وقتی کاربر می‌خواست دریافتِ فاکتور را ثبت کند، دکمه «مرده» بود.
   پروندهٔ بدون فاکتور سالم باز می‌شد (به همین دلیل باگ در تست‌های دستی اولیه دیده نشد).
   تستر۶۴۲ فقط با regex ایستا وجود الگو را قفل کرده بود و هرگز تابع را اجرا نکرد.
   این تستر ptfCaseFinanceOpen واقعی را در vm با موتور واقعی PTF.ar اجرا می‌کند:
   ۱) پروندهٔ دارای فاکتور ⇒ پنجره بدون خطا باز می‌شود و دکمهٔ «+ ثبت دریافت قطعی» دارد؛
   ۲) پروندهٔ بدون فاکتور ⇒ همان رفتار قبلی (کنترل رگرسیون معکوس)؛
   ۳) نبودِ PTF.ar ⇒ fallback فرمول قدیمی و پنجره همچنان باز می‌شود (تاب‌آوری بارگذاری)؛
   ۴) ستون «مطالبه باز» از منبع واحد PTF.ar.invoiceState می‌خواند (قرارداد ۶۴۲ به‌صورت رفتاری). */
'use strict';
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

/* ---------- قرارداد استاتیک ---------- */
var sdv2 = read('crm/sales-domain-v2.js');

/* استخراج بلوک تابع با تطبیق آکولاد (همان روش تستر۶۴۲ برای openIrr) */
function extractFnSrc(src, marker) {
  var start = src.indexOf(marker);
  if (start < 0) return null;
  var depth = 0, i = src.indexOf('{', start);
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(start, i + 1); }
  }
  return null;
}
var financeOpenSrc = extractFnSrc(sdv2, 'window.ptfCaseFinanceOpen = function (id) {');
T('ptfCaseFinanceOpen قابل استخراج است', !!financeOpenSrc);
T('ptfCaseFinanceOpen خودش arCore را تعریف می‌کند (ریشهٔ ReferenceError بسته شد)',
  !!financeOpenSrc && /var arCore\s*=\s*\(window\.PTF\s*\|\|\s*\{\}\)\.ar/.test(financeOpenSrc));
T('قرارداد تستر۶۴۲ پایدار است: ستون «مطالبه باز» همچنان از invoiceState می‌خواند',
  /arCore\.invoiceState\(i\)\.open/.test(sdv2));

/* ---------- sandbox با موتور واقعی PTF.ar ---------- */
function makeSandbox(db, opts) {
  opts = opts || {};
  var inserted = [];
  var sb = {
    console: console, JSON: JSON, Math: Math, Date: Date, Promise: Promise, Number: Number,
    String: String, Object: Object, Array: Array, RegExp: RegExp, Error: Error,
    TypeError: TypeError, ReferenceError: ReferenceError, isNaN: isNaN,
    parseInt: parseInt, parseFloat: parseFloat, encodeURIComponent: encodeURIComponent,
    setTimeout: function () { return 0; }, clearTimeout: function () {},
    setInterval: function () { return 0; }, clearInterval: function () {},
    getData: function (k) { return db[k] === undefined ? [] : db[k]; },
    setData: function (k, v) { db[k] = v; return true; },
    escP: function (v) { return String(v == null ? '' : v); },
    ptfOnClickArg: function (v) { return String(v == null ? '' : v); },
    ptfNum: function (v) { return +v || 0; },
    faDate: function () { return '1405/06/25'; },
    curRole: function () { return opts.role || 'admin'; },
    curSession: function () { return { user: 'u', name: 'کاربر' }; },
    alert: function (m) { sb.alerts.push(String(m)); },
    prompt: function () { return null; }, confirm: function () { return true; },
    localStorage: { getItem: function () { return null; }, setItem: function () {}, removeItem: function () {} },
    fetch: function () { return Promise.reject(new Error('no network in tester')); },
    document: {
      querySelectorAll: function () { return []; },
      getElementById: function (id) {
        if (id === 'panels') return { insertAdjacentHTML: function (pos, html) { inserted.push(html); } };
        return null;
      }
    }
  };
  sb.alerts = [];
  sb.window = sb; sb.globalThis = sb; sb.insertedHtml = inserted;
  vm.createContext(sb);
  if (!opts.withoutAr) vm.runInContext(read('crm/ar-reconcile.js'), sb, { filename: 'ar-reconcile.js' });
  vm.runInContext(read('crm/sales-domain-v2.js'), sb, { filename: 'sales-domain-v2.js' });
  return sb;
}

function baseDb() {
  return {
    ptf_crm_deals: [{ _id: 'C1', cd: 'SF-100', inqNo: 'INQ-1401', buyerCo: 'شرکت تست', buyerCd: 'CU-1', status: 'open' }],
    ptf_crm_customers: [{ _id: 'CU-1', cd: 'CU-1', name: 'شرکت تست' }],
    ptf_crm_offers: [], ptf_crm_case_receipts: [], ptf_crm_receipt_allocations: [],
    ptf_crm_sales_returns: [], ptf_crm_invoices: []
  };
}

/* ---------- سناریو ۱: پروندهٔ دارای فاکتور فعال (گزارش کارفرما — دکمه مرده بود) ---------- */
(function () {
  var db = baseDb();
  db.ptf_crm_invoices = [{ _id: 'I1', cd: 'I1', no: '1404/01', caseId: 'C1', customerId: 'CU-1',
    base: 1000000000, vat: 90000000, amount: 1090000000, invDate: '2026-06-01', status: 'active',
    allocatedBase: 0, allocatedVat: 0, openAmountIRR: 1090000000, payments: [] }];
  var sb = makeSandbox(db);
  var err = null;
  try { sb.ptfCaseFinanceOpen('C1'); } catch (e) { err = e; }
  T('سناریو۱: کلیک «💳 دریافت و حساب پرونده» روی پروندهٔ دارای فاکتور هیچ خطا نمی‌دهد (قبلاً ReferenceError: arCore)',
    !err, err && (err.name + ': ' + err.message));
  T('سناریو۱: پنجرهٔ مالی پرونده واقعاً رندر/insert می‌شود',
    sb.insertedHtml.length === 1 && sb.insertedHtml[0].indexOf('ptfCaseFinanceDlg') > -1);
  var html = sb.insertedHtml[0] || '';
  T('سناریو۱: دکمهٔ «+ ثبت دریافت قطعی» (ptfReceiptOpen) برای نقش مالی در پنجره هست',
    html.indexOf('ptfReceiptOpen(') > -1 && html.indexOf('ثبت دریافت قطعی') > -1);
  T('سناریو۱: ردیف فاکتور با شماره و مبلغ ریالی نمایش داده می‌شود',
    html.indexOf('1404/01') > -1 && html.indexOf('۱٬۰۹۰٬۰۰۰٬۰۰۰') > -1, html.slice(0, 200));
})();

/* ---------- سناریو ۲: پروندهٔ بدون فاکتور (کنترل — قبل از اصلاح هم کار می‌کرد) ---------- */
(function () {
  var db = baseDb();
  var sb = makeSandbox(db);
  var err = null;
  try { sb.ptfCaseFinanceOpen('C1'); } catch (e) { err = e; }
  T('سناریو۲: پروندهٔ بدون فاکتور بدون خطا باز می‌شود', !err, err && err.message);
  var html = sb.insertedHtml[0] || '';
  T('سناریو۲: جای جدول فاکتورها پیام خالیِ درست نشان داده می‌شود',
    html.indexOf('فاکتور فعالی ثبت نشده است') > -1);
})();

/* ---------- سناریو ۳: PTF.ar بارگذاری نشده (تاب‌آوری ترتیب اسکریپت‌ها) ---------- */
(function () {
  var db = baseDb();
  db.ptf_crm_invoices = [{ _id: 'I2', cd: 'I2', no: '1404/02', caseId: 'C1', customerId: 'CU-1',
    base: 500000000, vat: 45000000, amount: 545000000, invDate: '2026-06-05', status: 'active',
    openAmountIRR: 545000000 }];
  var sb = makeSandbox(db, { withoutAr: true });
  var err = null;
  try { sb.ptfCaseFinanceOpen('C1'); } catch (e) { err = e; }
  T('سناریو۳: بدونِ PTF.ar هم پنجره باز می‌شود (fallback فرمول قدیمی openAmountIRR)',
    !err && sb.insertedHtml.length === 1, err && err.message);
  T('سناریو۳: مبلغ مطالبهٔ باز از openAmountIRR خود رکورد خوانده می‌شود',
    (sb.insertedHtml[0] || '').indexOf('۵۴۵٬۰۰۰٬۰۰۰') > -1);
})();

/* ---------- سناریو ۴: ستون «مطالبه باز» از منبع واحد PTF.ar (رفتاری، مکمل تستر۶۴۲) ---------- */
(function () {
  var db = baseDb();
  /* فاکتور با وصولی میراثیِ کامل روی خود رکورد: فرمول قدیم (openAmountIRR/amount−allocated)
     آن را «باز» می‌دید؛ منبع واحد PTF.ar.invoiceState ماندهٔ صفر می‌دهد. */
  db.ptf_crm_invoices = [{ _id: 'I3', cd: 'I3', no: '1404/03', caseId: 'C1', customerId: 'CU-1',
    base: 1000000000, vat: 0, amount: 1000000000, invDate: '2026-06-10', status: 'active',
    allocatedBase: 0, allocatedVat: 0, openAmountIRR: 1000000000,
    payments: [{ cd: 'P1', how: 'cash', amountIrr: 1000000000, dateISO: '2026-06-11' }] }];
  var sb = makeSandbox(db);
  var err = null;
  try { sb.ptfCaseFinanceOpen('C1'); } catch (e) { err = e; }
  T('سناریو۴: پنجره بدون خطا باز می‌شود', !err, err && err.message);
  var html = sb.insertedHtml[0] || '';
  var row = html.split('<tr>').filter(function (x) { return x.indexOf('1404/03') > -1; })[0] || '';
  T('سناریو۴: فاکتور تسویه‌شده با وصولی میراثی در ستون «مطالبه باز» صفر نشان می‌دهد (منبع واحد AR)',
    row.indexOf('۰ ریال') > -1 && row.indexOf('۱٬۰۰۰٬۰۰۰٬۰۰۰ ریال</td></tr>') === -1, row.slice(0, 300));
})();

console.log('=== tester657: ' + p + ' PASS / ' + f + ' FAIL ===');
process.exit(f ? 1 : 0);
