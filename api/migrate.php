<?php
/**
 * PTF CRM — migrate.php — DB-MIG-001 (فاز A) — v33.17.0
 * مهاجرت داده‌ها از فایل‌های JSON به MySQL — اجرا از مرورگر (بدون نیاز به ترمینال).
 *
 * نحوهٔ استفاده (راهنمای کامل فارسی: crm/MIGRATION-MYSQL-CPANEL-GUIDE-FA.md):
 *  ۱. فایل را در پوشهٔ api/ آپلود کنید (File Manager سی‌پنل → public_html/api)
 *  ۲. در مرورگر باز کنید: https://دامنه‌شما/api/migrate.php
 *  ۳. مراحل را به ترتیب و با دکمه‌های فارسی انجام دهید.
 *  ۴. در پایان، خود اسکریپت راهنمای حذف امن را نشان می‌دهد.
 *
 * امنیت:
 *  - گام‌های حساس نیاز به تایپ کلمهٔ «مهاجرت» دارند.
 *  - رمز دیتابیس فقط در api/ptf-db-config.php (PHP بدون خروجی) ذخیره می‌شود.
 *  - فایل‌های JSON هرگز حذف نمی‌شوند؛ قبل از مهاجرت، بکاپ اضطراری ساخته می‌شود.
 *  - پس از اتمام، اسکریپت قفل می‌شود و باید از سرور حذف شود.
 */

if (php_sapi_name() === 'cli') { echo "این فایل فقط از مرورگر اجرا می‌شود.\n"; exit; }

require_once __DIR__ . '/db-lib.php';

header('Content-Type: text/html; charset=utf-8');
header('X-Robots-Tag: noindex');

$data_dir = __DIR__ . '/../crm/data';
if (!is_dir($data_dir)) { @mkdir($data_dir, 0755, true); }

$cfg = ptf_db_config();
$step = $_POST['step'] ?? $_GET['step'] ?? 'start';

function h($s) { return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }
function fa_ok($s) { return '<div style="background:#ecfdf5;border:1px solid #a7f3d0;color:#065f46;border-radius:10px;padding:10px 14px;margin:10px 0;font-size:14px">✅ ' . $s . '</div>'; }
function fa_err($s) { return '<div style="background:#fef2f2;border:1px solid #fecaca;color:#991b1b;border-radius:10px;padding:10px 14px;margin:10px 0;font-size:14px">⛔ ' . $s . '</div>'; }
function fa_warn($s) { return '<div style="background:#fffbeb;border:1px solid #fde68a;color:#92400e;border-radius:10px;padding:10px 14px;margin:10px 0;font-size:14px">⚠️ ' . $s . '</div>'; }

/* ===== v33.22.1 — بازنشانی وضعیت مهاجرت (خودسرویس؛ قبل از گارد سوییچ) =====
   سناریو: مهاجرت قبلاً سوییچ شده (mode=mysql) ولی لازم است مراحل دوباره اجرا شوند — مثلاً
   تازه‌سازی دیتابیس از روی فایل‌های فعلی (کلیدهای سینک که تا v33.22.0 فایل‌محور بودند و در DB
   کهنه‌اند). این گام فقط mode را به off برمی‌گرداند؛ هیچ داده‌ای (فایل/دیتابیس) پاک نمی‌شود.
   همچنین راه‌حل مشکل OPcache است: ویرایش دستی ptf-db-config.php ممکن است تا انقضای کش اثر نکند،
   ولی این دکمه از مسیر ptf_db_save_config می‌نویسد و کش را در همان لحظه باطل می‌کند. */
if ($step === 'reset_mode') {
    page_header('مهاجرت به MySQL');
    if (!$cfg || ($cfg['mode'] ?? 'off') !== 'mysql') { echo fa_err('بازنشانی فقط وقتی معنا دارد که مهاجرت قبلاً سوییچ شده باشد (mode=mysql).'); page_footer(); exit; }
    require_token();
    if (trim($_POST['confirm_word'] ?? '') !== 'بازنشانی') { echo fa_err('کلمهٔ تأیید اشتباه است — چیزی تغییر نکرد. برای ادامه دقیقاً کلمهٔ «بازنشانی» را تایپ کنید.'); page_footer(); exit; }
    $cfg['mode'] = 'off';
    $cfg['reset_at'] = date('Y-m-d H:i:s');
    if (!ptf_db_save_config($cfg)) { echo fa_err('ذخیرهٔ پیکربندی ممکن نشد — دسترسی نوشتن در پوشهٔ api/ را بررسی کنید.'); page_footer(); exit; }
    echo fa_ok('بازنشانی انجام شد — وضعیت به «هنوز فعال نشده (off)» برگشت. هیچ داده‌ای (فایل یا دیتابیس) پاک نشد؛ فقط خواندن دوباره از فایل‌ها انجام می‌شود.');
    echo fa_warn('حالا مراحل ۱ تا ۶ را به همان ترتیب اجرا کنید تا دیتابیس از روی فایل‌های فعلی تازه شود: بکاپ اضطراری ← ساخت جدول ← انتقال داده ← بررسی تطابق ← نوشتن همزمان ← سوییچ نهایی.');
    echo '<div style="display:flex;flex-wrap:wrap;gap:8px;margin:12px 0">' . btn('شروع: ۱) بکاپ اضطراری', 'backup') . btn('نمایش همهٔ مراحل', 'start') . '</div>';
    page_footer();
    exit;
}

