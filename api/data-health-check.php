<?php
/**
 * PTF CRM — Data Health Diagnostic Tool
 * v31.7.7 — اجرا فقط توسط ادمین — از مرورگر حذف شود پس از استفاده
 * 
 * نحوه استفاده:
 * 1. فایل را در پوشه api/ آپلود کنید
 * 2. باز کنید: https://yourdomain.com/api/data-health-check.php?confirm=yes
 * 3. نتیجه را بررسی کنید
 * 4. فایل را از سرور حذف کنید
 */

if (($_GET['confirm'] ?? '') !== 'yes') {
    header('Content-Type: text/html; charset=utf-8');
    echo '<h2>PTF CRM — Data Health Check</h2>';
    echo '<p>برای اجرای تشخیص، پارامتر <code>?confirm=yes</code> را اضافه کنید.</p>';
    echo '<p><a href="?confirm=yes">▶ اجرای تشخیص کامل</a></p>';
    exit;
}

header('Content-Type: text/html; charset=utf-8; charset=utf-8');
header('X-Robots-Tag: noindex');

$data_dir = __DIR__ . '/../crm/data';
$sync_dir = $data_dir . '/sync';
$backup_dir = $data_dir . '/backups';

$results = [];

function check($name, $status, $detail = '') {
    global $results;
    $icon = $status === 'ok' ? '✅' : ($status === 'warn' ? '⚠️' : '❌');
    $results[] = ['name' => $name, 'status' => $status, 'detail' => $detail, 'icon' => $icon];
}

// ========== 1. ساختار پوشه‌ها ==========
check('پوشه crm/data', is_dir($data_dir) ? 'ok' : 'fail', 
    is_dir($data_dir) ? 'وجود دارد' : 'یافت نشد — اولین sync خودکار می‌سازد');
check('پوشه crm/data/sync', is_dir($sync_dir) ? 'ok' : 'warn',
    is_dir($sync_dir) ? 'وجود دارد' : 'هنوز sync انجام نشده — اولین push می‌سازد');
check('پوشه crm/data/backups', is_dir($backup_dir) ? 'ok' : 'warn',
    is_dir($backup_dir) ? 'وجود دارد' : 'هنوز بک‌آپی گرفته نشده');
check('فایل .htaccess محافظ', file_exists($data_dir . '/.htaccess') ? 'ok' : 'warn',
    file_exists($data_dir . '/.htaccess') ? 'محافظت فعال' : 'توصیه: .htaccess با "Deny from all" اضافه شود');

