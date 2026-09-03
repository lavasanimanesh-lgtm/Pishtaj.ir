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

/* ═══ v34.26.0 (PROD-INDEX): فهرست محصولات — products/index.html با کارت هر صفحه ═══
   پیش از این پوشهٔ products هیچ صفحهٔ فهرستی نداشت (403) و محصول جدید «جایی دیده
   نمی‌شد». با هر انتشار، فهرست از روی همهٔ صفحات محصول (نشانهٔ ptf-product) بازسازی
   می‌شود: تایتل/توضیح/تصویر از متای همان صفحه، جدیدترین اول. */
/* ═══ v34.29.0 (SMART-IMG + REL-LINK): عکس پیش‌فرض هوشمند برای صفحات محصول و
   اصلاح لینک‌های نسبیِ هم‌پوشه هنگام کپی اسکلت مرکز دانش به products/ ═══ */
function cms_prod_img_guess($hay) {
    $h = mb_strtolower((string)$hay);
    if (trim($h) === '') return '';
    $rules = [
        ['gate','gate-valve-api600-realistic.jpg'], ['ball','ball-valve-api6d-trunnion-realistic.jpg'],
        ['butterfly','butterfly-valve-triple-offset-realistic.jpg'], ['check','check-valve-dual-plate-realistic.jpg'],
        ['control','control-valve-pneumatic-positioner-realistic.jpg'], ['globe','globe-valve-api623-realistic.jpg'],
        ['elbow','butt-weld-fittings-realistic.jpg'], ['tee','butt-weld-fittings-realistic.jpg'],
        ['fitting','butt-weld-fittings-realistic.jpg'], ['reducer','butt-weld-fittings-realistic.jpg'],
        ['forged','forged-fittings-realistic.jpg'], ['flange','welding-neck-flanges-realistic.jpg'],
        ['gasket','industrial-gaskets-realistic.jpg'], ['bolt','stud-bolts-nuts-realistic.jpg'], ['stud','stud-bolts-nuts-realistic.jpg'],
        ['a333','a333-low-temperature-pipe-realistic.jpg'], ['a335','alloy-steel-pipe-a335-realistic.jpg'],
        ['api 5l','api-5l-line-pipe-realistic.jpg'], ['api5l','api-5l-line-pipe-realistic.jpg'],
        ['a106','seamless-pipe-a106-realistic.jpg'], ['seamless','seamless-pipe-a106-realistic.jpg'],
        ['stainless','stainless-steel-pipe-long-bundle-realistic.jpg'], ['a312','stainless-steel-pipe-long-bundle-realistic.jpg'],
        ['pipe','seamless-pipe-a106-realistic.jpg'], ['tube','seamless-pipe-a106-realistic.jpg'],
        ['strainer','industrial-strainer-filter-realistic.jpg'], ['filter','industrial-strainer-filter-realistic.jpg'],
        ['pump','api-610-centrifugal-pump-realistic.jpg'], ['compressor','screw-compressor-realistic.jpg'],
        ['flowmeter','magnetic-flowmeter-flanged-realistic.jpg'], ['flow meter','magnetic-flowmeter-flanged-realistic.jpg'],
        ['transmitter','pressure-transmitter-industrial-realistic.jpg'], ['gauge','pressure-gauge-safety-realistic.jpg'],
        ['thermowell','thermowell-flanged-realistic.jpg'], ['level','radar-level-transmitter-realistic.jpg'],
        ['boiler','fire-tube-boiler-realistic.jpg'], ['heat exchanger','shell-tube-heat-exchanger-realistic.jpg'],
        ['exchanger','shell-tube-heat-exchanger-realistic.jpg'], ['transformer','power-transformer-realistic.jpg'],
        ['switchgear','lv-mv-switchgear-realistic.jpg'], ['cable','industrial-cables-realistic.jpg'],
        ['valve','gate-valve-api600-realistic.jpg'],
    ];
    foreach ($rules as $ru) if (mb_strpos($h, $ru[0]) !== false) return 'assets/images/products/generated/' . $ru[1];
    return '';
}
function cms_rel_links_fix($html) {
    /* لینک/تصویر نسبیِ هم‌پوشه (مثل astm-a312.html) در اسکلت مرکز دانش، از products/ به
       knowledge-center/ اشاره می‌کند؛ مسیرهای ../، http، //، /، # و tel:/mailto: دست نمی‌خورند. */
    return preg_replace_callback('/(href|src)=\"([^\"]+)\"/', function ($m) {
        $u = $m[2];
        if ($u === '' || $u[0] === '#' || $u[0] === '/' || strpos($u, '../') === 0 || stripos($u, 'http://') === 0 || stripos($u, 'https://') === 0 || stripos($u, 'tel:') === 0 || stripos($u, 'mailto:') === 0) return $m[0];
        if (preg_match('/^(https?:)?\/\//i', $u) || preg_match('/^[a-z]+:/i', $u)) return $m[0];
        return $m[1] . '="../knowledge-center/' . $u . '"';
    }, (string)$html);
}

/* ═══ v34.32.0 (CMS-FIX): اسکلت مشترک مرکز دانش — مقاوم در برابر تغییر قالب ═══
   نشانگرهای قدیمی (هیرو گرادیانی + دیو سی‌تی‌ای) در بازنویسی قالب مرکز دانش از بین
   رفته بودند و مولدها خطای «ساختار قالب مرجع شناخته نشد» می‌گرفتند. این تابع هر دو
   قالب را پشتیبانی می‌کند، بردکرامب و منوی فعالِ صفحهٔ مرجع را حذف می‌کند و
   استایل‌های درون‌خطی قالب را برای تزریق برمی‌گرداند. */
function cms_kc_skeleton($ROOT) {
    $skel = (string)@file_get_contents($ROOT . '/knowledge-center/astm-a105.html');
    if ($skel === '') return ['err' => 'قالب مرجع یافت نشد'];
    $pBody = strpos($skel, '<body>');
    $pFoot = strpos($skel, '<footer');
    $pHero = strpos($skel, '<section class="article-hero"');
    if ($pHero === false) $pHero = strpos($skel, '<section style="background:linear-gradient(135deg,#151517,#2d2d31)');
    $pCta = strpos($skel, '<section class="kc-supply-cta"');
    if ($pCta === false) $pCta = strpos($skel, '<div class="kc-supply-cta"');
    if ($pBody === false || $pHero === false || $pCta === false || $pFoot === false) return ['err' => 'ساختار قالب مرجع شناخته نشد'];
    $header = substr($skel, $pBody, $pHero - $pBody);
    /* بردکرامب و وضعیت فعال منو متعلق به صفحهٔ مرجع است؛ در صفحهٔ جدید کپی نشود */
    $header = preg_replace('#<nav class="ptf-bc".*?</nav>#s', '', $header);
    $header = str_replace(' class="active"', '', $header);
    $cta    = substr($skel, $pCta, $pFoot - $pCta);
    $footer = substr($skel, $pFoot);
    $style = '';
    if (preg_match_all('#<style>.*?</style>#s', $skel, $mS)) $style = implode("\n", $mS[0]);
    return ['header' => $header, 'cta' => $cta, 'footer' => $footer, 'style' => $style];
}

/* بردکرامب اختصاصی صفحهٔ ساخته‌شده — استایل درون‌خطی تا وابسته به سی‌اس‌اس نباشد */
function cms_bc_html($crumbs) {
    $li = '';
    $n = count($crumbs);
    foreach ($crumbs as $i => $c) {
        if ($i > 0) $li .= '<li aria-hidden="true" style="color:#cbd5e1">/</li>';
        if ($i < $n - 1 && !empty($c[1])) {
            $li .= '<li><a href="' . $c[1] . '" style="color:#64748b;text-decoration:none">' . htmlspecialchars($c[0], ENT_QUOTES, 'UTF-8') . '</a></li>';
        } else {
            $li .= '<li><span aria-current="page" style="color:#0f172a;font-weight:700">' . htmlspecialchars($c[0], ENT_QUOTES, 'UTF-8') . '</span></li>';
        }
    }
    return '<nav class="ptf-bc" aria-label="مسیر صفحه" style="background:#f8fafc;border-bottom:1px solid #e2e8f0;font-size:12.5px">'
        . '<div class="container" style="padding-top:10px;padding-bottom:10px">'
        . '<ol style="display:flex;flex-wrap:wrap;align-items:center;gap:7px;list-style:none;margin:0;padding:0">' . $li . '</ol></div></nav>' . "\n";
}

/* امن‌سازی تصاویر بدنه: فقط مسیرهای داخلی سایت مجازند — وگرنه تگ حذف می‌شود */
function cms_img_sanitize($html) {
    return preg_replace_callback('/<img\b[^>]*>/i', function ($m) {
        if (!preg_match('/\bsrc\s*=\s*"([^"]*)"/i', $m[0], $sm)) return '';
        $src = $sm[1];
        if (preg_match('#^(?:\./|\.\./)?(?:assets|knowledge-center|blog|services|products|industries|comparisons|news|projects)/[A-Za-z0-9_\-./]+\.(?:jpe?g|png|webp|gif)$#i', $src)) return $m[0];
        if (preg_match('#^https://pishtaj\.ir/[A-Za-z0-9_\-./]+\.(?:jpe?g|png|webp|gif)$#i', $src)) return $m[0];
        return '';
    }, $html);
}

/* v34.33.0 (CMS-FIX R2): بردکرامب استاندارد سایت — همان نشان .ptf-bc (استایل در discover.css) */
function cms_bc_ptf($crumbs) {
    $n = count($crumbs); $li = '';
    foreach ($crumbs as $i => $c) {
        $nm = htmlspecialchars((string)$c[0], ENT_QUOTES, 'UTF-8');
        if ($i === $n - 1 || empty($c[1])) {
            $li .= '<li><span aria-current="page">' . $nm . '</span></li>';
        } else {
            $li .= '<li><a href="' . htmlspecialchars((string)$c[1], ENT_QUOTES, 'UTF-8') . '">' . $nm . '</a></li>';
        }
    }
    return '<nav class="ptf-bc" aria-label="مسیر صفحه" data-ptf-bc="cms"><div class="container"><ol>' . $li . '</ol></div></nav>' . "\n";
}

/* v34.33.0 (CMS-FIX R2): اسکلت صفحهٔ محصول — الگوی واقعی بخش محصولات (هیروی تیرهٔ کارت‌دار + سایدبار).
   اگر صفحهٔ مرجع نبود، به اسکلت مرکز دانش بازمی‌گردد تا انتشار هرگز متوقف نشود. */
