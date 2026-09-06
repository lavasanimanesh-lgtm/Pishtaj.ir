#!/usr/bin/env node
'use strict';
/* v34.37.7 — دکمهٔ واقعی «همگام‌سازی کاربران» + تأیید سروری پس از تعریف کاربر.
   باگ: کاربرِ تعریف‌شده از دسکتاپ وارد می‌شد ولی از موبایل نه؛ پیام خطا کاربر را به
   «همگام‌سازی کاربران» ارجاع می‌داد در حالی که چنین عملی در UI وجود نداشت. ریشه:
   سینک فقط محلی/خودکار بود و نتیجهٔ تعریف کاربر پیش از پاسخ سرور «موفق» اعلام می‌شد.
   رفع: ① دکمهٔ واقعی در پنل کاربران ② پیام موفقیت فقط پس از تأیید سینک + یک retry
   ③ متن خطاهای ورود به دکمه/خروج-ورود مجدد اشاره می‌کنند. */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

var ver = JSON.parse(read('VERSION.json'));
var idx = read('crm/index.html');
var rbac = read('crm/rbac.js');
var gate = read('_tools/uat/run-ci-gate.js');

T('VERSION.json = v34.37.7', ver.crm_version === 'v34.37.7', ver.crm_version);
T('rbac.js cache-bust 34.37.7', /rbac\.js\?v=34\.37\.7/.test(idx));

/* ① دکمهٔ واقعی همگام‌سازی کاربران */
T('تابع ptfUsersSyncManual تعریف شد', /function ptfUsersSyncManual\(\)\s*\{/.test(rbac));
T('دکمه در پنل کاربران (buildUsers)', idx.indexOf("onclick=\"ptfUsersSyncManual()\"") > -1);
T('برچسب دکمه «همگام‌سازی کاربران»', idx.indexOf('>🔄 همگام‌سازی کاربران</button>') > -1);
T('گارد نقش در ptfUsersSyncManual', rbac.indexOf("if (!roleDef().users)") > -1);
T('نمایش تعداد همگام‌شده', rbac.indexOf("' کاربر با سرور همگام شد'") > -1);
T('نمایش کاربران کنارگذاشته‌شده (dropped)', rbac.indexOf('d.dropped && d.dropped.length') > -1);

/* ② تأیید سروری پس از تعریف کاربر */
T('پیام موفقیت فقط پس از سینک (afterSync)', /function afterSync\(d\)\s*\{/.test(rbac));
T('پیام قبلی «تعریف شد» فوری حذف شد', rbac.indexOf("') تعریف شد' + (typeof smsWelcomeUser") === -1);
T('پیام جدید «تعریف و با سرور همگام شد»', rbac.indexOf('تعریف و با سرور همگام شد') > -1);
T('retry خودکار پس از شکست سینک', rbac.indexOf('setTimeout(function () {') > -1 && rbac.indexOf('usersSyncToServer(function (d2)') > -1);

/* ③ متن‌های خطای ورود به عمل واقعی اشاره می‌کنند */
T('خطای «کاربری روی سرور ثبت نشده» به دکمه اشاره می‌کند', idx.indexOf('در پنل «کاربران» دکمهٔ «🔄 همگام‌سازی کاربران» را بزند') > -1);
T('خطای «کاربر روی سرور پیدا نشد» به دکمه/خروج-ورود اشاره می‌کند', idx.indexOf('در پنل «کاربران» دکمهٔ «🔄 همگام‌سازی کاربران» را بزنید') > -1);
T('متن قدیمی «همگام‌سازی کاربران را اجرا کنید» حذف شد', idx.indexOf('همگام‌سازی کاربران» را اجرا کنید') === -1);

T('tester475 در گیت CI', gate.indexOf('tester475-v34.7.73-users-sync-button.js') > -1);

console.log('\n— tester475 (v34.37.7: دکمهٔ همگام‌سازی کاربران + تأیید سروری تعریف کاربر) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
