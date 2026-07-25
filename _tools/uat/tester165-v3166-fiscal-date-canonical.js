/* FIN-WF-007 — canonical fiscal year extraction for Latin/Persian/Arabic digits */
'use strict';
require('./harness');
var fs=require('fs'),path=require('path');
var BASE=path.resolve(__dirname,'../../crm');
var fc=fs.readFileSync(path.join(BASE,'fiscal.js'),'utf8');
var br=fs.readFileSync(path.join(BASE,'bridge.js'),'utf8');
var rb=fs.readFileSync(path.join(BASE,'rbac.js'),'utf8');
var idx=fs.readFileSync(path.join(BASE,'index.html'),'utf8');
SECTION('ساختار');
T('helper سال مالی canonical export شده', fc.indexOf('window.ptfFiscalYearOf = fiscalYearOf')>-1 && fc.indexOf('replace(/[۰-۹]/g')>-1 && fc.indexOf('replace(/[٠-٩]/g')>-1);
T('fiscal از helper مشترک استفاده می‌کند', fc.indexOf('function yearOf(s) { return fiscalYearOf(s); }')>-1);
T('orphan purge از helper مشترک استفاده می‌کند', br.indexOf('ptfFiscalYearOf(d)')>-1);
T('invoice/reversal guard از helper استفاده می‌کند', rb.indexOf('ptfFiscalYearOf(invDate)')>-1 && rb.indexOf('ptfFiscalYearOf(rawDate)')>-1);
SECTION('رفتار helper');
global.window=global; global.getData=function(){return[];}; global.setData=function(){};
var m=fc.match(/function fiscalYearOf\(s\) \{[\s\S]*?\n  \}/);
T('استخراج helper',!!m);
if(m){ eval(m[0].replace('function fiscalYearOf','global.ptfFiscalYearOf = function')); T('لاتین 1405',ptfFiscalYearOf('1405/04/20')==='1405'); T('فارسی ۱۴۰۵',ptfFiscalYearOf('۱۴۰۵/۰۴/۲۰')==='1405'); T('عربی ١٤٠٥',ptfFiscalYearOf('١٤٠٥/٠٤/٢٠')==='1405'); T('بدون سال خالی',ptfFiscalYearOf('bad date')===''); }
DONE('tester165-v3166-fiscal-date-canonical');
