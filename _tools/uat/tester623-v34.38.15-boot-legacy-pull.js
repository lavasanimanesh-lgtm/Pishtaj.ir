'use strict';
/* ─────────────────────────────────────────────────────────────────────────────
   tester623 — v34.38.16 (BOOT-REVERT)

   دستور کارفرما (۱۴۰۵/۰۶/۱۹): «مشکلات زیادی برای ورود به سیستم در چند تغییر اخیر
   ایجاد شده؛ اولین تغییری که سبب این موضوع شده — از جایی که فراخوانی از سرور
   اضافه شده — را پیدا کن و سیستم را به حالت قبل از آن برگردان.»

   نتیجهٔ بررسی: v34.38.10 («Implement atomic CRM snapshot sync») پرچم
   PTF_CRM_SNAPSHOT_V2 را روشن کرد و بوت/ورود را به مسیر دو-مرحله‌ای
   data_manifest + data_chunk برد؛ روی دادهٔ واقعی همیشه fail-closed می‌شد
   (ARENA-CRM-ATOMIC-PULL-INCOMPLETE-RCA-2026-09-08.md) و زنجیرهٔ
   مشکلات ورود + حادثهٔ حذف انبوه ۶۸→۱ را ساخت
   (ARENA-CRM-RFQSMART-MASS-DELETION-RCA-2026-09-09.md، بند ۲-۲).

   قراردادی که این تستر قفل می‌کند:
   ۱) پرچم PTF_CRM_SNAPSHOT_V2 در crm/index.html خاموش است ⇒ بوت/ورود و
      «دریافت کامل مجدد» دقیقاً مثل قبل از v34.38.10 از data_pull تک‌مرحله‌ای
      می‌آیند و هیچ data_manifest/data_chunk از مرورگر فراخوانی نمی‌شود.
   ۲) کد مسیر اتمیک حذف نشده — با true شدن صریح پرچم دوباره کار می‌کند
      (برگشتِ قابل-اطمینان، نه جراحی کور).
   ۳) سپرهای حذف انبوه v34.38.12 (که برای بدترین عارضهٔ همین ریشه ساخته شدند)
      سرِ کار می‌مانند.
   ۴) قرارداد انتشار v34.38.20 (VERSION/index/sw/manifest/SD) هم‌تراز است.

   اجرا: node _tools/uat/tester623-v34.38.15-boot-legacy-pull.js
   ───────────────────────────────────────────────────────────────────────────── */
var fs = require('fs');
var vm = require('vm');
var nodeCrypto = require('crypto');

var idx = fs.readFileSync('crm/index.html', 'utf8');
var syncSrc = fs.readFileSync('crm/sync.js', 'utf8');
var sw = fs.readFileSync('crm/sw.js', 'utf8');
var api = fs.readFileSync('api/crm.php', 'utf8');
var version = JSON.parse(fs.readFileSync('VERSION.json', 'utf8')).crm_version;
var manifest = JSON.parse(fs.readFileSync('crm/manifest.json', 'utf8'));
var sd = fs.readFileSync('api/sales-domain.php', 'utf8');

var failures = 0;
function test(name, cond) {
  if (cond) { console.log('PASS ' + name); return; }
  failures++;
  console.log('FAIL ' + name);
}
function sha256(str) { return nodeCrypto.createHash('sha256').update(Buffer.from(str, 'utf8')).digest('hex'); }

/* ===========================================================================
   بخش ۱ — قرارداد ایستا (منابع واقعی)
   =========================================================================== */
test('پرچم مسیر اتمیک در index.html خاموش است (بازگشت بوت به data_pull)',
  idx.indexOf('window.PTF_CRM_SNAPSHOT_V2 = false') > -1 && idx.indexOf('window.PTF_CRM_SNAPSHOT_V2 = true') < 0);
