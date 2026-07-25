/* FIN-WF-004 remainder — customer invoice, receipt and shareholder mutation guards */
'use strict';
require('./harness');
var fs=require('fs'),path=require('path');
var BASE=path.resolve(__dirname,'../../crm');
var rb=fs.readFileSync(path.join(BASE,'rbac.js'),'utf8');
var fc=fs.readFileSync(path.join(BASE,'fiscal.js'),'utf8');
var sh=fs.readFileSync(path.join(BASE,'shareholders.js'),'utf8');
var idx=fs.readFileSync(path.join(BASE,'index.html'),'utf8');
var sw=fs.readFileSync(path.join(BASE,'sw.js'),'utf8');
SECTION('نسخه و ساختار');
T('نسخه v31.6+', (function(){var m=idx.match(/var VER = 'v([0-9.]+)'/);return m&&parseFloat(m[1])>=31.6;})());
T('fiscal helper خروجی دارد', fc.indexOf('window.ptfFiscalYearLocked = function')>-1);
T('ثبت invoice سال قفل‌شده guard دارد', rb.indexOf('ثبت فاکتور در آن سال مجاز نیست')>-1 && rb.indexOf('ptfFiscalYearLocked(invYear)')>-1);
T('ثبت receipt سال قفل‌شده guard دارد', rb.indexOf('ثبت وصولی مستقیم در آن سال مجاز نیست')>-1 && rb.indexOf('ptfFiscalYearLocked(invYear)')>-1);
T('سهامداران guard سال دارند', sh.indexOf('function shareYearLocked(month)')>-1 && sh.indexOf('ثبت حقوق در آن سال مجاز نیست')>-1 && sh.indexOf('ثبت برداشت در آن سال مجاز نیست')>-1);
T('سال قفل‌شده از مسیر اصلاحی جدا می‌ماند', fc.indexOf('window.ptfFiscalAmendCommit')>-1 && sh.indexOf('shareYearLocked(month)')>-1);
DONE('tester164-v3165-fiscal-guards');
