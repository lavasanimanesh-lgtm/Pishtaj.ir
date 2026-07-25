# گزارش رگرسیون کامل — v31.6.17

**تاریخ اجرا:** 2026-07-17T15:46:33.961Z  
**نسخه کد:** `v31.6.17`  
**دستورات:** `python3 _tools/audit.py` + `node _tools/run-full-regression.js`

## نتیجه کلی

| شاخص | مقدار |
|:---|---:|
| تعداد تسترها | 149 |
| فایل تستر PASS | **149** |
| فایل تستر FAIL | **0** |
| مجموع چک PASS | **3720** |
| مجموع چک FAIL | **0** |
| audit.py | **PASS**؛ بدون warning |
| exit code | **0** |

## تست هدفمند release

- `tester171-v3173-surplus-light.js`: **7 PASS / 0 FAIL**؛
- `tester172-v3174-surplus-sale-integrity.js`: **10 PASS / 0 FAIL**؛
- `node --check crm/surplus.js`: **PASS**؛
- `node --check _tools/uat/tester172-v3174-surplus-sale-integrity.js`: **PASS**.

## سناریوهای پوشش‌داده‌شده در tester172

1. اتصال reservation به `offerNo`؛
2. commit برد CO از `reservedQty` به `soldQty`؛
3. جلوگیری از commit تکراری با `saleRefs`؛
4. توقف برد با رزرو ناکافی؛
5. آزادسازی رزرو متصل هنگام باخت.

## تسترهای prebroken / FAIL / hung / soft

- prebroken: **هیچ**؛
- FAIL واقعی: **هیچ**؛
- timeout بدون DONE: **هیچ**؛
- خروج soft: **هیچ**.

## تصمیم release

`v31.6.17` یک hardening محدود و قابل استقرار برای US-436 light است. دامنه فقط «موجودی مازاد پروژه / انبار سبک» است. انبار کامل، انتقال بین انبارها، US-437، FIN-WF-001، policy چک شخصی و staging مستقل در این release پیاده‌سازی یا ادعا نشده‌اند.

## محدودیت محیطی

PHP binary در sandbox موجود نیست؛ بنابراین `php -l` محلی اجرا نشد. بررسی endpointهای PHP روی staging/Production پس از deploy همچنان لازم است.
