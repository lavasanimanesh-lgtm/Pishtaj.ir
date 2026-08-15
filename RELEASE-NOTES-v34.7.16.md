# Release Notes v34.7.16 — گیت هویت ادغام پرونده تکراری پیش از commit + پول پیش از plan

تاریخ: ۱۴۰۵/۰۵/۲۵ (2026-08-16)

## زمینه

در v34.7.15 دو عامل شکست ادغام (حساسیت `planHash` به ترتیب کلید و `rootOfferId` کهنه) رفع شد. این نسخه روی «قابل‌فهم‌شدن شکست» تمرکز دارد: کاربر نباید فقط هنگام زدن دکمهٔ ادغام با `case_identity_conflict` روبرو شود؛ سیستم باید از قبل روشن کند که چرا دو پرونده قابل ادغام خودکار نیستند، و دادهٔ محلی قبل از پیش‌بررسی با سرور هم‌راستا شود.

## اصلاح

- `api/sales-domain.php`
  - تابع `sd_case_identity_conflict($a,$b)` اضافه شد: تعارض هویت `inqNo`/`buyerCd`/`currency` را برمی‌گرداند و وقتی `buyerCd` هر دو خالی است به `buyerCo` fallback می‌کند (هماهنگ با `sd_case_offer_linked`) تا دو مشتریِ متفاوت که فقط با نام ثبت شده‌اند از ادغام اشتباه مصون بمانند.
  - گارد commit (`duplicate_case_merge`) از همین تابع استفاده می‌کند — به‌جای foreach inline — تا رفتار commit و تشخیصِ پیش‌رندر کاملاً یکسان باشند.
  - خروجی `duplicate_case_plan` اکنون `mergeable` و `conflictField` دارد؛ mergeability برای همهٔ جفت‌های candidate از پیش محاسبه می‌شود.
- `crm/sales-domain-v2.js`
  - وقتی سرور در plan اعلام کند `mergeable === false`، دکمهٔ ادغام **پیش از commit** مسدود می‌شود و پیام صریحِ فیلد ناسازگار (درخواست/کد مشتری/نام مشتری/ارز) نمایش داده می‌شود (`ptfDuplicateCaseMergeBlocked`).
  - گارد دفاعی در `ptfDuplicateCaseMergeCommit`: اگر دکمه disabled بود، commit صادر نمی‌شود (لایهٔ دوم؛ گارد سرور همچنان fail-closed است).
  - پیش از فراخوانی `duplicate_case_plan`، یک pull فقط‌خواندنی (`ptfSyncPullNow`) زده می‌شود تا یافته/کش محلی با دادهٔ سرور هم‌راستا شود؛ اگر sync در دسترس نباشد، plan مستقیم باز می‌شود.

## چرا این تغییر «بدون آسیب» است

- مسیر نوشتن ادغام (ادغام شواهد، انتقال ارجاعات، بازسازی FIFO، snapshot/تصحیح، finding resolved) دست‌نخورده است.
- گارد هویت commit نه‌تنها شل نشده، بلکه با fallback `buyerCo` سازگارتر و در تشخیصِ پیش‌رندر با commit یکسان شده است؛ همچنان fail-closed.
- pull پیش از plan فقط‌خواندنی است و بدترین حالت آن یک رندر مجدد است.

## تست رگرسیون

- `_tools/uat/tester419-v34.7.16-duplicate-case-identity-gate.js`: 14 PASS / 0 FAIL
  1. وجود `sd_case_identity_conflict` و استفاده در commit.
  2. خروجی `mergeable`/`conflictField` در plan و بررسی همهٔ جفت‌ها.
  3. وجود handler مسدودسازی و گارد دکمهٔ disabled در commit.
  4. pull پیش از plan و مسیر fallback بدون sync.
  5. رفتار: دو پرونده با ارز متفاوت → دکمه مسدود و پیام «ارز» نمایش داده می‌شود.
- رگرسیون قبلی بدون شکست (assertion هویت در tester412 با شکل refactor‌شده هماهنگ شد — رفتار fail-closed حفظ است):
  - `tester412-v34.7.7-guided-case-dedup.js`: 20 PASS / 0 FAIL
  - `tester417-v34.7.14-duplicate-case-projection-cache.js`: PASS
  - `tester418-v34.7.15-duplicate-case-planhash-fallback.js`: 11 PASS / 0 FAIL

## کنترل کیفیت

- `node --check` روی فایل‌های JS بدون خطا.
- شمارهٔ نسخه به `v34.7.16` افزایش یافت (VERSION.json، manifest.json، sw.js، clear-cache.html، shell.js و cache-bust تمام اسکریپت‌ها).
- PHP CLI در محیط محلی موجود نیست؛ syntax با بازبینی دستی و تسترهای منبع‌محور بررسی شد.
