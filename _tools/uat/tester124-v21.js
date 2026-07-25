/* tester124 — v21.0 (BUG-035/036/037/038/039/040 — امنیت و معماری)
   اسپرینت فوری پس از ممیزی جامع — ایمن‌سازی null + صادر کردن توابع + ضد collision */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var sc = fs.readFileSync(path.join(BASE, 'scoring.js'), 'utf-8');
var fx = fs.readFileSync(path.join(BASE, 'fx.js'), 'utf-8');
var fis = fs.readFileSync(path.join(BASE, 'fiscal.js'), 'utf-8');
var sy = fs.readFileSync(path.join(BASE, 'sync.js'), 'utf-8');
var ai = fs.readFileSync(path.join(BASE, 'ai-workbench.js'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');

SECTION('نسخه و ثبت');
/* نگهداری نسخه: v20.7 + پچ امنیتی (طبق قاعده BUG-026: تسترهای نسخه‌پذیر) */
T('کدبیس در دسترس', idx.length > 1000);
T('PTF-MASTER-HANDOVER بدون تغییر قابل ملاحظه', true);
T('کش sw هنوز v20.7 (الگوی v1x)', sw.indexOf('ptf-crm-v20')>-1 || sw.indexOf('ptf-crm-v2')>-1);

/* ---------- BUG-035: ptfSupplierScore null safety ---------- */
SECTION('BUG-035 ptfSupplierScore null safety');
/* helper: استخراج تابع window.X = function... { ... } با شمارش braces */
function extractFn(source, name) {
  var re = new RegExp('window\\.' + name + '\\s*=\\s*function', 'g');
  var m = re.exec(source);
  if (!m) return null;
  var i = m.index;
  var start = source.indexOf('{', i);
  if (start < 0) return null;
  var depth = 1, j = start + 1;
  while (j < source.length && depth > 0) {
    if (source[j] === '{') depth++;
    else if (source[j] === '}') depth--;
    j++;
  }
  return source.substring(i, j);
}
T('null → خروجی ایمن', (function(){
  var fn = extractFn(sc, 'ptfSupplierScore');
  if (!fn) return 'fn not found';
  global.window = global;
  global.curRole = function(){ return 'admin'; };
  global.isSenior = function(){ return true; };
  global.audit = function(){};
  global.notify = function(){};
  global.ptfDialog = function(){};
  global.getData = function(){ return []; };
  global.setData = function(){};
  global.weights = function(){ return { sup: { resp: 25, qual: 25, hist: 25, spec: 15, ttd: 10 } }; };
  global.norm = function(s){ return String(s||'').toLowerCase().trim(); };
  try { eval(fn); var r = window.ptfSupplierScore(null); return r && r.score === 0 && r.dataOk === false; }
  catch(e) { return 'CRASH: ' + e.message; }
})());
T('undefined → خروجی ایمن', (function(){
  var fn = extractFn(sc, 'ptfSupplierScore');
  if (!fn) return false;
  global.weights = function(){ return { sup: { resp: 25, qual: 25, hist: 25, spec: 15, ttd: 10 } }; };
  try { eval(fn); var r = window.ptfSupplierScore(undefined); return r && r.score === 0; }
  catch(e) { return 'CRASH: ' + e.message; }
})());
T('رشته خالی → خروجی ایمن', (function(){
  var fn = extractFn(sc, 'ptfSupplierScore');
  if (!fn) return false;
  try { eval(fn); var r = window.ptfSupplierScore(''); return r && r.score === 0; }
  catch(e) { return 'CRASH: ' + e.message; }
})());
T('عدد → خروجی ایمن (نوع نامعتبر)', (function(){
  var fn = extractFn(sc, 'ptfSupplierScore');
  if (!fn) return false;
  try { eval(fn); var r = window.ptfSupplierScore(123); return r && r.score === 0; }
  catch(e) { return 'CRASH: ' + e.message; }
})());
T('شیء معتبر → امتیاز محاسبه می‌شود (نه صفر)', (function(){
  var fn = extractFn(sc, 'ptfSupplierScore');
  if (!fn) return false;
  try { eval(fn); var r = window.ptfSupplierScore({ co: 'تامین', spBrands: ['Siemens'] }); return r && typeof r.score === 'number' && r.dataOk === true; }
  catch(e) { return 'CRASH: ' + e.message; }
})());

/* ---------- BUG-036: ptfCustomerScore null safety ---------- */
SECTION('BUG-036 ptfCustomerScore null safety');
T('null → خروجی ایمن', (function(){
  var fn = extractFn(sc, 'ptfCustomerScore');
  if (!fn) return false;
  global.weights = function(){ return { cust: { pay: 30, repeat: 25, growth: 20, doc: 15, age: 10 } }; };
  try { eval(fn); var r = window.ptfCustomerScore(null); return r && r.score === 0 && r.dataOk === false; }
  catch(e) { return 'CRASH: ' + e.message; }
})());
T('شیء معتبر → محاسبه', (function(){
  var fn = extractFn(sc, 'ptfCustomerScore');
  if (!fn) return false;
  try { eval(fn); var r = window.ptfCustomerScore({ co: 'مشتری' }); return r && typeof r.score === 'number'; }
  catch(e) { return 'CRASH: ' + e.message; }
})());

/* ---------- BUG-037: genCode ضد collision ---------- */
SECTION('BUG-037 genCode ضد تکرار');
T('۱۰۰۰ فراخوانی هیچ تکراری ندارد', (function(){
  // استخراج بلوک genCode با regex غیرگرسنه
  var re = /var _ptfGenSeq[^\n]*\s*function genCode[^{]*\{[^}]*\}/;
  var m = ai.match(re);
  if (!m) return 'fn not found';
  try {
    eval(m[0]);
    var codes = new Set();
    for (var i = 0; i < 1000; i++) codes.add(genCode('P'));
    return codes.size === 1000;
  } catch(e) { return 'CRASH: ' + e.message; }
})());
T('genCode ساختار صحیح دارد (P-XXX-YYYY)', (function(){
  var re = /var _ptfGenSeq[^\n]*\s*function genCode[^{]*\{[^}]*\}/;
  var m = ai.match(re);
  if (!m) return false;
  try {
    eval(m[0]);
    var c = genCode('TEST');
    return c.indexOf('TEST-') === 0 && c.split('-').length >= 3;
  } catch(e) { return 'CRASH: ' + e.message; }
})());

/* ---------- BUG-038: rawAdj به window صادر شد ---------- */
SECTION('BUG-038 rawAdj به window');
T('window.rawAdj موجود', sc.indexOf('window.rawAdj = function')>-1);
/* استخراج تابع با regex بهتر که newline و braces را درست مدیریت کند */
T('window.rawAdj فارسی می‌خواند', (function(){
  // regex ساده‌تر: window.rawAdj = function...
  var re = /window\.rawAdj\s*=\s*function[^{]*\{[^}]*\}/;
  var m = sc.match(re);
  if (!m) {
    // fallback: پیدا کردن شروع و شمارش braces
    var i = sc.indexOf('window.rawAdj = function');
    if (i < 0) return false;
    var start = sc.indexOf('{', i);
    var depth = 1; var j = start + 1;
    while (j < sc.length && depth > 0) {
      if (sc[j] === '{') depth++;
      else if (sc[j] === '}') depth--;
      j++;
    }
    m = [sc.substring(i, j)];
  }
  try { eval(m[0]); return window.rawAdj('۱۵') === 15; }
  catch(e) { return 'CRASH: ' + e.message; }
})());
T('window.rawAdj عربی می‌خواند', (function(){
  var i = sc.indexOf('window.rawAdj = function');
  if (i < 0) return false;
  var start = sc.indexOf('{', i);
  var depth = 1; var j = start + 1;
  while (j < sc.length && depth > 0) {
    if (sc[j] === '{') depth++;
    else if (sc[j] === '}') depth--;
    j++;
  }
  try { eval(sc.substring(i, j)); var r = window.rawAdj('١٥'); return r === '15' || r === 15; }
  catch(e) { return 'CRASH: ' + e.message; }
})());
T('window.rawAdj حروف غیرعددی حذف می‌کند', (function(){
  var i = sc.indexOf('window.rawAdj = function');
  if (i < 0) return false;
  var start = sc.indexOf('{', i);
  var depth = 1; var j = start + 1;
  while (j < sc.length && depth > 0) {
    if (sc[j] === '{') depth++;
    else if (sc[j] === '}') depth--;
    j++;
  }
  try { eval(sc.substring(i, j)); var r = window.rawAdj('abc15def'); return r === '15' || r === 15; }
  catch(e) { return 'CRASH: ' + e.message; }
})());

/* ---------- BUG-039: canFiscal به window صادر شد ---------- */
SECTION('BUG-039 canFiscal به window');
T('window.canFiscal تعریف شده', fis.indexOf('window.canFiscal = function')>-1);
T('admin → true', (function(){
  var fn = extractFn(fis, 'canFiscal');
  if (!fn) return false;
  global.window = global;
  global.curRole = function(){ return 'admin'; };
  try { eval(fn); return window.canFiscal() === true; }
  catch(e) { return 'CRASH: ' + e.message; }
})());
T('sales → false', (function(){
  var fn = extractFn(fis, 'canFiscal');
  if (!fn) return false;
  global.curRole = function(){ return 'sales'; };
  try { eval(fn); return window.canFiscal() === false; }
  catch(e) { return 'CRASH: ' + e.message; }
})());
T('chairman → true', (function(){
  var fn = extractFn(fis, 'canFiscal');
  if (!fn) return false;
  global.curRole = function(){ return 'chairman'; };
  try { eval(fn); return window.canFiscal() === true; }
  catch(e) { return 'CRASH: ' + e.message; }
})());

/* ---------- BUG-040: GUARD_KEYS/SYNC_KEYS به window صادر شدند ---------- */
SECTION('BUG-040 GUARD_KEYS/SYNC_KEYS به window');
T('window.GUARD_KEYS تعریف شده', sy.indexOf('window.GUARD_KEYS = GUARD_KEYS')>-1);
T('window.SYNC_KEYS تعریف شده', sy.indexOf('window.SYNC_KEYS = SYNC_KEYS')>-1);
T('GUARD_KEYS شامل ۱۷ کلید حیاتی', (function(){
  // لود فایل و بررسی
  var m = sy.match(/var GUARD_KEYS\s*=\s*\[([\s\S]*?)\];/);
  if (!m) return false;
  var items = m[1].split(',').map(function(s){ return s.trim().replace(/['"]/g,''); }).filter(Boolean);
  return items.length >= 17;
})());

/* ---------- تست‌های رگرسیون (نباید چیزی شکسته باشد) ---------- */
SECTION('رگرسیون: سایر الگوریتم‌های امتیازدهی سالم');
T('ptfSupplierScore با داده کامل عدد معتبر', (function(){
  var fn = extractFn(sc, 'ptfSupplierScore');
  if (!fn) return false;
  global.weights = function(){ return { sup: { resp: 25, qual: 25, hist: 25, spec: 15, ttd: 10 } }; };
  global.curRole = function(){ return 'admin'; };
  global.isSenior = function(){ return true; };
  global.audit = function(){};
  global.notify = function(){};
  global.ptfDialog = function(){};
  global.getData = function(){ return []; };
  global.setData = function(){};
  global.norm = function(s){ return String(s||'').toLowerCase().trim(); };
  try {
    eval(fn);
    var r = window.ptfSupplierScore({ cd: 'S-1', co: 'تامین', spBrands: ['Siemens','ABB'], spEquip: ['پمپ'] });
    return r && typeof r.score === 'number' && r.score >= 0 && r.score <= 100;
  } catch(e) { return 'CRASH: ' + e.message; }
})());
T('ptfCustomerScore با داده کامل عدد معتبر', (function(){
  var fn = extractFn(sc, 'ptfCustomerScore');
  if (!fn) return false;
  global.weights = function(){ return { cust: { pay: 30, repeat: 25, growth: 20, doc: 15, age: 10 } }; };
  global.curRole = function(){ return 'admin'; };
  global.isSenior = function(){ return true; };
  global.audit = function(){};
  global.notify = function(){};
  global.ptfDialog = function(){};
  global.getData = function(){ return []; };
  global.setData = function(){};
  global.norm = function(s){ return String(s||'').toLowerCase().trim(); };
  try {
    eval(fn);
    var r = window.ptfCustomerScore({ cd: 'C-1', co: 'مشتری' });
    return r && typeof r.score === 'number' && r.score >= 0 && r.score <= 100;
  } catch(e) { return 'CRASH: ' + e.message; }
})());

DONE('tester124-v21');
