#!/usr/bin/env node
var fs=require('fs');var path=require('path');
var root=path.join(__dirname,'../..');
function read(p){return fs.readFileSync(path.join(root,p),'utf8');}
function fail(m){console.log('FAIL '+m);process.exit(1);}
var ver=JSON.parse(read('VERSION.json'));
if(ver.crm_version!=='v34.4.72') fail('VERSION '+ver.crm_version);
var th=read('api/attachment-thumb.php');
var st=read('crm/storage.js');
var pe=read('crm/petty.js');
if(th.indexOf('extract_embedded_jpegs')<0) fail('php extract');
if(th.indexOf('class_exists(\'Imagick\')')<0) fail('imagick optional');
if(th.indexOf('generateContent')>-1) fail('no llm in raster');
if(st.indexOf('ptfPersistFilePreview')<0) fail('persist');
if(st.indexOf('ptfServerRasterFile')<0) fail('server raster');
if(pe.indexOf('ptfServerRasterFile')<0) fail('petty server first');
if(pe.indexOf('previews/')<0) fail('skip cached');
console.log('PASS tester366 preview-replace');
