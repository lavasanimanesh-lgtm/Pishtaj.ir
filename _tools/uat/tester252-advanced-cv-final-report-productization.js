/* tester252 — v31.7.97 (ADV-CV-FINAL-REPORT-PRODUCTIZATION-001)
 * Final report issue workflow for Advanced Control Valve: CRM approval/gate/quota -> immutable final HTML.
 */
require('./harness');
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var api = fs.readFileSync(path.join(ROOT, 'api/tools.php'), 'utf-8');
var ui = fs.readFileSync(path.join(ROOT, 'crm/tool-report-drafts.js'), 'utf-8');
var adv = fs.readFileSync(path.join(ROOT, 'tools/advanced-tools-ui.js'), 'utf-8');
var rep = fs.readFileSync(path.join(ROOT, 'tools/advanced-report-ui.js'), 'utf-8');
var idx = fs.readFileSync(path.join(ROOT, 'crm/index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(ROOT, 'crm/sw.js'), 'utf-8');

SECTION('Server final report issue API');
T('api/tools.php اکشن‌های final issue/get دارد', api.indexOf("$action === 'admin_report_final_issue'") > -1 && api.indexOf("$action === 'admin_report_final_get'") > -1);
T('final issue با admin auth محافظت می‌شود', /admin_report_final_issue[\s\S]{0,160}tools_admin_require\(\)/.test(api));
T('final issue قبل از صدور gate را اجرا می‌کند', api.indexOf('$gate = tools_build_final_gate($draft') > -1 && api.indexOf('final_gate_blocked') > -1);
T('شماره گزارش نهایی PTF-CV-YYYYMMDD-NNN ساخته می‌شود', api.indexOf('function tools_next_final_report_no') > -1 && api.indexOf("'PTF-CV-' . date('Ymd')") > -1);
T('موتور HTML نهایی با چارت داخلی وجود دارد', api.indexOf('function tools_render_final_report_html') > -1 && api.indexOf('Final Engineering Screening Report') > -1 && api.indexOf('tools_chart_svg') > -1 && api.indexOf('Cv by operating case') > -1);
T('final meta schema/checksum/status دارد', ['ADV-CV-FINAL-REPORT-v1','issued_final_html','htmlChecksum','integrityChecksum','payloadChecksum'].every(function (x) { return api.indexOf(x) > -1; }));
T('PDF باینری سرور false ولی browserPrintPdf true است', api.indexOf("'browserPrintPdf' => true") > -1 && api.indexOf("'serverPdf' => false") > -1 && api.indexOf('Print / Save as PDF') > -1);
T('quota فقط در final issue مصرف می‌شود', api.indexOf("$licenses[$licenseIndex]['usedReports'] = $newUsed") > -1 && api.indexOf('reportUseHistory') > -1 && api.indexOf('Quota trace is now committed') > -1);
T('staff_internal quota-exempt است', api.indexOf("($lic['type'] ?? '') === 'staff_internal'") > -1 && api.indexOf("'quotaExempt' => $quotaExempt") > -1 && api.indexOf('Staff/internal license') > -1);
T('online payment در final issue فعال نشده است', api.indexOf('payment_gateway') === -1 && api.indexOf('online_payment') === -1 && api.indexOf('zarinpal') === -1);

SECTION('CRM final report UI');
T('CRM نسخه v33.4.9 است', /window\.VER = 'v3[0-9.]+'/.test(idx) && /ptf-crm-v3[0-9.]+/.test(sw));
T('CRM UI توابع final issue/get/download/open دارد', ['ptfToolReportDraftFinalIssue','ptfToolReportDraftFinalGet','ptfToolReportDraftDownloadFinalHtml','ptfToolReportDraftOpenFinalWindow'].every(function (x) { return ui.indexOf(x) > -1; }));
T('CRM UI اکشن‌های final issue/get را صدا می‌زند', ui.indexOf('admin_report_final_issue') > -1 && ui.indexOf('admin_report_final_get') > -1);
T('CRM UI دانلود HTML با Blob و createObjectURL دارد', ui.indexOf('new Blob([html]') > -1 && ui.indexOf('URL.createObjectURL') > -1 && ui.indexOf('a.download = filename') > -1);
T('CRM UI server PDF را صریحاً No نشان می‌دهد', ui.indexOf('Server PDF: No') > -1 && ui.indexOf('Browser PDF: Print / Save as PDF') > -1);
T('advanced draft submit پیام final workflow می‌دهد', rep.indexOf('CRM final workflow') > -1 || rep.indexOf('گزارش نهایی انگلیسی HTML') > -1);
T('advanced-tools payload همچنان draft final=false دارد', adv.indexOf('LOCKED_PREVIEW_PAYLOAD') > -1 && adv.indexOf('draft final: false') > -1);

DONE('tester252-advanced-cv-final-report-productization');
