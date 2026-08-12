#!/usr/bin/env node
var fs=require('fs');var path=require('path');
var root=path.join(__dirname,'../..');
function read(p){return fs.readFileSync(path.join(root,p),'utf8');}
function fail(m){console.log('FAIL '+m);process.exit(1);}
var ver=JSON.parse(read('VERSION.json'));
if(ver.crm_version!=='v34.4.70') fail('VERSION '+ver.crm_version);
var pe=read('crm/petty.js');
var st=read('crm/storage.js');
if(pe.indexOf("mode: 'inline'")<0) fail('resolve inline');
if(pe.indexOf('ptfPettyFileKind = function (name, extra)')<0) fail('kind extra');
if(pe.indexOf('هاست Imagick ندارد')<0) fail('client first');
if(pe.indexOf("mode: 'base64'")>-1 && pe.indexOf("JSON.stringify({ key: f.key, name: f.name || f.key, mode: 'base64' })")>-1) fail('still base64 primary');
if(st.indexOf("data:application/pdf")<0) fail('raster pdf mime');
console.log('PASS tester364 combined-convert');
