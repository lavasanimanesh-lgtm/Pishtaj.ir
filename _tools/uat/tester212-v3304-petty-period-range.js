/* UR-11 — دورهٔ بازه‌ای تنخواه: از آخرین ارجاع تا تاریخ انتخابی + قالب کامل گزارش (نحوهٔ پرداخت) */
'use strict';
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var code = fs.readFileSync(path.join(BASE, 'petty.js'), 'utf-8');

global.curSession = function () { return { user: 'u1', name: 'علی رضایی' }; };
global.userName = function () { return 'علی رضایی'; };
global.faMonthNow = function () { return '1405/04'; };
global.faDate = function () { return '1405/04/20'; };
global.faDateTime = function () { return '1405/04/20 10:00'; };
global.isoNow = function () { return '2026-07-11'; };
global.isMgr = function () { return true; };
global.isTreasurer = function () { return true; };
global.isAccountant = function () { return false; };
global.canAll = function () { return true; };
global.curRole = function () { return 'admin'; };
global._alerts = [];
global.alert = function (m) { global._alerts.push(String(m)); };
global.audit = function () {}; global.notify = function () {};
global._prints = []; global._downloads = [];
function makeEl(ov) {
  return Object.assign({ value: '', innerHTML: '', textContent: '', style: {},
    remove: function () {}, insertAdjacentHTML: function () {}, setAttribute: function () {},
    addEventListener: function () {}, querySelectorAll: function () { return []; }, querySelector: function () { return null; },
    appendChild: function () {}, options: [], classList: { add: function () {}, remove: function () {}, contains: function () { return false; } } }, ov || {});
}
global._domGet = {}; global._inserted = [];
global.document = {
  getElementById: function (id) { return global._domGet[id] || makeEl(); },
  querySelector: function () { return makeEl(); },
  querySelectorAll: function () { return []; },
  createElement: function () { return makeEl({ click: function () {}, href: '' }); },
  head: makeEl(), body: makeEl(), addEventListener: function () {}
};
global.URL = { createObjectURL: function (b) { global._downloads.push(b); return 'blob:x'; } };
global.Blob = function (parts) { this.parts = parts; };
global.window.open = function () { return { document: { write: function (h) { global._prints.push(h); }, close: function () {} }, print: function () {} }; };
global._domGet['panels'] = makeEl({ insertAdjacentHTML: function (_, h) { global._inserted.push(h); } });

eval.call(global, code);

/* ---------- داده: دورهٔ قبلی ارجاع‌شده تا 1405/04/10 + هزینه‌های قبل/بعد ---------- */
setData('ptf_crm_petty_periods', [
  { cd: 'PPR-OLD', from: '1405/04/01', to: '1405/04/10', month: '1405/04', st: 'referred', files: [{ key: 'k-bank', name: 'bank.jpg' }], totalOut: 100000, charges: 1000000, balance: 900000 }
]);
setData('ptf_crm_petty', [
  { cd: 'PTY-1', amt: 100000, cat: 'قبلی', desc: 'داخل دورهٔ قبلی', by: 'علی رضایی', t: '1405/04/05 09:00', month: '1405/04', st: 'settled', settledT: '1405/04/06', settledBy: 'علی رضایی' },
  { cd: 'PTY-2', amt: 50000, cat: 'ایاب و ذهاب', desc: 'تاکسی', by: 'مریم احمدی', t: '1405/04/15 09:00', month: '1405/04', st: 'settled', settledT: '1405/04/16', settledBy: 'علی رضایی', files: [{ key: 'k1', name: 'رسید تاکسی.jpg', petId: 'سند 1' }] },
  { cd: 'PTY-3', amt: 30000, cat: 'ملزومات', desc: 'کاغذ', by: 'علی رضایی', t: '1405/04/18 11:00', month: '1405/04', st: 'open', payMode: 'direct', files: [{ key: 'k2', name: 'رسید کاغذ.jpg', petId: 'سند 2' }] }
]);
setData('ptf_crm_petty_tx', [
  { cd: 'TX-1', type: 'charge', amt: 500000, by: 'علی رضایی', t: '1405/04/12 09:00', month: '1405/04', note: 'شارژ دورهٔ جدید' },
  { cd: 'TX-2', type: 'direct', amt: 70000, by: 'علی رضایی', t: '1405/04/17 12:00', month: '1405/04', note: 'پرداخت مستقیم ناهار', files: [{ key: 'k3', name: 'رسید ناهار.jpg', petId: 'سند 3' }] }
]);

