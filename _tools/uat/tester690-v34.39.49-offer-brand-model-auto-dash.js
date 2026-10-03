/* tester690 — v34.39.49 (BUG-OFFER-BRAND-MODEL-DASH)
   گزارش کارفرما: «در پنجرهٔ مودال پیشنهادها اگر مدل یا برند داده نداشته باشند ستون‌هایشان
   امکان ذخیره کردن پیشنهاد را نمی‌دهد و باید دستی خط تیره برای هر آیتم وارد شود؛ سیستم باید
   خودش مقادیر برند و مدل را خط تیره بدهد نه اینکه از کاربر بخواهد تک‌تک ردیف‌ها را خط تیره بگذارد.»

   ریشه: offValidateItems (offerlock.js) ستون «نیمه‌پُر» را الزامی می‌گرفت؛ چون برند/مدل از
   کاتالوگ کالا / اقلام درخواست / تشخیص خودکار فقط برای بعضی ردیف‌ها می‌آید، ذخیره برای
   ردیف‌های بدون برند/مدل بسته می‌شد و کاربر باید دستی «-» می‌زد.

   این تستر قفل می‌کند: خط تیرهٔ خودکار برند/مدل + حفظ قاعدهٔ BUG-019 (ستون سراسر-خالی نه
   الزامی است و نه در چاپ می‌آید) + دست‌نزدن به مقادیر واقعی و ستون‌های دیگر. */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var ol = fs.readFileSync(path.join(BASE, 'offerlock.js'), 'utf-8');
