<?php
/**
 * PTF Chat — LLM Proxy (v34.7.68 — فاز ۴)
 * کلید API فقط سمت سرور است. سهمیهٔ توکن مجزا برای چت عمومی (مستقل از ai_quota.json).
 *
 * قابلیت‌ها:
 *  - سهمیهٔ روزانهٔ جدا (per-IP + سقف سراسری) — رایگان و کنترل‌شده.
 *  - RAG سبک از assets/data/search-index.json (۳ مقالهٔ مرتبط) + خروجی «کارت مقاله».
 *  - چندزبانه fa/en/ar.
 *  - استریم پاسخ (SSE) با fallback غیراستریمی در کلاینت.
 *  - ثبت تحلیلی نیت پرسش‌ها (بدون دادهٔ شخصی) برای بهبود دانش‌نامه.
 *  - Gemini (پیش‌فرض) و OpenAI-compatible.
 */
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

$ref = $_SERVER['HTTP_ORIGIN'] ?? $_SERVER['HTTP_REFERER'] ?? '';
$host = $_SERVER['HTTP_HOST'] ?? '';
if ($ref && $host && parse_url($ref, PHP_URL_HOST) !== $host) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'Cross-origin blocked']);
    exit;
}

$cfgFile = dirname(__DIR__, 2) . '/llm-config.php';
if (!file_exists($cfgFile)) { echo json_encode(['ok' => false, 'error' => 'LLM not configured']); exit; }
$cfg = include $cfgFile;

$in = json_decode(file_get_contents('php://input'), true) ?: [];
$q = trim((string)($in['q'] ?? ''));
$lang = preg_replace('/[^a-z-]/i', '', (string)($in['lang'] ?? 'fa'));
$stream = !empty($in['stream']);
if ($q === '' || mb_strlen($q) > 600) { echo json_encode(['ok' => false, 'error' => 'bad input']); exit; }

/* ---------- سهمیهٔ توکن عمومی (جدا از CRM) ---------- */
$dataDir = __DIR__ . '/../crm/data';
if (!is_dir($dataDir)) { @mkdir($dataDir, 0755, true); @file_put_contents($dataDir . '/.htaccess', "Deny from all\n"); }
$quotaFile = $dataDir . '/ptf_chat_public_quota.json';
$today = date('Y-m-d');
$quota = file_exists($quotaFile) ? (json_decode(@file_get_contents($quotaFile), true) ?: []) : [];
if (!is_array($quota)) $quota = [];
foreach ($quota as $k => $v) { if (substr((string)$k, -10) !== $today) unset($quota[$k]); }
$ip = $_SERVER['REMOTE_ADDR'] ?? 'x';
$ipKey = hash('sha256', $ip) . '|' . $today;
$globalKey = 'global|' . $today;
$ipUsed = (int)($quota[$ipKey] ?? 0);
$globalUsed = (int)($quota[$globalKey] ?? 0);
$IP_DAILY = 25; $GLOBAL_DAILY = 300;
if ($ipUsed >= $IP_DAILY) { echo json_encode(['ok' => false, 'error' => 'quota', 'message' => 'سهمیهٔ امروز چت هوشمند برای شما تمام شد؛ فردا دوباره امتحان کنید یا با 021-46087679 تماس بگیرید.']); exit; }
if ($globalUsed >= $GLOBAL_DAILY) { echo json_encode(['ok' => false, 'error' => 'quota', 'message' => 'سهمیهٔ امروز چت هوشمند تکمیل شد؛ لطفاً از فرم استعلام آنلاین استفاده کنید.']); exit; }
$quota[$ipKey] = $ipUsed + 1;
$quota[$globalKey] = $globalUsed + 1;
@file_put_contents($quotaFile, json_encode($quota, JSON_UNESCAPED_UNICODE), LOCK_EX);

/* ---------- RAG سبک ---------- */
function ptf_chat_kb_context($q, $max = 3) {
    $idxFile = dirname(__DIR__) . '/assets/data/search-index.json';
    if (!is_file($idxFile)) return [];
    $idx = json_decode(@file_get_contents($idxFile), true);
    if (!is_array($idx)) return [];
    $tokens = preg_split('/[\s،,؛;:.‌\-–—()\[\]\/]+/u', mb_strtolower($q), -1, PREG_SPLIT_NO_EMPTY);
    $scored = [];
    foreach ($idx as $it) {
        $title = mb_strtolower((string)($it['t'] ?? ''));
        $desc  = mb_strtolower((string)($it['d'] ?? ''));
        $hay   = $title . ' ' . $desc;
        if (trim($hay) === '') continue;
        $score = 0;
        foreach ($tokens as $tk) {
            $tk = trim($tk);
            if (mb_strlen($tk) < 3) continue;
            if (mb_strpos($title, $tk) !== false) $score += 3;
            elseif (mb_strpos($desc, $tk) !== false) $score += 1;
        }
        if ($score > 0) $scored[] = ['u' => (string)($it['u'] ?? ''), 't' => (string)($it['t'] ?? ''), 'd' => (string)($it['d'] ?? ''), 'score' => $score];
    }
    usort($scored, function ($a, $b) { return $b['score'] - $a['score']; });
    return array_slice($scored, 0, $max);
}

