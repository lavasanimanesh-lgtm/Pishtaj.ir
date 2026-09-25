'use strict';
/* ─────────────────────────────────────────────────────────────────────────────
   tester674 — v34.39.40 (RESTORE-TOMBSTONE-REKILL)

   گزارش کارفرما: «پرونده‌ای را بایگانی کردم؛ بعداً به جریان انداختم و پرونده به
   پرونده‌های فروش منتقل شد. اما پس از مدتی پیشنهاد آن پرونده به‌عنوان «پیشنهاد
   برنده بدون پرونده» یافته شد و دیدم کلاً پرونده از داده‌ها پاک شده است.»

   زنجیرهٔ مرگ (با اجرای کد واقعی + پورت وفادار sync_apply_tombstones سرور):
     ① بایگانی با entity_delete، سنگ‌قبر فعالِ سمت سرور می‌سازد
        (kind=archive_purge، identities: ptf_crm_deals:[dealCd]، deletedAt=ISO).
     ② «به جریان انداختن» رکورد فروش را فقط با تاریخ فارسی t/restoredAt می‌ساخت —
        هیچ createdAt/createdAtISO قابل‌خواندن نداشت. خنثی‌سازی سنگ‌قبر
        (sfNeutralizeDealTombstones) فقط محلی بود و ذخیره‌اش به‌خاطر ردیف‌های بی‌cd
        آرشیو حذف (diff روتر با cd ولی idField سرور _id) به legacyFallback می‌افتاد →
        سنگ‌قبر روی سرور فعال می‌ماند.
     ③ در اولین data_push بعدی (dirty پس از upsert ناموفق/آفلاین)،
        sync_apply_tombstones با سنگ‌قبر فعال، رکوردِ بدون تاریخ ساخت را می‌کشد
        (sync_tombstone_outranks_row) و همان push آرشیو را جایگزین می‌کند؛ فیلتر alias
        زیررشته‌ای (strpos) ردیف‌های restored:/recycle را هم می‌سوخت → نه deal، نه
        tombstone خنثی‌شده، نه recycle می‌ماند — حذف کامل بی‌اثر. پیشنهاد برنده می‌ماند
        → «پیشنهاد برنده بدون پرونده» (orphan_won).
        مسیر دوم مرگ: pull بوت با T1 فعال + ردیف بدون تاریخ ساخت.
        تقویت‌کننده: جاروی یکتایی با رستاخیز رکورد بایگانیِ زامبی، پروندهٔ
        به‌جریان‌افتاده را با entity_delete قطعی می‌کشت.

   قراردادهایی که این تستر قفل می‌کند:
     R1) رکورد «به جریان افتاده» حتماً createdAt/createdAtISO (ISO) دارد تا گارد
         تاریخِ سنگ‌قبر بتواند تازگی‌اش را اثبات کند.
     R2) خنثی‌سازی سنگ‌قبر به‌صورت فرمان سروری (entity_tombstones_neutralize) است —
         نه فقط mutate محلی — و ذخیرهٔ آرشیو حذف، ردیف‌ها را با _id (هویت سرور)
         upsert می‌کند نه cd.
     R3) push/pull واقعی پس از بازگشت (با upsert ناموفق/آفلاین) پرونده را نمی‌کشد —
         پرونده در هر دو مجموعه می‌ماند.
     R4) جاروی یکتایی در برخورد «پروندهٔ به‌جریان‌افتاده + رکورد بایگانی زامبی»
         رکورد بایگانی کهنه را حذف می‌کند (نه پروندهٔ زندهٔ دارای restoredFrom)؛
         رفتار قبلی برای دوقلوهای بدون restoredFrom حفظ است (قرارداد U3 قبلی).
     R5) پیوند پیشنهاد↔پرونده برای بازگردانده‌شده‌ها با offerNos هم برقرار است؛
         پیشنهاد برندهٔ دارای پرونده هرگز «بدون پرونده» یافته نمی‌شود.
     R6) فیلتر alias آرشیو حذف فقط برای «پاک‌سازی گراف کل پروژه» (سنگ‌قبر بدون
         collection) است؛ ردیف‌های recycle / restored: / خودِ سنگ‌قبرها قربانی strpos
         نمی‌شوند (قرینهٔ قرارداد v34.37.0 ③ — سمت سرور و کلاینت).

   اجرا: node _tools/uat/tester674-v34.39.20-restore-tombstone-rekill.js
   ───────────────────────────────────────────────────────────────────────────── */
var fs = require('fs');
var path = require('path');

var failures = 0;
function test(name, cond, detail) {
  if (cond) { console.log('PASS ' + name); return; }
  failures++;
  console.log('FAIL ' + name + (detail ? ' — ' + detail : ''));
}

var sf = fs.readFileSync('crm/salesfiles.js', 'utf8');
var sd = fs.readFileSync('crm/sales-domain-v2.js', 'utf8');
var syncJs = fs.readFileSync('crm/sync.js', 'utf8');
var apiCrm = fs.readFileSync('api/crm.php', 'utf8');
var apiSd = fs.readFileSync('api/sales-domain.php', 'utf8');
var gate = fs.readFileSync('_tools/uat/run-ci-gate.js', 'utf8');
var indexHtml = fs.readFileSync('crm/index.html', 'utf8');
var sw = fs.readFileSync('crm/sw.js', 'utf8');
var tester621Src = fs.readFileSync('_tools/uat/tester621-v34.38.14-archive-uniqueness-restore.js', 'utf8');
var version = JSON.parse(fs.readFileSync('VERSION.json', 'utf8')).crm_version;

