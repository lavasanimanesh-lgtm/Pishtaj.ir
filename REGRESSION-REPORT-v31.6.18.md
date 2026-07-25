# گزارش رگرسیون کامل — v31.6.18

**تاریخ اجرا:** 2026-07-17T15:55:35.466Z  
**نسخه کد:** `v31.6.18`  
**دستورات:** `python3 _tools/audit.py` + `node _tools/run-full-regression.js`

## نتیجه کلی

| شاخص | مقدار |
|:---|---:|
| تعداد تسترها | 150 |
| فایل تستر PASS | **150** |
| فایل تستر FAIL | **0** |
| مجموع چک PASS | **3726** |
| مجموع چک FAIL | **0** |
| audit.py | **PASS**؛ بدون warning |
| exit code | **0** |

## تست هدفمند release

- `tester171-v3173-surplus-light.js`: **7 PASS / 0 FAIL**؛
- `tester172-v3174-surplus-sale-integrity.js`: **10 PASS / 0 FAIL**؛
- `tester173-v318-backup-coverage.js`: **6 PASS / 0 FAIL**؛
- `node --check crm/backup.js`: **PASS**؛
- `node --check _tools/uat/tester173-v318-backup-coverage.js`: **PASS**.

## پوشش tester173

1. وجود `ptf_crm_trash` در backup؛
2. وجود آن در sync و API whitelist؛
3. نبودن کلید sync بدون پوشش backup؛
4. نبودن کلید API بدون پوشش sync/backup؛
5. نبود کلید تکراری در `DATA_KEYS`؛
6. مصرف همان `DATA_KEYS` در restore.

## تسترهای prebroken / FAIL / hung / soft

- prebroken: **هیچ**؛
- FAIL واقعی: **هیچ**؛
- timeout بدون DONE: **هیچ**؛
- خروج soft: **هیچ**.

## تصمیم release

`v31.6.18` یک hardening محدود برای پوشش backup/restore است. دامنهٔ آن فقط هم‌راستایی کلیدهای sync/API/backup است. FIN-WF-001، policy چک شخصی، staging مستقل، US-437 و انبار کامل در این release پیاده‌سازی یا ادعا نشده‌اند.

## محدودیت محیطی

PHP binary در sandbox موجود نیست؛ بنابراین `php -l` محلی اجرا نشد. بررسی endpointهای PHP و restore واقعی باید پس از فراهم‌شدن staging مستقل انجام شود.
