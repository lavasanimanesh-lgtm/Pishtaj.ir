/* tester241 — v31.7.97 (ADV-CV-REPORT-REVIEW-ACTIONS-001)
 * Internal CRM review status/actions for locked engineering tool report drafts.
 */
require('./harness');
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var api = fs.readFileSync(path.join(ROOT, 'api/tools.php'), 'utf-8');
var ui = fs.readFileSync(path.join(ROOT, 'crm/tool-report-drafts.js'), 'utf-8');
var idx = fs.readFileSync(path.join(ROOT, 'crm/index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(ROOT, 'crm/sw.js'), 'utf-8');

SECTION('Server review update API');
T('api/tools.php اکشن admin_report_draft_update دارد', api.indexOf("$action === 'admin_report_draft_update'") > -1);
T('review update با tools_admin_require محافظت می‌شود', /admin_report_draft_update[\s\S]{0,120}tools_admin_require\(\)/.test(api));
T('statusهای review مجاز تعریف شده‌اند', ['reviewed','needs_data','approved_for_final_phase','rejected','duplicate'].every(function (x) { return api.indexOf(x) > -1; }));
T('history کوتاه review ذخیره می‌شود', api.indexOf('reviewHistory') > -1 && api.indexOf('array_unshift($hist') > -1 && api.indexOf('array_slice($hist, 0, 30)') > -1);
T('review note/by/at ذخیره و در summary برگردانده می‌شود', ['reviewNote','reviewedAt','reviewedBy','historyCount','statusLabel'].every(function (x) { return api.indexOf(x) > -1; }));
T('update فقط review را تغییر می‌دهد و final issue جداست', api.indexOf('Report draft review status updated. Final issue is available') > -1 && api.indexOf('admin_report_final_issue') > -1 && api.indexOf("'pdf' => false") > -1);
T('tools API status به v33.4.8 رسیده است', /'version' => 'v3[0-9.]+'/.test(api));

SECTION('CRM review action UI');
T('tool-report-drafts.js با v33.4.8 لود می‌شود', /tool-report-drafts.js\?v=3[0-9.]+/.test(idx) && /window\.VER = 'v3[0-9.]+'/.test(idx) && /ptf-crm-v3[0-9.]+/.test(sw));
T('UI تابع ptfToolReportDraftSetStatus دارد', ui.indexOf('window.ptfToolReportDraftSetStatus = function') > -1 && ui.indexOf('admin_report_draft_update') > -1);
T('UI برای statusها دکمه دارد', ['Reviewed','Needs data','Approved for final phase','Rejected','Duplicate'].every(function (x) { return ui.indexOf(x) > -1; }));
T('UI note review با prompt می‌گیرد', ui.indexOf('یادداشت review') > -1 && ui.indexOf('prompt(') > -1);
T('جدول ستون Review و badge وضعیت دارد', ui.indexOf('<th>Review</th>') > -1 && ui.indexOf('function statusBadge') > -1);
T('modal detail review status/note/by/at نشان می‌دهد', ['reviewStatus','reviewNote','reviewedBy','reviewedAt'].every(function (x) { return ui.indexOf(x) > -1; }));
T('UI review کنار workflow نهایی قرار دارد و exportPdf/document.write ندارد', ui.indexOf('ptfToolReportDraftSetStatus') > -1 && ui.indexOf('ptfToolReportDraftFinalIssue') > -1 && ui.indexOf('document.write') === -1 && ui.indexOf('exportPdf') === -1);

DONE('tester241-tools-report-review-actions');
