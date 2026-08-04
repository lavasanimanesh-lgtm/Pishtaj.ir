/* tester314 — v34.0.18-alpha (فاز ۱۵: رفع NoSuchKey در فایل‌های ضمیمه)
   پوشش: presign_get وجود فایل را با HEAD بررسی می‌کند؛ کلیدهای قدیمی/نامعتبر
   خطای file_not_found می‌گیرند؛ openStoredFile پیام معنادار نمایش می‌دهد. */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var API = path.resolve(__dirname, '../../api');
var vjson = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../VERSION.json'), 'utf-8'));

SECTION('نسخه');
T('lockstep نسخهٔ جاری', /^v[0-9.]+-alpha$/.test(vjson.crm_version));

SECTION('سرور: presign_get با HEAD بررسی وجود فایل');
var storage = fs.readFileSync(path.join(API, 'storage.php'), 'utf-8');
T('presign_get با s3_request HEAD بررسی می‌کند', storage.indexOf("s3_request($cfg, 'HEAD', $uri)") > -1);
T('فقط 404 قطعی → file_not_found (403 رد نمی‌شود — فایل موجود)', storage.indexOf("'file_not_found'") > -1 && storage.indexOf("$code === 404") > -1 && storage.indexOf("$code === 404 || $code === 403") === -1);
T('s3_request HEAD پشتیبانی می‌کند (CURLOPT_NOBODY)', storage.indexOf("CURLOPT_NOBODY") > -1 && storage.indexOf("strtoupper($method) === 'HEAD'") > -1);

SECTION('کلاینت: openStoredFile پیام معنادار');
var st = fs.readFileSync(path.join(BASE, 'storage.js'), 'utf-8');
T('openStoredFile file_not_found را تشخیص می‌دهد', st.indexOf("d.error === 'file_not_found'") > -1);
T('پیام «کلید قدیمی/مهاجرت‌نشده — دوباره آپلود کنید» هست', st.indexOf('کلید قدیمی/مهاجرت‌نشده') > -1 && st.indexOf('دوباره آپلود کنید') > -1);

DONE('tester314-v34.0.18-alpha');
