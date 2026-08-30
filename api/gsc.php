<?php
/**
 * PTF — Google Search Console API (v34.9.1)
 * ========================================
 * دسترسیِ مستقیم به دادهٔ واقعیِ سرچ کنسول از داخل پنل CRM.
 *
 * روش احراز: Google Service Account (JWT امضا‌شده با RSA-SHA256).
 * نیازی به کتابخانهٔ خارجی (Composer) ندارد؛ فقط به افزونهٔ openssl و curl نیاز دارد.
 *
 * تنظیمات در api/gsc-config.php (هرگز در گیت کامیت نمی‌شود — نمونه: gsc-config.sample.php):
 *   return [
 *     'client_email' => 'ptf-gsc@<project>.iam.gserviceaccount.com',
 *     'private_key'  => "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
 *     'site_url'     => 'https://pishtaj.ir/',      // یا 'sc-domain:pishtaj.ir'
 *   ];
 *
 * ⚠️ پیش‌نیازِ سمت گوگل: ایمیلِ service account را باید یک‌بار در
 *    Search Console → Settings → Users and permissions به عنوان کاربر اضافه کنید.
 *
 * دسترسی: فقط مدیران ارشد (admin/chairman/ceo/commercial)
 */
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

require_once __DIR__ . '/auth.php';
header('Cache-Control: no-store');
$token = auth_get_header_token();
$identity = auth_verify_token($token);
if (!$identity) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'error' => 'authentication_required'], JSON_UNESCAPED_UNICODE);
    exit;
}
$ROLE = strtolower((string)($identity['role'] ?? ''));
if (!in_array($ROLE, ['admin', 'chairman', 'ceo', 'commercial'], true)) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'permission_denied'], JSON_UNESCAPED_UNICODE);
    exit;
}

$ROOT = dirname(__DIR__);
$DATA = $ROOT . '/crm/data';
if (!is_dir($DATA)) { mkdir($DATA, 0755, true); file_put_contents($DATA . '/.htaccess', "Deny from all\n"); }
$CACHE_FILE = $DATA . '/gsc-cache.json';

$action = $_REQUEST['action'] ?? '';

function jerr($m) { echo json_encode(['ok' => false, 'error' => $m], JSON_UNESCAPED_UNICODE); exit; }
function jok($extra = []) { echo json_encode(array_merge(['ok' => true], $extra), JSON_UNESCAPED_UNICODE); exit; }

/* ---------- تنظیمات ---------- */
function gsc_cfg() {
    $f = __DIR__ . '/gsc-config.php';
    if (!is_file($f)) return null;
    $c = require $f;
    if (!is_array($c)) return null;
    if (empty($c['client_email']) || empty($c['private_key'])) return null;
    if (empty($c['site_url'])) $c['site_url'] = 'https://pishtaj.ir/';
    return $c;
}

/* ---------- کمک‌تابع‌های JWT ---------- */
function gsc_b64($d) { return rtrim(strtr(base64_encode($d), '+/', '-_'), '='); }

