#!/usr/bin/env node
'use strict';
/* tester610 — v34.38.5: ریسک‌های هم‌خانوادهٔ «هزینهٔ حذف‌شده برمی‌گردد» در بایگانی و
   گزارش سال مالی (PRJ-COST-RESURRECTION):
   ① حذف هزینهٔ بایگانی (prjPostCostDel) باید سنگ‌قبر بنویسد و merge/pull آن را ماندگار کند؛
   ② جمع هزینهٔ مستقیم در گزارش سال مالی (fiscalDirectProjectCosts) باید هزینهٔ حذف‌شده و
      پیش‌پرداخت/advance را نشمارد — هم‌سنخ منبع واحد v34.38.2.
   رفتاری: بوت finance-write-guard.js در vm (همان هارنس tester609) برای
   ptfProjectsApplyCostTombstones + قراردادهای ایستا برای merge/pull/projects/archive/fiscal. */
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }

/* ── هارنس: بوت finance-write-guard.js (الگوی tester609) ── */
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

/* ═══ ① ptfProjectsApplyCostTombstones: pull با نسخهٔ کهنهٔ سرور حذف‌شده را برنمی‌گرداند ═══ */
(function () {
  var ctx = bootFwg();
  var local = JSON.stringify([
    { cd: 'P-1', st: 'archived', costEvents: [{ cd: 'CE1', amt: 100 }], postArchiveCosts: [{ cd: 'PAC2', amt: 50 }], _costTomb: { PAC1: '2026-09-01T10:00:00.000Z', CE0: '2026-09-01T09:00:00.000Z' } }
  ]);
  /* نسخهٔ کهنهٔ سرور: PAC1 حذف‌شده + تکرار PAC2 + CE0 حذف‌شده + رکورد بدون تغییر */
  var server = JSON.stringify([
    { cd: 'P-1', st: 'archived', costEvents: [{ cd: 'CE0', amt: 1 }, { cd: 'CE1', amt: 100 }], postArchiveCosts: [{ cd: 'PAC1', amt: 40 }, { cd: 'PAC2', amt: 50 }, { cd: 'PAC2', amt: 50, updatedT: 'z' }] },
    { cd: 'P-2', st: 'archived', costEvents: [{ cd: 'CE9', amt: 9 }] }
  ]);
  var out = JSON.parse(ctx.ptfProjectsApplyCostTombstones(local, server));
  var p1 = out.filter(function (x) { return x.cd === 'P-1'; })[0];
  var p2 = out.filter(function (x) { return x.cd === 'P-2'; })[0];
  T('PULL-PRJ: هزینهٔ پسابایگانیِ حذف‌شده (PAC1) از سرور حذف می‌شود', p1.postArchiveCosts.every(function (e) { return e.cd !== 'PAC1'; }), JSON.stringify(p1.postArchiveCosts));
  T('PULL-PRJ: هزینهٔ پروندهٔ حذف‌شده (CE0) از costEvents سرور حذف می‌شود', p1.costEvents.every(function (e) { return e.cd !== 'CE0'; }), JSON.stringify(p1.costEvents));
  T('PULL-PRJ: تکرار هم‌کد پسابایگانی (PAC2) ددوب می‌شود', p1.postArchiveCosts.filter(function (e) { return e.cd === 'PAC2'; }).length === 1, JSON.stringify(p1.postArchiveCosts));
  T('PULL-PRJ: نقشهٔ _costTomb اجتماع‌شده روی رکورد می‌نشیند', p1._costTomb && p1._costTomb.PAC1 === '2026-09-01T10:00:00.000Z' && p1._costTomb.CE0 === '2026-09-01T09:00:00.000Z');
  T('PULL-PRJ: رکورد بدون tomb دست‌نخورده می‌ماند (P-2)', p2.costEvents.length === 1 && p2.costEvents[0].cd === 'CE9' && !p2._costTomb, JSON.stringify(p2));
  T('PULL-PRJ: بدون tomb محلی/سروری → عین رشتهٔ سرور برگردد', ctx.ptfProjectsApplyCostTombstones(server, server) === server);
  T('PULL-PRJ: ورودی خراب → برگرداندن سرور', ctx.ptfProjectsApplyCostTombstones('{bad', server) === server);
  T('PULL-PRJ: رفت‌وبرگشت idempotent', (function () { var a = ctx.ptfProjectsApplyCostTombstones(local, JSON.stringify(out)); return a === JSON.stringify(out) || JSON.stringify(JSON.parse(a)) === JSON.stringify(out); })());
})();

