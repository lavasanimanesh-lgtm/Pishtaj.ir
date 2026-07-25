# گزارش رگرسیون کامل — v31.6.24

**تاریخ اجرا:** 2026-07-18T05:51:31.926Z  
**نسخه کد:** `v31.6.24`  
**دستورات:** `python3 _tools/audit.py` + `node _tools/run-full-regression.js`

## نتیجه کلی

| شاخص | مقدار |
|:---|---:|
| تعداد تسترها | 156 |
| فایل تستر PASS | **156** |
| فایل تستر FAIL | **0** |
| مجموع چک PASS | **3774** |
| مجموع چک FAIL | **0** |
| audit.py | **PASS**؛ بدون warning |
| exit code | **0** |

## تست هدفمند release

- `tester170-v3172-sync-auth.js`: **6 PASS / 0 FAIL**؛
- `tester178-v323-sync-divergence.js`: **9 PASS / 0 FAIL**؛
- `tester179-v324-sync-auth-race.js`: **6 PASS / 0 FAIL**؛
- `node --check crm/sync.js`: **PASS**.

## تسترهای prebroken / FAIL / hung / soft

- prebroken: **هیچ**؛
- FAIL واقعی: **هیچ**؛
- timeout بدون DONE: **هیچ**؛
- خروج soft: **هیچ**.

## تصمیم release

`v31.6.24` hotfix فوری race احراز هویت در startup sync است. browser با token stale/expired دیگر با local stale bootstrapped نمی‌شود؛ token refresh شده و full pull دوباره اجرا می‌شود. هیچ reset، migration یا تغییر auth مالی server-side انجام نشده است.

## محدودیت محیطی

PHP binary در sandbox موجود نیست؛ بنابراین `php -l` محلی اجرا نشد. UAT واقعی Chrome/Firefox و چنددستگاهی پس از deploy لازم است.
