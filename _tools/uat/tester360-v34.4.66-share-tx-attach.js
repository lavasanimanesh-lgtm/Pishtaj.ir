#!/usr/bin/env node
var fs=require('fs');var path=require('path');
var root=path.join(__dirname,'../..');
function read(p){return fs.readFileSync(path.join(root,p),'utf8');}
function fail(m){console.log('FAIL '+m);process.exit(1);}
var ver=JSON.parse(read('VERSION.json'));
var vm4 = String(ver.crm_version).match(/^v(\d+)\.(\d+)\.(\d+)$/);
if (!vm4 || +vm4[1] < 34 || (+vm4[1] === 34 && +vm4[2] < 4) || (+vm4[1] === 34 && +vm4[2] === 4 && +vm4[3] < 68)) fail('VERSION ' + ver.crm_version);
var s=read('crm/shareholders.js');
if(s.indexOf('ptfShareTxAttachOpen')<0) fail('attach open');
if(s.indexOf("type: 'upload'")<0) fail('upload on pay');
if(s.indexOf('sharetx/')<0) fail('folder');
if(s.indexOf('<th>سند</th>')<0) fail('ledger col');
console.log('PASS tester360 share-tx-attach');
