'use strict';
/* ─────────────────────────────────────────────────────────────────────────────
   tester618 — v34.38.12 (ATOMIC-PULL-COMPLETION)

   گزارش کارفرما (۱۴۰۵/۰۶/۱۷): «این پیغام دائم می‌آید و پس از چند ثانیه تکرار می‌شود؛
   دریافت اطلاعات کامل نمی‌شود، خصوصاً درخواست‌های تأمین بارگذاری نمی‌شوند:
   ⚠️ دریافت کامل CRM انجام نشد؛ آخرین snapshot سالم حفظ شد و تلاش مجدد خودکار ادامه دارد.»

   ریشه‌ها (v34.38.12، مسیر pull اتمیک) که این تستر آن‌ها را قفل می‌کند:
   ① صحت‌سنجی cross-language: chunk ردیفی، ردیف‌ها را دوباره با JSON.stringify مرورگر
      کدگذاری می‌کرد و با canonicalSha256 پی‌اچ‌پی مقایسه می‌شد. هر اختلاف طبیعی دو
      زبان (۱.۰ در برابر ۱، {} در برابر []، اسلش) ⇒ snapshot_checksum_mismatch ⇒
      شکست کل bootstrap؛ و در صورت عبور، شکل داده هم عوض می‌شد.
   ② یک کلید ناخوانا (فایل غایب/JSON خراب) ⇒ manifest_integrity_invalid ⇒ هیچ کلیدی
      دریافت نمی‌شد (همه یا هیچ).
   ③ هر تغییر rev سراسری وسط pull (حتی یک لاگ audit از کاربر دیگر) ⇒ 409 روی همهٔ
      chunkها و شکست پس از یک retry ⇒ روی CRM شلوغ عملاً هرگز تمام نمی‌شد.
   ④ مسیر اتمیک تنها راه بوت بود؛ شکست آن یعنی حلقهٔ ۵ثانیه‌ای پیام بالا و هیچ داده‌ای.

   اجرا: node _tools/uat/tester618-v34.38.11-atomic-pull-completion.js
   ───────────────────────────────────────────────────────────────────────────── */
var fs = require('fs');
var vm = require('vm');
var assert = require('assert');
var nodeCrypto = require('crypto');

var api = fs.readFileSync('api/crm.php', 'utf8');
var syncSrc = fs.readFileSync('crm/sync.js', 'utf8');
var version = JSON.parse(fs.readFileSync('VERSION.json', 'utf8')).crm_version;

var failures = 0;
function test(name, cond) {
  if (cond) { console.log('PASS ' + name); return; }
  failures++;
  console.log('FAIL ' + name);
}
function sha256(str) { return nodeCrypto.createHash('sha256').update(Buffer.from(str, 'utf8')).digest('hex'); }

/* ===========================================================================
   بخش ۱ — قرارداد سرور (متن api/crm.php؛ php روی رانر موجود نیست)
   =========================================================================== */
test('manifest کلید ناخوانا را به‌جای شکست کل snapshot در unavailable گزارش می‌کند',
  api.indexOf("$dm_unavailable[$dm_k] = ['reason' => 'payload_missing'") > -1 &&
  api.indexOf("'payload_unparsable'") > -1 &&
  api.indexOf("'unavailable' => $dm_unavailable") > -1 &&
  api.indexOf("'degraded' => count($dm_unavailable) > 0") > -1);
test('manifest برای هر کلید سالم sha256 همان payload و chunkBytes می‌دهد',
  api.indexOf("$dm_stats['payloadSha256'] = $dm_stats['sha256'];") > -1 &&
  api.indexOf("$dm_stats['chunkBytes'] = SYNC_CHUNK_BYTES;") > -1 &&
  api.indexOf("'archiveRev' => $dm_archiveRev") > -1);
test('data_chunk حالت بایتی دارد و برش را روی مرز UTF-8 می‌بندد',
  api.indexOf("if ($dc_mode === 'bytes')") > -1 &&
  api.indexOf("'mode'=>'bytes'") > -1 && api.indexOf("'bytesTotal'=>$dc_stats['bytes']") > -1 &&
  api.indexOf('($dc_b & 0xC0) === 0x80') > -1);
