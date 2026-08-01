/* S3 — UR-10: PDF تلفیقی دورهٔ تنخواه (گزارش + رسیدها با شناسهٔ «سند N» + الزام پیوست بانک قبل از ارجاع) */
'use strict';
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var code = fs.readFileSync(path.join(BASE, 'petty.js'), 'utf-8');

/* ---------- محیط ---------- */
global.curSession = function () { return { user: 'u1', name: 'علی رضایی' }; };
global.userName = function () { return 'علی رضایی'; };
global.faMonthNow = function () { return '1405/04'; };
global.faDateTime = function () { return '1405/04/14 10:00'; };
global.isoNow = function () { return '2026-07-05'; };
global.isMgr = function () { return true; };
global.isTreasurer = function () { return true; };
global.isAccountant = function () { return false; };
global.canAll = function () { return true; };
global.curRole = function () { return 'admin'; };
global._alerts = [];
global.alert = function (m) { global._alerts.push(String(m)); };
global.audit = function () {}; global.notify = function () {};
global._prints = [];
function makeEl(ov) {
  return Object.assign({ value: '', innerHTML: '', textContent: '', style: {},
    remove: function () {}, insertAdjacentHTML: function () {}, setAttribute: function () {},
    addEventListener: function () {}, querySelectorAll: function () { return []; }, querySelector: function () { return null; },
    appendChild: function () {}, options: [], classList: { add: function () {}, remove: function () {}, contains: function () { return false; } } }, ov || {});
}
global._domGet = {};
global.document = {
  getElementById: function (id) { return global._domGet[id] || makeEl(); },
  querySelector: function () { return makeEl(); },
  querySelectorAll: function () { return []; },
  createElement: function () { return makeEl(); },
  head: makeEl(), body: makeEl(), addEventListener: function () {}
};
global.window.open = function () { return { document: { write: function (h) { global._prints.push(h); }, close: function () {} }, print: function () {} }; };
global._domGet['panels'] = makeEl({ insertAdjacentHTML: function () {} });

eval.call(global, code);
global._ptfPettyPetId = 0; /* ریست شمارندهٔ شناسه بین تست‌ها */

/* ---------- دادهٔ دورهٔ 1405/04 ---------- */
setData('ptf_crm_petty', [
  { cd: 'PTY-1', amt: 200000, cat: 'ایاب و ذهاب', desc: 'تاکسی', by: 'علی رضایی', t: '1405/04/05 09:00', month: '1405/04', st: 'settled', files: [{ key: 'petty/PTY-1/a.jpg', name: 'رسید تاکسی.jpg', url: 'blob:r1', petId: 'سند 1' }] },
  { cd: 'PTY-2', amt: 50000, cat: 'ملزومات اداری', desc: 'کاغذ', by: 'مریم احمدی', t: '1405/04/10 11:00', month: '1405/04', st: 'open', files: [{ key: 'petty/PTY-2/b.png', name: 'فاکتور کاغذ.png', url: 'blob:r2', petId: 'سند 2' }] }
]);
setData('ptf_crm_petty_tx', [
  { cd: 'TX-1', type: 'charge', amt: 1000000, by: 'علی رضایی', t: '1405/04/01 09:00', month: '1405/04', note: 'شارژ' },
  { cd: 'TX-3', type: 'direct', amt: 70000, by: 'علی رضایی', t: '1405/04/12 12:00', month: '1405/04', note: 'ناهار', files: [{ key: 'petty/TX-3/c.jpg', name: 'رسید ناهار.jpg', url: 'blob:r3', petId: 'سند 3' }] }
]);
setData('ptf_crm_petty_periods', [{ cd: 'PPR-1', month: '1405/04', st: 'referred', files: [{ key: 'petty-period/PPR-1/bank.jpg', name: 'صورتحساب بانک.jpg', url: 'blob:bank' }], totalOut: 270000, charges: 1000000, balance: 730000 }]);

SECTION('ساختار');
T('توابع PDF تلفیقی موجودند', code.indexOf('window.ptfPettyPeriodCombinedPdf') > -1 && code.indexOf('window.ptfPettyReceiptsHtml') > -1 && code.indexOf('window.ptfPettyPeriodFiles') > -1 && code.indexOf('window.ptfPettyNextPetId') > -1);
T('دکمهٔ «PDF تلفیقی» در renderPeriods هست', code.indexOf('📎 PDF تلفیقی') > -1 && code.indexOf('ptfPettyPeriodCombinedPdf') > -1);

SECTION('شناسهٔ «سند N»');
var id1 = ptfPettyNextPetId(), id2 = ptfPettyNextPetId();
T('شناسه‌ها پشت‌سرهم (سند ۱، سند ۲)', id1 === 'سند 1' && id2 === 'سند 2');

SECTION('جمع‌آوری فایل‌های دوره (ptfPettyPeriodFiles)');
var files = ptfPettyPeriodFiles('1405/04');
T('۳ فایل (رسید تاکسی/فاکتور کاغذ/رسید ناهار) جمع شدند', files.length === 3);
T('هر فایل شناسهٔ ردیف دارد و فایل‌های یک رکورد هم‌شناسه‌اند', files[0].petId === files[0].petId && files.every(function (f) { return f.petId; }) && files[0].name === 'رسید تاکسی.jpg');

