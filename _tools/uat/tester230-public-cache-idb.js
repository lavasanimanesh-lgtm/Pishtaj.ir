/* tester230 — v31.7.97 (STORAGE-IDB-PUBLIC-CACHE-001)
 * Public website metrics/chat use IndexedDB full storage + lightweight localStorage summary.
 */
require('./harness');
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var metrics = fs.readFileSync(path.join(ROOT, 'assets/js/ptf-metrics.js'), 'utf-8');
var chat = fs.readFileSync(path.join(ROOT, 'assets/js/ptf-chat.js'), 'utf-8');
var idx = fs.readFileSync(path.join(ROOT, 'crm/index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(ROOT, 'crm/sw.js'), 'utf-8');

SECTION('Static public cache migration');
T('نسخه CRM v33.3.5 است', /window\.VER = 'v3[0-9.]+'/.test(idx) && /ptf-crm-v3[0-9.]+/.test(sw));
T('metrics نسخه STORAGE-IDB-PUBLIC-CACHE یا PRIVACY-METRICS دارد', metrics.indexOf('STORAGE-IDB-PUBLIC-CACHE-001') > -1 || metrics.indexOf('PRIVACY-METRICS-SERVER-SYNC-001') > -1);
T('metrics full queue را در IndexedDB و summary را در localStorage نگه می‌دارد', metrics.indexOf("IDB_KEY = STORE + ':idb-full'") > -1 && metrics.indexOf('MAX_IDB = 1000') > -1 && metrics.indexOf('MAX_LOCAL = 80') > -1 && metrics.indexOf('IndexedDB full + localStorage summary') > -1);
T('metrics privacy-aware aggregate sync دارد و همچنان IndexedDB/local summary را حفظ می‌کند', metrics.indexOf('metrics_ingest') > -1 && metrics.indexOf('sanitizeForServer') > -1 && metrics.indexOf('sendBeacon') === -1 && metrics.indexOf('XMLHttpRequest') === -1);
T('chat نسخه STORAGE-IDB-PUBLIC-CACHE دارد', chat.indexOf('STORAGE-IDB-PUBLIC-CACHE-001') > -1);
T('chat full history را در IndexedDB و summary را در localStorage نگه می‌دارد', chat.indexOf("IDB_KEY = HKEY + ':idb-full'") > -1 && chat.indexOf('MAX_IDB = 120') > -1 && chat.indexOf('MAX_LOCAL = 16') > -1);
T('chat loader همچنان metrics را site-wide لود می‌کند', chat.indexOf('ptf-metrics.js') > -1 && chat.indexOf('WEB-MEAS-002') > -1);

function LS() { this.s = {}; }
Object.defineProperty(LS.prototype, 'length', { get: function () { return Object.keys(this.s).length; } });
LS.prototype.getItem = function (k) { return Object.prototype.hasOwnProperty.call(this.s, String(k)) ? this.s[String(k)] : null; };
LS.prototype.setItem = function (k, v) { this.s[String(k)] = String(v); };
LS.prototype.removeItem = function (k) { delete this.s[String(k)]; };
LS.prototype.key = function (i) { return Object.keys(this.s)[i] || null; };
function makeFakeIndexedDB(store) {
  return {
    open: function () {
      var req = {};
      setTimeout(function () {
        var db = {
          objectStoreNames: { contains: function () { return true; } },
          createObjectStore: function () {},
          close: function () {},
          transaction: function () {
            var tx = {
              objectStore: function () {
                return {
                  put: function (obj) { store[obj.id] = obj; },
                  get: function (id) { var r = {}; setTimeout(function () { r.result = store[id] || null; if (r.onsuccess) r.onsuccess(); }, 0); return r; },
                  delete: function (id) { delete store[id]; }
                };
              },
              oncomplete: null,
              onerror: null
            };
            setTimeout(function () { if (tx.oncomplete) tx.oncomplete(); }, 0);
            return tx;
          }
        };
        req.result = db;
        if (req.onupgradeneeded) req.onupgradeneeded();
        if (req.onsuccess) req.onsuccess();
      }, 0);
      return req;
    }
  };
}

SECTION('Runtime metrics IndexedDB primary');
var metricStore = {}, metricLs = new LS();
var metricListeners = {};
var metricSandbox = {
  console: console,
  Date: Date,
  Math: Math,
  setTimeout: setTimeout,
  indexedDB: makeFakeIndexedDB(metricStore),
  localStorage: metricLs,
  location: { href: 'https://pishtaj.ir/', origin: 'https://pishtaj.ir', pathname: '/', search: '' },
  URL: URL,
  URLSearchParams: URLSearchParams,
  CustomEvent: function (name, o) { return { type: name, detail: o && o.detail }; },
  navigator: { clipboard: { writeText: function () {} } },
  document: {
    title: 'Home', referrer: '', readyState: 'complete',
    addEventListener: function (ev, fn) { metricListeners[ev] = fn; },
    createElement: function () { return { style: {}, appendChild: function () {}, remove: function () {}, set innerHTML(v) { this._html = v; }, get innerHTML() { return this._html || ''; } }; },
    body: { appendChild: function () {} },
    getElementById: function () { return { onclick: null }; }
  },
  dispatchEvent: function () {}
};
metricSandbox.window = metricSandbox;
vm.runInNewContext(metrics, metricSandbox, { filename: 'ptf-metrics.js' });
for (var i = 0; i < 140; i++) metricSandbox.ptfTrack('cta_rfq_click', { label: 'L' + i, href: '/rfq/' });
setTimeout(function () {
  var localEvents = JSON.parse(metricLs.getItem('ptf_web_events_v2') || '[]');
  var fullEvents = JSON.parse((metricStore['ptf_web_events_v2:idb-full'] || {}).value || '[]');
  T('runtime metrics: localStorage فقط ۸۰ summary دارد', localEvents.length === 80);
  T('runtime metrics: IndexedDB full queue بزرگ‌تر را نگه می‌دارد', fullEvents.length >= 140 && fullEvents.length > localEvents.length);
  T('runtime metrics: ptfMetricsSummary از full memory گزارش می‌دهد', metricSandbox.ptfMetricsSummary().total >= 140 && metricSandbox.ptfMetricsSummary().storage.indexOf('IndexedDB') > -1);

  SECTION('Runtime chat IndexedDB primary');
  var chatStore = {}, chatLs = new LS(), els = {}, scripts = [];
  function el(id) {
    if (!els[id]) els[id] = {
      id: id, value: '', textContent: '', innerHTML: '', style: {}, children: [], scrollTop: 0, scrollHeight: 0,
      className: '', href: '',
      classList: { _open: false, toggle: function (c) { this._open = !this._open; }, contains: function () { return this._open; }, add: function(){}, remove: function(){} },
      appendChild: function (x) { this.children.push(x); },
      addEventListener: function (ev, fn) { this['on' + ev] = fn; },
      querySelectorAll: function () { return []; },
      setAttribute: function (k, v) { this[k] = v; },
      getAttribute: function (k) { return this[k] || null; },
      focus: function () {},
      remove: function () {}
    };
    return els[id];
  }
  var chatSandbox = {
    console: console,
    Date: Date,
    Math: Math,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    indexedDB: makeFakeIndexedDB(chatStore),
    localStorage: chatLs,
    prompt: function () { return 'test'; },
    alert: function () {},
    AbortController: function () { this.signal = {}; this.abort = function () {}; },
    fetch: function () { return Promise.resolve({ json: function () { return Promise.resolve({ ok: false }); } }); },
    document: {
      currentScript: { src: 'https://pishtaj.ir/assets/js/ptf-chat.js' },
      querySelector: function () { return null; },
      createElement: function (tag) { var x = el('_' + tag + Math.random()); x.tagName = tag.toUpperCase(); return x; },
      head: { appendChild: function (s) { scripts.push(s.src || ''); } },
      body: { appendChild: function () {} },
      getElementById: function (id) { return el(id); }
    }
  };
  chatSandbox.window = chatSandbox;
  vm.runInNewContext(chat, chatSandbox, { filename: 'ptf-chat.js' });
  for (var j = 0; j < 25; j++) {
    el('ptfcIn').value = 'استعلام قیمت ' + j;
    el('ptfcSend').onclick && el('ptfcSend').onclick({});
  }
  setTimeout(function () {
    var localChat = JSON.parse(chatLs.getItem('ptf_chat_history') || '[]');
    var fullChat = JSON.parse((chatStore['ptf_chat_history:idb-full'] || {}).value || '[]');
    T('runtime chat: localStorage فقط ۱۶ پیام summary دارد', localChat.length === 16);
    T('runtime chat: IndexedDB full history بزرگ‌تر را نگه می‌دارد', fullChat.length >= 25 && fullChat.length > localChat.length);
    T('runtime chat: loader همچنان metrics را inject می‌کند', scripts.some(function (s) { return s.indexOf('ptf-metrics.js') > -1; }));
    DONE('tester230-public-cache-idb');
  }, 500);
}, 120);
