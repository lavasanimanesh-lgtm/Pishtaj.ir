<?php
/* =====================================================================
   PTF CRM — Storage Probe (فقط‌خوان) — عیب‌یابی 404 ضمایم پروداکشن
   =====================================================================
   نحوهٔ استفاده:
     1) این فایل را در پوشهٔ public_html هاست پروداکشن آپلود کنید (مثلاً storage-probe.php)
     2) در مرورگر:  https://pishtaj.ir/storage-probe.php
     3) خروجی را برای پشتیبانی فنی بفرستید
     4) بعد از اتمام، فایل را از هاست حذف کنید

   امنیت: فقط‌خوان است (HEAD/GET/list). هیچ رازی را چاپ نمی‌کند
   (secret_key کاملاً ماسک می‌شود؛ access_key فقط ۸ کاراکتر اول).
   ===================================================================== */

header('Content-Type: text/html; charset=utf-8');

/* ---------- همان مسیرهای بارگذاری کانفیگ api/storage.php ---------- */
function load_cfg() {
    $paths = [
        dirname(__DIR__, 2) . '/storage-config.php',
        dirname(__DIR__, 3) . '/storage-config.php',
        dirname(__DIR__) . '/storage-config.php',
    ];
    foreach ($paths as $p) if (file_exists($p)) return include $p;
    return null;
}

/* ---------- همان sig_v4 دقیقاً مثل api/storage.php ---------- */
function sig_v4($cfg, $method, $key, $queryExtra = [], $expiry = 600) {
    $host = parse_url($cfg['endpoint'], PHP_URL_HOST);
    $now = gmdate('Ymd\THis\Z');
    $date = gmdate('Ymd');
    $scope = "$date/{$cfg['region']}/s3/aws4_request";
    $credential = $cfg['access_key'] . '/' . $scope;
    $query = array_merge([
        'X-Amz-Algorithm'     => 'AWS4-HMAC-SHA256',
        'X-Amz-Credential'    => $credential,
        'X-Amz-Date'          => $now,
        'X-Amz-Expires'       => $expiry,
        'X-Amz-SignedHeaders' => 'host',
    ], $queryExtra);
    ksort($query);
    $canonicalQuery = http_build_query($query, '', '&', PHP_QUERY_RFC3986);
    $uri = '/' . $cfg['bucket'] . '/' . str_replace('%2F', '/', rawurlencode($key));
    $canonicalRequest = implode("\n", [$method, $uri, $canonicalQuery, "host:$host\n", 'host', 'UNSIGNED-PAYLOAD']);
    $stringToSign = implode("\n", ['AWS4-HMAC-SHA256', $now, $scope, hash('sha256', $canonicalRequest)]);
    $sigKey = hash_hmac(hash_hmac(hash_hmac(hash_hmac('AWS4' . $cfg['secret_key'], $date), $cfg['region']), 's3'), 'aws4_request', true);
    $signature = hash_hmac($sigKey, $stringToSign, false);
    return rtrim($cfg['endpoint'], '/') . $uri . '?' . $canonicalQuery . '&X-Amz-Signature=' . $signature;
}

/* ---------- درخواست امضاشده (مثل s3_request در storage.php) ---------- */
function s3_req($cfg, $method, $path, $query = '') {
    $host = parse_url($cfg['endpoint'], PHP_URL_HOST);
    $now = gmdate('Ymd\THis\Z');
    $date = gmdate('Ymd');
    $scope = "$date/{$cfg['region']}/s3/aws4_request";
    $payloadHash = hash('sha256', '');
    $headers = "host:$host\nx-amz-content-sha256:$payloadHash\nx-amz-date:$now\n";
    $signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
    $canonicalRequest = implode("\n", [$method, $path, $query, $headers, $signedHeaders, $payloadHash]);
    $stringToSign = implode("\n", ['AWS4-HMAC-SHA256', $now, $scope, hash('sha256', $canonicalRequest)]);
    $sigKey = hash_hmac(hash_hmac(hash_hmac(hash_hmac('AWS4' . $cfg['secret_key'], $date), $cfg['region']), 's3'), 'aws4_request', true);
    $signature = hash_hmac($sigKey, $stringToSign, false);
    $auth = "AWS4-HMAC-SHA256 Credential={$cfg['access_key']}/$scope, SignedHeaders=$signedHeaders, Signature=$signature";
    $url = $cfg['endpoint'] . $path . ($query ? "?$query" : '');
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_TIMEOUT => 25,
        CURLOPT_HTTPHEADER => ["Authorization: $auth", "x-amz-content-sha256: $payloadHash", "x-amz-date: $now"],
    ]);
    $body = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err  = curl_error($ch);
    curl_close($ch);
    return ['code' => $code, 'body' => $body, 'err' => $err];
}

