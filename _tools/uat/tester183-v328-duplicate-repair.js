/* Safe automatic duplicate repair: newer unreferenced records only */
'use strict';
require('./harness');
var fs=require('fs'),path=require('path');
var ROOT=path.resolve(__dirname,'../..');
var cg=fs.readFileSync(path.join(ROOT,'crm/codegen.js'),'utf8');
SECTION('ساختار repair');
T('duplicate plan/apply/auto functions وجود دارند', cg.indexOf('ptfBuildDuplicateRepairPlan')>-1 && cg.indexOf('ptfApplyDuplicateRepairPlan')>-1 && cg.indexOf('ptfAutoRepairSafeDuplicates')>-1 && cg.indexOf('ptfDuplicateRepairOpen')>-1 && cg.indexOf('ptfDuplicateRepairApplyOne')>-1);
var autoBlock=(cg.match(/window\.ptfAutoRepairSafeDuplicates = function\(\)\{[\s\S]*?\n\};/)||[''])[0];
T('repair بدون confirmation اعمال نمی‌شود', cg.indexOf("opts.confirm!=='PTF-DUP-REPAIR'")>-1 && autoBlock.indexOf('ptfApplyDuplicateRepairPlan')===-1);
T('هشدار/دکمه در UI backup در دسترس است', fs.readFileSync(path.join(ROOT,'crm/backup.js'),'utf8').indexOf('ptfDuplicateRepairOpen')>-1);
T('کدهای مبهم با reference تغییر نمی‌کنند', cg.indexOf("reason:refs.length?'referenced-ambiguous'")>-1 && cg.indexOf('if(!item.safe)')>-1);
T('repair با audit ثبت می‌شود', cg.indexOf("'اصلاح خودکار کد تکراری امن '")>-1);

SECTION('رفتار safe/ambiguous');
global.curRole=function(){return 'admin';};
global.audit=function(){};
global.notify=function(){};
global.faDateTime=function(){return '1405/04/27 10:00';};
/* codegen IIFE definitions are self-contained; network reserve is intentionally stubbed */
eval(cg);
global.ptfUnifiedCode=function(){return 'PTF-CO-1405-0102';};
setData('ptf_crm_offers',[{no:'PTF-CO-1405-0100',t:'1405/04/25',st:'sent'},{no:'PTF-CO-1405-0100',t:'1405/04/27',st:'draft'}]);
setData('ptf_crm_invoices',[]); setData('ptf_crm_deals',[]); setData('ptf_crm_projects',[]);
var p1=ptfBuildDuplicateRepairPlan();
T('duplicate بدون reference safe تشخیص داده می‌شود',p1.length===1 && p1[0].safe===true);
var a1=ptfApplyDuplicateRepairPlan(p1,{confirm:'PTF-DUP-REPAIR'});
T('رکورد جدیدتر کد جدید می‌گیرد',a1.applied.length===1 && getData('ptf_crm_offers')[1].no==='PTF-CO-1405-0102' && getData('ptf_crm_offers')[0].no==='PTF-CO-1405-0100');
setData('ptf_crm_offers',[{no:'PTF-CO-1405-0100',t:'1405/04/25',st:'sent'},{no:'PTF-CO-1405-0100',t:'1405/04/27',st:'draft'}]);
setData('ptf_crm_invoices',[{offerNo:'PTF-CO-1405-0100',amount:1}]);
var p2=ptfBuildDuplicateRepairPlan();
T('duplicate دارای reference ambiguous می‌شود',p2.length===1 && p2[0].safe===false && p2[0].reason==='referenced-ambiguous');
var a2=ptfApplyDuplicateRepairPlan(p2,{confirm:'PTF-DUP-REPAIR'});
T('duplicate مبهم بدون تغییر باقی می‌ماند',a2.applied.length===0 && getData('ptf_crm_offers')[1].no==='PTF-CO-1405-0100');
DONE('tester183-v328-duplicate-repair');
