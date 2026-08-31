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

/* اسکوپِ دسترسی. webmasters = خواندن + نوشتن (ثبتِ نقشه).
   برای سرویس‌اکانت، اسکوپ در خودِ JWT اعلام می‌شود و نیازی به تغییر در
   کنسولِ گوگل نیست؛ ولی سرویس‌اکانت باید در سرچ کنسول سطحِ Full داشته باشد. */
define('GSC_SCOPE', 'https://www.googleapis.com/auth/webmasters');
$COV_FILE   = $DATA . '/gsc-coverage.json';   /* کشِ جدا تا کشِ overview بازنویسی نشود */

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
        /* توکنِ کش‌شده با اسکوپِ قبلی صادر شده؛ اگر اسکوپ عوض شده باشد بی‌اعتبار است
           وگرنه تا یک ساعت همان توکنِ قدیمی مصرف می‌شود و تغییر اثر نمی‌کند */
        if (is_array($j) && ($j['scope'] ?? '') !== GSC_SCOPE) {
            @unlink($cacheF);
            $j = null;
        }
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
        'scope' => GSC_SCOPE,
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
        'scope'        => GSC_SCOPE,   /* برای تشخیصِ تغییرِ اسکوپ در دفعهٔ بعد */
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

/* ---------- نقشهٔ سایت (تکه‌تکه: sitemap-index.xml → sitemap-*.xml) ---------- */
function gsc_sitemap_urls($ROOT) {
    $urls = [];
    $idx = $ROOT . '/sitemap-index.xml';
    $files = [];
    if (is_file($idx)) {
        $c = (string)@file_get_contents($idx);
        if (preg_match_all('#<loc>\s*(.*?)\s*</loc>#i', $c, $m)) {
            foreach ($m[1] as $u) if (preg_match('#\.xml$#i', $u)) $files[] = $u;
        }
    }
    foreach ($files as $u) {
        $local = preg_replace('#^https?://(www\.)?pishtaj\.ir/#i', '', $u);
        $p = $ROOT . '/' . $local;
        if (!is_file($p)) continue;
        $c = (string)@file_get_contents($p);
        if (preg_match_all('#<loc>\s*(.*?)\s*</loc>#i', $c, $m2)) {
            foreach ($m2[1] as $loc) $urls[trim($loc)] = $local;
        }
    }
    return $urls;
}

/* پیوندِ مستقیم به «URL Inspection» در سرچ کنسول — همان‌جا که دکمهٔ
   «درخواست ایندکس» وجود دارد. درخواستِ خودکار ممکن نیست (Indexing API فقط
   JobPosting / BroadcastEvent را می‌پذیرد و اسکوپِ ما readonly است). */
/* v34.10.0 (S1/INDEX-LOOP): تاریخچهٔ بررسی ایندکس — برای دیدن «تغییر وضعیت از دفعهٔ قبل» */
$GSC_HIST = $DATA . '/gsc-inspect-history.json';
function gsc_hist_load($file) {
    $j = is_file($file) ? json_decode((string)@file_get_contents($file), true) : null;
    return (is_array($j) && isset($j['byUrl']) && is_array($j['byUrl'])) ? $j : ['byUrl' => []];
}
function gsc_hist_add($file, $url, $entry) {
    $j = gsc_hist_load($file);
    if (!isset($j['byUrl'][$url]) || !is_array($j['byUrl'][$url])) $j['byUrl'][$url] = [];
    $j['byUrl'][$url][] = $entry;
    if (count($j['byUrl'][$url]) > 5) $j['byUrl'][$url] = array_slice($j['byUrl'][$url], -5);
    if (count($j['byUrl']) > 400) { /* سقف کل: قدیمی‌ترین URLها حذف */
        foreach (array_keys($j['byUrl']) as $u) { unset($j['byUrl'][$u]); if (count($j['byUrl']) <= 350) break; }
    }
    @file_put_contents($file, json_encode($j, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), LOCK_EX);
    return $j['byUrl'][$url];
}

