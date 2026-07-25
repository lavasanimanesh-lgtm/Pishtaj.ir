/* Release 2 — remove operational random-ID fallbacks from AI Workbench/storage */
'use strict';
require('./harness');
var fs=require('fs'),path=require('path');
var ROOT=path.resolve(__dirname,'../..');
var ai=fs.readFileSync(path.join(ROOT,'crm/ai-workbench.js'),'utf8');
var st=fs.readFileSync(path.join(ROOT,'crm/storage.js'),'utf8');
var idx=fs.readFileSync(path.join(ROOT,'crm/index.html'),'utf8');
SECTION('کدگذاری یکپارچه');
T('AI Workbench در مسیرهای ساخت رکورد genCode واحد را صدا می‌زند', ai.indexOf("var itemCode = genCode('IQI')")>-1 && ai.indexOf("var newC={ cd:genCode('CUST')")>-1 && ai.indexOf('var rCd=genCode(\'RFQ\')')>-1);
T('AI اقلام و RFQS بدون fallback random هستند', ai.indexOf("cd:genCode('IQI')")>-1 && ai.indexOf("sqNo=genCode('RFQS')")>-1);
T('پیشنهاد AI از offerSerial/genCode مرکزی استفاده می‌کند', ai.indexOf("typeof offerSerial === 'function' ? offerSerial(qKind) : genCode(qKind)")>-1);
T('شماره نامه AI از letSerial/genCode مرکزی استفاده می‌کند', ai.indexOf("typeof letSerial === 'function' ? letSerial('OUT', 'en') : genCode('L')")>-1);
T('fallback random عملیاتی از AI Workbench حذف شده', ai.indexOf('Math.random')===-1);
T('شناسه ویجت upload در storage تصادفی نیست', st.indexOf('window._ptfUploadSeq')>-1 && st.indexOf('Math.random')===-1);
T('runtime مرکزی codegen پیش از AI بارگذاری می‌شود', idx.indexOf('codegen.js?v=')<idx.indexOf('ai-workbench.js?v=') && idx.indexOf('offers.js?v=')<idx.indexOf('storage.js?v='));
DONE('tester177-v322-codegen-fallbacks');
