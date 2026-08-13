/* tester101 — v18.4 (BUG-024 + BUG-025 + US-426 فاز۱: سخت‌سازی مالی و محرمانگی R9) */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var fc = fs.readFileSync(path.join(BASE, 'fiscal.js'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');

SECTION('نسخه و ثبت');
T('نسخه v34+', (function(){var m=idx.match(/window.PTF_CRM_RELEASE = 'v([0-9.]+)(?:-[a-z0-9.]+)?'/);return m&&parseFloat(m[1])>=34;})()); /* v34.0.4-alpha: طرح نسخه‌گذاری -alpha — قبلی با ' پایانی regex نمی‌خواند */
T('کش sw >= v18.4', (function(){var m=sw.match(/var RELEASE = 'v([0-9.]+)'/);return m&&parseFloat(m[1])>=18.4;})());
T('cache-bust fiscal >= v18.4', (function(){var m=idx.match(/fiscal\.js\?v=([0-9.]+)/);return m&&parseFloat(m[1])>=18.4;})());

SECTION('BUG-024 محرمانگی');
T('fiscalHtml برای نقش غیرمجاز خروجی خالی می‌دهد', fc.indexOf("if (!canFiscal()) return ''")>-1);
T('render/print/lock guard دارند', fc.indexOf('window.ptfFiscalRender = function () { if (!canFiscal()) return;')>-1 && fc.indexOf("window.ptfFiscalPrint = function () {\n    if (!canFiscal())")>-1 && fc.indexOf("if (!canFiscal()) { alert('⛔ فقط ادمین/رییس هیات مدیره/مدیرعامل/مدیر بازرگانی'); return; }")>-1); /* v34.0.4-alpha: متن نقش ۴گانهٔ مصوب v14.9 (US-383) */
T('hook buildPetty فقط fiscalHtml را append می‌کند (پس نقش غیرمجاز چیزی نمی‌بیند)', fc.indexOf('return _bp() + fiscalHtml();')>-1);

SECTION('BUG-025 سال مالی/مطالبات');
T('رکورد بدون تاریخ وارد سود سال نمی‌شود و undated می‌رود', fc.indexOf('out.undated.push')>-1 && fc.indexOf('بدون تاریخ شناسایی سال مالی')>-1);
T('مطالبات باز کل و سال تفکیک شده‌اند', fc.indexOf('openReceivablesTotal')>-1 && fc.indexOf('openReceivablesYear')>-1 && fc.indexOf('invoiceUndated')>-1);
T('UI قاعده سال و موارد بی‌تاریخ را نشان می‌دهد', fc.indexOf('قاعده سال: تاریخ مختومه/برد/ثبت سند')>-1 && fc.indexOf('فاکتور باز بدون تاریخ')>-1);

SECTION('US-426 گزارش رسمی');
T('ptfFiscalReportHtml گزارش رسمی با جدول منبع دارد', fc.indexOf('window.ptfFiscalReportHtml')>-1 && fc.indexOf('منبع سود پروژه‌ها')>-1 && fc.indexOf('هزینه‌های جاری')>-1 && fc.indexOf('کاربرگ تقسیم سود')>-1);
T('ptfFiscalPrint گزارش رسمی را نمایش می‌دهد نه JSON خام', fc.indexOf('ptfFiscalReportHtml(d)')>-1 && fc.indexOf('JSON.stringify(d, null, 2)')===-1);

SECTION('رفتاری: محرمانگی و فیلتر سال');
global.window = global;
global._role='sales';
global.curRole=function(){return global._role;};
global.curSession=function(){return {user:'u1',name:'کاربر'};};
global.roleDef=function(){return {finance:false};};
global.audit=function(){}; global.ptfToast=function(){};
global.alert=function(m){global._alerts=(global._alerts||[]).concat([String(m)]);};
global.document={ getElementById:function(id){ if(id==='fiscalBox') return {outerHTML:''}; return null;}, body:{insertAdjacentHTML:function(pos,h){global._modal=h;}} };
global.buildPetty=function(){return '<div>petty</div>';};
global.ptfProjectProfitIRR=function(p){return {ok:true,complete:true,warnings:[],sellIrr:2000,buyIrr:1000,buyPendingFx:[],profit:1000,pct:50};};
global.ptfOpexSum=function(){return {total:100,byCat:{'اجاره':100}};};
global.ptfShareholderBalance=function(){return {net:0};};
eval(fc);
T('role=sales در buildPetty متن داشبورد مالی نمی‌بیند', buildPetty().indexOf('داشبورد سال مالی')===-1);
ptfFiscalPrint();
T('role=sales print را هم نمی‌بیند و alert می‌گیرد', !global._modal && global._alerts.some(function(a){return a.indexOf('فقط ادمین')>-1;}));

global._role='chairman'; global._alerts=[]; global._modal='';
setData('ptf_crm_projects', [
  {no:'P-1405',offerNo:'CO-1',buyerCo:'الف',closedAt:'1405/05/01'},
  {no:'P-1404',offerNo:'CO-2',buyerCo:'قدیمی',closedAt:'1404/05/01'},
  {no:'P-NODATE',offerNo:'CO-3',buyerCo:'بی‌تاریخ'}
]);
setData('ptf_crm_deals', []);
setData('ptf_crm_invoices', [
  {cd:'I1',no:'INV1',amount:1000,payments:[{amt:400}],t:'1405/06/01'},
  {cd:'I2',no:'INV2',amount:2000,payments:[{amt:500}],t:'1404/06/01'},
  {cd:'I3',no:'INV3',amount:3000,payments:[{amt:1000}]}
]);
setData('ptf_crm_shareholders', [{cd:'S1',name:'حامد',pct:100,active:true}]);
setData('ptf_crm_fiscal_snapshots', []);
var d=ptfFiscalData('1405');
T('فقط پروژه سال ۱۴۰۵ وارد سود می‌شود', d.projects.length===1 && d.projects[0].no==='P-1405');
T('پروژه بی‌تاریخ جدا می‌شود و سال قبل وارد نمی‌شود', d.undated.length===1 && d.undated[0].no==='P-NODATE');
T('مطالبات باز: کل=4100، سال=600، فاکتور بی‌تاریخ جدا', d.openReceivablesTotal===4100 && d.openReceivablesYear===600 && d.invoiceUndated.length===1);
ptfFiscalPrint();
T('role=chairman گزارش رسمی (نقدی v33.11) با منبع اعداد می‌بیند', global._modal.indexOf('گزارش رسمی سال مالی')>-1 && global._modal.indexOf('درآمد و خروجی نقدی سال')>-1 && global._modal.indexOf('کاربرگ تقسیم سود')>-1); /* v34.0.4-alpha: v33.11 گزارش نقدی — جدول تعهدی «منبع سود پروژه‌ها» دیگر در چاپ نیست */

SECTION('v34.0.4-alpha: بازگردانی توابع حذف‌شده (رگرسیون BUG-FISCAL-LOST-UI)');
T('ptfFiscalLock تعریف شده', typeof window.ptfFiscalLock === 'function');
T('ptfFiscalRender تعریف شده', typeof window.ptfFiscalRender === 'function');
T('ptfFiscalSnapshotOpen تعریف شده', typeof window.ptfFiscalSnapshotOpen === 'function');
T('کد مرده قفل بعد از return باقی نمانده', fc.indexOf("'<\/div>';\n    if ((d.incomplete.length")===-1);

global._role='chairman'; global._alerts=[];
setData('ptf_crm_fiscal_snapshots', []);
ptfFiscalLock();
var _snaps = getData('ptf_crm_fiscal_snapshots');
T('قفل سال snapshot منجمد می‌سازد (locked + data)', _snaps.length===1 && _snaps[0].locked===true && !!_snaps[0].data && _snaps[0].data.receipts!=null);
ptfFiscalLock();
T('دوباره‌قفل ممنوع است', getData('ptf_crm_fiscal_snapshots').length===1 && global._alerts.some(function(a){return a.indexOf('قبلاً قفل')>-1;}));
global._role='sales'; global._alerts=[];
setData('ptf_crm_fiscal_snapshots', []);
ptfFiscalLock();
T('role=sales نمی‌تواند قفل کند', getData('ptf_crm_fiscal_snapshots').length===0 && global._alerts.some(function(a){return a.indexOf('فقط ادمین')>-1;}));

DONE('tester101-v184');
