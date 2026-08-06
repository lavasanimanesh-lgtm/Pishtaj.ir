# نقشه پوشش برندها برای سئوی برندمحور و سورسینگ
**تاریخ:** ۲۰۲۶-۰۸-۰۵  
**دامنه:** سایت عمومی؛ بدون تغییر در `crm/` و `api/`

## هدف
این سند برای جلوگیری از تولید پراکنده صفحات برندمحور تهیه شد. از این مرحله به بعد، هر صفحه برند باید فقط وقتی ساخته شود که:

1. برند واقعاً در حوزه فعالیت شرکت مرتبط باشد.
2. صفحه محصول یا خدمت مرتبط در سایت وجود داشته باشد.
3. محتوای صفحه برند با ادعای نمایندگی رسمی نوشته نشود.
4. از لوگوی برند بدون منبع رسمی/مجوز استفاده نشود.
5. صفحه به محصولات مرتبط سایت لینک داخلی بدهد.
6. Part Number، Model Code، کشور ساخت، گواهی‌ها، وندورلیست و مدارک قابل ردیابی در متن پوشش داده شود.

## وضعیت فعلی
- برندهای دارای صفحه: ۲۰ برند/گروه برند
- برندهای پیشنهادی در ماتریس: بیش از ۷۰ برند/گروه
- فایل ماتریس کامل: `_audit/SEO-BRAND-COVERAGE-MATRIX-2026-08-05.csv`

## برندهای پوشش‌داده‌شده فعلی
- Emerson / Rosemount
- Siemens
- ABB
- KITZ
- Endress+Hauser
- Yokogawa
- WIKA
- Schneider Electric
- Flexitallic
- Galperti
- Tenaris
- Vallourec
- KROHNE
- Fisher / SAMSON
- Phoenix Contact
- Omron
- Eaton / Crouse-Hinds
- Spirax Sarco
- Grundfos
- Atlas Copco

## اولویت پیشنهادی فازهای بعدی

### اولویت ۱ — برندهایی که باید قبل از تولید صفحه جدید بررسی شوند
این برندها به محصولات کلیدی و جستجوهای پرتکرار صنعتی وصل هستند:
- VEGA — Level / Radar Level
- Honeywell Analytics — Gas Detection / F&G
- MSA Safety — Gas Detection / Safety
- Dräger — Gas Detection
- Teledyne Gas & Flame — Gas Detection / Flame Detection
- Rotork — Actuator
- AUMA — Actuator
- Flowserve — API Pump / ANSI Pump / Control Valve
- KSB — Pump / Slurry / Valves
- John Crane — Mechanical Seal
- EagleBurgmann — Mechanical Seal
- AESSEAL — Mechanical Seal

### اولویت ۲ — برندهای پایپینگ، کابل، برق و ایمنی
- Velan
- Crane
- Neway
- OMB
- Bonney Forge
- Bray
- JFE Steel
- Nippon Steel
- LISEGA
- Senior Flexonics
- CMP Products
- Hawke International
- DEHN
- nVent ERICO
- Legrand
- LS Electric

### اولویت ۳ — برندهای سیستم‌ها و پکیج‌ها
- Kidde
- Fike
- Minimax
- Cleaver-Brooks
- Bosch Industriekessel
- Weishaupt
- Riello
- Ingersoll Rand
- Kaeser
- Ariel
- Burckhardt Compression

## قواعد نگارشی الزامی برای صفحات برندمحور
عبارات مجاز:
- «سورسینگ تجهیزات برند X»
- «تامین پروژه‌ای تجهیزات برند X بر اساس وندورلیست»
- «بررسی فنی Model Code / Part Number برند X»
- «تامین از منابع معتبر و قابل ردیابی»

عبارات ممنوع مگر با سند رسمی:
- «نمایندگی رسمی برند X»
- «عامل فروش رسمی برند X»
- «تضمین موجودی همه مدل‌های برند X»
- «واردکننده انحصاری برند X»

## معیارهای QA قبل از انتشار صفحه برند
- حداقل ۱۵۰۰ کلمه مفید
- بدون پاراگراف تکراری با صفحات برند دیگر
- توضیح دقیق دامنه محصولات برند
- هشدار حقوقی درباره نبود ادعای نمایندگی رسمی
- لینک به وب‌سایت رسمی برند
- لینک به صفحات محصول مرتبط سایت
- Schema: WebPage + Brand + BreadcrumbList
- canonical، hreflang، OG/Twitter، metrics
- ثبت در sitemap

## گام بعدی پیشنهادی
قبل از ساخت برندهای جدید، بهتر است ۴ صفحه برند اولویت‌دار موجود بازنویسی عمیق شوند تا ریسک‌های گزارش کیفیت کاهش یابد:
1. `brands/galperti-flanges.html`
2. `brands/siemens-industrial.html`
3. `brands/flexitallic-gaskets.html`
4. `brands/tenaris-pipes.html`

سپس سراغ برندهای اولویت ۱ برویم.
