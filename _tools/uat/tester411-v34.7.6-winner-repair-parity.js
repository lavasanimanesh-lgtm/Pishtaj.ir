#!/usr/bin/env node
'use strict';
/* v34.7.6 — parity دکمه بازگشت برد و اصلاح کنترل‌شده برای admin/chairman */
var fs=require('fs'),path=require('path');
var ROOT=path.resolve(__dirname,'../..');
function read(p){return fs.readFileSync(path.join(ROOT,p),'utf8');}
function section(src,from,to){var a=src.indexOf(from),b=src.indexOf(to,a+from.length);return a<0?'':src.slice(a,b<0?src.length:b);}
var api=read('api/sales-domain.php');
var core=read('crm/sales-domain-v2.js');
var offers=read('crm/offers.js');
var backup=read('crm/backup.js');
var rbac=read('crm/rbac.js');
var mobile=read('crm/offer-rial-convert.js');
var revokeApi=section(api,"elseif ($action === 'revoke_orphan_delete')", "elseif ($action === 'admin_delete_plan'");
var unwinAlias=section(backup,'window.adminUnwin = function','window.adminDelOffer = function');
var p=0,f=0;function T(n,c,d){if(c){p++;console.log('PASS',n);}else{f++;console.error('FAIL',n,d||'');}}

T('ریشه اختلاف مستند شده: نشست قدیمی role را به sales تنزل نمی‌دهد',
  /var id = String\(s\.roleId \|\| s\.role \|\| ''\)/.test(rbac) && /ROLES\[id\] \? id : 'sales'/.test(rbac));
T('مجوز اصلاح برد دقیقاً برای admin و chairman تعریف شده',
  api.indexOf("const SD_OFFER_REPAIR_ROLES = ['admin', 'chairman'];")>-1 && core.indexOf("var OFFER_REPAIR_ROLES = ['admin', 'chairman'];")>-1);
T('دکمه بازگشت جزئی از رندر اصلی پیشنهاد است نه تزریق backup',
  offers.indexOf('data-offer-action="unwin"')>-1 && offers.indexOf('ptfRevokeOfferWin')>-1 && backup.indexOf('var _renderOffers = window.renderOffers')===-1);
T('دکمه فقط برای پیشنهاد برنده و نقش مجاز رندر می‌شود',
  offers.indexOf('isWon && _canRepairWin')>-1 && offers.indexOf("['admin', 'chairman'].indexOf(curRole())")>-1);
T('نمای موبایل action جدید بازگشت را تشخیص می‌دهد',
  mobile.indexOf('ptfRevokeOfferWin\\s*\\(')>-1 && mobile.indexOf("unwin:       { label: 'بازگردانی از برنده'")>-1);

T('بازگشت فقط برای رکورد واقعاً برنده، از فرمان اتمیک سرور و با دلیل انجام می‌شود',
  core.indexOf("api('revoke_orphan_delete',{offerNo:no,delete:false,reason:reason.trim()")>-1 && revokeApi.indexOf("offer_not_won")>-1 && revokeApi.indexOf("reason_required")>-1);
T('وابستگی پرونده یا فاکتور بازگشت خودکار را fail-closed می‌کند',
  revokeApi.indexOf("dependencies_exist")>-1 && revokeApi.indexOf("'type'=>'case'")>-1 && revokeApi.indexOf("'type'=>'invoice'")>-1);
T('اصلاح سروری projection پیشنهاد و correction audit را با هم commit می‌کند',
  revokeApi.indexOf("'ptf_crm_offers'=>$offers")>-1 && revokeApi.indexOf("'ptf_crm_corrections'=>$corrections")>-1 && revokeApi.indexOf("'beforeSnapshot'=>$offer")>-1 && revokeApi.indexOf("$offer['revokedWinSnapshot']")>-1);
T('chairman فقط بازگردانی دارد و حذف پیشنهاد همچنان admin-only است',
  revokeApi.indexOf("if($deleteIt && $role !== 'admin')")>-1 && core.indexOf("if(role()!=='admin'){alert('حذف پیشنهاد فقط برای ادمین مجاز است')")>-1);
T('یافته برنده بدون پرونده دکمه اصلاح برای نقش‌های مجاز دارد',
  core.indexOf("x.type==='orphan_won'&&canRepairOfferWin()")>-1 && core.indexOf('بازگرداندن کنترل‌شده به وضعیت قبل')>-1);
T('نقش غیرمجاز به‌جای ناپدیدشدن خاموش، علت محدودیت را می‌بیند',
  core.indexOf('اصلاح برد فقط برای ادمین یا رئیس هیئت‌مدیره فعال است؛ نقش فعلی:')>-1);

T('مسیر legacy دیگر offer/projects را مستقیم دست‌کاری نمی‌کند',
  unwinAlias.indexOf('setData(')===-1 && unwinAlias.indexOf('ptfRevokeOfferWin')>-1);
T('حذف legacy نیز به موتور حذف کنترل‌شده واگذار شده',
  backup.indexOf("ptfAdminHardDelete('offer', no")>-1);
T('خطای وابستگی در UI جزئیات را نشان می‌دهد و عملیات را ادامه نمی‌دهد',
  core.indexOf('این پیشنهاد وابستگی عملیاتی دارد و بازگشت خودکار متوقف شد')>-1 && core.indexOf('e.payload.dependencies')>-1);

console.log('\n'+p+' PASS / '+f+' FAIL');process.exit(f?1:0);
