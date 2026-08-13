/* tester83 — v16.5 (US-399: پروفایل تخصصی تامین‌کننده + تامین‌یاب هوشمند برند-آگاه) */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var sp = fs.readFileSync(path.join(BASE, 'supspec.js'), 'utf-8');
var rq = fs.readFileSync(path.join(BASE, 'rfqsmart.js'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');
var dd = fs.readFileSync(path.join(BASE, 'dedup.js'), 'utf-8');

SECTION('نسخه و ثبت');
T('نسخه v16.5+', (function(){var m=idx.match(/window.PTF_CRM_RELEASE = 'v([0-9.]+)'/);return m&&parseFloat(m[1])>=16.5;})());
T('کش sw >= v16.5 + supspec در SHELL', (function(){var m=sw.match(/var RELEASE = 'v([0-9.]+)';/);return m&&parseFloat(m[1])>=16.5;})() && sw.indexOf("'./supspec.js'") > -1);
T('supspec.js در index.html', (function(){var m=idx.match(/supspec\.js\?v=([0-9.]+)/);return m&&parseFloat(m[1])>=16.5;})());
(function () {
  var m = idx.match(/rfqsmart\.js\?v=([0-9.]+)/);
  T('cache-bust rfqsmart >= 16.5', m && parseFloat(m[1]) >= 16.5);
})();

SECTION('US-399 (کد): ساختار ماژول');
T('جدول مترادف برندها (زیمنس↔Siemens، ویکا↔WIKA، روزمونت↔Rosemount)', sp.indexOf("['Siemens', 'زیمنس']") > -1 && sp.indexOf("['WIKA', 'ویکا']") > -1 && sp.indexOf("'روزمونت'") > -1);
T('AC1: چیپ برند + چیپ تجهیز در فرم (hook الگوی cheques)', sp.indexOf('spChipsBr') > -1 && sp.indexOf('spChipsEq') > -1 && sp.indexOf('window._spModalHooked') > -1);
T('AC1: پیشنهاد از برندهای شناخته‌شده + برندهای کالاها (datalist)', sp.indexOf('function knownBrands()') > -1 && sp.indexOf("getData('ptf_crm_products')") > -1);
T('AC1: مهاجرت نرم فیلد brands قدیمی سایت → spBrands', sp.indexOf('function migrate()') > -1 && sp.indexOf('s.brands && (!s.spBrands || !s.spBrands.length)') > -1);
T('AC2: گسترش entityMatches — مسیر قبلی حفظ + blob تخصص با dedupNorm', sp.indexOf('if (_em(entity, q)) return true;') > -1 && sp.indexOf('ptfSupSpecBlob') > -1);
T('AC3: وزن‌ها برند(۴۰،سقف۸۰) > تجهیز(۲۰،سقف۴۰) > سابقه(۱۰،سقف۳۰)', sp.indexOf('Math.min(80, hitBrands.length * 40)') > -1 && sp.indexOf('Math.min(40, eqHits * 20)') > -1 && sp.indexOf('Math.min(30, ph * 10)') > -1);
T('AC3: سابقه از purchases واقعی buycmp (v16.0)', sp.indexOf("getData('ptf_crm_buycmp')") > -1 && sp.indexOf('c.purchases || []') > -1);
T('AC3: دلیل پیشنهاد ذکر می‌شود', sp.indexOf("'تخصص برند: '") > -1 && sp.indexOf("' خرید موفق'") > -1);
T('AC4: یادگیری با تایید کاربر + audit', sp.indexOf('window.ptfSupSpecLearn') > -1 && sp.indexOf('یادگیری تامین‌یاب') > -1 && sp.indexOf("'یادگیری تخصص: '") > -1);
T('AC4: فقط وقتی سیستم خودش بابت برند پیشنهاد نکرده بود می‌پرسد', sp.indexOf("indexOf('تخصص برند') > -1) return;") > -1);
T('rfqsmart: امتیاز تخصصی به rfqsScoreSuppliers اضافه شد — مسیر قبلی حفظ (AC5)', rq.indexOf('ptfSupSpecScore === ') > -1 && rq.indexOf("why.push(hits + ' واژه منطبق')") > -1);
T('rfqsmart: یادگیری در rfqsFinalize قبل از حذف _ranked', rq.indexOf('ptfSupSpecLearn(_st.items, targets, _st._ranked)') > -1 && rq.indexOf('ptfSupSpecLearn') < rq.indexOf('delete _st._ranked'));
T('چیپ نیمه‌تایپ‌شده هنگام ذخیره لحاظ می‌شود', sp.indexOf("ptfSpChipAdd('br', 'spInpBr')") > -1);
T('نمایش تخصص در جدول تامین‌کنندگان (پس-پردازش، بدون دست زدن به رندر اصلی)', sp.indexOf('data-spdec') > -1 && sp.indexOf('window._spRenderHooked') > -1);

SECTION('US-399 (رفتاری): نرمال‌سازی برند دوزبانه');
global.window = global;
/* dedupNorm واقعی از dedup.js */
loadFns('dedup.js', ['dedupNorm']);
(function () {
  var mA = sp.match(/window\.PTF_BRAND_ALIASES = \[[\s\S]*?\n  \];/);
  var mC = sp.match(/window\.ptfBrandCanon = function[\s\S]*?\n  \};/);
  var mG = sp.match(/function brandGroup\(b\) \{[\s\S]*?\n  \}/);
  var mB = sp.match(/window\.ptfSupSpecBlob = function[\s\S]*?\n  \};/);
  var mN = sp.match(/function norm\(s\) \{[\s\S]*?\n  \}/);
  T('توابع استخراج شدند', !!mA && !!mC && !!mG && !!mB && !!mN);
  if (!(mA && mC && mG && mB && mN)) return;
  eval(mA[0].replace('window.PTF_BRAND_ALIASES', 'global.PTF_BRAND_ALIASES'));
  eval(mN[0].replace('function norm', 'global.norm = function'));
  eval(mC[0].replace('window.ptfBrandCanon', 'global.ptfBrandCanon'));
  eval(mG[0].replace('function brandGroup', 'global.brandGroup = function'));
  eval(mB[0].replace('window.ptfSupSpecBlob', 'global.ptfSupSpecBlob'));
  T('زیمنس → Siemens (متعارف‌سازی)', ptfBrandCanon('زیمنس') === 'Siemens' && ptfBrandCanon('SIEMENS') === 'Siemens');
  T('ویکا → WIKA، روزمونت → Rosemount', ptfBrandCanon('ویکا') === 'WIKA' && ptfBrandCanon('روزمونت') === 'Rosemount' && ptfBrandCanon('رزمونت') === 'Rosemount');
  T('برند ناشناخته دست‌نخورده برمی‌گردد', ptfBrandCanon('BrandX') === 'BrandX');
  var blob = ptfSupSpecBlob({ spBrands: ['Siemens'], spEquip: ['ترانسمیتر فشار'] });
  T('blob تامین‌کننده Siemens شامل «زیمنس» است (جستجوی فارسی)', blob.indexOf('زیمنس') > -1 && blob.toLowerCase().indexOf('siemens') > -1);
  T('blob فیلد قدیمی brands رشته‌ای را هم می‌گیرد', ptfSupSpecBlob({ brands: 'WIKA, KITZ' }).indexOf('ویکا') > -1);
})();