function cms_product_skeleton($ROOT) {
    $skel = (string)@file_get_contents($ROOT . '/products/gate-valve-16-inch-cl600.html');
    if ($skel === '') {
        $kc = cms_kc_skeleton($ROOT);
        if (!empty($kc['err'])) return $kc;
        $kc['mode'] = 'kc';
        return $kc;
    }
    $pBody = strpos($skel, '<body>');
    $pMain = strpos($skel, '<main id="main-content"');
    $pCta  = strpos($skel, '<div class="supplier-cta"');
    $pFoot = strpos($skel, '<footer');
    if ($pBody === false || $pMain === false || $pCta === false || $pFoot === false) {
        return ['err' => 'ساختار قالب مرجع محصولات شناخته نشد'];
    }
    $header = substr($skel, $pBody, $pMain - $pBody);
    $header = preg_replace('#<nav class="ptf-bc".*?</nav>#s', '', $header);
    $header = str_replace(' class="active"', '', $header);
    preg_match_all('#<style[^>]*>.*?</style>#s', $skel, $sm);
    $style = implode("\n", $sm[0]);
    return ['mode' => 'product', 'header' => $header, 'style' => $style,
        'cta' => substr($skel, $pCta, $pFoot - $pCta), 'footer' => substr($skel, $pFoot), 'err' => ''];
}

/* v34.33.0 (CMS-FIX R2): درج «کارت لینک» صفحهٔ تازه در صفحهٔ اصلیِ همان بخش.
   - فقط اگر {پوشه}/index.html وجود داشته باشد؛
   - اگر صفحه از قبل در فهرست لینک شده باشد، کاری نمی‌کند؛
   - بلاک با نشانگرهای اختصاصی مدیریت می‌شود و هر بار از نو ساخته می‌شود (ایمن در برابر تکرار). */
function cms_section_cards_inject($ROOT, $folder, $slug, $title, $desc, $img, $url) {
    $idx = $ROOT . '/' . $folder . '/index.html';
    if (!is_file($idx)) { cms_log('section_cards', $folder . ': index.html نیست — کارت درج نشد'); return false; }
    $html = (string)@file_get_contents($idx);
    if ($html === '' || $slug === '') return false;
    $B = '<!-- CMS:LINK-CARDS:BEGIN -->'; $E = '<!-- CMS:LINK-CARDS:END -->';
    $cards = [];
    $pb = strpos($html, $B); $pe = strpos($html, $E);
    if ($pb !== false && $pe !== false && $pe > $pb) {
        if (preg_match_all('#<a class="ptf-cms-card"[^>]*data-cms-card="([^"]+)"[\s\S]*?</a>#', substr($html, $pb, $pe - $pb), $mm, PREG_SET_ORDER)) {
            foreach ($mm as $m0) if (!isset($cards[$m0[1]])) $cards[$m0[1]] = $m0[0];
        }
        $html = substr($html, 0, $pb) . substr($html, $pe + strlen($E)); /* بلاک قدیمی حذف؛ از نو ساخته می‌شود */
    }
    if (isset($cards[$slug]) || strpos($html, $slug . '.html') !== false) {
        if ($pb !== false) file_put_contents($idx, $html, LOCK_EX); /* فقط بازچینی بلاک موجود */
        return true; /* لینک صفحه از قبل هست (دستی یا خودکار) */
    }
    $t = htmlspecialchars(mb_substr(strip_tags((string)$title), 0, 160), ENT_QUOTES, 'UTF-8');
    $d = htmlspecialchars(mb_substr(strip_tags((string)$desc), 0, 130), ENT_QUOTES, 'UTF-8');
    $im = ($img !== '' && substr((string)$img, -12) !== 'ptf-logo.png')
        ? '<img src="' . htmlspecialchars((string)$img, ENT_QUOTES, 'UTF-8') . '" alt="' . $t . '" loading="lazy" style="width:100%;height:150px;object-fit:cover;border-radius:14px;border:1px solid #e2e8f0;margin-bottom:10px">' : '';
    $cards[$slug] = '<a class="ptf-cms-card" data-cms-card="' . htmlspecialchars($slug, ENT_QUOTES, 'UTF-8') . '" href="' . htmlspecialchars((string)$url, ENT_QUOTES, 'UTF-8') . '" style="display:block;background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:14px;text-decoration:none;color:#334155;box-shadow:0 10px 26px rgba(15,23,42,.05)">' . $im . '<b style="display:block;color:#0f172a;font-size:14.5px;line-height:1.8">' . $t . '</b><span style="display:block;font-size:12.5px;color:#64748b;line-height:1.9;margin-top:4px">' . $d . '</span><span style="display:block;color:#ef4b1a;font-weight:900;font-size:12px;margin-top:8px">مشاهده صفحه ←</span></a>';
    $block = $B . "\n" . '<section style="max-width:1180px;margin:40px auto;padding:0 20px">'
        . '<h2 style="font-size:22px;color:#0f172a;margin:0 0 6px">سایر صفحه‌های این بخش</h2>'
        . '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:16px;margin-top:16px">'
        . implode('', array_values($cards)) . '</div></section>' . "\n" . $E;
    $ins = strpos($html, '<footer');
    if ($ins === false) $ins = strpos($html, '</body>');
    if ($ins === false) return false;
    $html = substr($html, 0, $ins) . $block . "\n" . substr($html, $ins);
    if (file_put_contents($idx, $html, LOCK_EX) === false) return false;
    cms_log('section_cards', $folder . '/index.html ← ' . $slug);
    return true;
}

function cms_products_index_rebuild($ROOT, $DATA, $header, $cta, $footer, $style = '') {
    $dir = $ROOT . '/products';
    $cards = [];
    foreach ((glob($dir . '/*.html') ?: []) as $pf) {
        if (basename($pf) === 'index.html') continue;
        $c = (string)@file_get_contents($pf);
        if ($c === '' || strpos($c, 'ptf-product') === false) continue;
        $t = ''; if (preg_match('/<title>(.*?)<\/title>/is', $c, $m)) $t = trim(html_entity_decode($m[1], ENT_QUOTES, 'UTF-8'));
        $d = ''; if (preg_match('/<meta name="description" content="(.*?)"/is', $c, $m2)) $d = trim(html_entity_decode($m2[1], ENT_QUOTES, 'UTF-8'));
        $im = ''; if (preg_match('/<meta property="og:image" content="(.*?)"/is', $c, $m3)) $im = html_entity_decode($m3[1], ENT_QUOTES, 'UTF-8');
        $h1t = ''; if (preg_match('/<h1[^>]*>(.*?)<\/h1>/is', $c, $m4)) $h1t = trim(strip_tags($m4[1]));
        if ($t === '') continue;
        $cards[] = ['f' => basename($pf), 't' => $t, 'd' => $d, 'im' => $im, 'h' => $h1t !== '' ? $h1t : $t, 'm' => (int)@filemtime($pf)];
    }
    usort($cards, function ($a, $b) { return $b['m'] <=> $a['m']; });
    $items = '';
    foreach ($cards as $cd2) {
        $tE = htmlspecialchars($cd2['t'], ENT_QUOTES, 'UTF-8');
        $dE = htmlspecialchars(mb_substr($cd2['d'], 0, 150, 'UTF-8'), ENT_QUOTES, 'UTF-8');
        $hE = htmlspecialchars($cd2['h'], ENT_QUOTES, 'UTF-8');
        $imE = htmlspecialchars($cd2['im'], ENT_QUOTES, 'UTF-8');
        $items .= '<a href="' . $cd2['f'] . '" style="display:block;background:#fff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;text-decoration:none;color:inherit">' .
            ($imE !== '' ? '<img src="' . $imE . '" alt="' . $hE . '" style="display:block;width:100%;height:170px;object-fit:contain;background:#f8fafc;border-bottom:1px solid #e2e8f0" loading="lazy">' : '') .
            '<div style="padding:12px 14px"><b style="font-size:13.5px;color:#0f172a">' . $hE . '</b>' .
            ($dE !== '' ? '<p style="font-size:11.5px;color:#64748b;line-height:1.9;margin:6px 0 0">' . $dE . '</p>' : '') .
            '<span style="display:inline-block;margin-top:8px;font-size:12px;font-weight:800;color:#ef4b1a">مشاهدهٔ صفحهٔ محصول ←</span></div></a>';
    }
    $html = '<!doctype html>' . "\n" . '<html lang="fa" dir="rtl">' . "\n" . '<head>' . "\n"
        . '<meta charset="utf-8" />' . "\n" . '<meta name="viewport" content="width=device-width, initial-scale=1" />' . "\n"
        . '<title>محصولات | پیشرو تجهیز فرتاک</title>' . "\n"
        . '<meta name="description" content="راهنمای فنی و مشخصات کالاهای تامین‌شده توسط پیشرو تجهیز فرتاک — شیرآلات، اتصالات، فلنج، لوله و تجهیزات ابزار دقیق." />' . "\n"
        . '<meta name="robots" content="index, follow" />' . "\n"
        . '<link rel="canonical" href="https://pishtaj.ir/products/" />' . "\n"
        . '<link rel="stylesheet" href="../assets/css/style.css" />' . "\n"
        . $style . "\n" . '</head>' . "\n" . $header
        . '<section class="article-hero">' . "\n" . '<div class="container">' . "\n"
        . '<span style="background:rgba(239,75,26,.2);color:#ffb033;padding:6px 14px;border-radius:999px;font-size:12.5px;font-weight:800">تجهیزات صنعتی</span>' . "\n"
        . '<h1>محصولات و راهنمای فنی کالاها</h1>' . "\n"
        . '<p style="color:rgba(255,255,255,.75);font-size:14px">راهنمای فنی کالاهای تامین‌شده توسط پیشرو تجهیز فرتاک</p>' . "\n"
        . '</div>' . "\n" . '</section>' . "\n"
        . '<div class="article-wrap">' . "\n" . '<div class="article-content">' . "\n"
        . '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:14px;margin:18px 0 26px">' . $items . '</div>' . "\n"
        . '</div>' . "\n" . '</div>' . "\n" . $cta . "\n" . $footer;
    if (@file_put_contents($dir . '/index.html', $html, LOCK_EX) !== false) {
        cms_log('products_index', count($cards) . ' کارت');
        return true;
    }
    return false;
}

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
  cms_ai_touch($DATA, $file, 'meta'); /* v34.17.0: متای AI اعمال شد */
  return ''; /* خالی = موفق */
}

/* ═══ v34.14.0 (S4/RENDER): رندر صفحهٔ عمومی از قالب مرکز دانش — جدا شد از page_create
   تا «انتشار زمان‌بندی‌شده» هم همین موتور را صدا بزند (یک منشأ، دو دهانه) ═══ */
