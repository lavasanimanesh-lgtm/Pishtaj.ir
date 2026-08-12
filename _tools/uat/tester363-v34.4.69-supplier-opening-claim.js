#!/usr/bin/env node
var fs=require('fs');var path=require('path');
var root=path.join(__dirname,'../..');
function read(p){return fs.readFileSync(path.join(root,p),'utf8');}
function fail(m){console.log('FAIL '+m);process.exit(1);}
var ver=JSON.parse(read('VERSION.json'));
if(ver.crm_version!=='v34.4.69') fail('VERSION '+ver.crm_version);
var sf=read('crm/supplier-finance.js');
if(sf.indexOf("typ = isOpen ? 'مانده افتتاحیه'")<0 && sf.indexOf("isOpen ? 'مانده افتتاحیه'")<0) fail('opening type');
if(sf.indexOf('مانده افتتاحیه')<0) fail('opening label');
if(sf.indexOf('slClaimAsOfHtml')<0) fail('claim html');
if(sf.indexOf('مطالبه تأمین‌کننده در تاریخ گزارش')<0) fail('claim label');
if(sf.indexOf('slClaimAsOfCsv')<0) fail('claim csv');
if(sf.indexOf('slPrintRows(rows)+slClaimAsOfHtml')<0) fail('print footer');
console.log('PASS tester363 supplier-opening-claim');
