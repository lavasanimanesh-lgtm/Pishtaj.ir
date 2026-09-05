#!/usr/bin/env node
'use strict';
/* v34.37.5 — شرایط پرداخت تامین‌کننده (نقدی/تعهدی + بازهٔ اعتبار + امتیاز).
   درخواست: در فرم ثبت‌نام تامین‌کنندگان، تمایل به همکاری نقدی یا تعهدی درج شود؛
   فیلد کشویی و با انتخاب تعهدی، بازه‌های اعتبار قابل انتخاب شوند؛ و این موضوع امتیاز
   داشته باشد. بازه‌ها بر پایهٔ ارزیابی نرم بازار ایران تعیین شد (ASSESSMENT-SUPPLIER-PAYMENT-TERMS). */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

var ver = JSON.parse(read('VERSION.json'));
var idx = read('crm/index.html');
var sup = read('supplier/index.html');
var api = read('api/crm.php');
var brg = read('crm/bridge.js');
var off = read('crm/offers.js');
var gate = read('_tools/uat/run-ci-gate.js');

T('VERSION.json = v34.37.5', ver.crm_version === 'v34.37.5', ver.crm_version);
T('bridge.js cache-bust 34.37.5', /bridge\.js\?v=34\.37\.5/.test(idx));
T('offers.js cache-bust 34.37.5', /offers\.js\?v=34\.37\.5/.test(idx));

/* ① فرم سایت */
T('کشوی روش همکاری (payTerms)', sup.indexOf('name="payTerms" id="sPayTerms"') > -1);
T('گزینهٔ نقدی', sup.indexOf('value="cash"') > -1);
T('گزینهٔ تعهدی', sup.indexOf('value="credit"') > -1);
T('کشوی بازهٔ اعتبار (creditRange) با disabled اولیه', sup.indexOf('name="creditRange" id="sCreditRange" disabled') > -1);
T('بازه‌های 30/60/90/120/180/365', ['30','60','90','120','180','365'].every(function(v){ return sup.indexOf('value="'+v+'"') > -1; }));
T('جدول امتیاز در کلاینت (PAY_SCORE)', sup.indexOf('PAY_SCORE = { cash: 10, \'30\': 12, \'60\': 15, \'90\': 18, \'120\': 14, \'180\': 8, \'365\': 2 }') > -1);
T('فعال‌سازی بازه فقط با انتخاب تعهدی', sup.indexOf("creditRangeSel.disabled = t !== 'credit';") > -1);
T('نمایش زندهٔ امتیاز', sup.indexOf('امتیاز این گزینه در ارزیابی تامین‌کننده: +') > -1);
T('اعتبارسنجی تعهدی بدون بازه', sup.indexOf("if (payTerms === 'credit' && !creditRange)") > -1);

/* ② سرور */
T('اعتبارسنجی/امتیاز در add_supplier', api.indexOf("$supPayScoreMap = ['30' => 12, '60' => 15, '90' => 18, '120' => 14, '180' => 8, '365' => 2]") > -1);
T('امتیاز نقدی = 10', api.indexOf("$supPayScore = 10;") > -1);
T('allowlist بازهٔ اعتبار', api.indexOf("in_array($supCreditRange, ['30', '60', '90', '120', '180', '365'], true)") > -1);
T('خطای invalid_pay_terms', api.indexOf("'error' => 'invalid_pay_terms'") > -1);
T('ذخیرهٔ payTerms در رکورد جدید', api.indexOf("'payTerms' => $supPayTerms,") > -1);
T('ذخیرهٔ creditRange در رکورد جدید', api.indexOf("'creditRange' => $supCreditRange,") > -1);
T('ذخیرهٔ payScore در رکورد جدید', api.indexOf("'payScore' => $supPayScore,") > -1);
T('ذخیره در شاخهٔ تکمیل مدارک (resubmit)', api.indexOf("'payTerms' => $supPayTerms,") > -1 && /مدارک تکمیل شد/.test(api));

/* ③ CRM */
T('تابع ptfSupPayLabel', /window\.ptfSupPayLabel = function \(s\)\s*\{/.test(brg));
T('تابع ptfSupPayBadge', /window\.ptfSupPayBadge = function \(s\)\s*\{/.test(brg));
T('ستون «شرایط پرداخت» در فهرست سایت', brg.indexOf('<th>شرایط پرداخت</th>') > -1);
T('colspan فهرست به 9 به‌روز شد', brg.indexOf('colspan="9"') > -1);
T('نشان امتیاز در فهرست سایت', brg.indexOf('payBadge = window.ptfSupPayBadge(s)') > -1);
T('نمایش شرایط پرداخت در جزئیات', brg.indexOf('💳 شرایط پرداخت') > -1);
T('انتقال به رکورد تاییدشده (recSup)', brg.indexOf('payTerms: s.payTerms || \'\'') > -1);
T('نشان در فهرست تامین‌کنندگان تاییدشده (offers.js)', off.indexOf('window.ptfSupPayBadge(c)') > -1);

T('tester481 در گیت CI', gate.indexOf('tester481-v34.7.79-supplier-pay-terms.js') > -1);

console.log('\n— tester481 (v34.37.5: شرایط پرداخت تامین‌کننده — نقدی/تعهدی + امتیاز) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
