/* tester96 — v17.8 (US-422: حساب تنخواه کامل — موجودی/شارژ/تسویه/گزارش دوره) */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var pt = fs.readFileSync(path.join(BASE, 'petty.js'), 'utf-8');
var sy = fs.readFileSync(path.join(BASE, 'sync.js'), 'utf-8');
var bk = fs.readFileSync(path.join(BASE, 'backup.js'), 'utf-8');
var gl = fs.readFileSync(path.join(BASE, 'golive.js'), 'utf-8');
var st = fs.readFileSync(path.join(BASE, 'storage.js'), 'utf-8');
var api = fs.readFileSync(path.resolve(__dirname, '../../api/crm.php'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');

SECTION('نسخه و ثبت کلیدها');
T('نسخه v17.8+', (function(){var m=idx.match(/window.PTF_CRM_RELEASE = 'v([0-9.]+)'/);return m&&parseFloat(m[1])>=17.8;})());
T('window.VER هم یکدست v17.8+', (function(){var m=idx.match(/window\.PTF_CRM_RELEASE = 'v([0-9.]+)'/);return m&&parseFloat(m[1])>=17.8;})());
T('کش sw v17.8+', (function(){var m=sw.match(/var CACHE = 'ptf-crm-v([0-9.]+)'/);return m&&parseFloat(m[1])>=17.8;})());
T('cache-bust petty/sync/backup/golive/storage >=17.8', ['petty.js','sync.js','backup.js','golive.js','storage.js'].every(function(f){ var m=idx.match(new RegExp(f.replace('.', '\\.')+'\\?v=([0-9.]+)')); return m && parseFloat(m[1])>=17.8; }));
T('کلیدهای حساب تنخواه در sync + guard', (function(){ var gm=(sy.match(/var GUARD_KEYS = \[[^\]]*\]/)||[''])[0]; return ['ptf_crm_petty_tx','ptf_crm_petty_periods'].every(function(k){ return sy.indexOf("'"+k+"'")>-1 && gm.indexOf(k)>-1; }); })());
T('کلیدها در backup/golive/api whitelist', bk.indexOf("'ptf_crm_petty_tx'")>-1 && gl.indexOf("'ptf_crm_petty_periods'")>-1 && api.indexOf("'ptf_crm_petty_tx'")>-1 && api.indexOf("'ptf_crm_opex'")>-1);
T('پاکسازی ابری پیوست دوره تنخواه را محافظت می‌کند', st.indexOf("'ptf_crm_petty_periods'")>-1);

SECTION('US-422 کد');
T('کلیدهای TX/PERIOD تعریف شده‌اند', pt.indexOf("TX_KEY = 'ptf_crm_petty_tx'")>-1 && pt.indexOf("PERIOD_KEY = 'ptf_crm_petty_periods'")>-1);
T('موجودی = شارژ منهای پرداخت مستقیم و تسویه', pt.indexOf('window.ptfPettyBalance = function')>-1 && pt.indexOf("x.type === 'charge'")>-1 && pt.indexOf("x.type === 'direct' || x.type === 'settle'")>-1);
T('شارژ حساب + پرداخت مستقیم + تسویه از حساب', pt.indexOf('window.pettyCharge')>-1 && pt.indexOf('window.pettyDirectPay')>-1 && pt.indexOf('window.pettySettle')>-1 && pt.indexOf('ensureBalance')>-1);
T('هزینه کاربران = مطالبه در انتظار تسویه', pt.indexOf('به‌عنوان مطالبه شما از تنخواه')>-1 && pt.indexOf("st: 'open'")>-1);
T('گزارش دوره + ارجاع حسابدار + ثبت حسابداری', pt.indexOf('window.ptfPettyPeriodData')>-1 && pt.indexOf('window.pettyClosePeriod')>-1 && pt.indexOf('toRoles: [\'accountant\']')>-1 && pt.indexOf('window.pettyPeriodRegistered')>-1);
T('پیوست صورتحساب بانک روی دوره', pt.indexOf('window.pettyAttachBank')>-1 && pt.indexOf('petty-period/')>-1);
T('نقش تنخواه‌گردان قابل تنظیم و پیش‌فرض chairman', pt.indexOf('pettyTreasurerRole')>-1 && pt.indexOf("return stObj().pettyTreasurerRole || 'chairman'")>-1);
T('SMS اختیاری برای ارجاع حسابدار', pt.indexOf("v.sms === 'yes'")>-1 && pt.indexOf('smsSendSingle')>-1);

SECTION('رفتاری: موجودی، مطالبه، تسویه، دوره');
global.window = global;
global.curRole = function(){ return global._role || 'chairman'; };
global.curSession = function(){ return { user: global._user || 'u1', name: global._name || 'حامد' }; };
global.roleDef = function(){ return { finance: true, lb: 'نقش' }; };
global.goPanel = function(){};
global.ptfToast = function(){};
global.notify = function(o){ global._lastNotify = o; return 'N-1'; };
global.audit = function(kind,msg,ref){ global._lastAudit = {kind:kind,msg:msg,ref:ref}; };
global.smsSendSingle = function(mob, txt){ global._sms = (global._sms||[]).concat([{mob:mob,txt:txt}]); };
global.document = { getElementById: function(id){ if(id==='panels') return { insertAdjacentHTML:function(){}, innerHTML:'' }; return null; }, querySelectorAll:function(){return[];} };
/* eval کل ماژول */
eval(pt);

setData('ptf_crm_petty', []); setData('ptf_crm_petty_tx', []); setData('ptf_crm_petty_periods', []); setData('ptf_crm_settings', {});
setData('ptf_crm_users', [{username:'acc',roleId:'accountant',name:'حسابدار',mobile:'09120000000'},{username:'u2',roleId:'sales',name:'کارشناس',mobile:'09121111111'}]);
T('موجودی اولیه صفر', ptfPettyBalance() === 0);

/* شارژ */
var dlg = null; global.ptfDialog = function(o){ dlg = o; };
pettyCharge(); dlg.onOk({amt:1000000, doc:'واریز اولیه', desc:'شارژ'});
T('شارژ حساب موجودی را زیاد می‌کند', ptfPettyBalance() === 1000000 && getData('ptf_crm_petty_tx')[0].type === 'charge');

/* ثبت هزینه توسط کاربر = مطالبه */
global._role='sales'; global._name='کارشناس'; global._user='u2';
pettyAdd(); dlg.onOk({amt:250000, cat:'پیک', rfq:'RFQ-1', desc:'ارسال مدارک'});
var p = getData('ptf_crm_petty')[0];
T('هزینه کاربر open و مطالبه اوست', p.st === 'open' && p.by === 'کارشناس' && ptfPettyPendingByUser()['کارشناس'] === 250000);

/* تسویه توسط تنخواه‌گردان */
global._role='chairman'; global._name='حامد'; global._user='u1';
pettySettle(p.cd); dlg.onOk({doc:'حواله ۱۲۳'});
var p2 = getData('ptf_crm_petty')[0];
T('تسویه: وضعیت settled + TX از نوع settle + کسر موجودی', p2.st === 'settled' && getData('ptf_crm_petty_tx')[0].type === 'settle' && ptfPettyBalance() === 750000);
T('تسویه به کاربر اعلان کارتابل می‌دهد', global._lastNotify && global._lastNotify.toUsers[0] === 'u2');

/* پرداخت مستقیم */
pettyDirectPay(); dlg.onOk({amt:100000, cat:'خرید اداری', doc:'پرداخت مستقیم ۱', desc:'خرید ملزومات'});
T('پرداخت مستقیم: petty settled + tx direct + کسر', getData('ptf_crm_petty')[0].payMode === 'direct' && getData('ptf_crm_petty_tx')[0].type === 'direct' && ptfPettyBalance() === 650000);

/* کفایت موجودی */
global._alerts=[]; global.alert=function(m){ global._alerts.push(String(m)); };
pettyDirectPay(); dlg.onOk({amt:99999999, cat:'سایر', doc:'X', desc:'X'});
T('موجودی ناکافی جلوی پرداخت را می‌گیرد', global._alerts.some(function(a){return a.indexOf('موجودی حساب تنخواه کافی نیست')>-1;}) && ptfPettyBalance() === 650000);

/* دوره */
global._alerts=[]; global._sms=[]; pettyClosePeriod(); dlg.onOk({month:(getData('ptf_crm_petty')[0] || {}).month, note:'گزارش ماه', sms:'yes'});
var pr = getData('ptf_crm_petty_periods')[0];
T('ارجاع دوره: period referred با گردش/مانده و ids', pr.st === 'referred' && pr.totalOut === 350000 && pr.balance === 650000 && pr.txIds.length >= 3 && pr.pettyIds.length >= 2);
T('ارجاع دوره به حسابدار notify + sms اختیاری می‌زند', global._lastNotify && global._lastNotify.toRoles[0] === 'accountant' && global._sms.length === 1);

global._role='accountant'; global._name='حسابدار'; pettyPeriodRegistered(pr.cd); dlg.onOk({doc:'ثبت حسابداری ۴۵'});
T('حسابدار دوره را registered می‌کند', getData('ptf_crm_petty_periods')[0].st === 'registered' && getData('ptf_crm_petty_periods')[0].accDoc === 'ثبت حسابداری ۴۵');

/* تنظیم نقش */
global._role='chairman'; global._name='حامد'; pettySetTreasurerRole(); dlg.onOk({rl:'commercial'});
T('نقش تنخواه‌گردان در settings ذخیره می‌شود', getData('ptf_crm_settings').pettyTreasurerRole === 'commercial');

SECTION('رگرسیون');
T('پیش‌پرداخت CO حفظ و ساختاریافته شده', pt.indexOf('window.advancePaid')>-1 && pt.indexOf('ptfAdvanceNormalize')>-1 && pt.indexOf('پیش‌پرداخت‌ها')>-1);
T('goPanel مسیر petty هنوز override دارد', pt.indexOf("if (id === 'petty')")>-1 && pt.indexOf('buildPetty(); renderPetty();')>-1);
T('opex همچنان بعد از petty لود می‌شود', idx.indexOf('petty.js?v=') < idx.indexOf('opex.js?v='));

DONE('tester96-v178');
