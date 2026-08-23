#!/usr/bin/env node
'use strict';
/* v34.7.97 — تست رفتاری «ارزش افزوده فصلی» (VAT-LEDGER-002).
   با دادهٔ مصنوعی، هستهٔ محاسبه (ptfVatCalcSeason / ptfVatState) را اجرا می‌کند:
   - بدهی VAT فروش رسمی + اعتبار VAT خرید واقعی/پوششی
   - کارمزد فاکتورساز در VAT وارد نمی‌شود
   - اعتبار مازاد به فصل بعد منتقل می‌شود
   - پس از تسویه، فصل بعد از صفر شروع می‌شود
   - فاکتور غیررسمی و ابطالی در محاسبه وارد نمی‌شود
   - نرخ مصوب سال از vat-shared (پیش‌فرض ۱۰) */
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

var ver = JSON.parse(read('VERSION.json'));
var idx = read('crm/index.html');
var shared = read('crm/vat-shared.js');
var q = read('crm/vat-quarterly.js');

T('VERSION.json = v34.7.97', ver.crm_version === 'v34.7.97', ver.crm_version);
T('vat-quarterly.js cache-bust 34.7.97', /vat-quarterly\.js\?v=34\.7\.97/.test(idx));
T('توابع خالص export شده‌اند', /window\.ptfVatCalcSeason = calc/.test(q) && /window\.ptfVatState = stateFor/.test(q));

/* ---------- sandbox ---------- */
var store = {
  ptf_crm_invoices: [],
  ptf_crm_supplier_finance: { invoices: [], payments: [], adjustments: [] },
  ptf_crm_vat_settlements: [],
  ptf_crm_settings: { vatRates: {}, vatDefaultPct: 10 }
};
function getData(k) { return store[k] || []; }
function setData(k, v) { store[k] = v; return true; }
var sb = {
  console: console, Math: Math, Date: Date, JSON: JSON,
  getData: getData, setData: setData,
  curRole: function () { return 'admin'; },
  localStorage: { getItem: function () { return null; }, setItem: function () {} },
  document: { getElementById: function () { return null; }, querySelectorAll: function () { return []; } },
  setInterval: function () { return 0; }, clearInterval: function () {},
  faDateTime: function () { return '1405/05/31 10:00'; }, faDate: function () { return '1405/05/31'; },
  genCode: function () { return 'X'; }, escP: function (v) { return String(v == null ? '' : v); },
  audit: function () {}, ptfToast: function () {}, alert: function () {}, prompt: function () { return 'x'; },
  ptfDialog: function () {}, ptfNum: function (v) { return +v || 0; },
  ptfISOToJ: function (v) { return v || ''; }, ptfJToISO: function (v) { return v || ''; }
};
sb.window = sb;
vm.createContext(sb);
try { vm.runInContext(shared, sb, { filename: 'vat-shared.js' }); vm.runInContext(q, sb, { filename: 'vat-quarterly.js' }); }
catch (e) { console.error('LOAD FAIL', e.stack); process.exit(1); }

/* ---------- سناریو A: بدهی < اعتبار ---------- */
store.ptf_crm_invoices = [
  /* فروش رسمی فصل بهار 1405: VAT = 100000 */
  { cd: 'S1', offerNo: 'CO1', invDate: '1405/02/15', base: 1000000, vatPercent: 10, vat: 100000, amount: 1100000, isOfficial: true, status: 'active' },
  /* غیررسمی + ابطالی → نباید وارد شود */
  { cd: 'S2', offerNo: 'CO2', invDate: '1405/02/20', base: 500000, vatPercent: 10, vat: 50000, amount: 550000, isOfficial: false, status: 'active' },
  { cd: 'S3', offerNo: 'CO3', invDate: '1405/02/22', base: 400000, vatPercent: 10, vat: 40000, amount: 440000, isOfficial: true, status: 'void' }
];
store.ptf_crm_supplier_finance = { invoices: [
  /* خرید رسمی واقعی بهار: VAT = 80000 */
  { cd: 'P1', dateFa: '1405/03/01', dateISO: '1405-03-01', amount: 800000, amountIrr: 800000, cur: 'IRR', isOfficial: true, vatPct: 10, vatAmount: 80000, status: 'open' },
  /* خرید پوششی بهار: VAT = 200000، کارمزد = 40000 */
  { cd: 'P2', dateFa: '1405/03/05', dateISO: '1405-03-05', amount: 2000000, amountIrr: 2000000, cur: 'IRR', isOfficial: true, isCover: true, coverVatPct: 10, coverVatAmount: 200000, coverCommissionPct: 2, coverCommissionAmount: 40000, status: 'open' },
  /* غیررسمی → نباید وارد شود */
  { cd: 'P3', dateFa: '1405/03/08', dateISO: '1405-03-08', amount: 900000, amountIrr: 900000, cur: 'IRR', isOfficial: false, status: 'open' },
  /* ابطالی → نباید وارد شود */
  { cd: 'P4', dateFa: '1405/03/09', dateISO: '1405-03-09', amount: 300000, amountIrr: 300000, cur: 'IRR', isOfficial: true, vatAmount: 30000, status: 'void' }
], payments: [], adjustments: [] };

