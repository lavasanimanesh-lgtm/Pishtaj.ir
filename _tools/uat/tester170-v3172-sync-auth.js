/* Production auth hotfix follow-up — data_pull must carry token and wait for login */
'use strict';
require('./harness');
var fs=require('fs'),path=require('path');
var BASE=path.resolve(__dirname,'../../crm');
var sy=fs.readFileSync(path.join(BASE,'sync.js'),'utf8');
var idx=fs.readFileSync(path.join(BASE,'index.html'),'utf8');
var api=fs.readFileSync(path.resolve(__dirname,'../../api/crm.php'),'utf8');
SECTION('ساختار');
T('sync header helper دارد', sy.indexOf('function authHeaders(json)')>-1 && sy.indexOf("X-CRM-Token")>-1);
T('data_pull token ارسال می‌کند', /'\?action=data_pull&since=' \+ pullSince/.test(sy) && /fetch\((pullUrl|API \+ '\?action=data_pull&since=' \+ pullSince), \{ headers: authHeaders\(false\) \}\)/.test(sy) && sy.indexOf('var pullSince = forceFull ? 0 : state.lastRev')>-1);
T('push از همان token helper استفاده می‌کند', sy.indexOf('headers: authHeaders(true)')>-1);
T('pull قبل از token/401 با refresh auth retry کنترل‌شده دارد', sy.indexOf('retryPullAfterAuth(done, forceFull)')>-1 && sy.indexOf('ptfSyncRefreshAuth')>-1 && sy.indexOf("action=auth_login")>-1);
T('auth_login بدون token اولیه مجاز است', api.indexOf("$SENSITIVE[$action] !== 'none'")>-1);
T('نسخهٔ runtime marker موجود است', /window\.VER = 'v\d+(?:\.\d+)+/.test(idx));
DONE('tester170-v3172-sync-auth');
