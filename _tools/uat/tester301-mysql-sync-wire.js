/* tester301 — v33.22.0 (P1-MySQL-WIRE — سیم‌کشی مسیر سینک به MySQL همان هاست)
 * چرا: ذخیره‌سازی عمومی (load_data/save_data) از قبل به MySQL سیم بود، ولی مسیر سینکِ
 * ۵۲ کلید سنگین (data_push/data_pull — قریب همهٔ ترافیک) فقط فایل‌محور بود؛ مهاجرت ۶ مرحله‌ای
 * migrate.php (off→dual→mysql) بدون این سیم‌کشی عملاً کپی‌سازی بود.
 * قواعد:
 *  ۱) mode=off (پیش‌فرض بدون دیتابیس) → رفتار دقیقاً مثل قبل (فایل‌محور) — پخش به هر محیطی امن است
 *  ۲) dual → فایل منبع خواندن + آینهٔ MySQL (خطای DB بی‌صدا)
 *  ۳) mysql → DB منبع حقیقت خواندن (+fallback فایل) + نوشتن همزمان فایل؛ شکست DB → کل پاسخ
 *     ناموفق (needRetry) تا rev بلاتقابه بالا نرود و کلاینت resend کند
 *  ۴) اتصال/کانفیگ request-scoped کش می‌شود (بدون این، پوش ۲۰کلیدی = ۲۰ اتصال تازه)
 *  ۵) رشته‌های legacy که تسترهای قدیمی رویشان سوارند (تombstone/legacy UAT token) پابرجا
 * تست‌ها: سورس‌چک دقیق PHP (کلاینت اصلاً تغییر نکرده — پروتکل یکسان است).
 */
