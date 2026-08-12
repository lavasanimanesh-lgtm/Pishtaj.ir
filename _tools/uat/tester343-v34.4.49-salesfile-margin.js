'use strict';
var fs = require('fs');
var vm = require('vm');
var assert = require('assert');

var src = fs.readFileSync('crm/salesfiles.js', 'utf8');
assert.ok(src.indexOf('window.ptfSalesFileMargin') > -1, 'margin helper exported');
assert.ok(src.indexOf('window.ptfSalesFileMarginBadge') > -1, 'badge helper exported');
assert.ok(src.indexOf('ptfSalesFileMarginBadge(r)') > -1, 'collapsed card shows margin');
assert.ok(src.indexOf('حاشیه سود') > -1 && src.indexOf('mgHtml') > -1, 'drawer strip shows amount and percent');

function run(deals, profitFn) {
  var store = { ptf_crm_deals: JSON.stringify(deals || []) };
  var ctx = {
    console: console, JSON: JSON, Math: Math, Date: Date, Object: Object, Array: Array, String: String, Number: Number,
    localStorage: {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
      setItem: function (k, v) { store[k] = String(v); },
      removeItem: function (k) { delete store[k]; }
    },
    getData: function (k) {
      if (k === 'ptf_crm_deals') return JSON.parse(store.ptf_crm_deals || '[]');
      return [];
    },
    setData: function () {},
    genCode: function (p) { return p + '-1'; },
    faDateTime: function () { return '1405/05/21'; },
    faDate: function () { return '1405/05/21'; },
    curSession: function () { return { name: 'تست' }; },
    escP: function (v) { return String(v == null ? '' : v); },
    ptfOnClickArg: function (v) { return String(v || ''); },
    audit: function () {},
    ptfProjectProfitIRR: profitFn,
    ptfProjectLossTotal: function (r) {
      return (r.lossEvents || []).reduce(function (s, x) { return s + (+x.amt || 0); }, 0);
    },
    setInterval: function () { return 1; },
    clearInterval: function () {},
    document: { getElementById: function () { return null; }, addEventListener: function () {} },
    window: null
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(src, ctx, { filename: 'crm/salesfiles.js' });
  return ctx;
}

var deal = {
  cd: 'DEAL-1', inqNo: 'RFQ-1', wonOffer: 'CO-1', buyerCo: 'پتروشیمی',
  costEvents: [{ amt: 10000000 }],
  lossEvents: [{ amt: 2000000 }]
};
var ctx = run([deal], function () {
  return { ok: true, complete: true, sellIrr: 100000000, buyIrr: 60000000, sellSrc: 'فاکتور', warnings: [], profit: 999, pct: 1 };
});
var m = ctx.ptfSalesFileMargin(deal);
assert.strictEqual(m.sell, 100000000);
assert.strictEqual(m.buy, 60000000);
assert.strictEqual(m.extra, 12000000);
assert.strictEqual(m.cost, 72000000);
assert.strictEqual(m.profit, 28000000, 'profit = sell - buy - direct - loss, not hooked profit');
assert.strictEqual(m.pct, 28);
assert.strictEqual(m.complete, true);
assert.strictEqual(m.provisional, false);

var badge = ctx.ptfSalesFileMarginBadge(deal);
assert.ok(badge.indexOf('حاشیه سود') > -1 && badge.indexOf('ریال') > -1, 'badge includes percent and label');
assert.ok(badge.indexOf('ریال') > -1, 'badge includes amount');

var inc = run([deal], function () {
  return { ok: true, complete: false, sellIrr: 100000000, buyIrr: 0, sellSrc: '', warnings: ['بدون فاکتور خرید'] };
});
var m2 = inc.ptfSalesFileMargin(deal);
assert.strictEqual(m2.profit, 88000000);
assert.strictEqual(m2.provisional, true);
assert.ok(inc.ptfSalesFileMarginBadge(deal).indexOf('تقریبی') > -1, 'incomplete is labeled approximate');

var version = JSON.parse(fs.readFileSync('VERSION.json', 'utf8')).crm_version;
assert.strictEqual(version, 'v34.4.49');
var current = version.slice(1);
['crm/index.html', 'crm/sw.js', 'crm/manifest.json', 'crm/clear-cache.html', 'crm/shell.js'].forEach(function (file) {
  assert.ok(fs.readFileSync(file, 'utf8').indexOf(current) > -1, file + ' version drift');
});
console.log('PASS tester343-v34.4.49: sales file real margin amount + percent');
