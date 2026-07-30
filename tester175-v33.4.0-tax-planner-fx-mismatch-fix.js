/* AUD-12 fixture — "داشبورد موازنه فصلی" official-invoice/CO currency
   mismatch bug reported by the client (2026-07-29): a real 1500 USD official
   sale had its invoice mistakenly recorded with amount=1500 (raw foreign
   digits pasted into the IRR-only field) instead of the correct ~1.5 billion
   IRR equivalent, and the quarterly tax-planning dashboard silently produced
   a nonsensical multi-billion-rial "cover invoice" recommendation for that
   single item while the top summary showed a tiny wrong number.

   This fixture covers all four layers of the fix:
   1. official-ledger.js#ptfLedgerOfficialFxSanity — pure detector.
   2. rbac.js#saveInv — blocks (with an explicit confirm) registering/editing
      an official sales invoice whose IRR amount is wildly below the expected
      FX-converted total of its currency-based quote.
   3. rbac.js#renderInvoices — the old "⚠️ مغایرت با CO" warning was blind for
      FX quotes (it compared inv.amount, always IRR, against the quote's raw
      foreign-currency total without multiplying by the reference rate); it
      now uses the same FX-aware sanity check for currency quotes.
   4. unofficial-invoice.js#ptfTaxPlannerCalculate — the "no documented
      purchase" gap-allocation table used to recompute each line's sell price
      independently from the raw quote (qty*price*fxRateRef), disconnected
      from the actual registered official invoice amount. It now derives
      each line's share proportionally from the real inv.amount, so the sum
      of all lines' sellPrice for one invoice always equals inv.amount
      exactly (client's explicit decision: "بر مبنای مبلغ واقعی ثبت‌شده"). */
'use strict';
var fs = require('fs'), vm = require('vm'), assert = require('assert');

function loadLedger(ctx) { vm.runInContext(fs.readFileSync('crm/official-ledger.js', 'utf8'), ctx, { filename: 'official-ledger.js' }); }

/* Layer 1: pure sanity function. */
(function () {
  var ctx = { console: console, window: {} };
  vm.createContext(ctx);
  loadLedger(ctx);
  var r1 = ctx.window.ptfLedgerOfficialFxSanity({ currency: 'USD', fxRateRef: 1000000, items: [{ qty: 1, price: 1500 }] }, 1500);
  assert.ok(r1.applicable && !r1.ok, 'لایه ۱: مبلغ ۱۵۰۰ ریال برای سند ۱۵۰۰ دلاری باید مشکوک باشد');
  assert.strictEqual(r1.expectedIrr, 1500000000, 'لایه ۱: مبلغ مورد انتظار درست محاسبه شود');
  var r2 = ctx.window.ptfLedgerOfficialFxSanity({ currency: 'USD', fxRateRef: 1000000, items: [{ qty: 1, price: 1500 }] }, 1450000000);
  assert.ok(r2.ok, 'رگرسیون لایه ۱: مبلغ درست (با اختلاف کوچک) نباید مشکوک باشد');
  var r3 = ctx.window.ptfLedgerOfficialFxSanity({ currency: 'IRR', items: [{ qty: 1, price: 1500000 }] }, 1500000);
  assert.ok(!r3.applicable, 'رگرسیون لایه ۱: سند ریالی نباید قابل‌اعمال باشد');
})();

/* Layer 2: saveInv guard. */
(function () {
  var store = {}, formValues = {};
  var ctx = {
    console: console, JSON: JSON, Math: Math, Array: Array, Object: Object, String: String, Date: Date,
    localStorage: { getItem: function (k) { return store[k] != null ? store[k] : null; }, setItem: function (k, v) { store[k] = String(v); } },
    escP: function (x) { return String(x == null ? '' : x); },
    genCode: function (p) { return p + '-' + Math.floor(Math.random() * 100000); },
    faDate: function () { return '1405/04/29'; }, faDateTime: function () { return '1405/04/29 10:00'; },
    audit: function () {}, ptfToast: function () {},
    curSession: function () { return { user: 'accountant', name: 'حسابدار' }; },
    curRole: function () { return 'accountant'; }, isSenior: function () { return false; },
    roleDef: function () { return { finance: false }; },
    ptfNum: function (v) { return +String(v).replace(/,/g, '') || 0; },
    alert: function (m) { ctx._lastAlert = m; },
    confirm: function (m) { ctx._lastConfirm = m; return ctx._confirmResult !== undefined ? ctx._confirmResult : true; },
    hideModal: function () {}, notify: function () {},
    setInterval: function () { return 0; }, setTimeout: function () { return 0; },
    document: { getElementById: function (id) { return (id in formValues) ? formValues[id] : null; } }
  };
  ctx.getData = function (k) { try { return JSON.parse(ctx.localStorage.getItem(k) || '[]'); } catch (e) { return []; } };
  ctx.setData = function (k, v) { ctx.localStorage.setItem(k, JSON.stringify(v)); };
  ctx.window = ctx; ctx.window.renderInvoices = function () {};
  vm.createContext(ctx);
  loadLedger(ctx);
  vm.runInContext(fs.readFileSync('crm/rbac.js', 'utf8'), ctx, { filename: 'rbac.js' });

  ctx.setData('ptf_crm_offers', [{ no: 'CO-1', buyerCo: 'شرکت الف', currency: 'USD', fxRateRef: 1000000, items: [{ qty: 1, price: 1500 }] }]);
  ctx.setData('ptf_crm_invoices', []);
  formValues.nInvNo = { value: 'F-100' };
  formValues.nInvAmt = { value: '1500' };
  formValues.nInvVat = { value: '0' };
  formValues.nInvDate = { value: '1405/04/29' };
  ctx._confirmResult = false;
  ctx.window.saveInv('CO-1');
  assert.ok(ctx._lastConfirm && ctx._lastConfirm.indexOf('مغایرت شدید') > -1, 'لایه ۲: هشدار مغایرت باید نمایش داده شود');
  assert.strictEqual(ctx.getData('ptf_crm_invoices').length, 0, 'لایه ۲: با Cancel، فاکتور نباید ثبت شود');

  formValues.nInvAmt = { value: '1500000000' };
  ctx._lastConfirm = null;
  ctx.window.saveInv('CO-1');
  assert.ok(!ctx._lastConfirm, 'رگرسیون لایه ۲: مبلغ درست نباید هیچ هشداری بدهد');
  assert.strictEqual(ctx.getData('ptf_crm_invoices').length, 1, 'رگرسیون لایه ۲: فاکتور درست باید ثبت شود');
})();