function gsc_inspect_link($propSite, $url) {
    if (strpos($propSite, 'sc-domain:') !== 0) $propSite = rtrim($propSite, '/') . '/';
    return 'https://search.google.com/search-console/inspect?resource_id='
         . rawurlencode($propSite) . '&id=' . rawurlencode($url);
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

        // پیوندِ مستقیم به صفحهٔ «URL Inspection» در سرچ کنسول.
        // چرا پیوند و نه درخواستِ خودکار؟ Indexing API فقط برای صفحاتِ دارای
        // JobPosting یا BroadcastEvent (داخلِ VideoObject) مجاز است و برای صفحهٔ
        // مقاله/محصول/خدمت نادیده گرفته می‌شود. این محدودیتِ خودِ API است و با
        // ارتقای اسکوپ هم حل نمی‌شود. دکمهٔ «درخواست ایندکس» تنها در UI خودِ
        // سرچ کنسول وجود دارد، پس کاربر را دقیقاً به همان صفحه می‌بریم.
        // اولویت با inspectionResultLink است که خودِ API برمی‌گرداند (معتبرترین
        // حالت). ساختِ دستی فقط یدک است و در برابرِ سرچ کنسولِ زنده آزموده نشده.
        $propSite = (string)$cfg['site_url'];
        if (strpos($propSite, 'sc-domain:') !== 0) $propSite = rtrim($propSite, '/') . '/';
        $link = (string)($res['inspectionResultLink'] ?? '');
        if ($link === '') {
            $link = 'https://search.google.com/search-console/inspect?resource_id='
                  . rawurlencode($propSite) . '&id=' . rawurlencode($url);
        }
        /* v34.10.0 (S1/INDEX-LOOP): ثبت در تاریخچه (اگر log=1) و برگرداندن وضعیتِ قبلی برای مقایسه */
        $prevEntry = null;
        $hist = gsc_hist_load($GSC_HIST);
        if (!empty($hist['byUrl'][$url])) {
            $arr = $hist['byUrl'][$url];
            $prevEntry = end($arr);
        }
        if (!empty($_REQUEST['log'])) {
            gsc_hist_add($GSC_HIST, $url, [
                'ts'      => date('c'),
                'verdict' => (string)($idx['verdict'] ?? 'UNKNOWN'),
                'coverage'=> (string)($idx['coverageState'] ?? ''),
                'crawled' => (string)($idx['lastCrawlTime'] ?? ''),
                'by'      => (string)($identity['user'] ?? '?'),
            ]);
        }
        jok([
            'url'         => $url,
            'prev'        => $prevEntry,
            'verdict'     => $idx['verdict'] ?? 'UNKNOWN',
            'coverage'    => $idx['coverageState'] ?? '',
            'crawled'     => $idx['lastCrawlTime'] ?? '',
            'robots'      => $idx['robotsTxtState'] ?? '',
            'indexing'    => $idx['indexingState'] ?? '',
            'pageFetch'   => $idx['pageFetchState'] ?? '',
            'crawler'     => $idx['crawledAs'] ?? '',
            'referring'   => $idx['referringUrls'] ?? '',
            'sitemap'     => $res['indexStatusResult']['sitemap'] ?? [],
            'inspectLink' => $link,
            'raw'         => $res,
        ]);
        break;

    /* v34.10.0 (S1/INDEX-LOOP): تاریخچهٔ بررسی‌های ایندکس */
    case 'inspect_log':
        $hist = gsc_hist_load($GSC_HIST);
        $u = trim((string)($_REQUEST['url'] ?? ''));
        if ($u !== '') jok(['entries' => $hist['byUrl'][$u] ?? []]);
        /* بدون url: فقط URLs دارای تاریخچه + آخرین وضعیت هرکدام */
        $last = [];
        foreach ($hist['byUrl'] as $hu => $arr) { $last[$hu] = end($arr); }
        jok(['last' => $last, 'total' => count($last)]);
        break;

    /* ثبتِ نقشه در سرچ کنسول — نیازمندِ اسکوپِ webmasters و سطحِ Full برای سرویس‌اکانت */
    case 'sitemap_submit':
        $cfg = gsc_cfg();
        if (!$cfg) jerr('gsc_not_configured');
        $feed = trim((string)($_REQUEST['feed'] ?? 'https://pishtaj.ir/sitemap-index.xml'));
        if (!preg_match('#^https://(www\.)?pishtaj\.ir/#i', $feed)) jerr('feed_invalid');
        $site = $cfg['site_url'];
        if (strpos($site, 'sc-domain:') !== 0) $site = rtrim($site, '/') . '/';
        /* PUT روی مسیرِ feedpath؛ بدنه لازم نیست چون آدرس در خودِ مسیر است */
        gsc_api($cfg, 'webmasters/v3/sites/' . rawurlencode($site)
             . '/sitemaps/' . rawurlencode($feed), null, 'PUT');
        /* بازخوانیِ فهرست تا نتیجه فوراً دیده شود */
        $after = gsc_api($cfg, 'webmasters/v3/sites/' . rawurlencode($site) . '/sitemaps');
        $mine = null;
        foreach (($after['sitemap'] ?? []) as $sm) {
            if (rtrim($sm['path'] ?? '', '/') === rtrim($feed, '/')) { $mine = $sm; break; }
        }
        jok([
            'submitted' => $feed,
            'state'     => $mine['state'] ?? 'pending',
            'warnings'  => $mine['warnings'] ?? '0',
            'errors'    => $mine['errors'] ?? '0',
            'lastDownload' => $mine['lastDownloaded'] ?? '',
            'sitemaps'  => $after['sitemap'] ?? [],
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

    /* صفحاتِ بدونِ داده در سرچ کنسول = کاندیدای «ایندکس‌نشده» + پیوندِ درخواستِ ایندکس */
    case 'coverage':
        $cfg = gsc_cfg();
        if (!$cfg) jerr('gsc_not_configured');
        $days = (int)($_REQUEST['days'] ?? 90);
        if ($days < 28) $days = 28;
        if ($days > 180) $days = 180;
        $force = !empty($_REQUEST['refresh']);

        if (!$force && is_file($COV_FILE)) {
            $c = json_decode((string)@file_get_contents($COV_FILE), true);
            if (is_array($c) && (int)($c['days'] ?? 0) === $days
                && (int)($c['ts'] ?? 0) > time() - 3600) {
                $c['cached'] = true;
                jok($c);
            }
        }

        /* ۱) همهٔ URLهای نقشهٔ سایت (کاندیدای ایندکس) */
        $all = gsc_sitemap_urls($ROOT);
        if (!$all) jerr('sitemap_not_found');

        /* ۲) URLهایی که در بازهٔ زمانی داده دارند */
        $p = gsc_query($cfg, ['page'], $days, 25000);
        $seen = [];
        foreach (($p['rows'] ?? []) as $r) {
            if (empty($r['keys'][0])) continue;
            $seen[rtrim($r['keys'][0], '/')] = [
                'clicks'      => (float)($r['clicks'] ?? 0),
                'impressions' => (float)($r['impressions'] ?? 0),
                'position'    => (float)($r['position'] ?? 0),
            ];
        }

        $propSite = (string)$cfg['site_url'];
        $noData = [];
        foreach (array_keys($all) as $u) {
            if (isset($seen[rtrim($u, '/')])) continue;
            $noData[] = ['url' => $u, 'inspectLink' => gsc_inspect_link($propSite, $u)];
        }

        /* ۳) تأییدِ قطعی با URL Inspection — فقط به درخواست و حداکثر ۱۰ مورد،
              چون سهمیهٔ روزانهٔ این API محدود است */
        $verify = min(10, max(0, (int)($_REQUEST['verify'] ?? 0)));
        $verified = [];
        for ($i = 0; $i < $verify && $i < count($noData); $i++) {
            $u = $noData[$i]['url'];
            $r = gsc_api($cfg, 'v1/urlInspection/index:inspect', [
                'inspectionUrl' => $u,
                'siteUrl'       => $cfg['site_url'],
            ]);
            $idx = ($r['inspectionResult'] ?? [])['indexStatusResult'] ?? [];
            $verified[] = [
                'url'      => $u,
                'verdict'  => $idx['verdict'] ?? 'UNKNOWN',
                'coverage' => $idx['coverageState'] ?? '',
                'crawled'  => $idx['lastCrawlTime'] ?? '',
                'robots'   => $idx['robotsTxtState'] ?? '',
                'fetch'    => $idx['pageFetchState'] ?? '',
            ];
        }

        $out = [
            'kind'          => 'coverage',
            'days'          => $days,
            'end'           => date('Y-m-d', strtotime('-2 days')),
            'ts'            => time(),
            'sitemap_total' => count($all),
            'with_data'     => count($seen),
            'no_data'       => $noData,
            'verified'      => $verified,
            /* بدونِ داده ≠ قطعاً ایندکس‌نشده: صفحهٔ ایندکس‌شده با صفر نمایش
               هم در این فهرست می‌آید. تأییدِ قطعی فقط با «بررسی ایندکس». */
            'note'          => 'فهرستِ «بدونِ داده» شاملِ هر صفحهٔ نقشه است که در این بازه نمایش/کلیک نداشته؛ '
                             . 'ایندکس‌نشدنِ قطعی را باید با «بررسی ایندکس» تأیید کرد.',
        ];
        @file_put_contents($COV_FILE, json_encode($out, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), LOCK_EX);
        jok($out);
        break;

    default:
        jerr('action_invalid');
}
