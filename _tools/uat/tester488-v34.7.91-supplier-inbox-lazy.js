#!/usr/bin/env node
'use strict';
/* v34.37.6 — فعال‌سازی صفحه‌بندی get_inbox در کلاینت (SUP-PERF-005).
   - syncServerInbox فقط صفحهٔ اول (۵۰) suppliers را از سرور می‌گیرد و با کش محلی ادغام می‌کند.
   - syncServerInboxMore بقیه صفحات را با offset می‌گیرد.
   - supPendingMore وقتی سرور هنوز بیشتر دارد، صفحهٔ بعدی را می‌گیرد.
   - سرور fresh را فقط در درخواست‌های بدون صفحه‌بندی برمی‌گرداند (نه در offset>0). */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

var ver = JSON.parse(read('VERSION.json'));
var idx = read('crm/index.html');
var brg = read('crm/bridge.js');
var api = read('api/crm.php');
var gate = read('_tools/uat/run-ci-gate.js');

T('VERSION.json = v34.37.6', ver.crm_version === 'v34.37.6', ver.crm_version);
T('bridge.js cache-bust 34.37.6', /bridge\.js\?v=34\.37\.6/.test(idx));

/* ---------- کلاینت ---------- */
T('SITE_SUP_PAGE = 50', /var SITE_SUP_PAGE = 50;/.test(brg));
T('syncServerInbox limit=50&offset=0 می‌فرستد', brg.indexOf("'&limit=' + SITE_SUP_PAGE + '&offset=0'") > -1);
T('syncServerInboxMore offset می‌فرستد', /syncServerInboxMore = function/.test(brg) && brg.indexOf("'&limit=' + SITE_SUP_PAGE + '&offset=' + _offset") > -1);
T('ادغام با کش محلی (siteSupMerge)', /function siteSupMerge\(incoming, total\)/.test(brg));
T('total از پاسخ ذخیره می‌شود', brg.indexOf('ptf_site_suppliers_total') > -1);
T('supPendingMore اگر سرور بیشتر دارد، صفحهٔ بعدی می‌گیرد', brg.indexOf("siteSupTotal() > siteSuppliers().length") > -1 && brg.indexOf("syncServerInboxMore(function () {") > -1);
T('دکمهٔ بیشتر وقتی total سروری بیشتر است', brg.indexOf('var serverMore = siteSupTotal() > all.length') > -1);
T('رندر از total سروری استفاده می‌کند', /totalAll = siteSupTotal\(\) \|\| all\.length/.test(brg));

/* ---------- سرور ---------- */
T('get_inbox fresh فقط بدون صفحه‌بندی', /if \(\$limit === 0 && \$offset === 0/.test(api));
T('get_inbox limit/offset پشتیبانی می‌کند', api.indexOf('$limit = (int)($_REQUEST[\'limit\'] ?? 0)') > -1 && api.indexOf('$offset = max(0, (int)($_REQUEST[\'offset\'] ?? 0))') > -1);
T('supTotal/rfqTotal در پاسخ', api.indexOf("'supTotal' => $supTotal") > -1 && api.indexOf("'rfqTotal' => $rfqTotal") > -1);

T('tester488 در گیت CI', gate.indexOf('tester488-v34.7.91-supplier-inbox-lazy.js') > -1);

console.log('\n— tester488 (v34.37.6: فعال‌سازی صفحه‌بندی get_inbox در کلاینت — SUP-PERF-005) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
