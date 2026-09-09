#!/usr/bin/env node
'use strict';
/* v34.38.0 — ادامه بهینه‌سازی تامین‌کنندگان:
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

T('VERSION.json = v34.38.14', ver.crm_version === 'v34.38.14', ver.crm_version);
T('supplier-finance.js cache-bust 34.38.14', /supplier-finance\.js\?v=34\.38\.14/.test(idx));

/* ---------- SUP-PERF-003: lazy box ---------- */
/* v34.38.0: slBoxRows پارامتر query گرفت (جست‌وجو) — همان تابع، قراردادِ گسترده‌تر */
T('slBoxRows هست (با پارامتر جست‌وجو)', /function slBoxRows\(query\)/.test(slf) && slf.indexOf("window._slBoxSearch") > -1);
T('ptfSlBoxLazy هست', /window\.ptfSlBoxLazy = function/.test(slf));
T('slBoxBody placeholder دارد', slf.indexOf('id="slBoxBody"') > -1);
/* v34.38.0 (SUP-BOX-COLLAPSED — تصمیم کارفرما): پنل پیش‌فرض بسته است، پس محاسبه
   به‌جای setTimeoutِ بی‌قید (که حتی وقتی کسی کاری با جعبه نداشت اجرا می‌شد) به
   نخستین open گره خورد؛ مکانیزمِ تلاشِ مجددِ پیدا کردنِ body دست‌نخورده ماند. */
T('box() محاسبه را به نخستین بازکردن می‌سپارد (نه setTimeoutِ بی‌قید)', slf.indexOf('setTimeout(function () { if (typeof window.ptfSlBoxLazy') > -1 && slf.indexOf("if (det && !det.open && force !== true) { window._slBoxLazyPending = true; return; }") > -1 && slf.indexOf('window.ptfSlBoxToggle = function (el) { if (el && el.open) window.ptfSlBoxLazy(true); };') > -1);
/* v34.38.0: «باز بودن پیش‌فرض» خودش خواستهٔ اصلاح‌شدهٔ کارفرما بود ⇒ pin وارونه شد:
   details/summary سرِ جایش است ولی بدونِ open، و کادر جست‌وجو اضافه شده است. */
T('slBox تاشو و پیش‌فرض بسته + جستجو دارد', /<details id="slBox"(?! open)/.test(slf) && slf.indexOf('<details id="slBox" open') === -1 && /<summary/.test(slf) && slf.indexOf('id="slBoxQ"') > -1 && slf.indexOf('window.slBoxSearch = function (v)') > -1);
T('slBoxRows از balanceHtmlFrom بدون تکرار استفاده می‌کند', slf.indexOf('balanceHtmlFrom(b, s.cd)') > -1);

/* ---------- SUP-PERF-004: get_inbox pagination ---------- */
T('get_inbox limit پشتیبانی می‌کند', api.indexOf('$limit = (int)($_REQUEST[\'limit\'] ?? 0)') > -1);
T('get_inbox offset پشتیبانی می‌کند', api.indexOf('$offset = max(0, (int)($_REQUEST[\'offset\'] ?? 0))') > -1);
T('بدون limit پیش‌فرض همه برمی‌گردد', api.indexOf("'limit' => $limit > 0 ? $limit : $supTotal") > -1);
T('پاسخ total دارد', api.indexOf("'supTotal' => $supTotal") > -1 && api.indexOf("'rfqTotal' => $rfqTotal") > -1);
T('fresh/gzip قبلی حفظ شده', api.indexOf("'fresh' => true") > -1 && api.indexOf('ptf_echo_json') > -1);

T('tester487 در گیت CI', gate.indexOf('tester487-v34.7.91-supplier-perf-followups.js') > -1);

console.log('\n— tester487 (v34.38.0: ادامه بهینه‌سازی تامین‌کنندگان — SUP-PERF-003/004) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
