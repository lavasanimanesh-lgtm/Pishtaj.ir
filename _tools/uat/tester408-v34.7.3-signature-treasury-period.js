#!/usr/bin/env node
'use strict';
/* v34.7.3 — ماندگاری پروفایل امضا، خروجی نامه با/بدون امضا، گزارش دوره‌ای خزانه */
require('./harness');
var fs=require('fs'),path=require('path');
var ROOT=path.resolve(__dirname,'../..');
var letters=fs.readFileSync(path.join(ROOT,'crm/letters.js'),'utf8');
var treasury=fs.readFileSync(path.join(ROOT,'crm/treasury.js'),'utf8');
var offers=fs.readFileSync(path.join(ROOT,'crm/offers.js'),'utf8');
var contracts=fs.readFileSync(path.join(ROOT,'crm/contracts.js'),'utf8');
var docsx=fs.readFileSync(path.join(ROOT,'crm/docsx.js'),'utf8');
var sales=fs.readFileSync(path.join(ROOT,'crm/salesfiles.js'),'utf8');
var p=0,f=0;
function T(n,c,d){if(c){p++;console.log('PASS',n);}else{f++;console.error('FAIL',n,d||'');}}

T('پروفایل امضا از getData/IDB خوانده می‌شود نه localStorage مستقیم',/function sigProfileMap/.test(letters)&&/getData\('ptf_crm_sigprofiles'\)/.test(letters));
T('mirror بازیابی مستقل و repair یک‌باره برای امضای گم‌شده وجود دارد',/ptf_sig_profile_recovery_v1_/.test(letters)&&/_ptfSigRecoveryRepaired/.test(letters));
T('ذخیره امضا failure را بررسی و رسید sync رکورد می‌گیرد',/saved === false/.test(letters)&&/ptfSyncTrackRecordSave/.test(letters));
T('تمام مصرف‌کنندگان سند از accessor پایدار امضا استفاده می‌کنند',/ptfSigProfileFor/.test(offers)&&/ptfSigProfileFor/.test(contracts)&&/ptfSigProfileFor/.test(docsx));
T('مکاتبات دو خروجی صریح با و بدون امضای دیجیتال دارد',/با امضای دیجیتال/.test(letters)&&/بدون امضا \/ چاپ فیزیکی/.test(letters)&&/محل مهر و امضای فیزیکی/.test(letters));
T('پرونده فروش نیز هر دو خروجی نامه را ارائه می‌کند',/letPrint\([^\n]+false,true/.test(sales)&&/letPrint\([^\n]+false,false/.test(sales));

/* رفتار خواندن امضا از getData وقتی localStorage اصلی توسط IDB migration خالی شده است. */
/* v34.36.3 (R2/T5-2c): helpers کش Dev-KV امضا هم استخراج می‌شوند */
global._sigRecoveryCache={};global._sigRecoveryChecked={};
['sigRecoveryKey','sigRecoveryRead','sigRecoveryWrite','sigRecoveryHydrate','sigProfileMap','sigUserAliases','sigProfileFor'].forEach(function(name){var re=new RegExp('function '+name+'\\([^)]*\\) \\{[\\s\\S]*?\\n\\}');var m=letters.match(re);if(m)eval(m[0].replace('function '+name,'global.'+name+'=function'));});
global.curSession=function(){return{user:'u1',name:'User One'};};
var sigMap={u1:{sig:'data:image/png;base64,PERSIST',nm:'User One',updatedAtISO:'2026-08-15T10:00:00Z'}};
global.getData=function(k){return k==='ptf_crm_sigprofiles'?sigMap:[];};
try{localStorage.removeItem('ptf_crm_sigprofiles');}catch(e){}
T('با خالی بودن localStorage اصلی، امضا از getData/IDB پیدا می‌شود',global.sigProfileFor&&sigProfileFor('u1').sig.indexOf('PERSIST')>-1);

T('خزانه فیلتر تاریخ/جهت/منبع و مجموع دوره دارد',/ptfTreasuryPeriodData/.test(treasury)&&/trFrom/.test(treasury)&&/trDir/.test(treasury)&&/trSrc/.test(treasury)&&/جمع ورودی فیلتر/.test(treasury));
T('خزانه خروجی Excel/CSV و PDF دوره دارد',/ptfTreasuryPeriodCsv/.test(treasury)&&/ptfTreasuryPeriodPrint/.test(treasury)&&/Excel\/CSV/.test(treasury)&&/PDF\/چاپ دوره/.test(treasury));
T('CSV جمع ورودی/خروجی/خالص را در انتهای فایل می‌گذارد',/\['جمع ورودی'/.test(treasury)&&/\['جمع خروجی'/.test(treasury)&&/\['خالص دوره'/.test(treasury));

/* رفتار واقعی print mode با استخراج وابستگی‌های حداقلی */
global.curSession=function(){return{user:'u1',name:'User One'};};
global.faDate=function(){return'1405/05/24';};global.escP=function(v){return String(v==null?'':v);};
global.letSafeBodyHtml=function(v){return v;};global.letSignerEn=function(){return'User One';};global.letRoleEn=function(){return'Manager';};global.letFaDigits=function(v){return v;};global.letAutoSize=function(){return 14;};global.letEmbeddedFontCss=function(){return'';};
global.sigProfiles=function(){return{u1:{nm:'کاربر یک',role:'مدیر',sig:'data:image/png;base64,SIG',stamp:'data:image/png;base64,STAMP'}};};
global._printed='';global.ptfPreviewPrintableDoc=function(t,h,n){global._printed=h;global._printName=n;};
global.LETTER_FONT_FA='Tahoma';global.LETTER_FONT_EN='Arial';
var fn=letters.match(/function letPrintObj\(l, isPreview\) \{[\s\S]*?\n\}/)[0];eval(fn.replace('function letPrintObj','global.letPrintObj=function'));
var L={no:'1405/پ/ص/001',lang:'fa',st:'signed',signer:'u1',signerNm:'کاربر یک',signerRole:'مدیر',to:'مخاطب',subject:'موضوع',body:'متن',signatureSnapshot:{sig:'data:image/png;base64,SIG',stamp:'data:image/png;base64,STAMP',nm:'کاربر یک',role:'مدیر'}};
letPrintObj(L,false,true);var signed=global._printed;
letPrintObj(L,false,false);var physical=global._printed;
T('خروجی signed تصویر snapshot را دارد',signed.indexOf('base64,SIG')>-1&&signed.indexOf('base64,STAMP')>-1);
T('خروجی physical تصاویر را حذف ولی محل امضای دستی را نگه می‌دارد',physical.indexOf('base64,SIG')<0&&physical.indexOf('محل مهر و امضای فیزیکی')>-1);

/* رفتار period filter خزانه */
global.window=global;global.document={getElementById:function(){return null;},createElement:function(){return{click:function(){},remove:function(){}};},body:{appendChild:function(){}}};
global.ptfJToISO=function(s){var m={'1405/05/01':'2026-07-23','1405/05/31':'2026-08-22'};return m[s]||'';};
try{eval.call(global,treasury);}catch(e){T('بارگذاری خزانه برای تست رفتاری',false,e.stack);}
global.ptfTreasuryCrmMoves=global.ptfTreasuryAllPeriodMoves=function(){return[
 {cd:'I1',dir:'in',amount:100,dateISO:'2026-08-01',dateFa:'1405/05/10',src:'وصولی مشتری',label:'وصول'},
 {cd:'O1',dir:'out',amount:40,dateISO:'2026-08-02',dateFa:'1405/05/11',src:'هزینه جاری',label:'هزینه'},
 {cd:'O2',dir:'out',amount:10,dateISO:'2026-09-01',dateFa:'1405/06/10',src:'هزینه جاری',label:'خارج بازه'}
];};
var all=ptfTreasuryPeriodData({from:'1405/05/01',to:'1405/05/31',dir:'all',src:'all'});
T('فیلتر بازه مجموع ورودی/خروجی/خالص صحیح می‌دهد',all.count===2&&all.inflow===100&&all.outflow===40&&all.net===60,JSON.stringify(all));
var onlyOut=ptfTreasuryPeriodData({from:'1405/05/01',to:'1405/05/31',dir:'out',src:'هزینه جاری'});
T('فیلتر فقط خروجی و منبع مشخص کار می‌کند',onlyOut.count===1&&onlyOut.inflow===0&&onlyOut.outflow===40);

console.log('\n'+p+' PASS / '+f+' FAIL');process.exit(f?1:0);
