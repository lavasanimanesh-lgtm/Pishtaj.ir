/* AUD-02 / AUD-03 fixture (crm/AUDIT-FINANCIAL-SYSTEM-2026-07-29.md) — protects
   ptf_crm_invoices and ptf_crm_deals from the record-replacement merge that
   silently dropped an independent nested-array addition (customer payment /
   deal cost event) whenever two devices touched the same business record
   near-simultaneously. Both keys are now routed through the existing
   canonical-merge path (ptfMergeByCodeCanonical) shared with offers/rfqs,
   which unions array fields (payments/pays/costEvents/timeline/lossEvents)
   instead of replacing the whole record with "whichever is newer". */
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

/* AUD-02: دو تحصیلدار هم‌زمان روی همان فاکتور دو وصولی مستقل ثبت می‌کنند. */
(function () {
  var server = [{ cd: 'INV-1', offerNo: 'CO-1', no: 'F-1', amount: 1000000, t: '1405/04/22', by: 'accountant', payments: [] }];
  var deviceA = JSON.parse(JSON.stringify(server));
  deviceA[0].payments.push({ cd: 'RPAY-A', amt: 400000, how: 'نقد', t: '1405/04/23', by: 'collectorA', status: 'posted' });
  var deviceB = JSON.parse(JSON.stringify(server));
  deviceB[0].payments.push({ cd: 'RPAY-B', amt: 300000, how: 'چک', t: '1405/04/23', by: 'collectorB', status: 'posted' });
  var merged = JSON.parse(merge('ptf_crm_invoices', JSON.stringify(deviceB), JSON.stringify(deviceA)));
  var payments = merged[0].payments;
  assert.ok(payments.some(function (p) { return p.cd === 'RPAY-A'; }), 'AUD-02: وصولی A باید حفظ شود');
  assert.ok(payments.some(function (p) { return p.cd === 'RPAY-B'; }), 'AUD-02: وصولی B نباید در تعارض گم شود');
  assert.strictEqual(payments.length, 2, 'AUD-02: بدون تکرار');
})();

/* AUD-03: دو دستگاه هم‌زمان روی همان پرونده‌ی فروش دو costEvent مستقل ثبت می‌کنند. */
(function () {
  var server = [{ cd: 'DEAL-1', wonOffer: 'CO-1', costEvents: [], t: '1405/04/20 10:00' }];
  var deviceA = JSON.parse(JSON.stringify(server));
  deviceA[0].costEvents.push({ cd: 'EVT-A', amt: 1000000 });
  var deviceB = JSON.parse(JSON.stringify(server));
  deviceB[0].costEvents.push({ cd: 'EVT-B', amt: 2000000 });
  var merged = JSON.parse(merge('ptf_crm_deals', JSON.stringify(deviceB), JSON.stringify(deviceA)));
  var events = merged[0].costEvents;
  assert.ok(events.some(function (e) { return e.cd === 'EVT-A'; }), 'AUD-03: هزینه‌ی A باید حفظ شود');
  assert.ok(events.some(function (e) { return e.cd === 'EVT-B'; }), 'AUD-03: هزینه‌ی B نباید گم شود');
  assert.strictEqual(events.length, 2, 'AUD-03: بدون تکرار');
})();

/* رگرسیون: فاکتور تازه‌ی محلی که هنوز به سرور نرسیده گم نمی‌شود. */
(function () {
  var merged = JSON.parse(merge('ptf_crm_invoices', JSON.stringify([{ cd: 'INV-NEW', amount: 100, payments: [] }]), JSON.stringify([])));
  assert.ok(merged.some(function (i) { return i.cd === 'INV-NEW'; }), 'رگرسیون: فاکتور محلی‌فقط نباید گم شود');
})();

/* رگرسیون: offers هنوز درست merge می‌شوند (بدون افزودن آیتم تکراری). */
(function () {
  var local = [{ no: 'CO-1', items: [{ lineId: 'L1', qty: 1 }] }];
  var remote = [{ no: 'CO-1', items: [{ lineId: 'L1', qty: 1 }] }, { no: 'CO-2', items: [] }];
  var merged = JSON.parse(merge('ptf_crm_offers', JSON.stringify(local), JSON.stringify(remote)));
  assert.strictEqual(merged.length, 2, 'رگرسیون: هر دو CO حفظ شوند');
  assert.strictEqual(merged.filter(function (o) { return o.no === 'CO-1'; })[0].items.length, 1, 'رگرسیون: آیتم تکراری اضافه نشود');
})();

/* رگرسیون: سایر کلیدهای آرایه‌ای (customers) دست‌نخورده می‌مانند (منطق عمومی، نه canonical). */
(function () {
  var local = [{ cd: 'C1', name: 'A', t: '1405/04/20 08:00' }];
  var remote = [{ cd: 'C1', name: 'B', t: '1405/04/20 09:00' }];
  var merged = JSON.parse(merge('ptf_crm_customers', JSON.stringify(local), JSON.stringify(remote)));
  assert.strictEqual(merged[0].name, 'B', 'رگرسیون: customers دست‌نخورده بماند');
})();

console.log('PASS: tester164-v33.2.2-invoice-deal-merge-fix.js (AUD-02, AUD-03)');