/* ===== v33.17.1 — گارد امنیتی پس از سوییچ نهایی =====
   اگر مهاجرت کامل شده باشد (mode=mysql)، این اسکریپت دیگر هیچ عملیاتی انجام نمی‌دهد
   و فقط یادآوری حذف فایل + امکان بازنشانی خودسرویس (v33.22.1) را نشان می‌دهد. این گارد
   تضمین می‌کند حتی اگر فایل پس از مرج/دیپلوی دوباره روی سرور قرار گیرد، هرگز مهاجرت
   ناخواسته اجرا نمی‌شود. */
if ($cfg && ($cfg['mode'] ?? 'off') === 'mysql') {
    page_header('مهاجرت به MySQL');
    echo fa_ok('مهاجرت قبلاً با موفقیت کامل شده است و دیتابیس منبع حقیقت است.');
    /* v33.22.1: تشخیص‌گر وضعیت — اگر فایل کانفیگ را دستی ویرایش کرده‌اید ولی اینجا هنوز mysql
       دیده می‌شود، زمان آخرین تغییر فایل علت را مشخص می‌کند (ویرایش به فایل دیگری خورده یا OPcache). */
    $__cp = ptf_db_config_path(); @clearstatcache(true, $__cp);
    $__mt = file_exists($__cp) ? @filemtime($__cp) : false;
    echo '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px;margin:12px 0;font-size:12px;color:#64748b">'
        . 'وضعیت خوانده‌شده از کانفیگ: <b style="direction:ltr">mode = ' . h($cfg['mode'] ?? '?') . '</b>'
        . ' &nbsp;|&nbsp; فایل: <span style="direction:ltr">api/ptf-db-config.php</span>'
        . ' &nbsp;|&nbsp; آخرین تغییر فایل: <b style="direction:ltr">' . ($__mt ? h(date('Y-m-d H:i:s', $__mt)) : '—') . '</b>'
        . (!empty($cfg['switched_at']) ? ' &nbsp;|&nbsp; زمان سوییچ قبلی: <b style="direction:ltr">' . h($cfg['switched_at']) . '</b>' : '')
        . '</div>';
    echo fa_warn('برای اجرای دوبارهٔ مراحل (تازه‌سازی دیتابیس از روی فایل‌های فعلی) کلمهٔ «بازنشانی» را تایپ کنید — این کار فقط قفل این صفحه را باز می‌کند و هیچ داده‌ای پاک نمی‌شود:'
        . '<form method="post" style="margin-top:8px"><input type="hidden" name="step" value="reset_mode">'
        . (!empty($cfg['mig_token']) ? '<input type="hidden" name="mig_token" value="' . h($cfg['mig_token']) . '">' : '')
        . '<input type="text" name="confirm_word" placeholder="بازنشانی" style="padding:9px;border:1px solid #cbd5e1;border-radius:8px;direction:rtl" required>'
        . ' <button type="submit" style="background:#b45309;color:#fff;border:0;border-radius:10px;padding:10px 16px;font-size:14px;cursor:pointer;font-family:inherit">↩ بازنشانی وضعیت مهاجرت</button></form>');
    echo fa_warn('در حالت عادی (بدون نیاز به اجرای دوباره) این فایل موردی ندارد و برای امنیت باید از سرور حذف شود: File Manager → پوشهٔ api → فایل migrate.php → حذف. توجه: با هر دیپلوی جدید دوباره آپلود می‌شود و همین گارد آن را بی‌اثر نگه می‌دارد.');
    page_footer();
    exit;
}

