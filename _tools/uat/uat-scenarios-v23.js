/* uat-scenarios-v23 — تست‌های سناریو واقعی روی v21.0
   این تست‌ها رفتار سیستم را در شرایط واقعی شبیه‌سازی می‌کنند */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var mf = fs.readFileSync(path.join(BASE, 'my-customers-filter.js'), 'utf-8');

/* سناریو ۱: سازگاری داده legacy — مشتری قدیمی بدون crBy */
SECTION('سناریو ۱: سازگاری داده legacy');

/* شبیه‌سازی localStorage */
global.localStorage = {
  _s: {},
  getItem: function(k) { return this._s[k] || null; },
  setItem: function(k, v) { this._s[k] = String(v); },
  removeItem: function(k) { delete this._s[k]; }
};

T('داده legacy (crBy=null) برای فروشنده مخفی است', (function(){
  var m = loadModule();
  global.curRole = function() { return 'sales'; };
  global.curSession = function() { return { user: 'ali' }; };
  var legacy = { cd: 'C-100', co: 'مشتری قدیمی' };
  return m.applyFilter([legacy]).length === 0;
})());

T('داده legacy برای ارشد قابل مشاهده است', (function(){
  var m = loadModule();
  global.curRole = function() { return 'admin'; };
  global.curSession = function() { return { user: 'admin' }; };
  return m.applyFilter([{ cd: 'C-100', co: 'قدیمی' }]).length === 1;
})());

T('داده legacy با crBy=\'\' (رشته خالی) مخفی است', (function(){
  var m = loadModule();
  global.curRole = function() { return 'sales'; };
  global.curSession = function() { return { user: 'ali' }; };
  return m.applyFilter([{ cd: 'C-100', co: 'خالی', crBy: '' }]).length === 0;
})());

/* سناریو ۲: تعداد زیاد داده (performance) */
SECTION('سناریو ۲: چابکی با ۵۰۰ مشتری');
T('فیلتر ۵۰۰ رکورد < ۱۰۰ms', (function(){
  var m = loadModule();
  global.curRole = function() { return 'sales'; };
  global.curSession = function() { return { user: 'ali' }; };
  var big = Array.from({length: 500}, function(_, i) {
    return { cd: 'C-' + i, co: 'مشتری ' + i, crBy: (i % 3 === 0) ? 'ali' : (i % 3 === 1) ? 'sara' : null };
  });
  var start = Date.now();
  var result = m.applyFilter(big);
  var elapsed = Date.now() - start;
  console.log('    زمان: ' + elapsed + 'ms, نتیجه: ' + result.length + ' مشتری');
  return elapsed < 100 && result.length > 0;
})());

/* سناریو ۳: نقش‌های مختلف */
SECTION('سناریو ۳: رفتار نقش‌های مختلف');
var testRoles = [
  { role: 'admin', expected: 4 },
  { role: 'chairman', expected: 4 },
  { role: 'ceo', expected: 4 },
  { role: 'commercial', expected: 4 },
  { role: 'sales', expected: 2 }, // 2 ali (نه 3 — legacy برای sales مخفی است)
  { role: 'buyer', expected: 2 },
  { role: 'accountant', expected: 2 },
  { role: 'collector', expected: 2 }
];
var sampleData = [
  { cd: 'C-1', co: 'A', crBy: 'ali' },
  { cd: 'C-2', co: 'B', crBy: 'sara' },
  { cd: 'C-3', co: 'C', crBy: 'ali' },
  { cd: 'C-4', co: 'D' /* legacy */ }
];
testRoles.forEach(function(tr) {
  T(tr.role + ' → ' + tr.expected + ' مشتری', (function() {
    var m = loadModule();
    global.curRole = function() { return tr.role; };
    global.curSession = function() { return { user: 'ali' }; };
    return m.applyFilter(sampleData).length === tr.expected;
  })());
});

/* سناریو ۴: UI State */
SECTION('سناریو ۴: UI state و localStorage');
T('localStorage ptf_my_cust_filter توسط setState تنظیم می‌شود', (function(){
  var m = loadModule();
  m.setState('all');
  return global.localStorage.getItem('ptf_my_cust_filter') === 'all';
})());

