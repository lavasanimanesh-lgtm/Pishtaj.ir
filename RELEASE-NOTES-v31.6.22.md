# ریلیزنوت v31.6.22 — حذف fallbackهای random از AI و upload

## ۱) RCA
در بررسی مستقیم source، بخش‌هایی از AI Workbench و storage هنوز در صورت نبودن generator مرکزی از `Math.random()` برای ساخت شناسه استفاده می‌کردند. این مسیرها می‌توانستند کد/شناسهٔ غیرقابل‌ردیابی یا collision ایجاد کنند و با قرارداد codegen یکپارچه ناسازگار بودند.

## ۲) فایل‌های تغییرکرده

- `crm/ai-workbench.js`
- `crm/storage.js`
- `crm/index.html`
- `crm/sw.js`
- `_tools/uat/tester63-v143.js`
- `_tools/uat/tester169-v3171-codegen-unification.js`
- `_tools/uat/tester177-v322-codegen-fallbacks.js`
- `RELEASE-NOTES-v31.6.22.md`
- `REGRESSION-REPORT-v31.6.22.md`
- `BACKLOG-PRIORITIZED-CURRENT-v31.6.22.md`
- `SPRINT-1-DELIVERABLE-STAGE0-v31.6.22.md`
- `STAGE-0-BASELINE-MANIFEST-v31.6.22.txt`
- `INSTALL-GUIDE.md`
- `PTF-MASTER-HANDOVER.md`

## ۳) تغییر و دامنهٔ اثر

- ساخت IQI، مشتری، RFQ و اقلام AI مستقیماً از `genCode` مرکزی استفاده می‌کند؛
- پیش‌نویس پیشنهاد AI از `offerSerial`/`genCode` مرکزی استفاده می‌کند؛
- شماره نامه AI از `letSerial` یا generator مرکزی می‌آید؛
- شناسهٔ widget آپلود storage با شمارندهٔ deterministic نشست ساخته می‌شود؛
- fallbackهای random عملیاتی از AI Workbench و storage حذف شدند؛
- generator اصلی `codegen.js` و schema داده تغییری نکرده است.

## ۴) regression و audit

- `tester177-v322-codegen-fallbacks.js`: **۷ PASS / ۰ FAIL**؛
- `tester169-v3171-codegen-unification.js`: **۵ PASS / ۰ FAIL**؛
- `tester63-v143.js`: **۴۰ PASS / ۰ FAIL**؛
- full regression: **۱۵۴ فایل PASS / ۰ FAIL، ۳۷۵۹ چک PASS / ۰ FAIL**؛
- `python3 _tools/audit.py`: **PASS، بدون warning**؛
- `node --check crm/ai-workbench.js`: PASS؛
- `node --check crm/storage.js`: PASS؛
- PHP syntax محلی اجرا نشد چون binary `php` در sandbox موجود نیست.

## ۵) Evidence قابل استناد

tester177 کنترل می‌کند:

1. ساخت رکوردهای AI با generator مرکزی؛
2. حذف fallback random در AI Workbench؛
3. استفاده از offerSerial برای پیشنهادها؛
4. استفاده از letSerial برای نامه؛
5. deterministic بودن شناسهٔ widget upload؛
6. ترتیب load شدن codegen پیش از AI و storage.

## ۶) مراحل verification کارفرما

1. از AI Workbench یک مشتری، درخواست، قلم و پیش‌نویس پیشنهاد بسازید.
2. کدهای تولیدشده را در رکوردها بررسی کنید؛ نباید کد random محلی ساخته شود.
3. از AI یک نامه تولید کنید و شمارهٔ نامه را بررسی کنید.
4. دو widget آپلود هم‌زمان باز کنید؛ شناسه‌های DOM نباید تکراری باشند.
5. مسیر آپلود و ذخیرهٔ فایل را در staging/Production با storage واقعی بررسی کنید.

## ۷) approval و محدودیت

این تغییر hardening محدود در مسیر تولید شناسهٔ موجود است و refactor معماری یا migration نیست؛ approval پیشینی refactor لازم نشد. FIN-WF-001، auth مالی Production، US-437 و انبار کامل خارج از scope هستند.

## نسخه

- `VER v31.6.22`
- `CACHE ptf-crm-v31.6.22`
