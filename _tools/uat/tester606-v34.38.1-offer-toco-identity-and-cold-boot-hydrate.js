#!/usr/bin/env node
'use strict';
/* =============================================================================
   tester606-v34.38.1-offer-toco-identity-and-cold-boot-hydrate.js

   ۱) BUG-OFFER-TOCO-IDENTITY — «تبدیل TO→CO پس از ویرایش با خطای رکورد اصلی
      پیشنهاد پیدا نشد می‌مرد»:
      - ریشه: کلون TO هویت ورود فرم سند مبدأ (editMode ماندگار direct/revision)
        را به ارث می‌برد؛ ptfOfferResolveSaveIdentity شماره CO تازه را به‌عنوان
        «رکورد ویرایش» می‌جست (idx=-1) و نگهبان offerSave ثبت را متوقف می‌کرد.
      - اصلاح (crm/offers.js): offerToCo هویت را new می‌کند؛ offerNew هنگام
        بازیابی پیش‌نویس هویت مسموم دوره قبل را پاک می‌کند؛ offerSave دیگر
        editMode را روی رکورد ذخیره‌شده نگه نمی‌دارد.

   ۲) COLD-BOOT-HYDRATE — «بعد از هر رفرش، رکوردهای پیشنهاد/درخواست/پرونده/تأمین
      خیلی دیر می‌آیند»:
      - ریشه: کلیدهای کسب‌وکاری offloadشده پس از رفرش نه در localStorage بودند
        نه در idbMem؛ پنل‌ها [] می‌دیدند و اولین pull کل دیتاست چندمگابایتی را
        کامل دانلود می‌کرد (هر رفرش!).
      - اصلاح: ptfBIdbPreload همه کلیدهای bdata: در IDB را شمارش و آب‌رسانی
        می‌کند (crm/client-server.js) و اولین pull هر بوت حداکثر ۲ ثانیه منتظر
        آب‌رسانی می‌ماند تا پاسخ fresh/دلتا بگیرد (crm/sync.js) — هر دو fail-open.

   ۳) LIST-RENDER-N1 — حل‌گرهای نام مشتری در هر ردیف فهرست ۲ تا ۳ بار کل کالکشن
      مشتریان را parse می‌کردند؛ کش کوتاه‌مدت ۲ثانیه‌ای + ابطال در هر سه مسیر
      نوشتن (sync.js، client-server.js، wr).
   ============================================================================= */
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function head(s) { console.log('\n── ' + s + ' ──'); }
function wait(ms) { return new Promise(function (res) { setTimeout(res, ms); }); }

var offSrc = read('crm/offers.js');
var syncSrc = read('crm/sync.js');
var csSrc = read('crm/client-server.js');
var idx = read('crm/index.html');

/* ───────────────────── ۱) هویت TO→CO — ساختاری ───────────────────── */
head('۱. BUG-OFFER-TOCO-IDENTITY — سیم‌کشی ساختاری در offers.js');

var toCoStart = offSrc.indexOf('function offerToCo(no)');
var toCoEnd = offSrc.indexOf('\n}\n', toCoStart) + 2;
var toCoFn = offSrc.slice(toCoStart, toCoEnd);
T('۱.۱ offerToCo هویت ورود فرم را new می‌کند (نه ارث از TO مبدأ)',
  toCoFn.indexOf("_offState.editMode = 'new';") > -1);
T('۱.۲ offerToCo نشانگرهای رکورد-مبدأ را پاک می‌کند',
  toCoFn.indexOf('delete _offState._baseNo;') > -1 &&
  toCoFn.indexOf('delete _offState._origNo;') > -1 &&
  toCoFn.indexOf('delete _offState.baseNo;') > -1);
T('۱.۳ offerNew هنگام بازیابی پیش‌نویس، هویت مسموم را new می‌کند',
  offSrc.indexOf("draft.editMode = 'new';") > -1 &&
  offSrc.indexOf('delete draft._baseNo;') > -1);
T('۱.۴ offerSave در هر دو شاخه editMode را از رکورد ذخیره‌شده حذف می‌کند',
  (offSrc.match(/delete o\.editMode;/g) || []).length >= 2);

/* ───────────────────── ۲) هویت TO→CO — رفتاری ───────────────────── */
head('۲. BUG-OFFER-TOCO-IDENTITY — رفتار ptfOfferResolveSaveIdentity (vm)');

