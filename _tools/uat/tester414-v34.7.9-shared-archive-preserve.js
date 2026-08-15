#!/usr/bin/env node
'use strict';
/* v34.7.9 — حذف snapshot بایگانی بدون حذف پرونده فعال مشترک */
var fs=require('fs'),path=require('path');var ROOT=path.resolve(__dirname,'../..');
function read(p){return fs.readFileSync(path.join(ROOT,p),'utf8');}
function section(src,from,to){var a=src.indexOf(from),b=src.indexOf(to,a+from.length);return a<0?'':src.slice(a,b<0?src.length:b);}
var api=read('api/sales-domain.php'),projects=read('crm/projects.js'),quality=read('crm/sales-domain-v2.js');
var plan=section(api,'function sd_archive_purge_plan_data','function sd_purge_receipt_path');
var commit=section(api,"elseif ($action === 'archived_case_purge_commit')", "elseif ($action === 'admin_delete_plan'");
var p=0,f=0;function T(n,c,d){if(c){p++;console.log('PASS',n);}else{f++;console.error('FAIL',n,d||'');}}

T('plan پرونده فعال مشترک را صریح تشخیص می‌دهد',plan.indexOf('$sharedActiveCases=[]')>-1&&plan.indexOf("['status']??'')!=='archived'")>-1);
T('حالت مشترک archive_shell_only است',plan.indexOf("'mode'=>'archive_shell_only'")>-1&&plan.indexOf("'sharedActiveCases'=>$sharedActiveCases")>-1);
T('shell-only فقط target project را در matches حذف قرار می‌دهد',plan.indexOf("'_matches'=>['ptf_crm_projects'=>[$targetFp=>$targetHash]]")>-1);
T('shell-only هیچ deals/offers/rfqs را در identities حذف قرار نمی‌دهد',plan.indexOf("$identity=['ptf_crm_projects'=>")>-1);
T('فقط cloud key منحصربه‌فرد snapshot حذف می‌شود',plan.indexOf('array_diff(array_keys($targetCloud),array_keys($otherCloud))')>-1);
T('hash پوسته شامل mode و hash کامل target است',plan.indexOf("['mode'=>'archive_shell_only'")>-1&&plan.indexOf("$targetFp.':'.$targetHash")>-1);
T('نتیجه commit mode و تعداد پرونده‌های فعال محفوظ را برمی‌گرداند',commit.indexOf("'mode'=>$plan['mode']??'full_graph'")>-1&&commit.indexOf("'sharedActiveCases'=>count")>-1);

T('UI هشدار می‌دهد حذف محدود به نسخه بایگانی است',projects.indexOf('حذف محدود به نسخه بایگانی است')>-1);
T('UI نام پرونده فعال محفوظ را نمایش می‌دهد',projects.indexOf('پرونده فعال محفوظ:')>-1&&projects.indexOf('activeIds')>-1);
T('تایید shell-only صریحاً حفظ پرونده فعال را الزام می‌کند',projects.indexOf('نسخه بایگانی یک کپی آزمایشی/تکراری است و پرونده فعال باید حفظ شود')>-1);
T('دکمه و toast shell-only با حذف کامل graph اشتباه نمی‌شوند',projects.indexOf('حذف فقط نسخه بایگانی و حفظ پرونده فعال')>-1&&projects.indexOf("r.mode==='archive_shell_only'")>-1);
T('دو پرونده باز همچنان از راهنمای duplicate-case قابل ادغام‌اند',quality.indexOf('ptfDuplicateCaseMergeCommit')>-1&&quality.indexOf('پرونده‌ای که باقی می‌ماند')>-1&&quality.indexOf('پرونده‌ای که داخل پرونده اصلی ادغام می‌شود')>-1);

console.log('\n'+p+' PASS / '+f+' FAIL');process.exit(f?1:0);
