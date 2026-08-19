# یادداشت انتشار v34.7.46 — قطعیت «ثبت نشده» پس از بازیابی journal

**تاریخ:** 2026-08-19

**دامنهٔ استقرار:** فقط staging؛ production ممنوع است.

این patch تکمیل‌کنندهٔ v34.7.45 است. `command_status` زیر lock مشترک و پس از تکمیل WAL پاسخ می‌دهد؛ بنابراین پاسخ موفق `committed:false` در این نقطه اثبات می‌کند فرمان قبلی commit نشده است و دیگر نباید به‌عنوان uncertain نگه داشته شود.

## رفتار نهایی

پس از دو پاسخ مبهم mutation:

- `committed:true` → ACK قطعی از receipt فشرده، pull projection و جلوگیری از اجرای دوباره؛
- `committed:false` → رد قطعی با `command_not_committed` و امکان بازکردن/ثبت دوبارهٔ فرم؛
- خود `command_status` نیز در دسترس نیست → فقط در این حالت uncertain و payload/operation ID قفل‌شده باقی می‌مانند.

برای diagnosticهای uncertain ذخیره‌شده از نسخهٔ قبلی نیز:

- receipt قطعی committed باعث بازیابی و sync می‌شود؛
- نبود receipt پس از recovery قطعی، diagnostic را به `not_committed` تبدیل و پیام صریح برای ثبت دوباره نمایش می‌دهد؛
- هیچ mutationای هنگام boot دوباره ارسال نمی‌شود.

تمام قابلیت‌های فرم کامل رویژن، metadata اقلام، شرایط، نرخ مرجع و قفل هویت v34.7.45 بدون تغییر حفظ شده‌اند.