var rs = offSrc.indexOf('function ptfOfferResolveSaveIdentity(o, offers) {');
var re = offSrc.indexOf('\n}\n', rs) + 2;
var sbR = {};
vm.createContext(sbR);
vm.runInContext(offSrc.slice(rs, re) + '\n;this.__resolve = ptfOfferResolveSaveIdentity;', sbR);
var resolve = sbR.__resolve;
T('۲.۰ استخراج و اجرای resolve در vm', typeof resolve === 'function');

var toOnly = [{ no: 'TO-1405-0003', kind: 'TO' }];
var rNew = resolve({ editMode: 'new', no: 'CO-1405-0007', kind: 'CO' }, toOnly);
T('۲.۱ سند CO حاصل از تبدیل (new) با موفقیت ذخیره می‌شود — idx=-1 یعنی درج تازه',
  rNew && rNew.ok === true && rNew.idx === -1 && rNew.mode === 'new', JSON.stringify(rNew));
var rPoison = resolve({ editMode: 'direct', no: 'CO-1405-0007', kind: 'CO' }, toOnly);
T('۲.۲ حالت مسموم پیش-از-اصلاح (direct بدون _baseNo) همان missing-edit-target نگهبان است',
  rPoison && rPoison.ok === false && rPoison.reason === 'missing-edit-target', JSON.stringify(rPoison));
var editState = { editMode: 'direct', _baseNo: 'TO-1405-0003', no: 'TO-1405-0003' };
var rDirect = resolve(editState, toOnly);
T('۲.۳ ویرایش مستقیم سالم دست‌نخورده ماند (یافتن هدف + قفل شماره سند)',
  rDirect && rDirect.ok === true && rDirect.idx === 0 && editState.no === 'TO-1405-0003', JSON.stringify(rDirect));
var rRev = resolve({ editMode: 'revision', _baseNo: 'TO-1405-0003', no: 'TO-1405-0003' }, toOnly);
T('۲.۴ نگارش جدید (revision) explicitRevision برمی‌گرداند',
  rRev && rRev.ok === true && rRev.explicitRevision === true, JSON.stringify(rRev));
var rLegacy = resolve({ no: 'CO-1405-0009' }, toOnly);
T('۲.۵ رکورد قدیمی بدون editMode همان مسیر new را می‌رود',
  rLegacy && rLegacy.ok === true && rLegacy.mode === 'new', JSON.stringify(rLegacy));

/* ───────────────────── ۳) کش نام مشتری — رفتاری ───────────────────── */
head('۳. LIST-RENDER-N1 — کش کوتاه‌مدت نام مشتری (vm)');

var ms = idx.indexOf('var _ptfCustCacheArr = null');
var mAnchor = "return { fa: fa || en || '', en: en };";
var me = idx.indexOf(mAnchor, ms) + mAnchor.length + 2;
T('۳.۰ بلوک memo در index.html یافت شد', ms > -1 && idx.indexOf(mAnchor, ms) > -1);
var sbC = {
  window: {},
  __calls: 0,
  __sample: [{ cd: 'C1', co: 'الف', coEn: 'ALPHA' }, { cd: 'C2', co: 'ب', coEn: 'BETA' }],
  getData: function () { sbC.__calls++; return sbC.__sample; }
};
vm.createContext(sbC);
vm.runInContext(idx.slice(ms, me) + '\n;this.__np = ptfCustNamePair; this.__faen = ptfCustFaByEn;', sbC);
var np1 = sbC.__np('C1', 'x');
var np2 = sbC.__np('C1', 'x');
var np3 = sbC.__np('C2', 'y');
T('۳.۱ سه فراخوانی پیاپی فقط یک parse از کالکشن مشتریان می‌گیرد (حذف N+1)',
  sbC.__calls === 1, 'calls=' + sbC.__calls);
T('۳.۲ جفت نام زنده درست است (فارسی از co + انگلیسی از coEn)',
  np1.fa === 'الف' && np1.en === 'ALPHA' && np3.fa === 'ب' && np3.en === 'BETA',
  JSON.stringify([np1, np3]));
T('۳.۳ تطبیق از روی نام انگلیسی هم از همان کش می‌خواند',
  sbC.__faen('beta') === 'ب' && sbC.__calls === 1, 'calls=' + sbC.__calls);
