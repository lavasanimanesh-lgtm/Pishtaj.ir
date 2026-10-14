<?php
/* =====================================================================
   PTF CRM — OFFER-LOSS FORENSICS (Server probe) — نسخهٔ ۲ / 2026-10-14
   «پیشنهادهای پنج-شش روز گذشته از روی سرور پاک شده و در CRM دیده نمی‌شوند»
   ---------------------------------------------------------------------
   نحوهٔ استفاده:
     1) این فایل را در ریشهٔ سایت (public_html) آپلود کنید:
        offer-loss-forensics.php
     2) در مرورگر باز کنید:
        https://pishtaj.ir/offer-loss-forensics.php?k=ptf-forensics-2026-10-14
     3) کل خروجی (کادر انتهای صفحه) را کپی و برگردانید.
     4) فایل را از هاست حذف کنید.
   ⚠️ کاملاً فقط‌خواندنی: هیچ فایلی نوشته/تغییر/حذف نمی‌شود. هیچ توکن/پسوردی چاپ نمی‌شود.
   ⚠️ این اسکریپت خودش «حکم» می‌دهد: کانالِ حذف + زمانش + نویسنده‌اش.
   ===================================================================== */

header('Content-Type: text/html; charset=utf-8');
if (($_GET['k'] ?? '') !== 'ptf-forensics-2026-10-14') { http_response_code(403); exit('forbidden'); }
@set_time_limit(600);
@ini_set('memory_limit', '512M');

$OUT = ['generatedAt' => date('c'), 'errors' => [], 'notes' => []];

/* ---------- ۰) یافتن پوشهٔ داده ---------- */
$cands = [
    __DIR__ . '/crm/data',
    dirname(__DIR__) . '/crm/data',
    __DIR__ . '/public_html/crm/data',
    __DIR__ . '/data',
    dirname(__DIR__, 2) . '/crm/data',
    __DIR__ . '/crm/data-old',
];
$DATA = null; $checked = [];
foreach ($cands as $c) { $checked[] = $c; if (is_dir($c)) { $DATA = $c; break; } }
if (!$DATA) { echo '<pre>data dir not found. checked: ' . htmlspecialchars(implode(' | ', $checked)) . '</pre>'; exit; }
$SYNC = is_dir($DATA . '/sync') ? $DATA . '/sync' : $DATA;
$BK = $DATA . '/backups';
$OUT['dataDir'] = $DATA;
$OUT['syncDir'] = $SYNC;

/* ---------- کمکی‌ها ---------- */
function fraw($p) { return is_file($p) ? @file_get_contents($p) : null; }
function jdec($p) { $r = fraw($p); if ($r === null) return null; $j = json_decode($r, true); return is_array($j) ? $j : null; }
function jstr($s) { if (!is_string($s)) return null; $j = json_decode($s, true); return is_array($j) ? $j : null; }
function bkgz($p) {
    $r = fraw($p); if ($r === null) return null;
    if (substr($p, -3) === '.gz' && function_exists('gzdecode')) { $d = @gzdecode($r); if ($d !== false) $r = $d; }
    $j = json_decode($r, true); return is_array($j) ? $j : null;
}
function mt($p) { return is_file($p) ? date('c', filemtime($p)) : null; }
function sz($p) { return is_file($p) ? filesize($p) : null; }
/* مبنای زمانی هر پیشنهاد: جدیدترین مهر موجود */
function ots($o) {
    foreach (['serverRegisteredAt', 'updatedAtISO', 'updatedAt', 'createdAtISO', 'dateEn', 't'] as $f) {
        $v = trim((string)($o[$f] ?? '')); if ($v !== '') return $v;
    }
    return '';
}
function oday($o) {
    foreach (['serverRegisteredAt', 'updatedAtISO', 'updatedAt', 'createdAtISO'] as $f) {
        $v = trim((string)($o[$f] ?? '')); if ($v !== '' && preg_match('/^\d{4}-\d{2}-\d{2}/', $v, $m)) return $m[0];
    }
    foreach (['dateEn', 't'] as $f) { $v = trim((string)($o[$f] ?? '')); if ($v !== '') return mb_substr($v, 0, 10); }
    return '?';
}
function olist($rows) {
    $out = [];
    foreach ((array)$rows as $o) {
        if (!is_array($o)) continue;
        $n = trim((string)($o['no'] ?? ''));
        if ($n === '') continue;
        $out[$n] = ['no' => $n, 'kind' => (string)($o['kind'] ?? ''), 'st' => (string)($o['st'] ?? ''),
            't' => ots($o), 'day' => oday($o), 'inqNo' => (string)($o['inqNo'] ?? ''),
            'buyerCo' => mb_substr((string)($o['buyerCo'] ?? ''), 0, 60), 'rialOf' => (string)($o['rialOf'] ?? ''),
            'fxOf' => (string)($o['fxOf'] ?? ''), 'srcToNo' => (string)($o['srcToNo'] ?? ''),
            'coNo' => (string)($o['coNo'] ?? ''), 'regAt' => (string)($o['serverRegisteredAt'] ?? ''),
            'regBy' => (string)($o['serverRegisteredBy'] ?? '')];
    }
    return $out;
}

