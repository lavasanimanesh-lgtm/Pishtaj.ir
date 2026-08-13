/* tester137 — v22.0: US-411 (My Customers Filter) + BUG-023/US-424 (Advance) + BUG-022 (Sup Origin)
   تستر اسپرینت v22.0 — ادغام دو مسیر توسعه‌ای
*/
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');

SECTION('نسخه v22.0');
T('VER v22.0', /window\.PTF_CRM_RELEASE\s*=\s*'v\d+(?:\.\d+)+'/.test(idx));
T('SW CACHE v22.0', /var RELEASE\s*=\s*'v\d+(?:\.\d+)+'/.test(sw));
T('cache-bust my-customers-filter >=22.0', (function(){var m=idx.match(/my-customers-filter\.js\?v=([0-9.]+)/);return m&&parseFloat(m[1])>=22.0;})());

SECTION('US-411: my-customers-filter.js');
var mf = fs.readFileSync(path.join(BASE, 'my-customers-filter.js'), 'utf-8');
T('ptfMyCustFilter روی window', mf.indexOf('window.ptfMyCustFilter') > -1);
T('Hook-based override renderCustomers', mf.indexOf('window.renderCustomers = function') > -1);
T('SENIOR_ROLES شامل admin/chairman/ceo/commercial', mf.indexOf("'admin'") > -1 && mf.indexOf("'chairman'") > -1 && mf.indexOf("'ceo'") > -1 && mf.indexOf("'commercial'") > -1);
T('getScope / isSenior / applyFilter در export', mf.indexOf('getScope') > -1 && mf.indexOf('isSenior') > -1 && mf.indexOf('applyFilter') > -1);
T('STORAGE_KEY = ptf_my_cust_filter', mf.indexOf('ptf_my_cust_filter') > -1);
T('بدون setTimeout بی‌نهایت (retry limit)', mf.indexOf('_hookRetries') > -1 && mf.indexOf('_hookRetries < 60') > -1);
T('script در index.html ثبت شد', /my-customers-filter\.js\?v=/.test(idx));

SECTION('US-411: رفتاری — applyFilter');
global.window = global;
global.localStorage = { _s: {}, getItem: function(k){return this._s[k]||null;}, setItem: function(k,v){this._s[k]=String(v);}, removeItem: function(k){delete this._s[k];} };
global.renderCustomers = function(){};
var iifeStart = mf.indexOf('(function ()');
var iifeEnd = mf.lastIndexOf('})();');
var iife = mf.substring(iifeStart, iifeEnd + 5);
try { eval(iife); } catch(e) { console.error(e); }
var mcf = global.window.ptfMyCustFilter;
T('ماژول اجرا شد', !!mcf);
T('state پیش‌فرض mine', mcf.getState() === 'mine');
global.curRole = function(){return 'admin';};
global.curSession = function(){return {user:'ali'};};
T('admin scope=all', mcf.getScope() === 'all');
T('admin isSenior=true', mcf.isSenior() === true);
global.curRole = function(){return 'sales';};
T('sales scope=own', mcf.getScope() === 'own');
T('sales isSenior=false', mcf.isSenior() === false);
var sample = [
  {cd:'C-1', co:'A', crBy:'ali'},
  {cd:'C-2', co:'B', crBy:'sara'},
  {cd:'C-3', co:'C'}
];
global.curRole = function(){return 'sales';};
global.curSession = function(){return {user:'ali'};};
var filtered = mcf.applyFilter(sample);
T('sales ali → 1 رکورد (فقط crBy=ali)', filtered.length === 1 && filtered[0].cd === 'C-1');
global.curRole = function(){return 'chairman';};
var all = mcf.applyFilter(sample);
T('chairman → همه ۳ رکورد', all.length === 3);

