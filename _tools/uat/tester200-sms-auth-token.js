/* tester200 — v31.7.25 (BUG-AUTH-007: پیامک → «ارسال ناموفق: Authentication required»)
 * گزارش کارفرما با اسکرین‌شات: ارسال پیامک خطای Authentication required می‌داد؛ کلید API سالم بود.
 * ریشه: بازمانده incident v31.7.4 — هات‌فیکس JWT (v31.7.7/8) فقط bridge.js/sync.js را پوشش داد؛
 * sms.js (sms_bulk/get_backup/list_backups)، backup.js، golive.js و rbac.js هنوز فقط X-CRM-Role
 * می‌فرستادند که از v31.7.4 دیگر برای verify_request کافی نیست → 401.
 * رفع ریشه‌ای: wrapper سراسری fetch در ui-kit.js — هر درخواست api/crm.php بدون X-CRM-Token،
 * توکن JWT جاری را خودکار می‌گیرد؛ ماژول‌های آینده هم برای همیشه ایمن‌اند (پایان این خانواده). */
require('./harness');
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var uk = fs.readFileSync(path.join(ROOT, 'crm/ui-kit.js'), 'utf-8');
var idx = fs.readFileSync(path.join(ROOT, 'crm/index.html'), 'utf-8');

SECTION('وجود رفع در source');
T('wrapper سراسری fetch با گارد یک‌باره', uk.indexOf('BUG-AUTH-007') > -1 && /_ptfFetchTokWrapped/.test(uk));
T('فقط درخواست‌های api/crm.php دستکاری می‌شوند', /url\.indexOf\('api\/crm\.php'\) > -1/.test(uk));
T('توکن موجود بازنویسی نمی‌شود (احترام به هدر صریح ماژول‌ها)', /!h\['X-CRM-Token'\] && !h\['x-crm-token'\]/.test(uk) && /!h\.has\('X-CRM-Token'\)/.test(uk));
T('پشتیبانی از هر دو شکل headers (object و Headers)', /instanceof Headers/.test(uk));
T('ui-kit.js اول از همه ماژول‌ها لود می‌شود (پوشش کامل)', (function () {
  var scripts = idx.match(/<script[^>]*src="[^"]+\.js\?v=/g) || [];
  return scripts.length && scripts[0].indexOf('ui-kit.js') > -1;
})());

SECTION('رفتاری: شبیه‌سازی دقیق سناریوی کارفرما (sms_bulk)');
global.window = global;
var calls = [];
global.Headers = function () {}; // ساده — مسیر object headers تست می‌شود
global.fetch = function (input, init) { calls.push({ url: String(input), init: init || {} }); return { then: function () { return this; }, catch: function () { return this; } }; };
localStorage.setItem('ptf_crm_token', 'JWT-TEST-TOKEN-123');
// اجرای wrapper
eval(uk.match(/\/\* ===== v31\.7\.25 BUG-AUTH-007[\s\S]*?\}\)\(\);/)[0]);
// ۱) فراخوانی مثل sms.js فعلی — فقط X-CRM-Role
window.fetch('../api/crm.php?action=sms_bulk', { method: 'POST', headers: { 'X-CRM-Role': 'admin' }, body: 'x' });
T('sms_bulk بدون توکن → wrapper توکن JWT را خودکار اضافه کرد (401 دیگر رخ نمی‌دهد)', calls[0].init.headers['X-CRM-Token'] === 'JWT-TEST-TOKEN-123' && calls[0].init.headers['X-CRM-Role'] === 'admin');
// ۲) فراخوانی بدون هیچ init (مثل sms_status)
window.fetch('../api/crm.php?action=list_backups');
T('فراخوانی بدون init هم توکن می‌گیرد', calls[1].init.headers && calls[1].init.headers['X-CRM-Token'] === 'JWT-TEST-TOKEN-123');
// ۳) ماژولی که خودش توکن می‌فرستد (bridge.js) — دست نخورد
window.fetch('../api/crm.php?action=data_pull', { headers: { 'X-CRM-Token': 'EXPLICIT-TOKEN' } });
T('توکن صریح ماژول بازنویسی نمی‌شود', calls[2].init.headers['X-CRM-Token'] === 'EXPLICIT-TOKEN');
// ۴) درخواست غیر crm.php (کاوه‌نگار/سایت) — کاملاً دست‌نخورده
window.fetch('https://api.kavenegar.com/v1/send', { headers: {} });
T('درخواست‌های خارجی دستکاری نمی‌شوند', !calls[3].init.headers['X-CRM-Token']);
// ۵) بدون login (توکن نبود) — رفتار قبلی حفظ
localStorage.removeItem('ptf_crm_token');
window.fetch('../api/crm.php?action=sms_bulk', { headers: {} });
T('بدون توکن جاری، هدری جعل نمی‌شود', !calls[4].init.headers['X-CRM-Token']);
// ۶) گارد یک‌باره — اجرای دوباره wrapper دوبار wrap نمی‌کند
var fetchBefore = window.fetch;
eval(uk.match(/\/\* ===== v31\.7\.25 BUG-AUTH-007[\s\S]*?\}\)\(\);/)[0]);
T('گارد _ptfFetchTokWrapped: بدون double-wrap', window.fetch === fetchBefore);

SECTION('پوشش ماژول‌های آسیب‌دیده (سند دامنه باگ)');
var sms = fs.readFileSync(path.join(ROOT, 'crm/sms.js'), 'utf-8');
T('sms.js همچنان بدون توکن دستی است — wrapper پوشش می‌دهد (بدون تغییر ماژول)', sms.indexOf('X-CRM-Token') === -1 && sms.indexOf('sms_bulk') > -1);

DONE('tester200-sms-auth-token');
