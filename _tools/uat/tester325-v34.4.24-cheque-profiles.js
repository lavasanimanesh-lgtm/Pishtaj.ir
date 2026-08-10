/* tester325 — پروفایل بانک/چاپگر و کالیبراسیون چاپ چک */
'use strict';
require('./harness');
var fs=require('fs'),path=require('path');
var BASE=path.resolve(__dirname,'../../crm');
var prt=fs.readFileSync(path.join(BASE,'cheque-print.js'),'utf8');
SECTION('پروفایل چاپ');
T('کلیدهای جدا برای پروفایل و پروفایل فعال وجود دارد', prt.indexOf("PK = 'ptf_chqprint_profiles_v1'")>-1 && prt.indexOf("AK = 'ptf_chqprint_active_profile_v1'")>-1);
T('مهاجرت از layout قدیمی و نگهداری layout هر پروفایل وجود دارد', prt.indexOf('مهاجرت بی‌خطر از چیدمان تک‌پروفایلی')>-1 && prt.indexOf('x.layout = L')>-1);
T('مدیریت پروفایل‌ها: انتخاب، ساخت و حذف وجود دارد', ['chqProfileOpen','chqProfileSelect','chqProfileNew','chqProfileDelete'].every(function(x){return prt.indexOf('window.'+x)>-1;}));
T('نام بانک و چاپگر در metadata پروفایل ثبت می‌شود', prt.indexOf('bank:')>-1 && prt.indexOf('printer:')>-1);
T('ثبت تایید کالیبراسیون وجود دارد', prt.indexOf('chqProfileMarkCalibrated')>-1 && prt.indexOf('calibratedAt')>-1);
T('پروفایل فعال در UI چاپ نمایش داده می‌شود', prt.indexOf('پروفایل فعال:')>-1 && prt.indexOf('🗂 پروفایل‌ها')>-1);
DONE('tester325-v34.4.24-cheque-profiles');
