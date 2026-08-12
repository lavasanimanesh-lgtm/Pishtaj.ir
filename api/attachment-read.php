<?php
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');

/* v34.0.7-alpha (باگ پروداکشن ضمیمه + SEC-01): این endpoint قبلاً هیچ گارد احرازی
   نداشت و به همین دلیل در api/.htaccess بلاک شده بود (و در نتیجه خواندن محتوای
   پیوست‌ها در درخواست‌ها/پرونده‌ها/تنخواه در پروداکشن 403 می‌گرفت). حالا به‌مانند
   بقیهٔ endpointها توکن معتبر راستی‌آزمایی می‌شود تا بتوان بدون نگرانی آن را فعال کرد. */
require_once __DIR__ . '/auth.php';
$arIdentity = auth_verify_token(auth_get_header_token());
if (!$arIdentity) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'error' => 'authentication_required'], JSON_UNESCAPED_UNICODE);
    exit;
}
$arRole = strtolower((string)($arIdentity['role'] ?? ''));
$arAllowedRoles = ['admin', 'chairman', 'ceo', 'commercial', 'sales', 'buyer', 'accountant', 'collector'];
if (!in_array($arRole, $arAllowedRoles, true)) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'permission_denied'], JSON_UNESCAPED_UNICODE);
    exit;
}