function page_header($title) {
    echo '<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' . h($title) . '</title></head><body style="font-family:Tahoma,Vazirmatn,sans-serif;background:#f1f5f9;margin:0;padding:20px">';
    echo '<div style="max-width:760px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:22px 26px">';
    echo '<h1 style="font-size:19px;color:#0f172a;margin:0 0 4px">🗄 مهاجرت داده به دیتابیس (MySQL)</h1>';
    echo '<div style="font-size:13px;color:#64748b;margin-bottom:16px">سامانهٔ مدیریت پیشرو تجهیز فرتاک — مرحله‌ای و با نهایت امنیت</div>';
}
function page_footer() {
    echo '<div style="margin-top:20px;border-top:1px dashed #cbd5e1;padding-top:10px;font-size:12px;color:#94a3b8">در هر مرحله اگر خطایی دیدید، چیزی تغییر نمی‌کند و دادهٔ قبلی سالم می‌ماند. برای راهنمای کامل: سند MIGRATION-MYSQL-CPANEL-GUIDE-FA.md</div>';
    echo '</div></body></html>';
}
function btn($label, $step, $extra = '') {
    $t = '';
    $c = ptf_db_config();
    if ($c && !empty($c['mig_token'])) $t = '<input type="hidden" name="mig_token" value="' . h($c['mig_token']) . '">';
    return '<form method="post" style="display:inline;margin-left:6px">' . $t . '<input type="hidden" name="step" value="' . h($step) . '">' . $extra . '<button type="submit" style="background:#0e7490;color:#fff;border:0;border-radius:10px;padding:10px 16px;font-size:14px;cursor:pointer;font-family:inherit">' . $label . '</button></form>';
}
function token_ok() {
    $c = ptf_db_config();
    if (!$c || empty($c['mig_token'])) return false;
    return hash_equals((string)$c['mig_token'], (string)($_POST['mig_token'] ?? ''));
}
function require_token() {
    if (!token_ok()) { echo fa_err('توکن امنیتی نامعتبر است — صفحه را تازه‌سازی کنید و دوباره از ابتدا شروع کنید.'); page_footer(); exit; }
}

/* جمع‌آوری کلیدهای JSON (منبع: crm/data/*.json سپس crm/data/sync/*.json) */
function mig_keys() {
    global $data_dir;
    $out = [];
    $seen = [];
    foreach (['', 'sync'] as $sub) {
        $d = $sub ? ($data_dir . '/' . $sub) : $data_dir;
        if (!is_dir($d)) continue;
        foreach (glob($d . '/*.json') ?: [] as $f) {
            $k = basename($f, '.json');
            if (in_array($k, ['otp', 'ratelimit'], true)) continue; /* کلیدهای جانبی — طبق طرح در فایل می‌مانند */
            if (isset($seen[$k])) continue; /* اولویت با data/ */
            $seen[$k] = 1;
            $out[] = ['key' => $k, 'file' => $f];
        }
    }
    sort($out);
    return $out;
}

/* v33.22.3 (P1-ATTACH-STALE-DB): کلیدهای فرّارِ عمداً فایل‌محور — از «مقایسهٔ تطابق» کنار گذاشته می‌شوند.
   meta = دفتر rev سینک (طرح: همیشه فایل‌محور و با هر push عوض می‌شود) و tokens = نشست‌های ورود
   (با هر ورود/خروج تغییر می‌کند). پیش از این، همین دو کلید باعث می‌شدند «بررسی تطابق» روی سامانهٔ
   زنده همیشه یک مغایرت نشان دهد و کاربر با تصور «عادی بودن مغایرت» سوییچ را با DB کهنه جلو ببرد —
   زمینه‌ساز رخداد «ناپدید شدن ضمایم/رکوردهای تازه».
   v33.22.4 (UR-2026-08-03-31): fx-cache به همین فهرست پیوست — کش ۱۰‌دقیقه‌ای نرخ ارز
   (api/fx-rates.php → crm/data/fx-cache.json) که فقط و مستقیم در فایل بازنویسی می‌شود؛
   نه نوشتن DB دارد و نه هیچ خوانندهٔ DB‌ای. پس هر تازه‌سازی نرخ = یک «مغایرت کاذب» در
   مرحلهٔ ۴ ویزارد و بخش ۱۱ health-check (دقیقاً همان کلاس meta/tokens). خطا صرفاً مانیتورینگ
   بود؛ ۵۳ کلید دیگر یکسان و داده سالم است — رفع = استثنا از مقایسه‌ها، بدون تغییر کلاینت/mode. */
function mig_compare_excluded() { return ['meta', 'tokens', 'fx-cache']; }