SECTION('بازهٔ پیشنهادی (از آخرین ارجاع تا امروز)');
var sg = ptfPettySuggestedRange();
T('from = روز پس از «تا» آخرین دوره (1405/04/11) و to = امروز (1405/04/20)', sg.from === '1405/04/11' && sg.to === '1405/04/20');

SECTION('فیلتر بازه');
var d = ptfPettyPeriodData('1405/04/11', '1405/04/20');
T('فقط رکوردهای بازه: ۲ هزینه + ۲ تراکنش (هزینهٔ 04/05 خارج شد)', d.isRange === true && d.petty.length === 2 && d.tx.length === 2 && d.petty.every(function (p) { return p.cd !== 'PTY-1'; }));

SECTION('قالب کامل رویدادها (نحوهٔ پرداخت)');
var ev = ptfPettyPeriodEvents('1405/04/11', '1405/04/20');
T('۴ رویداد با ترتیب زمانی', ev.length === 4 && ev[0].row === 1);
var settled = ev.filter(function (e) { return e.cd === undefined && e.desc.indexOf('تاکسی') > -1; })[0] || ev.filter(function (e) { return e.desc && e.desc.indexOf('تاکسی') > -1; })[0];
T('هزینهٔ تسویه‌شده: «تسویه در تاریخ X توسط Y» دارد', !!settled && settled.status.indexOf('تسویه در 1405/04/16') > -1 && settled.status.indexOf('علی رضایی') > -1);
var direct = ev.filter(function (e) { return e.desc && e.desc.indexOf('کاغذ') > -1; })[0];
T('هزینهٔ مستقیم: «پرداخت مستقیم از تنخواه» دارد', !!direct && direct.status === 'پرداخت مستقیم از تنخواه');
var txDirect = ev.filter(function (e) { return e.desc && e.desc.indexOf('ناهار') > -1; })[0];
T('تراکنش مستقیم: «پرداخت مستقیم از تنخواه»', !!txDirect && txDirect.status === 'پرداخت مستقیم از تنخواه');
var charge = ev.filter(function (e) { return e.kind === 'شارژ حساب'; })[0];
T('شارژ: «شارژ حساب» با نام ثبت‌کننده', !!charge && charge.by === 'علی رضایی');

SECTION('BUG-RANGE: رکوردهای بدون تاریخ/میلادی در بازه (ریشه‌کنی)');
global.ptfISOToJ = function (iso) { return iso === '2026-07-06' ? '1405/04/15' : '1405/04/01'; };
setData('ptf_crm_petty', [
  { cd: 'NT-1', amt: 100, cat: 'بدون تاریخ', by: 'علی', month: '1405/04', st: 'open' },
  { cd: 'ISO-1', amt: 200, cat: 'میلادی', by: 'علی', t: '2026-07-06 10:00', month: '1405/04', st: 'open' },
  { cd: 'SH-1', amt: 300, cat: 'شمسی', by: 'علی', t: '1405/04/15 09:00', month: '1405/04', st: 'open' },
  { cd: 'OUT-1', amt: 400, cat: 'خارج بازه', by: 'علی', t: '1405/03/01 09:00', month: '1405/03', st: 'open' }
]);
setData('ptf_crm_petty_tx', []);
var evR = ptfPettyPeriodEvents('1405/04/11', '1405/04/20');
T('هر ۳ نوع (شمسی/میلادی/بدون تاریخ) در بازه دیده می‌شوند', evR.length === 3 && evR.some(function (e) { return e.desc.indexOf('بدون تاریخ') > -1; }) && evR.some(function (e) { return e.desc.indexOf('میلادی') > -1; }) && evR.some(function (e) { return e.desc.indexOf('شمسی') > -1; }));
T('رکورد خارج بازه (ماه قبل) نیامده', !evR.some(function (e) { return e.desc.indexOf('خارج بازه') > -1; }));
/* ریست دادهٔ اصلی (همان ابتدای فایل) */
setData('ptf_crm_petty', [
  { cd: 'PTY-1', amt: 100000, cat: 'قبلی', desc: 'داخل دورهٔ قبلی', by: 'علی رضایی', t: '1405/04/05 09:00', month: '1405/04', st: 'settled', settledT: '1405/04/06', settledBy: 'علی رضایی' },
  { cd: 'PTY-2', amt: 50000, cat: 'ایاب و ذهاب', desc: 'تاکسی', by: 'مریم احمدی', t: '1405/04/15 09:00', month: '1405/04', st: 'settled', settledT: '1405/04/16', settledBy: 'علی رضایی', files: [{ key: 'k1', name: 'رسید تاکسی.jpg', petId: 'سند 1' }] },
  { cd: 'PTY-3', amt: 30000, cat: 'ملزومات', desc: 'کاغذ', by: 'علی رضایی', t: '1405/04/18 11:00', month: '1405/04', st: 'open', payMode: 'direct', files: [{ key: 'k2', name: 'رسید کاغذ.jpg', petId: 'سند 2' }] }
]);
setData('ptf_crm_petty_tx', [
  { cd: 'TX-1', type: 'charge', amt: 500000, by: 'علی رضایی', t: '1405/04/12 09:00', month: '1405/04', note: 'شارژ دورهٔ جدید' },
  { cd: 'TX-2', type: 'direct', amt: 70000, by: 'علی رضایی', t: '1405/04/17 12:00', month: '1405/04', note: 'پرداخت مستقیم ناهار', files: [{ key: 'k3', name: 'رسید ناهار.jpg', petId: 'سند 3' }] }
]);

