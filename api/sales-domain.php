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
const SD_WIN_ROLES = ['admin', 'chairman', 'ceo', 'commercial', 'sales'];
const SD_OFFER_REPAIR_ROLES = ['admin', 'chairman'];
const SD_RFQ_ROLES = ['admin', 'chairman', 'ceo', 'commercial', 'sales', 'buyer', 'accountant'];
const SD_ADMIN_ROLES = ['admin'];
/* OPS-01 (v34.7.22): نسخهٔ پاسخ‌های سرویس از یک ثابت واحد خوانده می‌شود و با
   window.PTF_CRM_RELEASE در crm/index.html هم‌راستا نگه داشته می‌شود. پیش از این عدد
   ثابت '34.6.0' در سه نقطه hardcode بود و با نسخهٔ واقعی UI نمی‌خواند. */
const SD_SERVICE_VERSION = '34.7.61';

const SD_KEYS = [
    'ptf_crm_offers', 'ptf_crm_deals', 'ptf_crm_rfqs', 'ptf_crm_invoices',
    'ptf_crm_case_receipts', 'ptf_crm_receipt_allocations', 'ptf_crm_fin_attachments',
    'ptf_crm_corrections', 'ptf_crm_fin_findings', 'ptf_crm_deleted_archive',
    'ptf_crm_fiscal_snapshots', 'ptf_crm_sales_commands'
];

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
    $st = strtolower((string)($r['status'] ?? $r['st'] ?? ''));
    return !in_array($st, ['void', 'voided', 'cancelled', 'deleted', 'replaced', 'superseded'], true)
        && empty($r['voided']) && empty($r['deleted']);
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

