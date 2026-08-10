/* tester324 — چاپ مستقیم چک: جداسازی از preview عمومی A4 */
'use strict';
require('./harness');
var fs=require('fs'),path=require('path');
var BASE=path.resolve(__dirname,'../../crm');
var prt=fs.readFileSync(path.join(BASE,'cheque-print.js'),'utf8');
var op=fs.readFileSync(path.join(BASE,'offers-pro.js'),'utf8');
SECTION('مسیر چاپ اختصاصی');
T('چاپ کاغذ واقعی مسیر مستقیم دارد', prt.indexOf('function chqOpenDirectPrint')>-1 && prt.indexOf("if (mode === 'paper')")>-1);
T('کاغذ واقعی دیگر preview عمومی را صدا نمی‌زند', /if \(mode === 'paper'\)[\s\S]{0,350}chqOpenDirectPrint/.test(prt));
T('preview فقط برای پیش‌نمایش/کالیبراسیون استفاده می‌شود', prt.indexOf("'پیش‌نمایش/کالیبراسیون چک فیزیکی'")>-1);
T('HTML چاپی اندازه واقعی چک و حاشیه صفر دارد', prt.indexOf("'@page{size:' + L.pageW + 'mm ' + L.pageH + 'mm;margin:0}'")>-1);
T('راهنمای اختصاصی Actual Size و عدم Fit to Page دارد', prt.indexOf('Actual Size')>-1 && prt.indexOf('Fit to Page = Off')>-1);
T('مسیر مستقیم صریحاً از preview عمومی A4 دوری می‌کند', prt.indexOf('نباید از preview عمومی A4 عبور کند')>-1 && prt.indexOf('chqOpenDirectPrint(html, list.length)')>-1);
DONE('tester324-v34.4.23-cheque-direct-print');
