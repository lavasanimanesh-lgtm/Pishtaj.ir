/* tester306 — v34.0.10-alpha (شفافیت تراز رسمی/غیررسمی + reconciliation گزارش تجمیعی)
   پوشش:
     ۱) باکت «نامشخص» در تراز به‌صورت صریح + دکمهٔ رفتن به کیفیت داده
     ۲) بازسازی بدهی تأمین‌کننده در گزارش تجمیعی (recSup)
     ۳) cover/legacy همچنان هماهنگ */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');

var lr = fs.readFileSync(path.join(BASE, 'ledger-report.js'), 'utf-8');
var wc = fs.readFileSync(path.join(BASE, 'working-capital.js'), 'utf-8');
eval.call(global, fs.readFileSync(path.join(BASE, 'official-ledger.js'), 'utf-8'));
eval.call(global, lr);
eval.call(global, fs.readFileSync(path.join(BASE, 'supplier-finance.js'), 'utf-8'));
eval.call(global, wc);

var vjson = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../VERSION.json'), 'utf-8'));

SECTION('نسخه');
T('lockstep نسخهٔ جاری', /^v\d+(\.\d+){1,2}(-[a-z0-9.]+)?$/.test(vjson.crm_version));

/* ---- داده: خرید رسمی ۰ + غیررسمی ۱۸۱ + نامشخص ۱۵ = ۱۹۶؛ opex ۹۶+۲۹۰+۴۰=۴۲۶ ---- */
global.faDate = function () { return '1405/06/15'; };
global.faDateTime = function () { return '1405/06/15 10:00'; };
global.faYear = function () { return '1405'; };
global.jYear = function () { return '1405'; };
global.ptfJToISO = function (j) { return { '1405/01/01': '2026-03-21', '1406/01/01': '2027-03-21', '1405/06/15': '2026-09-06' }[j] || ''; };
global.ptfISOToJ = function () { return '1405/06/15'; };
global.ptfPayableRemain = function (p) { return Math.max(0, (+p.amount || 0) - (p.paid || []).reduce(function (s, x) { return s + (+x.amt || 0); }, 0)); };

setData('ptf_crm_fiscal_snapshots', [
  { cd: 'CFG1', type: 'fiscal_config_v281', active: true, fiscalYear: '1405', startISO: '2026-03-21', endISO: '2027-03-20', startFa: '1405/01/01', endFa: '1405/12/29', t: '1405/01/01', by: 'admin', updatedAt: '1405/01/01' },
  { cd: 'OPEN-1', type: 'opening_balance_v281', fiscalYear: '1405', category: 'supplier_liability', amountIrr: 450000000, note: 'قبل از CRM', status: 'posted', t: '1405/01/01', by: 'admin' }
]);
setData('ptf_crm_invoices', [
  { cd: 'INV-1', amount: 400000000, isUnofficial: false, t: '1405/03/01', dateISO: '2026-05-22', payments: [] },
  { cd: 'INV-2', amount: 100000000, isUnofficial: true, t: '1405/04/01', dateISO: '2026-06-22', payments: [] }
]);
setData('ptf_crm_opex', [
  { cd: 'OPX-O1', amt: 96000000, isOfficial: true, month: '1405/03' },
  { cd: 'OPX-O2', amt: 290000000, isOfficial: false, month: '1405/04' },
  { cd: 'OPX-O3', amt: 40000000, month: '1405/05' }
]);
setData('ptf_crm_supplier_finance', { schema: 1, invoices: [
  { cd: 'SFINV-U1', supplierCd: 'SUP-U', no: 'U1', amount: 181000000, amountIrr: 181000000, cur: 'IRR', rate: 1, status: 'open', isOfficial: false, dateISO: '2026-05-01', date: '2026-05-01' },
  { cd: 'SFINV-X1', supplierCd: 'SUP-X', no: 'X1', amount: 15000000, amountIrr: 15000000, cur: 'IRR', rate: 1, status: 'open', dateISO: '2026-05-02', date: '2026-05-02' },
  { cd: 'SFINV-P1', supplierCd: 'SUP-P', no: 'P1', amount: 400000000, amountIrr: 400000000, cur: 'IRR', rate: 1, status: 'open', isOfficial: true, dateISO: '2025-11-01', date: '2025-11-01' }
], payments: [
  { cd: 'PAY-1', supplierCd: 'SUP-U', dateISO: '2026-06-01', amount: 31000000, amountIrr: 31000000, cur: 'IRR', rate: 1, allocations: [{ invoiceCd: 'SFINV-U1', amount: 31000000 }], unallocated: 0, status: 'posted' }
], adjustments: [] });
setData('ptf_crm_payables', []);
setData('ptf_crm_cheques', []);
setData('ptf_crm_suppliers', [{ cd: 'SUP-U', co: 'تامین غیررسمی' }, { cd: 'SUP-X', co: 'تامین نامشخص' }, { cd: 'SUP-P', co: 'تامین سال قبل' }]);

/* ---- گزارش A: تراز ---- */
var A = window.ptfLedgerReportData();
SECTION('گزارش A: تراز — باکت نامشخص صریح');
T('خرید: رسمی+غیررسمی+نامشخص = کل (همهٔ فاکتورها)', A.purchase.official + A.purchase.unofficial + A.purchase.unclassified === A.purchase.total && A.purchase.total === 596000000);
T('هزینه جاری: 96+290+40=426', A.opex.official + A.opex.unofficial + A.opex.unclassified === A.opex.total && A.opex.total === 426000000);
T('نامشخص خرید=15 و هزینه=40 شناسایی شد', A.purchase.unclassified === 15000000 && A.opex.unclassified === 40000000);
T('دکمهٔ «باز در کیفیت داده» در UI هست', lr.indexOf('ptfLedgerGoQuality') > -1 && lr.indexOf('باز در کیفیت داده') > -1);
T('کارت «نامشخص» در بخش تجمیعی هست', lr.indexOf('نامشخص') > -1);

/* ---- گزارش B: تجمیعی — reconciliation ---- */
var B = window.ptfFinanceOfficialData();
SECTION('گزارش B: بازسازی بدهی تأمین‌کننده');
T('recSup موجود و افتتاحیه را دارد', B.recSup && B.recSup.opening === 450000000);
var calc = B.recSup.opening + B.recSup.invoicesThis + B.recSup.invoicesPrior + B.recSup.adjustments - B.recSup.paysThis - B.recSup.paysPrior;
T('بازسازی = بدهی گزارش (۴۵۰+۱۹۶+۴۰۰−۳۱=۱۰۱۵م)', calc === B.total.supplierLiability && calc === 1015000000);
T('فاکتور امسال=196 و پرداخت امسال=31 در recSup', B.recSup.invoicesThis === 196000000 && B.recSup.paysThis === 31000000);
T('فاکتور سال قبل=400 در recSup', B.recSup.invoicesPrior === 400000000);
T('بلوک «بازسازی بدهی» در HTML گزارش هست', wc.indexOf('بازسازی بدهی باز تأمین‌کنندگان') > -1);
T('توضیح «ماندهٔ تجمعی» در HTML هست', wc.indexOf('ماندهٔ تجمعی') > -1);

/* ---- هماهنگی cover/legacy ---- */
SECTION('هماهنگی cover/legacy');
T('بدهی = خرید واقعی + کارمزد پوششی (بدون cover داده‌ای)', B.total.supplierLiability === 1015000000);
T('legacy از بدهی حذف (اینجا legacyUnlinked صفر)', B.legacyUnlinked === 0);

DONE('tester306-v34.0.10-alpha');
