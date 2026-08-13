#!/usr/bin/env node
var fs=require('fs');var path=require('path');
var root=path.join(__dirname,'../..');
function read(p){return fs.readFileSync(path.join(root,p),'utf8');}
function fail(m){console.log('FAIL '+m);process.exit(1);}
var ver=JSON.parse(read('VERSION.json'));
var vm4 = String(ver.crm_version).match(/^v(\d+)\.(\d+)\.(\d+)$/);
if (!vm4 || +vm4[1] < 34 || (+vm4[1] === 34 && +vm4[2] < 4) || (+vm4[1] === 34 && +vm4[2] === 4 && +vm4[3] < 73)) fail('VERSION ' + ver.crm_version);
var st=read('crm/storage.js');
var pe=read('crm/petty.js');
if(st.indexOf('ptfZipFromFiles')<0) fail('zip helper');
if(st.indexOf('0x50, 0x4B, 0x03, 0x04')<0) fail('local header');
if(pe.indexOf('ZIP فیش‌های پیوست')<0) fail('button');
if(pe.indexOf('ptfZipFromFiles')<0) fail('petty uses zip');
if(pe.indexOf('row-')<0) fail('row folder');
console.log('PASS tester367 receipts-zip');
