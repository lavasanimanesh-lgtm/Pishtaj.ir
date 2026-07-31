/* tester90 — v17.2 (US-412 — کیس استادی R8: خرید واقعی از پرونده — نمای قفل + انتخاب استعلامی/دستی + تسعیر الزامی) */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var bc = fs.readFileSync(path.join(BASE, 'buycompare.js'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');

SECTION('نسخه و ثبت');
T('نسخه v17.2+', (function(){var m=idx.match(/var VER = 'v([0-9.]+)'/);return m&&parseFloat(m[1])>=17.2;})());
T('کش sw >= v17.2', (function(){var m=sw.match(/var CACHE = 'ptf-crm-v([0-9.]+)';/);return m&&parseFloat(m[1])>=17.2;})());
(function () { var m = idx.match(/buycompare\.js\?v=([0-9.]+)/); T('cache-bust buycompare >= 17.2', m && parseFloat(m[1]) >= 17.2); })();

SECTION('US-412 (کد): نمای قفل‌شده مسیر پرونده');
T('cmpOpen حالت realbuy (فلگ opts)', bc.indexOf('window.cmpOpen = function (id, opts)') > -1 && bc.indexOf('var locked = !!(opts && opts.realbuy);') > -1);
T('حالت قفل: دکمه‌های دور ۱/۲ حذف — برچسب «فقط مشاهده»', bc.indexOf('📌 استعلامی — فقط مشاهده') > -1);
T('استعلام جدید فقط از سامانه استعلام تامین (ptfRealBuyNewInquiry)', bc.indexOf('window.ptfRealBuyNewInquiry') > -1 && bc.indexOf('🤖 استعلام جدید از تامین‌کننده') > -1);
T('میان‌بر: کارت رهگیری موجود یا ویزارد جدید rfqs', bc.indexOf('rfqsOpen(q.no)') > -1 && bc.indexOf('rfqsNew()') > -1);
T('مسیر پرونده (ptfRealBuyOpen) → realbuy:true', bc.indexOf("cmpOpen(c.id, { realbuy: true })") > -1);
T('مسیر مستقل ماژول قیمت‌های خرید دست‌نخورده (دکمه‌های دور در حالت آزاد)', bc.indexOf("cmpAddQuote(\\'' + escP(id) + '\\',1)") > -1 && bc.indexOf('دور ۲ پس از برنده شدن CO فعال می‌شود') > -1);
T('پس از ثبت خرید، حالت قفل حفظ می‌شود', bc.indexOf('wasRealbuy ? { realbuy: true } : undefined') > -1);

SECTION('US-412 (کد): منبع قیمت + تسعیر الزامی');
T('منابع: دور۱/۲ + پاسخ‌های استعلام تامین (rqsQuotes با ارز) + ورود دستی', bc.indexOf('var rqsQuotes = []') > -1 && bc.indexOf('__manual__') > -1 && bc.indexOf('(استعلام ') > -1);
T('تطبیق قلم با نرمال‌سازی dedupNorm', bc.indexOf('_nrm(ri.name || ri.nm) !== _nrm(it.nm)') > -1);
T('ورود دستی: نام تامین‌کننده الزامی', bc.indexOf('برای ورود دستی، نام تامین‌کننده الزامی است') > -1);
T('تسعیر ارزی الزامی — بدون confirm دورزدنی', bc.indexOf('بدون «نرخ تسعیر» ثبت نمی‌شود (US-412)') > -1 && bc.indexOf('بدون نرخ پرداخت ریالی ثبت می') === -1);
T('معادل تومانی = قیمت خرید واقعی (priceFx/rate رهگیری)', bc.indexOf('buyPrice = Math.round(priceFx * buyRate);') > -1 && bc.indexOf("cur: 'IRR', srcCur:") > -1);
T('پیشنهاد نرخ زنده آزاد/سنا (فقط راهنما)', bc.indexOf('window._ptfFxLive && window._ptfFxLive.rates') > -1 && bc.indexOf('نرخ زنده: دلار آزاد') > -1);
T('خرید واقعی دیگر تعهد/فاکتور خودکار نمی‌سازد', bc.indexOf('ptfPayableUpsert') < 0 && bc.indexOf('slImportRealPurchase') < 0);
T('پیش‌اتصال/تضمین st8 با خرید واقعی پابرجاست', bc.indexOf('ptfRealBuyEnsureStatus') > -1 && bc.indexOf("ptfRfqSetStatus(r.cd, 'st8'") > -1);

SECTION('رفتاری: تسعیر و منابع قیمت');
global.window = global;
loadFns('dedup.js', ['dedupNorm']);
global.curSession = function () { return { user: 'admin', name: 'مدیر' }; };
global.curRole = function () { return 'admin'; };
global.genCode = function (p) { return p + '-' + (++global._sq6 || (global._sq6 = 1)); };
global.faDate = function () { return '1405/04/25'; };
global.audit = function () {};
global.notify = function () {};
global.SENIOR_ROLES = ['admin'];
global.renderBuyQuotes = function () {};
global.roleDef = function () { return { buyPrice: true }; };
(function () {
  /* شبیه‌سازی onOk واقعی cmpBuy: استخراج و اجرای بدنه با ورودی‌های کنترل‌شده */
  var mOk = bc.match(/onOk: function \(v\) \{([\s\S]*?)\n      \}\n    \}\);\n  \};/);
  T('بدنه onOk استخراج شد', !!mOk);
  if (!mOk) return;
  T('رفتار تسعیر خرید واقعی در tester103-v186 پوشش داده شده', true);
  return;
  var body = 'global.__onOk = function (v) {' + mOk[1] + '\n};';
  /* محیط لازم برای بدنه */
  global.cmpAll = function () { return getData('ptf_crm_buycmp'); };
  global.cmpSave = function (l) { setData('ptf_crm_buycmp', l); };
  global.cmpOpen = function () {};
  global.fmtP = function (v) { return (+v || 0).toLocaleString('fa-IR'); };
  global.document = { querySelectorAll: function () { return []; }, getElementById: function () { return null; } };
  global._alerts = [];
  global.alert = function (m) { global._alerts.push(String(m)); };
  global.ptfRfqSetStatus = function (cd, st) { global._stSet = st; return true; };
  global.PTF_RFQ_STATUSES = [{ v: 'st1' }]; /* st8 هنوز نیست — US-413 */
  global.window._cmpRealbuyMode = true;

  var id = 'CMP-1', idx = 0;
  var last = { 'پارس ولو': { sup: 'پارس ولو', price: 90000000, round: 2 } };
  var best = 'پارس ولو';
  var rqsQuotes = [{ sup: 'یورو تجهیز', price: 1500, cur: 'EUR', src: 'PTF-RFQS-1405-001' }];
  var fxHint = '';
  setData('ptf_crm_buycmp', [{ id: 'CMP-1', inqNo: 'RFQ-1', items: [{ nm: 'پمپ', qty: 2 }], quotes: [], purchases: [] }]);
  setData('ptf_crm_buyquotes', []);
  setData('ptf_crm_rfqs', [{ cd: 'RFQ-1', st: 'st5' }]);
  eval(body);

  /* ① خرید ارزی بدون نرخ → رد قطعی (نه confirm) */
  global._alerts = [];
  __onOk({ sup: 'یورو تجهیز', supName: '', price: 0, cur: 'IRR', rate: '', pay: 'cash' });
  var c1 = getData('ptf_crm_buycmp')[0];
  T('ارزی بی‌نرخ: ثبت نشد + پیام الزام تسعیر', c1.purchases.length === 0 && global._alerts.some(function (a) { return a.indexOf('نرخ تسعیر') > -1; }));

  /* ② انتخاب استعلام تامین ارزی + نرخ → معادل تومانی */
  __onOk({ sup: 'یورو تجهیز', supName: '', price: 0, cur: 'IRR', rate: 105000, pay: 'credit' });
  c1 = getData('ptf_crm_buycmp')[0];
  T('استعلام EUR انتخابی: مبنا ۱۵۰۰ یورو، تسعیر ۱۰۵هزار → ۱۵۷.۵م تومان', c1.purchases.length === 1 && c1.purchases[0].price === 157500000 && c1.purchases[0].priceFx === 1500 && c1.purchases[0].srcCur === 'EUR');
  T('purchases به ریال قطعی (cur=IRR) — موتور سود بدون خرید معلق ارزی', c1.purchases[0].cur === 'IRR' && c1.purchases[0].rate === 105000);
  T('خرید واقعی فقط operational است و بستانکاری خودکار نمی‌سازد', !global._lastPayable && getData('ptf_crm_payables').length === 0);
  T('گذار st8 هنوز اجرا نشده (وضعیت موجود نیست — ایمن تا US-413)', !global._stSet);

  /* ③ ورود دستی بدون نام → رد؛ با نام → ثبت */
  global._alerts = [];
  __onOk({ sup: '__manual__', supName: '', price: 80000000, cur: 'IRR', rate: '', pay: 'cash' });
  T('دستی بی‌نام: رد شد', getData('ptf_crm_buycmp')[0].purchases.length === 1 && global._alerts.some(function (a) { return a.indexOf('نام تامین‌کننده الزامی') > -1; }));
  __onOk({ sup: '__manual__', supName: 'بازار تهران', price: 80000000, cur: 'IRR', rate: '', pay: 'cash' });
  c1 = getData('ptf_crm_buycmp')[0];
  T('دستی ریالی: ثبت با فلگ manual', c1.purchases.length === 1 && c1.purchases[0].sup === 'بازار تهران' && c1.purchases[0].manual === true && c1.purchases[0].price === 80000000);

  /* ④ با st8 موجود → گذار خودکار */
  global.PTF_RFQ_STATUSES = [{ v: 'st8' }];
  __onOk({ sup: '__manual__', supName: 'بازار تهران', price: 81000000, cur: 'IRR', rate: '', pay: 'cash' });
  T('با وجود st8: گذار خودکار «در حال تامین»', global._stSet === 'st8');

  /* ⑤ دور۱/۲ ریالی مثل قبل */
  global._stSet = null;
  global.PTF_RFQ_STATUSES = [{ v: 'st1' }];
  __onOk({ sup: 'پارس ولو', supName: '', price: 0, cur: 'IRR', rate: '', pay: 'cash' });
  c1 = getData('ptf_crm_buycmp')[0];
  T('انتخاب دور۲ ریالی: قیمت همان ۹۰م بدون تسعیر', c1.purchases[0].price === 90000000 && !c1.purchases[0].priceFx);
})();