/* Layer 3: renderInvoices warning. */
(function () {
  var store = {}, capturedHtml = '';
  var fakeEl = {};
  Object.defineProperty(fakeEl, 'innerHTML', { set: function (v) { capturedHtml = v; }, get: function () { return capturedHtml; } });
  var ctx = {
    console: console, JSON: JSON, Math: Math, Array: Array, Object: Object, String: String, Date: Date,
    localStorage: { getItem: function (k) { return store[k] != null ? store[k] : null; }, setItem: function (k, v) { store[k] = String(v); } },
    escP: function (x) { return String(x == null ? '' : x); },
    curRole: function () { return 'admin'; }, isSenior: function () { return true; },
    roleDef: function () { return { ledgerScope: 'all' }; },
    setInterval: function () { return 0; }, setTimeout: function () { return 0; },
    document: { getElementById: function (id) { return id === 'invWrap' ? fakeEl : null; } }
  };
  ctx.getData = function (k) { try { return JSON.parse(ctx.localStorage.getItem(k) || '[]'); } catch (e) { return []; } };
  ctx.setData = function (k, v) { ctx.localStorage.setItem(k, JSON.stringify(v)); };
  ctx.window = ctx;
  vm.createContext(ctx);
  loadLedger(ctx);
  vm.runInContext(fs.readFileSync('crm/rbac.js', 'utf8'), ctx, { filename: 'rbac.js' });

  ctx.setData('ptf_crm_offers', [{ no: 'CO-1', buyerCo: 'شرکت الف', currency: 'USD', fxRateRef: 1000000, items: [{ qty: 1, price: 1500 }], invRef: { t: '1405/04/15', by: 'admin', role: 'ادمین' } }]);
  ctx.setData('ptf_crm_invoices', [{ cd: 'INV-1', no: 'F-100', offerNo: 'CO-1', amount: 1500, invDate: '1405/04/15', t: '1405/04/15', payments: [] }]);
  ctx.window.renderInvoices();
  assert.ok(capturedHtml.includes('مغایرت شدید با پیش‌فاکتور ارزی'), 'لایه ۳: باید هشدار مغایرت شدید نمایش دهد');
  assert.ok(!capturedHtml.includes('مغایرت با CO:'), 'لایه ۳: نباید هشدار قدیمی نادرست را نشان دهد');
})();

