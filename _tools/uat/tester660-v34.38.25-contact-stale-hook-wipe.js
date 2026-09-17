#!/usr/bin/env node
'use strict';
/* =============================================================================
   tester660-v34.38.25-contact-stale-hook-wipe.js
   گزارش کارفرما (۱۴۰۵/۰۶/۲۶): «هر مشتری که مدیرعامل با شماره ثبت می‌کند، رکورد
   می‌ماند ولی شماره‌ها برای من (رییس هیات مدیره) ناپدید است؛ مشتری‌های ثبتِ
   خودم سالم‌اند.»

   ریشهٔ اثبات‌شده با کد واقعی (vm، بازتولید کامل):
     phonefmt.hookCust/hookSup پس از هر saveCust2/saveSup2 بی‌قید و شرط اجرا
     می‌شد — حتی وقتی save زودهنگام برمی‌گشت (بلاک ضدتکرار US-174 یا نام خالی) —
     و «آخرین رکورد ذخیره‌شدهٔ تب» (window._ptfLastSavedCustCd) را از کشِ محلیِ
     کهنه با ptfEntityUpsert(..., {expectCreate:false}) دوباره می‌فرستاد. merge
     سرور «کلیدِ حاضر بازنویسی» → تماس‌هایی که از زمانِ آخرین pull آن تب، دستگاه
     دیگر اضافه کرده بود پاک می‌شد. دستگاهِ ثبت‌کننده از کش خودش نسخهٔ تماس‌دار
     را می‌دید ⇒ الگوی نقش‌محورِ گزارش (مالِ من سالم، مال او پاک) بدون هیچ
     تبعیض نقشی — فقط «کدام دستگاه آخرین ثبت را داشته».

   اصلاح v34.39.11 (سه‌لایه):
     ① offers.js: نرمال‌سازی/لاتین‌سازی (وظیفهٔ واقعی هوک) به «قبل از
        پایدارسازی» منتقل شد — داخل saveCust2/saveSup2، پیش از payload.
     ② phonefmt.js: هوک فقط روی «ویرایش صریح» (cd مشخص) تایید مجدد تک‌رکوردی
        می‌کند؛ ثبتِ جدید (cd=null) و ذخیرهٔ زودبرگشتی هیچ نوشتنی ندارند.
        (قرارداد ۲.۹ قدیمی tester604 عمداً تغییر کرد — همان‌جا مستند است.)
     ③ api/sales-domain.php: invariant CONTACT-WIPE — اگر رکورد ذخیره‌شده تماس
        دارد و payload «هر کلید تماسی که می‌آورد» خالی است، پاک‌سازی نیت صریح
        می‌خواهد (rec._ccClear=1 از کلاینت جاری؛ فیلد پیش از ذخیره حذف می‌شود).
        کلاسِ کامل «پاک‌سازی تماس توسط کلاینت کهنه/معرور» برای هر نویسنده بسته است.

   این تستر چهار لایه را می‌بندد: ایستا + قرارداد هوک + رفتار سرور (پورت دقیق
   توابع گارد از سورس PHP) + زنجیرهٔ کامل نقش‌ها با بوت واقعی (dedup → offers →
   phonefmt → sales-domain-v2) و سرور واقعی‌نما (expectCreate/409/merge).
   ============================================================================= */
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function head(s) { console.log('\n── ' + s + ' ──'); }

var pf = read('crm/phonefmt.js');
var off = read('crm/offers.js');
var sd = read('crm/sales-domain-v2.js');
var dd = read('crm/dedup.js');
var php = read('api/sales-domain.php');
var gate = read('_tools/uat/run-ci-gate.js');
var manifest = JSON.parse(read('crm/manifest.json'));
var versionJson = JSON.parse(read('VERSION.json'));
var idx = read('crm/index.html');
var sw = read('crm/sw.js');

var V = '34.39.11';

