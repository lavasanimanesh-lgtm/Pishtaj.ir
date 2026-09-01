#!/usr/bin/env node
'use strict';
/* v34.7.11 — disaster recovery: server backups must actually restore purged data */
var fs=require('fs'),path=require('path');var ROOT=path.resolve(__dirname,'../..');
function read(p){return fs.readFileSync(path.join(ROOT,p),'utf8');}
function section(src,from,to){var a=src.indexOf(from),b=src.indexOf(to,a+from.length);return a<0?'':src.slice(a,b<0?src.length:b);}
var ui=read('crm/backup.js'),api=read('api/crm.php');
var fetchSec=section(ui,'function backupFetch','function backupStoreLocalFallback');
var restore=section(ui,'function doRestore','/* ============ AC3');
var push=section(api,"case 'data_push':", "case 'data_pull':");
var p=0,f=0;function T(n,c,d){if(c){p++;console.log('PASS',n);}else{f++;console.error('FAIL',n,d||'');}}

T('backupFetch پاسخ را text→JSON امن parse می‌کند',fetchSec.indexOf('r.text().then')>-1&&fetchSec.indexOf('پاسخ نامعتبر بک‌آپ')>-1);
T('فایل backup خام بدون ok:true پذیرفته می‌شود',fetchSec.indexOf('d.ok === false')===-1&&fetchSec.indexOf('return d')>-1);
T('restore برای admin و chairman مجاز است',ui.indexOf("['admin','chairman'].indexOf(curRole())")>-1&&ui.indexOf('ptfCanRestoreBackup')>-1);
T('دکمه restore سرور از همان policy استفاده می‌کند',ui.indexOf("canRestoreBackup() ? '<button")>-1&&ui.indexOf('window.ptfRestoreServer')>-1);
T('فهرست بک‌آپ loading و خطای قابل مشاهده دارد',ui.indexOf('ptfServerBackupsDlg')>-1&&ui.indexOf('در حال دریافت فهرست از سرور')>-1&&ui.indexOf('تلاش دوباره')>-1);
T('راهنما هشدار می‌دهد hourly ممکن است بعد حادثه باشد',ui.indexOf('hourly-latest ممکن است بعد از حادثه بازنویسی شده باشد')>-1);
T('API فهرست را جدیدترین به قدیمی‌ترین sort می‌کند',api.indexOf("usort($out, function($a,$b)")>-1);
T('preview تعداد پرونده فعال/بایگانی/پیشنهاد دارد',ui.indexOf("dealCount=backupRows('ptf_crm_deals')")>-1&&ui.indexOf('پرونده فعال:')>-1&&ui.indexOf('پیشنهاد:')>-1);

T('قبل restore وضعیت جاری فقط local prerestore می‌شود',restore.indexOf('ptf_backup_prerestore')>-1);
T('restore دیگر backup خراب جاری را روی hourly/daily push نمی‌کند',restore.indexOf('pushBackup(false')===-1&&restore.indexOf('(function () {')>-1);
T('server failure داده محلی قبلی را rollback می‌کند',restore.indexOf('function restorePreviousLocal')>-1&&restore.indexOf('restorePreviousLocal(); alert')>-1);
T('موفقیت فقط با d.ok واقعی اعلام می‌شود',restore.indexOf("if (!d || !d.ok) throw new Error")>-1);
T('restore payload فلگ صریح restore:true دارد',restore.indexOf('restore: true')>-1);

T('server restore فقط admin/chairman است',push.indexOf("!in_array($client_role, ['admin','chairman'], true)")>-1&&push.indexOf('restore_permission_denied')>-1);
T('restore snapshot را authoritative و tombstone جدیدتر را کنار می‌گذارد',push.indexOf("$restore ? '' : $serverArchiveJson")>-1);
T('restore از duplicate-offer guard عادی عبور می‌کند',push.indexOf("if (!$restore && $k === 'ptf_crm_offers')")>-1);
T('restore از conflict و zero-wipe guard قبلی نیز عبور می‌کند',push.indexOf('if (!$restore && !$allow_wipe')>-1&&push.indexOf('if (!$allow_wipe && !$restore && !$isSharedUnion)')>-1); /* v34.25.0: سپر داده‌صفر برای کلیدهای shared-union غیرفعال (RCA avatars) */
T('get_backup همچنان path whitelist و role guard دارد',api.indexOf("case 'get_backup':")>-1&&api.indexOf("role_guard('users_write')")>-1&&api.indexOf('basename(clean($_REQUEST')>-1);

console.log('\n'+p+' PASS / '+f+' FAIL');process.exit(f?1:0);
