#!/usr/bin/env node
'use strict';
/* v34.29.4 — فشرده‌سازی WebP با fallback JPEG + گزارش فقط‌خواندنی کلید ابری */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

var ver = JSON.parse(read('VERSION.json'));
var st = read('crm/storage.js');
var idx = read('crm/index.html');
var sw = read('crm/sw.js');
var gate = read('_tools/uat/run-ci-gate.js');
var surplus = read('crm/surplus.js');
var php = read('api/storage.php');

T('VERSION.json = v34.29.4', ver.crm_version === 'v34.29.4', ver.crm_version);
T('index PTF_CRM_RELEASE = v34.29.4', /window\.PTF_CRM_RELEASE = 'v34\.29.4'/.test(idx));
T('sw RELEASE = v34.29.4', sw.indexOf("RELEASE = 'v34.29.4'") > -1);
T('storage.js cache-bust 34.29.4', /storage\.js\?v=34\.29.4/.test(idx));

T('compressImage WebP سپس JPEG می‌سازد', st.indexOf("cv.toBlob(function (webp)") > -1 && st.indexOf("'image/jpeg', 0.82") > -1 && st.indexOf('function pickBest') > -1);
T('کوچک‌ترین خروجی انتخاب می‌شود', st.indexOf('opts.sort(function (a, b) { return a.size - b.size; })') > -1);
T('savedNote فرمت را نشان می‌دهد', st.indexOf('compInfo.format') > -1);

T('گزارش کلید فقط‌خواندنی است', st.indexOf('function ptfCloudKeyAudit') > -1 && st.indexOf('ptfHarvestFileKeys') > -1 && st.indexOf('ptfClassifyCloudKeys') > -1);
T('گزارش DELETE نمی‌زند', /ptfCloudKeyAudit[\s\S]{0,2500}delete_batch/.test(st) === false);
T('طبقه‌بندی A/B/C/E', st.indexOf("cls: 'A'") > -1 && st.indexOf("cls: 'B'") > -1 && st.indexOf("cls: 'C'") > -1 && st.indexOf("cls: 'E'") > -1);
T('CSV خروجی دارد', st.indexOf('ptfDownloadKeyAuditCsv') > -1 && st.indexOf('ptf-cloud-key-audit.csv') > -1);
T('دکمه گزارش در دیالوگ ابر', st.indexOf('گزارش کلیدهای ابری (بدون حذف)') > -1);
T('نقش ارشد برای گزارش', st.indexOf("['admin', 'chairman', 'ceo'].indexOf(role) < 0") > -1);

T('file_not_found همچنان تشخیص داده می‌شود', st.indexOf("d.error === 'file_not_found'") > -1);
T('پیام کلید قدیمی/مهاجرت‌نشده مانده', st.indexOf('کلید قدیمی/مهاجرت‌نشده') > -1 && st.indexOf('دوباره آپلود کنید') > -1);
T('presign_get فقط 404 را file_not_found می‌داند', php.indexOf("$code === 404") > -1 && php.indexOf("$code === 404 || $code === 403") === -1);

T('tester455 در گیت CI', gate.indexOf('tester455-v34.7.52-cloud-key-audit-webp.js') > -1);
T('surplus بدون setInterval (tester171)', surplus.indexOf('setInterval') === -1 && surplus.indexOf('function hookOfferNew') > -1);

console.log('\n— tester455 (v34.29.4: گزارش کلید ابری + فشرده‌سازی WebP/JPEG) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
