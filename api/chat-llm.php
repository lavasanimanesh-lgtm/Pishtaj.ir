<?php
/**
 * PTF Chat — LLM Proxy (نسخهٔ ارتقایافته — v34.7.67)
 * کلید API فقط سمت سرور است. این فایل «سهمیهٔ توکن مجزا» برای چت عمومی سایت دارد و
 * به هیچ‌وجه سهمیهٔ هوش مصنوعی کاربران CRM (ai_quota.json) را مصرف نمی‌کند.
 *
 * قابلیت‌ها:
 *  - سهمیهٔ روزانهٔ جدا برای چت عمومی (per-IP + سقف سراسری) — رایگان و کنترل‌شده.
 *  - RAG سبک: بازیابی ۳ مقالهٔ مرتبط از assets/data/search-index.json و تزریق به مدل.
 *  - چندزبانه: فارسی / English / العربية (تشخیص از سمت کلاینت، lang=...).
 *  - پشتیبانی Gemini (پیش‌فرض) و OpenAI-compatible.
 *
 * وضعیت درخواست/سفارش (بدون توکن): در کلاینت (ptf-chat.js) از api/crm.php?action=track
 * خوانده می‌شود — مسیر قطعی و رایگان، بدون صدا زدن مدل.
 */
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

/* فقط از همان دامنه (جلوگیری از سوءاستفادهٔ خارجی). */
$ref = $_SERVER['HTTP_ORIGIN'] ?? $_SERVER['HTTP_REFERER'] ?? '';
$host = $_SERVER['HTTP_HOST'] ?? '';
if ($ref && $host && parse_url($ref, PHP_URL_HOST) !== $host) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'Cross-origin blocked']);
    exit;
}

$cfgFile = dirname(__DIR__, 2) . '/llm-config.php'; // خارج از webroot
if (!file_exists($cfgFile)) {
    echo json_encode(['ok' => false, 'error' => 'LLM not configured']);
    exit;
}
$cfg = include $cfgFile;

$in = json_decode(file_get_contents('php://input'), true) ?: [];
$q = trim((string)($in['q'] ?? ''));
$lang = preg_replace('/[^a-z-]/i', '', (string)($in['lang'] ?? 'fa'));
if ($q === '' || mb_strlen($q) > 600) {
    echo json_encode(['ok' => false, 'error' => 'bad input']);
    exit;
}

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
$IP_DAILY = 25;      // سهمیهٔ روزانهٔ هر بازدیدکنندهٔ چت عمومی
$GLOBAL_DAILY = 300; // سقف روزانهٔ کل چت عمومی (محافظ بودجهٔ رایگان)
if ($ipUsed >= $IP_DAILY) {
    echo json_encode(['ok' => false, 'error' => 'quota', 'message' => 'سهمیهٔ امروز چت هوشمند برای شما تمام شد؛ فردا دوباره امتحان کنید یا با 021-46087679 تماس بگیرید.']);
    exit;
}
if ($globalUsed >= $GLOBAL_DAILY) {
    echo json_encode(['ok' => false, 'error' => 'quota', 'message' => 'سهمیهٔ امروز چت هوشمند تکمیل شد؛ لطفاً از فرم استعلام آنلاین استفاده کنید.']);
    exit;
}
$quota[$ipKey] = $ipUsed + 1;
$quota[$globalKey] = $globalUsed + 1;
@file_put_contents($quotaFile, json_encode($quota, JSON_UNESCAPED_UNICODE), LOCK_EX);

/* ---------- RAG سبک: بازیابی مقالات مرتبط ---------- */
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
        if ($hay === ' ') continue;
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

