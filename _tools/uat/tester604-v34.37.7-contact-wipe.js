#!/usr/bin/env node
'use strict';
/* =============================================================================
   tester604-v34.37.7-contact-wipe.js
   گزارش کارفرما: «اطلاعات مشتری (تلفن، اشخاص رابط، کانال تماس) بی‌صدا پاک می‌شود.»

   زنجیرهٔ ریشه‌ای که این تستر می‌بندد (هر حلقه رفتاری است، نه فقط وجود رشته):
     ① روتر collection-diff برای ذخیرهٔ یک‌رکوردی / قالب‌بندی شماره / heal
        cd غایب را entity_delete می‌کرد — حتی با سپر انبوهِ سقف ۳، ۱–۳ مشتری
        واقعاً پاک می‌شد و silent-write همان آرایهٔ ناقص را روی کش می‌نشاند.
     ② phonefmt.migrateOnce کل دفتر را از getData کهنه بازنویس می‌کرد.
     ③ هوک phonefmt کل مجموعه را از items[0] قالب‌بندی می‌کرد (مشتری تازه‌ثبت
        بدون cd، رکورد دیگری را لمس می‌کرد).
     ④ cbCollect شخص بی‌نام با شماره/ایمیل را دور می‌ریخت.
     ⑤ saveCust2/saveSup2 برای حقوقی phones=[] می‌فرستاد و coTels را به فیلد
        فرم تقلیل می‌داد — merge سرور کلید حاضر را بازنویسی می‌کند.

   قرارداد ضد رگرسیون: tester595 بند ۵.۴ و tester525 سناریو ۱ (حذف تک‌رکوردی
   بدون reasonِ AUTO_NO_DELETE) باید سبز بمانند. AUTO_NO_DELETE فقط وقتی
   opts.reason در فهرست است.
   ============================================================================= */
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function head(s) { console.log('\n── ' + s + ' ──'); }

var sd = read('crm/sales-domain-v2.js');
var pf = read('crm/phonefmt.js');
var off = read('crm/offers.js');
var idx = read('crm/index.html');
var gate = read('_tools/uat/run-ci-gate.js');

/* ───────────────────── ۱) روتر: AUTO_NO_DELETE ───────────────────── */
head('۱. روتر — merge-preserve به‌جای entity_delete');
var aR = sd.indexOf('window.ptfEntitySaveCollection = function');
var bR = sd.indexOf('window.ptfSalesCommandErrorIsAmbiguous', aR);
T('۱.۰ برش روتر پیدا شد', aR > -1 && bR > aR);
var routerSrc = sd.slice(aR, bR);

T('۱.۱ فهرست AUTO_NO_DELETE شامل مسیرهای قالب/ذخیره/heal است',
  ['phonefmt', 'phonefmt-mig', 'rfq-cust-heal', 'offer-cust', 'offer-sup',
    'excel-import', 'excel-std', 'vendorlist', 'site-rfq', 'saveCust', 'saveSup'
  ].every(function (k) { return routerSrc.indexOf("'" + k + "'") > -1; }));

function bootRouter() {
  var calls = { ups: [], dels: [], legacy: [], silent: [] };
  var ctx = {
    console: { warn: function () {}, error: function () {} },
    JSON: JSON, Array: Array, Object: Object, String: String, Date: Date, Number: Number,
    window: {
      PTF_ENTITY_CMD_ENABLED: { ptf_crm_customers: true, ptf_crm_suppliers: true },
      ptfEntityUpsert: function (c, r, o) { calls.ups.push(r && r.cd); if (o && o.cb) o.cb({ state: 'acked' }); },
      ptfEntityDelete: function (c, id, o) { calls.dels.push(id); if (o && o.cb) o.cb({ state: 'acked' }); },
      ptfSilentWrite: function (k, str) {
        var n = 0; try { n = JSON.parse(str).length; } catch (e) {}
        calls.silent.push({ k: k, n: n });
      },
      ptfSyncAcknowledgeKeys: function () {}
    },
    setData: function (k, v) { calls.legacy.push({ k: k, n: (v || []).length }); },
    getData: function () { return []; },
    audit: function () {}, ptfToast: function () {}
  };
  vm.createContext(ctx);
  vm.runInContext(routerSrc, ctx, { filename: 'router604.js' });
  return { save: ctx.window.ptfEntitySaveCollection, calls: calls, w: ctx.window };
}
function mk(n, pfx) {
  pfx = pfx || 'CUST-';
  var a = [];
  for (var i = 0; i < n; i++) a.push({ cd: pfx + (1000 + i), co: 'ش' + i, people: [{ nm: 'رابط', mobs: [{ n: '0912' + i }] }], coTels: [{ n: '021-' + i }, { n: '021-x' + i }] });
  return a;
}

