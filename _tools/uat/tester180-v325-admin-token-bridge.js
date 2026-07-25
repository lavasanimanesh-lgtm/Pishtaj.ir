/* Critical follow-up: admin token bootstrap must not depend on ptf_crm_users */
'use strict';
require('./harness');
var fs=require('fs'),path=require('path');
var ROOT=path.resolve(__dirname,'../..');
var sy=fs.readFileSync(path.join(ROOT,'crm/sync.js'),'utf8');
var idx=fs.readFileSync(path.join(ROOT,'crm/index.html'),'utf8');
SECTION('BUG-SYNC-ADMIN-TOKEN');
T('showCrm برای admin از ADMIN_HASH/settings fallback می‌گیرد', idx.indexOf("if(!ph && sess.user === ADMIN_USER)")>-1 && idx.indexOf('ast.adminHash || ADMIN_HASH')>-1);
T('sync refresh برای admin به ptf_crm_users وابسته نیست', sy.indexOf("if (!passhash && sess.user === 'admin')")>-1 && sy.indexOf('ast.adminHash')>-1 && sy.indexOf("typeof ADMIN_HASH !== 'undefined'")>-1);
T('auth_login با passhash fallback ارسال می‌شود', sy.indexOf("encodeURIComponent(passhash)")>-1);
T('401 مسیر auth refresh را نگه می‌دارد', sy.indexOf('retryPullAfterAuth(done, forceFull)')>-1 && sy.indexOf('refreshAuthToken(function (ok)')>-1);
DONE('tester180-v325-admin-token-bridge');