/* ═══ بخش ۱: قراردادهای ساختاری ═══ */
test('S1: بازگشت، تاریخ ساخت ISO روی رکورد می‌نشاند (createdAt/createdAtISO)',
  sf.indexOf('createdAt: isoNow') > -1 && sf.indexOf('createdAtISO: isoNow') > -1 && sf.indexOf('var isoNow') > -1,
  'salesfiles.js باید در ptfSalesfileRestoreFromArchive تاریخ ISO بنشاند');
test('S2: فرمان سروری entity_tombstones_neutralize در api/sales-domain.php هست',
  apiSd.indexOf('entity_tombstones_neutralize') > -1 &&
  apiSd.indexOf("restored:' . (string)($a['kind'] ?? '')") > -1);
test('S3: کلاینت هنگام بازگشت، فرمان entity_tombstones_neutralize را صدا می‌زند',
  sf.indexOf('entity_tombstones_neutralize') > -1);
test('S4: خنثی‌سازی، ردیف آرشیو را per-row روی _id (هویت سرور) upsert می‌کند',
  sf.indexOf("ptfEntityUpsert('ptf_crm_deleted_archive'") > -1 ||
  sf.indexOf('ptfEntityUpsert("ptf_crm_deleted_archive"') > -1);
test('S5: روتر مجموعه، آرشیو حذف را با _id (fallback cd/id) هویت‌یابی می‌کند نه فقط cd',
  sd.indexOf("collection === 'ptf_crm_deleted_archive'") > -1 && /_id \|\| r\.cd \|\| r\.id/.test(sd));
test('S6: جاروی یکتایی برای پروندهٔ دارای restoredFrom، رکورد بایگانی زامبی را حذف می‌کند نه پروندهٔ زنده',
  sf.indexOf('restoredFrom') > -1 && sf.indexOf('removedArchived') > -1 && sf.indexOf('sf-unique-sweep-keep-restored') > -1);
test('S7: فیلتر alias آرشیو حذف — سمت سرور — فقط پاک‌سازی گراف (archive_purge بدون collection) و نگهبان restored:/recycle',
  (function () {
    var i = apiCrm.indexOf("if ($key === 'ptf_crm_deleted_archive')");
    if (i < 0) return false;
    var seg = apiCrm.slice(i, i + 2600);
    return seg.indexOf("$d['collection']") > -1 && seg.indexOf('archive_purge') > -1 &&
      seg.indexOf('restored:') > -1 && seg.indexOf("'recycle'") > -1;
  })(),
  'crm.php باید alias-strip را فقط برای archive_purge بدون collection و نگهبانی restored:/recycle داشته باشد');
test('S8: فیلتر alias آرشیو حذف — سمت کلاینت (ptfApplyDeletionTombstones) — همان قرارداد',
  (function () {
    var i = syncJs.indexOf('window.ptfApplyDeletionTombstones = function');
    if (i < 0) return false;
    var seg = syncJs.slice(i, i + 1600);
    return seg.indexOf('d.collection') > -1 && seg.indexOf('archive_purge') > -1 &&
      seg.indexOf('restored:') > -1 && seg.indexOf('recycle') > -1;
  })(),
  'sync.js باید نگهبان restored:/recycle + شرط collection خالی را داشته باشد');
test('S9: پیوند پیشنهاد↔پرونده با offerNos هم برقرار است (caseBelongsToOffer)',
  (function () {
    var m = sd.match(/function caseBelongsToOffer\(c,o\)\{[\s\S]*?\n  \}/);
    return !!m && m[0].indexOf('offerNos') > -1;
  })());
test('S10: رکورد بازگردانده‌شده offerNos/linkedOffers را حمل می‌کند',
  sf.indexOf('offerNos') > -1 && sf.indexOf('linkedOffers') > -1 && sf.indexOf('ptfArchivedProjectOfferNos') > -1);

/* ═══ بخش ۲: رفتاری — کد واقعی + سرور وفادار (پورت sync_apply_tombstones/entity_*) ═══ */
require('./harness.js');
var BASE = function (p) { return path.resolve(__dirname, '../../crm', p); };

/* ── پورت وفادار لایهٔ سرور (api/crm.php sync_apply_tombstones + entity_*) ──
   قواعد kill (تاریخ‌نگاری/identities) عین فایل است؛ فیلتر alias آرشیو حذف به قرارداد
   v34.39.40 (قرینهٔ v34.37.0 ③) برگردانده شده و با grep های S7/S8 روی هر دو فایل پین است. */
