<?php
// Clean up any remaining numerical kc files on the server (v33.2.0)
// v34.0.6-alpha (بدهی فنی #۲ در ارزیابی): این یک عملیات یک‌بارِ مهاجرت بود ولی در هر
// ریکوئست روی تمامِ pathها glob+unlink اجرا می‌شد. حالا فقط یک‌بار اجرا و سپس با
// نشانگر (marker) علامت‌گذاری می‌شود تا I/O بیهودهٔ هر درخواست حذف شود.
$kc_dir = __DIR__ . '/../knowledge-center';
if (is_dir($kc_dir) && !file_exists($kc_dir . '/.kc-cleanup-done')) {
    foreach (glob($kc_dir . '/kc-[0-9]*.html') as $f) {
        @unlink($f);
    }
    @file_put_contents($kc_dir . '/.kc-cleanup-done', date('c'));
}

// API سامانه مدیریت یکپارچه استعلامات (CRM API) — نسخه اسپرینت ۶۹
// پل ارتباطی سایت ↔ CRM: ثبت تامین‌کننده/استعلام از سایت + رهگیری + رویدادهای لحظه‌ای
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
require_once __DIR__ . '/storage-lib.php';
require_once __DIR__ . '/auth.php';

// v31.7.4 BUG-AUDIT-005 FIXED: Load secrets from centralized config file outside webroot
// Hardcoded secrets are a security risk. This function loads them from a config file.
require_once __DIR__ . '/secrets.php';

// Simple HMAC-based token verification
function verify_request() {
    // v31.7.7 HOTFIX-AUTH: Restored JWT-based token verification compatible with auth.php.
    // v31.7.4 BUG-AUDIT-003 had replaced JWT with static HMAC(IP,secret) which was incompatible
    // with the frontend's JWT tokens from auth_generate_token() — causing 401 on every API call.
    $action = $_REQUEST['action'] ?? '';
    
    // Public actions that don't need verification
    // v31.7.7 HOTFIX: Added 'users_get' — needed during login before token exists.
    // users_get only returns safe fields (no passhash) since BUG-AUDIT-004.
    $public_actions = ['captcha_new', 'add_rfq_site', 'add_supplier', 'track', 'auth_login', 'auth_login_otp', 'sms_status', 'users_get', 'chat_lead']; /* v34.8.46: auth_login_otp = مرحلهٔ دوم ورود دومرحله‌ای */
    if (in_array($action, $public_actions)) {
        return true;
    }
    
    // Verify JWT token from auth.php (same token the frontend sends)
    $token = auth_get_header_token();
    
    if (empty($token)) {
        http_response_code(401);
        echo json_encode(['ok' => false, 'error' => 'Authentication required', 'needLogin' => true]);
        exit;
    }
    
    $info = auth_verify_token($token);
    if (!$info) {
        http_response_code(401);
        echo json_encode(['ok' => false, 'error' => 'Invalid or expired token - please login again', 'needLogin' => true]);
        exit;
    }
    
    // Server-authoritative role from token
    global $client_role;
    if (isset($info['role'])) {
        $client_role = $info['role'];
    }
    
    return true;
}

$action = $_REQUEST['action'] ?? '';

// US-275 / TECHDEBT-001: Server HMAC verification for sensitive financial & administrative actions
$SENSITIVE_ACTIONS_HMAC = ['delete_batch', 'purge_cloud', 'update_role', 'delete_user'];
if (in_array($action, $SENSITIVE_ACTIONS_HMAC)) {
    $token = $_SERVER['HTTP_X_PTF_SECRET'] ?? $_REQUEST['token'] ?? '';
    $sensitiveSecret = load_ptf_secret('sensitive_action_key', '');
    if (strlen($sensitiveSecret) < 32 || $token === '') {
        http_response_code(503);
        echo json_encode(['ok' => false, 'error' => 'Sensitive action is not configured']);
        exit;
    }
    $expected = hash_hmac('sha256', $action . '|' . ($_SERVER['REMOTE_ADDR'] ?? 'local'), $sensitiveSecret);
    if (!hash_equals($expected, $token)) {
        http_response_code(401);
        echo json_encode(['ok' => false, 'error' => '⛔ دسترسی غیرمجاز: توکن امنیتی سرور نامعتبر است (US-275)']);
        exit;
    }
}


