#!/usr/bin/env node
var fs=require('fs');var path=require('path');
var root=path.join(__dirname,'../..');
function read(p){return fs.readFileSync(path.join(root,p),'utf8');}
function fail(m){console.log('FAIL '+m);process.exit(1);}
var ver=JSON.parse(read('VERSION.json'));
if(ver.crm_version!=='v34.4.67') fail('VERSION '+ver.crm_version);
var s=read('crm/shareholders.js');
if(s.indexOf('ptfShareTxAttachOpen')<0) fail('attach open');
if(s.indexOf("type: 'upload'")<0) fail('upload on pay');
if(s.indexOf('sharetx/')<0) fail('folder');
if(s.indexOf('<th>سند</th>')<0) fail('ledger col');
console.log('PASS tester360 share-tx-attach');
