/* ═══════════════════════════════════════════════════════════════════════════
   tester676 — v34.39.30 (CONTACT-ROOTS — ریشه‌یابی و ریشه‌کنی «شماره‌های تماس
   مشتریان ثبت‌شده توسط کاربران پاک می‌شود و قابل مشاهده نیست» — ۱۴۰۵/۰۷/۰۱)

   ریشه‌های بازمانده پس از v34.37.7…v34.39.30 (این تستر هر کدام را با کد واقعی
   اثبات/نگهبانی می‌کند):
     R1) ptfPreserveLegalContactsAsPhones کلید dedup را با [^0-9] می‌ساخت → برای
         شماره‌های «فارسی» (نرمال‌ساز همه را فارسی ذخیره می‌کند) کلید همیشه خالی
         بود → همهٔ تماس‌های حقوقی هنگام تبدیل نوع drop و با auto-_ccClear «قانونی»
         پاک می‌شدند.
     R2) _ccBaseAt به‌جای «نسخهٔ لحظهٔ بازشدن مودال» از oldRecPre (کشِ لحظهٔ save)
         خوانده می‌شد → اگر pull وسط مودال می‌رسید، baseAt با updatedAt سرور برابر
         می‌شد → sd_contact_stale_merge مسیر «fresh edit = LWW» → شماره‌های تازهٔ
         دستگاه دیگر پاک می‌شد — دقیقاً «مالِ من سالم، مالِ او پاک».
     R3) ptfPhoneNorm برای ورودی ساختارنیافته (مثل «021 8800 داخلی 12») ارقام
         کلمات/پسوندها را به شماره می‌چسباند و برای بدون-رقم '' برمی‌گرداند (→
         ptfCustHadContacts=false → auto-_ccClear بی‌جهت).
     R4) showEntityCard: phones و people به‌صورت either/or + فقط coTels[0] →
         «اشخاص رابط» و تلفنخانه‌های دوم به‌بالا نامرئی بودند.
     R5) entityMatches شمارهها را جستجو نمی‌کرد (coTels/phones/ph غایب از haystack)
         و ارقام فارسی↔انگلیسی را fold نمی‌کرد؛ telHref ارقام فارسی را می‌ریخت →
         «شماره قابل مشاهده/یافتن/تماس نیست».
     R6) data_push (مسیرهای legacy: heal/migrate/import/fallback) کل blob را
         جایگزین می‌کرد و فقط حذف «ردیف» را می‌دید — رکوردِ بدون کلید تماس،
         شماره‌های سرور را بی‌صدا می‌پراند (قرارداد v34.8.34 «فیلد غایب = تغییر
         نکرده» باید کلیدِ غایبِ تماس را از سرور پر کند).
     R7) (v34.39.30 — جانشین R6، ادغام شاخهٔ arena/01a0cb49) flush عادی فاز B هم
         همین data_push است؛ R6 فقط کلیدِ «غایب» را پر می‌کرد و رکوردِ کهنه با کلیدِ
         «حاضر اما کهنه/خالی» شمارهٔ تازهٔ سرور را پاک می‌کرد. sync_contact_fields_fill
         با sync_contact_records_merge (api/crm.php) + api/contact-merge-lib.php
         جایگزین شد: کلید غایب پر می‌شود (R6)؛ رکورد تازه (مبنای فعلی + ویرایش
         تازه) LWW؛ مبنای کهنه/نامشخص UNION؛ _ccClear کهنه نادیده. بخش ۶ همین
         قرارداد را با پورت ۱:۱ و — اگر php در دسترس باشد (CI) — با PHP واقعی می‌سنجد.

   اجرا: node _tools/uat/tester676-v34.39.22-contact-roots.js
   ───────────────────────────────────────────────────────────────────────────── */
var fs = require('fs');
var vm = require('vm');

var failures = 0;
function T(name, cond, detail) {
  if (cond) { console.log('PASS ' + name); return true; }
  failures++;
  console.log('FAIL ' + name + (detail !== undefined && detail !== null && detail !== '' ? ' — ' + detail : ''));
  return false;
}
function head(t) { console.log('\n══ ' + t + ' ══'); }
function read(p) { return fs.readFileSync(p, 'utf8'); }

var dd = read('crm/dedup.js');
var off = read('crm/offers.js');
var pf = read('crm/phonefmt.js');
var sd = read('crm/sales-domain-v2.js');
var apiCrm = read('api/crm.php');
var cmLib = read('api/contact-merge-lib.php');   /* v34.39.30 (R7): منبع مشترک semantics اتحاد تماس */
var apiSd = read('api/sales-domain.php');
var version = JSON.parse(read('VERSION.json')).crm_version;

/* ═════════════════ ۰) قراردادهای ساختاری (قفل نتیجهٔ RCA — نشانگر v34.39.30) ═════════════════ */
head('۰. قراردادهای ساختاری ریشه‌ها');
T('۰.۱ R1: ptfPreserveLegalContactsAsPhones کلیدِ script-fold دارد (CONTACT-ROOTS R1)',
  /ptfPreserveLegalContactsAsPhones[\s\S]{0,1200}CONTACT-ROOTS R1/.test(off),
  'offers.js: کلید باید ارقام فارسی را بشمارد نه [^0-9] خالص');
T('۰.۲ R2: showCustModal لحظهٔ بازشدن مودال را capture می‌کند (CONTACT-ROOTS R2)',
  /showCustModal[\s\S]{0,500}CONTACT-ROOTS R2/.test(off) && off.indexOf('_ptfContactFormBaseAt') > -1,
  'offers.js showCustModal');
T('۰.۳ R2: saveCust2 و saveSup2 از base مودال برای _ccBaseAt می‌خوانند',
  /saveCust2[\s\S]{0,5000}_ptfContactFormBaseAt/.test(off) && /showSupModal2[\s\S]{0,500}_ptfContactFormBaseAt/.test(off),
  'offers.js');
T('۰.۴ R3: ptfPhoneNorm نگهبان ورودی ساختارنیافته (CONTACT-ROOTS R3)',
  /ptfPhoneNorm = function[\s\S]{0,900}CONTACT-ROOTS R3/.test(pf),
  'phonefmt.js');
T('۰.۵ R4: showEntityCard الگوی either/or قدیمی phones|people را ندارد (CONTACT-ROOTS R4)',
  /function showEntityCard[\s\S]{0,6000}CONTACT-ROOTS R4/.test(off) &&
  (off.split('function showEntityCard')[1] || '').split('renderCustomers2')[0].indexOf(": '<h4 style=\"margin:10px 0 8px\">👥 اشخاص رابط</h4>' + contactsCardHtml(c)") === -1,
  'offers.js showEntityCard');