test('data_chunk تغییر rev سراسری را با pin کردن rev کلید/بایگانی تحمل می‌کند',
  api.indexOf("$dc_pinKey = array_key_exists('keyRev', $_REQUEST)") > -1 &&
  api.indexOf("$dc_pinArchive = array_key_exists('archiveRev', $_REQUEST)") > -1 &&
  api.indexOf("$dc_drift = true;") > -1 && api.indexOf("'changed'=>") > -1);
test('data_manifest/data_chunk هم‌تراز data_pull زیر ACL نقش (sync_read) رفته‌اند',
  api.indexOf("'data_manifest'=>'sync_read','data_chunk'=>'sync_read'") > -1 &&
  api.indexOf("'data_manifest', 'data_chunk'") > -1);

/* ===========================================================================
   بخش ۲ — الگوریتم برش بایتی: هرگز وسط کاراکتر فارسی نبُرد و دقیقاً بازسازی شود
   (پورت مستقیم همان حلقهٔ PHP روی Buffer)
   =========================================================================== */
function phpByteSlice(payloadBuf, offset, limit) {
  var part = payloadBuf.slice(offset, offset + limit);
  var partLen = part.length;
  if (offset + partLen < payloadBuf.length && partLen > 0) {
    var trim = 0;
    for (var i = partLen - 1; i >= 0 && i >= partLen - 4; i--) {
      var b = part[i];
      if ((b & 0xC0) === 0x80) { trim++; continue; }
      var need = ((b & 0x80) === 0x00) ? 1 : (((b & 0xE0) === 0xC0) ? 2 : (((b & 0xF0) === 0xE0) ? 3 : (((b & 0xF8) === 0xF0) ? 4 : 1)));
      trim = (need > trim + 1) ? (trim + 1) : 0;
      break;
    }
    if (trim > 0 && trim < partLen) part = part.slice(0, partLen - trim);
  }
  return part;
}
(function byteSliceRoundTrip() {
  var rows = [];
  for (var i = 0; i < 60; i++) rows.push({ no: 'RFQ-14' + i, nm: 'درخواست تأمین شیر کنترلی «نمونهٔ ' + i + '»', em: '😀', url: 'https://pishtaj.ir/rfq/' + i });
  var payload = JSON.stringify(rows);
  var buf = Buffer.from(payload, 'utf8');
  var okAll = true;
  [17, 23, 64, 4096].forEach(function (limit) {
    var off = 0, parts = [], guard = 0;
    while (off < buf.length && guard++ < 100000) {
      var part = phpByteSlice(buf, off, limit);
      if (!part.length) { okAll = false; break; }
      /* هر تکه باید به‌تنهایی UTF-8 معتبر باشد (وگرنه json_encode پاسخ خراب می‌شود) */
      if (Buffer.compare(Buffer.from(part.toString('utf8'), 'utf8'), part) !== 0) okAll = false;
      parts.push(part.toString('utf8'));
      off += part.length;
    }
    if (parts.join('') !== payload) okAll = false;
  });
  test('برش بایتی: هر تکه UTF-8 معتبر و الحاق تکه‌ها دقیقاً همان payload است', okAll);
})();

/* ===========================================================================
   بخش ۳ — شبیه‌سازی کامل کلاینت روی sync.js واقعی
   =========================================================================== */
/* payloadهای عمداً «بدخیم» برای قرارداد قدیمی:
   – rfqs: ۱۲۰۰ ردیف (چند chunk) + متن فارسی + {} تودرتو + عدد ۱.۰ + اسلش
   – settings: آبجکت با {} خالی (json_decode/json_encode پی‌اچ‌پی آن را [] می‌کرد) */
