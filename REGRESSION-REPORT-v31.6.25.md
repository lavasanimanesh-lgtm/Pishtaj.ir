# گزارش رگرسیون کامل — v31.6.25

**تاریخ اجرا:** 2026-07-18T06:09:58.101Z  
**نسخه کد:** `v31.6.25`  
**دستورات:** `python3 _tools/audit.py` + `node _tools/run-full-regression.js`

## نتیجه کلی

| شاخص | مقدار |
|:---|---:|
| تعداد تسترها | 157 |
| فایل تستر PASS | **157** |
| فایل تستر FAIL | **0** |
| مجموع چک PASS | **3778** |
| مجموع چک FAIL | **0** |
| audit.py | **PASS**؛ بدون warning |
| exit code | **0** |

## تست هدفمند release

- `tester170-v3172-sync-auth.js`: **6 PASS / 0 FAIL**؛
- `tester178-v323-sync-divergence.js`: **9 PASS / 0 FAIL**؛
- `tester179-v324-sync-auth-race.js`: **6 PASS / 0 FAIL**؛
- `tester180-v325-admin-token-bridge.js`: **4 PASS / 0 FAIL**؛
- `node --check crm/sync.js`: **PASS**.

## تسترهای prebroken / FAIL / hung / soft

- prebroken: **هیچ**؛
- FAIL واقعی: **هیچ**؛
- timeout بدون DONE: **هیچ**؛
- خروج soft: **هیچ**.

## تصمیم release

`v31.6.25` hotfix token bootstrap برای admin است. admin اکنون حتی بدون رکورد `ptf_crm_users` می‌تواند از `ADMIN_HASH/settings.adminHash` token بگیرد؛ سپس full pull اجرا می‌شود. هیچ reset، migration یا تغییر auth مالی server-side انجام نشده است.

## محدودیت محیطی

PHP binary در sandbox موجود نیست؛ بنابراین `php -l` محلی اجرا نشد. UAT واقعی Production باید بعد از deploy با Network log بررسی شود.