test('دروازهٔ مسیر اتمیک در sync.js همچنان به پرچم گره خورده (نه حذف کد، نه مسیر دوم)',
  syncSrc.indexOf('window.PTF_CRM_SNAPSHOT_V2 === true') > -1 && syncSrc.indexOf('window.ptfSyncPullAtomic') > -1);
test('کد atomic pull برای فعال‌سازی مجدد آینده سالم مانده (worker/retry/fallback)',
  syncSrc.indexOf('Math.min(4, keys.length)') > -1 && syncSrc.indexOf('maxAttempts = 4') > -1 && syncSrc.indexOf('state.atomicFailStreak >= 2') > -1);
test('endpointهای اتمیک سرور حذف نشده‌اند (فعال‌سازی مجدد بدون تغییر سرور)',
  api.indexOf("case 'data_manifest':") > -1 && api.indexOf("case 'data_chunk':") > -1);
test('سپر حذف انبوه v34.38.12 سرِ کار مانده (data_push + قرنطینهٔ بک‌آپ)',
  api.indexOf('mass_deletion_blocked') > -1);
test('قرارداد انتشار هم‌تراز v34.38.16 است',
  version === 'v34.38.20' && /window\.PTF_CRM_RELEASE = 'v34\.38\.20'/.test(idx) &&
  sw.indexOf("RELEASE = 'v34.38.20'") > -1 && manifest.version === '34.38.20' &&
  sd.indexOf("SD_SERVICE_VERSION = '34.38.20'") > -1);

/* ===========================================================================
   بخش ۲ — شبیه‌سازی رفتاری: بوت با پرچمِ index.html (خاموش)
   =========================================================================== */
function buildRfqPayload(n, tag) {
  var rows = [];
  for (var i = 0; i < n; i++) {
    rows.push('{"no":"RFQ-' + tag + '-' + i + '","nm":"درخواست تأمین «شیر کنترلی ' + i + '»","qty":1.0,"meta":{},"src":"https://pishtaj.ir/rfq/' + i + '"}');
  }
  return '[' + rows.join(',') + ']';
}
var PAYLOAD_RFQS = buildRfqPayload(40, 'R');
var PAYLOAD_SETTINGS = '{"theme":"dark","prefs":{},"ratio":2.0,"logo":"/assets/logo.png"}';

function serverStats(payload) {
  var parsed = JSON.parse(payload);
  var isArr = Array.isArray(parsed);
  return {
    kind: isArr ? 'array' : 'object',
    count: isArr ? parsed.length : Object.keys(parsed).length,
    bytes: Buffer.byteLength(payload, 'utf8'),
    sha256: sha256(payload),
    canonicalSha256: sha256(payload.replace(/\{\}/g, '[]')),
    available: true
  };
}
/* سرور شبیه‌سازی‌شده: هر سه endpoint فعال‌اند — تا اگر پرچم اشتباهاً روشن بود،
   تست با دیدنِ data_manifest/data_chunk شکست بخورد (نه اینکه با 404 رد شود). */
