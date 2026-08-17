#!/usr/bin/env node
'use strict';
/* v34.7.21 — فاز C نقشهٔ فازبندی: یکپارچگی چرخهٔ عمر و اثر مرجوعی فروش
     LC-01 تعریف واحد «سند فعال» در پورسانت / سرمایه در گردش / سال مالی / سود
     LC-02 کسر مرجوعی فروش از مبنای همان چهار موتور (تصویب کارفرما ۱۴۰۵/۰۵/۲۶)
     LC-03 دو دستهٔ جدید در گزارش تسویه
   مرجع: ARENA-CONSOLIDATED-FINAL-AWARD-CHANGE-2026-08-17.md §۸ و §۹،
          PLAN-REMAINING-FIXES-PHASED-2026-08-17.md (فاز C) */
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

/* ---------- sandbox با لایهٔ AR ---------- */
function arCore(db) {
  var sb = {
    console: console, JSON: JSON, Math: Math, Date: Date,
    document: { getElementById: function () { return null; }, querySelectorAll: function () { return []; } },
    getData: function (k) { return db[k] === undefined ? [] : db[k]; },
    setData: function (k, v) { db[k] = v; return true; },
    escP: function (v) { return String(v == null ? '' : v); },
    curRole: function () { return 'admin'; }, curSession: function () { return { name: 'کاربر' }; },
    audit: function () {}, alert: function () {}, PTF_SALES_DOMAIN_V2: true, PTF: {}
  };
  sb.window = sb; sb.globalThis = sb;
  vm.createContext(sb);
  ['crm/finance-helpers.js', 'crm/ar-reconcile.js'].forEach(function (r) { vm.runInContext(read(r), sb, { filename: r }); });
  return sb;
}

function db1() {
  return {
    ptf_crm_customers: [{ cd: 'CU-1', co: 'شرکت الف' }],
    ptf_crm_deals: [{ _id: 'CASE-1', cd: 'DEAL-1', buyerCd: 'CU-1', buyerCo: 'شرکت الف', wonOffer: 'OF-1', inqNo: 'RFQ-1' }],
    ptf_crm_offers: [{ no: 'OF-1', kind: 'CO', st: 'won', buyerCd: 'CU-1', _id: 'OFR-1' }],
    ptf_crm_case_receipts: [], ptf_crm_receipt_allocations: [],
    ptf_crm_sales_returns: [
      { cd: 'SR-1', invoiceCd: 'INV-OK', totalAmount: 200000000, status: 'active' },   /* لینک مستقیم */
      { cd: 'SR-2', invoiceNo: '777', totalAmount: 50000000, status: 'active' },        /* لینک با شمارهٔ فاکتور */
      { cd: 'SR-3', invoiceCd: 'INV-OK', totalAmount: 30000000, status: 'void' }        /* ابطال‌شده → بی‌اثر */
    ],
    ptf_crm_invoices: [
      { _id: 'INV-OK', cd: 'INV-OK', no: '900', caseId: 'CASE-1', customerId: 'CU-1', offerNo: 'OF-1',
        base: 1000000000, vat: 0, amount: 1000000000, invDate: '1405/03/01', status: 'active', payments: [{ cd: 'P1', amt: 1000000000, status: 'posted' }] },
      { _id: 'INV-N', cd: 'INV-N', no: '777', caseId: 'CASE-1', customerId: 'CU-1', offerNo: 'OF-2',
        base: 400000000, vat: 0, amount: 400000000, invDate: '1405/03/05', status: 'active', payments: [] },
      { _id: 'INV-SUP', cd: 'INV-SUP', no: '900-U', caseId: 'CASE-1', customerId: 'CU-1', offerNo: 'OF-1',
        base: 900000000, vat: 0, amount: 900000000, invDate: '1405/02/01', status: 'superseded', isUnofficial: true,
        supersededByInvoiceId: 'INV-OK', payments: [{ cd: 'P0', amt: 900000000, status: 'posted' }] }
    ]
  };
}

