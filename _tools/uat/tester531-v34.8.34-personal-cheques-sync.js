#!/usr/bin/env node
'use strict';
/* tester531 — v34.8.45 (T5-2): چک‌های شخصی دیگر فقط-دستگاه نیستند.
   کلید جدید ptf_crm_personal_cheques: SYNC_KEYS (۶ جایگاه نقش) + رجیستری فرمانی +
   مهاجرت یک‌بارهٔ بوت (ادغام همهٔ ptf_personal_cheques_<user> → مشترک؛ پاک‌سازی legacy
   فقط بعد از ACK سرور). chPersonalAll حالا از مشترک می‌خواند (با دید legacy در انتظار). */
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

var sync = read('crm/sync.js');
T('SYNC_KEYS شامل personal_cheques', /'ptf_crm_fin_findings', 'ptf_crm_personal_cheques'\n  \];/.test(sync));
T('URGENT_SYNC_KEYS شامل personal_cheques', /'ptf_crm_corrections', 'ptf_crm_personal_cheques'/.test(sync));
['sales','buyer','accountant','collector'].forEach(function (r) {
  var seg = sync.match(r + ': \\[[\\s\\S]*?\\],?\\n')[0];
  T('نقش ' + r + ' شامل personal_cheques', seg.indexOf("'ptf_crm_personal_cheques'") > -1);
});
T('crm.php ماتریس کامل‌نقش‌ها', /'ptf_crm_fin_findings','ptf_crm_personal_cheques'\];/.test(read('api/crm.php')));
T('رجیستری سرور: personal_cheques (۸ نقش)', /'ptf_crm_personal_cheques' => \[\s*'roles' => \['admin','chairman','ceo','commercial','sales','buyer','accountant','collector'\]/.test(read('api/sales-domain.php')));
var sd = read('crm/sales-domain-v2.js');
T('روتر کلاینت فعال', /'ptf_crm_personal_cheques': true/.test(sd));
T('key-registry: DEV→REC منتقل شد', read('crm/key-registry.js').indexOf("'ptf_crm_personal_cheques', 'ptf_crm_rfqs'") > -1 && /DEV = \[(?![^\]]*ptf_personal_cheques_)/.test(read('crm/key-registry.js')));

var chq = read('crm/cheques.js');
T('chPersonalAll از کلید مشترک می‌خواند', /function chPersonalAll\(\)\{\s*var shared = chSharedRead\(\)/.test(chq) || chq.indexOf('var shared = chSharedRead()') > -1);
T('chSave در کلید مشترک می‌نویسد (merge)', /var mergedShared = sharedNow\.filter/.test(chq));
T('مهاجرت: پاک‌سازی legacy فقط بعد از ACK', /if \(st && st\.state === 'acked'\) \{[\s\S]{0,300}localStorage\.removeItem\(k2\)/.test(chq));
T('مهاجرت در بوت صدا زده می‌شود', /window\.chMigratePersonalToShared\(function \(r\)/.test(chq));

/* رفتاری: مهاجرت با vm */
(function behavior() {
  var src = chq;
  var a = src.indexOf('window.chMigratePersonalToShared = function');
  var b = src.indexOf('  // v29.7 FIN-WF-002', a);
  /* هلپرهای chSharedRead/chSharedWrite هم داخل سندباکس لازم‌اند */
  var h1 = src.indexOf('  var CH_SHARED_KEY =');
  var h2 = src.indexOf('  function chPersonalAll()', h1);
  var helpers = src.slice(h1, h2);
  var fnSrc = helpers + '\n' + src.slice(a, b);
  T('استخراج تابع مهاجرت + هلپرها', fnSrc.length > 1200 && fnSrc.indexOf('chSharedRead') > -1);
  var lsStore = {
    'ptf_personal_cheques_ali': JSON.stringify([{ cd: 'PC1', ownership: 'personal', by: 'ali', bank: 'ملت' }]),
    'ptf_personal_cheques_sara': JSON.stringify([{ cd: 'PC2', ownership: 'personal', by: 'sara', bank: 'صادرات' }])
  };
  var idbShared = [];
  var acked = null;
  var w = {
    window: { ptfEntitySaveCollection: function (col, arr, opts) { idbShared = arr; if (opts && opts.cb) setTimeout(function () { opts.cb({ state: 'acked' }); }, 0); return null; } },
    getData: function (k) { return []; },
    setData: function () {},
    localStorage: {
      _d: lsStore,
      key: function (i) { return Object.keys(this._d)[i] || null; },
      get length() { return Object.keys(this._d).length; },
      getItem: function (k) { return this._d[k] !== undefined ? this._d[k] : null; },
      removeItem: function (k) { delete this._d[k]; }
    }
  };
  w.window.localStorage = w.localStorage;
  vm.createContext(w);
  vm.runInContext(fnSrc, w);
  w.acked = null;
  vm.runInContext('window.chMigratePersonalToShared(function (r) { window.__ackResult = r; })', w);
  setTimeout(function () {
    var ack2 = vm.runInContext('window.__ackResult', w);
    T('رفتاری: ۲ رکورد از ۲ کاربر ادغام شد', ack2 && ack2.moved === 2, JSON.stringify(ack2));
    T('رفتاری: ACK سرور گرفته شد', ack2 && ack2.acked === true);
    T('رفتاری: کلیدهای legacy پاک شدند', !lsStore['ptf_personal_cheques_ali'] && !lsStore['ptf_personal_cheques_sara']);
    T('رفتاری: کلید مشترک ۲ رکورد دارد', idbShared.length === 2, idbShared.length);

    var ver = JSON.parse(read('VERSION.json'));
    T('VERSION.json = v34.8.45', ver.crm_version === 'v34.8.45', ver.crm_version);
    T('قرارداد نسخهٔ UI/sw = 34.8.45', /window\.PTF_CRM_RELEASE = 'v34\.8.45'/.test(read('crm/index.html')) && /CACHE = 'ptf-crm-v34\.8.45'/.test(read('crm/sw.js')));
    console.log('\n— tester531 (v34.8.45: personal cheques sync) —');
    console.log('PASS: ' + p + ' | FAIL: ' + f);
    process.exit(f ? 1 : 0);
  }, 10);
})();
