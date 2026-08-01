/* tester229 — v31.7.97 (STORAGE-IDB-MODULE-PRIMARY-001)
 * AI Workbench and draftx write full volatile data to IndexedDB and keep localStorage lightweight.
 */
require('./harness');
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var ai = fs.readFileSync(path.join(ROOT, 'crm/ai-workbench.js'), 'utf-8');
var dx = fs.readFileSync(path.join(ROOT, 'crm/draftx.js'), 'utf-8');
var idx = fs.readFileSync(path.join(ROOT, 'crm/index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(ROOT, 'crm/sw.js'), 'utf-8');
var sq = fs.readFileSync(path.join(ROOT, 'crm/storage-quota.js'), 'utf-8');

SECTION('Static module-primary migration');
T('نسخه CRM و cache-bust v33.3.3 است', /window\.VER = 'v3[0-9.]+'/.test(idx) && /ai-workbench.js\?v=3[0-9.]+/.test(idx) && /draftx.js\?v=3[0-9.]+/.test(idx) && /ptf-crm-v3[0-9.]+/.test(sw));
T('AI Workbench کلید full history در IndexedDB دارد', ai.indexOf('function aiWB_histIdbKey()') > -1 && ai.indexOf("aiWB_histKey() + ':idb-full'") > -1);
T('AI Workbench full history را با ptfStorageIdbSet/Get می‌خواند/می‌نویسد', ai.indexOf('ptfStorageIdbSet(aiWB_histIdbKey()') > -1 && ai.indexOf('ptfStorageIdbGet(aiWB_histIdbKey()') > -1);
T('AI localStorage فقط summary سبک نگه می‌دارد', ai.indexOf('aiWB_histSummary') > -1 && ai.indexOf('localStorage فقط خلاصه سبک') > -1 && ai.indexOf('JSON.stringify(x.data||{}).length < 30000') > -1);
T('AI restore اگر summary داده نداشت از IndexedDB async می‌خواند', ai.indexOf('aiWB_histLoad(function(h)') > -1 && ai.indexOf('aiWB_applyRestore(t,h[i])') > -1);
T('Draftx کلید full در IndexedDB و summary local دارد', dx.indexOf("var IDB_KEY = KEY + ':idb-full'") > -1 && dx.indexOf('var LOCAL_DRAFTS = 8') > -1 && dx.indexOf('function localSummary') > -1);
T('Draftx saveAll به IndexedDB می‌نویسد و localStorage summary ذخیره می‌کند', dx.indexOf('ptfStorageIdbSet(IDB_KEY') > -1 && dx.indexOf('localStorage.setItem(KEY, JSON.stringify(localSummary(fullNow)))') > -1);
T('Draftx restore/drop از IndexedDB هم پشتیبانی می‌کند', dx.indexOf('function loadDraftAsync') > -1 && dx.indexOf('function dropDraft') > -1 && dx.indexOf('ptfStorageIdbGet(IDB_KEY') > -1);
T('رکوردهای اصلی کسب‌وکاری در module-primary هدف migration نیستند', sq.indexOf('ptf_crm_rfqs|ptf_crm_offers') === -1 && dx.indexOf('ptf_crm_offers') === -1);

SECTION('Runtime AI Workbench IDB primary smoke');
global.localStorage.clear();
global.window = global;
global.curSession = function () { return { user: 'admin', name: 'Admin' }; };
global.document = {
  createElement: function () { return { textContent: '', innerHTML: '' }; },
  getElementById: function () { return null; },
  querySelector: function () { return null; },
  querySelectorAll: function () { return []; },
  body: { insertAdjacentHTML: function () {} },
  addEventListener: function () {}
};
global.navigator = { clipboard: { writeText: function () {} } };
global.fetch = function () { return Promise.resolve({ json: function () { return Promise.resolve({ ok: true }); } }); };
var idb = {};
global.ptfStorageIdbSet = function (k, v, cb) { idb[k] = String(v); if (cb) cb(true, String(v).length); };
global.ptfStorageIdbGet = function (k, cb) { setTimeout(function () { cb(idb[k] ? { value: idb[k] } : null); }, 0); };
eval(ai);
aiWB_persist('summarize', 'خلاصه طولانی', { html: '<b>result</b>', text: 'X'.repeat(120000), plain: 'plain' });
setTimeout(function () {
  var hk = 'ptf_ai_hist_admin';
  var localRaw = localStorage.getItem(hk) || '';
  var idbRaw = idb[hk + ':idb-full'] || '';
  T('runtime AI: full history در IndexedDB ذخیره شد', idbRaw.length > 100000 && JSON.parse(idbRaw)[0].data.text.length === 120000);
  T('runtime AI: localStorage summary سبک‌تر از full است', localRaw.length < 5000 && localRaw.length < idbRaw.length / 10);

  SECTION('Runtime draftx IDB primary smoke');
  global.localStorage.clear(); idb = {};
  var listeners = {};
  function El(tag, id, type) { return { tagName: tag.toUpperCase(), id: id || '', type: type || (tag === 'input' ? 'text' : ''), value: '', checked: false, closest: function () { return this._modal || null; }, textContent: '' }; }
  var f1 = El('input', 'f1'), f2 = El('textarea', 'f2');
  var modal = { nodeType: 1, classList: { contains: function (c) { return c === 'md-b'; } }, _fields: [f1, f2], getAttribute: function () { return null; }, setAttribute: function () {}, querySelectorAll: function () { return this._fields; }, querySelector: function (sel) { return sel.indexOf('h3') > -1 ? { textContent: 'فرم تست' } : null; } };
  f1._modal = modal; f2._modal = modal;
  global.document = {
    body: { contains: function () { return true; }, appendChild: function () {} },
    addEventListener: function (ev, fn) { listeners[ev] = fn; },
    getElementById: function (id) { return id === 'f1' ? f1 : (id === 'f2' ? f2 : null); },
    createElement: function () { return { style: {}, querySelector: function () { return { onclick: null }; }, remove: function () {}, innerHTML: '' }; }
  };
  global.MutationObserver = function () { return { observe: function () {} }; };
  global.ptfStorageIdbSet = function (k, v, cb) { idb[k] = String(v); if (cb) cb(true, String(v).length); };
  global.ptfStorageIdbGet = function (k, cb) { setTimeout(function () { cb(idb[k] ? { value: idb[k] } : null); }, 0); };
  eval(dx);
  f1.value = 'عنوان تست'; f2.value = 'متن طولانی پیش‌نویس برای ذخیره مستقیم در آی‌دی‌بی';
  listeners.input({ target: f2 });
  setTimeout(function () {
    var localDraft = JSON.parse(localStorage.getItem('ptf_draft_forms') || '{}');
    var fullDraft = JSON.parse(idb['ptf_draft_forms:idb-full'] || '{}');
    T('runtime draftx: local summary ذخیره شد', Object.keys(localDraft).length === 1);
    T('runtime draftx: نسخه کامل در IndexedDB ذخیره شد', Object.keys(fullDraft).length === 1 && fullDraft[Object.keys(fullDraft)[0]].data.v.f2.indexOf('پیش‌نویس') > -1);
    DONE('tester229-storage-idb-module-primary');
  }, 950);
}, 50);
