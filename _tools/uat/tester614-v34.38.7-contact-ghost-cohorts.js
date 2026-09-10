#!/usr/bin/env node
'use strict';
/* =============================================================================
   tester614-v34.38.7-contact-ghost-cohorts.js
   گزارش کارفرما: «در قسمت مشتریان اطلاعات تماس پاک می‌شود. مدیرعامل روی یک سیستم
   مشتری ثبت کرده و شماره‌ها را می‌بیند ولی من روی سیستم خودم چه با مدیرعامل چه
   با رییس هیات مدیره نمی‌بینم. شاید چون شماره‌ها با ارقام انگلیسی ثبت شده‌اند.»

   نتیجهٔ RCA (ARENA-CONTACT-GHOST-EN-DIGITS-RCA-2026-09-08.md):
   - گمان ارقام انگلیسی با شبیه‌سازی end-to-end رد شد: هوک phonefmt فارسی‌سازی
     می‌کند و تماس‌ها در کل زنجیره (روتر فرمان → پاک‌ساز/مرج سرور → ماشین دوم)
     کامل می‌رسند. ← اینجا با کد واقعی قفل می‌شود.
   - امضای «یکی می‌بیند یکی نمی‌بیند» یعنی ردیفی که کاربر دوم می‌بیند همان رکورد
     اصلی نیست (stub/تکراری بدون تماس) یا سرور رکوردی بدون تماس دارد. سه بردار
     واقعی در کد جاری بسته شد:
       ① reasonهای سیستمیِ بدون قصد ساخت (rfq-cust-heal/contact-mig/phonefmt-mig)
          در برخورد کد 409 دیگر با کد نو «دوباره نمی‌سازند» (مولد ردیف تکراری) و
          سایهٔ محلی کنار گذاشته می‌شود. ثبت واقعی کاربر (offer-cust) مثل قبل retry.
       ② stub بازسازی مشتری از درخواست، کلیدهای تماس تهی (people:[]/con:''/ph:'')
          را در payload نمی‌فرستد — merge سرور هرگز تماس موجود را با خالی نمی‌شوید.
       ③ migrateContacts برای رکوردِ فاقد con/ph دیگر people:[]/coTels:[] خالی
          نمی‌سازد و دفتر را پوش نمی‌کند (شستِ احتمالی اشخاص رکورد هم‌کد).
   - یافتهٔ فرعی: نرمال‌سازی شماره در اتصال مشتری سایت (rfqSiteEnsureCustomer)
     با \D ارقام فارسی را می‌شست → dedup-by-phone کار نمی‌کرد → مشتری تکراری.

   ضد رگرسیون: tester604/605/611/613 باید سبز بمانند.
   ============================================================================= */
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function head(s) { console.log('\n── ' + s + ' ──'); }

var sd = read('crm/sales-domain-v2.js');
var off = read('crm/offers.js');
var brg = read('crm/bridge.js');
var pf = read('crm/phonefmt.js');
var idx = read('crm/index.html');
var gate = read('_tools/uat/run-ci-gate.js');

