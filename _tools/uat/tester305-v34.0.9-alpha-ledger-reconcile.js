/* tester305 — v34.0.9-alpha (هماهنگ‌سازی «تراز رسمی/غیررسمی» و «گزارش مالی تجمیعی»)
   پوشش: مغایرت فاکتور صوری/پوششی در هر دو گزارش + legacy + منفعت ارزش‌افزوده.
   انتظار: با دادهٔ دارای فاکتور پوششی، هر دو گزارش باید با موتور سود هماهنگ باشند:
     - بدهی/هزینه فقط «کارمزد فاکتورساز» پوششی را دارد (نه مبلغ اسمی).
     - منفعت ارزش‌افزودهٔ پوششی جدا است.
     - تعهد legacy از مبلغ بدهی/سود حذف (فقط گزارش). */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');

/* بارگذاری helperهای خالص گزارش */
var ol = fs.readFileSync(path.join(BASE, 'official-ledger.js'), 'utf-8');
eval.call(global, ol);
var lr = fs.readFileSync(path.join(BASE, 'ledger-report.js'), 'utf-8');
eval.call(global, lr);
var sf = fs.readFileSync(path.join(BASE, 'supplier-finance.js'), 'utf-8');
eval.call(global, sf);
var wc = fs.readFileSync(path.join(BASE, 'working-capital.js'), 'utf-8');
eval.call(global, wc);

var vjson = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../VERSION.json'), 'utf-8'));

SECTION('نسخه');
T('lockstep نسخهٔ جاری', /^v\d+(\.\d+){1,2}(-[a-z0-9.]+)?$/.test(vjson.crm_version));

/* ---- آماده‌سازی دادهٔ مشترک ---- */
global.faDate = function () { return '1405/06/15'; };
global.faDateTime = function () { return '1405/06/15 10:00'; };
global.faYear = function () { return '1405'; };
global.jYear = function () { return '1405'; };
global.ptfJToISO = function (j) { return { '1405/01/01': '2026-03-21', '1406/01/01': '2027-03-21', '1405/06/15': '2026-09-06' }[j] || ''; };
global.ptfISOToJ = function () { return '1405/06/15'; };

setData('ptf_crm_fiscal_snapshots', [{ cd: 'CFG1', type: 'fiscal_config_v281', active: true, fiscalYear: '1405', startISO: '2026-03-21', endISO: '2027-03-20', startFa: '1405/01/01', endFa: '1405/12/29', t: '1405/01/01', by: 'admin', updatedAt: '1405/01/01' }]);
setData('ptf_crm_invoices', [
  { cd: 'INV-1', no: 'F1', amount: 400000000, isUnofficial: false, t: '1405/03/01', dateISO: '2026-05-22', payments: [] },
  { cd: 'INV-2', no: 'F2', amount: 100000000, isUnofficial: true, t: '1405/04/01', dateISO: '2026-06-22', payments: [] }
]);
setData('ptf_crm_opex', [
  { cd: 'OPX-1', amt: 30000000, isOfficial: true, month: '1405/03' },
  { cd: 'OPX-2', amt: 20000000, isOfficial: false, month: '1405/04' }
]);
setData('ptf_crm_supplier_finance', { schema: 1, invoices: [
  { cd: 'SFINV-1', supplierCd: 'SUP-1', no: 'P1', amount: 200000000, amountIrr: 200000000, cur: 'IRR', rate: 1, status: 'open', isOfficial: true, dateISO: '2026-05-01', date: '2026-05-01' },
  { cd: 'SFINV-2', supplierCd: 'SUP-2', no: 'C1', amount: 100000000, amountIrr: 100000000, cur: 'IRR', rate: 1, status: 'open', isOfficial: true, isCover: true, coverVatAmount: 10000000, coverCommissionAmount: 1500000, coverNetBenefit: 8500000, dateISO: '2026-05-10', date: '2026-05-10' }
], payments: [], adjustments: [] });
setData('ptf_crm_payables', [{ cd: 'PAY-L1', amount: 70000000, pay: 'credit', cur: 'IRR', rate: 1, item: 'تعهد قدیمی' }]);
setData('ptf_crm_cheques', []);
setData('ptf_crm_suppliers', [{ cd: 'SUP-1', co: 'تامین الف' }, { cd: 'SUP-2', co: 'تامین ب' }]);

/* ---- گزارش A: تراز ---- */
var A = window.ptfLedgerReportData();
SECTION('گزارش A: تراز رسمی/غیررسمی');
T('خرید واقعی بدون فاکتور پوششی (۲۰۰م)', A.realPurchaseTotal === 200000000);
T('منفعت پوششی = اعتبار ارزش‌افزوده − کارمزد (۸.۵م)', A.coverBenefitTotal === 8500000);
T('سود رسمی = فروش رسمی − خرید رسمی (با پوششی) − هزینه رسمی (۷۰م)', A.officialProfit === 70000000);
T('خرید تجمیعی پوششی ندارد (۲۰۰م)', A.aggregatePurchase === 200000000);
T('سود تجمیعی = فروش رسمی+غیررسمی − خرید غیرپوششی − هزینه رسمی+غیررسمی + منفعت پوششی (۲۵۸.۵م)', A.aggregateProfit === 258500000);
T('کارت مستقل منفعت پوششی در تراز تجمیعی هست', lr.indexOf('منفعت خرید فاکتور پوششی') > -1 && lr.indexOf('ledgerAggBox') > -1);

/* ---- گزارش B: تجمیعی ---- */
var B = window.ptfFinanceOfficialData();
SECTION('گزارش B: گزارش مالی تجمیعی');
T('بدهی تأمین‌کننده = فقط خرید واقعی (۲۰۰م) — پوششی مطالبه ندارد', B.total.supplierLiability === 200000000);
T('کارمزد پوششی جدا قابل‌دسترس است', B.coverCommission === 1500000);
T('منفعت ارزش‌افزودهٔ پوششی جدا است', B.coverVat === 10000000);
T('تعهد legacy از بدهی حذف و فقط گزارش می‌شود', B.legacyUnlinked === 70000000 && B.total.supplierLiability === 200000000);
T('legacy در supplierLiability نیست (هیچ legacyای اضافه نشده)', B.source.supplierLiability === 200000000 || B.source.legacyUnlinked === 70000000);

/* ---- هماهنگی A و B ---- */
SECTION('هماهنگی دو گزارش');
T('بدهیB = فقط خرید واقعی (پوششی مطالبه ندارد)', B.total.supplierLiability === A.realPurchaseTotal);
T('منفعت پوششی در هر دو گزارش یکسان است', A.coverBenefitTotal === (B.coverVat - B.coverCommission));

/* ---- بررسی سازگاری supplier-finance balance() ---- */
SECTION('هماهنگی balance() تأمین‌کننده');
(function () {
  /* balance با فاکتور پوششی فقط کارمزد را به بدهی می‌افزاید */
  var bl = window.slSupplierOpenTotalsIRR ? window.slSupplierOpenTotalsIRR() : null;
  T('slSupplierOpenTotalsIRR موجود و بدهی = فقط خرید واقعی (پوششی صفر)', !!bl && bl.debt === 200000000);
})();

DONE('tester305-v34.0.9-alpha');
