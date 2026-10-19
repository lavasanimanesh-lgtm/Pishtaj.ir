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
    foreach (['_id', 'cd', 'code', 'inqNo'] as $key) {
        $id = ptf_rfq_notify_text($row[$key] ?? '', 160);
        if ($id !== '') $out[$id] = true;
    }
    return array_keys($out);
}
function ptf_rfq_notify_clean_label(string $label): string {
    if ($label === '') return '';
    $s = preg_replace('/[\x{1F000}-\x{1FAFF}\x{2600}-\x{27BF}\x{FE00}-\x{FE0F}\x{1F900}-\x{1F9FF}\x{1F600}-\x{1F64F}\x{1F300}-\x{1F5FF}\x{1F680}-\x{1F6FF}\x{2300}-\x{23FF}\x{2B50}\x{2B55}\x{200D}\x{200C}]+/u', ' ', $label);
    $s = preg_replace('/[\x{2013}\x{2014}\-\:\(\)\[\]\{\}\.\,\;\!\?\x{061B}\x{061F}]+/u', ' ', (string)$s);
    return trim((string)preg_replace('/\s+/u', ' ', (string)$s));
}
function ptf_rfq_notify_state(array $row): string {
    $st = ptf_rfq_notify_first($row, ['st','status'], 80);
    /* WF10 is the initial workflow; initializing it is not a status transition. */
    $wf = ptf_rfq_notify_text($row['wf'] ?? 'WF10', 80) ?: 'WF10';
    $waiting = ptf_rfq_notify_text($row['waiting'] ?? '', 80);
    $fallback = ($st === '' && $wf === 'WF10') ? ptf_rfq_notify_first($row, ['stxt','statusText']) : '';
    return json_encode([$st, $wf, $waiting, $fallback], JSON_UNESCAPED_UNICODE);
}
function ptf_rfq_notify_labels(): array {
    return [
        'st1'=>'دریافت اولیه', 'st2'=>'بررسی فنی', 'stTO'=>'صدور پیشنهاد فنی', 'stCO'=>'صدور پیشنهاد مالی',
        'st3'=>'تایید', 'st4'=>'پیش‌فاکتور', 'st5'=>'ابلاغ سفارش', 'st6'=>'آماده‌سازی', 'st7'=>'تحویل شده',
        'st8'=>'در حال تامین توسط تامین‌کننده', 'st9'=>'تحویل تامین‌کننده', 'stX'=>'لغو / مختومه',
        'pending'=>'در انتظار تایید مدیران', 'approved'=>'تاییدشده', 'rejected'=>'ردشده',
        'void'=>'باطل شده', 'cancelled'=>'لغو شده', 'closed'=>'مختومه',
        'WF10'=>'دریافت اولیه', 'WF20'=>'پیشنهاد فنی صادر شد', 'WF30'=>'منتظر پاسخ کارفرما (فنی)',
        'WF35'=>'در حال صدور پیشنهاد اصلاحی (فنی)', 'WF40'=>'منتظر صدور پیشنهاد مالی',
        'WF50'=>'پیشنهاد مالی صادر شد', 'WF55'=>'در حال اصلاح پیشنهاد مالی',
        'WF60'=>'منتظر پاسخ کارفرما (مالی)', 'WF70'=>'در حال تامین',
        'WF80'=>'تحویل شده', 'WF85'=>'مختومه (تسویه)',
        'WF90'=>'بایگانی — عدم تایید فنی', 'WF91'=>'بایگانی — بازنده مالی'
    ];
}
/* برچسب از روی «کد» وضعیت — نه از stxt که ممکن است از بُعد دیگر (دستی/گردش‌کار)
   آلوده باشد. کد خالی = بدون برچسب (fallback با فراخواننده است). */
