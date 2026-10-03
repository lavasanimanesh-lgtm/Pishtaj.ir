#!/usr/bin/env node
'use strict';
/* tester689 — v34.39.49 (GSC-REPORT-DATA-INTEGRITY)
   جلوگیری از دو خطای تفسیری در گزارش سئو:
   ۱) جمع ردیف‌های Query به‌جای KPI تجمیعی کل GSC استفاده می‌شد؛ این دو بُعد به‌علت
      حذف Queryهای ناشناس الزاماً برابر نیستند.
   ۲) URLهای «جدید/بازرسی‌نشده» به‌عنوان ایندکس‌نشده و سهم برند به‌عنوان سهم کل کلیک‌ها
      تفسیر می‌شدند. این تست، قرارداد تفکیک داده و زبانِ صادقانهٔ گزارش را قفل می‌کند. */
var fs = require('fs');
var assert = require('assert');
var php = fs.readFileSync('api/gsc.php', 'utf8');
var llm = fs.readFileSync('api/llm.php', 'utf8');
var gsc = fs.readFileSync('crm/gsc.js', 'utf8');

console.log('── GSC report denominator + index tracker semantics (v34.39.49) ──');

/* KPIهای تجمیعی از بُعد date و جمعِ query rows به‌صورت مستقل محاسبه شوند. */
assert.ok(php.indexOf("$d = gsc_query_range($cfg, ['date'], $start, $end, 400)") > -1,
  'گزارش KPI از ردیف‌های تاریخِ دورهٔ جاری را دارد');
assert.ok(php.indexOf("$pd = gsc_query_range($cfg, ['date'], $prevStart, $prevEnd, 400, true)") > -1,
  'دورهٔ مقایسه هم از همان بُعد date دریافت می‌شود');
assert.ok(php.indexOf('$tQueryCur = gsc_ai_totals($rowsQ)') > -1 && php.indexOf('$tSiteCur = gsc_ai_totals($rowsD)') > -1,
  'جمع Queryهای قابل‌مشاهده از KPI تجمیعی GSC جداست');
assert.ok(php.indexOf("'clicks' => round($tSiteCur['clicks'])") > -1 && php.indexOf("'clicks' => round($tQueryCur['clicks'])") > -1 &&
  php.indexOf("'count' => count($qMapCur)") > -1,
  'پاسخ JSON KPI کل را از مخرج و شمار Queryهای قابل‌مشاهده جدا نگه می‌دارد');
var aiStart = php.indexOf("case 'ai_report':");
var aiReport = aiStart > -1 ? php.slice(aiStart) : '';
var aiTotalsStart = aiReport.indexOf("'totals' => [");
var aiVisibleStart = aiReport.indexOf("'visible_queries' => [", aiTotalsStart);
var aiTotalsBlock = aiTotalsStart > -1 && aiVisibleStart > aiTotalsStart ? aiReport.slice(aiTotalsStart, aiVisibleStart) : '';
assert.ok(aiTotalsBlock && aiTotalsBlock.indexOf('brand_clicks') === -1 && aiTotalsBlock.indexOf('nonbrand_clicks') === -1 && aiTotalsBlock.indexOf("'queries'") === -1,
  'شیء totals فقط aggregate کل را دارد؛ برند و Query count در مخرج جدا می‌مانند');
var overviewStart = php.indexOf("case 'overview':");
var overviewEnd = php.indexOf("case 'ai_report':", overviewStart);
var overview = overviewStart > -1 && overviewEnd > overviewStart ? php.slice(overviewStart, overviewEnd) : '';
assert.ok(overview.indexOf("$siteTotals = gsc_ai_totals(array_map('gsc_ai_row', $d['rows'] ?? []))") > -1 &&
  overview.indexOf("'clicks' => round($siteTotals['clicks'])") > -1 && overview.indexOf("'visible_queries' => [") > -1,
  'کارت‌ها و API اصلی GSC هم aggregate روزانه را از Queryهای قابل‌مشاهده جدا می‌کنند');
assert.ok(overview.indexOf("(int)($c['v'] ?? 0) >= 2") > -1,
  'کش overview قدیمیِ دارای مخرج Query بعد از تغییر قرارداد دوباره استفاده نمی‌شود');
assert.ok(/\$brandShareClicks = \$tQueryCur\['clicks'\] > 0 \? round\(\$brand\['clicks'\] \/ \$tQueryCur\['clicks'\] \* 100, 1\)/.test(php),
  'سهم برند فقط نسبت به کلیک‌های queryهای قابل‌مشاهده محاسبه می‌شود');
assert.ok(php.indexOf('اختلافِ غیرقابل‌انتساب به ردیف Query') > -1 && php.indexOf('اختلاف را به برند یا غیربرند نسبت ندهید') > -1,
  'باقی‌ماندهٔ query به برند/غیربرند نسبت داده نمی‌شود');

