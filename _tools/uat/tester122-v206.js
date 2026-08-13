/* tester122 — v20.6 (BizCard batch + shareholder salary + finance hub rename/access + PL English fields) */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var ai = fs.readFileSync(path.join(BASE, 'ai-workbench.js'), 'utf-8');
var llm = fs.readFileSync(path.resolve(__dirname, '../../api/llm.php'), 'utf-8');
var sh = fs.readFileSync(path.join(BASE, 'shareholders.js'), 'utf-8');
var pt = fs.readFileSync(path.join(BASE, 'petty.js'), 'utf-8');
var dx = fs.readFileSync(path.join(BASE, 'docsx.js'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');
var perms = fs.readFileSync(path.join(BASE, 'perms.js'), 'utf-8');

SECTION('نسخه و ثبت');
T('نسخه v20.6+', (function(){var m=idx.match(/window.PTF_CRM_RELEASE = 'v([0-9.]+)'/);return m&&parseFloat(m[1])>=20.6;})());
T('کش sw >= v20.6', (function(){var m=sw.match(/var RELEASE = 'v([0-9.]+)'/);return m&&parseFloat(m[1])>=20.6;})());
T('cache-bust فایل‌های اسپرینت >=20.6', ['ai-workbench.js','shareholders.js','petty.js','docsx.js','ui-kit.js'].every(function(f){var m=idx.match(new RegExp(f.replace('.', '\\.')+'\\?v=([0-9.]+)'));return m&&parseFloat(m[1])>=20.6;}));

SECTION('کارت ویزیت چندتایی');
T('LLM bizcard خروجی cards[] می‌خواهد', llm.indexOf('MANY business cards')>-1 && llm.indexOf('"cards"')>-1);
T('Client چند کارت را normalize و render می‌کند', ai.indexOf('normCards')>-1 && ai.indexOf('_aiWB_bizCards')>-1 && ai.indexOf('aiWB_bizSaveAll')>-1);
T('ثبت همه کارت‌ها با مقصد انتخابی وجود دارد', ai.indexOf('ثبت همه')>-1 && ai.indexOf('cards.forEach')>-1);

SECTION('سهامدار/حقوق');
T('فیلد حقوق سهامدار type number است (v21.10)', sh.indexOf("id: 'salary'")>-1 && sh.indexOf("type: 'number'")>-1 && sh.indexOf('200,000,000')>-1);
T('parse حقوق با n(v.salary) حفظ شده', sh.indexOf('rec.salary = rec.duty ? n(v.salary) : 0')>-1);

SECTION('هاب مالی و دسترسی');
T('نام ماژول در سایدبار/مجوز هاب مالی است', idx.indexOf('<span class="lb">هاب مالی</span>')>-1 && perms.indexOf("lb: 'هاب مالی'")>-1);
T('دسترسی کامل petty فقط admin/chairman', pt.indexOf("var MANAGERS = ['admin', 'chairman']")>-1 && pt.indexOf('function canAll() { return isMgr() || isTreasurer(); }')>-1);
T('برای سایر کاربران ثبت هزینه باز است', pt.indexOf('<button class="bt" onclick="pettyAdd()">+ ثبت هزینه</button>')>-1);

SECTION('Packing List');
T('PL فیلدهای انگلیسی نام/تلفن گیرنده دارد', dx.indexOf('Consignee Name (English)')>-1 && dx.indexOf('Tel. (English digits)')>-1);
T('PL وزن خالص/ناخالص کلی و ستونی دارد', dx.indexOf('Total Net Weight (kg)')>-1 && dx.indexOf('Total Gross Weight (kg)')>-1 && dx.indexOf('N.W (kg)')>-1 && dx.indexOf('G.W (kg)')>-1);
T('docsx همچنان از پرونده فروش صادر می‌شود', dx.indexOf('ptfDocxOpen')>-1 && dx.indexOf('ptf_crm_deals')>-1 && dx.indexOf('dxBox_')>-1);

SECTION('رفتاری: ثبت همه کارت‌ها');
global.window = global;
global.curSession=function(){return {user:'u1',name:'حامد'};};
global.audit=function(){}; global.ptfToast=function(){}; global.dedupStamp=function(r){r.crAt='now';};
global.ptfCheckDup=function(){return [];}; global.confirm=function(){return true;};
global.renderSuppliers=function(){}; global.renderCustomers=function(){}; global.renderLeads=function(){};
global.esc=function(s){return String(s==null?'':s);};
var vals={dest:'supplier'}, res={innerHTML:''};
global.document={createElement:function(){return {textContent:'',innerHTML:''};}, getElementById:function(id){ if(id==='biz_dest') return {value:vals.dest}; if(id==='biz_save_res') return res; return {value:''};}, body:{insertAdjacentHTML:function(){}}, querySelectorAll:function(){return[];}};
var mark=ai.indexOf('v20.6 — BizCard Batch Upgrade'); var start=ai.indexOf('(function(){', mark); var end=ai.lastIndexOf('\n})();');
T('override batch block قابل استخراج است', start>-1 && end>start);
if(start>-1) eval(ai.slice(start,end));
window._aiWB_bizCards=[{company:'S1',person:'A',mobile:'1',brands:'WIKA',equip:'Gauge'},{company:'S2',person:'B',mobile:'2',brands:'ABB',equip:'MCC'}];
aiWB_bizSaveAll();
T('ثبت همه کارت‌ها: دو تامین‌کننده ساخته شد', getData('ptf_crm_suppliers').length===2 && getData('ptf_crm_suppliers')[0].spBrands.length===1);

DONE('tester122-v206');