/* ---------- ۱) وضعیت زندهٔ کلید پیشنهادها (فایل + DB) ---------- */
$liveFile = $SYNC . '/ptf_crm_offers.json';
$legacyFile = $DATA . '/ptf_crm_offers.json';
$liveRaw = fraw($liveFile);
if ($liveRaw === null && is_file($legacyFile)) { $liveFile = $legacyFile; $liveRaw = fraw($liveFile); }
$liveRows = is_string($liveRaw) ? (json_decode($liveRaw, true) ?: []) : [];
$liveNo = olist($liveRows);
$liveSorted = array_values($liveNo);
usort($liveSorted, function ($a, $b) { return strcmp((string)$b['t'], (string)$a['t']); });
$regSorted = [];
foreach ($liveSorted as $x) { if ((string)$x['regAt'] !== '') $regSorted[] = $x; }
usort($regSorted, function ($a, $b) { return strcmp((string)$b['regAt'], (string)$a['regAt']); });
$byKind = []; $byDay = []; $companion = 0;
foreach ($liveSorted as $x) {
    $k = ((string)$x['kind'] === '') ? '?' : (string)$x['kind'];
    $byKind[$k] = ($byKind[$k] ?? 0) + 1;
    $byDay[(string)$x['day']] = ($byDay[(string)$x['day']] ?? 0) + 1;
    if ((string)$x['rialOf'] !== '' || (string)$x['fxOf'] !== '') $companion++;
}
ksort($byDay);
$last15 = [];
for ($ldi = 14; $ldi >= 0; $ldi--) { $ldk = date('Y-m-d', strtotime("-$ldi days")); $last15[$ldk] = (int)($byDay[$ldk] ?? 0); }
$OUT['live'] = [
    'file' => $liveFile, 'fileMtime' => mt($liveFile), 'fileBytes' => sz($liveFile),
    'offersCount' => count($liveNo),
    'newestRemaining' => $liveSorted ? $liveSorted[0] : null,
    'oldest' => $liveSorted ? $liveSorted[count($liveSorted) - 1] : null,
    'sampleNewest15' => array_slice($liveSorted, 0, 15),
    'registeredOnServerNewest10' => array_slice($regSorted, 0, 10),
    'companionLocal' => $companion,
    'byKind' => $byKind,
    'byDay' => $byDay,
    'last15Days' => $last15,
];

/* ---------- ۲) کشف حالت DB (فقط تشخیص، بدون چاپ راز) ---------- */
$dbCfgPaths = [dirname(__DIR__) . '/ptf-db-config.php', dirname(__DIR__, 2) . '/ptf-db-config.php', __DIR__ . '/api/ptf-db-config.php', __DIR__ . '/ptf-db-config.php'];
$dbCfg = null; $dbCfgPath = null;
foreach ($dbCfgPaths as $p) { if (is_file($p)) { $dbCfg = include $p; $dbCfgPath = $p; break; } }
$OUT['db'] = ['configFound' => (bool)$dbCfg, 'configPath' => $dbCfgPath, 'mode' => null];
if ($dbCfg && !empty($dbCfg['db_name']) && function_exists('mysqli_connect')) {
    $tbl = preg_replace('/[^A-Za-z0-9_]/', '', (string)($dbCfg['db_table'] ?? 'ptf_kv')) ?: 'ptf_kv';
    $m = @mysqli_connect((string)($dbCfg['db_host'] ?? 'localhost'), (string)$dbCfg['db_user'], (string)($dbCfg['db_pass'] ?? ''), (string)$dbCfg['db_name'], (int)($dbCfg['db_port'] ?? 3306));
    $OUT['db']['connected'] = (bool)$m;
    if ($m) {
        $cmp = [];
        foreach (['ptf_crm_offers', 'ptf_crm_rfqs', 'ptf_crm_deals', 'ptf_crm_deleted_archive', 'ptf_crm_sales_commands'] as $k) {
            $dbLen = null; $dbRev = null; $dbUpd = null;
            $st = mysqli_prepare($m, "SELECT v, rev, updated_at FROM `$tbl` WHERE k = ?");
            if ($st) {
                mysqli_stmt_bind_param($st, 's', $k);
                mysqli_stmt_execute($st);
                mysqli_stmt_bind_result($st, $dbv, $dbRev, $dbUpd);
                mysqli_stmt_fetch($st);
                mysqli_stmt_close($st);
                if ($dbv !== null) $dbLen = strlen((string)$dbv);
            }
            $fp = $SYNC . '/' . $k . '.json';
            $fLen = sz($fp);
            $same = ($dbLen !== null && $fLen !== null) ? ($dbLen === $fLen ? 'same-size' : 'DIFFERENT') : ($dbLen === null ? 'db-only-null' : 'file-missing');
            $cmp[$k] = ['dbLen' => $dbLen, 'dbRev' => $dbRev, 'dbUpdated' => $dbUpd, 'fileLen' => $fLen, 'fileMtime' => mt($fp), 'verdict' => $same];
        }
        $OUT['db']['compare'] = $cmp;
        mysqli_close($m);
    }
} else { $OUT['db']['connected'] = false; }
/* mode از خود کد api (فایل ممکن است فقط در سرور باشد) */
$OUT['db']['mode'] = $dbCfg ? (string)($dbCfg['mode'] ?? 'unknown') : 'json-only(no-config)';

