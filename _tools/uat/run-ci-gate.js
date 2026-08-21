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
  { g: 'پرونده/مدارک', f: '_tools/uat/tester405-v34.7.0-case-document-lifecycle.js' },
  { g: 'فروش/تأمین/AI', f: '_tools/uat/tester406-v34.7.1-rfq-item-entry-ai.js' },
  { g: 'تأمین/تنخواه/پرونده', f: '_tools/uat/tester407-v34.7.2-rfqs-petty-doc-projection.js' },
  { g: 'مکاتبات/خزانه', f: '_tools/uat/tester408-v34.7.3-signature-treasury-period.js' },
  { g: 'درخواست/موبایل', f: '_tools/uat/tester409-v34.7.4-rfq-mobile-parity.js' },
  { g: 'سایت/رهگیری', f: '_tools/uat/tester410-v34.7.5-random-public-tracking.js' },
  { g: 'پیشنهاد/یکپارچگی', f: '_tools/uat/tester411-v34.7.6-winner-repair-parity.js' },
  { g: 'پیشنهاد/موبایل/ACK', f: '_tools/uat/tester442-v34.7.39-offer-ack-workflow.js' },
  { g: 'پیشنهاد/قطعیت نتیجه ثبت', f: '_tools/uat/tester445-v34.7.42-offer-commit-certainty.js' },
  { g: 'فرمان‌های مالی/قطعیت عمومی', f: '_tools/uat/tester446-v34.7.43-command-commit-certainty.js' },
  { g: 'پیشنهاد/دکمه ذخیره مودال', f: '_tools/uat/tester447-v34.7.44-offer-save-button-return.js' },
  { g: 'کیفیت داده/پرونده', f: '_tools/uat/tester412-v34.7.7-guided-case-dedup.js' },
  { g: 'کیفیت داده/کش', f: '_tools/uat/tester417-v34.7.14-duplicate-case-projection-cache.js' },
  { g: 'بایگانی/سال مالی', f: '_tools/uat/tester413-v34.7.8-archived-test-purge.js' },
  { g: 'بایگانی/پرونده فعال', f: '_tools/uat/tester414-v34.7.9-shared-archive-preserve.js' },
  { g: 'موبایل/حساب مشتری', f: '_tools/uat/tester415-v34.7.10-mobile-customer-integrity.js' },
  { g: 'بحران/بازیابی', f: '_tools/uat/tester416-v34.7.13-backup-disaster-recovery.js' },
  { g: 'کیفیت محصول', f: '_tools/uat/tester400-v34.5.26-user-guide.js' },
  { g: 'کیفیت محصول', f: '_tools/uat/tester401-v34.5.27-sms-book-grouping.js' },
  { g: 'کیفیت محصول', f: '_tools/uat/tester402-v34.5.28-sms-staff-templates.js' },
  /* v34.7.17/18 — یکپارچگی سنجه‌های تصمیم‌یار و یکپارچگی وصولی (مطالبات/حساب مشتری/پرونده) */
  { g: 'مالی/ایمنی داده', f: '_tools/uat/tester422-v34.7.19-ar-data-safety.js' },
  { g: 'مالی/صدور غیررسمی', f: '_tools/uat/tester423-v34.7.20-unofficial-issue-path.js' },
  { g: 'مالی/چرخهٔ عمر و مرجوعی', f: '_tools/uat/tester424-v34.7.21-lifecycle-returns.js' },
  { g: 'فروش/گاردهای برد', f: '_tools/uat/tester425-v34.7.22-award-guards.js' },
  { g: 'مالی/ابطال سروری غیررسمی', f: '_tools/uat/tester426-v34.7.23-unofficial-void-server.js' },
  { g: 'تحلیل/تکمیل تصمیم‌یار', f: '_tools/uat/tester427-v34.7.24-analytics-completion.js' },
  { g: 'مالی/مطالبات', f: '_tools/uat/tester421-v34.7.18-ar-receipt-integrity.js' },
  { g: 'تحلیل/تصمیم‌یار', f: '_tools/uat/tester420-v34.7.17-decision-support-metrics.js' },
  { g: 'پرونده/اکشن فاکتور', f: '_tools/uat/tester428-v34.7.26-salesfile-invoice-actions.js' },
  { g: 'مالی/نشت بین‌مشتری', f: '_tools/uat/tester429-v34.7.26-cross-customer-advance-leak.js' },
  { g: 'مالی/شناسهٔ متعارف پرونده', f: '_tools/uat/tester430-v34.7.27-case-id-alias.js' },
  { g: 'پرونده/پیش‌فاکتور', f: '_tools/uat/tester432-v34.7.29-proforma-price-defaults.js' },
  { g: 'پیشنهاد/اقلام درخواست و نرخ مرجع', f: '_tools/uat/tester433-v34.7.30-inq-items-and-ref-price.js' },
  { g: 'پرونده/بازنگری سند برد', f: '_tools/uat/tester434-v34.7.31-award-revision.js' },
  { g: 'تأمین/P7 و پاکسازی S4', f: '_tools/uat/tester435-v34.7.32-p7-s4-awarddocs.js' },
  { g: 'کیفیت/H1 AN-04 ARCH-02', f: '_tools/uat/tester436-v34.7.33-h1-an04-arch02.js' },
  { g: 'پرونده/رویژن پیشنهاد برنده', f: '_tools/uat/tester437-v34.7.34-won-offer-revision.js' },
  { g: 'پرونده/رویژن هم‌زمان و retry', f: '_tools/uat/tester444-v34.7.41-award-revision-concurrency.js' },
  { g: 'پرونده/برابری فرم کامل رویژن', f: '_tools/uat/tester448-v34.7.45-award-revision-offer-form.js' },
  { g: 'پیشنهاد/درخواست دیگر و مبالغ', f: '_tools/uat/tester449-v34.7.47-offer-other-inq-and-money.js' },
  { g: 'پیشنهاد/فیلتر درخواست بر حسب کارفرما', f: '_tools/uat/tester450-v34.7.48-offer-inq-by-customer.js' },
  { g: 'پیشنهاد/کادر فشرده موجودی انبار', f: '_tools/uat/tester451-v34.7.49-offer-surplus-compact-hint.js' },
  { g: 'سایت/فرصت شغلی', f: '_tools/uat/tester452-v34.7.50-careers-site-crm.js' },
  { g: 'سایت/فرصت شغلی', f: '_tools/uat/tester453-v34.7.51-careers-publish-ai-content.js' },
  { g: 'سایت/فرصت شغلی', f: '_tools/uat/tester454-v34.7.51-careers-resume-attach-status.js' },
  { g: 'ابر/پیوست', f: '_tools/uat/tester455-v34.7.52-cloud-key-audit-webp.js' },
  { g: 'ابر/پیوست', f: '_tools/uat/tester456-v34.7.53-cloud-key-remap-b.js' },
  { g: 'معماری/قرارداد شناسه', f: '_tools/uat/tester457-v34.7.54-arch-id-order.js' },
  { g: 'سایت/فرصت شغلی', f: '_tools/uat/tester458-v34.7.55-jobposting-schema.js' },
  { g: 'پیشنهاد/اقلام و قیمت', f: '_tools/uat/tester459-v34.7.56-offer-dup-and-price-xls.js' },
  { g: 'پیشنهاد/نظم فرم', f: '_tools/uat/tester460-v34.7.57-offer-form-layout.js' },
  { g: 'پیشنهاد/خروجی رسمی', f: '_tools/uat/tester461-v34.7.58-offer-formal-output.js' },
  { g: 'ابر/پیوست', f: '_tools/uat/tester462-v34.7.59-cloud-list-pagination.js' },
  { g: 'مکاتبات/سربرگ', f: '_tools/uat/tester463-v34.7.60-letterhead-paste.js' },
  { g: 'مکاتبات/قالب‌بندی', f: '_tools/uat/tester464-v34.7.62-letter-formatting.js' },
  { g: 'جدول/سرستون', f: '_tools/uat/tester465-v34.7.63-header-pin-merge.js' },
  { g: 'درخواست/ضمایم', f: '_tools/uat/tester466-v34.7.64-attachment-pin-merge.js' },
  { g: 'مکاتبات/سربرگ قالب', f: '_tools/uat/tester467-v34.7.65-letterhead-formatting.js' },
  { g: 'پرونده/ابطال اسناد رسمی', f: '_tools/uat/tester438-v34.7.35-docx-void.js' },
  { g: 'پرونده/کشوی سه‌زبانه', f: '_tools/uat/tester439-v34.7.36-drawer-panes.js' },
  { g: 'مالی/نمایش ضمیمه گردش حساب', f: '_tools/uat/tester441-v34.7.38-ledger-attachment-visibility.js' },
  { g: 'استقرار/نگهبان معماری', f: '_tools/uat/tester443-v34.7.40-deploy-architecture-gate.js' },
  { g: 'معماری/پیشگیری', f: '_tools/uat/tester431-v34.7.28-architecture-guardrails.js' },
  { g: 'امنیت', f: '_tools/uat/tester397-v34.5.7-password-rehash.js' },
  { g: 'امنیت', f: '_tools/uat/tester398-v34.5.7-migrate-prod-lock.js' }
];