function buildRfqPayload(n, tag) {
  var rows = [];
  for (var i = 0; i < n; i++) {
    rows.push('{"no":"RFQ-' + tag + '-' + i + '","nm":"درخواست تأمین «شیر کنترلی ' + i + '»","qty":1.0,"meta":{},"src":"https://pishtaj.ir/rfq/' + i + '"}');
  }
  return '[' + rows.join(',') + ']';
}
var SERVER = {
  rev: 40,
  keys: {
    ptf_crm_rfqs: { rev: 40, payload: buildRfqPayload(1200, 'A') },
    ptf_crm_settings: { rev: 12, payload: '{"theme":"dark","prefs":{},"ratio":2.0,"logo":"/assets/logo.png"}' },
    ptf_crm_deleted_archive: { rev: 3, payload: '[]' },
    ptf_crm_audit: { rev: 39, payload: '[{"a":"log"}]' }
  },
  broken: {},        /* key -> reason (فایل غایب/JSON خراب) */
  chunkHits: [],
  onChunk: null,
  manifestOverride: null,
  manifestHits: 0,
  pullHits: 0
};
function serverStats(payload) {
  var parsed = JSON.parse(payload);
  var isArr = Array.isArray(parsed);
  return {
    kind: isArr ? 'array' : 'object',
    count: isArr ? parsed.length : Object.keys(parsed).length,
    bytes: Buffer.byteLength(payload, 'utf8'),
    sha256: sha256(payload),
    /* عمداً «canonical به سبک PHP» تولید می‌شود: {} → [] و ۱.۰ → 1.0 …
       کلاینت جدید نباید هیچ تصمیمی بر پایهٔ این مقدار بگیرد. */
    canonicalSha256: sha256(payload.replace(/\{\}/g, '[]')),
    available: true
  };
}
function manifestResponse() {
  SERVER.manifestHits++;
  if (SERVER.manifestOverride) return SERVER.manifestOverride();
  var keys = {}, unavailable = {};
  Object.keys(SERVER.keys).forEach(function (k) {
    if (SERVER.broken[k]) { unavailable[k] = { reason: SERVER.broken[k], rev: SERVER.keys[k].rev }; return; }
    var st = serverStats(SERVER.keys[k].payload);
    st.rev = SERVER.keys[k].rev;
    st.chunkSize = 500;
    st.chunkBytes = 65536;
    st.payloadSha256 = st.sha256;
    keys[k] = st;
  });
  return {
    ok: true, contract: 'ptf-sync-v2', byteChunks: true, revision: SERVER.rev, snapshotId: 'S-' + SERVER.rev,
    snapshot: {
      id: 'S-' + SERVER.rev, rev: SERVER.rev, archiveRev: SERVER.keys.ptf_crm_deleted_archive.rev,
      complete: true, degraded: Object.keys(unavailable).length > 0, unavailable: unavailable,
      chunkBytes: 65536, keyList: Object.keys(keys), count: Object.keys(keys).length,
      recordCount: 0, bytes: 0, checksum: sha256('snapshot' + SERVER.rev), keys: keys
    },
    meta: (function () { var m = { _global: { rev: SERVER.rev } }; Object.keys(SERVER.keys).forEach(function (k) { m[k] = { rev: SERVER.keys[k].rev }; }); return m; })()
  };
}
function chunkResponse(q) {
  var key = q.collection;
  SERVER.chunkHits.push({ key: key, offset: +q.offset || 0, snapshot: q.snapshot, keyRev: q.keyRev, archiveRev: q.archiveRev, mode: q.mode });
  if (typeof SERVER.onChunk === 'function') { try { SERVER.onChunk(q); } catch (e) {} }
  if (!SERVER.keys[key] || SERVER.broken[key]) return { status: 409, body: { ok: false, error: 'collection_missing', collection: key } };
  var keyRev = SERVER.keys[key].rev, archiveRev = SERVER.keys.ptf_crm_deleted_archive.rev;
  var pinned = 'S-' + SERVER.rev;
  var drift = false;
  if (q.snapshot && q.snapshot !== pinned) {
    var stable = (+q.keyRev === keyRev && +q.archiveRev === archiveRev);
    if (!stable) {
      return { status: 409, body: { ok: false, error: 'snapshot_changed', rev: SERVER.rev, snapshot: pinned, collection: key, keyRev: keyRev, archiveRev: archiveRev } };
    }
    drift = true;
    pinned = q.snapshot;
  }
  var payload = SERVER.keys[key].payload;
  var buf = Buffer.from(payload, 'utf8');
  var st = serverStats(payload);
  var offset = Math.max(0, +q.offset || 0);
  var limit = Math.max(4096, +q.limit || 262144);
  var part = phpByteSlice(buf, offset, limit);
  var next = offset + part.length;
  return {
    status: 200, body: {
      ok: true, contract: 'ptf-sync-v2', snapshot: pinned, snapshotId: pinned, serverSnapshot: 'S-' + SERVER.rev,
      drift: drift, revision: SERVER.rev, collection: key, rev: keyRev, keyRev: keyRev, archiveRev: archiveRev,
      kind: st.kind, count: st.count, sha256: st.sha256, payloadSha256: st.sha256, bytesTotal: st.bytes,
      mode: 'bytes', offset: offset, limit: limit, part: part.toString('utf8'), partBytes: part.length,
      nextOffset: next, done: next >= buf.length, total: st.count
    }
  };
}
function pullResponse(q) {
  SERVER.pullHits++;
  var krevs = {};
  try { krevs = JSON.parse(q.krevs || '{}') || {}; } catch (e) {}
  var data = {}, integrity = {};
  Object.keys(SERVER.keys).forEach(function (k) {
    if (SERVER.broken[k]) return;
    if ((+krevs[k] >= 0 ? +krevs[k] : -1) >= SERVER.keys[k].rev) return;
    data[k] = SERVER.keys[k].payload;
    var st = serverStats(data[k]);
    integrity[k] = { kind: st.kind, count: st.count, bytes: st.bytes, sha256: st.sha256, canonicalSha256: st.canonicalSha256 };
  });
  return {
    ok: true, rev: SERVER.rev, revision: SERVER.rev, snapshotId: 'S-' + SERVER.rev, contract: 'ptf-sync-v2',
    data: data, delta: true,
    meta: (function () { var m = { _global: { rev: SERVER.rev } }; Object.keys(SERVER.keys).forEach(function (k) { m[k] = { rev: SERVER.keys[k].rev }; }); return m; })(),
    snapshot: {
      id: 'S-' + SERVER.rev, rev: SERVER.rev, delta: true, complete: true, keyList: Object.keys(integrity),
      count: Object.keys(integrity).length, recordCount: 0, bytes: 0, checksum: sha256('pull' + SERVER.rev), keys: integrity
    }
  };
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

var store = { ptf_crm_token: 'tok', ptf_sync_rev: '0' };
var toasts = [];
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
  ptfAuthToken: function () { return 'tok'; },
  ptfToast: function (msg, kind) { toasts.push({ msg: String(msg), kind: kind }); },
  audit: function () {}, addLog: function () {},
  fetch: function (url) {
    var q = parseQuery(url);
    var res;
    if (q.action === 'data_manifest') res = { status: 200, body: manifestResponse() };
    else if (q.action === 'data_chunk') res = chunkResponse(q);
    else if (q.action === 'data_pull') res = { status: 200, body: pullResponse(q) };
    else res = { status: 404, body: { ok: false, error: 'unknown_action' } };
    return Promise.resolve({
      ok: res.status >= 200 && res.status < 300, status: res.status,
      json: function () { return Promise.resolve(res.body); }
    });
  }
};
ctx.window = ctx;
ctx.PTF_CRM_SNAPSHOT_V2 = true; /* مثل crm/index.html — مسیر اتمیک فعال است */
vm.runInNewContext(syncSrc, ctx, { filename: 'crm/sync.js' });

