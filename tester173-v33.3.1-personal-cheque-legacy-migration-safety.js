/* FW-C01 fixture (crm/AUDIT-FINANCIAL-SYSTEM-2026-07-29.md, client decision
   2026-07-29: "fix it now") — protects chSave() from permanently deleting a
   legacy personal cheque still stuck in the global key (ptf_crm_cheques).
   chAll() hides any record with ownership==='personal' from the "company"
   side and only re-adds personal records belonging to the *current* user
   from their own personal key — so a legacy personal record belonging to
   someone else (or even the current user, if it never got migrated) was
   invisible to the array chSave() receives, and got wiped out on every
   overwrite.
   Fix: chSave() now runs chMigratePersonal() first and merges only the
   *delta* (records that appeared in the migration target's personal key as
   a direct result of that migration) back into what it writes — so a
   legacy record survives, while a cheque the user deliberately deleted
   from their own personal list is NOT resurrected (only the newly-migrated
   delta is merged, not the old personal-key snapshot). */
'use strict';
var fs = require('fs'), vm = require('vm'), assert = require('assert');

function makeRow(v) { return { value: v }; }

function freshContext(role, curUser) {
  var store = {};
  var rowData = { due: '1405/06/01', to: 'ذی‌نفع تست', nid: '', amt: '1,000,000', sayad: '', note: 'بابت تست' };
  var ctx = {
    console: console, JSON: JSON, Math: Math, Array: Array, Object: Object, String: String, Date: Date,
    localStorage: { getItem: function (k) { return store[k] != null ? store[k] : null; }, setItem: function (k, v) { store[k] = String(v); } },
    escP: function (x) { return String(x == null ? '' : x); },
    genCode: function (p) { return p + '-' + Math.floor(Math.random() * 100000); },
    faDate: function () { return '1405/04/29'; }, faDateTime: function () { return '1405/04/29 10:00'; },
    audit: function () {}, ptfToast: function () {},
    curRole: function () { return role; },
    curSession: function () { return { user: curUser, name: curUser }; },
    ptfNum: function (v) { return +String(v).replace(/,/g, '') || 0; },
    ptfJToISO: function () { return '2026-08-23'; }, ptfISOToJ: function () { return '1405/06/01'; },
    alert: function () {}, confirm: function () { return true; },
    setInterval: function () { return 0; }, setTimeout: function () { return 0; },
    document: {
      querySelectorAll: function (sel) {
        if (sel.indexOf('chB_due') > -1) return [makeRow(rowData.due)];
        if (sel.indexOf('chB_to') > -1) return [makeRow(rowData.to)];
        if (sel.indexOf('chB_nid') > -1) return [makeRow(rowData.nid)];
        if (sel.indexOf('chB_amt') > -1) return [makeRow(rowData.amt)];
        if (sel.indexOf('chB_sayad') > -1) return [makeRow(rowData.sayad)];
        if (sel.indexOf('chB_note') > -1) return [makeRow(rowData.note)];
        return [];
      },
      getElementById: function () { return null; }
    }
  };
  ctx.getData = function (k) { try { return JSON.parse(ctx.localStorage.getItem(k) || '[]'); } catch (e) { return []; } };
  ctx.setData = function (k, v) { ctx.localStorage.setItem(k, JSON.stringify(v)); };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('crm/cheques.js', 'utf8'), ctx, { filename: 'cheques.js' });
  return ctx;
}