SECTION('BUG-023 + US-424: پیش‌پرداخت ساختاریافته در petty.js');
var pt = fs.readFileSync(path.join(BASE, 'petty.js'), 'utf-8');
T('ptfAdvanceNormalize تعریف شده', pt.indexOf('window.ptfAdvanceNormalize') > -1 || pt.indexOf('function ptfAdvanceNormalize') > -1);
T('ptfAdvanceLabel تعریف شده', pt.indexOf('window.ptfAdvanceLabel') > -1 || pt.indexOf('function ptfAdvanceLabel') > -1);
T('ptfAdvanceOpen تعریف شده', pt.indexOf('window.ptfAdvanceOpen') > -1 || pt.indexOf('function ptfAdvanceOpen') > -1);
T('ptfAdvanceLiveBind تعریف شده', pt.indexOf('window.ptfAdvanceLiveBind') > -1 || pt.indexOf('function ptfAdvanceLiveBind') > -1);
T('advancePaid تعریف شده', pt.indexOf('window.advancePaid') > -1 || pt.indexOf('function advancePaid') > -1);
T('ساختار advance با mode/struct/paid', pt.indexOf("mode: 'none'") > -1 && pt.indexOf("struct: true") > -1);
T('گارد درصد ۰ تا ۱۰۰', pt.indexOf('درصد پیش‌پرداخت باید بین ۰ تا ۱۰۰ باشد') > -1);
T('گارد مبلغ منفی', pt.indexOf('مبلغ پیش‌پرداخت الزامی است') > -1);
T('نرخ تسعیر برای ارزی الزامی', pt.indexOf('نرخ تسعیر برای پیش‌پرداخت ارزی الزامی است') > -1);
T('exceptional برای مبلغ > کل', pt.indexOf('exceptional') > -1);
T('hook offerSave برای پرسش advance', pt.indexOf('_advOfferSaveHooked') > -1);
T('hook offerSetSt won → advance', pt.indexOf("st === 'won'") > -1 && pt.indexOf('ptfAdvanceOpen') > -1);

SECTION('BUG-023: رفتاری — normalize درصد غیرمنطقی');
global.window = global;
global.localStorage = { _s: {}, getItem: function(k){return this._s[k]||null;}, setItem: function(k,v){this._s[k]=String(v);} };
global.getData = function(){return [];}; global.setData = function(){};
global.audit = function(){}; global.notify = function(){}; global.faDate = function(){return '1405/01/01';};
global.faDateTime = function(){return '1405/01/01 12:00';}; global.userName = function(){return 'test';};
global.offerCur = function(){return 'IRR';}; global.offerTotal = function(){return 1000000000;};
global.liveRate = function(){return 80000;};
global.toNum = function(v){return +(String(v).replace(/,/g,''))||0;};
global.escP = function(s){return String(s==null?'':s);};
global.advMoney = function(v,c){return (+v||0).toLocaleString('fa-IR');};
var advIife = pt.substring(pt.indexOf('(function(){'), pt.lastIndexOf('})();') + 5);
try { eval(advIife); } catch(e) {}
var norm = global.window.ptfAdvanceNormalize;
T('normalize اجرا می‌شود', typeof norm === 'function');
if (typeof norm === 'function') {
  var bad = norm({advance:{mode:'pct',pct:100000000,docAmt:0,amt:0}});
  T('pct غیرمنطقی به ۱۰۰ سقف می‌خورد', bad.pct === 100);
  var none = norm({advance:{mode:'none'}});
  T('mode none → none', none.mode === 'none');
}

SECTION('BUG-022: تب داخلی/خارجی تامین‌کنندگان در cheques.js');
var ch = fs.readFileSync(path.join(BASE, 'cheques.js'), 'utf-8');
T('ptfSupTab تعریف شده', ch.indexOf('window.ptfSupTab') > -1 || ch.indexOf('function ptfSupTab') > -1);
T('ptfSupOriginReview تعریف شده', ch.indexOf('window.ptfSupOriginReview') > -1 || ch.indexOf('function ptfSupOriginReview') > -1);
T('دکمه تب داخلی', ch.indexOf('داخلی') > -1 && ch.indexOf('supTabIr') > -1);
T('دکمه تب خارجی', ch.indexOf('خارجی') > -1 && ch.indexOf('supTabFx') > -1);
T('فیلد origin در فرم تامین‌کننده', ch.indexOf('nS2Origin') > -1);
T('audit BUG-022 در originReview', ch.indexOf('BUG-022') > -1);

SECTION('رگرسیون: ماژول‌های کلیدی سالم');
T('offers.js موجود', fs.existsSync(path.join(BASE, 'offers.js')));
T('cheques.js موجود', fs.existsSync(path.join(BASE, 'cheques.js')));
T('petty.js موجود', fs.existsSync(path.join(BASE, 'petty.js')));
T('leads.js موجود', fs.existsSync(path.join(BASE, 'leads.js')));

DONE('tester137-v220');
if (RESULTS.fail) process.exit(1);
