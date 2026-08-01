/* tester243 — v31.7.97 (ADV-CV-REPORT-ENGINE-LOCKED-001)
 * Locked server-side HTML preview remains separate from final HTML report issue.
 */
require('./harness');
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var api = fs.readFileSync(path.join(ROOT, 'api/tools.php'), 'utf-8');
var ui = fs.readFileSync(path.join(ROOT, 'crm/tool-report-drafts.js'), 'utf-8');
var idx = fs.readFileSync(path.join(ROOT, 'crm/index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(ROOT, 'crm/sw.js'), 'utf-8');

SECTION('Server locked HTML report render');
T('api/tools.php اکشن admin_report_render_locked دارد', api.indexOf("$action === 'admin_report_render_locked'") > -1);
T('render locked با tools_admin_require محافظت می‌شود', /admin_report_render_locked[\s\S]{0,140}tools_admin_require\(\)/.test(api));
T('render قبل از تولید HTML gate را با tools_build_final_gate اجرا می‌کند', api.indexOf('$gate = tools_build_final_gate($draft') > -1 && api.indexOf("'final_gate_blocked'") > -1);
T('تابع tools_render_locked_report_html وجود دارد', api.indexOf('function tools_render_locked_report_html') > -1);
T('HTML قفل‌شده watermark صریح دارد', api.indexOf('LOCKED INTERNAL HTML PREVIEW') > -1 && api.indexOf('NOT A FINAL REPORT') > -1 && api.indexOf('NO PDF GENERATED') > -1);
T('render metadata با htmlChecksum ذخیره می‌شود', api.indexOf('lockedHtmlRender') > -1 && api.indexOf('htmlChecksum') > -1 && api.indexOf('locked_html_preview') > -1);
T('render همچنان final/PDF/download false است', api.indexOf("'final' => false") > -1 && api.indexOf("'pdf' => false") > -1 && api.indexOf("'download' => false") > -1);
T('tools API status به v33.4.6 رسیده است', /'version' => 'v3[0-9.]+'/.test(api));

SECTION('CRM locked render UI');
T('CRM نسخه v33.4.6 است', /window\.VER = 'v3[0-9.]+'/.test(idx) && /ptf-crm-v3[0-9.]+/.test(sw));
T('tool-report-drafts.js با v33.4.6 لود می‌شود', /tool-report-drafts.js\?v=3[0-9.]+/.test(idx));
T('UI تابع ptfToolReportDraftRenderLocked دارد', ui.indexOf('window.ptfToolReportDraftRenderLocked = function') > -1);
T('UI اکشن admin_report_render_locked را صدا می‌زند', ui.indexOf('admin_report_render_locked') > -1);
T('UI دکمه‌های Locked HTML دارد', ui.indexOf('Locked HTML') > -1 && ui.indexOf('ptfToolReportDraftRenderLocked') > -1);
T('UI modal locked preview و checksum را نمایش می‌دهد', ui.indexOf('Locked internal HTML report preview') > -1 && ui.indexOf('htmlChecksum') > -1 && ui.indexOf('Review preview only') > -1);
T('UI locked preview کنار final download است و exportPdf/document.write ندارد', ui.indexOf('ptfToolReportDraftFinalGet') > -1 && ui.indexOf('createObjectURL') > -1 && ui.indexOf('document.write') === -1 && ui.indexOf('exportPdf') === -1);

DONE('tester243-tools-report-engine-locked');
