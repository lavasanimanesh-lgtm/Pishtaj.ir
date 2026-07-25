# ریلیزنوت v31.7.1 — هشدار و repair کنترل‌شدهٔ کدهای تکراری

## دامنه

این patch کوچک روی Release v31.7.0 اضافه می‌کند:

- هشدار visible بعد از sync برای duplicate RFQ/Offer؛
- نمایش رکوردها، زمان و وضعیت آن‌ها؛
- دکمهٔ «اختصاص کد جدید از server» فقط برای duplicate امن؛
- عدم امکان تایپ کد دلخواه؛
- عدم تغییر خودکار duplicate دارای reference مبهم؛
- audit و confirmation داخلی؛
- نگه‌داشتن کد قبلی در `_codeRepair`/history.

## ریسک و کنترل

- duplicate بدون reference: قابل repair خودکار/کنترل‌شده؛
- duplicate متصل به invoice/deal/project: بدون حدس تغییر نمی‌کند؛
- `ptfDuplicateRepairOpen()` از تنظیمات قابل دسترسی است؛
- `ptfDuplicateRepairApplyOne()` فقط server code رزرو می‌کند؛
- `ptfAutoRepairSafeDuplicates()` فقط detect/notify می‌کند و دیگر silent mutate نمی‌کند.

## فایل‌های تغییرکرده

- `crm/codegen.js`
- `crm/backup.js`
- `crm/index.html`
- `crm/sw.js`
- `_tools/uat/tester183-v328-duplicate-repair.js`
- `RELEASE-NOTES-v31.7.1.md`
- `REGRESSION-REPORT-v31.7.1.md`
- `BACKLOG-PRIORITIZED-CURRENT-v31.7.1.md`
- `SPRINT-1-DELIVERABLE-STAGE0-v31.7.1.md`
- `STAGE-0-BASELINE-MANIFEST-v31.7.1.txt`
- `PTF-MASTER-HANDOVER.md`

## تست

- tester183: **9 PASS / 0 FAIL**؛
- جزئیات در `REGRESSION-REPORT-v31.7.1.md` ثبت شده است؛
- PHP syntax محلی اجرا نشد چون binary `php` در sandbox موجود نیست.

## محدودیت

repair existing duplicateهای ambiguous نیازمند backup، dry-run، reference impact و approval است. server-side RBAC/codegen نیز پیش از Production به staging no-leak نیاز دارد.

## نسخه

- `VER v31.7.1`
- `CACHE ptf-crm-v31.7.1`
