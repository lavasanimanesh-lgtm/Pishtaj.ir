# گزارش اجرای موج اول صفحات محصول سئو
**تاریخ:** ۲۰۲۶-۰۸-۰۴  
**دامنه:** فقط سایت عمومی؛ بدون تغییر در `crm/` و `api/`

## صفحات ایجاد/بازطراحی‌شده
در این موج، ۱۲ صفحه محصول جدید ساخته شد و ۴ صفحه محصول قبلی نیز با همان استاندارد بازطراحی و جامع‌سازی شد. تمام صفحات محصول محتوای فارسی بلند، ساختار سئویی کامل، لینک‌سازی داخلی، Product Schema، FAQ Schema، Breadcrumb Schema، Open Graph، Twitter Card، canonical و hreflang دارند.

| صفحه | تعداد کلمه تقریبی |
|---|---:|
| `services/products/ball-valve.html` | 1715 |
| `services/products/rosemount-3051.html` | 1668 |
| `services/products/seamless-pipe.html` | 1665 |
| `services/products/welding-flanges.html` | 1666 |
| `services/products/gate-valve.html` | 1709 |
| `services/products/globe-valve.html` | 1705 |
| `services/products/check-valve.html` | 1708 |
| `services/products/control-valve.html` | 1688 |
| `services/products/flowmeter.html` | 1651 |
| `services/products/pressure-transmitter.html` | 1670 |
| `services/products/api-5l-pipe.html` | 1692 |
| `services/products/butt-weld-fittings.html` | 1663 |
| `services/products/industrial-gaskets.html` | 1645 |
| `services/products/lv-mv-switchgear.html` | 1672 |
| `services/products/api-610-centrifugal-pump.html` | 1676 |
| `services/products/shell-tube-heat-exchanger.html` | 1697 |

> صفحه `services/products/index.html` به‌عنوان هاب محصولات ساخته شد و ماهیت مقاله‌ای ندارد؛ بنابراین شرط ۱۵۰۰ کلمه برای آن اعمال نشده است.

## ساختار مشترک هر صفحه محصول
- Hero گرافیکی و محصول‌محور
- معرفی کاربردی و غیرکلیشه‌ای محصول
- استانداردهای مرجع و محدوده کاربرد
- انواع/پیکربندی‌های قابل انتخاب
- متریال و سازگاری با سرویس
- جدول مشخصات و داده‌های RFQ
- کاربردها در صنایع هدف
- مدارک لازم برای RFQ
- خطاهای رایج خرید
- راهنمای ارزیابی پیشنهاد فروشنده
- کنترل کیفیت، بازرسی و تحویل
- CTA ثبت RFQ
- لینک‌های داخلی به مقالات مرکز دانش و صفحات خدمات
- FAQ اختصاصی بر اساس خوشه محصول

## اعتبارسنجی
- `sitemap.xml` بازسازی شد و اکنون ۵۳۳ URL عمومی دارد.
- لینک شکسته عمومی پس از اصلاحات دیده نشد.
- متادیتاهای پایه، canonical، OG، Twitter Card، Schema و hreflang در بررسی نمونه و اسکریپتی سالم هستند.
- اجرای `python3 _tools/audit.py` فقط یک خطای خارج از دامنه سئو نشان می‌دهد: `window.VER` در `crm/index.html` پیدا نشد. طبق دستور کار، CRM تغییر داده نشد.
