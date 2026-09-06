#!/usr/bin/env node
'use strict';
/* =====================================================================
   tester604-v34.37.7 — CUSTOMER-CONTACT-SAFETY
   آزمون رفتاریِ گزارش کارفرما: خواندنِ کهنه/ناقصِ مشتری نباید entity_delete یا
   سنگ‌قبر بسازد؛ ثبت/ویرایش و مهاجرت شماره هم باید بعد از رندر و pull، people/
   mobs/tels و شمارهٔ اصلی را نگه دارد.

   این تستر دو مسیر واقعی را در vm اجرا می‌کند:
   ۱) روتر collection از sales-domain-v2.js با snapshot ناقص و پاسخِ merge-like
      سرور؛ ۲) کل phonefmt.js با هوک saveCust2 و migration واقعی.
   ===================================================================== */
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function clone(v) { return JSON.parse(JSON.stringify(v)); }

var phoneSrc = read('crm/phonefmt.js');
var clientServerSrc = read('crm/client-server.js');
var salesSrc = read('crm/sales-domain-v2.js');
var r0 = salesSrc.indexOf('window.ptfEntitySaveCollection = function');
var r1 = salesSrc.indexOf('window.ptfSalesCommandErrorIsAmbiguous', r0);
var routerSrc = salesSrc.slice(r0, r1);
T('۱.۰ برش‌های واقعی phonefmt و collection-router پیدا شدند', r0 > -1 && r1 > r0 && phoneSrc.indexOf('function migrateCollection(') > -1);

/* ───────────────────────── phonefmt harness ───────────────────────── */
function bootPhone(options) {
  options = options || {};
  var rows = {
    ptf_crm_customers: options.customers || [],
    ptf_crm_suppliers: options.suppliers || [],
    ptf_crm_smsbook: []
  };
  var calls = { ups: [], collection: [], silent: [], timers: [] };
  var ls = { ptf_phonefmt_mig: options.migrated === false ? '0' : '1' };
  var ctx = {
    console: { warn: function () {}, error: function () {}, log: function () {} },
    JSON: JSON, Date: Date, String: String, Array: Array, Object: Object, Number: Number,
    window: {
      PTF_ENTITY_CMD_ENABLED: { ptf_crm_customers: true, ptf_crm_suppliers: true },
      saveCust2: options.saveCust2 || function () {},
      saveSup2: options.saveSup2 || function () {},
      ptfEntityUpsert: function (key, rec, opts) {
        calls.ups.push({ key: key, rec: clone(rec), opts: opts || {} });
        if (opts && opts.cb) opts.cb({ state: 'acked' });
      },
      ptfEntitySaveCollection: function (key, arr, opts) { calls.collection.push({ key: key, arr: clone(arr), opts: opts || {} }); },
      ptfSilentWrite: function (key, str) { calls.silent.push({ key: key, rows: JSON.parse(str) }); }
    },
    getData: function (key) { return rows[key] || []; },
    setData: function (key, arr) { rows[key] = arr; },
    localStorage: {
      getItem: function (key) { return Object.prototype.hasOwnProperty.call(ls, key) ? ls[key] : null; },
      setItem: function (key, value) { ls[key] = String(value); },
      removeItem: function (key) { delete ls[key]; }
    },
    setInterval: function (fn) { calls.timers.push(fn); return calls.timers.length - 1; },
    clearInterval: function () {},
    audit: function () {},
    renderSuppliers: function () {}
  };
  vm.createContext(ctx);
  vm.runInContext(phoneSrc, ctx, { filename: 'phonefmt-real.js' });
  /* Browser global `window` and the global object are identical; vm keeps them
     separate unless we alias exports explicitly. */
  ctx.ptfPhoneNorm = ctx.window.ptfPhoneNorm;
  ctx.ptfNormalizeEntityPhones = ctx.window.ptfNormalizeEntityPhones;
  ctx.ptfLatinize = ctx.window.ptfLatinize;
  calls.timers.forEach(function (fn) { fn(); });
  return { ctx: ctx, rows: rows, calls: calls, local: ls, saveCust: ctx.window.saveCust2, saveSup: ctx.window.saveSup2 };
}