(function () {
  var h = bootRouter();
  var base = mk(3);
  var next = [JSON.parse(JSON.stringify(base[0])), JSON.parse(JSON.stringify(base[1]))];
  next[0].co = 'ویرایش‌شده';
  var r = h.save('ptf_crm_customers', next, { prevArr: base, reason: 'phonefmt' });
  T('۱.۲ reason=phonefmt و یک cd غایب → صفر حذف (باگ اصلی ناپدیدشدن)',
    r && r.mode === 'commands' && r.deletes === 0 && h.calls.dels.length === 0,
    JSON.stringify(r) + ' dels=' + JSON.stringify(h.calls.dels));
  T('۱.۲b silent-write آرایهٔ کامل (۳) می‌نویسد نه ناقص',
    h.calls.silent.length && h.calls.silent[0].n === 3, JSON.stringify(h.calls.silent));
  T('۱.۲c lastKnown پس از merge سه رکورد دارد و ویرایش C0 حفظ شده',
    (function () {
      var kn = h.w._ptfEntityLastKnown && h.w._ptfEntityLastKnown.ptf_crm_customers;
      return kn && kn.length === 3 && kn[0].co === 'ویرایش‌شده' && kn[2].cd === 'CUST-1002';
    })());
})();

(function () {
  var h = bootRouter();
  var base = mk(5);
  var r = h.save('ptf_crm_customers', [], { prevArr: base, reason: 'phonefmt-mig' });
  T('۱.۳ reason=phonefmt-mig و next تهی → صفر حذف + lastKnown کامل',
    r && r.deletes === 0 && h.calls.dels.length === 0 &&
    h.w._ptfEntityLastKnown.ptf_crm_customers.length === 5,
    JSON.stringify(r));
})();

(function () {
  var h = bootRouter();
  var base = mk(4);
  var r = h.save('ptf_crm_customers', base.slice(0, 2), { prevArr: base, reason: 'rfq-cust-heal' });
  T('۱.۴ reason=rfq-cust-heal ناقص → صفر حذف',
    r && r.deletes === 0 && h.calls.dels.length === 0);
})();

(function () {
  var h = bootRouter();
  var base = mk(3);
  var r = h.save('ptf_crm_customers', base.slice(0, 2), { prevArr: base }); /* بدون reason */
  T('۱.۵ بدون reason، حذف تک‌رکوردی کار می‌کند (قرارداد tester595 بند ۵.۴)',
    r && r.mode === 'commands' && r.deletes === 1 && h.calls.dels[0] === 'CUST-1002',
    JSON.stringify(r) + ' ' + JSON.stringify(h.calls.dels));
})();

(function () {
  function cust(cd, co) { return { cd: cd, co: co, ph: '' }; }
  var h = bootRouter();
  var base = [cust('C1', 'الف'), cust('C2', 'ب'), cust('C3', 'ج')];
  var next = [cust('C1', 'الف‌۲'), cust('C2', 'ب'), cust('C4', 'د')];
  var r = h.save('ptf_crm_customers', next, { prevArr: base });
  T('۱.۶ سناریو tester525-۱ بدون reason: ۱ delete برای C3',
    r && r.deletes === 1 && h.calls.dels[0] === 'C3', JSON.stringify(h.calls.dels));
  T('۱.۶b همان سناریو: ۲ upsert (C1 ویرایش + C4 جدید)',
    r.upserts === 2 && h.calls.ups.slice().sort().join(',') === 'C1,C4', JSON.stringify(h.calls.ups));
})();

