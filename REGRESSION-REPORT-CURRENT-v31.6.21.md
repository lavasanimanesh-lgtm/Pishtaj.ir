# گزارش رگرسیون کامل — v31.6.21

**تاریخ اجرا:** 2026-07-17T17:37:59.506Z  
**نسخه کد:** `v31.6.21`  
**دستورات:** `python3 _tools/audit.py` + `node _tools/run-full-regression.js`

## نتیجه کلی

| شاخص | مقدار |
|:---|---:|
| تعداد تسترها | 153 |
| فایل تستر PASS | **153** |
| فایل تستر FAIL | **0** |
| مجموع چک PASS | **3752** |
| مجموع چک FAIL | **0** |
| audit.py | **PASS**؛ بدون warning |
| exit code | **0** |

## تست هدفمند release

- `tester78-v160.js`: **34 PASS / 0 FAIL**؛
- `tester79-v161.js`: **25 PASS / 0 FAIL**؛
- `tester80-v162.js`: **15 PASS / 0 FAIL**؛
- `tester103-v186.js`: **19 PASS / 0 FAIL**؛
- `tester115-v199.js`: **29 PASS / 0 FAIL**؛
- `tester176-v321-procurement-profit-integrity.js`: **10 PASS / 0 FAIL**؛
- `node --check crm/fx.js`: **PASS**؛
- `node --check crm/procurement-link.js`: **PASS**؛
- `node --check crm/supplier-finance.js`: **PASS**.

## پوشش tester176

1. اتصال purchase به قلم درست پس از reorder؛
2. رد purchase بدون provenance؛
3. رد mapping مبهم با کد تکراری؛
4. محاسبهٔ مبلغ خرید بر اساس qty قلم درست؛
5. عدم ورود legacy بدون provenance به سود؛
6. حذف وابستگی ledger به index برای نام قلم.

## تسترهای prebroken / FAIL / hung / soft

- prebroken: **هیچ**؛
- FAIL واقعی: **هیچ**؛
- timeout بدون DONE: **هیچ**؛
- خروج soft: **هیچ**.

## تصمیم release

`v31.6.21` یک hardening محدود برای procurement/profit integrity است. دامنهٔ آن residual index mapping در FX profit و supplier ledger است. دادهٔ legacy بدون provenance عمداً عدد خرید را وارد سود نمی‌کند. چاپ golden، UAT مرورگر، FIN-WF-001، policy چک شخصی، US-437 و انبار کامل در این release ادعا نشده‌اند.

## محدودیت محیطی

PHP binary در sandbox موجود نیست؛ بنابراین `php -l` محلی اجرا نشد. endpointهای PHP و UAT مرورگر باید روی staging/Production بررسی شوند.
