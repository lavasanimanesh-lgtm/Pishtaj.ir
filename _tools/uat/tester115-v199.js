/* tester115 — v19.9 (اسپرینت ۲ از ۵: BUG-032 قیمت per قلم + US-441 ثبت گروهی خرید چابک) */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var bc = fs.readFileSync(path.join(BASE, 'buycompare.js'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');

SECTION('نسخه و ثبت');
T('نسخه v19.9+', (function () { var m = idx.match(/window.PTF_CRM_RELEASE = 'v([0-9.]+)'/); return m && parseFloat(m[1]) >= 19.9; })());
T('کش sw >= v19.9', (function () { var m = sw.match(/var RELEASE = 'v([0-9.]+)'/); return m && parseFloat(m[1]) >= 19.9; })());
T('cache-bust buycompare >= 19.9', (function () { var m = idx.match(/buycompare\.js\?v=([0-9.]+)/); return m && parseFloat(m[1]) >= 19.9; })());

SECTION('BUG-032 — هشدار قیمت واحد');
T('مودال تک‌آیتمی: هشدار «قیمت واحد فقط همین قلم — نه جمع کل»', bc.indexOf('قیمت واحد فقط همین قلم را وارد کنید — نه جمع کل اقلام (BUG-032)') > -1);
T('ارجاع به ثبت گروهی از همان هشدار', bc.indexOf('برای ثبت همه اقلام یکجا از «🛒 ثبت گروهی خرید»') > -1);

SECTION('US-441 — ساختار: ثبت گروهی');
T('هسته قابل تست cmpBulkBuyCommit(id, rows, shared) با {ok,done,skipped,total}', bc.indexOf('window.cmpBulkBuyCommit') > -1 && bc.indexOf('return { ok: true, done: done, skipped: skipped, total: total };') > -1);
T('تسعیر الزامی ارز مشترک (US-412 پابرجا)', bc.indexOf("if (cur !== 'IRR' && !rate) return { ok: false, why: 'rate' };") > -1);
T('ردیف ناقص = رد (ثبت جزئی مجاز) + قلم خریده‌شده دست نمی‌خورد', bc.indexOf('ردیف ناقص = رد (ثبت جزئی مجاز)') > -1 && bc.indexOf('خریده‌شده دست نمی‌خورد') > -1);
T('هر ردیف فقط در purchases ثبت می‌شود و payable نمی‌سازد', bc.split('window.cmpBulkBuyCommit')[1].split('window.cmpBulkBuy =')[0].indexOf('ptfPayableUpsert') < 0);
T('گذار st8 با اولین خرید موفق (BUG-029)', bc.split('window.cmpBulkBuyCommit')[1].split('window.cmpBulkBuy =')[0].indexOf('ptfRealBuyEnsureStatus') > -1);
T('UI: دکمه 🛒 ثبت گروهی فقط وقتی >۱ قلم بدون خرید', bc.indexOf('🛒 ثبت گروهی خرید</button>') > -1 && bc.indexOf('.length > 1') > -1);
T('«⚡ اعمال روی همه» تامین‌کننده ردیف ۱ (فقط ردیف‌های خالی)', bc.indexOf('window.cmpBulkApplySup') > -1 && bc.indexOf('!el.value.trim()) el.value = first') > -1);
T('جمع کل زنده با ارز/تسعیر (cmpBulkTotal)', bc.indexOf('window.cmpBulkTotal') > -1 && bc.indexOf('(نرخ تسعیر؟)') > -1);
T('فیلدهای قیمت کامادار (data-money — US-438)', bc.split('window.cmpBulkBuy =')[1].indexOf('data-money="1"') > -1);
T('audit + notify گروهی', bc.indexOf('ثبت گروهی خرید واقعی (US-441)') > -1);

SECTION('رفتاری — cmpBulkBuyCommit');
global.window = global;
global.curSession = function () { return { user: 'yousefi', name: 'عباس یوسفی' }; };
global.SENIOR_ROLES = ['admin', 'chairman', 'ceo', 'commercial'];
global.faDate = function () { return '1405/04/22'; };
global.audit = function (m, a) { global._aud = a; };
global.notify = function (o) { global._ntf = o; return 'N1'; };
global.ptfNum = function (v) { return +String(v == null ? '' : v).replace(/[^\d.-]/g, '') || 0; };
(function () {
  global.canBuy = function () { return true; };
  global.cmpAll = function () { return getData('ptf_crm_buycmp'); };
  global.cmpSave = function (l) { setData('ptf_crm_buycmp', l); };
  global._pays = [];
  global._st8 = null;
  global.ptfRealBuyEnsureStatus = function (inq) { global._st8 = inq; };
  eval(bc.match(/window\.cmpBulkBuyCommit = function \(id, rows, shared\) \{[\s\S]*?\n  \};/)[0].replace(/cmpAll\(\)/g, 'global.cmpAll()').replace(/cmpSave\(list\)/g, 'global.cmpSave(list)').replace(/canBuy\(\)/g, 'global.canBuy()'));

  setData('ptf_crm_buycmp', [{ id: 'CMP-9', inqNo: 'INQ-9', items: [
    { nm: 'Valve', qty: 2 }, { nm: 'Gauge', qty: 1 }, { nm: 'Flange', qty: 10 }, { nm: 'Pump', qty: 1 }
  ], quotes: [], purchases: [{ cd: 'PUR-0', idx: 3, sup: 'قبلی', price: 5 }] }]);

  /* ریالی: ۲ ردیف کامل + ۱ ناقص + ۱ خریده‌شده (رد) */
  var res = cmpBulkBuyCommit('CMP-9', [
    { idx: 0, price: '1,000,000', sup: 'WIKA', pay: 'credit' },
    { idx: 1, price: '250,000', sup: 'WIKA', pay: 'cash' },
    { idx: 2, price: '', sup: 'کسی' },          /* ناقص */
    { idx: 3, price: '99', sup: 'دزد' }          /* قبلا خریده شده */
  ], { cur: 'IRR' });
  var c = getData('ptf_crm_buycmp')[0];
  T('۲ ثبت + ۲ رد', res.ok && res.done === 2 && res.skipped === 2);
  T('قیمت کامادار پارس شد و per قلم نشست (BUG-032)', c.purchases.length === 3 && c.purchases.filter(function (p) { return p.idx === 0 && p.price === 1000000; }).length === 1 && c.purchases.filter(function (p) { return p.idx === 1 && p.price === 250000; }).length === 1);
  T('جمع کل = ۱م×۲ + ۲۵۰ه×۱ = ۲,۲۵۰,۰۰۰ (×تعداد)', res.total === 2250000);
  T('خرید واقعی بستانکاری خودکار نمی‌سازد', global._pays.length === 0 && getData('ptf_crm_payables').length === 0);
  T('گذار st8 صدا شد (BUG-029)', global._st8 === 'INQ-9');
  T('قلم خریده‌شده مصون ماند', c.purchases.filter(function (p) { return p.idx === 3; }).length === 1 && c.purchases.filter(function (p) { return p.idx === 3; })[0].sup === 'قبلی');

  /* ارزی بدون نرخ → رد کامل */
  T('ارزی بدون نرخ تسعیر → رد why=rate', cmpBulkBuyCommit('CMP-9', [{ idx: 2, price: '100', sup: 'X' }], { cur: 'USD' }).why === 'rate');
  /* ارزی با نرخ → معادل ریالی قطعی */
  var r2 = cmpBulkBuyCommit('CMP-9', [{ idx: 2, price: '150', sup: 'Siemens', pay: 'credit' }], { cur: 'EUR', rate: 1050000 });
  c = getData('ptf_crm_buycmp')[0];
  var pu = c.purchases.filter(function (p) { return p.idx === 2; })[0];
  T('خرید ارزی: price=ریال قطعی (150×1,050,000) + srcCur/priceFx/rate', r2.done === 1 && pu.price === 157500000 && pu.srcCur === 'EUR' && pu.priceFx === 150 && pu.rate === 1050000 && pu.cur === 'IRR');
  T('جمع ارزی ×تعداد (۱۰ فلنج)', r2.total === 1575000000);
  T('audit گروهی ثبت شد', String(global._aud).indexOf('US-441') > -1);
  global.canBuy = function () { return false; };
  T('بدون مجوز خرید → رد perm', cmpBulkBuyCommit('CMP-9', [], {}).why === 'perm');
})();

SECTION('رگرسیون');
T('cmpBuy تک‌آیتمی پابرجا (مسیر US-412)', bc.indexOf('window.cmpBuy = function (id, idx)') > -1 && bc.indexOf('buyPrice = Math.round(priceFx * buyRate);') > -1);
T('US-444 یتیم‌ها پابرجا', fs.readFileSync(path.join(BASE, 'bridge.js'), 'utf-8').indexOf('window.ptfOrphanPurge') > -1);
T('ptfRealBuyStatus پرونده فروش پابرجا', bc.indexOf('window.ptfRealBuyStatus') > -1);

DONE('tester115-v199');