$LANG_NAME = ['fa' => 'فارسی', 'en' => 'English', 'ar' => 'العربية', 'ar-SA' => 'العربية', 'ar-IQ' => 'العربية', 'ar-AE' => 'العربية'];
$langName = $LANG_NAME[$lang] ?? 'فارسی';
$kb = ptf_chat_kb_context($q);
$kbText = '';
foreach ($kb as $k) {
    if ($k['u'] === '') continue;
    $kbText .= "\n- «{$k['t']}» — {$k['d']} (https://pishtaj.ir{$k['u']})";
}
$system = "تو دستیار هوشمند شرکت «پیشرو تجهیز فرتاک» (Pishro Tajhiz Fartak / PTF) هستی؛ تأمین‌کنندهٔ تخصصی تجهیزات صنعتی (پایپینگ، شیرآلات، ابزار دقیق، برق صنعتی، پمپ و کمپرسور) برای صنایع نفت، گاز، پتروشیمی، نیروگاه و فولاد در ایران و خاورمیانه. به زبان {$langName} و مختصر (حداکثر ۳ بند کوتاه) پاسخ بده. تلفن: 021-46087679. برای قیمت همیشه به ثبت استعلام در https://pishtaj.ir/rfq ارجاع بده و هرگز قیمت عددی نگو. اگر از دانش فنی زیر استفاده کردی، لینک مقالهٔ مرتبط را هم بیاور. اگر مطمئن نیستی، صادقانه بگو و به کارشناس ارجاع بده.\nدانش فنی موجود (فقط در صورت ارتباط):{$kbText}";

$provider = strtolower((string)($cfg['provider'] ?? 'gemini'));
$apiKey = trim((string)($cfg['key'] ?? ''));
$model = (string)($cfg['model'] ?? ($provider === 'gemini' ? 'gemini-2.5-flash' : 'gpt-4o-mini'));
$maxTok = 320;

$ch = null;
if ($provider === 'gemini') {
    $base = rtrim((string)($cfg['gemini_base'] ?? 'https://generativelanguage.googleapis.com/v1beta'), '/');
    $url = $base . '/models/' . rawurlencode($model) . ':generateContent?key=' . rawurlencode($apiKey);
    $payload = json_encode([
        'contents' => [['parts' => [['text' => $system . "\n\n" . $q]]]],
        'generationConfig' => ['temperature' => 0.4, 'maxOutputTokens' => $maxTok]
    ], JSON_UNESCAPED_UNICODE);
    $headers = ['Content-Type: application/json', 'User-Agent: PTF-Public-Chat/34.7'];
} else {
    $base = rtrim((string)($cfg['base'] ?? 'https://api.openai.com/v1'), '/');
    $url = $base . '/chat/completions';
    $payload = json_encode([
        'model' => $model,
        'messages' => [['role' => 'system', 'content' => $system], ['role' => 'user', 'content' => $q]],
        'temperature' => 0.4,
        'max_tokens' => $maxTok
    ], JSON_UNESCAPED_UNICODE);
    $headers = ['Content-Type: application/json', 'Authorization: Bearer ' . $apiKey, 'User-Agent: PTF-Public-Chat/34.7'];
}

$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => $payload,
    CURLOPT_TIMEOUT => 20,
    CURLOPT_HTTPHEADER => $headers
]);
if (!empty($cfg['tls_verify'])) curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
if (!empty($cfg['ip_resolve']) && in_array($cfg['ip_resolve'], ['v4', 'v6'], true)) curl_setopt($ch, CURLOPT_IPRESOLVE, $cfg['ip_resolve'] === 'v6' ? CURL_IPRESOLVE_V6 : CURL_IPRESOLVE_V4);
$res = curl_exec($ch);
$code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($code !== 200 || !$res) {
    echo json_encode(['ok' => false, 'error' => 'upstream ' . $code]);
    exit;
}
$data = json_decode($res, true);
$answer = '';
if ($provider === 'gemini') {
    foreach (($data['candidates'][0]['content']['parts'] ?? []) as $part) { if (isset($part['text'])) $answer .= $part['text']; }
} else {
    $answer = $data['choices'][0]['message']['content'] ?? '';
}
$answer = trim(preg_replace('/^```(?:json)?\s*/i', '', $answer));
$answer = preg_replace('/```$/', '', $answer);
echo json_encode(['ok' => (bool)$answer, 'answer' => $answer], JSON_UNESCAPED_UNICODE);
