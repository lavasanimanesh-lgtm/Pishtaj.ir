/* tester112 — v19.6 (اسپرینت R13 — ابلاغ کارفرما: BUG-030 واحد سراسری ریال + US-438 جداکننده هزارگان + US-439 مرجع/حاشیه سود) */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var mx = fs.readFileSync(path.join(BASE, 'moneyx.js'), 'utf-8');
var of = fs.readFileSync(path.join(BASE, 'offers.js'), 'utf-8');
var uk = fs.readFileSync(path.join(BASE, 'ui-kit.js'), 'utf-8');
var fx = fs.readFileSync(path.join(BASE, 'fx.js'), 'utf-8');
var rb = fs.readFileSync(path.join(BASE, 'rbac.js'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');
var php = fs.readFileSync(path.resolve(__dirname, '../../api/fx-rates.php'), 'utf-8');

SECTION('نسخه و ثبت');
T('نسخه v19.6+', (function () { var m = idx.match(/window.PTF_CRM_RELEASE = 'v([0-9.]+)'/); return m && parseFloat(m[1]) >= 19.6; })());
T('کش sw >= v19.6', (function () { var m = sw.match(/var RELEASE = 'v([0-9.]+)'/); return m && parseFloat(m[1]) >= 19.6; })());
T('moneyx.js در index و sw ثبت شد', (function () { var m = idx.match(/moneyx\.js\?v=([0-9.]+)/); return m && parseFloat(m[1]) >= 19.6 && sw.indexOf("'./moneyx.js'") > -1; })());
T('moneyx بعد از ui-kit لود می‌شود (ptfDialog وابسته)', idx.indexOf('moneyx.js?v=') > idx.indexOf('ui-kit.js?v='));

SECTION('BUG-030 — واحد سراسری ریال (مصوبه: relabel بدون ×۱۰)');
T('ptfMoney ریالی = «ریال» (نه «ت»)', fx.indexOf("v.toLocaleString('fa-IR') + ' ریال'") > -1 && fx.indexOf("v.toLocaleString('fa-IR') + ' ت'") === -1);
T('هیچ «تومان» در ماژول‌های مالی نمانده', ['offers.js', 'rbac.js', 'scoring.js', 'opex.js', 'petty.js', 'cheques.js', 'fiscal.js', 'buycompare.js', 'lossguard.js', 'shareholders.js', 'fx.js'].every(function (f) { return fs.readFileSync(path.join(BASE, f), 'utf-8').indexOf('تومان') === -1; }));
T('پسوند « ت» پولی از ماژول‌های مالی حذف شد', ['scoring.js', 'fx.js', 'opex.js', 'petty.js', 'buycompare.js', 'rbac.js', 'leads.js'].every(function (f) { return fs.readFileSync(path.join(BASE, f), 'utf-8').indexOf("+ ' ت'") === -1; }));
T('fx-rates.php: بدون تقسیم بر ۱۰ + unit=rial', php.indexOf('fx_num_rial') > -1 && php.indexOf('$n / 10') === -1 && php.indexOf("'unit' => 'rial'") > -1);
T('کش تومانی قدیمی سرور نامعتبر می‌شود (ضد خطای ۱۰برابری stale)', php.indexOf("!== 'rial')") > -1 && php.indexOf('$cached = null;') > -1);
T('اعتبارسنجی دلار ریالی > ۱۰۰هزار', php.indexOf('> 100000') > -1);
T('توازن braces فایل PHP', (php.match(/\{/g) || []).length === (php.match(/\}/g) || []).length);
T('سند CO رسمی همچنان IRR (سازگار بود — تغییری لازم نداشت)', of.indexOf('Iranian Rial') > -1);

SECTION('US-438 — ساختار: جداکننده هزارگان سراسری');
T('ماژول مشترک moneyx: ptfNum/ptfNumWordsFa/ptfMoneyFmt', mx.indexOf('window.ptfNum') > -1 && mx.indexOf('window.ptfNumWordsFa') > -1 && mx.indexOf('window.ptfMoneyFmt') > -1);
T('delegation سراسری capture (فرم‌های داینامیک بدون اتصال دستی)', mx.indexOf("document.addEventListener('input'") > -1 && mx.indexOf('}, true);') > -1 && mx.indexOf("data-money") > -1);
T('حفظ موقعیت مکان‌نما هنگام فرمت', mx.indexOf('setSelectionRange') > -1 && mx.indexOf('digitsBefore') > -1);
T('مصوبه کارفرما: «به حروف با واحد اصلی» زیر فیلد (بدون معادل واحد دیگر)', mx.indexOf('ptf-money-hint') > -1 && mx.indexOf("'✍️ ' + ptfNumWordsFa(n) + ' ' + unit") > -1 && mx.indexOf('معادل') === -1);
T('ptfDialog: فیلد number → متن کامادار + inputmode + پارس ptfNum', uk.indexOf('data-money="1"') > -1 && uk.indexOf('inputmode="numeric"') > -1 && uk.indexOf("ptfNum === 'function') ? ptfNum(val)") > -1);
T('فرم CO: فیلد قیمت کامادار + offUpdItem با ptfNum', of.indexOf('data-money="1" data-nohint="1"') > -1 && of.indexOf("ptfNum === 'function') ? ptfNum(v)") > -1);
T('فاکتور/وصولی/قیمت خرید حسابدار کامادار + ptfNum', rb.indexOf('data-money="1" autocomplete="off" id="nInvAmt"') > -1 && rb.indexOf("ptfNum(document.getElementById('nPayAmt').value)") > -1 && rb.indexOf("ptfNum(document.getElementById('nBqPr').value)") > -1);
T('چک/مقایسه خرید/سرنخ/سقف اعتبار کامادار', fs.readFileSync(path.join(BASE, 'cheques.js'), 'utf-8').indexOf('data-money="1" autocomplete="off" id="chAmt"') > -1 && fs.readFileSync(path.join(BASE, 'buycompare.js'), 'utf-8').indexOf("ptfNum((document.getElementById('cmpP' + i)") > -1 && /data-money="1"[^>]*id="nLVal"/.test(fs.readFileSync(path.join(BASE, 'leads.js'), 'utf-8')) && /data-money="1"[^>]*id="nC2Credit"/.test(of));
T('مقدار ذخیره‌شده همیشه عدد خالص (ptfNum قبل از setData)', of.indexOf('creditLimit: (typeof ptfNum') > -1);

SECTION('US-439 — ساختار: مرجع + حاشیه سود همه ردیف‌ها');
T('مرجع دستی refBuyPrice وقتی استعلام نیست', of.indexOf('it.refBuyPrice') > -1 && of.indexOf('window.offSetRefPrice') > -1);
T('اولویت مرجع: بهترین خرید استعلامی سپس دستی', of.indexOf('ptfOfferBestBuyRef') > -1 && of.indexOf('bPrice || +it.refBuyPrice') > -1);
T('حاشیه محقق‌شده ردیف نمایش داده می‌شود', of.indexOf('📈 حاشیه فعلی:') > -1 && of.indexOf('_mPct') > -1);
T('اعمال گروهی: مرجع دستی ردیف‌ها هم لحاظ می‌شود', of.indexOf('if (!bP) bP = +row.refBuyPrice || 0;') > -1);
T('بدون رندر کامل (فوکوس نمی‌پرد — درس US-409)', of.indexOf('window.offSetRefPrice = function(i, v)') > -1 && of.match(/window\.offSetRefPrice = function\(i, v\) \{[\s\S]{0,400}?\};/)[0].indexOf('offRenderItems') === -1);

SECTION('رفتاری — moneyx');
(function () {
  global.window = global;
  var listeners = [];
  global.document = { addEventListener: function (ev, fn, cap) { listeners.push({ ev: ev, fn: fn, cap: cap }); }, createElement: function () { return { style: {} }; } };
  eval(mx);
  T('ptfNum: کاما و ارقام فارسی', ptfNum('1,500,000') === 1500000 && ptfNum('۲۵۰,۰۰۰') === 250000 && ptfNum('') === 0 && ptfNum(123) === 123);
  T('ptfNumWordsFa: عدد بزرگ ریالی', ptfNumWordsFa(1500000000) === 'یک میلیارد و پانصد میلیون');
  T('ptfNumWordsFa: ترکیبی', ptfNumWordsFa(1234567) === 'یک میلیون و دویست و سی و چهار هزار و پانصد و شصت و هفت');
  T('ptfMoneyFmt: کامادار', ptfMoneyFmt(1234567) === '1,234,567' && ptfMoneyFmt('') === '');
  /* v33.9.0: listener سوم (focusout) برای فرمت خودکار فیلدهای مبلغ‌مانند اضافه شد */
T('سه listener سراسری capture ثبت شد (input/focusin/focusout)', listeners.length === 3 && listeners.every(function (l) { return l.cap === true; }));
  /* شبیه‌سازی تایپ در فیلد data-money */
  var el = {
    value: '1500000', selectionStart: 7, _attrs: { 'data-money': '1' },
    getAttribute: function (k) { return this._attrs[k] != null ? this._attrs[k] : null; },
    setSelectionRange: function (a) { this._caret = a; },
    parentNode: { insertBefore: function () {} }, nextSibling: null
  };
  var inpL = listeners.filter(function (l) { return l.ev === 'input'; })[0];
  inpL.fn({ target: el });
  T('تایپ 1500000 → 1,500,000 (کامای زنده)', el.value === '1,500,000');
  el.value = '1,500,000a'; el.selectionStart = 10;
  inpL.fn({ target: el });
  T('حرف غیرعددی حذف می‌شود', el.value === '1,500,000');
})();

SECTION('رفتاری — US-439: مرجع دستی و حاشیه');
(function () {
  global._offState = { kind: 'CO', inqNo: '', items: [{ name: 'Valve', qty: 2, price: 0 }, { name: 'Gauge', qty: 1, price: 0, refBuyPrice: 2000000 }] };
  global.ptfTriggerAutoDraftSave = function () {};
  global.getData = function () { return []; };
  eval(of.match(/window\.offSetRefPrice = function\(i, v\) \{[\s\S]*?\};/)[0]);
  offSetRefPrice(0, '12,500,000');
  T('مرجع دستی با کاما پارس و ذخیره شد (عدد خالص)', _offState.items[0].refBuyPrice === 12500000);
  /* اعمال حاشیه روی مرجع دستی */
  global.offRenderItems = function () { global._rendered = true; };
  global.ptfToast = function () {};
  eval(of.match(/window\.offApplyProfitMarginToRow = function\(i, basePrice, pct\) \{[\s\S]*?\n\};/)[0]);
  offApplyProfitMarginToRow(0, _offState.items[0].refBuyPrice, 20);
  T('قیمت فروش = مرجع دستی × ۱.۲ (۱۵,۰۰۰,۰۰۰)', _offState.items[0].price === 15000000 && _offState.items[0].profitMarginPct === 20);
  T('اعمال گروهی ردیف ۱: ردیف ۲ با مرجع دستی خودش (۲,۴۰۰,۰۰۰)', _offState.items[1].price === 2400000 && _offState.items[1].profitMarginPct === 20);
})();

SECTION('رگرسیون');
T('ptfMoney ارزی همچنان با کد ارز (US-416)', fx.indexOf("toLocaleString('en-US', { minimumFractionDigits: 2") > -1);
T('R12: sfCloseAudit/sfInvoiceRefCommit پابرجا', (function () { var sf = fs.readFileSync(path.join(BASE, 'salesfiles.js'), 'utf-8'); return sf.indexOf('window.sfCloseAudit') > -1 && sf.indexOf('window.sfInvoiceRefCommit') > -1; })());
T('v19.5: سند اصلاحی پابرجا', fs.readFileSync(path.join(BASE, 'fiscal.js'), 'utf-8').indexOf('window.ptfFiscalAmendCommit') > -1);
T('تسعیر الزامی خرید ارزی (US-412) پابرجا', fs.readFileSync(path.join(BASE, 'buycompare.js'), 'utf-8').indexOf('buyPrice = Math.round(priceFx * buyRate);') > -1);
T('VAT فاکتور (US-436) پابرجا با ptfNum', rb.indexOf('var grand = amt + vat;') > -1);
T('چاپ CO: Total Price (IRR) دست‌نخورده', of.indexOf('Total Price (IRR)') > -1);

DONE('tester112-v196');
