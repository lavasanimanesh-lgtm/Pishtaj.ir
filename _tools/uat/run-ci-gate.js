#!/usr/bin/env node
'use strict';
/* گیت CI قبل از FTP: فقط تسترهای sync / مالی / اعلان که امروز سبز و بدون پین نسخهٔ مرده‌اند.
   تسترهای harness گاهی با FAIL هم exit 0 می‌دهند؛ این رانر شمارش FAIL را هم شکست می‌داند. */
var fs = require('fs');
var path = require('path');
var spawnSync = require('child_process').spawnSync;

var ROOT = path.resolve(__dirname, '../..');

/* RCA 2026-08-25: پرانتز جاافتاده در api/sales-domain.php کل API مالی استیجینگ را ۵۰۰ کرد
   چون هیچ گیت اجراییِ php -l وجود نداشت. این بررسی بهترین‌تلاش محلی است:
   ۱) اگر باینری php موجود باشد php -l اجرا می‌شود (قطعی)؛
   ۲) وگرنه اگر ماژول php-parser از قبل نصب باشد (npm i php-parser) با آن lint می‌شود؛
   ۳) وگرنه هشدار بلند — استقرار بدون این بررسی ریسک خاموشی کل api است. */
function phpLintGate() {
  var apiDir = path.join(ROOT, 'api');
  var files = [];
  try {
    fs.readdirSync(apiDir).forEach(function (name) { if (/\.php$/.test(name)) files.push(path.join(apiDir, name)); });
  } catch (eDir) { return; }
  var php = spawnSync('php', ['-v'], { encoding: 'utf8' });
  if (!php.error && php.status === 0) {
    var bad = [];
    files.forEach(function (f) {
      var r = spawnSync('php', ['-l', f], { encoding: 'utf8' });
      if (r.status !== 0) bad.push(path.basename(f) + ': ' + String(r.stdout || r.stderr || '').trim().split('\n')[0]);
    });
    if (bad.length) { console.log('⛔ php -l خطاها:\n  ' + bad.join('\n  ')); process.exit(1); }
    console.log('php -l: ' + files.length + ' فایل api/*.php سالم');
    return;
  }
  var parser;
  try { parser = require('php-parser'); } catch (eRequire) {
    console.log('⚠️  php و php-parser هر دو موجود نیستند — سینتکس api/*.php بررسی نشد!');
    console.log('    (نصب: npm i php-parser  یا نصب php-cli؛ بدون این، استقرار PHP خراب را متوقف نمی‌کند)');
    return;
  }
  var badJs = [];
  files.forEach(function (f) {
    try { new parser({ parser: { extractDoc: false, suppressErrors: false } }).parseCode(fs.readFileSync(f, 'utf8'), f); }
    catch (eParse) { badJs.push(path.basename(f) + ': ' + eParse.message); }
  });
  if (badJs.length) { console.log('⛔ php-parser خطاها:\n  ' + badJs.join('\n  ')); process.exit(1); }
  console.log('php-parser: ' + files.length + ' فایل api/*.php سالم');
}
phpLintGate();


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
  { g: 'تامین/درخواست‌های سایت', f: '_tools/uat/tester468-v34.7.66-sup-site-attachment.js' },
  { g: 'چت هوشمند', f: '_tools/uat/tester469-v34.7.67-smart-chat.js' },
  { g: 'چت هوشمند/فاز۴', f: '_tools/uat/tester470-v34.7.68-smart-chat-phase4.js' },
  { g: 'تامین/فایل پیوست', f: '_tools/uat/tester471-v34.7.69-sup-file-visible.js' },
  { g: 'تامین/ضدتکرار', f: '_tools/uat/tester472-v34.7.70-sup-dedup.js' },
  { g: 'تامین/دلیل-پیامک', f: '_tools/uat/tester473-v34.7.71-sup-reason-sms-resubmit.js' },
  { g: 'پرونده/ارجاع فاکتور', f: '_tools/uat/tester474-v34.7.72-invoice-ref-stage-unlock.js' },
  { g: 'کاربران/همگام‌سازی', f: '_tools/uat/tester475-v34.7.73-users-sync-button.js' },
  { g: 'تامین/حذف و تب‌های سایت', f: '_tools/uat/tester476-v34.7.74-sup-site-delete-and-tabs.js' },
  { g: 'فاکتور/سند برد و ضمیمه', f: '_tools/uat/tester477-v34.7.75-invoice-award-ref-and-attach-later.js' },
  { g: 'فاکتور/مبنای ریالی', f: '_tools/uat/tester478-v34.7.76-invoice-rial-basis.js' },
  { g: 'درخواست/دانلود ZIP ضمایم', f: '_tools/uat/tester479-v34.7.77-rfq-zip-download.js' },
  { g: 'سایت/فرم تامین‌کننده', f: '_tools/uat/tester480-v34.7.78-supplier-form-symmetry.js' },
  { g: 'سایت/شرایط پرداخت تامین‌کننده', f: '_tools/uat/tester481-v34.7.79-supplier-pay-terms.js' },
  { g: 'مالی/اظهارنامه‌ها', f: '_tools/uat/tester482-v34.7.80-tax-returns-separation.js' },
  { g: 'تامین/عملکرد', f: '_tools/uat/tester483-v34.7.81-supplier-perf.js' },
  { g: 'همگام/تشخیص', f: '_tools/uat/tester484-v34.7.91-sync-diagnostics.js' },
  { g: 'تامین/عملکرد', f: '_tools/uat/tester485-v34.7.91-supplier-pagination.js' },
  { g: 'ورود/نشست', f: '_tools/uat/tester486-v34.7.91-auth-token-required.js' },
  { g: 'تامین/عملکرد', f: '_tools/uat/tester487-v34.7.91-supplier-perf-followups.js' },
  { g: 'تامین/صندوق سایت', f: '_tools/uat/tester488-v34.7.91-supplier-inbox-lazy.js' },
  { g: 'استارت سرد/لود', f: '_tools/uat/tester489-v34.7.91-load-order-audit.js' },
  { g: 'تامین/مالی', f: '_tools/uat/tester490-v34.7.91-supplier-vat.js' },
  { g: 'تامین/مالی/UX', f: '_tools/uat/tester491-v34.7.91-supplier-cover-ux.js' },
  { g: 'مالی/ارزش افزوده', f: '_tools/uat/tester492-v34.7.91-vat-quarterly.js' },
  { g: 'مالی/ارزش افزوده/رفتار', f: '_tools/uat/tester493-v34.7.91-vat-quarterly-behavior.js' },
  { g: 'تامین/رفع باگ', f: '_tools/uat/tester494-v34.7.91-supplier-modal-debt.js' },
  { g: 'تامین/فاکتور پوششی', f: '_tools/uat/tester495-v34.7.91-cover-opex-no-claim.js' },
  { g: 'مالی/ارزش افزوده/UAT پایانی', f: '_tools/uat/tester496-v34.7.94-vat-quarterly-uat.js' },
  { g: 'فضای ابری/صف آپلود مجدد', f: '_tools/uat/tester497-v34.7.95-reupload-queue.js' },
  { g: 'مالی/مطالبات و OPEX ماهانه', f: '_tools/uat/tester498-v34.7.98-ar-opex-reconcile.js' },
  { g: 'مالی/مالکیت وصول و حقوق سروری', f: '_tools/uat/tester499-v34.7.98-server-salary-case-owner.js' },
  { g: 'پیشنهاد/تاریخ اعتبار مودال', f: '_tools/uat/tester500-v34.7.99-offer-validity-visible.js' },
  { g: 'مالی/مطالبات صرفاً ریالی', f: '_tools/uat/tester501-v34.8.0-ar-rial-only.js' },
  { g: 'مکاتبات/پرونده برنده/OPEX', f: '_tools/uat/tester502-v34.8.0-letters-award-opex.js' },
  { g: 'تاریخ شمسی/پیش‌نویس/RFQ سایت', f: '_tools/uat/tester503-v34.8.0-jalali-draft-site-source.js' },
  { g: 'مالی/خزانه و حساب مشتری', f: '_tools/uat/tester504-v34.8.4-treasury-customer-ledger.js' },
  { g: 'مالی/معماری recurring', f: '_tools/uat/tester505-v34.8.5-recurring-race-replay.js' },
  { g: 'مالی/فاز صفر و یک sync', f: '_tools/uat/tester506-v34.8.6-phase01-sync-safety.js' },
  { g: 'مالی/فاز دو سهامداران', f: '_tools/uat/tester507-v34.8.6-phase02-shareholder-commands.js' },
  { g: 'مالی/فاز سه cash semantics', f: '_tools/uat/tester508-v34.8.7-phase03-cash-semantics.js' },
  { g: 'مالی/فاز چهار UI و polling', f: '_tools/uat/tester509-v34.8.8-phase04-ui-poll-safety.js' },
  { g: 'مالی/فاز پنج repair plan', f: '_tools/uat/tester510-v34.8.9-phase05-repair-plan.js' },
  { g: 'مالی/فاز شش UI و سکوت retry', f: '_tools/uat/tester511-v34.8.10-phase06-repair-ui-and-retry-quiet.js' },
  { g: 'احراز هویت/حلقهٔ توکن', f: '_tools/uat/tester512-v34.8.6-auth-token-race.js' },
  { g: 'سینک/همگرایی کلیدهای مشترک', f: '_tools/uat/tester513-v34.8.7-shared-key-convergence.js' },
  { g: 'حافظه/استقلال از localStorage', f: '_tools/uat/tester514-v34.8.9-storage-independence.js' },
  { g: 'مالی/نجات تعارض محافظت‌شده فاز B', f: '_tools/uat/tester515-v34.8.10-protected-conflict-rescue.js' },
  { g: 'فاز C1/تله‌متری نازک‌سازی', f: '_tools/uat/tester516-v34.8.12-phase-c1-telemetry.js' },
  { g: 'فاز C2/فرمان عمومی موجودیت', f: '_tools/uat/tester517-v34.8.13-phase-c2-entity-commands.js' },
  { g: 'فاز C3/سرنخ‌ها', f: '_tools/uat/tester518-v34.8.14-phase-c3-leads.js' },
  { g: 'امنیت/PII users_get', f: '_tools/uat/tester519-v34.8.34-users-get-pii-guard.js' },
  { g: 'T0/T1 قراردادهای نازک‌سازی', f: '_tools/uat/tester520-v34.8.34-thin-client-t0t1.js' },
  { g: 'کارتابل/حلقهٔ یادآور', f: '_tools/uat/tester521-v34.8.34-cartable-reminder-loop.js' },
  { g: 'کارتابل/حلقهٔ دینگ', f: '_tools/uat/tester522-v34.8.34-ding-loop.js' },
  { g: 'استقرار/بنر استیجینگ', f: '_tools/uat/tester523-v34.8.34-staging-banner-lift.js' },
  { g: 'همگام/اتحاد notifs', f: '_tools/uat/tester524-v34.8.34-notifs-union.js' },
  { g: 'W1/روتر فرمانی سه موجودیت', f: '_tools/uat/tester525-v34.8.34-w1-entity-router.js' },
  { g: 'W1-iterate + صف IDB', f: '_tools/uat/tester526-v34.8.34-w1-iterate-outbox-idb.js' },
  { g: 'W2/مهاجرت شش کلید', f: '_tools/uat/tester527-v34.8.34-w2-migration.js' },
  { g: 'W3/مهاجرت مالی', f: '_tools/uat/tester528-v34.8.34-w3-migration.js' },
  { g: 'W4/تکمیل فرمانی', f: '_tools/uat/tester529-v34.8.34-w4-migration.js' },
  { g: 'T4/امنیت نشست + رسانه', f: '_tools/uat/tester530-v34.8.34-t4-security.js' },
  { g: 'T5-2/چک شخصی سینک', f: '_tools/uat/tester531-v34.8.34-personal-cheques-sync.js' },
  { g: 'T4/توکن کهنه ابزارها', f: '_tools/uat/tester532-v34.8.34-tools-stale-token-heal.js' },
  { g: 'T3-1/خواندن سرور-محور', f: '_tools/uat/tester533-v34.8.34-collection-query.js' },
  { g: 'T3-1/ماژول کالا سروری', f: '_tools/uat/tester534-v34.8.34-prod-server-read.js' },
  { g: 'T3-1/سخت‌سازی خواندن کالا', f: '_tools/uat/tester535-v34.8.34-prod-read-hardening.js' },
  { g: 'T0-3/4/6 اتصال گیت به CI', f: '_tools/uat/tester536-v34.8.35-ci-gate-wired.js' },
  { g: 'سینک/برابری ماتریس RBAC کلاینت↔سرور', f: '_tools/uat/tester537-v34.8.37-sync-rbac-matrix-parity.js' },
  { g: 'سینک/PULL-EQUAL-ACK + پنجرهٔ گیت استقرار', f: '_tools/uat/tester538-v34.8.37-pull-equal-ack.js' },
  { g: 'نازک‌سازی/T5-2b تشخیصی‌های فرمان در IDB', f: '_tools/uat/tester539-v34.8.39-devkv-idb-diagnostics.js' },
  { g: 'استقرار/DEPLOY-SPEEDUP + TRUTHFUL-GREEN استیجینگ', f: '_tools/uat/tester540-v34.8.40-deploy-speedup-staging.js' },
  { g: 'نازک‌سازی/R2 پیش‌نویس‌ها و صف کدینگ در IDB', f: '_tools/uat/tester541-v34.8.40-r2-devkv-drafts-codegen.js' },
  { g: 'نازک‌سازی/R3 کش read-through با TTL در IDB', f: '_tools/uat/tester542-v34.8.41-r3-cache-ttl-idb.js' },
  { g: 'نازک‌سازی/R4-گام۱ پرچم قطع موتور legacy سینک', f: '_tools/uat/tester543-v34.8.42-r4g1-legacy-push-off.js' },
  { g: 'نازک‌سازی/R5-گام۱ توکن/نشست خارج از localStorage', f: '_tools/uat/tester544-v34.8.43-r5g1-session-out-of-ls.js' },
  { g: 'نازک‌سازی/R5-گام۲ عکس پروفایل به فضای ابری', f: '_tools/uat/tester545-v34.8.44-r5g2-avatars-s3.js' },
  { g: 'نازک‌سازی/R6-الف ابزارهای ریکاوری IDB-aware + سقف نرخ فرمان‌ها', f: '_tools/uat/tester546-v34.8.45-r6a-idb-tools-rate-limit.js' },
  { g: 'نازک‌سازی/R6-ب ورود دومرحله‌ای پیامکی نقش مالی + نشست‌های فعال', f: '_tools/uat/tester547-v34.8.46-r6b-2fa-sessions.js' },
  { g: 'هات‌فیکس/حلقهٔ بازسازی نشست (SS مسدود)', f: '_tools/uat/tester548-v34.8.47-hotfix-sess-storm.js' },
  { g: 'هات‌فیکس/حالت فقط-کوکی (هر دو مخزن مسدود)', f: '_tools/uat/tester549-v34.8.48-cookie-only-mode.js' },
  { g: 'هات‌فیکس/حافظهٔ فانتوم (نوشتن بی‌خطا، خواندن null)', f: '_tools/uat/tester550-v34.8.50-phantom-storage.js' },
  { g: 'پیش‌دیپلوی/تنظیمات متناسب با معماری + بازبینی پروداکشن', f: '_tools/uat/tester551-v34.8.51-preprod-settings-audit.js' },
  { g: 'نهایی/بنر مهاجرت + اثبات‌های E1..E7', f: '_tools/uat/tester552-v34.9.0-final-e-proofs.js' },
  { g: 'نهایی/هات‌فیکس 9.1: پمپ snapshot + تلهٔ سبزِ ناتمام + شفافیت dirty + خطای دقیق', f: '_tools/uat/tester553-v34.9.1-trap-snap-hotfix.js' },
  { g: 'نهایی 9.2: RCA برخورد کد/ضمائم + خزانه/نام دوگانه/جستجو/typeahead/امضا/کپی نامه/صف H', f: '_tools/uat/tester554-v34.9.2-ux-integrity.js' },
  { g: 'سئو S1 (10.0): صف متای AI + حلقهٔ ایندکس + نقشهٔ خودکار + پیش‌نویس + یتیم/لینک‌سازی', f: '_tools/uat/tester555-v34.10.0-seo-s1-loops.js' },
  { g: 'سئو S2 (11.0): مولد صفحهٔ محصول + ادیتور ریدایرکت + ثبت زیرنقشه در ایندکس', f: '_tools/uat/tester556-v34.11.0-seo-s2-generators.js' },
  { g: 'سئو S3 (12.0): فیکس ثبت نقشه + اسنپ‌شات/روند + خوشه‌بندی محتوا', f: '_tools/uat/tester557-v34.12.0-seo-s3-growth.js' },
  { g: 'سئو S2-id (13.0): مولد صفحهٔ عمومی + فیکس‌های سئو + زیرمنوی مدیریت سایت', f: '_tools/uat/tester558-v34.13.0-seo-s2id-sitemenu.js' },
  { g: 'سئو S4 (14.0): زمان‌بندی/تأیید دومرحله‌ای + تاریخچه‌بازگشت + هزینهٔ AI + PageSpeed + hreflang', f: '_tools/uat/tester559-v34.14.0-seo-s4-quality.js' },
  { g: 'سئو S5 (15.0): hreflang دوطرفه + canonical گروهی + alt تصویر با بینایی AI', f: '_tools/uat/tester560-v34.15.0-seo-s5-hygiene.js' },
  { g: 'سئو S3-id (16.0): واچ‌لیست جایگاه کلمات با روند از اسنپ‌شات‌ها', f: '_tools/uat/tester561-v34.16.0-seo-watchlist.js' },
  { g: 'سئو S3-id (17.0): صفحات AI-لمس‌شده در برابر بقیه (رجیستری + مقایسهٔ اسنپ‌شات)', f: '_tools/uat/tester562-v34.17.0-seo-ai-impact.js' },
  { g: 'UX (18.0): نام دوگانهٔ مشتری (فارسی+انگلیسی زیر هم) در پیشنهادات/فاکتورها/پرونده‌های فروش', f: '_tools/uat/tester563-v34.18.0-dual-cust-names.js' },
  { g: 'UX (19.0): سطل بازیافت — snapshot در لحظهٔ حذف + entity_restore سروری + مودال بازیافت', f: '_tools/uat/tester564-v34.19.0-recycle-bin.js' },
  { g: 'UX (20.0): سه رفع شکایت CMS — گروه موبایل مدیریت سایت + ابزارهای فرم صفحه + JSON مقاوم AI', f: '_tools/uat/tester565-v34.20.0-cms-complaints.js' },
  { g: 'UX (21.0): دستیار هوش مصنوعی خارجی — پرامپت آماده + تجزیهٔ خروجی با نشانگر', f: '_tools/uat/tester566-v34.21.0-external-ai-assistant.js' },
  { g: 'UX (22.0): مرتب‌سازی مکاتبات — پیش‌فرض جدیدترین بالا + سورت شماره/تاریخ', f: '_tools/uat/tester567-v34.22.0-letters-sort.js' },
  { g: 'UX (23.0): سه‌گانهٔ درخواست‌ها — سورت تاریخ دو-تقویمی + فیلتر از سایت + ریشه‌کنی حذف files در سرور', f: '_tools/uat/tester568-v34.23.0-rfq-site-fix.js' },
  { g: 'UX (24.0): اصلاح هوشمند گروهی سئو — ویزارد یک‌کلیکی در چهارچوب Google Search Central', f: '_tools/uat/tester569-v34.24.0-seo-batch-ai.js' },
  { g: 'UX (25.0): استودیو محصول — آپلود عکس از بیرون + پیش‌نمایش قبل از انتشار + ذخیرهٔ موقت صریح', f: '_tools/uat/tester570-v34.25.0-product-image-preview.js' },
  { g: 'UX (26.0): ریشه‌کنی جریان محصول — پیش‌نمایش سروری + تصویر مرئی + حذف تکرار + فهرست محصولات + پرامپت راهنمای فنی', f: '_tools/uat/tester571-v34.26.0-product-pipeline-fix.js' },
  { g: 'UX (26.1): پوستهٔ مقاوم تب‌های CMS — خطای رندر مرئی + فرم جایگزین صفحهٔ جدید', f: '_tools/uat/tester572-v34.26.1-cms-tab-guard.js' },
  { g: 'UX (27.0): کش‌سنجی cms.js + گارد مسیر CMS + پل سرچ کنسول (ثبت سایت‌مپ و ایندکس‌یاب یک‌کلیکی)', f: '_tools/uat/tester573-v34.27.0-gsc-bridge-cache.js' },
  { g: 'UX (28.0): ریشه‌کنی تب‌های خالی CMS — رندر مستقیم cmsTab بدون goPanelByName/دکمهٔ سایدبار', f: '_tools/uat/tester574-v34.29.7-cms-tab-direct.js' },
  { g: 'UX (29.0): جستجوی فهرست محصولات CMS + عکس هوشمند + سپر نسخهٔ کهنه + دو صفحهٔ محصول استاندارد', f: '_tools/uat/tester575-v34.29.7-prod-search-smartimg-vershield.js' },
  { g: 'UX (29.1): آزمون اتصال GSC — علت دقیق ثبتِ ناموفق نقشه + فهرست پراپرتی‌ها + راهنمای رفع', f: '_tools/uat/tester576-v34.29.7-gsc-selftest.js' },
  { g: 'UX (29.2): راهنمای سئو برای کاربران ناآشنا — چک‌لیست زنده + ۶ گام + دکمه‌های اجرای ابزار', f: '_tools/uat/tester577-v34.29.7-seo-guide.js' },
  { g: 'UX (29.4): پارسر مقاوم خروجی هوش خارجی — بولد/جعبهٔ کد/بولت/دونقطهٔ کامل + خطای درون‌مودال', f: '_tools/uat/tester579-v34.29.7-ext-parse-hardened.js' },
  { g: 'UX (29.5): ریشه‌کنی برخورد شناسهٔ pgTitle + شمارنده‌های زندهٔ عنوان/نامک/محصول + شفاف‌سازی کف ۲۰۰', f: '_tools/uat/tester580-v34.29.7-cms-field-ids-and-counters.js' },
  { g: 'UX (29.6): یک‌کلیکی‌شدن یادآور (نوشتن محلی بی‌درنگ + پچ مینیمال ضد بازگشت) + کارت اعلان site_req برای درخواست‌های سایت', f: '_tools/uat/tester581-v34.29.7-rem-oneclick-and-site-notif.js' },
  { g: 'UX (29.7): یکسان‌سازی درخواست‌های سایت با موازین CRM — کانال‌های تماس people در سرور زنده + people استاندارد مشتری/تامین‌کنندهٔ سایت + حفظ فیلدها در ویرایش', f: '_tools/uat/tester582-v34.29.7-site-parity-cust-sup.js' },
  { g: 'FIN (29.8): پایداری حذف/ابطال پروندهٔ فروش — tombstone هزینه‌ها (_costTomb) + ددوب costEvents در merge + جاروب تعمیر + PL canonical با void-wins و حذف قطعی', f: '_tools/uat/tester583-v34.29.8-deal-cost-tomb-and-pl-void-delete.js' },
  { g: 'FIN (30.0): ارجاع فاکتور پروندهٔ ارزی با نسخهٔ ریالی ثبت‌شده — تشخیص خودکار/انتخابی مبنای ریالی + نرخ تسعیر برگرفته + نمایش در هر دو پنل فاکتور', f: '_tools/uat/tester584-v34.30.0-fx-rial-ref-basis.js' },
  { g: 'UX (R3): انتخاب مشتری با جستجو در مودال ثبت درخواست (مشابه فرم پیشنهاد) + جستجوی فهرست اتصال در مودال درخواست تامین', f: '_tools/uat/tester586-v34.34.0-cust-ac-and-rqs-src-search.js' },
  { g: 'UX (R4): راهنمای سئو پیش‌فرض بسته و ماندگار + هدایت واقعی دکمهٔ بهینه‌سازی سرچ کنسول به تب سئو با بنر راهنما', f: '_tools/uat/tester587-v34.35.0-seo-guide-gsc-optimize.js' },
  { g: 'SYNC (36.1): همگرایی «انتقال یک‌باره» — عبور protectedConflicts + watermark پس از ACK + تلاش مجدد/نجات + عدمِ پاک‌کردن نشانگرها + گزارش دقیق علت + برابری فهرست کلیدها', f: '_tools/uat/tester588-v34.36.1-migration-convergence.js' },
  { g: 'سایت/ثبت‌نام تامین‌کننده (36.2): رسید پیوست — «ثبت سبز بدون فایل» ممنوع + علت دقیق نرسیدن فایل + ارسال دوباره به همان کد + جدیدترین-اول در صندوق', f: '_tools/uat/tester589-v34.36.2-supplier-upload-receipt.js' },
  { g: 'AI/مدیریت سایت (36.2): ریشه‌کنی «خروجی AI ساختار JSON معتبر ندارد» — تعمیر JSON بریده + salvage+retry برای همهٔ اکشن‌های سئو + پیام عملیاتی با علت و نمونهٔ خام', f: '_tools/uat/tester590-v34.36.2-ai-json-repair.js' },
  { g: 'UI/پنل حساب', f: '_tools/uat/tester591-v34.36.3-collapsible-account-panels.js' },
  { g: 'استقرار/گیت صحت (36.4): INTEGRITY-TRUTHFUL — readback مسدودکننده از FTP + تازگی HTTP هشدارِ صرف، تفکیک «بدنهٔ تهی» از «ناهمسانی محتوا»، تلاش مجدد فایل‌به‌فایل، fallback پایان‌خط و اجرای واقعیِ بلوک با curl ساختگی', f: '_tools/uat/tester592-v34.36.4-deploy-integrity-truthful.js' },
  { g: 'استقرار/مسیر افزایشی (36.4): DELTA-FAILSAFE — اجرای واقعیِ گامِ دلتا در ریپوی gitِ ایزوله (مارکر معتبر/ناشناخته/نبود · FTP مرده · schedule · ورودی full · مسیر غیرِ ASCII) و قفلِ «هرگز هیچ دیپلویی»', f: '_tools/uat/tester593-v34.36.4-deploy-delta-failsafe.js' },
  { g: 'UX (CUST-RFQ-ORPHAN): مشتری روی درخواست هست ولی در فهرست نیست — گارد کد یکتا + heal از snapshot + فیلتر RFQ-linked', f: '_tools/uat/tester594-v34.36.5-cust-rfq-orphan.js' },
  /* ═══ v34.37.0 — سه گزارش کارفرما (۱۴۰۵/۰۶/۱۴). هر سه «رفتاری»‌اند نه رشته‌ای:
     ریشهٔ ماندگاری این باگ‌ها همین بود که تسترهای قبلی فقط وجودِ یک رشته در فایل را
     می‌سنجیدند و با وجود باگِ زنده سبز می‌ماندند. ═══ */
  { g: 'دادهٔ CRM (37.0/P0): «مشتری تازه پاک می‌شود» — سنگ‌قبرِ دامنه‌دار و تاریخ‌دار + کد بازنشسته دوباره صادر نشود + سپر حذف انبوه + بازتولید کد پس از ۴۰۹', f: '_tools/uat/tester595-v34.37.0-tombstone-scope.js' },
  { g: 'فروش تا وصول (37.0/P0): ارجاع فاکتور — تایید صریح پیش از ثبت (هیچ نوشتنی بدون تایید) + فرمان لغو ارجاع با گارد فاکتور فعال + دکمه در پرونده و پنل فاکتورها', f: '_tools/uat/tester596-v34.37.0-inv-ref-confirm-undo.js' },
  { g: 'UI فاکتورها (37.1): نمایش ردیفی + کشوی جزئیات با فلش + قفلِ «فاکتور ثبت شده است» (مودال ثبت دوباره باز نمی‌شود) — روی پنلِ زندهٔ official-invoice-v2.js', f: '_tools/uat/tester598-v34.37.1-invoice-panel-rows.js' },
  { g: 'UI فاکتورها (37.2): دیده‌شدن فاکتورهای ثبت‌شده/ارجاع‌شده — بخش «بدون ردیف ارجاع» + تطبیق نرمال‌شده (ارقام فارسی/نسخهٔ ریالی) + جستجو + بازخوانی پس از ورود؛ رفتارمحور و آزمون‌جهش‌شده', f: '_tools/uat/tester599-v34.37.2-invoice-panel-visibility.js' },
  { g: 'UI فاکتورها (37.3): «لغو ارجاع» باید ردیف را بلافاصله از ثبت‌شده/ارجاع‌شده پاک کند (اعمال محلی + بازگشت در رد) + تراز ستون‌های پنل با قالب مشترک', f: '_tools/uat/tester600-v34.37.3-invoice-panel-undo-immediate.js' },
  { g: 'UI فاکتورها (37.4): ریشۀ «فهرست خالی فاکتورها با اکانت رییس» — میان‌بر allow-override در perms.js باید پنلِ لحظۀ کلیک را اجرا کند (late bind، بی‌خبر از ترتیب defer) و رندر بازنشستۀ rbac.js نباید روی «ارجاع بی‌فاکتور» با TypeError پنل را بیندازد', f: '_tools/uat/tester601-v34.37.4-perm-allow-late-bind.js' },
  { g: 'سایت/SEO (37.5): «ثبت نقشهٔ سایت از CRM» — نوشتنِ نقشه باید صادق باشد (وضعیت sitemap در پاسخ انتشار، هشدار پنل، cms_log خطا)، راهنمای GSC باید Full بگوید (نه Restricted)، و api/.htaccess باید gsc.php را در allowlist داشته باشد', f: '_tools/uat/tester602-v34.37.5-sitemap-honest.js' },
  { g: 'CRM/مالی (37.6): همپوشانی ستون‌های پنل فاکتورها — clip در قالب مشترک، shrink مجاز، لبهٔ همسان سربرگ، tabular-nums مبالغ', f: '_tools/uat/tester603-v34.37.6-invoice-panel-clip.js' },
  { g: 'CRM/داده (37.7): CONTACT-WIPE — تلفن/اشخاص/کانال مشتری دیگر با ذخیره یا قالب‌بندی شماره پاک نمی‌شود', f: '_tools/uat/tester604-v34.37.7-contact-wipe.js' },
  { g: 'CRM/فاکتور و همگام‌سازی پرونده (37.8): اقلام سفارشی فاکتور غیررسمی (ویرایش نام/واحد) + سنگ‌قبر رویدادها و اسناد پرونده در sync.js و salesfiles.js', f: '_tools/uat/tester605-v34.37.8-custom-lines-and-tombstone-sync.js' },
  { g: 'CRM/پیشنهاد و بوت سرد (38.1): BUG-OFFER-TOCO-IDENTITY — تبدیل TO→CO پس از ویرایش دیگر با «رکورد اصلی پیشنهاد پیدا نشد» نمی‌میرد + COLD-BOOT-HYDRATE — آب‌رسانی کلیدهای offloadشده از IDB و گیت pull اول بوت (پایان دانلود کامل چندمگابایتی در هر رفرش) + LIST-RENDER-N1 — حذف parse تکراری مشتریان در رندر فهرست‌ها', f: '_tools/uat/tester606-v34.38.1-offer-toco-identity-and-cold-boot-hydrate.js' },
  { g: 'سئو (38.1/SEO): HREFLANG-RECIPROCAL — اعلام متقابل نسخهٔ en در about/ و services/ و projects/ + حذف ارجاع به صفحهٔ noindex + PRODUCT-ORPHANS — لینک‌دهی داخلی هر ۷ صفحهٔ /products/* و اصلاح ۳۰ لینک خالی هاب + THIN-INDEX — خروج search/ از ایندکس/نقشه و غنی‌سازی صفحات کم‌محتوا و EN + MICRO', f: '_tools/uat/tester607-v34.38.1-seo-hreflang-orphans-thin.js' },
  { g: 'سئو (38.1/KC-STRUCT): KC-PHASE1 — یک main/article یکتا + بایلاین و TOC استاتیک در هر ۴۱۰ مقاله + انتقال لیدهای بیرون-main به داخل article + بک‌فیل مطالب مرتبط (۱۳۲ صفحه) + اصلاح shortest در ۵۹ صفحه', f: '_tools/uat/tester608-v34.38.1-kc-phase1-structure.js' },
  { g: 'سایت/ثبت‌نام تامین‌کننده (37.0): پایان آبجکت یتیم — تکراری پیش از آپلود بررسی می‌شود + بازیابی پیوست روی phone/ph/mob + انتخاب بهترین رکورد + هم‌ترازی accept با allowlist', f: '_tools/uat/tester597-v34.37.0-supplier-attach-order.js' },
  { g: 'UX (29.3): ریشه‌کنی واقعی تب‌های خالی CMS — برخورد کلاس pn/tb با CSS سراسری (سنجش computed visibility)', f: '_tools/uat/tester578-v34.29.7-cms-css-visibility.js' },
  { g: 'پرونده/ابطال اسناد رسمی', f: '_tools/uat/tester438-v34.7.35-docx-void.js' },
  { g: 'پرونده/کشوی سه‌زبانه', f: '_tools/uat/tester439-v34.7.36-drawer-panes.js' },
  { g: 'مالی/نمایش ضمیمه گردش حساب', f: '_tools/uat/tester441-v34.7.38-ledger-attachment-visibility.js' },
  { g: 'استقرار/نگهبان معماری', f: '_tools/uat/tester443-v34.7.40-deploy-architecture-gate.js' },
  { g: 'معماری/پیشگیری', f: '_tools/uat/tester431-v34.7.28-architecture-guardrails.js' },
  { g: 'امنیت', f: '_tools/uat/tester397-v34.5.7-password-rehash.js' },
  { g: 'امنیت', f: '_tools/uat/tester398-v34.5.7-migrate-prod-lock.js' },
  { g: 'FIN (38.2): «جمع هزینهٔ مستقیم پرونده درست نیست» و «هزینهٔ حذف‌شده (تنخواه) با رفرش برمی‌گردد» — منبع واحد خواندن/جمع هزینه (ptfDealVisibleCosts/ptfDealCostSumIRR/ptfCostListSumIRR) + اعمال _costTomb در پروجکشن تنخواه و مسیر pull + جمع بجای Math.max در هوک سود + هم‌قاعده‌سازی dealTotalCosts + جاروب نسخه‌دار', f: '_tools/uat/tester609-v34.38.2-cost-sum-and-resurrection.js' },
  { g: 'FIN (38.3): ریسک هم‌خانواده در بایگانی/گزارش مالی — prjPostCostDel سنگ‌قبر می‌نویسد و merge/pull آن را ماندگار می‌کند (ptfProjectsApplyCostTombstones) + sfArchive دانش حذف را منتقل می‌کند + fiscalDirectProjectCosts هزینهٔ حذف‌شده/پیش‌پرداخت را نمی‌شمارد', f: '_tools/uat/tester610-v34.38.3-prj-cost-resurrection.js' },
  { g: 'CRM/داده (38.4): CONTACT-WIPE-EXT — «حوزهٔ کاری مشتری هم پاک می‌شود» — reasonهای کل‌دفترِ بدون قصد حذف (lead-convert/ai-*/coen-fill/site-approve/site-merge/cheque-origin/supspec*) به AUTO_NO_DELETE اضافه شدند تا cd غایبِ خواندن کهنه entity_delete نشود + heal مشتری از درخواست ind را از ca/category بازسازی می‌کند + custmerge حذف عمدی را allowDeletes:true صریح می‌کند', f: '_tools/uat/tester611-v34.38.4-contact-wipe-ind-heal.js' },
  { g: 'CRM/مالی (38.5): DATA-QUALITY SH-SALARY — «تب کیفیت داده حقوق سهامدار را بدون نوع رسمی/غیررسمی نشان می‌دهد ولی ویرایش سهامدار گزینه‌ای ندارد» — فیلد «نوع سند حقوق» در ویرایش سهامدار (salaryOfficial) + انتشار isOfficial به ردیف هزینهٔ حقوق در register/reconcile سرور + راهنمای کیفیت داده برای ردیف‌های حقوق سهامدار', f: '_tools/uat/tester612-v34.38.5-shareholder-salary-official.js' },
  { g: 'CRM/اعلان+داده (38.6): NTF-LIFECYCLE + CONTACT-WIPE R2-R4 + OPEX-DUP-GUARD — اعمال همهٔ یافته‌های RCA: پروندهٔ تسویه‌شده هشدار تحویل نمی‌گیرد (گارد sfStageOf>=11 + resolve در sfArchive)؛ کارت‌های deal-due/rfq-due/rem-due هنگام بسته‌شدن منبع بسته می‌شوند؛ حذف انبوه اعلان از مسیر فرمان تک‌رکوردی (رفع union-key MAX_OPS)؛ مهاجرت دفترچه با گارد truncation + reason contact-mig؛ تبدیل حقوقی→حقیقی تماس‌ها را منتقل می‌کند؛ fallback phonefmt از روتر؛ آشکارساز read-only دوباره‌شماری + هشدارهای نرم ثبت دستی/قالب', f: '_tools/uat/tester613-v34.38.6-ntf-lifecycle-and-findings.js' },
  { g: 'CRM/داده (38.7): CONTACT-GHOST — گزارش «اطلاعات تماس مشتری پاک می‌شود؛ یکی می‌بیند یکی نمی‌بیند»: گمان ارقام انگلیسی با شبیه‌سازی کد واقعی رد می‌شود (تماس EN end-to-end سالم می‌رسد)؛ heal/مهاجرت سیستمی (rfq-cust-heal/contact-mig/phonefmt-mig) در برخورد کد 409 دیگر مشتری تکراریِ بدون تماس نمی‌سازد و سایهٔ محلی را کنار می‌گذارد؛ stub بازسازی کلیدهای تماس تهی نمی‌فرستد (merge سرور هرگز تماس معتبر را نمی‌شوید)؛ migrateContacts برای رکورد فاقد con/ph دیگر people:[] تولید و push نمی‌کند؛ dedup-by-phone اتصال سایت ارقام فارسی را می‌فهمد', f: '_tools/uat/tester614-v34.38.7-contact-ghost-cohorts.js' },
  { g: 'CRM/داده (38.8): CONTACT-RECOVERY-ONECLICK — به درخواست کارفرما «تماس‌ها مگر روی سرور نیست؟ با یک کلیک برگردانَد شود بدون دانستن تاریخ حذف»: restore-contacts.js بک‌آپ‌های چرخشی سرور را جدید→قدیم خودکار وارسی می‌کند و هر فیلد تماس را از جدیدترین منبعِ دارنده بازیابی می‌کند (چندمنبعی، فقط cd، فقط فیلدهای خالی، بدون حذف/ایجاد، فقط admin/chairman)؛ apply از روتر offer-cust merge-safe رد می‌شود', f: '_tools/uat/tester615-v34.38.8-contact-recovery-oneclick.js' },
  { g: 'CRM/داده (38.9): BACKUP-BLIND-SPOT — گزارش «دکمهٔ بازیابی تماس‌ها کار نمی‌کند»: از فاز B کلیدهای کسب‌وکاری >۸KB به IndexedDB منتقل و از localStorage حذف می‌شوند ولی backup.js مستقیم localStorage می‌خواند؛ نتیجه بک‌آپ‌های چرخشی سرور «صفر مشتری» داشتند و دلتا هم کلید را با null می‌فرستاد و بک‌آپ پایه را مسموم می‌کرد (هر دو در سکوت). حالا خواندن از آینهٔ فاز B + سپر پوشش کلیدهای حیاتی + تعویق تا آب‌رسانی آینه + عدم ارسال null؛ و restore-contacts.js بازیابی فیلد-به-فیلد (شستشوی جزئی)، تشخیص دلیل بی‌فایده‌بودن هر بک‌آپ، منابع محلی/دستی و maxOps برای بازیابی انبوه', f: '_tools/uat/tester616-v34.38.9-backup-blindspot-and-partial-recovery.js' },
  { g: 'CRM/داده (38.10): SNAPSHOT-INTEGRITY — manifest/checksum/count/bytes، pull chunkی قابل ادامه، staging/commit اتمیک و regression فیلتر action در collection_query', f: '_tools/uat/tester617-v34.38.10-snapshot-integrity.js' },
  { g: 'CRM/سینک (38.11): ATOMIC-PULL-COMPLETION — گزارش «دریافت کامل CRM انجام نشد؛ هر چند ثانیه تکرار می‌شود و درخواست‌های تأمین بارگذاری نمی‌شوند»: chunk بایتیِ دقیق به‌جای بازتولید JSON در مرورگر (پایان snapshot_checksum_mismatch و تغییر شکل {} → []), تحمل drift اسنپ‌شات با pin کردن rev کلید/بایگانی و حفظ پیشرفت بین تلاش‌ها، گزارش کلید ناخوانا به‌جای شکست «همه یا هیچ»، عبور خودکار به pull دلتا و پیام علت‌دار بدون تکرار', f: '_tools/uat/tester618-v34.38.11-atomic-pull-completion.js' },
  { g: 'CRM/ایمنی داده (38.12): MASS-DELETE-SHIELD — حادثهٔ «۶۸ درخواست تأمین به ۱ رکورد رسید»: حذف انبوهِ بدون سنگ‌قبر در data_push به conflict تبدیل می‌شود، گیت bootstrap برای مسیر فاز B هم اعمال شد، GUARD_KEYS و قرنطینهٔ بک‌آپ همهٔ کلیدها را می‌پوشانند و مبنای سپر از نمای ناقص (آینهٔ آب‌رسانی‌نشده) خراب نمی‌شود', f: '_tools/uat/tester619-v34.38.12-mass-delete-shield.js' },
  { g: 'CRM/بازیابی (38.13): RECORD-RECOVERY — ابزار «بازیابی رکوردهای گم‌شده» از بک‌آپ‌های چرخشی سرور یا فایل دانلودشده؛ فقط افزودن رکورد غایب، احترام به سنگ‌قبر حذف، انتخاب جدیدترین منبع، مسیر ذخیرهٔ استاندارد و ثبت audit (بازگرداندن ۶۷ درخواست تأمین حادثهٔ ۱۴۰۵/۰۶/۱۷)', f: '_tools/uat/tester620-v34.38.13-record-recovery.js' },
  { g: 'CRM/پرونده (38.14): ARCHIVE-UNIQUENESS + RESTORE — گزارش «پرونده بایگانی شد ولی بعد از رفرش در پرونده‌های فروش هم بود»: سپر کلاینتی حذف انبوه، حذفِ «آخرین» پرونده را به legacy تنزل می‌داد و entity_delete به سرور نمی‌رسید (تولد باگ با اجرای کد واقعی). حالا حذف بایگانی هدفمند و اتمیک است (prevArr صریح + allowBulkDelete)، رکورد بایگانی cd پایدار دارد (تلاش‌مجدد = همان رکورد، نه رونوشت)، جاروی یکتایی «یک پرونده = یک محل» را در رندر/بوت اعمال و دادهٔ آلودهٔ قبلی را التیام می‌دهد، و دکمهٔ «↩️ به جریان انداختن پرونده» بازگشت از بایگانی به فروش را با cd/اسناد/رویدادهای اصلی + خنثی‌سازی سنگ‌قبر (الگوی entity_restore) + سه‌حالت restore/prefer-live + قفل رابط‌کاربری فراهم می‌کند', f: '_tools/uat/tester621-v34.38.14-archive-uniqueness-restore.js' },
  { g: 'CRM/دستگاه (38.14): DEVICE-RECONNECT — ابزار مستقل «اتصال مجدد امن مرورگر» (crm/device-reconnect.html) برای مرورگر گیرکرده پس از حادثهٔ حذف انبوه: تشخیص خودکار (API/نشست/صف ارسال) + بک‌آپ اجباری پیش از هر پاکسازی (فرمان ب) + خنثی‌سازی جراحی‌وار فقط «وضعیت معلق» (صف آفلاین q:ptf_b_queue، مجموعهٔ dirty، قفل sync_run، واترمارک‌ها، پایان نشست) بدون دست‌خوردن دادهٔ کسب‌وکار/نشانگرهای انتقال + پروبهای صرفاً خواندنی + مسیر ورود مجدد با pull کامل', f: '_tools/uat/tester622-v34.38.14-device-reconnect.js' },
  { g: 'CRM/سینک (38.15): BOOT-REVERT — به درخواست کارفرما «سیستم به حالت قبل از جایی که فراخوانی از سرور اضافه شد برگردد»: ریشهٔ زنجیرهٔ مشکلات ورود v34.38.10 بود (pull اتمیک data_manifest/data_chunk در بوت، همیشه fail-closed روی دادهٔ واقعی — RCA 2026-09-08/09). پرچم PTF_CRM_SNAPSHOT_V2 در index.html خاموش شد ⇒ بوت/ورود و دریافت کامل مجدد دقیقاً مثل قبل از v34.38.10 از data_pull تک‌مرحله‌ای می‌آید؛ کد اتمیک و endpointهای سرور برای فعال‌سازی مجدد آینده محفوظ ماندند و سپر حذف انبوه v34.38.12 سرِ کار است', f: '_tools/uat/tester623-v34.38.15-boot-legacy-pull.js' },
  { g: 'CRM/پیشنهاد (38.18): ORPHAN-ARCHIVED-DISPLAY — گزارش کارفرما: «پیشنهادهای متصل به پروندهٔ بایگانی‌شده در کادر بالای رکوردهای پیشنهاد به‌صورت یافته نمایش داده می‌شوند، درحالی‌که یافته محسوب نمی‌شوند». چنین پیشنهادی دیگر در جاروی یکپارچگی/مهاجرت سرور هیچ یافته‌ای (نه بحرانی، نه اطلاعی) نمی‌سازد و از کادر بالای فهرست پیشنهادها و باکس فروش تا وصول حذف شد؛ تشخیص پیوند بایگانی فقط orphan_wonِ بحرانیِ کاذب را سرکوب می‌کند و یتیمِ واقعی (بدون پرونده/بایگانیِ قابل‌اثبات یا هویت متفاوت) همچنان بحرانی گزارش می‌شود (قرارداد v34.38.17 بازنشسته شد)', f: '_tools/uat/tester626-v34.38.18-orphan-archived-not-finding.js' },
  { g: 'CRM/ورود (38.19): SILENT-LOGIN + AUTO-MIGRATE-001 + LIQUID-RING — درخواست کارفرما: هشدارهای زمان ورود (نوار زرد تغییرات معلق + نوار سفید یادآور انتقال) دیگر در ورود/رفرش نمایش داده نمی‌شوند؛ «انتقال یک‌باره و همگرایی با سرور» بدون زدن دکمه‌ای، خودکار و بی‌صدا داخل همان پردهٔ بوت انجام می‌شود (گاردهای داده‌ای مهاجرت دست‌نخورده: ACK تک‌کلید، نشانگر فقط پس از تأیید، نجات تعارض با نسخهٔ سرور)؛ حلقهٔ پردهٔ بوت به «مایعِ جاذبه‌دار» (Canvas، مدل انرژی v∝√(۱+k·cosθ)، فرود سریع‌تر/بازتر و صعود کُندتر/کم‌حجم‌تر) و لوگوی کاملِ بدون متن PTF داخل دایره ارتقا یافت؛ reduced-motion فریم ایستا و نبود Canvas حلقهٔ CSS fallback است', f: '_tools/uat/tester627-v34.38.19-silent-login-automigrate-liquid-ring.js' },
  { g: 'CRM/مالی (38.19): SH-SALARY-CASH-OUTFLOW — گزارش کارفرما: «حقوقِ پرداخت‌شده در موجودی نقد پایان سال نمی‌آید و کارت حقوق همچنان بدون خروج نقدی نشان می‌دهد». پرداخت واقعی حقوق (draw با paymentFor/salaryMonth) از ستون «مانده قابل تسویهٔ امسال» خارج شد (B1) و به‌عنوان خروج نقدی دوره در outflowsTotal/cashEnd شمرده می‌شود (B2) + تفکیک «حقوق پرداخت‌شده/پرداخت‌نشده» در KPI/گزارش/CSV (B3) بدون تغییر فرمول netProfit', f: '_tools/uat/tester628-v34.38.19-shareholder-salary-cash-outflow.js' },
  { g: 'CRM/مالی (38.19): OPEX-DUP-GUARD گام‌۳/۴/۵ + SH-SALARY-MONTH-GAP — بستن دو شکاف گزارش‌شده: «یکی ۲ ماه حقوق، دو تای دیگر ۳ ماه» → آشکارساز read-only ماه‌های غایب/تکراری حقوق سهامدار موظف (ptfShareholderSalaryGaps با احترام به eligibilitySince) + نمایش در کیفیت داده؛ «حقوق پرسنل تکرارشونده → دو بار خروج خزانه» → گاردهای write-time: ساخت/ویرایش قالب در برابر ردیف دستی/تنخواه، ثبت دستی در برابر تنخواه، تسویهٔ تک‌منبعی، اعلان قالب ثبت‌نشده. همه فقط تأیید انسانی (بدون ادغام/void خودکار)', f: '_tools/uat/tester629-v34.38.19-opex-dup-guards-salary-gap.js' },
  { g: 'CRM/مالی (38.19): SF-INVOICE-REVERT — «فاکتور تأمین کم شد؛ ویرایش کردم درست شد ولی دوباره برگشت»: merge در sync.js برندهٔ رکورد ptf_crm_supplier_finance را با مقایسهٔ رشته‌ای خامِ updatedAtISO (میلادی) با t (شمسی) انتخاب می‌کرد و ارقام فارسی یونیکد بزرگ‌تری دارند، پس نسخهٔ کهنهٔ فقط-t برنده می‌شد و مبلغ قدیمی دوباره push می‌شد؛ حالا مقایسه روی sfComparableTs نرمال‌شده است + پرچم ماندگار manualAmountEdit در slInvoiceEdit تا slImportRealPurchase مبلغ دستی فاکتور/پرداخت را به price×qty برنگرداند (متادیتا همچنان به‌روز می‌شود)', f: '_tools/uat/tester630-v34.38.19-supplier-invoice-revert.js' },
  { g: 'CRM/مالی (38.19): F-3 SERVER-OPEX-DUP-CROSSCHECK — هاب مالی (ارزیابی ۱۴۰۵/۰۶/۱۰): در reconcile_recurring_opex سرور، پیش از متریالایز قالب، ردیفِ دستیِ فعالِ هم‌دسته/هم‌مبلغ و تنخواهِ هم‌مبلغ/هم‌ماهِ همان دوره در possibleDuplicates برمی‌گردد؛ فقط هشدار و تعیین‌تکلیف انسانی (بدون void/ادغام خودکار)', f: '_tools/uat/tester631-v34.38.19-f3-server-opex-dup-crosscheck.js' },
  { g: 'CRM/مالی (38.19): F-4 ELIGIBILITY-BACKFILL — هاب مالی: eligibilitySince فقط هنگام فعال‌شدن موظفی ثبت می‌شود و مبنای جبران کنترل‌شدهٔ ماه‌های غایب حقوق است؛ فرمان سروری backfill_shareholder_salaries فقط ساخت idempotent (دلیل صریح الزامی، ردِ ماهِ سال قفل‌شده، عدم بازسازی هویت موجود/سنگ‌قبر، بدون void) و ثبت در corrections', f: '_tools/uat/tester632-v34.38.19-f4-eligibility-backfill.js' },
  { g: 'CRM/مالی (38.19): SH-SALARY-OFFICIAL-PROPAGATION — گزارش کارفرما: «تب کیفیت داده حقوق سهامدار را بدون نوع رسمی/غیررسمی نشان می‌دهد ولی بعد از تعیین هم از بین نمی‌رود»: reconcile_shareholder_salaries فقط ردیفِ ماهِ جاری را isOfficial می‌کرد و ماه‌های قبلی unclassified می‌ماندند؛ حالا هنگام reconcile صریح سهامدار، isOfficial روی همهٔ ماه‌های فعالِ حقوقِ همان سهامدار منتشر می‌شود (ماهِ سال قفل‌شده رد) + fallback فقط‌خواندنی در کیفیت داده که نوع سند را از پروفایل سهامدار می‌خواند — بدون void/ادغام', f: '_tools/uat/tester633-v34.38.19-salary-official-propagation.js' },
  { g: 'CRM/مالی (38.19): SH-SALARY-ANCHOR — باگ «جبران حقوق برای یک سهامدار به‌جای ۳ ماه، ۴ ماه ساخت»: مبدأ احراز (eligibilitySince) بی‌صدا از ماهِ انتخابی پنل پر می‌شد؛ حالا در فرم سهامدار صریح و قابل اصلاح است (نرمال‌سازی + اعتبارسنجی YYYY/MM) و جبرانِ سروری ماهِ شروع را نرمال می‌کند تا ردیف‌های legacy با ماه غیرکانونیک («۱۴۰۵/۴»/«1405-06») «موجود» شمرده شوند و دوباره ساخته نشوند — قرارداد جبران (فقط ساخت idempotent، بدون void، رد قفل) دست‌نخورده است', f: '_tools/uat/tester641-v34.38.19-shareholder-salary-anchor.js' },
  { g: 'CRM/مالی (38.19): INV-OPEN-CANONICAL — «فاکتور تسویه‌شده در مطالبات تسویه‌شده نشان می‌دهد ولی در فاکتورها مطالبهٔ باز دارد»: پنل فاکتورها (openIrr) و ستون «مطالبه باز» جدول فاکتورهای پرونده مانده را با فرمول خصوصی (openAmountIRR یا amount−allocatedBase−allocatedVat) می‌گرفتند و وصولی میراثی/مرجوعی/بازسازی محلی FIFO را نادیده می‌گرفتند؛ حالا از منبع واحد PTF.ar.invoiceState می‌خوانند (فرمول قدیم فقط fallback وقتی PTF.ar در دسترس نباشد) — رفتاری با اجرای تابع واقعی openIrr روی موتور واقعی AR', f: '_tools/uat/tester642-v34.38.19-invoice-open-canonical.js' },
  { g: 'CRM/مالی (38.20): INV-ARCHIVED-SETTLED — «فاکتور تسویه‌شده‌ای که پروندهٔ فروش مرتبطش مختومه/بایگانی شده در بخش فاکتورها به‌عنوان پروندهٔ فروش ثبت‌نشده نشان داده می‌شود»: findCaseForOffer فقط ptf_crm_dealsِ فعال را می‌دید و پروندهٔ بایگانی‌شده (ptf_crm_projects: state=archived/origin=salesfile) را «یافت نشد» می‌شمرد؛ حالا فاکتورِ تسویه‌شده با پروندهٔ مختومه به بخش جداگانهٔ «فاکتورهای تسویه‌شده با پروندهٔ مختومه» منتقل می‌شود و ردیف «📁 پرونده مختومه شده است» می‌گوید؛ پروندهٔ مختومهٔ غیرِ تسویه‌شده هم «یافت نشد» نمی‌گیرد و پروندهٔ فعال/بدون‌پرونده رفتار قبلی را حفظ می‌کند — صرفاً نمایش، بدون نوشتن', f: '_tools/uat/tester643-v34.38.20-invoice-archived-settled.js' },
  { g: 'CRM/مالی (38.20): SHARE-TX-MANUAL-VOID + SHARE-SALARY-DEDUPE — گزارش کارفرما: «حقوق یک سهامدار دو بار در یک ماه ثبت شده؛ خودکار درست نشده و راهکار اصلاح دستی هم وجود ندارد». ریشهٔ «خودکار درست نشد»: reconcile فقط ماهِ پنل/جاری را پاک می‌کرد. حالا دو اهرم اصلاح دستیِ سروری (نه ویرایش آزاد مبلغ): ① void_shareholder_tx — ابطال تکیِ یک ردیف گردش با cd + دلیل صریح؛ برای salary هزینهٔ OPEXِ پیوندخورده (shareTx) هم بسته می‌شود (ماه قفل رد، corrections ثبت) و دکمهٔ «ابطال» در دیالوگ گردش؛ ② dedupe_shareholder_salaries — همهٔ ماه‌های یک سهامدار را می‌پیماید و ماه‌های دارای بیش از یک ردیف active حقوق را به یک ردیف می‌رساند (void اضافه‌ها + هزینهٔ پیوندخورده، ماه قفل دست‌نخورده) با دکمهٔ «رفع تکراری» روی کارت سهامدار', f: '_tools/uat/tester644-v34.38.20-shareholder-tx-void-dedupe.js' },
  { g: 'سایت/SEO (38.19): GSC-SITEENTRY-FIX — «آزمون اتصال GSC با وجودِ تنظیمات درست همیشه خالی است»: پاسخِ webmasters/v3/sites فهرست را زیر کلید «siteEntry» برمی‌گرداند (نه «site»)؛ خواندنِ کلیدِ نادرست از v34.12.0 فهرستِ قابل‌دسترسی را همیشه [] می‌کرد و property_not_found کاذب می‌داد؛ حالا gsc_pick_site از «siteEntry» می‌خواند و قرارداد خروجی {siteUrl, permissionLevel} دست‌نخورده است', f: '_tools/uat/tester634-v34.38.19-gsc-siteentry-field.js' },
  { g: 'سایت/SEO (38.19): GSC-CONTENT-LENGTH-FIX — «وصل است ولی ثبت نقشه ناموفق: api_error_411 (Length Required)»: curl درخواستِ PUTِ ثبت نقشه (که بدنه نباید داشته باشد) را بدون هدر Content-Length می‌فرستاد و گوگل 411 برمی‌گرداند؛ حالا gsc_api برای PUT/DELETEِ بدونِ payload صریحاً «Content-Length: 0» می‌فرستد و مسیرهای GET و POST-with-body (searchAnalytics/urlInspection) دست‌نخورده می‌مانند', f: '_tools/uat/tester635-v34.38.19-gsc-content-length-411.js' },
  { g: 'سایت/SEO (38.19): SITEMAP-SYNC — «سیستمی که صفحات خارج از نقشه را شناسایی، نقشه را اصلاح و ثبت کند»: sitemap_drift با نگاشتِ کانونیکال (index.html → URL پوشه) روح/خارج-از-نقشه را درست تشخیص می‌دهد؛ اکشن sitemap_sync صفحاتِ ایندکس‌پذیرِ خارج از نقشه را اضافه و «روح» را فقط با تأیید انسانی (remove_ghosts=1) حذف و در cms_log ثبت می‌کند؛ UI با دکمهٔ «همگام‌سازی و ثبت در گوگل» زنجیرهٔ اصلاح→ثبت را یک‌کلیکی می‌کند و نقشهٔ فعلی همگام است', f: '_tools/uat/tester636-v34.38.19-sitemap-sync.js' },
  { g: 'سایت/SEO (38.19): INDEX-TRACKER — «سیستمی که صفحات را یک‌بار بررسی کند، ایندکس/غیرایندکس را نشان دهد و در دفعات بعد فقط ایندکس‌نشده‌ها + جدید را چک کند و ایندکس‌شده‌ها را کنار بگذارد»: اکشن index_tracker فهرستِ فایل‌های ایندکس‌پذیر را (نه فقط نقشه) می‌گیرد، وضعیت را در gsc-index-tracker.json ماندگار می‌کند، «ایندکس‌شده» را فقط با coverageState شروع‌شونده با «Indexed» می‌شناسد (PASS تنها کافی نیست)، در هر اجرا فقط غیرِ indexed را با URL Inspection می‌پرسد (سقف ۱۰۰/دسته، silent در برابر خطای تک‌صفحه)، صفحاتِ حذف‌شده را از ردیاب کنار می‌گذارد، و UI دکمه‌های بررسی دسته/اجرا تا اتمام/شروع مجدد دارد', f: '_tools/uat/tester637-v34.38.19-index-tracker.js' },
  { g: 'سایت/SEO (38.19): PRODUCT-NO-PRICE-FIX — «1 invalid item detected هنگام Request Indexing صفحهٔ دیسپلیسر»: اسکیمای Product بدونِ offers(price)/review/aggregateRating از نظر گوگل invalid است؛ صفحاتِ تأمین/RFQ بدونِ قیمتِ واقعی به تایپ «Service» تبدیل شدند (جعلِ قیمت ممنوع)، ۸۴ صفحهٔ محصول اصلاح شد، مولدهای پایتون و PHP تایپ شرطی (با قیمت Product، بدون قیمت Service) می‌سازند و هیچ صفحهٔ عمومی Productِ بدونِ قیمت ندارد', f: '_tools/uat/tester638-v34.38.19-product-schema-no-price.js' },
  { g: 'سایت/SEO (38.19): SEO-QUICK-WINS-L1 — «بردهای سریع سطح ۱»: عنوان/H1/توضیح صفحهٔ دیسپلیسر با کوئری واقعی GSC («لول ترانسمیتر دیسپلیسر» به‌جای فقط «ترانسمیتر سطح») تطبیق یافت و هر دو عبارت حفظ شد؛ صفحهٔ اصلی به سه صفحهٔ هدفِ بدونِ لینکِ ریشه لینک داخلی گرفت (ترانسمیتر فشار روزمونت 3051، لول ترانسمیتر دیسپلیسری، کنترل ولو بخار) داخل کارت ابزار دقیق — قرارداد Service/Breadcrumb/FAQ tester638 دست‌نخورده است', f: '_tools/uat/tester639-v34.38.19-seo-quick-wins-l1.js' },
  { g: 'سایت/SEO (38.19): SEO-QUICK-WINS-L2 — «سطح ۲: ۸ کوئری تجاری با جایگاه ۵۴–۹۸»: عنوان/H1 با کوئری واقعی تطبیق یافت (لوله X42 لاتین، قیمت لوله A106، نمایندگی روزمونت، زنجیره تامین پمپ و قطعات یدکی)؛ لینک داخلی به صفحات کم‌لینک از صفحات هم‌بافت (انبار قطعات یدکی ↔ حمل/پمپ، فلنج اراک از تامین‌کننده فلنج، نمایندگی روزمونت از ابزار دقیق) اضافه شد و JSON-LD همه سالم ماند', f: '_tools/uat/tester640-v34.38.19-seo-quick-wins-l2.js' },
  { g: 'سایت/SEO (38.19): SEO-P1-MONEY-PAGES — تکمیلِ P1 رودمپ ۰۹-۰۲ برای دو صفحهٔ پول‌ساز «تامین تجهیزات پایپینگ» و «تامین تجهیزات ابزار دقیق»: اولین <h2> کلمهٔ دقیق گرفت (قبلاً «تجهیزات» جا افتاده بود)، کلمهٔ دقیق در ۱۰۰ کلمهٔ اولِ متن مقاله تثبیت شد، و یک جدول مشخصات فنی واقعی (استاندارد/متریال/سایز) به هر صفحه اضافه شد (تمایز نسبت به رقبای صفحهٔ اول)؛ قراردادهای قبلی (عنوان دقیق، توضیح متا، FAQ≥۳، اسکیمای Service/Product/OfferCatalog، کانونیکال خود، robots index، نقشه، JSON-LD سالم) دست‌نخورده و P2 (لینک ورودی ≥۳۰) قفل شد', f: '_tools/uat/tester645-v34.38.20-seo-p1-money-pages.js' },
  { g: 'سایت/SEO (38.19): SEO-P3-CLUSTER-ARTICLES — خوشهٔ محتوایی پشتیبانِ P3 رودمپ ۰۹-۰۲: ۱۰ مقالهٔ جدید مرکز دانش (۵ پایپینگ: کلاس فشاری فلنج ۱۵۰–۶۰۰، تفاوت ERW/SAW/LSAW، تست هیدرواستاتیک، لوله A335 P11/P22/P91، انتخاب گسکت اسپیرال واند/RTJ + ۵ ابزار دقیق: کالیبراسیون فلومتر، نصب و ارت مگمتر، تفاوت DCS و PLC، ترانسمیتر DP، پوزیشنر شیر کنترل) با مولد استاندارد ساخته شد؛ قرارداد محتوا هر مقاله ≥۲ لینک به صفحهٔ پول‌سازِ خوشه، متن یکتای ≥۵۰۰ کاراکتر، عنوان ≤۶۸، توضیح ۱۲۰–۱۷۵، کانونیکال خود، robots index، اسکیمای Article+Breadcrumb+FAQ(≥۳)، تصویر موجود و ثبت در سایت‌مپ', f: '_tools/uat/tester646-v34.38.20-seo-p3-cluster-articles.js' },
  { g: 'سایت/SEO (38.19): SEO-WEEKLY-WATCHLIST — «گیت پیشرفت هفتگی» گام E رودمپ ۰۹-۰۲: ابزار _tools/seo_weekly_watchlist.py دو کلمهٔ پول‌ساز + کوئری‌های «صفحهٔ ۱.۵» را از تازه‌ترین اسنپ‌شات GSC می‌خواند، روند را در _audit/SEO-WATCHLIST.json (ناپذیر-تکرار: اجرای دوبارهٔ همان روز سطر را به‌روز می‌کند) نگه می‌دارد و گزارش هفتگی markdown + «فرمان هفته» (منطق گام E) می‌سازد؛ کلمهٔ غایب از اسنپ‌شات = خارج از ۱۰۰ نتیجه', f: '_tools/uat/tester647-v34.38.20-seo-weekly-watchlist.js' },
  { g: 'سایت/SEO (38.20): SEO-CRAWL-HYGIENE — بهداشتِ کراول از خروجی کراولر بیرونی: سه صفحهٔ orphan واقعی (دو پست وبلاگ EPC/پایپینگ + راهنمای ترانسمیترها) لینکِ ورودیِ استاتیک گرفتند، ۱۴ عنوان بلند (>۶۵) و ۱۲ توضیح بلند (>۱۶۵) کوتاه شدند، en/careers.html دادهٔ ساختاریافتهٔ Organization+BreadcrumbList+WebPage گرفت، و ۵ صفحهٔ کم‌حجمِ واقعی (گواهینامه‌ها، فرصت شغلی، هاب مقایسه‌ها، خدمات انگلیسی، چک‌لیست RFQ) بالای ۳۵۰ واژه غنی شدند؛ استاب‌های ریدایرکتِ noindex مستثنا و قفل‌شده باقی می‌مانند (عمدی)', f: '_tools/uat/tester648-v34.38.20-seo-crawl-hygiene.js' },
  { g: 'سایت/SEO (38.20): KC-STRUCTURE-HYGIENE — پاک‌سازیِ ساختار مرکز دانش: ممیزی ۴۶۳ مقاله نشان داد ۵۹ مقالهٔ ایندکس‌پذیر «الگویی» بودند (مقدمهٔ قالبی + بخش‌های بایت‌به‌بایت تکراری). اصلاح سه‌دسته: ۶ صفحهٔ ترکیبی → حذف بخشِ الگویی و حفظ محتوای واقعی، ۲۵ صفحهٔ کاملاً الگویی → بازنویسی با محتوای تخصصیِ یکتا، و ۲۸ صفحهٔ دارای خواهرِ غنی → بازنویسی با محتوای مستقلِ متمایز (نه تجمیع). قفل: هیچ مقالهٔ ایندکس‌پذیرِ KC بخشِ الگویی ندارد؛ هر ۵۹ صفحه ایندکس‌پذیر، canonical خود، ≥۵۰۰ واژه و در سایت‌مپ', f: '_tools/uat/tester649-v34.38.20-kc-structure-hygiene.js' },
  { g: 'سایت/SEO (38.20): GSC-ONBOARD — ابزار راه‌انداز اتصال Search Console (_tools/gsc_onboard.py): تولیدِ api/gsc-config.php از JSON کلیدِ سرویس‌اکانت (بدون کپی دستی، escape درست PHP)، راستی‌آزمایی PEM با openssl پیش از نوشتن، اعتبارسنجی پیش از آپلود (--check) و راهنمای گام‌به‌گام (--guide)؛ gitignore شدنِ gsc-config.php و هم‌راستایی با api/gsc.php (status/selftest/sitemap_submit/index_tracker) قفل می‌شود', f: '_tools/uat/tester650-v34.38.20-gsc-onboard.js' },
  { g: 'سایت/SEO (38.20): SEO-WATCHLIST-LIVE — حالت زندهٔ واچ‌لیست هفتگی: _tools/seo_weekly_watchlist.py --live همان داده‌ای را که پنل CRM نشان می‌دهد مستقیم از api/gsc.php (action=overview با هدر X-CRM-Token) می‌گیرد و دیگر اکسپورت CSV لازم نیست؛ توکن نشست از --token/PTF_CRM_TOKEN/_tools/.ptf-crm-token خوانده می‌شود و هیچ اسنپ‌شات CSV جدیدی نوشته نمی‌شود (آرشیو _audit و قرارداد tester647 دست‌نخورده)', f: '_tools/uat/tester651-v34.38.20-seo-watchlist-live.js' }
];

