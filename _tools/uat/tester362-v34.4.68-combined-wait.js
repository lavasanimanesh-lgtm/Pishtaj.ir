#!/usr/bin/env node
var fs=require('fs');var path=require('path');
var root=path.join(__dirname,'../..');
function read(p){return fs.readFileSync(path.join(root,p),'utf8');}
function fail(m){console.log('FAIL '+m);process.exit(1);}
var ver=JSON.parse(read('VERSION.json'));
if(ver.crm_version!=='v34.4.68') fail('VERSION '+ver.crm_version);
var pe=read('crm/petty.js');
if(pe.indexOf('ptfPettyWaitShow')<0) fail('wait show');
if(pe.indexOf('در حال آماده‌سازی گزارش تلفیقی')<0) fail('msg');
if(pe.indexOf('_ptfPettyCombinedBusy')<0) fail('busy');
console.log('PASS tester362 combined-wait');