// ========== 2. سلامت فایل‌های sync ==========
if (is_dir($sync_dir)) {
    $meta_file = $sync_dir . '/meta.json';
    check('فایل meta.json', file_exists($meta_file) ? 'ok' : 'warn',
        file_exists($meta_file) ? 'وجود دارد' : 'هنوز sync نشده');
    
    if (file_exists($meta_file)) {
        $meta = json_decode(file_get_contents($meta_file), true);
        check('اعتبار meta.json', is_array($meta) ? 'ok' : 'fail',
            is_array($meta) ? 'JSON معتبر' : 'JSON خراب — نیازمند بررسی');
        
        if (is_array($meta)) {
            $globalRev = $meta['_global']['rev'] ?? 0;
            check('نسخه سراسری (rev)', $globalRev > 0 ? 'ok' : 'warn',
                "rev = $globalRev" . ($globalRev > 0 ? ' — داده sync شده وجود دارد' : ' — سرور خالی است'));
            
            $syncKeys = array_filter(array_keys($meta), function($k) { return $k !== '_global'; });
            check('تعداد کلیدهای sync', count($syncKeys) > 0 ? 'ok' : 'warn',
                count($syncKeys) . ' کلید sync شده');
            
            // بررسی وجود فایل هر کلید
            $missingFiles = [];
            $emptyFiles = [];
            $validFiles = 0;
            foreach ($syncKeys as $k) {
                $f = $sync_dir . '/' . $k . '.json';
                if (!file_exists($f)) {
                    $missingFiles[] = $k;
                } else {
                    $content = file_get_contents($f);
                    $decoded = json_decode($content, true);
                    if ($decoded === null && $content !== 'null') {
                        $emptyFiles[] = $k;
                    } else {
                        $validFiles++;
                    }
                }
            }
            check('فایل‌های sync معتبر', $validFiles > 0 ? 'ok' : 'warn',
                "$validFiles فایل معتبر" . 
                (count($missingFiles) ? ' — فاقد فایل: ' . implode(', ', array_slice($missingFiles, 0, 5)) : '') .
                (count($emptyFiles) ? ' — خالی/خراب: ' . implode(', ', array_slice($emptyFiles, 0, 5)) : ''));
            
            // بررسی داده‌های حیاتی
            $vitalKeys = ['ptf_crm_customers', 'ptf_crm_rfqs', 'ptf_crm_offers', 'ptf_crm_suppliers', 'ptf_crm_products'];
            $vitalInfo = [];
            foreach ($vitalKeys as $k) {
                $f = $sync_dir . '/' . $k . '.json';
                if (file_exists($f)) {
                    $data = json_decode(file_get_contents($f), true);
                    $count = is_array($data) ? count($data) : 0;
                    $vitalInfo[] = str_replace('ptf_crm_', '', $k) . ": $count";
                }
            }
            check('رکوردهای حیاتی', count($vitalInfo) > 0 ? 'ok' : 'warn',
                count($vitalInfo) > 0 ? implode(' | ', $vitalInfo) : 'داده حیاتی یافت نشد');
        }
    }
    
    // بررسی ptf_crm_users در sync
    $syncUsersFile = $sync_dir . '/ptf_crm_users.json';
    if (file_exists($syncUsersFile)) {
        $syncUsers = json_decode(file_get_contents($syncUsersFile), true);
        $userCount = is_array($syncUsers) ? count($syncUsers) : 0;
        check('کاربران sync‌شده', $userCount > 0 ? 'ok' : 'warn',
            "$userCount کاربر در sync — auth_login از اینجا می‌خواند");
    }
}

// ========== 3. بررسی فایل crm_users (legacy) ==========
$legacyUsers = $data_dir . '/crm_users.json';
if (file_exists($legacyUsers)) {
    $lu = json_decode(file_get_contents($legacyUsers), true);
    $luCount = is_array($lu) ? count($lu) : 0;
    check('کاربران legacy (crm_users)', 'ok', "$luCount کاربر — از users_sync ذخیره شده");
} else {
    check('کاربران legacy', 'warn', 'فایل crm_users.json وجود ندارد — فقط از sync خوانده می‌شود');
}

