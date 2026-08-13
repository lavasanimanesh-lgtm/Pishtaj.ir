/* tester34 — راستی‌آزمایی ادعاهای هندآور v90..v120 (پس از اصلاحات v121.1) */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var off = fs.readFileSync(path.join(BASE, 'offers.js'), 'utf-8');
var prj = fs.readFileSync(path.join(BASE, 'projects.js'), 'utf-8');
var gd  = fs.readFileSync(path.join(BASE, 'guards.js'), 'utf-8');
var sy  = fs.readFileSync(path.join(BASE, 'sync.js'), 'utf-8');
var tb  = fs.readFileSync(path.join(BASE, 'tables.js'), 'utf-8');
var st  = fs.readFileSync(path.join(BASE, 'storage.js'), 'utf-8');
var bk  = fs.readFileSync(path.join(BASE, 'backup.js'), 'utf-8');
var aiw = fs.readFileSync(path.join(BASE, 'ai-workbench.js'), 'utf-8');

SECTION('ادعاهای تاییدشده هندآور');
T('US-104: PointerCapture + buttons===0', tb.indexOf('setPointerCapture') > -1 && tb.indexOf('buttons === 0') > -1);
T('US-105: ptfSmartMerge موجود و در push استفاده می‌شود', sy.indexOf('window.ptfSmartMerge = function') > -1 && sy.indexOf('ptfSmartMerge(k,') > -1);
T('US-107: ptfReasonedDelete + آرشیو دلیل', gd.indexOf('ptfReasonedDelete = function') > -1 && gd.indexOf('ptf_crm_deleted_archive') > -1);
T('US-108: PurgeCloudOrphans در هر دو فایل', st.indexOf('ptfPurgeCloudOrphans') > -1 && bk.indexOf('ptfPurgeCloudOrphans') > -1);
T('BUG-003: ptfCriticalTheme در head', idx.indexOf('id="ptfCriticalTheme"') > -1);
T('BUG-005: delete_batch در whitelist', fs.readFileSync(path.resolve(__dirname,'../../api/storage.php'),'utf-8').indexOf("'delete_batch'") > -1);
T('US-256..258: AI Workbench به منو/روتر وصل', idx.indexOf("goPanel('ai'") > -1 && aiw.indexOf('window.buildAi') > -1);
T('TC در چاپ پشتیبانی می‌شود', fs.readFileSync(path.join(BASE,'offers-pro.js'),'utf-8').indexOf("o.kind === 'TC'") > -1);

SECTION('شکاف‌های کشف‌شده — رفع v121.1');
T('باگ v121.0: offerPickBuyer برگشت', off.indexOf('function offerPickBuyer(cd, keep)') > -1);
T('US-109: بج وندور در رندر فعال (override قبلا آن را می‌خورد)', off.indexOf('ptfVendorStatusBadge(c)') > -1);
T('US-109: UI تنظیم وندور در فرم مشتری (قبلا فقط اکسل)', off.indexOf('nC2VenSt') > -1 && off.indexOf('venSt:') > -1);
T('US-110: زونکن به داده واقعی docs وصل (نه alert جعلی)', idx.indexOf('docs.filter(function(d){ return d.folder === sc.id; })') > -1 && idx.indexOf('alert(&quot;مشاهده') === -1);
T('US-110/111: دکمه‌ها در پرونده وصل شدند (توابع مرده بودند)', prj.indexOf('ptfOpenProjectBinder') > -1 && prj.indexOf('ptfCalculateNetProfit') > -1);
/* v16.0 (US-390): منطق سود به موتور واحد ptfProjectProfitIRR در fx.js منتقل شد */
T('US-111: سود خالص با داده واقعی (نه 0.72 فرضی/1.5 میلیارد جعلی)', idx.indexOf('1500000000') === -1 && (idx.indexOf("getData('ptf_crm_buycmp')") > -1 || (idx.indexOf('ptfProjectProfitIRR(p)') > -1 && fs.readFileSync(path.join(BASE, 'fx.js'), 'utf-8').indexOf("getData('ptf_crm_buycmp')") > -1)));
/* v14.9 (US-383): commercial هم به فهرست مدیران اضافه شد */
T('US-111: فقط نقش مدیر', prj.indexOf("['admin','chairman','ceo','commercial'].indexOf(curRole())") > -1);

SECTION('ادعاهای نادرست سند (مستند شد، رفتار حفظ)');
// US-103 ادعا: setInterval «کاملا ممنوع/۰٪» — واقعیت: ۲۹ مورد در ۱۸ فایل (بخشی polling مشروع)
var cnt = 0;
fs.readdirSync(BASE).forEach(function (f) { if (f.endsWith('.js')) cnt += (fs.readFileSync(path.join(BASE, f), 'utf-8').match(/setInterval/g) || []).length; });
T('US-103: واقعیت ثبت شد — setInterval هنوز موجود (ادعای ۰٪ نادرست)', cnt > 10);
T('US-116: کدینگ واحد فقط کالا (genCode در ۱۰+ ماژول باقی)', idx.indexOf('ptfUnifiedCode') > -1);

SECTION('نسخه');
T('VER نسخه‌دار', /window\.PTF_CRM_RELEASE\s*=\s*'v\d+(?:\.\d+)+'/.test(idx));
DONE('tester34-claims');

SECTION('دور دوم راستی‌آزمایی (v121.2)');
var st2 = fs.readFileSync(path.join(BASE, 'storage.js'), 'utf-8');
T('US-108: جمع بازگشتی کلیدها از ۱۲ کلید داده', st2.indexOf('function harvest') > -1 && st2.indexOf("'ptf_crm_letters', 'ptf_crm_contracts'") > -1);
T('US-108: پروژه‌ها دیگر از p.files غلط خوانده نمی‌شود', st2.indexOf('p.files') === -1 || st2.indexOf('harvest(getData(k))') > -1);
T('US-108: archives/ محافظت‌شده', st2.indexOf("indexOf('archives/') === 0) return") > -1);
T('US-108: sigprofiles جمع می‌شود', st2.indexOf('ptf_crm_sigprofiles') > -1);
T('v12.7: خلاصه AI حذف شد — فقط دستیار (US-269/313)', fs.readFileSync(path.join(BASE,'inqreader.js'),'utf-8').indexOf('این قابلیت حذف شد') > -1 && aiw.indexOf('aiWB_ocrGo') > -1);
DONE('tester34-claims-r2');