function gsc_token($cfg) {
    static $mem = null;
    if ($mem) return $mem;

    $cacheF = dirname(__DIR__) . '/crm/data/gsc-token.json';
    if (is_file($cacheF)) {
        $j = json_decode((string)@file_get_contents($cacheF), true);
        if (is_array($j) && !empty($j['access_token']) && (int)$j['exp'] > time() + 120) {
            $mem = $j['access_token'];
            return $mem;
        }
    }
    if (!function_exists('openssl_sign')) jerr('openssl_missing');

    $now = time();
    $hdr = ['alg' => 'RS256', 'typ' => 'JWT'];
    $clm = [
        'iss'   => $cfg['client_email'],
        'scope' => 'https://www.googleapis.com/auth/webmasters.readonly',
        'aud'   => 'https://oauth2.googleapis.com/token',
        'iat'   => $now,
        'exp'   => $now + 3600,
    ];
    $input = gsc_b64(json_encode($hdr)) . '.' . gsc_b64(json_encode($clm));

    $pem = $cfg['private_key'];
    /* کلیدهایی که در تنظیمات با \n ذخیره شده‌اند (تک‌خطی) به PEM واقعی تبدیل می‌شوند */
    if (strpos($pem, "\n") === false) $pem = str_replace('\\n', "\n", $pem);
    $key = @openssl_pkey_get_private($pem);
    if (!$key) jerr('private_key_invalid');
    if (!openssl_sign($input, $sig, $key, OPENSSL_ALGO_SHA256)) jerr('sign_failed');
    $jwt = $input . '.' . gsc_b64($sig);

    $ch = curl_init('https://oauth2.googleapis.com/token');
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 20,
        CURLOPT_POSTFIELDS     => http_build_query([
            'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            'assertion'  => $jwt,
        ]),
        CURLOPT_HTTPHEADER     => ['Content-Type: application/x-www-form-urlencoded'],
    ]);
    $res = curl_exec($ch);
    $err = curl_error($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($res === false) jerr('token_http_failed: ' . $err);

    $j = json_decode((string)$res, true);
    if (!is_array($j) || empty($j['access_token'])) {
        jerr('token_failed' . ($code ? ' (HTTP ' . $code . ')' : '') . ': ' . mb_substr((string)$res, 0, 200));
    }
    @file_put_contents($cacheF, json_encode([
        'access_token' => $j['access_token'],
        'exp'          => $now + (int)($j['expires_in'] ?? 3600),
    ]), LOCK_EX);
    $mem = $j['access_token'];
    return $mem;
}