/* مقایسهٔ یک کلید بین فایل و دیتابیس (چک‌سام + تعداد رکورد + بایت) */
function mig_compare_row($item) {
    $raw = @file_get_contents($item['file']);
    $dbv = ptf_db_get($item['key']);
    $jChecksum = ptf_db_checksum($raw === false ? '' : $raw);
    $dChecksum = ptf_db_checksum($dbv === null ? '' : $dbv);
    $jArr = json_decode($raw === false ? '' : ($raw ?: '[]'), true);
    $dArr = json_decode($dbv === null ? '' : ($dbv ?: '[]'), true);
    $jCount = is_array($jArr) ? count($jArr) : -1;
    $dCount = is_array($dArr) ? count($dArr) : -1;
    return [
        'same'    => ($jChecksum === $dChecksum) && ($jCount === $dCount),
        'jCount'  => $jCount, 'dCount' => $dCount,
        'jBytes'  => ($raw === false) ? -1 : strlen($raw),
        'dBytes'  => ($dbv === null) ? -1 : strlen($dbv),
        'inDb'    => ($dbv !== null),
    ];
}

/* بکاپ اضطراری (کپی کامل به پوشهٔ زمان‌دار) */
function mig_emergency_backup() {
    global $data_dir;
    $ts = date('Ymd-His');
    $dest = $data_dir . '/backups/pre-mysql-' . $ts;
    if (!is_dir($dest)) { @mkdir($dest, 0755, true); @mkdir($dest . '/sync', 0755, true); }
    $n = 0;
    foreach (mig_keys() as $item) {
        $rel = strpos($item['file'], '/sync/') !== false ? 'sync/' . basename($item['file']) : basename($item['file']);
        if (@copy($item['file'], $dest . '/' . $rel)) $n++;
    }
    return ['dir' => $dest, 'count' => $n];
}

/* ================= گام‌ها ================= */

page_header('مهاجرت به MySQL');

if ($step === 'start') {
    if (!$cfg) {
        echo fa_warn('هنوز اتصال دیتابیس تنظیم نشده است. ابتدا اطلاعات دیتابیسی را که در سی‌پنل ساخته‌اید وارد کنید (راهنمای ساخت دیتابیس در سند MIGRATION-MYSQL-CPANEL-GUIDE-FA.md).');
        echo '<form method="post" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px">';
        echo '<input type="hidden" name="step" value="connect">';
        echo '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">';
        echo '<div><label style="font-size:13px;display:block;margin-bottom:4px">هاست دیتابیس</label><input name="db_host" value="localhost" style="width:100%;padding:9px;border:1px solid #cbd5e1;border-radius:8px;direction:ltr" required></div>';
        echo '<div><label style="font-size:13px;display:block;margin-bottom:4px">پورت (معمولاً 3306)</label><input name="db_port" value="3306" style="width:100%;padding:9px;border:1px solid #cbd5e1;border-radius:8px;direction:ltr"></div>';
        echo '<div><label style="font-size:13px;display:block;margin-bottom:4px">نام دیتابیس (مثلاً نامی که در سی‌پنل ساختید)</label><input name="db_name" style="width:100%;padding:9px;border:1px solid #cbd5e1;border-radius:8px;direction:ltr" required></div>';
        echo '<div><label style="font-size:13px;display:block;margin-bottom:4px">نام کاربری دیتابیس</label><input name="db_user" style="width:100%;padding:9px;border:1px solid #cbd5e1;border-radius:8px;direction:ltr" required></div>';
        echo '<div style="grid-column:1/-1"><label style="font-size:13px;display:block;margin-bottom:4px">رمز عبور دیتابیس</label><input type="password" name="db_pass" style="width:100%;padding:9px;border:1px solid #cbd5e1;border-radius:8px;direction:ltr" required></div>';
        echo '<div><label style="font-size:13px;display:block;margin-bottom:4px">نام جدول (پیش‌فرض ptf_kv — نیازی به تغییر نیست)</label><input name="db_table" value="ptf_kv" style="width:100%;padding:9px;border:1px solid #cbd5e1;border-radius:8px;direction:ltr"></div>';
        echo '</div>';
        echo '<div style="margin-top:14px"><button type="submit" style="background:#059669;color:#fff;border:0;border-radius:10px;padding:11px 20px;font-size:15px;cursor:pointer;font-family:inherit">🔌 تست اتصال و ادامه</button></div>';
        echo '</form>';
    } else {
        $mode = $cfg['mode'] ?? 'off';
        echo fa_ok('پیکربندی دیتابیس موجود است. وضعیت فعلی: ' . ($mode === 'mysql' ? 'دیتابیس فعال (منبع حقیقت)' : ($mode === 'dual' ? 'نوشتن همزمان (دورهٔ مهاجرت)' : 'هنوز فعال نشده')));
        echo '<div style="display:flex;flex-wrap:wrap;gap:8px;margin:12px 0">';
        echo btn('۱) بکاپ اضطراری از دادهٔ فعلی', 'backup');
        echo btn('۲) ساخت جدول در دیتابیس', 'schema');
        echo btn('۳) انتقال داده به دیتابیس', 'migrate');
        echo btn('۴) بررسی تطابق (چک‌سام)', 'verify');
        echo btn('۵) فعال‌سازی نوشتن همزمان (دورهٔ مهاجرت)', 'enable_dual');
        echo btn('۶) سوییچ نهایی به دیتابیس', 'switch_final');
        echo '</div>';
        echo fa_warn('ترتیب مراحل را رعایت کنید (۱ ← ۲ ← ۳ ← ۴ ← ۵ ← ۶). هر مرحله فقط بعد از موفقیت مرحلهٔ قبل انجام شود.');
    }
}

