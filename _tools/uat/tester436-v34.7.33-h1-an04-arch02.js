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
  /* v34.8.35: پچ معلق T0-3/T0-4/T0-6 (Arena App مجوز نوشتن workflow ندارد؛ تا اعمال
     دستیِ مالک، پچ PENDING معتبر است — همان قرارداد APPLY-WORKFLOW-PATCHES-GUIDE-FA). */
  var pending = '';
  try { pending = read('_tools/PENDING-workflow-t0346-ci-gates-2026-08-28.patch'); } catch (eNoPatch) { pending = ''; }
  var workflowUpgradeStarted = [php, st, pr].some(function (x) { return x.indexOf('run-ci-gate.js') > -1; }) || pending.indexOf('run-ci-gate.js') > -1;
  if (!workflowUpgradeStarted) {
    /* GitHub rejects protected workflow writes from the Arena App unless it is
       granted Workflows: write. Legacy arena/** staging deploy stays active;
       once any protected workflow is upgraded, the complete contract below
       becomes blocking so a partial/manual application cannot pass. */
    S('H1 workflow publication pending GitHub Workflows write permission');
    return;
  }
  /* متن فایل نهایی داخل پچ = خطوط '+' (خطوطِ حذف‌شده '-' را نباید سنجید) */
  var patchBlock = function (wfName) {
    var marker = 'diff --git a/.github/workflows/' + wfName;
    var i = pending.indexOf(marker);
    if (i < 0) return '';
    var rest = pending.slice(i);
    var next = rest.indexOf('diff --git', marker.length);
    var block = next < 0 ? rest : rest.slice(0, next);
    return block.split('\n').filter(function (l) {
      return l.indexOf('---') !== 0 && l.indexOf('-') !== 0;
    }).map(function (l) { return l.indexOf('+') === 0 ? l.slice(1) : l; }).join('\n');
  };
  var gateAppliedOrPending = function (wfText, wfNameInPatch) {
    return wfText.indexOf('run-ci-gate.js') > -1 || patchBlock(wfNameInPatch).indexOf('run-ci-gate.js') > -1;
  };
  var phpEff = php.indexOf('run-ci-gate.js') > -1 ? php : (patchBlock('php.yml') || php);
  T('H1 php.yml دیگر composer validate نیست (اعمال‌شده یا پچ معلق)',
    phpEff.indexOf('composer validate --strict') < 0 && phpEff.indexOf('find api crm -name') > -1);
  T('H1 php.yml گیت UAT را اجرا می‌کند (اعمال‌شده یا پچ معلق)', gateAppliedOrPending(php, 'php.yml'));
  var stEff = st.indexOf('run-ci-gate.js') > -1 ? st : patchBlock('deploy-staging.yml');
  T('H1 استیجینگ قبل از FTP گیت دارد (اعمال‌شده یا پچ معلق)',
    stEff.indexOf('run-ci-gate.js') > -1 && stEff.indexOf('Setup Node') > -1);
  T('H1 پروداکشن قبل از FTP گیت دارد (اعمال‌شده یا پچ معلق)', gateAppliedOrPending(pr, 'deploy-production.yml'));
  var prEff = pr.indexOf('run-ci-gate.js') > -1 ? pr : patchBlock('deploy-production.yml');
  T('H1 migrate.php از پروداکشن exclude شده (اعمال‌شده یا پچ معلق)',
    prEff.indexOf('api/migrate.php') > -1);
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
