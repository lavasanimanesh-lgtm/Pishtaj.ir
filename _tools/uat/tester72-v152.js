/* tester72 — v15.2 (US-385: ارقام فارسی جدول قیمت تامین + رسیدن قیمت به ماژول کالا و ماتریس سود) */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var rq = fs.readFileSync(path.join(BASE, 'rfqsmart.js'), 'utf-8');
var ol = fs.readFileSync(path.join(BASE, 'offerlock.js'), 'utf-8');
var pl = fs.readFileSync(path.join(BASE, 'procurement-link.js'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');

/* محیط */
global.curSession = function () { return { user: 'admin', name: 'Admin' }; };
global.curRole = function () { return 'admin'; };
global.audit = function () {}; global.notify = function () {};
global.alert = function (m) { global._lastAlert = String(m); };
global.confirm = function (m) { global._lastConfirm = String(m); return global._confirmAns !== false; };
global.window = global;
global.ptfToast = function () {};
global.dedupNorm = function (s) {
  s = String(s == null ? '' : s);
  var fa = '۰۱۲۳۴۵۶۷۸۹', ar = '٠١٢٣٤٥٦٧٨٩', out = '';
  for (var i = 0; i < s.length; i++) {
    var ch = s.charAt(i), fi = fa.indexOf(ch), ai = ar.indexOf(ch);
    if (fi > -1) ch = String(fi); else if (ai > -1) ch = String(ai);
    out += ch;
  }
  return out.replace(/[\u200c\u200f\u200e]/g, '').replace(/[\s\-_.،,؛;()\/\\]/g, '').toLowerCase();
};
/* v28.7: current production resolver is required by reference-price paths. */
eval(pl);

SECTION('بخش ۱ (کد): ارقام فارسی کیبورد');
T('rqsNum: تبدیل فارسی/عربی→EN قبل از پاکسازی', rq.indexOf('function rqsNum(val)') > -1 && rq.indexOf("var FA = '۰۱۲۳۴۵۶۷۸۹', AR = '٠١٢٣٤٥٦٧٨٩';") > -1);
T('اولویت با ptfToEnDigits (phonefmt) + fallback داخلی', rq.indexOf("typeof window.ptfToEnDigits === 'function'") > -1);
T('rfqsUpdatePriceCompare از rqsNum استفاده می‌کند', rq.indexOf('var p = rqsNum(val);') > -1);
T('regex قدیمی حذف ارقام فارسی دیگر مستقیم استفاده نمی‌شود', rq.indexOf("var p = +String(val).replace(/[^\\d]/g, '') || 0;") === -1);
T('inputmode=numeric روی فیلد قیمت (کیبورد عددی موبایل)', rq.indexOf('inputmode="numeric"') > -1);

SECTION('بخش ۱ (رفتاری): ورود قیمت با کیبورد فارسی');
(function () {
  var mNum = rq.match(/function rqsNum\(val\) \{[\s\S]*?\n  \}/);
  T('rqsNum استخراج شد', !!mNum);
  if (!mNum) return;
  eval(mNum[0]);
  T('«۱۲۳۴۵» فارسی → 12345', rqsNum('۱۲۳۴۵') === 12345);
  T('«۱۲,۵۰۰» فارسی با جداکننده → 12500', rqsNum('۱۲,۵۰۰') === 12500);
  T('«٥٠٠» عربی → 500', rqsNum('٥٠٠') === 500);
  T('مخلوط «1۲3۴» → 1234', rqsNum('1۲3۴') === 1234);
  T('انگلیسی عادی «45,000» → 45000', rqsNum('45,000') === 45000);
  T('متن غیرعددی → 0', rqsNum('abcد') === 0);
})();

SECTION('بخش ۲ (کد): رسیدن قیمت به ماژول کالا و ماتریس سود');
T('commit: تطبیق یکتا با resolver (نه first-name)', rq.indexOf('ptfResolveProcurementLine(it, prods)') > -1 && rq.indexOf('referenceAmbiguousCount') > -1);
T('resolver: کد کالا، نام/مدل/مشخصات/واحد را می‌سنجد', pl.indexOf("['pcode', 'prodCd'") > -1 && pl.indexOf("targetName === sourceName") > -1);
T('کالای یافت‌نشده گم نمی‌شود → پیشنهاد ثبت با تایید (US-381-همراستا)', rq.indexOf('missing.push({ it: it, avg: avg, n: ps.length })') > -1 && rq.indexOf('به ماژول کالا اضافه شوند؟') > -1);
T('ثبت خودکار با کد یکتا + قیمت مرجع + منبع', rq.indexOf("ptfUnifiedCode('PROD')") > -1 && rq.indexOf('ثبت خودکار از جدول مقایسه قیمت (US-385)') > -1);
T('مسیر پاسخ کلی (ptfUpdateRefPrices/US-335) هم resolver دارد', rq.indexOf('ptfResolveProcurementLine(it, prods)') > -1);
T('ماتریس سود (offerlock/US-347): resolver یکتا دارد', ol.indexOf('ptfResolveProcurementLine(it, _prodsRef)') > -1);
T('تطبیق مبهم به‌جای انتخاب خودکار هشدار می‌دهد', ol.indexOf('مرجع خرید مبهم است؛ انتخاب خودکار نشد') > -1);

SECTION('بخش ۲ (رفتاری): جریان کامل قیمت تامین → کالا');
(function () {
  var mCommit = rq.match(/window\.rfqsCommitPrices = function\(no\) \{[\s\S]*?\n  \};/);
  T('rfqsCommitPrices استخراج شد', !!mCommit);
  if (!mCommit) return;
  global.faDate = function () { return '1405/04/18'; };
  global.faDateTime = function () { return '1405/04/18 12:00'; };
  global.rfqsRenderAccordion = function () {};
  global.ptfUnifiedCode = function () { return 'P-9001'; };
  eval(mCommit[0]);
  /* کالا با نام کمی متفاوت (نیم‌فاصله/فاصله) از قلم جدول */
  setData('ptf_crm_products', [
    { cd: 'P-1', nm: 'شیر توپی ۲ اینچ', pr: 0 },
    { cd: 'P-2', nm: 'دیگر', pr: 0 }
  ]);
  setData('ptf_crm_rfqsmart', [{
    no: 'PTF-RFQS-1405-001',
    items: [
      { name: 'شیر توپی ۲  اینچ', quotes: { 'SUP-1': 10000, 'SUP-2': 14000 } }, /* دو فاصله — exact شکست می‌خورد، نرمال می‌گیرد */
      { name: 'گسکت جدید', unit: 'عدد', quotes: { 'SUP-1': 500 } } /* در کالاها نیست → ثبت خودکار */
    ]
  }]);
  global._confirmAns = true;
  rfqsCommitPrices('PTF-RFQS-1405-001');
  var prods = getData('ptf_crm_products');
  var p1 = prods.filter(function (x) { return x.cd === 'P-1'; })[0];
  T('قیمت مرجع کالای موجود = میانگین 12000 (تطبیق نرمال)', p1.pr === 12000 && p1.refPriceAt === '1405/04/18');
  T('منبع قیمت درج شد', (p1.refPriceSrc || '').indexOf('جدول مقایسه') > -1);
  var pNew = prods.filter(function (x) { return x.cd === 'P-9001'; })[0];
  T('کالای یافت‌نشده با تایید کاربر ثبت شد (قیمت گم نشد)', !!pNew && pNew.nm === 'گسکت جدید' && pNew.pr === 500);
  T('مهر ثبت روی درخواست تامین', getData('ptf_crm_rfqsmart')[0].pricesCommittedAt === '1405/04/18 12:00');
  /* حالا ماتریس سود: کالای P-1 با قیمت مرجع 12000 باید با resolver یکتا پیدا شود. */
  var it = { name: 'شیر توپی ۲  اینچ', price: 15000 }; /* همان نام دوفاصله‌ای */
  var pMatch = ptfResolveProcurementLine(it, prods);
  var pRef = pMatch.ok ? pMatch.item : null;
  T('ماتریس سود: کالای مرجع با نام متفاوت-فاصله پیدا شد', !!pRef && pRef.pr === 12000);
  T('درصد سود قابل محاسبه: (15000-12000)/12000 = 25٪', pRef && Math.round((15000 - 12000) * 1000 / pRef.pr) / 10 === 25);
  /* انصراف کاربر از ثبت کالای جدید → چیزی ثبت نشود */
  setData('ptf_crm_rfqsmart', [{ no: 'X2', items: [{ name: 'قلم ناشناس دیگر', quotes: { S: 900 } }] }]);
  global._confirmAns = false;
  var before = getData('ptf_crm_products').length;
  rfqsCommitPrices('X2');
  T('انصراف از ثبت خودکار → کالای جدیدی اضافه نشد', getData('ptf_crm_products').length === before);
  global._confirmAns = true;
})();

SECTION('نسخه و کش (بدون قفل نسخه دقیق)');
T('VER الگوی v1x', /window\.PTF_CRM_RELEASE\s*=\s*'v\d+(?:\.\d+)+'/.test(idx));
T('کش sw هم‌خانواده ptf-crm-v1', /var RELEASE\s*=\s*'v\d+(?:\.\d+)+'/.test(sw));
T('cache-bust rfqsmart/offerlock (>=15.2)', ['rfqsmart.js', 'offerlock.js'].every(function (f) {
  var m = idx.match(new RegExp(f.replace(/[.-]/g, '\\$&') + '\\?v=(\\d+)\\.(\\d+)'));
  return m && (+m[1] > 15 || (+m[1] === 15 && +m[2] >= 2));
}));

DONE('tester72-v152');
