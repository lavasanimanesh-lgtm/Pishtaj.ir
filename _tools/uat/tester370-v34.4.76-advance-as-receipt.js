#!/usr/bin/env node
var fs = require('fs');
var path = require('path');
var root = path.join(__dirname, '../..');
function read(p) { return fs.readFileSync(path.join(root, p), 'utf8'); }
function fail(m) { console.log('FAIL ' + m); process.exit(1); }
var ver = JSON.parse(read('VERSION.json'));
var vm4 = String(ver.crm_version).match(/^v(\d+)\.(\d+)\.(\d+)$/);
if (!vm4 || +vm4[1] < 34 || (+vm4[1] === 34 && +vm4[2] < 4) || (+vm4[1] === 34 && +vm4[2] === 4 && +vm4[3] < 76)) fail('VERSION ' + ver.crm_version);
var sf = read('crm/salesfiles.js');
var bc = read('crm/buycompare.js');
/* v34.7: عنوان/دکمه میراثی پیش‌دریافت دیگر سطح عملیاتی نیست؛ Receipt پرونده منبع واحد است. */
if (sf.indexOf('دریافت قطعی مشتری') < 0 || sf.indexOf('پیش‌دریافت مشتری (وصولی)') > -1) fail('salesfile receipt label');
if (sf.indexOf('دریافت قطعی') < 0 || sf.indexOf("ptf_crm_case_receipts") < 0) fail('v35 received as case receipt');
if (/rbAction\('advance'[\s\S]{0,240}ptfAdvanceOpen/.test(bc)) fail('buycompare legacy advance action');
if (bc.indexOf("ptf_crm_case_receipts") < 0 || bc.indexOf('دریافت قطعی') < 0) fail('buycompare uses case receipts');
if (read('crm/treasury.js').indexOf("get('ptf_crm_case_receipts')") < 0) fail('treasury uses case receipts');
console.log('PASS tester370 advance-as-case-receipt');
