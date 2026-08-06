# گزارش فاز نهم تولید صفحات محصول جدید
**تاریخ:** ۲۰۲۶-۰۸-۰۴  
**دامنه:** سایت عمومی؛ بدون تغییر در `crm/` و `api/`

## صفحات جدید ایجادشده
| صفحه | محصول | تصویر کم‌حجم |
|---|---|---|
| `services/products/reciprocating-compressor.html` | کمپرسور رفت‌وبرگشتی API 618 | `assets/images/products/generated/reciprocating-compressor-api618-realistic.jpg` |
| `services/products/ansi-process-pump.html` | پمپ ANSI Process مطابق ASME B73.1 | `assets/images/products/generated/ansi-process-pump-b731-realistic.jpg` |

## تحقیق اولیه خارجی
- Reciprocating Compressor: API 618، Pulsation Suppression، Cylinder، Packing، Valve، Lubrication، برندهایی مثل Ariel، Burckhardt، Howden، NEA و Siemens Energy بررسی شد.
- ANSI Process Pump: ASME/ANSI B73.1، Goulds 3196، Flowserve Durco Mark 3، KSB، و تفاوت ANSI Pump با API 610 بررسی شد.

## اصول رعایت‌شده
- هر دو صفحه بالای ۱۵۰۰ کلمه هستند.
- تصاویر واقع‌گرایانه، تک‌محصولی/تک‌پکیج، بدون لوگو/متن/واترمارک و کم‌حجم هستند.
- Product Schema، FAQ Schema و Breadcrumb Schema وجود دارد.
- CTA موبایلی سریع و لینک RFQ همان محصول وجود دارد.
- صفحات در هاب محصولات قابل جستجو و فیلتر هستند.

## QA
```text
product_pages=65
qa_errors=0
sitemap URLs=582
لینک شکسته عمومی=0
JSON-LD parse error=0
```

`python3 _tools/audit.py` اجرا شد. تنها خطای باقی‌مانده خارج از حوزه سئو است: `release-docs: window.VER در crm/index.html پیدا نشد`.

طبق دستور، CRM تغییر داده نشد.

## ابزار اضافه‌شده
- `_tools/create_new_product_pages_phase9.py`
