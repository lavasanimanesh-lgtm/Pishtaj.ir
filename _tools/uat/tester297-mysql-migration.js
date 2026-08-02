/* tester297 — v33.17.0 (DB-MIG-001 — فاز A): مهاجرت MySQL
 * 1) db-lib.php: کانفیگ امن، schema SQL، checksum، حالت‌ها (off/dual/mysql)، عملیات پایه
 * 2) migrate.php: مراحل ۶‌گانهٔ فارسی + تأیید کلمهٔ «مهاجرت» + بکاپ اضطراری + کلیدهای JSON
 * 3) crm.php: wrapper dual-write/read (خطای دیتابیس هرگز مسیر فایل را نمی‌شکند)
 * 4) راهنمای فارسی سی‌پنل + سند به‌روزرسانی‌شده
 */
'use strict';
require('./harness');
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var db = fs.readFileSync(path.join(ROOT, 'api/db-lib.php'), 'utf-8');
var mig = fs.readFileSync(path.join(ROOT, 'api/migrate.php'), 'utf-8');
var crm = fs.readFileSync(path.join(ROOT, 'api/crm.php'), 'utf-8');
var guide = fs.readFileSync(path.join(ROOT, 'crm/MIGRATION-MYSQL-CPANEL-GUIDE-FA.md'), 'utf-8');
var spec = fs.readFileSync(path.join(ROOT, 'crm/MIGRATION-MYSQL-SPEC-v1.md'), 'utf-8');

SECTION('db-lib: لایهٔ MySQL');
T('کانفیگ امن (فایل PHP بدون خروجی) + حالت‌ها', db.indexOf('ptf-db-config.php') > -1 && db.indexOf("$c['mode'] ?? 'off'") > -1 && db.indexOf('ptf_db_mode') > -1);
T('schema کلید-ارزش با کلید اصلی و utf8mb4', db.indexOf('CREATE TABLE IF NOT EXISTS') > -1 && db.indexOf('`k` VARCHAR(191)') > -1 && db.indexOf('utf8mb4_unicode_ci') > -1);
T('عملیات پایه: get/set/del/all/count (null-safe)', db.indexOf('function ptf_db_get') > -1 && db.indexOf('function ptf_db_set') > -1 && db.indexOf('function ptf_db_del') > -1 && db.indexOf('ON DUPLICATE KEY UPDATE') > -1);
T('checksum با SHA-256', db.indexOf("hash('sha256'") > -1);
T('dual-write هرگز مسیر فایل را نمی‌شکند (catch بی‌صدا)', db.indexOf('catch (Throwable $e) { /* بی‌صدا — JSON سالم است */ }') > -1);
T('در حالت mysql: خواندن از دیتابیس با fallback', db.indexOf("if ($mode !== 'mysql') return null;") > -1);

SECTION('migrate: اسکریپت فارسی ۶ مرحله');
T('مراحل ۱ تا ۶ موجودند', ['backup', 'schema', 'migrate', 'verify', 'enable_dual', 'switch_final'].every(function (s) { return mig.indexOf("'" + s + "'") > -1 || mig.indexOf('"' + s + '"') > -1; }));
T('تأیید با کلمهٔ «مهاجرت» در مراحل حساس', mig.indexOf("'مهاجرت'") > -1 && mig.indexOf('confirm_word') > -1);
T('بکاپ اضطراری قبل از انتقال', mig.indexOf('pre-mysql-') > -1 && mig.indexOf('mig_emergency_backup') > -1);
T('بررسی تطابق با checksum و شمارش + توقف خودکار', mig.indexOf('بررسی تطابق') > -1 && mig.indexOf('ptf_db_checksum') > -1 && mig.indexOf('مغایرت‌هایی یافت شد') > -1);
T('کلیدهای جانبی (otp/ratelimit) در فایل می‌مانند', mig.indexOf("in_array($k, ['otp', 'ratelimit']") > -1);
T('راهنمای حذف امن بعد از سوییچ', mig.indexOf('این فایل (migrate.php) را از سرور حذف کنید') > -1);

SECTION('crm.php: wrapper dual-write/read');
T('require db-lib + load_data از دیتابیس در حالت mysql', crm.indexOf("require_once __DIR__ . '/db-lib.php'") > -1 && crm.indexOf("ptf_db_mode() === 'mysql'") > -1);
T('save_data: فایل + ptf_db_write', crm.indexOf('file_put_contents($file, $json, LOCK_EX);') > -1 && crm.indexOf('ptf_db_write($key, $json);') > -1);

SECTION('گارد امنیتی پس از سوییچ (v33.17.1)');
T('migrate.php بعد از mode=mysql قفل می‌شود (فقط پیام حذف فایل)', mig.indexOf("($cfg['mode'] ?? 'off') === 'mysql'") > -1 && mig.indexOf('مهاجرت قبلاً با موفقیت کامل شده است') > -1 && mig.indexOf('فایل migrate.php → حذف') > -1);
T('گارد قبل از پردازش هر step اجرا می‌شود', mig.indexOf("if ($cfg && ($cfg['mode'] ?? 'off') === 'mysql') {") > -1 && mig.indexOf('exit;') > -1);
T('ptf-db-config.php در gitignore است (رمز دیتابیس به گیت نمی‌رود)', fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf-8').indexOf('api/ptf-db-config.php') > -1);

SECTION('مستندات فارسی');
T('راهنمای سی‌پنل فارسی: ۵ مرحله + عیب‌یابی + راهنمای کاربران', guide.indexOf('MySQL Database Wizard') > -1 && guide.indexOf('File Manager') > -1 && guide.indexOf('migrate.php') > -1 && guide.indexOf('کلمهٔ «مهاجرت»') > -1 && guide.indexOf('کاربران روی دستگاه‌های خود') > -1 && guide.indexOf('Ctrl+Shift+R') > -1);
T('سند اصلی به‌روزرسانی شد (v33.17.0 + سی‌پنل بدون ترمینال)', spec.indexOf('v33.17.0') > -1 && spec.indexOf('ترمینال/SSH') > -1);

DONE('tester297-mysql-migration');
