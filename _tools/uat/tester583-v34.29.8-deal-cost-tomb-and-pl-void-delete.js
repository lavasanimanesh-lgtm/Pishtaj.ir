#!/usr/bin/env node
'use strict';
/* tester583 — v34.34.0: «هزینه‌های مستقیم پروندهٔ فروش چند‌باره محاسبه شده و با پاک
 * کردن دوباره برمی‌گردند؛ هزینهٔ تنخواهِ پروندهٔ دیگر هم در این پرونده درج شده؛
 * پکینگ‌لیست‌ها را ابطال می‌کنم ولی همچنان هستند و delete کردنشان فایده ندارد.»
 *
 * ریشه (RCA):
 * ① ptfSmartMerge برای ptf_crm_deals از مسیر ptfMergeByCodeCanonical می‌رفت که
 *   فیلدهای آرایه‌ای (costEvents) را با ptfMergeArrayUnique (امضای کامل-JSON)
 *   اجتماع می‌کرد → حذف هرگز ماندگار نمی‌شد (نسخهٔ کهنه/همکار برمی‌گرداند) و هر
 *   تفاوت جزئی نسخهٔ دوم = تکرار می‌ساخت. همچنین ptfPreferRecord رکوردِ «کامل‌تر»
 *   (با costEvents بلندتر!) را برنده می‌کرد — موتور بازگشت.
 *   راه‌حل: tombstone نقشه‌ای _costTomb{cd:iso} روی رکورد پرونده + ددوب بر cd
 *   در merge + جاروب تعمیر یک‌باره + ددوب نوار مالی/dealTotalCosts.
 * ② پکینگ‌لیست در merge عمومی بود: ts رشته‌ای؛ ابطال هیچ ts را عوض نمی‌کرد و
 *   ISO جدید از تاریخ شمسیِ t همیشه lexicographically باز می‌باخت → نسخهٔ
 *   ابطال‌نشدهٔ دستگاه دیگر همیشه برنده. رکوردهای قدیمی هم cd نداشتند → مسیر
 *   فرمان/tombstone هرگز فعال نبود.
 *   راه‌حل: PL به مسیر canonical رفت + قاعدهٔ void-wins + cd برای PLهای جدید و
 *   backfill در ابطال/merge + plDelete با tombstone archive_purge (identities،
 *   بدون aliases — alias در فیلتر cross-collection substring است و شمارهٔ PL در
 *   timeline پروژه هست).
 *
 * رفتاری: بوت vm از crm/sync.js (همان هارنس tester329) و ptfSmartMerge واقعی؛
 * جاروب تعمیر با فروشنی از salesfiles.js به‌صورت ایزوله (IIFE انتها).
 * حالت قدیم ۰/N — حالت جدید N/N. */
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }

/* ── هارنس: بوت sync.js در vm با استاب‌های حداقلی (الگوی tester329) ── */
function bootSync(storeExtra) {
  var store = Object.assign({
    ptf_crm_token: 'token',
    ptf_sync_dirty: '{}'
  }, storeExtra || {});
  var intervalFns = [];
  var ctx = {
    console: console, JSON: JSON, Math: Math, Array: Array, Object: Object, String: String, Number: Number, Date: Date, Promise: Promise,
    navigator: { sendBeacon: function () {} },
    localStorage: {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
      setItem: function (k, v) { store[k] = String(v); },
      removeItem: function (k) { delete store[k]; }
    },
    curSession: function () { return { user: 't', name: 'تستر' }; },
    curRole: function () { return 'manager'; },
    getData: function (k) { try { return JSON.parse(store[k] || '[]'); } catch (e) { return []; } },
    setData: function (k, v) { store[k] = JSON.stringify(v); },
    document: {
      hidden: false, activeElement: null, hasFocus: function () { return true; },
      querySelector: function () { return null; },
      getElementById: function (id) { return id === 'crmL' ? { style: { display: 'block' } } : null; },
      addEventListener: function () {}, body: { appendChild: function () {} },
      documentElement: { style: { setProperty: function () {} } }
    },
    addEventListener: function () {},
    setInterval: function (fn) { intervalFns.push(fn); return intervalFns.length; },
    clearInterval: function () {}, clearTimeout: clearTimeout, setTimeout: setTimeout,
    fetch: function () { return Promise.resolve({ json: function () { return Promise.resolve({ ok: true, rev: 1 }); } }); },
    ptfToast: function () {}, audit: function () {}, addLog: function () {},
    ptfUpdateGuardCounts: function () {}, updateInboxBadge: function () {}
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'crm/sync.js'), 'utf8'), ctx, { filename: 'crm/sync.js' });
  ctx.__store = store;
  return ctx;
}

