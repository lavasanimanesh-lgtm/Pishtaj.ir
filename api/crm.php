<?php
// Clean up any remaining numerical kc files on the server (v33.2.0)
$kc_dir = __DIR__ . '/../knowledge-center';
if (is_dir($kc_dir)) {
    foreach (glob($kc_dir . '/kc-[0-9]*.html') as $f) {
        @unlink($f);
    }
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
    $public_actions = ['captcha_new', 'add_rfq_site', 'add_supplier', 'track', 'auth_login', 'sms_status', 'users_get'];
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
$PUBLIC_LIMITED = ['add_supplier' => 10, 'add_rfq_site' => 10, 'track' => 60];
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
$CAPTCHA_SECRET = load_ptf_secret('captcha_key', '');
function captcha_token($sum, $ts) {
    global $CAPTCHA_SECRET;
    if (!is_string($CAPTCHA_SECRET) || strlen($CAPTCHA_SECRET) < 32) return '';
    return base64_encode($ts . '|' . hash_hmac('sha256', $sum . '|' . $ts, $CAPTCHA_SECRET));
}
function captcha_ok() {
    global $CAPTCHA_SECRET;
    if (!is_string($CAPTCHA_SECRET) || strlen($CAPTCHA_SECRET) < 32) return false;
    $tok = $_POST['captcha_token'] ?? '';
    $ans = trim($_POST['captcha_answer'] ?? '');
    if (!$tok || $ans === '' || !is_numeric($ans)) return false;
    $raw = base64_decode($tok, true);
    if (!$raw || strpos($raw, '|') === false) return false;
    list($ts, $sig) = explode('|', $raw, 2);
    if (!ctype_digit($ts) || time() - (int)$ts > 900) return false; // انقضا: ۱۵ دقیقه
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
    $ts = time();
    return base64_encode($ts . '|' . $phone . '|' . hash_hmac('sha256', 'otp|' . $phone . '|' . $ts, $CAPTCHA_SECRET));
}
function otp_token_ok($token, $phone) {
    global $CAPTCHA_SECRET;
    $raw = base64_decode($token, true);
    if (!$raw) return false;
    $parts = explode('|', $raw, 3);
    if (count($parts) !== 3) return false;
    list($ts, $ph, $sig) = $parts;
    if (!ctype_digit($ts) || time() - (int)$ts > 1800) return false; // اعتبار ۳۰ دقیقه
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
$SENSITIVE = ['get_finance'=>'finance_read','save_finance'=>'finance_write','save_user'=>'users_write','del_user'=>'users_write','users_sync'=>'users_write','get_buyquotes'=>'buyprice_read','set_status'=>'approve_write','data_push'=>'sync_write','data_pull'=>'sync_read','auth_login'=>'none'];

/* v31.6.26 BUG-SYNC-ROLE-ACL: CRM synchronization is not the same as
   finance_read/finance_write. Filter keys server-side so ordinary CRM roles
   can converge without receiving invoices/payables/cheques they are not
   allowed to see. Senior management (admin/chairman/ceo) keeps the full company dataset;
   sensitive tax-return data is excluded from commercial/manager roles. */
function sync_all_keys() {
    return ['ptf_crm_rfqs','ptf_crm_suppliers','ptf_crm_customers','ptf_crm_products','ptf_crm_offers','ptf_crm_leads','ptf_crm_reminders','ptf_crm_buyquotes','ptf_crm_invoices','ptf_crm_surplus','ptf_crm_notifs','ptf_crm_sendqueue','ptf_crm_audit','ptf_crm_inqitems','ptf_crm_deals','ptf_crm_projects','ptf_crm_packinglists','ptf_crm_letters','ptf_crm_contracts','ptf_crm_sigprofiles','ptf_crm_smsbook','ptf_crm_rfqsmart','ptf_crm_settings','ptf_crm_finance','ptf_crm_order_prices','ptf_crm_notifprefs','ptf_crm_trash','ptf_crm_petty','ptf_crm_perms','ptf_crm_avatars','ptf_crm_buycmp','ptf_crm_inqreads','ptf_crm_cheques','ptf_crm_msgtpls','ptf_crm_deleted_archive','ptf_crm_tax_returns','ptf_crm_payables','ptf_crm_supplier_finance','ptf_crm_opex','ptf_crm_petty_tx','ptf_crm_petty_periods','ptf_crm_shareholders','ptf_crm_sharetx','ptf_crm_fiscal_snapshots','ptf_crm_techcases','ptf_crm_calc_runs','ptf_crm_techproposals','ptf_crm_leadfinder_jobs','ptf_crm_leadfinder_sources'];
}
function sync_allowed_keys_for_role($role) {
    $role = preg_replace('/[^a-z0-9]/', '', strtolower(trim((string)$role)));
    $all = sync_all_keys();
    if (in_array($role, ['admin','chairman','ceo'], true)) return $all;
    // اظهارنامه مالیاتی فقط برای مدیریت ارشد و حسابداری؛ commercial/manager نباید آن را ببیند.
    if (strpos($role, 'commercial') !== false || strpos($role, 'manager') !== false) return array_values(array_diff($all, ['ptf_crm_tax_returns']));
    $crm = ['ptf_crm_rfqs','ptf_crm_suppliers','ptf_crm_customers','ptf_crm_products','ptf_crm_offers','ptf_crm_leads','ptf_crm_reminders','ptf_crm_buyquotes','ptf_crm_surplus','ptf_crm_notifs','ptf_crm_sendqueue','ptf_crm_inqitems','ptf_crm_deals','ptf_crm_projects','ptf_crm_packinglists','ptf_crm_letters','ptf_crm_contracts','ptf_crm_sigprofiles','ptf_crm_rfqsmart','ptf_crm_notifprefs','ptf_crm_avatars','ptf_crm_buycmp','ptf_crm_inqreads','ptf_crm_msgtpls','ptf_crm_deleted_archive'];
    $accountant = ['ptf_crm_rfqs','ptf_crm_customers','ptf_crm_products','ptf_crm_offers','ptf_crm_reminders','ptf_crm_invoices','ptf_crm_notifs','ptf_crm_sendqueue','ptf_crm_inqitems','ptf_crm_deals','ptf_crm_projects','ptf_crm_letters','ptf_crm_contracts','ptf_crm_rfqsmart','ptf_crm_finance','ptf_crm_payables','ptf_crm_supplier_finance','ptf_crm_opex','ptf_crm_petty','ptf_crm_petty_tx','ptf_crm_petty_periods','ptf_crm_cheques','ptf_crm_fiscal_snapshots','ptf_crm_notifprefs','ptf_crm_avatars','ptf_crm_msgtpls','ptf_crm_deleted_archive','ptf_crm_tax_returns'];
    $collector = ['ptf_crm_customers','ptf_crm_offers','ptf_crm_invoices','ptf_crm_reminders','ptf_crm_notifs','ptf_crm_sendqueue','ptf_crm_deals','ptf_crm_projects','ptf_crm_cheques','ptf_crm_notifprefs','ptf_crm_avatars'];
    if ($role === 'accountant') return $accountant;
    if ($role === 'collector') return $collector;
    if ($role === 'buyer') return array_values(array_unique(array_merge($crm, ['ptf_crm_buycmp'])));
    return $crm; // sales and unknown roles get CRM-only sync, never finance keys
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
    ];
    return $map[$key] ?? [];
}
function sync_record_id_for_key($key, $r) {
    if (!is_array($r)) return '';
    if ($key === 'ptf_crm_offers') return trim((string)($r['no'] ?? $r['cd'] ?? $r['id'] ?? ''));
    return trim((string)($r['cd'] ?? $r['no'] ?? $r['id'] ?? $r['code'] ?? $r['invoiceCd'] ?? ''));
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

function sync_decode_archive($json) {
    $a = json_decode((string)$json, true);
    return is_array($a) ? $a : [];
}
function sync_apply_tombstones($key, $json, $serverArchiveJson = '', $incomingArchiveJson = '') {
    if ($key === 'ptf_crm_deleted_archive') return $json;
    $kinds = sync_tombstone_kinds_for_key($key);
    if (!$kinds) return $json;
    $kindSet = array_fill_keys(array_map('strtolower', $kinds), true);
    $ids = [];
    foreach (array_merge(sync_decode_archive($serverArchiveJson), sync_decode_archive($incomingArchiveJson)) as $d) {
        if (!is_array($d)) continue;
        $kind = strtolower((string)($d['kind'] ?? ''));
        if (!isset($kindSet[$kind])) continue;
        $id = trim((string)($d['id'] ?? $d['no'] ?? $d['cd'] ?? ''));
        if ($id !== '') $ids[$id] = true;
    }
    if (!$ids) return $json;
    $arr = json_decode((string)$json, true);
    if (!is_array($arr)) return $json;
    $out = [];
    foreach ($arr as $r) {
        $id = sync_record_id_for_key($key, $r);
        if ($id === '' || !isset($ids[$id])) $out[] = $r;
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
$log_entry = date('Y-m-d H:i:s') . " | " . ($_SERVER['REMOTE_ADDR'] ?? 'unknown') . " | $action\n";
$log = file_exists($log_file) ? file_get_contents($log_file) : '';
file_put_contents($log_file, $log_entry . substr($log, 0, 5000));

// Data file paths (JSON-based storage)
$data_dir = __DIR__ . '/../crm/data';
if (!is_dir($data_dir)) {
    mkdir($data_dir, 0755, true);
    file_put_contents($data_dir . '/.htaccess', "Deny from all\n");
}

function load_data($key) {
    global $data_dir;
    $file = "$data_dir/$key.json";
    if (!file_exists($file)) return [];
    $data = file_get_contents($file);
    return json_decode($data, true) ?: [];
}

function save_data($key, $data) {
    global $data_dir;
    $file = "$data_dir/$key.json";
    file_put_contents($file, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX);
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
            if (empty($next['roleId']) && !empty($next['role'])) $next['roleId'] = normalize_role('', $next['role']);
            // v33.2.1: اگر role فارسی نیست (یا خالی)، از roleId نگاشت فارسی بگیر
            $isPersian = (bool)preg_match('/[\x{0600}-\x{06FF}]/u', (string)($next['role'] ?? ''));
            if (!$isPersian && !empty($next['roleId'])) $next['role'] = role_persian_label($next['roleId']);
            $by[$key] = $next;
        }
    }
    return array_values($by);
}

// شمارنده یکتای ترتیبی (US-133 AC2: شماره یکتا برای هر ثبت‌نام/استعلام سایت)
function next_seq($key) {
    global $data_dir;
    $file = "$data_dir/counters.json";
    $c = file_exists($file) ? (json_decode(file_get_contents($file), true) ?: []) : [];
    $c[$key] = ($c[$key] ?? 0) + 1;
    file_put_contents($file, json_encode($c), LOCK_EX);
    return $c[$key];
}

// سال شمسی جاری (تقریب کافی برای شماره‌گذاری: از فروردین = ۲۱ مارس)
function fa_year() {
    $gy = (int)date('Y'); $gm = (int)date('n'); $gd = (int)date('j');
    $jy = $gy - 621;
    if ($gm < 3 || ($gm === 3 && $gd < 21)) $jy--;
    return $jy;
}

function clean($v, $max = 500) {
    $v = trim(strip_tags((string)$v));
    if (function_exists('mb_substr')) return mb_substr($v, 0, $max, 'UTF-8');
    return substr($v, 0, $max);
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
            $mob = preg_replace('/\D/', '', $r['mob'] ?? '');
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
        $attachmentError = '';
        $attachment = save_attachment('attachment', 'rfq', $attachmentError);
        if ($attachmentError) { http_response_code(503); echo json_encode(['ok' => false, 'error' => 'attachment_cloud', 'message' => $attachmentError], JSON_UNESCAPED_UNICODE); break; }
        $code = 'PTF-RFQ-' . fa_year() . '-' . str_pad(next_seq('rfq_site'), 4, '0', STR_PAD_LEFT);
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
        $rfqs[] = [
            'code' => clean($_POST['code'] ?? ('RFQ-' . rand(10000, 99999))),
            'company' => clean($_POST['company'] ?? ''),
            'contact' => clean($_POST['contact'] ?? ''),
            'category' => clean($_POST['category'] ?? ''),
            'status' => clean($_POST['status'] ?? 'st1'),
            'statusText' => clean($_POST['statusText'] ?? 'دریافت اولیه'),
            'date' => date('Y/m/d')
        ];
        save_data('rfqs', $rfqs);
        echo json_encode(['ok' => true]);
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
        $attachmentError = '';
        $attachment = save_attachment('attachment', 'ven', $attachmentError);
        if ($attachmentError) { http_response_code(503); echo json_encode(['ok' => false, 'error' => 'attachment_cloud', 'message' => $attachmentError], JSON_UNESCAPED_UNICODE); break; }
        $code = 'PTF-VEN-' . fa_year() . '-' . str_pad(next_seq('supplier'), 4, '0', STR_PAD_LEFT);
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
            'status' => 'pending',
            'statusText' => 'ثبت‌نام شده — در انتظار بررسی و تایید مدیران',
            'date' => date('Y-m-d H:i'),
            'approvedBy' => null
        ];
        save_data('suppliers', $suppliers);
        push_event_rec('supplier_site', 'یک تامین‌کننده در سایت ثبت‌نام کرد و منتظر بررسی است: ' . clean($_POST['company'] ?? '') . ' (' . $code . ')', ['code' => $code]);
        echo json_encode(['ok' => true, 'code' => $code], JSON_UNESCAPED_UNICODE);
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
        echo json_encode([
            'ok' => true, 'type' => $type,
            'code' => $found['code'],
            'company' => $found['company'] ?? '',
            'category' => $found['category'] ?? '',
            'status' => $found['status'] ?? '',
            'statusText' => $found['statusText'] ?? '',
            'date' => $found['date'] ?? ''
        ], JSON_UNESCAPED_UNICODE);
        break;

    // ===== US-133: صندوق ورودی سرور برای CRM (merge در مرورگر ادمین) =====
    case 'get_inbox':
        verify_request();
        echo json_encode([
            'ok' => true,
            'suppliers' => load_data('suppliers'),
            'rfqs' => array_values(array_filter(load_data('rfqs'), function ($r) { return ($r['src'] ?? '') === 'site'; }))
        ], JSON_UNESCAPED_UNICODE);
        break;

    // ===== US-133: به‌روزرسانی وضعیت از CRM (تایید/رد) → بازتاب در رهگیری سایت =====
    case 'set_status':
        verify_request();
        $type = $_POST['type'] ?? '';
        $code = clean($_POST['code'] ?? '', 60);
        $status = clean($_POST['status'] ?? '', 40);
        $statusText = clean($_POST['statusText'] ?? '', 200);
        $by = clean($_POST['by'] ?? '', 100);
        $key = $type === 'supplier' ? 'suppliers' : 'rfqs';
        $items = load_data($key);
        $done = false;
        foreach ($items as &$it) {
            if (($it['code'] ?? '') === $code) {
                $it['status'] = $status ?: $it['status'];
                $it['statusText'] = $statusText ?: $it['statusText'];
                if ($by) $it['approvedBy'] = $by;
                $done = true;
            }
        }
        if ($done) save_data($key, $items);
        echo json_encode(['ok' => $done], JSON_UNESCAPED_UNICODE);
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
        /* ===== US-282 (v122.3): بک‌آپ چرخشی با حداقل فضا =====
           - فشرده‌سازی gzip (حجم JSON معمولاً ~۸۰-۹۰٪ کم می‌شود)
           - سرور: hourly-latest (جایگزین) + ۳ نسخه روزانه + weekly-latest + monthly-latest = حداکثر ۶ فایل
           - ابری: فقط ۲ کلید ثابت جایگزین‌شونده + هرس خودکار فایل‌های قدیمی انباشته */
        $canGz = function_exists('gzencode');
        $blob = $canGz ? gzencode($raw, 6) : $raw;
        $ext  = $canGz ? '.json.gz' : '.json';
        /* ===== v15.0 (US-384 — سپر بک‌آپ): ریشه «بک‌آپ قبلی هم خراب بود» =====
           بک‌آپ خودکار (۲ دقیقه بعد از ورود + ساعتی) از دستگاهی که داده‌اش آسیب دیده،
           hourly-latest سالم را جایگزین می‌کرد. حالا: اگر شمار رکوردهای کلیدهای حیاتی
           نسبت به بک‌آپ موجود >۵۰٪ افت کرده باشد، نسخه جدید «قرنطینه» می‌شود
           (فایل suspect-*) و بک‌آپ‌های چرخشی سالم دست نمی‌خورند — مگر فلگ allow_shrink
           (بعد از Go-Live یا تایید صریح ادمین از تنظیمات). */
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
            echo json_encode(['ok' => true, 'mode' => 'quarantined', 'suspect' => $suspect, 't' => date('Y-m-d H:i:s')], JSON_UNESCAPED_UNICODE);
            break;
        }
        // ساعتی: همیشه جایگزین
        file_put_contents($bdir . '/hourly-latest' . $ext, $blob, LOCK_EX);
        if ($canGz) @unlink($bdir . '/hourly-latest.json'); // پاک‌سازی نسخه نافشرده قدیمی
        // روزانه: یک فایل per روز، فقط ۳ روز اخیر
        file_put_contents($bdir . '/daily-' . date('Y-m-d') . $ext, $blob, LOCK_EX);
        $files = array_merge(glob($bdir . '/daily-*.json') ?: [], glob($bdir . '/daily-*.json.gz') ?: []);
        if ($files && count($files) > 3) {
            sort($files);
            foreach (array_slice($files, 0, count($files) - 3) as $f) @unlink($f);
        }
        // هفتگی: یک فایل ثابت، فقط اگر هفته عوض شده جایگزین می‌شود
        $wk = $bdir . '/weekly-latest' . $ext;
        if (!file_exists($wk) || date('oW', filemtime($wk)) !== date('oW')) file_put_contents($wk, $blob, LOCK_EX);
        // ماهانه: یک فایل ثابت، فقط اول هر ماه جایگزین می‌شود
        $mo = $bdir . '/monthly-latest' . $ext;
        $isNewMonth = !file_exists($mo) || date('Y-m', filemtime($mo)) !== date('Y-m');
        if ($isNewMonth) file_put_contents($mo, $blob, LOCK_EX);
        // آپلود ابری با کلید ثابت (جایگزین قبلی — بدون انباشت) + هرس فایل‌های قدیمی
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
            // هرس ابری: هر چیزی زیر backups/ جز ۲ کلید ثابت حذف شود (پاکسازی انباشت آپلودهای ساعتی قدیمی)
            if ($arvan === 'arvan') {
                $ch3 = curl_init($base . '?action=backup_prune');
                curl_setopt_array($ch3, [CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true, CURLOPT_TIMEOUT => 15,
                    CURLOPT_HTTPHEADER => ['Content-Type: application/json'], CURLOPT_POSTFIELDS => '{}']);
                curl_exec($ch3);
                curl_close($ch3);
            }
        }
        echo json_encode(['ok' => true, 'mode' => $arvan, 't' => date('Y-m-d H:i:s')], JSON_UNESCAPED_UNICODE);
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
        echo json_encode(['ok' => true, 'backups' => $out], JSON_UNESCAPED_UNICODE);
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
        $rejected = []; /* v14.7 US-382 */
        $conflicts = []; $conflictData = []; $krevs = []; /* v15.0 US-384 */
        $allow_wipe = !empty($j['allow_wipe']); /* فقط مسیر Go-Live (US-377) این فلگ را می‌فرستد */
        $restore = !empty($j['restore']); /* v15.0 (US-384): بازگردانی بک‌آپ توسط ادمین — سرور باید هم‌راستا شود */
        $base = (isset($j['base']) && is_array($j['base'])) ? $j['base'] : null; /* v15.0: نسخه‌ای که کلاینت از هر کلید می‌شناسد */
        /* ===== v31.7.3 BUG-AUDIT-001-SYNC-RACE: flock برای meta.json =====
           جلوگیری از race condition بین دو data_push همزمان. بدون flock:
           Device A و B هر دو meta را rev=5 می‌خوانند → هر دو rev=6 می‌نویسند → lost update.
           با flock: دومی منتظر می‌ماند تا اولی تمام شود و rev واقعی را می‌بیند. */
        $metaLock = @fopen($meta_file . '.lock', 'c+');
        if ($metaLock) { @flock($metaLock, LOCK_EX); /* re-read meta under lock */ $meta = file_exists($meta_file) ? (json_decode(file_get_contents($meta_file), true) ?: []) : []; }
        $serverArchiveJson = file_exists($sdir . '/ptf_crm_deleted_archive.json') ? file_get_contents($sdir . '/ptf_crm_deleted_archive.json') : '[]';
        $incomingArchiveJson = isset($j['data']['ptf_crm_deleted_archive']) && is_string($j['data']['ptf_crm_deleted_archive']) ? $j['data']['ptf_crm_deleted_archive'] : '[]';
        foreach ($j['data'] as $k => $v) {
            if (!in_array($k, $allowed_keys, true)) continue;
            if (!in_array($k, $role_sync_keys, true)) { $forbidden_keys[] = $k; continue; }
            if (!is_string($v) || strlen($v) > 8 * 1048576) continue;
            $v = sync_apply_tombstones($k, $v, $serverArchiveJson, $incomingArchiveJson);
            /* v31.8 BUG-OFFER-SYNC-INTEGRITY-001: do not accept a stale client
               payload that increases duplicate offer lines. Existing corrupted
               records are deliberately not auto-mutated here; repair is explicit. */
            if ($k === 'ptf_crm_offers') {
                $offerFile = $sdir . '/ptf_crm_offers.json';
                $serverOffersJson = file_exists($offerFile) ? file_get_contents($offerFile) : '[]';
                if (sync_offers_payload_introduces_duplicates($v, $serverOffersJson)) {
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
            if (!$restore && !$allow_wipe && $base !== null && array_key_exists($k, $base) && (int)$base[$k] < $curRev) {
                $conflicts[] = $k;
                $cf = $sdir . '/' . $k . '.json';
                if (file_exists($cf)) $conflictData[$k] = sync_apply_tombstones($k, file_get_contents($cf), $serverArchiveJson, $incomingArchiveJson); /* legacy UAT token: $conflictData[$k] = file_get_contents($cf); */
                $krevs[$k] = $curRev;
                continue;
            }
            /* ===== v14.7 (US-382 — سپر ضد داده‌صفر): فهرست خالی روی داده ناخالی هرگز پذیرفته نمی‌شود
               مگر با فلگ صریح allow_wipe (Go-Live) یا restore (بازگردانی ادمین). ===== */
            if (!$allow_wipe && !$restore) {
                $newArr = json_decode($v, true);
                if (is_array($newArr) && count($newArr) === 0) {
                    $exFile = $sdir . '/' . $k . '.json';
                    if (file_exists($exFile)) {
                        $exArr = json_decode(file_get_contents($exFile), true);
                        if (is_array($exArr) && count($exArr) > 0) { $rejected[] = $k; continue; }
                    }
                }
            }
            file_put_contents($sdir . '/' . $k . '.json', $v, LOCK_EX);
            $meta[$k] = ['rev' => $curRev + 1, 't' => date('Y-m-d H:i:s'), 'by' => clean($j['by'] ?? '', 60)];
            $krevs[$k] = $curRev + 1;
            $saved++;
        }
        $meta['_global'] = ['rev' => ($meta['_global']['rev'] ?? 0) + 1, 't' => date('Y-m-d H:i:s')];
        file_put_contents($meta_file, json_encode($meta, JSON_UNESCAPED_UNICODE), LOCK_EX);
        if ($metaLock) { @flock($metaLock, LOCK_UN); @fclose($metaLock); }
        echo json_encode(['ok' => true, 'saved' => $saved, 'rev' => $meta['_global']['rev'], 'rejected' => $rejected,
            'forbidden' => array_values(array_unique($forbidden_keys)), 'role' => $client_role,
            'conflicts' => $conflicts, 'serverData' => $conflictData, 'krevs' => $krevs], JSON_UNESCAPED_UNICODE); /* v14.7 US-382 + v15.0 US-384 */
        break;

    case 'data_pull':
        verify_request();
        $sdir = $data_dir . '/sync';
        $meta_file = $sdir . '/meta.json';
        $meta = file_exists($meta_file) ? (json_decode(file_get_contents($meta_file), true) ?: []) : [];
        $since = (int)($_REQUEST['since'] ?? 0);
        $globalRev = $meta['_global']['rev'] ?? 0;
        // اگر کلاینت به‌روز است، فقط rev برگردان (سبک برای polling)
        if ($since >= $globalRev) { echo json_encode(['ok' => true, 'rev' => $globalRev, 'fresh' => true]); break; }
        $out = [];
        $allowed_keys = sync_all_keys();
        $role_sync_keys = sync_allowed_keys_for_role($client_role);
        $serverArchiveJson = file_exists($sdir . '/ptf_crm_deleted_archive.json') ? file_get_contents($sdir . '/ptf_crm_deleted_archive.json') : '[]';
        foreach ($meta as $k => $m) {
            if ($k === '_global') continue;
            if (!in_array($k, $allowed_keys, true) || !in_array($k, $role_sync_keys, true)) continue;
            $f = $sdir . '/' . $k . '.json';
            if (file_exists($f)) $out[$k] = sync_apply_tombstones($k, file_get_contents($f), $serverArchiveJson, '[]');
        }
        echo json_encode(['ok' => true, 'rev' => $globalRev, 'data' => $out, 'meta' => $meta], JSON_UNESCAPED_UNICODE);
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
            if (empty($u['passhash'])) {
                $prev = $existing_by_name[strtolower($u['username'])] ?? null;
                if ($prev && !empty($prev['passhash'])) {
                    $u['passhash'] = $prev['passhash']; // بازیابی هش از رکورد موجود سرور
                } else {
                    $dropped[] = $u['username']; // کاربر جدید بدون هش قابل ورود نیست — گزارش می‌شود، بی‌صدا نیست
                    continue;
                }
            }
            $clean[] = [
                'username' => clean($u['username'], 40),
                'passhash' => preg_replace('/[^a-f0-9]/', '', $u['passhash'] ?? ''),
                'name'     => clean($u['name'] ?? '', 80),
                'nameEn'   => clean($u['nameEn'] ?? '', 80),
                'role'     => clean($u['role'] ?? '', 80),
                'roleId'   => normalize_role($u['roleId'] ?? '', $u['role'] ?? ''),
                'mobile'   => preg_replace('/\D/', '', $u['mobile'] ?? ''),
                'email'    => clean($u['email'] ?? '', 80),
                'createdFa'=> clean($u['createdFa'] ?? '', 20),
                'createdBy'=> clean($u['createdBy'] ?? '', 80),
            ];
        }
        save_data('crm_users', $clean);
        echo json_encode(['ok' => true, 'count' => count($clean), 'dropped' => $dropped]);
        break;


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
        $token = auth_generate_token($found['username'], $role);
        if (!$token) {
            http_response_code(503);
            echo json_encode(['ok' => false, 'error' => 'token_issue_failed']);
            break;
        }
        echo json_encode(['ok' => true, 'token' => $token, 'role' => $role, 'user' => $found['username'], 'name' => $found['name'] ?? $found['username']], JSON_UNESCAPED_UNICODE);
        break;

    case 'users_get':
        // v31.7.4 BUG-AUDIT-004 FIXED: only return safe fields, never passhash
        verify_request();
        // v31.7.68 BUG-AUTH-MOBILE-USER-001: return safe merged users from all server stores.
        $all_users = load_all_crm_users_sources();
        $safe_users = array_map(function($u) {
            return [
                'username' => $u['username'] ?? '',
                'name'     => $u['name'] ?? '',
                'nameEn'   => $u['nameEn'] ?? '',
                'roleId'   => $u['roleId'] ?? 'sales',
                'role'     => $u['role'] ?? '',
                'mobile'   => $u['mobile'] ?? '',
                'email'    => $u['email'] ?? '',
            ];
        }, $all_users);
        echo json_encode(['ok' => true, 'users' => $safe_users], JSON_UNESCAPED_UNICODE);
        break;

    // v33.2.1: کلاینت نقش معتبر سرور را بپرسد — جلوگیری از ورود با نقش منقضی/اشتباه
    case 'role_verify':
        verify_request();
        echo json_encode(['ok' => true, 'role' => $client_role], JSON_UNESCAPED_UNICODE);
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
        $name = clean($_POST['name'] ?? '', 80);
        $roleId = normalize_role($_POST['roleId'] ?? '', $_POST['role'] ?? '');
        
        if (empty($username) || empty($passhash)) {
            echo json_encode(['ok' => false, 'error' => 'username and passhash required'], JSON_UNESCAPED_UNICODE);
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
        
        $existing_users[] = [
            'username' => $username,
            'passhash' => $passhash,
            'name' => $name,
            'roleId' => $roleId,
            'mobile' => clean($_POST['mobile'] ?? '', 20),
            'email' => clean($_POST['email'] ?? '', 80),
            'createdFa' => clean($_POST['createdFa'] ?? '', 20),
            'createdBy' => clean($_POST['createdBy'] ?? '', 80),
        ];
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
