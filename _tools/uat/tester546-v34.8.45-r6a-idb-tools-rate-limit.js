#!/usr/bin/env node
'use strict';
/* tester546 — v34.8.47 (R6-الف): ابزارهای ریکاوری IDB-aware + سقف نرخ فرمان‌ها
   قرارداد: (۱) چهار ابزار ریکاوری مستقل (clear-cache/force-restore/recover/
   sync-diagnostics) که تاکنون صفر ارجاع IndexedDB داشتند، وضعیت مخزن واقعی
   ptf-crm-storage-v1 (آینهٔ bdata:، کش cache:، Dev-KV devkv:) را می‌بینند؛
   clear-cache فقط ردیف‌های cache: منقضی >۷روز را حذف می‌کند (همان قرارداد
   ptfCacheSweep) و هرگز bdata:/devkv: را لمس نمی‌کند؛ force-restore با قرارداد
   نشست v34.8.43 سازگار است (توکن از sessionStorage؛ نبود توکن JS ≠ نبود نشست —
   کوکی HttpOnly). (۲) سرور: سقف نرخ per-user ۶۰فرمان/۶۰ثانیه برای مسیر نوشتن
   sales-domain (کشف حلقه‌های خراب کلاینت) با 429 + retryAfter، قبل از قفل اصلی،
   best-effort و بدون شکستن replay های idempotent.
   پوشش: قرارداد منبع (۵ فایل) + رفتاری (vm: آمار IDB، auth کوکی‌محور، sweep). */
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

var sd = read('api/sales-domain.php');
var cc = read('crm/clear-cache.html');
var fr = read('crm/force-restore.html');
var rc = read('crm/recover.html');
var dx = read('crm/sync-diagnostics.html');