/* ═══ ① هزینهٔ حذف‌شده دیگر با merge برنمی‌گردد (tombstone) ═══ */
(function () {
  var ctx = bootSync();
  var local = JSON.stringify([{ cd: 'D-1', st: 'won', costEvents: [{ cd: 'C2', amt: 200, t: 'x' }], timeline: [{ tx: 'del' }], _costTomb: { C1: '2026-09-01T10:00:00.000Z' } }]);
  /* نسخهٔ کهنهٔ «کامل‌تر» (سرور/همکار) — بدون tomb، با هزینهٔ حذف‌شده + یک ردیف تکراری C2 */
  var remote = JSON.stringify([{ cd: 'D-1', st: 'won', costEvents: [{ cd: 'C1', amt: 100, t: 'x' }, { cd: 'C2', amt: 200, t: 'x' }, { cd: 'C2', amt: 200, t: 'x', updatedT: '2026-09-02T08:00:00.000Z' }], timeline: [{ tx: 'del' }, { tx: 'old' }] }]);
  var m = JSON.parse(ctx.ptfSmartMerge('ptf_crm_deals', local, remote))[0];
  T('CE: هزینهٔ tombstoneشده (C1) در merge زنده نمی‌شود', m.costEvents.every(function (e) { return e.cd !== 'C1'; }), JSON.stringify(m.costEvents));
  T('CE: ددوب هم‌کد (C2) — فقط یک C2 می‌ماند', m.costEvents.filter(function (e) { return e.cd === 'C2'; }).length === 1, JSON.stringify(m.costEvents));
  T('CE: نسخهٔ ویرایش‌شدهٔ C2 (updatedT) برندهٔ ددوب است', m.costEvents.filter(function (e) { return e.cd === 'C2'; })[0].updatedT === '2026-09-02T08:00:00.000Z');
  T('CE: نقشهٔ tomb روی رکورد ماندگار سفر می‌کند', m._costTomb && m._costTomb.C1 === '2026-09-01T10:00:00.000Z');
  /* رفت‌وبرگشت: نسخهٔ mergeشده دوباره با کهنه merge شود → همچنان بدون C1 (idempotent) */
  var m2 = JSON.parse(ctx.ptfSmartMerge('ptf_crm_deals', JSON.stringify([m]), remote))[0];
  T('CE: merge دوم هم C1 را برنمی‌گرداند (رفت‌وبرگشت)', m2.costEvents.every(function (e) { return e.cd !== 'C1'; }) && m2.costEvents.filter(function (e) { return e.cd === 'C2'; }).length === 1, JSON.stringify(m2.costEvents));
})();

/* ═══ ② قواعد winner/هویت برای بقیهٔ کلیدهای کانونیکال دست‌نخورده ═══ */
(function () {
  var ctx = bootSync();
  var local = JSON.stringify([{ no: 'OFF-1', cd: 'X1', items: [{ lineId: 'L1', name: 'a' }] }]);
  var remote = JSON.stringify([{ no: 'OFF-1', cd: 'X1', items: [{ lineId: 'L1', name: 'a' }, { lineId: 'L1', name: 'a' }] }]);
  var m = JSON.parse(ctx.ptfSmartMerge('ptf_crm_offers', local, remote))[0];
  T('REG: offers همچنان atomic-snapshot است (dedup خط تکراری)', m.items.length === 1, JSON.stringify(m.items));
})();

