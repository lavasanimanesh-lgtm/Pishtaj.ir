<?php
/** CLI-only outbox worker. See BOT-SETUP-GUIDE.md. Never an HTTP send endpoint. */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    header('Content-Type: application/json; charset=utf-8');
    echo '{"ok":false,"error":"cli_only"}';
    exit;
}
require_once __DIR__ . '/rfq-notify-lib.php';
$args = array_slice($argv ?? [], 1);
$allowed = ['--status', '--retry-failed', '--retry-uncertain', '--confirm-checked-group'];
foreach ($args as $arg) {
    if (!in_array($arg, $allowed, true)) { fwrite(STDERR, "Unknown option\n"); exit(2); }
}
if (in_array('--retry-uncertain', $args, true) && !in_array('--confirm-checked-group', $args, true)) {
    fwrite(STDERR, "Check the Telegram group first. Retry can duplicate an already delivered message. Add --confirm-checked-group only after checking.\n");
    exit(2);
}
try {
    $dir = ptf_rfq_notify_dir();
    if (in_array('--retry-failed', $args, true) || in_array('--retry-uncertain', $args, true)) {
        ptf_rfq_notify_store($dir, function (&$state) use ($args) {
            foreach ($state['jobs'] as &$row) {
                $retry = (($row['status'] ?? '') === 'failed' && in_array('--retry-failed', $args, true))
                    || (($row['status'] ?? '') === 'uncertain' && in_array('--retry-uncertain', $args, true));
                if ($retry) { $row['status'] = 'pending'; $row['attempts'] = 0; $row['nextAttemptAt'] = 0; unset($row['error']); }
            } unset($row);
        });
    }
    $sent = 0;
    /* At most 18 per minute, below Telegram's group rate. Only CLI sleeps;
       the ordinary post-response worker attempts one due event without waiting. */
    if (!in_array('--status', $args, true) && ptf_rfq_notify_enabled()) {
        $until = microtime(true) + 55;
        /* v34.39.63 (BOT-MSG-P2-8): سطل توکن تا ۵ پیام burst می‌دهد؛ هر فراخوانی چند
           پیام را خالی می‌کند و نرخ پایدار همان ۲۰ در دقیقه می‌ماند. */
        for ($n = 0; $n < 18 && microtime(true) < $until; $n++) {
            $result = ptf_rfq_notify_flush($dir, 5);
            $sent += (int)($result['sent'] ?? 0);
            if (!empty($result['error']) || !empty($result['busy'])) break;
            $counts = ptf_rfq_notify_counts($dir);
            if (!$counts['pending']) break;
            /* Do not sit on a long API backoff. A later cron invocation handles it. */
            if (!empty($result['attempted']) && empty($result['sent'])) break;
            if (microtime(true) + 3 >= $until) break;
            sleep(3);
        }
    }
    /* v34.39.63 (BOT-MSG-P2-16): کانال و مسیر فایل کانفیگ هم گزارش می‌شود تا «کدام
       کانفیگ اجرا می‌شود» و «چرا خاموش است» بدون حدس معلوم باشد. */
    $channel = ptf_rfq_notify_channel();
    echo json_encode(['ok'=>true, 'enabled'=>ptf_rfq_notify_enabled(), 'sentThisRun'=>$sent,
        'channel'=>$channel ? $channel['app'] : '', 'configPath'=>ptf_rfq_notify_cfg_path(),
        'configIssues'=>array_merge((ptf_rfq_notify_config_issue() !== '' ? [ptf_rfq_notify_config_issue()] : []),
            (ptf_rfq_notify_channel()['warning'] ?? '') !== '' ? [ptf_rfq_notify_channel()['warning']] : [],
            ptf_rfq_notify_cfg_duplicates() ? ['چند فایل bot-config.php موجود است: ' . implode('، ', ptf_rfq_notify_cfg_duplicates())] : []),
        'outbox'=>ptf_rfq_notify_counts($dir)], JSON_UNESCAPED_UNICODE) . "\n";
} catch (Throwable $e) {
    fwrite(STDERR, "RFQ notification outbox unavailable; check server storage/logs.\n");
    exit(1);
}