function makeServer() {
  var S = {
    rev: 40,
    keys: {
      ptf_crm_rfqs: { rev: 40, payload: PAYLOAD_RFQS },
      ptf_crm_settings: { rev: 12, payload: PAYLOAD_SETTINGS },
      ptf_crm_deleted_archive: { rev: 3, payload: '[]' }
    },
    actions: [], /* هر اکشن درخواست‌شده از سمت کلاینت */
    get manifestHits() { return this.actions.filter(function (a) { return a === 'data_manifest'; }).length; },
    get pullHits() { return this.actions.filter(function (a) { return a === 'data_pull'; }).length; }
  };
  S.manifestResponse = function () {
    var keys = {};
    Object.keys(S.keys).forEach(function (k) {
      var st = serverStats(S.keys[k].payload);
      st.rev = S.keys[k].rev; st.chunkSize = 500; st.chunkBytes = 65536; st.payloadSha256 = st.sha256;
      keys[k] = st;
    });
    return {
      ok: true, contract: 'ptf-sync-v2', byteChunks: true, revision: S.rev, snapshotId: 'S-' + S.rev,
      snapshot: {
        id: 'S-' + S.rev, rev: S.rev, archiveRev: S.keys.ptf_crm_deleted_archive.rev,
        complete: true, degraded: false, unavailable: {}, chunkBytes: 65536,
        keyList: Object.keys(keys), count: Object.keys(keys).length, recordCount: 0, bytes: 0,
        checksum: sha256('snapshot' + S.rev), keys: keys
      },
      meta: (function () { var m = { _global: { rev: S.rev } }; Object.keys(S.keys).forEach(function (k) { m[k] = { rev: S.keys[k].rev }; }); return m; })()
    };
  };
  S.chunkResponse = function (q) {
    var key = q.collection;
    var keyRev = S.keys[key].rev, archiveRev = S.keys.ptf_crm_deleted_archive.rev;
    var payload = S.keys[key].payload;
    var buf = Buffer.from(payload, 'utf8');
    var st = serverStats(payload);
    var offset = Math.max(0, +q.offset || 0);
    var limit = Math.max(4096, +q.limit || 262144);
    var part = buf.slice(offset, offset + limit);
    var next = offset + part.length;
    return {
      ok: true, contract: 'ptf-sync-v2', snapshot: 'S-' + S.rev, snapshotId: 'S-' + S.rev,
      revision: S.rev, collection: key, rev: keyRev, keyRev: keyRev, archiveRev: archiveRev,
      kind: st.kind, count: st.count, sha256: st.sha256, payloadSha256: st.sha256, bytesTotal: st.bytes,
      mode: 'bytes', offset: offset, limit: limit, part: part.toString('utf8'),
      done: next >= buf.length, nextOffset: next < buf.length ? next : null, bytes: part.length
    };
  };
  S.pullResponse = function (q) {
    var krevs = {};
    try { krevs = JSON.parse(q.krevs || '{}') || {}; } catch (e) {}
    var data = {}, integrity = {};
    Object.keys(S.keys).forEach(function (k) {
      if ((+krevs[k] >= 0 ? +krevs[k] : -1) >= S.keys[k].rev) return;
      data[k] = S.keys[k].payload;
      var st = serverStats(data[k]);
      integrity[k] = { kind: st.kind, count: st.count, bytes: st.bytes, sha256: st.sha256, canonicalSha256: st.canonicalSha256 };
    });
    return {
      ok: true, rev: S.rev, revision: S.rev, snapshotId: 'S-' + S.rev, contract: 'ptf-sync-v2',
      data: data, delta: true,
      meta: (function () { var m = { _global: { rev: S.rev } }; Object.keys(S.keys).forEach(function (k) { m[k] = { rev: S.keys[k].rev }; }); return m; })(),
      snapshot: {
        id: 'S-' + S.rev, rev: S.rev, delta: true, complete: true, keyList: Object.keys(integrity),
        count: Object.keys(integrity).length, recordCount: 0, bytes: 0, checksum: sha256('pull' + S.rev), keys: integrity
      }
    };
  };
  return S;
}
function parseQuery(url) {
  var q = {};
  String(url).split('?').slice(1).join('?').split('&').forEach(function (kv) {
    if (!kv) return;
    var i = kv.indexOf('=');
    q[decodeURIComponent(i < 0 ? kv : kv.slice(0, i))] = i < 0 ? '' : decodeURIComponent(kv.slice(i + 1));
  });
  return q;
}
/* vm تازه برای هر سناریو — دقیقاً مثل بوت واقعی مرورگر */
function bootVm(flagValue) {
  var S = makeServer();
  var store = { ptf_crm_token: 'tok', ptf_sync_rev: '0' };
  var ctx = {
    console: console, JSON: JSON, Date: Date, Math: Math, Array: Array, Object: Object, String: String,
    Promise: Promise, TextEncoder: TextEncoder, Buffer: Buffer, crypto: nodeCrypto.webcrypto,
    localStorage: {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
      setItem: function (k, v) { store[k] = String(v); },
      removeItem: function (k) { delete store[k]; }
    },
    document: {
      hidden: false, hasFocus: function () { return true; }, addEventListener: function () {},
      querySelector: function () { return null; }, querySelectorAll: function () { return []; },
      getElementById: function () { return null; }, createElement: function () { return { style: {}, appendChild: function () {} }; },
      activeElement: null, head: { appendChild: function () {} }, body: { appendChild: function () {} }
    },
    navigator: { onLine: true }, location: { href: 'index.html' },
    setTimeout: setTimeout, clearTimeout: clearTimeout, setInterval: function () { return 1; }, clearInterval: function () {},
    curSession: function () { return { user: 'u1' }; }, curRole: function () { return 'admin'; },
    ptfAuthToken: function () { return 'tok'; }, ptfToast: function () {}, audit: function () {}, addLog: function () {},
    fetch: function (url) {
      var q = parseQuery(url);
      S.actions.push(q.action);
      var res;
      if (q.action === 'data_manifest') res = { status: 200, body: S.manifestResponse() };
      else if (q.action === 'data_chunk') res = { status: 200, body: S.chunkResponse(q) };
      else if (q.action === 'data_pull') res = { status: 200, body: S.pullResponse(q) };
      else res = { status: 404, body: { ok: false, error: 'unknown_action' } };
      return Promise.resolve({
        ok: res.status >= 200 && res.status < 300, status: res.status,
        json: function () { return Promise.resolve(res.body); }
      });
    }
  };
  ctx.window = ctx;
  ctx.PTF_CRM_SNAPSHOT_V2 = flagValue; /* مثل crm/index.html */
  vm.runInNewContext(syncSrc, ctx, { filename: 'crm/sync.js' });
  return { ctx: ctx, store: store, server: S };
}

