/* AUD-01 fixture (crm/AUDIT-FINANCIAL-SYSTEM-2026-07-29.md) — protects the
   supplier-finance object merge from regressing to the pre-fix dead-code path
   where Array.isArray(loc) was always false for the object shape
   {schema, invoices[], payments[], adjustments[]}, causing ptfSmartMerge to
   fall through to "return remoteStr" and silently drop any locally-created
   invoice/payment/adjustment that had not yet reached the server. */
'use strict';
var fs = require('fs'), vm = require('vm'), assert = require('assert');
var store = {};
var context = {
  console: console, JSON: JSON, Math: Math, Array: Array, Object: Object, String: String, Date: Date,
  localStorage: { getItem: function (k) { return store[k] != null ? store[k] : null; }, setItem: function (k, v) { store[k] = String(v); } },
  document: { addEventListener: function () {}, getElementById: function () { return null; } },
  navigator: { onLine: true },
  setInterval: function () { return 0; }, setTimeout: function () { return 0; },
  fetch: function () { return Promise.resolve({ json: function () { return Promise.resolve({}); } }); }
};
context.window = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync('crm/sync.js', 'utf8'), context, { filename: 'sync.js' });

var merge = context.window.ptfSmartMerge;
assert.strictEqual(typeof merge, 'function', 'ptfSmartMerge باید تعریف شده باشد');

/* سناریوی اصل باگ: local یک پرداخت دارد که در remote نیست — نباید گم شود. */
(function () {
  var local = { schema: 1, invoices: [], payments: [{ cd: 'P1', amount: 100 }] };
  var remote = { schema: 1, invoices: [], payments: [] };
  var merged = JSON.parse(merge('ptf_crm_supplier_finance', JSON.stringify(local), JSON.stringify(remote)));
  assert.ok(merged.payments.some(function (p) { return p.cd === 'P1'; }), 'AUD-01: پرداخت محلی نباید گم شود');
})();

/* سناریوی دو-دستگاهی گزارش ممیزی: هر دو طرف رکورد جدید مستقل اضافه کرده‌اند. */
(function () {
  var server = { schema: 1, invoices: [{ cd: 'SFINV-1', amount: 1000, t: '1405/04/20' }], payments: [] };
  var deviceA = JSON.parse(JSON.stringify(server));
  deviceA.invoices.push({ cd: 'SFINV-2', amount: 2000, t: '1405/04/22' });
  var deviceB = JSON.parse(JSON.stringify(server));
  deviceB.payments.push({ cd: 'SFPAY-1', amount: 500, t: '1405/04/22' });
  var merged = JSON.parse(merge('ptf_crm_supplier_finance', JSON.stringify(deviceB), JSON.stringify(deviceA)));
  assert.ok(merged.invoices.some(function (i) { return i.cd === 'SFINV-2'; }), 'AUD-01: فاکتور دستگاه A باید حفظ شود');
  assert.ok(merged.payments.some(function (p) { return p.cd === 'SFPAY-1'; }), 'AUD-01: پرداخت دستگاه B نباید در تعارض گم شود');
})();

/* رقابت روی همان رکورد (همان cd) — جدیدتر باید برنده شود. */
(function () {
  var local = { schema: 1, invoices: [{ cd: 'SFINV-1', amount: 1000, t: '1405/04/20 08:00' }], payments: [] };
  var remote = { schema: 1, invoices: [{ cd: 'SFINV-1', amount: 1500, t: '1405/04/20 09:00' }], payments: [] };
  var merged = JSON.parse(merge('ptf_crm_supplier_finance', JSON.stringify(local), JSON.stringify(remote)));
  assert.strictEqual(merged.invoices[0].amount, 1500, 'AUD-01: رکورد جدیدتر باید برنده شود');
})();

/* رگرسیون: merge عمومی آرایه‌ای (مشتریان) نباید دست بخورد. */
(function () {
  var local = [{ cd: 'C1', name: 'A', t: '1405/04/20 08:00' }];
  var remote = [{ cd: 'C1', name: 'B', t: '1405/04/20 09:00' }, { cd: 'C2', name: 'X' }];
  var merged = JSON.parse(merge('ptf_crm_customers', JSON.stringify(local), JSON.stringify(remote)));
  var c1 = merged.filter(function (x) { return x.cd === 'C1'; })[0];
  var c2 = merged.filter(function (x) { return x.cd === 'C2'; })[0];
  assert.ok(c1 && c1.name === 'B', 'رگرسیون: merge آرایه‌ای عمومی دست‌نخورده بماند');
  assert.ok(c2, 'رگرسیون: رکورد فقط-remote حفظ شود');
})();

/* رگرسیون: ptf_crm_avatars (شیء غیرآرایه‌ای دیگر) باید طبق منطق per-user timestamp خودش کار کند. */
(function () {
  var local = { user1: { v: 'img1', ts: '2026-01-01T00:00:00Z' } };
  var remote = { user1: { v: 'img2', ts: '2026-01-02T00:00:00Z' }, user2: { v: 'img3', ts: '2026-01-01T00:00:00Z' } };
  var merged = JSON.parse(merge('ptf_crm_avatars', JSON.stringify(local), JSON.stringify(remote)));
  assert.strictEqual(merged.user1.v, 'img2', 'رگرسیون: avatars per-user timestamp merge دست‌نخورده بماند');
  assert.strictEqual(merged.user2.v, 'img3', 'رگرسیون: avatars فقط-remote حفظ شود');
})();

console.log('PASS: tester163-v33.2.1-supplier-finance-merge-fix.js (AUD-01)');
