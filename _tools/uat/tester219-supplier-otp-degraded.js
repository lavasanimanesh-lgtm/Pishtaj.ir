/* tester219 — v31.7.42 (BUG-SUP-OTP-001)
 * Supplier OTP must not dead-end when SMS provider is configured but actual send fails.
 */
require('./harness');
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var api = fs.readFileSync(path.join(ROOT, 'api/crm.php'), 'utf-8');
var guard = fs.readFileSync(path.join(ROOT, 'assets/js/ptf-guard.js'), 'utf-8');
var supplier = fs.readFileSync(path.join(ROOT, 'supplier/index.html'), 'utf-8');

SECTION('Server degraded OTP fallback');
T('BUG-SUP-OTP-001 در api ثبت شده است', api.indexOf('BUG-SUP-OTP-001') > -1);
T('otp_send در صورت sms_send failure توکن degraded امضاشده می‌دهد', api.indexOf("'degraded' => true") > -1 && api.indexOf("'otp_token' => otp_token_make($phone)") > -1);
T('پیام degraded به بررسی تلفنی بازرگانی اشاره دارد', api.indexOf('شماره تلفن توسط تیم بازرگانی بررسی') > -1);
T('add_supplier همچنان وقتی sms_enabled است توکن OTP معتبر می‌خواهد', api.indexOf("case 'add_supplier'") > -1 && api.indexOf('otp_token_ok($otok, $sup_phone)') > -1);

SECTION('Client degraded OTP handling');
T('ptf-guard degraded را verified می‌کند و token را نگه می‌دارد', guard.indexOf('d.ok && d.degraded && d.otp_token') > -1 && guard.indexOf('otp.verified = true') > -1 && guard.indexOf('otp.token = d.otp_token') > -1);
T('در حالت degraded فرم بن‌بست نمی‌شود و پیام بررسی تلفنی نشان می‌دهد', guard.indexOf('ثبت‌نام با بررسی تلفنی ادامه می‌یابد') > -1 || guard.indexOf('ثبت‌نام با تایید کپچا ادامه می‌یابد') > -1);
T('توکن degraded در submit تامین‌کننده ارسال می‌شود', supplier.indexOf("fd.append('otp_token', ptfOtpToken())") > -1);

SECTION('Supplier UX mobile requirement');
T('فیلد تامین‌کننده صریحاً موبایل 09 برای تایید پیامکی می‌خواهد', supplier.indexOf('شماره موبایل واتساپ برای تایید پیامکی') > -1 && supplier.indexOf('09xxxxxxxxx') > -1);
T('راهنمای شماره ثابت در توضیحات وجود دارد', supplier.indexOf('تلفن ثابت را در توضیحات بنویسید') > -1);

DONE('tester219-supplier-otp-degraded');