function cms_page_folders() {
    return [
        'services'    => ['lb' => 'خدمات',         'schema' => 'Service', 'sitemap' => 'sitemap-services.xml'],
        'industries'  => ['lb' => 'صنایع',          'schema' => 'Article', 'sitemap' => 'sitemap-industries.xml'],
        'comparisons' => ['lb' => 'مقایسه محصولات', 'schema' => 'Article', 'sitemap' => 'sitemap-misc.xml'],
    ];
}
function cms_render_public_page($ROOT, $folder, $in) {
    $FOLDERS = cms_page_folders();
    if (!isset($FOLDERS[$folder])) return ['err' => 'پوشهٔ مقصد نامعتبر است'];
    $meta = $FOLDERS[$folder];
    $title = mb_substr(strip_tags($in['title'] ?? ''), 0, 200);
    $h1    = mb_substr(strip_tags($in['h1'] ?? ''), 0, 200);
    $desc  = mb_substr(strip_tags($in['desc'] ?? ''), 0, 300);
    $slug  = strtolower(preg_replace('/[^a-z0-9\-]/', '', $in['slug'] ?? ''));
    $body  = $in['body'] ?? '';
    $img   = preg_replace('#[^a-zA-Z0-9/\-_.:]#', '', $in['img'] ?? '../assets/images/ptf-logo.png');
    if ($title === '' || $slug === '') return ['err' => 'عنوان و نامک (slug) الزامی است'];
    if ($h1 === '') $h1 = $title;
    if (mb_strlen(strip_tags($body), 'UTF-8') < 200) return ['err' => 'متن صفحه حداقل ۲۰۰ کاراکتر لازم دارد'];

    $body = strip_tags($body, '<h2><h3><h4><p><ul><ol><li><b><strong><i><em><table><thead><tbody><tr><th><td><br><blockquote><a><img>');
    $body = preg_replace('/on\w+\s*=\s*"[^"]*"/i', '', $body);
    $body = preg_replace("/on\w+\s*=\s*'[^']*'/i", '', $body);
    $body = preg_replace('/javascript\s*:/i', '', $body);
    $body = cms_img_sanitize($body); /* v34.32.0 (CMS-FIX): فقط تصویر با مسیر داخلی */

    /* v34.32.0 (CMS-FIX): اسکلت مشترک — نشانگرهای مقاوم + حذف بردکرامب مرجع + استایل درون‌خطی */
    $sk = cms_kc_skeleton($ROOT);
    if (!empty($sk['err'])) return ['err' => $sk['err']];
    $header = $sk['header']; $cta = $sk['cta']; $footer = $sk['footer']; $skStyle = $sk['style'];

    $tEsc = htmlspecialchars($title, ENT_QUOTES, 'UTF-8');
    $hEsc = htmlspecialchars($h1, ENT_QUOTES, 'UTF-8');
    $dEsc = htmlspecialchars($desc, ENT_QUOTES, 'UTF-8');
    /* v34.32.0 (CMS-FIX): تصویر فیلد «تصویر» فقط در اوپن‌گراف بود؛ حالا بالای صفحه هم نمایش داده می‌شود */
    if ($img !== '' && substr($img, -12) !== 'ptf-logo.png') {
        $imgRel = str_replace('../', '', $img);
        $body = '<p style="text-align:center;margin:4px 0 18px"><img src="../' . ltrim($imgRel, '/') . '" alt="' . $hEsc . '" style="max-width:640px;width:100%;height:auto;border-radius:14px;border:1px solid #e2e8f0" loading="lazy"></p>' . "\n" . $body;
    }
    $url  = 'https://pishtaj.ir/' . $folder . '/' . $slug . '.html';
    $imgAbs = (strpos($img, 'http') === 0) ? $img : 'https://pishtaj.ir/' . ltrim(str_replace('../', '', $img), '/');
    $folderUrl = 'https://pishtaj.ir/' . $folder . '/';

    $graph = [];
    if ($meta['schema'] === 'Service') {
        $graph[] = ['@type' => 'Service', 'name' => $h1, 'description' => $desc,
            'provider' => ['@type' => 'Organization', 'name' => 'پیشرو تجهیز فرتاک'],
            'areaServed' => 'IR', 'url' => $url, 'image' => $imgAbs];
    } else {
        $graph[] = ['@type' => 'Article', 'headline' => $h1, 'description' => $desc,
            'author' => ['@type' => 'Organization', 'name' => 'پیشرو تجهیز فرتاک'],
            'mainEntityOfPage' => ['@type' => 'WebPage', '@id' => $url], 'image' => $imgAbs];
    }
    $graph[] = ['@type' => 'BreadcrumbList', 'itemListElement' => [
        ['@type' => 'ListItem', 'position' => 1, 'name' => 'خانه', 'item' => 'https://pishtaj.ir/'],
        ['@type' => 'ListItem', 'position' => 2, 'name' => $meta['lb'], 'item' => $folderUrl],
        ['@type' => 'ListItem', 'position' => 3, 'name' => $title],
    ]];
    $jsonLd = json_encode(['@context' => 'https://schema.org', '@graph' => $graph], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

    /* v34.14.0 (S4/HREFLANG): اگر نسخهٔ انگلیسیِ هم‌مسیر روی دیسک هست، سه‌گانهٔ
       hreflang (fa-IR + en + x-default) تزریق می‌شود؛ اگر نیست، هیچ لینکی به ۴۰۴ ساخته نمی‌شود. */
    $hreflang = '';
    if (is_file($ROOT . '/en/' . $folder . '/' . $slug . '.html')) {
        $enUrl = 'https://pishtaj.ir/en/' . $folder . '/' . $slug . '.html';
        $hreflang = '<link rel="alternate" hreflang="fa-IR" href="' . $url . '" />' . "\n"
            . '<link rel="alternate" hreflang="en" href="' . $enUrl . '" />' . "\n"
            . '<link rel="alternate" hreflang="x-default" href="' . $url . '" />' . "\n";
    }

    $html = '<!doctype html>' . "\n" . '<html lang="fa" dir="rtl">' . "\n" . '<head>' . "\n"
        . '<meta charset="utf-8" />' . "\n"
        . '<meta name="viewport" content="width=device-width, initial-scale=1" />' . "\n"
        . '<title>' . $tEsc . '</title>' . "\n"
        . '<meta name="description" content="' . $dEsc . '" />' . "\n"
        . '<meta name="robots" content="index, follow" />' . "\n"
        . '<link rel="canonical" href="' . $url . '" />' . "\n"
        . $hreflang
        . '<meta property="og:locale" content="fa_IR" />' . "\n"
        . '<meta property="og:site_name" content="پیشرو تجهیز فرتاک" />' . "\n"
        . '<meta property="og:type" content="' . ($meta['schema'] === 'Service' ? 'website' : 'article') . '" />' . "\n"
        . '<meta property="og:title" content="' . $tEsc . '" />' . "\n"
        . '<meta property="og:description" content="' . $dEsc . '" />' . "\n"
        . '<meta property="og:url" content="' . $url . '" />' . "\n"
        . '<meta property="og:image" content="' . htmlspecialchars($imgAbs, ENT_QUOTES, 'UTF-8') . '" />' . "\n"
        . '<meta name="twitter:card" content="summary_large_image" />' . "\n"
        . '<link rel="stylesheet" href="../assets/css/style.css" />' . "\n"
        . '<link rel="stylesheet" href="../assets/css/discover.css" />' . "\n" /* v34.33.0: استایل بردکرامب سایت */
        . $skStyle . "\n"
        . '<script type="application/ld+json">' . $jsonLd . '</script>' . "\n"
        . '</head>' . "\n"
        . $header . cms_bc_ptf([['خانه', 'https://pishtaj.ir/'], [$meta['lb'], $folderUrl], [$title, null]])
        . '<section class="article-hero">' . "\n" . '<div class="container">' . "\n"
        . '<span style="background:rgba(239,75,26,.2);color:#ffb033;padding:6px 14px;border-radius:999px;font-size:12.5px;font-weight:800">' . $meta['lb'] . '</span>' . "\n"
        . '<h1>' . $hEsc . '</h1>' . "\n"
        . '<p style="color:rgba(255,255,255,.75);font-size:14px">واحد محتوای فنی پیشرو تجهیز فرتاک</p>' . "\n"
        . '</div>' . "\n" . '</section>' . "\n"
        . '<div class="article-wrap">' . "\n" . '<div class="article-content">' . "\n"
        . $body . "\n"
        . '</div>' . "\n" . '</div>' . "\n"
        . $cta . "\n" . $footer;
    return ['html' => $html, 'rel' => $folder . '/' . $slug . '.html', 'url' => $url,
        'folder' => $folder, 'slug' => $slug, 'title' => $title, 'desc' => $desc, 'img_abs' => $imgAbs]; /* v34.33.0: داده برای کارت فهرست بخش */
}

/* ═══ v34.14.0 (S4/SCHED): انتشار زمان‌بندی‌شده — موتور lazy بدون cron ═══
   هر فراخوانی api/cms.php ابتدا صف را چک می‌کند؛ آیتم‌های تأییدشده که موعدشان
   رسیده باشد همان‌جا منتشر می‌شوند (بک‌آپ + نقشه + لاگ). قاعدهٔ دومرحله‌ای:
   آیتمِ ثبت‌شده به دست «commercial» تا تأیید مدیر ارشد در صف می‌ماند. */
function cms_sched_file($DATA) { return $DATA . '/cms-sched.json'; }
function cms_sched_load($DATA) {
    $j = is_file(cms_sched_file($DATA)) ? json_decode((string)@file_get_contents(cms_sched_file($DATA)), true) : null;
    return (is_array($j) && isset($j['items']) && is_array($j['items'])) ? $j : ['items' => []];
}
function cms_sched_save($DATA, $q) {
    @file_put_contents(cms_sched_file($DATA), json_encode($q, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), LOCK_EX);
}
function cms_sched_publish_item($ROOT, $DATA, $it) { /* نوشتن فایل رندرشدهٔ ذخیره‌شده + بک‌آپ + نقشه */
    $rel = (string)($it['rel'] ?? '');
    if ($rel === '' || strpos($rel, '..') !== false) return 'مسیر نامعتبر';
    $f = $ROOT . '/' . $rel;
    if (file_exists($f)) cms_backup($DATA, $ROOT, $rel);
    if (file_put_contents($f, (string)($it['html'] ?? ''), LOCK_EX) === false) return 'خطای نوشتن فایل';
    sitemap_add((string)$it['url']);
    /* v34.33.0: کارت صفحهٔ منتشرشده در فهرست بخش (متا از خود خروجی رندرشده) */
    if (preg_match('#^([a-z0-9-]+)/#', $rel, $cmF) && strpos($rel, 'blog/') !== 0 && strpos($rel, 'knowledge-center/') !== 0) {
        $cHtml = (string)($it['html'] ?? '');
        $cDesc = preg_match('/<meta name="description" content="([^"]*)"/', $cHtml, $cmD) ? html_entity_decode($cmD[1], ENT_QUOTES, 'UTF-8') : '';
        $cImg  = preg_match('/<meta property="og:image" content="([^"]*)"/', $cHtml, $cmI) ? $cmI[1] : '';
        cms_section_cards_inject($ROOT, $cmF[1], basename($rel, '.html'), (string)($it['title'] ?? ''), $cDesc, $cImg, (string)$it['url']);
    }
    if (is_file($DATA . '/cms-seo-scan.json')) @unlink($DATA . '/cms-seo-scan.json');
    cms_log('sched_publish', $rel);
    cms_ai_touch($DATA, $rel, 'page'); /* v34.17.0 */
    return '';
}
function cms_sched_due($ROOT, $DATA) {
    $q = cms_sched_load($DATA);
    if (!$q['items']) return;
    $now = time(); $changed = false;
    foreach ($q['items'] as $id => $it) {
        if (!is_array($it) || ($it['st'] ?? '') !== 'approved' || !empty($it['done'])) continue;
        if ((int)($it['at'] ?? 0) > $now + 30) continue;
        $err = cms_sched_publish_item($ROOT, $DATA, $it);
        $q['items'][$id]['done'] = 1;
        $q['items'][$id]['done_at'] = $now;
        $q['items'][$id]['err'] = $err;
        $changed = true;
    }
    /* پاک‌سازی: ۱۵ انتشارِ انجام‌شدهٔ آخر نگه داشته می‌شود */
    $done = array_filter($q['items'], function ($it) { return is_array($it) && !empty($it['done']); });
    if (count($done) > 15) {
        uasort($done, function ($a, $b) { return (int)($b['done_at'] ?? 0) <=> (int)($a['done_at'] ?? 0); });
        foreach (array_slice($done, 15) as $k => $_) unset($q['items'][$k]);
    }
    if ($changed) cms_sched_save($DATA, $q);
}

/* ═══ v34.14.0 (S4/BACKUP): مرور/بازیابی بک‌آپ‌های موجود (crm/data/cms-backups) ═══ */
function cms_backups_list($DATA) {
    $out = [];
    foreach ((glob($DATA . '/cms-backups/*.html') ?: []) as $f) {
        $b = basename($f);
        if (!preg_match('/^(.*)--(\d{8}-\d{6})\.html$/', $b, $m)) continue;
        $rel = str_replace('__', '/', $m[1]);
        $out[$rel][] = ['stamp' => $m[2], 'size' => filesize($f)];
    }
    ksort($out);
    return $out;
}
function cms_backup_path($DATA, $rel, $stamp) { /* فقط نام امن — ضد path-traversal */
    $safe = str_replace(['/', '\\'], '__', (string)$rel);
    if (!preg_match('/^\d{8}-\d{6}$/', (string)$stamp)) return '';
    $p = $DATA . '/cms-backups/' . $safe . '--' . $stamp . '.html';
    return is_file($p) ? $p : '';
}

/* ═══ v34.14.0 (S4/PSI): PageSpeed Insights برای صفحات پول‌ساز ═══ */
function cms_psi_cfg_file($DATA) { return $DATA . '/psi-config.json'; }
function cms_psi_cfg($DATA) {
    $j = is_file(cms_psi_cfg_file($DATA)) ? json_decode((string)@file_get_contents(cms_psi_cfg_file($DATA)), true) : null;
    $urls = (is_array($j) && isset($j['urls']) && is_array($j['urls'])) ? $j['urls'] : ['/', '/products/', '/services/', '/industries/', '/knowledge-center/'];
    return array_values(array_slice($urls, 0, 10));
}
function cms_psi_hist_file($DATA) { return $DATA . '/psi-history.json'; }
function cms_psi_hist($DATA) {
    $j = is_file(cms_psi_hist_file($DATA)) ? json_decode((string)@file_get_contents(cms_psi_hist_file($DATA)), true) : null;
    return is_array($j) ? $j : [];
}
function cms_psi_http($url) { /* GET با cURL + timeout ۲۵ثانیه؛ خطا => ['', err] */
    if (!function_exists('curl_init')) return ['', 'cURL روی هاست فعال نیست'];
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_TIMEOUT => 25,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_USERAGENT => 'PTF-CRM-PSI/1.0',
    ]);
    $b = curl_exec($ch);
    $e = curl_error($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($b === false) return ['', $e !== '' ? $e : 'خطای شبکه'];
    if ($code < 200 || $code >= 300) return ['', 'HTTP ' . $code];
    return [(string)$b, ''];
}

