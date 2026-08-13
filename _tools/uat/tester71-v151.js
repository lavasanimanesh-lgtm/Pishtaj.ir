/* tester71 — v15.1 (BUG-015: خطای «حذف دسته‌جمعی» پاک‌سازی زباله‌های ابری) */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var st = fs.readFileSync(path.join(BASE, 'storage.js'), 'utf-8');
var sp = fs.readFileSync(path.resolve(__dirname, '../../api/storage.php'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');

SECTION('ریشه BUG-015: فراخوانی توابع تعریف‌نشده در storage.php');
T('clean() دیگر در storage.php صدا زده نمی‌شود (فقط در کامنت)', !/[^\/\*\u0600-\u06FF\w]clean\(\(string\)/.test(sp) && sp.indexOf('$k = clean(') === -1);
T('verify_request() تعریف‌نشده دیگر صدا زده نمی‌شود', sp.indexOf('verify_request()') === -1);
T('پاکسازی کلید محلی و امن (trim + طول + ضد ..)', sp.indexOf("$k = trim((string)$k);") > -1 && sp.indexOf("strpos($k, '..') !== false") > -1);
T('سقف ایمنی ۲۰۰۰ کلید', sp.indexOf('count($keys) > 2000') > -1);
T('شمار ناموفق‌ها هم گزارش می‌شود (failed)', sp.indexOf("'failed' => $failed") > -1);
T('delete_batch همچنان در SENSITIVE_ACTIONS (فقط از خود دامنه)', sp.indexOf("'delete_batch'") > -1 && sp.indexOf('$SENSITIVE_ACTIONS = [') > -1);

SECTION('ساختار PHP: هیچ تابع تعریف‌نشده‌ای صدا زده نمی‌شود');
(function () {
  var defined = {};
  (sp.match(/function\s+(\w+)\s*\(/g) || []).forEach(function (m) { defined[m.replace(/function\s+|\s*\(/g, '')] = 1; });
  var crmOnly = ['clean', 'verify_request', 'role_guard', 'load_data', 'save_data', 'push_event_rec'];
  var bad = crmOnly.filter(function (fn) {
    return !defined[fn] && new RegExp('(^|[^\\w$>])' + fn + '\\s*\\(', 'm').test(sp.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, ''));
  });
  T('توابع مختص crm.php در storage.php صدا زده نمی‌شوند: ' + (bad.join(',') || 'هیچ'), bad.length === 0);
})();

SECTION('کلاینت: تشخیص پاسخ غیر JSON + پیام شفاف');
T('پاسخ delete_batch با text→JSON parse امن خوانده می‌شود', st.indexOf("return res.text().then(function (tx)") > -1 && st.indexOf("پاسخ غیر JSON از سرور (HTTP ' + res.status") > -1);
T('رد سرور (ok:false) پیام مجزا دارد', st.indexOf('سرور حذف را رد کرد') > -1);
T('گزارش فایل‌های حذف‌نشده (failed) به کاربر', st.indexOf('فایل حذف نشد (دسترسی/اتصال آروان)') > -1);
T('پیام catch حالا علت واقعی را ضمیمه می‌کند', st.indexOf("eDb && eDb.message ? '\\n' + eDb.message : ''") > -1);
T('محافظ‌های v121.2 پابرجا: archives/ و backups/ زباله نیستند', st.indexOf("['archives/', 'backups/']") > -1 && st.indexOf("key.indexOf('archives/') === 0") > -1);
T('جمع‌آوری بازگشتی کلیدهای فعال پابرجا (harvest)', st.indexOf('function harvest(obj)') > -1 && st.indexOf('ptf_crm_sigprofiles') > -1);

SECTION('رفتار اجرایی: پارس پاسخ سالم/خراب');
(function () {
  /* شبیه‌سازی منطق جدید پارس پاسخ */
  function parseLike(status, body) {
    try { return { ok: true, val: JSON.parse(body) }; }
    catch (e) { return { ok: false, err: 'پاسخ غیر JSON از سرور (HTTP ' + status + '): ' + body.slice(0, 180) }; }
  }
  var good = parseLike(200, '{"ok":true,"deleted":5,"failed":0,"total":5}');
  T('پاسخ JSON سالم پارس می‌شود', good.ok && good.val.deleted === 5);
  var bad = parseLike(500, '<br /><b>Fatal error</b>: Call to undefined function clean()');
  T('پاسخ Fatal Error PHP → خطای شفاف با متن سرور', !bad.ok && bad.err.indexOf('HTTP 500') > -1 && bad.err.indexOf('Fatal error') > -1);
})();

SECTION('نسخه و کش (بدون قفل نسخه دقیق)');
T('VER الگوی v1x', /window\.PTF_CRM_RELEASE\s*=\s*'v\d+(?:\.\d+)+'/.test(idx));
T('کش sw هم‌خانواده ptf-crm-v1', /var RELEASE\s*=\s*'v\d+(?:\.\d+)+'/.test(sw));
T('cache-bust storage.js (>=15.1)', (function () {
  var m = idx.match(/storage\.js\?v=(\d+)\.(\d+)/);
  return m && (+m[1] > 15 || (+m[1] === 15 && +m[2] >= 1));
})());

DONE('tester71-v151');
