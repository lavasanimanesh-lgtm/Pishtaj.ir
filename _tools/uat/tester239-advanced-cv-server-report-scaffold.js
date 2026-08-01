/* tester239 — v31.7.97 (ADV-CV-SERVER-REPORT-SCAFFOLD-001)
 * Server scaffold stores locked Advanced CV report payload draft after grant/checksum validation; no PDF/final report.
 */
require('./harness');
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var api = fs.readFileSync(path.join(ROOT, 'api/tools.php'), 'utf-8');
var tools = fs.readFileSync(path.join(ROOT, 'tools/index.html'), 'utf-8');
var adv = fs.readFileSync(path.join(ROOT, 'tools/advanced-tools-ui.js'), 'utf-8');
var rep = fs.readFileSync(path.join(ROOT, 'tools/advanced-report-ui.js'), 'utf-8');
var idx = fs.readFileSync(path.join(ROOT, 'crm/index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(ROOT, 'crm/sw.js'), 'utf-8');

SECTION('Server report draft scaffold');
T('api/tools.php اکشن report_draft_create دارد', api.indexOf("$action === 'report_draft_create'") > -1);
T('report_draft_create با grant معتبر کنترل می‌شود', api.indexOf('tools_verify_grant($grant, $tool)') > -1 && api.indexOf("'invalid_grant'") > -1);
T('payload schema و checksum validate می‌شود', api.indexOf('tools_validate_report_payload') > -1 && api.indexOf('ADV-CV-REPORT-PAYLOAD-v1') > -1 && api.indexOf('checksum_mismatch') > -1);
T('server stable_json و checksum32 دارد', api.indexOf('function tools_stable_json') > -1 && api.indexOf('function tools_checksum32') > -1);
T('draft runtime در crm/data/tool_report_drafts.json ذخیره می‌شود', api.indexOf('tools_report_drafts_file') > -1 && api.indexOf('tool_report_drafts.json') > -1 && api.indexOf('tools_save_report_drafts') > -1);
T('draft safe output اولیه قفل است ولی مسیر CRM final workflow دارد', api.indexOf("'final' => (bool)($summary['final'] ?? false)") > -1 && api.indexOf("'pdf' => false") > -1 && api.indexOf("'download' => (bool)($summary['download'] ?? false)") > -1 && api.indexOf('crm_review_then_final_issue') > -1);
T('status API به v33.3.1 رسیده است', /'version' => 'v3[0-9.]+'/.test(api));

SECTION('Client scaffold');
T('advanced-report-ui.js در tools بعد از advanced-tools-ui لود می‌شود', tools.indexOf('advanced-tools-ui.js') > -1 && tools.indexOf('advanced-report-ui.js') > -1 && tools.indexOf('advanced-tools-ui.js') < tools.indexOf('advanced-report-ui.js'));
T('advanced-report-ui تابع submit دارد', rep.indexOf('window.ptfAdvCvSubmitReportDraft = function') > -1);
T('client به report_draft_create payload و grant می‌فرستد', rep.indexOf('action=report_draft_create') > -1 && rep.indexOf('grant: g.grant') > -1 && rep.indexOf('payload: prepared.payload') > -1);
T('client payload را از ptfAdvCvBuildLockedReportPayload می‌سازد', rep.indexOf('ptfAdvCvBuildLockedReportPayload') > -1 && (rep.indexOf('ptfAdvCvCalculateAdvancedCases') > -1 || rep.indexOf('ptfAdvCvCalculateLiquidCases') > -1));
T('دکمه ثبت draft گزارش در سرور در advanced UI وجود دارد', adv.indexOf('ثبت draft گزارش در سرور') > -1 && adv.indexOf('ptfAdvCvSubmitReportDraft') > -1);
T('advanced-tools-ui همچنان fetch ندارد و PDF باز نمی‌کند', adv.indexOf('fetch(') === -1 && adv.indexOf('window.print') === -1 && adv.indexOf('document.write') === -1 && adv.indexOf('exportPdf') === -1);
T('advanced-report-ui هیچ PDF/download/print/export ندارد', rep.indexOf('window.print') === -1 && rep.indexOf('document.write') === -1 && rep.indexOf('exportPdf') === -1 && rep.indexOf('createObjectURL') === -1 && rep.indexOf('download=') === -1);
T('نسخه CRM v33.3.1 است', /window\.VER = 'v3[0-9.]+'/.test(idx) && /ptf-crm-v3[0-9.]+/.test(sw));

DONE('tester239-advanced-cv-server-report-scaffold');
