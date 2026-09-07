#!/usr/bin/env node
'use strict';
/* tester609 — v34.38.2: «جمع کل هزینه‌های مستقیم پرونده درست نیست» و «هزینهٔ حذف‌شده
 * (به‌ویژه لینک‌شده به تنخواه) با رفرش برمی‌گردد».
 *
 * ریشه (RCA — ARENA-SALESFILE-COST-TOTAL-AND-DELETE-RESURRECTION-RCA-2026-09-07.md):
 * ① _costTomb (v34.29.8) فقط در مسیر merge (ptfMergeBusinessRecord) اعمال می‌شد؛
 *   پروجکشن زندهٔ تنخواه در کشوی پرونده (salesfiles.js) و مسیر «جایگزینی مستقیم»
 *   pull (sync.js: wr(k,newStr)) هیچ‌کدام آن را نمی‌دیدند ⇒ رکورد حذف‌شده از هر
 *   مسیر غیر-merge دوباره دیده می‌شد.
 * ② سه جمع ناهمسان (نوار مالی costSum / dealTotalCosts / هوک سود buycompare با
 *   Math.max بدون ددوب) عددهای متفاوتی می‌ساختند.
 *
 * راه‌حل (v34.38.2):
 *   - منبع واحد خواندن/جمع هزینهٔ قابل‌نمایش: ptfDealVisibleCosts / ptfDealCostSumIRR /
 *     ptfCostListSumIRR / ptfDealsApplyCostTombstones در finance-write-guard.js.
 *   - نوار مالی + فهرست عملیات + پروجکشن تنخواه از همین منبع واحد می‌خوانند.
 *   - مسیر pull برای ptf_crm_deals پیش از wr، _costTomb محلی/سروری را اجتماع و روی
 *     costEvents سرور اعمال می‌کند (نسخهٔ کهنهٔ سرور، حذف‌شده را برنمی‌گرداند).
 *   - هوک سود Math.max → جمع، با ددوب cd + احترام به _costTomb + حذف advance.
 *   - dealTotalCosts (helpers/core) هم‌قاعده: tombstone + advance + ددوب cd.
 *   - جاروب تعمیر نسخه‌دار شد (cost_repair_v1 با v:2) تا برگشته‌های پیشین پاک شوند.
 *
 * رفتاری: بوت finance-write-guard.js در vm (همان هارنس tester583) + قراردادهای ایستا.
 * حالت قدیم ۰/N — حالت جدید N/N. */
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }

/* ── هارنس: بوت finance-write-guard.js در vm با استاب‌های حداقلی (الگوی tester583) ── */
function bootFwg(store) {
  store = store || {};
  var ctx = {
    console: console, JSON: JSON, Math: Math, Array: Array, Object: Object, String: String, Number: Number, Date: Date,
    getData: function (k) { try { return JSON.parse(store[k] || '[]'); } catch (e) { return []; } },
    setData: function (k, v) { store[k] = JSON.stringify(v); },
    localStorage: {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
      setItem: function (k, v) { store[k] = String(v); },
      removeItem: function (k) { delete store[k]; }
    },
    faDateTime: function () { return new Date().toISOString(); },
    curSession: function () { return { user: 't', name: 'تستر' }; },
    window: {}
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'crm/finance-write-guard.js'), 'utf8'), ctx, { filename: 'crm/finance-write-guard.js' });
  ctx.__store = store;
  return ctx;
}

