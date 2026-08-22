<?php
/* =====================================================================
   PTF — api/zip-attachments.php — v34.7.77 (RFQ-ZIP-DL)
   دانلود گروهی ضمایم درخواست (RFQ) به‌صورت یک فایل ZIP.
   چرا سروری؟ چون فایل‌ها در فضای ابری (آروان) خصوصی‌اند و فقط با URL امضاشده
   قابل خواندن هستند؛ این endpoint برای هر کلید یک GET امضاشده می‌گیرد، بایت‌ها را
   داخل یک ZIP می‌چیند و یک‌جا stream می‌کند — کاربر لازم نیست تکتک دانلود کند.
   امنیت: احراز توکن + نقش مجاز + بررسی منشأ + allowlist سخت‌گیرانهٔ پیشوند کلید
   (فقط rfqatt/، rfq/ و site-rfq/)؛ کلید دلخواهِ مالی/پرونده از این مسیر قابل دانلود نیست.
   ===================================================================== */
header('X-Content-Type-Options: nosniff');

require_once __DIR__ . '/auth.php';

$zIdentity = auth_verify_token(auth_get_header_token());
if (!$zIdentity) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'error' => 'authentication_required'], JSON_UNESCAPED_UNICODE);
    exit;
}
$zRole = strtolower((string)($zIdentity['role'] ?? ''));
$zAllowedRoles = ['admin', 'chairman', 'ceo', 'commercial', 'sales', 'buyer', 'accountant', 'collector'];
if (!in_array($zRole, $zAllowedRoles, true)) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'permission_denied'], JSON_UNESCAPED_UNICODE);
    exit;
}

$zRef = $_SERVER['HTTP_ORIGIN'] ?? $_SERVER['HTTP_REFERER'] ?? '';
$zHost = $_SERVER['HTTP_HOST'] ?? '';
if ($zRef && $zHost && parse_url($zRef, PHP_URL_HOST) !== $zHost) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'Cross-origin blocked'], JSON_UNESCAPED_UNICODE);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'method_not_allowed'], JSON_UNESCAPED_UNICODE);
    exit;
}

function zload_cfg() {
    $paths = [
        dirname(__DIR__, 2) . '/storage-config.php',
        dirname(__DIR__, 3) . '/storage-config.php',
        dirname(__DIR__) . '/storage-config.php',
    ];
    foreach ($paths as $p) if (file_exists($p)) return include $p;
    return null;
}
function zsig_v4($cfg, $method, $key, $queryExtra = [], $expiry = 600) {
    $host = parse_url($cfg['endpoint'], PHP_URL_HOST);
    $now = gmdate('Ymd\\THis\\Z');
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
    $sigKey = hash_hmac('sha256', hash_hmac('sha256', hash_hmac('sha256', hash_hmac('sha256', 'AWS4' . $cfg['secret_key'], $date, true), $cfg['region'], true), 's3', true), 'aws4_request', true);
    $signature = hash_hmac('sha256', $sigKey, $stringToSign, false);
    return rtrim($cfg['endpoint'], '/') . $uri . '?' . $canonicalQuery . '&X-Amz-Signature=' . $signature;
}
function zhttp_get_bin($url) {
    if (!function_exists('curl_init')) return ['ok' => false, 'http' => 0, 'error' => 'cURL unavailable'];
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 60,
        CURLOPT_CONNECTTIMEOUT => 8,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
        CURLOPT_USERAGENT => 'Mozilla/5.0 (PTF-CRM zip-attachments)'
    ]);
    $body = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);
    return ['ok' => ($code >= 200 && $code < 300 && $body !== false), 'body' => $body, 'http' => $code, 'error' => $err];
}
function zsafe_name($name, $fallback) {
    $n = basename(str_replace('\\', '/', trim((string)$name)));
    $n = preg_replace('/[\x00-\x1F\x7F]/u', '', $n);
    $n = trim($n, " .");
    if ($n === '' || $n === '.' || $n === '..') $n = (string)$fallback;
    if (function_exists('mb_substr') && mb_strlen($n, 'UTF-8') > 160) $n = mb_substr($n, 0, 150, 'UTF-8') . '_' . substr(md5($name), 0, 6);
    return $n;
}
function zstore_zip($entries, $tmpPath) {
    /* فال‌بک بدون ZipArchive — روش STORE (بدون فشرده‌سازی) با پرچم UTF-8 برای نام فارسی */
    $dosDate = (((int)date('Y') - 1980) << 9) | ((int)date('n') << 5) | (int)date('j');
    $dosTime = ((int)date('G') << 11) | ((int)date('i') << 5) | ((int)((int)date('s') / 2));
    $dataBlob = ''; $central = ''; $offset = 0; $count = 0;
    foreach ($entries as $e) {
        $name = $e['name']; $data = $e['data'];
        $crc = strrev(pack('H*', hash('crc32b', $data)));
        $size = strlen($data); $nlen = strlen($name);
        $local = pack('V', 0x04034b50)
               . pack('v', 20) . pack('v', 0x0800) . pack('v', 0)
               . pack('v', $dosTime) . pack('v', $dosDate)
               . $crc . pack('V', $size) . pack('V', $size)
               . pack('v', $nlen) . pack('v', 0)
               . $name . $data;
        $central .= pack('V', 0x02014b50)
                  . pack('v', 20) . pack('v', 20) . pack('v', 0x0800) . pack('v', 0)
                  . pack('v', $dosTime) . pack('v', $dosDate)
                  . $crc . pack('V', $size) . pack('V', $size)
                  . pack('v', $nlen) . pack('v', 0) . pack('v', 0)
                  . pack('v', 0) . pack('v', 0) . pack('V', 0)
                  . pack('V', $offset)
                  . $name;
        $dataBlob .= $local;
        $offset += strlen($local);
        $count++;
    }
    $eocd = pack('V', 0x06054b50)
          . pack('v', 0) . pack('v', 0)
          . pack('v', $count) . pack('v', $count)
          . pack('V', strlen($central))
          . pack('V', $offset)
          . pack('v', 0);
    return @file_put_contents($tmpPath, $dataBlob . $central . $eocd) !== false;
}
function zbuild_zip($entries, $tmpPath) {
    if (class_exists('ZipArchive')) {
        $zip = new ZipArchive();
        if ($zip->open($tmpPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) === true) {
            foreach ($entries as $e) $zip->addFromString($e['name'], $e['data']);
            $zip->close();
            return true;
        }
        return false;
    }
    return zstore_zip($entries, $tmpPath);
}

