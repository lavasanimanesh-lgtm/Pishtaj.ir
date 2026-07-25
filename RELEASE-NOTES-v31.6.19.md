# ریلیزنوت v31.6.19 — پوشش Go-Live reset برای کلیدهای تراکنشی جدید

## ۱) RCA
در بررسی مستقیم `crm/golive.js` مشخص شد reset شروع بهره‌برداری واقعی، کلیدهای تراکنشی قدیمی را در `WIPE_KEYS` پاک می‌کند، اما دو کلید فعال جدید یعنی `ptf_crm_payables` و `ptf_crm_surplus` در این فهرست نبودند. بنابراین دادهٔ آزمایشی آن‌ها می‌توانست بعد از pre-golive باقی بماند یا با sync مجدداً برگردد.

## ۲) فایل‌های تغییرکرده

- `crm/golive.js`
- `crm/index.html`
- `crm/sw.js`
- `_tools/uat/tester174-v319-golive-coverage.js`
- `RELEASE-NOTES-v31.6.19.md`
- `REGRESSION-REPORT-v31.6.19.md`
- `BACKLOG-PRIORITIZED-CURRENT-v31.6.19.md`
- `SPRINT-1-DELIVERABLE-STAGE0-v31.6.19.md`
- `STAGE-0-BASELINE-MANIFEST-v31.6.19.txt`
- `INSTALL-GUIDE.md`
- `PTF-MASTER-HANDOVER.md`

## ۳) تغییر و دامنهٔ اثر

- `ptf_crm_payables` به reset تراکنشی Go-Live اضافه شد؛
- `ptf_crm_surplus` به reset تراکنشی Go-Live اضافه شد؛
- هر دو کلید اکنون در pre-golive backup که با `WIPE_KEYS.concat(...)` ساخته می‌شود نیز پوشش دارند؛
- کلیدهای حفاظت‌شده مانند کاربران، نقش‌ها، تنظیمات، امضاها و templateها دست‌نخورده می‌مانند؛
- مسیر server wipe همچنان فقط با `allow_wipe: true` و پس از backup پیشینی اجرا می‌شود؛
- هیچ migration یا حذف خودکار در Production انجام نشده است.

## ۴) regression و audit

- `tester174-v319-golive-coverage.js`: **۶ PASS / ۰ FAIL**؛
- `node --check crm/golive.js`: PASS؛
- `node --check _tools/uat/tester174-v319-golive-coverage.js`: PASS؛
- full regression: **۱۵۱ فایل PASS / ۰ FAIL، ۳۷۳۲ چک PASS / ۰ FAIL**؛
- `python3 _tools/audit.py`: **PASS، بدون warning**؛
- جزئیات در `REGRESSION-REPORT-v31.6.19.md` ثبت شده است؛
- PHP syntax محلی اجرا نشد چون binary `php` در sandbox موجود نیست.

## ۵) Evidence قابل استناد

tester174 موارد زیر را کنترل می‌کند:

1. وجود surplus در WIPE_KEYS؛
2. وجود payables در WIPE_KEYS؛
3. عدم ورود کلیدهای حفاظت‌شده به wipe؛
4. عدم تکرار کلیدها؛
5. پوشش WIPE_KEYS در pre-golive backup؛
6. وجود backup پیشینی، `allow_wipe` و guard سروری.

## ۶) مراحل verification کارفرما

1. روی staging مستقل، fixture آزمایشی برای `ptf_crm_payables` و `ptf_crm_surplus` قرار دهید.
2. از مسیر Go-Live، pre-golive backup را بگیرید.
3. بررسی کنید هر دو کلید داخل backup pre-golive وجود دارند.
4. reset را فقط روی staging اجرا کنید.
5. خالی‌شدن دو کلید و باقی‌ماندن users/settings/perms را بررسی کنید.
6. بازگشت دادهٔ آزمایشی از sync را بررسی کنید.
7. روی Production اجرای آزمایشی Go-Live انجام نشود.

## ۷) approval و محدودیت

این تغییر یک اصلاح محدود در فهرست reset تراکنشی موجود است و refactor معماری، migration یا حذف دادهٔ Production نیست؛ approval پیشینی refactor لازم نشد. اجرای واقعی reset همچنان به staging مستقل و backup قابل‌بازگشت نیاز دارد.

## نسخه

- `VER v31.6.19`
- `CACHE ptf-crm-v31.6.19`
