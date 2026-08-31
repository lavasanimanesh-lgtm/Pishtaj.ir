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
/* v34.9.1 (BUG-SEO-CMS-ROLE): سمت کلاینت در cms.js و perms.js چهار نقش را مجاز
   می‌دانست ولی اینجا فقط دو نقش قبول بود؛ در نتیجه مدیرعامل و مدیر بازرگانی
   روی هر اکشن CMS خطای ۴۰۳ می‌گرفتند (از جمله ذخیرهٔ سئو). */
if (!in_array($ROLE, ['admin', 'chairman', 'ceo', 'commercial'], true)) {
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


    /* =====================================================================
   v34.9.1 (US-SEO-TAB): اسکنِ سراسریِ سئوی صفحات عمومی
   - فقط پوشه‌های عمومی؛ پوشه‌های فنی/ادمین/داده حذف هستند
   - نتیجه در crm/data کش می‌شود (اسکن کامل روی هاست اشتراکی سنگین است)
   ===================================================================== */

function cms_skip_dir($d) {
  static $skip = array('.git', 'node_modules', 'crm', 'api', '_tools', '_audit',
    '_human_test', '_personas', 'docs-deploy', 'docs', 'assets', 'ptf-snapshots',
    'ptf-all-photos', 'service-photos', '.github', '.well-known', 'snapshots');
  return in_array($d, $skip, true) || (isset($d[0]) && $d[0] === '.');
}

function cms_public_pages($ROOT) {
  $out = array();
  $stack = array('');
  while ($stack) {
    $dir = array_pop($stack);
    $abs = $dir === '' ? $ROOT : $ROOT . '/' . $dir;
    $dh = @opendir($abs);
    if (!$dh) continue;
    while (($e = readdir($dh)) !== false) {
      if ($e === '.' || $e === '..') continue;
      $rel = $dir === '' ? $e : $dir . '/' . $e;
      if (is_dir($abs . '/' . $e)) { if (!cms_skip_dir($e)) $stack[] = $rel; continue; }
      if (substr($e, -5) !== '.html') continue;
      if ($e === '404.html' || $e === 'sitemap.html') continue;
      $out[] = $rel;
    }
    closedir($dh);
  }
  sort($out);
  return $out;
}

function cms_sitemap_urls($ROOT) {
  $urls = array();
  $idx = $ROOT . '/sitemap-index.xml';
  $files = array();
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
      foreach ($m2[1] as $loc) $urls[$loc] = $local;
    }
  }
  return $urls;
}

function cms_visible_words($html) {
  $b = $html;
  if (preg_match('#<body[^>]*>(.*)</body>#isu', $html, $m)) $b = $m[1];
  $b = preg_replace('#<(script|style|noscript|template)\b[^>]*>.*?</\1>#isu', ' ', $b);
  $t = strip_tags($b);
  $t = html_entity_decode($t, ENT_QUOTES | ENT_HTML5, 'UTF-8');
  preg_match_all('#[\x{0600}-\x{06FF}\x{FB8A}]+|[A-Za-z][A-Za-z\-]{1,}#u', $t, $mm);
  return isset($mm[0]) ? count($mm[0]) : 0;
}

function cms_head($html) {
  $p = stripos($html, '</head>');
  return $p === false ? substr($html, 0, 40000) : substr($html, 0, $p);
}

