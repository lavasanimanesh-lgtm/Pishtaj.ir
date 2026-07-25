<?php
/**
 * ============ PTF CRM — LLM Proxy (US-196 فاز ۲ + OCR + US-207..241) — Version 101.1 ============
 * کلید API فقط سمت سرور (llm-config.php خارج از webroot) — هرگز به مرورگر نمی‌رود.
 * درخواست‌ها از IP هاست (خارج از ایران) به ارائه‌دهنده می‌رود؛ کاربران از ایران آزادند.
 *
 * اکشن‌ها:
 *   status                                → آیا کانفیگ شده؟ + نمایش نسخه و یوزر استوری فعال
 *   test                                  → تست واقعی اتصال + تشخیص دقیق خطا و پاسخ سرور
 *   translate  {text, dir: fa2en|en2fa}   → ترجمه فنی شرح کالا
 *   identify   {desc}                     → {type, brand, model, en, fa, conf}
 *   ocr        {mime, b64}                → استخراج اقلام از عکس/PDF استعلام
 *   summarize  {text}                     → خلاصه هوشمند درخواست
 *   techcase   {text}                     → تحلیل ساختاریافته پرونده فنی (Stage 1 only)
 *   techproposal {text}                   → بخش‌های روایی Proposal انگلیسی (بدون انجام محاسبه)
 *   leadfinder {text}                     → استخراج کاندیدهای لید از evidence عمومی و ساختاریافته
 *
 * پشتیبانی: provider = 'gemini' (پیش‌فرض) یا 'openai' (هر سرویس OpenAI-compatible).
 */
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');

require_once __DIR__ . '/auth.php';
$llmIdentity = auth_verify_token(auth_get_header_token());
if (!$llmIdentity) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'error' => 'authentication_required'], JSON_UNESCAPED_UNICODE);
    exit;
}
$llmRole = strtolower((string)($llmIdentity['role'] ?? ''));
$llmAllowedRoles = ['admin', 'chairman', 'ceo', 'commercial', 'sales', 'buyer', 'accountant'];
if (!in_array($llmRole, $llmAllowedRoles, true)) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'permission_denied'], JSON_UNESCAPED_UNICODE);
    exit;
}

if (function_exists('opcache_invalidate')) {
    @opcache_invalidate(__FILE__, true);
}

/* ---------- فقط از خود دامنه (CRM) ---------- */
$ref = $_SERVER['HTTP_ORIGIN'] ?? $_SERVER['HTTP_REFERER'] ?? '';
$host = $_SERVER['HTTP_HOST'] ?? '';
if ($ref && $host && parse_url($ref, PHP_URL_HOST) !== $host) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'Cross-origin blocked']);
    exit;
}

/* ---------- کانفیگ خارج از webroot ---------- */
function llm_cfg() {
    $paths = [
        dirname(__DIR__, 2) . '/llm-config.php',
        dirname(__DIR__, 3) . '/llm-config.php',
        dirname(__DIR__) . '/llm-config.php', // اضطراری
    ];
    foreach ($paths as $p) {
        if (file_exists($p)) {
            if (function_exists('opcache_invalidate')) @opcache_invalidate($p, true);
            $config = include $p;
            return is_array($config) ? $config : null;
        }
    }
    return null;
}
$cfg = llm_cfg();
$action = $_REQUEST['action'] ?? 'status';

if ($action === 'status') {
    echo json_encode($cfg
        ? [
            'ok' => true,
            'provider' => $cfg['provider'] ?? 'gemini',
            'model' => $cfg['model'] ?? '',
            'ver' => 'v101.2',
            'us' => 'US-LLM-258: transport diagnostics + cache/quota integrity'
          ]
        : [
            'ok' => false,
            'error' => 'llm-config.php یافت نشد — طبق DOCS-LLM-SETUP.md بسازید',
            'ver' => 'v101.2',
            'us' => 'US-LLM-258'
          ]);
    exit;
}

