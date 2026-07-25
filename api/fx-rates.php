<?php
/**
 * PTF CRM — fx-rates.php — v22.4
 * نرخ لحظه‌ای ارز با سلسله‌مراتب منبع مصوب:
 *   1) sanarate.ir / fxmarketrate.cbi.ir  (official primary)
 *   2) ice.ir (مرکز مبادله)               (official fallback — چند مسیر URL)
 *   3) tgju.org                           (public: آزاد + کلیدهای سنا/ICE)
 *   4) isat.ir                            (legacy emergency fallback)
 *
 * v24.9: تقویت ice.ir + نگاشت کلیدهای سنا/ICE از TGJU وقتی منابع رسمی خالی‌اند
 *
 * نکته:
 * - free market / gold / yuan free همچنان از TGJU تأمین می‌شوند.
 * - نرخ‌های سنا/ETS تا جای ممکن از منابع رسمی خوانده می‌شوند.
 * - این فایل عمداً self-contained است و از crm.php تابعی قرض نمی‌گیرد.
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

function fx_plain_text($html) {
    $t = html_entity_decode(strip_tags((string)$html), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $t = preg_replace('/\s+/u', ' ', $t);
    return trim($t);
}

function fx_http_get_quick($url, $accept = 'text/html,application/json;q=0.9,*/*;q=0.8') {
    return fx_http_get($url, $accept, 5);
}

