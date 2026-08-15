#!/usr/bin/env node
'use strict';
/* v34.7.1 — تامین جدید سریع + ورود/ویرایش اقلام از درخواست، Excel، AI و پرامپت */
var fs=require('fs'),path=require('path'),vm=require('vm');
var ROOT=path.resolve(__dirname,'../..');
var rf=fs.readFileSync(path.join(ROOT,'crm/rfqsmart.js'),'utf8');
var iq=fs.readFileSync(path.join(ROOT,'crm/inqreader.js'),'utf8');
var idx=fs.readFileSync(path.join(ROOT,'crm/index.html'),'utf8');
var guide=fs.readFileSync(path.join(ROOT,'crm/user-guide.js'),'utf8');
var p=0,f=0;
function T(n,c,d){if(c){p++;console.log('PASS',n);}else{f++;console.error('FAIL',n,d||'');}}

var newStart=rf.indexOf('window.rfqsNew = function');
var newEnd=rf.indexOf('/* v21.9 US-454:',newStart);
var newBody=rf.slice(newStart,newEnd);
T('تامین جدید بلافاصله shell/loading modal را قبل از کار سنگین می‌سازد',newBody.indexOf("id=\"rqsNewModal\"")>-1&&newBody.indexOf('insertAdjacentHTML')<newBody.indexOf('setTimeout(function'));
T('دابل‌کلیک تامین جدید با token، timer قبلی را بی‌اثر می‌کند',/data-rqs-open/.test(newBody)&&/getAttribute\('data-rqs-open'\) !== openToken/.test(newBody));
T('N+1 شمارش تامین قبلی حذف و دیتاست‌ها یک‌بار cache می‌شوند',/var smartList = getData\('ptf_crm_rfqsmart'\)/.test(newBody)&&/existingByAlias/.test(newBody)&&newBody.indexOf('window.ptfRfqsExistingForSource(')<0);
T('گام ورود تامین چهار مسیر درخواست، Excel، AI و پرامپت دارد',/وارد کردن اقلام درخواست/.test(newBody)&&/ورود فایل Excel \/ CSV با راهنما/.test(newBody)&&/خواندن فایل با هوش مصنوعی/.test(newBody)&&/راهنما و پرامپت آماده AI/.test(newBody));
T('اقلام embedded خود RFQ نیز در فهرست منبع دیده می‌شوند',/Array\.isArray\(r\.items\)/.test(newBody)&&/inqNos\[r\.cd\] = r\.items\.length/.test(newBody));
T('صفحه بازبینی افزودن Excel و AI و ردیف جدید دارد',/rfqsImportMoreFile/.test(rf)&&/rqsMoreAi/.test(rf)&&/افزودن ردیف جدید/.test(rf));
T('هر ردیف برچسب برند/مدل و عملیات کپی/حذف دارد',/برند<\/th>/.test(rf)&&/مدل \/ پارت‌نامبر/.test(rf)&&/rfqsDuplicateRow/.test(rf)&&/🗑 حذف/.test(rf));
T('ویرایش رکورد موجود target history را حفظ و نسخه ارسال‌شده را نیازمند ارسال مجدد می‌کند',/window\.rfqsEditItems/.test(rf)&&/_originalTargets/.test(rf)&&/oldTarget\.co = r\.co/.test(rf)&&/needsResend = true/.test(rf)&&/itemsChangedAfterSend = true/.test(rf));
T('فایل خوانده‌شده AI مستقل از نتیجه استخراج به‌عنوان مرجع حفظ می‌شود',/uploadFile\(f, 'rfqsmart'/.test(rf)&&/hit\.attachments/.test(rf)&&/فایل مرجع:/.test(rf));
T('ورود درخواست fallback به r.items دارد',/parent && parent\.items/.test(rf)&&/از Excel، AI یا ورود دستی استفاده کنید/.test(rf));
T('parser تامین برند، مدل، نوع و ارقام فارسی تعداد را پوشش می‌دهد',/brand: find/.test(rf)&&/model: find/.test(rf)&&/type: find/.test(rf)&&/۰۱۲۳۴۵۶۷۸۹/.test(rf));

T('AI درخواست JWT واقعی می‌فرستد و دیگر به helper ناموجود وابسته نیست',/function irAuthHeaders/.test(iq)&&/ptf_crm_token/.test(iq)&&iq.indexOf("headers: irAuthHeaders(true)")>-1&&!/headers:\s*\(typeof ptfApiAuthHeaders/.test(iq));
T('reader مشترک MIME را از پسوند نرمال و خطای حجم را قابل اقدام می‌کند',/window\.ptfExtractRfqFileWithAi/.test(iq)&&/mimeMap = \{ pdf: 'application\/pdf'/.test(iq)&&/بیش از ۶ مگابایت/.test(iq));
T('reader مشترک PDF/image و Excel و CSV/TXT را می‌پذیرد',/\['pdf', 'jpg', 'jpeg', 'png', 'webp'\]/.test(iq)&&/\['xlsx', 'xls'\]/.test(iq)&&/\['csv', 'txt', 'md'\]/.test(iq));
T('ویرایش درخواست فروش Excel راهنمادار، پرامپت و AI مستقیم دارد',/ptfReadInqEditFileAi/.test(iq)&&/پرامپت آماده تبدیل فایل/.test(iq)&&/ورود اکسل با راهنما/.test(iq));
T('پس از صدور پیشنهاد فقط هویت قفل و اصلاح اقلام همچنان مجاز است',/_inqEditHasOffer = hasOffer/.test(iq)&&/اقلام درخواست قابل اصلاح هستند و پیشنهادهای قبلی تغییر نمی‌کنند/.test(iq)&&/if \(!window\._inqEditHasOffer\)/.test(iq));
T('خواندن فایل درخواست نیز fallback اکسل/پرامپت/AI و افزودن حذف ردیف دارد',/irAdd\(\)/.test(iq)&&/irDel\('/.test(iq)&&/irOcrFile/.test(iq)&&/irImportXls/.test(iq));
T('پرامپت INQ حفظ همه اقلام و حذف اطلاعات تماس کارفرما را الزام می‌کند',/تمام اقلام را بدون حذف یا ادغام/.test(idx)&&/نام و اطلاعات تماس کارفرما را وارد جدول اقلام نکن/.test(idx));
T('راهنمای داخل برنامه مسیرهای جدید را توضیح می‌دهد',/Excel/.test(guide)&&/پرامپت/.test(guide)||/هوش مصنوعی/.test(guide));

/* parser رفتاری مستقل */
var sb={window:null,console:console,setTimeout:function(){},document:{addEventListener:function(){},querySelectorAll:function(){return[];},createElement:function(){return{style:{},appendChild:function(){}};},head:{appendChild:function(){}}},getData:function(){return[];}};sb.window=sb;
['escP','ptfOnClickArg'].forEach(function(k){sb[k]=function(v){return String(v||'');};});
sb.faYear=function(){return 1405;};sb.faDate=function(){return'';};sb.faDateTime=function(){return'';};sb.curSession=function(){return{name:'QA'};};
vm.createContext(sb);
try{vm.runInContext(rf,sb,{filename:'rfqsmart.js'});var rows=[['Description','Specification','Qty','Unit','Type','Brand','Model'],['Valve','CL300','۲','PCS','Valve','Fisher','ET']];var got=sb.rfqsParseRows(rows);T('parser رفتاری قالب راهنما را صحیح می‌خواند',got.length===1&&got[0].qty===2&&got[0].brand==='Fisher'&&got[0].model==='ET',JSON.stringify(got));}catch(e){T('بارگذاری هسته rfqsmart',false,e.stack);}

console.log('\n'+p+' PASS / '+f+' FAIL');
process.exit(f?1:0);