sbC.window.ptfCustCacheDrop();
var np4 = sbC.__np('C1', 'x');
T('۳.۴ پس از ابطال، خوانش بعدی تازه است (یک parse جدید)',
  sbC.__calls === 2 && np4.fa === 'الف', 'calls=' + sbC.__calls);

/* ───────────────────── ۴) سیم‌کشی آب‌رسانی + ابطال ───────────────────── */
head('۴. COLD-BOOT-HYDRATE و LIST-RENDER-N1 — سیم‌کشی ساختاری');

T('۴.۱ preload کلیدهای bdata: را از IDB شمارش می‌کند (نه فقط LS-scan)',
  csSrc.indexOf('ptfStorageIdbKeysByPrefix') > -1);
T('۴.۲ آب‌رسانی خالص IDB هم رندر قطعی __cold_boot__ را می‌خواهد',
  csSrc.indexOf('hydratedAny') > -1 && csSrc.indexOf('__cold_boot__') > -1);
T('۴.۳ سیگنال آب‌رسانی (پرچم + انتظار) برای گیت pull اول وجود دارد',
  csSrc.indexOf('ptfBIdbHydrated') > -1 && csSrc.indexOf('ptfBWhenHydrated') > -1);
T('۴.۴ تایمرهای fail-open آب‌رسانی/شمارش (بوت هرگز قفل نمی‌شود)',
  csSrc.indexOf('enumTimer') > -1 && csSrc.indexOf('hardTimer') > -1);
T('۴.۵ گیت اولین pull بوت در sync.js (یک‌بار + سقف ۲ ثانیه + fail-open)',
  syncSrc.indexOf('_bootHydrateGated') > -1 &&
  syncSrc.indexOf('window.ptfBWhenHydrated(_gateGo);') > -1);
var setW = syncSrc.indexOf('ptfSyncNotifyDirty(k);');
T('۴.۶ ابطال کش نام مشتری در هر سه مسیر نوشتن (sync-wrapper، wr، فاز B)',
  syncSrc.indexOf('ptfCustCacheDrop') > -1 && setW > -1 &&
  csSrc.indexOf('ptfCustCacheDrop') > -1);

/* ───────────────────── ۵) انطباق نسخه و نگهبان ───────────────────── */
head('۵. انطباق نسخه v34.38.1 و نگهبان گیت');

var verJson = JSON.parse(read('VERSION.json'));
var sw = read('crm/sw.js');
T('۵.۱ VERSION.json روی v34.38.1 است', verJson.crm_version === 'v34.38.1', verJson.crm_version);
T('۵.۲ شاخص رهاسازی index.html روی v34.38.1 است',
  idx.indexOf("window.PTF_CRM_RELEASE = 'v34.38.1'") > -1);
T('۵.۳ سرویس‌ورکر روی v34.38.1 است',
  sw.indexOf("RELEASE = 'v34.38.1'") > -1 && sw.indexOf("CACHE = 'ptf-crm-v34.38.1'") > -1);
T('۵.۴ مانیفست روی 34.38.1 است', JSON.parse(read('crm/manifest.json')).version === '34.38.1');
T('۵.۵ sales-domain.php روی 34.38.1 است',
  read('api/sales-domain.php').indexOf("const SD_SERVICE_VERSION = '34.38.1'") > -1);
var busts = idx.match(/\?v=([0-9.]+)/g) || [];
var badBust = busts.filter(function (b) { return b !== '?v=34.38.1'; });
T('۵.۶ همه cache-bust های index.html یکدست 34.38.1 هستند',
  busts.length > 50 && badBust.length === 0, badBust.slice(0, 5).join(','));
T('۵.۷ یادداشت انتشار v34.38.1 موجود است', fs.existsSync(path.join(ROOT, 'RELEASE-NOTES-v34.38.1.md')));
T('۵.۸ تستر در گیت CI ثبت شده است',
  read('_tools/uat/run-ci-gate.js').indexOf('tester606-v34.38.1-offer-toco-identity-and-cold-boot-hydrate.js') > -1);

/* ───────────────────── ۶) آب‌رسانی سرد — رفتاری (vm) ───────────────────── */
function makeLs(seed) {
  var store = {};
  Object.keys(seed).forEach(function (k) { store[k] = seed[k]; });
  return {
    _store: store,
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem: function (k, v) { store[k] = String(v); },
    removeItem: function (k) { delete store[k]; }
  };
}

