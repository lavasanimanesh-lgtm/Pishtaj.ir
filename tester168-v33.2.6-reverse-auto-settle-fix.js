/* AUD-07 fixture (crm/AUDIT-FINANCIAL-SYSTEM-2026-07-29.md) — protects the
   "reverse auto-settlement" feature (sfCloseSettledCommit -> sfReverseAutoSettle)
   from two independent bugs that together made the feature completely
   unreachable in the normal flow:
   1) sfCloseSettledCommit immediately archives the deal via sfArchive(), which
      never carried autoSettleReceipts/autoSettleDate/autoSettleBy forward into
      the archived ptf_crm_projects record, and sfReverseAutoSettle only ever
      searched ptf_crm_deals — so after the (always-immediate) archiving step,
      the reversal button could never find anything to reverse.
   2) Even when the record was found, the "receipt found" branch only flipped
      p.status to 'reversal' without touching p.amt or adding a compensating
      negative entry, so every balance calculation across the app (which sums
      p.amt without filtering by status) still saw the invoice as fully paid. */
'use strict';
var fs = require('fs'), vm = require('vm'), assert = require('assert');

function paidSum(inv) {
  return ((inv.payments || []).concat(inv.pays || [])).reduce(function (s, p) { return s + (+p.amt || 0); }, 0);
}

function freshContext() {
  var store = {};
  var ctx = {
    console: console, JSON: JSON, Math: Math, Array: Array, Object: Object, String: String, Date: Date,
    localStorage: { getItem: function (k) { return store[k] != null ? store[k] : null; }, setItem: function (k, v) { store[k] = String(v); } },
    genCode: function (p) { return p + '-' + Math.floor(Math.random() * 100000); },
    faDate: function () { return '1405/04/29'; }, faDateTime: function () { return '1405/04/29 10:00'; },
    audit: function () {}, ptfToast: function () {},
    curSession: function () { return { user: 'admin', name: 'ادمین' }; },
    alert: function () {}, confirm: function () { return true; },
    escP: function (x) { return String(x == null ? '' : x); },
    setInterval: function () { return 0; }, setTimeout: function () { return 0; },
    document: { getElementById: function () { return null; } },
    notify: function () {}, renderDeals: function () {},
    ptfProjectLossTotal: function () { return 0; }
  };
  ctx.getData = function (k) { try { return JSON.parse(ctx.localStorage.getItem(k) || '[]'); } catch (e) { return []; } };
  ctx.setData = function (k, v) { ctx.localStorage.setItem(k, JSON.stringify(v)); };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('crm/salesfiles.js', 'utf8'), ctx, { filename: 'salesfiles.js' });
  return ctx;
}

/* AUD-07 لایه ۱+۲: مسیر واقعی و کامل — مختومه‌سازی، بایگانی خودکار، سپس برگشت. */
(function () {
  var ctx = freshContext();
  ctx.setData('ptf_crm_deals', [{ cd: 'PRJ-1', inqNo: 'INQ-1', wonOffer: 'CO-1', buyerCo: 'شرکت تست', costEvents: [], lossEvents: [] }]);
  ctx.setData('ptf_crm_invoices', [{ cd: 'INV-1', offerNo: 'CO-1', amount: 5000000, payments: [] }]);
  ctx.setData('ptf_crm_offers', [{ no: 'CO-1', invRef: {} }]);
  ctx.setData('ptf_crm_rfqs', []);
  ctx.setData('ptf_crm_projects', []);
  ctx.window.sfCloseAudit = function () { return { blockers: [], warns: [], openInvs: [{ cd: 'INV-1' }] }; };

  ctx.window.sfCloseSettledCommit('PRJ-1', true, 'مختومه‌سازی تست');
  assert.strictEqual(ctx.getData('ptf_crm_deals').length, 0, 'پرونده باید از deals حذف شده باشد');
  assert.strictEqual(ctx.getData('ptf_crm_projects').length, 1, 'پرونده باید بایگانی شده باشد');

  var result = ctx.window.sfReverseAutoSettle('PRJ-1', 'اشتباه در مختومه‌سازی');
  assert.ok(result && result.count === 1, 'AUD-07 لایه ۱: برگشت بعد از بایگانی باید پرونده را پیدا کند');
  var invAfter = ctx.getData('ptf_crm_invoices')[0];
  assert.strictEqual(invAfter.amount - paidSum(invAfter), 5000000, 'AUD-07 لایه ۲: مانده‌ی واقعی باید اصلاح شود');
  assert.strictEqual(ctx.getData('ptf_crm_projects')[0].autoSettleReceipts.length, 0, 'autoSettleReceipts باید در بایگانی خالی شود');
})();

