# Release Notes v34.7.14 — تثبیت نهایی ادغام پرونده تکراری در کش سرورمحور

تاریخ: ۱۴۰۵/۰۵/۲۵ (2026-08-16)

## مشکل باقیمانده پس از v34.7.13

فرمان `duplicate_case_merge` روی سرور commit می‌شد و projection پاسخ نیز در localStorage/IndexedDB نوشته می‌شد، اما در حالت سرورمحور (Phase B)، `getData()` تا ۳۰ ثانیه آرایه قدیمی را از cache داخلی `client-server.js` برمی‌گرداند. در نتیجه بلافاصله پس از پیام موفقیت:

- فهرست پرونده‌های فروش همچنان دو پرونده نشان می‌داد؛
- موتور کیفیت داده دوباره یافته «دو پرونده برای یک پیشنهاد» را از cache قدیمی می‌ساخت؛
- pull فوری نیز چون همان مسیر نوشتن مستقیم را داشت، cache خواندن را invalidate نمی‌کرد؛
- handler موفقیت و renderها پیش از پایان pull اجرا می‌شدند.

همچنین v34.7.13 به‌جای revision دقیق پاسخ فرمان، از `state.lastRev` قدیمی به‌عنوان کف `krevs` استفاده می‌کرد؛ پاسخ دیررس می‌توانست projection جدیدتر را عقب ببرد.

## اصلاح

- `crm/client-server.js`
  - قرارداد جدید `ptfBApplyServerProjection` اضافه شد تا cache سی‌ثانیه‌ای، آینه حافظه/IndexedDB و localStorage را همزمان و بدون ساخت dirty/queue به‌روزرسانی کند.
  - revisionهای per-key و global فقط رو به جلو حرکت می‌کنند.
  - پاسخ دیررس `sharedPull` اگر revision پایین‌تری داشته باشد دیگر cache جدیدتر را بازنویسی نمی‌کند.
- `crm/sync.js`
  - `ptfSyncApplyServerProjection` اکنون revision دقیق فرمان را دریافت می‌کند.
  - projection قدیمی‌تر از `krevs` شناخته‌شده رد می‌شود.
  - rev سراسری فقط پس از موفقیت همه کلیدهای projection جلو می‌رود؛ شکست جزئی با pull بعدی قابل بازیابی می‌ماند.
  - همه writeهای داخلی sync، cache فاز B را نیز تازه می‌کنند.
- `crm/sales-domain-v2.js`
  - `d.rev` همراه projection اعمال می‌شود.
  - Promise فرمان تا پایان callback پول نهایی صبر می‌کند؛ render موفقیت دیگر از همگام‌سازی جلو نمی‌زند.
- `api/sales-domain.php`
  - retry ایدمپوتنت نیز revision جاری سرور را همراه projection برمی‌گرداند.

## تست رگرسیون جدید

`_tools/uat/tester417-v34.7.14-duplicate-case-projection-cache.js` سناریوی واقعی را در runtime بازتولید می‌کند:

1. فعال بودن Phase B و cache دارای دو پرونده؛
2. اعمال projection سرور با یک پرونده؛
3. مشاهده فوری یک پرونده از طریق `getData()`؛
4. عدم ایجاد write جدید در صف آفلاین؛
5. ثبت revision دقیق؛
6. رد پاسخ قدیمی و عدم زنده‌شدن پرونده حذف‌شده؛
7. انتظار مسیر UI تا پایان pull نهایی؛
8. وجود revision در پاسخ retry ایدمپوتنت.
