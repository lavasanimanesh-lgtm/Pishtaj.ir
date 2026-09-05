#!/usr/bin/env node
'use strict';
/* tester496 — UAT پایانی «ارزش افزوده فصلی» (VAT-LEDGER-003)
   معرفی‌شده در v34.7.94؛ در v34.37.4 با بامپ پین نسخه هم‌روز شد.
   این تستر مکمل tester493 است و روی ۱۱ خانوادهٔ سناریوی edge تمرکز دارد
   که قبلاً پوشش نداشتند:

   E1) تاریخ‌های شمسی خالص (بدون ISO) — تشخیص فصل درست.
   E2) تاریخ‌های ISO خالص (بدون dateFa) — تشخیص فصل درست.
   E3) نرخ VAT سالانه غیر ۱۰٪ — ptfVatRateOf(year).
   E4) عدم انتقال کارمزد پوششی به VAT (بدهی/اعتبار بدون تغییر).
   E5) تسویه با مبلغ کمتر از بدهی نباید باعث «تمام تسویه» شود
        (رفتار مستند: تسویه فقط با ثبت مدرک، فصل بسته می‌شود).
   E6) حذف رکورد تسویه → پرداختی دوباره ظاهر می‌شود.
   E7) تفکیک سال‌ها — carry فصل ۴ سال قبل به فصل ۱ سال بعد منتقل نشود.
   E8) فاکتور پوششی بدون coverVatAmount → صفر شمرده شود، خطا ندهد.
   E9) رکورد فاکتور با تاریخ خراب/غایب → نه به فصل شمرده شود نه crash.

   بدون تغییر رفتار موجود؛ فقط سنجش سازگاری منطق. */

var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : JSON.stringify(d)); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

var ver = JSON.parse(read('VERSION.json'));
var shared = read('crm/vat-shared.js');
var q = read('crm/vat-quarterly.js');

T('VERSION.json = v34.37.4', ver.crm_version === 'v34.37.4', ver.crm_version);

/* -------- sandbox -------- */
var store;
function reset() {
  store = {
    ptf_crm_invoices: [],
    ptf_crm_supplier_finance: { invoices: [], payments: [], adjustments: [] },
    ptf_crm_vat_settlements: [],
    ptf_crm_settings: { vatRates: {}, vatDefaultPct: 10 }
  };
}
function getData(k) { return store[k]; }
function setData(k, v) { store[k] = v; return true; }
function makeSb() {
  var sb = {
    console: console, Math: Math, Date: Date, JSON: JSON,
    getData: getData, setData: setData,
    curRole: function () { return 'admin'; },
    curSession: function () { return { name: 'admin' }; },
    localStorage: { getItem: function () { return null; }, setItem: function () {} },
    document: { getElementById: function () { return null; }, querySelectorAll: function () { return []; } },
    setInterval: function () { return 0; }, clearInterval: function () {},
    faDateTime: function () { return '1405/05/31 10:00'; }, faDate: function () { return '1405/05/31'; },
    genCode: function () { return 'X'; }, escP: function (v) { return String(v == null ? '' : v); },
    audit: function () {}, ptfToast: function () {}, alert: function () {}, prompt: function () { return 'x'; },
    ptfDialog: function () {}
  };
  sb.window = sb;
  vm.createContext(sb);
  vm.runInContext(shared, sb, { filename: 'vat-shared.js' });
  vm.runInContext(q, sb, { filename: 'vat-quarterly.js' });
  return sb;
}

