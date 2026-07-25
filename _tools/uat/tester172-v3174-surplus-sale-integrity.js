/* US-436 light — sale commit from winning CO and reservation release */
'use strict';
require('./harness');
var fs=require('fs'),path=require('path');
var ROOT=path.resolve(__dirname,'../..');
var su=fs.readFileSync(path.join(ROOT,'crm/surplus.js'),'utf8');
SECTION('ساختار');
T('guard نهایی‌سازی پیشنهاد برنده وجود دارد', su.indexOf('ptfSurplusWinGuard')>-1 && su.indexOf('ptfSurplusFinalizeForOffer')>-1);
T('رزرو و فروش نهایی provenance دارند', su.indexOf('reservations')>-1 && su.indexOf('saleRefs')>-1 && su.indexOf('reservationOfferNo')>-1);
T('hook وضعیت پیشنهاد بعد از offers.js بسته می‌شود', su.indexOf('hookOfferStatus')>-1 && su.indexOf('window.offerSetSt')>-1);
T('مسیر این feature polling جدید اضافه نمی‌کند', su.indexOf('setInterval')===-1);

SECTION('رفتار lifecycle');
global.ptfUnifiedCode=function(){ return 'SURP-TEST-'+Math.floor(Math.random()*100000); };
global.curSession=function(){ return {name:'tester',user:'tester'}; };
global.offerNew=function(){};
global.offerSetSt=function(no,st){
  var a=getData('ptf_crm_offers'), o=a.filter(function(x){return x.no===no;})[0];
  if(o){ o.st=st; setData('ptf_crm_offers',a); }
};
/* surplus.js را در شرایط واقعیِ load بعد از offers.js ارزیابی می‌کنیم */
eval(su);
setData('ptf_crm_products',[{cd:'P-1',nm:'شیر کنترل'}]);
var s1=ptfSurplusAdd('P-1',5,'کارگاه','D-1','fixture');
setData('ptf_crm_offers',[{no:'CO-SALE-1',kind:'CO',st:'draft',items:[{sourceSurplusCd:s1.cd,qty:2}]}]);
T('رزرو فروش به offer متصل می‌شود', ptfSurplusReserve(s1.cd,2,'CO-SALE-1').ok && (ptfSurplusAll()[0].reservations||[])[0].offerNo==='CO-SALE-1');
offerSetSt('CO-SALE-1','won');
var s1After=ptfSurplusAll()[0];
T('برد CO رزرو را به sold commit می‌کند', s1After.soldQty===2 && s1After.reservedQty===0 && s1After.lastSaleOffer==='CO-SALE-1');
offerSetSt('CO-SALE-1','won');
T('commit فروش idempotent است', ptfSurplusAll()[0].soldQty===2 && ptfSurplusAll()[0].saleRefs.length===1);

var s2=ptfSurplusAdd('P-1',1,'کارگاه','','fixture');
setData('ptf_crm_offers',[{no:'CO-SALE-2',kind:'CO',st:'draft',items:[{sourceSurplusCd:s2.cd,qty:2}]}]);
ptfSurplusReserve(s2.cd,1,'CO-SALE-2');
offerSetSt('CO-SALE-2','won');
var o2=getData('ptf_crm_offers').filter(function(x){return x.no==='CO-SALE-2';})[0];
T('برد با رزرو ناکافی متوقف می‌شود', o2.st==='draft' && ptfSurplusAll().filter(function(x){return x.cd===s2.cd;})[0].reservedQty===1);

var s3=ptfSurplusAdd('P-1',3,'کارگاه','','fixture');
setData('ptf_crm_offers',[{no:'CO-SALE-3',kind:'CO',st:'draft',items:[{sourceSurplusCd:s3.cd,qty:1}]}]);
ptfSurplusReserve(s3.cd,1,'CO-SALE-3');
offerSetSt('CO-SALE-3','lost');
T('باخت CO رزرو را آزاد می‌کند', ptfSurplusAll().filter(function(x){return x.cd===s3.cd;})[0].reservedQty===0 && ptfSurplusStatus(ptfSurplusAll().filter(function(x){return x.cd===s3.cd;})[0])==='available');

var s4=ptfSurplusAdd('P-1',2,'کارگاه','','fixture');
var s5=ptfSurplusAdd('P-1',2,'انبار','','fixture');
setData('ptf_crm_offers',[{no:'CO-SALE-4',kind:'CO',st:'draft',items:[{sourceSurplusCd:s4.cd,qty:1},{sourceSurplusCd:s5.cd,qty:1}]}]);
ptfSurplusReserve(s4.cd,1,'CO-SALE-4');
ptfSurplusReserve(s5.cd,1,'CO-SALE-4');
offerSetSt('CO-SALE-4','lost');
T('آزادسازی چند قلم مستقل جمعی نیست', ptfSurplusAll().filter(function(x){return x.cd===s4.cd;})[0].reservedQty===0 && ptfSurplusAll().filter(function(x){return x.cd===s5.cd;})[0].reservedQty===0);
DONE('tester172-v3174-surplus-sale-integrity');