// ===== US-145 AC3: rate-limit سروری روی اکشن‌های عمومی =====
$PUBLIC_LIMITED = ['add_supplier' => 10, 'add_rfq_site' => 10, 'track' => 60, 'chat_lead' => 10];
if (isset($PUBLIC_LIMITED[$action])) {
    $rl_dir = __DIR__ . '/../crm/data';
    if (!is_dir($rl_dir)) { mkdir($rl_dir, 0755, true); file_put_contents($rl_dir . '/.htaccess', "Deny from all\n"); }
    $rl_file = $rl_dir . '/ratelimit.json';
    $rl = file_exists($rl_file) ? (json_decode(file_get_contents($rl_file), true) ?: []) : [];
    $ip_key = hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? 'x') . '|' . $action);
    $hour = date('YmdH');
    // پاکسازی ساعت‌های قدیمی
    foreach ($rl as $k => $v) { if (($v['h'] ?? '') !== $hour) unset($rl[$k]); }
    $rl[$ip_key] = ['h' => $hour, 'n' => ($rl[$ip_key]['n'] ?? 0) + 1];
    file_put_contents($rl_file, json_encode($rl), LOCK_EX);
    if ($rl[$ip_key]['n'] > $PUBLIC_LIMITED[$action]) {
        http_response_code(429);
        echo json_encode(['ok' => false, 'error' => 'تعداد درخواست بیش از حد مجاز — لطفاً بعداً تلاش کنید'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    // سقف حجم ورودی POST برای فرم‌های عمومی
    if (($_SERVER['CONTENT_LENGTH'] ?? 0) > 20 * 1048576) {
        http_response_code(413);
        echo json_encode(['ok' => false, 'error' => 'حجم درخواست بیش از حد مجاز']);
        exit;
    }
}

// ===== US-149 AC1: کپچای سروری (چالش ریاضی + توکن HMAC انقضادار) =====
// v32.0.2 US-440-fix: captcha_key only required when captcha/OTP actions are invoked — not a global blocker
$CAPTCHA_SECRET = load_ptf_secret('captcha_key', '');
function captcha_token($sum, $ts) {
    global $CAPTCHA_SECRET;
    if (!is_string($CAPTCHA_SECRET) || strlen($CAPTCHA_SECRET) < 32) return ''; /* cannot generate captcha — captcha_key missing or too short */
    return base64_encode($ts . '|' . hash_hmac('sha256', $sum . '|' . $ts, $CAPTCHA_SECRET));
}
function captcha_ok() {
    global $CAPTCHA_SECRET;
    if (!is_string($CAPTCHA_SECRET) || strlen($CAPTCHA_SECRET) < 32) return false; /* captcha_key missing — reject silently */
    $tok = $_POST['captcha_token'] ?? '';
    $ans = trim($_POST['captcha_answer'] ?? '');
    if (!$tok || $ans === '' || !is_numeric($ans)) return false;
    $raw = base64_decode($tok, true);
    if (!$raw || strpos($raw, '|') === false) return false;
    list($ts, $sig) = explode('|', $raw, 2);
    if (!ctype_digit($ts)) return false;
    $captchaAge = time() - (int)$ts;
    if ($captchaAge < 0 || $captchaAge > 900) return false; // آینده نامعتبر؛ انقضا: ۱۵ دقیقه
    return hash_equals(hash_hmac('sha256', ((int)$ans) . '|' . $ts, $CAPTCHA_SECRET), $sig);
}
function require_captcha() {
    global $CAPTCHA_SECRET;
    if (!is_string($CAPTCHA_SECRET) || strlen($CAPTCHA_SECRET) < 32) {
        http_response_code(503);
        echo json_encode(['ok' => false, 'error' => 'captcha_not_configured'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    if (!captcha_ok()) {
        http_response_code(403);
        echo json_encode(['ok' => false, 'error' => 'captcha', 'message' => 'تایید «من ربات نیستم» انجام نشده یا منقضی شده است'], JSON_UNESCAPED_UNICODE);
        exit;
    }
}

// ===== US-149 AC2..AC4: تایید پیامکی شماره تلفن (OTP) =====
function sms_cfg() {
    $paths = [
        dirname(__DIR__, 2) . '/sms-config.php',
        dirname(__DIR__, 3) . '/sms-config.php',
        dirname(__DIR__) . '/sms-config.php',
    ];
    foreach ($paths as $p) {
        if (file_exists($p)) {
            $c = include $p;
            if (is_array($c)) {
                // پاکسازی خودکار: اعداد فارسی/عربی → لاتین، حذف فاصله و خط تیره از خط و کلید
                $fa = ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹','٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
                $en = ['0','1','2','3','4','5','6','7','8','9','0','1','2','3','4','5','6','7','8','9'];
                foreach (['line', 'api_key', 'username'] as $k) {
                    if (isset($c[$k])) $c[$k] = str_replace([' ', '-', '‌'], '', str_replace($fa, $en, trim((string)$c[$k])));
                }
            }
            return $c;
        }
    }
    return null;
}
function sms_enabled() { $c = sms_cfg(); return $c && !empty($c['api_key']); }
// نگاشت کدهای خطای کاوه‌نگار به پیام فارسی قابل فهم (US-150 عیب‌یابی)
function kavenegar_err($status) {
    $map = [
        400 => 'پارامترهای ارسال ناقص است',
        401 => 'حساب کاوه‌نگار غیرفعال است',
        402 => 'عملیات ناموفق — حساب را در پنل چک کنید',
        403 => 'کلید API نامعتبر است — دوباره از پنل کپی کنید',
        406 => 'پارامتر اجباری خالی است',
        411 => 'شماره گیرنده نامعتبر است',
        412 => 'خط ارسال‌کننده نامعتبر یا هنوز تایید نشده است (احراز هویت/خط در حال بررسی)',
        413 => 'متن پیام خالی یا بیش از حد بلند است',
        418 => 'اعتبار حساب کاوه‌نگار کافی نیست — پنل را شارژ کنید',
        422 => 'متن پیام دارای کاراکتر غیرمجاز است',
        424 => 'الگوی پیام یافت نشد',
        426 => 'این متد نیازمند سرویس پیشرفته است',
        451 => 'تعداد فراخوانی بیش از حد — کمی صبر کنید',
    ];
    return $map[$status] ?? ('خطای کاوه‌نگار (کد ' . $status . ')');
}

function sms_send($phone, $text, &$errOut = null) {
    $c = sms_cfg();
    if (!$c) { $errOut = 'کانفیگ پیامک یافت نشد'; return false; }
    $provider = $c['provider'] ?? 'kavenegar';
    if ($provider === 'kavenegar') {
        // تلاش ۱: با خط تعیین‌شده در کانفیگ | تلاش ۲ (در صورت 412): بدون sender → خط پیش‌فرض پنل
        $attempts = [];
        $line = trim($c['line'] ?? '');
        if ($line !== '') $attempts[] = $line;
        $attempts[] = null; // خط پیش‌فرض پنل کاوه‌نگار
        $lastErr = '';
        foreach ($attempts as $i => $sender) {
            $url = 'https://api.kavenegar.com/v1/' . rawurlencode($c['api_key']) . '/sms/send.json?receptor=' . rawurlencode($phone) . '&message=' . rawurlencode($text) . ($sender !== null ? '&sender=' . rawurlencode($sender) : '');
            $ch = curl_init($url);
            curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 12]);
            $res = curl_exec($ch);
            $curlErr = curl_error($ch);
            curl_close($ch);
            if ($res === false) { $errOut = 'عدم دسترسی سرور هاست به api.kavenegar.com' . ($curlErr ? ' — ' . $curlErr : ''); return false; }
            $j = json_decode($res, true);
            $st = (int)($j['return']['status'] ?? 0);
            if ($st === 200) {
                if ($sender === null && $line !== '') {
                    // با خط پیش‌فرض رفت ولی خط کانفیگ رد شد → به کاربر بگو کانفیگ را اصلاح کند
                    $errOut = 'sent-default-line';
                }
                return true;
            }
            $lastErr = kavenegar_err($st) . (!empty($j['return']['message']) ? ' | ' . $j['return']['message'] : '');
            // فقط اگر مشکل از خط بود (412) با خط پیش‌فرض دوباره تلاش کن؛ خطاهای دیگر → توقف
            if ($st !== 412) break;
        }
        $errOut = $lastErr;
        return false;
    }
    if ($provider === 'melipayamak') {
        $ch = curl_init('https://rest.payamak-panel.com/api/SendSMS/SendSMS');
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 12, CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => http_build_query(['username' => $c['username'] ?? '', 'password' => $c['api_key'], 'to' => $phone, 'from' => $c['line'] ?? '', 'text' => $text])]);
        $res = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if ($res !== false && $code >= 200 && $code < 300) return true;
        $errOut = $res === false ? 'عدم دسترسی به پنل' : 'HTTP ' . $code;
        return false;
    }
    $errOut = 'provider نامعتبر';
    return false;
}
function otp_store_load() {
    global $data_dir_early;
    $f = $data_dir_early . '/otp.json';
    return file_exists($f) ? (json_decode(file_get_contents($f), true) ?: []) : [];
}
function otp_store_save($s) {
    global $data_dir_early;
    // پاکسازی رکوردهای منقضی
    foreach ($s as $k => $v) {
        if (!empty($v['lockUntil']) && $v['lockUntil'] < time()) unset($s[$k]);
        elseif (!empty($v['ts']) && time() - $v['ts'] > 3600 && empty($v['lockUntil'])) unset($s[$k]);
    }
    file_put_contents($data_dir_early . '/otp.json', json_encode($s), LOCK_EX);
}
function otp_token_make($phone) {
    global $CAPTCHA_SECRET;
    if (!is_string($CAPTCHA_SECRET) || strlen($CAPTCHA_SECRET) < 32) return ''; /* captcha_key missing for OTP — cannot generate secure token */
    $ts = time();
    return base64_encode($ts . '|' . $phone . '|' . hash_hmac('sha256', 'otp|' . $phone . '|' . $ts, $CAPTCHA_SECRET));
}
function otp_token_ok($token, $phone) {
    global $CAPTCHA_SECRET;
    /* گارد باید هم در تولید و هم در اعتبارسنجی باشد؛ فقط guard کردن make کافی نبود و
       مهاجم می‌توانست با secret خالی/کوتاه توکن HMAC دلخواه بسازد. */
    if (!is_string($CAPTCHA_SECRET) || strlen($CAPTCHA_SECRET) < 32) return false;
    $raw = base64_decode($token, true);
    if (!$raw) return false;
    $parts = explode('|', $raw, 3);
    if (count($parts) !== 3) return false;
    list($ts, $ph, $sig) = $parts;
    if (!ctype_digit($ts)) return false;
    $otpAge = time() - (int)$ts;
    if ($otpAge < 0 || $otpAge > 1800) return false; // آینده نامعتبر؛ اعتبار ۳۰ دقیقه
    if ($ph !== $phone) return false;
    return hash_equals(hash_hmac('sha256', 'otp|' . $ph . '|' . $ts, $CAPTCHA_SECRET), $sig);
}
// پوشه داده باید قبل از سوییچ آماده باشد (برای otp)
$data_dir_early = __DIR__ . '/../crm/data';
if (!is_dir($data_dir_early)) { mkdir($data_dir_early, 0755, true); file_put_contents($data_dir_early . '/.htaccess', "Deny from all\n"); }

// ===== RBAC (US-122 / AC6): گارد نقش سمت سرور =====
$ROLE_ACL = [
    'finance_read'  => ['admin','chairman','ceo','commercial'],
    'finance_write' => ['admin','chairman','ceo','commercial'],
    /* Sync transport is role-scoped by key in sync_allowed_keys_for_role().
       These gates only permit authenticated CRM roles to reach the transport. */
    'sync_read'    => ['admin','chairman','ceo','commercial','sales','buyer','accountant','collector'],
    'sync_write'   => ['admin','chairman','ceo','commercial','sales','buyer','accountant','collector'],
    'users_write'   => ['admin','chairman','ceo','commercial'],
    'buyprice_read' => ['admin','chairman','ceo','commercial','buyer'],
    'sellprice_read'=> ['admin','chairman','ceo','commercial','sales','accountant'],
    'approve_write' => ['admin','chairman','ceo','commercial'],
];
$client_role = 'anonymous';
/* v33.2.1: نگاشت نقش فارسی → لاتین — ریشه باگ «دستگاه مشکل‌دار»
   اگر roleId خالی یا فارسی باشد، preg_replace('/[^a-z]/') همه را حذف
   و نقش به 'sales' تقلیل می‌یافت. این تابع ابتدا نگاشت فارسی را بررسی
   می‌کند و فقط در صورت عدم تطابق به fallback متوسل می‌شود. */
$ROLE_PERSIAN_MAP = [
    'مدیر کل سیستم' => 'admin', 'مدیرکل سیستم' => 'admin',
    'رییس هیات مدیره' => 'chairman', 'رئیس هیات مدیره' => 'chairman', 'رییس هیأت مدیره' => 'chairman', 'رئیس هیأت مدیره' => 'chairman',
    'مدیرعامل' => 'ceo', 'مدیر عامل' => 'ceo',
    'مدیر بازرگانی' => 'commercial', 'مدیربازرگانی' => 'commercial',
    'کارشناس فروش' => 'sales', 'فروش' => 'sales',
    'کارشناس خرید' => 'buyer', 'خرید' => 'buyer',
    'حسابدار' => 'accountant',
    'تحصیلدار' => 'collector',
];
function normalize_role($roleId, $role) {
    global $ROLE_PERSIAN_MAP;
    $valid = ['admin','chairman','ceo','commercial','sales','buyer','accountant','collector'];
    // ۱) اگر roleId لاتین معتبر است
    $clean = preg_replace('/[^a-z]/', '', (string)$roleId);
    if (in_array($clean, $valid, true)) return $clean;
    // ۲) نگاشت نقش فارسی
    $roleTrimmed = trim((string)$role);
    if (isset($ROLE_PERSIAN_MAP[$roleTrimmed])) return $ROLE_PERSIAN_MAP[$roleTrimmed];
    // ۳) fallback: latin roleId بدون حروف فارسی
    if ($clean !== '') return $clean;
    return 'sales';
}
/* v33.2.1: نگاشت معکوس — roleId لاتین → نام فارسی نقش */
$ROLE_LATIN_TO_PERSIAN = [
    'admin' => 'مدیر کل سیستم',
    'chairman' => 'رییس هیات مدیره',
    'ceo' => 'مدیرعامل',
    'commercial' => 'مدیر بازرگانی',
    'sales' => 'کارشناس فروش',
    'buyer' => 'کارشناس خرید',
    'accountant' => 'حسابدار',
    'collector' => 'تحصیلدار',
];
function role_persian_label($roleId) {
    global $ROLE_LATIN_TO_PERSIAN;
    return $ROLE_LATIN_TO_PERSIAN[$roleId] ?? $roleId;
}
function role_guard($action_key) {
    global $ROLE_ACL, $client_role;
    if (!isset($ROLE_ACL[$action_key])) return true;
    if (!in_array($client_role, $ROLE_ACL[$action_key], true)) {
        http_response_code(403);
        echo json_encode(['ok' => false, 'error' => 'Forbidden: role not allowed for ' . $action_key]);
        exit;
    }
    return true;
}
$SENSITIVE = ['get_finance'=>'finance_read','save_finance'=>'finance_write','save_user'=>'users_write','del_user'=>'users_write','users_sync'=>'users_write','get_buyquotes'=>'buyprice_read','set_status'=>'approve_write','del_supplier_site'=>'approve_write','data_push'=>'sync_write','data_pull'=>'sync_read','auth_login'=>'none'];

/* v31.6.26 BUG-SYNC-ROLE-ACL: CRM synchronization is not the same as
   finance_read/finance_write. Filter keys server-side so ordinary CRM roles
   can converge without receiving invoices/payables/cheques they are not
   allowed to see. All four senior CRM roles (admin/chairman/ceo/commercial) keep
   the full company dataset. Destructive operations remain separately guarded. */
function sync_all_keys() {
    return ['ptf_crm_rfqs','ptf_crm_suppliers','ptf_crm_customers','ptf_crm_products','ptf_crm_catalog_reviews','ptf_crm_catalog_merges','ptf_crm_offers','ptf_crm_leads','ptf_crm_reminders','ptf_crm_buyquotes','ptf_crm_invoices','ptf_crm_surplus','ptf_crm_notifs','ptf_crm_sendqueue','ptf_crm_audit','ptf_crm_inqitems','ptf_crm_deals','ptf_crm_projects','ptf_crm_packinglists','ptf_crm_letters','ptf_crm_contracts','ptf_crm_sigprofiles','ptf_crm_smsbook','ptf_crm_rfqsmart','ptf_crm_settings','ptf_crm_finance','ptf_crm_order_prices','ptf_crm_notifprefs','ptf_crm_trash','ptf_crm_petty','ptf_crm_perms','ptf_crm_avatars','ptf_crm_buycmp','ptf_crm_inqreads','ptf_crm_cheques_issued','ptf_crm_cheques_received','ptf_crm_cheque_books','ptf_crm_msgtpls','ptf_crm_deleted_archive','ptf_crm_tax_returns','ptf_crm_sales_returns','ptf_crm_payables','ptf_crm_supplier_finance','ptf_crm_opex','ptf_crm_petty_tx','ptf_crm_petty_periods','ptf_crm_shareholders','ptf_crm_sharetx','ptf_crm_fiscal_snapshots','ptf_crm_techcases','ptf_crm_calc_runs','ptf_crm_techproposals','ptf_crm_leadfinder_jobs','ptf_crm_leadfinder_sources','ptf_crm_management_actions','ptf_crm_management_reports','ptf_crm_commission_records','ptf_crm_fin_events','ptf_crm_bank_recon','ptf_crm_treasury_calls','ptf_crm_case_receipts','ptf_crm_receipt_allocations','ptf_crm_fin_attachments','ptf_crm_corrections','ptf_crm_fin_findings','ptf_crm_personal_cheques'];
}
function sync_allowed_keys_for_role($role) {
    $role = preg_replace('/[^a-z0-9]/', '', strtolower(trim((string)$role)));
    $all = sync_all_keys();
    if (in_array($role, ['admin','chairman','ceo','commercial'], true) || strpos($role, 'commercial') !== false || strpos($role, 'manager') !== false) return $all;
    $crm = ['ptf_crm_rfqs','ptf_crm_suppliers','ptf_crm_customers','ptf_crm_products','ptf_crm_catalog_reviews','ptf_crm_catalog_merges','ptf_crm_offers','ptf_crm_leads','ptf_crm_reminders','ptf_crm_buyquotes','ptf_crm_surplus','ptf_crm_notifs','ptf_crm_sendqueue','ptf_crm_inqitems','ptf_crm_deals','ptf_crm_projects','ptf_crm_packinglists','ptf_crm_letters','ptf_crm_contracts','ptf_crm_sigprofiles','ptf_crm_rfqsmart','ptf_crm_notifprefs','ptf_crm_avatars','ptf_crm_buycmp','ptf_crm_inqreads','ptf_crm_msgtpls','ptf_crm_deleted_archive','ptf_crm_personal_cheques'];
    /* ↑ v34.8.36 (SYNC-RBAC-PARITY — RCA نوار زرد پایدار personal_cheques 2026-08-28):
       کلید مشترک چک شخصی از v34.8.29 در ماتریس کلاینت (SYNC_ROLE_KEYS) و رجیستری
       فرمانی سرور برای «هر ۸ نقش» مجاز است ولی این ماتریس push/pull جا مانده بود؛
       نتیجه: push کلید از sales/buyer/collector همیشه forbidden → بن‌بست ابدی نوار زرد. */
    $accountant = ['ptf_crm_rfqs','ptf_crm_customers','ptf_crm_products','ptf_crm_catalog_reviews','ptf_crm_catalog_merges','ptf_crm_offers','ptf_crm_reminders','ptf_crm_invoices','ptf_crm_notifs','ptf_crm_sendqueue','ptf_crm_inqitems','ptf_crm_deals','ptf_crm_projects','ptf_crm_letters','ptf_crm_contracts','ptf_crm_rfqsmart','ptf_crm_finance','ptf_crm_payables','ptf_crm_supplier_finance','ptf_crm_opex','ptf_crm_petty','ptf_crm_petty_tx','ptf_crm_petty_periods','ptf_crm_cheques_issued','ptf_crm_cheques_received','ptf_crm_cheque_books','ptf_crm_fiscal_snapshots','ptf_crm_notifprefs','ptf_crm_avatars','ptf_crm_msgtpls','ptf_crm_deleted_archive','ptf_crm_tax_returns','ptf_crm_sales_returns','ptf_crm_fin_events','ptf_crm_bank_recon','ptf_crm_commission_records','ptf_crm_case_receipts','ptf_crm_receipt_allocations','ptf_crm_fin_attachments','ptf_crm_corrections','ptf_crm_fin_findings','ptf_crm_personal_cheques'];
    $collector = ['ptf_crm_customers','ptf_crm_offers','ptf_crm_invoices','ptf_crm_reminders','ptf_crm_notifs','ptf_crm_sendqueue','ptf_crm_deals','ptf_crm_projects','ptf_crm_cheques_issued','ptf_crm_cheques_received','ptf_crm_notifprefs','ptf_crm_avatars','ptf_crm_personal_cheques']; /* v34.8.36 (SYNC-RBAC-PARITY): هم‌تراز با کلاینت/رجیستری فرمانی */
    if ($role === 'accountant') return $accountant;
    if ($role === 'collector') return $collector;
    /* v34.6.1: کارشناس خرید فقط زیر‌دفتر تأمین/تعهد خرید را علاوه بر داده CRM
       می‌گیرد تا خرید نقدی را با فاکتور و پرداخت تخصیص‌یافته ثبت کند. */
    if ($role === 'buyer') return array_values(array_unique(array_merge($crm, ['ptf_crm_buycmp','ptf_crm_supplier_finance','ptf_crm_payables'])));
    return $crm; // sales and unknown roles get CRM-only sync, never finance keys
}
/* v34.8.7 SHARED-KEY-CONVERGENCE: ptf_crm_audit و ptf_crm_avatars کلیدهای مشترکِ
   پرنویس‌اند — همهٔ کاربران آنلاین به آنها می‌نویسند. push به سبک replace با base
   قدیمی هرگز همگرا نمی‌شد (حلقهٔ تعارض؛ در مسیر فاز B بن‌بست کامل). این دو کلید
   سمت سرور union-merge می‌شوند: audit = لاگ append-only (اجماع ردیف‌ها، سقف ۴۰۰۰)،
   avatars = map (مقدار incoming برای هر کلید برنده است). push این کلیدها همیشه
   ACK می‌شود و سپر داده‌صفر آن را رد نمی‌کند (incoming خالی، ردیف‌های سرور را نگه
   می‌دارد و پاک‌سازی حساب نمی‌شود). */
function sync_shared_union_key($key) {
    /* v34.8.21 (NOTIFS-UNION): notifs هم اضافه شد — گزارش ۱۴۰۵/۰۶/۰۵: نوار زرد پایدار
       [notifs]. ریشه: notifs از مسیر base-merge معمولی می‌رفت؛ فرم ذخیره‌شدهٔ سرور با
       فرم کانونیکال ptfSmartMerge کلاینت (dedupe cd + مرتب‌سازی iso نزولی) هرگز برابر
       نمی‌شد ⇒ چرخهٔ بی‌پایان conflict/dirty. union صادقانه مثل audit/avatars. */
    return in_array($key, ['ptf_crm_audit','ptf_crm_avatars','ptf_crm_notifs'], true);
}
function sync_union_merge_shared_key($key, $incomingJson, $serverJson) {
    $inc = json_decode((string)$incomingJson, true);
    if (!is_array($inc)) return null; /* payload نامعتبر → همان مسیر عادی اعتبارسنجی */
    if ($serverJson === null) return $incomingJson;
    $srv = json_decode((string)$serverJson, true);
    if (!is_array($srv)) return $incomingJson;
    if ($key === 'ptf_crm_avatars') {
        /* v34.8.8: قرارداد v31.7.11 BUG-AVATAR-001 — مقدار هر کاربر یا رشتهٔ legacy است
           یا {v, ts} نسخه‌دار (v:null = tombstone حذف). برندهٔ هر کلید، ورودی با ts
           جدیدتر است (نسخه‌دار بر رشتهٔ legacy می‌چربد)؛ tombstone بیش از ۳۰ روز
           حذف می‌شود — دقیقاً همان ptfSmartMerge کلاینت. نسخهٔ v34.8.7 ورودی‌های
           غیررشته‌ای را پاک می‌کرد و حلقهٔ dirty بی‌نهایت می‌ساخت. */
        $tsOf = function ($e) { return (is_array($e) && isset($e['ts']) && is_string($e['ts'])) ? $e['ts'] : ''; };
        $valid = function ($e) { return is_string($e) || (is_array($e) && array_key_exists('v', $e) && (is_string($e['v']) || $e['v'] === null) && isset($e['ts']) && is_string($e['ts'])); };
        $out = [];
        $users = array_unique(array_merge(array_keys($srv), array_keys($inc)));
        foreach ($users as $u) {
            $sv = array_key_exists($u, $srv) ? $srv[$u] : null;
            $iv = array_key_exists($u, $inc) ? $inc[$u] : null;
            if ($sv !== null && !$valid($sv)) $sv = null;
            if ($iv !== null && !$valid($iv)) $iv = null;
            if ($sv === null && $iv === null) continue;
            if ($iv === null) $winner = $sv;
            elseif ($sv === null) $winner = $iv;
            else $winner = (strcmp((string)$tsOf($iv), (string)$tsOf($sv)) >= 0) ? $iv : $sv;
            if (is_array($winner) && array_key_exists('v', $winner) && $winner['v'] === null) {
                $t = (string)($winner['ts'] ?? '');
                $stale = false;
                try { $stale = ($t !== '' && (time() - (new DateTimeImmutable($t))->getTimestamp()) > 30 * 86400); } catch (Throwable $eTs) { $stale = false; }
                if ($stale) continue; /* همان سقف ۳۰ روزهٔ کلاینت */
            }
            $out[$u] = $winner;
        }
        return json_encode($out, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }
    if ($key === 'ptf_crm_notifs') {
        /* v34.8.21 (NOTIFS-UNION): merge کانونیکال — دقیقاً همان قرارداد ptfSmartMerge
           کلاینت: dedupe با cd، اتحاد readBy/done، repeat بزرگ‌تر برنده، dedupe ارجاع با
           dkey، مرتب‌سازی نزولی iso. خروجی سرور == خروجی کلاینت ⇒ ACK صادقانه، dirty پاک،
           pull بدون تغییر کاذب. */
        $byCd = [];
        foreach ($srv as $row) { if (is_array($row) && isset($row['cd'])) $byCd[$row['cd']] = $row; }
        foreach ($inc as $row) {
            if (!is_array($row) || !isset($row['cd'])) continue;
            $cd = $row['cd'];
            if (!isset($byCd[$cd])) { $byCd[$cd] = $row; continue; }
            $ex = $byCd[$cd];
            $rb = [];
            foreach ((isset($ex['readBy']) && is_array($ex['readBy']) ? $ex['readBy'] : []) as $u) { if ($u) $rb[$u] = 1; }
            foreach ((isset($row['readBy']) && is_array($row['readBy']) ? $row['readBy'] : []) as $u) { if ($u) $rb[$u] = 1; }
            $ex['readBy'] = array_values(array_keys($rb));
            $ex['done'] = !empty($ex['done']) || !empty($row['done']);
            $ir = isset($row['repeat']) ? $row['repeat'] : 1; $xr = isset($ex['repeat']) ? $ex['repeat'] : 1;
            if ($ir > $xr) {
                $ex['repeat'] = $ir;
                $ex['lastT'] = isset($row['lastT']) ? $row['lastT'] : (isset($ex['lastT']) ? $ex['lastT'] : '');
                $ex['lastISO'] = isset($row['lastISO']) ? $row['lastISO'] : (isset($ex['lastISO']) ? $ex['lastISO'] : '');
            }
            $byCd[$cd] = $ex;
        }
        $nOut = array_values($byCd);
        $byTask = []; $nDedup = [];
        foreach ($nOut as $item) {
            $dk = (string)(isset($item['dkey']) ? $item['dkey'] : '');
            $isRef = (isset($item['kind']) && $item['kind'] === 'referral') && preg_match('/^referral\|/', $dk);
            if (!$isRef || !isset($byTask[$dk])) { if ($isRef) $byTask[$dk] = $item; $nDedup[] = $item; continue; }
            $keep = $byTask[$dk];
            $rb2 = [];
            foreach ((isset($keep['readBy']) && is_array($keep['readBy']) ? $keep['readBy'] : []) as $u) { if ($u) $rb2[$u] = 1; }
            foreach ((isset($item['readBy']) && is_array($item['readBy']) ? $item['readBy'] : []) as $u) { if ($u) $rb2[$u] = 1; }
            $keep['readBy'] = array_values(array_keys($rb2));
            $keep['done'] = !empty($keep['done']) || !empty($item['done']);
            $iIso = (string)(isset($item['iso']) ? $item['iso'] : ''); $kIso = (string)(isset($keep['iso']) ? $keep['iso'] : '');
            if ($iIso !== '' && ($kIso === '' || $iIso < $kIso)) { $keep['t'] = isset($item['t']) ? $item['t'] : ''; $keep['iso'] = $item['iso']; }
            $byTask[$dk] = $keep;
        }
        /* v34.8.21: ترتیب دقیق کلاینت — dedupe ارجاع «قبل از» sort (بازمانده = رکورد
           سرور، به ترتیب درج)؛ sort نزولی iso در انتها. */
        usort($nDedup, function ($a, $b) { return strcmp((string)(isset($b['iso']) ? $b['iso'] : ''), (string)(isset($a['iso']) ? $a['iso'] : '')); });
        if (count($nDedup) > 4000) $nDedup = array_slice($nDedup, 0, 4000);
        return json_encode($nDedup, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }
    $seen = [];
    $out = [];
    foreach ($srv as $row) { $sig = md5(json_encode($row, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)); if (isset($seen[$sig])) continue; $seen[$sig] = true; $out[] = $row; }
    foreach ($inc as $row) { $sig = md5(json_encode($row, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)); if (isset($seen[$sig])) continue; $seen[$sig] = true; $out[] = $row; }
    if (count($out) > 4000) $out = array_slice($out, -4000);
    return json_encode($out, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}
/* v31.7.97 BUG-SYNC-TOMBSTONE-001: server-side deletion tombstones.
   A stale browser must not resurrect a record that another user deleted. */
function sync_tombstone_kinds_for_key($key) {
    $map = [
        'ptf_crm_offers' => ['offer','offers','to','co','tc'],
        'ptf_crm_rfqs' => ['rfq','request','inq','inquiry'],
        'ptf_crm_customers' => ['customer','customers','cust'],
        'ptf_crm_suppliers' => ['supplier','suppliers','sup'],
        'ptf_crm_products' => ['product','products','prod'],
        'ptf_crm_leads' => ['lead','leads'],
        'ptf_crm_invoices' => ['invoice','invoices','inv'],
        'ptf_crm_payables' => ['payable','payables','pay'],
        'ptf_crm_cheques' => ['cheque','check','chq'],
        'ptf_crm_deals' => ['deal','deals','salesfile'],
        'ptf_crm_projects' => ['project','projects','salesfile'],
        'ptf_crm_letters' => ['letter','letters'],
        'ptf_crm_contracts' => ['contract','contracts'],
        'ptf_crm_rfqsmart' => ['rfqsmart','supplyrfq'],
        'ptf_crm_buycmp' => ['buycmp','buycompare'],
        'ptf_crm_inqitems' => ['inqitem','inqitems','iqi'],
        'ptf_crm_case_receipts' => ['receipt','case_receipt','rpay'],
        'ptf_crm_receipt_allocations' => ['allocation','receipt_allocation'],
        'ptf_crm_fin_attachments' => ['attachment','financial_attachment'],
        /* Finance rows require explicit tombstones as well; omission from a browser
           snapshot is never a delete for these collections. */
        'ptf_crm_sharetx' => ['sharetx','share_transaction','shareholder_salary','chair_in','chair_out','draw','salary','salary_payment'],
        'ptf_crm_opex' => ['opex','expense','recurring_opex','shareholder_salary'],
        'ptf_crm_shareholders' => ['shareholder','shareholders'],
        'ptf_crm_corrections' => ['correction'],
    ];
    return $map[$key] ?? [];
}
function sync_record_id_for_key($key, $r) {
    if (!is_array($r)) return '';
    if ($key === 'ptf_crm_offers') return trim((string)($r['no'] ?? $r['cd'] ?? $r['id'] ?? ''));
    return trim((string)($r['_id'] ?? $r['cd'] ?? $r['no'] ?? $r['id'] ?? $r['code'] ?? $r['invoiceCd'] ?? ''));
}
/* v31.8 BUG-OFFER-SYNC-INTEGRITY-001: server-side last line of defence.
   We do not silently repair existing commercial documents. Instead, a payload
   that would increase exact duplicate offer lines compared with the server
   snapshot is rejected and the authoritative snapshot is returned as conflict. */
function sync_offer_item_signature($item) {
    if (!is_array($item)) return '';
    $lineId = trim((string)($item['lineId'] ?? ''));
    if ($lineId !== '') return 'id:' . $lineId;
    return 'exact:' . hash('sha256', json_encode($item, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
}
function sync_offer_duplicate_count($offers) {
    if (!is_array($offers)) return 0;
    $duplicates = 0;
    foreach ($offers as $offer) {
        if (!is_array($offer) || !is_array($offer['items'] ?? null)) continue;
        $seen = [];
        foreach ($offer['items'] as $item) {
            $sig = sync_offer_item_signature($item);
            if ($sig === '') continue;
            if (isset($seen[$sig])) $duplicates++; else $seen[$sig] = true;
        }
    }
    return $duplicates;
}
function sync_offers_payload_introduces_duplicates($incomingJson, $serverJson) {
    $incoming = json_decode((string)$incomingJson, true);
    $server = json_decode((string)$serverJson, true);
    if (!is_array($incoming)) return false;
    return sync_offer_duplicate_count($incoming) > sync_offer_duplicate_count(is_array($server) ? $server : []);
}
/* v34.7.39: data_push عمومی حق ایجاد پیشنهاد تازه یا انتشار draft فرمان را ندارد.
   رکورد تازه باید ابتدا از register_offer شناسه/مهر سرور بگیرد. */
function sync_offers_payload_has_unregistered_new($incomingJson, $serverJson) {
    $incoming=json_decode((string)$incomingJson,true);$server=json_decode((string)$serverJson,true);
    if(!is_array($incoming))return true;if(!is_array($server))$server=[];
    $serverNos=[];foreach($server as $offer)if(is_array($offer)&&trim((string)($offer['no']??''))!=='')$serverNos[trim((string)$offer['no'])]=true;
    $seen=[];
    foreach($incoming as $offer){
        if(!is_array($offer))continue;$no=trim((string)($offer['no']??''));if($no==='')continue;
        if(isset($seen[$no]))return true;$seen[$no]=true;
        if(isset($offer['_serverState'])||isset($offer['_serverOpId']))return true;
        /* فقط snapshot فعلی سرور authoritative است؛ مهر client قابل جعل است. */
        if(!isset($serverNos[$no]))return true;
    }
    return false;
}

/* v34.8.5 — whole-array sync remains available for manual finance rows, but omission
   is never a deletion instruction for OPEX/share transactions. Recurring salary and
   template identities are created/voided only by sales-domain commands. This guard is
   also applied to legacy clients that do not send a per-key base revision. */
function sync_recurring_aliases($key, $row) {
    if (!is_array($row)) return [];
    /* Physical identity must precede the migration fallback. recurringKey is a
       business grouping key and is intentionally non-unique when legacy/duplicate
       rows are present (for example two salary rows for one shareholder/month). */
    $fields = $key === 'ptf_crm_opex'
        ? ['_opexRowId','cd','recurringKey']
        : ['cd','recurringKey'];
    $out = [];
    foreach ($fields as $field) {
        $value = trim((string)($row[$field] ?? ''));
        if ($value !== '') $out[] = $field . ':' . $value;
    }
    return array_values(array_unique($out));
}
function sync_protected_identity_index(string $key, array $row): array {
    if (!is_array($row)) return [];
    /* Only an exact physical identity is safe for a normal snapshot merge. */
    $fields = $key === 'ptf_crm_opex' ? ['_opexRowId','cd'] : ['cd'];
    $out = [];
    foreach ($fields as $field) {
        $value = trim((string)($row[$field] ?? ''));
        if ($value !== '') $out[] = $field . ':' . $value;
    }
    return array_values(array_unique($out));
}
function sync_is_recurring_owned($key, $row) {
    if (!is_array($row)) return false;
    $recurringKey = trim((string)($row['recurringKey'] ?? ''));
    if ($key === 'ptf_crm_shareholders') return false;
    if ($key === 'ptf_crm_sharetx') return $recurringKey !== '' || strtolower(trim((string)($row['type'] ?? ''))) === 'salary';
    return $recurringKey !== '' || !empty($row['serverMaterialized']) || !empty($row['serverReconciled']) ||
        !empty($row['shareholderSalary']) || !empty($row['autoApplied']) || trim((string)($row['tplId'] ?? '')) !== '';
}
function sync_is_terminal_recurring_row($row) {
    if (!is_array($row)) return false;
    $states = ['void','voided','cancelled','deleted','replaced','superseded'];
    return in_array(strtolower(trim((string)($row['status'] ?? ''))), $states, true) ||
        in_array(strtolower(trim((string)($row['st'] ?? ''))), $states, true) || !empty($row['voided']) || !empty($row['deleted']);
}
function sync_merge_finance_files($server, $incoming, array $merged): array {
    $hasFiles = is_array($server['files'] ?? null) || is_array($incoming['files'] ?? null);
    if (!$hasFiles) return $merged;
    $files = []; $seen = [];
    foreach (array_merge(
        is_array($server['files'] ?? null) ? $server['files'] : [],
        is_array($incoming['files'] ?? null) ? $incoming['files'] : []
    ) as $file) {
        if (!is_array($file)) continue;
        $id = trim((string)($file['key'] ?? $file['id'] ?? ''));
        if ($id === '') $id = hash('sha256', json_encode($file, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
        if (isset($seen[$id])) continue;
        $seen[$id] = true; $files[] = $file;
    }
    $merged['files'] = $files;
    return $merged;
}
function sync_merge_server_owned_recurring_row($key, $server, $incoming, $serverIndex = -1) {
    $merged = array_replace(is_array($server) ? $server : [], is_array($incoming) ? $incoming : []);
    /* Client annotations (documents, the initial settlement and deal links) intentionally
       survive; cheque linkage is protected separately below. Identity, amount, eligibility,
       canonical metadata and tombstone state do not become writable merely because they
       arrived inside a full browser snapshot. */
    $core = $key === 'ptf_crm_opex'
        ? ['_opexRowId','serverOwnedIdentity','cd','recurringKey','tplId','shareTx','shareholderSalary','cat','amt','month','desc','isOfficial','serverMaterialized','serverReconciled','autoApplied','by','t','createdAt','createdAtISO','createdT','createdBy','updatedAt','updatedAtISO','updatedT','updatedBy']
        : ['cd','recurringKey','type','shCd','shName','amt','month','desc','serverMaterialized','serverReconciled','by','t','createdAt','createdAtISO','createdT','createdBy','updatedAt','updatedAtISO','updatedT','updatedBy'];
    foreach ($core as $field) {
        if (array_key_exists($field, $server)) $merged[$field] = $server[$field]; else unset($merged[$field]);
    }
    $terminalFields = ['status','voided','voidAt','voidedAt','voidBy','voidedBy','voidReason','deleted','deletedAt','deletedBy','deleteReason','explicitDeletion','manualVoid','voidIntent','eligibilityVoid','restoreIntent','restoredAt','restoredBy','restoreReason'];
    foreach ($terminalFields as $field) {
        if (array_key_exists($field, $server)) $merged[$field] = $server[$field]; else unset($merged[$field]);
    }
    /* A cheque relationship is authored atomically by schedule_recurring_opex_cheque.
       Generic snapshots may neither forge it nor clear it after that command commits. */
    $serverChequeLinked = trim((string)($server['chequeCd'] ?? '')) !== '' || !empty($server['fromCheque']) || strtolower(trim((string)($server['payHow'] ?? ''))) === 'cheque';
    $incomingChequeLinked = trim((string)($incoming['chequeCd'] ?? '')) !== '' || !empty($incoming['fromCheque']) || strtolower(trim((string)($incoming['payHow'] ?? ''))) === 'cheque';
    if ($serverChequeLinked || $incomingChequeLinked) {
        foreach (['chequeCd','payHow','fromCheque'] as $field) {
            if (array_key_exists($field, $server)) $merged[$field] = $server[$field]; else unset($merged[$field]);
        }
    }
    /* `st=settled` is initially a client-authored payment annotation, but once the
       server has accepted it a stale browser may not reopen the expense or rewrite its
       evidence. Every lifecycle-terminal st is likewise server-owned here. */
    $serverSettled = strtolower(trim((string)($server['st'] ?? ''))) === 'settled';
    $incomingSettled = strtolower(trim((string)($incoming['st'] ?? ''))) === 'settled';
    if ($serverSettled) {
        foreach (['st','settleDoc','settledBy','settledT','settleISO','payHow','acctTx'] as $field) {
            if (array_key_exists($field, $server)) $merged[$field] = $server[$field]; else unset($merged[$field]);
        }
    } elseif (sync_is_terminal_recurring_row($server)) {
        if (array_key_exists('st', $server)) $merged['st'] = $server['st']; else unset($merged['st']);
    } elseif (sync_is_terminal_recurring_row($incoming)) {
        if (array_key_exists('st', $server)) $merged['st'] = $server['st']; else unset($merged['st']);
    }
    /* Evidence is append-only for every financial row, not only settled rows. */
    $merged = sync_merge_finance_files($server, $incoming, $merged);
    /* Legacy recurring rows need a server-issued row identity. Simply stripping a
       browser backfill would make opexEnsureRowIds generate/push a fresh random ID on
       every render. The server index only disambiguates truly duplicate legacy rows;
       once written, this value is preserved as ordinary server-owned identity. */
    if ($key === 'ptf_crm_opex') {
        if (trim((string)($merged['_opexRowId'] ?? '')) === '') {
            $seed = trim((string)($server['recurringKey'] ?? '')) . '|' . trim((string)($server['cd'] ?? '')) . '|' . (int)$serverIndex;
            $merged['_opexRowId'] = 'OPXR-SRV-' . strtoupper(substr(hash('sha256', $seed), 0, 24));
        }
        /* Marks even a preserved legacy row ID as an identity accepted by the server.
           The projection merger may alias an uncommitted browser ID once, but must not
           collapse two accepted duplicate rows that share recurringKey. */
        $merged['serverOwnedIdentity'] = true;
    }
    return $merged;
}
function sync_merge_protected_finance_snapshot($key, $incomingJson, $serverJson) {
    $incoming = json_decode((string)$incomingJson, true); $server = json_decode((string)$serverJson, true);
    if (!is_array($incoming) || !is_array($server)) return null;
    /* Start from server so omission is never a deletion instruction. */
    $out = array_values($server); $aliases = [];
    foreach ($out as $index => $row) {
        if (sync_is_recurring_owned($key, $row)) $out[$index] = sync_merge_server_owned_recurring_row($key, $row, $row, $index);
        foreach (sync_recurring_aliases($key, $out[$index]) as $alias) {
            if (!isset($aliases[$alias])) $aliases[$alias] = [];
            $aliases[$alias][] = (int)$index;
        }
    }
    foreach ($incoming as $row) {
        if (!is_array($row)) continue;
        $at = -1;
        $physical = sync_protected_identity_index($key, $row);
        /* A supplied physical identity is authoritative for matching. A different
           cd/row ID must create a separate physical row, never collapse into a sibling
           solely because recurringKey is shared. */
        foreach ($physical as $alias) {
            if (isset($aliases[$alias]) && count($aliases[$alias]) === 1) {
                $at = (int)$aliases[$alias][0];
                break;
            }
        }
        /* Only truly legacy rows without a physical identity may use recurringKey,
           and an ambiguous recurringKey is fail-closed (the signature then returns a
           conflict to the client rather than choosing a row). */
        if ($at < 0 && !$physical) {
            foreach (sync_recurring_aliases($key, $row) as $alias) {
                if (strpos($alias, 'recurringKey:') !== 0) continue;
                if (isset($aliases[$alias]) && count($aliases[$alias]) === 1) {
                    $at = (int)$aliases[$alias][0];
                    break;
                }
            }
        }
        if ($at < 0) {
            /* A new recurring identity must originate from the locked command path;
               manual/non-recurring rows with a stable cd remain appendable. */
            if (sync_is_recurring_owned($key, $row)) continue;
            $out[] = $row; $at = count($out) - 1;
        } elseif (sync_is_recurring_owned($key, $out[$at]) || sync_is_recurring_owned($key, $row)) {
            $out[$at] = sync_merge_server_owned_recurring_row($key, $out[$at], $row, $at);
        } else {
            $out[$at] = sync_merge_finance_files($out[$at], $row, array_replace($out[$at], $row));
        }
        foreach (sync_recurring_aliases($key, $out[$at]) as $alias) {
            if (!isset($aliases[$alias])) $aliases[$alias] = [];
            if (!in_array($at, $aliases[$alias], true)) $aliases[$alias][] = $at;
        }
    }
    return json_encode(array_values($out), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}
function sync_normalize_for_compare($value) {
    if (!is_array($value)) return $value;
    $isList = array_keys($value) === range(0, count($value) - 1);
    if ($isList) { $out=[]; foreach($value as $item)$out[]=sync_normalize_for_compare($item); return $out; }
    ksort($value); foreach($value as $key=>$item)$value[$key]=sync_normalize_for_compare($item); return $value;
}
function sync_finance_snapshot_signature($json) {
    $rows=json_decode((string)$json,true);if(!is_array($rows))return '';$encoded=[];
    /* Top-level row order is a presentation choice; nested arrays (e.g. files) retain
       order. This avoids a permanent conflict loop when two browsers sort OPEX rows. */
    foreach($rows as $row)$encoded[]=json_encode(sync_normalize_for_compare($row),JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
    sort($encoded,SORT_STRING);return hash('sha256',json_encode($encoded,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES));
}

function sync_decode_archive($json) {
    $a = json_decode((string)$json, true);
    return is_array($a) ? $a : [];
}
function sync_apply_tombstones($key, $json, $serverArchiveJson = '', $incomingArchiveJson = '') {
    if ($key === 'ptf_crm_deleted_archive') {
        $purgeAliases=[];foreach(array_merge(sync_decode_archive($serverArchiveJson),sync_decode_archive($incomingArchiveJson))as $d)if(is_array($d)&&strtolower((string)($d['kind']??''))==='archive_purge')foreach(($d['aliases']??[])as $alias){$alias=trim((string)$alias);if(strlen($alias)>=6)$purgeAliases[$alias]=true;}
        if(!$purgeAliases)return$json;$rows=sync_decode_archive($json);$out=[];foreach($rows as $row){if(!is_array($row))continue;if(strtolower((string)($row['kind']??''))==='archive_purge'){$out[]=$row;continue;}$encoded=json_encode($row,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);$purged=false;foreach($purgeAliases as $alias=>$_)if(strpos((string)$encoded,(string)$alias)!==false){$purged=true;break;}if(!$purged)$out[]=$row;}return json_encode(array_values($out),JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
    }
    $kinds = sync_tombstone_kinds_for_key($key);
    $kindSet = array_fill_keys(array_map('strtolower', $kinds), true);
    $ids = []; $purgeAliases = [];
    foreach (array_merge(sync_decode_archive($serverArchiveJson), sync_decode_archive($incomingArchiveJson)) as $d) {
        if (!is_array($d)) continue;
        $kind = strtolower((string)($d['kind'] ?? ''));
        if ($kind === 'archive_purge' && is_array($d['identities'][$key] ?? null)) {
            foreach ($d['identities'][$key] as $purgedId) { $purgedId=trim((string)$purgedId); if($purgedId!=='')$ids[$purgedId]=true; }
            if (is_array($d['aliases'] ?? null)) foreach ($d['aliases'] as $alias) { $alias=trim((string)$alias); if(strlen($alias)>=6)$purgeAliases[$alias]=true; }
        }
        if (!isset($kindSet[$kind])) continue;
        $id = trim((string)($d['id'] ?? $d['no'] ?? $d['cd'] ?? ''));
        if ($id !== '') $ids[$id] = true;
    }
    if (!$ids && !$purgeAliases) return $json;
    $arr = json_decode((string)$json, true);
    if (!is_array($arr)) return $json;
    if ($key === 'ptf_crm_supplier_finance' && (isset($arr['invoices']) || isset($arr['payments']) || isset($arr['schema']))) {
        foreach(['invoices','payments','adjustments']as $bucket){if(!is_array($arr[$bucket]??null))continue;$arr[$bucket]=array_values(array_filter($arr[$bucket],function($r)use($ids){if(!is_array($r))return true;$id=trim((string)($r['cd']??$r['_id']??''));return$id===''||!isset($ids[$id]);}));}
        foreach($arr['payments']??[]as &$payment)if(is_array($payment)&&is_array($payment['allocations']??null))$payment['allocations']=array_values(array_filter($payment['allocations'],function($a)use($ids){return!is_array($a)||!isset($ids[trim((string)($a['invoiceCd']??''))]);}));unset($payment);
        return json_encode($arr,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
    }
    $out = [];
    foreach ($arr as $r) {
        $id = sync_record_id_for_key($key, $r); $purged = ($id !== '' && isset($ids[$id]));
        if (!$purged && $purgeAliases && is_array($r)) { $encoded=json_encode($r,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES); foreach($purgeAliases as $alias=>$_)if(strpos((string)$encoded,(string)$alias)!==false){$purged=true;break;} }
        if (!$purged) $out[] = $r;
    }
    return json_encode(array_values($out), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}

// v30.1 FIN-WF-001 کامل: توکن اجباری برای تمام مالی
$auth_token = auth_get_header_token();
$auth_info = $auth_token ? auth_verify_token($auth_token) : false;
// برای actions مالی، توکن الزامی
$FINANCIAL_ACTIONS = ['data_push','data_pull','get_finance','save_finance','save_user','del_user','get_buyquotes','set_status','auth_login'];
// v31.2 FIN-WF-001 کامل: برای تمام data_push/pull و مالی، توکن الزامی و role فقط از توکن
if(in_array($action, ['data_push','data_pull']) || (isset($SENSITIVE[$action]) && $SENSITIVE[$action] !== 'none')){
    if(!$auth_info){
        http_response_code(401);
        echo json_encode(['ok'=>false,'error'=>'token required - please login again (v31.2 FIN-WF-001 complete)','needLogin'=>true], JSON_UNESCAPED_UNICODE);
        exit;
    }
    // server authoritative role - X-CRM-Role header نادیده گرفته می‌شود
    if(isset($auth_info['role'])){
        $client_role = $auth_info['role'];
    }
} else {
    if($auth_token && !$auth_info){
        http_response_code(401);
        echo json_encode(['ok'=>false,'error'=>'invalid token - please login again']);
        exit;
    }
    if($auth_info && isset($auth_info['role'])){
        $client_role = $auth_info['role'];
    }
}
if (isset($SENSITIVE[$action])) { role_guard($SENSITIVE[$action]); }


// US-145 AC2: لاگ به پوشه محافظت‌شده منتقل شد (قبلاً crm/api_log.txt در webroot افشا می‌شد)
$log_dir = __DIR__ . '/../crm/data';
if (!is_dir($log_dir)) { mkdir($log_dir, 0755, true); file_put_contents($log_dir . '/.htaccess', "Deny from all\n"); }
$log_file = $log_dir . '/api_log.txt';
// حذف فایل لاگ قدیمیِ افشاشده در صورت وجود
$old_log = __DIR__ . '/../crm/api_log.txt';
if (file_exists($old_log)) @unlink($old_log);
/* پول/rev هر چند ثانیه تکرار می‌شود — خواندن+بازنویسی کل لاگ روی هر درخواست، خودِ بار را سنگین می‌کرد. */
$SKIP_API_LOG = ['data_pull', 'data_rev', 'get_events', 'sms_status', 'role_verify'];
if (!in_array($action, $SKIP_API_LOG, true)) {
    $log_entry = date('Y-m-d H:i:s') . " | " . ($_SERVER['REMOTE_ADDR'] ?? 'unknown') . " | $action\n";
    @file_put_contents($log_file, $log_entry, FILE_APPEND | LOCK_EX);
    clearstatcache(true, $log_file);
    if (@filesize($log_file) > 12000) {
        $tail = @file_get_contents($log_file, false, null, -6000);
        if ($tail !== false) @file_put_contents($log_file, $tail, LOCK_EX);
    }
}

// Data file paths (JSON-based storage)
$data_dir = __DIR__ . '/../crm/data';
if (!is_dir($data_dir)) {
    mkdir($data_dir, 0755, true);
    file_put_contents($data_dir . '/.htaccess', "Deny from all\n");
}

/* ===== DB-MIG-001 (فاز A — v33.17.0): لایهٔ MySQL (اختیاری) =====
   وقتی db-lib.php موجود باشد و پیکربندی کامل شده باشد:
   - حالت dual (دورهٔ مهاجرت): نوشتن هم در فایل و هم در دیتابیس (خطای دیتابیس هرگز مسیر فایل را نمی‌شکند).
   - حالت mysql (پس از سوییچ نهایی): خواندن از دیتابیس (منبع حقیقت) با fallback به فایل. */
require_once __DIR__ . '/db-lib.php';

function load_data($key) {
    global $data_dir;
    /* در حالت mysql ابتدا از دیتابیس (منبع حقیقت) — v33.22.3 (P1-ATTACH-STALE-DB):
       با گارد تازگی؛ اگر ردیف DB کهنه‌تر از فایل باشد، فایل سرو و ردیف خودترمیم می‌شود. */
    if (ptf_db_mode() === 'mysql') {
        $v = ptf_db_read_fresh($key, "$data_dir/$key.json");
        if ($v !== null) {
            $d = json_decode($v, true);
            if (is_array($d)) return $d;
        }
    }
    $file = "$data_dir/$key.json";
    if (!file_exists($file)) return [];
    $data = file_get_contents($file);
    return json_decode($data, true) ?: [];
}

function save_data($key, $data) {
    global $data_dir;
    $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    /* dual-write: ابتدا فایل (مسیر همیشه‌موفق)، سپس دیتابیس (در صورت فعال بودن) */
    $file = "$data_dir/$key.json";
    file_put_contents($file, $json, LOCK_EX);
    ptf_db_write($key, $json);
}

/* ===== v33.22.0 (P1-MySQL-WIRE — سیم‌کشی مسیر سینک به MySQL همان هاست) =====
   حالت‌ها (mode در ptf-db-config.php — ساختهٔ migrate.php):
     off   → فقط فایل؛ رفتار دقیقاً مثل امروز (حالت پیش‌فرض بدون دیتابیس/کانفیگ)
     dual  → فایل منبع خواندن + آینهٔ نوشتن MySQL (دورهٔ مهاجرت؛ خطای MySQL بی‌صدا)
     mysql → MySQL منبع حقیقت خواندن (با fallback به فایل) + نوشتن همزمان فایل (بکاپ گرم؛
             شکست نوشتن DB به فراخوان گزارش می‌شود تا کلاینت صف را نگه دارد و retry کند —
             وگرنه rev افزایش می‌یافت ولی pull مقدار کهنه می‌خواند)
   توجه: دفتر rev (meta.json) در هر سه حالت دست‌نخورده باقی می‌ماند (کوچک و سبک).
   مهم: این دو تابع باید top-level باشند (داخل switch تعریف شرطی می‌شود و در caseها
   undefined است) — کنار load_data/save_data نگهداری می‌شوند. */
/* ═══ v34.8.46 (R6/T7-ب — LOGIN-2FA + SESSIONS): ورود دومرحله‌ای پیامکی نقش‌های مالی و مدیریت نشست‌ها ═══ */
function twofa_store_file() { global $data_dir; return $data_dir . '/auth_2fa.json'; }
function twofa_store_load() { $f = twofa_store_file(); return is_file($f) ? (json_decode((string)@file_get_contents($f), true) ?: []) : []; }
function twofa_store_save($st) {
    $f = twofa_store_file();
    $tmp = $f . '.tmp.' . bin2hex(random_bytes(4));
    if (@file_put_contents($tmp, json_encode($st), LOCK_EX) !== false) @rename($tmp, $f);
}
function twofa_log($event, $user, $detail = '') {
    /* ۸۰ رویداد آخر — مبنای پایش «چند بار fail-open شد» توسط ادمین */
    global $data_dir;
    $f = $data_dir . '/auth_2fa_log.json';
    $log = is_file($f) ? (json_decode((string)@file_get_contents($f), true) ?: []) : [];
    $log[] = ['at' => date('Y-m-d H:i:s'), 'event' => (string)$event, 'user' => (string)$user, 'detail' => (string)$detail, 'ip' => (string)($_SERVER['REMOTE_ADDR'] ?? '')];
    if (count($log) > 80) $log = array_slice($log, -80);
    $tmp = $f . '.tmp.' . bin2hex(random_bytes(4));
    if (@file_put_contents($tmp, json_encode($log, JSON_UNESCAPED_UNICODE), LOCK_EX) !== false) @rename($tmp, $f);
}
function twofa_cfg() {
    $s = load_data('settings');
    $roles = ['accountant']; /* پیش‌فرض T7: نقش مالی متمرکز */
    if (is_array($s['twofa_roles'] ?? null)) {
        $r = [];
        foreach ($s['twofa_roles'] as $x) { $x = normalize_role((string)$x, (string)$x); if ($x !== '') $r[] = $x; }
        if ($r) $roles = array_values(array_unique($r));
    }
    return ['enabled' => ($s['twofa_enabled'] ?? true) !== false, 'roles' => $roles, 'strict' => !empty($s['twofa_required'])];
}
function twofa_user_mobile($found) {
    $m = preg_replace('/\D/', '', (string)($found['mobile'] ?? ''));
    return preg_match('/^09\d{9}$/', $m) ? $m : '';
}

/* پاسخ JSON بزرگ (data_pull) را در صورت پشتیبانی مرورگر gzip می‌کنیم — بدون تعویض هاست حجم روی سیم کم می‌شود. */
function ptf_echo_json($payload, $flags = 0) {
    $raw = is_string($payload) ? $payload : json_encode($payload, $flags | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($raw === false) { echo '{"ok":false,"error":"json"}'; return; }
    if (!headers_sent()) {
        $ae = (string)($_SERVER['HTTP_ACCEPT_ENCODING'] ?? '');
        $zlibOn = filter_var(ini_get('zlib.output_compression'), FILTER_VALIDATE_BOOLEAN);
        if (!$zlibOn && strlen($raw) > 2048 && function_exists('gzencode') && stripos($ae, 'gzip') !== false) {
            header('Content-Encoding: gzip');
            header('Vary: Accept-Encoding');
            echo gzencode($raw, 5);
            return;
        }
    }
    echo $raw;
}

function sync_key_read($sdir, $k) {
    $f = $sdir . '/' . $k . '.json';
    /* v33.22.3 (P1-ATTACH-STALE-DB): گارد تازگی — در mode=mysql اگر ردیف DB کهنه‌تر از فایل
       باشد (ماندهٔ مهاجرت ناقص/ردشده)، فایل تازه سرو و ردیف همان‌جا خودترمیم می‌شود؛
       در نتیجه خواندن سینک هرگز از فایل عقب‌تر نمی‌ماند. */
    $v = ptf_db_read_fresh($k, $f);
    if ($v !== null) return $v;
    return file_exists($f) ? file_get_contents($f) : null;
}
function sync_key_write($sdir, $k, $v, $rev = 0) {
    /* فایل همیشه نوشته می‌شود (بکاپ گرم + مسیر rollback — طبق وعدهٔ راهنمای مهاجرت) */
    $okFile = file_put_contents($sdir . '/' . $k . '.json', $v, LOCK_EX) !== false;
    $mode = ptf_db_mode();
    if ($mode === 'dual' || $mode === 'mysql') {
        $okDb = ptf_db_write_rev($k, $v, $rev);
        if ($mode === 'mysql' && !$okDb) return false;
    }
    return $okFile;
}

/* ===== v33.16.0 (فاز ۲ بکاپ): چرخش بک‌آپ مشترک (سپر shrink + چرخش + آروان) =====
   هم برای بک‌آپ کامل (save_backup) و هم برای بک‌آپ دلتا (save_backup_delta) استفاده می‌شود. */
function ptf_rotate_backup($bdir, $raw, $j) {
    $canGz = function_exists('gzencode');
    $blob = $canGz ? gzencode($raw, 6) : $raw;
    $ext  = $canGz ? '.json.gz' : '.json';
    /* v15.0 (US-384 — سپر بک‌آپ): اگر شمار رکوردهای کلیدهای حیاتی نسبت به بک‌آپ موجود
       >۵۰٪ افت کرده باشد، نسخه جدید «قرنطینه» می‌شود و چرخشی‌ها دست نمی‌خورند. */
    $allow_shrink = !empty($j['allow_shrink']);
    $suspect = [];
    if (!$allow_shrink) {
        $exF = null;
        foreach (['/hourly-latest.json.gz', '/hourly-latest.json'] as $cand) { if (file_exists($bdir . $cand)) { $exF = $bdir . $cand; break; } }
        if ($exF) {
            $exRaw = (substr($exF, -3) === '.gz' && function_exists('gzdecode')) ? @gzdecode(@file_get_contents($exF)) : @file_get_contents($exF);
            $ex = $exRaw ? json_decode($exRaw, true) : null;
            $exC = is_array($ex['counts'] ?? null) ? $ex['counts'] : [];
            $newC = is_array($j['counts'] ?? null) ? $j['counts'] : [];
            foreach (['ptf_crm_customers','ptf_crm_rfqs','ptf_crm_offers','ptf_crm_suppliers','ptf_crm_products','ptf_crm_invoices','ptf_crm_deals','ptf_crm_projects'] as $gk) {
                $pv = (int)($exC[$gk] ?? 0); $nv = (int)($newC[$gk] ?? 0);
                if ($pv >= 4 && $nv < $pv / 2) $suspect[] = $gk;
            }
        }
    }
    if ($suspect) {
        file_put_contents($bdir . '/suspect-' . date('Y-m-d-His') . $ext, $blob, LOCK_EX);
        $sfiles = array_merge(glob($bdir . '/suspect-*.json') ?: [], glob($bdir . '/suspect-*.json.gz') ?: []);
        if (count($sfiles) > 3) { sort($sfiles); foreach (array_slice($sfiles, 0, count($sfiles) - 3) as $f) @unlink($f); }
        return ['ok' => true, 'mode' => 'quarantined', 'suspect' => $suspect, 't' => date('Y-m-d H:i:s')];
    }
    // ساعتی: همیشه جایگزین
    file_put_contents($bdir . '/hourly-latest' . $ext, $blob, LOCK_EX);
    if ($canGz) @unlink($bdir . '/hourly-latest.json');
    // روزانه: یک فایل per روز، فقط ۳ روز اخیر
    file_put_contents($bdir . '/daily-' . date('Y-m-d') . $ext, $blob, LOCK_EX);
    $files = array_merge(glob($bdir . '/daily-*.json') ?: [], glob($bdir . '/daily-*.json.gz') ?: []);
    if ($files && count($files) > 3) { sort($files); foreach (array_slice($files, 0, count($files) - 3) as $f) @unlink($f); }
    // هفتگی: فقط اگر هفته عوض شده
    $wk = $bdir . '/weekly-latest' . $ext;
    if (!file_exists($wk) || date('oW', filemtime($wk)) !== date('oW')) file_put_contents($wk, $blob, LOCK_EX);
    // ماهانه: فقط اول هر ماه
    $mo = $bdir . '/monthly-latest' . $ext;
    $isNewMonth = !file_exists($mo) || date('Y-m', filemtime($mo)) !== date('Y-m');
    if ($isNewMonth) file_put_contents($mo, $blob, LOCK_EX);
    // آپلود ابری با کلید ثابت + هرس
    $arvan = 'local-only';
    $storage = __DIR__ . '/storage.php';
    if (file_exists($storage)) {
        $base = (isset($_SERVER['HTTPS']) ? 'https' : 'http') . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost') . dirname($_SERVER['SCRIPT_NAME'] ?? '/api/x') . '/storage.php';
        $upload = function ($name, $body) use ($base) {
            $ch = curl_init($base . '?action=presign_put_backup');
            curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true, CURLOPT_TIMEOUT => 8,
                CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
                CURLOPT_POSTFIELDS => json_encode(['name' => $name])]);
            $pr = json_decode(curl_exec($ch) ?: '', true);
            curl_close($ch);
            if (!$pr || empty($pr['ok']) || empty($pr['url'])) return false;
            $ch2 = curl_init($pr['url']);
            curl_setopt_array($ch2, [CURLOPT_RETURNTRANSFER => true, CURLOPT_CUSTOMREQUEST => 'PUT', CURLOPT_TIMEOUT => 30, CURLOPT_POSTFIELDS => $body]);
            curl_exec($ch2);
            $code = curl_getinfo($ch2, CURLINFO_HTTP_CODE);
            curl_close($ch2);
            return $code >= 200 && $code < 300;
        };
        if ($upload('crm-backup-latest' . $ext, $blob)) $arvan = 'arvan';
        if ($arvan === 'arvan' && $isNewMonth) $upload('crm-backup-monthly' . $ext, $blob);
        if ($arvan === 'arvan') {
            $ch3 = curl_init($base . '?action=backup_prune');
            curl_setopt_array($ch3, [CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true, CURLOPT_TIMEOUT => 15,
                CURLOPT_HTTPHEADER => ['Content-Type: application/json'], CURLOPT_POSTFIELDS => '{}']);
            curl_exec($ch3);
            curl_close($ch3);
        }
    }
    return ['ok' => true, 'mode' => $arvan, 't' => date('Y-m-d H:i:s')];
}

// v31.7.68 BUG-AUTH-MOBILE-USER-001: merge all possible user stores.
// Root cause: mobile login relied on users_get, but users_get/auth_login used the
// first non-empty source only (users OR crm_users OR sync). If one source was stale,
// an existing user could be missed even though another server source had it.
function load_all_crm_users_sources() {
    global $data_dir;
    $sources = [];
    $sources[] = load_data('users');
    $sources[] = load_data('crm_users');
    $syncFile = $data_dir . '/sync/ptf_crm_users.json';
    if (file_exists($syncFile)) {
        $syncUsers = json_decode(file_get_contents($syncFile), true);
        if (is_array($syncUsers)) $sources[] = $syncUsers;
    }
    $by = [];
    foreach ($sources as $list) {
        if (!is_array($list)) continue;
        foreach ($list as $u) {
            if (!is_array($u) || empty($u['username'])) continue;
            $key = strtolower(trim((string)$u['username']));
            if ($key === '') continue;
            $prev = $by[$key] ?? [];
            $next = array_merge($prev, $u);
            $next['username'] = $key;
            if (empty($next['passhash']) && !empty($prev['passhash'])) $next['passhash'] = $prev['passhash'];
            if (empty($next['password_hash']) && !empty($prev['password_hash'])) $next['password_hash'] = $prev['password_hash'];
            if (empty($next['roleId']) && !empty($next['role'])) $next['roleId'] = normalize_role('', $next['role']);
            // v33.2.1: اگر role فارسی نیست (یا خالی)، از roleId نگاشت فارسی بگیر
            $isPersian = (bool)preg_match('/[\x{0600}-\x{06FF}]/u', (string)($next['role'] ?? ''));
            if (!$isPersian && !empty($next['roleId'])) $next['role'] = role_persian_label($next['roleId']);
            $by[$key] = $next;
        }
    }
    return array_values($by);
}

/* کد رهگیری عمومی غیرقابل‌حدس: ۱۰ نویسه از الفبای بدون 0/O/1/I (~۵۰ بیت entropy).
   prefix فقط نوع پرونده را مشخص می‌کند؛ هیچ سال/ترتیب/تعداد ثبت‌نام از کد نشت نمی‌کند.
   داده‌های ترتیبی قبلی همچنان در track قابل جستجو باقی می‌مانند. */
function public_tracking_code($kind) {
    $kind = strtoupper(trim((string)$kind));
    if (!in_array($kind, ['RFQ', 'VEN'], true)) throw new InvalidArgumentException('tracking_kind');
    $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    $used = [];
    foreach (array_merge(load_data('rfqs'), load_data('suppliers')) as $row) {
        $old = strtoupper(trim((string)($row['code'] ?? '')));
        if ($old !== '') $used[$old] = true;
    }
    $max = strlen($alphabet) - 1;
    for ($attempt = 0; $attempt < 20; $attempt++) {
        $token = '';
        for ($i = 0; $i < 10; $i++) $token .= $alphabet[random_int(0, $max)];
        $code = 'PTF-' . $kind . '-' . substr($token, 0, 5) . '-' . substr($token, 5, 5);
        if (!isset($used[$code])) return $code;
    }
    throw new RuntimeException('tracking_code_generation_failed');
}

function clean($v, $max = 500) {
    $v = trim(strip_tags((string)$v));
    if (function_exists('mb_substr')) return mb_substr($v, 0, $max, 'UTF-8');
    return substr($v, 0, $max);
}

function ptf_is_password_hash($h) {
    return is_string($h) && strlen($h) >= 50 && isset($h[0]) && $h[0] === '$';
}

/* v33: login rate limiting and controlled migration from legacy SHA-256 records.
   Legacy hashes remain only long enough to authenticate once over HTTPS and are
   immediately upgraded to PHP password_hash in the canonical crm_users store. */
function login_rate_allowed($username) {
    global $data_dir;
    $file = $data_dir . '/login_ratelimit.json';
    $now = time();
    $key = hash('sha256', strtolower((string)$username) . '|' . ($_SERVER['REMOTE_ADDR'] ?? ''));
    $all = file_exists($file) ? (json_decode((string)file_get_contents($file), true) ?: []) : [];
    foreach ($all as $k => $row) if (($row['until'] ?? 0) < $now && ($row['t'] ?? 0) < $now - 900) unset($all[$k]);
    $row = $all[$key] ?? ['n' => 0, 't' => $now, 'until' => 0];
    if (($row['until'] ?? 0) > $now) return false;
    if ($now - ($row['t'] ?? $now) > 300) $row = ['n' => 0, 't' => $now, 'until' => 0];
    $row['n'] = (int)($row['n'] ?? 0) + 1;
    $row['t'] = $now;
    if ($row['n'] > 8) $row['until'] = $now + 900;
    $all[$key] = $row;
    file_put_contents($file, json_encode($all), LOCK_EX);
    return ($row['until'] ?? 0) <= $now;
}

function migrate_legacy_password_hash($user, $plainPassword) {
    global $data_dir;
    $username = strtolower(trim((string)($user['username'] ?? '')));
    if ($username === '') return;
    $file = $data_dir . '/crm_users.json';
    $rows = file_exists($file) ? (json_decode((string)file_get_contents($file), true) ?: []) : [];
    if (!is_array($rows)) $rows = [];
    $updated = false;
    foreach ($rows as &$row) {
        if (strtolower((string)($row['username'] ?? '')) !== $username) continue;
        $row['password_hash'] = password_hash($plainPassword, PASSWORD_DEFAULT);
        unset($row['passhash'], $row['password']);
        $updated = true;
        break;
    }
    unset($row);
    if (!$updated) {
        $row = [
            'username' => $username,
            'password_hash' => password_hash($plainPassword, PASSWORD_DEFAULT),
            'name' => clean($user['name'] ?? $username, 80),
            'nameEn' => clean($user['nameEn'] ?? '', 80),
            'role' => clean($user['role'] ?? ($user['roleId'] ?? 'sales'), 80),
            'roleId' => normalize_role($user['roleId'] ?? '', $user['role'] ?? ''),
            'mobile' => preg_replace('/\D/', '', (string)($user['mobile'] ?? '')),
            'email' => clean($user['email'] ?? '', 80),
            'migratedAt' => date('c')
        ];
        $rows[] = $row;
    }
    save_data('crm_users', $rows);
}

/* v34.7.70 (SUP-DEDUP-001): جلوگیری از ثبت تکراری تامین‌کننده — نرمال‌سازی سروری.
   هم‌ارز dedupNorm/dedupNormPhone سمت کلاینت (dedup.js) برای منبع حقیقت سرور. */
function ptf_dedup_norm($s) {
    $s = (string)($s ?? '');
    $fa = '۰۱۲۳۴۵۶۷۸۹'; $ar = '٠١٢٣٤٥٦٧٨٩';
    $out = '';
    for ($i = 0; $i < mb_strlen($s); $i++) {
        $ch = mb_substr($s, $i, 1);
        $fi = mb_strpos($fa, $ch); $ai = mb_strpos($ar, $ch);
        if ($fi !== false) $ch = (string)$fi;
        elseif ($ai !== false) $ch = (string)$ai;
        $out .= $ch;
    }
    $out = str_replace(['ي','ئ','ى'], 'ی', $out);
    $out = str_replace('ك', 'ک', $out);
    $out = str_replace(['أ','إ','آ'], 'ا', $out);
    $out = str_replace('ة', 'ه', $out);
    $out = preg_replace('/[\x{200c}\x{200f}\x{200e}\x{064b}-\x{0652}]/u', '', $out);
    $out = preg_replace('/[\s\-_.،,؛;()\/\\\\]/u', '', $out);
    return mb_strtolower($out);
}
function ptf_dedup_phone($s) {
    $d = preg_replace('/\D/', '', ptf_dedup_norm((string)($s ?? '')));
    if (strpos($d, '0098') === 0) $d = '0' . substr($d, 4);
    elseif (strpos($d, '98') === 0 && strlen($d) === 12) $d = '0' . substr($d, 2);
    return $d;
}

/* پیوست فرم‌های عمومی: فقط فضای ابری.
   PHP فقط از فایل موقت upload request به S3 stream می‌کند؛ هیچ فایل پیوستی در
   crm/data/uploads یا مسیر دائمیِ هاست نوشته نمی‌شود. */
function save_attachment($field, $prefix, &$error = null) {
    $error = '';
    if (empty($_FILES[$field]['name'])) return null;
    if (!is_uploaded_file($_FILES[$field]['tmp_name'] ?? '')) { $error = 'فایل پیوست به‌درستی دریافت نشد'; return null; }
    $size = (int)($_FILES[$field]['size'] ?? 0);
    if ($size < 1 || $size > 15 * 1048576) { $error = 'حجم فایل پیوست باید حداکثر ۱۵MB باشد'; return null; }
    $allowed = ['pdf','doc','docx','xls','xlsx','jpg','jpeg','png','webp','zip','rar'];
    $original = (string)$_FILES[$field]['name'];
    $ext = strtolower(pathinfo($original, PATHINFO_EXTENSION));
    if (!in_array($ext, $allowed, true)) { $error = 'فرمت فایل پیوست مجاز نیست'; return null; }
    $key = ptf_storage_object_key('site-' . $prefix, $original);
    $put = ptf_storage_put_uploaded_file($_FILES[$field]['tmp_name'], $key);
    if (empty($put['ok'])) { $error = $put['error'] ?? 'آپلود فضای ابری ناموفق بود'; return null; }
    return ['key' => $key, 'name' => $original, 'size' => $size, 'mode' => 'arvan', 'uploadedAt' => date('c')];
}

// ثبت رویداد سراسری (US-138: صندوق پیام لحظه‌ای — CRM هر چند ثانیه poll می‌کند)
function push_event_rec($kind, $title, $data = []) {
    $ev = load_data('events');
    $last = count($ev) ? $ev[count($ev) - 1]['id'] : 0;
    $ev[] = [
        'id' => $last + 1,
        'kind' => $kind,
        'title' => $title,
        'data' => $data,
        'ts' => date('c')
    ];
    if (count($ev) > 300) $ev = array_slice($ev, -300);
    save_data('events', $ev);
    return $last + 1;
}

switch($action) {

    // ===== US-149 AC1: صدور چالش کپچا =====
    case 'captcha_new':
        if (!is_string($CAPTCHA_SECRET) || strlen($CAPTCHA_SECRET) < 32) {
            http_response_code(503);
            echo json_encode(['ok' => false, 'error' => 'captcha_not_configured']);
            break;
        }
        $a = random_int(2, 9); $b = random_int(2, 9);
        $ts = time();
        echo json_encode(['ok' => true, 'q' => "$a + $b", 'a' => $a, 'b' => $b, 'token' => captcha_token($a + $b, $ts)], JSON_UNESCAPED_UNICODE);
        break;

    case 'sms_status':
        echo json_encode(['ok' => true, 'enabled' => sms_enabled()]);
        break;

    // ===== US-150: ارسال پیامک (انبوه/تکی) — فقط نقش‌های مجاز =====
    case 'sms_bulk':
        verify_request();
        role_guard('approve_write'); // admin/chairman/ceo/commercial
        $recipients = json_decode($_POST['recipients'] ?? '[]', true) ?: [];
        $text = clean($_POST['text'] ?? '', 900);
        $kind = clean($_POST['kind'] ?? 'bulk', 20);
        if (!$recipients || !$text) { echo json_encode(['ok' => false, 'error' => 'گیرنده یا متن خالی است'], JSON_UNESCAPED_UNICODE); break; }
        if (count($recipients) > 500) { echo json_encode(['ok' => false, 'error' => 'حداکثر ۵۰۰ گیرنده در هر ارسال'], JSON_UNESCAPED_UNICODE); break; }
        if (!sms_enabled()) { echo json_encode(['ok' => false, 'queued' => true, 'error' => 'sms_off'], JSON_UNESCAPED_UNICODE); break; }
        // پیامک تبلیغاتی/انبوه: لغو11 الزامی (AC5 US-132)
        $suffix = ($kind === 'bulk' && mb_strpos($text, 'لغو11') === false) ? "\nلغو11" : '';
        $sent = 0; $failed = 0;
        $lastErr = '';
        foreach ($recipients as $r) {
            /* مرورگر/بک‌آپ قدیمی ممکن است موبایل را با ارقام فارسی/عربی بفرستد.
               transport باید هر دو را بپذیرد؛ در غیر این صورت preg_replace همه رقم‌ها
               را حذف و صف پیامک بی‌دلیل نامعتبر می‌شد. */
            $rawMob = strtr((string)($r['mob'] ?? ''), ['۰'=>'0','۱'=>'1','۲'=>'2','۳'=>'3','۴'=>'4','۵'=>'5','۶'=>'6','۷'=>'7','۸'=>'8','۹'=>'9','٠'=>'0','١'=>'1','٢'=>'2','٣'=>'3','٤'=>'4','٥'=>'5','٦'=>'6','٧'=>'7','٨'=>'8','٩'=>'9']);
            $mob = preg_replace('/\D/', '', $rawMob);
            if (preg_match('/^9\d{9}$/', $mob)) $mob = '0' . $mob;
            if (!preg_match('/^09\d{9}$/', $mob)) { $failed++; $lastErr = 'شماره گیرنده نامعتبر: ' . $mob; continue; }
            $body = str_replace('{نام}', $r['nm'] ?? '', $text) . $suffix;
            $e = null;
            if (sms_send($mob, $body, $e)) { $sent++; if ($e === 'sent-default-line') $lastErr = $e; } else { $failed++; if ($e) $lastErr = $e; }
            if ($sent + $failed >= 500) break;
        }
        // لاگ ارسال (AC4 US-132)
        $slog = load_data('sms_log');
        $slog[] = ['t' => date('Y-m-d H:i:s'), 'by' => clean($_POST['by'] ?? '', 80), 'kind' => $kind, 'n' => count($recipients), 'sent' => $sent, 'failed' => $failed, 'err' => $lastErr, 'text' => mb_substr($text, 0, 200)];
        if (count($slog) > 500) $slog = array_slice($slog, -500);
        save_data('sms_log', $slog);
        echo json_encode(['ok' => true, 'sent' => $sent, 'failed' => $failed, 'reason' => $lastErr], JSON_UNESCAPED_UNICODE);
        break;

    // ===== US-149 AC2/AC3: ارسال رمز پیامکی =====
    case 'otp_send':
        require_captcha(); // بدون کپچا رمز هم ارسال نمی‌شود
        $phone = preg_replace('/\D/', '', $_POST['phone'] ?? '');
        if (!preg_match('/^09\d{9}$/', $phone)) {
            echo json_encode(['ok' => false, 'error' => 'شماره موبایل معتبر نیست (09xxxxxxxxx)'], JSON_UNESCAPED_UNICODE); break;
        }
        $ipk = hash('sha256', 'otp|' . ($_SERVER['REMOTE_ADDR'] ?? 'x'));
        $store = otp_store_load();
        $rec = $store[$ipk] ?? ['n' => 0, 'ts' => time()];
        // AC3: قفل IP پس از ۵ ارسال
        if (!empty($rec['lockUntil']) && $rec['lockUntil'] > time()) {
            http_response_code(429);
            echo json_encode(['ok' => false, 'error' => 'locked', 'message' => 'به دلیل درخواست‌های مکرر، امکان ثبت‌نام از این آدرس تا ۲۴ ساعت مسدود است'], JSON_UNESCAPED_UNICODE); break;
        }
        if (($rec['n'] ?? 0) >= 5) {
            $rec['lockUntil'] = time() + 86400;
            $store[$ipk] = $rec;
            otp_store_save($store);
            http_response_code(429);
            echo json_encode(['ok' => false, 'error' => 'locked', 'message' => 'سقف ۵ بار ارسال رمز پر شد — این آدرس ۲۴ ساعت مسدود است'], JSON_UNESCAPED_UNICODE); break;
        }
        if (!sms_enabled()) {
            echo json_encode(['ok' => false, 'error' => 'sms_off', 'message' => 'سامانه پیامکی هنوز پیکربندی نشده — ثبت‌نام بدون تایید پیامکی انجام می‌شود'], JSON_UNESCAPED_UNICODE); break;
        }
        $code = str_pad((string)random_int(0, 99999), 5, '0', STR_PAD_LEFT);
        $rec['n'] = ($rec['n'] ?? 0) + 1;
        $rec['ts'] = time();
        $rec['phone'] = $phone;
        $rec['hash'] = password_hash($code, PASSWORD_DEFAULT);
        $rec['exp'] = time() + 120;
        $store[$ipk] = $rec;
        otp_store_save($store);
        $otpErr = null;
        $sent = sms_send($phone, 'پیشرو تجهیز فرتاک' . "\n" . 'رمز تایید شماره شما: ' . $code . "\n" . 'اعتبار: ۲ دقیقه' . "\n" . 'لغو11', $otpErr);
        if (!$sent) {
            /* v31.7.42 BUG-SUP-OTP-001: اگر پنل پیامک config دارد ولی ارسال واقعی fail شود
               (اعتبار/خط/اختلال provider)، فرم تامین‌کننده نباید بن‌بست شود. با کپچای معتبر و
               rate-limit، یک توکن degraded امضا شده برای همین شماره صادر می‌شود تا ثبت‌نام انجام شود
               و تیم بازرگانی بعداً تلفنی تایید کند. */
            echo json_encode(['ok' => true, 'degraded' => true, 'otp_token' => otp_token_make($phone), 'ttl' => 0, 'left' => 5 - $rec['n'],
                'message' => 'سامانه پیامک موقتاً ارسال نکرد؛ ثبت‌نام با تایید کپچا ادامه می‌یابد و شماره تلفن توسط تیم بازرگانی بررسی می‌شود.',
                'sms_error' => ($otpErr ?: 'send_failed')], JSON_UNESCAPED_UNICODE);
            break;
        }
        echo json_encode(['ok' => true, 'ttl' => 120, 'left' => 5 - $rec['n']], JSON_UNESCAPED_UNICODE);
        break;

    case 'otp_verify':
        $phone = preg_replace('/\D/', '', $_POST['phone'] ?? '');
        $code = trim($_POST['code'] ?? '');
        $ipk = hash('sha256', 'otp|' . ($_SERVER['REMOTE_ADDR'] ?? 'x'));
        $store = otp_store_load();
        $rec = $store[$ipk] ?? null;
        if (!$rec || ($rec['phone'] ?? '') !== $phone || empty($rec['hash'])) {
            echo json_encode(['ok' => false, 'error' => 'رمزی برای این شماره ارسال نشده']); break;
        }
        if (($rec['exp'] ?? 0) < time()) { echo json_encode(['ok' => false, 'error' => 'رمز منقضی شده — ارسال مجدد بزنید'], JSON_UNESCAPED_UNICODE); break; }
        if (($rec['tries'] ?? 0) >= 6) { echo json_encode(['ok' => false, 'error' => 'تلاش بیش از حد']); break; }
        $rec['tries'] = ($rec['tries'] ?? 0) + 1;
        $store[$ipk] = $rec;
        otp_store_save($store);
        if (!password_verify($code, $rec['hash'])) { echo json_encode(['ok' => false, 'error' => 'رمز نادرست است'], JSON_UNESCAPED_UNICODE); break; }
        echo json_encode(['ok' => true, 'otp_token' => otp_token_make($phone)], JSON_UNESCAPED_UNICODE);
        break;

    case 'get_all':
        verify_request();
        echo json_encode([
            'ok' => true,
            'rfqs' => load_data('rfqs'),
            'suppliers' => load_data('suppliers'),
            'customers' => load_data('customers'),
            'users' => load_data('users'),
            'settings' => load_data('settings') ?: new stdClass()
        ], JSON_UNESCAPED_UNICODE);
        break;

    // ===== US-133: ثبت استعلام هوشمند سایت → CRM (جایگزین ایمیل) =====
    case 'add_rfq_site':
        verify_request();
        require_captcha(); // US-149 AC1
        try { $code = public_tracking_code('RFQ'); }
        catch (Throwable $e) { http_response_code(503); echo json_encode(['ok'=>false,'error'=>'tracking_code_unavailable'], JSON_UNESCAPED_UNICODE); break; }
        $attachmentError = '';
        $attachment = save_attachment('attachment', 'rfq', $attachmentError);
        if ($attachmentError) { http_response_code(503); echo json_encode(['ok' => false, 'error' => 'attachment_cloud', 'message' => $attachmentError], JSON_UNESCAPED_UNICODE); break; }
        $rfqs = load_data('rfqs');
        $rfqs[] = [
            'code' => $code,
            'src' => 'site',
            'company' => clean($_POST['company'] ?? ''),
            'contact' => clean($_POST['name'] ?? ''),
            'phone' => clean($_POST['phone'] ?? ''),
            'email' => clean($_POST['email'] ?? ''),
            'category' => clean($_POST['category'] ?? ''),
            'subject' => clean($_POST['subject'] ?? ''),
            'standard' => clean($_POST['techStandard'] ?? ''),
            'vendors' => clean($_POST['vendorInput'] ?? ''),
            'message' => clean($_POST['message'] ?? '', 3000),
            'attachment' => $attachment,
            'status' => 'pending',
            'statusText' => 'در انتظار تایید مدیران',
            'date' => date('Y-m-d H:i'),
            'approvedBy' => null
        ];
        save_data('rfqs', $rfqs);
        push_event_rec('rfq_site', 'یک استعلام هوشمند از سایت ثبت شد: ' . clean($_POST['company'] ?? '') . ' (' . $code . ')', ['code' => $code]);
        echo json_encode(['ok' => true, 'code' => $code], JSON_UNESCAPED_UNICODE);
        break;

    // (فرم استعلام سریع صفحه اصلی)
    case 'add_rfq':
        verify_request();
        require_captcha(); // US-149 AC1
        $rfqs = load_data('rfqs');
        try { $code = public_tracking_code('RFQ'); }
        catch (Throwable $e) { http_response_code(503); echo json_encode(['ok'=>false,'error'=>'tracking_code_unavailable'], JSON_UNESCAPED_UNICODE); break; }
        $rfqs[] = [
            'code' => $code,
            'company' => clean($_POST['company'] ?? ''),
            'contact' => clean($_POST['contact'] ?? ''),
            'category' => clean($_POST['category'] ?? ''),
            'status' => clean($_POST['status'] ?? 'st1'),
            'statusText' => clean($_POST['statusText'] ?? 'دریافت اولیه'),
            'date' => date('Y/m/d')
        ];
        save_data('rfqs', $rfqs);
        echo json_encode(['ok' => true, 'code' => $code], JSON_UNESCAPED_UNICODE);
        break;

    case 'update_rfq':
        verify_request();
        $rfqs = load_data('rfqs');
        foreach ($rfqs as &$r) {
            if ($r['code'] === ($_POST['code'] ?? '')) {
                $r['status'] = clean($_POST['status'] ?? $r['status']);
                $r['statusText'] = clean($_POST['statusText'] ?? $r['statusText']);
            }
        }
        save_data('rfqs', $rfqs);
        echo json_encode(['ok' => true]);
        break;

    // ===== US-133: ثبت‌نام تامین‌کننده سایت → CRM با شماره یکتا =====
    case 'add_supplier':
        verify_request();
        require_captcha(); // US-149 AC1
        // US-149 AC4: اگر پیامک فعال است، توکن OTP تاییدشده الزامی است
        $sup_phone = preg_replace('/\D/', '', $_POST['phone'] ?? '');
        if (sms_enabled()) {
            $otok = $_POST['otp_token'] ?? '';
            if (!$otok || !otp_token_ok($otok, $sup_phone)) {
                http_response_code(403);
                echo json_encode(['ok' => false, 'error' => 'otp', 'message' => 'شماره تلفن با پیامک تایید نشده است'], JSON_UNESCAPED_UNICODE);
                exit;
            }
        }
        try { $code = public_tracking_code('VEN'); }
        catch (Throwable $e) { http_response_code(503); echo json_encode(['ok'=>false,'error'=>'tracking_code_unavailable'], JSON_UNESCAPED_UNICODE); break; }
        /* v34.7.70 (SUP-DEDUP-001) + v34.7.71 (SUP-RESUBMIT-001):
           جلوگیری از ثبت تکراری — نام شرکت یا شماره تماس (نرمال‌شده) در برابر ثبت‌نام‌های
           سایت (pending/rejected) و فهرست تاییدشده CRM. اگر رکورد تکراری «ردشده با دلیل
           نقصان مدارک» باشد، به‌جای بلاک، همان رکورد باز و مدارک تکمیل می‌شود. */
        $supCompanyRaw = clean($_POST['company'] ?? '');
        $supNameNorm = ptf_dedup_norm($supCompanyRaw);
        $supPhoneNorm = ptf_dedup_phone($_POST['phone'] ?? '');
        /* v34.7.79 (SUP-PAY-TERMS): شرایط پرداخت — نقدی/تعهدی + بازهٔ اعتبار + امتیاز.
           allowlist سخت‌گیرانه؛ payScore از دید جریان نقدی خریدار (نرم بازار ایران):
           تعهدی ۱–۳ ماهه مطلوب‌ترین است؛ نقدی میانی؛ بیش از ۳ ماه ریسک نکول/تورم می‌گیرد. */
        $supPayTerms = clean($_POST['payTerms'] ?? '', 20);
        $supCreditRange = clean($_POST['creditRange'] ?? '', 10);
        $supPayScore = 0;
        if ($supPayTerms === 'cash') {
            $supCreditRange = '';
            $supPayScore = 10;
        } elseif ($supPayTerms === 'credit') {
            if (!in_array($supCreditRange, ['30', '60', '90', '120', '180', '365'], true)) {
                http_response_code(400);
                echo json_encode(['ok' => false, 'error' => 'invalid_pay_terms', 'message' => 'بازهٔ اعتبار انتخاب‌شده معتبر نیست.'], JSON_UNESCAPED_UNICODE);
                break;
            }
            $supPayScoreMap = ['30' => 12, '60' => 15, '90' => 18, '120' => 14, '180' => 8, '365' => 2];
            $supPayScore = $supPayScoreMap[$supCreditRange];
        } else {
            http_response_code(400);
            echo json_encode(['ok' => false, 'error' => 'invalid_pay_terms', 'message' => 'روش همکاری (نقدی/تعهدی) را انتخاب کنید.'], JSON_UNESCAPED_UNICODE);
            break;
        }
        $dupFound = null;
        /* v34.7.71 (SUP-RESUBMIT-001): اگر با ?code= آمده باشد و آن رکورد «ردشده + باز»
           باشد، مستقیماً همان رکورد باز می‌شود (مستقل از تطابق نام/شماره). */
        $resubmitCode = strtoupper(clean($_POST['code'] ?? '', 60));
        if ($resubmitCode !== '') {
            foreach (load_data('suppliers') as $idx => $row) {
                if (is_array($row) && ($row['code'] ?? '') === $resubmitCode && ($row['status'] ?? '') === 'rejected' && !empty($row['reopen'])) {
                    $dupFound = ['list'=>'suppliers','idx'=>$idx,'code'=>$resubmitCode,'co'=>($row['company'] ?? ''),'why'=>'کد رهگیری','row'=>$row];
                    break;
                }
            }
        }
        if (!$dupFound && ($supNameNorm !== '' || $supPhoneNorm !== '')) {
            foreach (load_data('suppliers') as $idx => $row) {
                if (!is_array($row)) continue;
                $rcode = (string)($row['code'] ?? '');
                if ($supNameNorm !== '' && ptf_dedup_norm($row['company'] ?? '') === $supNameNorm) {
                    $dupFound = ['list'=>'suppliers','idx'=>$idx,'code'=>$rcode,'co'=>($row['company'] ?? ''),'why'=>'نام شرکت/فروشگاه','row'=>$row]; break;
                }
                $rowPhones = [$row['phone'] ?? '', $row['ph'] ?? '', $row['mob'] ?? ''];
                foreach ($rowPhones as $rp) {
                    $rpN = ptf_dedup_phone($rp);
                    if ($supPhoneNorm !== '' && $rpN !== '' && $rpN === $supPhoneNorm) {
                        $dupFound = ['list'=>'suppliers','idx'=>$idx,'code'=>$rcode,'co'=>($row['company'] ?? ''),'why'=>'شماره تماس','row'=>$row]; break 2;
                    }
                }
            }
            if (!$dupFound) {
                foreach (load_data('ptf_crm_suppliers') as $idx => $row) {
                    if (!is_array($row)) continue;
                    $rcode = (string)($row['cd'] ?? '');
                    if ($supNameNorm !== '' && ptf_dedup_norm($row['co'] ?? '') === $supNameNorm) {
                        $dupFound = ['list'=>'ptf_crm_suppliers','idx'=>$idx,'code'=>$rcode,'co'=>($row['co'] ?? ''),'why'=>'نام شرکت/فروشگاه','row'=>$row]; break;
                    }
                    $rowPhones = [$row['ph'] ?? '', $row['mob'] ?? '', $row['coTels'] ?? ''];
                    foreach ($rowPhones as $rp) {
                        if (is_array($rp)) continue;
                        $rpN = ptf_dedup_phone($rp);
                        if ($supPhoneNorm !== '' && $rpN !== '' && $rpN === $supPhoneNorm) {
                            $dupFound = ['list'=>'ptf_crm_suppliers','idx'=>$idx,'code'=>$rcode,'co'=>($row['co'] ?? ''),'why'=>'شماره تماس','row'=>$row]; break 2;
                        }
                    }
                }
            }
        }
        $attachmentError = '';
        $attachment = save_attachment('attachment', 'ven', $attachmentError);
        $attachmentWarning = $attachmentError ? ('پیوست ذخیره نشد: ' . $attachmentError) : '';
        /* v34.7.71 (SUP-RESUBMIT-001): تکمیل مدارک — رکورد ردشده با دلیل نقصان مدارک
           به‌جای ساخت رکورد تکراری، باز می‌شود و مدارک جدید جایگزین/پیوست می‌شود. */
        if ($dupFound && ($dupFound['row']['status'] ?? '') === 'rejected' && !empty($dupFound['row']['reopen']) && $dupFound['list'] === 'suppliers') {
            $suppliers = load_data('suppliers');
            $oldCode = (string)($dupFound['row']['code'] ?? $dupFound['code']);
            $suppliers[$dupFound['idx']] = [
                'code' => $oldCode,
                'src' => 'site',
                'company' => clean($_POST['company'] ?? ''),
                'name' => clean($_POST['name'] ?? ''),
                'phone' => clean($_POST['phone'] ?? ''),
                'category' => clean($_POST['category'] ?? ''),
                'type' => clean($_POST['type'] ?? ''),
                'brands' => clean($_POST['brands'] ?? ''),
                'email' => clean($_POST['email'] ?? ''),
                'message' => clean($_POST['message'] ?? '', 2000),
                'attachment' => ($attachment ?: ($dupFound['row']['attachment'] ?? null)),
                'payTerms' => $supPayTerms,
                'creditRange' => $supCreditRange,
                'payScore' => $supPayScore,
                'status' => 'pending',
                'statusText' => 'مدارک تکمیل شد — در انتظار بررسی مجدد',
                'date' => date('Y-m-d H:i'),
                'approvedBy' => null
            ];
            save_data('suppliers', $suppliers);
            push_event_rec('supplier_site', 'تکمیل مدارک ثبت‌نام تامین‌کننده: ' . clean($_POST['company'] ?? '') . ' (' . $oldCode . ')', ['code' => $oldCode]);
            echo json_encode(['ok' => true, 'code' => $oldCode, 'reopened' => true, 'warning' => $attachmentWarning], JSON_UNESCAPED_UNICODE);
            break;
        }
        if ($dupFound) {
            echo json_encode([
                'ok' => false, 'error' => 'duplicate',
                'message' => 'این تامین‌کننده قبلاً با ' . $dupFound['why'] . ' در سیستم ثبت شده است' .
                    ($dupFound['co'] ? ' («' . $dupFound['co'] . '»' . ($dupFound['code'] ? ' — ' . $dupFound['code'] : '') . ')' : '') .
                    '. اگر رکورد متعلق به شماست، نیازی به ثبت مجدد نیست؛ کارشناسان ما با شما تماس می‌گیرند.'
            ], JSON_UNESCAPED_UNICODE);
            break;
        }
        $suppliers = load_data('suppliers');
        $suppliers[] = [
            'code' => $code,
            'src' => 'site',
            'company' => clean($_POST['company'] ?? ''),
            'name' => clean($_POST['name'] ?? ''),
            'phone' => clean($_POST['phone'] ?? ''),
            'category' => clean($_POST['category'] ?? ''),
            'type' => clean($_POST['type'] ?? ''),
            'brands' => clean($_POST['brands'] ?? ''),
            'email' => clean($_POST['email'] ?? ''),
            'message' => clean($_POST['message'] ?? '', 2000),
            'attachment' => $attachment,
            'payTerms' => $supPayTerms,
            'creditRange' => $supCreditRange,
            'payScore' => $supPayScore,
            'status' => 'pending',
            'statusText' => 'ثبت‌نام شده — در انتظار بررسی و تایید مدیران',
            'date' => date('Y-m-d H:i'),
            'approvedBy' => null
        ];
        save_data('suppliers', $suppliers);
        push_event_rec('supplier_site', 'یک تامین‌کننده در سایت ثبت‌نام کرد و منتظر بررسی است: ' . clean($_POST['company'] ?? '') . ' (' . $code . ')', ['code' => $code]);
        echo json_encode(['ok' => true, 'code' => $code, 'warning' => $attachmentWarning], JSON_UNESCAPED_UNICODE);
        break;


    // ===== v34.7.67 (CHAT-LEAD-001): «ارسال گفتگو به کارشناس» از ویجت چت → لید واقعی CRM =====
    case 'chat_lead':
        $leadName = clean($_POST['name'] ?? '', 120);
        $leadPhone = preg_replace('/\D/', '', (string)($_POST['phone'] ?? ''));
        $leadSummary = clean($_POST['summary'] ?? '', 1200);
        if ($leadName === '' || $leadPhone === '') { echo json_encode(['ok' => false, 'error' => 'نام و شماره تماس الزامی است'], JSON_UNESCAPED_UNICODE); break; }
        $leads = load_data('ptf_crm_leads');
        $leads[] = [
            'cd' => 'LEAD-' . strtoupper(substr(hash('sha256', uniqid('', true) . $leadPhone), 0, 8)),
            'co' => $leadName, 'person' => $leadName, 'mob' => $leadPhone, 'tel' => '',
            'ind' => 'سایر', 'src' => 'چت هوشمند',
            'firstISO' => date('Y-m-d'), 'firstFa' => date('Y/m/d'),
            'need' => 'گفتگوی چت هوشمند سایت:' . "\n" . $leadSummary,
            'stage' => 'new', 'createdFa' => date('Y/m/d')
        ];
        save_data('ptf_crm_leads', $leads);
        echo json_encode(['ok' => true], JSON_UNESCAPED_UNICODE);
        break;

    // ===== US-134: رهگیری دوبخشی (استعلام + ثبت‌نام تامین‌کننده) =====
    case 'track':
        $code = strtoupper(clean($_REQUEST['code'] ?? '', 60));
        if (!$code) { echo json_encode(['ok' => false, 'error' => 'کد رهگیری وارد نشده']); break; }
        $found = null; $type = '';
        foreach (load_data('rfqs') as $r) {
            if (strtoupper($r['code'] ?? '') === $code) { $found = $r; $type = 'rfq'; break; }
        }
        if (!$found) {
            foreach (load_data('suppliers') as $s) {
                if (strtoupper($s['code'] ?? '') === $code) { $found = $s; $type = 'supplier'; break; }
            }
        }
        if (!$found) { echo json_encode(['ok' => false, 'error' => 'notfound'], JSON_UNESCAPED_UNICODE); break; }
        /* v31.7.30 US-RFQ-TRACK-POLISH: نگاشت وضعیت داخلی CRM به پیام مشتری‌پسند —
           متن‌های عملیاتی داخلی (تامین/آماده‌سازی/...) همان‌طور که هست به مشتری نشت نکند. */
        if ($type === 'rfq') {
            $st = $found['status'] ?? '';
            $pubMap = [
                'pending'  => 'ثبت شد — در انتظار بررسی کارشناسان',
                'approved' => 'تایید شد — در حال بررسی فنی و تامین',
                'rejected' => $found['statusText'] ?? 'مختومه',
                'st1' => 'دریافت شد — در حال بررسی اولیه',
                'st2' => 'در حال بررسی فنی',
                'stTO' => 'در حال تهیه پیشنهاد فنی',
                'stCO' => 'در حال تهیه پیشنهاد مالی',
                'st3' => 'پیشنهاد ارسال شد — در انتظار نظر شما',
                'st4' => 'پیش‌فاکتور صادر شد',
                'st5' => 'سفارش شما ابلاغ شد — در حال اجرا',
                'st8' => 'سفارش در حال تامین است',
                'st9' => 'کالا تامین شد — در حال آماده‌سازی',
                'st6' => 'در حال آماده‌سازی و ارسال',
                'st7' => 'تحویل شد — با سپاس از اعتماد شما',
                'stX' => 'مختومه'
            ];
            if (isset($pubMap[$st])) $found['statusText'] = $pubMap[$st];
        }
        /* v34.7.67 (CHAT-PUBLIC-STATUS): وضعیت سفارش ابلاغ‌شده — فقط مرحلهٔ عمومی، بدون نشت مبلغ/نام/تاریخ مالی. */
        $order = null;
        if ($type === 'rfq') {
            $wonCO = null;
            foreach (load_data('ptf_crm_offers') as $o) {
                if (($o['kind'] ?? '') === 'CO' && ($o['st'] ?? '') === 'won' && in_array($code, [($o['inqNo'] ?? ''), ($o['srcRfq'] ?? '')], true)) { $wonCO = $o; break; }
            }
            if ($wonCO) {
                $deal = null;
                foreach (load_data('ptf_crm_deals') as $d) {
                    if (($d['offerNo'] ?? '') === ($wonCO['no'] ?? '')) { $deal = $d; break; }
                }
                $orderStages = [
                    'won' => 'سفارش شما ابلاغ شد — در حال آماده‌سازی',
                    'ship' => 'در حال حمل / ارسال کالا',
                    'invoice' => 'فاکتور صادر شد — در حال تحویل / ترخیص',
                    'settle' => 'تحویل و تسویه انجام شد — با سپاس از اعتماد شما'
                ];
                $cur = 'won';
                if ($deal) {
                    foreach ((array)($deal['events'] ?? []) as $e) {
                        $stp = $e['step'] ?? '';
                        if (isset($orderStages[$stp])) $cur = $stp;
                    }
                }
                $keys = array_keys($orderStages);
                $idx = array_search($cur, $keys, true);
                $order = ['stageKey' => $cur, 'stage' => $orderStages[$cur], 'stages' => array_values($orderStages), 'currentIndex' => ($idx === false ? 0 : $idx)];
            }
        }
        $reopen = false; $rejectType = ''; $note = '';
        if ($type === 'supplier') {
            $reopen = !empty($found['reopen']);
            $rejectType = (string)($found['rejectType'] ?? '');
            $note = (string)($found['note'] ?? '');
        }
        echo json_encode([
            'ok' => true, 'type' => $type,
            'code' => $found['code'],
            'company' => $found['company'] ?? '',
            'category' => $found['category'] ?? '',
            'status' => $found['status'] ?? '',
            'statusText' => $found['statusText'] ?? '',
            'date' => $found['date'] ?? '',
            'order' => $order,
            'reopen' => $reopen, 'rejectType' => $rejectType, 'note' => $note
        ], JSON_UNESCAPED_UNICODE);
        break;

    // ===== US-133: صندوق ورودی سرور برای CRM (merge در مرورگر ادمین) =====
    /* v34.7.81 (SUP-PERF-001): صندوق ورودی «ثبت‌نام‌شده از سایت» هر ۴۵ ثانیه و هر بوت
       خوانده می‌شود. دو بهینه:
       ۱) پاسخ با ptf_echo_json ارسال می‌شود (gzip در صورت پشتیبانی مرورگر) — قبلاً
          بدون فشرده‌سازی بود و با رشد suppliers.json حجمش روی سیم زیاد می‌شد.
       ۲) کلاینت یک امضای ارزان (mtime+size دو فایل) می‌فرستد؛ اگر هیچ چیزی تغییر
          نکرده باشد فقط {fresh:true} برمی‌گردد و دانلود کامل صندوق تکرار نمی‌شود. */
    case 'get_inbox':
        verify_request();
        $supFile = $data_dir . '/suppliers.json';
        $rfqFile = $data_dir . '/rfqs.json';
        $sig = (int)(is_file($supFile) ? @filemtime($supFile) : 0) . ':' . (int)(is_file($supFile) ? @filesize($supFile) : 0)
             . '::' . (int)(is_file($rfqFile) ? @filemtime($rfqFile) : 0) . ':' . (int)(is_file($rfqFile) ? @filesize($rfqFile) : 0);
        /* v34.7.85 (SUP-PERF-004) + v34.7.86 (SUP-PERF-005): صفحه‌بندی اختیاری.
           fresh فقط وقتی مجاز است که صفحه‌بندی درخواست نشده باشد؛ وگرنه درخواست
           صفحهٔ بعدی با همان since به‌درستی دادهٔ صفحه را برمی‌گرداند. */
        $limit = (int)($_REQUEST['limit'] ?? 0);
        $offset = max(0, (int)($_REQUEST['offset'] ?? 0));
        $since = trim((string)($_REQUEST['since'] ?? ''));
        if ($limit === 0 && $offset === 0 && $since !== '' && hash_equals($since, $sig)) {
            ptf_echo_json(['ok' => true, 'fresh' => true, 'since' => $sig]);
            break;
        }
        $allSuppliers = load_data('suppliers');
        $siteRfqs = array_values(array_filter(load_data('rfqs'), function ($r) { return ($r['src'] ?? '') === 'site'; }));
        $supTotal = count($allSuppliers);
        $rfqTotal = count($siteRfqs);
        if ($limit > 0) {
            $allSuppliers = array_slice($allSuppliers, $offset, $limit);
            /* rfqs مثل قبل کامل می‌ماند؛ pagination فقط برای suppliers است. */
        }
        ptf_echo_json([
            'ok' => true,
            'since' => $sig,
            'suppliers' => $allSuppliers,
            'rfqs' => $siteRfqs,
            'limit' => $limit > 0 ? $limit : $supTotal,
            'offset' => $offset,
            'supTotal' => $supTotal,
            'rfqTotal' => $rfqTotal
        ]);
        break;

    // ===== US-133: به‌روزرسانی وضعیت از CRM (تایید/رد) → بازتاب در رهگیری سایت =====
    case 'set_status':
        verify_request();
        $type = $_POST['type'] ?? '';
        $code = clean($_POST['code'] ?? '', 60);
        $status = clean($_POST['status'] ?? '', 40);
        $statusText = clean($_POST['statusText'] ?? '', 200);
        $by = clean($_POST['by'] ?? '', 100);
        $rejectType = clean($_POST['rejectType'] ?? '', 40);
        $note = clean($_POST['note'] ?? '', 300);
        $reopen = ($_POST['reopen'] ?? '') === '1' || ($_POST['reopen'] ?? '') === 'true';
        $key = $type === 'supplier' ? 'suppliers' : 'rfqs';
        $items = load_data($key);
        $done = false;
        $smsPhone = ''; $smsStatus = ''; $smsRejectType = '';
        foreach ($items as &$it) {
            if (($it['code'] ?? '') === $code) {
                $it['status'] = $status ?: $it['status'];
                $it['statusText'] = $statusText ?: $it['statusText'];
                if ($by) $it['approvedBy'] = $by;
                if ($status === 'rejected') {
                    $it['reopen'] = $reopen;
                    $it['rejectType'] = $rejectType;
                    if ($note !== '') $it['note'] = $note;
                }
                if ($status === 'approved' && $note !== '') $it['apprNote'] = $note;
                $smsPhone = preg_replace('/\D/', '', (string)($it['phone'] ?? ($it['ph'] ?? '')));
                $smsStatus = $status;
                $smsRejectType = $rejectType;
                $done = true;
            }
        }
        if ($done) save_data($key, $items);
        /* v34.7.71 (SUP-SMS-001): پیامک ثبت/رد تامین‌کننده */
        $smsSent = false;
        if ($done && $type === 'supplier' && $smsPhone !== '' && sms_enabled()) {
            if ($smsStatus === 'approved') {
                $smsSent = sms_send($smsPhone, "پیشرو تجهیز فرتاک\nدرخواست ثبت‌نام تامین‌کنندگی شما تایید شد؛ به‌زودی کارشناسان ما با شما تماس می‌گیرند.\n021-46087679");
            } elseif ($smsStatus === 'rejected') {
                if ($smsRejectType === 'docs') {
                    $smsSent = sms_send($smsPhone, "پیشرو تجهیز فرتاک\nمدارک شما ناقص است؛ لطفاً مدارک را تکمیل و دوباره از سایت ثبت‌نام کنید.\n021-46087679");
                } else {
                    $smsSent = sms_send($smsPhone, "پیشرو تجهیز فرتاک\nدرخواست شما در این مرحله پذیرفته نشد" . ($note ? '.\n' . mb_substr($note, 0, 120) : '.') . "\n021-46087679");
                }
            }
        }
        echo json_encode(['ok' => $done, 'sms' => $smsSent], JSON_UNESCAPED_UNICODE);
        break;

    // ===== v34.7.74 (SUP-SITE-DELETE): حذف رکورد ثبت‌نام تامین‌کنندهٔ سایت =====
    case 'del_supplier_site':
        verify_request();
        role_guard('approve_write'); // فقط مدیران ارشد
        $type = $_POST['type'] ?? 'supplier';
        $code = clean($_POST['code'] ?? '', 60);
        /* فقط صندوق ثبت‌نام سایت قابل حذف است؛ نه فهرست تاییدشدهٔ CRM */
        $key = $type === 'supplier' ? 'suppliers' : 'rfqs';
        $items = load_data($key);
        $before = count($items);
        $items = array_values(array_filter($items, function ($it) use ($code) {
            return (($it['code'] ?? '') !== $code);
        }));
        $removed = count($items) < $before;
        if ($removed) save_data($key, $items);
        echo json_encode(['ok' => $removed, 'removed' => $removed ? 1 : 0], JSON_UNESCAPED_UNICODE);
        break;

    // ===== US-138: رویدادهای لحظه‌ای (پیام‌رسانی بین کاربران CRM) =====
    case 'push_event':
        verify_request();
        $id = push_event_rec(
            clean($_POST['kind'] ?? 'info', 40),
            clean($_POST['title'] ?? '', 300),
            json_decode($_POST['data'] ?? '{}', true) ?: []
        );
        echo json_encode(['ok' => true, 'id' => $id]);
        break;

    case 'get_events':
        verify_request();
        $since = (int)($_REQUEST['since'] ?? 0);
        $ev = array_values(array_filter(load_data('events'), function ($e) use ($since) { return ($e['id'] ?? 0) > $since; }));
        $last = count($ev) ? $ev[count($ev) - 1]['id'] : $since;
        echo json_encode(['ok' => true, 'events' => $ev, 'last' => $last], JSON_UNESCAPED_UNICODE);
        break;

    // ===== US-146: بک‌آپ خودکار ساعتی (ذخیره سروری + تلاش آپلود آروان) =====
    case 'save_backup':
        verify_request();
        $raw = file_get_contents('php://input');
        if (strlen($raw) > 50 * 1048576) { echo json_encode(['ok' => false, 'error' => 'حجم بک‌آپ بیش از حد']); break; }
        $j = json_decode($raw, true);
        if (!$j || empty($j['data'])) { echo json_encode(['ok' => false, 'error' => 'ساختار بک‌آپ نامعتبر']); break; }
        $bdir = $data_dir . '/backups';
        if (!is_dir($bdir)) { mkdir($bdir, 0755, true); file_put_contents($bdir . '/.htaccess', "Deny from all\n"); }
        /* v33.16.0: چرخش مشترک (سپر + gzip + ساعتی/روزانه/هفتگی/ماهانه + آروان) */
        echo json_encode(ptf_rotate_backup($bdir, $raw, $j), JSON_UNESCAPED_UNICODE);
        break;

    case 'save_backup_delta':
        /* v33.16.0 (فاز ۲ بکاپ): دریافت فقط کلیدهای تغییرکرده و ادغام با آخرین بکاپ کامل —
           حجم ارسال و زمان پردازش به‌شدت کاهش می‌یابد؛ فایل نهایی همچنان کامل است. */
        verify_request();
        $raw = file_get_contents('php://input');
        if (strlen($raw) > 30 * 1048576) { echo json_encode(['ok' => false, 'error' => 'حجم دلتا بیش از حد']); break; }
        $j = json_decode($raw, true);
        if (!$j || empty($j['delta']) || !is_array($j['delta'])) { echo json_encode(['ok' => false, 'error' => 'ساختار دلتا نامعتبر']); break; }
        $bdir = $data_dir . '/backups';
        if (!is_dir($bdir)) { mkdir($bdir, 0755, true); file_put_contents($bdir . '/.htaccess', "Deny from all\n"); }
        /* لود آخرین بک‌آپ کامل به‌عنوان پایه */
        $exF = null;
        foreach (['/hourly-latest.json.gz', '/hourly-latest.json'] as $cand) { if (file_exists($bdir . $cand)) { $exF = $bdir . $cand; break; } }
        if (!$exF) { echo json_encode(['ok' => false, 'error' => 'ابتدا یک بک‌آپ کامل بفرستید', 'needFull' => true]); break; }
        $exRaw = (substr($exF, -3) === '.gz' && function_exists('gzdecode')) ? @gzdecode(@file_get_contents($exF)) : @file_get_contents($exF);
        $ex = $exRaw ? json_decode($exRaw, true) : null;
        if (!$ex || empty($ex['data']) || !is_array($ex['data'])) { echo json_encode(['ok' => false, 'error' => 'بک‌آپ پایه خراب است — بک‌آپ کامل بفرستید', 'needFull' => true]); break; }
        /* اپلای دلتا */
        foreach ($j['delta'] as $k => $v) { $ex['data'][$k] = $v; }
        if (!empty($j['removed']) && is_array($j['removed'])) { foreach ($j['removed'] as $k) { unset($ex['data'][$k]); } }
        /* بازمحاسبه counts */
        $ex['counts'] = [];
        foreach ($ex['data'] as $k => $v) { $dd = json_decode((string)$v, true); $ex['counts'][$k] = is_array($dd) ? count($dd) : 1; }
        $ex['t'] = date('Y-m-d H:i:s');
        if (!empty($j['tFa'])) $ex['tFa'] = $j['tFa'];
        if (!empty($j['by'])) $ex['by'] = $j['by'];
        $newRaw = json_encode($ex, JSON_UNESCAPED_UNICODE);
        if (!$newRaw || strlen($newRaw) > 50 * 1048576) { echo json_encode(['ok' => false, 'error' => 'بک‌آپ تلفیقی نامعتبر']); break; }
        $res = ptf_rotate_backup($bdir, $newRaw, $ex);
        $res['delta'] = count($j['delta']);
        echo json_encode($res, JSON_UNESCAPED_UNICODE);
        break;

    case 'list_backups':
        verify_request();
        $bdir = $data_dir . '/backups';
        $out = [];
        if (is_dir($bdir)) {
            foreach (array_merge(glob($bdir . '/*.json') ?: [], glob($bdir . '/*.json.gz') ?: []) as $f) {
                $out[] = ['name' => basename($f), 'size' => filesize($f), 't' => date('Y-m-d H:i:s', filemtime($f))];
            }
        }
        usort($out, function($a,$b){ return strcmp((string)($b['t']??''),(string)($a['t']??'')); });
        echo json_encode(['ok' => true, 'backups' => $out], JSON_UNESCAPED_UNICODE);
        break;

    case 'sync_stats':
        /* v34.8.12 (PHASE-C1): گزارش تله‌متری push به تفکیک کلید — فقط-خواندنی.
           ترتیب: بیشترین تعداد push اول؛ مبنای اولویت‌بندی «نازک‌سازی» (فاز C3). */
        verify_request();
        role_guard('users_write'); // فقط ادمین/رییس
        $statsFile = $data_dir . '/sync/push_stats.json';
        $stats = is_file($statsFile) ? (json_decode((string)file_get_contents($statsFile), true) ?: []) : [];
        $rows = [];
        $win7From = date('Y-m-d', strtotime('-6 days'));
        foreach ($stats as $key => $row) {
            if (!is_array($row)) continue;
            /* v34.8.42 (R4-گام۱): win7 = مجموع push توده‌ای در ۷ روز آخر (۷ سطل)؛
               null یعنی تله‌متری روزانه هنوز جمع نشده (ردیف قدیمی) → شواهد ناکافی. */
            $win7 = null; $win7Days = 0;
            if (is_array($row['d'] ?? null)) {
                $win7 = 0;
                foreach ($row['d'] as $dk => $dn) { if ($dk >= $win7From) { $win7 += (int)$dn; $win7Days++; } }
            }
            $rows[] = [
                'key' => (string)$key,
                'win7' => $win7,
                'win7Days' => $win7Days,
                'pushes' => (int)($row['n'] ?? 0),
                'bytesTotal' => (int)($row['bytes'] ?? 0),
                'avgBytes' => ((int)($row['n'] ?? 0) > 0) ? (int)round(((int)($row['bytes'] ?? 0)) / max(1,(int)($row['n'] ?? 1))) : 0,
                'conflicts' => (int)($row['conflicts'] ?? 0),
                'rejects' => (int)($row['rejects'] ?? 0),
                'lastAt' => (string)($row['lastAt'] ?? ''),
                'lastBy' => (string)($row['lastBy'] ?? '')
            ];
        }
        usort($rows, function($a,$b){ return ($b['pushes'] <=> $a['pushes']) ?: ($b['conflicts'] <=> $a['conflicts']); });
        echo json_encode(['ok' => true, 'since' => 'v34.8.12', 'win7From' => $win7From, 'keys' => count($rows), 'stats' => $rows], JSON_UNESCAPED_UNICODE);
        break;

    case 'sync_engine_flags':
        /* v34.8.42 (R4-گام۱ — RETIRE-LEGACY-SYNC): وضعیت پرچم‌های بازنشستگی موتور
           سینک legacy — فقط‌خواندنی؛ ادمین/رئیس. کلاینت این JSON را با TTL کش می‌کند. */
        verify_request();
        role_guard('users_write');
        $flagsFile = $data_dir . '/sync/engine_flags.json';
        $flagsPayload = is_file($flagsFile) ? (json_decode((string)file_get_contents($flagsFile), true) ?: []) : [];
        $offNow = is_array($flagsPayload['legacyPushOff'] ?? null) ? $flagsPayload['legacyPushOff'] : [];
        echo json_encode(['ok' => true, 'legacyPushOff' => $offNow, 'since' => 'v34.8.42'], JSON_UNESCAPED_UNICODE);
        break;

    case 'sync_engine_flag_set':
        /* v34.8.42 (R4-گام۱ — RETIRE-LEGACY-SYNC): کلید قطع PTF_LEGACY_PUSH_OFF برای
           یک کلید سینک. گیت شواهد: خاموش‌کردن push توده‌ای فقط با پنجرهٔ ۷روزهٔ ≈ صفر
           (win7 ≤ 3) یا force صریح + دلیل؛ هر تغییر با کاربر/زمان/دلیل ثبت و کاملاً
           بازگشت‌پذیر است (off=0). اثر گام ۱ = صفر به‌صورت پیش‌فرض (fail-open کلاینت). */
        verify_request();
        role_guard('users_write');
        $fkey = clean($_POST['key'] ?? '', 80);
        $off = (($_POST['off'] ?? '') === '1');
        $reason = clean($_POST['reason'] ?? '', 200);
        $force = (($_POST['force'] ?? '') === '1');
        $by = clean($_POST['by'] ?? '', 80);
        if ($fkey === '' || !in_array($fkey, sync_all_keys(), true)) { echo json_encode(['ok' => false, 'error' => 'کلید خارج از دامنهٔ سینک است'], JSON_UNESCAPED_UNICODE); break; }
        $sdirEng = $data_dir . '/sync';
        if (!is_dir($sdirEng)) { mkdir($sdirEng, 0755, true); file_put_contents($sdirEng . '/.htaccess', "Deny from all\n"); }
        $statsEng = is_file($sdirEng . '/push_stats.json') ? (json_decode((string)file_get_contents($sdirEng . '/push_stats.json'), true) ?: []) : [];
        $win7now = null;
        if (isset($statsEng[$fkey]) && is_array($statsEng[$fkey]['d'] ?? null)) {
            $win7now = 0; $fromEng = date('Y-m-d', strtotime('-6 days'));
            foreach ($statsEng[$fkey]['d'] as $dkE => $dnE) { if ($dkE >= $fromEng) $win7now += (int)$dnE; }
        }
        if ($off && !$force && ($win7now === null || $win7now > 3)) {
            echo json_encode(['ok' => false, 'win7' => $win7now, 'error' => ($win7now === null
                ? 'شواهد پنجرهٔ ۷روزه برای این کلید موجود نیست (تله‌متری روزانه از v34.8.42 جمع می‌شود) — برای عبور، force همراه دلیل لازم است'
                : 'پنجرهٔ ۷روزهٔ push توده‌ای این کلید صفر نیست (' . $win7now . ' بار) — برای عبور، force همراه دلیل لازم است')], JSON_UNESCAPED_UNICODE);
            break;
        }
        if ($off && $force && mb_strlen($reason) < 5) { echo json_encode(['ok' => false, 'error' => 'عبور اجباری نیازمند دلیل ثبت‌شدنی است (حداقل ۵ نویسه)'], JSON_UNESCAPED_UNICODE); break; }
        $flagsFileEng = $sdirEng . '/engine_flags.json';
        $payloadEng = is_file($flagsFileEng) ? (json_decode((string)file_get_contents($flagsFileEng), true) ?: []) : [];
        if (!is_array($payloadEng['legacyPushOff'] ?? null)) $payloadEng['legacyPushOff'] = [];
        if ($off) $payloadEng['legacyPushOff'][$fkey] = ['at' => date('Y-m-d H:i:s'), 'by' => $by, 'reason' => $reason, 'win7AtSet' => $win7now];
        else unset($payloadEng['legacyPushOff'][$fkey]);
        $payloadEng['updatedAt'] = date('Y-m-d H:i:s');
        $tmpEng = $flagsFileEng . '.tmp.' . bin2hex(random_bytes(4));
        if (@file_put_contents($tmpEng, json_encode($payloadEng, JSON_UNESCAPED_UNICODE), LOCK_EX) === false) { @unlink($tmpEng); echo json_encode(['ok' => false, 'error' => 'نوشتن فایل پرچم ناموفق بود'], JSON_UNESCAPED_UNICODE); break; }
        @rename($tmpEng, $flagsFileEng);
        echo json_encode(['ok' => true, 'key' => $fkey, 'off' => $off, 'win7' => $win7now, 'legacyPushOff' => $payloadEng['legacyPushOff']], JSON_UNESCAPED_UNICODE);
        break;

    case 'sessions_list':
        /* v34.8.46 (R6/T7-ب): نشست‌های فعال — فقط متادیتا (بدون مقدار توکن)؛ ادمین/رئیس */
        verify_request();
        role_guard('users_write');
        $sessNow = time();
        $sessRows = [];
        foreach (auth_load_tokens() as $tS => $iS) {
            if (!is_array($iS) || (int)($iS['exp'] ?? 0) < $sessNow) continue;
            $sessRows[] = [
                'user' => (string)($iS['user'] ?? ''),
                'role' => (string)($iS['role'] ?? ''),
                'iat' => (int)($iS['iat'] ?? 0),
                'exp' => (int)($iS['exp'] ?? 0),
                'ip' => (string)($iS['ip'] ?? ''),
                'current' => hash_equals((string)$tS, auth_get_header_token()),
            ];
        }
        usort($sessRows, function ($a, $b) { return strcmp((string)$b['iat'], (string)$a['iat']); });
        echo json_encode(['ok' => true, 'sessions' => $sessRows, 'count' => count($sessRows)], JSON_UNESCAPED_UNICODE);
        break;

    case 'sessions_revoke':
        /* v34.8.46 (R6/T7-ب): ابطال گروهی توکن‌ها — «همه» یا یک کاربر؛
           نشست همین ادمین (توکن درخواست‌کننده) همیشه زنده می‌ماند تا خودش لاک‌اوت نشود. */
        verify_request();
        role_guard('users_write');
        if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
            http_response_code(405);
            echo json_encode(['ok' => false, 'error' => 'method_not_allowed']);
            break;
        }
        $revTarget = clean($_POST['user'] ?? 'all', 80);
        $revKeep = auth_get_header_token();
        $revMe = auth_verify_token($revKeep);
        $revUser = is_array($revMe) ? (string)($revMe['user'] ?? '') : '(unknown)';
        $revTokens = auth_load_tokens();
        $revNow = time();
        $revokedN = 0;
        foreach ($revTokens as $tR => $iR) {
            if ($tR === $revKeep) continue;
            if (!is_array($iR) || (int)($iR['exp'] ?? 0) < $revNow) continue;
            if ($revTarget !== 'all' && strcasecmp((string)($iR['user'] ?? ''), $revTarget) !== 0) continue;
            unset($revTokens[$tR]);
            $revokedN++;
        }
        auth_save_tokens($revTokens);
        twofa_log('sessions_revoked', $revUser, ($revTarget === 'all' ? 'all' : $revTarget) . ' — ' . $revokedN . ' token(s)');
        echo json_encode(['ok' => true, 'revoked' => $revokedN, 'target' => $revTarget], JSON_UNESCAPED_UNICODE);
        break;

    case 'get_backup':
        verify_request();
        role_guard('users_write'); // فقط ادمین/رییس
        $name = basename(clean($_REQUEST['name'] ?? '', 80));
        if (!preg_match('/^(hourly-latest|weekly-latest|monthly-latest|daily-\d{4}-\d{2}-\d{2}|suspect-\d{4}-\d{2}-\d{2}-\d{6})\.json(\.gz)?$/', $name)) { /* v15.0 US-384: suspect برای بررسی ادمین */
            echo json_encode(['ok' => false, 'error' => 'نام فایل نامعتبر']); break;
        }
        $f = $data_dir . '/backups/' . $name;
        if (!file_exists($f)) { echo json_encode(['ok' => false, 'error' => 'یافت نشد']); break; }
        // v122.3: فایل‌های gz به‌صورت شفاف باز می‌شوند — کلاینت همیشه JSON خام می‌گیرد
        if (substr($name, -3) === '.gz' && function_exists('readgzfile')) readgzfile($f);
        else readfile($f);
        break;

    // ===== US-151 فاز ۲: همگام‌سازی کل داده CRM بین دستگاه‌ها =====
    // مدل: هر کلید یک فایل + نسخه (rev) سراسری؛ آخرین نویسنده می‌برد + ثبت زمان/کاربر
    case 'data_push':
        // v31.7.4 BUG-AUDIT-009 FIXED: verify_request is redundant here because
        // token verification is already done above for all sensitive actions including data_push.
        // Removing redundant call to avoid confusion.
        // verify_request(); // REMOVED - already verified above
        // همه نقش‌های CRM می‌نویسند (حسابدار فاکتور، فروش لید و…)؛ session سروری کامل در فاز ۳
        $raw = file_get_contents('php://input');
        if (strlen($raw) > 40 * 1048576) { echo json_encode(['ok' => false, 'error' => 'حجم بیش از حد']); break; }
        $j = json_decode($raw, true);
        if (!$j || !isset($j['data']) || !is_array($j['data'])) { echo json_encode(['ok' => false, 'error' => 'ساختار نامعتبر']); break; }
        $allowed_keys = sync_all_keys();
        $role_sync_keys = sync_allowed_keys_for_role($client_role);
        $forbidden_keys = [];
        $sdir = $data_dir . '/sync';
        if (!is_dir($sdir)) { mkdir($sdir, 0755, true); file_put_contents($sdir . '/.htaccess', "Deny from all\n"); }
        $meta_file = $sdir . '/meta.json';
        $meta = file_exists($meta_file) ? (json_decode(file_get_contents($meta_file), true) ?: []) : [];
        $saved = 0;
        /* ACK per-key: کلاینت فقط کلیدی را از صف محلی حذف می‌کند که سرور صراحتاً
           تأیید کرده است. صرف ok بودن پاسخ کافی نیست؛ ممکن است کلید به‌دلیل سپر
           داده‌صفر، نقش، یا payload نامعتبر ذخیره نشده باشد. */
        $saved_keys = [];
        $skipped_keys = [];
        $dbWriteFailed = false; /* v33.22.0: شکست نوشتن DB در mode=mysql → کل پاسخ ناموفق + retry */
        $rejected = []; /* v14.7 US-382 */
        $conflicts = []; $conflictData = []; $protectedConflicts = []; $krevs = []; /* v15.0 US-384 + v34.8.5 finance protection */
        $allow_wipe = !empty($j['allow_wipe']); /* فقط مسیر Go-Live (US-377) این فلگ را می‌فرستد */
        $restore = !empty($j['restore']); /* بازگردانی کامل سرور */
        if ($restore && !in_array($client_role, ['admin','chairman'], true)) { http_response_code(403); echo json_encode(['ok'=>false,'error'=>'restore_permission_denied']); break; }
        $base = (isset($j['base']) && is_array($j['base'])) ? $j['base'] : null; /* v15.0: نسخه‌ای که کلاینت از هر کلید می‌شناسد */
        /* ===== v31.7.3 BUG-AUDIT-001-SYNC-RACE: flock برای meta.json =====
           جلوگیری از race condition بین دو data_push همزمان. بدون flock:
           Device A و B هر دو meta را rev=5 می‌خوانند → هر دو rev=6 می‌نویسند → lost update.
           با flock: دومی منتظر می‌ماند تا اولی تمام شود و rev واقعی را می‌بیند. */
        $metaLock = @fopen($meta_file . '.lock', 'c+');
        if (!$metaLock || !@flock($metaLock, LOCK_EX)) {
            if ($metaLock) @fclose($metaLock);
            http_response_code(503);
            echo json_encode(['ok'=>false,'error'=>'sync_lock_unavailable','needRetry'=>true], JSON_UNESCAPED_UNICODE);
            break;
        }
        /* re-read meta only after the shared lock is definitely held */
        $meta = file_exists($meta_file) ? (json_decode(file_get_contents($meta_file), true) ?: []) : [];
        /* v34.8.6/F0-1: همهٔ کلیدهای موفق یک data_push یک watermark مشترک می‌گیرند.
           پیش از این هر کلید با rev قبلی خودش +۱ نوشته می‌شد و global rev جداگانه
           جلو می‌رفت؛ نتیجه همان ناهماهنگی مشاهده‌شده بین global و krevs کلاینت بود. */
        $pushNextRev = (int)($meta['_global']['rev'] ?? 0) + 1;
        /* v34.7.43: اگر process فرمان فروش پس از انتشار بخشی از projectionها قطع شده
           باشد، WAL باید ابتدا توسط همان sales-domain و زیر همین lock بازیابی شود.
           data_push عمومی حق ندارد snapshot کامل دیگری را روی تراکنش نیمه‌تمام بنویسد. */
        $pendingSalesTx = glob($sdir . '/.sales-tx-*.json') ?: [];
        if ($pendingSalesTx) {
            if ($metaLock) { @flock($metaLock, LOCK_UN); @fclose($metaLock); }
            http_response_code(503);
            echo json_encode(['ok'=>false,'error'=>'pending_sales_transaction_recovery','needRetry'=>true], JSON_UNESCAPED_UNICODE);
            break;
        }
        /* v33.22.0: خواندن از مسیر یکپارچه (در mode=mysql از دیتابیس) */
        $serverArchiveJson = sync_key_read($sdir, 'ptf_crm_deleted_archive');
        if ($serverArchiveJson === null) $serverArchiveJson = '[]';
        $incomingArchiveJson = isset($j['data']['ptf_crm_deleted_archive']) && is_string($j['data']['ptf_crm_deleted_archive']) ? $j['data']['ptf_crm_deleted_archive'] : '[]';
        foreach ($j['data'] as $k => $v) {
            if (!in_array($k, $allowed_keys, true)) { $skipped_keys[] = $k; continue; }
            if (!in_array($k, $role_sync_keys, true)) { $forbidden_keys[] = $k; continue; }
            if (!is_string($v) || strlen($v) > 8 * 1048576) { $skipped_keys[] = $k; continue; }
            /* Restore تاییدشده باید snapshot انتخابی را authoritative کند؛ tombstone جدیدتر
               سرور نباید رکوردهای همان بک‌آپ را دوباره حذف کند. */
            $v = sync_apply_tombstones($k, $v, $restore ? '' : $serverArchiveJson, $incomingArchiveJson);
            /* v34.8.7: کلیدهای مشترکِ union پیش از بررسی base merge سروری می‌گیرند؛
               تعارضِ base برای آنها بی‌معناست چون نتیجهٔ merge نویسندهٔ هیچ دستگاهی را
               نمی‌پاکاند و ACK صادقانه است. */
            $isSharedUnion = (!$restore && !$allow_wipe && sync_shared_union_key($k));
            if ($isSharedUnion) {
                $serverUnionJson = sync_key_read($sdir, $k);
                $mergedUnionJson = sync_union_merge_shared_key($k, $v, $serverUnionJson);
                if ($mergedUnionJson !== null) $v = $mergedUnionJson;
            }
            /* v31.8 BUG-OFFER-SYNC-INTEGRITY-001: do not accept a stale client
               payload that increases duplicate offer lines. Existing corrupted
               records are deliberately not auto-mutated here; repair is explicit. */
            if (!$restore && $k === 'ptf_crm_offers') {
                /* v33.22.0: مسیر یکپارچه (mysql → DB) */
                $serverOffersJson = sync_key_read($sdir, 'ptf_crm_offers');
                if ($serverOffersJson === null) $serverOffersJson = '[]';
                if (sync_offers_payload_introduces_duplicates($v, $serverOffersJson) || sync_offers_payload_has_unregistered_new($v, $serverOffersJson)) {
                    $rejected[] = $k;
                    $conflicts[] = $k;
                    $conflictData[$k] = $serverOffersJson;
                    $krevs[$k] = (int)($meta[$k]['rev'] ?? 0);
                    continue;
                }
            }
            /* ===== v15.0 (US-384 — رفع ریشه‌ای Lost Update، کیس استادی «حذف پیش‌نویس با رفرش کاربر دوم»):
               اگر کلاینت نسخه‌ای قدیمی‌تر از سرور را مبنا گرفته باشد (دستگاه دیگری بعد از او نوشته)،
               نوشتن کورکورانه رد می‌شود؛ نسخه فعلی سرور برگردانده می‌شود تا کلاینت با ptfSmartMerge
               ادغام و دوباره ارسال کند — هیچ رکوردی از هیچ دستگاهی گم نمی‌شود.
               (کلاینت‌های قدیمی بدون base مثل قبل پذیرفته می‌شوند — سازگاری عقب‌رو دوره گذار) ===== */
            $curRev = (int)($meta[$k]['rev'] ?? 0);
            $isProtectedFinanceKey = in_array($k, ['ptf_crm_opex','ptf_crm_sharetx','ptf_crm_shareholders'], true);
            if (!$isSharedUnion && !$restore && !$allow_wipe && $base !== null && array_key_exists($k, $base) && (int)$base[$k] < $curRev) {
                $conflicts[] = $k;
                /* v33.22.0: مسیر یکپارچه (mysql → DB) */
                $cfVal = sync_key_read($sdir, $k);
                if ($isProtectedFinanceKey) {
                    /* A stale finance writer must receive the protected merge immediately.
                       Sending the raw server value through generic timestamp merge first can
                       keep forged server-owned fields in the local retry for one more cycle. */
                    $protectedConflicts[] = $k;
                    $protectedConflictJson = sync_merge_protected_finance_snapshot($k, $v, $cfVal === null ? '[]' : $cfVal);
                    if ($protectedConflictJson === null) {
                        $rejected[] = $k;
                        $protectedConflictJson = $cfVal === null ? '[]' : $cfVal;
                    }
                    $conflictData[$k] = sync_apply_tombstones($k, $protectedConflictJson, $serverArchiveJson, $incomingArchiveJson);
                } elseif ($cfVal !== null) {
                    $conflictData[$k] = sync_apply_tombstones($k, $cfVal, $serverArchiveJson, $incomingArchiveJson); /* legacy UAT token: $conflictData[$k] = file_get_contents($cf); */
                }
                $krevs[$k] = $curRev;
                continue;
            }
            /* OPEX/sharetx use merge-on-server even when the caller is a legacy client
               without `base`. If protection changes the submitted snapshot, return a
               conflict instead of silently ACKing a local cache that still lacks rows. */
            if (!$restore && !$allow_wipe && $isProtectedFinanceKey) {
                $serverFinanceJson = sync_key_read($sdir, $k);
                if ($serverFinanceJson === null) $serverFinanceJson = '[]';
                $protectedFinanceJson = sync_merge_protected_finance_snapshot($k, $v, $serverFinanceJson);
                if ($protectedFinanceJson === null) {
                    $rejected[] = $k; $krevs[$k] = $curRev; continue;
                }
                if (!hash_equals(sync_finance_snapshot_signature($v), sync_finance_snapshot_signature($protectedFinanceJson))) {
                    $conflicts[] = $k; $protectedConflicts[] = $k; $conflictData[$k] = $protectedFinanceJson; $krevs[$k] = $curRev; continue;
                }
                $v = $protectedFinanceJson;
            }
            /* ===== v14.7 (US-382 — سپر ضد داده‌صفر): فهرست خالی روی داده ناخالی هرگز پذیرفته نمی‌شود
               مگر با فلگ صریح allow_wipe (Go-Live) یا restore (بازگردانی ادمین). ===== */
            if (!$allow_wipe && !$restore) {
                $newArr = json_decode($v, true);
                if (is_array($newArr) && count($newArr) === 0) {
                    /* v33.22.0: مسیر یکپارچه (mysql → DB) */
                    $exVal = sync_key_read($sdir, $k);
                    if ($exVal !== null) {
                        $exArr = json_decode($exVal, true);
                        if (is_array($exArr) && count($exArr) > 0) { $rejected[] = $k; continue; }
                    }
                }
            }
            /* v33.22.0: نوشتن یکپارچه (فایل همیشه + MySQL با توجه به mode).
               در mode=mysql شکست DB یعنی منبع حقیقت ذخیره نشده → کل پاسخ ناموفق + retry کلاینت. */
            if (!sync_key_write($sdir, $k, $v, $pushNextRev)) { $dbWriteFailed = true; break; }
            $meta[$k] = ['rev' => $pushNextRev, 't' => date('Y-m-d H:i:s'), 'by' => clean($j['by'] ?? '', 60)];
            $krevs[$k] = $pushNextRev;
            $saved_keys[] = $k;
            $saved++;
        }
        if (!empty($dbWriteFailed)) {
            /* idempotent: meta نفرستاده می‌شود؛ کلاینت همان صف را دوباره می‌فرستد و مقادیر همان بازنویسی می‌شوند */
            if ($metaLock) { @flock($metaLock, LOCK_UN); @fclose($metaLock); }
            echo json_encode(['ok' => false, 'error' => 'خطا در ذخیره‌سازی دیتابیس — لطفاً دوباره تلاش کنید', 'needRetry' => true], JSON_UNESCAPED_UNICODE);
            break;
        }
        /* Do not advance the global watermark for an entirely rejected/skipped push. */
        if ($saved > 0) $meta['_global'] = ['rev' => $pushNextRev, 't' => date('Y-m-d H:i:s')];
        file_put_contents($meta_file, json_encode($meta, JSON_UNESCAPED_UNICODE), LOCK_EX);
        /* v34.8.12 (PHASE-C1 — اندازه‌گیری): تله‌متری push به تفکیک کلید زیر همان flock.
           مبنای اولویت‌بندی مهاجرت فاز C3 («نازک‌سازی») بر دادهٔ واقعی، نه حدس. */
        try {
            $statsFile = $sdir . '/push_stats.json';
            $stats = is_file($statsFile) ? (json_decode((string)file_get_contents($statsFile), true) ?: []) : [];
            $byUser = clean($j['by'] ?? '', 60);
            foreach (array_unique(array_merge($saved_keys, $rejected, $conflicts)) as $sk) {
                if (!is_string($sk) || $sk === '') continue;
                $row = $stats[$sk] ?? ['n'=>0,'bytes'=>0,'conflicts'=>0,'rejects'=>0];
                $row['n'] = (int)($row['n'] ?? 0) + 1;
                /* v34.8.42 (R4-گام۱ — RETIRE-LEGACY-SYNC): سطل روزانه برای پنجرهٔ
                   ۷روزهٔ تصمیمِ بازنشستگی موتور legacy؛ هرس به ۱۴ روز آخر. */
                $_today = date('Y-m-d');
                $_d = is_array($row['d'] ?? null) ? $row['d'] : [];
                $_d[$_today] = (int)($_d[$_today] ?? 0) + 1;
                $_cut = date('Y-m-d', strtotime('-13 days'));
                foreach ($_d as $_dk => $_dn) { if ($_dk < $_cut) unset($_d[$_dk]); }
                $row['d'] = $_d;
                if (isset($j['data'][$sk]) && is_string($j['data'][$sk])) $row['bytes'] = (int)($row['bytes'] ?? 0) + strlen($j['data'][$sk]);
                if (in_array($sk, $conflicts, true)) $row['conflicts'] = (int)($row['conflicts'] ?? 0) + 1;
                if (in_array($sk, $rejected, true)) $row['rejects'] = (int)($row['rejects'] ?? 0) + 1;
                $row['lastAt'] = date('Y-m-d H:i:s');
                $row['lastBy'] = $byUser;
                $stats[$sk] = $row;
            }
            if ($stats) {
                $tmpS = $statsFile . '.tmp.' . bin2hex(random_bytes(4));
                if (@file_put_contents($tmpS, json_encode($stats, JSON_UNESCAPED_UNICODE), LOCK_EX) !== false) @rename($tmpS, $statsFile);
            }
        } catch (Throwable $ePushStats) {}
        if ($metaLock) { @flock($metaLock, LOCK_UN); @fclose($metaLock); }
        $reportedRev = (int)($meta['_global']['rev'] ?? 0);
        echo json_encode(['ok' => true, 'saved' => $saved, 'savedKeys' => array_values(array_unique($saved_keys)), 'rev' => $reportedRev, 'rejected' => array_values(array_unique($rejected)),
            'skipped' => array_values(array_unique($skipped_keys)), 'forbidden' => array_values(array_unique($forbidden_keys)), 'role' => $client_role,
            'conflicts' => $conflicts, 'protectedConflicts' => array_values(array_unique($protectedConflicts)), 'serverData' => $conflictData, 'krevs' => $krevs], JSON_UNESCAPED_UNICODE); /* v14.7 US-382 + v15.0 US-384 + per-key ACK */
        break;

    case 'data_pull':
        verify_request();
        $sdir = $data_dir . '/sync';
        $meta_file = $sdir . '/meta.json';
        $meta = file_exists($meta_file) ? (json_decode(file_get_contents($meta_file), true) ?: []) : [];
        $since = (int)($_REQUEST['since'] ?? 0);
        $globalRev = $meta['_global']['rev'] ?? 0;
        // اگر کلاینت به‌روز است، فقط rev برگردان (سبک برای polling)
        if ($since >= $globalRev) {
            /* Return metadata even for a fresh global response. A command response can
               stamp a global revision into client krevs while the server's per-key
               watermark remains lower; the client needs this authoritative map to
               repair its cursor without downloading payloads. */
            ptf_echo_json(['ok' => true, 'rev' => $globalRev, 'fresh' => true, 'meta' => $meta]);
            break;
        }
        /* ===== v33.21.0 (PTF-SCALE-P0 — سینک دلتا به‌ازای هرکلید، برای افزایش تعداد کاربران):
           کلاینت نقشهٔ rev هرکلید خود را با پارامتر krevs می‌فرستد؛ فقط کلیدهایی که روی سرور
           جدیدترند برمی‌گردند. پیش‌تر با بالارفتن rev سراسری «اسنپ‌شات کامل (~۴MB)» برای همه
           می‌رفت و ترافیک/CPU با تعداد کاربر خطی منفجر می‌شد.
           کلاینت قدیمی (بدون krevs) → رفتار قبلی (اسنپ‌شات کامل) — ۱۰۰٪ سازگار با عقب. ===== */
        $krevs = null;
        if (isset($_REQUEST['krevs']) && is_string($_REQUEST['krevs']) && $_REQUEST['krevs'] !== '') {
            $krj = json_decode($_REQUEST['krevs'], true);
            if (is_array($krj)) $krevs = $krj;
        }
        $out = [];
        $allowed_keys = sync_all_keys();
        $role_sync_keys = sync_allowed_keys_for_role($client_role);
        $serverArchiveJson = null; /* v33.21.0: خواندن تنبَل آرشیو — پول دلتای بدون‌تغییر دیگر فایل آرشیو را نمی‌خواند */
        foreach ($meta as $k => $m) {
            if ($k === '_global') continue;
            if (!in_array($k, $allowed_keys, true) || !in_array($k, $role_sync_keys, true)) continue;
            /* دلتا: کلیدی که rev سرورش از rev اعلامی کلاینت بزرگ‌تر نیست، دوباره فرستاده نمی‌شود */
            if ($krevs !== null && (int)($krevs[$k] ?? -1) >= (int)($m['rev'] ?? 0)) continue;
            /* v33.22.0: مسیر یکپارچه (در mode=mysql مقدار از دیتابیس خوانده می‌شود) */
            $kv = sync_key_read($sdir, $k);
            if ($kv === null) continue;
            if ($serverArchiveJson === null) { $tmpA = sync_key_read($sdir, 'ptf_crm_deleted_archive'); $serverArchiveJson = ($tmpA === null) ? '[]' : $tmpA; }
            $out[$k] = sync_apply_tombstones($k, $kv, $serverArchiveJson, '[]');
        }
        echo json_encode(['ok' => true, 'rev' => $globalRev, 'data' => $out, 'meta' => $meta, 'delta' => ($krevs !== null)], JSON_UNESCAPED_UNICODE);
        break;

    /* ===== v34.8.31 (T3-1 — ROADMAP-THIN-CLIENT): خواندن سرور-محور =====
       collection_query: فیلتر/مرتب‌سازی/صفحه‌بندی سمت سرور روی فروشگاه sync.
       مصرف اصلی: بوت دستگاه جدید (بدون دانلود کل دیتاست) + پنل‌های فهرست‌محور.
       پارامترها: collection, q (جستجوی آزاد روی فیلدهای رشته‌ای), field/eq,
       sortBy/sortDir, page/pageSize (سقف ۱۰۰)، fields (پروجکشن CSV اختیاری). */
    case 'collection_query':
        verify_request();
        $cq_collection = trim((string)($_REQUEST['collection'] ?? ''));
        $cq_allowed = sync_allowed_keys_for_role($client_role);
        if (!in_array($cq_collection, $cq_allowed, true)) { http_response_code(403); echo json_encode(['ok'=>false,'error'=>'collection_forbidden','collection'=>$cq_collection]); break; }
        $cq_meta_file = $data_dir . '/sync/meta.json';
        $cq_meta = file_exists($cq_meta_file) ? (json_decode(file_get_contents($cq_meta_file), true) ?: []) : [];
        $cq_metaEntry = $cq_meta[$cq_collection] ?? [];
        $cq_rows = [];
        $cq_kv = sync_key_read($data_dir . '/sync', $cq_collection);
        if (is_string($cq_kv)) { $cq_dec = json_decode($cq_kv, true); if (is_array($cq_dec)) $cq_rows = array_values($cq_dec); }
        /* فیلتر تساوی ساده: هر کلید query به‌جز رزروشده‌ها = eq */
        $cq_reserved = ['collection','q','sortBy','sortDir','page','pageSize','fields'];
        foreach ($_REQUEST as $cq_f => $cq_v) {
            if (in_array($cq_f, $cq_reserved, true)) continue;
            if (strpos($cq_f, '_') === 0) continue;
            $cq_v = trim((string)$cq_v);
            if ($cq_v === '') continue;
            $cq_rows = array_values(array_filter($cq_rows, function ($r) use ($cq_f, $cq_v) {
                if (!is_array($r)) return false;
                if (array_key_exists($cq_f, $r)) return (string)$r[$cq_f] === $cq_v;
                return false;
            }));
        }
        /* جستجوی آزاد روی فیلدهای رشته‌ای (case-insensitive، حداکثر ۳۰۰۰ رکورد اسکن) */
        $cq_q = trim((string)($_REQUEST['q'] ?? ''));
        if ($cq_q !== '') {
            $cq_qL = mb_strtolower($cq_q, 'UTF-8');
            $cq_rows = array_values(array_filter(array_slice($cq_rows, 0, 3000), function ($r) use ($cq_qL) {
                if (!is_array($r)) return false;
                foreach ($r as $v) { if (is_string($v) && mb_strpos(mb_strtolower($v, 'UTF-8'), $cq_qL) !== false) return true; }
                return false;
            }));
        }
        /* مرتب‌سازی: sortBy روی فیلد (پیش‌فرض cd)؛ sortDir=asc|desc */
        $cq_sortBy = trim((string)($_REQUEST['sortBy'] ?? 'cd'));
        $cq_sortDir = strtolower(trim((string)($_REQUEST['sortDir'] ?? 'asc'))) === 'desc' ? -1 : 1;
        usort($cq_rows, function ($a, $b) use ($cq_sortBy, $cq_sortDir) {
            $av = is_array($a) ? (string)($a[$cq_sortBy] ?? '') : '';
            $bv = is_array($b) ? (string)($b[$cq_sortBy] ?? '') : '';
            $cmp = strcmp($av, $bv);
            return $cmp * $cq_sortDir;
        });
        /* صفحه‌بندی */
        $cq_page = max(1, (int)($_REQUEST['page'] ?? 1));
        $cq_pageSize = min(100, max(1, (int)($_REQUEST['pageSize'] ?? 50)));
        $cq_total = count($cq_rows);
        $cq_pageRows = array_slice($cq_rows, ($cq_page - 1) * $cq_pageSize, $cq_pageSize);
        /* پروجکشن CSV اختیاری */
        $cq_fields = trim((string)($_REQUEST['fields'] ?? ''));
        if ($cq_fields !== '') {
            $cq_want = array_filter(array_map('trim', explode(',', $cq_fields)));
            $cq_pageRows = array_map(function ($r) use ($cq_want) {
                $o = [];
                foreach ($cq_want as $wf) { if (array_key_exists($wf, $r)) $o[$wf] = $r[$wf]; }
                return $o;
            }, $cq_pageRows);
        }
        echo json_encode([
            'ok' => true, 'collection' => $cq_collection, 'rev' => $cq_metaEntry['rev'] ?? 0,
            'total' => $cq_total, 'page' => $cq_page, 'pageSize' => $cq_pageSize,
            'pages' => (int)ceil($cq_total / $cq_pageSize), 'rows' => $cq_pageRows
        ], JSON_UNESCAPED_UNICODE);
        break;

    case 'data_rev':
        verify_request();
        $meta_file = $data_dir . '/sync/meta.json';
        $meta = file_exists($meta_file) ? (json_decode(file_get_contents($meta_file), true) ?: []) : [];
        echo json_encode(['ok' => true, 'rev' => $meta['_global']['rev'] ?? 0]);
        break;

    // ===== US-151 فاز ۱: کاربران سروری (رفع باگ «ورود فقط از مرورگر تعریف‌کننده») =====
    case 'users_sync':
        verify_request();
        role_guard('users_write'); // فقط ادمین/رییس
        $users = json_decode($_POST['users'] ?? '[]', true);
        if (!is_array($users)) { echo json_encode(['ok' => false, 'error' => 'ساختار نامعتبر']); break; }
        if (count($users) > 100) { echo json_encode(['ok' => false, 'error' => 'حداکثر ۱۰۰ کاربر']); break; }
        $clean = [];
        /* v31.7.14 BUG-USERS-VANISH-001: users_get از v31.7.4 دیگر passhash نمی‌دهد؛
           مرورگر همان لیست بدون passhash را در auto-seed به users_sync برمی‌گرداند و
           این حلقه کاربر بدون passhash را بی‌صدا حذف می‌کرد → کاربران (مثل حسابدار)
           از سرور ناپدید می‌شدند. حالا passhash موجودِ سرور برای همان username حفظ می‌شود. */
        $existing_by_name = [];
        $existing_srv = load_all_crm_users_sources();
        if (is_array($existing_srv)) {
            foreach ($existing_srv as $eu) {
                if (!empty($eu['username'])) $existing_by_name[strtolower($eu['username'])] = $eu;
            }
        }
        $dropped = [];
        foreach ($users as $u) {
            if (empty($u['username'])) continue;
            $prev = $existing_by_name[strtolower($u['username'])] ?? null;
            $ph = preg_replace('/[^a-f0-9]/', '', $u['passhash'] ?? '');
            $pwh = '';
            if (!empty($prev['password_hash']) && ptf_is_password_hash($prev['password_hash'])) $pwh = $prev['password_hash'];
            elseif (!empty($u['password_hash']) && ptf_is_password_hash($u['password_hash'])) $pwh = $u['password_hash'];
            if ($ph === '' && $pwh === '') {
                if ($prev && !empty($prev['passhash'])) {
                    $ph = preg_replace('/[^a-f0-9]/', '', $prev['passhash']);
                } else {
                    $dropped[] = $u['username'];
                    continue;
                }
            }
            $row = [
                'username' => clean($u['username'], 40),
                'name'     => clean($u['name'] ?? '', 80),
                'nameEn'   => clean($u['nameEn'] ?? '', 80),
                'role'     => clean($u['role'] ?? '', 80),
                'roleId'   => normalize_role($u['roleId'] ?? '', $u['role'] ?? ''),
                'mobile'   => preg_replace('/\D/', '', $u['mobile'] ?? ''),
                'email'    => clean($u['email'] ?? '', 80),
                'createdFa'=> clean($u['createdFa'] ?? '', 20),
                'createdBy'=> clean($u['createdBy'] ?? '', 80),
            ];
            if ($ph !== '') $row['passhash'] = $ph;
            if ($pwh !== '') $row['password_hash'] = $pwh;
            $clean[] = $row;
        }
        save_data('crm_users', $clean);
        echo json_encode(['ok' => true, 'count' => count($clean), 'dropped' => $dropped]);
        break;


    case 'auth_logout':
        /* v34.8.6 (AUTH-LOGOUT-REVOKE): خروج، توکنِ همین نشست را روی سرور باطل می‌کند
           (توکن سایر دستگاه‌های همان کاربر دست‌نخورده می‌ماند). همیشه ok برمی‌گرداند تا
           خروج آفلاین هم گیر نکند. */
        if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
            http_response_code(405);
            echo json_encode(['ok' => false, 'error' => 'method_not_allowed']);
            break;
        }
        $logoutToken = auth_get_header_token();
        if ($logoutToken !== '') {
            $info = auth_verify_token($logoutToken);
            if ($info) auth_revoke_token($logoutToken);
        }
        /* v34.8.28 (T4-1a): کوکی نشست هم هنگام خروج پاک می‌شود */
        /* v34.8.43 (R5/T4-1b): نشانگر غیرمحرم هم پاک شود — وگرنه کلاینت به‌کذب «نشست دارد» */
        setcookie('ptf_token_flag', '', ['expires' => time() - 3600, 'path' => '/', 'secure' => (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off'), 'httponly' => false, 'samesite' => 'Strict']);
        if (isset($_COOKIE['ptf_token'])) {
            setcookie('ptf_token', '', ['expires' => time() - 3600, 'path' => '/', 'secure' => (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off'), 'httponly' => true, 'samesite' => 'Strict']);
            unset($_COOKIE['ptf_token']);
        }
        echo json_encode(['ok' => true, 'revoked' => $logoutToken !== '']);
        break;

    /* ═══ v34.8.46 (R6/T7-ب — LOGIN-2FA): ورود دومرحله‌ای پیامکی نقش‌های مالی ═══
       طراحی: مرحلهٔ ۱ (auth_login) بعد از تأیید رمز، برای نقش‌های مالیِ پیکربندی‌شده
       (پیش‌فرض: accountant) کد ۶رقمی با SMS می‌فرستد و به‌جای توکن، otp_challenge
       برمی‌گرداند؛ مرحلهٔ ۲ (auth_login_otp) با کد، توکن نشست صادر می‌کند.
       سیاست fail-open: اگر SMS پیکربندی نباشد/موبایل نباشد/ارسال شکست بخورد، ورود
       ادامه می‌یابد و رویداد در auth_2fa_log ثبت می‌شود — مگر اینکه ادمین
       settings.twofa_required = true کرده باشد (آنگاه fail-closed). */
    case 'auth_login':
        if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
            http_response_code(405);
            echo json_encode(['ok' => false, 'error' => 'method_not_allowed']);
            break;
        }
        if (!auth_is_configured()) {
            http_response_code(503);
            echo json_encode(['ok' => false, 'error' => 'auth_not_configured', 'message' => 'سامانه احراز هویت پیکربندی نشده است'], JSON_UNESCAPED_UNICODE);
            break;
        }
        $username = strtolower(trim((string)($_POST['username'] ?? '')));
        $password = (string)($_POST['password'] ?? '');
        /* v33.0.2 AUTH-LEGACY-PASSWORD-LEN: existing CRM users/admin were created
           under the UI policy of minimum 6 chars. v33.0.1 rejected those passwords
           with HTTP 400 before hash verification, so admin could not obtain token.
           Keep rate-limit + server-side hash verification; align transport minimum
           with the stored-account policy. */
        if (!preg_match('/^[a-z0-9._-]{3,40}$/', $username) || strlen($password) < 6 || strlen($password) > 256) {
            http_response_code(400);
            echo json_encode(['ok' => false, 'error' => 'invalid_credentials']);
            break;
        }
        if (!login_rate_allowed($username)) {
            http_response_code(429);
            echo json_encode(['ok' => false, 'error' => 'too_many_attempts']);
            break;
        }
        $found = null;
        /* v33.0.1 SEC-AUTH-ADMIN-SERVER: admin must also receive a real server token.
           The previous browser-only admin login rendered the CRM but could not data_pull.
           Admin password hash is read from ptf-secrets.php outside webroot. */
        if ($username === 'admin') {
            $adminBcrypt = (string)load_ptf_secret('admin_password_hash', '');
            if ($adminBcrypt !== '' && ptf_is_password_hash($adminBcrypt) && password_verify($password, $adminBcrypt)) {
                $found = [
                    'username' => 'admin',
                    'name' => 'مدیر ارشد سیستم',
                    'roleId' => 'admin',
                    'role' => 'admin'
                ];
            }
            if (!$found) {
                $adminHash = strtolower(load_ptf_secret('admin_sha256', load_ptf_secret('default_admin_hash', '')));
                if ($adminHash !== '' && preg_match('/^[a-f0-9]{64}$/', $adminHash) && hash_equals($adminHash, hash('sha256', $password))) {
                    $found = [
                        'username' => 'admin',
                        'name' => 'مدیر ارشد سیستم',
                        'roleId' => 'admin',
                        'role' => 'admin'
                    ];
                }
            }
        }
        $legacy = false;
        if (!$found) {
            foreach (load_all_crm_users_sources() as $u) {
                if (strtolower((string)($u['username'] ?? '')) !== $username) continue;
                if (!empty($u['password_hash']) && password_verify($password, (string)$u['password_hash'])) {
                    $found = $u;
                    break;
                }
                if (!empty($u['passhash']) && hash_equals(strtolower((string)$u['passhash']), hash('sha256', $password))) {
                    $found = $u;
                    $legacy = true;
                    break;
                }
            }
        }
        if (!$found) {
            http_response_code(401);
            echo json_encode(['ok' => false, 'error' => 'invalid_credentials']);
            break;
        }
        if ($legacy) migrate_legacy_password_hash($found, $password);
        $role = normalize_role($found['roleId'] ?? '', $found['role'] ?? '');
        /* v34.8.46 (R6/T7-ب — LOGIN-2FA): نقش مالی + SMS فعال → کد پیامکی قبل از صدور توکن */
        $twofaSkipped = null;
        $cfg2fa = twofa_cfg();
        if ($cfg2fa['enabled'] && in_array($role, $cfg2fa['roles'], true)) {
            $mob2fa = twofa_user_mobile($found);
            if (!sms_enabled() || $mob2fa === '') {
                $why2fa = !sms_enabled() ? 'sms_off' : 'no_mobile';
                twofa_log('skipped', $found['username'], $why2fa);
                if ($cfg2fa['strict']) {
                    http_response_code(503);
                    echo json_encode(['ok' => false, 'error' => 'twofa_unavailable', 'message' => 'ورود دومرحله‌ای برای نقش شما الزامی است اما سامانه پیامک ' . ($why2fa === 'sms_off' ? 'پیکربندی نشده است' : 'شماره موبایل شما را ندارد') . ' — با مدیر سیستم تماس بگیرید'], JSON_UNESCAPED_UNICODE);
                    break;
                }
                $twofaSkipped = $why2fa; /* fail-open + ثبت رویداد */
            } else {
                $st2fa = twofa_store_load();
                $uk2fa = strtolower($found['username']);
                $rec2fa = $st2fa[$uk2fa] ?? null;
                $window2fa = ($rec2fa && (time() - (int)($rec2fa['first'] ?? 0)) < 600);
                if ($rec2fa && $window2fa && (int)($rec2fa['sent'] ?? 0) >= 3) {
                    http_response_code(429);
                    echo json_encode(['ok' => false, 'error' => 'twofa_rate_limited', 'message' => 'تعداد درخواست کد زیاد است — چند دقیقه بعد تلاش کنید'], JSON_UNESCAPED_UNICODE);
                    break;
                }
                $code2fa = str_pad((string)random_int(0, 999999), 6, '0', STR_PAD_LEFT);
                $chal2fa = bin2hex(random_bytes(16));
                $st2fa[$uk2fa] = [
                    'hash' => password_hash($code2fa, PASSWORD_DEFAULT),
                    'chal' => $chal2fa, 'exp' => time() + 180, 'tries' => 0,
                    'sent' => ($window2fa ? (int)($rec2fa['sent'] ?? 0) : 0) + 1,
                    'first' => $window2fa ? (int)($rec2fa['first'] ?? time()) : time(),
                    'user' => $found['username'], 'role' => $role,
                    'name' => (string)($found['name'] ?? $found['username']),
                    'mobile_last4' => substr($mob2fa, -4),
                ];
                twofa_store_save($st2fa);
                $err2fa = null;
                $sent2fa = sms_send($mob2fa, 'پیشرو تجهیز فرتاک' . "\n" . 'رمز ورود دومرحله‌ای: ' . $code2fa . "\n" . 'اعتبار: ۳ دقیقه', $err2fa);
                if (!$sent2fa) {
                    twofa_log('sms_failed', $found['username'], (string)($err2fa ?: 'send_failed'));
                    if ($cfg2fa['strict']) {
                        http_response_code(503);
                        echo json_encode(['ok' => false, 'error' => 'twofa_sms_failed', 'message' => 'ارسال پیامک دومرحله‌ای ناموفق بود — دوباره تلاش کنید'], JSON_UNESCAPED_UNICODE);
                        break;
                    }
                    $twofaSkipped = 'sms_failed'; /* fail-open + ثبت رویداد */
                } else {
                    twofa_log('sent', $found['username'], 'mobile:***' . substr($mob2fa, -4));
                    echo json_encode(['ok' => true, 'otp_required' => true, 'otp_challenge' => $chal2fa, 'mobile_last4' => substr($mob2fa, -4), 'ttl' => 180], JSON_UNESCAPED_UNICODE);
                    break;
                }
            }
        }
        $token = auth_generate_token($found['username'], $role);
        if (!$token) {
            http_response_code(503);
            echo json_encode(['ok' => false, 'error' => 'token_issue_failed']);
            break;
        }
        /* v34.8.28 (T4-1a COOKIE-AUTH): نشست روی کوکی HttpOnly هم می‌نشیند — کلاینت
           بدون خواندن JS توکن هم احراز می‌شود (fallback هدر باقی است برای سازگاری). */
        auth_emit_session_cookie($token, ($role === 'accountant') ? 8 * 3600 : 24 * 3600); /* S5 */
        /* v34.8.43 (R5/T4-1b — SESSION-OUT-OF-LS): نشانگر غیرمحرمِ حضور کوکی — JS فقط
           «نشست سروری موجود است» را می‌فهمد، نه خود توکن را؛ مبنای ptfAuthCookieOk و
           بازسازی نشست تبِ تازه (role_verify) در نبود توکنِ JS. */
        $ttlFlag = ($role === 'accountant') ? 8 * 3600 : 24 * 3600;
        $secureFlag = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https') || (($_SERVER['SERVER_PORT'] ?? '') == 443);
        setcookie('ptf_token_flag', '1', ['expires' => time() + $ttlFlag, 'path' => '/', 'secure' => (bool)$secureFlag, 'httponly' => false, 'samesite' => 'Strict']);
        echo json_encode(['ok' => true, 'token' => $token, 'role' => $role, 'user' => $found['username'], 'name' => $found['name'] ?? $found['username'], 'twofa_skipped' => $twofaSkipped], JSON_UNESCAPED_UNICODE);
        break;

    case 'auth_login_otp':
        /* v34.8.46 (R6/T7-ب): مرحلهٔ دوم ورود دومرحله‌ای — کد پیامکی ↔ توکن نشست.
           challenge فقط بعد از رمز درست صادر شده و به username مقید است (عمر ۳دقیقه). */
        if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
            http_response_code(405);
            echo json_encode(['ok' => false, 'error' => 'method_not_allowed']);
            break;
        }
        $uOtp = strtolower(clean($_POST['username'] ?? '', 80));
        $chalOtp = clean($_POST['otp_challenge'] ?? '', 64);
        $codeOtp = preg_replace('/\D/', '', (string)($_POST['code'] ?? ''));
        if ($uOtp === '' || $chalOtp === '' || strlen($codeOtp) !== 6) {
            http_response_code(422);
            echo json_encode(['ok' => false, 'error' => 'twofa_input_invalid'], JSON_UNESCAPED_UNICODE);
            break;
        }
        $stOtp = twofa_store_load();
        $recOtp = $stOtp[$uOtp] ?? null;
        if (!$recOtp || !hash_equals((string)($recOtp['chal'] ?? ''), $chalOtp)) {
            http_response_code(401);
            echo json_encode(['ok' => false, 'error' => 'twofa_challenge_invalid'], JSON_UNESCAPED_UNICODE);
            break;
        }
        if ((int)($recOtp['exp'] ?? 0) < time()) {
            unset($stOtp[$uOtp]); twofa_store_save($stOtp);
            http_response_code(401);
            echo json_encode(['ok' => false, 'error' => 'twofa_code_expired', 'message' => 'کد منقضی شده است — دوباره وارد شوید'], JSON_UNESCAPED_UNICODE);
            break;
        }
        if ((int)($recOtp['tries'] ?? 0) >= 5) {
            unset($stOtp[$uOtp]); twofa_store_save($stOtp);
            http_response_code(429);
            echo json_encode(['ok' => false, 'error' => 'twofa_locked'], JSON_UNESCAPED_UNICODE);
            break;
        }
        if (!password_verify($codeOtp, (string)($recOtp['hash'] ?? ''))) {
            $recOtp['tries'] = (int)($recOtp['tries'] ?? 0) + 1;
            $stOtp[$uOtp] = $recOtp; twofa_store_save($stOtp);
            twofa_log('wrong_code', (string)($recOtp['user'] ?? $uOtp), 'try ' . $recOtp['tries']);
            http_response_code(401);
            echo json_encode(['ok' => false, 'error' => 'twofa_code_invalid', 'message' => 'کد نادرست است'], JSON_UNESCAPED_UNICODE);
            break;
        }
        unset($stOtp[$uOtp]); twofa_store_save($stOtp);
        $tokenOtp = auth_generate_token((string)$recOtp['user'], (string)$recOtp['role']);
        if (!$tokenOtp) { http_response_code(503); echo json_encode(['ok' => false, 'error' => 'token_issue_failed']); break; }
        auth_emit_session_cookie($tokenOtp, ((string)$recOtp['role'] === 'accountant') ? 8 * 3600 : 24 * 3600);
        $ttlFlagOtp = ((string)$recOtp['role'] === 'accountant') ? 8 * 3600 : 24 * 3600;
        $secureFlagOtp = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https') || (($_SERVER['SERVER_PORT'] ?? '') == 443);
        setcookie('ptf_token_flag', '1', ['expires' => time() + $ttlFlagOtp, 'path' => '/', 'secure' => (bool)$secureFlagOtp, 'httponly' => false, 'samesite' => 'Strict']);
        twofa_log('verified', (string)$recOtp['user'], '');
        echo json_encode(['ok' => true, 'token' => $tokenOtp, 'role' => (string)$recOtp['role'], 'user' => (string)$recOtp['user'], 'name' => (string)($recOtp['name'] ?? $recOtp['user'])], JSON_UNESCAPED_UNICODE);
        break;

    case 'users_get':
        // v31.7.4 BUG-AUDIT-004 FIXED: only return safe fields, never passhash
        // v34.0.6-alpha D-02 (PII): users_get در لیست اکشن‌های عمومی است و پیش از لاگین
        //   برای پینگ/پیش‌بار کاربران فراخوانی می‌شود. فیلدهای حساس (mobile/email) دیگر
        //   بدون توکن بازنمی‌گردند — «حداقل‌سازی فیلدهای خروجی پیش از لاگین» طبق ارزیابی.
        //   با توکن معتبر، مجموعهٔ کامل (بدون passhash) برای مدیریت کاربران برمی‌گردد.
        verify_request();
        global $client_role;
        /* v34.8.16 (T1-1 / PII-GUARD): ریشهٔ نشت موبایل/ایمیل بدون لاگین — مقداردهی اولیهٔ
           '$client_role = 'anonymous'' (خط ~۲۹۵) باعث می‌شد !empty($client_role) همیشه true
           باشد و گارد D-02 کد مرج شود. تأیید زنده روی هر دو محیط (۲۰۲۶-۰۸-۲۷). */
        $authenticated = !empty($client_role) && $client_role !== 'anonymous';
        $all_users = load_all_crm_users_sources();
        $safe_users = array_map(function($u) use ($authenticated) {
            $row = [
                'username' => $u['username'] ?? '',
                'name'     => $u['name'] ?? '',
                'nameEn'   => $u['nameEn'] ?? '',
                'roleId'   => $u['roleId'] ?? 'sales',
                'role'     => $u['role'] ?? '',
            ];
            if ($authenticated) {
                $row['mobile'] = $u['mobile'] ?? '';
                $row['email']  = $u['email'] ?? '';
            }
            return $row;
        }, $all_users);
        echo json_encode(['ok' => true, 'users' => $safe_users], JSON_UNESCAPED_UNICODE);
        break;

    // v33.2.1: کلاینت نقش معتبر سرور را بپرسد — جلوگیری از ورود با نقش منقضی/اشتباه
    case 'role_verify':
        verify_request();
        /* v34.8.43 (R5/T4-1b): user/name هم برمی‌گردد — تبِ تازه نشست JS خود را از
           کوکی HttpOnly بازسازی می‌کند («کلاینت بدون توکن»). فقط-خواندنی و بدون حساسه. */
        $rvInfo = auth_verify_token(auth_get_header_token());
        $rvUser = is_array($rvInfo) ? (string)($rvInfo['user'] ?? '') : '';
        $rvName = $rvUser;
        try {
            $rvUsers = load_data('crm_users');
            if (is_array($rvUsers)) {
                foreach ($rvUsers as $rvU) {
                    if (is_array($rvU) && strcasecmp((string)($rvU['username'] ?? ''), $rvUser) === 0) { $rvName = (string)($rvU['name'] ?? $rvUser) ?: $rvUser; break; }
                }
            }
        } catch (Throwable $eRvName) {}
        echo json_encode(['ok' => true, 'role' => $client_role, 'user' => $rvUser, 'name' => $rvName], JSON_UNESCAPED_UNICODE);
        break;

    case 'add_customer':
        verify_request();
        $customers = load_data('customers');
        $customers[] = [
            'code' => 'CUST-' . rand(10000, 99999),
            'company' => clean($_POST['company'] ?? ''),
            'industry' => clean($_POST['industry'] ?? ''),
            'contact' => clean($_POST['contact'] ?? ''),
            'phone' => clean($_POST['phone'] ?? ''),
            'email' => clean($_POST['email'] ?? ''),
            'date' => date('Y/m/d')
        ];
        save_data('customers', $customers);
        echo json_encode(['ok' => true]);
        break;

    case 'add_user':
        // v31.7.4 BUG-AUDIT-001 FIXED: deprecated - use users_sync instead
        // Legacy add_user stored plaintext passwords. Now requires proper authentication
        // and uses passhash instead of plaintext password.
        verify_request();
        role_guard('users_write'); // Only admin/chairman can add users
        
        $username = clean($_POST['username'] ?? '', 40);
        $passhash = preg_replace('/[^a-f0-9]/', '', $_POST['passhash'] ?? '');
        $plain = (string)($_POST['password'] ?? '');
        $pwh = '';
        if (strlen($plain) >= 6 && strlen($plain) <= 256) $pwh = password_hash($plain, PASSWORD_DEFAULT);
        $name = clean($_POST['name'] ?? '', 80);
        $roleId = normalize_role($_POST['roleId'] ?? '', $_POST['role'] ?? '');
        
        if (empty($username) || ($passhash === '' && $pwh === '')) {
            echo json_encode(['ok' => false, 'error' => 'username and password required'], JSON_UNESCAPED_UNICODE);
            break;
        }
        
        // Check if user already exists
        $existing_users = load_data('crm_users');
        foreach ($existing_users as $u) {
            if (strtolower($u['username'] ?? '') === strtolower($username)) {
                echo json_encode(['ok' => false, 'error' => 'user already exists'], JSON_UNESCAPED_UNICODE);
                break 2;
            }
        }
        
        $nu = [
            'username' => $username,
            'name' => $name,
            'roleId' => $roleId,
            'mobile' => clean($_POST['mobile'] ?? '', 20),
            'email' => clean($_POST['email'] ?? '', 80),
            'createdFa' => clean($_POST['createdFa'] ?? '', 20),
            'createdBy' => clean($_POST['createdBy'] ?? '', 80),
        ];
        if ($passhash !== '') $nu['passhash'] = $passhash;
        if ($pwh !== '') $nu['password_hash'] = $pwh;
        $existing_users[] = $nu;
        save_data('crm_users', $existing_users);
        echo json_encode(['ok' => true]);
        break;

    case 'save_settings':
        // v31.7.4 BUG-AUDIT-002 FIXED: merge with existing settings instead of overwrite
        // Previous code replaced ALL settings, which could wipe adminHash and lock out admin
        verify_request();
        role_guard('users_write'); // Only admin/chairman can change settings
        
        $existing_settings = load_data('settings');
        if (!is_array($existing_settings)) $existing_settings = [];
        
        // Merge new values with existing
        $existing_settings['email'] = clean($_POST['adminEmail'] ?? '');
        $existing_settings['sms'] = clean($_POST['smsLine'] ?? '');
        $existing_settings['template_st3'] = clean($_POST['smsTemplateSt3'] ?? '');
        $existing_settings['template_st4'] = clean($_POST['smsTemplateSt4'] ?? '');
        
        save_data('settings', $existing_settings);
        echo json_encode(['ok' => true]);
        break;

    default:
        echo json_encode(['ok' => false, 'error' => 'Invalid action']);
}