(function () {
  var h = bootRouter();
  var base = mk(3);
  var r = h.save('ptf_crm_customers', base.slice(0, 2), { prevArr: base, reason: 'phonefmt', allowDeletes: true });
  T('۱.۷ allowDeletes روی مسیر AUTO همچنان حذف می‌کند (خروج اضطراری)',
    r && r.deletes === 1 && h.calls.dels.length === 1);
})();

(function () {
  var h = bootRouter();
  var base = mk(3);
  var r = h.save('ptf_crm_customers', base.slice(0, 2), { prevArr: base, reason: 'w4' });
  T('۱.۸ reason نامرتبط (w4) مشمول AUTO نیست → ۱ حذف',
    r && r.deletes === 1 && h.calls.dels.length === 1);
})();

(function () {
  var MUT = routerSrc.replace(
    /if \(dels\.length && AUTO_NO_DELETE_REASONS\[opts\.reason\] && !opts\.allowDeletes\) \{[\s\S]*?dels = \[\];\n    \}/,
    ''
  );
  T('۱.۹ جهش: بلوک AUTO_NO_DELETE از سورس برداشته شد', MUT !== routerSrc && MUT.indexOf('mergedKeep') === -1);
  var calls = { ups: [], dels: [], legacy: [], silent: [] };
  var ctx = {
    console: { warn: function () {}, error: function () {} },
    JSON: JSON, Array: Array, Object: Object, String: String, Date: Date, Number: Number,
    window: {
      PTF_ENTITY_CMD_ENABLED: { ptf_crm_customers: true },
      ptfEntityUpsert: function (c, r, o) { calls.ups.push(r.cd); if (o && o.cb) o.cb({ state: 'acked' }); },
      ptfEntityDelete: function (c, id, o) { calls.dels.push(id); if (o && o.cb) o.cb({ state: 'acked' }); },
      ptfSilentWrite: function () {}, ptfSyncAcknowledgeKeys: function () {}
    },
    setData: function () {}, getData: function () { return []; }, audit: function () {}, ptfToast: function () {}
  };
  vm.createContext(ctx);
  vm.runInContext(MUT, ctx, { filename: 'router604-mut.js' });
  var base = mk(3);
  var r = ctx.window.ptfEntitySaveCollection('ptf_crm_customers', base.slice(0, 2), { prevArr: base, reason: 'phonefmt' });
  T('۱.۱۰ جهش: بدون بلوک AUTO، reason=phonefmt دوباره ۱ حذف می‌سازد ⇒ سنجه بار تشخیص دارد',
    r && r.deletes === 1 && calls.dels.length === 1, JSON.stringify(r) + ' ' + JSON.stringify(calls.dels));
})();

/* ───────────────────── ۲) phonefmt: skip + هوک تک‌رکوردی ───────────────────── */
head('۲. phonefmt — مهاجرت ناقص و هوک items[0]');
T('۲.۰ skipEmptyOrTruncated در migrateOnce هست',
  pf.indexOf('function skipEmptyOrTruncated') > -1 && pf.indexOf("reason: 'phonefmt-mig'") > -1);
T('۲.۱ هوک مشتری ptfEntityUpsert است نه SaveCollection',
  (function () {
    var h0 = pf.indexOf('function hookCust()');
    var h1 = pf.indexOf('function hookSup()');
    var body = pf.slice(h0, h1);
    var code = body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    return body.indexOf('ptfEntityUpsert') > -1 &&
      body.indexOf('ptfEntitySaveCollection') === -1 &&
      body.indexOf('_ptfLastSavedCustCd') > -1 &&
      code.indexOf('items[0]') === -1;
  })());
