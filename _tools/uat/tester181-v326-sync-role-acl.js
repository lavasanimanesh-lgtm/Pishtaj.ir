/* P0 BUG-SYNC-ROLE-ACL — authenticated role-scoped CRM sync */
'use strict';
require('./harness');
var fs=require('fs'),path=require('path');
var ROOT=path.resolve(__dirname,'../..');
var api=fs.readFileSync(path.join(ROOT,'api/crm.php'),'utf8');
var sy=fs.readFileSync(path.join(ROOT,'crm/sync.js'),'utf8');
SECTION('server role-scoped sync');
T('sync transport از finance ACL جدا شده', api.indexOf("'sync_read'")>-1 && api.indexOf("'sync_write'")>-1 && api.indexOf("'data_push'=>'sync_write'")>-1 && api.indexOf("'data_pull'=>'sync_read'")>-1);
T('senior roles full sync دارند', api.indexOf("['admin','chairman','ceo','commercial']")>-1 && api.indexOf('sync_allowed_keys_for_role')>-1);
T('sales/buyer/accountant allowlist جدا دارند', api.indexOf("if ($role === 'accountant') return $accountant")>-1 && api.indexOf("if ($role === 'collector') return $collector")>-1 && api.indexOf('if ($role === \'buyer\')')>-1 && api.indexOf('return $crm; // sales')>-1);
T('data_push کلید forbidden را ذخیره نمی‌کند', api.indexOf('$forbidden_keys')>-1 && api.indexOf('if (!in_array($k, $role_sync_keys, true))')>-1);
T('data_pull خروجی را با role filter می‌کند', api.indexOf('if (!in_array($k, $allowed_keys, true) || !in_array($k, $role_sync_keys, true)) continue;')>-1);
T('پاسخ server forbidden/role را اعلام می‌کند', api.indexOf("'forbidden' => array_values(array_unique($forbidden_keys))")>-1 && api.indexOf("'role' => $client_role")>-1);

SECTION('client contract');
T('client قبل از push allowlist نقش را فیلتر می‌کند', sy.indexOf('function syncAllowedKey(k)')>-1 && sy.indexOf('forbiddenLocal')>-1);
T('client 403/forbidden را silent نمی‌کند', sy.indexOf("setSyncBadge('forbidden')")>-1 && sy.indexOf('SYNC-RBAC')>-1);
T('کلیدهای مالی در allowlist sales نیستند', sy.indexOf('sales: [')>-1 && sy.indexOf("sales: ['ptf_crm_rfqs'")>-1 && sy.indexOf("sales: ['ptf_crm_rfqs','ptf_crm_suppliers','ptf_crm_customers','ptf_crm_products','ptf_crm_offers','ptf_crm_leads','ptf_crm_reminders','ptf_crm_buyquotes','ptf_crm_surplus'")>-1 && sy.indexOf("sales: ['ptf_crm_rfqs','ptf_crm_suppliers','ptf_crm_customers','ptf_crm_products','ptf_crm_offers','ptf_crm_leads','ptf_crm_reminders','ptf_crm_buyquotes','ptf_crm_surplus','ptf_crm_notifs'")>-1);
DONE('tester181-v326-sync-role-acl');