$ref = $_SERVER['HTTP_ORIGIN'] ?? $_SERVER['HTTP_REFERER'] ?? '';
$host = $_SERVER['HTTP_HOST'] ?? '';
if ($ref && $host && parse_url($ref, PHP_URL_HOST) !== $host) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'Cross-origin blocked'], JSON_UNESCAPED_UNICODE);
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
function hmac2($key, $data, $raw = true) { return hash_hmac('sha256', $data, $key, $raw); }
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
    $uri = '/' . $cfg['bucket'] . '/' . str_replace('%2F', '/', rawurlencode($key));
    $canonicalRequest = implode("\n", [$method, $uri, $canonicalQuery, "host:$host\n", 'host', 'UNSIGNED-PAYLOAD']);
    $stringToSign = implode("\n", ['AWS4-HMAC-SHA256', $now, $scope, hash('sha256', $canonicalRequest)]);
    $sigKey = hmac2(hmac2(hmac2(hmac2('AWS4' . $cfg['secret_key'], $date), $cfg['region']), 's3'), 'aws4_request');
    $signature = hmac2($sigKey, $stringToSign, false);
    return rtrim($cfg['endpoint'], '/') . $uri . '?' . $canonicalQuery . '&X-Amz-Signature=' . $signature;
}
function http_get_bin($url) {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 45,
        CURLOPT_CONNECTTIMEOUT => 8,
        CURLOPT_FOLLOWLOCATION => true,
        // v31.7.4 BUG-AUDIT-006 FIXED: Enable SSL verification for security
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
        CURLOPT_USERAGENT => 'Mozilla/5.0 (PTF-CRM attachment-read)'
    ]);
    $body = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);
    return ['ok' => ($code >= 200 && $code < 300 && $body !== false), 'body' => $body, 'http' => $code, 'error' => $err];
}
function clean_text($s) {
    $s = str_replace(["\r\n", "\r"], "\n", (string)$s);
    $s = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/', '', $s);
    $s = html_entity_decode(strip_tags($s), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $s = preg_replace('/[\t ]+/u', ' ', $s);
    $s = preg_replace('/\n{3,}/u', "\n\n", $s);
    return trim($s);
}
function ext_of($name) {
    $n = strtolower((string)$name);
    $n = preg_replace('/[?#].*$/', '', $n);
    return pathinfo($n, PATHINFO_EXTENSION);
}
function inline_mime_of($ext) {
    $map = [
        'jpg'=>'image/jpeg', 'jpeg'=>'image/jpeg', 'png'=>'image/png',
        'gif'=>'image/gif', 'webp'=>'image/webp', 'bmp'=>'image/bmp',
        'pdf'=>'application/pdf',
        'heic'=>'image/heic', 'heif'=>'image/heif', 'heics'=>'image/heic'
    ];
    return $map[strtolower((string)$ext)] ?? '';
}
function xlsx_extract_text($bin) {
    if (!class_exists('ZipArchive')) return ['ok' => false, 'error' => 'ZipArchive unavailable'];
    $tmp = tempnam(sys_get_temp_dir(), 'ptf_xlsx_');
    file_put_contents($tmp, $bin);
    $zip = new ZipArchive();
    if ($zip->open($tmp) !== true) { @unlink($tmp); return ['ok' => false, 'error' => 'Cannot open xlsx']; }
    $shared = [];
    $ss = $zip->getFromName('xl/sharedStrings.xml');
    if ($ss) {
      $xml = @simplexml_load_string($ss);
      if ($xml && isset($xml->si)) {
        foreach ($xml->si as $si) {
          $txt = '';
          if (isset($si->t)) $txt .= (string)$si->t;
          if (isset($si->r)) foreach ($si->r as $r) $txt .= (string)$r->t;
          $shared[] = clean_text($txt);
        }
      }
    }
    $sheet = $zip->getFromName('xl/worksheets/sheet1.xml');
    if (!$sheet) {
      for ($i=1;$i<=3 && !$sheet;$i++) $sheet = $zip->getFromName('xl/worksheets/sheet'.$i.'.xml');
    }
    if (!$sheet) { $zip->close(); @unlink($tmp); return ['ok' => false, 'error' => 'No worksheet found']; }
    $xml = @simplexml_load_string($sheet);
    if (!$xml) { $zip->close(); @unlink($tmp); return ['ok' => false, 'error' => 'Worksheet parse failed']; }
    $xml->registerXPathNamespace('x', 'http://schemas.openxmlformats.org/spreadsheetml/2006/main');
    $rows = [];
    foreach ($xml->xpath('//x:sheetData/x:row') as $row) {
      $cells = [];
      foreach ($row->c as $c) {
        $t = (string)$c['t'];
        $v = isset($c->v) ? (string)$c->v : '';
        if ($t === 's') {
          $idx = (int)$v;
          $cells[] = $shared[$idx] ?? '';
        } else {
          $cells[] = $v;
        }
      }
      if ($cells) $rows[] = implode(' | ', array_map('clean_text', $cells));
      if (count($rows) >= 40) break;
    }
    $zip->close(); @unlink($tmp);
    return ['ok' => true, 'text' => clean_text(implode("\n", $rows))];
}
function docx_extract_text($bin) {
    if (!class_exists('ZipArchive')) return ['ok' => false, 'error' => 'ZipArchive unavailable'];
    $tmp = tempnam(sys_get_temp_dir(), 'ptf_docx_');
    file_put_contents($tmp, $bin);
    $zip = new ZipArchive();
    if ($zip->open($tmp) !== true) { @unlink($tmp); return ['ok' => false, 'error' => 'Cannot open docx']; }
    $parts = [];
    foreach (['word/document.xml','word/header1.xml','word/footer1.xml'] as $f) {
      $x = $zip->getFromName($f);
      if ($x) $parts[] = clean_text(str_replace(['</w:p>','</w:tr>'], ["\n", "\n"], $x));
    }
    $zip->close(); @unlink($tmp);
    $text = clean_text(implode("\n\n", $parts));
    return $text ? ['ok' => true, 'text' => $text] : ['ok' => false, 'error' => 'No readable text in docx'];
}

$cfg = load_cfg();
if (!$cfg || empty($cfg['endpoint']) || empty($cfg['bucket']) || empty($cfg['access_key']) || empty($cfg['secret_key'])) {
    echo json_encode(['ok' => false, 'error' => 'storage config missing'], JSON_UNESCAPED_UNICODE);
    exit;
}
if (!preg_match('#^https?://#i', $cfg['endpoint'])) $cfg['endpoint'] = 'https://' . rtrim($cfg['endpoint'], '/');

$in = json_decode(file_get_contents('php://input'), true) ?: [];
$key = trim((string)($in['key'] ?? ''));
$name = trim((string)($in['name'] ?? ''));
if (!$key) {
    echo json_encode(['ok' => false, 'error' => 'key required'], JSON_UNESCAPED_UNICODE);
    exit;
}
$ext = ext_of($name ?: $key);
$mode = strtolower(trim((string)($in['mode'] ?? 'text')));
$url = sig_v4($cfg, 'GET', $key, [], 600);
$res = http_get_bin($url);
if (!$res['ok']) {
    echo json_encode(['ok' => false, 'error' => 'download failed', 'http' => $res['http'], 'detail' => $res['error']], JSON_UNESCAPED_UNICODE);
    exit;
}
$bin = $res['body'];

/* v34.4.36: مسیر نمایش same-origin برای viewer. این مسیر MIME خراب objectهای قدیمی
   S3 را اصلاح می‌کند و وابسته به CORS یا Content-Disposition ذخیره‌شدهٔ باکت نیست.
   فقط raster image/PDF inline می‌شوند؛ SVG/HTML عمداً از origin برنامه سرو نمی‌شوند. */
if ($mode === 'inline') {
    $mime = inline_mime_of($ext);
    if (!$mime) {
        http_response_code(415);
        echo json_encode(['ok' => false, 'error' => 'inline_unsupported', 'ext' => $ext], JSON_UNESCAPED_UNICODE);
        exit;
    }
    $maxInline = max(1, (int)($cfg['max_mb'] ?? 25)) * 1048576;
    if (strlen($bin) > $maxInline) {
        http_response_code(413);
        echo json_encode(['ok' => false, 'error' => 'inline_too_large'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    header_remove('Content-Type');
    header('Content-Type: ' . $mime);
    header('Content-Disposition: inline');
    header('Content-Length: ' . strlen($bin));
    header('Cache-Control: private, no-store, max-age=0');
    echo $bin;
    exit;
}

/* v25.9: انتقال کنترل‌شدهٔ فایل S3 به OCR بدون وابستگی به CORS مرورگر.
   فقط فرمت‌های لازم و حداکثر 6MB؛ کلید/URL امضاشده هرگز به پاسخ برنمی‌گردد. */
if ($mode === 'base64') {
    $mimeMap = ['pdf'=>'application/pdf','jpg'=>'image/jpeg','jpeg'=>'image/jpeg','png'=>'image/png','webp'=>'image/webp','gif'=>'image/gif','bmp'=>'image/bmp','heic'=>'image/heic','heif'=>'image/heif','heics'=>'image/heic','xlsx'=>'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','xls'=>'application/vnd.ms-excel'];
    if (!isset($mimeMap[$ext])) {
        echo json_encode(['ok' => false, 'error' => 'unsupported for AI read', 'ext' => $ext], JSON_UNESCAPED_UNICODE);
        exit;
    }
    if (strlen($bin) > 6 * 1048576) {
        echo json_encode(['ok' => false, 'error' => 'file exceeds 6MB AI read limit'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    echo json_encode(['ok' => true, 'mode' => 'base64', 'mime' => $mimeMap[$ext], 'b64' => base64_encode($bin)], JSON_UNESCAPED_UNICODE);
    exit;
}

if (in_array($ext, ['txt','md','csv','json','xml','html','htm'])) {
    $txt = clean_text($bin);
    echo json_encode(['ok' => true, 'mode' => 'text', 'text' => $txt], JSON_UNESCAPED_UNICODE);
    exit;
}
if (in_array($ext, ['docx'])) {
    echo json_encode(docx_extract_text($bin), JSON_UNESCAPED_UNICODE);
    exit;
}
if (in_array($ext, ['xlsx'])) {
    echo json_encode(xlsx_extract_text($bin), JSON_UNESCAPED_UNICODE);
    exit;
}

echo json_encode(['ok' => false, 'error' => 'unsupported', 'ext' => $ext], JSON_UNESCAPED_UNICODE);
