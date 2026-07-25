/* tester103 — v18.6 (Post-award real-buy hardening: ارز ماتریس، رسید، هزینه، عدم بستن پرونده) */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var bc = fs.readFileSync(path.join(BASE, 'buycompare.js'), 'utf-8');
var of = fs.readFileSync(path.join(BASE, 'offers.js'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');

SECTION('نسخه و ثبت');
T('نسخه v18.6+', (function(){var m=idx.match(/var VER = 'v([0-9.]+)'/);return m&&parseFloat(m[1])>=18.6;})());
T('کش sw >= v18.6', (function(){var m=sw.match(/ptf-crm-v([0-9.]+)/);return m&&parseFloat(m[1])>=18.6;})());
T('cache-bust buycompare/offers >=18.6', ['buycompare.js','offers.js'].every(function(f){var m=idx.match(new RegExp(f.replace('.', '\\.')+'\\?v=([0-9.]+)'));return m&&parseFloat(m[1])>=18.6;}));

SECTION('کد: خرید واقعی پس از برد');
T('cmp modal شناسه‌دار است تا فقط خودش بسته/بازسازی شود', bc.indexOf('id="cmpModal_')>-1 && bc.indexOf("document.getElementById('cmpModal_' + id)")>-1);
T('بعد از خرید واقعی دیگر همه md-bها حذف نمی‌شوند', (function(){var m=bc.match(/var wasRealbuy = window\._cmpRealbuyMode;[\s\S]*?cmpOpen\(id/); return m && m[0].indexOf("querySelectorAll('.md-b')")===-1;})());
T('استعلام مجدد فقط cmpModal را می‌بندد نه پرونده فروش', bc.indexOf("querySelectorAll('[id^=\"cmpModal_\"]')")>-1);
T('خرید واقعی cd و files دارد', bc.indexOf("var pcd = genCode('PUR')")>-1 && bc.indexOf('files: []')>-1);
T('رسید پرداخت خرید واقعی و پیوست به پرونده فروش', bc.indexOf('ptfRealBuyReceiptUpload')>-1 && bc.indexOf('رسید پرداخت خرید واقعی')>-1 && bc.indexOf("folder: 'fin'")>-1);
T('ثبت هزینه مستقیم پرونده + پیوست + costEvents', bc.indexOf('ptfProjectCostOpen')>-1 && bc.indexOf('costEvents')>-1 && bc.indexOf('ptfProjectCostUpload')>-1);
T('هزینه مستقیم در موتور سود wrapper می‌شود', bc.indexOf('hookProjectCostsProfit')>-1 && bc.indexOf('r.profit -= costs')>-1);
T('باکس پرونده فروش پیش‌پرداخت/هزینه/استعلام مجدد را نشان می‌دهد', bc.indexOf('پیش‌پرداخت:')>-1 && bc.indexOf('هزینه‌های مستقیم')>-1 && bc.indexOf('استعلام مجدد')>-1);

SECTION('کد: ماتریس سود ارزآگاه');
T('Optimizer ارز فروش را از سند می‌خواند', of.indexOf("var saleCur = o.currency || 'IRR'")>-1);
T('Optimizer خرید واقعی را از buycmp.purchases با resolver provenance می‌خواند', of.indexOf('ptfResolveProcurementAcross(it, cmps')>-1 && of.indexOf('ptfResolvePurchaseForLine')>-1);
T('Optimizer فروش ارزی را با خرید ریالی مخلوط نمی‌کند', of.indexOf('این ماتریس ارزها را مخلوط نمی‌کند')>-1 && of.indexOf('سود ریالی پس از وصول/تسعیر فروش')>-1);
T('عنوان ستون فروش دیگر IRR هاردکد نیست', of.indexOf('قیمت فروش واحد (IRR)')===-1 && of.indexOf("قیمت فروش واحد (' + escP(saleCur) + ')")>-1);
T('خرید واقعی با provenance و معادل IRR/ارز نمایش دارد', of.indexOf('priceFx')>-1 && of.indexOf('rate')>-1 && of.indexOf('تطبیق:')>-1);
T('مبلغ پیش‌پرداخت در Optimizer نمایش داده می‌شود', of.indexOf('پیش‌پرداخت:')>-1 && of.indexOf('ptfAdvanceLabel(o)')>-1);

SECTION('رفتاری: هزینه مستقیم در سود');
global.window = global;
global.curRole=function(){return 'chairman';};
global.curSession=function(){return {user:'u1',name:'حامد'};};
global.roleDef=function(){return {lb:'رییس'};};
global.audit=function(){}; global.notify=function(){}; global.faDate=function(){return '1405/04/30';}; global.faDateTime=function(){return '1405/04/30 10:00';};
global.ptfProjectProfitIRR=function(){return {ok:true,complete:true,warnings:[],sellIrr:1000,buyIrr:400,buyPendingFx:[],profit:600,pct:60};};
function rbFindDeal(inqNo){return getData('ptf_crm_deals').filter(function(d){return d.inqNo===inqNo;})[0];}
/* فقط بخش hookProjectCostsProfit را eval کنیم */
var m=bc.match(/function hookProjectCostsProfit\(\)[\s\S]*?hookProjectCostsProfit\(\);/);
T('hook cost استخراج شد', !!m);
if(m){ eval(m[0]); }
setData('ptf_crm_deals', [{cd:'D1',inqNo:'RFQ-1',costEvents:[{amt:100}]}]);
var r=ptfProjectProfitIRR({inqNo:'RFQ-1'});
T('هزینه مستقیم پرونده از سود کم می‌شود: 600-100=500', r.profit===500 && r.projectCostIrr===100);

DONE('tester103-v186');
