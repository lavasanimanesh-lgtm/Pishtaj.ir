/* tester228 — v31.7.51 (STORAGE-IDB-VOLATILE-MIGRATION-001)
 * Archives volatile/cache localStorage keys into IndexedDB before compacting localStorage.
 */
require('./harness');
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var idx = fs.readFileSync(path.join(ROOT, 'crm/index.html'), 'utf-8');
var sq = fs.readFileSync(path.join(ROOT, 'crm/storage-quota.js'), 'utf-8');
var bak = fs.readFileSync(path.join(ROOT, 'crm/backup.js'), 'utf-8');

SECTION('Static migration API');
T('storage-quota نسخه module-primary دارد', /v31\.7\.(51|52)-STORAGE-IDB-/.test(sq));
T('API مهاجرت volatile به IndexedDB تعریف شده است', sq.indexOf('window.ptfStorageMigrateVolatileToIdb') > -1 && sq.indexOf('function migrateVolatileToIdb') > -1);
T('Archive index و نمایش آرشیوها وجود دارد', sq.indexOf('ptf_storage_archive_index') > -1 && sq.indexOf('window.ptfStorageArchiveIndex') > -1 && sq.indexOf('window.ptfStorageShowArchiveIndex') > -1);
T('کلیدهای volatile هدف migration هستند نه رکوردهای اصلی', ['ptf_web_events_v2','ptf_chat_history','ptf_draft_forms','ptf_crm_notifs','ptf_crm_sendqueue','ptf_crm_audit','ptf_backup_local','ptf_backup_prerestore','ptf_ai_hist_','ptf_ai_cache'].every(function (x) { return sq.indexOf(x) > -1; }) && sq.indexOf('ptf_crm_rfqs|ptf_crm_offers') === -1);
T('backup UI دکمه مهاجرت و آرشیو IndexedDB دارد', bak.indexOf('ptfStorageMigrateToIdb') > -1 && bak.indexOf('مهاجرت cache/draft به IndexedDB') > -1 && bak.indexOf('آرشیوهای IndexedDB') > -1);
T('پاک‌سازی امن ابتدا migration را صدا می‌زند', bak.indexOf('ptfStorageMigrateVolatileToIdb({ source: \'manual-cleanup\'') > -1);
T('اسکریپت‌ها با v31.7.51 cache-bust شده‌اند', idx.indexOf('storage-quota.js?v=31.9') > -1 && idx.indexOf('backup.js?v=31.9') > -1 && idx.indexOf("window.VER = 'v31.9'") > -1);

SECTION('Runtime IndexedDB migration smoke');
function LS() { this.s = {}; }
Object.defineProperty(LS.prototype, 'length', { get: function () { return Object.keys(this.s).length; } });
LS.prototype.getItem = function (k) { return Object.prototype.hasOwnProperty.call(this.s, String(k)) ? this.s[String(k)] : null; };
LS.prototype.setItem = function (k, v) { this.s[String(k)] = String(v); };
LS.prototype.removeItem = function (k) { delete this.s[String(k)]; };
LS.prototype.key = function (i) { return Object.keys(this.s)[i] || null; };
LS.prototype.clear = function () { this.s = {}; };
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
                  get: function (id) {
                    var r = {};
                    setTimeout(function () { r.result = store[id] || null; if (r.onsuccess) r.onsuccess(); }, 0);
                    return r;
                  }
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
var fakeStore = {};
var sandbox = {
  console: console,
  TextEncoder: TextEncoder,
  Date: Date,
  Blob: Blob,
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  indexedDB: makeFakeIndexedDB(fakeStore),
  navigator: { storage: { estimate: function () { return Promise.resolve({ usage: 1, quota: 2 }); } } },
  document: { getElementById: function () { return null; }, createElement: function () { return { style: {}, setAttribute: function(){}, innerHTML: '' }; }, body: { appendChild: function () {} } },
  alert: function (m) { sandbox._alert = m; },
  localStorage: new LS()
};
sandbox.window = sandbox;
vm.runInNewContext(sq, sandbox, { filename: 'storage-quota.js' });
function put(k, v) { sandbox.ptfStorageSafeSetItem(k, JSON.stringify(v), { noWarn: true }); }
put('ptf_web_events_v2', Array.from({ length: 240 }, function (_, i) { return { i: i, path: '/p' + i, pad: 'x'.repeat(120) }; }));
put('ptf_chat_history', Array.from({ length: 90 }, function (_, i) { return { i: i, t: 'msg' + i, pad: 'y'.repeat(80) }; }));
put('ptf_crm_audit', Array.from({ length: 1200 }, function (_, i) { return { i: i, msg: 'audit', pad: 'z'.repeat(60) }; }));
put('ptf_ai_hist_admin', Array.from({ length: 12 }, function (_, i) { return { i: i, data: { text: 'ai'.repeat(120) } }; }));
sandbox.ptfStorageSafeSetItem('ptf_ai_cache_big', 'c'.repeat(5000), { noWarn: true });
sandbox.ptfStorageSafeSetItem('ptf_backup_local', JSON.stringify({ app: 'PTF-CRM', data: { big: 'b'.repeat(5000) } }), { noWarn: true });
var before = sandbox.ptfStorageHealthSync().used;
sandbox.ptfStorageMigrateVolatileToIdb({ source: 'uat', fallbackCompact: false }, function (res) {
  T('runtime: migration ok و آرشیو حجیم دارد', res && res.ok === true && res.archivedBytes > 0 && Object.keys(fakeStore).some(function (k) { return k.indexOf('archive:ptf_web_events_v2') === 0; }));
  T('runtime: localStorage بعد از migration کوچک‌تر شده است', sandbox.ptfStorageHealthSync().used < before && res.freed > 0);
  T('runtime: web/chat/audit/AI history compact شده‌اند', JSON.parse(sandbox.localStorage.getItem('ptf_web_events_v2')).length === 100 && JSON.parse(sandbox.localStorage.getItem('ptf_chat_history')).length === 30 && JSON.parse(sandbox.localStorage.getItem('ptf_crm_audit')).length === 900 && JSON.parse(sandbox.localStorage.getItem('ptf_ai_hist_admin')).length === 4);
  T('runtime: AI cache حذف و backup local به marker IndexedDB تبدیل شده', sandbox.localStorage.getItem('ptf_ai_cache_big') === null && JSON.parse(sandbox.localStorage.getItem('ptf_backup_local')).storedIn === 'indexedDB');
  T('runtime: archive index شامل sourceKeyهاست', sandbox.ptfStorageArchiveIndex().some(function (x) { return x.sourceKey === 'ptf_backup_local'; }) && sandbox.ptfStorageArchiveIndex().some(function (x) { return x.sourceKey === 'ptf_crm_audit'; }));
  DONE('tester228-storage-idb-volatile-migration');
});