T('۲.۲ هوک تامین‌کننده هم تک‌رکوردی است',
  (function () {
    var h0 = pf.indexOf('function hookSup()');
    var h1 = pf.indexOf('function smsCanonicalMobile');
    var body = pf.slice(h0, h1);
    return body.indexOf('ptfEntityUpsert') > -1 &&
      body.indexOf('ptfEntitySaveCollection') === -1 &&
      body.indexOf('_ptfLastSavedSupCd') > -1;
  })());
T('۲.۳ phonefmt.js قبل از sales-domain-v2.js بارگذاری می‌شود (lastKnown برای skip)',
  idx.indexOf('phonefmt.js') > -1 && idx.indexOf('phonefmt.js') < idx.indexOf('sales-domain-v2.js'));

(function () {
  var m0 = pf.indexOf('function migrateOnce()');
  var m1 = pf.indexOf('var tries = 0;');
  T('۲.۴ برش migrateOnce پیدا شد', m0 > -1 && m1 > m0);
  var migSrc = pf.slice(m0, m1);
  function runMig(store, known, already) {
    var saves = [];
    var ctx = {
      localStorage: {
        getItem: function (k) { return already ? '1' : null; },
        setItem: function () { already = true; }
      },
      window: {
        _ptfEntityLastKnown: known || {},
        ptfEntitySaveCollection: function (c, a, o) { saves.push({ c: c, n: (a || []).length, reason: o && o.reason }); },
        ptfNormalizeEntityPhones: function (r) { return r; }
      },
      getData: function (k) { return store[k] || []; },
      setData: function () {},
      audit: function () {}
    };
    ctx.ptfNormalizeEntityPhones = ctx.window.ptfNormalizeEntityPhones;
    vm.createContext(ctx);
    vm.runInContext(migSrc + '\nmigrateOnce();', ctx, { filename: 'mig604.js' });
    return saves;
  }
  T('۲.۵ getData تهی + lastKnown پر → مهاجرت نمی‌نویسد',
    runMig({ ptf_crm_customers: [], ptf_crm_suppliers: [] }, { ptf_crm_customers: mk(5), ptf_crm_suppliers: mk(3, 'SUP-') }).length === 0);
  T('۲.۶ getData ناقص‌تر از lastKnown → مهاجرت نمی‌نویسد',
    runMig({ ptf_crm_customers: mk(2), ptf_crm_suppliers: mk(1, 'SUP-') }, { ptf_crm_customers: mk(8), ptf_crm_suppliers: mk(4, 'SUP-') }).length === 0);
  var full = runMig({ ptf_crm_customers: mk(3), ptf_crm_suppliers: mk(2, 'SUP-') }, { ptf_crm_customers: mk(3), ptf_crm_suppliers: mk(2, 'SUP-') });
  T('۲.۷ دفتر کامل → مهاجرت با reason=phonefmt-mig (نه delete خام)',
    full.length === 2 && full.every(function (x) { return x.reason === 'phonefmt-mig'; }),
    JSON.stringify(full));
})();

(function () {
  var h0 = pf.indexOf('function hookCust()');
  var h1 = pf.indexOf('function hookSup()');
  var hookSrc = pf.slice(h0, h1);
  var upserts = [];
  var origCalls = [];
  var items = mk(3);
  var ctx = {
    window: {
      saveCust2: function (cd) { origCalls.push(cd); },
      ptfEntityUpsert: function (c, r) { upserts.push({ c: c, cd: r && r.cd }); },
      ptfEntitySaveCollection: function () { upserts.push({ bad: 'saveCol' }); },
      _ptfLastSavedCustCd: 'CUST-1002'
    },
    getData: function () { return items; },
    setData: function () { upserts.push({ bad: 'setData' }); },
    ptfNormalizeEntityPhones: function (r) { r._norm = 1; return r; }
  };
  vm.createContext(ctx);
  vm.runInContext(hookSrc + '\nhookCust();', ctx, { filename: 'hook604.js' });
  ctx.window.saveCust2('CUST-1001');
  T('۲.۸ هوک پس از saveCust2(cd) فقط همان cd را upsert می‌کند',
    origCalls.length === 1 && upserts.length === 1 && upserts[0].cd === 'CUST-1001',
    JSON.stringify(upserts));
  upserts.length = 0; origCalls.length = 0;
  ctx.window.saveCust2(null);
  T('۲.۹ بدون cd، هوک از _ptfLastSavedCustCd استفاده می‌کند (نه items[0])',
    upserts.length === 1 && upserts[0].cd === 'CUST-1002', JSON.stringify(upserts));
  upserts.length = 0; origCalls.length = 0;
  ctx.window._ptfLastSavedCustCd = '';
  ctx.window.saveCust2(null);
  T('۲.۱۰ بدون cd و بدون lastSaved هیچ upsert/items[0] نیست',
    origCalls.length === 1 && upserts.length === 0, JSON.stringify(upserts));
})();

