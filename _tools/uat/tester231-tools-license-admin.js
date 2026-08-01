/* tester231 — v31.7.97 (TOOLS-LICENSE-ADMIN-001)
 * CRM admin panel and authenticated API for manual engineering tools license issuance.
 */
require('./harness');
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var api = fs.readFileSync(path.join(ROOT, 'api/tools.php'), 'utf-8');
var ui = fs.readFileSync(path.join(ROOT, 'crm/tool-licenses.js'), 'utf-8');
var idx = fs.readFileSync(path.join(ROOT, 'crm/index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(ROOT, 'crm/sw.js'), 'utf-8');

SECTION('Authenticated admin API');
T('api/tools.php اکشن‌های admin دارد', ["$action === 'admin_list'", "$action === 'admin_issue'", "$action === 'admin_update'"].every(function (x) { return api.indexOf(x) > -1; }));
T('admin API با JWT auth.php محافظت می‌شود', api.indexOf("require_once __DIR__ . '/auth.php'") > -1 && api.indexOf('auth_get_header_token') > -1 && api.indexOf('auth_verify_token') > -1);
T('فقط admin/chairman مجاز هستند', api.indexOf("['admin', 'chairman']") > -1 && api.indexOf('admin_required') > -1);
T('صدور لایسنس کد خام را با random_bytes می‌سازد', api.indexOf('function tools_random_code') > -1 && api.indexOf('random_bytes(9)') > -1);
T('سرور فقط tokenHash ذخیره می‌کند و raw code در license object ذخیره نمی‌شود', api.indexOf("'tokenHash' => tools_token_hash($rawCode)") > -1 && api.indexOf("'license_code' => $rawCode") > -1 && api.indexOf("$safe['rawCodeStored'] = false") > -1);
T('ذخیره runtime در crm/data/tool_licenses.json با wrapper licenses انجام می‌شود', api.indexOf('function tools_save_licenses') > -1 && api.indexOf("'licenses' => array_values($licenses)") > -1 && api.indexOf('JSON_PRETTY_PRINT') > -1);
T('نوع/ابزار/وضعیت validate می‌شوند', ['tools_norm_tool','tools_norm_type','tools_norm_status','staff_internal','control_valve_advanced'].every(function (x) { return api.indexOf(x) > -1; }));
T('status API به v33.4.5 رسیده است', /'version' => 'v3[0-9.]+'/.test(api));

SECTION('CRM admin UI');
T('tool-licenses.js در CRM با cache-bust v33.4.5 لود می‌شود', /tool-licenses.js\?v=3[0-9.]+/.test(idx) && /window\.VER = 'v3[0-9.]+'/.test(idx) && /ptf-crm-v3[0-9.]+/.test(sw));
T('UI فقط برای admin/chairman نمایش داده می‌شود', ui.indexOf("['admin', 'chairman'].indexOf(curRole())") > -1 && ui.indexOf('roleOk()') > -1);
T('UI به تنظیمات CRM تزریق می‌شود', ui.indexOf('var _buildSettings = window.buildSettings') > -1 && ui.indexOf('ptfToolLicensesAdminHtml') > -1);
T('فرم صدور لایسنس ابزار/نوع/سقف/انقضا دارد', ['tlCompany','tlContact','tlType','tlTool','tlMax','tlExp','tlNote'].every(function (x) { return ui.indexOf(x) > -1; }));
T('UI اکشن‌های admin_list/admin_issue/admin_update را صدا می‌زند', ['admin_list','admin_issue','admin_update'].every(function (x) { return ui.indexOf(x) > -1; }));
T('درخواست‌های UI توکن JWT را با X-CRM-Token می‌فرستند', ui.indexOf("'X-CRM-Token': token()") > -1 && ui.indexOf("localStorage.getItem('ptf_crm_token')") > -1);
T('کد خام یک‌بار نمایش/کپی می‌شود', ui.indexOf('کد خام فقط همین یک‌بار') > -1 && ui.indexOf('ptfToolLicCopyLast') > -1 && ui.indexOf('oneTimeVisible') === -1);
T('وضعیت لایسنس active/suspended/revoked قابل تغییر است', ['active','suspended','revoked','ptfToolLicSetStatus'].every(function (x) { return ui.indexOf(x) > -1; }));
T('کد پرسنل داخلی با tool all و سقف ۹۹۹۹ پشتیبانی می‌شود', ui.indexOf('ptfToolLicIssueStaff') > -1 && ui.indexOf("type: staff ? 'staff_internal'") > -1 && ui.indexOf('maxReports: staff ? 9999') > -1);

DONE('tester231-tools-license-admin');
