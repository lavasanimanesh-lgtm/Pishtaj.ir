<?php
/* =====================================================================
   PTF CRM — api/contact-merge-lib.php — v34.39.30 (CONTACT-ROOTS R7)
   منبع یک‌نواختِ semantics اتحاد فیلدهای تماس (people/coTels/phones/ph)
   ---------------------------------------------------------------------
   RCA (گزارش ۱۴۰۵/۰۷/۰۳ — «شماره را کاربر دیگر دوباره اضافه کرد ولی
   نمایش داده نمی‌شود»): flush عادی فاز B یک data_push blob کامل است، نه
   entity_upsert. گارد R6 (sync_contact_fields_fill) فقط کلیدهای «غایب» را
   از سرور پر می‌کرد؛ رکوردِ کهنهٔ یک دستگاه (krevs تازه + داده کهنه،
   restore محلی، desync آینه IDB، sendBeacon لحظهٔ بستن، کلاینت قدیمی
   بدون base) کلید «حاضر اما کهنه/خالی» را بازنویسی می‌کرد و شماره‌های
   تازهٔ سرور بی‌صدا پاک می‌شدند — همان کلاس «مالِ من سالم، مالِ او پاک».

   قاعدهٔ رکوردبه‌رکورد (هم‌معنای entity_upsert):
     ۱) کلیدِ غایب → همیشه از سرور پر می‌شود (R6)؛
     ۲) رکورد «تازه» (مبنای رکورد = نسخهٔ فعلی سرور + ویرایش تازهٔ کلاینت)
        → LWW: وضعیت صریح کلاینت (شامل پاک‌سازی آگاهانه) محترم است؛
     ۳) هر حالت دیگر (مبنای کهنه/نامشخص) → UNION: کانال‌های incoming
        اضافه می‌شوند، کانالِ فقط-سرور هرگز حذف نمی‌شود، ph خالیِ ورودی
        ph سرور را نگه می‌دارد؛
     ۴) مهر _ccClear روی رکوردِ کهنه نادیده گرفته می‌شود (پاک‌سازیِ بر
        مبنای دیدِ کهنه هرگز دادهٔ تازهٔ سرور را نمی‌شوید) و همواره پیش از
        ذخیره هر دو مهر (_ccClear/_ccBaseAt) برداشته می‌شود.
   مصرف‌کننده‌ها:
     • api/crm.php        → sync_contact_records_merge (مسیر data_push)
     • api/sales-domain.php → sd_* alias روی همین تابع‌ها (مسیر entity_upsert)
   ===================================================================== */

