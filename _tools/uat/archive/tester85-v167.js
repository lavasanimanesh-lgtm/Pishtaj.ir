/* =====================================================================
   آرشیوشده: 2026-08-13 (ARENA-UAT-TRIAGE-2026-08-13.md — سطل ۳ / گروه FX)
   دلیل: هدف این تستر (v16.7) «سنا نمایان + یوان/حواله یوان + تبدیل دلار→یوآن»
   بود؛ به دستور صریح کارفرما (v33.4.2) منبع سنا و منابع یوان/تبدیل‌ها به‌طور
   کامل از سامانه حذف شدند (قرارداد حذف: tester177 ریشهٔ مخزن — سبز). چک فلگ
   bootstrap هم فقط شمارش تعداد رخداد بود که با تکامل sync.js تغییر کرده است.
   ===================================================================== */
/* tester85 — v16.7 (BUG-018 رفع پاک شدن دفترچه تلفن + نرخ‌ها: سنا نمایان، یوان/حواله یوان/تبدیل دلار→یوآن و طلا→یوآن) */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var sy = fs.readFileSync(path.join(BASE, 'sync.js'), 'utf-8');
var sm = fs.readFileSync(path.join(BASE, 'sms.js'), 'utf-8');
var fx = fs.readFileSync(path.join(BASE, 'fx.js'), 'utf-8');
var php = fs.readFileSync(path.resolve(__dirname, '../../api/fx-rates.php'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');

SECTION('نسخه و ثبت');
T('نسخه v16.7+', (function(){var m=idx.match(/window.PTF_CRM_RELEASE = 'v([0-9.]+)'/);return m&&parseFloat(m[1])>=16.7;})());
T('کش sw >= v16.7', (function(){var m=sw.match(/var RELEASE = 'v([0-9.]+)';/);return m&&parseFloat(m[1])>=16.7;})());
(function () {
  function vOf(f) { var m = idx.match(new RegExp(f.replace('.', '\\.') + '\\?v=([0-9.]+)')); return m ? parseFloat(m[1]) : 0; }
  T('cache-bust sync/sms/fx >= 16.7', ['sync.js', 'sms.js', 'fx.js'].every(function (f) { return vOf(f) >= 16.7; }));
})();

SECTION('BUG-018 (کد): سه‌لایه دفاع');
T('لایه ۱: smsbook (و payables) در GUARD_KEYS سپر داده‌صفر (v17.7: + opex)', sy.indexOf("'ptf_crm_smsbook', 'ptf_crm_payables'") > -1 && sy.indexOf('ptf_crm_smsbook') < sy.indexOf('GUARD_KEYS = [') + 400);
T('لایه ۲: فلگ عمومی bootstrapped برای ماژول‌ها', sy.indexOf('window._ptfSyncBootstrapped = false;') > -1 && sy.split('window._ptfSyncBootstrapped = true').length >= 4);
T('لایه ۲: rebuild خودکار sms تا pull اولیه صبر می‌کند', sm.indexOf('window._ptfSyncBootstrapped === false) return book().length;') > -1);
T('لایه ۲: منابع خالی = دست نزدن به دفترچه', sm.indexOf('if (!srcCust.length && !srcSup.length) return book().length;') > -1);
T('لایه ۳: بازیابی فقط smsbook از بک‌آپ سرور (AC3)', sm.indexOf('window.smsBookRecover') > -1 && sm.indexOf('j.data.ptf_crm_smsbook') > -1);
T('بازیابی: ادغام امن — فقط اضافه، هیچ حذفی', sm.indexOf('if (!r || !r.mob || have[r.mob]) return;') > -1 && sm.indexOf('هیچ مخاطب فعلی حذف نمی‌شود') > -1);
T('بازیابی: RBAC هم‌راستا با سرور (get_backup=users_write=admin/chairman)', sm.indexOf("_r !== 'admin' && _r !== 'chairman'") > -1);
T('بازیابی: پاسخ list_backups با کلید backups خوانده می‌شود', sm.indexOf('d && d.backups) ? d.backups') > -1);
T('دکمه بازیابی در پنل پیامک', sm.indexOf('🩹 بازیابی دفترچه از بک‌آپ سرور') > -1);

SECTION('BUG-018 (رفتاری): بازتولید سناریوی حادثه و اثبات رفع');
global.window = global;
(function () {
  /* استخراج smsBookSyncAll واقعی + normMob */
  var mN = sm.match(/function normMob\(m\) \{[\s\S]*?\n  \}/);
  var mS = sm.match(/window\.smsBookSyncAll = function \(\) \{[\s\S]*?\n    return b\.length;\n  \};/);
  T('توابع sms استخراج شدند', !!mN && !!mS);
  if (!(mN && mS)) return;
  global.book = function () { return getData('ptf_crm_smsbook'); };
  global.saveBook = function (b) { setData('ptf_crm_smsbook', b); };
  global.genCode = function (p) { return p + '-' + (++global._sq3 || (global._sq3 = 1)); };
  global.faDate = function () { return '1405/04/21'; };
  eval(mN[0].replace('function normMob', 'global.normMob = function'));
  eval(mS[0].replace('window.smsBookSyncAll', 'global.smsBookSyncAll'));

  /* دفترچه پر: ۱ دستی + ۱ auto */
  setData('ptf_crm_smsbook', [
    { cd: 'PB-M', nm: 'دستی', mob: '09121112233', cat: 'oth', src: 'manual' },
    { cd: 'PB-A', nm: 'قدیمی', mob: '09124445566', cat: 'cust', src: 'auto' }
  ]);

  /* سناریوی حادثه ①: بوت قبل از pull اولیه (فهرست‌ها هنوز خالی) — قبلا دفترچه auto پاک می‌شد */
  global.window._ptfSyncBootstrapped = false;
  setData('ptf_crm_customers', []);
  setData('ptf_crm_suppliers', []);
  smsBookSyncAll();
  T('حادثه ①: قبل از bootstrapped هیچ تغییری در دفترچه', getData('ptf_crm_smsbook').length === 2);

  /* سناریوی حادثه ②: bootstrapped ولی منابع خالی (داده هنوز نرسیده/پاک‌شده) */
  global.window._ptfSyncBootstrapped = true;
  smsBookSyncAll();
  T('حادثه ②: منابع خالی = دفترچه دست‌نخورده (رکورد auto قبلی حفظ)', getData('ptf_crm_smsbook').length === 2);

  /* حالت سالم: منابع پر → بازسازی auto + حفظ دستی */
  setData('ptf_crm_customers', [{ cd: 'CU-1', co: 'فولاد', people: [{ nm: 'رابط', mobs: [{ n: '09351234567' }] }] }]);
  setData('ptf_crm_suppliers', [{ cd: 'SUP-1', co: 'آریا', ph: '09901234567', people: [], phones: [] }]);
  var n = smsBookSyncAll();
  var b2 = getData('ptf_crm_smsbook');
  T('حالت سالم: دستی حفظ + auto از منابع بازسازی شد', b2.some(function (r) { return r.mob === '09121112233'; }) && b2.some(function (r) { return r.mob === '09351234567'; }) && b2.some(function (r) { return r.mob === '09901234567'; }));
  T('auto قدیمی (که دیگر در منابع نیست) جایگزین شد', !b2.some(function (r) { return r.mob === '09124445566'; }) && n === b2.length);
})();

(function () {
  /* سپر سینک: شبیه‌سازی منطق GUARD — smsbook خالی + سرور ناخالی → push بلاک */
  var mG = sy.match(/var GUARD_KEYS = \[[^\]]*\];/);
  T('GUARD_KEYS استخراج شد', !!mG);
  if (!mG) return;
  eval(mG[0].replace('var GUARD_KEYS', 'global.GUARD_KEYS'));
  T('smsbook و payables عضو گارد', GUARD_KEYS.indexOf('ptf_crm_smsbook') > -1 && GUARD_KEYS.indexOf('ptf_crm_payables') > -1);
  T('کلیدهای حیاتی قبلی همه سر جایشان', ['ptf_crm_customers', 'ptf_crm_rfqs', 'ptf_crm_offers', 'ptf_crm_suppliers', 'ptf_crm_products', 'ptf_crm_invoices', 'ptf_crm_deals', 'ptf_crm_projects'].every(function (k) { return GUARD_KEYS.indexOf(k) > -1; }));
})();

(function () {
  /* بازیابی: ادغام امن روی داده نمونه */
  var mR = sm.match(/function applyRecover\(best\) \{[\s\S]*?\n        \}/);
  T('applyRecover استخراج شد', !!mR);
  if (!mR) return;
  global._confirms = [];
  global.confirm = function (m) { global._confirms.push(m); return true; };
  global.alert = function (m) { global._lastAlert = String(m); };
  global.audit = function () {};
  global.addLog = function () {};
  global.renderSmsPanel = function () {};
  eval(mR[0].replace('function applyRecover', 'global.applyRecover = function'));
  setData('ptf_crm_smsbook', [{ cd: 'PB-1', nm: 'موجود', mob: '09120000001', src: 'manual' }]);
  applyRecover({ name: 'hourly-latest.json', list: [
    { cd: 'PB-1x', nm: 'موجود-تکراری', mob: '09120000001', src: 'manual' },
    { cd: 'PB-2', nm: 'پاک‌شده', mob: '09120000002', src: 'manual' },
    { cd: 'PB-3', nm: 'auto قدیمی', mob: '09120000003', src: 'auto' }
  ] });
  var b3 = getData('ptf_crm_smsbook');
  T('بازیابی: ۲ مخاطب جدید اضافه، تکراری رد، موجودی حفظ', b3.length === 3 && b3[0].nm === 'موجود');
  T('پیام تایید شمار درست را گفت', global._lastAlert.indexOf('2 مخاطب') > -1 || global._lastAlert.indexOf('۲') > -1);
})();

SECTION('نرخ‌ها (کد): سنا نمایان + یوان + تبدیل‌ها');
T('یادآوری کارفرما: سنا دوباره در نوار (خرید/فروش)', fx.indexOf("دلار سنا 🏦") > -1 && fx.indexOf("یورو سنا 🏦") > -1 && fx.indexOf('خرید / فروش') > -1);
T('یوان آزاد + حواله یوان در نوار', fx.indexOf("fxCell('یوان آزاد 🇨🇳', R.cny_free") > -1 && fx.indexOf("fxCell('حواله یوان 🧾', R.cny_hav") > -1);
T('تبدیل دلار→یوآن و طلا→ریال در نوار (v21.10: طلا به ریال)', fx.indexOf('دلار→یوآن 🔁') > -1 && fx.indexOf('طلا ۱۸ عیار (گرم) 🥇') > -1 && fx.indexOf('ریال</small>') > -1);
T('سلول بدون داده حذف می‌شود (نوار نمی‌شکند)', fx.indexOf("var usdCny = R.usd_cny\n          ? '<span") > -1 || fx.indexOf('var usdCny = R.usd_cny') > -1);
T('PHP: کلیدهای جدید KEYMAP (price_cny + geram18)', php.indexOf("'cny_free'      => 'price_cny'") > -1 && php.indexOf("'gold_18'       => 'geram18'") > -1);
T('PHP: حواله یوان — نامزدها + جستجوی الگویی fallback', php.indexOf('$CNY_HAV_CANDIDATES') > -1 && php.indexOf("preg_match('/(cny|yuan)/i', \$k)") > -1);
T('PHP: تبدیل‌ها سمت سرور (یک منبع واحد)', php.indexOf("\$out['usd_cny'] = ") > -1 && php.indexOf("\$out['gold18_cny'] = ") > -1);
T('PHP: خودکفا مانده (درس BUG-015 — بدون توابع crm.php)', php.indexOf('verify_request') === -1 && php.indexOf('role_guard') === -1);
T('PHP: اعتبارسنجی usd_free>10000 و stale-if-error پابرجا', php.indexOf("> 10000") > -1 && php.indexOf("'stale'") > -1);

SECTION('نرخ‌ها (رفتاری): منطق تبدیل PHP بازسازی‌شده در JS');
(function () {
  /* همان فرمول PHP: usd_cny = usd_free/cny_free | gold18_cny = gold_18/cny_free */
  function calc(usd, cny, gold) {
    return {
      usd_cny: (cny > 0 && usd > 0) ? Math.round(usd / cny * 10000) / 10000 : 0,
      gold18_cny: (cny > 0 && gold > 0) ? Math.round(gold / cny * 100) / 100 : 0
    };
  }
  var r = calc(130000, 18000, 12000000);
  T('دلار ۱۳۰هزار ÷ یوان ۱۸هزار = ۷.۲۲ یوآن per دلار', Math.abs(r.usd_cny - 7.2222) < 0.001);
  T('گرم طلا ۱۲م ÷ یوان ۱۸هزار = ۶۶۶.۶۷ یوآن per گرم', Math.abs(r.gold18_cny - 666.67) < 0.01);
  var rz = calc(130000, 0, 12000000);
  T('یوان صفر (منبع نداد) → تبدیل‌ها صفر، بدون تقسیم بر صفر', rz.usd_cny === 0 && rz.gold18_cny === 0);
})();

SECTION('رگرسیون');
T('نوار در بالاترین نقطه داشبورد (v16.3) پابرجا', fx.indexOf('return w + h;') > -1);
T('راهنمای تسعیر (toast سنا در دیالوگ) پابرجا', fx.indexOf("'سنا خرید '") > -1 && fx.indexOf('ptfFxPayDialog') > -1);
T('موتور سود ptfProjectProfitIRR دست‌نخورده', fx.indexOf('window.ptfProjectProfitIRR') > -1);
T('سپر: پیام بلاک push داده‌صفر موجود (US-382)', sy.indexOf('سپر داده (US-382)') > -1);
T('bootstrapped منطق v15.0 پابرجا (push ممنوع تا pull)', sy.indexOf('if (!state.bootstrapped) { schedulePush(); return; }') > -1);
T('wrap های saveCust2/saveSup2/supApprove در sms پابرجا', sm.indexOf("['saveCust2', 'saveSup2', 'supApprove']") > -1);
T('whitelist htaccess شامل fx-rates', fs.readFileSync(path.resolve(__dirname, '../../api/.htaccess'), 'utf-8').indexOf('fx-rates') > -1);

DONE('tester85-v167');
