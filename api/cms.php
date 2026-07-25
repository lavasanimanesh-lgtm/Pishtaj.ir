<?php
/**
 * PTF — Mini-CMS API (US-130) — Sprint 75
 * مدیریت اخبار، مقالات وبلاگ و سئوی صفحات از داخل پنل CRM
 * دسترسی: فقط admin و chairman (هدر X-CRM-Role — الگوی موجود)
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
if (!in_array($ROLE, ['admin', 'chairman'], true)) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'permission_denied'], JSON_UNESCAPED_UNICODE);
    exit;
}

$ROOT = dirname(__DIR__);
$DATA = $ROOT . '/crm/data';
if (!is_dir($DATA)) { mkdir($DATA, 0755, true); file_put_contents($DATA . '/.htaccess', "Deny from all\n"); }

$action = $_REQUEST['action'] ?? '';

function jerr($m) { echo json_encode(['ok' => false, 'error' => $m], JSON_UNESCAPED_UNICODE); exit; }
function jok($extra = []) { echo json_encode(array_merge(['ok' => true], $extra), JSON_UNESCAPED_UNICODE); exit; }

function cms_log($a, $ref = '') {
    global $DATA, $ROLE;
    $f = $DATA . '/cms_log.txt';
    $line = date('Y-m-d H:i:s') . " | $ROLE | $a | $ref\n";
    $old = file_exists($f) ? file_get_contents($f) : '';
    file_put_contents($f, $line . substr($old, 0, 20000));
}

/* جایگزینی امن یک آرایه JS در فایل HTML (درج نقطه‌ای + assert یکتایی) */
function replace_js_array($file, $marker, $jsonItems) {
    if (!file_exists($file)) return 'فایل یافت نشد: ' . basename($file);
    $s = file_get_contents($file);
    $start = strpos($s, $marker);
    if ($start === false) return 'نشانگر یافت نشد';
    if (strpos($s, $marker, $start + 1) !== false) return 'نشانگر یکتا نیست — عملیات لغو شد';
    $endMark = "\n];";
    $end = strpos($s, $endMark, $start);
    if ($end === false) return 'انتهای آرایه یافت نشد';
    $rows = array_map(function ($it) { return '  ' . json_encode($it, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); }, $jsonItems);
    $new = $marker . "\n" . implode(",\n", $rows);
    $out = substr($s, 0, $start) . $new . substr($s, $end);
    // sanity: حجم فایل نباید بیش از ۳ برابر شود (درس حادثه ۴۶MB)
    if (strlen($out) > max(strlen($s) * 3, 500000)) return 'حجم خروجی غیرعادی — عملیات لغو شد';
    if (file_put_contents($file, $out, LOCK_EX) === false) return 'خطای نوشتن فایل (مجوز write?)';
    return true;
}

function sitemap_add($url) {
    global $ROOT;
    $f = $ROOT . '/sitemap.xml';
    if (!file_exists($f)) return;
    $s = file_get_contents($f);
    if (strpos($s, '<loc>' . $url . '</loc>') !== false) return;
    $entry = "  <url><loc>" . htmlspecialchars($url, ENT_XML1) . "</loc><lastmod>" . date('Y-m-d') . "</lastmod></url>\n</urlset>";
    $s = str_replace('</urlset>', $entry, $s);
    file_put_contents($f, $s, LOCK_EX);
}
function sitemap_remove($url) {
    global $ROOT;
    $f = $ROOT . '/sitemap.xml';
    if (!file_exists($f)) return;
    $s = file_get_contents($f);
    $s = preg_replace('#\s*<url><loc>' . preg_quote($url, '#') . '</loc>.*?</url>#s', '', $s, 1);
    file_put_contents($f, $s, LOCK_EX);
}

