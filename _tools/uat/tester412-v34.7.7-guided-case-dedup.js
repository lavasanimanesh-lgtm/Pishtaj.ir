#!/usr/bin/env node
'use strict';
/* v34.7.7 — راهنمای ردیفی کیفیت داده + ادغام کنترل‌شده پرونده تکراری */
var fs=require('fs'),path=require('path'),vm=require('vm');
var ROOT=path.resolve(__dirname,'../..');
function read(p){return fs.readFileSync(path.join(ROOT,p),'utf8');}
function section(src,from,to){var a=src.indexOf(from),b=src.indexOf(to,a+from.length);return a<0?'':src.slice(a,b<0?src.length:b);}
var api=read('api/sales-domain.php'),core=read('crm/sales-domain-v2.js');
var plan=section(api,'function sd_duplicate_case_plan_data','function sd_array_is_list_compat');
var merge=section(api,"elseif ($action === 'duplicate_case_merge')", "elseif ($action === 'admin_delete_plan'");
var p=0,f=0;function T(n,c,d){if(c){p++;console.log('PASS',n);}else{f++;console.error('FAIL',n,d||'');}}

T('فرمان plan و merge پرونده تکراری در مرز سرور تعریف شده',api.indexOf("'duplicate_case_plan'")>-1&&api.indexOf("$action === 'duplicate_case_merge'")>-1);
T('هر دو فرمان فقط برای admin/chairman مجازند',api.indexOf('sd_require_role(SD_OFFER_REPAIR_ROLES)')>-1&&api.indexOf("const SD_OFFER_REPAIR_ROLES = ['admin', 'chairman'];")>-1);
T('plan همه پیوندهای canonical/legacy پیشنهاد را بررسی می‌کند',api.indexOf('function sd_case_offer_linked')>-1&&/wonOffer/.test(api)&&/offerNo/.test(api)&&/rootOfferId/.test(api));
T('plan پرونده پنهان/بایگانی و شواهد آرایه‌ای، مالی و عملیاتی را توصیف می‌کند',plan.indexOf('status')>-1&&plan.indexOf('evidence')>-1&&plan.indexOf('related')>-1&&plan.indexOf('safeEmpty')>-1&&api.indexOf("'petty'=>['rows'=>")>-1&&api.indexOf("'issuedCheques'=>['rows'=>")>-1);
T('plan hash مانع commit روی داده تغییرکرده می‌شود',plan.indexOf('planHash')>-1&&merge.indexOf('hash_equals')>-1&&merge.indexOf('duplicate_case_plan_stale')>-1);
T('انتخاب keep/remove و دلیل و عبارت تایید اجباری است',merge.indexOf('keepCaseId')>-1&&merge.indexOf('removeCaseId')>-1&&merge.indexOf('reason_required')>-1&&merge.indexOf('PTF-DUPLICATE-CASE-MERGE')>-1);
T('تعارض هویت درخواست/مشتری/ارز fail-closed است',merge.indexOf("['inqNo','buyerCd','currency']")>-1&&merge.indexOf('case_identity_conflict')>-1);
T('ادغام، آرایه‌ها را deduplicate می‌کند و scalar پرونده نگهداری‌شده مقدم است',api.indexOf('function sd_merge_case_value')>-1&&api.indexOf('function sd_merge_case_records')>-1&&api.indexOf("$protected = ['_id','cd'")>-1);
T('ارجاعات مالی و عملیاتی همزمان منتقل و commit می‌شوند',merge.indexOf("$moved=['invoices'=>0,'receipts'=>0,'allocations'=>0,'attachments'=>0,'petty'=>0,'opex'=>0")>-1&&merge.indexOf("$row['caseId']=$keepId")>-1&&merge.indexOf("$row['ownerId']=$keepId")>-1&&merge.indexOf("$row['dealRef']=$keepCd")>-1&&merge.indexOf("$row['dealCd']=$keepCd")>-1&&merge.indexOf("'ptf_crm_petty'=>$petty")>-1&&merge.indexOf("'ptf_crm_cheques_issued'=>$issuedCheques")>-1);
T('FIFO پس از ادغام بازسازی می‌شود',merge.indexOf('sd_rebuild_allocations($keepId')>-1);
T('snapshot منبع، correction و finding resolved در همان commit حفظ می‌شوند',merge.indexOf("'kind'=>'CASE_MERGED'")>-1&&merge.indexOf("'kind'=>'merge_duplicate_case'")>-1&&merge.indexOf("$finding['status']='resolved'")>-1);