(async function run() {
  /* ── سناریو ۱: پرچم خاموش (وضعیت index.html پس از v34.38.16) ─────────────── */
  var A = bootVm(false);
  var r1 = await new Promise(function (resolve) { A.ctx.ptfSyncFullResync(resolve); });
  test('دریافت کامل با پرچم خاموش موفق می‌شود (رفتار قبل از v34.38.10)',
    r1 && r1.ok === true);
  test('بوت فقط data_pull را صدا می‌زند — هیچ data_manifest فراخوانی نمی‌شود',
    A.server.pullHits === 1 && A.server.manifestHits === 0 &&
    A.server.actions.indexOf('data_chunk') < 0);
  test('دادهٔ درخواست تأمین کامل و بدون تغییر شکل از data_pull می‌نشیند',
    A.store.ptf_crm_rfqs === PAYLOAD_RFQS && A.store.ptf_crm_settings === PAYLOAD_SETTINGS);
  test('مکان‌نمای rev پس از دریافت کامل جلو می‌رود',
    String(A.store.ptf_sync_rev) === String(A.server.rev));

  /* ── سناریو ۲: پرچم روشن (فعال‌سازی مجدد آینده) — کد اتمیک سالم مانده ──── */
  var B = bootVm(true);
  var r2 = await new Promise(function (resolve) { B.ctx.ptfSyncFullResync(resolve); });
  test('با true شدن صریح پرچم، مسیر اتمیک دوباره کار می‌کند (برگشتِ قابل-اطمینان)',
    r2 && r2.ok === true && B.server.manifestHits >= 1 &&
    B.store.ptf_crm_rfqs === PAYLOAD_RFQS);

  console.log('');
  if (failures) {
    console.log('=== tester623: ' + failures + ' FAIL ===');
    process.exit(1);
  }
  console.log('PASS tester623-v34.38.16-boot-legacy-pull');
})().catch(function (e) {
  console.log('FAIL exception: ' + (e && e.stack || e));
  process.exit(1);
});
