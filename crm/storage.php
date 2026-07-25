<?php
/**
 * PTF CRM — Storage API (US-114) — اتصال آروان‌کلود S3
 * امضای درخواست‌ها: AWS Signature V4 — بدون وابستگی به SDK خارجی
 *
 * اکشن‌ها:
 *   ?action=status            → تست اتصال (لیست باکت)
 *   ?action=presign_put       → لینک موقت آپلود مستقیم مرورگر→آروان  (POST: name, type, folder)
 *   ?action=presign_get       → لینک موقت دانلود/نمایش فایل خصوصی    (POST: key)
 *   ?action=delete            → حذف فایل                              (POST: key)
 *   ?action=list              → لیست فایل‌های یک پوشه                 (POST: prefix)
 */
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

/* ---------- بارگذاری کانفیگ (خارج از webroot) ---------- */
function load_cfg() {
    $paths = [
        dirname(__DIR__, 2) . '/storage-config.php',  // یک پوشه بالاتر از webroot (توصیه‌شده)
        dirname(__DIR__, 3) . '/storage-config.php',  // دو پوشه بالاتر (برخی ساختارهای هاست)
        dirname(__DIR__) . '/storage-config.php',      // fallback: ریشه سایت (امن نیست — فقط اضطراری)
    ];
    foreach ($paths as $p) {
        if (file_exists($p)) return include $p;
    }
    return null;
}

$cfg = load_cfg();
$action = $_REQUEST['action'] ?? '';

if (!$cfg) {
    // حالت fallback: بدون کانفیگ → اعلام حالت آفلاین ابری (کلاینت روی هاست آپلود می‌کند)
    echo json_encode(['ok' => false, 'mode' => 'local-fallback',
        'error' => 'storage-config.php یافت نشد — فایل کانفیگ را طبق راهنما خارج از public_html آپلود کنید']);
    exit;
}

/* ---------- AWS Signature V4 ---------- */
function hmac($key, $data, $raw = true) { return hash_hmac('sha256', $data, $key, $raw); }

function sig_v4($cfg, $method, $key, $queryExtra = [], $expiry = 3600) {
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

    $sigKey = hmac(hmac(hmac(hmac('AWS4' . $cfg['secret_key'], $date), $cfg['region']), 's3'), 'aws4_request');
    $signature = hmac($sigKey, $stringToSign, false);

    return $cfg['endpoint'] . $uri . '?' . $canonicalQuery . '&X-Amz-Signature=' . $signature;
}

/* ---------- درخواست امضاشده سروری (برای status/delete/list) ---------- */
function s3_request($cfg, $method, $path, $query = '') {
    $host = parse_url($cfg['endpoint'], PHP_URL_HOST);
    $now = gmdate('Ymd\THis\Z');
    $date = gmdate('Ymd');
    $scope = "$date/{$cfg['region']}/s3/aws4_request";
    $payloadHash = hash('sha256', '');
    $headers = "host:$host\nx-amz-content-sha256:$payloadHash\nx-amz-date:$now\n";
    $signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
    $canonicalRequest = implode("\n", [$method, $path, $query, $headers, $signedHeaders, $payloadHash]);
    $stringToSign = implode("\n", ['AWS4-HMAC-SHA256', $now, $scope, hash('sha256', $canonicalRequest)]);
    $sigKey = hmac(hmac(hmac(hmac('AWS4' . $cfg['secret_key'], $date), $cfg['region']), 's3'), 'aws4_request');
    $signature = hmac($sigKey, $stringToSign, false);
    $auth = "AWS4-HMAC-SHA256 Credential={$cfg['access_key']}/$scope, SignedHeaders=$signedHeaders, Signature=$signature";

    $url = $cfg['endpoint'] . $path . ($query ? "?$query" : '');
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_TIMEOUT => 20,
        CURLOPT_HTTPHEADER => [
            "Authorization: $auth",
            "x-amz-content-sha256: $payloadHash",
            "x-amz-date: $now",
        ],
    ]);
    $body = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err  = curl_error($ch);
    curl_close($ch);
    return ['code' => $code, 'body' => $body, 'err' => $err];
}

/* ---------- پاکسازی نام فایل ---------- */
function safe_key($name) {
    $name = preg_replace('/[^\w\-\.\x{0600}-\x{06FF} ]/u', '_', $name);
    return trim(str_replace(' ', '-', $name), '-_.');
}

$in = json_decode(file_get_contents('php://input'), true) ?: [];

switch ($action) {

    case 'status':
        $r = s3_request($cfg, 'GET', '/' . $cfg['bucket'], 'list-type=2&max-keys=1');
        if ($r['code'] === 200) {
            echo json_encode(['ok' => true, 'mode' => 'arvan', 'bucket' => $cfg['bucket'],
                'message' => '✅ اتصال به آروان‌کلود برقرار است']);
        } else {
            echo json_encode(['ok' => false, 'mode' => 'error', 'http' => $r['code'],
                'error' => $r['code'] === 403 ? 'کلیدها نادرست است (403)' :
                          ($r['code'] === 404 ? 'صندوقچه یافت نشد (404) — نام باکت را چک کنید' :
                          'خطای اتصال: ' . ($r['err'] ?: 'HTTP ' . $r['code']))]);
        }
        break;

    case 'presign_put':
        $name = safe_key($in['name'] ?? 'file');
        $folder = preg_replace('/[^\w\-]/', '', $in['folder'] ?? 'general');
        $key = $folder . '/' . date('Y-m') . '/' . uniqid() . '-' . $name;
        $url = sig_v4($cfg, 'PUT', $key, [], min(900, $cfg['expiry'] ?? 3600));
        echo json_encode(['ok' => true, 'url' => $url, 'key' => $key, 'max_mb' => $cfg['max_mb'] ?? 25]);
        break;

    case 'presign_get':
        $key = $in['key'] ?? '';
        if (!$key) { echo json_encode(['ok' => false, 'error' => 'key لازم است']); break; }
        $url = sig_v4($cfg, 'GET', $key, [], $cfg['expiry'] ?? 3600);
        echo json_encode(['ok' => true, 'url' => $url]);
        break;

    case 'delete':
        $key = $in['key'] ?? '';
        if (!$key) { echo json_encode(['ok' => false, 'error' => 'key لازم است']); break; }
        $uri = '/' . $cfg['bucket'] . '/' . str_replace('%2F', '/', rawurlencode($key));
        $r = s3_request($cfg, 'DELETE', $uri);
        echo json_encode(['ok' => in_array($r['code'], [200, 204]), 'http' => $r['code']]);
        break;

    case 'list':
        $prefix = $in['prefix'] ?? '';
        $r = s3_request($cfg, 'GET', '/' . $cfg['bucket'],
            'list-type=2&max-keys=200&prefix=' . rawurlencode($prefix));
        if ($r['code'] !== 200) { echo json_encode(['ok' => false, 'http' => $r['code']]); break; }
        preg_match_all('#<Key>(.*?)</Key>.*?<Size>(\d+)</Size>#s', $r['body'], $m, PREG_SET_ORDER);
        $files = array_map(function ($x) { return ['key' => html_entity_decode($x[1]), 'size' => (int)$x[2]]; }, $m);
        echo json_encode(['ok' => true, 'files' => $files], JSON_UNESCAPED_UNICODE);
        break;

    default:
        echo json_encode(['ok' => false, 'error' => 'action نامعتبر']);
}
