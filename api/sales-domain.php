<?php
/**
 * PTF CRM — Sales-to-Cash Domain API v35
 * Server-authoritative command boundary for offer award, sales cases, receipts,
 * official invoice registration/correction/void, allocations and financial attachments.
 *
 * The existing deployment stores synchronized collections as JSON (optionally mirrored
 * to MySQL). This endpoint serializes all cross-collection commands under one lock,
 * writes temp files before rename, keeps a command journal/idempotency key, and returns
 * compatible projections to clients. It deliberately never infers cash from offer terms.
 */
declare(strict_types=1);
/* v34.8.11/F7: a runtime fatal in the command-status path must not be converted by
   the browser into an opaque HTML «invalid recovery response». Keep the endpoint's
   error contract JSON even when PHP dies after bootstrap; the error detail is bounded
   and an errorId is emitted for server-log correlation. */
ob_start();
register_shutdown_function(function (): void {
    $last = error_get_last();
    $fatalTypes = [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR, E_USER_ERROR];
    if (!is_array($last) || !in_array((int)($last['type'] ?? 0), $fatalTypes, true)) {
        if (ob_get_level() > 0) @ob_end_flush();
        return;
    }
    $message = trim((string)($last['message'] ?? 'fatal_error'));
    $errorId = substr(hash('sha256', $message . '|' . (string)($last['file'] ?? '') . '|' . (string)($last['line'] ?? '')), 0, 16);
    @error_log('sales-domain-fatal ' . $errorId . ' ' . $message);
    while (ob_get_level() > 0) @ob_end_clean();
    http_response_code(500);
    echo json_encode(['ok'=>false,'error'=>'sales_domain_fatal','errorId'=>$errorId,'detail'=>substr($message,0,300)], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
});
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/db-lib.php';

function sd_out(array $payload, int $status = 200): void {
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

$identity = auth_verify_token(auth_get_header_token());
if (!$identity) sd_out(['ok' => false, 'error' => 'authentication_required', 'needLogin' => true], 401);
$role = strtolower(trim((string)($identity['role'] ?? '')));
$user = trim((string)($identity['user'] ?? ''));
$raw = file_get_contents('php://input');
if (strlen((string)$raw) > 4 * 1048576) sd_out(['ok'=>false,'error'=>'payload_too_large'],413);
$body = json_decode((string)$raw, true);
if (!is_array($body)) $body = [];
$action = trim((string)($_GET['action'] ?? $body['action'] ?? 'snapshot'));

const SD_FIN_ROLES = ['admin', 'chairman', 'ceo', 'commercial', 'accountant'];
/* پرونده و گردش سهامداران فقط برای همان نقش‌هایی projection می‌شود که رابط
   سهامداران/سال مالی را می‌بینند؛ حسابدار همچنان فقط OPEX را دریافت می‌کند. */
const SD_SHAREHOLDER_VIEW_ROLES = ['admin', 'chairman', 'ceo', 'commercial'];
const SD_WIN_ROLES = ['admin', 'chairman', 'ceo', 'commercial', 'sales'];
const SD_OFFER_REPAIR_ROLES = ['admin', 'chairman'];
const SD_RFQ_ROLES = ['admin', 'chairman', 'ceo', 'commercial', 'sales', 'buyer', 'accountant'];
const SD_ADMIN_ROLES = ['admin'];
/* OPS-01 (v34.7.22): نسخهٔ پاسخ‌های سرویس از یک ثابت واحد خوانده می‌شود و با
   window.PTF_CRM_RELEASE در crm/index.html هم‌راستا نگه داشته می‌شود. پیش از این عدد
   ثابت '34.6.0' در سه نقطه hardcode بود و با نسخهٔ واقعی UI نمی‌خواند. */
const SD_SERVICE_VERSION = '34.18.0';

const SD_KEYS = [
    'ptf_crm_offers', 'ptf_crm_deals', 'ptf_crm_rfqs', 'ptf_crm_invoices',
    'ptf_crm_case_receipts', 'ptf_crm_receipt_allocations', 'ptf_crm_fin_attachments',
    'ptf_crm_corrections', 'ptf_crm_fin_findings', 'ptf_crm_deleted_archive',
    'ptf_crm_fiscal_snapshots', 'ptf_crm_sales_commands',
    'ptf_crm_reminders', 'ptf_crm_leads'
];

/* v34.8.13 (PHASE-C2 — زیرساخت فرمان عمومی): تعمیم الگوی موفق مالی به کل CRM.
   هر موجودیت در رجیستری: نقش‌های مجاز + فیلد هویت. فرمان‌ها از journal/idempotency/
   WAL موجود عبور می‌کنند؛ پاسخ، projection همان مجموعه را برمی‌گرداند. کلاینت با
   ptfBApplyServerProjection اعمال می‌کند (بدون dirty/push) = مسیر نازک واقعی.
   فعال‌سازی تدریجی per-collection؛ غیرفعال = مسیر legacy بدون تغییر. */
function sd_entity_registry(): array {
    return [
        'ptf_crm_reminders' => [
            'roles' => ['admin','chairman','ceo','commercial','sales','buyer','accountant','collector'],
            'id' => 'cd',
        ],
        /* v34.8.14 (C3-گام۱): سرنخ‌ها — دومین ماژول روی مسیر فرمانی */
        'ptf_crm_leads' => [
            'roles' => ['admin','chairman','ceo','commercial','sales'],
            'id' => 'cd',
        ],
        /* v34.8.34 (W1 — ROADMAP-THIN-CLIENT T2 موج اول، تأیید کارفرما):
           مشتریان/تامین‌کنندگان/کالاها. نقش‌ها عین ماتریس legacy
           (sync_allowed_keys_for_role در crm.php) — نه کمتر نه بیشتر.
           maxFields: رکوردهای این سه موجودیت پهن‌تر از سقف عمومی ۴۰ است. */
        'ptf_crm_customers' => [
            'roles' => ['admin','chairman','ceo','commercial','sales','buyer','accountant','collector'],
            'id' => 'cd', 'maxFields' => 120,
        ],
        'ptf_crm_suppliers' => [
            'roles' => ['admin','chairman','ceo','commercial','sales','buyer'],
            'id' => 'cd', 'maxFields' => 120,
        ],
        'ptf_crm_products' => [
            'roles' => ['admin','chairman','ceo','commercial','sales','buyer','accountant'],
            'id' => 'cd', 'maxFields' => 120,
        ],
        /* v34.8.34 (W2 — T2 موج دوم): درخواست‌ها/پرونده‌ها/پروژه‌ها + اقلام/پکینگ/کارتابل.
           نقش‌ها عین ماتریس legacy (هر ۸ نقش در $crm). notifs: sortIso — آرایهٔ سرور
           همیشه iso نزولی بماند تا projection با فرم کانونیکال کلاینت یکی باشد. */
        'ptf_crm_rfqs' => [
            'roles' => ['admin','chairman','ceo','commercial','sales','buyer','accountant','collector'],
            'id' => 'cd', 'maxFields' => 120,
        ],
        'ptf_crm_deals' => [
            'roles' => ['admin','chairman','ceo','commercial','sales','buyer','accountant','collector'],
            'id' => 'cd', 'maxFields' => 150,
        ],
        'ptf_crm_projects' => [
            'roles' => ['admin','chairman','ceo','commercial','sales','buyer','accountant','collector'],
            'id' => 'cd', 'maxFields' => 120,
        ],
        'ptf_crm_inqitems' => [
            'roles' => ['admin','chairman','ceo','commercial','sales','buyer','accountant','collector'],
            'id' => 'cd', 'maxFields' => 60,
        ],
        'ptf_crm_packinglists' => [
            'roles' => ['admin','chairman','ceo','commercial','sales','buyer','accountant','collector'],
            'id' => 'cd', 'maxFields' => 80,
        ],
        'ptf_crm_notifs' => [
            'roles' => ['admin','chairman','ceo','commercial','sales','buyer','accountant','collector'],
            'id' => 'cd', 'maxFields' => 80, 'sortIso' => true,
        ],
        /* v34.8.34 (W3 — T2 موج سوم، حساس‌ترین مالی): فاکتورها/رسیدها/تخصیص‌ها/اصلاحات/
           یافته‌ها/مرجوعی فروش. ثبت رسمی/غیررسمی/ابطال از قبل فرمان اختصاصی دارند
           (register_invoice/register_unofficial_invoice/correct_invoice) — این فقط
           مسیر ویرایش‌ها/تکمیل‌ها/حذف‌های UI را فرمانی می‌کند. نقش‌ها: فقط ارشد +
           accountant (مالی؛ sales/buyer/collector در ماتریس legacy این کلیدها را ندارند). */
        'ptf_crm_invoices' => [
            'roles' => ['admin','chairman','ceo','commercial','accountant'],
            'id' => 'cd', 'maxFields' => 200, 'sortIso' => true,
        ],
        'ptf_crm_case_receipts' => [
            'roles' => ['admin','chairman','ceo','commercial','accountant'],
            'id' => 'cd', 'maxFields' => 120, 'sortIso' => true,
        ],
        'ptf_crm_receipt_allocations' => [
            'roles' => ['admin','chairman','ceo','commercial','accountant'],
            'id' => 'cd', 'maxFields' => 80, 'sortIso' => true,
        ],
        'ptf_crm_corrections' => [
            'roles' => ['admin','chairman','ceo','commercial','accountant'],
            'id' => '_id', 'maxFields' => 80, 'sortIso' => true,
        ],
        'ptf_crm_fin_findings' => [
            'roles' => ['admin','chairman','ceo','commercial','accountant'],
            'id' => 'cd', 'maxFields' => 80, 'sortIso' => true,
        ],
        'ptf_crm_sales_returns' => [
            'roles' => ['admin','chairman','ceo','commercial','accountant'],
            'id' => 'cd', 'maxFields' => 120, 'sortIso' => true,
        ],
        /* v34.8.34 (W4 — T2 موج چهارم، تکمیل کامل): همهٔ کلیدهای کسب‌وکار باقی‌مانده.
           نقش‌ها عین ماتریس legacy (sync_allowed_keys_for_role در crm.php). */
        'ptf_crm_offers' => [
            'roles' => ['admin','chairman','ceo','commercial','sales','buyer','accountant','collector'],
            'id' => 'cd', 'maxFields' => 150,
        ],
        'ptf_crm_rfqsmart' => [
            'roles' => ['admin','chairman','ceo','commercial','sales','buyer','accountant'],
            'id' => 'cd', 'maxFields' => 120,
        ],
        'ptf_crm_payables' => [
            'roles' => ['admin','chairman','ceo','commercial','buyer','accountant'],
            'id' => 'cd', 'maxFields' => 150, 'sortIso' => true,
        ],
        'ptf_crm_letters' => [
            'roles' => ['admin','chairman','ceo','commercial','sales','buyer','accountant','collector'],
            'id' => 'cd', 'maxFields' => 120, 'sortIso' => true,
        ],
        'ptf_crm_sendqueue' => [
            'roles' => ['admin','chairman','ceo','commercial','sales','buyer','accountant','collector'],
            'id' => 'cd', 'maxFields' => 60, 'sortIso' => true,
        ],
        'ptf_crm_deleted_archive' => [
            'roles' => ['admin','chairman','ceo','commercial','sales','buyer','accountant'],
            'id' => '_id', 'maxFields' => 60, 'sortIso' => true,
        ],
        'ptf_crm_buycmp' => [
            'roles' => ['admin','chairman','ceo','commercial','sales','buyer','accountant'],
            'id' => 'cd', 'maxFields' => 120,
        ],
        'ptf_crm_settings' => [
            'roles' => ['admin','chairman','ceo','commercial'],
            'id' => '_id', 'maxFields' => 200,
        ],
        'ptf_crm_audit' => [
            'roles' => ['admin','chairman','ceo','commercial','sales','buyer','accountant','collector'],
            'id' => 'cd', 'maxFields' => 60, 'sortIso' => true,
        ],
        'ptf_crm_users' => [
            'roles' => ['admin','chairman','ceo','commercial'],
            'id' => 'username', 'maxFields' => 60,
        ],
        'ptf_crm_supplier_finance' => [
            'roles' => ['admin','chairman','ceo','commercial','buyer','accountant'],
            'id' => 'supplierCd', 'maxFields' => 150,
        ],
        'ptf_crm_cheques' => [
            'roles' => ['admin','chairman','ceo','commercial','buyer','accountant'],
            'id' => 'cd', 'maxFields' => 120,
        ],
        'ptf_crm_contracts' => [
            'roles' => ['admin','chairman','ceo','commercial','sales','buyer','accountant','collector'],
            'id' => 'cd', 'maxFields' => 120,
        ],
        'ptf_crm_buyquotes' => [
            'roles' => ['admin','chairman','ceo','commercial','sales','buyer','accountant'],
            'id' => 'cd', 'maxFields' => 120,
        ],
        'ptf_crm_smsbook' => [
            'roles' => ['admin','chairman','ceo','commercial','sales','accountant'],
            'id' => 'cd', 'maxFields' => 80,
        ],
        'ptf_crm_sigprofiles' => [
            'roles' => ['admin','chairman','ceo','commercial','sales','buyer','accountant','collector'],
            'id' => 'username', 'maxFields' => 60,
        ],
        'ptf_crm_petty' => [
            'roles' => ['admin','chairman','ceo','commercial','accountant'],
            'id' => 'cd', 'maxFields' => 120,
        ],
        'ptf_crm_inqreads' => [
            'roles' => ['admin','chairman','ceo','commercial','sales','buyer','accountant'],
            'id' => 'cd', 'maxFields' => 120, 'sortIso' => true,
        ],
        'ptf_crm_avatars' => [
            'roles' => ['admin','chairman','ceo','commercial','sales','buyer','accountant','collector'],
            'id' => 'user', 'maxFields' => 40,
        ],
        'ptf_crm_catalog_merges' => [
            'roles' => ['admin','chairman','ceo','commercial','sales','buyer','accountant'],
            'id' => 'cd', 'maxFields' => 60,
        ],
        'ptf_crm_vat_settlements' => [
            'roles' => ['admin','chairman','ceo','commercial','accountant'],
            'id' => 'cd', 'maxFields' => 120,
        ],
        'ptf_crm_purchase_returns' => [
            'roles' => ['admin','chairman','ceo','commercial','buyer','accountant'],
            'id' => 'cd', 'maxFields' => 120,
        ],
        'ptf_crm_perms' => [
            'roles' => ['admin','chairman','ceo','commercial'],
            'id' => 'roleId', 'maxFields' => 80,
        ],
        'ptf_crm_catalog_reviews' => [
            'roles' => ['admin','chairman','ceo','commercial','sales','buyer','accountant'],
            'id' => 'cd', 'maxFields' => 80,
        ],
        'ptf_crm_shareholders' => [
            'roles' => ['admin','chairman','ceo','commercial','accountant'],
            'id' => 'cd', 'maxFields' => 120,
        ],
        /* v34.8.34 (T5-2): چک‌های شخصی از کلیدهای فقط-دستگاه (ptf_personal_cheques_<user>)
           به کلید سینک‌شونده مشترک — پایان ریسک گم‌شدن چک شخصی با گم‌شدن گوشی. */
        'ptf_crm_personal_cheques' => [
            'roles' => ['admin','chairman','ceo','commercial','sales','buyer','accountant','collector'],
            'id' => 'cd', 'maxFields' => 120,
        ],
    ];
}
function sd_entity_sanitize_row(array $row, array &$stats = null, int $maxFields = 40): array {
    /* v34.8.34 (T1-3): فیلد null حفظ می‌شود (یادآورها link:null می‌سازند)، سقف متن
       ۲۰۰۰→۸۰۰۰ و hist ۵۰۰→۲۰۰۰؛ تعداد برش/حذف به‌صورت ساخت‌یافته در پاسخ فرمان
       برمی‌گردد تا حذفِ بی‌صدا از بین برود. */
    $stats = ['trimmed' => 0, 'dropped' => 0, 'kept' => 0];
    $trackString = function (string $original, string $stored) use (&$stats): void {
        if (mb_strlen($original, 'UTF-8') > mb_strlen($stored, 'UTF-8')) $stats['trimmed']++;
    };
    $out = []; $n = 0;
    foreach ($row as $k => $v) {
        if (!is_string($k) || $k === '' || strlen($k) > 40) { $stats['dropped']++; continue; }
        if ($n >= $maxFields) { $stats['dropped']++; break; }
        if ($v === null) { $out[$k] = null; $n++; $stats['kept']++; continue; }
        if (is_bool($v)) { $out[$k] = $v; $n++; $stats['kept']++; continue; }
        if (is_int($v) || is_float($v)) { $out[$k] = $v; $n++; $stats['kept']++; continue; }
        if (is_string($v)) { $stored = sd_text($v, 8000); $trackString($v, $stored); $out[$k] = $stored; $n++; $stats['kept']++; continue; }
        if (is_array($v)) {
            /* v34.8.14: لیست اسکالر (مثل shareUsers) عیناً با سقف نگه داشته می‌شود؛
               map تودرتو با مقادیر اسکالر مجاز است (مثل link/notifiedUsers). */
            $isList = array_keys($v) === range(0, count($v) - 1);
            if ($isList) {
                $list = [];
                foreach ($v as $item) {
                    if (is_string($item)) { $list[] = sd_text($item, 300); if (count($list) >= 60) break; continue; }
                    if (is_bool($item)) { $list[] = $item; continue; }
                    if (is_int($item) || is_float($item)) { $list[] = $item; continue; }
                    /* v34.8.14: لیست نقشه‌های اسکالر (مثل hist سرنخ) یک سطح مجاز است. */
                    if (is_array($item)) {
                        $subItem = [];
                        foreach ($item as $k3 => $v3) {
                            if (is_string($k3) && strlen($k3) <= 60 && (is_scalar($v3) || $v3 === null)) {
                                $storedSub = is_string($v3) ? sd_text($v3, 2000) : (is_bool($v3) ? $v3 : ($v3 === null ? null : (int)$v3));
                                if (is_string($v3)) $trackString($v3, $storedSub);
                                $subItem[$k3] = $storedSub;
                            }
                            if (count($subItem) >= 20) break;
                        }
                        $list[] = $subItem;
                        if (count($list) >= 60) break;
                        continue;
                    }
                }
                $out[$k] = $list; $n++; continue;
            }
            $sub = [];
            foreach ($v as $k2 => $v2) {
                if (is_string($k2) && strlen($k2) <= 60 && (is_scalar($v2) || $v2 === null)) {
                    $sub[$k2] = is_string($v2) ? sd_text($v2, 300) : (is_bool($v2) ? $v2 : ($v2 === null ? null : (int)$v2));
                }
                if (count($sub) >= 60) break;
            }
            $out[$k] = $sub; $n++; continue;
        }
    }
    return $out;
}

function sd_require_role(array $roles): void {
    global $role;
    if (!in_array($role, $roles, true)) sd_out(['ok' => false, 'error' => 'permission_denied'], 403);
}
function sd_now(): string { return gmdate('Y-m-d\TH:i:s\Z'); }
function sd_uuid(string $prefix): string {
    try { $rnd = bin2hex(random_bytes(16)); }
    catch (Throwable $e) { $rnd = hash('sha256', uniqid('', true) . mt_rand()); }
    return $prefix . '-' . substr($rnd, 0, 8) . '-' . substr($rnd, 8, 4) . '-' . substr($rnd, 12, 4) . '-' . substr($rnd, 16, 12);
}
function sd_gregorian_to_jalali(int $gy,int $gm,int $gd): array {
    $gdm=[0,31,59,90,120,151,181,212,243,273,304,334];
    if($gy>1600){$jy=979;$gy-=1600;}else{$jy=0;$gy-=621;}
    $gy2=$gm>2?$gy+1:$gy;
    $days=365*$gy+intdiv($gy2+3,4)-intdiv($gy2+99,100)+intdiv($gy2+399,400)-80+$gd+$gdm[$gm-1];
    $jy+=33*intdiv($days,12053);$days%=12053;$jy+=4*intdiv($days,1461);$days%=1461;
    if($days>365){$jy+=intdiv($days-1,365);$days=($days-1)%365;}
    if($days<186){$jm=1+intdiv($days,31);$jd=1+($days%31);}else{$jm=7+intdiv($days-186,30);$jd=1+(($days-186)%30);}
    return [$jy,$jm,$jd];
}
function sd_current_jalali_month(): string {
    $now=new DateTimeImmutable('now',new DateTimeZone('Asia/Tehran'));[$jy,$jm]=sd_gregorian_to_jalali((int)$now->format('Y'),(int)$now->format('n'),(int)$now->format('j'));
    return sprintf('%04d/%02d',$jy,$jm);
}
/* معادل stableRecurringCode مرورگر. recurringKeyهای حقوق ASCII هستند؛ مسیر UTF-16
   برای شناسه‌های قدیمی Unicode نیز خروجی charCodeAt جاوااسکریپت را حفظ می‌کند. */
function sd_stable_recurring_code(string $prefix,string $key): string {
    if(function_exists('mb_convert_encoding')){$raw=mb_convert_encoding($key,'UTF-16BE','UTF-8');$units=array_values(unpack('n*',$raw)?:[]);}else{$units=array_values(unpack('C*',$key)?:[]);}
    $a=5381;$b=52711;foreach($units as $unit){$a=(($a*33)^$unit)&0xFFFFFFFF;$b=(($b*31)+$unit)&0xFFFFFFFF;}
    return $prefix.'-'.strtoupper(sprintf('%08X%08X',$a,$b));
}
function sd_text($value, int $max = 500): string {
    $s = trim((string)$value);
    if (function_exists('mb_substr')) return mb_substr($s, 0, $max, 'UTF-8');
    return substr($s, 0, $max);
}
function sd_identity($value): string {
    $s=strtr(trim((string)$value),['۰'=>'0','۱'=>'1','۲'=>'2','۳'=>'3','۴'=>'4','۵'=>'5','۶'=>'6','۷'=>'7','۸'=>'8','۹'=>'9','٠'=>'0','١'=>'1','٢'=>'2','٣'=>'3','٤'=>'4','٥'=>'5','٦'=>'6','٧'=>'7','٨'=>'8','٩'=>'9']);
    return strtoupper((string)preg_replace('/[\s\x{200c}\x{200e}\x{200f}]+/u','',$s));
}
/* v34.7.16: تعارض هویت بین دو پرونده برای ادغام — همان قاعده‌ای که commit اعمال می‌کند.
   fallback buyerCo وقتی buyerCd هر دو خالی است (هماهنگ با sd_case_offer_linked) تا دو مشتریِ
   متفاوت که فقط با نام ثبت شده‌اند از ادغام اشتباه مصون بمانند. خروجی = نام فیلد متعارض یا ''. */
function sd_case_identity_conflict(array $a, array $b): string {
    foreach (['inqNo','buyerCd','currency'] as $identityKey) {
        $av = sd_identity($a[$identityKey] ?? '');
        $bv = sd_identity($b[$identityKey] ?? '');
        if ($av !== '' && $bv !== '' && $av !== $bv) return $identityKey;
    }
    if (sd_identity($a['buyerCd'] ?? '') === '' && sd_identity($b['buyerCd'] ?? '') === '') {
        $av = sd_identity($a['buyerCo'] ?? '');
        $bv = sd_identity($b['buyerCo'] ?? '');
        if ($av !== '' && $bv !== '' && $av !== $bv) return 'buyerCo';
    }
    return '';
}
function sd_num($value): float {
    if (is_int($value) || is_float($value)) return is_finite((float)$value) ? (float)$value : 0.0;
    $s = strtr((string)$value, ['۰'=>'0','۱'=>'1','۲'=>'2','۳'=>'3','۴'=>'4','۵'=>'5','۶'=>'6','۷'=>'7','۸'=>'8','۹'=>'9','٠'=>'0','١'=>'1','٢'=>'2','٣'=>'3','٤'=>'4','٥'=>'5','٦'=>'6','٧'=>'7','٨'=>'8','٩'=>'9']);
    $s = preg_replace('/[^0-9.\-]/', '', $s);
    return is_numeric($s) ? (float)$s : 0.0;
}
function sd_active(array $r): bool {
    $terminal=['void','voided','cancelled','deleted','replaced','superseded'];
    $status=strtolower(trim((string)($r['status']??'')));$st=strtolower(trim((string)($r['st']??'')));
    return !in_array($status,$terminal,true)&&!in_array($st,$terminal,true)&&empty($r['voided'])&&empty($r['deleted']);
}
function sd_date_key($value): string {
    $s=strtr(trim((string)$value),['۰'=>'0','۱'=>'1','۲'=>'2','۳'=>'3','۴'=>'4','۵'=>'5','۶'=>'6','۷'=>'7','۸'=>'8','۹'=>'9','٠'=>'0','١'=>'1','٢'=>'2','٣'=>'3','٤'=>'4','٥'=>'5','٦'=>'6','٧'=>'7','٨'=>'8','٩'=>'9']);
    if(preg_match('/((?:13|14|20)\d{2})[\/-](\d{1,2})[\/-](\d{1,2})/',$s,$m))return sprintf('%04d-%02d-%02d',(int)$m[1],(int)$m[2],(int)$m[3]);
    return '';
}
function sd_year($value): string {
    $s = strtr((string)$value, ['۰'=>'0','۱'=>'1','۲'=>'2','۳'=>'3','۴'=>'4','۵'=>'5','۶'=>'6','۷'=>'7','۸'=>'8','۹'=>'9','٠'=>'0','١'=>'1','٢'=>'2','٣'=>'3','٤'=>'4','٥'=>'5','٦'=>'6','٧'=>'7','٨'=>'8','٩'=>'9']);
    return preg_match('/(13|14)\d{2}/', $s, $m) ? $m[0] : '';
}
function sd_is_locked(array $snaps, string $date): bool {
    $year = sd_year($date);
    if ($year === '') return false;
    foreach ($snaps as $s) {
        if (is_array($s) && !empty($s['locked']) && (string)($s['year'] ?? '') === $year) return true;
    }
    return false;
}
function sd_invalidate_period(array &$snaps, string $date, string $by, string $reason): string {
    $year=sd_year($date); if($year==='')return '';
    foreach($snaps as &$s){if(!is_array($s)||(string)($s['year']??'')!==$year||empty($s['locked']))continue;$s['locked']=false;$s['invalidated']=true;$s['invalidatedAt']=sd_now();$s['invalidatedBy']=$by;$s['invalidateReason']=$reason;}unset($s);
    return $year;
}
function sd_sync_dir(): string {
    $d = __DIR__ . '/../crm/data/sync';
    if (!is_dir($d)) @mkdir($d, 0750, true);
    return $d;
}
function sd_current_rev(): int {
    $metaFile = sd_sync_dir() . '/meta.json';
    $meta = is_file($metaFile) ? json_decode((string)@file_get_contents($metaFile), true) : [];
    return is_array($meta) ? (int)($meta['_global']['rev'] ?? 0) : 0;
}
function sd_read(string $key): array {
    $file = sd_sync_dir() . '/' . $key . '.json';
    $value = null;
    try { $value = ptf_db_read_fresh($key, $file); } catch (Throwable $e) { $value = null; }
    if ($value === null && is_file($file)) $value = @file_get_contents($file);
    if ($value === null) {
        $legacy = __DIR__ . '/../crm/data/' . $key . '.json';
        if (is_file($legacy)) $value = @file_get_contents($legacy);
    }
    $decoded = json_decode((string)$value, true);
    return is_array($decoded) ? $decoded : [];
}
function sd_offer_id(array &$offer): string {
    if (empty($offer['_id'])) $offer['_id'] = sd_uuid('OFR');
    return (string)$offer['_id'];
}
function sd_case_id(array &$case): string {
    if (empty($case['_id'])) $case['_id'] = sd_uuid('CASE');
    return (string)$case['_id'];
}
function sd_case_match(array $case, string $id): bool {
    return $id !== '' && ((string)($case['_id'] ?? '') === $id || (string)($case['cd'] ?? '') === $id);
}
function sd_find_case_index(array $cases, string $id): int {
    foreach ($cases as $i => $case) if (is_array($case) && sd_case_match($case, $id)) return (int)$i;
    return -1;
}
/* مالک leak-safe پرونده: سرور و crm/ar-reconcile.js عمداً یک ترتیب evidence دارند.
   هیچ شناسهٔ متعارضی با اولویت/حدس پوشانده نمی‌شود و نام فقط در حالت یکتای کامل مجاز است. */
function sd_party_name($value): string {
    $s = trim((string)$value);
    $s = (string)preg_replace('/[\s\x{200c}\x{200e}\x{200f}\-_.،,؛;]+/u', '', $s);
    return function_exists('mb_strtolower') ? mb_strtolower($s, 'UTF-8') : strtolower($s);
}
function sd_customer_record_id(array $customer): string { $id=trim((string)($customer['_id']??''));return $id!==''?$id:trim((string)($customer['cd']??'')); }
/* cd قدیمی و _id سروریِ همان Customer قبل از conflict-check به شناسهٔ متعارف
   collapse می‌شوند. alias مشترک بین چند رکورد عمداً همهٔ candidates را نگه می‌دارد. */
function sd_customer_candidates_for_id($value,array $customers): array {
    $raw=trim((string)$value);if($raw==='')return [];$found=[];
    foreach($customers as $customer){if(!is_array($customer))continue;if(trim((string)($customer['_id']??''))!==$raw&&trim((string)($customer['cd']??''))!==$raw)continue;$canonical=sd_customer_record_id($customer);if($canonical!=='')$found[$canonical]=true;}
    return count($found)?array_keys($found):[$raw];
}
function sd_case_offer_refs(array $case): array {
    $ids=[];$nos=[];
    foreach([$case['rootOfferId']??'']as $v){$v=trim((string)$v);if($v!=='')$ids[$v]=true;}
    foreach([$case['wonOffer']??'',$case['offerNo']??'']as $v){$v=trim((string)$v);if($v!=='')$nos[$v]=true;}
    foreach(($case['linkedOffers']??[])as $link){if(!is_array($link))continue;$id=trim((string)($link['offerId']??$link['_id']??''));$no=trim((string)($link['offerNo']??$link['no']??''));if($id!=='')$ids[$id]=true;if($no!=='')$nos[$no]=true;}
    return ['ids'=>$ids,'nos'=>$nos];
}
function sd_offer_linked_to_case(array $offer,array $refs): bool {
    $id=trim((string)($offer['_id']??$offer['cd']??''));$no=trim((string)($offer['no']??''));
    return ($id!==''&&isset($refs['ids'][$id]))||($no!==''&&isset($refs['nos'][$no]));
}
function sd_resolve_case_customer(array $case,array $cases,array $offers,array $invoices,array $receipts,array $customers): array {
    $aliases=[];foreach([$case['_id']??'',$case['cd']??'']as $v){$v=trim((string)$v);if($v!=='')$aliases[$v]=true;}
    $candidates=[];$evidence=[];$names=[];
    $addId=function($value,string $source)use(&$candidates,&$evidence,$customers):void{foreach(sd_customer_candidates_for_id($value,$customers)as $id){$candidates[$id]=true;$evidence[$id]=$evidence[$id]??[];$evidence[$id][]=$source;}};
    $addName=function($value,string $source)use(&$names):void{$name=sd_party_name($value);if($name==='')return;$names[$name]=$names[$name]??[];$names[$name][]=$source;};
    $addId($case['buyerCd']??'','case');$addId($case['customerId']??'','case');$addName($case['buyerCo']??$case['customerName']??'','case');
    $refs=sd_case_offer_refs($case);
    foreach($offers as $offer){if(!is_array($offer)||!sd_active($offer)||!sd_offer_linked_to_case($offer,$refs))continue;$addId($offer['buyerCd']??'','offer');$addId($offer['customerId']??'','offer');$addName($offer['buyerCo']??$offer['customerName']??'','offer');}
    foreach($invoices as $invoice){
        if(!is_array($invoice)||!sd_active($invoice))continue;
        $stored=isset($aliases[(string)($invoice['caseId']??'')]);$uniqueOfferBind=false;$offerNo=trim((string)($invoice['offerNo']??''));
        if(!$stored&&trim((string)($invoice['caseId']??''))===''&&$offerNo!==''&&isset($refs['nos'][$offerNo])){$hits=[];foreach($cases as $candidate){if(!is_array($candidate)||!sd_active($candidate))continue;$candidateRefs=sd_case_offer_refs($candidate);if(isset($candidateRefs['nos'][$offerNo]))$hits[]=$candidate;}if(count($hits)===1){foreach([$hits[0]['_id']??'',$hits[0]['cd']??'']as $id)if($id!==''&&isset($aliases[(string)$id]))$uniqueOfferBind=true;}}
        if(!$stored&&!$uniqueOfferBind)continue;$addId($invoice['customerId']??'','invoice');$addId($invoice['buyerCd']??'','invoice');$addName($invoice['buyerCo']??$invoice['customerName']??'','invoice');
    }
    foreach($receipts as $receipt){if(!is_array($receipt)||!sd_active($receipt)||(string)($receipt['status']??'')!=='posted'||!isset($aliases[(string)($receipt['caseId']??'')]))continue;$addId($receipt['customerId']??'','receipt');$addId($receipt['buyerCd']??'','receipt');$addName($receipt['buyerCo']??$receipt['customerName']??'','receipt');}
    $ids=array_keys($candidates);sort($ids,SORT_STRING);
    if(count($ids)>1)return ['status'=>'ambiguous','customerId'=>'','bound'=>'conflicting-identifiers','candidates'=>$ids,'evidence'=>$evidence];
    if(count($ids)===1){$sources=$evidence[$ids[0]]??[];$bound=in_array('case',$sources,true)?'case':(in_array('offer',$sources,true)?'offer':'case-document');return ['status'=>'resolved','customerId'=>$ids[0],'bound'=>$bound,'candidates'=>$ids,'evidence'=>$evidence];}
    $nameKeys=array_keys($names);if(!$nameKeys)return ['status'=>'unresolved','customerId'=>'','bound'=>'no-evidence','candidates'=>[],'evidence'=>$evidence];
    $owners=[];foreach($customers as $customer){if(!is_array($customer))continue;$id=sd_customer_record_id($customer);if($id==='')continue;foreach([$customer['co']??$customer['name']??'',$customer['coEn']??'']as $value){$name=sd_party_name($value);if($name!==''&&isset($names[$name]))$owners[$id]=true;}}
    $ownerIds=array_keys($owners);sort($ownerIds,SORT_STRING);$allMapped=count($ownerIds)===1;
    if($allMapped)foreach($nameKeys as $nameKey){$mapped=false;foreach($customers as $customer){if(!is_array($customer)||sd_customer_record_id($customer)!==$ownerIds[0])continue;foreach([$customer['co']??$customer['name']??'',$customer['coEn']??'']as $value)if(sd_party_name($value)===$nameKey)$mapped=true;}if(!$mapped){$allMapped=false;break;}}
    if($allMapped)return ['status'=>'resolved','customerId'=>$ownerIds[0],'bound'=>'unique-name','candidates'=>$ownerIds,'evidence'=>$evidence];
    if($ownerIds||count($nameKeys)>1)return ['status'=>'ambiguous','customerId'=>'','bound'=>'ambiguous-name','candidates'=>$ownerIds,'evidence'=>$evidence];
    return ['status'=>'unresolved','customerId'=>'','bound'=>'name-not-found','candidates'=>[],'evidence'=>$evidence];
}
function sd_offer_total(array $offer): float {
    $sum = 0.0;
    foreach (($offer['items'] ?? []) as $it) if (is_array($it)) $sum += sd_num($it['qty'] ?? 0) * sd_num($it['price'] ?? 0);
    return $sum;
}
/* v34.7.39 — workflow درخواست read-model همان commit ثبت پیشنهاد است. */
function sd_rfq_matches_inquiry(array $rfq, string $inqNo): bool {
    return $inqNo !== '' && ((string)($rfq['cd'] ?? '') === $inqNo || (string)($rfq['inqNo'] ?? '') === $inqNo);
}
function sd_workflow_label(string $wf): string {
    $labels=['WF10'=>'📥 دریافت اولیه','WF20'=>'🔧 پیشنهاد فنی صادر شد','WF30'=>'⏳ منتظر پاسخ کارفرما (فنی)','WF35'=>'✏️ در حال صدور پیشنهاد اصلاحی (فنی)','WF40'=>'💰 منتظر صدور پیشنهاد مالی','WF50'=>'💵 پیشنهاد مالی صادر شد','WF55'=>'✏️ در حال اصلاح پیشنهاد مالی','WF60'=>'⏳ منتظر پاسخ کارفرما (مالی)','WF70'=>'🏗 در حال تامین','WF90'=>'🗂 بایگانی — عدم تایید فنی','WF91'=>'🗂 بایگانی — بازنده مالی'];
    return $labels[$wf] ?? $wf;
}
function sd_workflow_for_inquiry(string $inqNo, array $offers): string {
    $lastCo=null;$lastTo=null;
    foreach($offers as $offer){
        if(!is_array($offer)||(string)($offer['inqNo']??'')!==$inqNo)continue;
        $kind=strtoupper((string)($offer['kind']??''));
        if($lastCo===null&&in_array($kind,['CO','TC'],true))$lastCo=$offer;
        if($lastTo===null&&$kind==='TO')$lastTo=$offer;
    }
    if($lastCo!==null){$st=(string)($lastCo['st']??'draft');if($st==='won')return'WF70';if($st==='lost')return'WF91';if($st==='revise')return'WF55';if($st==='sent')return'WF60';return'WF50';}
    if($lastTo!==null){$st=(string)($lastTo['tst']??$lastTo['st']??'draft');if($st==='rejected'||$st==='lost')return'WF90';if($st==='approved'||$st==='won')return'WF40';if($st==='revise')return'WF35';if($st==='sent')return'WF30';return'WF20';}
    return'WF10';
}
function sd_apply_offer_workflow(array &$rfqs,array $offers,string $inqNo,string $user,string $event): array {
    if($inqNo==='')return ['found'=>false,'wf'=>''];
    foreach($rfqs as &$rfq){
        if(!is_array($rfq)||!sd_rfq_matches_inquiry($rfq,$inqNo))continue;
        $wf=sd_workflow_for_inquiry($inqNo,$offers);$changed=(string)($rfq['wf']??'')!==$wf;
        $rfq['wf']=$wf;$rfq['stxt']=sd_workflow_label($wf);$rfq['wfUpdatedAtISO']=sd_now();
        if($changed){if(!isset($rfq['wfLog'])||!is_array($rfq['wfLog']))$rfq['wfLog']=[];$rfq['wfLog'][]=['t'=>sd_now(),'by'=>$user,'wf'=>$wf,'ev'=>$event];}
        $id=(string)($rfq['_id']??$rfq['cd']??'');unset($rfq);return ['found'=>true,'rfqId'=>$id,'wf'=>$wf,'changed'=>$changed];
    }unset($rfq);
    return ['found'=>false,'wf'=>''];
}
function sd_file_ok(array $file): bool {
    $key = trim((string)($file['key'] ?? ''));
    $name = strtolower(trim((string)($file['name'] ?? $key)));
    $type = strtolower(trim((string)($file['contentType'] ?? $file['mimeType'] ?? '')));
    if ($key === '') return false;
    $extOk = (bool)preg_match('/\.(jpg|jpeg|png|webp|pdf)(?:$|[?#])/i', $name);
    $mimeOk = $type === '' || strpos($type, 'image/') === 0 || $type === 'application/pdf';
    return $extOk && $mimeOk;
}
function sd_invoice_files_ok(array $files): bool {
    foreach ($files as $f) {
        if (!is_array($f) || !sd_file_ok($f)) continue;
        $cat = (string)($f['category'] ?? '');
        if (in_array($cat, ['accounting_official_invoice', 'modian_tax_invoice'], true)
            && !empty($f['readVerified'])
            && !in_array((string)($f['status'] ?? 'active'), ['replaced', 'deleted', 'rejected'], true)) return true;
    }
    return false;
}
function sd_vat(float $base, float $pct): int { return (int)round($base * $pct / 100, 0, PHP_ROUND_HALF_UP); }

/* v34.7.18 (AR-INTEGRITY فاز ۱) — سقف تخصیص هر فاکتور.
   ریشهٔ باگ: تخصیص روی base+vat انجام می‌شد ولی همهٔ نماها amount را ملاک می‌گیرند؛
   در فاکتور غیررسمیِ دارای تخفیف (base ناخالص، amount خالص) دو عدد متفاوت تولید می‌شد.
   قاعدهٔ جدید: سقف کل = amount قطعی سند؛ سهم VAT حداکثر تا vat ثبت‌شده و بقیه base. */
function sd_invoice_caps(array $inv): array {
    $base = (int)round(sd_num($inv['base'] ?? $inv['baseAmountIRR'] ?? 0));
    $vat  = (int)round(sd_num($inv['vat'] ?? $inv['vatAmountIRR'] ?? 0));
    $amount = (int)round(sd_num($inv['amount'] ?? $inv['totalAmountIRR'] ?? 0));
    if ($amount <= 0) $amount = $base + $vat;
    $vatCap = max(0, min($vat, $amount));
    $baseCap = max(0, $amount - $vatCap);
    return ['amount' => $amount, 'base' => $baseCap, 'vat' => $vatCap];
}
/* v34.7.18 — فاکتورهای بدون caseId که با شمارهٔ پیشنهاد به‌طور یکتا به همین پرونده می‌خورند
   در لحظهٔ تخصیص متصل می‌شوند. بدون این اتصال، دریافت پرونده هرگز از فاکتور کسر نمی‌شد
   (گزارش کارفرما: «کل فاکتور همچنان مطالبات باز است»). فقط تطبیق یکتا؛ هیچ حدسی زده نمی‌شود. */
function sd_bind_orphan_invoices(string $caseId, array $cases, array &$invoices): int {
    if ($caseId === '') return 0;
    $case = null;
    foreach ($cases as $c) if (is_array($c) && sd_case_match($c, $caseId)) { $case = $c; break; }
    if (!$case) return 0;
    $offerNos = [];
    foreach ([$case['wonOffer'] ?? '', $case['offerNo'] ?? ''] as $no) if (trim((string)$no) !== '') $offerNos[trim((string)$no)] = true;
    foreach (($case['linkedOffers'] ?? []) as $l) if (is_array($l) && trim((string)($l['offerNo'] ?? '')) !== '') $offerNos[trim((string)$l['offerNo'])] = true;
    if (!$offerNos) return 0;
    /* اگر همان شمارهٔ پیشنهاد به بیش از یک پرونده وصل باشد، اتصال خودکار انجام نمی‌شود. */
    foreach ($cases as $other) {
        if (!is_array($other) || sd_case_match($other, $caseId) || !sd_active($other)) continue;
        foreach ([$other['wonOffer'] ?? '', $other['offerNo'] ?? ''] as $no) if (trim((string)$no) !== '' && isset($offerNos[trim((string)$no)])) return 0;
    }
    $bound = 0;
    foreach ($invoices as &$inv) {
        if (!is_array($inv) || !sd_active($inv)) continue;
        if (trim((string)($inv['caseId'] ?? '')) !== '') continue;
        $ono = trim((string)($inv['offerNo'] ?? ''));
        if ($ono === '' || !isset($offerNos[$ono])) continue;
        $inv['caseId'] = $caseId;
        if (empty($inv['customerId'])) $inv['customerId'] = $case['buyerCd'] ?? '';
        $inv['caseBoundBy'] = 'auto-unique-offer'; $inv['caseBoundAt'] = sd_now();
        $bound++;
    }
    unset($inv);
    return $bound;
}
/** Rebuild deterministic FIFO allocations for every active invoice/receipt in a case. */
/* لینک‌های cd قدیمیِ همان پرونده قبل از بازسازی به _id canonical منتقل می‌شوند؛
   وگرنه Receipt تازه credit آزاد می‌ساخت ولی فاکتور legacy روی سطل دیگری می‌ماند. */
function sd_canonicalize_case_links(array $case,string $caseId,array &$receipts,array &$invoices,array &$allocations): int {
    $aliases=[];foreach([$case['_id']??'',$case['cd']??'']as $value){$id=trim((string)$value);if($id!==''&&$id!==$caseId)$aliases[$id]=true;}
    if(!$aliases)return 0;$updated=0;
    $canonicalize=function(array &$rows)use(&$updated,$aliases,$caseId):void{foreach($rows as &$row)if(is_array($row)&&isset($aliases[(string)($row['caseId']??'')])){$row['caseId']=$caseId;$updated++;}unset($row);};
    $canonicalize($receipts);$canonicalize($invoices);$canonicalize($allocations);return $updated;
}
function sd_rebuild_allocations(string $caseId, array &$receipts, array &$invoices, array &$allocations, array $cases = []): void {
    if ($cases) sd_bind_orphan_invoices($caseId, $cases, $invoices);
    $history = [];
    foreach ($allocations as $a) {
        if (is_array($a) && (string)($a['caseId'] ?? '') === $caseId && sd_active($a)) {
            $a['status'] = 'replaced'; $a['replacedAt'] = sd_now(); $history[] = $a;
        }
    }
    $allocations = array_values(array_filter($allocations, function ($a) use ($caseId) {
        return !is_array($a) || (string)($a['caseId'] ?? '') !== $caseId;
    }));
    if ($history) {
        foreach ($history as $h) $allocations[] = $h;
    }
    $invoiceIdx = [];
    foreach ($invoices as $i => &$inv) {
        if (!is_array($inv) || (string)($inv['caseId'] ?? '') !== $caseId || !sd_active($inv)) continue;
        $inv['allocatedBase'] = 0; $inv['allocatedVat'] = 0;
        $invoiceIdx[] = $i;
    }
    unset($inv);
    usort($invoiceIdx, function ($a, $b) use ($invoices) {
        return strcmp((string)($invoices[$a]['invDate'] ?? $invoices[$a]['issueDate'] ?? $invoices[$a]['t'] ?? ''), (string)($invoices[$b]['invDate'] ?? $invoices[$b]['issueDate'] ?? $invoices[$b]['t'] ?? ''));
    });
    $receiptIdx = [];
    foreach ($receipts as $i => &$r) {
        if (!is_array($r) || (string)($r['caseId'] ?? '') !== $caseId || !sd_active($r) || (string)($r['status'] ?? '') !== 'posted') continue;
        $r['allocatedIRR'] = 0; $r['creditRemainIRR'] = (int)round(sd_num($r['amountIRR'] ?? $r['amt'] ?? 0));
        $receiptIdx[] = $i;
    }
    unset($r);
    usort($receiptIdx, function ($a, $b) use ($receipts) {
        return strcmp((string)($receipts[$a]['receivedAt'] ?? $receipts[$a]['dateISO'] ?? $receipts[$a]['t'] ?? ''), (string)($receipts[$b]['receivedAt'] ?? $receipts[$b]['dateISO'] ?? $receipts[$b]['t'] ?? ''));
    });
    foreach ($receiptIdx as $ri) {
        $available = (int)round(sd_num($receipts[$ri]['amountIRR'] ?? 0));
        /* v34.7.18 (AR-INTEGRITY فاز ۱ / علت ریشه‌ای R1):
           پیش از این، اجازهٔ تخصیص به ارزش‌افزوده از فیلد منجمدِ timing خوانده می‌شد که فقط
           یک‌بار هنگام «ثبت دریافت» محاسبه می‌شد. پیش‌پرداختی که قبل از صدور فاکتور دریافت
           شده بود برای همیشه pre_invoice می‌ماند و سهم VAT هرگز تخصیص نمی‌گرفت؛ نتیجه:
           مشتری کل مبلغ را پرداخت می‌کرد ولی دقیقاً به اندازهٔ VAT «مطالبهٔ باز» می‌ماند.
           اکنون مجوز به‌ازای هر جفت (دریافت، فاکتور) و بر مبنای واقعیتِ لحظهٔ بازسازی تعیین
           می‌شود: به‌محض اینکه فاکتور واقعاً صادر شده باشد، VAT همان فاکتور قابل تخصیص است.
           فیلد timing هم برای گزارش‌ها به‌روز می‌شود (اثر مالی از خودِ تخصیص می‌آید). */
        $timingIsPost = false;
        foreach ($invoiceIdx as $ii) {
            if ($available <= 0) break;
            $caps = sd_invoice_caps($invoices[$ii]);
            $invoiceIssued = sd_date_key($invoices[$ii]['invDate'] ?? $invoices[$ii]['issueDate'] ?? $invoices[$ii]['t'] ?? '') !== ''
                || $caps['amount'] > 0;
            $baseRoom = max(0, $caps['base'] - (int)($invoices[$ii]['allocatedBase'] ?? 0));
            if ($baseRoom > 0) {
                $take = min($available, $baseRoom);
                $allocations[] = ['_id'=>sd_uuid('ALLOC'),'caseId'=>$caseId,'receiptId'=>$receipts[$ri]['_id'],'invoiceId'=>$invoices[$ii]['_id'],'component'=>'base','amountIRR'=>$take,'status'=>'active','allocatedAt'=>sd_now()];
                $invoices[$ii]['allocatedBase'] += $take; $receipts[$ri]['allocatedIRR'] += $take; $available -= $take;
                $timingIsPost = true;
            }
            if ($available > 0 && $invoiceIssued) {
                $vatRoom = max(0, $caps['vat'] - (int)($invoices[$ii]['allocatedVat'] ?? 0));
                if ($vatRoom > 0) {
                    $take = min($available, $vatRoom);
                    $allocations[] = ['_id'=>sd_uuid('ALLOC'),'caseId'=>$caseId,'receiptId'=>$receipts[$ri]['_id'],'invoiceId'=>$invoices[$ii]['_id'],'component'=>'vat','amountIRR'=>$take,'status'=>'active','allocatedAt'=>sd_now()];
                    $invoices[$ii]['allocatedVat'] += $take; $receipts[$ri]['allocatedIRR'] += $take; $available -= $take;
                    $timingIsPost = true;
                }
            }
        }
        $receipts[$ri]['creditRemainIRR'] = $available;
        if ($timingIsPost) $receipts[$ri]['timing'] = 'post_invoice';
    }
    foreach ($invoiceIdx as $ii) {
        $caps = sd_invoice_caps($invoices[$ii]);
        $invoices[$ii]['openBaseIRR'] = max(0, $caps['base'] - (int)($invoices[$ii]['allocatedBase'] ?? 0));
        $invoices[$ii]['openVatIRR'] = max(0, $caps['vat'] - (int)($invoices[$ii]['allocatedVat'] ?? 0));
        $invoices[$ii]['openAmountIRR'] = $invoices[$ii]['openBaseIRR'] + $invoices[$ii]['openVatIRR'];
    }
    /* v34.7.18 (فاز ۱ / R9): اتحادهای تسویه پس از هر بازسازی بررسی و در پاسخ فرمان
       برگردانده می‌شوند تا خطای بی‌صدا باقی نماند. این بررسی فقط گزارش می‌دهد و چیزی را تغییر نمی‌دهد. */
    $GLOBALS['sd_last_reconcile'] = sd_reconcile_case($caseId, $receipts, $invoices, $allocations);
}
/* گزارش تسویهٔ یک پرونده: Σدریافت = Σتخصیص + Σبستانکاری و amount = base+vat */
function sd_reconcile_case(string $caseId, array $receipts, array $invoices, array $allocations): array {
    $received = 0; $allocatedFromReceipts = 0; $credit = 0; $allocRows = 0; $violations = [];
    foreach ($receipts as $r) {
        if (!is_array($r) || (string)($r['caseId'] ?? '') !== $caseId || !sd_active($r) || (string)($r['status'] ?? '') !== 'posted') continue;
        $received += (int)round(sd_num($r['amountIRR'] ?? $r['amt'] ?? 0));
        $allocatedFromReceipts += (int)($r['allocatedIRR'] ?? 0);
        $credit += (int)($r['creditRemainIRR'] ?? 0);
    }
    foreach ($allocations as $a) {
        if (!is_array($a) || (string)($a['caseId'] ?? '') !== $caseId || !sd_active($a)) continue;
        $allocRows += (int)round(sd_num($a['amountIRR'] ?? 0));
    }
    if ($received !== $allocatedFromReceipts + $credit) $violations[] = ['rule'=>'receipt_split','received'=>$received,'allocated'=>$allocatedFromReceipts,'credit'=>$credit];
    if ($allocRows !== $allocatedFromReceipts) $violations[] = ['rule'=>'allocation_rows','rows'=>$allocRows,'allocated'=>$allocatedFromReceipts];
    foreach ($invoices as $inv) {
        if (!is_array($inv) || (string)($inv['caseId'] ?? '') !== $caseId || !sd_active($inv)) continue;
        $base = (int)round(sd_num($inv['base'] ?? 0)); $vat = (int)round(sd_num($inv['vat'] ?? 0));
        $amount = (int)round(sd_num($inv['amount'] ?? 0));
        if ($amount > 0 && $base + $vat !== $amount) $violations[] = ['rule'=>'invoice_amount_split','invoiceId'=>(string)($inv['_id'] ?? $inv['cd'] ?? ''),'amount'=>$amount,'base'=>$base,'vat'=>$vat];
    }
    return ['caseId'=>$caseId,'received'=>$received,'allocated'=>$allocatedFromReceipts,'credit'=>$credit,'violations'=>$violations];
}

function sd_snapshot(array $keys = SD_KEYS): array {
    $out = [];
    foreach ($keys as $key) $out[$key] = sd_read($key);
    return $out;
}
function sd_meta_commit(array $changes): int {
    $dir = sd_sync_dir();
    $metaFile = $dir . '/meta.json';
    $meta = is_file($metaFile) ? json_decode((string)@file_get_contents($metaFile), true) : [];
    if (!is_array($meta)) $meta = [];
    $rev = (int)($meta['_global']['rev'] ?? 0) + 1;
    $now = sd_now();
    foreach ($changes as $key => $_) $meta[$key] = ['rev'=>$rev,'t'=>$now,'by'=>'sales-domain-v35'];
    $meta['_global'] = ['rev'=>$rev,'t'=>$now];
    $tmp = $metaFile . '.tmp.' . bin2hex(random_bytes(4));
    file_put_contents($tmp, json_encode($meta, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX);
    rename($tmp, $metaFile);
    return $rev;
}
function sd_projection_value(string $key,array $value) {
    /* supplier_finance is an object envelope; domain collections are lists. */
    return $key==='ptf_crm_supplier_finance'?$value:array_values($value);
}
/* v34.7.43 — durable write-ahead transaction for every sales-domain command.
   A process can die between projection renames. The WAL contains the complete final
   projections (including the committed command receipt) before the first rename, so
   the next command can finish the exact transaction instead of executing it twice. */
function sd_publish_changes(array $changes): int {
    $dir = sd_sync_dir();
    $temps = [];
    foreach ($changes as $key => $value) {
        $json = json_encode(sd_projection_value((string)$key,$value), JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
        if ($json === false) throw new RuntimeException('json_encode_failed:' . $key);
        $tmp = $dir . '/' . $key . '.json.tmp.' . bin2hex(random_bytes(4));
        if (file_put_contents($tmp, $json, LOCK_EX) === false) throw new RuntimeException('write_failed:' . $key);
        $temps[$key] = [$tmp, $json];
    }
    /* Publish every projection while meta still has the old rev; data_pull therefore
       cannot observe a new revision until all files are in place. */
    foreach ($temps as $key => $pair) {
        $dest = $dir . '/' . $key . '.json';
        if (!rename($pair[0], $dest)) throw new RuntimeException('rename_failed:' . $key);
    }
    $rev = sd_meta_commit($changes);
    foreach ($temps as $key => $pair) {
        try { ptf_db_write_rev($key, $pair[1], $rev); } catch (Throwable $e) { /* warm mirror; file remains authoritative fallback */ }
    }
    return $rev;
}
function sd_pending_transaction_files(): array {
    $files = glob(sd_sync_dir() . '/.sales-tx-*.json') ?: [];
    sort($files, SORT_STRING);
    return $files;
}
function sd_recover_pending_transactions(): int {
    $recovered = 0;
    foreach (sd_pending_transaction_files() as $file) {
        $record = json_decode((string)@file_get_contents($file), true);
        if (!is_array($record) || (int)($record['version'] ?? 0) !== 1 || !is_array($record['changes'] ?? null)) {
            throw new RuntimeException('invalid_sales_transaction_wal');
        }
        $changes = $record['changes'];
        $encoded = json_encode($changes, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $expected = (string)($record['changesHash'] ?? '');
        if ($encoded === false || $expected === '' || !hash_equals($expected, hash('sha256', $encoded))) {
            throw new RuntimeException('sales_transaction_wal_hash_mismatch');
        }
        sd_publish_changes($changes);
        if (!@unlink($file)) throw new RuntimeException('sales_transaction_wal_cleanup_failed');
        $recovered++;
    }
    return $recovered;
}
function sd_commit(array $changes, array $context): int {
    $dir = sd_sync_dir();
    $encoded = json_encode($changes, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($encoded === false) throw new RuntimeException('transaction_json_encode_failed');
    $fingerprint = hash('sha256', (string)($context['key'] ?? '') . "\n" . (string)($context['action'] ?? '') . "\n" . (string)($context['requestHash'] ?? ''));
    $wal = $dir . '/.sales-tx-' . substr($fingerprint, 0, 32) . '.json';
    $tmp = $wal . '.tmp.' . bin2hex(random_bytes(4));
    $record = [
        'version'=>1,'operationId'=>(string)($context['key'] ?? ''),'action'=>(string)($context['action'] ?? ''),
        'requestHash'=>(string)($context['requestHash'] ?? ''),'owner'=>(string)($context['owner'] ?? ''),
        'createdAt'=>sd_now(),'changesHash'=>hash('sha256', $encoded),'changes'=>$changes
    ];
    $walJson = json_encode($record, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($walJson === false || file_put_contents($tmp, $walJson, LOCK_EX) === false) throw new RuntimeException('transaction_wal_write_failed');
    if (!rename($tmp, $wal)) throw new RuntimeException('transaction_wal_publish_failed');
    $rev = sd_publish_changes($changes);
    if (!@unlink($wal)) throw new RuntimeException('transaction_wal_cleanup_failed');
    return $rev;
}
function sd_result_data(array $changes): array {
    $out = [];
    /* Journal برای اثبات/بازیابی سرور است و هرگز surface ویرایش مرورگر نیست.
       فرستادن تا ۱۰۰۰ receipt کامل در پاسخ هر mutation، پاسخ رویژن را بی‌دلیل
       بزرگ و مستعد قطع transport می‌کرد؛ command_status رسید لازم را فشرده می‌دهد. */
    foreach ($changes as $key => $value) {
        if ((string)$key === 'ptf_crm_sales_commands') continue;
        $out[$key] = sd_projection_value((string)$key,$value);
    }
    return $out;
}
/* v34.8.5 — OPEX command projections are identity-scoped deltas, never replace-all
   snapshots. A terminal row is still returned as a durable tombstone; absence from a
   delta has no deletion meaning. The journal stores only identities and replay rebuilds
   this envelope from current authoritative rows, so a stale response cannot resurrect
   an old salary/template value. */
function sd_opex_projection_identity(array $row): array {
    return [
        '_opexRowId'=>sd_text($row['_opexRowId']??'',160),
        'recurringKey'=>sd_text($row['recurringKey']??'',220),
        'cd'=>sd_text($row['cd']??'',160)
    ];
}
function sd_opex_identity_present(array $identity): bool {
    return trim((string)($identity['_opexRowId']??''))!=='' || trim((string)($identity['recurringKey']??''))!=='' || trim((string)($identity['cd']??''))!=='';
}
function sd_opex_identity_key(array $identity): string {
    foreach (['_opexRowId','recurringKey','cd'] as $field) {
        $value=trim((string)($identity[$field]??''));
        if($value!=='')return $field.':'.$value;
    }
    return '';
}
function sd_opex_identity_matches(array $row,array $identity): bool {
    $wantedRowId=trim((string)($identity['_opexRowId']??''));$rowId=trim((string)($row['_opexRowId']??''));
    /* recurringKey names a domain occurrence and is intentionally shared by legacy
       duplicates. Once both sides have physical row IDs, never let that broad alias
       collapse a canonical active row and its durable duplicate tombstone. */
    if($wantedRowId!==''&&$rowId!=='')return hash_equals($wantedRowId,$rowId);
    foreach (['cd','recurringKey'] as $field) {
        $wanted=trim((string)($identity[$field]??''));
        if($wanted!==''&&trim((string)($row[$field]??''))===$wanted)return true;
    }
    return false;
}
function sd_ensure_recurring_opex_row_identities(array &$rows): void {
    $used=[];
    foreach($rows as $row)if(is_array($row)){ $id=trim((string)($row['_opexRowId']??''));if($id!=='')$used[$id]=true; }
    foreach($rows as $index=>&$row){
        if(!is_array($row))continue;
        $owned=trim((string)($row['recurringKey']??''))!==''||!empty($row['serverMaterialized'])||!empty($row['shareholderSalary'])||!empty($row['autoApplied'])||trim((string)($row['tplId']??''))!=='';
        if(!$owned)continue;
        $row['serverOwnedIdentity']=true;
        if(trim((string)($row['_opexRowId']??''))!=='')continue;
        $seed=trim((string)($row['recurringKey']??'')).'|'.trim((string)($row['cd']??'')).'|'.(int)$index;
        $id='OPXR-SRV-'.strtoupper(substr(hash('sha256',$seed),0,24));
        $salt=0;while(isset($used[$id])){$salt++;$id='OPXR-SRV-'.strtoupper(substr(hash('sha256',$seed.'|'.$salt),0,24));}
        $row['_opexRowId']=$id;$used[$id]=true;
    }unset($row);
}
function sd_opex_projection_identities(array $rows): array {
    $out=[];$seen=[];
    foreach($rows as $row){
        if(!is_array($row))continue;$identity=sd_opex_projection_identity($row);
        if(!sd_opex_identity_present($identity))continue;$key=sd_opex_identity_key($identity);
        if($key===''||isset($seen[$key]))continue;$seen[$key]=true;$out[]=$identity;
    }
    return $out;
}
function sd_opex_projection_envelope(array $rows,array $identities,int $revision): array {
    $upserts=[];$tombstones=[];$emitted=[];
    foreach($identities as $identity){
        if(!is_array($identity)||!sd_opex_identity_present($identity))continue;
        foreach($rows as $index=>$row){
            if(!is_array($row)||!sd_opex_identity_matches($row,$identity)||isset($emitted[$index]))continue;
            $emitted[$index]=true;
            if(sd_active($row))$upserts[]=$row;
            else $tombstones[]=$row;
        }
    }
    return [
        'mode'=>'merge-v1','collection'=>'ptf_crm_opex','identityVersion'=>'opex-v1',
        'revision'=>$revision,'upserts'=>$upserts,'tombstones'=>$tombstones
    ];
}
function sd_is_recurring_projection_action(string $action): bool {
    return in_array($action,['reconcile_shareholder_salaries','reconcile_recurring_opex','schedule_recurring_opex_cheque','void_recurring_opex','register_shareholder_salary'],true);
}
function sd_recurring_sharetx_projection_allowed(string $action): bool {
    global $role;
    /* schedule فقط لینک چک را عوض می‌کند. reconcile/void ممکن است در همان commit
       salary claim را بسازد، repair کند یا void کند و باید برای مدیر ارشد بی‌درنگ
       همان projection اتمیک را برگرداند؛ نه این‌که به pull دوم وابسته بماند. */
    return in_array($role,SD_SHAREHOLDER_VIEW_ROLES,true)
        && in_array($action,['reconcile_shareholder_salaries','reconcile_recurring_opex','void_recurring_opex','register_shareholder_salary'],true);
}
function sd_recurring_projection_data(string $action,array $opex,array $identities,int $rev): array {
    $data=['ptf_crm_opex'=>sd_opex_projection_envelope($opex,$identities,$rev)];
    if(sd_recurring_sharetx_projection_allowed($action)){
        /* sharetx یک projection کاملِ role-safe است. این کار شکاف نمایش بین OPEX و
           طلب حقوق را می‌بندد، در حالی که accountant همچنان آن را دریافت نمی‌کند. */
        $data['ptf_crm_sharetx']=sd_read('ptf_crm_sharetx');
    }
    return $data;
}
function sd_recurring_explicit_tombstone(array $row): bool {
    return !empty($row['explicitDeletion']) || !empty($row['manualVoid']) || (string)($row['voidIntent']??'')==='explicit';
}
function sd_recurring_restore_requested(string $key,array $restoreKeys): bool { return $key!=='' && in_array($key,$restoreKeys,true); }
function sd_recurring_activate(array &$row): void {
    /* `st=settled` is a payment state, not a recurring tombstone. Reconcile clears
       lifecycle terminal values only; otherwise a daily run would make paid OPEX look
       unpaid again. */
    $wasTerminal=!sd_active($row);
    foreach(['status','st']as $field){$state=strtolower(trim((string)($row[$field]??'')));if(in_array($state,['void','voided','cancelled','deleted','replaced','superseded'],true))unset($row[$field]);}
    foreach(['voided','voidAt','voidedAt','voidBy','voidedBy','voidReason','deleted','deletedAt','deletedBy','deleteReason','explicitDeletion','manualVoid','voidIntent','eligibilityVoid']as $field)unset($row[$field]);
    if($wasTerminal||trim((string)($row['status']??''))==='')$row['status']='active';
}
function sd_recurring_void(array &$row,string $reason,string $by,string $kind='explicit'): void {
    $now=sd_now();unset($row['restoreIntent'],$row['restoredAt'],$row['restoredBy']);$row['status']='void';$row['st']='void';$row['voided']=true;$row['voidAt']=$now;$row['voidedAt']=$now;$row['voidBy']=$by;$row['voidedBy']=$by;$row['voidReason']=$reason;$row['serverReconciled']=true;$row['updatedT']=$now;$row['updatedBy']=$by;
    if($kind==='explicit'){$row['explicitDeletion']=true;$row['manualVoid']=true;$row['voidIntent']='explicit';unset($row['eligibilityVoid']);}elseif($kind==='eligibility'){$row['eligibilityVoid']=true;$row['voidIntent']='eligibility';unset($row['explicitDeletion'],$row['manualVoid']);}
}
function sd_recurring_find_indexes(array $rows,string $key,array $extraFields=[]): array {
    $hits=[];
    foreach($rows as $index=>$row){
        if(!is_array($row))continue;
        if($key!==''&&(string)($row['recurringKey']??'')===$key){$hits[]=(int)$index;continue;}
        $allExtra=(bool)$extraFields;
        foreach($extraFields as $field=>$value)if($value===''||(string)($row[$field]??'')!==$value){$allExtra=false;break;}
        if($allExtra)$hits[]=(int)$index;
    }
    return array_values(array_unique($hits));
}
function sd_recurring_pick_index(array $rows,array $hits,bool $restore=false): int {
    if($restore)foreach($hits as $index)if(isset($rows[$index])&&is_array($rows[$index])&&sd_recurring_explicit_tombstone($rows[$index]))return (int)$index;
    foreach($hits as $index)if(isset($rows[$index])&&is_array($rows[$index])&&sd_active($rows[$index]))return (int)$index;
    return $hits?(int)$hits[0]:-1;
}
/* Salary matching is type-safe. draw/salary_payment rows may share shCd/month but
   are different business events and must never become salary candidates. */
function sd_salary_find_indexes(array $rows,string $key,string $shCd,string $month): array {
    $hits=[];
    foreach($rows as $index=>$row){
        if(!is_array($row)||strtolower(trim((string)($row['type']??'')))!=='salary')continue;
        if($key!==''&&(string)($row['recurringKey']??'')===$key){$hits[]=(int)$index;continue;}
        if((string)($row['shCd']??'')===$shCd&&(string)($row['month']??'')===$month)$hits[]=(int)$index;
    }
    return array_values(array_unique($hits));
}
function sd_sharetx_files($files): array {
    if($files===null||$files===[])return[];
    if(!is_array($files)||count($files)>20)sd_out(['ok'=>false,'error'=>'invalid_sharetx_files'],422);
    $out=[];
    foreach($files as $file){
        if(!is_array($file)||!sd_file_ok($file))sd_out(['ok'=>false,'error'=>'invalid_sharetx_file'],422);
        $out[]=['key'=>sd_text($file['key']??'',500),'name'=>sd_text($file['name']??'',200),'contentType'=>sd_text($file['contentType']??$file['mimeType']??'',100),'size'=>max(0,(int)($file['size']??0)),'uploadedAt'=>sd_text($file['uploadedAt']??sd_now(),60)];
    }
    return $out;
}
function sd_chair_claim(array $sharetx,string $shCd): int {
    $credit=0;$debit=0;
    foreach($sharetx as $row){
        if(!is_array($row)||!sd_active($row)||(string)($row['shCd']??'')!==$shCd)continue;
        $type=strtolower(trim((string)($row['type']??'')));$amount=(int)round(sd_num($row['amt']??0));
        if(in_array($type,['call_over','chair_in'],true))$credit+=$amount;
        elseif(in_array($type,['call_credit_use','chair_out'],true))$debit+=$amount;
    }
    return max(0,$credit-$debit);
}
function sd_command_request_hash(string $action, array $body): string {
    unset($body['idempotencyKey'], $body['action']);
    return hash('sha256', $action . "\n" . json_encode(sd_norm_for_hash($body), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
}
function sd_idempotency(array $commands, string $key, string $action, string $requestHash): ?array {
    global $user;
    if ($key === '') return null;
    foreach ($commands as $cmd) {
        if (!is_array($cmd) || (string)($cmd['key'] ?? '') !== $key || (string)($cmd['status'] ?? '') !== 'committed') continue;
        if ((string)($cmd['action'] ?? '') !== '' && (string)$cmd['action'] !== $action) sd_out(['ok'=>false,'error'=>'idempotency_key_action_mismatch'],409);
        if ((string)($cmd['requestHash'] ?? '') !== '' && !hash_equals((string)$cmd['requestHash'], $requestHash)) sd_out(['ok'=>false,'error'=>'idempotency_key_payload_mismatch'],409);
        if ((string)($cmd['by'] ?? '') !== '' && !hash_equals((string)$cmd['by'], (string)$user)) sd_out(['ok'=>false,'error'=>'idempotency_key_owner_mismatch'],403);
        return $cmd;
    }
    return null;
}
function sd_append_command(array &$commands, string $key, string $action, string $requestHash, array $result): void {
    global $user;
    $commands[] = ['_id'=>sd_uuid('CMD'),'key'=>$key,'action'=>$action,'requestHash'=>$requestHash,'status'=>'committed','at'=>sd_now(),'by'=>$user,'result'=>$result];
    if (count($commands) > 1000) $commands = array_slice($commands, -1000);
}

/* Guided duplicate-case repair. The plan is intentionally descriptive and the commit
   merges evidence into a user-selected canonical case; no record is guessed or silently
   discarded. All related financial projections are re-pointed in the same transaction. */
function sd_case_offer_linked(array $case, array $offer): bool {
    $no=(string)($offer['no']??'');$oid=(string)($offer['_id']??'');$root=(string)($case['rootOfferId']??'');
    if($oid!==''&&$root!==''){
        if(hash_equals($oid,$root))return true;
        /* v34.7.15: rootOfferId کهنه/بازتولیدشده (با _id فعلی پیشنهاد نمی‌خواند) نباید
           پرونده را بی‌صدا از کاندیدهای ادغام حذف کند؛ به شناسهٔ متنی wonOffer/offerNo
           fallback می‌کنیم. ایمنی همچنان با گارد هویت commit (case_identity_conflict) و
           بررسی case_offer_link_changed حفظ می‌شود. */
    }
    $caseNo=(string)($case['wonOffer']??$case['offerNo']??'');if($no===''||$caseNo===''||$caseNo!==$no)return false;
    foreach(['inqNo','buyerCd','currency']as $field){$a=sd_identity($case[$field]??'');$b=sd_identity($offer[$field]??'');if($a!==''&&$b!==''&&$a!==$b)return false;}
    if(sd_identity($case['buyerCd']??'')===''&&sd_identity($offer['buyerCd']??'')===''){$a=sd_identity($case['buyerCo']??'');$b=sd_identity($offer['buyerCo']??'');if($a!==''&&$b!==''&&$a!==$b)return false;}
    return true;
}
function sd_case_aliases(array $case): array {
    return array_values(array_unique(array_filter([(string)($case['_id'] ?? ''), (string)($case['cd'] ?? '')])));
}
function sd_case_array_evidence(array $case): array {
    $out = [];
    foreach ($case as $key => $value) {
        if (!is_array($value) || $key === 'linkedOffers' || count($value) === 0) continue;
        $out[(string)$key] = count($value);
    }
    ksort($out);
    return $out;
}
function sd_case_related_summary(array $case, array $invoices, array $receipts, array $allocations, array $attachments, array $linkedCollections=[]): array {
    $aliases = sd_case_aliases($case); $out = ['invoices'=>0,'receipts'=>0,'allocations'=>0,'attachments'=>0];
    foreach ($invoices as $row) if (is_array($row) && sd_active($row) && in_array((string)($row['caseId'] ?? ''), $aliases, true)) $out['invoices']++;
    foreach ($receipts as $row) if (is_array($row) && sd_active($row) && in_array((string)($row['caseId'] ?? ''), $aliases, true)) $out['receipts']++;
    foreach ($allocations as $row) if (is_array($row) && sd_active($row) && in_array((string)($row['caseId'] ?? ''), $aliases, true)) $out['allocations']++;
    foreach ($attachments as $row) if (is_array($row) && sd_active($row) && in_array((string)($row['ownerId'] ?? ''), $aliases, true)) $out['attachments']++;
    foreach($linkedCollections as $name=>$spec){$out[(string)$name]=0;$field=(string)($spec['field']??'');foreach(($spec['rows']??[])as $row)if(is_array($row)&&$field!==''&&in_array((string)($row[$field]??''),$aliases,true))$out[(string)$name]++;}
    return $out;
}
/* v34.7.15: نرمال‌سازی قطعی برای هش — ترتیب کلیدهای associative نباید هش plan را عوض کند.
   بازسریالیز JSON (push دستگاه دیگر، مهاجرت/repair) می‌تواند کلیدها را با ترتیب متفاوت بنویسد
   بدون آنکه دادهٔ تجاری تغییر کند؛ این نرمال‌سازی آن «تغییر کاذب» را از planHash حذف می‌کند. */
function sd_norm_for_hash($v) {
    if (!is_array($v)) return $v;
    $isList = true; $i = 0;
    foreach ($v as $k => $_) { if ($k !== $i++) { $isList = false; break; } }
    if ($isList) {
        $out = [];
        foreach ($v as $x) $out[] = sd_norm_for_hash($x);
        return $out;
    }
    ksort($v);
    $out = [];
    foreach ($v as $k => $x) $out[$k] = sd_norm_for_hash($x);
    return $out;
}

function sd_duplicate_case_plan_data(array $offers, array $cases, array $invoices, array $receipts, array $allocations, array $attachments, string $no, array $linkedCollections=[]): array {
    $hits = [];
    foreach ($offers as $offer) if (is_array($offer) && (string)($offer['no'] ?? '') === $no) $hits[] = $offer;
    if (count($hits) !== 1) return ['offerNo'=>$no,'offerCount'=>count($hits),'candidates'=>[],'planHash'=>'','error'=>count($hits) ? 'duplicate_offer_no' : 'offer_not_found'];
    $offer = $hits[0]; $candidates = []; $signature = ['offer'=>[$offer['_id']??'', $offer['no']??'', $offer['st']??''], 'cases'=>[]];
    foreach ($cases as $case) {
        if (!is_array($case) || !sd_active($case) || !sd_case_offer_linked($case, $offer)) continue;
        $id = (string)($case['_id'] ?? $case['cd'] ?? '');
        $evidence = sd_case_array_evidence($case);
        $related = sd_case_related_summary($case, $invoices, $receipts, $allocations, $attachments, $linkedCollections);
        $evidenceTotal = array_sum($evidence); $relatedTotal = array_sum($related);
        $candidates[] = [
            'id'=>$id, 'cd'=>(string)($case['cd']??''), 'inqNo'=>(string)($case['inqNo']??''),
            'buyerCo'=>(string)($case['buyerCo']??''), 'buyerCd'=>(string)($case['buyerCd']??''),
            'currency'=>(string)($case['currency']??''), 'status'=>(string)($case['status']??$case['st']??''),
            'createdAt'=>(string)($case['wonAtISO']??$case['createdAtISO']??$case['t']??''),
            'evidence'=>$evidence, 'related'=>$related, 'evidenceTotal'=>$evidenceTotal,
            'relatedTotal'=>$relatedTotal, 'safeEmpty'=>($evidenceTotal===0 && $relatedTotal===0),
            'recordHash'=>hash('sha256', json_encode(sd_norm_for_hash($case), JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES))
        ];
        $signature['cases'][] = [$id, $candidates[count($candidates)-1]['recordHash'], $related];
    }
    usort($candidates, function($a,$b){ return strcmp((string)$a['id'], (string)$b['id']); });
    sort($signature['cases']);
    $recommended = '';
    if (count($candidates) === 2 && $candidates[0]['safeEmpty'] !== $candidates[1]['safeEmpty']) $recommended = $candidates[0]['safeEmpty'] ? $candidates[1]['id'] : $candidates[0]['id'];
    /* v34.7.16: mergeability هویتی را از پیش محاسبه می‌کنیم تا UI پیش از commit آگاه شود،
       نه اینکه کاربر فقط هنگام commit با case_identity_conflict روبرو شود. */
    $mergeable = true; $conflictField = '';
    $cn = count($candidates);
    for ($i = 0; $i < $cn; $i++) {
        for ($j = $i + 1; $j < $cn; $j++) {
            $cf = sd_case_identity_conflict($candidates[$i], $candidates[$j]);
            if ($cf !== '') { $mergeable = false; $conflictField = $cf; break 2; }
        }
    }
    return ['offerNo'=>$no,'offerCount'=>1,'offerId'=>$offer['_id']??'','candidateCount'=>count($candidates),'candidates'=>$candidates,
        'recommendedKeepId'=>$recommended,'mergeable'=>$mergeable,'conflictField'=>$conflictField,
        'planHash'=>hash('sha256', json_encode($signature, JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES))];
}
function sd_array_is_list_compat(array $value): bool {
    $i = 0; foreach ($value as $key => $_) { if ($key !== $i++) return false; } return true;
}
function sd_merge_row_fingerprint($row): string {
    if(is_array($row)){foreach(['_id','id','cd','eventCd','opexRowId','pettyCd','key','objectKey']as $key)if(isset($row[$key])&&trim((string)$row[$key])!=='')return $key.':'.trim((string)$row[$key]);}
    return 'json:'.hash('sha256',json_encode($row,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES));
}
function sd_merge_case_value($keep, $source, string $path, array &$conflicts) {
    if (is_array($keep) && is_array($source)) {
        if (sd_array_is_list_compat($keep) && sd_array_is_list_compat($source)) {
            $positions=[];foreach($keep as $idx=>$row)$positions[sd_merge_row_fingerprint($row)]=$idx;
            foreach($source as $row){$fp=sd_merge_row_fingerprint($row);if(!array_key_exists($fp,$positions)){$positions[$fp]=count($keep);$keep[]=$row;}else{$idx=$positions[$fp];$keep[$idx]=sd_merge_case_value($keep[$idx],$row,$path.'['.$fp.']',$conflicts);}}
            return $keep;
        }
        foreach ($source as $key => $value) {
            $next = $path === '' ? (string)$key : $path . '.' . $key;
            if (!array_key_exists($key, $keep)) $keep[$key] = $value;
            else $keep[$key] = sd_merge_case_value($keep[$key], $value, $next, $conflicts);
        }
        return $keep;
    }
    $missing = $keep === null || $keep === '';
    if ($missing) return $source;
    if ($source !== null && $source !== '' && $keep !== $source && count($conflicts) < 100) $conflicts[] = $path;
    return $keep;
}
function sd_merge_case_records(array $keep, array $source, array &$conflicts): array {
    $protected = ['_id','cd','rootOfferId','wonOffer','offerNo','inqNo','buyerCd','buyerCo','currency','contractAmount','status','st'];
    foreach ($source as $key => $value) {
        if (in_array((string)$key, $protected, true)) continue;
        if (!array_key_exists($key, $keep)) $keep[$key] = $value;
        else $keep[$key] = sd_merge_case_value($keep[$key], $value, (string)$key, $conflicts);
    }
    return $keep;
}

/* Permanent purge of an explicitly selected archived test case. Shared master data
   (customers/products/suppliers) is never part of this graph. The only retained data is
   a minimal identity tombstone so stale clients cannot resurrect retired business codes. */
function sd_purge_collection_keys(): array {
    return ['ptf_crm_projects','ptf_crm_deals','ptf_crm_offers','ptf_crm_rfqs','ptf_crm_surplus','ptf_crm_invoices','ptf_crm_case_receipts','ptf_crm_receipt_allocations','ptf_crm_fin_attachments','ptf_crm_petty','ptf_crm_opex','ptf_crm_cheques_issued','ptf_crm_cheques_received','ptf_crm_sales_returns','ptf_crm_packinglists','ptf_crm_letters','ptf_crm_contracts','ptf_crm_rfqsmart','ptf_crm_buycmp','ptf_crm_inqreads','ptf_crm_inqitems','ptf_crm_payables','ptf_crm_buyquotes','ptf_crm_reminders','ptf_crm_notifs','ptf_crm_sendqueue','ptf_crm_audit','ptf_crm_corrections','ptf_crm_fin_findings','ptf_crm_deleted_archive'];
}
function sd_purge_load_collections(): array { $out=[]; foreach(sd_purge_collection_keys() as $key)$out[$key]=sd_read($key); $out['ptf_crm_supplier_finance']=sd_read('ptf_crm_supplier_finance'); return $out; }
function sd_purge_record_id(string $key, array $row): string {
    if($key==='ptf_crm_offers')return trim((string)($row['no']??$row['cd']??$row['id']??''));
    return trim((string)($row['_id']??$row['cd']??$row['no']??$row['id']??$row['code']??$row['invoiceCd']??''));
}
function sd_purge_fingerprint(string $key, array $row): string {
    $id=sd_purge_record_id($key,$row);if($id!=='')return'id:'.$id;
    return'hash:'.hash('sha256',json_encode($row,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES));
}
function sd_purge_add(array &$set,$value): void { $v=trim((string)$value);if($v!=='')$set[$v]=true; }
function sd_purge_field_match(array $row,array $fields,array $set): bool { foreach($fields as $field){$v=trim((string)($row[$field]??''));if($v!==''&&isset($set[$v]))return true;}return false; }
function sd_purge_recursive_exact($value,array $set): bool {
    if(is_array($value)){foreach($value as $v)if(sd_purge_recursive_exact($v,$set))return true;return false;}
    if(!is_scalar($value))return false;$text=trim((string)$value);if(isset($set[$text]))return true;
    foreach($set as $alias=>$_)if(strlen((string)$alias)>=6&&strpos($text,(string)$alias)!==false)return true;
    return false;
}
function sd_collect_cloud_keys($value,array &$out,string $field=''): void {
    if(!is_array($value))return;
    foreach($value as $key=>$next){$name=is_string($key)?$key:$field;if(is_array($next)){sd_collect_cloud_keys($next,$out,$name);continue;}if(!is_string($next)||trim($next)===''||strpos($next,'data:')===0)continue;if(in_array($name,['key','objectKey','storageKey','fileKey','archiveKey'],true)){ $candidate=ltrim(trim($next),'/'); if(strpos($candidate,'/')!==false&&strpos($candidate,'..')===false&&strlen($candidate)<=500)$out[$candidate]=true; }}
}
function sd_archive_purge_plan_data(string $projectNo,array $collections): array {
    $projects=$collections['ptf_crm_projects']??[];$targets=[];foreach($projects as $row)if(is_array($row)&&((string)($row['no']??'')===$projectNo||(string)($row['cd']??'')===$projectNo))$targets[]=$row;
    if(count($targets)!==1)return['projectNo'=>$projectNo,'error'=>count($targets)?'duplicate_archived_project':'archived_project_not_found','projectCount'=>count($targets),'counts'=>[],'cloudKeys'=>[],'planHash'=>''];
    $project=$targets[0];if((string)($project['state']??'')!=='archived')return['projectNo'=>$projectNo,'error'=>'project_not_archived','counts'=>[],'cloudKeys'=>[],'planHash'=>''];
    $offerNos=[];$offerIds=[];$inqNos=[];$caseIds=[];$projectIds=[];
    foreach([$project['no']??'',$project['cd']??'',$project['dealCd']??'']as $v)sd_purge_add($projectIds,$v);
    foreach(array_merge([$project['offerNo']??'',$project['wonOffer']??''],is_array($project['offerNos']??null)?$project['offerNos']:[])as $v)sd_purge_add($offerNos,$v);
    sd_purge_add($inqNos,$project['inqNo']??'');
    for($round=0;$round<3;$round++){
        foreach(($collections['ptf_crm_offers']??[])as $row)if(is_array($row)&&(isset($offerNos[(string)($row['no']??'')])||isset($inqNos[(string)($row['inqNo']??'')])||isset($inqNos[(string)($row['srcRfq']??'')]))){sd_purge_add($offerNos,$row['no']??'');sd_purge_add($offerIds,$row['_id']??'');sd_purge_add($inqNos,$row['inqNo']??'');sd_purge_add($inqNos,$row['srcRfq']??'');}
        foreach(($collections['ptf_crm_deals']??[])as $row)if(is_array($row)&&(sd_purge_field_match($row,['_id','cd'],$projectIds)||sd_purge_field_match($row,['wonOffer','offerNo'],$offerNos)||sd_purge_field_match($row,['rootOfferId'],$offerIds)||sd_purge_field_match($row,['inqNo'],$inqNos))){sd_purge_add($caseIds,$row['_id']??'');sd_purge_add($caseIds,$row['cd']??'');sd_purge_add($projectIds,$row['cd']??'');sd_purge_add($offerNos,$row['wonOffer']??'');sd_purge_add($offerNos,$row['offerNo']??'');sd_purge_add($offerIds,$row['rootOfferId']??'');sd_purge_add($inqNos,$row['inqNo']??'');}
    }
    /* اگر همین پیشنهاد/درخواست هنوز پرونده فعال دارد، رکورد بایگانی فقط یک snapshot
       تکراری است. در این حالت purge باید فقط پوسته بایگانی و فایل‌های منحصربه‌فرد آن
       را حذف کند؛ پیشنهاد، RFQ، پرونده فعال و همه وابستگی‌های مشترک دست‌نخورده‌اند. */
    $sharedActiveCases=[];
    foreach(($collections['ptf_crm_deals']??[])as $row)if(is_array($row)&&sd_active($row)&&(string)($row['st']??'')!=='archived'&&(string)($row['status']??'')!=='archived'&&(sd_purge_field_match($row,['_id','cd'],$caseIds+$projectIds)||sd_purge_field_match($row,['wonOffer','offerNo'],$offerNos)||sd_purge_field_match($row,['rootOfferId'],$offerIds)||sd_purge_field_match($row,['inqNo'],$inqNos)))$sharedActiveCases[]=['id'=>$row['_id']??$row['cd']??'','cd'=>$row['cd']??'','inqNo'=>$row['inqNo']??'','wonOffer'=>$row['wonOffer']??$row['offerNo']??'','status'=>$row['status']??$row['st']??''];
    if($sharedActiveCases){
        $targetFp=sd_purge_fingerprint('ptf_crm_projects',$project);$targetHash=hash('sha256',json_encode($project,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES));
        $targetCloud=[];sd_collect_cloud_keys($project,$targetCloud);$otherCloud=[];
        foreach($collections as $key=>$rows){if($key==='ptf_crm_projects'){foreach($rows as $row)if(is_array($row)&&sd_purge_fingerprint($key,$row)!==$targetFp)sd_collect_cloud_keys($row,$otherCloud);}elseif($key==='ptf_crm_supplier_finance')sd_collect_cloud_keys($rows,$otherCloud);else foreach($rows as $row)if(is_array($row))sd_collect_cloud_keys($row,$otherCloud);}
        $cloudKeys=array_values(array_diff(array_keys($targetCloud),array_keys($otherCloud)));sort($cloudKeys);$keysDigest=hash('sha256',json_encode($cloudKeys,JSON_UNESCAPED_SLASHES));
        $projectId=sd_purge_record_id('ptf_crm_projects',$project);$identity=['ptf_crm_projects'=>array_values(array_unique(array_filter([$projectId,(string)($project['no']??''),(string)($project['cd']??'')])) )];
        $year=sd_year($project['closedAt']??$project['t']??$project['date']??'');$years=$year!==''?[$year]:[];
        $planHash=hash('sha256',json_encode(['mode'=>'archive_shell_only','project'=>$projectNo,'record'=>$targetFp.':'.$targetHash,'cloud'=>$keysDigest],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES));
        return['projectNo'=>$projectNo,'mode'=>'archive_shell_only','error'=>'','blockers'=>[],'sharedActiveCases'=>$sharedActiveCases,'counts'=>['ptf_crm_projects'=>1],'samples'=>['ptf_crm_projects'=>[$projectId]],'recordCount'=>1,'cloudKeys'=>$cloudKeys,'cloudCount'=>count($cloudKeys),'keysDigest'=>$keysDigest,'years'=>$years,'planHash'=>$planHash,'_matches'=>['ptf_crm_projects'=>[$targetFp=>$targetHash]],'_identities'=>$identity,'_supplierFinance'=>['invoiceIds'=>[],'deletePaymentIds'=>[],'trimPaymentIds'=>[]]];
    }
    $matches=[];$matchedRows=[];$idsForTombstone=[];
    $addMatch=function(string $key,array $row)use(&$matches,&$matchedRows,&$idsForTombstone){$fp=sd_purge_fingerprint($key,$row);$matches[$key][$fp]=hash('sha256',json_encode($row,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES));$matchedRows[]=$row;$id=sd_purge_record_id($key,$row);if($id!=='')$idsForTombstone[$key][$id]=true;};
    foreach($projects as $row)if(is_array($row)&&(((string)($row['no']??'')===$projectNo||(string)($row['cd']??'')===$projectNo)||sd_purge_field_match($row,['dealCd'],$projectIds+$caseIds)||sd_purge_field_match($row,['offerNo','wonOffer'],$offerNos)||sd_purge_field_match($row,['inqNo'],$inqNos)))$addMatch('ptf_crm_projects',$row);
    foreach(($collections['ptf_crm_deals']??[])as $row)if(is_array($row)&&(sd_purge_field_match($row,['_id','cd'],$caseIds)||sd_purge_field_match($row,['wonOffer','offerNo'],$offerNos)||sd_purge_field_match($row,['rootOfferId'],$offerIds)||sd_purge_field_match($row,['inqNo'],$inqNos)))$addMatch('ptf_crm_deals',$row);
    foreach(($collections['ptf_crm_offers']??[])as $row)if(is_array($row)&&(sd_purge_field_match($row,['no'],$offerNos)||sd_purge_field_match($row,['_id'],$offerIds)||sd_purge_field_match($row,['inqNo','srcRfq'],$inqNos)))$addMatch('ptf_crm_offers',$row);
    foreach(($collections['ptf_crm_rfqs']??[])as $row)if(is_array($row)&&sd_purge_field_match($row,['_id','cd','inqNo'],$inqNos))$addMatch('ptf_crm_rfqs',$row);
    $blockers=[];foreach(($collections['ptf_crm_surplus']??[])as $row)if(is_array($row)){$linked=sd_purge_field_match($row,['sourceDealCd'],$projectIds+$caseIds+$offerNos+$inqNos);foreach(array_merge($row['reservations']??[],$row['saleRefs']??[])as $ref)if(is_array($ref)&&isset($offerNos[(string)($ref['offerNo']??'')]))$linked=true;if(!$linked)continue;$foreign=[];foreach(array_merge($row['reservations']??[],$row['saleRefs']??[])as $ref)if(is_array($ref)){$_no=trim((string)($ref['offerNo']??''));if($_no!==''&&!isset($offerNos[$_no]))$foreign[$_no]=true;}if($foreign){$blockers[]=['type'=>'shared_inventory','id'=>$row['cd']??'','otherOffers'=>array_keys($foreign)];continue;}$addMatch('ptf_crm_surplus',$row);}
    $invoiceIds=[];foreach(($collections['ptf_crm_invoices']??[])as $row)if(is_array($row)&&(sd_purge_field_match($row,['offerNo'],$offerNos)||sd_purge_field_match($row,['caseId'],$caseIds))){$addMatch('ptf_crm_invoices',$row);sd_purge_add($invoiceIds,$row['_id']??$row['cd']??'');}
    $receiptIds=[];foreach(($collections['ptf_crm_case_receipts']??[])as $row)if(is_array($row)&&sd_purge_field_match($row,['caseId'],$caseIds)){$addMatch('ptf_crm_case_receipts',$row);sd_purge_add($receiptIds,$row['_id']??$row['cd']??'');}
    $ownerIds=$caseIds+$invoiceIds+$receiptIds;
    foreach(($collections['ptf_crm_receipt_allocations']??[])as $row)if(is_array($row)&&(sd_purge_field_match($row,['caseId'],$caseIds)||sd_purge_field_match($row,['invoiceId'],$invoiceIds)||sd_purge_field_match($row,['receiptId'],$receiptIds)))$addMatch('ptf_crm_receipt_allocations',$row);
    foreach(($collections['ptf_crm_fin_attachments']??[])as $row)if(is_array($row)&&sd_purge_field_match($row,['ownerId'],$ownerIds))$addMatch('ptf_crm_fin_attachments',$row);
    $rules=[
      'ptf_crm_petty'=>[['dealRef'],$projectIds+$caseIds], 'ptf_crm_opex'=>[['dealRef'],$projectIds+$caseIds],
      'ptf_crm_cheques_issued'=>[['dealCd'],$projectIds+$caseIds+$offerNos+$inqNos], 'ptf_crm_cheques_received'=>[['dealCd'],$projectIds+$caseIds+$offerNos+$inqNos],
      'ptf_crm_sales_returns'=>[['dealCd','offerNo'],$projectIds+$caseIds+$offerNos], 'ptf_crm_packinglists'=>[['offerNo'],$offerNos],
      'ptf_crm_letters'=>[['prjNo','projectNo','dealCd','offerNo','inqNo','ref'],$projectIds+$caseIds+$offerNos+$inqNos],
      'ptf_crm_contracts'=>[['prjNo','projectNo','dealCd','offerNo','inqNo','ref'],$projectIds+$caseIds+$offerNos+$inqNos],
      'ptf_crm_rfqsmart'=>[['srcRfq','inqNo','offerNo'],$inqNos+$offerNos], 'ptf_crm_buycmp'=>[['inqNo','sourceOfferNo'],$inqNos+$offerNos],
      'ptf_crm_inqreads'=>[['inqNo','cd'],$inqNos], 'ptf_crm_inqitems'=>[['inqNo'],$inqNos], 'ptf_crm_payables'=>[['inqNo','offerNo'],$inqNos+$offerNos],
      'ptf_crm_buyquotes'=>[['ref','inqNo','offerNo'],$inqNos+$offerNos]
    ];
    foreach($rules as $key=>$spec)foreach(($collections[$key]??[])as $row)if(is_array($row)&&sd_purge_field_match($row,$spec[0],$spec[1]))$addMatch($key,$row);
    /* Supplier ledger is an object envelope. Delete only invoices/payments exclusively
       tied to this test case; a shared payment keeps its real allocations. */
    $purchaseIds=[];foreach(($collections['ptf_crm_buycmp']??[])as $cmp)if(is_array($cmp)&&sd_purge_field_match($cmp,['inqNo','sourceOfferNo'],$inqNos+$offerNos))foreach(($cmp['purchases']??[])as $purchase)if(is_array($purchase)){sd_purge_add($purchaseIds,$purchase['cd']??'');sd_purge_add($purchaseIds,$purchase['id']??'');}
    $payableIds=[];foreach(($collections['ptf_crm_payables']??[])as $row)if(is_array($row)&&sd_purge_field_match($row,['inqNo','offerNo'],$inqNos+$offerNos))sd_purge_add($payableIds,$row['cd']??$row['_id']??'');
    $sf=$collections['ptf_crm_supplier_finance']??[];$sfInvoiceIds=[];$sfDeletePayments=[];$sfTrimPayments=[];$sfRows=[];
    foreach(($sf['invoices']??[])as $row)if(is_array($row)){ $legacy=false;foreach(($row['legacyPayableCds']??[])as $legacyCd)if(isset($payableIds[(string)$legacyCd])){$legacy=true;break;} if(sd_purge_field_match($row,['inqNo','offerNo'],$inqNos+$offerNos)||sd_purge_field_match($row,['sourcePurchaseCd'],$purchaseIds)||$legacy){$id=trim((string)($row['cd']??$row['_id']??''));if($id!=='')$sfInvoiceIds[$id]=true;$sfRows[]=$row;} }
    foreach(($sf['payments']??[])as $row)if(is_array($row)){ $id=trim((string)($row['cd']??$row['_id']??''));$sourceMatch=sd_purge_field_match($row,['sourcePurchaseCd'],$purchaseIds);$matched=0;$unmatched=0;foreach(($row['allocations']??[])as $allocation){if(is_array($allocation)&&isset($sfInvoiceIds[(string)($allocation['invoiceCd']??'')]))$matched++;else$unmatched++;}if(($sourceMatch||$matched>0)&&$unmatched===0){if($id!=='')$sfDeletePayments[$id]=true;$sfRows[]=$row;}elseif($matched>0&&$id!=='')$sfTrimPayments[$id]=true; }
    $allAliases=$projectIds+$caseIds+$offerNos+$offerIds+$inqNos+$invoiceIds+$receiptIds+$purchaseIds+$sfInvoiceIds;
    foreach(['ptf_crm_reminders','ptf_crm_notifs','ptf_crm_sendqueue','ptf_crm_audit','ptf_crm_corrections','ptf_crm_fin_findings','ptf_crm_deleted_archive']as $key)foreach(($collections[$key]??[])as $row)if(is_array($row)&&sd_purge_recursive_exact($row,$allAliases))$addMatch($key,$row);
    foreach($sfRows as $row)$matchedRows[]=$row;
    $cloud=[];foreach($matchedRows as $row)sd_collect_cloud_keys($row,$cloud);$cloudKeys=array_keys($cloud);sort($cloudKeys);
    $counts=[];$samples=[];$signature=[];foreach($matches as $key=>$fps){$counts[$key]=count($fps);$samples[$key]=array_slice(array_keys($idsForTombstone[$key]??[]),0,5);$signature[$key]=[];foreach($fps as $fp=>$rowHash)$signature[$key][]=$fp.':'.$rowHash;sort($signature[$key]);}
    if($sfInvoiceIds){$counts['ptf_crm_supplier_finance_invoices']=count($sfInvoiceIds);$samples['ptf_crm_supplier_finance_invoices']=array_slice(array_keys($sfInvoiceIds),0,5);$signature['ptf_crm_supplier_finance_invoices']=array_keys($sfInvoiceIds);}
    if($sfDeletePayments){$counts['ptf_crm_supplier_finance_payments']=count($sfDeletePayments);$samples['ptf_crm_supplier_finance_payments']=array_slice(array_keys($sfDeletePayments),0,5);$signature['ptf_crm_supplier_finance_payments']=array_keys($sfDeletePayments);}
    if($sfTrimPayments){$counts['ptf_crm_supplier_finance_allocations']=count($sfTrimPayments);$samples['ptf_crm_supplier_finance_allocations']=array_slice(array_keys($sfTrimPayments),0,5);$signature['ptf_crm_supplier_finance_allocations']=array_keys($sfTrimPayments);}
    if($sfRows){$signature['ptf_crm_supplier_finance_state']=array_map(function($row){return hash('sha256',json_encode($row,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES));},$sfRows);sort($signature['ptf_crm_supplier_finance_state']);}
    ksort($counts);ksort($signature);
    $identityMap=[];foreach($idsForTombstone as $key=>$set)$identityMap[$key]=array_keys($set);$identityMap['ptf_crm_supplier_finance']=array_values(array_unique(array_merge(array_keys($sfInvoiceIds),array_keys($sfDeletePayments))));
    $years=[];foreach($matchedRows as $row){foreach(['closedAt','t','wonAt','wonAtISO','createdAt','createdAtISO','invDate','receivedAt','dateISO','iso','date']as $field){$y=sd_year($row[$field]??'');if($y!=='')$years[$y]=true;}}
    $keysDigest=hash('sha256',json_encode($cloudKeys,JSON_UNESCAPED_SLASHES));
    $planHash=hash('sha256',json_encode(['project'=>$projectNo,'records'=>$signature,'cloud'=>$keysDigest],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES));
    return['projectNo'=>$projectNo,'error'=>$blockers?'shared_inventory_dependency':'','blockers'=>$blockers,'counts'=>$counts,'samples'=>$samples,'recordCount'=>array_sum($counts),'cloudKeys'=>$cloudKeys,'cloudCount'=>count($cloudKeys),'keysDigest'=>$keysDigest,'years'=>array_keys($years),'planHash'=>$planHash,'_matches'=>$matches,'_identities'=>$identityMap,'_supplierFinance'=>['invoiceIds'=>array_keys($sfInvoiceIds),'deletePaymentIds'=>array_keys($sfDeletePayments),'trimPaymentIds'=>array_keys($sfTrimPayments)]];
}
function sd_purge_receipt_path(string $planHash): string { $dir=dirname(sd_sync_dir()).'/purge-receipts';if(!is_dir($dir))@mkdir($dir,0750,true);return$dir.'/'.preg_replace('/[^a-f0-9]/','',strtolower($planHash)).'.json'; }

function sd_migration_report(): array {
    $offers=sd_read('ptf_crm_offers'); $cases=sd_read('ptf_crm_deals');
    $invoices=sd_read('ptf_crm_invoices'); $receipts=sd_read('ptf_crm_case_receipts');
    $byNo=[]; $issues=[]; $safe=[];
    foreach($offers as $o) if(is_array($o)&&!empty($o['no'])) $byNo[(string)$o['no']][]=$o;
    foreach($byNo as $no=>$rows) if(count($rows)>1) $issues[]=['type'=>'duplicate_offer','severity'=>'critical','ref'=>$no,'count'=>count($rows)];
    foreach($offers as $o) {
        if(!is_array($o)) continue;
        $no=(string)($o['no']??''); $matchingCases=[];
        foreach($cases as $c) {
            if(!is_array($c)||!sd_active($c)) continue;
            if(sd_case_offer_linked($c,$o)) $matchingCases[]=$c;
        }
        if(($o['st']??'')==='won'&&!$matchingCases) $issues[]=['type'=>'orphan_won','severity'=>'critical','ref'=>$no];
        if(count($matchingCases)>1) $issues[]=['type'=>'duplicate_case','severity'=>'critical','ref'=>$no,'count'=>count($matchingCases)];
        $pays=is_array($o['advance']['payments']??null)?$o['advance']['payments']:[];
        if(!$pays&&!empty($o['advance'])&&(!empty($o['advance']['cashFull'])||!empty($o['advance']['paid']))) $issues[]=['type'=>'inferred_cash','severity'=>'critical','ref'=>$no,'amount'=>sd_num($o['advance']['amt']??0)];
        if(count($byNo[$no]??[])===1&&count($matchingCases)===1) {
            foreach($pays as $p) {
                if(!is_array($p)||sd_num($p['amt']??0)<=0||preg_match('/چک|cheque/i',(string)($p['how']??''))) continue;
                $legacyRef=(string)($p['cd']??''); $exists=false;
                foreach($receipts as $r) if(is_array($r)&&$legacyRef!==''&&(string)($r['legacyPaymentRef']??'')===$legacyRef){$exists=true;break;}
                if(!$exists) $safe[]=['offerNo'=>$no,'caseId'=>$matchingCases[0]['_id']??$matchingCases[0]['cd']??'','paymentRef'=>$legacyRef,'amount'=>(int)round(sd_num($p['amt']??0)),'date'=>$p['t']??'','method'=>$p['how']??''];
            }
        }
    }
    foreach($invoices as $i) {
        if(!is_array($i))continue;
        if(sd_active($i)&&empty($i['isUnofficial'])&&!sd_invoice_files_ok(is_array($i['files']??null)?$i['files']:[])) $issues[]=['type'=>'missing_official_attachment','severity'=>'high','ref'=>$i['no']??$i['cd']??''];
        $caseId=(string)($i['caseId']??'');if($caseId===''){ $hits=[];foreach($cases as $c)if(is_array($c)&&sd_active($c)&&((string)($c['wonOffer']??'')===(string)($i['offerNo']??'')||(string)($c['offerNo']??'')===(string)($i['offerNo']??'')))$hits[]=$c;if(count($hits)===1)$caseId=(string)($hits[0]['_id']??$hits[0]['cd']??''); }
        if($caseId==='')continue;
        foreach(array_merge($i['payments']??[],$i['pays']??[])as $p){if(!is_array($p)||!sd_active($p)||!empty($p['fromAdvance'])||sd_num($p['amt']??$p['amount']??0)<=0||preg_match('/چک|cheque/i',(string)($p['how']??'')))continue;$ref=(string)($p['cd']??'');$exists=false;foreach($receipts as $r)if(is_array($r)&&$ref!==''&&(string)($r['legacyPaymentRef']??'')===$ref){$exists=true;break;}if(!$exists)$safe[]=['sourceType'=>'invoice','invoiceId'=>$i['_id']??$i['cd']??'','offerNo'=>$i['offerNo']??'','caseId'=>$caseId,'paymentRef'=>$ref,'amount'=>(int)round(sd_num($p['amt']??$p['amount']??0)),'date'=>$p['t']??$i['invDate']??'','method'=>$p['how']??''];}
    }
    return ['issues'=>$issues,'safeReceiptCandidates'=>$safe,'counts'=>['offers'=>count($offers),'cases'=>count($cases),'invoices'=>count($invoices),'receipts'=>count($receipts)]];
}

function sd_repair_row_summary(array $row): array {
    $fields=['cd','_id','_opexRowId','shCd','shName','type','amt','month','status','st','recurringKey','shareTx','serverReconciled','serverMaterialized','shareholderSalary','t'];
    $out=[];foreach($fields as $field)if(array_key_exists($field,$row))$out[$field]=$row[$field];return$out;
}
function sd_repair_months($value): array {
    $out=[];if(!is_array($value))return$out;
    foreach($value as $month){$month=sd_text($month,20);$month=strtr($month,['۰'=>'0','۱'=>'1','۲'=>'2','۳'=>'3','۴'=>'4','۵'=>'5','۶'=>'6','۷'=>'7','۸'=>'8','۹'=>'9','٠'=>'0','١'=>'1','٢'=>'2','٣'=>'3','٤'=>'4','٥'=>'5','٦'=>'6','٧'=>'7','٨'=>'8','٩'=>'9']);$month=str_replace('-','/',$month);if(preg_match('/^(13|14)\d{2}\/(0[1-9]|1[0-2])$/',$month)&&!in_array($month,$out,true))$out[]=$month;}
    sort($out,SORT_STRING);return$out;
}
function sd_repair_is_salary_opex(array $row): bool {
    return !empty($row['shareholderSalary'])||trim((string)($row['shareTx']??''))!==''||strpos((string)($row['recurringKey']??''),'salary:')===0;
}
function sd_repair_relevant_text($row): string {
    return is_array($row)?json_encode($row,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES):'';
}
/* Read-only repair manifest. It never chooses a canonical duplicate, writes a row,
   voids anything, or appends to the correction/audit stores. */
function sd_finance_repair_plan(array $months,array $expectedChairIn=[],array $expectedDraws=[]): array {
    $shareholders=sd_read('ptf_crm_shareholders');$sharetx=sd_read('ptf_crm_sharetx');$opex=sd_read('ptf_crm_opex');$corrections=sd_read('ptf_crm_corrections');$audit=sd_read('ptf_crm_audit');$metaFile=sd_sync_dir().'/meta.json';$meta=is_file($metaFile)?(json_decode((string)@file_get_contents($metaFile),true)?:[]):[];
    $items=[];$summary=['salaryDuplicates'=>0,'salaryTerminalExisting'=>0,'salaryMissing'=>0,'salaryOpexMismatches'=>0,'drawMonthMismatches'=>0,'chairInMissing'=>0,'orphanOpex'=>0,'unlinkedSalaryOpex'=>0,'payableDeleteAudits'=>0,'historyMatches'=>0];
    $add=function(string $kind,string $severity,string $identity,string $decision,array $evidence=[],array $proposed=[] )use(&$items){$items[]=['id'=>'PLAN-'.strtoupper(substr(hash('sha256',$kind.'|'.$identity.'|'.count($items)),0,16)),'kind'=>$kind,'severity'=>$severity,'identity'=>$identity,'decision'=>$decision,'evidence'=>$evidence,'proposed'=>$proposed,'mutation'=>false];};
    $salaryBy=[];$salaryCdMap=[];
    foreach($sharetx as $row){
        if(!is_array($row))continue;$type=strtolower(trim((string)($row['type']??'')));$month=trim((string)($row['month']??''));$shCd=trim((string)($row['shCd']??''));
        if($type==='salary'&&$shCd!==''&&in_array($month,$months,true)){$salaryBy[$shCd][$month][]=$row;$cd=trim((string)($row['cd']??''));if($cd!=='')$salaryCdMap[$cd]=['shCd'=>$shCd,'month'=>$month,'row'=>$row];}
    }
    $salaryOpexBy=[];$allSalaryOpex=[];
    foreach($opex as $row){
        if(!is_array($row))continue;$month=trim((string)($row['month']??''));if(!in_array($month,$months,true)||!sd_repair_is_salary_opex($row))continue;
        $allSalaryOpex[]=$row;$key=trim((string)($row['recurringKey']??''));$shCd='';if(preg_match('/^salary:([^:]+):'.preg_quote($month,'/').'$/',$key,$m))$shCd=$m[1];
        $shareTx=trim((string)($row['shareTx']??''));if($shCd===''&&$shareTx!==''&&isset($salaryCdMap[$shareTx]))$shCd=$salaryCdMap[$shareTx]['shCd'];
        if($shCd!=='')$salaryOpexBy[$shCd][$month][]=$row;
    }
    foreach($shareholders as $sh){
        if(!is_array($sh)||empty($sh['cd'])||($sh['active']??true)===false||($sh['duty']??false)!==true||sd_num($sh['salary']??0)<=0)continue;
        $shCd=sd_text($sh['cd'],160);$salary=(int)round(sd_num($sh['salary']));
        foreach($months as $month){
            $txRows=$salaryBy[$shCd][$month]??[];$activeTx=array_values(array_filter($txRows,'sd_active'));$oxRows=$salaryOpexBy[$shCd][$month]??[];$activeOx=array_values(array_filter($oxRows,'sd_active'));$key='salary:'.$shCd.':'.$month;
            if(count($activeTx)>1){$summary['salaryDuplicates']++;$add('salary_duplicate_active','high',$key,'requires_canonical_selection',array_map('sd_repair_row_summary',$txRows),['allowedAction'=>'select_one_canonical_salary_cd','automaticVoid'=>false]);}
            elseif(count($activeTx)===0&&count($txRows)===0){$summary['salaryMissing']++;$add('salary_missing','high',$key,'requires_explicit_registration',[],['amountFromProfile'=>$salary,'month'=>$month,'allowedAction'=>'register_shareholder_salary','automaticRegistration'=>false]);}
            elseif(count($activeTx)===0&&count($txRows)>0){$summary['salaryTerminalExisting']++;$add('salary_terminal_existing','high',$key,'requires_explicit_restore_decision',array_map('sd_repair_row_summary',$txRows),['automaticRestore'=>false]);}
            if(count($activeTx)===1){$txCd=trim((string)($activeTx[0]['cd']??''));$linked=[];foreach($oxRows as $ox){if((string)($ox['shareTx']??'')===$txCd||((string)($ox['recurringKey']??'')===$key))$linked[]=$ox;}$activeLinked=array_values(array_filter($linked,'sd_active'));if(!$activeLinked){$summary['salaryOpexMismatches']++;$add('salary_opex_missing','high',$key,'requires_atomic_pair_repair',[sd_repair_row_summary($activeTx[0])],['salaryCd'=>$txCd,'amount'=>$salary,'month'=>$month,'automaticCreate'=>false]);}elseif(count($activeLinked)>1){$summary['salaryOpexMismatches']++;$add('salary_opex_duplicate','high',$key,'requires_opex_canonical_selection',array_map('sd_repair_row_summary',$activeLinked),['automaticVoid'=>false]);}}
            if(count($activeTx)===1&&count($activeOx)>0){$txAmount=(int)round(sd_num($activeTx[0]['amt']??0));if($txAmount!==$salary){$summary['salaryOpexMismatches']++;$add('salary_profile_amount_mismatch','medium',$key,'requires_profile_history_review',[sd_repair_row_summary($activeTx[0])],['profileAmount'=>$salary,'recordAmount'=>$txAmount,'automaticRewrite'=>false]);}}
        }
    }
    foreach($allSalaryOpex as $row){
        $shareTx=trim((string)($row['shareTx']??''));$orphan=false;$reason='';
        if($shareTx!==''&&!isset($salaryCdMap[$shareTx])){$orphan=true;$reason='shareTx_not_found_in_scoped_salary_rows';}
        elseif($shareTx!==''&&isset($salaryCdMap[$shareTx])&&!sd_active($salaryCdMap[$shareTx]['row'])){$orphan=true;$reason='shareTx_points_to_terminal_salary';}
        if($orphan){$summary['orphanOpex']++;$id=trim((string)($row['_opexRowId']??$row['cd']??''));$add('salary_opex_orphan','high',$id?:'unknown','requires_classification',[sd_repair_row_summary($row)],['reason'=>$reason,'automaticDelete'=>false,'automaticRelink'=>false]);}
        elseif($shareTx===''&&strpos((string)($row['cat']??''),'حقوق')!==false&&!empty($row['month'])){$summary['unlinkedSalaryOpex']++;$id=trim((string)($row['_opexRowId']??$row['cd']??''));$add('salary_opex_unlinked','medium',$id?:'unknown','requires_classification',[sd_repair_row_summary($row)],['reason'=>'salary_like_category_without_shareholder_identity','automaticDelete'=>false,'automaticRelink'=>false]);}
    }
    $drawExpect=[];foreach($expectedDraws as $expected){if(!is_array($expected))continue;$cd=sd_text($expected['cd']??'',160);$month=sd_repair_months([$expected['expectedMonth']??'']);if($cd!==''&&$month)$drawExpect[$cd]=$month[0];}
    foreach($sharetx as $row){
        if(!is_array($row)||strtolower(trim((string)($row['type']??'')))!=='draw')continue;$cd=trim((string)($row['cd']??''));if($cd===''||!isset($drawExpect[$cd]))continue;$actual=trim((string)($row['month']??''));if($actual!==$drawExpect[$cd]){$summary['drawMonthMismatches']++;$add('draw_month_mismatch','high',$cd,'requires_explicit_month_correction',[sd_repair_row_summary($row)],['currentMonth'=>$actual,'expectedMonth'=>$drawExpect[$cd],'automaticMove'=>false]);}
    }
    if($expectedChairIn){$expectedCount=max(0,(int)($expectedChairIn['count']??0));$expectedAmount=(int)round(sd_num($expectedChairIn['amountIRR']??0));$current=[];foreach($sharetx as $row)if(is_array($row)&&strtolower(trim((string)($row['type']??'')))==='chair_in'&&sd_active($row)&&(!$expectedAmount||((int)round(sd_num($row['amt']??0))===$expectedAmount)))$current[]=$row;$missing=max(0,$expectedCount-count($current));if($expectedCount>0&&$missing>0){$summary['chairInMissing']=$missing;$add('chair_in_missing','critical','chair_in|'.$expectedAmount,'unrecoverable_without_external_evidence',array_map('sd_repair_row_summary',$current),['expectedCount'=>$expectedCount,'currentCount'=>count($current),'missingCount'=>$missing,'amountIRR'=>$expectedAmount,'automaticCreate'=>false,'requiredEvidence'=>['originalDate','paymentProofOrExternalLedger']]);}}
    foreach($audit as $row){if(!is_array($row))continue;$text=sd_repair_relevant_text($row);if(strpos($text,'حذف بدهی/بستانکاری')!==false){$summary['payableDeleteAudits']++;$add('payable_delete_audit','high',trim((string)($row['ref']??''))?:'audit','requires_server_audit_review',[['t'=>$row['t']??'','user'=>$row['user']??'','module'=>$row['m']??'','action'=>$row['a']??'','ref'=>$row['ref']??'']],['automaticRestore'=>false]);}}
    foreach($corrections as $row){if(!is_array($row))continue;$kind=(string)($row['kind']??'');if(in_array($kind,['duplicate_recurring_void','eligibility_void','explicit_restore'],true)||strpos(sd_repair_relevant_text($row),'salary:')!==false){$summary['historyMatches']++;$add('financial_correction_history','info',trim((string)($row['entityId']??$row['_id']??''))?:'correction','evidence_only',[['kind'=>$kind,'entityType'=>$row['entityType']??'','entityId'=>$row['entityId']??'','reason'=>$row['reason']??'','correctedAt'=>$row['correctedAt']??'']],['automaticReplay'=>false]);}}
    $keyRevisions=[];foreach($meta as $key=>$value)if($key!=='_global'&&is_array($value)&&isset($value['rev']))$keyRevisions[$key]=(int)$value['rev'];ksort($keyRevisions);
    $manifest=['scopeMonths'=>$months,'summary'=>$summary,'items'=>$items,'serverGlobalRevision'=>(int)($meta['_global']['rev']??0),'keyRevisions'=>$keyRevisions];$manifest['planHash']=hash('sha256',json_encode($manifest,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES));
    return ['readOnly'=>true,'mutation'=>false,'planVersion'=>'finance-repair-plan-v1','serverGlobalRevision'=>$manifest['serverGlobalRevision'],'keyRevisions'=>$keyRevisions,'scopeMonths'=>$months,'summary'=>$summary,'items'=>$items,'planHash'=>$manifest['planHash']];
}

$readOnly = in_array($action, ['snapshot', 'health', 'migration_dry_run', 'duplicate_case_plan', 'archived_case_purge_plan', 'command_status', 'finance_repair_plan'], true);
if ($readOnly) {
    /* v34.7.45: compact authoritative receipt lookup. A large command may commit but
       lose its projection response in transport; replaying the same large response is
       not proof that it failed. The owner can recover the durable journal receipt by
       operation/action without downloading every changed collection again. */
    if ($action === 'finance_repair_plan') {
        sd_require_role(SD_OFFER_REPAIR_ROLES);
        $months=sd_repair_months($body['months']??[]);if(!$months)sd_out(['ok'=>false,'error'=>'repair_scope_months_required'],422);
        $expectedChairIn=is_array($body['expectedChairIn']??null)?$body['expectedChairIn']:[];$expectedDraws=is_array($body['expectedDraws']??null)?$body['expectedDraws']:[];
        sd_out(['ok'=>true,'data'=>sd_finance_repair_plan($months,$expectedChairIn,$expectedDraws),'version'=>SD_SERVICE_VERSION]);
    }
    if ($action === 'command_status') {
        $operationId=sd_text($body['operationId']??'',120);$commandAction=sd_text($body['commandAction']??'',80);
        if($operationId===''||$commandAction==='')sd_out(['ok'=>false,'error'=>'command_status_identity_required'],422);
        /* وضعیت فقط پس از تکمیل WAL زیر همان lock قطعی است؛ read بدون recovery ممکن
           بود درست در فاصلهٔ crash، یک commit موجود را «یافت نشد» گزارش کند.
           v34.8.11/F7: warningهای fopen/file operation نباید قبل از JSON روی پاسخ چاپ
           شوند؛ آن وضعیت در مرورگر به «پاسخ نامعتبر بازیابی رسید» تبدیل می‌شد و علت
           واقعی را پنهان می‌کرد. warning را به Throwable تبدیل و پاسخ ساختاری برمی‌گردانیم. */
        $receiptLockPath=sd_sync_dir().'/meta.json.lock';$receiptLock=@fopen($receiptLockPath,'c+');
        if(!$receiptLock||!@flock($receiptLock,LOCK_EX))sd_out(['ok'=>false,'error'=>'lock_unavailable'],503);
        set_error_handler(function($severity,$message,$file,$line){if(!(error_reporting()&$severity))return false;throw new ErrorException($message,0,$severity,$file,$line);});
        try{sd_recover_pending_transactions();$commands=sd_read('ptf_crm_sales_commands');}
        catch(Throwable $receiptError){restore_error_handler();@flock($receiptLock,LOCK_UN);@fclose($receiptLock);sd_out(['ok'=>false,'error'=>'command_status_recovery_failed','detail'=>sd_text($receiptError->getMessage(),300)],500);}
        restore_error_handler();
        @flock($receiptLock,LOCK_UN);@fclose($receiptLock);
        foreach($commands as $cmd){
            if(!is_array($cmd)||(string)($cmd['key']??'')!==$operationId||(string)($cmd['status']??'')!=='committed')continue;
            if((string)($cmd['by']??'')!==''&&!hash_equals((string)$cmd['by'],(string)$user))sd_out(['ok'=>false,'error'=>'idempotency_key_owner_mismatch'],403);
            if((string)($cmd['action']??'')!==$commandAction)sd_out(['ok'=>false,'error'=>'idempotency_key_action_mismatch'],409);
            sd_out(['ok'=>true,'committed'=>true,'operationId'=>$operationId,'commandAction'=>$commandAction,
                'rev'=>sd_current_rev(),'result'=>is_array($cmd['result']??null)?$cmd['result']:[],'version'=>SD_SERVICE_VERSION]);
        }
        sd_out(['ok'=>true,'committed'=>false,'operationId'=>$operationId,'commandAction'=>$commandAction,'version'=>SD_SERVICE_VERSION]);
    }
    if ($action === 'migration_dry_run') { sd_require_role(SD_ADMIN_ROLES); sd_out(['ok'=>true,'report'=>sd_migration_report(),'version'=>SD_SERVICE_VERSION]); }
    if ($action === 'archived_case_purge_plan') {
        sd_require_role(SD_OFFER_REPAIR_ROLES);
        $projectNo=sd_text($body['projectNo']??'',160);if($projectNo==='')sd_out(['ok'=>false,'error'=>'project_number_required'],422);
        $plan=sd_archive_purge_plan_data($projectNo,sd_purge_load_collections());unset($plan['_matches'],$plan['_identities'],$plan['_supplierFinance']);
        sd_out(['ok'=>true,'plan'=>$plan]);
    }
    if ($action === 'duplicate_case_plan') {
        sd_require_role(SD_OFFER_REPAIR_ROLES);
        $no = sd_text($body['offerNo'] ?? '', 100);
        if ($no === '') sd_out(['ok'=>false,'error'=>'offer_number_required'],422);
        $linked=['petty'=>['rows'=>sd_read('ptf_crm_petty'),'field'=>'dealRef'],'opex'=>['rows'=>sd_read('ptf_crm_opex'),'field'=>'dealRef'],'issuedCheques'=>['rows'=>sd_read('ptf_crm_cheques_issued'),'field'=>'dealCd'],'receivedCheques'=>['rows'=>sd_read('ptf_crm_cheques_received'),'field'=>'dealCd'],'salesReturns'=>['rows'=>sd_read('ptf_crm_sales_returns'),'field'=>'dealCd']];
        sd_out(['ok'=>true,'plan'=>sd_duplicate_case_plan_data(sd_read('ptf_crm_offers'),sd_read('ptf_crm_deals'),sd_read('ptf_crm_invoices'),sd_read('ptf_crm_case_receipts'),sd_read('ptf_crm_receipt_allocations'),sd_read('ptf_crm_fin_attachments'),$no,$linked)]);
    }
    sd_require_role(SD_FIN_ROLES);
    if ($action === 'health') {
        $d = sd_snapshot();
        sd_out(['ok'=>true,'counts'=>array_map('count', $d),'migration'=>sd_migration_report(),'version'=>SD_SERVICE_VERSION]);
    }
    sd_out(['ok'=>true,'data'=>sd_snapshot(),'version'=>SD_SERVICE_VERSION]);
}

/* ═══ v34.8.45 (R6/T7 — CMD-RATE-LIMIT): سقف نرخ فرمان‌های نوشتاری per-user ═══
   پنجرهٔ لغزان ۶۰ثانیه‌ای، حداکثر ۶۰ فرمان در دقیقه برای هر کاربر. هدف: کشف زودهنگام
   حلقه‌های خراب کلاینت/اسکریپت (نه کاربر واقعی — کاربر انسانی به این سقف نمی‌رسد).
   فقط مسیر نوشتن (غیرreadOnly)؛ چک قبل از قفل اصلی تا رد ارزان باشد؛ شمارنده
   best-effort است — شکست نوشتن فایل، درخواست را نمی‌شکند. */
{
    $rlFile = sd_sync_dir() . '/cmd_rate.json';
    $rlMax = 60; $rlWindow = 60; $rlNow = time();
    $rl = is_file($rlFile) ? (json_decode((string)@file_get_contents($rlFile), true) ?: []) : [];
    $rlUser = ($user !== '') ? $user : ('role:' . $role);
    $rlList = array_values(array_filter(array_map('intval', is_array($rl[$rlUser] ?? null) ? $rl[$rlUser] : []),
        function ($t) use ($rlNow, $rlWindow) { return $t > $rlNow - $rlWindow; }));
    if (count($rlList) >= $rlMax) {
        sd_out(['ok'=>false,'error'=>'rate_limited','retryAfter'=>max(1, $rlWindow - ($rlNow - (int)$rlList[0])),'limit'=>$rlMax,'window'=>$rlWindow], 429);
    }
    $rlList[] = $rlNow;
    $rl[$rlUser] = $rlList;
    if (count($rl) > 200) { /* هرس دوره‌ای کاربران بی‌فعالیت تا فایل رشد نکند */
        foreach ($rl as $rlK => $rlV) {
            $rlKeep = array_values(array_filter(array_map('intval', is_array($rlV) ? $rlV : []),
                function ($t) use ($rlNow, $rlWindow) { return $t > $rlNow - $rlWindow; }));
            if (!$rlKeep) unset($rl[$rlK]); else $rl[$rlK] = $rlKeep;
        }
    }
    @file_put_contents($rlFile, json_encode($rl), LOCK_EX);
}

/* Shared with crm.php data_push so a legacy client cannot interleave a whole-array
   write between the command's cross-collection projections. */
$lockPath = sd_sync_dir() . '/meta.json.lock';
$lock = fopen($lockPath, 'c+');
if (!$lock || !flock($lock, LOCK_EX)) sd_out(['ok'=>false,'error'=>'lock_unavailable'], 503);
try {
    /* Complete a crash-interrupted command before reading any projection. The WAL
       already contains its exact command receipt, therefore the replay below returns
       the prior ACK and never executes the business mutation a second time. */
    sd_recover_pending_transactions();
    $offers = sd_read('ptf_crm_offers');
    $cases = sd_read('ptf_crm_deals');
    $rfqs = sd_read('ptf_crm_rfqs');
    $invoices = sd_read('ptf_crm_invoices');
    $receipts = sd_read('ptf_crm_case_receipts');
    $allocations = sd_read('ptf_crm_receipt_allocations');
    $attachments = sd_read('ptf_crm_fin_attachments');
    $corrections = sd_read('ptf_crm_corrections');
    $findings = sd_read('ptf_crm_fin_findings');
    $deleted = sd_read('ptf_crm_deleted_archive');
    $snaps = sd_read('ptf_crm_fiscal_snapshots');
    $commands = sd_read('ptf_crm_sales_commands');
    /* Cross-case links outside the financial core are loaded only for the rare merge command. */
    $petty=[];$opex=[];$issuedCheques=[];$receivedCheques=[];$salesReturns=[];
    if($action==='duplicate_case_merge'){$petty=sd_read('ptf_crm_petty');$opex=sd_read('ptf_crm_opex');$issuedCheques=sd_read('ptf_crm_cheques_issued');$receivedCheques=sd_read('ptf_crm_cheques_received');$salesReturns=sd_read('ptf_crm_sales_returns');}
    $idem = sd_text($body['idempotencyKey'] ?? '', 120);
    if ($idem === '') sd_out(['ok'=>false,'error'=>'idempotency_key_required'],422);
    $requestHash = sd_command_request_hash($action, $body);
    $old = sd_idempotency($commands, $idem, $action, $requestHash);
    if ($old) {
        $keys = is_array($old['result']['keys'] ?? null) ? $old['result']['keys'] : [];
        /* Recurring replay never reuses an old full snapshot or stale payload. Only the
           journaled identities are re-read under this lock and emitted at current rev. */
        if(sd_is_recurring_projection_action($action)){
            $rev=sd_current_rev();
            $identities=is_array($old['result']['projectionIdentities']??null)?$old['result']['projectionIdentities']:[];
            sd_out(['ok'=>true,'idempotent'=>true,'rev'=>$rev,'result'=>$old['result'],
                'data'=>sd_recurring_projection_data($action,sd_read('ptf_crm_opex'),$identities,$rev)]);
        }
        /* retry همان command نیز projection جاری را با watermark دقیق می‌گیرد؛ بدون
           rev، کلاینت ناچار بود آن را روی نسخهٔ نامعلوم cache اعمال کند. */
        sd_out(['ok'=>true,'idempotent'=>true,'rev'=>sd_current_rev(),'result'=>$old['result'],'data'=>sd_snapshot($keys)]);
    }
    $changes = [];
    $result = [];
    $responseChanges = null; // mutation کامل ممکن است شامل collection محرمانه باشد.

    if ($action === 'rfq_attachment_add' || $action === 'rfq_attachment_remove' || $action === 'rfq_attachment_replace') {
        sd_require_role(SD_RFQ_ROLES);
        $rfqId = sd_text($body['rfqId'] ?? '', 160);
        $category = sd_text($body['category'] ?? '', 20);
        $allowedCategories = ['inq', 'ds', 'img', 'dwg', 'oth', 'cat'];
        if ($rfqId === '' || !in_array($category, $allowedCategories, true)) sd_out(['ok'=>false,'error'=>'invalid_rfq_attachment_target'],422);
        $ri = -1;
        foreach ($rfqs as $i => $rq) {
            if (!is_array($rq)) continue;
            if ((string)($rq['_id'] ?? '') === $rfqId || (string)($rq['cd'] ?? '') === $rfqId) { $ri = (int)$i; break; }
        }
        if ($ri < 0) sd_out(['ok'=>false,'error'=>'rfq_not_found'],404);
        if (!isset($rfqs[$ri]['files']) || !is_array($rfqs[$ri]['files'])) $rfqs[$ri]['files'] = [];
        if (!isset($rfqs[$ri]['files'][$category]) || !is_array($rfqs[$ri]['files'][$category])) $rfqs[$ri]['files'][$category] = [];
        $list =& $rfqs[$ri]['files'][$category];
        $attachmentId = sd_text($body['attachmentId'] ?? '', 120);
        $ai = -1;
        if ($attachmentId !== '') foreach ($list as $i => $f) {
            if (!is_array($f)) continue;
            if ((string)($f['_id'] ?? '') === $attachmentId || (string)($f['key'] ?? '') === $attachmentId) { $ai = (int)$i; break; }
        }
        if ($action === 'rfq_attachment_add' || $action === 'rfq_attachment_replace') {
            $incoming = is_array($body['file'] ?? null) ? $body['file'] : [];
            $key = sd_text($incoming['key'] ?? '', 1000);
            if ($key === '' || strpos($key, 'rfqatt/') !== 0 || strpos($key, '..') !== false) sd_out(['ok'=>false,'error'=>'invalid_rfq_attachment_file'],422);
            foreach ($list as $existing) if (is_array($existing) && (string)($existing['key'] ?? '') === $key) {
                $result=['attachmentId'=>$existing['_id']??$key,'rfqId'=>$rfqId,'category'=>$category,'duplicate'=>true];
                $changes=['ptf_crm_rfqs'=>$rfqs];
                break;
            }
            if (!$changes) {
                $record = [
                    '_id'=>sd_uuid('RFQATT'), 'name'=>sd_text($incoming['name'] ?? 'file', 255),
                    'key'=>$key, 'size'=>(int)max(0, sd_num($incoming['size'] ?? 0)),
                    'mode'=>sd_text($incoming['mode'] ?? 'cloud', 30), 'contentType'=>sd_text($incoming['contentType'] ?? '', 120),
                    't'=>sd_text($incoming['t'] ?? sd_now(), 80), 'uploadedAtISO'=>sd_now(), 'uploadedBy'=>$user,
                    'version'=>1, 'status'=>'active'
                ];
                if ($action === 'rfq_attachment_replace') {
                    if ($ai < 0) sd_out(['ok'=>false,'error'=>'rfq_attachment_not_found'],404);
                    $oldFile = $list[$ai];
                    $record['version'] = (int)($oldFile['version'] ?? 1) + 1;
                    $record['replacesAttachmentId'] = $oldFile['_id'] ?? $oldFile['key'] ?? '';
                    if (!isset($rfqs[$ri]['fileHistory']) || !is_array($rfqs[$ri]['fileHistory'])) $rfqs[$ri]['fileHistory'] = [];
                    $oldFile['status'] = 'replaced'; $oldFile['replacedAtISO'] = sd_now(); $oldFile['replacedBy'] = $user;
                    $rfqs[$ri]['fileHistory'][] = $oldFile;
                    $list[$ai] = $record;
                } else $list[] = $record;
                $result=['attachmentId'=>$record['_id'],'rfqId'=>$rfqId,'category'=>$category,'replaced'=>$record['replacesAttachmentId']??''];
                $changes=['ptf_crm_rfqs'=>$rfqs];
            }
        } else {
            if ($ai < 0) sd_out(['ok'=>false,'error'=>'rfq_attachment_not_found'],404);
            $removed = $list[$ai];
            if (!isset($rfqs[$ri]['fileHistory']) || !is_array($rfqs[$ri]['fileHistory'])) $rfqs[$ri]['fileHistory'] = [];
            $removed['status']='deleted'; $removed['deletedAtISO']=sd_now(); $removed['deletedBy']=$user;
            $rfqs[$ri]['fileHistory'][]=$removed;
            array_splice($list,$ai,1);
            $result=['removedAttachmentId'=>$removed['_id']??$removed['key']??'','removedKey'=>$removed['key']??'','rfqId'=>$rfqId,'category'=>$category];
            $changes=['ptf_crm_rfqs'=>$rfqs];
        }
        unset($list);
    }
    elseif ($action === 'register_offer') {
        sd_require_role(SD_WIN_ROLES);
        if ($idem === '') sd_out(['ok'=>false,'error'=>'operation_id_required'],428);
        $incoming=is_array($body['offer']??null)?$body['offer']:[];$no=sd_text($incoming['no']??'',100);if($no==='')sd_out(['ok'=>false,'error'=>'offer_number_required'],422);
        /* v34.7.42: receipt فرمان فقط با مهر خود سرور معتبر است. کلاینت نه می‌تواند
           serverOperationId را spoof کند و نه timestamp ثبت قبلی را بازپخش کند. */
        unset($incoming['_serverState'],$incoming['_serverOpId'],$incoming['_serverError'],$incoming['serverOperationId'],$incoming['serverRequestHash'],$incoming['serverRegisteredAt'],$incoming['serverRegisteredBy']);
        $incomingId=sd_text($incoming['_id']??'',100);$createIntent=!empty($body['createIntent']);$idIndex=-1;$noIndexes=[];foreach($offers as $i=>$o)if(is_array($o)){if($incomingId!==''&&(string)($o['_id']??'')===$incomingId)$idIndex=$i;if((string)($o['no']??'')===$no)$noIndexes[]=$i;}
        if(count($noIndexes)>1)sd_out(['ok'=>false,'error'=>'duplicate_offer_no','count'=>count($noIndexes)],409);
        /* اگر process بین rename پروجکشن offer و journal قطع شده باشد، replay دقیق
           با مهر operation+request همان commit نیمه‌منتشر را کامل می‌کند؛ شمارهٔ متعلق
           به فرمان دیگری همچنان conflict است. */
        $crashRecovery=false;
        if(count($noIndexes)===1){$existingForRecovery=$offers[$noIndexes[0]];$crashRecovery=(string)($existingForRecovery['serverOperationId']??'')===$idem&&(string)($existingForRecovery['serverRequestHash']??'')===$requestHash;}
        if($createIntent&&$incomingId===''&&count($noIndexes)>0&&!$crashRecovery)sd_out(['ok'=>false,'error'=>'offer_number_owned_by_another_record'],409);
        if(count($noIndexes)===1&&$idIndex<0&&$incomingId!==''&&$noIndexes[0]!==$idIndex&&!$crashRecovery)sd_out(['ok'=>false,'error'=>'offer_number_owned_by_another_record'],409);
        $target=$crashRecovery?$noIndexes[0]:($idIndex>=0?$idIndex:(count($noIndexes)===1?$noIndexes[0]:-1));if($target>=0&&($offers[$target]['st']??'')==='won'&&!$crashRecovery&&json_encode($offers[$target])!==json_encode($incoming))sd_out(['ok'=>false,'error'=>'won_offer_locked'],409);
        if(empty($incoming['_id']))$incoming['_id']=$target>=0?($offers[$target]['_id']??sd_uuid('OFR')):sd_uuid('OFR');$incoming['updatedAtISO']=$incoming['updatedAtISO']??sd_now();$incoming['serverRegisteredAt']=sd_now();$incoming['serverRegisteredBy']=$user;$incoming['serverOperationId']=$idem;$incoming['serverRequestHash']=$requestHash;
        if($target>=0)$offers[$target]=$incoming;else array_unshift($offers,$incoming);
        /* لینک TO→CO نیز بخشی از همین snapshot است؛ generic sync دیگر مسئول آن نیست. */
        if(strtoupper((string)($incoming['kind']??''))==='CO'&&!empty($incoming['srcToNo']))foreach($offers as &$sourceTo)if(is_array($sourceTo)&&(string)($sourceTo['no']??'')===(string)$incoming['srcToNo']&&empty($sourceTo['coNo'])){$sourceTo['coNo']=$no;break;}unset($sourceTo);
        $inqNo=sd_text($incoming['inqNo']??'',160);
        $rfqIndex=-1;foreach($rfqs as $i=>$rfq)if(is_array($rfq)&&sd_rfq_matches_inquiry($rfq,$inqNo)){$rfqIndex=(int)$i;break;}
        /* فرم می‌تواند برای شمارهٔ دستی RFQ یک رکورد حداقلی ساخته باشد؛ همان candidate
           فقط وقتی هویت آن دقیقاً با inqNo فرمان می‌خواند، داخل همین commit پذیرفته می‌شود. */
        if($rfqIndex<0&&$inqNo!==''&&is_array($body['rfq']??null)){$candidate=$body['rfq'];if(sd_rfq_matches_inquiry($candidate,$inqNo)){array_unshift($rfqs,$candidate);$rfqIndex=0;}}
        $wfResult=sd_apply_offer_workflow($rfqs,$offers,$inqNo,$user,(strtoupper((string)($incoming['kind']??''))==='TO'?'صدور پیشنهاد فنی ':'صدور پیشنهاد مالی ').$no);
        $changes=['ptf_crm_offers'=>$offers];if(!empty($wfResult['found']))$changes['ptf_crm_rfqs']=$rfqs;
        $result=['offerId'=>$incoming['_id'],'offerNo'=>$no,'created'=>$target<0,'recoveredPartialCommit'=>$crashRecovery,'rfqId'=>$wfResult['rfqId']??'','wf'=>$wfResult['wf']??''];
    }
    elseif ($action === 'mark_amendment') {
        sd_require_role(SD_WIN_ROLES);
        $no=sd_text($body['offerNo']??'',100);$parentNo=sd_text($body['parentOfferNo']??'',100);$oi=-1;$pi=-1;
        foreach($offers as $i=>$o)if(is_array($o)){if((string)($o['no']??'')===$no){if($oi>=0)sd_out(['ok'=>false,'error'=>'duplicate_offer_no'],409);$oi=$i;}if((string)($o['no']??'')===$parentNo)$pi=$i;}
        if($oi<0||$pi<0)sd_out(['ok'=>false,'error'=>'offer_or_parent_not_found'],404);$offer=$offers[$oi];$parent=$offers[$pi];
        if(($parent['st']??'')!=='won')sd_out(['ok'=>false,'error'=>'parent_not_won'],422);
        if((string)($offer['buyerCd']??'')!==(string)($parent['buyerCd']??'')||strtoupper((string)($offer['currency']??'IRR'))!==strtoupper((string)($parent['currency']??'IRR')))sd_out(['ok'=>false,'error'=>'amendment_customer_or_currency_mismatch'],422);
        /* AW-01 (v34.7.22): متمم فقط دلتای مثبت است. sd_num علامت منفی را نگه می‌دارد و
           فرم پیشنهاد هم محدودیت علامت ندارد، بنابراین یک offer با جمع صفر/منفی می‌توانست
           به‌طور مکانیکی contractAmount پرونده را کم کند — بدون نوع متمم، بدون دلیل/تأیید و
           بدون لغو خطوط قبلی. کاهش قراردادی باید در فاکتور/اصلاحیه منعکس شود، نه در متمم.
           مرجع: گزارش تلفیقی §۵.۳ | گام D1 نقشهٔ فازبندی */
        if(sd_offer_total($offer)<=0)sd_out(['ok'=>false,'error'=>'invalid_amendment_amount','total'=>sd_offer_total($offer)],422);
        $offerId=sd_offer_id($offer);$parentId=sd_offer_id($parent);$offer['isAmendment']=true;$offer['amendmentOf']=$parentNo;$offer['amendmentOfOfferId']=$parentId;$offer['amendmentMarkedAt']=sd_now();$offer['amendmentMarkedBy']=$user;$offers[$oi]=$offer;$offers[$pi]=$parent;
        $changes=['ptf_crm_offers'=>$offers];$result=['offerId'=>$offerId,'parentOfferId'=>$parentId];
    }
    elseif ($action === 'win_offer') {
        sd_require_role(SD_WIN_ROLES);
        $no = sd_text($body['offerNo'] ?? '', 100);
        $id = sd_text($body['offerId'] ?? '', 100);
        $hits = [];
        foreach ($offers as $i => $o) if (is_array($o) && (($id !== '' && (string)($o['_id'] ?? '') === $id) || ($id === '' && (string)($o['no'] ?? '') === $no))) $hits[] = $i;
        if (count($hits) !== 1) sd_out(['ok'=>false,'error'=>count($hits) ? 'duplicate_offer_no' : 'offer_not_found','count'=>count($hits)], 409);
        $oi = $hits[0]; $offer = $offers[$oi];
        if (($offer['kind'] ?? '') === 'TO') sd_out(['ok'=>false,'error'=>'technical_offer_cannot_win'], 422);
        $offerId = sd_offer_id($offer);
        $attachCaseId = sd_text($body['attachCaseId'] ?? '', 100);
        $existing = [];
        foreach ($cases as $i => $case) if (is_array($case) && sd_active($case) && sd_case_offer_linked($case,$offer)) $existing[] = $i;
        if (count($existing) > 1) sd_out(['ok'=>false,'error'=>'duplicate_sales_cases','caseIds'=>array_map(function($i)use($cases){return $cases[$i]['_id']??$cases[$i]['cd']??'';},$existing)],409);
        $offer['priorStatus'] = $offer['priorStatus'] ?? ($offer['st'] ?? 'sent');
        $offer['st'] = 'won'; $offer['status'] = 'won'; $offer['wonAtISO'] = sd_now(); $offer['wonBy'] = $user;
        $offer['wonRevisionSnapshot'] = ['rev'=>(int)($offer['rev']??0),'lockedAt'=>sd_now(),'lockedBy'=>$user,'items'=>$offer['items']??[],'terms'=>$offer['terms']??[],'currency'=>$offer['currency']??'IRR','total'=>sd_offer_total($offer)];
        if ($attachCaseId !== '') {
            $ci = sd_find_case_index($cases, $attachCaseId);
            if ($ci < 0) sd_out(['ok'=>false,'error'=>'target_case_not_found'],404);
            $case = $cases[$ci]; sd_case_id($case);
            if ((string)($case['buyerCd'] ?? '') !== (string)($offer['buyerCd'] ?? '') || strtoupper((string)($case['currency'] ?? 'IRR')) !== strtoupper((string)($offer['currency'] ?? 'IRR'))) sd_out(['ok'=>false,'error'=>'amendment_customer_or_currency_mismatch'],422);
            /* AW-01 (v34.7.22): همان قاعده در لحظهٔ اتصال متمم به پرونده هم اعمال می‌شود. */
            if (sd_offer_total($offer) <= 0) sd_out(['ok'=>false,'error'=>'invalid_amendment_amount','total'=>sd_offer_total($offer)],422);
            $case['linkedOffers'] = is_array($case['linkedOffers'] ?? null) ? $case['linkedOffers'] : [];
            foreach ($case['linkedOffers'] as $linked) if ((string)($linked['offerId'] ?? '') === $offerId) sd_out(['ok'=>true,'idempotent'=>true,'case'=>$case]);
            $case['linkedOffers'][] = ['offerId'=>$offerId,'offerNo'=>$offer['no'],'relationType'=>'amendment','effectiveAt'=>sd_now(),'linkedBy'=>$user,'amount'=>sd_offer_total($offer)];
            $case['contractAmount'] = sd_num($case['contractAmount'] ?? 0) + sd_offer_total($offer);
            $case['updatedAtISO'] = sd_now(); $offer['amendmentOfCaseId'] = $case['_id'];
            $cases[$ci] = $case; $result['caseId'] = $case['_id']; $result['amendment'] = true;
        } elseif (count($existing) === 1) {
            $ci = $existing[0]; $case = $cases[$ci]; sd_case_id($case); $cases[$ci] = $case; $result['caseId'] = $case['_id']; $result['existing'] = true;
        } else {
            $case = ['_id'=>sd_uuid('CASE'),'cd'=>sd_uuid('DEAL'),'rootOfferId'=>$offerId,'wonOffer'=>$offer['no'],'inqNo'=>$offer['inqNo']??$offer['no'],'buyerCd'=>$offer['buyerCd']??'','buyerCo'=>$offer['buyerCo']??'','currency'=>$offer['currency']??'IRR','contractAmount'=>sd_offer_total($offer),'linkedOffers'=>[['offerId'=>$offerId,'offerNo'=>$offer['no'],'relationType'=>'root','effectiveAt'=>sd_now(),'linkedBy'=>$user,'amount'=>sd_offer_total($offer)]],'docs'=>[],'awardDocs'=>[['kind'=>'won_snapshot','offerId'=>$offerId,'offerNo'=>$offer['no'],'at'=>sd_now(),'by'=>$user,'total'=>sd_offer_total($offer),'source'=>'win_offer']],'st'=>'open','status'=>'active','t'=>sd_now(),'wonAtISO'=>sd_now(),'by'=>$user];
            array_unshift($cases, $case); $result['caseId'] = $case['_id']; $result['created'] = true;
        }
        $offers[$oi] = $offer; $changes = ['ptf_crm_offers'=>$offers,'ptf_crm_deals'=>$cases];
    }
    elseif ($action === 'revise_award') {
        /* P5 / v34.7.41 — رویژن همان پیشنهاد برنده از پروندهٔ فروش.
           شماره و _id پیشنهاد ثابت می‌ماند؛ snapshot قبلی در revisionHistory و correction
           حفظ می‌شود و rev افزایش می‌یابد. مبلغ مؤثر = ریشهٔ رویژن‌شده + متمم‌ها.
           precondition هویت/Rev، پروندهٔ یکتا، کلید idempotency پایدار، دلیل اجباری و
           بازسازی تخصیص‌ها مانع overwrite هم‌زمان و ثبت دوباره پس از پاسخ گم‌شده‌اند.
           اگر فاکتور رسمی فعال باشد، کاهش بدون ابطال همچنان مسدود است. */
        sd_require_role(SD_WIN_ROLES);
        $caseId = sd_text($body['caseId'] ?? '', 100);
        $reason = sd_text($body['reason'] ?? '', 500);
        if ($reason === '') sd_out(['ok'=>false,'error'=>'reason_required'], 422);
        /* v34.7.41: رویژن مالی بدون کلید پایدار یا precondition مجاز نیست. کلاینت
           قدیمی باید refresh شود؛ پذیرفتن درخواست بدون expectedRev یعنی امکان
           overwrite رویژن کاربر دیگر و retry با یک Rev اضافه. */
        if ($idem === '' || !array_key_exists('expectedRev', $body) || sd_text($body['expectedOfferId'] ?? '', 120) === '') {
            sd_out(['ok'=>false,'error'=>'revision_precondition_required'], 428);
        }
        $ci = sd_find_case_index($cases, $caseId);
        if ($ci < 0) sd_out(['ok'=>false,'error'=>'case_not_found'], 404);
        $case = $cases[$ci]; sd_case_id($case);
        if (!sd_active($case)) sd_out(['ok'=>false,'error'=>'sales_case_not_active'], 409);
        $lines = is_array($body['lines'] ?? null) ? $body['lines'] : [];
        if (!$lines) sd_out(['ok'=>false,'error'=>'lines_required'], 422);

        $parentNo = trim((string)($case['wonOffer'] ?? ''));
        $parentHits = [];
        foreach ($offers as $i => $o) if (is_array($o) && $parentNo !== '' && (string)($o['no'] ?? '') === $parentNo) $parentHits[] = (int)$i;
        if (count($parentHits) !== 1) {
            sd_out(['ok'=>false,'error'=>count($parentHits) ? 'duplicate_offer_no' : 'award_offer_not_found','wonOffer'=>$parentNo,'count'=>count($parentHits)], count($parentHits) ? 409 : 404);
        }
        $pi = $parentHits[0]; $parent = $offers[$pi];
        $parentIdentity = trim((string)($parent['_id'] ?? '')); if ($parentIdentity === '') $parentIdentity = $parentNo;
        $expectedOfferId = sd_text($body['expectedOfferId'] ?? '', 120);
        if ($parentIdentity === '' || !hash_equals($parentIdentity, $expectedOfferId)) {
            sd_out(['ok'=>false,'error'=>'award_offer_identity_conflict','expectedOfferId'=>$expectedOfferId,'currentOfferId'=>$parentIdentity], 409);
        }
        $parentStatus = trim((string)($parent['st'] ?? '')); if ($parentStatus === '') $parentStatus = trim((string)($parent['status'] ?? ''));
        if ($parentStatus !== 'won') sd_out(['ok'=>false,'error'=>'award_offer_not_won'], 409);
        if (!sd_case_offer_linked($case, $parent)) sd_out(['ok'=>false,'error'=>'case_award_identity_conflict'], 409);
        $linkedCaseIds = [];
        foreach ($cases as $candidate) if (is_array($candidate) && sd_active($candidate) && sd_case_offer_linked($candidate, $parent)) {
            $linkedCaseIds[] = (string)($candidate['_id'] ?? $candidate['cd'] ?? '');
        }
        if (count($linkedCaseIds) !== 1) sd_out(['ok'=>false,'error'=>'duplicate_sales_cases','caseIds'=>$linkedCaseIds], 409);
        $currentRev = (int)($parent['rev'] ?? 0);
        $rawExpectedRev = $body['expectedRev'];
        if (!(is_int($rawExpectedRev) || (is_string($rawExpectedRev) && ctype_digit($rawExpectedRev)))) {
            sd_out(['ok'=>false,'error'=>'invalid_expected_revision'], 422);
        }
        $expectedRev = (int)$rawExpectedRev;
        if ($expectedRev < 0) sd_out(['ok'=>false,'error'=>'invalid_expected_revision'], 422);
        if ($expectedRev !== $currentRev) {
            sd_out(['ok'=>false,'error'=>'award_revision_conflict','expectedRev'=>$expectedRev,'currentRev'=>$currentRev,'offerId'=>$parentIdentity], 409);
        }

        /* v34.7.45: رویژن از همان فرم کامل پیشنهاد مالی می‌آید. هویت قراردادی
           (مشتری/درخواست/ارز) پس از تشکیل پرونده قابل جابه‌جایی نیست، ولی سایر
           مشخصات سند و شرایط باید همراه اقلام در همان تراکنش رویژن ثبت شوند. */
        $document = is_array($body['offerDocument'] ?? null) ? $body['offerDocument'] : [];
        foreach (['buyerCd','inqNo'] as $identityField) {
            $incomingIdentity=sd_identity($document[$identityField]??'');$currentIdentity=sd_identity($parent[$identityField]??'');
            if($incomingIdentity!==''&&$incomingIdentity!==$currentIdentity)sd_out(['ok'=>false,'error'=>'award_revision_identity_change_forbidden','field'=>$identityField],409);
        }
        $documentCurrency=strtoupper(sd_text($document['currency']??'',10));
        if($documentCurrency!==''&&$documentCurrency!==strtoupper((string)($parent['currency']??'IRR')))sd_out(['ok'=>false,'error'=>'award_revision_identity_change_forbidden','field'=>'currency'],409);
        $documentPatch=[];
        foreach(['dateEn','dateFa','validUntil','sellerContact','buyerContact','buyerTel','printAs','signAs','fxBasis'] as $field) {
            if(array_key_exists($field,$document))$documentPatch[$field]=sd_text($document[$field],$field==='buyerTel'?100:200);
        }
        if(array_key_exists('useSig',$document))$documentPatch['useSig']=!empty($document['useSig']);
        if(array_key_exists('fxRateRef',$document))$documentPatch['fxRateRef']=sd_num($document['fxRateRef']);
        if(array_key_exists('terms',$document)&&is_array($document['terms'])){
            $documentPatch['terms']=[];foreach(array_slice($document['terms'],0,100)as $term){$term=sd_text($term,2000);if($term!=='')$documentPatch['terms'][]=$term;}
        }
        if(array_key_exists('extraCols',$document)&&is_array($document['extraCols'])){
            $documentPatch['extraCols']=[];foreach(array_slice($document['extraCols'],0,99)as $col){$col=sd_text($col,120);if($col!==''&&!in_array($col,$documentPatch['extraCols'],true))$documentPatch['extraCols'][]=$col;}
        }

        /* متادیتای سطر موجود (نرخ مرجع، منبع درخواست، زمان تحویل و …) هنگام
           تغییر qty/price نباید حذف شود. تطبیق به‌ترتیب lineId، sourceItemKey و
           sourceIndex انجام و برای هر سطر جدید lineId سروری یکتا ساخته می‌شود. */
        $oldItems = is_array($parent['items'] ?? null) ? $parent['items'] : [];
        $oldByLineId = []; $sourceCounts = []; $oldBySource = [];
        foreach ($oldItems as $oldIndex => $oldItem) {
            if (!is_array($oldItem)) continue;
            $oldLineId = sd_text($oldItem['lineId'] ?? '', 120);
            if ($oldLineId !== '') {
                if (isset($oldByLineId[$oldLineId])) sd_out(['ok'=>false,'error'=>'duplicate_existing_line_id','lineId'=>$oldLineId], 409);
                $oldByLineId[$oldLineId] = (int)$oldIndex;
            }
            $oldSource = sd_text($oldItem['sourceItemKey'] ?? '', 200);
            if ($oldSource !== '') { $sourceCounts[$oldSource] = ($sourceCounts[$oldSource] ?? 0) + 1; $oldBySource[$oldSource] = (int)$oldIndex; }
        }
        $newItems = []; $usedOld = []; $usedLineIds = [];
        foreach ($lines as $ln) {
            if (!is_array($ln)) continue;
            $qty = sd_num($ln['qty'] ?? 0); $price = sd_num($ln['price'] ?? 0);
            if ($qty <= 0 || $price < 0) continue;
            $incomingLineId = sd_text($ln['lineId'] ?? '', 120);
            $incomingSource = sd_text($ln['sourceItemKey'] ?? '', 200);
            if ($incomingLineId !== '' && !isset($oldByLineId[$incomingLineId])) {
                sd_out(['ok'=>false,'error'=>'unknown_revision_line_id','lineId'=>$incomingLineId], 409);
            }
            $oldIndex = -1;
            if ($incomingLineId !== '' && isset($oldByLineId[$incomingLineId])) $oldIndex = $oldByLineId[$incomingLineId];
            elseif ($incomingSource !== '' && ($sourceCounts[$incomingSource] ?? 0) === 1) $oldIndex = $oldBySource[$incomingSource];
            elseif (isset($ln['sourceIndex']) && is_numeric($ln['sourceIndex'])) {
                $candidateIndex = (int)$ln['sourceIndex'];
                if ($candidateIndex >= 0 && $candidateIndex < count($oldItems)) $oldIndex = $candidateIndex;
            }
            if ($oldIndex >= 0 && isset($usedOld[$oldIndex])) sd_out(['ok'=>false,'error'=>'duplicate_revision_source_line','sourceIndex'=>$oldIndex], 422);
            $base = ($oldIndex >= 0 && is_array($oldItems[$oldIndex] ?? null)) ? $oldItems[$oldIndex] : [];
            $lineId = sd_text($base['lineId'] ?? $incomingLineId, 120);
            if ($lineId === '') $lineId = sd_uuid('LINE');
            if (isset($usedLineIds[$lineId])) sd_out(['ok'=>false,'error'=>'duplicate_revision_line_id','lineId'=>$lineId], 422);
            $name = sd_text($ln['name'] ?? ($base['name'] ?? ''), 300);
            if ($name === '') continue;
            $row = $base;
            $row['name']=$name; $row['desc']=sd_text($ln['desc'] ?? ($base['desc'] ?? ''),500);
            $row['model']=sd_text($ln['model'] ?? ($base['model'] ?? ''),200); $row['unit']=sd_text($ln['unit'] ?? ($base['unit'] ?? ''),60);
            $row['pcode']=sd_text($ln['pcode'] ?? ($base['pcode'] ?? ''),100); $row['brand']=sd_text($ln['brand'] ?? ($base['brand'] ?? ''),200);
            /* فرم مالی کامل metadata نرخ مرجع، حاشیه، تحویل و ستون‌های تکمیلی را
               نیز می‌فرستد. سطر تازه نباید پس از ACK به نسخهٔ کم‌فیلد تبدیل شود. */
            foreach(['prodCd','dlv','refCur','refSrc','refAt','refFrom','sourceInq','spec']as $field){if(array_key_exists($field,$ln))$row[$field]=sd_text($ln[$field],300);}
            foreach(['refPrice','refBuyPrice','marginPct','profitMarginPct']as $field){if(array_key_exists($field,$ln))$row[$field]=sd_num($ln[$field]);}
            if(array_key_exists('refPriceEdited',$ln))$row['refPriceEdited']=!empty($ln['refPriceEdited']);
            if(array_key_exists('extra',$ln)&&is_array($ln['extra'])){$row['extra']=[];foreach(array_slice($ln['extra'],0,99,true)as $key=>$value){$key=sd_text($key,120);if($key!=='')$row['extra'][$key]=sd_text($value,500);}}
            $row['qty']=$qty; $row['price']=$price; $row['lineId']=$lineId;
            if ($incomingSource !== '') $row['sourceItemKey'] = $incomingSource;
            if ($oldIndex >= 0) $usedOld[$oldIndex] = true;
            $usedLineIds[$lineId] = true; $newItems[] = $row;
        }
        if (!$newItems) sd_out(['ok'=>false,'error'=>'no_valid_line'], 422);

        $oldTotal = sd_offer_total($parent);
        $newTotal = 0.0; foreach ($newItems as $it) $newTotal += $it['qty'] * $it['price'];
        if ($newTotal <= 0) sd_out(['ok'=>false,'error'=>'invalid_revised_amount','total'=>$newTotal], 422);

        $voidInvoices = !empty($body['voidInvoices']);
        if ($voidInvoices) sd_require_role(SD_FIN_ROLES);

        $activeCaseInvoices = [];
        foreach ($invoices as $ii => $inv) {
            if (!is_array($inv) || !sd_active($inv)) continue;
            $cid = (string)($inv['caseId'] ?? '');
            if ($cid === '' || (!sd_case_match($case, $cid) && $cid !== (string)($case['_id'] ?? '') && $cid !== (string)($case['cd'] ?? ''))) continue;
            if (!empty($inv['isConsolidated']) && is_array($inv['offerNos'] ?? null) && count($inv['offerNos']) > 1) {
                sd_out(['ok'=>false,'error'=>'consolidated_invoice_blocks_revision','invoiceId'=>$inv['_id'] ?? $inv['cd'] ?? ''], 409);
            }
            $activeCaseInvoices[] = $ii;
        }
        $officialCount = 0; $invoicedIrr = 0;
        foreach ($activeCaseInvoices as $ii) {
            $inv = $invoices[$ii];
            if (empty($inv['isUnofficial'])) { $officialCount++; $invoicedIrr += (int)round(sd_num($inv['amount'] ?? 0)); }
        }
        if (!$voidInvoices && $officialCount > 0 && $newTotal < $oldTotal) {
            sd_out(['ok'=>false,'error'=>'official_invoice_blocks_decrease','invoices'=>$officialCount,
                'invoicedAmount'=>$invoicedIrr,'oldTotal'=>$oldTotal,'newTotal'=>$newTotal], 409);
        }

        $voidedIds = [];
        if ($voidInvoices) {
            foreach ($activeCaseInvoices as $ii) {
                $inv = $invoices[$ii];
                if (sd_is_locked($snaps, (string)($inv['invDate'] ?? $inv['t'] ?? ''))) {
                    sd_out(['ok'=>false,'error'=>'fiscal_period_locked','year'=>sd_year((string)($inv['invDate'] ?? $inv['t'] ?? '')),'invoiceId'=>$inv['_id'] ?? ''], 409);
                }
                $kind = empty($inv['isUnofficial']) ? 'legal_void' : 'void';
                $corrections[] = ['_id'=>sd_uuid('COR'),'entityType'=>empty($inv['isUnofficial'])?'official_invoice':'unofficial_invoice',
                    'entityId'=>$inv['_id'] ?? $inv['cd'] ?? '','kind'=>$kind,'beforeSnapshot'=>$inv,'reason'=>$reason,'correctedBy'=>$user,'correctedAt'=>sd_now()];
                $inv['status'] = 'void'; $inv['st'] = 'void'; $inv['voidAt'] = sd_now(); $inv['voidBy'] = $user; $inv['voidReason'] = $reason;
                $invoices[$ii] = $inv;
                $voidedIds[] = $inv['_id'] ?? $inv['cd'] ?? '';
            }
        }

        $seq = max((int)($parent['revisionSeq'] ?? 0), $currentRev) + 1;
        $hist = is_array($parent['revisionHistory'] ?? null) ? $parent['revisionHistory'] : [];
        $prevSnap = $parent;
        unset($prevSnap['revisionHistory'], $prevSnap['editHistory']);
        $hist[] = ['rev'=>$currentRev, 'at'=>sd_now(), 'by'=>$user, 'snapshot'=>$prevSnap];
        $parent['revisionHistory'] = $hist;
        foreach($documentPatch as $field=>$value)$parent[$field]=$value;
        $parent['items'] = $newItems;
        $parent['rev'] = $seq;
        $parent['revisionSeq'] = $seq;
        $parent['revisionReason'] = $reason;
        $parent['revisedAt'] = sd_now(); $parent['revisedBy'] = $user;
        $parent['st'] = 'won'; $parent['status'] = 'won';
        $parent['wonRevisionSnapshot'] = ['rev'=>$seq,'lockedAt'=>sd_now(),'lockedBy'=>$user,'items'=>$newItems,'terms'=>$parent['terms'] ?? [],'currency'=>$parent['currency'] ?? 'IRR','total'=>$newTotal];
        unset($parent['invRef']);
        $offers[$pi] = $parent;
        foreach ($offers as $oi => $oo) {
            if (!is_array($oo) || (string)($oo['rialOf'] ?? '') !== $parentNo) continue;
            $oo['staleAwardRev'] = $seq;
            $oo['staleAwardAt'] = sd_now();
            $offers[$oi] = $oo;
        }

        $amendSum = 0.0;
        $case['linkedOffers'] = is_array($case['linkedOffers'] ?? null) ? $case['linkedOffers'] : [];
        foreach ($case['linkedOffers'] as &$lnk) {
            if (!is_array($lnk)) continue;
            $relation = (string)($lnk['relationType'] ?? '');
            $linkedId = (string)($lnk['offerId'] ?? ''); $linkedNo = (string)($lnk['offerNo'] ?? '');
            if ($relation === 'root' && (($linkedId !== '' && $linkedId === $parentIdentity) || $linkedNo === $parentNo)) {
                $lnk['amount'] = $newTotal; $lnk['offerId'] = $parentIdentity; $lnk['offerNo'] = $parentNo;
                $lnk['revisionSeq'] = $seq; $lnk['revisedAt'] = sd_now();
            } elseif ($relation === 'amendment') $amendSum += sd_num($lnk['amount'] ?? 0);
        }
        unset($lnk);
        $effective = $newTotal + $amendSum;

        $awardDocs = is_array($case['awardDocs'] ?? null) ? $case['awardDocs'] : [];
        $keptTech = [];
        foreach ($awardDocs as $ad) {
            if (!is_array($ad)) continue;
            if (($ad['role'] ?? '') === 'technical' || ($ad['kind'] ?? '') === 'TO') {
                $tno = (string)($ad['no'] ?? '');
                $src = (string)($parent['srcToNo'] ?? '');
                $co = (string)(($ad['snap']['coNo'] ?? ''));
                if (($src !== '' && $tno === $src) || $co === $parentNo) $keptTech[] = $ad;
            }
        }
        array_unshift($keptTech, ['kind'=>$parent['kind'] ?? 'CO','no'=>$parentNo,'rev'=>$seq,'role'=>'commercial','t'=>sd_now(),'by'=>$user,'source'=>'revise_award','snap'=>$parent]);
        $case['awardDocs'] = $keptTech;
        $case['wonOffer'] = $parentNo;
        $case['rootOfferId'] = sd_offer_id($parent);
        $case['contractAmount'] = $effective;
        $case['effectiveContractAmount'] = $effective;
        $case['awardRevisions'] = is_array($case['awardRevisions'] ?? null) ? $case['awardRevisions'] : [];
        $case['awardRevisions'][] = ['seq'=>$seq,'fromOfferNo'=>$parentNo,'toOfferNo'=>$parentNo,
            'fromRev'=>$currentRev,'toRev'=>$seq,'oldAmount'=>$oldTotal,'newAmount'=>$newTotal,'delta'=>$newTotal - $oldTotal,
            'amendmentSum'=>$amendSum,'effectiveAmount'=>$effective,'voidedInvoices'=>$voidedIds,
            'reason'=>$reason,'at'=>sd_now(),'by'=>$user];
        $case['updatedAtISO'] = sd_now();
        $cases[$ci] = $case;

        $corrections[] = ['_id'=>sd_uuid('COR'),'entityType'=>'award','entityId'=>(string)$case['_id'],
            'kind'=>'revise_award','reason'=>$reason,'correctedBy'=>$user,'correctedAt'=>sd_now(),
            'fromOfferNo'=>$parentNo,'toOfferNo'=>$parentNo,'oldAmount'=>$oldTotal,'newAmount'=>$newTotal,'voidedInvoices'=>$voidedIds];

        sd_rebuild_allocations((string)$case['_id'], $receipts, $invoices, $allocations, $cases);
        $changes = ['ptf_crm_offers'=>$offers,'ptf_crm_deals'=>$cases,'ptf_crm_invoices'=>$invoices,
            'ptf_crm_case_receipts'=>$receipts,'ptf_crm_receipt_allocations'=>$allocations,'ptf_crm_corrections'=>$corrections];
        $result = ['caseId'=>(string)$case['_id'],'revisionOfferNo'=>$parentNo,'revisionOfferId'=>$parent['_id'] ?? '',
            'sameOffer'=>true,'rev'=>$seq,'oldAmount'=>$oldTotal,'newAmount'=>$newTotal,'delta'=>$newTotal - $oldTotal,
            'effectiveAmount'=>$effective,'seq'=>$seq,'voidedInvoiceIds'=>$voidedIds];
    }
    elseif ($action === 'revoke_orphan_delete') {
        /* بازگردانی برد یتیم برای ادمین و رئیس هیئت‌مدیره مجاز است؛ حذف قطعی
           پیشنهاد همچنان فقط در اختیار ادمین باقی می‌ماند. */
        sd_require_role(SD_OFFER_REPAIR_ROLES);
        $no = sd_text($body['offerNo'] ?? '', 100); $oi = -1;
        foreach ($offers as $i=>$o) if (is_array($o)&&(string)($o['no']??'')===$no){ if($oi>=0)sd_out(['ok'=>false,'error'=>'duplicate_offer_no'],409); $oi=$i; }
        if ($oi < 0) sd_out(['ok'=>false,'error'=>'offer_not_found'],404);
        $offer = $offers[$oi];
        if (($offer['st'] ?? '') !== 'won') sd_out(['ok'=>false,'error'=>'offer_not_won'],422);
        $deps=[];
        foreach($cases as $c)if(is_array($c)&&sd_active($c)&&sd_case_offer_linked($c,$offer))$deps[]=['type'=>'case','id'=>$c['_id']??$c['cd']??''];
        foreach($invoices as $inv)if(is_array($inv)&&sd_active($inv)&&(string)($inv['offerNo']??'')===$no)$deps[]=['type'=>'invoice','id'=>$inv['_id']??$inv['cd']??''];
        if($deps)sd_out(['ok'=>false,'error'=>'dependencies_exist','dependencies'=>$deps],409);
        $reason=sd_text($body['reason']??'',500); if($reason==='')sd_out(['ok'=>false,'error'=>'reason_required'],422);
        $deleteIt=!empty($body['delete']);
        if($deleteIt && $role !== 'admin') sd_out(['ok'=>false,'error'=>'delete_requires_admin'],403);
        $corrections[]=['_id'=>sd_uuid('COR'),'entityType'=>'offer','entityId'=>$offer['_id']??$no,'kind'=>'revoke_orphan_win','beforeSnapshot'=>$offer,'reason'=>$reason,'correctedBy'=>$user,'correctedAt'=>sd_now()];
        if($deleteIt){$deleted[]=['id'=>$no,'kind'=>'OFFER','label'=>($offer['kind']??'CO').' — '.($offer['buyerCo']??''),'reason'=>$reason,'by'=>$user,'iso'=>sd_now(),'snapshot'=>$offer]; array_splice($offers,$oi,1);}
        else{$offer['st']=$offer['priorStatus']??'sent';$offer['status']=$offer['st'];$offer['winRevokedAt']=sd_now();$offer['winRevokedBy']=$user;$offer['winRevokedReason']=$reason;if(isset($offer['wonRevisionSnapshot']))$offer['revokedWinSnapshot']=$offer['wonRevisionSnapshot'];unset($offer['wonAt'],$offer['wonAtISO'],$offer['wonBy'],$offer['wonRevisionSnapshot'],$offer['invRef'],$offer['amendmentOfCaseId']);$offers[$oi]=$offer;}
        $changes=['ptf_crm_offers'=>$offers,'ptf_crm_corrections'=>$corrections,'ptf_crm_deleted_archive'=>$deleted];$result=['deleted'=>$deleteIt,'offerNo'=>$no];
    }
    elseif ($action === 'duplicate_case_merge') {
        sd_require_role(SD_OFFER_REPAIR_ROLES);
        $no=sd_text($body['offerNo']??'',100);$keepRequested=sd_text($body['keepCaseId']??'',120);$removeRequested=sd_text($body['removeCaseId']??'',120);
        $reason=sd_text($body['reason']??'',500);$planHash=sd_text($body['planHash']??'',100);
        if(($body['confirm']??'')!=='PTF-DUPLICATE-CASE-MERGE')sd_out(['ok'=>false,'error'=>'merge_confirmation_required'],422);
        if($no===''||$keepRequested===''||$removeRequested===''||$keepRequested===$removeRequested)sd_out(['ok'=>false,'error'=>'case_selection_required'],422);
        if($reason==='')sd_out(['ok'=>false,'error'=>'reason_required'],422);
        $linked=['petty'=>['rows'=>$petty,'field'=>'dealRef'],'opex'=>['rows'=>$opex,'field'=>'dealRef'],'issuedCheques'=>['rows'=>$issuedCheques,'field'=>'dealCd'],'receivedCheques'=>['rows'=>$receivedCheques,'field'=>'dealCd'],'salesReturns'=>['rows'=>$salesReturns,'field'=>'dealCd']];
        $plan=sd_duplicate_case_plan_data($offers,$cases,$invoices,$receipts,$allocations,$attachments,$no,$linked);
        if(($plan['candidateCount']??0)<2)sd_out(['ok'=>false,'error'=>'duplicate_case_not_found','candidateCount'=>$plan['candidateCount']??0],409);
        if($planHash===''||!hash_equals((string)$plan['planHash'],$planHash))sd_out(['ok'=>false,'error'=>'duplicate_case_plan_stale','plan'=>$plan],409);
        $keepIndex=-1;$removeIndex=-1;
        foreach($cases as $i=>$case){if(!is_array($case))continue;$aliases=sd_case_aliases($case);if(in_array($keepRequested,$aliases,true))$keepIndex=$i;if(in_array($removeRequested,$aliases,true))$removeIndex=$i;}
        if($keepIndex<0||$removeIndex<0||$keepIndex===$removeIndex)sd_out(['ok'=>false,'error'=>'selected_case_not_found'],404);
        $keepBefore=$cases[$keepIndex];$source=$cases[$removeIndex];
        $offer=null;foreach($offers as $row)if(is_array($row)&&(string)($row['no']??'')===$no){$offer=$row;break;}
        if(!$offer||!sd_case_offer_linked($keepBefore,$offer)||!sd_case_offer_linked($source,$offer))sd_out(['ok'=>false,'error'=>'case_offer_link_changed'],409);
        $identityConflictField=sd_case_identity_conflict($keepBefore,$source);
        if($identityConflictField!=='')sd_out(['ok'=>false,'error'=>'case_identity_conflict','field'=>$identityConflictField,'keep'=>$keepBefore[$identityConflictField]??'','remove'=>$source[$identityConflictField]??''],409);
        $sourceAliases=sd_case_aliases($source);$conflicts=[];$keep=sd_merge_case_records($keepBefore,$source,$conflicts);
        $keepId=sd_case_id($keep);$keepCd=(string)($keep['cd']??$keepId);$keep['rootOfferId']=!empty($offer['_id'])?$offer['_id']:($keep['rootOfferId']??'');$keep['wonOffer']=$no;
        $keep['mergedFromCaseIds']=array_values(array_unique(array_merge(is_array($keep['mergedFromCaseIds']??null)?$keep['mergedFromCaseIds']:[],$sourceAliases)));
        $keep['mergedCaseHistory']=is_array($keep['mergedCaseHistory']??null)?$keep['mergedCaseHistory']:[];
        $keep['mergedCaseHistory'][]=['sourceCaseId'=>$removeRequested,'sourceCd'=>$source['cd']??'','mergedAt'=>sd_now(),'mergedBy'=>$user,'reason'=>$reason,'sourceSnapshotHash'=>hash('sha256',json_encode($source,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES))];
        $keep['updatedAtISO']=sd_now();$keep['updatedBy']=$user;
        $moved=['invoices'=>0,'receipts'=>0,'allocations'=>0,'attachments'=>0,'petty'=>0,'opex'=>0,'issuedCheques'=>0,'receivedCheques'=>0,'salesReturns'=>0];
        foreach($invoices as &$row)if(is_array($row)&&in_array((string)($row['caseId']??''),$sourceAliases,true)){$row['caseId']=$keepId;$moved['invoices']++;}unset($row);
        foreach($receipts as &$row)if(is_array($row)&&in_array((string)($row['caseId']??''),$sourceAliases,true)){$row['caseId']=$keepId;$moved['receipts']++;}unset($row);
        foreach($allocations as &$row)if(is_array($row)&&in_array((string)($row['caseId']??''),$sourceAliases,true)){$row['caseId']=$keepId;$moved['allocations']++;}unset($row);
        foreach($attachments as &$row)if(is_array($row)&&in_array((string)($row['ownerId']??''),$sourceAliases,true)){$row['ownerId']=$keepId;$moved['attachments']++;}unset($row);
        foreach($petty as &$row)if(is_array($row)&&in_array((string)($row['dealRef']??''),$sourceAliases,true)){$row['dealRef']=$keepCd;$moved['petty']++;}unset($row);
        foreach($opex as &$row)if(is_array($row)&&in_array((string)($row['dealRef']??''),$sourceAliases,true)){$row['dealRef']=$keepCd;$moved['opex']++;}unset($row);
        foreach($issuedCheques as &$row)if(is_array($row)&&in_array((string)($row['dealCd']??''),$sourceAliases,true)){$row['dealCd']=$keepCd;$moved['issuedCheques']++;}unset($row);
        foreach($receivedCheques as &$row)if(is_array($row)&&in_array((string)($row['dealCd']??''),$sourceAliases,true)){$row['dealCd']=$keepCd;$moved['receivedCheques']++;}unset($row);
        foreach($salesReturns as &$row)if(is_array($row)&&in_array((string)($row['dealCd']??''),$sourceAliases,true)){$row['dealCd']=$keepCd;$moved['salesReturns']++;}unset($row);
        foreach($offers as &$row)if(is_array($row)){foreach(['caseId','salesCaseId','amendmentOfCaseId']as $field)if(in_array((string)($row[$field]??''),$sourceAliases,true))$row[$field]=$keepId;if(isset($row['invRef'])&&is_array($row['invRef'])&&in_array((string)($row['invRef']['caseId']??''),$sourceAliases,true))$row['invRef']['caseId']=$keepId;}unset($row);
        $cases[$keepIndex]=$keep;array_splice($cases,$removeIndex,1);
        /* ادغام همچنین رکورد پروژه (projects) را که با cd پرونده مبدأ شناسایی
           می‌شود به شناسه‌های پرونده مقصد بازنشانی می‌کند، وگرنه UI «پرونده‌های
           فروش» همچنان دو رکورد نشان می‌داد. */
        $projects=sd_read('ptf_crm_projects');
        foreach($projects as &$prow)if(is_array($prow)){
            foreach(['cd','dealCd','projectNo']as $pf){if(in_array((string)($prow[$pf]??''),$sourceAliases,true)){$prow[$pf]=$keepCd;if(isset($prow['mergedFromCd'])){$mfc=is_array($prow['mergedFromCd'])?$prow['mergedFromCd']:[$prow['mergedFromCd']];$prow['mergedFromCd']=array_values(array_unique(array_merge($mfc,$sourceAliases)));}else $prow['mergedFromCd']=$sourceAliases;$prow['mergedAt']=sd_now();$prow['mergedBy']=$user;}}
        }unset($prow);
        sd_rebuild_allocations($keepId,$receipts,$invoices,$allocations,$cases);
        foreach($findings as &$finding)if(is_array($finding)&&($finding['ruleId']??'')==='duplicate_case'&&(($finding['evidence']['ref']??'')===$no||($finding['offerNo']??'')===$no)&&($finding['status']??'open')==='open'){$finding['status']='resolved';$finding['resolvedAt']=sd_now();$finding['resolvedBy']=$user;$finding['resolution']='merged_into_'.$keepId;}unset($finding);
        $deleted[]=['id'=>$removeRequested,'kind'=>'CASE_MERGED','label'=>'ادغام پرونده تکراری '.$removeRequested.' در '.$keepId,'reason'=>$reason,'by'=>$user,'iso'=>sd_now(),'snapshot'=>$source,'retainedCaseId'=>$keepId];
        $corrections[]=['_id'=>sd_uuid('COR'),'entityType'=>'case','entityId'=>$keepId,'kind'=>'merge_duplicate_case','beforeSnapshot'=>$keepBefore,'sourceSnapshot'=>$source,'reason'=>$reason,'correctedBy'=>$user,'correctedAt'=>sd_now(),'conflictPaths'=>$conflicts,'movedReferences'=>$moved];
        $changes=['ptf_crm_offers'=>$offers,'ptf_crm_deals'=>$cases,'ptf_crm_projects'=>$projects,'ptf_crm_invoices'=>$invoices,'ptf_crm_case_receipts'=>$receipts,'ptf_crm_receipt_allocations'=>$allocations,'ptf_crm_fin_attachments'=>$attachments,'ptf_crm_fin_findings'=>$findings,'ptf_crm_deleted_archive'=>$deleted,'ptf_crm_corrections'=>$corrections,'ptf_crm_petty'=>$petty,'ptf_crm_opex'=>$opex,'ptf_crm_cheques_issued'=>$issuedCheques,'ptf_crm_cheques_received'=>$receivedCheques,'ptf_crm_sales_returns'=>$salesReturns];
        $result=['offerNo'=>$no,'keptCaseId'=>$keepId,'mergedCaseId'=>$removeRequested,'remainingCandidates'=>max(0,(int)($plan['candidateCount']??2)-1),'movedReferences'=>$moved,'conflictPaths'=>$conflicts];
    }
    elseif ($action === 'archived_case_purge_commit') {
        sd_require_role(SD_OFFER_REPAIR_ROLES);
        $projectNo=sd_text($body['projectNo']??'',160);$typed=sd_text($body['typedProjectNo']??'',160);$reason=sd_text($body['reason']??'',500);$planHash=sd_text($body['planHash']??'',100);
        if(($body['confirm']??'')!=='PTF-PURGE-ARCHIVED-TEST-CASE'||empty($body['testDataConfirmed']))sd_out(['ok'=>false,'error'=>'purge_confirmation_required'],422);
        if($projectNo===''||$typed!==$projectNo)sd_out(['ok'=>false,'error'=>'project_number_confirmation_mismatch'],422);
        if($reason==='')sd_out(['ok'=>false,'error'=>'reason_required'],422);
        $purgeCollections=sd_purge_load_collections();$plan=sd_archive_purge_plan_data($projectNo,$purgeCollections);
        if(!empty($plan['error']))sd_out(['ok'=>false,'error'=>$plan['error']],409);
        if($planHash===''||!hash_equals((string)$plan['planHash'],$planHash))sd_out(['ok'=>false,'error'=>'archive_purge_plan_stale','planHash'=>$plan['planHash']],409);
        if(($plan['cloudCount']??0)>0){$receiptPath=sd_purge_receipt_path($planHash);$receipt=is_file($receiptPath)?json_decode((string)file_get_contents($receiptPath),true):null;if(!is_array($receipt)||empty($receipt['ok'])||!hash_equals((string)($receipt['planHash']??''),$planHash)||!hash_equals((string)($receipt['keysDigest']??''),(string)$plan['keysDigest'])||(string)($receipt['user']??'')!==$user||time()-(int)($receipt['ts']??0)>3600)sd_out(['ok'=>false,'error'=>'cloud_purge_receipt_required'],409);}
        $changes=[];$removedCounts=[];
        foreach(($plan['_matches']??[])as $key=>$fps){$set=$fps;$before=$purgeCollections[$key]??[];$after=array_values(array_filter($before,function($row)use($key,$set){return!is_array($row)||!isset($set[sd_purge_fingerprint($key,$row)]);}));$removedCounts[$key]=count($before)-count($after);$purgeCollections[$key]=$after;$changes[$key]=$after;}
        $sf=$purgeCollections['ptf_crm_supplier_finance']??[];$sfPlan=$plan['_supplierFinance']??[];$sfInvSet=array_fill_keys($sfPlan['invoiceIds']??[],true);$sfPaySet=array_fill_keys($sfPlan['deletePaymentIds']??[],true);
        if($sfInvSet||$sfPaySet||!empty($sfPlan['trimPaymentIds'])){$beforeInv=count($sf['invoices']??[]);$beforePay=count($sf['payments']??[]);$sf['invoices']=array_values(array_filter($sf['invoices']??[],function($row)use($sfInvSet){$id=(string)($row['cd']??$row['_id']??'');return!isset($sfInvSet[$id]);}));$sf['payments']=array_values(array_filter($sf['payments']??[],function($row)use($sfPaySet){$id=(string)($row['cd']??$row['_id']??'');return!isset($sfPaySet[$id]);}));foreach($sf['payments']as &$payment)if(is_array($payment)&&is_array($payment['allocations']??null)){$payment['allocations']=array_values(array_filter($payment['allocations'],function($a)use($sfInvSet){return!is_array($a)||!isset($sfInvSet[(string)($a['invoiceCd']??'')]);}));$payment['unallocated']=(+($payment['amount']??0))-array_reduce($payment['allocations'],function($sum,$a){return$sum+(+($a['amount']??0));},0);}unset($payment);$removedCounts['ptf_crm_supplier_finance_invoices']=$beforeInv-count($sf['invoices']);$removedCounts['ptf_crm_supplier_finance_payments']=$beforePay-count($sf['payments']);$changes['ptf_crm_supplier_finance']=$sf;}
        $fiscalYears=array_fill_keys(array_map('strval',$plan['years']??[]),true);$beforeSnaps=count($snaps);$purgeIdentities=$plan['_identities']??[];$snapIds=[];
        $snaps=array_values(array_filter($snaps,function($snap)use($fiscalYears,&$snapIds){if(!is_array($snap))return true;$year=(string)($snap['year']??$snap['refYear']??'');if($year!==''&&isset($fiscalYears[$year])){$id=trim((string)($snap['_id']??$snap['cd']??$snap['id']??''));if($id!=='')$snapIds[$id]=true;return false;}return true;}));
        if($snapIds)$purgeIdentities['ptf_crm_fiscal_snapshots']=array_keys($snapIds);$removedCounts['ptf_crm_fiscal_snapshots']=$beforeSnaps-count($snaps);$changes['ptf_crm_fiscal_snapshots']=$snaps;
        $archive=$purgeCollections['ptf_crm_deleted_archive']??[];$purgeAliases=[];foreach($purgeIdentities as $ids)foreach($ids as $id)if(strlen((string)$id)>=6)$purgeAliases[(string)$id]=true;
        $archive[]=['id'=>$projectNo,'kind'=>'archive_purge','purged'=>true,'mode'=>$plan['mode']??'full_graph','reason'=>$reason,'by'=>$user,'iso'=>sd_now(),'t'=>sd_now(),'identities'=>$purgeIdentities,'aliases'=>array_keys($purgeAliases),'identityHash'=>hash('sha256',json_encode($purgeIdentities,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES)),'cloudObjectsDeleted'=>(int)($plan['cloudCount']??0),'recordCount'=>(int)($plan['recordCount']??0)];
        $changes['ptf_crm_deleted_archive']=$archive;
        if(isset($receiptPath)&&is_file($receiptPath))@unlink($receiptPath);
        $result=['projectNo'=>$projectNo,'purged'=>true,'mode'=>$plan['mode']??'full_graph','sharedActiveCases'=>count($plan['sharedActiveCases']??[]),'removedCounts'=>$removedCounts,'recordCount'=>(int)($plan['recordCount']??0),'cloudObjectsDeleted'=>(int)($plan['cloudCount']??0),'resetFiscalYears'=>array_keys($fiscalYears)];
    }
    elseif ($action === 'admin_delete_plan' || $action === 'admin_delete_commit') {
        sd_require_role(SD_ADMIN_ROLES);
        $entityType=sd_text($body['entityType']??'',40);$entityId=sd_text($body['entityId']??'',120);if($entityType===''||$entityId==='')sd_out(['ok'=>false,'error'=>'entity_required'],422);
        $deps=[];$target=null;$targetIndex=-1;
        if($entityType==='invoice'){foreach($invoices as $i=>$x)if(is_array($x)&&((string)($x['_id']??'')===$entityId||(string)($x['cd']??'')===$entityId)){$target=$x;$targetIndex=$i;break;}foreach($allocations as $x)if(is_array($x)&&sd_active($x)&&(string)($x['invoiceId']??'')===$entityId)$deps[]=['type'=>'allocation','id'=>$x['_id']??'','amount'=>$x['amountIRR']??0];}
        elseif($entityType==='receipt'){foreach($receipts as $i=>$x)if(is_array($x)&&((string)($x['_id']??'')===$entityId||(string)($x['cd']??'')===$entityId)){$target=$x;$targetIndex=$i;break;}foreach($allocations as $x)if(is_array($x)&&sd_active($x)&&(string)($x['receiptId']??'')===$entityId)$deps[]=['type'=>'allocation','id'=>$x['_id']??'','amount'=>$x['amountIRR']??0];}
        elseif($entityType==='case'){foreach($cases as $i=>$x)if(is_array($x)&&sd_case_match($x,$entityId)){$target=$x;$targetIndex=$i;break;}foreach($receipts as $x)if(is_array($x)&&sd_active($x)&&(string)($x['caseId']??'')===$entityId)$deps[]=['type'=>'receipt','id'=>$x['_id']??$x['cd']??'','amount'=>$x['amountIRR']??0];foreach($invoices as $x)if(is_array($x)&&sd_active($x)&&(string)($x['caseId']??'')===$entityId)$deps[]=['type'=>'invoice','id'=>$x['_id']??$x['cd']??'','amount'=>$x['amount']??0];}
        elseif($entityType==='offer'){foreach($offers as $i=>$x)if(is_array($x)&&((string)($x['_id']??'')===$entityId||(string)($x['no']??'')===$entityId)){$target=$x;$targetIndex=$i;break;}if($target)foreach($cases as $x)if(is_array($x)&&sd_active($x)&&sd_case_offer_linked($x,$target))$deps[]=['type'=>'case','id'=>$x['_id']??$x['cd']??''];}
        else sd_out(['ok'=>false,'error'=>'unsupported_entity'],422);
        if(!$target)sd_out(['ok'=>false,'error'=>'entity_not_found'],404);
        $ownerIds=[$entityId];foreach($deps as $d)if(in_array((string)($d['type']??''),['invoice','receipt','case'],true))$ownerIds[]=(string)($d['id']??'');foreach($attachments as $a)if(is_array($a)&&sd_active($a)&&in_array((string)($a['ownerId']??''),$ownerIds,true))$deps[]=['type'=>'attachment','id'=>$a['_id']??'','name'=>$a['name']??$a['objectKey']??''];
        /* AW-03 (v34.7.22): کشف وابستگی‌های خارج از دامنهٔ Sales-Domain — فقط «گزارش» برای
           پیش‌بررسی حذف. پیش از این plan فقط فاکتور/رسید/تخصیص/ضمیمه را می‌دید و ادمین بدون
           اطلاع از چک، خرید واقعی، تعهد خرید، مرجوعی، بارنامه و QC تصمیم می‌گرفت؛ نتیجه‌اش
           می‌توانست رکورد یتیم باشد. رفتار commit تغییر نکرده: این اقلام cascade نمی‌شوند و
           فقط با پرچم advisory در پاسخ می‌آیند تا کاربر آگاهانه تصمیم بگیرد.
           مرجع: گزارش تلفیقی §۱۱.۲ | گام D3 نقشهٔ فازبندی */
        $advisory=[];
        if($entityType==='case'||$entityType==='invoice'){
            $caseKeys=[];$invKeys=[];$offerNos=[];
            if($entityType==='case'){$caseKeys[(string)($target['_id']??'')]=true;$caseKeys[(string)($target['cd']??'')]=true;foreach([$target['wonOffer']??'',$target['offerNo']??'']as $ono)if(trim((string)$ono)!=='')$offerNos[trim((string)$ono)]=true;foreach($invoices as $x)if(is_array($x)&&in_array((string)($x['caseId']??''),array_keys($caseKeys),true)){$invKeys[(string)($x['_id']??'')]=true;$invKeys[(string)($x['cd']??'')]=true;if(trim((string)($x['offerNo']??''))!=='')$offerNos[trim((string)$x['offerNo'])]=true;}}
            else{$invKeys[(string)($target['_id']??'')]=true;$invKeys[(string)($target['cd']??'')]=true;if(trim((string)($target['offerNo']??''))!=='')$offerNos[trim((string)$target['offerNo'])]=true;$caseKeys[(string)($target['caseId']??'')]=true;}
            unset($caseKeys[''],$invKeys[''],$offerNos['']);
            $scan=function(string $key,callable $match,string $type)use(&$advisory){foreach(sd_read($key) as $row){if(!is_array($row))continue;if($match($row))$advisory[]=['type'=>$type,'id'=>(string)($row['_id']??$row['cd']??$row['no']??''),'amount'=>(float)sd_num($row['amt']??$row['amount']??$row['totalAmount']??0)];}};
            $scan('ptf_crm_cheques_received',function($r)use($invKeys,$caseKeys){return isset($invKeys[(string)($r['sourceInvoiceCd']??'')])||isset($invKeys[(string)($r['invoiceCd']??'')])||isset($caseKeys[(string)($r['caseId']??'')]);},'cheque_received');
            $scan('ptf_crm_cheques_issued',function($r)use($caseKeys){return isset($caseKeys[(string)($r['caseId']??'')]);},'cheque_issued');
            $scan('ptf_crm_sales_returns',function($r)use($invKeys,$offerNos){return isset($invKeys[(string)($r['invoiceCd']??'')])||isset($offerNos[trim((string)($r['offerNo']??''))]);},'sales_return');
            $scan('ptf_crm_buycmp',function($r)use($offerNos){return isset($offerNos[trim((string)($r['sourceOfferNo']??''))]);},'purchase_compare');
            $scan('ptf_crm_payables',function($r)use($offerNos){return isset($offerNos[trim((string)($r['offerNo']??''))]);},'payable');
            $scan('ptf_crm_packinglists',function($r)use($offerNos){return isset($offerNos[trim((string)($r['offerNo']??''))]);},'packing_list');
            $scan('ptf_crm_projects',function($r)use($offerNos){return isset($offerNos[trim((string)($r['offerNo']??''))]);},'project');
        }
        if($action==='admin_delete_plan'){@flock($lock,LOCK_UN);@fclose($lock);sd_out(['ok'=>true,'plan'=>['entityType'=>$entityType,'entityId'=>$entityId,'target'=>$target,'dependencies'=>$deps,'advisoryDependencies'=>$advisory,'advisoryNote'=>$advisory?'این اقلام با حذف پاک نمی‌شوند و ممکن است یتیم بمانند؛ پیش از حذف تعیین‌تکلیف شوند.':'','requiresCascade'=>count($deps)>0,'periodLocked'=>sd_is_locked($snaps,(string)($target['invDate']??$target['receivedAt']??$target['t']??''))]]);}
        if(($body['confirm']??'')!=='PTF-ADMIN-HARD-DELETE')sd_out(['ok'=>false,'error'=>'delete_confirmation_required'],422);if($deps&&empty($body['cascade']))sd_out(['ok'=>false,'error'=>'dependencies_require_explicit_cascade','dependencies'=>$deps],409);$reason=sd_text($body['reason']??'',500);if($reason==='')sd_out(['ok'=>false,'error'=>'reason_required'],422);
        $date=(string)($target['invDate']??$target['receivedAt']??$target['t']??'');$invalidYear=sd_invalidate_period($snaps,$date,$user,'حذف ادمین: '.$reason);$touched=[];
        $deleted[]=['id'=>$entityId,'kind'=>strtoupper($entityType),'label'=>$target['no']??$target['cd']??$entityId,'reason'=>$reason,'by'=>$user,'iso'=>sd_now(),'snapshot'=>$target,'dependencies'=>$deps,'periodInvalidated'=>$invalidYear];$corrections[]=['_id'=>sd_uuid('COR'),'entityType'=>$entityType,'entityId'=>$entityId,'kind'=>'admin_hard_delete','beforeSnapshot'=>$target,'reason'=>$reason,'correctedBy'=>$user,'correctedAt'=>sd_now()];
        if($entityType==='invoice'){$touched[(string)($target['caseId']??'')]=true;array_splice($invoices,$targetIndex,1);$allocations=array_values(array_filter($allocations,function($x)use($entityId){return !is_array($x)||(string)($x['invoiceId']??'')!==$entityId;}));}
        elseif($entityType==='receipt'){$touched[(string)($target['caseId']??'')]=true;array_splice($receipts,$targetIndex,1);$allocations=array_values(array_filter($allocations,function($x)use($entityId){return !is_array($x)||(string)($x['receiptId']??'')!==$entityId;}));}
        elseif($entityType==='case'){$caseKey=sd_case_id($target);array_splice($cases,$targetIndex,1);if(!empty($body['cascade'])){$invoices=array_values(array_filter($invoices,function($x)use($caseKey){return !is_array($x)||(string)($x['caseId']??'')!==$caseKey;}));$receipts=array_values(array_filter($receipts,function($x)use($caseKey){return !is_array($x)||(string)($x['caseId']??'')!==$caseKey;}));$allocations=array_values(array_filter($allocations,function($x)use($caseKey){return !is_array($x)||(string)($x['caseId']??'')!==$caseKey;}));}}
        elseif($entityType==='offer'){array_splice($offers,$targetIndex,1);if(!empty($body['cascade'])){foreach($deps as $d){if(($d['type']??'')!=='case')continue;$dc=(string)($d['id']??'');$cases=array_values(array_filter($cases,function($x)use($dc){return !is_array($x)||!sd_case_match($x,$dc);}));}}}
        $cascadeOwnerIds=[$entityId];if(!empty($body['cascade']))foreach($deps as $d)if(in_array((string)($d['type']??''),['invoice','receipt','case'],true))$cascadeOwnerIds[]=(string)($d['id']??'');foreach($attachments as &$a)if(is_array($a)&&sd_active($a)&&in_array((string)($a['ownerId']??''),$cascadeOwnerIds,true)){$a['status']='deleted';$a['deletedAt']=sd_now();$a['deletedBy']=$user;$a['deleteReason']='حذف مالک: '.$reason;}unset($a);
        foreach(array_keys($touched)as $tc)if($tc!=='')sd_rebuild_allocations($tc,$receipts,$invoices,$allocations,$cases);
        $changes=['ptf_crm_offers'=>$offers,'ptf_crm_deals'=>$cases,'ptf_crm_invoices'=>$invoices,'ptf_crm_case_receipts'=>$receipts,'ptf_crm_receipt_allocations'=>$allocations,'ptf_crm_fin_attachments'=>$attachments,'ptf_crm_deleted_archive'=>$deleted,'ptf_crm_corrections'=>$corrections,'ptf_crm_fiscal_snapshots'=>$snaps];$result=['deleted'=>true,'entityType'=>$entityType,'entityId'=>$entityId,'dependenciesRemoved'=>count($deps),'invalidatedYear'=>$invalidYear];
    }
    elseif ($action === 'register_shareholder_salary') {
        /* Explicit one-shareholder/month registration. It is deliberately not the
           reconciliation/restore path: an existing identity is a strict no-op. */
        sd_require_role(SD_SHAREHOLDER_VIEW_ROLES);
        $month=sd_text($body['month']??'',20);$shCd=sd_text($body['shareholderCd']??$body['scopeShareholder']??'',160);
        if($shCd==='')sd_out(['ok'=>false,'error'=>'shareholder_required'],422);
        if(!preg_match('/^(13|14)\d{2}\/(0[1-9]|1[0-2])$/',$month))sd_out(['ok'=>false,'error'=>'invalid_jalali_month'],422);
        if(sd_is_locked($snaps,$month))sd_out(['ok'=>false,'error'=>'fiscal_period_locked','year'=>sd_year($month)],409);
        $shareholders=sd_read('ptf_crm_shareholders');$sharetx=sd_read('ptf_crm_sharetx');$opex=sd_read('ptf_crm_opex');
        $shareholder=null;foreach($shareholders as $candidate)if(is_array($candidate)&&(string)($candidate['cd']??'')===$shCd){$shareholder=$candidate;break;}
        if(!$shareholder||($shareholder['active']??true)===false||($shareholder['duty']??false)!==true||sd_num($shareholder['salary']??0)<=0)sd_out(['ok'=>false,'error'=>'salary_not_eligible'],422);
        $salary=(int)round(sd_num($shareholder['salary']));$key='salary:'.$shCd.':'.$month;
        $txHits=sd_salary_find_indexes($sharetx,$key,$shCd,$month);$txCds=[];foreach($txHits as $txIndex)if(trim((string)($sharetx[$txIndex]['cd']??''))!=='')$txCds[]=trim((string)$sharetx[$txIndex]['cd']);
        $oxHits=[];foreach($opex as $oxIndex=>$ox){if(!is_array($ox)||(string)($ox['month']??'')!==$month)continue;$sameKey=(string)($ox['recurringKey']??'')===$key;$sameTx=in_array(trim((string)($ox['shareTx']??'')),$txCds,true)&&!empty($ox['shareholderSalary']);if($sameKey||$sameTx)$oxHits[]=(int)$oxIndex;}
        if($txHits||$oxHits){
            $rev=sd_current_rev();$projectionIdentities=[];foreach($oxHits as $oxIndex)$projectionIdentities[]=$opex[$oxIndex];
            $result=['registered'=>false,'alreadyRegistered'=>true,'month'=>$month,'shareholderCd'=>$shCd,'recurringKey'=>$key,'amount'=>$salary,'existingSalaryRows'=>count($txHits),'existingOpexRows'=>count($oxHits),'projectionMode'=>'no-op-existing-identity'];
            $response=sd_recurring_projection_data($action,$opex,$projectionIdentities,$rev);
            if(is_resource($lock)){@flock($lock,LOCK_UN);@fclose($lock);}
            sd_out(['ok'=>true,'alreadyRegistered'=>true,'rev'=>$rev,'result'=>$result,'data'=>$response]);
        }
        $now=sd_now();$txCd=sd_stable_recurring_code('SHT-SAL',$key);$oxCd=sd_stable_recurring_code('OPX-SAL',$key);$rowId=sd_stable_recurring_code('OPXR-SAL',$key);
        $sharetx[]=['cd'=>$txCd,'shCd'=>$shCd,'shName'=>(string)($shareholder['name']??$shCd),'type'=>'salary','amt'=>$salary,'desc'=>'حقوق موظف ماه '.$month,'month'=>$month,'t'=>$month.'/01','recurringKey'=>$key,'status'=>'active','serverReconciled'=>true,'createdAt'=>$now,'createdBy'=>$user];
        $opex[]=['cd'=>$oxCd,'_opexRowId'=>$rowId,'cat'=>'حقوق و دستمزد','amt'=>$salary,'month'=>$month,'desc'=>'حقوق موظف سهامدار: '.(string)($shareholder['name']??$shCd),'shareTx'=>$txCd,'shareholderSalary'=>true,'recurringKey'=>$key,'status'=>'active','serverReconciled'=>true,'serverMaterialized'=>true,'t'=>$month.'/01','createdAt'=>$now,'createdBy'=>$user];
        $projectionRows=[$opex[count($opex)-1]];$changes=['ptf_crm_sharetx'=>$sharetx,'ptf_crm_opex'=>$opex];$responseChanges=['ptf_crm_opex'=>[],'ptf_crm_sharetx'=>[]];
        $result=['registered'=>true,'alreadyRegistered'=>false,'month'=>$month,'shareholderCd'=>$shCd,'recurringKey'=>$key,'amount'=>$salary,'transactionCd'=>$txCd,'opexRowId'=>$rowId,'projectionMode'=>'atomic-salary-opex','projectionIdentities'=>$projectionRows];
    }
    elseif ($action === 'register_chair_in' || $action === 'register_shareholder_draw' || $action === 'register_chair_out') {
        /* Chair/treasury movements are append-only domain commands. A retry with the
           same idempotency key is replayed by the outer command journal; a new key is a
           distinct real movement, even when amount/month are equal. */
        sd_require_role(SD_SHAREHOLDER_VIEW_ROLES);
        $shCd=sd_text($body['shareholderCd']??'',160);$month=sd_text($body['month']??'',20);$amount=(int)round(sd_num($body['amountIRR']??$body['amount']??0));
        if($shCd===''||!preg_match('/^(13|14)\d{2}\/(0[1-9]|1[0-2])$/',$month))sd_out(['ok'=>false,'error'=>'invalid_sharetx_identity'],422);
        if($amount<=0||$amount>9000000000000000)sd_out(['ok'=>false,'error'=>'invalid_amount'],422);
        if(sd_is_locked($snaps,$month))sd_out(['ok'=>false,'error'=>'fiscal_period_locked','year'=>sd_year($month)],409);
        $shareholders=sd_read('ptf_crm_shareholders');$sharetx=sd_read('ptf_crm_sharetx');$shareholder=null;foreach($shareholders as $candidate)if(is_array($candidate)&&(string)($candidate['cd']??'')===$shCd){$shareholder=$candidate;break;}
        if(!$shareholder||($shareholder['active']??true)===false)sd_out(['ok'=>false,'error'=>'shareholder_not_found'],404);
        $type=$action==='register_chair_in'?'chair_in':($action==='register_chair_out'?'chair_out':'draw');
        if($type==='chair_out'&&$amount>sd_chair_claim($sharetx,$shCd))sd_out(['ok'=>false,'error'=>'chair_claim_insufficient'],409);
        $files=sd_sharetx_files($body['files']??[]);$now=sd_now();$txCd=sd_uuid('SHT');$row=['cd'=>$txCd,'shCd'=>$shCd,'shName'=>(string)($shareholder['name']??$shCd),'type'=>$type,'amt'=>$amount,'desc'=>sd_text($body['desc']??$body['note']??'',1000),'month'=>$month,'t'=>sd_text($body['t']??$month.'/01',60),'serverReconciled'=>true,'status'=>'active','createdAt'=>$now,'createdBy'=>$user,'files'=>$files];
        if($type==='draw'){$salaryMonth=sd_text($body['salaryMonth']??'',20);if($salaryMonth!==''){if(!preg_match('/^(13|14)\d{2}\/(0[1-9]|1[0-2])$/',$salaryMonth))sd_out(['ok'=>false,'error'=>'invalid_salary_month'],422);$row['salaryMonth']=$salaryMonth;$row['paymentFor']='salary';}}
        $sharetx[]=$row;$changes=['ptf_crm_sharetx'=>$sharetx];$responseChanges=['ptf_crm_sharetx'=>$sharetx];$result=['registered'=>true,'type'=>$type,'transactionCd'=>$txCd,'shareholderCd'=>$shCd,'amount'=>$amount,'month'=>$month,'projectionMode'=>'atomic-sharetx'];
    }
    elseif ($action === 'reconcile_shareholder_salaries' || $action === 'reconcile_recurring_opex') {
        sd_require_role(SD_FIN_ROLES);
        $month=sd_text($body['month']??'',20);$currentMonth=sd_current_jalali_month();
        $explicitEligibility=!empty($body['explicitEligibility']);
        $includeSalaries=($body['includeSalaries']??true)!==false;
        $includeTemplates=$action==='reconcile_recurring_opex'&&($body['includeTemplates']??true)!==false;
        $explicitTemplate=$includeTemplates&&!empty($body['explicitTemplate']);
        $scopeTemplate=sd_text($body['scopeTemplate']??'',160);
        if($explicitTemplate&&$scopeTemplate==='')sd_out(['ok'=>false,'error'=>'opex_template_scope_required'],422);
        if(!preg_match('/^(13|14)\d{2}\/(0[1-9]|1[0-2])$/',$month))sd_out(['ok'=>false,'error'=>'invalid_jalali_month'],422);
        if($month!==$currentMonth&&!$explicitEligibility&&!$explicitTemplate)sd_out(['ok'=>false,'error'=>'current_tehran_month_required','expected'=>$currentMonth],422);
        if(sd_is_locked($snaps,$month))sd_out(['ok'=>false,'error'=>'fiscal_period_locked','year'=>sd_year($month)],409);
        $restoreKeys=[];foreach((is_array($body['restoreKeys']??null)?$body['restoreKeys']:[])as $restoreKey){$restoreKey=sd_text($restoreKey,220);if($restoreKey!==''&&!in_array($restoreKey,$restoreKeys,true))$restoreKeys[]=$restoreKey;}
        $scopeShareholder=sd_text($body['scopeShareholder']??'',160);$explicitReason=sd_text($body['reason']??'',500);
        if(($explicitEligibility||$explicitTemplate||count($restoreKeys)>0)&&$explicitReason==='')sd_out(['ok'=>false,'error'=>'reason_required'],422);

        $shareholders=sd_read('ptf_crm_shareholders');$sharetx=sd_read('ptf_crm_sharetx');$opex=sd_read('ptf_crm_opex');sd_ensure_recurring_opex_row_identities($opex);
        $settings=sd_read('ptf_crm_settings');$templates=is_array($settings['opexTpl']??null)?$settings['opexTpl']:[];$correctionStart=count($corrections);
        $now=sd_now();$created=0;$updated=0;$voided=0;$conflicts=0;$suppressed=0;$invalidTemplates=0;$matchedTemplates=0;$projectionRows=[];$eligibleSalaryKeys=[];

        if($includeSalaries)foreach($shareholders as $sh){
            if(!is_array($sh)||empty($sh['cd'])||($sh['active']??true)===false||($sh['duty']??false)!==true||sd_num($sh['salary']??0)<=0)continue;
            $shCd=sd_text($sh['cd'],160);$salary=sd_num($sh['salary']);$key='salary:'.$shCd.':'.$month;$eligibleSalaryKeys[$key]=true;
            $restore=sd_recurring_restore_requested($key,$restoreKeys);$txHits=sd_salary_find_indexes($sharetx,$key,$shCd,$month);
            /* Legacy salary OPEX may predate recurringKey but already has a durable
               shareTx relation. Union every matching transaction identity (not merely
               the first duplicate) so migration cannot create another OPEX sibling. */
            $oxHits=sd_recurring_find_indexes($opex,$key,[]);$legacyTxCds=[];
            foreach($txHits as $legacyTxIndex){
                $candidateCd=trim((string)($sharetx[$legacyTxIndex]['cd']??''));if($candidateCd===''||in_array($candidateCd,$legacyTxCds,true))continue;$legacyTxCds[]=$candidateCd;
                $oxHits=array_values(array_unique(array_merge($oxHits,sd_recurring_find_indexes($opex,$key,['shareTx'=>$candidateCd,'shareholderSalary'=>true]))));
            }
            $hasExplicit=false;$hasTerminal=false;
            foreach($txHits as $i){if(sd_recurring_explicit_tombstone($sharetx[$i]))$hasExplicit=true;if(!sd_active($sharetx[$i]))$hasTerminal=true;}
            foreach($oxHits as $i){if(sd_recurring_explicit_tombstone($opex[$i]))$hasExplicit=true;if(!sd_active($opex[$i]))$hasTerminal=true;}
            /* A terminal legacy row without explicit markers is still not permission
               for an automatic run to resurrect it. Only an explicit restore flow may
               reactivate a terminal identity. */
            if(($hasExplicit||$hasTerminal)&&!$restore){$suppressed++;foreach($oxHits as $i)$projectionRows[]=$opex[$i];continue;}

            $txCd=sd_stable_recurring_code('SHT-SAL',$key);$txIndex=sd_recurring_pick_index($sharetx,$txHits,$restore);$restoreTx=$restore&&$txIndex>=0&&sd_recurring_explicit_tombstone($sharetx[$txIndex]);
            if($txIndex<0){
                $sharetx[]=['cd'=>$txCd,'shCd'=>$shCd,'shName'=>(string)($sh['name']??$shCd),'type'=>'salary','amt'=>$salary,'desc'=>'حقوق موظف ماه '.$month,'month'=>$month,'t'=>$month.'/01','recurringKey'=>$key,'status'=>'active','serverReconciled'=>true,'createdT'=>$now,'createdBy'=>$user];$txIndex=count($sharetx)-1;$created++;
            }else{
                $beforeSnapshot=$sharetx[$txIndex];$before=json_encode($beforeSnapshot);$legacyCd=trim((string)($sharetx[$txIndex]['cd']??''));$sharetx[$txIndex]['cd']=$legacyCd!==''?$legacyCd:$txCd;$sharetx[$txIndex]['shCd']=$shCd;$sharetx[$txIndex]['shName']=(string)($sh['name']??$shCd);$sharetx[$txIndex]['type']='salary';$sharetx[$txIndex]['amt']=$salary;$sharetx[$txIndex]['desc']='حقوق موظف ماه '.$month;$sharetx[$txIndex]['month']=$month;$sharetx[$txIndex]['t']=$month.'/01';$sharetx[$txIndex]['recurringKey']=$key;$sharetx[$txIndex]['serverReconciled']=true;sd_recurring_activate($sharetx[$txIndex]);if($restoreTx){$sharetx[$txIndex]['restoreIntent']='explicit';$sharetx[$txIndex]['restoredAt']=$now;$sharetx[$txIndex]['restoredBy']=$user;}
                if(json_encode($sharetx[$txIndex])!==$before){$sharetx[$txIndex]['updatedT']=$now;$sharetx[$txIndex]['updatedBy']=$user;$updated++;}
                if($restoreTx)$corrections[]=['_id'=>sd_uuid('COR'),'entityType'=>'shareholder_salary','entityId'=>$sharetx[$txIndex]['cd'],'kind'=>'explicit_restore','beforeSnapshot'=>$beforeSnapshot,'afterSnapshot'=>$sharetx[$txIndex],'reason'=>$explicitReason,'correctedBy'=>$user,'correctedAt'=>$now];
            }
            $oxCd=sd_stable_recurring_code('OPX-SAL',$key);$rowId=sd_stable_recurring_code('OPXR-SAL',$key);$oxIndex=sd_recurring_pick_index($opex,$oxHits,$restore);$restoreOx=$restore&&$oxIndex>=0&&sd_recurring_explicit_tombstone($opex[$oxIndex]);
            if($oxIndex<0){
                $opex[]=['cd'=>$oxCd,'_opexRowId'=>$rowId,'cat'=>'حقوق و دستمزد','amt'=>$salary,'month'=>$month,'desc'=>'حقوق موظف سهامدار: '.(string)($sh['name']??$shCd),'shareTx'=>$sharetx[$txIndex]['cd'],'shareholderSalary'=>true,'recurringKey'=>$key,'status'=>'active','serverReconciled'=>true,'serverMaterialized'=>true,'t'=>$month.'/01','createdAt'=>$now,'createdBy'=>$user];$oxIndex=count($opex)-1;$created++;
            }else{
                $beforeSnapshot=$opex[$oxIndex];$before=json_encode($beforeSnapshot);$legacyCd=trim((string)($opex[$oxIndex]['cd']??''));$legacyRow=trim((string)($opex[$oxIndex]['_opexRowId']??''));$opex[$oxIndex]['cd']=$legacyCd!==''?$legacyCd:$oxCd;$opex[$oxIndex]['_opexRowId']=$legacyRow!==''?$legacyRow:$rowId;$opex[$oxIndex]['cat']='حقوق و دستمزد';$opex[$oxIndex]['amt']=$salary;$opex[$oxIndex]['month']=$month;$opex[$oxIndex]['desc']='حقوق موظف سهامدار: '.(string)($sh['name']??$shCd);$opex[$oxIndex]['shareTx']=$sharetx[$txIndex]['cd'];$opex[$oxIndex]['shareholderSalary']=true;$opex[$oxIndex]['recurringKey']=$key;$opex[$oxIndex]['serverReconciled']=true;$opex[$oxIndex]['serverMaterialized']=true;$opex[$oxIndex]['t']=$month.'/01';sd_recurring_activate($opex[$oxIndex]);if($restoreOx){$opex[$oxIndex]['restoreIntent']='explicit';$opex[$oxIndex]['restoredAt']=$now;$opex[$oxIndex]['restoredBy']=$user;}
                if(json_encode($opex[$oxIndex])!==$before){$opex[$oxIndex]['updatedAtISO']=$now;$opex[$oxIndex]['updatedBy']=$user;$updated++;}
                if($restoreOx)$corrections[]=['_id'=>sd_uuid('COR'),'entityType'=>'opex','entityId'=>$opex[$oxIndex]['_opexRowId']??$opex[$oxIndex]['cd'],'kind'=>'explicit_restore','beforeSnapshot'=>$beforeSnapshot,'afterSnapshot'=>$opex[$oxIndex],'reason'=>$explicitReason,'correctedBy'=>$user,'correctedAt'=>$now];
            }
            $projectionRows[]=$opex[$oxIndex];if(count($txHits)>1||count($oxHits)>1)$conflicts++;
            /* Destructive duplicate cleanup obeys the explicit shareholder scope too;
               editing one shareholder must not terminal rows belonging to another. */
            if($explicitEligibility&&($scopeShareholder===''||$scopeShareholder===$shCd)){
                foreach($txHits as $dup)if($dup!==$txIndex&&(sd_active($sharetx[$dup])||($restore&&sd_recurring_explicit_tombstone($sharetx[$dup])))){
                    $duplicateBefore=$sharetx[$dup];sd_recurring_void($sharetx[$dup],'رکورد تکراری حقوق — '.$explicitReason,$user,'eligibility');$voided++;
                    $corrections[]=['_id'=>sd_uuid('COR'),'entityType'=>'shareholder_salary','entityId'=>$sharetx[$dup]['cd']??'','kind'=>'duplicate_recurring_void','beforeSnapshot'=>$duplicateBefore,'afterSnapshot'=>$sharetx[$dup],'reason'=>$explicitReason,'correctedBy'=>$user,'correctedAt'=>$now];
                }
                foreach($oxHits as $dup)if($dup!==$oxIndex){
                    if(sd_active($opex[$dup])||($restore&&sd_recurring_explicit_tombstone($opex[$dup]))){
                        $duplicateBefore=$opex[$dup];sd_recurring_void($opex[$dup],'رکورد تکراری هزینه حقوق — '.$explicitReason,$user,'eligibility');$voided++;
                        $corrections[]=['_id'=>sd_uuid('COR'),'entityType'=>'opex','entityId'=>$opex[$dup]['_opexRowId']??$opex[$dup]['cd']??'','kind'=>'duplicate_recurring_void','beforeSnapshot'=>$duplicateBefore,'afterSnapshot'=>$opex[$dup],'reason'=>$explicitReason,'correctedBy'=>$user,'correctedAt'=>$now];
                    }
                    $projectionRows[]=$opex[$dup];
                }
            }
        }

        /* Automatic runs never void missing eligibility. Only a confirmed explicit
           shareholder reconcile may retire the scoped/all no-longer-eligible rows.
           Legacy salary OPEX can lack recurringKey while still carrying shareTx; build
           the relation before any void so a scoped edit retires both sides, not only the
           shareholder claim. This is an identity migration, never absence inference. */
        if($includeSalaries&&$explicitEligibility){
            $salaryIdentityByCd=[];
            foreach($sharetx as $salaryIdentityRow){
                if(!is_array($salaryIdentityRow)||(string)($salaryIdentityRow['type']??'')!=='salary'||(string)($salaryIdentityRow['month']??'')!==$month)continue;
                $identityCd=trim((string)($salaryIdentityRow['cd']??''));$identityShCd=trim((string)($salaryIdentityRow['shCd']??''));$identityKey=trim((string)($salaryIdentityRow['recurringKey']??''));
                if($identityKey===''&&$identityShCd!=='')$identityKey='salary:'.$identityShCd.':'.$month;
                if($identityCd!=='')$salaryIdentityByCd[$identityCd]=['shCd'=>$identityShCd,'key'=>$identityKey];
            }
            foreach($sharetx as &$tx){
                if(!is_array($tx)||(string)($tx['type']??'')!=='salary'||(string)($tx['month']??'')!==$month)continue;$key=trim((string)($tx['recurringKey']??''));$shCd=trim((string)($tx['shCd']??''));if($key===''&&$shCd!=='')$key='salary:'.$shCd.':'.$month;
                if($scopeShareholder!==''&&$shCd!==$scopeShareholder)continue;if($key!==''&&isset($eligibleSalaryKeys[$key]))continue;if(!sd_active($tx))continue;
                $before=$tx;if($key!=='')$tx['recurringKey']=$key;sd_recurring_void($tx,'عدم احراز حقوق پس از اقدام صریح — '.$explicitReason,$user,'eligibility');$voided++;$corrections[]=['_id'=>sd_uuid('COR'),'entityType'=>'shareholder_salary','entityId'=>$tx['cd']??'','kind'=>'eligibility_void','beforeSnapshot'=>$before,'afterSnapshot'=>$tx,'reason'=>$explicitReason,'correctedBy'=>$user,'correctedAt'=>$now];
            }unset($tx);
            foreach($opex as &$ox){
                if(!is_array($ox)||empty($ox['shareholderSalary'])||(string)($ox['month']??'')!==$month)continue;$key=trim((string)($ox['recurringKey']??''));$shCd='';if(preg_match('/^salary:(.+):'.preg_quote($month,'/').'$/',$key,$m))$shCd=$m[1];
                $shareTxCd=trim((string)($ox['shareTx']??''));if($shareTxCd!==''&&isset($salaryIdentityByCd[$shareTxCd])){$legacyIdentity=$salaryIdentityByCd[$shareTxCd];if($shCd==='')$shCd=(string)$legacyIdentity['shCd'];if($key==='')$key=(string)$legacyIdentity['key'];}
                if($scopeShareholder!==''&&$shCd!==$scopeShareholder)continue;if($key!==''&&isset($eligibleSalaryKeys[$key]))continue;
                if(sd_active($ox)){$before=$ox;if($key!=='')$ox['recurringKey']=$key;sd_recurring_void($ox,'عدم احراز هزینه حقوق پس از اقدام صریح — '.$explicitReason,$user,'eligibility');$voided++;$corrections[]=['_id'=>sd_uuid('COR'),'entityType'=>'opex','entityId'=>$ox['_opexRowId']??$ox['cd']??'','kind'=>'eligibility_void','beforeSnapshot'=>$before,'afterSnapshot'=>$ox,'reason'=>$explicitReason,'correctedBy'=>$user,'correctedAt'=>$now];}$projectionRows[]=$ox;
            }unset($ox);
        }

        /* Template materialization reads only the server settings snapshot. Invalid or
           absent templates are reported, never interpreted as permission to delete. */
        if($includeTemplates)foreach($templates as $tpl){
            if(!is_array($tpl)){$invalidTemplates++;continue;}$tplId=sd_text($tpl['id']??'',160);$amount=sd_num($tpl['amt']??0);$cat=sd_text($tpl['cat']??'',160);if($tplId===''||$amount<=0||$cat===''){$invalidTemplates++;continue;}
            if($scopeTemplate!==''&&$tplId!==$scopeTemplate)continue;$matchedTemplates++;
            $key='opex-template:'.$tplId.':'.$month;$restore=sd_recurring_restore_requested($key,$restoreKeys);$hits=sd_recurring_find_indexes($opex,$key,['tplId'=>$tplId,'month'=>$month]);$hasExplicit=false;foreach($hits as $i)if(sd_recurring_explicit_tombstone($opex[$i]))$hasExplicit=true;
            if($hasExplicit&&!$restore){$suppressed++;foreach($hits as $i)$projectionRows[]=$opex[$i];continue;}
            $cd=sd_stable_recurring_code('OPX-TPL',$key);$rowId=sd_stable_recurring_code('OPXR-TPL',$key);$index=sd_recurring_pick_index($opex,$hits,$restore);$wasExplicit=$restore&&$index>=0&&sd_recurring_explicit_tombstone($opex[$index]);
            if($index<0){
                $opex[]=['cd'=>$cd,'_opexRowId'=>$rowId,'cat'=>$cat,'amt'=>$amount,'desc'=>sd_text($tpl['desc']??'',500),'month'=>$month,'tplId'=>$tplId,'recurringKey'=>$key,'isOfficial'=>!empty($tpl['isOfficial']),'autoApplied'=>true,'serverReconciled'=>true,'serverMaterialized'=>true,'status'=>'active','t'=>$month.'/01','createdAt'=>$now,'createdBy'=>$user];$index=count($opex)-1;$created++;
            }else{
                $beforeSnapshot=$opex[$index];$before=json_encode($beforeSnapshot);$legacyCd=trim((string)($opex[$index]['cd']??''));$legacyRow=trim((string)($opex[$index]['_opexRowId']??''));$opex[$index]['cd']=$legacyCd!==''?$legacyCd:$cd;$opex[$index]['_opexRowId']=$legacyRow!==''?$legacyRow:$rowId;$opex[$index]['cat']=$cat;$opex[$index]['amt']=$amount;$opex[$index]['desc']=sd_text($tpl['desc']??'',500);$opex[$index]['month']=$month;$opex[$index]['tplId']=$tplId;$opex[$index]['recurringKey']=$key;$opex[$index]['isOfficial']=!empty($tpl['isOfficial']);$opex[$index]['autoApplied']=true;$opex[$index]['serverReconciled']=true;$opex[$index]['serverMaterialized']=true;sd_recurring_activate($opex[$index]);if($wasExplicit){$opex[$index]['restoreIntent']='explicit';$opex[$index]['restoredAt']=$now;$opex[$index]['restoredBy']=$user;}
                if(json_encode($opex[$index])!==$before){$opex[$index]['updatedAtISO']=$now;$opex[$index]['updatedBy']=$user;$updated++;}
                if($wasExplicit)$corrections[]=['_id'=>sd_uuid('COR'),'entityType'=>'opex','entityId'=>$opex[$index]['_opexRowId']??$opex[$index]['cd'],'kind'=>'explicit_restore','beforeSnapshot'=>$beforeSnapshot,'afterSnapshot'=>$opex[$index],'reason'=>$explicitReason,'correctedBy'=>$user,'correctedAt'=>$now];
            }
            $projectionRows[]=$opex[$index];if(count($hits)>1)$conflicts++;
            if($explicitTemplate)foreach($hits as $dup)if($dup!==$index){
                if(sd_active($opex[$dup])||($restore&&sd_recurring_explicit_tombstone($opex[$dup]))){
                    $duplicateBefore=$opex[$dup];sd_recurring_void($opex[$dup],'رکورد تکراری قالب — '.$explicitReason,$user,'eligibility');$voided++;
                    $corrections[]=['_id'=>sd_uuid('COR'),'entityType'=>'opex','entityId'=>$opex[$dup]['_opexRowId']??$opex[$dup]['cd']??'','kind'=>'duplicate_recurring_void','beforeSnapshot'=>$duplicateBefore,'afterSnapshot'=>$opex[$dup],'reason'=>$explicitReason,'correctedBy'=>$user,'correctedAt'=>$now];
                }
                $projectionRows[]=$opex[$dup];
            }
        }
        if($explicitTemplate&&$scopeTemplate!==''&&$matchedTemplates===0)sd_out(['ok'=>false,'error'=>'opex_template_not_found','templateId'=>$scopeTemplate],404);
        sd_ensure_recurring_opex_row_identities($opex);
        $changes=['ptf_crm_sharetx'=>$sharetx,'ptf_crm_opex'=>$opex];if(count($corrections)>$correctionStart)$changes['ptf_crm_corrections']=$corrections;$responseChanges=['ptf_crm_opex'=>[]];if(sd_recurring_sharetx_projection_allowed($action))$responseChanges['ptf_crm_sharetx']=[];
        $result=['month'=>$month,'created'=>$created,'updated'=>$updated,'voided'=>$voided,'conflicts'=>$conflicts,'suppressedTombstones'=>$suppressed,'invalidTemplates'=>$invalidTemplates,'includedSalaries'=>$includeSalaries,'includedTemplates'=>$includeTemplates,'scopeTemplate'=>$scopeTemplate,'mode'=>'server-authoritative-upsert','projectionMode'=>'merge-v1','projectionIdentities'=>sd_opex_projection_identities($projectionRows)];
    }
    elseif ($action === 'schedule_recurring_opex_cheque') {
        /* Explicit future-month scheduling keeps cheque UX, but materialization is still
           server-owned. The request names templates/months only; amounts/categories are
           read from the committed server settings snapshot under this transaction lock. */
        sd_require_role(SD_FIN_ROLES);
        $chequeCd=sd_text($body['chequeCd']??'',160);$items=is_array($body['items']??null)?$body['items']:[];$reason=sd_text($body['reason']??'',500);
        if($chequeCd===''||!$items||count($items)>24)sd_out(['ok'=>false,'error'=>'invalid_recurring_cheque_schedule'],422);
        if($reason==='')sd_out(['ok'=>false,'error'=>'reason_required'],422);
        $issued=sd_read('ptf_crm_cheques_issued');$cheque=null;$chequeIndex=-1;
        foreach($issued as $candidateIndex=>$candidate)if(is_array($candidate)&&(string)($candidate['cd']??'')===$chequeCd&&sd_active($candidate)){$cheque=$candidate;$chequeIndex=(int)$candidateIndex;break;}
        if(!$cheque||$chequeIndex<0)sd_out(['ok'=>false,'error'=>'cheque_not_committed'],409);
        $settings=sd_read('ptf_crm_settings');$templates=is_array($settings['opexTpl']??null)?$settings['opexTpl']:[];$templateById=[];
        foreach($templates as $tpl)if(is_array($tpl)){ $tid=sd_text($tpl['id']??'',160);if($tid!==''&&!isset($templateById[$tid]))$templateById[$tid]=$tpl; }
        $plans=[];$seenKeys=[];$opex=sd_read('ptf_crm_opex');sd_ensure_recurring_opex_row_identities($opex);
        /* Validate the whole schedule before mutating anything: no partial cheque plan. */
        foreach($items as $item){
            if(!is_array($item))sd_out(['ok'=>false,'error'=>'invalid_recurring_cheque_item'],422);
            $tplId=sd_text($item['tplId']??'',160);$month=sd_text($item['month']??'',20);
            if($tplId===''||!isset($templateById[$tplId])||!preg_match('/^(13|14)\d{2}\/(0[1-9]|1[0-2])$/',$month))sd_out(['ok'=>false,'error'=>'invalid_recurring_cheque_item'],422);
            if(sd_is_locked($snaps,$month))sd_out(['ok'=>false,'error'=>'fiscal_period_locked','year'=>sd_year($month)],409);
            $tpl=$templateById[$tplId];$amount=sd_num($tpl['amt']??0);$cat=sd_text($tpl['cat']??'',160);
            if($amount<=0||$cat==='')sd_out(['ok'=>false,'error'=>'invalid_opex_template','templateId'=>$tplId],422);
            $key='opex-template:'.$tplId.':'.$month;if(isset($seenKeys[$key]))continue;$seenKeys[$key]=true;
            $hits=sd_recurring_find_indexes($opex,$key,['tplId'=>$tplId,'month'=>$month]);
            foreach($hits as $hit){
                $linked=trim((string)($opex[$hit]['chequeCd']??''));
                if($linked!==''&&$linked!==$chequeCd)sd_out(['ok'=>false,'error'=>'opex_already_linked_to_cheque','recurringKey'=>$key,'chequeCd'=>$linked],409);
                if(!sd_active($opex[$hit]))continue;
                if(strtolower(trim((string)($opex[$hit]['st']??'')))==='settled'&&$linked!==$chequeCd)sd_out(['ok'=>false,'error'=>'opex_already_settled','recurringKey'=>$key],409);
            }
            $plans[]=['tplId'=>$tplId,'month'=>$month,'key'=>$key,'tpl'=>$tpl,'hits'=>$hits];
        }
        if(!$plans)sd_out(['ok'=>false,'error'=>'empty_recurring_cheque_schedule'],422);
        $now=sd_now();$created=0;$updated=0;$restored=0;$voided=0;$projectionRows=[];$rowIds=[];$correctionStart=count($corrections);
        foreach($plans as $plan){
            $tplId=$plan['tplId'];$month=$plan['month'];$key=$plan['key'];$tpl=$plan['tpl'];$hits=$plan['hits'];$amount=sd_num($tpl['amt']);$cat=sd_text($tpl['cat'],160);
            $cd=sd_stable_recurring_code('OPX-TPL',$key);$rowId=sd_stable_recurring_code('OPXR-TPL',$key);$index=sd_recurring_pick_index($opex,$hits,true);$before=$index>=0?$opex[$index]:null;$wasExplicit=$index>=0&&sd_recurring_explicit_tombstone($opex[$index]);
            if($index<0){
                $opex[]=['cd'=>$cd,'_opexRowId'=>$rowId,'cat'=>$cat,'amt'=>$amount,'desc'=>sd_text($tpl['desc']??'',500),'month'=>$month,'tplId'=>$tplId,'recurringKey'=>$key,'isOfficial'=>!empty($tpl['isOfficial']),'autoApplied'=>true,'serverReconciled'=>true,'serverMaterialized'=>true,'status'=>'active','t'=>$month.'/01','createdAt'=>$now,'createdBy'=>$user];$index=count($opex)-1;$created++;
            }else{
                $beforeJson=json_encode($opex[$index]);$legacyCd=trim((string)($opex[$index]['cd']??''));$legacyRow=trim((string)($opex[$index]['_opexRowId']??''));$opex[$index]['cd']=$legacyCd!==''?$legacyCd:$cd;$opex[$index]['_opexRowId']=$legacyRow!==''?$legacyRow:$rowId;$opex[$index]['cat']=$cat;$opex[$index]['amt']=$amount;$opex[$index]['desc']=sd_text($tpl['desc']??'',500);$opex[$index]['month']=$month;$opex[$index]['tplId']=$tplId;$opex[$index]['recurringKey']=$key;$opex[$index]['isOfficial']=!empty($tpl['isOfficial']);$opex[$index]['autoApplied']=true;$opex[$index]['serverReconciled']=true;$opex[$index]['serverMaterialized']=true;sd_recurring_activate($opex[$index]);if(json_encode($opex[$index])!==$beforeJson){$opex[$index]['updatedAtISO']=$now;$opex[$index]['updatedBy']=$user;$updated++;}
            }
            $opex[$index]['chequeCd']=$chequeCd;$opex[$index]['payHow']='cheque';$opex[$index]['fromCheque']=true;
            if($wasExplicit){$opex[$index]['restoreIntent']='explicit';$opex[$index]['restoredAt']=$now;$opex[$index]['restoredBy']=$user;$restored++;$corrections[]=['_id'=>sd_uuid('COR'),'entityType'=>'opex','entityId'=>$opex[$index]['_opexRowId'],'kind'=>'explicit_restore_for_cheque','beforeSnapshot'=>$before,'afterSnapshot'=>$opex[$index],'reason'=>$reason,'correctedBy'=>$user,'correctedAt'=>$now];}
            $projectionRows[]=$opex[$index];$rowIds[]=$opex[$index]['_opexRowId'];
            foreach($hits as $dup)if($dup!==$index){if(sd_active($opex[$dup])||sd_recurring_explicit_tombstone($opex[$dup])){$dupBefore=$opex[$dup];sd_recurring_void($opex[$dup],'رکورد تکراری در زمان برنامه‌ریزی چک — '.$reason,$user,'eligibility');$voided++;$corrections[]=['_id'=>sd_uuid('COR'),'entityType'=>'opex','entityId'=>$opex[$dup]['_opexRowId']??$opex[$dup]['cd']??'','kind'=>'duplicate_recurring_void','beforeSnapshot'=>$dupBefore,'afterSnapshot'=>$opex[$dup],'reason'=>$reason,'correctedBy'=>$user,'correctedAt'=>$now];}$projectionRows[]=$opex[$dup];}
        }
        /* The cheque-side identity list is committed with the OPEX rows. Client UI also
           mirrors these IDs after ACK, but a lost response can never leave the server
           with half of the relationship. */
        $existingChequeRows=is_array($issued[$chequeIndex]['opexRowIds']??null)?$issued[$chequeIndex]['opexRowIds']:[];
        $issued[$chequeIndex]['opexRowIds']=array_values(array_unique(array_filter(array_merge($existingChequeRows,$rowIds),function($id){return trim((string)$id)!=='';})));
        $issued[$chequeIndex]['pendingRecurringOpexItems']=[];$issued[$chequeIndex]['recurringOpexScheduleStatus']='acked';$issued[$chequeIndex]['updatedAtISO']=$now;$issued[$chequeIndex]['updatedBy']=$user;
        sd_ensure_recurring_opex_row_identities($opex);
        $changes=['ptf_crm_opex'=>$opex,'ptf_crm_cheques_issued'=>$issued];if(count($corrections)>$correctionStart)$changes['ptf_crm_corrections']=$corrections;$responseChanges=['ptf_crm_opex'=>[]];
        $result=['chequeCd'=>$chequeCd,'rowIds'=>$rowIds,'created'=>$created,'updated'=>$updated,'restored'=>$restored,'voided'=>$voided,'projectionMode'=>'merge-v1','projectionIdentities'=>sd_opex_projection_identities($projectionRows)];
    }
    elseif ($action === 'void_recurring_opex') {
        sd_require_role(SD_FIN_ROLES);$opex=sd_read('ptf_crm_opex');sd_ensure_recurring_opex_row_identities($opex);$sharetx=sd_read('ptf_crm_sharetx');$rowId=sd_text($body['_opexRowId']??'',160);$recurringKey=sd_text($body['recurringKey']??'',220);$cd=sd_text($body['cd']??'',160);$reason=sd_text($body['reason']??'',500);
        if($reason==='')sd_out(['ok'=>false,'error'=>'reason_required'],422);$rowHits=[];$keyHits=[];$cdHits=[];
        foreach($opex as $i=>$row){if(!is_array($row))continue;if($rowId!==''&&(string)($row['_opexRowId']??'')===$rowId)$rowHits[]=(int)$i;if($recurringKey!==''&&(string)($row['recurringKey']??'')===$recurringKey)$keyHits[]=(int)$i;if($cd!==''&&(string)($row['cd']??'')===$cd)$cdHits[]=(int)$i;}
        /* A browser may have backfilled _opexRowId locally before v34.8.5; generic sync
           now correctly refuses to author recurring identity fields. Fall back to the
           submitted recurringKey and allow all of its duplicates, because this command
           explicitly voids the domain identity rather than one physical array row. */
        if($rowHits){$rowTarget=$opex[$rowHits[0]];$rowKey=trim((string)($rowTarget['recurringKey']??''));$rowCd=trim((string)($rowTarget['cd']??''));if($recurringKey!==''&&$rowKey!==''&&!hash_equals($rowKey,$recurringKey))sd_out(['ok'=>false,'error'=>'opex_identity_mismatch'],409);if($cd!==''&&$rowCd!==''&&!hash_equals($rowCd,$cd))sd_out(['ok'=>false,'error'=>'opex_identity_mismatch'],409);}
        $hits=$keyHits?:($rowHits?:$cdHits);if(!$hits)sd_out(['ok'=>false,'error'=>'opex_not_found'],404);$index=$hits[0];$target=$opex[$index];$targetKey=trim((string)($target['recurringKey']??''));if($targetKey!=='')$recurringKey=$targetKey;
        if($recurringKey==='')sd_out(['ok'=>false,'error'=>'recurring_identity_required'],422);$hits=sd_recurring_find_indexes($opex,$recurringKey,[]);if(!$hits)sd_out(['ok'=>false,'error'=>'opex_not_found'],404);foreach($hits as $lockedHit)if(sd_is_locked($snaps,(string)($opex[$lockedHit]['month']??$opex[$lockedHit]['t']??'')))sd_out(['ok'=>false,'error'=>'fiscal_period_locked'],409);
        /* Explicit deletion applies to the recurring domain identity, not just one
           duplicate row. Otherwise an active sibling could keep the deleted expense
           visible while its tombstone suppresses future reconciliation. */
        $projectionRows=[];$voidedRows=0;
        foreach($opex as &$ox){
            if(!is_array($ox)||(string)($ox['recurringKey']??'')!==$recurringKey)continue;
            if(sd_active($ox)||!sd_recurring_explicit_tombstone($ox)){
                $before=$ox;sd_recurring_void($ox,$reason,$user,'explicit');$voidedRows++;
                $corrections[]=['_id'=>sd_uuid('COR'),'entityType'=>'opex','entityId'=>$ox['_opexRowId']??$ox['cd']??'','kind'=>'explicit_void','beforeSnapshot'=>$before,'afterSnapshot'=>$ox,'reason'=>$reason,'correctedBy'=>$user,'correctedAt'=>sd_now()];
            }
            $projectionRows[]=$ox;
        }unset($ox);
        foreach($sharetx as &$tx){
            if(!is_array($tx)||(string)($tx['recurringKey']??'')!==$recurringKey)continue;
            if(sd_active($tx)||!sd_recurring_explicit_tombstone($tx)){
                $before=$tx;sd_recurring_void($tx,$reason,$user,'explicit');
                $corrections[]=['_id'=>sd_uuid('COR'),'entityType'=>'shareholder_salary','entityId'=>$tx['cd']??'','kind'=>'explicit_void','beforeSnapshot'=>$before,'afterSnapshot'=>$tx,'reason'=>$reason,'correctedBy'=>$user,'correctedAt'=>sd_now()];
            }
        }unset($tx);
        $changes=['ptf_crm_opex'=>$opex,'ptf_crm_sharetx'=>$sharetx,'ptf_crm_corrections'=>$corrections];$responseChanges=['ptf_crm_opex'=>[]];if(sd_recurring_sharetx_projection_allowed($action))$responseChanges['ptf_crm_sharetx']=[];$result=['voided'=>true,'voidedRows'=>$voidedRows,'recurringKey'=>$recurringKey,'projectionMode'=>'merge-v1','projectionIdentities'=>sd_opex_projection_identities($projectionRows)];
    }
    elseif ($action === 'post_receipt') {
        sd_require_role(SD_FIN_ROLES);
        $caseId=sd_text($body['caseId']??'',100);$ci=sd_find_case_index($cases,$caseId);if($ci<0)sd_out(['ok'=>false,'error'=>'case_not_found'],404);
        $case=$cases[$ci];$caseHadServerId=!empty($case['_id']);sd_case_id($case);$caseId=$case['_id'];
        /* پرونده legacy بدون buyerCd نباید Receipt بی‌مالک بسازد. customers فقط زیر همین
           lock و برای resolve داخلی خوانده می‌شود و وارد snapshot عمومی سرویس نمی‌شود. */
        $customers=sd_read('ptf_crm_customers');
        $caseOwner=sd_resolve_case_customer($case,$cases,$offers,$invoices,$receipts,$customers);
        if(($caseOwner['status']??'')!=='resolved'||trim((string)($caseOwner['customerId']??''))==='')sd_out(['ok'=>false,'error'=>($caseOwner['status']??'')==='ambiguous'?'case_customer_ambiguous':'case_customer_unresolved','caseId'=>$caseId,'reason'=>$caseOwner['bound']??'','candidateCount'=>count($caseOwner['candidates']??[])],409);
        $resolvedCustomerId=(string)$caseOwner['customerId'];$caseChanged=!$caseHadServerId;
        if((string)($case['buyerCd']??'')!==$resolvedCustomerId){$case['buyerCd']=$resolvedCustomerId;$caseChanged=true;}
        if(trim((string)($case['buyerCo']??''))===''){foreach($customers as $customer)if(is_array($customer)&&sd_customer_record_id($customer)===$resolvedCustomerId){$case['buyerCo']=(string)($customer['co']??$customer['name']??'');$caseChanged=true;break;}}
        if($caseChanged){$case['customerResolvedBy']=$caseOwner['bound']??'';$case['customerResolvedAt']=sd_now();$case['updatedBy']=$user;$case['updatedAtISO']=sd_now();}
        $cases[$ci]=$case;
        $canonicalizedCaseLinks=sd_canonicalize_case_links($case,$caseId,$receipts,$invoices,$allocations);
        $amount=(int)round(sd_num($body['amountIRR']??0));if($amount<=0||$amount>9000000000000000)sd_out(['ok'=>false,'error'=>'invalid_amount'],422);
        $method=sd_text($body['method']??'',50);if($method==='')sd_out(['ok'=>false,'error'=>'method_required'],422);if(preg_match('/چک|cheque/i',$method))sd_out(['ok'=>false,'error'=>'cheque_requires_collection'],422);
        $receivedAt=sd_text($body['receivedAt']??sd_now(),40);if(sd_is_locked($snaps,$receivedAt))sd_out(['ok'=>false,'error'=>'fiscal_period_locked','year'=>sd_year($receivedAt)],409);
        $account=sd_text($body['destinationAccount']??'',150);if($account==='')sd_out(['ok'=>false,'error'=>'destination_account_required'],422);
        /* مطالبات فروش و تمام دریافت‌های آن فقط بر پایه مبلغ ریالی فاکتور ثبت می‌شوند.
           ارز پرونده متعلق به پیشنهاد/قرارداد است و نباید وارد سند وصول شود. */
        $hasInvoice=false;$receiptDateKey=sd_date_key($receivedAt);foreach($invoices as $inv)if(is_array($inv)&&sd_active($inv)&&(string)($inv['caseId']??'')===$caseId){$invDateKey=sd_date_key($inv['invDate']??$inv['issueDate']??'');if($receiptDateKey===''||$invDateKey===''||substr($receiptDateKey,0,2)!==substr($invDateKey,0,2)||$invDateKey<=$receiptDateKey){$hasInvoice=true;break;}}
        $receipt=['_id'=>sd_uuid('RCPT'),'cd'=>sd_uuid('RPAY'),'caseId'=>$caseId,'customerId'=>$resolvedCustomerId,'buyerCo'=>$case['buyerCo']??'','amountIRR'=>$amount,'amt'=>$amount,'receivedAt'=>$receivedAt,'dateISO'=>$receivedAt,'method'=>$method,'how'=>$method,'destinationAccount'=>$account,'referenceNo'=>sd_text($body['referenceNo']??'',120),'note'=>sd_text($body['note']??'',1000),'status'=>'posted','timing'=>$hasInvoice?'post_invoice':'pre_invoice','files'=>is_array($body['files']??null)?$body['files']:[],'createdBy'=>$user,'createdAt'=>sd_now()];
        array_unshift($receipts,$receipt);sd_rebuild_allocations($caseId,$receipts,$invoices,$allocations,$cases);
        $changes=['ptf_crm_case_receipts'=>$receipts,'ptf_crm_invoices'=>$invoices,'ptf_crm_receipt_allocations'=>$allocations];if($caseChanged)$changes['ptf_crm_deals']=$cases;
        $result=['receiptId'=>$receipt['_id'],'caseId'=>$caseId,'customerId'=>$resolvedCustomerId,'customerResolvedBy'=>$caseOwner['bound']??'','canonicalizedCaseLinks'=>$canonicalizedCaseLinks];
    }
    elseif ($action === 'correct_receipt' || $action === 'void_receipt') {
        sd_require_role(SD_FIN_ROLES);
        $rid=sd_text($body['receiptId']??'',100);$ri=-1;foreach($receipts as $i=>$r)if(is_array($r)&&((string)($r['_id']??'')===$rid||(string)($r['cd']??'')===$rid)){$ri=$i;break;}if($ri<0)sd_out(['ok'=>false,'error'=>'receipt_not_found'],404);
        $oldReceipt=$receipts[$ri];$reason=sd_text($body['reason']??'',500);if($reason==='')sd_out(['ok'=>false,'error'=>'reason_required'],422);if(sd_is_locked($snaps,(string)($oldReceipt['receivedAt']??'')))sd_out(['ok'=>false,'error'=>'fiscal_period_locked'],409);
        $corrections[]=['_id'=>sd_uuid('COR'),'entityType'=>'receipt','entityId'=>$oldReceipt['_id'],'kind'=>$action,'beforeSnapshot'=>$oldReceipt,'reason'=>$reason,'correctedBy'=>$user,'correctedAt'=>sd_now()];
        $oldReceipt['status']='void';$oldReceipt['voidedAt']=sd_now();$oldReceipt['voidedBy']=$user;$oldReceipt['voidReason']=$reason;$receipts[$ri]=$oldReceipt;
        if($action==='correct_receipt'){
            $new=$oldReceipt;$new['_id']=sd_uuid('RCPT');$new['cd']=sd_uuid('RPAY');$new['status']='posted';$new['correctsReceiptId']=$oldReceipt['_id'];unset($new['voidedAt'],$new['voidedBy'],$new['voidReason']);$new['amountIRR']=(int)round(sd_num($body['amountIRR']??$oldReceipt['amountIRR']));$new['amt']=$new['amountIRR'];$new['receivedAt']=sd_text($body['receivedAt']??$oldReceipt['receivedAt'],40);$new['method']=sd_text($body['method']??$oldReceipt['method'],50);$new['how']=$new['method'];$new['destinationAccount']=sd_text($body['destinationAccount']??$oldReceipt['destinationAccount'],150);if($new['amountIRR']<=0||$new['destinationAccount']==='')sd_out(['ok'=>false,'error'=>'invalid_correction'],422);/* اصلاح سند قدیمی نیز نسخه جایگزین را به مدل صرفاً ریالی ارتقا می‌دهد. */unset($new['currency'],$new['fxRate'],$new['fxRateSource'],$new['coveredFxAmount']);/* v34.7.18 (فاز ۲ / R7): انتقال بستانکاری به پروندهٔ دیگرِ همان مشتری از مسیر رسمی اصلاح
   (سند ابطال + سند جدید) انجام می‌شود؛ هیچ رکورد پولی جابه‌جا یا حذف نمی‌شود. */
            $targetCaseId=sd_text($body['caseId']??'',100);
            if($targetCaseId!==''&&$targetCaseId!==(string)$new['caseId']){$tci=sd_find_case_index($cases,$targetCaseId);if($tci<0)sd_out(['ok'=>false,'error'=>'target_case_not_found'],404);$tCase=$cases[$tci];sd_case_id($tCase);if((string)($tCase['buyerCd']??'')!==''&&(string)($oldReceipt['customerId']??'')!==''&&(string)($tCase['buyerCd']??'')!==(string)($oldReceipt['customerId']??''))sd_out(['ok'=>false,'error'=>'target_case_customer_mismatch'],422);$new['caseId']=(string)$tCase['_id'];$new['customerId']=$tCase['buyerCd']??$new['customerId'];$new['buyerCo']=$tCase['buyerCo']??$new['buyerCo'];$new['movedFromCaseId']=(string)$oldReceipt['caseId'];$result['movedToCaseId']=$new['caseId'];}
            $new['timing']='pre_invoice';$rdk=sd_date_key($new['receivedAt']);foreach($invoices as $iv)if(is_array($iv)&&sd_active($iv)&&(string)($iv['caseId']??'')===(string)$new['caseId']){$idk=sd_date_key($iv['invDate']??$iv['issueDate']??'');if($rdk===''||$idk===''||substr($rdk,0,2)!==substr($idk,0,2)||$idk<=$rdk){$new['timing']='post_invoice';break;}}array_unshift($receipts,$new);$result['replacementReceiptId']=$new['_id'];
        }
        sd_rebuild_allocations((string)$oldReceipt['caseId'],$receipts,$invoices,$allocations,$cases);
        if(!empty($result['movedToCaseId']))sd_rebuild_allocations((string)$result['movedToCaseId'],$receipts,$invoices,$allocations,$cases);
        $changes=['ptf_crm_case_receipts'=>$receipts,'ptf_crm_invoices'=>$invoices,'ptf_crm_receipt_allocations'=>$allocations,'ptf_crm_corrections'=>$corrections];$result['receiptId']=$oldReceipt['_id'];
    }
    elseif ($action === 'register_unofficial_invoice') {
        sd_require_role(SD_FIN_ROLES);
        $incoming=is_array($body['invoice']??null)?$body['invoice']:[];$caseId=sd_text($incoming['caseId']??'',100);$ci=sd_find_case_index($cases,$caseId);if($ci<0)sd_out(['ok'=>false,'error'=>'case_not_found'],404);$case=$cases[$ci];sd_case_id($case);$caseId=$case['_id'];$amount=(int)round(sd_num($incoming['amount']??0));if($amount<=0||$amount>9000000000000000)sd_out(['ok'=>false,'error'=>'invalid_amount'],422);$date=sd_text($incoming['invDate']??$incoming['t']??'',40);if($date===''||sd_is_locked($snaps,$date))sd_out(['ok'=>false,'error'=>$date===''?'issue_date_required':'fiscal_period_locked'],409);$cd=sd_text($incoming['cd']??'',120);if($cd==='')$cd=sd_uuid('UNINV');$idx=-1;foreach($invoices as $i=>$iv)if(is_array($iv)&&(string)($iv['cd']??'')===$cd){$idx=$i;break;}$record=$incoming;/* وصول فاکتور فقط از Receipt ریالی می‌آید؛ ردیف مصنوعی پیش‌پرداخت ورودی پذیرفته نمی‌شود. دریافت واقعی legacy برای ردپای مهاجرت حفظ می‌شود. */foreach(['payments','pays'] as $pk)if(is_array($record[$pk]??null))$record[$pk]=array_values(array_filter($record[$pk],function($p){return is_array($p)&&empty($p['fromAdvance'])&&!preg_match('/^RP-ADV-/i',(string)($p['cd']??''));}));unset($record['advApplied']);$record['_id']=$idx>=0?($invoices[$idx]['_id']??sd_uuid('INV')):($record['_id']??sd_uuid('INV'));$record['cd']=$cd;$record['caseId']=$caseId;$record['customerId']=$case['buyerCd']??'';$record['buyerCo']=$case['buyerCo']??($record['buyerCo']??'');$record['base']=(int)round(sd_num($record['base']??$amount));$record['vat']=0;$record['vatPercent']=0;$record['amount']=$amount;$record['isUnofficial']=true;$record['isOfficial']=false;$record['status']='active';$record['updatedAtISO']=sd_now();$record['updatedBy']=$user;if($idx>=0)$invoices[$idx]=$record;else array_unshift($invoices,$record);sd_rebuild_allocations($caseId,$receipts,$invoices,$allocations,$cases);$changes=['ptf_crm_invoices'=>$invoices,'ptf_crm_case_receipts'=>$receipts,'ptf_crm_receipt_allocations'=>$allocations];$result=['invoiceId'=>$record['_id'],'created'=>$idx<0,'unofficial'=>true];
    }
    elseif ($action === 'register_invoice' || $action === 'correct_invoice') {
        sd_require_role(SD_FIN_ROLES);
        $caseId=sd_text($body['caseId']??'',100);$ci=sd_find_case_index($cases,$caseId);if($ci<0)sd_out(['ok'=>false,'error'=>'case_not_found'],404);$case=$cases[$ci];sd_case_id($case);$caseId=$case['_id'];
        $invoiceId=sd_text($body['invoiceId']??'',100);$ii=-1;if($action==='correct_invoice')foreach($invoices as $i=>$inv)if(is_array($inv)&&((string)($inv['_id']??'')===$invoiceId||(string)($inv['cd']??'')===$invoiceId)){$ii=$i;break;}if($action==='correct_invoice'&&$ii<0)sd_out(['ok'=>false,'error'=>'invoice_not_found'],404);
        $replaceUnofficialId=sd_text($body['replacesUnofficialInvoiceId']??'',100);$replaceUnofficialIdx=-1;if($replaceUnofficialId!==''){foreach($invoices as $i=>$inv)if(is_array($inv)&&((string)($inv['_id']??'')===$replaceUnofficialId||(string)($inv['cd']??'')===$replaceUnofficialId)){$replaceUnofficialIdx=$i;break;}if($replaceUnofficialIdx<0||empty($invoices[$replaceUnofficialIdx]['isUnofficial'])||!sd_active($invoices[$replaceUnofficialIdx]))sd_out(['ok'=>false,'error'=>'invalid_unofficial_replacement'],422);foreach(array_merge($invoices[$replaceUnofficialIdx]['payments']??[],$invoices[$replaceUnofficialIdx]['pays']??[])as $lp){if(!is_array($lp)||!sd_active($lp)||!empty($lp['fromAdvance'])||sd_num($lp['amt']??$lp['amount']??0)<=0)continue;$lref=(string)($lp['cd']??'');$mapped=false;foreach($receipts as $rr)if(is_array($rr)&&$lref!==''&&(string)($rr['legacyPaymentRef']??'')===$lref){$mapped=true;break;}if(!$mapped)sd_out(['ok'=>false,'error'=>'unofficial_payments_require_review','paymentRef'=>$lref],409);}}
        $no=sd_text($body['invoiceNo']??'',120);$taxUid=sd_text($body['taxUid']??'',160);if($no===''||$taxUid==='')sd_out(['ok'=>false,'error'=>'invoice_no_and_tax_uid_required'],422);
        foreach($invoices as $i=>$inv)if(is_array($inv)&&$i!==$ii&&sd_active($inv)&&(sd_identity($inv['no']??'')===sd_identity($no)||sd_identity($inv['taxUid']??'')===sd_identity($taxUid)))sd_out(['ok'=>false,'error'=>'duplicate_invoice_identity'],409);
        $base=(int)round(sd_num($body['baseAmountIRR']??0));$pct=sd_num($body['vatPercent']??-1);if($base<=0||$base>9000000000000000||$pct<0||$pct>100)sd_out(['ok'=>false,'error'=>'invalid_invoice_amount_or_vat'],422);$vat=sd_vat($base,$pct);$total=$base+$vat;
        $invDate=sd_text($body['issueDate']??'',40);if($invDate===''||sd_is_locked($snaps,$invDate))sd_out(['ok'=>false,'error'=>$invDate===''?'issue_date_required':'fiscal_period_locked','year'=>sd_year($invDate)],409);
        $files=is_array($body['files']??null)?$body['files']:[];if($ii>=0&&(!$files))$files=is_array($invoices[$ii]['files']??null)?$invoices[$ii]['files']:[];foreach($files as &$f){if(!isset($f['_id']))$f['_id']=sd_uuid('ATT');$f['status']=$f['status']??'active';$f['version']=$f['version']??1;}unset($f);if(!sd_invoice_files_ok($files))sd_out(['ok'=>false,'error'=>'required_official_attachment_missing'],422);
        $offerNo=sd_text($body['offerNo']??($case['wonOffer']??''),100);
        $coverageMode=sd_text($body['coverageMode']??'amount',30);$coverage=is_array($body['coverage']??null)?$body['coverage']:[];
        if($coverageMode==='amount'){
            $first=$coverage[0]??[];if(!is_array($first)||trim((string)($first['note']??''))==='')sd_out(['ok'=>false,'error'=>'amount_coverage_note_required'],422);
        }elseif($coverageMode==='lines'){
            if(!$coverage)sd_out(['ok'=>false,'error'=>'line_coverage_required'],422);
            $allowedOffers=[];foreach(($case['linkedOffers']??[])as $l)if(is_array($l)){$allowedOffers[(string)($l['offerId']??'')]=true;$allowedOffers[(string)($l['offerNo']??'')]=true;}$allowedOffers[(string)($case['rootOfferId']??'')]=true;$allowedOffers[(string)($case['wonOffer']??'')]=true;
            $maxByLine=[];foreach($offers as $of){if(!is_array($of))continue;$oid=(string)($of['_id']??$of['no']??'');$ono=(string)($of['no']??'');if(empty($allowedOffers[$oid])&&empty($allowedOffers[$ono]))continue;foreach(($of['items']??[])as $idx=>$it)if(is_array($it)){$line=(string)($it['lineId']??$it['sourceItemKey']??$idx);$maxByLine[$oid.'|'.$line]=sd_num($it['qty']??0);$maxByLine[$ono.'|'.$line]=sd_num($it['qty']??0);}}
            $used=[];foreach($invoices as $idx=>$other){if($idx===$ii||$idx===$replaceUnofficialIdx||!is_array($other)||!sd_active($other)||(string)($other['caseId']??'')!==$caseId)continue;foreach(($other['coverage']??[])as $cv)if(is_array($cv)&&($cv['mode']??'')==='line')$used[(string)($cv['lineKey']??'')]=($used[(string)($cv['lineKey']??'')]??0)+sd_num($cv['qty']??0);}
            foreach($coverage as $cv){if(!is_array($cv)||($cv['mode']??'')!=='line')sd_out(['ok'=>false,'error'=>'invalid_line_coverage'],422);$key=(string)($cv['lineKey']??'');$qty=sd_num($cv['qty']??0);if($qty<=0||!array_key_exists($key,$maxByLine)||$qty+($used[$key]??0)>$maxByLine[$key]+0.00001)sd_out(['ok'=>false,'error'=>'invoice_line_over_coverage','lineKey'=>$key,'max'=>$maxByLine[$key]??0,'used'=>$used[$key]??0],422);}
        }else sd_out(['ok'=>false,'error'=>'invalid_coverage_mode'],422);
        $record=['_id'=>$ii>=0?($invoices[$ii]['_id']??sd_uuid('INV')):sd_uuid('INV'),'cd'=>$ii>=0?($invoices[$ii]['cd']??sd_uuid('INV')):sd_uuid('INV'),'caseId'=>$caseId,'customerId'=>$case['buyerCd']??'','buyerCo'=>$case['buyerCo']??'','offerNo'=>$offerNo,'rialBasisNo'=>sd_text($body['rialBasisNo']??'',100),'rialBasisRate'=>sd_num($body['rialBasisRate']??0),'rialBasisTotal'=>(int)round(sd_num($body['rialBasisTotal']??0)),'no'=>$no,'accountingInvoiceNo'=>$no,'taxUid'=>$taxUid,'modianReference'=>sd_text($body['modianReference']??'',160),'invDate'=>$invDate,'issueDate'=>$invDate,'base'=>$base,'baseAmountIRR'=>$base,'vatPercent'=>$pct,'vat'=>$vat,'vatAmountIRR'=>$vat,'amount'=>$total,'totalAmountIRR'=>$total,'coverageMode'=>$coverageMode,'coverage'=>$coverage,'replacesUnofficialInvoiceId'=>$replaceUnofficialId,'files'=>$files,'ocrOverrideReason'=>sd_text($body['ocrOverrideReason']??'',1000),'status'=>'active','isOfficial'=>true,'isUnofficial'=>false,'t'=>$ii>=0?($invoices[$ii]['t']??sd_now()):sd_now(),'by'=>$ii>=0?($invoices[$ii]['by']??$user):$user,'updatedAtISO'=>sd_now(),'updatedBy'=>$user];
        if($ii>=0){$reason=sd_text($body['reason']??'',500);if($reason==='')sd_out(['ok'=>false,'error'=>'reason_required'],422);$oldInv=$invoices[$ii];
            /* AR-02 (v34.7.19) — گارد مکمل: اصلاح فقط روی سند فعال. پیش از این، اصلاحِ یک فاکتور
               ابطال‌شده/جایگزین‌شده آن را بی‌صدا به active بازمی‌گرداند؛ با ادغام رکورد قبلی، این
               مسیر می‌توانست نشانه‌های چرخهٔ عمر (voidAt/supersededBy) را هم با خود بیاورد.
               UI هم دکمهٔ «اصلاح» را برای سند غیرفعال نشان نمی‌دهد؛ پس این گارد fail-closed است. */
            if(!sd_active($oldInv))sd_out(['ok'=>false,'error'=>'invoice_not_active','status'=>(string)($oldInv['status']??'')],409);
            /* AR-02 (v34.7.19): پیش از این، رکورد اصلاح‌شده از صفر ساخته می‌شد و هر فیلدی خارج از
               فهرست ثابت بالا بی‌صدا حذف می‌شد: pays (وصولی میراثی)، dueISO/dueFa (سررسید وصول)،
               contactReq/contactApproved (گردش دسترسی تماس)، offerCurrency/offerFxBasis/offerFxRateRef
               (فرادادهٔ ارزی) و advApplied. حذف pays یعنی پولِ ثبت‌شده از مانده ناپدید می‌شد.
               اکنون رکورد قبلی مبنا قرار می‌گیرد و فقط فیلدهای محاسبه‌شدهٔ همین فرمان بازنویسی می‌شوند.
               فیلدهای محاسباتی allocated و open بلافاصله با sd_rebuild_allocations بازتولید می‌شوند و اثری از رکورد کهنه نمی‌ماند.
               مرجع: ARENA-INDEPENDENT-VERIFICATION-AWARD-CHANGE-2026-08-17.md (N2) | گام A2 نقشهٔ فازبندی */
            $record=array_merge($oldInv,$record);
            $record['correctionVersion']=(int)($oldInv['correctionVersion']??0)+1;$record['payments']=$oldInv['payments']??[];$corrections[]=['_id'=>sd_uuid('COR'),'entityType'=>'official_invoice','entityId'=>$record['_id'],'kind'=>'data_entry_correction','beforeSnapshot'=>$oldInv,'afterSnapshot'=>$record,'reason'=>$reason,'correctedBy'=>$user,'correctedAt'=>sd_now()];$invoices[$ii]=$record;$result['corrected']=true;}
        else{array_unshift($invoices,$record);$result['created']=true;}
        if($replaceUnofficialIdx>=0){
            /* array_unshift moved the old index by one for a newly registered official invoice. */
            $actualIdx=$ii>=0?$replaceUnofficialIdx:$replaceUnofficialIdx+1;
            if(isset($invoices[$actualIdx])){$invoices[$actualIdx]['status']='superseded';$invoices[$actualIdx]['supersededAt']=sd_now();$invoices[$actualIdx]['supersededByInvoiceId']=$record['_id'];$result['supersededUnofficialInvoiceId']=$invoices[$actualIdx]['_id']??$invoices[$actualIdx]['cd']??'';}
        }
        foreach($files as $f){$exists=false;foreach($attachments as $a)if(is_array($a)&&(string)($a['_id']??'')===(string)$f['_id']){$exists=true;break;}if(!$exists)$attachments[]=['_id'=>$f['_id'],'ownerType'=>'official_invoice','ownerId'=>$record['_id'],'category'=>$f['category'],'version'=>$f['version'],'objectKey'=>$f['key'],'name'=>$f['name']??'','mimeType'=>$f['contentType']??'','size'=>$f['size']??0,'status'=>$f['status'],'uploadedBy'=>$user,'uploadedAt'=>sd_now()];}
        sd_rebuild_allocations($caseId,$receipts,$invoices,$allocations,$cases);$changes=['ptf_crm_invoices'=>$invoices,'ptf_crm_receipt_allocations'=>$allocations,'ptf_crm_case_receipts'=>$receipts,'ptf_crm_fin_attachments'=>$attachments,'ptf_crm_corrections'=>$corrections];$result['invoiceId']=$record['_id'];$result['vat']=$vat;$result['total']=$total;
    }
    elseif ($action === 'void_invoice') {
        sd_require_role(SD_FIN_ROLES);$id=sd_text($body['invoiceId']??'',100);$ii=-1;foreach($invoices as $i=>$inv)if(is_array($inv)&&((string)($inv['_id']??'')===$id||(string)($inv['cd']??'')===$id)){$ii=$i;break;}if($ii<0)sd_out(['ok'=>false,'error'=>'invoice_not_found'],404);$inv=$invoices[$ii];if(!sd_active($inv))sd_out(['ok'=>false,'error'=>'already_void'],409);if(sd_is_locked($snaps,(string)($inv['invDate']??'')))sd_out(['ok'=>false,'error'=>'fiscal_period_locked'],409);$reason=sd_text($body['reason']??'',500);if($reason==='')sd_out(['ok'=>false,'error'=>'reason_required'],422);$corrections[]=['_id'=>sd_uuid('COR'),'entityType'=>'official_invoice','entityId'=>$inv['_id'],'kind'=>'legal_void','beforeSnapshot'=>$inv,'reason'=>$reason,'correctedBy'=>$user,'correctedAt'=>sd_now()];$inv['status']='void';$inv['voidAt']=sd_now();$inv['voidBy']=$user;$inv['voidReason']=$reason;$invoices[$ii]=$inv;sd_rebuild_allocations((string)$inv['caseId'],$receipts,$invoices,$allocations,$cases);$changes=['ptf_crm_invoices'=>$invoices,'ptf_crm_receipt_allocations'=>$allocations,'ptf_crm_case_receipts'=>$receipts,'ptf_crm_corrections'=>$corrections];$result=['invoiceId'=>$inv['_id'],'voided'=>true];
    }
    elseif ($action === 'void_unofficial_invoice') {
        /* INV-01 (v34.7.23 / فاز E): ابطال سروری صورتحساب غیررسمی.
           تا پیش از این فقط مسیر محلی وجود داشت و چون تخصیص‌های سروری را نمی‌شناخت،
           هم اثر مالی واقعی نمی‌گذاشت و هم بستانکاری رسیدها را خراب می‌کرد (AR-01).
           این فرمان دقیقاً قرینهٔ void_invoice است اما مخصوص اسناد غیررسمی:
             • رسیدها هرگز حذف نمی‌شوند؛ فقط تخصیص با قواعد قطعی بازسازی می‌شود.
             • مبلغ آزادشده به‌صورت creditRemainIRR همان پرونده باقی می‌ماند.
             • سند حذف نمی‌شود؛ status=void با دلیل/کاربر/زمان و correction ثبت می‌گردد.
           مرجع: گزارش تلفیقی §۷.۲ | PLAN-REMAINING-FIXES-PHASED-2026-08-17.md (گام E1) */
        sd_require_role(SD_FIN_ROLES);
        $id = sd_text($body['invoiceId'] ?? '', 120);
        $ii = -1;
        foreach ($invoices as $i => $inv) if (is_array($inv) && ((string)($inv['_id'] ?? '') === $id || (string)($inv['cd'] ?? '') === $id)) { $ii = $i; break; }
        if ($ii < 0) sd_out(['ok'=>false,'error'=>'invoice_not_found'], 404);
        $inv = $invoices[$ii];
        if (empty($inv['isUnofficial'])) sd_out(['ok'=>false,'error'=>'official_invoice_requires_void_invoice'], 422);
        if (!sd_active($inv)) sd_out(['ok'=>false,'error'=>'already_void','status'=>(string)($inv['status'] ?? '')], 409);
        if (sd_is_locked($snaps, (string)($inv['invDate'] ?? $inv['t'] ?? ''))) sd_out(['ok'=>false,'error'=>'fiscal_period_locked','year'=>sd_year((string)($inv['invDate'] ?? $inv['t'] ?? ''))], 409);
        $reason = sd_text($body['reason'] ?? '', 500);
        if ($reason === '') sd_out(['ok'=>false,'error'=>'reason_required'], 422);
        $corrections[] = ['_id'=>sd_uuid('COR'),'entityType'=>'unofficial_invoice','entityId'=>$inv['_id'] ?? $inv['cd'] ?? '','kind'=>'void','beforeSnapshot'=>$inv,'reason'=>$reason,'correctedBy'=>$user,'correctedAt'=>sd_now()];
        $inv['status'] = 'void'; $inv['st'] = 'void'; $inv['voidAt'] = sd_now(); $inv['voidBy'] = $user; $inv['voidReason'] = $reason;
        $invoices[$ii] = $inv;
        $caseId = (string)($inv['caseId'] ?? '');
        if ($caseId !== '') sd_rebuild_allocations($caseId, $receipts, $invoices, $allocations, $cases);
        $freed = 0;
        foreach ($receipts as $r) if (is_array($r) && (string)($r['caseId'] ?? '') === $caseId && sd_active($r) && (string)($r['status'] ?? '') === 'posted') $freed += (int)($r['creditRemainIRR'] ?? 0);
        $changes = ['ptf_crm_invoices'=>$invoices,'ptf_crm_receipt_allocations'=>$allocations,'ptf_crm_case_receipts'=>$receipts,'ptf_crm_corrections'=>$corrections];
        $result = ['invoiceId'=>$inv['_id'] ?? $inv['cd'] ?? '','voided'=>true,'caseId'=>$caseId,'caseCreditIRR'=>$freed];
    }
    elseif ($action === 'invoice_attachment_add') {
        /* v34.7.80 (INV-ATTACH-LATER): افزودن سند فاکتور/مودیان پس از ثبت قطعی فاکتور رسمی.
           برخلاف replace_invoice_attachment (نیازمند attachmentId موجود)، این فرمان فقط append
           می‌کند — برای زمانی که حسابدار فاکتور را ثبت کرده و بعداً سند حسابداری یا سند
           سامانه مودیان را ضمیمه می‌کند. رکورد در files فاکتور و آینهٔ fin_attachments هر دو
           ثبت می‌شود و correction (بدون الزام reason) برای رد ممیزی نوشته می‌شود. */
        sd_require_role(SD_FIN_ROLES);
        $invoiceId = sd_text($body['invoiceId'] ?? '', 100);
        $ii = -1;
        foreach ($invoices as $i => $inv) if (is_array($inv) && ((string)($inv['_id'] ?? '') === $invoiceId || (string)($inv['cd'] ?? '') === $invoiceId)) { $ii = $i; break; }
        if ($ii < 0) sd_out(['ok' => false, 'error' => 'invoice_not_found'], 404);
        if (!sd_active($invoices[$ii])) sd_out(['ok' => false, 'error' => 'invoice_not_active', 'status' => (string)($invoices[$ii]['status'] ?? '')], 409);
        if (sd_is_locked($snaps, (string)($invoices[$ii]['invDate'] ?? $invoices[$ii]['issueDate'] ?? ''))) sd_out(['ok' => false, 'error' => 'fiscal_period_locked'], 409);
        $file = is_array($body['file'] ?? null) ? $body['file'] : [];
        if (!sd_file_ok($file)) sd_out(['ok' => false, 'error' => 'invalid_file'], 422);
        $cat = sd_text($body['category'] ?? 'accounting_official_invoice', 80);
        if (!in_array($cat, ['accounting_official_invoice', 'modian_tax_invoice', 'supporting_document'], true)) sd_out(['ok' => false, 'error' => 'invalid_category'], 422);
        $reason = sd_text($body['reason'] ?? '', 500);
        $file['_id'] = sd_uuid('ATT');
        $file['version'] = 1;
        $file['status'] = 'active';
        $file['category'] = $cat;
        $file['uploadedBy'] = $user;
        $file['uploadedAt'] = sd_now();
        if (!is_array($invoices[$ii]['files'] ?? null)) $invoices[$ii]['files'] = [];
        $invoices[$ii]['files'][] = $file;
        $ownerId = (string)($invoices[$ii]['_id'] ?? $invoiceId);
        $attachments[] = ['_id' => $file['_id'], 'ownerType' => 'official_invoice', 'ownerId' => $ownerId, 'category' => $cat, 'version' => 1, 'objectKey' => $file['key'], 'name' => $file['name'] ?? '', 'mimeType' => $file['contentType'] ?? '', 'size' => $file['size'] ?? 0, 'status' => 'active', 'uploadedBy' => $user, 'uploadedAt' => sd_now()];
        $corrections[] = ['_id' => sd_uuid('COR'), 'entityType' => 'financial_attachment', 'entityId' => $file['_id'], 'kind' => 'add', 'reason' => $reason, 'correctedBy' => $user, 'correctedAt' => sd_now(), 'ownerType' => 'official_invoice', 'ownerId' => $ownerId];
        $changes = ['ptf_crm_invoices' => $invoices, 'ptf_crm_fin_attachments' => $attachments, 'ptf_crm_corrections' => $corrections];
        $result = ['attachmentId' => $file['_id'], 'category' => $cat, 'invoiceId' => $ownerId];
    }
    elseif ($action === 'replace_invoice_attachment') {
        sd_require_role(SD_FIN_ROLES);$invoiceId=sd_text($body['invoiceId']??'',100);$oldId=sd_text($body['attachmentId']??'',100);$ii=-1;foreach($invoices as $i=>$inv)if(is_array($inv)&&((string)($inv['_id']??'')===$invoiceId||(string)($inv['cd']??'')===$invoiceId)){$ii=$i;break;}if($ii<0)sd_out(['ok'=>false,'error'=>'invoice_not_found'],404);$file=is_array($body['file']??null)?$body['file']:[];if(!sd_file_ok($file))sd_out(['ok'=>false,'error'=>'invalid_file'],422);$reason=sd_text($body['reason']??'',500);if($reason==='')sd_out(['ok'=>false,'error'=>'reason_required'],422);$found=false;$oldVersion=0;foreach(($invoices[$ii]['files']??[])as &$f)if((string)($f['_id']??'')===$oldId){$f['status']='replaced';$f['replacedAt']=sd_now();$f['replaceReason']=$reason;$oldVersion=(int)($f['version']??1);$found=true;break;}unset($f);if(!$found)sd_out(['ok'=>false,'error'=>'attachment_not_found'],404);$file['_id']=sd_uuid('ATT');$file['version']=$oldVersion+1;$file['status']='active';$file['replacesAttachmentId']=$oldId;$file['category']=$file['category']??'accounting_official_invoice';$invoices[$ii]['files'][]=$file;if(!sd_invoice_files_ok($invoices[$ii]['files']))sd_out(['ok'=>false,'error'=>'required_official_attachment_missing'],422);foreach($attachments as &$a)if((string)($a['_id']??'')===$oldId){$a['status']='replaced';$a['replacedAt']=sd_now();$a['replaceReason']=$reason;}unset($a);$attachments[]=['_id'=>$file['_id'],'ownerType'=>'official_invoice','ownerId'=>$invoices[$ii]['_id'],'category'=>$file['category'],'version'=>$file['version'],'objectKey'=>$file['key'],'name'=>$file['name']??'','mimeType'=>$file['contentType']??'','size'=>$file['size']??0,'status'=>'active','replacesAttachmentId'=>$oldId,'uploadedBy'=>$user,'uploadedAt'=>sd_now()];$corrections[]=['_id'=>sd_uuid('COR'),'entityType'=>'financial_attachment','entityId'=>$oldId,'kind'=>'replace','afterSnapshot'=>$file,'reason'=>$reason,'correctedBy'=>$user,'correctedAt'=>sd_now()];$changes=['ptf_crm_invoices'=>$invoices,'ptf_crm_fin_attachments'=>$attachments,'ptf_crm_corrections'=>$corrections];$result=['attachmentId'=>$file['_id'],'replaced'=>$oldId];
    }
    elseif ($action === 'migration_apply_safe') {
        sd_require_role(SD_ADMIN_ROLES);
        if (($body['confirm'] ?? '') !== 'PTF-SALES-V35-MIGRATE') sd_out(['ok'=>false,'error'=>'migration_confirmation_required'],422);
        /* Stable IDs are safe metadata; ambiguous business records are never merged. */
        foreach($offers as &$o)if(is_array($o))sd_offer_id($o);unset($o);
        foreach($cases as &$c)if(is_array($c))sd_case_id($c);unset($c);
        /* v34.7.31 (S3/F2-A — نشت بین‌مشتری): تطبیق فاکتور با پرونده هرگز نباید با مقدار تهی
           انجام شود. الگوی قبلی ''===''  را می‌پذیرفت، پس هر فاکتور بدون offerNo به اولین
           پروندهٔ بدون wonOffer (متعلق به هر مشتری دیگری) می‌چسبید و customerId آن روی رکورد
           نوشته می‌شد. علاوه بر گارد تهی، تطبیق باید یکتا باشد؛ در غیر این صورت انتساب انجام
           نمی‌شود و یک finding برای بررسی انسانی ثبت می‌گردد. */
        $ambiguousInvoiceBinds=[];
        foreach($invoices as &$i)if(is_array($i)){
            if(empty($i['_id']))$i['_id']=sd_uuid('INV');
            if(!empty($i['caseId']))continue;
            $offerNo=trim((string)($i['offerNo']??''));
            if($offerNo==='')continue;
            $matches=[];
            foreach($cases as $c){
                /* فقط پروندهٔ فعال می‌تواند صاحب فاکتور شود؛ پروندهٔ ابطال/حذف‌شده نه انتخاب
                   می‌شود و نه تطبیق را مبهم می‌کند (هم‌راستا با sd_bind_orphan_invoices). */
                if(!is_array($c)||!sd_active($c))continue;
                $caseNo=trim((string)($c['wonOffer']??''));if($caseNo==='')$caseNo=trim((string)($c['offerNo']??''));
                if($caseNo!==''&&$caseNo===$offerNo)$matches[]=$c;
            }
            if(count($matches)!==1){if($matches)$ambiguousInvoiceBinds[]=['invoiceId'=>(string)$i['_id'],'offerNo'=>$offerNo,'candidates'=>count($matches)];continue;}
            $c=$matches[0];
            $i['caseId']=$c['_id'];$i['customerId']=$c['buyerCd']??'';$i['buyerCo']=$i['buyerCo']??($c['buyerCo']??'');
        }unset($i);
        foreach($ambiguousInvoiceBinds as $amb)$findings[]=['_id'=>sd_uuid('FIND'),'ruleId'=>'invoice_case_bind_ambiguous','severity'=>'warning','evidence'=>$amb,'status'=>'open','createdAt'=>sd_now(),'modelVersion'=>'deterministic-v35'];
        $offerCount=[];foreach($offers as $o)if(is_array($o)&&!empty($o['no']))$offerCount[(string)$o['no']]=($offerCount[(string)$o['no']]??0)+1;
        $touched=[];$migrated=0;
        foreach($offers as &$o){if(!is_array($o))continue;$no=(string)($o['no']??'');if(($offerCount[$no]??0)!==1)continue;$matches=[];foreach($cases as $c)if(is_array($c)&&sd_active($c)&&sd_case_offer_linked($c,$o))$matches[]=$c;if(count($matches)!==1)continue;$case=$matches[0];$caseId=(string)$case['_id'];$pays=is_array($o['advance']['payments']??null)?$o['advance']['payments']:[];foreach($pays as $p){if(!is_array($p))continue;$amt=(int)round(sd_num($p['amt']??0));$method=(string)($p['how']??'');if($amt<=0||preg_match('/چک|cheque/i',$method))continue;$legacyRef=(string)($p['cd']??'');$exists=false;foreach($receipts as $r)if(is_array($r)&&$legacyRef!==''&&(string)($r['legacyPaymentRef']??'')===$legacyRef){$exists=true;break;}if($exists)continue;$hasInvoice=false;foreach($invoices as $inv)if(is_array($inv)&&sd_active($inv)&&(string)($inv['caseId']??'')===$caseId){$hasInvoice=true;break;}$receipts[]=['_id'=>sd_uuid('RCPT'),'cd'=>sd_uuid('RPAY'),'caseId'=>$caseId,'customerId'=>$case['buyerCd']??$o['buyerCd']??'','buyerCo'=>$case['buyerCo']??$o['buyerCo']??'','amountIRR'=>$amt,'amt'=>$amt,'receivedAt'=>$p['t']??$o['advance']['t']??sd_now(),'dateISO'=>$p['t']??'','method'=>$method?:'legacy_confirmed','how'=>$method?:'legacy_confirmed','destinationAccount'=>'legacy-migration','referenceNo'=>$legacyRef,'note'=>'مهاجرت وصول واقعی payments[]؛ paid/cashFull بدون رویداد منتقل نشده است','status'=>'posted','timing'=>$hasInvoice?'post_invoice':'pre_invoice','legacyPaymentRef'=>$legacyRef,'migratedAt'=>sd_now(),'createdBy'=>$user,'createdAt'=>sd_now()];$touched[$caseId]=true;$migrated++;}if(isset($o['advance'])&&is_array($o['advance']))$o['advance']['migrationV35']=['at'=>sd_now(),'actualPaymentsMigrated'=>$migrated,'inferredCashIgnored'=>empty($pays)&&(!empty($o['advance']['cashFull'])||!empty($o['advance']['paid']))];}unset($o);
        /* Real legacy invoice payments are migrated as case receipts; synthetic
           fromAdvance and cheques are deliberately excluded. */
        foreach($invoices as &$legacyInv){if(!is_array($legacyInv))continue;$legacyCaseId=(string)($legacyInv['caseId']??'');$legacyCase=null;if($legacyCaseId!==''){foreach($cases as $c)if(is_array($c)&&sd_case_match($c,$legacyCaseId)){$legacyCase=$c;break;}}if(!$legacyCase){$hits=[];foreach($cases as $c)if(is_array($c)&&sd_active($c)&&((string)($c['wonOffer']??'')===(string)($legacyInv['offerNo']??'')||(string)($c['offerNo']??'')===(string)($legacyInv['offerNo']??'')))$hits[]=$c;if(count($hits)===1){$legacyCase=$hits[0];$legacyCaseId=(string)($legacyCase['_id']??$legacyCase['cd']??'');$legacyInv['caseId']=$legacyCaseId;}}if(!$legacyCase||$legacyCaseId==='')continue;foreach(array_merge($legacyInv['payments']??[],$legacyInv['pays']??[])as $p){if(!is_array($p)||!sd_active($p)||!empty($p['fromAdvance'])||sd_num($p['amt']??$p['amount']??0)<=0||preg_match('/چک|cheque/i',(string)($p['how']??'')))continue;$ref=(string)($p['cd']??'');$exists=false;foreach($receipts as $r)if(is_array($r)&&$ref!==''&&(string)($r['legacyPaymentRef']??'')===$ref){$exists=true;break;}if($exists)continue;$amt=(int)round(sd_num($p['amt']??$p['amount']??0));$receipts[]=['_id'=>sd_uuid('RCPT'),'cd'=>sd_uuid('RPAY'),'caseId'=>$legacyCaseId,'customerId'=>$legacyCase['buyerCd']??'','buyerCo'=>$legacyCase['buyerCo']??$legacyInv['buyerCo']??'','amountIRR'=>$amt,'amt'=>$amt,'receivedAt'=>$p['t']??$legacyInv['invDate']??sd_now(),'method'=>$p['how']??'legacy_confirmed','how'=>$p['how']??'legacy_confirmed','destinationAccount'=>'legacy-migration','referenceNo'=>$ref,'note'=>'مهاجرت وصول واقعی فاکتور legacy','status'=>'posted','timing'=>'post_invoice','legacyPaymentRef'=>$ref,'migratedAt'=>sd_now(),'createdBy'=>$user,'createdAt'=>sd_now()];$newReceiptId=$receipts[count($receipts)-1]['_id'];foreach(['payments','pays']as $pk)if(isset($legacyInv[$pk])&&is_array($legacyInv[$pk]))foreach($legacyInv[$pk]as &$origPay)if(is_array($origPay)&&(string)($origPay['cd']??'')===$ref){$origPay['migratedToReceiptId']=$newReceiptId;$origPay['financialProjectionDisabled']=true;}unset($origPay);$touched[$legacyCaseId]=true;$migrated++;}}unset($legacyInv);
        foreach(array_keys($touched) as $tc)sd_rebuild_allocations($tc,$receipts,$invoices,$allocations,$cases);
        $report=sd_migration_report();foreach($report['issues'] as $issue)$findings[]=['_id'=>sd_uuid('FIND'),'ruleId'=>$issue['type'],'severity'=>$issue['severity'],'evidence'=>$issue,'status'=>'open','createdAt'=>sd_now(),'modelVersion'=>'deterministic-v35'];
        $corrections[]=['_id'=>sd_uuid('COR'),'entityType'=>'migration','entityId'=>'sales-v35','kind'=>'safe_migration','reason'=>'انتقال فقط payments[] واقعی و بدون حدس','correctedBy'=>$user,'correctedAt'=>sd_now(),'migratedReceipts'=>$migrated];
        $changes=['ptf_crm_offers'=>$offers,'ptf_crm_deals'=>$cases,'ptf_crm_invoices'=>$invoices,'ptf_crm_case_receipts'=>$receipts,'ptf_crm_receipt_allocations'=>$allocations,'ptf_crm_fin_findings'=>$findings,'ptf_crm_corrections'=>$corrections];$result=['migratedReceipts'=>$migrated,'touchedCases'=>count($touched),'ambiguousIssues'=>count($report['issues'])];
    }
    elseif ($action === 'attachment_add' || $action === 'attachment_replace' || $action === 'attachment_delete') {
        sd_require_role(SD_FIN_ROLES);$ownerType=sd_text($body['ownerType']??'',60);$ownerId=sd_text($body['ownerId']??'',100);if($ownerType===''||$ownerId==='')sd_out(['ok'=>false,'error'=>'owner_required'],422);$reason=sd_text($body['reason']??'',500);
        if($action==='attachment_add'){$file=is_array($body['file']??null)?$body['file']:[];if(!sd_file_ok($file))sd_out(['ok'=>false,'error'=>'invalid_file'],422);$rec=['_id'=>sd_uuid('ATT'),'ownerType'=>$ownerType,'ownerId'=>$ownerId,'category'=>sd_text($body['category']??'supporting_document',80),'version'=>1,'objectKey'=>$file['key'],'name'=>$file['name']??'','mimeType'=>$file['contentType']??'','size'=>$file['size']??0,'status'=>'active','uploadedBy'=>$user,'uploadedAt'=>sd_now()];$attachments[]=$rec;$result=['attachmentId'=>$rec['_id']];}
        else{$id=sd_text($body['attachmentId']??'',100);$ai=-1;foreach($attachments as $i=>$a)if(is_array($a)&&(string)($a['_id']??'')===$id){$ai=$i;break;}if($ai<0)sd_out(['ok'=>false,'error'=>'attachment_not_found'],404);if($reason==='')sd_out(['ok'=>false,'error'=>'reason_required'],422);if($action==='attachment_delete'){$attachments[$ai]['status']='deleted';$attachments[$ai]['deletedAt']=sd_now();$attachments[$ai]['deletedBy']=$user;$attachments[$ai]['deleteReason']=$reason;$result=['deleted'=>$id];}else{$file=is_array($body['file']??null)?$body['file']:[];if(!sd_file_ok($file))sd_out(['ok'=>false,'error'=>'invalid_file'],422);$oldA=$attachments[$ai];$attachments[$ai]['status']='replaced';$newA=['_id'=>sd_uuid('ATT'),'ownerType'=>$oldA['ownerType'],'ownerId'=>$oldA['ownerId'],'category'=>$oldA['category'],'version'=>(int)($oldA['version']??1)+1,'objectKey'=>$file['key'],'name'=>$file['name']??'','mimeType'=>$file['contentType']??'','size'=>$file['size']??0,'status'=>'active','replacesAttachmentId'=>$id,'uploadedBy'=>$user,'uploadedAt'=>sd_now()];$attachments[]=$newA;$result=['attachmentId'=>$newA['_id'],'replaced'=>$id];}}
        $corrections[]=['_id'=>sd_uuid('COR'),'entityType'=>'financial_attachment','entityId'=>$result['attachmentId']??$result['deleted']??'','kind'=>$action,'reason'=>$reason,'correctedBy'=>$user,'correctedAt'=>sd_now(),'ownerType'=>$ownerType,'ownerId'=>$ownerId];
        $changes=['ptf_crm_fin_attachments'=>$attachments,'ptf_crm_corrections'=>$corrections];
    }
    elseif ($action === 'entity_upsert' || $action === 'entity_delete') {
        /* v34.8.13 (PHASE-C2): فرمان عمومی موجودیت — سرور مالک رکورد است. */
        $collection = sd_text($body['collection'] ?? '', 60);
        $registry = sd_entity_registry();
        if (!isset($registry[$collection])) sd_out(['ok'=>false,'error'=>'entity_collection_not_enabled'],404);
        $cfg = $registry[$collection];
        sd_require_role($cfg['roles']);
        $idField = (string)$cfg['id'];
        $rows = sd_read($collection);
        if ($action === 'entity_upsert') {
            $rec = is_array($body['record'] ?? null) ? $body['record'] : [];
            $id = sd_text($rec[$idField] ?? '', 60);
            if (!preg_match('/^[A-Za-z0-9._:-]{3,60}$/', $id)) sd_out(['ok'=>false,'error'=>'entity_id_required'],422);
            $sanitizeStats = null;
            $row = sd_entity_sanitize_row($rec, $sanitizeStats, (int)($cfg['maxFields'] ?? 40));
            $row[$idField] = $id;
            $found = -1;
            foreach ($rows as $i => $r) if (is_array($r) && (string)($r[$idField] ?? '') === $id) { $found = $i; break; }
            /* v34.9.2 (RCA برخورد کد CUST — ثبت‌کنندهٔ اشتباه/جایگاه قدیمی): درجِ
               موردانتظار (expectCreate) که به شناسهٔ موجود بخورد صریحاً رد می‌شود تا
               رکورد کاربر دیگر بی‌صدا بازنویسی نشود؛ کلاینت کد یکتا می‌سازد و ادامه می‌دهد. */
            if (!empty($body['expectCreate']) && $found >= 0) sd_out(['ok'=>false,'error'=>'entity_id_exists','id'=>$id,'hint'=>'regenerate_client_code'],409);
            $now = sd_now();
            if ($found < 0) {
                $row['createdAt'] = $now; $row['createdBy'] = $user;
                $rows[] = $row; $created = true; $stored = $row;
            } else {
                $prev = $rows[$found];
                $row['createdAt'] = (string)($prev['createdAt'] ?? $now);
                $row['createdBy'] = (string)($prev['createdBy'] ?? $user);
                /* v34.8.34 (CARTABLE-LOOP): merge semantics — فیلدی که در payload نیست
                   یعنی «تغییری نکرده»، نه «پاک». ریشهٔ حلقهٔ «کارتابل هر چند ثانیه تکرار
                   می‌شد»: upsert دیرهنگام/دوباره‌ارسالی، notifiedUsers (state ضدتکرار
                   اعلان یادآور در bridge) را با رکورد کهنه جایگزین می‌کرد؛ poll بعدی
                   چون state را گم‌شده می‌دید، کارت تکراری می‌ساخت و چرخه ادامه یافت. */
                foreach ($prev as $pk => $pv) {
                    if ($pk === 'createdAt' || $pk === 'createdBy' || $pk === 'updatedAt' || $pk === 'updatedBy') continue;
                    if (array_key_exists($pk, $row)) continue;
                    $row[$pk] = $pv;
                }
                $row['updatedAt'] = $now; $row['updatedBy'] = $user;
                $rows[$found] = $row; $created = false; $stored = $row;
            }
            $changes = [$collection => $rows];
            $result = ['collection' => $collection, 'id' => $id, 'created' => $created, 'row' => $stored, 'mode' => 'entity-command', 'sanitize' => $sanitizeStats];
        } else {
            $id = sd_text($body['id'] ?? ($body['record'] ?? [])[$idField] ?? '', 60);
            if (!preg_match('/^[A-Za-z0-9._:-]{3,60}$/', $id)) sd_out(['ok'=>false,'error'=>'entity_id_required'],422);
            $reason = sd_text($body['reason'] ?? 'entity_delete', 300);
            $found = -1;
            foreach ($rows as $i => $r) if (is_array($r) && (string)($r[$idField] ?? '') === $id) { $found = $i; break; }
            if ($found < 0) {
                $result = ['collection' => $collection, 'id' => $id, 'deleted' => false, 'alreadyDeleted' => true, 'mode' => 'entity-command'];
                $changes = [];
            } else {
                array_splice($rows, $found, 1);
                /* tombstone عمومی با kind=archive_purge و identities — همان مکانیزم
                   موجود client/server؛ دستگاه‌های stale رکورد را زنده نمی‌کنند. */
                $archive = sd_read('ptf_crm_deleted_archive');
                $archive[] = ['_id' => sd_uuid('DEL'), 'kind' => 'archive_purge', 'collection' => $collection, 'id' => $id, 'cd' => $id, 'aliases' => [$id], 'identities' => [$collection => [$id]], 'reason' => $reason, 'deletedBy' => $user, 'deletedAt' => sd_now()];
                $changes = [$collection => $rows, 'ptf_crm_deleted_archive' => $archive];
                $result = ['collection' => $collection, 'id' => $id, 'deleted' => true, 'mode' => 'entity-command'];
            }
        }
        /* v34.8.34 (W2): کلیدهای sortIso (notifs) — آرایهٔ سرور iso نزولی بماند؛
           روی هر دو مسیر upsert و delete اعمال می‌شود تا projection سرور با فرم
           کانونیکال کلاینت یکی بماند. */
        if (!empty($cfg['sortIso']) && isset($changes[$collection]) && is_array($changes[$collection])) {
            $isoOf = function ($r) {
                if (!is_array($r)) return '';
                foreach (['iso','updatedAtISO','issueDate','invDate','t'] as $f) if (isset($r[$f]) && is_string($r[$f]) && $r[$f] !== '') return $r[$f];
                return '';
            };
            usort($changes[$collection], function ($a, $b) use ($isoOf) { return strcmp($isoOf($b), $isoOf($a)); });
        }
    }
    else sd_out(['ok'=>false,'error'=>'unknown_action'],404);

    /* v34.7.18 (فاز ۱ / R9): نتیجهٔ تسویهٔ آخرین بازسازی همراه پاسخ برمی‌گردد تا کلاینت و آزمون‌ها
       بتوانند نقض اتحادها را بلافاصله ببینند. صرفاً گزارشی است و مسیر نوشتن را تغییر نمی‌دهد. */
    if(isset($GLOBALS['sd_last_reconcile']))$result['reconcile']=$GLOBALS['sd_last_reconcile'];
    $projectionChanges=is_array($responseChanges)?$responseChanges:$changes;
    /* keys بخشی از receipt idempotency است؛ بنابراین باید از ابتدا role-safe ذخیره شود تا
       replay همان فرمان هم نتواند collection محرمانه را snapshot کند. */
    $result['keys']=array_keys($projectionChanges);sd_append_command($commands,$idem,$action,$requestHash,$result);$changes['ptf_crm_sales_commands']=$commands;$rev=sd_commit($changes,['key'=>$idem,'action'=>$action,'requestHash'=>$requestHash,'owner'=>$user]);
    if(sd_is_recurring_projection_action($action)){
        $identities=is_array($result['projectionIdentities']??null)?$result['projectionIdentities']:[];
        $responseData=sd_recurring_projection_data($action,$opex,$identities,$rev);
    }else{$responseData=sd_result_data($projectionChanges);}
    flock($lock,LOCK_UN);fclose($lock);sd_out(['ok'=>true,'rev'=>$rev,'result'=>$result,'data'=>$responseData]);
} catch (Throwable $e) {
    if (is_resource($lock)) { @flock($lock, LOCK_UN); @fclose($lock); }
    sd_out(['ok'=>false,'error'=>'command_failed','detail'=>$e->getMessage()],500);
}
