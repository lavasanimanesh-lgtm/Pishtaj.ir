'use strict';
/* v34.5.5: کارتابل فقط اقدام لازم — خبرهای اطلاعی ذخیره/نمایش نمی‌شوند. */
var fs = require('fs');
var vm = require('vm');
var assert = require('assert');

var store = {};
var ctx = {
  console: console, JSON: JSON, Math: Math, Array: Array, Object: Object, String: String,
  Date: Date, Number: Number, parseInt: parseInt,
  localStorage: {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem: function (k, v) { store[k] = String(v); },
    removeItem: function (k) { delete store[k]; }
  },
  getData: function (k) { try { return JSON.parse(store[k] || '[]'); } catch (e) { return []; } },
  setData: function (k, v) { store[k] = JSON.stringify(v); },
  escP: function (x) { return String(x == null ? '' : x); },
  genCode: (function () { var n = 0; return function (p) { n++; return p + '-' + n; }; })(),
  faDate: function () { return '1405/05/21'; },
  faDateTime: function () { return '1405/05/21 12:00'; },
  audit: function () {},
  ptfToast: function () {},
  alert: function () {},
  confirm: function () { return true; },
  setInterval: function () { return 0; },
  setTimeout: function () { return 0; },
  clearInterval: function () {},
  document: { getElementById: function () { return null; }, querySelectorAll: function () { return []; } },
  window: null
};
ctx.window = ctx;
ctx.curSession = function () { return { user: 'admin', name: 'ادمین' }; };
ctx.curRole = function () { return 'admin'; };
ctx.roleDef = function () { return { lb: 'ادمین', finance: true, users: true, panels: '*' }; };
ctx.isSenior = function () { return true; };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('crm/rbac.js', 'utf8'), ctx, { filename: 'rbac.js' });

assert.ok(ctx.ntfNeedsAction({ actionable: true }), 'actionable = اقدام');
assert.ok(ctx.ntfNeedsAction({ kind: 'referral' }), 'ارجاع = اقدام');
assert.ok(ctx.ntfNeedsAction({ kind: 'inv_ref' }), 'ارجاع فاکتور = اقدام');
assert.ok(ctx.ntfNeedsAction({ kind: 'cheque', actionable: true }), 'چک = اقدام');
assert.ok(!ctx.ntfNeedsAction({ kind: 'info' }), 'خبر info اقدام نیست');
assert.ok(!ctx.ntfNeedsAction({ kind: 'system' }), 'system خام اقدام نیست');
assert.ok(!ctx.ntfNeedsAction({ kind: 'buyq' }), 'قیمت خرید اقدام نیست');
assert.ok(!ctx.ntfNeedsAction({ kind: 'payment' }), 'تسویه خبر است');
assert.ok(!ctx.ntfNeedsAction({ kind: 'referral_info' }), 'ارجاع عمومی اقدام نیست');
assert.ok(ctx.ntfIsImportant({ kind: 'sign_req' }), 'alias مهم = اقدام');

ctx.notify({ toRoles: ['admin'], title: 'فاکتور ثبت شد', kind: 'payment' });
ctx.notify({ toRoles: ['admin'], title: 'قیمت خرید جدید', kind: 'buyq' });
ctx.notify({ toRoles: ['admin'], title: 'برنده شد', kind: 'info' });
assert.strictEqual(ctx.getData('ptf_crm_notifs').length, 0, 'خبر اطلاعی ذخیره نشود');

ctx.notify({ toUsers: ['acc'], title: 'صدور فاکتور لازم است', kind: 'inv_ref' });
assert.strictEqual(ctx.getData('ptf_crm_notifs').length, 1, 'ارجاع فاکتور ذخیره شود');
assert.ok(ctx.getData('ptf_crm_notifs')[0].actionable, 'ارجاع فاکتور actionable شود');

ctx.notify({ toUsers: ['sales1'], title: 'اقدام شما لازم است', kind: 'referral', actionable: true });
assert.strictEqual(ctx.getData('ptf_crm_notifs').length, 2, 'ارجاع شخصی ذخیره شود');

ctx.setData('ptf_crm_notifs', ctx.getData('ptf_crm_notifs').concat([
  { cd: 'OLD-INFO', kind: 'buyq', title: 'قدیمی', readBy: [], iso: new Date().toISOString() },
  { cd: 'OLD-BROADCAST', kind: 'referral_info', title: 'به همه', readBy: [] }
]));
var removed = ctx.ptfPruneStaleNotifs();
assert.ok(removed >= 2, 'خبرهای قدیمی از انبار پاک شوند');
assert.ok(ctx.getData('ptf_crm_notifs').every(function (n) { return ctx.ntfNeedsAction(n); }), 'بعد از prune فقط اقدام بماند');

var src = fs.readFileSync('crm/rbac.js', 'utf8');
assert.ok(src.indexOf('🔴 اقدام لازم') > -1, 'کارتابل عنوان اقدام لازم دارد');
assert.ok(src.indexOf('🔵 اطلاع‌رسانی') === -1, 'بخش اطلاع‌رسانی کارتابل حذف شده');
assert.ok(src.indexOf("panels: ['inv','recv','petty','chqprint','cart','ai']") > -1, 'حسابدار کارتابل دارد');

var br = fs.readFileSync('crm/bridge.js', 'utf8');
assert.ok(br.indexOf("kind: 'referral_info'") === -1, 'ارجاع عمومی ساخته نمی‌شود');
assert.ok(br.indexOf('ntfNeedsAction') > -1, 'صندوق پیام از همان گیت اقدام استفاده می‌کند');

var version = JSON.parse(fs.readFileSync('VERSION.json', 'utf8')).crm_version;
assert.strictEqual(version, 'v34.5.7');
assert.ok(br.indexOf("kind: 'offer_wait'") === -1, 'offer_wait حذف شده');
var md = fs.readFileSync('crm/myday.js', 'utf8');
assert.ok(md.indexOf('ntfNeedsAction') > -1, 'روز من از گیت اقدام استفاده می‌کند');
console.log('PASS tester395: action-only cartable v34.5.7');
