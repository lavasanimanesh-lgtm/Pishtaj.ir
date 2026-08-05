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

require_once __DIR__ . '/auth.php';
header('Cache-Control: no-store');
$storageIdentity = auth_verify_token(auth_get_header_token());
if (!$storageIdentity) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'error' => 'authentication_required']);
    exit;
}
$storageRole = strtolower((string)($storageIdentity['role'] ?? ''));
$action = $_REQUEST['action'] ?? '';
/* v33.0.1: authenticated role policy. Non-destructive object operations are
   available to senior CRM roles; destructive/bulk operations remain limited to
   accountable top roles until record-level authorization is expanded.

   v34.0.7-alpha (باگ پروداکشن ضمیمه): خواندن/پیش‌نمایش/آپلود ضمیمه باید برای همهٔ
   نقش‌های احرازشده باز باشد — در غیر این صورت sales/buyer/accountant/collector که
   ضمیمهٔ درخواست‌ها/پرونده‌ها/تنخواه را ثبت و باز می‌کنند، از storage.php پیام 403
   می‌گرفتند و فایل‌های پیوست لود نمی‌شد. عملیات مخرب همچنان محدود به admin/chairman است. */
$storageAllRoles = ['admin', 'chairman', 'ceo', 'commercial', 'sales', 'buyer', 'accountant', 'collector'];
$storageSeniorRoles = ['admin', 'chairman', 'ceo', 'commercial'];
$storageDangerRoles = ['admin', 'chairman'];
$storageDangerActions = ['delete', 'delete_batch', 'archive_zip', 'backup_prune'];
$storageBackupActions = ['presign_put_backup'];
/* عملیات مخرب → فقط admin/chairman؛ عملیات بک‌آپ نوشتنی → نقش‌های ارشد؛
   خواندن/پیش‌نمایش/آپلود ضمیمه → همهٔ نقش‌های احرازشده. */
if (in_array($action, $storageDangerActions, true)) {
    $storageAllowedRoles = $storageDangerRoles;
} elseif (in_array($action, $storageBackupActions, true)) {
    $storageAllowedRoles = $storageSeniorRoles;
} else {
    $storageAllowedRoles = $storageAllRoles;
}
if (!in_array($storageRole, $storageAllowedRoles, true)) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'permission_denied']);
    exit;
}

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

// نرمال‌سازی endpoint: اگر https:// جا افتاده بود، خودمان اضافه می‌کنیم
if ($cfg && !empty($cfg['endpoint'])) {
    $cfg['endpoint'] = rtrim($cfg['endpoint'], '/');
    if (!preg_match('#^https?://#i', $cfg['endpoint'])) {
        $cfg['endpoint'] = 'https://' . $cfg['endpoint'];
    }
}

/* ---------- US-145 AC4: اکشن‌های حساس فقط از خود دامنه ---------- */
$SENSITIVE_ACTIONS = ['delete', 'delete_batch', 'list', 'usage', 'archive_zip', 'backup_prune']; // v122.3: هرس بک‌آپ ابری هم فقط از خود دامنه (فراخوانی سرور-به-سرور Origin ندارد و عبور می‌کند)
if (in_array($action, $SENSITIVE_ACTIONS, true)) {
    $ref = $_SERVER['HTTP_ORIGIN'] ?? $_SERVER['HTTP_REFERER'] ?? '';
    $host = $_SERVER['HTTP_HOST'] ?? '';
    if ($ref && $host && parse_url($ref, PHP_URL_HOST) !== $host) {
        http_response_code(403);
        echo json_encode(['ok' => false, 'error' => 'Cross-origin request blocked']);
        exit;
    }
}

