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
    /* v34.31.0 (GSC-DIAG): پیام فارسی قابل‌اقدام به‌جای توکن خام */
    echo json_encode(['ok' => false, 'error' => 'authentication_required: نشست شما نامعتبر یا منقضی شده است (عمر نشست ۲۴ ساعت). یک‌بار از CRM خارج شوید و دوباره وارد شوید، سپس «🧪 آزمون اتصال» را بزنید.'], JSON_UNESCAPED_UNICODE);
    exit;
}
$ROLE = strtolower((string)($identity['role'] ?? ''));
if (!in_array($ROLE, ['admin', 'chairman', 'ceo', 'commercial'], true)) {
    http_response_code(403);
    /* v34.31.0 (GSC-DIAG): پیام فارسی قابل‌اقدام به‌جای توکن خام — همان چیزی که پنل نشان می‌دهد */
    echo json_encode(['ok' => false, 'error' => 'permission_denied: دسترسی به سرچ کنسول فقط برای نقش‌های مدیر ارشد (admin / chairman / ceo / commercial) باز است؛ نقش فعلی شما «' . $ROLE . '» است. با یکی از این نقش‌ها وارد شوید و دوباره امتحان کنید.'], JSON_UNESCAPED_UNICODE);
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
/* v34.31.0 (GSC-CFG-DIAG): تشخیصِ دقیقِ وضعیتِ فایل تنظیمات + قرنطینهٔ خودکارِ فایلِ خراب.
   ریشهٔ حلقهٔ «ثبت نقشه ناموفق / اجازه دسترسی نمی‌دهد»: خطای نحوی در gsc-config.php هر
   اکشن را با HTTP 500 می‌کُشد و پنل فقط پیام عمومی می‌بیند. حالا:
   ۱) خطای پارس شکار و با نام فایل/خط گزارش می‌شود؛
   ۲) فایل خراب خودکار قرنطینه می‌شود تا حلقهٔ ۵۰۰ بشکند و پنل «بی‌تنظیم» شود؛
   ۳) حالت‌ها (missing / syntax / not_array / incomplete) در status و selftest دیده می‌شوند.
   نکتهٔ هاست: در این میزبانی فایل PHP بدون خروجی با HTTP 500 پاسخ می‌دهد؛ پس «بازکردن
   gsc-config.php در مرورگر» آزمون معتبری نیست — آزمون معتبر:  php -l api/gsc-config.php */
function gsc_cfg(&$state = null, &$detail = null) {
    $state = null; $detail = null;
    $f = __DIR__ . '/gsc-config.php';
    if (!is_file($f)) { $state = 'missing'; return null; }
    try {
        ob_start();
        try { $c = require $f; } finally { $noise = (string)ob_get_clean(); }
    } catch (Throwable $e) {
        $noise = trim($noise . ' | ' . get_class($e) . ': ' . $e->getMessage() . ' (خط ' . $e->getLine() . ')');
        $bad = $f . '.broken-' . date('Ymd-His');
        if (@rename($f, $bad)) $detail = 'فایل به ' . basename($bad) . ' منتقل شد — ' . $noise;
        else $detail = 'قرنطینه ممکن نشد (دسترسی نوشتن؟) — ' . $noise;
        $state = 'syntax';
        return null;
    }
    if (!is_array($c)) { $state = 'not_array'; return null; }
    if (empty($c['client_email']) || empty($c['private_key'])) { $state = 'incomplete'; return null; }
    if (empty($c['site_url'])) $c['site_url'] = 'https://pishtaj.ir/';
    $state = 'ok';
    return $c;
}

function gsc_cfg_or_jerr() {
    $state = null; $detail = null;
    $cfg = gsc_cfg($state, $detail);
    if ($cfg) return $cfg;
    if ($state === 'missing') jerr('gsc_not_configured: فایل تنظیمات روی سرور نیست. از روی api/gsc-config.sample.php فایلی به نام api/gsc-config.php بسازید و دو مقدار client_email و private_key را از کلید JSON سرویس‌اکانت وارد کنید (راهنما: مرحلهٔ ۳ فایل GSC-PANEL-SETUP-FA.md).');
    if ($state === 'syntax') jerr('gsc_config_broken: فایل تنظیمات خطای نحوی PHP داشت و خودکار قرنطینه شد. جزئیات: ' . $detail . ' — فایل api/gsc-config.php را از نو بسازید و حتماً با دستور «php -l api/gsc-config.php» آزمایش کنید؛ سپس «🧪 آزمون اتصال» را بزنید.');
    if ($state === 'not_array') jerr('gsc_config_broken: فایل تنظیمات آرایه برنمی‌گرداند. ساختار باید دقیقاً مانند api/gsc-config.sample.php باشد: در پایان فایل «return [ ... ];».');
    jerr('gsc_config_incomplete: مقادیر client_email یا private_key در فایل تنظیمات خالی است. هر دو را عیناً از فایل JSON کلید سرویس‌اکانت کپی کنید (کلید داخل " دوتایی و با \\nها).');
}

/* ---------- کمک‌تابع‌های JWT ---------- */
function gsc_b64($d) { return rtrim(strtr(base64_encode($d), '+/', '-_'), '='); }

function gsc_token($cfg, $silent = false) {
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
    if (!function_exists('openssl_sign')) { if ($silent) return false; jerr('openssl_missing'); }

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
    if (!$key) { if ($silent) return false; jerr('private_key_invalid'); }
    if (!openssl_sign($input, $sig, $key, OPENSSL_ALGO_SHA256)) { if ($silent) return false; jerr('sign_failed'); }
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
    if ($res === false) { if ($silent) return false; jerr('token_http_failed: ' . $err); }

    $j = json_decode((string)$res, true);
    if (!is_array($j) || empty($j['access_token'])) {
        if ($silent) return false;
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
function gsc_api($cfg, $path, $payload = null, $method = 'GET', $silent = false) {
    $tok = gsc_token($cfg, $silent);
    if ($tok === false) return ['__error' => 'token_failed'];
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
    if ($res === false) { if ($silent) return ['__error' => 'api_http_failed: ' . $err]; jerr('api_http_failed: ' . $err); }
    $j = json_decode((string)$res, true);
    if ($code >= 400) {
        $msg = is_array($j) && isset($j['error']['message']) ? $j['error']['message'] : mb_substr((string)$res, 0, 200);
        if ($silent) return ['__error' => 'api_error_' . $code . ': ' . $msg];
        jerr('api_error_' . $code . ': ' . $msg);
    }
    return is_array($j) ? $j : [];
}

/* ═══ v34.12.0 (S3/SNAPSHOT): اسنپ‌شات روزانهٔ lazy — بدون cron؛ هر بازکردن پنل GSC
   اگر از آخرین اسنپ‌شات بیش از ۲۰ ساعت گذشته، وضعیت روز ذخیره می‌شود (سری زمانی برای
   روند و مقایسهٔ دوره‌ها). ═══ */
$GSC_SNAP_DIR = $DATA . '/gsc-snaps';
function gsc_snap_maybe($dir, $days, $sum, $dates) {
    if (!is_dir($dir)) @mkdir($dir, 0755, true);
    $existing = glob($dir . '/*.json') ?: [];
    usort($existing, function ($a, $b) { return strcmp($b, $a); }); /* جدیدترین اول */
    $today = date('Y-m-d');
    if ($existing && basename($existing[0], '.json') === $today) return; /* امروز گرفته شده */
    if ($existing && is_file($existing[0]) && time() - (int)@filemtime($existing[0]) < 20 * 3600) return; /* هنوز ۲۰ ساعت نشده */
    $top = function ($rows, $key, $lim) {
        $out = [];
        foreach (array_slice($rows, 0, $lim) as $r) {
            if (empty($r['keys'][0])) continue;
            $out[] = ['k' => $r['keys'][0], 'clicks' => (float)($r['clicks'] ?? 0), 'impressions' => (float)($r['impressions'] ?? 0), 'position' => round((float)($r['position'] ?? 0), 1)];
        }
        return $out;
    };
    $snap = [
        'date' => $today, 'days' => $days, 'ts' => date('c'),
        'clicks' => (float)($sum['totals']['clicks'] ?? 0),
        'impressions' => (float)($sum['totals']['impressions'] ?? 0),
        'topQueries' => $top($sum['queries'] ?? [], 'query', 30),
        'topPages' => $top($sum['pages'] ?? [], 'page', 30),
    ];
    @file_put_contents($dir . '/' . $today . '.json', json_encode($snap, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), LOCK_EX);
    /* نگهداری ۱۸۰ روز */
    if (count($existing) > 180) foreach (array_slice($existing, 180) as $old) @unlink($old);
}

/* ═══ v34.16.0 (S3-id/WATCH): واچ‌لیست جایگاه — روند از اسنپ‌شات‌های موجود (بدون دادهٔ جدید) ═══ */
function gsc_watch_file($DATA) { return $DATA . '/gsc-watchlist.json'; }
function gsc_watch_load($DATA) {
    $j = is_file(gsc_watch_file($DATA)) ? json_decode((string)@file_get_contents(gsc_watch_file($DATA)), true) : null;
    return (is_array($j) && isset($j['items']) && is_array($j['items'])) ? $j : ['items' => []];
}
function gsc_watch_save($DATA, $w) {
    @file_put_contents(gsc_watch_file($DATA), json_encode($w, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), LOCK_EX);
}

/* v34.17.0 (S3-id/AI-IMPACT): نرمال‌سازی مسیر صفحه برای تطبیق رجیستری AI با GSC */
function gsc_page_norm($p) {
    $p = preg_replace('#^https?://[^/]+#i', '', (string)$p);
    $p = ltrim(trim($p), '/');
    if ($p === '') $p = 'index.html';
    if (substr($p, -1) === '/') $p .= 'index.html';
    return $p;
}

/* v34.12.0 (S3/SUBMIT-FIX): تشخیص خودکار پراپرتی + سطح دسترسی — ریشهٔ «ثبت نقشه ناموفق»:
   PUT sitemaps فقط با سطح Full مجاز است و site_url کانفیگ ممکن است با نوع پراپرتی واقعی
   (sc-domain در برابر URL-prefix) نخواند. اینجا فهرست سایت‌های قابل‌دسترسی را می‌گیریم،
   بهترین تطبیق را انتخاب و اگر سطح کافی نیست علت را صریح برمی‌گردانیم. */
function gsc_pick_site($cfg, $needWrite = true, $silent = false) {
    /* v34.29.1: نسخهٔ بدونِ توقفِ تشخیص پراپرتی — خروجی ساختاریافته برای «آزمون اتصال GSC» */
    $list = gsc_api($cfg, 'webmasters/v3/sites', null, 'GET', $silent);
    if (isset($list['__error'])) return ['verdict' => 'api_error', 'error' => $list['__error'], 'sites' => [], 'host' => ''];
    /* v34.38.19 (GSC-SITEENTRY-FIX): پاسخِ webmasters/v3/sites فهرست را زیر کلیدِ
       «siteEntry» برمی‌گرداند (نه «site») — خواندنِ «site» باعث می‌شد فهرستِ قابل‌دسترسی
       همیشه خالی بماند و «آزمون اتصال» به‌نادرست property_not_found بدهد حتی وقتی
       سرویس‌اکانت درست با سطح Full اضافه شده بود. (تستر 634 این قرارداد را قفل می‌کند.) */
    $sites = $list['siteEntry'] ?? [];
    $want = (string)$cfg['site_url'];
    $host = 'pishtaj.ir';
    $m = [];
    if (preg_match('#https?://([^/]+)/?#', $want, $m)) $host = strtolower($m[1]);
    elseif (strpos($want, 'sc-domain:') === 0) $host = substr($want, 10);
    $exact = null; $domain = null; $prefix = null;
    foreach ($sites as $st) {
        $u = (string)($st['siteUrl'] ?? '');
        if ($u === $want) $exact = $st;
        if ($u === 'sc-domain:' . $host) $domain = $st;
        if (stripos($u, 'https://' . $host) === 0) $prefix = $st;
    }
    $chosen = $exact ?: ($domain ?: $prefix);
    $out = [
        'want' => $want, 'host' => $host,
        'sites' => array_values(array_map(function ($st) {
            return ['siteUrl' => (string)($st['siteUrl'] ?? ''), 'permissionLevel' => (string)($st['permissionLevel'] ?? '')];
        }, (array)$sites)),
    ];
    if (!$chosen) { $out['verdict'] = 'no_match'; $out['site'] = ''; return $out; }
    $perm = (string)($chosen['permissionLevel'] ?? '');
    $out['perm'] = $perm;
    $out['site'] = (string)$chosen['siteUrl'];
    if ($needWrite && ($perm === 'siteRestrictedUser' || $perm === 'siteUnverifiedUser')) { $out['verdict'] = 'low_perm'; return $out; }
    $out['verdict'] = 'ok';
    return $out;
}

function gsc_resolve_site($cfg, $needWrite = true) {
    /* v34.12.0 (S3/SUBMIT-FIX) + v34.29.1 (SELF-TEST): تشخیص خودکار پراپرتی + سطح دسترسی.
       پیامِ no_match حالا علت‌های رایج را صریح فهرست می‌کند (IAM گوگل‌کلود ≠ سرچ کنسول،
       ایمیل ناقص، پراپرتی اشتباه مثل staging، افزودنِ Owner-محور به‌جای User). */
    $d = gsc_pick_site($cfg, $needWrite);
    if ($d['verdict'] === 'no_match') {
        $names = array_map(function ($st) { return $st['siteUrl'] . ' (' . ($st['permissionLevel'] ?: '?') . ')'; }, $d['sites']);
        jerr('property_not_found: سرویس‌اکانت به هیچ پراپرتیِ ' . $d['host'] . ' دسترسی ندارد — فهرستِ قابل‌دسترسی: ' . ($names ? implode('، ', $names) : 'خالی (هیچ)') . '\n'
            . '☑ راه‌حل — دقیقاً این مسیر: Search Console ← انتخاب همان پراپرتی (' . $d['host'] . ') ← Settings ← Users and permissions ← Add user ← عیناً این ایمیل: ' . $cfg['client_email'] . ' ← Permission: Full ← Add\n'
            . 'علت‌های رایج «با وجودِ افزودن، باز خالی»: ۱) دسترسی در Google Cloud/IAM داده شده (اشتباه است — باید در خودِ Search Console باشد)؛ ۲) ایمیل ناقص یا غلط تایپ شده — از همین پیام کپی کنید (پایانش iam.gserviceaccount.com است)؛ ۳) روی پراپرتیِ دیگری (مثلاً staging) اضافه شده — باید روی پراپرتی ' . $d['host'] . ' باشد؛ ۴) فقط از مسیر Owners/Verification اضافه شده — یک‌بار هم به‌عنوان User با سطح Full اضافه کنید. اعمال معمولاً تا ۱-۲ دقیقه؛ سپس «🧪 آزمون اتصال GSC» در تب سئو را بزنید.');
    }
    if ($d['verdict'] === 'low_perm') {
        jerr('permission_' . ($d['perm'] ?? '') . ': سرویس‌اکانت (' . $cfg['client_email'] . ') روی پراپرتی ' . $d['site']
            . ' سطح «' . ($d['perm'] ?? '') . '» دارد؛ ثبت نقشه فقط با سطح Full مجاز است. در Search Console ← Settings ← Users and permissions این ایمیل را به Full ارتقا دهید.');
    }
    return $d['site'];
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
        $st = null; $dt = null;
        $cfg = gsc_cfg($st, $dt);
        jok([
            'configured' => $cfg ? true : false,
            'config_state' => $cfg ? 'ok' : (string)$st,   /* v34.31.0: برای تشخیص در پنل */
            'config_detail' => (string)$dt,
            'site'       => $cfg ? $cfg['site_url'] : '',
            'email'      => $cfg ? $cfg['client_email'] : '',
            'openssl'    => function_exists('openssl_sign'),
            'curl'       => function_exists('curl_init'),
        ]);
        break;

    /* ═══ v34.29.1 (SELF-TEST): آزمون اتصال GSC — ایمیل سرویس‌اکانت + فهرست زندهٔ
       پراپرتی‌های قابل‌دسترسی + تشخیص علت (بدون ثبت/نوشتن چیزی) ═══ */
    case 'selftest':
        $st = null; $dt = null;
        $cfg = gsc_cfg($st, $dt);
        /* v34.31.0 (GSC-DIAG): حالت‌های خرابی کانفیگ — همان حلقه‌ای که قبلاً ۵۰۰ خام می‌داد */
        if (!$cfg) {
            $map = [
                'missing' => ['verdict' => 'no_config', 'steps' => [
                    'فایل api/gsc-config.php روی سرور نیست.',
                    'از روی api/gsc-config.sample.php فایلی به نام api/gsc-config.php بسازید (کنار api/gsc.php).',
                    'دو مقدار client_email و private_key را از فایل JSON کلید سرویس‌اکانت وارد کنید و فایل را ذخیره/آپلود کنید.']],
                'syntax' => ['verdict' => 'config_broken', 'steps' => [
                    'فایل تنظیمات خطای نحوی PHP داشت و خودکار قرنطینه شد: ' . (string)$dt,
                    'رایج‌ترین علت: کپی ناقص کلید خصوصی (جفت‌نشدن " یا جاافتادن , یا ] ).',
                    'فایل را از نو بسازید؛ کلید را عیناً با \\nها داخل " دوتایی بگذارید.',
                    'روی هاست آزمایش کنید:  php -l api/gsc-config.php  — باید بگوید «No syntax errors».',
                    'سپس همین «🧪 آزمون اتصال» را دوباره بزنید.']],
                'not_array' => ['verdict' => 'config_broken', 'steps' => [
                    'فایل تنظیمات آرایه برنمی‌گرداند؛ ساختار باید دقیقاً مانند gsc-config.sample.php باشد و با «return [ ... ];» تمام شود.']],
                'incomplete' => ['verdict' => 'config_incomplete', 'steps' => [
                    'client_email یا private_key در فایل تنظیمات خالی است.',
                    'هر دو را عیناً از فایل JSON کلید سرویس‌اکانت کپی کنید و دوباره «🧪 آزمون اتصال» را بزنید.']],
            ];
            $m = $map[(string)$st] ?? ['verdict' => 'config_broken', 'steps' => [(string)$dt]];
            jok(['configured' => false, 'email' => '', 'sites' => [], 'verdict' => $m['verdict'], 'steps' => $m['steps']]);
        }
        $tok = gsc_token($cfg, true);
        if ($tok === false) jok([
            'configured' => true, 'email' => $cfg['client_email'], 'sites' => [], 'verdict' => 'token_error',
            'steps' => ['توکن گوگل گرفته نشد — client_email یا private_key در gsc-config.php نادرست است.',
                        'private_key را عیناً با \\nها از فایل JSON کپی کنید و مطمئن شوید Search Console API در همان پروژه Enable است.'],
        ]);
        $d = gsc_pick_site($cfg, true, true);
        $steps = [];
        if (($d['verdict'] ?? '') === 'api_error') {
            jok(['configured' => true, 'email' => $cfg['client_email'], 'sites' => [], 'verdict' => 'api_error', 'error' => $d['error'],
                 'steps' => ['فراخوانی API گوگل خطا داد — یک‌بار دیگر امتحان کنید؛ اگر ادامه داشت پیام بالا را گزارش کنید.']]);
        }
        if ($d['verdict'] === 'no_match') {
            $steps = ['در Search Console پراپرتی ' . $d['host'] . ' را انتخاب کنید (همان که می‌خواهید نقشه‌اش ثبت شود).',
                      'Settings ← Users and permissions ← Add user.',
                      'عیناً این ایمیل را کپی کنید: ' . $cfg['client_email'],
                      'Permission را «Full» بگذارید و Add بزنید (نه از Google Cloud/IAM — آن‌جا نقش معنی‌دار نیست).',
                      'اگر قبلاً از صفحهٔ Owners/Verification اضافه شده بود، یک‌بار هم به‌عنوان User با Full اضافه کنید.',
                      '۱-۲ دقیقه صبر کنید و دوباره «آزمون اتصال» بزنید.'];
        } elseif ($d['verdict'] === 'low_perm') {
            $steps = ['سطح فعلی «' . ($d['perm'] ?? '') . '» فقط خواندنی است.',
                      'در Search Console ← Users and permissions ایمیل ' . $cfg['client_email'] . ' را به «Full» ارتقا دهید.'];
        }
        jok([
            'configured' => true,
            'email'      => $cfg['client_email'],
            'site'       => $d['site'] ?? '',
            'verdict'    => $d['verdict'],
            'sites'      => $d['sites'],
            'steps'      => $steps,
        ]);
        break;

    case 'overview':
        $cfg = gsc_cfg_or_jerr(); /* v34.31.0: پیام خطای دقیق و قابل‌اقدام */
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
        gsc_snap_maybe($GSC_SNAP_DIR, $days, $sum, $dates); /* v34.12.0 (S3): اسنپ‌شات lazy روزانه */
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
        $cfg = gsc_cfg_or_jerr(); /* v34.31.0: پیام خطای دقیق و قابل‌اقدام */
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

    /* v34.12.0 (S3): سری زمانی اسنپ‌شات‌ها + دلتای آخرین دو نقطه */
    case 'snaps':
        $files = glob($GSC_SNAP_DIR . '/*.json') ?: [];
        sort($files);
        $series = []; $lastTwo = [];
        foreach ($files as $i => $f) {
            $j = json_decode((string)@file_get_contents($f), true);
            if (!is_array($j) || empty($j['date'])) continue;
            $series[] = ['date' => $j['date'], 'clicks' => (float)($j['clicks'] ?? 0), 'impressions' => (float)($j['impressions'] ?? 0)];
            $lastTwo[] = $j;
            if (count($lastTwo) > 2) array_shift($lastTwo);
        }
        $delta = null;
        if (count($lastTwo) === 2) {
            $a = $lastTwo[0]; $b = $lastTwo[1];
            $df = function ($x, $y) use ($a, $b) { return $a[$x] > 0 ? round((($b[$x] - $a[$x]) / $a[$x]) * 100, 1) : 0; };
            $delta = ['from' => $a['date'], 'to' => $b['date'], 'clicks' => $df('clicks', 0), 'impressions' => $df('impressions', 0)];
        }
        jok(['series' => array_slice($series, -60), 'total_snaps' => count($series), 'delta' => $delta]);
        break;

    /* v34.16.0 (S3-id/WATCH): افزودن/حذف کلمه از واچ‌لیست (سقف ۳۰) */
    case 'watch_toggle':
        $q = trim((string)($_POST['q'] ?? ''));
        if ($q === '' || mb_strlen($q, 'UTF-8') > 120) jerr('کلمهٔ نامعتبر');
        $w = gsc_watch_load($DATA);
        $on = false;
        if (isset($w['items'][$q])) { unset($w['items'][$q]); }
        else {
            if (count($w['items']) >= 30) jerr('واچ‌لیست پر است (۳۰ کلمه)');
            $w['items'][$q] = ['added_at' => date('c')];
            $on = true;
        }
        gsc_watch_save($DATA, $w);
        jok(['on' => $on, 'total' => count($w['items'])]);
        break;

    /* v34.17.0 (S3-id/AI-IMPACT): صفحات AI-لمس‌شده در برابر بقیه — از اسنپ‌شات‌های موجود
       (فقط ۳۰ صفحهٔ برترِ هر روز در اسنپ‌شات هست؛ مقایسه صادقانه در همان دامنه). */
    case 'ai_pages':
        $aiFile = $DATA . '/ai-touched.json';
        $reg = is_file($aiFile) ? json_decode((string)@file_get_contents($aiFile), true) : null;
        $reg = (is_array($reg) && is_array($reg['paths'] ?? null)) ? $reg['paths'] : [];
        $aiSet = [];
        foreach ($reg as $rel => $m) { if (is_array($m)) $aiSet[gsc_page_norm($rel)] = $m; }
        $files = glob($GSC_SNAP_DIR . '/*.json') ?: [];
        sort($files);
        $days = []; $tot = ['aC' => 0.0, 'aI' => 0.0, 'rC' => 0.0, 'rI' => 0.0];
        $firstShare = null; $lastShare = null;
        $lastPages = []; /* سنجهٔ صفحات AI در آخرین اسنپ‌شات */
        foreach ($files as $f) {
            $j = json_decode((string)@file_get_contents($f), true);
            if (!is_array($j) || empty($j['date'])) continue;
            $aC = $aI = $aW = 0.0; $rC = $rI = $rW = 0.0; /* W = مجموع وزنِ جایگاه */
            $dayAi = [];
            foreach (($j['topPages'] ?? []) as $tp) {
                $k = gsc_page_norm($tp['k'] ?? '');
                $c = (float)($tp['clicks'] ?? 0); $im = (float)($tp['impressions'] ?? 0); $po = (float)($tp['position'] ?? 0);
                if (isset($aiSet[$k])) {
                    $aC += $c; $aI += $im; $aW += $po * max($im, 1);
                    $dayAi[] = ['path' => $k, 'clicks' => $c, 'imp' => $im, 'pos' => $po];
                } else { $rC += $c; $rI += $im; $rW += $po * max($im, 1); }
            }
            $days[] = ['d' => $j['date'], 'aC' => round($aC, 1), 'aI' => (int)$aI, 'aP' => $aI > 0 ? round($aW / $aI, 1) : null, 'rC' => round($rC, 1), 'rI' => (int)$rI, 'rP' => $rI > 0 ? round($rW / $rI, 1) : null];
            $tot['aC'] += $aC; $tot['aI'] += $aI; $tot['rC'] += $rC; $tot['rI'] += $rI;
            $sum = $aC + $rC;
            if ($sum > 0) { $share = $aC / $sum; if ($firstShare === null) $firstShare = $share; $lastShare = $share; }
            $lastPages = $dayAi ?: $lastPages;
        }
        $all = $tot['aC'] + $tot['rC'];
        jok([
            'days' => array_slice($days, -60),
            'tot' => ['aC' => round($tot['aC'], 1), 'aI' => (int)$tot['aI'], 'rC' => round($tot['rC'], 1), 'rI' => (int)$tot['rI'],
                      'share' => $all > 0 ? round($tot['aC'] / $all * 100, 1) : 0,
                      'shareFirst' => $firstShare !== null ? round($firstShare * 100, 1) : null,
                      'shareLast' => $lastShare !== null ? round($lastShare * 100, 1) : null],
            'aiTotal' => count($aiSet),
            'pages' => array_slice($lastPages, 0, 15),
            'note' => 'مقایسه در محدودهٔ ۳۰ صفحهٔ برترِ هر روز (اسنپ‌شات) انجام می‌شود',
        ]);
        break;

    /* v34.16.0 (S3-id/WATCH): روند جایگاه واچ‌لیست — از اسنپ‌شات‌های موجود (topQueries هر روز) */
    case 'watch_list':
        $w = gsc_watch_load($DATA);
        $files = glob($GSC_SNAP_DIR . '/*.json') ?: [];
        sort($files); /* قدیمی → جدید */
        $out = []; $totalSnaps = 0;
        foreach ($w['items'] as $q => $meta) {
            $series = [];
            foreach ($files as $f) {
                $j = json_decode((string)@file_get_contents($f), true);
                if (!is_array($j) || empty($j['date'])) continue;
                foreach (($j['topQueries'] ?? []) as $tq) {
                    if ((string)($tq['k'] ?? '') === (string)$q) {
                        $series[] = ['d' => $j['date'], 'pos' => (float)($tq['position'] ?? 0), 'clicks' => (float)($tq['clicks'] ?? 0), 'imp' => (float)($tq['impressions'] ?? 0)];
                        break;
                    }
                }
            }
            $totalSnaps = max($totalSnaps, count($series));
            $last = $series ? end($series) : null;
            $prev = count($series) > 1 ? $series[count($series) - 2] : null;
            $delta = ($last && $prev && (float)$prev['pos'] > 0) ? round((float)$prev['pos'] - (float)$last['pos'], 1) : null; /* مثبت = بهبود */
            $out[] = ['q' => $q, 'added_at' => $meta['added_at'] ?? '', 'series' => array_slice($series, -60), 'last' => $last, 'prev' => $prev, 'delta' => $delta];
        }
        jok(['items' => $out, 'total_snaps' => $totalSnaps]);
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
        $cfg = gsc_cfg_or_jerr(); /* v34.31.0: پیام خطای دقیق و قابل‌اقدام */
        $feed = trim((string)($_REQUEST['feed'] ?? 'https://pishtaj.ir/sitemap-index.xml'));
        if (!preg_match('#^https://(www\.)?pishtaj\.ir/#i', $feed)) jerr('feed_invalid');
        $site = gsc_resolve_site($cfg); /* v34.12.0: پراپرتی واقعی + گیت سطح Full */
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
            'site'      => $site,
            'state'     => $mine['state'] ?? 'pending',
            'warnings'  => $mine['warnings'] ?? '0',
            'errors'    => $mine['errors'] ?? '0',
            'lastDownload' => $mine['lastDownloaded'] ?? '',
            'sitemaps'  => $after['sitemap'] ?? [],
        ]);
        break;

    case 'sitemaps':
        $cfg = gsc_cfg_or_jerr(); /* v34.31.0: پیام خطای دقیق و قابل‌اقدام */
        $site = gsc_resolve_site($cfg, false); /* v34.12.0: پراپرتی خودکار */
        $r = gsc_api($cfg, 'webmasters/v3/sites/' . rawurlencode($site) . '/sitemaps');
        jok(['sitemaps' => $r['sitemap'] ?? []]);
        break;

    /* صفحاتِ بدونِ داده در سرچ کنسول = کاندیدای «ایندکس‌نشده» + پیوندِ درخواستِ ایندکس */
    case 'coverage':
        $cfg = gsc_cfg_or_jerr(); /* v34.31.0: پیام خطای دقیق و قابل‌اقدام */
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
