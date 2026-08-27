<?php
/**
 * PTF Public Tools API — v31.7.97 BUG-FISCAL-PROFIT-ICON-UX-001
 * Manual-license gate with persistent staff grants, privacy-aware aggregate metrics, public tool feedback inbox, draft review workflow, engineering/vendor validation matrix and final HTML report issue for advanced engineering reports.
 *
 * Phase-1 scope:
 *   - license_check: validate a manually issued license code.
 *   - grant_verify: validate a short-lived grant returned by license_check.
 *   - status: non-sensitive endpoint status.
 *
 * Notes:
 *   - Raw license codes are never stored server-side; compare HMAC hashes.
 *   - Final report issue generates immutable English HTML; server-side binary PDF remains a later library-dependent phase.
 * Legacy phase: ADV-CV-ENGINEERING-VALIDATION-MATRIX-001.
 * Legacy phase: ADV-CV-VENDOR-DATA-VALIDATION-001.
 * Legacy phase: TOOLS-STAFF-LICENSE-PERSISTENCE-001.
 * Legacy phase: ADV-CV-DEMO-REPORT-DATASHEET-ASSIST-001.
 * Legacy phase: ADV-CV-DEDICATED-LANDING-SEO-001.
 * Legacy phase: TOOLS-FEEDBACK-CRM-INBOX-001.
 * Legacy phase: ADV-CV-FIRST-SEO-ARTICLE-001.
 * Legacy phase: ADV-CV-CAVITATION-SEO-ARTICLE-001.
 * Legacy phase: ADV-CV-CV-KV-DIFFERENCE-SEO-ARTICLE-001.
 * Legacy phase: ADV-CV-TRIPLE-SEO-ARTICLE-001.
 * Legacy phase: TOOLS-FUNNEL-KPI-DASHBOARD-001.
 * Legacy phase: PRIVACY-METRICS-SERVER-SYNC-001.
 * Legacy phase: ADV-CV-RICH-SAMPLE-BRAND-MATRIX-001.
 * Legacy phase: BUG-OFFER-DUP-ITEMS-SETTINGS-ACCORDION-001.
 * Legacy phase: BUG-FINANCE-SUPPLIER-CONSISTENCY-UI-001.
 * Legacy phase: BUG-SYNC-TOMBSTONE-OPPO-LINECHART-001.
 * Legacy phase: BUG-FISCAL-PROFIT-ICON-UX-001.
 */
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');

require_once __DIR__ . '/secrets.php';
require_once __DIR__ . '/auth.php';

$ref = $_SERVER['HTTP_ORIGIN'] ?? $_SERVER['HTTP_REFERER'] ?? '';
$host = $_SERVER['HTTP_HOST'] ?? '';
if ($ref && $host && parse_url($ref, PHP_URL_HOST) !== $host) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'Cross-origin blocked'], JSON_UNESCAPED_UNICODE);
    exit;
}

$data_dir = __DIR__ . '/../crm/data';
if (!is_dir($data_dir)) {
    @mkdir($data_dir, 0755, true);
    @file_put_contents($data_dir . '/.htaccess', "Deny from all\n");
}

function tools_secret() {
    return load_ptf_secret('tools_license_key', 'ptf-tools-license-dev-key-change-in-production');
}
function tools_license_file() {
    global $data_dir;
    return $data_dir . '/tool_licenses.json';
}
function tools_report_drafts_file() {
    global $data_dir;
    return $data_dir . '/tool_report_drafts.json';
}
function tools_feedback_file() {
    global $data_dir;
    return $data_dir . '/tool_feedback.json';
}
function tools_metrics_file() {
    global $data_dir;
    return $data_dir . '/tool_metrics.json';
}
function tools_rate_file() {
    global $data_dir;
    return $data_dir . '/tools_rate.json';
}
function tools_clean($v, $max = 120) {
    $v = trim((string)$v);
    $v = preg_replace('/[\x00-\x1F\x7F]/u', '', $v);
    if (function_exists('mb_substr')) return mb_substr($v, 0, $max, 'UTF-8');
    return substr($v, 0, $max);
}
function tools_read_input() {
    $raw = file_get_contents('php://input');
    $j = json_decode($raw, true);
    if (is_array($j)) return $j;
    return $_POST + $_GET;
}
function tools_rate_limit($action, $limit = 30) {
    $file = tools_rate_file();
    $now = time();
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'x';
    $key = hash('sha256', $ip . '|' . $action);
    $data = file_exists($file) ? (json_decode(@file_get_contents($file), true) ?: []) : [];
    foreach ($data as $k => $v) {
        if (($v['t'] ?? 0) < $now - 3600) unset($data[$k]);
    }
    $rec = $data[$key] ?? ['t' => $now, 'n' => 0];
    if (($rec['t'] ?? 0) < $now - 3600) $rec = ['t' => $now, 'n' => 0];
    $rec['n'] = (int)($rec['n'] ?? 0) + 1;
    $data[$key] = $rec;
    @file_put_contents($file, json_encode($data, JSON_UNESCAPED_UNICODE), LOCK_EX);
    return $rec['n'] <= $limit;
}
function tools_load_licenses() {
    $file = tools_license_file();
    if (!file_exists($file)) return [];
    $j = json_decode(@file_get_contents($file), true);
    if (!$j) return [];
    if (isset($j['licenses']) && is_array($j['licenses'])) return $j['licenses'];
    return is_array($j) ? $j : [];
}

