#!/usr/bin/env node
'use strict';
/* v34.28.0 — AR-RIAL-ONLY-001
   تست رفتاری و قراردادی حذف کامل تسعیر از مطالبات/وصولی‌های فروش:
   - UI فقط مبلغ فاکتور، دریافت و ماندهٔ ریالی را نمایش می‌دهد؛ درصد حذف است.
   - فرمان ثبت/اصلاح Receipt هیچ metadata یا ورودی ارزی ندارد.
   - API حتی برای پروندهٔ ارزی Receipt صرفاً ریالی می‌سازد.
   - سود فروش از مبلغ فاکتور می‌آید؛ ارز پیشنهاد و خرید ارزی محفوظ است.
 */
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var pass = 0, fail = 0;
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function T(name, ok, detail) {
  if (ok) { pass++; console.log('PASS', name); }
  else { fail++; console.error('FAIL', name, detail === undefined ? '' : detail); }
}
function between(src, start, end) {
  var a = src.indexOf(start), b = src.indexOf(end, a + start.length);
  if (a < 0 || b < 0) throw new Error('extract failed: ' + start + ' .. ' + end);
  return src.slice(a, b);
}
function count(haystack, needle) {
  var n = 0, p = 0;
  while ((p = haystack.indexOf(needle, p)) > -1) { n++; p += needle.length; }
  return n;
}

var rbac = read('crm/rbac.js');
var sales = read('crm/sales-domain-v2.js');
var api = read('api/sales-domain.php');
var fx = read('crm/fx.js');
var offerRial = read('crm/offer-rial-convert.js');
var petty = read('crm/petty.js');
var unofficial = read('crm/unofficial-invoice.js');
var idx = read('crm/index.html');
var gate = read('_tools/uat/run-ci-gate.js');

T('نسخه رسمی v34.28.0 است', JSON.parse(read('VERSION.json')).crm_version === 'v34.28.0');
T('index و service worker روی v34.28.0 هستند',
  idx.indexOf("window.PTF_CRM_RELEASE = 'v34.28.0'") > -1 &&
  read('crm/sw.js').indexOf("RELEASE = 'v34.28.0'") > -1);

/* اجرای خود تابع renderReceivables با دو فاکتور متعلق به پیشنهاد ارزی.
   یکی باز و دیگری تسویه‌شده است؛ metadata ارزی legacy نیز عمداً روی پرداخت seed شده
   تا ثابت شود UI جدید آن را دوباره آشکار نمی‌کند. */
