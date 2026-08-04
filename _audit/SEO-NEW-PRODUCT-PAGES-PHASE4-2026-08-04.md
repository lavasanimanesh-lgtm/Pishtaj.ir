# گزارش فاز چهارم تولید صفحات محصول جدید
**تاریخ:** ۲۰۲۶-۰۸-۰۴  
**دامنه:** سایت عمومی؛ بدون تغییر در `crm/` و `api/`

## صفحات جدید ایجادشده
| صفحه | محصول | تصویر کم‌حجم |
|---|---|---|
| `services/products/stud-bolts-nuts.html` | استادبولت و مهره صنعتی ASTM A193/A194 | `assets/images/products/generated/stud-bolts-nuts-realistic.jpg` |
| `services/products/cable-accessories.html` | متعلقات کابل صنعتی؛ گلند، لاگ، سینی کابل | `assets/images/products/generated/cable-glands-lugs-tray-realistic.jpg` |
| `services/products/earthing-lightning-protection.html` | سیستم ارتینگ و حفاظت صاعقه | `assets/images/products/generated/earthing-lightning-protection-realistic.jpg` |
| `services/products/industrial-strainer-filter.html` | استرینر و فیلتر صنعتی خطی | `assets/images/products/generated/industrial-strainer-filter-realistic.jpg` |

## منابع تحقیق خارجی استفاده‌شده
- Stud Bolts: ASTM A193 B7، A194 2H، flange bolting و Torque/Tension بررسی شد.
- Cable Accessories: IEC 62444، IEC 61537، Cable Glands، CMP، Hawke، Prysmian/BICON و متعلقات کابل بررسی شد.
- Earthing/Lightning: IEC 62305، IEEE 80، nVent ERICO، DEHN، OBO Bettermann و ABB Furse بررسی شد.
- Strainer/Filter: Y Strainer، Basket Strainer، ASME B16.34، API 598 و سازندگان/برندهای صنعتی بررسی شد.

## اصول رعایت‌شده
- همه صفحات بالای ۱۵۰۰ کلمه هستند.
- تصاویر واقع‌گرایانه، تک‌محصولی، بدون لوگو/متن/واترمارک و کم‌حجم هستند.
- Product Schema، FAQ Schema و Breadcrumb Schema وجود دارد.
- CTA موبایلی سریع و لینک RFQ همان محصول وجود دارد.
- صفحات در هاب محصولات قابل جستجو و فیلتر هستند.

## QA
```text
product_pages=47
qa_errors=0
sitemap URLs=564
لینک شکسته عمومی=0
JSON-LD parse error=0
```

`python3 _tools/audit.py` اجرا شد. تنها خطای باقی‌مانده خارج از حوزه سئو است: `release-docs: window.VER در crm/index.html پیدا نشد`.

طبق دستور، CRM تغییر داده نشد.

## ابزار اضافه‌شده
- `_tools/create_new_product_pages_phase4.py`
