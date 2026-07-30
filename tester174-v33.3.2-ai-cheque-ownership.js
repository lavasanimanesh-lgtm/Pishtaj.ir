/* AUD-06-b fixture (crm/AUDIT-FINANCIAL-SYSTEM-2026-07-29.md) — this is the
   same class of bug as AUD-06 (batch cheque form), discovered separately in
   the "AI cheque assistant" entry point (chAiCommit). Records created there
   had no explicit "ownership" field either, so chSave()/chAll() treated
   them as company cheques by default (filter was "!== 'personal'", not
   "=== 'company'"), letting a non-senior role (e.g. sales) silently enter
   a cheque into the company pool via this second, independent form. */
'use strict';
var fs = require('fs'), vm = require('vm'), assert = require('assert');

function freshContext(role, curUser) {
  var store = {};
  var formValues = {
    chAiNo: { value: '999888' }, chAiAmt: { value: '2000000' }, chAiTo: { value: 'یک نفر' },
    chAiDueJ: { value: '1405/06/15' }, chAiKind: { value: 'finance' }, chAiBank: { value: '' }, chAiNote: { value: '' }
  };
  var ctx = {
    console: console, JSON: JSON, Math: Math, Array: Array, Object: Object, String: String, Date: Date,
    localStorage: { getItem: function (k) { return store[k] != null ? store[k] : null; }, setItem: function (k, v) { store[k] = String(v); } },
    escP: function (x) { return String(x == null ? '' : x); },
    genCode: function (p) { return p + '-' + Math.floor(Math.random() * 100000); },
    faDateTime: function () { return '1405/04/29 10:00'; },
    audit: function () {}, ptfToast: function () {},
    curRole: function () { return role; },
    curSession: function () { return { user: curUser, name: curUser }; },
    ptfNum: function (v) { return +String(v).replace(/,/g, '') || 0; },
    ptfJToISO: function () { return '2026-09-06'; }, ptfISOToJ: function () { return '1405/06/15'; },
    alert: function () {},
    setInterval: function () { return 0; }, setTimeout: function () { return 0; },
    document: { getElementById: function (id) { return formValues[id] || null; } }
  };
  ctx.getData = function (k) { try { return JSON.parse(ctx.localStorage.getItem(k) || '[]'); } catch (e) { return []; } };
  ctx.setData = function (k, v) { ctx.localStorage.setItem(k, JSON.stringify(v)); };
  ctx.window = ctx;
  ctx.window.refreshBox = function () {};
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('crm/cheques.js', 'utf8'), ctx, { filename: 'cheques.js' });
  return ctx;
}

/* AUD-06-b: کارشناس فروش نباید بتواند از دستیار AI چک شرکتی ثبت کند. */
(function () {
  var ctx = freshContext('sales', 'salesAiUser');
  ctx.window.chAiCommit();
  assert.strictEqual(ctx.getData('ptf_crm_cheques').length, 0, 'AUD-06-b: چک AI کارشناس فروش نباید شرکتی شود');
  var personal = ctx.getData('ptf_personal_cheques_salesAiUser');
  assert.strictEqual(personal.length, 1, 'AUD-06-b: چک باید در کلید شخصی ذخیره شود');
  assert.strictEqual(personal[0].ownership, 'personal', 'AUD-06-b: ownership باید صریحاً personal باشد');
})();

/* رگرسیون: chairman/ceo/commercial همچنان بتوانند چک شرکتی از دستیار AI ثبت کنند. */
['chairman', 'ceo', 'commercial'].forEach(function (role) {
  var ctx = freshContext(role, role + 'User');
  ctx.window.chAiCommit();
  var cheques = ctx.getData('ptf_crm_cheques');
  assert.strictEqual(cheques.length, 1, 'رگرسیون: ' + role + ' باید بتواند چک AI شرکتی بسازد');
  assert.strictEqual(cheques[0].ownership, 'company', 'رگرسیون: ownership باید company باشد برای ' + role);
});

/* رگرسیون: buyer/accountant هم مثل sales محدود بمانند. */
['buyer', 'accountant'].forEach(function (role) {
  var ctx = freshContext(role, role + 'User');
  ctx.window.chAiCommit();
  assert.strictEqual(ctx.getData('ptf_crm_cheques').length, 0, 'رگرسیون: ' + role + ' نباید چک AI شرکتی بسازد');
});

console.log('PASS: tester174-v33.3.2-ai-cheque-ownership.js (AUD-06-b)');
