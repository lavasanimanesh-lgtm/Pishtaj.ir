#!/usr/bin/env node
'use strict';
/* v34.7.33 — H1 گیت workflow + AN-04 کالیبراسیون سلامت + ARCH-02 ثبت دریافت از حساب پرونده */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0, s = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function S(n) { s++; console.log('SKIP', n); }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

(function h1() {
  var php = read('.github/workflows/php.yml');
  var st = read('.github/workflows/deploy-staging.yml');
  var pr = read('.github/workflows/deploy-production.yml');
  var workflowUpgradeStarted = [php, st, pr].some(function (x) { return x.indexOf('run-ci-gate.js') > -1; });
  if (!workflowUpgradeStarted) {
    /* GitHub rejects protected workflow writes from the Arena App unless it is
       granted Workflows: write. Legacy arena/** staging deploy stays active;
       once any protected workflow is upgraded, the complete contract below
       becomes blocking so a partial/manual application cannot pass. */
    S('H1 workflow publication pending GitHub Workflows write permission');
    return;
  }
  T('H1 php.yml دیگر composer validate نیست', php.indexOf('composer validate --strict') < 0 && php.indexOf('find api crm -name') > -1);
  T('H1 php.yml گیت UAT را اجرا می‌کند', php.indexOf('run-ci-gate.js') > -1);
  T('H1 استیجینگ قبل از FTP گیت دارد', st.indexOf('run-ci-gate.js') > -1 && st.indexOf('Setup Node') > -1);
  T('H1 پروداکشن قبل از FTP گیت دارد', pr.indexOf('run-ci-gate.js') > -1);
  T('H1 migrate.php از پروداکشن exclude شده', pr.indexOf('api/migrate.php') > -1);
})();

(function an04() {
  var src = read('crm/management-intelligence.js');
  T('AN-04 پایه ۴۵ است', /var hs=45;/.test(src));
  T('AN-04 آستانه مناسب ۷۲ است', src.indexOf('c.healthScore>=72') > -1);
  T('AN-04 مدل calibrated در خروجی است', src.indexOf('calibrated:true') > -1 && src.indexOf("version:'v34.7.33'") > -1);
})();

(function arch02() {
  var rb = read('crm/rbac.js');
  var showStart = rb.indexOf('function showPayModal('), saveStart = rb.indexOf('function savePay(', showStart);
  var showBlock = rb.slice(showStart, saveStart), saveBlock = rb.slice(saveStart, rb.indexOf('window.ptfCanInvoicePayVoid =', saveStart));
  T('ARCH-02 دریافت v2 به حساب پرونده هدایت می‌شود',
    showBlock.indexOf('window.ptfCaseFinanceOpen(receiptCaseId)') > -1);
  T('ARCH-02 ثبت مستقیم روی فاکتور در v2 fail-closed است',
    saveBlock.indexOf('ثبت مستقیم دریافت روی فاکتور غیرفعال است') > -1 && saveBlock.indexOf('return;') > -1);
  T('ARCH-02 rbac هیچ post_receipt مستقیم یا fallback پنهانی ندارد',
    rb.indexOf("ptfSalesDomainCommand('post_receipt'") === -1 && saveBlock.indexOf('hits.length === 1') === -1);
})();

console.log('\n— tester436 (H1 / AN-04 / ARCH-02) —');
console.log('PASS: ' + p + ' | FAIL: ' + f + ' | SKIP: ' + s);
process.exit(f ? 1 : 0);
