#!/usr/bin/env node
'use strict';
/* v34.21.0 — صفحه‌بندی فهرست تامین‌کنندگان تاییدشده (SUP-PERF-002).
   بدون تغییر داده/منطق؛ فقط ۵۰ ردیف اول + دکمهٔ «نمایش بیشتر» در renderSuppliers2. */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

var ver = JSON.parse(read('VERSION.json'));
var idx = read('crm/index.html');
var off = read('crm/offers.js');
var gate = read('_tools/uat/run-ci-gate.js');

T('VERSION.json = v34.21.0', ver.crm_version === 'v34.21.0', ver.crm_version);
T('index PTF_CRM_RELEASE = v34.21.0', /window\.PTF_CRM_RELEASE = 'v34\.21.0'/.test(idx));
T('offers.js cache-bust 34.21.0', /offers\.js\?v=34\.21.0/.test(idx));

T('renderSuppliers2 صفحه‌بندی ۵۰تایی دارد', /var per = 50;/.test(off));
T('renderSuppliers2 فقط صفحهٔ فعلی را می‌سازد', off.indexOf('var shown = list.slice(0, (page + 1) * per);') > -1 && off.indexOf('shown.forEach(function(c) {') > -1);
T('دکمهٔ «نمایش بیشتر»', off.indexOf('window.ptfSupApprovedMore = function') > -1 && off.indexOf('⬇ نمایش ') > -1);
T('جستجو صفحه را ریست می‌کند', off.indexOf('window._supApprovedSearchQ') > -1 && off.indexOf('window._supApprovedPage = 0') > -1);
T('شمارندهٔ dSup همچنان تعداد کل است', off.indexOf("document.getElementById('dSup')") > -1 && /textContent = items\.length/.test(off));
T('renderSuppliers = renderSuppliers2 حفظ شده', off.indexOf('renderSuppliers = renderSuppliers2;') > -1);

T('tester485 در گیت CI', gate.indexOf('tester485-v34.7.91-supplier-pagination.js') > -1);

console.log('\n— tester485 (v34.21.0: صفحه‌بندی تامین‌کنندگان تاییدشده — SUP-PERF-002) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
