# ریلیزنوت v31.6.27 — جلوگیری از صدور کد تکراری پیشنهاد

## ۱) RCA
کد پیشنهادها برخلاف تصور، همیشه مستقیماً از server گرفته نمی‌شد:

1. `offerSerial()` در `offers.js` با اسکن `localStorage` و `max+1` کد می‌ساخت؛
2. اگر دو device دادهٔ یکسان/ناقص نداشتند، هر دو می‌توانستند `0100` یا `0101` بسازند؛
3. server codegen در `load_counters()` پیشنهادهای موجود `ptf_crm_offers.json` را برای year sequence اسکن نمی‌کرد؛
4. reserve server به‌صورت async بود و وقتی pool هنوز پر نشده بود، fallback محلی فعال می‌شد؛
5. بنابراین server counter همیشه از کدهایی که روی deviceها ساخته شده بودند خبر نداشت.

## ۲) فایل‌های تغییرکرده

- `crm/offers.js`
- `crm/codegen.js`
- `api/codegen.php`
- `crm/index.html`
- `crm/sw.js`
- `_tools/uat/tester182-v327-codegen-server-integrity.js`
- `RELEASE-NOTES-v31.6.27.md`
- `REGRESSION-REPORT-v31.6.27.md`
- `BACKLOG-PRIORITIZED-CURRENT-v31.6.27.md`
- `SPRINT-1-DELIVERABLE-STAGE0-v31.6.27.md`
- `STAGE-0-BASELINE-MANIFEST-v31.6.27.txt`
- `INSTALL-GUIDE.md`
- `PTF-MASTER-HANDOVER.md`

## ۳) اصلاح ریشه‌ای

- `offerSerial()` اکنون از `ptfUnifiedCode()` استفاده می‌کند؛
- server هنگام reserve، existing official TO/CO/TC را از `ptf_crm_offers.json` اسکن می‌کند؛
- `yearSeq` برای هر سال از بیشترین کد موجود جلوتر می‌رود؛
- اگر server pool برای TO/CO/TC آماده نباشد، local max دیگر استفاده نمی‌شود؛
- کد `TMP-*` به‌عنوان پیشنهاد رسمی ذخیره نمی‌شود؛
- وقتی pool آماده شود، کد رسمی server صادر می‌شود؛
- duplicate audit فقط‌خواندنی اضافه شد و هیچ رکوردی را خودکار rename نمی‌کند.

## ۴) وضعیت کدهای موجود

کدهای تکراری موجود خودکار تغییر داده نمی‌شوند، چون ممکن است به invoice، deal، attachment و timeline ارجاع داشته باشند. ابتدا باید با backup و گزارش read-only شناسایی و سپس با repair plan و approval اصلاح شوند.

## ۵) regression و audit

- `tester182-v327-codegen-server-integrity.js`: **۶ PASS / ۰ FAIL**؛
- `tester183-v328-duplicate-repair.js`: **۸ PASS / ۰ FAIL**؛
- full regression: **۱۶۰ فایل PASS / ۰ FAIL، ۳۸۰۱ چک PASS / ۰ FAIL**؛
- `python3 _tools/audit.py`: **PASS، بدون warning**؛
- PHP syntax محلی اجرا نشد چون binary `php` در sandbox موجود نیست.

## ۶) مراحل verification کارفرما

1. قبل از repair، از همهٔ deviceها backup فایل بگیرید.
2. با نسخهٔ جدید یک CO/TO ایجاد کنید.
3. در Network، درخواست `api/codegen.php?action=reserve` را بررسی کنید.
4. کد جدید نباید از local max مستقل تولید شود.
5. `ptfScanDuplicateCodes()` را برای گزارش read-only اجرا کنید.
6. کدهای تکراری فعلی را rename یا حذف نکنید؛ ابتدا invoice/deal/referenceهای آن‌ها استخراج شود.
7. بعد از تأیید repair plan، اصلاح رکوردهای موجود جداگانه انجام شود.

## ۷) گیت و محدودیت

این تغییر کد تولید پیشنهاد و server codegen است. role-scoped sync در همین شاخه نیز server-side RBAC دارد؛ بنابراین پیش از Production باید role matrix و codegen counter روی staging/no-leak بررسی شود. migration یا rename خودکار دادهٔ موجود انجام نشده است.

## نسخه

- `VER v31.6.27`
- `CACHE ptf-crm-v31.6.27`