/* ═══ v34.15.0 (S5/HREFLANG): همگام‌سازی دوطرفهٔ hreflang بین fa و en/ ═══
   فقط جفت‌هایی که هر دو فایل روی دیسک موجودند لمس می‌شوند؛ stubهای ریدایرکت مستثنا.
   idempotent: بلوک hreflang قبلی حذف و سه‌گانهٔ درست درج می‌شود؛ تغییر نبود = بدون نوشتن. */
function cms_hreflang_url($rel) {
    $u = 'https://pishtaj.ir/' . $rel;
    if (substr($rel, -10) === 'index.html') $u = 'https://pishtaj.ir/' . substr($rel, 0, -10);
    return $u;
}
function cms_hreflang_block($faUrl, $enUrl) { /* x-default = نسخهٔ فارسی (زبان پیش‌فرض سایت) */
    return '<link rel="alternate" hreflang="fa-IR" href="' . $faUrl . '" />' . "\n"
         . '<link rel="alternate" hreflang="en" href="' . $enUrl . '" />' . "\n"
         . '<link rel="alternate" hreflang="x-default" href="' . $faUrl . '" />';
}
function cms_hreflang_apply_file($ROOT, $DATA, $rel, $faUrl, $enUrl) {
    $f = $ROOT . '/' . $rel;
    $t = (string)@file_get_contents($f);
    if ($t === '' || stripos($t, 'ptf-redirect') !== false) return false; /* stub ریدایرکت دست نمی‌خورد */
    /* حذف hreflangهای موجود (دو نقل‌قولی) برای جلوگیری از تکرار */
    $n = preg_replace('#<link[^>]*rel=["\']alternate["\'][^>]*hreflang=["\'][^"\']*["\'][^>]*>\s*?#isu', '', $t, -1, $c1);
    if ($n === null) $n = $t;
    $n = preg_replace('#<link[^>]*hreflang=["\'][^"\']*["\'][^>]*rel=["\']alternate["\'][^>]*>\s*?#isu', '', $n, -1, $c2);
    if ($n === null) $n = $t;
    $block = cms_hreflang_block($faUrl, $enUrl);
    $isEn = strpos($rel, 'en/') === 0;
    if (preg_match('#<link[^>]*rel=["\']canonical["\'][^>]*>\s*#isu', $n, $mC, PREG_OFFSET_CAPTURE)) {
        $ins = $mC[0][1] + strlen($mC[0][0]);
        $n = substr($n, 0, $ins) . $block . "\n" . substr($n, $ins);
    } else {
        $n = preg_replace('#</head>#isu', $block . "\n</head>", $n, 1);
    }
    if (trim($n) === trim($t)) return false; /* بدون تغییر — نوشتن لازم نیست */
    if (strlen($n) > strlen($t) * 1.2 + 5000) return false;
    cms_backup($DATA, $ROOT, $rel);
    return file_put_contents($f, $n, LOCK_EX) !== false;
}

/* ═══ v34.15.0 (S5/ALT): اسکن تصاویرِ بدون صفتِ alt + اعمال گروهی متن جایگزین ═══ */
function cms_alt_rows($ROOT, $cap = 60) { /* [(page, src, disk)] — فقط نبودِ صفتِ alt (alt="" تزئینی درست است) */
    $rows = [];
    foreach (cms_public_pages($ROOT) as $page) {
        $t = (string)@file_get_contents($ROOT . '/' . $page);
        if ($t === '') continue;
        if (preg_match_all('#<img\b[^>]*>#isu', $t, $m)) {
            foreach ($m[0] as $tag) {
                if (preg_match('#\balt\s*=#isu', $tag)) continue;
                if (!preg_match('#\bsrc\s*=\s*["\']([^"\']+)["\']#isu', $tag, $ms)) continue;
                $src = trim($ms[1]);
                if ($src === '' || strpos($src, 'data:') === 0 || stripos($src, 'javascript:') === 0) continue;
                /* مسیر روی دیسک: نسبت به پوشهٔ صفحه + نرمال‌سازی قطعه‌ایِ ./ و ../ */
                $disk = dirname($page) === '.' ? $src : dirname($page) . '/' . $src;
                $segs = [];
                foreach (explode('/', str_replace('\\', '/', $disk)) as $seg) {
                    if ($seg === '' || $seg === '.') continue;
                    if ($seg === '..') { array_pop($segs); continue; }
                    $segs[] = $seg;
                }
                $disk = implode('/', $segs);
                $abs = $ROOT . '/' . ltrim($disk, '/');
                $ok = is_file($abs) && preg_match('#\.(jpe?g|png|webp|gif)$#i', $abs) && @filesize($abs) > 0 && @filesize($abs) <= 3 * 1048576;
                $rows[] = ['page' => $page, 'src' => $src, 'disk' => $ok ? ltrim($disk, '/') : ''];
                if (count($rows) >= $cap) return $rows;
            }
        }
    }
    return $rows;
}

/* ═══ v34.17.0 (S3-id/AI-IMPACT): رجیستری صفحات AI-لمس‌شده ═══
   «AI-لمس‌شده» = صفحه‌ای که با یکی از مسیرهای محتوای هوشمند ساخته/ویرایش شده:
   page (مولد صفحه/زمان‌بند) · blog · kc · product · meta (صف متای AI) · alt (بینایی).
   ذخیره: crm/data/ai-touched.json — {path:{last,k:{kind:n}}} با سقف ۱۰۰۰ مسیر. */
