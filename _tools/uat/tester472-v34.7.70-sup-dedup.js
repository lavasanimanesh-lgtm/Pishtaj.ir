#!/usr/bin/env node
'use strict';
/* v34.7.83 — جلوگیری سروری از ثبت تکراری تامین‌کننده.
   قرارداد: add_supplier در api/crm.php نام شرکت و شماره تماس (نرمال‌شده) را در برابر
   هر دو فهرست (suppliers = pending سایت) و (ptf_crm_suppliers = تاییدشده) بررسی می‌کند؛
   در صورت تکرار ok:false + error:'duplicate' برمی‌گرداند و رکورد نمی‌سازد. */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

var ver = JSON.parse(read('VERSION.json'));
var crm = read('api/crm.php');
var gate = read('_tools/uat/run-ci-gate.js');

T('VERSION.json = v34.7.83', ver.crm_version === 'v34.7.83', ver.crm_version);

/* توابع نرمال‌سازی سروری */
T('ptf_dedup_norm تعریف شده', crm.indexOf('function ptf_dedup_norm(') > -1);
T('ptf_dedup_phone تعریف شده', crm.indexOf('function ptf_dedup_phone(') > -1);
T('نرمال‌سازی 98/0098 → 0', crm.indexOf("$d = '0' . substr($d, 2)") > -1 && crm.indexOf("$d = '0' . substr($d, 4)") > -1);

/* چک تکراری در add_supplier */
T('add_supplier چک تکراری دارد', crm.indexOf('SUP-DEDUP-001') > -1);
T('در برابر suppliers (pending) و ptf_crm_suppliers (تاییدشده)', crm.indexOf("load_data('suppliers')") > -1 && crm.indexOf("load_data('ptf_crm_suppliers')") > -1);
T('بررسی نام شرکت', crm.indexOf('ptf_dedup_norm($supCompanyRaw)') > -1);
T('بررسی شماره تماس (نرمال‌شده)', crm.indexOf('$supPhoneNorm = ptf_dedup_phone(') > -1);
T('در صورت تکرار ok:false + duplicate', crm.indexOf("'error' => 'duplicate'") > -1);
T('رکورد تکراری بلاک می‌شود و مسیر باز شدن (reopened) هم هست', crm.indexOf("'error' => 'duplicate'") > -1 && crm.indexOf("'reopened' => true") > -1);

T('tester472 در گیت CI', gate.indexOf('tester472-v34.7.70-sup-dedup.js') > -1);

console.log('\n— tester472 (v34.7.83: جلوگیری از ثبت تکراری تامین‌کننده) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
