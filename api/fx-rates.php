<?php
/**
 * PTF CRM — fx-rates.php — v33.4.2
 * نرخ لحظه‌ای ارز — فقط بازار آزاد (TGJU)
 *
 * v33.4.2 (دستور صریح کارفرما، ۱۴۰۵/۰۵/۰۸): «نرخ ارز خیلی دیر می‌آید ... نرخ سنا
 * کلا اشتباه است، اگر عدد درست از منابع معتبر قابل دسترسی نیست کلا کنار گذاشته شود».
 * بررسی مستقیم منابع نشان داد:
 *   - از ۲۲ دی ۱۴۰۴ بانک مرکزی نرخ «اسکناس سنا» را رسماً حذف کرد و فقط «نرخ حواله
 *     مرکز مبادله ارز و طلا» منتشر می‌شود؛ مفهوم قدیمی «سنا» که این فایل دنبال
 *     می‌کرد عملاً منسوخ است.
 *   - صفحه‌ی TGJU که به‌عنوان fallback برای سنا/ICE استفاده می‌شد (sana_buy_usd و
 *     مشابه) از همان تاریخ منجمد مانده و هرگز به‌روزرسانی نمی‌شود.
 *   - sanarate.ir/fxmarketrate.cbi.ir از این محیط قابل resolve نیستند و ice.ir
 *     صراحتاً دسترسی از خارج ایران را مسدود می‌کند («فقط در داخل ایران»)، یعنی
 *     تلاش برای این دو منبع فقط timeout اضافه می‌کرد و پاسخ نوار ارز را کند می‌کرد.
 * راه‌حل: حذف کامل تلاش برای سنا/ICE/isat (۴ تابع + همه‌ی فیلدهای مرتبط)؛ فقط
 * منبع «آزاد» + طلا/یوان از TGJU باقی ماند — هم صحیح‌تر (چون واقعاً زنده است) و
 * هم سریع‌تر (یک تماس شبکه به‌جای تا ۵-۶ تماس با timeout روی دامنه‌های غیرقابل‌دسترس).
 */
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

$action = $_REQUEST['action'] ?? 'rates';
if ($action !== 'rates') {
    echo json_encode(['ok' => false, 'error' => 'action نامعتبر'], JSON_UNESCAPED_UNICODE);
    exit;
}

$data_dir = __DIR__ . '/../crm/data';
if (!is_dir($data_dir)) {
    @mkdir($data_dir, 0755, true);
    @file_put_contents($data_dir . '/.htaccess', "Deny from all\n");
}
$cache_file = $data_dir . '/fx-cache.json';
$TTL = 600; // 10 minutes

$cached = null;
if (file_exists($cache_file)) {
    $cached = json_decode(@file_get_contents($cache_file), true);
    if ($cached && isset($cached['ts']) && (time() - (int)$cached['ts']) < $TTL && !isset($_GET['force'])) {
        $cached['ok'] = true;
        $cached['cache'] = 'fresh';
        echo json_encode($cached, JSON_UNESCAPED_UNICODE);
        exit;
    }
}

function fx_to_en_digits($s) {
    return strtr((string)$s, [
        '۰' => '0', '۱' => '1', '۲' => '2', '۳' => '3', '۴' => '4',
        '۵' => '5', '۶' => '6', '۷' => '7', '۸' => '8', '۹' => '9',
        '٠' => '0', '١' => '1', '٢' => '2', '٣' => '3', '٤' => '4',
        '٥' => '5', '٦' => '6', '٧' => '7', '٨' => '8', '٩' => '9',
        '٬' => ',', '،' => ',', ' ' => '',
    ]);
}

function fx_num_rial($v) {
    $s = fx_to_en_digits((string)$v);
    $s = preg_replace('/[^0-9.]/', '', $s);
    if ($s === '' || !is_numeric($s)) return 0;
    $n = (float)$s;
    if ($n <= 0) return 0;
    return (int)round($n); // واحد پایه نرم‌افزار = ریال
}

function fx_http_get($url, $accept = 'text/html,application/json;q=0.9,*/*;q=0.8', $timeout = 10) {
    $do = function($verify) use ($url, $accept, $timeout) {
        $ch = curl_init($url);
        $headers = [
            'Accept: ' . $accept,
            'Accept-Language: fa-IR,fa;q=0.9,en;q=0.8',
            'Cache-Control: no-cache',
        ];
        if (stripos($url, 'tgju.org') !== false) {
            $headers[] = 'Referer: https://www.tgju.org/';
        }
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => $timeout,
            CURLOPT_CONNECTTIMEOUT => 8,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS => 5,
            CURLOPT_SSL_VERIFYPEER => $verify,
            CURLOPT_SSL_VERIFYHOST => $verify ? 2 : 0,
            CURLOPT_ENCODING => '',
            CURLOPT_USERAGENT => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            CURLOPT_HTTPHEADER => $headers,
        ]);
        $body = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        return ($code >= 200 && $code < 300 && $body) ? $body : null;
    };
    $body = $do(true);
    if ($body !== null) return $body;
    if (stripos($url, 'https://') === 0) return $do(false);
    return null;
}