function ptf_rfq_notify_code_label(string $code): string {
    $code = trim($code);
    if ($code === '') return '';
    $labels = ptf_rfq_notify_labels();
    return $labels[$code] ?? $code;
}
function ptf_rfq_notify_label(array $row): string {
    $label = ptf_rfq_notify_first($row, ['stxt','statusText']);
    if ($label !== '') return $label;
    $code = ptf_rfq_notify_first($row, ['wf','st','status'], 80);
    return ptf_rfq_notify_code_label($code) ?: 'نامشخص';
}
/* آخرین رویداد گردش‌کارِ هم‌خوان با وضعیت جدید (برای خط «رویداد» پیام بات تا
   گیرنده ببیند گذار دقیقاً از چه عملی آمده — مثلاً تغییر وضعیت کدام پیشنهاد). */
function ptf_rfq_notify_last_wf_event(array $row, string $wf): string {
    $log = is_array($row['wfLog'] ?? null) ? $row['wfLog'] : [];
    for ($i = count($log) - 1; $i >= 0; $i--) {
        $e = $log[$i];
        if (!is_array($e) || (string)($e['wf'] ?? '') !== $wf) continue;
        $ev = ptf_rfq_notify_text($e['ev'] ?? '', 160);
        if ($ev !== '') return $ev;
    }
    return '';
}
/* نام نمایشی انجام‌دهنده از فهرست کاربران (username ← name)؛ پیام گروه باید نام
   شخص را بگوید، نه شناسهٔ ورود را. نیافتن = همان شناسه — هرگز حدس زده نمی‌شود. */
