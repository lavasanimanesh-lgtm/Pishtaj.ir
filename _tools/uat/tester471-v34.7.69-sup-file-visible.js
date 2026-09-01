#!/usr/bin/env node
'use strict';
/* v34.22.0 — نمایش فایل پیوست تامین‌کننده در فهرست تاییدشده و کارت مشاهده.
   ریشهٔ باگ: supApprove فایل را به files.oth می‌برد ولی renderSuppliers2 و showEntityCard
   هیچ‌جا فایل را نمایش نمی‌دادند. */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

var ver = JSON.parse(read('VERSION.json'));
var offers = read('crm/offers.js');
var bridge = read('crm/bridge.js');
var idx = read('crm/index.html');
var gate = read('_tools/uat/run-ci-gate.js');

T('VERSION.json = v34.22.0', ver.crm_version === 'v34.22.0', ver.crm_version);
T('offers.js cache-bust 34.22.0', /offers\.js\?v=34\.22.0/.test(idx));

/* helper استخراج فایل */
T('ptfEntityFiles تعریف شده', offers.indexOf('function ptfEntityFiles(c)') > -1);
T('ptfEntityFiles ساختار {cat:[...]} را می‌خواند', offers.indexOf('Object.keys(files).forEach') > -1);
T('ptfSupFilesOpen تعریف شده', offers.indexOf('window.ptfSupFilesOpen = function') > -1);

/* فهرست تاییدشده */
T('دکمهٔ 📎 در ردیف فهرست', offers.indexOf("title=\"فایل‌های پیوست (' + nFiles + ')\"") > -1);
T('فقط وقتی فایل دارد دکمه ساخته می‌شود', offers.indexOf('var fileBtn = nFiles') > -1);
T('دکمه به ptfSupFilesOpen وصل است', offers.indexOf('ptfSupFilesOpen(') > -1);

/* کارت مشاهده */
T('کارت مشاهده فایل‌ها را نشان می‌دهد', offers.indexOf('var filesBox = entFiles.length') > -1);
T('بخش «فایل‌های پیوست» در کارت', offers.indexOf('📎 فایل‌های پیوست') > -1);
T('بازکردن با openStoredFile', offers.indexOf("onclick=\"openStoredFile(") > -1);

/* ریشهٔ داده (supApprove) */
T('supApprove فایل را به files.oth منتقل می‌کند', bridge.indexOf("importedFiles.oth = [{ key: siteAtt.key") > -1);

T('tester471 در گیت CI', gate.indexOf('tester471-v34.7.69-sup-file-visible.js') > -1);

console.log('\n— tester471 (v34.22.0: نمایش فایل تامین‌کننده در فهرست/کارت) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
