/* tester316 — BUG-OPEX-ATTACH-001: ضمیمه اسناد هزینه‌های جاری */
'use strict';
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var ox = fs.readFileSync(path.join(BASE, 'opex.js'), 'utf-8');
var ui = fs.readFileSync(path.join(BASE, 'ui-kit.js'), 'utf-8');

SECTION('ساختار ضمیمهٔ هزینه جاری');
T('فرم ثبت هزینه، field آپلود سند با پوشه اختصاصی opex دارد', ox.indexOf("id: 'files', label: 'پیوست اسناد") > -1 && ox.indexOf("uploadFolder: 'opex/' + draftCd") > -1);
T('رکورد OPEX فایل‌ها را همراه خود ذخیره می‌کند', ox.indexOf("files: (v.files || []).slice()") > -1);
T('فرم ویرایش هم ضمیمهٔ جدید می‌پذیرد و به فایل‌های قبلی اضافه می‌کند', ox.indexOf("id: 'files', label: 'افزودن پیوست جدید") > -1 && ox.indexOf("rec.files = (rec.files || []).concat(v.files)") > -1);
T('دکمهٔ سند برای افزودن مدرک در هر ردیف وجود دارد', ox.indexOf("opexAction('attach', '📎', 'سند'") > -1 && ox.indexOf('window.ptfOpexAttachOpen = function') > -1);
T('لینک مشاهده و حذف پیوست روی ردیف هزینه رندر می‌شود', ox.indexOf('openStoredFile') > -1 && ox.indexOf('ptfOpexRemoveFile') > -1);

SECTION('یکپارچگی پرونده فروش');
T('پیوست هزینهٔ لینک‌شده به پرونده در costEvent هم کپی می‌شود', ox.indexOf('files: (rec.files || []).slice(), fromOpex: true') > -1 && ox.indexOf('function opexSyncDealFiles(rec)') > -1);
T('حذف پیوست، دادهٔ OPEX و پروندهٔ لینک‌شده را همگام می‌کند', ox.indexOf("rec.files = (rec.files || []).filter") > -1 && ox.indexOf('opexSyncDealFiles(rec)') > -1);

SECTION('زیرساخت');
T('ptfDialog از field upload و attachUploadWidget پشتیبانی می‌کند', ui.indexOf("f.upload || f.type === 'upload'") > -1 && ui.indexOf('attachUploadWidget') > -1);

DONE('tester316-v34.4.12-opex-attachments');