/* ───────────────────── ۳) دفترچه تماس + coTels + phones[] ───────────────────── */
head('۳. cbCollect / coTels اضافه / حقوقی بدون phones[]');
var helpA = off.indexOf('function cbEnsurePerson');
var helpB = off.indexOf('function cbInit');
var collA = off.indexOf('function cbCollect');
var collB = off.indexOf('// نمای کارت اشخاص');
T('۳.۰ برش helpers+cbCollect پیدا شد', helpA > -1 && helpB > helpA && collA > -1 && collB > collA);
var cbSrc = 'var _cbState = null;\n' + off.slice(helpA, helpB) + off.slice(collA, collB);

function runCb(people) {
  var ctx = { window: {}, String: String, Array: Array, JSON: JSON };
  vm.createContext(ctx);
  vm.runInContext(cbSrc + '\n_cbState = { people: ' + JSON.stringify(people) + ' };\nresult = cbCollect();', ctx, { filename: 'cb604.js' });
  return { got: ctx.result, merge: ctx.ptfMergeExtraCoTels || ctx.window.ptfMergeExtraCoTels };
}

(function () {
  var r = runCb([{ nm: '', mobs: [{ n: '09121234567', lb: '' }], tels: [], mails: [] }]);
  T('۳.۱ شخص بی‌نام با موبایل هنگام جمع‌آوری حفظ می‌شود',
    r.got && r.got.length === 1 && r.got[0].mobs[0].n === '09121234567', JSON.stringify(r.got));
})();
(function () {
  var r = runCb([{ nm: '  ', tels: [{ n: '02188000000', ext: '12', lb: '' }], mobs: [], mails: [] }]);
  T('۳.۲ شخص بی‌نام با تلفن ثابت حفظ می‌شود', r.got && r.got.length === 1);
})();
(function () {
  var r = runCb([{ nm: '', mails: [{ n: 'a@b.ir' }], tels: [], mobs: [] }]);
  T('۳.۳ شخص بی‌نام با ایمیل حفظ می‌شود', r.got && r.got.length === 1);
})();
(function () {
  var r = runCb([{ nm: '', tels: [], mobs: [], mails: [] }, { nm: 'علی', tels: [], mobs: [], mails: [] }]);
  T('۳.۴ شخص خالی دور ریخته می‌شود و شخص نام‌دار می‌ماند',
    r.got && r.got.length === 1 && r.got[0].nm === 'علی');
})();
(function () {
  var r = runCb([]);
  T('۳.۵ دفترچه تهی → آرایهٔ خالی (نه throw)', Array.isArray(r.got) && r.got.length === 0);
})();

