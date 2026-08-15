#!/usr/bin/env node
'use strict';
/* v34.7.8 — حذف قطعی graph پرونده آزمایشی بایگانی‌شده */
var fs=require('fs'),path=require('path');var ROOT=path.resolve(__dirname,'../..');
function read(p){return fs.readFileSync(path.join(ROOT,p),'utf8');}
function section(src,from,to){var a=src.indexOf(from),b=src.indexOf(to,a+from.length);return a<0?'':src.slice(a,b<0?src.length:b);}
var api=read('api/sales-domain.php'),storage=read('api/storage.php'),crm=read('api/crm.php'),projects=read('crm/projects.js'),sync=read('crm/sync.js'),reports=read('crm/reports.js');
var plan=section(api,'function sd_archive_purge_plan_data','function sd_purge_receipt_path');
var commit=section(api,"elseif ($action === 'archived_case_purge_commit')", "elseif ($action === 'admin_delete_plan'");
var p=0,f=0;function T(n,c,d){if(c){p++;console.log('PASS',n);}else{f++;console.error('FAIL',n,d||'');}}

T('plan و commit مستقل برای purge بایگانی تعریف شده',api.indexOf("'archived_case_purge_plan'")>-1&&api.indexOf("$action === 'archived_case_purge_commit'")>-1);
T('مجوز دقیق purge فقط admin/chairman است',api.indexOf('sd_require_role(SD_OFFER_REPAIR_ROLES)')>-1&&api.indexOf("const SD_OFFER_REPAIR_ROLES = ['admin', 'chairman'];")>-1);
T('فقط state=archived پذیرفته و پرونده فعال مشترک به shell-only تبدیل می‌شود',plan.indexOf("project_not_archived")>-1&&plan.indexOf("['state']??'')!=='archived'")>-1&&plan.indexOf("'mode'=>'archive_shell_only'")>-1&&plan.indexOf('sharedActiveCases')>-1);
T('master data مشترک عمداً در دامنه purge نیست',plan.indexOf('ptf_crm_customers')===-1&&plan.indexOf('ptf_crm_products')===-1&&plan.indexOf('ptf_crm_suppliers')===-1);
T('graph فروش درخواست پیشنهاد پرونده و مالی را پوشش می‌دهد',plan.indexOf('ptf_crm_projects')>-1&&plan.indexOf('ptf_crm_deals')>-1&&plan.indexOf('ptf_crm_offers')>-1&&plan.indexOf('ptf_crm_rfqs')>-1&&plan.indexOf('ptf_crm_invoices')>-1&&plan.indexOf('ptf_crm_case_receipts')>-1);
T('graph اسناد، موجودی و عملیات جانبی را با گارد اشتراک پوشش می‌دهد',plan.indexOf('ptf_crm_packinglists')>-1&&plan.indexOf('ptf_crm_letters')>-1&&plan.indexOf('ptf_crm_contracts')>-1&&plan.indexOf('ptf_crm_buycmp')>-1&&plan.indexOf('ptf_crm_petty')>-1&&plan.indexOf('ptf_crm_opex')>-1&&plan.indexOf('ptf_crm_surplus')>-1&&plan.indexOf('shared_inventory_dependency')>-1);
T('فاکتور/پرداخت تامین مرتبط بدون آسیب به پرداخت مشترک تعیین تکلیف می‌شود',plan.indexOf('ptf_crm_supplier_finance')>-1&&plan.indexOf('$unmatched===0')>-1&&commit.indexOf("$payment['allocations']=array_values(array_filter")>-1);
T('همه cloud keyهای graph جمع و digest می‌شوند',plan.indexOf('sd_collect_cloud_keys')>-1&&plan.indexOf('keysDigest')>-1&&plan.indexOf('cloudKeys')>-1);
T('planHash شامل hash محتوای رکوردهاست نه فقط شناسه',api.indexOf("$matches[$key][$fp]=hash('sha256'")>-1&&plan.indexOf("$fp.':'.$rowHash")>-1);

