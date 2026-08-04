# گزارش فاز تولید صفحات محصول جدید و QA
**تاریخ:** ۲۰۲۶-۰۸-۰۴  
**دامنه:** سایت عمومی؛ بدون تغییر در `crm/` و `api/`

## صفحات جدید ایجادشده
| صفحه | محصول | تصویر کم‌حجم |
|---|---|---|
| `services/products/stainless-steel-pipe.html` | لوله استنلس استیل ASTM A312 | `assets/images/products/generated/stainless-steel-pipe-realistic.jpg` |
| `services/products/forged-fittings.html` | فیتینگ فورج ASME B16.11 | `assets/images/products/generated/forged-fittings-realistic.jpg` |
| `services/products/industrial-power-instrument-cable.html` | کابل قدرت و ابزار دقیق صنعتی | `assets/images/products/generated/industrial-cables-realistic.jpg` |
| `services/products/industrial-ups-battery-charger.html` | UPS صنعتی و شارژر باتری | `assets/images/products/generated/industrial-ups-battery-charger-realistic.jpg` |

## اصول رعایت‌شده
- هر صفحه بالای ۱۵۰۰ کلمه است.
- تصاویر تک‌محصولی، واقع‌گرایانه، بدون لوگو/متن/واترمارک و کم‌حجم هستند.
- Product Schema، FAQ Schema و Breadcrumb Schema در صفحات جدید وجود دارد.
- CTA موبایلی سریع برای RFQ همان محصول اضافه شده است.
- صفحات در هاب محصولات قابل جستجو و فیلتر هستند.
- هاب محصولات با ۳۵ کارت و ItemList Schema به‌روزرسانی شد.

## منابع تحقیق خارجی استفاده‌شده در تدوین موضوعات
- برای لوله استنلس، استانداردهای ASTM A312 و ASME B36.19M و کاربرد گریدهای 304/316 از منابع فنی مرتبط بررسی شد.
- برای فیتینگ فورج، ASME B16.11، MSS SP-83 و محصولات Bonney Forge بررسی شد.
- برای کابل قدرت/ابزار دقیق، استانداردهای IEC 60502، IEC 60228، IEC 60332، BS/PAS 5308 و برندهای صنعتی بررسی شد.
- برای UPS صنعتی، IEC 62040 و برندهای مطرح صنعتی مانند Schneider Electric، Eaton، Vertiv، ABB و Socomec در تحقیق لحاظ شد.

## اعتبارسنجی
```text
product_pages=35
qa_errors=0
sitemap URLs=552
لینک شکسته عمومی=0
JSON-LD parse error=0
```

`python3 _tools/audit.py` اجرا شد. تنها خطای باقی‌مانده خارج از حوزه سئو است:

`release-docs: window.VER در crm/index.html پیدا نشد`

طبق دستور، CRM تغییر داده نشد.

## ابزارهای اضافه‌شده
- `_tools/create_new_product_pages_phase1.py`
- `_tools/extend_new_product_pages_phase1.py`
