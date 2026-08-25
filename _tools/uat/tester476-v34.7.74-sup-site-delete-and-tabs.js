#!/usr/bin/env node
'use strict';
/* v34.8.6 — انتقال فهرست «ثبت‌نام‌شده از سایت» به زیر تب‌ها + حذف رکورد ثبت‌نام.
   باگ/درخواست: فهرست تامین‌کنندگان ثبت‌نام‌کرده از سایت بالای تب‌ها نمایش داده می‌شد
   و راهی برای حذف رکوردها (مثلاً ثبت‌نام اسپم/نامعتبر) وجود نداشت.
   رفع: ① جابه‌جایی DOM عنصر supPendWrap به بعد از تب‌ها (cheques.js)
        ② دکمهٔ 🗑 برای مدیران ارشد + اکشن سروری del_supplier_site (bridge.js + api/crm.php) */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

var ver = JSON.parse(read('VERSION.json'));
var idx = read('crm/index.html');
var cheq = read('crm/cheques.js');
var brg = read('crm/bridge.js');
var api = read('api/crm.php');
var gate = read('_tools/uat/run-ci-gate.js');

T('VERSION.json = v34.8.6', ver.crm_version === 'v34.8.6', ver.crm_version);
T('cheques.js cache-bust 34.8.6', /cheques\.js\?v=34\.8\.6/.test(idx));
T('bridge.js cache-bust 34.8.6', /bridge\.js\?v=34\.8\.6/.test(idx));

/* ① انتقال supPendWrap به زیر تب‌ها */
T('تابع supPendBelowTabs تعریف شد', /function supPendBelowTabs\(\)\s*\{/.test(cheq));
T('جابه‌جایی DOM با insertAdjacentElement afterend', cheq.indexOf("tabs.insertAdjacentElement('afterend', pend)") > -1);
T('شرط idempotent (دوباره جابه‌جا نشود)', cheq.indexOf('tabs.nextElementSibling !== pend') > -1);
T('فراخوانی در renderSuppliers', /window\.renderSuppliers2 = window\.renderSuppliers = function \(\) \{\s*supPendBelowTabs\(\);/.test(cheq));

/* ② دکمهٔ حذف ثبت‌نام سایت */
T('تابع supSiteDelete تعریف شد', /window\.supSiteDelete = function \(code\)\s*\{/.test(brg));
T('گارد نقش ارشد در supSiteDelete', brg.indexOf('if (!isSenior()) {') > -1 && brg.indexOf('فقط مدیران ارشد می‌توانند ثبت‌نام سایت را حذف کنند') > -1);
T('دکمهٔ حذف در رندر ثبت‌نام سایت', brg.indexOf('onclick="supSiteDelete(') > -1);
T('دکمهٔ حذف فقط برای مدیران ارشد (isSenior)', /\(isSenior\(\)\s*\?\s*'<button[^>]*onclick="supSiteDelete/.test(brg));
T('تایید قبل از حذف (confirm)', brg.indexOf("confirm('🗑 حذف ثبت‌نام سایت") > -1);
T('حذف محلی از ptf_site_suppliers', brg.indexOf("localStorage.setItem('ptf_site_suppliers'") > -1);

/* ③ اکشن سروری */
T('اکشن del_supplier_site در api/crm.php', api.indexOf("case 'del_supplier_site':") > -1);
T('ثبت در $SENSITIVE با approve_write', api.indexOf("'del_supplier_site'=>'approve_write'") > -1);
T('role_guard ارشد در اکشن', /case 'del_supplier_site':[\s\S]*?role_guard\('approve_write'\)/.test(api));
T('فیلتر و ذخیرهٔ حذف', api.indexOf("array_values(array_filter($items, function ($it) use ($code)") > -1);

T('tester476 در گیت CI', gate.indexOf('tester476-v34.7.74-sup-site-delete-and-tabs.js') > -1);

console.log('\n— tester476 (v34.8.6: انتقال ثبت‌نام‌های سایت زیر تب‌ها + حذف رکورد) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