/* ═══ ۱) سرور — سقف نرخ فرمان‌ها ═══ */
T('بلوک سقف نرخ با نشانگر R6/T7 تعریف شد', sd.indexOf('CMD-RATE-LIMIT') > -1);
T('سقف = ۶۰ فرمان در پنجرهٔ ۶۰ثانیه‌ای', /\$rlMax = 60; \$rlWindow = 60; \$rlNow = time\(\);/.test(sd));
T('پنجرهٔ لغزان — فقط مهرهای داخل ۶۰ثانیه آخر', /array_filter\(array_map\('intval'[\s\S]{0,120}return \$t > \$rlNow - \$rlWindow; \}\)\);/.test(sd));
T('رد = 429 با retryAfter و limit/window', /sd_out\(\['ok'=>false,'error'=>'rate_limited','retryAfter'=>max\(1, \$rlWindow - \(\$rlNow - \(int\)\$rlList\[0\]\)\),'limit'=>\$rlMax,'window'=>\$rlWindow\], 429\);/.test(sd));
T('شمارنده per-user (user از توکن؛ fallback نقش)', /\$rlUser = \(\$user !== ''\) \? \$user : \('role:' \. \$role\);/.test(sd));
T('نوشتن شمارنده best-effort است (شکست ≠ خطا)', /@file_put_contents\(\$rlFile, json_encode\(\$rl\), LOCK_EX\);/.test(sd));
T('هرس دوره‌ای کاربران بی‌فعالیت (>۲۰۰)', /if \(count\(\$rl\) > 200\) \{[\s\S]{0,60}هرس دوره‌ای/.test(sd));
T('چک قبل از قفل اصلی (ردِ ارزان)', sd.indexOf('CMD-RATE-LIMIT') < sd.indexOf("$lockPath = sd_sync_dir() . '/meta.json.lock';"));
T('فقط مسیر نوشتن — اکشن‌های readOnly معاف', sd.indexOf('CMD-RATE-LIMIT') > sd.indexOf("sd_out(['ok'=>true,'data'=>sd_snapshot(),'version'=>SD_SERVICE_VERSION]);\n}"));
T('idempotency دست‌نخورده (replay ها سالم)', /sd_idempotency\(\$commands, \$idem, \$action, \$requestHash\);/.test(sd) && /idempotency_key_required/.test(sd));

/* ═══ ۲) چهار ابزار — IDB-aware ═══ */
[cc, fr, rc, dx].forEach(function (s, i) {
  var nm = ['clear-cache', 'force-restore', 'recover', 'sync-diagnostics'][i];
  T(nm + ': ptfIdbStats استاندالون تعریف شد', /function ptfIdbStats\(cb\) \{/.test(s) && s.indexOf("indexedDB.open('ptf-crm-storage-v1')") > -1);
  T(nm + ': تفکیک پیشوندها bdata:/cache:/devkv:', s.indexOf("k.indexOf('bdata:') === 0") > -1 && s.indexOf("k.indexOf('cache:') === 0") > -1 && s.indexOf("k.indexOf('devkv:') === 0") > -1);
});
T('clear-cache: دکمهٔ پاکسازی کش IDB', cc.indexOf('sweepIdbCache') > -1);
T('clear-cache: قرارداد حذف = منقضی > TTL+۷روز (همان ptfCacheSweep)', /\(\+rec\.at \|\| 0\)\) > \(\+rec\.ttl \+ 7 \* 86400000\)/.test(cc));
T('clear-cache: delete فقط برای ردیف cache: (bdata/devkv دست‌نخورده)', (function () { var i = cc.indexOf('if (k.indexOf(\'cache:\') === 0)'); var j = cc.indexOf('c.delete()', i); var k2 = cc.indexOf('function sweepIdbCache'); return i > -1 && j > i && cc.indexOf('c.delete()', j + 10) === -1 && cc.slice(k2, cc.indexOf('function safeBrowserRefresh')).indexOf('bdata:') === -1; })());
T('force-restore: توکن از sessionStorage (قرارداد v34.8.43)', /try \{ var t = sessionStorage\.getItem\('ptf_crm_token'\); if \(t\) return t; \} catch \(e\) \{\}/.test(fr) && /return localStorage\.getItem\('ptf_crm_token'\); \} catch \(e2\) \{ return null; \}/.test(fr));
T('force-restore: هدر فقط با توکن JS — وگرنه کوکی HttpOnly', /function authH\(extra\) \{[\s\S]{0,200}if \(t\) h\['X-CRM-Token'\] = t;/.test(fr) && (fr.match(/headers: authH\(\)/g) || []).length >= 4 && fr.indexOf("headers: { 'X-CRM-Token': token }") === -1);
T('force-restore: نشانگر کوکی ptf_token_flag', /ptf_token_flag=1/.test(fr) && /function cookieFlagOk\(\)/.test(fr));
T('force-restore: گیت عملیات = hasSession (نه فقط توکن JS)', /function hasSession\(\) \{ return !!getToken\(\) \|\| cookieFlagOk\(\); \}/.test(fr) && /if \(!hasSession\(\)\)/.test(fr));
T('force-restore: نشست از SS خوانده می‌شود', /sessionStorage\.getItem\('ptf_crm_session'\) \|\| localStorage\.getItem\('ptf_crm_session'\)/.test(fr));
T('recover: پنل IDB در اسکن رندر می‌شود', rc.indexOf('renderIdbPanel();') > -1 && rc.indexOf('id="idbPanel"') > -1);
T('sync-diagnostics: کارت IDB در init', dx.indexOf('renderIdbCard();') > -1 && dx.indexOf('overallStatus') > -1);

/* ═══ ۳) رفتاری — vm ═══ */
function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function mkStore() {
  var m = {};
  return { getItem: function (k) { return Object.prototype.hasOwnProperty.call(m, k) ? m[k] : null; }, setItem: function (k, v) { m[k] = String(v); }, removeItem: function (k) { delete m[k]; }, _m: m };
}
function fakeIDB(rows) {
  function asyncReq(run) { var r = { onsuccess: null, onerror: null, result: null }; setTimeout(function () { run(r); }, 0); return r; }
  var db = {
    close: function () {},
    transaction: function () {
      var ops = [];
      var tx = {
        objectStore: function () {
          return {
            openCursor: function () {
              return asyncReq(function (r) {
                var keys = Object.keys(rows), i = 0;
                function fire() {
                  if (i < keys.length) {
                    var idx = i++;
                    r.result = { key: keys[idx], value: rows[keys[idx]], continue: function () { setTimeout(fire, 0); }, delete: function () { delete rows[keys[idx]]; } };
                  } else r.result = null;
                  if (r.onsuccess) r.onsuccess();
                }
                fire();
              });
            }
          };
        },
        oncomplete: null
      };
      setTimeout(function () { if (tx.oncomplete) tx.oncomplete({}); }, 50); /* بعد از زنجیرهٔ مکان‌نما */
      return tx;
    }
  };
  return { open: function () { return asyncReq(function (r) { r.result = db; if (r.onsuccess) r.onsuccess(); }); }, _rows: rows };
}
function slice(src, from, to) { var a = src.indexOf(from), b = src.indexOf(to, a); if (a < 0 || b < 0) throw new Error('slice not found: ' + from); return src.slice(a, b); }

(async function () {
  try {
    /* ۳-۱) ptfIdbStats/Html + sweep روی IDB ساختگی */
    var rows = {
      'bdata:ptf_crm_offers': { value: 'x'.repeat(100) },
      'cache:ptf_site_suppliers': { value: JSON.stringify({ v: '[]', at: Date.now(), ttl: 86400000 }) },
      'cache:ptf_fx_live_cache': { value: JSON.stringify({ v: '{}', at: Date.now() - 8 * 86400000, ttl: 1000 }) },
      'cache:ptf_site_inbox_sig': { value: JSON.stringify({ v: 'abc', at: Date.now() - 30 * 86400000, ttl: 0 }) },
      'devkv:ptf_autodraft_offer_CO': { value: '{}' }
    };
    var fake = fakeIDB(rows);
    var alerts = [];
    var el = { innerHTML: '', _last: '' };
    var sb = {
      console: console, Date: Date, JSON: JSON, String: String, Math: Math,
      indexedDB: fake, alert: function (m) { alerts.push(String(m)); },
      document: { getElementById: function (id) { return id === 'idbStats' ? el : null; }, addEventListener: function () {} },
      loadIdbStats: function () {}, /* sweep در پایان گزارش را رفرش می‌کند — stub */
      setTimeout: setTimeout, clearTimeout: clearTimeout, window: {}
    };
    sb.window = sb;
    vm.createContext(sb);
    var block = slice(cc, '/* v34.8.52 (R6 — IDB-AWARE-RECOVERY)', 'function loadIdbStats');
    vm.runInContext(block, sb, { filename: 'idb-block.js' });
    var st = await new Promise(function (res) { sb.ptfIdbStats(res); });
    T('vm: آمار IDB درست شمرده شد (۵ ردیف، ۱ bdata، ۳ cache، ۱ devkv)', st.ok === true && st.rows === 5 && st.bdata === 1 && st.cache === 3 && st.devkv === 1);
    T('vm: حجم تقریبی بایت شمرده شد', st.bytes > 0);
    var html = sb.ptfIdbStatsHtml(st);
    T('vm: html آمار شامل هر سه پیشوند است', html.indexOf('bdata:') > -1 && html.indexOf('cache:') > -1 && html.indexOf('devkv:') > -1);
    T('vm: حالت بدون IDB → پیام نرم', sb.ptfIdbStatsHtml({ ok: false }).indexOf('قابل خواندن نیست') > -1);

    /* sweep: فقط cache: منقضی > ۷روز حذف می‌شود */
    vm.runInContext(slice(cc, 'function sweepIdbCache()', 'window.addEventListener'), sb, { filename: 'sweep.js' });
    sb.sweepIdbCache();
    await wait(200);
    T('vm: sweep فقط ردیف cache: منقضی >۷روز را حذف کرد', !rows['cache:ptf_fx_live_cache']);
    T('vm: cache تازه و بی-TTL و bdata: و devkv: دست‌نخورده', !!rows['cache:ptf_site_suppliers'] && !!rows['cache:ptf_site_inbox_sig'] && !!rows['bdata:ptf_crm_offers'] && !!rows['devkv:ptf_autodraft_offer_CO']);
    T('vm: گزارش sweep شامل تعداد بود', alerts.length === 1 && alerts[0].indexOf('1 ردیف کش منقضی') > -1);

    /* ۳-۲) auth کوکی‌محور force-restore */
    var SS = mkStore(), LS = mkStore(), cookie = '';
    var sb2 = {
      console: console, sessionStorage: SS, localStorage: LS,
      document: { cookie: '' },
      window: {}
    };
    Object.defineProperty(sb2.document, 'cookie', { get: function () { return cookie; }, set: function (v) { cookie = v; }, configurable: true });
    sb2.window = sb2;
    vm.createContext(sb2);
    vm.runInContext(slice(fr, 'function getToken()', 'function getRole'), sb2, { filename: 'auth-block.js' });
    T('vm: توکن SS برگردانده شد', (SS.setItem('ptf_crm_token', 'T-SS'), sb2.getToken() === 'T-SS'));
    T('vm: هدر با توکن JS رفت', sb2.authH()['X-CRM-Token'] === 'T-SS');
    SS.removeItem('ptf_crm_token'); LS.setItem('ptf_crm_token', 'T-LS');
    T('vm: fallback LS (دستگاه مهاجرت‌نشده)', sb2.getToken() === 'T-LS' && sb2.authH()['X-CRM-Token'] === 'T-LS');
    LS.removeItem('ptf_crm_token');
    cookie = 'ptf_token_flag=1';
    T('vm: بدون توکن JS → بدون هدر (کوکی ملاک)', sb2.authH()['X-CRM-Token'] === undefined && sb2.hasSession() === true);
    cookie = '';
    T('vm: بدون توکن و کوکی → hasSession=false', sb2.hasSession() === false);
  } catch (e) {
    T('زنجیرهٔ رفتاری vm بدون خطا', false, String(e && e.stack || e));
  }
  finish();
})().catch(function (e) { T('زنجیرهٔ بیرونی', false, String(e && e.stack || e)); finish(); });

function finish() {
  console.log('\n— tester546 (v34.8.47: R6-الف — ابزارهای ریکاوری IDB-aware + سقف نرخ فرمان‌ها per-user) —');
  console.log('PASS: ' + p + ' | FAIL: ' + f);
  if (f > 0) process.exit(1);
}