try {
  var wrap = { innerHTML: '' };
  var db = {
    ptf_crm_offers: [{ no: 'OFF-FOREIGN', buyerCo: 'مشتری آزمون', currency: 'USD', fxRateRef: 600000 }],
    ptf_crm_invoices: [
      { cd: 'INV-OPEN', no: 'F-OPEN', offerNo: 'OFF-FOREIGN', caseId: 'CASE-1', amount: 1000,
        dueISO: '2020-01-01', dueFa: '1398/10/11', payments: [{ cd: 'PAY-1', amt: 400, how: 'حواله', t: '1405/06/01', by: 'مالی', fx: { cur: 'USD', rate: 600000, fxAmt: 0.0007 } }] },
      { cd: 'INV-SETTLED', no: 'F-SETTLED', offerNo: 'OFF-FOREIGN', caseId: 'CASE-1', amount: 1000,
        dueISO: '2019-01-01', dueFa: '1397/10/11', payments: [] }
    ]
  };
  var states = { 'INV-OPEN': { paid: 400, open: 600 }, 'INV-SETTLED': { paid: 1000, open: 0 } };
  var ctx = {
    console: console, window: null, PTF: { ar: { invoiceState: function (inv) { return states[inv.cd]; } } },
    PTF_SALES_DOMAIN_V2: true,
    document: { getElementById: function (id) { return id === 'rcWrap' ? wrap : null; } },
    getData: function (key) { return db[key] || []; },
    ptfCanSeeLedger: function () { return true; }, isSenior: function () { return false; },
    escP: function (v) { return String(v == null ? '' : v); },
    ptfOnClickArg: function (v) { return String(v); },
    Date: Date, String: String, Number: Number, Math: Math, Array: Array, Object: Object
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(between(rbac, 'function renderReceivables()', 'function showPayModal('), ctx, { filename: 'rbac-renderReceivables.js' });
  ctx.renderReceivables();
  var html = wrap.innerHTML;
  T('runtime UI: فاکتور باز مبلغ وصولی و ماندهٔ ریالی را نشان می‌دهد', html.indexOf('F-OPEN') > -1 && html.indexOf('وصولی: ۴۰۰ ریال') > -1 && html.indexOf('مانده: ۶۰۰ ریال') > -1, html);
  T('runtime UI: فاکتور تسویه‌شده ماندهٔ صفر و نشان تسویه کامل دارد', html.indexOf('F-SETTLED') > -1 && html.indexOf('مانده: ۰ ریال') > -1 && html.indexOf('تسویه کامل') > -1, html);
  T('runtime UI: سررسید فاکتور باز هست ولی سررسید فاکتور تسویه‌شده پنهان است', html.indexOf('1398/10/11') > -1 && html.indexOf('1397/10/11') === -1, html);
  T('runtime UI: درصد وصول کاملاً حذف شده است', html.indexOf('٪ وصول شد') === -1 && html.indexOf('width:40%') === -1, html);
  T('runtime UI: ارز و metadata تسعیر legacy نمایش داده نمی‌شود', html.indexOf('USD') === -1 && html.indexOf('معادل') === -1 && html.indexOf('600000') === -1, html);
} catch (e) {
  T('اجرای رفتاری renderReceivables بدون خطا', false, e && e.stack || String(e));
}

/* دیالوگ legacy مطالبات نیز حتی برای پیشنهاد ارزی فقط مبلغ ریال می‌گیرد. */
try {
  var modalHtml = '';
  var modalCtx = {
    window: null, PTF_SALES_DOMAIN_V2: false,
    getData: function (key) { return key === 'ptf_crm_invoices' ? [{ cd: 'INV-X', offerNo: 'OFF-X' }] : []; },
    document: { getElementById: function (id) { return id === 'panels' ? { insertAdjacentHTML: function (_, h) { modalHtml = h; } } : null; } },
    alert: function () {}
  };
  modalCtx.window = modalCtx;
  vm.createContext(modalCtx);
  vm.runInContext(between(rbac, 'function showPayModal(', 'function savePay('), modalCtx, { filename: 'rbac-showPayModal.js' });
  modalCtx.showPayModal('INV-X');
  T('runtime modal: عنوان و ورودی وصول صریحاً ریالی است', modalHtml.indexOf('ثبت وصولی ریالی') > -1 && modalHtml.indexOf('مبلغ (ریال)') > -1, modalHtml);
  T('runtime modal: هیچ نرخ، منبع نرخ یا معادل ارزی ندارد', !/fxRate|نرخ تسعیر|منبع نرخ|معادل ارزی|درصد از مبلغ سند/.test(modalHtml), modalHtml);
} catch (e) {
  T('اجرای رفتاری showPayModal بدون خطا', false, e && e.stack || String(e));
}

/* مسیر قدیمی savePay در معماری server-centric باید fail-closed باشد؛ ثبت Receipt فقط از حساب پرونده انجام می‌شود. */
try {
  var sent = null, blockedMessage = '';
  var invSeed = { cd: 'INV-CMD', no: 'F-CMD', caseId: 'CASE-CMD', offerNo: 'OFF-CMD', amount: 1000, payments: [] };
  var inputs = { nPayAmt: { value: '400' }, nPayHow: { value: 'حواله بانکی' } };
  var saveCtx = {
    window: null, PTF_SALES_DOMAIN_V2: true,
    PTF: { invPaidSum: function () { return 0; } },
    document: { getElementById: function (id) { return inputs[id] || null; } },
    getData: function (key) {
      if (key === 'ptf_crm_invoices') return [invSeed];
      return [];
    },
    ptfNum: function (v) { return +v || 0; }, faDate: function () { return '1405/06/01'; },
    alert: function (msg) { blockedMessage = msg; },
    ptfSalesDomainCommand: function (action, payload, options) { sent = { action: action, payload: payload, options: options }; },
    Date: { now: function () { return 12345; } }, String: String, Number: Number, Math: Math, Array: Array, Object: Object
  };
  saveCtx.window = saveCtx;
  vm.createContext(saveCtx);
  var savePaySource = between(rbac, 'function savePay(', 'window.ptfCanInvoicePayVoid =');
  vm.runInContext(savePaySource, saveCtx, { filename: 'rbac-savePay.js' });
  saveCtx.savePay('INV-CMD');
  T('runtime command: ثبت مستقیم دریافت روی فاکتور در v2 مسدود است', sent === null && blockedMessage.indexOf('ثبت مستقیم دریافت روی فاکتور غیرفعال است') > -1, blockedMessage);
  T('runtime command: مسیر مسدودشده هیچ payment محلی نمی‌نویسد',
    invSeed.payments.length === 0);
  T('source command: savePay هیچ post_receipt یا payload ارزی پنهانی ندارد',
    savePaySource.indexOf('post_receipt') === -1 && !/fxRate|fxRateSource|coveredFxAmount/.test(savePaySource));
} catch (e) {
  T('اجرای رفتاری savePay بدون خطا', false, e && e.stack || String(e));
}

var receiptClient = between(sales, 'window.ptfReceiptOpen = function', 'window.ptfReceiptCorrectOpen = function');
T('فرم پرونده فقط مبلغ ریالی، تاریخ، روش، مقصد و توضیح دارد',
  receiptClient.indexOf("id:'amt'") > -1 && receiptClient.indexOf('مبلغ دریافتی (ریال)') > -1 &&
  receiptClient.indexOf("id:'fx") === -1 && receiptClient.indexOf('fxRate') === -1 && receiptClient.indexOf('coveredFxAmount') === -1);
T('payload ثبت و اصلاح Receipt کلاینت صرفاً ریالی است',
  /payload=\{caseId:caseId\(c\),amountIRR:num\(v\.amt\)/.test(receiptClient) &&
  !/fxRate|fxRateSource|coveredFxAmount/.test(receiptClient));
T('جدول حساب پرونده معادل ارزی Receipt قدیمی را نمایش نمی‌دهد',
  sales.indexOf('r.coveredFxAmount') === -1 && sales.indexOf('r.fxRate') === -1);

var postReceipt = between(api, "if ($action === 'post_receipt')", "elseif ($action === 'correct_receipt'");
T('API ثبت Receipt نرخ/منبع نرخ مطالبه نمی‌کند',
  postReceipt.indexOf('fx_rate_and_source_required') === -1 && postReceipt.indexOf("$body['fxRate']") === -1 && postReceipt.indexOf("$body['fxRateSource']") === -1);
T('API Receipt جدید فقط amountIRR دارد و metadata ارزی تولید نمی‌کند',
  postReceipt.indexOf("'amountIRR'=>$amount") > -1 && !/'currency'=>|'fxRate'=>|'fxRateSource'=>|'coveredFxAmount'=>/.test(postReceipt));
var correction = between(api, "elseif ($action === 'correct_receipt'", "elseif ($action === 'register_unofficial_invoice'");
T('API اصلاح Receipt قدیمی، نسخهٔ جایگزین را به مدل ریالی ارتقا می‌دهد',
  correction.indexOf("unset($new['currency'],$new['fxRate'],$new['fxRateSource'],$new['coveredFxAmount'])") > -1 &&
  correction.indexOf('fx_rate_and_source_required') === -1);
T('مسیرهای migration هیچ Receipt ارزی تازه‌ای تولید نمی‌کنند',
  count(api, "'coveredFxAmount'=>") === 0 && count(api, "'fxRateSource'=>") === 0 && count(api, "'fxRate'=>") === 0);

/* پاک‌سازی مسیرهای قدیمی پیش‌پرداخت: شرط تجاری پیشنهاد نباید به وصول فاکتور تبدیل شود. */
var pettyAdvance = between(petty, 'window.ptfAdvanceNormalize = function', '/* ============ روتینگ تنخواه ============ */');
T('petty: شرط پیش‌پرداخت هیچ paid/cashFull/received جدیدی تولید نمی‌کند',
  !/\.(?:paid|cashFull|receivedAmt)\s*=|(?:paid|cashFull|receivedAmt)\s*:/.test(pettyAdvance));
T('petty: hookهای قدیمی وصول و ماندهٔ پیش‌پرداخت حذف شده‌اند',
  !/ptfAdvanceReceived|ptfAdvanceRemain|ptfAdvancePay|_a\.paid/.test(petty));
T('petty: ثبت شرط تجاری، پرداخت یا تسویهٔ فاکتور نمی‌سازد',
  pettyAdvance.indexOf("audit('پیشنهادها', 'ثبت/اصلاح شرط تجاری پیش‌پرداخت") > -1 &&
  !/payments\s*\.\s*push|cashFull\s*:|paid\s*:/.test(pettyAdvance));

T('rbac: مسیر صدور فاکتور artifact پیش‌پرداخت یا نرخ وصول نمی‌سازد',
  !/receivedAmt|advApplied|fromAdvance|RP-ADV|issueFxRate|cashFull|_a\.paid/.test(rbac));
var invoiceGuard = between(rbac, 'function ptfInvoiceReceivedIRR(inv)', 'function renderInvoices()');
T('rbac: گارد ویرایش/حذف مبلغ وصول را از invoiceState ریالی می‌گیرد',
  invoiceGuard.indexOf('PTF.ar.invoiceState(inv)') > -1 && invoiceGuard.indexOf('.paid') > -1);

var generatorHead = unofficial.slice(
  unofficial.indexOf('function generateUnofficialInvoiceHtml'),
  unofficial.indexOf('var invoiceNo =', unofficial.indexOf('function generateUnofficialInvoiceHtml'))
);
T('صورتحساب غیررسمی: generator فقط مبلغ نهایی ریالی و تخفیف ریالی می‌سازد',
  unofficial.indexOf('function generateUnofficialInvoiceHtml(o, total, bankAccount, discountVal, discountLabel, currentRate)') > -1 &&
  generatorHead.indexOf('netPayableIrr = Math.max(0, totalIrr - discountIrr)') > -1 &&
  !/advPay|advRate|netPayableOriginal|rateDetailsHtml/.test(generatorHead));
T('صورتحساب غیررسمی: هر دو مسیر صدور مبلغ را مستقل از پیش‌پرداخت محاسبه می‌کنند',
  count(unofficial, 'var amountIrr = Math.max(0, totalIrr - discountIrr);') >= 2);
T('صورتحساب غیررسمی: هیچ payment/advApplied مصنوعی تازه‌ای ساخته نمی‌شود',
  !/fromAdvance\s*:|['"]RP-ADV-|advApplied\s*:|advApplied\s*=/.test(unofficial) &&
  !/(?:^|[,{])\s*payments\s*:\s*\[\]/m.test(unofficial));
T('صورتحساب غیررسمی: بازصدور فقط artifact مصنوعی قدیمی را پاک و دریافت واقعی را حفظ می‌کند',
  unofficial.indexOf('existing.payments = (Array.isArray(existing.payments) ? existing.payments : []).filter') > -1 &&
  unofficial.indexOf('p.fromAdvance || /^RP-ADV-/.test') > -1 &&
  unofficial.indexOf('delete existing.advApplied') > -1);
var resultBox = between(unofficial, 'window.unofficialInvoiceBuilderRecalc = function', 'window.unofficialInvoiceBuilderSubmit = function');
T('صورتحساب غیررسمی: خلاصهٔ builder فقط جمع، تخفیف و مبلغ نهایی ریالی دارد',
  resultBox.indexOf('جمع کل ریالی صورتحساب') > -1 && resultBox.indexOf('مبلغ نهایی ریالی صورتحساب') > -1 &&
  !/معادل|نرخ تبدیل|نرخ تسعیر|مانده|وصول/.test(resultBox));
var registerUnofficial = between(api, "elseif ($action === 'register_unofficial_invoice')", "elseif ($action === 'register_invoice'");
T('API صورتحساب غیررسمی artifact پیش‌پرداخت ورودی را حذف می‌کند',
  registerUnofficial.indexOf("empty($p['fromAdvance'])") > -1 && registerUnofficial.indexOf('/^RP-ADV-/i') > -1 &&
  registerUnofficial.indexOf("unset($record['advApplied'])") > -1);

/* اجرای موتور سود با پیشنهاد ارزی، پرداخت legacy دارای fx و خرید ارزی.
   درآمد باید مستقل از وصول، دقیقاً مبلغ فاکتور باشد؛ خرید ارزی همچنان تسعیر شود. */
try {
  var profitAssignment = between(fx, 'window.ptfProjectProfitIRR = function', '/* خرید ارزی: در ثبت خرید نهایی');
  var fxDb = {
    ptf_crm_deals: [],
    ptf_crm_invoices: [{ cd: 'INV-P', offerNo: 'OFF-P', amount: 10000000, payments: [{ amt: 1200000, fx: { cur: 'USD', rate: 600000, fxAmt: 2 } }] }],
    ptf_crm_payables: [], ptf_crm_buycmp: []
  };
  var profitCtx = {
    window: null,
    PTF: { ar: { activeInvoice: function () { return true; }, returnedAmountIRR: function () { return 0; } } },
    getData: function (key) { return fxDb[key] || []; },
    localStorage: { getItem: function (key) {
      if (key === 'ptf_crm_supplier_finance') return JSON.stringify({ invoices: [{ cd: 'SUP-FX', offerNo: 'OFF-P', cur: 'USD', amount: 10, rate: 500000, status: 'active' }] });
      return null;
    } },
    JSON: JSON, Math: Math, Array: Array, Object: Object, String: String, Number: Number
  };
  profitCtx.window = profitCtx;
  vm.createContext(profitCtx);
  vm.runInContext(profitAssignment, profitCtx, { filename: 'fx-profit.js' });
  var result = profitCtx.ptfProjectProfitIRR({ offerNo: 'OFF-P' });
  T('runtime profit: فروش دقیقاً مبلغ ریالی فاکتور است، نه وصول تسعیرشده', result.sellIrr === 10000000 && result.sellSrc.indexOf('فاکتور فروش') > -1, JSON.stringify(result));
  T('runtime profit: خروجی‌های وصول ارزی فروش حذف شده‌اند', !('sellFxTotal' in result) && !('sellFxPaid' in result) && !('sellFxRemain' in result) && !('sellAvgRate' in result), JSON.stringify(result));
  T('runtime profit: خرید ارزی نامرتبط محفوظ و با نرخ سند ریالی می‌شود', result.buyIrr === 5000000 && result.profit === 5000000, JSON.stringify(result));
} catch (e) {
  T('اجرای رفتاری موتور سود بدون خطا', false, e && e.stack || String(e));
}

T('هیچ hook یا جدول وصول ارزی در fx.js باقی نمانده است',
  !/ptfFxPayDialog|ptfFxInvoiceSummary|patchInvPay|patchRecvRender|fxSummary/.test(fx));
T('نمایش قدیمی مانده/میانگین نرخ فروش از index حذف شده است',
  !/sellFxPaid|sellFxRemain|sellAvgRate/.test(idx));
T('نسخهٔ ریالی پیشنهاد، snapshot یا درصد وصول ارزی تازه تولید و نمایش نمی‌دهد',
  !/advanceReceivedIrr\s*:|advanceReceivedDoc\s*:|_b\.advanceReceived|already received|درصد وصول‌شده/.test(offerRial) &&
  offerRial.indexOf('delete comp.fxConvert.advanceReceivedIrr') > -1 &&
  offerRial.indexOf('delete comp.fxConvert.advanceReceivedPctOfNew') > -1);
T('قابلیت ارزی پیشنهاد و خرید دست‌نخورده باقی مانده است',
  fx.indexOf('window.ptfFxCurOf') > -1 && fx.indexOf("i.cur && i.cur !== 'IRR'") > -1 &&
  offerRial.indexOf('window.ptfOfferRialConvertCommit') > -1 &&
  read('crm/offers-pro.js').indexOf('fxRateRef') > -1);
T('tester501 در گیت CI ثبت شده است', gate.indexOf('tester501-v34.8.0-ar-rial-only.js') > -1);

console.log('\n— tester501 (v34.28.0: مطالبات و وصولی‌های صرفاً ریالی) —');
console.log('PASS: ' + pass + ' | FAIL: ' + fail);
process.exit(fail ? 1 : 0);
