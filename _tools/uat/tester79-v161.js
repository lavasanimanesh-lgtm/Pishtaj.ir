/* tester79 — v16.1 (US-391: نرخ لحظه‌ای ارز — دلار/یورو آزاد و سنا روی داشبورد) */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var fx = fs.readFileSync(path.join(BASE, 'fx.js'), 'utf-8');
var php = fs.readFileSync(path.resolve(__dirname, '../../api/fx-rates.php'), 'utf-8');
var ht = fs.readFileSync(path.resolve(__dirname, '../../api/.htaccess'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');

SECTION('سرور: پروکسی نرخ ارز (fx-rates.php)');
T('فایل پروکسی موجود و در htaccess مجاز', php.length > 500 && ht.indexOf('fx-rates') > -1);
T('کش سروری ۱۰ دقیقه‌ای (فشار صفر روی منبع)', php.indexOf('$TTL = 600;') > -1 && php.indexOf("cache'] = 'fresh'") > -1);
T('زنجیره fallback چند آینه TGJU', (php.match(/tgju\.org\/ajax\.json/g) || []).length >= 4);
T('هر ۶ نرخ خواسته‌شده: دلار/یورو × آزاد/سنا(خرید/فروش)', ['price_dollar_rl', 'price_eur', 'sana_buy_usd', 'sana_sell_usd', 'sana_buy_eur', 'sana_sell_eur'].every(function (k) { return php.indexOf(k) > -1; }));
T('v19.6 BUG-030: واحد سراسری ریال — بدون تقسیم بر ۱۰ + کش تومانی نامعتبر', php.indexOf('fx_num_rial') > -1 && php.indexOf('$n / 10') === -1 && php.indexOf("'unit' => 'rial'") > -1 && php.indexOf("!== 'rial')") > -1);
T('اعتبارسنجی داده (دلار > ۱۰هزار تومان)', php.indexOf("['usd_free'] ?? 0) > 10000") > -1);
T('stale-if-error: قطعی منبع → آخرین کش با برچسب قدیمی', php.indexOf("cache'] = 'stale'") > -1 && php.indexOf('staleMin') > -1);
T('خودکفا — درس BUG-015 (بدون توابع crm.php)', php.indexOf('clean(') === -1 && php.indexOf('verify_request(') === -1);
T('کش در مسیر امن crm/data (Deny from all)', php.indexOf("/../crm/data") > -1 && php.indexOf('fx-cache.json') > -1);

SECTION('کلاینت: ویجت داشبورد');
T('ویجت fxTicker + hook داشبورد با گارد', fx.indexOf("id=\"fxTicker\"") > -1 && fx.indexOf('_fxDashHooked') > -1);
/* v16.3 (ابلاغ کارفرما): نوار ارز به بالاترین نقطه داشبورد منتقل شد */
T('نوار ارز در بالاترین نقطه داشبورد', fx.indexOf('return w + h; /* v16.3') > -1);
T('بروزرسانی خودکار هر ۱۰ دقیقه', fx.indexOf('_fxTickerT = setInterval') > -1 && fx.indexOf('600000') > -1);
/* v16.3: نوار فقط دلار/یورو آزاد — نرخ‌های سنا همچنان دریافت و در راهنمای تسعیر (toast دیالوگ) مصرف می‌شوند */
T('نوار: فقط دلار و یورو آزاد', fx.indexOf('دلار آزاد 🇺🇸') > -1 && fx.indexOf('یورو آزاد 🇪🇺') > -1 && fx.indexOf('دلار سنا (خرید)') === -1);
T('نرخ‌های سنا در راهنمای تسعیر حفظ شد', fx.indexOf('سنا خرید ') > -1 && fx.indexOf('R.usd_sana_buy') > -1);
T('برچسب «قدیمی» برای کش کهنه', fx.indexOf('⏳ قدیمی (') > -1);
T('قطعی/آفلاین → پیام نرم؛ داشبورد نمی‌شکند', fx.indexOf('بعدا خودکار تلاش می‌شود') > -1 && fx.indexOf('🔴 آفلاین') > -1);
T('سلب مسئولیت: مبنای اسناد = نرخ تاییدی کاربر', fx.indexOf('مبنای اسناد: نرخ تاییدی شما') > -1);
T('دیالوگ تسعیر: نرخ زنده به‌عنوان راهنما (toast — نه جایگزین تصمیم کاربر)', fx.indexOf('نرخ‌های لحظه‌ای \' + cur') > -1 && fx.indexOf('_fxDlgOrig(kind, refNo, cur, cb)') > -1);
T('data-noix روی ویجت (iconx ایموجی‌ها را نمی‌شکند)', fx.indexOf('id="fxTicker" data-noix') > -1);

SECTION('رفتار اجرایی: رندر سلول‌ها و تحمل خطا');
(function () {
  var m = fx.match(/function fxCell\(lb, v, cl\) \{[\s\S]*?\n  \}/);
  T('fxCell استخراج شد', !!m);
  if (!m) return;
  eval(m[0]);
  var h = fxCell('دلار آزاد', 106500, '#059669');
  T('سلول نرخ: عدد فارسی + ریال', h.indexOf('دلار آزاد') > -1 && h.indexOf('ریال</small>') > -1);
  T('نرخ صفر/ناموجود → سلول رندر نمی‌شود (بدون NaN)', fxCell('x', 0) === '' && fxCell('x', null) === '');
})();

SECTION('نسخه و کش (بدون قفل نسخه دقیق)');
T('VER الگوی v1x', /window\.PTF_CRM_RELEASE\s*=\s*'v\d+(?:\.\d+)+'/.test(idx));
T('کش sw هم‌خانواده ptf-crm-v1', /var RELEASE\s*=\s*'v\d+(?:\.\d+)+'/.test(sw));
T('cache-bust fx.js (>=16.1)', (function () { var m2 = idx.match(/fx\.js\?v=(\d+)\.(\d+)/); return m2 && (+m2[1] > 16 || (+m2[1] === 16 && +m2[2] >= 1)); })());

DONE('tester79-v161');