/* پوششِ عملکردِ sitemap نباید با وضعیتِ ایندکس اشتباه شود؛ page limit از sitemap بزرگ‌تر است. */
assert.ok(php.indexOf("gsc_query_range($cfg, ['page'], $start, $end, 1000)") > -1,
  'دریافت page rows برای sitemap بیش از 500 URL محدود نمی‌شود');
assert.ok(php.indexOf('isset($sitemapSet[$key])') > -1 && php.indexOf('صفحاتِ دارای impression بیرون از sitemap') > -1,
  'URLهای دارای impression با sitemap تطبیق داده می‌شوند');
assert.ok(php.indexOf('«بدون داده» یعنی بی‌نمایش در این بازه، نه ایندکس‌نشده') > -1,
  'بدون دادهٔ Performance صریحاً معادلِ ایندکس‌نشده نیست');
assert.ok(php.indexOf("'metricVersion' => 2") > -1 && php.indexOf("'legacy_snaps_excluded' => $legacySnaps") > -1 &&
  gsc.indexOf('اسنپ‌شات‌های قدیمی به‌دلیل نداشتن جمع تجمیعی GSC') > -1,
  'اسنپ‌شات‌های قدیمی با مخرج نامعتبر وارد روند جدید نمی‌شوند و حذف‌شدنشان به کاربر گفته می‌شود');

/* new=بدون بازرسی؛ pending=بدون تأیید Indexed؛ batch=0 نباید زمانِ inspection بسازد. */
assert.ok(php.indexOf("$trackerMeta['lastInspectionAt'] = date('c')") > -1 && php.indexOf('if ($checked > 0)') > -1,
  'فقط اجرای واقعی URL Inspection زمان lastInspectionAt را ثبت می‌کند');
assert.ok(php.indexOf("$trk['checked'] = $trk['indexed'] + $trk['pending']") > -1 && php.indexOf(' جدید/بررسی‌نشده') > -1,
  'گزارش وضعیت‌های بررسی‌شده و بررسی‌نشده را جدا می‌کند');
assert.ok(php.indexOf('صفرِ تأییدشده در ردیاب به معنی صفرِ ایندکس گوگل نیست') > -1,
  'صفرِ tracker به‌عنوان deindex کل سایت گزارش نمی‌شود');

/* دستورهای AI باید مانع ساخت یافتهٔ بحرانی از denominator نامعتبر شوند. */
assert.ok(llm.indexOf('branded share applies only to visible-query clicks') > -1,
  'LLM denominator سهم برند را درست تفسیر می‌کند');
assert.ok(llm.indexOf('zero tracker confirmations does NOT mean zero URLs are indexed') > -1,
  'LLM صفر tracker را با صفر ایندکس اشتباه نمی‌گیرد');
assert.ok(llm.indexOf('not an official Google metric') > -1,
  'health_score به‌عنوان معیار رسمی Google جا زده نمی‌شود');

/* رابط ردیاب هم باید پیشرفت بازرسی را نشان دهد، نه نسبت ایندکس به کل URLهای بازرسی‌نشده. */
var trackerUi = gsc.slice(gsc.indexOf('window.gscIndexTrackerRender'), gsc.indexOf('window.gscIndexTrackerLoad'));
assert.ok(trackerUi.indexOf('d.checked_successfully') > -1 && trackerUi.indexOf('بازرسی موفق شده‌اند') > -1,
  'نوار پیشرفت بر اساس بازرسی موفق است، نه صفر/تعداد کل ایندکس');
assert.ok(trackerUi.indexOf('d.not_indexed') === -1 && trackerUi.indexOf('جدید (URL Inspection نشده)') > -1 && trackerUi.indexOf('بدون تأیید Indexed') > -1,
  'UI وضعیت جدید و بازرسی‌شده را با «ایندکس‌نشده» یکی نمی‌گیرد');
assert.ok(gsc.indexOf('q.brand_clicks') > -1 && gsc.indexOf('var brandShare = visibleClicks ? (brandClicks / visibleClicks) : null') > -1 &&
  gsc.indexOf('سهم برند در Queryهای قابل‌مشاهده') > -1 && gsc.indexOf("apiV2 ? 'کل GSC'") > -1,
  'کارت‌های پنل کل GSC را از سهم برند در Queryهای دیده‌شده جدا می‌کنند');
assert.ok(gsc.indexOf('معیار رسمی Google نیست') > -1 && gsc.indexOf('خودِ گزارش URL Inspection اجرا نمی‌کند') > -1,
  'گزارش AI غیررسمی‌بودن امتیاز و مصرف‌نشدن Inspection توسط خود گزارش را روشن می‌کند');

/* sanity fixture: اعداد همین گزارش؛ 99.2٪ فقط در query rows، نه در کل کلیک‌ها. */
var allClicks = 443, visibleQueryClicks = 132, brandClicks = 131;
assert.strictEqual(Math.round((brandClicks / visibleQueryClicks) * 1000) / 10, 99.2);
assert.strictEqual(Math.round((visibleQueryClicks / allClicks) * 1000) / 10, 29.8);

console.log('PASS tester689 v34.39.49 GSC report data integrity');
