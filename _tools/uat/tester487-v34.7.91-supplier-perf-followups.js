#!/usr/bin/env node
'use strict';
/* v34.8.12 — ادامه بهینه‌سازی تامین‌کنندگان:
   - SUP-PERF-003: lazy-load باکس مالی (صفحه‌بندی/محتوا تا بعد از رندر پنل).
   - SUP-PERF-004: get_inbox صفحه‌بندی اختیاری (پیش‌فرض بدون تغییر). */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

var ver = JSON.parse(read('VERSION.json'));
var idx = read('crm/index.html');
var slf = read('crm/supplier-finance.js');
var api = read('api/crm.php');
var gate = read('_tools/uat/run-ci-gate.js');

T('VERSION.json = v34.8.12', ver.crm_version === 'v34.8.12', ver.crm_version);
T('supplier-finance.js cache-bust 34.8.12', /supplier-finance\.js\?v=34\.8\.12/.test(idx));

/* ---------- SUP-PERF-003: lazy box ---------- */
T('slBoxRows هست', /function slBoxRows\(\)/.test(slf));
T('ptfSlBoxLazy هست', /window\.ptfSlBoxLazy = function/.test(slf));
T('slBoxBody placeholder دارد', slf.indexOf('id="slBoxBody"') > -1);
T('box() محاسبه را به setTimeout می‌سپارد', slf.indexOf('setTimeout(function () { if (typeof window.ptfSlBoxLazy') > -1);
T('slBox همچنان open/summary دارد', /<details id="slBox" open/.test(slf) && /<summary/.test(slf));
T('slBoxRows از balanceHtmlFrom بدون تکرار استفاده می‌کند', slf.indexOf('balanceHtmlFrom(b, s.cd)') > -1);

/* ---------- SUP-PERF-004: get_inbox pagination ---------- */
T('get_inbox limit پشتیبانی می‌کند', api.indexOf('$limit = (int)($_REQUEST[\'limit\'] ?? 0)') > -1);
T('get_inbox offset پشتیبانی می‌کند', api.indexOf('$offset = max(0, (int)($_REQUEST[\'offset\'] ?? 0))') > -1);
T('بدون limit پیش‌فرض همه برمی‌گردد', api.indexOf("'limit' => $limit > 0 ? $limit : $supTotal") > -1);
T('پاسخ total دارد', api.indexOf("'supTotal' => $supTotal") > -1 && api.indexOf("'rfqTotal' => $rfqTotal") > -1);
T('fresh/gzip قبلی حفظ شده', api.indexOf("'fresh' => true") > -1 && api.indexOf('ptf_echo_json') > -1);

T('tester487 در گیت CI', gate.indexOf('tester487-v34.7.91-supplier-perf-followups.js') > -1);

console.log('\n— tester487 (v34.8.12: ادامه بهینه‌سازی تامین‌کنندگان — SUP-PERF-003/004) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
