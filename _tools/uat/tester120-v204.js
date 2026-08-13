/* tester120 — v20.4 (US-445: کارت ویزیت هوشمند AI → مشتری/تامین‌کننده/سرنخ) */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var ai = fs.readFileSync(path.join(BASE, 'ai-workbench.js'), 'utf-8');
var llm = fs.readFileSync(path.resolve(__dirname, '../../api/llm.php'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');

SECTION('نسخه و ثبت');
T('نسخه v20.4+', (function(){var m=idx.match(/window.PTF_CRM_RELEASE = 'v([0-9.]+)'/);return m&&parseFloat(m[1])>=20.4;})());
T('کش sw >= v20.4', (function(){var m=sw.match(/var RELEASE = 'v([0-9.]+)'/);return m&&parseFloat(m[1])>=20.4;})());
T('cache-bust ai-workbench >=20.4', (function(){var m=idx.match(/ai-workbench\.js\?v=([0-9.]+)/);return m&&parseFloat(m[1])>=20.4;})());

SECTION('کد کارت ویزیت');
T('تب کارت ویزیت در buildAi و tabs وجود دارد', ai.indexOf('aiTab_bizcard')>-1 && ai.indexOf("'bizcard'")>-1 && ai.indexOf('💳 کارت ویزیت')>-1);
T('تابع‌های اصلی bizcard', ['aiWB_html_bizcard','aiWB_bizGo','aiWB_bizRender','aiWB_bizSave'].every(function(x){return ai.indexOf(x)>-1;}));
T('llm action bizcard سمت سرور', llm.indexOf("case 'bizcard'")>-1 && llm.indexOf('business card')>-1 && llm.indexOf('cards')>-1);
T('ثبت مقصدها: تامین‌کننده/مشتری/سرنخ', ai.indexOf("dest==='supplier'")>-1 && ai.indexOf("dest==='customer'")>-1 && ai.indexOf('ptf_crm_leads')>-1);
T('ضدتکرار قبل از ثبت', ai.indexOf('bizDup')>-1 && ai.indexOf('ptfCheckDup')>-1);
T('پروفایل تخصصی تامین‌کننده از کارت: brands/equip', ai.indexOf('spBrands')>-1 && ai.indexOf('spEquip')>-1);
T('ماندگاری نتیجه در history', ai.indexOf("aiWB_persist('bizcard'")>-1 && ai.indexOf("t==='bizcard'")>-1);

SECTION('رفتاری: ثبت تامین‌کننده/مشتری/سرنخ از فرم preview');
global.window = global;
global.curSession=function(){return {user:'u1',name:'حامد'};};
global.audit=function(m,a,r){global._audit={m:m,a:a,r:r};};
global.ptfToast=function(m,k){global._toast={m:m,k:k};};
global.dedupStamp=function(r){r.crBy='حامد';r.crAt='now';};
global.ptfCheckDup=function(){return [];}; global.esc=function(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');};
global.confirm=function(){return true;};
global.renderSuppliers=function(){global._rs=true;}; global.renderCustomers=function(){global._rc=true;}; global.renderLeads=function(){global._rl=true;};
var vals={}, res={innerHTML:''};
global.document={
  createElement:function(){return {textContent:'',innerHTML:''};},
  getElementById:function(id){ if(id==='biz_save_res') return res; if(id==='biz_dest') return {value:vals.dest||'supplier'}; if(id.indexOf('biz_')===0) return {value: vals[id.replace('biz_','')]||''}; return null; },
  body:{insertAdjacentHTML:function(){}}, querySelectorAll:function(){return[];}
};
/* eval کل ai-workbench ممکن است به DOM بیشتری نیاز داشته باشد؛ فقط بخش توابع biz را جدا استخراج می‌کنیم */
var start=ai.indexOf('// ---------- BUSINESS CARD TAB');
var end=ai.indexOf('// ---------- OCR TAB ----------');
T('بلوک biz استخراج شد', start>-1 && end>start);
if(start>-1 && end>start) eval(ai.slice(start,end));

vals={dest:'supplier',company:'تامین تجهیز',companyEn:'Tamin Tajhiz',person:'علی رضایی',role:'Sales Manager',mobile:'09120000000',phone:'02112345678',email:'a@test.com',website:'example.com',address:'Tehran',activity:'ابزار دقیق',brands:'Siemens, WIKA',equip:'Transmitter, Gauge'};
aiWB_bizSave();
var sup=getData('ptf_crm_suppliers')[0];
T('ثبت تامین‌کننده با برند/تجهیز/رابط', sup && sup.co==='تامین تجهیز' && sup.spBrands.length===2 && sup.spEquip.length===2 && sup.people[0].nm==='علی رضایی');

vals.dest='customer'; vals.company='مشتری صنعت'; vals.brands=''; vals.equip=''; aiWB_bizSave();
var cust=getData('ptf_crm_customers')[0];
T('ثبت مشتری با رابط و تلفن', cust && cust.co==='مشتری صنعت' && cust.people[0].mobs[0].n==='09120000000');

vals.dest='lead'; vals.company='سرنخ نفت'; vals.equip='Valve'; aiWB_bizSave();
var lead=getData('ptf_crm_leads')[0];
T('ثبت سرنخ با stage new و source کارت ویزیت', lead && lead.co==='سرنخ نفت' && lead.stage==='new' && lead.src==='کارت ویزیت');

DONE('tester120-v204');