/* ---------- تست GET با presigned (Range برای جلوگیری از دانلود کامل) ---------- */
function presigned_get_code($cfg, $key) {
    $url = sig_v4($cfg, 'GET', $key, [], 600);
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_NOBODY => false,
        CURLOPT_RANGE => '0-0',
        CURLOPT_TIMEOUT => 25,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_USERAGENT => 'PTF-StorageProbe',
    ]);
    curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);
    return ['code' => $code, 'err' => $err];
}

/* ---------- کلیدهای خطادار (از کنسول کارفرما) ---------- */
$KEYS = [
    'pettyPTY-1022/2026-07/6a68912794d9d-IMG_6135.jpeg',
    'rfqinq/2026-08/6a6da4b91f71b-LEVELSWITCH_20260509074217.895_X-1.pdf',
];

echo '<!doctype html><html dir="rtl"><head><meta charset="utf-8"><title>Storage Probe</title></head><body style="font-family:Tahoma;font-size:12px;background:#f8fafc;padding:16px">';
echo '<h2>🔍 Storage Probe — عیب‌یابی 404 ضمایم</h2>';

$cfg = load_cfg();
if (!$cfg || empty($cfg['endpoint']) || empty($cfg['bucket']) || empty($cfg['access_key']) || empty($cfg['secret_key'])) {
    echo '<p style="color:#b91c1c"><b>⚠️ کانفیگ یافت نشد یا ناقص است.</b> مسیرهای بررسی‌شده: یک و دو پوشه بالاتر از public_html + خود public_html.</p>';
    echo '</body></html>';
    exit;
}

/* ---------- ۱) نمایش کانفیگ (ماسک‌شده) ---------- */
echo '<h3>۱) کانفیگ فعلی سرور (ماسک‌شده)</h3><table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;background:#fff">';
echo '<tr><th>فیلد</th><th>مقدار</th><th>وضعیت</th></tr>';
$endpoint = rtrim($cfg['endpoint'], '/');
$host = parse_url($endpoint, PHP_URL_HOST);
$region = $cfg['region'] ?? '';
$bucket = $cfg['bucket'] ?? '';
$ak = $cfg['access_key'] ?? '';
$regionOk = (strpos($region, 'arvanstorage') === false); // region نباید هاست باشد
$hostRegion = preg_match('#^s3\.([a-z0-9-]+)\.arvanstorage\.ir$#', $host, $m) ? $m[1] : '?';
echo '<tr><td>endpoint</td><td dir="ltr">' . htmlspecialchars($endpoint) . '</td><td>هاست → <b dir="ltr">' . htmlspecialchars($host) . '</b></td></tr>';
echo '<tr><td>region</td><td dir="ltr">' . htmlspecialchars($region) . '</td><td>' . ($regionOk ? '✅ ظاهراً کد منطقه است' : '❌ <b>region یک هاست کامل است! باید فقط کد منطقه باشد (مثلاً ir-thr-at1)</b>') . '</td></tr>';
echo '<tr><td>bucket</td><td dir="ltr">' . htmlspecialchars($bucket) . '</td><td></td></tr>';
echo '<tr><td>access_key</td><td dir="ltr">' . htmlspecialchars(substr($ak, 0, 8) . '…') . '</td><td></td></tr>';
echo '<tr><td>منطقهٔ inferred از endpoint</td><td dir="ltr">' . htmlspecialchars($hostRegion) . '</td><td>' . ($regionOk && $region === $hostRegion ? '✅ هم‌خوان' : ($region === $hostRegion ? '⚠️' : '❌ <b>ناهم‌خوان با region</b>')) . '</td></tr>';
echo '</table>';