/* Layer 4: tax planner gap table. */
(function () {
  var store = {}, formValues = { tpYear: { value: '1405' }, tpSeason: { value: '2' }, tpMargin: { value: '10' } };
  var el = { innerHTML: '' };
  var ctx = {
    console: console, JSON: JSON, Math: Math, Array: Array, Object: Object, String: String, Date: Date,
    localStorage: { getItem: function (k) { return store[k] != null ? store[k] : null; }, setItem: function (k, v) { store[k] = String(v); } },
    escP: function (x) { return String(x == null ? '' : x); },
    curRole: function () { return 'admin'; }, isSenior: function () { return true; },
    document: { getElementById: function (id) { return formValues[id] || (id === 'tpResultsWrap' ? el : null); } }
  };
  ctx.getData = function (k) { try { return JSON.parse(ctx.localStorage.getItem(k) || '[]'); } catch (e) { return []; } };
  ctx.setData = function (k, v) { ctx.localStorage.setItem(k, JSON.stringify(v)); };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('crm/unofficial-invoice.js', 'utf8'), ctx, { filename: 'unofficial-invoice.js' });

  ctx.setData('ptf_crm_offers', [{ no: 'PTF-CO-1', inqNo: 'INQ-1', currency: 'USD', fxRateRef: 1000000, items: [{ name: 'شیر کنترل فلنجی', qty: 1, price: 1500 }] }]);
  ctx.setData('ptf_crm_invoices', [{ cd: 'INV-1', no: 'F-100', offerNo: 'PTF-CO-1', amount: 3000000000, invDate: '1405/04/15', t: '1405/04/15', isUnofficial: false, status: 'active' }]);
  ctx.setData('ptf_crm_supplier_finance', { invoices: [], payments: [] });
  ctx.setData('ptf_crm_opex', [{ cd: 'OPX-1', cat: 'اجاره‌بها', amt: 300000000, month: '1405/05', isOfficial: true }]);
  ctx.setData('ptf_crm_petty', []);
  ctx.setData('ptf_crm_buycmp', []);
  ctx.window.ptfTaxPlannerCalculate();
  var plain = el.innerHTML.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  assert.ok(plain.includes((3000000000).toLocaleString('fa-IR')), 'لایه ۴: ارزش فروش در جدول باید دقیقاً برابر مبلغ فاکتور واقعی باشد');
  assert.ok(plain.includes((2400000000).toLocaleString('fa-IR')), 'لایه ۴: فاکتور پوششی پیشنهادی باید ۲۴۰ میلیون تومان باشد (طبق مثال کارفرما)');

  /* رگرسیون: چند آیتم — جمع sellPrice باید دقیقاً برابر inv.amount بماند. */
  var ctx2 = Object.assign({}, ctx);
  ctx.setData('ptf_crm_offers', [{ no: 'PTF-CO-2', inqNo: 'INQ-2', currency: 'IRR', items: [{ name: 'کالای الف', qty: 2, price: 100000000 }, { name: 'کالای ب', qty: 1, price: 300000000 }] }]);
  ctx.setData('ptf_crm_invoices', [{ cd: 'INV-2', no: 'F-200', offerNo: 'PTF-CO-2', amount: 450000000, invDate: '1405/04/15', t: '1405/04/15', isUnofficial: false, status: 'active' }]);
  ctx.setData('ptf_crm_opex', []);
  ctx.window.ptfTaxPlannerCalculate();
  var items = ctx.window._tpNoInvoiceItems || [];
  var sumSellPrice = items.reduce(function (s, it) { return s + it.sellPrice; }, 0);
  assert.ok(Math.abs(sumSellPrice - 450000000) < 1, 'رگرسیون لایه ۴: جمع sellPrice باید برابر inv.amount واقعی باشد');
  var itemA = items.filter(function (x) { return x.name === 'کالای الف'; })[0];
  var itemB = items.filter(function (x) { return x.name === 'کالای ب'; })[0];
  assert.ok(itemA && Math.abs(itemA.sellPrice - 180000000) < 1, 'رگرسیون لایه ۴: سهم متناسب کالای الف');
  assert.ok(itemB && Math.abs(itemB.sellPrice - 270000000) < 1, 'رگرسیون لایه ۴: سهم متناسب کالای ب');
})();

/* Data-quality dashboard detection (existing mistaken invoices, not just new ones). */
(function () {
  var store = {};
  var ctx = {
    console: console, JSON: JSON, Math: Math, Array: Array, Object: Object, String: String, Date: Date,
    localStorage: { getItem: function (k) { return store[k] != null ? store[k] : null; }, setItem: function (k, v) { store[k] = String(v); } },
    escP: function (x) { return String(x == null ? '' : x); },
    curRole: function () { return 'admin'; },
    document: { getElementById: function () { return null; } }
  };
  ctx.getData = function (k) { try { return JSON.parse(ctx.localStorage.getItem(k) || '[]'); } catch (e) { return []; } };
  ctx.setData = function (k, v) { ctx.localStorage.setItem(k, JSON.stringify(v)); };
  ctx.window = ctx;
  vm.createContext(ctx);
  loadLedger(ctx);
  vm.runInContext(fs.readFileSync('crm/data-quality.js', 'utf8'), ctx, { filename: 'data-quality.js' });

  ctx.setData('ptf_crm_offers', [{ no: 'CO-1', currency: 'USD', fxRateRef: 1000000, items: [{ qty: 1, price: 1500 }] }]);
  ctx.setData('ptf_crm_invoices', [{ cd: 'INV-1', no: 'F-100', offerNo: 'CO-1', amount: 1500, invDate: '1405/04/15', payments: [] }]);
  ctx.setData('ptf_crm_payables', []); ctx.setData('ptf_crm_cheques', []); ctx.setData('ptf_crm_opex', []); ctx.setData('ptf_crm_supplier_finance', {});
  var data = ctx.window.ptfDataQualityData();
  var found = data.filter(function (x) { return x.id === 'invoice-fx-mismatch'; });
  assert.strictEqual(found.length, 1, 'کیفیت داده: فاکتور اشتباه باید شناسایی شود');
  assert.ok(found[0].refs.indexOf('F-100') > -1, 'کیفیت داده: شماره فاکتور باید در نمونه‌ها باشد');
})();

console.log('PASS: tester175-v33.4.0-tax-planner-fx-mismatch-fix.js (AUD-12)');