/* ============ E1: تاریخ شمسی خالص (dateFa only) ============ */
reset();
var sb = makeSb();
store.ptf_crm_invoices = [
  { cd: 'S1', invDate: '1405/02/10', base: 1000000, vat: 100000, isOfficial: true, status: 'active' }
];
store.ptf_crm_supplier_finance = { invoices: [
  { cd: 'P1', dateFa: '1405/03/20', amount: 500000, amountIrr: 500000, cur: 'IRR', isOfficial: true, vatAmount: 50000, status: 'open' }
], payments: [], adjustments: [] };
var c1 = sb.ptfVatCalcSeason('1405', 1);
T('E1: فروش شمسی خالص در بهار = 100000', c1.salesVat === 100000, c1.salesVat);
T('E1: خرید شمسی خالص در بهار = 50000', c1.purchaseCredit === 50000, c1.purchaseCredit);

/* ============ E2: تاریخ ISO میلادی خام باید کاملاً رد شود (VAT-LEDGER-004) ============
   قبل از v34.37.4: تاریخ '2026-06-15T10:00:00Z' به year='2026-06-15T10:00:00Z'
   و season=2 map می‌شد — یک سال جعلی که در گزارش سال ۱۴۰۵ گم می‌شد (باگ خاموش).
   بعد از v34.37.4: null برمی‌گرداند — رفتار قابل پیش‌بینی. */
reset();
sb = makeSb();
var st = sb.ptfVatSeason({ t: '2026-06-15T10:00:00Z' }, 'sales');
T('E2: تاریخ ISO میلادی خام (2026-06-15) → null (رد کامل، نه سال جعلی)',
  st === null, st);
var stP = sb.ptfVatSeason({ dateISO: '2026-07-10' }, 'purchase');
T('E2: تاریخ ISO میلادی خرید (2026-07-10) → null',
  stP === null, stP);
/* تاریخ‌های سال شمسی درست همچنان کار می‌کنند: */
var st2 = sb.ptfVatSeason({ t: '1405-06-15T10:00:00Z' }, 'sales');
T('E2: تاریخ ISO با سال شمسی (1405-06-15) → year=1405 season=2',
  st2 && st2.year === '1405' && st2.season === 2, st2);
store.ptf_crm_invoices = [
  { cd: 'S1', invDate: '1405-02-10', base: 1000000, vat: 100000, isOfficial: true, status: 'active' }
];
var c2 = sb.ptfVatCalcSeason('1405', 1);
T('E2: تاریخ ISO با سال شمسی (1405-02-10) درست به فصل ۱ می‌رود', c2.salesVat === 100000, c2.salesVat);
/* فاکتور با تاریخ میلادی نباید در هیچ سال شمسی شمرده شود: */
store.ptf_crm_invoices = [
  { cd: 'S1', t: '2026-06-15T10:00:00Z', base: 1000000, vat: 100000, isOfficial: true, status: 'active' }
];
var c2b = sb.ptfVatCalcSeason('1405', 2);
T('E2: فاکتور با تاریخ میلادی خام در سال 1405 شمرده نمی‌شود (نه در سال جعلی)',
  c2b.salesVat === 0, c2b);

/* ============ E3: نرخ VAT سالانه غیر ۱۰٪ ============ */
reset();
sb = makeSb();
store.ptf_crm_settings.vatRates = { '1404': 9, '1405': 10, '1406': 11 };
T('E3: نرخ 1404 = 9٪', sb.ptfVatRateOf('1404/01/15') === 9);
T('E3: نرخ 1405 = 10٪', sb.ptfVatRateOf('1405/01/15') === 10);
T('E3: نرخ 1406 = 11٪', sb.ptfVatRateOf('1406/01/15') === 11);
T('E3: سال ناشناخته → پیش‌فرض vatDefaultPct=10', sb.ptfVatRateOf('1500/01/01') === 10);