$readOnly = in_array($action, ['snapshot', 'health', 'migration_dry_run', 'duplicate_case_plan', 'archived_case_purge_plan', 'command_status'], true);
if ($readOnly) {
    /* v34.7.45: compact authoritative receipt lookup. A large command may commit but
       lose its projection response in transport; replaying the same large response is
       not proof that it failed. The owner can recover the durable journal receipt by
       operation/action without downloading every changed collection again. */
    if ($action === 'command_status') {
        $operationId=sd_text($body['operationId']??'',120);$commandAction=sd_text($body['commandAction']??'',80);
        if($operationId===''||$commandAction==='')sd_out(['ok'=>false,'error'=>'command_status_identity_required'],422);
        /* وضعیت فقط پس از تکمیل WAL زیر همان lock قطعی است؛ read بدون recovery ممکن
           بود درست در فاصلهٔ crash، یک commit موجود را «یافت نشد» گزارش کند. */
        $receiptLockPath=sd_sync_dir().'/meta.json.lock';$receiptLock=fopen($receiptLockPath,'c+');
        if(!$receiptLock||!flock($receiptLock,LOCK_EX))sd_out(['ok'=>false,'error'=>'lock_unavailable'],503);
        try{sd_recover_pending_transactions();$commands=sd_read('ptf_crm_sales_commands');}
        catch(Throwable $receiptError){@flock($receiptLock,LOCK_UN);@fclose($receiptLock);sd_out(['ok'=>false,'error'=>'command_status_recovery_failed'],500);}
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
        /* retry همان command نیز projection جاری را با watermark دقیق می‌گیرد؛ بدون
           rev، کلاینت ناچار بود آن را روی نسخهٔ نامعلوم cache اعمال کند. */
        sd_out(['ok'=>true,'idempotent'=>true,'rev'=>sd_current_rev(),'result'=>$old['result'],'data'=>sd_snapshot($keys)]);
    }
    $changes = [];
    $result = [];

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
    elseif ($action === 'post_receipt') {
        sd_require_role(SD_FIN_ROLES);
        $caseId=sd_text($body['caseId']??'',100);$ci=sd_find_case_index($cases,$caseId);if($ci<0)sd_out(['ok'=>false,'error'=>'case_not_found'],404);
        $case=$cases[$ci];sd_case_id($case);$caseId=$case['_id'];
        $amount=(int)round(sd_num($body['amountIRR']??0));if($amount<=0||$amount>9000000000000000)sd_out(['ok'=>false,'error'=>'invalid_amount'],422);
        $method=sd_text($body['method']??'',50);if($method==='')sd_out(['ok'=>false,'error'=>'method_required'],422);if(preg_match('/چک|cheque/i',$method))sd_out(['ok'=>false,'error'=>'cheque_requires_collection'],422);
        $receivedAt=sd_text($body['receivedAt']??sd_now(),40);if(sd_is_locked($snaps,$receivedAt))sd_out(['ok'=>false,'error'=>'fiscal_period_locked','year'=>sd_year($receivedAt)],409);
        $account=sd_text($body['destinationAccount']??'',150);if($account==='')sd_out(['ok'=>false,'error'=>'destination_account_required'],422);
        $cur=strtoupper((string)($case['currency']??'IRR'));$rate=0.0;$covered=0.0;
        if($cur!=='IRR'){$rate=sd_num($body['fxRate']??0);$source=sd_text($body['fxRateSource']??'',200);if($rate<=0||$source==='')sd_out(['ok'=>false,'error'=>'fx_rate_and_source_required'],422);$covered=round($amount/$rate,4);}else{$source='';}
        $hasInvoice=false;$receiptDateKey=sd_date_key($receivedAt);foreach($invoices as $inv)if(is_array($inv)&&sd_active($inv)&&(string)($inv['caseId']??'')===$caseId){$invDateKey=sd_date_key($inv['invDate']??$inv['issueDate']??'');if($receiptDateKey===''||$invDateKey===''||substr($receiptDateKey,0,2)!==substr($invDateKey,0,2)||$invDateKey<=$receiptDateKey){$hasInvoice=true;break;}}
        $receipt=['_id'=>sd_uuid('RCPT'),'cd'=>sd_uuid('RPAY'),'caseId'=>$caseId,'customerId'=>$case['buyerCd']??'','buyerCo'=>$case['buyerCo']??'','amountIRR'=>$amount,'amt'=>$amount,'receivedAt'=>$receivedAt,'dateISO'=>$receivedAt,'method'=>$method,'how'=>$method,'destinationAccount'=>$account,'referenceNo'=>sd_text($body['referenceNo']??'',120),'note'=>sd_text($body['note']??'',1000),'status'=>'posted','timing'=>$hasInvoice?'post_invoice':'pre_invoice','currency'=>$cur,'fxRate'=>$rate,'fxRateSource'=>$source,'coveredFxAmount'=>$covered,'files'=>is_array($body['files']??null)?$body['files']:[],'createdBy'=>$user,'createdAt'=>sd_now()];
        array_unshift($receipts,$receipt);sd_rebuild_allocations($caseId,$receipts,$invoices,$allocations,$cases);
        $changes=['ptf_crm_case_receipts'=>$receipts,'ptf_crm_invoices'=>$invoices,'ptf_crm_receipt_allocations'=>$allocations];$result=['receiptId'=>$receipt['_id'],'caseId'=>$caseId];
    }
    elseif ($action === 'correct_receipt' || $action === 'void_receipt') {
        sd_require_role(SD_FIN_ROLES);
        $rid=sd_text($body['receiptId']??'',100);$ri=-1;foreach($receipts as $i=>$r)if(is_array($r)&&((string)($r['_id']??'')===$rid||(string)($r['cd']??'')===$rid)){$ri=$i;break;}if($ri<0)sd_out(['ok'=>false,'error'=>'receipt_not_found'],404);
        $oldReceipt=$receipts[$ri];$reason=sd_text($body['reason']??'',500);if($reason==='')sd_out(['ok'=>false,'error'=>'reason_required'],422);if(sd_is_locked($snaps,(string)($oldReceipt['receivedAt']??'')))sd_out(['ok'=>false,'error'=>'fiscal_period_locked'],409);
        $corrections[]=['_id'=>sd_uuid('COR'),'entityType'=>'receipt','entityId'=>$oldReceipt['_id'],'kind'=>$action,'beforeSnapshot'=>$oldReceipt,'reason'=>$reason,'correctedBy'=>$user,'correctedAt'=>sd_now()];
        $oldReceipt['status']='void';$oldReceipt['voidedAt']=sd_now();$oldReceipt['voidedBy']=$user;$oldReceipt['voidReason']=$reason;$receipts[$ri]=$oldReceipt;
        if($action==='correct_receipt'){
            $new=$oldReceipt;$new['_id']=sd_uuid('RCPT');$new['cd']=sd_uuid('RPAY');$new['status']='posted';$new['correctsReceiptId']=$oldReceipt['_id'];unset($new['voidedAt'],$new['voidedBy'],$new['voidReason']);$new['amountIRR']=(int)round(sd_num($body['amountIRR']??$oldReceipt['amountIRR']));$new['amt']=$new['amountIRR'];$new['receivedAt']=sd_text($body['receivedAt']??$oldReceipt['receivedAt'],40);$new['method']=sd_text($body['method']??$oldReceipt['method'],50);$new['how']=$new['method'];$new['destinationAccount']=sd_text($body['destinationAccount']??$oldReceipt['destinationAccount'],150);if($new['amountIRR']<=0||$new['destinationAccount']==='')sd_out(['ok'=>false,'error'=>'invalid_correction'],422);if(($new['currency']??'IRR')!=='IRR'){$new['fxRate']=sd_num($body['fxRate']??$oldReceipt['fxRate']);$new['fxRateSource']=sd_text($body['fxRateSource']??$oldReceipt['fxRateSource'],200);if($new['fxRate']<=0||$new['fxRateSource']==='')sd_out(['ok'=>false,'error'=>'fx_rate_and_source_required'],422);$new['coveredFxAmount']=round($new['amountIRR']/$new['fxRate'],4);}/* v34.7.18 (فاز ۲ / R7): انتقال بستانکاری به پروندهٔ دیگرِ همان مشتری از مسیر رسمی اصلاح
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
        $incoming=is_array($body['invoice']??null)?$body['invoice']:[];$caseId=sd_text($incoming['caseId']??'',100);$ci=sd_find_case_index($cases,$caseId);if($ci<0)sd_out(['ok'=>false,'error'=>'case_not_found'],404);$case=$cases[$ci];sd_case_id($case);$caseId=$case['_id'];$amount=(int)round(sd_num($incoming['amount']??0));if($amount<=0||$amount>9000000000000000)sd_out(['ok'=>false,'error'=>'invalid_amount'],422);$date=sd_text($incoming['invDate']??$incoming['t']??'',40);if($date===''||sd_is_locked($snaps,$date))sd_out(['ok'=>false,'error'=>$date===''?'issue_date_required':'fiscal_period_locked'],409);$cd=sd_text($incoming['cd']??'',120);if($cd==='')$cd=sd_uuid('UNINV');$idx=-1;foreach($invoices as $i=>$iv)if(is_array($iv)&&(string)($iv['cd']??'')===$cd){$idx=$i;break;}$record=$incoming;$record['_id']=$idx>=0?($invoices[$idx]['_id']??sd_uuid('INV')):($record['_id']??sd_uuid('INV'));$record['cd']=$cd;$record['caseId']=$caseId;$record['customerId']=$case['buyerCd']??'';$record['buyerCo']=$case['buyerCo']??($record['buyerCo']??'');$record['base']=(int)round(sd_num($record['base']??$amount));$record['vat']=0;$record['vatPercent']=0;$record['amount']=$amount;$record['isUnofficial']=true;$record['isOfficial']=false;$record['status']='active';$record['updatedAtISO']=sd_now();$record['updatedBy']=$user;if($idx>=0)$invoices[$idx]=$record;else array_unshift($invoices,$record);sd_rebuild_allocations($caseId,$receipts,$invoices,$allocations,$cases);$changes=['ptf_crm_invoices'=>$invoices,'ptf_crm_case_receipts'=>$receipts,'ptf_crm_receipt_allocations'=>$allocations];$result=['invoiceId'=>$record['_id'],'created'=>$idx<0,'unofficial'=>true];
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
        $record=['_id'=>$ii>=0?($invoices[$ii]['_id']??sd_uuid('INV')):sd_uuid('INV'),'cd'=>$ii>=0?($invoices[$ii]['cd']??sd_uuid('INV')):sd_uuid('INV'),'caseId'=>$caseId,'customerId'=>$case['buyerCd']??'','buyerCo'=>$case['buyerCo']??'','offerNo'=>$offerNo,'no'=>$no,'accountingInvoiceNo'=>$no,'taxUid'=>$taxUid,'modianReference'=>sd_text($body['modianReference']??'',160),'invDate'=>$invDate,'issueDate'=>$invDate,'base'=>$base,'baseAmountIRR'=>$base,'vatPercent'=>$pct,'vat'=>$vat,'vatAmountIRR'=>$vat,'amount'=>$total,'totalAmountIRR'=>$total,'coverageMode'=>$coverageMode,'coverage'=>$coverage,'replacesUnofficialInvoiceId'=>$replaceUnofficialId,'files'=>$files,'ocrOverrideReason'=>sd_text($body['ocrOverrideReason']??'',1000),'status'=>'active','isOfficial'=>true,'isUnofficial'=>false,'t'=>$ii>=0?($invoices[$ii]['t']??sd_now()):sd_now(),'by'=>$ii>=0?($invoices[$ii]['by']??$user):$user,'updatedAtISO'=>sd_now(),'updatedBy'=>$user];
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
        foreach($offers as &$o){if(!is_array($o))continue;$no=(string)($o['no']??'');if(($offerCount[$no]??0)!==1)continue;$matches=[];foreach($cases as $c)if(is_array($c)&&sd_active($c)&&sd_case_offer_linked($c,$o))$matches[]=$c;if(count($matches)!==1)continue;$case=$matches[0];$caseId=(string)$case['_id'];$pays=is_array($o['advance']['payments']??null)?$o['advance']['payments']:[];foreach($pays as $p){if(!is_array($p))continue;$amt=(int)round(sd_num($p['amt']??0));$method=(string)($p['how']??'');if($amt<=0||preg_match('/چک|cheque/i',$method))continue;$legacyRef=(string)($p['cd']??'');$exists=false;foreach($receipts as $r)if(is_array($r)&&$legacyRef!==''&&(string)($r['legacyPaymentRef']??'')===$legacyRef){$exists=true;break;}if($exists)continue;$hasInvoice=false;foreach($invoices as $inv)if(is_array($inv)&&sd_active($inv)&&(string)($inv['caseId']??'')===$caseId){$hasInvoice=true;break;}$cur=strtoupper((string)($case['currency']??$o['currency']??'IRR'));$rate=sd_num($p['rate']??$o['advance']['rate']??0);$receipts[]=['_id'=>sd_uuid('RCPT'),'cd'=>sd_uuid('RPAY'),'caseId'=>$caseId,'customerId'=>$case['buyerCd']??$o['buyerCd']??'','buyerCo'=>$case['buyerCo']??$o['buyerCo']??'','amountIRR'=>$amt,'amt'=>$amt,'receivedAt'=>$p['t']??$o['advance']['t']??sd_now(),'dateISO'=>$p['t']??'','method'=>$method?:'legacy_confirmed','how'=>$method?:'legacy_confirmed','destinationAccount'=>'legacy-migration','referenceNo'=>$legacyRef,'note'=>'مهاجرت وصول واقعی payments[]؛ paid/cashFull بدون رویداد منتقل نشده است','status'=>'posted','timing'=>$hasInvoice?'post_invoice':'pre_invoice','currency'=>$cur,'fxRate'=>$rate,'fxRateSource'=>$rate>0?'legacy snapshot':'','coveredFxAmount'=>($cur!=='IRR'&&$rate>0)?round($amt/$rate,4):0,'legacyPaymentRef'=>$legacyRef,'migratedAt'=>sd_now(),'createdBy'=>$user,'createdAt'=>sd_now()];$touched[$caseId]=true;$migrated++;}if(isset($o['advance'])&&is_array($o['advance']))$o['advance']['migrationV35']=['at'=>sd_now(),'actualPaymentsMigrated'=>$migrated,'inferredCashIgnored'=>empty($pays)&&(!empty($o['advance']['cashFull'])||!empty($o['advance']['paid']))];}unset($o);
        /* Real legacy invoice payments are migrated as case receipts; synthetic
           fromAdvance and cheques are deliberately excluded. */
        foreach($invoices as &$legacyInv){if(!is_array($legacyInv))continue;$legacyCaseId=(string)($legacyInv['caseId']??'');$legacyCase=null;if($legacyCaseId!==''){foreach($cases as $c)if(is_array($c)&&sd_case_match($c,$legacyCaseId)){$legacyCase=$c;break;}}if(!$legacyCase){$hits=[];foreach($cases as $c)if(is_array($c)&&sd_active($c)&&((string)($c['wonOffer']??'')===(string)($legacyInv['offerNo']??'')||(string)($c['offerNo']??'')===(string)($legacyInv['offerNo']??'')))$hits[]=$c;if(count($hits)===1){$legacyCase=$hits[0];$legacyCaseId=(string)($legacyCase['_id']??$legacyCase['cd']??'');$legacyInv['caseId']=$legacyCaseId;}}if(!$legacyCase||$legacyCaseId==='')continue;foreach(array_merge($legacyInv['payments']??[],$legacyInv['pays']??[])as $p){if(!is_array($p)||!sd_active($p)||!empty($p['fromAdvance'])||sd_num($p['amt']??$p['amount']??0)<=0||preg_match('/چک|cheque/i',(string)($p['how']??'')))continue;$ref=(string)($p['cd']??'');$exists=false;foreach($receipts as $r)if(is_array($r)&&$ref!==''&&(string)($r['legacyPaymentRef']??'')===$ref){$exists=true;break;}if($exists)continue;$amt=(int)round(sd_num($p['amt']??$p['amount']??0));$receipts[]=['_id'=>sd_uuid('RCPT'),'cd'=>sd_uuid('RPAY'),'caseId'=>$legacyCaseId,'customerId'=>$legacyCase['buyerCd']??'','buyerCo'=>$legacyCase['buyerCo']??$legacyInv['buyerCo']??'','amountIRR'=>$amt,'amt'=>$amt,'receivedAt'=>$p['t']??$legacyInv['invDate']??sd_now(),'method'=>$p['how']??'legacy_confirmed','how'=>$p['how']??'legacy_confirmed','destinationAccount'=>'legacy-migration','referenceNo'=>$ref,'note'=>'مهاجرت وصول واقعی فاکتور legacy','status'=>'posted','timing'=>'post_invoice','currency'=>$legacyCase['currency']??'IRR','fxRate'=>$p['fx']['rate']??0,'fxRateSource'=>!empty($p['fx']['rate'])?'legacy snapshot':'','coveredFxAmount'=>$p['fx']['fxAmt']??0,'legacyPaymentRef'=>$ref,'migratedAt'=>sd_now(),'createdBy'=>$user,'createdAt'=>sd_now()];$newReceiptId=$receipts[count($receipts)-1]['_id'];foreach(['payments','pays']as $pk)if(isset($legacyInv[$pk])&&is_array($legacyInv[$pk]))foreach($legacyInv[$pk]as &$origPay)if(is_array($origPay)&&(string)($origPay['cd']??'')===$ref){$origPay['migratedToReceiptId']=$newReceiptId;$origPay['financialProjectionDisabled']=true;}unset($origPay);$touched[$legacyCaseId]=true;$migrated++;}}unset($legacyInv);
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
    else sd_out(['ok'=>false,'error'=>'unknown_action'],404);

    /* v34.7.18 (فاز ۱ / R9): نتیجهٔ تسویهٔ آخرین بازسازی همراه پاسخ برمی‌گردد تا کلاینت و آزمون‌ها
       بتوانند نقض اتحادها را بلافاصله ببینند. صرفاً گزارشی است و مسیر نوشتن را تغییر نمی‌دهد. */
    if(isset($GLOBALS['sd_last_reconcile']))$result['reconcile']=$GLOBALS['sd_last_reconcile'];
    $result['keys']=array_keys($changes);sd_append_command($commands,$idem,$action,$requestHash,$result);$changes['ptf_crm_sales_commands']=$commands;$rev=sd_commit($changes,['key'=>$idem,'action'=>$action,'requestHash'=>$requestHash,'owner'=>$user]);flock($lock,LOCK_UN);fclose($lock);sd_out(['ok'=>true,'rev'=>$rev,'result'=>$result,'data'=>sd_result_data($changes)]);
} catch (Throwable $e) {
    if (is_resource($lock)) { @flock($lock, LOCK_UN); @fclose($lock); }
    sd_out(['ok'=>false,'error'=>'command_failed','detail'=>$e->getMessage()],500);
}
