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

/* سایت از نقشهٔ تکه‌تکه استفاده می‌کند (sitemap-index.xml)؛ sitemap.xml وجود ندارد.
   پس هر URL باید در زیرنقشهٔ خودش نوشته شود، وگرنه بی‌صدا گم می‌شود. */
function sitemap_file_for($url) {
    $path = (string)parse_url($url, PHP_URL_PATH);
    $segs = array_values(array_filter(explode('/', $path), function ($x) { return $x !== ''; }));
    $top = $segs[0] ?? '';
    $map = [
        'blog'             => 'sitemap-blog.xml',
        'knowledge-center' => 'sitemap-knowledge-center.xml',
        'industries'       => 'sitemap-industries.xml',
        'services'         => 'sitemap-services.xml',
        'en'               => 'sitemap-en.xml',
        'about'            => 'sitemap-core.xml',
        'products'         => 'sitemap-products.xml', /* v34.11.0 (S2): صفحات محصول */
    ];
    if (isset($map[$top])) return $map[$top];
    return $top === '' ? 'sitemap-core.xml' : 'sitemap-misc.xml';
}

/* v34.11.0 (S2): اگر زیرنقشه در ایندکس نیست اضافه شود — بدون این، نقشهٔ جدید
   هرگز به گوگل معرفی نمی‌شد (touch فقط lastmodِ موجود را به‌روز می‌کند). */
function sitemap_index_ensure($sub) {
    global $ROOT;
    $idx = $ROOT . '/sitemap-index.xml';
    if (!is_file($idx)) return;
    $s = (string)file_get_contents($idx);
    $loc = 'https://pishtaj.ir/' . $sub;
    if (strpos($s, '<loc>' . $loc . '</loc>') !== false) { sitemap_touch_index($sub); return; }
    $entry = "  <sitemap>\n    <loc>" . htmlspecialchars($loc, ENT_XML1) . "</loc>\n    <lastmod>" . date('Y-m-d') . "</lastmod>\n  </sitemap>\n</sitemapindex>";
    $n = str_replace('</sitemapindex>', $entry, $s);
    if ($n !== $s) file_put_contents($idx, $n, LOCK_EX);
}
function sitemap_touch_index($sub) {
    global $ROOT;
    $idx = $ROOT . '/sitemap-index.xml';
    if (!is_file($idx)) return;
    $s = (string)file_get_contents($idx);
    $loc = 'https://pishtaj.ir/' . $sub;
    /* فقط lastmod همان زیرنقشه به‌روز می‌شود */
    $s = preg_replace(
        '#(<loc>' . preg_quote($loc, '#') . '</loc><lastmod>)[^<]*(</lastmod>)#',
        '${1}' . date('Y-m-d') . '${2}',
        $s, 1
    );
    file_put_contents($idx, $s, LOCK_EX);
}

