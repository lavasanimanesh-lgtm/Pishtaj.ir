#!/usr/bin/env node
'use strict';
/* وضعیت پیوست رزومه: انتخاب فایل، در حال بارگذاری، موفقیت */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

var apply = read('assets/js/ptf-careers-apply.js');
var php = read('api/careers.php');
var surplus = read('crm/surplus.js');
var gate = read('_tools/uat/run-ci-gate.js');

T('سقف PDF ۵ مگابایت مانده', apply.indexOf('5 * 1048576') > -1 && php.indexOf('5 * 1048576') > -1);
T('کادر وضعیت jobResumeBox', apply.indexOf('jobResumeBox') > -1 && php.indexOf('jobResumeBox') > -1);
T('پس از انتخاب: رزومه پیوست شد', apply.indexOf('رزومه پیوست شد') > -1);
T('هنگام ارسال: در حال بارگذاری رزومه', apply.indexOf('در حال بارگذاری رزومه') > -1 && apply.indexOf('xhr.upload.onprogress') > -1);
T('پس از موفقیت: رزومه با موفقیت پیوست شد', apply.indexOf('رزومه با موفقیت پیوست شد') > -1 && php.indexOf('رزومه با موفقیت پیوست شد') > -1);
T('cache-bust اسکریپت فرم', php.indexOf('ptf-careers-apply.js?v=') > -1);
T('tester454 در گیت CI', gate.indexOf('tester454-v34.7.51-careers-resume-attach-status.js') > -1);
T('surplus بدون setInterval (tester171)', surplus.indexOf('setInterval') === -1 && surplus.indexOf('function hookOfferNew') > -1);

console.log('\n— tester454 (وضعیت پیوست رزومه) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