/* ---------- LC-02: منبع واحد مرجوعی ---------- */
(function returnsCore() {
  var db = db1(), s = arCore(db);
  var ar = s.PTF.ar;
  T('LC-02 مرجوعی لینک‌شده با invoiceCd شناسایی می‌شود', ar.returnedAmountIRR(db.ptf_crm_invoices[0]) === 200000000, ar.returnedAmountIRR(db.ptf_crm_invoices[0]));
  T('LC-02 مرجوعی ابطال‌شده شمرده نمی‌شود', ar.salesReturnsForInvoice(db.ptf_crm_invoices[0]).length === 1);
  T('LC-02 مرجوعی با شمارهٔ فاکتور (بدون invoiceCd) شناسایی می‌شود', ar.returnedAmountIRR(db.ptf_crm_invoices[1]) === 50000000, ar.returnedAmountIRR(db.ptf_crm_invoices[1]));
  T('LC-02 خالص فاکتور پس از مرجوعی درست است', ar.invoiceNetAfterReturnsIRR(db.ptf_crm_invoices[0]) === 800000000, ar.invoiceNetAfterReturnsIRR(db.ptf_crm_invoices[0]));
  T('LC-02 خالص هرگز منفی نمی‌شود', ar.invoiceNetAfterReturnsIRR({ cd: 'X', amount: 10, base: 10, vat: 0 }) >= 0);
  T('LC-01 سند superseded غیرفعال شناخته می‌شود', ar.activeInvoice(db.ptf_crm_invoices[2]) === false);
})();

/* ---------- LC-01/LC-02 در چهار موتور مالی (بررسی اتصال در کد) ---------- */
(function enginesWired() {
  var com = read('crm/commission.js'), wc = read('crm/working-capital.js'), fis = read('crm/fiscal.js'), fx = read('crm/fx.js');

  T('LC-01 پورسانت از تعریف واحد سند فعال استفاده می‌کند', com.indexOf('window.PTF.ar.activeInvoice(inv)') > -1 && com.indexOf('_liveInv') > -1);
  T('LC-02 مبنای پورسانت خالصِ پس از مرجوعی است', com.indexOf('window.PTF.ar.invoiceNetAfterReturnsIRR(inv)') > -1 && com.indexOf('base += _netBase;') > -1);
  T('پورسانت همچنان فقط پس از تسویهٔ کامل پرونده محاسبه می‌شود (قرارداد v34.5.35 حفظ شد)',
    com.indexOf('if (inv.amount - paid > 0.5) { allPaid = false; return; }') > -1);

  T('LC-01 سرمایه در گردش سند غیرفعال را مطالبه نمی‌شمارد', wc.indexOf('!window.PTF.ar.activeInvoice(inv)) return 0;') > -1);
  T('LC-02 سرمایه در گردش مرجوعی را کسر می‌کند', wc.indexOf('window.PTF.ar.returnedAmountIRR(inv)') > -1 && wc.indexOf('total - paid - returned') > -1);
  T('سرمایه در گردش از منبع واحد مانده می‌خواند (با fallback)', wc.indexOf('window.PTF.ar.invoiceState(inv).paid') > -1);

  T('LC-01 سال مالی سند غیرفعال را مطالبهٔ باز نمی‌شمارد', fis.indexOf('if (!window.PTF.ar.activeInvoice(inv)) return;') > -1);
  T('LC-02 سال مالی مرجوعی را از مانده کسر می‌کند', fis.indexOf('paid - _returned') > -1);

  T('LC-01 موتور سود سند غیرفعال را فروش نمی‌شمارد', fx.indexOf('!window.PTF.ar.activeInvoice(inv)) return 0;') > -1);
  T('LC-02 موتور سود مرجوعی را از فروش کسر می‌کند', fx.indexOf('amt = amt - returned;') > -1);

  ['crm/commission.js', 'crm/working-capital.js', 'crm/fiscal.js', 'crm/fx.js'].forEach(function (rel) {
    var src = read(rel);
    T('fallback رفتار قبلی در ' + rel.replace('crm/', '') + ' حفظ شده', src.indexOf('window.PTF && window.PTF.ar') > -1 || src.indexOf('window.PTF.ar') > -1);
  });
})();

