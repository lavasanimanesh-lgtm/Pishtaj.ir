/* tester304 — v33.22.3 (P1-ATTACH-STALE-DB — ریشه‌کن رخداد «ناپدید شدن ضمایم/رکوردهای تازه پس از سوییچ MySQL»)
 * چرا (رخداد تولید ۲۰۲۶-۰۸-۰۳): پس از سوییچ به mode=mysql، خواندن مسیر سینک از DB انجام می‌شد ولی
 * ردیف‌های DB کهنه بودند (ماندهٔ مهاجرت قبلی/انتقال ناقص — چون گام سوییچ هیچ اجباری به تطابق نداشت
 * و «بررسی تطابق» به‌خاطر کلیدهای فرّار meta/tokens روی سامانهٔ زنده همیشه یک مغایرت نشان می‌داد).
 * نتیجه: رکوردها به حالت چندروزِ قبل برگشتند و «ارجاع» ضمایم جدید ({key,name} داخل رکوردها) وجود
 * نداشت → هیچ ضمیمه‌ای در هیچ ماژولی نمایش/باز نمی‌شد. فایل‌ها (بکاپ گرمِ همیشه‌نوشته) تازه بودند.
 * ریشه‌کن سه‌لایه:
 *  ۱) گارد تازگی لحظه‌ای db-lib.ptf_db_read_fresh: قرارداد «فایل اول، سپس DB» یعنی mtime فایل >
 *     updated_at+۳ ثانیه ⇒ ردیف یقیناً کهنه است ⇒ فایل سرو + خودترمیمی همان لحظه (خواندن هرگز
 *     از فایل عقب‌تر نمی‌ماند — حتی با مهاجرت اشتباه در آینده). load_data و sync_key_read به آن وصل‌اند.
 *  ۲) ویزارد: سوییچ نهایی بدون تطابق کامل درون‌خط (چک‌سام+تعداد، تمام کلیدهای داده) «مسدود» می‌شود؛
 *     کلیدهای فرّارِ عمداً فایل‌محور (meta/tokens) از مقایسه مستثنا (mig_compare_excluded)؛ انتقال
 *     داده دسته‌ای/خودکار (BATCH=15 + ادامهٔ خودکار) تا تایم‌اوت هاست هرگز انتقال را نیمه‌کاره پنهان نکند.
 *  ۳) تشخیص: data-health-check بخش ۱۱ دارد (تطابق واقعی فایل↔DB) — سبزِ فایل‌محور دیگر فریب نمی‌دهد.
 * v33.22.4 (UR-2026-08-03-31 — ریشه‌کن «مغایرت کاذب fx-cache در health-check بخش ۱۱»):
 * fx-cache کش ۱۰‌دقیقه‌ای نرخ ارز است (api/fx-rates.php → crm/data/fx-cache.json) که فقط و مستقیم
 * در فایل بازنویسی می‌شود؛ نه نوشتن DB دارد و نه هیچ خوانندهٔ DB‌ای → هر تازه‌سازی نرخ = یک مغایرت
 * کاذب در بخش ۱۱ و مرحلهٔ ۴ ویزارد (همان کلاس meta/tokens). رفع = افزودن به فهرست استثنای مقایسه‌ها
 * (mig_compare_excluded + استثنای بخش ۱۱) — بدون تغییر کلاینت/رفتار mode. خطا صرفاً مانیتورینگ بود؛
 * ۵۳ کلید دیگر ✅ و داده سالم است.
 * تست‌ها: سورس‌چک دقیق PHP (اجرای واقعی نیازمند PHP/MySQL سرور است).
 */
'use strict';
require('./harness');
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var db  = fs.readFileSync(path.join(ROOT, 'api/db-lib.php'), 'utf-8');
var api = fs.readFileSync(path.join(ROOT, 'api/crm.php'), 'utf-8');
var mig = fs.readFileSync(path.join(ROOT, 'api/migrate.php'), 'utf-8');
var hc  = fs.readFileSync(path.join(ROOT, 'api/data-health-check.php'), 'utf-8');

SECTION('لایهٔ ۱ — گارد تازگی db-lib (ptf_db_read_fresh)');
var iFresh = db.indexOf('function ptf_db_read_fresh($key, $filePath = null)');
T('تابع گارد تازگی تعریف شده و فقط در mode=mysql مقدار می‌دهد',
  iFresh > -1 && db.indexOf("if ($mode !== 'mysql') return null;", iFresh) > iFresh);
T('updated_at ردیف به‌صورت epoch خوانده و با mtime فایل (با حاشیهٔ ۳ ثانیه) مقایسه می‌شود',
  db.indexOf('UNIX_TIMESTAMP(updated_at)') > -1 && db.indexOf('@filemtime($filePath)') > -1 &&
  db.indexOf('(int)$fmt > (int)$uts + 3') > -1);
T('خودترمیمی: مقدار تازهٔ فایل همان لحظه به DB بازنویسی (idempotent) و سرو می‌شود',
  iFresh > -1 && db.indexOf('ptf_db_set($key, $fv);', iFresh) > iFresh && db.indexOf('return $fv;', iFresh) > iFresh);