/* ---------- ۳) meta.json — آخرین نویسندهٔ هر کلید (شاهد اصلی) ---------- */
$meta = jdec($SYNC . '/meta.json');
$OUT['meta']['fileMtime'] = mt($SYNC . '/meta.json');
$OUT['meta']['_global'] = is_array($meta) ? ($meta['_global'] ?? null) : null;
if (is_array($meta)) {
    $keys = ['ptf_crm_offers', 'ptf_crm_rfqs', 'ptf_crm_deleted_archive', 'ptf_crm_deals', 'ptf_crm_projects', 'ptf_crm_invoices', 'ptf_crm_rfqsmart', 'ptf_crm_customers'];
    foreach ($keys as $k) $OUT['meta'][$k] = $meta[$k] ?? null;
    $OUT['meta']['keyCount'] = count($meta) - 1;
    $byMap = [];
    foreach ($meta as $k => $v) { if ($k === '_global' || !is_array($v)) continue; $b = (string)($v['by'] ?? ''); if ($b === '') continue; $byMap[$b] = ($byMap[$b] ?? 0) + 1; }
    arsort($byMap);
    $OUT['meta']['writersHistogram'] = array_slice($byMap, 0, 15, true);
} else { $OUT['errors'][] = 'meta.json unreadable'; }

/* ---------- ۴) push_stats.json — چه کسی/چه روزی کلید پیشنهاد را push کرد ---------- */
$ps = jdec($SYNC . '/push_stats.json');
if (is_array($ps)) {
    $row = $ps['ptf_crm_offers'] ?? null;
    if (is_array($row) && is_array($row['d'] ?? null)) { ksort($row['d']); $row['perDay'] = $row['d']; unset($row['d']); }
    $OUT['pushStats']['ptf_crm_offers'] = $row;
    $OUT['pushStats']['pushStatsFileMtime'] = mt($SYNC . '/push_stats.json');
    $top = [];
    foreach ($ps as $k => $r) if (is_array($r)) $top[] = ['key' => $k, 'n' => (int)($r['n'] ?? 0), 'conflicts' => (int)($r['conflicts'] ?? 0), 'rejects' => (int)($r['rejects'] ?? 0), 'lastAt' => (string)($r['lastAt'] ?? ''), 'lastBy' => (string)($r['lastBy'] ?? '')];
    usort($top, function ($a, $b) { return $b['n'] <=> $a['n']; });
    $OUT['pushStats']['top12'] = array_slice($top, 0, 12);
    /* چه کسانی کلید پیشنهاد را push کرده‌اند؟ (lastBy فقط آخرین نفر است) */
    $OUT['pushStats']['offersLastBy'] = is_array($row) ? (string)($row['lastBy'] ?? '') : null;
} else { $OUT['errors'][] = 'push_stats.json unreadable'; }

