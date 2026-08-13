/* tester88 — v17.0 (اسپرینت «فرم/چاپ پیشنهاد»: BUG-019 ستون حذف‌شده/خالی + US-409 جمع لحظه‌ای و وسط‌چین چاپ) */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var of = fs.readFileSync(path.join(BASE, 'offers.js'), 'utf-8');
var op = fs.readFileSync(path.join(BASE, 'offers-pro.js'), 'utf-8');
var ol = fs.readFileSync(path.join(BASE, 'offerlock.js'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');

SECTION('نسخه و ثبت');
T('نسخه v17.0+', (function(){var m=idx.match(/window.PTF_CRM_RELEASE = 'v([0-9.]+)'/);return m&&parseFloat(m[1])>=17.0;})());
T('کش sw >= v17.0', (function(){var m=sw.match(/var RELEASE = 'v([0-9.]+)';/);return m&&parseFloat(m[1])>=17.0;})());
(function () {
  function vOf(f) { var m = idx.match(new RegExp(f.replace('.', '\\.').replace('-', '\\-') + '\\?v=([0-9.]+)')); return m ? parseFloat(m[1]) : 0; }
  T('cache-bust offers/offers-pro/offerlock >= 17.0', ['offers.js', 'offers-pro.js', 'offerlock.js'].every(function (f) { return vOf(f) >= 17.0; }));
})();

SECTION('BUG-019 (کد)');
T('ریشه: offBaseCols فیلتر hidden را همیشه اعمال می‌کند (زودخروجی بدون colOrder حذف شد)', op.indexOf('فیلتر ستون‌های حذف‌شده باید همیشه اعمال شود') > -1 && op.indexOf('if (!ord) return base.slice();') === -1);
T('اعتبارسنجی: ستون سراسر-خالی مانع ذخیره نیست (پایه + سفارشی)', ol.indexOf('colAllEmpty(k)) continue;') > -1 && ol.indexOf('ecAllEmpty(ec[e2])) continue;') > -1);
T('ستون‌های کلیدی همیشه الزامی (name/qty + قیمت CO)', ol.indexOf('var MUST = { name: 1, qty: 1 };') > -1 && ol.indexOf("'ردیف ' + (i + 1) + ': «قیمت واحد» خالی است'") > -1);
T('پیام راهنما برای ستون نیمه‌خالی (سهولت کاربری)', ol.indexOf('اگر کل ستون را نمی‌خواهید') > -1);
T('چاپ: ستون سراسر-خالی خودکار حذف (پایه جز name/qty + سفارشی)', op.indexOf("var ALWAYS = ['name', 'qty'];") > -1 && op.indexOf('colHasData(c.k)') > -1 && op.indexOf('ec = ec.filter(function (c) {') > -1);
T('چاپ hiddenCols مثل قبل (docCols) پابرجا', op.indexOf('var hidden = o.hiddenCols || [];') > -1);

SECTION('US-409 (کد)');
T('offUpdItem: CO و TC هر دو + فقط qty/price → totals', of.indexOf("if ((_offState.kind === 'CO' || _offState.kind === 'TC') && (f === 'qty' || f === 'price')) offRenderTotals(i);") > -1);
T('offRenderTotals(rowIdx): جمع ردیف + GT بدون رندر کامل (فوکوس نمی‌پرد)', of.indexOf('function offRenderTotals(rowIdx)') > -1 && of.indexOf("document.getElementById('offRT' + rowIdx)") > -1);
T('فرمت ارز-آگاه در به‌روزرسانی لحظه‌ای (US-366)', of.indexOf('offerFmtMoney === ') > -1 && of.indexOf('offerCurrency === ') > -1);
T('هر سه رندرکننده سلول جمع را id ردیفی دادند', of.indexOf('id="offRT\' + i + \'"') > -1 && op.indexOf('id="offRT\' + i + \'"') > -1 && ol.indexOf('id="offRT\' + i + \'"') > -1);
T('چاپ: وسط‌چین قیمت‌ها (td.num) در هر دو قالب (pro + قدیمی)', op.indexOf('td.num{text-align:center') > -1 && of.indexOf('td.num{text-align:center') > -1);
T('tabular-nums حفظ شد', op.indexOf('font-variant-numeric:tabular-nums') > -1);

SECTION('BUG-019 (رفتاری): ماتریس حالت‌ها — بازتولید عین گزارش کارفرما');
global.window = global;
(function () {
  var mB = op.match(/var BASE_COLS_CO = \[[\s\S]*?\];/);
  var mT = op.match(/var BASE_COLS_TO = \[[\s\S]*?\];/);
  var mC = op.match(/window\.offBaseCols = function \(isCO\) \{[\s\S]*?\n  \};/);
  var mV = ol.match(/window\.offValidateItems = function \(\) \{[\s\S]*?\n    return null;\n  \};/);
  T('توابع استخراج شدند', !!mB && !!mT && !!mC && !!mV);
  if (!(mB && mT && mC && mV)) return;
  eval(mB[0].replace('var BASE_COLS_CO', 'global.BASE_COLS_CO'));
  eval(mT[0].replace('var BASE_COLS_TO', 'global.BASE_COLS_TO'));
  eval(mC[0].replace('window.offBaseCols', 'global.offBaseCols'));
  eval(mV[0].replace('window.offValidateItems', 'global.offValidateItems'));

  /* عین گزارش: ستون brand با ✕ حذف شده، مقدارش خالی — قبلا «با خط تیره پر کنید» می‌داد */
  global._offState = { kind: 'CO', hiddenCols: ['brand'], extraCols: [], colOrder: null,
    items: [{ name: 'Control Valve', desc: 'DN50', model: '3241', qty: 2, unit: 'NO', brand: '', price: 500 }] };
  T('حالت گزارش کارفرما: ستون حذف‌شده خالی → ذخیره آزاد ✅', offValidateItems() === null);
  T('offBaseCols بدون colOrder هم hidden را حذف می‌کند (ریشه)', offBaseCols(true).map(function (c) { return c.k; }).indexOf('brand') === -1);

  /* ستون سراسر-خالی بدون حذف دستی → آزاد (خواسته صریح کارفرما) */
  _offState.hiddenCols = [];
  _offState.items = [
    { name: 'Valve', desc: 'd1', model: '', qty: 1, unit: 'NO', brand: 'X', price: 100 },
    { name: 'Gauge', desc: 'd2', model: '', qty: 2, unit: 'NO', brand: 'Y', price: 50 }
  ];
  T('ستون model سراسر-خالی (بدون حذف) → ذخیره آزاد ✅', offValidateItems() === null);

  /* ستون نیمه‌خالی → همچنان الزامی با پیام راهنما */
  _offState.items[0].model = 'ABC';
  var e1 = offValidateItems();
  T('ستون نیمه‌خالی → خطا با راهنمای جدید', e1 !== null && e1.indexOf('مدل') > -1 && e1.indexOf('اگر کل ستون') > -1);

  /* ستون‌های کلیدی هرگز آزاد نمی‌شوند */
  _offState.items = [{ name: '', desc: 'd', model: '', qty: 1, unit: 'NO', brand: '', price: 10 }, { name: '', desc: 'd', model: '', qty: 1, unit: 'NO', brand: '', price: 10 }];
  T('name سراسر-خالی → همچنان خطا (MUST)', offValidateItems() !== null);
  _offState.items = [{ name: 'V', desc: 'd', model: '-', qty: 0, unit: 'NO', brand: '-', price: 10 }];
  T('qty صفر → خطا مثل قبل', (offValidateItems() || '').indexOf('تعداد') > -1);
  /* قیمت CO الزامی */
  _offState.items = [{ name: 'V', desc: 'd', model: '-', qty: 1, unit: 'NO', brand: '-', price: '' }];
  T('قیمت خالی CO → خطا مثل قبل', (offValidateItems() || '').indexOf('قیمت واحد') > -1);
  /* اسناد قدیمی با خط تیره — بدون تغییر */
  _offState.items = [{ name: 'V', desc: '-', model: '-', qty: 1, unit: 'NO', brand: '-', price: 10 }];
  T('سند قدیمی پر شده با خط تیره → مثل قبل معتبر', offValidateItems() === null);
  /* extraCols سراسر-خالی */
  _offState.extraCols = ['Origin'];
  _offState.items = [{ name: 'V', desc: 'd', model: '-', qty: 1, unit: 'NO', brand: '-', price: 10, extra: {} }];
  T('ستون سفارشی سراسر-خالی → آزاد', offValidateItems() === null);
  _offState.items.push({ name: 'W', desc: 'd', model: '-', qty: 1, unit: 'NO', brand: '-', price: 10, extra: { Origin: 'EU' } });
  T('ستون سفارشی نیمه‌خالی → خطا', (offValidateItems() || '').indexOf('Origin') > -1);
})();

SECTION('BUG-019 (رفتاری): چاپ — حذف خودکار ستون سراسر-خالی');
(function () {
  /* استخراج docTableHtml + وابسته‌ها */
  var mDC = op.match(/function docCols\(o\) \{[\s\S]*?\n  \}/);
  var mCG = op.match(/function docColgroup\(o, cols, ec, isCO\) \{[\s\S]*?\n  \}/);
  var mDT = op.match(/function docTableHtml\(o, opts\) \{[\s\S]*?\n  \}/);
  T('توابع چاپ استخراج شدند', !!mDC && !!mCG && !!mDT);
  if (!(mDC && mCG && mDT)) return;
  global.offerCurrency = function () { return { id: 'IRR', sym: 'IRR', words: 'Iranian Rials' }; };
  global.offerFmtMoney = function (v) { return (+v || 0).toLocaleString('en-US'); };
  global.numToWords = function () { return 'x'; };
  eval(mDC[0].replace('function docCols', 'global.docCols = function'));
  eval(mCG[0].replace('function docColgroup', 'global.docColgroup = function'));
  eval(mDT[0].replace('function docTableHtml', 'global.docTableHtml = function'));
  var o = { kind: 'CO', extraCols: ['Origin'], hiddenCols: [], items: [
    { name: 'Valve', desc: 'DN50', model: '', qty: 1, unit: 'NO', brand: '', price: 100, extra: {} },
    { name: 'Gauge', desc: 'DN25', model: '', qty: 2, unit: 'NO', brand: '', price: 50, extra: {} }
  ] };
  var h = docTableHtml(o);
  T('چاپ: ستون‌های سراسر-خالی (Model/Brand/Origin) حذف شدند', h.indexOf('<th>Model</th>') === -1 && h.indexOf('<th>Brand</th>') === -1 && h.indexOf('Origin') === -1);
  T('چاپ: ستون‌های دارای داده ماندند', h.indexOf('Description') > -1 && h.indexOf('Unit Price') > -1);
  o.items[0].brand = 'Samson';
  h = docTableHtml(o);
  T('چاپ: ستون نیمه‌پر می‌ماند (سلول خالی —)', h.indexOf('<th>Brand</th>') > -1 && h.indexOf('>—<') > -1);
  /* hidden دستی همچنان محترم */
  o.hiddenCols = ['brand'];
  h = docTableHtml(o);
  T('چاپ: hidden دستی هم حذف می‌شود (مثل قبل)', h.indexOf('<th>Brand</th>') === -1);
})();

SECTION('US-409 (رفتاری): جمع لحظه‌ای — عین گزارش کارفرما');
(function () {
  var mU = of.match(/function offUpdItem\(i, f, v\) \{[\s\S]*?\n\}/);
  var mR = of.match(/function offRenderTotals\(rowIdx\) \{[\s\S]*?\n\}/);
  T('توابع استخراج شدند', !!mU && !!mR);
  if (!(mU && mR)) return;
  /* DOM سبک: سلول‌های جمع + GT */
  var cells = { offRT0: { textContent: '0' }, offGT: { textContent: '0' } };
  global.document = { getElementById: function (id) { return cells[id] || null; }, querySelectorAll: function () { return []; }, addEventListener: function () {} };
  global.ptfTriggerAutoDraftSave = function () {};
  global.offerCurrency = function () { return { id: 'EUR', sym: '€' }; };
  global.offerFmtMoney = function (v, cur) { return (+v || 0).toLocaleString('en-US', cur && cur.id !== 'IRR' ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : undefined); };
  eval(mR[0].replace('function offRenderTotals', 'global.offRenderTotals = function'));
  eval(mU[0].replace('function offUpdItem', 'global.offUpdItem = function'));
  /* عین گزارش: TC، تایپ قیمت واحد */
  global._offState = { kind: 'TC', items: [{ name: 'V', qty: 3, price: 0 }, { name: 'W', qty: 1, price: 10 }] };
  offUpdItem(0, 'price', '250');
  T('TC: تایپ قیمت → جمع ردیف همان‌جا (نه صفر) ✅', cells.offRT0.textContent === '750.00');
  T('TC: جمع کل هم لحظه‌ای', cells.offGT.textContent === '760.00');
  T('فرمت ارز-آگاه (EUR دو رقم اعشار)', cells.offGT.textContent.indexOf('.00') > -1);
  offUpdItem(0, 'qty', '4');
  T('تغییر تعداد هم جمع را به‌روز می‌کند', cells.offRT0.textContent === '1,000.00' && cells.offGT.textContent === '1,010.00');
  /* تایپ فیلد غیرمالی → دست به totals نمی‌زند (بدون کار اضافه) */
  var before = cells.offGT.textContent;
  offUpdItem(0, 'name', 'New');
  T('تایپ نام → totals بی‌تغییر (فقط qty/price)', cells.offGT.textContent === before);
  /* TO: اصلا totals ندارد */
  global._offState = { kind: 'TO', items: [{ name: 'V', qty: 1, price: 0 }] };
  cells.offGT.textContent = 'X';
  offUpdItem(0, 'qty', '5');
  T('TO: بدون دست زدن به totals', cells.offGT.textContent === 'X');
})();

SECTION('رگرسیون');
T('brand در TC اختیاری (US-277) پابرجا', ol.indexOf("k === 'brand' && st.kind === 'TC'") > -1 && ol.indexOf('continue;') > -1);
T('hook offerSave → offValidateItems پابرجا', ol.indexOf('window.offerSave = function ()') > -1 && ol.indexOf('window.offValidateItems') > -1 && ol.indexOf('offValidateItems') > -1);
T('restoreBar ستون‌های حذف‌شده (بازگرداندن) پابرجا', ol.indexOf('ستون‌های حذف‌شده:') > -1);
T('docColgroup عرض آداپتیو (US-356) پابرجا', op.indexOf('function docColgroup(o, cols, ec, isCO)') > -1);
T('انتخاب قالب چاپ (offerPickTemplate) پابرجا', op.indexOf('window.offerPrint = function (no) { offerPickTemplate(no); };') > -1);
T('td.lft چپ‌چین ماند (فقط num وسط شد)', op.indexOf('td.lft{text-align:left}') > -1);

DONE('tester88-v170');
