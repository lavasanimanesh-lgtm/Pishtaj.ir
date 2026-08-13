/* tester123 — v20.7 (BUG-034: تعدیل امتیاز 15→51 + اصلاح Inspection Notice/QC) */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var sc = fs.readFileSync(path.join(BASE, 'scoring.js'), 'utf-8');
var dx = fs.readFileSync(path.join(BASE, 'docsx.js'), 'utf-8');
var sf = fs.readFileSync(path.join(BASE, 'salesfiles.js'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');

SECTION('نسخه و ثبت');
T('نسخه v20.7+', (function(){var m=idx.match(/window.PTF_CRM_RELEASE = 'v([0-9.]+)'/);return m&&parseFloat(m[1])>=20.7;})());
T('کش sw >= v20.7', (function(){var m=sw.match(/var RELEASE = 'v([0-9.]+)'/);return m&&parseFloat(m[1])>=20.7;})());
T('cache-bust scoring/docsx/salesfiles', ['scoring.js?v=','docsx.js?v=','salesfiles.js?v='].every(function(x){return idx.indexOf(x)>-1;}) && (function(){var m=idx.match(/salesfiles\.js\?v=([0-9.]+)/);return m&&parseFloat(m[1])>=20.7;})());

SECTION('BUG-034 تعدیل امتیاز');
T('فیلد تعدیل دیگر type number/money نیست', sc.indexOf("id: 'adj'")>-1 && sc.indexOf("type: 'text'")>-1 && sc.indexOf('rawAdj')>-1);
T('parse تعدیل ارقام فارسی/عربی و clamp ±۱۵ دارد', sc.indexOf('۰۱۲۳۴۵۶۷۸۹')>-1 && sc.indexOf('Math.max(-15, Math.min(15')>-1);

global.window = global;
global.curRole=function(){return 'chairman';};
global.isSenior=function(){return true;};
global.curSession=function(){return {user:'u1',name:'حامد'};};
global.audit=function(m,a,r){global._audit={m:m,a:a,r:r};};
global.ptfToast=function(){}; global.renderCustomers=function(){global._rc=true;}; global.renderSuppliers=function(){};
global.ptfDialog=function(o){global._dlg=o;};
eval(sc);
setData('ptf_crm_settings', {});
ptfScoreAdjust('cust','C1','مشتری');
global._dlg.onOk({adj:'15',why:'تست'});
var st=getData('ptf_crm_settings');
T('رفتاری: تعدیل 15 دقیقاً 15 ذخیره می‌شود نه 51', st.scoreAdj.cust.C1.adj===15);
ptfScoreAdjust('cust','C2','مشتری'); global._dlg.onOk({adj:'۱۵',why:'فارسی'}); st=getData('ptf_crm_settings');
T('رفتاری: تعدیل فارسی ۱۵ هم 15 ذخیره می‌شود', st.scoreAdj.cust.C2.adj===15);
ptfScoreAdjust('cust','C3','مشتری'); global._dlg.onOk({adj:'51',why:'بیش از سقف'}); st=getData('ptf_crm_settings');
T('رفتاری: عدد 51 به سقف 15 محدود می‌شود', st.scoreAdj.cust.C3.adj===15);

SECTION('Inspection Notice');
T('docsx: IN به INSPECTION NOTICE تبدیل شد', dx.indexOf("id: 'IN'")>-1 && dx.indexOf("en: 'INSPECTION NOTICE'")>-1);
T('docsx: فیلدهای مکان/هماهنگی/زمان دارد', ['Inspection Location / Address','Coordination Contact Name','Coordination Contact Tel.','Inspection Time'].every(function(x){return dx.indexOf(x)>-1;}));
T('docsx: IN دیگر result/test result ندارد', dx.indexOf("id: 'result'")===-1 && dx.indexOf("items: ['Item', 'Qty', 'Test/Check', 'Result']")===-1);
T('docsx: اقلام IN از CO برنده با Description/Model/Brand/Qty/Unit پیش‌بارگذاری می‌شود', dx.indexOf("if (typeId === 'IN')")>-1 && dx.indexOf("it.model")>-1 && dx.indexOf("it.brand")>-1);

SECTION('QC report separation');
T('salesfiles: نوت بازرسی از QC حذف شد', sf.indexOf("{ id: 'note', lb: '📝 نوت بازرسی' }")===-1);
T('salesfiles: گزارش بازرسی فقط پیوست گزارش صادره توسط بازرس است', sf.indexOf('پیوست گزارش بازرسی صادره توسط بازرس')>-1 && sf.indexOf('نوت بازرسی رسمی از بخش')>-1);
T('salesfiles: test/report/cert در QC باقی‌اند', sf.indexOf("{ id: 'test'")>-1 && sf.indexOf("{ id: 'report'")>-1 && sf.indexOf("{ id: 'cert'")>-1);

DONE('tester123-v207');