function cms_meta_of($ROOT, $rel, &$smap) {
  $path = $ROOT . '/' . $rel;
  $html = (string)@file_get_contents($path);
  $head = cms_head($html);
  $url = 'https://pishtaj.ir/' . $rel;
  $get = function ($pat) use ($head) {
    return preg_match($pat, $head, $m) ? trim($m[1]) : '';
  };
  $title = $get('#<title[^>]*>(.*?)</title>#isu');
  $title = trim(preg_replace('#\s+#u', ' ', strip_tags($title)));
  $desc  = $get('#<meta\s+name=["\']description["\']\s+content=["\'](.*?)["\']#isu');
  if ($desc === '') $desc = $get('#<meta\s+content=["\'](.*?)["\']\s+name=["\']description["\']#isu');
  $desc = trim(preg_replace('#\s+#u', ' ', $desc));
  $can  = $get('#<link[^>]*rel=["\']canonical["\'][^>]*href=["\'](.*?)["\']#isu');
  if ($can === '') $can = $get('#<link[^>]*href=["\'](.*?)["\'][^>]*rel=["\']canonical["\']#isu');
  $rob  = $get('#<meta\s+name=["\']robots["\']\s+content=["\'](.*?)["\']#isu');
  // h1 در <body> است نه <head>؛ پس روی سندِ کامل جستجو می‌شود (بدونِ script/style/noscript/template
  // تا h1ِ داخلِ رشتهٔ جاوااسکریپت شمرده نشود) — مثلِ همان پاک‌سازیِ cms_visible_words()
  $h1src = preg_replace('#<(script|style|noscript|template)\b[^>]*>.*?</\1>#isu', ' ', $html);
  $h1   = preg_match('#<h1[^>]*>(.*?)</h1>#isu', $h1src, $hm) ? trim($hm[1]) : '';
  $h1   = trim(preg_replace('#\s+#u', ' ', strip_tags($h1)));

  $words  = cms_visible_words($html);
  $imgs   = preg_match_all('#<img\b[^>]*>#isu', $html, $im) ? $im[0] : array();
  $noalt  = 0;
  foreach ($imgs as $im2) {
    // فقط نبودِ «صفتِ alt» ایراد است؛ alt="" برای تصویرِ تزئینی (مثلِ preloader با aria-hidden) درست است
    if (!preg_match('#\balt\s*=#isu', $im2)) $noalt++;
  }
  $schema = array();
  if (preg_match_all('#<script[^>]*application/ld\+json[^>]*>(.*?)</script>#isu', $html, $lm)) {
    foreach ($lm[1] as $raw) {
      $j = json_decode(trim($raw), true);
      if (!is_array($j)) continue;
      $items = isset($j['@graph']) ? $j['@graph'] : array($j);
      foreach ($items as $it) if (is_array($it) && !empty($it['@type'])) {
        $t = $it['@type'];
        foreach ((is_array($t) ? $t : array($t)) as $one) $schema[$one] = 1;
      }
    }
  }

  $cands = array('https://pishtaj.ir/' . $rel);
  if (substr($rel, -10) === 'index.html') $cands[] = 'https://pishtaj.ir/' . substr($rel, 0, -10);
  if ($rel === 'index.html') $cands[] = 'https://pishtaj.ir/';
  $sitemap = '';
  foreach ($cands as $c) if (isset($smap[$c])) { $sitemap = $smap[$c]; break; }

  $issues = array();
  if ($title === '') $issues[] = 'no-title';
  else {
    if (mb_strlen($title, 'UTF-8') < 30) $issues[] = 'title-short';
    if (mb_strlen($title, 'UTF-8') > 65) $issues[] = 'title-long';
  }
  if ($desc === '') $issues[] = 'no-desc';
  else {
    if (mb_strlen($desc, 'UTF-8') < 70) $issues[] = 'desc-short';
    if (mb_strlen($desc, 'UTF-8') > 165) $issues[] = 'desc-long';
  }
  if ($can === '') $issues[] = 'no-canonical';
  elseif (rtrim($can, '/') !== rtrim($url, '/')
      && rtrim($can, '/') !== rtrim(preg_replace('#/index\.html$#', '', $url), '/')) {
    $issues[] = 'canonical-mismatch';
  }
  if ($h1 === '') $issues[] = 'no-h1';
  if (stripos($rob, 'noindex') !== false) $issues[] = 'noindex';
  if ($words < 350) $issues[] = 'thin-content';
  if ($noalt > 0) $issues[] = 'img-no-alt';
  if ($sitemap === '') $issues[] = 'not-in-sitemap';
  if (!$schema) $issues[] = 'no-schema';

  return array(
    'path' => $rel,
    'url' => $url,
    'folder' => strpos($rel, '/') === false ? '(ریشه)' : substr($rel, 0, strpos($rel, '/')),
    'title' => $title, 'title_len' => mb_strlen($title, 'UTF-8'),
    'desc' => $desc, 'desc_len' => mb_strlen($desc, 'UTF-8'),
    'canonical' => $can, 'robots' => $rob, 'h1' => $h1,
    'words' => $words, 'img_no_alt' => $noalt,
    'schema' => implode('|', array_keys($schema)),
    'sitemap' => $sitemap,
    'size_kb' => round(filesize($path) / 1024, 1),
    'issues' => $issues,
  );
}

function cms_seo_scan($ROOT, $DATA, $force = false) {
  $cacheFile = $DATA . '/cms-seo-scan.json';
  $ttl = 600; /* ۱۰ دقیقه */
  if (!$force && is_file($cacheFile)) {
    $raw = (string)@file_get_contents($cacheFile);
    $j = json_decode($raw, true);
    if (is_array($j) && !empty($j['ts']) && (time() - (int)$j['ts']) < $ttl && !empty($j['pages'])) {
      return $j;
    }
  }
  $smap = cms_sitemap_urls($ROOT);
  $pages = array();
  foreach (cms_public_pages($ROOT) as $rel) {
    $pages[] = cms_meta_of($ROOT, $rel, $smap);
  }
  $res = array('ts' => time(), 'pages' => $pages, 'sitemap_count' => count($smap));
  @file_put_contents($cacheFile, json_encode($res, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), LOCK_EX);
  return $res;
}