/* ثبتِ جدید: تابع save واقعی همان رکورد را برمی‌گرداند؛ هوک نباید فرمان دوم بدهد. */
(function () {
  var saved = { cd: 'CUST-NEW', co: 'شرکت تماس‌دار', ph: '09123456789', people: [{ nm: 'رابط', mobs: [{ n: '09129876543', primary: true }], tels: [] }] };
  var h = bootPhone({ saveCust2: function () { return saved; } });
  var returned = h.saveCust('CUST-NEW');
  var rendered = clone(saved);
  T('۱.۱ ذخیرهٔ مشتری همان رکورد را برمی‌گرداند و هوک رکوردِ اول/حدسی را انتخاب نمی‌کند',
    returned === saved && h.calls.ups.length === 0 && rendered.people[0].mobs[0].n === '۰۹۱۲۹۸۷۶۵۴۳' && saved.ph === '۰۹۱۲۳۴۵۶۷۸۹',
    JSON.stringify({ returned: !!returned, ups: h.calls.ups.length, saved: saved }));
  T('۱.۲ بعد از رندرِ مجدد، شمارهٔ رابط و شمارهٔ اصلی در همان projection باقی می‌مانند',
    rendered.people[0].mobs[0].n && rendered.ph && rendered.people[0].mobs[0].n.indexOf('۰۹۱۲') === 0,
    JSON.stringify(rendered));
})();

/* نسخهٔ قدیمیِ فرم: فقط cd صریح مجاز است؛ items[0] نباید اشتباهاً upsert شود. */
(function () {
  var rows = [
    { cd: 'CUST-FIRST', ph: '09121111111', people: [] },
    { cd: 'CUST-SECOND', ph: '09122222222', people: [{ nm: 'رابط دوم', tels: [{ n: '02112345678' }], mobs: [] }] }
  ];
  var h = bootPhone({ customers: rows, saveCust2: function () {} });
  h.saveCust('CUST-SECOND');
  T('۱.۳ fallback نسخهٔ قدیمی فقط همان cd را upsert می‌کند، نه items[0]',
    h.calls.ups.length === 1 && h.calls.ups[0].rec.cd === 'CUST-SECOND' && rows[0].cd === 'CUST-FIRST',
    JSON.stringify(h.calls.ups));
})();

/* migration واقعی: فقط ردیف‌های تغییرکرده upsert می‌شوند؛ کل آرایه به روترِ حذف‌ساز
   ارسال نمی‌شود. */
(function () {
  var h = bootPhone({
    migrated: false,
    customers: [{ cd: 'CUST-MIG', ph: '09123334444', people: [{ nm: 'رابط', mobs: [{ n: '09125556666' }], tels: [] }] }],
    suppliers: [{ cd: 'SUP-MIG', origin: 'داخلی', ph: '02112345678', people: [] }],
    saveCust2: function () {}, saveSup2: function () {}
  });
  T('۱.۴ migration شماره‌ها را رکوردی و بدون save کل مجموعه انجام می‌دهد',
    h.calls.collection.length === 0 && h.calls.ups.length === 2 &&
    h.calls.ups.some(function (x) { return x.key === 'ptf_crm_customers' && x.rec.people[0].mobs[0].n === '۰۹۱۲۵۵۵۶۶۶۶'; }) &&
    h.calls.ups.some(function (x) { return x.key === 'ptf_crm_suppliers' && x.rec.ph === '۰۲۱۱۲۳۴۵۶۷۸'; }),
    JSON.stringify(h.calls));
  T('۱.۵ پس از migration نشانگر یک‌باره ثبت می‌شود', h.local.ptf_phonefmt_mig === '1', JSON.stringify(h.local));
})();

