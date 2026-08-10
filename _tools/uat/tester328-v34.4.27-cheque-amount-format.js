/* tester328 — فرمت مبالغ روی چک فیزیکی */
'use strict';
require('./harness');
var fs=require('fs'),path=require('path');
var BASE=path.resolve(__dirname,'../../crm');
var prt=fs.readFileSync(path.join(BASE,'cheque-print.js'),'utf8');
SECTION('فرمت مبلغ');
T('مبلغ قرمز با عدد انگلیسی، IRR و محافظ # ساخته می‌شود', prt.indexOf("'# ' + moneyEn(c.amt) + ' IRR #'")>-1 && prt.indexOf('direction:ltr;text-align:left')>-1);
T('مبلغ دوم با ارقام فارسی و محافظ # بدون ریال چاپ می‌شود', prt.indexOf("'# ' + money(c.amt) + ' #'")>-1);
T('مبلغ به حروف با واحد ریال و محافظ # چاپ می‌کند', prt.indexOf('amountWordsWithUnit')>-1 && prt.indexOf("'# ' + amountWordsWithUnit(c.amt) + ' #'")>-1);
T('نمونه گرافیکی با فرمت جدید هماهنگ است', prt.indexOf("'# 1,250,000 IRR #'")>-1 && prt.indexOf("'# ۱٬۲۵۰٬۰۰۰ #'")>-1);
DONE('tester328-v34.4.27-cheque-amount-format');
