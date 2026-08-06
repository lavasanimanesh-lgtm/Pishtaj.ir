# گزارش فاز سوم برندمحور و سورسینگ سئو
**تاریخ:** ۲۰۲۶-۰۸-۰۴  
**دامنه:** سایت عمومی؛ بدون تغییر در `crm/` و `api/`

## صفحات جدید ایجادشده
| صفحه | برند/گروه | تعداد کلمه تقریبی |
|---|---|---:|
| `brands/flexitallic-gaskets.html` | Flexitallic / Gaskets | ۱۵۱۸ |
| `brands/galperti-flanges.html` | Galperti / Flanges | ۱۵۰۰ |
| `brands/tenaris-pipes.html` | Tenaris / Pipes | ۱۵۱۰ |
| `brands/vallourec-pipes.html` | Vallourec / Pipes | ۱۵۵۸ |
| `brands/krohne-instrumentation.html` | KROHNE / Instrumentation | ۱۵۱۸ |
| `brands/fisher-samson-control-valves.html` | Fisher / SAMSON Control Valves | ۱۵۴۳ |

## تحقیق اولیه خارجی
- Flexitallic: Spiral Wound، Flexpro/Kammprofile، RTJ، Thermiculite و کاربردهای Oil & Gas بررسی شد.
- Galperti: ASME B16.5/B16.47، Orifice Flange، API و NORSOK Flanges بررسی شد.
- Tenaris: OCTG، Line Pipe، Seamless/Welded Pipe و TenarisHydril بررسی شد.
- Vallourec: Seamless Pipe، Mechanical Tubing، Sour Service و Alloy Grades بررسی شد.
- KROHNE: Flow، Level، DP Flow و Instrumentation بررسی شد.
- Fisher/SAMSON: Control Valve، Positioner، Actuator، Sizing Sheet و Final Control بررسی شد.

## اصول رعایت‌شده
- بدون ادعای نمایندگی رسمی.
- بدون استفاده از لوگوی برندها.
- لینک به سایت رسمی برند با `rel="noopener"`.
- لینک داخلی به محصولات مرتبط سایت.
- Schema نوع WebPage / Brand / BreadcrumbList.
- محتوای بالای ۱۵۰۰ کلمه برای هر صفحه برندمحور.

## هاب برندها
`brands/index.html` بازسازی شد و اکنون:
- ۱۴ صفحه برندمحور را پوشش می‌دهد.
- جستجو دارد.
- فیلتر دسته‌بندی دارد.
- ItemList Schema دارد.

## اعتبارسنجی
- `sitemap.xml` بازسازی شد و اکنون ۶۱۰ URL عمومی دارد.
- JSON-LD صفحات برند معتبر است.
- metrics، canonical و hreflang فعال هستند.
- اجرای audit کامل فقط خطای خارج از حوزه سئو را نشان می‌دهد: `window.VER` در `crm/index.html` پیدا نشد.

طبق دستور، CRM تغییر داده نشد.

## ابزارهای اضافه‌شده
- `_tools/create_brand_sourcing_pages_phase3.py`
- `_tools/rebuild_brand_hub.py`
