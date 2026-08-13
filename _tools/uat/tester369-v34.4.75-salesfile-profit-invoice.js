#!/usr/bin/env node
'use strict';
var fs = require('fs');
var vm = require('vm');
var path = require('path');
var root = path.join(__dirname, '../..');
function read(p) { return fs.readFileSync(path.join(root, p), 'utf8'); }
function fail(m) { console.log('FAIL ' + m); process.exit(1); }
var ver = JSON.parse(read('VERSION.json'));
/* 2026-08-13: پین لفظی v34.4.75 → قرارداد «حفظ یا پیشروی خط مبنا» (الگوی tester340) */
var vm3 = String(ver.crm_version || '').match(/^v(\d+)\.(\d+)\.(\d+)$/);
if (!vm3) fail('VERSION ' + ver.crm_version);
if (+vm3[1] < 34 || (+vm3[1] === 34 && (+vm3[2] < 4 || (+vm3[2] === 4 && +vm3[3] < 75)))) fail('VERSION ' + ver.crm_version);
var fx = read('crm/fx.js');
if (fx.indexOf('تا صدور فاکتور فروش') < 0) fail('no invoice gate');
if (fx.indexOf('جمع پیشنهاد مالی (فاکتور هنوز ثبت نشده)') >= 0) fail('CO fallback still present');
/* 2026-08-13: دو چک UI منسوخ حذف شد — v34.5.8 (SALESFILE-PROFIT-GONE)
   نمایش سود از پروندهٔ فروش برداشته شد؛ بنابراین isAdvanceCost و «خرید تأمین»
   دیگر در salesfiles.js وجود ندارند (تستر343 همین حذف را پاس می‌کند).
   گیت موتور سود (فاکتور فروش/فاکتور خرید) دست‌نخورده است و پایین تست می‌شود. */

function runProfit(store) {
  var ctx = {
    console: console, JSON: JSON, Math: Math, Date: Date, Object: Object, Array: Array, String: String, Number: Number,
    localStorage: {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
      setItem: function (k, v) { store[k] = String(v); }
    },
    getData: function (k) {
      try { return JSON.parse(store[k] || '[]'); } catch (e) { return []; }
    },
    setInterval: function () { return 1; },
    clearInterval: function () {},
    document: { getElementById: function () { return null; } },
    window: null
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fx, ctx, { filename: 'fx.js' });
  return ctx;
}

var store = {
  ptf_crm_offers: JSON.stringify([{ no: 'CO-1', inqNo: 'RFQ-1', currency: 'IRR', items: [{ qty: 1, price: 999 }] }]),
  ptf_crm_invoices: JSON.stringify([]),
  ptf_crm_deals: JSON.stringify([{ cd: 'DEAL-1', inqNo: 'RFQ-1', wonOffer: 'CO-1' }]),
  ptf_crm_buycmp: JSON.stringify([]),
  ptf_crm_supplier_finance: JSON.stringify({ invoices: [] }),
  ptf_crm_payables: JSON.stringify([])
};
var ctx = runProfit(store);
var r0 = ctx.ptfProjectProfitIRR({ cd: 'DEAL-1', inqNo: 'RFQ-1', offerNo: 'CO-1', wonOffer: 'CO-1' });
if (r0.sellIrr !== 0) fail('sell without invoice ' + r0.sellIrr);
if (r0.ok) fail('ok without invoice');

store.ptf_crm_invoices = JSON.stringify([{ cd: 'INV-1', offerNo: 'CO-1', amount: 100000000, base: 100000000, vat: 0, status: 'active' }]);
store.ptf_crm_supplier_finance = JSON.stringify({
  invoices: [{ cd: 'SIN-1', status: 'active', inqNo: 'RFQ-1', amount: 60000000, cur: 'IRR' }]
});
var ctx2 = runProfit(store);
var r1 = ctx2.ptfProjectProfitIRR({ cd: 'DEAL-1', inqNo: 'RFQ-1', offerNo: 'CO-1', wonOffer: 'CO-1' });
if (r1.sellIrr !== 100000000) fail('sell net ' + r1.sellIrr);
if (r1.buyIrr !== 60000000) fail('buy from supplier inv ' + r1.buyIrr);

console.log('PASS tester369 salesfile-profit-invoice');
