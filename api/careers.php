<?php
/**
 * PTF — فرصت شغلی (سایت + CRM)
 * عمومی: published, apply
 * CRM (admin/chairman/ceo): list_jobs, save_job, close_job, reopen_job, list_apps, get_app, purge_old
 */
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/storage-lib.php';

$ROOT = dirname(__DIR__);
$DATA = $ROOT . '/crm/data';
$CAREERS_DATA = $DATA . '/careers';
$JOBS_FILE = $CAREERS_DATA . '/jobs.json';
$APPS_FILE = $CAREERS_DATA . '/apps.json';
$STATUS_FILE = $ROOT . '/careers/status.json';
$RETENTION_DAYS = 180;
$PDF_MAX = 5 * 1048576;

$EDU = [
    'diploma' => 'دیپلم',
    'associate' => 'کاردانی',
    'bachelor' => 'کارشناسی',
    'master' => 'کارشناسی ارشد',
    'phd' => 'دکتری',
];
$EXP = [
    'lt1' => 'کمتر از ۱ سال',
    'y1_3' => '۱ تا ۳ سال',
    'y3_5' => '۳ تا ۵ سال',
    'y5_10' => '۵ تا ۱۰ سال',
    'gt10' => 'بیش از ۱۰ سال',
];
$SAL = [
    '15_20' => '۱۵ تا ۲۰ میلیون',
    '20_25' => '۲۰ تا ۲۵ میلیون',
    '25_30' => '۲۵ تا ۳۰ میلیون',
    'gt30' => 'مثبت ۳۰ میلیون',
    'other' => 'سایر',
];

$action = $_REQUEST['action'] ?? '';
$PUBLIC = ['published', 'apply'];

function jerr($m, $code = 400) {
    http_response_code($code);
    echo json_encode(['ok' => false, 'error' => $m], JSON_UNESCAPED_UNICODE);
    exit;
}
function jok($extra = []) {
    echo json_encode(array_merge(['ok' => true], $extra), JSON_UNESCAPED_UNICODE);
    exit;
}
function careers_ensure_data() {
    global $DATA, $CAREERS_DATA;
    if (!is_dir($DATA)) {
        mkdir($DATA, 0755, true);
        file_put_contents($DATA . '/.htaccess', "Deny from all\n");
    }
    if (!is_dir($CAREERS_DATA)) {
        mkdir($CAREERS_DATA, 0755, true);
        file_put_contents($CAREERS_DATA . '/.htaccess', "Deny from all\n");
    }
}
function careers_read($file) {
    if (!is_file($file)) return [];
    $j = json_decode((string)file_get_contents($file), true);
    return is_array($j) ? $j : [];
}
function careers_write($file, $data) {
    careers_ensure_data();
    $dir = dirname($file);
    if (!is_dir($dir)) mkdir($dir, 0755, true);
    $tmp = $file . '.tmp.' . bin2hex(random_bytes(4));
    $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    if ($json === false || file_put_contents($tmp, $json, LOCK_EX) === false) {
        @unlink($tmp);
        return false;
    }
    return @rename($tmp, $file);
}
function careers_clean($v, $max = 400) {
    $v = trim(strip_tags((string)$v));
    $v = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $v);
    if (function_exists('mb_substr')) return mb_substr($v, 0, $max, 'UTF-8');
    return substr($v, 0, $max);
}
function careers_digits($s) {
    $fa = ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹','٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
    $en = ['0','1','2','3','4','5','6','7','8','9','0','1','2','3','4','5','6','7','8','9'];
    return preg_replace('/\D/', '', str_replace($fa, $en, (string)$s));
}
function careers_slug($s) {
    $s = strtolower(preg_replace('/[^a-z0-9\-]/', '', (string)$s));
    $s = preg_replace('/-+/', '-', $s);
    return trim($s, '-');
}