var c1 = sb.ptfVatCalcSeason(1405, 1);
T('A: بدهی فروش = 100000 (رسمی، غیررسمی/ابطالی حذف)', c1.salesVat === 100000, c1.salesVat);
T('A: اعتبار خرید = 280000 (واقعی 80000 + پوششی 200000)', c1.purchaseCredit === 280000, c1.purchaseCredit);
T('A: کارمزد پوششی جدا گزارش می‌شود (40000) ولی در VAT نیست', c1.coverCommission === 40000 && c1.purchaseCredit === 280000, c1);
T('A: مانده = -180000 (اعتبار مازاد)', Math.round(c1.net) === -180000, c1.net);

var s1 = sb.ptfVatState(1405, 1);
T('A: اعتبار مازاد 180000 به فصل بعد منتقل می‌شود', s1.carryToNext === 180000 && s1.prevCarry === 0, s1);

/* ---------- سناریو B: بدهی > اعتبار + منتقل فصل قبل ---------- */
/* برای آزمون زنجیره‌ای، دادهٔ بهار (فصل 1) و تابستان (فصل 2) را دقیق جدا می‌کنیم. */
store.ptf_crm_invoices = [
  /* فصل 1 فقط S1 */
  { cd: 'S1', offerNo: 'CO1', invDate: '1405/02/15', base: 1000000, vatPercent: 10, vat: 100000, amount: 1100000, isOfficial: true, status: 'active' },
  /* فصل 2 فقط S5 */
  { cd: 'S5', offerNo: 'CO5', invDate: '1405/05/15', base: 2000000, vatPercent: 10, vat: 200000, amount: 2200000, isOfficial: true, status: 'active' }
];
store.ptf_crm_supplier_finance = { invoices: [
  /* فصل 1 */
  { cd: 'P1', dateFa: '1405/03/01', dateISO: '1405-03-01', amount: 800000, amountIrr: 800000, cur: 'IRR', isOfficial: true, vatAmount: 80000, status: 'open' },
  { cd: 'P2', dateFa: '1405/03/05', dateISO: '1405-03-05', amount: 2000000, amountIrr: 2000000, cur: 'IRR', isOfficial: true, isCover: true, coverVatPct: 10, coverVatAmount: 200000, coverCommissionPct: 2, coverCommissionAmount: 40000, status: 'open' },
  /* فصل 2 */
  { cd: 'P5', dateFa: '1405/05/01', dateISO: '1405-05-01', amount: 400000, amountIrr: 400000, cur: 'IRR', isOfficial: true, vatAmount: 40000, status: 'open' }
], payments: [], adjustments: [] };
var s2 = sb.ptfVatState(1405, 2);
/* فصل 2 (تابستان): بدهی=200000، اعتبار=40000، پیش=اعتبار 180000 از بهار */
T('B: بدهی فصل 2 = 200000', s2.cur.salesVat === 200000, s2.cur.salesVat);
T('B: اعتبار فصل ۲ + منتقل = 40000+180000 = 220000', s2.availableCredit === 220000, s2.availableCredit);
T('B: مانده (خالص با منتقل‌شده) = -20000 → اعتبار مازاد 20000', Math.round(s2.availableDebt - s2.availableCredit) === -20000 && s2.carryToNext === 20000, s2);
T('B: پرداختی فصل ۲ = 0 (چون اعتبار کافی)', s2.payable === 0, s2.payable);

/* ---------- سناریو C: تسویه + صفر شدن فصل بعد ---------- */
store.ptf_crm_invoices = [
  { cd: 'S6', offerNo: 'CO6', invDate: '1405/07/15', base: 1500000, vatPercent: 10, vat: 150000, amount: 1650000, isOfficial: true, status: 'active' }
];
store.ptf_crm_supplier_finance = { invoices: [], payments: [], adjustments: [] };
/* تسویه فصل 3 (پاییز) */
sb.ptfVatSaveSettlement([{ cd: 'VATSTL-1', year: 1405, season: 3, amount: 150000, ref: 'PAY-1', note: '', files: [], t: '1405/09/30', by: 'admin' }]);
var s3 = sb.ptfVatState(1405, 3);
T('C: فصل 3 تسویه شده است', s3.settled === true, s3);
T('C: پس از تسویه payable=0 (پرداختی ندارد)', s3.payable === 0, s3.payable);
T('C: فصل بعد (زمستان) با اعتبار منتقل از هیچ (صفر شروع)', sb.ptfVatState(1405, 4).prevCarry === 0, sb.ptfVatState(1405, 4).prevCarry);

/* ---------- سناریو D: non-گذشته (بدهی سال قبل نه منتقل) ---------- */
var s4 = sb.ptfVatState(1404, 1);
T('D: بدون داده فصل → صفر', s4.cur.salesVat === 0 && s4.cur.purchaseCredit === 0, s4.cur);

T('tester493 در گیت CI', read('_tools/uat/run-ci-gate.js').indexOf('tester493-v34.7.91-vat-quarterly-behavior.js') > -1);

console.log('\n— tester493 (v34.7.97: رفتار ارزش افزوده فصلی — VAT-LEDGER-002) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