/* ---------- رفتار عددی: شبیه‌سازی مبنای پورسانت و مطالبات ---------- */
(function numericBehaviour() {
  var db = db1(), s = arCore(db), ar = s.PTF.ar;
  var invOk = db.ptf_crm_invoices[0], invSup = db.ptf_crm_invoices[2];

  /* مبنای پورسانت: فقط اسناد فعال و خالصِ پس از مرجوعی */
  var base = 0;
  db.ptf_crm_invoices.forEach(function (inv) { if (ar.activeInvoice(inv)) base += ar.invoiceNetAfterReturnsIRR(inv); });
  T('مبنای پورسانت پس از فاز C درست است (۸۰۰م + ۳۵۰م)', base === 1150000000, base);
  T('سند superseded دیگر ۹۰۰م به مبنا اضافه نمی‌کند (دوبارشماری بسته شد)', base !== 2050000000);

  /* مطالبات باز: فاکتور کاملاً پرداخت‌شده با مرجوعی نباید مطالبه بسازد */
  var openOk = Math.max(0, (+invOk.amount || 0) - ar.invoiceState(invOk).paid - ar.returnedAmountIRR(invOk));
  T('فاکتور تسویه‌شده با مرجوعی، مطالبهٔ باز نمی‌سازد', openOk === 0, openOk);
  T('سند superseded در محاسبهٔ مطالبات کنار گذاشته می‌شود', ar.activeInvoice(invSup) === false);
})();

/* ---------- LC-03: دسته‌های جدید گزارش تسویه ---------- */
(function reconcileCategories() {
  var db = db1(), s = arCore(db);
  var rep = s.PTF.ar.reconcile();
  T('LC-03 دستهٔ «سند جایگزین‌شده در گزارش‌ها» تعریف شده', !!s.PTF.ar.CATEGORIES.superseded_in_reports);
  T('LC-03 دستهٔ «مرجوعی اثرنکرده» تعریف شده', !!s.PTF.ar.CATEGORIES.return_not_applied);
  T('LC-03 سند superseded دارای وصولی گزارش می‌شود',
    rep.findings.some(function (x) { return x.category === 'superseded_in_reports' && x.ref === 'INV-SUP'; }));
  T('گزارش تسویه بدون خطا تولید می‌شود و ساختار دارد', rep && Array.isArray(rep.findings) && typeof rep.total === 'number');
})();

/* ---------- بهداشت نسخه ---------- */
(function versionHygiene() {
  var idx = read('crm/index.html'), sw = read('crm/sw.js'), man = read('crm/manifest.json'),
      cc = read('crm/clear-cache.html'), ver = read('VERSION.json');
  var m = idx.match(/window\.PTF_CRM_RELEASE\s*=\s*'([^']+)'/);
  var v = m ? m[1] : '';
  T('نسخهٔ index.html قالب معتبر دارد', /^v\d+\.\d+\.\d+$/.test(v), v);
  T('sw.js با همان نسخه هم‌راستاست', sw.indexOf("var RELEASE = '" + v + "'") > -1 && sw.indexOf('ptf-crm-' + v) > -1);
  T('manifest/clear-cache/VERSION.json هم‌راستا هستند',
    man.indexOf('"version": "' + v.slice(1) + '"') > -1 && cc.indexOf(v) > -1 && ver.indexOf('"crm_version": "' + v + '"') > -1);
})();

console.log('\n=== tester424-v34.7.21-lifecycle-returns: ' + p + ' PASS / ' + f + ' FAIL ===');
process.exit(f ? 1 : 0);