function loadClientServer(idbSeed, lsSeed) {
  var idb = {};
  Object.keys(idbSeed).forEach(function (k) { idb[k] = idbSeed[k]; });
  var sb = {
    console: console, JSON: JSON, Math: Math, Object: Object, Array: Array, String: String,
    setTimeout: setTimeout, clearTimeout: clearTimeout,
    setInterval: function () { return 0; }, clearInterval: function () {},
    localStorage: makeLs(lsSeed),
    curSession: function () { return { user: 'u', name: 'U' }; },
    getData: function () { return []; },
    setData: function () { return true; },
    addLog: function () {},
    window: {
      indexedDB: {},
      _ptfSyncKeys: ['ptf_crm_offers', 'ptf_crm_rfqs', 'ptf_crm_deals', 'ptf_crm_customers', 'ptf_crm_inqitems'],
      ptfStorageIdbSet: function (id, v, cb) { idb[id] = String(v); setTimeout(function () { cb && cb(); }, 0); },
      ptfStorageIdbGet: function (id, cb) {
        setTimeout(function () { cb(Object.prototype.hasOwnProperty.call(idb, id) ? { value: idb[id] } : null); }, 0);
      },
      ptfStorageIdbKeysByPrefix: function (p, cb) {
        setTimeout(function () { cb(Object.keys(idb).filter(function (k) { return k.indexOf(p) === 0; })); }, 0);
      }
    },
    __refresh: []
  };
  vm.createContext(sb);
  vm.runInContext(csSrc, sb);
  sb.window.ptfScheduleDataRefresh = function (k) { sb.__refresh.push(k); };
  return sb;
}

var OFFERS_JSON = JSON.stringify([{ no: 'TO-1405-0003', kind: 'TO' }]);
var RFQS_JSON = JSON.stringify([{ no: 'RFQ-1' }]);
var DEALS_JSON = JSON.stringify([{ cd: 'D1' }]);
var CUST_JSON = JSON.stringify([{ cd: 'C1', co: 'الف' }]);
var BIG = 'x'.repeat(130000);

var chain = Promise.resolve();

chain = chain.then(function () {
  head('۶. COLD-BOOT-HYDRATE — آب‌رسانی کلیدهای offloadشده پس از رفرش (vm)');
  /* شبیه‌سازی «بوت پس از رفرش»: LS نسخه کسب‌وکاری ندارد (offload شده)، IDB دارد. */
  var sb = loadClientServer(
    { 'bdata:ptf_crm_offers': OFFERS_JSON, 'bdata:ptf_crm_rfqs': RFQS_JSON, 'bdata:ptf_crm_deals': DEALS_JSON, 'bdata:ptf_crm_customers': CUST_JSON },
    { ptf_b_phase: '1', ptf_b_synced_u: '1', ptf_crm_inqitems: BIG }
  );
  var cbFired = false;
  sb.window.ptfBIdbPreload(function () { cbFired = true; });
  return wait(200).then(function () {
    var R = sb.window.ptfBRead;
    T('۶.۱ preload تمام شد و پرچم آب‌رسانی بالا رفت', cbFired && sb.window.ptfBIdbHydrated === true);
    T('۶.۲ offers آب‌رسانی شد (بدون LS — مستقیم از IDB)', R('ptf_crm_offers') === OFFERS_JSON);
    T('۶.۳ rfqs/deals/customers آب‌رسانی شدند (کلیدهای خارج از فهرست ثابت)',
      R('ptf_crm_rfqs') === RFQS_JSON && R('ptf_crm_deals') === DEALS_JSON && R('ptf_crm_customers') === CUST_JSON);
    T('۶.۴ کلید سنگین LS-مانده مهاجرت کرد (حذف از LS + خوانا از آینه)',
      sb.localStorage.getItem('ptf_crm_inqitems') === null && R('ptf_crm_inqitems') === BIG);
    T('۶.۵ رندر قطعی __cold_boot__ پس از آب‌رسانی زمان‌بندی شد',
      sb.__refresh.indexOf('__cold_boot__') > -1, JSON.stringify(sb.__refresh));
    var immediate = false;
    sb.window.ptfBWhenHydrated(function () { immediate = true; });
    T('۶.۶ مشترکِ پس‌از-اتمام بلافاصله فراخوانده می‌شود', immediate === true);
    /* fail-open: آینه غیرفعال ⇒ انتظار، فراخواننده را معطل نمی‌کند. */
    var sb2 = loadClientServer({}, {});
    var imm2 = false;
    sb2.window.ptfBWhenHydrated(function () { imm2 = true; });
    T('۶.۷ آینه غیرفعال ⇒ ptfBWhenHydrated فوری (fail-open)', imm2 === true);
  });
});

