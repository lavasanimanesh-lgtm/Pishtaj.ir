#!/usr/bin/env node
'use strict';
/* tester539 — v34.19.0 (T5-2b — DEV→IDB): تکمیل بخش دوم T5-2 رودمپ نازک‌سازی.
   قرارداد: کلیدهای تشخیصی فرمان (ptf_sales_command_uncertain_/not_committed_/
   recovered_ و ptf_offer_post_ack_warning_) دیگر مستقیم در localStorage نوشته
   نمی‌شوند؛ نمای واحد ptfDevKv (کلیدهای devkv:) روی IndexedDB همان لایهٔ
   ذخیره‌سازی می‌نویسد و فقط در نبود IDB به LS برمی‌گردد (fallback = وضع امروز).
   ۱) قرارداد منبع storage-quota.js (idbDelete/idbKeysByPrefix/ptfDevKv/مهاجرت امن)
   ۲) قرارداد منبع sales-domain-v2.js (صفر localStorage برای پیشوندهای هدف)
   ۳) رفتاری: اجرای storage-quota.js در vm با IDB/LS ساختگی — دور کامل
      set/get/keys/remove + fallback بدون IDB + مهاجرت LS→IDB (حذف LS فقط پس از
      موفقیت IDB — الگوی T5-3 رودمپ). */
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

