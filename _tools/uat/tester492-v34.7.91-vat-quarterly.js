#!/usr/bin/env node
'use strict';
/* v34.24.0 — ارزش افزوده فصلی در هاب مالی + نرخ مصوب سال (VAT-LEDGER-001).
   - تب «ارزش افزوده» در هاب مالی.
   - محاسبه: بدهی VAT فروش رسمی − اعتبار VAT خرید رسمی (واقعی/پوششی) + اعتبار منتقل‌شده.
   - کارمزد فاکتورساز در VAT محاسبه نمی‌شود.
   - ذخیره نرخ سال در vatRates (همان منبع فاکتورها) با پیش‌فرض ۱۰٪. */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

var ver = JSON.parse(read('VERSION.json'));
var idx = read('crm/index.html');
var shared = read('crm/vat-shared.js');
var q = read('crm/vat-quarterly.js');
var hub = read('crm/financehub.js');
var off = read('crm/official-invoice-v2.js');
var sup = read('crm/supplier-finance.js');
var gate = read('_tools/uat/run-ci-gate.js');

T('VERSION.json = v34.24.0', ver.crm_version === 'v34.24.0', ver.crm_version);
T('vat-shared.js و vat-quarterly.js در index', /vat-shared\.js\?v=34\.24.0/.test(idx) && /vat-quarterly\.js\?v=34\.24.0/.test(idx));

/* ---------- shared ---------- */
T('ptfVatRateOf تعریف شده', /window\.ptfVatRateOf = function/.test(shared));
T('پیش‌فرض shared ده است', /return 10;/.test(shared));
T('ptfVatRateSet تعریف شده', /window\.ptfVatRateSet = function/.test(shared));
T('ذخیره از vatRates', /s\.vatRates = s\.vatRates \|\| \{\}/.test(shared));

/* ---------- quarterly ---------- */
T('ptfVatQuarterlyHtml تعریف شده', /window\.ptfVatQuarterlyHtml = html/.test(q));
T('ptfVatQuarterlyRender تعریف شده', /window\.ptfVatQuarterlyRender = function/.test(q));
T('بدهی فروش رسمی: فقط فعال/رسمی', /if \(inv\.isUnofficial\) return false;/.test(q) && /activeSales/.test(q));
T('اعتبار خرید رسمی واقعی/پوششی', /coverVatAmount/.test(q) && /\+i\.vatAmount \|\| 0/.test(q));
T('کارمزد در VAT محاسبه نمی‌شود', q.indexOf('coverCommission') > -1 && /کارمزد فاکتورساز در اعتبار\/بدهی VAT محاسبه نمی‌شود/.test(q));
T('اعتبار مازاد منتقل می‌شود', /carryToNext/.test(q) && /prevCarry/.test(q));
T('تسویه با مدرک پرداخت', /window\.ptfVatSettle = function/.test(q) && /مدرک پرداخت/.test(q));

/* ---------- hub ---------- */
T('تب «ارزش افزوده» در هاب مالی', /btn\('vat', 'ارزش افزوده'/.test(hub));
T('show vatBox در تب vat', /show\('vatBox', t === 'vat'\)/.test(hub));
T('vatBox در ترتیب باکس‌ها', /'vatBox'/.test(hub) && /ptfVatQuarterlyHtml/.test(hub));

/* ---------- فاکتورها از همان نرخ ---------- */
T('فاکتور فروش رسمی از ptfVatRateOf', off.indexOf('window.ptfVatRateOf') > -1);
T('فاکتور خرید از ptfVatRateOf', sup.indexOf('window.ptfVatRateOf') > -1);
T('دکمه ذخیره پیش‌فرض از مودال فروش حذف شد', off.indexOf('ptfVatDefaultSave()') < 0);

T('tester492 در گیت CI', gate.indexOf('tester492-v34.7.91-vat-quarterly.js') > -1);

console.log('\n— tester492 (v34.24.0: ارزش افزوده فصلی + نرخ مصوب سال — VAT-LEDGER-001) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