// ========== 4. سلامت بک‌آپ‌ها ==========
if (is_dir($backup_dir)) {
    $backups = array_merge(
        glob($backup_dir . '/*.json') ?: [],
        glob($backup_dir . '/*.json.gz') ?: []
    );
    check('فایل‌های بک‌آپ', count($backups) > 0 ? 'ok' : 'warn',
        count($backups) . ' فایل بک‌آپ');
    
    // بررسی hourly-latest
    $hourlyGz = $backup_dir . '/hourly-latest.json.gz';
    $hourlyJson = $backup_dir . '/hourly-latest.json';
    $hasHourly = file_exists($hourlyGz) || file_exists($hourlyJson);
    check('بک‌آپ ساعتی (hourly-latest)', $hasHourly ? 'ok' : 'warn',
        $hasHourly ? 'موجود — قابل بازیابی' : 'یافت نشد — اولین sync + backup خودکار می‌سازد');
    
    // بررسی اعتبار بک‌آپ ساعتی
    if (file_exists($hourlyGz) && function_exists('gzdecode')) {
        $raw = @gzdecode(@file_get_contents($hourlyGz));
        $decoded = $raw ? json_decode($raw, true) : null;
        check('اعتبار بک‌آپ ساعتی', $decoded ? 'ok' : 'fail',
            $decoded ? 'JSON معتبر — قابل بازیابی' : 'خراب — از بک‌آپ روزانه/هفتگی استفاده کنید');
    } elseif (file_exists($hourlyJson)) {
        $decoded = json_decode(file_get_contents($hourlyJson), true);
        check('اعتبار بک‌آپ ساعتی', $decoded ? 'ok' : 'fail',
            $decoded ? 'JSON معتبر — قابل بازیابی' : 'خراب');
    }
    
    // بررسی daily
    $dailies = glob($backup_dir . '/daily-*.json*') ?: [];
    check('بک‌آپ روزانه', count($dailies) > 0 ? 'ok' : 'warn',
        count($dailies) . ' نسخه روزانه');
    
    // بررسی weekly/monthly
    check('بک‌آپ هفتگی', (file_exists($backup_dir . '/weekly-latest.json.gz') || file_exists($backup_dir . '/weekly-latest.json')) ? 'ok' : 'warn',
        file_exists($backup_dir . '/weekly-latest.json.gz') || file_exists($backup_dir . '/weekly-latest.json') ? 'موجود' : 'یافت نشد');
    check('بک‌آپ ماهانه', (file_exists($backup_dir . '/monthly-latest.json.gz') || file_exists($backup_dir . '/monthly-latest.json')) ? 'ok' : 'warn',
        file_exists($backup_dir . '/monthly-latest.json.gz') || file_exists($backup_dir . '/monthly-latest.json') ? 'موجود' : 'یافت نشد');
    
    // بررسی suspect (قرنطینه)
    $suspects = array_merge(
        glob($backup_dir . '/suspect-*.json') ?: [],
        glob($backup_dir . '/suspect-*.json.gz') ?: []
    );
    if (count($suspects) > 0) {
        check('⚠️ بک‌آپ قرنطینه‌شده', 'warn',
            count($suspects) . ' فایل suspect — بررسی توسط ادمین توصیه می‌شود');
    }
}

// ========== 5. سلامت tokens ==========
$tokensFile = $data_dir . '/tokens.json';
if (file_exists($tokensFile)) {
    $tokens = json_decode(file_get_contents($tokensFile), true);
    $tokenCount = is_array($tokens) ? count($tokens) : 0;
    $activeTokens = 0;
    if (is_array($tokens)) {
        $now = time();
        foreach ($tokens as $t => $info) {
            if (isset($info['exp']) && $info['exp'] > $now) $activeTokens++;
        }
    }
    check('توکن‌های JWT', 'ok', "$tokenCount توکن کل | $activeTokens فعال");
} else {
    check('توکن‌های JWT', 'warn', 'فایل tokens.json یافت نشد — کاربران باید دوباره وارد شوند');
}

// ========== 6. سلامت secrets ==========
$secretPaths = [
    dirname(__DIR__, 2) . '/ptf-secrets.php',
    dirname(__DIR__, 3) . '/ptf-secrets.php',
    __DIR__ . '/../ptf-secrets.php',
    __DIR__ . '/ptf-secrets.php',
];
$secretFound = false;
foreach ($secretPaths as $p) {
    if (file_exists($p)) { $secretFound = true; break; }
}
check('فایل secrets', $secretFound ? 'ok' : 'warn',
    $secretFound ? 'پیکربندی secrets یافت شد' : 'از مقادیر پیش‌فرض استفاده می‌شود — توصیه: ptf-secrets.php خارج از webroot بسازید');

// ========== 7. تست auth_login ==========
require_once __DIR__ . '/auth.php';
$testUsers = [];
// بررسی crm_users
$cu = file_exists($data_dir . '/crm_users.json') ? json_decode(file_get_contents($data_dir . '/crm_users.json'), true) : [];
if (is_array($cu)) $testUsers = array_merge($testUsers, $cu);
// بررسی sync users
$su = file_exists($sync_dir . '/ptf_crm_users.json') ? json_decode(file_get_contents($sync_dir . '/ptf_crm_users.json'), true) : [];
if (is_array($su)) $testUsers = array_merge($testUsers, $su);

check('دسترسی به کاربران برای auth', count($testUsers) > 0 ? 'ok' : 'warn',
    count($testUsers) . ' کاربر قابل دسترسی برای auth_login');

