# ریلیزنوت v31.6.21 — integrity محاسبه سود و نگاشت خرید

## ۱) RCA
در بررسی residualهای `BUG-PROC-LINK-287` مشخص شد اگرچه Optimizer اصلی provenanceدار شده بود، اما چند مسیر دیگر هنوز به `purchase.idx` برای پیدا کردن قلم CO متکی بودند:

- موتور سود چندارزی در `fx.js`؛
- نمایش نام قلم در ledger تأمین‌کننده؛
- مسیرهای residual داخل `supplier-finance.js`.

با reorder یا حذف قلم، این مسیرها می‌توانستند مقدار خرید یا نام قلم اشتباه را به ردیف دیگری نسبت دهند.

## ۲) فایل‌های تغییرکرده

- `crm/procurement-link.js`
- `crm/fx.js`
- `crm/supplier-finance.js`
- `crm/index.html`
- `crm/sw.js`
- `_tools/uat/tester78-v160.js`
- `_tools/uat/tester176-v321-procurement-profit-integrity.js`
- `RELEASE-NOTES-v31.6.21.md`
- `REGRESSION-REPORT-v31.6.21.md`
- `BACKLOG-PRIORITIZED-CURRENT-v31.6.21.md`
- `SPRINT-1-DELIVERABLE-STAGE0-v31.6.21.md`
- `STAGE-0-BASELINE-MANIFEST-v31.6.21.txt`
- `INSTALL-GUIDE.md`
- `INSTALL-GUIDE.md`
- `PTF-MASTER-HANDOVER.md`

## ۳) تغییر و دامنهٔ اثر

- `ptfResolveItemForPurchase()` برای تطبیق خرید با قلم CO بر اساس `sourceItemKey` یا کد پایدار اضافه شد؛
- `purchase.idx` دیگر در موتور سود FX و نام‌گذاری ledger به‌عنوان هویت استفاده نمی‌شود؛
- خرید legacy بدون provenance یا تطبیق مبهم عمداً وارد سود نمی‌شود؛
- در حالت mapping مبهم، `buyUnmatched` و هشدار شفاف تولید می‌شود و سود نهایی محاسبه نمی‌شود؛
- مسیرهای Optimizer قبلی حفظ شده‌اند؛
- هیچ migration خودکار دادهٔ legacy انجام نشده است.

## ۴) regression و audit

- `tester176-v321-procurement-profit-integrity.js`: **۱۰ PASS / ۰ FAIL**؛
- `tester78-v160.js`: **۳۴ PASS / ۰ FAIL**؛
- `node --check crm/procurement-link.js`: PASS؛
- `node --check crm/fx.js`: PASS؛
- `node --check crm/supplier-finance.js`: PASS؛
- full regression: **۱۵۳ فایل PASS / ۰ FAIL، ۳۷۵۲ چک PASS / ۰ FAIL**؛
- `python3 _tools/audit.py`: **PASS، بدون warning**؛
- جزئیات در `REGRESSION-REPORT-v31.6.21.md` ثبت شده است؛
- PHP syntax محلی اجرا نشد چون binary `php` در sandbox موجود نیست.

## ۵) Evidence قابل استناد

tester176 موارد زیر را اثبات می‌کند:

1. purchase با کد پایدار به قلم دوم پس از reorder وصل می‌شود؛
2. purchase بدون provenance unresolved می‌ماند؛
3. کد تکراری ambiguous می‌شود و commit نمی‌شود؛
4. مقدار خرید از qty قلم درست محاسبه می‌شود؛
5. خرید legacy بدون provenance وارد سود نمی‌شود؛
6. مسیر supplier-finance دیگر از index برای نام قلم استفاده نمی‌کند.

## ۶) مراحل verification کارفرما

1. یک CO با دو قلم A و B بسازید.
2. برای قلم B خرید واقعی را با `sourcePcode` یا provenance پایدار ثبت کنید.
3. ترتیب اقلام را در fixture تستی تغییر دهید.
4. موتور سود را باز کنید؛ مبلغ خرید باید همچنان متعلق به قلم B باشد.
5. یک خرید legacy بدون provenance را بررسی کنید؛ نباید بی‌هشدار وارد سود شود.
6. در ledger تأمین‌کننده، نام قلم پس از reorder نباید به قلم دیگری نسبت داده شود.

## ۷) approval و محدودیت

این تغییر hardening محدود در resolver و مصرف‌کننده‌های موجود است و refactor معماری گسترده یا migration نیست؛ approval پیشینی refactor لازم نشد. golden print/CO/TC و UAT مرورگر همچنان در backlog Release 2 باقی می‌مانند.

## نسخه

- `VER v31.6.21`
- `CACHE ptf-crm-v31.6.21`
