/* tester308 — v34.0.12-alpha (فاز ۹: هماهنگ‌سازی تعهد لگاسی در سود سال مالی + ترتیب تاریخ گزارش تنخواه)
   پوشش:
     ۱) تعهد لگاسیِ لینک‌نشده دیگر در خروجی نقدی سود سال مالی دوباره‌شماری نمی‌شود
        (هماهنگ با فاز ۳/۶ و balance/working-capital)
     ۲) گزارش دورهٔ تنخواه به ترتیب درست تاریخ (نرمال‌سازی شمسی/میلادی + مقایسهٔ عددی) */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var vjson = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../VERSION.json'), 'utf-8'));
var fiscal = fs.readFileSync(path.join(BASE, 'fiscal.js'), 'utf-8');
var petty = fs.readFileSync(path.join(BASE, 'petty.js'), 'utf-8');

SECTION('نسخه');
T('lockstep نسخهٔ جاری', /^v\d+(\.\d+){1,2}(-[a-z0-9.]+)?$/.test(vjson.crm_version));

/* ---- اصلاح ۱: تعهد لگاسی در سود سال مالی ---- */
SECTION('اصلاح ۱: تعهد لگاسی در fiscal.js');
T('payables/legacy دیگر در خروجی نقدی سود نمی‌آید (return صریح)', fiscal.indexOf("p.pay !== 'credit'") > -1 && fiscal.indexOf("legacy دیگر در خروجی نقدی سود نمی‌آید") > -1);
T('فقط فاکتور خرید در supplierInvoices جمع می‌شود', /sf\.invoices[\s\S]*?out\.supplierInvoices \+=/.test(fiscal));

/* ---- رفتار: شبیه‌سازی تعهد لینک‌نشده + فاکتور ---- */
(function () {
  global.window = global;
  global._role = 'chairman';
  global.curRole = function () { return 'chairman'; };
  global.faDate = function () { return '1405/06/15'; };
  global.faDateTime = function () { return '1405/06/15 10:00'; };
  global.faYear = function () { return '1405'; };
  global.jYear = function () { return '1405'; };
  global.ptfJToISO = function (j) { return { '1405/01/01': '2026-03-21', '1406/01/01': '2027-03-21', '1405/02/01': '2026-04-21' }[j] || ''; };
  global.ptfISOToJ = function () { return '1405/06/15'; };
  global.ptfProjectProfitIRR = function () { return { ok: true, complete: true, warnings: [], sellIrr: 0, buyIrr: 0, profit: 0 }; };
  global.ptfOpexSum = function () { return { total: 0, byCat: {} }; };
  global.ptfOpexSumFiscal = function () { return { total: 0, byCat: {} }; };
  setData('ptf_crm_projects', []); setData('ptf_crm_deals', []);
  setData('ptf_crm_invoices', []); setData('ptf_crm_opex', []);
  setData('ptf_crm_shareholders', []); setData('ptf_crm_sharetx', []);
  setData('ptf_crm_fiscal_snapshots', []); setData('ptf_crm_petty', []);
  setData('ptf_crm_cheques_received', []); setData('ptf_crm_cheques', []); setData('ptf_crm_cheques_issued', []);
  eval.call(global, fiscal);
  /* تعهد 100م لینک‌نشده + فاکتور 100م */
  setData('ptf_crm_payables', [{ cd: 'PAY-L1', amount: 100000000, pay: 'credit', cur: 'IRR', rate: 1, t: '1405/02/01', dateISO: '2026-04-21' }]);
  setData('ptf_crm_supplier_finance', { schema: 1, invoices: [
    { cd: 'SFINV-1', amount: 100000000, amountIrr: 100000000, cur: 'IRR', rate: 1, status: 'open', dateISO: '2026-05-01', date: '2026-05-01' }
  ], payments: [], adjustments: [] });
  var c = window.ptfFiscalCashData('1405');
  T('خروجی فقط فاکتور است (۱۰۰م، نه ۲۰۰م) — دوباره‌شماری نشد', c.outflows.supplierInvoices === 100000000);
})();

/* ---- اصلاح ۲: ترتیب گزارش تنخواه ---- */
SECTION('اصلاح ۲: ترتیب تاریخ گزارش تنخواه');
T('مرتب‌سازی با recDate/recDateCmp (نرمال‌سازی شمسی/میلادی)', petty.indexOf('recDate(a)') > -1 && petty.indexOf('recDateCmp(da, db)') > -1);
T('رکورد بی‌تاریخ به انتها می‌رود (hasDate منطق دارد)', petty.indexOf('var ha = da ? 1 : 0') > -1);

/* رفتار */
(function () {
  global.window = global;
  global.curRole = function () { return 'admin'; };
  global.faDate = function () { return '1405/06/15'; };
  global.faDateTime = function () { return '1405/06/15 10:00'; };
  global.faYear = function () { return '1405'; };
  global.ptfJToISO = function (j) { return { '1405/04/15': '2026-07-05', '1405/05/10': '2026-07-30', '1405/05/20': '2026-08-09', '1405/06/01': '2026-08-21' }[j] || ''; };
  global.ptfISOToJ = function (iso) { return { '2026-07-05': '1405/04/15', '2026-07-30': '1405/05/10', '2026-08-09': '1405/05/20', '2026-08-21': '1405/06/01' }[iso] || '1405/06/15'; };
  global.ptfPettyBalance = function () { return { cash: 0, out: 0, advance: 0 }; };
  global.ptfPettyPendingByUser = function () { return {}; };
  setData('ptf_crm_petty', [
    { cd: 'P1', amt: 100, cat: 'اداری', t: '1405/05/20', st: 'open', by: 'الف', month: '1405/05' },
    { cd: 'P2', amt: 200, cat: 'حمل', t: '2026-07-30', st: 'open', by: 'ب', month: '1405/05' },
    { cd: 'P3', amt: 300, cat: 'تلفن', t: '1405/05/10', st: 'open', by: 'ج', month: '1405/05' },
    { cd: 'P4', amt: 400, cat: 'ایاب', t: '2026-08-21', st: 'open', by: 'د', month: '1405/06' }
  ]);
  setData('ptf_crm_petty_tx', []);
  eval.call(global, petty);
  var ev = window.ptfPettyPeriodEvents('1405/05/01', '1405/06/30');
  var order = ev.map(function (e) { return e.cd; }).join(',');
  T('تاریخ‌ها صعودی مرتب شدند (P1 05/20 قبل از P4 06/01)', order.indexOf('P1') > -1 && order.indexOf('P4') > -1 && order.indexOf('P1') < order.indexOf('P4'));
  T('اولین ردیف مربوط به 05/10 است (P2 یا P3)', order.split(',')[0] === 'P2' || order.split(',')[0] === 'P3');
  T('آخرین ردیف مربوط به 06/01 (P4) است', order.split(',')[order.split(',').length - 1] === 'P4');
})();

DONE('tester308-v34.0.12-alpha');
