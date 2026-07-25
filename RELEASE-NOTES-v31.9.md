# 🚀 Release Notes v31.9 — SEC-AUTH-SESSION-001

**نوع:** Critical Reliability & Authentication Stabilization  
**مبنای ارتقا:** Production v31.7.98  
**وضعیت:** آماده UAT پس از عبور گیت‌های فنی؛ هنوز بدون تأیید UAT نباید روی Production مستقر شود.

## مسئله
در snapshot عملیاتی، 806 token معتبر برای 4 حساب مشاهده شد. بررسی سورس نشان داد `showCrm()` در هر نمایش مجدد CRM می‌توانست `auth_login` جدیدی صادر کند. همچنین refreshهای هم‌زمان Sync و سقف retry بسیار بالا می‌توانستند در رخداد 401 باعث انباشت token شوند.

## تغییرات
1. CRM هنگام وجود `ptf_crm_token`، در render/reload مجدد token جدید صادر نمی‌کند.
2. refresh token در هر tab به صورت single-flight اجرا می‌شود؛ درخواست‌های هم‌زمان منتظر همان refresh واحد می‌مانند.
3. سقف retry refresh از 30 به 3 کاهش یافت.
4. نقشه tokenها در هر درخواست PHP فقط یک بار خوانده و JSON parse می‌شود.
5. شناسه نسخه، Service Worker cache و cache-busterهای runtime به `v31.9` همگام شدند.

## عمداً تغییر نکرده
- هیچ token فعلی حذف، revoke یا prune نشده است.
- عمر token هفت‌روزه، فرمت token و header `X-CRM-Token` بدون تغییر مانده‌اند.
- password migration، storage authorization و attachment authorization خارج از scope این release هستند.
- استفاده هم‌زمان از چند دستگاه حفظ شده است.

## UAT اجباری
- ورود با حساب تست، سپس refresh: فقط login اولیه مجاز است؛ refresh نباید `auth_login` تازه بسازد.
- `data_pull`، `get_events` و `data_push` باید 200 باشند.
- ورود همان کاربر از browser/device دوم باید مستقل و سالم باشد.
- token نامعتبر باید recovery کنترل‌شده داشته باشد و حداکثر 3 تلاش refresh انجام دهد.

## Rollback
فقط فایل‌های تغییرکرده را از backup پیش از deploy بازگردانید. `crm/data/` و `tokens.json` جزو rollback این release نیستند.

## افزوده بحرانی: BUG-OFFER-SYNC-INTEGRITY-001
- `offer.items` در Sync دیگر union عمومی نمی‌شود و snapshot اتمیک نسخه برنده را حفظ می‌کند.
- برای lineهای جدید `lineId` پایدار و `updatedAtISO` ثبت می‌شود.
- سرور payloadی که duplicate line را نسبت به snapshot سرور افزایش دهد reject و conflict برمی‌گرداند.
- ابزار Repair فقط برای duplicateهای JSON کاملاً یکسان، preview/confirmation/audit دارد؛ cleanup خودکار سراسری انجام نمی‌شود.

## v31.9 — سلامت اقلام و آیکون‌های معنایی Settings
- دکمه دائمی «بررسی اقلام» برای CO/TC با Preview پیش از تعمیر.
- آیکون Settings با خانواده‌های SVG معنایی، unique-per-accordion و fallback غیرتکراری بازطراحی شد.
