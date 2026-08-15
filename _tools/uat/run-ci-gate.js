#!/usr/bin/env node
'use strict';
/* گیت CI قبل از FTP: فقط تسترهای sync / مالی / اعلان که امروز سبز و بدون پین نسخهٔ مرده‌اند.
   تسترهای harness گاهی با FAIL هم exit 0 می‌دهند؛ این رانر شمارش FAIL را هم شکست می‌داند. */
var fs = require('fs');
var path = require('path');
var spawnSync = require('child_process').spawnSync;

var ROOT = path.resolve(__dirname, '../..');

var SUITE = [
  { g: 'اعلان', f: '_tools/uat/tester319-v34.4.14-actionable-inbox.js' },
  { g: 'اعلان', f: '_tools/uat/tester395-v34.5.5-action-only-cartable.js' },
  { g: 'اعلان', f: 'tester176-v33.4.1-notifications-standard-rework.js' },
  { g: 'اعلان', f: '_tools/uat/tester185-notif-dup-hygiene.js' },
  { g: 'سینک', f: '_tools/uat/tester390-v34.4.97-sync-fast-pull.js' },
  { g: 'سینک', f: '_tools/uat/tester386-v34.4.93-sync-refresh-false-alerts.js' },
  { g: 'مالی', f: 'tester165-v33.2.3-invoice-delete-fiscal-lock.js' },
  { g: 'مالی', f: 'tester166-v33.2.4-supplier-payment-company-cheque-gate.js' },
  { g: 'مالی', f: 'tester171-v33.2.9-sales-invoice-number-uniqueness.js' },
  { g: 'مالی', f: '_tools/uat/tester151-v271-cheque-void.js' },
  { g: 'مالی', f: '_tools/uat/tester326-v34.4.25-printed-cheque-finance.js' },
  { g: 'مالی', f: '_tools/uat/tester381-v34.4.87-fiscal-call-credit.js' },
  { g: 'مالی', f: '_tools/uat/tester384-v34.4.90-opex-cheque.js' },
  { g: 'مالی', f: '_tools/uat/tester396-v34.5.6-ci-gate-contracts.js' },
  { g: 'مالی', f: '_tools/uat/tester340-v34.4.46-opex-row-identity-collapsed-docs.js' },
  { g: 'مالی', f: '_tools/uat/tester399-v34.5.19-treasury-petty-no-double-count.js' },
  /* tester132-v216 قرارداد منسوخ «پورسانت هنگام برد» را می‌سنجد؛ از v34.5.35
     مبنا تسویه کامل پرونده است و نگه‌داشتن آن در gate، شکست کاذب می‌ساخت. */
  { g: 'مالی/فروش', f: '_tools/uat/tester403-v35-sales-to-cash.js' },
  { g: 'مالی/تأمین', f: '_tools/uat/tester404-v34.6.1-supplier-cash-ledger.js' },
  { g: 'کیفیت محصول', f: '_tools/uat/tester400-v34.5.26-user-guide.js' },
  { g: 'کیفیت محصول', f: '_tools/uat/tester401-v34.5.27-sms-book-grouping.js' },
  { g: 'کیفیت محصول', f: '_tools/uat/tester402-v34.5.28-sms-staff-templates.js' },
  { g: 'امنیت', f: '_tools/uat/tester397-v34.5.7-password-rehash.js' },
  { g: 'امنیت', f: '_tools/uat/tester398-v34.5.7-migrate-prod-lock.js' }
];

var SYNTAX = [
  'crm/bridge.js', 'crm/myday.js', 'crm/rbac.js', 'crm/sync.js',
  'crm/finance-write-guard.js', 'crm/fiscal.js', 'crm/supplier-finance.js',
  'crm/opex.js', 'crm/cheques.js', 'crm/treasury.js',
  'crm/sales-domain-v2.js', 'crm/official-invoice-v2.js'
];

function failCount(out) {
  var m = out.match(/(\d+)\s+PASS\s+\/\s+(\d+)\s+FAIL/);
  if (m) return +m[2];
  m = out.match(/PASS\s+(\d+)\s+FAIL\s+(\d+)/);
  if (m) return +m[2];
  return 0;
}

