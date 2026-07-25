/* tester92 — v17.4 (US-414: تسعیر فروش درصدی با نرخ آزاد/سنا + US-416: شفافیت ارز — تکمیل کیس R8) */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var fx = fs.readFileSync(path.join(BASE, 'fx.js'), 'utf-8');
var of = fs.readFileSync(path.join(BASE, 'offers.js'), 'utf-8');
var rb = fs.readFileSync(path.join(BASE, 'rbac.js'), 'utf-8');
var sf = fs.readFileSync(path.join(BASE, 'salesfiles.js'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');

SECTION('نسخه و ثبت');
T('نسخه v17.4+', (function(){var m=idx.match(/var VER = 'v([0-9.]+)'/);return m&&parseFloat(m[1])>=17.4;})());
T('کش sw >= v17.4', (function(){var m=sw.match(/var CACHE = 'ptf-crm-v([0-9.]+)';/);return m&&parseFloat(m[1])>=17.4;})());
(function () {
  function vOf(f) { var m = idx.match(new RegExp(f.replace('.', '\\.') + '\\?v=([0-9.]+)')); return m ? parseFloat(m[1]) : 0; }
  T('cache-bust fx/offers/salesfiles/rbac >= 17.4', ['fx.js', 'offers.js', 'salesfiles.js', 'rbac.js'].every(function (f) { return vOf(f) >= 17.4; }));
})();

SECTION('US-414 (کد): تسعیر فروش روز پرداخت');
T('انتخاب مبنای نرخ: آزاد/سنا/توافقی', fx.indexOf("'<option value=\"free\">🇺🇳 نرخ آزاد'") > -1 && fx.indexOf('<option value="sana">🏦 نرخ سنا') > -1 && fx.indexOf('<option value="agreed">🤝 توافقی') > -1);
T('نرخ زنده آزاد/سنا از ویجت fx (اطلاعی)', fx.indexOf('window._ptfFxLive && window._ptfFxLive.rates') > -1 && fx.indexOf('usd_sana_sell') > -1);
T('ورود درصدی از مبلغ سند (مثال ۳۰٪ کارفرما)', fx.indexOf("{ id: 'pct', label: '٪ درصد از مبلغ سند") > -1 && fx.indexOf('totalFx * pct / 100') > -1);
T('mبلغ کل سند از CO محاسبه می‌شود', fx.indexOf('totalFx = (oRef.items || []).reduce') > -1);
T('نرخ الزامی + انتخاب سنا نرخ زنده سنا را مبنا می‌کند', fx.indexOf('نرخ تسعیر الزامی است') > -1 && fx.indexOf("if (rtype === 'sana' && sanaRate && rate === freeRate) rate = sanaRate;") > -1);
T('rateType/pct روی تراکنش ثبت می‌شود (گزارش‌های آتی)', fx.indexOf('rateType: rtype, pct: pct || 0') > -1);
T('سازگاری pays[].fx: خروجی cb همان ساختار + فیلدهای جدید', fx.indexOf('cb({ amt: amt, rate: rate, rateType: rtype') > -1);
T('باقیمانده در مطالبات: remainFx موجود پابرجا (ptfFxInvoiceSummary)', fx.indexOf('window.ptfFxInvoiceSummary') > -1 && fx.indexOf('remainFx') > -1);

SECTION('US-416 (کد): شفافیت ارز');
T('تابع نمایش واحد ptfMoney (v19.6: ریالی=«ریال»، ارزی=کد ارز)', fx.indexOf('window.ptfMoney = function (v, cur)') > -1 && fx.indexOf("v.toLocaleString('fa-IR') + ' ریال'") > -1);
T('فهرست پیشنهادها: مبلغ CO/TC با ارز سند (رفع «ت» اشتباه)', of.indexOf('ptfMoney(total, o.currency)') > -1 && of.indexOf("o.kind === 'CO' && total ? total.toLocaleString('fa-IR') + ' ت'") === -1);
T('TC هم مبلغ کل دارد', of.indexOf("(o.kind === 'CO' || o.kind === 'TC') ? o.items.reduce") > -1);
T('ارجاع فاکتور (rbac): مبلغ CO ارز-آگاه', rb.indexOf('ptfMoney(total, o.currency)') > -1);
T('آمار بایگانی: totalCOCur ثبت می‌شود', sf.indexOf('totalCOCur:') > -1);

SECTION('US-414 (رفتاری): مثال عینی کارفرما — 1500$ و پرداخت ۳۰٪');
global.window = global;
(function () {
  var mD = fx.match(/window\.ptfFxPayDialog = function \(kind, refNo, cur, cb\) \{[\s\S]*?\n  \};/);
  T('دیالوگ استخراج شد', !!mD);
  if (!mD) return;
  global.curSession = function () { return { user: 'admin', name: 'م' }; };
  global.faDate = function () { return '1405/04/26'; };
  global.ptfToast = function () {};
  global._alerts = [];
  global.alert = function (m) { global._alerts.push(String(m)); };
  var dlgOpts = null;
  global.ptfDialog = function (o) { dlgOpts = o; };
  global._ptfFxLive = { rates: { usd_free: 130000, usd_sana_sell: 110000, eur_free: 145000 } };
  setData('ptf_crm_offers', [{ no: 'CO-9', kind: 'CO', currency: 'USD', items: [{ qty: 1, price: 1500 }] }]);
  eval(mD[0].replace('window.ptfFxPayDialog', 'global.ptfFxPayDialog'));

  var out = null;
  ptfFxPayDialog('in', 'CO-9', 'USD', function (fxRes) { out = fxRes; });
  T('دیالوگ با گزینه‌های نرخ + نرخ زنده', dlgOpts && dlgOpts.fields.some(function (f) { return f.id === 'rtype'; }) && dlgOpts.body.indexOf('1,500') > -1);
  /* ۳۰٪ با نرخ آزاد ۱۳۰هزار: 450$ × 130000 = 58.5م تومان */
  dlgOpts.onOk({ pct: 30, rtype: 'free', rate: 130000, amt: '', note: '' });
  T('۳۰٪ سند = 450$ ارزی', out && out.fxAmt === 450);
  T('ریالی = 450×130000 = 58,500,000 تومان', out && out.amt === 58500000);
  T('rateType=free و pct=30 ثبت شد', out && out.rateType === 'free' && out.pct === 30);
  /* سنا: کاربر نرخ را دست نزده → نرخ سنا مبنا */
  out = null;
  dlgOpts.onOk({ pct: 30, rtype: 'sana', rate: 130000, amt: '', note: '' });
  T('انتخاب سنا بدون دست زدن به نرخ → 450×110000 = 49.5م', out && out.rate === 110000 && out.amt === 49500000);
  /* مبلغ مستقیم بدون درصد */
  out = null;
  dlgOpts.onOk({ pct: '', rtype: 'agreed', rate: 120000, amt: 12000000, note: '' });
  T('مسیر مبلغ مستقیم: معادل ارزی = 100$', out && out.fxAmt === 100 && out.rateType === 'agreed');
  /* بدون نرخ → رد */
  out = null; global._alerts = [];
  dlgOpts.onOk({ pct: 30, rtype: 'free', rate: '', amt: '', note: '' });
  T('بدون نرخ: رد با پیام', out === null && global._alerts.some(function (a) { return a.indexOf('نرخ تسعیر الزامی') > -1; }));
  /* بدون مبلغ و بدون درصد → رد */
  global._alerts = [];
  dlgOpts.onOk({ pct: '', rtype: 'free', rate: 130000, amt: '', note: '' });
  T('بدون مبلغ/درصد: رد', out === null && global._alerts.length === 1);
})();

SECTION('US-416 (رفتاری): ptfMoney');
(function () {
  var m = fx.match(/window\.ptfMoney = function \(v, cur\) \{[\s\S]*?\n  \};/);
  T('ptfMoney استخراج شد', !!m);
  if (!m) return;
  eval(m[0].replace('window.ptfMoney', 'global.ptfMoney'));
  T('ریالی: با «ریال» (v19.6)', ptfMoney(58500000) === (58500000).toLocaleString('fa-IR') + ' ریال');
  T('دلاری: با USD و بدون «ت»', ptfMoney(1500, 'USD') === '1,500.00 USD');
  T('یورویی: EUR', ptfMoney(2500.5, 'EUR') === '2,500.50 EUR');
})();

SECTION('رگرسیون');
T('hook توست نرخ زنده در دیالوگ تسعیر (v16.1) پابرجا', fx.indexOf('_fxDlgOrig(kind, refNo, cur, cb)') > -1);
T('موتور سود ptfProjectProfitIRR دست‌نخورده (pays[].fx می‌خواند)', fx.indexOf('window.ptfProjectProfitIRR') > -1 && fx.indexOf('pays.forEach(function (pp)') > -1);
T('مصرف‌کننده دیالوگ (recv در fx) پابرجا', fx.indexOf("ptfFxPayDialog('in', inv.offerNo, cur, function (fx)") > -1);
T('نوار ارز و تشخیص سنا (v16.9) پابرجا', fx.indexOf('سنا: منبع پاسخ نداد') > -1 && fx.indexOf('window.ptfFxDiag') > -1);
T('جمع لحظه‌ای v17.0 پابرجا', of.indexOf('function offRenderTotals(rowIdx)') > -1);
T('renderOffers: ستون‌های دیگر دست‌نخورده', of.indexOf("'<td>' + o.items.length + '</td>'") > -1);

DONE('tester92-v174');
