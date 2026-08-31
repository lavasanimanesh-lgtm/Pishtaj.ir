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
  'crm/opex.js', 'crm/shareholders.js', 'crm/cheque-panel.js', 'crm/petty.js', 'crm/cheques.js', 'crm/treasury.js',
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
