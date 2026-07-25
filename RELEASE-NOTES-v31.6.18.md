# ریلیزنوت v31.6.18 — پوشش کامل‌تر بک‌آپ و restore

## ۱) RCA
در بررسی مستقیم source، کلید `ptf_crm_trash` در `sync.js` و whitelist سرور `api/crm.php` وجود داشت، اما در `crm/backup.js` داخل `DATA_KEYS` نبود. در نتیجه دادهٔ این کلید در بک‌آپ دستی/سروری جمع‌آوری نمی‌شد و در restore نیز تحت پوشش همان قرارداد قرار نمی‌گرفت.

## ۲) فایل‌های تغییرکرده

- `crm/backup.js`
- `crm/index.html`
- `crm/sw.js`
- `_tools/uat/tester173-v318-backup-coverage.js`
- `RELEASE-NOTES-v31.6.18.md`
- `REGRESSION-REPORT-v31.6.18.md`
- `BACKLOG-PRIORITIZED-CURRENT-v31.6.18.md`
- `SPRINT-1-DELIVERABLE-STAGE0-v31.6.18.md`
- `STAGE-0-BASELINE-MANIFEST-v31.6.18.txt`
- `PTF-MASTER-HANDOVER.md`

## ۳) تغییر و دامنهٔ اثر

- `ptf_crm_trash` به `DATA_KEYS` بک‌آپ اضافه شد؛
- مسیر collect و restore موجود، بدون refactor، همین کلید را پوشش می‌دهد؛
- هیچ schema یا داده‌ای migrate، حذف یا بازنویسی نشده است؛
- قرارداد پوشش کلیدهای sync/API/backup در tester173 کنترل می‌شود؛
- دامنه فقط backup/restore و هم‌راستایی کلیدهاست؛ FIN-WF-001، US-437 و انبار کامل تغییری نکرده‌اند.

## ۴) regression و audit

- `tester173-v318-backup-coverage.js`: **۶ PASS / ۰ FAIL**؛
- `node --check crm/backup.js`: PASS؛
- `node --check _tools/uat/tester173-v318-backup-coverage.js`: PASS؛
- full regression: **۱۵۰ فایل PASS / ۰ FAIL، ۳۷۲۶ چک PASS / ۰ FAIL**؛
- `python3 _tools/audit.py`: **PASS، بدون warning**؛
- جزئیات در `REGRESSION-REPORT-v31.6.18.md` ثبت شده است؛
- PHP syntax محلی اجرا نشد چون binary `php` در sandbox موجود نیست.

## ۵) Evidence قابل استناد

tester173 موارد زیر را بررسی می‌کند:

1. وجود `ptf_crm_trash` در backup؛
2. وجود آن در sync و API whitelist؛
3. نبودن کلید sync بدون پوشش backup؛
4. نبودن کلید API بدون پوشش sync/backup؛
5. نبود کلید تکراری در `DATA_KEYS`؛
6. مصرف همان `DATA_KEYS` در restore.

## ۶) مراحل verification کارفرما

1. قبل از تست، یک مقدار fixture در `localStorage` با کلید `ptf_crm_trash` قرار دهید.
2. از تنظیمات، بک‌آپ فایل یا بک‌آپ سروری بگیرید.
3. در payload بک‌آپ وجود `ptf_crm_trash` را بررسی کنید.
4. همان فایل را در یک staging fixture بازگردانی کنید.
5. مقدار `ptf_crm_trash` را بعد از restore بررسی کنید.
6. سپس sync و restore سروری را در staging مستقل آزمایش کنید؛ روی Production mutation آزمایشی انجام نشود.

## ۷) approval و محدودیت

این تغییر یک اصلاح محدود در فهرست کلیدهای backup است و refactor معماری، migration یا حذف داده نیست؛ approval پیشینی برای refactor لازم نشد. اجرای واقعی restore روی staging همچنان به فراهم‌شدن محیط مستقل Stage 0 وابسته است.

## نسخه

- `VER v31.6.18`
- `CACHE ptf-crm-v31.6.18`
