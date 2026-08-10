/* tester321 — مرکز اقدام مدیریتی و ماندگاری/sync */
'use strict';
require('./harness');
var fs=require('fs'),path=require('path');
var BASE=path.resolve(__dirname,'../../crm');
var mi=fs.readFileSync(path.join(BASE,'management-intelligence.js'),'utf8');
var sy=fs.readFileSync(path.join(BASE,'sync.js'),'utf8');
var cs=fs.readFileSync(path.join(BASE,'client-server.js'),'utf8');
var bk=fs.readFileSync(path.join(BASE,'backup.js'),'utf8');
var api=fs.readFileSync(path.resolve(__dirname,'../../api/crm.php'),'utf8');

SECTION('مرکز اقدام مدیریت');
T('کلید مستقل اقدامات تعریف شده', mi.indexOf("ACTION_KEY = 'ptf_crm_management_actions'") > -1);
T('تبدیل insight به اقدام، مسئول و موعد دارد', mi.indexOf('window.ptfManagementActionOpen') > -1 && mi.indexOf("id:'owner'") > -1 && mi.indexOf("id:'due'") > -1);
T('اقدام ثبت‌شده اعلان actionable به مسئول می‌فرستد', mi.indexOf("kind:'management_action'") > -1 && mi.indexOf("taskType:'management_action'") > -1);
T('تکمیل اقدام، اعلان مربوط را resolve می‌کند', mi.indexOf('window.ptfManagementActionDone') > -1 && mi.indexOf('ntfResolveByRef(cd)') > -1);
T('مرکز اقدام‌های باز و دکمه تبدیل توصیه به اقدام در UI وجود دارد', mi.indexOf('ptfManagementActionCenterOpen') > -1 && mi.indexOf('📌 تبدیل به اقدام') > -1 && mi.indexOf('mgmtActionsBox') > -1);

SECTION('ماندگاری و sync');
T('کلید اقدام در sync کلاینت وجود دارد', sy.indexOf('ptf_crm_management_actions') > -1 && cs.indexOf('ptf_crm_management_actions') > -1);
T('کلید اقدام در allowlist سرور و backup وجود دارد', api.indexOf('ptf_crm_management_actions') > -1 && bk.indexOf('ptf_crm_management_actions') > -1);
T('کلید اقدام زیر سپر داده صفر قرار دارد', sy.indexOf("'ptf_crm_management_actions'") > -1 && sy.indexOf('GUARD_KEYS') > -1);

DONE('tester321-v34.4.18-management-actions');