function cms_ai_file($DATA) { return $DATA . '/ai-touched.json'; }
function cms_ai_load($DATA) {
    $j = is_file(cms_ai_file($DATA)) ? json_decode((string)@file_get_contents(cms_ai_file($DATA)), true) : null;
    return (is_array($j) && isset($j['paths']) && is_array($j['paths'])) ? $j : ['paths' => [], 'seeded' => 0];
}
function cms_ai_save($DATA, $j) {
    @file_put_contents(cms_ai_file($DATA), json_encode($j, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), LOCK_EX);
}
function cms_ai_touch($DATA, $rel, $kind) {
    $rel = ltrim(preg_replace('#\.\./#', '', str_replace('\\', '/', (string)$rel)), '/');
    if ($rel === '' || strpos($rel, '..') !== false) return;
    $j = cms_ai_load($DATA);
    if (!isset($j['paths'][$rel]) || !is_array($j['paths'][$rel])) $j['paths'][$rel] = ['last' => '', 'k' => []];
    $j['paths'][$rel]['last'] = date('c');
    $j['paths'][$rel]['k'][$kind] = (int)($j['paths'][$rel]['k'][$kind] ?? 0) + 1;
    if (count($j['paths']) > 1000) { /* قدیمی‌ترین بر اساس last */
        uasort($j['paths'], function ($a, $b) { return strcmp((string)($a['last'] ?? ''), (string)($b['last'] ?? '')); });
        foreach (array_slice(array_keys($j['paths']), 0, count($j['paths']) - 1000) as $drop) unset($j['paths'][$drop]);
    }
    cms_ai_save($DATA, $j);
}
/* بذر اولیه از cms_log.txt — رجیستری از امروز فعال است؛ تاریخچهٔ لاگ (۲۰هزار خط آخر)
   بهترین بازسازیِ ممکن برای گذشته است. نقشهٔ اکشن→پوشه همان مولدهاست. */
function cms_ai_seed_from_log($ROOT, $DATA) {
    $j = cms_ai_load($DATA);
    if (!empty($j['seeded'])) return $j;
    $log = $DATA . '/cms_log.txt';
    if (is_file($log)) {
        $map = ['page_create' => 'page', 'sched_publish' => 'page', 'blog_create' => 'blog', 'kc_create' => 'kc', 'product_create' => 'product', 'seo_queue_apply' => 'meta'];
        foreach (explode("\n", (string)@file_get_contents($log)) as $line) {
            $parts = array_map('trim', explode('|', $line));
            if (count($parts) < 4) continue;
            $act = $parts[2] ?? ''; $ref = $parts[3] ?? '';
            if (!isset($map[$act])) continue;
            $rel = trim(explode(' ', $ref)[0]); /* جداکنندهٔ | بعد از مسیر؛ اولین توکن کافی است */
            if ($act === 'blog_create') $rel = 'blog/' . $rel . '.html';
            elseif ($act === 'kc_create') $rel = 'knowledge-center/' . $rel . '.html';
            elseif ($act === 'product_create') $rel = 'products/' . $rel . '.html';
            if ($rel === '' || strpos($rel, '..') !== false || substr($rel, -5) !== '.html') continue;
            if (!isset($j['paths'][$rel]) || !is_array($j['paths'][$rel])) $j['paths'][$rel] = ['last' => '', 'k' => []];
            $j['paths'][$rel]['last'] = substr((string)$parts[0], 0, 19);
            $j['paths'][$rel]['k'][$map[$act]] = (int)($j['paths'][$rel]['k'][$map[$act]] ?? 0) + 1;
        }
    }
    $j['seeded'] = 1;
    cms_ai_save($DATA, $j);
    return $j;
}

/* v34.14.0 (S4/SCHED): قلاب lazy — هر فراخوانی (حتی sched_list)، آیتم‌های موعد‌رسیدهٔ
   تأییدشده را منتشر می‌کند؛ پاسخ همان فراخوانی وضعیت تازه را نشان می‌دهد (بدون cron) */