function fx_fetch_tgju_ajax() {
    $sources = [
        'https://call1.tgju.org/ajax.json',
        'https://call2.tgju.org/ajax.json',
        'https://call3.tgju.org/ajax.json',
        'https://call.tgju.org/ajax.json',
        'https://www.tgju.org/ajax.json',
    ];
    $keymap = [
        'usd_free'      => 'price_dollar_rl',
        'eur_free'      => 'price_eur',
        'cny_free'      => 'price_cny',
        'gold_18'       => 'geram18',
    ];
    $cny_hav_candidates = ['price_transfer_cny', 'yuan_transfer', 'transfer_cny', 'havaleh_cny', 'nima_buy_cny', 'price_cny_hav', 'price_cny', 'cny_hav', 'yuan_hav'];

    foreach ($sources as $src) {
        $body = fx_http_get($src, 'application/json,*/*;q=0.8');
        if (!$body) continue;
        $j = json_decode($body, true);
        $cur = $j['current'] ?? null;
        if (!is_array($cur)) continue;

        $out = [];
        foreach ($keymap as $ours => $theirs) {
            $p = $cur[$theirs]['p'] ?? null;
            $out[$ours] = $p !== null ? fx_num_rial($p) : 0;
        }
        $out['cny_hav'] = 0;
        foreach ($cny_hav_candidates as $cand) {
            if (isset($cur[$cand]['p'])) { $out['cny_hav'] = fx_num_rial($cur[$cand]['p']); break; }
        }
        if (!$out['cny_hav']) {
            foreach ($cur as $k => $v) {
                if (!is_array($v) || !isset($v['p'])) continue;
                if (preg_match('/(cny|yuan)/i', $k) && preg_match('/(transfer|havale|hav)/i', $k)) {
                    $out['cny_hav'] = fx_num_rial($v['p']);
                    break;
                }
            }
        }

        if (($out['usd_free'] ?? 0) > 100000) {
            return ['rates' => $out, 'src' => parse_url($src, PHP_URL_HOST) ?: 'tgju.org'];
        }
    }
    return null;
}

$EMPTY = [
    'usd_free' => 0, 'eur_free' => 0,
    'cny_free' => 0, 'cny_hav' => 0,
    'gold_18' => 0,
    'usd_cny' => 0, 'gold18_cny' => 0, 'gold18_rial' => 0, 'eur_usd' => 0,
];

$tgju = fx_fetch_tgju_ajax();

$rates = $EMPTY;
if ($tgju && !empty($tgju['rates'])) {
    foreach ($tgju['rates'] as $k => $v) {
        if (array_key_exists($k, $rates) && $v > 0) $rates[$k] = $v;
    }
}

/* v24.8 BUG-126-03: کاندیدهای حواله یوان واقعاً مصرف شوند + fallback تبدیل‌ها */
if ((empty($rates['cny_free']) || $rates['cny_free'] <= 0) && !empty($rates['cny_hav']) && $rates['cny_hav'] > 0) {
    $rates['cny_free'] = (int)$rates['cny_hav'];
}
if ((empty($rates['cny_hav']) || $rates['cny_hav'] <= 0) && !empty($rates['cny_free']) && $rates['cny_free'] > 0) {
    $rates['cny_hav'] = (int)$rates['cny_free'];
}
$cnyBase = ($rates['cny_free'] > 0) ? $rates['cny_free'] : (($rates['cny_hav'] > 0) ? $rates['cny_hav'] : 0);
$rates['usd_cny'] = ($cnyBase > 0 && $rates['usd_free'] > 0) ? round($rates['usd_free'] / $cnyBase, 4) : 0;
$rates['gold18_cny'] = ($cnyBase > 0 && $rates['gold_18'] > 0) ? round($rates['gold_18'] / $cnyBase, 2) : 0;
$rates['gold18_rial'] = ($rates['gold_18'] > 0) ? (int)$rates['gold_18'] : 0;
$rates['eur_usd'] = ($rates['usd_free'] > 0 && $rates['eur_free'] > 0) ? round($rates['eur_free'] / $rates['usd_free'], 4) : 0;

$has_any = (($rates['usd_free'] ?? 0) > 100000) || (($rates['eur_free'] ?? 0) > 100000) || (($rates['cny_free'] ?? 0) > 1000);
if ($has_any) {
    $src_market = $tgju['src'] ?? '';
    $payload = [
        'ok' => true,
        'rates' => $rates,
        'unit' => 'rial',
        'src' => $src_market ? 'market: ' . $src_market : '',
        'src_market' => $src_market,
        'hierarchy' => 'tgju(free market only — سنا/ICE به دستور کارفرما حذف شد، منبع منسوخ از ۲۲ دی ۱۴۰۴)',
        'ts' => time(),
        't' => date('Y-m-d H:i'),
        'cache' => 'live',
    ];
    @file_put_contents($cache_file, json_encode($payload, JSON_UNESCAPED_UNICODE), LOCK_EX);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

if ($cached && isset($cached['rates']) && (($cached['unit'] ?? '') !== 'rial')) {
    $cached = null; // کش دوره تومانی نامعتبر است
}
if ($cached && isset($cached['rates'])) {
    $cached['ok'] = true;
    $cached['cache'] = 'stale';
    $cached['staleMin'] = (int)round((time() - (int)$cached['ts']) / 60);
    echo json_encode($cached, JSON_UNESCAPED_UNICODE);
    exit;
}

echo json_encode([
    'ok' => false,
    'error' => 'منبع نرخ ارز در دسترس نیست و کشی هم موجود نیست — بعدا تلاش می‌شود',
    'hierarchy' => 'tgju(free market only)'
], JSON_UNESCAPED_UNICODE);
