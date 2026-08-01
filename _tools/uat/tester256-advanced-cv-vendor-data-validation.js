/* tester256 — v31.7.97 (ADV-CV-VENDOR-DATA-VALIDATION-001)
 * Vendor data validation matrix in final gate/final report for Advanced Control Valve.
 */
require('./harness');
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var api = fs.readFileSync(path.join(ROOT, 'api/tools.php'), 'utf-8');
var ui = fs.readFileSync(path.join(ROOT, 'crm/tool-report-drafts.js'), 'utf-8');
var adv = fs.readFileSync(path.join(ROOT, 'tools/advanced-tools-ui.js'), 'utf-8');
var idx = fs.readFileSync(path.join(ROOT, 'crm/index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(ROOT, 'crm/sw.js'), 'utf-8');

SECTION('Server vendor data validation');
T('نسخه ADV-CV-VENDOR-DATA-VALIDATION-001 ثبت شده است', adv.indexOf('ADV-CV-VENDOR-DATA-VALIDATION-001') > -1 && api.indexOf('ADV-CV-VENDOR-DATA-VALIDATION-001') > -1);
T('تابع tools_build_vendor_validation و schema وجود دارد', api.indexOf('function tools_build_vendor_validation') > -1 && api.indexOf('ADV-CV-VENDOR-VALIDATION-v1') > -1);
T('vendor validation وضعیت‌های اصلی دارد', ['vendor_certified_required','vendor_data_incomplete','vendor_data_sufficient_for_screening'].every(function (x) { return api.indexOf(x) > -1; }));
T('vendor validation فیلدهای کلیدی برند/سری/Cv/FL/Xt را بررسی می‌کند', ['Preferred brand','Preferred series/model','Rated / candidate Cv','FL','Xt','Vendor certified sheet'].every(function (x) { return api.indexOf(x) > -1; }));
T('final gate vendorValidation را برمی‌گرداند و warning می‌سازد', api.indexOf("'vendorValidation' => $vendorValidation") > -1 && api.indexOf('Vendor data validation: missing/TBD fields') > -1 && api.indexOf('certified vendor sizing/selection confirmation') > -1);
T('final report HTML بخش Vendor Data Validation Matrix دارد', api.indexOf('Vendor Data Validation Matrix') > -1 && api.indexOf('tools_vendor_validation_rows_html') > -1 && api.indexOf('<th>Vendor / Data field</th>') > -1);
T('final meta vendorValidation را ذخیره می‌کند', api.indexOf("'vendorValidation' => tools_build_vendor_validation") > -1 && api.indexOf("$draft['vendorValidation']") > -1);
T('tools API status v33.4.1 است', /'version' => 'v3[0-9.]+'/.test(api));

SECTION('CRM vendor validation UI');
T('CRM/SW نسخه v33.4.1 است', /window\.VER = 'v3[0-9.]+'/.test(idx) && /ptf-crm-v3[0-9.]+/.test(sw));
T('tool-report-drafts با cache-bust v33.4.1 لود می‌شود', /tool-report-drafts.js\?v=3[0-9.]+/.test(idx));
T('CRM UI vendorStatus/vendorMissingCount را نمایش می‌دهد', ui.indexOf('vendorStatus') > -1 && ui.indexOf('vendorMissingCount') > -1 && ui.indexOf('Vendor data validation') > -1);
T('Final modal vendor status را نشان می‌دهد', ui.indexOf('Vendor:') > -1 && ui.indexOf('Engineering:') > -1 && ui.indexOf('Server PDF: No') > -1);
T('online payment همچنان اضافه نشده است', api.indexOf('payment_gateway') === -1 && ui.indexOf('payment_gateway') === -1 && api.indexOf('zarinpal') === -1);

DONE('tester256-advanced-cv-vendor-data-validation');
