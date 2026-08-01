/* tester263 — v31.7.97 (TOOLS-FEEDBACK-CRM-INBOX-001)
 * Public feedback capture and CRM feedback inbox for Advanced Control Valve.
 */
require('./harness');
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var api = fs.readFileSync(path.join(ROOT, 'api/tools.php'), 'utf-8');
var fb = fs.readFileSync(path.join(ROOT, 'tools/advanced-feedback-ui.js'), 'utf-8');
var adv = fs.readFileSync(path.join(ROOT, 'tools/advanced-tools-ui.js'), 'utf-8');
var tools = fs.readFileSync(path.join(ROOT, 'tools/index.html'), 'utf-8');
var landing = fs.readFileSync(path.join(ROOT, 'tools/control-valve-sizing/index.html'), 'utf-8');
var crm = fs.readFileSync(path.join(ROOT, 'crm/tool-feedback.js'), 'utf-8');
var idx = fs.readFileSync(path.join(ROOT, 'crm/index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(ROOT, 'crm/sw.js'), 'utf-8');

SECTION('Server feedback API');
T('api/tools.php اکشن feedback_create دارد', api.indexOf("$action === 'feedback_create'") > -1 && api.indexOf('feedback_message_required') > -1);
T('feedback runtime در crm/data/tool_feedback.json ذخیره می‌شود', api.indexOf('tools_feedback_file') > -1 && api.indexOf('tool_feedback.json') > -1 && api.indexOf('tools_save_feedback') > -1);
T('feedback_create rate limit و safe output دارد', api.indexOf("tools_rate_limit('feedback_create'") > -1 && api.indexOf('tools_feedback_summary') > -1);
T('admin feedback list/update با admin auth محافظت می‌شود', api.indexOf("$action === 'admin_feedback_list'") > -1 && api.indexOf("$action === 'admin_feedback_update'") > -1 && /admin_feedback_list[\s\S]{0,120}tools_admin_require\(\)/.test(api) && /admin_feedback_update[\s\S]{0,160}tools_admin_require\(\)/.test(api));
T('feedback statusهای CRM تعریف شده‌اند', ['new','reviewed','contacted','converted','needs_followup','spam','archived'].every(function (x) { return api.indexOf(x) > -1; }));
T('tools API status v33.4.8 است', /'version' => 'v3[0-9.]+'/.test(api));

SECTION('Public feedback UI');
T('advanced-feedback-ui.js وجود و نسخه دارد', fb.indexOf('PTF Advanced Tools Feedback UI') > -1 && fb.indexOf('v31.7.97') > -1);
T('feedback UI تابع open/submit دارد', fb.indexOf('ptfAdvCvOpenFeedbackForm') > -1 && fb.indexOf('ptfAdvCvSubmitFeedback') > -1);
T('feedback UI به feedback_create ارسال می‌کند', fb.indexOf('action=feedback_create') > -1 && fb.indexOf('sampleReportViewed') > -1 && fb.indexOf('rating') > -1);
T('tools و landing feedback script را لود می‌کنند', tools.indexOf('advanced-feedback-ui.js') > -1 && landing.indexOf('../advanced-feedback-ui.js') > -1);
T('tools و landing دکمه ثبت feedback دارند', tools.indexOf('ثبت feedback') > -1 && landing.indexOf('ثبت feedback کوتاه') > -1 && landing.indexOf("ptfAdvCvOpenFeedbackForm('landing_page')") > -1);
T('advanced modal دکمه ارسال feedback دارد ولی advanced-tools-ui fetch ندارد', adv.indexOf('ارسال feedback') > -1 && adv.indexOf('ptfAdvCvOpenFeedbackForm') > -1 && adv.indexOf('fetch(') === -1);

SECTION('CRM feedback inbox');
T('crm/tool-feedback.js وجود و توابع لازم دارد', crm.indexOf('PTF CRM — tool-feedback.js') > -1 && ['ptfToolFeedbackHtml','ptfToolFeedbackLoad','ptfToolFeedbackSet'].every(function (x) { return crm.indexOf(x) > -1; }));
T('CRM feedback UI اکشن‌های admin را صدا می‌زند', crm.indexOf('admin_feedback_list') > -1 && crm.indexOf('admin_feedback_update') > -1);
T('CRM index tool-feedback را cache-bust v33.4.8 لود می‌کند', /tool-feedback.js\?v=3[0-9.]+/.test(idx) && /window\.VER = 'v3[0-9.]+'/.test(idx) && /ptf-crm-v3[0-9.]+/.test(sw));
T('online payment همچنان اضافه نشده است', api.indexOf('payment_gateway') === -1 && api.indexOf('zarinpal') === -1 && fb.indexOf('zarinpal') === -1);

DONE('tester263-tools-feedback-crm-inbox');
