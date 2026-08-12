#!/usr/bin/env node
var fs=require('fs');var path=require('path');
var root=path.join(__dirname,'../..');
function read(p){return fs.readFileSync(path.join(root,p),'utf8');}
function fail(m){console.log('FAIL '+m);process.exit(1);}
var s=read('crm/sync.js');
var p=read('crm/petty.js');
var t=read('crm/treasury.js');
var ver=JSON.parse(read('VERSION.json'));
if(ver.crm_version!=='v34.4.65') fail('VERSION '+ver.crm_version);
if(s.indexOf('window.ptfSyncFlushNow')<0) fail('flush');
if(s.indexOf('window.ptfConfirmCloudSave')<0) fail('confirm');
if(s.indexOf('هنوز به سرور نرسیده')<0) fail('banner dirty always');
if(s.indexOf('ev.preventDefault()')<0) fail('beforeunload');
if(p.indexOf('ptfConfirmCloudSave')<0) fail('petty confirm');
if(t.indexOf('ptfConfirmCloudSave')<0) fail('treasury confirm');
console.log('PASS tester358 honest-sync');