switch ($action) {

    /* ============ AC1: اخبار ============ */
    case 'news_save':
        $items = json_decode($_POST['items'] ?? '[]', true);
        if (!is_array($items)) jerr('ساختار نامعتبر');
        if (count($items) > 200) jerr('حداکثر ۲۰۰ خبر');
        $clean = [];
        foreach ($items as $it) {
            $clean[] = [
                'date'  => mb_substr(strip_tags($it['date'] ?? ''), 0, 20),
                'title' => mb_substr(strip_tags($it['title'] ?? ''), 0, 200),
                'tag'   => mb_substr(strip_tags($it['tag'] ?? ''), 0, 40),
                'cat'   => preg_replace('/[^a-z]/', '', $it['cat'] ?? 'event'),
                'desc'  => mb_substr(strip_tags($it['desc'] ?? ''), 0, 1500),
            ];
        }
        $r = replace_js_array($ROOT . '/news/index.html', 'const news = [', $clean);
        if ($r !== true) jerr($r);
        file_put_contents($DATA . '/cms_news.json', json_encode($clean, JSON_UNESCAPED_UNICODE), LOCK_EX);
        cms_log('news_save', count($clean) . ' خبر');
        jok(['count' => count($clean)]);
        break;

    /* ============ AC2: مقاله وبلاگ ============ */
    case 'blog_create':
        $title = mb_substr(strip_tags($_POST['title'] ?? ''), 0, 200);
        $desc  = mb_substr(strip_tags($_POST['desc'] ?? ''), 0, 300);
        $cat   = preg_replace('/[^a-z]/', '', $_POST['cat'] ?? 'procurement');
        $catLb = mb_substr(strip_tags($_POST['catLb'] ?? 'تامین و کیفیت'), 0, 60);
        $slug  = strtolower(preg_replace('/[^a-z0-9\-]/', '', $_POST['slug'] ?? ''));
        $body  = $_POST['body'] ?? '';
        $img   = preg_replace('#[^a-zA-Z0-9/\-_.]#', '', $_POST['img'] ?? '../assets/images/real/piping-flanges.jpeg');
        if (!$title || !$slug || mb_strlen(strip_tags($body)) < 100) jerr('عنوان، نامک (slug) و متن حداقل ۱۰۰ کاراکتر الزامی است');
        $file = $ROOT . '/blog/' . $slug . '.html';
        if (file_exists($file) && empty($_POST['overwrite'])) jerr('exists');

        // پاکسازی بدنه: فقط تگ‌های امن
        $body = strip_tags($body, '<h2><h3><p><ul><ol><li><b><strong><i><em><table><thead><tbody><tr><th><td><br><blockquote><a>');
        $body = preg_replace('/on\w+\s*=\s*"[^"]*"/i', '', $body);
        $body = preg_replace("/on\w+\s*=\s*'[^']*'/i", '', $body);
        $body = preg_replace('/javascript\s*:/i', '', $body);
        // پاراگراف‌بندی خودکار متن ساده
        if (strpos($body, '<p>') === false && strpos($body, '<h2>') === false) {
            $body = '<p>' . implode('</p><p>', array_filter(array_map('trim', preg_split('/\n{2,}/', $body)))) . '</p>';
            $body = str_replace("\n", '<br>', $body);
        }

        // اسکلت از یک مقاله موجود (هدر/فوتر/استایل یکسان با سایت)
        $skel = file_get_contents($ROOT . '/blog/gas-detection.html');
        if (!$skel) jerr('قالب مرجع یافت نشد');
        $header = substr($skel, strpos($skel, '<body>'), strpos($skel, '<section class="article-hero"') - strpos($skel, '<body>'));
        $footer = substr($skel, strpos($skel, '<footer'));
        $style  = substr($skel, strpos($skel, '<style>'), strpos($skel, '</style>') + 8 - strpos($skel, '<style>'));
        $tEsc = htmlspecialchars($title, ENT_QUOTES, 'UTF-8');
        $dEsc = htmlspecialchars($desc, ENT_QUOTES, 'UTF-8');
        $url = 'https://pishtaj.ir/blog/' . $slug . '.html';
        $faDate = ''; // تاریخ شمسی از کلاینت
        if (!empty($_POST['dateFa'])) $faDate = mb_substr(strip_tags($_POST['dateFa']), 0, 20);

        $html = '<!doctype html>
<html lang="fa" dir="rtl">
<head>
<link rel="icon" type="image/png" sizes="32x32" href="../assets/images/favicon/favicon-32.png"><link rel="icon" type="image/png" sizes="96x96" href="../assets/images/favicon/favicon-96.png"><link rel="icon" type="image/png" sizes="192x192" href="../assets/images/favicon/favicon-192.png"><link rel="apple-touch-icon" sizes="180x180" href="../assets/images/favicon/apple-touch-icon.png"><link rel="shortcut icon" href="../favicon.ico">
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>' . $tEsc . ' | پیشرو تجهیز فرتاک</title>
<meta name="description" content="' . $dEsc . '" />
<meta name="robots" content="index, follow" />
<link rel="canonical" href="' . $url . '" />
<meta property="og:locale" content="fa_IR" />
<meta property="og:site_name" content="پیشرو تجهیز فرتاک" />
<meta property="og:title" content="' . $tEsc . '" />
<meta property="og:description" content="' . $dEsc . '" />
<meta property="og:type" content="article" />
<meta property="og:url" content="' . $url . '" />
<meta name="twitter:card" content="summary_large_image" />
<link rel="stylesheet" href="../assets/css/style.css" />
<script type="application/ld+json">' . json_encode([
            '@context' => 'https://schema.org', '@type' => 'Article',
            'headline' => $title, 'description' => $desc,
            'author' => ['@type' => 'Organization', 'name' => 'پیشرو تجهیز فرتاک'],
            'mainEntityOfPage' => ['@type' => 'WebPage', '@id' => $url]
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . '</script>
' . $style . '
</head>
' . $header . '<section class="article-hero">
<div class="container">
<span style="background:rgba(239,75,26,.2);color:#ffb033;padding:6px 14px;border-radius:999px;font-size:12.5px;font-weight:800">' . htmlspecialchars($catLb, ENT_QUOTES, 'UTF-8') . '</span>
<h1>' . $tEsc . '</h1>
<p style="color:rgba(255,255,255,.75);font-size:14px">' . ($faDate ? 'تاریخ انتشار: ' . htmlspecialchars($faDate, ENT_QUOTES, 'UTF-8') . ' | ' : '') . 'واحد محتوای فنی پیشرو تجهیز فرتاک</p>
</div>
</section>
<div class="article-wrap">
<div class="article-content">
' . $body . '
<div style="background:#fff8f0;border:1px solid #f6c17c;border-radius:16px;padding:18px 22px;margin-top:30px">
<b>نیاز به استعلام قیمت دارید؟</b> کارشناسان پیشرو تجهیز فرتاک آماده پاسخگویی هستند: <a href="../rfq/" style="color:var(--red);font-weight:800">ثبت استعلام هوشمند ←</a>
</div>
</div>
</div>
' . $footer;

        if (file_put_contents($file, $html, LOCK_EX) === false) jerr('خطای نوشتن فایل مقاله (مجوز write?)');

        // افزودن به فهرست وبلاگ
        $meta = ['t' => $title, 'c' => $cat, 'u' => $slug . '.html', 'cat' => $catLb, 'img' => $img, 'desc' => $desc];
        $idxFile = $ROOT . '/blog/index.html';
        $s = file_get_contents($idxFile);
        $mk = 'const articles = [';
        $p = strpos($s, $mk);
        if ($p !== false && strpos($s, $mk, $p + 1) === false) {
            $ins = $mk . "\n  " . json_encode($meta, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . ',';
            $s = substr($s, 0, $p) . $ins . substr($s, $p + strlen($mk));
            file_put_contents($idxFile, $s, LOCK_EX);
        }
        sitemap_add($url);
        cms_log('blog_create', $slug);
        jok(['url' => 'blog/' . $slug . '.html']);
        break;

    case 'blog_list':
        $files = glob($ROOT . '/blog/*.html');
        $out = [];
        foreach ($files as $f) {
            $b = basename($f);
            if ($b === 'index.html') continue;
            $c = file_get_contents($f, false, null, 0, 3000);
            preg_match('/<title>(.*?)(\||<)/su', $c, $m);
            $out[] = ['file' => $b, 'title' => trim($m[1] ?? $b), 'size' => filesize($f), 'archived' => strpos($c, 'http-equiv="refresh"') !== false];
        }
        jok(['articles' => $out]);
        break;

    case 'blog_archive':
        // حذف = آرشیو + ریدایرکت (حفظ سئو)
        $slug = strtolower(preg_replace('/[^a-z0-9\-]/', '', $_POST['slug'] ?? ''));
        if (!$slug) jerr('slug لازم است');
        $file = $ROOT . '/blog/' . $slug . '.html';
        if (!file_exists($file)) jerr('یافت نشد');
        // بکاپ نسخه اصلی در پوشه محافظت‌شده
        $bdir = $DATA . '/cms-archive';
        if (!is_dir($bdir)) { mkdir($bdir, 0755, true); }
        copy($file, $bdir . '/' . $slug . '-' . date('Ymd-His') . '.html');
        $stub = '<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=/blog/"><link rel="canonical" href="https://pishtaj.ir/blog/"><meta name="robots" content="noindex"><title>منتقل شد</title></head><body><p>این مقاله آرشیو شده — <a href="/blog/">وبلاگ ←</a></p></body></html>';
        file_put_contents($file, $stub, LOCK_EX);
        // حذف از فهرست وبلاگ
        $idxFile = $ROOT . '/blog/index.html';
        $s = file_get_contents($idxFile);
        $s2 = preg_replace('/^\s*\{[^\n]*"u"\s*:\s*"' . preg_quote($slug, '/') . '\.html"[^\n]*\},?\n/mu', '', $s, 1, $cnt);
        if ($cnt === 0) $s2 = preg_replace('/^\s*\{[^\n]*u:\s*"' . preg_quote($slug, '/') . '\.html"[^\n]*\},?\n/mu', '', $s, 1);
        if ($s2) file_put_contents($idxFile, $s2, LOCK_EX);
        sitemap_remove('https://pishtaj.ir/blog/' . $slug . '.html');
        cms_log('blog_archive', $slug);
        jok();
        break;

    /* ============ AC3 (فاز سبک): سئوی صفحات — title و description ============ */
    case 'page_list':
        $pages = [];
        $scan = ['', 'services/', 'industries/', 'projects/', 'quality/', 'about/', 'news/', 'blog/', 'tools/', 'rfq/', 'supplier/', 'tracking/', 'assistant/', 'catalog/', 'logistics/'];
        foreach ($scan as $d) {
            $f = $ROOT . '/' . $d . 'index.html';
            if (!file_exists($f)) continue;
            $c = file_get_contents($f, false, null, 0, 4000);
            preg_match('/<title>(.*?)<\/title>/su', $c, $m1);
            preg_match('/<meta name="description" content="(.*?)"/su', $c, $m2);
            $pages[] = ['path' => $d ?: '(صفحه اصلی)', 'file' => $d . 'index.html', 'title' => $m1[1] ?? '', 'desc' => $m2[1] ?? ''];
        }
        jok(['pages' => $pages]);
        break;

    case 'page_meta_save':
        $file = $_POST['file'] ?? '';
        if (!preg_match('#^[a-z0-9\-/]*index\.html$#', $file)) jerr('مسیر نامعتبر');
        $f = $ROOT . '/' . $file;
        if (!file_exists($f)) jerr('یافت نشد');
        $title = mb_substr(strip_tags($_POST['title'] ?? ''), 0, 200);
        $desc = mb_substr(strip_tags($_POST['desc'] ?? ''), 0, 300);
        if (!$title) jerr('عنوان خالی است');
        $s = file_get_contents($f);
        $s = preg_replace('/<title>.*?<\/title>/su', '<title>' . htmlspecialchars($title, ENT_QUOTES, 'UTF-8') . '</title>', $s, 1);
        $s = preg_replace('/(<meta name="description" content=").*?(")/su', '${1}' . htmlspecialchars($desc, ENT_QUOTES, 'UTF-8') . '${2}', $s, 1);
        file_put_contents($f, $s, LOCK_EX);
        cms_log('page_meta_save', $file);
        jok();
        break;

    case 'status':
        jok([
            'zip' => class_exists('ZipArchive'),
            'writable' => is_writable($ROOT . '/news/index.html') && is_writable($ROOT . '/blog/index.html'),
        ]);
        break;

    default:
        jerr('action نامعتبر');
}
