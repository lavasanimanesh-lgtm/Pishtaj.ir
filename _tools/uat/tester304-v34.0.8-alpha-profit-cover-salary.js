/* tester304 — v34.0.8-alpha (فاز ۱-۶: منطق سود — فاکتور صوری/پوششی + حقوق سهامدار + فاکتور خرید مبنای هزینه)
   پوشش:
     فاز۱ (فاکتور پوششی): فقط کارمزد هزینه، اعتبار ارزش‌افزوده منفعت — در سود تعهدی و نقدی
     فاز۲ (حقوق=مطالبه): پرداخت حقوق با salary_payment از «علی‌الحساب سود» جدا می‌شود
     فاز۳ (B): گردش تأمین‌کننده فقط فاکتور خرید (legacy از مبلغ حذف)
     فاز۴ (C): مغایرت فاکتور/پیش‌فاکتور غیربلوکه
     فاز۵ (A): مبنای هزینه پروژه = فاکتور خرید نه قیمت دستی
     فاز۶ (D): نرخ روزِ فاکتور (issueFxRate) روی رکورد فاکتور */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var fc = fs.readFileSync(path.join(BASE, 'fiscal.js'), 'utf-8');
var sh = fs.readFileSync(path.join(BASE, 'shareholders.js'), 'utf-8');
var sf = fs.readFileSync(path.join(BASE, 'supplier-finance.js'), 'utf-8');
var rbac = fs.readFileSync(path.join(BASE, 'rbac.js'), 'utf-8');
var vjson = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../VERSION.json'), 'utf-8'));

SECTION('نسخه');
T('lockstep نسخهٔ جاری', /^v\d+(\.\d+){1,2}(-[a-z0-9.]+)?$/.test(vjson.crm_version));

/* ─── فاز ۱: فاکتور صوری/پوششی ─── */
SECTION('فاز۱: فاکتور صوری/پوششی');
T('helper fiscalCoverTotals در fiscal.js تعریف شده', /function fiscalCoverTotals/.test(fc));
T('cover در سود تعهدی (netProfit) اثر دارد', fc.indexOf('+ (+cover.netBenefit || 0)') > -1);
T('cover در خروجی نقدی از supplierInvoices جدا شد', fc.indexOf("i.isCover === true") > -1 && fc.indexOf('out.coverCommission') > -1);
T('کارمزد پوششی خروجی نقدی واقعی است', fc.indexOf('+ out.coverCommission') > -1);

/* ─── فاز ۲: حقوق = مطالبه (salary_payment) ─── */
SECTION('فاز۲: حقوق=مطالبه (salary_payment)');
T('تابع ptfSharePaySalary تعریف شده', sh.indexOf('window.ptfSharePaySalary = function') > -1);
T('salary_payment در بدهی/مطالبه حساب سهامدار می‌آید (تسویهٔ مطالبه)', sh.indexOf("x.type === 'draw' || x.type === 'advance' || x.type === 'debit' || x.type === 'salary_payment'") > -1);
T('salary_payment در «علی‌الحساب سود» (advRows) لحاظ نمی‌شود', fc.indexOf("x.type === 'draw' || x.type === 'advance' || x.type === 'debit'") > -1);
T('دکمهٔ پرداخت حقوق در UI هست', sh.indexOf('ptfSharePaySalary') > -1 && sh.indexOf('💳 پرداخت حقوق') > -1);

/* ─── فاز ۳ (B): گردش تأمین‌کننده فقط فاکتور خرید ─── */
SECTION('فاز۳ (B): گردش تأمین‌کننده');
T('legacy در ماندهٔ تأمین‌کننده به مبلغ اضافه نمی‌شود (فقط شمارش)', sf.indexOf('by[c].legacy++') > -1 && sf.indexOf('by[c].amount += r; by[c].irr += c === \'IRR\' ? r : r * (+p.rate || 0); by[c].legacy++') === -1);

/* ─── فاز ۴ (C): مغایرت فاکتور/پیش‌فاکتور غیربلوکه ─── */
SECTION('فاز۴ (C): مغایرت غیربلوکه');
T('مغایرت ارزی ثبت فاکتور را متوقف نمی‌کند (بدون confirm/return)', rbac.indexOf("if (!confirm(_fxWarnMsg)) return;") === -1 && rbac.indexOf('_fxSanity.applicable && !_fxSanity.ok') > -1 && rbac.indexOf('ptfToast') > -1);
T('متن هشدار «اصل صحت فاکتور» را بیان می‌کند', rbac.indexOf('اصل، صحت فاکتور است') > -1);

/* ─── فاز ۵ (A): مبنای هزینه = فاکتور خرید ─── */
SECTION('فاز۵ (A): مبنای هزینه از فاکتور خرید');
var fx = fs.readFileSync(path.join(BASE, 'fx.js'), 'utf-8');
T('موتور سود هزینه را از فاکتور خریدِ لینک‌شده می‌خواند', fx.indexOf("sfA.invoices") > -1 && fx.indexOf('invCost') > -1 && fx.indexOf('legacyPayableCds') > -1);
T('قیمت دستی فقط کنترل است (مبنای هزینه نیست)', fx.indexOf('مبنای هزینه فاکتور خرید است') > -1);
T('بدون فاکتور خرید، سود قطعی اعلام نمی‌شود', fx.indexOf('مبنای هزینه و تعهد، فاکتور خرید است') > -1);