/* ───────────────────────── collection-router harness ───────────────────────── */
function bootRouter(initialRows) {
  var serverRows = clone(initialRows || []);
  var calls = { ups: [], dels: [], legacy: [], local: [] };
  var ctx = {
    console: { warn: function () {}, error: function () {} },
    JSON: JSON, Array: Array, Object: Object, String: String, Date: Date, Number: Number,
    window: {
      PTF_ENTITY_CMD_ENABLED: { ptf_crm_customers: true, ptf_crm_suppliers: true },
      ptfEntityUpsert: function (collection, rec, opts) {
        calls.ups.push(clone(rec));
        var at = -1;
        serverRows.forEach(function (row, i) { if (row && String(row.cd) === String(rec.cd)) at = i; });
        /* قرارداد entity_upsert سرور: فیلد غایب یعنی «بدون تغییر»، نه پاک‌سازی. */
        if (at < 0) serverRows.push(clone(rec));
        else serverRows[at] = Object.assign({}, serverRows[at], clone(rec));
        if (opts && opts.cb) opts.cb({ state: 'acked' });
      },
      ptfEntityDelete: function (collection, id, opts) {
        calls.dels.push(id);
        if (opts && opts.cb) opts.cb({ state: 'acked' });
      },
      ptfSilentWrite: function (collection, str) { calls.local.push({ collection: collection, rows: JSON.parse(str) }); },
      ptfSyncAcknowledgeKeys: function () {}
    },
    setData: function (key, arr) { calls.legacy.push({ key: key, rows: clone(arr) }); },
    getData: function () { return serverRows; },
    audit: function () {},
    ptfToast: function () {}
  };
  vm.createContext(ctx);
  vm.runInContext(routerSrc, ctx, { filename: 'customer-router-real.js' });
  return { save: ctx.window.ptfEntitySaveCollection, calls: calls, window: ctx.window, serverRows: serverRows };
}

(function () {
  var contact = { nm: 'رابط اصلی', mobs: [{ n: '۰۹۱۲۹۸۷۶۵۴۳', primary: true }], tels: [] };
  var base = [{ cd: 'CUST-1', co: 'شرکت قدیم', people: [contact], ph: '۰۹۱۲۹۸۷۶۵۴۳' }];
  var h = bootRouter(base);
  /* همان cd هست، اما snapshotِ کهنه فیلد people/ph را ندارد. */
  var result = h.save('ptf_crm_customers', [{ cd: 'CUST-1', co: 'شرکت جدید' }], { prevArr: base, reason: 'stale-rerender' });
  var afterSync = clone(h.serverRows[0]);
  T('۲.۱ snapshot ناقصِ همان مشتری entity_delete یا tombstone ایجاد نمی‌کند',
    result && result.mode === 'commands' && result.deletes === 0 && h.calls.dels.length === 0,
    JSON.stringify({ result: result, dels: h.calls.dels }));
  T('۲.۲ بعد از upsert و pull، merge سرور اطلاعات تماس را نگه می‌دارد',
    afterSync.people && afterSync.people[0].mobs[0].n === '۰۹۱۲۹۸۷۶۵۴۳' && afterSync.ph === '۰۹۱۲۹۸۷۶۵۴۳',
    JSON.stringify(afterSync));
  T('۲.۳ projection محلی/رندر قبل از pull هم راه تماس را از بین نمی‌برد',
    h.calls.local.length === 1 && h.calls.local[0].rows.length === 1 &&
    h.calls.local[0].rows[0].cd === 'CUST-1' && h.calls.local[0].rows[0].people[0].mobs[0].n === '۰۹۱۲۹۸۷۶۵۴۳',
    JSON.stringify(h.calls.local));
})();

(function () {
  var base = [
    { cd: 'CUST-A', people: [{ nm: 'الف', mobs: [{ n: '۰۹۱۲۱۱۱۱۱۱۱' }], tels: [] }] },
    { cd: 'CUST-B', people: [{ nm: 'ب', mobs: [{ n: '۰۹۱۲۲۲۲۲۲۲۲' }], tels: [] }] }
  ];
  var h = bootRouter(base);
  var result = h.save('ptf_crm_customers', [base[0]], { prevArr: base, reason: 'render-refresh' });
  T('۲.۴ غیبت مشتری در خواندنِ خودکار فقط با قصد صریح قابل حذف است',
    result && result.deletes === 0 && h.calls.dels.length === 0 && h.window._ptfEntityLastKnown.ptf_crm_customers.length === 2,
    JSON.stringify({ result: result, snapshot: h.window._ptfEntityLastKnown }));
})();

