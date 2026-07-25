# گزارش رگرسیون کامل — v31.6.20

**تاریخ اجرا:** 2026-07-17T17:07:04.512Z  
**نسخه کد:** `v31.6.20`  
**دستورات:** `python3 _tools/audit.py` + `node _tools/run-full-regression.js`

## نتیجه کلی

| شاخص | مقدار |
|:---|---:|
| تعداد تسترها | 152 |
| فایل تستر PASS | **152** |
| فایل تستر FAIL | **0** |
| مجموع چک PASS | **3741** |
| مجموع چک FAIL | **0** |
| audit.py | **PASS**؛ بدون warning |
| exit code | **0** |

## تست هدفمند release

- `tester107-v191.js`: **42 PASS / 0 FAIL**؛
- `tester108-v192.js`: **42 PASS / 0 FAIL**؛
- `tester109-v193.js`: **42 PASS / 0 FAIL**؛
- `tester110-v194.js`: **36 PASS / 0 FAIL**؛
- `tester114-v198.js`: **20 PASS / 0 FAIL**؛
- `tester127-v211.js`: **49 PASS / 0 FAIL**؛
- `tester175-v320-salesfile-postaward-guards.js`: **9 PASS / 0 FAIL**؛
- `node --check crm/salesfiles.js`: **PASS**.

## پوشش tester175

1. QC پیش از برد commit نمی‌شود؛
2. QC در پروندهٔ برنده commit می‌شود؛
3. ارسال/تحویل پیش از برد commit نمی‌شود؛
4. ارسال در پروندهٔ برنده commit می‌شود؛
5. UI در دریافت `null` بدون event و toast خارج می‌شود.

## تسترهای prebroken / FAIL / hung / soft

- prebroken: **هیچ**؛
- FAIL واقعی: **هیچ**؛
- timeout بدون DONE: **هیچ**؛
- خروج soft: **هیچ**.

## تصمیم release

`v31.6.20` یک hardening محدود برای integrity پروندهٔ فروش است. دامنهٔ آن جلوگیری از mutationهای QC و ارسال/تحویل پیش از تشکیل پروندهٔ post-award است. FIN-WF-001، policy چک شخصی، staging مستقل، US-437 و انبار کامل در این release پیاده‌سازی یا ادعا نشده‌اند.

## محدودیت محیطی

PHP binary در sandbox موجود نیست؛ بنابراین `php -l` محلی اجرا نشد. UAT مرورگر و verification endpointهای PHP پس از deploy روی staging/Production لازم است.
