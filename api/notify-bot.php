<?php
/* =====================================================================
   PTF CRM — notify-bot.php — v13.5 — US-333
   ارسال اعلان به بات تلگرام و/یا بله شرکت
   کانفیگ: bot-config.php خارج از public_html (مثل sms-config.php)
   اکشن‌ها:
     ?action=status → بررسی کانفیگ و اتصال
     ?action=send   → POST {text} → ارسال به همه کانال‌های فعال
   ===================================================================== */
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

function bot_cfg() {
    $paths = [
        dirname(__DIR__, 2) . '/bot-config.php',
        dirname(__DIR__, 3) . '/bot-config.php',
        dirname(__DIR__) . '/bot-config.php', // fallback اضطراری
        __DIR__ . '/bot-config.php', // fallback داخل پوشه api
    ];
    $fa = ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹','٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
    $en = ['0','1','2','3','4','5','6','7','8','9','0','1','2','3','4','5','6','7','8','9'];
    foreach ($paths as $p) {
        if (file_exists($p)) {
            $c = include $p;
            if (is_array($c)) {
                foreach (['telegram_token', 'telegram_chat_id', 'bale_token', 'bale_chat_id'] as $k) {
                    if (isset($c[$k]) && is_string($c[$k])) {
                        $c[$k] = trim(str_replace($fa, $en, $c[$k]));
                    }
                }
                return $c;
            }
        }
    }
    return null;
}

/* فقط از خود دامنه (همان الگوی امنیتی storage.php) — با پشتیبانی پورت‌های غیرستاندارد */
$ref = $_SERVER['HTTP_ORIGIN'] ?? $_SERVER['HTTP_REFERER'] ?? '';
$host = $_SERVER['HTTP_HOST'] ?? '';
if ($ref && $host) {
    $refHost = parse_url($ref, PHP_URL_HOST);
    $hostOnly = preg_replace('/:\d+$/', '', $host);
    if ($refHost && strcasecmp((string)$refHost, (string)$hostOnly) !== 0) {
        http_response_code(403);
        echo json_encode(['ok' => false, 'error' => 'Cross-origin blocked']);
        exit;
    }
}

$cfg = bot_cfg();
$action = $_GET['action'] ?? '';

if (!$cfg) {
    echo json_encode(['ok' => false, 'error' => 'bot-config.php یافت نشد — طبق BOT-SETUP-GUIDE.md بسازید و خارج از public_html آپلود کنید'], JSON_UNESCAPED_UNICODE);
    exit;
}

/* rate limit ساده: ۳۰ پیام در ساعت */
$rlf = sys_get_temp_dir() . '/ptf_bot_rl.json';
$rl = file_exists($rlf) ? (json_decode(file_get_contents($rlf), true) ?: ['n' => 0, 't' => time()]) : ['n' => 0, 't' => time()];
if (time() - $rl['t'] > 3600) $rl = ['n' => 0, 't' => time()];

function bot_post($url, $payload) {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true, CURLOPT_TIMEOUT => 12,
        CURLOPT_CONNECTTIMEOUT => 6,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE),
    ]);
    $res = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);
    return ['code' => $code, 'body' => $res, 'err' => $err];
}

