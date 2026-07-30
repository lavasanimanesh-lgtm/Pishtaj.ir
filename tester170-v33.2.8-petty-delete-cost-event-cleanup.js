/* AUD-09 fixture (crm/AUDIT-FINANCIAL-SYSTEM-2026-07-29.md) — protects
   pettyDel() from leaving an orphan costEvent behind in the linked sales
   deal. pettyAdd() creates a deal.costEvents entry when a petty expense is
   linked (dealRef), but pettyDel() previously never removed it (unlike the
   correct symmetrical pattern already used in opex.js#ptfOpexDel). */
'use strict';
var fs = require('fs'), vm = require('vm'), assert = require('assert');

function freshContext(role) {
  var store = {};
  var ctx = {
    console: console, JSON: JSON, Math: Math, Array: Array, Object: Object, String: String, Date: Date,
    localStorage: { getItem: function (k) { return store[k] != null ? store[k] : null; }, setItem: function (k, v) { store[k] = String(v); } },
    escP: function (x) { return String(x == null ? '' : x); },
    genCode: function (p) { return p + '-' + Math.floor(Math.random() * 100000); },
    faDate: function () { return '1405/04/29'; }, faDateTime: function () { return '1405/04/29 10:00'; },
    audit: function () {}, ptfToast: function () {},
    curRole: function () { return role || 'admin'; },
    roleDef: function () { return { finance: true }; },
    curSession: function () { return { user: 'admin', name: 'admin' }; },
    confirm: function () { return true; }, prompt: function () { return 'اشتباه ثبت'; }, alert: function () {},
    setInterval: function () { return 0; }, setTimeout: function () { return 0; },
    document: { getElementById: function () { return null; } }
  };
  ctx.getData = function (k) { try { return JSON.parse(ctx.localStorage.getItem(k) || (k === 'ptf_crm_settings' ? '{}' : '[]')); } catch (e) { return k === 'ptf_crm_settings' ? {} : []; } };
  ctx.setData = function (k, v) { ctx.localStorage.setItem(k, JSON.stringify(v)); };
  ctx.window = ctx;
  ctx.renderPetty = function () {};
  ctx.window.ptfPettyPendingByUser = function () { return {}; };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('crm/petty.js', 'utf8'), ctx, { filename: 'petty.js' });
  return ctx;
}

/* AUD-09 مسیر ۱: حذف رکورد open لینک‌شده باید costEvent متناظر را از پرونده پاک کند. */
(function () {
  var ctx = freshContext();
  ctx.setData('ptf_crm_deals', [{ cd: 'DEAL-1', wonOffer: 'CO-1', costEvents: [{ cd: 'PTY-1', amt: 300000, cat: 'fromPetty', pettyCd: 'PTY-1' }] }]);
  ctx.setData('ptf_crm_petty', [{ cd: 'PTY-1', amt: 300000, cat: 'سایر', dealRef: 'DEAL-1', desc: 'تست', by: 'admin', st: 'open' }]);
  ctx.window.pettyDel('PTY-1');
  assert.strictEqual(ctx.getData('ptf_crm_deals')[0].costEvents.length, 0, 'AUD-09: حذف باید costEvent را پاک کند');
  assert.strictEqual(ctx.getData('ptf_crm_petty').length, 0, 'رگرسیون: رکورد petty باید حذف شود');
})();

/* AUD-09 مسیر ۲: ابطال رکورد settled لینک‌شده هم باید costEvent را پاک کند. */
(function () {
  var ctx = freshContext();
  ctx.setData('ptf_crm_deals', [{ cd: 'DEAL-2', wonOffer: 'CO-2', costEvents: [{ cd: 'PTY-2', amt: 500000, cat: 'fromPetty', pettyCd: 'PTY-2' }] }]);
  ctx.setData('ptf_crm_petty', [{ cd: 'PTY-2', amt: 500000, cat: 'سایر', dealRef: 'DEAL-2', desc: 'تست ۲', by: 'admin', st: 'settled' }]);
  ctx.setData('ptf_crm_petty_tx', []);
  ctx.window.pettyDel('PTY-2');
  assert.strictEqual(ctx.getData('ptf_crm_deals')[0].costEvents.length, 0, 'AUD-09 (settled): ابطال باید costEvent را پاک کند');
  assert.strictEqual(ctx.getData('ptf_crm_petty')[0].st, 'void', 'رگرسیون: رکورد باید ابطال شود نه حذف فیزیکی (FIN-WF-009)');
  assert.strictEqual(ctx.getData('ptf_crm_petty_tx').length, 1, 'رگرسیون: تراکنش معکوس باید ثبت شود');
})();

/* رگرسیون: حذف هزینه‌ی مستقل (بدون dealRef) بدون خطا. */
(function () {
  var ctx = freshContext();
  ctx.setData('ptf_crm_deals', []);
  ctx.setData('ptf_crm_petty', [{ cd: 'PTY-3', amt: 100000, cat: 'سایر', dealRef: '', desc: 'مستقل', by: 'admin', st: 'open' }]);
  ctx.window.pettyDel('PTY-3');
  assert.strictEqual(ctx.getData('ptf_crm_petty').length, 0, 'رگرسیون: حذف مستقل بدون خطا');
})();

/* رگرسیون: سایر costEvents پرونده نباید دست بخورند. */
(function () {
  var ctx = freshContext();
  ctx.setData('ptf_crm_deals', [{ cd: 'DEAL-4', wonOffer: 'CO-4', costEvents: [
    { cd: 'PTY-4', amt: 200000, cat: 'fromPetty' },
    { cd: 'OTHER-EVENT', amt: 999999, cat: 'other' }
  ] }]);
  ctx.setData('ptf_crm_petty', [{ cd: 'PTY-4', amt: 200000, cat: 'سایر', dealRef: 'DEAL-4', desc: 'تست', by: 'admin', st: 'open' }]);
  ctx.window.pettyDel('PTY-4');
  var events = ctx.getData('ptf_crm_deals')[0].costEvents;
  assert.strictEqual(events.length, 1, 'رگرسیون: فقط costEvent مربوطه حذف شود');
  assert.strictEqual(events[0].cd, 'OTHER-EVENT', 'رگرسیون: سایر رویدادها دست‌نخورده بمانند');
})();

/* رگرسیون: کاربر غیرمجاز (نه ثبت‌کننده، نه مدیر/خزانه‌دار) نباید بتواند حذف کند. */
(function () {
  var ctx = freshContext('sales');
  ctx.window.curSession = function () { return { user: 'other', name: 'other' }; };
  ctx.setData('ptf_crm_petty', [{ cd: 'PTY-5', amt: 100000, cat: 'سایر', dealRef: '', desc: 'تست', by: 'someoneElse', st: 'open' }]);
  ctx.window.pettyDel('PTY-5');
  assert.strictEqual(ctx.getData('ptf_crm_petty').length, 1, 'رگرسیون: کاربر غیرمجاز نباید بتواند حذف کند');
})();

console.log('PASS: tester170-v33.2.8-petty-delete-cost-event-cleanup.js (AUD-09)');