function tools_save_licenses($licenses) {
    $file = tools_license_file();
    $dir = dirname($file);
    if (!is_dir($dir)) @mkdir($dir, 0755, true);
    $payload = [
        'updatedAt' => date('c'),
        'licenses' => array_values($licenses),
    ];
    return @file_put_contents($file, json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX) !== false;
}
function tools_admin_require() {
    $token = auth_get_header_token();
    if (!$token) {
        http_response_code(401);
        echo json_encode(['ok' => false, 'error' => 'Authentication required', 'needLogin' => true], JSON_UNESCAPED_UNICODE);
        exit;
    }
    $info = auth_verify_token($token);
    if (!$info) {
        http_response_code(401);
        echo json_encode(['ok' => false, 'error' => 'Invalid or expired token', 'needLogin' => true], JSON_UNESCAPED_UNICODE);
        exit;
    }
    $role = $info['role'] ?? '';
    if (!in_array($role, ['admin', 'chairman'], true)) {
        /* v34.8.30 (STALE-TOKEN-HEAL): اگر نقش «فعلیِ» همین کاربر در مخزن کاربران
           admin/chairman باشد ولی توکن نقش دیگری داشته باشد ⇒ توکن کهنه است (نقش
           بعد از صدور تغییر کرده). 401/needLogin برمی‌گردانیم تا کلاینت دوباره
           وارد شود و توکن تازه با نقش درست ضرب شود — به‌جای حلقهٔ بی‌پایان 403. */
        $currentRole = '';
        try {
            $dataDir = __DIR__ . '/../crm/data';
            $candidates = [$dataDir . '/users.json', $dataDir . '/crm_users.json', $dataDir . '/sync/ptf_crm_users.json'];
            $u = strtolower(trim((string)($info['user'] ?? '')));
            foreach ($candidates as $cf) {
                if (!is_file($cf)) continue;
                $list = json_decode((string)file_get_contents($cf), true);
                if (!is_array($list)) continue;
                foreach ($list as $row) {
                    if (!is_array($row)) continue;
                    if (strtolower(trim((string)($row['username'] ?? ''))) !== $u) continue;
                    $rid = strtolower(trim((string)($row['roleId'] ?? '')));
                    if ($rid === '' ) $rid = strtolower(trim((string)($row['role'] ?? '')));
                    if ($rid !== '') { $currentRole = $rid; break 2; }
                }
            }
        } catch (Throwable $e) { /* تشخیص ممکن نشد → 403 عادی */ }
        if (in_array($currentRole, ['admin', 'chairman'], true)) {
            http_response_code(401);
            echo json_encode(['ok' => false, 'error' => 'stale_token_role_changed', 'needLogin' => true, 'detail' => 'نقش شما تغییر کرده — دوباره وارد شوید'], JSON_UNESCAPED_UNICODE);
            exit;
        }
        http_response_code(403);
        echo json_encode(['ok' => false, 'error' => 'admin_required'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    return $info;
}
function tools_safe_license_admin($lic) {
    $safe = tools_safe_license($lic);
    $safe['status'] = $lic['status'] ?? 'active';
    $safe['issuedTo'] = $lic['issuedTo'] ?? ['company' => '', 'contact' => ''];
    $safe['issuedAt'] = $lic['issuedAt'] ?? '';
    $safe['issuedBy'] = $lic['issuedBy'] ?? '';
    $safe['updatedAt'] = $lic['updatedAt'] ?? '';
    $safe['updatedBy'] = $lic['updatedBy'] ?? '';
    $safe['note'] = $lic['note'] ?? '';
    $safe['rawCodeStored'] = false;
    return $safe;
}
function tools_random_code($tool, $type) {
    $prefix = 'LIC-PTF';
    if ($type === 'staff_internal') $prefix .= '-STAFF';
    elseif ($tool === 'control_valve_advanced') $prefix .= '-CV';
    else $prefix .= '-ADV';
    $raw = strtoupper(bin2hex(random_bytes(9)));
    return $prefix . '-' . date('ymd') . '-' . substr($raw, 0, 6) . '-' . substr($raw, 6, 6) . '-' . substr($raw, 12, 6);
}
function tools_license_id_from_code($code) {
    return 'LIC-PTF-' . date('Ymd-His') . '-' . strtoupper(substr(hash('sha256', $code), 0, 6));
}
function tools_norm_tool($tool) {
    $tool = tools_clean($tool, 80);
    $allowed = ['all', 'control_valve_advanced', 'piping_advanced', 'pump_selection', 'flowmeter_orifice', 'electrical_engineering', 'instrumentation'];
    return in_array($tool, $allowed, true) ? $tool : 'control_valve_advanced';
}
function tools_norm_type($type) {
    $type = tools_clean($type, 60);
    $allowed = ['single_report', 'subscription', 'enterprise', 'staff_internal'];
    return in_array($type, $allowed, true) ? $type : 'single_report';
}
function tools_norm_status($status) {
    $status = tools_clean($status, 30);
    $allowed = ['active', 'suspended', 'revoked'];
    return in_array($status, $allowed, true) ? $status : 'active';
}

function tools_load_report_drafts() {
    $file = tools_report_drafts_file();
    if (!file_exists($file)) return [];
    $j = json_decode(@file_get_contents($file), true);
    if (!$j) return [];
    if (isset($j['drafts']) && is_array($j['drafts'])) return $j['drafts'];
    return is_array($j) ? $j : [];
}
function tools_save_report_drafts($drafts) {
    $file = tools_report_drafts_file();
    $dir = dirname($file);
    if (!is_dir($dir)) @mkdir($dir, 0755, true);
    $payload = ['updatedAt' => date('c'), 'drafts' => array_values($drafts)];
    return @file_put_contents($file, json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT), LOCK_EX) !== false;
}
function tools_load_feedback() {
    $file = tools_feedback_file();
    if (!file_exists($file)) return [];
    $j = json_decode(@file_get_contents($file), true);
    if (!$j) return [];
    if (isset($j['feedback']) && is_array($j['feedback'])) return $j['feedback'];
    return is_array($j) ? $j : [];
}
function tools_save_feedback($items) {
    $file = tools_feedback_file();
    $dir = dirname($file);
    if (!is_dir($dir)) @mkdir($dir, 0755, true);
    $payload = ['updatedAt' => date('c'), 'feedback' => array_values($items)];
    return @file_put_contents($file, json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT), LOCK_EX) !== false;
}
function tools_feedback_status($status) {
    $status = tools_clean($status, 40);
    $allowed = ['new', 'reviewed', 'contacted', 'converted', 'needs_followup', 'spam', 'archived'];
    return in_array($status, $allowed, true) ? $status : 'reviewed';
}
function tools_feedback_summary($f) {
    return [
        'feedbackId' => $f['feedbackId'] ?? '',
        'tool' => $f['tool'] ?? '',
        'source' => $f['source'] ?? '',
        'status' => $f['status'] ?? 'new',
        'createdAt' => $f['createdAt'] ?? '',
        'rating' => $f['rating'] ?? '',
        'role' => $f['role'] ?? '',
        'company' => $f['company'] ?? '',
        'contact' => $f['contact'] ?? '',
        'message' => $f['message'] ?? '',
        'sampleReportViewed' => !empty($f['sampleReportViewed']),
        'licenseId' => $f['licenseId'] ?? '',
        'pageUrl' => $f['pageUrl'] ?? '',
        'reviewNote' => $f['reviewNote'] ?? '',
        'reviewedAt' => $f['reviewedAt'] ?? '',
        'reviewedBy' => $f['reviewedBy'] ?? '',
        'historyCount' => is_array($f['history'] ?? null) ? count($f['history']) : 0,
    ];
}
function tools_find_feedback($feedbackId) {
    foreach (tools_load_feedback() as $f) if (($f['feedbackId'] ?? '') === $feedbackId) return $f;
    return null;
}
function tools_load_metrics() {
    $file = tools_metrics_file();
    if (!file_exists($file)) return ['updatedAt' => '', 'days' => []];
    $j = json_decode(@file_get_contents($file), true);
    if (!is_array($j)) return ['updatedAt' => '', 'days' => []];
    if (!isset($j['days']) || !is_array($j['days'])) $j['days'] = [];
    return $j;
}
function tools_save_metrics($data) {
    $file = tools_metrics_file();
    $dir = dirname($file);
    if (!is_dir($dir)) @mkdir($dir, 0755, true);
    if (!is_array($data)) $data = ['days' => []];
    $data['updatedAt'] = date('c');
    $days = is_array($data['days'] ?? null) ? $data['days'] : [];
    ksort($days, SORT_STRING);
    if (count($days) > 120) $days = array_slice($days, -120, null, true);
    $data['days'] = $days;
    return @file_put_contents($file, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT), LOCK_EX) !== false;
}
function tools_metric_event($v) {
    $v = preg_replace('/[^A-Za-z0-9_:\-]/', '_', tools_clean($v, 80));
    return $v ?: 'event';
}
function tools_metric_path($v) {
    $v = tools_clean($v, 180);
    $v = preg_replace('/[?#].*$/', '', $v);
    if ($v === '') return '/';
    if ($v[0] !== '/') return '/external';
    $v = preg_replace('/\/{2,}/', '/', $v);
    if (strlen($v) > 140) $v = substr($v, 0, 140);
    return $v;
}
function tools_metric_source($v) {
    $v = strtolower(tools_clean($v, 60));
    $v = preg_replace('/[^a-z0-9_\-\.]/', '_', $v);
    return $v ?: 'direct';
}
function tools_metric_day($t = '') {
    $ts = strtotime((string)$t);
    if (!$ts || abs(time() - $ts) > 120 * 24 * 3600) $ts = time();
    return gmdate('Y-m-d', $ts);
}
function tools_metrics_add(&$bucket, $key, $inc = 1) {
    $key = (string)$key;
    if ($key === '') $key = '-';
    if (!isset($bucket[$key])) $bucket[$key] = 0;
    $bucket[$key] += $inc;
}
function tools_metrics_summary($data, $daysBack = 30) {
    $days = is_array($data['days'] ?? null) ? $data['days'] : [];
    $cut = gmdate('Y-m-d', time() - max(1, (int)$daysBack) * 24 * 3600);
    $out = ['total' => 0, 'byEvent' => [], 'byPath' => [], 'bySource' => [], 'byEventPath' => [], 'days' => []];
    foreach ($days as $day => $d) {
        if ($day < $cut || !is_array($d)) continue;
        $dayTotal = (int)($d['total'] ?? 0);
        $out['total'] += $dayTotal;
        $out['days'][$day] = $dayTotal;
        foreach (['events' => 'byEvent', 'paths' => 'byPath', 'sources' => 'bySource', 'eventPath' => 'byEventPath'] as $src => $dst) {
            if (!is_array($d[$src] ?? null)) continue;
            foreach ($d[$src] as $k => $v) tools_metrics_add($out[$dst], $k, (int)$v);
        }
    }
    arsort($out['byEvent']); arsort($out['byPath']); arsort($out['bySource']); arsort($out['byEventPath']); ksort($out['days']);
    $ep = $out['byEventPath'];
    $out['funnel'] = [
        'toolsPageViews' => (int)($ep['page_view|/tools/'] ?? 0),
        'controlValveLandingViews' => (int)($ep['page_view|/tools/control-valve-sizing/'] ?? 0),
        'sampleReportOpens' => (int)(($out['byEvent']['advanced_cv_sample_report_open'] ?? 0) + ($out['byEvent']['advanced_cv_sample_report'] ?? 0)),
        'feedbackOpens' => (int)($out['byEvent']['advanced_cv_feedback_open'] ?? 0),
        'feedbackSubmits' => (int)($out['byEvent']['advanced_cv_feedback_submitted'] ?? 0),
        'rfqClicks' => (int)($out['byEvent']['cta_rfq_click'] ?? 0),
        'toolActivationClicks' => (int)(($out['byEvent']['advanced_cv_activation_request'] ?? 0) + ($out['byEvent']['advanced_tools_activation_request'] ?? 0)),
    ];
    return $out;
}
function tools_is_list_array($arr) {
    if (!is_array($arr)) return false;
    return array_keys($arr) === range(0, count($arr) - 1);
}
function tools_stable_json($v) {
    if (is_null($v) || is_bool($v) || is_int($v) || is_float($v) || is_string($v)) {
        return json_encode($v, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }
    if (is_array($v)) {
        if (tools_is_list_array($v)) {
            $parts = [];
            foreach ($v as $item) $parts[] = tools_stable_json($item);
            return '[' . implode(',', $parts) . ']';
        }
        $keys = array_keys($v);
        sort($keys, SORT_STRING);
        $parts = [];
        foreach ($keys as $k) {
            $parts[] = json_encode((string)$k, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . ':' . tools_stable_json($v[$k]);
        }
        return '{' . implode(',', $parts) . '}';
    }
    return json_encode($v, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}
function tools_ord_utf8($ch) {
    if (function_exists('mb_ord')) return mb_ord($ch, 'UTF-8');
    if (function_exists('mb_convert_encoding')) {
        $u = @unpack('N', mb_convert_encoding($ch, 'UTF-32BE', 'UTF-8'));
        if ($u && isset($u[1])) return (int)$u[1];
    }
    $b = unpack('C*', $ch);
    return $b ? (int)$b[1] : 0;
}
function tools_checksum32($str) {
    $h = 2166136261;
    $chars = preg_split('//u', (string)$str, -1, PREG_SPLIT_NO_EMPTY);
    if (!$chars) $chars = str_split((string)$str);
    foreach ($chars as $ch) {
        $code = tools_ord_utf8($ch);
        // Match JavaScript charCodeAt for BMP; split astral code points to surrogate pairs.
        $codes = [];
        if ($code > 0xFFFF) {
            $code -= 0x10000;
            $codes[] = 0xD800 + (($code >> 10) & 0x3FF);
            $codes[] = 0xDC00 + ($code & 0x3FF);
        } else $codes[] = $code;
        foreach ($codes as $c) {
            $h = ($h ^ $c) & 0xFFFFFFFF;
            $h = ($h + (($h << 1) + ($h << 4) + ($h << 7) + ($h << 8) + ($h << 24))) & 0xFFFFFFFF;
        }
    }
    return strtoupper(str_pad(dechex($h & 0xFFFFFFFF), 8, '0', STR_PAD_LEFT));
}
function tools_payload_without_checksum($payload) {
    if (!is_array($payload)) return $payload;
    $copy = $payload;
    if (isset($copy['reportMeta']) && is_array($copy['reportMeta'])) unset($copy['reportMeta']['checksum']);
    return $copy;
}
function tools_validate_report_payload($payload, $grantPayload, $tool) {
    if (!is_array($payload)) return [false, 'payload_required'];
    if (($payload['schema'] ?? '') !== 'ADV-CV-REPORT-PAYLOAD-v1') return [false, 'invalid_payload_schema'];
    $meta = $payload['reportMeta'] ?? [];
    if (!is_array($meta)) return [false, 'invalid_report_meta'];
    if (($meta['tool'] ?? 'control_valve_advanced') !== 'control_valve_advanced') return [false, 'tool_mismatch'];
    if (($meta['status'] ?? '') !== 'LOCKED_PREVIEW_PAYLOAD') return [false, 'invalid_payload_status'];
    if (($meta['final'] ?? null) !== false || ($meta['pdf'] ?? null) !== false || ($meta['download'] ?? null) !== false || ($meta['serverSideReport'] ?? null) !== false) return [false, 'payload_must_be_locked'];
    $clientChecksum = strtoupper((string)($meta['checksum'] ?? ''));
    if (!preg_match('/^[0-9A-F]{8}$/', $clientChecksum)) return [false, 'invalid_checksum_format'];
    $serverChecksum = tools_checksum32(tools_stable_json(tools_payload_without_checksum($payload)));
    if (!hash_equals($serverChecksum, $clientChecksum)) return [false, 'checksum_mismatch'];
    $ent = $payload['entitlement'] ?? [];
    if (is_array($ent) && !empty($ent['licenseId']) && !empty($grantPayload['licenseId']) && $ent['licenseId'] !== $grantPayload['licenseId']) return [false, 'license_payload_mismatch'];
    return [true, $serverChecksum];
}
function tools_report_draft_summary($draft) {
    $payload = $draft['payload'] ?? [];
    $project = is_array($payload) ? ($payload['project'] ?? []) : [];
    $calc = is_array($payload) ? ($payload['calculations'] ?? []) : [];
    $readiness = is_array($payload) ? ($payload['readiness'] ?? []) : [];
    $cases = is_array($calc['cases'] ?? null) ? $calc['cases'] : [];
    $gov = is_array($calc['governing'] ?? null) ? $calc['governing'] : [];
    $act = is_array($calc['actuator'] ?? null) ? $calc['actuator'] : [];
    $risk = is_array($calc['riskSummary'] ?? null) ? $calc['riskSummary'] : [];
    $noise = is_array($calc['noiseSummary'] ?? null) ? $calc['noiseSummary'] : [];
    $finalReport = is_array($draft['finalReport'] ?? null) ? $draft['finalReport'] : [];
    $engineeringValidation = is_array($draft['engineeringValidation'] ?? null) ? $draft['engineeringValidation'] : tools_build_engineering_validation($payload);
    $vendorValidation = is_array($draft['vendorValidation'] ?? null) ? $draft['vendorValidation'] : tools_build_vendor_validation($payload);
    $isFinal = !empty($finalReport['final']);
    return [
        'draftId' => $draft['draftId'] ?? '',
        'tool' => $draft['tool'] ?? '',
        'licenseId' => $draft['licenseId'] ?? '',
        'checksum' => $draft['checksum'] ?? '',
        'serverChecksum' => $draft['serverChecksum'] ?? '',
        'status' => $draft['status'] ?? 'draft_locked',
        'createdAt' => $draft['createdAt'] ?? '',
        'review' => [
            'status' => $draft['status'] ?? 'draft_locked',
            'statusLabel' => tools_report_status_label($draft['status'] ?? 'draft_locked'),
            'note' => $draft['reviewNote'] ?? '',
            'reviewedAt' => $draft['reviewedAt'] ?? '',
            'reviewedBy' => $draft['reviewedBy'] ?? '',
            'historyCount' => is_array($draft['reviewHistory'] ?? null) ? count($draft['reviewHistory']) : 0,
        ],
        'finalGate' => [
            'readyForFinalPhase' => (bool)($draft['finalGate']['readyForFinalPhase'] ?? false),
            'checkedAt' => $draft['finalGate']['checkedAt'] ?? '',
            'checkedBy' => $draft['finalGate']['checkedBy'] ?? '',
            'blockersCount' => is_array($draft['finalGate']['blockers'] ?? null) ? count($draft['finalGate']['blockers']) : 0,
            'warningsCount' => is_array($draft['finalGate']['warnings'] ?? null) ? count($draft['finalGate']['warnings']) : 0,
            'finalReportGenerationEnabled' => (bool)($draft['finalGate']['finalReportGenerationEnabled'] ?? false),
            'pdfReady' => (bool)($draft['finalGate']['pdfReady'] ?? false),
            'quotaConsumed' => (bool)($finalReport['quotaConsumed'] ?? false),
            'engineeringStatus' => $engineeringValidation['overallStatus'] ?? '',
            'engineeringCriticalCount' => (int)($engineeringValidation['criticalCount'] ?? 0),
            'vendorStatus' => $vendorValidation['overallStatus'] ?? '',
            'vendorMissingCount' => (int)($vendorValidation['missingCount'] ?? 0),
        ],
        'quotaDryRun' => [
            'allowedToIssue' => (bool)($draft['quotaDryRun']['allowedToIssue'] ?? false),
            'wouldConsume' => (bool)($draft['quotaDryRun']['wouldConsume'] ?? false),
            'quotaConsumed' => false,
            'quotaExempt' => (bool)($draft['quotaDryRun']['quotaExempt'] ?? false),
            'checkedAt' => $draft['quotaDryRun']['checkedAt'] ?? '',
            'checkedBy' => $draft['quotaDryRun']['checkedBy'] ?? '',
            'remainingReports' => $draft['quotaDryRun']['quotaBefore']['remainingReports'] ?? null,
            'blockersCount' => is_array($draft['quotaDryRun']['blockers'] ?? null) ? count($draft['quotaDryRun']['blockers']) : 0,
        ],
        'finalReport' => [
            'final' => $isFinal,
            'reportNo' => $finalReport['reportNo'] ?? '',
            'status' => $finalReport['status'] ?? '',
            'issuedAt' => $finalReport['issuedAt'] ?? '',
            'issuedBy' => $finalReport['issuedBy'] ?? '',
            'htmlChecksum' => $finalReport['htmlChecksum'] ?? '',
            'payloadChecksum' => $finalReport['payloadChecksum'] ?? '',
            'downloadEnabled' => $isFinal,
            'browserPrintPdf' => (bool)($finalReport['browserPrintPdf'] ?? false),
            'serverPdf' => false,
            'quotaConsumed' => (bool)($finalReport['quotaConsumed'] ?? false),
            'quotaExempt' => (bool)($finalReport['quotaExempt'] ?? false),
            'engineeringStatus' => $engineeringValidation['overallStatus'] ?? '',
            'engineeringCriticalCount' => (int)($engineeringValidation['criticalCount'] ?? 0),
            'engineeringReviewCount' => (int)($engineeringValidation['reviewCount'] ?? 0),
            'vendorStatus' => $vendorValidation['overallStatus'] ?? '',
            'vendorMissingCount' => (int)($vendorValidation['missingCount'] ?? 0),
            'vendorCertificationRequired' => (bool)($vendorValidation['certificationRequired'] ?? false),
        ],
        'engineeringValidation' => $engineeringValidation,
        'vendorValidation' => $vendorValidation,
        'project' => [
            'project' => $project['project'] ?? '',
            'rfq' => $project['rfq'] ?? '',
            'tag' => $project['tag'] ?? '',
            'service' => $project['service'] ?? '',
            'revision' => $project['revision'] ?? '',
        ],
        'summary' => [
            'casesCount' => count($cases),
            'governingCase' => $gov['label'] ?? '',
            'governingCv' => $gov['Cv'] ?? null,
            'recommendedCv' => $calc['recommendedCv'] ?? null,
            'cavitationRisk' => $risk['tag'] ?? '',
            'noiseRisk' => $noise['tag'] ?? '',
            'actuatorOk' => (bool)($act['ok'] ?? false),
        ],
        'readiness' => [
            'inputCompleteForFutureReport' => (bool)($readiness['inputCompleteForFutureReport'] ?? false),
            'missingCount' => is_array($readiness['missing'] ?? null) ? count($readiness['missing']) : 0,
            'pipeIssuesCount' => is_array($readiness['pipeIssues'] ?? null) ? count($readiness['pipeIssues']) : 0,
            'finalReportLocked' => !$isFinal,
            'pdfLocked' => !$isFinal,
            'serverReportEnabled' => true,
        ],
        'final' => $isFinal,
        'pdf' => false,
        'pdfReady' => $isFinal && !empty($finalReport['browserPrintPdf']),
        'serverPdf' => false,
        'download' => $isFinal,
    ];
}
function tools_find_report_draft($draftId) {
    $drafts = tools_load_report_drafts();
    foreach ($drafts as $d) {
        if (($d['draftId'] ?? '') === $draftId) return $d;
    }
    return null;
}
function tools_norm_report_draft_status($status) {
    $status = tools_clean($status, 50);
    $allowed = ['draft_locked', 'reviewed', 'needs_data', 'approved_for_final_phase', 'rejected', 'duplicate'];
    return in_array($status, $allowed, true) ? $status : 'reviewed';
}
function tools_report_status_label($status) {
    $map = [
        'draft_locked' => 'Draft locked',
        'reviewed' => 'Reviewed',
        'needs_data' => 'Needs data',
        'approved_for_final_phase' => 'Approved for final report phase',
        'rejected' => 'Rejected',
        'duplicate' => 'Duplicate',
    ];
    return $map[$status] ?? $status;
}
function tools_find_license_by_id($licenseId) {
    if (!$licenseId) return null;
    $licenses = tools_load_licenses();
    foreach ($licenses as $lic) {
        if (($lic['licenseId'] ?? '') === $licenseId) return $lic;
    }
    return null;
}
function tools_validation_add(&$items, $area, $status, $severity, $note, $action = '') {
    $items[] = [
        'area' => $area,
        'status' => $status,
        'severity' => $severity,
        'note' => $note,
        'action' => $action,
    ];
}
function tools_build_engineering_validation($payload) {
    $items = [];
    if (!is_array($payload)) $payload = [];
    $inputs = is_array($payload['inputs'] ?? null) ? $payload['inputs'] : [];
    $fluid = is_array($inputs['fluid'] ?? null) ? $inputs['fluid'] : [];
    $calc = is_array($payload['calculations'] ?? null) ? $payload['calculations'] : [];
    $common = is_array($calc['common'] ?? null) ? $calc['common'] : [];
    $cases = is_array($calc['cases'] ?? null) ? $calc['cases'] : [];
    $risk = is_array($calc['riskSummary'] ?? null) ? $calc['riskSummary'] : [];
    $noise = is_array($calc['noiseSummary'] ?? null) ? $calc['noiseSummary'] : [];
    $act = is_array($calc['actuator'] ?? null) ? $calc['actuator'] : [];
    $phaseText = strtolower((string)($common['phase'] ?? ($fluid['phase'] ?? '')));
    $isGas = strpos($phaseText, 'gas') !== false || strpos($phaseText, 'گاز') !== false;
    $isSteam = strpos($phaseText, 'steam') !== false || strpos($phaseText, 'بخار') !== false;
    $isCompressible = $isGas || $isSteam;
    if ($isCompressible) {
        tools_validation_add($items, 'Compressible service', 'Vendor confirmation required', 'review', 'Gas/Steam sizing in this build is an advanced screening calculation. Final IEC/ISA/vendor sizing and acoustic confirmation are required before contractual model selection.', 'Run vendor sizing software or obtain certified vendor sizing sheet.');
    }
    $chokedCases = [];
    $openingWarnings = [];
    $maxVelocity = 0;
    foreach ($cases as $c) {
        if (!is_array($c)) continue;
        $label = (string)($c['label'] ?? $c['caseId'] ?? 'case');
        if (!empty($c['choked'])) $chokedCases[] = $label;
        $op = $c['openingPct'] ?? null;
        if (is_numeric($op) && (float)$op > 90) $openingWarnings[] = $label . ' opening > 90%';
        if (is_numeric($op) && (float)$op < 10) $openingWarnings[] = $label . ' opening < 10%';
        $pipe = is_array($c['pipe'] ?? null) ? $c['pipe'] : [];
        foreach (['vIn','vOut'] as $vk) if (is_numeric($pipe[$vk] ?? null)) $maxVelocity = max($maxVelocity, (float)$pipe[$vk]);
    }
    if ($chokedCases) {
        tools_validation_add($items, 'Choked / critical flow', 'Critical review required', 'critical', 'Choked or critical-flow screening detected in: ' . implode(', ', array_slice($chokedCases, 0, 5)) . '.', 'Review trim staging, outlet velocity, noise and vendor limitations.');
    }
    $riskScore = (int)($risk['score'] ?? 0);
    if ($riskScore >= 4) tools_validation_add($items, 'Cavitation / pressure risk', 'High risk', 'critical', 'Overall cavitation/pressure-risk level is ' . (string)($risk['tag'] ?? 'High') . '.', 'Responsible engineer and vendor must validate trim/body selection.');
    elseif ($riskScore === 3) tools_validation_add($items, 'Cavitation / pressure risk', 'Engineering review', 'review', 'Overall cavitation/pressure-risk level is ' . (string)($risk['tag'] ?? 'Medium') . '.', 'Check project risk acceptance criteria.');
    $noiseScore = (int)($noise['score'] ?? 0);
    if ($noiseScore >= 4) tools_validation_add($items, 'Noise risk', 'High acoustic risk', 'critical', 'Overall preliminary noise-risk level is ' . (string)($noise['tag'] ?? 'High') . '.', 'IEC 60534-8/vendor acoustic data are required before final acoustic guarantee.');
    elseif ($noiseScore === 3) tools_validation_add($items, 'Noise risk', 'Engineering review', 'review', 'Overall preliminary noise-risk level is ' . (string)($noise['tag'] ?? 'Medium') . '.', 'Compare against project noise limit.');
    $reducerRatio = $common['reducerRatio'] ?? null;
    if (is_numeric($reducerRatio) && (float)$reducerRatio < 0.8) {
        tools_validation_add($items, 'Reducer / attached fittings', 'Correction required', 'review', 'Reducer ratio is below 0.8; Fp/FLp and line-size effects must be evaluated.', 'Request vendor sizing with reducer correction factors.');
    }
    if ($maxVelocity > 5) tools_validation_add($items, 'Line velocity', 'High velocity', 'critical', 'Maximum estimated line velocity exceeds 5 m/s.', 'Review pipe size, erosion, noise and outlet Mach/velocity limits.');
    elseif ($maxVelocity > 3) tools_validation_add($items, 'Line velocity', 'Velocity review', 'review', 'Maximum estimated line velocity exceeds 3 m/s.', 'Compare with project line velocity limits.');
    if ($openingWarnings) tools_validation_add($items, 'Valve opening / rangeability', 'Rangeability review', 'review', implode('; ', array_slice($openingWarnings, 0, 6)) . '.', 'Review rated Cv, characteristic and controllability.');
    if (empty($act['ok'])) tools_validation_add($items, 'Actuator shell', 'Incomplete actuator basis', 'review', 'Actuator shell is incomplete or preliminary.', 'Complete shutoff, seat/plug, supply pressure and fail-action data.');
    if (!$items) tools_validation_add($items, 'Overall screening', 'Acceptable for final screening report', 'ok', 'No critical automated engineering validation item was detected in the submitted data.', 'Proceed with normal responsible engineer review.');
    $critical = 0; $review = 0;
    foreach ($items as $it) {
        if (($it['severity'] ?? '') === 'critical') $critical++;
        elseif (($it['severity'] ?? '') === 'review') $review++;
    }
    return [
        'schema' => 'ADV-CV-ENGINEERING-VALIDATION-v1',
        'overallStatus' => $critical ? 'requires_vendor_validation' : ($review ? 'engineering_review_required' : 'acceptable_for_screening'),
        'criticalCount' => $critical,
        'reviewCount' => $review,
        'items' => $items,
    ];
}
function tools_validation_rows_html($validation) {
    $items = is_array($validation['items'] ?? null) ? $validation['items'] : [];
    if (!$items) return '<tr><td colspan="5">No engineering validation item available.</td></tr>';
    $html = '';
    foreach ($items as $it) {
        if (!is_array($it)) continue;
        $html .= '<tr><td>' . tools_e($it['area'] ?? '') . '</td><td>' . tools_e($it['status'] ?? '') . '</td><td>' . tools_e($it['severity'] ?? '') . '</td><td>' . tools_e($it['note'] ?? '') . '</td><td>' . tools_e($it['action'] ?? '') . '</td></tr>';
    }
    return $html;
}
function tools_vendor_add(&$items, $field, $value, $status, $note) {
    $items[] = [
        'field' => $field,
        'value' => $value,
        'status' => $status,
        'note' => $note,
    ];
}
function tools_build_vendor_validation($payload) {
    if (!is_array($payload)) $payload = [];
    $inputs = is_array($payload['inputs'] ?? null) ? $payload['inputs'] : [];
    $fluid = is_array($inputs['fluid'] ?? null) ? $inputs['fluid'] : [];
    $valve = is_array($inputs['valve'] ?? null) ? $inputs['valve'] : [];
    $brand = is_array($inputs['brand'] ?? null) ? $inputs['brand'] : [];
    $calc = is_array($payload['calculations'] ?? null) ? $payload['calculations'] : [];
    $common = is_array($calc['common'] ?? null) ? $calc['common'] : [];
    $phaseText = strtolower((string)($common['phase'] ?? ($fluid['phase'] ?? '')));
    $isCompressible = strpos($phaseText, 'gas') !== false || strpos($phaseText, 'steam') !== false || strpos($phaseText, 'گاز') !== false || strpos($phaseText, 'بخار') !== false;
    $items = [];
    $missing = [];
    $review = 0;
    $cert = 0;
    $check = function($field, $value, $required, $note) use (&$items, &$missing, &$review) {
        $v = trim((string)($value ?? ''));
        $isTbd = $v === '' || preg_match('/\b(TBD|Vendor TBD|unknown|n\/a)\b/i', $v);
        if ($required && $isTbd) {
            $missing[] = $field;
            $review++;
            tools_vendor_add($items, $field, $v, 'missing_or_tbd', $note);
        } else {
            tools_vendor_add($items, $field, $v, $isTbd ? 'tbd_optional' : 'provided', $note);
        }
    };
    $check('Preferred brand', $brand['brand'] ?? '', true, 'Brand/manufacturer basis used for final commercial selection.');
    $check('Preferred series/model', $brand['series'] ?? '', true, 'Vendor series/model should be confirmed before purchase or contractual design.');
    $check('Leakage class', $brand['leakage'] ?? '', true, 'Leakage class must match project shutoff requirement.');
    $check('Rated / candidate Cv', $valve['ratedCv'] ?? '', true, 'Candidate rated Cv is used for opening/rangeability screening.');
    $check('FL', $valve['fl'] ?? '', true, 'FL should be taken from vendor data for liquid/choked/cavitation screening.');
    $check('Fd', $valve['fd'] ?? '', false, 'Fd is recommended for more detailed sizing and Reynolds corrections.');
    if ($isCompressible) {
        $check('Xt', $valve['xt'] ?? '', true, 'Xt must be vendor-confirmed for compressible choked-flow screening.');
        $check('MW or SG basis', (($fluid['mw'] ?? '') ?: ($fluid['sg'] ?? '')), true, 'Gas molecular weight or SG basis must be verified.');
        $check('Z', $fluid['z'] ?? '', true, 'Compressibility factor should come from process data.');
        $check('k', $fluid['k'] ?? '', true, 'Specific heat ratio should come from process data or vendor sizing basis.');
        $cert++;
        tools_vendor_add($items, 'Compressible final sizing', 'Vendor software / IEC-ISA confirmation required', 'certification_required', 'Gas/Steam final sizing and acoustic guarantee require vendor-certified sizing basis.');
    }
    $cases = is_array($calc['cases'] ?? null) ? $calc['cases'] : [];
    foreach ($cases as $c) {
        if (is_array($c) && !empty($c['choked'])) { $cert++; break; }
    }
    if ($cert > 0) tools_vendor_add($items, 'Vendor certified sheet', 'required before contractual model selection', 'certification_required', 'At least one condition requires vendor-certified sizing/selection confirmation.');
    $status = $cert > 0 ? 'vendor_certified_required' : ($missing ? 'vendor_data_incomplete' : 'vendor_data_sufficient_for_screening');
    return [
        'schema' => 'ADV-CV-VENDOR-VALIDATION-v1',
        'overallStatus' => $status,
        'missingCount' => count(array_unique($missing)),
        'certificationRequired' => $cert > 0,
        'items' => $items,
        'missing' => array_values(array_unique($missing)),
    ];
}
function tools_vendor_validation_rows_html($vendorValidation) {
    $items = is_array($vendorValidation['items'] ?? null) ? $vendorValidation['items'] : [];
    if (!$items) return '<tr><td colspan="4">No vendor validation item available.</td></tr>';
    $html = '';
    foreach ($items as $it) {
        if (!is_array($it)) continue;
        $html .= '<tr><td>' . tools_e($it['field'] ?? '') . '</td><td>' . tools_e(tools_fmt($it['value'] ?? '')) . '</td><td>' . tools_e($it['status'] ?? '') . '</td><td>' . tools_e($it['note'] ?? '') . '</td></tr>';
    }
    return $html;
}
function tools_brand_candidate_matrix($payload) {
    if (!is_array($payload)) $payload = [];
    $inputs = is_array($payload['inputs'] ?? null) ? $payload['inputs'] : [];
    $calc = is_array($payload['calculations'] ?? null) ? $payload['calculations'] : [];
    $valve = is_array($inputs['valve'] ?? null) ? $inputs['valve'] : [];
    $fluid = is_array($inputs['fluid'] ?? null) ? $inputs['fluid'] : [];
    $brand = is_array($inputs['brand'] ?? null) ? $inputs['brand'] : [];
    $risk = is_array($calc['riskSummary'] ?? null) ? $calc['riskSummary'] : [];
    $noise = is_array($calc['noiseSummary'] ?? null) ? $calc['noiseSummary'] : [];
    $common = is_array($calc['common'] ?? null) ? $calc['common'] : [];
    $phase = strtolower((string)($common['phase'] ?? ($fluid['phase'] ?? '')));
    $valveType = strtolower((string)($valve['type'] ?? 'globe'));
    $compressible = strpos($phase, 'gas') !== false || strpos($phase, 'steam') !== false || strpos($phase, 'گاز') !== false || strpos($phase, 'بخار') !== false;
    $riskHigh = (int)($risk['score'] ?? 0) >= 4;
    $noiseHigh = (int)($noise['score'] ?? 0) >= 4;
    $preferred = trim((string)($brand['brand'] ?? ''));
    $rows = [];
    $add = function($brandName, $series, $fit, $url, $note) use (&$rows, $preferred) {
        $status = $preferred && stripos($brandName, $preferred) !== false ? 'Preferred / user-entered' : 'Candidate example';
        $rows[] = ['brand' => $brandName, 'series' => $series, 'fit' => $fit, 'status' => $status, 'url' => $url, 'note' => $note];
    };
    if (strpos($valveType, 'rotary') !== false || strpos($valveType, 'ball') !== false || strpos($valveType, 'butterfly') !== false) {
        $add('Fisher / Emerson', 'Vee-Ball, Control-Disk, rotary control valve families', 'Rotary/segment-ball/butterfly candidate', 'https://www.emerson.com/en-us/automation/control-and-safety-systems/fisher-control-valves', 'Final torque, noise and shutoff must be checked in vendor sizing.');
        $add('Valmet / Neles', 'Neles rotary control valves and intelligent valve controllers', 'Rotary severe-service candidate', 'https://www.valmet.com/flowcontrol/valves/', 'Check torque table, seat material and actuator package.');
        $add('Flowserve / Valtek', 'Valtek rotary and severe-service packages', 'Rotary/control package candidate', 'https://www.flowserve.com/en/products/valves/control-valves/', 'Confirm series availability and actuator torque margin.');
    } else {
        $add('Fisher / Emerson', $riskHigh ? 'easy-e ET/EZ with Cavitrol or Whisper trim families' : 'easy-e ET/EZ globe control valve families', 'Globe / severe-service candidate', 'https://www.emerson.com/en-us/automation/control-and-safety-systems/fisher-control-valves', $riskHigh || $noiseHigh ? 'Consider anti-cavitation or low-noise trim; vendor certified sheet required.' : 'Common globe candidate; verify rated Cv, FL/Xt and materials.');
        $add('SAMSON', 'Type 3241 / 3251 globe valve families', 'Globe control candidate', 'https://www.samsongroup.com/en/products-applications/product-selector/valves/', 'Verify Kvs/Cv table, actuator sizing and noise/cavitation package.');
        $add('Baker Hughes Masoneilan', '21000 / 41005 series control valve families', 'Globe / cage-guided candidate', 'https://valves.bakerhughes.com/', 'Check trim style, FL/Xt, leakage class and certified sizing.');
        $add('Flowserve / Valtek', 'Mark One and severe-service trim packages', 'Globe/severe-service candidate', 'https://www.flowserve.com/en/products/valves/control-valves/', 'Check trim selection, pressure class, material and noise package.');
        $add('Valmet / Neles', 'Neles globe and control valve packages', 'Alternative control package candidate', 'https://www.valmet.com/flowcontrol/valves/', 'Check regional availability, actuator and positioner package.');
    }
    if ($compressible) {
        foreach ($rows as &$r) $r['note'] .= ' Compressible gas/steam service requires acoustic and choked-flow vendor validation.';
        unset($r);
    }
    return ['schema' => 'ADV-CV-BRAND-CANDIDATE-MATRIX-v1', 'preferredBrand' => $preferred, 'candidateCount' => count($rows), 'candidates' => $rows, 'disclaimer' => 'Brand/series rows are candidate examples for engineering discussion only; final model selection requires project specifications and vendor-certified sizing.'];
}
function tools_brand_candidate_rows_html($matrix) {
    $items = is_array($matrix['candidates'] ?? null) ? $matrix['candidates'] : [];
    if (!$items) return '<tr><td colspan="6">No brand candidate data available.</td></tr>';
    $html = '';
    foreach ($items as $it) {
        if (!is_array($it)) continue;
        $url = tools_e($it['url'] ?? '');
        $link = $url ? '<a href="' . $url . '" target="_blank" rel="noopener">Official link</a>' : '—';
        $html .= '<tr><td>' . tools_e($it['brand'] ?? '') . '</td><td>' . tools_e($it['series'] ?? '') . '</td><td>' . tools_e($it['fit'] ?? '') . '</td><td>' . tools_e($it['status'] ?? '') . '</td><td>' . $link . '</td><td>' . tools_e($it['note'] ?? '') . '</td></tr>';
    }
    return $html;
}
function tools_build_final_gate($draft, $adminUser = '') {
    $blockers = [];
    $warnings = [];
    $payload = $draft['payload'] ?? null;
    $licenseId = $draft['licenseId'] ?? '';
    $status = $draft['status'] ?? 'draft_locked';

    if ($status !== 'approved_for_final_phase') {
        $blockers[] = 'Draft review status must be approved_for_final_phase.';
    }
    if (!is_array($payload)) {
        $blockers[] = 'Report payload is missing or invalid.';
        $payload = [];
    }
    $meta = is_array($payload['reportMeta'] ?? null) ? $payload['reportMeta'] : [];
    if (($payload['schema'] ?? '') !== 'ADV-CV-REPORT-PAYLOAD-v1') $blockers[] = 'Invalid report payload schema.';
    if (($meta['status'] ?? '') !== 'LOCKED_PREVIEW_PAYLOAD') $blockers[] = 'Payload status is not LOCKED_PREVIEW_PAYLOAD.';
    if (($meta['final'] ?? null) !== false || ($meta['pdf'] ?? null) !== false || ($meta['download'] ?? null) !== false || ($meta['serverSideReport'] ?? null) !== false) {
        $blockers[] = 'Draft payload must remain locked: final/pdf/download/serverSideReport must be false.';
    }
    $clientChecksum = strtoupper((string)($meta['checksum'] ?? ''));
    $serverChecksum = is_array($payload) ? tools_checksum32(tools_stable_json(tools_payload_without_checksum($payload))) : '';
    if (!$clientChecksum || !preg_match('/^[0-9A-F]{8}$/', $clientChecksum)) $blockers[] = 'Payload checksum is missing or invalid.';
    elseif (!hash_equals($serverChecksum, $clientChecksum)) $blockers[] = 'Payload checksum mismatch.';
    if (!empty($draft['serverChecksum']) && $serverChecksum && !hash_equals((string)$draft['serverChecksum'], $serverChecksum)) $blockers[] = 'Stored server checksum does not match payload.';

    $readiness = is_array($payload['readiness'] ?? null) ? $payload['readiness'] : [];
    if (empty($readiness['inputCompleteForFutureReport'])) $blockers[] = 'Strict report readiness is incomplete.';
    if (!empty($readiness['missing']) && is_array($readiness['missing'])) $blockers[] = 'Missing required report fields: ' . implode(', ', array_slice($readiness['missing'], 0, 8));
    if (!empty($readiness['pipeIssues']) && is_array($readiness['pipeIssues'])) $blockers[] = 'Pipe data issues: ' . implode(', ', array_slice($readiness['pipeIssues'], 0, 6));

    $lic = tools_find_license_by_id($licenseId);
    $quotaExempt = false;
    if (!$licenseId) $blockers[] = 'Draft has no licenseId.';
    elseif (!$lic) $blockers[] = 'License record was not found.';
    else {
        $quotaExempt = (($lic['type'] ?? '') === 'staff_internal');
        if (($lic['status'] ?? 'active') !== 'active') $blockers[] = 'License is not active.';
        if (!empty($lic['expiresAt']) && strtotime($lic['expiresAt']) !== false && strtotime($lic['expiresAt']) < time()) $blockers[] = 'License is expired.';
        if (!$quotaExempt && isset($lic['maxReports']) && (int)($lic['usedReports'] ?? 0) >= (int)$lic['maxReports']) $blockers[] = 'License report quota is exhausted.';
        if (!empty($lic['tool']) && $lic['tool'] !== 'all' && $lic['tool'] !== 'control_valve_advanced') $blockers[] = 'License tool does not allow Control Valve Advanced.';
    }

    if (empty($payload['calculations']['cases']) || !is_array($payload['calculations']['cases'])) $blockers[] = 'Calculation cases are missing.';
    if (empty($payload['calculations']['governing'])) $blockers[] = 'Governing case is missing.';
    if (empty($payload['calculations']['actuator']) || !is_array($payload['calculations']['actuator']) || empty($payload['calculations']['actuator']['ok'])) $warnings[] = 'Actuator shell is incomplete or preliminary only.';
    $engineeringValidation = tools_build_engineering_validation($payload);
    foreach (($engineeringValidation['items'] ?? []) as $it) {
        if (!is_array($it)) continue;
        if (($it['severity'] ?? '') === 'critical' || ($it['severity'] ?? '') === 'review') $warnings[] = 'Engineering validation [' . ($it['severity'] ?? '') . ']: ' . ($it['area'] ?? '') . ' — ' . ($it['note'] ?? '');
    }
    $vendorValidation = tools_build_vendor_validation($payload);
    if (!empty($vendorValidation['missing'])) $warnings[] = 'Vendor data validation: missing/TBD fields — ' . implode(', ', array_slice($vendorValidation['missing'], 0, 8));
    if (!empty($vendorValidation['certificationRequired'])) $warnings[] = 'Vendor data validation: certified vendor sizing/selection confirmation is required before contractual model selection.';
    $warnings[] = 'Final issue generates an immutable English HTML report with embedded styles and charts.';
    $warnings[] = 'Server-side binary PDF is not generated in this build; use browser Print / Save as PDF from the final HTML report.';
    if ($quotaExempt) $warnings[] = 'Staff/internal license: final report issue is allowed without decrementing paid quota.';

    $ready = count($blockers) === 0;
    return [
        'checkedAt' => date('c'),
        'checkedBy' => $adminUser,
        'readyForFinalPhase' => $ready,
        'finalReportGenerationEnabled' => $ready,
        'pdfReady' => $ready,
        'serverPdfEnabled' => false,
        'downloadEnabled' => $ready,
        'quotaConsumed' => false,
        'quotaExempt' => $quotaExempt,
        'engineeringValidation' => $engineeringValidation,
        'vendorValidation' => $vendorValidation,
        'serverChecksum' => $serverChecksum,
        'blockers' => array_values(array_unique($blockers)),
        'warnings' => array_values(array_unique($warnings)),
        'nextAllowedAction' => $ready ? 'issue_final_report' : 'resolve_blockers',
    ];
}

function tools_build_quota_dry_run($draft, $adminUser = '') {
    $gate = tools_build_final_gate($draft, $adminUser);
    $licenseId = $draft['licenseId'] ?? '';
    $lic = tools_find_license_by_id($licenseId);
    $blockers = [];
    if (!$gate['readyForFinalPhase']) $blockers[] = 'Final readiness gate must pass before final report issue.';
    if (!$lic) $blockers[] = 'License record was not found for quota check.';
    $quotaExempt = $lic && (($lic['type'] ?? '') === 'staff_internal');
    $max = $lic ? (int)($lic['maxReports'] ?? 0) : 0;
    $used = $lic ? (int)($lic['usedReports'] ?? 0) : 0;
    $remaining = $quotaExempt ? 'unlimited' : max(0, $max - $used);
    if ($lic && !$quotaExempt && $remaining <= 0) $blockers[] = 'No remaining report quota.';
    if ($lic && ($lic['status'] ?? 'active') !== 'active') $blockers[] = 'License is not active.';
    if ($lic && !empty($lic['expiresAt']) && strtotime($lic['expiresAt']) !== false && strtotime($lic['expiresAt']) < time()) $blockers[] = 'License is expired.';
    $allowed = count($blockers) === 0;
    $afterUsed = ($allowed && !$quotaExempt) ? $used + 1 : $used;
    $afterRemaining = $quotaExempt ? 'unlimited' : max(0, $max - $afterUsed);
    return [
        'checkedAt' => date('c'),
        'checkedBy' => $adminUser,
        'dryRun' => true,
        'allowedToIssue' => $allowed,
        'wouldConsume' => $allowed && !$quotaExempt,
        'quotaConsumed' => false,
        'quotaExempt' => (bool)$quotaExempt,
        'licenseId' => $licenseId,
        'licenseType' => $lic['type'] ?? '',
        'tool' => $lic['tool'] ?? '',
        'quotaBefore' => ['usedReports' => $used, 'maxReports' => $max, 'remainingReports' => $remaining],
        'quotaAfter' => ['usedReports' => $afterUsed, 'maxReports' => $max, 'remainingReports' => $afterRemaining],
        'reportCost' => $quotaExempt ? 0 : 1,
        'blockers' => array_values(array_unique($blockers)),
        'warnings' => ['Dry-run only: report quota is not decremented here.', 'Actual quota handling happens only inside admin_report_final_issue.', 'Server-side binary PDF remains disabled; final HTML is browser print/PDF-ready.'],
        'nextAllowedAction' => $allowed ? 'issue_final_report' : 'resolve_blockers',
        'finalReportGenerationEnabled' => $allowed,
        'pdfReady' => $allowed,
        'serverPdfEnabled' => false,
    ];
}
function tools_e($v) {
    return htmlspecialchars((string)($v ?? ''), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}
function tools_fmt($v) {
    if ($v === null || $v === '') return '—';
    if (is_numeric($v)) return (string)round((float)$v, 4);
    return (string)$v;
}
function tools_html_rows($assoc) {
    $html = '';
    if (!is_array($assoc)) return $html;
    foreach ($assoc as $k => $v) {
        $html .= '<tr><td>' . tools_e($k) . '</td><td>' . tools_e(tools_fmt($v)) . '</td></tr>';
    }
    return $html;
}
function tools_case_rows_html($cases) {
    if (!is_array($cases) || !count($cases)) return '<tr><td colspan="10">No cases available</td></tr>';
    $html = '';
    foreach ($cases as $c) {
        if (!is_array($c)) continue;
        $cav = is_array($c['cavitationRisk'] ?? null) ? ($c['cavitationRisk']['tag'] ?? '') : '';
        $noise = is_array($c['noiseRisk'] ?? null) ? ($c['noiseRisk']['tag'] ?? '') : '';
        $pipe = is_array($c['pipe'] ?? null) ? $c['pipe'] : [];
        $html .= '<tr><td>' . tools_e($c['label'] ?? $c['caseId'] ?? '') . '</td><td>' . tools_e(tools_fmt($c['Q'] ?? '')) . '</td><td>' . tools_e(tools_fmt($c['P1'] ?? '')) . '</td><td>' . tools_e(tools_fmt($c['P2'] ?? '')) . '</td><td>' . tools_e(tools_fmt($c['dP'] ?? '')) . '</td><td>' . tools_e(!empty($c['choked']) ? 'Yes' : 'No') . '</td><td>' . tools_e(tools_fmt($c['Kv'] ?? '')) . '</td><td>' . tools_e(tools_fmt($c['Cv'] ?? '')) . '</td><td>' . tools_e($cav) . '</td><td>' . tools_e($noise) . '</td><td>' . tools_e(tools_fmt($pipe['vIn'] ?? '')) . '</td><td>' . tools_e(tools_fmt($pipe['vOut'] ?? '')) . '</td></tr>';
    }
    return $html ?: '<tr><td colspan="12">No cases available</td></tr>';
}
function tools_list_html($items) {
    if (!is_array($items) || !count($items)) return '<li>None</li>';
    $html = '';
    foreach ($items as $x) $html .= '<li>' . tools_e($x) . '</li>';
    return $html;
}
function tools_render_locked_report_html($draft, $gate) {
    $payload = is_array($draft['payload'] ?? null) ? $draft['payload'] : [];
    $project = is_array($payload['project'] ?? null) ? $payload['project'] : [];
    $inputs = is_array($payload['inputs'] ?? null) ? $payload['inputs'] : [];
    $calc = is_array($payload['calculations'] ?? null) ? $payload['calculations'] : [];
    $fluid = is_array($inputs['fluid'] ?? null) ? $inputs['fluid'] : [];
    $valve = is_array($inputs['valve'] ?? null) ? $inputs['valve'] : [];
    $piping = is_array($inputs['piping'] ?? null) ? $inputs['piping'] : [];
    $act = is_array($calc['actuator'] ?? null) ? $calc['actuator'] : [];
    $risk = is_array($calc['riskSummary'] ?? null) ? $calc['riskSummary'] : [];
    $noise = is_array($calc['noiseSummary'] ?? null) ? $calc['noiseSummary'] : [];
    $gov = is_array($calc['governing'] ?? null) ? $calc['governing'] : [];
    $html = '<article class="ptf-locked-report" dir="ltr" style="font-family:Arial,Tahoma,sans-serif;color:#172033;line-height:1.62">';
    $html .= '<style>.ptf-locked-report table{width:100%;border-collapse:collapse;margin:8px 0 14px}.ptf-locked-report th,.ptf-locked-report td{border:1px solid #dbe3ef;padding:6px 8px;font-size:12px}.ptf-locked-report th{background:#f1f5f9}.ptf-locked-report h3{margin:18px 0 8px;color:#0f172a}.ptf-watermark{border:2px solid #fed7aa;background:#fff7ed;color:#9a3412;border-radius:12px;padding:10px 12px;font-weight:800;margin:0 0 12px}</style>';
    $html .= '<div class="ptf-watermark">LOCKED INTERNAL HTML PREVIEW — NOT A FINAL REPORT — NO PDF GENERATED</div>';
    $html .= '<h2>Advanced Control Valve Sizing — Locked Internal Report Preview</h2>';
    $html .= '<p><b>Draft ID:</b> ' . tools_e($draft['draftId'] ?? '') . ' &nbsp; <b>Checksum:</b> ' . tools_e($draft['checksum'] ?? '') . ' &nbsp; <b>Rendered:</b> ' . tools_e(date('c')) . '</p>';
    $html .= '<h3>1. Project and Tag Data</h3><table><tbody>' . tools_html_rows(['Project' => $project['project'] ?? '', 'RFQ / Inquiry' => $project['rfq'] ?? '', 'Tag No.' => $project['tag'] ?? '', 'Service' => $project['service'] ?? '', 'Revision' => $project['revision'] ?? '']) . '</tbody></table>';
    $html .= '<h3>2. Design Basis</h3><table><tbody>' . tools_html_rows(['Fluid phase' => $fluid['phase'] ?? '', 'Fluid name' => $fluid['name'] ?? '', 'SG' => $fluid['sg'] ?? '', 'Viscosity cP' => $fluid['viscosity'] ?? '', 'Pv' => $fluid['pv'] ?? '', 'Pc' => $fluid['pc'] ?? '', 'Valve type' => $valve['type'] ?? '', 'Class' => $valve['class'] ?? '', 'FL' => $valve['fl'] ?? '', 'Rated Cv' => $valve['ratedCv'] ?? '', 'Inlet pipe' => $piping['inlet'] ?? '', 'Outlet pipe' => $piping['outlet'] ?? '']) . '</tbody></table>';
    $html .= '<h3>3. Preliminary Liquid Sizing Results</h3><table><thead><tr><th>Case</th><th>Q</th><th>P1</th><th>P2</th><th>ΔP</th><th>Choked</th><th>Kv</th><th>Cv</th><th>Cavitation</th><th>Noise</th><th>Vin</th><th>Vout</th></tr></thead><tbody>' . tools_case_rows_html($calc['cases'] ?? []) . '</tbody></table>';
    $html .= '<h3>4. Governing and Risk Summary</h3><table><tbody>' . tools_html_rows(['Governing case' => $gov['label'] ?? '', 'Governing Cv' => $gov['Cv'] ?? '', 'Preliminary selected Cv (+10%)' => $calc['recommendedCv'] ?? '', 'Overall cavitation risk' => $risk['tag'] ?? '', 'Overall noise risk' => $noise['tag'] ?? '']) . '</tbody></table>';
    $html .= '<h3>5. Actuator Sizing Shell</h3><table><tbody>' . tools_html_rows(['Actuator ok' => !empty($act['ok']) ? 'Yes' : 'No', 'Fail action' => $act['failAction'] ?? '', 'Shutoff ΔP bar' => $act['shutoffDpBar'] ?? '', 'Seat mm' => $act['seatMm'] ?? '', 'Required thrust N' => $act['requiredThrustN'] ?? '', 'Required thrust kgf' => $act['requiredThrustKgF'] ?? '', 'Equivalent diaphragm mm' => $act['diaphragmDiaMm'] ?? '']) . '</tbody></table>';
    $html .= '<h3>6. Warnings and Recommendations</h3><h4>Warnings</h4><ul>' . tools_list_html($calc['warnings'] ?? []) . '</ul><h4>Risk recommendations</h4><ul>' . tools_list_html(array_merge($calc['riskRecommendations'] ?? [], $calc['noiseRecommendations'] ?? [])) . '</ul>';
    $html .= '<h3>7. Final Readiness Gate</h3><table><tbody>' . tools_html_rows(['Ready for final phase' => !empty($gate['readyForFinalPhase']) ? 'Yes' : 'No', 'Final issue action enabled' => !empty($gate['finalReportGenerationEnabled']) ? 'Yes' : 'No', 'PDF mode' => !empty($gate['pdfReady']) ? 'Browser Print / Save as PDF' : 'No', 'Quota consumed by locked preview' => 'No', 'Next allowed action' => $gate['nextAllowedAction'] ?? '']) . '</tbody></table>';
    $html .= '<h4>Gate blockers</h4><ul>' . tools_list_html($gate['blockers'] ?? []) . '</ul>';
    $html .= '<h4>Gate warnings</h4><ul>' . tools_list_html($gate['warnings'] ?? []) . '</ul>';
    $html .= '<div class="ptf-watermark">This locked HTML preview is for internal review only. It is not a contractual report and cannot be downloaded as PDF in this phase.</div>';
    $html .= '</article>';
    return $html;
}
function tools_next_final_report_no($drafts) {
    $prefix = 'PTF-CV-' . date('Ymd') . '-';
    $max = 0;
    foreach ($drafts as $d) {
        $no = $d['finalReport']['reportNo'] ?? '';
        if (preg_match('/^' . preg_quote($prefix, '/') . '(\d{3})$/', $no, $m)) $max = max($max, (int)$m[1]);
    }
    return $prefix . str_pad((string)($max + 1), 3, '0', STR_PAD_LEFT);
}
function tools_chart_svg($cases, $field, $title, $suffix = '') {
    if (!is_array($cases) || !count($cases)) return '<p>No chart data available.</p>';
    $max = 0;
    foreach ($cases as $c) {
        $v = (float)($c[$field] ?? 0);
        if ($v > $max) $max = $v;
    }
    if ($max <= 0) return '<p>No chart data available.</p>';
    $rows = [];
    $i = 0;
    foreach ($cases as $c) {
        $label = tools_e($c['label'] ?? $c['caseId'] ?? ('Case ' . ($i + 1)));
        $v = (float)($c[$field] ?? 0);
        $w = max(2, (int)round(420 * $v / $max));
        $y = 36 + $i * 34;
        $rows[] = '<text x="12" y="' . ($y + 13) . '" font-size="11" fill="#334155">' . $label . '</text>';
        $rows[] = '<rect x="140" y="' . $y . '" width="' . $w . '" height="18" rx="5" fill="#f97316"></rect>';
        $rows[] = '<text x="' . (150 + $w) . '" y="' . ($y + 13) . '" font-size="11" fill="#0f172a">' . tools_e(tools_fmt($v) . $suffix) . '</text>';
        $i++;
    }
    $h = 58 + count($cases) * 34;
    return '<svg role="img" aria-label="' . tools_e($title) . '" viewBox="0 0 640 ' . $h . '" style="width:100%;max-width:760px;height:auto;border:1px solid #dbe3ef;border-radius:12px;background:#fff"><text x="12" y="22" font-size="13" font-weight="700" fill="#0f172a">' . tools_e($title) . '</text>' . implode('', $rows) . '</svg>';
}
function tools_chart_line_svg($cases, $xField, $yField, $title, $suffix = '') {
    if (!is_array($cases) || count($cases) < 2) return '<p>No line chart data available.</p>';
    $pts = [];
    foreach ($cases as $c) {
        if (!is_array($c)) continue;
        $x = (float)($c[$xField] ?? 0); $y = (float)($c[$yField] ?? 0);
        if ($x > 0 && $y >= 0) $pts[] = ['x' => $x, 'y' => $y, 'label' => $c['label'] ?? $c['caseId'] ?? 'case'];
    }
    if (count($pts) < 2) return '<p>No line chart data available.</p>';
    $minX = min(array_column($pts, 'x')); $maxX = max(array_column($pts, 'x'));
    $minY = 0; $maxY = max(array_column($pts, 'y'));
    if ($maxX <= $minX) $maxX = $minX + 1;
    if ($maxY <= 0) $maxY = 1;
    $coords = [];
    $marks = [];
    foreach ($pts as $p) {
        $px = 72 + 500 * (($p['x'] - $minX) / ($maxX - $minX));
        $py = 250 - 180 * (($p['y'] - $minY) / ($maxY - $minY));
        $coords[] = round($px, 1) . ',' . round($py, 1);
        $marks[] = '<circle cx="' . round($px, 1) . '" cy="' . round($py, 1) . '" r="4" fill="#f97316"></circle><text x="' . round($px + 7, 1) . '" y="' . round($py - 7, 1) . '" font-size="10" fill="#334155">' . tools_e(tools_fmt($p['y']) . $suffix) . '</text>';
    }
    return '<svg role="img" aria-label="' . tools_e($title) . '" viewBox="0 0 640 290" style="width:100%;max-width:760px;height:auto;border:1px solid #dbe3ef;border-radius:12px;background:#fff"><text x="16" y="24" font-size="13" font-weight="700" fill="#0f172a">' . tools_e($title) . '</text><line x1="72" y1="250" x2="590" y2="250" stroke="#94a3b8"/><line x1="72" y1="48" x2="72" y2="250" stroke="#94a3b8"/><text x="72" y="270" font-size="10" fill="#64748b">Q=' . tools_e(tools_fmt($minX)) . '</text><text x="520" y="270" font-size="10" fill="#64748b">Q=' . tools_e(tools_fmt($maxX)) . '</text><text x="14" y="58" font-size="10" fill="#64748b">' . tools_e(tools_fmt($maxY) . $suffix) . '</text><polyline points="' . implode(' ', $coords) . '" fill="none" stroke="#f97316" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"></polyline>' . implode('', $marks) . '</svg>';
}
function tools_render_final_report_html($draft, $gate, $finalMeta) {
    $payload = is_array($draft['payload'] ?? null) ? $draft['payload'] : [];
    $project = is_array($payload['project'] ?? null) ? $payload['project'] : [];
    $inputs = is_array($payload['inputs'] ?? null) ? $payload['inputs'] : [];
    $calc = is_array($payload['calculations'] ?? null) ? $payload['calculations'] : [];
    $fluid = is_array($inputs['fluid'] ?? null) ? $inputs['fluid'] : [];
    $valve = is_array($inputs['valve'] ?? null) ? $inputs['valve'] : [];
    $piping = is_array($inputs['piping'] ?? null) ? $inputs['piping'] : [];
    $actInput = is_array($inputs['actuator'] ?? null) ? $inputs['actuator'] : [];
    $brand = is_array($inputs['brand'] ?? null) ? $inputs['brand'] : [];
    $act = is_array($calc['actuator'] ?? null) ? $calc['actuator'] : [];
    $risk = is_array($calc['riskSummary'] ?? null) ? $calc['riskSummary'] : [];
    $noise = is_array($calc['noiseSummary'] ?? null) ? $calc['noiseSummary'] : [];
    $gov = is_array($calc['governing'] ?? null) ? $calc['governing'] : [];
    $cases = is_array($calc['cases'] ?? null) ? $calc['cases'] : [];
    $validation = tools_build_engineering_validation($payload);
    $vendorValidation = tools_build_vendor_validation($payload);
    $brandMatrix = tools_brand_candidate_matrix($payload);
    $reportNo = $finalMeta['reportNo'] ?? '';
    $html = '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>' . tools_e($reportNo) . ' — Advanced Control Valve Final Report</title>';
    $html .= '<style>body{font-family:Arial,Tahoma,sans-serif;color:#172033;line-height:1.62;margin:0;background:#f8fafc}.page{max-width:980px;margin:0 auto;background:#fff;padding:28px 34px;box-shadow:0 10px 30px rgba(15,23,42,.08)}.top{display:flex;justify-content:space-between;gap:16px;border-bottom:3px solid #f97316;padding-bottom:14px;margin-bottom:18px}.brand{font-weight:900;color:#0f172a}.kicker{font-size:11px;letter-spacing:.08em;color:#ea580c;text-transform:uppercase;font-weight:800}.meta{font-size:12px;color:#475569;text-align:right}.seal{border:1px solid #fed7aa;background:#fff7ed;color:#9a3412;border-radius:12px;padding:9px 12px;margin:12px 0;font-weight:800}table{width:100%;border-collapse:collapse;margin:8px 0 16px}th,td{border:1px solid #dbe3ef;padding:7px 9px;font-size:12px;vertical-align:top}th{background:#f1f5f9;color:#334155}h1{margin:4px 0;color:#0f172a;font-size:24px}h2{margin:22px 0 8px;color:#0f172a;font-size:17px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.small{font-size:11px;color:#64748b}.actions{position:sticky;top:0;background:#fff;border-bottom:1px solid #e2e8f0;padding:8px;text-align:right}.btn{border:1px solid #cbd5e1;background:#fff;border-radius:9px;padding:7px 11px;cursor:pointer;font-weight:700}.chart-wrap{display:grid;grid-template-columns:1fr 1fr;gap:12px}@media(max-width:760px){.grid,.chart-wrap{grid-template-columns:1fr}.top{display:block}.meta{text-align:left}}@media print{body{background:#fff}.page{box-shadow:none;margin:0;max-width:none}.actions{display:none}.seal{break-inside:avoid}h2{break-after:avoid}}</style></head><body>';
    $html .= '<div class="actions"><button class="btn" onclick="window.print()">Print / Save as PDF</button></div><main class="page">';
    $html .= '<div class="top"><div><div class="kicker">Final Engineering Screening Report</div><h1>Advanced Control Valve Sizing Report</h1><div class="brand">Pishro Tajhiz Fartak</div></div><div class="meta"><b>Report No.</b><br>' . tools_e($reportNo) . '<br><b>Issued</b><br>' . tools_e($finalMeta['issuedAt'] ?? '') . '<br><b>Issued by</b><br>' . tools_e($finalMeta['issuedBy'] ?? '') . '</div></div>';
    $html .= '<div class="seal">FINAL REPORT ISSUED BY CRM WORKFLOW — Immutable HTML deliverable. Browser Print/Save as PDF is enabled. Server-side binary PDF is not generated in this build.</div>';
    $html .= '<h2>1. Project and Tag Data</h2><table><tbody>' . tools_html_rows(['Project' => $project['project'] ?? '', 'RFQ / Inquiry' => $project['rfq'] ?? '', 'Tag No.' => $project['tag'] ?? '', 'Service' => $project['service'] ?? '', 'Quantity' => $project['quantity'] ?? '', 'Revision' => $project['revision'] ?? '', 'Draft ID' => $draft['draftId'] ?? '', 'Payload checksum' => $draft['checksum'] ?? '']) . '</tbody></table>';
    $html .= '<h2>2. Design Basis and Inputs</h2><div class="grid"><div><table><tbody>' . tools_html_rows(['Fluid phase' => $fluid['phase'] ?? '', 'Fluid name' => $fluid['name'] ?? '', 'Flow basis' => $fluid['flowBasis'] ?? '', 'SG / Density basis' => $fluid['sg'] ?? '', 'Viscosity cP' => $fluid['viscosity'] ?? '', 'Pv' => $fluid['pv'] ?? '', 'Pc' => $fluid['pc'] ?? '', 'MW' => $fluid['mw'] ?? '', 'Z' => $fluid['z'] ?? '', 'k' => $fluid['k'] ?? '']) . '</tbody></table></div><div><table><tbody>' . tools_html_rows(['Valve type' => $valve['type'] ?? '', 'Class' => $valve['class'] ?? '', 'Body material' => $valve['body'] ?? '', 'Trim material' => $valve['trim'] ?? '', 'FL' => $valve['fl'] ?? '', 'Fd' => $valve['fd'] ?? '', 'Xt' => $valve['xt'] ?? '', 'Characteristic' => $valve['characteristic'] ?? '', 'Rated Cv' => $valve['ratedCv'] ?? '', 'Inlet pipe' => $piping['inlet'] ?? '', 'Outlet pipe' => $piping['outlet'] ?? '']) . '</tbody></table></div></div>';
    $html .= '<h2>3. Min / Normal / Max Calculation Results</h2><table><thead><tr><th>Case</th><th>Q</th><th>P1</th><th>P2</th><th>ΔP</th><th>Choked</th><th>Kv</th><th>Cv</th><th>Risk</th><th>Noise</th><th>Vin</th><th>Vout</th></tr></thead><tbody>' . tools_case_rows_html($cases) . '</tbody></table>';
    $html .= '<div class="chart-wrap"><div>' . tools_chart_svg($cases, 'Cv', 'Cv by operating case') . '</div><div>' . tools_chart_svg($cases, 'openingPct', 'Estimated opening by case', '%') . '</div></div>';
    $html .= '<div class="chart-wrap" style="margin-top:12px"><div>' . tools_chart_line_svg($cases, 'Q', 'Cv', 'Flow vs Cv line chart') . '</div><div>' . tools_chart_line_svg($cases, 'Q', 'openingPct', 'Flow vs opening line chart', '%') . '</div></div>';
    $html .= '<h2>4. Governing Result and Risk Summary</h2><table><tbody>' . tools_html_rows(['Governing case' => $gov['label'] ?? '', 'Governing Cv' => $gov['Cv'] ?? '', 'Governing Kv' => $gov['Kv'] ?? '', 'Preliminary selected Cv (+10%)' => $calc['recommendedCv'] ?? '', 'Overall cavitation / pressure risk' => $risk['tag'] ?? '', 'Overall noise risk' => $noise['tag'] ?? '', 'Reducer ratio' => $calc['common']['reducerRatio'] ?? '']) . '</tbody></table>';
    $html .= '<h2>5. Actuator Sizing Shell</h2><div class="grid"><div><table><tbody>' . tools_html_rows(['Actuator ok' => !empty($act['ok']) ? 'Yes' : 'No', 'Actuator type' => $act['type'] ?? ($actInput['type'] ?? ''), 'Fail action' => $act['failAction'] ?? ($actInput['failAction'] ?? ''), 'Shutoff ΔP bar' => $act['shutoffDpBar'] ?? '', 'Seat / plug mm' => $act['seatMm'] ?? '', 'Required thrust N' => $act['requiredThrustN'] ?? '', 'Required thrust kgf' => $act['requiredThrustKgF'] ?? '', 'Equivalent diaphragm mm' => $act['diaphragmDiaMm'] ?? '']) . '</tbody></table></div><div><table><tbody>' . tools_html_rows(['Preferred brand' => $brand['brand'] ?? '', 'Preferred series' => $brand['series'] ?? '', 'Leakage class' => $brand['leakage'] ?? '', 'Supply pressure' => $actInput['supply'] ?? '', 'Safety factor' => $actInput['safety'] ?? '', 'Packing/friction force' => $actInput['packingForce'] ?? '']) . '</tbody></table></div></div>';
    $html .= '<h2>6. Brand / Series Candidate Matrix</h2><table><tbody>' . tools_html_rows(['Matrix schema' => $brandMatrix['schema'] ?? '', 'Preferred brand entered' => $brandMatrix['preferredBrand'] ?? '', 'Candidate examples' => $brandMatrix['candidateCount'] ?? 0, 'Important disclaimer' => $brandMatrix['disclaimer'] ?? '']) . '</tbody></table><table><thead><tr><th>Brand</th><th>Series / model family</th><th>Fit</th><th>Status</th><th>Official link</th><th>Engineering note</th></tr></thead><tbody>' . tools_brand_candidate_rows_html($brandMatrix) . '</tbody></table>';
    $html .= '<h2>7. Warnings and Engineering Recommendations</h2><h3>Warnings</h3><ul>' . tools_list_html($calc['warnings'] ?? []) . '</ul><h3>Risk recommendations</h3><ul>' . tools_list_html(array_merge($calc['riskRecommendations'] ?? [], $calc['noiseRecommendations'] ?? [])) . '</ul>';
    $html .= '<h2>8. Formula Trace</h2><ol>' . tools_list_html($calc['formulaTrace'] ?? []) . '</ol>';
    $html .= '<h2>9. Engineering Validation Matrix</h2><table><tbody>' . tools_html_rows(['Validation schema' => $validation['schema'] ?? '', 'Overall status' => $validation['overallStatus'] ?? '', 'Critical items' => $validation['criticalCount'] ?? 0, 'Review items' => $validation['reviewCount'] ?? 0]) . '</tbody></table><table><thead><tr><th>Area</th><th>Status</th><th>Severity</th><th>Note</th><th>Required action</th></tr></thead><tbody>' . tools_validation_rows_html($validation) . '</tbody></table>';
    $html .= '<h2>10. Vendor Data Validation Matrix</h2><table><tbody>' . tools_html_rows(['Validation schema' => $vendorValidation['schema'] ?? '', 'Overall status' => $vendorValidation['overallStatus'] ?? '', 'Missing/TBD fields' => $vendorValidation['missingCount'] ?? 0, 'Vendor certification required' => !empty($vendorValidation['certificationRequired']) ? 'Yes' : 'No']) . '</tbody></table><table><thead><tr><th>Vendor / Data field</th><th>Value</th><th>Status</th><th>Note</th></tr></thead><tbody>' . tools_vendor_validation_rows_html($vendorValidation) . '</tbody></table>';
    $html .= '<h2>11. Final Gate and Quota Trace</h2><table><tbody>' . tools_html_rows(['Final gate ready' => !empty($gate['readyForFinalPhase']) ? 'Yes' : 'No', 'Report status' => $finalMeta['status'] ?? '', 'Quota consumed' => !empty($finalMeta['quotaConsumed']) ? 'Yes' : 'No', 'Quota exempt' => !empty($finalMeta['quotaExempt']) ? 'Yes' : 'No', 'Report cost' => $finalMeta['reportCost'] ?? '', 'Browser PDF mode' => !empty($finalMeta['browserPrintPdf']) ? 'Print / Save as PDF' : 'No', 'Server binary PDF' => 'No']) . '</tbody></table>';
    $html .= '<h2>12. Assumptions and Limitations</h2><ul><li>This report is generated from the data submitted in the locked draft and approved in the CRM workflow.</li><li>The calculations are advanced engineering screening calculations for Control Valve sizing. Vendor-certified final model selection must be verified against manufacturer data, project specifications and responsible engineer review.</li><li>Gas/Steam calculations in this build are pressure-ratio and preliminary sizing screens; final IEC/ISA/vendor acoustic calculations may require vendor software or validated project libraries.</li><li>Server-side binary PDF generation is not bundled; use the Print / Save as PDF button in a browser for a PDF copy.</li></ul>';
    $html .= '<p class="small">Document integrity: draft checksum ' . tools_e($draft['checksum'] ?? '') . ' | final report number ' . tools_e($reportNo) . '</p>';
    $html .= '</main></body></html>';
    return $html;
}

function tools_safe_report_draft($draft) {
    $summary = tools_report_draft_summary($draft);
    return [
        'draftId' => $summary['draftId'] ?? '',
        'tool' => $summary['tool'] ?? '',
        'licenseId' => $summary['licenseId'] ?? '',
        'checksum' => $summary['checksum'] ?? '',
        'serverChecksum' => $summary['serverChecksum'] ?? '',
        'status' => $summary['status'] ?? '',
        'createdAt' => $summary['createdAt'] ?? '',
        'finalReport' => $summary['finalReport'] ?? [],
        'final' => (bool)($summary['final'] ?? false),
        'pdf' => false,
        'pdfReady' => (bool)($summary['pdfReady'] ?? false),
        'download' => (bool)($summary['download'] ?? false),
    ];
}

function tools_token_hash($token) {
    return hash_hmac('sha256', $token, tools_secret());
}
function tools_safe_license($lic) {
    return [
        'licenseId' => $lic['licenseId'] ?? '',
        'type' => $lic['type'] ?? 'single_report',
        'tool' => $lic['tool'] ?? '',
        'expiresAt' => $lic['expiresAt'] ?? '',
        'maxReports' => (int)($lic['maxReports'] ?? 1),
        'usedReports' => (int)($lic['usedReports'] ?? 0),
        'quotaExempt' => (($lic['type'] ?? '') === 'staff_internal'),
        'grantTtlSeconds' => tools_grant_ttl_seconds($lic),
    ];
}
function tools_grant_ttl_seconds($lic) {
    $type = $lic['type'] ?? 'single_report';
    if ($type === 'staff_internal') return 30 * 24 * 3600;
    if ($type === 'enterprise' || $type === 'subscription') return 7 * 24 * 3600;
    return 2 * 3600;
}
function tools_make_grant($lic, $tool) {
    $ttl = tools_grant_ttl_seconds($lic);
    $payload = [
        'licenseId' => $lic['licenseId'] ?? '',
        'tool' => $tool,
        'type' => $lic['type'] ?? 'single_report',
        'exp' => time() + $ttl,
        'iat' => time(),
        'ttl' => $ttl,
        'persistent' => in_array(($lic['type'] ?? ''), ['staff_internal', 'enterprise', 'subscription'], true),
    ];
    $body = base64_encode(json_encode($payload, JSON_UNESCAPED_UNICODE));
    $sig = hash_hmac('sha256', $body, tools_secret());
    return ['token' => $body . '.' . $sig, 'payload' => $payload];
}
function tools_verify_grant($grant, $tool = '') {
    if (!$grant || strpos($grant, '.') === false) return false;
    [$body, $sig] = explode('.', $grant, 2);
    if (!hash_equals(hash_hmac('sha256', $body, tools_secret()), $sig)) return false;
    $payload = json_decode(base64_decode($body, true), true);
    if (!is_array($payload)) return false;
    if ((int)($payload['exp'] ?? 0) < time()) return false;
    if ($tool && ($payload['tool'] ?? '') !== $tool && ($payload['tool'] ?? '') !== 'all') return false;
    return $payload;
}

$action = $_REQUEST['action'] ?? 'status';

if ($action === 'metrics_ingest') {
    if (!tools_rate_limit('metrics_ingest', 120)) {
        http_response_code(429);
        echo json_encode(['ok' => false, 'error' => 'rate_limit'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    $in = tools_read_input();
    $events = $in['events'] ?? [];
    if (isset($in['event'])) $events = [$in];
    if (!is_array($events)) $events = [];
    $events = array_slice($events, 0, 40);
    $data = tools_load_metrics();
    if (!isset($data['days']) || !is_array($data['days'])) $data['days'] = [];
    $accepted = 0;
    foreach ($events as $ev) {
        if (!is_array($ev)) continue;
        $event = tools_metric_event($ev['event'] ?? 'event');
        $path = tools_metric_path($ev['path'] ?? '/');
        $source = tools_metric_source($ev['utm_source'] ?? ($ev['source'] ?? 'direct'));
        $day = tools_metric_day($ev['t'] ?? '');
        if (!isset($data['days'][$day]) || !is_array($data['days'][$day])) $data['days'][$day] = ['total' => 0, 'events' => [], 'paths' => [], 'sources' => [], 'eventPath' => []];
        $data['days'][$day]['total'] = (int)($data['days'][$day]['total'] ?? 0) + 1;
        tools_metrics_add($data['days'][$day]['events'], $event);
        tools_metrics_add($data['days'][$day]['paths'], $path);
        tools_metrics_add($data['days'][$day]['sources'], $source);
        tools_metrics_add($data['days'][$day]['eventPath'], $event . '|' . $path);
        $accepted++;
    }
    if ($accepted && !tools_save_metrics($data)) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'metrics_store_write_failed'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    echo json_encode(['ok' => true, 'accepted' => $accepted, 'privacy' => 'aggregate_only_no_sid_no_label_no_query'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

if ($action === 'admin_metrics_summary') {
    $admin = tools_admin_require();
    $in = tools_read_input();
    $days = max(1, min(120, (int)($in['days'] ?? 30)));
    $summary = tools_metrics_summary(tools_load_metrics(), $days);
    echo json_encode(['ok' => true, 'daysBack' => $days, 'summary' => $summary, 'privacy' => 'aggregate_only_no_sid_no_label_no_query'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

if ($action === 'feedback_create') {
    if (!tools_rate_limit('feedback_create', 20)) {
        http_response_code(429);
        echo json_encode(['ok' => false, 'error' => 'rate_limit'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    $in = tools_read_input();
    $tool = tools_norm_tool($in['tool'] ?? 'control_valve_advanced');
    $source = tools_clean($in['source'] ?? 'tools', 80);
    $rating = tools_clean($in['rating'] ?? '', 20);
    $role = tools_clean($in['role'] ?? '', 80);
    $company = tools_clean($in['company'] ?? '', 160);
    $contact = tools_clean($in['contact'] ?? '', 160);
    $message = tools_clean($in['message'] ?? '', 2000);
    $pageUrl = tools_clean($in['pageUrl'] ?? '', 240);
    $sampleReportViewed = !empty($in['sampleReportViewed']);
    $consent = !empty($in['consent']);
    $context = is_array($in['context'] ?? null) ? $in['context'] : [];
    if (!$message || strlen($message) < 8) {
        http_response_code(422);
        echo json_encode(['ok' => false, 'error' => 'feedback_message_required'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    $licenseId = '';
    if (!empty($in['grant'])) {
        $grantPayload = tools_verify_grant(tools_clean($in['grant'], 1200), $tool);
        if ($grantPayload) $licenseId = tools_clean($grantPayload['licenseId'] ?? '', 120);
    }
    $feedbackId = 'FDB-' . date('Ymd-His') . '-' . strtoupper(substr(hash('sha256', $message . '|' . microtime(true)), 0, 6));
    $rec = [
        'feedbackId' => $feedbackId,
        'tool' => $tool,
        'source' => $source,
        'status' => 'new',
        'createdAt' => date('c'),
        'rating' => $rating,
        'role' => $role,
        'company' => $company,
        'contact' => $contact,
        'message' => $message,
        'pageUrl' => $pageUrl,
        'sampleReportViewed' => $sampleReportViewed,
        'consent' => $consent,
        'licenseId' => $licenseId,
        'context' => [
            'tag' => tools_clean($context['tag'] ?? '', 80),
            'service' => tools_clean($context['service'] ?? '', 160),
            'phase' => tools_clean($context['phase'] ?? '', 80),
            'reportPreviewOpened' => !empty($context['reportPreviewOpened']),
        ],
        'ipHash' => hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? '') . '|' . tools_secret()),
        'userAgent' => tools_clean($_SERVER['HTTP_USER_AGENT'] ?? '', 240),
        'history' => [],
    ];
    $items = tools_load_feedback();
    array_unshift($items, $rec);
    if (count($items) > 500) $items = array_slice($items, 0, 500);
    if (!tools_save_feedback($items)) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'feedback_store_write_failed'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    echo json_encode(['ok' => true, 'feedback' => tools_feedback_summary($rec), 'message' => 'Feedback received. Thank you.'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

if ($action === 'admin_feedback_list') {
    $admin = tools_admin_require();
    $items = tools_load_feedback();
    $safe = array_map('tools_feedback_summary', $items);
    usort($safe, function($a, $b) { return strcmp($b['createdAt'] ?? '', $a['createdAt'] ?? ''); });
    echo json_encode(['ok' => true, 'feedback' => $safe, 'count' => count($safe)], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

if ($action === 'admin_feedback_update') {
    $admin = tools_admin_require();
    $in = tools_read_input();
    $feedbackId = tools_clean($in['feedbackId'] ?? '', 120);
    $status = tools_feedback_status($in['status'] ?? 'reviewed');
    $note = tools_clean($in['note'] ?? '', 600);
    if (!$feedbackId) {
        http_response_code(422);
        echo json_encode(['ok' => false, 'error' => 'feedback_id_required'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    $items = tools_load_feedback();
    $found = false;
    foreach ($items as &$f) {
        if (($f['feedbackId'] ?? '') !== $feedbackId) continue;
        $found = true;
        $old = $f['status'] ?? 'new';
        $f['status'] = $status;
        $f['reviewNote'] = $note;
        $f['reviewedAt'] = date('c');
        $f['reviewedBy'] = $admin['user'] ?? '';
        $hist = is_array($f['history'] ?? null) ? $f['history'] : [];
        array_unshift($hist, ['at' => $f['reviewedAt'], 'by' => $f['reviewedBy'], 'from' => $old, 'to' => $status, 'note' => $note]);
        $f['history'] = array_slice($hist, 0, 30);
        break;
    }
    unset($f);
    if (!$found) {
        http_response_code(404);
        echo json_encode(['ok' => false, 'error' => 'feedback_not_found'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    if (!tools_save_feedback($items)) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'feedback_store_write_failed'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    echo json_encode(['ok' => true, 'feedback' => tools_feedback_summary(tools_find_feedback($feedbackId)), 'message' => 'Feedback review status updated.'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}


if ($action === 'admin_list') {
    $admin = tools_admin_require();
    $licenses = tools_load_licenses();
    $safe = array_map('tools_safe_license_admin', $licenses);
    usort($safe, function($a, $b) { return strcmp($b['issuedAt'] ?? '', $a['issuedAt'] ?? ''); });
    echo json_encode(['ok' => true, 'licenses' => $safe, 'count' => count($safe)], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($action === 'admin_issue') {
    $admin = tools_admin_require();
    $in = tools_read_input();
    $tool = tools_norm_tool($in['tool'] ?? 'control_valve_advanced');
    $type = tools_norm_type($in['type'] ?? 'single_report');
    $maxReports = max(1, min(9999, (int)($in['maxReports'] ?? ($type === 'staff_internal' ? 9999 : 1))));
    if ($type === 'staff_internal') { $tool = 'all'; $maxReports = max($maxReports, 9999); }
    $expiresAt = tools_clean($in['expiresAt'] ?? ($type === 'staff_internal' ? '2099-12-31T23:59:59+03:30' : date('c', strtotime('+90 days'))), 60);
    if (!$expiresAt || strtotime($expiresAt) === false) $expiresAt = date('c', strtotime('+90 days'));
    $company = tools_clean($in['company'] ?? (($in['issuedTo']['company'] ?? '') ?? ''), 160);
    $contact = tools_clean($in['contact'] ?? (($in['issuedTo']['contact'] ?? '') ?? ''), 160);
    $note = tools_clean($in['note'] ?? '', 300);
    $rawCode = tools_random_code($tool, $type);
    $lic = [
        'licenseId' => tools_license_id_from_code($rawCode),
        'type' => $type,
        'status' => 'active',
        'tool' => $tool,
        'maxReports' => $maxReports,
        'usedReports' => 0,
        'expiresAt' => $expiresAt,
        'issuedTo' => ['company' => $company, 'contact' => $contact],
        'tokenHash' => tools_token_hash($rawCode),
        'issuedAt' => date('c'),
        'issuedBy' => $admin['user'] ?? '',
        'note' => $note,
    ];
    $licenses = tools_load_licenses();
    $licenses[] = $lic;
    if (!tools_save_licenses($licenses)) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'license_store_write_failed'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    echo json_encode(['ok' => true, 'license_code' => $rawCode, 'license' => tools_safe_license_admin($lic), 'oneTimeVisible' => true], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($action === 'admin_update') {
    $admin = tools_admin_require();
    $in = tools_read_input();
    $licenseId = tools_clean($in['licenseId'] ?? '', 120);
    if (!$licenseId) {
        http_response_code(422);
        echo json_encode(['ok' => false, 'error' => 'license_id_required'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    $licenses = tools_load_licenses();
    $found = false;
    foreach ($licenses as &$lic) {
        if (($lic['licenseId'] ?? '') !== $licenseId) continue;
        $found = true;
        if (isset($in['status'])) $lic['status'] = tools_norm_status($in['status']);
        if (isset($in['tool'])) $lic['tool'] = tools_norm_tool($in['tool']);
        if (isset($in['type'])) $lic['type'] = tools_norm_type($in['type']);
        if (isset($in['maxReports'])) $lic['maxReports'] = max(1, min(9999, (int)$in['maxReports']));
        if (isset($in['expiresAt']) && strtotime((string)$in['expiresAt']) !== false) $lic['expiresAt'] = tools_clean($in['expiresAt'], 60);
        if (isset($in['company']) || isset($in['contact'])) {
            $lic['issuedTo'] = $lic['issuedTo'] ?? ['company' => '', 'contact' => ''];
            if (isset($in['company'])) $lic['issuedTo']['company'] = tools_clean($in['company'], 160);
            if (isset($in['contact'])) $lic['issuedTo']['contact'] = tools_clean($in['contact'], 160);
        }
        if (isset($in['note'])) $lic['note'] = tools_clean($in['note'], 300);
        $lic['updatedAt'] = date('c');
        $lic['updatedBy'] = $admin['user'] ?? '';
        break;
    }
    unset($lic);
    if (!$found) {
        http_response_code(404);
        echo json_encode(['ok' => false, 'error' => 'license_not_found'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    if (!tools_save_licenses($licenses)) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'license_store_write_failed'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    $safe = null;
    foreach ($licenses as $lic2) if (($lic2['licenseId'] ?? '') === $licenseId) { $safe = tools_safe_license_admin($lic2); break; }
    echo json_encode(['ok' => true, 'license' => $safe], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($action === 'admin_report_drafts') {
    $admin = tools_admin_require();
    $drafts = tools_load_report_drafts();
    $safe = array_map('tools_report_draft_summary', $drafts);
    usort($safe, function($a, $b) { return strcmp($b['createdAt'] ?? '', $a['createdAt'] ?? ''); });
    echo json_encode(['ok' => true, 'drafts' => $safe, 'count' => count($safe)], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($action === 'admin_report_draft_get') {
    $admin = tools_admin_require();
    $in = tools_read_input();
    $draftId = tools_clean($in['draftId'] ?? '', 120);
    if (!$draftId) {
        http_response_code(422);
        echo json_encode(['ok' => false, 'error' => 'draft_id_required'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    $draft = tools_find_report_draft($draftId);
    if (!$draft) {
        http_response_code(404);
        echo json_encode(['ok' => false, 'error' => 'draft_not_found'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    $summary = tools_report_draft_summary($draft);
    echo json_encode([
        'ok' => true,
        'draft' => $summary,
        'payload' => $draft['payload'] ?? null,
        'final' => (bool)($summary['final'] ?? false),
        'pdf' => false,
        'pdfReady' => (bool)($summary['pdfReady'] ?? false),
        'serverPdf' => false,
        'download' => (bool)($summary['download'] ?? false),
        'message' => !empty($summary['final']) ? 'Final HTML report has been issued for this draft.' : 'Locked report draft review. Final issue is available after approval, gate and quota.'
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

if ($action === 'admin_report_draft_update') {
    $admin = tools_admin_require();
    $in = tools_read_input();
    $draftId = tools_clean($in['draftId'] ?? '', 120);
    $status = tools_norm_report_draft_status($in['status'] ?? 'reviewed');
    $note = tools_clean($in['note'] ?? '', 500);
    if (!$draftId) {
        http_response_code(422);
        echo json_encode(['ok' => false, 'error' => 'draft_id_required'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    $drafts = tools_load_report_drafts();
    $found = false;
    foreach ($drafts as &$draft) {
        if (($draft['draftId'] ?? '') !== $draftId) continue;
        $found = true;
        $oldStatus = $draft['status'] ?? 'draft_locked';
        $draft['status'] = $status;
        $draft['reviewNote'] = $note;
        $draft['reviewedAt'] = date('c');
        $draft['reviewedBy'] = $admin['user'] ?? '';
        $hist = is_array($draft['reviewHistory'] ?? null) ? $draft['reviewHistory'] : [];
        array_unshift($hist, [
            'at' => $draft['reviewedAt'],
            'by' => $draft['reviewedBy'],
            'from' => $oldStatus,
            'to' => $status,
            'note' => $note,
        ]);
        $draft['reviewHistory'] = array_slice($hist, 0, 30);
        break;
    }
    unset($draft);
    if (!$found) {
        http_response_code(404);
        echo json_encode(['ok' => false, 'error' => 'draft_not_found'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    if (!tools_save_report_drafts($drafts)) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'report_draft_store_write_failed'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    $updated = tools_find_report_draft($draftId);
    echo json_encode(['ok' => true, 'draft' => tools_report_draft_summary($updated), 'message' => 'Report draft review status updated. Final issue is available after approval, gate and quota.'], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($action === 'admin_report_final_gate') {
    $admin = tools_admin_require();
    $in = tools_read_input();
    $draftId = tools_clean($in['draftId'] ?? '', 120);
    if (!$draftId) {
        http_response_code(422);
        echo json_encode(['ok' => false, 'error' => 'draft_id_required'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    $drafts = tools_load_report_drafts();
    $found = false;
    $gate = null;
    foreach ($drafts as &$draft) {
        if (($draft['draftId'] ?? '') !== $draftId) continue;
        $found = true;
        $gate = tools_build_final_gate($draft, $admin['user'] ?? '');
        $draft['finalGate'] = $gate;
        if (isset($gate['engineeringValidation'])) $draft['engineeringValidation'] = $gate['engineeringValidation'];
        if (isset($gate['vendorValidation'])) $draft['vendorValidation'] = $gate['vendorValidation'];
        $hist = is_array($draft['finalGateHistory'] ?? null) ? $draft['finalGateHistory'] : [];
        array_unshift($hist, [
            'at' => $gate['checkedAt'],
            'by' => $gate['checkedBy'],
            'readyForFinalPhase' => $gate['readyForFinalPhase'],
            'blockersCount' => count($gate['blockers']),
            'warningsCount' => count($gate['warnings']),
        ]);
        $draft['finalGateHistory'] = array_slice($hist, 0, 30);
        break;
    }
    unset($draft);
    if (!$found) {
        http_response_code(404);
        echo json_encode(['ok' => false, 'error' => 'draft_not_found'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    if (!tools_save_report_drafts($drafts)) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'report_draft_store_write_failed'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    $updated = tools_find_report_draft($draftId);
    echo json_encode([
        'ok' => true,
        'draft' => tools_report_draft_summary($updated),
        'gate' => $gate,
        'final' => false,
        'pdf' => false,
        'download' => false,
        'message' => 'Final readiness gate checked. If ready, CRM can issue the final HTML report and handle quota.'
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

if ($action === 'admin_report_render_locked') {
    $admin = tools_admin_require();
    $in = tools_read_input();
    $draftId = tools_clean($in['draftId'] ?? '', 120);
    if (!$draftId) {
        http_response_code(422);
        echo json_encode(['ok' => false, 'error' => 'draft_id_required'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    $drafts = tools_load_report_drafts();
    $found = false;
    $html = '';
    $gate = null;
    $renderMeta = null;
    foreach ($drafts as &$draft) {
        if (($draft['draftId'] ?? '') !== $draftId) continue;
        $found = true;
        $gate = tools_build_final_gate($draft, $admin['user'] ?? '');
        $draft['finalGate'] = $gate;
        if (isset($gate['engineeringValidation'])) $draft['engineeringValidation'] = $gate['engineeringValidation'];
        if (isset($gate['vendorValidation'])) $draft['vendorValidation'] = $gate['vendorValidation'];
        $hist = is_array($draft['finalGateHistory'] ?? null) ? $draft['finalGateHistory'] : [];
        array_unshift($hist, ['at' => $gate['checkedAt'], 'by' => $gate['checkedBy'], 'readyForFinalPhase' => $gate['readyForFinalPhase'], 'blockersCount' => count($gate['blockers']), 'warningsCount' => count($gate['warnings']), 'source' => 'locked_render']);
        $draft['finalGateHistory'] = array_slice($hist, 0, 30);
        if (!$gate['readyForFinalPhase']) break;
        $html = tools_render_locked_report_html($draft, $gate);
        $renderMeta = [
            'status' => 'locked_html_preview',
            'renderedAt' => date('c'),
            'renderedBy' => $admin['user'] ?? '',
            'htmlChecksum' => tools_checksum32($html),
            'final' => false,
            'pdf' => false,
            'download' => false,
        ];
        $draft['lockedHtmlRender'] = $renderMeta;
        break;
    }
    unset($draft);
    if (!$found) {
        http_response_code(404);
        echo json_encode(['ok' => false, 'error' => 'draft_not_found'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    if (!tools_save_report_drafts($drafts)) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'report_draft_store_write_failed'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    $updated = tools_find_report_draft($draftId);
    if (!$gate || !$gate['readyForFinalPhase']) {
        http_response_code(409);
        echo json_encode(['ok' => false, 'error' => 'final_gate_blocked', 'draft' => tools_report_draft_summary($updated), 'gate' => $gate, 'final' => false, 'pdf' => false, 'download' => false], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }
    echo json_encode(['ok' => true, 'draft' => tools_report_draft_summary($updated), 'gate' => $gate, 'render' => $renderMeta, 'html' => $html, 'final' => false, 'pdf' => false, 'download' => false, 'message' => 'Locked internal HTML report preview rendered. PDF/final report generation remains disabled.'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

if ($action === 'admin_report_quota_dry_run') {
    $admin = tools_admin_require();
    $in = tools_read_input();
    $draftId = tools_clean($in['draftId'] ?? '', 120);
    if (!$draftId) {
        http_response_code(422);
        echo json_encode(['ok' => false, 'error' => 'draft_id_required'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    $drafts = tools_load_report_drafts();
    $found = false;
    $dry = null;
    foreach ($drafts as &$draft) {
        if (($draft['draftId'] ?? '') !== $draftId) continue;
        $found = true;
        $dry = tools_build_quota_dry_run($draft, $admin['user'] ?? '');
        $draft['quotaDryRun'] = $dry;
        $hist = is_array($draft['quotaDryRunHistory'] ?? null) ? $draft['quotaDryRunHistory'] : [];
        array_unshift($hist, [
            'at' => $dry['checkedAt'],
            'by' => $dry['checkedBy'],
            'wouldConsume' => $dry['wouldConsume'],
            'quotaConsumed' => false,
            'remainingReports' => $dry['quotaBefore']['remainingReports'] ?? null,
            'blockersCount' => count($dry['blockers']),
        ]);
        $draft['quotaDryRunHistory'] = array_slice($hist, 0, 30);
        break;
    }
    unset($draft);
    if (!$found) {
        http_response_code(404);
        echo json_encode(['ok' => false, 'error' => 'draft_not_found'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    if (!tools_save_report_drafts($drafts)) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'report_draft_store_write_failed'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    $updated = tools_find_report_draft($draftId);
    echo json_encode([
        'ok' => true,
        'draft' => tools_report_draft_summary($updated),
        'quotaDryRun' => $dry,
        'final' => false,
        'pdf' => false,
        'download' => false,
        'message' => 'Quota dry-run completed. Actual quota is changed only when final report is issued.'
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

if ($action === 'admin_report_final_get') {
    $admin = tools_admin_require();
    $in = tools_read_input();
    $draftId = tools_clean($in['draftId'] ?? '', 120);
    if (!$draftId) {
        http_response_code(422);
        echo json_encode(['ok' => false, 'error' => 'draft_id_required'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    $draft = tools_find_report_draft($draftId);
    if (!$draft) {
        http_response_code(404);
        echo json_encode(['ok' => false, 'error' => 'draft_not_found'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    $finalReport = is_array($draft['finalReport'] ?? null) ? $draft['finalReport'] : [];
    if (empty($finalReport['final']) || empty($draft['finalHtml'])) {
        http_response_code(409);
        echo json_encode(['ok' => false, 'error' => 'final_report_not_issued', 'draft' => tools_report_draft_summary($draft)], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }
    echo json_encode([
        'ok' => true,
        'draft' => tools_report_draft_summary($draft),
        'finalReport' => $finalReport,
        'html' => $draft['finalHtml'],
        'final' => true,
        'pdf' => false,
        'pdfReady' => !empty($finalReport['browserPrintPdf']),
        'serverPdf' => false,
        'download' => true,
        'message' => 'Final HTML report is available. Use browser Print / Save as PDF for PDF output.'
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

if ($action === 'admin_report_final_issue') {
    $admin = tools_admin_require();
    $in = tools_read_input();
    $draftId = tools_clean($in['draftId'] ?? '', 120);
    if (!$draftId) {
        http_response_code(422);
        echo json_encode(['ok' => false, 'error' => 'draft_id_required'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    $drafts = tools_load_report_drafts();
    $found = false;
    $targetIndex = -1;
    foreach ($drafts as $i => $d) {
        if (($d['draftId'] ?? '') === $draftId) { $found = true; $targetIndex = $i; break; }
    }
    if (!$found || $targetIndex < 0) {
        http_response_code(404);
        echo json_encode(['ok' => false, 'error' => 'draft_not_found'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    $draft = $drafts[$targetIndex];
    if (!empty($draft['finalReport']['final']) && !empty($draft['finalHtml'])) {
        echo json_encode([
            'ok' => true,
            'alreadyIssued' => true,
            'draft' => tools_report_draft_summary($draft),
            'finalReport' => $draft['finalReport'],
            'html' => $draft['finalHtml'],
            'final' => true,
            'pdf' => false,
            'pdfReady' => !empty($draft['finalReport']['browserPrintPdf']),
            'serverPdf' => false,
            'download' => true,
            'message' => 'Final report was already issued. No additional quota was consumed.'
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }
    $gate = tools_build_final_gate($draft, $admin['user'] ?? '');
    $draft['finalGate'] = $gate;
    $hist = is_array($draft['finalGateHistory'] ?? null) ? $draft['finalGateHistory'] : [];
    array_unshift($hist, ['at' => $gate['checkedAt'], 'by' => $gate['checkedBy'], 'readyForFinalPhase' => $gate['readyForFinalPhase'], 'blockersCount' => count($gate['blockers']), 'warningsCount' => count($gate['warnings']), 'source' => 'final_issue']);
    $draft['finalGateHistory'] = array_slice($hist, 0, 30);
    if (!$gate['readyForFinalPhase']) {
        $drafts[$targetIndex] = $draft;
        tools_save_report_drafts($drafts);
        http_response_code(409);
        echo json_encode(['ok' => false, 'error' => 'final_gate_blocked', 'draft' => tools_report_draft_summary($draft), 'gate' => $gate, 'final' => false, 'pdf' => false, 'download' => false], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }
    $licenseId = $draft['licenseId'] ?? '';
    $licenses = tools_load_licenses();
    $licenseIndex = -1;
    $lic = null;
    foreach ($licenses as $i => $l) {
        if (($l['licenseId'] ?? '') === $licenseId) { $licenseIndex = $i; $lic = $l; break; }
    }
    if (!$lic) {
        http_response_code(409);
        echo json_encode(['ok' => false, 'error' => 'license_not_found_for_final_issue', 'draft' => tools_report_draft_summary($draft), 'gate' => $gate], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }
    $quotaExempt = (($lic['type'] ?? '') === 'staff_internal');
    $used = (int)($lic['usedReports'] ?? 0);
    $max = (int)($lic['maxReports'] ?? 0);
    $remaining = $quotaExempt ? 'unlimited' : max(0, $max - $used);
    if (!$quotaExempt && $remaining <= 0) {
        http_response_code(409);
        echo json_encode(['ok' => false, 'error' => 'license_quota_exhausted', 'draft' => tools_report_draft_summary($draft), 'gate' => $gate], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }
    $quotaBefore = ['usedReports' => $used, 'maxReports' => $max, 'remainingReports' => $remaining];
    $reportCost = $quotaExempt ? 0 : 1;
    $newUsed = $quotaExempt ? $used : $used + 1;
    $quotaAfter = ['usedReports' => $newUsed, 'maxReports' => $max, 'remainingReports' => $quotaExempt ? 'unlimited' : max(0, $max - $newUsed)];
    $reportNo = tools_next_final_report_no($drafts);
    $finalMeta = [
        'schema' => 'ADV-CV-FINAL-REPORT-v1',
        'status' => 'issued_final_html',
        'reportNo' => $reportNo,
        'issuedAt' => date('c'),
        'issuedBy' => $admin['user'] ?? '',
        'tool' => 'control_valve_advanced',
        'language' => 'en',
        'final' => true,
        'download' => true,
        'browserPrintPdf' => true,
        'serverPdf' => false,
        'quotaConsumed' => !$quotaExempt,
        'quotaExempt' => $quotaExempt,
        'reportCost' => $reportCost,
        'licenseId' => $licenseId,
        'payloadChecksum' => $draft['checksum'] ?? '',
        'serverChecksum' => $draft['serverChecksum'] ?? '',
        'quotaBefore' => $quotaBefore,
        'quotaAfter' => $quotaAfter,
        'engineeringValidation' => tools_build_engineering_validation($draft['payload'] ?? []),
        'vendorValidation' => tools_build_vendor_validation($draft['payload'] ?? []),
        'brandCandidateMatrix' => tools_brand_candidate_matrix($draft['payload'] ?? []),
    ];
    $draft['engineeringValidation'] = $finalMeta['engineeringValidation'];
    $draft['vendorValidation'] = $finalMeta['vendorValidation'];
    $draft['brandCandidateMatrix'] = $finalMeta['brandCandidateMatrix'];
    $html = tools_render_final_report_html($draft, $gate, $finalMeta);
    $finalMeta['htmlChecksum'] = tools_checksum32($html);
    $finalMeta['integrityChecksum'] = tools_checksum32(tools_stable_json($finalMeta));

    $draft['finalReport'] = $finalMeta;
    $draft['finalHtml'] = $html;
    $draft['final'] = true;
    $draft['pdf'] = false;
    $draft['pdfReady'] = true;
    $draft['download'] = true;
    $draft['serverSideReport'] = true;
    $draft['quotaConsumed'] = !$quotaExempt;
    $finalHistory = is_array($draft['finalReportHistory'] ?? null) ? $draft['finalReportHistory'] : [];
    array_unshift($finalHistory, ['at' => $finalMeta['issuedAt'], 'by' => $finalMeta['issuedBy'], 'reportNo' => $reportNo, 'htmlChecksum' => $finalMeta['htmlChecksum'], 'quotaConsumed' => !$quotaExempt, 'quotaExempt' => $quotaExempt]);
    $draft['finalReportHistory'] = array_slice($finalHistory, 0, 30);
    $dry = tools_build_quota_dry_run($draft, $admin['user'] ?? '');
    $dry['dryRun'] = false;
    $dry['quotaConsumed'] = !$quotaExempt;
    $dry['allowedToIssue'] = true;
    $dry['wouldConsume'] = !$quotaExempt;
    $dry['quotaBefore'] = $quotaBefore;
    $dry['quotaAfter'] = $quotaAfter;
    $dry['reportNo'] = $reportNo;
    $dry['warnings'] = ['Final report issued. Quota trace is now committed for this draft.', 'Server-side binary PDF remains disabled; final HTML is browser print/PDF-ready.'];
    $draft['quotaDryRun'] = $dry;
    $quotaHist = is_array($draft['quotaDryRunHistory'] ?? null) ? $draft['quotaDryRunHistory'] : [];
    array_unshift($quotaHist, ['at' => date('c'), 'by' => $admin['user'] ?? '', 'quotaConsumed' => !$quotaExempt, 'quotaExempt' => $quotaExempt, 'reportNo' => $reportNo, 'remainingReports' => $quotaAfter['remainingReports']]);
    $draft['quotaDryRunHistory'] = array_slice($quotaHist, 0, 30);
    $drafts[$targetIndex] = $draft;

    $oldLicenses = $licenses;
    if (!$quotaExempt) {
        $licenses[$licenseIndex]['usedReports'] = $newUsed;
        $licenses[$licenseIndex]['updatedAt'] = date('c');
        $licenses[$licenseIndex]['updatedBy'] = $admin['user'] ?? '';
        $useHist = is_array($licenses[$licenseIndex]['reportUseHistory'] ?? null) ? $licenses[$licenseIndex]['reportUseHistory'] : [];
        array_unshift($useHist, ['at' => $finalMeta['issuedAt'], 'by' => $finalMeta['issuedBy'], 'draftId' => $draftId, 'reportNo' => $reportNo, 'cost' => 1]);
        $licenses[$licenseIndex]['reportUseHistory'] = array_slice($useHist, 0, 50);
        if (!tools_save_licenses($licenses)) {
            http_response_code(500);
            echo json_encode(['ok' => false, 'error' => 'license_quota_write_failed'], JSON_UNESCAPED_UNICODE);
            exit;
        }
    }
    if (!tools_save_report_drafts($drafts)) {
        if (!$quotaExempt) @tools_save_licenses($oldLicenses);
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'final_report_store_write_failed'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    echo json_encode([
        'ok' => true,
        'draft' => tools_report_draft_summary($draft),
        'gate' => $gate,
        'quota' => $dry,
        'finalReport' => $finalMeta,
        'html' => $html,
        'final' => true,
        'pdf' => false,
        'pdfReady' => true,
        'serverPdf' => false,
        'download' => true,
        'message' => 'Final HTML report issued. Use browser Print / Save as PDF for a PDF copy.'
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

if ($action === 'report_draft_create') {
    if (!tools_rate_limit('report_draft_create', 20)) {
        http_response_code(429);
        echo json_encode(['ok' => false, 'error' => 'rate_limit'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    $in = tools_read_input();
    $tool = tools_norm_tool($in['tool'] ?? 'control_valve_advanced');
    $grant = tools_clean($in['grant'] ?? '', 1200);
    $grantPayload = tools_verify_grant($grant, $tool);
    if (!$grantPayload) {
        http_response_code(403);
        echo json_encode(['ok' => false, 'error' => 'invalid_grant'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    $payload = $in['payload'] ?? null;
    [$valid, $checksumOrError] = tools_validate_report_payload($payload, $grantPayload, $tool);
    if (!$valid) {
        http_response_code(422);
        echo json_encode(['ok' => false, 'error' => $checksumOrError], JSON_UNESCAPED_UNICODE);
        exit;
    }
    $draftId = 'TRD-' . date('Ymd-His') . '-' . strtoupper(substr(hash('sha256', $checksumOrError . '|' . microtime(true)), 0, 6));
    $draft = [
        'draftId' => $draftId,
        'tool' => $tool,
        'licenseId' => $grantPayload['licenseId'] ?? '',
        'checksum' => $payload['reportMeta']['checksum'] ?? '',
        'serverChecksum' => $checksumOrError,
        'status' => 'draft_locked',
        'createdAt' => date('c'),
        'payload' => $payload,
        'final' => false,
        'pdf' => false,
        'download' => false,
        'serverSideReport' => false,
    ];
    $drafts = tools_load_report_drafts();
    array_unshift($drafts, $draft);
    if (count($drafts) > 200) $drafts = array_slice($drafts, 0, 200);
    if (!tools_save_report_drafts($drafts)) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'report_draft_store_write_failed'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    echo json_encode([
        'ok' => true,
        'draft' => tools_safe_report_draft($draft),
        'message' => 'Report draft payload stored. CRM final report workflow is available after review/gate/quota.',
        'next' => 'crm_review_then_final_issue'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($action === 'status') {
    echo json_encode([
        'ok' => true,
        'module' => 'ptf-tools-license',
        'version' => 'v31.9',
        'configured' => file_exists(tools_license_file())
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($action === 'license_check') {
    if (!tools_rate_limit('license_check', 30)) {
        http_response_code(429);
        echo json_encode(['ok' => false, 'error' => 'rate_limit'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    $in = tools_read_input();
    $code = tools_clean($in['license_code'] ?? $in['code'] ?? '', 140);
    $tool = tools_clean($in['tool'] ?? 'control_valve_advanced', 80);
    if (!preg_match('/^[A-Za-z0-9][A-Za-z0-9\-_.]{7,139}$/', $code)) {
        http_response_code(422);
        echo json_encode(['ok' => false, 'error' => 'invalid_code_format'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    $licenses = tools_load_licenses();
    if (!$licenses) {
        http_response_code(503);
        echo json_encode(['ok' => false, 'error' => 'license_store_not_configured'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    $hash = tools_token_hash($code);
    $match = null;
    foreach ($licenses as $lic) {
        if (!is_array($lic)) continue;
        $licHash = (string)($lic['tokenHash'] ?? '');
        if ($licHash && hash_equals($licHash, $hash)) { $match = $lic; break; }
    }
    if (!$match) {
        http_response_code(403);
        echo json_encode(['ok' => false, 'error' => 'license_not_found'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    if (($match['status'] ?? 'active') !== 'active') {
        http_response_code(403);
        echo json_encode(['ok' => false, 'error' => 'license_not_active'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    if (!empty($match['tool']) && $match['tool'] !== 'all' && $match['tool'] !== $tool) {
        http_response_code(403);
        echo json_encode(['ok' => false, 'error' => 'license_tool_mismatch'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    if (!empty($match['expiresAt']) && strtotime($match['expiresAt']) !== false && strtotime($match['expiresAt']) < time()) {
        http_response_code(403);
        echo json_encode(['ok' => false, 'error' => 'license_expired'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    $licenseType = $match['type'] ?? 'single_report';
    $quotaExempt = ($licenseType === 'staff_internal');
    if (!$quotaExempt && isset($match['maxReports']) && (int)($match['usedReports'] ?? 0) >= (int)$match['maxReports']) {
        http_response_code(403);
        echo json_encode(['ok' => false, 'error' => 'license_quota_exhausted'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    $grant = tools_make_grant($match, $tool);
    echo json_encode(['ok' => true, 'grant' => $grant['token'], 'grantPayload' => $grant['payload'], 'license' => tools_safe_license($match)], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($action === 'grant_verify') {
    $in = tools_read_input();
    $grant = tools_clean($in['grant'] ?? '', 600);
    $tool = tools_clean($in['tool'] ?? '', 80);
    $payload = tools_verify_grant($grant, $tool);
    if (!$payload) {
        http_response_code(403);
        echo json_encode(['ok' => false, 'error' => 'invalid_grant'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    echo json_encode(['ok' => true, 'grantPayload' => $payload], JSON_UNESCAPED_UNICODE);
    exit;
}

http_response_code(400);
echo json_encode(['ok' => false, 'error' => 'unknown_action'], JSON_UNESCAPED_UNICODE);