/* FW-C01: چک شخصی legacy متعلق به کاربر دیگر در global نباید با هر chSave گم شود. */
(function () {
  var ctx = freshContext('chairman', 'chairmanCurrentUser');
  ctx.setData('ptf_crm_cheques', [
    { cd: 'CHQ-OLD-PERSONAL', ownership: 'personal', by: 'salesUserOld', amt: 1000000, toWhom: 'شخصی' },
    { cd: 'CHQ-COMPANY-1', ownership: 'company', by: 'chairmanUser', amt: 5000000, toWhom: 'تامین‌کننده' }
  ]);
  ctx.window.chBatchCommit(false);
  assert.ok(ctx.getData('ptf_personal_cheques_salesUserOld').some(function (c) { return c.cd === 'CHQ-OLD-PERSONAL'; }), 'FW-C01: چک legacy باید به کلید شخصی صاحبش منتقل شود');
  assert.ok(ctx.getData('ptf_crm_cheques').some(function (c) { return c.cd === 'CHQ-COMPANY-1'; }), 'FW-C01: چک شرکتی موجود دست‌نخورده بماند');
})();

/* رگرسیون: بدون رکورد legacy، رفتار عادی دست‌نخورده بماند. */
(function () {
  var ctx = freshContext('chairman', 'chairmanUser');
  ctx.setData('ptf_crm_cheques', []);
  ctx.window.chBatchCommit(false);
  var g = ctx.getData('ptf_crm_cheques');
  assert.strictEqual(g.length, 1, 'رگرسیون: بدون legacy، ثبت عادی کار کند');
  assert.strictEqual(g[0].ownership, 'company', 'رگرسیون: ownership درست بماند');
})();

/* رگرسیون: چک شخصی متعلق به خود کاربر فعلی هم درست منتقل شود. */
(function () {
  var ctx = freshContext('sales', 'salesUser1');
  ctx.setData('ptf_crm_cheques', [{ cd: 'CHQ-SELF-PERSONAL', ownership: 'personal', by: 'salesUser1', amt: 200000, toWhom: 'شخصی خودم' }]);
  ctx.window.chBatchCommit(false);
  assert.ok(ctx.getData('ptf_personal_cheques_salesUser1').some(function (c) { return c.cd === 'CHQ-SELF-PERSONAL'; }), 'رگرسیون: چک شخصی خودِ کاربر هم منتقل شود');
})();

/* رگرسیون idempotent: اجرای دوباره نباید رکورد را تکراری کند. */
(function () {
  var ctx = freshContext('accountant', 'accountantUser');
  ctx.setData('ptf_crm_cheques', [{ cd: 'CHQ-OLD-PERSONAL-2', ownership: 'personal', by: 'salesUserOld2', amt: 3000000, toWhom: 'شخصی' }]);
  ctx.window.chBatchCommit(false);
  ctx.window.chBatchCommit(false);
  var finalPersonal = ctx.getData('ptf_personal_cheques_salesUserOld2');
  assert.strictEqual(finalPersonal.filter(function (c) { return c.cd === 'CHQ-OLD-PERSONAL-2'; }).length, 1, 'رگرسیون idempotent: بدون تکرار');
})();

/* حیاتی: حذف عمدیِ یک چک شخصیِ از قبل موجود نباید توسط delta-merge دوباره زنده شود. */
(function () {
  var ctx = freshContext('sales', 'salesUser2');
  ctx.setData('ptf_personal_cheques_salesUser2', [
    { cd: 'CHQ-KEEP', ownership: 'personal', by: 'salesUser2', amt: 100000 },
    { cd: 'CHQ-TO-DELETE', ownership: 'personal', by: 'salesUser2', amt: 200000 }
  ]);
  ctx.setData('ptf_crm_cheques', []);
  ctx.window.chDel('CHQ-TO-DELETE');
  var personalAfter = ctx.getData('ptf_personal_cheques_salesUser2');
  assert.ok(!personalAfter.some(function (c) { return c.cd === 'CHQ-TO-DELETE'; }), 'حیاتی: حذف عمدی نباید دوباره زنده شود');
  assert.ok(personalAfter.some(function (c) { return c.cd === 'CHQ-KEEP'; }), 'رگرسیون: رکورد حذف‌نشده باقی بماند');
})();

console.log('PASS: tester173-v33.3.1-personal-cheque-legacy-migration-safety.js (FW-C01)');
