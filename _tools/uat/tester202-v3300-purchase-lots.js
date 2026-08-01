/* S2 — لوت‌های تفکیکی خرید + برگشت به تأمین‌کننده + انتقال انبار (buycompare) */
'use strict';
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var bc = fs.readFileSync(path.join(BASE, 'buycompare.js'), 'utf-8');

global.curSession = function () { return { user: 'tester', name: 'تستر خرید' }; };
global._alerts = [];
global.alert = function (m) { global._alerts.push(String(m)); };
global._toasts = [];
global.ptfToast = function (m) { global._toasts.push(String(m)); };
global._surplusCalls = [];
global.ptfSurplusAdd = function (cd, qty, loc, ref, note) {
  global._surplusCalls.push({ cd: cd, qty: qty, loc: loc, ref: ref, note: note });
  return { cd: 'STK-' + global._surplusCalls.length };
};
global._dialog = null;
global.ptfDialog = function (opts) { global._dialog = opts; };

function makeEl(ov) {
  return Object.assign({ value: '', innerHTML: '', textContent: '', style: {},
    remove: function () {}, insertAdjacentHTML: function () {}, setAttribute: function () {},
    addEventListener: function () {}, querySelectorAll: function () { return []; },
    appendChild: function () {}, classList: { add: function () {}, remove: function () {}, contains: function () { return false; } } }, ov || {});
}
global.document = {
  getElementById: function () { return makeEl(); },
  querySelector: function () { return makeEl(); },
  querySelectorAll: function () { return []; },
  createElement: function () { return makeEl(); },
  head: makeEl(), body: makeEl(), addEventListener: function () {}
};

/* ---------- استخراج توابع (الگوی tester115) ---------- */
global.cmpAll = function () { return getData('ptf_crm_buycmp'); };
global.cmpSave = function (list) { setData('ptf_crm_buycmp', list); };
global.cmpOpen = function () {};
global.cmpPurchaseDispositionOpen = function () {};
global._aud = [];
global.audit = function (m, a) { global._aud.push(a || m); };

