# ریلیزنوت v31.6.20 — guardهای integrity پرونده فروش

## ۱) RCA
توابع هستهٔ `sfQcCommit` و `sfShipCommit` از نظر UI فقط داخل پرونده‌های برنده نمایش داده می‌شدند، اما خود توابع پیش از این بررسی نمی‌کردند که رکورد `wonOffer` دارد یا نه. بنابراین فراخوانی مستقیم/برنامه‌ای می‌توانست قبل از تشکیل پروندهٔ post-award، رکورد QC یا ارسال/تحویل ایجاد کند.

## ۲) فایل‌های تغییرکرده

- `crm/salesfiles.js`
- `crm/index.html`
- `crm/sw.js`
- `_tools/uat/tester175-v320-salesfile-postaward-guards.js`
- `RELEASE-NOTES-v31.6.20.md`
- `REGRESSION-REPORT-v31.6.20.md`
- `BACKLOG-PRIORITIZED-CURRENT-v31.6.20.md`
- `SPRINT-1-DELIVERABLE-STAGE0-v31.6.20.md`
- `STAGE-0-BASELINE-MANIFEST-v31.6.20.txt`
- `INSTALL-GUIDE.md`
- `INSTALL-GUIDE.md`
- `PTF-MASTER-HANDOVER.md`

## ۳) تغییر و دامنهٔ اثر

- `sfQcCommit` در هسته، پروندهٔ بدون `wonOffer` را رد می‌کند؛
- `sfShipCommit` در هسته، پروندهٔ بدون `wonOffer` را رد می‌کند؛
- مسیرهای موجود پروندهٔ برنده حفظ شده‌اند؛
- UI در دریافت `null` بدون ثبت event و بدون toast خارج می‌شود؛
- `sfInvoiceRefCommit` و guardهای قبلی دست‌نخورده باقی مانده‌اند؛
- هیچ schema، migration یا حذف داده‌ای انجام نشده است.

## ۴) regression و audit

- `tester175-v320-salesfile-postaward-guards.js`: **۹ PASS / ۰ FAIL**؛
- تسترهای مرتبط `tester107`, `tester108`, `tester109`, `tester110`, `tester114`, `tester127`: همگی PASS؛
- `node --check crm/salesfiles.js`: PASS؛
- full regression: **۱۵۲ فایل PASS / ۰ FAIL، ۳۷۴۱ چک PASS / ۰ FAIL**؛
- `python3 _tools/audit.py`: **PASS، بدون warning**؛
- جزئیات در `REGRESSION-REPORT-v31.6.20.md` ثبت شده است؛
- PHP syntax محلی اجرا نشد چون binary `php` در sandbox موجود نیست.

## ۵) Evidence قابل استناد

tester175 دو مسیر را با fixture واقعی شبیه‌سازی می‌کند:

1. QC پیش از برد: بدون commit؛
2. QC پس از برد: commit موفق؛
3. ارسال/تحویل پیش از برد: بدون commit؛
4. ارسال در پروندهٔ برنده: commit موفق؛
5. کنترل ساختاری guard و رفتار UI در دریافت `null`.

## ۶) مراحل verification کارفرما

1. یک پرونده/درخواست قبل از برنده‌شدن CO را باز کنید.
2. از console یا مسیر UI تلاش کنید QC یا ارسال روی آن ثبت شود؛ نباید event ساخته شود.
3. CO را برنده کنید تا پرونده فروش تشکیل شود.
4. همان عملیات را از داخل پرونده انجام دهید؛ ثبت باید موفق باشد.
5. در timeline و `qcEvents`/`shipEvents` ثبت رویداد را بررسی کنید.
6. ارجاع فاکتور و guard مرحلهٔ تحویل باید مانند قبل باقی بماند.

## ۷) approval و محدودیت

این تغییر یک guard محدود در هستهٔ موجود است و refactor معماری، migration یا تغییر workflow مالی نیست؛ approval پیشینی refactor لازم نشد. UAT واقعی مرورگر و verification Production هنوز لازم است.

## نسخه

- `VER v31.6.20`
- `CACHE ptf-crm-v31.6.20`
