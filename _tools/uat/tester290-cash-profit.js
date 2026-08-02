/* tester290 — v33.10.0 (CASH-PROFIT): منطق نقدی سود و تقسیم (مصوب کارفرما)
 * - درآمد واقعی = وصولی‌ها (نقد + چک وصول‌شده)؛ چک در راه درآمد نیست
 * - خروجی = فاکتورهای خرید + پرداخت بدون تخصیص + چک صادرهٔ مستقل + opex + تنخواه (بدون دوباره‌شماری)
 * - کف نقدینگی (دستی)؛ تقسیم فقط از مازاد موجودی نقد پایان بر کف؛ بازگشت به کف (٪)
 * - چک وارده: اثر مالی فقط هنگام وصول
 * - ثبت واقعی تقسیم در دفاتر سهامداران (type:'profit')
 */
'use strict';
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var fiscal = fs.readFileSync(path.join(BASE, 'fiscal.js'), 'utf-8');
var mod = fs.readFileSync(path.join(BASE, 'cheque-module.js'), 'utf-8');

/* ---------- استاب‌ها ---------- */
global.curSession = function () { return { user: 'u1', name: 'علی' }; };
global.curRole = function () { return 'chairman'; };
global.faDate = function () { return '1405/05/11'; };
global.faDateTime = function () { return '1405/05/11 10:00'; };
global.faYear = function () { return '1405'; };
global.genCode = function (p) { return p + '-' + (++global._cdc); };
global._cdc = 0;
global._alerts = [];
global.alert = function (m) { global._alerts.push(String(m)); };
global.confirm = function () { return true; };
global.prompt = function () { return ''; };
global.ptfToast = function () {};
global.audit = function () {};
global.notify = function () {};
global.chUpsertReminder = function () {};
global.ptfNum = function (v) { return +String(v == null ? '' : v).replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); }).replace(/[^0-9.-]/g, '') || 0; };
global.ptfNumWordsFa = function (n) { return String(n); };
global.ptfJToISO = function (s) {
  s = String(s || '').replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); });
  var m = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  return m ? String(+m[1] + 621) + '-' + String(+m[2]).padStart(2, '0') + '-' + String(+m[3]).padStart(2, '0') : '';
};
global.ptfISOToJ = function (iso) {
  var m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? String(+m[1] - 621) + '/' + String(+m[2]).padStart(2, '0') + '/' + String(+m[3]).padStart(2, '0') : iso || '';
};
global.ptfFiscalYearLocked = function () { return false; };
global.ptfFiscalYearOf = function () { return '1405'; };
global.ptfPreviewPrintableDoc = function () {};
global.ptfShareholderBalance = function (cd) {
  var s = (getData('ptf_crm_shareholders') || []).filter(function (x) { return x.cd === cd; })[0] || {};
  var txs = getData('ptf_crm_sharetx') || [];
  var credit = txs.filter(function (t) { return t.shCd === cd && (t.type === 'salary' || t.type === 'profit' || t.type === 'credit'); }).reduce(function (s2, t) { return s2 + (+t.amt || 0); }, 0);
  var debit = txs.filter(function (t) { return t.shCd === cd && (t.type === 'draw' || t.type === 'advance' || t.type === 'debit'); }).reduce(function (s2, t) { return s2 + (+t.amt || 0); }, 0);
  return { net: credit - debit, petty: 0, credit: credit, debit: debit };
};
global.ptfOpexSumFiscal = function (year) { return { total: 1000000, byCat: {} }; };
global.ptfOpexSum = function () { return { total: 0, byCat: {}, totalUnlinked: 0 }; };
global.ptfProjectProfitIRR = function () { return { ok: false, profit: null, sellIrr: 0, buyIrr: 0, projectCostIrr: 0, complete: false, warnings: [] }; };
global.ptfProjectLossTotal = function () { return 0; };
global.ptfFinanceOfficialData = function () {
  return { cfg: { fiscalYear: '1405' }, opening: { cash_bank: 50000000, receivable: 0, supplier_liability: 0, supplier_credit: 0, company_cheque: 0 } };
};
function makeEl(ov) {
  return Object.assign({ value: '', innerHTML: '', textContent: '', style: {},
    remove: function () {}, insertAdjacentHTML: function () {}, setAttribute: function () {},
    addEventListener: function () {}, querySelectorAll: function () { return []; }, querySelector: function () { return null; },
    appendChild: function () {}, options: [], checked: false,
    classList: { add: function () {}, remove: function () {}, contains: function () { return false; } } }, ov || {});
}
global._domGet = {};
global.document = {
  getElementById: function (id) { return global._domGet[id] || makeEl(); },
  querySelector: function () { return makeEl(); },
  querySelectorAll: function () { return []; },
  createElement: function () { return makeEl(); },
  head: makeEl(), body: makeEl({ insertAdjacentHTML: function () {} }),
  addEventListener: function () {}
};
global._domGet['panels'] = makeEl({ insertAdjacentHTML: function () {} });
global.window = global;

