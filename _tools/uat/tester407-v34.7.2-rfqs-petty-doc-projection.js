#!/usr/bin/env node
'use strict';
/* v34.7.2 — چیدمان کارت تامین + projection زنده سند تنخواه + فرمت‌های legacy گزارش تلفیقی */
require('./harness');
var fs=require('fs'),path=require('path');
var ROOT=path.resolve(__dirname,'../..');
var petty=fs.readFileSync(path.join(ROOT,'crm/petty.js'),'utf8');
var sales=fs.readFileSync(path.join(ROOT,'crm/salesfiles.js'),'utf8');
var rfqs=fs.readFileSync(path.join(ROOT,'crm/rfqsmart.js'),'utf8');
var idx=fs.readFileSync(path.join(ROOT,'crm/index.html'),'utf8');
var guard=fs.readFileSync(path.join(ROOT,'crm/finance-write-guard.js'),'utf8');
var p=0,f=0;
function T(n,c,d){if(c){p++;console.log('PASS',n);}else{f++;console.error('FAIL',n,d||'');}}

T('کارت تامین grid دو ستونه مستقل برای شرح و عملیات دارد',/class="rfqs-list-head"/.test(rfqs)&&/grid-template-columns: minmax\(0, 1fr\) minmax\(430px, 520px\)/.test(idx));
T('شرح طولانی clamp/overflow دارد و دکمه‌ها nowrap می‌مانند',/-webkit-line-clamp: 2/.test(idx)&&/overflow-wrap: anywhere/.test(idx)&&/\.rfqs-list-actions \.bt/.test(idx));
T('موبایل عملیات را آگاهانه دو ستونه می‌کند نه با شکستن تصادفی شرح',/@media \(max-width: 760px\)/.test(idx)&&/grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/.test(idx));

T('افزودن و حذف سند تنخواه projection پرونده را sync و drawer باز را rerender می‌کند',/ptfPettySyncLinkedDeal\(rr, 'افزودن سند جدید/.test(petty)&&/ptfPettySyncLinkedDeal\(r, 'حذف سند تنخواه/.test(petty)&&/typeof renderDeals === 'function'/.test(petty));
T('پرونده فایل هزینه تنخواه را زنده می‌خواند و dealRef قدیمیِ بدون costEvent را هم projection می‌کند',/ptfPettyRecordFiles\(livePetty\)/.test(sales)&&/pjPettyByCd/.test(sales)&&/pjCostEvents\.push/.test(sales));
T('داخل پرونده دکمه مدیریت اسناد زنده و شمارنده دارد',/ptfPettyFilesUi/.test(sales)&&/📎 اسناد \('/.test(sales));
T('projection مرکزی finance نیز normalizer اسناد تنخواه را مصرف می‌کند',/ptfPettyRecordFiles\(rec\)/.test(guard));

/* محیط حداقلی برای اجرای واقعی normalizer/report collector */
global.curSession=function(){return{user:'u',name:'QA'};};
global.curRole=function(){return'admin';};
global.faDate=function(){return'1405/05/24';};global.faDateTime=function(){return'1405/05/24 12:00';};
global.audit=function(){};global.notify=function(){};global.alert=function(){};global.confirm=function(){return true;};
global.ptfOnClickArg=function(v){return String(v||'').replace(/[\\']/g,'');};global.escP=function(v){return String(v==null?'':v);};
function el(){return{style:{},remove:function(){},appendChild:function(){},insertAdjacentHTML:function(){},setAttribute:function(){},addEventListener:function(){},querySelectorAll:function(){return[];},querySelector:function(){return null;},classList:{add:function(){},remove:function(){}}};}
global.document={getElementById:function(){return el();},querySelectorAll:function(){return[];},querySelector:function(){return el();},createElement:function(){return el();},head:el(),body:el(),addEventListener:function(){}};
global.window.open=function(){};
try{eval.call(global,petty);}catch(e){T('بارگذاری petty برای تست رفتاری',false,e.stack);}

var legacy=[
 {cd:'P1',month:'1405/05',amt:1,file:{objectKey:'petty/P1/a.jpg',originalName:'a.jpg',mimeType:'image/jpeg'}},
 {cd:'P2',month:'1405/05',amt:1,attachments:[{storageKey:'petty/P2/b.pdf',fileName:'b.pdf'}]},
 {cd:'P3',month:'1405/05',amt:1,receipt:{dataUrl:'data:image/png;base64,AA==',fileName:'old.png'}},
 {cd:'P4',month:'1405/05',amt:1,docs:{invoice:{fileKey:'petty/P4/c.docx',filename:'c.docx',contentType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}}},
 {cd:'P5',month:'1405/05',amt:1,files:'[{"key":"petty/P5/d.webp","name":"d.webp"}]'}
];
setData('ptf_crm_petty',legacy);setData('ptf_crm_petty_tx',[]);setData('ptf_crm_petty_periods',[]);
var normalized=[];legacy.forEach(function(r){normalized=normalized.concat(ptfPettyRecordFiles(r));});
T('normalizer file/objectKey/storageKey/dataUrl/docs-map/JSON-string را پوشش می‌دهد',normalized.length===5,JSON.stringify(normalized));
T('نوع MIME قدیمی و Office تشخیص داده می‌شود',ptfPettyFileKind('',normalized[0])==='image'&&ptfPettyFileKind('',normalized[3])==='office');
var periodFiles=ptfPettyPeriodFiles('1405/05');
T('گزارش دوره همه پنج سند legacy را جمع می‌کند',periodFiles.length===5,periodFiles.map(function(x){return x.name;}).join(','));
T('برای اسناد بدون petId شناسه غیرتکراری ساخته می‌شود',periodFiles.every(function(x){return !!x.petId;})&&new Set(periodFiles.map(function(x){return x.petId;})).size===5);
var html=ptfPettyReceiptsHtml(periodFiles);
T('همه فرمت‌ها حداقل کارت قابل مشاهده در گزارش دارند',(html.match(/class="rcpt"/g)||[]).length===5);
T('سند dataUrl قدیمی به صورت تصویر inline نمایش داده می‌شود',html.indexOf('data:image/png;base64,AA==')>-1&&html.indexOf('<img')>-1);
T('سند Office قدیمی به جای حذف شدن حداقل کارت نام‌دار نمایش می‌دهد',html.indexOf('c.docx')>-1&&html.indexOf('📄')>-1);

console.log('\n'+p+' PASS / '+f+' FAIL');
process.exit(f?1:0);
