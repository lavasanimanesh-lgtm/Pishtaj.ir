/* tester327 — چاپ چک: بدون هشدار روی برگه و با preflight رسانه واقعی */
'use strict';
require('./harness');
var fs=require('fs'),path=require('path');
var BASE=path.resolve(__dirname,'../../crm');
var prt=fs.readFileSync(path.join(BASE,'cheque-print.js'),'utf8');
SECTION('رسانه و چاپ');
T('هشدار سیاه noprint از HTML چاپ حذف شده است', prt.indexOf('class="noprint"')===-1);
T('پیش از چاپ فیزیکی، preflight اندازه برگه و تنظیمات واقعی نشان می‌دهد', prt.indexOf('chqPrintPreflight')>-1 && prt.indexOf('Actual Size / 100%')>-1 && prt.indexOf('Fit to Page = Off')>-1);
T('پیش‌شرط صریح چاپگر با کاغذ Custom کوچک دارد', prt.indexOf('Custom Paper')>-1 && prt.indexOf('اگر چاپگر روی A4 باشد')>-1);
T('انتخاب سریع اندازه پیش‌فرض چک و A4 آزمایشی وجود دارد', prt.indexOf('chqPaperPreset')>-1 && prt.indexOf('پیش‌فرض چک 169×78')>-1 && prt.indexOf('A4 فقط برای آزمون')>-1);
T('A4 فقط برای آزمون است و در چاپ واقعی راهنمای مجزا دارد', prt.indexOf('A4 فقط برای چاپ آزمایشی')>-1);
DONE('tester327-v34.4.26-cheque-media-preflight');