cms_sched_due($ROOT, $DATA);

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

        // پاکسازی بدنه: فقط تگ‌های امن — تصویر هم مجاز است (v34.32.0)
        $body = strip_tags($body, '<h2><h3><p><ul><ol><li><b><strong><i><em><table><thead><tbody><tr><th><td><br><blockquote><a><img>');
        $body = preg_replace('/on\w+\s*=\s*"[^"]*"/i', '', $body);
        $body = preg_replace("/on\w+\s*=\s*'[^']*'/i", '', $body);
        $body = preg_replace('/javascript\s*:/i', '', $body);
        $body = cms_img_sanitize($body); /* v34.32.0 (CMS-FIX) */
        // پاراگراف‌بندی خودکار متن ساده
        if (strpos($body, '<p>') === false && strpos($body, '<h2>') === false) {
            $body = '<p>' . implode('</p><p>', array_filter(array_map('trim', preg_split('/\n{2,}/', $body)))) . '</p>';
            $body = str_replace("\n", '<br>', $body);
        }

        // اسکلت از یک مقاله موجود (هدر/فوتر/استایل یکسان با سایت)
        $skel = file_get_contents($ROOT . '/blog/gas-detection.html');
        if (!$skel) jerr('قالب مرجع یافت نشد');
        $header = substr($skel, strpos($skel, '<body>'), strpos($skel, '<section class="article-hero"') - strpos($skel, '<body>'));
        /* v34.32.0 (CMS-FIX): بردکرامب و وضعیت فعال منوی صفحه مرجع در پست جدید کپی نشود */
        $header = preg_replace('#<nav class="ptf-bc".*?</nav>#s', '', $header);
        $header = str_replace(' class="active"', '', $header);
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
' . $header . cms_bc_ptf([['خانه', 'https://pishtaj.ir/'], ['وبلاگ', 'https://pishtaj.ir/blog/'], [$title, null]]) . '<section class="article-hero">
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
        cms_section_cards_inject($ROOT, 'knowledge-center', $slug, $title, $desc, $imgAbs, $url); /* v34.33.0: کارت در فهرست مرکز دانش */

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
        cms_ai_touch($DATA, 'blog/' . $slug . '.html', 'blog'); /* v34.17.0 */
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

        /* پاکسازی بدنه: فقط تگ‌های امن — تصویر هم مجاز است (v34.32.0) */
        $body = strip_tags($body, '<h2><h3><h4><p><ul><ol><li><b><strong><i><em><table><thead><tbody><tr><th><td><br><blockquote><a><img>');
        $body = preg_replace('/on\w+\s*=\s*"[^"]*"/i', '', $body);
        $body = preg_replace("/on\w+\s*=\s*'[^']*'/i", '', $body);
        $body = preg_replace('/javascript\s*:/i', '', $body);
        $body = cms_img_sanitize($body); /* v34.32.0 (CMS-FIX) */

        /* قالب از یک صفحهٔ موجودِ مرکز دانش گرفته می‌شود تا هدر/فوتر/استایل
           دقیقاً هم‌شکلِ بقیهٔ صفحات باشد (همان روشِ blog_create) */
        /* v34.32.0 (CMS-FIX): اسکلت مشترک — نشانگرهای مقاوم در برابر تغییر قالب */
        $sk = cms_kc_skeleton($ROOT);
        if (!empty($sk['err'])) jerr($sk['err']);
        $header = $sk['header']; $skStyle = $sk['style'];
        $cta    = cms_rel_links_fix($sk['cta']); /* v34.29.0: لینک نسبی → knowledge-center */
        $footer = cms_rel_links_fix($sk['footer']); /* v34.29.0 */

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
            . $skStyle . "\n"
            . '</head>' . "\n"
            . $header . cms_bc_ptf([['خانه', 'https://pishtaj.ir/'], ['مرکز دانش', 'https://pishtaj.ir/knowledge-center/'], [$title, null]])
            . '<section style="background:linear-gradient(135deg,#151517,#2d2d31);min-height:210px;display:flex;align-items:center">' . "\n"
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
        cms_ai_touch($DATA, 'knowledge-center/' . $slug . '.html', 'kc'); /* v34.17.0 */
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
    case 'product_preview': /* v34.26.0: همان رندر، بدون نوشتن — پیش‌نمایش دقیقاً هم‌شکل صفحهٔ نهایی */
        $preview = ($action === 'product_preview');
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
        if (!$preview && file_exists($file) && empty($_POST['overwrite'])) jerr('exists');

        /* پاکسازی بدنه — همان لیست سفید kc_create؛ تصویر هم مجاز است (v34.32.0) */
        $body = strip_tags($body, '<h2><h3><h4><p><ul><ol><li><b><strong><i><em><table><thead><tbody><tr><th><td><br><blockquote><a><img>');
        $body = preg_replace('/on\w+\s*=\s*"[^"]*"/i', '', $body);
        $body = preg_replace("/on\w+\s*=\s*'[^']*'/i", '', $body);
        $body = preg_replace('/javascript\s*:/i', '', $body);
        $body = cms_img_sanitize($body); /* v34.32.0 (CMS-FIX) */

        /* v34.33.0 (CMS-FIX R2): قالب صفحهٔ محصول = الگوی واقعی بخش محصولات (هیروی تیرهٔ کارت‌دار، بردکرامب، سایدبار دسترسی سریع).
           اگر صفحهٔ مرجع محصولات نبود، با اسکلت مرکز دانش بازمی‌گردد تا انتشار متوقف نشود. */
        $sk = cms_product_skeleton($ROOT);
        if (!empty($sk['err'])) jerr($sk['err']);
        $pmode = $sk['mode']; /* 'product' یا 'kc' (بازگشت) */
        $header = $sk['header']; $skStyle = $sk['style'];
        $cta    = cms_rel_links_fix($sk['cta']); /* v34.29.0: لینک‌های نسبی اسکلت اصلاح می‌شوند */
        $footer = cms_rel_links_fix($sk['footer']); /* v34.29.0 */

        $tEsc = htmlspecialchars($title, ENT_QUOTES, 'UTF-8');
        $hEsc = htmlspecialchars($h1, ENT_QUOTES, 'UTF-8');
        $dEsc = htmlspecialchars($desc, ENT_QUOTES, 'UTF-8');

        /* v34.26.0 (PROD-TIDY): پاراگراف/تیتر نخستِ عیناً برابر H1 یا عنوان حذف می‌شود —
           ریشهٔ «عبارات اضافی بالای صفحه» (مدل متن را با نام تکراری شروع می‌کرد). */
        if (preg_match('/^\s*<(p|h2|h3)[^>]*>(.*?)<\/\1>/is', $body, $mP)) {
            $tP = trim(strip_tags($mP[2]));
            if ($tP !== '' && ($tP === $h1 || $tP === $title)) {
                $body = preg_replace('/^\s*<(p|h2|h3)[^>]*>.*?<\/\1>/is', '', $body, 1);
            }
        }
        /* v34.26.0 (DEDUP): اگر متن AI خودش جدول مشخصات یا سوالات متداول دارد،
           جدول‌های قالب دوباره ساخته نمی‌شوند (رفع تکرار سکشن‌ها). */
        $hasSpecsInBody = (mb_stripos($body, 'مشخصات فنی') !== false || stripos($body, '<table') !== false);
        $hasFaqInBody = (mb_stripos($body, 'سوالات متداول') !== false || mb_stripos($body, 'پرسش‌های متداول') !== false || stripos($body, '<details') !== false);
        /* v34.26.0 (IMG-VIS) + v34.33.0 (CMS-FIX R2): نمایش عکس محصول در صفحه (نه فقط og:image).
           در قالب محصولات عکس داخل کارت هیرو می‌نشیند؛ در بازگشتِ مرکز دانش، بالای متن. */
        if ($img === '' || substr($img, -12) === 'ptf-logo.png') {
            $g = cms_prod_img_guess($title . ' ' . $slug . ' ' . $h1 . ' ' . $brand);
            if ($g !== '') $img = $g;
        }
        $imgHero = '';
        if ($img !== '') {
            $imgRel = str_replace('../', '', $img);
            $imgTag0 = '<img src="../' . ltrim($imgRel, '/') . '" alt="' . $hEsc . '" style="max-width:560px;width:100%;height:auto;border-radius:14px;border:1px solid #e2e8f0">';
            if ($pmode === 'product') { $imgHero = $imgTag0; }
            else { $body = '<p style="text-align:center;margin:4px 0 18px">' . $imgTag0 . '</p>' . "\n" . $body; }
        }
        $url  = 'https://pishtaj.ir/products/' . $slug . '.html';
        $imgAbs = (strpos($img, 'http') === 0) ? $img : 'https://pishtaj.ir/' . ltrim(str_replace('../', '', $img), '/');

        /* جدول مشخصات: آرایهٔ [[کلید,مقدار],…] */
        $specs = json_decode((string)($_POST['specs'] ?? ''), true);
        $specsHtml = '';
        if (!$hasSpecsInBody && is_array($specs) && $specs) { /* v34.26.0: بدون تکرار */
            $rows = '';
            foreach ($specs as $sp) {
                if (!is_array($sp) || count($sp) < 2) continue;
                $k = mb_substr(strip_tags((string)$sp[0]), 0, 80);
                $v = mb_substr(strip_tags((string)$sp[1]), 0, 160); /* v34.26.0: مقادیر خام طولانی (سطر استاندارد RFQ-مانند) کوتاه می‌شوند */
                if ($k === '' && $v === '') continue;
                $rows .= '<tr><th style="text-align:right;padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0;font-weight:700">' . htmlspecialchars($k, ENT_QUOTES, 'UTF-8') . '</th><td style="padding:8px 12px;border:1px solid #e2e8f0">' . htmlspecialchars($v, ENT_QUOTES, 'UTF-8') . '</td></tr>';
            }
            if ($rows !== '') $specsHtml = '<h2>مشخصات فنی</h2><table style="width:100%;border-collapse:collapse;font-size:13.5px;margin:14px 0 22px">' . $rows . '</table>';
        }

        /* سوالات متداول: [{q,a}] */
        $faq = json_decode((string)($_POST['faq'] ?? ''), true);
        $faqHtml = ''; $faqGraph = [];
        if (!$hasFaqInBody && is_array($faq) && $faq) { /* v34.26.0: بدون تکرار — اسکیما هم فقط از FAQ رندرشده */
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
            . '<link rel="stylesheet" href="../assets/css/discover.css" />' . "\n" /* v34.33.0: استایل بردکرامب سایت */
            . $skStyle . "\n"
            . '<script type="application/ld+json">' . $jsonLd . '</script>' . "\n"
            . '</head>' . "\n"
            ;
        if ($pmode === 'product') {
            /* v34.33.0 (CMS-FIX R2): هم‌قالب صفحه‌های موجودِ بخش محصولات — هیروی تیره با عکس، بردکرامب، حاشیهٔ کانتینر و سایدبار دسترسی سریع */
            $heroImg = ($imgHero !== '') ? '<div class="ptf-hero-card">' . $imgHero . '</div>' : '';
            $chips = '<span class="ptf-chip">' . htmlspecialchars($catLb, ENT_QUOTES, 'UTF-8') . '</span>';
            if ($brand !== '') $chips .= '<span class="ptf-chip">' . htmlspecialchars($brand, ENT_QUOTES, 'UTF-8') . '</span>';
            if ($stock) $chips .= '<span class="ptf-chip">موجود در واحد تامین</span>';
            $cta = preg_replace('#<b[^>]*>نیاز به تامین[^<]*</b>#u', '<b style="color:#1e293b">نیاز به تامین ' . $tEsc . ' دارید؟</b>', $cta);
            $html .= $header
                . '<main id="main-content" class="ptf-product-main">' . "\n" . '<div class="container">' . "\n"
                . '<div class="ptf-breadcrumb"><a href="https://pishtaj.ir/">خانه</a> › <a href="https://pishtaj.ir/products/">محصولات</a> › ' . $tEsc . '</div>' . "\n"
                . '<section class="ptf-product-hero"><div class="ptf-hero-grid"><div>'
                . '<h1>' . $hEsc . '</h1>'
                . '<p>' . $dEsc . '</p>'
                . '<div>' . $chips . '</div>'
                . '</div>' . $heroImg . '</div></section>' . "\n"
                . '<div class="ptf-layout">' . "\n"
                . '<article class="ptf-article">' . "\n"
                . $body . "\n" . $specsHtml . "\n" . $faqHtml . "\n"
                . '<div style="background:#fff8f0;border:1px solid #f6c17c;border-radius:16px;padding:18px 22px;margin-top:30px">'
                . '<b>استعلام قیمت این محصول؟</b> قیمت و زمان تامین را همان روز دریافت کنید: <a href="../rfq/" style="color:#ef4b1a;font-weight:800">ثبت استعلام هوشمند ←</a>'
                . '</div>' . "\n" . '</article>' . "\n"
                . '<aside class="ptf-side"><h3>دسترسی سریع</h3>'
                . '<a href="../rfq/?product=' . $slug . '">ثبت استعلام (RFQ) این محصول</a>'
                . '<a href="../services/products/">همهٔ محصولات صنعتی</a>'
                . '<a href="../quality/">تضمین کیفیت</a>'
                . '<a href="../knowledge-center/">مرکز دانش فنی</a>'
                . '<h3 style="margin-top:22px">بررسی فوری</h3>'
                . '<p style="font-size:13px;line-height:1.9;color:#64748b">قبل از استعلام، استاندارد، برندهای مجاز، متریال، شرایط کاری و مدارک اجباری را مشخص کنید.</p>'
                . '</aside>' . "\n"
                . '</div>' . "\n" . '</div>' . "\n" . '</main>' . "\n"
                . $cta . "\n" . $footer;
        } else {
            /* بازگشت: اسکلت مرکز دانش (وقتی صفحهٔ مرجع محصولات در دسترس نیست) */
            $html .= $header . cms_bc_ptf([['خانه', 'https://pishtaj.ir/'], ['محصولات', 'https://pishtaj.ir/products/'], [$title, null]])
                . '<section class="article-hero">' . "\n" . '<div class="container">' . "\n"
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
        }

        if ($preview) jok(['html' => $html, 'url' => 'products/' . $slug . '.html']); /* v34.26.0 */
        if (file_exists($file)) cms_backup($DATA, $ROOT, 'products/' . $slug . '.html');
        if (file_put_contents($file, $html, LOCK_EX) === false) jerr('خطای نوشتن فایل محصول (مجوز write?)');
        sitemap_add($url);
        cms_log('product_create', $slug . ($cd !== '' ? ' | cd=' . $cd : ''));
        cms_ai_touch($DATA, 'products/' . $slug . '.html', 'product'); /* v34.17.0 */
        $idxOk = cms_products_index_rebuild($ROOT, $DATA, $header, $cta, $footer, $skStyle); /* v34.26.0: کارت در فهرست محصولات */
        jok(['url' => 'products/' . $slug . '.html', 'index' => $idxOk ? 'products/index.html' : '']);
        break;

    /* ═══ v34.25.0 (IMG-UPLOAD): تصویر از بیرون برای صفحات و محصولات ═══
       عکس از سیستم کاربر انتخاب و در assets/images سایت ذخیره می‌شود؛ مسیر
       برگشتی در فیلد تصویر فرم می‌نشیند و می‌توان آن را در متن هم درج کرد. */
    case 'image_upload':
        $fu = $_FILES['file'] ?? null;
        if (!$fu || !is_array($fu) || empty($fu['name'])) jerr('فایلی ارسال نشد');
        if (!is_uploaded_file($fu['tmp_name'] ?? '')) jerr('فایل به‌درستی دریافت نشد');
        $isz = (int)($fu['size'] ?? 0);
        if ($isz < 1 || $isz > 8 * 1048576) jerr('حجم تصویر باید حداکثر ۸MB باشد');
        $iext = strtolower(pathinfo((string)$fu['name'], PATHINFO_EXTENSION));
        $imimes = ['jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png', 'webp' => 'image/webp', 'gif' => 'image/gif'];
        if (!isset($imimes[$iext])) jerr('فرمت مجاز: JPG، PNG، WebP، GIF');
        $iinfo = @getimagesize($fu['tmp_name']);
        if ($iinfo === false || (string)($iinfo['mime'] ?? '') !== $imimes[$iext]) jerr('فایل تصویر معتبر نیست');
        $ibase = strtolower(trim((string)($_POST['name'] ?? pathinfo((string)$fu['name'], PATHINFO_FILENAME))));
        $ibase = preg_replace('/[^a-z0-9\-]+/', '-', $ibase) ?? '';
        $ibase = trim(preg_replace('/-+/', '-', $ibase) ?? '', '-');
        if ($ibase === '') $ibase = 'img';
        if (strlen($ibase) > 40) $ibase = substr($ibase, 0, 40);
        try { $irnd = substr(bin2hex(random_bytes(3)), 0, 4); } catch (Throwable $eR) { $irnd = substr(md5(uniqid('', true)), 0, 4); }
        $idir = $ROOT . '/assets/images';
        if (!is_dir($idir)) { @mkdir($idir, 0755, true); }
        $iname = $ibase . '-' . date('Ymd-His') . '-' . $irnd . '.' . $iext;
        $idst = $idir . '/' . $iname;
        if (!move_uploaded_file($fu['tmp_name'], $idst)) jerr('ذخیرهٔ تصویر روی هاست ناموفق بود (مجوز write?)');
        @chmod($idst, 0644);
        cms_log('image_upload', $iname . ' (' . $isz . 'B)');
        jok(['path' => 'assets/images/' . $iname, 'url' => '/assets/images/' . $iname, 'w' => (int)($iinfo[0] ?? 0), 'h' => (int)($iinfo[1] ?? 0)]);
        break;

    /* ═══ v34.13.0 (S2-id/GENERIC-PAGE): مولد صفحهٔ عمومی — services/industries/comparisons ═══ */
    /* ═══ v34.14.0 (S4/SCHED): انتشار زمان‌بندی‌شده + جریان دومرحله‌ای نویسنده/منتشرکننده ═══ */
    case 'sched_add':
        $when = (int)($_POST['when_ts'] ?? 0);
        if ($when < time() + 300) jerr('زمان انتشار باید حداقل ۵ دقیقهٔ دیگر باشد');
        if ($when > time() + 60 * 86400) jerr('زمان انتشار حداکثر تا ۶۰ روز جلوتر مجاز است');
        $r = cms_render_public_page($ROOT, (string)($_POST['folder'] ?? ''), $_POST);
        if (!empty($r['err'])) jerr($r['err']);
        if (is_file($ROOT . '/' . $r['rel']) && empty($_POST['overwrite'])) jerr('exists');
        $q = cms_sched_load($DATA);
        $pend = array_filter($q['items'], function ($it) { return is_array($it) && empty($it['done']); });
        if (count($pend) >= 20) jerr('صف زمان‌بندی پر است (۲۰) — ابتدا موارد را مدیریت کنید');
        $senior = in_array($ROLE, ['admin', 'chairman', 'ceo'], true);
        $id = date('YmdHis') . '-' . substr(sha1($r['rel'] . $when . mt_rand()), 0, 6);
        $q['items'][$id] = [
            'rel' => $r['rel'], 'url' => $r['url'], 'title' => mb_substr(strip_tags($_POST['title'] ?? ''), 0, 200),
            'html' => $r['html'], 'at' => $when, 'author' => $ROLE,
            'st' => $senior ? 'approved' : 'pending', /* commercial: تا تأیید مدیر ارشد معلق */
            'approved_by' => $senior ? $ROLE : '', 'overwrite' => empty($_POST['overwrite']) ? 0 : 1,
        ];
        cms_sched_save($DATA, $q);
        cms_log('sched_add', $r['rel'] . ' | at=' . date('Y-m-d H:i', $when) . ' | st=' . ($senior ? 'approved' : 'pending'));
        jok(['id' => $id, 'st' => $senior ? 'approved' : 'pending', 'pending_approval' => !$senior]);
        break;

    case 'sched_list':
        $q = cms_sched_load($DATA);
        $items = [];
        foreach ($q['items'] as $id => $it) {
            if (!is_array($it)) continue;
            $it['id'] = $id;
            unset($it['html']); /* بدنهٔ رندرشده به کلاینت فرستاده نمی‌شود */
            $items[] = $it;
        }
        usort($items, function ($a, $b) { /* معلق‌ها اول (نزدیک‌ترین موعد)، سپس انجام‌شده‌ها */
            $ad = empty($a['done']); $bd = empty($b['done']);
            if ($ad !== $bd) return $ad ? -1 : 1;
            return (int)($a['at'] ?? 0) <=> (int)($b['at'] ?? 0);
        });
        jok(['items' => $items, 'now' => time(), 'role' => $ROLE]);
        break;

    case 'sched_approve':
        if (!in_array($ROLE, ['admin', 'chairman', 'ceo'], true)) jerr('تأیید انتشار فقط برای مدیر ارشد مجاز است');
        $q = cms_sched_load($DATA);
        $id = (string)($_POST['id'] ?? '');
        if (!isset($q['items'][$id]) || !empty($q['items'][$id]['done'])) jerr('آیتم یافت نشد');
        if (($q['items'][$id]['st'] ?? '') !== 'pending') jerr('این آیتم تأیید شده است');
        $q['items'][$id]['st'] = 'approved';
        $q['items'][$id]['approved_by'] = $ROLE;
        cms_sched_save($DATA, $q);
        cms_log('sched_approve', ($q['items'][$id]['rel'] ?? $id));
        jok(['approved' => $id]);
        break;

    case 'sched_cancel':
        $q = cms_sched_load($DATA);
        $id = (string)($_POST['id'] ?? '');
        if (!isset($q['items'][$id])) jerr('آیتم یافت نشد');
        $it = $q['items'][$id];
        $senior = in_array($ROLE, ['admin', 'chairman', 'ceo'], true);
        if (!$senior && ($it['author'] ?? '') !== $ROLE) jerr('فقط سازندهٔ آیتم یا مدیر ارشد می‌تواند لغو کند');
        if (!empty($it['done'])) jerr('این آیتم منتشر شده است');
        unset($q['items'][$id]);
        cms_sched_save($DATA, $q);
        cms_log('sched_cancel', ($it['rel'] ?? $id));
        jok(['cancelled' => $id]);
        break;

    case 'sched_publish_now':
        if (!in_array($ROLE, ['admin', 'chairman', 'ceo'], true)) jerr('انتشار فوری فقط برای مدیر ارشد مجاز است');
        $q = cms_sched_load($DATA);
        $id = (string)($_POST['id'] ?? '');
        if (!isset($q['items'][$id]) || !empty($q['items'][$id]['done'])) jerr('آیتم یافت نشد');
        if (($q['items'][$id]['st'] ?? '') !== 'approved') jerr('ابتدا آیتم باید تأیید شود');
        $q['items'][$id]['at'] = time() - 1;
        cms_sched_save($DATA, $q);
        cms_sched_due($ROOT, $DATA);
        cms_log('sched_publish_now', ($q['items'][$id]['rel'] ?? $id));
        jok(['published' => $id]);
        break;

    /* ═══ v34.14.0 (S4/BACKUP): مرور/مقایسه/بازگردانی بک‌آپ‌ها ═══ */
    case 'backup_list':
        $list = cms_backups_list($DATA);
        $out = [];
        foreach ($list as $rel => $vers) {
            usort($vers, function ($a, $b) { return strcmp($b['stamp'], $a['stamp']); });
            $out[] = ['rel' => $rel, 'live' => is_file($ROOT . '/' . $rel) ? 1 : 0, 'vers' => array_slice($vers, 0, 3)];
        }
        jok(['files' => $out]);
        break;

    case 'backup_fetch':
        $rel = str_replace('\\', '/', (string)($_POST['rel'] ?? ''));
        $p = cms_backup_path($DATA, $rel, (string)($_POST['stamp'] ?? ''));
        if ($p === '') jerr('نسخهٔ بک‌آپ یافت نشد');
        $livePath = $ROOT . '/' . ltrim(preg_replace('#\.\./#', '', $rel), '/');
        $live = is_file($livePath) ? (string)file_get_contents($livePath) : '';
        $bak = (string)file_get_contents($p);
        /* سقف حجم برای مرور: ۸۰KB از هر سو */
        jok(['bak' => mb_substr($bak, 0, 80000), 'live' => mb_substr($live, 0, 80000),
             'bak_size' => strlen($bak), 'live_size' => strlen($live)]);
        break;

    case 'backup_restore':
        $rel = str_replace('\\', '/', (string)($_POST['rel'] ?? ''));
        $rel = ltrim(preg_replace('#\.\./#', '', $rel), '/');
        if ($rel === '' || !preg_match('#^[A-Za-z0-9\x{0600}-\x{06FF}_./\-]+\.html$#u', $rel)) jerr('مسیر نامعتبر');
        foreach (array_slice(explode('/', $rel), 0, -1) as $seg) { if (cms_skip_dir($seg)) jerr('مسیر نامعتبر'); }
        $p = cms_backup_path($DATA, $rel, (string)($_POST['stamp'] ?? ''));
        if ($p === '') jerr('نسخهٔ بک‌آپ یافت نشد');
        $bak = (string)file_get_contents($p);
        if ($bak === '' || stripos($bak, '<') === false) jerr('محتوای بک‌آپ معتبر نیست');
        $livePath = $ROOT . '/' . $rel;
        if (is_file($livePath)) cms_backup($DATA, $ROOT, $rel); /* نسخهٔ فعلی هم بک‌آپ می‌شود — بازگشتِ بازگشت ممکن است */
        if (file_put_contents($livePath, $bak, LOCK_EX) === false) jerr('خطای نوشتن فایل');
        sitemap_add('https://pishtaj.ir/' . $rel);
        if (is_file($DATA . '/cms-seo-scan.json')) @unlink($DATA . '/cms-seo-scan.json');
        cms_log('backup_restore', $rel . ' | ' . ($_POST['stamp'] ?? ''));
        jok(['restored' => $rel]);
        break;

    /* ═══ v34.14.0 (S4/PSI): PageSpeed Insights — صفحات پول‌ساز ═══ */
    case 'psi_config_get':
        jok(['urls' => cms_psi_cfg($DATA)]);
        break;

    case 'psi_config_set':
        $urls = $_POST['urls'] ?? [];
        if (is_string($urls)) { $d = json_decode($urls, true); $urls = is_array($d) ? $d : []; }
        $clean = [];
        foreach ((array)$urls as $u) {
            $u = '/' . trim((string)$u, '/');
            if ($u === '/') { $clean[] = '/'; continue; }
            if (!preg_match('#^/[A-Za-z0-9\-_./]*$#', $u)) continue;
            $disk = $ROOT . $u . (substr($u, -1) === '/' ? 'index.html' : '');
            if (!is_file($disk) && !is_file($ROOT . $u . '.html') && !is_file($ROOT . $u . '/index.html')) continue; /* فقط مسیرهای موجود */
            $clean[] = rtrim($u, '/');
        }
        $clean = array_values(array_unique($clean));
        if (count($clean) > 10) $clean = array_slice($clean, 0, 10);
        if (!$clean) jerr('هیچ مسیر معتبری باقی نماند');
        @file_put_contents(cms_psi_cfg_file($DATA), json_encode(['urls' => $clean], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), LOCK_EX);
        cms_log('psi_config_set', implode(' ', $clean));
        jok(['urls' => $clean]);
        break;

    case 'psi_run':
        $u = '/' . trim((string)($_POST['url'] ?? ''), '/');
        if ($u === '') $u = '/';
        if (!preg_match('#^/[A-Za-z0-9\-_./]*$#', $u)) jerr('مسیر نامعتبر');
        $target = 'https://pishtaj.ir' . ($u === '/' ? '/' : $u);
        $hist = cms_psi_hist($DATA);
        $runs = isset($hist[$u]['runs']) && is_array($hist[$u]['runs']) ? $hist[$u]['runs'] : [];
        $last = $runs ? end($runs) : null;
        if ($last && (time() - (int)($last['ts'] ?? 0)) < 6 * 3600) jerr('throttled'); /* هر مسیر حداکثر یک‌بار در ۶ ساعت */
        /* کلید اختیاری از gsc-config.php (psi_key) — بدون کلید هم PSI با نرخ پایین جواب می‌دهد */
        $key = '';
        $gc = __DIR__ . '/gsc-config.php';
        if (is_file($gc)) { $c = include $gc; $key = is_array($c) && !empty($c['psi_key']) ? (string)$c['psi_key'] : ''; }
        $api = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=' . urlencode($target)
             . '&strategy=mobile&category=performance&category=seo' . ($key !== '' ? '&key=' . urlencode($key) : '');
        list($body, $err) = cms_psi_http($api);
        if ($err !== '') { jerr('خطای PSI: ' . $err); }
        $j = json_decode($body, true);
        if (!is_array($j)) jerr('پاسخ PSI معتبر نبود');
        if (isset($j['error']['message'])) jerr('PSI: ' . mb_substr((string)$j['error']['message'], 0, 200));
        $lr = $j['lighthouseResult'] ?? null;
        if (!is_array($lr)) jerr('نتیجهٔ Lighthouse در پاسخ نبود');
        $aud = $lr['audits'] ?? [];
        $run = [
            'ts' => time(),
            'score' => (int)round(((float)($lr['categories']['performance']['score'] ?? 0)) * 100),
            'seo' => (int)round(((float)($lr['categories']['seo']['score'] ?? 0)) * 100),
            'lcp' => round((float)($aud['largest-contentful-paint']['numericValue'] ?? 0) / 1000, 1),
            'cls' => round((float)($aud['cumulative-layout-shift']['numericValue'] ?? 0), 3),
            'tbt' => (int)round((float)($aud['total-blocking-time']['numericValue'] ?? 0)),
            'fcp' => round((float)($aud['first-contentful-paint']['numericValue'] ?? 0) / 1000, 1),
        ];
        $runs[] = $run;
        if (count($runs) > 30) $runs = array_slice($runs, -30);
        $hist[$u] = ['runs' => $runs];
        @file_put_contents(cms_psi_hist_file($DATA), json_encode($hist, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), LOCK_EX);
        cms_log('psi_run', $u . ' | score=' . $run['score']);
        jok(['url' => $u, 'run' => $run, 'runs' => $run ? array_slice($runs, -10) : []]);
        break;

    case 'psi_history':
        $hist = cms_psi_hist($DATA);
        $out = [];
        foreach (cms_psi_cfg($DATA) as $u) {
            $runs = isset($hist[$u]['runs']) && is_array($hist[$u]['runs']) ? $hist[$u]['runs'] : [];
            $out[$u] = array_slice($runs, -10);
        }
        jok(['history' => $out]);
        break;

    /* ═══ v34.15.0 (S5/HREFLANG): همگام‌سازی دوطرفهٔ fa ↔ en/ ═══ */
    case 'hreflang_sync':
        $changed = []; $pairs = 0; $enOnly = 0;
        foreach (cms_public_pages($ROOT) as $en) {
            if (strpos($en, 'en/') !== 0) continue;
            $fa = substr($en, 3);
            if (!is_file($ROOT . '/' . $fa)) { $enOnly++; continue; }
            $pairs++;
            $faUrl = cms_hreflang_url($fa);
            $enUrl = cms_hreflang_url($en);
            if (cms_hreflang_apply_file($ROOT, $DATA, $fa, $faUrl, $enUrl)) $changed[] = $fa;
            if (cms_hreflang_apply_file($ROOT, $DATA, $en, $faUrl, $enUrl)) $changed[] = $en;
        }
        if ($changed) {
            if (is_file($DATA . '/cms-seo-scan.json')) @unlink($DATA . '/cms-seo-scan.json');
            cms_log('hreflang_sync', 'pairs=' . $pairs . ' changed=' . count($changed));
        }
        jok(['pairs' => $pairs, 'changed' => count($changed), 'files' => array_slice($changed, 0, 20), 'en_only' => $enOnly]);
        break;

    /* ═══ v34.15.0 (S5/CANONICAL): خود-کانونیکال‌سازی گروهی ═══
       فقط صفحات با ایراد canonical-mismatch/no-canonical؛ stubهای ریدایرکت (canonical عمدی به مقصد) مستثنا. */
    case 'canonical_bulk':
        $scan = cms_seo_scan($ROOT, $DATA);
        $fixed = []; $skipped = 0;
        foreach ($scan['pages'] as $pg) {
            $issues = $pg['issues'] ?? [];
            if (!in_array('canonical-mismatch', $issues, true) && !in_array('no-canonical', $issues, true)) continue;
            $rel = (string)$pg['path'];
            $f = $ROOT . '/' . $rel;
            $t = (string)@file_get_contents($f);
            if ($t === '' || stripos($t, 'ptf-redirect') !== false) { $skipped++; continue; }
            $self = 'https://pishtaj.ir/' . $rel;
            if (substr($rel, -10) === 'index.html') $self = 'https://pishtaj.ir/' . substr($rel, 0, -10);
            $new = '<link rel="canonical" href="' . $self . '" />';
            $t2 = preg_match('#<link[^>]*rel=["\']canonical["\'][^>]*>#isu', $t)
                ? preg_replace('#<link[^>]*rel=["\']canonical["\'][^>]*>#isu', $new, $t, 1)
                : preg_replace('#</title>#isu', '</title>' . "\n" . $new, $t, 1);
            if ($t2 === null || trim($t2) === trim($t)) { $skipped++; continue; }
            cms_backup($DATA, $ROOT, $rel);
            if (file_put_contents($f, $t2, LOCK_EX) === false) { $skipped++; continue; }
            $fixed[] = $rel;
            if (count($fixed) >= 60) break; /* سقف هر اجرا */
        }
        if ($fixed) {
            @unlink($DATA . '/cms-seo-scan.json');
            cms_log('canonical_bulk', 'fixed=' . count($fixed) . ' skipped=' . $skipped);
        }
        jok(['fixed' => count($fixed), 'skipped' => $skipped, 'files' => array_slice($fixed, 0, 20)]);
        break;

    /* ═══ v34.15.0 (S5/ALT): تصاویر بدون alt — اسکن و اعمال گروهی ═══ */
    case 'alt_scan':
        $rows = cms_alt_rows($ROOT, 60);
        jok(['rows' => $rows, 'total' => count($rows)]);
        break;

    case 'alt_apply':
        $items = $_POST['items'] ?? [];
        if (is_string($items)) { $d = json_decode($items, true); $items = is_array($d) ? $d : []; }
        if (!is_array($items) || !$items) jerr('فهرست خالی است');
        if (count($items) > 40) $items = array_slice($items, 0, 40);
        $applied = 0; $touched = [];
        foreach ($items as $it) {
            $page = str_replace('\\', '/', (string)($it['page'] ?? ''));
            $src  = trim((string)($it['src'] ?? ''));
            $alt  = trim(strip_tags((string)($it['alt'] ?? '')));
            $alt  = mb_substr(str_replace(['"', '<', '>', "\n", "\r"], ' ', $alt), 0, 160, 'UTF-8');
            if ($page === '' || $src === '' || mb_strlen($alt, 'UTF-8') < 4) continue;
            if (strpos($page, '..') !== false || strpos($src, '..') !== false) continue;
            $okp = seo_queue_valid_path($ROOT, $page);
            if ($okp === '') continue;
            $f = $ROOT . '/' . $okp;
            $t = (string)@file_get_contents($f);
            if ($t === '') continue;
            $srcQ = preg_quote($src, '#');
            $n = preg_replace_callback('#(<img\b[^>]*\bsrc\s*=\s*["\']' . $srcQ . '["\'][^>]*>)#isu', function ($m) use ($alt) {
                $tag = $m[1];
                if (preg_match('#\balt\s*=\s*(["\'])(.*?)\1#isu', $tag)) {
                    return preg_replace('#\balt\s*=\s*(["\'])(.*?)\1#isu', 'alt="' . $alt . '"', $tag, 1);
                }
                return preg_replace('#\s*/?>$#', ' alt="' . $alt . '" />', $tag, 1);
            }, $t, 1, $cnt);
            if (!$cnt || $n === null || trim($n) === trim($t)) continue;
            if (!in_array($okp, $touched, true)) { cms_backup($DATA, $ROOT, $okp); $touched[] = $okp; }
            if (file_put_contents($f, $n, LOCK_EX) === false) continue;
            $applied++;
        }
        if ($applied) {
            @unlink($DATA . '/cms-seo-scan.json');
            cms_log('alt_apply', 'applied=' . $applied . ' pages=' . count($touched));
            foreach ($touched as $relAlt) cms_ai_touch($DATA, $relAlt, 'alt'); /* v34.17.0 */
        }
        jok(['applied' => $applied, 'pages' => count($touched)]);
        break;

    /* v34.17.0 (S3-id/AI-IMPACT): فهرست صفحات AI-لمس‌شده (با بذر از لاگ در اولین اجرا) */
    case 'ai_list':
        $j = cms_ai_seed_from_log($ROOT, $DATA);
        $paths = [];
        foreach ($j['paths'] as $rel => $m) {
            $paths[] = ['path' => $rel, 'last' => $m['last'] ?? '', 'k' => $m['k'] ?? [], 'live' => is_file($ROOT . '/' . $rel) ? 1 : 0];
        }
        usort($paths, function ($a, $b) { return strcmp((string)$b['last'], (string)$a['last']); });
        jok(['paths' => array_slice($paths, 0, 200), 'total' => count($paths)]);
        break;

    case 'page_create':
        /* v34.14.0 (S4): رندر به cms_render_public_page منتقل شد (مشترک با زمان‌بند) */
        $folder = (string)($_POST['folder'] ?? '');
        $r = cms_render_public_page($ROOT, $folder, $_POST);
        if (!empty($r['err'])) jerr($r['err']);
        $file = $ROOT . '/' . $r['rel'];
        if (file_exists($file) && empty($_POST['overwrite'])) jerr('exists');
        if (file_exists($file)) cms_backup($DATA, $ROOT, $r['rel']);
        if (file_put_contents($file, $r['html'], LOCK_EX) === false) jerr('خطای نوشتن فایل (مجوز write?)');
        sitemap_add($r['url']);
        cms_section_cards_inject($ROOT, $r['folder'], $r['slug'], $r['title'], $r['desc'], $r['img_abs'], $r['url']); /* v34.33.0: کارت در صفحهٔ اصلی بخش */
        cms_log('page_create', $r['rel']);
        cms_ai_touch($DATA, $r['rel'], 'page'); /* v34.17.0 */
        jok(['url' => $r['rel']]);
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