T('قرارداد «فایل اول، سپس DB» در مسیر نوشتن پابرجاست (file_put_contents قبل از ptf_db_write_rev)',
  api.indexOf('$okFile = file_put_contents($sdir .') > -1 && api.indexOf('$okDb = ptf_db_write_rev($k, $v, $rev);') > -1 &&
  api.indexOf('$okFile = file_put_contents($sdir .') < api.indexOf('$okDb = ptf_db_write_rev($k, $v, $rev);'));
T('مسیرهای خواندن (load_data + sync_key_read) به گارد تازگی متصل‌اند و fallback فایل حفظ شده',
  api.indexOf('ptf_db_read_fresh($key, "$data_dir/$key.json")') > -1 &&
  api.indexOf('$v = ptf_db_read_fresh($k, $f);') > -1 &&
  api.indexOf('return file_exists($f) ? file_get_contents($f) : null;') > -1);

SECTION('لایهٔ ۲ — ویزارد: سوییچ فقط با تطابق کامل + کلیدهای فرّار مستثنا');
T('کلیدهای فرّارِ عمداً فایل‌محور (meta/tokens/fx-cache) از مقایسه مستثنا‌شده‌اند',
  mig.indexOf('function mig_compare_excluded()') > -1 && mig.indexOf("return ['meta', 'tokens', 'fx-cache'];") > -1);
var iSw = mig.indexOf("$step === 'switch_go'");
var iMism = mig.indexOf('سوییچ انجام نشد', iSw);
var iModeSet = mig.indexOf("$c['mode'] = 'mysql';", iSw);
T('گام سوییچ: مقایسهٔ درون‌خط همهٔ کلیدها قبل از نوشتن mode=mysql اجرا می‌شود',
  iSw > -1 && iMism > iSw && iModeSet > iSw && iMism < iModeSet &&
  mig.indexOf('foreach (mig_keys() as $item)', iSw) > iSw && mig.indexOf('mig_compare_row($item)', iSw) > iSw);
T('در صورت مغایرت: سوییچ انجام نمی‌شود + فهرست مغایرت‌ها + راهنمای ترمیم (مرحلهٔ ۳)',
  iMism > -1 && mig.indexOf('page_footer(); exit;', iMism) > iMism && mig.indexOf('pre_switch_verified_at', iSw) > iSw);

SECTION('لایهٔ ۲ — ویزارد: انتقال دسته‌ای ضد تایم‌اوت');
var iMg = mig.indexOf("$step === 'migrate_go'");
T('انتقال دسته‌ای (offset + BATCH=15) با افزایش سقف زمان و حمل فهرست ناموفق‌ها بین دسته‌ها',
  iMg > -1 && mig.indexOf("@set_time_limit(120);", iMg) > iMg && mig.indexOf('$_POST[\'offset\']', iMg) > iMg &&
  mig.indexOf('$BATCH = 15;', iMg) > iMg && mig.indexOf('name="fails"', iMg) > iMg);
T('ادامهٔ خودکار دستهٔ بعد (فرم migNext + auto-submit) تا هیچ انتقالی نیمه‌کاره پنهان نماند',
  mig.indexOf('id="migNext"', iMg) > iMg && /setTimeout\(function\(\)\{var f=document\.getElementById\("migNext"\)/.test(mig) &&
  mig.indexOf('پیشرفت:', iMg) > iMg);

SECTION('لایهٔ ۳ — تشخیص: بخش ۱۱ health-check (تطابق واقعی فایل↔DB)');
T('بخش ۱۱ با نمایش mode + مقایسهٔ چک‌سام هرکلید + استثنای meta/tokens/fx-cache موجود است',
  hc.indexOf('تطابق فایل ↔ دیتابیس') > -1 && hc.indexOf('حالت دیتابیس (mode)') > -1 &&
  hc.indexOf("['otp', 'ratelimit', 'meta', 'tokens', 'fx-cache']") > -1 && hc.indexOf('ptf_db_get($_k)') > -1);
T('در mode=mysql مغایرت = خطا و در dual = هشدار + نسخهٔ ابزار به‌روز است',
  /count\(\$_mism\) \? \(\$_mode === 'mysql' \? 'fail' : 'warn'\) : 'ok'/.test(hc) && hc.indexOf('نسخه ابزار: v33.22.4') > -1);

SECTION('v33.22.4 — ریشه‌کن مغایرت کاذب fx-cache (UR-2026-08-03-31)');
var fxr = fs.readFileSync(path.join(ROOT, 'api/fx-rates.php'), 'utf-8');
T('ریشهٔ مغایرت کاذب: fx-cache کش ۱۰‌دقیقه‌ایِ فایل‌محور است و fx-rates.php هیچ تماس DB‌ای ندارد (نه خوانندهٔ DB، نه نویسندهٔ DB)',
  fxr.indexOf("$TTL = 600;") > -1 && fxr.indexOf("'/fx-cache.json'") > -1 &&
  fxr.indexOf('file_put_contents($cache_file') > -1 &&
  fxr.indexOf('ptf_db_') === -1 && fxr.indexOf('db-lib') === -1);

DONE('tester304-p1-attach-stale-db');
