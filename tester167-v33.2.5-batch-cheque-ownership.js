/* AUD-06 fixture (crm/AUDIT-FINANCIAL-SYSTEM-2026-07-29.md) — protects the
   batch cheque form (chBatchCollect/chBatchCommit) from producing records
   with no explicit "ownership" field. Before this fix, chAll()/chSave()
   treated any record without ownership==='personal' as a company cheque
   by default (the filter was "!== 'personal'", not "=== 'company'"), so a
   non-senior user (e.g. sales) filling the batch form got a record that
   silently entered the company cheque pool — liquidity report, reminders,
   My Day — without any role enforcement. */
'use strict';
var fs = require('fs'), vm = require('vm'), assert = require('assert');

function makeRow(v) { return { value: v }; }

function freshContext(role) {
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
    curSession: function () { return { user: role + 'User', name: role }; },
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

function personalKeyFor(role) { return 'ptf_personal_cheques_' + role + 'User'; }

/* AUD-06: کارشناس فروش که چک batch می‌سازد نباید وارد استخر شرکتی شود. */
(function () {
  var ctx = freshContext('sales');
  ctx.window.chBatchCommit(false);
  assert.strictEqual(ctx.getData('ptf_crm_cheques').length, 0, 'AUD-06: چک batch sales نباید در ptf_crm_cheques قرار بگیرد');
  var personal = ctx.getData(personalKeyFor('sales'));
  assert.strictEqual(personal.length, 1, 'AUD-06: چک باید در کلید شخصی sales ذخیره شود');
  assert.strictEqual(personal[0].ownership, 'personal', 'AUD-06: ownership باید صریحاً personal باشد');
})();

/* رگرسیون: chairman/ceo/commercial همچنان می‌توانند چک batch شرکتی بسازند. */
['chairman', 'ceo', 'commercial'].forEach(function (role) {
  var ctx = freshContext(role);
  ctx.window.chBatchCommit(false);
  var cheques = ctx.getData('ptf_crm_cheques');
  assert.strictEqual(cheques.length, 1, 'رگرسیون: ' + role + ' باید بتواند چک batch شرکتی بسازد');
  assert.strictEqual(cheques[0].ownership, 'company', 'رگرسیون: ownership باید company باشد برای ' + role);
});

/* رگرسیون: buyer/accountant هم مثل sales باید شخصی بمانند. */
['buyer', 'accountant'].forEach(function (role) {
  var ctx = freshContext(role);
  ctx.window.chBatchCommit(false);
  assert.strictEqual(ctx.getData('ptf_crm_cheques').length, 0, 'رگرسیون: ' + role + ' نباید چک شرکتی بسازد');
  var personal = ctx.getData(personalKeyFor(role));
  assert.strictEqual(personal[0].ownership, 'personal', 'رگرسیون: ownership باید personal باشد برای ' + role);
});

console.log('PASS: tester167-v33.2.5-batch-cheque-ownership.js (AUD-06)');
