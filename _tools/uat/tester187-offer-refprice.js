/* tester187 — v31.7.12 (BUG-OFF-FOCUS-001 + US-OFF-REF: نرخ مرجع در فرم پیشنهاد مالی)
 * ۱) پریدن فوکوس هنگام تایپ درصد سود/نرخ مرجع (رندر کامل جدول در oninput)
 * ۲) write-back نرخ مرجع ویرایش‌شده از فرم به ماژول کالا هنگام ذخیره
 * ۳) فیلد نرخ مرجع در ثبت سریع کالا
 * ۴) ثبت خودکار کالای دستی/اکسلی غیرتکراری در ماژول کالا با مارک مخفی منبع (srcRef) */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var of = fs.readFileSync(path.join(BASE, 'offers.js'), 'utf-8');
var ol = fs.readFileSync(path.join(BASE, 'offerlock.js'), 'utf-8');

SECTION('۱) رفع پرش فوکوس (BUG-OFF-FOCUS-001)');
T('offUpdRefPrice دیگر رندر کامل نمی‌کند', !/offUpdRefPrice = function[\s\S]{0,600}offRenderItems\(\);/.test(of) && /offUpdRefPrice = function[\s\S]{0,700}offSyncRowInputs\(i, 'ref'\)/.test(of));
T('offUpdMarginPct دیگر رندر کامل نمی‌کند', !/offUpdMarginPct = function[\s\S]{0,800}offRenderItems\(\);\s*\}\s*\};/.test(of) && /offUpdMarginPct = function[\s\S]{0,900}offSyncRowInputs\(i, 'margin'\)/.test(of));
T('helper offSyncRowInputs موجود و فیلد فعال (activeElement) را دست نمی‌زند', of.indexOf('function offSyncRowInputs') > -1 && /el !== document\.activeElement/.test(of));
T('input های ref/margin در هر دو رندر id ردیفی دارند', /id="offRef' \+ i \+ '"/.test(of) && /id="offMg' \+ i \+ '"/.test(of) && /id="offRef' \+ i \+ '"/.test(ol) && /id="offMg' \+ i \+ '"/.test(ol));
T('input قیمت فرم فعال id ردیفی دارد', /id="off_' \+ f \+ '_' \+ i \+ '"/.test(ol));

SECTION('۲) اولویت نرخ ویرایش‌شده کاربر بر کاتالوگ');
T('refPriceEdited هنگام ویرایش ست می‌شود', /it\.refPriceEdited = true/.test(of));
T('رندر فرم فعال: نرخ ویرایش‌شده بر نرخ کاتالوگ مقدم', /it\.refPriceEdited && \+it\.refPrice > 0\) \? \+it\.refPrice/.test(ol) && /if \(!\(it\.refPriceEdited && \+it\.refPrice > 0\)\) rowRefPrice = refP/.test(ol));