var SYNTAX = [
  'crm/bridge.js', 'crm/myday.js', 'crm/rbac.js', 'crm/sync.js', 'crm/client-server.js',
  'crm/boot-splash.js',
  'crm/finance-write-guard.js', 'crm/fiscal.js', 'crm/supplier-finance.js',
  'crm/opex.js', 'crm/shareholders.js', 'crm/cheque-panel.js', 'crm/petty.js', 'crm/cheques.js', 'crm/treasury.js',
  'crm/sales-domain-v2.js', 'crm/phonefmt.js', 'crm/official-invoice-v2.js', 'crm/ar-reconcile.js', 'crm/case-revision.js', 'crm/surplus.js',
  'crm/metrics-shared.js', 'crm/analyzer.js', 'crm/management-intelligence.js',
  'crm/customer-finance.js', 'crm/finance-helpers.js', 'crm/insights.js', 'crm/cheque-module.js', 'crm/data-quality.js',
  'crm/unofficial-invoice.js', 'crm/commission.js', 'crm/working-capital.js', 'crm/fx.js',
  'crm/salesfiles.js', 'crm/inqreader.js', 'crm/rfqsmart.js', 'crm/user-guide.js', 'crm/careers.js',
  'crm/buycompare.js', 'crm/letters.js', 'crm/offers.js', 'crm/offers-pro.js',
  'crm/contracts.js', 'crm/docsx.js', 'crm/bridge.js', 'crm/offerlock.js', 'crm/custmerge.js',
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
