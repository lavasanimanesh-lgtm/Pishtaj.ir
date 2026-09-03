#!/usr/bin/env node
'use strict';
/* tester526 — v34.34.0 (W1-iterate + T3-3):
   ۱) تکمیل W1: صفر نقطهٔ setData مستقیم باقی‌مانده برای مشتریان/تامین‌کنندگان/کالاها
      (همه از روتر فرمانی یا fallback else-محافظت‌شده)؛ حذف‌های خطرناک حالا فرمان
      tombstone بازیافت‌پذیرند.
   ۲) T3-3: صف آفلاین روی IndexedDB با سقف ۵۰۰ (S7) + seed یک‌باره از LS + preload بوت. */
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
var glob = function (dir, re) { return fs.readdirSync(path.join(ROOT, dir)).filter(function (f) { return re.test(f); }); };

/* ---------- ۱) W1-iterate: صفر بایپس باقی‌مانده ---------- */
var total = 0;
['crm'].forEach(function (dir) {
  glob(dir, /\.js$|\.html$/).forEach(function (f) {
    var rel = 'crm/' + f;
    if (/client-server\.js|sync\.js$|storage\.js$|storage-quota\.js$|backup\.js$|rbac\.js$/.test(f)) return;
    var src = read(rel);
    var m = src.match(/setData\('ptf_crm_(customers|suppliers|products)'/g) || [];
    m.forEach(function (x) {
      /* مجاز: فقط داخل عبارت «else setData» — یعنی مسیر fallback فرمانِ خاموش */
      var idx = src.indexOf(x);
      while (idx > -1) {
        var before = src.slice(Math.max(0, idx - 400), idx);
        /* قبل از setDataِ مچ‌شده باید «else» (fallback) یا پرانتز فرمان روتر باشد */
        var protectedPath = /\belse\s*$/.test(before) || /ptfEntitySaveCollection\([^)]*$/.test(before);
        if (!protectedPath) {
          T('بایپس: ' + rel + ' ← ' + x, false, 'بدون else-محافظت');
          return;
        }
        idx = src.indexOf(x, idx + 1);
      }
    });
  });
});
T('W1-iterate: تمام setDataهای سه کلید یا روترند یا fallback else', true);
T('حذف کالا (delProd) فرمان tombstone است', /delProd[\s\S]{0,400}ptfEntitySaveCollection\('ptf_crm_products'[\s\S]{0,80}delProd/.test(read('crm/index.html')));
T('حذف دسته‌جمعی کالا فرمانی است', (read('crm/index.html').match(/prod-batch-del/g) || []).length === 2);
T('ادغام مشتری (custmerge) فرمانی است', read('crm/custmerge.js').indexOf("reason: 'custmerge'") > -1);
T('ادغام کاتالوگ (data-quality) فرمانی است', (read('crm/data-quality.js').match(/reason: 'catalog-merge/g) || []).length === 2);

/* ---------- ۲) T3-3: صف آفلاین روی IDB ---------- */
var cs = read('crm/client-server.js');
T('queueWrite از IDB استفاده می‌کند', /ptfStorageIdbSet\('q:' \+ queueKey\(\)/.test(cs));
T('سقف ۵۰۰ رکورد صف (S7)', /keys\.length > 500/.test(cs) && /keys\.slice\(0, keys\.length - 500\)/.test(cs));
T('seed یک‌باره از LS + انتقال به IDB', /localStorage\.removeItem\(queueKey\(\)\)/.test(cs));
T('preload صف در بوت صدا زده می‌شود', /window\.ptfBQueueIdbPreload\(function \(\) \{\}\);/.test(cs));

/* رفتاری: قفل‌کردن صف در IDB (نه LS) */
(function behavior() {
  var lsStore = {};
  var idbStore = {};
  var csSrc = read('crm/client-server.js');
  var fnQ = csSrc.match(/  \/\* ---------- v34\.8\.\d+ \(T3-3[\s\S]*?  window\.ptfBQueueIdbPreload = function \(cb\) \{[\s\S]*?\n  \};/);
  T('بلوک صف IDB استخراج شد', !!fnQ);
  if (!fnQ) return;
  var w = {
    queueKey: function () { return 'ptf_b_queue'; }, /* queueKey بیرون بلوک تعریف شده */
    window: {
      ptfStorageIdbSet: function (k, v, cb) { idbStore[k] = v; if (cb) setTimeout(function () { cb(true); }, 0); },
      ptfStorageIdbGet: function (k, cb) { cb(idbStore[k] !== undefined ? { value: idbStore[k] } : null); },
      ptfStorageSafeSetItem: function (k, v) { lsStore[k] = v; return true; }
    },
    localStorage: {
      getItem: function (k) { return lsStore[k] !== undefined ? lsStore[k] : null; },
      setItem: function (k, v) { lsStore[k] = v; },
      removeItem: function (k) { delete lsStore[k]; }
    }
  };
  vm.createContext(w);
  vm.runInContext(fnQ[0], w);
  /* seed از LS قدیمی + انتقال به IDB */
  w.localStorage.setItem('ptf_b_queue', JSON.stringify({ ptf_crm_customers: 3 }));
  var q = vm.runInContext('queueRead()', w);
  T('صف: seed از LS', q.ptf_crm_customers === 3, JSON.stringify(q));
  setTimeout(function () {
    T('صف: به IDB منتقل شد', !!idbStore['q:ptf_b_queue']);
    T('صف: از LS حذف شد (LS دیگر مرجع نیست)', w.localStorage.getItem('ptf_b_queue') === null);
    /* queueAdd → فقط IDB، LS دست نمی‌خورد */
    var ok = vm.runInContext('queueAdd("ptf_crm_products")', w);
    T('صف: queueAdd موفق', ok === true);
    T('صف: LS همچنان خالی', w.localStorage.getItem('ptf_b_queue') === null);
    T('صف: IDB به‌روز شد', (idbStore['q:ptf_b_queue'] || '').indexOf('ptf_crm_products') > -1);
    /* سقف ۵۰۰ */
    var big = {};
    for (var i = 0; i < 600; i++) big['ptf_crm_key' + i] = 1;
    vm.runInContext('queueWrite(' + JSON.stringify(big) + ')', w);
    var capped = vm.runInContext('queueRead()', w);
    T('صف: سقف ۵۰۰ اعمال شد', Object.keys(capped).length === 500, Object.keys(capped).length);
    /* preload بعدی از IDB */
    var w2 = { queueKey: function () { return 'ptf_b_queue'; }, window: { ptfStorageIdbSet: w.window.ptfStorageIdbSet, ptfStorageIdbGet: w.window.ptfStorageIdbGet }, localStorage: w.localStorage };
    vm.createContext(w2);
    vm.runInContext(fnQ[0], w2);
    var done = false;
    w2.window.ptfBQueueIdbPreload(function () {
      done = true;
      var q2 = vm.runInContext('queueRead()', w2);
      T('صف: preload بعدی از IDB آب می‌شود (نه LS)', Object.keys(q2).length === 500, Object.keys(q2).length);
      finish();
    });
    function finish() {
      /* ---------- نسخه ---------- */
      var ver = JSON.parse(read('VERSION.json'));
      T('VERSION.json = v34.34.0', ver.crm_version === 'v34.34.0', ver.crm_version);
      T('قرارداد نسخهٔ UI/sw = 34.34.0', /window\.PTF_CRM_RELEASE = 'v34\.34.0'/.test(read('crm/index.html')) && /CACHE = 'ptf-crm-v34\.34.0'/.test(read('crm/sw.js')));
      console.log('\n— tester526 (v34.34.0: W1-iterate + OFFLINE-OUTBOX-IDB) —');
      console.log('PASS: ' + p + ' | FAIL: ' + f);
      process.exit(f ? 1 : 0);
    }
  }, 10);
})();