elseif ($step === 'connect') {
    $host = trim($_POST['db_host'] ?? 'localhost');
    $port = (int)($_POST['db_port'] ?? 3306);
    $name = trim($_POST['db_name'] ?? '');
    $user = trim($_POST['db_user'] ?? '');
    $pass = (string)($_POST['db_pass'] ?? '');
    $table = preg_replace('/[^A-Za-z0-9_]/', '', $_POST['db_table'] ?? 'ptf_kv') ?: 'ptf_kv';
    if ($name === '' || $user === '') { echo fa_err('نام دیتابیس و نام کاربری الزامی است.'); page_footer(); exit; }
    /* تست اتصال بدون ذخیره */
    $test = @mysqli_connect($host, $user, $pass, $name, $port);
    if (!$test) { echo fa_err('اتصال برقرار نشد. خطا: ' . h(mysqli_connect_error()) . ' — نام دیتابیس، کاربر یا رمز را بررسی کنید (در سی‌پنل: بخش MySQL Databases).'); page_footer(); exit; }
    @mysqli_set_charset($test, 'utf8mb4');
    mysqli_close($test);
    /* ذخیرهٔ کانفیگ با توکن تصادفی */
    $token = bin2hex(random_bytes(16));
    $ok = ptf_db_save_config([
        'db_host' => $host, 'db_port' => $port, 'db_name' => $name,
        'db_user' => $user, 'db_pass' => $pass, 'db_table' => $table,
        'mode' => 'off', 'mig_token' => $token, 'created_at' => date('Y-m-d H:i:s'),
    ]);
    if (!$ok) { echo fa_err('ذخیرهٔ پیکربندی ممکن نشد — دسترسی نوشتن در پوشهٔ api/ را بررسی کنید.'); page_footer(); exit; }
    echo fa_ok('اتصال با موفقیت برقرار شد و پیکربندی ذخیره گردید.');
    echo '<div style="display:flex;flex-wrap:wrap;gap:8px;margin:12px 0">' . btn('ادامه: بکاپ اضطراری (مرحله ۱)', 'backup') . '</div>';
}

elseif ($step === 'backup') {
    require_token();
    $r = mig_emergency_backup();
    echo fa_ok('بکاپ اضطراری ساخته شد: ' . $r['count'] . ' فایل در پوشهٔ «' . h(str_replace($data_dir, 'crm/data', $r['dir'])) . '» — در صورت هر خطا، دادهٔ قبلی از همین‌جا قابل بازیابی است.');
    echo '<div style="display:flex;flex-wrap:wrap;gap:8px;margin:12px 0">' . btn('ادامه: ساخت جدول (مرحله ۲)', 'schema') . '</div>';
}

elseif ($step === 'schema') {
    require_token();
    $m = ptf_db_connect();
    if (!$m) { echo fa_err('اتصال به دیتابیس برقرار نیست.'); page_footer(); exit; }
    $ok = mysqli_query($m, ptf_db_schema_sql());
    mysqli_close($m);
    if ($ok) { echo fa_ok('جدول «' . h(ptf_db_table()) . '» با موفقیت در دیتابیس ساخته شد (یا از قبل وجود داشت).'); echo '<div style="margin:12px 0">' . btn('ادامه: انتقال داده (مرحله ۳)', 'migrate') . '</div>'; }
    else { echo fa_err('ساخت جدول ناموفق بود: ' . h(mysqli_error($m))); page_footer(); exit; }
}

elseif ($step === 'migrate') {
    require_token();
    echo '<form method="post"><input type="hidden" name="step" value="migrate_go">' . (ptf_db_config() && !empty(ptf_db_config()['mig_token']) ? '<input type="hidden" name="mig_token" value="' . h(ptf_db_config()['mig_token']) . '">' : '');
    echo fa_warn('مرحلهٔ انتقال داده: برای تأیید، کلمهٔ «مهاجرت» را تایپ کنید (مثل تأیید بازگردانی).');
    echo '<input type="text" name="confirm_word" placeholder="مهاجرت" style="padding:9px;border:1px solid #cbd5e1;border-radius:8px;direction:rtl" required>';
    echo ' <button type="submit" style="background:#b45309;color:#fff;border:0;border-radius:10px;padding:10px 16px;font-size:14px;cursor:pointer;font-family:inherit">▶ انتقال داده</button></form>';
}

