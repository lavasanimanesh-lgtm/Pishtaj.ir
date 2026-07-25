# گزارش رگرسیون کامل — v31.6.19

**تاریخ اجرا:** 2026-07-17T16:53:46.847Z  
**نسخه کد:** `v31.6.19`  
**دستورات:** `python3 _tools/audit.py` + `node _tools/run-full-regression.js`

## نتیجه کلی

| شاخص | مقدار |
|:---|---:|
| تعداد تسترها | 151 |
| فایل تستر PASS | **151** |
| فایل تستر FAIL | **0** |
| مجموع چک PASS | **3732** |
| مجموع چک FAIL | **0** |
| audit.py | **PASS**؛ بدون warning |
| exit code | **0** |

## تست هدفمند release

- `tester171-v3173-surplus-light.js`: **7 PASS / 0 FAIL**؛
- `tester172-v3174-surplus-sale-integrity.js`: **10 PASS / 0 FAIL**؛
- `tester173-v318-backup-coverage.js`: **6 PASS / 0 FAIL**؛
- `tester174-v319-golive-coverage.js`: **6 PASS / 0 FAIL**؛
- `node --check crm/golive.js`: **PASS**؛
- `node --check _tools/uat/tester174-v319-golive-coverage.js`: **PASS**.

## پوشش tester174

1. وجود `ptf_crm_surplus` در reset تراکنشی؛
2. وجود `ptf_crm_payables` در reset تراکنشی؛
3. عدم ورود کلیدهای حفاظت‌شده به wipe؛
4. عدم تکرار کلیدها؛
5. پوشش WIPE_KEYS در pre-golive backup؛
6. وجود backup پیشینی، `allow_wipe` و guard سروری.

## تسترهای prebroken / FAIL / hung / soft

- prebroken: **هیچ**؛
- FAIL واقعی: **هیچ**؛
- timeout بدون DONE: **هیچ**؛
- خروج soft: **هیچ**.

## تصمیم release

`v31.6.19` یک hardening محدود برای Go-Live reset است. دامنهٔ آن فقط پاک‌سازی درست داده‌های تراکنشی جدید در reset admin-only و حفظ کلیدهای configuration است. FIN-WF-001، policy چک شخصی، staging مستقل، US-437 و انبار کامل در این release پیاده‌سازی یا ادعا نشده‌اند.

## محدودیت محیطی

PHP binary در sandbox موجود نیست؛ بنابراین `php -l` محلی اجرا نشد. reset واقعی و endpointهای PHP باید پس از فراهم‌شدن staging مستقل بررسی شوند.