/* ---------- ۲) تست وجود فایل با کانفیگ فعلی + کاندیدهای دیگر ---------- */
echo '<h3>۲) تست وجود فایل‌ها (GET با امضای presigned، Range 0-0)</h3>';

$combos = [];
$combos[] = ['name' => 'کانفیگ فعلی سرور', 'endpoint' => $endpoint, 'region' => $region];
foreach (['ir-thr-at1', 'ir-tbz-sh1'] as $r) {
    $combos[] = ['name' => "کاندید: region=$r", 'endpoint' => "https://s3.$r.arvanstorage.ir", 'region' => $r];
}

foreach ($KEYS as $key) {
    echo '<h4 dir="ltr">' . htmlspecialchars($key) . '</h4><table border="1" cellpadding="5" cellspacing="0" style="border-collapse:collapse;background:#fff">';
    echo '<tr><th>سناریو</th><th>endpoint</th><th>region در امضا</th><th>HTTP</th></tr>';
    foreach ($combos as $c) {
        $cCfg = $cfg;
        $cCfg['endpoint'] = $c['endpoint'];
        $cCfg['region'] = $c['region'];
        $r = presigned_get_code($cCfg, $key);
        $color = $r['code'] === 200 || $r['code'] === 206 ? '#059669' : ($r['code'] === 404 ? '#b91c1c' : '#d97706');
        $note = ($r['code'] === 200 || $r['code'] === 206) ? '✅ فایل اینجاست!' : ($r['code'] === 404 ? '404 — فایل این‌جا نیست' : 'کد ' . $r['code'] . ($r['err'] ? ' (' . htmlspecialchars($r['err']) . ')' : ''));
        echo '<tr><td>' . htmlspecialchars($c['name']) . '</td><td dir="ltr">' . htmlspecialchars($c['endpoint']) . '</td><td dir="ltr">' . htmlspecialchars($c['region']) . '</td><td style="color:' . $color . ';font-weight:bold">' . $note . '</td></tr>';
    }
    echo '</table>';
}

/* ---------- ۳) لیست prefix ها (با کانفیگی که فایل را پیدا کرد) ---------- */
echo '<h3>۳) لیست فایل‌های موجود در باکت (prefix: pettyPTY-1022/ و rfqinq/)</h3>';
foreach (['pettyPTY-1022/', 'rfqinq/'] as $prefix) {
    foreach ($combos as $c) {
        $cCfg = $cfg; $cCfg['endpoint'] = $c['endpoint']; $cCfg['region'] = $c['region'];
        $r = s3_req($cCfg, 'GET', '/' . $bucket, 'list-type=2&max-keys=1000&prefix=' . rawurlencode($prefix));
        if ($r['code'] !== 200) {
            echo '<p><b dir="ltr">' . htmlspecialchars($prefix) . '</b> @ ' . htmlspecialchars($c['name']) . ' → HTTP ' . $r['code'] . ' (' . htmlspecialchars(substr(strip_tags($r['body']), 0, 160)) . ')</p>';
            continue;
        }
        preg_match_all('#<Key>(.*?)</Key>#s', $r['body'], $m);
        $keys = array_map('html_entity_decode', $m[1] ?? []);
        echo '<p><b dir="ltr">' . htmlspecialchars($prefix) . '</b> @ ' . htmlspecialchars($c['name']) . ' → <b>' . count($keys) . '</b> فایل یافت شد:</p><ul dir="ltr" style="font-size:11px">';
        foreach (array_slice($keys, 0, 25) as $k) echo '<li>' . htmlspecialchars($k) . '</li>';
        if (count($keys) > 25) echo '<li>… و ' . (count($keys) - 25) . ' فایل دیگر</li>';
        echo '</ul>';
        break; // فقط اولین سناریوی موفق را نشان بده
    }
}

echo '<p style="color:#475569">— پایان گزارش. بعد از بررسی، این فایل را از هاست حذف کنید.</p>';
echo '</body></html>';
