# گزارش فاز دوازدهم تولید صفحات محصول جدید
**تاریخ:** ۲۰۲۶-۰۸-۰۴  
**دامنه:** سایت عمومی؛ بدون تغییر در `crm/` و `api/`

## صفحات جدید ایجادشده
| صفحه | محصول | تصویر کم‌حجم |
|---|---|---|
| `services/products/displacer-level-transmitter.html` | ترانسمیتر سطح دیسپلیسری | `assets/images/products/generated/displacer-level-transmitter-realistic.jpg` |
| `services/products/instrument-air-package.html` | پکیج هوای ابزار دقیق Instrument Air | `assets/images/products/generated/instrument-air-package-realistic.jpg` |

## تحقیق اولیه خارجی
- Displacer Level Transmitter: اصول Buoyancy، Torque Tube، Force Balance، کاربرد Level/Interface و برندهایی مانند Fisher/Emerson، Masoneilan، Magnetrol و Yokogawa بررسی شد.
- Instrument Air Package: ISO 8573-1، Dryer/Filter/Receiver، Dew Point، Oil Content و برندهایی مانند Atlas Copco، Ingersoll Rand، Kaeser، Donaldson، Parker، SMC و Festo بررسی شد.

## اصول رعایت‌شده
- هر دو صفحه بالای ۱۵۰۰ کلمه هستند.
- تصاویر واقع‌گرایانه، تک‌محصولی/تک‌پکیج، بدون لوگو/متن/واترمارک و کم‌حجم هستند.
- Product Schema، FAQ Schema و Breadcrumb Schema وجود دارد.
- CTA موبایلی سریع و لینک RFQ همان محصول وجود دارد.
- صفحات در هاب محصولات قابل جستجو و فیلتر هستند.

## QA
```text
product_pages=75
qa_errors=0
sitemap URLs=592
لینک شکسته عمومی=0
JSON-LD parse error=0
```

`python3 _tools/audit.py` اجرا شد. تنها خطای باقی‌مانده خارج از حوزه سئو است: `release-docs: window.VER در crm/index.html پیدا نشد`.

طبق دستور، CRM تغییر داده نشد.

## ابزار اضافه‌شده
- `_tools/create_new_product_pages_phase12.py`