/* ─────────────── هارنس: سرور PHP + محیط کلاینت (عین معماری محصول) ─────────────── */
function sd_text(v, max) { var c = [...String(v).trim()]; return c.slice(0, max).join(''); }
function isNum(v) { return typeof v === 'number' && isFinite(v); }
function sanList(list, stats, depth) { /* پورت sd_entity_sanitize_list */
  var out = [];
  for (var ii = 0; ii < list.length; ii++) {
    var item = list[ii];
    if (typeof item === 'string') { var st2 = sd_text(item, 300); out.push(st2); if (out.length >= 60) break; continue; }
    if (typeof item === 'boolean' || isNum(item)) { out.push(item); continue; }
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      var sub = {}, keys = Object.keys(item);
      for (var k3i = 0; k3i < keys.length; k3i++) {
        var k3 = keys[k3i], v3 = item[k3];
        if (k3.length <= 60 && (typeof v3 === 'string' || isNum(v3) || typeof v3 === 'boolean' || v3 === null)) sub[k3] = typeof v3 === 'string' ? sd_text(v3, 2000) : v3;
        else if (k3.length <= 60 && Array.isArray(v3) && depth > 0) sub[k3] = sanList(v3, stats, depth - 1);
        if (Object.keys(sub).length >= 20) break;
      }
      out.push(sub); if (out.length >= 60) break; continue;
    }
  }
  return out;
}
function sanRow(row, maxFields) { /* پورت sd_entity_sanitize_row */
  var stats = { trimmed: 0, dropped: 0, kept: 0 }, out = {}, n = 0;
  var keys = Object.keys(row);
  for (var ki = 0; ki < keys.length; ki++) {
    var k = keys[ki], v = row[k];
    if (!k || k.length > 40) { stats.dropped++; continue; }
    if (n >= maxFields) { stats.dropped++; break; }
    if (v === null || typeof v === 'boolean' || isNum(v)) { out[k] = v; n++; stats.kept++; continue; }
    if (typeof v === 'string') { out[k] = sd_text(v, 8000); n++; stats.kept++; continue; }
    if (Array.isArray(v)) { out[k] = sanList(v, stats, 2); n++; continue; }
    if (v && typeof v === 'object') {
      var sub = {}, ks = Object.keys(v);
      for (var k2i = 0; k2i < ks.length; k2i++) {
        var k2 = ks[k2i], v2 = v[k2];
        if (k2.length <= 60 && (typeof v2 === 'string' || isNum(v2) || typeof v2 === 'boolean' || v2 === null)) sub[k2] = typeof v2 === 'string' ? sd_text(v2, 300) : v2;
        else if (k2.length <= 60 && Array.isArray(v2)) sub[k2] = sanList(v2, stats, 2);
        if (Object.keys(sub).length >= 60) break;
      }
      out[k] = sub; n++; continue;
    }
  }
  return { row: out, stats: stats };
}
function makeServer() { /* entity_upsert با merge semantics سرور */
  var S = { customers: [] };
  return { db: S, upsert: function (rec, expectCreate) {
    var id = String(rec.cd || '').slice(0, 60);
    if (!/^[A-Za-z0-9._:-]{3,60}$/.test(id)) return { ok: false, error: 'entity_id_required' };
    var r0 = sanRow(rec, 120), row = r0.row; row.cd = id;
    var found = -1;
    S.customers.forEach(function (r, i) { if (String(r.cd || '') === id) found = i; });
    if (expectCreate && found >= 0) return { ok: false, error: 'entity_id_exists', id: id, status: 409 };
    var now = new Date().toISOString(), stored, created;
    if (found < 0) { row.createdAt = now; row.createdBy = 'tester'; S.customers.push(row); created = true; stored = row; }
    else {
      var prev = S.customers[found];
      row.createdAt = String(prev.createdAt || now); row.createdBy = String(prev.createdBy || 'tester');
      Object.keys(prev).forEach(function (pk) {
        if (['createdAt', 'createdBy', 'updatedAt', 'updatedBy'].indexOf(pk) > -1) return;
        if (Object.prototype.hasOwnProperty.call(row, pk)) return;
        row[pk] = prev[pk];
      });
      row.updatedAt = now; S.customers[found] = row; created = false; stored = row;
    }
    return { ok: true, created: created, row: stored, data: { ptf_crm_customers: S.customers }, rev: 1 };
  } };
}
function makeClient(server, label) {
  var store = {};
  var localStorage = { getItem: function (k) { return k in store ? store[k] : null; }, setItem: function (k, v) { store[k] = String(v); }, removeItem: function (k) { delete store[k]; } };
  var apiLog = [];
  var win = { label: label, localStorage: localStorage, console: console,
    setInterval: function () { return 0; }, clearInterval: function () {}, setTimeout: function () { return 0; }, clearTimeout: function () {},
    document: { getElementById: function () { return null; }, querySelector: function () { return null; } },
    fetch: function (url, o) { return new Promise(function (resolve, reject) {
      var body = JSON.parse(o.body), action = /action=([^&]+)/.exec(url)[1];
      var resp = action === 'entity_upsert' ? server.upsert(body.record, !!body.expectCreate) : { ok: false, error: 'unexpected' };
      apiLog.push({ action: action, cd: body.record && body.record.cd, expectCreate: !!body.expectCreate, respOk: resp.ok, respErr: resp.error,
        hasPeopleKey: !!(body.record && Object.prototype.hasOwnProperty.call(body.record, 'people')),
        peopleN: body.record && body.record.people && body.record.people.length });
      if (!resp.ok) { var er = new Error(resp.error); er.status = resp.status || 400; return reject(er); }
      resolve({ ok: true, status: 200, text: function () { return Promise.resolve(JSON.stringify(resp)); } });
    }); },
    alert: function () {}, audit: function () {}, addLog: function () {},
    genCode: function (pf2) { return pf2 + '-' + Math.random().toString(36).slice(2, 8).toUpperCase(); }
  };
  win.getData = function (k) { try { return JSON.parse(store[k] || '[]'); } catch (e) { return []; } };
  win.setData = function (k, v) { store[k] = JSON.stringify(v); };
  win.ptfSilentWrite = function (k, s) { store[k] = String(s); };
  win.ptfSyncNotifyDirty = function () {};
  win.ptfSyncAcknowledgeKeys = function () {};
  win.ptfBApplyServerProjection = function (k, v) { store[k] = typeof v === 'string' ? v : JSON.stringify(v); return true; };
  win.ptfToast = function () {};
  win.ptfOnClickArg = function (v) { return String(v == null ? '' : v).replace(/[\\']/g, ''); };
  win.curSession = function () { return { user: 'ceo', name: 'مدیرعامل' }; };
  win.curRole = function () { return 'ceo'; };
  win.ptfAuthToken = function () { return 'T'; };
  win.ptfUnifiedCode = function (pfx) { return pfx + '-' + Math.random().toString(36).slice(2, 8).toUpperCase(); };
  win.ptfCodeIsRetired = function () { return false; };
  win.dedupStamp = function (r) { r.crAt = '1405/06/18 10:00'; r.crBy = 'ceo'; if (!r.createdAtISO) r.createdAtISO = new Date().toISOString(); return r; };
  win.faDateTime = function () { return '1405/06/18 10:00'; };
  win.hideModal = function () {}; win.renderCustomers = function () {};
  return { window: win, store: store, apiLog: apiLog };
}
function load(win, rel) {
  var code = read(rel);
  win.window = win; win.self = win; win.globalThis = win;
  Object.assign(win, { console: console, JSON: JSON, Math: Math, Date: Date, String: String, Number: Number, Array: Array, Object: Object, RegExp: RegExp, Promise: Promise, Error: Error, Symbol: Symbol });
  var ctx = vm.createContext(win);
  vm.runInContext(code, ctx, { filename: rel });
  return ctx;
}

/* ───────────────────── ۱) گمان کارفرما رد می‌شود: ارقام انگلیسی تماس را پاک نمی‌کنند ───────────────────── */
head('۱. مسیر کامل ثبت با ارقام انگلیسی — تماس‌ها سالم به سرور و ماشین دوم می‌رسند');
var server1 = makeServer();
var A1 = makeClient(server1, 'A');
load(A1.window, 'crm/sales-domain-v2.js');
load(A1.window, 'crm/phonefmt.js');
phonefmtNormSanity();

function phonefmtNormSanity() {
  T('۱.۰ ptfPhoneNorm: موبایل لاتین → فارسی', A1.window.ptfPhoneNorm('09123456789', 'fa') === '۰۹۱۲۳۴۵۶۷۸۹', A1.window.ptfPhoneNorm('09123456789', 'fa'));
  T('۱.۱ ptfPhoneNorm: موبایل فارسی دست‌نخورده می‌ماند', A1.window.ptfPhoneNorm('۰۹۱۲۳۴۵۶۷۸۹', 'fa') === '۰۹۱۲۳۴۵۶۷۸۹');
  T('۱.۲ ptfPhoneNorm: +98 لاتین → فارسی با صفر', A1.window.ptfPhoneNorm('+989123456789', 'fa') === '۰۹۱۲۳۴۵۶۷۸۹', A1.window.ptfPhoneNorm('+989123456789', 'fa'));
}

var recEN = {
  cd: 'CUST-EN1', co: 'شرکت آزمون ارقام', coEn: '', creditLimit: 0, kind: 'حقوقی', venSt: 'unreg', venNo: '',
  natId: '', melli: '', ind: 'نفت و گاز',
  people: [{ nm: 'مهندس تست', nmEn: '', role: 'مدیر خرید', dept: '', tels: [{ n: '02188770011', ext: '9', lb: '' }], mobs: [{ n: '09121112233', lb: '' }], mails: [], note: '', primary: true }],
  coTels: [{ n: '02188770011', ext: '', lb: 'تلفنخانه' }],
  coWeb: '', coAddr: '', owner: 'ceo', con: 'مهندس تست', ph: '02188770011'
};
A1.window.setData('ptf_crm_customers', []);
A1.window._ptfEntityLastKnown = { ptf_crm_customers: [] };
var itemsA = A1.window.getData('ptf_crm_customers');
A1.window.dedupStamp(recEN); itemsA.unshift(recEN);
var scenario1Done = (function () {
  A1.window.ptfEntitySaveCollection('ptf_crm_customers', itemsA, { reason: 'offer-cust' });
  var r2 = A1.window.getData('ptf_crm_customers').filter(function (x) { return x && x.cd === 'CUST-EN1'; })[0];
  if (r2) { A1.window.ptfNormalizeEntityPhones(r2, 'fa'); A1.window.ptfEntityUpsert('ptf_crm_customers', r2); }
  return new Promise(function (res) { setTimeout(res, 60); });
})();

/* ───────────────────── ۲) heal روی ماشین دوم در برخورد با رکورد کامل سرور ───────────────────── */
head('۲. heal سیستمی در برخورد کد 409 — نه تکراری می‌سازد، نه تماس می‌شوید، سایه محو می‌شود');
var server2 = makeServer();
/* رکورد معتبر سرور (تماس‌دار) */
server2.db.customers.push({
  cd: 'CUST-FULL1', co: 'شرکت کامل', kind: 'حقوقی', ind: 'نفت و گاز',
  people: [{ nm: 'آقای مدیر', role: 'مدیرعامل', primary: true, tels: [{ n: '۰۲۱۴۴۱۱۲۲۳۳', ext: '', lb: '' }], mobs: [], mails: [] }],
  coTels: [{ n: '۰۲۱۴۴۱۱۲۲۳۳', ext: '', lb: 'تلفنخانه' }], con: 'آقای مدیر', ph: '۰۲۱۴۴۱۱۲۲۳۳'
});
var B2 = makeClient(server2, 'B2');
load(B2.window, 'crm/sales-domain-v2.js');
B2.window.setData('ptf_crm_rfqs', [{ cd: 'RFQ-77', custCd: 'CUST-FULL1', co: 'شرکت کامل', ca: 'شیرآلات', con: '', ph: '' }]);
B2.window.setData('ptf_crm_customers', []);
B2.window._ptfEntityLastKnown = { ptf_crm_customers: [] };
/* heal واقعی از offers.js */
var healA = off.indexOf('window.ptfHealMissingCustomersFromRfqs = function');
var healB = off.indexOf('// رندر جدید جدول');
T('۲.۰ برش heal در offers.js پیدا شد', healA > -1 && healB > healA);
var healSrc = off.slice(healA, healB);
var scenario2Done = new Promise(function (resolve) {
  var ctx2 = vm.createContext(Object.assign({
    getData: function (k) { return B2.window.getData(k); },
    setData: function (k, v) { B2.window.setData(k, v); },
    dedupStamp: B2.window.dedupStamp,
    audit: function () {},
    JSON: JSON, String: String, Array: Array, Object: Object, Math: Math, console: console
  }, { window: B2.window }));
  vm.runInContext(healSrc + '\n;result = window.ptfHealMissingCustomersFromRfqs();', ctx2, { filename: 'heal.js' });
  setTimeout(resolve, 80);
});

/* ───────────────────── ۳) migrateContacts دیگر تماس خالی نمی‌سازد ───────────────────── */
head('۳. migrateContacts — فقط وقتی con/ph legacy هست مهاجرت می‌کند؛ تماس خالی fabrication نمی‌شود');
var migA = off.indexOf('function migrateContacts');
var migB = off.indexOf('function primaryPerson', migA);
T('۳.۰ برش migrateContacts پیدا شد', migA > -1 && migB > migA);
var migSrc = off.slice(migA, migB);
T('۳.۱ گارد truncation (_ptfEntityLastKnown) حفظ شده (قرارداد v34.38.6)', migSrc.indexOf('_ptfEntityLastKnown') > -1 && migSrc.indexOf('known.length > items.length') > -1);
T('۳.۲ reason=contact-mig حفظ شده', migSrc.indexOf("reason: 'contact-mig'") > -1);

function runMig(items) {
  var saves = [];
  var ctx3 = vm.createContext({
    getData: function () { return items; },
    setData: function () {},
    window: { _ptfEntityLastKnown: null, ptfEntitySaveCollection: function (c, a, o) { saves.push({ o: o, arr: a }); } },
    JSON: JSON, Array: Array, console: console
  });
  vm.runInContext(migSrc + '\n;migrateContacts();', ctx3, { filename: 'mig.js' });
  return { saves: saves, items: items };
}

/* ───────────────────── ۴) stub hygiene ثابت (مارکرهای سورس) ───────────────────── */
head('۴. مارکرهای ثابت فیکس');
var routerA = sd.indexOf('function retryWithFreshCode');
var routerB = sd.indexOf('window.ptfEntityDelete = function');
T('۴.۰ برش retryWithFreshCode پیدا شد', routerA > -1);
var retrySrc = routerA > -1 ? sd.slice(routerA, routerA + 6000) : '';
var nrA = sd.indexOf('NO_RECREATE_ON_CONFLICT_REASONS');
var conflictSrc = nrA > -1 ? sd.slice(nrA, nrA + 400) : '';
T('۴.۱ NO_RECREATE_ON_CONFLICT_REASONS با سه reason سیستمی تعریف و در 409 اعمال است',
  nrA > -1 &&
  conflictSrc.indexOf("'rfq-cust-heal': 1") > -1 &&
  conflictSrc.indexOf("'contact-mig': 1") > -1 && conflictSrc.indexOf("'phonefmt-mig': 1") > -1 &&
  sd.indexOf('NO_RECREATE_ON_CONFLICT_REASONS[opts.reason') > -1,
  conflictSrc.slice(0, 120));
T('۴.۲ سازوکار حذف سایهٔ محلی (dropLocalShadowStub) موجود است', sd.indexOf('function dropLocalShadowStub') > -1);
T('۴.۳ retry کاربرمحور دست‌نخورده است (قرارداد tester595: expectCreate:true + کد نو)',
  retrySrc.indexOf('allocFreshCode(') > -1 && retrySrc.indexOf('expectCreate: true') > -1);
T('۴.۴ heal stub کلید تماس تهی ثابت (people: []) در ساختار ندارد',
  healSrc.indexOf('people: [],') === -1 && healSrc.indexOf("ph: r.ph || ''") === -1 && healSrc.indexOf("con: r.con || ''") === -1, '');
T('۴.۵ heal stub فقط وقتی con هست people می‌سازد',
  healSrc.indexOf("if (r.con) {") > -1 && healSrc.indexOf("stub.people = [{ nm: r.con") > -1);
var legIfIdx = migSrc.indexOf('if (legacyName || legacyPhone)');
var chTrueIdx = migSrc.indexOf('changed = true;');
T('۴.۶ migrateContacts بدون legacy-contact چیزی نمی‌سازد (changed=true فقط زیر if)',
  migSrc.indexOf('if (!it.people)') > -1 && legIfIdx > -1 && chTrueIdx > -1 &&
  chTrueIdx > legIfIdx && migSrc.indexOf('changed = true;', chTrueIdx + 1) === -1,
  legIfIdx + '/' + chTrueIdx);
T('۴.۷ normP اتصال مشتری سایت ارقام فارسی را هم می‌فهمد (ptfToEnDigits)',
  /var normP = function \(s\) \{[\s\S]{0,220}ptfToEnDigits/.test(brg));
T('۴.۸ fallback digits اگر phonefmt هنوز لود نشده باشد', /ptfToEnDigits === 'function'/.test(brg));

/* نسخه/گیت */
head('۵. گیت و نسخه');
var ver = JSON.parse(read('VERSION.json'));
T('۵.۱ VERSION.json = v34.38.19', ver.crm_version === 'v34.38.19', ver.crm_version);
T('۵.۲ tester614 در run-ci-gate.js ثبت است', gate.indexOf('tester614-v34.38.7-contact-ghost-cohorts.js') > -1);
T('۵.۳ تسترهای رگرسیون تماس (604/611/613) در گیت هستند',
  gate.indexOf('tester604-v34.37.7-contact-wipe.js') > -1 &&
  gate.indexOf('tester611-v34.38.4-contact-wipe-ind-heal.js') > -1 &&
  gate.indexOf('tester613-v34.38.6-ntf-lifecycle-and-findings.js') > -1);
T('۵.۴ قرارداد UI/sw/SD = 34.38.19',
  /window\.PTF_CRM_RELEASE = 'v34\.38\.19'/.test(idx) &&
  /CACHE = 'ptf-crm-v34\.38\.19'/.test(read('crm/sw.js')) &&
  /SD_SERVICE_VERSION = '34\.38\.19'/.test(read('api/sales-domain.php')));

/* ─────────────── اجرای سناریوهای رفتاری ─────────────── */
Promise.all([scenario1Done]).then(function () {
  head('۱.نتیجهٔ رفتاری — ارقام انگلیسی (مسیر کامل)');
  var srv = server1.db.customers.filter(function (x) { return x.cd === 'CUST-EN1'; })[0];
  T('۱.۳ رکورد روی سرور ساخته شد', !!srv);
  var p0 = srv && srv.people && srv.people[0] || {};
  T('۱.۴ people/coTels/تلفن/موبایل روی سرور کامل ماند', Array.isArray(srv.people) && srv.people.length === 1 && Array.isArray(p0.tels) && p0.tels.length === 1 && Array.isArray(p0.mobs) && p0.mobs.length === 1 && Array.isArray(srv.coTels) && srv.coTels.length === 1,
    JSON.stringify({ people: srv && srv.people, coTels: srv && srv.coTels }));
  var en2 = function (fa) { return String(fa == null ? '' : fa).replace(/[۰-۹]/g, function (d) { return String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)); }); };
  T('۱.۵ تلفن ثابت فارسی‌سازی شد (۰۲۱۸۸۷۷۰۰۱۱ با داخلی ۹)', en2(p0.tels[0] && p0.tels[0].n) === '02188770011' && en2(p0.tels[0] && p0.tels[0].ext) === '9', JSON.stringify(p0.tels));
  T('۱.۶ موبایل فارسی‌سازی شد (۰۹۱۲۱۱۱۲۲۳۳)', en2(p0.mobs[0] && p0.mobs[0].n) === '09121112233', JSON.stringify(p0.mobs));
  T('۱.۷ تلفن‌خانه هم فارسی‌سازی شد', en2(srv.coTels[0] && srv.coTels[0].n).indexOf('02188770011') === 0);
  /* ماشین دوم: همان رندر لیست */
  var cell = (function (c) {
    var ppB = (c.people || []).filter(function (x) { return x.primary; })[0] || (c.people || [])[0];
    return (c.phones || []).length ? String(c.phones[0].n) : (ppB && ppB.tels && ppB.tels.length ? String(ppB.tels[0].n) : String(c.ph || '-'));
  })(srv);
  T('۱.۸ ماشین دوم شماره را می‌بیند (ستون تلفن پر است)', cell !== '-', cell);
  T('۱.۹ فقط دو upsert رفت و هیچ 409 رخ نداد', A1.apiLog.length === 2 && !A1.apiLog.some(function (l) { return l.respErr; }), JSON.stringify(A1.apiLog));

  return scenario2Done;
}).then(function () {
  head('۲.نتیجهٔ رفتاری — heal سیستمی در برخورد');
  var x = server2.db.customers.filter(function (c) { return c.cd === 'CUST-FULL1'; })[0];
  var sameCo = server2.db.customers.filter(function (c) { return c.co === 'شرکت کامل'; });
  T('۲.۱ upsert برخوردید heal فقط یک‌بار رفت (بدون retryِ کد نو)', B2.apiLog.length === 1 && B2.apiLog[0].respErr === 'entity_id_exists', JSON.stringify(B2.apiLog));
  T('۲.۲ هیچ مشتری تکراریِ هم‌نام روی سرور ساخته نشد', sameCo.length === 1, sameCo.map(function (c) { return c.cd; }).join('|'));
  T('۲.۳ رکورد معتبر هنوز people دارد (نشست داده‌ای)', Array.isArray(x.people) && x.people.length === 1, JSON.stringify(x.people));
  T('۲.۴ رکورد معتبر هنوز coTels دارد', Array.isArray(x.coTels) && x.coTels.length === 1);
  var localB = B2.window.getData('ptf_crm_customers');
  T('۲.۵ سایهٔ stub از فهرست محلی ماشین دوم کنار گذاشته شد تا پول بعدی رکورد معتبر را بیاورد',
    localB.length === 0 || localB.every(function (c) { return c.cd !== 'CUST-FULL1'; }), JSON.stringify(localB.map(function (c) { return c.cd; })));

  head('۳.نتیجهٔ رفتاری — migrateContacts');
  /* (الف) رکورد legacy با con/ph → مهاجرت مثل قبل */
  var legacy1 = [{ cd: 'CUST-LEG1', co: 'قدیمی الف', con: 'علی', ph: '0211111' }];
  var rM1 = runMig(legacy1);
  T('۳.۳ رکورد با con/ph: person ساخته و push شد (ضد رگرسیون)',
    rM1.saves.length === 1 && legacy1[0].people && legacy1[0].people.length === 1 && legacy1[0].people[0].tels.length === 1 && legacy1[0].people[0].tels[0].n === '0211111',
    JSON.stringify(legacy1[0].people));
  T('۳.۴ reason مهاجرت contact-mig است', rM1.saves[0] && rM1.saves[0].o && rM1.saves[0].o.reason === 'contact-mig', JSON.stringify(rM1.saves[0] && rM1.saves[0].o));
  /* (ب) رکورد فاقد people و بدون con/ph → هیچ people:[] ساخته و هیچ پوشی نمی‌شود */
  var legacy2 = [{ cd: 'CUST-LEG2', co: 'قدیمی ب', ind: 'سایر' }];
  var rM2 = runMig(legacy2);
  T('۳.۵ رکورد بدون con/ph: people:[] ساخته نمی‌شود و دفتر push نمی‌شود',
    rM2.saves.length === 0 && !legacy2[0].people && !legacy2[0].coTels,
    JSON.stringify({ saves: rM2.saves.length, people: legacy2[0].people }));
  /* (ج) رکورد با people موجود → دست نمی‌خورد */
  var legacy3 = [{ cd: 'CUST-LEG3', co: 'قدیمی ج', people: [{ nm: 'الف', tels: [], mobs: [], mails: [] }] }];
  var rM3 = runMig(legacy3);
  T('۳.۶ رکورد با people: بدون تغییر و بدون push', rM3.saves.length === 0 && legacy3[0].people.length === 1);

  console.log('\n— tester614 (CONTACT-GHOST: ارقام انگلیسی متهم‌راست / ضد ردیف-روح و ضد شستِ تماس) —');
  console.log('PASS: ' + p + ' | FAIL: ' + f);
  process.exit(f ? 1 : 0);
}).catch(function (e) { console.error('FATAL', e); process.exit(2); });
