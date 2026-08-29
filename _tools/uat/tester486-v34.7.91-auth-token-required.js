#!/usr/bin/env node
'use strict';
/* v34.8.47 — ورود اجباری با توکن سرور (AUTH-TOKEN-REQUIRED).
   رفع ریشه‌ی «توکن معتبر وجود ندارد؛ با رمز واقعی وارد شوید» بعد از خروج/ورود مجدد:
   - مسیر ورود فقط-محلی که session بدون توکن می‌ساخت حذف شد.
   - هر پاسخ منفی مؤکد auth_login، پیام دقیق می‌دهد و session نمی‌سازد.
   - ptfSafeReset و idleCheck توکن/نقش را هم پاک می‌کنند.
   - showCrm همچنان بدون توکن ورود را رد می‌کند. */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

var ver = JSON.parse(read('VERSION.json'));
var idx = read('crm/index.html');
var inq = read('crm/inqreader.js');
var gate = read('_tools/uat/run-ci-gate.js');

T('VERSION.json = v34.8.47', ver.crm_version === 'v34.8.47', ver.crm_version);
T('index PTF_CRM_RELEASE = v34.8.47', /window\.PTF_CRM_RELEASE = 'v34\.8.47'/.test(idx));
T('inqreader.js cache-bust 34.8.47', /inqreader\.js\?v=34\.8.47/.test(idx));

/* ---------- حذف ورود فقط-محلی بدون توکن ---------- */
T('متن قدیمیِ «ورود فقط-محلی» حذف شد', idx.indexOf("users[i].username === u && users[i].passhash && users[i].passhash === ph") < 0);
T('مسیر legacy «session بدون توکن» حذف شد', idx.indexOf("localStorage.setItem('ptf_crm_session', JSON.stringify({user:u, name:users[i].name") < 0);
T('هر پاسخ negative سرور پیام می‌دهد (بدون session)', /_srvErr !== ''/.test(idx) && /ورود از سرور رد شد/.test(idx));
T('پیام too_many_attempts متمایز است', idx.indexOf("_srvErr === 'too_many_attempts'") > -1);
T('پیام invalid_credentials متمایز است', idx.indexOf("_srvErr === 'invalid_credentials'") > -1);
T('ورود موفق همچنان session+token می‌سازد (از v34.8.47/R5: از طریق ptfAuthLoginWrite → sessionStorage؛ LS فقط پاک می‌شود)', idx.indexOf("ptfAuthLoginWrite(_login.token") > -1 && read('crm/rbac.js').indexOf("sessionStorage.setItem('ptf_crm_token'") > -1);
T('مسیر direct auth_login (users_get قدیمی) حفظ شده (از v34.8.47/R5: ptfAuthLoginWrite)', idx.indexOf("_directLogin") > -1 && idx.indexOf("ptfAuthLoginWrite(_directLogin.token") > -1);

/* ---------- پاک‌سازی توکن ---------- */
T('ptfSafeReset توکن را پاک می‌کند', idx.indexOf("localStorage.removeItem('ptf_crm_token')") > -1 && idx.indexOf("function ptfSafeReset") > -1);
T('ptfSafeReset نقش را پاک می‌کند', idx.indexOf("localStorage.removeItem('ptf_crm_token_role')") > -1 && idx.indexOf("function ptfSafeReset") > -1);
T('idleCheck توکن را پاک می‌کند', inq.indexOf("localStorage.removeItem('ptf_crm_token')") > -1 && /۸ ساعت عدم فعالیت/.test(inq));
T('idleCheck نقش را پاک می‌کند', inq.indexOf("localStorage.removeItem('ptf_crm_token_role')") > -1);

/* ---------- showCrm همچنان سخت‌گیرانه ---------- */
T('showCrm بدون توکن ورود را رد می‌کند', idx.indexOf("!localStorage.getItem('ptf_crm_token')") > -1 && idx.indexOf('ptfInvalidateSession') > -1);

T('tester486 در گیت CI', gate.indexOf('tester486-v34.7.91-auth-token-required.js') > -1);

console.log('\n— tester486 (v34.8.47: ورود اجباری توکن سرور — AUTH-TOKEN-REQUIRED) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
