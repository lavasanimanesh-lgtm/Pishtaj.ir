/* tester46 — v12.6 (BUG-008/009/010 + US-310..312): مرور کالا در مودال، درج از اولین ردیف خالی، لینک دستیار→تامین، ارجاعات */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var of = fs.readFileSync(path.join(BASE, 'offers.js'), 'utf-8');
var ol = fs.readFileSync(path.join(BASE, 'offerlock.js'), 'utf-8');
var ai = fs.readFileSync(path.join(BASE, 'ai-workbench.js'), 'utf-8');
var br = fs.readFileSync(path.join(BASE, 'bridge.js'), 'utf-8');

SECTION('BUG-008: نمایش کالاهای ثبت‌شده در مودال پیشنهاد (TO/CO/TC)');
T('کوئری خالی = حالت مرور (۱۲ کالای اخیر)', ol.indexOf('if (!q) return all.slice(0, 12);') > -1);
T('onfocus دراپ‌داون را باز می‌کند', ol.indexOf("onfocus=\"offProdSrchInput(") > -1);
T('سرتیتر مرور با شمار کل کالاها', ol.indexOf('کالاهای ثبت‌شده (') > -1);
T('placeholder راهنما', ol.indexOf('کلیک = مرور کالاها') > -1);
/* v15.9 (US-389): جستجو به موتور مشترک دوزبانه ptfProdSearchMatch ارتقا یافت (fallback قدیمی شامل md) */
T('جستجو روی استاندارد/برند/دسته هم', ol.indexOf('ptfProdSearchMatch(p, q)') > -1 && ol.indexOf("(p.md || '') + ' ' + (p.ca || '')") > -1);
T('بستن دراپ‌داون با blur (تاخیر برای کلیک)', ol.indexOf('onblur=') > -1 && ol.indexOf('setTimeout(function(){if(d)d.style.display=') > -1);

SECTION('US-310: درج از اولین ردیف فاقد کالا');
T('offRowIsEmpty + offSmartInsert تعریف شده', of.indexOf('window.offRowIsEmpty') > -1 && of.indexOf('window.offSmartInsert') > -1);
T('ردیف خالی = بدون pcode/شرح/مدل', of.indexOf('!it.pcode && !String(it.name') > -1);
T('بارگذاری از درخواست → درج هوشمند', of.indexOf('offSmartInsert(item); /* v12.6 US-310 */') > -1);
T('ایمپورت اکسل پیشنهاد → درج هوشمند', of.indexOf('offSmartInsert({ /* v12.6 US-310 */') > -1);
T('انتخاب چندگانه کالا → درج هوشمند', ol.indexOf('offSmartInsert(newIt)') > -1);
T('هر دو مسیر دستیار → درج هوشمند', (ai.match(/offSmartInsert/g) || []).length >= 2);
// تست رفتاری — کد استخراج و توابع window.* به فراخوانی صریح تبدیل می‌شوند (شبیه scope مرورگر)
(function () {
  var start = of.indexOf('window.offRowIsEmpty');
  var end = of.indexOf('function offAddItem(pre)', start);
  var code = of.slice(start, end)
    .replace(/offRowIsEmpty\(/g, 'window.offRowIsEmpty(')
    .replace(/window\.window\./g, 'window.');
  var w = { _offState: { items: [{ name: '', desc: '', model: '', qty: 1, unit: 'NO', brand: '', dlv: '', price: 0 }] } };
  var fn = new Function('window', '_offState', code + '; return window;');
  var api = fn(w, w._offState);
  var i1 = api.offSmartInsert({ pcode: 'P-1', name: 'A', desc: '-' });
  var i2 = api.offSmartInsert({ pcode: 'P-2', name: 'B', desc: '-' });
  T('رفتاری: کالای اول در ایندکس 0 (نه ردیف دوم)', i1 === 0);
  T('رفتاری: کالای دوم append + بدون ردیف خالی', i2 === 1 && w._offState.items.length === 2);
})();

SECTION('BUG-009/US-311: لینک دستیار → استعلام هوشمند تامین');
T('ساختار رکورد درست: no سریال PTF-RFQS + targets', ai.indexOf("'PTF-RFQS-'+yr+'-'") > -1 && ai.indexOf('targets:[]') > -1);
T('ساختار غلط قدیمی حذف شد ({cd,inqNo})', ai.indexOf("sq.unshift({cd:sqCd, inqNo:inqNo") === -1);
T('اقلام پاک‌سازی‌شده (name/spec/qty/unit — سازگار ماژول تامین)', ai.indexOf("return { name:r.nm||'', spec:r.spec||'', qty:r.qty||1, unit:r.un||'عدد'") > -1);
T('لینک مستقیم «انتخاب تامین‌کنندگان» در نتیجه', ai.indexOf("goPanel(\\'rfqs\\')") > -1 && ai.indexOf('انتخاب تامین‌کنندگان') > -1);
T('audit ثبت می‌شود', ai.indexOf('پیش‌نویس استعلام تامین توسط دستیار') > -1);
T('rollback با no جدید هم کار می‌کند', ai.indexOf('x.cd!==sNo && x.no!==sNo') > -1);

SECTION('US-312: ارجاعات');
T('«استعلام قیمت از تامین‌کننده» جایگزین «صدور پیش‌فاکتور»', br.indexOf('استعلام قیمت از تامین‌کننده') > -1 && br.indexOf("'صدور پیش‌فاکتور'") === -1);
T('بقیه اقدامات ارجاع پابرجا', br.indexOf('صدور پیشنهاد فنی (TO)') > -1 && br.indexOf('بررسی و اظهارنظر') > -1);
DONE('tester46-v126');