SECTION('۳) ثبت سریع: فیلد نرخ مرجع + مارک منبع');
T('فیلد pr در دیالوگ ثبت سریع', /id: 'pr', label: 'نرخ مرجع خرید/.test(ol));
T('ثبت سریع pr و refPriceAt/refPriceSrc و srcRef می‌نویسد', /pr: _pr,\s*\n\s*refPriceAt: _pr > 0/.test(ol) && /srcRef: \(window\._offState/.test(ol));

SECTION('۴) write-back و ثبت خودکار در offerSave (پوشش دستی/اکسل/هر مبدأ)');
T('بلاک همگام‌سازی در offerSave موجود است', of.indexOf('v31.7.12 US-OFF-REF: همگام‌سازی نرخ مرجع') > -1);
T('write-back فقط با refPriceEdited و تغییر واقعی + history', /it\.refPriceEdited && \+it\.refPrice > 0 && \+p\.pr !== \+it\.refPrice/.test(of) && /به‌روزرسانی نرخ مرجع از پیشنهاد/.test(of));
T('کالای جدید فقط در صورت نبود تکراری (ptfCheckDup) و کد غیر TMP', /ptfCheckDup\('product', \{ nm: nm \}, null\)/.test(of) && /!\/\^TMP-\/\.test\(String\(_cd2\)\)/.test(of));
T('مارک مخفی منبع (srcRef با no/inqNo/at/by) روی کالای خودکار', /srcRef: \{ kind: 'offer', no: o\.no/.test(of));
T('قبل از setData آفرها اجرا می‌شود (اتمی با ذخیره)', of.indexOf("srcRef: { kind: 'offer'") > -1 && of.lastIndexOf("setData('ptf_crm_products', _prods2)") < of.lastIndexOf("setData('ptf_crm_offers', offers)")); /* 2026-08-13: جریان finalize بازطراحی شد؛ writeback محصول همچنان قبل از ذخیرهٔ نهایی پیشنهاد است */

SECTION('رفتاری: شبیه‌سازی write-back و ثبت خودکار');
global.window = global;
global.dedupNorm = function (s) { return String(s || '').toLowerCase().replace(/\s+/g, ''); };
global.ptfCheckDup = function (kind, rec) {
  return getData('ptf_crm_products').filter(function (p) { return dedupNorm(p.nm) === dedupNorm(rec.nm); })
    .map(function (p) { return { v: p.nm }; });
};
global.prodAutoCode = function () { return 'P-9001'; };
global.curSession = function () { return { user: 'u1', name: 'کاربر' }; };
global.faDate = function () { return '1405/04/28'; };
global.audit = function () {};
global.ptfToast = function () {};
// استخراج فقط بلاک sync از offerSave و اجرا در ایزولاسیون
var mStart = of.indexOf('/* ===== v31.7.12 US-OFF-REF');
var mEnd = of.indexOf('\n', of.indexOf('catch (eProdSync)')); // بلاک تا انتهای خط catch
T('بلاک قابل استخراج برای تست است', mStart > -1 && mEnd > mStart);
var blk = of.slice(mStart, mEnd);
setData('ptf_crm_products', [{ cd: 'P-1001', nm: 'گیج فشار', pr: 500000, un: 'NO' }]);
var o = { no: 'CO-1405-77', inqNo: 'RFQ-55', items: [
  { name: 'گیج فشار', pcode: 'P-1001', refPrice: 750000, refPriceEdited: true, qty: 2, price: 900000 },
  { name: 'شیر سوزنی دستی', unit: 'PCS', brand: 'KITZ', refPrice: 300000, refPriceEdited: true, qty: 1, price: 400000 }
] };
eval('(function(o, getData, setData){' + blk + '})(o, global.getData, global.setData)');
var prods = getData('ptf_crm_products');
var p1 = prods.filter(function (p) { return p.cd === 'P-1001'; })[0];
T('نرخ مرجع کالای موجود از 500,000 به 750,000 write-back شد + history', p1 && p1.pr === 750000 && p1.history && p1.history.length === 1 && p1.refPriceSrc === 'پیشنهاد CO-1405-77');
var p2 = prods.filter(function (p) { return p.nm === 'شیر سوزنی دستی'; })[0];
T('کالای دستی غیرتکراری خودکار ثبت شد (کد P-9001، نرخ 300,000)', p2 && p2.cd === 'P-9001' && p2.pr === 300000 && p2.br === 'KITZ');
T('مارک مخفی منبع درست است', p2 && p2.srcRef && p2.srcRef.no === 'CO-1405-77' && p2.srcRef.inqNo === 'RFQ-55' && p2.srcRef.by === 'u1');
T('ردیف فرم به کالای جدید قفل شد', o.items[1].pcode === 'P-9001');
// اجرای دوباره: نباید کالای تکراری بسازد یا history اضافه کند
eval('(function(o, getData, setData){' + blk + '})(o, global.getData, global.setData)');
prods = getData('ptf_crm_products');
T('اجرای دوباره idempotent است (نه کالای تکراری نه history اضافی)', prods.length === 2 && prods.filter(function (p) { return p.cd === 'P-1001'; })[0].history.length === 1);

DONE('tester187-offer-refprice');