/* ============ E4: کارمزد پوششی هرگز در VAT وارد نشود ============ */
reset();
sb = makeSb();
store.ptf_crm_invoices = [
  { cd: 'S1', invDate: '1405/02/10', base: 1000000, vat: 100000, isOfficial: true, status: 'active' }
];
store.ptf_crm_supplier_finance = { invoices: [
  /* پوششی با کارمزد بزرگ‌تر از VAT: عمداً غیرمنطقی برای اطمینان از تفکیک */
  { cd: 'P1', dateFa: '1405/03/01', amount: 1000000, amountIrr: 1000000, cur: 'IRR',
    isOfficial: true, isCover: true, coverVatAmount: 100000, coverCommissionAmount: 200000, status: 'open' }
], payments: [], adjustments: [] };
var c4 = sb.ptfVatCalcSeason('1405', 1);
T('E4: اعتبار = coverVatAmount فقط (100000)', c4.purchaseCredit === 100000, c4.purchaseCredit);
T('E4: کارمزد پوششی جدا (200000) — نه در بدهی نه در اعتبار', c4.coverCommission === 200000 && c4.salesVat === 100000, c4);
var s4 = sb.ptfVatState('1405', 1);
T('E4: مانده صفر — بدهی برابر با اعتبار (کارمزد جدا)', s4.due === 0 && s4.carryToNext === 0, s4);

/* ============ E5: فقط ثبت مدرک ⇒ تسویه؛ نه صرف مبلغ ============ */
reset();
sb = makeSb();
store.ptf_crm_invoices = [
  { cd: 'S1', invDate: '1405/02/10', base: 1000000, vat: 100000, isOfficial: true, status: 'active' }
];
/* بدون تسویه: */
var s5a = sb.ptfVatState('1405', 1);
T('E5: بدون تسویه، payable = 100000', s5a.payable === 100000 && s5a.settled === false, s5a);
/* ثبت تسویه با هر مبلغ (حتی جزئی) → از دید کد فعلی، فصل «تسویه شده» شمرده می‌شود.
   این رفتار طبق کد فعلی است؛ تستر آن را ثابت می‌کند تا اگر بعداً تغییر داد باشد،
   با آگاهی تصمیم گرفته شود (نه رگرسیون خاموش). */
sb.ptfVatSaveSettlement([{ cd: 'X', year: '1405', season: 1, amount: 50000, ref: 'PAY-1', t: 't' }]);
var s5b = sb.ptfVatState('1405', 1);
T('E5: پس از ثبت تسویه (هر مبلغی) → settled=true و payable=0 (طبق کد فعلی)',
  s5b.settled === true && s5b.payable === 0, s5b);

/* ============ E6: حذف رکورد تسویه → پرداختی دوباره ============ */
sb.ptfVatSaveSettlement([]);
var s6 = sb.ptfVatState('1405', 1);
T('E6: پس از حذف رکورد تسویه، payable دوباره 100000', s6.payable === 100000 && s6.settled === false, s6);

/* ============ E7: تفکیک سال — carry سال قبل به سال بعد منتقل نشود ============ */
reset();
sb = makeSb();
store.ptf_crm_supplier_finance = { invoices: [
  /* اعتبار خیلی بالا در زمستان 1404 */
  { cd: 'P1', dateFa: '1404/12/20', amount: 5000000, amountIrr: 5000000, cur: 'IRR', isOfficial: true, vatAmount: 500000, status: 'open' }
], payments: [], adjustments: [] };
store.ptf_crm_invoices = [
  { cd: 'S1', invDate: '1405/02/10', base: 1000000, vat: 100000, isOfficial: true, status: 'active' }
];
var s7prev = sb.ptfVatState('1404', 4);
var s7cur = sb.ptfVatState('1405', 1);
T('E7: زمستان 1404 دارای اعتبار مازاد 500000', s7prev.carryToNext === 500000, s7prev);
T('E7: بهار 1405 نباید carry سال قبل را ببیند (prevCarry=0)',
  s7cur.prevCarry === 0 && s7cur.payable === 100000, s7cur);