var SYNTAX = [
  'crm/bridge.js', 'crm/myday.js', 'crm/rbac.js', 'crm/sync.js', 'crm/client-server.js',
  'crm/finance-write-guard.js', 'crm/fiscal.js', 'crm/supplier-finance.js',
  'crm/opex.js', 'crm/petty.js', 'crm/cheques.js', 'crm/treasury.js',
  'crm/sales-domain-v2.js', 'crm/official-invoice-v2.js', 'crm/ar-reconcile.js', 'crm/case-revision.js', 'crm/surplus.js',
  'crm/metrics-shared.js', 'crm/analyzer.js', 'crm/management-intelligence.js',
  'crm/customer-finance.js', 'crm/finance-helpers.js', 'crm/insights.js', 'crm/cheque-module.js', 'crm/data-quality.js',
  'crm/unofficial-invoice.js', 'crm/commission.js', 'crm/working-capital.js', 'crm/fx.js',
  'crm/salesfiles.js', 'crm/inqreader.js', 'crm/rfqsmart.js', 'crm/user-guide.js', 'crm/careers.js',
  'crm/buycompare.js', 'crm/letters.js', 'crm/offers.js', 'crm/offers-pro.js',
  'crm/contracts.js', 'crm/docsx.js', 'crm/bridge.js', 'crm/offerlock.js',
  'crm/projects.js', 'crm/reports.js', 'crm/sync.js', 'crm/storage.js', 'crm/procurement-link.js', 'crm/mobile-table-labels.js', 'crm/my-customers-filter.js'
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

function archGuard() {
  /* نگهبان معماری (v34.7.28): جلوگیری از بازگشت خانواده‌های باگ شناخته‌شده.
     مبنا در _tools/arch/arch-baseline.json است؛ فقط «تخلف جدید» گیت را می‌شکند. */
  var r = require('child_process').spawnSync(process.execPath, [path.join(ROOT, '_tools/arch/arch-guard.js'), '--quiet'], { encoding: 'utf8' });
  var out = (r.stdout || '') + (r.stderr || '');
  return { ok: r.status === 0, out: out };
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

console.log('── نگهبان معماری ──');
var ag = archGuard();
ag.out.split('\n').filter(function (l) { return l.trim(); }).forEach(function (l) { console.log('  ' + l); });
if (!ag.ok) failed.push('arch-guard');

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