var op = fs.readFileSync(path.join(BASE, 'offers-pro.js'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');

SECTION('قرارداد کد (منبع حقیقت)');
T('تابع offAutoDashBrandModel در offerlock تعریف شده', ol.indexOf('window.offAutoDashBrandModel = function (st)') > -1);
T('اعتبارسنجی ذخیره، پیش از بررسی ستون‌ها آن را صدا می‌زند',
  ol.indexOf("if (typeof window.offAutoDashBrandModel === 'function') window.offAutoDashBrandModel(st);") > -1 &&
  ol.indexOf('window.offAutoDashBrandModel(st);') < ol.indexOf("var MUST = { name: 1, qty: 1 };"));
T('فقط دو ستون brand/model هدف پرکردن خودکارند', ol.indexOf("['brand', 'model'].forEach(function (k) {") > -1);
T('ستون ✕خورده (خارج از فرم/چاپ) دست‌نخورده می‌ماند', ol.indexOf('if (visible.indexOf(k) < 0) return;') > -1);
T('ستون سراسر-خالی قاعدهٔ BUG-019 را نگه می‌دارد (بدون خط تیره)', ol.indexOf('if (!hasData) return;') > -1);
T('مقدار واقعی بازنویسی نمی‌شود (گارد قبل از ست‌کردن «-»)', ol.indexOf("if (String(x[k] == null ? '' : x[k]).trim() !== '') return;") > -1);
T('سلول همین ردیف در فرم هم «-» می‌شود (هم‌گامی با رندر فعال)',
  ol.indexOf("var el = document.getElementById('off_' + f.k + '_' + f.i);") > -1 && ol.indexOf("if (el) el.value = '-';") > -1);
T('ستون‌های کلیدی (name/qty) مثل قبل الزامی‌اند', ol.indexOf('var MUST = { name: 1, qty: 1 };') > -1);
T('پیام راهنمای ستون نیمه‌خالیِ غیربرند/مدل حذف نشده', ol.indexOf('اگر کل ستون را نمی‌خواهید') > -1);
T('کش‌باستر نسخه شامل offerlock است', /offerlock\.js\?v=\d+\.\d+\.\d+/.test(idx));

SECTION('قرارداد کد: «-» به بانک کالا نشت نمی‌کند');
var of = fs.readFileSync(path.join(BASE, 'offers.js'), 'utf-8');
T('تابع تشخیص «مقدار واقعی» در offers.js هست', of.indexOf('var _offRealAttr = function (v) {') > -1);
T('همگام‌سازی برند/مدل پیش‌فاکتور فقط مقدار واقعی را می‌نویسد',
  of.indexOf('var _mdReal = _offRealAttr(it.model), _brReal = _offRealAttr(it.brand);') > -1 &&
  of.indexOf('if (_mdReal && p.model !== _mdReal)') > -1 && of.indexOf('if (_brReal && p.br !== _brReal)') > -1);
T('ثبت خودکار کالای دستی هم برند/مدل «-» را خالی می‌نویسد',
  of.indexOf('br: _offRealAttr(it.brand), md: _offRealAttr(it.model)') > -1);
(function () {
  var mR = of.match(/var _offRealAttr = function \(v\) \{[\s\S]*?\n  \};/);
  T('تابع تشخیص «مقدار واقعی» استخراج شد', !!mR);
  if (!mR) return;
  eval(mR[0].replace('var _offRealAttr', 'global._offRealAttr'));
  T('«-»/«—»/فاصله مقدار واقعی نیستند؛ برند واقعی دست‌نخورده می‌ماند',
    _offRealAttr('-') === '' && _offRealAttr('—') === '' && _offRealAttr('  ') === '' &&
    _offRealAttr('Rosemount') === 'Rosemount' && _offRealAttr(null) === '' && _offRealAttr('3051CD') === '3051CD');
})();

SECTION('رفتاری: بازتولید عین گزارش (اجرای توابع واقعی فایل)');
global.window = global;
(function () {
  var mB = op.match(/var BASE_COLS_CO = \[[\s\S]*?\];/);
  var mT = op.match(/var BASE_COLS_TO = \[[\s\S]*?\];/);
  var mC = op.match(/window\.offBaseCols = function \(isCO\) \{[\s\S]*?\n  \};/);
  var mA = ol.match(/window\.offAutoDashBrandModel = function \(st\) \{[\s\S]*?\n  \};/);
  var mV = ol.match(/window\.offValidateItems = function \(\) \{[\s\S]*?\n    return null;\n  \};/);
  T('توابع واقعی استخراج شدند', !!mB && !!mT && !!mC && !!mA && !!mV);
  if (!(mB && mT && mC && mA && mV)) return;
  eval(mB[0].replace('var BASE_COLS_CO', 'global.BASE_COLS_CO'));
  eval(mT[0].replace('var BASE_COLS_TO', 'global.BASE_COLS_TO'));
  eval(mC[0].replace('window.offBaseCols', 'global.offBaseCols'));
  eval(mA[0].replace('window.offAutoDashBrandModel', 'global.offAutoDashBrandModel'));
  eval(mV[0].replace('window.offValidateItems', 'global.offValidateItems'));

  function state(kind, items, hidden, extra) {
    global._offState = { kind: kind || 'CO', hiddenCols: hidden || [], extraCols: extra || [], colOrder: null, items: items };
    return global._offState;
  }
  function col(items, k) { return items.map(function (x) { return String(x[k] == null ? '' : x[k]); }); }

  /* ① عین گزارش: ردیف اول برند/مدل دارد (از کاتالوگ/استعلام)، ردیف دوم ندارد → قبلا خطا */
  state('CO', [
    { name: 'Control Valve', desc: 'DN50', model: '3241', brand: 'Samson', qty: 2, unit: 'NO', price: 500 },
    { name: 'Transmitter', desc: '4-20mA', model: '', brand: '', qty: 1, unit: 'NO', price: 900 },
    { name: 'Gauge', desc: 'DN25', model: '', brand: '', qty: 3, unit: 'NO', price: 100 }
  ]);
  T('گزارش کارفرما: ستون نیمه‌پُر برند/مدل دیگر مانع ذخیره نیست ✅', offValidateItems() === null);
  T('سلول‌های خالی مدل خودکار «-» شدند', col(_offState.items, 'model').join(',') === '3241,-,-');
  T('سلول‌های خالی برند خودکار «-» شدند', col(_offState.items, 'brand').join(',') === 'Samson,-,-');
  T('مقدار واقعی ردیف اول دست‌نخورده ماند', _offState.items[0].brand === 'Samson' && _offState.items[0].model === '3241');

  /* ② برند نیمه‌پُر، مدل سراسر-خالی → فقط برند «-» می‌گیرد و مدل دست‌نخورده می‌ماند (BUG-019) */
  state('CO', [
    { name: 'Valve', desc: 'd', model: '', brand: 'WIKA', qty: 1, unit: 'NO', price: 10 },
    { name: 'Gauge', desc: 'd', model: '', brand: '', qty: 1, unit: 'NO', price: 20 }
  ]);
  T('برند نیمه‌پُر → ذخیره آزاد + «-»', offValidateItems() === null && col(_offState.items, 'brand').join(',') === 'WIKA,-');
  T('مدل سراسر-خالی دست‌نخورده می‌ماند (قاعدهٔ BUG-019 / حذف از چاپ)',
    col(_offState.items, 'model').join(',') === ',');

  /* ③ هیچ داده‌ای در هر دو ستون نیست → هیچ خط تیره‌ای اضافه نمی‌شود */
  state('CO', [
    { name: 'Valve', desc: 'd', model: '', brand: '', qty: 1, unit: 'NO', price: 10 },
    { name: 'Gauge', desc: 'd', model: '', brand: '', qty: 1, unit: 'NO', price: 20 }
  ]);
  T('ستون‌های سراسر-خالی → ذخیره آزاد و بدون خط تیرهٔ اضافه',
    offValidateItems() === null && col(_offState.items, 'brand').join(',') === ',' && col(_offState.items, 'model').join(',') === ',');

  /* ④ ستون با ✕ حذف شده → حتی با داده در بعضی ردیف‌ها دست‌نخورده می‌ماند */
  state('CO', [
    { name: 'Valve', desc: 'd', model: 'A1', brand: 'ABB', qty: 1, unit: 'NO', price: 10 },
    { name: 'Gauge', desc: 'd', model: '', brand: '', qty: 1, unit: 'NO', price: 20 }
  ], ['brand', 'model']);
  T('ستون‌های حذف‌شده (✕) خط تیره نمی‌گیرند', offValidateItems() === null &&
    col(_offState.items, 'brand').join(',') === 'ABB,' && col(_offState.items, 'model').join(',') === 'A1,');

  /* ⑤ TC (پیشنهاد فنی-مالی) و TO هم همان رفتار را دارند */
  state('TC', [
    { name: 'Valve', desc: 'd', model: 'EJA', brand: '', qty: 1, unit: 'NO', price: 10 },
    { name: 'Gauge', desc: 'd', model: '', brand: '', qty: 1, unit: 'NO', price: 20 }
  ]);
  T('TC: مدل نیمه‌پُر → «-» و ذخیره آزاد', offValidateItems() === null && col(_offState.items, 'model').join(',') === 'EJA,-');
  T('TC: برند اختیاری (US-277) تخطی نمی‌کند و خط تیرهٔ بی‌دلیل هم نمی‌گذارد', col(_offState.items, 'brand').join(',') === ',');

  state('TO', [
    { name: 'Valve', desc: 'd', model: 'PMP71', brand: '', qty: 1, unit: 'NO' },
    { name: 'Gauge', desc: 'd', model: '', brand: '', qty: 1, unit: 'NO' }
  ]);
  T('TO: مدل نیمه‌پُر → «-»', offValidateItems() === null && col(_offState.items, 'model').join(',') === 'PMP71,-');

  /* ⑥ سند قدیمیِ پرشده با خط تیره → بدون تغییر معتبر است */
  state('CO', [{ name: 'V', desc: 'd', model: '-', brand: '-', qty: 1, unit: 'NO', price: 10 }]);
  T('سند قدیمی با خط تیره → معتبر و بدون دست‌کاری', offValidateItems() === null &&
    _offState.items[0].brand === '-' && _offState.items[0].model === '-');

  /* ⑦ قاعدهٔ نیمه‌پُر برای ستون‌های دیگر باید سر جایش بماند (بدون وصله‌پینه) */
  state('CO', [
    { name: 'Valve', desc: 'DN50', model: '', brand: '', qty: 1, unit: 'NO', price: 10 },
    { name: 'Gauge', desc: '', model: '', brand: '', qty: 1, unit: 'NO', price: 20 }
  ]);
  var eDesc = offValidateItems();
  T('ستون نیمه‌پُر «مشخصات» همچنان خطا می‌دهد', eDesc !== null && eDesc.indexOf('مشخصات') > -1 && eDesc.indexOf('اگر کل ستون') > -1);
  T('خطای ستون دیگر، برند/مدل را بی‌دلیل خط تیره نمی‌کند', col(_offState.items, 'brand').join(',') === ',');

  state('CO', [
    { name: 'Valve', desc: 'd', model: '-', brand: '-', qty: 1, unit: 'NO', price: 10, extra: { Origin: 'EU' } },
    { name: 'Gauge', desc: 'd', model: '-', brand: '-', qty: 1, unit: 'NO', price: 20, extra: {} }
  ], [], ['Origin']);
  T('ستون سفارشی نیمه‌پُر (Origin) همچنان خطا می‌دهد', (offValidateItems() || '').indexOf('Origin') > -1);

  state('CO', [{ name: '', desc: 'd', model: '-', brand: '-', qty: 1, unit: 'NO', price: 10 }]);
  T('شرح کالا (MUST) همچنان الزامی است', offValidateItems() !== null);
  state('CO', [{ name: 'V', desc: 'd', model: '-', brand: '-', qty: 0, unit: 'NO', price: 10 }]);
  T('تعداد صفر همچنان خطا است', (offValidateItems() || '').indexOf('تعداد') > -1);
  state('CO', [{ name: 'V', desc: 'd', model: '-', brand: '-', qty: 1, unit: 'NO', price: '' }]);
  T('قیمت واحد خالی در CO همچنان خطا است', (offValidateItems() || '').indexOf('قیمت واحد') > -1);

  /* ⑧ ردیف null نباید تابع را بشکند (سخت‌سازی) */
  var nullSafe = true;
  try { offAutoDashBrandModel({ kind: 'CO', items: [{ name: 'V', brand: 'X', model: '' }, null] }); }
  catch (eNull) { nullSafe = false; }
  T('ردیف null در حافظهٔ فرم، تابع را نمی‌شکند', nullSafe);

  /* ⑨ هم‌گامی DOM: همان سلول‌های خالی در فرم «-» می‌شوند + پیش‌نویس تازه می‌شود */
  var inputs = { off_brand_1: { value: '' }, off_model_1: { value: '' } };
  global.document = {
    getElementById: function (id) { return inputs[id] || null; },
    querySelectorAll: function () { return []; }
  };
  var draftCalls = 0;
  global.ptfTriggerAutoDraftSave = function () { draftCalls++; };
  state('CO', [
    { name: 'Valve', desc: 'd', model: 'X1', brand: 'Samson', qty: 1, unit: 'NO', price: 10 },
    { name: 'Gauge', desc: 'd', model: '', brand: '', qty: 1, unit: 'NO', price: 20 }
  ]);
  offValidateItems();
  T('سلول مدل ردیف دوم در فرم «-» شد', inputs.off_model_1.value === '-');
  T('سلول برند ردیف دوم در فرم «-» شد', inputs.off_brand_1.value === '-');
  T('پیش‌نویس خودکار پس از پرکردن تازه می‌شود', draftCalls === 1);
  /* وقتی چیزی برای پرکردن نیست، هیچ کار اضافه‌ای انجام نمی‌شود */
  var inputs2 = { off_brand_0: { value: '-' }, off_model_0: { value: '-' } };
  global.document = { getElementById: function (id) { return inputs2[id] || null; }, querySelectorAll: function () { return []; } };
  state('CO', [{ name: 'V', desc: 'd', model: '-', brand: '-', qty: 1, unit: 'NO', price: 10 }]);
  offValidateItems();
  T('بدون سلول خالی، پیش‌نویس/فرم دست‌کاری نمی‌شود', draftCalls === 1 && inputs2.off_brand_0.value === '-');

  /* ⑩ شمارش برگشتی تابع = تعداد سلول‌های پرکده (برند: B و C | مدل: A و C → ۴ سلول) */
  var fillState = {
    kind: 'CO', items: [
      { name: 'A', brand: 'X', model: '' },
      { name: 'B', brand: '', model: 'Y' },
      { name: 'C', brand: '', model: '' }
    ]
  };
  var nFilled = offAutoDashBrandModel(fillState);
  T('تعداد سلول‌های پرکدهٔ خودکار درست برگردانده می‌شود', nFilled === 4);
  T('نتیجهٔ پرکردن: برند = X,-,- و مدل = -,Y,-',
    col(fillState.items, 'brand').join(',') === 'X,-,-' && col(fillState.items, 'model').join(',') === '-,Y,-');
})();

DONE('tester690-v34.39.49');
