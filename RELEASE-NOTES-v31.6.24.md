# ریلیزنوت v31.6.24 — رفع race احراز هویت و sync stale data

## ۱) RCA
بعد از hotfix full pull، یک مسیر باقی‌مانده وجود داشت: اگر browser توکن قدیمی/منقضی داشت، `data_pull` پاسخ 401 می‌داد. `pullCheck` این پاسخ را فقط به‌عنوان خطای عادی تمام می‌کرد و callback startup، کلاینت را `bootstrapped` اعلام می‌کرد. در نتیجه دادهٔ stale local باقی می‌ماند و همان اختلاف Chrome/Firefox یا دستگاه‌ها ادامه پیدا می‌کرد.

## ۲) فایل‌های تغییرکرده

- `crm/sync.js`
- `crm/index.html`
- `crm/sw.js`
- `_tools/uat/tester170-v3172-sync-auth.js`
- `_tools/uat/tester179-v324-sync-auth-race.js`
- `RELEASE-NOTES-v31.6.24.md`
- `REGRESSION-REPORT-v31.6.24.md`
- `BACKLOG-PRIORITIZED-CURRENT-v31.6.24.md`
- `SPRINT-1-DELIVERABLE-STAGE0-v31.6.24.md`
- `STAGE-0-BASELINE-MANIFEST-v31.6.24.txt`
- `INSTALL-GUIDE.md`
- `PTF-MASTER-HANDOVER.md`

## ۳) تغییر و دامنهٔ اثر

- `refreshAuthToken()` با session/passhash موجود، token معتبر جدید می‌گیرد؛
- توکن stale قبل از refresh پاک می‌شود؛
- پاسخ 401، `needLogin` یا token error دیگر startup را fresh اعلام نمی‌کند؛
- pull pending پس از refresh دوباره اجرا می‌شود؛
- `forceFull` در retry حفظ می‌شود، بنابراین startup همچنان با `since=0` snapshot کامل می‌گیرد؛
- هیچ reset، migration یا تغییر auth مالی Production انجام نشده است.

## ۴) regression و audit

- `tester170-v3172-sync-auth.js`: **۶ PASS / ۰ FAIL**؛
- `tester178-v323-sync-divergence.js`: **۹ PASS / ۰ FAIL**؛
- `tester179-v324-sync-auth-race.js`: **۶ PASS / ۰ FAIL**؛
- full regression: **۱۵۶ فایل PASS / ۰ FAIL، ۳۷۷۴ چک PASS / ۰ FAIL**؛
- `python3 _tools/audit.py`: **PASS، بدون warning**؛
- جزئیات در `REGRESSION-REPORT-v31.6.24.md` ثبت شده است؛
- `node --check crm/sync.js`: PASS؛
- PHP syntax محلی اجرا نشد چون binary `php` در sandbox موجود نیست.

## ۵) Evidence قابل استناد

tester179 موارد زیر را کنترل می‌کند:

1. refresh token با session/passhash؛
2. عدم fresh اعلام‌کردن 401؛
3. پاک‌کردن token stale؛
4. اجرای دوبارهٔ pull بعد از refresh؛
5. حفظ `forceFull` و `since=0`؛
6. boot فقط بعد از callback pull.

## ۶) مراحل verification کارفرما

1. در Chrome و Firefox با یک کاربر وارد شوید.
2. در یکی از browserها token قدیمی را در Application Storage شبیه‌سازی/پاک کنید.
3. reload کامل انجام دهید.
4. در Network ابتدا `auth_login` و سپس `data_pull?since=0` را بررسی کنید.
5. پاسخ 401 نباید باعث نمایش local stale بدون retry شود.
6. تعداد درخواست‌ها و پیشنهادها را با browser دیگر مقایسه کنید.
7. همین تست را روی دستگاه دوم انجام دهید.

## ۷) approval و محدودیت

این hotfix اصلاح race در sync/auth refresh موجود است و session server-side، CSRF یا workflow مالی Production را پیاده‌سازی نمی‌کند؛ approval refactor لازم نشد. UAT endpoint واقعی پس از deploy لازم است.

## نسخه

- `VER v31.6.24`
- `CACHE ptf-crm-v31.6.24`
