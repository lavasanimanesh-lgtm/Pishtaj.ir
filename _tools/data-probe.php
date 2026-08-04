<?php
/* =====================================================================
   PTF CRM — Data Source Probe (فقط‌خوان)
   مقایسهٔ «DB در برابر فایل» برای کلیدهای حاوی مرجع ضمیمه،
   و جستجوی کلید LEVELSWITCH در هر دو منبع پروداکشن و استیجینگ.
   =====================================================================
   نحوهٔ استفاده:
     1) این فایل را در public_html هاست پروداکشن آپلود کنید (data-probe.php)
     2) https://pishtaj.ir/data-probe.php  ← خروجی را بفرستید
     3) بعد از بررسی، فایل را حذف کنید.
   فقط‌خوان است؛ هیچ رازی چاپ نمی‌کند (فقط ۸ کاراکتر اول access_key).
   ===================================================================== */

header('Content-Type: text/html; charset=utf-8');
error_reporting(E_ALL);
ini_set('display_errors', '1');

echo '<!doctype html><html dir="rtl"><head><meta charset="utf-8"><title>Data Source Probe</title></head>
<body style="font-family:Tahoma;font-size:12px;background:#f8fafc;padding:16px">';
echo '<h2>🔍 Data Source Probe — مقایسهٔ DB در برابر فایل</h2>';

/* ---------- بارگذاری کانفیگ DB (مثل db-lib) ---------- */
function db_cfg() {
    $paths = [
        dirname(__DIR__, 2) . '/ptf-db-config.php',
        dirname(__DIR__, 3) . '/ptf-db-config.php',
        dirname(__DIR__) . '/ptf-db-config.php',
    ];
    foreach ($paths as $p) if (file_exists($p)) return include $p;
    return null;
}
$cfg = db_cfg();
if (!$cfg || empty($cfg['db_name']) || empty($cfg['db_user'])) {
    echo '<p style="color:#b91c1c"><b>⚠️ کانفیگ DB یافت نشد.</b> مسیرهای بررسی‌شده: یک/دو پوشه بالاتر از public_html + خود public_html.</p></body></html>';
    exit;
}
$host = $cfg['db_host'] ?? 'localhost';
$port = $cfg['db_port'] ?? 3306;
$user = $cfg['db_user']; $pass = $cfg['db_pass'] ?? ''; $name = $cfg['db_name'];
$table = preg_replace('/[^A-Za-z0-9_]/', '', $cfg['db_table'] ?? 'ptf_kv') ?: 'ptf_kv';

$m = @mysqli_connect($host, $user, $pass, $name, (int)$port);
echo '<p>اتصال به DB: ' . ($m ? '✅ متصل' : '❌ ' . htmlspecialchars(mysqli_connect_error())) . '</p>';

/* ---------- پوشهٔ داده (جایی که فایل‌های کلیدها هستند) ---------- */
$dataDirs = [
    dirname(__DIR__, 2) . '/crm/data',
    dirname(__DIR__) . '/crm/data',
    dirname(__DIR__) . '/data',
];
$dataDir = null;
foreach ($dataDirs as $d) if (is_dir($d)) { $dataDir = $d; break; }
echo '<p>پوشهٔ دادهٔ یافت‌شده: ' . ($dataDir ? htmlspecialchars($dataDir) : '— (هیچ)') . '</p>';

/* ---------- کلیدهایی که باید بررسی شوند ---------- */
$SEARCH = 'LEVELSWITCH';
$KEYS = ['ptf_crm_rfqs', 'ptf_crm_inqitems', 'ptf_crm_deals', 'ptf_crm_petty', 'ptf_crm_petty_tx', 'ptf_crm_letters', 'ptf_crm_contracts', 'ptf_crm_supplier_finance'];

function file_val($dir, $k) {
    $p = rtrim($dir, '/') . '/' . $k . '.json';
    return file_exists($p) ? file_get_contents($p) : null;
}

echo '<h3>۱) وضعیت منبع (mode) و تطابق DB ↔ فایل</h3>';
echo '<table border="1" cellpadding="5" cellspacing="0" style="border-collapse:collapse;background:#fff"><tr><th>کلید</th><th>DB (طول/rev/updated)</th><th>فایل (طول/mtime)</th><th>یکسان؟</th><th>حاوی LEVELSWITCH؟</th></tr>';

