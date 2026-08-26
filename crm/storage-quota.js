/* =====================================================================
   PTF CRM — storage-quota.js — v31.7.52 (STORAGE-IDB-MODULE-PRIMARY-001)
   High-priority localStorage safety layer:
   - Measures localStorage usage with a conservative 5MB soft limit.
   - Lists largest keys so admins know what is consuming space.
   - Wraps localStorage.setItem fail-safe: emergency compact + visible warning.
   - Adds IndexedDB helper for bulky emergency snapshots/backups.
   - Archives and compacts volatile/cache keys into IndexedDB before trimming localStorage.
   - Does not delete business records automatically.
   ===================================================================== */
(function () {
  'use strict';
  if (window.__ptfStorageQuotaLoaded) return;
  window.__ptfStorageQuotaLoaded = true;

  var LOCALSTORAGE_SOFT_LIMIT = 5 * 1024 * 1024;
  var DB_NAME = 'ptf-crm-storage-v1';
  var DB_STORE = 'kv';
  var WARN_KEY = 'ptf_storage_quota_last_warning';
  var nativeSetItem = null;
  var nativeGetItem = null;
  var nativeRemoveItem = null;
  var nativeKey = null;
  var nativeClear = null;
  var lastEstimate = null;
  var failedWrites = [];

  try {
    var proto = Object.getPrototypeOf(localStorage);
    nativeSetItem = proto && proto.setItem ? proto.setItem : localStorage.setItem;
    nativeGetItem = proto && proto.getItem ? proto.getItem : localStorage.getItem;
    nativeRemoveItem = proto && proto.removeItem ? proto.removeItem : localStorage.removeItem;
    nativeKey = proto && proto.key ? proto.key : localStorage.key;
    nativeClear = proto && proto.clear ? proto.clear : localStorage.clear;
  } catch (e0) {}

  function callGet(k) { return nativeGetItem.call(localStorage, String(k)); }
  function callSet(k, v) { return nativeSetItem.call(localStorage, String(k), String(v)); }
  function callRemove(k) { return nativeRemoveItem.call(localStorage, String(k)); }
  function nowIso() { return new Date().toISOString(); }
  function isQuotaError(e) {
    return !!e && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22 || e.code === 1014 || /quota/i.test(String(e && (e.message || e))));
  }
  function byteLen(s) {
    s = String(s == null ? '' : s);
    try { if (window.TextEncoder) return new TextEncoder().encode(s).length; } catch (e) {}
    try { return new Blob([s]).size; } catch (e2) {}
    return s.length * 2;
  }
  function parseJson(s, fallback) { try { return JSON.parse(s); } catch (e) { return fallback; } }
  function formatBytes(n) {
    n = Math.max(0, Number(n) || 0);
    if (n >= 1024 * 1024) return (n / 1024 / 1024).toFixed(2) + ' MB';
    if (n >= 1024) return Math.round(n / 1024) + ' KB';
    return n + ' B';
  }
  function listKeys() {
    var out = [];
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = nativeKey.call(localStorage, i);
        if (k != null) out.push(String(k));
      }
    } catch (e) {}
    return out;
  }
  function keySize(k) {
    var v = '';
    try { v = callGet(k) || ''; } catch (e) {}
    return byteLen(k) + byteLen(v);
  }
  function usage() {
    var keys = listKeys();
    var rows = keys.map(function (k) { return { key: k, bytes: keySize(k) }; });
    var used = rows.reduce(function (a, r) { return a + r.bytes; }, 0);
    rows.sort(function (a, b) { return b.bytes - a.bytes; });
    return {
      used: used,
      softLimit: LOCALSTORAGE_SOFT_LIMIT,
      percent: Math.min(100, Math.round(used * 100 / LOCALSTORAGE_SOFT_LIMIT)),
      keysCount: keys.length,
      topKeys: rows.slice(0, 12),
      allKeys: rows
    };
  }
  function healthSync() {
    var u = usage();
    var level = u.percent >= 95 ? 'critical' : (u.percent >= 85 ? 'danger' : (u.percent >= 70 ? 'warning' : 'ok'));
    return {
      used: u.used,
      softLimit: u.softLimit,
      percent: u.percent,
      level: level,
      keysCount: u.keysCount,
      topKeys: u.topKeys,
      estimate: lastEstimate,
      note: 'localStorage is browser-limited; PTF uses server backup and IndexedDB helpers for heavy emergency data.'
    };
  }

  function showBanner(title, msg, level) {
    try {
      var id = 'ptfStorageQuotaBanner';
      var old = document.getElementById(id);
      if (old) old.remove();
      var color = level === 'critical' ? '#991b1b' : '#b45309';
      var bg = level === 'critical' ? '#fef2f2' : '#fffbeb';
      var div = document.createElement('div');
      div.id = id;
      div.setAttribute('role', 'alert');
      div.style.cssText = 'position:fixed;left:18px;bottom:18px;z-index:999999;max-width:430px;background:' + bg + ';color:#172033;border:1px solid ' + color + ';border-radius:16px;box-shadow:0 16px 50px rgba(15,23,42,.22);padding:12px 14px;font-family:Tahoma,Arial,sans-serif;direction:rtl;text-align:right;line-height:1.8;font-size:12.5px';
      div.innerHTML = '<b style="display:block;color:' + color + ';margin-bottom:4px">' + escapeHtml(title) + '</b>' +
        '<div>' + escapeHtml(msg) + '</div>' +
        '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px"><button type="button" onclick="if(window.goPanelByName)goPanelByName(\'set\');var x=document.getElementById(\'ptfStorageQuotaBanner\');if(x)x.remove();" style="border:0;border-radius:10px;background:#172033;color:#fff;padding:6px 10px;font-weight:800;cursor:pointer">رفتن به تنظیمات</button><button type="button" onclick="var x=document.getElementById(\'ptfStorageQuotaBanner\');if(x)x.remove();" style="border:1px solid #cbd5e1;border-radius:10px;background:#fff;color:#334155;padding:6px 10px;font-weight:800;cursor:pointer">بستن</button></div>';
      document.body.appendChild(div);
      setTimeout(function () { try { var x = document.getElementById(id); if (x) x.remove(); } catch (e) {} }, 18000);
    } catch (e2) {}
  }
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function warnOnce(title, msg, level) {
    try {
      var today = new Date().toISOString().slice(0, 10);
      var tag = today + '|' + title;
      if (callGet(WARN_KEY) !== tag) {
        try { callSet(WARN_KEY, tag); } catch (e) {}
        showBanner(title, msg, level);
        try { if (typeof notify === 'function') notify({ toRoles: ['admin', 'chairman'], title: title + ' — ' + msg, kind: 'data_risk', channels: ['cart'], link: { panel: 'set' }, actionable: true, dkey: 'quota-' + title }); } catch (eN) {}
      }
    } catch (eW) { showBanner(title, msg, level); }
  }

  function compactArrayKey(k, limit, fromEnd) {
    var before = 0, after = 0, changed = false;
    try {
      var raw = callGet(k);
      if (!raw) return 0;
      before = byteLen(raw);
      var arr = parseJson(raw, null);
      if (!Array.isArray(arr) || arr.length <= limit) return 0;
      arr = fromEnd ? arr.slice(-limit) : arr.slice(0, limit);
      var next = JSON.stringify(arr);
      callSet(k, next);
      after = byteLen(next);
      changed = true;
    } catch (e) {}
    return changed ? Math.max(0, before - after) : 0;
  }
  function compactDraftForms() {
    var freed = 0;
    try {
      var raw = callGet('ptf_draft_forms');
      if (!raw) return 0;
      var before = byteLen(raw);
      var d = parseJson(raw, {});
      var keys = Object.keys(d || {}).sort(function (a, b) { return ((d[b] || {}).ts || 0) - ((d[a] || {}).ts || 0); });
      var out = {};
      keys.slice(0, 10).forEach(function (k) { out[k] = d[k]; });
      var next = JSON.stringify(out);
      if (byteLen(next) < before) { callSet('ptf_draft_forms', next); freed += before - byteLen(next); }
    } catch (e) {}
    return freed;
  }
  function compactNotifs() {
    var freed = 0;
    try {
      var raw = callGet('ptf_crm_notifs');
      if (!raw) return 0;
      var before = byteLen(raw);
      var arr = parseJson(raw, []);
      if (!Array.isArray(arr) || arr.length <= 180) return 0;
      var kept = [];
      for (var i = 0; i < arr.length; i++) {
        var n = arr[i] || {};
        var read = Array.isArray(n.readBy) && n.readBy.length > 0;
        if (i < 120 || !read) kept.push(n);
      }
      if (kept.length > 260) kept = kept.slice(0, 260);
      var next = JSON.stringify(kept);
      if (byteLen(next) < before) { callSet('ptf_crm_notifs', next); freed += before - byteLen(next); }
    } catch (e) {}
    return freed;
  }
  function compactSendQueue() {
    var freed = 0;
    try {
      var raw = callGet('ptf_crm_sendqueue');
      if (!raw) return 0;
      var before = byteLen(raw);
      var arr = parseJson(raw, []);
      if (!Array.isArray(arr)) return 0;
      var kept = arr.filter(function (x) { return !(x && x.st === 'sent'); });
      var next = JSON.stringify(kept);
      if (byteLen(next) < before) { callSet('ptf_crm_sendqueue', next); freed += before - byteLen(next); }
    } catch (e) {}
    return freed;
  }
  function compactAiCaches() {
    var freed = 0;
    listKeys().forEach(function (k) {
      if (/^ptf_ai_cache/.test(k)) {
        try { var v = callGet(k) || ''; callRemove(k); freed += byteLen(k) + byteLen(v); } catch (e) {}
      } else if (/^ptf_ai_hist_/.test(k)) {
        freed += compactArrayKey(k, 6, false);
      }
    });
    return freed;
  }
  function emergencyCompact(opts) {
    var before = usage().used;
    var freed = 0;
    freed += compactNotifs();
    freed += compactSendQueue();
    freed += compactArrayKey('ptf_crm_audit', 1000, false);
    freed += compactArrayKey('ptf_web_events_v2', 150, true);
    freed += compactArrayKey('ptf_chat_history', 40, true);
    freed += compactDraftForms();
    freed += compactAiCaches();
    var after = usage().used;
    var actual = Math.max(freed, before - after);
    if (opts && opts.toast) showBanner('پاک‌سازی امن حافظه انجام شد', 'حدود ' + formatBytes(actual) + ' از داده‌های موقت/خوانده‌شده/کش آزاد شد. رکوردهای اصلی کسب‌وکاری حذف نشدند.', 'warning');
    try { if (typeof audit === 'function' && actual > 0) audit('سیستم', 'پاک‌سازی امن حافظه محلی — آزادسازی حدود ' + formatBytes(actual), ''); } catch (eA) {}
    return { ok: true, freed: actual, before: before, after: after, health: healthSync() };
  }

  function dbOpen(cb) {
    try {
      if (!window.indexedDB) return cb && cb(null);
      var req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE, { keyPath: 'id' });
      };
      req.onsuccess = function () { cb && cb(req.result); };
      req.onerror = function () { cb && cb(null); };
    } catch (e) { cb && cb(null); }
  }
  function idbSet(id, value, cb) {
    var bytes = byteLen(value);
    dbOpen(function (db) {
      if (!db) { cb && cb(false); return; }
      try {
        var tx = db.transaction(DB_STORE, 'readwrite');
        tx.objectStore(DB_STORE).put({ id: String(id), value: String(value), bytes: bytes, updatedAt: nowIso() });
        tx.oncomplete = function () { try { db.close(); } catch (e) {} cb && cb(true, bytes); };
        tx.onerror = function () { try { db.close(); } catch (e2) {} cb && cb(false); };
      } catch (e3) { try { db.close(); } catch (e4) {} cb && cb(false); }
    });
  }
  function idbGet(id, cb) {
    dbOpen(function (db) {
      if (!db) { cb && cb(null); return; }
      try {
        var tx = db.transaction(DB_STORE, 'readonly');
        var req = tx.objectStore(DB_STORE).get(String(id));
        req.onsuccess = function () { cb && cb(req.result || null); try { db.close(); } catch (e) {} };
        req.onerror = function () { cb && cb(null); try { db.close(); } catch (e2) {} };
      } catch (e3) { cb && cb(null); try { db.close(); } catch (e4) {} }
    });
  }


  function archiveIndex() {
    var idx = parseJson(callGet('ptf_storage_archive_index') || '[]', []);
    return Array.isArray(idx) ? idx : [];
  }
  function noteArchive(sourceKey, id, bytes) {
    try {
      var idx = archiveIndex().filter(function (x) { return x && x.sourceKey !== sourceKey; });
      idx.unshift({ sourceKey: sourceKey, id: id, bytes: bytes || 0, at: nowIso() });
      callSet('ptf_storage_archive_index', JSON.stringify(idx.slice(0, 40)));
    } catch (e) {}
  }
  function archiveIdForKey(k) { return 'archive:' + String(k) + ':latest'; }
  function archiveKeyToIdb(k, raw, cb) {
    if (!raw) { cb && cb(false, 0, ''); return; }
    var id = archiveIdForKey(k);
    idbSet(id, raw, function (ok, bytes) {
      if (ok) noteArchive(k, id, bytes);
      cb && cb(!!ok, bytes || 0, id);
    });
  }
  function isVolatileArchiveCandidate(k) {
    /* v33.14.0: ptf_crm_avatars و ptf_storage_queue هم اضافه شدند — این دو معمولاً
       بزرگ‌ترین کلیدهای غیرحیاتی هستند (عکس‌های base64 و صف فایل‌های آپلود). */
    return /^(ptf_web_events_v2|ptf_chat_history|ptf_draft_forms|ptf_crm_notifs|ptf_crm_sendqueue|ptf_crm_audit|ptf_backup_local|ptf_backup_prerestore|ptf_crm_avatars|ptf_storage_queue)$/.test(k) || /^ptf_ai_hist_/.test(k) || /^ptf_ai_cache/.test(k);
  }
  /* v33.14.0 — هرس‌های تکمیلی برای «پاک‌سازی امن مؤثر» (ریشه: پاک‌سازی قبلی فقط
     کلیدهای حاشیه را هدف می‌گرفت و وقتی دادهٔ اصلی/عکس‌ها بزرگ‌اند، آزادسازی ناچیز بود):
       - avatars: فقط ۲۰ آواتار آخر (بقیه → آرشیو IDB و حذف از localStorage)
       - storage_queue: اقلام انجام‌شده/قدیمی‌تر از ۷ روز حذف
       - audit: قدیمی‌تر از ۱۸۰ روز حذف (علاوه بر سقف ۱۰۰۰)
       - notifs: خوانده‌شدهٔ قدیمی‌تر از ۹۰ روز حذف (علاوه بر سقف ۲۲۰)
       - sendqueue: sent قدیمی‌تر از ۳۰ روز حذف */
  function compactAvatars() {
    var k = 'ptf_crm_avatars', raw = callGet(k);
    if (!raw) return 0;
    var before = byteLen(raw);
    try {
      var obj = parseJson(raw, {});
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return 0;
      /* سورت صعودی بر اساس زمان — جدیدترین‌ها آخر آرایه → slice(-20) = ۲۰ آواتار آخر */
      var keys = Object.keys(obj).sort(function (a, b) { return ((obj[a] || {}).t || 0) - ((obj[b] || {}).t || 0); });
      if (keys.length <= 20) return 0;
      var kept = {};
      keys.slice(-20).forEach(function (x) { kept[x] = obj[x]; });
      /* آرشیو کامل به IDB (بازیابی در صورت نیاز) سپس نگهداشتن فقط ۲۰ آخر */
      var full = raw;
      var id = archiveIdForKey(k + ':full');
      idbSet(id, full, function (ok) { if (ok) noteArchive(k + ':full', id, before); });
      callSet(k, JSON.stringify(kept));
      return Math.max(0, before - byteLen(JSON.stringify(kept)));
    } catch (e) { return 0; }
  }
  function compactStorageQueue() {
    var k = 'ptf_storage_queue', raw = callGet(k);
    if (!raw) return 0;
    var before = byteLen(raw);
    try {
      var arr = parseJson(raw, []);
      if (!Array.isArray(arr) || !arr.length) return 0;
      var cutoff = Date.now() - 7 * 86400000;
      var next = arr.filter(function (x) {
        if (!x) return false;
        if (x.st === 'done' || x.st === 'uploaded' || x.st === 'failed') return false; /* انجام‌شده → حذف */
        var t = +x.ts || +x.t || 0;
        return !t || t > cutoff;
      });
      if (next.length === arr.length) return 0;
      callSet(k, JSON.stringify(next));
      return Math.max(0, before - byteLen(JSON.stringify(next)));
    } catch (e) { return 0; }
  }
  function compactAuditByAge() {
    /* سقف ۱۰۰۰ حفظ شد (سازگار با tester227) + هرس سنی ۱۸۰ روز اضافه شد */
    return compactArrayKeyAge('ptf_crm_audit', 1000, false, 180 * 86400000);
  }
  function compactNotifsByAge() {
    var k = 'ptf_crm_notifs', raw = callGet(k);
    if (!raw) return 0;
    var before = byteLen(raw);
    try {
      var arr = parseJson(raw, []);
      if (!Array.isArray(arr)) return 0;
      var cutoff = Date.now() - 90 * 86400000;
      var kept = arr.filter(function (n) {
        if (!n) return false;
        var read = Array.isArray(n.readBy) && n.readBy.length > 0;
        if (!read) return true;
        var t = +n.ts || +n.t || (n.iso ? new Date(n.iso).getTime() : 0);
        return !t || t > cutoff;
      });
      if (kept.length > 220) kept = kept.slice(0, 220);
      if (kept.length === arr.length) return 0;
      callSet(k, JSON.stringify(kept));
      return Math.max(0, before - byteLen(JSON.stringify(kept)));
    } catch (e) { return 0; }
  }
  function compactSendQueueByAge() {
    var k = 'ptf_crm_sendqueue', raw = callGet(k);
    if (!raw) return 0;
    var before = byteLen(raw);
    try {
      var arr = parseJson(raw, []);
      if (!Array.isArray(arr)) return 0;
      var cutoff = Date.now() - 30 * 86400000;
      var kept = arr.filter(function (x) {
        if (!x || x.st !== 'sent') return true;
        var t = +x.ts || +x.t || (x.iso ? new Date(x.iso).getTime() : 0);
        return !t || t > cutoff;
      });
      if (kept.length === arr.length) return 0;
      callSet(k, JSON.stringify(kept));
      return Math.max(0, before - byteLen(JSON.stringify(kept)));
    } catch (e) { return 0; }
  }
  /* compactArrayKey با پارامتر سن (maxAgeMs) */
  function compactArrayKeyAge(k, max, remove, maxAgeMs) {
    var raw = callGet(k);
    if (!raw) return 0;
    var before = byteLen(raw);
    try {
      var arr = parseJson(raw, []);
      if (!Array.isArray(arr)) return 0;
      var next = arr;
      if (maxAgeMs) {
        var cutoff = Date.now() - maxAgeMs;
        next = next.filter(function (x) {
          if (!x) return true;
          var t = +x.ts || +x.t || (x.iso ? new Date(x.iso).getTime() : 0);
          return !t || t > cutoff;
        });
      }
      if (next.length > max) next = next.slice(0, max);
      if (remove) callRemove(k);
      else if (byteLen(JSON.stringify(next)) < before) callSet(k, JSON.stringify(next));
      else return 0;
      return Math.max(0, before - (remove ? 0 : byteLen(JSON.stringify(next))));
    } catch (e) { return 0; }
  }

  function emergencyCompact(opts) {
    var before = usage().used;
    var freed = 0;
    freed += compactNotifs();
    freed += compactSendQueue();
    freed += compactArrayKey('ptf_crm_audit', 1000, false);
    freed += compactArrayKey('ptf_web_events_v2', 150, true);
    freed += compactArrayKey('ptf_chat_history', 40, true);
    freed += compactDraftForms();
    freed += compactAiCaches();
    /* v33.14.0: هرس‌های تکمیلی — بزرگ‌ترین کلیدهای غیرحیاتی */
    freed += compactAvatars();
    freed += compactStorageQueue();
    freed += compactAuditByAge();
    freed += compactNotifsByAge();
    freed += compactSendQueueByAge();
    var after = usage().used;
    var actual = Math.max(freed, before - after);
    if (opts && opts.toast) showBanner('پاک‌سازی امن حافظه انجام شد', 'حدود ' + formatBytes(actual) + ' آزاد شد (شامل آواتارهای قدیمی، صف فایل‌ها، لاگ/اعلان‌های کهنه). رکوردهای اصلی کسب‌وکاری حذف نشدند.', 'warning');
    try { if (typeof audit === 'function' && actual > 0) audit('سیستم', 'پاک‌سازی امن حافظه محلی — آزادسازی حدود ' + formatBytes(actual), ''); } catch (eA) {}
    return { ok: true, freed: actual, before: before, after: after, health: healthSync() };
  }
  function compactCandidateAfterArchive(k, raw, archiveId) {
    var before = byteLen(raw);
    var next = raw;
    var remove = false;
    try {
      if (/^ptf_ai_cache/.test(k)) {
        remove = true;
      } else if (/^(ptf_backup_local|ptf_backup_prerestore)$/.test(k)) {
        var current = parseJson(raw, null);
        if (current && current.storedIn === 'indexedDB') return 0;
        next = JSON.stringify({ storedIn: 'indexedDB', db: DB_NAME, key: archiveId, sourceKey: k, bytes: before, updatedAt: nowIso() });
      } else if (k === 'ptf_draft_forms') {
        var d = parseJson(raw, {});
        var dKeys = Object.keys(d || {}).sort(function (a, b) { return ((d[b] || {}).ts || 0) - ((d[a] || {}).ts || 0); });
        var out = {};
        dKeys.slice(0, 8).forEach(function (dk) { out[dk] = d[dk]; });
        next = JSON.stringify(out);
      } else {
        var arr = parseJson(raw, null);
        if (!Array.isArray(arr)) return 0;
        if (k === 'ptf_web_events_v2') next = JSON.stringify(arr.slice(-100));
        else if (k === 'ptf_chat_history') next = JSON.stringify(arr.slice(-30));
        else if (/^ptf_ai_hist_/.test(k)) next = JSON.stringify(arr.slice(0, 4));
        else if (k === 'ptf_crm_audit') next = JSON.stringify(arr.slice(0, 900));
        else if (k === 'ptf_crm_sendqueue') next = JSON.stringify(arr.filter(function (x) { return !(x && x.st === 'sent'); }));
        else if (k === 'ptf_crm_notifs') {
          var kept = [];
          for (var i = 0; i < arr.length; i++) {
            var n = arr[i] || {};
            var read = Array.isArray(n.readBy) && n.readBy.length > 0;
            if (i < 100 || !read) kept.push(n);
          }
          if (kept.length > 220) kept = kept.slice(0, 220);
          next = JSON.stringify(kept);
        }
      }
      if (remove) callRemove(k);
      else if (byteLen(next) < before) callSet(k, next);
      else return 0;
      return Math.max(0, before - (remove ? 0 : byteLen(next)));
    } catch (e) { return 0; }
  }
  function migrateVolatileToIdb(opts, cb) {
    opts = opts || {};
    var before = usage().used;
    if (!window.indexedDB) {
      var fallback = opts.fallbackCompact ? emergencyCompact({ source: 'migration-no-idb' }) : { ok: false, freed: 0, before: before, after: before, health: healthSync(), error: 'indexeddb_unavailable' };
      cb && cb(fallback);
      return fallback;
    }
    var candidates = listKeys().filter(isVolatileArchiveCandidate).map(function (k) { return { key: k, bytes: keySize(k) }; }).filter(function (r) { return r.bytes > 1024; });
    candidates.sort(function (a, b) { return b.bytes - a.bytes; });
    var archivedBytes = 0, freed = 0, touched = [], failed = [];
    function finish() {
      var after = usage().used;
      var res = { ok: true, archivedBytes: archivedBytes, freed: Math.max(freed, before - after), before: before, after: after, keys: touched, failed: failed, health: healthSync() };
      try { callSet('ptf_storage_last_idb_migration', JSON.stringify({ at: nowIso(), archivedBytes: res.archivedBytes, freed: res.freed, keys: touched.length, failed: failed.length })); } catch (eM) {}
      if (opts.toast) showBanner('مهاجرت امن به IndexedDB انجام شد', 'حدود ' + formatBytes(res.archivedBytes) + ' آرشیو و حدود ' + formatBytes(res.freed) + ' از localStorage آزاد شد. رکوردهای اصلی کسب‌وکاری حذف نشدند.', 'warning');
      try { if (typeof audit === 'function') audit('سیستم', 'مهاجرت امن cache/draft به IndexedDB — آرشیو ' + formatBytes(res.archivedBytes) + '، آزادسازی ' + formatBytes(res.freed), ''); } catch (eA) {}
      cb && cb(res);
    }
    function step(i) {
      if (i >= candidates.length) return finish();
      var k = candidates[i].key;
      var raw = '';
      try { raw = callGet(k) || ''; } catch (eR) {}
      if (!raw) return step(i + 1);
      archiveKeyToIdb(k, raw, function (ok, bytes, id) {
        if (ok) {
          archivedBytes += bytes || byteLen(raw);
          var f = compactCandidateAfterArchive(k, raw, id);
          if (f > 0) { freed += f; touched.push({ key: k, archivedBytes: bytes || byteLen(raw), freed: f }); }
        } else failed.push(k);
        step(i + 1);
      });
    }
    step(0);
    return { ok: true, pending: true, candidates: candidates.length, before: before };
  }
  function showArchiveIndex() {
    var idx = archiveIndex();
    if (!idx.length) { alert('هنوز آرشیوی در IndexedDB ثبت نشده است.'); return; }
    alert('آخرین آرشیوهای IndexedDB:\n\n' + idx.slice(0, 15).map(function (x, i) { return (i + 1) + '. ' + x.sourceKey + ' — ' + formatBytes(x.bytes) + ' — ' + (x.at || ''); }).join('\n'));
  }

  function handleFailedBulkyKey(k, v) {
    if (!/^(ptf_backup_local|ptf_backup_prerestore)$/.test(k)) return false;
    idbSet(k, v, function (ok, bytes) {
      if (ok) {
        try { callSet(k, JSON.stringify({ storedIn: 'indexedDB', db: DB_NAME, key: k, bytes: bytes, updatedAt: nowIso() })); } catch (e) {}
        showBanner('ذخیره حجیم به IndexedDB منتقل شد', 'کلید ' + k + ' به دلیل محدودیت localStorage به IndexedDB منتقل شد.', 'warning');
      }
    });
    return true;
  }

  function safeSetItem(k, v, opts) {
    k = String(k);
    v = String(v);
    try {
      callSet(k, v);
      try {
        var h = healthSync();
        if (h.percent >= 85 && !(opts && opts.noWarn)) {
          /* v34.8.9 (STORAGE-INDEPENDENCE): به‌جای هشدار منفعل، خودکار نجات:
             اگر فاز B فعال و هم‌گرا است، کلیدهای کسب‌وکارِ کش‌شده به IDB تخلیه
             می‌شوند و localStorage فوراً آزاد می‌شود. در غیر این صورت مسیر درست
             (همگرایی → فعال‌سازی خودکار) به کاربر گفته می‌شود. */
          try {
            if (typeof window.ptfBOffloadBusinessKeysToIdb === 'function') {
              var _off = window.ptfBOffloadBusinessKeysToIdb({ force: true });
              if (_off && _off.moved) { h = healthSync(); }
            }
          } catch (eOffload) {}
          warnOnce('هشدار ظرفیت حافظه محلی CRM', 'localStorage حدود ' + h.percent + '٪ پر است. ' + (
            (typeof window.ptfBOffloadBusinessKeysToIdb === 'function')
              ? 'تخلیهٔ خودکار به IndexedDB اجرا شد؛ اگر پیغام تکرار شد، از «تنظیمات → 🔄 هم‌گرایی دادهٔ محلی» یک‌بار هم‌گرایی کنید تا حالت سرور-محور فعال شود.'
              : 'از «تنظیمات → 🔄 هم‌گرایی دادهٔ محلی» هم‌گرایی کنید تا حالت سرور-محور فعال و حافظه آزاد شود.'
          ), h.level);
        }
      } catch (eH) {}
      return true;
    } catch (e) {
      if (!isQuotaError(e)) throw e;
      emergencyCompact({ source: 'quota' });
      try { callSet(k, v); return true; } catch (e2) {
        if (isQuotaError(e2) && handleFailedBulkyKey(k, v)) return true;
        var h2 = healthSync();
        failedWrites.unshift({ key: k, bytes: byteLen(v), at: nowIso(), error: String((e2 && e2.message) || e2 || e) });
        failedWrites = failedWrites.slice(0, 20);
        warnOnce('ذخیره در حافظه محلی انجام نشد', 'ظرفیت localStorage پر است؛ کلید ' + k + ' با اندازه ' + formatBytes(byteLen(v)) + ' ذخیره نشد. لطفاً فوراً بک‌آپ/پاک‌سازی امن را اجرا کنید.', 'critical');
        return false;
      }
    }
  }

  function installSetItemGuard() {
    try {
      var proto = Object.getPrototypeOf(localStorage);
      if (!proto || proto.__ptfSafeSetItemInstalled) return false;
      var wrapped = function (k, v) { return safeSetItem(k, v); };
      Object.defineProperty(proto, 'setItem', { value: wrapped, configurable: true, writable: true });
      proto.__ptfSafeSetItemInstalled = true;
      return true;
    } catch (e) { return false; }
  }

  function refreshEstimate(cb) {
    try {
      if (navigator.storage && navigator.storage.estimate) {
        navigator.storage.estimate().then(function (e) {
          lastEstimate = e || null;
          cb && cb(lastEstimate);
        }).catch(function () { cb && cb(null); });
      } else cb && cb(null);
    } catch (e) { cb && cb(null); }
  }
  function requestPersistent(silent) {
    try {
      if (!(navigator.storage && navigator.storage.persist)) {
        if (!silent) alert('مرورگر این قابلیت را پشتیبانی نمی‌کند. برای داده‌های حجیم، بک‌آپ سرور و IndexedDB همچنان استفاده می‌شود.');
        return;
      }
      navigator.storage.persist().then(function (ok) {
        try { callSet('ptf_storage_persist_result', JSON.stringify({ ok: !!ok, at: nowIso() })); } catch (eS) {}
        if (!silent) alert(ok ? 'درخواست Persistent Storage تایید شد. این مورد localStorage را بزرگ‌تر نمی‌کند، اما احتمال پاک‌شدن cache/IndexedDB توسط مرورگر را کمتر می‌کند.' : 'مرورگر درخواست Persistent Storage را تایید نکرد.');
      }).catch(function () {});
    } catch (e) {}
  }
  /* کاربران عادی نباید برای کاهش ریسک پاک‌سازی browser storage وارد تنظیمات شوند.
     درخواست فقط یک hint به مرورگر است، داده‌ای حذف نمی‌کند و ردشدنش نیز هیچ اثر مخربی ندارد. */
  function requestPersistentAuto() {
    try {
      var prev = parseJson(callGet('ptf_storage_persist_result') || '{}', {});
      if (prev && prev.at && (Date.now() - new Date(prev.at).getTime()) < 30 * 864e5) return;
      requestPersistent(true);
    } catch (e) {}
  }
  function topKeys(n) { return usage().topKeys.slice(0, n || 10); }
  function showLargeKeys() {
    var rows = topKeys(12).map(function (r, i) { return (i + 1) + '. ' + r.key + ' — ' + formatBytes(r.bytes); }).join('\n');
    alert('بزرگ‌ترین کلیدهای localStorage:\n\n' + rows + '\n\nاین فهرست برای تصمیم پاک‌سازی/مهاجرت به IndexedDB است. رکوردهای اصلی را دستی حذف نکنید.');
  }

  /* v33.15.0 (فاز ۱ — خودکارسازی): اگر حافظه از ۸۰٪ بالاتر بود، یک‌بار در روز
     فشرده‌سازی امن (avatars/queue/هرس سنی) خودکار اجرا می‌شود — بدون حذف دادهٔ اصلی. */
  window.ptfStorageAutoTame = function () {
    try {
      var h = healthSync();
      if (h.percent < 80) return { ok: true, skipped: 'below80', percent: h.percent };
      var res = emergencyCompact({ source: 'auto-daily' });
      return { ok: true, freed: res.freed, percent: healthSync().percent };
    } catch (e) { return { ok: false, error: String(e) }; }
  };
  try {
    var _tameDate = '';
    try { _tameDate = callGet('ptf_storage_auto_tame') || ''; } catch (eT) {}
    var _todayIso = new Date().toISOString().slice(0, 10);
    if (_tameDate !== _todayIso) {
      setTimeout(function () {
        try {
          var hh = healthSync();
          if (hh.percent >= 80) {
            emergencyCompact({ source: 'auto-daily' });
            try { callSet('ptf_storage_auto_tame', new Date().toISOString().slice(0, 10)); } catch (eS) {}
          }
        } catch (eA) {}
      }, 8000);
    }
  } catch (eBoot) {}

  window.ptfStorageQuotaVersion = 'v31.7.52-STORAGE-IDB-MODULE-PRIMARY-001';
  window.ptfStorageLocalUsage = usage;
  window.ptfStorageHealthSync = healthSync;
  window.ptfStorageFormatBytes = formatBytes;
  window.ptfStorageTopKeys = topKeys;
  window.ptfStorageSafeSetItem = safeSetItem;
  window.ptfStorageEmergencyCompact = emergencyCompact;
  window.ptfStorageMigrateVolatileToIdb = migrateVolatileToIdb;
  window.ptfStorageArchiveIndex = archiveIndex;
  window.ptfStorageShowArchiveIndex = showArchiveIndex;
  window.ptfStorageRequestPersistent = requestPersistent;
  window.ptfStorageRequestPersistentAuto = requestPersistentAuto;
  window.ptfStorageShowLargeKeys = showLargeKeys;
  window.ptfStorageRefreshEstimate = refreshEstimate;
  window.ptfStorageIdbSet = idbSet;
  window.ptfStorageIdbGet = idbGet;
  window.ptfStorageFailedWrites = function () { return failedWrites.slice(); };
  window.PTF_LOCALSTORAGE_SOFT_LIMIT = LOCALSTORAGE_SOFT_LIMIT;

  installSetItemGuard();
  refreshEstimate();
})();