/* رگرسیون: برگشت روی پرونده‌ی هنوز-باز (در ptf_crm_deals، قبل از بایگانی) هم کار کند. */
(function () {
  var ctx = freshContext();
  var invoice = { cd: 'INV-2', amount: 5000000, payments: [{ cd: 'RPAY-AUTO-2', amt: 5000000, autoSettle: true, status: 'posted' }] };
  ctx.setData('ptf_crm_invoices', [invoice]);
  ctx.setData('ptf_crm_deals', [{ cd: 'PRJ-2', autoSettleReceipts: [{ invoiceCd: 'INV-2', receiptCd: 'RPAY-AUTO-2', amount: 5000000 }] }]);
  ctx.setData('ptf_crm_projects', []);
  var result = ctx.window.sfReverseAutoSettle('PRJ-2', 'دلیل تست');
  assert.ok(result && result.count === 1, 'رگرسیون: برگشت روی پرونده‌ی باز باید کار کند');
  var invAfter = ctx.getData('ptf_crm_invoices')[0];
  assert.strictEqual(invAfter.amount - paidSum(invAfter), 5000000, 'رگرسیون: مانده باید اصلاح شود');
  assert.strictEqual(ctx.getData('ptf_crm_deals')[0].autoSettleReceipts.length, 0, 'رگرسیون: باید در ptf_crm_deals (نه projects) به‌روز شود');
})();

/* رگرسیون: پرونده بدون autoSettleReceipts رد شود. */
(function () {
  var ctx = freshContext();
  ctx.setData('ptf_crm_deals', [{ cd: 'PRJ-3', autoSettleReceipts: [] }]);
  assert.strictEqual(ctx.window.sfReverseAutoSettle('PRJ-3', 'دلیل'), false, 'رگرسیون: بدون تسویه خودکار باید false باشد');
})();

/* رگرسیون: بدون دلیل رد شود. */
(function () {
  var ctx = freshContext();
  ctx.setData('ptf_crm_invoices', [{ cd: 'INV-4', amount: 1000, payments: [{ cd: 'R1', amt: 1000, autoSettle: true }] }]);
  ctx.setData('ptf_crm_deals', [{ cd: 'PRJ-4', autoSettleReceipts: [{ invoiceCd: 'INV-4', receiptCd: 'R1', amount: 1000 }] }]);
  assert.strictEqual(ctx.window.sfReverseAutoSettle('PRJ-4', ''), false, 'رگرسیون: بدون دلیل باید false باشد');
})();

/* رگرسیون: مسیر «رسید یافت نشد» همچنان رکورد جبرانی می‌سازد. */
(function () {
  var ctx = freshContext();
  ctx.setData('ptf_crm_invoices', [{ cd: 'INV-5', amount: 2000000, payments: [] }]);
  ctx.setData('ptf_crm_deals', [{ cd: 'PRJ-5', autoSettleReceipts: [{ invoiceCd: 'INV-5', receiptCd: 'MISSING', amount: 2000000 }] }]);
  ctx.window.sfReverseAutoSettle('PRJ-5', 'رسید یافت نشد');
  var after = ctx.getData('ptf_crm_invoices')[0];
  assert.ok(after.payments.some(function (p) { return p.amt === -2000000; }), 'رگرسیون: مسیر !found باید رکورد جبرانی بسازد');
})();

/* رگرسیون: برگشت دوباره روی همان پرونده رد شود. */
(function () {
  var ctx = freshContext();
  ctx.setData('ptf_crm_invoices', [{ cd: 'INV-6', amount: 1000000, payments: [{ cd: 'R6', amt: 1000000, autoSettle: true }] }]);
  ctx.setData('ptf_crm_deals', [{ cd: 'PRJ-6', autoSettleReceipts: [{ invoiceCd: 'INV-6', receiptCd: 'R6', amount: 1000000 }] }]);
  ctx.window.sfReverseAutoSettle('PRJ-6', 'دلیل اول');
  assert.strictEqual(ctx.window.sfReverseAutoSettle('PRJ-6', 'دلیل دوم'), false, 'رگرسیون: برگشت دوباره باید رد شود');
})();

console.log('PASS: tester168-v33.2.6-reverse-auto-settle-fix.js (AUD-07)');