/* دادهٔ اولیه — سال 1405 */
setData('ptf_crm_fiscal_snapshots', []);
setData('ptf_crm_shareholders', [
  { cd: 'SH1', name: 'الف', pct: 60, duty: false, salary: 0, active: true },
  { cd: 'SH2', name: 'ب', pct: 40, duty: false, salary: 0, active: true }
]);
setData('ptf_crm_sharetx', []);
setData('ptf_crm_projects', []);
setData('ptf_crm_deals', []);
setData('ptf_crm_offers', []);
setData('ptf_crm_petty', []);
setData('ptf_crm_opex', []);
setData('ptf_crm_payables', []);
setData('ptf_crm_cheques_issued', []);
setData('ptf_crm_cheques_received', []);
setData('ptf_crm_cheques', []);
setData('ptf_crm_supplier_finance', { schema: 1, invoices: [], payments: [], adjustments: [] });
setData('ptf_crm_invoices', [
  { cd: 'INV1', no: 'F-1', offerNo: 'CO-1', amount: 1000000000, t: '1405/02/10', payments: [
    { cd: 'P1', amt: 200000000, t: '1405/02/15', status: 'posted' },                    /* وصول نقد */
    { cd: 'P2', amt: 300000000, t: '1405/02/20', status: 'posted', chequeCd: 'CH-R1' }  /* چک وارده */
  ] },
  { cd: 'INV2', no: 'F-2', offerNo: 'CO-1', amount: 500000000, t: '1405/03/01', payments: [] }
]);
setData('ptf_crm_supplier_finance', { schema: 1,
  invoices: [{ cd: 'SI1', supplierCd: 'S1', amount: 100000000, t: '1405/02/01', status: 'posted' }],   /* فاکتور خرید (کسر) */
  payments: [
    { cd: 'SP1', supplierCd: 'S1', amount: 100000000, allocations: [{ invoiceCd: 'SI1', amount: 100000000 }], method: 'cash', t: '1405/02/05', status: 'posted' }, /* پرداخت بابت فاکتور → بدون دوباره‌شماری */
    { cd: 'SP2', supplierCd: 'S2', amount: 50000000, allocations: [], method: 'cash', t: '1405/02/06', status: 'posted' }  /* پرداخت بدون تخصیص → کسر */
  ], adjustments: [] });
setData('ptf_crm_cheques_received', [{ cd: 'CH-R1', no: 'CH-R1', amt: 300000000, kind: 'finance', st: 'open', custCd: 'C1', t: '1405/02/20' }]); /* چک در راه — هنوز وصول نشده */
setData('ptf_crm_cheques_issued', [
  { cd: 'CH-I1', no: 'CH-I1', amt: 70000000, kind: 'finance', st: 'open', t: '1405/02/25', supplierPaymentCd: 'SP1' }, /* چک با payment → بدون دوباره‌شماری؟ supplierPaymentCd دارد ولی payment نقدی است... در تست: چک مستقل */
  { cd: 'CH-I2', no: 'CH-I2', amt: 40000000, kind: 'finance', st: 'open', t: '1405/02/26' }  /* چک صادرهٔ مستقل (مسائل دیگر) → کسر */
]);
setData('ptf_crm_invoices', getData('ptf_crm_invoices'));

eval.call(global, fiscal);
/* cheque-module فقط برای تست رفتار چک وارده */
eval.call(global, mod);

SECTION('منطق نقدی — داده‌ها');
T('کف نقدینگی: پیش‌فرض صفر + تنظیم دستی', (function () {
  var f0 = ptfFiscalCashFloor('1405');
  ptfFiscalCashFloorSet('1405', 80000000);
  return f0 === 0 && ptfFiscalCashFloor('1405') === 80000000;
})());
var c = ptfFiscalCashData('1405');
T('درآمد نقدی = فقط وصول نقد (چک در راه درآمد نیست)', c.receipts === 200000000 && c.pendingCheques === 300000000);
T('خروجی = فاکتور خرید + پرداخت بدون تخصیص + چک مستقل + opex', (function () {
  return c.outflows.supplierInvoices === 100000000 &&
    c.outflows.unallocatedPayments === 50000000 &&
    c.outflows.independentCheques === 40000000 &&
    c.outflows.opex === 1000000 &&
    c.outflowsTotal === 100000000 + 50000000 + 40000000 + 1000000;
})());
T('سود نقدی و موجودی پایان', (function () {
  /* opening 50M + receipts 200M − outflows 191M = 59M */
  return c.netCash === 200000000 - 191000000 && c.cashEnd === 50000000 + 200000000 - 191000000;
})());

