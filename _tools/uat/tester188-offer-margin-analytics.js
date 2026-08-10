/* tester188 — v31.7.13 (US-OFF-MARGIN: حاشیه سود کلی صورت + منحنی احتمال برد در تحلیلگر)
 * ۱) helper حاشیه کل (جمع خرید مرجع نسبت به جمع فروش) با coverage
 * ۲) بج حاشیه در ردیف فهرست پیشنهادات — فقط نقش دارای buyPrice
 * ۳) snapshot حاشیه لحظه برد/باخت (marginAtClose)
 * ۴) موتور بازه‌بندی و نرخ برد + سطح اعتماد + بهترین بازه در تحلیلگر */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var of = fs.readFileSync(path.join(BASE, 'offers.js'), 'utf-8');
var an = fs.readFileSync(path.join(BASE, 'analyzer.js'), 'utf-8');
var rial = fs.readFileSync(path.join(BASE, 'offer-rial-convert.js'), 'utf-8');

SECTION('وجود اصلاحات در source');
T('helper ptfOfferOverallMargin موجود و export شده', of.indexOf('function ptfOfferOverallMargin') > -1 && of.indexOf('window.ptfOfferOverallMargin = ptfOfferOverallMargin') > -1);
T('بج حاشیه کل در renderOffers فقط با buyPrice', /_canSeeMargin = !!\(roleDef\(\) \|\| \{\}\)\.buyPrice/.test(of) && of.indexOf('حاشیه کل:') > -1);
T('snapshot لحظه برد (marginAtClose)', /o\.st = 'won';[\s\S]{0,400}marginAtClose/.test(of));
T('snapshot لحظه باخت', /st === 'lost'[\s\S]{0,200}marginAtClose/.test(of));
T('تبدیل ریالی نرخ‌های مرجع خرید را نیز تسعیر و metadata آن را نگه می‌دارد', rial.indexOf('function convertItemToIrr') > -1 && rial.indexOf("['refPrice', 'refBuyPrice', 'bestBuyPrice']") > -1 && rial.indexOf('fxConvertedCosts') > -1);
T('موتور anlMarginWinCurve و بازه‌ها در تحلیلگر', an.indexOf('function anlMarginWinCurve') > -1 && an.indexOf('ANL_MARGIN_BUCKETS') > -1);
T('تحلیلگر snapshot را بر محاسبه زنده مقدم می‌کند', /o\.marginAtClose && o\.marginAtClose\.marginPct != null\) \? o\.marginAtClose/.test(an));
T('نمودار و پیشنهاد سیستم در renderAnalyzer', an.indexOf('احتمال برد بر حسب حاشیه سود کلی صورت') > -1 && an.indexOf('پیشنهاد سیستم:') > -1);
T('سطح اعتماد مبتنی بر حجم نمونه', /b\.n >= 10 \? 'بالا' : b\.n >= 3 \? 'متوسط'/.test(an));

SECTION('رفتاری: محاسبه حاشیه کلی صورت');
global.window = global;
eval(of.match(/function ptfOfferOverallMargin\(o\) \{[\s\S]*?\n\}/)[0]);
window.ptfOfferOverallMargin = ptfOfferOverallMargin;
/* سناریوی کارفرما: ۵ قلم با سودهای متفاوت (۵٪، ۱۰٪، ...) */
var o5 = { kind: 'CO', items: [
  { qty: 1, refPrice: 100, price: 105 },   // 5%
  { qty: 1, refPrice: 100, price: 110 },   // 10%
  { qty: 2, refPrice: 50,  price: 60 },    // 20%
  { qty: 1, refPrice: 200, price: 230 },   // 15%
  { qty: 1, refPrice: 100, price: 125 }    // 25%
] };
var r5 = ptfOfferOverallMargin(o5);
/* buy=100+100+100+200+100=600 | sell=105+110+120+230+125=690 → 15% */
T('حاشیه کل ۵ قلم با سودهای مختلف = ۱۵٪ (وزنی، نه میانگین ساده)', r5.marginPct === 15 && r5.coverage === 5);
var oPart = { kind: 'CO', items: [ { qty: 1, refPrice: 100, price: 120 }, { qty: 1, price: 500 } ] };
var rPart = ptfOfferOverallMargin(oPart);
T('قلم بدون نرخ مرجع از محاسبه خارج و coverage گزارش می‌شود', rPart.marginPct === 20 && rPart.coverage === 1 && rPart.totalItems === 2);
T('TO حاشیه ندارد (null)', ptfOfferOverallMargin({ kind: 'TO', items: [{ qty: 1, refPrice: 1, price: 2 }] }) === null);
var rNeg = ptfOfferOverallMargin({ kind: 'CO', items: [{ qty: 1, refPrice: 100, price: 90 }] });
T('حاشیه منفی (زیان) درست محاسبه می‌شود', rNeg.marginPct === -10);
/* BUG-OFFER-FX-MARGIN-001: در companion ریالی، فروش و نرخ مرجع باید هم‌واحد باشند.
   پوشش legacy نیز لازم است؛ رکوردهای ساخته‌شده پیش از رفع، refPrice ارزی دارند. */