T('commit تایید آزمایشی، شماره دقیق و دلیل را الزام می‌کند',commit.indexOf('testDataConfirmed')>-1&&commit.indexOf('project_number_confirmation_mismatch')>-1&&commit.indexOf('reason_required')>-1&&commit.indexOf('PTF-PURGE-ARCHIVED-TEST-CASE')>-1);
T('commit بدون رسید حذف موفق cloud fail-closed است',commit.indexOf('cloud_purge_receipt_required')>-1&&commit.indexOf('keysDigest')>-1&&commit.indexOf('3600')>-1);
T('storage رسید حذف را فقط با failed=0 و digest صحیح می‌نویسد',storage.indexOf("$purpose==='archived_case_purge'&&$failed===0")>-1&&storage.indexOf('purgeReceipt')>-1&&storage.indexOf("hash_equals((string)($in['keysDigest']")>-1);
T('حذف همه projectionها در یک changes/commit انجام می‌شود',commit.indexOf("$changes[$key]=$after")>-1&&commit.indexOf("$changes['ptf_crm_supplier_finance']=$sf")>-1&&commit.indexOf("$changes['ptf_crm_deleted_archive']=$archive")>-1);
T('snapshot کامل نگهداری نمی‌شود و tombstone فقط شناسه‌هاست',commit.indexOf("'kind'=>'archive_purge'")>-1&&commit.indexOf("'identities'=>")>-1&&commit.indexOf("'snapshot'=>")===-1);
T('snapshot سال مالی متاثر حذف می‌شود تا گزارش پاک دوباره ساخته شود',commit.indexOf("$changes['ptf_crm_fiscal_snapshots']=$snaps")>-1&&commit.indexOf('resetFiscalYears')>-1&&commit.indexOf("$snap['year']")>-1);

T('UI دکمه purge را فقط روی archived و نقش مجاز نشان می‌دهد',projects.indexOf("p.state === 'archived' && ptfArchivePurgeAllowed()")>-1&&projects.indexOf('حذف قطعی داده آزمایشی')>-1);
T('ویزارد دامنه و حالت حفظ پرونده فعال را شفاف توضیح می‌دهد',projects.indexOf('جمع رکورد:')>-1&&projects.indexOf('فایل ابری:')>-1&&projects.indexOf('مشتریان، کالاها و تامین‌کنندگان مشترک حذف نمی‌شوند')>-1&&projects.indexOf('حذف محدود به نسخه بایگانی است')>-1&&projects.indexOf('پرونده فعال باید حفظ شود')>-1);
T('دو checkbox و تایپ شماره پرونده قبل از حذف الزامی‌اند',projects.indexOf('arcPurgeTest')>-1&&projects.indexOf('arcPurgeNoRecovery')>-1&&projects.indexOf('arcPurgeTyped')>-1&&projects.indexOf('typed!==no')>-1);
T('کلاینت plan را درست پیش از حذف cloud دوباره اعتبارسنجی می‌کند',projects.indexOf("ptfArchivePurgeApi('archived_case_purge_plan'")>-1&&projects.indexOf('latest.planHash!==planHash')>-1);
T('پس از purge گزارش سال مالی دوباره رندر می‌شود',projects.indexOf("typeof ptfFiscalRender==='function'")>-1);

T('server/client tombstone مانع resurrection است و از UI حذف نمی‌شود',crm.indexOf("$kind === 'archive_purge'")>-1&&crm.indexOf("$d['identities'][$key]")>-1&&sync.indexOf("kind === 'archive_purge'")>-1&&sync.indexOf('d.identities[key]')>-1&&reports.indexOf("x.kind === 'archive_purge'")>-1&&reports.indexOf("arc[idx].kind === 'archive_purge'")>-1&&crm.indexOf("$key === 'ptf_crm_deleted_archive'")>-1&&sync.indexOf("key === 'ptf_crm_deleted_archive'")>-1);
T('supplier-finance object هنگام tombstone به آرایه خراب تبدیل نمی‌شود',api.indexOf("return $key==='ptf_crm_supplier_finance'?$value:array_values($value)")>-1&&crm.indexOf("$key === 'ptf_crm_supplier_finance'")>-1&&sync.indexOf("key==='ptf_crm_supplier_finance'")>-1);

console.log('\n'+p+' PASS / '+f+' FAIL');process.exit(f?1:0);