SECTION('US-399 (رفتاری): جستجوی دوزبانه یک‌نتیجه (AC2)');
(function () {
  /* entityMatches واقعی offers.js + hook واقعی supspec */
  loadFns('offers.js', ['entityMatches']);
  /* اجرای hook واقعی: تابع hookSearch کامل از supspec.js استخراج و اجرا می‌شود */
  var mH = sp.match(/function hookSearch\(\) \{[\s\S]*?\n  \}/);
  T('hook جستجو استخراج شد', !!mH);
  if (!mH) return;
  global.window = global;
  global.window.entityMatches = global.entityMatches;
  delete global.window._spSearchHooked;
  eval(mH[0].replace('function hookSearch', 'global.hookSearch = function'));
  T('hookSearch اجرا شد', hookSearch() === true);
  global.entityMatches = global.window.entityMatches;
  var supSiemens = { cd: 'SUP-1', co: 'آریا کنترل', ca: 'ابزار دقیق', spBrands: ['Siemens'], spEquip: ['ترانسمیتر فشار'], people: [] };
  var supOther = { cd: 'SUP-2', co: 'پارس ولو', ca: 'شیرآلات', spBrands: ['KITZ'], people: [] };
  T('جستجوی «زیمنس» تامین‌کننده Siemens را می‌یابد', entityMatches(supSiemens, 'زیمنس') === true);
  T('جستجوی «Siemens» همان نتیجه (یک نتیجه — دو زبان)', entityMatches(supSiemens, 'Siemens') === true);
  T('جستجوی «siemens» با حروف کوچک', entityMatches(supSiemens, 'siemens') === true);
  T('تامین‌کننده غیرمرتبط پیدا نمی‌شود', entityMatches(supOther, 'زیمنس') === false);
  T('جستجوی تجهیز: «ترانسمیتر فشار»', entityMatches(supSiemens, 'ترانسمیتر فشار') === true);
  T('مسیر قبلی سالم: جستجوی نام شرکت', entityMatches(supOther, 'پارس ولو') === true);
  T('رکورد بدون تخصص: جستجوی برند false بدون خطا (AC5)', entityMatches({ cd: 'SUP-3', co: 'تست', people: [] }, 'زیمنس') === false);
})();

