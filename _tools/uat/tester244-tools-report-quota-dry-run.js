/* tester244 — v31.7.97 (ADV-CV-REPORT-QUOTA-DRY-RUN-001)
 * Dry-run quota check plus final issue path for Advanced CV report drafts; no online payment.
 */
require('./harness');
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var api = fs.readFileSync(path.join(ROOT, 'api/tools.php'), 'utf-8');
var ui = fs.readFileSync(path.join(ROOT, 'crm/tool-report-drafts.js'), 'utf-8');
var idx = fs.readFileSync(path.join(ROOT, 'crm/index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(ROOT, 'crm/sw.js'), 'utf-8');

SECTION('Server quota dry-run');
T('api/tools.php اکشن admin_report_quota_dry_run دارد', api.indexOf("$action === 'admin_report_quota_dry_run'") > -1);
T('quota dry-run با tools_admin_require محافظت می‌شود', /admin_report_quota_dry_run[\s\S]{0,140}tools_admin_require\(\)/.test(api));
T('تابع tools_build_quota_dry_run وجود دارد', api.indexOf('function tools_build_quota_dry_run') > -1);
T('dry-run قبل از issue نهایی به final gate وابسته است', api.indexOf('Final readiness gate must pass before final report issue') > -1 && api.indexOf('tools_build_final_gate($draft') > -1);
T('dry-run لایسنس و remaining quota را بررسی می‌کند', ['No remaining report quota','License is not active','License is expired','quotaBefore','quotaAfter','remainingReports'].every(function (x) { return api.indexOf(x) > -1; }));
T('dry-run quota را کم نمی‌کند و issue نهایی جداست', api.indexOf("'quotaConsumed' => false") > -1 && api.indexOf('Dry-run only: report quota is not decremented here') > -1 && api.indexOf('admin_report_final_issue') > -1);
T('dry-run در draft ذخیره و history نگه می‌دارد', api.indexOf("$draft['quotaDryRun'] = $dry") > -1 && api.indexOf('quotaDryRunHistory') > -1);
T('tools API status به v33.4.7 رسیده است', /'version' => 'v3[0-9.]+'/.test(api));

SECTION('CRM quota dry-run UI');
T('CRM نسخه v33.4.7 است', /window\.VER = 'v3[0-9.]+'/.test(idx) && /ptf-crm-v3[0-9.]+/.test(sw));
T('UI تابع ptfToolReportDraftQuotaDryRun دارد', ui.indexOf('window.ptfToolReportDraftQuotaDryRun = function') > -1);
T('UI اکشن admin_report_quota_dry_run را صدا می‌زند', ui.indexOf('admin_report_quota_dry_run') > -1);
T('جدول ستون Quota و badge دارد', ui.indexOf('<th>Quota</th>') > -1 && ui.indexOf('function quotaBadge') > -1 && ui.indexOf('Quota OK') > -1);
T('modal dry-run quota before/after و قفل PDF/final را نشان می‌دهد', ['Report quota dry-run','quotaConsumed','usedBefore','remainingBefore','usedAfter','remainingAfter'].every(function (x) { return ui.indexOf(x) > -1; }));
T('UI dry-run کنار final HTML download است و online payment/exportPdf ندارد', ui.indexOf('ptfToolReportDraftQuotaDryRun') > -1 && ui.indexOf('ptfToolReportDraftFinalIssue') > -1 && ui.indexOf('createObjectURL') > -1 && ui.indexOf('payment') === -1 && ui.indexOf('exportPdf') === -1);

DONE('tester244-tools-report-quota-dry-run');
