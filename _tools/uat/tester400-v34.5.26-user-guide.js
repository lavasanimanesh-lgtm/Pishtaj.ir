'use strict';
/* راهنمای درون‌برنامه‌ای باید ماژول‌های اصلی، مسیر تنظیمات و قرارداد نگهداشت را پوشش دهد. */
var fs = require('fs');
var path = require('path');
var assert = require('assert');
var root = path.resolve(__dirname, '../..');
function read(p) { return fs.readFileSync(path.join(root, p), 'utf8'); }
var guide = read('crm/user-guide.js');
var idx = read('crm/index.html');
var sw = read('crm/sw.js');
var maintenance = read('docs/CRM-USER-GUIDE-MAINTENANCE-FA.md');
[
  'داشبورد و روز من', 'کارتابل و اعلانات', 'مشتریان و مالک پورسانت', 'پیشنهاد فنی و مالی',
  'پرونده فروش و پس از برد', 'فاکتور و پرداخت تأمین‌کننده', 'تنخواه و هزینه مستقیم',
  'چک‌ها و دسته‌چک', 'خزانه و بانک', 'پورسانت فروش', 'سال مالی، تراز و کیفیت داده',
  'دستیار AI و خواندن فایل', 'مدیریت کاربران و دسترسی‌ها', 'ذخیره، Sync، بک‌آپ و بازیابی'
].forEach(function (title) { assert.ok(guide.indexOf(title) > -1, 'guide missing: ' + title); });
assert.ok(guide.indexOf('ptfUserGuideHtml') > -1 && guide.indexOf('hookSettings') > -1, 'guide must be injected in settings');
assert.ok(guide.indexOf('ptfGuideFilter') > -1 && guide.indexOf('ptfGuideGroup') > -1, 'guide must support search and grouping');
assert.ok(idx.indexOf('user-guide.js?v=') > -1 && sw.indexOf("'./user-guide.js'") > -1, 'guide must load and be PWA precached');
assert.ok(maintenance.indexOf('هر تغییر') > -1 && maintenance.indexOf('چک‌لیست Pull Request') > -1, 'maintenance contract missing');
console.log('PASS tester400 user-guide');
