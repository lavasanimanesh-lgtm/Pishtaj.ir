/* S3 — UR-2026-08-01-07: سورت‌بندی فهرست‌ها (کامپوننت مشترک + اتصال در ۵ لیست) */
'use strict';
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var S = fs.readFileSync(path.join(BASE, 'sortable.js'), 'utf-8');
var OFFERS = fs.readFileSync(path.join(BASE, 'offers.js'), 'utf-8');
var BRIDGE = fs.readFileSync(path.join(BASE, 'bridge.js'), 'utf-8');
var PETTY = fs.readFileSync(path.join(BASE, 'petty.js'), 'utf-8');
var CF = fs.readFileSync(path.join(BASE, 'customer-finance.js'), 'utf-8');
var SL = fs.readFileSync(path.join(BASE, 'supplier-finance.js'), 'utf-8');
var IDX = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var SW = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');

eval.call(global, S);

SECTION('کامپوننت مشترک (sortable.js)');
T('توابع موجودند', typeof ptfSortVal === 'function' && typeof ptfSortRows === 'function' && typeof ptfSortHeader === 'function' && typeof ptfSorted === 'function' && typeof ptfSortSelectHtml === 'function');
T('سورت عددی (مبلغ) صعودی/نزولی', (function () {
  var rows = [{ m: 300 }, { m: 100 }, { m: 200 }];
  var a = ptfSortRows(rows, 'm', 'asc', { m: function (r) { return r.m; } });
  var d = ptfSortRows(rows, 'm', 'desc', { m: function (r) { return r.m; } });
  return a[0].m === 100 && a[2].m === 300 && d[0].m === 300 && d[2].m === 100;
})());
T('سورت تاریخ شمسی (رشتهٔ 1405/..) ترتیب درست می‌دهد', (function () {
  var rows = [{ t: '1405/03/15' }, { t: '1405/01/02' }, { t: '1404/12/29' }];
  var a = ptfSortRows(rows, 't', 'asc', { t: function (r) { return r.t; } });
  return a[0].t === '1404/12/29' && a[2].t === '1405/03/15';
})());
T('سورت نام فارسی (fa) و بدون تغییر آرایهٔ اصلی', (function () {
  var rows = [{ n: 'ب' }, { n: 'الف' }, { n: 'ج' }];
  var a = ptfSortRows(rows, 'n', 'asc', { n: function (r) { return r.n; } });
  return a[0].n === 'الف' && rows[0].n === 'ب';
})());
T('مقادیر خالی در انتها (صعودی) می‌روند', (function () {
  var rows = [{ n: 'ب' }, { n: '' }, { n: 'الف' }];
  var a = ptfSortRows(rows, 'n', 'asc', { n: function (r) { return r.n; } });
  return a[2].n === '';
})());

SECTION('هدر قابل کلیک + state');
var h = ptfSortHeader('listX', 'k1', 'عنوان');
T('هدر onclick و فلش دارد', h.indexOf("ptfSortClick('listX','k1')") > -1 && h.indexOf('cursor:pointer') > -1);

SECTION('اتصال — پیشنهادات (offers.js)');
T('هدرها sortable شدند (شماره/خریدار/تاریخ/مبلغ/وضعیت)', OFFERS.indexOf("ptfSortHeader('off', 'no'") > -1 && OFFERS.indexOf("ptfSortHeader('off', 'buyerCo'") > -1 && OFFERS.indexOf("ptfSortHeader('off', 'amount'") > -1 && OFFERS.indexOf("ptfSortHeader('off', 'st'") > -1);
T('renderOffers سورت را اعمال می‌کند', OFFERS.indexOf("ptfRegisterSortable('off'") > -1 && OFFERS.indexOf("typeof window.ptfSorted === 'function'") > -1);

SECTION('اتصال — درخواست‌ها (bridge.js)');
T('هدرهای RFQ sortable شدند + renderRfq سورت را اعمال می‌کند', BRIDGE.indexOf("ptfSortHeader('rfq', 'cd'") > -1 && BRIDGE.indexOf("ptfSortHeader('rfq', 'co'") > -1 && BRIDGE.indexOf("typeof window.ptfSorted === 'function'") > -1);

SECTION('اتصال — تنخواه (petty.js)');
T('dropdown سورت در تولبار تنخواه + اعمال در renderPetty', PETTY.indexOf("ptfSortSelectHtml('petty'") > -1 && PETTY.indexOf("typeof window.ptfSorted === 'function'") > -1);

SECTION('اتصال — حساب مشتریان (customer-finance.js)');
T('هدرهای cf sortable + سورت اعمال می‌شود', CF.indexOf("ptfSortHeader('cf', 'co'") > -1 && CF.indexOf("ptfSortHeader('cf', 'balance'") > -1 && CF.indexOf("typeof window.ptfSorted === 'function'") > -1);

SECTION('اتصال — حساب تأمین‌کنندگان (supplier-finance.js)');
T('هدرهای slf sortable + سورت اعمال می‌شود', SL.indexOf("ptfSortHeader('slf', 'co'") > -1 && SL.indexOf("ptfSortHeader('slf', 'exposure'") > -1 && SL.indexOf("typeof window.ptfSorted === 'function'") > -1);
T('slFinanceSearch دیگر با outerHTML بازسازی نمی‌کند (رفع باگ فوکوس هم‌خانواده)', SL.indexOf('slFinanceHubBox")') === -1 || SL.indexOf("el.outerHTML = window.slFinanceHubHtml()") === -1);

SECTION('بارگذاری');
T('sortable.js در index.html و sw.js هست', IDX.indexOf('sortable.js?v=') > -1 && SW.indexOf('./sortable.js') > -1);

DONE('tester207-v3300-sorting');

SECTION('محافظ fallback (بدون sortable.js — سناریوی خطای کاربر)');
T('همهٔ فراخوانی‌های ptfSorted محافظ typeof دارند', OFFERS.indexOf("offers = (typeof window.ptfSorted === 'function')") > -1 && BRIDGE.indexOf("rfqs = (typeof window.ptfSorted === 'function')") > -1 && PETTY.indexOf("list = (typeof window.ptfSorted === 'function')") > -1 && CF.indexOf("rows = (typeof window.ptfSorted === 'function')") > -1 && SL.indexOf("rows = (typeof window.ptfSorted === 'function')") > -1);
