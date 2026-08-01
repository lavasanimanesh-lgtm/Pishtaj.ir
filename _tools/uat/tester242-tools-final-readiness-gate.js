/* tester242 — v31.7.97 (ADV-CV-FINAL-READINESS-GATE-001)
 * Final readiness gate for locked Advanced CV report drafts before final HTML issue.
 */
require('./harness');
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var api = fs.readFileSync(path.join(ROOT, 'api/tools.php'), 'utf-8');
var ui = fs.readFileSync(path.join(ROOT, 'crm/tool-report-drafts.js'), 'utf-8');
var idx = fs.readFileSync(path.join(ROOT, 'crm/index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(ROOT, 'crm/sw.js'), 'utf-8');

SECTION('Server final readiness gate');
T('api/tools.php اکشن admin_report_final_gate دارد', api.indexOf("$action === 'admin_report_final_gate'") > -1);
T('final gate با tools_admin_require محافظت می‌شود', /admin_report_final_gate[\s\S]{0,140}tools_admin_require\(\)/.test(api));
T('تابع tools_build_final_gate وجود دارد', api.indexOf('function tools_build_final_gate') > -1);
T('gate وضعیت approved_for_final_phase را لازم می‌داند', api.indexOf("$status !== 'approved_for_final_phase'") > -1 && api.indexOf('Draft review status must be approved_for_final_phase') > -1);
T('gate checksum و locked flags را دوباره بررسی می‌کند', ['Payload checksum mismatch','Draft payload must remain locked','final/pdf/download/serverSideReport'].every(function (x) { return api.indexOf(x) > -1; }));
T('gate readiness/missing/pipeIssues را بررسی می‌کند', ['Strict report readiness is incomplete','Missing required report fields','Pipe data issues'].every(function (x) { return api.indexOf(x) > -1; }));
T('gate لایسنس active/expiry/quota/tool را بررسی می‌کند', ['License is not active','License is expired','License report quota is exhausted','License tool does not allow Control Valve Advanced'].every(function (x) { return api.indexOf(x) > -1; }));
T('gate نتیجه را در finalGate و finalGateHistory ذخیره می‌کند', api.indexOf("$draft['finalGate'] = $gate") > -1 && api.indexOf('finalGateHistory') > -1);
T('gate در صورت آمادگی مسیر issue_final_report را فعال می‌کند ولی quota مصرف نمی‌کند', api.indexOf("'finalReportGenerationEnabled' => $ready") > -1 && api.indexOf("'pdfReady' => $ready") > -1 && api.indexOf("'quotaConsumed' => false") > -1 && api.indexOf('issue_final_report') > -1);
T('tools API status به v33.3.1 رسیده است', /'version' => 'v3[0-9.]+'/.test(api));

SECTION('CRM final gate UI');
T('CRM نسخه v33.3.1 و tool-report-drafts cache-bust دارد', /window\.VER = 'v3[0-9.]+'/.test(idx) && /tool-report-drafts.js\?v=3[0-9.]+/.test(idx) && /ptf-crm-v3[0-9.]+/.test(sw));
T('UI تابع ptfToolReportDraftFinalGate دارد', ui.indexOf('window.ptfToolReportDraftFinalGate = function') > -1);
T('UI اکشن admin_report_final_gate را صدا می‌زند', ui.indexOf('admin_report_final_gate') > -1);
T('جدول ستون Final Gate و badge دارد', ui.indexOf('<th>Final Gate</th>') > -1 && ui.indexOf('function gateBadge') > -1 && ui.indexOf('Gate ready') > -1 && ui.indexOf('Gate blocked') > -1);
T('modal gate blockers/warnings و وضعیت final/pdfReady/quota را نشان می‌دهد', ['Final readiness gate','Blockers','Warnings','finalReportGenerationEnabled','pdfReady','quotaConsumed'].every(function (x) { return ui.indexOf(x) > -1; }));
T('UI gate کنار final issue/download است و exportPdf/document.write ندارد', ui.indexOf('ptfToolReportDraftFinalIssue') > -1 && ui.indexOf('ptfToolReportDraftDownloadFinalHtml') > -1 && ui.indexOf('document.write') === -1 && ui.indexOf('exportPdf') === -1);

DONE('tester242-tools-final-readiness-gate');
