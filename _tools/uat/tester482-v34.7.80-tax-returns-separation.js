#!/usr/bin/env node
'use strict';
/* v34.8.40 — جداسازی اظهارنامه‌ها از بخش فاکتورها + پنل مستقل «📁 اظهارنامه‌ها».
   درخواست: بخش فاکتورها گاهی بهم می‌ریخت و «بارگذاری اظهارنامه» داخل آن نمایش داده می‌شد.
   رفع: ① حذف اظهارنامه از مسیر فاکتورها (rbac.js) ② پنل مستقل در گروه «کالا و اسناد»
   با تفکیک عملکرد سالانه (هر سال) و ارزش افزوده فصلی (هر فصل و سال انتخابی). */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

var ver = JSON.parse(read('VERSION.json'));
var idx = read('crm/index.html');
var rbac = read('crm/rbac.js');
var unof = read('crm/unofficial-invoice.js');
var tax = read('crm/tax-returns.js');
var shell = read('crm/shell.js');
var perms = read('crm/perms.js');
var gate = read('_tools/uat/run-ci-gate.js');

T('VERSION.json = v34.8.40', ver.crm_version === 'v34.8.40', ver.crm_version);
T('tax-returns.js cache-bust 34.8.40', /tax-returns\.js\?v=34\.8.40/.test(idx));

/* ① حذف اظهارنامه از فاکتورها */
T('taxHtml از buildInvoices حذف شد', rbac.indexOf('ptfTaxReturnsHtml') === -1 && rbac.indexOf('var taxHtml') === -1);
T('ptfTaxReturnsRender از renderInvoices حذف شد', rbac.indexOf('window.ptfTaxReturnsRender') === -1);
T('بلوک اظهارنامه از unofficial-invoice حذف شد', unof.indexOf('window.ptfTaxReturnsHtml') === -1 && unof.indexOf('window.ptfTaxReturnsRender') === -1);
T('ptfTaxPlannerHtml حفظ شد', unof.indexOf('window.ptfTaxPlannerHtml') > -1);

/* ② پنل مستقل در گروه کالا و اسناد */
T('دکمهٔ سایدبار taxret وجود دارد', idx.indexOf("goPanel('taxret',this)") > -1);
T('taxret در گروه g-goods (shell.js)', /g-goods[^\]]*items:\s*\[[^\]]*taxret/.test(shell));
T('taxret در ALL_PANELS (perms.js)', perms.indexOf("{ id: 'taxret', lb: 'اظهارنامه‌ها' }") > -1);
T('taxret در reg (perms.js)', perms.indexOf("reg('taxret', '📁 اظهارنامه‌ها'") > -1);
T('دسترسی حسابدار به taxret', rbac.indexOf("'inv','recv','petty','chqprint','cart','ai','taxret'") > -1);

/* ③ منطق پنل */
T('buildTaxReturns تعریف شد', /window\.buildTaxReturns = function \(\)/.test(tax));
T('renderTaxReturns تعریف شد', /window\.renderTaxReturns = function \(\)/.test(tax));
T('kindOf با سازگاری قدیمی', /function kindOf\(r\)/.test(tax) && tax.indexOf("if (/عملکرد/.test(t)) return 'performance';") > -1);
T('تب عملکرد سالانه', tax.indexOf('ptfTaxReturnsTab(') > -1 && tax.indexOf('💼 عملکرد سالانه') > -1);
T('تب ارزش افزوده فصلی', tax.indexOf('ptfTaxReturnsTab(') > -1 && tax.indexOf('🧾 ارزش افزوده فصلی') > -1);
T('فصول چهارگانه', ['بهار','تابستان','پاییز','زمستان'].every(function(s){ return tax.indexOf("'" + s + "'") > -1; }));
T('انتخاب سال برای ارزش افزوده', /window\.ptfTaxReturnsYear = function \(y\)/.test(tax));
T('ثبت عملکرد با year (بدون فصل)', tax.indexOf("season: k === 'vat' ? (v.season || 'بهار') : ''") > -1);
T('kind روی رکورد ذخیره می‌شود', tax.indexOf('kind: k,') > -1);
T('حذف بر اساس cd (نه ایندکس)', /window\.ptfTaxReturnsDel = function \(cd\)/.test(tax));
T('گارد نقش در build (allowed)', tax.indexOf("return '<div style=\"text-align:center;color:#94a3b8;padding:40px\">⛔ این بخش فقط برای مدیران ارشد و حسابدار است.") > -1);
T('هوک goPanel برای taxret', tax.indexOf("if (id === 'taxret')") > -1);

T('tester482 در گیت CI', gate.indexOf('tester482-v34.7.80-tax-returns-separation.js') > -1);

console.log('\n— tester482 (v34.8.40: جداسازی اظهارنامه‌ها از فاکتورها + پنل مستقل) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