/* ═══ ۱) قرارداد منبع: storage-quota.js ═══ */
var sq = read('crm/storage-quota.js');
T('idbDelete تعریف و صادر شد', /function idbDelete\(id, cb\)/.test(sq) && /window\.ptfStorageIdbDelete = idbDelete/.test(sq));
T('idbKeysByPrefix تعریف و صادر شد', /function idbKeysByPrefix\(prefix, cb\)/.test(sq) && /window\.ptfStorageIdbKeysByPrefix = idbKeysByPrefix/.test(sq));
T('نمای ptfDevKv با هر چهار عمل صادر شد', /window\.ptfDevKv = \{[\s\S]{0,220}set: devKvSet,[\s\S]{0,80}get: devKvGet,[\s\S]{0,80}remove: devKvRemove,[\s\S]{0,80}keys: devKvKeys/.test(sq));
T('ptfDevKvMigratePrefixes صادر شد', /window\.ptfDevKvMigratePrefixes = devKvMigratePrefixes/.test(sq));
T('شناسهٔ IDB با پیشوند devkv: ساخته می‌شود', /function devKvId\(key\) \{ return 'devkv:' \+ String\(key\); \}/.test(sq));
T('Dev-KV فقط با IDB سالم فعال می‌شود', /function devKvUsable\(\) \{\s*try \{ return !!\(window\.indexedDB && typeof idbSet === 'function' && typeof idbGet === 'function'\); \}/.test(sq));
T('fallback بدون IDB به LS (قرارداد رودمپ)', /if \(!devKvUsable\(\)\) \{ try \{ localStorage\.setItem\(key, String\(value\)\); cb && cb\(true\); \} catch \(eL\) \{ cb && cb\(false\); \} return; \}/.test(sq));
T('مهاجرت: حذف از LS فقط پس از موفقیت نوشتن IDB (الگوی T5-3)', /idbSet\(devKvId\(lk\), v, function \(ok\) \{\s*if \(ok\) \{ try \{ localStorage\.removeItem\(lk\); \} catch \(eD\) \{\} moved\+\+; \}/.test(sq));

/* ═══ ۲) قرارداد منبع: sales-domain-v2.js ═══ */
var sd = read('crm/sales-domain-v2.js');
T('persistCommandDiagnostic از Dev-KV می‌نویسد', /function persistCommandDiagnostic[\s\S]{0,420}devKvSet\(key,JSON\.stringify\(\{kind:kind/.test(sd));
T('صفر localStorage برای پیشوندهای تشخیصی فرمان (اصل E3)', !/localStorage\s*\.\s*(setItem|getItem|removeItem)\s*\([^)]*ptf_sales_command_|localStorage\s*\.\s*(setItem|getItem|removeItem)\s*\([^)]*ptf_offer_post_ack_warning_/.test(sd), 'هنوز ارجاع مستقیم LS هست');
T('پوشش‌های بی‌خطر devKv* تعریف شدند', /function devKvSet\(key, str\)/.test(sd) && /function devKvKeys\(prefix, cb\)/.test(sd));
T('اسکن uncertain از Dev-KV و async شد', /devKvKeys\('ptf_sales_command_uncertain_', function \(keys\)/.test(sd));
T('recover: ثبت not_committed از Dev-KV', /devKvSet\('ptf_sales_command_not_committed_'/.test(sd));
T('recover: ثبت recovered از Dev-KV', /devKvSet\('ptf_sales_command_recovered_'/.test(sd));
T('recover: حذف کلید uncertain از Dev-KV', /devKvRemove\(row\.key\)/.test(sd));
T('saveOfferAckWarning از Dev-KV می‌نویسد', /function saveOfferAckWarning[\s\S]{0,340}devKvSet\('ptf_offer_post_ack_warning_'/.test(sd));
T('مهاجرت boot برای پیشوندهای تشخیصی صدا زده می‌شود', /ptfDevKvMigratePrefixes\(\[[\s\S]{0,500}'ptf_sales_command_'[\s\S]{0,300}'ptf_offer_post_ack_warning_'/.test(sd)); /* v34.19.0: فهرست ۸پیشوندی کامل در tester541 */
T('دیالوگ «بررسی رسید فرمان» async پر می‌شود', /financeUncertainRows\(function \(rows\)/.test(sd) && /id="ptfFinanceStatusRows"/.test(sd));
T('financeUncertainRows دیگر localStorage را اسکن نمی‌کند', !/financeUncertainRows[\s\S]{0,700}localStorage\.length/.test(sd));

/* ═══ ۳) رفتاری: storage-quota.js در vm ═══ */
function fakeLocalStorage() {
  var m = {};
  return {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(m, k) ? m[k] : null; },
    setItem: function (k, v) { m[String(k)] = String(v); },
    removeItem: function (k) { delete m[String(k)]; },
    key: function (i) { return Object.keys(m)[i] || null; },
    clear: function () { m = {}; },
    get length() { return Object.keys(m).length; }
  };
}
function fakeIndexedDB() {
  var rows = {}; /* id -> record */
  function asyncReq(run) {
    var r = { onsuccess: null, onerror: null, result: null };
    setTimeout(function () { try { run(r); } catch (e) { if (r.onerror) r.onerror({}); } }, 0);
    return r;
  }
  var db = {
    close: function () {},
    transaction: function () {
      var ops = [];
      var tx = {
        objectStore: function () {
          return {
            put: function (rec) { ops.push(function () { rows[String(rec.id)] = { id: String(rec.id), value: String(rec.value), bytes: rec.bytes || 0, updatedAt: rec.updatedAt || '' }; }); },
            delete: function (id) { ops.push(function () { delete rows[String(id)]; }); },
            get: function (id) {
              return asyncReq(function (r) { r.result = rows[String(id)] || null; if (r.onsuccess) r.onsuccess(); });
            },
            openCursor: function () {
              return asyncReq(function (r) {
                var keys = Object.keys(rows), i = 0;
                function fire() {
                  if (i < keys.length) {
                    var idx = i++;
                    r.result = { key: keys[idx], value: rows[keys[idx]], continue: function () { setTimeout(fire, 0); } };
                  } else { r.result = null; }
                  if (r.onsuccess) r.onsuccess();
                }
                fire();
              });
            }
          };
        },
        oncomplete: null,
        onerror: null
      };
      setTimeout(function () {
        try { ops.forEach(function (op) { op(); }); if (tx.oncomplete) tx.oncomplete({}); }
        catch (e) { if (tx.onerror) tx.onerror({}); }
      }, 0);
      return tx;
    }
  };
  var idb = {
    open: function () { return asyncReq(function (r) { r.result = db; if (r.onsuccess) r.onsuccess(); }); },
    _rows: rows
  };
  return idb;
}
function runStorageQuota(withIDB) {
  var sandbox = {
    window: {},
    localStorage: fakeLocalStorage(),
    document: { getElementById: function () { return null; }, createElement: function () { return { style: {}, setAttribute: function () {}, appendChild: function () {} }; }, body: { appendChild: function () {} }, querySelectorAll: function () { return []; } },
    navigator: {},
    alert: function () {},
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    setInterval: function () { return 0; },
    clearInterval: function () {},
    console: { log: function () {} }
  };
  if (withIDB) { sandbox.indexedDB = fakeIndexedDB(); sandbox.window.indexedDB = sandbox.indexedDB; }
  vm.createContext(sandbox);
  vm.runInContext(sq, sandbox);
  return sandbox;
}
function kvCall(fn) { return new Promise(function (res) { fn(res); }); }

/* — سناریوی A: با IDB — */
var sb = runStorageQuota(true);
var KV = sb.window.ptfDevKv;
T('ptfDevKv در vm ساخته شد', !!KV && typeof KV.set === 'function' && typeof KV.get === 'function' && typeof KV.remove === 'function' && typeof KV.keys === 'function');
T('ptfDevKvUsable با IDB ساختگی true', sb.window.ptfDevKvUsable() === true);

var TESTKEY = 'ptf_sales_command_uncertain_TEST-1';
kvCall(function (cb) { KV.set(TESTKEY, JSON.stringify({ kind: 'uncertain', action: 'register_offer', operationId: 'TEST-1', at: '2026-08-29T10:00:00Z' }), cb); })
  .then(function (ok) {
    T('set در IDB موفق', ok === true);
    T('مقدار در IDB با پیشوند devkv: نشست (نه LS)', Object.keys(sb.indexedDB._rows).some(function (id) { return id === 'devkv:' + TESTKEY; }) && sb.localStorage.getItem(TESTKEY) === null);
    return kvCall(function (cb) { KV.get(TESTKEY, cb); });
  })
  .then(function (val) {
    T('get همان مقدار را برمی‌گرداند', /TEST-1/.test(String(val)));
    return kvCall(function (cb) { KV.keys('ptf_sales_command_uncertain_', cb); });
  })
  .then(function (keys) {
    T('keys کلید پیشوندی را برمی‌گرداند', keys.indexOf(TESTKEY) > -1);
    T('keys فقط پیشوند خواسته‌شده', keys.every(function (k) { return k.indexOf('ptf_sales_command_uncertain_') === 0; }));
    return kvCall(function (cb) { KV.remove(TESTKEY, cb); });
  })
  .then(function () {
    return kvCall(function (cb) { KV.keys('ptf_sales_command_uncertain_', cb); });
  })
  .then(function (keys2) {
    T('remove حذف کرد', keys2.indexOf(TESTKEY) < 0);

    /* — سناریوی B: بدون IDB → fallback به LS — */
    var sb2 = runStorageQuota(false);
    T('بدون IDB → ptfDevKvUsable=false ولی نمای موجود', sb2.window.ptfDevKvUsable() === false && !!sb2.window.ptfDevKv);
    return kvCall(function (cb) { sb2.window.ptfDevKv.set('ptf_offer_post_ack_warning_100', '{"w":1}', cb); }).then(function (ok2) {
      T('fallback: نوشتن در LS وقتی IDB نیست', ok2 === true && sb2.localStorage.getItem('ptf_offer_post_ack_warning_100') === '{"w":1}');

      /* — سناریوی C: مهاجرت امن LS→IDB — */
      sb.localStorage.setItem('ptf_sales_command_uncertain_LEGACY', '{"kind":"uncertain","action":"entity_upsert","operationId":"LEGACY"}');
      sb.localStorage.setItem('ptf_offer_post_ack_warning_990', '{"w":2}');
      return kvCall(function (cb) { sb.window.ptfDevKvMigratePrefixes(['ptf_sales_command_', 'ptf_offer_post_ack_warning_'], cb); });
    });
  })
  .then(function (moved) {
    T('مهاجرت هر دو کلید legacy را منتقل کرد', moved === 2, 'moved=' + moved);
    T('کلیدهای legacy از LS حذف شدند', sb.localStorage.getItem('ptf_sales_command_uncertain_LEGACY') === null && sb.localStorage.getItem('ptf_offer_post_ack_warning_990') === null);
    return kvCall(function (cb) { KV.get('ptf_sales_command_uncertain_LEGACY', cb); });
  })
  .then(function (v) {
    T('کلید legacy در Dev-KV قابل خواندن است', /LEGACY/.test(String(v)));
    /* مهاجرت دوباره = no-op (کلیدی در LS نیست) */
    return kvCall(function (cb) { sb.window.ptfDevKvMigratePrefixes(['ptf_sales_command_'], cb); });
  })
  .then(function (moved2) {
    T('مهاجرت تکراری no-op است', moved2 === 0, 'moved2=' + moved2);
    finish();
  })
  .catch(function (err) {
    T('زنجیرهٔ رفتاری بدون خطا', false, String(err && err.stack || err));
    finish();
  });

function finish() {
  console.log('\n— tester539 (v34.19.0: T5-2b DEV→IDB — تشخیصی‌های فرمان در IndexedDB) —');
  console.log('PASS: ' + p + ' | FAIL: ' + f);
  if (f > 0) process.exit(1);
}