/* ═══ ① ptfDealVisibleCosts: فیلتر tombstone + ددوب cd ═══ */
(function () {
  var ctx = bootFwg();
  var deal = {
    cd: 'D-1',
    costEvents: [
      { cd: 'C1', amt: 100 },
      { cd: 'C1', amt: 100, updatedT: '2026-09-02T08:00:00.000Z' }, /* تکرار هم‌کد */
      { cd: 'C2', amt: 50 },
      { cd: 'C3', amt: 30 }
    ],
    _costTomb: { C2: '2026-09-01T10:00:00.000Z', C4: 'x' } /* C2 حذف‌شده؛ C4 اصلاً نیست */
  };
  var vis = ctx.ptfDealVisibleCosts(deal);
  T('VIS: هزینهٔ tombstoneشده (C2) نمایش داده نمی‌شود', vis.every(function (e) { return e.cd !== 'C2'; }), JSON.stringify(vis));
  T('VIS: تکرار هم‌کد (C1) فقط یک‌بار', vis.filter(function (e) { return e.cd === 'C1'; }).length === 1, JSON.stringify(vis));
  T('VIS: هزینهٔ سالم (C3) می‌ماند', vis.some(function (e) { return e.cd === 'C3'; }));
  T('VIS: ورودی null/خالی → []', JSON.stringify(ctx.ptfDealVisibleCosts(null)) === '[]' && JSON.stringify(ctx.ptfDealVisibleCosts({})) === '[]');
})();

/* ═══ ② ptfDealCostSumIRR: جمع واحد + مبلغ زندهٔ تنخواه + حذف advance + احترام به tomb ═══ */
(function () {
  var store = {
    ptf_crm_petty: JSON.stringify([
      { cd: 'PTY-1', amt: 70, st: 'ok', dealRef: 'D-1' }, /* لینک‌شدهٔ کهنه — حذف‌شده از پرونده */
      { cd: 'PTY-2', amt: 70, st: 'ok', dealRef: 'D-2' }, /* پروجکشن مشروع */
      { cd: 'PTY-3', amt: 150, st: 'ok', dealRef: 'D-3' }  /* مبلغ زندهٔ بیشتر از snapshot */
    ])
  };
  var ctx = bootFwg(store);
  /* پروجکشن تنخواهِ حذف‌شده با dealRef کهنه بازسازی نمی‌شود */
  var d1 = { cd: 'D-1', costEvents: [], _costTomb: { 'PTY-1': '2026-09-01T10:00:00.000Z' } };
  T('SUM: تنخواهِ tombstoneشده با dealRef کهنه جمع نمی‌شود (بازگشت ممنوع)', ctx.ptfDealCostSumIRR(d1) === 0, String(ctx.ptfDealCostSumIRR(d1)));
  /* پروجکشن مشروع تنخواه (بدون tomb) شمرده می‌شود */
  var d2 = { cd: 'D-2', costEvents: [] };
  T('SUM: پروجکشن زندهٔ تنخواه (dealRef) شمرده می‌شود', ctx.ptfDealCostSumIRR(d2) === 70, String(ctx.ptfDealCostSumIRR(d2)));
  /* مبلغ زندهٔ تنخواه بر snapshot کهنهٔ costEvent برنده است */
  var d3 = { cd: 'D-3', costEvents: [{ cd: 'PTY-3', pettyCd: 'PTY-3', fromPetty: true, amt: 100 }] };
  T('SUM: مبلغ زندهٔ تنخواه (150) جای snapshot کهنه (100)', ctx.ptfDealCostSumIRR(d3) === 150, String(ctx.ptfDealCostSumIRR(d3)));
  /* advance/پیش‌پرداخت شمرده نمی‌شود */
  var d4 = { cd: 'D-4', costEvents: [{ cd: 'ADV-1', amt: 500, cat: 'advance' }, { cd: 'C-ok', amt: 100 }] };
  T('SUM: advance/پیش‌پرداخت شمرده نمی‌شود', ctx.ptfDealCostSumIRR(d4) === 100, String(ctx.ptfDealCostSumIRR(d4)));
  /* null → 0 */
  T('SUM: null → 0', ctx.ptfDealCostSumIRR(null) === 0);
})();

