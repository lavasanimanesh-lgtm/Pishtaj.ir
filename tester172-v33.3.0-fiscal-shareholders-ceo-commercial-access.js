/* AUD-11 fixture (crm/AUDIT-FINANCIAL-SYSTEM-2026-07-29.md) — protects the
   client's explicit decision (2026-07-29): ceo and commercial should have
   full access to the fiscal-year dashboard (fiscal.js) and shareholders
   panel (shareholders.js), matching ROLES.finance in rbac.js and the
   finance-hub tab bar (financehub.js#canHub) which already showed these
   tabs to ceo/commercial as clickable — but they previously always
   rendered empty for those two roles. canFiscalUnlock() (chairman-only)
   is a deliberately separate, narrower gate and must remain unaffected. */
'use strict';
var fs = require('fs'), vm = require('vm'), assert = require('assert');

function freshContext(fileName, role) {
  var store = {};
  var ctx = {
    console: console, JSON: JSON, Math: Math, Array: Array, Object: Object, String: String, Date: Date,
    localStorage: { getItem: function (k) { return store[k] != null ? store[k] : null; }, setItem: function (k, v) { store[k] = String(v); } },
    escP: function (x) { return String(x == null ? '' : x); },
    genCode: function (p) { return p + '-' + Math.floor(Math.random() * 100000); },
    faDate: function () { return '1405/04/29'; }, faDateTime: function () { return '1405/04/29 10:00'; },
    audit: function () {}, ptfToast: function () {},
    curRole: function () { return role; },
    curSession: function () { return { user: role + 'User', name: role }; },
    alert: function (m) { ctx._lastAlert = m; },
    _lastAlert: null,
    setInterval: function () { return 0; }, setTimeout: function () { return 0; },
    document: { getElementById: function () { return null; } }
  };
  ctx.getData = function (k) { try { return JSON.parse(ctx.localStorage.getItem(k) || '[]'); } catch (e) { return []; } };
  ctx.setData = function (k, v) { ctx.localStorage.setItem(k, JSON.stringify(v)); };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(fileName, 'utf8'), ctx, { filename: fileName });
  return ctx;
}

/* AUD-11: ceo/commercial باید به fiscal.js دسترسی کامل داشته باشند. */
['ceo', 'commercial'].forEach(function (role) {
  var ctx = freshContext('crm/fiscal.js', role);
  ctx.window.ptfFiscalLock();
  var blockedCompletely = ctx._lastAlert && ctx._lastAlert.indexOf('فقط ادمین/رییس هیات مدیره') > -1 && ctx._lastAlert.indexOf('مدیرعامل') === -1;
  assert.ok(!blockedCompletely, 'AUD-11: نقش ' + role + ' نباید کاملاً از fiscal.js مسدود شود');
});

/* AUD-11: ceo/commercial باید بتوانند سهامدار ثبت/ویرایش کنند. */
['ceo', 'commercial'].forEach(function (role) {
  var ctx = freshContext('crm/shareholders.js', role);
  ctx.window.ptfDialog = function () { ctx._dialogOpened = true; };
  ctx.window.ptfShareEdit();
  assert.strictEqual(ctx._dialogOpened, true, 'AUD-11: نقش ' + role + ' باید بتواند دیالوگ سهامدار را باز کند');
});

/* رگرسیون: نقش‌های غیرمرتبط همچنان مسدود بمانند. */
['sales', 'buyer', 'accountant', 'collector'].forEach(function (role) {
  var ctx = freshContext('crm/fiscal.js', role);
  ctx.window.ptfFiscalLock();
  assert.ok(ctx._lastAlert && ctx._lastAlert.indexOf('فقط ادمین') > -1, 'رگرسیون: ' + role + ' باید از fiscal.js مسدود بماند');
});
['sales', 'buyer', 'accountant', 'collector'].forEach(function (role) {
  var ctx = freshContext('crm/shareholders.js', role);
  ctx.window.ptfDialog = function () { ctx._dialogOpened = true; };
  ctx.window.ptfShareEdit();
  assert.notStrictEqual(ctx._dialogOpened, true, 'رگرسیون: ' + role + ' باید از shareholders.js مسدود بماند');
});

/* رگرسیون حیاتی: قفل‌گشایی سال مالی همچنان فقط برای chairman باشد (حتی admin/ceo نه). */
['ceo', 'admin', 'commercial'].forEach(function (role) {
  var ctx = freshContext('crm/fiscal.js', role);
  ctx.setData('ptf_crm_fiscal_snapshots', [{ cd: 'FSY-1', year: '1404', locked: true }]);
  ctx.window._fiscalYear = '1404';
  ctx.window.ptfFiscalUnlockOpen('1404');
  assert.ok(ctx._lastAlert && ctx._lastAlert.indexOf('رییس هیات مدیره') > -1, 'رگرسیون حیاتی: ' + role + ' نباید بتواند قفل سال را باز کند (فقط chairman)');
});

console.log('PASS: tester172-v33.3.0-fiscal-shareholders-ceo-commercial-access.js (AUD-11)');
