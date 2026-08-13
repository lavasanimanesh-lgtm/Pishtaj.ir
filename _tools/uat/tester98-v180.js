/* tester98 — v18.0 (US-421: زیان پروژه + هشدار فعال داده ناقص سود) */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var lg = fs.readFileSync(path.join(BASE, 'lossguard.js'), 'utf-8');
var fx = fs.readFileSync(path.join(BASE, 'fx.js'), 'utf-8');
var sf = fs.readFileSync(path.join(BASE, 'salesfiles.js'), 'utf-8');
var pr = fs.readFileSync(path.join(BASE, 'projects.js'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');

SECTION('نسخه و ثبت');
T('نسخه v18.0+', (function(){var m=idx.match(/window.PTF_CRM_RELEASE = 'v([0-9.]+)'/);return m&&parseFloat(m[1])>=18.0;})());
T('window.VER هم >= v18.0', (function(){var m=idx.match(/window\.PTF_CRM_RELEASE = 'v([0-9.]+)'/);return m&&parseFloat(m[1])>=18.0&&idx.indexOf('window.VER = window.PTF_CRM_RELEASE')>-1&&idx.indexOf('var VER = window.PTF_CRM_RELEASE')>-1;})());
T('کش sw >= v18.0 + lossguard در SHELL', (function(){var m=sw.match(/var RELEASE = 'v([0-9.]+)'/);return m&&parseFloat(m[1])>=18.0;})() && sw.indexOf("'./lossguard.js'")>-1);
T('cache-bust salesfiles/projects/lossguard/sync >=18.0', ['salesfiles.js','projects.js','lossguard.js','sync.js'].every(function(f){ var m=idx.match(new RegExp(f.replace('.', '\\.')+'\\?v=([0-9.]+)')); return m && parseFloat(m[1])>=18.0; }));

SECTION('US-421 کد');
T('lossguard: ثبت زیان و مجموع زیان', lg.indexOf('window.ptfLossOpen')>-1 && lg.indexOf('window.ptfProjectLossTotal')>-1 && lg.indexOf('lossEvents')>-1);
T('زیان در موتور سود ptfProjectProfitIRR کسر می‌شود', lg.indexOf('window.ptfProjectProfitIRR = function')>-1 && lg.indexOf('r.profit -= loss')>-1 && lg.indexOf('r.lossIrr = loss')>-1);
T('داده ناقص سود: فروش بدون خرید واقعی + buyPendingFx/complete/ok', lg.indexOf('window.ptfProfitIncompleteItems')>-1 && lg.indexOf('فروش/CO دارد اما خرید واقعی ثبت نشده')>-1 && lg.indexOf('!r.ok || !r.complete')>-1);
T('هشدار فعال در روز من + notify ارشد', lg.indexOf('window.ptfMyDayItems = function')>-1 && lg.indexOf('پروژه/پرونده داده ناقص سود دارند')>-1 && lg.indexOf('window.ptfProfitIncompleteNotify')>-1 && lg.indexOf("toRoles: ['admin', 'chairman', 'ceo', 'commercial']")>-1);
T('ثبت زیان با دلیل استاندارد و پیوست', lg.indexOf('عدم انطباق کالا')>-1 && lg.indexOf('project-loss/')>-1 && lg.indexOf('attachUploadWidget')>-1);
T('پرونده فروش: دکمه ثبت زیان + انتقال lossEvents به بایگانی', sf.indexOf("ptfLossOpen(\\'deal\\'")>-1 && sf.indexOf('lossEvents: (r.lossEvents || []).slice()')>-1 && sf.indexOf('lossIrr:')>-1);
T('بایگانی: دکمه ثبت زیان + badge زیان‌ده', pr.indexOf("ptfLossOpen(\\'project\\'")>-1 && pr.indexOf('ptfProjectLossBadge(p)')>-1);
T('اصل معماری سود: fx همچنان منبع اصلی ptfProjectProfitIRR است', fx.indexOf('window.ptfProjectProfitIRR = function')>-1 && lg.indexOf('var _orig = window.ptfProjectProfitIRR')>-1);

SECTION('رفتاری: ثبت زیان، کسر از سود، هشدار ناقص');
global.window = global;
global._role = 'chairman';
global.curRole = function(){return global._role;};
global.curSession = function(){return {user:'u1',name:'حامد'};};
global.roleDef = function(){return {lb:'رییس'};};
global.audit = function(m,a,r){global._audit={m:m,a:a,r:r};};
global.notify = function(o){global._notify=o; return 'N-1';};
global.ptfToast = function(m,k){global._toast={m:m,k:k};};
global.faDate = function(){return '1405/04/28';};
global.faDateTime = function(){return '1405/04/28 10:00';};
global.ptfDialog = function(o){global._dlg=o;};
global.document = { getElementById:function(){return null;}, body:{insertAdjacentHTML:function(){}} };
global.localStorage.removeItem('ptf_profit_incomplete_notified');
global.ptfMyDayItems = function(){return [];};
/* سود پایه: فروش ۱۰۰۰، خرید ۴۰۰، سود ۶۰۰ */
global.ptfProjectProfitIRR = function(prj){ return {ok:true, complete:true, warnings:[], sellIrr:1000, buyIrr: prj.no==='NO-BUY'?0:400, buyPendingFx:[], profit: prj.no==='NO-BUY'?1000:600, pct: prj.no==='NO-BUY'?100:60}; };

eval(lg);
setData('ptf_crm_projects', [{no:'PRJ-1', offerNo:'CO-1', inqNo:'RFQ-1', buyerCo:'مشتری', state:'archived', lossEvents:[]}]);
setData('ptf_crm_deals', []);
ptfLossOpen('project','PRJ-1');
global._dlg.onOk({amt:150, reason:'mismatch', dt:'1405/04/28', desc:'عدم انطباق کالا'});
var p = getData('ptf_crm_projects')[0];
T('ثبت زیان روی پروژه: lossEvents + audit + notify', p.lossEvents.length===1 && p.lossEvents[0].amt===150 && global._audit.m==='زیان پروژه' && global._notify.kind==='project_loss');
var rr = ptfProjectProfitIRR(p);
T('سود پس از زیان: ۶۰۰−۱۵۰=۴۵۰ و lossIrr=150', rr.profit===450 && rr.lossIrr===150 && rr.pct===45);

/* داده ناقص: فروش دارد، خرید ندارد */
setData('ptf_crm_projects', [{no:'NO-BUY', offerNo:'CO-2', inqNo:'RFQ-2', buyerCo:'مشتری۲'}]);
var inc = ptfProfitIncompleteItems();
T('پروژه فروش‌دار بدون خرید واقعی در incomplete می‌آید', inc.length===1 && inc[0].warnings.some(function(w){return w.indexOf('خرید واقعی')>-1;}));
var items = ptfMyDayItems();
T('روز من هشدار خلاصه داده ناقص دارد', items.length && items[0].tx.indexOf('داده ناقص سود')>-1 && items[0].cl==='#dc2626');
ptfProfitIncompleteNotify();
T('اعلان روزانه داده ناقص به ارشد ارسال می‌شود', global._notify && global._notify.kind==='profit_incomplete' && global._notify.toRoles.indexOf('chairman')>-1);
var nt = global._notify;
ptfProfitIncompleteNotify();
T('اعلان روزانه تکراری نمی‌شود', global._notify===nt);

global._role='sales'; global._dlg=null; global._alerts=[]; global.alert=function(m){global._alerts.push(String(m));};
ptfLossOpen('project','NO-BUY');
T('نقش غیرارشد اجازه ثبت زیان ندارد', !global._dlg && global._alerts.some(function(a){return a.indexOf('فقط برای نقش‌های ارشد')>-1;}));

SECTION('رگرسیون');
T('ptfCalculateNetProfit همچنان مصرف‌کننده ptfProjectProfitIRR است', idx.indexOf('ptfProjectProfitIRR(p)')>-1);
T('lossguard کلید داده جدید نساخته (داخل deals/projects ذخیره می‌کند)', lg.indexOf('ptf_crm_loss')===-1 && lg.indexOf('ptf_crm_projects')>-1 && lg.indexOf('ptf_crm_deals')>-1);
T('sync keys بدون کلید اضافه US-421 باقی مانده‌اند', /lossguard\.js\?v=[0-9.]+/.test(idx) && fs.readFileSync(path.join(BASE,'sync.js'),'utf-8').indexOf('ptf_crm_loss')===-1);

DONE('tester98-v180');