(function () {
  var ctx = { window: {}, String: String, Array: Array };
  vm.createContext(ctx);
  vm.runInContext(cbSrc, ctx, { filename: 'merge604.js' });
  var merge = ctx.ptfMergeExtraCoTels || ctx.window.ptfMergeExtraCoTels;
  var old = { coTels: [{ n: '021-1', ext: '10', lb: 'تلفنخانه' }, { n: '021-2', lb: 'فکس' }, { n: '021-3' }] };
  var out = merge(old, '021-9');
  T('۳.۶ شمارهٔ اول فرم جایگزین می‌شود و شماره‌های اضافه می‌مانند',
    out.length === 3 && out[0].n === '021-9' && out[0].ext === '10' && out[1].n === '021-2' && out[2].n === '021-3',
    JSON.stringify(out));
  T('۳.۷ بدون رکورد قبلی، فقط تلفن فرم',
    JSON.stringify(merge(null, '021-1')) === JSON.stringify([{ n: '021-1', ext: '', lb: 'تلفنخانه' }]));
  T('۳.۸ فیلد فرم خالی → شماره‌های اضافه (از ایندکس ۱) حفظ می‌شوند',
    merge(old, '').length === 2 && merge(old, '')[0].n === '021-2');
})();

(function () {
  var c0 = off.indexOf('function saveCust2');
  var c1 = off.indexOf('function showSupModal2');
  var s0 = off.indexOf('function saveSup2');
  var s1 = off.indexOf('window.ptfHealMissingCustomersFromRfqs');
  var custFn = off.slice(c0, c1), supFn = off.slice(s0, s1);
  T('۳.۹ saveCust2 حقوقی rec.phones = [] ندارد',
    custFn.indexOf("rec.kind === 'حقیقی'") > -1 && custFn.indexOf('rec.phones = []') === -1);
  T('۳.۱۰ saveSup2 حقوقی rec.phones = [] ندارد',
    supFn.indexOf("rec.kind === 'حقیقی'") > -1 && supFn.indexOf('rec.phones = []') === -1);
  T('۳.۱۱ هر دو از ptfMergeExtraCoTels برای coTels استفاده می‌کنند',
    custFn.indexOf('ptfMergeExtraCoTels(oldRecPre') > -1 && supFn.indexOf('ptfMergeExtraCoTels(oldSupPre') > -1);
  T('۳.۱۲ فلگ lastSaved برای هوک phonefmt ست می‌شود',
    custFn.indexOf('_ptfLastSavedCustCd') > -1 && supFn.indexOf('_ptfLastSavedSupCd') > -1);
})();

(function () {
  var MUT = cbSrc.replace('filter(cbPersonHasContact)', 'filter(function(p){ return p.nm && p.nm.trim(); })');
  T('۳.۱۳ جهش: فیلتر نام‌محور از سورس ساختگی متفاوت است', MUT !== cbSrc);
  var ctx = { window: {}, String: String, Array: Array };
  vm.createContext(ctx);
  vm.runInContext(MUT + '\n_cbState = { people: ' + JSON.stringify([{ nm: '', mobs: [{ n: '09120000000' }], tels: [], mails: [] }]) + ' };\nresult = cbCollect();', ctx, { filename: 'cb604-mut.js' });
  T('۳.۱۴ جهش: فیلتر نام‌محور شخص بی‌نامِ دارای موبایل را می‌اندازد ⇒ سنجه بار تشخیص دارد',
    Array.isArray(ctx.result) && ctx.result.length === 0);
})();

/* ───────────────────── ۴) گیت / نسخه ───────────────────── */
head('۴. گیت و نسخه');
var ver = JSON.parse(read('VERSION.json'));
T('۴.۱ VERSION.json = v34.38.5', ver.crm_version === 'v34.38.5', ver.crm_version);
T('۴.۲ tester604 در run-ci-gate.js ثبت است',
  gate.indexOf('tester604-v34.37.7-contact-wipe.js') > -1);
T('۴.۳ SYNTAX گیت phonefmt.js را هم چک می‌کند',
  /'crm\/phonefmt\.js'/.test(gate));
T('۴.۴ قرارداد UI/sw = 34.38.5',
  /window\.PTF_CRM_RELEASE = 'v34\.38\.5'/.test(idx) &&
  /CACHE = 'ptf-crm-v34\.38\.5'/.test(read('crm/sw.js')));

console.log('\n— tester604 (CONTACT-WIPE: تلفن/اشخاص/کانال مشتری دیگر پاک نمی‌شود) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
