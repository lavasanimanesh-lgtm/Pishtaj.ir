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
    $p = ptf_db_config_path();
    if (!file_exists($p)) return null;
    try {
        $c = require $p;
        return (is_array($c) && !empty($c['db_name'])) ? $c : null;
    } catch (Throwable $e) { return null; }
}
/* ذخیرهٔ کانفیگ (فقط از migrate.php صدا زده می‌شود) */
function ptf_db_save_config(array $cfg) {
    $p = ptf_db_config_path();
    $code = "<?php\n/**\n * PTF CRM — کانفیگ اتصال دیتابیس (تولیدشده توسط migrate.php)\n * توجه: این فایل رمز دیتابیس را دارد؛ هرگز در گیت/چت/بک‌آپ عمومی قرار نگیرد.\n */\nreturn " . var_export($cfg, true) . ";\n";
    return @file_put_contents($p, $code, LOCK_EX) !== false;
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
    $m = ptf_db_connect();
    if (!$m) return null;
    $t = ptf_db_table();
    $st = mysqli_prepare($m, "SELECT v FROM `$t` WHERE k = ?");
    if (!$st) { mysqli_close($m); return null; }
    mysqli_stmt_bind_param($st, 's', $key);
    mysqli_stmt_execute($st);
    mysqli_stmt_bind_result($st, $v);
    $ok = mysqli_stmt_fetch($st);
    mysqli_stmt_close($st);
    mysqli_close($m);
    return $ok ? $v : null;
}
/* برمی‌گرداند: true=موفق | false=خطا (JSON سالم می‌ماند) */
function ptf_db_set($key, $value, $rev = 0) {
    $m = ptf_db_connect();
    if (!$m) return false;
    $t = ptf_db_table();
    $st = mysqli_prepare($m, "INSERT INTO `$t` (k, v, rev, updated_at) VALUES (?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE v = VALUES(v), rev = VALUES(rev), updated_at = NOW()");
    if (!$st) { mysqli_close($m); return false; }
    mysqli_stmt_bind_param($st, 'ssi', $key, $value, $rev);
    $ok = mysqli_stmt_execute($st);
    mysqli_stmt_close($st);
    mysqli_close($m);
    return $ok;
}
function ptf_db_del($key) {
    $m = ptf_db_connect();
    if (!$m) return false;
    $t = ptf_db_table();
    $st = mysqli_prepare($m, "DELETE FROM `$t` WHERE k = ?");
    if (!$st) { mysqli_close($m); return false; }
    mysqli_stmt_bind_param($st, 's', $key);
    $ok = mysqli_stmt_execute($st);
    mysqli_stmt_close($st);
    mysqli_close($m);
    return $ok;
}
/* همهٔ کلیدها → ['k' => 'v'] */
function ptf_db_all() {
    $m = ptf_db_connect();
    if (!$m) return [];
    $t = ptf_db_table();
    $out = [];
    $r = mysqli_query($m, "SELECT k, v FROM `$t`");
    if ($r) { while ($row = mysqli_fetch_assoc($r)) { $out[$row['k']] = $row['v']; } }
    mysqli_close($m);
    return $out;
}
function ptf_db_count() {
    $m = ptf_db_connect();
    if (!$m) return -1;
    $t = ptf_db_table();
    $n = -1;
    $r = mysqli_query($m, "SELECT COUNT(*) AS n FROM `$t`");
    if ($r) { $row = mysqli_fetch_assoc($r); $n = (int)$row['n']; }
    mysqli_close($m);
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
function ptf_db_read($key) {
    $mode = ptf_db_mode();
    if ($mode !== 'mysql') return null; /* در dual هنوز JSON منبع خواندن است */
    try {
        $v = ptf_db_get($key);
        return ($v === null) ? null : $v;
    } catch (Throwable $e) { return null; }
}

/* ---------- ابزار checksum (برای گزارش مهاجرت) ---------- */
function ptf_db_checksum($value) {
    return hash('sha256', (string)$value);
}
