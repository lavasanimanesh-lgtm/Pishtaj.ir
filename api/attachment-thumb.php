<?php
/* PTF CRM — attachment-thumb.php
   فاز ۱ (فعال): استخراج JPEG توکار از PDF اسکن‌شده بدون Imagick/CDN/AI.
   فاز ۲ (اختیاری): اگر Imagick روی هاست بود، رستر کامل PDF متنی.
   فاز ۳ (عمداً غیرفعال): LLM تصویر رسید تولید نمی‌کند و توکن می‌سوزاند؛
      تبدیل یک‌باره اینجا ذخیره می‌شود تا گزارش بعدی تبدیل نشود.
   ورودی: POST { key, name?, maxPages? }
   خروجی: { ok, images:[{key,url,b64}], persisted:true } | { ok:false, error } */
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
function sig_v4($cfg, $key, $expiry = 900) {
    $host = parse_url($cfg['endpoint'], PHP_URL_HOST);
    $now = gmdate('Ymd\\THis\\Z');
    $date = gmdate('Ymd');
    $scope = "$date/{$cfg['region']}/s3/aws4_request";
    $credential = $cfg['access_key'] . '/' . $scope;
    $query = [
        'X-Amz-Algorithm' => 'AWS4-HMAC-SHA256',
        'X-Amz-Credential' => $credential,
        'X-Amz-Date' => $now,
        'X-Amz-Expires' => $expiry,
        'X-Amz-SignedHeaders' => 'host',
    ];
    ksort($query);
    $canonicalQuery = http_build_query($query, '', '&', PHP_QUERY_RFC3986);
    $uri = '/' . $cfg['bucket'] . '/' . str_replace('%2F', '/', rawurlencode($key));
    $canonicalRequest = implode("\n", ['GET', $uri, $canonicalQuery, "host:$host\n", 'host', 'UNSIGNED-PAYLOAD']);
    $stringToSign = implode("\n", ['AWS4-HMAC-SHA256', $now, $scope, hash('sha256', $canonicalRequest)]);
    $sigKey = hmac(hmac(hmac(hmac('AWS4' . $cfg['secret_key'], $date), $cfg['region']), 's3'), 'aws4_request');
    $signature = hmac($sigKey, $stringToSign, false);
    return rtrim($cfg['endpoint'], '/') . $uri . '?' . $canonicalQuery . '&X-Amz-Signature=' . $signature;
}
function s3_get($cfg, $key) {
    $url = sig_v4($cfg, $key, 600);
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 45,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
    ]);
    $body = curl_exec($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return ['code' => $code, 'body' => $body];
}
function s3_put($cfg, $key, $body) {
    $host = parse_url($cfg['endpoint'], PHP_URL_HOST);
    $now = gmdate('Ymd\\THis\\Z');
    $date = gmdate('Ymd');
    $scope = "$date/{$cfg['region']}/s3/aws4_request";
    $payloadHash = hash('sha256', $body);
    $headers = "host:$host\nx-amz-content-sha256:$payloadHash\nx-amz-date:$now\n";
    $signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
    $uri = '/' . $cfg['bucket'] . '/' . str_replace('%2F', '/', rawurlencode($key));
    $canonicalRequest = implode("\n", ['PUT', $uri, '', $headers, $signedHeaders, $payloadHash]);
    $stringToSign = implode("\n", ['AWS4-HMAC-SHA256', $now, $scope, hash('sha256', $canonicalRequest)]);
    $sigKey = hmac(hmac(hmac(hmac('AWS4' . $cfg['secret_key'], $date), $cfg['region']), 's3'), 'aws4_request');
    $signature = hmac($sigKey, $stringToSign, false);
    $auth = "AWS4-HMAC-SHA256 Credential={$cfg['access_key']}/$scope, SignedHeaders=$signedHeaders, Signature=$signature";
    $url = rtrim($cfg['endpoint'], '/') . $uri;
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => 'PUT',
        CURLOPT_POSTFIELDS => $body,
        CURLOPT_TIMEOUT => 45,
        CURLOPT_HTTPHEADER => ["Authorization: $auth", "x-amz-content-sha256: $payloadHash", "x-amz-date: $now", 'Content-Type: image/jpeg', 'Content-Disposition: inline'],
    ]);
    curl_exec($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return $code;
}
function extract_embedded_jpegs($bin, $maxPages) {
    $out = [];
    $n = strlen($bin);
    $i = 0;
    while ($i < $n - 3 && count($out) < $maxPages) {
        if (ord($bin[$i]) === 0xFF && ord($bin[$i + 1]) === 0xD8 && ord($bin[$i + 2]) === 0xFF) {
            $j = $i + 3;
            while ($j < $n - 1) {
                if (ord($bin[$j]) === 0xFF && ord($bin[$j + 1]) === 0xD9) { $j += 2; break; }
                $j++;
            }
            $len = $j - $i;
            if ($len > 4000 && $len < 12 * 1048576) {
                $out[] = substr($bin, $i, $len);
                $i = $j;
                continue;
            }
        }
        $i++;
    }
    return $out;
}