function cms_backup($DATA, $ROOT, $rel) {
  $dir = $DATA . '/cms-backups';
  if (!is_dir($dir)) { @mkdir($dir, 0755, true); @file_put_contents($dir . '/.htaccess', "Deny from all\n"); }
  $safe = str_replace(array('/', '\\'), '__', $rel);
  $stamp = date('Ymd-His');
  @copy($ROOT . '/' . $rel, $dir . '/' . $safe . '--' . $stamp . '.html');
  /* نگهداری ۳ نسخهٔ آخر هر فایل */
  $old = glob($dir . '/' . $safe . '--*.html');
  if (is_array($old) && count($old) > 3) {
    rsort($old);
    foreach (array_slice($old, 3) as $o) @unlink($o);
  }
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

    /* ============ AC3 (v34.9.1): سئوی صفحات — اسکن سراسری + ویرایش امن ============ */
    case 'page_list':
        $force  = !empty($_REQUEST['refresh']);
        $scan   = cms_seo_scan($ROOT, $DATA, $force);
        $pages  = $scan['pages'];

        /* --- فیلترها --- */
        $q      = isset($_REQUEST['q']) ? mb_strtolower(trim((string)$_REQUEST['q']), 'UTF-8') : '';
        $folder = isset($_REQUEST['folder']) ? trim((string)$_REQUEST['folder']) : '';
        $issue  = isset($_REQUEST['issue']) ? trim((string)$_REQUEST['issue']) : '';
        if ($q !== '' || $folder !== '' || $issue !== '') {
            $filtered = array();
            foreach ($pages as $pg) {
                if ($folder !== '' && $pg['folder'] !== $folder) continue;
                if ($issue !== '' && !in_array($issue, $pg['issues'], true)) continue;
                if ($q !== '' && mb_strpos(mb_strtolower($pg['path'] . ' ' . $pg['title'], 'UTF-8'), $q, 0, 'UTF-8') === false) continue;
                $filtered[] = $pg;
            }
            $pages = $filtered;
        }

        /* --- مرتب‌سازی: پر‌ایرادترین‌ها اول --- */
        usort($pages, function ($a, $b) {
            $ca = count($a['issues']); $cb = count($b['issues']);
            if ($ca !== $cb) return $cb - $ca;
            return strcmp($a['path'], $b['path']);
        });

        /* --- آمار کلی (روی کل سایت، نه فقط نمای فیلترشده) --- */
        $stats = array(
            'total' => 0, 'no-desc' => 0, 'desc-long' => 0, 'desc-short' => 0,
            'title-long' => 0, 'title-short' => 0, 'no-title' => 0, 'no-h1' => 0,
            'no-canonical' => 0, 'canonical-mismatch' => 0, 'noindex' => 0,
            'thin-content' => 0, 'img-no-alt' => 0, 'not-in-sitemap' => 0,
            'no-schema' => 0, 'ok' => 0,
        );
        $folders = array();
        foreach ($scan['pages'] as $pg) {
            $stats['total']++;
            if (!$pg['issues']) { $stats['ok']++; }
            foreach ($pg['issues'] as $is) if (isset($stats[$is])) $stats[$is]++;
            $f = $pg['folder'];
            if (!isset($folders[$f])) $folders[$f] = 0;
            $folders[$f]++;
        }
        arsort($folders);

        $limit  = isset($_REQUEST['limit']) ? max(1, min(500, (int)$_REQUEST['limit'])) : 120;
        $offset = isset($_REQUEST['offset']) ? max(0, (int)$_REQUEST['offset']) : 0;
        $slice  = array_slice($pages, $offset, $limit);

        jok(array(
            'pages' => $slice,
            'shown' => count($slice),
            'matched' => count($pages),
            'offset' => $offset,
            'stats' => $stats,
            'folders' => $folders,
            'sitemap_urls' => $scan['sitemap_count'],
            'scanned_at' => date('Y-m-d H:i:s', $scan['ts']),
            'writable' => is_writable($ROOT . '/index.html'),
        ));
        break;

    case 'page_meta_save':
        $file = isset($_POST['file']) ? (string)$_POST['file'] : '';
        $file = str_replace('\\', '/', $file);
        $file = preg_replace('#\.\./#', '', $file);           /* ضد عبور از پوشه */
        $file = ltrim($file, '/');
        if (!preg_match('#^[A-Za-z0-9\x{0600}-\x{06FF}_./\-]+\.html$#u', $file)) jerr('مسیر نامعتبر');
        $segs = explode('/', $file);
        array_pop($segs);                                  /* نام فایل کنار گذاشته می‌شود */
        foreach ($segs as $seg) { if (cms_skip_dir($seg)) jerr('پوشهٔ غیرمجاز'); }
        $f = $ROOT . '/' . $file;
        if (!is_file($f)) jerr('فایل یافت نشد');
        if (substr(realpath($f), 0, strlen(realpath($ROOT))) !== realpath($ROOT)) jerr('مسیر خارج از ریشهٔ سایت');

        $title = trim((string)($_POST['title'] ?? ''));
        $desc  = trim((string)($_POST['desc'] ?? ''));
        $can   = trim((string)($_POST['canonical'] ?? ''));
        $rob   = trim((string)($_POST['robots'] ?? ''));

        if ($title === '') jerr('عنوان نمی‌تواند خالی باشد');
        if (mb_strlen($title, 'UTF-8') > 200) jerr('عنوان بیش از ۲۰۰ کاراکتر است');
        if (mb_strlen($desc, 'UTF-8') > 400) jerr('توضیح بیش از ۴۰۰ کاراکتر است');
        if ($can !== '' && !preg_match('#^(https://pishtaj\.ir/|/)#i', $can)) {
            jerr('canonical باید یا خالی باشد یا با https://pishtaj.ir/ شروع شود');
        }
        if ($rob !== '' && !preg_match('#^[a-z,\s\-]+$#i', $rob)) jerr('مقدار robots نامعتبر است');

        $s = (string)file_get_contents($f);
        $orig = $s;

        /* --- title --- */
        $newTitle = '<title>' . htmlspecialchars($title, ENT_QUOTES, 'UTF-8') . '</title>';
        if (preg_match('#<title>.*?</title>#su', $s)) {
            $s = preg_replace('#<title>.*?</title>#su', $newTitle, $s, 1);
        } else {
            $s = preg_replace('#(<head[^>]*>)#isu', '$1' . "\n" . $newTitle, $s, 1);
        }

        /* --- description --- */
        $newDesc = '<meta name="description" content="' . htmlspecialchars($desc, ENT_QUOTES, 'UTF-8') . '" />';
        if (preg_match('#<meta\s+name=["\']description["\']\s+content=["\'].*?["\']\s*/?>#isu', $s)) {
            $s = preg_replace('#<meta\s+name=["\']description["\']\s+content=["\'].*?["\']\s*/?>#isu', $newDesc, $s, 1);
        } else {
            $s = preg_replace('#(</title>)#isu', '$1' . "\n" . $newDesc, $s, 1);
        }

        /* --- canonical --- */
        if ($can !== '') {
            $newCan = '<link rel="canonical" href="' . htmlspecialchars($can, ENT_QUOTES, 'UTF-8') . '" />';
            if (preg_match('#<link[^>]*rel=["\']canonical["\'][^>]*>#isu', $s)) {
                $s = preg_replace('#<link[^>]*rel=["\']canonical["\'][^>]*>#isu', $newCan, $s, 1);
            } else {
                $s = preg_replace('#(</title>)#isu', '$1' . "\n" . $newCan, $s, 1);
            }
        }

        /* --- robots: فقط اگر مقدار داده شده باشد (حذف = پاک‌کردن تگ) --- */
        if (isset($_POST['robots'])) {
            $s = preg_replace('#\s*<meta\s+name=["\']robots["\'][^>]*>#isu', '', $s, 1);
            if ($rob !== '') {
                $newRob = '<meta name="robots" content="' . htmlspecialchars($rob, ENT_QUOTES, 'UTF-8') . '" />';
                $s = preg_replace('#(</title>)#isu', '$1' . "\n" . $newRob, $s, 1);
            }
        }

        if ($s === $orig) { jok(array('changed' => false)); }

        /* محافظت: حجم فایل نباید جهش غیرعادی کند */
        if (strlen($s) > strlen($orig) * 1.2 + 5000) jerr('تغییر غیرعادی در حجم فایل — عملیات لغو شد');
        if (!is_writable($f)) jerr('فایل قابل‌نوشتن نیست (مجوز هاست را بررسی کنید)');

        cms_backup($DATA, $ROOT, $file);                       /* نسخهٔ پشتیبان قبل از نوشتن */
        if (file_put_contents($f, $s, LOCK_EX) === false) jerr('خطای نوشتن فایل');
        if (is_file($DATA . '/cms-seo-scan.json')) @unlink($DATA . '/cms-seo-scan.json'); /* باطل‌کردن کش */
        cms_log('page_meta_save', $file . ' | title=' . mb_substr($title, 0, 60, 'UTF-8'));
        jok(array('changed' => true, 'backup' => 'crm/data/cms-backups'));
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