/* ═══ ③ ابطال پکینگ‌لیست در merge می‌ماند (void-wins + canonical) ═══ */
(function () {
  var ctx = bootSync();
  /* محلی: PL قدیمی بدون cd که ابطال شده (مثل plVoid جدید: cd backfill + ts ISO) */
  var local = JSON.stringify([{ no: 'PL-1405-003', cd: 'PL-1405-003', offerNo: 'OFF-9', t: '۱۴۰۵/۶/۱۱', voided: true, voidWhy: 'تست', voidT: '۱۴۰۵/۶/۱۲', voidedISO: '2026-09-02T08:00:00.000Z', ts: '2026-09-02T08:00:00.000Z', lines: [{ qty: 5 }] }]);
  /* ریموت: همان PL ابطال‌نشده با تاریخ شمسی (ISO از تاریخ شمسی lexicographically می‌بازد — دام قدیمی) */
  var remote = JSON.stringify([{ no: 'PL-1405-003', offerNo: 'OFF-9', t: '۱۴۰۵/۶/۱۱', lines: [{ qty: 5 }] }]);
  var m = JSON.parse(ctx.ptfSmartMerge('ptf_crm_packinglists', local, remote));
  T('PL: ابطال در merge برنده می‌شود (void-wins)', m.length === 1 && m[0].voided === true, JSON.stringify(m));
  T('PL: cd روی رکورد قدیمی backfill شد (مسیر فرمان فعال)', m[0].cd === 'PL-1405-003');
  /* رکورد دیگرِ مجموعه بدون ابطال، دست‌نخورده */
  var l2 = JSON.stringify([{ no: 'PL-1405-003', cd: 'PL-1405-003', voided: true, voidedISO: '2026-09-02T08:00:00.000Z', ts: '2026-09-02T08:00:00.000Z' }, { no: 'PL-1405-004', cd: 'PL-1405-004', t: 'x' }]);
  var r2 = JSON.stringify([{ no: 'PL-1405-003' }, { no: 'PL-1405-004', t: 'x', remarks: 'r' }]);
  var m2 = JSON.parse(ctx.ptfSmartMerge('ptf_crm_packinglists', l2, r2));
  T('PL: PL دیگر مجموعه union/برندهٔ عادی می‌گیرد (remarks آمد)', m2.length === 2 && (m2.filter(function (x) { return x.no === 'PL-1405-004'; })[0] || {}).remarks === 'r', JSON.stringify(m2));
})();

/* ═══ ④ حذف قطعی PL: tombstone archive_purge (identities، بدون aliases) ═══ */
(function () {
  var ctx = bootSync({
    ptf_crm_packinglists: JSON.stringify([{ no: 'PL-1405-009', cd: 'PL-1405-009', offerNo: 'OFF-9' }, { no: 'PL-1405-010', offerNo: 'OFF-9' }]),
    ptf_crm_deleted_archive: JSON.stringify([{ _id: 'DEL-X1', kind: 'archive_purge', collection: 'ptf_crm_packinglists', id: 'PL-1405-009', cd: 'PL-1405-009', identities: { ptf_crm_packinglists: ['PL-1405-009'] }, reason: 'حذف قطعی پکینگ لیست PL-1405-009' }]),
    ptf_crm_projects: JSON.stringify([{ cd: 'PRJ-1', offerNo: 'OFF-9', timeline: [{ tx: 'پکینگ لیست PL-1405-009 باطل شد' }] }])
  });
  var out = JSON.parse(ctx.ptfApplyDeletionTombstones('ptf_crm_packinglists', ctx.__store.ptf_crm_packinglists));
  T('PL-DEL: رکورد دارای tombstone از مجموعه حذف می‌شود', out.every(function (x) { return x.no !== 'PL-1405-009'; }), JSON.stringify(out));
  T('PL-DEL: رکورد بدون tombstone می‌ماند', out.some(function (x) { return x.no === 'PL-1405-010'; }));
  /* identities بدون aliases → هیچ کلید دیگری (حتی پروژه‌ای که شمارهٔ PL در timeline اش است) قربانی نمی‌شود */
  var prj = JSON.parse(ctx.ptfApplyDeletionTombstones('ptf_crm_projects', ctx.__store.ptf_crm_projects));
  T('PL-DEL: بدون aliases → پروژهٔ دارای شمارهٔ PL در timeline زنده می‌ماند', prj.length === 1, JSON.stringify(prj));
  /* مسیر canonical هم tombstone را اعمال می‌کند (merge واقعی) */
  var stale = JSON.stringify([{ no: 'PL-1405-009', cd: 'PL-1405-009', offerNo: 'OFF-9', t: 'x' }]);
  var m = JSON.parse(ctx.ptfSmartMerge('ptf_crm_packinglists', JSON.stringify([]), stale));
  T('PL-DEL: merge با نسخهٔ کهنه، رکورد tombstoneشده را زنده نمی‌کند', m.every(function (x) { return x.no !== 'PL-1405-009'; }), JSON.stringify(m));
})();

