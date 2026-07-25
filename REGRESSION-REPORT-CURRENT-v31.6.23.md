# گزارش رگرسیون کامل — v31.6.23

**تاریخ اجرا:** 2026-07-18T05:38:14.991Z  
**نسخه کد:** `v31.6.23`  
**دستورات:** `python3 _tools/audit.py` + `node _tools/run-full-regression.js`

## نتیجه کلی

| شاخص | مقدار |
|:---|---:|
| تعداد تسترها | 155 |
| فایل تستر PASS | **155** |
| فایل تستر FAIL | **0** |
| مجموع چک PASS | **3768** |
| مجموع چک FAIL | **0** |
| audit.py | **PASS**؛ بدون warning |
| exit code | **0** |

## تست هدفمند release

- `tester170-v3172-sync-auth.js`: **6 PASS / 0 FAIL**؛
- `tester178-v323-sync-divergence.js`: **9 PASS / 0 FAIL**؛
- `node --check crm/sync.js`: **PASS**.

## RCA coverage

1. same cached revision with different browser localStorage؛
2. old revision browser؛
3. empty server seed preservation؛
4. full pull with `since=0`؛
5. auth retry preserving forceFull؛
6. API full pull data/meta contract.

## تسترهای prebroken / FAIL / hung / soft

- prebroken: **هیچ**؛
- FAIL واقعی: **هیچ**؛
- timeout بدون DONE: **هیچ**؛
- خروج soft: **هیچ**.

## تصمیم release

`v31.6.23` hotfix فوری برای واگرایی داده بین browser/device است. startup sync اکنون با server revision مثبت full pull می‌کند و cached local revision را به‌تنهایی معتبر نمی‌داند. هیچ reset، migration یا تغییر auth/مالی Production انجام نشده است.

## محدودیت محیطی

PHP binary در sandbox موجود نیست؛ بنابراین `php -l` محلی اجرا نشد. UAT Chrome/Firefox و چنددستگاهی باید روی server واقعی انجام شود.
