/* tester121 — v20.5 (US-446: تاریخ شمسی در UI، ISO فقط داخلی/قالب انگلیسی) */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var dx = fs.readFileSync(path.join(BASE, 'datex.js'), 'utf-8');
var ch = fs.readFileSync(path.join(BASE, 'cheques.js'), 'utf-8');
var sf = fs.readFileSync(path.join(BASE, 'salesfiles.js'), 'utf-8');
var br = fs.readFileSync(path.join(BASE, 'bridge.js'), 'utf-8');
var ld = fs.readFileSync(path.join(BASE, 'leads.js'), 'utf-8');
var docsx = fs.readFileSync(path.join(BASE, 'docsx.js'), 'utf-8');
var offers = fs.readFileSync(path.join(BASE, 'offers.js'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');

SECTION('نسخه و ثبت');
T('نسخه v20.5+', (function(){var m=idx.match(/var VER = 'v([0-9.]+)'/);return m&&parseFloat(m[1])>=20.5;})());
T('datex در index و sw', (function(){var m=idx.match(/datex\.js\?v=([0-9.]+)/);var v=sw.match(/ptf-crm-v([0-9.]+)/);return m&&parseFloat(m[1])>=20.5&&sw.indexOf("'./datex.js'")>-1&&v&&parseFloat(v[1])>=20.5;})());

SECTION('datex تبدیل‌ها');
global.window = global;
eval(dx);
T('تبدیل شمسی به ISO نمونه ۱۴۰۵/۰۴/۱۹', ptfJToISO('۱۴۰۵/۰۴/۱۹') === '2026-07-10');
T('تبدیل ISO به شمسی نمونه 2026-07-10', ptfISOToJ('2026-07-10') === '1405/04/19');
T('نرمال‌سازی ارقام فارسی/بدون صفر', ptfJNormalize('۱۴۰۵/۴/۹') === '1405/04/09');
T('ورودی نامعتبر خالی می‌دهد', ptfJToISO('bad') === '');

SECTION('UIهای فارسی‌شده');
T('چک: تاریخ سررسید شمسی و parse به ISO', ch.indexOf('chDueJ')>-1 && ch.indexOf('تاریخ سررسید (شمسی)')>-1 && ch.indexOf('ptfJToISO')>-1);
T('پرونده فروش: تحویل تعهدی شمسی و parse به ISO', sf.indexOf('sfDueJ')>-1 && sf.indexOf('تاریخ تحویل تعهدی (شمسی)')>-1 && sf.indexOf('ptfJToISO')>-1);
T('درخواست: مهلت پاسخ شمسی در ثبت/ویرایش', br.indexOf('nR2DueJ')>-1 && br.indexOf('er_due_j')>-1 && br.indexOf('ptfJToISO')>-1);
T('سرنخ/یادآور: تاریخ‌ها متنی شمسی', ld.indexOf('placeholder="1405/04/19"')>-1 && ld.indexOf('ptfJToISO')>-1 && ld.indexOf('ptfISOToJ')>-1);

SECTION('استثناهای قالب انگلیسی');
T('قالب‌های رسمی انگلیسی docsx همچنان dateISO دارند', docsx.indexOf("id: 'dateISO'")>-1 && docsx.indexOf('PACKING LIST')>-1);
T('پیشنهاد مالی/فنی همچنان dateEn/ofDateJ میلادی برای قالب انگلیسی دارد', offers.indexOf('dateEn')>-1 && offers.indexOf('ofDateJ')>-1 && offers.indexOf('ذخیره سیستمی به میلادی')>-1);

SECTION('رفتاری: save چک با تاریخ شمسی');
global.curSession=function(){return {user:'u1',name:'کاربر'};};
global.ptfNum=function(v){return +String(v||'').replace(/[^\d.-]/g,'')||0;}; function chAll(){return getData('ptf_crm_cheques');} function chSave(l){setData('ptf_crm_cheques',l);}
global.audit=function(){}; global.refreshBox=function(){}; global.renderReminders=function(){}; global.ptfToast=function(){};
var nodes={ chNo:{value:'123'}, chAmt:{value:'1000000'}, chTo:{value:'شرکت'}, chDueJ:{value:'1405/04/19'}, chBank:{value:'بانک'}, chNote:{value:'تست'}, panels:{insertAdjacentHTML:function(){}} };
global.document={getElementById:function(id){return nodes[id]||null;},querySelector:function(){return {remove:function(){}};},querySelectorAll:function(){return[];}};
T('مسیر ذخیرهٔ چک dueISO داخلی و dueFa شمسی را نگه می‌دارد', ch.indexOf('obj.dueISO = due ||') > -1 && ch.indexOf('obj.dueFa = due ?') > -1 && ch.indexOf('ptfISOToJ(due)') > -1);

DONE('tester121-v205');
