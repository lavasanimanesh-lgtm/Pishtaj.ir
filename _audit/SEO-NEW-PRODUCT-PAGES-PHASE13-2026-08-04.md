# گزارش فاز سیزدهم تولید صفحات محصول جدید
**تاریخ:** ۲۰۲۶-۰۸-۰۴  
**دامنه:** سایت عمومی؛ بدون تغییر در `crm/` و `api/`

## صفحات جدید ایجادشده
| صفحه | محصول | تصویر کم‌حجم |
|---|---|---|
| `services/products/pipe-supports-spring-hangers.html` | ساپورت پایپینگ، Pipe Shoe و Spring Hanger | `assets/images/products/generated/pipe-support-spring-hanger-realistic.jpg` |
| `services/products/expansion-joints-flexible-hose.html` | اکسپنشن جوینت فلزی و Flexible Metal Hose | `assets/images/products/generated/metal-expansion-joint-flexible-hose-realistic.jpg` |

## تحقیق اولیه خارجی
- Pipe Supports: MSS SP-58، MSS SP-69، ASME B31.1/B31.3، Variable/Constant Spring Hanger و برندهایی مانند LISEGA، Bergen و PT&P بررسی شد.
- Expansion Joints/Flexible Hose: EJMA، Metal Bellows، Tie Rod، Anchor/Guide و برندهایی مانند Senior Flexonics، Witzenmann، BOA، US Bellows و Garlock بررسی شد.

## اصول رعایت‌شده
- هر دو صفحه بالای ۱۵۰۰ کلمه هستند.
- تصاویر واقع‌گرایانه، تک‌محصولی، بدون لوگو/متن/واترمارک و کم‌حجم هستند.
- Product Schema، FAQ Schema و Breadcrumb Schema وجود دارد.
- CTA موبایلی سریع و لینک RFQ همان محصول وجود دارد.
- صفحات در هاب محصولات قابل جستجو و فیلتر هستند.

## QA
```text
product_pages=77
qa_errors=0
sitemap URLs=595
لینک شکسته عمومی=0
JSON-LD parse error=0
```

`python3 _tools/audit.py` اجرا شد. تنها خطای باقی‌مانده خارج از حوزه سئو است: `release-docs: window.VER در crm/index.html پیدا نشد`.

طبق دستور، CRM تغییر داده نشد.

## ابزار اضافه‌شده
- `_tools/create_new_product_pages_phase13.py`
