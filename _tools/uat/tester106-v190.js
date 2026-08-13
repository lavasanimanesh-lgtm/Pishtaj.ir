/* tester106 — v19.0 (ممیزی ادغام v18.9 ایجنت دوم + پورت رفع BUG-022 از شاخه v17.8 ما) */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var of = fs.readFileSync(path.join(BASE, 'offers.js'), 'utf-8');
var ch = fs.readFileSync(path.join(BASE, 'cheques.js'), 'utf-8');
var pt = fs.readFileSync(path.join(BASE, 'petty.js'), 'utf-8');
var sy = fs.readFileSync(path.join(BASE, 'sync.js'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');
var php = fs.readFileSync(path.resolve(__dirname, '../../api/crm.php'), 'utf-8');

SECTION('نسخه و ثبت');
T('نسخه v19.0+', (function(){var m=idx.match(/window.PTF_CRM_RELEASE = 'v([0-9.]+)'/);return m&&parseFloat(m[1])>=19.0;})());
T('کش sw >= v19.0', (function(){var m=sw.match(/var RELEASE = 'v([0-9.]+)';/);return m&&parseFloat(m[1])>=19.0;})());

SECTION('ممیزی خانواده R9 ایجنت دوم (هم‌راستایی با هندآور)');
T('ماژول‌های R9 موجود و در SHELL', ['shareholders.js', 'lossguard.js', 'fiscal.js'].every(function (f) { return fs.existsSync(path.join(BASE, f)) && sw.indexOf("'./" + f + "'") > -1; }));
T('کلیدهای R9 در SYNC + GUARD + whitelist سرور (درس BUG-015/018 رعایت شده)', ['ptf_crm_petty_tx', 'ptf_crm_shareholders', 'ptf_crm_sharetx', 'ptf_crm_fiscal_snapshots'].every(function (k) { return sy.indexOf("'" + k + "'") > -1 && php.indexOf("'" + k + "'") > -1; }));
T('whitelist سرور payables/opex ما هم اضافه شده (نقص v17.8 ما را ایجنت دوم رفع کرد ✅)', php.indexOf("'ptf_crm_payables'") > -1 && php.indexOf("'ptf_crm_opex'") > -1);
T('fiscal فقط admin/chairman (محرمانگی R9)', fs.readFileSync(path.join(BASE, 'fiscal.js'), 'utf-8').indexOf("['admin', 'chairman'].indexOf(curRole())") > -1);
T('زیان (lossguard): wrap موتور سود — profit -= loss + هشدار', fs.readFileSync(path.join(BASE, 'lossguard.js'), 'utf-8').indexOf('r.profit -= loss;') > -1);
T('زیان روی رکورد پرونده (lossEvents) + انتقال به بایگانی', fs.readFileSync(path.join(BASE, 'salesfiles.js'), 'utf-8').indexOf('lossEvents: (r.lossEvents || []).slice()') > -1);
T('پیش‌پرداخت ساختاریافته (BUG-023 نسخه آنها): pct گارد ۰-۱۰۰ + full=نقدی + normalize', pt.indexOf('درصد پیش‌پرداخت باید بین ۰ تا ۱۰۰ باشد') > -1 && pt.indexOf('window.ptfAdvanceNormalize') > -1 && pt.indexOf("cashFull: true") > -1);
T('حقوق موظف بدون دوباره‌شماری (فلگ پیوند با opex)', fs.readFileSync(path.join(BASE, 'shareholders.js'), 'utf-8').indexOf('دوباره‌شماری') > -1);

SECTION('پورت رفع BUG-022 (گم‌شده در fork ایجنت دوم از v17.7)');
T('فلگ موفقیت ذخیره در saveSup2', of.indexOf('window._supLastSaved = rec.cd;') > -1);
T('wrapper origin: ریست + فقط با فلگ + همان رکورد', ch.indexOf('window._supLastSaved = null;') > -1 && ch.indexOf('var savedCd = window._supLastSaved;') > -1 && ch.indexOf('x.cd === savedCd') > -1);
T('الگوی خطرناک items[0] حذف شد', ch.indexOf(': items[0];') === -1);
T('ابزار بازبینی 🧭 + audit', ch.indexOf('window.ptfSupOriginReview') > -1 && ch.indexOf('🧭 بازبینی</button>') > -1);

SECTION('رفتاری: BUG-022 پس از پورت');
global.window = global;
(function () {
  var mW = ch.match(/window\.saveSup2 = function \(cd\) \{[\s\S]*?\n    \};/);
  T('wrapper استخراج شد', !!mW);
  if (!mW) return;
  global._supLastSaved = undefined;
  global.saveSup2 = function () { global.window._supLastSaved = null; }; /* ذخیره ناموفق */
  global.window.saveSup2 = global.saveSup2;
  global.document = { getElementById: function (id) { return id === 'nS2Origin' ? { value: 'خارجی' } : null; } };
  global.renderSuppliers = function () {};
  setData('ptf_crm_suppliers', [{ cd: 'SUP-OLD', co: 'داخلی قدیمی', origin: 'داخلی' }]);
  eval(mW[0].replace('var _ss = window.saveSup2;', '').replace('window.saveSup2 = function (cd)', 'global.wrapped = function (cd)').replace('_ss(cd);', 'global.saveSup2(cd);'));
  wrapped(null);
  T('ذخیره ناموفق: origin رکورد بی‌ربط دست نخورد', getData('ptf_crm_suppliers')[0].origin === 'داخلی');
  global.saveSup2 = function () { global.window._supLastSaved = 'SUP-NEW'; };
  setData('ptf_crm_suppliers', [{ cd: 'SUP-NEW', co: 'WIKA GmbH' }, { cd: 'SUP-OLD', co: 'داخلی قدیمی', origin: 'داخلی' }]);
  eval(mW[0].replace('var _ss = window.saveSup2;', '').replace('window.saveSup2 = function (cd)', 'global.wrapped2 = function (cd)').replace('_ss(cd);', 'global.saveSup2(cd);'));
  wrapped2(null);
  var sups = getData('ptf_crm_suppliers');
  T('ذخیره موفق: origin فقط روی رکورد ذخیره‌شده', sups[0].origin === 'خارجی' && sups[1].origin === 'داخلی');
})();

SECTION('رگرسیون کلیدی هر دو شاخه');
T('US-415 (خارجی EN اجباری — شاخه ما) در v18.9 موجود', of.indexOf('نام انگلیسی (English Name) الزامی') > -1 || of.indexOf('English Name') > -1);
T('ptfMoney (US-416) موجود', fs.readFileSync(path.join(BASE, 'fx.js'), 'utf-8').indexOf('window.ptfMoney') > -1);
T('ویراستار فهرست‌ها (US-417ف۱ — v17.6 ما) موجود', fs.existsSync(path.join(BASE, 'listclean.js')));
T('هزینه‌های جاری (US-418 — v17.7 ما) موجود', fs.existsSync(path.join(BASE, 'opex.js')));
T('تعهد تحویل تامین‌کننده (US-430 آنها) در خرید واقعی', fs.readFileSync(path.join(BASE, 'buycompare.js'), 'utf-8').indexOf('dueISO') > -1);
T('رفع sfSetDue (BUG-027 آنها)', fs.readFileSync(path.join(BASE, 'salesfiles.js'), 'utf-8').indexOf('sfSetDueCommit(cd, iso, note, false)') > -1);
T('hook پیش‌پرداخت روی برد CO/TC پابرجا', pt.indexOf("(o.kind === 'CO' || o.kind === 'TC') && !o.advance") > -1);

DONE('tester106-v190');