/* ═══ ⑤ جاروب تعمیر: ددوب + یتیم تنخواه + idempotency ═══ */
(function () {
  var salesSrc = fs.readFileSync(path.join(ROOT, 'crm/salesfiles.js'), 'utf8');
  var i0 = salesSrc.indexOf('window.ptfDealCostRepairSweep');
  T('SWEEP: تابع جاروب در salesfiles.js تعریف شده', i0 > -1);
  if (i0 < 0) return;
  /* فروشنی از تعریف تا انتها (IIFE بسته می‌شود در انتها) */
  var fnSlice = salesSrc.slice(i0, salesSrc.lastIndexOf('})();'));
  var store = {
    ptf_crm_deals: JSON.stringify([
      { cd: 'D-1', costEvents: [
        { cd: 'CST-1', amt: 100, t: 'a' },
        { cd: 'CST-1', amt: 100, t: 'a' },                      /* تکرار هم‌کد */
        { cd: 'CST-2', amt: 50, t: 'b' }                        /* سالم */
      ] },
      { cd: 'D-2', costEvents: [
        { cd: 'PC-PTY-1', fromPetty: true, cd2: 'x', pettyCd: '', amt: 70 } /* رویداد قدیمی fromPetty با cd=خود petty */
      ] }
    ]),
    ptf_crm_petty: JSON.stringify([
      { cd: 'PC-PTY-1', amt: 70, st: 'ok', dealRef: 'D-9' }     /* لینک‌شده به پروندهٔ دیگر → رویداد در D-2 یتیم */
    ]),
    ptf_crm_saved: '[]'
  };
  var saved = [];
  var ctx2 = {
    console: console, JSON: JSON, Math: Math, Array: Array, Object: Object, String: String, Number: Number, Date: Date,
    localStorage: { getItem: function (k) { return store[k] !== undefined ? String(store[k]) : null; }, setItem: function (k, v) { store[k] = String(v); }, removeItem: function (k) { delete store[k]; } },
    getData: function (k) { try { return JSON.parse(store[k] || '[]'); } catch (e) { return []; } },
    setData: function (k, v) { store[k] = JSON.stringify(v); saved.push(k); },
    audit: function () {},
    window: {}
  };
  ctx2.window = ctx2;
  ctx2.window.ptfEntitySaveCollection = function (k, v) { store[k] = JSON.stringify(v); saved.push(k); };
  vm.createContext(ctx2);
  try {
    vm.runInContext(fnSlice + '\nwindow.ptfDealCostRepairSweep(true);', ctx2, { filename: 'sweep-slice.js' });
    var deals = JSON.parse(store.ptf_crm_deals);
    var d1 = deals.filter(function (d) { return d.cd === 'D-1'; })[0];
    var d2 = deals.filter(function (d) { return d.cd === 'D-2'; })[0];
    T('SWEEP: تکرار هم‌کد CST-1 حذف شد (فقط یکی ماند)', d1.costEvents.filter(function (e) { return e.cd === 'CST-1'; }).length === 1, JSON.stringify(d1.costEvents));
    T('SWEEP: هزینهٔ سالم CST-2 دست‌نخورده', d1.costEvents.some(function (e) { return e.cd === 'CST-2'; }));
    T('SWEEP: تکرار هم‌کد tombstone نمی‌گیرد (نسخهٔ مشروع همان cd زنده می‌ماند)', !d1._costTomb || !d1._costTomb['CST-1'], JSON.stringify(d1._costTomb));
    T('SWEEP: رویداد یتای تنخواه (لینک به D-9) از D-2 حذف شد', (d2.costEvents || []).every(function (e) { return e.cd !== 'PC-PTY-1'; }), JSON.stringify(d2.costEvents));
    T('SWEEP: tombstone یتیم روی D-2 نوشته شد (بازگشت‌ناپذیر در merge)', d2._costTomb && d2._costTomb['PC-PTY-1']);
    var flagOk = (JSON.parse(store.ptf_app_flags || '[]')).some(function (x) { return x && x.cd === 'cost_repair_v1'; });
    T('SWEEP: گارد یک‌باره (ptf_app_flags از مسیر لایهٔ داده — A10) ست شد', flagOk);
    /* idempotency: اجرای دوباره با force روی دادهٔ تمیز → تغییری نمی‌کند */
    var before = store.ptf_crm_deals;
    vm.runInContext('window.ptfDealCostRepairSweep(true);', ctx2);
    T('SWEEP: اجرای دوم idempotent است', store.ptf_crm_deals === before);
  } catch (e) {
    T('SWEEP: اجرای جاروب بدون خطا', false, String(e));
  }
})();

