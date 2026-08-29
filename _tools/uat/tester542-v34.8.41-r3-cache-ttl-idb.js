#!/usr/bin/env node
'use strict';
/* tester542 — v34.8.50 (R3/T3-4 — CACHE→IDB: لایهٔ کش read-through با TTL)
   قرارداد: کلیدهای دستهٔ CACHE (صندوق سایت، نرخ ارز، مصرف ابر) دیگر در localStorage
   نوشته نمی‌شوند؛ از نمای ptfCache (ردیف «cache:<key>» در IDB با پوشنهٔ {v,at,ttl})
   عبور می‌کنند. TTL منقضی → read=null؛ readStale تا ۷ روز fallback خطا؛ sweep
   ردیف‌های >۷روز منقضی را حذف و معتبرها را به حافظه می‌آورد. رندرهای سنکرون از
   ptfCacheReadSync (حافظه + legacy LS تا مهاجرت) می‌خوانند — کش دستگاه‌های موجود
   حفظ می‌شود. بدون IDB → همان پوشنه در LS (fallback = رفتار امروز).
   پوشش: قرارداد منبع (storage-quota/bridge/fx/storage/buycompare/archive/registry)
   + رفتاری: اجرای storage-quota.js در vm با IDB/LS ساختگی (الگوی tester539). */
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

var sq = read('crm/storage-quota.js');
var bridge = read('crm/bridge.js');
var fx = read('crm/fx.js');
var storage = read('crm/storage.js');
var bcmp = read('crm/buycompare.js');
var arch = read('crm/archive.js');
var kr = read('crm/key-registry.js');

/* ═══ ۱) لایهٔ ptfCache در storage-quota.js ═══ */
T('ptfCacheWrite/Read/ReadStale/ReadSync/ReadRec/Drop/Hydrate/Sweep تعریف شدند',
  ['ptfCacheWrite','ptfCacheRead','ptfCacheReadStale','ptfCacheReadSync','ptfCacheReadRec','ptfCacheDrop','ptfCacheHydrate','ptfCacheSweep']
    .every(function (n) { return sq.indexOf('window.' + n + ' =') > -1; }));