function sitemap_add($url) {
    global $ROOT;
    $sub = sitemap_file_for($url);
    $f = $ROOT . '/' . $sub;
    $s = is_file($f) ? (string)file_get_contents($f) : '';
    if ($s === '' || strpos($s, '</urlset>') === false) {
        /* زیرنقشه وجود ندارد یا خراب است: از نو می‌سازیم */
        $s = '<?xml version="1.0" encoding="UTF-8"?>' . "\n"
           . '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n"
           . "  <url><loc>" . htmlspecialchars($url, ENT_XML1) . "</loc><lastmod>" . date('Y-m-d') . "</lastmod></url>\n"
           . "</urlset>\n";
        if (file_put_contents($f, $s, LOCK_EX) !== false) sitemap_index_ensure($sub); /* v34.11.0: ثبت در ایندکس اگر جدید است */
        return;
    }
    if (strpos($s, '<loc>' . $url . '</loc>') !== false) return;   /* از قبل هست */
    $entry = "  <url><loc>" . htmlspecialchars($url, ENT_XML1) . "</loc><lastmod>" . date('Y-m-d') . "</lastmod></url>\n</urlset>";
    $s = str_replace('</urlset>', $entry, $s);
    if (file_put_contents($f, $s, LOCK_EX) !== false) sitemap_touch_index($sub);
}
function sitemap_remove($url) {
    global $ROOT;
    /* ورودی‌های قدیمی ممکن است در هر زیرنقشه‌ای باشند، پس همه را می‌گردیم */
    $hit = false;
    foreach (glob($ROOT . '/sitemap-*.xml') ?: [] as $f) {
        if (basename($f) === 'sitemap-index.xml') continue;
        $s = (string)file_get_contents($f);
        if (strpos($s, '<loc>' . $url . '</loc>') === false) continue;
        $n = preg_replace('#\s*<url><loc>' . preg_quote($url, '#') . '</loc>.*?</url>#s', '', $s, 1);
        if ($n !== null && $n !== $s) {
            file_put_contents($f, $n, LOCK_EX);
            sitemap_touch_index(basename($f));
            $hit = true;
        }
    }
    return $hit;
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

function cms_meta_of($ROOT, $rel, &$smap, &$inlinks = null) { /* v34.10.0 (S1): &$inlinks = شمارش لینک ورودی برای گزارش یتیم‌ها */
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

  /* v34.10.0 (S1/ORPHAN): لینک‌های داخلیِ بدنه → شمارندهٔ «لینک ورودی» مقصدها.
     فقط hrefهای سالمِ داخلی؛ tel:/mailto:/javascript و لنگر# نادیده. */
  if (is_array($inlinks)) {
    $body = preg_replace('#<(script|style|noscript|template)\b[^>]*>.*?</\1>#isu', ' ', $html);
    if (preg_match_all('#<a\b[^>]*href=["\']([^"\']+)#isu', $body, $am)) {
      foreach ($am[1] as $href) {
        $href = trim($href);
        if ($href === '' || $href[0] === '#') continue;
        if (preg_match('#^(tel:|mailto:|javascript:|data:)#i', $href)) continue;
        if (stripos($href, 'https://pishtaj.ir/') === 0) $href = substr($href, strlen('https://pishtaj.ir/'));
        elseif (stripos($href, 'http://') === 0 || stripos($href, 'https://') === 0) continue; /* دامنهٔ دیگر */
        $href = ltrim(preg_replace('#[?#].*$#', '', $href), '/');
        if ($href === '') $href = 'index.html';
        elseif (substr($href, -1) === '/') $href .= 'index.html';
        elseif (!preg_match('#\.[a-z0-9]{2,5}$#i', $href)) $href .= '/index.html';
        if ($href === $rel) continue; /* خودلینک (breadcrumb خود صفحه) ورودی نیست */
        if (!isset($inlinks[$href])) $inlinks[$href] = 0;
        $inlinks[$href]++;
      }
    }
  }

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
  $inlinks = array();
  foreach (cms_public_pages($ROOT) as $rel) {
    $pages[] = cms_meta_of($ROOT, $rel, $smap, $inlinks);
  }
  /* v34.10.0 (S1/ORPHAN): ytym = صفحهٔ عمومی بدون هیچ لینک ورودی از صفحات سایت.
     404 مستثناست (صفحهٔ خطاست، لینک داده نمی‌شود). */
  foreach ($pages as $i => $pg) {
    $n = isset($inlinks[$pg['path']]) ? (int)$inlinks[$pg['path']] : 0;
    $pages[$i]['inlinks'] = $n;
    if ($n === 0 && $pg['path'] !== '404.html') $pages[$i]['issues'][] = 'orphan';
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


/* ═══ v34.10.0 (S1/AI-QUEUE): صف متای AI — تولید گروهی + تأیید انسانی + اعمال با بک‌آپ ═══ */
function seo_queue_file($DATA) { return $DATA . '/seo-queue.json'; }
function seo_queue_load($DATA) {
  $f = seo_queue_file($DATA);
  $j = is_file($f) ? json_decode((string)@file_get_contents($f), true) : null;
  return (is_array($j) && isset($j['items']) && is_array($j['items'])) ? $j : array('items' => array());
}
function seo_queue_save($DATA, $q) {
  @file_put_contents(seo_queue_file($DATA), json_encode($q, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), LOCK_EX);
}
function seo_queue_valid_path($ROOT, $file) {
  $file = str_replace('\\', '/', (string)$file);
  $file = ltrim(preg_replace('#\.\./#', '', $file), '/');
  if (!preg_match('#^[A-Za-z0-9\x{0600}-\x{06FF}_./\-]+\.html$#u', $file)) return '';
  foreach (array_slice(explode('/', $file), 0, -1) as $seg) { if (cms_skip_dir($seg)) return ''; }
  $f = $ROOT . '/' . $file;
  if (!is_file($f)) return '';
  if (substr(realpath($f), 0, strlen(realpath($ROOT))) !== realpath($ROOT)) return '';
  return $file;
}
/* اعمال title+desc روی فایل — همان موتور page_meta_save با همان محافظ‌ها (بک‌آپ/جهش حجم/کش اسکن) */
function seo_queue_apply_one($ROOT, $DATA, $file, $title, $desc) {
  $title = trim((string)$title); $desc = trim((string)$desc);
  if ($title === '' || mb_strlen($title, 'UTF-8') > 200) return 'عنوان نامعتبر';
  if (mb_strlen($desc, 'UTF-8') > 400) return 'توضیح نامعتبر';
  $f = $ROOT . '/' . $file;
  $s = (string)file_get_contents($f); $orig = $s;
  $newTitle = '<title>' . htmlspecialchars($title, ENT_QUOTES, 'UTF-8') . '</title>';
  $s = preg_match('#<title>.*?</title>#su', $s)
    ? preg_replace('#<title>.*?</title>#su', $newTitle, $s, 1)
    : preg_replace('#(<head[^>]*>)#isu', '$1' . "\n" . $newTitle, $s, 1);
  $newDesc = '<meta name="description" content="' . htmlspecialchars($desc, ENT_QUOTES, 'UTF-8') . '" />';
  $s = preg_match('#<meta\s+name=["\']description["\']\s+content=["\'].*?["\']\s*/?>#isu', $s)
    ? preg_replace('#<meta\s+name=["\']description["\']\s+content=["\'].*?["\']\s*/?>#isu', $newDesc, $s, 1)
    : preg_replace('#(</title>)#isu', '$1' . "\n" . $newDesc, $s, 1);
  if ($s === $orig) return 'بدون تغییر';
  if (strlen($s) > strlen($orig) * 1.2 + 5000) return 'جهش غیرعادی حجم — لغو';
  if (!is_writable($f)) return 'فایل قابل‌نوشتن نیست';
  cms_backup($DATA, $ROOT, $file);
  if (file_put_contents($f, $s, LOCK_EX) === false) return 'خطای نوشتن';
  if (is_file($DATA . '/cms-seo-scan.json')) @unlink($DATA . '/cms-seo-scan.json');
  cms_log('seo_queue_apply', $file . ' | title=' . mb_substr($title, 0, 60, 'UTF-8'));
  return ''; /* خالی = موفق */
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

    case 'kc_create':
        $title = mb_substr(strip_tags($_POST['title'] ?? ''), 0, 200);
        $h1    = mb_substr(strip_tags($_POST['h1'] ?? ''), 0, 200);
        $desc  = mb_substr(strip_tags($_POST['desc'] ?? ''), 0, 300);
        $slug  = strtolower(preg_replace('/[^a-z0-9\-]/', '', $_POST['slug'] ?? ''));
        $cat   = preg_replace('/[^a-z_]/', '', $_POST['cat'] ?? 'pipe');
        $body  = $_POST['body'] ?? '';
        $img   = preg_replace('#[^a-zA-Z0-9/\-_.:]#', '', $_POST['img'] ?? '../assets/images/ptf-logo.png');
        if ($title === '' || $slug === '') jerr('عنوان و نامک (slug) الزامی است');
        if ($h1 === '') $h1 = $title;
        if (mb_strlen(strip_tags($body), 'UTF-8') < 200) jerr('متن مقاله حداقل ۲۰۰ کاراکتر لازم دارد');

        $file = $ROOT . '/knowledge-center/' . $slug . '.html';
        if (file_exists($file) && empty($_POST['overwrite'])) jerr('exists');

        /* پاکسازی بدنه: فقط تگ‌های امن */
        $body = strip_tags($body, '<h2><h3><h4><p><ul><ol><li><b><strong><i><em><table><thead><tbody><tr><th><td><br><blockquote><a>');
        $body = preg_replace('/on\w+\s*=\s*"[^"]*"/i', '', $body);
        $body = preg_replace("/on\w+\s*=\s*'[^']*'/i", '', $body);
        $body = preg_replace('/javascript\s*:/i', '', $body);

        /* قالب از یک صفحهٔ موجودِ مرکز دانش گرفته می‌شود تا هدر/فوتر/استایل
           دقیقاً هم‌شکلِ بقیهٔ صفحات باشد (همان روشِ blog_create) */
        $skel = (string)@file_get_contents($ROOT . '/knowledge-center/astm-a105.html');
        if ($skel === '') jerr('قالب مرجعِ مرکز دانش یافت نشد');
        $heroMark = '<section style="background:linear-gradient(135deg,#151517,#2d2d31)';
        $pBody = strpos($skel, '<body>');
        $pHero = strpos($skel, $heroMark);
        $pCta  = strpos($skel, '<div class="kc-supply-cta"');
        $pFoot = strpos($skel, '<footer');
        if ($pBody === false || $pHero === false || $pCta === false || $pFoot === false) {
            jerr('ساختارِ قالب مرجع شناخته نشد');
        }
        $header = substr($skel, $pBody, $pHero - $pBody);
        $cta    = substr($skel, $pCta, $pFoot - $pCta);
        $footer = substr($skel, $pFoot);

        $tEsc = htmlspecialchars($title, ENT_QUOTES, 'UTF-8');
        $hEsc = htmlspecialchars($h1, ENT_QUOTES, 'UTF-8');
        $dEsc = htmlspecialchars($desc, ENT_QUOTES, 'UTF-8');
        $url  = 'https://pishtaj.ir/knowledge-center/' . $slug . '.html';
        $imgAbs = (strpos($img, 'http') === 0) ? $img : 'https://pishtaj.ir/' . ltrim(str_replace('../', '', $img), '/');

        $graph = [
            ['@type' => 'Article', 'headline' => $h1, 'description' => $desc,
             'author' => ['@type' => 'Organization', 'name' => 'پیشرو تجهیز فرتاک'],
             'publisher' => ['@type' => 'Organization', 'name' => 'پیشرو تجهیز فرتاک',
                 'logo' => ['@type' => 'ImageObject', 'url' => 'https://pishtaj.ir/assets/images/ptf-logo.png']],
             'mainEntityOfPage' => ['@type' => 'WebPage', '@id' => $url],
             'image' => $imgAbs],
            ['@type' => 'BreadcrumbList', 'itemListElement' => [
                ['@type' => 'ListItem', 'position' => 1, 'name' => 'خانه', 'item' => 'https://pishtaj.ir/'],
                ['@type' => 'ListItem', 'position' => 2, 'name' => 'مرکز دانش', 'item' => 'https://pishtaj.ir/knowledge-center/'],
                ['@type' => 'ListItem', 'position' => 3, 'name' => $title],
            ]],
        ];
        $jsonLd = json_encode(['@context' => 'https://schema.org', '@graph' => $graph],
            JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        /* لینک‌های مرتبط: آرایهٔ JSON از {t,f} — لینک داخلیِ واقعی به همان پوشه */
        $rel = json_decode((string)($_POST['related'] ?? ''), true);
        $relHtml = '';
        if (is_array($rel) && $rel) {
            $items = '';
            foreach ($rel as $r) {
                if (!is_array($r)) continue;
                $rt = mb_substr(strip_tags((string)($r['t'] ?? '')), 0, 140);
                $rf = preg_replace('/[^a-z0-9\-_.]/', '', strtolower((string)($r['f'] ?? '')));
                if ($rt === '' || $rf === '' || strpos($rf, '.html') === false) continue;
                $items .= '        <li style="margin:0"><a href="' . htmlspecialchars($rf, ENT_QUOTES, 'UTF-8')
                    . '" style="color:#334155;text-decoration:none;border-bottom:1px solid #e2e8f0;padding:5px 0;display:block;line-height:1.7">'
                    . htmlspecialchars($rt, ENT_QUOTES, 'UTF-8') . "</a></li>\n";
            }
            if ($items !== '') {
                $relHtml = '<section data-ptf-related="1" class="ptf-related" style="max-width:1100px;margin:0 auto;padding:34px 20px 6px">' . "\n"
                    . '  <h2 style="font-size:17px;color:#0f172a;margin:0 0 14px;padding-bottom:8px;border-bottom:2px solid #ef4b1a;display:inline-block">مطالب مرتبط در مرکز دانش</h2>' . "\n"
                    . '  <ul style="list-style:none;padding:0;margin:0;display:grid;gap:0;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));column-gap:26px;font-size:13.5px">' . "\n"
                    . $items . "  </ul>\n</section>\n";
            }
        }

        $html = '<!doctype html>' . "\n" . '<html lang="fa" dir="rtl">' . "\n" . '<head>' . "\n"
            . '<meta charset="utf-8" />' . "\n"
            . '<meta name="viewport" content="width=device-width, initial-scale=1" />' . "\n"
            . '<title>' . $tEsc . '</title>' . "\n"
            . '<meta name="description" content="' . $dEsc . '" />' . "\n"
            . '<meta name="robots" content="index, follow" />' . "\n"
            . '<link rel="canonical" href="' . $url . '" />' . "\n"
            . '<meta property="og:locale" content="fa_IR" />' . "\n"
            . '<meta property="og:site_name" content="پیشرو تجهیز فرتاک" />' . "\n"
            . '<meta property="og:type" content="article" />' . "\n"
            . '<meta property="og:title" content="' . $tEsc . '" />' . "\n"
            . '<meta property="og:description" content="' . $dEsc . '" />' . "\n"
            . '<meta property="og:url" content="' . $url . '" />' . "\n"
            . '<meta property="og:image" content="' . htmlspecialchars($imgAbs, ENT_QUOTES, 'UTF-8') . '" />' . "\n"
            . '<meta name="twitter:card" content="summary_large_image" />' . "\n"
            . '<meta name="twitter:title" content="' . $tEsc . '" />' . "\n"
            . '<meta name="twitter:description" content="' . $dEsc . '" />' . "\n"
            . '<meta name="twitter:image" content="' . htmlspecialchars($imgAbs, ENT_QUOTES, 'UTF-8') . '" />' . "\n"
            . '<script type="application/ld+json">' . $jsonLd . '</script>' . "\n"
            . '<link rel="stylesheet" href="../assets/css/discover.css" />' . "\n"
            . '</head>' . "\n"
            . $header
            . $heroMark . ';min-height:210px;display:flex;align-items:center">' . "\n"
            . '<div class="container" style="position:relative;z-index:1">' . "\n"
            . '<div style="font-size:13px;color:rgba(255,255,255,.6)">مرکز دانش · تامین و کیفیت</div>' . "\n"
            . '<h1 style="font-size:clamp(22px,3vw,34px);margin:8px 0 10px">' . $hEsc . '</h1>' . "\n"
            . '</div></section>' . "\n"
            . '<div style="max-width:900px;margin:40px auto;padding:0 20px">' . "\n"
            . '<article style="background:#fff;border:1px solid var(--line);border-radius:28px;padding:40px;line-height:2.1;color:#334155">' . "\n"
            . '<div class="kc-body" style="text-align:right">' . "\n" . $body . "\n</div>" . "\n"
            . '</article></div>' . "\n"
            . $relHtml
            . $cta
            . $footer;

        if (file_put_contents($file, $html, LOCK_EX) === false) jerr('خطای نوشتن فایل (مجوز write؟)');

        /* افزودن به فهرستِ مرکز دانش: آرایهٔ cats → a:[["عنوان","فایل"],…] */
        $idxFile = $ROOT . '/knowledge-center/index.html';
        $added = false;
        $s = (string)@file_get_contents($idxFile);
        $mk = '{icon:"' . $cat . '",t:"';
        $p = strpos($s, $mk);
        if ($p !== false) {
            $aPos = strpos($s, 'a:[', $p);
            if ($aPos !== false) {
                $ins = $aPos + 3;
                $entry = '["' . str_replace(['"', '\\'], '', $title) . '","' . $slug . '.html"],';
                $s = substr($s, 0, $ins) . $entry . substr($s, $ins);
                if (file_put_contents($idxFile, $s, LOCK_EX) !== false) $added = true;
            }
        }

        sitemap_add($url);
        cms_log('kc_create', $slug);
        jok(['url' => 'knowledge-center/' . $slug . '.html', 'listed' => $added]);
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
            'no-schema' => 0, 'orphan' => 0, 'ok' => 0,
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

        /* --- h1: فقط اگر فرستاده شده باشد؛ متنِ اولین h1 جایگزین می‌شود --- */
        if (isset($_POST['h1'])) {
            $h1new = trim((string)$_POST['h1']);
            if ($h1new === '') jerr('h1 نمی‌تواند خالی باشد');
            if (mb_strlen($h1new, 'UTF-8') > 200) jerr('h1 بیش از ۲۰۰ کاراکتر است');
            $h1Esc = htmlspecialchars($h1new, ENT_QUOTES, 'UTF-8');
            if (!preg_match('#<h1[^>]*>.*?</h1>#isu', $s)) jerr('این صفحه تگ h1 ندارد');
            /* callback تا $ و \ داخلِ متن تفسیر نشوند */
            $s = preg_replace_callback('#(<h1[^>]*>).*?(</h1>)#isu', function ($m) use ($h1Esc) {
                return $m[1] . $h1Esc . $m[2];
            }, $s, 1);
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

    /* ═══ v34.11.0 (S2/PRODUCT): مولد صفحهٔ محصول از دیتای CRM با اسکیمای Product ═══ */
    case 'product_create':
        $title = mb_substr(strip_tags($_POST['title'] ?? ''), 0, 200);
        $h1    = mb_substr(strip_tags($_POST['h1'] ?? ''), 0, 200);
        $desc  = mb_substr(strip_tags($_POST['desc'] ?? ''), 0, 300);
        $slug  = strtolower(preg_replace('/[^a-z0-9\-]/', '', $_POST['slug'] ?? ''));
        $brand = mb_substr(strip_tags($_POST['brand'] ?? ''), 0, 120);
        $catLb = mb_substr(strip_tags($_POST['catLb'] ?? 'محصولات'), 0, 120);
        $body  = $_POST['body'] ?? '';
        $img   = preg_replace('#[^a-zA-Z0-9/\-_.:]#', '', $_POST['img'] ?? '../assets/images/ptf-logo.png');
        $cd    = preg_replace('/[^A-Za-z0-9\-_]/', '', $_POST['productCd'] ?? ''); /* کد کالای CRM — فقط برای نشانه‌گذاری */
        $price = (float)($_POST['price'] ?? 0);
        $cur   = in_array(strtoupper((string)($_POST['priceCur'] ?? 'IRR')), ['IRR','USD','EUR','AED'], true) ? strtoupper((string)($_POST['priceCur'] ?? 'IRR')) : 'IRR';
        $stock = !empty($_POST['inStock']);
        if ($title === '' || $slug === '') jerr('عنوان و نامک (slug) الزامی است');
        if ($h1 === '') $h1 = $title;
        if (mb_strlen(strip_tags($body), 'UTF-8') < 200) jerr('متن صفحه حداقل ۲۰۰ کاراکتر لازم دارد');
        if ($price < 0 || $price > 999999999999) jerr('قیمت نامعتبر');

        $dir = $ROOT . '/products';
        if (!is_dir($dir)) @mkdir($dir, 0755, true);
        $file = $dir . '/' . $slug . '.html';
        if (file_exists($file) && empty($_POST['overwrite'])) jerr('exists');

        /* پاکسازی بدنه — همان لیست سفید kc_create */
        $body = strip_tags($body, '<h2><h3><h4><p><ul><ol><li><b><strong><i><em><table><thead><tbody><tr><th><td><br><blockquote><a>');
        $body = preg_replace('/on\w+\s*=\s*"[^"]*"/i', '', $body);
        $body = preg_replace("/on\w+\s*=\s*'[^']*'/i", '', $body);
        $body = preg_replace('/javascript\s*:/i', '', $body);

        /* قالب: همان اسکلت مرکز دانش (هدر/فوتر/استایل هم‌شکل سایت) */
        $skel = (string)@file_get_contents($ROOT . '/knowledge-center/astm-a105.html');
        if ($skel === '') jerr('قالب مرجع یافت نشد');
        $heroMark = '<section style="background:linear-gradient(135deg,#151517,#2d2d31)';
        $pBody = strpos($skel, '<body>');
        $pHero = strpos($skel, $heroMark);
        $pCta  = strpos($skel, '<div class="kc-supply-cta"');
        $pFoot = strpos($skel, '<footer');
        if ($pBody === false || $pHero === false || $pCta === false || $pFoot === false) jerr('ساختار قالب مرجع شناخته نشد');
        $header = substr($skel, $pBody, $pHero - $pBody);
        $cta    = substr($skel, $pCta, $pFoot - $pCta);
        $footer = substr($skel, $pFoot);

        $tEsc = htmlspecialchars($title, ENT_QUOTES, 'UTF-8');
        $hEsc = htmlspecialchars($h1, ENT_QUOTES, 'UTF-8');
        $dEsc = htmlspecialchars($desc, ENT_QUOTES, 'UTF-8');
        $url  = 'https://pishtaj.ir/products/' . $slug . '.html';
        $imgAbs = (strpos($img, 'http') === 0) ? $img : 'https://pishtaj.ir/' . ltrim(str_replace('../', '', $img), '/');

        /* جدول مشخصات: آرایهٔ [[کلید,مقدار],…] */
        $specs = json_decode((string)($_POST['specs'] ?? ''), true);
        $specsHtml = '';
        if (is_array($specs) && $specs) {
            $rows = '';
            foreach ($specs as $sp) {
                if (!is_array($sp) || count($sp) < 2) continue;
                $k = mb_substr(strip_tags((string)$sp[0]), 0, 80);
                $v = mb_substr(strip_tags((string)$sp[1]), 0, 300);
                if ($k === '' && $v === '') continue;
                $rows .= '<tr><th style="text-align:right;padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0;font-weight:700">' . htmlspecialchars($k, ENT_QUOTES, 'UTF-8') . '</th><td style="padding:8px 12px;border:1px solid #e2e8f0">' . htmlspecialchars($v, ENT_QUOTES, 'UTF-8') . '</td></tr>';
            }
            if ($rows !== '') $specsHtml = '<h2>مشخصات فنی</h2><table style="width:100%;border-collapse:collapse;font-size:13.5px;margin:14px 0 22px">' . $rows . '</table>';
        }

        /* سوالات متداول: [{q,a}] */
        $faq = json_decode((string)($_POST['faq'] ?? ''), true);
        $faqHtml = ''; $faqGraph = [];
        if (is_array($faq) && $faq) {
            foreach ($faq as $fq) {
                if (!is_array($fq)) continue;
                $q = mb_substr(strip_tags((string)($fq['q'] ?? '')), 0, 300);
                $a = mb_substr(strip_tags((string)($fq['a'] ?? '')), 0, 1000);
                if ($q === '' || $a === '') continue;
                $faqHtml .= '<details style="border:1px solid #e2e8f0;border-radius:10px;padding:10px 14px;margin:8px 0"><summary style="font-weight:700;cursor:pointer">' . htmlspecialchars($q, ENT_QUOTES, 'UTF-8') . '</summary><p style="color:#334155;margin:8px 0 0">' . htmlspecialchars($a, ENT_QUOTES, 'UTF-8') . '</p></details>';
                $faqGraph[] = ['@type' => 'Question', 'name' => $q, 'acceptedAnswer' => ['@type' => 'Answer', 'text' => $a]];
            }
            if ($faqHtml !== '') $faqHtml = '<h2>سوالات متداول</h2>' . $faqHtml;
        }

        $graph = [
            ['@type' => 'Product', 'name' => $h1, 'description' => $desc,
             'image' => $imgAbs, 'url' => $url,
             'sku' => $cd !== '' ? $cd : $slug],
        ];
        if ($brand !== '') $graph[0]['brand'] = ['@type' => 'Brand', 'name' => $brand];
        if ($price > 0) {
            $graph[0]['offers'] = ['@type' => 'Offer', 'priceCurrency' => $cur, 'price' => $price,
                'availability' => $stock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
                'url' => $url, 'seller' => ['@type' => 'Organization', 'name' => 'پیشرو تجهیز فرتاک']];
        }
        $graph[] = ['@type' => 'BreadcrumbList', 'itemListElement' => [
            ['@type' => 'ListItem', 'position' => 1, 'name' => 'خانه', 'item' => 'https://pishtaj.ir/'],
            ['@type' => 'ListItem', 'position' => 2, 'name' => 'محصولات', 'item' => 'https://pishtaj.ir/products/'],
            ['@type' => 'ListItem', 'position' => 3, 'name' => $title],
        ]];
        if ($faqGraph) $graph[] = ['@type' => 'FAQPage', 'mainEntity' => $faqGraph];
        $jsonLd = json_encode(['@context' => 'https://schema.org', '@graph' => $graph], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        $html = '<!doctype html>' . "\n" . '<html lang="fa" dir="rtl">' . "\n" . '<head>' . "\n"
            . '<meta charset="utf-8" />' . "\n"
            . '<meta name="viewport" content="width=device-width, initial-scale=1" />' . "\n"
            . '<meta name="ptf-product-cd" content="' . htmlspecialchars($cd, ENT_QUOTES, 'UTF-8') . '" />' . " <!-- ptf-product v1 -->\n"
            . '<title>' . $tEsc . '</title>' . "\n"
            . '<meta name="description" content="' . $dEsc . '" />' . "\n"
            . '<meta name="robots" content="index, follow" />' . "\n"
            . '<link rel="canonical" href="' . $url . '" />' . "\n"
            . '<meta property="og:locale" content="fa_IR" />' . "\n"
            . '<meta property="og:site_name" content="پیشرو تجهیز فرتاک" />' . "\n"
            . '<meta property="og:type" content="product" />' . "\n"
            . '<meta property="og:title" content="' . $tEsc . '" />' . "\n"
            . '<meta property="og:description" content="' . $dEsc . '" />' . "\n"
            . '<meta property="og:url" content="' . $url . '" />' . "\n"
            . '<meta property="og:image" content="' . htmlspecialchars($imgAbs, ENT_QUOTES, 'UTF-8') . '" />' . "\n"
            . '<meta name="twitter:card" content="summary_large_image" />' . "\n"
            . '<link rel="stylesheet" href="../assets/css/style.css" />' . "\n"
            . '<script type="application/ld+json">' . $jsonLd . '</script>' . "\n"
            . '</head>' . "\n"
            . $header . '<section class="article-hero">' . "\n" . '<div class="container">' . "\n"
            . '<span style="background:rgba(239,75,26,.2);color:#ffb033;padding:6px 14px;border-radius:999px;font-size:12.5px;font-weight:800">' . htmlspecialchars($catLb, ENT_QUOTES, 'UTF-8') . '</span>' . "\n"
            . '<h1>' . $hEsc . '</h1>' . "\n"
            . '<p style="color:rgba(255,255,255,.75);font-size:14px">' . ($brand !== '' ? htmlspecialchars($brand, ENT_QUOTES, 'UTF-8') . ' · ' : '') . 'واحد تامین پیشرو تجهیز فرتاک</p>' . "\n"
            . '</div>' . "\n" . '</section>' . "\n"
            . '<div class="article-wrap">' . "\n" . '<div class="article-content">' . "\n"
            . $body . "\n" . $specsHtml . "\n" . $faqHtml . "\n"
            . '<div style="background:#fff8f0;border:1px solid #f6c17c;border-radius:16px;padding:18px 22px;margin-top:30px">' . "\n"
            . '<b>استعلام قیمت این محصول؟</b> قیمت و زمان تامین را همان روز دریافت کنید: <a href="../rfq/" style="color:var(--red);font-weight:800">ثبت استعلام هوشمند ←</a>' . "\n"
            . '</div>' . "\n" . '</div>' . "\n" . '</div>' . "\n"
            . $cta . "\n" . $footer;

        if (file_exists($file)) cms_backup($DATA, $ROOT, 'products/' . $slug . '.html');
        if (file_put_contents($file, $html, LOCK_EX) === false) jerr('خطای نوشتن فایل محصول (مجوز write?)');
        sitemap_add($url);
        cms_log('product_create', $slug . ($cd !== '' ? ' | cd=' . $cd : ''));
        jok(['url' => 'products/' . $slug . '.html']);
        break;

    case 'product_list':
        $out = [];
        foreach (glob($ROOT . '/products/*.html') ?: [] as $pf) {
            $c = (string)@file_get_contents($pf);
            $slug = basename($pf, '.html');
            $cd = '';
            if (preg_match('#<meta name="ptf-product-cd" content="([^"]*)"#', $c, $cm)) $cd = $cm[1];
            $t = '';
            if (preg_match('#<title>(.*?)</title>#isu', $c, $tm)) $t = trim(strip_tags($tm[1]));
            $out[] = ['slug' => $slug, 'cd' => $cd, 'title' => $t, 'mtime' => date('Y-m-d H:i', (int)@filemtime($pf))];
        }
        usort($out, function ($a, $b) { return strcmp($b['mtime'], $a['mtime']); });
        jok(['products' => $out]);
        break;

    /* ═══ v34.11.0 (S2/REDIRECT): ادیتور ریدایرکت — همان الگوی امن blog_archive ═══ */
    case 'page_redirect':
        $from = seo_queue_valid_path($ROOT, $_POST['from'] ?? '');
        if ($from === '' || $from === '404.html' || strpos($from, 'crm/') === 0) jerr('مسیر مبدأ نامعتبر');
        $to = trim((string)($_POST['to'] ?? ''));
        if ($to === '') jerr('مقصد خالی است');
        if (strpos($to, 'https://pishtaj.ir/') === 0) { /* مطلق داخلی — مجاز */ }
        elseif (strpos($to, 'http') === 0) jerr('فقط مقصد داخلی pishtaj.ir مجاز است');
        elseif ($to[0] !== '/') jerr('مقصد باید با / شروع شود یا آدرس کامل داخلی باشد');
        $toUrl = (strpos($to, 'http') === 0) ? $to : 'https://pishtaj.ir' . $to;
        $f = $ROOT . '/' . $from;
        cms_backup($DATA, $ROOT, $from);
        $stub = '<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"> <!-- ptf-redirect -->'
            . '<meta http-equiv="refresh" content="0;url=' . htmlspecialchars($toUrl, ENT_QUOTES, 'UTF-8') . '">'
            . '<link rel="canonical" href="' . htmlspecialchars($toUrl, ENT_QUOTES, 'UTF-8') . '">'
            . '<meta name="robots" content="noindex"><title>منتقل شد</title></head>'
            . '<body><p>این صفحه به نشانی جدید منتقل شده — <a href="' . htmlspecialchars($toUrl, ENT_QUOTES, 'UTF-8') . '">ادامه ←</a></p></body></html>';
        if (file_put_contents($f, $stub, LOCK_EX) === false) jerr('خطای نوشتن');
        sitemap_remove('https://pishtaj.ir/' . $from);
        $regFile = $DATA . '/cms-redirects.json';
        $reg = is_file($regFile) ? (json_decode((string)@file_get_contents($regFile), true) ?: []) : [];
        $reg = array_values(array_filter($reg, function ($r) use ($from) { return is_array($r) && ($r['from'] ?? '') !== $from; }));
        $reg[] = ['from' => $from, 'to' => $toUrl, 'ts' => date('c'), 'by' => $identity['user'] ?? '?'];
        @file_put_contents($regFile, json_encode($reg, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), LOCK_EX);
        if (is_file($DATA . '/cms-seo-scan.json')) @unlink($DATA . '/cms-seo-scan.json');
        cms_log('page_redirect', $from . ' -> ' . $toUrl);
        jok(['from' => $from, 'to' => $toUrl]);
        break;

    case 'redirect_list':
        $regFile = $DATA . '/cms-redirects.json';
        $reg = is_file($regFile) ? (json_decode((string)@file_get_contents($regFile), true) ?: []) : [];
        $live = [];
        foreach ($reg as $r) {
            if (!is_array($r)) continue;
            $fr = (string)($r['from'] ?? '');
            if ($fr === '' || !is_file($ROOT . '/' . $fr)) continue;
            $c = (string)@file_get_contents($ROOT . '/' . $fr);
            if (strpos($c, 'ptf-redirect') === false) continue; /* فایل بازگردانی شده — رکورد کهنه */
            $live[] = $r;
        }
        @file_put_contents($regFile, json_encode($live, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), LOCK_EX);
        jok(['redirects' => $live]);
        break;

    case 'redirect_remove':
        $from = str_replace('\\', '/', trim((string)($_POST['from'] ?? '')));
        $from = ltrim(preg_replace('#\.\./#', '', $from), '/');
        if ($from === '' || !is_file($ROOT . '/' . $from)) jerr('مسیر یافت نشد');
        /* بازیابی آخرین بک‌آپِ پیش از ریدایرکت */
        $safe = str_replace(array('/', '\\'), '__', $from);
        $cands = glob($DATA . '/cms-backups/' . $safe . '--*.html') ?: [];
        if (!$cands) jerr('بک‌آپی برای بازیابی نیست');
        rsort($cands);
        $restored = (string)file_get_contents($cands[0]);
        if (strpos($restored, 'ptf-redirect') !== false && count($cands) > 1) $restored = (string)file_get_contents($cands[1]);
        if (strpos($restored, 'ptf-redirect') !== false) jerr('بک‌آپ سالمی یافت نشد');
        if (file_put_contents($ROOT . '/' . $from, $restored, LOCK_EX) === false) jerr('خطای بازیابی');
        sitemap_add('https://pishtaj.ir/' . $from);
        $regFile = $DATA . '/cms-redirects.json';
        $reg = is_file($regFile) ? (json_decode((string)@file_get_contents($regFile), true) ?: []) : [];
        $reg = array_values(array_filter($reg, function ($r) use ($from) { return is_array($r) && ($r['from'] ?? '') !== $from; }));
        @file_put_contents($regFile, json_encode($reg, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), LOCK_EX);
        if (is_file($DATA . '/cms-seo-scan.json')) @unlink($DATA . '/cms-seo-scan.json');
        cms_log('redirect_remove', $from);
        jok(['restored' => $from]);
        break;

    /* ═══ v34.10.0 (S1): صف متای AI ═══ */
    case 'seo_queue_add':
        $paths = $_POST['paths'] ?? array();
        if (is_string($paths)) { $pd = json_decode($paths, true); $paths = is_array($pd) ? $pd : array(); } /* FormData آرایه را JSON-string می‌فرستد */
        if (!is_array($paths) || !$paths) jerr('فهرست مسیرها خالی است');
        if (count($paths) > 60) $paths = array_slice($paths, 0, 60); /* سقف هر batch */
        $q = seo_queue_load($DATA);
        $scan = null; /* اسکن تنبل: فقط اگر رکورد جدید واقعاً اضافه شد (کش ۱۰ دقیقه‌ای) */
        $scanLoaded = false;
        $added = 0; $skipped = 0;
        foreach ($paths as $pth) {
          $okp = seo_queue_valid_path($ROOT, $pth);
          if ($okp === '') { $skipped++; continue; }
          $id = sha1($okp);
          if (isset($q['items'][$id]) && in_array($q['items'][$id]['st'], array('pending', 'proposed'), true)) { $skipped++; continue; }
          /* مقدار فعلی عنوان/توضیح از اسکن (کش‌شده) برای diff در مرحلهٔ تأیید */
          if (!$scanLoaded) { $scan = cms_seo_scan($ROOT, $DATA); $scanLoaded = true; }
          $cur = null;
          foreach ($scan['pages'] as $pg) if ($pg['path'] === $okp) { $cur = $pg; break; }
          $q['items'][$id] = array(
            'id' => $id, 'path' => $okp, 'st' => 'pending',
            'title_cur' => $cur ? $cur['title'] : '', 'desc_cur' => $cur ? $cur['desc'] : '',
            'title_new' => '', 'desc_new' => '',
            'addedAt' => date('c'), 'by' => $identity['user'] ?? '?', 'doneAt' => '', 'err' => '',
          );
          $added++;
        }
        if (count($q['items']) > 500) { /* سقف کل صف: قدیمی‌ترین doneها حذف */
          $byAge = $q['items'];
          uasort($byAge, function ($a, $b) { return strcmp((string)($a['addedAt'] ?? ''), (string)($b['addedAt'] ?? '')); });
          $over = count($q['items']) - 500;
          foreach (array_slice(array_keys($byAge), 0, $over) as $dropId) unset($q['items'][$dropId]);
        }
        seo_queue_save($DATA, $q);
        jok(array('added' => $added, 'skipped' => $skipped, 'total' => count($q['items'])));
        break;

    case 'seo_queue_list':
        $q = seo_queue_load($DATA);
        $items = array_values($q['items']);
        usort($items, function ($a, $b) { /* pending/proposed اول، بعد جدیدترین افزودن */
          $rank = function ($it) { return $it['st'] === 'pending' ? 0 : ($it['st'] === 'proposed' ? 1 : 2); };
          $ra = $rank($a); $rb = $rank($b);
          if ($ra !== $rb) return $ra - $rb;
          return strcmp((string)($b['addedAt'] ?? ''), (string)($a['addedAt'] ?? ''));
        });
        $counts = array('pending' => 0, 'proposed' => 0, 'done' => 0, 'error' => 0);
        foreach ($q['items'] as $it) if (isset($counts[$it['st']])) $counts[$it['st']]++;
        jok(array('items' => array_slice($items, 0, 120), 'counts' => $counts, 'total' => count($q['items'])));
        break;

    case 'seo_queue_propose':
        $pth = seo_queue_valid_path($ROOT, $_POST['path'] ?? '');
        if ($pth === '') jerr('مسیر نامعتبر');
        $title = trim((string)($_POST['title'] ?? ''));
        $desc  = trim((string)($_POST['desc'] ?? ''));
        if ($title === '' || mb_strlen($title, 'UTF-8') > 200) jerr('عنوان پیشنهادی نامعتبر');
        if ($desc === '' || mb_strlen($desc, 'UTF-8') > 400) jerr('توضیح پیشنهادی نامعتبر');
        $q = seo_queue_load($DATA);
        $id = sha1($pth);
        if (!isset($q['items'][$id])) jerr('این مسیر در صف نیست');
        if (!empty($_POST['fail'])) { /* v34.10.0: AI پاسخ نداد — بدون پیشنهاد، خطا ثبت شود */
            $q['items'][$id]['st'] = 'error';
            $q['items'][$id]['err'] = 'هوش مصنوعی پاسخ نداد';
            $q['items'][$id]['doneAt'] = date('c');
            seo_queue_save($DATA, $q);
            jok(array('id' => $id, 'failed' => true));
        }
        $q['items'][$id]['title_new'] = $title;
        $q['items'][$id]['desc_new'] = $desc;
        $q['items'][$id]['st'] = 'proposed';
        $q['items'][$id]['proposedBy'] = 'ai+' . ($identity['user'] ?? '?');
        seo_queue_save($DATA, $q);
        jok(array('id' => $id));
        break;

    case 'seo_queue_apply':
        $ids = $_POST['ids'] ?? array();
        if (is_string($ids) && $ids !== '') { $jd = json_decode($ids, true); $ids = is_array($jd) ? $jd : array(); }
        if (!is_array($ids)) $ids = array();
        $all = !empty($_POST['all_proposed']);
        if (!$ids && !$all) jerr('چیزی برای اعمال انتخاب نشده');
        if (count($ids) > 50) $ids = array_slice($ids, 0, 50);
        $q = seo_queue_load($DATA);
        $results = array();
        foreach ($q['items'] as $iid => $it) {
          if ($it['st'] !== 'proposed') continue;
          if (!$all && !in_array($iid, $ids, true)) continue;
          $pth = seo_queue_valid_path($ROOT, $it['path']);
          $err = $pth === '' ? 'فایل دیگر موجود نیست' : seo_queue_apply_one($ROOT, $DATA, $pth, $it['title_new'], $it['desc_new']);
          $q['items'][$iid]['st'] = $err === '' ? 'done' : 'error';
          $q['items'][$iid]['err'] = $err;
          $q['items'][$iid]['doneAt'] = date('c');
          $results[] = array('path' => $it['path'], 'ok' => $err === '', 'err' => $err);
        }
        seo_queue_save($DATA, $q);
        jok(array('results' => $results));
        break;

    case 'seo_queue_clear':
        $mode = (string)($_POST['mode'] ?? 'done'); /* done | all */
        $q = seo_queue_load($DATA);
        $before = count($q['items']);
        foreach ($q['items'] as $iid => $it) {
          if ($mode === 'all' || $it['st'] === 'done' || $it['st'] === 'error') unset($q['items'][$iid]);
        }
        seo_queue_save($DATA, $q);
        jok(array('removed' => $before - count($q['items']), 'total' => count($q['items'])));
        break;

    /* ═══ v34.10.0 (S1/SITEMAP-DRIFT): انحراف نقشه — URLهای روح (فایل ندارند) و فایل‌های بدون نقشه ═══ */
    case 'sitemap_drift':
        $smapUrls = array_keys(cms_sitemap_urls($ROOT));
        $files = array();
        foreach (cms_public_pages($ROOT) as $rel) $files[$rel] = true;
        $ghost = array(); $missing = array();
        foreach ($smapUrls as $u) {
          $rel = ltrim(preg_replace('#^https://pishtaj\.ir/#i', '', $u), '/');
          if ($rel === '') $rel = 'index.html';
          if (!isset($files[$rel])) $ghost[] = $u;
        }
        foreach (array_keys($files) as $rel) {
          if (!isset($smapUrls['https://pishtaj.ir/' . $rel]) && !in_array('https://pishtaj.ir/' . $rel, $smapUrls, true)) $missing[] = $rel;
        }
        sort($ghost); sort($missing);
        jok(array('ghost' => array_slice($ghost, 0, 100), 'ghost_total' => count($ghost),
                  'missing' => array_slice($missing, 0, 100), 'missing_total' => count($missing),
                  'sitemap_total' => count($smapUrls), 'files_total' => count($files)));
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