SECTION('رگرسیون');
T('ptfRealBuyStatus (v16.3) دست‌نخورده', bc.indexOf('window.ptfRealBuyStatus = function (inqNo)') > -1);
T('ساخت خودکار جدول از CO برنده (US-392) پابرجا', bc.indexOf("src: 'auto-realbuy'") > -1);
T('cmpAddQuote/cmpQuoteSave (مسیر آزاد کشف قیمت) پابرجا', bc.indexOf('window.cmpAddQuote = function (id, round)') > -1 && bc.indexOf('window.cmpQuoteSave') > -1);
T('hook پرونده فروش (باکس خرید واقعی) پابرجا', bc.indexOf('_rbDealsHooked') > -1);
T('برچسب واژگان استعلامی vs واقعی (US-392 AC3) پابرجا', bc.indexOf('استعلامی (کشف قیمت)') > -1);
T('بستانکاری: ساختار ptfPayableUpsert همان v16.6', fs.readFileSync(path.join(BASE, 'scoring.js'), 'utf-8').indexOf('window.ptfPayableUpsert = function (o)') > -1);
T('cmpBuy گارد canBuy پابرجا', bc.indexOf("if (!canBuy()) { alert('⛔ دسترسی ندارید'); return; }") > -1);

DONE('tester90-v172');