function looksPassed(out) {
  if (/\bALL PASSED\b/.test(out)) return true;
  if (/\d+\s+PASS\s+\/\s+0\s+FAIL/.test(out)) return true;
  if (/PASS\s+\d+\s+FAIL\s+0/.test(out)) return true;
  if (/^PASS\b/m.test(out) && !/^FAIL\b/m.test(out)) return true;
  return false;
}

function syntaxCheck() {
  var bad = [];
  SYNTAX.forEach(function (rel) {
    var p = path.join(ROOT, rel);
    if (!fs.existsSync(p)) {
      bad.push(rel + ' missing');
      return;
    }
    var r = spawnSync('node', ['--check', p], { encoding: 'utf8' });
    if (r.status !== 0) bad.push(rel + ': ' + String(r.stderr || r.stdout || 'syntax').trim());
  });
  return bad;
}

/* PHP lint (php -l) — v34.5.9: گیت CI قبل از FTP باید PHP را هم بپوشاند
   (بدهی فنی #2 گزارش ارزیابی 2026-08-13: php.yml بدون composer.json بی‌اثر بود).
   اگر php روی محیط نصب نباشد، این بخش به‌جای شکست کاذب skip می‌شود. */
function phpLintCheck() {
  var probe = spawnSync('php', ['-v'], { encoding: 'utf8' });
  if (probe.error || probe.status !== 0) return { skipped: true, bad: [], total: 0 };
  var bad = [];
  var total = 0;
  ['api', 'crm'].forEach(function (dir) {
    var absDir = path.join(ROOT, dir);
    if (!fs.existsSync(absDir)) return;
    fs.readdirSync(absDir).forEach(function (f) {
      if (!f.endsWith('.php')) return;
      total++;
      var p = path.join(absDir, f);
      var r = spawnSync('php', ['-l', p], { encoding: 'utf8' });
      if (r.status !== 0) {
        bad.push(path.join(dir, f) + ': ' + String(r.stderr || r.stdout || 'lint').trim());
      }
    });
  });
  return { skipped: false, bad: bad, total: total };
}

var failed = [];
var passed = 0;

console.log('── syntax ──');
var syn = syntaxCheck();
if (syn.length) {
  syn.forEach(function (s) { console.log('  ✘ ' + s); });
  failed.push('syntax');
} else {
  console.log('  ✔ ' + SYNTAX.length + ' crm files');
}

console.log('── php -l ──');
var phpLint = phpLintCheck();
if (phpLint.skipped) {
  console.log('  (php در دسترس نیست — این بخش skip شد)');
} else if (phpLint.bad.length) {
  phpLint.bad.forEach(function (s) { console.log('  ✘ ' + s); });
  failed.push('php-lint');
} else {
  console.log('  ✔ ' + phpLint.total + ' php files');
}

SUITE.forEach(function (item) {
  var abs = path.join(ROOT, item.f);
  if (!fs.existsSync(abs)) {
    console.log('✘ MISSING ' + item.f);
    failed.push(item.f + ' missing');
    return;
  }
  console.log('── [' + item.g + '] ' + item.f + ' ──');
  var r = spawnSync(process.execPath, [abs], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 25000
  });
  var out = String(r.stdout || '') + String(r.stderr || '');
  var lines = out.trim().split(/\n/);
  var tail = lines.slice(-8).join('\n');
  if (tail) console.log(tail);
  var timedOut = r.error && r.error.code === 'ETIMEDOUT';
  var fc = failCount(out);
  var ok = !timedOut && r.status === 0 && fc === 0 && looksPassed(out);
  if (ok) {
    passed++;
    console.log('  → PASS');
  } else {
    failed.push(item.f);
    console.log('  → FAIL exit=' + (timedOut ? 'timeout' : r.status) + ' parsedFail=' + fc);
  }
});

console.log('');
console.log('=== CI gate: ' + passed + ' PASS / ' + failed.length + ' FAIL ===');
if (failed.length) {
  console.log(failed.map(function (f) { return ' • ' + f; }).join('\n'));
  process.exit(1);
}
console.log('همهٔ تسترهای گیت سبز — اجازهٔ FTP');
process.exit(0);
