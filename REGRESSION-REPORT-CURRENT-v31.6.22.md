# گزارش رگرسیون کامل — v31.6.22

**تاریخ اجرا:** 2026-07-17T17:56:10.459Z  
**نسخه کد:** `v31.6.22`  
**دستورات:** `python3 _tools/audit.py` + `node _tools/run-full-regression.js`

## نتیجه کلی

| شاخص | مقدار |
|:---|---:|
| تعداد تسترها | 154 |
| فایل تستر PASS | **154** |
| فایل تستر FAIL | **0** |
| مجموع چک PASS | **3759** |
| مجموع چک FAIL | **0** |
| audit.py | **PASS**؛ بدون warning |
| exit code | **0** |

## تست هدفمند release

- `tester63-v143.js`: **40 PASS / 0 FAIL**؛
- `tester169-v3171-codegen-unification.js`: **5 PASS / 0 FAIL**؛
- `tester177-v322-codegen-fallbacks.js`: **7 PASS / 0 FAIL**؛
- `node --check crm/ai-workbench.js`: **PASS**؛
- `node --check crm/storage.js`: **PASS**.

## پوشش tester177

1. ساخت رکوردهای AI با generator مرکزی؛
2. حذف fallback random در AI Workbench؛
3. استفاده از offerSerial برای پیشنهادها؛
4. استفاده از letSerial برای نامه؛
5. deterministic بودن شناسهٔ upload widget؛
6. ترتیب load شدن codegen پیش از AI و storage.

## تسترهای prebroken / FAIL / hung / soft

- prebroken: **هیچ**؛
- FAIL واقعی: **هیچ**؛
- timeout بدون DONE: **هیچ**؛
- خروج soft: **هیچ**.

## تصمیم release

`v31.6.22` یک hardening محدود برای یکپارچه‌سازی codegen در AI Workbench و storage است. FIN-WF-001، auth مالی Production، policy چک شخصی، US-437 و انبار کامل در این release پیاده‌سازی یا ادعا نشده‌اند.

## محدودیت محیطی

PHP binary در sandbox موجود نیست؛ بنابراین `php -l` محلی اجرا نشد. UAT ساخت رکورد از AI و storage واقعی باید پس از deploy بررسی شود.
