# گزارش موج دوم صفحات محصول سئو
**تاریخ:** ۲۰۲۶-۰۸-۰۴  
**دامنه:** سایت عمومی؛ بدون تغییر در `crm/` و `api/`

## هدف فاز
موج دوم برای تکمیل خوشه‌های محصولی مهم بعد از موج اول اجرا شد؛ تمرکز روی شیرآلات تکمیلی، ابزار دقیق دقیق‌تر، برق صنعتی، پمپ/کمپرسور، بخار و تجهیزات ثابت بود.

## صفحات محصول ایجادشده
تمام صفحات زیر محتوای بلند، یکتا، کاربردی و بالای ۱۵۰۰ کلمه دارند و شامل Product Schema، FAQ Schema، Breadcrumb Schema، متادیتا، canonical، hreflang، CTA و لینک‌سازی داخلی هستند.

| صفحه | تعداد کلمه تقریبی |
|---|---:|
| `services/products/butterfly-valve.html` | 1659 |
| `services/products/psv-prv-safety-valve.html` | 1630 |
| `services/products/valve-actuator.html` | 1582 |
| `services/products/differential-pressure-transmitter.html` | 1608 |
| `services/products/magnetic-flowmeter.html` | 1562 |
| `services/products/coriolis-flowmeter.html` | 1562 |
| `services/products/vortex-flowmeter.html` | 1532 |
| `services/products/radar-level-transmitter.html` | 1581 |
| `services/products/vfd-soft-starter.html` | 1611 |
| `services/products/industrial-circuit-breakers.html` | 1587 |
| `services/products/power-transformer.html` | 1571 |
| `services/products/dosing-metering-pump.html` | 1569 |
| `services/products/screw-compressor.html` | 1605 |
| `services/products/steam-trap.html` | 1587 |
| `services/products/pressure-vessel.html` | 1554 |

## لینک‌سازی داخلی موج دوم
برای ۴۱ مقاله/راهنمای مرتبط در `knowledge-center/` و `blog/` باکس مسیر خرید/استعلام اضافه شد. همچنین در ۸ صفحه خدمات، بخش محصولات تکمیلی مرتبط اضافه شد.

خوشه‌های پوشش داده‌شده:
- Butterfly Valve
- PSV / PRV / Safety Valve
- Valve Actuator
- DP Transmitter
- Magnetic / Coriolis / Vortex Flowmeter
- Radar Level Transmitter
- VFD & Soft Starter
- ACB / MCCB / VCB
- Power Transformer
- Dosing Pump
- Screw Compressor
- Steam Trap
- Pressure Vessel

## ابزارهای اضافه‌شده
- `/_tools/generate_product_pages_wave2.py`
- `/_tools/add_product_internal_links_wave2.py`

## به‌روزرسانی هاب و sitemap
- `services/products/index.html` به‌روزرسانی شد و اکنون همه صفحات محصول موجود را فهرست می‌کند.
- `sitemap.xml` بازسازی شد و اکنون ۵۴۸ URL عمومی دارد.

## اعتبارسنجی
پس از اجرا:

| شاخص | نتیجه |
|---|---:|
| صفحات عمومی HTML | ۵۴۸ |
| URLهای sitemap | ۵۴۸ |
| لینک شکسته عمومی | ۰ |
| JSON-LD parse error | ۰ |
| صفحات فاقد metrics | ۰ |
| تصاویر فاقد loading | ۰ |
| تصاویر فاقد width/height | ۴ مورد داینامیک/تمپلیتی |

`python3 _tools/audit.py` اجرا شد و تنها خطای باقی‌مانده خارج از حوزه سئو است: `window.VER` در `crm/index.html` پیدا نشد. طبق دستور، CRM تغییر داده نشد.
