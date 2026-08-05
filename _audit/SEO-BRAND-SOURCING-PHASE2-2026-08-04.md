# گزارش فاز دوم برندمحور و سورسینگ سئو
**تاریخ:** ۲۰۲۶-۰۸-۰۴  
**دامنه:** سایت عمومی؛ بدون تغییر در `crm/` و `api/`

## صفحات جدید ایجادشده
| صفحه | برند | تعداد کلمه تقریبی |
|---|---|---:|
| `brands/endress-hauser.html` | Endress+Hauser | ۱۵۳۷ |
| `brands/yokogawa-industrial.html` | Yokogawa | ۱۵۶۰ |
| `brands/wika-instrumentation.html` | WIKA | ۱۵۴۳ |
| `brands/schneider-electric.html` | Schneider Electric | ۱۵۴۶ |

## تحقیق اولیه خارجی
- Endress+Hauser: محصولات Pressure، Flow، Level، Temperature و Liquid Analysis بررسی شد.
- Yokogawa: EJA/EJX، DCS، Flowmeter، Analyzer و Automation بررسی شد.
- WIKA: Pressure Gauge، Thermowell، Diaphragm Seal، Pressure/Temperature Instrumentation بررسی شد.
- Schneider Electric: Modicon، Altivar، TeSys، Switchgear، Circuit Breaker و EcoStruxure بررسی شد.

## اصول رعایت‌شده
- هیچ ادعای نمایندگی رسمی مطرح نشده است.
- از لوگوی برندها استفاده نشده است.
- هر صفحه به وب‌سایت رسمی برند لینک داده است.
- هر صفحه به محصولات مرتبط سایت لینک داخلی دارد.
- Schema نوع WebPage/Brand/BreadcrumbList اضافه شده است.
- هدف صفحات: جذب جستجوهای برندمحور و انتقال اعتبار برند/وندور به دامنه اصلی.

## اعتبارسنجی
- `sitemap.xml` بازسازی شد و اکنون ۶۰۴ URL عمومی دارد.
- JSON-LD صفحات جدید معتبر است.
- metrics، canonical و hreflang فعال هستند.
- اجرای audit کامل فقط خطای خارج از حوزه سئو را نشان می‌دهد: `window.VER` در `crm/index.html` پیدا نشد.

طبق دستور، CRM تغییر داده نشد.