SECTION('US-399 (رفتاری): امتیازدهی per قلم (AC3) و سازگاری (AC5)');
(function () {
  var mI = sp.match(/window\.ptfItemsBrands = function[\s\S]*?\n  \};/);
  var mP = sp.match(/function purchaseHistory\(s\) \{[\s\S]*?\n  \}/);
  var mS = sp.match(/window\.ptfSupSpecScore = function[\s\S]*?\n  \};/);
  T('توابع امتیاز استخراج شدند', !!mI && !!mP && !!mS);
  if (!(mI && mP && mS)) return;
  eval(mI[0].replace('window.ptfItemsBrands', 'global.ptfItemsBrands'));
  eval(mP[0].replace('function purchaseHistory', 'global.purchaseHistory = function'));
  eval(mS[0].replace('window.ptfSupSpecScore', 'global.ptfSupSpecScore'));
  var items = [{ name: 'Pressure Transmitter Siemens 7MF4033', spec: '0-100 bar', qty: 2 }, { name: 'گیج فشار ویکا', spec: '232.50', qty: 5 }];
  var ib = ptfItemsBrands(items);
  T('برند از متن قلم شناسایی شد (EN صریح + فارسی داخل شرح)', ib.indexOf('Siemens') > -1 && ib.indexOf('WIKA') > -1);
  setData('ptf_crm_buycmp', [{ id: 'CMP-1', inqNo: 'INQ-1', purchases: [{ idx: 0, sup: 'آریا کنترل', price: 100 }, { idx: 1, sup: 'آریا کنترل', price: 200 }] }]);
  var sup = { cd: 'SUP-1', co: 'آریا کنترل', spBrands: ['Siemens', 'WIKA'], spEquip: ['گیج فشار'] };
  var r = ptfSupSpecScore(sup, items);
  T('امتیاز برند: ۲ برند منطبق = ۸۰ (سقف)', r.why.join('|').indexOf('تخصص برند') > -1 && r.score >= 80);
  T('امتیاز تجهیز + سابقه ۲ خرید در دلیل', r.why.join('|').indexOf('تخصص تجهیز') > -1 && r.why.join('|').indexOf('سابقه 2 خرید موفق') > -1);
  T('جمع امتیاز = 80+20+20 = 120', r.score === 120);
  var noSpec = ptfSupSpecScore({ cd: 'SUP-9', co: 'بی‌تخصص' }, items);
  T('AC5: تامین‌کننده بدون تخصص → امتیاز تخصصی صفر بدون خطا', noSpec.score === 0 && noSpec.why.length === 0);
})();

SECTION('US-399 (رفتاری): رتبه‌بندی کامل rfqsScoreSuppliers با تخصص');
(function () {
  /* اجرای واقعی rfqsScoreSuppliers از rfqsmart.js (IIFE — استخراج تابع) */
  var m = rq.match(/window\.rfqsScoreSuppliers = function \(items\) \{[\s\S]*?\n  \};/);
  var mD = rq.match(/var CATS_MAP = \[[\s\S]*?\n  \];/);
  var mDC = rq.match(/function detectCat\(text\) \{[\s\S]*?\n  \}/);
  T('rfqsScoreSuppliers استخراج شد', !!m && !!mD && !!mDC);
  if (!(m && mD && mDC)) return;
  eval(mD[0].replace('var CATS_MAP', 'global.CATS_MAP'));
  eval(mDC[0].replace('function detectCat', 'global.detectCat = function'));
  eval(m[0].replace('window.rfqsScoreSuppliers', 'global.rfqsScoreSuppliers'));
  setData('ptf_crm_suppliers', [
    { cd: 'SUP-A', co: 'عمومی ابزار', ca: 'ابزار دقیق' },                                          /* فقط زمینه */
    { cd: 'SUP-B', co: 'آریا کنترل', ca: 'ابزار دقیق', spBrands: ['Siemens'] },                    /* زمینه + برند */
    { cd: 'SUP-C', co: 'پارس ولو', ca: 'شیرآلات', spBrands: ['KITZ'] }                             /* نامرتبط */
  ]);
  setData('ptf_crm_buyquotes', []);
  setData('ptf_crm_buycmp', []);
  var ranked = rfqsScoreSuppliers([{ name: 'Siemens Pressure Transmitter', spec: '7MF4033' }]);
  T('تامین‌کننده متخصص Siemens رتبه ۱ (بالاتر از هم‌زمینه عمومی)', ranked[0].cd === 'SUP-B' && ranked[0].score > ranked.filter(function (x) { return x.cd === 'SUP-A'; })[0].score);
  T('دلیل پیشنهاد شامل تخصص برند', ranked[0].why.indexOf('تخصص برند: Siemens') > -1);
  T('AC5: تامین‌کننده بدون تخصص همچنان با زمینه امتیاز دارد', ranked.filter(function (x) { return x.cd === 'SUP-A'; })[0].score > 0);
  T('نامرتبط آخر است', ranked[ranked.length - 1].cd === 'SUP-C');
})();