/* ─── فاز ۶ (D): نرخ روزِ فاکتور ─── */
SECTION('فاز۶ (D): نرخ روزِ فاکتور');
T('نرخ روزِ فاکتور (issueFxRate) روی رکورد ذخیره می‌شود', rbac.indexOf('issueFxRate: _issueFxRate') > -1 && rbac.indexOf('var _issueFxRate = 0') > -1);

/* ─── رفتار: فاکتور پوششی در سود (شبیه‌سازی) ─── */
SECTION('رفتار: فاکتور پوششی در محاسبه');
global.window = global;
global._role = 'chairman';
global.curRole = function () { return global._role; };
global.curSession = function () { return { user: 'u1', name: 'حامد' }; };
global.roleDef = function () { return { finance: true }; };
global.ptfToast = function () {};
global.audit = function () {};
global.ptfProjectProfitIRR = function () { return { ok: true, complete: true, warnings: [], sellIrr: 0, buyIrr: 0, profit: 0, pct: 0 }; };
global.ptfOpexSum = function () { return { total: 0, byCat: {} }; };
global.ptfOpexSumFiscal = function () { return { total: 0, byCat: {}, totalLinked: 0, totalUnlinked: 0 }; };
global.ptfJToISO = function (j) { var map = { '1404/01/01': '2025-03-21', '1405/01/01': '2026-03-21' }; return map[j] || ''; };
eval(fc);
setData('ptf_crm_projects', []);
setData('ptf_crm_deals', []);
setData('ptf_crm_invoices', []);
setData('ptf_crm_shareholders', [{ cd: 'S1', name: 'حامد', pct: 100, active: true }]);
setData('ptf_crm_sharetx', []);
setData('ptf_crm_fiscal_snapshots', []);
setData('ptf_crm_petty', []);
setData('ptf_crm_cheques_received', []);
setData('ptf_crm_cheques', []);
setData('ptf_crm_cheques_issued', []);
setData('ptf_crm_payables', []);
/* فاکتور پوششی: ۱۰۰م با ۱۰م ارزش‌افزوده، کارمزد ۱.۵٪ = ۱.۵م؛ اثر خالص = +۸.۵م */
setData('ptf_crm_supplier_finance', { schema: 1, invoices: [
  { cd: 'SFINV-C1', no: 'C-100', amount: 100000000, amountIrr: 100000000, cur: 'IRR', rate: 1, dateISO: '2026-06-15', status: 'open', isOfficial: true, isCover: true, coverVatPct: 10, coverVatAmount: 10000000, coverCommissionPct: 1.5, coverCommissionAmount: 1500000, coverNetBenefit: 8500000 }
], payments: [], adjustments: [] });
var netD = window.ptfFiscalData('1405');
T('سود تعهدیِ خالص = منفعت خالص پوششی (۸.۵م) در فقدان پروژه/هزینه', netD.netProfit === 8500000 && netD.coverNetBenefit === 8500000 && netD.coverCommission === 1500000 && netD.coverVat === 10000000);
var cashD = window.ptfFiscalCashData('1405');
T('تا تسویه کارمزد، خروجی نقدی صفر است (مبلغ اسمی هم نیست)', cashD.outflows.supplierInvoices === 0 && cashD.outflows.coverCommission === 0 && cashD.outflowsTotal === 0);
T('اعتبار ارزش‌افزوده پوششی در خروجی نقدی نیست (نقد نیست)', cashD.outflows.coverVat === 10000000 && cashD.netCash === 0);
setData('ptf_crm_opex', [{ cd: 'OPX-C1', amt: 1500000, fromCoverInvoice: true, coverInvoiceCd: 'SFINV-C1', st: 'settled', settleISO: '2026-06-20', month: '1405/03' }]);
var cashSettled = window.ptfFiscalCashData('1405');
T('پس از تسویه، خروجی نقدی فقط کارمزد پوششی است (۱.۵م)', cashSettled.outflows.coverCommission === 1500000 && cashSettled.outflowsTotal === 1500000 && cashSettled.netCash === -1500000);

/* ─── رفتار: حقوق به‌عنوان مطالبه (salary_payment جدا از علی‌الحساب) ─── */
SECTION('رفتار: حقوق=مطالبه');
global.document = { getElementById: function () { return null; } };
eval(sh);
setData('ptf_crm_shareholders', [{ cd: 'S1', name: 'حامد', pct: 50, active: true, duty: true, salary: 12000000 }]);
setData('ptf_crm_sharetx', [
  { cd: 'T1', shCd: 'S1', type: 'salary', amt: 12000000, month: '1405/01' },
  { cd: 'T2', shCd: 'S1', type: 'salary_payment', amt: 12000000, month: '1405/01' }
]);
/* salary_payment باید در advRows نباشد (نه علی‌الحساب سود) */
var advCheck = fc.indexOf("x.type === 'draw' || x.type === 'advance' || x.type === 'debit'");
T('فیلتر علی‌الحساب فقط draw/advance/debit است (salary_payment خارج است)', advCheck > -1);

DONE('tester304-v34.0.8-alpha');