var rFxNew = ptfOfferOverallMargin({ kind: 'CO', currency: 'IRR', rialOf: 'CO-FX-1', fxConvert: { rate: 1000000 }, items: [
  { qty: 1, refPrice: 100000000, price: 120000000, fxConvertedCosts: { rate: 1000000 } }
] });
T('حاشیه نسخه ریالی جدید با نرخ مرجع تسعیرشده درست = ۲۰٪', rFxNew.marginPct === 20 && rFxNew.buyTotal === 100000000);
var rFxLegacy = ptfOfferOverallMargin({ kind: 'CO', currency: 'IRR', rialOf: 'CO-FX-OLD', fxConvert: { rate: 1000000 }, items: [
  { qty: 1, refPrice: 100, price: 120000000 }
] });
T('حاشیه نسخه ریالی قدیمی با مرجع ارزیِ باقیمانده، با نرخ تبدیل اصلاح می‌شود = ۲۰٪', rFxLegacy.marginPct === 20 && rFxLegacy.buyTotal === 100000000);

SECTION('رفتاری: منحنی احتمال برد');
eval(an.match(/var ANL_MARGIN_BUCKETS[\s\S]*?window\.anlMarginWinCurve = anlMarginWinCurve;/)[0]);
function co(m, st) { return { kind: 'CO', st: st, items: [{ qty: 1, refPrice: 100, price: 100 + m }] }; }
var hist = [];
for (var i = 0; i < 8; i++) hist.push(co(7, 'won'));    // ۵-۱۰٪ → ۸ برد
for (var j = 0; j < 2; j++) hist.push(co(8, 'lost'));   // ۵-۱۰٪ → ۲ باخت → 80%
for (var k = 0; k < 4; k++) hist.push(co(25, 'lost'));  // ۲۰-۳۰٪ → ۴ باخت → 0%
hist.push(co(12, 'won'));                                // ۱۰-۱۵٪ → ۱ نمونه (اعتماد کم)
hist.push({ kind: 'CO', st: 'won', items: [{ qty: 1, price: 999 }] }); // بدون نرخ مرجع → skipped
hist.push(co(50, 'sent'));                               // باز — نباید شمرده شود
setData('ptf_crm_offers', hist);
var cv = anlMarginWinCurve();
var b510 = cv.buckets.filter(function (b) { return b.lb === '۵ تا ۱۰٪'; })[0];
var b2030 = cv.buckets.filter(function (b) { return b.lb === '۲۰ تا ۳۰٪'; })[0];
var b1015 = cv.buckets.filter(function (b) { return b.lb === '۱۰ تا ۱۵٪'; })[0];
T('بازه ۵-۱۰٪: نرخ برد ۸۰٪ با اعتماد بالا (۱۰ نمونه)', b510.winPct === 80 && b510.n === 10 && b510.conf === 'بالا');
T('بازه ۲۰-۳۰٪: نرخ برد ۰٪ با اعتماد متوسط (۴ نمونه)', b2030.winPct === 0 && b2030.n === 4 && b2030.conf === 'متوسط');
T('بازه ۱۰-۱۵٪: ۱ نمونه → اعتماد کم', b1015.n === 1 && b1015.conf === 'کم');
T('پیشنهاد بدون نرخ مرجع skipped و پیشنهاد باز شمرده نمی‌شود', cv.skipped === 1 && cv.usable === 15 && cv.closedTotal === 16);
T('بهترین بازه = ۵ تا ۱۰٪ (بیشینه نرخ برد با حداقل ۳ نمونه)', cv.best && cv.best.lb === '۵ تا ۱۰٪' && cv.best.winPct === 80);
/* اولویت snapshot: پیشنهاد برنده که بعداً اقلامش عوض شده */
setData('ptf_crm_offers', [
  { kind: 'CO', st: 'won', marginAtClose: { marginPct: 7 }, items: [{ qty: 1, refPrice: 100, price: 190 }] }
]);
var cv2 = anlMarginWinCurve();
var bSnap = cv2.buckets.filter(function (b) { return b.lb === '۵ تا ۱۰٪'; })[0];
T('snapshot لحظه بسته‌شدن بر محاسبه زنده مقدم است (۷٪ نه ۹۰٪)', bSnap.n === 1 && bSnap.won === 1);

SECTION('رگرسیون');
T('قیف فروش قبلی دست‌نخورده', an.indexOf('anlOfferFunnel') > -1 && an.indexOf('قیف پیشنهادهای مالی') > -1);
T('ماتریس سود (US-220) دست‌نخورده', of.indexOf('offOpenProfitOptimizer') > -1);

DONE('tester188-offer-margin-analytics');