SECTION('تقویم + نرمال‌سازی تاریخ (UR-11 تکمیلی)');
T('نرمال‌سازی فرمت 1405-04-01 → 1405/04/01', ptfPettyNormDate('1405-4-1') === '1405/04/01');
T('نرمال‌سازی ارقام فارسی ۱۴۰۵/۰۴/۰۱ → 1405/04/01', ptfPettyNormDate('۱۴۰۵/۰۴/۰۱') === '1405/04/01');
T('نرمال‌سازی ارقام عربی ١٤٠٥/٠٤/٠١ → 1405/04/01', ptfPettyNormDate('١٤٠٥/٠٤/٠١') === '1405/04/01');
T('onOk با تاریخ فارسی خطا نمی‌دهد (نرمال می‌شود)', (function () {
  var res = null; var oldR = global.ptfPettyPeriodReport; global.ptfPettyPeriodReport = function (a, b) { res = [a, b]; };
  global._alerts.length = 0;
  var dlg3 = null; var oldD = global.ptfDialog; global.ptfDialog = function (o) { dlg3 = o; };
  ptfPettyPeriodReportDialog();
  global.ptfDialog = oldD;
  dlg3.onOk({ from: '۱۴۰۵/۰۴/۱۵', to: '1405/04/20' });
  global.ptfPettyPeriodReport = oldR;
  return global._alerts.length === 0 && res && res[0] === '1405/04/15';
})());
T('دیالوگ بازه فیلدهای datePicker دارد', (function () {
  global._dlg = null;
  var oldDlg = global.ptfDialog; global.ptfDialog = function (o) { global._dlg = o; };
  ptfPettyPeriodReportDialog();
  global.ptfDialog = oldDlg;
  return global._dlg && global._dlg.fields.some(function (x) { return x.id === 'from' && x.datePicker; }) && global._dlg.fields.some(function (x) { return x.id === 'to' && x.datePicker; });
})());
T('ارجاع دوره فیلد آپلود فایل گردش حساب دارد (و نه فیلد شارژ)', (function () {
  global._dlg2 = null;
  var oldDlg2 = global.ptfDialog; global.ptfDialog = function (o) { global._dlg2 = o; };
  pettyClosePeriod();
  global.ptfDialog = oldDlg2;
  return global._dlg2 && global._dlg2.fields.some(function (x) { return x.id === 'bankFile' && (x.upload || x.type === 'upload'); }) && !global._dlg2.fields.some(function (x) { return x.id === 'chargeAmt'; });
})());
T('ارجاع بدون فایل گردش حساب → هشدار و بدون رکورد', (function () {
  var before = getData('ptf_crm_petty_periods').length;
  global._alerts.length = 0;
  var oldDlg3 = global.ptfDialog; global.ptfDialog = function (o) { global._dlg3 = o; };
  pettyClosePeriod();
  global.ptfDialog = oldDlg3;
  global._dlg3.onOk({ from: '1405/04/11', to: '1405/04/20', note: '', sms: 'no' }); /* بدون bankFile */
  return global._alerts.length === 1 && global._alerts[0].indexOf('گردش حساب بانک') > -1 && getData('ptf_crm_petty_periods').length === before;
})());
T('ارجاع با فایل گردش حساب → رکورد با files ساخته می‌شود', (function () {
  global._alerts.length = 0;
  var oldDlg4 = global.ptfDialog; global.ptfDialog = function (o) { global._dlg4 = o; };
  pettyClosePeriod();
  global.ptfDialog = oldDlg4;
  global._dlg4.onOk({ from: '1405/04/11', to: '1405/04/20', bankFile: [{ key: 'petty-period/PPR/bank.pdf', name: 'bank.pdf' }], note: '', sms: 'no' });
  var ps = getData('ptf_crm_petty_periods');
  var okR = ps.length >= 1 && ps[0].files && ps[0].files.length === 1 && ps[0].files[0].name === 'bank.pdf' && ps[0].from === '1405/04/11';
  /* ریست داده تا تست‌های بعدی (PDF تلفیقی) با رکورد جدید تداخل نکنند */
  setData('ptf_crm_petty_periods', [{ cd: 'PPR-OLD', from: '1405/04/01', to: '1405/04/10', month: '1405/04', st: 'referred', files: [{ key: 'k-bank', name: 'bank.jpg' }], totalOut: 100000, charges: 1000000, balance: 900000 }]);
  return okR;
})());

