#!/usr/bin/env node
'use strict';
/* tester522 — v34.8.26 (DING-LOOP): پایان «دینگ هر چند ثانیه + 🔄 N بخش از دستگاه
   دیگر به‌روز شد».

   گزارش کارفرما پس از v34.8.26: تکرار کارت قطع شد ولی دینگ و پیام pull ادامه داشت.
   ریشه: وقتی notifiedUsers گم‌شده دیده می‌شد، سپر dkey کارت دوم نمی‌ساخت ولی کد
   added=true برمی‌گرداند (دینگ هر تیک) و دوباره entity_upsert می‌فرستاد
   (rev++ → toast pull در هر چرخه).

   فیکس: «حضور کارت زنده = خودِ state» — اگر برای (یادآور، گیرنده) کارت زنده هست،
   فقط state ساکت بازسازی می‌شود (added=false، بدون فرمان جدید) + گارد in-flight
   برای upsert. */
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

/* ---------- قراردادهای سورس ---------- */
var br = read('crm/bridge.js');
T('اسکن کارت‌های زنده به‌عنوان state (haveCard)', /var haveCard = \{\};[\s\S]{0,400}dk\.indexOf\('rem-due-'\) === 0/.test(br));
T('مسیر ساکت: کارت موجود → بدون added', /if \(haveCard\[String\(r\.cd\) \+ ':' \+ u\]\) \{[\s\S]{0,400}r\.notifiedUsers\[u\] = todayISO\(\);[\s\S]{0,80}changed = true;[\s\S]{0,60}return;/.test(br));
T('دینگ فقط برای کارت واقعاً تازه', /added = true; changed = true; \/\* فقط کارت واقعاً تازه → دینگ \*\//.test(br));
T('گارد in-flight برای فرمان یادآور', /_remUpsertInFlight = false;/.test(br) && /if \(!_remUpsertInFlight\) \{/.test(br));
T('پوش انبوه legacy فقط وقتی فرمان خاموش است', /else setData\('ptf_crm_reminders', rems\);/.test(br));

/* ---------- شبیه‌سازی رفتاری با توابع واقعی ---------- */
(function behavior() {
  function extract(startRe, endRe) {
    var a = br.search(startRe);
    if (a < 0) return '';
    var b = br.slice(a).search(endRe);
    return b < 0 ? '' : br.slice(a, a + b);
  }
  var addMsgSrc = extract(/function addMsg\(opt\) \{/, /\n  function isMine\(/);
  var checkSrc = extract(/\/\* v34\.8\.\d+ \(DING-LOOP\)/, /\/\* v34\.8\.\d+ \(CARTABLE-LOOP\): خودترمیم/);
  T('استخراج نسخهٔ جدید checkDueReminders', checkSrc.indexOf('haveCard') > -1 && checkSrc.length > 1200);

  function mkWorld(initialRems, initialNotifs, opts) {
    opts = opts || {};
    var store = {
      'ptf_crm_reminders': JSON.parse(JSON.stringify(initialRems)),
      'ptf_crm_notifs': JSON.parse(JSON.stringify(initialNotifs || []))
    };
    var upserts = 0, dings = 0;
    var w = {
      window: {
        PTF_ENTITY_CMD_ENABLED: { 'ptf_crm_reminders': true },
        ptfEntityUpsert: function (col, rec, o) {
          upserts++;
          /* شبیه‌سازی رفت‌وبرگشت کامل: سرور merge می‌کند و projection برمی‌گردد */
          var idx = -1;
          store.ptf_crm_reminders.forEach(function (x, i) { if (x.cd === rec.cd) idx = i; });
          if (idx > -1) {
            var cur = store.ptf_crm_reminders[idx];
            Object.keys(rec).forEach(function (k) { cur[k] = rec[k]; });
          }
          if (o && o.cb) setTimeout(function () { o.cb({ state: 'acked' }); }, 0);
          return null;
        }
      },
      curSession: function () { return { user: 'ali', name: 'علی' }; },
      getData: function (k) { return JSON.parse(JSON.stringify(store[k] || [])); },
      setData: function (k, v) { store[k] = JSON.parse(JSON.stringify(v)); },
      genCode: function (p2) { return p2 + '-' + (++w._ntf); },
      _ntf: 0,
      faDateTime: function () { return '۱۴۰۵/۰۶/۰۵'; },
      todayISO: function () { return '2026-08-27'; },
      ntfNeedsAction: function () { return true; },
      _dings: function () { return dings; },
      _upserts: function () { return upserts; },
      _store: store
    };
    return w;
  }

  var rem = function (nu) { return { cd: 'REM-100', st: 'open', dueISO: '2026-08-27', dueFa: '۱۴۰۵/۰۶/۰۵', title: 'یادآور تست', ownerUser: 'ali', notifiedUsers: nu || {} }; };

  /* سناریو ۱ — state گم‌شده + کارت زنده موجود: باید کاملاً ساکت باشد */
  (function () {
    var w = mkWorld([rem({})], [{ cd: 'NTF-1', kind: 'reminder', remCd: 'REM-100', title: '⏰ یک یادآوری داری: یادآور تست', done: false, toUsers: ['ali'], dkey: 'rem-due-REM-100:ali' }]);
    vm.createContext(w);
    vm.runInContext(addMsgSrc + '\n' + checkSrc, w);
    var added1 = vm.runInContext('checkDueReminders()', w);
    var added2 = vm.runInContext('checkDueReminders()', w);
    var added3 = vm.runInContext('checkDueReminders()', w);
    T('سناریو ۱: هیچ تیکی دینگ نمی‌زند (added=false)', !added1 && !added2 && !added3);
    T('سناریو ۱: حداکثر یک فرمان (بازسازی ساکت state)', w._upserts() <= 1, w._upserts());
    T('سناریو ۱: state بازسازی شد', w._store.ptf_crm_reminders[0].notifiedUsers && w._store.ptf_crm_reminders[0].notifiedUsers.ali === '2026-08-27');
    T('سناریو ۱: کارت تکراری ساخته نشد', w._store.ptf_crm_notifs.length === 1, w._store.ptf_crm_notifs.length);
  })();

  /* سناریو ۲ — یادآور واقعاً تازه: دینگ یک‌بار (کارت جدید) و بعد سکوت کامل */
  (function () {
    var w = mkWorld([rem({})], []);
    vm.createContext(w);
    vm.runInContext(addMsgSrc + '\n' + checkSrc, w);
    var added = [vm.runInContext('checkDueReminders()', w), vm.runInContext('checkDueReminders()', w), vm.runInContext('checkDueReminders()', w), vm.runInContext('checkDueReminders()', w)];
    T('سناریو ۲: فقط تیک اول دینگ دارد', added[0] === true && !added[1] && !added[2] && !added[3], JSON.stringify(added));
    T('سناریو ۲: فقط یک کارت', w._store.ptf_crm_notifs.length === 1, w._store.ptf_crm_notifs.length);
    T('سناریو ۲: حداکثر ۲ فرمان (کارت جدید + بازسازی ساکت، با in-flight)', w._upserts() <= 2, w._upserts());
    T('سناریو ۲: dkey پایدار', w._store.ptf_crm_notifs[0].dkey === 'rem-due-REM-100:ali');
  })();

  /* سناریو ۳ — چند گیرنده: کارت ali هست، کارت ghadimi نیست → فقط برای ghadimi دینگ */
  (function () {
    var r2 = rem({ ali: '2026-08-27' }); r2.shareUsers = ['ghadimi'];
    var w = mkWorld([r2], [{ cd: 'NTF-9', kind: 'reminder', remCd: 'REM-100', title: '⏰ یک یادآوری داری: یادآور تست', done: false, toUsers: ['ali'], dkey: 'rem-due-REM-100:ali' }]);
    vm.createContext(w);
    vm.runInContext(addMsgSrc + '\n' + checkSrc, w);
    var added = vm.runInContext('checkDueReminders()', w);
    T('سناریو ۳: دینگ فقط به‌خاطر کارت جدید گیرندهٔ دوم', added === true);
    T('سناریو ۳: دو کارت (ali موجود + ghadimi جدید)', w._store.ptf_crm_notifs.length === 2, w._store.ptf_crm_notifs.length);
    T('سناریو ۳: کارت جدید dkey گیرندهٔ دوم دارد', w._store.ptf_crm_notifs[0].dkey === 'rem-due-REM-100:ghadimi', w._store.ptf_crm_notifs[0].dkey);
    var added2 = vm.runInContext('checkDueReminders()', w);
    T('سناریو ۳: تیک بعد ساکت', added2 === false);
  })();

  /* سناریو ۴ — فرمان در فلایت: تیک‌های فشرده نباید طوفان فرمان بسازند */
  (function () {
    var w = mkWorld([rem({})], []);
    w.window.ptfEntityUpsert = function (col, rec, o) { w._ups(); if (o && o.cb) setTimeout(function () { o.cb({ state: 'acked' }); }, 50); return null; }; /* ACK کند */
    w._ups = function () { w.__u = (w.__u || 0) + 1; };
    vm.createContext(w);
    vm.runInContext(addMsgSrc + '\n' + checkSrc, w);
    for (var i = 0; i < 6; i++) vm.runInContext('checkDueReminders()', w);
    T('سناریو ۴: در ۶ تیک فشرده بیش از ۲ فرمان نمی‌رود (in-flight)', (w.__u || 0) <= 2, w.__u || 0);
    T('سناریو ۴: کارت تکراری صفر', w._store.ptf_crm_notifs.length === 1, w._store.ptf_crm_notifs.length);
  })();
})();

/* ---------- نسخه ---------- */
var ver = JSON.parse(read('VERSION.json'));
T('VERSION.json = v34.8.26', ver.crm_version === 'v34.8.26', ver.crm_version);
T('قرارداد نسخهٔ UI/sw = 34.8.26', /window\.PTF_CRM_RELEASE = 'v34\.8\.26'/.test(read('crm/index.html')) && /CACHE = 'ptf-crm-v34\.8\.26'/.test(read('crm/sw.js')));

console.log('\n— tester522 (v34.8.26: DING-LOOP) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