SECTION('توزیع با کف');
var cd = ptfFiscalCashDistribution('1405', 60);
T('مازاد بر کف = max(0, cashEnd − floor)', cd.overFloor === Math.max(0, cd.cashEnd - 80000000));
T('قابل تقسیم = مازاد × ۶۰٪ و بازگشت به کف = ۴۰٪', (function () {
  return cd.distributable === Math.round(cd.overFloor * 60 / 100) && cd.backToFloor === cd.overFloor - cd.distributable;
})());
T('سهم سهامداران بر اساس درصد', (function () {
  var s1 = cd.shareholders.filter(function (x) { return x.cd === 'SH1'; })[0];
  var s2 = cd.shareholders.filter(function (x) { return x.cd === 'SH2'; })[0];
  return s1 && s2 && s1.gross === Math.round(cd.distributable * 60 / 100) && s2.gross === Math.round(cd.distributable * 40 / 100);
})());

SECTION('ثبت واقعی تقسیم در دفاتر سهامداران');
T('زیر کف نقدینگی → تقسیم مسدود (صفر)', (function () {
  global._alerts = [];
  var r = ptfFiscalDividendApply('1405', 60);
  return r.ok === false && global._alerts.length > 0;
})());
T('قبل از قفل سال، ثبت تقسیم مسدود است', (function () {
  ptfFiscalCashFloorSet('1405', 30000000); /* کف ۳۰M → مازاد بر کف = ۲۹M */
  global._alerts = [];
  var r = ptfFiscalDividendApply('1405', 60);
  return r.ok === false && global._alerts.length > 0;
})());
/* قفل سال */
var snaps = getData('ptf_crm_fiscal_snapshots') || [];
snaps.push({ cd: 'SNAP1', type: 'snapshot', year: '1405', locked: true, t: '1405/05/01' });
setData('ptf_crm_fiscal_snapshots', snaps);
var r2 = ptfFiscalDividendApply('1405', 60);
T('پس از قفل: تقسیم در sharetx (type:profit) ثبت شد', r2.ok === true && (function () {
  var txs = getData('ptf_crm_sharetx') || [];
  return txs.filter(function (t) { return t.type === 'profit' && t.dividendYear === '1405'; }).length === 2 &&
    txs.some(function (t) { return t.shCd === 'SH1' && t.amt === Math.round(r2.distributable * 60 / 100); });
})());
T('سند dividend در snapshots + یک‌بار در سال', (function () {
  var dv = (getData('ptf_crm_fiscal_snapshots') || []).filter(function (s) { return s.type === 'dividend' && s.year === '1405'; });
  var again = ptfFiscalDividendApply('1405', 60);
  return dv.length === 1 && again.ok === false;
})());
T('مانده سهامدار پس از تقسیم (سهم + مانده قبلی)', (function () {
  var b1 = ptfShareholderBalance('SH1');
  return b1.credit === Math.round(r2.distributable * 60 / 100);
})());

SECTION('چک وارده: اثر مالی فقط هنگام وصول');
setData('ptf_crm_cheques_received', [{ cd: 'CH-R2', no: 'CH-R2', amt: 100000000, kind: 'finance', st: 'open', custCd: 'C1', sourceInvoiceCd: 'INV2', t: '1405/03/05' }]);
setData('ptf_crm_invoices', getData('ptf_crm_invoices'));
var chR = ptfChequeCreate('received', { no: 'CH-R3', sayad: 'CH-R3', amt: 50000000, kind: 'finance', custCd: 'C1', sourceInvoiceCd: 'INV2', t: '1405/03/10' });
T('ثبت چک وارده: payment روی فاکتور ساخته نمی‌شود (pendingFinancial)', (function () {
  var inv = getData('ptf_crm_invoices').filter(function (i) { return i.cd === 'INV2'; })[0];
  return chR.pendingFinancial === true && !chR.financialApplied && !(inv.payments || []).some(function (p) { return p.chequeCd === chR.cd; });
})());
var coll = ptfChequeCollect(chR.cd, 'وصول شد');
T('وصول چک وارده: payment ساخته می‌شود (تحقق درآمد)', coll.financial && coll.financial.ok && (function () {
  var inv = getData('ptf_crm_invoices').filter(function (i) { return i.cd === 'INV2'; })[0];
  return (inv.payments || []).some(function (p) { return p.chequeCd === chR.cd && p.amt === 50000000; });
})());
T('UI: بلوک سود نقدی + کف + ثبت تقسیم در fiscalHtml', fiscal.indexOf('سود نقدی و تقسیم (منطق نقدی') > -1 && fiscal.indexOf('ptfFiscalCashFloorOpen') > -1 && fiscal.indexOf('ptfFiscalDividendApply') > -1 && fiscal.indexOf('بازگشت به کف') > -1 && fiscal.indexOf('زیر کف') > -1);

DONE('tester290-cash-profit');