$CAPTCHA_SECRET = load_ptf_secret('captcha_key', '');
function careers_captcha_ok() {
    global $CAPTCHA_SECRET;
    if (!is_string($CAPTCHA_SECRET) || strlen($CAPTCHA_SECRET) < 32) return false;
    $tok = $_POST['captcha_token'] ?? '';
    $ans = trim($_POST['captcha_answer'] ?? '');
    if (!$tok || $ans === '' || !is_numeric($ans)) return false;
    $raw = base64_decode($tok, true);
    if (!$raw || strpos($raw, '|') === false) return false;
    list($ts, $sig) = explode('|', $raw, 2);
    if (!ctype_digit($ts)) return false;
    $age = time() - (int)$ts;
    if ($age < 0 || $age > 900) return false;
    return hash_equals(hash_hmac('sha256', ((int)$ans) . '|' . $ts, $CAPTCHA_SECRET), $sig);
}
function careers_otp_ok($token, $phone) {
    global $CAPTCHA_SECRET;
    if (!is_string($CAPTCHA_SECRET) || strlen($CAPTCHA_SECRET) < 32) return false;
    $raw = base64_decode($token, true);
    if (!$raw) return false;
    $parts = explode('|', $raw, 3);
    if (count($parts) !== 3) return false;
    list($ts, $ph, $sig) = $parts;
    if (!ctype_digit($ts)) return false;
    $age = time() - (int)$ts;
    if ($age < 0 || $age > 1800) return false;
    if ($ph !== $phone) return false;
    return hash_equals(hash_hmac('sha256', 'otp|' . $ph . '|' . $ts, $CAPTCHA_SECRET), $sig);
}
function careers_sms_enabled() {
    $paths = [
        dirname(__DIR__, 2) . '/sms-config.php',
        dirname(__DIR__, 3) . '/sms-config.php',
        dirname(__DIR__) . '/sms-config.php',
    ];
    foreach ($paths as $p) {
        if (file_exists($p)) {
            $c = include $p;
            return is_array($c) && !empty($c['api_key']);
        }
    }
    return false;
}