elseif ($step === 'migrate_go') {
    require_token();
    if (trim($_POST['confirm_word'] ?? '') !== 'مهاجرت') { echo fa_err('کلمهٔ تأیید اشتباه است — چیزی تغییر نکرد.'); page_footer(); exit; }
    /* v33.22.3 (P1-ATTACH-STALE-DB): انتقال دسته‌ای (ضد تایم‌اوت هاست اشتراکی).
       پیش‌تر همهٔ کلیدها در یک درخواست کپی می‌شدند و پیام نتیجه فقط «پایان حلقه» چاپ می‌شد؛
       اگر PHP وسط کار کشته می‌شد (محدودیت ۳۰ ثانیه)، کاربر هیچ پیامی نمی‌دید و نمی‌فهمید
       انتقال ناقص مانده — DB نیمه‌کهنه «منبع حقیقت» می‌شد. حالا هر درخواست حداکثر ۱۵ کلید را
       منتقل می‌کند، پیشرفت را شفاف نشان می‌دهد و دستهٔ بعد خودکار ادامه می‌یابد؛ نتیجهٔ
       نهایی (موفق/ناموفق هرکلید) همیشه دیده می‌شود. عمل idempotent است (INSERT … ON DUPLICATE
       KEY UPDATE) — اجرای دوباره همیشه امن است و دادهٔ قبلی پاک نمی‌شود. */
    @set_time_limit(120);
    $keys = mig_keys();
    $total = count($keys);
    $off = max(0, (int)($_POST['offset'] ?? 0));
    $BATCH = 15;
    $failList = array_values(array_filter(explode(',', (string)($_POST['fails'] ?? ''))));
    $m = ptf_db_connect();
    if (!$m) { echo fa_err('اتصال به دیتابیس برقرار نیست.'); page_footer(); exit; }
    /* اطمینان از وجود جدول */
    mysqli_query($m, ptf_db_schema_sql());
    mysqli_close($m);
    $slice = array_slice($keys, $off, $BATCH);
    $doneNow = 0;
    foreach ($slice as $item) {
        $raw = @file_get_contents($item['file']);
        if ($raw === false) { $failList[] = $item['key'] . ' (خوانده نشد)'; continue; }
        if (ptf_db_set($item['key'], $raw)) $doneNow++; else $failList[] = $item['key'];
    }
    $newOff = $off + count($slice);
    if ($newOff < $total) {
        echo fa_ok('انتقال دسته‌ای در حال انجام… ✅ ' . $doneNow . ' کلید این دسته | پیشرفت: <b style="direction:ltr">' . $newOff . ' / ' . $total . '</b>' . ($failList ? ' — ناموفق تاکنون: ' . h(implode('، ', $failList)) : ''));
        echo '<form id="migNext" method="post"><input type="hidden" name="step" value="migrate_go">'
            . '<input type="hidden" name="mig_token" value="' . h(ptf_db_config()['mig_token'] ?? '') . '">'
            . '<input type="hidden" name="confirm_word" value="مهاجرت">'
            . '<input type="hidden" name="offset" value="' . $newOff . '">'
            . '<input type="hidden" name="fails" value="' . h(implode(',', $failList)) . '">'
            . '<button type="submit" style="background:#0e7490;color:#fff;border:0;border-radius:10px;padding:10px 16px;font-size:14px;cursor:pointer;font-family:inherit">▶ ادامهٔ خودکار انتقال (' . $newOff . ' از ' . $total . ') — اگر متوقف شد کلیک کنید</button></form>';
        echo '<div style="font-size:12px;color:#64748b;margin-top:6px">لطفاً این صفحه را نبندید؛ انتقال به‌صورت خودکار ادامه می‌یابد.</div>';
        echo '<script>setTimeout(function(){var f=document.getElementById("migNext");if(f)f.submit();},400);</script>';
    } else {
        if (!$failList) {
            echo fa_ok('انتقال داده به‌طور کامل انجام شد: ' . $total . ' کلید با موفقیت به دیتابیس منتقل شد.');
        } else {
            echo fa_err('انتقال تمام شد ولی ' . count($failList) . ' کلید ناموفق بود: ' . h(implode('، ', $failList)) . ' — دادهٔ قبلی سالم است؛ مرحلهٔ ۳ را دوباره اجرا کنید (تکرار کاملاً امن و بدون حذف است) تا موارد ناموفق جبران شوند.');
        }
        echo '<div style="margin:12px 0">' . btn('ادامه: بررسی تطابق (مرحله ۴)', 'verify') . '</div>';
    }
}

