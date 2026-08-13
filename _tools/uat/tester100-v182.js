/* tester100 — v18.2 (BUG-023 + US-424: پیش‌پرداخت ساختاریافته و مطالبات قابل اعتماد) */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var pt = fs.readFileSync(path.join(BASE, 'petty.js'), 'utf-8');
var of = fs.readFileSync(path.join(BASE, 'offers.js'), 'utf-8');
var op = fs.readFileSync(path.join(BASE, 'offers-pro.js'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');

SECTION('نسخه و ثبت');
T('نسخه v18.2+', (function(){var m=idx.match(/window.PTF_CRM_RELEASE = 'v([0-9.]+)'/);return m&&parseFloat(m[1])>=18.2;})());
T('کش sw >= v18.2', (function(){var m=sw.match(/var RELEASE = 'v([0-9.]+)'/);return m&&parseFloat(m[1])>=18.2;})());
T('cache-bust petty/offers/offers-pro >=18.2', ['petty.js','offers.js','offers-pro.js'].every(function(f){ var m=idx.match(new RegExp(f.replace('.', '\\.')+'\\?v=([0-9.]+)')); return m && parseFloat(m[1])>=18.2; }));

SECTION('کد BUG-023/US-424');
T('توابع ساختاریافته advance', pt.indexOf('window.ptfAdvanceNormalize')>-1 && pt.indexOf('window.ptfAdvanceOpen')>-1 && pt.indexOf('window.ptfAdvanceLabel')>-1);
T('درصد فقط ۰ تا ۱۰۰ و درصد غیرمنطقی legacy اصلاح می‌شود', pt.indexOf('pct > 100')>-1 && pt.indexOf('درصد پیش‌پرداخت باید بین ۰ تا ۱۰۰')>-1);
T('مبلغ بیش از کل فقط با confirm و exceptional', pt.indexOf('مبلغ پیش‌پرداخت از مبلغ کل سند بیشتر')>-1 && pt.indexOf('exceptional')>-1);
T('پرداخت کامل/نقدی cashFull و paid=true', pt.indexOf('cashFull')>-1 && pt.indexOf('پرداخت کامل/نقدی')>-1);
T('سند ارزی نرخ تسعیر الزامی دارد', pt.indexOf('نرخ تسعیر برای پیش‌پرداخت ارزی الزامی')>-1 && pt.indexOf('liveRate(cur)')>-1);
T('renderReceivables از ptfAdvanceNormalize و ptfAdvanceLabel استفاده می‌کند', pt.indexOf('var advs = getData')>-1 && pt.indexOf('ptfAdvanceNormalize(o)')>-1 && pt.indexOf('ptfAdvanceLabel(o)')>-1);
T('هنگام save پیشنهاد CO/TC پیشنهاد ثبت پیش‌پرداخت می‌دهد', pt.indexOf('window.offerSave = function')>-1 && pt.indexOf('advanceAsked')>-1);
T('چاپ رسمی terms از advance ساختاریافته می‌خواند', op.indexOf('Payment / Advance Payment:')>-1 && of.indexOf('Payment / Advance Payment:')>-1);

SECTION('رفتاری: ثبت/اصلاح/نمایش');
global.window = global;
global._role='chairman';
global.curRole=function(){return global._role;};
global.curSession=function(){return {user:'u1',name:'حامد'};};
global.userName=function(){return 'حامد';};
global.roleDef=function(){return {finance:true};};
global.faDate=function(){return '1405/04/29';};
global.faDateTime=function(){return '1405/04/29 10:00';};
global.audit=function(m,a,r){global._audit={m:m,a:a,r:r};};
global.notify=function(o){global._notify=o; return 'N-1';};
global.ptfToast=function(m,k){global._toast={m:m,k:k};};
global.ptfMoney=function(v,cur){return cur&&cur!=='IRR'?(+v).toLocaleString('en-US')+' '+cur:(+v).toLocaleString('fa-IR')+' ت';};
global.renderOffers=function(){global._renderOffers=true;};
global.renderReceivables=function(){global._renderRecv=true;};
global.offerSetSt=function(no,st){ var a=getData('ptf_crm_offers'); a.forEach(function(o){if(o.no===no)o.st=st;}); setData('ptf_crm_offers',a); };
global.offerSave=function(){};
global.goPanel=function(){};
global.document={ getElementById:function(id){ if(id==='rcWrap') return { insertAdjacentHTML:function(pos,h){global._rcHtml=h;}, innerHTML:'' }; if(id==='panels') return {insertAdjacentHTML:function(){}}; return null;}, querySelectorAll:function(){return [];} };
global.ptfDialog=function(o){global._dlg=o;};
global.confirm=function(){return true;};
global.alert=function(m){global._alerts=(global._alerts||[]).concat([String(m)]);};
global._ptfFxLive={rates:{usd_sana_sell:110000,usd_free:130000}};
eval(pt);
setData('ptf_crm_offers', [{no:'CO-1',kind:'CO',currency:'IRR',buyerCo:'مشتری',st:'draft',items:[{qty:10,price:1000000}]}]);
ptfAdvanceOpen('CO-1');
T('دیالوگ پیش‌پرداخت باز می‌شود', global._dlg && global._dlg.title.indexOf('پیش‌پرداخت ساختاریافته')>-1);
global._dlg.onOk({mode:'pct',pct:27,docAmt:'',rate:'',note:'۲۷٪ پیش‌پرداخت؛ مابقی قبل از تحویل'});
var o=getData('ptf_crm_offers')[0];
T('درصدی ۲۷٪: مبلغ ۲.۷م و pct=27', o.advance.mode==='pct' && o.advance.pct===27 && o.advance.amt===2700000 && !o.advance.paid);
T('برچسب بدون درصد غیرمنطقی', ptfAdvanceLabel(o).indexOf('27٪')>-1 && ptfAdvanceLabel(o).indexOf('100000000')===-1);

/* درصد legacy غیرمنطقی از val */
o.advance={mode:'pct',val:100000000,amt:2700000};
T('legacy pct=100000000 در normalize به درصد منطقی تبدیل می‌شود', ptfAdvanceNormalize(o).pct===27 && ptfAdvanceLabel(o).indexOf('100000000')===-1);

/* درصد بالای ۱۰۰ رد */
global._alerts=[]; o.advance=null; setData('ptf_crm_offers',[o]); ptfAdvanceOpen('CO-1'); global._dlg.onOk({mode:'pct',pct:101,docAmt:'',rate:'',note:''});
T('درصد بالای ۱۰۰ رد می‌شود', getData('ptf_crm_offers')[0].advance===null && global._alerts.some(function(a){return a.indexOf('بین ۰ تا ۱۰۰')>-1;}));

/* full paid */
ptfAdvanceOpen('CO-1'); global._dlg.onOk({mode:'full',pct:'',docAmt:'',rate:'',note:'پرداخت نقدی'});
o=getData('ptf_crm_offers')[0];
T('پرداخت کامل: paid/cashFull و مطالبه باز نیست', o.advance.cashFull===true && o.advance.paid===true && o.advance.mode==='full');

/* amount over total exceptional with confirm true */
ptfAdvanceOpen('CO-1'); global._dlg.onOk({mode:'amt',pct:'',docAmt:12000000,rate:'',note:'استثنایی'});
o=getData('ptf_crm_offers')[0];
T('مبلغ بیش از کل فقط exceptional ثبت می‌شود', o.advance.exceptional===true && o.advance.amt===12000000);

/* foreign requires rate */
setData('ptf_crm_offers', [{no:'CO-USD',kind:'CO',currency:'USD',buyerCo:'خارجی',items:[{qty:1,price:1000}]}]);
global._alerts=[]; ptfAdvanceOpen('CO-USD'); global._dlg.onOk({mode:'pct',pct:30,docAmt:'',rate:'',note:''});
T('سند ارزی بدون نرخ رد می‌شود', !getData('ptf_crm_offers')[0].advance && global._alerts.some(function(a){return a.indexOf('نرخ تسعیر')>-1;}));
ptfAdvanceOpen('CO-USD'); global._dlg.onOk({mode:'pct',pct:30,docAmt:'',rate:110000,note:'۳۰٪ ارزی'});
o=getData('ptf_crm_offers')[0];
T('سند ارزی: ۳۰٪ از ۱۰۰۰ دلار × ۱۱۰هزار = ۳۳م تومان', o.advance.docAmt===300 && o.advance.amt===33000000 && o.advance.rate===110000);

/* render receivables shows edit/paid */
global._rcHtml=''; renderReceivables();
T('مطالبات پیش‌پرداخت structured نمایش و اصلاح دارد', global._rcHtml.indexOf('CO-USD')>-1 && global._rcHtml.indexOf('اصلاح')>-1 && global._rcHtml.indexOf('پیش‌پرداخت‌ها')>-1);
advancePaid('CO-USD'); global._dlg.onOk({how:'حواله'});
T('وصول پیش‌پرداخت paid می‌شود', getData('ptf_crm_offers')[0].advance.paid===true && getData('ptf_crm_offers')[0].advance.paidHow==='حواله');

SECTION('رگرسیون');
T('پیش‌پرداخت کلید داده جدید ندارد', pt.indexOf('ptf_crm_advance')===-1);
T('goPanel مسیر petty حفظ است', pt.indexOf("if (id === 'petty')")>-1);
T('terms چاپی موجود حفظ و advance فقط اضافه می‌شود', of.indexOf('var _termsArr = (o.terms || []).slice()')>-1 && op.indexOf('var arr = (o.terms || []).slice()')>-1);

DONE('tester100-v182');