function careers_auth() {
    $token = auth_get_header_token();
    $identity = auth_verify_token($token);
    if (!$identity) {
        http_response_code(401);
        echo json_encode(['ok' => false, 'error' => 'authentication_required'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    $role = strtolower((string)($identity['role'] ?? ''));
    if (!in_array($role, ['admin', 'chairman', 'ceo'], true)) {
        http_response_code(403);
        echo json_encode(['ok' => false, 'error' => 'permission_denied'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    return $identity;
}

function careers_published_jobs() {
    global $JOBS_FILE;
    $jobs = careers_read($JOBS_FILE);
    $out = [];
    foreach ($jobs as $j) {
        if (!empty($j['published'])) $out[] = $j;
    }
    return $out;
}
function careers_find($slug) {
    global $JOBS_FILE;
    foreach (careers_read($JOBS_FILE) as $j) {
        if (($j['slug'] ?? '') === $slug) return $j;
    }
    return null;
}
function careers_save_jobs($jobs) {
    global $JOBS_FILE;
    return careers_write($JOBS_FILE, array_values($jobs));
}

function careers_purge_apps() {
    global $APPS_FILE, $RETENTION_DAYS;
    $apps = careers_read($APPS_FILE);
    if (!$apps) return 0;
    $cut = time() - ($RETENTION_DAYS * 86400);
    $kept = [];
    $n = 0;
    foreach ($apps as $a) {
        $ts = strtotime((string)($a['createdAt'] ?? ''));
        if ($ts && $ts < $cut) { $n++; continue; }
        $kept[] = $a;
    }
    if ($n) careers_write($APPS_FILE, $kept);
    return $n;
}

function careers_h($s) {
    return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8');
}
function careers_body_html($s) {
    $s = careers_h($s);
    $parts = preg_split("/\n{2,}/", $s);
    $out = [];
    foreach ($parts as $p) {
        $p = trim($p);
        if ($p === '') continue;
        $out[] = '<p>' . nl2br($p, false) . '</p>';
    }
    return $out ? implode("\n", $out) : '<p></p>';
}
function careers_nav($pfx) {
    return '<a href="' . $pfx . '">خانه</a><span class="nav-drop"><a href="' . $pfx . '#about" aria-haspopup="true">درباره ما</a><span class="nav-drop-menu"><a href="' . $pfx . 'news/">اخبار</a><a href="' . $pfx . 'blog/">وبلاگ</a></span></span><a href="' . $pfx . 'services/">خدمات</a><a href="' . $pfx . 'services/products/">محصولات</a><a href="' . $pfx . 'industries/">صنایع</a><a href="' . $pfx . 'projects/">پروژه‌ها</a><a href="' . $pfx . 'knowledge-center/">مرکز دانش</a><a href="' . $pfx . 'tools/">ابزارها</a><a href="' . $pfx . 'rfq/">استعلام</a><a href="' . $pfx . '#contact">تماس</a><a href="' . $pfx . 'en/" class="lang-switch-mobile">🇬🇧 English</a>';
}
function careers_edu_opts() {
    global $EDU;
    $h = '<option value="">انتخاب کنید</option>';
    foreach ($EDU as $k => $lb) $h .= '<option value="' . $k . '">' . careers_h($lb) . '</option>';
    return $h;
}
function careers_exp_opts() {
    global $EXP;
    $h = '<option value="">انتخاب کنید</option>';
    foreach ($EXP as $k => $lb) $h .= '<option value="' . $k . '">' . careers_h($lb) . '</option>';
    return $h;
}
function careers_sal_opts() {
    global $SAL;
    $h = '<option value="">انتخاب کنید</option>';
    foreach ($SAL as $k => $lb) $h .= '<option value="' . $k . '">' . careers_h($lb) . '</option>';
    return $h;
}

function careers_job_html($job) {
    $pfx = '../../';
    $slug = careers_h($job['slug'] ?? '');
    $titleFa = careers_h($job['titleFa'] ?? '');
    $titleEn = careers_h($job['titleEn'] ?? '');
    $open = !empty($job['published']);
    $robots = $open ? 'index, follow' : 'noindex, nofollow';
    $url = 'https://pishtaj.ir/careers/' . rawurlencode($job['slug'] ?? '') . '/';
    $meta = $open
        ? ($titleFa . ' | فرصت شغلی پیشرو تجهیز فرتاک')
        : 'فرصت شغلی بسته شده | پیشرو تجهیز فرتاک';
    $desc = $open
        ? ('فرصت شغلی ' . $titleFa . ' در پیشرو تجهیز فرتاک — ارسال رزومه PDF')
        : 'این فرصت شغلی بسته شده است.';
    $closedBanner = $open ? '' : '<div class="job-closed">این فرصت شغلی بسته شده است</div>';
    $form = '';
    if ($open) {
        $form = '<section class="job-apply" id="apply">'
            . '<h2>ارسال درخواست همکاری</h2>'
            . '<p class="lead">همه فیلدها الزامی است. رزومه فقط PDF و حداکثر ۵ مگابایت.</p>'
            . '<form id="jobApplyForm" data-api="../../api/careers.php" enctype="multipart/form-data">'
            . '<input type="hidden" name="slug" value="' . $slug . '">'
            . '<input type="text" name="website" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">'
            . '<div class="field"><label for="jobName">نام و نام خانوادگی *</label><input id="jobName" name="name" required maxlength="120"></div>'
            . '<div class="grid-2"><div class="field"><label for="jobPhone">موبایل *</label><input id="jobPhone" name="mobile" required inputmode="tel" placeholder="09xxxxxxxxx"></div>'
            . '<div class="field"><label for="jobEmail">ایمیل *</label><input id="jobEmail" name="email" type="email" required maxlength="160"></div></div>'
            . '<div class="grid-2"><div class="field"><label for="jobEdu">مدرک تحصیلی *</label><select id="jobEdu" name="education" required>' . careers_edu_opts() . '</select></div>'
            . '<div class="field"><label for="jobExp">سابقه کاری مرتبط *</label><select id="jobExp" name="experience" required>' . careers_exp_opts() . '</select></div></div>'
            . '<div class="field"><label for="jobSal">حقوق درخواستی (تومان ماهانه) *</label><select id="jobSal" name="salary" required>' . careers_sal_opts() . '</select></div>'
            . '<div class="field"><label for="jobResume">فایل رزومه (PDF تا ۵MB) *</label><input id="jobResume" name="resume" type="file" accept="application/pdf,.pdf" required></div>'
            . '<div class="field" id="jobCaptcha"></div><div class="field" id="jobOtp"></div>'
            . '<div class="form-status" id="jobStatus" role="status"></div>'
            . '<button type="submit" class="btn" id="jobSubmit">ارسال درخواست</button>'
            . '</form></section>';
    }
    $dept = trim((string)($job['dept'] ?? ''));
    $loc = trim((string)($job['location'] ?? ''));
    $metaLine = careers_h(trim($dept . ($dept && $loc ? ' · ' : '') . $loc));
    $ld = '';
    if ($open) {
        $ld = '<script type="application/ld+json">' . json_encode([
            '@context' => 'https://schema.org',
            '@type' => 'JobPosting',
            'title' => $job['titleFa'] ?? '',
            'description' => careers_clean($job['bodyFa'] ?? '', 400),
            'hiringOrganization' => ['@type' => 'Organization', 'name' => 'پیشرو تجهیز فرتاک', 'sameAs' => 'https://pishtaj.ir/'],
            'jobLocation' => ['@type' => 'Place', 'address' => ['@type' => 'PostalAddress', 'addressCountry' => 'IR', 'addressLocality' => $loc ?: 'تهران']],
            'url' => $url,
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . '</script>';
    }
    return '<!doctype html>
<html lang="fa" dir="rtl">
<head>
<link rel="icon" type="image/png" sizes="32x32" href="' . $pfx . 'assets/images/favicon/favicon-32.png">
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>' . $meta . '</title>
<meta name="description" content="' . careers_h($desc) . '" />
<meta name="robots" content="' . $robots . '" />
<link rel="canonical" href="' . careers_h($url) . '" />
<link rel="stylesheet" href="' . $pfx . 'assets/css/style.css" />
<link rel="stylesheet" href="' . $pfx . 'assets/css/discover.css" />
' . $ld . '
<style>
.job-hero{background:linear-gradient(135deg,#151517,#2d2d31);padding:145px 0 50px;color:#fff}
.job-wrap{max-width:860px;margin:0 auto;padding:28px 20px 70px}
.job-closed{background:#fef2f2;border:1px solid #fecaca;color:#b91c1c;border-radius:14px;padding:14px 16px;font-weight:900;margin:0 0 18px}
.job-body{background:#fff;border:1px solid var(--line,#e2e8f0);border-radius:22px;padding:22px 24px;line-height:1.95;margin-bottom:22px}
.job-en{border-top:1px dashed #e2e8f0;margin-top:28px;padding-top:22px;direction:ltr;text-align:left}
.job-apply{background:#fff;border:1px solid var(--line,#e2e8f0);border-radius:22px;padding:22px 24px}
.job-apply .field{margin-bottom:14px}
.job-apply label{display:block;font-weight:900;font-size:13.5px;margin-bottom:6px}
.job-apply input,.job-apply select{width:100%;padding:12px 14px;border:2px solid #e2e8f0;border-radius:12px;font:inherit}
.grid-2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.btn{background:linear-gradient(135deg,#ef4b1a,#f79400);color:#fff;border:0;border-radius:12px;padding:12px 22px;font:inherit;font-weight:900;cursor:pointer}
.form-status{margin:10px 0;font-weight:800;min-height:1.4em}
.hp{position:absolute;left:-9999px;height:0;width:0;opacity:0}
@media(max-width:680px){.grid-2{grid-template-columns:1fr}}
</style>
</head>
<body>
<a class="ptf-skip" href="#main-content">رفتن به محتوا</a>
<header class="site-header scrolled"><div class="container nav-wrap">
<a class="brand" href="' . $pfx . '" aria-label="پیشرو تجهیز فرتاک"><img width="54" height="54" loading="lazy" src="' . $pfx . 'assets/images/ptf-logo.png" alt="لوگو پیشرو تجهیز فرتاک" style="object-fit:contain"><span><b>پیشرو تجهیز فرتاک</b><small>Pishro Tajhiz Fartak</small></span></a>
<button class="menu-toggle" id="menuToggle" aria-label="باز کردن منو"><span></span><span></span><span></span></button>
<nav class="main-nav" id="mainNav" aria-label="منوی اصلی">' . careers_nav($pfx) . '</nav>
<a class="header-call" href="tel:02146087679">021-46087679</a>
<a href="' . $pfx . 'en/" class="lang-switch-desktop" style="display:inline-flex;align-items:center;gap:4px;padding:7px 12px;border-radius:999px;background:#e2e8f0;color:#334155;font-weight:900;font-size:12px;text-decoration:none">🇬🇧 EN</a>
</div></header>
<nav class="ptf-bc" aria-label="مسیر صفحه"><div class="container"><ol><li><a href="/">خانه</a></li><li><a href="/careers/">فرصت شغلی</a></li><li><span aria-current="page">' . $titleFa . '</span></li></ol></div></nav>
<section class="job-hero"><div class="container"><h1>' . $titleFa . '</h1>' . ($metaLine ? '<p>' . $metaLine . '</p>' : '') . '</div></section>
<main id="main-content" class="job-wrap">
' . $closedBanner . '
<article class="job-body">
' . careers_body_html($job['bodyFa'] ?? '') . '
<div class="job-en" id="en">
<h2>' . $titleEn . '</h2>
' . careers_body_html($job['bodyEn'] ?? '') . '
</div>
</article>
' . $form . '
<p style="margin-top:18px"><a href="../">← بازگشت به فهرست فرصت‌ها</a></p>
</main>
<script>(function(){var t=document.getElementById("menuToggle"),n=document.getElementById("mainNav");if(t&&n){t.addEventListener("click",function(){n.classList.toggle("open")});n.querySelectorAll("a").forEach(function(a){a.addEventListener("click",function(){n.classList.remove("open")})})}})();</script>
<script src="' . $pfx . 'assets/js/ptf-guard.js"></script>
<script src="' . $pfx . 'assets/js/ptf-careers-apply.js"></script>
<script src="' . $pfx . 'assets/js/ptf-chat.js" defer></script>
<script src="' . $pfx . 'assets/js/ptf-metrics.js" defer></script>
<script src="' . $pfx . 'assets/js/ptf-discover.js" defer></script>
</body></html>';
}

function careers_write_job_page($job) {
    global $ROOT;
    $slug = $job['slug'] ?? '';
    if (!preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/', $slug)) return 'slug نامعتبر';
    $dir = $ROOT . '/careers/' . $slug;
    if (!is_dir($dir) && !mkdir($dir, 0755, true)) return 'ساختن پوشه آگهی ناموفق بود';
    $html = careers_job_html($job);
    if (file_put_contents($dir . '/index.html', $html, LOCK_EX) === false) return 'نوشتن صفحه آگهی ناموفق بود';
    return true;
}

function careers_list_inner($jobs) {
    $pub = [];
    foreach ($jobs as $j) if (!empty($j['published'])) $pub[] = $j;
    if (!$pub) return '<div id="careersList"><p class="careers-empty">در حال حاضر فرصت شغلی فعال نیست.</p></div>';
    $h = '<div id="careersList" class="job-grid">';
    foreach ($pub as $j) {
        $h .= '<a class="job-card" href="' . careers_h($j['slug']) . '/"><h3>' . careers_h($j['titleFa'] ?? '') . '</h3>'
            . '<small>' . careers_h(trim(($j['dept'] ?? '') . ' ' . ($j['location'] ?? ''))) . '</small></a>';
    }
    return $h . '</div>';
}
function careers_en_inner($jobs) {
    $pub = [];
    foreach ($jobs as $j) if (!empty($j['published'])) $pub[] = $j;
    if (!$pub) return '<div id="careersEnList"><p>There are currently no open positions.</p></div>';
    $h = '<div id="careersEnList" class="job-grid">';
    foreach ($pub as $j) {
        $title = $j['titleEn'] ?: $j['titleFa'];
        $h .= '<a class="job-card" href="../careers/' . careers_h($j['slug']) . '/#en"><h3>' . careers_h($title) . '</h3></a>';
    }
    return $h . '</div>';
}
function careers_replace_marker($file, $start, $end, $inner) {
    if (!is_file($file)) return false;
    $s = file_get_contents($file);
    $p = strpos($s, $start);
    $q = strpos($s, $end);
    if ($p === false || $q === false || $q < $p) return false;
    $out = substr($s, 0, $p) . $start . "\n" . $inner . "\n" . $end . substr($s, $q + strlen($end));
    return file_put_contents($file, $out, LOCK_EX) !== false;
}
function careers_sitemap_add($url) {
    global $ROOT;
    $f = $ROOT . '/sitemap-misc.xml';
    if (!is_file($f)) return;
    $s = file_get_contents($f);
    if (strpos($s, '<loc>' . $url . '</loc>') !== false) return;
    $entry = "  <url><loc>" . htmlspecialchars($url, ENT_XML1) . "</loc><lastmod>" . date('Y-m-d') . "</lastmod><priority>0.6</priority></url>\n</urlset>";
    $s = str_replace('</urlset>', $entry, $s);
    file_put_contents($f, $s, LOCK_EX);
}
function careers_sitemap_remove($url) {
    global $ROOT;
    $f = $ROOT . '/sitemap-misc.xml';
    if (!is_file($f)) return;
    $s = file_get_contents($f);
    $s2 = preg_replace('#\s*<url><loc>' . preg_quote($url, '#') . '</loc>.*?</url>#s', '', $s, 1);
    if ($s2) file_put_contents($f, $s2, LOCK_EX);
}
function careers_publish_public() {
    global $JOBS_FILE, $STATUS_FILE, $ROOT;
    $jobs = careers_read($JOBS_FILE);
    $pub = [];
    foreach ($jobs as $j) {
        if (empty($j['published'])) continue;
        $pub[] = ['slug' => $j['slug'], 'titleFa' => $j['titleFa'] ?? '', 'titleEn' => $j['titleEn'] ?? ''];
    }
    $statusDir = dirname($STATUS_FILE);
    if (!is_dir($statusDir)) mkdir($statusDir, 0755, true);
    file_put_contents($STATUS_FILE, json_encode(['count' => count($pub), 'jobs' => $pub], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), LOCK_EX);
    careers_replace_marker($ROOT . '/careers/index.html', '<!--PTF_CAREERS_LIST-->', '<!--/PTF_CAREERS_LIST-->', careers_list_inner($jobs));
    careers_replace_marker($ROOT . '/en/careers.html', '<!--PTF_CAREERS_LIST-->', '<!--/PTF_CAREERS_LIST-->', careers_en_inner($jobs));
}

if (!in_array($action, $PUBLIC, true)) {
    careers_auth();
}

if ($action === 'apply') {
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') jerr('method', 405);
    $rl_dir = $DATA;
    if (!is_dir($rl_dir)) { mkdir($rl_dir, 0755, true); file_put_contents($rl_dir . '/.htaccess', "Deny from all\n"); }
    $rl_file = $rl_dir . '/careers_ratelimit.json';
    $rl = is_file($rl_file) ? (json_decode((string)file_get_contents($rl_file), true) ?: []) : [];
    $ip_key = hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? 'x') . '|apply');
    $hour = date('YmdH');
    foreach ($rl as $k => $v) { if (($v['h'] ?? '') !== $hour) unset($rl[$k]); }
    $rl[$ip_key] = ['h' => $hour, 'n' => ($rl[$ip_key]['n'] ?? 0) + 1];
    file_put_contents($rl_file, json_encode($rl), LOCK_EX);
    if ($rl[$ip_key]['n'] > 8) jerr('تعداد درخواست بیش از حد مجاز — لطفاً بعداً تلاش کنید', 429);
    if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 6 * 1048576) jerr('حجم درخواست بیش از حد مجاز', 413);
}

switch ($action) {
    case 'published':
        $pub = [];
        foreach (careers_published_jobs() as $j) {
            $pub[] = [
                'slug' => $j['slug'],
                'titleFa' => $j['titleFa'] ?? '',
                'titleEn' => $j['titleEn'] ?? '',
                'dept' => $j['dept'] ?? '',
                'location' => $j['location'] ?? '',
            ];
        }
        jok(['count' => count($pub), 'jobs' => $pub]);
        break;

    case 'apply':
        if (!empty($_POST['website'] ?? '')) jok(['message' => 'OK']);
        careers_purge_apps();
        if (!is_string($CAPTCHA_SECRET) || strlen($CAPTCHA_SECRET) < 32) jerr('captcha_not_configured', 503);
        if (!careers_captcha_ok()) jerr('captcha', 403);
        $slug = careers_slug($_POST['slug'] ?? '');
        $job = careers_find($slug);
        if (!$job || empty($job['published'])) jerr('این فرصت شغلی باز نیست', 422);
        if (!careers_published_jobs()) jerr('در حال حاضر فرصت شغلی فعال نیست', 422);
        $name = careers_clean($_POST['name'] ?? '', 120);
        $mobile = careers_digits($_POST['mobile'] ?? '');
        $email = careers_clean($_POST['email'] ?? '', 160);
        $edu = preg_replace('/[^a-z0-9_]/', '', (string)($_POST['education'] ?? ''));
        $exp = preg_replace('/[^a-z0-9_]/', '', (string)($_POST['experience'] ?? ''));
        $sal = preg_replace('/[^a-z0-9_]/', '', (string)($_POST['salary'] ?? ''));
        if ($name === '' || !preg_match('/^09\d{9}$/', $mobile) || !filter_var($email, FILTER_VALIDATE_EMAIL)) jerr('فیلدهای الزامی نامعتبر است', 422);
        if (!isset($EDU[$edu]) || !isset($EXP[$exp]) || !isset($SAL[$sal])) jerr('گزینه نامعتبر', 422);
        if (careers_sms_enabled()) {
            $otok = $_POST['otp_token'] ?? '';
            if (!$otok || !careers_otp_ok($otok, $mobile)) jerr('otp', 403);
        }
        if (empty($_FILES['resume']['name']) || !is_uploaded_file($_FILES['resume']['tmp_name'] ?? '')) jerr('فایل رزومه الزامی است', 422);
        $orig = (string)$_FILES['resume']['name'];
        $ext = strtolower(pathinfo($orig, PATHINFO_EXTENSION));
        $size = (int)($_FILES['resume']['size'] ?? 0);
        if ($ext !== 'pdf' || $size < 1 || $size > $PDF_MAX) jerr('رزومه باید PDF و حداکثر ۵ مگابایت باشد', 422);
        $fh = fopen($_FILES['resume']['tmp_name'], 'rb');
        $magic = $fh ? fread($fh, 4) : '';
        if ($fh) fclose($fh);
        if ($magic !== '%PDF') jerr('فایل رزومه PDF معتبر نیست', 422);
        $key = ptf_storage_object_key('careers-resume', $orig);
        $put = ptf_storage_put_uploaded_file($_FILES['resume']['tmp_name'], $key);
        if (empty($put['ok'])) jerr('پیوست در فضای ابری ذخیره نشد: ' . ($put['error'] ?? 'خطا'), 503);
        $apps = careers_read($APPS_FILE);
        $rec = [
            'id' => 'APP-' . bin2hex(random_bytes(6)),
            'jobSlug' => $slug,
            'name' => $name,
            'mobile' => $mobile,
            'email' => $email,
            'education' => $edu,
            'experience' => $exp,
            'salary' => $sal,
            'resume' => ['key' => $key, 'name' => $orig, 'size' => $size, 'mode' => 'arvan'],
            'createdAt' => date('c'),
        ];
        $apps[] = $rec;
        if (!careers_write($APPS_FILE, $apps)) jerr('ذخیره درخواست ناموفق بود', 500);
        jok(['id' => $rec['id'], 'message' => 'درخواست شما ثبت شد.']);
        break;

    case 'list_jobs':
        jok(['jobs' => careers_read($JOBS_FILE)]);
        break;

    case 'save_job':
        $slug = careers_slug($_POST['slug'] ?? '');
        if (!preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/', $slug) || strlen($slug) > 80) jerr('نامک انگلیسی نامعتبر است');
        $titleFa = careers_clean($_POST['titleFa'] ?? '', 180);
        $titleEn = careers_clean($_POST['titleEn'] ?? '', 180);
        $bodyFa = careers_clean($_POST['bodyFa'] ?? '', 20000);
        $bodyEn = careers_clean($_POST['bodyEn'] ?? '', 20000);
        if ($titleFa === '' || $titleEn === '' || $bodyFa === '' || $bodyEn === '') jerr('عنوان و متن فارسی و انگلیسی الزامی است');
        $jobs = careers_read($JOBS_FILE);
        $found = false;
        $now = date('c');
        $published = !isset($_POST['published']) || $_POST['published'] === '1' || $_POST['published'] === 'true';
        foreach ($jobs as &$j) {
            if (($j['slug'] ?? '') === $slug) {
                $j['titleFa'] = $titleFa; $j['titleEn'] = $titleEn;
                $j['bodyFa'] = $bodyFa; $j['bodyEn'] = $bodyEn;
                $j['dept'] = careers_clean($_POST['dept'] ?? '', 80);
                $j['location'] = careers_clean($_POST['location'] ?? '', 80);
                $j['published'] = $published;
                $j['updatedAt'] = $now;
                $found = true;
                $job = $j;
                break;
            }
        }
        unset($j);
        if (!$found) {
            $job = [
                'slug' => $slug, 'titleFa' => $titleFa, 'titleEn' => $titleEn,
                'bodyFa' => $bodyFa, 'bodyEn' => $bodyEn,
                'dept' => careers_clean($_POST['dept'] ?? '', 80),
                'location' => careers_clean($_POST['location'] ?? '', 80),
                'published' => $published, 'createdAt' => $now, 'updatedAt' => $now,
            ];
            $jobs[] = $job;
        }
        if (!careers_save_jobs($jobs)) jerr('ذخیره آگهی ناموفق بود');
        $w = careers_write_job_page($job);
        if ($w !== true) jerr($w);
        $url = 'https://pishtaj.ir/careers/' . $slug . '/';
        if (!empty($job['published'])) careers_sitemap_add($url); else careers_sitemap_remove($url);
        careers_publish_public();
        jok(['slug' => $slug, 'url' => 'careers/' . $slug . '/']);
        break;

    case 'close_job':
    case 'reopen_job':
        $slug = careers_slug($_POST['slug'] ?? '');
        $jobs = careers_read($JOBS_FILE);
        $hit = null;
        foreach ($jobs as &$j) {
            if (($j['slug'] ?? '') === $slug) {
                $j['published'] = ($action === 'reopen_job');
                $j['updatedAt'] = date('c');
                $hit = $j;
                break;
            }
        }
        unset($j);
        if (!$hit) jerr('آگهی یافت نشد', 404);
        careers_save_jobs($jobs);
        $w = careers_write_job_page($hit);
        if ($w !== true) jerr($w);
        $url = 'https://pishtaj.ir/careers/' . $slug . '/';
        if (!empty($hit['published'])) careers_sitemap_add($url); else careers_sitemap_remove($url);
        careers_publish_public();
        jok(['slug' => $slug, 'published' => !empty($hit['published'])]);
        break;

    case 'list_apps':
        $n = careers_purge_apps();
        $slug = careers_slug($_GET['slug'] ?? $_POST['slug'] ?? '');
        $apps = careers_read($APPS_FILE);
        if ($slug !== '') {
            $apps = array_values(array_filter($apps, function ($a) use ($slug) { return ($a['jobSlug'] ?? '') === $slug; }));
        }
        $apps = array_reverse($apps);
        jok(['apps' => $apps, 'purged' => $n]);
        break;

    case 'get_app':
        $id = preg_replace('/[^A-Za-z0-9\-]/', '', (string)($_GET['id'] ?? $_POST['id'] ?? ''));
        foreach (careers_read($APPS_FILE) as $a) {
            if (($a['id'] ?? '') === $id) jok(['app' => $a]);
        }
        jerr('یافت نشد', 404);
        break;

    case 'purge_old':
        jok(['purged' => careers_purge_apps()]);
        break;

    default:
        jerr('action نامعتبر');
}