/* ---------- فراخوانیِ API ---------- */
function gsc_api($cfg, $path, $payload = null, $method = 'GET') {
    $tok = gsc_token($cfg);
    $url = 'https://searchconsole.googleapis.com/' . $path;
    $ch = curl_init($url);
    $opts = [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 30,
        CURLOPT_HTTPHEADER     => [
            'Authorization: Bearer ' . $tok,
            'Content-Type: application/json',
        ],
    ];
    if ($payload !== null) {
        $opts[CURLOPT_POST] = true;
        $opts[CURLOPT_POSTFIELDS] = json_encode($payload, JSON_UNESCAPED_UNICODE);
        if ($method === 'GET') $method = 'POST';
    }
    if ($method !== 'POST') $opts[CURLOPT_CUSTOMREQUEST] = $method;
    curl_setopt_array($ch, $opts);
    $res = curl_exec($ch);
    $err = curl_error($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($res === false) jerr('api_http_failed: ' . $err);
    $j = json_decode((string)$res, true);
    if ($code >= 400) {
        $msg = is_array($j) && isset($j['error']['message']) ? $j['error']['message'] : mb_substr((string)$res, 0, 200);
        jerr('api_error_' . $code . ': ' . $msg);
    }
    return is_array($j) ? $j : [];
}

function gsc_query($cfg, $dimensions, $days, $rowLimit = 500) {
    $end = date('Y-m-d', strtotime('-2 days'));   /* دادهٔ دو روز اخیر هنوز نهایی نیست */
    $start = date('Y-m-d', strtotime('-' . (int)$days . ' days'));
    $site = $cfg['site_url'];
    if (strpos($site, 'sc-domain:') !== 0) {
        $site = rtrim($site, '/') . '/';
    }
    $path = 'webmasters/v3/sites/' . rawurlencode($site) . '/searchAnalytics/query';
    return gsc_api($cfg, $path, [
        'startDate'  => $start,
        'endDate'    => $end,
        'dimensions' => $dimensions,
        'rowLimit'   => $rowLimit,
        'dataState'  => 'final',
    ]);
}

function gsc_cache_read() {
    global $CACHE_FILE;
    if (!is_file($CACHE_FILE)) return null;
    $j = json_decode((string)@file_get_contents($CACHE_FILE), true);
    return is_array($j) ? $j : null;
}
function gsc_cache_write($d) {
    global $CACHE_FILE;
    @file_put_contents($CACHE_FILE, json_encode($d, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), LOCK_EX);
}

/* ---------- تحلیل ---------- */
$BRAND = ['پیشرو تجهیز', 'پیشرو تجهیز فرتاک', 'فرتاک', 'ptf', 'pishtaj', 'پیشتاز', 'پویا تجهیز', 'ویژن پترو'];
function gsc_is_brand($q) {
    global $BRAND;
    foreach ($BRAND as $b) { if (mb_stripos($q, $b) !== false) return true; }
    return false;
}

function gsc_summarize($rowsQ, $rowsP) {
    $out = [
        'queries_total' => 0, 'clicks' => 0, 'impressions' => 0,
        'brand_clicks' => 0, 'brand_impressions' => 0,
        'pos1' => 0, 'pos2' => 0, 'pos3' => 0, 'pos_far' => 0,
        'queries' => [], 'pages' => [],
    ];
    foreach ($rowsQ as $r) {
        if (empty($r['keys'][0])) continue;
        $q = $r['keys'][0];
        $clk = (float)($r['clicks'] ?? 0);
        $imp = (float)($r['impressions'] ?? 0);
        $pos = (float)($r['position'] ?? 0);
        $ctr = (float)($r['ctr'] ?? 0);
        $out['queries_total']++;
        $out['clicks'] += $clk;
        $out['impressions'] += $imp;
        if (gsc_is_brand($q)) { $out['brand_clicks'] += $clk; $out['brand_impressions'] += $imp; }
        if ($pos <= 10) $out['pos1']++;
        elseif ($pos <= 20) $out['pos2']++;
        elseif ($pos <= 30) $out['pos3']++;
        else $out['pos_far']++;
        $out['queries'][] = ['q' => $q, 'clicks' => $clk, 'impressions' => $imp,
            'ctr' => $ctr, 'position' => $pos, 'brand' => gsc_is_brand($q)];
    }
    foreach ($rowsP as $r) {
        if (empty($r['keys'][0])) continue;
        $out['pages'][] = [
            'url' => $r['keys'][0],
            'clicks' => (float)($r['clicks'] ?? 0),
            'impressions' => (float)($r['impressions'] ?? 0),
            'ctr' => (float)($r['ctr'] ?? 0),
            'position' => (float)($r['position'] ?? 0),
        ];
    }
    usort($out['queries'], function ($a, $b) { return $b['impressions'] <=> $a['impressions']; });
    usort($out['pages'], function ($a, $b) { return $b['impressions'] <=> $a['impressions']; });
    return $out;
}

/* ---------- اکشن‌ها ---------- */
switch ($action) {

    case 'status':
        $cfg = gsc_cfg();
        jok([
            'configured' => $cfg ? true : false,
            'site'       => $cfg ? $cfg['site_url'] : '',
            'email'      => $cfg ? $cfg['client_email'] : '',
            'openssl'    => function_exists('openssl_sign'),
            'curl'       => function_exists('curl_init'),
        ]);
        break;

    case 'overview':
        $cfg = gsc_cfg();
        if (!$cfg) jerr('gsc_not_configured');
        $days = (int)($_REQUEST['days'] ?? 90);
        if ($days < 7) $days = 7;
        if ($days > 180) $days = 180;
        $force = !empty($_REQUEST['refresh']);

        $c = gsc_cache_read();
        if (!$force && $c && (int)($c['days'] ?? 0) === $days
            && (int)($c['ts'] ?? 0) > time() - 1800) {
            $c['cached'] = true;
            jok($c);
        }

        $q = gsc_query($cfg, ['query'], $days, 1000);
        $p = gsc_query($cfg, ['page'], $days, 500);
        $d = gsc_query($cfg, ['date'], $days, 400);

        $sum = gsc_summarize($q['rows'] ?? [], $p['rows'] ?? []);
        $dates = [];
        foreach (($d['rows'] ?? []) as $r) {
            if (empty($r['keys'][0])) continue;
            $dates[] = [
                'date' => $r['keys'][0],
                'clicks' => (float)($r['clicks'] ?? 0),
                'impressions' => (float)($r['impressions'] ?? 0),
            ];
        }
        usort($dates, function ($a, $b) { return strcmp($a['date'], $b['date']); });

        /* فرصت‌ها: غیربرندی، نمایشِ بالا، نزدیک به صفحهٔ اول */
        $wins = [];
        foreach ($sum['queries'] as $r) {
            if ($r['brand']) continue;
            if ($r['impressions'] < 5) continue;
            if ($r['position'] < 6 || $r['position'] > 30) continue;
            $wins[] = $r;
        }
        usort($wins, function ($a, $b) { return $b['impressions'] <=> $a['impressions']; });

        /* نمایش دارد ولی کلیک ندارد */
        $noClick = [];
        foreach ($sum['queries'] as $r) {
            if ($r['impressions'] >= 5 && $r['clicks'] == 0) $noClick[] = $r;
        }
        usort($noClick, function ($a, $b) { return $b['impressions'] <=> $a['impressions']; });

        $out = [
            'days' => $days,
            'end'  => date('Y-m-d', strtotime('-2 days')),
            'ts'   => time(),
            'totals' => [
                'queries' => $sum['queries_total'],
                'clicks' => $sum['clicks'],
                'impressions' => $sum['impressions'],
                'brand_clicks' => $sum['brand_clicks'],
                'brand_impressions' => $sum['brand_impressions'],
                'pos1' => $sum['pos1'], 'pos2' => $sum['pos2'],
                'pos3' => $sum['pos3'], 'pos_far' => $sum['pos_far'],
            ],
            'queries' => array_slice($sum['queries'], 0, 200),
            'pages'   => array_slice($sum['pages'], 0, 200),
            'dates'   => $dates,
            'quickwins' => array_slice($wins, 0, 30),
            'no_click'  => array_slice($noClick, 0, 30),
        ];
        gsc_cache_write($out);
        $out['cached'] = false;
        jok($out);
        break;

    case 'inspect':
        $cfg = gsc_cfg();
        if (!$cfg) jerr('gsc_not_configured');
        $url = trim((string)($_REQUEST['url'] ?? ''));
        if ($url === '' || strpos($url, 'http') !== 0) jerr('url_invalid');
        $r = gsc_api($cfg, 'v1/urlInspection/index:inspect', [
            'inspectionUrl' => $url,
            'siteUrl'       => $cfg['site_url'],
        ]);
        $res = $r['inspectionResult'] ?? [];
        $idx = $res['indexStatusResult'] ?? [];
        jok([
            'url'        => $url,
            'verdict'    => $idx['verdict'] ?? 'UNKNOWN',
            'coverage'   => $idx['coverageState'] ?? '',
            'crawled'    => $idx['lastCrawlTime'] ?? '',
            'robots'     => $idx['robotsTxtState'] ?? '',
            'indexing'   => $idx['indexingState'] ?? '',
            'pageFetch'  => $idx['pageFetchState'] ?? '',
            'crawler'    => $idx['crawledAs'] ?? '',
            'referring'  => $idx['referringUrls'] ?? '',
            'sitemap'    => $res['indexStatusResult']['sitemap'] ?? [],
            'raw'        => $res,
        ]);
        break;

    case 'sitemaps':
        $cfg = gsc_cfg();
        if (!$cfg) jerr('gsc_not_configured');
        $site = $cfg['site_url'];
        if (strpos($site, 'sc-domain:') !== 0) $site = rtrim($site, '/') . '/';
        $r = gsc_api($cfg, 'webmasters/v3/sites/' . rawurlencode($site) . '/sitemaps');
        jok(['sitemaps' => $r['sitemap'] ?? []]);
        break;

    default:
        jerr('action_invalid');
}