T('۰.۶ R5: entityMatches haystack کامل + fold ارقام (CONTACT-ROOTS R5)',
  /entityMatches[\s\S]{0,1400}CONTACT-ROOTS R5/.test(off),
  'offers.js entityMatches');
T('۰.۷ R5: telHref ارقام فارسی را نگه می‌دارد',
  /function telHref\(t\) \{[^}]*ptfToEnDigits/.test(off),
  'offers.js telHref');
T('۰.۸ R7 (جانشین R6): api/crm.php تابع sync_contact_records_merge + کتابخانهٔ مشترک contact-merge-lib (CONTACT-ROOTS R7)',
  apiCrm.indexOf('function sync_contact_records_merge') > -1 && apiCrm.indexOf('CONTACT-ROOTS R7') > -1 &&
  apiCrm.indexOf('function sync_contact_fields_fill') === -1 &&
  /require_once __DIR__ \. '\/contact-merge-lib\.php'/.test(apiCrm) &&
  cmLib.indexOf('function cm_contact_merge_record') > -1,
  'api/crm.php + api/contact-merge-lib.php');
T('۰.۹ R7: سیم‌کشی data_push برای هر دو customers و suppliers و مستثنی restore/allow_wipe',
  /case 'data_push':[\s\S]*sync_contact_records_merge\(/.test(apiCrm) &&
  /!\$restore && !\$allow_wipe && \(\$k === 'ptf_crm_customers' \|\| \$k === 'ptf_crm_suppliers'\)[\s\S]{0,160}sync_contact_records_merge\(/.test(apiCrm),
  'api/crm.php data_push');
try {
  var parserMod = require('php-parser');
  new parserMod.Engine({ parser: { extractDoc: false, suppressErrors: false } }).parseCode(apiCrm, 'crm.php');
  T('۰.۱۰ سینتکس api/crm.php سالم (php-parser)', true);
} catch (eP) {
  if (eP && (eP.code === 'MODULE_NOT_FOUND' || String(eP.message).indexOf('Cannot find module') > -1)) {
    T('۰.۱۰ سینتکس api/crm.php سالم (php-parser در دسترس نیست — هشدار)', true);
  } else {
    T('۰.۱۰ سینتکس api/crm.php سالم (php-parser)', false, eP.message);
  }
}

/* ═════════════════ پورت ۱:۱ semantics سرور (api/sales-domain.php) ═════════════════ */
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
  if (!r || !Object.prototype.hasOwnProperty.call(r, k)) return false;
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
function sdContactDigits(v) {
  var s = String(v == null ? '' : v).trim().replace(/[۰-۹]/g, function (d) { return String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)); })
    .replace(/[٠-٩]/g, function (d) { return String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)); });
  return s.replace(/\D+/g, '');
}
function sdContactChanKey(t) {
  if (typeof t !== 'object' || t === null) {
    var d0 = sdContactDigits(t);
    return d0 !== '' ? 'n:' + d0 : 's:' + String(t == null ? '' : t).trim().toLowerCase();
  }
  var n = t.n != null ? String(t.n).trim() : '';
  if (n === '') return '';
  var d = sdContactDigits(n);
  return d !== '' ? 'n:' + d : 's:' + n.toLowerCase();
}
function sdContactMergeChanList(incoming, stored) {
  var out = [], seen = {};
  var push = function (t) {
    var k = sdContactChanKey(t);
    if (k === '' || seen[k]) return;
    seen[k] = 1; out.push(t);
  };
  (Array.isArray(incoming) ? incoming : []).forEach(push);
  (Array.isArray(stored) ? stored : []).forEach(push);
  return out;
}
function sdContactMergePeople(incoming, stored) {
  var out = [];
  var keyOf = function (p) {
    var nm = String((p && p.nm) || '').trim();
    if (nm !== '') return 'nm:' + nm.toLowerCase();
    var lists = ['tels', 'mobs', 'mails'];
    for (var L = 0; L < lists.length; L++) {
      var arr = (p && p[lists[L]] && Array.isArray(p[lists[L]])) ? p[lists[L]] : [];
      for (var j = 0; j < arr.length; j++) { var k = sdContactChanKey(arr[j]); if (k !== '') return k; }
    }
    return '';
  };
  var byKey = {}, order = [];
  var take = function (p) {
    var k = keyOf(p);
    if (k === '') { out.push(p); return; }
    if (!byKey[k]) { byKey[k] = p; order.push(k); return; }
    var cur = byKey[k];
    byKey[k] = {
      nm: cur.nm || p.nm, role: cur.role || p.role, dept: cur.dept || p.dept,
      tels: sdContactMergeChanList(p.tels, cur.tels),
      mobs: sdContactMergeChanList(p.mobs, cur.mobs),
      mails: sdContactMergeChanList(p.mails, cur.mails),
      primary: !!(cur.primary || p.primary)
    };
  };
  (Array.isArray(incoming) ? incoming : []).forEach(take);
  (Array.isArray(stored) ? stored : []).forEach(take);
  order.forEach(function (k) { out.push(byKey[k]); });
  return out;
}
function sdContactStaleMerge(row, prev) {
  /* عین sd_contact_stale_merge: پایهٔ مشتری مشخص → fresh edit (LWW)؛ وگرنه union */
  var serverAt = String((prev && (prev.updatedAt || prev.updatedAtISO)) || '');
  var hasBase = row._ccBaseAt != null && String(row._ccBaseAt) !== '';
  var clientBase = hasBase ? String(row._ccBaseAt) : ((row._ccEdit != null && row._ccEdit) ? '' : null);
  if (clientBase !== null && clientBase !== '' && serverAt !== '' && clientBase === serverAt) return row;
  var keys = ['people', 'coTels', 'phones'], anyList = false;
  keys.forEach(function (k) {
    if (!Array.isArray(row[k]) || !Array.isArray(prev[k])) return;
    anyList = true;
    row[k] = (k === 'people') ? sdContactMergePeople(row[k], prev[k]) : sdContactMergeChanList(row[k], prev[k]);
  });
  if (!anyList) {
    var rPh = String(row.ph == null ? '' : row.ph).trim();
    var pPh = String(prev.ph == null ? '' : prev.ph).trim();
    if (rPh === '' && pPh !== '') row.ph = prev.ph;
  }
  return row;
}

