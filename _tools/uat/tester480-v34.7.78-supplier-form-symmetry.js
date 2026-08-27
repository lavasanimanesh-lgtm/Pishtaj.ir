#!/usr/bin/env node
'use strict';
/* v34.8.21 — هم‌راستا‌سازی فیلدهای فرم ثبت‌نام تامین‌کننده + رفع پیشوند ZIP ضمایم.
   درخواست ۱: «دانلود همه (ZIP)» برای درخواست‌های دارای ضمیمه، «فایل ابری یافت نشد»
   می‌گفت — ریشه: فرم «ثبت درخواست جدید» فایل‌ها را با پیشوند rfq/ (نه rfqatt/) آپلود
   می‌کند و allowlist آن را نداشت.
   درخواست ۲: عدم تقارن فیلدهای فرم تامین‌کننده (سلکت خاکستریِ نیتیو در برابر ورودی
   سفید + ارتفاع ناهمگون + padding فایل ورودی). */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

var ver = JSON.parse(read('VERSION.json'));
var idx = read('crm/index.html');
var inq = read('crm/inqreader.js');
var zip = read('api/zip-attachments.php');
var sup = read('supplier/index.html');
var gate = read('_tools/uat/run-ci-gate.js');

T('VERSION.json = v34.8.21', ver.crm_version === 'v34.8.21', ver.crm_version);
T('inqreader.js cache-bust 34.8.21', /inqreader\.js\?v=34\.8\.21/.test(idx));

/* ① رفع پیشوند ZIP (rfq/) */
T('کلاینت پیشوند rfq/ را می‌پذیرد', inq.indexOf("key.indexOf('rfq/') !== 0") > -1);
T('سرور پیشوند rfq/ را می‌پذیرد', zip.indexOf("preg_match('#^(rfqatt|rfq|site-rfq)/#', $key)") > -1);

/* ② هم‌راستا‌سازی فرم تامین‌کننده */
T('سلکت هم‌قد ورودی (height:52px)', sup.indexOf('.sup-body .field > select { height: 52px; }') > -1 || /height:\s*52px/.test(sup));
T('سلکت بدون appearance نیتیو', sup.indexOf('appearance: none !important') > -1 && sup.indexOf('-webkit-appearance: none !important') > -1);
T('پس‌زمینهٔ سلکت سفید (رفع خاکستری global)', sup.indexOf('background: #fff !important') > -1);
T('سلکت فلش سفارشی دارد (background-image svg)', sup.indexOf('background-image: url("data:image/svg+xml') > -1);
T('padding فایل ورودی inline حذف شد', sup.indexOf('name="attachment" accept=".pdf,.doc,.docx,.xls,.xlsx,.zip,.rar" style="padding:10px;"') === -1);
T('استایل فایل ورودی (input[type=file]) تعریف شد', sup.indexOf('.sup-body .field > input[type="file"]') > -1);
T('گرید دوستونه align-items:start دارد', sup.indexOf('grid-template-columns: 1fr 1fr; gap: 16px; align-items: start;') > -1);
T('لیبل line-height همسان دارد', sup.indexOf('line-height: 1.7; margin-bottom: 8px;') > -1);

T('tester480 در گیت CI', gate.indexOf('tester480-v34.7.78-supplier-form-symmetry.js') > -1);

console.log('\n— tester480 (v34.8.21: هم‌راستا‌سازی فرم تامین‌کننده + پیشوند rfq/ در ZIP) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