/* ---------- ثبت تحلیلی (نیت + زبان + زمان — بدون دادهٔ شخصی) ---------- */
function ptf_chat_log($dataDir, $intent, $lang, $q) {
    try {
        $f = $dataDir . '/ptf_chat_analytics.json';
        $a = file_exists($f) ? (json_decode(@file_get_contents($f), true) ?: []) : [];
        if (!is_array($a)) $a = [];
        $a[] = ['t' => date('c'), 'intent' => $intent, 'lang' => $lang, 'q' => mb_substr($q, 0, 120)];
        if (count($a) > 2000) $a = array_slice($a, -2000);
        @file_put_contents($f, json_encode($a, JSON_UNESCAPED_UNICODE), LOCK_EX);
    } catch (Throwable $e) {}
}

$kb = ptf_chat_kb_context($q);
$kbText = '';
$cards = [];
foreach ($kb as $k) {
    if ($k['u'] === '') continue;
    $kbText .= "\n- «{$k['t']}» — {$k['d']} (https://pishtaj.ir{$k['u']})";
    $cards[] = ['type' => 'article', 'title' => $k['t'], 'snippet' => mb_substr($k['d'], 0, 160), 'url' => 'https://pishtaj.ir' . $k['u']];
}
$intent = (preg_match('/PTF-(RFQ|VEN)-[A-Z0-9]{5}-[A-Z0-9]{5}/i', $q) ? 'status' : (count($cards) ? 'kb' : 'chat'));
ptf_chat_log($dataDir, $intent, $lang, $q);

$LANG_NAME = ['fa' => 'فارسی', 'en' => 'English', 'ar' => 'العربية', 'ar-SA' => 'العربية', 'ar-IQ' => 'العربية', 'ar-AE' => 'العربية'];
$langName = $LANG_NAME[$lang] ?? 'فارسی';
$system = "تو دستیار هوشمند شرکت «پیشرو تجهیز فرتاک» (Pishro Tajhiz Fartak / PTF) هستی؛ تأمین‌کنندهٔ تخصصی تجهیزات صنعتی (پایپینگ، شیرآلات، ابزار دقیق، برق صنعتی، پمپ و کمپرسور) برای صنایع نفت، گاز، پتروشیمی، نیروگاه و فولاد در ایران و خاورمیانه. به زبان {$langName} و مختصر (حداکثر ۳ بند کوتاه) پاسخ بده. تلفن: 021-46087679. برای قیمت همیشه به ثبت استعلام در https://pishtaj.ir/rfq ارجاع بده و هرگز قیمت عددی نگو. اگر از دانش فنی زیر استفاده کردی، لینک مقالهٔ مرتبط را هم بیاور. اگر مطمئن نیستی، صادقانه بگو و به کارشناس ارجاع بده.\nدانش فنی موجود (فقط در صورت ارتباط):{$kbText}";

$provider = strtolower((string)($cfg['provider'] ?? 'gemini'));
$apiKey = trim((string)($cfg['key'] ?? ''));
$model = (string)($cfg['model'] ?? ($provider === 'gemini' ? 'gemini-2.5-flash' : 'gpt-4o-mini'));
$maxTok = 320;
$cta = [['label' => 'ثبت استعلام', 'url' => 'https://pishtaj.ir/rfq']];

$finalize = function ($answer) use ($cards, $cta) {
    $answer = trim(preg_replace('/^```(?:json)?\s*/i', '', (string)$answer));
    $answer = preg_replace('/```$/', '', $answer);
    echo json_encode(['ok' => (bool)$answer, 'answer' => $answer, 'cards' => $cards, 'cta' => $cta], JSON_UNESCAPED_UNICODE);
};

