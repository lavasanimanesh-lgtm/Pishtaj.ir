/* tester99 — v18.1 (US-420: داشبورد سال مالی + تقسیم سود + snapshot قفل‌شده) */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var fc = fs.readFileSync(path.join(BASE, 'fiscal.js'), 'utf-8');
var sy = fs.readFileSync(path.join(BASE, 'sync.js'), 'utf-8');
var bk = fs.readFileSync(path.join(BASE, 'backup.js'), 'utf-8');
var gl = fs.readFileSync(path.join(BASE, 'golive.js'), 'utf-8');
var api = fs.readFileSync(path.resolve(__dirname, '../../api/crm.php'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');

SECTION('نسخه و ثبت');
T('نسخه v18.1+', (function(){var m=idx.match(/window.PTF_CRM_RELEASE = 'v([0-9.]+)'/);return m&&parseFloat(m[1])>=18.1;})());
T('window.VER هم >= v18.1', (function(){var m=idx.match(/window\.PTF_CRM_RELEASE = 'v([0-9.]+)'/);return m&&parseFloat(m[1])>=18.1&&idx.indexOf('window.VER = window.PTF_CRM_RELEASE')>-1&&idx.indexOf('var VER = window.PTF_CRM_RELEASE')>-1;})());
T('کش sw >= v18.1 + fiscal در SHELL', (function(){var m=sw.match(/var RELEASE = 'v([0-9.]+)'/);return m&&parseFloat(m[1])>=18.1;})() && sw.indexOf("'./fiscal.js'")>-1);
T('fiscal بعد از lossguard لود می‌شود', idx.indexOf('lossguard.js?v=')>-1 && idx.indexOf('fiscal.js?v=')>idx.indexOf('lossguard.js?v='));
T('کلید snapshot سال مالی در sync/guard/backup/api/golive', (function(){var gm=(sy.match(/var GUARD_KEYS = \[[^\]]*\]/)||[''])[0]; return ['ptf_crm_fiscal_snapshots'].every(function(k){return sy.indexOf(k)>-1 && gm.indexOf(k)>-1 && bk.indexOf(k)>-1 && api.indexOf(k)>-1 && gl.indexOf(k)>-1;});})());

SECTION('US-420 کد');
T('توابع اصلی dashboard/distribution/snapshot', fc.indexOf('window.ptfFiscalData')>-1 && fc.indexOf('window.ptfFiscalDistribution')>-1 && fc.indexOf('window.ptfFiscalLock')>-1);
T('مصرف‌کننده موتور واحد سود است نه تکرار منطق', fc.indexOf('ptfProjectProfitIRR(p)')>-1 && fc.indexOf('sellIrr -')===-1);
T('فقط پروژه‌های کامل/قابل اتکا وارد سود می‌شوند و ناقص‌ها جدا می‌شوند', fc.indexOf('incomplete.push')>-1 && fc.indexOf('!r.ok || !r.complete')>-1 && fc.indexOf('buyPendingFx')>-1);
T('هزینه جاری از ptfOpexSum سال می‌آید', fc.indexOf('ptfOpexSum(year)')>-1);
T('کاربرگ تقسیم: درصد تقسیم/اندوخته + سهم سهامداران + مانده جاری', fc.indexOf('distPct')>-1 && fc.indexOf('reserve')>-1 && fc.indexOf('ptfShareholderBalance')>-1);
T('قفل snapshot غیرقابل تکرار', fc.indexOf('قبلاً قفل شده است')>-1 && fc.indexOf('locked: true')>-1);
T('hook روی پنل مالی R9 موجود', fc.indexOf('buildPetty')>-1 && fc.indexOf('fiscalHtml()')>-1);

SECTION('رفتاری: سود سال، ناقص‌ها، تقسیم، قفل');
global.window = global;
global._role='chairman';
global.curRole=function(){return global._role;};
global.curSession=function(){return {user:'u1',name:'حامد'};};
global.roleDef=function(){return {finance:true};};
global.audit=function(m,a,r){global._audit={m:m,a:a,r:r};};
global.ptfToast=function(m,k){global._toast={m:m,k:k};};
global.faDateTime=function(){return '1405/12/29 18:00';};
global.faDate=function(){return '1405/12/29';};
global.confirm=function(){return true;};
global.alert=function(m){global._alerts=(global._alerts||[]).concat([String(m)]);};
global.document={ getElementById:function(id){ if(id==='fiscalBox') return {outerHTML:''}; return null;}, body:{insertAdjacentHTML:function(){}} };
global.buildPetty=function(){return '<div>petty</div>';};
/* سود: پروژه A کامل 1000، پروژه B ناقص، پروژه C فقط زیان */
global.ptfProjectProfitIRR=function(p){
  if(p.no==='ARC-A') return {ok:true,complete:true,warnings:[],sellIrr:2000,buyIrr:1000,buyPendingFx:[],profit:1000,pct:50};
  if(p.no==='ARC-B') return {ok:false,complete:false,warnings:['⛔ هیچ دریافت ندارد'],sellIrr:3000,buyIrr:0,buyPendingFx:[],profit:null,pct:null};
  return {ok:false,complete:false,warnings:['⛔ فروش ندارد'],sellIrr:0,buyIrr:0,buyPendingFx:[],profit:null,pct:null};
};
global.ptfOpexSum=function(year){return {total:300,byCat:{'اجاره‌بها':200,'حقوق و دستمزد':100}};};
global.ptfShareholderBalance=function(cd){return cd==='S1'?{net:50}:{net:-20};};
eval(fc);
setData('ptf_crm_projects', [
  {no:'ARC-A',offerNo:'CO-A',buyerCo:'الف',closeKind:'settled',closedAt:'1405/08/01'},
  {no:'ARC-B',offerNo:'CO-B',buyerCo:'ب',closeKind:'settled',closedAt:'1405/08/02'},
  {no:'ARC-C',buyerCo:'ج',closedAt:'1405/08/03',lossEvents:[{amt:200}]}
]);
setData('ptf_crm_deals', []);
setData('ptf_crm_invoices', [{cd:'I1',amount:1000,payments:[{amt:400}]}]);
setData('ptf_crm_shareholders', [{cd:'S1',name:'حامد',pct:60,active:true},{cd:'S2',name:'شریک',pct:40,active:true}]);
setData('ptf_crm_fiscal_snapshots', []);
var d=ptfFiscalData('1405');
T('سود پروژه‌ها: کامل 1000 + زیان-only -200 = 800', d.projectProfit===800 && d.projectLossOnly===200);
T('هزینه جاری 300 کسر و سود خالص 500 می‌شود', d.opexTotal===300 && d.netProfit===500);
T('پرونده ناقص جدا شده و در سود نیامده', d.incomplete.length===1 && d.incomplete[0].no==='ARC-B');
T('مطالبات باز 600', d.openReceivables===600);
var dist=ptfFiscalDistribution('1405',60);
T('قابل تقسیم 60٪ از 500 = 300 و اندوخته 200', dist.distributable===300 && dist.reserve===200);
T('سهم سهامدار با مانده جاری: S1=180+50=230، S2=120-20=100', dist.shareholders[0].final===230 && dist.shareholders[1].final===100);
global._fiscalYear = '1404';
ptfFiscalLock();
var ss=getData('ptf_crm_fiscal_snapshots');
T('قفل سال گذشته snapshot ذخیره شد', ss.length===1 && ss[0].locked===true && ss[0].year==='1404' && ss[0].data);
global._alerts=[]; ptfFiscalLock();
T('قفل دوباره همان سال بلاک می‌شود', getData('ptf_crm_fiscal_snapshots').length===1 && global._alerts.some(function(a){return a.indexOf('قبلاً قفل')>-1;}));
global._role='sales'; global._alerts=[]; ptfFiscalLock();
T('نقش غیرمجاز نمی‌تواند قفل کند', global._alerts.some(function(a){return a.indexOf('فقط ادمین')>-1;}));

SECTION('رگرسیون');
T('R9 قبلی‌ها حفظ: opex/shareholders/lossguard قبل از fiscal', idx.indexOf('opex.js')<idx.indexOf('shareholders.js') && idx.indexOf('shareholders.js')<idx.indexOf('lossguard.js') && idx.indexOf('lossguard.js')<idx.indexOf('fiscal.js'));
T('Go-Live فقط snapshot را پاک می‌کند نه پروفایل سهامداران', gl.indexOf('ptf_crm_fiscal_snapshots')>-1 && gl.indexOf('ptf_crm_shareholders')===-1);
T('lossguard کلید مستقل ندارد و fiscal هم فقط snapshot دارد', fs.readFileSync(path.join(BASE,'lossguard.js'),'utf-8').indexOf('ptf_crm_loss')===-1 && fc.indexOf('ptf_crm_fiscal_snapshots')>-1);

DONE('tester99-v181');