/* ═══ ③ ptfCostListSumIRR: جمع تک‌لیستی هم‌قاعده (tombstone + advance + ددوب) ═══ */
(function () {
  var ctx = bootFwg();
  var deal = { cd: 'D-1', _costTomb: { C1: 'x' } };
  var list = [
    { cd: 'C1', amt: 100 },                       /* tombstone → رد */
    { cd: 'C2', amt: 50 },
    { cd: 'C2', amt: 50, updatedT: 'z' },         /* تکرار → رد */
    { cd: 'ADV', amt: 400, cat: 'advance' },      /* advance → رد */
    { amt: 20 }                                    /* بدون cd → شمرده */
  ];
  T('LIST: tombstone + ددوب + advance + بدون-cd', ctx.ptfCostListSumIRR(list, deal) === 70, String(ctx.ptfCostListSumIRR(list, deal)));
})();

/* ═══ ④ ptfDealsApplyCostTombstones: pull با نسخهٔ کهنهٔ سرور حذف‌شده را برنمی‌گرداند ═══ */
(function () {
  var ctx = bootFwg();
  var local = JSON.stringify([
    { cd: 'D-1', st: 'won', costEvents: [{ cd: 'C2', amt: 200 }], _costTomb: { C1: '2026-09-01T10:00:00.000Z' } },
    { cd: 'D-2', st: 'won', costEvents: [{ cd: 'C9', amt: 9 }] }
  ]);
  /* نسخهٔ کهنهٔ سرور: C1 حذف‌شده + تکرار C2 + D-2 بدون تغییر */
  var server = JSON.stringify([
    { cd: 'D-1', st: 'won', costEvents: [{ cd: 'C1', amt: 100 }, { cd: 'C2', amt: 200 }, { cd: 'C2', amt: 200, updatedT: 'z' }] },
    { cd: 'D-2', st: 'won', costEvents: [{ cd: 'C9', amt: 9 }] }
  ]);
  var out = JSON.parse(ctx.ptfDealsApplyCostTombstones(local, server));
  var d1 = out.filter(function (x) { return x.cd === 'D-1'; })[0];
  var d2 = out.filter(function (x) { return x.cd === 'D-2'; })[0];
  T('PULL: هزینهٔ حذف‌شدهٔ محلی (C1) از نسخهٔ کهنهٔ سرور حذف می‌شود', d1.costEvents.every(function (e) { return e.cd !== 'C1'; }), JSON.stringify(d1.costEvents));
  T('PULL: تکرار هم‌کد سرور (C2) ددوب می‌شود', d1.costEvents.filter(function (e) { return e.cd === 'C2'; }).length === 1, JSON.stringify(d1.costEvents));
  T('PULL: نقشهٔ _costTomb اجتماع‌شده روی رکورد می‌نشیند', d1._costTomb && d1._costTomb.C1 === '2026-09-01T10:00:00.000Z');
  T('PULL: رکورد بدون tomb دست‌نخورده می‌ماند (D-2)', d2.costEvents.length === 1 && !d2._costTomb, JSON.stringify(d2));
  /* بدون تغییر = برگرداندن عین رشتهٔ سرور (نه JSON re-string) */
  var unchanged = ctx.ptfDealsApplyCostTombstones(server, server);
  T('PULL: بدون tomb محلی/سروری → عین رشتهٔ سرور برگردد', unchanged === server);
  /* خطا = برگرداندن سرور */
  T('PULL: ورودی خراب → برگرداندن سرور', ctx.ptfDealsApplyCostTombstones('{bad', server) === server);
  /* رفت‌وبرگشت idempotent: اعمال دوباره روی خروجی تغییری نمی‌کند */
  var again = ctx.ptfDealsApplyCostTombstones(local, JSON.stringify(out));
  T('PULL: رفت‌وبرگشت idempotent', again === JSON.stringify(out) || JSON.stringify(JSON.parse(again)) === JSON.stringify(out));
})();

