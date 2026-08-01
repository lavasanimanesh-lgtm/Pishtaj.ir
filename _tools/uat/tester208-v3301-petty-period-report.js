/* S3 — UR-2026-08-01-09: گزارش کامل دورهٔ تنخواه (ردیف/تاریخ/مبلغ/توسط/شرح + جمع‌های زنده) */
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
global._downloads = []; global._prints = [];
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
global.URL = { createObjectURL: function (b) { global._downloads.push(b); return 'blob:test'; } };
global.Blob = function (parts, opts) { this.parts = parts; this.opts = opts; };
global.window.open = function () { return { document: { write: function (h) { global._prints.push(h); }, close: function () {} }, print: function () {} }; };
global._domGet['panels'] = makeEl({ insertAdjacentHTML: function (_, h) { global._inserted.push(h); } });

eval.call(global, code);

/* ---------- دادهٔ دورهٔ 1405/04 ---------- */
setData('ptf_crm_petty', [
  { cd: 'PTY-1', amt: 200000, cat: 'ایاب و ذهاب', desc: 'تاکسی', by: 'علی رضایی', t: '1405/04/05 09:00', month: '1405/04', st: 'settled' },
  { cd: 'PTY-2', amt: 50000, cat: 'ملزومات اداری', desc: 'کاغذ', by: 'مریم احمدی', t: '1405/04/10 11:00', month: '1405/04', st: 'open' },
  { cd: 'PTY-3', amt: 100000, cat: 'قبلی', desc: 'ابطال‌شده', by: 'علی رضایی', t: '1405/04/01 08:00', month: '1405/04', st: 'void' }
]);
setData('ptf_crm_petty_tx', [
  { cd: 'TX-1', type: 'charge', amt: 1000000, by: 'علی رضایی', t: '1405/04/01 09:00', month: '1405/04', note: 'شارژ اولیه' },
  { cd: 'TX-2', type: 'settle', amt: 200000, by: 'علی رضایی', t: '1405/04/06 10:00', month: '1405/04', note: 'تسویه PTY-1' },
  { cd: 'TX-3', type: 'direct', amt: 70000, by: 'علی رضایی', t: '1405/04/12 12:00', month: '1405/04', note: 'پرداخت مستقیم ناهار' }
]);
setData('ptf_crm_petty_periods', []);

SECTION('ساختار');
T('توابع گزارش دوره موجودند', code.indexOf('window.ptfPettyPeriodReport') > -1 && code.indexOf('window.ptfPettyPeriodEvents') > -1 && code.indexOf('window.ptfPettyPeriodTotals') > -1 && code.indexOf('window.ptfPettyPeriodCsv') > -1 && code.indexOf('window.ptfPettyPeriodPrint') > -1);
T('دکمه‌های گزارش در renderPeriods (بازه/ماه) و تولبار هست', code.indexOf('ptfPettyPeriodReport') > -1 && code.indexOf('ptfPettyPeriodCombinedPdf') > -1 && code.indexOf('📊 گزارش دورهٔ دلخواه') > -1 && code.indexOf('ptfPettyPeriodReportDialog') > -1 && code.indexOf('var rng = (p.from && p.to)') > -1);

SECTION('رویدادهای دوره (Events)');
var ev = ptfPettyPeriodEvents('1405/04');
T('۶ رویداد: شارژ + تسویه + پرداخت مستقیم + ۲ هزینهٔ فعال + ۱ ابطال', ev.length === 6);
T('ردیف‌ها ۱ تا ۶ به ترتیب زمانی', ev[0].t === '1405/04/01 08:00' && ev[0].row === 1 && ev[5].t === '1405/04/12 12:00' && ev[5].row === 6);
T('شرح و نوع هر رویداد درست است', ev.some(function (e) { return e.kind === 'شارژ حساب' && e.amt === 1000000; }) && ev.some(function (e) { return e.kind === 'هزینه (ابطال‌شده)' && e.amt === 100000; }) && ev.some(function (e) { return e.kind === 'پرداخت مستقیم' && e.amt === 70000; }) && ev.some(function (e) { return e.desc.indexOf('کاغذ') > -1; }));

SECTION('جمع‌های زنده (Totals)');
var tt = ptfPettyPeriodTotals('1405/04');
T('هزینه‌های دوره = هزینه‌های فعال + پرداخت مستقیم (۲۰۰+۵۰+۷۰ هزار؛ ابطال‌شده حذف)', tt.pettyOut === 250000 && tt.directOut === 70000 && tt.totalOut === 320000);
T('شارژ دوره = ۱,۰۰۰,۰۰۰', tt.charges === 1000000);

SECTION('مودال گزارش');
ptfPettyPeriodReport('1405/04');
T('ردیف‌های جمع در پایان جدول (مجموع هزینه/شارژ/موجودی شروع/پایان)', (function () {
  var h = global._inserted[global._inserted.length - 1] || '';
  return h.indexOf('مجموع هزینه‌های دوره') > -1 && h.indexOf('مجموع شارژ دوره') > -1 && h.indexOf('موجودی شروع دوره') > -1 && h.indexOf('موجودی پایان دوره') > -1;
})());
T('Totals شامل balanceStart/balanceEnd است', (function () {
  var t = ptfPettyPeriodTotals('1405/04');
  return typeof t.balanceStart === 'number' && typeof t.balanceEnd === 'number';
})());
T('مودال با جدول (ردیف/تاریخ/نوع/شرح/توسط/مبلغ) و جمع‌ها ساخته شد', (function () {
  var h = global._inserted[global._inserted.length - 1] || '';
  return h.indexOf('گزارش دورهٔ تنخواه') > -1 && h.indexOf('<th>ردیف</th>') > -1 && h.indexOf('<th>توسط</th>') > -1 && h.indexOf('هزینه‌های دوره') > -1 && h.indexOf('شارژ دوره') > -1 && h.indexOf('موجودی دوره') > -1;
})());

SECTION('خروجی اکسل (CSV)');
ptfPettyPeriodCsv('1405/04');
T('CSV با BOM + سرستون‌ها + ردیف‌های جمع', (function () {
  if (!global._downloads.length) return false;
  var txt = global._downloads[0].parts[0];
  return txt.indexOf('\uFEFF') === 0 && txt.indexOf('ردیف') > -1 && txt.indexOf('توسط') > -1 && txt.indexOf('هزینه‌های دوره') > -1 && txt.indexOf('شارژ دوره') > -1 && txt.indexOf('320000') > -1;
})());

SECTION('خروجی چاپ/PDF');
ptfPettyPeriodPrint('1405/04');
T('سند چاپی با عنوان و جمع‌ها', global._prints.length >= 1 && (global._prints.join('')).indexOf('گزارش دورهٔ تنخواه') > -1 && (global._prints.join('')).indexOf('<table>') > -1 && (global._prints.join('')).indexOf('هزینه‌های دوره') > -1 && (global._prints.join('')).indexOf('۳۲۰') > -1);

DONE('tester208-v3301-petty-period-report');