global.cmpSplitNumber = eval('(' + bc.split('\n').filter(function (l) { return l.indexOf('function cmpSplitNumber(v)') > -1; })[0] + ')');
eval(bc.match(/window\.ptfPurchaseLotsForItem = function \(cmp, idx\) \{[\s\S]*?\n  \};/)[0]);
eval(bc.match(/window\.ptfPurchaseQtyForItem = function \(cmp, idx\) \{[\s\S]*?\n  \};/)[0]);
eval(bc.match(/window\.cmpSplitSave = function \(\) \{[\s\S]*?\n  \};/)[0]
  .replace(/cmpAll\(\)/g, 'global.cmpAll()').replace(/cmpSave\(list\)/g, 'global.cmpSave(list)').replace(/cmpOpen\(/g, 'global.cmpOpen('));
eval(bc.match(/window\.cmpPurchaseReturnOpen = function \(id, idx, purchaseCd\) \{[\s\S]*?\n  \};/)[0]
  .replace(/cmpPurchaseDispositionOpen\(/g, 'global.cmpPurchaseDispositionOpen('));
eval(bc.match(/window\.cmpPurchaseStockOpen = function \(id, idx, purchaseCd\) \{[\s\S]*?\n  \};/)[0]
  .replace(/cmpPurchaseDispositionOpen\(/g, 'global.cmpPurchaseDispositionOpen('));

/* ---------- دادهٔ پایه ---------- */
setData('ptf_crm_buycmp', [{ id: 'CMP-1', inqNo: 'INQ-1', items: [{ nm: 'شیر کنترلی', qty: 10, un: 'عدد', pcode: 'P1', sourceItemKey: 'SK-1' }], quotes: [], purchases: [] }]);
setData('ptf_crm_suppliers', [{ cd: 'S1', co: 'WIKA' }, { cd: 'S2', co: 'کیش تجهیز' }, { cd: 'S3', co: 'تهران پایپ' }]);
setData('ptf_crm_products', [{ cd: 'P1', nm: 'شیر کنترلی' }]);

SECTION('ساختار');
T('توابع لوت/برگشت/انبار موجودند', bc.indexOf('window.cmpSplitSave') > -1 && bc.indexOf('window.cmpPurchaseReturnOpen') > -1 && bc.indexOf('window.cmpPurchaseStockOpen') > -1 && bc.indexOf('window.ptfPurchaseLotsForItem') > -1);
T('تبدیل ارقام فارسی در cmpSplitNumber', cmpSplitNumber('۱,۲۳۴') === '1234' && cmpSplitNumber('١٢') === '12');
T('UR-04: برچسب جمع صریح «جمع کل (اطلاعاتی)» است نه «مجموع خرید» (هر دو پنجره)', bc.indexOf('مجموع خرید: <b>') === -1 && bc.indexOf('جمع کل (اطلاعاتی)') > -1 && bc.indexOf('Σ ') === -1 && bc.indexOf('قیمت واحد') > -1);

SECTION('تقسیم خرید — ۳ lot (ریال + یورو + دلار)');
window._cmpSplitState = { id: 'CMP-1', idx: 0, c: getData('ptf_crm_buycmp')[0], rows: [
  { sup: 'WIKA', qty: 5, price: 2000000, cur: 'IRR', rate: 0 },
  { sup: 'کیش تجهیز', qty: 3, price: 1500, cur: 'EUR', rate: 60000 },
  { sup: 'تهران پایپ', qty: 2, price: 100, cur: 'USD', rate: 95000 }
] };
cmpSplitSave();
var cmp = getData('ptf_crm_buycmp')[0];
T('۳ lot ثبت شد و خرید قبلی قلم حذف شد', cmp.purchases.length === 3 && cmp.purchases.every(function (p) { return p.splitLot === true && +p.idx === 0; }));
T('lot ریالی: قیمت خام و بدون srcCur', (function () { var p = cmp.purchases.filter(function (x) { return x.sup === 'WIKA'; })[0]; return p.price === 2000000 && p.cur === 'IRR' && !p.srcCur && !p.priceFx; })());
T('lot یورویی: تسعیر ۹۰,۰۰۰,۰۰۰ با رهگیری ارز', (function () { var p = cmp.purchases.filter(function (x) { return x.sup === 'کیش تجهیز'; })[0]; return p.price === 90000000 && p.srcCur === 'EUR' && p.priceFx === 1500 && p.rate === 60000 && p.cur === 'IRR'; })());
T('lot دلاری: تسعیر ۹,۵۰۰,۰۰۰', (function () { var p = cmp.purchases.filter(function (x) { return x.sup === 'تهران پایپ'; })[0]; return p.price === 9500000 && p.srcCur === 'USD' && p.priceFx === 100 && p.rate === 95000; })());
T('audit تقسیم ثبت شد', global._aud.length === 1);

SECTION('پیش‌نمایش لوت‌ها (ptfPurchaseLotsForItem)');
var lots = ptfPurchaseLotsForItem(cmp, 0);
T('مقدار/ارز/قیمت هر lot درست است', lots.length === 3 && lots[0].qty === 5 && lots[1].currency === 'EUR' && lots[1].price === 1500 && lots[1].rate === 60000 && lots[2].currency === 'USD');
T('availableQty = qty (بدون برگشت/انبار)', lots.every(function (l) { return l.availableQty === l.qty && l.status === 'purchased'; }));
T('ptfPurchaseQtyForItem = ۱۰', ptfPurchaseQtyForItem(cmp, 0) === 10);

SECTION('گاردهای تقسیم');
T('مجموع بیشتر از نیاز → رد', (function () {
  global._alerts.length = 0;
  window._cmpSplitState = { id: 'CMP-1', idx: 0, c: cmp, rows: [{ sup: 'WIKA', qty: 11, price: 1000, cur: 'IRR', rate: 0 }] };
  cmpSplitSave();
  return global._alerts.length === 1;
})());
T('بدون تامین‌کننده → رد', (function () {
  global._alerts.length = 0;
  window._cmpSplitState = { id: 'CMP-1', idx: 0, c: cmp, rows: [{ sup: '', qty: 5, price: 1000, cur: 'IRR', rate: 0 }] };
  cmpSplitSave();
  return global._alerts.length === 1;
})());
T('ارز خارجی بدون نرخ → رد', (function () {
  global._alerts.length = 0;
  window._cmpSplitState = { id: 'CMP-1', idx: 0, c: cmp, rows: [{ sup: 'WIKA', qty: 5, price: 10, cur: 'EUR', rate: 0 }] };
  cmpSplitSave();
  return global._alerts.length === 1;
})());
T('در گاردها داده تغییر نکرد', getData('ptf_crm_buycmp')[0].purchases.length === 3);

SECTION('برگشت به تأمین‌کننده (operational)');
var purCd = cmp.purchases[0].cd;
cmpPurchaseReturnOpen('CMP-1', 0, purCd);
T('دیالوگ برگشت باز شد و سقف مقدار = ۵', global._dialog && global._dialog.fields[0].value === 5 && global._dialog.title.indexOf('برگشت به تأمین‌کننده') > -1);
global._dialog.onOk({ qty: 2, reason: 'مغایرت فنی/کیفی', reasonOther: '' });
var p = getData('ptf_crm_buycmp')[0].purchases.filter(function (x) { return x.cd === purCd; })[0];
T('برگشت جزئی: returnedQty=2 و وضعیت partially_returned', p.returnedQty === 2 && p.status === 'partially_returned' && p.returnReason.indexOf('مغایرت فنی/کیفی') > -1);
T('اثر مالی خودکار ندارد (بستانکاری ساخته نشد)', getData('ptf_crm_payables') === undefined || getData('ptf_crm_payables').length === 0);
cmpPurchaseReturnOpen('CMP-1', 0, purCd);
global._dialog.onOk({ qty: 3, reason: 'عدم نیاز مشتری', reasonOther: '' });
p = getData('ptf_crm_buycmp')[0].purchases.filter(function (x) { return x.cd === purCd; })[0];
T('برگشت کامل: وضعیت returned_to_supplier', p.returnedQty === 5 && p.status === 'returned_to_supplier');
T('برگشت بیش از سقف → رد', (function () {
  global._alerts.length = 0;
  cmpPurchaseReturnOpen('CMP-1', 0, purCd); /* available = 0 */
  return global._alerts.length === 1 && global._alerts[0].indexOf('صفر') > -1;
})());
T('دلیل «سایر» بدون توضیح → رد', (function () {
  global._alerts.length = 0;
  var lot2 = getData('ptf_crm_buycmp')[0].purchases[1];
  cmpPurchaseReturnOpen('CMP-1', 0, lot2.cd);
  var before = getData('ptf_crm_buycmp')[0].purchases[1].returnedQty || 0;
  global._dialog.onOk({ qty: 1, reason: 'سایر', reasonOther: '' });
  return global._alerts.length === 1 && (getData('ptf_crm_buycmp')[0].purchases[1].returnedQty || 0) === before;
})());

SECTION('انتقال به انبار');
var lot3 = getData('ptf_crm_buycmp')[0].purchases[2]; /* USD، available 2 */
cmpPurchaseStockOpen('CMP-1', 0, lot3.cd);
T('دیالوگ انبار سقف درست دارد', global._dialog && global._dialog.fields[1].value === 2 && global._dialog.fields[0].optionsHtml.indexOf('P1') > -1);
global._dialog.onOk({ prodCd: 'P1', qty: 2, location: 'انبار مرکزی', note: 'انتقال تست' });
var lot3b = getData('ptf_crm_buycmp')[0].purchases.filter(function (x) { return x.cd === lot3.cd; })[0];
T('stockedQty=2 و وضعیت transferred_to_stock', lot3b.stockedQty === 2 && lot3b.status === 'transferred_to_stock');
T('ptfSurplusAdd با آرگومان درست صدا زده شد', global._surplusCalls.length === 1 && global._surplusCalls[0].cd === 'P1' && global._surplusCalls[0].qty === 2 && global._surplusCalls[0].loc === 'انبار مرکزی' && global._surplusCalls[0].ref === 'INQ-1');
T('انتقال بیشتر از available → رد', (function () {
  global._alerts.length = 0;
  cmpPurchaseStockOpen('CMP-1', 0, lot3.cd); /* available = 0 */
  return global._alerts.length === 1;
})());

DONE('tester202-v3300-purchase-lots');
