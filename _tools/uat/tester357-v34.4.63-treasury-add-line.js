#!/usr/bin/env node
var fs=require('fs');var path=require('path');
var root=path.join(__dirname,'../..');
function read(p){return fs.readFileSync(path.join(root,p),'utf8');}
function fail(m){console.log('FAIL '+m);process.exit(1);}
var t=read('crm/treasury.js');
var ver=JSON.parse(read('VERSION.json'));
if(ver.crm_version!=='v34.4.64') fail('VERSION '+ver.crm_version);
if(t.indexOf("title: 'ردیف صورتحساب بانک'")<0) fail('dialog');
if(t.indexOf('parseAmt(v.amt)')<0) fail('fa digits');
if(t.indexOf('ptfConfirmCloudSave')<0) fail('toast');
console.log('PASS tester357 treasury-add-line');