function pullAtomic(options) {
  return new Promise(function (resolve) { ctx.ptfSyncPullAtomic(resolve, options || {}); });
}

(async function run() {
  /* ── سناریو ۱: payload بدخیم (چند chunk، فارسی، {}، ۱.۰، اسلش) ───────────── */
  SERVER.chunkHits = [];
  var r1 = await pullAtomic({});
  test('pull اتمیک با payload چندchunkی فارسی/{}/عدد اعشاری موفق می‌شود (قبلاً snapshot_checksum_mismatch)',
    r1 && r1.ok === true && r1.atomic === true);
  test('درخواست تأمین (rfqs) بایت‌به‌بایت همان چیزی است که سرور دارد — نه بازتولید JSON مرورگر',
    store.ptf_crm_rfqs === SERVER.keys.ptf_crm_rfqs.payload);
  test('کلید آبجکتی (settings) هم دست‌نخورده ذخیره می‌شود؛ {} به [] تبدیل نمی‌شود',
    store.ptf_crm_settings === SERVER.keys.ptf_crm_settings.payload && store.ptf_crm_settings.indexOf('"prefs":{}') > -1);
  test('rfqs واقعاً در چند chunk خوانده شده است (مسیر resumable فعال است)',
    SERVER.chunkHits.filter(function (h) { return h.key === 'ptf_crm_rfqs'; }).length > 1);
  test('هر chunk با pin کردن rev کلید و rev بایگانی درخواست می‌شود',
    SERVER.chunkHits.every(function (h) { return h.mode === 'bytes' && h.keyRev !== undefined && h.archiveRev !== undefined; }));
  test('cursor پس از commit کامل جلو می‌رود', String(store.ptf_sync_rev) === String(SERVER.rev));

  /* ── سناریو ۲: یک کلید ناخوانا نباید کل bootstrap را زمین بزند ──────────── */
  store.ptf_crm_settings = '{"local":"last-good"}';
  SERVER.broken.ptf_crm_settings = 'payload_unparsable';
  SERVER.keys.ptf_crm_rfqs.payload = buildRfqPayload(700, 'B');
  SERVER.keys.ptf_crm_rfqs.rev = 41; SERVER.rev = 41;
  var r2 = await pullAtomic({});
  test('کلید ناخوانای سرور، pull بقیهٔ کلیدها را متوقف نمی‌کند (پایان «همه یا هیچ»)',
    r2 && r2.ok === true && r2.degraded === true && (r2.unavailable || []).indexOf('ptf_crm_settings') > -1);
  test('برای کلید ناخوانا آخرین نسخهٔ سالم محلی حفظ می‌شود (نه خالی، نه پاک)',
    store.ptf_crm_settings === '{"local":"last-good"}');
  test('درخواست‌های تأمین با وجود کلید معیوب کامل به‌روز می‌شوند',
    store.ptf_crm_rfqs === SERVER.keys.ptf_crm_rfqs.payload);
  delete SERVER.broken.ptf_crm_settings;

  /* ── سناریو ۳: تغییر rev سراسری وسط pull (audit کاربر دیگر) ─────────────── */
  SERVER.keys.ptf_crm_rfqs.payload = buildRfqPayload(1500, 'C');
  SERVER.keys.ptf_crm_rfqs.rev = 42; SERVER.rev = 42;
  SERVER.manifestHits = 0; SERVER.chunkHits = [];
  var bumped = false;
  SERVER.onChunk = function () {
    if (bumped) return;
    bumped = true;
    /* کاربر دیگری فقط یک لاگ audit نوشت: rev سراسری جلو رفت، rfqs تغییری نکرد. */
    SERVER.keys.ptf_crm_audit.rev = 43;
    SERVER.rev = 43;
  };
  var r3 = await pullAtomic({});
  SERVER.onChunk = null;
  test('نوشتن هم‌زمان یک کلید دیگر، pull اتمیک را نمی‌شکند (پایان livelock ۴۰۹)',
    r3 && r3.ok === true);
  test('در تلاش دوباره، collection بدون تغییر دوباره دانلود نمی‌شود (پیشرفت حفظ می‌شود)',
    r3 && (+r3.reused || 0) >= 1);
  test('دادهٔ درخواست تأمین در همان تلاش کامل و درست تحویل می‌شود',
    store.ptf_crm_rfqs === SERVER.keys.ptf_crm_rfqs.payload);

  /* ── سناریو ۴: تغییر واقعی همان collection ⇒ 409 و تلاش دوباره با manifest تازه ── */
  SERVER.manifestHits = 0;
  var conflicted = false;
  SERVER.onChunk = function (q) {
    if (conflicted || q.collection !== 'ptf_crm_rfqs') return;
    conflicted = true;
    SERVER.keys.ptf_crm_rfqs.payload = buildRfqPayload(900, 'D');
    SERVER.keys.ptf_crm_rfqs.rev = 44;
    SERVER.rev = 44;
  };
  var r4 = await pullAtomic({});
  SERVER.onChunk = null;
  test('تغییر واقعی همان collection ⇒ manifest تازه و تلاش مجدد موفق (نه شکست)',
    r4 && r4.ok === true && SERVER.manifestHits >= 2);
  test('پس از تعارض، نسخهٔ نهایی همان نسخهٔ جدید سرور است',
    store.ptf_crm_rfqs === SERVER.keys.ptf_crm_rfqs.payload);

  /* ── سناریو ۵: شکست پیاپی مسیر اتمیک ⇒ عبور خودکار به pull دلتا (بوت زنده) ── */
  store.ptf_crm_rfqs = '[]';
  store.ptf_sync_rev = '0';
  try { ctx.localStorage.removeItem('ptf_sync_krevs'); } catch (e) {}
  SERVER.pullHits = 0;
  SERVER.manifestOverride = function () {
    /* manifest معیوب: کلیدی که sha256 ندارد ⇒ manifest_integrity_invalid */
    return { ok: true, contract: 'ptf-sync-v2', revision: SERVER.rev, snapshot: { id: 'S-' + SERVER.rev, rev: SERVER.rev, complete: true, keyList: ['ptf_crm_rfqs'], count: 1, checksum: sha256('x'), keys: { ptf_crm_rfqs: { kind: 'array', count: 1, available: true } } }, meta: {} };
  };
  var f1 = await new Promise(function (resolve) { ctx.ptfSyncFullResync(resolve); });
  test('تلاش اول اتمیکِ ناسالم fail-closed است (هیچ داده‌ای نوشته نمی‌شود)',
    f1 && f1.ok === false && store.ptf_crm_rfqs === '[]');
  var f2 = await new Promise(function (resolve) { ctx.ptfSyncFullResync(resolve); });
  test('پس از دو شکست پیاپی، مسیر دلتای معتبر جایگزین می‌شود و CRM بارگذاری می‌شود',
    f2 && f2.ok === true && SERVER.pullHits === 1 && store.ptf_crm_rfqs === SERVER.keys.ptf_crm_rfqs.payload);
  SERVER.manifestOverride = null;

  /* ── سناریو ۶: صحت‌سنجی همچنان fail-closed است (بایت خراب = رد کامل) ────── */
  store.ptf_crm_rfqs = '[]';
  SERVER.rev = 50; SERVER.keys.ptf_crm_rfqs.rev = 50;
  var realChunk = chunkResponse;
  var corruptOnce = true;
  ctx.fetch = (function (orig) {
    return function (url) {
      var q = parseQuery(url);
      if (q.action === 'data_chunk' && q.collection === 'ptf_crm_rfqs' && corruptOnce) {
        var res = realChunk(q);
        if (res.status === 200 && res.body.done) { res.body.part = res.body.part.replace('درخواست', 'دِرخواست'); }
        return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve(res.body); } });
      }
      return orig(url);
    };
  })(ctx.fetch);
  var r6 = await pullAtomic({});
  test('payload دستکاری‌شده هرگز نوشته نمی‌شود و آخرین نسخهٔ سالم می‌ماند',
    r6 && r6.ok === false && /snapshot_(bytes|checksum)_mismatch/.test(String(r6.reason || '')) && store.ptf_crm_rfqs === '[]');

  /* ── بخش ۴: پیام کاربر — علت‌دار، بدون تکرار هر ۵ ثانیه، با backoff ───────── */
  test('پیام بوت علت واقعی را نشان می‌دهد و تا یک دقیقه تکرار نمی‌شود',
    syncSrc.indexOf('دریافت کامل CRM هنوز انجام نشده (علت: ') > -1 &&
    syncSrc.indexOf('Date.now() - (+prevNotice.at || 0)) < 60000') > -1);
  test('فاصلهٔ تلاش مجدد bootstrap پلکانی است (۵ تا ۳۰ ثانیه)',
    syncSrc.indexOf('Math.min(30000, 5000 * state.bootstrapAttempt)') > -1);
  test('کلیدهای ناخوانا به کاربر گزارش می‌شوند',
    syncSrc.indexOf('بخش روی سرور قابل خواندن نبود و نسخهٔ محلی همان‌ها حفظ شد') > -1);
  test('عبور به مسیر دلتا پس از دو شکست پیاپی در کد ثبت است',
    syncSrc.indexOf('state.atomicFailStreak >= 2') > -1);
  test('نسخهٔ انتشار هم‌تراز است', version === 'v34.38.12');

  console.log('');
  if (failures) {
    console.log('=== tester618: ' + failures + ' FAIL ===');
    process.exit(1);
  }
  console.log('PASS tester618-v34.38.11-atomic-pull-completion');
})().catch(function (e) {
  console.log('FAIL exception: ' + (e && e.stack || e));
  process.exit(1);
});
