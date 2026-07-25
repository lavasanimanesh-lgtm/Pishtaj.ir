# ریلیزنوت v31.7.2 — جلوگیری از حذف duplicate در startup merge

## RCA
تابع عمومی `ptfSmartMerge` برای آرایه‌ها از `cd/no/id/code` به‌عنوان کلید یکتا استفاده می‌کرد. وقتی دو device یک RFQ یا Offer با کد یکسان اما payload متفاوت داشتند، یکی از دو رکورد در map روی دیگری overwrite می‌شد. این مشکل در startup reconciliation باعث شد deviceها شبیه شوند اما رکورد جدیدتر ناپدید شود.

## اصلاح

- برای `ptf_crm_rfqs` و `ptf_crm_offers` مسیر `ptfMergeNoCollapse()` اضافه شد؛
- payloadهای متفاوت با کد یکسان هر دو حفظ می‌شوند؛
- فقط payload کاملاً یکسان deduplicate می‌شود؛
- duplicate repair بعدی مسئول تخصیص کد جدید server به رکورد safe است؛
- duplicate دارای reference مبهم بدون حدس تغییر نمی‌کند؛
- هیچ حذف، rename یا migration خودکار دادهٔ فعلی انجام نشده است.

## فایل‌های تغییرکرده

- `crm/sync.js`
- `crm/index.html`
- `crm/sw.js`
- `_tools/uat/tester184-v329-startup-local-merge.js`
- `RELEASE-NOTES-v31.7.2.md`
- `REGRESSION-REPORT-v31.7.2.md`
- `BACKLOG-PRIORITIZED-CURRENT-v31.7.2.md`
- `SPRINT-1-DELIVERABLE-STAGE0-v31.7.2.md`
- `STAGE-0-BASELINE-MANIFEST-v31.7.2.txt`
- `INSTALL-GUIDE.md`
- `PTF-MASTER-HANDOVER.md`

## تست

- `tester184-v329-startup-local-merge.js`: **۶ PASS / ۰ FAIL**؛
- `tester183-v328-duplicate-repair.js`: **۹ PASS / ۰ FAIL**؛
- full regression: **۱۶۱ فایل PASS / ۰ FAIL، ۳۸۰۸ چک PASS / ۰ FAIL**؛
- `python3 _tools/audit.py`: **PASS، بدون warning**؛
- جزئیات در `REGRESSION-REPORT-v31.7.2.md` ثبت شده است؛
- PHP syntax محلی اجرا نشد چون binary `php` در sandbox موجود نیست.

## وضعیت recovery داده

این Release از حذف بیشتر duplicateها جلوگیری می‌کند؛ اما بازیابی رکوردهایی که قبلاً overwrite شده‌اند فقط از backupهای قبل از sync ممکن است. بدون backup، سیستم نمی‌تواند payload حذف‌شده را از روی حدس بازسازی کند.

## گیت Production

به‌دلیل وجود role-scoped sync و repair داده، no-leak و dry-run repair روی staging مستقل پیش از Production لازم است.

## نسخه

- `VER v31.7.2`
- `CACHE ptf-crm-v31.7.2`