foreach ($KEYS as $k) {
    $dbv = null; $dbrev = null; $dbupd = null;
    if ($m) {
        $st = mysqli_prepare($m, "SELECT v, rev, updated_at FROM `$table` WHERE k = ?");
        if ($st) {
            mysqli_stmt_bind_param($st, 's', $k);
            mysqli_stmt_execute($st);
            mysqli_stmt_bind_result($st, $dbv, $dbrev, $dbupd);
            mysqli_stmt_fetch($st);
            mysqli_stmt_close($st);
        }
    }
    $fv = $dataDir ? file_val($dataDir, $k) : null;
    $same = ($dbv !== null && $fv !== null) ? ($dbv === $fv ? '✅' : '❌') : ($dbv === null && $fv === null ? '—' : ($dbv === null ? 'فقط فایل' : 'فقط DB'));
    $has = (($dbv !== null && strpos($dbv, $SEARCH) !== false) || ($fv !== null && strpos($fv, $SEARCH) !== false)) ? '🚨 بله' : 'خیر';
    echo '<tr><td dir="ltr">' . htmlspecialchars($k) . '</td><td>' . ($dbv !== null ? strlen($dbv) . ' / ' . $dbrev . ' / ' . htmlspecialchars((string)$dbupd) : '—') . '</td><td>' . ($fv !== null ? strlen($fv) . ' / ' . date('Y-m-d H:i', filemtime(rtrim($dataDir,'/') . '/' . $k . '.json')) : '—') . '</td><td>' . $same . '</td><td>' . $has . '</td></tr>';
}
echo '</table>';

/* ---------- جستجوی LEVELSWITCH در هر دو منبع ---------- */
echo '<h3>۲) جستجوی «' . $SEARCH . '» در همهٔ کلیدهای DB و فایل</h3>';
$found = false;

if ($m) {
    $res = mysqli_query($m, "SELECT k, LENGTH(v) AS len, rev, updated_at FROM `$table`");
    if ($res) {
        while ($row = mysqli_fetch_assoc($res)) {
            $k = $row['k'];
            $v = null;
            $st = mysqli_prepare($m, "SELECT v FROM `$table` WHERE k = ?");
            if ($st) { mysqli_stmt_bind_param($st, 's', $k); mysqli_stmt_execute($st); mysqli_stmt_bind_result($st, $v); mysqli_stmt_fetch($st); mysqli_stmt_close($st); }
            if ($v !== null && strpos($v, $SEARCH) !== false) {
                $found = true;
                echo '<p>🚨 <b>DB</b> — کلید <span dir="ltr">' . htmlspecialchars($k) . '</span> (' . strlen($v) . ' کاراکتر، rev=' . $row['rev'] . ', updated=' . htmlspecialchars($row['updated_at']) . ')</p>';
                $pos = strpos($v, $SEARCH);
                echo '<pre dir="ltr" style="background:#fff;border:1px solid #ddd;padding:8px;max-height:200px;overflow:auto">' . htmlspecialchars(substr($v, max(0,$pos-300), 800)) . '</pre>';
            }
        }
    }
}

if ($dataDir) {
    foreach (glob(rtrim($dataDir, '/') . '/*.json') ?: [] as $fp) {
        $k = basename($fp, '.json');
        $v = file_get_contents($fp);
        if (strpos($v, $SEARCH) !== false) {
            $found = true;
            echo '<p>🚨 <b>فایل</b> — کلید <span dir="ltr">' . htmlspecialchars($k) . '</span> (' . strlen($v) . ' کاراکتر، mtime=' . date('Y-m-d H:i', filemtime($fp)) . ')</p>';
            $pos = strpos($v, $SEARCH);
            echo '<pre dir="ltr" style="background:#fff;border:1px solid #ddd;padding:8px;max-height:200px;overflow:auto">' . htmlspecialchars(substr($v, max(0,$pos-300), 800)) . '</pre>';
        }
    }
}

if (!$found) echo '<p>🔎 در هیچ‌کدام از دو منبع (DB و فایل) مرجعی به «' . $SEARCH . '» یافت نشد.</p>';

echo '<p style="color:#475569">— پایان. بعد از بررسی، این فایل را از هاست حذف کنید.</p></body></html>';
