<?php
/**
 * RFQ Telegram notifications — server-only, after authoritative commit.
 * No browser notify hook, token in JS, or new sync collection. The private outbox
 * has its own short lock; Telegram I/O never holds a business/meta lock.
 */
declare(strict_types=1);

function ptf_rfq_notify_text($value, int $limit = 240): string {
    if (!is_scalar($value)) return '';
    $s = preg_replace('/[\x00-\x1f\x7f\x{202a}-\x{202e}\x{2066}-\x{2069}]+/u', ' ', (string)$value);
    $s = trim((string)preg_replace('/\s+/u', ' ', (string)$s));
    /* Unicode-safe even without mbstring; never truncate a Persian code point. */
    if (preg_match('/^.{0,' . $limit . '}/us', $s, $m)) return $m[0];
    return '';
}
function ptf_rfq_notify_first(array $row, array $keys, int $limit = 240): string {
    foreach ($keys as $key) {
        $text = ptf_rfq_notify_text($row[$key] ?? '', $limit);
        if ($text !== '') return $text;
    }
    return '';
}
function ptf_rfq_notify_cfg(): ?array {
    static $loaded = false, $cfg = null;
    if ($loaded) return $cfg;
    $loaded = true;
    $paths = [dirname(__DIR__, 2) . '/bot-config.php', dirname(__DIR__, 3) . '/bot-config.php',
        dirname(__DIR__) . '/bot-config.php', __DIR__ . '/bot-config.php'];
    foreach ($paths as $path) {
        if (!is_file($path)) continue;
        $value = include $path;
        if (!is_array($value)) continue;
        $cfg = $value;
        $fa = ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹','٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
        $en = ['0','1','2','3','4','5','6','7','8','9','0','1','2','3','4','5','6','7','8','9'];
        foreach (['telegram_token', 'telegram_chat_id'] as $key) {
            $v = is_scalar($cfg[$key] ?? null) ? (string)$cfg[$key] : '';
            $cfg[$key] = (string)preg_replace('/\s+/u', '', str_replace($fa, $en, $v));
        }
        return $cfg;
    }
    return null;
}
function ptf_rfq_notify_enabled(): bool {
    $cfg = ptf_rfq_notify_cfg();
    if (!$cfg || empty($cfg['telegram_token']) || empty($cfg['telegram_chat_id'])) return false;
    /* A private positive chat id must not receive company/group RFQ events. */
    if (!preg_match('/^(?:-\d{1,20}|@[A-Za-z0-9_]{5,64})$/', (string)$cfg['telegram_chat_id'])) return false;
    return filter_var($cfg['rfq_notifications'] ?? true, FILTER_VALIDATE_BOOLEAN) === true;
}
function ptf_rfq_notify_aliases(array $row): array {
    $out = [];
    foreach (['_id', 'cd', 'code'] as $key) {
        $id = ptf_rfq_notify_text($row[$key] ?? '', 160);
        if ($id !== '') $out[$id] = true;
    }
    return array_keys($out);
}
function ptf_rfq_notify_state(array $row): string {
    $st = ptf_rfq_notify_first($row, ['st','status'], 80);
    /* WF10 is the initial workflow; initializing it is not a status transition. */
    $wf = ptf_rfq_notify_text($row['wf'] ?? 'WF10', 80) ?: 'WF10';
    $waiting = ptf_rfq_notify_text($row['waiting'] ?? '', 80);
    $fallback = ($st === '' && $wf === 'WF10') ? ptf_rfq_notify_first($row, ['stxt','statusText']) : '';
    return json_encode([$st, $wf, $waiting, $fallback], JSON_UNESCAPED_UNICODE);
}
function ptf_rfq_notify_label(array $row): string {
    $label = ptf_rfq_notify_first($row, ['stxt','statusText']);
    if ($label !== '') return $label;
    $labels = [
        'st1'=>'دریافت اولیه', 'st2'=>'بررسی فنی', 'stTO'=>'صدور پیشنهاد فنی', 'stCO'=>'صدور پیشنهاد مالی',
        'st3'=>'تایید', 'st4'=>'پیش‌فاکتور', 'st5'=>'ابلاغ سفارش', 'st6'=>'آماده‌سازی', 'st7'=>'تحویل شده',
        'st8'=>'در حال تامین توسط تامین‌کننده', 'st9'=>'تحویل تامین‌کننده', 'stX'=>'لغو / مختومه',
        'pending'=>'در انتظار تایید مدیران', 'approved'=>'تاییدشده', 'rejected'=>'ردشده',
        'void'=>'باطل شده', 'cancelled'=>'لغو شده', 'closed'=>'مختومه',
        'WF10'=>'دریافت اولیه', 'WF20'=>'پیشنهاد فنی صادر شد', 'WF30'=>'منتظر پاسخ کارفرما (فنی)',
        'WF35'=>'در حال صدور پیشنهاد اصلاحی (فنی)', 'WF40'=>'منتظر صدور پیشنهاد مالی',
        'WF50'=>'پیشنهاد مالی صادر شد', 'WF55'=>'در حال اصلاح پیشنهاد مالی',
        'WF60'=>'منتظر پاسخ کارفرما (مالی)', 'WF70'=>'در حال تامین',
        'WF90'=>'بایگانی — عدم تایید فنی', 'WF91'=>'بایگانی — بازنده مالی'
    ];
    $code = ptf_rfq_notify_first($row, ['wf','st','status'], 80);
    return $labels[$code] ?? ($code ?: 'نامشخص');
}
function ptf_rfq_notify_events(array $before, array $after, string $source, string $actor, string $operation, bool $creates = true): array {
    if ($operation === '') return [];
    $oldIndex = []; $newIndex = [];
    foreach ($before as $i => $row) if (is_array($row)) foreach (ptf_rfq_notify_aliases($row) as $alias) $oldIndex[$alias][$i] = true;
    foreach ($after as $i => $row) if (is_array($row)) foreach (ptf_rfq_notify_aliases($row) as $alias) $newIndex[$alias][$i] = true;
    $events = [];
    $at = (new DateTimeImmutable('now', new DateTimeZone('Asia/Tehran')))->format('Y-m-d H:i:s');
    foreach ($after as $row) {
        if (!is_array($row) || !empty($row['deleted']) || !empty($row['_deleted'])) continue;
        $aliases = ptf_rfq_notify_aliases($row);
        if (!$aliases) continue;
        $matches = []; $ambiguous = false;
        foreach ($aliases as $alias) {
            if (count($newIndex[$alias] ?? []) > 1) $ambiguous = true;
            foreach (($oldIndex[$alias] ?? []) as $i => $_) $matches[$i] = true;
        }
        /* Do not guess identities or send several notices for corrupt duplicates. */
        if ($ambiguous || count($matches) > 1) continue;
        $old = $matches ? $before[array_key_first($matches)] : null;
        if ($old === null && !$creates) continue;
        $from = is_array($old) ? ptf_rfq_notify_state($old) : '';
        $to = ptf_rfq_notify_state($row);
        if ($old !== null && $from === $to) continue;
        $id = $aliases[0]; /* canonical _id || cd; site uses code */
        $kind = $old === null ? 'created' : 'status';
        $eventId = hash('sha256', $operation . "\n" . $source . "\n" . $id . "\n" . $kind . "\n" . $from . "\n" . $to);
        $title = $kind === 'created' ? '📥 ثبت درخواست جدید' : '🔄 تغییر وضعیت درخواست';
        if ($kind === 'created' && $source === 'site') $title = '📥 استعلام جدید از سایت';
        if ($kind === 'created' && $source === 'crm' && ($row['src'] ?? '') === 'site') $title = '📥 ورود درخواست سایت به چرخهٔ فروش';
        $ref = (ptf_rfq_notify_first($row, ['cd','code'], 160) ?: $id);
        $text = $title . "\nشماره درخواست: " . $ref . "\nمشتری: " . (ptf_rfq_notify_first($row, ['co','company']) ?: 'نامشخص');
        $subject = ptf_rfq_notify_first($row, ['subj','subject'], 300);
        if ($subject !== '') $text .= "\nموضوع: " . $subject;
        $category = ptf_rfq_notify_first($row, ['ca','category'], 120);
        if ($category !== '') $text .= "\nحوزه: " . $category;
        /* Preserve the existing site-registration alert's contact details. CRM
           status notices do not introduce phone/email disclosure to the group. */
        if ($source === 'site' && $kind === 'created') {
            $text .= "\nنام: " . ptf_rfq_notify_text($row['contact'] ?? '');
            $text .= "\nتلفن: " . ptf_rfq_notify_text($row['phone'] ?? '', 50);
        }
        if ($old !== null) $text .= "\nوضعیت قبلی: " . ptf_rfq_notify_label($old);
        $text .= "\nوضعیت " . ($old !== null ? 'جدید' : 'اولیه') . ': ' . ptf_rfq_notify_label($row);
        $text .= "\nانجام‌دهنده: " . (ptf_rfq_notify_text($actor, 120) ?: 'سیستم');
        $text .= "\nزمان: " . $at . ' (تهران)' . "\nمنبع: " . ($source === 'site' ? 'سایت' : 'CRM');
        /* Plain text; no parse_mode, email, attachment URL or financial amount. */
        $events[] = ['id'=>$eventId, 'text'=>$text, 'kind'=>$kind, 'createdAt'=>time()];
    }
    return $events;
}
function ptf_rfq_notify_dir(): string {
    return dirname(__DIR__) . '/crm/data/sync';
}
function ptf_rfq_notify_store(string $dir, callable $change) {
    if (!is_dir($dir) && !@mkdir($dir, 0750, true) && !is_dir($dir)) throw new RuntimeException('rfq_outbox_directory_failed');
    $dir = realpath($dir) ?: $dir; /* one canonical file/lock identity across both APIs */
    $lock = @fopen($dir . '/.rfq-notify.lock', 'c+');
    if (!$lock || !flock($lock, LOCK_EX)) {
        if (is_resource($lock)) fclose($lock);
        throw new RuntimeException('rfq_outbox_lock_failed');
    }
    try {
        $file = $dir . '/.rfq-notify.json';
        $state = is_file($file) ? json_decode((string)file_get_contents($file), true) : ['version'=>1, 'jobs'=>[], 'nextSendAt'=>0];
        if (!is_array($state) || !is_array($state['jobs'] ?? null)) throw new RuntimeException('rfq_outbox_invalid');
        $result = $change($state);
        $json = json_encode($state, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $tmp = $file . '.tmp.' . bin2hex(random_bytes(4));
        if ($json === false || file_put_contents($tmp, $json, LOCK_EX) === false || !rename($tmp, $file)) {
            @unlink($tmp); throw new RuntimeException('rfq_outbox_write_failed');
        }
        @chmod($file, 0600);
        return $result;
    } finally { flock($lock, LOCK_UN); fclose($lock); }
}
function ptf_rfq_notify_enqueue(array $events, ?string $dir = null): bool {
    if (!$events || !ptf_rfq_notify_enabled()) return true;
    $dir = $dir ?? ptf_rfq_notify_dir();
    try {
        ptf_rfq_notify_store($dir, function (&$state) use ($events) {
            foreach ($events as $event) {
                if (!is_array($event) || !preg_match('/^[a-f0-9]{64}$/', (string)($event['id'] ?? '')) || !is_string($event['text'] ?? null)) continue;
                if (isset($state['jobs'][$event['id']])) continue;
                $state['jobs'][$event['id']] = $event + ['status'=>'pending', 'attempts'=>0, 'nextAttemptAt'=>0];
            }
            /* Keep 2000 terminal dedup markers; never prune undelivered events. */
            $terminal = [];
            foreach ($state['jobs'] as $id => $job) if (in_array($job['status'] ?? '', ['sent', 'cancelled'], true)) $terminal[] = $id;
            foreach (array_slice($terminal, 0, max(0, count($terminal) - 2000)) as $id) unset($state['jobs'][$id]);
        });
        ptf_rfq_notify_schedule($dir);
        return true;
    } catch (Throwable $e) {
        error_log('PTF RFQ Telegram: outbox enqueue failed');
        return false;
    }
}
/* Called only after publishing the entire business transaction. If the outbox
   cannot be written, move its existing WAL out of the business-replay namespace:
   recovery must retry the notice, NEVER overwrite newer CRM projections. */
function ptf_rfq_notify_after_commit(array $events, string $wal): bool {
    if (!$events || ptf_rfq_notify_enqueue($events, dirname($wal))) return true;
    $retry = dirname($wal) . '/.rfq-notify-recover-' . hash('sha256', basename($wal)) . '.json';
    if (!@rename($wal, $retry)) throw new RuntimeException('rfq_notification_wal_preserve_failed');
    return false;
}
function ptf_rfq_notify_recover(string $dir): void {
    foreach ((glob($dir . '/.rfq-notify-recover-*.json') ?: []) as $file) {
        $record = json_decode((string)@file_get_contents($file), true);
        if (!is_array($record) || !is_array($record['rfqNotifications'] ?? null)) {
            error_log('PTF RFQ Telegram: invalid notification recovery file'); continue;
        }
        if (ptf_rfq_notify_enqueue($record['rfqNotifications'], $dir)) @unlink($file);
    }
}
function ptf_rfq_notify_schedule(string $dir): void {
    if (PHP_SAPI === 'cli') return; /* CLI worker/test explicitly controls delivery. */
    if (isset($GLOBALS['ptf_rfq_notify_scheduled'][$dir])) return;
    $GLOBALS['ptf_rfq_notify_scheduled'][$dir] = true;
    register_shutdown_function(function () use ($dir) {
        /* FPM releases the HTTP response before external I/O. Other SAPIs retain
           the committed result; Telegram failure cannot roll back the RFQ. */
        if (function_exists('fastcgi_finish_request')) @fastcgi_finish_request();
        ptf_rfq_notify_flush($dir);
    });
}
function ptf_rfq_notify_flush(?string $dir = null): array {
    $dir = $dir ?? ptf_rfq_notify_dir();
    if (!ptf_rfq_notify_enabled() || !is_dir($dir)) return ['sent'=>0];
    ptf_rfq_notify_recover($dir);
    if (!is_file($dir . '/.rfq-notify.json')) return ['sent'=>0];
    $delivery = @fopen($dir . '/.rfq-notify-delivery.lock', 'c+');
    if (!$delivery || !flock($delivery, LOCK_EX | LOCK_NB)) {
        if (is_resource($delivery)) fclose($delivery);
        return ['sent'=>0, 'busy'=>true];
    }
    try {
        $now = time();
        $job = ptf_rfq_notify_store($dir, function (&$state) use ($now) {
            foreach ($state['jobs'] as &$row) {
                if (($row['status'] ?? '') === 'sending' && (int)($row['claimedAt'] ?? 0) + 90 < $now) {
                    /* Telegram has no idempotency key: a crashed/ambiguous send is
                       not auto-retried, since it may already exist in the group. */
                    $row['status'] = 'uncertain'; $row['error'] = 'worker_interrupted';
                }
            } unset($row);
            if ((int)($state['nextSendAt'] ?? 0) > $now) return null;
            foreach ($state['jobs'] as &$row) {
                if (($row['status'] ?? '') !== 'pending' || (int)($row['nextAttemptAt'] ?? 0) > $now) continue;
                $row['status'] = 'sending'; $row['claimedAt'] = $now; $row['attempts'] = (int)($row['attempts'] ?? 0) + 1;
                $state['nextSendAt'] = $now + 3; /* bounded group rate; no sleeping in HTTP */
                $selected = $row; unset($row); return $selected;
            } unset($row);
            return null;
        });
        if (!$job) return ['sent'=>0];
        $cfg = ptf_rfq_notify_cfg();
        $http = 0; $errno = 0; $response = false;
        try {
            if (!function_exists('curl_init')) throw new RuntimeException('curl_unavailable');
            $ch = curl_init('https://api.telegram.org/bot' . $cfg['telegram_token'] . '/sendMessage');
            curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER=>true, CURLOPT_POST=>true, CURLOPT_CONNECTTIMEOUT=>3,
                CURLOPT_TIMEOUT=>6, CURLOPT_SSL_VERIFYPEER=>true, CURLOPT_HTTPHEADER=>['Content-Type: application/json'],
                CURLOPT_POSTFIELDS=>json_encode(['chat_id'=>$cfg['telegram_chat_id'], 'text'=>$job['text'], 'disable_web_page_preview'=>true], JSON_UNESCAPED_UNICODE)]);
            $response = curl_exec($ch); $http = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE); $errno = curl_errno($ch); curl_close($ch);
        } catch (Throwable $e) { $errno = -1; }
        $reply = is_string($response) ? json_decode($response, true) : null;
        $ok = $http >= 200 && $http < 300 && is_array($reply) && ($reply['ok'] ?? false) === true;
        $rejected = is_array($reply) && ($reply['ok'] ?? null) === false;
        $retryable = $rejected || in_array($errno, [-1, 5, 6, 7, 35, 60], true);
        $retryAfter = $http === 429 || (int)($reply['error_code'] ?? 0) === 429 ? max(3, min(86400, (int)($reply['parameters']['retry_after'] ?? 60))) : min(3600, 30 * (2 ** min(7, (int)$job['attempts'])));
        ptf_rfq_notify_store($dir, function (&$state) use ($job, $ok, $retryable, $retryAfter, $reply, $http, $errno) {
            if (!isset($state['jobs'][$job['id']])) return;
            $row =& $state['jobs'][$job['id']];
            if ($ok) {
                $row['status'] = 'sent'; $row['sentAt'] = time(); $row['messageId'] = $reply['result']['message_id'] ?? null;
                unset($row['text'], $row['error']);
            } elseif ($retryable && (int)$row['attempts'] < 8) {
                $row['status'] = 'pending'; $row['nextAttemptAt'] = time() + $retryAfter;
                $row['error'] = 'telegram_rejected_' . (int)($reply['error_code'] ?? $http);
                if ((int)($reply['error_code'] ?? $http) === 429) $state['nextSendAt'] = max((int)$state['nextSendAt'], $row['nextAttemptAt']);
            } else {
                $row['status'] = $retryable ? 'failed' : 'uncertain';
                $row['error'] = $retryable ? 'retry_limit' : 'delivery_unconfirmed';
            }
        });
        if (!$ok) error_log('PTF RFQ Telegram: delivery not confirmed; event=' . substr($job['id'], 0, 12) . '; http=' . $http . '; errno=' . $errno);
        return ['sent'=>$ok ? 1 : 0, 'attempted'=>1, 'retryable'=>$retryable];
    } catch (Throwable $e) {
        error_log('PTF RFQ Telegram: outbox delivery failed');
        return ['sent'=>0, 'error'=>'outbox_delivery_failed'];
    } finally { flock($delivery, LOCK_UN); fclose($delivery); }
}
function ptf_rfq_notify_counts(?string $dir = null): array {
    $file = ($dir ?? ptf_rfq_notify_dir()) . '/.rfq-notify.json';
    $state = is_file($file) ? json_decode((string)@file_get_contents($file), true) : ['jobs'=>[]];
    if (!is_array($state) || !is_array($state['jobs'] ?? null)) throw new RuntimeException('rfq_outbox_invalid');
    $counts = ['pending'=>0, 'sending'=>0, 'sent'=>0, 'uncertain'=>0, 'failed'=>0, 'recoveryPending'=>count(glob(dirname($file) . '/.rfq-notify-recover-*.json') ?: [])];
    foreach (($state['jobs'] ?? []) as $job) { $s = (string)($job['status'] ?? ''); if (isset($counts[$s])) $counts[$s]++; }
    return $counts;
}