/* ── سرور واقعی‌نما: عین ترتیب entity_upsert در api/sales-domain.php ── */
function makeServer() {
  var rows = { ptf_crm_customers: {}, ptf_crm_suppliers: {} };
  function keyMerge(prev, rec) {
    var out = Object.assign({}, prev);
    Object.keys(rec).forEach(function (k) { out[k] = rec[k]; });
    return out;
  }
  return {
    rows: rows,
    handle: function (a, payload) {
      if (a === 'entity_upsert') {
        var coll = payload.collection, rec = payload.record, cd = rec.cd;
        var prev = rows[coll][cd] || null;
        var ccClear = !!rec._ccClear;
        var row = JSON.parse(JSON.stringify(rec));
        if (prev) row = sdContactWipeGuard(row, prev, {}, ccClear);
        var merged = prev ? keyMerge(prev, row) : row;
        if (prev) merged = sdContactStaleMerge(merged, prev);
        delete merged._ccClear; delete merged._ccEdit; delete merged._ccBaseAt;
        rows[coll][cd] = merged;
        return { ok: true, rev: 1, data: {}, result: {} };
      }
      if (a === 'data_pull') {
        var out = {}, meta = {};
        Object.keys(rows).forEach(function (k) {
          out[k] = JSON.stringify(Object.keys(rows[k]).map(function (c) { return rows[k][c]; }));
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
  Object.assign(win, { JSON: JSON, Math: Math, Date: Date, String: String, Number: Number, Boolean: Boolean, Array: Array, Object: Object, RegExp: RegExp, Promise: Promise, Error: Error, TypeError: TypeError, Symbol: Symbol, parseInt: parseInt, parseFloat: parseFloat, isNaN: isNaN, isFinite: isFinite, encodeURIComponent: encodeURIComponent, decodeURIComponent: decodeURIComponent, setTimeout: function (fn) { setTimeout(fn, 0); return 0; }, clearTimeout: function () {}, setInterval: function () { return 0; }, clearInterval: function () {} });
  function fakeEl(id) {
    if (fields[id]) return fields[id];
    var el = { id: id, value: '', style: {}, checked: false, innerHTML: '', textContent: '' };
    el.closest = function () { return null; };
    el.classList = { add: function () {}, remove: function () {} };
    el.setAttribute = function () {}; el.getAttribute = function () { return null; };
    el.insertAdjacentHTML = function (pos, html) { if (id === 'panels') { win.__lastPanelHtml = String(html); } };
    el.appendChild = function () {}; el.removeChild = function () {};
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
  win.curSession = function () { return { user: cfg.user || label, name: cfg.name || label, role: 'chairman', roleId: 'chairman' }; };
  win.curRole = function () { return 'chairman'; };
  win.ptfAuthToken = function () { return 'T-' + label; };
  var codeSeq = 500 + (label.charCodeAt(0) % 20) * 7;
  win.genCode = function (pfx) { return pfx + '-' + (codeSeq++); };
  win.ptfUnifiedCode = function (pfx) { return pfx + '-' + (codeSeq++); };
  win.ptfCodeIsRetired = function () { return false; };
  win.faDateTime = function () { return '۱۴۰۵/۰۷/۰۱ 10:00'; };
  win.faDate = function () { return '۱۴۰۵/۰۷/۰۱'; };
  win.todayISO = function () { return new Date().toISOString().slice(0, 10); };
  win.dedupStamp = function (r) { r.crAt = win.faDateTime(); r.crBy = cfg.user || label; if (!r.createdAtISO) r.createdAtISO = new Date().toISOString(); return r; };
  win.currentUserName = function () { return cfg.name || label; };
  win.audit = function (sec, txt, ref) { audits.push({ sec: sec, txt: txt, ref: ref }); };
  win.addLog = function () {};
  win.ptfToast = function () {};
  win.alert = function () {}; win.confirm = function () { return true; };
  win.hideModal = function () {}; win.showModal = function () {};
  win.escP = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); };
  win.ptfOnClickArg = function (v) { return String(v == null ? '' : v).replace(/[\\']/g, ''); };
  win.renderCustomers = function () {}; win.renderSuppliers = function () {};
  win.ptfDlgAlert = function () {};
  win.ptfStorageSafeSetItem = function (k, v) { localStorage.setItem(k, v); return true; };
  win.ptfBMirrorActive = function () { return false; };
  win.ptfStorageIdbSet = function () {};
  win.ptfSyncNotifyDirty = function () {};
  win.ptfSyncAcknowledgeKeys = function () {};
  win.ptfEntityFiles = function () { return []; };
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
  win.fetch = function (url, opts) {
    var body = JSON.parse(opts.body);
    var action = (/action=([^&]+)/.exec(url) || [])[1];
    apiLog.push({ action: action, rec: body && body.record });
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
    vm.runInContext(src, win, { filename: 'boot676-' + ['dedup', 'offers', 'phonefmt', 'sdv2'][i] + '.js' });
  });
  return {
    win: win, apiLog: apiLog, audits: audits,
    boot: function () { if (typeof win.ptfSalesDomainInit === 'function') { try { win.ptfSalesDomainInit(); } catch (e) {} } return this; },
    pull: function (keys) {
      var res = server.handle('data_pull', { keys: keys || ['ptf_crm_customers', 'ptf_crm_suppliers'] });
      if (!res.ok) return res;
      Object.keys(res.data).forEach(function (k) { win.ptfBApplyServerProjection(k, res.data[k], (res.meta[k] || {}).rev); });
      return res;
    },
    cust: function (cd) { return (win.getData('ptf_crm_customers') || []).filter(function (r) { return r.cd === cd; })[0]; },
    serverCust: function (cd) { return server.rows.ptf_crm_customers[cd]; }
  };
}
function setF(c, id, v) { c.win.document.getElementById(id).value = v; }
function openCustModal(c, cd) {
  c.win.showCustModal(cd);
  var r = c.cust(cd) || {};
  setF(c, 'nC2Comp', r.co || ''); setF(c, 'nC2CoEn', r.coEn || '');
  setF(c, 'nC2Nat', r.natId || ''); setF(c, 'nC2Melli', r.melli || '');
  setF(c, 'nC2Kind', r.kind || 'حقوقی'); setF(c, 'nC2Ind', r.ind || 'نفت و گاز');
  setF(c, 'nC2Area', r.area || ''); setF(c, 'nC2Ref', r.ref || '');
  setF(c, 'nC2Web', r.coWeb || ''); setF(c, 'nC2Email', r.coEmail || '');
  setF(c, 'nC2Addr', r.coAddr || ''); setF(c, 'nC2Desc', r.coDesc || '');
  setF(c, 'nC2Tel', ((r.coTels || [])[0] || {}).n || '');
  setF(c, 'nC2Con', r.con || '');
}
function flush(ms) { return new Promise(function (res) { setTimeout(res, ms || 40); }); }
function hasNum(list, wantDigits) {
  return (list || []).some(function (x) {
    var n = String((x && typeof x === 'object' && x.n != null) ? x.n : (typeof x === 'string' ? x : ''));
    return sdContactDigits(n) === wantDigits;
  });
}
function recHasNums(rec, wantDigits) {
  if (!rec) return false;
  return hasNum(rec.phones, wantDigits) || hasNum(rec.coTels, wantDigits) ||
    (rec.people || []).some(function (p) { return hasNum(p.tels, wantDigits) || hasNum(p.mobs, wantDigits); }) ||
    sdContactDigits(rec.ph || '') === wantDigits;
}

/* ═════════════ پورت ۱:۱ R7: api/contact-merge-lib.php + sync_contact_records_merge (api/crm.php) ═════════════
   جانشین پورت R6 (sync_contact_fields_fill — در v34.39.30 حذف شد). semantics عیناً PHP:
   `??` فقط روی null/غایب عبور می‌کند، empty() PHP، کپیِ مقداریِ آرایه‌ها. */
function phpHas(o, k) { return !!o && typeof o === 'object' && Object.prototype.hasOwnProperty.call(o, k); }
function phpIsArr(v) { return !!v && typeof v === 'object'; }                 /* is_array — لیست یا نگاشت */
function phpEmpty(v) {
  if (v == null || v === false || v === 0 || v === '' || v === '0') return true;
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === 'object') return Object.keys(v).length === 0;
  return false;
}
function phpTrim(v) { return String(v == null ? '' : v).replace(/^[ \t\n\r\0\x0B]+|[ \t\n\r\0\x0B]+$/g, ''); }
function phpCoalesce(o, keys) { for (var i = 0; i < keys.length; i++) if (phpHas(o, keys[i]) && o[keys[i]] != null) return o[keys[i]]; return ''; }
function clone(v) { return JSON.parse(JSON.stringify(v)); }
var cmContactDigits = sdContactDigits;                                        /* cm_contact_digits ≡ sd_contact_digits (عین منتقل‌شده) */
var cmContactValEmpty = sdContactValEmpty;                                    /* cm_contact_val_empty ≡ sd_contact_val_empty */
function cmContactChanKey(t) {
  if (!phpIsArr(t)) {
    var d0 = cmContactDigits(t);
    return d0 !== '' ? 'n:' + d0 : 's:' + phpTrim(t).toLowerCase();
  }
  var n = (phpHas(t, 'n') && t.n != null) ? phpTrim(t.n) : '';
  if (n === '') return '';
  var d = cmContactDigits(n);
  return d !== '' ? 'n:' + d : 's:' + n.toLowerCase();
}
function cmContactMergeChanList(incoming, stored) {
  var out = [], seen = {};
  function push(t) {
    if (!phpIsArr(t) && typeof t !== 'string') return;
    if (typeof t === 'string') t = { n: t };
    var k = cmContactChanKey(t);
    if (k === '' || phpHas(seen, k)) return;
    seen[k] = 1; out.push(t);
  }
  if (phpIsArr(incoming)) Object.keys(incoming).forEach(function (i) { push(incoming[i]); });
  if (phpIsArr(stored)) Object.keys(stored).forEach(function (i) { push(stored[i]); });
  return out;
}
function cmContactPersonKey(p) {
  var nm = phpTrim(phpCoalesce(p, ['nm'])).toLowerCase();
  if (nm !== '') return 'nm:' + nm;
  var bits = {};
  ['tels', 'mobs', 'mails'].forEach(function (ch) {
    if (!phpHas(p, ch) || !phpIsArr(p[ch])) return;
    Object.keys(p[ch]).forEach(function (i) { var k = cmContactChanKey(p[ch][i]); if (k !== '') bits[k] = 1; });
  });
  var keys = Object.keys(bits);
  if (!keys.length) return '';
  keys.sort();
  return 'ch:' + keys.join('|');
}
function cmContactMergePeople(incoming, stored) {
  var out = [], byKey = {};
  function ingest(p, isIncoming) {
    if (!phpIsArr(p)) return;
    var k = cmContactPersonKey(p);
    if (k === '') { if (isIncoming) out.push(p); return; }
    if (!phpHas(byKey, k)) { byKey[k] = out.length; out.push(p); return; }
    var idx = byKey[k];
    var base = clone(out[idx]);
    ['tels', 'mobs', 'mails'].forEach(function (ch) {
      base[ch] = cmContactMergeChanList(phpHas(base, ch) && base[ch] != null ? base[ch] : [], phpHas(p, ch) && p[ch] != null ? p[ch] : []);
    });
    ['nm', 'nmEn', 'role', 'dept', 'note', 'src'].forEach(function (f) {
      var bv = phpTrim(phpCoalesce(base, [f])), pv = phpTrim(phpCoalesce(p, [f]));
      if (bv === '' && pv !== '') base[f] = p[f];
    });
    if (phpEmpty(base.primary) && !phpEmpty(p.primary)) base.primary = true;
    out[idx] = base;
  }
  if (phpIsArr(incoming)) Object.keys(incoming).forEach(function (i) { ingest(incoming[i], true); });
  if (phpIsArr(stored)) Object.keys(stored).forEach(function (i) { ingest(stored[i], false); });
  return out;
}
function cmContactRecordBaseIsCurrent(inRec, srvRec) {
  var srvAt = phpTrim(phpCoalesce(srvRec, ['updatedAt', 'updatedAtISO']));
  if (srvAt === '') return true;
  var inBase = phpTrim(phpCoalesce(inRec, ['updatedAt']));
  if (inBase === '') return false;
  return inBase === srvAt;
}
function cmContactMergeRecord(inRec, srvRec, stats, ccClear, fresh) {
  inRec = clone(inRec);
  ['_ccClear', '_ccBaseAt'].forEach(function (mk) { if (phpHas(inRec, mk)) delete inRec[mk]; });
  var isFresh = fresh && cmContactRecordBaseIsCurrent(inRec, srvRec);
  if (ccClear && isFresh) return inRec;
  if (isFresh) return inRec;
  var changed = false;
  ['people', 'coTels', 'phones', 'ph'].forEach(function (fk) {
    if (!phpHas(inRec, fk)) {
      if (phpHas(srvRec, fk) && !cmContactValEmpty(srvRec[fk])) { inRec[fk] = srvRec[fk]; changed = true; }
      return;
    }
    if (fk === 'people') {
      var prevP = phpIsArr(srvRec.people) ? srvRec.people : [];
      var curP = phpIsArr(inRec.people) ? inRec.people : [];
      if (!phpEmpty(prevP)) {
        var merged = cmContactMergePeople(curP, prevP);
        if (JSON.stringify(merged) !== JSON.stringify(curP)) { inRec.people = merged; changed = true; }
      }
    } else if (fk === 'ph') {
      var inPh = typeof inRec.ph === 'string' ? phpTrim(inRec.ph) : '';
      var pvPh = (phpHas(srvRec, 'ph') && typeof srvRec.ph === 'string') ? phpTrim(srvRec.ph) : '';
      if (inPh === '' && pvPh !== '') { inRec.ph = srvRec.ph; changed = true; }
    } else {
      var prevV = phpIsArr(srvRec[fk]) ? srvRec[fk] : [];
      var curV = phpIsArr(inRec[fk]) ? inRec[fk] : [];
      if (!phpEmpty(prevV)) {
        var mergedV = cmContactMergeChanList(curV, prevV);
        if (JSON.stringify(mergedV) !== JSON.stringify(curV)) { inRec[fk] = mergedV; changed = true; }
      }
    }
  });
  if (ccClear && stats) stats.staleClearIgnored = (stats.staleClearIgnored || 0) + 1;
  if (changed && stats) stats.staleRecordsMerged = (stats.staleRecordsMerged || 0) + 1;
  return inRec;
}
function syncRecordIdForKeyJs(key, r) {
  if (!phpIsArr(r)) return '';
  if (key === 'ptf_crm_offers') return phpTrim(phpCoalesce(r, ['no', 'cd', 'id']));
  return phpTrim(phpCoalesce(r, ['_id', 'cd', 'no', 'id', 'code', 'invoiceCd']));
}
function syncContactRecordsMergeJs(incomingJson, serverJson) {
  var inc, srv;
  try { inc = JSON.parse(String(incomingJson)); srv = JSON.parse(String(serverJson)); } catch (e) { return null; }
  if (!phpIsArr(inc) || !phpIsArr(srv) || phpEmpty(inc) || phpEmpty(srv)) return null;
  var srvById = {};
  Object.keys(srv).forEach(function (i) {
    var r = srv[i];
    if (!phpIsArr(r)) return;
    var id = syncRecordIdForKeyJs('', r);
    if (id !== '') srvById[id] = r;
  });
  var changed = false, stats = {};
  Object.keys(inc).forEach(function (i) {
    var r = inc[i];
    if (!phpIsArr(r)) return;
    var id = syncRecordIdForKeyJs('', r);
    if (id === '' || !phpHas(srvById, id)) return;
    var srvRec = srvById[id];
    var ccClear = !phpEmpty(r._ccClear);
    var inAt = phpTrim(phpCoalesce(r, ['updatedAtISO']));
    var srvAt = phpTrim(phpCoalesce(srvRec, ['updatedAt', 'updatedAtISO']));
    var fresh = inAt !== '' && srvAt !== '' && inAt > srvAt;                  /* strcmp > 0 (ISO — ASCII) */
    var merged = cmContactMergeRecord(r, srvRec, stats, ccClear, fresh);
    if (JSON.stringify(merged) !== JSON.stringify(r)) { inc[i] = merged; changed = true; }
  });
  if (!changed) return null;
  return JSON.stringify(inc);
}

/* ═══════════════════════════ اصل تست (async) ═══════════════════════════ */
(async function () {

  /* ── ۱) R1 — تبدیل حقوقی→حقیقی، سقوط تماس‌های فارسی + auto-_ccClear ── */
  head('۱. R1: تبدیل نوع (حقوقی→حقیقی) نباید تماس‌های ارقام-فارسی را بپراند');
  var server1 = makeServer();
  var A1 = makeClient(server1, { label: 'A1' }).boot();
  setF(A1, 'nC2Comp', 'شرکت حقوقی ریشه'); setF(A1, 'nC2Kind', 'حقوقی'); setF(A1, 'nC2Ind', 'نفت و گاز');
  setF(A1, 'nC2Tel', '0218800'); setF(A1, 'nC2Con', 'آقای رابط');
  A1.win._cbState = { people: [{ nm: 'آقای رابط', role: 'خرید', tels: [{ n: '0211234567', ext: '', lb: 'دفتر' }], mobs: [], mails: [], primary: true }] };
  A1.win.saveCust2(null);
  await flush();
  var created = (A1.win.getData('ptf_crm_customers') || [])[0];
  var cd1 = created && created.cd;
  T('۱.۱ مشتری حقوقی با تلفنخانه و رابط ساخته شد', !!cd1 && recHasNums(created, '0218800') && recHasNums(created, '0211234567'), JSON.stringify(created));
  T('۱.۲ نرمال‌ساز ذخیره را فارسی می‌کند (مبنای ریشه‌یابی)',
    hasNum(created.coTels, '0218800') && /[۰-۹]/.test(created.coTels[0].n), JSON.stringify(created.coTels));
  openCustModal(A1, cd1);
  setF(A1, 'nC2Kind', 'حقیقی');
  A1.win.saveCust2(cd1);
  await flush();
  var rec1 = A1.serverCust(cd1);
  T('۱.۳ پس از تبدیل نوع، تلفنخانه (ارقام فارسی) به phones منتقل می‌شود — نه پاک',
    recHasNums(rec1, '0218800'), JSON.stringify(rec1));
  T('۱.۴ شمارهٔ رابط (people) هم منتقل می‌شود — نه پاک',
    recHasNums(rec1, '0211234567'), JSON.stringify(rec1));
  var ups1 = A1.apiLog.filter(function (x) { return x.action === 'entity_upsert'; });
  T('۱.۵ هیچ payloadی از این جریان، auto-_ccClear ندارد (پاک‌سازیِ قانونی‌شده ممنوع)',
    ups1.every(function (x) { return !(x.rec && x.rec._ccClear); }), JSON.stringify(ups1.map(function (x) { return x.rec && x.rec._ccClear; })));

  /* ── ۲) R2 — مودال کهنه: «مالِ من سالم، مالِ او پاک» نشود ── */
  head('۲. R2: ذخیرهٔ مودالِ کهنه نباید شمارهٔ تازهٔ دستگاه دیگر را پاک کند');
  var server2 = makeServer();
  var A2 = makeClient(server2, { label: 'A2' }).boot();
  var B2 = makeClient(server2, { label: 'B2' }).boot();
  setF(A2, 'nC2Comp', 'شرکت ریشه'); setF(A2, 'nC2Kind', 'حقوقی'); setF(A2, 'nC2Ind', 'نفت و گاز');
  setF(A2, 'nC2Tel', '02133445566'); setF(A2, 'nC2Con', '');
  A2.win._cbState = { people: [] };
  A2.win.saveCust2(null);
  await flush();
  var cd2 = (A2.win.getData('ptf_crm_customers') || [])[0].cd;
  A2.pull(); B2.pull();
  openCustModal(A2, cd2);
  T('۲.۱ بازشدن مودال، base لحظهٔ باز شدن را capture می‌کند (ریشهٔ R2)',
    String(A2.win._ptfContactFormBaseAt || '') !== '', String(A2.win._ptfContactFormBaseAt || '—'));
  /* وسط مودال A: B شمارهٔ P2 (شخص/موبایل) ثبت می‌کند */
  openCustModal(B2, cd2);
  B2.win._cbState = { people: [{ nm: 'نفر دوم', role: 'خرید', tels: [], mobs: [{ n: '09125550001', ext: '', lb: 'همراه' }], mails: [], primary: false }] };
  B2.win.saveCust2(cd2);
  await flush();
  T('۲.۲ شمارهٔ B (P2) روی سرور ثبت شد', recHasNums(server2.rows.ptf_crm_customers[cd2], '09125550001'),
    JSON.stringify(server2.rows.ptf_crm_customers[cd2]));
  /* pull وسط مودال A — کش A تازه ولی فرم مودال هنوز وضعیت قدیمی */
  A2.pull();
  T('۲.۳ کش A با pull تازه شد ولی فرم مودال هنوز P1 دارد (شبیه‌سازی دقیق میدانی)',
    recHasNums(A2.cust(cd2), '09125550001') && !hasNum(A2.win.indivPhonesCollect(), '09125550001'),
    JSON.stringify(A2.win.indivPhonesCollect()));
  A2.win.saveCust2(cd2);
  await flush();
  var rec2 = server2.rows.ptf_crm_customers[cd2];
  T('۲.۴ ★ شمارهٔ B پس از ذخیرهٔ مودالِ کهنهٔ A پاک نشده (مالِ من سالم، مالِ او هم سالم)',
    recHasNums(rec2, '09125550001'), JSON.stringify(rec2));
  T('۲.۵ شمارهٔ خودِ A هم سالم است', recHasNums(rec2, '02133445566'), JSON.stringify(rec2));

  /* ── ۳) R3 — ptfPhoneNorm ویرانگر نباشد ── */
  head('۳. R3: نرمال‌ساز شماره هرگز اطلاعات را نابود/به‌هم‌نچسباند');
  var A3 = makeClient(makeServer(), { label: 'A3' }).boot();
  var P = A3.win.ptfPhoneNorm;
  T('۳.۱ «021 8800 داخلی 12» دست‌نخورده می‌ماند (ارقام داخلی به شماره نمی‌چسبد)',
    P('021 8800 داخلی 12') === '021 8800 داخلی 12', P('021 8800 داخلی 12'));
  T('۳.۲ «تماس بگیرید» تهی نمی‌شود (بدون-رقم → متن اصلی)',
    P('تماس بگیرید') === 'تماس بگیرید', JSON.stringify(P('تماس بگیرید')));
  T('۳.۳ شمارهٔ تمیز همچنان نرمال می‌شود (رگرسیون منفی نداریم)',
    P('0912-123 4567') !== '' && /۰۹۱۲|0912/.test(String(P('0912-123 4567'))), P('0912-123 4567'));
  T('۳.۴ قرارداد نرمال‌سازی حفظ است: fa ملیِ فارسی، en بین‌المللیِ خوانا',
    P('+989121234567') === '۰۹۱۲۱۲۳۴۵۶۷' && P('+989121234567', 'en') === '+98 912 123 4567',
    'fa=' + P('+989121234567') + ' en=' + P('+989121234567', 'en'));

  /* ── ۴) R4 — کارت: همهٔ تماس‌ها دیده شوند ── */
  head('۴. R4: showEntityCard تلفنخانهٔ دوم + اشخاص رابط + تلفن شخص را هم‌زمان نشان دهد');
  var A4 = makeClient(makeServer(), { label: 'A4' }).boot();
  A4.win.setData('ptf_crm_customers', [{
    cd: 'CUST-R4', co: 'شرکت همه‌چیز', kind: 'حقوقی',
    coTels: [{ n: '۰۲۱۱۱۱', ext: '', lb: 'تلفنخانه' }, { n: '۰۲۱۲۲۲', ext: '', lb: 'فروش' }],
    phones: [{ n: '۰۹۱۲۰۰۰', ext: '', lb: 'شخصی' }],
    people: [{ nm: 'رضا رابط', role: 'فنی', tels: [{ n: '۰۲۱۳۳۳', ext: '', lb: '' }], mobs: [], mails: [], primary: true }]
  }]);
  A4.win.__lastPanelHtml = '';
  A4.win.showEntityCard('ptf_crm_customers', 'CUST-R4');
  var h4 = A4.win.__lastPanelHtml || '';
  T('۴.۱ تلفنخانهٔ دوم (coTels[1]) نمایش داده می‌شود', h4.indexOf('۰۲۱۲۲۲') > -1, h4.slice(0, 300));
  T('۴.۲ بخش «تلفن‌های شخص» هست', h4.indexOf('تلفن‌های شخص') > -1 && h4.indexOf('۰۹۱۲۰۰۰') > -1);
  T('۴.۳ بخش «اشخاص رابط» هم هست (either/or قدیمی حذف شده)',
    h4.indexOf('اشخاص رابط') > -1 && h4.indexOf('رضا رابط') > -1, h4.slice(0, 500));

  /* ── ۵) R5 — جستجو و تماس با شماره ── */
  head('۵. R5: جستجوی شماره (فارسی/انگلیسی) و کلیک-به-تماس');
  var A5 = makeClient(makeServer(), { label: 'A5' }).boot();
  var ent5 = {
    cd: 'CUST-R5', co: 'شرکت جستجو',
    coTels: [{ n: '۰۲۱۸۸۰۰۱۱', ext: '', lb: '' }],
    phones: [{ n: '۰۹۱۲۹۹۹۸۸۷۷', ext: '', lb: '' }],
    people: [{ nm: 'کاوه', role: '', tels: [{ n: '۰۲۱۷۷۷۶۶۵۵', ext: '', lb: '' }], mobs: [], mails: [] }]
  };
  T('۵.۱ جستجوی شمارهٔ تلفنخانه با ارقام انگلیسی می‌یابد', A5.win.entityMatches(ent5, '021880011'));
  T('۵.۲ جستجوی شمارهٔ شخص (phones) می‌یابد', A5.win.entityMatches(ent5, '09129998877'));
  T('۵.۳ جستجوی شمارهٔ رابط می‌یابد', A5.win.entityMatches(ent5, '0217776655'));
  T('۵.۴ جستجوی ارقام فارسی هم می‌یابد', A5.win.entityMatches(ent5, '۰۲۱۸۸۰۰۱۱'));
  T('۵.۵ جستجوی نام همچنان کار می‌کند', A5.win.entityMatches(ent5, 'جستجو'));
  T('۵.۶ telHref ارقام فارسی → لینک تماس سالم',
    A5.win.telHref({ n: '۰۹۱۲۹۹۹۸۸۷۷', ext: '' }) === 'tel:09129998877', A5.win.telHref({ n: '۰۹۱۲۹۹۹۸۸۷۷', ext: '' }));

  /* ── ۶) R6→R7 — اتحاد رکوردبه‌رکوردِ فیلدهای تماس در data_push (v34.39.30) ──
     R6 (sync_contact_fields_fill) فقط کلیدِ غایب را پر می‌کرد؛ R7 جانشین آن است و
     R6 را به‌عنوان قاعدهٔ ۱ در خود دارد. تنها قراردادی که عمداً عوض شد ۶.۲ است:
     «کلیدِ حاضرِ خالی» دیگر به‌خودیِ خود نیت پاک‌سازی نیست — فقط رکوردِ «تازه»
     (مبنای فعلیِ سرور + ویرایش تازه) می‌تواند پاک کند (۶.۹). */
  head('۶. R7 (جانشین R6): اتحاد رکوردبه‌رکوردِ فیلدهای تماس در data_push');
  var R7CASES = [];
  function M7(incArr, srvJson) {
    var incJson = JSON.stringify(incArr);
    R7CASES.push([incJson, srvJson]);
    var out = syncContactRecordsMergeJs(incJson, srvJson);
    return out === null ? null : JSON.parse(out);
  }
  var srv6 = JSON.stringify([{ cd: 'CUST-1', co: 'x', people: [{ nm: 'رابط', tels: [{ n: '۰۲۱۱' }], mobs: [], mails: [] }], coTels: [{ n: '۰۲۱۲' }], phones: [], ph: '' }]);
  var out61 = M7([{ cd: 'CUST-1', co: 'x-heal', ind: 'آب', venSt: 'unreg' }], srv6);
  T('۶.۱ stub بی‌کلید (heal) → کلیدهای تماس از سرور پر می‌شود (قاعدهٔ R6 درون R7)',
    out61 !== null && out61[0].coTels[0].n === '۰۲۱۲' && out61[0].people[0].nm === 'رابط' && out61[0].co === 'x-heal', JSON.stringify(out61));
  var out62 = M7([{ cd: 'CUST-1', co: 'x', people: [], coTels: [] }], srv6);
  T('۶.۲ R7: کلیدِ حاضرِ خالی روی رکوردِ بی‌مبنا/کهنه شمارهٔ سرور را نمی‌شوید — UNION (جایگزین قرارداد R6 «کلید حاضر همیشه محترم»)',
    out62 !== null && out62[0].coTels.length === 1 && out62[0].coTels[0].n === '۰۲۱۲' && out62[0].people.length === 1 && out62[0].people[0].nm === 'رابط', JSON.stringify(out62));
  var out63 = M7([{ cd: 'CUST-NEW', co: 'نو' }], srv6);
  T('۶.۳ رکورد جدید (غایب روی سرور) دست‌نخورده', out63 === null, JSON.stringify(out63));
  var out64 = M7([{ cd: 'CUST-1', co: 'x', ph: '۰۲۱۹' }], srv6);
  T('۶.۴ کلیدهای غایب پر می‌شوند؛ مقدارِ حاضرِ غیرخالی از ورودی می‌آید',
    out64 !== null && out64[0].ph === '۰۲۱۹' && out64[0].coTels[0].n === '۰۲۱۲' && out64[0].people[0].nm === 'رابط', JSON.stringify(out64));
  T('۶.۵ سیم‌کشی: data_push هر دو مجموعه customers و suppliers را با sync_contact_records_merge اتحاد می‌دهد',
    /case 'data_push':[\s\S]*sync_contact_records_merge\(/.test(apiCrm) && /ptf_crm_customers' \|\| \$k === 'ptf_crm_suppliers/.test(apiCrm),
    'api/crm.php');
  T('۶.۶ restore/allow_wipe اتحاد نمی‌گیرند (جایگزینی مجاز)',
    /!\$restore && !\$allow_wipe && \(\$k === 'ptf_crm_customers'[\s\S]{0,160}sync_contact_records_merge\(/.test(apiCrm),
    'api/crm.php');
  T('۶.۷ فهرست فیلدهای تماس در کتابخانهٔ مشترک + مسیر entity_upsert (sales-domain.php) روی همان کتابخانه alias شده',
    cmLib.indexOf("['people', 'coTels', 'phones', 'ph']") > -1 &&
    /require_once __DIR__ \. '\/contact-merge-lib\.php'/.test(apiSd) &&
    /function sd_contact_merge_people\([^)]*\)[^{]*\{\s*return cm_contact_merge_people\(/.test(apiSd),
    'api/contact-merge-lib.php + api/sales-domain.php');

  /* صحنهٔ دقیق گزارش (RCA R7 / S1): شماره روی دستگاه دیگر دوباره ثبت شد؛ blob کهنهٔ این
     دستگاه (مبنای قدیمی، ولی updatedAtISO تازه از ویرایشی دیگر) آن شماره را ندارد. */
  var srvS1 = JSON.stringify([{ cd: 'CUST-7', co: 'شرکت هفت', updatedAt: '2026-09-24T10:00:00.000Z',
    people: [{ nm: 'مهندس رابط', tels: [{ n: '۰۲۱۴۴۴۴' }, { n: '۰۹۱۲۷۷۷۶۶۵۵', lb: 'دوباره ثبت‌شده' }], mobs: [], mails: [] }], coTels: [], phones: [], ph: '' }]);
  var out68 = M7([{ cd: 'CUST-7', co: 'شرکت هفت (ویرایش)', updatedAt: '2026-09-20T08:00:00.000Z', updatedAtISO: '2026-09-24T11:00:00.000Z',
    people: [{ nm: 'مهندس رابط', tels: [{ n: '۰۲۱۴۴۴۴' }], mobs: [], mails: [] }], coTels: [], phones: [], ph: '' }], srvS1);
  T('۶.۸ ★ R7-S1: blob کهنه بدون شمارهٔ دوباره‌ثبت‌شده → شمارهٔ سرور حفظ می‌شود و ویرایش غیرتماسی هم می‌ماند',
    out68 !== null && recHasNums(out68[0], '09127776655') && recHasNums(out68[0], '0214444') &&
    out68[0].people.length === 1 && out68[0].people[0].tels.length === 2 && out68[0].co === 'شرکت هفت (ویرایش)', JSON.stringify(out68));

  var srvF = JSON.stringify([{ cd: 'CUST-8', co: 'y', updatedAt: '2026-09-24T10:00:00.000Z',
    people: [{ nm: 'رابط', tels: [{ n: '۰۲۱۵' }], mobs: [], mails: [] }], coTels: [{ n: '۰۲۱۶' }], phones: [], ph: '' }]);
  var out69 = M7([{ cd: 'CUST-8', co: 'y', updatedAt: '2026-09-24T10:00:00.000Z', updatedAtISO: '2026-09-24T12:00:00.000Z',
    _ccClear: 1, _ccBaseAt: '2026-09-24T10:00:00.000Z', people: [], coTels: [], phones: [], ph: '' }], srvF);
  T('۶.۹ رکورد تازه (مبنای فعلی + ویرایش تازه) + _ccClear → LWW: پاک‌سازی آگاهانه محترم است و مهرها برداشته می‌شوند',
    out69 !== null && out69[0].people.length === 0 && out69[0].coTels.length === 0 &&
    !Object.prototype.hasOwnProperty.call(out69[0], '_ccClear') && !Object.prototype.hasOwnProperty.call(out69[0], '_ccBaseAt'), JSON.stringify(out69));
  var out610 = M7([{ cd: 'CUST-8', co: 'y', updatedAt: '2026-09-20T08:00:00.000Z', updatedAtISO: '2026-09-24T12:00:00.000Z',
    _ccClear: 1, people: [], coTels: [] }], srvF);
  T('۶.۱۰ _ccClear روی مبنای کهنه نادیده گرفته می‌شود (UNION) و مهر پیش از ذخیره برداشته می‌شود',
    out610 !== null && recHasNums(out610[0], '0215') && recHasNums(out610[0], '0216') &&
    !Object.prototype.hasOwnProperty.call(out610[0], '_ccClear'), JSON.stringify(out610));
  var out611 = M7([{ cd: 'CUST-8', co: 'y', updatedAt: '2026-09-24T10:00:00.000Z', updatedAtISO: '2026-09-24T12:00:00.000Z',
    people: [{ nm: 'رابط', tels: [{ n: '۰۲۱۵' }], mobs: [], mails: [] }], coTels: [{ n: '۰۲۱۷' }], phones: [], ph: '' }], srvF);
  T('۶.۱۱ رکورد تازه بدون مهر → LWW: ورودی بی‌تغییر ذخیره می‌شود (جایگزینی ۰۲۱۶ با ۰۲۱۷ محترم است)', out611 === null, JSON.stringify(out611));
  var out612 = M7([{ cd: 'CUST-8', co: 'y', coTels: [{ n: '0216' }] }], srvF);
  T('۶.۱۲ UNION با تطبیق ارقام فارسی/انگلیسی: شمارهٔ هم‌ارز تکرار نمی‌شود؛ کلید غایب پر می‌شود',
    out612 !== null && out612[0].coTels.length === 1 && out612[0].coTels[0].n === '0216' && out612[0].people[0].nm === 'رابط', JSON.stringify(out612));

  /* ── هم‌سنجی پورت JS با PHP واقعی (sync_contact_records_merge + contact-merge-lib) ──
     فقط اگر php با mbstring در دسترس باشد (GitHub Actions)؛ وگرنه skip با هشدار. */
  var cp6 = require('child_process'), path6 = require('path');
  var phpProbe = cp6.spawnSync('php', ['-r', 'echo function_exists("mb_strtolower") ? "ok" : "no-mbstring";'], { encoding: 'utf8' });
  if (phpProbe.error || phpProbe.status !== 0 || String(phpProbe.stdout || '').trim() !== 'ok') {
    T('۶.۱۳ هم‌سنجی با PHP واقعی — php/mbstring در دسترس نیست (skip؛ روی CI اجرا می‌شود)', true);
  } else {
    var phpFnSrc = function (src, name) {
      var at = src.indexOf('\nfunction ' + name + '(');
      if (at < 0) return '';
      var endAt = src.indexOf('\n}\n', at);
      return endAt < 0 ? '' : src.slice(at + 1, endAt + 2);
    };
    var fnRecId = phpFnSrc(apiCrm, 'sync_record_id_for_key'), fnMerge = phpFnSrc(apiCrm, 'sync_contact_records_merge');
    var libPath = path6.resolve('api/contact-merge-lib.php').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    var phpCode = "require '" + libPath + "';\n" + fnRecId + '\n' + fnMerge + '\n' +
      "$cases = json_decode(base64_decode('" + Buffer.from(JSON.stringify(R7CASES), 'utf8').toString('base64') + "'), true);\n" +
      '$out = [];\n' +
      'foreach ($cases as $c) { $r = sync_contact_records_merge($c[0], $c[1]); $out[] = ($r === null) ? null : json_decode($r, true); }\n' +
      'echo json_encode($out, JSON_UNESCAPED_UNICODE);';
    var run6 = cp6.spawnSync('php', ['-d', 'display_errors=stderr', '-r', phpCode], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
    var phpOut = null; try { phpOut = JSON.parse(String(run6.stdout || '')); } catch (eJ) {}
    var jsOut = R7CASES.map(function (c) { var r = syncContactRecordsMergeJs(c[0], c[1]); return r === null ? null : JSON.parse(r); });
    T('۶.۱۳ PHP واقعی با پورت JS هم‌خروجی است (' + R7CASES.length + ' سناریوی بخش ۶)',
      !!fnRecId && !!fnMerge && Array.isArray(phpOut) && JSON.stringify(phpOut) === JSON.stringify(jsOut),
      (!fnRecId || !fnMerge) ? 'تابع در api/crm.php پیدا نشد' : ('status=' + run6.status + ' stderr=' + String(run6.stderr || '').slice(0, 400) + ' stdout=' + String(run6.stdout || '').slice(0, 400)));
  }

  console.log('\n' + (failures ? failures + ' FAIL' : 'ALL PASSED') + ' — tester676 (v' + version + ')');
  process.exit(failures ? 1 : 0);
})().catch(function (e) {
  console.error('FATAL tester676: ' + (e && e.stack || e));
  process.exit(1);
});