function fx_http_get($url, $accept = 'text/html,application/json;q=0.9,*/*;q=0.8', $timeout = 10) {
    $do = function($verify) use ($url, $accept, $timeout) {
        $ch = curl_init($url);
        $headers = [
            'Accept: ' . $accept,
            'Accept-Language: fa-IR,fa;q=0.9,en;q=0.8',
            'Cache-Control: no-cache',
        ];
        // ice/sanarate گاهی به Referer/UA مرورگر حساس‌اند
        if (stripos($url, 'ice.ir') !== false) {
            $headers[] = 'Referer: https://www.ice.ir/';
        } elseif (stripos($url, 'sanarate') !== false || stripos($url, 'cbi.ir') !== false) {
            $headers[] = 'Referer: https://www.sanarate.ir/';
        } elseif (stripos($url, 'tgju.org') !== false) {
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

function fx_extract_row_numbers($text) {
    $text = fx_to_en_digits($text);
    preg_match_all('/\d{1,3}(?:,\d{3})+|\d{5,}/', $text, $m);
    $out = [];
    foreach (($m[0] ?? []) as $x) {
        $n = fx_num_rial($x);
        if ($n >= 50000) $out[] = $n; // سال/تاریخ‌ها فیلتر شوند
    }
    return array_values(array_unique($out));
}

function fx_parse_official_table($html) {
    $rows = ['USD' => [], 'EUR' => [], 'CNY' => []];
    foreach (array_keys($rows) as $code) {
        $row = '';
        if (preg_match('~<tr[^>]*>[\s\S]{0,2400}?\b' . preg_quote($code, '~') . '\b[\s\S]*?</tr>~iu', $html, $m)) {
            $row = $m[0];
        } else {
            $plain = fx_plain_text($html);
            if (preg_match('~' . preg_quote($code, '~') . '[\s\S]{0,280}~iu', $plain, $m)) $row = $m[0];
        }
        $rows[$code] = $row ? fx_extract_row_numbers($row) : [];
    }

    $out = [];
    if (count($rows['USD']) >= 2) {
        $out['usd_sana_buy'] = $rows['USD'][0];
        $out['usd_sana_sell'] = $rows['USD'][1];
    }
    if (count($rows['EUR']) >= 2) {
        $out['eur_sana_buy'] = $rows['EUR'][0];
        $out['eur_sana_sell'] = $rows['EUR'][1];
    }
    if (count($rows['CNY']) >= 4) {
        $out['cny_hav'] = $rows['CNY'][3]; // cash buy/sell + TT buy/sell → TT sell
    } elseif (count($rows['CNY']) >= 3) {
        $out['cny_hav'] = $rows['CNY'][2];
    } elseif (count($rows['CNY']) >= 2) {
        $out['cny_hav'] = $rows['CNY'][1];
    }
    return $out;
}

function fx_fetch_sanarate_official() {
    $urls = [
        'https://sanarate.ir/ChangeCulture.aspx?Culture=en-US',
        'https://fxmarketrate.cbi.ir/ChangeCulture.aspx?Culture=en-US',
        'https://fxmarketrate.cbi.ir/',
    ];
    foreach ($urls as $url) {
        $body = fx_http_get($url);
        if (!$body) continue;
        $rates = fx_parse_official_table($body);
        if (($rates['usd_sana_buy'] ?? 0) > 100000 && ($rates['eur_sana_buy'] ?? 0) > 100000) {
            return ['rates' => $rates, 'src' => parse_url($url, PHP_URL_HOST) ?: 'sanarate.ir'];
        }
    }
    return null;
}

function fx_extract_labeled_rate($plain, $labels) {
    foreach ($labels as $lb) {
        if (preg_match('~' . preg_quote($lb, '~') . '\s*[:：]?\s*([0-9,]{2,})~u', $plain, $m)) {
            $n = fx_num_rial($m[1]);
            if ($n > 0) return $n;
        }
    }
    return 0;
}

/**
 * v24.9: ice.ir — چند مسیر URL (www/بدون www + slugهای رایج) + پارس قوی‌تر
 * توجه: بعضی صفحات ice فقط از IP ایران باز می‌شوند؛ در آن حالت null برمی‌گردد.
 */
function fx_fetch_ice_one($mode, $name) {
    /* v25.0: ice فقط چند URL کلیدی + timeout کوتاه تا کل endpoint را نخواباند */
    $slugs = array_values(array_filter(array_unique([
        $name,
        str_replace(' ', '-', $name),
        ($name === 'United States Dollar' ? 'USD' : null),
        ($name === 'Euro' ? 'EUR' : null),
        ($name === 'Chinese Yuan' || $name === 'China Yuan' ? 'CNY' : null),
    ])));
    $hosts = ['https://www.ice.ir', 'https://ice.ir'];
    $modes = array_values(array_unique([$mode, 'Cash', 'TT']));

    foreach ($hosts as $host) {
        foreach ($modes as $m) {
            foreach ($slugs as $slug) {
                if (!$slug) continue;
                $urls = [
                    $host . '/currency-details/' . rawurlencode($m) . '/' . rawurlencode($slug),
                ];
                foreach ($urls as $url) {
                    $body = fx_http_get_quick($url);
                    if (!$body) continue;
                    $plain = fx_plain_text($body);
                    if ($plain === '') continue;
                    if (mb_strpos($plain, 'فقط در داخل ایران') !== false) return null; // geo-block صریح

                    $buy = fx_extract_labeled_rate($plain, ['قیمت خرید', 'نرخ خرید', 'خرید اسکناس', 'خرید حواله', 'خرید']);
                    $sell = fx_extract_labeled_rate($plain, ['قیمت فروش', 'نرخ فروش', 'فروش اسکناس', 'فروش حواله', 'فروش']);

                    // JSON embed احتمالی در صفحه
                    if ((!$buy || !$sell) && preg_match_all('/"(?:buy|sell|purchase|sale|priceBuy|priceSell)"\s*:\s*"?([0-9,]{4,})"?/iu', $body, $jm)) {
                        // ignore — handled below via numbers if needed
                    }
                    if ((!$buy || !$sell) && preg_match('/"buy"\s*:\s*"?([0-9,]{4,})"?/iu', $body, $mb)) {
                        $buy = $buy ?: fx_num_rial($mb[1]);
                    }
                    if ((!$buy || !$sell) && preg_match('/"sell"\s*:\s*"?([0-9,]{4,})"?/iu', $body, $ms)) {
                        $sell = $sell ?: fx_num_rial($ms[1]);
                    }

                    if (!$buy && !$sell) {
                        $nums = fx_extract_row_numbers($plain);
                        if (count($nums) >= 2) {
                            // معمولاً بزرگ‌ترین‌ها نرخ ریالی‌اند
                            rsort($nums);
                            $buy = $nums[1];
                            $sell = $nums[0];
                        } elseif (count($nums) === 1) {
                            $buy = $sell = $nums[0];
                        }
                    }
                    if (($buy && $buy > 100000) || ($sell && $sell > 100000)) {
                        return ['buy' => $buy, 'sell' => $sell, 'src' => parse_url($url, PHP_URL_HOST) . '/' . $m];
                    }
                }
            }
        }
    }
    return null;
}

function fx_fetch_ice_official() {
    // اسکناس + حواله (TT) — هر کدام موجود بود پر می‌شود
    $usdCash = fx_fetch_ice_one('Cash', 'United States Dollar');
    $usdTT   = fx_fetch_ice_one('TT', 'United States Dollar');
    $usd = $usdCash ?: $usdTT;
    if ($usdCash && $usdTT) {
        // خرید از اسکناس/حواله، فروش مشابه — ترجیح: buy از Cash، sell از Cash وگرنه TT
        $usd = [
            'buy'  => $usdCash['buy']  ?: $usdTT['buy'],
            'sell' => $usdCash['sell'] ?: $usdTT['sell'],
            'src'  => 'ice.ir',
        ];
    }

    $eurCash = fx_fetch_ice_one('Cash', 'Euro');
    $eurTT   = fx_fetch_ice_one('TT', 'Euro');
    $eur = $eurCash ?: $eurTT;
    if ($eurCash && $eurTT) {
        $eur = [
            'buy'  => $eurCash['buy']  ?: $eurTT['buy'],
            'sell' => $eurCash['sell'] ?: $eurTT['sell'],
            'src'  => 'ice.ir',
        ];
    }

    $cny = fx_fetch_ice_one('TT', 'Chinese Yuan');
    if (!$cny) $cny = fx_fetch_ice_one('TT', 'China Yuan');
    if (!$cny) $cny = fx_fetch_ice_one('Cash', 'Chinese Yuan');

    $rates = [];
    $srcBits = [];
    if ($usd) {
        if (!empty($usd['buy']))  $rates['usd_sana_buy'] = $usd['buy'];
        if (!empty($usd['sell'])) $rates['usd_sana_sell'] = $usd['sell'];
        if (!empty($usd['src'])) $srcBits[] = $usd['src'];
    }
    if ($eur) {
        if (!empty($eur['buy']))  $rates['eur_sana_buy'] = $eur['buy'];
        if (!empty($eur['sell'])) $rates['eur_sana_sell'] = $eur['sell'];
        if (!empty($eur['src'])) $srcBits[] = $eur['src'];
    }
    if ($cny) {
        $rates['cny_hav'] = !empty($cny['sell']) ? $cny['sell'] : (!empty($cny['buy']) ? $cny['buy'] : 0);
        if (!empty($cny['src'])) $srcBits[] = $cny['src'];
    }

    if (($rates['usd_sana_buy'] ?? 0) > 100000 || ($rates['usd_sana_sell'] ?? 0) > 100000
        || ($rates['eur_sana_buy'] ?? 0) > 100000 || ($rates['eur_sana_sell'] ?? 0) > 100000) {
        return ['rates' => $rates, 'src' => $srcBits ? implode(',', array_unique($srcBits)) : 'ice.ir'];
    }
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
        'usd_sana_buy'  => 'sana_buy_usd',
        'usd_sana_sell' => 'sana_sell_usd',
        'eur_sana_buy'  => 'sana_buy_eur',
        'eur_sana_sell' => 'sana_sell_eur',
        'cny_free'      => 'price_cny',
        'gold_18'       => 'geram18',
    ];
    $cny_hav_candidates = ['price_transfer_cny', 'yuan_transfer', 'transfer_cny', 'havaleh_cny', 'sana_buy_cny', 'nima_buy_cny', 'price_cny_hav', 'price_cny', 'cny_hav', 'yuan_hav'];

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
        // v24.9: کلیدهای جایگزین سنا/ICE در TGJU (بازار متشکل / مرکز مبادله)
        $pick = function($keys) use ($cur) {
            foreach ($keys as $k) {
                if (isset($cur[$k]['p'])) {
                    $n = fx_num_rial($cur[$k]['p']);
                    if ($n > 100000) return $n;
                }
            }
            // جستجوی الگویی کلید
            foreach ($cur as $k => $v) {
                if (!is_array($v) || !isset($v['p'])) continue;
                foreach ($keys as $want) {
                    if (stripos($k, $want) !== false) {
                        $n = fx_num_rial($v['p']);
                        if ($n > 100000) return $n;
                    }
                }
            }
            return 0;
        };
        if (empty($out['usd_sana_buy']) || $out['usd_sana_buy'] <= 0) {
            $out['usd_sana_buy'] = $pick(['sana_buy_usd', 'ice_usd', 'price_dollar_s', 'usd_ice', 'usd_ets', 'nima_buy_usd']);
        }
        if (empty($out['usd_sana_sell']) || $out['usd_sana_sell'] <= 0) {
            $out['usd_sana_sell'] = $pick(['sana_sell_usd', 'ice_usd_sell', 'price_dollar_s', 'usd_ice', 'usd_ets', 'nima_sell_usd']) ?: $out['usd_sana_buy'];
        }
        if (empty($out['eur_sana_buy']) || $out['eur_sana_buy'] <= 0) {
            $out['eur_sana_buy'] = $pick(['sana_buy_eur', 'ice_eur', 'price_eur_s', 'eur_ice', 'nima_buy_eur']);
        }
        if (empty($out['eur_sana_sell']) || $out['eur_sana_sell'] <= 0) {
            $out['eur_sana_sell'] = $pick(['sana_sell_eur', 'ice_eur_sell', 'price_eur_s', 'eur_ice', 'nima_sell_eur']) ?: $out['eur_sana_buy'];
        }
        // اگر فقط یک نرخ ICE برای دلار آمد، buy=sell
        if (($out['usd_sana_buy'] ?? 0) > 0 && ($out['usd_sana_sell'] ?? 0) <= 0) $out['usd_sana_sell'] = $out['usd_sana_buy'];
        if (($out['usd_sana_sell'] ?? 0) > 0 && ($out['usd_sana_buy'] ?? 0) <= 0) $out['usd_sana_buy'] = $out['usd_sana_sell'];
        if (($out['eur_sana_buy'] ?? 0) > 0 && ($out['eur_sana_sell'] ?? 0) <= 0) $out['eur_sana_sell'] = $out['eur_sana_buy'];
        if (($out['eur_sana_sell'] ?? 0) > 0 && ($out['eur_sana_buy'] ?? 0) <= 0) $out['eur_sana_buy'] = $out['eur_sana_sell'];

        if (($out['usd_free'] ?? 0) > 100000 || ($out['usd_sana_buy'] ?? 0) > 100000) {
            return ['rates' => $out, 'src' => parse_url($src, PHP_URL_HOST) ?: 'tgju.org'];
        }
    }
    return null;
}

function fx_fetch_isat_legacy() {
    $body = fx_http_get('https://isat.ir/api/v1/public/rates', 'application/json,*/*;q=0.8');
    if (!$body) return null;
    $j = json_decode($body, true);
    if (!is_array($j) || !isset($j['data']) || !is_array($j['data'])) return null;
    $rates = [];
    foreach ($j['data'] as $item) {
        $code = $item['code'] ?? '';
        $buy = fx_num_rial($item['buy'] ?? 0);
        $sell = fx_num_rial($item['sell'] ?? 0);
        if ($code === 'USD') { $rates['usd_sana_buy'] = $buy; $rates['usd_sana_sell'] = $sell; }
        if ($code === 'EUR') { $rates['eur_sana_buy'] = $buy; $rates['eur_sana_sell'] = $sell; }
        if ($code === 'CNY') { $rates['cny_hav'] = $sell ?: $buy; }
    }
    if (($rates['usd_sana_buy'] ?? 0) > 100000 || ($rates['usd_sana_sell'] ?? 0) > 100000) {
        return ['rates' => $rates, 'src' => 'isat.ir (legacy)'];
    }
    return null;
}

$EMPTY = [
    'usd_free' => 0, 'eur_free' => 0,
    'usd_sana_buy' => 0, 'usd_sana_sell' => 0,
    'eur_sana_buy' => 0, 'eur_sana_sell' => 0,
    'cny_free' => 0, 'cny_hav' => 0,
    'gold_18' => 0,
    'usd_cny' => 0, 'gold18_cny' => 0, 'gold18_rial' => 0, 'eur_usd' => 0,
];

/* v25.0: ترتیب پایدار — اول TGJU (سریع/عمومی) تا نوار ارز خالی نماند؛ بعد منابع رسمی؛ ice فقط اگر سنا خالی است */
$tgju = fx_fetch_tgju_ajax();
$official = fx_fetch_sanarate_official();
if (!$official) $official = fx_fetch_isat_legacy();

$rates = $EMPTY;
if ($tgju && !empty($tgju['rates'])) {
    foreach ($tgju['rates'] as $k => $v) {
        if (array_key_exists($k, $rates) && $v > 0) $rates[$k] = $v;
    }
}
if ($official && !empty($official['rates'])) {
    foreach ($official['rates'] as $k => $v) {
        if (array_key_exists($k, $rates) && $v > 0) $rates[$k] = $v;
    }
}
/* ice فقط وقتی سنا هنوز خالی است — تا timeoutهای زیاد کل API را نشکند */
$needSana = (($rates['usd_sana_buy'] ?? 0) <= 0 && ($rates['usd_sana_sell'] ?? 0) <= 0
    && ($rates['eur_sana_buy'] ?? 0) <= 0 && ($rates['eur_sana_sell'] ?? 0) <= 0);
if ($needSana) {
    $ice = fx_fetch_ice_official();
    if ($ice && !empty($ice['rates'])) {
        foreach ($ice['rates'] as $k => $v) {
            if (array_key_exists($k, $rates) && $v > 0) $rates[$k] = $v;
        }
        if (empty($official)) $official = $ice;
        else if (!empty($ice['src'])) $official['src'] = trim(($official['src'] ?? '') . ' + ' . $ice['src'], ' +');
    }
}
/* اگر سنا از TGJU آمده و official خالی است، src_sana را از tgju بگذار */
if ((!$official || empty($official['src'])) && $tgju && ((($rates['usd_sana_buy'] ?? 0) > 0) || (($rates['usd_sana_sell'] ?? 0) > 0))) {
    $official = ['rates' => [
        'usd_sana_buy' => $rates['usd_sana_buy'] ?? 0,
        'usd_sana_sell' => $rates['usd_sana_sell'] ?? 0,
        'eur_sana_buy' => $rates['eur_sana_buy'] ?? 0,
        'eur_sana_sell' => $rates['eur_sana_sell'] ?? 0,
        'cny_hav' => $rates['cny_hav'] ?? 0,
    ], 'src' => ($tgju['src'] ?? 'tgju.org') . ' (sana/ice keys)'];
}

/* v24.8 BUG-126-03: کاندیدهای حواله یوان واقعاً مصرف شوند + fallback تبدیل‌ها */
$CNY_HAV_CANDIDATES = ['price_cny_hav', 'cny_hav', 'yuan_hav', 'price_transfer_cny', 'yuan_transfer', 'transfer_cny', 'havaleh_cny', 'sana_buy_cny', 'nima_buy_cny', 'price_cny'];
if (empty($rates['cny_hav']) || $rates['cny_hav'] <= 0) {
    foreach ($CNY_HAV_CANDIDATES as $cand) {
        if (!empty($rates[$cand]) && $rates[$cand] > 0) { $rates['cny_hav'] = (int)$rates[$cand]; break; }
    }
}
if ((empty($rates['cny_free']) || $rates['cny_free'] <= 0) && !empty($rates['cny_hav']) && $rates['cny_hav'] > 0) {
    $rates['cny_free'] = (int)$rates['cny_hav'];
}
if ((empty($rates['cny_hav']) || $rates['cny_hav'] <= 0) && !empty($rates['cny_free']) && $rates['cny_free'] > 0) {
    $rates['cny_hav'] = (int)$rates['cny_free'];
}
$out = &$rates;
$cnyBase = ($rates['cny_free'] > 0) ? $rates['cny_free'] : (($rates['cny_hav'] > 0) ? $rates['cny_hav'] : 0);
$out['usd_cny'] = $rates['usd_cny'] = ($cnyBase > 0 && $rates['usd_free'] > 0) ? round($rates['usd_free'] / $cnyBase, 4) : 0;
$out['gold18_cny'] = $rates['gold18_cny'] = ($cnyBase > 0 && $rates['gold_18'] > 0) ? round($rates['gold_18'] / $cnyBase, 2) : 0;
$rates['gold18_rial'] = ($rates['gold_18'] > 0) ? (int)$rates['gold_18'] : 0;
$rates['eur_usd'] = ($rates['usd_free'] > 0 && $rates['eur_free'] > 0) ? round($rates['eur_free'] / $rates['usd_free'], 4) : 0;

$has_any = (($rates['usd_free'] ?? 0) > 100000) || (($rates['eur_free'] ?? 0) > 100000) || (($rates['usd_sana_buy'] ?? 0) > 100000) || (($rates['usd_sana_sell'] ?? 0) > 100000) || (($rates['eur_sana_buy'] ?? 0) > 100000) || (($rates['cny_free'] ?? 0) > 1000);
if ($has_any) {
    $src_market = $tgju['src'] ?? '';
    $src_sana = $official['src'] ?? '';
    $src = trim(($src_sana ? 'sana: ' . $src_sana : '') . ($src_market ? ' | market: ' . $src_market : ''), ' |');
    $payload = [
        'ok' => true,
        'rates' => $rates,
        'unit' => 'rial',
        'src' => $src,
        'src_sana' => $src_sana,
        'src_market' => $src_market,
        'hierarchy' => 'sanarate/fxmarketrate -> ice.ir(multi-path) -> tgju(free+sana/ice keys) -> isat(legacy)',
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
    'hierarchy' => 'sanarate/fxmarketrate -> ice.ir(multi-path) -> tgju(free+sana/ice keys) -> isat(legacy)'
], JSON_UNESCAPED_UNICODE);