elseif ($step === 'verify') {
    require_token();
    @set_time_limit(120);
    $keys = mig_keys();
    $excluded = mig_compare_excluded(); /* v33.22.3/v33.22.4: کلیدهای فرّارِ عمداً فایل‌محور (meta/tokens/fx-cache) از مقایسه مستثنا */
    $allOk = true;
    $rows = '';
    $cmpCount = 0;
    foreach ($keys as $item) {
        if (in_array($item['key'], $excluded, true)) {
            $rows .= '<tr style="border-bottom:1px solid #eef2f7;background:#f8fafc"><td style="padding:6px 8px;font-size:12px;direction:ltr;text-align:left">' . h($item['key']) . '</td><td style="padding:6px 8px;text-align:center"><span style="color:#64748b">ℹ️ فایل‌محورِ دائمی</span></td><td style="padding:6px 8px;text-align:center">—</td><td style="padding:6px 8px;text-align:center">—</td></tr>';
            continue;
        }
        $c = mig_compare_row($item);
        $cmpCount++;
        if (!$c['same']) $allOk = false;
        $rows .= '<tr style="border-bottom:1px solid #eef2f7"><td style="padding:6px 8px;font-size:12px;direction:ltr;text-align:left">' . h($item['key']) . '</td><td style="padding:6px 8px;text-align:center">' . ($c['same'] ? '<span style="color:#047857">✅ یکسان</span>' : '<span style="color:#dc2626">❌ مغایرت</span>' . (!$c['inDb'] ? ' <small>(در DB نیست)</small>' : '')) . '</td><td style="padding:6px 8px;text-align:center">' . $c['jCount'] . ' <small style="color:#94a3b8">(' . $c['jBytes'] . 'b)</small></td><td style="padding:6px 8px;text-align:center">' . $c['dCount'] . ' <small style="color:#94a3b8">(' . $c['dBytes'] . 'b)</small></td></tr>';
    }
    echo '<table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="background:#f8fafc"><th style="padding:8px;text-align:right">کلید</th><th>وضعیت</th><th>تعداد در فایل</th><th>تعداد در دیتابیس</th></tr></thead><tbody>' . $rows . '</tbody></table>';
    if ($allOk) {
        echo fa_ok('بررسی تطابق با موفقیت انجام شد — هر ' . $cmpCount . ' کلید داده بین فایل و دیتابیس یکسان‌اند.');
        echo '<div style="margin:12px 0">' . btn('ادامه: فعال‌سازی نوشتن همزمان (مرحله ۵)', 'enable_dual') . '</div>';
    } else {
        echo fa_err('مغایرت‌هایی یافت شد — چیزی تغییر نکرده و دادهٔ قبلی سالم است. از «بازگشت به مرحله ۳» انتقال را دوباره (به‌صورت دسته‌ای و امن) انجام دهید تا همه سبز شوند.');
        echo '<div style="margin:12px 0">' . btn('بازگشت: انتقال دوباره (مرحله ۳)', 'migrate') . '</div>';
        page_footer(); exit;
    }
}

elseif ($step === 'enable_dual') {
    require_token();
    $c = ptf_db_config();
    $c['mode'] = 'dual';
    $c['dual_enabled_at'] = date('Y-m-d H:i:s');
    ptf_db_save_config($c);
    echo fa_ok('نوشتن همزمان فعال شد: از این لحظه هر تغییری هم در فایل و هم در دیتابیس ثبت می‌شود. اگر خطایی پیش آید، فایل‌ها همچنان سالم‌اند.');
    echo fa_warn('حالا سیستم در «دورهٔ مهاجرت» است. چند روز با همین حالت کار کنید؛ اگر همه‌چیز درست بود، مرحلهٔ ۶ (سوییچ نهایی) را انجام دهید. تا آن زمان هیچ چیزی حذف نمی‌شود.');
    echo '<div style="margin:12px 0">' . btn('ادامه: سوییچ نهایی به دیتابیس (مرحله ۶)', 'switch_final') . '</div>';
}

elseif ($step === 'switch_final') {
    require_token();
    echo '<form method="post"><input type="hidden" name="step" value="switch_go">' . (ptf_db_config() && !empty(ptf_db_config()['mig_token']) ? '<input type="hidden" name="mig_token" value="' . h(ptf_db_config()['mig_token']) . '">' : '');
    echo fa_warn('سوییچ نهایی: از این لحظه دیتابیس «منبع حقیقت» می‌شود و سیستم از آن می‌خواند. فایل‌های JSON حذف نمی‌شوند (فقط به‌عنوان پشتیبان می‌مانند).');
    echo '<p style="font-size:14px">برای تأیید نهایی، کلمهٔ «مهاجرت» را تایپ کنید:</p>';
    echo '<input type="text" name="confirm_word" placeholder="مهاجرت" style="padding:9px;border:1px solid #cbd5e1;border-radius:8px;direction:rtl" required>';
    echo ' <button type="submit" style="background:#059669;color:#fff;border:0;border-radius:10px;padding:10px 16px;font-size:14px;cursor:pointer;font-family:inherit">✅ سوییچ نهایی</button></form>';
}