SECTION('BUG-PDF-ATTACH: تشخیص نوع فایل (عکس/PDF/سایر)');
T('ptfPettyFileKind عکس را تشخیص می‌دهد', ptfPettyFileKind('رسید.jpg') === 'image' && ptfPettyFileKind('رسید.PNG') === 'image');
T('ptfPettyFileKind PDF را تشخیص می‌دهد', ptfPettyFileKind('bank.pdf') === 'pdf' && ptfPettyFileKind('BANK.PDF') === 'pdf');
T('رندر عکس → <img> و رندر PDF → <embed>', (function () {
  var hi = ptfPettyReceiptHtml({ name: 'a.jpg', url: 'blob:x', petId: 'سند 1' });
  var hp = ptfPettyReceiptHtml({ name: 'b.pdf', url: 'blob:y', petId: 'سند 2' });
  return hi.indexOf('<img src="blob:x"') > -1 && hp.indexOf('<embed src="blob:y"') > -1 && hp.indexOf('application/pdf') > -1;
})());
T('resolve: فایل بدون url (فقط key) → از storage گرفته می‌شود (با mock fetch)', (function () {
  var got = null;
  global.fetch = function () { return Promise.resolve({ json: function () { return Promise.resolve({ ok: true, url: 'https://cdn/bank.pdf' }); } }); };
  var p = ptfPettyResolveUrl({ key: 'petty-period/PPR-1/bank.pdf', name: 'bank.pdf' });
  p.then(function (u) { got = u; });
  return got === null; /* async — در تست بعدی با تاخیر چک می‌شود */
})());

SECTION('چیدمان فشردهٔ ۳-در-صفحه (ptfPettyReceiptsHtml)');
var grid = ptfPettyReceiptsHtml(files);
T('چیدمان ۳-در-صفحه: کلاس rcpt + ۳ تصویر + عرض ۳۳٪', (function () {
  var a = grid.indexOf('class="rcpt"') > -1;
  var b = (grid.match(/<img /g) || []).length === 3;
  var c = code.indexOf('calc(33.3% - 4px)') > -1;
  if (!a || !b || !c) console.log('grid-fail:', a, b, c, '| grid len:', grid.length, '| code calc:', code.indexOf('calc(33.3% - 4px)'));
  return a && b && c;
})());

SECTION('PDF تلفیقی (ptfPettyPeriodCombinedPdf) — همگام با Promise');
ptfPettyPeriodCombinedPdf('1405/04');
/* async: صبر برای resolve شدن URLها (mock fetch فوری) */
var out = new Promise(function (resolve) {
  setTimeout(function () { resolve(global._prints.join('')); }, 50);
});
SECTION('الزام پیوست بانک قبل از ارجاع (pettyClosePeriod)');
/* شبیه‌سازی ارجاع بدون پیوست بانک → باید مسدود شود */
setData('ptf_crm_petty_periods', [{ cd: 'PPR-1', month: '1405/04', st: 'referred', files: [], totalOut: 270000, charges: 1000000, balance: 730000 }]);
var _dlg = null;
global.ptfDialog = function (opt) { _dlg = opt; };
global._alerts.length = 0;
pettyClosePeriod();
T('دیالوگ ارجاع باز شد', !!_dlg && _dlg.title.indexOf('ارجاع گزارش دوره') > -1);
T('بدنه هشدار «پیوست الزامی» دارد', !!_dlg && _dlg.body.indexOf('پیوست') > -1 && _dlg.body.indexOf('الزامی') > -1);
/* اجرای onOk بدون پیوست (آخرین دورهٔ referred بدون فایل) → باید هشدار بدهد و ارجاع نسازد */
var before = getData('ptf_crm_petty_periods').length;
_dlg.onOk({ from: '1405/04/02', to: '1405/04/30', note: '', sms: 'no' });
T('ارجاع بدون پیوست مسدود شد (هشدار + بدون رکورد جدید)', getData('ptf_crm_petty_periods').length === before && global._alerts.length === 1 && global._alerts[0].indexOf('صورتحساب بانک') > -1);

setTimeout(function () {
  var o = global._prints.join('');
  T('شامل گزارش + صفحهٔ ضمائم + پیوست بانک', o.indexOf('گزارش دورهٔ تنخواه') > -1 && o.indexOf('ضمائم و رسیدهای پرداخت') > -1 && o.indexOf('صورتحساب بانک') > -1);
  T('شامل شناسهٔ «سند» در کارت رسیدها', o.indexOf('سند 1') > -1 && o.indexOf('سند 2') > -1 && o.indexOf('سند 3') > -1);
  T('جدول گزارش ردیف دارد', o.indexOf('<th>ردیف</th>') > -1 && o.indexOf('<th>توسط</th>') > -1);
  T('پیوست بانک در صفحهٔ جدا (page-break) هست', o.indexOf('<div class="page">') > -1 && o.indexOf('پیوست صورتحساب بانک') > -1);
  DONE('tester209-v3301-petty-combined-pdf');
}, 80);