/* ---------- ۵) سپر حذف انبوه، تراکنش‌های معلق، قفل ---------- */
$ml = $SYNC . '/mass_deletion_blocked.log';
if (is_file($ml)) {
    $lines = @file($ml, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [];
    $offerLines = [];
    foreach ($lines as $ln) if (strpos($ln, 'ptf_crm_offers') !== false) $offerLines[] = mb_substr($ln, 0, 400);
    $OUT['massDeletionLog'] = ['fileMtime' => mt($ml), 'lines' => count($lines), 'offerLines' => array_slice($offerLines, -30), 'tail' => array_map(function ($l) { return mb_substr($l, 0, 300); }, array_slice($lines, -10))];
} else { $OUT['massDeletionLog'] = null; }
$pending = [];
foreach ((glob($SYNC . '/.sales-tx-*') ?: []) as $p) $pending[] = ['name' => basename($p), 'mtime' => mt($p), 'bytes' => sz($p)];
$OUT['pendingTransactions'] = $pending;
$OUT['metaLock'] = is_file($SYNC . '/meta.json.lock') ? ['exists' => true, 'mtime' => mt($SYNC . '/meta.json.lock')] : ['exists' => false];

/* ---------- ۶) آرشیو حذف: سنگ‌قبرها ---------- */
$arc = jdec($SYNC . '/ptf_crm_deleted_archive.json');
$arc = is_array($arc) ? $arc : [];
$kindHist = []; $offerTomb = []; $purgeOffer = [];
foreach ($arc as $d) {
    if (!is_array($d)) continue;
    $kd = strtolower((string)($d['kind'] ?? '')); if ($kd === '') $kd = '(empty)';
    $kindHist[$kd] = ($kindHist[$kd] ?? 0) + 1;
    if (in_array($kd, ['offer', 'offers', 'to', 'co', 'tc'], true)) $offerTomb[] = ['id' => (string)($d['id'] ?? $d['no'] ?? ''), 'kind' => (string)$d['kind'], 'at' => (string)($d['iso'] ?? $d['deletedAt'] ?? ''), 'by' => (string)($d['by'] ?? $d['deletedBy'] ?? ''), 'reason' => mb_substr((string)($d['reason'] ?? ''), 0, 140), 'label' => mb_substr((string)($d['label'] ?? ''), 0, 80)];
    if ($kd === 'archive_purge') {
        $ids = $d['identities']['ptf_crm_offers'] ?? null;
        if (is_array($ids) && $ids) $purgeOffer[] = ['at' => (string)($d['iso'] ?? $d['deletedAt'] ?? ''), 'by' => (string)($d['by'] ?? $d['deletedBy'] ?? ''), 'collection' => (string)($d['collection'] ?? ''), 'reason' => mb_substr((string)($d['reason'] ?? ''), 0, 140), 'count' => count($ids), 'ids' => array_slice(array_map('strval', $ids), 0, 25)];
    }
}
arsort($kindHist);
$OUT['deletedArchive'] = ['rows' => count($arc), 'kindHistogram' => array_slice($kindHist, 0, 25, true), 'offerLikeTombstones' => count($offerTomb), 'offerLikeLast15' => array_slice($offerTomb, -15), 'offerPurgeTombstones' => count($purgeOffer), 'offerPurgeLast10' => array_slice($purgeOffer, -10)];

/* ---------- ۷) ژورنال فرمان‌های سرور پیگیری (sales_commands) ---------- */
$journal = jdec($SYNC . '/ptf_crm_sales_commands.json');
if (is_array($journal)) {
    $byAction = []; $byUser = []; $byDay = []; $minAt = ''; $maxAt = '';
    $regMissing = []; $regTotal = 0; $regCreated = 0; $regMin = ''; $regMax = '';
    $delLike = [];
    foreach ($journal as $c) {
        if (!is_array($c)) continue;
        $act = (string)($c['action'] ?? ''); $at = (string)($c['at'] ?? ''); $by = (string)($c['by'] ?? '');
        $byAction[$act] = ($byAction[$act] ?? 0) + 1;
        $byUser[$by] = ($byUser[$by] ?? 0) + 1;
        if ($at !== '') { $d = mb_substr($at, 0, 10); $byDay[$d] = ($byDay[$d] ?? 0) + 1; if ($minAt === '' || $at < $minAt) $minAt = $at; if ($maxAt === '' || $at > $maxAt) $maxAt = $at; }
        $res = is_array($c['result'] ?? null) ? $c['result'] : [];
        if ($act === 'register_offer') {
            $regTotal++; if ($at !== '' && ($regMin === '' || $at < $regMin)) $regMin = $at; if ($at !== '' && ($regMax === '' || $at > $regMax)) $regMax = $at;
            if (!empty($res['created'])) $regCreated++;
            $no = trim((string)($res['offerNo'] ?? ''));
            if ($no !== '' && !isset($liveNo[$no])) $regMissing[] = ['no' => $no, 'at' => $at, 'by' => $by, 'created' => !empty($res['created']), 'offerId' => (string)($res['offerId'] ?? ''), 'rfqId' => (string)($res['rfqId'] ?? ''), 'reason' => (string)($c['key'] ?? '')];
        }
        $delish = ['entity_delete', 'admin_delete_commit', 'delete_offer', 'purge', 'revoke_orphan_delete', 'duplicate_case_merge', 'archived_case_purge_commit', 'cleanup'];
        if (in_array($act, $delish, true)) {
            $delLike[] = ['action' => $act, 'at' => $at, 'by' => $by, 'collection' => (string)($res['collection'] ?? ''), 'id' => (string)($res['id'] ?? ''), 'deleted' => $res['deleted'] ?? null, 'reason' => mb_substr((string)($c['key'] ?? ''), 0, 80), 'keys' => is_array($res['keys'] ?? null) ? array_slice($res['keys'], 0, 8) : null];
        }
    }
    arsort($byAction); arsort($byUser); ksort($byDay);
    usort($regMissing, function ($a, $b) { return strcmp((string)$a['at'], (string)$b['at']); });
    $OUT['journal'] = ['rows' => count($journal), 'fileMtime' => mt($SYNC . '/ptf_crm_sales_commands.json'), 'minAt' => $minAt, 'maxAt' => $maxAt,
        'byAction' => $byAction, 'byUser' => array_slice($byUser, 0, 15, true), 'byDay' => $byDay,
        'registerTotal' => $regTotal, 'registerCreated' => $regCreated, 'registerMinAt' => $regMin, 'registerMaxAt' => $regMax,
        'registeredButMissingCount' => count($regMissing), 'registeredButMissing' => array_slice($regMissing, 0, 400),
        'deleteLikeCount' => count($delLike), 'deleteLikeLast40' => array_slice($delLike, -40)];
} else { $OUT['journal'] = null; $OUT['notes'][] = 'ptf_crm_sales_commands.json یافت نشد (یا ژورنال خالی است).'; }

/* ---------- ۸) بک‌آپ‌ها: خط زمانی و «چه چیزی گم شد» ---------- */
$bkFiles = [];
if (is_dir($BK)) {
    foreach ((scandir($BK) ?: []) as $f) {
        if ($f === '.' || $f === '..') continue;
        if (substr($f, -5) !== '.json' && substr($f, -8) !== '.json.gz') continue;
        $bkFiles[] = ['name' => $f, 'mtime' => filemtime($BK . '/' . $f), 'size' => filesize($BK . '/' . $f)];
    }
}
usort($bkFiles, function ($a, $b) { return $b['mtime'] <=> $a['mtime']; });
$OUT['backups']['dir'] = $BK;
$OUT['backups']['files'] = array_map(function ($f) { return ['name' => $f['name'], 'mtime' => date('c', $f['mtime']), 'kb' => round($f['size'] / 1024)]; }, array_slice($bkFiles, 0, 30));
$snaps = [];
foreach (array_slice($bkFiles, 0, 12) as $f) {
    $j = bkgz($BK . '/' . $f['name']);
    if (!is_array($j)) { $OUT['errors'][] = 'backup unreadable: ' . $f['name']; continue; }
    $rows = [];
    $v = $j['data']['ptf_crm_offers'] ?? null;
    if (is_string($v)) { $d = json_decode($v, true); if (is_array($d)) $rows = $d; }
    elseif (is_array($v)) $rows = $v;
    $nos = olist($rows);
    $snaps[] = ['name' => $f['name'], 'fileMtime' => date('c', $f['mtime']), 'snapT' => (string)($j['t'] ?? ''), 'by' => (string)($j['by'] ?? ''),
        'countsOffers' => (int)(($j['counts'] ?? [])['ptf_crm_offers'] ?? count($nos)), 'offersCount' => count($nos),
        'countsRfqs' => (int)(($j['counts'] ?? [])['ptf_crm_rfqs'] ?? 0), 'nos' => array_keys($nos), 'map' => $nos];
}
$OUT['backups']['snapshots'] = array_map(function ($s) { return ['name' => $s['name'], 'snapT' => $s['snapT'], 'by' => $s['by'], 'offersCount' => $s['offersCount'], 'countsOffers' => $s['countsOffers'], 'countsRfqs' => $s['countsRfqs'], 'fileMtime' => $s['fileMtime']]; }, $snaps);

/* دیف: پیشنهادهایی که در بک‌آپ هستند و زنده نیستند */
$missing = []; $windows = [];
if ($snaps) {
    $all = [];
    foreach ($snaps as $s) foreach ($s['map'] as $n => $info) if (!isset($liveNo[$n])) $all[$n] = true;
    foreach (array_keys($all) as $n) {
        $iHas = -1; $iMiss = -1;                     /* snaps: جدید → قدیم */
        foreach ($snaps as $i => $s) {
            if (isset($s['map'][$n])) { if ($iHas < 0) $iHas = $i; }
            elseif ($iHas >= 0 && $iMiss < 0) $iMiss = $i;
        }
        $src = ($iHas >= 0) ? ($snaps[$iHas]['map'][$n] ?? []) : [];
        $wk = ($iHas >= 0 ? $snaps[$iHas]['name'] : '?') . ' ← ' . ($iMiss >= 0 ? $snaps[$iMiss]['name'] : '—');
        if (!isset($windows[$wk])) $windows[$wk] = ['presentIn' => $iHas >= 0 ? $snaps[$iHas]['name'] : null, 'missingIn' => $iMiss >= 0 ? $snaps[$iMiss]['name'] : null,
            'presentAt' => $iHas >= 0 ? ($snaps[$iHas]['snapT'] !== '' ? $snaps[$iHas]['snapT'] : $snaps[$iHas]['fileMtime']) : null,
            'missingAt' => $iMiss >= 0 ? ($snaps[$iMiss]['snapT'] !== '' ? $snaps[$iMiss]['snapT'] : $snaps[$iMiss]['fileMtime']) : null, 'count' => 0, 'sample' => []];
        $windows[$wk]['count']++;
        if (count($windows[$wk]['sample']) < 30) $windows[$wk]['sample'][] = $n;
        $missing[] = array_merge($src, ['lastSeenIn' => $iHas >= 0 ? $snaps[$iHas]['name'] : null,
            'firstMissingIn' => $iMiss >= 0 ? $snaps[$iMiss]['name'] : null,
            'lossFrom' => $iHas >= 0 ? ($snaps[$iHas]['snapT'] !== '' ? $snaps[$iHas]['snapT'] : $snaps[$iHas]['fileMtime']) : null,
            'lossTo' => $iMiss >= 0 ? ($snaps[$iMiss]['snapT'] !== '' ? $snaps[$iMiss]['snapT'] : $snaps[$iMiss]['fileMtime']) : null]);
    }
}
$byDay = [];
foreach ($missing as $m) { $d = (string)($m['day'] ?? '?'); $byDay[$d] = ($byDay[$d] ?? 0) + 1; }
ksort($byDay);
$OUT['analysis'] = ['lostCount' => count($missing), 'lostByDay' => $byDay, 'lossWindows' => array_values($windows), 'lostOffers' => array_slice($missing, 0, 600)];

/* ---------- ۹) دو مسیر جانبی (TOCO و یتیم‌نمایی) ---------- */
$toco = [];
foreach ($liveSorted as $o) {
    $s = (string)$o['srcToNo'];
    if ($s !== '' && !isset($liveNo[$s]) && $o['rialOf'] === '' && $o['fxOf'] === '') $toco[] = ['co' => $o['no'], 'missingTo' => $s, 't' => $o['t']];
}
$OUT['tocoSuspects'] = $toco;
$rfqs = jdec($SYNC . '/ptf_crm_rfqs.json'); $rfqs = is_array($rfqs) ? $rfqs : [];
$rkeys = [];
foreach ($rfqs as $r) { if (!is_array($r)) continue; if (!empty($r['cd'])) $rkeys[(string)$r['cd']] = 1; if (!empty($r['inqNo'])) $rkeys[(string)$r['inqNo']] = 1; }
$orphan = [];
foreach ($liveSorted as $o) { $q = (string)$o['inqNo']; if ($q !== '' && !isset($rkeys[$q])) $orphan[] = ['no' => $o['no'], 'inqNo' => $q, 'day' => $o['day']]; }
$OUT['rfqCheck'] = ['rfqCount' => count($rfqs), 'orphanLookingCount' => count($orphan), 'sample' => array_slice($orphan, 0, 25)];

/* ---------- ۱۰) وضعیت پرونده‌های فروش (اگر پیشنهاد رفته، پرونده هست؟) ---------- */
$deals = jdec($SYNC . '/ptf_crm_deals.json'); $deals = is_array($deals) ? $deals : [];
$caseNos = [];
foreach ($deals as $d) { if (!is_array($d)) continue; $n = trim((string)($d['wonOffer'] ?? ($d['offerNo'] ?? ''))); if ($n !== '') $caseNos[$n] = ['caseId' => (string)($d['_id'] ?? ($d['cd'] ?? '')), 'st' => (string)($d['st'] ?? ''), 'offerNo' => $n, 'amount' => (string)($d['contractAmount'] ?? '')]; }
$lostWithCase = [];
foreach ($missing as $m) { if (isset($caseNos[$m['no']])) $lostWithCase[] = ['offerNo' => $m['no'], 'case' => $caseNos[$m['no']]]; }
$OUT['dealLinkCheck'] = ['dealsCount' => count($deals), 'lostOffersThatStillHaveCase' => count($lostWithCase), 'sample' => array_slice($lostWithCase, 0, 25)];

/* ---------- ۱۱) فایل‌های کلیدی: تازگی + دایرکتوری ---------- */
$interesting = ['ptf_crm_offers', 'ptf_crm_rfqs', 'ptf_crm_deleted_archive', 'ptf_crm_sales_commands', 'meta', 'push_stats', 'engine_flags'];
$OUT['files'] = [];
foreach ($interesting as $k) {
    $p = $SYNC . '/' . $k . '.json';
    if (!is_file($p) && $k === 'meta') $p = $SYNC . '/meta.json';
    $OUT['files'][$k] = ['exists' => is_file($p), 'mtime' => mt($p), 'bytes' => sz($p)];
}
$OUT['engineFlags'] = jdec($SYNC . '/engine_flags.json');
$dir = [];
foreach ((scandir($SYNC) ?: []) as $f) { if ($f === '.' || $f === '..') continue; $dir[] = ['name' => $f, 'mtime' => mt($SYNC . '/' . $f), 'bytes' => sz($SYNC . '/' . $f)]; }
usort($dir, function ($a, $b) { return strcmp((string)$b['mtime'], (string)$a['mtime']); });
$OUT['syncDirNewest25'] = array_slice($dir, 0, 25);

/* ---------- ۱۲) مارکر استقرار ---------- */
foreach ([__DIR__ . '/__deploy__.txt', dirname($DATA) . '/__deploy__.txt', dirname($DATA, 2) . '/__deploy__.txt'] as $p) {
    if (is_file($p)) { $OUT['deploy'] = ['file' => $p, 'mtime' => mt($p), 'text' => mb_substr((string)fraw($p), 0, 600)]; break; }
}

/* ---------- ۱۳) حکم خودکار ---------- */
$verdict = []; $evidence = [];
$offerMeta = is_array($meta) ? ($meta['ptf_crm_offers'] ?? null) : null;
if (is_array($offerMeta) && !empty($offerMeta['t'])) $evidence[] = 'meta.ptf_crm_offers: آخرین نوشتن ' . $offerMeta['t'] . ' توسط «' . (string)($offerMeta['by'] ?? '?') . '» (rev=' . (int)($offerMeta['rev'] ?? 0) . ')';
if (is_array($OUT['pushStats']['ptf_crm_offers'] ?? null)) {
    $r = $OUT['pushStats']['ptf_crm_offers'];
    $evidence[] = 'push_stats: ' . (int)($r['n'] ?? 0) . ' push، lastAt=' . (string)($r['lastAt'] ?? '?') . '، lastBy=«' . (string)($r['lastBy'] ?? '?') . '»، conflicts=' . (int)($r['conflicts'] ?? 0) . '، rejects=' . (int)($r['rejects'] ?? 0);
}
$evidence[] = 'سنگ‌قبر پیشنهاد در آرشیو: ' . (int)$OUT['deletedArchive']['offerLikeTombstones'] . ' | archive_purge با identities پیشنهاد: ' . (int)$OUT['deletedArchive']['offerPurgeTombstones'];
$evidence[] = 'ژورنال فرمان: ' . (is_array($OUT['journal']) ? (int)$OUT['journal']['rows'] . ' ردیف، فرمان‌های حذفی=' . (int)$OUT['journal']['deleteLikeCount'] . '، register_offer گم‌شده=' . (int)$OUT['journal']['registeredButMissingCount'] : 'ناخوانا');
$evidence[] = 'بک‌آپ: ' . count($snaps) . ' اسنپ‌شات بررسی شد؛ گم‌شده نسبت به بک‌آپ=' . (int)$OUT['analysis']['lostCount'];
$evidence[] = 'سپر حذف انبوه: ' . ($OUT['massDeletionLog'] ? (count($OUT['massDeletionLog']['offerLines']) . ' ردیف مربوط به پیشنهاد') : 'فایل وجود ندارد');
$OUT['verdict'] = ['evidence' => $evidence];

if ($OUT['analysis']['lostCount'] > 0 || $OUT['deletedArchive']['offerPurgeTombstones'] > 0) {
    if ($OUT['deletedArchive']['offerPurgeTombstones'] > 0 || (is_array($OUT['journal']) && $OUT['journal']['deleteLikeCount'] > 0)) {
        $OUT['verdict']['channel'] = 'B-command-path';
        $OUT['verdict']['text'] = 'حذف از مسیر «فرمان دامنه» (entity_delete/admin_delete/purge) رخ داده — سنگ‌قبر archive_purge و/یا ردیف حذفی در ژورنال هست. نویسنده و زمان از همان ردیف‌ها قابل تعیین است.';
    } elseif (is_array($OUT['pushStats']['ptf_crm_offers'] ?? null) && (string)($OUT['pushStats']['ptf_crm_offers']['lastAt'] ?? '') !== '') {
        $OUT['verdict']['channel'] = 'A-stale-whole-array-push';
        $OUT['verdict']['text'] = 'هیچ سنگ‌قبری نیست ولی کلید پیشنهادها push شمرده شده ⇒ محتمل‌ترین کانال: push جایگزینیِ کل آرایه با نسخهٔ کهنهٔ یک دستگاه (سپر انبوه چون افت <۳ ردیف یا <۲۵٪ بوده فعال نشده). lastBy/lastAt در push_stats و meta = نویسندهٔ مظنون.';
    } else {
        $OUT['verdict']['channel'] = 'C-no-trace';
        $OUT['verdict']['text'] = 'نه push کلید پیشنهاد ثبت شده و نه سنگ‌قبر/فرمان حذفی ⇒ حذف از بیرونِ مسیرهای CRM رخ داده (چرخش بک‌آپ، بازنویسی دستی فایل، تفاوت فایل↔DB، یا چرخش حساب). مقایسهٔ DB/فایل بالا را ببینید.';
    }
} else if ($OUT['analysis']['lostCount'] === 0) {
    $OUT['verdict']['channel'] = 'D-not-in-backups';
    $OUT['verdict']['text'] = 'در بک‌آپ‌های موجود هیچ پیشنهادِ زنده‌نشده‌ای پیدا نشد. یعنی یا بک‌آپ‌های کافی از قبل از حادثه نداریم، یا حذف پیش از بازهٔ بک‌آپ‌های چرخشی (۳ روزه) بوده. اگر ردیف‌های «ژورنال: register_offer گم‌شده» ناصفر است، همان‌ها موجودیت‌های گم‌شدهٔ قطعی‌اند (شاهد مستقل از بک‌آپ).';
}

/* ---------- نمایش ---------- */
echo '<!doctype html><html dir="rtl"><head><meta charset="utf-8"><title>Offer Loss Forensics v2</title></head>'
   . '<body style="font-family:Tahoma;font-size:12px;background:#f8fafc;padding:14px;line-height:1.9">';
echo '<h2>🔎 کارآگاهی نسخهٔ ۲ — «پیشنهادهای چند روز اخیر» (فقط‌خواندنی)</h2>';
echo '<p>پوشهٔ داده: <code dir="ltr">' . htmlspecialchars($DATA) . '</code> · پوشهٔ sync: <code dir="ltr">' . htmlspecialchars($SYNC) . '</code> · حالت DB: <b dir="ltr">' . htmlspecialchars((string)$OUT['db']['mode']) . '</b></p>';
echo '<table cellpadding="5" style="border-collapse:collapse;border:1px solid #cbd5e1;background:#fff">';
$rowsUi = [
    ['پیشنهادهای زنده روی سرور', (int)$OUT['live']['offersCount']],
    ['تاریخ فایل زنده / مهر', (string)$OUT['live']['fileMtime']],
    ['جدیدترین پیشنهاد باقی‌مانده', $OUT['live']['newestRemaining'] ? ($OUT['live']['newestRemaining']['no'] . ' — ' . $OUT['live']['newestRemaining']['t'] . ' (' . $OUT['live']['newestRemaining']['kind'] . ')') : '—'],
    ['آخرین نویسندهٔ کلید پیشنهاد (meta)', $offerMeta ? ((string)($offerMeta['by'] ?? '?') . ' @ ' . (string)($offerMeta['t'] ?? '?') . ' — rev ' . (int)($offerMeta['rev'] ?? 0)) : '—'],
    ['آخرین push کلید پیشنهاد (push_stats)', is_array($OUT['pushStats']['ptf_crm_offers'] ?? null) ? ((string)($OUT['pushStats']['ptf_crm_offers']['lastBy'] ?? '?') . ' @ ' . (string)($OUT['pushStats']['ptf_crm_offers']['lastAt'] ?? '?') . ' — n=' . (int)($OUT['pushStats']['ptf_crm_offers']['n'] ?? 0)) : '—'],
    ['سنگ‌قبر پیشنهاد / archive_purge پیشنهاد', (int)$OUT['deletedArchive']['offerLikeTombstones'] . ' / ' . (int)$OUT['deletedArchive']['offerPurgeTombstones']],
    ['ژورنال فرمان — register_offer گم‌شده', is_array($OUT['journal']) ? ((int)$OUT['journal']['registeredButMissingCount'] . ' از ' . (int)$OUT['journal']['registerTotal']) : '—'],
    ['ژورنال فرمان — فرمان‌های حذفی', is_array($OUT['journal']) ? (int)$OUT['journal']['deleteLikeCount'] : '—'],
    ['گم‌شده نسبت به بک‌آپ‌ها', (int)$OUT['analysis']['lostCount']],
    ['سپر حذف انبوه (ردیف‌های پیشنهاد)', $OUT['massDeletionLog'] ? count($OUT['massDeletionLog']['offerLines']) : 'فایل نیست'],
    ['تراکنش معلق (.sales-tx-*)', count($pending)],
    ['TOCO مشکوک / یتیم‌نما', count($toco) . ' / ' . (int)$OUT['rfqCheck']['orphanLookingCount']],
    ['پروندهٔ فروش برای پیشنهادهای گم‌شده', (int)$OUT['dealLinkCheck']['lostOffersThatStillHaveCase']],
];
foreach ($rowsUi as $r) echo '<tr><th style="border:1px solid #cbd5e1;text-align:right;background:#f1f5f9">' . htmlspecialchars($r[0]) . '</th><td style="border:1px solid #cbd5e1" dir="ltr">' . htmlspecialchars((string)$r[1]) . '</td></tr>';
echo '</table>';

echo '<h3>حکم خودکار: <span dir="ltr" style="color:#b91c1c">' . htmlspecialchars((string)($OUT['verdict']['channel'] ?? '—')) . '</span></h3>';
echo '<p style="background:#fff7ed;border:1px solid #fed7aa;padding:8px">' . htmlspecialchars((string)($OUT['verdict']['text'] ?? '')) . '</p>';
if ($OUT['verdict']['evidence']) {
    echo '<ul>';
    foreach ($OUT['verdict']['evidence'] as $e) echo '<li>' . htmlspecialchars($e) . '</li>';
    echo '</ul>';
}
if ($OUT['analysis']['lossWindows']) {
    echo '<h3>پنجرهٔ ناپدیدشدن (آخرین بک‌آپی که دارد ← اولین بک‌آپی که ندارد)</h3><table cellpadding="5" style="border-collapse:collapse;border:1px solid #cbd5e1;background:#fff"><tr><th style="border:1px solid #cbd5e1">دارد تا</th><th style="border:1px solid #cbd5e1">ندارد از</th><th style="border:1px solid #cbd5e1">تعداد</th><th style="border:1px solid #cbd5e1">نمونه</th></tr>';
    foreach ($OUT['analysis']['lossWindows'] as $w) {
        echo '<tr><td style="border:1px solid #cbd5e1" dir="ltr">' . htmlspecialchars((string)$w['presentAt']) . '<br><small>' . htmlspecialchars((string)$w['presentIn']) . '</small></td>'
           . '<td style="border:1px solid #cbd5e1" dir="ltr">' . htmlspecialchars((string)$w['missingAt']) . '<br><small>' . htmlspecialchars((string)$w['missingIn']) . '</small></td>'
           . '<td style="border:1px solid #cbd5e1"><b>' . (int)$w['count'] . '</b></td>'
           . '<td style="border:1px solid #cbd5e1" dir="ltr">' . htmlspecialchars(implode('، ', (array)$w['sample'])) . '</td></tr>';
    }
    echo '</table>';
}
if ($OUT['analysis']['lostByDay']) {
    echo '<h3>گم‌شده‌ها به تفکیک روز</h3><table cellpadding="5" style="border-collapse:collapse;border:1px solid #cbd5e1;background:#fff">';
    foreach ($OUT['analysis']['lostByDay'] as $d => $n) echo '<tr><td style="border:1px solid #cbd5e1" dir="ltr">' . htmlspecialchars((string)$d) . '</td><td style="border:1px solid #cbd5e1">' . (int)$n . '</td></tr>';
    echo '</table>';
}
echo '<h3>گزارش کامل (همین را کپی و بفرستید)</h3>';
if ($OUT['errors']) echo '<p style="color:#b91c1c">خطاها: ' . htmlspecialchars(implode(' | ', $OUT['errors'])) . '</p>';
echo '<textarea readonly style="width:100%;height:460px;direction:ltr;font-family:monospace;font-size:11px">'
   . htmlspecialchars(json_encode($OUT, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT)) . '</textarea>';
echo '<p style="color:#b91c1c"><b>یادآوری: پس از ارسال خروجی، این فایل را از هاست حذف کنید.</b></p>';
echo '</body></html>';
