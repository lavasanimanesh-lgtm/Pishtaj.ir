# گزارش فاز یازدهم تولید صفحات محصول جدید
**تاریخ:** ۲۰۲۶-۰۸-۰۴  
**دامنه:** سایت عمومی؛ بدون تغییر در `crm/` و `api/`

## صفحات جدید ایجادشده
| صفحه | محصول | تصویر کم‌حجم |
|---|---|---|
| `services/products/vertical-multistage-pump.html` | پمپ طبقاتی عمودی | `assets/images/products/generated/vertical-multistage-pump-realistic.jpg` |
| `services/products/slurry-pump.html` | پمپ اسلاری و دوغاب صنعتی | `assets/images/products/generated/slurry-pump-horizontal-realistic.jpg` |
| `services/products/positive-displacement-pump.html` | پمپ جابجایی مثبت Screw/Gear/Lobe | `assets/images/products/generated/rotary-screw-gear-pump-realistic.jpg` |
| `services/products/industrial-fan-blower.html` | فن و بلوور صنعتی API 673 / AMCA | `assets/images/products/generated/industrial-centrifugal-fan-blower-realistic.jpg` |

## تحقیق اولیه خارجی
- Vertical Multistage Pump: Grundfos CR/CRE، KSB، Wilo، Lowara/Xylem و کاربردهای بوستر/RO/Utility بررسی شد.
- Slurry Pump: Warman، KSB GIW، Metso/Outotec، Schurco و مفاهیم Liner، Wear Life، Solids % و SG بررسی شد.
- Positive Displacement Pump: API 676، Screw/Gear/Lobe، Viking، NETZSCH، Leistritz، Bornemann، IMO و Allweiler بررسی شد.
- Industrial Fan/Blower: API 673، AMCA، Howden، Twin City Fan، Greenheck و کاربردهای FD/ID Fan و فرایندی بررسی شد.

## اصول رعایت‌شده
- همه صفحات بالای ۱۵۰۰ کلمه هستند.
- تصاویر واقع‌گرایانه، تک‌محصولی/تک‌سیستمی، بدون لوگو/متن/واترمارک و کم‌حجم هستند.
- Product Schema، FAQ Schema و Breadcrumb Schema وجود دارد.
- CTA موبایلی سریع و لینک RFQ همان محصول وجود دارد.
- صفحات در هاب محصولات قابل جستجو و فیلتر هستند.

## QA
```text
product_pages=73
qa_errors=0
sitemap URLs=590
لینک شکسته عمومی=0
JSON-LD parse error=0
```

`python3 _tools/audit.py` اجرا شد. تنها خطای باقی‌مانده خارج از حوزه سئو است: `release-docs: window.VER در crm/index.html پیدا نشد`.

طبق دستور، CRM تغییر داده نشد.

## ابزار اضافه‌شده
- `_tools/create_new_product_pages_phase11.py`
