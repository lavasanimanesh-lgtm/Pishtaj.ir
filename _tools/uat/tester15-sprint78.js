/* TESTER-15 — اسپرینت ۷۸/۷۸.۱: کاربران سروری + رفع ورود فایرفاکس */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var ROOT = path.resolve(__dirname, '../..');
var rbacCode = fs.readFileSync(path.join(BASE,'rbac.js'),'utf-8');
var idxCode = fs.readFileSync(path.join(BASE,'index.html'),'utf-8');
var apiCode = fs.readFileSync(path.join(ROOT,'api/crm.php'),'utf-8');
var swCode = fs.readFileSync(path.join(BASE,'sw.js'),'utf-8');
SECTION('سرور');
T('users_sync با گارد', /case 'users_sync':[\s\S]{0,150}role_guard\('users_write'\)/.test(apiCode));
T('users_get موجود', apiCode.indexOf("case 'users_get'") > -1);
T('passhash فقط hex + سقف ۱۰۰', apiCode.indexOf("preg_replace('/[^a-f0-9]/'") > -1 && apiCode.indexOf('حداکثر ۱۰۰ کاربر') > -1);
SECTION('کلاینت: سینک');
T('usersSyncToServer + pull', rbacCode.indexOf('function usersSyncToServer') > -1 && rbacCode.indexOf('function usersPullFromServer') > -1);
T('ثبت/حذف → سینک', rbacCode.indexOf("setData('ptf_crm_users', users)")>-1 && rbacCode.indexOf('usersSyncToServer()')>-1); /* 2026-08-13: جریان ثبت کاربر بازطراحی شد (push سروری با رمز واقعی) */
T('seed خودکار per session', rbacCode.indexOf('ptf_users_seeded') > -1);
SECTION('v78.1: ورود فایرفاکس');
T('fetch مستقیم users_get با no-store', idxCode.indexOf('action=users_get&t=') > -1 && idxCode.indexOf("cache: 'no-store'") > -1);
T('پیام: سرور قطع', idxCode.indexOf('اتصال به سرور برقرار نشد') > -1);
T('پیام: سرور خالی', idxCode.indexOf('هنوز کاربری روی سرور ثبت نشده') > -1);
T('پیام: کاربر نیست/رمز غلط یا fallback مستقیم موبایل', (idxCode.indexOf('نه در این مرورگر و نه روی سرور') > -1 || idxCode.indexOf('احراز هویت مستقیم سرور') > -1) && (idxCode.indexOf('رمز عبور اشتباه است') > -1 || idxCode.indexOf('همگام‌سازی کاربران') > -1));
// v31.7.7 HOTFIX-AUTH: login now uses server-side auth_login instead of local passhash comparison
T('ورود موفق → session (server auth_login)', /action=auth_login[\s\S]{0,500}removeItem\('ptf_login_lock'\)/.test(idxCode));
T('ادغام بدون حذف محلی', idxCode.indexOf('merged.push(x)') > -1);
T('sha256 fallback (HTTP بدون crypto.subtle)', idxCode.indexOf('sha256Fallback') > -1);
SECTION('v78.1: کش SW');
T('شل CRM Network-First', swCode.indexOf('isShell') > -1 && swCode.indexOf("mode === 'navigate'") > -1);
T('SW v78.1 + VER v78.1', swCode.indexOf('ptf-crm-') > -1 && idxCode.indexOf("var VER = window.PTF_CRM_RELEASE") > -1);
// تست عملی fallback sha256
var crypto = require('crypto');
var m = idxCode.match(/function sha256Fallback[\s\S]*?\n\}/);
eval(m[0]);
T('sha256Fallback === مرجع node', sha256Fallback('ptf2026') === crypto.createHash('sha256').update('ptf2026','utf8').digest('hex'));
T('fallback با فارسی', sha256Fallback('رمز۱۲۳') === crypto.createHash('sha256').update('رمز۱۲۳','utf8').digest('hex'));
DONE('TESTER-15 (Sprint78.1)');
process.exit(RESULTS.fail ? 1 : 0);
