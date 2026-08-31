#!/usr/bin/env node
'use strict';
/* tester525 — v34.13.0 (W1): مهاجرت فرمانی مشتریان/تامین‌کنندگان/کالاها.
   هسته: روتر diff-محور ptfEntitySaveCollection — استخراج واقعی از سورس و آزمون
   رفتاری: افزوده/ویرایش/حذف → تعداد و نوع فرمان درست؛ گاردهای fallback؛ استقلال
   snapshot از دستگاه‌های دیگر (هرگز حذف اشتباه). */
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

/* ---------- قراردادهای سرور ---------- */
var php = read('api/sales-domain.php');
T('رجیستری: مشتریان با ۸ نقش (عین ماتریس legacy)', /'ptf_crm_customers' => \[\s*'roles' => \['admin','chairman','ceo','commercial','sales','buyer','accountant','collector'\]/.test(php));
T('رجیستری: تامین‌کنندگان بدون accountant/collector', /'ptf_crm_suppliers' => \[\s*'roles' => \['admin','chairman','ceo','commercial','sales','buyer'\]/.test(php));
T('رجیستری: کالاها بدون collector', /'ptf_crm_products' => \[\s*'roles' => \['admin','chairman','ceo','commercial','sales','buyer','accountant'\]/.test(php));
T('maxFields=120 برای حداقل سه کلید W1', (php.match(/'maxFields' => 120/g) || []).length >= 3);
T('sanitizer از maxFields رجیستری استفاده می‌کند', /sd_entity_sanitize_row\(\$rec, \$sanitizeStats, \(int\)\(\$cfg\['maxFields'\] \?\? 40\)\)/.test(php));

/* ---------- روتر: استخراج و اجرا ---------- */
var sd = read('crm/sales-domain-v2.js');
var mFn = sd.match(/window\.ptfEntitySaveCollection = function \(collection, nextArr, opts\) \{[\s\S]*?\n  \};/);
T('ptfEntitySaveCollection استخراج شد', !!mFn);

function mkWorld(baseArr, opts) {
  opts = opts || {};
  var ups = [], dels = [], setDataCalls = 0;
  var w = {
    window: {
      PTF_ENTITY_CMD_ENABLED: { 'ptf_crm_reminders': true, 'ptf_crm_leads': true, 'ptf_crm_customers': true, 'ptf_crm_suppliers': true, 'ptf_crm_products': true },
      ptfEntityUpsert: function (col, rec, o) { ups.push({ col: col, rec: rec }); if (o && o.cb) o.cb({ state: 'acked' }); return null; },
      ptfEntityDelete: function (col, id, o) { dels.push({ col: col, id: id }); return null; },
      ptfEntityCommandMessage: function () { return 'x'; },
      _ptfEntityLastKnown: opts.lastKnown || null
    },
    getData: function (k) { return JSON.parse(JSON.stringify(baseArr)); },
    setData: function () { setDataCalls++; }
  };
  w._stats = function () { return { ups: ups, dels: dels, setDataCalls: setDataCalls }; };
  return w;
}
function cust(cd, co) { return { cd: cd, co: co, ph: '' }; }

/* سناریو ۱ — یک افزوده + یک ویرایش + یک حذف */
(function () {
  var base = [cust('C1', 'الف'), cust('C2', 'ب'), cust('C3', 'ج')];
  var w = mkWorld(base);
  vm.createContext(w);
  vm.runInContext(mFn[0], w);
  var next = [cust('C1', 'الف‌۲'), cust('C2', 'ب'), cust('C4', 'د')]; /* C1 ویرایش، C3 حذف، C4 جدید */
  var res = vm.runInContext('window.ptfEntitySaveCollection("ptf_crm_customers", ' + JSON.stringify(next) + ', {prevArr:' + JSON.stringify(base) + '})', w);
  T('سناریو ۱: حالت commands', res.mode === 'commands', JSON.stringify(res));
  T('سناریو ۱: ۲ upsert (C1 ویرایش + C4 جدید)', res.upserts === 2 && w._stats().ups.map(function (u) { return u.rec.cd; }).sort().join(',') === 'C1,C4', JSON.stringify(w._stats().ups.map(function (u) { return u.rec.cd; })));
  T('سناریو ۱: ۱ delete (C3)', res.deletes === 1 && w._stats().dels[0].id === 'C3', JSON.stringify(w._stats().dels));
  T('سناریو ۱: setData صدا نخورد', w._stats().setDataCalls === 0);
  T('سناریو ۱: snapshot به‌روز شد', w.window._ptfEntityLastKnown && w.window._ptfEntityLastKnown.ptf_crm_customers.length === 3);
})();

/* سناریو ۲ — بدون تغییر: صفر فرمان */
(function () {
  var base = [cust('C1', 'الف')];
  var w = mkWorld(base);
  vm.createContext(w);
  vm.runInContext(mFn[0], w);
  var res = vm.runInContext('window.ptfEntitySaveCollection("ptf_crm_customers", ' + JSON.stringify(base) + ', {prevArr:' + JSON.stringify(base) + '})', w);
  T('سناریو ۲: بدون تغییر → commands با صفر عملیات', res.mode === 'commands' && res.upserts === 0 && res.deletes === 0, JSON.stringify(res));
})();

/* سناریو ۳ — بیش از سقف: fallback کامل به setData */
(function () {
  var base = [], next = [];
  for (var i = 0; i < 50; i++) { base.push(cust('C' + i, 'x' + i)); next.push(cust('C' + i, 'y' + i)); }
  var w = mkWorld(base);
  vm.createContext(w);
  vm.runInContext(mFn[0], w);
  var res = vm.runInContext('window.ptfEntitySaveCollection("ptf_crm_customers", ' + JSON.stringify(next) + ', {prevArr:' + JSON.stringify(base) + ', maxOps: 40})', w);
  T('سناریو ۳: ۵۰ ویرایش → legacy (too-many-ops)', res.mode === 'legacy' && res.reason === 'too-many-ops:50', JSON.stringify(res));
  T('سناریو ۳: setData دقیقاً یک‌بار', w._stats().setDataCalls === 1);
})();

/* سناریو ۴ — رکورد بدون cd: fallback امن */
(function () {
  var base = [cust('C1', 'الف')];
  var w = mkWorld(base);
  vm.createContext(w);
  vm.runInContext(mFn[0], w);
  var res = vm.runInContext('window.ptfEntitySaveCollection("ptf_crm_customers", [{co:"بی‌کد"}], {prevArr:' + JSON.stringify(base) + '})', w);
  T('سناریو ۴: رکورد بی‌cd → legacy', res.mode === 'legacy' && res.reason === 'records-without-cd', JSON.stringify(res));
})();

/* سناریو ۵ — استقلال از دستگاه دیگر: رکوردِ غایب در snapshot ولی در next حاضر (پول‌شده) → فقط یک upsert idempotent، هرگز delete */
(function () {
  var snapshot = [cust('C1', 'الف')];
  var next = [cust('C1', 'الف'), cust('C9', 'از دستگاه دیگر')]; /* C9 با pull رسیده */
  var w = mkWorld([], { lastKnown: { ptf_crm_customers: snapshot } });
  w.getData = function () { return JSON.parse(JSON.stringify(next)); };
  vm.createContext(w);
  vm.runInContext(mFn[0], w);
  var res = vm.runInContext('window.ptfEntitySaveCollection("ptf_crm_customers", ' + JSON.stringify(next) + ')', w);
  T('سناریو ۵: بدون حذف', res.deletes === 0, JSON.stringify(w._stats().dels));
})();

/* سناریو ۶ — فرمان خاموش → legacy */
(function () {
  var w = mkWorld([cust('C1', 'الف')]);
  w.window.PTF_ENTITY_CMD_ENABLED = {};
  vm.createContext(w);
  vm.runInContext(mFn[0], w);
  var res = vm.runInContext('window.ptfEntitySaveCollection("ptf_crm_customers", [ {cd:"C1",co:"الف"} ], {})', w);
  T('سناریو ۶: فرمان خاموش → legacy', res.mode === 'legacy' && res.reason === 'cmd-off');
})();

/* ---------- قراردادهای کلاینت: نقاط اتصال ---------- */
var idx = read('crm/index.html');
T('saveCust/saveSup/saveProduct به روتر وصل شد', (idx.match(/window\.ptfEntitySaveCollection\(/g) || []).length >= 5, (idx.match(/window\.ptfEntitySaveCollection\(/g) || []).length);
T('leads تبدیل سرنخ→مشتری روی روتر', read('crm/leads.js').indexOf("ptfEntitySaveCollection('ptf_crm_customers'") > -1);
T('offers ثبت/ویرایش مشتری و تامین‌کننده روی روتر', (read('crm/offers.js').match(/ptfEntitySaveCollection\(/g) || []).length >= 5);
T('bridge درخواست سایت→مشتری روی روتر', (read('crm/bridge.js').match(/ptfEntitySaveCollection\(/g) || []).length >= 2);
T('inqreader بایپس خاموش‌نویسی حذف شد (مسیر مجاز)', read('crm/inqreader.js').indexOf('ptfSilentWrite') > -1);
T('ptfSilentWrite در sync.js تعریف شد (بدون dirty)', /window\.ptfSilentWrite = function \(k, str\) \{[\s\S]{0,200}state\.pulling = true;[\s\S]{0,80}wr\(k,/.test(read('crm/sync.js')));

/* ---------- A11: تطابق رجیستری کلاینت/سرور ---------- */
var clientKeys = (sd.match(/window\.PTF_ENTITY_CMD_ENABLED = \{([\s\S]*?)\};/)[1].match(/'ptf_crm_[a-z_]+'/g) || []).map(function (x) { return x.replace(/'/g, ''); }).sort();
var regFn = php.match(/function sd_entity_registry\s*\(\s*\)\s*:\s*array\s*\{[\s\S]*?\n\}/)[0];
var serverKeys = [];
regFn.replace(/'(ptf_crm_[a-z_]+)'\s*=>\s*\[/g, function (_, k) { if (serverKeys.indexOf(k) < 0) serverKeys.push(k); return ''; });
serverKeys.sort();
T('A11: تطابق کامل رجیستری کلاینت/سرور', JSON.stringify(clientKeys) === JSON.stringify(serverKeys), JSON.stringify(clientKeys) + ' vs ' + JSON.stringify(serverKeys));

/* ---------- نسخه ---------- */
var ver = JSON.parse(read('VERSION.json'));
T('VERSION.json = v34.13.0', ver.crm_version === 'v34.13.0', ver.crm_version);
T('قرارداد نسخهٔ UI/sw = 34.13.0', /window\.PTF_CRM_RELEASE = 'v34\.13.0'/.test(read('crm/index.html')) && /CACHE = 'ptf-crm-v34\.13.0'/.test(read('crm/sw.js')));

console.log('\n— tester525 (v34.13.0: W1 entity commands for customers/suppliers/products) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
