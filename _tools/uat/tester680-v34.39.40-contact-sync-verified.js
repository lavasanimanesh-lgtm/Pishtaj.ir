/* tester680 — v34.39.40 (CONTACT-SYNC-DIAG-2 — SERVER-VERIFIED WRITE)
   رگرسیون کاملِ ریشه‌های گزارش کارفرما ۱۴۰۵/۰۷/۰۴:
   «ثبت روی سرور را زدم ولی تشخیص دوباره گفت روی سرور نیست»

   ریشه‌ها (RCA):
     R1) شاخهٔ ptfEntitySaveCollection با reason='contact-sync-diag' کلیدهای تماس را
         پیش از upsert حذف می‌کرد (سپر CONTACT-STALE) + شاخهٔ setData فقط محلی می‌نوشت؛
         هر دو «✅ ثبت شد» می‌گفتند ⇒ موفقیت کاذب. v34.39.40: هیچ fallback محلی نمانده.
     R2) خواندن: URL یکسان بین دو اجرا + بدون no-store ⇒ پاسخ کش‌شده = «همان پیام».
         v34.39.40: buster یکتا + cache:'no-store' + هدر no-store سرور.
     R3) تطبیق شماره فقط دقیق/پسوندی بود (۰۹۱۲… ≠ ۹۸۹۱۲…) ⇒ «روی سرور نیست» کاذب.
         v34.39.40: canonNum — ۰/۹۸/+۹۸/۰۰۹۸ هم‌ارز.
     R4) بدون حلقهٔ تأیید. v34.39.40: ثبت = فرمان + بازخوانی؛ موفقیت فقط با دیدنِ
         شماره در پاسخ تازهٔ سرور (state='verified'). */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var src = fs.readFileSync(path.join(BASE, 'contact-sync-diag.js'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');
var sdp = fs.readFileSync(path.join(BASE, '../api/sales-domain.php'), 'utf-8');
var crmp = fs.readFileSync(path.join(BASE, '../api/crm.php'), 'utf-8');
var ver = JSON.parse(fs.readFileSync(path.join(BASE, '../VERSION.json'), 'utf-8'));

function extractIIFE(source) {
  var i = source.indexOf('(function ()');
  if (i < 0) return null;
  var end = source.lastIndexOf('})();');
  if (end < 0) return null;
  return source.substring(i, end + 4);
}

/* محیط قابل‌تنظیم: fetch/upsert/krevs همه قابل mock */
var env = {};
function freshLoad() {
  delete global.__ptfCsdLoaded;
  global.window = global;
  global.localStorage = {
    _s: {},
    getItem: function (k) { return this._s[k] || null; },
    setItem: function (k, v) { this._s[k] = String(v); },
    removeItem: function (k) { delete this._s[k]; }
  };
  global.curRole = function () { return 'admin'; };
  global.ptfAuthToken = function () { return 'tok-1'; };
  global.audit = function () {};
  global.addLog = function () {};
  global.setDataCalls = 0;
  var origSetData = global.setData;
  global.setData = function (k, d) { global.setDataCalls++; return origSetData(k, d); };
  env = {
    fetchCalls: [],
    fetchImpl: function () { return Promise.resolve({ ok: true, json: function () { return Promise.resolve({ ok: true, data: {}, rev: 0 }); } }); },
    upsertCalls: [],
    upsertImpl: null
  };
  global.fetch = function (url, opts) {
    env.fetchCalls.push({ url: String(url), opts: opts });
    return env.fetchImpl(url, opts);
  };
  global.ptfSyncKrevs = undefined;
  global.PTF_ENTITY_CMD_ENABLED = { 'ptf_crm_customers': true };
  global.ptfEntityUpsert = function (collection, record, opts) {
    env.upsertCalls.push({ collection: collection, record: record, opts: opts });
    if (env.upsertImpl) return env.upsertImpl(collection, record, opts);
    opts.cb({ state: 'acked' });
  };
  global.ptfNormalizeEntityPhones = function (rec) { return rec; };
  var iife = extractIIFE(src);
  if (!iife) throw new Error('IIFE not found');
  eval(iife);
}

function resp(payload) {
  return { ok: true, json: function () { return Promise.resolve(payload); } };
}
function customersPayload(arr, rev) {
  return { ok: true, rev: rev || 9, data: { ptf_crm_customers: JSON.stringify(arr) }, meta: { ptf_crm_customers: { rev: rev || 9 } } };
}
var SRV_REC = {
  cd: 'CUST-101', co: 'شرکت نمونه', updatedAt: '2026-09-25T10:00:00Z', updatedBy: 'ceo',
  people: [{ nm: 'آقای نمونه', tels: [{ n: '۰۲۱۸۸۰۰۱۲۳۴' }], mobs: [] }],
  coTels: [{ n: '021 8800 9999' }], phones: []
};

SECTION('v34.39.40 — معماری: حذف ریشه‌های موفقیت کاذب (R1)');
T('هیچ فراخوانی ptfEntitySaveCollection در ماژول نمانده (فقط نام در کامنت RCA)', !/window\.ptfEntitySaveCollection\s*\(|[^\w.]ptfEntitySaveCollection\s*\(/.test(src));
T('هیچ مسیر local-only با پیام «legacy» موفقیت باقی نمانده (legacy = خطا)', /state:\s*'legacy'/.test(src) === false || src.indexOf('مسیر فرمان در لحظهٔ ارسال غیرفعال بود') > -1);
T('مسیر فرمان (ptfEntityUpsert) تنها مسیر نوشتن است', src.indexOf("window.ptfEntityUpsert(KEY, patched") > -1);
T('در غیاب مسیر فرمان، هیچ نوشتن محلی انجام نمی‌شود (unavailable ⇒ return بدون setData)', src.indexOf("done({ state: 'unavailable', operationId: opId });") > -1);

SECTION('v34.39.40 — قرارداد نسخه و جلوگیری از استقرار ناهمگن');
T('PTF_CRM_RELEASE = v34.39.40', /window\.PTF_CRM_RELEASE\s*=\s*'v34\.39\.40'/.test(idx));
T('sw.js RELEASE/CACHE = v34.39.40', /var RELEASE = 'v34\.39\.40'/.test(sw) && /CACHE = 'ptf-crm-v34\.39\.40'/.test(sw));
T('اسکریپت تشخیص با نسخهٔ جدید در index.html (cache-bust)', idx.indexOf('contact-sync-diag.js?v=34.39.40') > -1);
T('هیچ ?v=34.39.32 باقی نمانده', idx.indexOf('v=34.39.32') === -1);
T('VERSION.json crm_version = v34.39.40', ver.crm_version === 'v34.39.40');
T('SD_SERVICE_VERSION = 34.39.40 (هم‌راستا با UI)', /SD_SERVICE_VERSION = '34\.39\.40'/.test(sdp));

SECTION('v34.39.40 — هدر no-store سرور (R2)');
T('api/crm.php: Cache-Control no-store برای همهٔ پاسخ‌ها', crmp.indexOf("header('Cache-Control: no-store, no-cache, must-revalidate, private');") > -1 && crmp.indexOf("header('Pragma: no-cache');") > -1);
T('api/sales-domain.php: Cache-Control no-store', sdp.indexOf("header('Cache-Control: no-store, no-cache, must-revalidate, private');") > -1);

SECTION('R3 — تطبیق کانونی شماره (canonNum)');
freshLoad();
T('۰۹۱۲… → 912…', global.ptfCsdCanonNum('09121234567') === '9121234567');
T('۹۸۹۱۲… (بین‌الملل بدون +) → 912…', global.ptfCsdCanonNum('989121234567') === '9121234567');
T('+98 912 123 4567 (فاصله‌دار) → 912…', global.ptfCsdCanonNum('+98 912 123 4567') === '9121234567');
T('۰۰۹۸… با ارقام فارسی → 912…', global.ptfCsdCanonNum('۰۰۹۸۹۱۲۱۲۳۴۵۶۷') === '9121234567');
T('۰۲۱ ثابت تهران → 2188001234', global.ptfCsdCanonNum('02188001234') === '2188001234');
T('شمارهٔ خارجی (+49…) دست نمی‌خورد', global.ptfCsdCanonNum('+4915112345678') === '4915112345678');
T('شمارهٔ کوتاه دست نمی‌خورد', global.ptfCsdCanonNum('1234567') === '1234567');

SECTION('R3 — hasNum با فرمت‌های متفاوتِ ذخیره‌شده');
freshLoad();
var rec98 = { cd: 'C-1', people: [{ nm: 'x', tels: [], mobs: [{ n: '۹۸۹۱۲۱۲۳۴۵۶۷' }] }] };
T('سرور ۹۸۹۱۲… دارد، کاربر ۰۹۱۲… می‌پرسد ⇒ پیدا', global.ptfCsdHasNum(rec98, '09121234567') === true);
var recIntl = { cd: 'C-2', coTels: [{ n: '+98 21 8800 1234' }] };
T('سرور +98 21… دارد، کاربر 02188001234 می‌پرسد ⇒ پیدا', global.ptfCsdHasNum(recIntl, '02188001234') === true);
T('شمارهٔ غایب ⇒ پیدا نشد', global.ptfCsdHasNum(rec98, '09120000000') === false);
T('تطبیق پسوندی قدیمی هنوز کار می‌کند', global.ptfCsdHasNum({ ph: '00989121234567' }, '9121234567') === true);

SECTION('verdict — تفکیک وضعیت‌ها');
freshLoad();
T('رکورد غایب ⇒ record-missing', global.ptfCsdVerdict(null, SRV_REC, '').code === 'record-missing');
T('شماره نه در سرور نه محلی ⇒ never-synced (فرم ثبت ظاهر می‌شود)', global.ptfCsdVerdict(SRV_REC, SRV_REC, '09121234567').code === 'never-synced');
var srvHas = JSON.parse(JSON.stringify(SRV_REC)); srvHas.people[0].mobs.push({ n: '۰۹۱۲۱۲۳۴۵۶۷' });
T('سرور دارد، کش محلی ندارد ⇒ stale-local', global.ptfCsdVerdict(srvHas, SRV_REC, '09121234567').code === 'stale-local');
T('سرور دارد (فرمت ۹۸…)، کش محلی ندارد ⇒ stale-local — نه never-synced کاذب', global.ptfCsdVerdict(rec98, SRV_REC, '09121234567').code === 'stale-local');
var locHas = JSON.parse(JSON.stringify(SRV_REC)); locHas.people[0].mobs.push({ n: '۰۹۱۲۱۲۳۴۵۶۷' });
T('فقط محلی دارد ⇒ local-pending', global.ptfCsdVerdict(SRV_REC, locHas, '09121234567').code === 'local-pending');
T('هر دو ⇒ ok', global.ptfCsdVerdict(srvHas, locHas, '09121234567').code === 'ok');

SECTION('planFix — ساخت payload صحیح');
freshLoad();
var plan = global.ptfCsdPlanFix(SRV_REC, 'people:0:mob', '09121234567', 'mob');
T('payload ساخته شد', plan.ok === true);
T('شماره به people[0].mobs اضافه شد', plan.rec.people[0].mobs.some(function (t) { return /9121234567|۹۱۲۱۲۳۴۵۶۷|۰۹۱۲۱۲۳۴۵۶۷/.test(String(t.n)); }));
T('مهر _ccBaseAt از updatedAt سرور', plan.rec._ccBaseAt === '2026-09-25T10:00:00Z');
T('مهر _ccEdit و updatedAtISO', plan.rec._ccEdit === 1 && !!plan.rec.updatedAtISO);
T('شمارهٔ تکراری رد می‌شود', global.ptfCsdPlanFix(SRV_REC, 'coTels', '021 8800 9999', 'tel').ok === false);
T('شمارهٔ کوتاه رد می‌شود', global.ptfCsdPlanFix(SRV_REC, 'coTels', '12345', 'tel').ok === false);

SECTION('R2 — fetchServerRec: buster + no-store + krevs از لایهٔ سینک');
freshLoad();
global.ptfSyncKrevs = function () { return { 'ptf_crm_customers': 7, 'ptf_crm_offers': 3 }; }; /* A10: krevs فقط از لایهٔ سینک */
env.fetchImpl = function () { return Promise.resolve(resp(customersPayload([SRV_REC], 9))); };
global.ptfCsdFetchServerRec().then(function (sr) {
  T('خواندن موفق — رکورد سرور برگشت', sr.arr.length === 1 && sr.arr[0].cd === 'CUST-101');
  var call = env.fetchCalls[0];
  T('URL دارای buster یکتا (_csd=)', /&_csd=\d+/.test(call.url));
  T('fetch با cache:no-store', call.opts && call.opts.cache === 'no-store');
  T('کلید مشتریان از krevs ارسالی حذف شد (سرور مجبور به فرستادنش می‌شود)', call.url.indexOf('ptf_crm_customers') === -1 && decodeURIComponent(call.url).indexOf('"ptf_crm_offers":3') > -1);
  /* krevs از window.ptfSyncKrevs وقتی هست (A10) */
  global.ptfSyncKrevs = function () { return { 'ptf_crm_customers': 12, 'ptf_crm_leads': 4 }; };
  T('A10: هیچ دسترسی مستقیم localStorage در سورس ماژول نیست', !/localStorage\s*\.\s*(setItem|getItem|removeItem)\s*\(/.test(src));
  return global.ptfCsdFetchServerRec();
}).then(function () {
  T('krevs از لایهٔ سینک خوانده شد (نه localStorage مستقیم)', env.fetchCalls.length === 2 && env.fetchCalls[1].url.indexOf('ptf_crm_customers') === -1);
  /* fresh = سرور خالی، نه «رکورد نیست» */
  env.fetchImpl = function () { return Promise.resolve(resp({ ok: true, rev: 0, fresh: true })); };
  return global.ptfCsdFetchServerRec();
}).then(function (sr) {
  T('fresh ⇒ پرچم fresh (پیام «سرور خالی») نه record-missing', sr.fresh === true && sr.arr.length === 0);
  /* کلید در پاسخ نبود ⇒ خطای صریح keyMissing */
  env.fetchImpl = function () { return Promise.resolve(resp({ ok: true, rev: 5, data: { 'ptf_crm_offers': '[]' } })); };
  return global.ptfCsdFetchServerRec().then(function () {
    T('کلید غایب در پاسخ ⇒ keyMissing (خطای صریح)', false);
  }, function (e) {
    T('کلید غایب در پاسخ ⇒ keyMissing (خطای صریح)', e && e.keyMissing === true);
  });
}).then(function () { commitTests(); }).catch(function (err) {
  T('زنجیرهٔ fetchServerRec بدون خطا', false, String(err));
  commitTests();
});

function commitTests() {
  SECTION('R1/R4 — commitFix: یک مسیر فرمان + تأیید سرور');
  freshLoad();

  /* ۱) مسیر فرمان در دسترس نیست ⇒ unavailable و هیچ نوشتن محلی نمانده */
  global.PTF_ENTITY_CMD_ENABLED = {};
  global.ptfCsdCommitFix(SRV_REC, SRV_REC, '09121234567', function (r) {
    T('فرمان غیرفعال ⇒ unavailable (نه «legacy» موفق)', r.state === 'unavailable');
    T('در حالت unavailable هیچ setData/local-write انجام نشد', global.setDataCalls === 0 && env.upsertCalls.length === 0);
    step2();
  });

  function step2() {
    /* ۲) ACK + تأیید مثبت ⇒ verified */
    freshLoad();
    var patched = JSON.parse(JSON.stringify(SRV_REC));
    patched.people[0].mobs.push({ n: '۰۹۱۲۱۲۳۴۵۶۷' });
    env.fetchImpl = function () { return Promise.resolve(resp(customersPayload([patched], 10))); };
    global.ptfCsdCommitFix(patched, SRV_REC, '09121234567', function (r) {
      T('ACK + بازخوانیِ شماره ⇒ verified', r.state === 'verified');
      T('رکورد تأییدشده از سرور برگشت', r.serverRec && r.serverRec.cd === 'CUST-101' && global.ptfCsdHasNum(r.serverRec, '09121234567'));
      T('بازخوانی تأیید با buster/no-store انجام شد', env.fetchCalls.length >= 1 && /&_csd=\d+/.test(env.fetchCalls[0].url));
      T('دریافت operationId (رسید) برای پشتیبانی', typeof r.operationId === 'string' && r.operationId.indexOf('csd') === 0);
      step3();
    });
  }

  function step3() {
    /* ۳) ACK ولی شماره در بازخوانی نیست ⇒ unverified (هرگز «ثبت شد» نیست) */
    freshLoad();
    var patched = JSON.parse(JSON.stringify(SRV_REC));
    patched.people[0].mobs.push({ n: '۰۹۱۲۱۲۳۴۵۶۷' });
    env.fetchImpl = function () { return Promise.resolve(resp(customersPayload([SRV_REC], 10))); }; /* سرور هنوز شماره را ندارد */
    global.ptfCsdCommitFix(patched, SRV_REC, '09121234567', function (r) {
      T('ACK بدون دیدن شماره در سرور ⇒ unverified (با رسید)', r.state === 'unverified' && !!r.operationId);
      step4();
    });
  }

  function step4() {
    /* ۴) فرمان رد شد ⇒ rejected با رسید، بدون نوشتن محلی */
    freshLoad();
    env.upsertImpl = function (c, rec, opts) { opts.cb({ state: 'rejected', error: { status: 403, message: 'permission_denied' } }); };
    global.ptfCsdCommitFix(SRV_REC, SRV_REC, '09121234567', function (r) {
      T('رد سرور ⇒ rejected', r.state === 'rejected');
      T('در رد شدن هم هیچ نوشتن محلی نیست', global.setDataCalls === 0);
      step5();
    });
  }

  function step5() {
    /* ۵) uncertain ⇒ همان حالت فرمان، بدون ادعای موفقیت */
    freshLoad();
    env.upsertImpl = function (c, rec, opts) { opts.cb({ state: 'uncertain', error: { commitOutcome: 'uncertain' } }); };
    global.ptfCsdCommitFix(SRV_REC, SRV_REC, '09121234567', function (r) {
      T('uncertain ⇒ uncertain (نه verified)', r.state === 'uncertain');
      DONE('tester680 — v34.39.40 CONTACT-SYNC-DIAG-2 (server-verified write)');
    });
  }
}
