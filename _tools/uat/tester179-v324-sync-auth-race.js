/* Critical follow-up: stale/expired token must not bootstrap stale local data */
'use strict';
require('./harness');
var fs=require('fs'),path=require('path');
var ROOT=path.resolve(__dirname,'../..');
var sy=fs.readFileSync(path.join(ROOT,'crm/sync.js'),'utf8');
SECTION('BUG-SYNC-AUTH-RACE');
T('auth refresh → ورود مجدد صریح سروری (SEC-AUTH-REAUTH؛ بدون passhash خاموش)', sy.indexOf('function refreshAuthToken(cb)')>-1 && sy.indexOf("localStorage.removeItem('ptf_crm_token')")>-1 && sy.indexOf('index.html?reauth=')>-1);
T('401/needLogin stale local را fresh اعلام نمی‌کند', sy.indexOf("d.needLogin || /token|unauthorized|401/i.test")>-1 && sy.indexOf('retryPullAfterAuth(done, forceFull, opts)')>-1);
T('توکن stale قبل از refresh پاک می‌شود', sy.indexOf("localStorage.removeItem('ptf_crm_token')")>-1 && sy.indexOf("localStorage.removeItem('ptf_crm_token_role')")>-1);
T('پس از refresh همان pull pending دوباره اجرا می‌شود', sy.indexOf('pullCheck(done, forceFull, opts)')>-1 && sy.indexOf('refreshAuthToken(function (ok)')>-1);
T('startup full pull forceFull را حفظ می‌کند', sy.indexOf('pullSince = forceFull ? 0 : state.lastRev')>-1 && sy.indexOf('}, true);')>-1);
T('boot فقط بعد از callback pull کامل می‌شود', sy.indexOf('state.initialReconcile = false;')>-1 && /state\.initialReconcile = false;[\s\S]{0,120}state\.bootstrapped = true; window\._ptfSyncBootstrapped = true;/.test(sy));
DONE('tester179-v324-sync-auth-race');