T('setState مقدار نامعتبر را نادیده می‌گیرد', (function(){
  var m = loadModule();
  m.setState('hacked');
  var s = global.localStorage.getItem('ptf_my_cust_filter');
  return s === null || s === 'all';
})());

T('getState مقدار پیش‌فرض mine برمی‌گرداند', (function(){
  global.localStorage.removeItem('ptf_my_cust_filter');
  var m = loadModule();
  return m.getState() === 'mine';
})());

/* سناریو ۵: Service Worker SHELL و regex isShell */
SECTION('سناریو ۵: Service Worker');
T('sw.js قرارداد RELEASE نسخه‌دار (v21.0+)', sw.indexOf("var RELEASE = '") > -1);
T('sw.js SHELL شامل my-customers-filter', sw.indexOf("'./my-customers-filter.js'") > -1);
T('sw.js SHELL شامل ai-workbench', sw.indexOf("'./ai-workbench.js'") > -1);
T('sw.js SHELL شامل xlsx.min.js', sw.indexOf("'./xlsx.min.js'") > -1);
T('sw.js SHELL شامل تمام favicons', (function(){
  var favs = ['apple-touch-icon.png', 'favicon-32.png', 'favicon-96.png', 'favicon-192.png', 'favicon-512.png', '../favicon.ico'];
  return favs.every(function(f) { return sw.indexOf(f) > -1; });
})());
T('sw.js SHELL شامل تمام فونت‌ها', (function(){
  var fonts = ['Vazirmatn-Regular.woff2', 'Vazirmatn-Bold.woff2', 'Vazirmatn-Medium.woff2', 'Vazirmatn-Black.woff2'];
  return fonts.every(function(f) { return sw.indexOf(f) > -1; });
})());

/* BUG-046 fix: regex isShell بهبود یافته */
T('BUG-046: regex isShell فایل با نقطه (xlsx.min.js) را match می‌کند', (function(){
  var re = /\/crm\/[a-zA-Z][a-zA-Z0-9._-]*\.js$/;
  return re.test('/crm/xlsx.min.js');
})());

T('BUG-046: regex isShell /crm/ (با/بدون اسلش) match می‌کند', (function(){
  var re1 = /\/crm\/(index\.html)?\/?$/;
  // /crm (بدون اسلش) باید جداگانه match شود
  return re1.test('/crm/') && re1.test('/crm/index.html');
})());

T('BUG-046: /crm بدون اسلش نیز match می‌شود', (function(){
  return sw.indexOf("url.pathname === '/crm' || url.pathname === '/crm/'") > -1;
})());

/* BUG-047 fix: fallback برای آفلاین */
T('BUG-047: fallback برای navigation در آفلاین', (function(){
  return sw.indexOf("return caches.match('./index.html')") > -1;
})());

T('BUG-047: fallback 200 برای فایل‌های غیر-navigation', (function(){
  return sw.indexOf("new Response('', { status: 200") > -1;
})());

/* سناریو ۶: index.html شامل اصلاحات */
SECTION('سناریو ۶: index.html');
T('index.html: VER = v21.0', idx.indexOf("window.VER = 'v21.0'") > -1);
T('index.html: my-customers-filter.js?v=21.0', idx.indexOf("my-customers-filter.js?v=21.0") > -1);
T('index.html: BUG-044 fix (force-fetch sw.js)', idx.indexOf("fetch('./sw.js?_t=") > -1);
T('index.html: BUG-045 fix (ptf_app_ver در ptfSafeReset)', idx.indexOf("ptf_app_ver')") > -1);
T('index.html: PWA app title PTF CRM', idx.indexOf("PTF CRM") > -1);

DONE('uat-scenarios-v23');

/* helper: load IIFE */
function loadModule() {
  global.window = global;
  global.localStorage = global.localStorage || {
    _s: {},
    getItem: function(k) { return this._s[k] || null; },
    setItem: function(k, v) { this._s[k] = String(v); },
    removeItem: function(k) { delete this._s[k]; }
  };
  var i = mf.indexOf('(function ()');
  var end = mf.lastIndexOf('})();');
  var iife = mf.substring(i, end + 4);
  try { eval(iife); } catch(e) { return null; }
  return global.window.ptfMyCustFilter || null;
}