/* ============ مسیر استریم (SSE) ============ */
if ($stream) {
    header('Content-Type: text/event-stream; charset=utf-8');
    header('Cache-Control: no-cache');
    header('X-Accel-Buffering: no');
    if (function_exists('ob_end_clean')) { while (ob_get_level() > 0) { @ob_end_clean(); } }

    if ($provider === 'gemini') {
        $base = rtrim((string)($cfg['gemini_base'] ?? 'https://generativelanguage.googleapis.com/v1beta'), '/');
        $url = $base . '/models/' . rawurlencode($model) . ':streamGenerateContent?alt=sse&key=' . rawurlencode($apiKey);
        $payload = json_encode(['contents' => [['parts' => [['text' => $system . "\n\n" . $q]]]], 'generationConfig' => ['temperature' => 0.4, 'maxOutputTokens' => $maxTok]], JSON_UNESCAPED_UNICODE);
        $headers = ['Content-Type: application/json', 'User-Agent: PTF-Public-Chat/34.7'];
    } else {
        $base = rtrim((string)($cfg['base'] ?? 'https://api.openai.com/v1'), '/');
        $url = $base . '/chat/completions';
        $payload = json_encode(['model' => $model, 'stream' => true, 'messages' => [['role' => 'system', 'content' => $system], ['role' => 'user', 'content' => $q]], 'temperature' => 0.4, 'max_tokens' => $maxTok], JSON_UNESCAPED_UNICODE);
        $headers = ['Content-Type: application/json', 'Authorization: Bearer ' . $apiKey, 'User-Agent: PTF-Public-Chat/34.7'];
    }

    $ch = curl_init($url);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => false, CURLOPT_POST => true, CURLOPT_POSTFIELDS => $payload, CURLOPT_TIMEOUT => 25, CURLOPT_HTTPHEADER => $headers]);
    if (!empty($cfg['tls_verify'])) curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    if (!empty($cfg['ip_resolve']) && in_array($cfg['ip_resolve'], ['v4', 'v6'], true)) curl_setopt($ch, CURLOPT_IPRESOLVE, $cfg['ip_resolve'] === 'v6' ? CURL_IPRESOLVE_V6 : CURL_IPRESOLVE_V4);

    $buffer = '';
    $sentFinal = false;
    curl_setopt($ch, CURLOPT_WRITEFUNCTION, function ($c, $raw) use (&$buffer, $provider, &$sentFinal) {
        $buffer .= $raw;
        while (($pos = strpos($buffer, "\n\n")) !== false) {
            $block = substr($buffer, 0, $pos);
            $buffer = substr($buffer, $pos + 2);
            foreach (explode("\n", $block) as $line) {
                $line = trim($line);
                if (strpos($line, 'data: ') !== 0) continue;
                $d = substr($line, 6);
                if ($d === '[DONE]') { $sentFinal = true; echo "data: [DONE]\n\n"; flush(); continue; }
                $j = json_decode($d, true);
                if (!is_array($j)) continue;
                $t = '';
                if ($provider === 'gemini') { foreach (($j['candidates'][0]['content']['parts'] ?? []) as $p) if (isset($p['text'])) $t .= $p['text']; }
                else { $t = $j['choices'][0]['delta']['content'] ?? ''; }
                if ($t !== '') { echo 'data: ' . json_encode(['t' => $t], JSON_UNESCAPED_UNICODE) . "\n\n"; flush(); }
            }
        }
        return strlen($raw);
    });
    curl_exec($ch);
    curl_close($ch);
    if (!$sentFinal) {
        echo 'data: ' . json_encode(['d' => ['cards' => $cards, 'cta' => $cta]], JSON_UNESCAPED_UNICODE) . "\n\n";
        echo "data: [DONE]\n\n";
    }
    exit;
}

/* ============ مسیر عادی (غیراستریم) ============ */
if ($provider === 'gemini') {
    $base = rtrim((string)($cfg['gemini_base'] ?? 'https://generativelanguage.googleapis.com/v1beta'), '/');
    $url = $base . '/models/' . rawurlencode($model) . ':generateContent?key=' . rawurlencode($apiKey);
    $payload = json_encode(['contents' => [['parts' => [['text' => $system . "\n\n" . $q]]]], 'generationConfig' => ['temperature' => 0.4, 'maxOutputTokens' => $maxTok]], JSON_UNESCAPED_UNICODE);
    $headers = ['Content-Type: application/json', 'User-Agent: PTF-Public-Chat/34.7'];
} else {
    $base = rtrim((string)($cfg['base'] ?? 'https://api.openai.com/v1'), '/');
    $url = $base . '/chat/completions';
    $payload = json_encode(['model' => $model, 'messages' => [['role' => 'system', 'content' => $system], ['role' => 'user', 'content' => $q]], 'temperature' => 0.4, 'max_tokens' => $maxTok], JSON_UNESCAPED_UNICODE);
    $headers = ['Content-Type: application/json', 'Authorization: Bearer ' . $apiKey, 'User-Agent: PTF-Public-Chat/34.7'];
}

$ch = curl_init($url);
curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true, CURLOPT_POSTFIELDS => $payload, CURLOPT_TIMEOUT => 20, CURLOPT_HTTPHEADER => $headers]);
if (!empty($cfg['tls_verify'])) curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
if (!empty($cfg['ip_resolve']) && in_array($cfg['ip_resolve'], ['v4', 'v6'], true)) curl_setopt($ch, CURLOPT_IPRESOLVE, $cfg['ip_resolve'] === 'v6' ? CURL_IPRESOLVE_V6 : CURL_IPRESOLVE_V4);
$res = curl_exec($ch);
$code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($code !== 200 || !$res) { echo json_encode(['ok' => false, 'error' => 'upstream ' . $code]); exit; }
$data = json_decode($res, true);
$answer = '';
if ($provider === 'gemini') { foreach (($data['candidates'][0]['content']['parts'] ?? []) as $part) { if (isset($part['text'])) $answer .= $part['text']; } }
else { $answer = $data['choices'][0]['message']['content'] ?? ''; }
$finalize($answer);
