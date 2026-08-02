<?php
/**
 * PTF CRM — db-lib.php — DB-MIG-001 (فاز A) — v33.17.0
 * لایهٔ دسترسی MySQL برای مهاجرت از فایل‌های JSON به دیتابیس.
 *
 * اصول امنیتی:
 *  - کانفیگ (رمز دیتابیس) فقط در api/ptf-db-config.php (PHP خالص — بدون خروجی) نگهداری می‌شود.
 *  - در حالت «dual» (دورهٔ مهاجرت): نوشتن هم در MySQL و هم در JSON انجام می‌شود؛
 *    اگر MySQL خطا بدهد، مسیر JSON سالم می‌ماند (هرگز عملیات کاربر نمی‌شکند).
 *  - در حالت «mysql» (پس از سوییچ نهایی): خواندن منبع حقیقت از MySQL با fallback به JSON.
 *  - فایل‌های JSON هرگز حذف نمی‌شوند (تا پایان فاز B و بازهٔ انتظار).
 */

if (defined('PTF_DB_LIB_LOADED')) return;
define('PTF_DB_LIB_LOADED', true);

/* ---------- کانفیگ ---------- */
function ptf_db_config_path() { return __DIR__ . '/ptf-db-config.php'; }
function ptf_db_config() {
    /* v33.22.0: کش request-scoped (پیش‌تر هر فراخوانی فایل را می‌خواند؛ با سیم‌کشی مسیر سینک
       ده‌ها فراخوانی در یک درخواست رخ می‌دهد). migrate.php پس از save این کش را تازه می‌کند. */
    if (array_key_exists('ptf_db_config_cache', $GLOBALS)) return $GLOBALS['ptf_db_config_cache'];
    $p = ptf_db_config_path();
    /* v33.22.1: فایل کانفیگ PHP است و خروجی require توسط OPcache سرور کش می‌شود — روی هاست
       اشتراکی، ویرایش دستی mode در سی‌پنل (حتی با وجود فایل جدید روی دیسک) تا انقضای کش یا
       همیشه (validate_timestamps=0) دیده نمی‌شد و ویزارد قفل باقی می‌ماند. قبل از require،
       کش OPcache همان فایل را باطل می‌کنیم تا همیشه نسخهٔ دیسک خوانده شود. */
    @clearstatcache(true, $p);
    if (function_exists('opcache_invalidate')) { @opcache_invalidate($p, true); }
    $cache = null;
    if (file_exists($p)) {
        try {
            $c = require $p;
            $cache = (is_array($c) && !empty($c['db_name'])) ? $c : null;
        } catch (Throwable $e) { $cache = null; }
    }
    $GLOBALS['ptf_db_config_cache'] = $cache;
    return $cache;
}
/* ذخیرهٔ کانفیگ (فقط از migrate.php صدا زده می‌شود) */
function ptf_db_save_config(array $cfg) {
    $p = ptf_db_config_path();
    $code = "<?php\n/**\n * PTF CRM — کانفیگ اتصال دیتابیس (تولیدشده توسط migrate.php)\n * توجه: این فایل رمز دیتابیس را دارد؛ هرگز در گیت/چت/بک‌آپ عمومی قرار نگیرد.\n */\nreturn " . var_export($cfg, true) . ";\n";
    $ok = @file_put_contents($p, $code, LOCK_EX) !== false;
    if ($ok) $GLOBALS['ptf_db_config_cache'] = $cfg; /* v33.22.0: کش همان درخواست تازه شود (گام connect) */
    if ($ok) { /* v33.22.1: باطل‌سازی OPcache تا require بعدی (درخواست‌های آینده) نسخهٔ دیسک را بخواند */
        @clearstatcache(true, $p);
        if (function_exists('opcache_invalidate')) { @opcache_invalidate($p, true); }
    }
    return $ok;
}
function ptf_db_mode() {
    $c = ptf_db_config();
    return $c ? ($c['mode'] ?? 'off') : 'off';
}

/* ---------- اتصال ---------- */
function ptf_db_connect() {
    $c = ptf_db_config();
    if (!$c) return null;
    if (!function_exists('mysqli_connect')) return null;
    $host = $c['db_host'] ?? 'localhost';
    $port = !empty($c['db_port']) ? (int)$c['db_port'] : 3306;
    $m = @mysqli_connect($host, $c['db_user'] ?? '', $c['db_pass'] ?? '', $c['db_name'] ?? '', $port);
    if (!$m) return null;
    @mysqli_set_charset($m, 'utf8mb4');
    return $m;
}
function ptf_db_ok() {
    $m = ptf_db_connect();
    if (!$m) return false;
    mysqli_close($m);
    return true;
}

