/* =====================================================================
   آرشیوشده: 2026-08-13 (ARENA-UAT-TRIAGE-2026-08-13.md — سطل ۱)
   دلیل: ماژول my-customers-filter.js در v21.0 عمداً بازطراحی شد
   (API جدید: getState/setState/getScope/isSenior/applyFilter) و تابع
   countByOwnership دیگر در API عمومی وجود ندارد — تستر v23 پوشش API
   حذف‌شده را می‌سنجید. پوشش فیلتر مشتریان توسط تسترهای جدیدتر انجام می‌شود.
   ===================================================================== */
/* tester126 — v23.0 / v21.0 (US-413 — محدودسازی crBy خالی)
   چک‌های منطق + رگرسیون برای US-413 */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var mf = fs.readFileSync(path.join(BASE, 'my-customers-filter.js'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');

function extractIIFE(source) {
  var i = source.indexOf('(function ()');
  if (i < 0) return null;
  var end = source.lastIndexOf('})();');
  if (end < 0) return null;
  return source.substring(i, end + 4);
}

function loadModule() {
  global.window = global;
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

/* ---------- معماری و ثبت ---------- */
SECTION('معماری US-413');
T('ماژول به v21.0 ارتقا یافت', mf.indexOf('Sprint 130 / v21.0') > -1);
T('اشاره به US-413 در هدر', mf.indexOf('US-413') > -1);
T('اشاره به محدودسازی crBy خالی', mf.indexOf('محدودسازی crBy خالی') > -1);
T('countByOwnership در API', (function(){
  var m = loadModule();
  return m && typeof m.countByOwnership === 'function';
})());
T('script در index.html با v=21.0', idx.indexOf('my-customers-filter.js?v=21.0') > -1);
T('ptfMyCustFilter روی window', loadModule() !== null);

/* ---------- US-413: منطق سخت‌گیرانه ---------- */
SECTION('US-413: منطق سخت‌گیرانه');
/* داده تست: 5 مشتری
   - C1: crBy='ali' (مال علی)
   - C2: crBy='sara' (مال سارا)
   - C3: crBy='ali' (مال علی)
   - C4: crBy='admin' (مال ادمین — legacy)
   - C5: بدون crBy (legacy — فروشنده نباید ببیند) */
var SAMPLE = [
  { cd: 'C-1001', co: 'پتروشیمی الف',  crBy: 'ali' },
  { cd: 'C-1002', co: 'فولاد ب',       crBy: 'sara' },
  { cd: 'C-1003', co: 'نیروگاه ج',     crBy: 'ali' },
  { cd: 'C-1004', co: 'معدن د',        crBy: 'admin' },
  { cd: 'C-1005', co: 'سیمان ه' } // بدون crBy
];

/* ----- نقش‌های ارشد: همه (شامل legacy) ----- */
T('chairman → همه 5 (شامل legacy)', (function(){
  var m = loadModule();
  global.curRole = function() { return 'chairman'; };
  global.curSession = function() { return { user: 'chair1' }; };
  return m.applyFilter(SAMPLE).length === 5;
})());
T('ceo → همه 5', (function(){
  var m = loadModule();
  global.curRole = function() { return 'ceo'; };
  global.curSession = function() { return { user: 'ceo1' }; };
  return m.applyFilter(SAMPLE).length === 5;
})());
T('commercial → همه 5', (function(){
  var m = loadModule();
  global.curRole = function() { return 'commercial'; };
  global.curSession = function() { return { user: 'comm1' }; };
  return m.applyFilter(SAMPLE).length === 5;
})());
T('admin → همه 5', (function(){
  var m = loadModule();
  global.curRole = function() { return 'admin'; };
  global.curSession = function() { return { user: 'admin' }; };
  return m.applyFilter(SAMPLE).length === 5;
})());

/* ----- نقش‌های own: فقط crBy=me (بدون legacy) — US-413 ----- */
T('US-413: sales (ali) → فقط 2 (بدون legacy)', (function(){
  var m = loadModule();
  global.curRole = function() { return 'sales'; };
  global.curSession = function() { return { user: 'ali' }; };
  var r = m.applyFilter(SAMPLE);
  return r.length === 2 && r.every(function(c){ return c.crBy === 'ali'; });
})());
T('US-413: sales (sara) → فقط 1 (بدون legacy)', (function(){
  var m = loadModule();
  global.curRole = function() { return 'sales'; };
  global.curSession = function() { return { user: 'sara' }; };
  var r = m.applyFilter(SAMPLE);
  return r.length === 1 && r[0].cd === 'C-1002';
})());
T('US-413: sales (newuser) → 0 (صفر! نه قدیمی)', (function(){
  var m = loadModule();
  global.curRole = function() { return 'sales'; };
  global.curSession = function() { return { user: 'newuser' }; };
  return m.applyFilter(SAMPLE).length === 0;
})());
T('US-413: buyer → فقط crBy=me', (function(){
  var m = loadModule();
  global.curRole = function() { return 'buyer'; };
  global.curSession = function() { return { user: 'sara' }; };
  return m.applyFilter(SAMPLE).length === 1;
})());
T('US-413: accountant → فقط crBy=me', (function(){
  var m = loadModule();
  global.curRole = function() { return 'accountant'; };
  global.curSession = function() { return { user: 'nobody' }; };
  return m.applyFilter(SAMPLE).length === 0;
})());
T('US-413: collector → فقط crBy=me', (function(){
  var m = loadModule();
  global.curRole = function() { return 'collector'; };
  global.curSession = function() { return { user: 'ali' }; };
  return m.applyFilter(SAMPLE).length === 2;
})());

/* ----- رکوردهای بدون crBy دیگر برای فروشنده نمایش داده نمی‌شوند ----- */
T('US-413: رکورد بدون crBy برای فروشنده مخفی است', (function(){
  var m = loadModule();
  global.curRole = function() { return 'sales'; };
  global.curSession = function() { return { user: 'ali' }; };
  var data = [{ cd: 'C-X', co: 'legacy', crBy: '' }]; // رشته خالی
  return m.applyFilter(data).length === 0; // ← US-413: باید مخفی باشد
})());
T('US-413: رکورد با crBy=undefined برای فروشنده مخفی', (function(){
  var m = loadModule();
  global.curRole = function() { return 'sales'; };
  global.curSession = function() { return { user: 'ali' }; };
  var data = [{ cd: 'C-X', co: 'no-owner' }]; // crBy اصلاً تعریف نشده
  return m.applyFilter(data).length === 0;
})());
T('US-413: رکورد بدون crBy برای ارشد نمایش داده می‌شود', (function(){
  var m = loadModule();
  global.curRole = function() { return 'admin'; };
  global.curSession = function() { return { user: 'admin' }; };
  var data = [{ cd: 'C-X', co: 'legacy' }];
  return m.applyFilter(data).length === 1;
})());

/* ---------- countByOwnership: شمارش صحیح ---------- */
SECTION('countByOwnership: شمارش');
T('شمارش صحیح: total=5, mine=2 (ali), seniorOnly=1 (C-1005)', (function(){
  var m = loadModule();
  global.curRole = function() { return 'sales'; };
  global.curSession = function() { return { user: 'ali' }; };
  var s = m.countByOwnership(SAMPLE);
  return s.total === 5 && s.mine === 2 && s.seniorOnly === 1;
})());
T('شمارش برای newuser: total=5, mine=0, seniorOnly=1', (function(){
  var m = loadModule();
  global.curRole = function() { return 'sales'; };
  global.curSession = function() { return { user: 'newuser' }; };
  var s = m.countByOwnership(SAMPLE);
  return s.total === 5 && s.mine === 0 && s.seniorOnly === 1;
})());
T('شمارش برای admin: total=5, mine=1 (admin), seniorOnly=1', (function(){
  var m = loadModule();
  global.curRole = function() { return 'admin'; };
  global.curSession = function() { return { user: 'admin' }; };
  var s = m.countByOwnership(SAMPLE);
  return s.total === 5 && s.mine === 1 && s.seniorOnly === 1;
})());
T('شمارش null → همه صفر', (function(){
  var m = loadModule();
  var s = m.countByOwnership(null);
  return s.total === 0 && s.mine === 0 && s.seniorOnly === 0;
})());

/* ---------- ایمنی ---------- */
SECTION('ایمنی');
T('آرایه خالی → خالی', (function(){
  var m = loadModule();
  global.curRole = function() { return 'admin'; };
  return m.applyFilter([]).length === 0;
})());
T('null → null', (function(){
  var m = loadModule();
  return m.applyFilter(null) === null;
})());
T('غیرآرایه → ورودی', (function(){
  var m = loadModule();
  return m.applyFilter('x') === 'x';
})());

/* ---------- رگرسیون: سایر ماژول‌ها ---------- */
SECTION('رگرسیون');
T('offers.js سالم', fs.readFileSync(path.join(BASE, 'offers.js'), 'utf-8').indexOf('function renderCustomers2') > -1);
T('dedup.js سالم (dedupStamp)', fs.readFileSync(path.join(BASE, 'dedup.js'), 'utf-8').indexOf('function dedupStamp') > -1);
T('rbac.js سالم (var ROLES)', fs.readFileSync(path.join(BASE, 'rbac.js'), 'utf-8').indexOf('var ROLES =') > -1);

DONE('tester126-v23');