$cfg = load_cfg();
if (!$cfg) { echo json_encode(['ok' => false, 'error' => 'no_config'], JSON_UNESCAPED_UNICODE); exit; }
$in = json_decode(file_get_contents('php://input'), true) ?: [];
$key = trim((string)($in['key'] ?? ''));
$name = trim((string)($in['name'] ?? $key));
$maxPages = min(8, max(1, (int)($in['maxPages'] ?? 4)));
if ($key === '') { echo json_encode(['ok' => false, 'error' => 'key لازم است'], JSON_UNESCAPED_UNICODE); exit; }

$ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
if ($ext === '') $ext = strtolower(pathinfo($key, PATHINFO_EXTENSION));
$g = s3_get($cfg, $key);
if ($g['code'] !== 200 || !$g['body']) {
    echo json_encode(['ok' => false, 'error' => 'read_failed'], JSON_UNESCAPED_UNICODE);
    exit;
}
$bin = $g['body'];
$head = substr($bin, 0, 4);
$isJpeg = strlen($bin) > 3 && ord($bin[0]) === 0xFF && ord($bin[1]) === 0xD8;
$isPdf = $head === '%PDF' || $ext === 'pdf';

$jpegs = [];
if ($isJpeg) $jpegs = [$bin];
elseif ($isPdf) $jpegs = extract_embedded_jpegs($bin, $maxPages);

if (!$jpegs && class_exists('Imagick') && $isPdf) {
    try {
        $im = new Imagick();
        $im->setResolution(120, 120);
        $im->readImageBlob($bin);
        $im->setImageBackgroundColor('white');
        $n = min($maxPages, max(1, $im->getNumberImages()));
        for ($i = 0; $i < $n; $i++) {
            $frame = clone $im;
            $frame->setIteratorIndex($i);
            $frame->setImageFormat('jpeg');
            $frame->setImageCompressionQuality(80);
            if ($frame->getImageWidth() > 1200) $frame->resizeImage(1200, 0, Imagick::FILTER_LANCZOS, 1);
            $frame->stripImage();
            $jpegs[] = $frame->getImageBlob();
            $frame->clear();
        }
        $im->clear();
    } catch (Throwable $e) {
        $jpegs = [];
    }
}

if (!$jpegs) {
    echo json_encode(['ok' => false, 'error' => 'no_embedded_jpeg', 'hint' => 'این PDF تصویر اسکن‌شده ندارد؛ LLM تصویر وفادار نمی‌سازد'], JSON_UNESCAPED_UNICODE);
    exit;
}

$images = [];
foreach ($jpegs as $i => $jpeg) {
    $thumbKey = 'previews/' . preg_replace('#^previews/#', '', $key) . ($i ? ('.p' . ($i + 1)) : '') . '.jpg';
    $code = s3_put($cfg, $thumbKey, $jpeg);
    $images[] = [
        'key' => $thumbKey,
        'url' => 'data:image/jpeg;base64,' . base64_encode($jpeg),
        'stored' => ($code >= 200 && $code < 300),
        'http' => $code,
    ];
}
echo json_encode(['ok' => true, 'images' => $images, 'persisted' => true, 'engine' => $isJpeg ? 'passthrough' : 'embedded_jpeg'], JSON_UNESCAPED_UNICODE);
