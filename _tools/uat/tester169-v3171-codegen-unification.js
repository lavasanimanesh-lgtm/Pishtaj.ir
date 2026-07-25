/* TECHDEBT-005 — AI Workbench must use the global unified code generator */
'use strict';
require('./harness');
var fs=require('fs'),path=require('path');
var BASE=path.resolve(__dirname,'../../crm');
var ai=fs.readFileSync(path.join(BASE,'ai-workbench.js'),'utf8');
var idx=fs.readFileSync(path.join(BASE,'index.html'),'utf8');
var sw=fs.readFileSync(path.join(BASE,'sw.js'),'utf8');
SECTION('ساختار');
T('AI Workbench generator محلی موازی ندارد', ai.indexOf('function genCode(')===-1 && ai.indexOf('window.ptfUnifiedCode')>-1);
T('موتور unified در index global است', idx.indexOf('window.ptfUnifiedCode = function (prefix)')>-1 && idx.indexOf("function genCode(p) { return window.ptfUnifiedCode(p); }")>-1);
T('کدهای AI از genCode واحد استفاده می‌کنند', (ai.match(/genCode\('/g)||[]).length >= 8);
T('fallback random در تعریف generator حذف شده', ai.indexOf("p+'-'+Math.floor(1000+Math.random()*9000)")===-1);
T('نسخه و cache هم‌راستا هستند', /window\.VER = 'v\d+(?:\.\d+)+/.test(idx) && /ptf-crm-v\d+(?:\.\d+)+/.test(sw));
DONE('tester169-v3171-codegen-unification');