// ========== 8. بررسی API log ==========
$logFile = $data_dir . '/api_log.txt';
if (file_exists($logFile)) {
    $log = file_get_contents($logFile);
    $lines = array_filter(explode("\n", $log));
    check('API Log', 'ok', count($lines) . ' ورودی — آخرین: ' . (end($lines) ?: 'نامشخص'));
} else {
    check('API Log', 'warn', 'فایل لاگ وجود ندارد — با اولین درخواست ساخته می‌شود');
}

// ========== 9. بررسی فایل‌های legacy data ==========
$legacyKeys = ['users', 'rfqs', 'suppliers', 'customers', 'settings'];
$legacyInfo = [];
foreach ($legacyKeys as $k) {
    $f = $data_dir . '/' . $k . '.json';
    if (file_exists($f)) {
        $d = json_decode(file_get_contents($f), true);
        $c = is_array($d) ? count($d) : (is_object($d) ? 1 : 0);
        $legacyInfo[] = "$k: $c";
    }
}
if (count($legacyInfo)) {
    check('داده‌های legacy (crm/data/)', 'ok', implode(' | ', $legacyInfo));
}

// ========== 10. بررسی permissions ==========
if (is_dir($data_dir)) {
    $perms = substr(sprintf('%o', fileperms($data_dir)), -4);
    check('دسترسی crm/data', is_writable($data_dir) ? 'ok' : 'fail',
        "permissions: $perms — " . (is_writable($data_dir) ? 'قابل نوشتن' : '⛔ غیرقابل نوشتن — chmod 755 لازم است'));
}

// ========== 11. تطابق فایل ↔ دیتابیس (v33.22.3 — P1-ATTACH-STALE-DB) ==========
/* پیش از این این ابزار فقط «فایل»ها را بررسی می‌کرد و سبزِ آن هیچ تضمینی روی تازه‌بودن DB
   نبود (زمینه‌ساز رخداد ناپدید شدن ضمایم پس از سوییچ). حالا در حالت dual/mysql، تطابق واقعی
   فایل↔DB هرکلید (چک‌سام + تعداد) گزارش می‌شود. کلیدهای فرّارِ عمداً فایل‌محور (meta = دفتر rev
   و tokens = نشست‌های ورود) از مقایسه مستثنا‌اند — مثل ویزارد مهاجرت. */
$_dblib = __DIR__ . '/db-lib.php';
if (file_exists($_dblib)) {
    require_once $_dblib;
    $_mode = function_exists('ptf_db_mode') ? ptf_db_mode() : 'off';
    check('حالت دیتابیس (mode)', 'ok', 'mode = ' . $_mode . ($_mode === 'mysql' ? ' — DB منبع حقیقت خواندن (با گارد تازگی)' : ($_mode === 'dual' ? ' — فایل منبع خواندن + آینهٔ DB' : ' — فقط فایل')));
    if (($_mode === 'mysql' || $_mode === 'dual') && function_exists('ptf_db_get')) {
        $_keys = [];
        foreach ([$data_dir, $sync_dir] as $_d) {
            if (!is_dir($_d)) continue;
            foreach (glob($_d . '/*.json') ?: [] as $_f) {
                $_k = basename($_f, '.json');
                if (in_array($_k, ['otp', 'ratelimit', 'meta', 'tokens'], true)) continue;
                if (isset($_keys[$_k])) continue;
                $_keys[$_k] = $_f;
            }
        }
        $_mism = [];
        $_checked = 0;
        foreach ($_keys as $_k => $_f) {
            $_raw = @file_get_contents($_f);
            $_dbv = null;
            try { $_dbv = ptf_db_get($_k); } catch (Throwable $_e) { $_dbv = null; }
            if (($_raw === false) && ($_dbv === null)) continue;
            $_checked++;
            $_jC = hash('sha256', (string)$_raw);
            $_dC = hash('sha256', (string)$_dbv);
            if ($_jC !== $_dC) $_mism[] = $_k . ($_dbv === null ? ' (در DB نیست)' : '');
        }
        check('تطابق فایل ↔ دیتابیس', count($_mism) ? ($_mode === 'mysql' ? 'fail' : 'warn') : 'ok',
            count($_mism)
                ? count($_mism) . ' کلید مغایرت از ' . $_checked . ' کلید: ' . implode('، ', array_slice($_mism, 0, 12)) . (count($_mism) > 12 ? '…' : '') . ' — اجرای مرحلهٔ ۳ ویزارد (migrate.php) آن را ترمیم می‌کند'
                : $_checked . ' کلید داده — همه یکسان ✅');
        if ($_mode === 'mysql' && count($_mism)) {
            check('🧯 گارد تازگی (خودترمیم لحظه‌ای)', 'ok',
                'حتی با وجود مغایرت بالا، خواندن کاربران از فایلِ تازه‌تر انجام و ردیف DB خودکار ترمیم می‌شود (v33.22.3) — ولی برای تطبیق کامل مرحلهٔ ۳ ویزارد را اجرا کنید.');
        }
    } elseif ($_mode === 'off') {
        check('تطابق فایل ↔ دیتابیس', 'ok', 'دیتابیس غیرفعال است — سامانه دقیقاً مثل گذشته فقط با فایل کار می‌کند');
    }
}

