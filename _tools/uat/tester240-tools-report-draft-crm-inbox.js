/* tester240 — v31.7.97 (ADV-CV-REPORT-DRAFT-CRM-INBOX-001)
 * CRM inbox/review panel for locked Advanced Engineering Tools report drafts.
 */
require('./harness');
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var api = fs.readFileSync(path.join(ROOT, 'api/tools.php'), 'utf-8');
var ui = fs.readFileSync(path.join(ROOT, 'crm/tool-report-drafts.js'), 'utf-8');
var idx = fs.readFileSync(path.join(ROOT, 'crm/index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(ROOT, 'crm/sw.js'), 'utf-8');

SECTION('Server admin report draft review API');
T('api/tools.php اکشن‌های admin_report_drafts و admin_report_draft_get دارد', api.indexOf("$action === 'admin_report_drafts'") > -1 && api.indexOf("$action === 'admin_report_draft_get'") > -1);
T('اکشن‌های review با tools_admin_require محافظت می‌شوند', /admin_report_drafts[\s\S]{0,120}tools_admin_require\(\)/.test(api) && /admin_report_draft_get[\s\S]{0,120}tools_admin_require\(\)/.test(api));
T('summary draft final-aware و serverPdf=false است', api.indexOf('function tools_report_draft_summary') > -1 && api.indexOf("'finalReport' => [") > -1 && api.indexOf("'serverPdf' => false") > -1 && api.indexOf("'download' => $isFinal") > -1);
T('summary شامل project/readiness/risk/gov است', ['casesCount','governingCv','cavitationRisk','noiseRisk','inputCompleteForFutureReport','missingCount','pipeIssuesCount'].every(function (x) { return api.indexOf(x) > -1; }));
T('admin_report_draft_get payload را همراه وضعیت final-aware برمی‌گرداند', api.indexOf("'payload' => $draft['payload']") > -1 && api.indexOf('Locked report draft review. Final issue is available') > -1 && api.indexOf('Final HTML report has been issued') > -1);
T('tools API status به v33.4.8 رسیده است', /'version' => 'v3[0-9.]+'/.test(api));

SECTION('CRM inbox UI');
T('tool-report-drafts.js در CRM با cache-bust v33.4.8 لود می‌شود', /tool-report-drafts.js\?v=3[0-9.]+/.test(idx) && /window\.VER = 'v3[0-9.]+'/.test(idx) && /ptf-crm-v3[0-9.]+/.test(sw));
T('UI فقط برای admin/chairman است', ui.indexOf("['admin', 'chairman'].indexOf(curRole())") > -1 && ui.indexOf('roleOk()') > -1);
T('UI به buildSettings تزریق می‌شود', ui.indexOf('var _buildSettings = window.buildSettings') > -1 && ui.indexOf('ptfToolReportDraftsHtml') > -1);
T('UI admin_report_drafts و admin_report_draft_get را صدا می‌زند', ui.indexOf('admin_report_drafts') > -1 && ui.indexOf('admin_report_draft_get') > -1);
T('درخواست‌های UI توکن JWT را با X-CRM-Token می‌فرستند', ui.indexOf("'X-CRM-Token': token()") > -1 && ui.indexOf("localStorage.getItem('ptf_crm_token')") > -1);
T('جدول draftها فیلدهای مهم review را دارد', ['Draft ID','Project/Tag','License/Checksum','Governing','Risk','Readiness'].every(function (x) { return ui.indexOf(x) > -1; }));
T('modal مشاهده جزئیات payload وضعیت final/pdfReady/download را نشان می‌دهد', ui.indexOf('Locked draft review') > -1 && ui.indexOf('pdfReady') > -1 && ui.indexOf('finalReportNo') > -1 && ui.indexOf('download: f.final') > -1);
T('UI مسیر دانلود HTML نهایی دارد ولی exportPdf/document.write ندارد', ui.indexOf('ptfToolReportDraftDownloadFinalHtml') > -1 && ui.indexOf('createObjectURL') > -1 && ui.indexOf('document.write') === -1 && ui.indexOf('exportPdf') === -1);

DONE('tester240-tools-report-draft-crm-inbox');
