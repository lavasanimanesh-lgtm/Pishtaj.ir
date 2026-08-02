<?php
/* PTF CRM — attachment-thumb.php — تبدیل PDF/HEIC به JPEG برای گزارش تلفیقی (BUG-PDF-ATTACH)
   ورودی: POST { key, name?, maxPages? }
   خروجی: { ok:true, images:[{key,url}] } | { ok:false, error }
   نیازمند: امکانات Imagick روی سرور (اگر نبود → error:'no_imagick' و کلاینت fallback می‌کند).
   فایل از S3 خوانده، به JPEG (صفحه‌های PDF تا maxPages) تبدیل، thumbnail در S3 آپلود و لینک presign برمی‌گردد. */
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

$ref = $_SERVER['HTTP_ORIGIN'] ?? $_SERVER['HTTP_REFERER'] ?? '';
$host = $_SERVER['HTTP_HOST'] ?? '';
if ($ref && $host && parse_url($ref, PHP_URL_HOST) !== $host) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'Cross-origin blocked'], JSON_UNESCAPED_UNICODE);
    exit;
}
require_once __DIR__ . '/auth.php';
$ident = auth_verify_token(auth_get_header_token());
if (!$ident) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'error' => 'authentication_required'], JSON_UNESCAPED_UNICODE);
    exit;
}

if (!class_exists('Imagick')) {
    echo json_encode(['ok' => false, 'error' => 'no_imagick'], JSON_UNESCAPED_UNICODE);
    exit;
}

function load_cfg() {
    $paths = [
        dirname(__DIR__, 2) . '/storage-config.php',
        dirname(__DIR__, 3) . '/storage-config.php',
        dirname(__DIR__) . '/storage-config.php',
    ];
    foreach ($paths as $p) if (file_exists($p)) return include $p;
    return null;
}
function hmac($key, $data, $raw = true) { return hash_hmac('sha256', $data, $key, $raw); }
function sig_v4($cfg, $method, $key, $queryExtra = [], $expiry = 900) {
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
    $canonicalHeaders = "host:$host\n";
    $stringToSign = implode("\n", ['AWS4-HMAC-SHA256', $now, $scope, hash('sha256', $canonicalHeaders . $canonicalQuery)]);
    $sigKey = hmac(hmac(hmac(hmac('AWS4' . $cfg['secret_key'], $date), $cfg['region']), 's3'), 'aws4_request');
    $signature = hmac($sigKey, $stringToSign, false);
    return $cfg['endpoint'] . '/' . $cfg['bucket'] . '/' . str_replace('%2F', '/', rawurlencode($key)) . '?' . $canonicalQuery . '&X-Amz-Signature=' . rawurlencode($signature);
}
function s3_get($cfg, $key) {
    $host = parse_url($cfg['endpoint'], PHP_URL_HOST);
    $now = gmdate('Ymd\THis\Z');
    $date = gmdate('Ymd');
    $scope = "$date/{$cfg['region']}/s3/aws4_request";
    $payloadHash = hash('sha256', '');
    $headers = "host:$host\nx-amz-content-sha256:$payloadHash\nx-amz-date:$now\n";
    $signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
    $canonicalRequest = implode("\n", ['GET', '/' . $cfg['bucket'] . '/' . str_replace('%2F', '/', rawurlencode($key)), '', $headers, $signedHeaders, $payloadHash]);
    $stringToSign = implode("\n", ['AWS4-HMAC-SHA256', $now, $scope, hash('sha256', $canonicalRequest)]);
    $sigKey = hmac(hmac(hmac(hmac('AWS4' . $cfg['secret_key'], $date), $cfg['region']), 's3'), 'aws4_request');
    $signature = hmac($sigKey, $stringToSign, false);
    $auth = "AWS4-HMAC-SHA256 Credential={$cfg['access_key']}/$scope, SignedHeaders=$signedHeaders, Signature=$signature";
    $url = $cfg['endpoint'] . '/' . $cfg['bucket'] . '/' . str_replace('%2F', '/', rawurlencode($key));
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => 'GET',
        CURLOPT_TIMEOUT => 30,
        CURLOPT_HTTPHEADER => ["Authorization: $auth", "x-amz-content-sha256: $payloadHash", "x-amz-date: $now"],
    ]);
    $body = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return ['code' => $code, 'body' => $body];
}
function s3_put($cfg, $key, $body) {
    $host = parse_url($cfg['endpoint'], PHP_URL_HOST);
    $now = gmdate('Ymd\THis\Z');
    $date = gmdate('Ymd');
    $scope = "$date/{$cfg['region']}/s3/aws4_request";
    $payloadHash = hash('sha256', $body);
    $headers = "host:$host\nx-amz-content-sha256:$payloadHash\nx-amz-date:$now\n";
    $signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
    $canonicalRequest = implode("\n", ['PUT', '/' . $cfg['bucket'] . '/' . str_replace('%2F', '/', rawurlencode($key)), '', $headers, $signedHeaders, $payloadHash]);
    $stringToSign = implode("\n", ['AWS4-HMAC-SHA256', $now, $scope, hash('sha256', $canonicalRequest)]);
    $sigKey = hmac(hmac(hmac(hmac('AWS4' . $cfg['secret_key'], $date), $cfg['region']), 's3'), 'aws4_request');
    $signature = hmac($sigKey, $stringToSign, false);
    $auth = "AWS4-HMAC-SHA256 Credential={$cfg['access_key']}/$scope, SignedHeaders=$signedHeaders, Signature=$signature";
    $url = $cfg['endpoint'] . '/' . $cfg['bucket'] . '/' . str_replace('%2F', '/', rawurlencode($key));
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => 'PUT',
        CURLOPT_POSTFIELDS => $body,
        CURLOPT_TIMEOUT => 30,
        CURLOPT_HTTPHEADER => ["Authorization: $auth", "x-amz-content-sha256: $payloadHash", "x-amz-date: $now", 'Content-Type: image/jpeg'],
    ]);
    curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return $code;
}