T('هر ردیف یافته دکمه راهنمای بررسی و رفع دارد',core.indexOf('🧭 راهنمای بررسی و رفع')>-1&&core.indexOf('ptfSalesFindingGuideOpen')>-1);
T('راهنمای duplicate-case هر دو پرونده و علت پنهان‌بودن را توضیح می‌دهد',core.indexOf('بایگانی/پنهان')>-1&&core.indexOf('حتی پرونده بایگانی‌شده یا پنهان')>-1);
T('مرحله واقعی ۱۲گانه و وابستگی هر پرونده در مقایسه مصرف می‌شود',core.indexOf('sfStageOf')>-1&&core.indexOf('sfStageLabel')>-1&&core.indexOf('evidenceText')>-1);
T('UI هیچ انتخاب مبهمی را خودکار commit نمی‌کند',core.indexOf('سیستم به‌جای شما پرونده اصلی را حدس نمی‌زند')>-1&&core.indexOf('پرونده اصلی و پرونده تکراری را جداگانه انتخاب کنید')>-1);
T('کاربر قبل از commit دلیل و کلمه ادغام را وارد می‌کند',core.indexOf('کلمه «ادغام»')>-1&&core.indexOf("confirmWord!=='ادغام'")>-1);
T('پیام UI صریح است که حذف خام انجام نمی‌شود',core.indexOf('این عملیات حذف خام نیست')>-1&&core.indexOf('snapshot کامل پرونده ادغام‌شده')>-1);
T('کش محلی کاذب با plan سرور تشخیص و مسیر pull دارد',core.indexOf('سرور اکنون فقط')>-1&&core.indexOf('ptfSyncPullNow')>-1);

/* رفتار: دو case که یکی فقط در داده مانده، همچنان یک finding و راهنمای ردیفی می‌سازند. */
(function(){
 var store={ptf_crm_offers:[{_id:'OFF-1',no:'PTF-CO-X',st:'won'}],ptf_crm_deals:[{_id:'CASE-A',cd:'D-A',rootOfferId:'OFF-1',wonOffer:'PTF-CO-X',status:'active'},{_id:'CASE-B',cd:'D-B',wonOffer:'PTF-CO-X',st:'archived'}],ptf_crm_invoices:[],ptf_crm_case_receipts:[],ptf_crm_receipt_allocations:[],ptf_crm_fin_attachments:[]};
 var c={console:console,JSON:JSON,Math:Math,Date:Date,Promise:Promise,window:null,localStorage:{getItem:function(){return null;},setItem:function(){}},getData:function(k){return store[k]||[];},setData:function(k,v){store[k]=v;},curRole:function(){return'chairman';},setInterval:function(){return 0;},clearInterval:function(){},fetch:function(){return Promise.reject(new Error('offline'));},document:{getElementById:function(){return null;},querySelectorAll:function(){return[];}}};c.window=c;vm.createContext(c);vm.runInContext(core,c);var findings=c.ptfSalesIntegrityScan();var d=findings.filter(function(x){return x.type==='duplicate_case';});T('رفتاری: پرونده active + archived واقعاً دو candidate گزارش می‌شود',d.length===1&&d[0].label.indexOf('2 پرونده')===0);var html=c.ptfSalesIntegrityHtml();T('رفتاری: ردیف duplicate دکمه راهنما دارد',html.indexOf('ptfSalesFindingGuideOpen')>-1&&html.indexOf('راهنمای بررسی و رفع')>-1);
})();

console.log('\n'+p+' PASS / '+f+' FAIL');process.exit(f?1:0);