/* ═══ ② قراردادهای ایستا: merge / pull / projects / archive / fiscal ═══ */
(function () {
  var fw = fs.readFileSync(path.join(ROOT, 'crm/finance-write-guard.js'), 'utf8');
  T('SRC: ptfProjectsApplyCostTombstones تعریف شده', fw.indexOf('window.ptfProjectsApplyCostTombstones = function') > -1);

  var sy = fs.readFileSync(path.join(ROOT, 'crm/sync.js'), 'utf8');
  T('SRC: merge برای ptf_crm_projects سنگ‌قبر هزینه را اجتماع و اعمال می‌کند', /key === 'ptf_crm_projects'/.test(sy) && /var pTomb = \{\}/.test(sy) && /\['costEvents', 'postArchiveCosts'\]\.forEach/.test(sy));
  T('SRC: pull پیش از wr، _costTomb را روی نسخهٔ سرور پروژه اعمال می‌کند', /ptfProjectsApplyCostTombstones\(curStr, newStr\)/.test(sy));

  var prj = fs.readFileSync(path.join(ROOT, 'crm/projects.js'), 'utf8');
  T('SRC: prjPostCostDel سنگ‌قبر _costTomb می‌نویسد', prj.indexOf('pp._costTomb = pp._costTomb || {};') > -1 && prj.indexOf('pp._costTomb[costCd] = faDateTime();') > -1);
  T('SRC: prjAllCosts هزینهٔ tombstoneشده را فیلتر می‌کند', prj.indexOf('function prjAllCosts') > -1 && prj.indexOf('tomb[String(x.cd)]') > -1);

  var sf = fs.readFileSync(path.join(ROOT, 'crm/salesfiles.js'), 'utf8');
  T('SRC: sfArchive دانش حذف هزینه (_costTomb) را به بایگانی منتقل می‌کند', sf.indexOf("rec._costTomb = Object.assign({}, r._costTomb)") > -1);

  var fiscal = fs.readFileSync(path.join(ROOT, 'crm/fiscal.js'), 'utf8');
  T('SRC: fiscalDirectProjectCosts سنگ‌قبر پرونده را می‌بیند (dealTomb)', fiscal.indexOf('var dealTomb = (d && d._costTomb) || {};') > -1);
  T('SRC: fiscalDirectProjectCosts سنگ‌قبر بایگانی را می‌بیند (prjTomb)', fiscal.indexOf('var prjTomb = (p && p._costTomb) || {};') > -1);
  T('SRC: fiscalDirectProjectCosts هزینهٔ tombstoneشده را رد می‌کند', fiscal.indexOf('if (cdc && tomb[cdc]) return;') > -1);
  T('SRC: fiscalDirectProjectCosts پیش‌پرداخت/advance را رد می‌کند', fiscal.indexOf('if (isAdv(c)) return;') > -1);

  var gate = fs.readFileSync(path.join(ROOT, '_tools/uat/run-ci-gate.js'), 'utf8');
  T('SRC: tester610 در گیت CI ثبت شده است', gate.indexOf('tester610-v34.38.3-prj-cost-resurrection.js') > -1);
})();

console.log('=== tester610: ' + p + ' PASS / ' + f + ' FAIL ===');
process.exit(f ? 1 : 0);