/* v101.2: تست واقعی بدون cache با گزارش امن cURL/TLS/DNS */
if ($action === 'test') {
    if (!$cfg) { echo json_encode(['ok' => false, 'error' => 'کانفیگ نشده']); exit; }
    $r = llm_call($cfg, 'Reply ONLY as JSON: {"pong":1}', 'ping', null, null, 500, ['skip_cache' => true, 'timeout' => 45, 'connect_timeout' => 15]);
    if (!empty($r['ok'])) {
        echo json_encode([
            'ok' => true,
            'msg' => '✅ اتصال واقعی به سرویس AI (' . ($r['model'] ?? '') . ') موفق بود و پاسخ دریافت شد.',
            'transport' => $r['transport'] ?? null,
            'ver' => 'v101.2'
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
    echo json_encode([
        'ok' => false,
        'error' => $r['error'] ?? 'خطا در برقراری ارتباط',
        'diag' => llm_test_diagnosis($r, $cfg),
        'raw' => mb_substr((string)($r['raw'] ?? ''), 0, 500),
        'transport' => $r['transport'] ?? null,
        'ver' => 'v101.2'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

if (!$cfg) { echo json_encode(['ok' => false, 'error' => 'LLM کانفیگ نشده']); exit; }

/* ---------- Rate limit: ۶۰ درخواست/ساعت per IP ---------- */
$rlFile = sys_get_temp_dir() . '/ptf_llm_rl_' . md5($_SERVER['REMOTE_ADDR'] ?? 'x');
$rl = file_exists($rlFile) ? (json_decode(file_get_contents($rlFile), true) ?: ['n' => 0, 't' => time()]) : ['n' => 0, 't' => time()];
if (time() - $rl['t'] > 3600) $rl = ['n' => 0, 't' => time()];
if (++$rl['n'] > 60) { echo json_encode(['ok' => false, 'error' => 'سقف ۶۰ درخواست در ساعت — کمی بعد تلاش کنید']); exit; }
file_put_contents($rlFile, json_encode($rl));

$in = json_decode(file_get_contents('php://input'), true) ?: [];

/* ---------- فراخوانی ارائه‌دهنده: cache صحیح، quota بدون خروجی debug و تشخیص transport ---------- */
function llm_data_dir() {
    $dir = __DIR__ . '/../crm/data';
    if (!is_dir($dir)) {
        @mkdir($dir, 0755, true);
        if (is_dir($dir) && !file_exists($dir . '/.htaccess')) @file_put_contents($dir . '/.htaccess', "Deny from all\n");
    }
    return $dir;
}

function llm_transport_view($url, $mode, $errno, $err, $info) {
    return [
        'host' => (string)(parse_url($url, PHP_URL_HOST) ?: ''),
        'http' => (int)($info['http_code'] ?? 0),
        'curl_errno' => (int)$errno,
        'curl_error' => mb_substr(trim((string)$err), 0, 220),
        'ip_mode' => $mode,
        'namelookup_ms' => (int)round(((float)($info['namelookup_time'] ?? 0)) * 1000),
        'connect_ms' => (int)round(((float)($info['connect_time'] ?? 0)) * 1000),
        'total_ms' => (int)round(((float)($info['total_time'] ?? 0)) * 1000),
        'ssl_verify_result' => isset($info['ssl_verify_result']) ? (int)$info['ssl_verify_result'] : null
    ];
}

function llm_curl_once($url, $payload, $headers, $cfg, $opts = []) {
    if (!function_exists('curl_init')) {
        return ['body' => false, 'http' => 0, 'transport' => ['host' => (string)(parse_url($url, PHP_URL_HOST) ?: ''), 'http' => 0, 'curl_errno' => -1, 'curl_error' => 'PHP cURL extension is not enabled', 'ip_mode' => 'n/a', 'namelookup_ms' => 0, 'connect_ms' => 0, 'total_ms' => 0, 'ssl_verify_result' => null]];
    }

    $mode = strtolower((string)($opts['ip_mode'] ?? ($cfg['ip_resolve'] ?? 'auto')));
    if (!in_array($mode, ['auto', 'v4', 'v6'], true)) $mode = 'auto';
    $verifyTls = !array_key_exists('tls_verify', $cfg) || $cfg['tls_verify'] !== false;
    $connectTimeout = max(5, min(45, (int)($opts['connect_timeout'] ?? $cfg['connect_timeout'] ?? 15)));
    $timeout = max($connectTimeout + 5, min(120, (int)($opts['timeout'] ?? $cfg['timeout'] ?? 90)));

    $ch = curl_init($url);
    if (!$ch) {
        return ['body' => false, 'http' => 0, 'transport' => ['host' => (string)(parse_url($url, PHP_URL_HOST) ?: ''), 'http' => 0, 'curl_errno' => -2, 'curl_error' => 'curl_init failed', 'ip_mode' => $mode, 'namelookup_ms' => 0, 'connect_ms' => 0, 'total_ms' => 0, 'ssl_verify_result' => null]];
    }

    $curlOpts = [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $payload,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_CONNECTTIMEOUT => $connectTimeout,
        CURLOPT_TIMEOUT => $timeout,
        CURLOPT_ENCODING => '',
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS => 3,
        CURLOPT_SSL_VERIFYPEER => $verifyTls,
        CURLOPT_SSL_VERIFYHOST => $verifyTls ? 2 : 0
    ];
    if ($mode === 'v4' && defined('CURL_IPRESOLVE_V4')) $curlOpts[CURLOPT_IPRESOLVE] = CURL_IPRESOLVE_V4;
    if ($mode === 'v6' && defined('CURL_IPRESOLVE_V6')) $curlOpts[CURLOPT_IPRESOLVE] = CURL_IPRESOLVE_V6;
    curl_setopt_array($ch, $curlOpts);

    $body = curl_exec($ch);
    $errno = curl_errno($ch);
    $err = curl_error($ch);
    $info = curl_getinfo($ch) ?: [];
    $http = (int)($info['http_code'] ?? 0);
    curl_close($ch);

    return ['body' => $body, 'http' => $http, 'transport' => llm_transport_view($url, $mode, $errno, $err, $info)];
}

function llm_call_once($cfg, $model, $system, $userText, $inlineB64 = null, $inlineMime = null, $maxTok = 1200, $opts = []) {
    $provider = strtolower((string)($cfg['provider'] ?? 'gemini'));
    $apiKey = trim((string)($cfg['key'] ?? ''));
    if ($apiKey === '') return ['ok' => false, 'http' => 0, 'error' => 'کلید API در llm-config.php خالی است'];
    if (!in_array($provider, ['gemini', 'openai'], true)) return ['ok' => false, 'http' => 0, 'error' => 'provider در llm-config.php باید gemini یا openai باشد'];

    if ($provider === 'gemini') {
        $parts = [['text' => $system . "\n\n" . $userText]];
        if ($inlineB64) $parts[] = ['inline_data' => ['mime_type' => $inlineMime, 'data' => $inlineB64]];
        $payload = json_encode([
            'contents' => [['parts' => $parts]],
            'generationConfig' => ['temperature' => 0.15, 'maxOutputTokens' => $maxTok, 'responseMimeType' => 'application/json']
        ], JSON_UNESCAPED_UNICODE);
        $base = rtrim((string)($cfg['gemini_base'] ?? $cfg['base'] ?? 'https://generativelanguage.googleapis.com/v1beta'), '/');
        $url = $base . '/models/' . rawurlencode($model) . ':generateContent?key=' . rawurlencode($apiKey);
        $headers = ['Content-Type: application/json', 'User-Agent: PTF-CRM-AI-Agent/25.8 (PHP/cURL)'];
    } else {
        $base = rtrim((string)($cfg['base'] ?? 'https://api.openai.com/v1'), '/');
        $content = $inlineB64
            ? [['type' => 'text', 'text' => $userText], ['type' => 'image_url', 'image_url' => ['url' => 'data:' . $inlineMime . ';base64,' . $inlineB64]]]
            : $userText;
        $payload = json_encode([
            'model' => $model,
            'messages' => [['role' => 'system', 'content' => $system], ['role' => 'user', 'content' => $content]],
            'temperature' => 0.15,
            'max_tokens' => $maxTok,
            'response_format' => ['type' => 'json_object']
        ], JSON_UNESCAPED_UNICODE);
        $url = $base . '/chat/completions';
        $headers = ['Content-Type: application/json', 'Authorization: Bearer ' . $apiKey, 'User-Agent: PTF-CRM-AI-Agent/25.8 (PHP/cURL)'];
    }
    if ($payload === false) return ['ok' => false, 'http' => 0, 'error' => 'ساخت payload درخواست AI ناموفق بود'];

    $dataDir = llm_data_dir();
    $cacheKey = hash('sha256', $provider . '|' . $model . '|' . $system . '|' . $userText . '|' . ($inlineB64 ? hash('sha256', $inlineB64) : '') . '|' . ($inlineMime ?? ''));
    $cacheFile = $dataDir . '/ai_cache.json';
    $cacheData = file_exists($cacheFile) ? json_decode(@file_get_contents($cacheFile), true) : [];
    if (!is_array($cacheData)) $cacheData = [];
    $skipCache = !empty($opts['skip_cache']);
    if (!$skipCache && isset($cacheData[$cacheKey]['res']) && is_array($cacheData[$cacheKey]['res']) && !empty($cacheData[$cacheKey]['res']['ok']) && (time() - (int)($cacheData[$cacheKey]['t'] ?? 0)) < 86400 * 7) {
        return $cacheData[$cacheKey]['res'];
    }

    $userHeader = (string)($_SERVER['HTTP_X_PTF_USER'] ?? $_REQUEST['byUser'] ?? ($_SERVER['REMOTE_ADDR'] ?? 'guest'));
    $roleHeader = strtolower((string)($_SERVER['HTTP_X_PTF_ROLE'] ?? $_REQUEST['byRole'] ?? 'sales'));
    $isSenior = in_array($roleHeader, ['admin', 'chairman', 'ceo', 'commercial'], true);
    $quotaFile = $dataDir . '/ai_quota.json';
    $quotaData = null;
    $quotaKey = '';
    $quotaUsed = 0;
    if (!$isSenior) {
        $quotaData = file_exists($quotaFile) ? json_decode(@file_get_contents($quotaFile), true) : [];
        if (!is_array($quotaData)) $quotaData = [];
        $today = date('Y-m-d');
        foreach ($quotaData as $k => $v) if (substr($k, -10) !== $today) unset($quotaData[$k]);
        $quotaKey = hash('sha256', $userHeader) . '|' . $today;
        $quotaUsed = (int)($quotaData[$quotaKey] ?? 0);
        if ($quotaUsed >= 50) return ['ok' => false, 'http' => 0, 'error' => '⛔ سهمیه روزانه هوش مصنوعی شما (۵۰ درخواست در روز) به اتمام رسیده است. لطفاً فردا تلاش کنید یا از مدیر ارشد درخواست کنید.'];
    }

    /* پیش‌فرض auto است؛ نسخهٔ پیشین IPv4 را اجبار می‌کرد و روی برخی هاست‌ها HTTP 0 می‌ساخت. */
    $transport = llm_curl_once($url, $payload, $headers, $cfg, $opts);
    $body = $transport['body'];
    $code = (int)$transport['http'];
    if ($code < 200 || $code >= 300) {
        return ['ok' => false, 'http' => $code, 'error' => 'خطای سرویس AI (HTTP ' . $code . ')' . (!empty($transport['transport']['curl_error']) ? ' — ' . $transport['transport']['curl_error'] : ''), 'raw' => mb_substr((string)$body, 0, 500), 'transport' => $transport['transport']];
    }

    $cleanBody = preg_replace('/^\xEF\xBB\xBF/', '', (string)$body);
    if ($cleanBody === '') return ['ok' => false, 'http' => $code, 'error' => 'پاسخ 0 بایت (خالی) با HTTP ' . $code . ' از سرور دریافت شد', 'raw' => '', 'transport' => $transport['transport']];
    $json = json_decode($cleanBody, true);
    if ($json === null) return ['ok' => false, 'http' => $code, 'error' => 'پاسخ دریافتی از سرور ساختار JSON معتبر ندارد', 'raw' => mb_substr($cleanBody, 0, 500), 'transport' => $transport['transport']];
    if (!empty($json['error'])) {
        $message = is_array($json['error']) ? ($json['error']['message'] ?? json_encode($json['error'], JSON_UNESCAPED_UNICODE)) : $json['error'];
        return ['ok' => false, 'http' => $code, 'error' => 'خطای اعلامی سرویس AI: ' . $message, 'raw' => mb_substr($cleanBody, 0, 500), 'transport' => $transport['transport']];
    }
    if (!empty($json['promptFeedback']['blockReason'])) return ['ok' => false, 'http' => $code, 'error' => 'مسدود شدن درخواست توسط فیلتر ایمنی (دلیل: ' . $json['promptFeedback']['blockReason'] . ')', 'raw' => mb_substr($cleanBody, 0, 500), 'transport' => $transport['transport']];

    $text = '';
    if ($provider === 'gemini') {
        foreach (($json['candidates'][0]['content']['parts'] ?? []) as $part) if (isset($part['text'])) $text .= $part['text'];
        if ($text === '') {
            $finishReason = $json['candidates'][0]['finishReason'] ?? 'توقف نامعلوم';
            if ($finishReason === 'MAX_TOKENS' && $maxTok < 2000) return llm_call_once($cfg, $model, $system, $userText, $inlineB64, $inlineMime, 2500, $opts);
            return ['ok' => false, 'http' => $code, 'error' => 'پاسخ متنی از مدل دریافت نشد (دلیل توقف مدل: ' . $finishReason . ')', 'raw' => mb_substr($cleanBody, 0, 500), 'transport' => $transport['transport']];
        }
    } else {
        $text = $json['choices'][0]['message']['content'] ?? '';
        if ($text === '') return ['ok' => false, 'http' => $code, 'error' => 'پاسخ متنی خالی از مدل OpenAI-compatible دریافت شد', 'raw' => mb_substr($cleanBody, 0, 500), 'transport' => $transport['transport']];
    }

    $text = preg_replace('/^```(?:json)?\s*/i', '', trim($text));
    $text = preg_replace('/```$/', '', $text);
    $result = ['ok' => true, 'text' => trim($text), 'model' => $model, 'transport' => $transport['transport']];
    if (!$skipCache) {
        $cacheData[$cacheKey] = ['t' => time(), 'res' => $result];
        if (count($cacheData) > 500) {
            uasort($cacheData, function ($a, $b) { return (int)($a['t'] ?? 0) <=> (int)($b['t'] ?? 0); });
            $cacheData = array_slice($cacheData, -500, null, true);
        }
        @file_put_contents($cacheFile, json_encode($cacheData, JSON_UNESCAPED_UNICODE), LOCK_EX);
    }
    if (!$isSenior && is_array($quotaData)) {
        $quotaData[$quotaKey] = $quotaUsed + 1;
        @file_put_contents($quotaFile, json_encode($quotaData), LOCK_EX);
    }
    return $result;
}

function llm_call($cfg, $system, $userText, $inlineB64 = null, $inlineMime = null, $maxTok = 1200, $opts = []) {
    $provider = strtolower((string)($cfg['provider'] ?? 'gemini'));
    $models = array_merge([$cfg['model'] ?? ($provider === 'gemini' ? 'gemini-2.5-flash' : '')], is_array($cfg['fallback_models'] ?? null) ? $cfg['fallback_models'] : ($provider === 'gemini' ? ['gemini-2.5-flash', 'gemini-2.5-flash-lite'] : []));
    $models = array_values(array_filter(array_unique($models)));
    if (!$models) return ['ok' => false, 'http' => 0, 'error' => 'نام مدل در llm-config.php مشخص نشده است'];
    $last = null;
    foreach ($models as $i => $model) {
        $r = llm_call_once($cfg, $model, $system, $userText, $inlineB64, $inlineMime, $maxTok, $opts);
        if (!empty($r['ok'])) {
            if ($i > 0) $r['fallback'] = $model;
            return $r;
        }
        $last = $r;
        $http = (int)($r['http'] ?? 0);
        if (!in_array($http, [404, 429, 500, 502, 503], true)) break;
    }
    return $last ?: ['ok' => false, 'http' => 0, 'error' => 'خطای ناشناخته در فراخوانی مدل‌ها'];
}

function llm_test_diagnosis($r, $cfg) {
    $transport = is_array($r['transport'] ?? null) ? $r['transport'] : [];
    $errno = (int)($transport['curl_errno'] ?? 0);
    $host = $transport['host'] ?? 'ارائه‌دهنده AI';
    if ($errno === -1) return '🧩 افزونه PHP cURL روی هاست فعال نیست. از پشتیبانی هاست بخواهید extension cURL را فعال کند.';
    if ($errno === 6) return '🌐 DNS هاست قادر به resolve کردن «' . $host . '» نیست. پشتیبانی هاست باید DNS resolver/outbound DNS را بررسی کند.';
    if ($errno === 7) return '🔌 اتصال TCP از هاست به «' . $host . ':443» برقرار نشد. معمولاً فایروال outbound یا محدودیت دیتاسنتر علت است.';
    if ($errno === 28) return '⏱️ اتصال خروجی هاست به «' . $host . '» timeout شد. فایروال، route یا کیفیت شبکهٔ سرور را بررسی کنید.';
    if ($errno === 35) return '🔐 TLS handshake با «' . $host . '» ناموفق بود؛ نسخهٔ cURL/OpenSSL یا پروکسی HTTPS هاست باید بررسی شود.';
    if (in_array($errno, [58, 60, 77], true)) return '🔐 اعتبارسنجی گواهی TLS روی هاست ناموفق است. CA bundle/cURL/OpenSSL هاست را به‌روزرسانی کنید؛ TLS verify را غیرفعال نکنید مگر فقط برای تشخیص موقت.';
    $raw = ($r['error'] ?? '') . ' ' . ($r['raw'] ?? '');
    if (stripos($raw, 'location is not supported') !== false || stripos($raw, 'FAILED_PRECONDITION') !== false) return '🌍 موقعیت IP سرور هاست توسط Google پشتیبانی نمی‌شود. از IP/سرور پشتیبانی‌شده یا provider OpenAI-compatible مجاز استفاده کنید.';
    if (stripos($raw, 'API key not valid') !== false || ((int)($r['http'] ?? 0) === 400 && stripos($raw, 'key') !== false)) return '🔑 کلید API نامعتبر است؛ مقدار `key` در llm-config.php را بازبینی کنید.';
    if ((int)($r['http'] ?? 0) === 429 || stripos($raw, 'RESOURCE_EXHAUSTED') !== false) return '⏳ سهمیه یا نرخ درخواست مدل پر شده است؛ quota/billing و نام مدل را بررسی کنید.';
    if ((int)($r['http'] ?? 0) === 404) return '📦 نام مدل یا endpoint تنظیم‌شده معتبر نیست؛ `model` و `gemini_base` را بازبینی کنید.';
    if ((int)($r['http'] ?? 0) === 0) return '⚠️ پاسخ HTTP از ارائه‌دهنده دریافت نشد. جزئیات امن cURL پایین این پیام نمایش داده شده است.';
    if (stripos($raw, '<html') !== false || stripos($raw, '<!DOCTYPE') !== false) return '🛡️ فایروال/پروکسی هاست به‌جای JSON صفحه HTML بازگردانده است.';
    return 'خطای ارتباط با سرویس AI؛ جزئیات امن transport و پاسخ خام را بررسی کنید.';
}

function out_json($res) {

    if (!$res['ok']) { echo json_encode($res, JSON_UNESCAPED_UNICODE); exit; }
    $data = json_decode($res['text'], true);
    if ($data === null) {
        $s = strpos($res['text'], '{');
        $e = strrpos($res['text'], '}');
        if ($s !== false && $e !== false && $e > $s) $data = json_decode(substr($res['text'], $s, $e - $s + 1), true);
    }
    if ($data === null || json_last_error() !== JSON_ERROR_NONE) { echo json_encode(['ok' => false, 'error' => 'خروجی AI ساختار JSON معتبر ندارد (پاسخ قابل تجزیه نبود)', 'raw' => mb_substr($res['text'], 0, 300)], JSON_UNESCAPED_UNICODE); exit; }
    echo json_encode(['ok' => true, 'data' => $data], JSON_UNESCAPED_UNICODE);
    exit;
}

switch ($action) {
    case 'translate':
        $text = trim($in['text'] ?? '');
        $dir = ($in['dir'] ?? 'fa2en') === 'en2fa' ? 'en2fa' : 'fa2en';
        if ($text === '' || mb_strlen($text) > 1200) { echo json_encode(['ok' => false, 'error' => 'متن نامعتبر (حداکثر ۱۲۰۰ کاراکتر)']); exit; }
        $sys = 'You are a technical translator for industrial equipment (piping, valves, instrumentation, electrical) in oil & gas. '
             . ($dir === 'fa2en'
                ? 'Translate the Persian item description to professional English exactly as used in international RFQs/offers. Keep standards (ASTM, ASME, DIN), sizes, ratings unchanged.'
                : 'Translate the English item description to professional Persian (فارسی) as used in Iranian industrial procurement. Keep standards, sizes, ratings unchanged.')
             . ' Reply ONLY as JSON: {"t":"translated text"}';
        out_json(llm_call($cfg, $sys, $text, null, null, 1200));
        break;

    case 'identify':
        $desc = trim($in['desc'] ?? '');
        if ($desc === '' || mb_strlen($desc) > 1200) { echo json_encode(['ok' => false, 'error' => 'شرح نامعتبر']); exit; }
        $sys = 'You are an expert in industrial equipment identification (oil & gas procurement). Given an item description (Persian or English), identify: '
             . 'type (one of: Pipe, Elbow, Tee, Reducer, Cap, Flange, Gasket, Bolt & Nut, Valve, Pump, Instrument, Cable, Electrical, Plate/Sheet, Beam/Profile, Fitting, Strainer, Hose, Other), '
             . 'brand ONLY if a specific model code clearly belongs to a known manufacturer (e.g. 3051→Rosemount, EJA→Yokogawa, Cerabar/PMP→Endress+Hauser, 232.50→WIKA, SITRANS→Siemens); otherwise empty string. Never guess brand from generic descriptions. '
             . 'Also give clean English (en) and Persian (fa) descriptions. conf = confidence 0-100 for brand. '
             . 'Reply ONLY valid JSON: {"type":"...","brand":"...","model":"...","en":"...","fa":"...","conf":0}';
        out_json(llm_call($cfg, $sys, $desc, null, null, 1200));
        break;



    case 'cheque':
        $text = trim($in['text'] ?? '');
        $b64 = $in['b64'] ?? '';
        $mime = $in['mime'] ?? '';
        $okMime = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
        if ($b64 && !in_array($mime, $okMime, true)) { echo json_encode(['ok' => false, 'error' => 'فایل چک نامعتبر است']); exit; }
        if ($b64 && strlen($b64) > 8 * 1048576) { echo json_encode(['ok' => false, 'error' => 'فایل بزرگتر از ~۶MB — فشرده کنید']); exit; }
        if (!$b64 && $text === '') { echo json_encode(['ok' => false, 'error' => 'متن یا فایل چک الزامی است']); exit; }
        $sys = 'You are an OCR/extraction engine for Iranian cheques. Extract cheque fields. Return ONLY valid JSON object: {"sayad":"cheque or Sayad number","no":"cheque or Sayad number","amt":0,"dueFa":"Jalali due date","dueJ":"Jalali due date as YYYY/MM/DD if present","dueISO":"Gregorian YYYY-MM-DD if you can infer, else empty","toWhom":"payee","bank":"bank/branch","note":"for/description"}. Use Rial as amount unit; if amount is written in تومان convert to ریال by ×10. Do not invent.';
        out_json(llm_call($cfg, $sys, $text ?: 'Extract cheque fields from this file.', $b64 ?: null, $b64 ? $mime : null, 2500));
        break;

    case 'bizcard':
        $b64 = $in['b64'] ?? '';
        $mime = $in['mime'] ?? '';
        $okMime = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
        if (!$b64 || !in_array($mime, $okMime, true)) { echo json_encode(['ok' => false, 'error' => 'فایل کارت ویزیت نامعتبر است']); exit; }
        if (strlen($b64) > 8 * 1048576) { echo json_encode(['ok' => false, 'error' => 'فایل بزرگتر از ~۶MB — فشرده کنید']); exit; }
        $sys = 'You are an OCR extraction engine for business cards of industrial/oil-gas companies. The image/PDF may contain ONE business card or MANY business cards (10+). Extract every distinct card/person/company visible. '
             . 'Return ONLY valid JSON: {"cards":[{"company":"Persian/Arabic company name if present","companyEn":"English company name if present","person":"full person name","role":"job title","mobile":"mobile number","phone":"landline","email":"email","website":"website","address":"address","city":"city/country","activity":"business activity/category in Persian, e.g. ابزار دقیق, برق صنعتی, پایپینگ, شیرآلات, پمپ, بازرگانی عمومی","brands":"comma separated brands if explicitly shown","equip":"comma separated specialized equipment/products if shown"}]}. '
             . 'If there is only one card, still return cards with one object. Do not invent. Empty string for missing fields.';
        out_json(llm_call($cfg, $sys, 'Extract all business cards from this file.', $b64, $mime, 4500));
        break;

    case 'ocr':
        $b64 = $in['b64'] ?? '';
        $mime = $in['mime'] ?? '';
        $okMime = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
        if (!$b64 || !in_array($mime, $okMime, true)) { echo json_encode(['ok' => false, 'error' => 'فایل نامعتبر (jpg/png/webp/pdf)']); exit; }
        if (strlen($b64) > 8 * 1048576) { echo json_encode(['ok' => false, 'error' => 'فایل بزرگتر از ~۶MB — فشرده کنید']); exit; }
        $sys = 'You are an OCR + extraction engine for industrial RFQ (استعلام) documents in Persian or English. '
             . 'Extract ALL line items from the attached document. For each item give: '
             . 'tp = type (Pipe, Elbow, Tee, Reducer, Cap, Flange, Gasket, Bolt & Nut, Valve, Pump, Instrument, Cable, Electrical, Plate/Sheet, Beam/Profile, Fitting, Strainer, Hose, Other), '
             . 'nm = concise summary description suitable for product catalog title (e.g. "Pressure Transmitter Rosemount 3051" or "Gate Valve 4 inch CL1500"), '
             . 'spec = FULL EXACT technical specification / description exactly as written in the request, '
             . 'brand = recognizable brand name ONLY if explicitly mentioned in the text OR unambiguously (100%) implied by a model/part code you recognize (e.g. 3051→Rosemount, 232.50→WIKA, EJA→Yokogawa, PMP/FMB→Endress+Hauser, SITRANS→Siemens). If you are not certain, leave empty — never guess. Known brands include: Rosemount, WIKA, Yokogawa, Endress+Hauser, Siemens, Samson, KROHNE, ABB, Honeywell, FOXBORO, Fisher, Swagelok, Flowserve, Vega, Danfoss, Rotork. Otherwise empty string, '
             . 'model = exact model code / part number EXTRACTED FROM ANYWHERE in the item description, even if embedded mid-sentence (e.g. 3051CD2A22A1AB4M5, 232.50.100, EJA110E, DN50-PN16 is NOT a model). Look for manufacturer catalog codes. Otherwise empty string, ' /* v15.9 US-389 */
             . 'qty = quantity number, un = unit (e.g. NO, PCS, M, SET, عدد, دستگاه, متر). '
             . 'ALSO detect from the letterhead/header/stamp/signature of the document: '
             . 'co = the requesting customer company name exactly as written (e.g. "پتروشیمی صدف" or "NIOC"), empty string if not present. '
             . 'coEn = professional English translation/transliteration of that company name (e.g. "Pasargad Steel Industries Complex"), empty if co empty. '
             /* v14.4 (US-362 AC6/AC8): تشخیص کارشناس خرید از هر نوع فایل — فقط نقش خرید، نه امضاکنندگان مدیریتی */
             . 'buyer = full Persian name of the PURCHASING/PROCUREMENT contact person ONLY (کارشناس خرید / کارشناس بازرگانی / مسئول تدارکات) if such a role is explicitly indicated next to a name in the document (contact-for-quotation lines, procurement signature block). Do NOT return managing directors, technical approvers or other names. Empty string if no clear purchasing contact. '
             . 'buyerEn = correct English form of that person name using standard Iranian romanization with vowels (e.g. مراد → Morad, محمد → Mohammad), empty if buyer empty. '
             . 'buyerRole = the role text as written (e.g. "کارشناس خرید"), empty if none. '
             . 'inqno = the inquiry/RFQ reference number written on the document if present, else empty. '
             . 'Reply ONLY as JSON: {"co":"","coEn":"","buyer":"","buyerEn":"","buyerRole":"","inqno":"","rows":[{"tp":"","nm":"","spec":"","brand":"","model":"","qty":1,"un":""}]}';
        out_json(llm_call($cfg, $sys, 'Extract all items from this RFQ document.', $b64, $mime, 6000));
        break;


    /* v25.9: استخراج اقلام از متن پیوست DOCX/XLSX/CSV/TXT درخواست */
    case 'ocr_text':
        $text = trim($in['text'] ?? '');
        $sourceName = trim($in['sourceName'] ?? '');
        if ($text === '' || mb_strlen($text) > 24000) { echo json_encode(['ok' => false, 'error' => 'متن پیوست نامعتبر است (حداکثر ۲۴۰۰۰ کاراکتر)']); exit; }
        $sys = 'You are an OCR + extraction engine for industrial RFQ documents in Persian or English. '
             . 'The user gives plain text extracted from an attachment (DOCX, XLSX, CSV or TXT). Extract ALL actual procurement line items; ignore decorative headers, signatures, page numbers and empty rows. '
             . 'For each item return tp = equipment type, nm = concise catalog title, spec = complete technical specification exactly as present, brand only if explicitly present, model only if explicitly present, qty as number and un as unit. '
             . 'Also detect requesting company co, professional English company form coEn only if co exists, purchasing contact buyer/buyerEn/buyerRole only if explicitly identified, and inquiry reference inqno. '
             . 'Never invent values. Reply ONLY valid JSON: '
             . '{"co":"","coEn":"","buyer":"","buyerEn":"","buyerRole":"","inqno":"","rows":[{"tp":"","nm":"","spec":"","brand":"","model":"","qty":1,"un":""}]}'
             . ' Source file name: ' . $sourceName;
        out_json(llm_call($cfg, $sys, $text, null, null, 6000));
        break;

    /* v13.9 (US-345): بررسی و پیشنهاد متن نهایی قرارداد */
    case 'contract':
        $text = trim($in['text'] ?? '');
        $ckind = ($in['kind'] ?? '') === 'buy' ? 'خرید (شرکت ما خریدار است)' : 'فروش (شرکت ما فروشنده است)';
        if ($text === '' || mb_strlen($text) > 6000) { echo json_encode(['ok' => false, 'error' => 'متن نامعتبر (حداکثر ۶۰۰۰ کاراکتر)']); exit; }
        $sys = 'You are a senior Iranian commercial-contracts legal expert for an industrial equipment supplier (oil & gas). '
             . 'The user gives a draft contract text or special terms for a ' . $ckind . ' contract of شرکت پیشرو تجهیز فرتاک. '
             . 'Analyze in Persian: risks = آرایه ۲ تا ۵ ریسک/بند مبهم به ضرر شرکت (هرکدام یک جمله), '
             . 'final = متن نهایی پیشنهادی کامل و اصلاح‌شده قرارداد به فارسی رسمی-حقوقی (با شماره ماده‌ها). '
             . 'Do NOT invent facts (prices/dates) not present. Reply ONLY as JSON: {"risks":["..."],"final":"..."}';
        out_json(llm_call($cfg, $sys, $text, null, null, 6000));
        break;

    /* v14.4 (US-379): اکشن اختصاصی نامه — متن خالص فارسی، بدون Markdown/JSON دورریز */
    case 'letter':
        $prompt = trim($in['prompt'] ?? '');
        $toName = trim($in['to_name'] ?? '');
        $toRole = trim($in['to_role'] ?? '');
        $toCo = trim($in['to_co'] ?? '');
        $lkind = trim($in['kind'] ?? 'letter');
        $tone = trim($in['tone'] ?? 'formal');
        if ($prompt === '' || mb_strlen($prompt) > 2500) { echo json_encode(['ok' => false, 'error' => 'متن خواسته نامعتبر (حداکثر ۲۵۰۰ کاراکتر)']); exit; }
        $sys = 'You are a senior Persian business correspondence secretary for شرکت پیشرو تجهیز فرتاک (Pishro Tajhiz Fartak Co., oil & gas industrial supplier, Iran). '
             . 'Write the BODY paragraphs of a formal Persian business letter (3-5 paragraphs). '
             . 'Recipient: name=' . $toName . ' role=' . $toRole . ' company=' . $toCo . '. kind=' . $lkind . '. tone=' . $tone . '. '
             . 'STRICT OUTPUT RULES: body must be PLAIN Persian prose only — absolutely NO markdown symbols (no **, no ##, no bullets with * or -), no code fences, no English explanations, no placeholders like [X]. '
             . 'Do NOT include بسمه تعالی, letter number, date, salutation line or signature — only the main body paragraphs (the app adds those). '
             . 'Reply ONLY as JSON: {"subject":"موضوع کوتاه","body":"متن بدنه نامه"}';
        out_json(llm_call($cfg, $sys, $prompt, null, null, 2500));
        break;

    case 'summarize':
        $text = trim($in['text'] ?? '');
        if ($text === '' || mb_strlen($text) > 4000) { echo json_encode(['ok' => false, 'error' => 'متن نامعتبر']); exit; }
        $sys = 'You are a procurement analyst for an Iranian industrial supplier (oil & gas equipment). '
             . 'Given RFQ details (Persian/English), write a concise Persian summary useful for sourcing: '
             . 'sum = خلاصه ۲-۴ جمله‌ای موضوع درخواست (فارسی روان), scope = حوزه فنی (مثل پایپینگ/ابزار دقیق/برق/شیرآلات), '
             . 'hints = نکات مفید برای تامین (استانداردهای کلیدی، متریال، نکته خاص) در یک خط. '
             . 'Do NOT invent information not present. Reply ONLY as JSON: {"sum":"...","scope":"...","hints":"..."}';
        out_json(llm_call($cfg, $sys, $text, null, null, 2500));
        break;

    case 'techcase':
        $text = trim($in['text'] ?? '');
        if ($text === '' || mb_strlen($text) > 14000) { echo json_encode(['ok' => false, 'error' => 'متن پرونده فنی نامعتبر است']); exit; }
        $sys = 'You are a senior technical-procurement analyst for an Iranian industrial supplier in oil, gas and petrochemical business. '
             . 'This is STAGE 1 ONLY of an AI Technical Assistant. You MUST analyze the request bundle and return a structured Persian result. '
             . 'Strict rules: '
             . '1) do NOT perform engineering calculations, '
             . '2) do NOT invent missing values, '
             . '3) clearly separate known facts from missing facts, '
             . '4) if critical information is absent, mark readiness as need_more_data, '
             . '5) focus on Persian technical summary + procurement guidance only. '
             . 'Return ONLY JSON in this schema: '
             . '{'
             . '"scope":"حوزه فنی اصلی پرونده",'
             . '"equipment":{' 
             . '"type":"نوع تجهیز یا خانواده اصلی",'
             . '"application":"کاربری/اپلیکیشن احتمالی بر اساس متن",'
             . '"serviceContext":"کانتکست سرویس/محل استفاده احتمالی",'
             . '"standards":["...", "..."]'
             . '},'
             . '"keyData":[{"k":"کلید","v":"مقدار"}],'
             . '"missing":["فهرست ابهام‌ها و داده‌های ناقص"],'
             . '"criticalMissing":["فقط داده‌های حیاتی که نبودشان باید Proposal را متوقف کند"],'
             . '"contradictions":["موارد متناقض احتمالی"],'
             . '"supply":{' 
             . '"brands":["برندهای مناسب احتمالی"],'
             . '"manufacturers":["سازندگان مناسب احتمالی"],'
             . '"alternatives":["آلترناتیوهای قابل بررسی"],'
             . '"rfqNotes":["نکات مهم خرید/تامین و کنترل RFQ"]'
             . '},'
             . '"summaryFa":"خلاصه فنی فارسی ۳ تا ۶ جمله‌ای",'
             . '"readiness":"ready یا need_more_data"'
             . '}';
        out_json(llm_call($cfg, $sys, $text, null, null, 3500));
        break;

    case 'techproposal':
        $text = trim($in['text'] ?? '');
        if ($text === '' || mb_strlen($text) > 9000) { echo json_encode(['ok' => false, 'error' => 'متن proposal payload نامعتبر است']); exit; }
        $sys = 'You are a senior process and technical-proposal writer for an industrial equipment supplier. '
             . 'You are given a reviewed technical case summary plus deterministic calculation outputs already produced elsewhere. '
             . 'STRICT RULES: '
             . '1) Do NOT perform engineering calculations. '
             . '2) Do NOT invent missing numbers, standards, or vendor model codes. '
             . '3) Write in professional business English suitable for a formal Technical Proposal. '
             . '4) Treat calculation results as already provided; only describe their engineering meaning in words. '
             . '5) If something is incomplete, phrase it as subject to confirmation or further review. '
             . 'Return ONLY JSON with this schema: '
             . '{'
             . '"executiveSummary":"2-4 formal English sentences",'
             . '"designBasis":"formal English design-basis paragraph",'
             . '"equipmentSelectionLogic":"formal English selection-logic paragraph",'
             . '"recommendedModel":"formal English recommendation paragraph without inventing exact model if not present",'
             . '"deviations":"formal English deviations / assumptions-to-be-confirmed paragraph",'
             . '"conclusion":"formal English concluding paragraph"'
             . '}';
        out_json(llm_call($cfg, $sys, $text, null, null, 3200));
        break;

    case 'leadfinder':
        $text = trim($in['text'] ?? '');
        if ($text === '' || mb_strlen($text) > 12000) { echo json_encode(['ok' => false, 'error' => 'متن lead finder نامعتبر است']); exit; }
        $sys = 'You are a market-intelligence assistant for an Iranian industrial equipment supplier. '
             . 'The input contains target filters and public evidence snippets from approved source families. '
             . 'STRICT RULES: '
             . '1) never invent companies, roles, dates, or projects, '
             . '2) only use information explicitly present in the evidence snippets, '
             . '3) weak evidence should remain cautious, '
             . '4) do not auto-merge or auto-register anything, '
             . '5) return concise Persian rationale but structured fields in plain strings. '
             . 'Return ONLY JSON with this schema: '
             . '{"leads":[{"company":"company name","contact":"contact person","tel":"telephone/mobile","industry":"industry if explicit","prob":80,"whyRelevant":"Persian rationale"}],"candidates":['
             . '{'
             . '"company":"company name",'
             . '"role":"owner/operator/EPC/buyer/consultant/etc.",'
             . '"industry":"industry if explicit",'
             . '"activityDate":"YYYY-MM-DD if explicit else empty",'
             . '"whyRelevant":"Persian short explanation why this could be a valuable lead",'
             . '"recommendedAction":"save_as_lead or review or later",'
             . '"evidence":['
             . '{"title":"source title","url":"source url if present","quote":"short evidence snippet","trust":"T1 or T2 or T3","familyLabel":"source family label"}'
             . ']'
             . '}'
             . ']'
             . '}';
        out_json(llm_call($cfg, $sys, $text, null, null, 3200));
        break;

    default:
        echo json_encode(['ok' => false, 'error' => 'action نامعتبر']);
}
