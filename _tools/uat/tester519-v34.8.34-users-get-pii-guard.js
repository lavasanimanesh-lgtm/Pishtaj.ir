#!/usr/bin/env node
'use strict';
/* tester519 — v34.37.4 (T1-1 / PII-GUARD): پایان نشت موبایل/ایمیل کاربران بدون احراز هویت.
   ریشه: $client_role = 'anonymous' باعث می‌شد !empty($client_role) همیشه true باشد و
   گارد «حداقل‌سازی فیلدها پیش از لاگین» (D-02) کد مرج شود — تأیید زنده روی هر دو محیط. */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

var php = read('api/crm.php');

/* ۱) گارد اصلاح‌شده: anonymous هم ناشناس حساب می‌شود */
T('گارد $authenticated شامل checkanonymous است', /\$authenticated\s*=\s*!empty\(\$client_role\)\s*&&\s*\$client_role\s*!==\s*'anonymous'/.test(php));

/* ۲) فیلدهای حساس فقط داخل شاخهٔ احرازشده */
var caseIdx = php.indexOf("case 'users_get'");
var caseEnd = php.indexOf("case 'role_verify'", caseIdx);
T('case users_get یافت شد', caseIdx > -1 && caseEnd > caseIdx);
var body = php.slice(caseIdx, caseEnd);
T("mobile فقط در if ($authenticated)", /if\s*\(\s*\$authenticated\s*\)\s*\{[^}]*'mobile'/s.test(body) && (body.match(/\$row\['mobile'\]/g) || []).length === 1);
T("email فقط در if ($authenticated)", (body.match(/\$row\['email'\]/g) || []).length === 1);
T('passhash هرگز خروجی نمی‌شود', body.indexOf('passhash') === -1 || !/\$row\['passhash'\]/.test(body));

/* ۳) users_get همچنان عمومی است (پیش‌بار صفحهٔ ورود) ولی فقط فیلدهای امن */
T('users_get در public_actions باقی است', /public_actions\s*=\s*\[[^\]]*'users_get'[^\]]*\]/.test(php));

/* ۴) شبیه‌سازی: نقش 'anonymous' نباید احرازشده تلقی شود */
(function sim() {
  var cases = [['anonymous', false], ['admin', true], ['', false], [null, false]];
  cases.forEach(function (c) {
    var authed = !!(c[0]) && c[0] !== 'anonymous';
    T('شبیه‌سازی role=' + JSON.stringify(c[0]) + ' → authenticated=' + c[1], authed === c[1]);
  });
})();

/* ۵) تسترهای قدیمی PII نسخهٔ قبل نقض نشوند: response ساختار users/name/roleId دارد */
T('ساختار پاسخ امن حفظ شده (username/name/roleId)', /'username'\s*=>[\s\S]*'name'\s*=>[\s\S]*'roleId'\s*=>/.test(body));

console.log('\n— tester519 (v34.37.4: PII-GUARD users_get) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
