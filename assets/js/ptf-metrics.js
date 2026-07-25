/* =====================================================================
   PTF Web Metrics — v31.7.94 (PRIVACY-METRICS-SERVER-SYNC-001)
   Privacy-first conversion instrumentation for public B2B website.
   - Privacy-aware aggregate server sync is enabled for sanitized event/path counters.
   - No PII is sent to server: no sid, no title, no label, no href, no query string.
   - Pushes to window.dataLayer if a real analytics tool is added later.
   - Full local QA queue is stored in IndexedDB; localStorage keeps a lightweight summary.
   ===================================================================== */
(function () {
  'use strict';
  if (window.__ptfMetricsLoaded) return;
  window.__ptfMetricsLoaded = true;

  var STORE = 'ptf_web_events_v2';
  var SID = 'ptf_web_sid';
  var DB_NAME = 'ptf-public-cache-v1';
  var DB_STORE = 'kv';
  var IDB_KEY = STORE + ':idb-full';
  var MAX_IDB = 1000;
  var MAX_LOCAL = 80;
  var metricSeq = 0;
  var memEvents = loadLocalEvents();
  var METRICS_API = (function () { try { return new URL('/api/tools.php', location.origin).href; } catch (e) { return '../api/tools.php'; } })();
  var SYNC_BATCH_MAX = 20;
  var SYNC_DELAY = 2500;
  var syncQueue = [];
  var syncTimer = null;

  function safeText(s, max) {
    return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, max || 90);
  }
  function pathOnly(href) {
    try {
      var u = new URL(href, location.href);
      if (u.origin === location.origin) return u.pathname + (u.search || '');
      return u.hostname;
    } catch (e) { return String(href || '').slice(0, 120); }
  }
  function sessionId() {
    try {
      var s = localStorage.getItem(SID);
      if (!s) {
        var rnd = Math.random().toString(36).slice(2, 9);
        s = 'ws-' + Date.now().toString(36) + '-' + rnd;
        localStorage.setItem(SID, s);
      }
      return s;
    } catch (e) { return 'ws-memory'; }
  }
  function utmData() {
    var out = {};
    try {
      var q = new URLSearchParams(location.search || '');
      ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach(function (k) {
        if (q.get(k)) out[k] = safeText(q.get(k), 80);
      });
    } catch (e) {}
    return out;
  }

  function metricPathBucket(path) {
    path = String(path || '/').replace(/[?#].*$/, '');
    if (!path || path.charAt(0) !== '/') return '/external';
    path = path.replace(/\/+/g, '/');
    return path.slice(0, 140);
  }
  function syncAllowedEvent(ev) {
    return /^(page_view|cta_|tools_|advanced_cv_|advanced_tools_|content_click|phone_click|email_click|whatsapp_click|assistant_cta_click|contact_cta_click|supplier_cta_click|tracking_cta_click|rfq_|form_submit_attempt|button_click)/.test(String(ev || ''));
  }
  function sanitizeForServer(rec) {
    if (!rec || !syncAllowedEvent(rec.event)) return null;
    return {
      event: safeText(rec.event, 60).replace(/[^a-zA-Z0-9_:-]/g, '_'),
      path: metricPathBucket(rec.path || '/'),
      t: rec.t || new Date().toISOString(),
      utm_source: safeText(rec.utm_source || '', 60).replace(/[^a-zA-Z0-9_.:-]/g, '_')
    };
  }
  function flushMetricsSync() {
    if (syncTimer && typeof clearTimeout === 'function') { clearTimeout(syncTimer); syncTimer = null; }
    if (!syncQueue.length || !window.fetch) return;
    var batch = syncQueue.splice(0, SYNC_BATCH_MAX);
    try {
      fetch(METRICS_API + '?action=metrics_ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: batch, schema: 'PTF-METRICS-AGG-v1' }),
        cache: 'no-store',
        keepalive: true
      }).catch(function () {});
    } catch (e) {}
    if (syncQueue.length) syncTimer = setTimeout(flushMetricsSync, SYNC_DELAY);
  }
  function queueMetricsSync(rec) {
    var s = sanitizeForServer(rec);
    if (!s) return;
    syncQueue.push(s);
    if (syncQueue.length >= SYNC_BATCH_MAX) flushMetricsSync();
    else if (!syncTimer) syncTimer = setTimeout(flushMetricsSync, SYNC_DELAY);
  }
  window.ptfMetricsFlush = flushMetricsSync;

  function idbOpen(cb) {
    try {
      if (!window.indexedDB) { cb(null); return; }
      var req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE, { keyPath: 'id' });
      };
      req.onsuccess = function () { cb(req.result); };
      req.onerror = function () { cb(null); };
    } catch (e) { cb(null); }
  }
  function idbSet(id, value) {
    idbOpen(function (db) {
      if (!db) return;
      try {
        var tx = db.transaction(DB_STORE, 'readwrite');
        tx.objectStore(DB_STORE).put({ id: String(id), value: String(value), updatedAt: new Date().toISOString() });
        tx.oncomplete = function () { try { db.close(); } catch (e) {} };
        tx.onerror = function () { try { db.close(); } catch (e2) {} };
      } catch (e3) { try { db.close(); } catch (e4) {} }
    });
  }
  function idbGet(id, cb) {
    idbOpen(function (db) {
      if (!db) { cb(null); return; }
      try {
        var tx = db.transaction(DB_STORE, 'readonly');
        var req = tx.objectStore(DB_STORE).get(String(id));
        req.onsuccess = function () { cb(req.result || null); try { db.close(); } catch (e) {} };
        req.onerror = function () { cb(null); try { db.close(); } catch (e2) {} };
      } catch (e3) { cb(null); try { db.close(); } catch (e4) {} }
    });
  }
  function idbDel(id) {
    idbOpen(function (db) {
      if (!db) return;
      try {
        var tx = db.transaction(DB_STORE, 'readwrite');
        tx.objectStore(DB_STORE).delete(String(id));
        tx.oncomplete = function () { try { db.close(); } catch (e) {} };
      } catch (e2) { try { db.close(); } catch (e3) {} }
    });
  }

  function loadLocalEvents() {
    try { var a = JSON.parse(localStorage.getItem(STORE) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; }
  }
  function eventKey(x) {
    return String((x && x.id) || '') || [x && x.t, x && x.event, x && x.path, x && x.href, x && x.label].join('|');
  }
  function mergeEvents(a, b) {
    var out = [], seen = {};
    (a || []).concat(b || []).forEach(function (x) {
      if (!x || typeof x !== 'object') return;
      var k = eventKey(x);
      if (seen[k]) return;
      seen[k] = true;
      out.push(x);
    });
    out.sort(function (x, y) { return String(x.t || '').localeCompare(String(y.t || '')); });
    return out.slice(-MAX_IDB);
  }
  function saveEvents(list) {
    memEvents = (list || []).slice(-MAX_IDB);
    try { localStorage.setItem(STORE, JSON.stringify(memEvents.slice(-MAX_LOCAL))); } catch (e) {}
    try { idbSet(IDB_KEY, JSON.stringify(memEvents)); } catch (e2) {}
  }
  function initFullQueue() {
    idbGet(IDB_KEY, function (rec) {
      try {
        if (rec && rec.value) {
          var full = JSON.parse(rec.value);
          if (Array.isArray(full)) saveEvents(mergeEvents(full, memEvents));
        } else if (memEvents.length) idbSet(IDB_KEY, JSON.stringify(memEvents));
      } catch (e) {}
    });
  }

  function track(ev, data) {
    ev = safeText(ev || 'event', 60).replace(/[^a-zA-Z0-9_:-]/g, '_');
    metricSeq += 1;
    var rec = Object.assign({
      id: 'MET-' + Date.now().toString(36) + '-' + metricSeq,
      event: ev,
      t: new Date().toISOString(),
      sid: sessionId(),
      path: location.pathname,
      title: safeText(document.title, 120)
    }, utmData(), data || {});
    try {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push(rec);
    } catch (e) {}
    memEvents.push(rec); saveEvents(memEvents);
    queueMetricsSync(rec);
    try { window.dispatchEvent(new CustomEvent('ptf:webmetric', { detail: rec })); } catch (e2) {}
    return rec;
  }
  window.ptfTrack = track;
  window.ptfMetricsEvents = function () { return memEvents.slice(); };
  window.ptfMetricsClear = function () { try { memEvents = []; localStorage.removeItem(STORE); idbDel(IDB_KEY); } catch (e) {} };
  window.ptfMetricsSummary = function () {
    var list = memEvents.slice(), byEvent = {}, byPath = {};
    list.forEach(function (x) {
      byEvent[x.event] = (byEvent[x.event] || 0) + 1;
      byPath[x.path] = (byPath[x.path] || 0) + 1;
    });
    return { total: list.length, byEvent: byEvent, byPath: byPath, last: list.slice(-20).reverse(), storage: 'IndexedDB full + localStorage summary' };
  };

  function classifyLink(a) {
    if (!a) return '';
    var explicit = a.getAttribute('data-ptf-event');
    if (explicit) return explicit;
    var href = a.getAttribute('href') || '';
    var h = href.toLowerCase();
    if (h.indexOf('tel:') === 0) return 'phone_click';
    if (h.indexOf('mailto:') === 0) return 'email_click';
    if (h.indexOf('wa.me/') > -1 || h.indexOf('whatsapp') > -1) return 'whatsapp_click';
    if (/(^|\/)rfq\//.test(h) || h.indexOf('/rfq/') > -1) return 'cta_rfq_click';
    if (/(^|\/)tracking\//.test(h) || h.indexOf('/tracking/') > -1) return 'tracking_cta_click';
    if (/(^|\/)supplier\//.test(h) || h.indexOf('/supplier/') > -1) return 'supplier_cta_click';
    if (/(^|\/)assistant\//.test(h) || h.indexOf('/assistant/') > -1) return 'assistant_cta_click';
    if (/(^|\/)tools\//.test(h) || h.indexOf('/tools/') > -1) return 'tools_cta_click';
    if (h === '#contact' || h.endsWith('/#contact')) return 'contact_cta_click';
    if (h.indexOf('knowledge-center/') > -1 || h.indexOf('/blog/') > -1 || /^blog\//.test(h)) return 'content_click';
    return '';
  }

  function bindClicks() {
    document.addEventListener('click', function (e) {
      var el = e.target && e.target.closest ? e.target.closest('a,button,[data-ptf-event]') : null;
      if (!el) return;
      var ev = el.getAttribute('data-ptf-event') || (el.tagName === 'A' ? classifyLink(el) : 'button_click');
      if (!ev) return;
      var href = el.getAttribute('href') || '';
      track(ev, {
        label: safeText(el.getAttribute('aria-label') || el.textContent || el.title || '', 90),
        href: href ? pathOnly(href) : '',
        cta_id: safeText(el.getAttribute('id') || el.getAttribute('data-ptf-id') || '', 50)
      });
    }, true);
  }

  function bindForms() {
    document.addEventListener('submit', function (e) {
      var f = e.target;
      if (!f || !f.tagName || f.tagName !== 'FORM') return;
      var id = f.getAttribute('id') || '';
      var map = { contactForm: 'home_rfq_form_submit_attempt', rfqWizardForm: 'rfq_form_submit_attempt', supplierForm: 'supplier_form_submit_attempt', trackForm: 'tracking_form_submit_attempt' };
      track(map[id] || 'form_submit_attempt', { form_id: safeText(id, 60), action: safeText(f.getAttribute('action') || '', 120) });
    }, true);
  }

  function renderDebugPanel() {
    try {
      var q = new URLSearchParams(location.search || '');
      if (q.get('ptf_metrics') !== '1') return;
      var sum = window.ptfMetricsSummary();
      var box = document.createElement('div');
      box.id = 'ptfMetricsPanel';
      box.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483647;background:#0f172a;color:#e2e8f0;border:1px solid #334155;border-radius:14px;padding:12px 14px;max-width:360px;max-height:70vh;overflow:auto;font:12px/1.7 Tahoma,Arial;direction:ltr;box-shadow:0 20px 50px rgba(0,0,0,.35)';
      var rows = Object.keys(sum.byEvent).sort().map(function (k) { return '<div><b>' + k + '</b>: ' + sum.byEvent[k] + '</div>'; }).join('') || '<div>No events yet</div>';
      box.innerHTML = '<div style="display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:8px"><b>PTF Web Metrics</b><button type="button" id="ptfMClose" style="border:0;border-radius:8px;padding:2px 7px">×</button></div>' +
        '<div>Total: <b>' + sum.total + '</b></div><div style="color:#94a3b8">' + sum.storage + '</div><hr style="border-color:#334155">' + rows +
        '<div style="display:flex;gap:6px;margin-top:8px"><button type="button" id="ptfMClear" style="border:0;border-radius:8px;padding:5px 8px">clear</button><button type="button" id="ptfMCopy" style="border:0;border-radius:8px;padding:5px 8px">copy json</button></div>';
      document.body.appendChild(box);
      document.getElementById('ptfMClose').onclick = function () { box.remove(); };
      document.getElementById('ptfMClear').onclick = function () { window.ptfMetricsClear(); location.reload(); };
      document.getElementById('ptfMCopy').onclick = function () { navigator.clipboard && navigator.clipboard.writeText(JSON.stringify(memEvents, null, 2)); };
    } catch (e) {}
  }

  function boot() {
    initFullQueue();
    track('page_view', { ref: safeText(document.referrer || '', 180) });
    bindClicks(); bindForms();
    try { document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') flushMetricsSync(); }); } catch (eV) {}
    renderDebugPanel();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
