/* tester102 — v18.5 (BUG-027: تاریخ تحویل تعهدی پس از save حذف نمی‌شود) */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var sf = fs.readFileSync(path.join(BASE, 'salesfiles.js'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');

SECTION('نسخه و ثبت');
T('نسخه v18.5+', (function(){var m=idx.match(/var VER = 'v([0-9.]+)'/);return m&&parseFloat(m[1])>=18.5;})());
T('کش sw >= v18.5', (function(){var m=sw.match(/ptf-crm-v([0-9.]+)/);return m&&parseFloat(m[1])>=18.5;})());
T('cache-bust salesfiles >= v18.5', (function(){var m=idx.match(/salesfiles\.js\?v=([0-9.]+)/);return m&&parseFloat(m[1])>=18.5;})());

SECTION('ریشه‌کنی BUG-027');
T('هندلر ذخیره دیگر قبل از خواندن input مودال را remove نمی‌کند', sf.indexOf("onclick=\"sfDueSave(")>-1 && sf.indexOf("this.closest(\\'.md-b\\').remove();sfSetDueCommit")===-1);
T('مسیر ذخیره و حذف جدا شده‌اند', sf.indexOf('window.sfDueSave')>-1 && sf.indexOf('window.sfClearDue')>-1);
T('حذف فقط explicitClear مجاز است', sf.indexOf('explicitClear')>-1 && sf.indexOf('حذف تعهد فقط از مسیر دکمه حذف')>-1);
T('تاریخ خالی هنگام ذخیره alert می‌دهد نه حذف', sf.indexOf('تاریخ تحویل تعهدی را انتخاب کنید')>-1);
T('اعتبارسنجی فرمت ISO date وجود دارد', sf.indexOf('/^\\\\d{4}-\\\\d{2}-\\\\d{2}$/')>-1 || sf.indexOf('فرمت تاریخ نامعتبر')>-1);

SECTION('رفتاری');
global.window = global;
global.curRole=function(){return 'chairman';};
global.curSession=function(){return {user:'u1',name:'حامد'};};
global.roleDef=function(){return {lb:'رییس'};};
global.audit=function(m,a,r){global._audit={m:m,a:a,r:r};};
global.ptfToast=function(m,k){global._toast={m:m,k:k};};
function sfAll(){return getData('ptf_crm_deals');}
function sfSave(list){setData('ptf_crm_deals', list);}
global.renderDeals=function(){global._rendered=true;};
global.confirm=function(){return true;};
global.alert=function(m){global._alerts=(global._alerts||[]).concat([String(m)]);};
var els={};
global.document={
  getElementById:function(id){return els[id]||null;},
  querySelectorAll:function(){return[];}
};
/* فقط بخش توابع due را eval کنیم */
function exGlobal(name) {
  var re = new RegExp('window\\.' + name + ' = function[\\s\\S]*?\\n  \};');
  var m = sf.match(re);
  if (!m) return false;
  eval(m[0]);
  return true;
}
var okDue = exGlobal('sfDueSave') && exGlobal('sfClearDue') && exGlobal('sfSetDueCommit');
T('توابع due استخراج شدند', okDue);
setData('ptf_crm_deals', [{cd:'D1',inqNo:'RFQ-1',buyerCo:'مشتری',docs:[],st:'open'}]);
els.sfDueInp={value:'2026-08-15'}; els.sfDueNote={value:'طبق توافق'}; els.sfDueDlg={remove:function(){global._removed=true;}};
sfDueSave('D1');
var d=getData('ptf_crm_deals')[0];
T('ذخیره تاریخ مقدار dueISO را ثبت می‌کند', d.dueISO==='2026-08-15' && d.dueNote==='طبق توافق');
T('پیام موفقیت ثبت تاریخ است نه حذف', global._toast && global._toast.m.indexOf('تاریخ تحویل تعهدی ثبت شد')>-1);
T('audit ثبت/اصلاح دارد', global._audit && global._audit.a.indexOf('ثبت/اصلاح تاریخ تحویل تعهدی')>-1);

/* خالی در مسیر save نباید تاریخ قبلی را حذف کند */
global._alerts=[]; global._toast=null; els.sfDueInp={value:''}; els.sfDueNote={value:'x'}; els.sfDueDlg={remove:function(){global._removed2=true;}};
sfDueSave('D1');
d=getData('ptf_crm_deals')[0];
T('save با تاریخ خالی حذف نمی‌کند', d.dueISO==='2026-08-15' && global._alerts.some(function(a){return a.indexOf('تاریخ تحویل تعهدی را انتخاب کنید')>-1;}));

sfClearDue('D1');
d=getData('ptf_crm_deals')[0];
T('حذف فقط با sfClearDue انجام می‌شود', d.dueISO==='' && d.dueNote==='');
T('پیام حذف فقط در مسیر حذف می‌آید', global._toast && global._toast.m.indexOf('تعهد تحویل حذف شد')>-1);

SECTION('رگرسیون');
T('ptfSfDueState دست‌نخورده', sf.indexOf('window.ptfSfDueState = function')>-1);
T('renderDeals همچنان dueBadge دارد', sf.indexOf('dueBadge')>-1 && sf.indexOf('تحویل تعهدی')>-1);
T('sfSetDueCommit همچنان برای تست/مسیر برنامه‌ای موجود است', sf.indexOf('window.sfSetDueCommit')>-1);

DONE('tester102-v185');