elseif ($step === 'switch_go') {
    require_token();
    if (trim($_POST['confirm_word'] ?? '') !== 'مهاجرت') { echo fa_err('کلمهٔ تأیید اشتباه است — چیزی تغییر نکرد.'); page_footer(); exit; }
    /* v33.22.3 (P1-ATTACH-STALE-DB — ریشه‌کن رخداد «ناپدید شدن ضمایم پس از سوییچ»):
       سوییچ نهایی بدون تطابق کامل فایل↔DB «ممنوع» است. پیش‌تر ترتیب مراحل فقط توصیه بود و
       گام سوییچ هیچ بررسی‌ای نمی‌کرد؛ اگر مرحلهٔ ۳/۴ رد شده یا نیمه‌کاره مانده بود، DB کهنه
       «منبع حقیقت» اعلام می‌شد و تمام خواندن‌ها به حالت چندروزِ قبل برمی‌گشتند (ضمایم جدید
       در رکوردها وجود نداشتند). حالا خودِ این گام، همان مقایسهٔ چک‌سام+تعداد را درون‌خط روی
       همهٔ کلیدهای داده (به‌جز کلیدهای فرّارِ عمداً فایل‌محور) اجرا می‌کند و در صورت حتی یک
       مغایرت، سوییچ را انجام نمی‌دهد و فهرست دقیق را نشان می‌دهد. */
    @set_time_limit(120);
    $excluded = mig_compare_excluded();
    $mism = [];
    foreach (mig_keys() as $item) {
        if (in_array($item['key'], $excluded, true)) continue;
        $c = mig_compare_row($item);
        if (!$c['same']) $mism[] = $item['key'] . (!$c['inDb'] ? ' (در DB نیست)' : '');
    }
    if ($mism) {
        echo fa_err('سوییچ انجام نشد: ' . count($mism) . ' کلید بین فایل و دیتابیس مغایرت دارد:<br><span style="direction:ltr;display:inline-block;font-size:12px">' . h(implode('، ', $mism)) . '</span><br>ابتدا «مرحلهٔ ۳ (انتقال داده)» را کامل اجرا کنید تا همه سبز شوند و دوباره تلاش کنید — هیچ چیزی تغییر نکرد و دادهٔ فعلی (فایل‌ها) سالم و فعال است.');
        echo '<div style="margin:12px 0">' . btn('بازگشت: انتقال داده (مرحله ۳)', 'migrate') . ' ' . btn('بررسی تطابق دوباره (مرحله ۴)', 'verify') . '</div>';
        page_footer(); exit;
    }
    $c = ptf_db_config();
    $c['mode'] = 'mysql';
    $c['switched_at'] = date('Y-m-d H:i:s');
    $c['pre_switch_verified_at'] = date('Y-m-d H:i:s'); /* v33.22.3: سوییچ فقط پس از تطابق کامل درون‌خط */
    ptf_db_save_config($c);
    echo fa_ok('سوییچ نهایی با موفقیت انجام شد — تطابق کامل فایل↔دیتابیس همین لحظه بررسی و تأیید شد و دیتابیس اکنون منبع حقیقت است.');
    echo fa_ok('از این پس «گارد تازگی» (v33.22.3) هم فعال است: اگر به هر دلیل ردیفی در دیتابیس کهنه‌تر از فایل شود، خواندن به‌صورت خودکار از فایل تازه انجام و همان لحظه ردیف خودترمیم می‌شود — دیگر هیچ سناریویی نمی‌تواند دادهٔ نمایش‌داده‌شده را از فایل عقب‌تر نگه دارد.');
    echo fa_warn('قدم بعدی: ۱) یک بار صفحهٔ CRM را با Ctrl+Shift+R تازه‌سازی کنید تا همهٔ کاربران نسخهٔ جدید را بگیرند. ۲) این فایل (migrate.php) را از سرور حذف کنید (File Manager → api → حذف). ۳) در صورت مشاهدهٔ هر خطا، فایل‌های JSON پشتیبان در crm/data/backups/pre-mysql-… سالم هستند و می‌توان با «بازگردانی» برگشت.');
}

else {
    echo fa_err('مرحلهٔ نامعتبر.');
}

page_footer();