function ptf_rfq_notify_resolve_actor(string $actor, array $users): string {
    $a = trim($actor);
    if ($a === '') return '';
    foreach ($users as $u) {
        if (!is_array($u)) continue;
        if (strcasecmp(trim((string)($u['username'] ?? '')), $a) !== 0) continue;
        $name = trim((string)($u['name'] ?? ''));
        return $name !== '' ? $name : $a;
    }
    return $a;
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
        /* v34.39.56 (OFFER-STATUS-WF): دو بُعد وضعیت روی یک رکورد زندگی می‌کنند —
           wf (گردش‌کار مشتق از پیشنهادها، بج جدول) و st (وضعیت دستی کانبان/رهگیری).
           برچسب پیام باید از همان بُعدی بیاید که واقعاً عوض شده و از روی «کد» خوانده
           شود، نه از stxt که هر دو بُعد رویش می‌نوشتند و پیام‌های قبلی/جدیدِ وارونه
           می‌ساخت (گزارش کارفرما: «قبلی پیشنهاد مالی صادر شد، جدید دریافت اولیه»). */
        $newWf = ptf_rfq_notify_text($row['wf'] ?? 'WF10', 80) ?: 'WF10';
        $wfChanged = false;
        $fromLabel = ''; $toLabel = ptf_rfq_notify_label($row);
        if ($old !== null) {
            $oldWf = ptf_rfq_notify_text($old['wf'] ?? 'WF10', 80) ?: 'WF10';
            $wfChanged = $oldWf !== $newWf;
            if ($wfChanged) {
                $fromLabel = ptf_rfq_notify_code_label($oldWf);
                $toLabel = ptf_rfq_notify_code_label($newWf);
            } elseif (trim((string)($old['wf'] ?? '')) !== '' || trim((string)($row['wf'] ?? '')) !== '') {
                /* ردیف گردش‌کاردار: stxt برچسب wf است؛ برچسب بُعد دستی باید از کدِ
                   همان فیلدی بیاید که عوض شده (st کانبان یا status)، نه از stxt. */
                $oldSt = ptf_rfq_notify_first($old, ['st'], 80); $newSt = ptf_rfq_notify_first($row, ['st'], 80);
                $oldStatus = ptf_rfq_notify_first($old, ['status'], 80); $newStatus = ptf_rfq_notify_first($row, ['status'], 80);
                if ($oldSt !== $newSt) {
                    $fromLabel = ptf_rfq_notify_code_label($oldSt) ?: ptf_rfq_notify_label($old);
                    $toLabel = ptf_rfq_notify_code_label($newSt) ?: ptf_rfq_notify_label($row);
                } elseif ($oldStatus !== $newStatus) {
                    $fromLabel = ptf_rfq_notify_code_label($oldStatus) ?: ptf_rfq_notify_label($old);
                    $toLabel = ptf_rfq_notify_code_label($newStatus) ?: ptf_rfq_notify_label($row);
                } else {
                    $fromLabel = ptf_rfq_notify_code_label($oldSt ?: $oldStatus);
                    $toLabel = ptf_rfq_notify_code_label($newSt ?: $newStatus);
                }
            } else {
                /* ردیف میراثی/سایت (بدون wf): stxt/statusText خودش برچسب بُعد دستی است */
                $fromLabel = ptf_rfq_notify_label($old);
                $toLabel = ptf_rfq_notify_label($row);
            }
            if ($fromLabel === $toLabel) continue;
            $cleanFrom = ptf_rfq_notify_clean_label($fromLabel);
            $cleanTo = ptf_rfq_notify_clean_label($toLabel);
            if ($cleanFrom !== '' && $cleanFrom === $cleanTo) continue;
        }
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
        if ($old !== null) $text .= "\nوضعیت قبلی: " . $fromLabel;
        $text .= "\nوضعیت " . ($old !== null ? 'جدید' : 'اولیه') . ': ' . $toLabel;
        /* گذار گردش‌کار: رویداد مولّد (مثلاً «تغییر وضعیت پیشنهاد CO-… → ارسال‌شده»)
           از wfLog همان رکورد — پیام بدون آن قابل راستی‌آزمایی نبود. */
        if ($wfChanged) {
            $wfEv = ptf_rfq_notify_last_wf_event($row, $newWf);
            if ($wfEv !== '') $text .= "\nرویداد: " . $wfEv;
        }
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

/* ═══ v34.39.56 (OFFER-STATUS-WF — RCA 2026-۱۰-۱۹) ═══
   موتور «واحد» گردش‌کار درخواست. پیش از این دو پیاده‌سازی موازی بود:
   sd_workflow_for_inquiry در sales-domain.php و wfCompute در crm/workflow.js؛
   مسیر سوم نوشتن (data_push در crm.php) اصلاً بازخوانی نمی‌کرد. سه واگراییِ
   اثبات‌شده با اجرای کد واقعی: ① کلاینت «اولین» CO/TO آرایه را برمی‌داشت، سرور
   با ترتیب کل ② کلاینت WF80/WF85 می‌ساخت، سرور نه ⇒ نوسان ③ تطبیق پیشنهاد با
   درخواست فقط روی یک شناسه بود، در حالی‌که هر درخواست دو شناسه دارد (cd سیستمی
   + inqNo کارفرما) و پیشنهاد ممکن است هر کدام را حمل کند ⇒ «هیچ پیشنهادی نیست»
   و سقوط به WF10 (دریافت اولیه) — همان گزارش کارفرما.
   این توابع تنها مرجع سروری‌اند؛ sd_* در sales-domain.php روی همین‌ها delegate
   می‌شوند و crm/workflow.js آینهٔ مستند همین قرارداد است (tester697). */
function ptf_rfq_workflow_label_map(): array {
    return ['WF10'=>'📥 دریافت اولیه','WF20'=>'🔧 پیشنهاد فنی صادر شد','WF30'=>'⏳ منتظر پاسخ کارفرما (فنی)','WF35'=>'✏️ در حال صدور پیشنهاد اصلاحی (فنی)','WF40'=>'💰 منتظر صدور پیشنهاد مالی','WF50'=>'💵 پیشنهاد مالی صادر شد','WF55'=>'✏️ در حال اصلاح پیشنهاد مالی','WF60'=>'⏳ منتظر پاسخ کارفرما (مالی)','WF70'=>'🏗 در حال تامین','WF80'=>'📦 تحویل شده','WF85'=>'✅ مختومه (تسویه)','WF90'=>'🗂 بایگانی — عدم تایید فنی','WF91'=>'🗂 بایگانی — بازنده مالی'];
}
function ptf_rfq_workflow_label(string $wf): string {
    $labels = ptf_rfq_workflow_label_map();
    return $labels[$wf] ?? $wf;
}
/* هر دو شناسهٔ درخواست — پیشنهاد با هر کدام لینک شده باشد مالِ همین درخواست است. */
function ptf_rfq_workflow_aliases(array $rfq): array {
    $out = [];
    foreach (['cd', 'inqNo', 'code'] as $field) {
        $v = trim((string)($rfq[$field] ?? ''));
        if ($v !== '' && !in_array($v, $out, true)) $out[] = $v;
    }
    return $out;
}
/* ترتیبِ کلِ پایدار «آخرین پیشنهاد» — مهر ISO ثبت ← دنبالهٔ عددی شماره ← خود شماره.
   (منتقل‌شده از sd_offer_wf_rank در v34.39.55؛ no یکتاست ⇒ ترتیب کامل و مستقل از جایگاه آرایه.) */
function ptf_offer_wf_rank(array $offer): array {
    $stamp = '';
    foreach (['serverRegisteredAt','registeredAtISO','updatedAtISO','createdAtISO'] as $field) {
        $value = trim((string)($offer[$field] ?? ''));
        if ($value !== '') { $stamp = $value; break; }
    }
    $no = trim((string)($offer['no'] ?? ''));
    $tail = 0;
    if (preg_match('/(\d+)\s*$/u', $no, $m)) $tail = (int)$m[1];
    return [$stamp, $tail, $no];
}
function ptf_offer_wf_rank_higher(array $candidate, array $current): bool {
    for ($i = 0; $i < 3; $i++) {
        if ($candidate[$i] === $current[$i]) continue;
        if ($i === 0) { /* مهر خالی همیشه قدیمی‌تر از مهرِ دار است */
            if ($candidate[$i] === '') return false;
            if ($current[$i] === '') return true;
        }
        return $candidate[$i] > $current[$i];
    }
    return false;
}
function ptf_rfq_wf_num($value): float {
    if (is_int($value) || is_float($value)) return (float)$value;
    $s = strtr((string)$value, ['۰'=>'0','۱'=>'1','۲'=>'2','۳'=>'3','۴'=>'4','۵'=>'5','۶'=>'6','۷'=>'7','۸'=>'8','۹'=>'9','٠'=>'0','١'=>'1','٢'=>'2','٣'=>'3','٤'=>'4','٥'=>'5','٦'=>'6','٧'=>'7','٨'=>'8','٩'=>'9']);
    $s = (string)preg_replace('/[^0-9.\-]/', '', $s);
    return is_numeric($s) ? (float)$s : 0.0;
}
/* جمع وصولی فاکتور برای WF85 — آینهٔ PTF.invPaidSum (finance-helpers.js) بدون
   لایهٔ بازسازی محلی PTF.ar: پرداخت‌های فعالِ میراثی + تخصیص سروریِ روی خود سند.
   پرداخت ابطالی/مهاجرتشده به رسید پرونده (fromAdvance/migratedToReceiptId/
   financialProjectionDisabled) شمرده نمی‌شود؛ سهم آن‌ها در allocatedBase/Vat است. */
function ptf_invoice_paid_sum(array $inv): float {
    $sum = 0.0;
    foreach (['payments', 'pays'] as $key) {
        foreach ((is_array($inv[$key] ?? null) ? $inv[$key] : []) as $p) {
            if (!is_array($p)) continue;
            $status = strtolower(trim((string)($p['status'] ?? '')));
            if ($status === 'void' || $status === 'reversal' || !empty($p['void'])) continue;
            if (!empty($p['fromAdvance']) || !empty($p['migratedToReceiptId']) || !empty($p['financialProjectionDisabled'])) continue;
            $sum += ptf_rfq_wf_num($p['amt'] ?? 0);
        }
    }
    return $sum + ptf_rfq_wf_num($inv['allocatedBase'] ?? 0) + ptf_rfq_wf_num($inv['allocatedVat'] ?? 0);
}
/* محاسبهٔ خالص وضعیت از رویدادها. $aliases: شناسه‌های درخواست؛ پیشنهادِ نسخهٔ
   همراه (rialOf/fxOf) سند تجاری مستقل نیست و در تعیین وضعیت شمرده نمی‌شود —
   وضعیت از پیشنهاد اصلی می‌آید (همان قاعدهٔ کانبان و هوک‌های تبدیل ارز). */
function ptf_rfq_workflow_compute(array $aliases, array $offers, array $projects = [], array $invoices = []): string {
    $aliasSet = [];
    foreach ($aliases as $a) { $a = trim((string)$a); if ($a !== '') $aliasSet[$a] = true; }
    if (!$aliasSet) return 'WF10';
    $lastCo = null; $lastTo = null; $coRank = null; $toRank = null;
    foreach ($offers as $offer) {
        if (!is_array($offer)) continue;
        $inq = trim((string)($offer['inqNo'] ?? ''));
        if ($inq === '' || !isset($aliasSet[$inq])) continue;
        if (trim((string)($offer['rialOf'] ?? '')) !== '' || trim((string)($offer['fxOf'] ?? '')) !== '') continue;
        $kind = strtoupper(trim((string)($offer['kind'] ?? '')));
        $isCo = in_array($kind, ['CO', 'TC'], true);
        if (!$isCo && $kind !== 'TO') continue;
        $rank = ptf_offer_wf_rank($offer);
        if ($isCo) { if ($coRank === null || ptf_offer_wf_rank_higher($rank, $coRank)) { $lastCo = $offer; $coRank = $rank; } }
        elseif ($toRank === null || ptf_offer_wf_rank_higher($rank, $toRank)) { $lastTo = $offer; $toRank = $rank; }
    }
    if ($lastCo !== null) {
        $st = strtolower(trim((string)($lastCo['st'] ?? 'draft')));
        if ($st === 'won') {
            $delivered = false;
            foreach ($projects as $p) {
                if (!is_array($p) || (string)($p['offerNo'] ?? '') !== (string)($lastCo['no'] ?? '')) continue;
                if (in_array(strtolower(trim((string)($p['state'] ?? ''))), ['done', 'closed', 'archived'], true)) { $delivered = true; break; }
            }
            if (!$delivered) return 'WF70';
            $inv = null;
            foreach ($invoices as $v) if (is_array($v) && (string)($v['offerNo'] ?? '') === (string)($lastCo['no'] ?? '')) { $inv = $v; break; }
            $paid = $inv !== null && ptf_invoice_paid_sum($inv) >= max(1.0, ptf_rfq_wf_num($inv['amount'] ?? 0));
            return $paid ? 'WF85' : 'WF80';
        }
        if ($st === 'lost') return 'WF91';
        if ($st === 'revise') return 'WF55';
        if ($st === 'sent') return 'WF60';
        return 'WF50';
    }
    if ($lastTo !== null) {
        $st = strtolower(trim((string)(($lastTo['tst'] ?? '') !== '' ? $lastTo['tst'] : ($lastTo['st'] ?? 'draft'))));
        if ($st === 'rejected' || $st === 'lost') return 'WF90';
        if ($st === 'approved' || $st === 'won') return 'WF40';
        if ($st === 'revise') return 'WF35';
        if ($st === 'sent') return 'WF30';
        return 'WF20';
    }
    return 'WF10';
}
/* اعمال روی یک ردیف RFQ — true یعنی وضعیت عوض شد (مهر + wfLog فقط در گذار واقعی). */
function ptf_rfq_workflow_apply_row(array &$rfq, array $offers, array $projects, array $invoices, string $actor, string $event, string $nowIso): bool {
    $wf = ptf_rfq_workflow_compute(ptf_rfq_workflow_aliases($rfq), $offers, $projects, $invoices);
    $changed = (string)($rfq['wf'] ?? '') !== $wf;
    $rfq['wf'] = $wf;
    $rfq['stxt'] = ptf_rfq_workflow_label($wf);
    if ($changed) {
        $rfq['wfUpdatedAtISO'] = $nowIso;
        if (!isset($rfq['wfLog']) || !is_array($rfq['wfLog'])) $rfq['wfLog'] = [];
        $rfq['wfLog'][] = ['t' => $nowIso, 'by' => $actor, 'wf' => $wf, 'ev' => $event];
    }
    return $changed;
}

/* ═══ v34.39.55 (RFQ-PHANTOM-NOTIFY — RCA 2026-۱۰-۱۳) ═══
   گزارش کارفرما: «اعلان‌های گروه واقعی نیست؛ پیشنهادی را ۱۰ روز پیش لواسانی صادر
   کرده ولی پیام می‌گوید یوسفی صادر کرد / وضعیتی را دست نزدم، از بازنده به منتظر
   پاسخ کارفرما تغییر کرد».
   ریشه: `wf` یک read-model مشتق است، ولی payload کلاینت همیشه «کل رکورد» است و
   می‌تواند کهنه باشد. هر upsert/push کهنه، wf را به گذشته برمی‌گرداند و همان
   واگردایی به‌عنوان «تغییر وضعیت» به نام کاربرِ جاریِ همان درخواست اعلام می‌شود.
   گارد زیر همان الگوی اثبات‌شدهٔ sd_preserve_rfq_assignee است: مهر زمانیِ جدیدتر
   برنده است؛ payload بدون مهرِ تازه‌تر نمی‌تواند وضعیت را به عقب ببرد.
   هر دو مسیر نوشتن (entity_upsert در sales-domain.php و data_push در crm.php)
   از همین یک تابع استفاده می‌کنند تا قاعده دوشقه نشود. */
function ptf_rfq_workflow_fields(): array {
    return ['wf', 'stxt', 'wfUpdatedAtISO', 'wfLog'];
}
function ptf_rfq_workflow_stamp(array $row): string {
    return trim((string)($row['wfUpdatedAtISO'] ?? ''));
}
function ptf_rfq_workflow_stale(array $incoming, array $server): bool {
    $serverStamp = ptf_rfq_workflow_stamp($server);
    /* سرور هیچ‌وقت wf را بدون مهر زمانی نمی‌نویسد (sd_apply_offer_workflow). پس
       «سرور مهر دارد و payload ندارد/قدیمی‌تر است» یعنی payload کهنه است. */
    if ($serverStamp === '') return false;
    $incomingStamp = ptf_rfq_workflow_stamp($incoming);
    return $incomingStamp === '' || strcmp($serverStamp, $incomingStamp) > 0;
}
/* یک ردیف را در جا اصلاح می‌کند؛ true یعنی فیلدهای گردش‌کار از نسخهٔ سرور حفظ شد. */
function ptf_rfq_workflow_preserve_row(array &$row, array $server): bool {
    if (!is_array($row) || !is_array($server)) return false;
    if (trim((string)($server['wf'] ?? '')) === '') return false; /* ردیف غیر گردش‌کاری: دست نمی‌خوریم */
    if (!ptf_rfq_workflow_stale($row, $server)) return false;
    foreach (ptf_rfq_workflow_fields() as $field) {
        if (array_key_exists($field, $server)) $row[$field] = $server[$field];
        else unset($row[$field]);
    }
    return true;
}
function ptf_rfq_workflow_identity(array $row): string {
    foreach (['_id', 'cd', 'inqNo'] as $field) {
        $value = trim((string)($row[$field] ?? ''));
        if ($value !== '') return $field . ':' . $value;
    }
    return '';
}
/* snapshot کامل (مسیر legacy data_push). null یعنی هیچ ردیفی اصلاح نشد. */
function ptf_rfq_workflow_merge_snapshot(array $incoming, array $server): ?array {
    $byId = [];
    foreach ($server as $row) {
        if (!is_array($row)) continue;
        foreach (ptf_rfq_notify_aliases($row) as $alias) {
            if (!isset($byId[$alias])) $byId[$alias] = $row;
        }
        $id = ptf_rfq_workflow_identity($row);
        if ($id !== '' && !isset($byId[$id])) $byId[$id] = $row;
    }
    $changed = false;
    foreach ($incoming as $i => $row) {
        if (!is_array($row)) continue;
        $matched = null;
        foreach (ptf_rfq_notify_aliases($row) as $alias) {
            if (isset($byId[$alias])) { $matched = $byId[$alias]; break; }
        }
        if ($matched === null) {
            $id = ptf_rfq_workflow_identity($row);
            if ($id !== '' && isset($byId[$id])) $matched = $byId[$id];
        }
        if ($matched === null) continue;
        if (ptf_rfq_workflow_preserve_row($incoming[$i], $matched)) $changed = true;
    }
    return $changed ? $incoming : null;
}
