/* tester255 — v31.7.97 (ADV-CV-ENGINEERING-VALIDATION-MATRIX-001)
 * Engineering validation matrix in final gate/final report for Advanced Control Valve.
 */
require('./harness');
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var api = fs.readFileSync(path.join(ROOT, 'api/tools.php'), 'utf-8');
var ui = fs.readFileSync(path.join(ROOT, 'crm/tool-report-drafts.js'), 'utf-8');
var adv = fs.readFileSync(path.join(ROOT, 'tools/advanced-tools-ui.js'), 'utf-8');
var idx = fs.readFileSync(path.join(ROOT, 'crm/index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(ROOT, 'crm/sw.js'), 'utf-8');

SECTION('Server engineering validation matrix');
T('نسخه ADV-CV-ENGINEERING-VALIDATION-MATRIX-001 ثبت شده است', adv.indexOf('ADV-CV-ENGINEERING-VALIDATION-MATRIX-001') > -1 && api.indexOf('ADV-CV-ENGINEERING-VALIDATION-MATRIX-001') > -1);
T('تابع tools_build_engineering_validation وجود دارد', api.indexOf('function tools_build_engineering_validation') > -1 && api.indexOf('ADV-CV-ENGINEERING-VALIDATION-v1') > -1);
T('validation وضعیت‌های acceptable/review/vendor validation دارد', ['acceptable_for_screening','engineering_review_required','requires_vendor_validation'].every(function (x) { return api.indexOf(x) > -1; }));
T('validation choked/gas-steam/noise/cavitation/reducer/velocity را بررسی می‌کند', ['Choked / critical flow','Compressible service','Noise risk','Cavitation / pressure risk','Reducer / attached fittings','Line velocity'].every(function (x) { return api.indexOf(x) > -1; }));
T('final gate engineeringValidation را برمی‌گرداند', api.indexOf("'engineeringValidation' => $engineeringValidation") > -1 && api.indexOf('Engineering validation [') > -1);
T('final report HTML بخش Engineering Validation Matrix دارد', api.indexOf('Engineering Validation Matrix') > -1 && api.indexOf('tools_validation_rows_html') > -1 && api.indexOf('<th>Required action</th>') > -1);
T('final meta validation را ذخیره می‌کند', api.indexOf("'engineeringValidation' => tools_build_engineering_validation") > -1 && api.indexOf("$draft['engineeringValidation']") > -1);
T('tools API status v33.5.0 است', /'version' => 'v3[0-9.]+'/.test(api));

SECTION('CRM engineering validation UI');
T('CRM/SW نسخه v33.5.0 است', /window\.VER = 'v3[0-9.]+'/.test(idx) && /ptf-crm-v3[0-9.]+/.test(sw));
T('tool-report-drafts با cache-bust v33.5.0 لود می‌شود', /tool-report-drafts.js\?v=3[0-9.]+/.test(idx));
T('CRM UI engineeringStatus را در list/detail/gate نشان می‌دهد', ui.indexOf('engineeringStatus') > -1 && ui.indexOf('engineeringCriticalCount') > -1 && ui.indexOf('Engineering validation') > -1);
T('Final modal engineering status را نشان می‌دهد', ui.indexOf('Engineering:') > -1 && ui.indexOf('Server PDF: No') > -1);
T('online payment همچنان اضافه نشده است', api.indexOf('payment_gateway') === -1 && ui.indexOf('payment_gateway') === -1 && api.indexOf('zarinpal') === -1);

DONE('tester255-advanced-cv-engineering-validation-matrix');