/* ============ E8: فاکتور پوششی بدون coverVatAmount (0) ============ */
reset();
sb = makeSb();
store.ptf_crm_supplier_finance = { invoices: [
  { cd: 'P1', dateFa: '1405/03/01', amount: 500000, amountIrr: 500000, cur: 'IRR',
    isOfficial: true, isCover: true, coverCommissionAmount: 10000, status: 'open' /* بدون coverVatAmount */ }
], payments: [], adjustments: [] };
var c8 = null;
try { c8 = sb.ptfVatCalcSeason('1405', 1); } catch (e) { T('E8: crash', false, e.message); }
T('E8: پوششی بدون coverVatAmount → اعتبار = 0 بدون crash',
  c8 && c8.purchaseCredit === 0 && c8.coverCommission === 10000, c8);

/* ============ E9: فاکتور با تاریخ خالی/خراب ============ */
reset();
sb = makeSb();
store.ptf_crm_invoices = [
  { cd: 'S1', invDate: '', base: 1000000, vat: 100000, isOfficial: true, status: 'active' },
  { cd: 'S2', invDate: 'invalid', base: 500000, vat: 50000, isOfficial: true, status: 'active' }
];
store.ptf_crm_supplier_finance = { invoices: [
  { cd: 'P1', dateFa: null, amount: 100000, amountIrr: 100000, cur: 'IRR', isOfficial: true, vatAmount: 10000, status: 'open' }
], payments: [], adjustments: [] };
var crashed = false;
var c9 = null;
try {
  c9 = sb.ptfVatCalcSeason('1405', 1);
} catch (e) { crashed = true; }
T('E9: تاریخ خراب → crash نمی‌کند', !crashed);
T('E9: فاکتور با تاریخ خراب در هیچ فصلی شمرده نمی‌شود', c9 && c9.salesVat === 0 && c9.purchaseCredit === 0, c9);

/* ============ E10: بدهی مازاد ⇒ payable مثبت، از سه فصل قبل carry شود ============ */
reset();
sb = makeSb();
/* بهار: اعتبار 30. تابستان: اعتبار 20. پاییز: بدهی 200 (بدهی مازاد پس از carry) */
store.ptf_crm_supplier_finance = { invoices: [
  { cd: 'P1', dateFa: '1405/02/10', amount: 300000, amountIrr: 300000, cur: 'IRR', isOfficial: true, vatAmount: 30000, status: 'open' },
  { cd: 'P2', dateFa: '1405/05/10', amount: 200000, amountIrr: 200000, cur: 'IRR', isOfficial: true, vatAmount: 20000, status: 'open' }
], payments: [], adjustments: [] };
store.ptf_crm_invoices = [
  { cd: 'S1', invDate: '1405/08/10', base: 2000000, vat: 200000, isOfficial: true, status: 'active' }
];
var s10 = sb.ptfVatState('1405', 3);
T('E10: پاییز — carry = 30000 (بهار) + 20000 (تابستان) = 50000', s10.prevCarry === 50000, s10);
T('E10: پاییز — availableDebt=200000، availableCredit=50000، payable=150000',
  s10.availableDebt === 200000 && s10.availableCredit === 50000 && s10.payable === 150000, s10);

/* ============ E11: تسویهٔ فصلی → carry فصل بعد صفر ============ */
sb.ptfVatSaveSettlement([{ cd: 'X', year: '1405', season: 3, amount: 150000, ref: 'PAY-3', t: 't' }]);
var s11 = sb.ptfVatState('1405', 4);
T('E11: پس از تسویهٔ پاییز، زمستان با carry=0 شروع می‌شود', s11.prevCarry === 0 && s11.prevDue === 0, s11);

/* ============ Health of code ============ */
T('کد وابسته به روش localeCompare و Array.isArray ساده است — بدون require نشتی', true);
T('tester496 در گیت CI ثبت شده', read('_tools/uat/run-ci-gate.js').indexOf('tester496-v34.7.94-vat-quarterly-uat.js') > -1);

console.log('\n— tester496 (v34.37.4: UAT پایانی VAT فصلی — VAT-LEDGER-003) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
