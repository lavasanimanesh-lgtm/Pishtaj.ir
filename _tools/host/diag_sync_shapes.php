<?php
/* ============================================================================
 * PTF CRM — ابزارِ تشخیصِ فقط-خواندنیِ «شکلِ کلیدهای همگام»  (v34.38.16)
 * ----------------------------------------------------------------------------
 * هدف: پیدا کردن ریشهٔ کلِ کلاسِ خطاهایی مثل
 *   ptf_crm_commission_records:integrity-manifest-missing
 * یعنی هر کلیدِ مجموعه‌ای (ptf_crm_*) که مقدارش در سمت سرور یک «لیست/آرایه» نیست.
 * فقط می‌خواند؛ هیچ فایلی را تغییر/حذف/بازنویسی نمی‌کند.
 *
 * نحوهٔ اجرا (در ترمینال/SSH از پوشهٔ api که کنار crm.php است):
 *   php diag_sync_shapes.php
 *
 * یا اگر فقط پنل فایل/هنگل دارید، به‌جای آپلود در apic این فایل را در پوشه‌ای که
 * php-cli دارد اجرا کنید (پیشنهاد: همان پوشهٔ api هاست و از ترمینال صدا بزنید؛
 * چون خروجیِ وب ممکن است اطلاعاتِ ساختار را فاش کند، ترجیح با اجرای CLI است).
 *
 * خروجی فقط «فراداده» است:  کلید | نوعِ همان‌شکلِ گزارشِ سرور | تعداد | بایت.
 * هرگز محتوای رکوردها چاپ نمی‌شود.
 * ==========================================================================*/
error_reporting(E_ALL & ~E_DEPRECATED & ~E_NOTICE);

$dir = __DIR__ . '/../crm/data/sync';
if (!is_dir($dir)) {
    // مسیر جایگزین: اگر این فایل را جای دیگری گذاشتید، آدرس را این‌جا بدهید.
    $alt = getenv('PTF_SYNC_DIR');
    if ($alt && is_dir($alt)) { $dir = $alt; }
    else { fwrite(STDERR, "sync dir پیدا نشد: {$dir}\n"); exit(2); }
}

/* همان طبقه‌بندی sync_payload_stats در api/crm.php — تا خروجی دقیقاً همان چیزی
   باشد که کلاینت از manifest می‌بیند (kind مثل 'array'/'object'/'NULL'). */
function classify($json) {
    $value = json_decode((string)$json, true);
    if (json_last_error() !== JSON_ERROR_NONE) return ['kind' => 'invalid', 'count' => null];
    if (is_array($value)) {
        $isList = ($value === []) || (array_keys($value) === range(0, count($value) - 1));
        return ['kind' => $isList ? 'array' : 'object', 'count' => count($value)];
    }
    return ['kind' => gettype($value), 'count' => null]; // مثلاً 'NULL' برای محتوای null
}

$files = glob($dir . '/ptf_crm_*.json');
if (!$files) { fwrite(STDERR, "هیچ فایل ptf_crm_*.json در {$dir} نیست\n"); exit(3); }
sort($files);

$out = [];
foreach ($files as $f) {
    $raw = @file_get_contents($f);
    if ($raw === false) { $out[] = [basename($f, '.json'), 'unreadable', null, '?']; continue; }
    $c = classify($raw);
    $out[] = [basename($f, '.json'), $c['kind'], $c['count'], strlen($raw)];
}

/* جدول: فقط کلیدهایی که لیست نیستند (مظنون) اول، بقیه بعد. */
usort($out, function ($a, $b) {
    $aSus = ($a[1] !== 'array' && $a[1] !== 'unreadable') ? 0 : 1;
    $bSus = ($b[1] !== 'array' && $b[1] !== 'unreadable') ? 0 : 1;
    if ($aSus !== $bSus) return $aSus - $bSus;
    return strcmp($a[0], $b[0]);
});

echo "PTF CRM — پیمایش فقط-خواندنیِ شکل کلیدها  (dir={$dir})\n";
echo str_repeat('-', 64) . "\n";
echo str_pad('KEY', 42) . str_pad('KIND', 9) . str_pad('COUNT', 7) . "BYTES\n";
$suspects = 0;
foreach ($out as $r) {
    if ($r[1] !== 'array' && $r[1] !== 'unreadable') $suspects++;
    $k = $r[1] !== 'array' && $r[1] !== 'unreadable' ? $r[0] . '  <-- غير-ليست' : $r[0];
    echo str_pad(substr($k, 0, 42), 42) . str_pad($r[1], 9) . str_pad($r[2] === null ? '-' : (string)$r[2], 7) . $r[3] . "\n";
}
echo str_repeat('-', 64) . "\n";
echo "جمع کلیدهای ptf_crm_: " . count($out) . " | غیر-لیست (مظنون): {$suspects}\n";
echo "توجه: فایل‌ها دست‌نخورده ماندند (فقط-خواندنی).\n";
