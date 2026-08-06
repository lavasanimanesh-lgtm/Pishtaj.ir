# گزارش فاز چهارم برندمحور و سورسینگ سئو
**تاریخ:** ۲۰۲۶-۰۸-۰۴  
**دامنه:** سایت عمومی؛ بدون تغییر در `crm/` و `api/`

## صفحات جدید ایجادشده
| صفحه | برند/گروه | تعداد کلمه تقریبی |
|---|---|---:|
| `brands/phoenix-contact.html` | Phoenix Contact | ۱۵۴۱ |
| `brands/omron-automation.html` | Omron Automation | ۱۵۵۰ |
| `brands/eaton-crouse-hinds.html` | Eaton / Crouse-Hinds | ۱۵۵۷ |
| `brands/spirax-sarco-steam.html` | Spirax Sarco | ۱۵۱۸ |
| `brands/grundfos-pumps.html` | Grundfos | ۱۵۶۴ |
| `brands/atlas-copco-compressed-air.html` | Atlas Copco | ۱۵۳۲ |

## تحقیق اولیه خارجی
- Phoenix Contact: ترمینال، پاور، رله، Surge Protection، PLCnext و Industrial Ethernet بررسی شد.
- Omron: PLC، سنسور، رله، Temperature Controller، Safety و HMI بررسی شد.
- Eaton/Crouse-Hinds: Breaker، UPS، Crouse-Hinds Hazardous Area، Ex Lighting، Enclosure و Cable Gland بررسی شد.
- Spirax Sarco: Steam Trap، PRV، Condensate Recovery و تجهیزات Steam System بررسی شد.
- Grundfos: CR/CRE، Vertical Multistage Pump، Dosing و کاربردهای بوستر/RO/Utility بررسی شد.
- Atlas Copco: Screw Compressor، Instrument Air، ISO 8573-1، Dryer و Filter بررسی شد.

## اصول رعایت‌شده
- بدون ادعای نمایندگی رسمی.
- بدون استفاده از لوگوی برندها.
- لینک به سایت رسمی برند با `rel="noopener"`.
- لینک داخلی به محصولات مرتبط سایت.
- Schema نوع WebPage / Brand / BreadcrumbList.
- محتوای بالای ۱۵۰۰ کلمه برای هر صفحه برندمحور.

## هاب برندها
`brands/index.html` بازسازی شد و اکنون:
- ۲۰ صفحه برندمحور را پوشش می‌دهد.
- جستجو دارد.
- فیلتر دسته‌بندی دارد.
- ItemList Schema دارد.

## اعتبارسنجی
- `sitemap.xml` بازسازی شد و اکنون ۶۱۶ URL عمومی دارد.
- JSON-LD صفحات برند معتبر است.
- metrics، canonical و hreflang فعال هستند.
- اجرای audit کامل فقط خطای خارج از حوزه سئو را نشان می‌دهد: `window.VER` در `crm/index.html` پیدا نشد.

طبق دستور، CRM تغییر داده نشد.

## ابزار اضافه‌شده
- `_tools/create_brand_sourcing_pages_phase4.py`
