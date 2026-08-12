#!/usr/bin/env node
var fs=require('fs');var path=require('path');
var root=path.join(__dirname,'../..');
function read(p){return fs.readFileSync(path.join(root,p),'utf8');}
function fail(m){console.log('FAIL '+m);process.exit(1);}
var ver=JSON.parse(read('VERSION.json'));
if(ver.crm_version!=='v34.4.68') fail('VERSION '+ver.crm_version);
var ox=read('crm/opex.js');
if(/\}\)\(\);\s*\);\s*$/.test(ox)) fail('opex trailing garbage');
var fx=read('crm/fx.js');
if(fx.indexOf('ptfSalesFileOffers')<0) fail('profit uses all file offers');
if(fx.indexOf('officialByOffer')<0) fail('skip unofficial when official exists');
console.log('PASS tester359 margin-opex');