switch ($action) {
    case 'status':
        $chans = [];
        if (!empty($cfg['telegram_token']) && !empty($cfg['telegram_chat_id'])) $chans[] = 'تلگرام';
        if (!empty($cfg['bale_token']) && !empty($cfg['bale_chat_id'])) $chans[] = 'بله';
        if (!$chans) { echo json_encode(['ok' => false, 'error' => 'هیچ کانالی در bot-config.php کامل نیست'], JSON_UNESCAPED_UNICODE); break; }
        echo json_encode(['ok' => true, 'info' => 'کانال‌های فعال: ' . implode('، ', $chans)], JSON_UNESCAPED_UNICODE);
        break;

    /* v14.1 (US-355): جفت‌سازی چت شخصی کاربر — کاربر کد یکتا را به بات می‌فرستد،
       اینجا در getUpdates دنبالش می‌گردیم و chat_id خصوصی‌اش را برمی‌گردانیم */
    case 'pair':
        $code = preg_replace('/[^A-Za-z0-9\-]/', '', $_GET['code'] ?? '');
        if (strlen($code) < 6) { echo json_encode(['ok' => false, 'error' => 'کد نامعتبر']); break; }
        $found = null;
        if (!empty($cfg['telegram_token'])) {
            $r = bot_post('https://api.telegram.org/bot' . $cfg['telegram_token'] . '/getUpdates', ['limit' => 100]);
            $j = json_decode($r['body'] ?: '', true);
            foreach (($j['result'] ?? []) as $u) {
                $msg = $u['message'] ?? null;
                if ($msg && isset($msg['text']) && strpos($msg['text'], $code) !== false && ($msg['chat']['type'] ?? '') === 'private') {
                    $found = ['chat_id' => (string)$msg['chat']['id'], 'name' => trim(($msg['chat']['first_name'] ?? '') . ' ' . ($msg['chat']['last_name'] ?? '')), 'app' => 'telegram'];
                }
            }
        }
        if (!$found && !empty($cfg['bale_token'])) {
            $r2 = bot_post('https://tapi.bale.ai/bot' . $cfg['bale_token'] . '/getUpdates', ['limit' => 100]);
            $j2 = json_decode($r2['body'] ?: '', true);
            foreach (($j2['result'] ?? []) as $u2) {
                $msg2 = $u2['message'] ?? null;
                if ($msg2 && isset($msg2['text']) && strpos($msg2['text'], $code) !== false && ($msg2['chat']['type'] ?? 'private') === 'private') {
                    $found = ['chat_id' => (string)$msg2['chat']['id'], 'name' => trim($msg2['chat']['first_name'] ?? ''), 'app' => 'bale'];
                }
            }
        }
        echo $found ? json_encode(['ok' => true] + $found, JSON_UNESCAPED_UNICODE)
                    : json_encode(['ok' => false, 'error' => 'کد پیدا نشد — مطمئن شوید کد را برای بات فرستاده‌اید و دوباره بزنید'], JSON_UNESCAPED_UNICODE);
        break;

    case 'send':
        if (++$rl['n'] > 30) { echo json_encode(['ok' => false, 'error' => 'سقف ۳۰ پیام در ساعت'], JSON_UNESCAPED_UNICODE); break; }
        file_put_contents($rlf, json_encode($rl));
        $in = json_decode(file_get_contents('php://input'), true) ?: [];
        $text = trim(mb_substr((string)($in['text'] ?? ''), 0, 3500));
        if ($text === '') { echo json_encode(['ok' => false, 'error' => 'متن خالی']); break; }
        $sent = [];
        $errs = [];
        /* v14.1 (US-355): مقصد شخصی — فقط به چت خصوصی همان کاربر، نه گروه */
        $pChat = preg_replace('/[^\d\-]/', '', (string)($in['chat_id'] ?? ''));
        $pApp = $in['app'] ?? '';
        if ($pChat !== '') {
            if ($pApp !== 'bale' && !empty($cfg['telegram_token'])) {
                $rp = bot_post('https://api.telegram.org/bot' . $cfg['telegram_token'] . '/sendMessage', ['chat_id' => $pChat, 'text' => $text]);
                if ($rp['code'] >= 200 && $rp['code'] < 300) $sent[] = 'telegram-personal';
                else $errs[] = 'tg-p:' . $rp['code'] . (!empty($rp['err']) ? ' (' . $rp['err'] . ')' : '');
            }
            if ($pApp === 'bale' && !empty($cfg['bale_token'])) {
                $rp2 = bot_post('https://tapi.bale.ai/bot' . $cfg['bale_token'] . '/sendMessage', ['chat_id' => $pChat, 'text' => $text]);
                if ($rp2['code'] >= 200 && $rp2['code'] < 300) $sent[] = 'bale-personal';
                else $errs[] = 'bale-p:' . $rp2['code'] . (!empty($rp2['err']) ? ' (' . $rp2['err'] . ')' : '');
            }
            echo json_encode(['ok' => count($sent) > 0, 'sent' => $sent, 'errors' => $errs], JSON_UNESCAPED_UNICODE);
            break;
        }
        /* تلگرام: Bot API رسمی */
        if (!empty($cfg['telegram_token']) && !empty($cfg['telegram_chat_id'])) {
            $r = bot_post('https://api.telegram.org/bot' . $cfg['telegram_token'] . '/sendMessage',
                ['chat_id' => $cfg['telegram_chat_id'], 'text' => $text]);
            if ($r['code'] >= 200 && $r['code'] < 300) $sent[] = 'telegram';
            else $errs[] = 'telegram:' . $r['code'] . (!empty($r['err']) ? ' (' . $r['err'] . ')' : '');
        }
        /* بله: Bot API (سازگار با تلگرام — tapi.bale.ai) */
        if (!empty($cfg['bale_token']) && !empty($cfg['bale_chat_id'])) {
            $r = bot_post('https://tapi.bale.ai/bot' . $cfg['bale_token'] . '/sendMessage',
                ['chat_id' => $cfg['bale_chat_id'], 'text' => $text]);
            if ($r['code'] >= 200 && $r['code'] < 300) $sent[] = 'bale';
            else $errs[] = 'bale:' . $r['code'] . (!empty($r['err']) ? ' (' . $r['err'] . ')' : '');
        }
        echo json_encode(['ok' => count($sent) > 0, 'sent' => $sent, 'errors' => $errs], JSON_UNESCAPED_UNICODE);
        break;

    default:
        echo json_encode(['ok' => false, 'error' => 'action نامعتبر']);
}