function portTombstoneEpoch(d) {
  if (!d || typeof d !== 'object') return 0;
  var fields = ['deletedAt', 'purgedAt', 'iso', 'at', 'ts'];
  for (var i = 0; i < fields.length; i++) {
    var v = String(d[fields[i]] || '').trim();
    if (v && /^\d{4}-\d{2}-\d{2}[T ]/.test(v)) { var t = Date.parse(v); if (t) return t; }
  }
  return 0;
}
function portRowCreatedEpoch(r) {
  if (!r || typeof r !== 'object') return 0;
  var fields = ['createdAt', 'createdAtISO', 'crAtISO', 'createdISO', 'iso'];
  for (var i = 0; i < fields.length; i++) {
    var v = String(r[fields[i]] || '').trim();
    if (v && /^\d{4}-\d{2}-\d{2}[T ]/.test(v)) { var t = Date.parse(v); if (t) return t; }
  }
  return 0;
}
function portTombstoneOutranksRow(tombEpoch, row) {
  if (!(tombEpoch > 0)) return true;
  var rowEpoch = portRowCreatedEpoch(row);
  if (!(rowEpoch > 0)) return true;
  return rowEpoch <= tombEpoch;
}
function portTombstoneMark(map, id, epoch) {
  id = String(id == null ? '' : id).trim();
  if (!id) return;
  epoch = +epoch || 0;
  if (!(id in map)) { map[id] = epoch; return; }
  if (map[id] === 0 || epoch === 0) { map[id] = 0; return; }
  if (epoch > map[id]) map[id] = epoch;
}
function portRecordIdForKey(key, r) {
  if (!r || typeof r !== 'object') return '';
  if (key === 'ptf_crm_offers') return String(r.no || r.cd || r.id || '').trim();
  return String(r._id || r.cd || r.no || r.id || r.code || r.invoiceCd || '').trim();
}
var PORT_TOMB_KINDS = {
  ptf_crm_offers: ['offer', 'offers', 'to', 'co', 'tc'],
  ptf_crm_deals: ['deal', 'deals', 'salesfile'],
  ptf_crm_projects: ['project', 'projects', 'salesfile']
};
function portDecodeArchive(json) { try { var a = JSON.parse(json || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
function portApplyTombstones(key, json, serverArchiveJson, incomingArchiveJson) {
  serverArchiveJson = serverArchiveJson || '[]';
  incomingArchiveJson = incomingArchiveJson || '[]';
  if (key === 'ptf_crm_deleted_archive') {
    /* v34.39.40: alias-strip فقط برای پاک‌سازی گراف (archive_purge بدون collection)؛
       خود سنگ‌قبرها + restored: + recycle هرگز سوخته نمی‌شوند. */
    var gAliases = {};
    portDecodeArchive(serverArchiveJson).concat(portDecodeArchive(incomingArchiveJson)).forEach(function (d) {
      if (d && typeof d === 'object' && String(d.kind || '').toLowerCase() === 'archive_purge' && !String(d.collection || '').trim()) {
        (d.aliases || []).forEach(function (a) { a = String(a || '').trim(); if (a.length >= 6) gAliases[a] = true; });
      }
    });
    var gList = Object.keys(gAliases);
    if (!gList.length) return json;
    var rowsA; try { rowsA = JSON.parse(json || '[]'); } catch (e) { return json; }
    if (!Array.isArray(rowsA)) return json;
    return JSON.stringify(rowsA.filter(function (row) {
      if (!row || typeof row !== 'object') return false;
      var kind = String(row.kind || '').toLowerCase();
      if (kind === 'archive_purge') return true;
      if (kind.indexOf('restored:') === 0) return true;
      if (kind === 'recycle') return true;
      var encoded = JSON.stringify(row);
      return !gList.some(function (a) { return encoded.indexOf(a) > -1; });
    }));
  }
  var kinds = PORT_TOMB_KINDS[key] || [];
  var kindSet = {};
  kinds.forEach(function (k) { kindSet[String(k).toLowerCase()] = true; });
  var ids = {}, purgeAliases = {};
  portDecodeArchive(serverArchiveJson).concat(portDecodeArchive(incomingArchiveJson)).forEach(function (d) {
    if (!d || typeof d !== 'object') return;
    var kind = String(d.kind || '').toLowerCase();
    var tombEpoch = portTombstoneEpoch(d);
    if (kind === 'archive_purge' && d.identities && Array.isArray(d.identities[key])) {
      d.identities[key].forEach(function (pid) { portTombstoneMark(ids, pid, tombEpoch); });
      if (!String(d.collection || '').trim() && Array.isArray(d.aliases)) {
        d.aliases.forEach(function (al) { al = String(al || '').trim(); if (al.length >= 6) portTombstoneMark(purgeAliases, al, tombEpoch); });
      }
    }
    if (!kindSet[kind]) return;
    portTombstoneMark(ids, String(d.id || d.no || d.cd || ''), tombEpoch);
  });
  if (!Object.keys(ids).length && !Object.keys(purgeAliases).length) return json;
  var arr; try { arr = JSON.parse(json || '[]'); } catch (e2) { return json; }
  if (!Array.isArray(arr)) return json;
  var paList = Object.keys(purgeAliases);
  return JSON.stringify(arr.filter(function (r) {
    var id = portRecordIdForKey(key, r);
    if (id && (id in ids) && portTombstoneOutranksRow(ids[id], r)) return false;
    if (!paList.length) return true;
    var encoded = '';
    try { encoded = JSON.stringify(r || {}); } catch (e3) {}
    return !paList.some(function (a) { return encoded.indexOf(a) > -1 && portTombstoneOutranksRow(purgeAliases[a], r); });
  }));
}

/* ── سرور شبیه‌سازی‌شده: entity_upsert / entity_delete / entity_tombstones_neutralize
      (عین ساختار api/sales-domain.php: سنگ‌قبر با identities+deletedAt، createdAt در create) ── */
var serverStore = {};
var serverLog = [];
var serverFailDealUpsert = 0;
function T1_ROW(id, coll) {
  return {
    _id: 'DEL-' + id, kind: 'archive_purge', collection: coll || 'ptf_crm_deals', id: id, cd: id,
    aliases: [id], identities: (function () { var o = {}; o[coll || 'ptf_crm_deals'] = [id]; return o; })(),
    reason: 'sf-archive', deletedBy: 'تستر', deletedAt: '2026-09-20T08:00:00Z'
  };
}
function seedServer(withTombstone) {
  serverStore = { ptf_crm_deals: [], ptf_crm_projects: [], ptf_crm_deleted_archive: [], ptf_crm_offers: [] };
  if (withTombstone) serverStore.ptf_crm_deleted_archive.push(T1_ROW('DEAL-1'));
  serverLog = [];
  serverFailDealUpsert = 0;
}
function serverCmd(action, payload) {
  serverLog.push(action + ':' + (payload.collection || '') + ':' + String(payload.id || (payload.record && (payload.record._id || payload.record.cd)) || (payload.ids || []).join(',') || ''));
  if (action === 'entity_tombstones_neutralize') {
    var nColl = payload.collection;
    var nIds = (payload.ids || []).map(String);
    var want = {}; nIds.forEach(function (x) { want[x] = 1; });
    var nKinds = {}; (PORT_TOMB_KINDS[nColl] || []).forEach(function (k) { nKinds[k.toLowerCase()] = 1; });
    var fixed = 0;
    (serverStore.ptf_crm_deleted_archive || []).forEach(function (a) {
      if (!a || typeof a !== 'object') return;
      var kind = String(a.kind || '').toLowerCase();
      if (!kind || kind.indexOf('restored:') === 0) return;
      var hit = false;
      if (kind === 'archive_purge') {
        [a.id, a.cd, a.no].forEach(function (x) { if (x != null && want[String(x)]) hit = true; });
        (a.aliases || []).forEach(function (x) { if (x != null && want[String(x)]) hit = true; });
        ((a.identities && a.identities[nColl]) || []).forEach(function (x) { if (x != null && want[String(x)]) hit = true; });
      } else if (nKinds[kind]) {
        if (want[String(a.id || a.no || a.cd || '')]) hit = true;
      }
      if (!hit) return;
      a.kind = 'restored:' + String(a.kind || '');
      a.restoredAt = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
      a.restoredBy = 'تستر';
      fixed++;
    });
    var outN = { ptf_crm_deleted_archive: JSON.stringify(serverStore.ptf_crm_deleted_archive) };
    return { state: 'acked', response: { data: outN, rev: 1, result: { neutralized: fixed } } };
  }
  if (action === 'entity_upsert') {
    var coll = payload.collection;
    if (coll === 'ptf_crm_deals' && serverFailDealUpsert > 0) {
      serverFailDealUpsert--;
      return { state: 'rejected', error: { message: 'network', status: 0 } };
    }
    var rec = JSON.parse(JSON.stringify(payload.record || {}));
    var idKey = coll === 'ptf_crm_deleted_archive' ? '_id' : 'cd';
    var id = String(rec[idKey] || rec.cd || rec._id || '');
    if (!/^[A-Za-z0-9._:-]{3,60}$/.test(id)) return { state: 'rejected', error: { message: 'entity_id_required', status: 422 } };
    var rows = serverStore[coll] = serverStore[coll] || [];
    var found = -1;
    rows.forEach(function (r, i) { if (String(r[idKey] || r.cd || r._id || '') === id) found = i; });
    if (payload.expectCreate && found >= 0) return { state: 'rejected', error: { message: 'entity_id_exists', status: 409 } };
    var now = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    if (found < 0) {
      if (idKey !== '_id') { rec.createdAt = now; rec.createdBy = 'تستر'; }
      rows.push(rec);
    } else {
      if (idKey !== '_id') {
        rec.createdAt = String(rows[found].createdAt || now);
        rec.createdBy = String(rows[found].createdBy || 'تستر');
      }
      rows[found] = rec;
    }
    var out = {}; out[coll] = JSON.stringify(rows);
    return { state: 'acked', response: { data: out, rev: 1, result: { collection: coll, id: id } } };
  }
  if (action === 'entity_delete') {
    var coll2 = payload.collection, id2 = String(payload.id || '');
    var rows2 = serverStore[coll2] = serverStore[coll2] || [];
    var idx = -1;
    rows2.forEach(function (r, i) { if (String(r.cd || r._id || r.no || '') === id2) idx = i; });
    if (idx >= 0) {
      rows2.splice(idx, 1);
      serverStore.ptf_crm_deleted_archive.push({
        _id: 'DEL-' + id2 + '-' + Date.now().toString(36), kind: 'archive_purge', collection: coll2,
        id: id2, cd: id2, aliases: [id2], identities: (function () { var o = {}; o[coll2] = [id2]; return o; })(),
        reason: String(payload.reason || 'entity_delete'), deletedBy: 'تستر', deletedAt: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
      });
      var out2 = {}; out2[coll2] = JSON.stringify(serverStore[coll2]); out2.ptf_crm_deleted_archive = JSON.stringify(serverStore.ptf_crm_deleted_archive);
      return { state: 'acked', response: { data: out2, rev: 1, result: { deleted: true } } };
    }
    return { state: 'acked', response: { data: {}, rev: 1, result: { deleted: false, alreadyDeleted: true } } };
  }
  return { state: 'acked', response: { data: {}, rev: 1, result: {} } };
}

/* ── چرخهٔ واقعی sync: push_dirty (با پیش‌فیلتر ptfApplyDeletionTombstones واقعی) + pull ── */
function pushCycle(keys) {
  var serverArchiveJson = JSON.stringify(serverStore.ptf_crm_deleted_archive || []);
  var incomingArchiveJson = '';
  var payload = {};
  keys.forEach(function (k) {
    var v = JSON.stringify(getData(k) || []);
    /* الگوی pushOnce: پیش‌فیلتر کلاینت با ptfApplyDeletionTombstones واقعی (sync.js) */
    var v2 = window.ptfApplyDeletionTombstones(k, v);
    payload[k] = v2;
    if (k === 'ptf_crm_deleted_archive') incomingArchiveJson = v2;
  });
  /* الگوی data_push: sync_apply_tombstones با آرشیو سرورِ «قبل از» حلقه + جایگزینی کامل */
  Object.keys(payload).forEach(function (k) {
    var filtered = portApplyTombstones(k, payload[k], serverArchiveJson, incomingArchiveJson);
    serverStore[k] = JSON.parse(filtered);
  });
}
function pullCycle(keys) {
  var serverArchiveJson = JSON.stringify(serverStore.ptf_crm_deleted_archive || []);
  var pulledArchive = portApplyTombstones('ptf_crm_deleted_archive', serverArchiveJson, serverArchiveJson, '[]');
  keys.forEach(function (k) {
    var raw = JSON.stringify(serverStore[k] || []);
    var newStr = portApplyTombstones(k, raw, serverArchiveJson, '[]');
    /* الگوی pull: ptfApplyDeletionTombstones واقعی با آرشیو کشیده‌شده */
    newStr = window.ptfApplyDeletionTombstones(k, newStr, pulledArchive);
    setData(k, JSON.parse(newStr));
  });
}
function caseAliveLocal() {
  var deals = getData('ptf_crm_deals') || [];
  var prjs = getData('ptf_crm_projects') || [];
  return deals.some(function (d) { return d && d.cd === 'DEAL-1'; }) ||
    prjs.some(function (p) { return p && (p.dealCd === 'DEAL-1' || p.cd === 'ARC-DEAL-1' || p.no === 'ARC-INQ-100'); });
}
function caseAliveServer() {
  var deals = serverStore.ptf_crm_deals || [];
  var prjs = serverStore.ptf_crm_projects || [];
  return deals.some(function (d) { return d && d.cd === 'DEAL-1'; }) ||
    prjs.some(function (p) { return p && (p.dealCd === 'DEAL-1' || p.cd === 'ARC-DEAL-1' || p.no === 'ARC-INQ-100'); });
}

/* ── آماده‌سازی محیط واقعی (الگوی tester621 + failDirty/بازیافت) ── */
var DEAL = {
  cd: 'DEAL-1', inqNo: 'INQ-100', buyerCo: 'شرکت تست', wonOffer: 'CO-100', st: 'open',
  t: '1405/06/01', docs: [], timeline: [{ t: '1405/06/01', by: 'x', tx: 'ساخت' }],
  costEvents: [], lossEvents: []
};
var ARC = {
  cd: 'ARC-DEAL-1', no: 'ARC-INQ-100', dealCd: 'DEAL-1', inqNo: 'INQ-100', buyerCo: 'شرکت تست',
  offerNo: 'CO-100', wonOffer: 'CO-100', state: 'archived', origin: 'salesfile', closeKind: 'lost',
  t: '1405/06/02', offerNos: ['CO-100'], linkedOffers: [], originTimeline: [{ t: '1405/06/01', by: 'x', tx: 'ساخت' }], origSt: 'open'
};
var LEGACY_ROW = { id: 'OFF-OLD', kind: 'OFFER', label: 'CO-old — x', reason: 'حذف دستی پیشنهاد', by: 'کاربر', t: '1405/05/01' };

function seed(withTombstoneOnServer) {
  seedServer(withTombstoneOnServer);
  serverStore.ptf_crm_offers = [{ no: 'CO-100', kind: 'CO', inqNo: 'INQ-100', buyerCo: 'شرکت تست', st: 'won', items: [], _id: 'OID-1' }];
  setData('ptf_crm_deals', []);
  setData('ptf_crm_projects', [JSON.parse(JSON.stringify(ARC))]);
  setData('ptf_crm_offers', [JSON.parse(JSON.stringify(serverStore.ptf_crm_offers[0]))]);
  setData('ptf_crm_rfqs', [{ cd: 'INQ-100', inqNo: 'INQ-100', _id: 'RFQ-1' }]);
  setData('ptf_crm_letters', []);
  setData('ptf_crm_invoices', []);
  setData('ptf_crm_rfqsmart', []);
  /* آرشیو حذفِ واقع‌گرایانه: T1 فعال + ردیف recycle + ردیف کهنهٔ بی‌cd (الگوی offers.js) */
  var arch = [];
  if (withTombstoneOnServer) {
    arch.push(JSON.parse(JSON.stringify(serverStore.ptf_crm_deleted_archive[0]))); /* T1 محلی = همان سرور */
    arch.push({ _id: 'RC-DEAL-1', kind: 'recycle', collection: 'ptf_crm_deals', id: 'DEAL-1', cd: 'DEAL-1', reason: 'sf-archive', by: 'تستر', t: '1405/06/02', snapshot: JSON.parse(JSON.stringify(DEAL)) });
    arch.push(JSON.parse(JSON.stringify(LEGACY_ROW)));
  } else {
    arch.push(JSON.parse(JSON.stringify(LEGACY_ROW)));
  }
  setData('ptf_crm_deleted_archive', arch);
  serverFailDealUpsert = 0;
}

global.ptfSalesDomainCommand = function (action, payload) { return Promise.resolve(serverCmd(action, payload)); };
global.ptfSyncAcknowledgeKeys = function () {};
global.ptfSyncNotifyDirty = function () { /* failDirty: push بعدی همین کلید را می‌برد — در چرخه‌ها صریح می‌دهیم */ };
global.ptfBApplyServerProjection = function (k, value) {
  try { setData(k, typeof value === 'string' ? JSON.parse(value) : value); return true; } catch (e) { return false; }
};
global.ptfSilentWrite = function (coll, s) { try { setData(coll, JSON.parse(s)); } catch (e) {} };
global.ptfEntityUpsert = function (collection, record, opts) {
  opts = opts || {};
  return global.ptfSalesDomainCommand('entity_upsert', {
    collection: collection, record: record,
    expectCreate: !!opts.expectCreate, reason: opts.reason, idempotencyKey: opts.operationId
  }, { apiOptions: { autoReplay: true } }).then(function (st) {
    if (st && st.state === 'acked') {
      var data = (st.response && st.response.data) || {};
      if (data[collection] != null) global.ptfBApplyServerProjection(collection, data[collection], st.response.rev);
      if (opts.cb) opts.cb({ state: 'acked', result: (st.response && st.response.result) || {} });
    } else {
      if (opts.cb) opts.cb({ state: st ? st.state : 'rejected', error: st && st.error });
    }
    return st;
  });
};
global.ptfEntityDelete = function (collection, id, opts) {
  opts = opts || {};
  /* الگوی واقعی sales-domain-v2: پیش از حذف، snapshot بازیافت (kind=recycle) */
  try {
    if (collection !== 'ptf_crm_deleted_archive') {
      var rcRows = getData(collection) || [];
      var rcVictim = rcRows.filter(function (r) { return r && (String(r.cd) === String(id) || String(r._id) === String(id) || String(r.no) === String(id) || String(r.id) === String(id)); })[0];
      if (rcVictim) {
        var rcArch = getData('ptf_crm_deleted_archive') || [];
        rcArch.unshift({ _id: 'RC-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8), kind: 'recycle', collection: collection, id: String(id), cd: String(id), reason: opts.reason || 'entity_delete', by: 'تستر', t: '1405/06/20 10:00', snapshot: JSON.parse(JSON.stringify(rcVictim)) });
        if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection('ptf_crm_deleted_archive', rcArch, { reason: 'recycle-snapshot' });
        else setData('ptf_crm_deleted_archive', rcArch);
      }
    }
  } catch (eRc) {}
  return global.ptfSalesDomainCommand('entity_delete', { collection: collection, id: id, reason: opts.reason }, { apiOptions: { autoReplay: true } }).then(function (st) {
    if (st && st.state === 'acked') {
      var data = (st.response && st.response.data) || {};
      if (data[collection] != null) global.ptfBApplyServerProjection(collection, data[collection], st.response.rev);
      if (data.ptf_crm_deleted_archive != null) global.ptfBApplyServerProjection('ptf_crm_deleted_archive', data.ptf_crm_deleted_archive, st.response.rev);
      if (opts.cb) opts.cb({ state: 'acked', result: {} });
    } else {
      if (opts.cb) opts.cb({ state: st ? st.state : 'rejected', error: st && st.error });
    }
    return st;
  });
};

/* روتر واقعی از sales-domain-v2.js (الگوی tester621) */
var mRouter = sd.match(/\/\* ============ v34\.8\.22[\s\S]*?window\.ptfEntitySaveCollection = function \(collection, nextArr, opts\) \{[\s\S]*?\n  \};\n/);
if (!mRouter) { console.log('FAIL router extraction'); process.exit(1); }
eval(mRouter[0].replace('window.ptfEntitySaveCollection', 'global.ptfEntitySaveCollection = global.window.ptfEntitySaveCollection'));
global.ptfEntitySaveCollection = global.window.ptfEntitySaveCollection;
global.PTF_ENTITY_CMD_ENABLED = { ptf_crm_deals: true, ptf_crm_projects: true, ptf_crm_deleted_archive: true, ptf_crm_offers: true, ptf_crm_rfqs: true };

/* ptfApplyDeletionTombstones واقعی از sync.js */
var mTomb = syncJs.match(/  function ptfArchiveKindsForKey\(key\) \{[\s\S]*?window\.ptfApplyDeletionTombstones = function \(key, jsonStr, extraArchiveStr\) \{[\s\S]*?catch \(e\) \{ return jsonStr; \}\n  \};/);
if (!mTomb) { console.log('FAIL tombstone-helper extraction'); process.exit(1); }
eval(mTomb[0]);

global.renderDeals = function () {};
global.hideModal = function () {};
global.curSession = function () { return { name: 'تستر' }; };
global.ptfToast = function () {};
global.ptfEntityCommandMessage = function () { return ''; };
global.STORAGE_API = 'x';

/* کد واقعی ماژول پرونده‌های فروش */
eval(sf);

/* caseBelongsToOffer واقعی از sales-domain-v2.js (برای R5) */
var mCase = sd.match(/  function caseBelongsToOffer\(c,o\)\{[\s\S]*?\n  \}/);
function runCaseBelongsToOffer(c, o) {
  function identity(v) { return String(v || '').replace(/[\u200c\u200e\u200f\s]+/g, '').toUpperCase(); }
  function active(x) { var st = String((x && (x.status || x.st)) || '').toLowerCase(); return !!x && ['void', 'voided', 'deleted', 'cancelled', 'replaced', 'superseded'].indexOf(st) < 0 && !x.voided && !x.deleted; }
  function arr(v) { return Array.isArray(v) ? v : []; }
  if (!mCase) return false;
  var fn = new Function('identity', 'active', 'arr', 'return ' + mCase[0].replace('function caseBelongsToOffer', 'function'));
  return fn(identity, active, arr)(c, o);
}

console.log('\n── B1: بازتولید دقیق باگ — بایگانی(T1 فعال) ← به جریان انداختن ← upsert ناموفق ← push/pull ──');
seed(true);
serverFailDealUpsert = 1; /* «پس از مدتی»: upsert ثبت نمی‌رسد (آفلاین) → failDirty */
var res1b = global.ptfSalesfileRestoreFromArchive('ARC-INQ-100', {});
setTimeout(function () {
  test('B1b: بازگشت محلی موفق و پرونده در فروش دیده می‌شود حتی با شکست upsert (گزارش کاربر)',
    !!(res1b && res1b.ok && res1b.mode === 'restore') && getData('ptf_crm_deals').some(function (d) { return d.cd === 'DEAL-1'; }),
    JSON.stringify(res1b));

  pushCycle(['ptf_crm_deals', 'ptf_crm_projects', 'ptf_crm_deleted_archive']);
  pullCycle(['ptf_crm_deals', 'ptf_crm_projects', 'ptf_crm_deleted_archive']);

  test('B1c: (ریشهٔ باگ) پرونده پس از push/pull نمی‌میرد — سرور',
    caseAliveServer(),
    'server deals=' + JSON.stringify((serverStore.ptf_crm_deals || []).map(function (d) { return d.cd; })) +
    ' projects=' + JSON.stringify((serverStore.ptf_crm_projects || []).map(function (p) { return p.no; })) +
    ' archive=' + JSON.stringify((serverStore.ptf_crm_deleted_archive || []).map(function (a) { return a._id + ':' + a.kind; })));
  test('B1d: پرونده پس از pull محلی نمی‌میرد — «پیشنهاد بدون پرونده» پدید نمی‌آید',
    caseAliveLocal(),
    'local deals=' + JSON.stringify((getData('ptf_crm_deals') || []).map(function (d) { return d.cd; })) +
    ' projects=' + JSON.stringify((getData('ptf_crm_projects') || []).map(function (p) { return p.no; })));
  var link1 = runCaseBelongsToOffer((getData('ptf_crm_deals') || [])[0] || {}, getData('ptf_crm_offers')[0]) ||
    (getData('ptf_crm_projects') || []).some(function (p) { return p && p.no === 'ARC-INQ-100'; }) ||
    caseAliveLocal();
  test('B1e: پیشنهاد برنده بی‌پرونده رها نمی‌شود (پیوند برقرار است)', !!link1);

  console.log('\n── B2: بازگشت سالم — خنثی‌سازی سمت سرور + تاریخ ISO + بقای کامل ──');
  seed(true);
  var res2 = global.ptfSalesfileRestoreFromArchive('ARC-INQ-100', {});
  var deal2 = (getData('ptf_crm_deals') || []).filter(function (d) { return d.cd === 'DEAL-1'; })[0] || {};
  test('B2a: رکورد بازگردانده‌شده createdAt/createdAtISO قابل‌اثبات (ISO) دارد',
    /^\d{4}-\d{2}-\d{2}[T ]/.test(String(deal2.createdAt || '')) && /^\d{4}-\d{2}-\d{2}[T ]/.test(String(deal2.createdAtISO || deal2.createdAt || '')),
    JSON.stringify({ createdAt: deal2.createdAt, createdAtISO: deal2.createdAtISO, restoredAt: deal2.restoredAt }));
  test('B2b: offerNos/linkedOffers همراه رکورد بازگشت حمل می‌شود',
    (deal2.offerNos || []).indexOf('CO-100') > -1 && Array.isArray(deal2.linkedOffers),
    JSON.stringify(deal2.offerNos));
  test('B2c: فرمان سروری entity_tombstones_neutralize صدا شد و T1 سرور خنثی شد',
    serverLog.some(function (l) { return l.indexOf('entity_tombstones_neutralize:ptf_crm_deals:') === 0; }) &&
    (serverStore.ptf_crm_deleted_archive || []).some(function (a) { return String(a.id) === 'DEAL-1' && String(a.kind).indexOf('restored:') === 0; }),
    serverLog.join(' | '));
  setTimeout(function () {
    pushCycle(['ptf_crm_deals', 'ptf_crm_projects', 'ptf_crm_deleted_archive']);
    pullCycle(['ptf_crm_deals', 'ptf_crm_projects', 'ptf_crm_deleted_archive']);
    test('B2d: پرونده پس از چرخهٔ sync زنده است (هر دو سو)',
      caseAliveServer() && caseAliveLocal(),
      'server=' + JSON.stringify((serverStore.ptf_crm_deals || []).map(function (d) { return d.cd; })) + ' local=' + JSON.stringify((getData('ptf_crm_deals') || []).map(function (d) { return d.cd; })));
    var deal2b = (getData('ptf_crm_deals') || []).filter(function (d) { return d.cd === 'DEAL-1'; })[0] || {};
    test('B2e: پیوند پیشنهاد↔پرونده برقرار — orphan_won کاذب نیست',
      runCaseBelongsToOffer(deal2b, getData('ptf_crm_offers')[0]) === true ||
      (deal2b.offerNos || []).indexOf('CO-100') > -1);

    console.log('\n── B3: جاروی یکتایی + رکورد بایگانی زامبی (رستاخیز از دستگاه کهنه) ──');
    setData('ptf_crm_deals', [{
      cd: 'DEAL-1', inqNo: 'INQ-100', buyerCo: 'شرکت تست', wonOffer: 'CO-100', st: 'open',
      restoredFrom: 'ARC-INQ-100', restoredAt: '1405/06/20', createdAt: '2026-09-20T10:00:00Z',
      docs: [], timeline: [], costEvents: [], lossEvents: []
    }]);
    setData('ptf_crm_projects', [JSON.parse(JSON.stringify(ARC))]);
    var sw3 = global.ptfSalesfileUniquenessSweep({ quiet: true });
    test('B3a: پروندهٔ به‌جریان‌افتاده (restoredFrom) در جارو زنده می‌ماند',
      (getData('ptf_crm_deals') || []).some(function (d) { return d.cd === 'DEAL-1'; }),
      JSON.stringify(sw3));
    test('B3b: رکورد بایگانی زامبیِ همان restoredFrom حذف می‌شود (یک پرونده = یک محل)',
      !(getData('ptf_crm_projects') || []).some(function (p) { return p && p.no === 'ARC-INQ-100'; }) &&
      (sw3.removedArchived || []).indexOf('ARC-INQ-100') > -1,
      JSON.stringify(sw3));

    console.log('\n── B4: قرارداد قبلی U3 حفظ — دوقلوی بدون restoredFrom: بایگانی برنده می‌ماند ──');
    setData('ptf_crm_deals', [{ cd: 'DEAL-1', inqNo: 'INQ-100', buyerCo: 'x', wonOffer: 'CO-100', st: 'open', docs: [] }]);
    setData('ptf_crm_projects', [JSON.parse(JSON.stringify(ARC))]);
    var sw4 = global.ptfSalesfileUniquenessSweep({ quiet: true });
    test('B4: نسخهٔ زندهٔ بدون restoredFrom حذف و بایگانی می‌ماند (U3 قبلی)',
      sw4.removed.length === 1 && sw4.removed[0] === 'DEAL-1' &&
      (getData('ptf_crm_deals') || []).length === 0 && (getData('ptf_crm_projects') || []).length === 1);

    console.log('\n── B5: فیلتر alias آرشیو حذف — پاک‌سازی گراف فقط؛ restored:/recycle نمی‌سوزند (R6) ──');
    var graphPurge = { _id: 'DEL-G1', kind: 'archive_purge', id: 'GONE-PROJ', cd: 'GONE-PROJ', aliases: ['GONE-PROJ'], deletedAt: '2026-09-20T08:00:00Z' }; /* بدون collection = پاک‌سازی گراف */
    var singlePurge = T1_ROW('DEAL-1'); /* collection دارد = تک‌رکوردی */
    var arcRows = [
      graphPurge,
      singlePurge,
      { _id: 'RC-1', kind: 'recycle', collection: 'ptf_crm_deals', id: 'DEAL-1', cd: 'DEAL-1', snapshot: { cd: 'DEAL-1' } },
      { _id: 'RS-1', kind: 'restored:archive_purge', collection: 'ptf_crm_deals', id: 'DEAL-1', cd: 'DEAL-1', aliases: ['DEAL-1'] },
      JSON.parse(JSON.stringify(LEGACY_ROW)),
      { _id: 'LG-2', id: 'GONE-PROJ-x', kind: 'note', note: 'mentions GONE-PROJ inside text' }
    ];
    var arcJson = JSON.stringify(arcRows);
    var keptP = JSON.parse(portApplyTombstones('ptf_crm_deleted_archive', arcJson, arcJson, '[]'));
    var keptPIds = keptP.map(function (r) { return r._id || r.id; });
    test('B5a: سمت سرور — recycle از فیلتر alias جان سالم به در می‌برد (تک‌رکوردی alias نمی‌سوزاند)',
      keptPIds.indexOf('RC-1') > -1, keptPIds.join(','));
    test('B5b: سمت سرور — ردیف restored: نمی‌سوزد (خنثی‌سازی ماندگار است)',
      keptPIds.indexOf('RS-1') > -1, keptPIds.join(','));
    test('B5c: سمت سرور — پاک‌سازی گراف (بدون collection) همچنان ردیف‌های alias‌دار خودش را می‌سوزاند',
      keptPIds.indexOf('LG-2') < 0 && keptPIds.indexOf('OFF-OLD') > -1, keptPIds.join(','));
    var keptJ = JSON.parse(window.ptfApplyDeletionTombstones('ptf_crm_deleted_archive', arcJson, arcJson));
    var keptJIds = keptJ.map(function (r) { return r._id || r.id; });
    test('B5d: سمت کلاینت (ptfApplyDeletionTombstones واقعی) — همان قرارداد recycle/restored:',
      keptJIds.indexOf('RC-1') > -1 && keptJIds.indexOf('RS-1') > -1 && keptJIds.indexOf('OFF-OLD') > -1,
      keptJIds.join(','));

    console.log('\n── B6: گارد تاریخ‌نگاری سنگ‌قبر (تثبیت قرارداد) ──');
    var tombNow = JSON.stringify([T1_ROW('DEAL-9')]);
    var rowWithDate = JSON.stringify([{ cd: 'DEAL-9', inqNo: 'X', createdAt: '2026-09-21T09:00:00Z', st: 'open' }]);
    var rowNoDate = JSON.stringify([{ cd: 'DEAL-9', inqNo: 'X', t: '1405/06/30', st: 'open' }]);
    test('B6a: رکورد با تاریخ ساخت ISO تازه‌تر از سنگ‌قبر، نجات می‌یابد',
      JSON.parse(portApplyTombstones('ptf_crm_deals', rowWithDate, tombNow, '[]')).length === 1);
    test('B6b: رکورد بدون هیچ تاریخ ساخت قابل‌خواندن همچنان بازنده است — لزوم R1',
      JSON.parse(portApplyTombstones('ptf_crm_deals', rowNoDate, tombNow, '[]')).length === 0);

    console.log('\n── پین‌های انتشار ──');
    test('P1: نسخهٔ انتشار v34.39.40 است', version === 'v34.39.40', version);
    test('P2: Service Worker / index.html بامپ شده‌اند',
      sw.indexOf('v34.39.40') > -1 && indexHtml.indexOf("PTF_CRM_RELEASE = 'v34.39.40'") > -1);
    test('P3: تستر در گیت CI ثبت است', gate.indexOf('tester674-v34.39.20-restore-tombstone-rekill.js') > -1);
    test('P4: پین tester621 به نسخهٔ جدید به‌روز شده', tester621Src.indexOf("'v34.39.40'") > -1 && tester621Src.indexOf('v34.39.40') > -1);

    console.log('');
    if (failures) { console.log('=== tester674: ' + failures + ' FAIL ==='); process.exit(1); }
    console.log('PASS tester674-v34.39.40-restore-tombstone-rekill');
  }, 30);
}, 30);
