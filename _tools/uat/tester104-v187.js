/* tester104 — v18.7 (US-430: تعهد تحویل تامین‌کننده هنگام خرید + اثر در امتیازدهی) */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var bc = fs.readFileSync(path.join(BASE, 'buycompare.js'), 'utf-8');
var sc = fs.readFileSync(path.join(BASE, 'scoring.js'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');

SECTION('نسخه و ثبت');
T('نسخه v18.7+', (function(){var m=idx.match(/var VER = 'v([0-9.]+)'/);return m&&parseFloat(m[1])>=18.7;})());
T('کش sw >= v18.7', (function(){var m=sw.match(/ptf-crm-v([0-9.]+)/);return m&&parseFloat(m[1])>=18.7;})());
T('cache-bust buycompare/scoring >=18.7', ['buycompare.js','scoring.js'].every(function(f){var m=idx.match(new RegExp(f.replace('.', '\\.')+'\\?v=([0-9.]+)'));return m&&parseFloat(m[1])>=18.7;}));

SECTION('کد US-430');
T('فرم خرید واقعی فیلد تاریخ تعهد تحویل تامین‌کننده دارد', bc.indexOf('تاریخ تحویل تعهدشده تامین‌کننده')>-1 && bc.indexOf("id: 'dueISO'")>-1);
T('خرید واقعی dueISO/dueNote را در purchase ذخیره می‌کند', bc.indexOf("dueISO: v.dueISO || ''")>-1 && bc.indexOf("dueNote: v.dueNote || ''")>-1);
T('بستانکاری تامین‌کننده dueISO/dueNote دریافت می‌کند', bc.indexOf("dueISO: v.dueISO || ''")>-1 && bc.indexOf('ptfPayableUpsert')>-1);
T('نمای purchase تعهد تحویل را نشان می‌دهد', bc.indexOf('تعهد تحویل:')>-1);
T('payables dueISO/dlvISO/dlvLate دارد', sc.indexOf('dueISO')>-1 && sc.indexOf('dlvISO')>-1 && sc.indexOf('dlvLate')>-1);
T('ثبت رویداد تحویل، تاخیر نسبت به تعهد را محاسبه می‌کند', sc.indexOf('p.dlvLate = !!(p.dueISO && p.dlvISO && p.dlvISO > p.dueISO)')>-1);
T('امتیاز کیفیت تحویل تاخیر را نیم‌امتیاز کم می‌کند', sc.indexOf('dLate * 0.5')>-1 && sc.indexOf('تعهد ثبت‌شده')>-1);

SECTION('رفتاری: امتیاز تحویل با تعهد');
global.window = global;
global.curRole=function(){return 'chairman';};
global.curSession=function(){return {user:'u1',name:'حامد'};};
global.roleDef=function(){return {buyPrice:true,finance:true};};
global.isSenior=function(){return true;};
global.audit=function(m,a,r){global._audit={m:m,a:a,r:r};};
global.notify=function(){}; global.SENIOR_ROLES=['admin','chairman'];
global.ptfToast=function(m,k){global._toast={m:m,k:k};};
global.confirm=function(){return false;};
global.ptfRfqSetStatus=function(){};
global.PTF_RFQ_STATUSES=[];
global.document={getElementById:function(){return {insertAdjacentHTML:function(){}};}, querySelectorAll:function(){return[];}};
/* eval کل scoring */
eval(sc);
setData('ptf_crm_suppliers', [{cd:'S1',co:'Supplier A',spBrands:['A'],spEquip:['Pump'],ph:'021'}]);
setData('ptf_crm_payables', []);
ptfPayableUpsert({sup:'Supplier A',inqNo:'RFQ-1',idx:0,item:'Pump',amount:1000,cur:'IRR',pay:'credit',dueISO:'2099-01-01',dueNote:'تعهد اولیه'});
var p=getData('ptf_crm_payables')[0];
T('dueISO/dueNote در payable ذخیره شد', p.dueISO==='2099-01-01' && p.dueNote==='تعهد اولیه');
ptfPayableDlv(p.cd,'ok');
p=getData('ptf_crm_payables')[0];
T('تحویل ok با تاریخ آینده late نیست', p.dlv==='ok' && p.dlvISO && p.dlvLate===false);
var r1=ptfSupplierScore({co:'Supplier A',cd:'S1',spBrands:['A'],spEquip:['Pump'],ph:'021'});
T('امتیاز تحویل بدون تاخیر امتیاز مثبت دارد', r1.parts.some(function(x){return x.k==='کیفیت تحویل' && x.tx.indexOf('0 با تاخیر')>-1;}));
/* late */
setData('ptf_crm_payables', []);
ptfPayableUpsert({sup:'Supplier A',inqNo:'RFQ-2',idx:0,item:'Pump',amount:1000,cur:'IRR',pay:'credit',dueISO:'2000-01-01'});
p=getData('ptf_crm_payables')[0];
ptfPayableDlv(p.cd,'ok');
p=getData('ptf_crm_payables')[0];
T('تحویل ok بعد از موعد تعهد late می‌شود', p.dlv==='ok' && p.dlvLate===true);
var r2=ptfSupplierScore({co:'Supplier A',cd:'S1',spBrands:['A'],spEquip:['Pump'],ph:'021'});
T('امتیازدهی کیفیت تحویل تاخیر را در متن لحاظ می‌کند', r2.parts.some(function(x){return x.k==='کیفیت تحویل' && x.tx.indexOf('1 با تاخیر')>-1;}));

SECTION('رگرسیون');
T('ptfPayableUpsert cash/credit حفظ شده', sc.indexOf("rec.pay === 'cash'")>-1 && sc.indexOf("rec.pay === 'credit'")>-1);
T('cmpBuy همچنان تسعیر ارزی الزامی دارد', bc.indexOf('خرید ارزی')>-1 && bc.indexOf('نرخ تسعیر')>-1);
T('امتیاز supplier همان DEF_W.dlv را مصرف می‌کند', sc.indexOf('W.dlv')>-1);

DONE('tester104-v187');
