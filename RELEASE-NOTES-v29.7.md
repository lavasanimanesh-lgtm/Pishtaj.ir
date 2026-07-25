# ریلیزنوت v29.7 — تفکیک مالکیت چک شخصی (FIN-WF-002 / FW-C01)

## مشکل
- چک شخصی در کلید گلوبال باقی می‌ماند و با ذخیره کاربر B حذف می‌شد (سناریو بازتولید FW-C01)
- یادآور روزانه و MyDay برای چک شخصی و ثالث انتقالی اعلان می‌داد (FW-H04)

## فیکس
| فایل | تغییر |
|---|---|
| crm/cheques.js | chMigratePersonal() - مهاجرت خودکار چک‌های شخصی لگاسی از گلوبال به کلید شخصی هر کاربر + auto-migrate on boot + chDailyNotify skip personal/third_party/transferred |
| crm/myday.js | چک شخصی در MyDay نمایش داده نشود |
| crm/index.html | VER v29.7 |
| crm/sw.js | CACHE v29.7 |

## تست فرضی مدیریتی
1. با chairman یک چک شخصی 10M ثبت کن
2. با sales1 لاگین کن → چک‌ها → نباید چک شخصی chairman را ببینی
3. با sales1 تغییری ذخیره کن → با chairman لاگین کن → چک شخصی 10M هنوز هست؟ باید باشد
4. چک شخصی نباید یادآور 7 روزه بدهد

## نسخه
- VER v29.7, CACHE ptf-crm-v29.7
