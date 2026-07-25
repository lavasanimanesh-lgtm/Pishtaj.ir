/* Emergency hotfix regression fixture — CO/TC margin UI in final offerlock renderer.
   Runs isolated JS only; it does not alter CRM data or call a server. */
'use strict';
var fs = require('fs'), vm = require('vm'), assert = require('assert');
var store = {}, itemHost = { innerHTML: '' }, marginEl = { value: '25' };
var products = [{ cd: 'P-1', nm: 'VALVE', en: 'VALVE', pr: 1000, prCur: 'IRR' }];
var context = {
  console: console, JSON: JSON, Math: Math, Date: Date, Array: Array, Object: Object, String: String,
  localStorage: { getItem: function (k) { return store[k] || null; }, setItem: function (k, v) { store[k] = String(v); }, removeItem: function (k) { delete store[k]; } },
  getData: function (k) { return k === 'ptf_crm_products' ? products : []; }, setData: function () {},
  curSession: function () { return { user: 'commercial', name: 'Commercial' }; },
  curRole: function () { return 'commercial'; }, roleDef: function () { return { buyPrice: true, sellPrice: true }; },
  escP: function (v) { return String(v == null ? '' : v).replace(/"/g, '&quot;'); },
  faDate: function () { return '1405/04/23'; }, faDateTime: function () { return '1405/04/23 10:00'; },
  genCode: function (p) { return p + '-1'; }, audit: function () {}, alert: function () {}, confirm: function () { return true; },
  ptfToast: function () {}, ptfNum: function (v) { return +String(v).replace(/[^\d.-]/g, '') || 0; },
  document: {
    getElementById: function (id) { if (id === 'offItemsWrap') return itemHost; if (id === 'ofGlobalMargin') return marginEl; return null; },
    querySelectorAll: function (selector) { return selector === '[id="offItemsWrap"]' ? [itemHost] : []; }, addEventListener: function () {}, createElement: function () { return { style: {}, appendChild: function () {}, setAttribute: function () {} }; }, body: { appendChild: function () {} }
  },
  setTimeout: function () { return 1; }, clearTimeout: function () {}, setInterval: function () { return 1; }, clearInterval: function () {}
};
context.window = context;
context.window.addEventListener = function () {};
vm.createContext(context);
/* Current production order: offers → offers-pro → buycompare → procurement-link → offerlock. */
vm.runInContext(fs.readFileSync('crm/offers.js', 'utf8'), context, { filename: 'offers.js' });
vm.runInContext(fs.readFileSync('crm/offers-pro.js', 'utf8'), context, { filename: 'offers-pro.js' });
vm.runInContext(fs.readFileSync('crm/procurement-link.js', 'utf8'), context, { filename: 'procurement-link.js' });
vm.runInContext(fs.readFileSync('crm/offerlock.js', 'utf8'), context, { filename: 'offerlock.js' });
context.ptfSetOffState({ kind: 'CO', currency: 'IRR', extraCols: [], items: [{ pcode: 'P-1', name: 'VALVE', desc: '', model: '', qty: 2, unit: 'NO', brand: '', price: 1000 }] });
context.offRenderItems();
assert.ok(itemHost.innerHTML.indexOf('ofGlobalMargin') > -1, 'Final offerlock renderer must expose the global margin input.');
assert.ok(itemHost.innerHTML.indexOf('اعمال سود و محاسبه قیمت فروش') > -1, 'Final renderer must expose the apply button.');
assert.ok(itemHost.innerHTML.indexOf('(٪) سود') > -1, 'Final renderer must expose the per-row margin column.');
assert.ok(itemHost.innerHTML.indexOf('نرخ مرجع خرید') > -1, 'Final renderer must expose the reference price column for buy-price roles.');
context.offApplyGlobalMargin();
assert.strictEqual(context._offState.items[0].marginPct, 25, 'Global margin must be stored on the item.');
assert.strictEqual(context._offState.items[0].price, 1250, 'Unit price must equal reference price × (1 + margin%).');
console.log('PASS tester158-v284-co-margin-hotfix: 6 UI/formula checks');
