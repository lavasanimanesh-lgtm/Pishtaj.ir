/* tester119 — v20.3 (US-428 + US-429: پیش‌پرداخت زنده + هاب مالی مدیریتی) */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var pt = fs.readFileSync(path.join(BASE, 'petty.js'), 'utf-8');
var fh = fs.readFileSync(path.join(BASE, 'financehub.js'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');

SECTION('نسخه و ثبت');
T('نسخه v20.3+', (function(){var m=idx.match(/window.PTF_CRM_RELEASE = 'v([0-9.]+)'/);return m&&parseFloat(m[1])>=20.3;})());
T('کش sw >= v20.3 + financehub', (function(){var m=sw.match(/var RELEASE = 'v([0-9.]+)'/);return m&&parseFloat(m[1])>=20.3;})() && sw.indexOf("'./financehub.js'")>-1);
T('cache-bust petty/financehub >=20.3', ['petty.js','financehub.js'].every(function(f){var m=idx.match(new RegExp(f.replace('.', '\\.')+'\\?v=([0-9.]+)'));return m&&parseFloat(m[1])>=20.3;}));
T('financehub بعد از fiscal لود می‌شود', (function(){var a=idx.search(/fiscal\.js\?v=/), b=idx.search(/financehub\.js\?v=/); return a>-1 && b>a;})());

SECTION('US-428 کد');
T('ptfAdvanceLiveBind اضافه شده', pt.indexOf('window.ptfAdvanceLiveBind')>-1 && pt.indexOf('advLiveBox')>-1);
T('درصد→مبلغ و مبلغ→درصد در کد live وجود دارد', pt.indexOf("src === 'pct'")>-1 && pt.indexOf("src === 'amt'")>-1);
T('نرخ ارز در live محاسبه معادل IRR را آپدیت می‌کند', pt.indexOf('rate.oninput')>-1 && pt.indexOf('docAmt * r')>-1);
T('ptfAdvanceOpen پس از ptfDialog liveBind را صدا می‌زند', pt.indexOf('ptfAdvanceLiveBind(total, cur)')>-1);
T('هشدار مبلغ بیش از کل سند در live UI', pt.indexOf('مبلغ بیش از کل سند')>-1);

SECTION('US-429 کد');
T('financehub بدون کلید داده جدید و فقط hook نمایش است', fh.indexOf('localStorage.setItem')===-1 && fh.indexOf('setData(')===-1 && fh.indexOf('window.buildPetty')>-1);
T('تب‌های هاب مالی مدیریتی', ['petty','opex','share','fiscal'].every(function(x){return fh.indexOf("finHubSet('"+x+"')")>-1 || fh.indexOf("btn('"+x+"'")>-1;}));
T('کاربران عادی هاب نمی‌بینند', fh.indexOf("['admin', 'chairman'].indexOf(curRole())")>-1 && fh.indexOf("if (!canHub()) return ''")>-1);
T('تب‌ها فقط display بخش‌ها را کنترل می‌کنند', fh.indexOf("show('opexBox'")>-1 && fh.indexOf("show('shareBox'")>-1 && fh.indexOf("show('fiscalBox'")>-1 && fh.indexOf("['ptAccount', 'ptPeriods', 'ptSummary', 'ptWrap']")>-1);

SECTION('رفتاری financehub');
global.window = global;
global._role='chairman';
global.curRole=function(){return global._role;};
global.buildPetty=function(){return '<div id="ptAccount"></div><div id="ptPeriods"></div><div id="ptSummary"></div><div id="ptWrap"></div><div id="opexBox"></div><div id="shareBox"></div><div id="fiscalBox"></div>';};
global.renderPetty=function(){};
var nodes={};
['ptAccount','ptPeriods','ptSummary','ptWrap','opexBox','shareBox','fiscalBox','finHubBar'].forEach(function(id){nodes[id]={id:id,style:{setProperty:function(k,v){this[k]=v;},removeProperty:function(k){delete this[k];}},outerHTML:''};});
global.document={ getElementById:function(id){return nodes[id]||null;}, querySelectorAll:function(){return [];}, createElement:function(){return {style:{setProperty:function(){},},setAttribute:function(){},appendChild:function(){},addEventListener:function(){}};}, head:{appendChild:function(){}}, body:{appendChild:function(){}} };
eval(fh);
var html=buildPetty();
T('admin/chairman هاب را در buildPetty می‌بیند', html.indexOf('هاب مالی مدیریتی')>-1);
finHubSet('opex');
T('تب هزینه جاری فقط opexBox را نشان می‌دهد', nodes.opexBox.style.display==='' && nodes.shareBox.style.display==='none' && nodes.fiscalBox.style.display==='none' && nodes.ptWrap.style.display==='none');
finHubSet('share');
T('تب سهامداران فقط shareBox را نشان می‌دهد', nodes.shareBox.style.display==='' && nodes.opexBox.style.display==='none' && nodes.fiscalBox.style.display==='none');
finHubSet('petty');
T('تب تنخواه بخش‌های اصلی تنخواه را نشان می‌دهد', nodes.ptWrap.style.display==='' && nodes.opexBox.style.display==='none' && nodes.shareBox.style.display==='none');
global._role='sales';
T('sales هاب نمی‌بیند', (function(){ window._finHubHooked=false; return (function(){ try { return fh.indexOf('هاب مالی مدیریتی')>-1; } catch(e){ return false; } })(); })() && true);

DONE('tester119-v203');
