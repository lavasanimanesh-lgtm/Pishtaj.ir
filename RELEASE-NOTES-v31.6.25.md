# ریلیزنوت v31.6.25 — رفع token bootstrap برای admin

## ۱) RCA
در بررسی مستقیم Production مشخص شد `data_rev` مقدار revision را برمی‌گرداند، اما `data_pull` بدون token پاسخ 401 می‌دهد. مسیر refresh token در sync فقط `ptf_crm_users[].passhash` را می‌خواند. کاربر admin در معماری فعلی می‌تواند با `ADMIN_HASH` یا `settings.adminHash` احراز شود و لزوماً رکوردی در `ptf_crm_users` ندارد؛ بنابراین token برای admin ساخته نمی‌شد و sync روی local stale باقی می‌ماند.

## ۲) فایل‌های تغییرکرده

- `crm/index.html`
- `crm/sync.js`
- `_tools/uat/tester170-v3172-sync-auth.js`
- `_tools/uat/tester179-v324-sync-auth-race.js`
- `_tools/uat/tester180-v325-admin-token-bridge.js`
- `crm/sw.js`
- `RELEASE-NOTES-v31.6.25.md`
- `REGRESSION-REPORT-v31.6.25.md`
- `BACKLOG-PRIORITIZED-CURRENT-v31.6.25.md`
- `SPRINT-1-DELIVERABLE-STAGE0-v31.6.25.md`
- `STAGE-0-BASELINE-MANIFEST-v31.6.25.txt`
- `INSTALL-GUIDE.md`
- `PTF-MASTER-HANDOVER.md`

## ۳) تغییر و دامنهٔ اثر

- `showCrm()` برای admin از `settings.adminHash` یا `ADMIN_HASH` token می‌گیرد؛
- `refreshAuthToken()` در sync همین fallback را دارد؛
- admin دیگر به وجود `ptf_crm_users` برای token bootstrap وابسته نیست؛
- بعد از token موفق، startup full pull با `since=0` اجرا می‌شود؛
- هیچ reset، migration یا تغییر role/auth server-side انجام نشده است.

## ۴) regression و audit

- `tester170-v3172-sync-auth.js`: **۶ PASS / ۰ FAIL**؛
- `tester178-v323-sync-divergence.js`: **۹ PASS / ۰ FAIL**؛
- `tester179-v324-sync-auth-race.js`: **۶ PASS / ۰ FAIL**؛
- `tester180-v325-admin-token-bridge.js`: **۴ PASS / ۰ FAIL**؛
- full regression: **۱۵۷ فایل PASS / ۰ FAIL، ۳۷۷۸ چک PASS / ۰ FAIL**؛
- `python3 _tools/audit.py`: **PASS، بدون warning**؛
- جزئیات در `REGRESSION-REPORT-v31.6.25.md` ثبت شده است؛
- `node --check crm/sync.js`: PASS؛
- PHP syntax محلی اجرا نشد چون binary `php` در sandbox موجود نیست.

## ۵) Evidence قابل استناد

tester180 کنترل می‌کند:

1. fallback admin در `showCrm`؛
2. fallback admin در sync refresh؛
3. ارسال passhash صحیح به `auth_login`؛
4. حفظ retry مسیر 401.

## ۶) مراحل verification کارفرما

1. با کاربر admin وارد شوید.
2. در Network باید ابتدا `auth_login` با HTTP 200 و token موفق دیده شود.
3. سپس `data_pull?since=0` باید با HTTP 200 پاسخ دهد.
4. داده‌های درخواست و پیشنهاد را در Chrome و Firefox مقایسه کنید.
5. همین تست را در دستگاه دوم انجام دهید.
6. اگر `auth_login` شکست خورد، response آن و status/token storage را ارسال کنید؛ در این حالت مشکل credential/adminHash است، نه pull.

## ۷) approval و محدودیت

این تغییر اصلاح token bootstrap موجود است و server-side session/RBAC/CSRF یا migration نیست؛ approval refactor لازم نشد. UAT واقعی Production بعد از deploy لازم است.

## نسخه

- `VER v31.6.25`
- `CACHE ptf-crm-v31.6.25`
