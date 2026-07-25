/* Release 1 — post-award integrity guards for salesfile mutations */
'use strict';
require('./harness');
var fs=require('fs'),path=require('path');
var ROOT=path.resolve(__dirname,'../..');
var sf=fs.readFileSync(path.join(ROOT,'crm/salesfiles.js'),'utf8');
SECTION('ساختار guard');
T('QC در هسته فقط برای پرونده برنده است', sf.indexOf("/* US-434: QC فقط در پروندهٔ ابلاغ‌شده/برنده مجاز است")>-1 && sf.indexOf('if (!r || !r.wonOffer) return null;')>-1);
T('ارسال/تحویل در هسته فقط برای پرونده برنده است', sf.indexOf("/* US-434/440: ارسال و تحویل فقط در پروندهٔ ابلاغ‌شده/برنده مجاز است")>-1);
T('UI null را بدون commit/Toast رها می‌کند', sf.indexOf('var ev = sfQcCommit(cd, v.type, v.conf, v.desc);')>-1 && sf.indexOf('var ev = sfShipCommit(cd, typeId, v);')>-1);

SECTION('رفتار guard');
global.curSession=function(){return {name:'tester',user:'tester'};};
global.SENIOR_ROLES=['admin','chairman','ceo','commercial'];
global.sfAll=function(){return getData('ptf_crm_deals');};
global.sfSave=function(v){setData('ptf_crm_deals',v);};
global.sfShipSeqCheck=function(){return null;};
global.sfStageOf=function(){return 5;};
global.sfRfqAlign=function(){return true;};
var mq=sf.match(/window\.SF_QC_TYPES = \[[\s\S]*?\];/);
var mc=sf.match(/window\.SF_QC_CONF = \[[\s\S]*?\];/);
var mf=sf.match(/window\.sfQcCommit = function \(cd, typeId, confId, desc\) \{[\s\S]*?\n  \};/);
T('استخراج هسته QC', !!mq && !!mc && !!mf);
if(mq&&mc&&mf){
  eval(mq[0]); eval(mc[0]);
  eval(mf[0].replace(/sfAll\(\)/g,'global.sfAll()').replace(/sfSave\(list\)/g,'global.sfSave(list)'));
  setData('ptf_crm_deals',[{cd:'D-PRE',inqNo:'I-PRE',docs:[]}]);
  T('QC پیش از برد commit نمی‌شود', sfQcCommit('D-PRE','test','conform','x')===null && !getData('ptf_crm_deals')[0].qcEvents);
  setData('ptf_crm_deals',[{cd:'D-WON',inqNo:'I-WON',wonOffer:'CO-WON',docs:[]}]);
  T('QC در پرونده برنده commit می‌شود', !!sfQcCommit('D-WON','test','conform','x') && getData('ptf_crm_deals')[0].qcEvents.length===1);
}
var ms=sf.match(/window\.SF_SHIP_TYPES = \[[\s\S]*?\];/);
var mship=sf.match(/window\.sfShipCommit = function \(cd, typeId, v\) \{[\s\S]*?\n  \};/);
T('استخراج هسته ارسال', !!ms && !!mship);
if(ms&&mship){
  eval(ms[0]);
  eval(mship[0].replace(/sfAll\(\)/g,'global.sfAll()').replace(/sfSave\(list\)/g,'global.sfSave(list)'));
  setData('ptf_crm_deals',[{cd:'D-PRE2',inqNo:'I-PRE2',docs:[]}]);
  T('ارسال پیش از برد commit نمی‌شود', sfShipCommit('D-PRE2','packing',{no:'PL-1'})===null && !getData('ptf_crm_deals')[0].shipEvents);
  setData('ptf_crm_deals',[{cd:'D-WON2',inqNo:'I-WON2',wonOffer:'CO-WON2',docs:[]}]);
  T('ارسال در پرونده برنده commit می‌شود', !!sfShipCommit('D-WON2','packing',{no:'PL-2'}) && getData('ptf_crm_deals')[0].shipEvents.length===1);
}
DONE('tester175-v320-salesfile-postaward-guards');