T('پوشنهٔ کش {v, at, ttl} با شناسهٔ cache: در IDB', /function cacheId\(key\) \{ return 'cache:' \+ String\(key\); \}/.test(sq) && /\{ v: String\(value\), at: Date\.now\(\), ttl: Math\.max\(0, \(\+ttlSec \|\| 0\)\) \* 1000 \}/.test(sq));
T('پس از ثبت موفق IDB، کپی LS حذف می‌شود (کش قابل‌تخلیه)', /idbSet\(cacheId\(key\), JSON\.stringify\(rec\), function \(ok\) \{\s*if \(ok\) \{ try \{ localStorage\.removeItem\(key\); \}/.test(sq));
T('read فقط مقدار تازه (TTL) می‌دهد', /cb\(rec && \(!rec\.ttl \|\| \(Date\.now\(\) - rec\.at\) <= rec\.ttl\) \? rec\.v : null\)/.test(sq));
T('legacy خام LS → rec با at=0 (پذیرش بدون شکستن)', /if \(!rec\) rec = \{ v: String\(lv\), at: 0, ttl: 0, legacy: true \};/.test(sq));
T('fallback بدون IDB همان پوشنه را در LS می‌نویسد', /else \{ try \{ localStorage\.setItem\(key, JSON\.stringify\(rec\)\); \} catch \(eL\) \{\} \}/.test(sq));
T('sweep: منقضی > TTL+۷روز حذف؛ معتبرها به حافظه', /rec\.ttl > 0 && \(Date\.now\(\) - rec\.at\) > rec\.ttl \+ 7 \* 86400000/.test(sq) && /cacheMem\[id\.slice\('cache:'.length\)\] = rec;/.test(sq));
T('sweep در بوت لایهٔ ذخیره‌سازی صدا زده می‌شود', /try \{ window\.ptfCacheSweep\(\); \} catch \(eSw\) \{\}/.test(sq));

/* ═══ ۲) bridge.js — صندوق سایت ═══ */
T('bridge: helpers siteCacheGet/Set با TTL پیش‌فرض ۲۴س', /var SITE_CACHE_TTL_SEC = 86400;/.test(bridge) && /function siteCacheGet\(k\)/.test(bridge) && /function siteCacheSet\(k, v, ttlSec\)/.test(bridge));
T('bridge: صفر نوشتن مستقیم LS برای ptf_site_*', !/localStorage\s*\.\s*setItem\([^)]*ptf_site_/.test(bridge), 'نوشتن مستقیم باقی است');
T('bridge: خواننده‌های رندر از siteCacheGet (با fallback legacy)', /JSON\.parse\(siteCacheGet\('ptf_site_suppliers'\) \|\| '\[\]'\)/.test(bridge));
T('bridge: since-signature بدون TTL نوشته می‌شود (cursor)', /siteCacheSet\('ptf_site_inbox_sig', String\(d\.since \|\| ''\), 0\)/.test(bridge));
T('bridge: آب‌رسانی بوت هر ۴ کلید کش سایت', /ptfCacheHydrate\(\['ptf_site_suppliers', 'ptf_site_suppliers_total', 'ptf_site_rfqs', 'ptf_site_inbox_sig'\]\)/.test(bridge));

/* ═══ ۳) fx.js ═══ */
T('fx: نسخهٔ پایدار در ptfCache با TTL ۶س (sessionStorage می‌ماند)', /ptfCacheWrite\('ptf_fx_live_cache', str, 21600\)/.test(fx));
T('fx: نوشتن LS فقط fallback بدون ptfCache', /\|\| \{ try \{ localStorage\.setItem\('ptf_fx_live_cache', str\); \} catch \(eLs\) \{\} \}/.test(fx.replace('else', '||') .replace('else','||')) || /else \{ try \{ localStorage\.setItem\('ptf_fx_live_cache', str\); \} catch \(eLs\) \{\} \}/.test(fx));
T('fx: آب‌رسانی بوت از ptfCacheReadStale + به‌روزرسانی تیکر', /ptfCacheReadStale\('ptf_fx_live_cache'/.test(fx) && /el\.innerHTML = fxTickerContentHtml\(d\);/.test(fx.slice(fx.indexOf('ptfCacheReadStale'))));

/* ═══ ۴) storage.js — مصرف ابر ═══ */
T('storage: ptfCloudUsage از ptfCache می‌خواند/می‌نویسد (TTL 600s)', /ptfCacheWrite\('ptf_cloud_usage', JSON\.stringify\(rec\), 600\)/.test(storage) && /ptfCacheRead\('ptf_cloud_usage'/.test(storage));
T('storage: fallback خطا = نسخهٔ منقضی از ptfCacheReadStale (جای backup)', /fallbackStale/.test(storage) && /ptfCacheReadStale\('ptf_cloud_usage'/.test(storage));
T('storage: دیگر ptf_cloud_usage_backup نوشته نمی‌شود', !/setItem\('ptf_cloud_usage_backup'/.test(storage));
T('storage: مهاجرت بوتِ legacy LS', /ptfCacheHydrate\(\['ptf_cloud_usage'\]\)/.test(storage));

/* ═══ ۵) buycompare + archive ═══ */
T('buycompare: خواندن سبک از ptfCacheReadSync با fallback legacy', /ptfCacheReadSync\?window\.ptfCacheReadSync\('ptf_site_suppliers'\):null/.test(bcmp) && (bcmp.match(/ptfCacheReadSync\('ptf_site_suppliers'\)/g) || []).length === 2);
T('archive: ابطال کش از ptfCacheDrop (+ legacy LS)', /ptfCacheDrop\) window\.ptfCacheDrop\('ptf_cloud_usage'\)/.test(arch) && (arch.match(/ptfCacheDrop\('ptf_cloud_usage'\)/g) || []).length === 4);

/* ═══ ۶) registry ═══ */
T('registry: دستهٔ CACHE به ptfCache اشاره می‌کند', /CACHE: \{ store: 'ptfCache-idb-read-through-ttl'/.test(kr));

/* ═══ ۷) رفتاری: storage-quota.js در vm ═══ */
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
  var rows = {};
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
            get: function (id) { return asyncReq(function (r) { r.result = rows[String(id)] || null; if (r.onsuccess) r.onsuccess(); }); },
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
        oncomplete: null, onerror: null
      };
      setTimeout(function () {
        try { ops.forEach(function (op) { op(); }); if (tx.oncomplete) tx.oncomplete({}); }
        catch (e) { if (tx.onerror) tx.onerror({}); }
      }, 0);
      return tx;
    }
  };
  return { open: function () { return asyncReq(function (r) { r.result = db; if (r.onsuccess) r.onsuccess(); }); }, _rows: rows };
}
var sb = { window: {}, localStorage: fakeLocalStorage(),
  document: { getElementById: function () { return null; }, createElement: function () { return { style: {}, setAttribute: function () {}, appendChild: function () {} }; }, body: { appendChild: function () {} }, querySelectorAll: function () { return []; } },
  navigator: {}, alert: function () {}, setTimeout: setTimeout, clearTimeout: clearTimeout,
  setInterval: function () { return 0; }, clearInterval: function () {}, console: { log: function () {} } };
sb.indexedDB = fakeIndexedDB(); sb.window.indexedDB = sb.indexedDB;
vm.createContext(sb);
vm.runInContext(sq, sb);
function call(fn) { return new Promise(function (res) { fn(res); }); }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

(async function () {
  var W = sb.window;
  T('vm: ptfCache ساخته شد', typeof W.ptfCacheWrite === 'function' && typeof W.ptfCacheRead === 'function');
  W.ptfCacheWrite('ptf_site_suppliers', '[{"code":"S1"}]', 86400);
  await sleep(30);
  T('vm: ردیف cache: در IDB نشست و LS خالی ماند', !!sb.indexedDB._rows['cache:ptf_site_suppliers'] && sb.localStorage.getItem('ptf_site_suppliers') === null);
  T('vm: readSync همان مقدار را می‌دهد', W.ptfCacheReadSync('ptf_site_suppliers') === '[{"code":"S1"}]');
  var fresh = await call(function (cb) { W.ptfCacheRead('ptf_site_suppliers', cb); });
  T('vm: read مقدار تازه می‌دهد', fresh === '[{"code":"S1"}]');
  var stale = await call(function (cb) { W.ptfCacheReadStale('ptf_site_suppliers', cb); });
  T('vm: readStale مقدار می‌دهد', stale === '[{"code":"S1"}]');
  await sleep(15);
  W.ptfCacheWrite('ptf_fx_live_cache', '{"ok":true}', 0.001); /* 1ms */
  await sleep(30);
  var expired = await call(function (cb) { W.ptfCacheRead('ptf_fx_live_cache', cb); });
  T('vm: TTL منقضی → read=null', expired === null);
  var stillThere = await call(function (cb) { W.ptfCacheReadStale('ptf_fx_live_cache', cb); });
  T('vm: منقضی هنوز با readStale سرو می‌شود (fallback)', stillThere === '{"ok":true}');
  /* legacy خام LS → پذیرش */
  sb.localStorage.setItem('ptf_site_rfqs', '[{"r":"L1"}]');
  T('vm: legacy خام LS از readSync پذیرده می‌شود', W.ptfCacheReadSync('ptf_site_rfqs') === '[{"r":"L1"}]');
  /* hydrate مهاجرت: legacy → IDB و حذف LS */
  W.ptfCacheHydrate(['ptf_site_rfqs']);
  await sleep(30);
  T('vm: hydrate مهاجرت کرد (IDB دارد، LS خالی)', !!sb.indexedDB._rows['cache:ptf_site_rfqs'] && sb.localStorage.getItem('ptf_site_rfqs') === null);
  /* drop */
  W.ptfCacheDrop('ptf_site_suppliers');
  await sleep(30);
  var gone = await call(function (cb) { W.ptfCacheReadStale('ptf_site_suppliers', cb); });
  T('vm: drop از حافظه و IDB حذف کرد', gone === null && !sb.indexedDB._rows['cache:ptf_site_suppliers']);
  /* sweep: ردیف جعلی منقضی >۷روز */
  var old = JSON.stringify({ v: '"x"', at: Date.now() - 8 * 86400000, ttl: 1000 });
  sb.indexedDB._rows['cache:ptf_old'] = { id: 'cache:ptf_old', value: old, bytes: 10, updatedAt: '' };
  var removed = await call(function (cb) { W.ptfCacheSweep(cb); });
  await sleep(30); /* حذف IDB async است — پس از cb تمام می‌شود */
  T('vm: sweep ردیف >۷روز منقضی را حذف کرد', removed === 1 && !sb.indexedDB._rows['cache:ptf_old']);
  var liveRow = JSON.stringify({ v: '"y"', at: Date.now(), ttl: 86400000 });
  sb.indexedDB._rows['cache:ptf_live'] = { id: 'cache:ptf_live', value: liveRow, bytes: 10, updatedAt: '' };
  var removed2 = await call(function (cb) { W.ptfCacheSweep(cb); });
  T('vm: sweep ردیف تازه را نگه داشت و به حافظه آورد', removed2 === 0 && W.ptfCacheReadSync('ptf_live') === '"y"');
  finish();
})().catch(function (e) { T('زنجیرهٔ رفتاری بدون خطا', false, String(e && e.stack || e)); finish(); });

function finish() {
  console.log('\n— tester542 (v34.8.50: R3/T3-4 — لایهٔ کش read-through با TTL روی IDB) —');
  console.log('PASS: ' + p + ' | FAIL: ' + f);
  if (f > 0) process.exit(1);
}