// ========== نمایش نتایج ==========
$okCount = count(array_filter($results, function($r) { return $r['status'] === 'ok'; }));
$warnCount = count(array_filter($results, function($r) { return $r['status'] === 'warn'; }));
$failCount = count(array_filter($results, function($r) { return $r['status'] === 'fail'; }));

echo '<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><title>PTF CRM — Data Health Check</title>';
echo '<style>body{font-family:Tahoma,sans-serif;max-width:800px;margin:20px auto;padding:20px;background:#f7f8fa;color:#1e293b}';
echo 'h1{color:#ef4b1a;border-bottom:3px solid #ef4b1a;padding-bottom:10px}';
echo '.summary{display:flex;gap:16px;margin:20px 0;flex-wrap:wrap}';
echo '.box{padding:14px 20px;border-radius:14px;font-size:18px;font-weight:bold;flex:1;min-width:120px;text-align:center}';
echo '.box-ok{background:#d1fae5;color:#065f46}.box-warn{background:#fef3c7;color:#92400e}.box-fail{background:#fee2e2;color:#b91c1c}';
echo 'table{width:100%;border-collapse:collapse;margin:20px 0}';
echo 'td{padding:10px;border-bottom:1px solid #e2e8f0;font-size:13px;vertical-align:top}';
echo 'td:first-child{width:30px;text-align:center;font-size:18px}';
echo 'td:nth-child(2){font-weight:bold;width:200px}';
echo '.footer{margin-top:30px;padding:14px;background:#fef2f2;border:1px solid #fecaca;border-radius:12px;font-size:12px;color:#b91c1c}';
echo '</style></head><body>';

echo '<h1>🏥 PTF CRM — گزارش سلامت داده‌ها</h1>';
echo '<p>تاریخ بررسی: ' . date('Y-m-d H:i:s') . ' | نسخه ابزار: v33.22.3 (بخش ۱۱: تطابق واقعی فایل↔DB)</p>';

echo '<div class="summary">';
echo '<div class="box box-ok">✅ ' . $okCount . ' سالم</div>';
echo '<div class="box box-warn">⚠️ ' . $warnCount . ' هشدار</div>';
echo '<div class="box box-fail">❌ ' . $failCount . ' خطا</div>';
echo '</div>';

echo '<table>';
foreach ($results as $r) {
    $bg = $r['status'] === 'fail' ? '#fef2f2' : ($r['status'] === 'warn' ? '#fffbeb' : '');
    echo '<tr style="' . ($bg ? "background:$bg" : '') . '">';
    echo '<td>' . $r['icon'] . '</td>';
    echo '<td>' . htmlspecialchars($r['name']) . '</td>';
    echo '<td>' . htmlspecialchars($r['detail']) . '</td>';
    echo '</tr>';
}
echo '</table>';

echo '<div class="footer">';
echo '⚠️ <b>توصیه امنیتی:</b> این فایل را پس از بررسی از سرور حذف کنید: <code>rm api/data-health-check.php</code><br>';
echo '📋 اگر خطایی یافت شد، فایل را ذخیره و نتیجه را برای تیم توسعه ارسال کنید.';
echo '</div>';
echo '</body></html>';
