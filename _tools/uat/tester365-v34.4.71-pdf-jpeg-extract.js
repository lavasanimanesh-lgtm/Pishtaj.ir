#!/usr/bin/env node
var fs=require('fs');var path=require('path');
var root=path.join(__dirname,'../..');
function read(p){return fs.readFileSync(path.join(root,p),'utf8');}
function fail(m){console.log('FAIL '+m);process.exit(1);}
var ver=JSON.parse(read('VERSION.json'));
if(ver.crm_version!=='v34.4.71') fail('VERSION '+ver.crm_version);
var st=read('crm/storage.js');
var pe=read('crm/petty.js');
var ar=read('api/attachment-read.php');
if(st.indexOf('ptfExtractEmbeddedJpegs')<0) fail('extract');
if(st.indexOf('0xFF && u8[i + 1] === 0xD8')<0) fail('soi');
if(ar.indexOf('if ($ext === \'\') $ext = ext_of($key);')<0) fail('ext key');
if(pe.indexOf('در حال تبدیل سند')<0) fail('seq convert');
console.log('PASS tester365 pdf-jpeg-extract');