/* ═══ ⑥ قراردادهای ایستا: همهٔ مسیرهای حذف tombstone می‌نویسند ═══ */
(function () {
  var fw = fs.readFileSync(path.join(ROOT, 'crm/finance-write-guard.js'), 'utf8');
  T('SRC: ptfDealCostTomb در finance-write-guard تعریف شده', fw.indexOf('window.ptfDealCostTomb = function') > -1 && fw.indexOf("deal._costTomb[String(cd)] = new Date().toISOString()") > -1);
  T('SRC: ptfDealCostSync حذف از پروندهٔ قبلی tombstone می‌نویسد', /if \(prevDeal && prevDeal !== nextDeal\)[\s\S]{0,700}window\.ptfDealCostTomb\(od, ev\.cd\)/.test(fw));
  var sf = fs.readFileSync(path.join(ROOT, 'crm/salesfiles.js'), 'utf8');
  T('SRC: ptfDealRemoveCost tombstone می‌نویسد', /window\.ptfDealRemoveCost = function[\s\S]{0,2600}window\.ptfDealCostTomb\(d, costCd\)/.test(sf));
  T('SRC: نوار مالی (costSum) بر cd ددوب می‌شود', sf.indexOf('ددوب بر اساس cd پیش از جمع') > -1);
  T('SRC: projection زندهٔ کشو بر cd ددوب می‌شود (COST-DEDUP)', sf.indexOf('(COST-DEDUP)') > -1);
  var bc = fs.readFileSync(path.join(ROOT, 'crm/buycompare.js'), 'utf8');
  T('SRC: ptfProjectCostDel tombstone + پاک‌کردن لینک تنخواه', /window\.ptfProjectCostDel = function[\s\S]{0,4600}window\.ptfDealCostTomb\(d, costCd\)[\s\S]{0,1600}pr\.dealRef = ''/.test(bc));
  var pt = fs.readFileSync(path.join(ROOT, 'crm/petty.js'), 'utf8');
  T('SRC: ptfPettyRemoveDealCostEvent tombstone می‌نویسد', /function ptfPettyRemoveDealCostEvent[\s\S]{0,1200}window\.ptfDealCostTomb\(d, r\.cd\)/.test(pt));
  var pr = fs.readFileSync(path.join(ROOT, 'crm/projects.js'), 'utf8');
  T('SRC: PL جدید cd هم‌ارز no می‌گیرد (مسیر فرمان)', /var plNo = plSerial\(\);[\s\S]{0,200}cd: plNo, no: plNo/.test(pr));
  T('SRC: plVoid د ابطال timestamp ISO می‌نویسد + cd backfill', /function plVoid[\s\S]{0,900}p\.voidedISO = new Date\(\)\.toISOString\(\); p\.ts = p\.voidedISO/.test(pr));
  T('SRC: plDelete با tombstone archive_purge identities (بدون aliases)', /function plDelete[\s\S]{0,2000}kind: 'archive_purge', collection: 'ptf_crm_packinglists'[\s\S]{0,400}identities: \{ ptf_crm_packinglists: \[plId\] \}/.test(pr) && !/function plDelete[\s\S]{0,2000}aliases: \[/.test(pr));
  T('SRC: دکمهٔ 🗑 حذف در prjRenderPls', pr.indexOf("onclick=\"plDelete(\\'' + pl.no + '\\')\">🗑️") > -1);
  var sy = fs.readFileSync(path.join(ROOT, 'crm/sync.js'), 'utf8');
  T('SRC: packinglists در مسیر canonical merge', /key === 'ptf_crm_petty' \|\| key === 'ptf_crm_packinglists'\) return ptfMergeByCodeCanonical/.test(sy));
  T('SRC: قاعدهٔ PL void-wins در ptfMergeBusinessRecord', /key === 'ptf_crm_packinglists' && !!\(a && a\.voided\) !== !!\(b && b\.voided\)/.test(sy));
  T('SRC: کانونیکال‌سازی costEvents در merge (COST-EVENT-TOMB)', sy.indexOf('(COST-EVENT-TOMB') > -1 && sy.indexOf('costTomb[cd]') > -1);
  T('SRC: سقف ۲۰۰ مدخل tomb', sy.indexOf('tombKeys.length > 200') > -1);
  var fh = fs.readFileSync(path.join(ROOT, 'crm/finance-helpers.js'), 'utf8');
  var fc = fs.readFileSync(path.join(ROOT, 'crm/finance-core.js'), 'utf8');
  T('SRC: dealTotalCosts (helpers) ددوب cd بین سه منبع', fh.indexOf('seenCd[k]') > -1);
  T('SRC: dealTotalCosts (core) ددوب cd بین سه منبع', fc.indexOf('seenCd[k]') > -1);
})();

/* ═══ ⑦ رفتار قدیم برای اثبات ریشه (doc-evidence): بدون وصله union چیزی نمی‌کشت ═══ */
(function () {
  /* شبیه‌سازی دقیق منطق قبلی ptfMergeArrayUnique (امضای کامل-JSON) — ریشهٔ تکرار */
  function oldUnion(a, b) {
    var out = [], seen = {};
    function add(x) { var sig; try { sig = JSON.stringify(x); } catch (e) { sig = String(x); } if (!seen[sig]) { seen[sig] = 1; out.push(x); } }
    (Array.isArray(a) ? a : []).forEach(add); (Array.isArray(b) ? b : []).forEach(add);
    return out;
  }
  var evA = { cd: 'C2', amt: 200, t: 'x' };
  var evB = { cd: 'C2', amt: 200, t: 'x', updatedT: 'z' }; /* تفاوت جزئی → دو نسخه */
  T('ROOT: union امضای کامل-JSON تفاوت جزئی را تکرار می‌کرد (اثبات ریشه)', oldUnion([evA], [evB]).length === 2);
})();

console.log('=== tester583: ' + p + ' PASS / ' + f + ' FAIL ===');
process.exit(f ? 1 : 0);