/* ═══ ⑤ قراردادهای ایستا: همهٔ نقاط مصرف از منبع واحد می‌خوانند ═══ */
(function () {
  var fw = fs.readFileSync(path.join(ROOT, 'crm/finance-write-guard.js'), 'utf8');
  T('SRC: ptfDealVisibleCosts تعریف شده (منبع واحد خواندن)', fw.indexOf('window.ptfDealVisibleCosts = function') > -1);
  T('SRC: ptfDealCostSumIRR تعریف شده (منبع واحد جمع)', fw.indexOf('window.ptfDealCostSumIRR = function') > -1);
  T('SRC: ptfCostListSumIRR تعریف شده (جمع تک‌لیستی)', fw.indexOf('window.ptfCostListSumIRR = function') > -1);
  T('SRC: ptfDealsApplyCostTombstones تعریف شده (pull)', fw.indexOf('window.ptfDealsApplyCostTombstones = function') > -1);

  var sf = fs.readFileSync(path.join(ROOT, 'crm/salesfiles.js'), 'utf8');
  T('SRC: نوار مالی از منبع واحد (ptfDealCostSumIRR) می‌خواند', /typeof window\.ptfDealCostSumIRR === 'function'/.test(sf) && sf.indexOf('window.ptfDealCostSumIRR(r)') > -1);
  T('SRC: فهرست عملیات از منبع واحد (ptfDealVisibleCosts) می‌خواند', sf.indexOf('window.ptfDealVisibleCosts(r)') > -1);
  T('SRC: پروجکشن زندهٔ تنخواه به _costTomb گره خورده', /if \(\(r\._costTomb \|\| \{\}\)\[p\.cd\]\) return;/.test(sf));
  T('SRC: جاروب تعمیر نسخه‌دار شد (v: 2 روی cost_repair_v1)', /cost_repair_v1' && \(\+\(x\.v \|\| 1\) >= 2\)/.test(sf) && /cd: 'cost_repair_v1', v: 2/.test(sf));

  var sy = fs.readFileSync(path.join(ROOT, 'crm/sync.js'), 'utf8');
  T('SRC: pull پیش از wr، _costTomb را روی نسخهٔ سرور اعمال می‌کند', /ptfDealsApplyCostTombstones\(curStr, newStr\)/.test(sy));

  var bc = fs.readFileSync(path.join(ROOT, 'crm/buycompare.js'), 'utf8');
  T('SRC: هوک سود دیگر Math.max(dealCosts, archCosts) ندارد', bc.indexOf('Math.max(dealCosts, archCosts)') === -1);
  T('SRC: هوک سود از منبع واحد (ptfDealCostSumIRR + ptfCostListSumIRR) می‌خواند', /ptfDealCostSumIRR\(d\)/.test(bc) && /ptfCostListSumIRR\(prj\.costEvents, prj\)/.test(bc));

  var fh = fs.readFileSync(path.join(ROOT, 'crm/finance-helpers.js'), 'utf8');
  var fc = fs.readFileSync(path.join(ROOT, 'crm/finance-core.js'), 'utf8');
  T('SRC: dealTotalCosts (helpers) هم‌قاعده — tombstone + advance + ددوب cd', /tomb\[String\(c\.cd\)\]/.test(fh) && /function isAdv\(c\)/.test(fh) && fh.indexOf('seenCd[k]') > -1);
  T('SRC: dealTotalCosts (core) هم‌قاعده — tombstone + advance + ددوب cd', /tomb\[String\(c\.cd\)\]/.test(fc) && /function isAdv\(c\)/.test(fc) && fc.indexOf('seenCd[k]') > -1);

  var gate = fs.readFileSync(path.join(ROOT, '_tools/uat/run-ci-gate.js'), 'utf8');
  T('SRC: tester609 در گیت CI ثبت شده است', gate.indexOf('tester609-v34.38.2-cost-sum-and-resurrection.js') > -1);
})();

console.log('=== tester609: ' + p + ' PASS / ' + f + ' FAIL ===');
process.exit(f ? 1 : 0);
