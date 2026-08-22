#!/usr/bin/env node
'use strict';
/* v34.7.101 — ادغام دو آیکون ضمیمه در ردیف درخواست‌ها.
   هر ردیف درخواست دو آیکون پیوست داشت: بج «📎 N ضمیمه» (bridge.js) + دکمهٔ تکراری
   «📎 مدیریت پیوست‌ها/پیوست‌ها» (inqreader.js). ادغام: بج همیشه کلیک‌پذیر (با شمارش)
   و دکمهٔ تکراری حذف شد. */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

var ver = JSON.parse(read('VERSION.json'));
var bridge = read('crm/bridge.js');
var inq = read('crm/inqreader.js');
var idx = read('crm/index.html');
var gate = read('_tools/uat/run-ci-gate.js');

T('VERSION.json = v34.7.101', ver.crm_version === 'v34.7.101', ver.crm_version);
T('bridge.js cache-bust 34.7.101', /bridge\.js\?v=34\.7\.101/.test(idx));
T('inqreader.js cache-bust 34.7.101', /inqreader\.js\?v=34\.7\.101/.test(idx));

/* بج ضمیمه: همیشه کلیک‌پذیر */
T('بج با ضمیمه کلیک‌پذیر است', bridge.indexOf("' <span class=\"bd rfq-attachment-badge has-files\" role=\"button\"") > -1);
T('بج بدون ضمیمه هم کلیک‌پذیر شد (role=button)', bridge.indexOf('rfq-attachment-badge no-files" role="button" tabindex="0"') > -1);
T('بج بدون ضمیمه همان مدیریت ضمایم را باز می‌کند', bridge.indexOf("no-files\" role=\"button\"") > -1 && /no-files[\s\S]{0,300}?ptfManageInqAttachments/.test(bridge));

/* دکمهٔ تکراری حذف شد */
T('دکمهٔ تکراری «مدیریت پیوست‌ها» در ردیف حذف شد', inq.indexOf("ptfRfqActionBtn('📎 مدیریت پیوست‌ها'") === -1);
T('دکمهٔ تکراری «پیوست‌ها» در ردیف حذف شد', inq.indexOf("ptfRfqActionBtn('📎 پیوست‌ها'") === -1);
T('تابع مدیریت ضمایم حفظ شد', inq.indexOf('window.ptfManageInqAttachments = function') > -1);

T('tester466 در گیت CI', gate.indexOf('tester466-v34.7.64-attachment-pin-merge.js') > -1);

console.log('\n— tester466 (v34.7.101: ادغام آیکون ضمیمه ردیف درخواست) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
