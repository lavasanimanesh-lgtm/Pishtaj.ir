# ریلیزنوت v31.6.17 — integrity فروش مازاد پروژه (US-436 light)

## ۱) RCA
در v31.6.16 مازاد پروژه قابل ثبت، جستجو و رزرو بود؛ اما رویداد «برنده‌شدن CO» به commit فروش مازاد وصل نشده بود. در نتیجه رزرو پس از برد می‌توانست در وضعیت `reserved` باقی بماند و `soldQty` به‌روزرسانی نشود. برای پیشنهاد باخته نیز آزادسازی رزروِ متصل به offer وجود نداشت.

## ۲) فایل‌های تغییرکرده

- `crm/surplus.js`
- `crm/index.html`
- `crm/sw.js`
- `_tools/run-full-regression.js`
- `_tools/uat/tester172-v3174-surplus-sale-integrity.js`
- `PTF-MASTER-HANDOVER.md`
- `BACKLOG-PRIORITIZED-CURRENT-v31.6.17.md`
- `REGRESSION-REPORT-v31.6.17.md`
- `SPRINT-1-DELIVERABLE-STAGE0-v31.6.17.md`
- `STAGE-0-BASELINE-MANIFEST-v31.6.17.txt`
- `INSTALL-GUIDE.md`

## ۳) تغییر و دامنهٔ اثر

- رزرو مازاد با `offerNo` و provenance ذخیره می‌شود؛
- `ptfSurplusWinGuard()` پیش از برد، وجود قلم و کفایت رزرو را بررسی می‌کند؛
- `ptfSurplusFinalizeForOffer()` پس از برد، مقدار را از `reservedQty` کم و به `soldQty` اضافه می‌کند؛
- `saleRefs` از commit تکراری جلوگیری می‌کند؛
- برد با رزرو ناکافی متوقف می‌شود؛
- باخت CO/TC رزرو متصل را آزاد می‌کند؛
- پیشنهادهای بدون `sourceSurplusCd` تغییری نمی‌کنند؛
- متن گزارش تولیدشده توسط runner از warning تاریخی تصاویر به `PASS (بدون warning)` اصلاح شد؛
- انبار کامل، انتقال بین انبارها، migration و US-437 در این release نیستند.

## ۴) regression و audit

- `node --check crm/surplus.js`: PASS؛
- `node --check _tools/uat/tester172-v3174-surplus-sale-integrity.js`: PASS؛
- `tester172-v3174-surplus-sale-integrity.js`: **۱۰ PASS / ۰ FAIL**؛
- full regression: **۱۴۹ فایل PASS / ۰ FAIL، ۳۷۲۰ چک PASS / ۰ FAIL**؛
- `python3 _tools/audit.py`: **PASS، بدون warning**؛
- جزئیات در `REGRESSION-REPORT-v31.6.17.md` ثبت شده است؛
- PHP syntax محلی اجرا نشد چون `php` در sandbox موجود نیست؛ بررسی endpoint Production لازم است.

## ۵) evidence قابل استناد

سناریوهای tester172:

1. اتصال رزرو به offer؛
2. commit برد به `soldQty`؛
3. idempotency در commit تکراری؛
4. توقف برد با رزرو ناکافی؛
5. آزادسازی رزرو در باخت.

همچنین markerهای نسخه در `crm/index.html` و `crm/sw.js` روی `v31.6.17` هستند و بستهٔ نهایی flat-root خواهد بود.

## ۶) مراحل verification کارفرما

1. یک مازاد با تعداد ۵ از مسیر «مازاد پروژه» ثبت کنید.
2. از عملیات فروش، تعداد ۲ را انتخاب و CO ساخته‌شده را ذخیره کنید.
3. وضعیت CO را «برنده» کنید.
4. در جدول مازاد مقدار فروخته‌شده را ۲ و رزروشده را صفر بررسی کنید.
5. یک CO با مقدار بیشتر از رزرو موجود بسازید؛ انتخاب «برنده» باید متوقف شود.
6. یک رزرو متصل به CO بازنده را باخت بزنید؛ رزرو باید آزاد شود.
7. موارد فاقد `sourceSurplusCd` را بررسی کنید؛ رفتار پیشنهادهای عادی نباید تغییر کند.

## ۷) approval و محدودیت

این تغییر hardening محدود روی ماژول موجود و hook رویدادمحور است و refactor معماری گسترده، migration یا حذف داده نیست؛ بنابراین approval پیشینی برای refactor لازم نشد. هر تغییر برای انبار کامل یا policy مالی نیازمند approval مستقل است.

## نسخه

- `VER v31.6.17`
- `CACHE ptf-crm-v31.6.17`
- US-436 فقط در دامنهٔ «موجودی مازاد پروژه / انبار سبک» باقی می‌ماند.
