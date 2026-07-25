/* tester124 — v20.8 (US-410: دستیار هوشمند ورود چک) */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var ch = fs.readFileSync(path.join(BASE, 'cheques.js'), 'utf-8');
var llm = fs.readFileSync(path.resolve(__dirname, '../../api/llm.php'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');

SECTION('نسخه و ثبت');
T('نسخه v20.8+', (function(){var m=idx.match(/var VER = 'v([0-9.]+)'/);return m&&parseFloat(m[1])>=20.8;})());
T('کش sw >= v20.8', (function(){var m=sw.match(/ptf-crm-v([0-9.]+)/);return m&&parseFloat(m[1])>=20.8;})());
T('cache-bust cheques >=20.8', (function(){var m=idx.match(/cheques\.js\?v=([0-9.]+)/);return m&&parseFloat(m[1])>=20.8;})());

SECTION('US-410 کد');
T('دکمه دستیار چک در باکس چک‌ها', ch.indexOf('chAiOpen()')>-1 && ch.indexOf('🤖 دستیار چک')>-1);
T('توابع دستیار چک', ['chAiOpen','chAiTextGo','chAiFileGo','chAiRender','chAiCommit'].every(function(x){return ch.indexOf(x)>-1;}));
T('LLM action cheque سمت سرور', llm.indexOf("case 'cheque'")>-1 && llm.indexOf('Iranian cheques')>-1);
T('تاریخ شمسی preview به ISO تبدیل می‌شود', ch.indexOf('chAiDueJ')>-1 && ch.indexOf('ptfJToISO')>-1);
T('مبلغ با ptfNum خوانده می‌شود', ch.indexOf('ptfNum')>-1 && ch.indexOf('data-money')>-1);

SECTION('رفتاری commit');
global.window = global;
global.chUpsertReminder = function () {};
global.curSession=function(){return {user:'u1',name:'حامد'};};
global.audit=function(m,a,r){global._audit={m:m,a:a,r:r};};
global.ptfToast=function(m,k){global._toast={m:m,k:k};};
global.renderReminders=function(){global._rr=true;};
global.ptfNum=function(v){return +String(v||'').replace(/[^\d.-]/g,'')||0;};
global.ptfJToISO=function(j){return j==='1405/06/15'?'2026-09-06':'';};
global.ptfISOToJ=function(iso){return iso==='2026-09-06'?'1405/06/15':'';};
var nodes={chAiNo:{value:'CHK-1'},chAiAmt:{value:'150,000,000'},chAiTo:{value:'شرکت الف'},chAiDueJ:{value:'1405/06/15'},chAiBank:{value:'ملت'},chAiNote:{value:'بابت خرید'},chAiDlg:{remove:function(){global._removed=true;}}};
global.document={getElementById:function(id){return nodes[id]||null;},querySelector:function(){return {remove:function(){}};},querySelectorAll:function(){return[];}};
function chAll(){return getData('ptf_crm_cheques');} function chSave(l){setData('ptf_crm_cheques',l);} function chDaysTo(){return 1;} function refreshBox(){global._refresh=true;}
var m=ch.match(/window\.chAiCommit = function[\s\S]*?\n  \};/);
T('chAiCommit استخراج شد', !!m);
if(m){eval(m[0]); setData('ptf_crm_cheques', []); chAiCommit(); var c=getData('ptf_crm_cheques')[0]; T('چک AI با dueISO/dueFa/src ذخیره شد', c && c.no==='CHK-1' && c.amt===150000000 && c.dueISO==='2026-09-06' && c.dueFa==='1405/06/15' && c.src==='ai-cheque');}

DONE('tester124-v208');