SECTION('US-399 (رفتاری): مهاجرت نرم و یادگیری (AC1/AC4)');
(function () {
  var mM = sp.match(/function migrate\(\) \{[\s\S]*?\n  \}/);
  T('migrate استخراج شد', !!mM);
  if (mM) {
    eval(mM[0].replace('function migrate', 'global.migrate = function'));
    setData('ptf_crm_suppliers', [
      { cd: 'S1', co: 'سایتی', brands: 'زیمنس, WIKA, kitz' },
      { cd: 'S2', co: 'دستی', spBrands: ['ABB'], brands: 'قدیمی' }
    ]);
    migrate();
    var s1 = getData('ptf_crm_suppliers')[0];
    var s2 = getData('ptf_crm_suppliers')[1];
    T('رشته سایت → آرایه متعارف (زیمنس→Siemens، kitz→KITZ)', JSON.stringify(s1.spBrands) === JSON.stringify(['Siemens', 'WIKA', 'KITZ']));
    T('رکورد دارای spBrands دست نمی‌خورد', JSON.stringify(s2.spBrands) === JSON.stringify(['ABB']));
  }
  var mL = sp.match(/window\.ptfSupSpecLearn = function[\s\S]*?\n  \};/);
  T('ptfSupSpecLearn استخراج شد', !!mL);
  if (mL) {
    eval(mL[0].replace('window.ptfSupSpecLearn', 'global.ptfSupSpecLearn'));
    global._confirms = [];
    global.confirm = function (msg) { global._confirms.push(String(msg)); return true; };
    global.audit = function () {};
    setData('ptf_crm_suppliers', [{ cd: 'SUP-N', co: 'نوین تجهیز', ca: 'ابزار دقیق' }]);
    /* کاربر دستی SUP-N را برای اقلام Siemens انتخاب کرد؛ سیستم بابت برند پیشنهادش نکرده بود */
    ptfSupSpecLearn(
      [{ name: 'Siemens Positioner', spec: 'PS2' }],
      [{ cd: 'SUP-N', co: 'نوین تجهیز' }],
      [{ cd: 'SUP-N', why: 'دسته منطبق: ابزار دقیق' }]
    );
    var sn = getData('ptf_crm_suppliers')[0];
    T('یادگیری: با تایید کاربر Siemens به تخصص اضافه شد', global._confirms.length === 1 && JSON.stringify(sn.spBrands) === JSON.stringify(['Siemens']));
    /* بار دوم: دیگر نپرسد (برند از قبل هست) */
    global._confirms = [];
    ptfSupSpecLearn([{ name: 'Siemens Positioner' }], [{ cd: 'SUP-N', co: 'نوین تجهیز' }], [{ cd: 'SUP-N', why: 'تخصص برند: Siemens' }]);
    T('بار دوم سوال تکراری نمی‌پرسد', global._confirms.length === 0);
    /* انصراف کاربر = بدون تغییر */
    setData('ptf_crm_suppliers', [{ cd: 'SUP-M', co: 'متین', ca: 'برق' }]);
    global.confirm = function () { return false; };
    ptfSupSpecLearn([{ name: 'WIKA Gauge' }], [{ cd: 'SUP-M', co: 'متین' }], [{ cd: 'SUP-M', why: 'x' }]);
    T('انصراف = تخصص اضافه نمی‌شود', !getData('ptf_crm_suppliers')[0].spBrands);
  }
})();

SECTION('رگرسیون');
T('rfqsScoreSuppliers: امتیازهای قبلی (دسته/واژه/سابقه قیمت‌دهی/تاییدشده) پابرجا', rq.indexOf("why.push('دسته منطبق: ' + cat)") > -1 && rq.indexOf('سابقه قیمت‌دهی') > -1 && rq.indexOf("s.src === 'site' && s.approvedBy") > -1);
T('rfqsFinalize: گارد استعلام تکراری srcRfq پابرجا', rq.indexOf('قبلاً استعلام تامین شماره') > -1);
T('hook زنجیره showSupModal2 (cheques origin + supspec chips) — هر دو الگوی wrap', fs.readFileSync(path.join(BASE, 'cheques.js'), 'utf-8').indexOf('_supOrgHooked') > -1 && sp.indexOf('_spModalHooked') > -1);
T('dedup.js دست‌نخورده (موتور مشترک)', dd.indexOf('function dedupNorm') > -1 && dd.indexOf('PTF_CAT_ALIASES') > -1);
T('supspec بعد از offers/cheques لود می‌شود (hook درست)', idx.indexOf('supspec.js') > idx.indexOf('cheques.js'));

DONE('tester83-v165');
