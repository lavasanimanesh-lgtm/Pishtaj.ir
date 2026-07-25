<?php
/**
 * PTF Chat — LLM Proxy (US-107 فاز ۲)
 * کلید API فقط اینجا (سمت سرور) نگهداری می‌شود و هرگز به مرورگر نمی‌رود.
 *
 * فعال‌سازی:
 *  1) فایل ../llm-config.php را خارج از webroot بسازید:
 *       <?php return ['provider'=>'openai','key'=>'sk-...','model'=>'gpt-4o-mini'];
 *  2) در assets/js/ptf-chat.js مقدار LLM.enabled را true کنید.
 */
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

$cfgFile = dirname(__DIR__, 2) . '/llm-config.php'; // خارج از webroot
if (!file_exists($cfgFile)) {
    echo json_encode(['ok' => false, 'error' => 'LLM not configured']);
    exit;
}
$cfg = include $cfgFile;

$in = json_decode(file_get_contents('php://input'), true);
$q = trim($in['q'] ?? '');
if ($q === '' || mb_strlen($q) > 600) {
    echo json_encode(['ok' => false, 'error' => 'bad input']);
    exit;
}

// Rate limit ساده: ۲۰ درخواست در ساعت به ازای IP
$rlFile = sys_get_temp_dir() . '/ptf_chat_rl_' . md5($_SERVER['REMOTE_ADDR'] ?? 'x');
$rl = file_exists($rlFile) ? json_decode(file_get_contents($rlFile), true) : ['n' => 0, 't' => time()];
if (time() - $rl['t'] > 3600) $rl = ['n' => 0, 't' => time()];
if (++$rl['n'] > 20) { echo json_encode(['ok' => false, 'error' => 'rate limit']); exit; }
file_put_contents($rlFile, json_encode($rl));

$system = 'تو منشی هوشمند شرکت «پیشرو تجهیز فرتاک» هستی؛ تامین‌کننده تجهیزات صنعتی (پایپینگ، شیرآلات، ابزار دقیق، برق صنعتی، پمپ) برای نفت و گاز، پتروشیمی، نیروگاه و فولاد در تهران. '
        . 'مودب، دقیق و مختصر به فارسی پاسخ بده. تلفن: 021-46087679. برای قیمت همیشه به ثبت استعلام در pishtaj.ir/rfq ارجاع بده. '
        . 'اگر مطمئن نیستی، صادقانه بگو و به کارشناس ارجاع بده. هرگز قیمت عددی نگو.';

$hist = [];
foreach (($in['h'] ?? []) as $m) {
    $hist[] = ['role' => ($m['w'] === 'u' ? 'user' : 'assistant'), 'content' => mb_substr($m['t'] ?? '', 0, 400)];
}

$payload = json_encode([
    'model' => $cfg['model'] ?? 'gpt-4o-mini',
    'messages' => array_merge([['role' => 'system', 'content' => $system]], $hist, [['role' => 'user', 'content' => $q]]),
    'max_tokens' => 400,
    'temperature' => 0.4
], JSON_UNESCAPED_UNICODE);

$endpoint = $cfg['endpoint'] ?? 'https://api.openai.com/v1/chat/completions';
$ch = curl_init($endpoint);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => $payload,
    CURLOPT_TIMEOUT => 15,
    CURLOPT_HTTPHEADER => [
        'Content-Type: application/json',
        'Authorization: Bearer ' . ($cfg['key'] ?? '')
    ]
]);
$res = curl_exec($ch);
$code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($code !== 200 || !$res) {
    echo json_encode(['ok' => false, 'error' => 'upstream ' . $code]);
    exit;
}
$data = json_decode($res, true);
$answer = $data['choices'][0]['message']['content'] ?? null;
echo json_encode(['ok' => (bool)$answer, 'answer' => $answer], JSON_UNESCAPED_UNICODE);