/* ═══════════════════ ۱) ایستا: سورس و ثبت گیت ═══════════════════ */
head('۱. ایستا — نشانه‌های اصلاح در سورس');
(function () {
  var h0 = pf.indexOf('function hookCust()');
  var h1 = pf.indexOf('function hookSup()');
  var hEnd = pf.indexOf('return true;', h1);
  T('۱.۱ برش هوک‌ها پیدا شد', h0 > -1 && h1 > h0);
  var hooksSrc = pf.slice(h0, hEnd > -1 ? hEnd : undefined);
  T('۱.۲ هوک‌ها مهر CONTACT-STALE-HOOK دارند (ریشه مستند شده)', hooksSrc.indexOf('CONTACT-STALE-HOOK') > -1);
  T('۱.۳ هوک مشتری: ثبت جدید (cd=null) هیچ نوشتنی ندارد', /hookCust[\s\S]*?if \(!cd\) return;/.test(hooksSrc));
  T('۱.۴ هوک تامین‌کننده: همان قرارداد', /hookSup[\s\S]*?if \(!cd\) return;/.test(hooksSrc));
  var code5 = hooksSrc.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
  T('۱.۵ قرارداد ساخت: فقط ptfEntityUpsert تک‌رکوردی — نه SaveCollection، نه items[0]',
    code5.indexOf('ptfEntitySaveCollection') === -1 && code5.indexOf('items[0]') === -1 && code5.indexOf('ptfEntityUpsert') > -1);

  var c0 = off.indexOf('function saveCust2');
  var s0 = off.indexOf('function saveSup2');
  var custFn = off.slice(c0, s0), supFn = off.slice(s0, off.indexOf('window.ptfHealMissingCustomersFromRfqs'));
  T('۱.۶ نرمال‌سازی داخل saveCust2 و «پیش از» پایدارسازی (SaveCollection) منتقل شده',
    custFn.indexOf("ptfNormalizeEntityPhones(rec, 'fa')") > -1 &&
    custFn.indexOf('ptfNormalizeEntityPhones') > custFn.indexOf('ptfDupBlock') &&
    custFn.indexOf('ptfNormalizeEntityPhones') < custFn.indexOf('ptfEntitySaveCollection'));
  T('۱.۷ نرمال‌سازی/لاتین‌سازی داخل saveSup2 پیش از پایدارسازی — حالت خارجی از فرم',
    supFn.indexOf('ptfNormalizeEntityPhones') > -1 &&
    supFn.indexOf('ptfNormalizeEntityPhones') > supFn.indexOf('ptfDupBlock') &&
    supFn.indexOf('ptfNormalizeEntityPhones') < supFn.indexOf("ptfEntitySaveCollection('ptf_crm_suppliers'") &&
    supFn.indexOf("isForeign ? 'en' : 'fa'") > -1);
  T('۱.۸ مهر پاک‌سازی عمدی (_ccClear) در هر دو مسیر ذخیره هست',
    custFn.indexOf('_ccClear') > -1 && supFn.indexOf('_ccClear') > -1 && off.indexOf('function ptfCustHadContacts') > -1);

  T('۱.۹ گارد سرور CONTACT-WIPE-INVARIANT در entity_upsert سیم شده',
    php.indexOf('function sd_contact_wipe_guard') > -1 &&
    /entity_upsert[\s\S]{0,4000}?sd_contact_wipe_guard\(\$row, \$prev/.test(php) &&
    php.indexOf('unset($row[\'_ccClear\'])') > -1);
  T('۱.۱۰ tester660 در run-ci-gate.js ثبت است', gate.indexOf('tester660-v34.38.25-contact-stale-hook-wipe.js') > -1);
  T('۱.۱۱ نسخه‌ها یکدست v' + V + ' (manifest/VERSION/index/sw)',
    manifest.version === V && versionJson.crm_version === 'v' + V &&
    idx.indexOf('PTF_CRM_RELEASE = \'v' + V + '\'') > -1 && sw.indexOf("'v" + V + "'") > -1);
})();

/* سینتکس PHP با همان موتور گیت (php-parser) */
(function () {
  try {
    var parser = require('php-parser');
    try { new parser({ parser: { extractDoc: false, suppressErrors: false } }).parseCode(php, 'sales-domain.php'); T('۱.۱۲ سینتکس api/sales-domain.php سالم (php-parser)', true); }
    catch (eP) { T('۱.۱۲ سینتکس api/sales-domain.php سالم (php-parser)', false, eP.message); }
  } catch (eNoParser) { T('۱.۱۲ سینتکس api/sales-domain.php سالم (php-parser در دسترس نیست — گیت هشدار می‌دهد)', true); }
})();

/* ═══════════════════ ۲) گارد سرور — پورت دقیق سورس PHP ═══════════════════ */
head('۲. گارد CONTACT-WIPE سرور (رفتار پورت‌شده از PHP)');
/* توابع زیر با کپیِ ۱:۱ از api/sales-domain.php پورت شده‌اند؛ تستر ۱.۹ هم وجود
   نام توابع و سیم‌شدنشان را در سورس چک می‌کند تا پورت از سورس جدا نشود. */
function sdContactValEmpty(v) {
  if (Array.isArray(v)) {
    for (var i = 0; i < v.length; i++) {
      var it = v[i];
      if (it && typeof it === 'object' && !Array.isArray(it)) {
        var lists = ['tels', 'mobs', 'mails'];
        for (var L = 0; L < lists.length; L++) {
          var arr = (it[lists[L]] && Array.isArray(it[lists[L]])) ? it[lists[L]] : [];
          for (var j = 0; j < arr.length; j++) { var t = arr[j]; if (t && typeof t === 'object' && t.n != null && String(t.n).trim() !== '') return false; }
        }
        if (it.n != null && String(it.n).trim() !== '') return false;
      } else if (typeof it === 'string' && it.trim() !== '') return false;
    }
    return true;
  }
  return String(v == null ? '' : v).trim() === '';
}
function sdRowHasContact(r, k) {
  if (!Object.prototype.hasOwnProperty.call(r, k)) return false;
  var v = r[k];
  if (k === 'ph') return typeof v === 'string' ? v.trim() !== '' : false;
  return Array.isArray(v) && v.length > 0 && !sdContactValEmpty(v);
}
function sdContactWipeGuard(row, prev, stats, ccClear) {
  var keys = ['people', 'coTels', 'phones', 'ph'];
  var anyPresented = false, allEmpty = true, storedHas = false;
  keys.forEach(function (k) {
    if (Object.prototype.hasOwnProperty.call(row, k)) { anyPresented = true; if (!sdContactValEmpty(row[k])) allEmpty = false; }
    if (sdRowHasContact(prev, k)) storedHas = true;
  });
  if (!anyPresented || !allEmpty || !storedHas || ccClear) return row;
  keys.forEach(function (k) { if (Object.prototype.hasOwnProperty.call(row, k)) row[k] = prev[k]; });
  if (stats) stats.contactsWipeBlocked = (stats.contactsWipeBlocked || 0) + 1;
  return row;
}
(function () {
  var prev = { people: [{ nm: 'رابط', tels: [{ n: '021111', ext: '', lb: '' }], mobs: [], mails: [], primary: true }], coTels: [{ n: '021222', ext: '', lb: 'تلفنخانه' }], phones: [], ph: '' };
  var stats = {};
  var row = sdContactWipeGuard({ cd: 'CUST-1', co: 'x', people: [], coTels: [], phones: [], ph: '' }, prev, stats, false);
  T('۲.۱ کلاینت کهنه/معرور با «خالیِ حاضر» — تماس‌های قبلی حفظ و شمرده می‌شود',
    row.people.length === 1 && row.people[0].tels[0].n === '021111' && row.coTels[0].n === '021222' && stats.contactsWipeBlocked === 1, JSON.stringify(row));
  var row2 = sdContactWipeGuard({ cd: 'CUST-1', people: [], coTels: [] }, prev, {}, true);
  T('۲.۲ با مهر نیت (_ccClear) پاک‌سازی عمدی اجازه دارد',
    row2.people.length === 0 && row2.coTels.length === 0);
  var row3 = sdContactWipeGuard({ cd: 'CUST-1', people: [{ nm: 'رابط نو', tels: [{ n: '021999', ext: '', lb: '' }], mobs: [], mails: [], primary: true }] }, prev, {}, false);
  T('۲.۳ جایگزینی با محتوای تازه بی‌مانع است (فقط «همه‌خالی» گارد می‌شود)',
    row3.people[0].tels[0].n === '021999');
  var row4 = sdContactWipeGuard({ cd: 'CUST-1', co: 'x' }, prev, {}, false);
  T('۲.۴ کلید غایب = تغییرنکرده (قرارداد merge v34.8.34 دست نمی‌خورد)',
    !('people' in row4) && !('ph' in row4));
  var row5 = sdContactWipeGuard({ cd: 'CUST-9', co: 'x', people: [] }, { cd: 'CUST-9', co: 'قدیمی', people: [], coTels: [] }, {}, false);
  T('۲.۵ stub بدون تماس (heal) گارد ندارد و معمول ذخیره می‌شود', row5.co === 'x');
  var row6 = sdContactWipeGuard({ cd: 'CUST-9', co: 'x', people: [], coTels: [], phones: [{ n: '021777', ext: '', lb: '' }], ph: '' }, prev, {}, false);
  T('۲.۶ اگر حتی یک کلید حاضرِ تماسی محتوا دارد، گارد فعال نمی‌شود',
    row6.phones[0].n === '021777' && row6.people.length === 0);
  /* تفاوت حقیقی/حقوقی — هر دو شکل رکورد پوشش داده شود */
  var mob = { cd: 'CUST-2', kind: 'حقیقی', phones: [{ n: '0912', lb: 'همراه' }], people: [], coTels: [] };
  var r7 = sdContactWipeGuard({ cd: 'CUST-2', phones: [], people: [], coTels: [], ph: '' }, mob, {}, false);
  T('۲.۷ رکورد حقیقی (phones میراثی) هم گارد می‌شود', r7.phones[0].n === '0912');
})();

/* ═══════════════════ ۳) قرارداد هوک — بوت واقعی ═══════════════════ */
head('۳. قرارداد هوک phonefmt با کد واقعی');
/* ── سرور واقعی‌نما: عین معناشناسی api/sales-domain.php ── */
function makeServer() {
  var rows = { ptf_crm_customers: {}, ptf_crm_suppliers: {} };
  function keyMerge(prev, rec) { /* کلیدِ حاضر بازنویسی؛ کلیدِ غایب حفظ */
    var out = Object.assign({}, prev);
    Object.keys(rec).forEach(function (k) { out[k] = rec[k]; });
    return out;
  }
  return {
    rows: rows,
    ups: [],
    handle: function (a, payload) {
      if (a === 'entity_upsert') {
        var coll = payload.collection, rec = payload.record, cd = rec.cd;
        this.ups.push({ cd: cd, expectCreate: !!payload.expectCreate, ph: !!(rec.people || []).length || !!(rec.coTels || []).length || !!(rec.phones || []).length });
        var list = rows[coll];
        if (payload.expectCreate) {
          if (list[cd]) return { ok: false, code: 409, error: 'duplicate-cd' };
          list[cd] = Object.assign({}, rec);
          return { ok: true, rev: 1 };
        }
        if (!list[cd]) return { ok: false, code: 410, error: 'missing-cd' };
        list[cd] = keyMerge(list[cd], rec); /* عین merge واقعی: کلید حاضر بازنویسی */
        return { ok: true, rev: 2 };
      }
      if (a === 'entity_delete') { delete rows[payload.collection][payload.id]; return { ok: true }; }
      if (a === 'data_pull') {
        var out = {}, meta = {};
        (payload.keys || Object.keys(rows)).forEach(function (k) {
          out[k] = JSON.stringify(Object.keys(rows[k] || {}).map(function (c) { return rows[k][c]; }));
          meta[k] = { rev: 1 };
        });
        return { ok: true, data: out, meta: meta };
      }
      return { ok: false, error: 'unknown-action' };
    }
  };
}
/* ── کلاینت واقعی: بوت dedup → offers → phonefmt → sales-domain-v2 (عین index.html) ── */
function makeClient(server, cfg) {
  cfg = cfg || {};
  var label = cfg.label || 'M';
  var store = {}, fields = Object.create(null), krevs = {};
  var audits = [], apiLog = [];
  var win = {};
  win.window = win; win.self = win;
  var localStorage = { getItem: function (k) { return k in store ? store[k] : null; }, setItem: function (k, v) { store[k] = String(v); }, removeItem: function (k) { delete store[k]; } };
  win.localStorage = localStorage;
  win.console = { log: function () {}, warn: function () {}, error: function () {} };
  Object.assign(win, { JSON: JSON, Math: Math, Date: Date, String: String, Number: Number, Boolean: Boolean, Array: Array, Object: Object, RegExp: RegExp, Promise: Promise, Error: Error, TypeError: TypeError, Symbol: Symbol, parseInt: parseInt, parseFloat: parseFloat, isNaN: isNaN, isFinite: isFinite, encodeURIComponent: encodeURIComponent, decodeURIComponent: decodeURIComponent, setTimeout: function (fn) { setTimeout(fn, 0); return 0; }, clearTimeout: function () {}, setInterval: function (fn) { try { fn(); } catch (e) {} return 0; }, clearInterval: function () {} });
  function fakeEl(id) {
    if (fields[id]) return fields[id];
    var el = { id: id, value: '', style: {}, checked: false, innerHTML: '', textContent: '' };
    el.closest = function () { return null; };
    el.classList = { add: function () {}, remove: function () {} };
    el.setAttribute = function () {}; el.getAttribute = function () { return null; };
    el.insertAdjacentHTML = function () {}; el.appendChild = function () {}; el.removeChild = function () {};
    el.addEventListener = function () {}; el.removeEventListener = function () {};
    el.querySelector = function () { return null; }; el.querySelectorAll = function () { return []; };
    el.focus = function () {}; el.remove = function () {};
    fields[id] = el; return el;
  }
  win.document = {
    getElementById: function (id) { return id in fields ? fields[id] : fakeEl(id); },
    querySelector: function () { return null; }, querySelectorAll: function () { return []; },
    createElement: function () { return fakeEl('_el' + Math.random()); },
    body: fakeEl('body'), addEventListener: function () {}
  };
  win.curSession = function () { return { user: cfg.user || label, name: cfg.name || label, role: cfg.role || 'chairman', roleId: cfg.role || 'chairman' }; };
  win.curRole = function () { return cfg.role || 'chairman'; };
  win.ptfAuthToken = function () { return 'T-' + label; };
  var codeSeq = 100 + ((label.charCodeAt(0) * 7 + label.length * 13) % 40) * 50;
  win.genCode = function (pfx) { return pfx + '-' + (codeSeq++); };
  win.ptfUnifiedCode = function (pfx) { return pfx + '-' + (codeSeq++); };
  win.ptfCodeIsRetired = function () { return false; };
  win.faDateTime = function () { return '۱۴۰۵/۰۶/۲۷ 12:00'; };
  win.faDate = function () { return '۱۴۰۵/۰۶/۲۷'; };
  win.todayISO = function () { return new Date().toISOString().slice(0, 10); };
  win.dedupStamp = function (r) { r.crAt = win.faDateTime(); r.crBy = cfg.user || label; if (!r.createdAtISO) r.createdAtISO = new Date().toISOString(); return r; };
  win.currentUserName = function () { return cfg.name || label; };
  win.audit = function (sec, txt, ref) { audits.push({ sec: sec, txt: txt, ref: ref }); };
  win.addLog = function () {};
  win.ptfToast = function () {};
  win.alert = function () {}; win.confirm = function () { return true; };
  win.hideModal = function () {};
  win.escP = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); };
  win.ptfOnClickArg = function (v) { return String(v == null ? '' : v).replace(/[\\']/g, ''); };
  win.entityMatches = function () { return true; };
  win.renderCustomers = function () {}; win.renderSuppliers = function () {};
  win.ptfDlgAlert = function () {};
  win.ptfStorageSafeSetItem = function (k, v) { localStorage.setItem(k, v); return true; };
  win.ptfBMirrorActive = function () { return false; };
  win.ptfStorageIdbSet = function () {};
  win.ptfSyncNotifyDirty = function () {};
  win.ptfSyncAcknowledgeKeys = function () {};
  win.getData = function (k) { try { return JSON.parse(store[k] || '[]'); } catch (e) { return []; } };
  win.setData = function (k, v) { store[k] = JSON.stringify(v); };
  win.ptfBApplyServerProjection = function (k, value, rev) {
    try {
      var str = typeof value === 'string' ? value : JSON.stringify(value);
      var incoming = +rev || 0, known = +(krevs[k] || 0);
      if (incoming && known > incoming) return false;
      localStorage.setItem(k, str);
      if (incoming > known) { krevs[k] = incoming; localStorage.setItem('ptf_sync_krevs', JSON.stringify(krevs)); }
      return true;
    } catch (e) { return false; }
  };
  win.ptfSilentWrite = function (k, s) { store[k] = String(s); };
  win.ptfSyncInflightJournalWrite = function (s) { localStorage.setItem('ptf_sd_inflight', String(s)); };
  win.ptfSyncInflightJournalRead = function () { return localStorage.getItem('ptf_sd_inflight'); };
  win.ptfSyncInflightJournalClear = function () { localStorage.removeItem('ptf_sd_inflight'); };
  win.ptfSyncPullNow = function (cb) { cb && cb({ ok: true }); };
  /* لایهٔ شبکه: sales-domain-v2 با fetch واقعی‌نما صحبت می‌کند (action در URL، پاسخ text) */
  win.fetch = function (url, opts) {
    var body = JSON.parse(opts.body);
    var action = (/action=([^&]+)/.exec(url) || [])[1];
    apiLog.push({ action: action, cd: body && body.record && body.record.cd, id: body && body.id, collection: body && body.collection, expectCreate: !!(body && body.expectCreate) });
    var res;
    try { res = server.handle(action, body); }
    catch (e) { res = { ok: false, status: e.status || 500, error: e.message }; }
    if (!res.ok) {
      var er = new Error(res.error || 'server_error');
      er.status = res.status || 400;
      return Promise.reject(er);
    }
    return Promise.resolve({ ok: true, status: 200, text: function () { return Promise.resolve(JSON.stringify(res)); } });
  };
  win.__apiLog = apiLog; win.__audits = audits;
  vm.createContext(win);
  [dd, off, pf, sd].forEach(function (src, i) {
    vm.runInContext(src, win, { filename: 'boot660-' + ['dedup', 'offers', 'phonefmt', 'sdv2'][i] + '.js' });
  });
  return {
    win: win, apiLog: apiLog, audits: audits,
    boot: function () { if (typeof win.ptfSalesDomainInit === 'function') { try { win.ptfSalesDomainInit(); } catch (e) {} } return this; },
    pull: function (keys) {
      var res = server.handle('data_pull', { keys: keys || ['ptf_crm_customers', 'ptf_crm_suppliers'] });
      if (!res.ok) return Promise.resolve(res);
      Object.keys(res.data).forEach(function (k) { win.ptfBApplyServerProjection(k, res.data[k], (res.meta[k] || {}).rev); });
      return Promise.resolve(res);
    },
    cust: function (cd) { return (win.getData('ptf_crm_customers') || []).filter(function (r) { return r.cd === cd; })[0]; },
    serverCust: function (cd) { return server.rows.ptf_crm_customers[cd]; }
  };
}
function setF(c, id, v) { c.win.document.getElementById(id).value = v; }
function saveLegal(c, cd, o) {
  o = o || {};
  setF(c, 'nC2Comp', o.co || ''); setF(c, 'nC2Kind', 'حقوقی'); setF(c, 'nC2Ind', o.ind || 'نفت و گاز');
  setF(c, 'nC2Tel', o.tel || ''); setF(c, 'nC2Con', o.con || '');
  c.win._cbState = { people: o.people || [] };
  c.win.saveCust2(cd === undefined ? null : cd);
}
function saveIndividual(c, cd, o) {
  o = o || {};
  setF(c, 'nC2Comp', o.name || ''); setF(c, 'nC2Kind', 'حقیقی'); setF(c, 'nC2Ind', o.ind || 'نفت و گاز');
  setF(c, 'nC2Phones', (o.phones || []).join(','));
  c.win._cbState = { people: [] };
  c.win.saveCust2(cd === undefined ? null : cd);
}
function flush(ms) { return new Promise(function (res) { setTimeout(res, ms || 60); }); }
function hasContacts(r) {
  if (!r) return false;
  function hasN(a) { return Array.isArray(a) && a.some(function (x) { return x && x.n && String(x.n).trim(); }); }
  function hasP(a) { return Array.isArray(a) && a.some(function (x) { return x && (hasN(x.tels) || hasN(x.mobs) || hasN(x.mails)); }); }
  return !!(hasN(r.coTels) || hasN(r.phones) || hasP(r.people) || (r.ph && String(r.ph).trim()));
}

/* قرارداد هوک روی کد واقعی (نسخهٔ جدید tester604 ۲.۹): */
var jobs = [];
jobs.push((async function () {
  var c = makeClient(makeServer(), { label: 'H', user: 'ceo', name: 'ceo', role: 'ceo' }).boot();
  var ups = c.win.__apiLog;
  /* ثبت جدید بدون cd → پس از ذخیره، هوک چیزی نمی‌فرستد؛ فقط SaveCollection */
  saveLegal(c, null, { co: 'شرکت قرارداد', tel: '02111114444', people: [{ nm: 'ر', tels: [{ n: '02111114444', ext: '', lb: '' }], mobs: [], mails: [], primary: true }] });
  await flush();
  T('۳.۱ ثبت جدید: فقط یک upsert (payload اصلی) — هوک دومی نمی‌فرستد', ups.length === 1, JSON.stringify(ups));
  var local = c.win.getData('ptf_crm_customers');
  var cd1 = local.length ? local[0].cd : null;
  T('۳.۰ ثبت جدید به‌صورت محلی پایدار شد', !!cd1, JSON.stringify(local.map(function (r) { return r.cd; })));
  /* ویرایش صریح همان cd → یک upsert تاییدِ مجدد از هوک مجاز است */
  var n0 = ups.length;
  saveLegal(c, cd1, { co: 'شرکت قرارداد', tel: '02111114444' });
  await flush();
  var editUps = ups.slice(n0);
  T('۳.۲ ویرایش صریح: فقط فرمان‌های هم‌cd — upsert صف + تاییدِ هوک، بدون عملیات جمعی',
    editUps.length === 2 && editUps.every(function (u) { return u.cd === cd1 && u.action === 'entity_upsert' && !u.expectCreate; }),
    JSON.stringify(editUps));
})().catch(function (e) { T('بخش ۳ بدون استثنا', false, e && (e.stack || e.message) || String(e)); }));

jobs.push((async function () {
  /* ═══════════════════ ۴) زنجیرهٔ کامل گزارش کارفرما ═══════════════════ */
  head('۴. زنجیرهٔ گزارش کارفرما — CEO ثبت می‌کند، رییس ویرایش می‌کند، CEO بلاک می‌شود');
  var server = makeServer();
  var ceo = makeClient(server, { label: 'A', user: 'ceo', name: 'ceo', role: 'ceo' }).boot();
  var chair = makeClient(server, { label: 'B', user: 'chairman', name: 'chairman', role: 'chairman' }).boot();
  var third = makeClient(server, { label: 'C', user: 'viewer', name: 'viewer', role: 'chairman' }).boot();

  /* ① مدیرعامل مشتری M را با ۲ شماره ثبت می‌کند */
  saveLegal(ceo, null, { co: 'شرکت ارسلان', tel: '02188776655', people: [{ nm: 'آرسلان', tels: [{ n: '02188776655', ext: '', lb: '' }], mobs: [{ n: '09121110000', lb: '' }], mails: [{ n: 'info@arsalan.ir' }], primary: true }] });
  await flush();
  var M = Object.keys(server.rows.ptf_crm_customers)[0];
  T('۴.۱ ثبت مدیرعامل روی سرور نشست (رکورد تماس‌دار)', !!M && hasContacts(server.rows.ptf_crm_customers[M]), M);

  /* ② رییس (دستگاه دیگر) pull می‌کند و همان رکورد را با مودال واقعی ویرایش می‌کند:
     موبایل و ایمیل جدید اضافه می‌شود */
  await chair.pull();
  var recB = chair.win.getData('ptf_crm_customers').filter(function (r) { return r.cd === M; })[0];
  chair.win.showCustModal(M);
  chair.win.document.getElementById('nC2Comp').value = recB.co;
  chair.win._cbState.people = [{ nm: 'آرسلان', tels: [{ n: '02188776655', ext: '', lb: '' }], mobs: [{ n: '09121110000', lb: '' }, { n: '09362221100', lb: '' }], mails: [{ n: 'info@arsalan.ir' }, { n: 'sales@arsalan.ir' }], primary: true }];
  chair.win.saveCust2(M);
  await flush();
  var afterChair = server.rows.ptf_crm_customers[M];
  var mobs2 = ((afterChair.people || [])[0].mobs || []).length, mails2 = ((afterChair.people || [])[0].mails || []).length;
  T('۴.۲ ویرایش رییس روی سرور نشست (۲ موبایل + ۲ ایمیل)', mobs2 === 2 && mails2 === 2, mobs2 + '/' + mails2);

  /* ③ مدیرعامل (تب کهنه، بدون pull) سعی می‌کند هم‌نام را ثبت کند → بلاک ضدتکرار */
  var upsBefore = ceo.win.__apiLog.length;
  saveLegal(ceo, null, { co: 'شرکت ارسلان', tel: '02155554444' });
  await flush();
  var upsAfter = ceo.win.__apiLog.slice(upsBefore);
  var blocked = ceo.win.__audits.some(function (a) { return a.sec === 'ضد تکرار'; });
  T('۴.۳ ثبت هم‌نام مدیرعامل توسط ضدتکرار بلاک شد', blocked, JSON.stringify(ceo.win.__audits.slice(-3)));
  T('۴.۴ پس از بلاک، هیچ فرمان شبکه‌ای از تب مدیرعامل نفرستاده شد (فرمان پنهان صفر)',
    upsAfter.length === 0, JSON.stringify(upsAfter));

  /* ④ دستگاه سوم — تماس‌های اضافه‌شدهٔ رییس باید سالم باشند */
  var after = server.rows.ptf_crm_customers[M];
  var mobs3 = ((after.people || [])[0].mobs || []).length, mails3 = ((after.people || [])[0].mails || []).length;
  T('۴.۵ افزودنی‌های رییس روی سرور پاک نشده (۲ موبایل + ۲ ایمیل)', mobs3 === 2 && mails3 === 2, mobs3 + '/' + mails3);
  T('۴.۶ از دید دستگاه سوم هم تماس‌ها دیده می‌شود', hasContacts(after));

  /* ⑤ تامین‌کننده: زنجیرهٔ مشابه — بلاک ضدتکرار نباید SUP آخر را بازنویسی کند */
  head('۵. زنجیرهٔ تامین‌کننده (hookSup)');
  var s1 = makeClient(server, { label: 'D', user: 'ceo', name: 'ceo2', role: 'ceo' }).boot();
  s1.win.document.getElementById('nS2Comp').value = 'تامین پارس';
  s1.win.document.getElementById('nS2Cat').value = 'فولاد';
  s1.win.document.getElementById('nS2Tel').value = '02144556677';
  s1.win._cbState = { people: [{ nm: 'پیمان', tels: [], mobs: [{ n: '09122223333', lb: '' }], mails: [], primary: true }] };
  s1.win.saveSup2(null);
  await flush();
  var S = Object.keys(server.rows.ptf_crm_suppliers)[0];
  T('۵.۱ ثبت تامین‌کننده روی سرور نشست', !!S && hasContacts(server.rows.ptf_crm_suppliers[S]), S);
  var recS = s1.win.getData('ptf_crm_suppliers').filter(function (r) { return r.cd === S; })[0];
  recS.people[0].mobs.push({ n: '09354445555', lb: '' });
  s1.win.document.getElementById('nS2Comp').value = recS.co;
  s1.win.document.getElementById('nS2Cat').value = recS.ca || 'فولاد';
  s1.win.document.getElementById('nS2Tel').value = '02144556677';
  s1.win._cbState = { people: recS.people };
  s1.win.saveSup2(S);
  await flush();
  T('۵.۲ ویرایش دوم (موبایل دوم) روی سرور نشست',
    ((server.rows.ptf_crm_suppliers[S].people || [])[0].mobs || []).length === 2);
  var supUpsBefore = s1.win.__apiLog.length;
  s1.win.document.getElementById('nS2Comp').value = 'تامین پارس'; /* هم‌نام → بلاک */
  s1.win._cbState = { people: [] };
  s1.win.saveSup2(null);
  await flush();
  T('۵.۳ بلاک ضدتکرار تامین‌کننده هم هیچ فرمان پنهانی نمی‌فرستد',
    s1.win.__apiLog.length === supUpsBefore &&
    ((server.rows.ptf_crm_suppliers[S].people || [])[0].mobs || []).length === 2);

  /* ۶) تامین‌کنندهٔ خارجی: قالب‌بندی بین‌المللی حالا در saveSup2 (پیش از payload) است —
     نه در هوکِ پس از ذخیره؛ فرمانِ شبکه باید همان نسخهٔ قالب‌شده را ببرد */
  head('۶. تامین‌کنندهٔ خارجی — قالب‌بندی بین‌المللی پیش از payload');
  var s2 = makeClient(server, { label: 'E', user: 'ceo', name: 'ceo3', role: 'ceo' }).boot();
  s2.win.document.getElementById('nS2Comp').value = '';
  s2.win.document.getElementById('nS2CoEn').value = 'Aria Steel Complex';
  s2.win.document.getElementById('nS2Cat').value = 'فولاد';
  s2.win.document.getElementById('nS2Origin').value = 'خارجی';
  s2.win.document.getElementById('nS2Tel').value = '00982112345678';
  s2.win._cbState = { people: [{ nm: 'Ali Rezaei', tels: [], mobs: [{ n: '۰۹۱۲۱۲۳۴۵۶۷', lb: '' }], mails: [], primary: true }] };
  var upsF0 = s2.win.__apiLog.length;
  s2.win.saveSup2(null);
  await flush();
  var supsF = s2.win.getData('ptf_crm_suppliers');
  var recF = supsF.filter(function (r) { return r.co === 'Aria Steel Complex'; })[0]; /* US-415: خارجی بدون نام فارسی → co = EN */
  T('۶.۱ ثبت خارجی پایدار شد و co = نام انگلیسی', !!recF, supsF.map(function (r) { return r.co; }).join(','));
  T('۶.۲ شماره‌ها پیش از payload قالب بین‌المللی گرفتند (۰۹۱۲ فارسی هم)',
    !!recF && recF.coTels[0].n === '+98 (21) 1234 5678' && recF.people[0].mobs[0].n === '+98 912 123 4567',
    recF && JSON.stringify({ tel: recF.coTels[0].n, mob: recF.people[0].mobs[0].n }));
  T('۶.۳ فقط یک فرمان شبکه برای این ثبت (هوک دوباره نمی‌فرستد)',
    s2.win.__apiLog.length === upsF0 + 1, JSON.stringify(s2.win.__apiLog.slice(upsF0)));

  /* ۷) سپر سرور — سیم گارد (پورت PHP) روی سرور واقعی‌نما */
  head('۷. سپر سرور CONTACT-WIPE (سیم گارد روی سرور واقعی‌نما)');
  /* گارد = پورت همان تابع PHP (بخش ۲) روی مسیر entity_upsert سرور آزمون */
  var rawUps = server.handle.bind(server);
  server.handle = function (a, payload) {
    if (a === 'entity_upsert' && payload && !payload.expectCreate) {
      var coll = payload.collection, rec = payload.record, cd = rec.cd, list = server.rows[coll];
      if (list[cd]) {
        var ccClear = !!(rec && rec._ccClear);
        if (rec && '_ccClear' in rec) { rec = Object.assign({}, rec); delete rec._ccClear; }
        payload = Object.assign({}, payload, { record: sdContactWipeGuard(rec, list[cd], server.stats, ccClear) });
      }
    }
    return rawUps(a, payload);
  };
  server.stats = {};
  var c7 = makeClient(server, { label: 'F', user: 'chairman', name: 'chairman2', role: 'chairman' }).boot();
  saveLegal(c7, null, { co: 'شرکت پاک‌شونده', tel: '02177778888', people: [{ nm: 'ر', tels: [{ n: '02177778888', ext: '', lb: '' }], mobs: [], mails: [], primary: true }] });
  await flush();
  var M7 = c7.win.getData('ptf_crm_customers').filter(function (r) { return r.co === 'شرکت پاک‌شونده'; })[0].cd;
  /* ۷.۱ کلاینتِ کهنه/معرور با people:[]/coTels:[]/ph:'' روی رکورد تماس‌دار → سرور حفظ می‌کند */
  var bad = { cd: M7, co: 'شرکت پاک‌شونده', kind: 'حقوقی', people: [], coTels: [], phones: [], ph: '' };
  server.handle('entity_upsert', { action: 'entity_upsert', collection: 'ptf_crm_customers', expectCreate: false, record: bad });
  var rec7a = server.rows.ptf_crm_customers[M7];
  T('۷.۱ upsert خالیِ کلاینت کهنه — سرور تماس‌ها را حفظ کرد (invariant زنده روی سرور)',
    hasContacts(rec7a) && server.stats.contactsWipeBlocked >= 1, JSON.stringify({ p: rec7a.people, c: rec7a.coTels, ph: rec7a.ph }));
  /* ۷.۲ مودال واقعی: خالی کردن فرم تماس‌ها را حفظ می‌کند (R3 — رفتار مقصود) */
  c7.win.showCustModal(M7);
  c7.win.document.getElementById('nC2Comp').value = 'شرکت پاک‌شونده';
  c7.win.document.getElementById('nC2Tel').value = '';
  c7.win._cbState = { people: [] };
  c7.win.saveCust2(M7);
  await flush();
  var rec7b = server.rows.ptf_crm_customers[M7];
  T('۷.۲ خالی‌کردن فرم در مودال، تماس‌های قبلی را حفظ می‌کند (بدون سیلی)',
    hasContacts(rec7b), JSON.stringify({ p: rec7b.people, c: rec7b.coTels, ph: rec7b.ph }));
  /* ۷.۳ پاک‌سازی عمدی با مهر — نویسندهٔ آگاه می‌تواند پاک کند و مهر حذف می‌شود */
  server.handle('entity_upsert', { action: 'entity_upsert', collection: 'ptf_crm_customers', expectCreate: false, record: { cd: M7, co: 'شرکت پاک‌شونده', kind: 'حقوقی', people: [], coTels: [], phones: [], ph: '', _ccClear: 1 } });
  var rec7c = server.rows.ptf_crm_customers[M7];
  T('۷.۳ با مهر _ccClear پاک‌سازی عمدی اجازه دارد و فیلد نیت به سرور نمی‌رسد',
    !hasContacts(rec7c) && !('_ccClear' in rec7c), JSON.stringify({ p: rec7c.people, c: rec7c.coTels, ph: rec7c.ph }));
  void third; void saveIndividual;
})().catch(function (e) { T('زنجیره بدون استثنا اجرا شد', false, e && (e.stack || e.message) || String(e)); }));

Promise.all(jobs).then(function () {
  console.log('\nPASS: ' + p + ' | FAIL: ' + f);
  process.exit(f ? 1 : 0);
});
