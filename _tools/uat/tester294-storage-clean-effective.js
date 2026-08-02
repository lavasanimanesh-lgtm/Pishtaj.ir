/* tester294 — v33.14.0 (STORAGE-CLEAN-EFFECTIVE): چرا پاک‌سازی امن/مهاجرت حجم را کم نمی‌کرد + رفع
 * ریشه: پاک‌سازی قبلی فقط کلیدهای حاشیه (notifs/sendqueue/audit/ai/…) را هدف می‌گرفت؛
 * بزرگ‌ترین کلیدهای غیرحیاتی (avatars عکس base64 و storage_queue صف فایل) اصلاً هرس نمی‌شدند
 * و کلیدهای اصلی عمداً حذف نمی‌شدند → وقتی دادهٔ اصلی بزرگ است، آزادسازی ناچیز.
 * رفع: compactAvatars (۲۰ آخر + آرشیو IDB) + compactStorageQueue (انجام‌شده/قدیمی)
 * + هرس سنی audit/notifs/sendqueue + isVolatileArchiveCandidate گسترده + راهنمای صریح UI.
 */
'use strict';
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var sq = fs.readFileSync(path.join(BASE, 'storage-quota.js'), 'utf-8');
var bak = fs.readFileSync(path.join(BASE, 'backup.js'), 'utf-8');

/* ---------- استاب‌ها ---------- */
global.curSession = function () { return { user: 'u1', name: 'علی' }; };
global.curRole = function () { return 'admin'; };
global.faDateTime = function () { return '1405/05/11 10:00'; };
global.audit = function () {};
global.addLog = function () {};
global.alert = function () {};
global.notify = function () {};
global.confirm = function () { return true; };
global.SENIOR_ROLES = [];
global.goPanelByName = function () {};
global.window = global;
global._idbWrites = [];
global.indexedDB = undefined; /* شبیه‌سازی مرورگر بدون IDB برای تست fallback */
global.ptfStorageIdbSet = undefined;
global.fetch = function () { return new Promise(function (res) { res({ json: function () { return Promise.resolve({ ok: true, mode: 'server' }); } }); }); };
global.AbortController = function () { this.signal = {}; this.abort = function () {}; };
global.document = {
  getElementById: function () { return null; },
  querySelector: function () { return null; },
  querySelectorAll: function () { return []; },
  createElement: function () { return { style: {}, appendChild: function () {}, click: function () {} }; },
  head: { appendChild: function () {} }, body: { appendChild: function () {} },
  addEventListener: function () {}
};

/* دادهٔ اولیه — شبیه‌سازی یک مرورگر واقعیِ پر */
var bigAvatar = { d: 'x'.repeat(50000), t: Date.now() - 200 * 86400000 }; /* ۵۰KB قدیمی */
var newAvatar = { d: 'y'.repeat(50000), t: Date.now() };
setData('ptf_crm_avatars', {
  u1: bigAvatar, u2: bigAvatar, u3: bigAvatar, u4: bigAvatar, u5: bigAvatar,
  u6: bigAvatar, u7: bigAvatar, u8: bigAvatar, u9: bigAvatar, u10: bigAvatar,
  u11: bigAvatar, u12: bigAvatar, u13: bigAvatar, u14: bigAvatar, u15: bigAvatar,
  u16: bigAvatar, u17: bigAvatar, u18: bigAvatar, u19: bigAvatar, u20: bigAvatar,
  u21: bigAvatar, u22: bigAvatar, u23: bigAvatar, u24: bigAvatar, u25: newAvatar, u26: newAvatar
}); /* ۲۶ آواتار ~۱.۳MB */
setData('ptf_storage_queue', [
  { st: 'done', ts: Date.now() - 1 }, { st: 'uploaded', ts: Date.now() - 2 },
  { st: 'pending', ts: Date.now() - 100 }, { st: 'pending', ts: Date.now() - 20 * 86400000 } /* قدیمی */
]);
var oldAudit = [];
for (var i = 0; i < 500; i++) oldAudit.push({ cd: 'A' + i, t: Date.now() - 200 * 86400000 });
setData('ptf_crm_audit', oldAudit.concat([{ cd: 'NEW', t: Date.now() }]));

eval.call(global, sq);

SECTION('ریشه: avatars و storage_queue قبلاً هرس نمی‌شدند');
T('isVolatileArchiveCandidate حالا شامل avatars و storage_queue است', /ptf_crm_avatars/.test(sq) && /ptf_storage_queue/.test(sq) && sq.indexOf('isVolatileArchiveCandidate') > -1);

SECTION('پاک‌سازی امن مؤثر');
var before = getData('ptf_crm_avatars');
var r = window.ptfStorageEmergencyCompact({ source: 'test' });
T('avatars: فقط ۲۰ آواتار آخر ماند', Object.keys(getData('ptf_crm_avatars')).length === 20);
T('avatars: آواتارهای جدید حفظ شدند', !!getData('ptf_crm_avatars').u25 && !!getData('ptf_crm_avatars').u26);
T('storage_queue: انجام‌شده‌ها و قدیمی‌ها حذف شدند', (function () {
  var q = getData('ptf_storage_queue');
  return q.length === 1 && q[0].st === 'pending' && (q[0].ts > Date.now() - 7 * 86400000);
})());
T('audit: قدیمی‌تر از ۱۸۰ روز حذف شد (جدید ماند)', (function () {
  var a = getData('ptf_crm_audit');
  return a.length === 1 && a[0].cd === 'NEW';
})());
T('آزادسازی واقعی > ۲۵۰KB انجام شد (۶ آواتار ۵۰KB + صف + audit)', r.freed > 250 * 1024);

SECTION('راهنمای صریح UI برای «چرا کم نمی‌شود»');
T('پیام علت در Storage Meter هست', bak.indexOf('اگر «پاک‌سازی امن» و «مهاجرت» حجم را کم نکردند') > -1 && bak.indexOf('نمایش کلیدهای بزرگ') > -1);
T('پس از پاک‌سازی، اگر آزادسازی < ۲۵۶KB علت + کلیدهای بزرگ نشان داده می‌شود', bak.indexOf('freed < 256 * 1024') > -1 && bak.indexOf('بزرگ‌ترین کلیدها (اگر از نوع دادهٔ اصلی‌اند') > -1);

DONE('tester294-storage-clean-effective');
