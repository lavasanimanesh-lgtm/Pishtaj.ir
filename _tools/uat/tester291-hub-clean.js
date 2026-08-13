/* tester291 — v33.11.0 (HUB-CLEAN):
 * 1) جدول/کارت‌های سود تعهدی قدیمی (اعداد ناسازگار) از داشبورد سال مالی حذف شد — فقط بلوک نقدی
 * 2) باکس «تعهدات نقدینگی تأمین و چک‌های شرکت» (slLiquidity) فقط در تب حساب تأمین‌کنندگان
 * 3) ترتیب باکس‌های هاب مالی: نوار هاب اول (رفع «هاب وسط صفحه») — finHubOrder
 */
'use strict';
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var fiscal = fs.readFileSync(path.join(BASE, 'fiscal.js'), 'utf-8');
var hub = fs.readFileSync(path.join(BASE, 'financehub.js'), 'utf-8');

SECTION('حذف جدول تعهدی قدیمی از داشبورد سال مالی');
T('KPIهای تعهدی داشبورد (سود/زیان پروژه، سود خالص مدیریتی، اندوخته) حذف شدند', (function () {
  return fiscal.indexOf('سود/زیان پروژه‌های قابل اتکا') === -1 &&
    fiscal.indexOf('سود خالص مدیریتی پس از هزینه‌ها') === -1 &&
    fiscal.indexOf('اندوخته صندوق') === -1 &&
    fiscal.indexOf('مطالبات باز کل شرکت') === -1;
})());
T('جدول «کاربرگ تقسیم سود» تعهدی از داشبورد حذف شد (فقط نسخهٔ نقدی در گزارش)', (function () {
  return fiscal.indexOf("(shRows || '<tr><td colspan=\"5\">") === -1;
})());
T('گزارش رسمی نقدی (ptfFiscalCashReportHtml) موجود است', fiscal.indexOf('ptfFiscalCashReportHtml = function') > -1 && fiscal.indexOf('گزارش رسمی سال مالی') > -1 && fiscal.indexOf('منطق نقدی') > -1);
T('CSV نقدی: درآمد/خروجی/کف/مازاد/بازگشت به کف', fiscal.indexOf('درآمد نقدی (وصولی‌های سال') > -1 && fiscal.indexOf('بازگشت به کف') > -1);
T('بلوک نقدی «سود نقدی و تقسیم» همچنان هست', fiscal.indexOf('سود نقدی و تقسیم (منطق نقدی') > -1 && fiscal.indexOf('بازگشت به کف') > -1 && fiscal.indexOf('کف نقدینگی در گردش') > -1);
T('دکمه‌های قفل/گزارش/CSV/سند اصلاحی حفظ شدند', fiscal.indexOf('ptfFiscalLock()') > -1 && fiscal.indexOf('ptfFiscalPrint()') > -1 && fiscal.indexOf('ptfFiscalCsv()') > -1 && fiscal.indexOf('ptfFiscalAmendOpen()') > -1);
T('هشدار موارد ناقص + سندهای اصلاحی حفظ شدند', fiscal.indexOf('مورد نیازمند تعیین تکلیف حسابرسی') > -1 && fiscal.indexOf('سندهای اصلاحی موثر بر سال') > -1);

SECTION('هاب مالی: slLiquidity فقط در تب تامین‌کنندگان + ترتیب باکس‌ها');
T('slLiquidity در نمایش/مخفی هاب اضافه شد (فقط supacc)', hub.indexOf("show('slLiquidity', t === 'supacc')") > -1);
T('finHubOrder موجود است و نوار هاب را اول می‌گذارد', hub.indexOf('window.finHubOrder = function') > -1 && hub.indexOf("panels.insertBefore(barEl, panels.firstChild)") > -1);
T('finHubOrder شامل opexBox/slLiquidity/همه باکس‌هاست', (function () {
  return hub.indexOf("'opexBox', 'slLiquidity'") > -1 &&
    hub.indexOf("'shareBox', 'fiscalBox'") > -1 &&
    hub.indexOf("'ledgerReportBox', 'treasuryBox', 'qualityBox', 'chequeBox'") > -1; /* 2026-08-13: treasuryBox اضافه شد */
})());
T('renderPetty بعد از رندر، finHubOrder را صدا می‌زند', hub.indexOf('finHubApply(); window.finHubOrder();') > -1);
T('finHubApply در پایان finHubOrder را صدا می‌زند', hub.indexOf('window.finHubOrder();') > -1 && hub.indexOf('if (old) old.outerHTML = bar();') > -1);

DONE('tester291-hub-clean');