/* ───────────────────── ۷) گیت pull اول — رفتاری (vm) ───────────────────── */
function loadSync(extraWindow) {
  var fetchCalls = [];
  var sb = {
    console: console, JSON: JSON, Math: Math, Object: Object, Array: Array, String: String,
    setTimeout: setTimeout, clearTimeout: clearTimeout,
    setInterval: function () { return 0; }, clearInterval: function () {},
    localStorage: makeLs({}),
    curSession: function () { return { user: 'u', name: 'U' }; },
    curRole: function () { return 'admin'; },
    fetch: function (url) {
      fetchCalls.push(String(url));
      return Promise.resolve({ ok: true, json: function () { return Promise.resolve({ ok: true, fresh: true, rev: 7, meta: {} }); } });
    },
    addLog: function () {}, audit: function () {}, ptfToast: function () {},
    ptfUpdateGuardCounts: function () {}, updateInboxBadge: function () {},
    document: { hidden: false, hasFocus: function () { return true; }, querySelector: function () { return null; }, activeElement: null, addEventListener: function () {}, getElementById: function () { return null; } },
    window: { addEventListener: function () {}, ptfAuthOk: function () { return true; } },
    __fetchCalls: fetchCalls
  };
  Object.keys(extraWindow || {}).forEach(function (k) { sb.window[k] = extraWindow[k]; });
  vm.createContext(sb);
  vm.runInContext(syncSrc, sb);
  return sb;
}

chain = chain.then(function () {
  head('۷. COLD-BOOT-HYDRATE — گیت pull اول بوت (vm)');
  /* A) بدون helper آب‌رسانی (کلاینت قدیمی/آینه خاموش) ⇒ رفتار دقیقاً مثل قبل. */
  var sbA = loadSync();
  var doneA = false;
  sbA.window.ptfSyncPullNow(function () { doneA = true; });
  return wait(120).then(function () {
    T('۷.۱ بدون helper: pull فوری و موفق (fail-open، بدون انتظار)',
      sbA.__fetchCalls.length === 1 && doneA === true, 'fetch=' + sbA.__fetchCalls.length);
    /* B) با helper: pull اول منتظر آب‌رسانی می‌ماند، دومی نه. */
    var gateSeen = false;
    var sbB = loadSync({
      ptfBIdbHydrated: false,
      ptfBWhenHydrated: function (cb) { gateSeen = true; setTimeout(cb, 30); }
    });
    var doneB = false, doneB2 = false;
    sbB.window.ptfSyncPullNow(function () { doneB = true; });
    var fetchAtT0 = sbB.__fetchCalls.length;
    return wait(150).then(function () {
      T('۷.۲ pull اولِ بوت تا آب‌رسانی صبر کرد (در t=0 درخواستی نزد)',
        gateSeen === true && fetchAtT0 === 0, 'gateSeen=' + gateSeen + ' fetchAtT0=' + fetchAtT0);
      T('۷.۳ پس از آب‌رسانی، pull با krevs کامل رفت و موفق شد',
        sbB.__fetchCalls.length === 1 && sbB.__fetchCalls[0].indexOf('krevs=') > -1 && doneB === true,
        sbB.__fetchCalls[0]);
      sbB.window.ptfSyncPullNow(function () { doneB2 = true; });
      return wait(120).then(function () {
        T('۷.۴ گیت فقط یک‌بار در هر بوت است (pull دوم بدون انتظار)',
          sbB.__fetchCalls.length === 2 && doneB2 === true, 'fetch=' + sbB.__fetchCalls.length);
      });
    });
  });
});

chain.then(function () {
  console.log('\n=== tester606-v34.38.1: ' + p + ' PASS / ' + f + ' FAIL ===\n');
  if (f > 0) process.exit(1);
}).catch(function (e) {
  console.error('FAIL tester606 crashed', e && e.stack || e);
  process.exit(1);
});
