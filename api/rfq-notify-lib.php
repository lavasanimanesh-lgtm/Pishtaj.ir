<?php
/**
 * RFQ Telegram notifications — server-only, after authoritative commit.
 * No browser notify hook, token in JS, or new sync collection. The private outbox
 * has its own short lock; Telegram I/O never holds a business/meta lock.
 */
declare(strict_types=1);

/* ═══ v34.39.63 (BOT-MSG-P2-15 — متن آزاد فرم سایت) ═══
   متن ارسالی کاربر (موضوع/شرکت/یادداشت) با «فیلدهای خود پیام» هم‌شکل می‌شد؛ مثلاً
   موضوعی که عبارت «وضعیت جدید: تحویل شده» را داشت، داخل همان سطر دیده می‌شد و
   خواننده را گمراه می‌کرد (probe9). سطر جعلی ساخته نمی‌شد (متن یک‌خطی و پاک می‌شود)
   ولی همان اندازه گمراه‌کننده بود. حالا دو نقطهٔ بعد از هر «برچسب پیام» در متنِ ورودی
   به خط تیره تبدیل می‌شود تا هیچ عبارتِ ورودی شکلِ فیلد رسمی نگیرد. */
function ptf_rfq_notify_neutralize_labels(string $s): string {
    if ($s === '' || strpos($s, ':') === false) return $s;
    $labels = ['شماره درخواست', 'وضعیت قبلی', 'وضعیت جدید', 'وضعیت اولیه', 'وضعیت کانبان',
        'وضعیت سایت', 'انجام‌دهنده', 'انجام دهنده', 'مشتری', 'موضوع', 'حوزه', 'زمان',
        'منبع', 'یادداشت', 'رویداد', 'نام', 'تلفن'];
    $quoted = array_map(function ($l) { return preg_quote($l, '/'); }, $labels);
    $out = preg_replace('/(' . implode('|', $quoted) . ')\s*:/u', '$1 —', $s);
    return is_string($out) ? $out : $s;
}
function ptf_rfq_notify_text($value, int $limit = 240): string {
    if (!is_scalar($value)) return '';
    $s = preg_replace('/[\x00-\x1f\x7f\x{202a}-\x{202e}\x{2066}-\x{2069}]+/u', ' ', (string)$value);
    $s = trim((string)preg_replace('/\s+/u', ' ', (string)$s));
    $s = ptf_rfq_notify_neutralize_labels((string)$s);
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
function ptf_rfq_notify_cfg_paths(): array {
    return [dirname(__DIR__, 2) . '/bot-config.php', dirname(__DIR__, 3) . '/bot-config.php',
        dirname(__DIR__) . '/bot-config.php', __DIR__ . '/bot-config.php'];
}
/* ═══ v34.39.63 (BOT-MSG-P2-16 — کشف فایل کانفیگ) ═══
   پیش از این اولین فایل موجود بی‌صدا برنده می‌شد؛ اگر دو نسخه روی هاست می‌ماند
   (یکی قدیمی/ناقص) هیچ‌کس نمی‌فهمید کدام اجرا می‌شود. حالا مسیر مصرف‌شده در
   خروجی وضعیت و در --status گزارش می‌شود و وجود فایل‌های تکراری هشدار می‌دهد. */
function ptf_rfq_notify_cfg_path(): string {
    ptf_rfq_notify_cfg();
    $p = $GLOBALS['ptf_rfq_notify_cfg_path'] ?? '';
    return is_string($p) ? $p : '';
}
function ptf_rfq_notify_cfg_duplicates(): array {
    $used = ptf_rfq_notify_cfg_path();
    $out = [];
    foreach (ptf_rfq_notify_cfg_paths() as $path) {
        if ($path === $used || !is_file($path)) continue;
        $out[] = $path;
    }
    return $out;
}
function ptf_rfq_notify_cfg(): ?array {
    static $loaded = false, $cfg = null;
    if ($loaded) return $cfg;
    $loaded = true;
    foreach (ptf_rfq_notify_cfg_paths() as $path) {
        if (!is_file($path)) continue;
        $value = include $path;
        if (!is_array($value)) continue;
        $cfg = $value;
        $fa = ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹','٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
        $en = ['0','1','2','3','4','5','6','7','8','9','0','1','2','3','4','5','6','7','8','9'];
        foreach (['telegram_token', 'telegram_chat_id', 'bale_token', 'bale_chat_id'] as $key) {
            $v = is_scalar($cfg[$key] ?? null) ? (string)$cfg[$key] : '';
            $cfg[$key] = (string)preg_replace('/\s+/u', '', str_replace($fa, $en, $v));
        }
        $GLOBALS['ptf_rfq_notify_cfg_path'] = $path;
        return $cfg;
    }
    return null;
}
/* کانالی که اعلان‌های خودکار از آن می‌روند — تلگرام اول، بعد بله (Bot API سازگار).
   خروجی: ['app','token','chat','warning'] یا null. */
function ptf_rfq_notify_channel(): ?array {
    $cfg = ptf_rfq_notify_cfg();
    if (!$cfg) return null;
    $tgToken = (string)($cfg['telegram_token'] ?? '');
    $tgChat = (string)($cfg['telegram_chat_id'] ?? '');
    if ($tgToken !== '' && $tgChat !== '') {
        /* چت خصوصی (عددی مثبت) نباید رخدادهای گروه شرکت را بگیرد. */
        if (!preg_match('/^(?:-\d{1,20}|@[A-Za-z0-9_]{5,64})$/', $tgChat)) return null;
        return ['app' => 'telegram', 'token' => $tgToken, 'chat' => $tgChat,
            'warning' => preg_match('/^\d/', $tgChat) ? 'شناسهٔ چت تلگرام عددی مثبت است (چت خصوصی) — گروه باید -100… یا @group باشد' : ''];
    }
    $bToken = (string)($cfg['bale_token'] ?? '');
    $bChat = (string)($cfg['bale_chat_id'] ?? '');
    if ($bToken !== '' && $bChat !== '') {
        if (!preg_match('/^(?:-?\d{1,20}|@[A-Za-z0-9_]{5,64})$/', $bChat)) return null;
        return ['app' => 'bale', 'token' => $bToken, 'chat' => $bChat,
            'warning' => preg_match('/^\d/', $bChat) ? 'شناسهٔ چت بله عددی مثبت است (چت خصوصی) — شناسهٔ گروه معمولاً منفی است' : ''];
    }
    return null;
}
/* دلیل خاموشی اعلان خودکار به زبان آدم — «خاموشِ بی‌صدا» ممنوع (v34.39.63). */
function ptf_rfq_notify_config_issue(): string {
    $cfg = ptf_rfq_notify_cfg();
    if (!$cfg) return 'فایل bot-config.php پیدا نشد';
    if (ptf_rfq_notify_channel()) return '';
    $tgToken = (string)($cfg['telegram_token'] ?? '');
    $tgChat = (string)($cfg['telegram_chat_id'] ?? '');
    if ($tgToken !== '' && $tgChat !== '') return 'شناسهٔ چت تلگرام نامعتبر است (عددی مثبت = چت خصوصی؛ گروه باید -100… یا @group باشد)';
    if ((string)($cfg['bale_token'] ?? '') !== '' && (string)($cfg['bale_chat_id'] ?? '') !== '') return 'شناسهٔ چت بله نامعتبر است';
    return 'هیچ کانالی کامل نیست (telegram_token + telegram_chat_id یا bale_token + bale_chat_id)';
}
function ptf_rfq_notify_enabled(): bool {
    if (!ptf_rfq_notify_channel()) return false;
    $cfg = ptf_rfq_notify_cfg();
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
/* ═══ v34.39.61 (BOT-MSG-P1-4 — «شناسهٔ تکراری = خفه‌شدن کامل») ═══
   پیش از این اگر یک شناسه (`cd`) بین دو ردیف مشترک بود، کل اعلانِ آن ردیف‌ها
   برای همیشه دفن می‌شد: تغییر واقعی وضعیت هیچ پیامی نمی‌ساخت و هیچ‌کس خبر نداشت.
   قاعدهٔ تازه: اول با هویت ذخیره‌سازی (`_id`، بعد `code`) تطبیق می‌دهیم که یکتاست؛
   فقط اگر آن نبود، با شناسه‌های نمایشی و «تنها وقتی یکتا باشند»؛ و اگر باز هم چند
   نامزد ماند با فیلدهای محتوایی (inqNo/تلفن/شرکت/موضوع) تفکیک می‌کنیم — هرگز حدس
   نمی‌زنیم. آنچه تفکیک‌نشدنی ماند پیام نمی‌سازد ولی «دیده می‌شود»: شمارندهٔ
   ambiguousRows در صف ثبت و در --status و خط سلامت کارت تنظیمات نمایش داده می‌شود. */
function ptf_rfq_notify_primary_id(array $row): string {
    /* `inqNo` عمداً اینجا نیست: یک استعلام می‌تواند چند ردیف/پیشنهاد داشته باشد. */
    return ptf_rfq_notify_first($row, ['_id', 'code'], 160);
}
function ptf_rfq_notify_disambiguate(array $before, array $candidates, array $row): array {
    foreach ([['inqNo'], ['phone'], ['co','company'], ['subj','subject'], ['contact','con']] as $keys) {
        $want = ptf_rfq_notify_clean_label(ptf_rfq_notify_first($row, $keys, 160));
        if ($want === '') continue;
        $hits = [];
        foreach ($candidates as $i) {
            $cand = $before[$i] ?? null;
            if (!is_array($cand)) continue;
            if (ptf_rfq_notify_clean_label(ptf_rfq_notify_first($cand, $keys, 160)) === $want) $hits[] = $i;
        }
        if (count($hits) === 1) return $hits;
        if (count($hits) > 1) $candidates = $hits;
    }
    return count($candidates) === 1 ? $candidates : [];
}
/* یادداشتی که فقط «برچسبِ کهنه» را تکرار می‌کند یادداشت نیست؛ مثلاً stxt قدیمی
   («دریافت اولیه») که کلاینت هنگام تغییر `st` به‌روزش نکرده است. متن آزاد واقعی
   دست‌نخورده می‌ماند — v34.39.61. */
function ptf_rfq_notify_prune_note(string $note, string $fromLabel, string $toLabel): string {
    $clean = ptf_rfq_notify_clean_label($note);
    if ($clean === '') return '';
    if ($clean === ptf_rfq_notify_clean_label($fromLabel) || $clean === ptf_rfq_notify_clean_label($toLabel)) return '';
    foreach (ptf_rfq_notify_labels() as $label) {
        if ($clean === ptf_rfq_notify_clean_label($label)) return '';
    }
    return $note;
}
function ptf_rfq_notify_diag_add(string $key, int $n = 1): void {
    if (!isset($GLOBALS['ptf_rfq_notify_diag']) || !is_array($GLOBALS['ptf_rfq_notify_diag'])) $GLOBALS['ptf_rfq_notify_diag'] = [];
    $GLOBALS['ptf_rfq_notify_diag'][$key] = (int)($GLOBALS['ptf_rfq_notify_diag'][$key] ?? 0) + $n;
}
function ptf_rfq_notify_diag_take(): array {
    $diag = $GLOBALS['ptf_rfq_notify_diag'] ?? [];
    $GLOBALS['ptf_rfq_notify_diag'] = [];
    return is_array($diag) ? $diag : [];
}
function ptf_rfq_notify_clean_label(string $label): string {
    if ($label === '') return '';
    $s = preg_replace('/[\x{1F000}-\x{1FAFF}\x{2600}-\x{27BF}\x{FE00}-\x{FE0F}\x{1F900}-\x{1F9FF}\x{1F600}-\x{1F64F}\x{1F300}-\x{1F5FF}\x{1F680}-\x{1F6FF}\x{2300}-\x{23FF}\x{2B50}\x{2B55}\x{200D}\x{200C}]+/u', ' ', $label);
    $s = preg_replace('/[\x{2013}\x{2014}\-\:\(\)\[\]\{\}\.\,\;\!\?\x{061B}\x{061F}]+/u', ' ', (string)$s);
    return trim((string)preg_replace('/\s+/u', ' ', (string)$s));
}
function ptf_rfq_notify_state(array $row): string {
    $st = ptf_rfq_notify_first($row, ['st'], 80);
    /* v34.39.61 (BOT-MSG-P1-5): `status` بُعد دوم وضعیت است (رهگیری/تایید سایت) و
       پیش از این فقط در نبودِ `st` دیده می‌شد. روی ردیفی که `st` هم داشت — همهٔ
       درخواست‌های سایت پس از عبور از کانبان — تایید/رد شدنِ `status` هیچ تفاوتی در
       اثر انگشت نمی‌ساخت، پس پیام هرگز ساخته نمی‌شد (probe6-۱). */
    $status = ptf_rfq_notify_first($row, ['status'], 80);
    /* WF10 is the initial workflow; initializing it is not a status transition. */
    $wf = ptf_rfq_notify_text($row['wf'] ?? 'WF10', 80) ?: 'WF10';
    $waiting = ptf_rfq_notify_text($row['waiting'] ?? '', 80);
    $fallback = ($st === '' && $status === '' && $wf === 'WF10') ? ptf_rfq_notify_first($row, ['stxt','statusText']) : '';
    return json_encode([$st, $status, $wf, $waiting, $fallback], JSON_UNESCAPED_UNICODE);
}
function ptf_rfq_notify_labels(): array {
    return [
        'st1'=>'دریافت اولیه', 'st2'=>'بررسی فنی', 'stTO'=>'صدور پیشنهاد فنی', 'stCO'=>'صدور پیشنهاد مالی',
        'st3'=>'تایید', 'st4'=>'پیش‌فاکتور', 'st5'=>'ابلاغ سفارش', 'st6'=>'آماده‌سازی', 'st7'=>'تحویل شده',
        'st8'=>'در حال تامین توسط تامین‌کننده', 'st9'=>'تحویل تامین‌کننده', 'stX'=>'لغو / مختومه',
        'pending'=>'در انتظار تایید مدیران', 'approved'=>'تاییدشده', 'rejected'=>'ردشده',
        'void'=>'باطل شده', 'cancelled'=>'لغو شده', 'closed'=>'مختومه',
        'redirected'=>'هدایت به فرم درست', 'stInv'=>'صدور فاکتور', 'stPay'=>'تسویه شده',
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
/* ═══ v34.39.60 (BOT-MSG-P1-3 — «برچسب از متن آزاد») ═══
   برای ردیف‌های بدون گردش‌کار (همهٔ درخواست‌های سایت) برچسب پیام از
   `statusText`/`stxt` خوانده می‌شد؛ این متن از کلاینت می‌آید و هر چیزی می‌تواند
   باشد («هر متن دلخواه — ۱۲۳ تومان تخفیف» در ارزیابی دیده شد) — پس یک وضعیت
   می‌توانست در دو پیام دو نام داشته باشد. قاعدهٔ تازه: برچسب همیشه از «کد»
   وضعیت؛ متن آزاد فقط یک خط «یادداشت» جداگانه (پاک‌شده، یک‌خطی، کوتاه) تا دلیل
   رد یا توضیح کاربر از دست نرود. کد ناشناخته = همان متن (بدون داده‌سازی).
   خروجی: [label, note]. */
function ptf_rfq_notify_display_label(array $row, string $code, array $keys): array {
    $raw = ptf_rfq_notify_first($row, $keys);
    $code = trim($code);
    if ($code !== '') {
        $labels = ptf_rfq_notify_labels();
        if (isset($labels[$code])) {
            $label = $labels[$code];
            $note = ($raw !== '' && ptf_rfq_notify_clean_label($raw) !== ptf_rfq_notify_clean_label($label)) ? $raw : '';
            return [$label, $note];
        }
    }
    return [$raw !== '' ? $raw : ptf_rfq_notify_code_label($code), ''];
}
function ptf_rfq_notify_label(array $row): string {
    $label = ptf_rfq_notify_first($row, ['stxt','statusText']);
    if ($label !== '') return $label;
    $code = ptf_rfq_notify_first($row, ['wf','st','status'], 80);
    return ptf_rfq_notify_code_label($code) ?: 'نامشخص';
}
/* آخرین رویداد گردش‌کارِ هم‌خوان با وضعیت جدید (برای خط «رویداد» پیام بات تا
   گیرنده ببیند گذار دقیقاً از چه عملی آمده — مثلاً تغییر وضعیت کدام پیشنهاد).
   ═══ v34.39.62 (BOT-MSG-P2-12): رویداد «همان کد» کافی نیست ═══
   پیش از این آخرین ورودیِ هم‌کد — هرچقدر هم قدیمی — چاپ می‌شد؛ پیام امروز
   «رویداد: ارسال پیشنهاد CO-9» را از ده روز پیش نشان می‌داد (همان حس «پیام
   متعلق به رویداد گذشته» که کارفرما گزارش کرد). حالا فقط ورودی‌ای که مهر زمانی
   دارد و در پنجرهٔ کوتاهی پیش از همین گذار نوشته شده پذیرفته می‌شود؛ گذارهای
   سروری (ptf_rfq_workflow_apply_row) همیشه همین لحظه لاگ می‌زنند. */
function ptf_rfq_notify_last_wf_event(array $row, string $wf, int $maxAgeSeconds = 900): string {
    $log = is_array($row['wfLog'] ?? null) ? $row['wfLog'] : [];
    $now = time();
    for ($i = count($log) - 1; $i >= 0; $i--) {
        $e = $log[$i];
        if (!is_array($e) || (string)($e['wf'] ?? '') !== $wf) continue;
        $ev = ptf_rfq_notify_text($e['ev'] ?? '', 160);
        if ($ev === '') continue;
        $stamp = trim((string)($e['t'] ?? ($e['at'] ?? ($e['iso'] ?? ''))));
        if ($stamp === '') continue; /* بی‌مهر = نمی‌دانیم مال همین گذار است یا نه */
        $ts = strtotime($stamp);
        if ($ts === false) continue;
        if ($now - $ts > $maxAgeSeconds) continue; /* رویداد کهنه — خط گمراه‌کننده */
        return $ev;
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
/* $channel: 'canonical' = نوشتن مرجع (entity_upsert / data_push / ثبت سایت)،
   'mirror' = آینهٔ رهگیری سایت (set_status روی rfqs.json). یک اقدام کاربر می‌تواند
   هر دو را بنویسد؛ با کلید هم‌ترازی صف، فقط یک پیام به گروه می‌رود (v34.39.59). */
function ptf_rfq_notify_events(array $before, array $after, string $source, string $actor, string $operation, bool $creates = true, string $channel = 'canonical'): array {
    if ($operation === '') return [];
    $oldIndex = []; $newIndex = []; $oldPrimary = []; $newPrimary = [];
    foreach ($before as $i => $row) if (is_array($row)) {
        foreach (ptf_rfq_notify_aliases($row) as $alias) $oldIndex[$alias][$i] = true;
        $pid = ptf_rfq_notify_primary_id($row);
        if ($pid !== '') $oldPrimary[$pid][$i] = true;
    }
    foreach ($after as $i => $row) if (is_array($row)) {
        foreach (ptf_rfq_notify_aliases($row) as $alias) $newIndex[$alias][$i] = true;
        $pid = ptf_rfq_notify_primary_id($row);
        if ($pid !== '') $newPrimary[$pid][$i] = true;
    }
    $events = [];
    $at = (new DateTimeImmutable('now', new DateTimeZone('Asia/Tehran')))->format('Y-m-d H:i:s');
    foreach ($after as $row) {
        if (!is_array($row) || !empty($row['deleted']) || !empty($row['_deleted'])) continue;
        $aliases = ptf_rfq_notify_aliases($row);
        if (!$aliases) continue;
        $matches = []; $ambiguous = false;
        /* ① هویت ذخیره‌سازی یکتا (_id/code) بر همهٔ شناسه‌های نمایشی مقدم است؛ ردیف
           تکراری در «شمارهٔ درخواست» دلیل نمی‌شود تغییر واقعیِ یک ردیف دفن شود. */
        $pid = ptf_rfq_notify_primary_id($row);
        if ($pid !== '' && count($oldPrimary[$pid] ?? []) === 1 && count($newPrimary[$pid] ?? []) === 1) {
            $matches = array_keys($oldPrimary[$pid]);
        } else {
            foreach ($aliases as $alias) {
                /* شناسه‌ای که در یک طرف مشترک است برای تطبیق قابل اعتماد نیست. */
                if (count($oldIndex[$alias] ?? []) > 1 || count($newIndex[$alias] ?? []) > 1) { $ambiguous = true; continue; }
                foreach (($oldIndex[$alias] ?? []) as $i => $_) $matches[$i] = true;
            }
            if (count($matches) > 1) {
                $narrowed = ptf_rfq_notify_disambiguate($before, array_keys($matches), $row);
                if (count($narrowed) === 1) { $matches = $narrowed; $ambiguous = false; }
                else { $matches = []; $ambiguous = true; }
            }
        }
        /* هرگز حدس نمی‌زنیم؛ ولی «خفه‌شدن بی‌صدا» هم ممنوع است: شمارندهٔ دیدنی. */
        if ($ambiguous && !$matches) { ptf_rfq_notify_diag_add('ambiguousRows'); continue; }
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
        $fromNote = ''; $toNote = ''; /* متن آزاد فقط «یادداشت» است، نه برچسب (v34.39.60) */
        $extraState = ''; /* بُعد دومی که هم‌زمان عوض شده — پنهان نمی‌شود (v34.39.61) */
        /* کدهای دو بُعد وضعیت — هم برای انتخاب برچسب (مسیر گردش‌کاردار) و هم برای
           کلید هم‌ترازی صف لازم‌اند (پایین‌تر). */
        $newSt = ptf_rfq_notify_first($row, ['st'], 80);
        $oldSt = '';
        $newStatus = ptf_rfq_notify_first($row, ['status'], 80);
        $oldStatus = '';
        if ($old !== null) {
            $oldWf = ptf_rfq_notify_text($old['wf'] ?? 'WF10', 80) ?: 'WF10';
            $wfChanged = $oldWf !== $newWf;
            $oldSt = ptf_rfq_notify_first($old, ['st'], 80);
            $oldStatus = ptf_rfq_notify_first($old, ['status'], 80);
            if ($wfChanged) {
                $fromLabel = ptf_rfq_notify_code_label($oldWf);
                $toLabel = ptf_rfq_notify_code_label($newWf);
                /* v34.39.61 (BOT-MSG-P1-5): یک اقدام می‌تواند هم گردش‌کار و هم وضعیت
                   دستی/سایت را هم‌زمان عوض کند؛ قبلاً فقط بُعد گردش‌کار در پیام
                   می‌آمد و تغییر دستی (مثلاً st2→st5 «ابلاغ سفارش») کاملاً پنهان
                   می‌شد. حالا خط دوم می‌آید تا گیرنده هر دو را ببیند. */
                if ($oldSt !== $newSt) {
                    $extraState = 'وضعیت کانبان: از «' . (ptf_rfq_notify_code_label($oldSt) ?: 'تعیین‌نشده')
                        . '» به «' . (ptf_rfq_notify_code_label($newSt) ?: 'تعیین‌نشده') . '»';
                } elseif ($oldStatus !== $newStatus) {
                    $extraState = 'وضعیت سایت: از «' . (ptf_rfq_notify_code_label($oldStatus) ?: 'تعیین‌نشده')
                        . '» به «' . (ptf_rfq_notify_code_label($newStatus) ?: 'تعیین‌نشده') . '»';
                }
            } elseif (trim((string)($old['wf'] ?? '')) !== '' || trim((string)($row['wf'] ?? '')) !== '') {
                /* ردیف گردش‌کاردار: stxt برچسب wf است؛ برچسب بُعد دستی باید از کدِ
                   همان فیلدی بیاید که عوض شده (st کانبان یا status)، نه از stxt. */
                if ($oldSt !== $newSt) {
                    $fromLabel = ptf_rfq_notify_code_label($oldSt) ?: ptf_rfq_notify_label($old);
                    $toLabel = ptf_rfq_notify_code_label($newSt) ?: ptf_rfq_notify_label($row);
                    /* بُعد سوم هم همان لحظه عوض شده؟ پنهانش نمی‌کنیم (v34.39.61). */
                    if ($oldStatus !== $newStatus) {
                        $extraState = 'وضعیت سایت: از «' . (ptf_rfq_notify_code_label($oldStatus) ?: 'تعیین‌نشده')
                            . '» به «' . (ptf_rfq_notify_code_label($newStatus) ?: 'تعیین‌نشده') . '»';
                    }
                } elseif ($oldStatus !== $newStatus) {
                    $fromLabel = ptf_rfq_notify_code_label($oldStatus) ?: ptf_rfq_notify_label($old);
                    $toLabel = ptf_rfq_notify_code_label($newStatus) ?: ptf_rfq_notify_label($row);
                } else {
                    $fromLabel = ptf_rfq_notify_code_label($oldSt ?: $oldStatus);
                    $toLabel = ptf_rfq_notify_code_label($newSt ?: $newStatus);
                }
            } else {
                /* ردیف میراثی/سایت (بدون wf): برچسب از «کدِ همان بُعدی» که عوض شده
                   (st کانبان یا status سایت) و متن آزاد فقط یادداشت — v34.39.60 (P1-3). */
                $useSt = $oldSt !== $newSt;
                $useStatus = !$useSt && $oldStatus !== $newStatus;
                /* هیچ کدی عوض نشده و فقط متن آزاد ویرایش شده ⇒ پیام گروه نمی‌سازیم
                   (متن آزاد «وضعیت» نیست؛ منبع حقیقت کد است). */
                if (!$useSt && !$useStatus) continue;
                if ($useSt) {
                    list($fromLabel, $fromNote) = ptf_rfq_notify_display_label($old, $oldSt, ['stxt','statusText']);
                    list($toLabel, $toNote) = ptf_rfq_notify_display_label($row, $newSt, ['stxt','statusText']);
                    /* اگر همان لحظه بُعد سایت هم عوض شده، در خط دوم می‌آید. */
                    if ($oldStatus !== $newStatus) {
                        $extraState = 'وضعیت سایت: از «' . (ptf_rfq_notify_code_label($oldStatus) ?: 'تعیین‌نشده')
                            . '» به «' . (ptf_rfq_notify_code_label($newStatus) ?: 'تعیین‌نشده') . '»';
                    }
                } else {
                    list($fromLabel, $fromNote) = ptf_rfq_notify_display_label($old, $oldStatus, ['stxt','statusText']);
                    list($toLabel, $toNote) = ptf_rfq_notify_display_label($row, $newStatus, ['stxt','statusText']);
                }
            }
            if ($fromLabel === $toLabel) continue;
            $cleanFrom = ptf_rfq_notify_clean_label($fromLabel);
            $cleanTo = ptf_rfq_notify_clean_label($toLabel);
            if ($cleanFrom !== '' && $cleanFrom === $cleanTo) continue;
        } else {
            /* رویداد «ثبت جدید»: برچسب وضعیت اولیه هم از کد خوانده می‌شود و متن
               آزاد ارسالی (در صورت تفاوت) یادداشت می‌شود — v34.39.60 (P1-3). */
            list($toLabel, $toNote) = ptf_rfq_notify_display_label($row, $newStatus !== '' ? $newStatus : $newSt, ['stxt','statusText']);
        }
        $id = $aliases[0]; /* canonical _id || cd; site uses code */
        /* v34.39.59 (BOT-MSG-P0 — «یک اقدام، دو پیام»):
           یک اقدام کاربر در CRM دو نوشتن دارد: نوشتن مرجع (entity_upsert/data_push)
           و آینهٔ رهگیری سایت (set_status روی rfqs.json). پیش از این هر دو پیام
           می‌ساختند با «وضعیت قبلی» و منبع متفاوت. کلید هم‌ترازی = شناسهٔ رکورد +
           کد وضعیت مقصد؛ صف با همین کلید پیام آینه را با پیام مرجع یکی می‌کند
           (پایین‌تر: ptf_rfq_notify_enqueue). گذارهای واقعیِ تکراری از یک کانال
           همچنان هر دو اعلام می‌شوند — فقط آینه در برابر مرجع حذف می‌شود. */
        $toCode = '';
        if ($old === null) $toCode = $newSt !== '' ? $newSt : $newStatus;
        elseif ($wfChanged) $toCode = $newWf;
        elseif ($oldSt !== $newSt) $toCode = $newSt;
        elseif ($oldStatus !== $newStatus) $toCode = $newStatus;
        /* شناسهٔ هم‌ترازی باید بین دو مجموعه یکی باشد: ردیف CRM با `_id` هویت دارد و
           ردیف رهگیری سایت با `code`. پس مبنای کلید، «کد نمایشی» است (cd/code/inqNo)
           و `_id` فقط آخرین انتخاب است. */
        $alignId = ptf_rfq_notify_first($row, ['cd','code','inqNo'], 160) ?: $id;
        $dedupeKey = $toCode === '' ? '' : hash('sha256', strtolower($alignId) . '|' . $toCode);
        $kind = $old === null ? 'created' : 'status';
        $eventId = hash('sha256', $operation . "\n" . $source . "\n" . $id . "\n" . $kind . "\n" . $from . "\n" . $to);
        $title = $kind === 'created' ? '📥 ثبت درخواست جدید' : '🔄 تغییر وضعیت درخواست';
        if ($kind === 'created' && $source === 'site') $title = '📥 استعلام جدید از سایت';
        if ($kind === 'created' && $source === 'crm' && ($row['src'] ?? '') === 'site') $title = '📥 ورود درخواست سایت به چرخهٔ فروش';
        $ref = (ptf_rfq_notify_first($row, ['cd','code'], 160) ?: $id);
        /* v34.39.62 (BOT-MSG-P2-14): ردیف سایت همیشه «شرکت» ندارد؛ «نام تماس» جای آن
           می‌نشیند تا گروه «مشتری: نامشخص» نگیرد. هر دو نبود = نامشخص (بدون داده‌سازی). */
        $customer = ptf_rfq_notify_first($row, ['co','company'], 160);
        if ($customer === '') {
            $contactName = ptf_rfq_notify_first($row, ['con','contact'], 160);
            if ($contactName !== '') $customer = $contactName . ' (نام تماس)';
        }
        $text = $title . "\nشماره درخواست: " . $ref . "\nمشتری: " . ($customer !== '' ? $customer : 'نامشخص');
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
        if ($extraState !== '') $text .= "\n" . $extraState;
        /* متن آزاد کلاینت (دلیل رد/توضیح) به‌صورت خط جداگانهٔ کوتاه — نه جای برچسب */
        $toNote = ptf_rfq_notify_prune_note($toNote, $fromLabel, $toLabel);
        if ($toNote !== '') $text .= "\nیادداشت: " . ptf_rfq_notify_text($toNote, 160);
        /* گذار گردش‌کار: رویداد مولّد (مثلاً «تغییر وضعیت پیشنهاد CO-… → ارسال‌شده»)
           از wfLog همان رکورد — پیام بدون آن قابل راستی‌آزمایی نبود. */
        if ($wfChanged) {
            $wfEv = ptf_rfq_notify_last_wf_event($row, $newWf);
            if ($wfEv !== '') $text .= "\nرویداد: " . $wfEv;
        }
        $text .= "\nانجام‌دهنده: " . (ptf_rfq_notify_text($actor, 120) ?: 'سیستم');
        $text .= "\nزمان: " . $at . ' (تهران)' . "\nمنبع: " . ($source === 'site' ? 'سایت' : 'CRM');
        /* Plain text; no parse_mode, email, attachment URL or financial amount. */
        $events[] = ['id'=>$eventId, 'text'=>$text, 'kind'=>$kind, 'createdAt'=>time(),
            'dedupeKey'=>$dedupeKey, 'channel'=>($channel === 'mirror' ? 'mirror' : 'canonical')];
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
    /* v34.39.61 (BOT-MSG-P1-4): ردیفی که با شناسهٔ مشترک قابل تفکیک نبود پیام
       نمی‌سازد، ولی «هیچ پیامی نیامد» نباید بی‌سرنخ بماند: شمارندهٔ آن در همان صف
       می‌نشیند تا در --status و خط سلامت کارت تنظیمات دیده شود. */
    $diag = ptf_rfq_notify_diag_take();
    if (!$events && !$diag) return true;
    if (!ptf_rfq_notify_enabled()) return true;
    $dir = $dir ?? ptf_rfq_notify_dir();
    try {
        ptf_rfq_notify_store($dir, function (&$state) use ($events, $diag) {
            if ($diag) {
                foreach ($diag as $diagKey => $diagCount) {
                    $state['notifyDiag'][$diagKey] = (int)($state['notifyDiag'][$diagKey] ?? 0) + (int)$diagCount;
                }
            }
            /* v34.39.59 (BOT-MSG-P0): هم‌ترازی «پیام مرجع» و «پیام آینهٔ رهگیری».
               برای یک اقدام، set_status و نوشتن مرجع هر دو رویداد می‌سازند؛ همیشه
               یکی از آن‌ها می‌ماند: اگر آینه هنوز ارسال نشده باشد با متن دقیق‌ترِ
               مرجع جایگزین می‌شود، و اگر مرجع تکراریِ آینهٔ ارسال‌شده باشد کنار
               گذاشته می‌شود. پنجرهٔ ۵ دقیقه فقط برای همین هم‌ترازی است؛ گذارهای
               تکراریِ واقعی در یک کانال همچنان هر بار اعلام می‌شوند. */
            $now = time();
            $window = 300;
            $byKey = [];
            foreach ($state['jobs'] as $jid => $job) {
                $key = (string)($job['dedupeKey'] ?? '');
                if ($key === '') continue;
                $status = (string)($job['status'] ?? '');
                if (in_array($status, ['sent', 'cancelled'], true)) {
                    $stamp = (int)($job['sentAt'] ?? ($job['createdAt'] ?? 0));
                    if ($stamp + $window < $now) continue;
                }
                $byKey[$key][] = $jid;
            }
            foreach ($events as $event) {
                if (!is_array($event) || !preg_match('/^[a-f0-9]{64}$/', (string)($event['id'] ?? '')) || !is_string($event['text'] ?? null)) continue;
                $channel = ((string)($event['channel'] ?? 'canonical') === 'mirror') ? 'mirror' : 'canonical';
                $key = (string)($event['dedupeKey'] ?? '');
                if ($key !== '' && !empty($byKey[$key])) {
                    $peerCanonical = false; $peerMirrorId = null;
                    foreach ($byKey[$key] as $pid) {
                        $pj = $state['jobs'][$pid] ?? null;
                        if (!is_array($pj)) continue;
                        if ((string)($pj['channel'] ?? 'canonical') === 'mirror') $peerMirrorId = $pid;
                        else $peerCanonical = true;
                    }
                    if ($channel === 'mirror' && $peerCanonical) {
                        /* همان گذار قبلاً از مسیر مرجع اعلام شده — پیام آینه تکرار است. */
                        $state['notifyAlignSuppressed'] = (int)($state['notifyAlignSuppressed'] ?? 0) + 1;
                        continue;
                    }
                    if ($channel === 'canonical' && $peerMirrorId !== null && !$peerCanonical) {
                        $pj = $state['jobs'][$peerMirrorId];
                        $pst = (string)($pj['status'] ?? '');
                        if ($pst === 'pending') {
                            /* آینه هنوز نرفته: با متن دقیق‌ترِ مرجع جایگزین می‌شود. */
                            unset($state['jobs'][$peerMirrorId]);
                        } elseif (in_array($pst, ['sending', 'sent'], true)) {
                            /* آینه همین حالا/لحظهٔ پیش رفت — پیام دوم تکرار است. */
                            $state['notifyAlignSuppressed'] = (int)($state['notifyAlignSuppressed'] ?? 0) + 1;
                            continue;
                        }
                    }
                }
                if (isset($state['jobs'][$event['id']])) continue;
                $state['jobs'][$event['id']] = $event + ['status'=>'pending', 'attempts'=>0, 'nextAttemptAt'=>0];
                if ($key !== '') $byKey[$key][] = $event['id'];
            }
            /* Keep 2000 terminal dedup markers; never prune undelivered events. */
            $terminal = [];
            foreach ($state['jobs'] as $id => $job) if (in_array($job['status'] ?? '', ['sent', 'cancelled'], true)) $terminal[] = $id;
            foreach (array_slice($terminal, 0, max(0, count($terminal) - 2000)) as $id) unset($state['jobs'][$id]);
        });
        if ($events) ptf_rfq_notify_schedule($dir);
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
/* ═══ v34.39.63 (BOT-MSG-P2-8 — نرخ و تراکم) ═══
   پیش از این فاصلهٔ ثابت ۳ ثانیه بود (۱ پیام در هر ۳ ثانیه) و هر فراخوانی فقط
   یک پیام برمی‌داشت؛ در FPM یعنی هر پاسخِ کاربر یک پیام و بقیه فقط با cron. بدون
   cron، پیام‌های دوم به بعد ساعت‌ها معلق می‌ماندند و ترتیب/تازگی به هم می‌ریخت.
   حالا «سطل توکن»: ظرفیت ۵ توکن و شارژ ۲۰ در دقیقه — همان سقف گروهی تلگرام، ولی
   با اجازهٔ burst تا ۵ پیام. صف می‌تواند در یک فراخوانی چند پیام را خالی کند. */
function ptf_rfq_notify_rate_take(array &$state, int $now): bool {
    $cap = 5.0; $perMinute = 20.0;
    $rate = is_array($state['rate'] ?? null) ? $state['rate'] : [];
    $tokens = isset($rate['tokens']) ? (float)$rate['tokens'] : $cap;
    $at = (int)($rate['at'] ?? 0);
    if ($at <= 0) { $tokens = $cap; $at = $now; }
    if ($now > $at) $tokens = min($cap, $tokens + ($now - $at) * ($perMinute / 60.0));
    if ($tokens < 1.0) { $state['rate'] = ['tokens' => $tokens, 'at' => $now]; return false; }
    $state['rate'] = ['tokens' => $tokens - 1.0, 'at' => $now];
    return true;
}
/* ═══ v34.39.63 (BOT-MSG-P2-7 — TTL صف) ═══
   پیامی که سه روز در صف مانده، امروز با متن و تاریخ خودش می‌رفت («زمان: ۲۰۲۶-۱۰-۲۱»)
   و حس «پیام بی‌ربط/قدیمی» می‌ساخت. حالا دو آستانه (قابل تنظیم در bot-config.php):
   rfq_stale_after (پیش‌فرض ۳۰ دقیقه) ⇒ پیام با خط «⏳ با تأخیر ارسال می‌شود» می‌رود؛
   rfq_expire_after (پیش‌فرض ۶ ساعت) ⇒ هرگز به گروه نمی‌رود و فقط شمرده می‌شود. */
function ptf_rfq_notify_ttl(): array {
    $cfg = ptf_rfq_notify_cfg() ?: [];
    $stale = isset($cfg['rfq_stale_after']) && is_numeric($cfg['rfq_stale_after']) ? (int)$cfg['rfq_stale_after'] : 1800;
    $expire = isset($cfg['rfq_expire_after']) && is_numeric($cfg['rfq_expire_after']) ? (int)$cfg['rfq_expire_after'] : 21600;
    if ($stale < 0) $stale = 0;
    if ($expire > 0 && $expire < $stale) $expire = $stale;
    return ['stale' => $stale, 'expire' => $expire];
}
function ptf_rfq_notify_delay_notice(int $minutes): string {
    if ($minutes < 1) return '';
    if ($minutes < 60) return '⏳ این پیام با تأخیر ارسال می‌شود (حدود ' . $minutes . ' دقیقه پیش ساخته شده بود)';
    $hours = (int)floor($minutes / 60);
    return '⏳ این پیام با تأخیر ارسال می‌شود (حدود ' . $hours . ' ساعت پیش ساخته شده بود)';
}
function ptf_rfq_notify_schedule(string $dir): void {
    if (PHP_SAPI === 'cli') return; /* CLI worker/test explicitly controls delivery. */
    if (isset($GLOBALS['ptf_rfq_notify_scheduled'][$dir])) return;
    $GLOBALS['ptf_rfq_notify_scheduled'][$dir] = true;
    register_shutdown_function(function () use ($dir) {
        /* FPM releases the HTTP response before external I/O. Other SAPIs retain
           the committed result; Telegram failure cannot roll back the RFQ. */
        if (function_exists('fastcgi_finish_request')) @fastcgi_finish_request();
        /* v34.39.63: تا ۳ پیام در همان پاسخ (سطل توکن اجازه می‌دهد) — بدون cron هم
           صف به‌جای ماندن تا ساعت‌ها، در ترافیک عادی خالی می‌شود. */
        ptf_rfq_notify_flush($dir, 3);
    });
}
/* $maxJobs: چند پیام در همین فراخوانی حداکثر تلاش شود (سطل توکن سقف را نگه می‌دارد).
   فاز ۱ = انتخاب و مهر «sending» زیر قفل؛ فاز ۲ = I/O بدون قفل؛ فاز ۳ = ثبت نتیجه. */
function ptf_rfq_notify_flush(?string $dir = null, int $maxJobs = 1): array {
    $dir = $dir ?? ptf_rfq_notify_dir();
    if (!ptf_rfq_notify_enabled() || !is_dir($dir)) return ['sent'=>0];
    $channel = ptf_rfq_notify_channel();
    if (!$channel) return ['sent'=>0, 'error'=>'no_channel'];
    ptf_rfq_notify_recover($dir);
    if (!is_file($dir . '/.rfq-notify.json')) return ['sent'=>0];
    $maxJobs = max(1, min(20, $maxJobs));
    $delivery = @fopen($dir . '/.rfq-notify-delivery.lock', 'c+');
    if (!$delivery || !flock($delivery, LOCK_EX | LOCK_NB)) {
        if (is_resource($delivery)) fclose($delivery);
        return ['sent'=>0, 'busy'=>true];
    }
    $sent = 0; $attempted = 0; $error = ''; $retryable = false; $expired = 0;
    try {
        $ttl = ptf_rfq_notify_ttl();
        for ($n = 0; $n < $maxJobs; $n++) {
            $now = time();
            $job = ptf_rfq_notify_store($dir, function (&$state) use ($now, $ttl, &$expired) {
                foreach ($state['jobs'] as &$row) {
                    if (($row['status'] ?? '') === 'sending' && (int)($row['claimedAt'] ?? 0) + 90 < $now) {
                        /* Telegram has no idempotency key: a crashed/ambiguous send is
                           not auto-retried, since it may already exist in the group. */
                        $row['status'] = 'uncertain'; $row['error'] = 'worker_interrupted';
                    }
                } unset($row);
                if ((int)($state['nextSendAt'] ?? 0) > $now) return null;
                /* ① انقضای کهنه‌ها (بدون ارسال) و انتخاب اولین پیام سزامانت */
                $selectedId = null; $age = 0;
                foreach ($state['jobs'] as $jid => $row) {
                    if (($row['status'] ?? '') !== 'pending') continue;
                    if ((int)($row['nextAttemptAt'] ?? 0) > $now) continue;
                    $age = $now - (int)($row['createdAt'] ?? $now);
                    if ($ttl['expire'] > 0 && $age > $ttl['expire']) {
                        $state['jobs'][$jid]['status'] = 'cancelled';
                        $state['jobs'][$jid]['error'] = 'expired_stale';
                        $state['jobs'][$jid]['expiredAt'] = $now;
                        unset($state['jobs'][$jid]['text']);
                        $state['notifyDiag']['expired'] = (int)($state['notifyDiag']['expired'] ?? 0) + 1;
                        $expired++;
                        continue;
                    }
                    $selectedId = $jid; break;
                }
                if ($selectedId === null) return null;
                /* ② سطل توکن: نرخ پایدار ۲۰ در دقیقه، burst تا ۵ */
                if (!ptf_rfq_notify_rate_take($state, $now)) return null;
                $row =& $state['jobs'][$selectedId];
                $row['status'] = 'sending'; $row['claimedAt'] = $now;
                $row['attempts'] = (int)($row['attempts'] ?? 0) + 1;
                if ($ttl['stale'] > 0 && $age > $ttl['stale']) $row['staleMinutes'] = (int)floor($age / 60);
                $selected = $row; unset($row);
                return $selected;
            });
            if (!$job) break;
            $attempted++;
            $text = (string)$job['text'];
            if (!empty($job['staleMinutes'])) {
                $notice = ptf_rfq_notify_delay_notice((int)$job['staleMinutes']);
                if ($notice !== '') $text = $notice . "\n\n" . $text;
            }
            $http = 0; $errno = 0; $response = false;
            try {
                if (!function_exists('curl_init')) throw new RuntimeException('curl_unavailable');
                $base = $channel['app'] === 'bale' ? 'https://tapi.bale.ai/bot' : 'https://api.telegram.org/bot';
                $ch = curl_init($base . $channel['token'] . '/sendMessage');
                curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER=>true, CURLOPT_POST=>true, CURLOPT_CONNECTTIMEOUT=>3,
                    CURLOPT_TIMEOUT=>6, CURLOPT_SSL_VERIFYPEER=>true, CURLOPT_HTTPHEADER=>['Content-Type: application/json'],
                    CURLOPT_POSTFIELDS=>json_encode(['chat_id'=>$channel['chat'], 'text'=>$text, 'disable_web_page_preview'=>true], JSON_UNESCAPED_UNICODE)]);
                $response = curl_exec($ch); $http = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE); $errno = curl_errno($ch); curl_close($ch);
            } catch (Throwable $e) { $errno = -1; }
            $reply = is_string($response) ? json_decode($response, true) : null;
            $ok = $http >= 200 && $http < 300 && is_array($reply) && ($reply['ok'] ?? false) === true;
            $rejected = is_array($reply) && ($reply['ok'] ?? null) === false;
            $retryable = $rejected || in_array($errno, [-1, 5, 6, 7, 35, 60], true);
            $retryAfter = $http === 429 || (int)($reply['error_code'] ?? 0) === 429 ? max(3, min(86400, (int)($reply['parameters']['retry_after'] ?? 60))) : min(3600, 30 * (2 ** min(7, (int)$job['attempts'])));
            ptf_rfq_notify_store($dir, function (&$state) use ($job, $ok, $retryable, $retryAfter, $reply, $http) {
                if (!isset($state['jobs'][$job['id']])) return;
                $row =& $state['jobs'][$job['id']];
                if ($ok) {
                    $row['status'] = 'sent'; $row['sentAt'] = time(); $row['messageId'] = $reply['result']['message_id'] ?? null;
                    unset($row['text'], $row['error'], $row['staleMinutes']);
                } elseif ($retryable && (int)$row['attempts'] < 8) {
                    $row['status'] = 'pending'; $row['nextAttemptAt'] = time() + $retryAfter;
                    $row['error'] = 'telegram_rejected_' . (int)($reply['error_code'] ?? $http);
                    if ((int)($reply['error_code'] ?? $http) === 429) $state['nextSendAt'] = max((int)($state['nextSendAt'] ?? 0), $row['nextAttemptAt']);
                } else {
                    $row['status'] = $retryable ? 'failed' : 'uncertain';
                    $row['error'] = $retryable ? 'retry_limit' : 'delivery_unconfirmed';
                }
            });
            if ($ok) $sent++; else {
                error_log('PTF RFQ Telegram: delivery not confirmed; event=' . substr($job['id'], 0, 12) . '; http=' . $http . '; errno=' . $errno);
                break; /* در خطا بیشتر نمی‌کشیم؛ فراخوانی/کران بعدی */
            }
        }
        $out = ['sent'=>$sent, 'attempted'=>$attempted, 'retryable'=>$retryable];
        if ($expired) $out['expired'] = $expired;
        return $out;
    } catch (Throwable $e) {
        error_log('PTF RFQ Telegram: outbox delivery failed');
        return ['sent'=>$sent, 'error'=>'outbox_delivery_failed'];
    } finally { flock($delivery, LOCK_UN); fclose($delivery); }
}
function ptf_rfq_notify_counts(?string $dir = null): array {
    $file = ($dir ?? ptf_rfq_notify_dir()) . '/.rfq-notify.json';
    $state = is_file($file) ? json_decode((string)@file_get_contents($file), true) : ['jobs'=>[]];
    if (!is_array($state) || !is_array($state['jobs'] ?? null)) throw new RuntimeException('rfq_outbox_invalid');
    $counts = ['pending'=>0, 'sending'=>0, 'sent'=>0, 'uncertain'=>0, 'failed'=>0, 'cancelled'=>0,
        'recoveryPending'=>count(glob(dirname($file) . '/.rfq-notify-recover-*.json') ?: [])];
    /* ═══ v34.39.63 (BOT-MSG-P2-8): «صف خالی نمی‌شود» باید دیده شود ═══
       اگر cron نصب نباشد، پیام‌ها در صف می‌مانند و هیچ‌کس نمی‌فهمد چرا دیر می‌رسند.
       oldestPendingAge سنِ قدیمی‌ترین پیام در انتظار است. */
    $oldest = 0;
    foreach (($state['jobs'] ?? []) as $job) {
        $s = (string)($job['status'] ?? ''); if (isset($counts[$s])) $counts[$s]++;
        if ($s === 'pending') {
            $stamp = (int)($job['createdAt'] ?? 0);
            if ($stamp > 0 && ($oldest === 0 || $stamp < $oldest)) $oldest = $stamp;
        }
    }
    $counts['oldestPendingAge'] = $oldest > 0 ? max(0, time() - $oldest) : 0;
    /* v34.39.59: چند پیام آینه با پیام مرجع یکی شد (قابل مشاهده برای پایش دقت) */
    $counts['alignSuppressed'] = (int)($state['notifyAlignSuppressed'] ?? 0);
    /* v34.39.61 (BOT-MSG-P1-4): چند تغییر واقعی به‌خاطر شناسهٔ تکراری پیام نساخت
       (حدس ممنوع) — تا کاربر بداند عمداً ساکت مانده‌ایم، نه اینکه پیام گم شده باشد. */
    $counts['ambiguousRows'] = (int)($state['notifyDiag']['ambiguousRows'] ?? 0);
    /* v34.39.63 (BOT-MSG-P2-7): پیام‌هایی که به‌خاطر کهنگی هرگز به گروه نرفتند */
    $counts['expired'] = (int)($state['notifyDiag']['expired'] ?? 0);
    $channel = ptf_rfq_notify_channel();
    $counts['channel'] = $channel ? $channel['app'] : '';
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