$cfg = load_cfg();
if (!$cfg) { echo json_encode(['ok' => false, 'error' => 'no_config'], JSON_UNESCAPED_UNICODE); exit; }
$in = json_decode(file_get_contents('php://input'), true) ?: [];
$key = $in['key'] ?? '';
$name = $in['name'] ?? $key;
$maxPages = min(8, max(1, (int)($in['maxPages'] ?? 8)));
if (!$key) { echo json_encode(['ok' => false, 'error' => 'key لازم است'], JSON_UNESCAPED_UNICODE); exit; }

$ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
$isPdf = $ext === 'pdf';
$isHeic = in_array($ext, ['heic', 'heif', 'heics'], true);

if (!$isPdf && !$isHeic) { echo json_encode(['ok' => false, 'error' => 'not_convertible'], JSON_UNESCAPED_UNICODE); exit; }

$g = s3_get($cfg, $key);
if ($g['code'] !== 200 || !$g['body']) { echo json_encode(['ok' => false, 'error' => 'read_failed'], JSON_UNESCAPED_UNICODE); exit; }

try {
    $im = new Imagick();
    if ($isPdf) {
        $im->setResolution(150, 150);
        $im->readImageBlob($g['body']);
    } else {
        $im->readImageBlob($g['body']);
    }
    $im->setImageBackgroundColor('white');
    $n = min($maxPages, max(1, $im->getNumberImages()));
    $images = [];
    for ($i = 0; $i < $n; $i++) {
        $frame = clone $im;
        $frame->setIteratorIndex($i);
        $frame->setImageFormat('jpeg');
        $frame->setImageCompressionQuality(82);
        /* کاهش ابعاد برای فشردگی (عرض حداکثر 1200) */
        $w = $frame->getImageWidth();
        if ($w > 1200) $frame->resizeImage(1200, 0, Imagick::FILTER_LANCZOS, 1);
        $frame->stripImage();
        $jpeg = $frame->getImageBlob();
        $thumbKey = 'thumbs/' . $key . ($n > 1 ? '.p' . ($i + 1) : '') . '.jpg';
        s3_put($cfg, $thumbKey, $jpeg);
        $images[] = ['key' => $thumbKey, 'url' => sig_v4($cfg, 'GET', $thumbKey)];
        $frame->clear();
    }
    $im->clear();
    echo json_encode(['ok' => true, 'images' => $images], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    echo json_encode(['ok' => false, 'error' => 'convert_failed', 'detail' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
}
