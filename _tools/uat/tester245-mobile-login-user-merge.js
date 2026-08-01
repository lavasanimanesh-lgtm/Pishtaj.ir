/* tester245 — v31.7.97 (BUG-AUTH-MOBILE-USER-001)
 * Mobile login must not falsely report "user not found" when server user sources are split/stale.
 */
require('./harness');
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var api = fs.readFileSync(path.join(ROOT, 'api/crm.php'), 'utf-8');
var idx = fs.readFileSync(path.join(ROOT, 'crm/index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(ROOT, 'crm/sw.js'), 'utf-8');

SECTION('Server-side merged user sources');
T('helper load_all_crm_users_sources اضافه شده است', api.indexOf('function load_all_crm_users_sources') > -1 && api.indexOf('BUG-AUTH-MOBILE-USER-001') > -1);
T('helper هر سه منبع users/crm_users/sync را merge می‌کند', api.indexOf("load_data('users')") > -1 && api.indexOf("load_data('crm_users')") > -1 && api.indexOf("/sync/ptf_crm_users.json") > -1);
T('merge passhash موجود را هنگام رکورد safe/stale حفظ می‌کند', api.indexOf("if (empty($next['passhash']) && !empty($prev['passhash']))") > -1);
T('auth_login از منبع merged استفاده می‌کند نه اولین منبع non-empty', /case 'auth_login':[\s\S]*?\$users = load_all_crm_users_sources\(\);/.test(api));
var usersGetBlock = (api.match(/case 'users_get':[\s\S]*?break;/) || [''])[0];
T('users_get از منبع merged استفاده می‌کند و همچنان passhash برنمی‌گرداند', usersGetBlock.indexOf('$all_users = load_all_crm_users_sources();') > -1 && usersGetBlock.indexOf("'username' => $u['username']") > -1 && usersGetBlock.indexOf("'email'    => $u['email']") > -1 && usersGetBlock.indexOf("'passhash' =>") === -1 && usersGetBlock.indexOf('passhash =>') === -1);
T('users_sync برای بازیابی هش، existing users را از همه منابع می‌خواند', /case 'users_sync':[\s\S]*?\$existing_srv = load_all_crm_users_sources\(\);/.test(api));

SECTION('Client mobile login fallback');
T('doLogin وقتی users_get کاربر را نشان نداد direct auth_login را امتحان می‌کند', idx.indexOf('_directLogin') > -1 && idx.indexOf("../api/crm.php?action=auth_login") > -1 && idx.indexOf('users_get can be stale') > -1);
T('direct auth_login در موفقیت token/session/local user را ذخیره می‌کند', idx.indexOf("localStorage.setItem('ptf_crm_token', _directLogin.token)") > -1 && idx.indexOf("curUsers.push({ username: u") > -1 && idx.indexOf('showCrm();') > -1);
T('پیام خطای قدیمی «نه در این مرورگر و نه روی سرور یافت نشد» حذف شده است', idx.indexOf('نه در این مرورگر و نه روی سرور یافت نشد') === -1);
T('پیام جدید راهکار همگام‌سازی کاربران را به ادمین می‌گوید', idx.indexOf('همگام‌سازی کاربران') > -1 && idx.indexOf('احراز هویت مستقیم سرور') > -1);
T('نسخه CRM و SW به v33.4.3 رسیده‌اند', /window\.VER = 'v3[0-9.]+'/.test(idx) && /ptf-crm-v3[0-9.]+/.test(sw));

DONE('tester245-mobile-login-user-merge');
