# گزارش فاز سوم تولید صفحات محصول جدید
**تاریخ:** ۲۰۲۶-۰۸-۰۴  
**دامنه:** سایت عمومی؛ بدون تغییر در `crm/` و `api/`

## صفحات جدید ایجادشده
| صفحه | محصول | تصویر کم‌حجم |
|---|---|---|
| `services/products/mechanical-seal.html` | مکانیکال سیل API 682 | `assets/images/products/generated/mechanical-seal-api682-realistic.jpg` |
| `services/products/air-cooler-fin-fan.html` | Air Cooler / Fin Fan API 661 | `assets/images/products/generated/air-cooler-fin-fan-realistic.jpg` |
| `services/products/plate-heat-exchanger.html` | مبدل حرارتی صفحه‌ای | `assets/images/products/generated/plate-heat-exchanger-realistic.jpg` |
| `services/products/explosion-proof-lighting.html` | چراغ ضدانفجار LED | `assets/images/products/generated/explosion-proof-led-lighting-realistic.jpg` |

## منابع تحقیق خارجی استفاده‌شده
- Mechanical Seal: API 682، API Plans و برندهایی مانند AESSEAL، EagleBurgmann، Flowserve و John Crane بررسی شد.
- Air Cooler: API 661 / ISO 13706 و اجزای Air-Cooled Heat Exchanger مانند Tube Bundle، Fan، Header و Louvers بررسی شد.
- Plate Heat Exchanger: API 662، Gasketed PHE و برندهایی مثل Alfa Laval، Kelvion، Tranter، APV/SPX، Sondex و GEA بررسی شد.
- Explosion Proof Lighting: IEC/EN 60079، ATEX/IECEx، Zone 1/2، برندهایی مثل Appleton/Emerson، Crouse-Hinds/Eaton، Dialight و R. STAHL بررسی شد.

## اصول رعایت‌شده
- همه صفحات بالای ۱۵۰۰ کلمه هستند.
- تصاویر واقع‌گرایانه، تک‌محصولی، بدون لوگو/متن/واترمارک و کم‌حجم هستند.
- Product Schema، FAQ Schema و Breadcrumb Schema وجود دارد.
- CTA موبایلی سریع و لینک RFQ همان محصول وجود دارد.
- صفحات در هاب محصولات قابل جستجو و فیلتر هستند.

## QA
```text
product_pages=43
qa_errors=0
sitemap URLs=560
لینک شکسته عمومی=0
JSON-LD parse error=0
```

`python3 _tools/audit.py` اجرا شد. تنها خطای باقی‌مانده خارج از حوزه سئو است: `release-docs: window.VER در crm/index.html پیدا نشد`.

طبق دستور، CRM تغییر داده نشد.

## ابزارهای اضافه‌شده
- `_tools/create_new_product_pages_phase3.py`