T('۳.۰ قرارداد merge سرور برای فیلدِ غایب و حفظ people در API باقی است',
  /if \(array_key_exists\(\$pk, \$row\)\) continue;[\s\S]{0,180}\$row\[\$pk\] = \$pv;/.test(read('api/sales-domain.php')));
T('۳.۱ مسیر مهاجرت phonefmt دیگر کل آرایهٔ مشتری/تامین‌کننده را به‌صورت خودکار نمی‌فرستد',
  phoneSrc.indexOf("window.ptfEntityUpsert(key, rec") > -1 && phoneSrc.indexOf("tag + '|' + String(rec.cd") > -1);

/* شکست quota/صف: projection تازه در cache volatile می‌ماند و read بعدی به آرایهٔ
   تهی/کهن برنمی‌گردد؛ این همان حلقه‌ای است که می‌توانست diff حذف تولید کند. */
(function () {
  var store = { ptf_b_phase: '1', ptf_sync_krevs: '{}', ptf_crm_customers: '[{"cd":"CUST-OLD"}]' };
  var failures = [], events = [], timers = [];
  var ls = {
    getItem: function (key) { return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null; },
    setItem: function (key, value) { if (key === 'ptf_crm_customers') throw new Error('quota'); store[key] = String(value); },
    removeItem: function (key) { delete store[key]; }
  };
  var win = {
    __ptfClientServerLoaded: false,
    __ptfBKeys: ['ptf_crm_customers'],
    getData: function (key) { return JSON.parse(ls.getItem(key) || '[]'); },
    setData: function () {},
    ptfSyncNotifyWriteFailure: function (key, msg) { failures.push([key, msg]); },
    dispatchEvent: function (event) { events.push(event); },
    CustomEvent: function (type, init) { this.type = type; this.detail = init.detail; },
    indexedDB: null,
    ptfStorageIdbSet: function () {}, ptfStorageIdbGet: function () {},
    ptfStorageRequestPersistentAuto: function () {}
  };
  var ctx = {
    window: win, localStorage: ls,
    console: { log: function () {}, warn: function () {}, error: function () {} },
    JSON: JSON, Date: Date, String: String, Array: Array, Object: Object, Number: Number,
    Math: Math, RegExp: RegExp, parseInt: parseInt, parseFloat: parseFloat, isFinite: isFinite,
    curSession: function () { return { user: 'uat' }; },
    setInterval: function (fn) { timers.push(fn); return timers.length - 1; },
    clearInterval: function () {}, setTimeout: setTimeout, clearTimeout: clearTimeout,
    fetch: function () { return Promise.reject(new Error('network')); },
    document: { querySelector: function () { return null; } }, addLog: function () {}, audit: function () {}
  };
  vm.createContext(ctx);
  vm.runInContext(clientServerSrc, ctx, { filename: 'client-server-real.js' });
  win.ptfBAutoBootstrap = function () {};
  win.ptfStorageRequestPersistentAuto = function () {};
  if (timers.length) timers[0]();
  var fresh = JSON.stringify([{ cd: 'CUST-OLD', people: [{ mobs: [{ n: '۰۹۱۲۹۸۷۶۵۴۳' }] }] }]);
  var ok = win.ptfBApplyServerProjection('ptf_crm_customers', fresh, 2);
  var afterFailureRead = win.getData('ptf_crm_customers');
  T('۴.۰ شکست quota مقدار تازهٔ شماره را volatile نگه می‌دارد، نه snapshot تهی/کهن',
    ok === false && afterFailureRead[0].people[0].mobs[0].n === '۰۹۱۲۹۸۷۶۵۴۳', JSON.stringify(afterFailureRead));
  T('۴.۱ شکست ذخیره به sync/UI اعلام می‌شود',
    failures.length === 1 && failures[0][0] === 'ptf_crm_customers' && events.length === 1 && events[0].type === 'ptf-storage-quota',
    JSON.stringify({ failures: failures, events: events.length }));
})();

console.log('\n— tester604 (v34.37.7: ایمنی اطلاعات تماس مشتری/تامین‌کننده) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
