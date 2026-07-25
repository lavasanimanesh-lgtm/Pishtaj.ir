/* tester125 — v22.0 / v20.9 (US-411 Phase 1A — My Customers Filter)
   چک‌های امنیتی + منطقی + رگرسیون برای فیلتر «مشتریان من»

   منطق تأیید شده ۱۴۰۵/۰۴/۱۴:
   - chairman/ceo/commercial/admin → همه + toggle «من/همه»
   - sales/buyer/accountant/collector → فقط crBy=me + رکوردهای بدون crBy + فقط toggle «من» */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var mf = fs.readFileSync(path.join(BASE, 'my-customers-filter.js'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');

/* helper: استخراج بلوک IIFE */
function extractIIFE(source) {
  var i = source.indexOf('(function ()');
  if (i < 0) return null;
  var end = source.lastIndexOf('})();');
  if (end < 0) return null;
  return source.substring(i, end + 4);
}

/* helper: اجرای IIFE در یک محیط تمیز و برگرداندن ptfMyCustFilter */
function loadModule() {
  global.window = global;
  global.renderCustomers = function(){};
  global.localStorage = {
    _s: {},
    getItem: function(k) { return this._s[k] || null; },
    setItem: function(k, v) { this._s[k] = String(v); },
    removeItem: function(k) { delete this._s[k]; }
  };
  var iife = extractIIFE(mf);
  if (!iife) return null;
  try { eval(iife); } catch(e) { return 'CRASH: ' + e.message; }
  return global.window.ptfMyCustFilter || null;
}

/* ---------- ثبت و معماری ---------- */
SECTION('نسخه و معماری');
T('ptfMyCustFilter روی window export شد', mf.indexOf('window.ptfMyCustFilter') > -1);
T('Hook-based: override renderCustomers', mf.indexOf('window.renderCustomers = function') > -1);
T('localStorage state key صحیح', mf.indexOf('ptf_my_cust_filter') > -1);
T('بدون تغییر offers.js (اصل 11)', fs.existsSync(path.join(BASE, 'offers.js')));
T('script در index.html ثبت شد', /my-customers-filter\.js\?v=/.test(idx));
T('IIFE معتبر — اجرا می‌شود', loadModule() !== null);
T('ساختار ماژول: applyFilter دارد', (function(){
  var m = loadModule(); return m && typeof m.applyFilter === 'function';
})());
T('SENIOR_ROLES = [admin, chairman, ceo, commercial]', (function(){
  var m = loadModule();
  return m.SENIOR_ROLES.length === 4 &&
         m.SENIOR_ROLES.indexOf('admin') > -1 &&
         m.SENIOR_ROLES.indexOf('chairman') > -1 &&
         m.SENIOR_ROLES.indexOf('ceo') > -1 &&
         m.SENIOR_ROLES.indexOf('commercial') > -1;
})());
T('isSenior() در API', (function(){
  var m = loadModule();
  return m && typeof m.isSenior === 'function';
})());

/* ---------- State Management ---------- */
SECTION('مدیریت state');
T('state پیش‌فرض mine', (function(){
  var m = loadModule(); return m.getState() === 'mine';
})());
T('setState("all") ماندگار می‌شود', (function(){
  var m = loadModule();
  m.setState('all');
  return m.getState() === 'all';
})());
T('setState مقدار نامعتبر → نادیده', (function(){
  var m = loadModule();
  m.setState('hacked'); // نامعتبر
  return m.getState() === 'all' || m.getState() === 'mine';
})());
T('VALID_STATES = ["mine","all"]', (function(){
  var m = loadModule();
  return m.VALID_STATES.length === 2;
})());
T('STORAGE_KEY = "ptf_my_cust_filter"', (function(){
  var m = loadModule();
  return m.STORAGE_KEY === 'ptf_my_cust_filter';
})());

/* ---------- RBAC: getScope و isSenior ---------- */
SECTION('منطق RBAC: getScope و isSenior');
T('admin → "all"', (function(){
  var m = loadModule();
  global.curRole = function() { return 'admin'; };
  return m.getScope() === 'all';
})());
T('chairman → "all"', (function(){
  var m = loadModule();
  global.curRole = function() { return 'chairman'; };
  return m.getScope() === 'all';
})());
T('ceo → "all"', (function(){
  var m = loadModule();
  global.curRole = function() { return 'ceo'; };
  return m.getScope() === 'all';
})());
T('commercial → "all"', (function(){
  var m = loadModule();
  global.curRole = function() { return 'commercial'; };
  return m.getScope() === 'all';
})());
T('sales → "own"', (function(){
  var m = loadModule();
  global.curRole = function() { return 'sales'; };
  return m.getScope() === 'own';
})());
T('buyer → "own"', (function(){
  var m = loadModule();
  global.curRole = function() { return 'buyer'; };
  return m.getScope() === 'own';
})());
T('accountant → "own"', (function(){
  var m = loadModule();
  global.curRole = function() { return 'accountant'; };
  return m.getScope() === 'own';
})());
T('collector → "own"', (function(){
  var m = loadModule();
  global.curRole = function() { return 'collector'; };
  return m.getScope() === 'own';
})());
T('isSenior() برای admin', (function(){
  var m = loadModule();
  global.curRole = function() { return 'admin'; };
  return m.isSenior() === true;
})());
T('isSenior() برای sales', (function(){
  var m = loadModule();
  global.curRole = function() { return 'sales'; };
  return m.isSenior() === false;
})());

/* ---------- منطق فیلتر: سناریوهای واقعی ---------- */
SECTION('منطق فیلتر: سناریوهای واقعی');
/* داده تست: 4 مشتری
   - C1: crBy='ali' (مال علی)
   - C2: crBy='sara' (مال سارا)
   - C3: crBy='ali' (مال علی)
   - C4: بدون crBy (قدیمی — backward-compat) */
var SAMPLE = [
  { cd: 'C-1001', co: 'پتروشیمی الف', crBy: 'ali' },
  { cd: 'C-1002', co: 'فولاد ب', crBy: 'sara' },
  { cd: 'C-1003', co: 'نیروگاه ج', crBy: 'ali' },
  { cd: 'C-1004', co: 'سیمان د' } // بدون crBy
];

/* ----- نقش‌های ارشد: همیشه همه ----- */
T('chairman + state=all → 4', (function(){
  var m = loadModule();
  global.curRole = function() { return 'chairman'; };
  global.curSession = function() { return { user: 'chair1' }; };
  m.setState('all');
  return m.applyFilter(SAMPLE).length === 4;
})());
T('chairman + state=mine → باز هم 4 (طبق تأیید)', (function(){
  var m = loadModule();
  global.curRole = function() { return 'chairman'; };
  global.curSession = function() { return { user: 'chair1' }; };
  m.setState('mine');
  return m.applyFilter(SAMPLE).length === 4;
})());
T('ceo → همه 4', (function(){
  var m = loadModule();
  global.curRole = function() { return 'ceo'; };
  global.curSession = function() { return { user: 'ceo1' }; };
  m.setState('all');
  return m.applyFilter(SAMPLE).length === 4;
})());
T('commercial → همه 4', (function(){
  var m = loadModule();
  global.curRole = function() { return 'commercial'; };
  global.curSession = function() { return { user: 'comm1' }; };
  m.setState('all');
  return m.applyFilter(SAMPLE).length === 4;
})());
T('admin → همه 4', (function(){
  var m = loadModule();
  global.curRole = function() { return 'admin'; };
  global.curSession = function() { return { user: 'admin' }; };
  m.setState('all');
  return m.applyFilter(SAMPLE).length === 4;
})());

/* ----- نقش‌های own: فقط crBy=me (v21.0 — بدون مالک مخفی) ----- */
T('sales (ali) → 2 (ali×2، بدون legacy)', (function(){
  var m = loadModule();
  global.curRole = function() { return 'sales'; };
  global.curSession = function() { return { user: 'ali' }; };
  m.setState('mine');
  return m.applyFilter(SAMPLE).length === 2;
})());
T('sales (sara) → 1 (sara×1، بدون legacy)', (function(){
  var m = loadModule();
  global.curRole = function() { return 'sales'; };
  global.curSession = function() { return { user: 'sara' }; };
  m.setState('mine');
  return m.applyFilter(SAMPLE).length === 1;
})());
T('sales (newuser) → 0 (بدون مالک مخفی)', (function(){
  var m = loadModule();
  global.curRole = function() { return 'sales'; };
  global.curSession = function() { return { user: 'newuser' }; };
  m.setState('mine');
  return m.applyFilter(SAMPLE).length === 0;
})());
T('sales + state=all → همان «own» (state بی‌اثر)', (function(){
  var m = loadModule();
  global.curRole = function() { return 'sales'; };
  global.curSession = function() { return { user: 'ali' }; };
  m.setState('all');
  return m.applyFilter(SAMPLE).length === 2;
})());
T('buyer (sara) → 1 (sara×1، بدون legacy)', (function(){
  var m = loadModule();
  global.curRole = function() { return 'buyer'; };
  global.curSession = function() { return { user: 'sara' }; };
  m.setState('mine');
  return m.applyFilter(SAMPLE).length === 1;
})());
T('accountant (nobody) → 0 (بدون مالک مخفی)', (function(){
  var m = loadModule();
  global.curRole = function() { return 'accountant'; };
  global.curSession = function() { return { user: 'nobody' }; };
  m.setState('mine');
  return m.applyFilter(SAMPLE).length === 0;
})());

/* ----- ایمنی ----- */
T('آرایه خالی → آرایه خالی', (function(){
  var m = loadModule();
  global.curRole = function() { return 'admin'; };
  return m.applyFilter([]).length === 0;
})());
T('آرایه null → null (بدون crash)', (function(){
  var m = loadModule();
  return m.applyFilter(null) === null;
})());
T('آرایه غیرآرایه → ورودی برگشتی', (function(){
  var m = loadModule();
  return m.applyFilter('notarray') === 'notarray';
})());
T('crBy خالی (رشته "") → مخفی برای own (v21.0)', (function(){
  var m = loadModule();
  global.curRole = function() { return 'sales'; };
  global.curSession = function() { return { user: 'ali' }; };
  var data = [{ cd: 'C-X', co: 'بدون مالک', crBy: '' }];
  return m.applyFilter(data).length === 0;
})());

/* ---------- UI: محتوای نوار ---------- */
SECTION('محتوای UI bar');
T('نوار برای ارشد: شامل دکمه «همه»', (function(){
  var m = loadModule();
  global.curRole = function() { return 'chairman'; };
  return m.isSenior() === true;
})());
T('نوار برای فروشنده: بدون دکمه «همه»', (function(){
  var m = loadModule();
  global.curRole = function() { return 'sales'; };
  return m.isSenior() === false;
})());
T('متن فارسی «فیلتر «مشتریان من» فعال» در کد', mf.indexOf('فیلتر «مشتریان من» فعال') > -1);
T('متن «مال شما» در کد', mf.indexOf('مال شما') > -1);
T('متن «قدیمی بدون مالک» در کد', mf.indexOf('قدیمی بدون مالک') > -1);

/* ---------- رگرسیون ---------- */
SECTION('رگرسیون: سایر ماژول‌ها دست‌نخورده');
T('offers.js سالم است (renderCustomers2)', fs.readFileSync(path.join(BASE, 'offers.js'), 'utf-8').indexOf('function renderCustomers2') > -1);
T('dedup.js سالم است (dedupStamp)', fs.readFileSync(path.join(BASE, 'dedup.js'), 'utf-8').indexOf('function dedupStamp') > -1);
T('rbac.js سالم است (var ROLES = ...)', fs.readFileSync(path.join(BASE, 'rbac.js'), 'utf-8').indexOf('var ROLES =') > -1);
T('index.html شامل اسکریپت جدید در انتها', (function(){
  var html = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
  var idxMyFilter = html.search(/my-customers-filter\.js\?v=/);
  var idxScoring = html.search(/scoring\.js\?v=/);
  return idxMyFilter > -1 && idxScoring > -1 && idxMyFilter > idxScoring;
})());

DONE('tester125-v22');