$zCfg = zload_cfg();
if (!$zCfg || empty($zCfg['endpoint']) || empty($zCfg['bucket']) || empty($zCfg['access_key']) || empty($zCfg['secret_key'])) {
    http_response_code(503);
    echo json_encode(['ok' => false, 'error' => 'storage config missing'], JSON_UNESCAPED_UNICODE);
    exit;
}
if (!preg_match('#^https?://#i', $zCfg['endpoint'])) $zCfg['endpoint'] = 'https://' . rtrim($zCfg['endpoint'], '/');

$zIn = json_decode(file_get_contents('php://input'), true) ?: [];
$zFiles = is_array($zIn['files'] ?? null) ? $zIn['files'] : [];
if (!$zFiles) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'files required'], JSON_UNESCAPED_UNICODE);
    exit;
}
if (count($zFiles) > 60) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'too many files (max 60)'], JSON_UNESCAPED_UNICODE);
    exit;
}

/* allowlist سخت‌گیرانهٔ پیشوند — فقط ضمایم درخواست (CRM + سایت)، نه سند مالی/پرونده.
   rfqatt/ = مدیریت پیوست درخواست؛ rfq/ = فرم «ثبت درخواست جدید» (rfq/inq|ds|img|dwg|oth)؛
   site-rfq/ = ضمیمهٔ استعلام ثبت‌شده از سایت. */
$zEntries = [];
$zSeen = [];
$zTotal = 0;
$zMaxTotal = 200 * 1048576; /* سقف ایمنی ۲۰۰MB مجموع */
foreach ($zFiles as $zF) {
    $key = ltrim(trim((string)($zF['key'] ?? '')), '/');
    if ($key === '' || strlen($key) > 500 || strpos($key, '..') !== false) continue;
    if (!preg_match('#^(rfqatt|rfq|site-rfq)/#', $key)) continue;
    if (isset($zSeen[$key])) continue;
    $zSeen[$key] = true;
    $name = zsafe_name($zF['name'] ?? '', basename($key) ?: 'پیوست');
    $res = zhttp_get_bin(zsig_v4($zCfg, 'GET', $key, [], 600));
    if (!$res['ok']) continue; /* فایل حذف‌شده/ناموجود → رد و ادامه */
    $zTotal += strlen($res['body']);
    if ($zTotal > $zMaxTotal) break;
    $zEntries[] = ['key' => $key, 'name' => $name, 'data' => $res['body']];
}

if (!$zEntries) {
    http_response_code(404);
    echo json_encode(['ok' => false, 'error' => 'هیچ فایل قابل دانلودی یافت نشد (فایل‌ها در فضای ابری در دسترس نیستند)'], JSON_UNESCAPED_UNICODE);
    exit;
}

/* یکتاسازی نام فایل‌ها داخل ZIP */
$zNameCount = [];
foreach ($zEntries as &$zE) {
    $n = $zE['name'];
    if (isset($zNameCount[$n])) {
        $zNameCount[$n]++;
        $ext = pathinfo($n, PATHINFO_EXTENSION);
        $base = $ext === '' ? $n : substr($n, 0, -(strlen($ext) + 1));
        $zE['name'] = $base . ' (' . $zNameCount[$n] . ')' . ($ext !== '' ? '.' . $ext : '');
    } else {
        $zNameCount[$n] = 1;
    }
}
unset($zE);

$zTmp = tempnam(sys_get_temp_dir(), 'ptf_zip_');
if ($zTmp === false || !zbuild_zip($zEntries, $zTmp)) {
    if ($zTmp !== false) @unlink($zTmp);
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'ساخت فایل ZIP روی سرور ناموفق بود'], JSON_UNESCAPED_UNICODE);
    exit;
}

$zBase = preg_replace('/[^A-Za-z0-9._-]+/', '-', trim((string)($zIn['base'] ?? 'rfq-attachments')));
$zBase = $zBase !== '' ? $zBase : 'rfq-attachments';

header('Content-Type: application/zip');
header('Content-Disposition: attachment; filename="' . $zBase . '.zip"');
header('Content-Length: ' . filesize($zTmp));
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
readfile($zTmp);
@unlink($zTmp);
exit;
