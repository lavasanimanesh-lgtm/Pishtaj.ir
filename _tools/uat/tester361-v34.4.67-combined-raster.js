#!/usr/bin/env node
var fs=require('fs');var path=require('path');
var root=path.join(__dirname,'../..');
function read(p){return fs.readFileSync(path.join(root,p),'utf8');}
function fail(m){console.log('FAIL '+m);process.exit(1);}
var ver=JSON.parse(read('VERSION.json'));
var vm4 = String(ver.crm_version).match(/^v(\d+)\.(\d+)\.(\d+)$/);
if (!vm4 || +vm4[1] < 34 || (+vm4[1] === 34 && +vm4[2] < 4) || (+vm4[1] === 34 && +vm4[2] === 4 && +vm4[3] < 68)) fail('VERSION ' + ver.crm_version);
var st=read('crm/storage.js');
var pe=read('crm/petty.js');
var ar=read('api/attachment-read.php');
if(st.indexOf('ptfRasterizeCloudFile')<0) fail('raster helper');
if(st.indexOf('ptfRasterizePdfBlob')<0) fail('pdf raster');
if(pe.indexOf('ptfRasterizeCloudFile')<0) fail('petty uses client raster');
if(ar.indexOf("'heic'=>'image/heic'")<0) fail('read heic');
console.log('PASS tester361 combined-raster');
