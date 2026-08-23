#!/usr/bin/env node
'use strict';
/* v34.7.97 — دانلود گروهی ضمایم درخواست (ZIP).
   درخواست: برخی درخواست‌ها ضمایم زیادی دارند و دانلود تکتک زمان‌بر است؛ باید
   امکان دانلود فایل ZIP همهٔ ضمایم فراهم باشد.
   پیاده‌سازی: endpoint سروری zip-attachments.php (احراز + allowlist کلید rfqatt|site-rfq)
   + دکمهٔ «⬇️ دانلود همه (ZIP)» در مودال مدیریت پیوست درخواست. */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

var ver = JSON.parse(read('VERSION.json'));
var idx = read('crm/index.html');
var inq = read('crm/inqreader.js');
var zip = read('api/zip-attachments.php');
var ht = read('api/.htaccess');
var gate = read('_tools/uat/run-ci-gate.js');

T('VERSION.json = v34.7.97', ver.crm_version === 'v34.7.97', ver.crm_version);
T('inqreader.js cache-bust 34.7.97', /inqreader\.js\?v=34\.7\.97/.test(idx));

/* ① کلاینت */
T('ptfRfqZipEntries تعریف شد', /window\.ptfRfqZipEntries = function \(r\)\s*\{/.test(inq));
T('فیلتر پیشوند rfqatt/rfq/site-rfq در کلاینت', inq.indexOf("key.indexOf('rfqatt/') !== 0 && key.indexOf('rfq/') !== 0 && key.indexOf('site-rfq/') !== 0") > -1);
T('ptfDownloadRfqZip تعریف شد', /window\.ptfDownloadRfqZip = function \(cd\)\s*\{/.test(inq));
T('فراخوانی endpoint zip-attachments.php', inq.indexOf("fetch('../api/zip-attachments.php'") > -1);
T('ارسال هدر احراز (irAuthHeaders)', inq.indexOf('headers: irAuthHeaders(true)') > -1);
T('ارسال فهرست files و base', inq.indexOf('JSON.stringify({ files: files, base:') > -1);
T('دانلود به‌صورت blob + نام فایل', inq.indexOf('a.download = \'RFQ-\' + cd + \'-ضمائم.zip\'') > -1);
T('دکمهٔ «⬇️ دانلود همه (ZIP)» در مودال', inq.indexOf('⬇️ دانلود همه (ZIP)') > -1 && inq.indexOf('onclick="ptfDownloadRfqZip(') > -1);

/* ② سرور */
T('endpoint احراز توکن دارد', zip.indexOf('auth_verify_token(auth_get_header_token())') > -1);
T('role whitelist دارد', zip.indexOf("['admin', 'chairman', 'ceo', 'commercial', 'sales', 'buyer', 'accountant', 'collector']") > -1);
T('بررسی منشأ (Cross-origin blocked)', zip.indexOf('Cross-origin blocked') > -1);
T('فقط POST مجاز', zip.indexOf('REQUEST_METHOD') > -1 && zip.indexOf('method_not_allowed') > -1);
T('allowlist پیشوند rfqatt|rfq|site-rfq', zip.indexOf("preg_match('#^(rfqatt|rfq|site-rfq)/#', $key)") > -1);
T('گارد مسیر پیمایش (..)', zip.indexOf("strpos($key, '..') !== false") > -1);
T('سقف تعداد فایل (60)', zip.indexOf('too many files (max 60)') > -1);
T('سقف حجم مجموع (200MB)', zip.indexOf('200 * 1048576') > -1);
T('ساخت ZIP با ZipArchive', zip.indexOf("new ZipArchive()") > -1);
T('فال‌بک بدون ZipArchive (STORE)', zip.indexOf('function zstore_zip(') > -1);
T('خروجی Content-Type: application/zip', zip.indexOf("'Content-Type: application/zip'") > -1);
T('پیام خطای «هیچ فایل قابل دانلودی»', zip.indexOf('هیچ فایل قابل دانلودی یافت نشد') > -1);

/* ③ allowlist در api/.htaccess */
T('zip-attachments در allowlist api/.htaccess', ht.indexOf('zip-attachments') > -1);

T('tester479 در گیت CI', gate.indexOf('tester479-v34.7.77-rfq-zip-download.js') > -1);

console.log('\n— tester479 (v34.7.97: دانلود گروهی ضمایم درخواست به ZIP) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
