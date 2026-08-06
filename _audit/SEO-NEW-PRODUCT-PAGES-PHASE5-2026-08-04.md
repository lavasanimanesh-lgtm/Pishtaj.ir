# گزارش فاز پنجم تولید صفحات محصول جدید
**تاریخ:** ۲۰۲۶-۰۸-۰۴  
**دامنه:** سایت عمومی؛ بدون تغییر در `crm/` و `api/`

## صفحات جدید ایجادشده
| صفحه | محصول | تصویر کم‌حجم |
|---|---|---|
| `services/products/pressure-gauge.html` | گیج فشار صنعتی و Safety Pressure Gauge | `assets/images/products/generated/pressure-gauge-safety-realistic.jpg` |
| `services/products/thermowell.html` | ترموول صنعتی ASME PTC 19.3 TW | `assets/images/products/generated/thermowell-flanged-realistic.jpg` |
| `services/products/temperature-transmitter.html` | ترانسمیتر دما صنعتی | `assets/images/products/generated/temperature-transmitter-headmount-realistic.jpg` |
| `services/products/diaphragm-seal.html` | دیافراگم سیل و Remote Seal | `assets/images/products/generated/diaphragm-seal-remote-realistic.jpg` |

## تحقیق اولیه خارجی
- Pressure Gauge: ASME B40.100، EN 837 و Safety Pattern Gauge بررسی شد.
- Thermowell: ASME PTC 19.3 TW و Wake Frequency Calculation بررسی شد.
- Temperature Transmitter: Rosemount 644، HART/Foundation Fieldbus/PROFIBUS، Head/Rail/Field Mount و Diagnostics بررسی شد.
- Diaphragm Seal: Remote Seal برای سیالات خورنده، داغ، ویسکوز و محافظت از ترانسمیتر بررسی شد.

## اصول رعایت‌شده
- همه صفحات بالای ۱۵۰۰ کلمه هستند.
- تصاویر واقع‌گرایانه، تک‌محصولی، بدون لوگو/متن/واترمارک و کم‌حجم هستند.
- Product Schema، FAQ Schema و Breadcrumb Schema وجود دارد.
- CTA موبایلی سریع و لینک RFQ همان محصول وجود دارد.
- صفحات در هاب محصولات قابل جستجو و فیلتر هستند.
- هاب محصولات به ۵۱ صفحه محصول و sitemap به ۵۶۸ URL عمومی رسید.

## QA
```text
product_pages=51
qa_errors=0
sitemap URLs=568
لینک شکسته عمومی=0
JSON-LD parse error=0
```

`python3 _tools/audit.py` اجرا شد. تنها خطای باقی‌مانده خارج از حوزه سئو است: `release-docs: window.VER در crm/index.html پیدا نشد`.

طبق دستور، CRM تغییر داده نشد.

## ابزار اضافه‌شده
- `_tools/create_new_product_pages_phase5.py`
