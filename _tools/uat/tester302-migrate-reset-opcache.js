/* tester302 — v33.22.1 (بازنشانی خودسرویس ویزارد + خواندن کانفیگ بدون اثر OPcache)
 * چرا: روی هاست اشتراکی، ptf-db-config.php یک اسکریپت PHP است و خروجی require آن در OPcache
 * کش می‌شود؛ ویرایش دستی mode در سی‌پنل تا انقضای کش (یا با validate_timestamps=0 هرگز) در
 * migrate.php دیده نمی‌شد و ویزارد روی پیام «مهاجرت کامل شده» قفل می‌ماند. کارفرما دقیقاً
 * همین را گزارش کرد («عبارت را تغییر دادم ولی صفحه کماکان همان است»).
 * قواعد:
 *  ۱) ptf_db_config قبل از require، کش OPcache/stat فایل کانفیگ را باطل کند (خواندن همیشه از دیسک)
 *  ۲) ptf_db_save_config بعد از نوشتن، OPcache را باطل کند (اثر فوری در درخواست‌های بعدی)
 *  ۳) migrate.php گام reset_mode داشته باشد و آن را «قبل» از گارد mode=mysql بررسی کند
 *     (وگرنه در همان حالتی که بازنشانی لازم است، قفل اجازهٔ عبور نمی‌دهد)
 *  ۴) بازنشانی فقط در وضعیت mysql، با mig_token و تایپ کلمهٔ «بازنشانی»؛ فقط mode عوض شود
 *     (بقیهٔ کلیدهای کانفیگ — نام/رمز دیتابیس — دست‌نخورده)؛ هیچ داده‌ای پاک نشود
 *  ۵) صفحهٔ قفل، همان فرم بازنشانی + تشخیص‌گر وضعیت (mode خوانده‌شده + mtime فایل) را نشان دهد
 * تست‌ها: سورس‌چک دقیق PHP (اجرای واقعی نیازمند PHP/OPcache سرور است).
 */
'use strict';
require('./harness');
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var mig = fs.readFileSync(path.join(ROOT, 'api/migrate.php'), 'utf-8');
var db = fs.readFileSync(path.join(ROOT, 'api/db-lib.php'), 'utf-8');

SECTION('db-lib: خواندن کانفیگ بدون اثر OPcache');
var iCfg = db.indexOf('function ptf_db_config()');
var iReq = db.indexOf('$c = require $p;', iCfg);
T('قبل از require کانفیگ، clearstatcache + opcache_invalidate صدا زده می‌شود',
  iCfg > -1 && iReq > iCfg &&
  db.indexOf('@clearstatcache(true, $p);', iCfg) > -1 && db.indexOf('@clearstatcache(true, $p);', iCfg) < iReq &&
  db.indexOf("if (function_exists('opcache_invalidate')) { @opcache_invalidate($p, true); }", iCfg) > -1 &&
  db.indexOf("if (function_exists('opcache_invalidate')) { @opcache_invalidate($p, true); }", iCfg) < iReq);
T('باطل‌سازی با function_exists محافظت شده است (هاست‌های بدون OPcache بی‌صدا)', /function_exists\('opcache_invalidate'\)/.test(db));

SECTION('db-lib: نوشتن کانفیگ با اثر فوری');
var iSave = db.indexOf('function ptf_db_save_config(array $cfg)');
T('پس از ذخیرهٔ موفق کانفیگ، کش request + OPcache هر دو تازه/باطل می‌شوند',
  iSave > -1 &&
  db.indexOf("if ($ok) $GLOBALS['ptf_db_config_cache'] = $cfg;", iSave) > -1 &&
  (db.match(/@opcache_invalidate\(\$p, true\);/g) || []).length >= 2);

SECTION('migrate.php: گام reset_mode قبل از گارد');
var iReset = mig.indexOf("$step === 'reset_mode'");
var iGuard = mig.indexOf("if ($cfg && ($cfg['mode'] ?? 'off') === 'mysql') {");
T('بلوک reset_mode تعریف و قبل از گارد mode=mysql بررسی می‌شود', iReset > -1 && iGuard > -1 && iReset < iGuard);
T('بازنشانی فقط در وضعیت mysql معنا دارد (در غیر این صورت خطا و خروج)', /if \(!\$cfg \|\| \(\$cfg\['mode'\] \?\? 'off'\) !== 'mysql'\) \{ echo fa_err\('بازنشانی فقط وقتی معنا دارد/.test(mig));
T('بازنشانی با require_token + تایپ دقیق کلمهٔ «بازنشانی» محافظت می‌شود',
  iReset > -1 && mig.indexOf('require_token();', iReset) > iReset &&
  mig.indexOf("!== 'بازنشانی'", iReset) > iReset);
T('فقط mode به off تغییر می‌کند و بقیهٔ کانفیگ (نام/رمز DB) دست‌نخورده می‌ماند',
  mig.indexOf("$cfg['mode'] = 'off';", iReset) > iReset &&
  mig.indexOf("$cfg['reset_at'] = date('Y-m-d H:i:s');", iReset) > iReset &&
  mig.indexOf('ptf_db_save_config($cfg)', iReset) > iReset);

SECTION('migrate.php: صفحهٔ قفل خودسرویس + تشخیص‌گر');
var iGuardEnd = mig.indexOf('page_footer();', iGuard);
T('فرم بازنشانی (step=reset_mode + mig_token + confirm_word) همان‌جا رندر می‌شود',
  iGuard > -1 && iGuardEnd > iGuard &&
  mig.indexOf('name="step" value="reset_mode"', iGuard) > iGuard && mig.indexOf('name="step" value="reset_mode"', iGuard) < iGuardEnd &&
  mig.indexOf('name="mig_token"', iGuard) > iGuard && mig.indexOf('name="mig_token"', iGuard) < iGuardEnd &&
  mig.indexOf('name="confirm_word" placeholder="بازنشانی"', iGuard) > -1);
T('تشخیص‌گر وضعیت: mode خوانده‌شده + آخرین تغییر فایل کانفیگ (filemtime + clearstatcache) نمایش داده می‌شود',
  mig.indexOf('وضعیت خوانده‌شده از کانفیگ', iGuard) > iGuard &&
  mig.indexOf('@filemtime($__cp)', iGuard) > iGuard &&
  mig.indexOf('@clearstatcache(true, $__cp);', iGuard) > iGuard);
T('راهنمای ادامهٔ مراحل پس از بازنشانی نشان داده می‌شود', mig.indexOf('مراحل ۱ تا ۶ را به همان ترتیب اجرا کنید', iReset) > iReset);

DONE('tester302-migrate-reset-opcache');