/* ---------- اتصال request-scoped (v33.22.0 — P1-MySQL-WIRE) ----------
   بدون این، مسیر سینک به‌ازای هر کلید یک اتصال تازه می‌گشود (پوش دسته‌ای ۲۰ کلیدی = ۲۰ اتصال).
   اتصال کش‌شده در همان درخواست PHP زنده و در پایان درخواست خودکار بسته می‌شود. */
function ptf_db_conn() {
    static $c = null, $tried = false;
    if ($c) return $c;
    if ($tried) return null;
    $tried = true;
    $c = ptf_db_connect();
    return $c;
}

/* ---------- schema (کلید-ارزش با متادیتا) ---------- */
function ptf_db_table() {
    $c = ptf_db_config();
    $t = $c['db_table'] ?? 'ptf_kv';
    return preg_replace('/[^A-Za-z0-9_]/', '', $t) ?: 'ptf_kv';
}
function ptf_db_schema_sql() {
    $t = ptf_db_table();
    return "CREATE TABLE IF NOT EXISTS `$t` (
        `k` VARCHAR(191) NOT NULL,
        `v` LONGTEXT NOT NULL,
        `rev` BIGINT NOT NULL DEFAULT 0,
        `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (`k`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
}

/* ---------- عملیات پایه (همهٔ خروجی‌ها null-safe) ---------- */
function ptf_db_get($key) {
    $m = ptf_db_conn(); /* v33.22.0: اتصال کش‌شدهٔ همین درخواست */
    if (!$m) return null;
    $t = ptf_db_table();
    $st = mysqli_prepare($m, "SELECT v FROM `$t` WHERE k = ?");
    if (!$st) return null;
    mysqli_stmt_bind_param($st, 's', $key);
    mysqli_stmt_execute($st);
    mysqli_stmt_bind_result($st, $v);
    $ok = mysqli_stmt_fetch($st);
    mysqli_stmt_close($st);
    return $ok ? $v : null;
}
/* برمی‌گرداند: true=موفق | false=خطا (JSON سالم می‌ماند) */
function ptf_db_set($key, $value, $rev = 0) {
    $m = ptf_db_conn(); /* v33.22.0: اتصال کش‌شدهٔ همین درخواست */
    if (!$m) return false;
    $t = ptf_db_table();
    $st = mysqli_prepare($m, "INSERT INTO `$t` (k, v, rev, updated_at) VALUES (?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE v = VALUES(v), rev = VALUES(rev), updated_at = NOW()");
    if (!$st) return false;
    mysqli_stmt_bind_param($st, 'ssi', $key, $value, $rev);
    $ok = mysqli_stmt_execute($st);
    mysqli_stmt_close($st);
    return $ok;
}
function ptf_db_del($key) {
    $m = ptf_db_conn();
    if (!$m) return false;
    $t = ptf_db_table();
    $st = mysqli_prepare($m, "DELETE FROM `$t` WHERE k = ?");
    if (!$st) return false;
    mysqli_stmt_bind_param($st, 's', $key);
    $ok = mysqli_stmt_execute($st);
    mysqli_stmt_close($st);
    return $ok;
}
/* همهٔ کلیدها → ['k' => 'v'] */
function ptf_db_all() {
    $m = ptf_db_conn();
    if (!$m) return [];
    $t = ptf_db_table();
    $out = [];
    $r = mysqli_query($m, "SELECT k, v FROM `$t`");
    if ($r) { while ($row = mysqli_fetch_assoc($r)) { $out[$row['k']] = $row['v']; } }
    return $out;
}
function ptf_db_count() {
    $m = ptf_db_conn();
    if (!$m) return -1;
    $t = ptf_db_table();
    $n = -1;
    $r = mysqli_query($m, "SELECT COUNT(*) AS n FROM `$t`");
    if ($r) { $row = mysqli_fetch_assoc($r); $n = (int)$row['n']; }
    return $n;
}

/* ---------- ادغام با crm.php (dual-write / منبع حقیقت) ----------
   قواعد:
   - ptf_db_write: در حالت dual یا mysql، به MySQL می‌نویسد. خطای MySQL هرگز مسیر JSON را نمی‌شکند.
   - ptf_db_read: در حالت mysql (پس از سوییچ) از MySQL می‌خواند؛ fallback به JSON. */
function ptf_db_write($key, $value) {
    $mode = ptf_db_mode();
    if ($mode !== 'dual' && $mode !== 'mysql') return;
    try { ptf_db_set($key, $value); } catch (Throwable $e) { /* بی‌صدا — JSON سالم است */ }
}
/* v33.22.0 (P1-MySQL-WIRE): نسخهٔ rev‌دارِ نوشتن با پاسخ bool — برای مسیر سینک (sync_key_write).
   DB خاموش (off) → true می‌دهد (فایل پادشاه است)؛ dual/mysql → نتیجهٔ واقعی نوشتن. */
function ptf_db_write_rev($key, $value, $rev = 0) {
    $mode = ptf_db_mode();
    if ($mode !== 'dual' && $mode !== 'mysql') return true;
    try { return (bool) ptf_db_set($key, $value, $rev); } catch (Throwable $e) { return false; }
}
function ptf_db_read($key) {
    $mode = ptf_db_mode();
    if ($mode !== 'mysql') return null; /* در dual هنوز JSON منبع خواندن است */
    try {
        $v = ptf_db_get($key);
        return ($v === null) ? null : $v;
    } catch (Throwable $e) { return null; }
}

/* ---------- v33.22.3 (P1-ATTACH-STALE-DB — گارد تازگی لحظه‌ای + خودترمیمی) ----------
   ریشهٔ رخداد «ناپدید شدن ضمایم/رکوردهای تازه پس از سوییچ»: ردیف‌های کهنهٔ DB (مانده از
   مهاجرت قبلی یا انتقال ناقص) در حالت mysql «منبع حقیقت» خوانده می‌شدند درحالی‌که فایل‌ها
   تازه‌تر بودند. قرارداد نوشتن این سامانه: «فایل همیشه اول و سپس DB» (sync_key_write و
   save_data)؛ بنابراین اگر mtime فایل از updated_at ردیف DB جلوتر باشد، آن ردیف «یقیناً»
   کهنه است (آخرین نوشتن هرگز به DB نرسیده). در آن حالت:
     ۱) مقدار تازهٔ فایل سرو می‌شود (کاربر هرگز دادهٔ عقب‌افتاده نمی‌بیند)
     ۲) همان لحظه ردیف DB با مقدار فایل خودترمیم می‌شود (خواندن بعدی از DB تازه می‌خواند)
   حاشیهٔ ۳ ثانیه برای امنیت در برابر رُند ثانیه‌ای/اختلاف ساعت جزئی PHP↔MySQL گذاشته شده؛
   در نوشتن عادی (فایل قبل از DB در همان ثانیه) هرگز فعال نمی‌شود و فقط «کهنگی واقعی»
   (دقیقه/ساعت/روز اختلاف) را شکار می‌کند. با این گارد، حتی مهاجرت ناقص/اشتباه هم دیگر
   نمی‌تواند خواندن را از فایل عقب‌تر نگه دارد — ریشه‌کن دائمی این دسته از خرابی.
   نکته: ptf_db_read (بدون گارد) برای مقایسهٔ دقیق در migrate/verify حفظ می‌شود. */
function ptf_db_read_fresh($key, $filePath = null) {
    $mode = ptf_db_mode();
    if ($mode !== 'mysql') return null;
    try {
        $m = ptf_db_conn();
        if (!$m) return null;
        $t = ptf_db_table();
        $st = mysqli_prepare($m, "SELECT v, UNIX_TIMESTAMP(updated_at) AS uts FROM `$t` WHERE k = ?");
        if (!$st) return null;
        mysqli_stmt_bind_param($st, 's', $key);
        mysqli_stmt_execute($st);
        mysqli_stmt_bind_result($st, $v, $uts);
        $ok = mysqli_stmt_fetch($st);
        mysqli_stmt_close($st);
        if (!$ok) return null;
        if ($filePath && is_string($v)) {
            @clearstatcache(true, $filePath);
            $fmt = file_exists($filePath) ? @filemtime($filePath) : false;
            if ($fmt !== false && (int)$uts > 0 && (int)$fmt > (int)$uts + 3) {
                $fv = @file_get_contents($filePath);
                if ($fv !== false) {
                    /* خودترمیمی: ردیف کهنه با مقدار تازهٔ فایل به‌روز می‌شود (idempotent) */
                    try { ptf_db_set($key, $fv); } catch (Throwable $e2) {}
                    return $fv;
                }
            }
        }
        return $v;
    } catch (Throwable $e) { return null; }
}

/* ---------- ابزار checksum (برای گزارش مهاجرت) ---------- */
function ptf_db_checksum($value) {
    return hash('sha256', (string)$value);
}