'use strict';
require('./harness');
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var api = fs.readFileSync(path.join(ROOT, 'api/crm.php'), 'utf-8');
var db = fs.readFileSync(path.join(ROOT, 'api/db-lib.php'), 'utf-8');
var idx = fs.readFileSync(path.join(ROOT, 'crm/index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(ROOT, 'crm/sw.js'), 'utf-8');
var cc = fs.readFileSync(path.join(ROOT, 'crm/clear-cache.html'), 'utf-8');

SECTION('crm.php: هلپرهای مسیر یکپارچه سینک');
/* v33.22.3 (P1-ATTACH-STALE-DB): قرارداد خواندن ارتقا یافت — به‌جای ptf_db_read خام،
   ptf_db_read_fresh (گارد تازگی: ردیف DB کهنه‌تر از فایل ⇒ فایل + خودترمیمی) با حفظ fallback فایل */
T('sync_key_read تعریف شده: اول ptf_db_read_fresh با گارد تازگی (خودش فقط mysql مقدار می‌دهد) سپس فایل', api.indexOf('function sync_key_read($sdir, $k) {') > -1 && api.indexOf('$v = ptf_db_read_fresh($k, $f);') > -1 && api.indexOf("return file_exists($f) ? file_get_contents($f) : null;") > -1);
T('load_data نیز از گارد تازگی استفاده می‌کند (mysql → ptf_db_read_fresh با مسیر فایل)', api.indexOf("ptf_db_read_fresh($key, \"$data_dir/$key.json\")") > -1 && api.indexOf("ptf_db_mode() === 'mysql'") > -1);
T('sync_key_write تعریف شده: فایل همیشه (بکاپ گرم) + DB در dual/mysql با ptf_db_write_rev', api.indexOf('function sync_key_write($sdir, $k, $v, $rev = 0) {') > -1 && api.indexOf("file_put_contents($sdir . '/' . $k . '.json', $v, LOCK_EX) !== false") > -1 && api.indexOf("if ($mode === 'dual' || $mode === 'mysql')") > -1 && api.indexOf('$okDb = ptf_db_write_rev($k, $v, $rev);') > -1);
T('در mode=mysql شکست DB به مسیر پوش گزارش می‌شود (نه بی‌صدا)', api.indexOf("if ($mode === 'mysql' && !$okDb) return false;") > -1);
T('هلپرها top-level‌اند (قبل از switch — داخل switch تعریف شرطی می‌شد و در caseها مرد)', api.indexOf('function sync_key_read') > -1 && api.indexOf('switch($action)') > -1 && api.indexOf('function sync_key_read') < api.indexOf('switch($action)'));

SECTION('crm.php: سیم‌کشی data_push');
T('آرشیو حذف‌شده‌ها از مسیر یکپارچه خوانده می‌شود', api.indexOf("$serverArchiveJson = sync_key_read($sdir, 'ptf_crm_deleted_archive');") > -1);
T('گارد دوبلیکت پیشنهادها (offers) از مسیر یکپارچه', api.indexOf("$serverOffersJson = sync_key_read($sdir, 'ptf_crm_offers');") > -1);
T('خواندن تعارضی از مسیر یکپارچه + legacy UAT token پابرجا', api.indexOf('$cfVal = sync_key_read($sdir, $k);') > -1 && api.indexOf('$conflictData[$k] = sync_apply_tombstones($k, $cfVal') > -1 && api.indexOf('$conflictData[$k] = file_get_contents($cf);') > -1);
T('سپر ضد داده‌صفر (zero-shield) از مسیر یکپارچه', api.indexOf('$exVal = sync_key_read($sdir, $k);') > -1 && api.indexOf('$exArr = json_decode($exVal, true);') > -1);
T('نوشتن از مسیر یکپارچه با rev جدید + خطای DB → خروج از حلقه', api.indexOf('if (!sync_key_write($sdir, $k, $v, $curRev + 1)) { $dbWriteFailed = true; break; }') > -1);
T('پاسخ ناموفق idempotent: needRetry + آزادسازی قفل meta + بدون نوشتن meta.json', api.indexOf("'needRetry' => true") > -1 && /if \(!empty\(\$dbWriteFailed\)\) \{[\s\S]{0,500}@flock\(\$metaLock, LOCK_UN\)[\s\S]{0,300}break;/.test(api) && /if \(!empty\(\$dbWriteFailed\)\) \{[\s\S]{0,800}break;\s*\}\s*\$meta\['_global'\]/.test(api));

SECTION('crm.php: سیم‌کشی data_pull');
T('مقدار کلید در حلقهٔ pull از مسیر یکپارچه (mysql → DB)', api.indexOf('$kv = sync_key_read($sdir, $k);') > -1 && api.indexOf('if ($kv === null) continue;') > -1);
T('خروجی pull با tombstone از مقدار یکپارچه (رشتهٔ legacy تستر پابرجا)', api.indexOf("$out[$k] = sync_apply_tombstones($k, $kv, $serverArchiveJson, '[]');") > -1);
T('آرشیو تنبَل در pull نیز از مسیر یکپارچه', api.indexOf("$tmpA = sync_key_read($sdir, 'ptf_crm_deleted_archive');") > -1);

SECTION('db-lib.php: اتصال/کانفیگ کش‌شده + نوشتن rev‌دار');
T('ptf_db_conn با کش استاتیک (بدون اتصال تازهٔ بی‌مورد)', db.indexOf('function ptf_db_conn()') > -1 && db.indexOf('static $c = null, $tried = false;') > -1 && db.indexOf('$tried = true;') > -1);
T('get/set از اتصال کش‌شده استفاده می‌کنند و آن را نمی‌بندند', /\$m = ptf_db_conn\(\); \/\* v33\.22\.0: اتصال کش‌شدهٔ همین درخواست \*\//.test(db) && (db.match(/\$m = ptf_db_conn\(\);/g) || []).length >= 4);
T('ptf_db_write_rev: خاموش→true (فایل پادشاه)، dual/mysql→نتیجهٔ واقعی set', db.indexOf('function ptf_db_write_rev($key, $value, $rev = 0)') > -1 && db.indexOf("if ($mode !== 'dual' && $mode !== 'mysql') return true;") > -1 && db.indexOf('return (bool) ptf_db_set($key, $value, $rev);') > -1);
T('کش کانفیگ request-scoped + تازه‌سازی پس از save (گام connect مهاجرت)', db.indexOf('$GLOBALS[\'ptf_db_config_cache\']') > -1 && db.indexOf('if ($ok) $GLOBALS[\'ptf_db_config_cache\'] = $cfg;') > -1);

SECTION('سازگاری با تسترهای legacy (رشته‌های pinned پابرجا)');
T('push tombstone', api.indexOf('$v = sync_apply_tombstones($k, $v') > -1);
T('pull tombstone + conflict + متغیرهای archive', api.indexOf('$out[$k] = sync_apply_tombstones($k') > -1 && api.indexOf('$conflictData[$k] = sync_apply_tombstones') > -1 && api.indexOf('$serverArchiveJson') > -1 && api.indexOf('$incomingArchiveJson') > -1);

SECTION('نسخه‌گذاری');
var vm = idx.match(/window\.PTF_CRM_RELEASE = '(v[\d.]+)'/);
T('بامپ نسخه همگام (خوانده‌شده از index): index.html + sw.js + clear-cache.html + نشان P1-MySQL-WIRE', !!vm && sw.indexOf("var RELEASE = '" + vm[1] + "'") > -1 && cc.indexOf(vm[1]) > -1 && api.indexOf('P1-MySQL-WIRE') > -1);

DONE('tester301-mysql-sync-wire');