if (!$cfg) {
    // بدون کانفیگ: سیاست ابری اجباری است؛ هیچ مسیر آپلود دائمی روی هاست وجود ندارد
    echo json_encode(['ok' => false, 'mode' => 'cloud-required',
        'error' => 'storage-config.php یافت نشد — طبق سیاست فعلی فایل روی هاست ذخیره نمی‌شود؛ کانفیگ را طبق راهنما خارج از public_html آپلود کنید']);
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
    $opts = [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_TIMEOUT => 20,
        CURLOPT_HTTPHEADER => [
            "Authorization: $auth",
            "x-amz-content-sha256: $payloadHash",
            "x-amz-date: $now",
        ],
    ];
    /* v34.0.18-alpha: HEAD (برای بررسی وجود فایل) — بدون body */
    if (strtoupper($method) === 'HEAD') { $opts[CURLOPT_NOBODY] = true; $opts[CURLOPT_CUSTOMREQUEST] = 'HEAD'; }
    curl_setopt_array($ch, $opts);
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

    /* ===== US-282 (v122.3): بک‌آپ ابری با کلید ثابت — جایگزین قبلی، بدون انباشت ===== */
    case 'presign_put_backup':
        $name = safe_key($in['name'] ?? 'crm-backup-latest.json.gz');
        if (!preg_match('/^crm-backup-(latest|monthly)\.json(\.gz)?$/', $name)) {
            echo json_encode(['ok' => false, 'error' => 'نام بک‌آپ نامعتبر']); break;
        }
        $key = 'backups/' . $name; // کلید ثابت: PUT بعدی همیشه جایگزین قبلی می‌شود (S3 overwrite)
        $url = sig_v4($cfg, 'PUT', $key, [], min(900, $cfg['expiry'] ?? 3600));
        echo json_encode(['ok' => true, 'url' => $url, 'key' => $key]);
        break;

    /* ===== US-282: هرس ابری — هر فایلی زیر backups/ جز ۲ کلید ثابت حذف شود ===== */
    case 'backup_prune':
        $keep = ['backups/crm-backup-latest.json.gz', 'backups/crm-backup-monthly.json.gz',
                 'backups/crm-backup-latest.json',    'backups/crm-backup-monthly.json'];
        $r = s3_request($cfg, 'GET', '/' . $cfg['bucket'], 'list-type=2&max-keys=1000&prefix=' . rawurlencode('backups/'));
        if ($r['code'] !== 200) { echo json_encode(['ok' => false, 'http' => $r['code']]); break; }
        preg_match_all('#<Key>(.*?)</Key>#s', $r['body'], $m);
        $deleted = 0;
        foreach (($m[1] ?? []) as $k) {
            $k = html_entity_decode($k);
            if (in_array($k, $keep, true)) continue;
            $uri = '/' . $cfg['bucket'] . '/' . str_replace('%2F', '/', rawurlencode($k));
            $d = s3_request($cfg, 'DELETE', $uri);
            if (in_array($d['code'], [200, 204])) $deleted++;
        }
        echo json_encode(['ok' => true, 'deleted' => $deleted]);
        break;

    case 'presign_get':
        $key = $in['key'] ?? '';
        if (!$key) { echo json_encode(['ok' => false, 'error' => 'key لازم است']); break; }
        /* v34.0.18-alpha (رفع NoSuchKey): قبل از امضای URL، وجود فایل را با HEAD بررسی می‌کنیم.
           v34.0.19-alpha (اصلاح): فقط 404 قطعی = file_not_found. 403 ممکن است برای فایلِ موجود
           هم برگردد (signature/HEAD نامطمئن در برخی کانفیگ‌های Arvan)؛ پس 403 را کلید امضا و
           برمی‌گردانیم تا فایل‌های معتبر به‌اشتباه رد نشوند (باگ: استیجینگ کار می‌کرد، پروداکشن نه). */
        $uri = '/' . $cfg['bucket'] . '/' . str_replace('%2F', '/', rawurlencode($key));
        $h = s3_request($cfg, 'HEAD', $uri);
        $code = (int)($h['code'] ?? 0);
        if ($code === 404) {
            echo json_encode(['ok' => false, 'error' => 'file_not_found', 'detail' => 'فایل با این کلید در فضای ابری یافت نشد (کلید قدیمی/مهاجرت‌نشده).', 'key' => $key, 'http' => $code]);
            break;
        }
        /* 403/5xx/نامعتبر: HEAD مطمئن نیست → کلید را امضا و برگردان (GET امضاشده خودش تعیین تکلیف می‌کند) */
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
            'list-type=2&max-keys=1000&prefix=' . rawurlencode($prefix));
        if ($r['code'] !== 200) { echo json_encode(['ok' => false, 'http' => $r['code']]); break; }
        preg_match_all('#<Key>(.*?)</Key>.*?<LastModified>(.*?)</LastModified>.*?<Size>(\d+)</Size>#s', $r['body'], $m, PREG_SET_ORDER);
        $files = array_map(function ($x) { return ['key' => html_entity_decode($x[1]), 'lastModified' => $x[2], 'size' => (int)$x[3]]; }, $m);
        echo json_encode(['ok' => true, 'files' => $files], JSON_UNESCAPED_UNICODE);
        break;

    case 'delete_batch':
        /* v15.1 (BUG-015): ریشه خطای «حذف دسته‌جمعی» — این بلوک تابع clean() را صدا می‌زد که در
           storage.php تعریف نشده (فقط در crm.php هست) → Fatal Error سروری → پاسخ غیر JSON → خطای کلاینت.
           پاکسازی کلید حالا محلی و امن انجام می‌شود؛ شاخه مرده verify_request (تعریف‌نشده در این فایل) هم حذف شد. */
        $raw = file_get_contents('php://input');
        $j = json_decode($raw, true);
        $keys = $j['keys'] ?? ($_POST['keys'] ?? []);
        if (!is_array($keys)) { echo json_encode(['ok' => false, 'error' => 'invalid keys']); break; }
        if (count($keys) > 2000) $keys = array_slice($keys, 0, 2000); /* سقف ایمنی */
        $deleted = 0; $failed = 0;
        foreach ($keys as $k) {
            $k = trim((string)$k);
            if ($k === '' || strlen($k) > 500 || strpos($k, '..') !== false) continue;
            $r = s3_request($cfg, 'DELETE', '/' . $cfg['bucket'] . '/' . str_replace('%2F', '/', rawurlencode($k)));
            if ($r['code'] >= 200 && $r['code'] < 300) $deleted++; else $failed++;
        }
        echo json_encode(['ok' => true, 'deleted' => $deleted, 'failed' => $failed, 'total' => count($keys)]);
        break;

    /* ---------- US-177: میزان فضای اشغال‌شده ابری (جمع کل با صفحه‌بندی) ---------- */
    case 'usage':
        $total = 0; $count = 0; $token = ''; $pages = 0;
        do {
            $q = 'list-type=2&max-keys=1000' . ($token ? '&continuation-token=' . rawurlencode($token) : '');
            $r = s3_request($cfg, 'GET', '/' . $cfg['bucket'], $q);
            if ($r['code'] !== 200) { echo json_encode(['ok' => false, 'http' => $r['code']]); exit; }
            preg_match_all('#<Size>(\d+)</Size>#', $r['body'], $sm);
            foreach ($sm[1] as $s) { $total += (int)$s; $count++; }
            $token = '';
            if (strpos($r['body'], '<IsTruncated>true</IsTruncated>') !== false &&
                preg_match('#<NextContinuationToken>(.*?)</NextContinuationToken>#', $r['body'], $tm)) {
                $token = html_entity_decode($tm[1]);
            }
            $pages++;
        } while ($token && $pages < 30);
        echo json_encode(['ok' => true, 'bytes' => $total, 'count' => $count, 'bucket' => $cfg['bucket']]);
        break;

    /* ---------- US-178: بایگانی فشرده پرونده — دانلود از آروان → zip → آپلود → حذف اصل‌ها ---------- */
    case 'archive_zip':
        if (!class_exists('ZipArchive')) {
            echo json_encode(['ok' => false, 'error' => 'no-zip',
                'msg' => 'افزونه ZipArchive روی هاست فعال نیست — فایل‌ها بدون فشرده‌سازی بایگانی شدند']);
            break;
        }
        $keys = $in['keys'] ?? [];
        $prjNo = preg_replace('/[^\w\-]/', '', $in['prj'] ?? 'PRJ');
        if (!is_array($keys) || !count($keys) || count($keys) > 100) {
            echo json_encode(['ok' => false, 'error' => 'keys نامعتبر (۱ تا ۱۰۰)']); break;
        }
        $tmp = tempnam(sys_get_temp_dir(), 'ptfzip');
        $zip = new ZipArchive();
        $zip->open($tmp, ZipArchive::OVERWRITE);
        $added = 0; $totalIn = 0;
        foreach ($keys as $k) {
            $k = (string)$k;
            if ($k === '' || strlen($k) > 500) continue;
            $url = sig_v4($cfg, 'GET', $k, [], 600);
            $ch = curl_init($url);
            curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 60]);
            $body = curl_exec($ch);
            $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);
            if ($code === 200 && $body !== false) {
                $zip->addFromString(basename($k), $body);
                $added++; $totalIn += strlen($body);
            }
        }
        $zip->close();
        if (!$added) { @unlink($tmp); echo json_encode(['ok' => false, 'error' => 'هیچ فایلی قابل دریافت نبود']); break; }
        $zipKey = 'archives/' . date('Y') . '/' . $prjNo . '-' . date('Ymd-His') . '.zip';
        $putUrl = sig_v4($cfg, 'PUT', $zipKey, [], 600);
        $fh = fopen($tmp, 'rb');
        $ch = curl_init($putUrl);
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_PUT => true,
            CURLOPT_INFILE => $fh, CURLOPT_INFILESIZE => filesize($tmp), CURLOPT_TIMEOUT => 120]);
        curl_exec($ch);
        $putCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch); fclose($fh);
        $zipSize = filesize($tmp);
        @unlink($tmp);
        if ($putCode < 200 || $putCode >= 300) {
            echo json_encode(['ok' => false, 'error' => 'آپلود zip بایگانی ناموفق (HTTP ' . $putCode . ') — فایل‌های اصلی دست نخورده ماندند']);
            break;
        }
        // حذف اصل‌ها فقط بعد از آپلود موفق zip
        $deleted = 0;
        foreach ($keys as $k) {
            $uri = '/' . $cfg['bucket'] . '/' . str_replace('%2F', '/', rawurlencode((string)$k));
            $r = s3_request($cfg, 'DELETE', $uri);
            if (in_array($r['code'], [200, 204])) $deleted++;
        }
        echo json_encode(['ok' => true, 'zipKey' => $zipKey, 'zipped' => $added, 'deleted' => $deleted,
            'bytesIn' => $totalIn, 'bytesZip' => $zipSize]);
        break;

    default:
        echo json_encode(['ok' => false, 'error' => 'action نامعتبر']);
}