if (!function_exists('cm_contact_digits')) {

/** نرمال‌سازی رقم (فارسی/عربی → انگلیسی) — هم‌سنگ dedupNormPhone کلاینت برای مقایسه */
function cm_contact_digits($v): string {
    $s = strtr(trim((string)$v), [
        '۰'=>'0','۱'=>'1','۲'=>'2','۳'=>'3','۴'=>'4','۵'=>'5','۶'=>'6','۷'=>'7','۸'=>'8','۹'=>'9',
        '٠'=>'0','١'=>'1','٢'=>'2','٣'=>'3','٤'=>'4','٥'=>'5','٦'=>'6','٧'=>'7','٨'=>'8','٩'=>'9',
    ]);
    return (string)preg_replace('/\D+/', '', $s);
}

/** کلید یکتای کانال: n:<ارقام> یا s:<متن پایین> */
function cm_contact_chan_key($t): string {
    if (!is_array($t)) {
        $d = cm_contact_digits($t);
        return $d !== '' ? 'n:'.$d : 's:'.mb_strtolower(trim((string)$t), 'UTF-8');
    }
    $n = isset($t['n']) ? trim((string)$t['n']) : '';
    if ($n === '') return '';
    $d = cm_contact_digits($n);
    return $d !== '' ? 'n:'.$d : 's:'.mb_strtolower($n, 'UTF-8');
}

/** اتحاد دو فهرست کانال بر کلید نرمال‌شده (ترتیب incoming حفظ می‌شود) */
function cm_contact_merge_chan_list($incoming, $stored): array {
    $out = []; $seen = [];
    $push = function ($t) use (&$out, &$seen) {
        if (!is_array($t) && !is_string($t)) return;
        if (is_string($t)) $t = ['n' => $t];
        $k = cm_contact_chan_key($t);
        if ($k === '' || isset($seen[$k])) return;
        $seen[$k] = 1;
        $out[] = $t;
    };
    if (is_array($incoming)) foreach ($incoming as $t) $push($t);
    if (is_array($stored)) foreach ($stored as $t) $push($t);
    return $out;
}

/** کلید شخص: nm:<نام> در اولویت؛ وگرنه امضای کانال‌هایش */
function cm_contact_person_key(array $p): string {
    $nm = mb_strtolower(trim((string)($p['nm'] ?? '')), 'UTF-8');
    if ($nm !== '') return 'nm:'.$nm;
    $bits = [];
    foreach (['tels','mobs','mails'] as $ch) {
        if (!isset($p[$ch]) || !is_array($p[$ch])) continue;
        foreach ($p[$ch] as $t) {
            $k = cm_contact_chan_key($t);
            if ($k !== '') $bits[$k] = 1;
        }
    }
    if (!$bits) return '';
    $keys = array_keys($bits); sort($keys);
    return 'ch:'.implode('|', $keys);
}

/** اتحاد اشخاص: همان‌کلید → اتحاد کانال‌ها + پُرکردن اسکالرهای خالی */
function cm_contact_merge_people($incoming, $stored): array {
    $out = []; $byKey = [];
    $ingest = function ($p, bool $isIncoming) use (&$out, &$byKey) {
        if (!is_array($p)) return;
        $k = cm_contact_person_key($p);
        if ($k === '') {
            if ($isIncoming) $out[] = $p;
            return;
        }
        if (!isset($byKey[$k])) {
            $byKey[$k] = count($out);
            $out[] = $p;
            return;
        }
        $idx = $byKey[$k];
        $base = $out[$idx];
        foreach (['tels','mobs','mails'] as $ch) {
            $base[$ch] = cm_contact_merge_chan_list($base[$ch] ?? [], $p[$ch] ?? []);
        }
        foreach (['nm','nmEn','role','dept','note','src'] as $f) {
            $bv = trim((string)($base[$f] ?? ''));
            $pv = trim((string)($p[$f] ?? ''));
            if ($bv === '' && $pv !== '') $base[$f] = $p[$f];
        }
        if (empty($base['primary']) && !empty($p['primary'])) $base['primary'] = true;
        $out[$idx] = $base;
    };
    if (is_array($incoming)) foreach ($incoming as $p) $ingest($p, true);
    if (is_array($stored)) foreach ($stored as $p) $ingest($p, false);
    return $out;
}

/** آیا مقدار تماس عملاً خالی است؟ */
function cm_contact_val_empty($v): bool {
    if (is_array($v)) {
        foreach ($v as $it) {
            if (is_array($it)) {
                foreach ((isset($it['tels']) && is_array($it['tels']) ? $it['tels'] : []) as $t) { if (is_array($t) && isset($t['n']) && trim((string)$t['n']) !== '') return false; }
                foreach ((isset($it['mobs']) && is_array($it['mobs']) ? $it['mobs'] : []) as $t) { if (is_array($t) && isset($t['n']) && trim((string)$t['n']) !== '') return false; }
                foreach ((isset($it['mails']) && is_array($it['mails']) ? $it['mails'] : []) as $t) { if (is_array($t) && isset($t['n']) && trim((string)$t['n']) !== '') return false; }
                if (isset($it['n']) && trim((string)$it['n']) !== '') return false;
            } elseif (is_string($it) && trim($it) !== '') return false;
        }
        return true;
    }
    return trim((string)$v) === '';
}

/** آیا رکوردِ ورودی بر «مبنای نسخهٔ فعلی سرور» است؟ (معادل base-match در entity_upsert) */
function cm_contact_record_base_is_current(array $inRec, array $srvRec): bool {
    $srvAt = trim((string)($srvRec['updatedAt'] ?? $srvRec['updatedAtISO'] ?? ''));
    if ($srvAt === '') return true;   /* سرور نسخه‌ای ثبت نکرده → هر چیزی فعلی شمرده می‌شود */
    $inBase = trim((string)($inRec['updatedAt'] ?? ''));
    if ($inBase === '') return false; /* رکورد بدون نسخهٔ سروری → مبنای نامشخص */
    return $inBase === $srvAt;
}

/**
 * اتحاد رکوردبه‌رکوردِ فیلدهای تماس.
 * $fresh = updatedAtISOِ ورودی از updatedAt سرور تازه‌تر است (ویرایش تازهٔ کلاینت).
 * $ccClear = نیت صریح پاک‌سازی (فقط وقتی مبنای رکورد فعلی باشد محترم است).
 * فقط فیلدهای تماس لمس می‌شوند؛ مهرها برداشته می‌شوند.
 */
function cm_contact_merge_record(array $inRec, array $srvRec, array &$stats, bool $ccClear, bool $fresh): array {
    foreach (['_ccClear', '_ccBaseAt'] as $mk) {
        if (array_key_exists($mk, $inRec)) unset($inRec[$mk]);
    }
    $isFresh = $fresh && cm_contact_record_base_is_current($inRec, $srvRec);
    if ($ccClear && $isFresh) return $inRec;  /* پاک‌سازی آگاهانه از دیدِ تازه */
    if ($isFresh) return $inRec;              /* LWW — ویرایش بر مبنای نسخهٔ فعلی */
    /* —— مبنای کهنه/نامشخص: R6 (پُرکردن کلید غایب) + UNION (حذفِ فقط-سرور ممنوع) —— */
    $changed = false;
    foreach (['people', 'coTels', 'phones', 'ph'] as $fk) {
        if (!array_key_exists($fk, $inRec)) {
            if (array_key_exists($fk, $srvRec) && !cm_contact_val_empty($srvRec[$fk])) {
                $inRec[$fk] = $srvRec[$fk];
                $changed = true;
            }
            continue;
        }
        if ($fk === 'people') {
            $prevP = (isset($srvRec['people']) && is_array($srvRec['people'])) ? $srvRec['people'] : [];
            $curP = is_array($inRec['people']) ? $inRec['people'] : [];
            if ($prevP) {
                $merged = cm_contact_merge_people($curP, $prevP);
                if (json_encode($merged, JSON_UNESCAPED_UNICODE) !== json_encode($curP, JSON_UNESCAPED_UNICODE)) {
                    $inRec['people'] = $merged;
                    $changed = true;
                }
            }
        } elseif ($fk === 'ph') {
            $inPh = is_string($inRec['ph']) ? trim($inRec['ph']) : '';
            $pvPh = (isset($srvRec['ph']) && is_string($srvRec['ph'])) ? trim($srvRec['ph']) : '';
            if ($inPh === '' && $pvPh !== '') {
                $inRec['ph'] = $srvRec['ph'];
                $changed = true;
            }
        } else {
            $prevV = (isset($srvRec[$fk]) && is_array($srvRec[$fk])) ? $srvRec[$fk] : [];
            $curV = is_array($inRec[$fk]) ? $inRec[$fk] : [];
            if ($prevV) {
                $merged = cm_contact_merge_chan_list($curV, $prevV);
                if (json_encode($merged, JSON_UNESCAPED_UNICODE) !== json_encode($curV, JSON_UNESCAPED_UNICODE)) {
                    $inRec[$fk] = $merged;
                    $changed = true;
                }
            }
        }
    }
    if ($ccClear && is_array($stats)) $stats['staleClearIgnored'] = ($stats['staleClearIgnored'] ?? 0) + 1;
    if ($changed && is_array($stats)) $stats['staleRecordsMerged'] = ($stats['staleRecordsMerged'] ?? 0) + 1;
    return $inRec;
}

}