SECTION('باگ split: آرگومان رشته‌ای from|to (از renderPeriods)');
var dSplit = ptfPettyPeriodData('1405/04/11|1405/04/20');
T('رشتهٔ از-تا (با |) به‌درستی split و فیلتر می‌شود', dSplit.isRange === true && dSplit.from === '1405/04/11' && dSplit.to === '1405/04/20' && dSplit.petty.length === 2);
T('گزارش با رشتهٔ from|to ردیف‌ها را نشان می‌دهد', (function () {
  global._inserted.length = 0;
  ptfPettyPeriodReport('1405/04/11|1405/04/20');
  var h = global._inserted[global._inserted.length - 1] || '';
  return h.indexOf('تاکسی') > -1 && h.indexOf('کاغذ') > -1 && h.indexOf('ناهار') > -1;
})());

SECTION('هدر بازه');
T('برچسب: «تنخواه‌گردان از تاریخ … تا تاریخ …»', ptfPettyRangeLabel('1405/04/11', '1405/04/20') === 'تنخواه‌گردان از تاریخ 1405/04/11 تا تاریخ 1405/04/20');
T('سازگاری با ماه قدیمی: «ماه 1405/04»', ptfPettyRangeLabel('1405/04') === 'ماه 1405/04');

SECTION('گزارش/PDF شامل هدر بازه + ستون نحوهٔ پرداخت');
ptfPettyPeriodReport('1405/04/11', '1405/04/20');
var h = global._inserted[global._inserted.length - 1] || '';
T('مودال گزارش: هدر بازه + ستون «نحوهٔ پرداخت/وضعیت»', h.indexOf('تنخواه‌گردان از تاریخ 1405/04/11 تا تاریخ 1405/04/20') > -1 && h.indexOf('نحوهٔ پرداخت/وضعیت') > -1);
ptfPettyPeriodCombinedPdf('1405/04/11', '1405/04/20');
var out = global._prints.join('');
T('PDF تلفیقی: هدر بازه + رسیدهای بازه (سند 1/2/3)', out.indexOf('از تاریخ 1405/04/11 تا تاریخ 1405/04/20') > -1 && out.indexOf('سند 1') > -1 && out.indexOf('سند 2') > -1 && out.indexOf('سند 3') > -1 && out.indexOf('PTY-1') === -1);
T('PDF تلفیقی دورهٔ جاری: پیوست بانک ندارد (هنوز ارجاع نشده)', out.indexOf('صورتحساب بانک') === -1);

SECTION('دورهٔ ذخیره‌شده: گزارش از همان لحظهٔ ارجاع (pettyIds/txIds)');
setData('ptf_crm_petty_periods', [
  { cd: 'PPR-OLD', from: '1405/04/01', to: '1405/04/10', month: '1405/04', st: 'referred', files: [], pettyIds: ['PTY-2'], txIds: [], totalOut: 100000, charges: 1000000, balance: 900000 }
]);
var filesOfOld = ptfPettyPeriodFiles('1405/04', '', ['PTY-2']);
T('files با ids دوره فقط رسید همان دوره را برمی‌گرداند (PTY-2)', filesOfOld.length === 1 && filesOfOld[0].name === 'رسید تاکسی.jpg');

DONE('tester212-v3304-petty-period-range');
