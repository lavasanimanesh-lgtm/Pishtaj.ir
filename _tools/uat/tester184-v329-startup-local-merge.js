/* Startup must preserve local records created before sync.js loaded */
'use strict';
require('./harness');
var fs=require('fs'),path=require('path');
var ROOT=path.resolve(__dirname,'../..');
var sy=fs.readFileSync(path.join(ROOT,'crm/sync.js'),'utf8');
SECTION('BUG-SYNC-LOCAL-LOSS');
T('state initialReconcile دارد', sy.indexOf('initialReconcile: false')>-1);
T('startup قبل از full pull reconcile را فعال می‌کند', sy.indexOf('state.initialReconcile = true;')>-1 && sy.indexOf('pullCheck(function () { state.initialReconcile = false;')>-1);
T('forceFull local/server را حتی بدون dirty merge می‌کند', sy.indexOf('if (forceFull && state.initialReconcile && curStr')>-1 && sy.indexOf('startupMerged = window.ptfSmartMerge')>-1);
T('نتیجه merge به dirty می‌رود تا server union push شود', sy.indexOf('state.dirty[k] = true;')>-1 && sy.indexOf('v31.7.2 BUG-SYNC-LOCAL-LOSS')>-1);
T('overwrite مستقیم بعد از startup merge نیست', sy.indexOf('localStorage.setItem(k, newStr);')>-1 && sy.indexOf('if (forceFull && state.initialReconcile')<sy.indexOf('localStorage.setItem(k, newStr);'));
T('duplicate RFQ/offer در smart merge collapse نمی‌شود', sy.indexOf('function ptfMergeNoCollapse')>-1 && sy.indexOf("key === 'ptf_crm_rfqs' || key === 'ptf_crm_offers'")>-1 && sy.indexOf('rem.forEach(add); loc.forEach(add);')>-1);
DONE('tester184-v329-startup-local-merge');
