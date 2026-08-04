# گزارش فاز هفتم تولید صفحات محصول جدید
**تاریخ:** ۲۰۲۶-۰۸-۰۴  
**دامنه:** سایت عمومی؛ بدون تغییر در `crm/` و `api/`

## صفحات جدید ایجادشده
| صفحه | محصول | تصویر کم‌حجم |
|---|---|---|
| `services/products/chemical-injection-package.html` | پکیج تزریق مواد شیمیایی | `assets/images/products/generated/chemical-injection-package-realistic.jpg` |
| `services/products/mixer-agitator.html` | میکسر و آگیتاتور صنعتی | `assets/images/products/generated/industrial-mixer-agitator-realistic.jpg` |
| `services/products/fire-suppression-system.html` | سیستم اطفای حریق Clean Agent، CO2 و Foam | `assets/images/products/generated/fire-suppression-skid-realistic.jpg` |
| `services/products/process-gas-analyzer-system.html` | سیستم آنالایزر گاز فرایندی | `assets/images/products/generated/process-gas-analyzer-system-realistic.jpg` |

## تحقیق اولیه خارجی
- Chemical Injection Package: API 675/API 674، Chemical Injection Skids، Methanol/Corrosion Inhibitor و برندهایی مثل LEWA، Milton Roy و ProMinent بررسی شد.
- Mixer/Agitator: برندها و سازندگان SPX/Lightnin، EKATO، Sulzer، Philadelphia Mixing و مفاهیم impeller/viscosity/mixing duty بررسی شد.
- Fire Suppression: NFPA 2001، NFPA 12، NFPA 11 و مقایسه Clean Agent، CO2 و Foam بررسی شد.
- Process Gas Analyzer: برندها و تکنولوژی‌های ABB، Siemens، Yokogawa، Servomex، AMETEK، SICK، Endress+Hauser و Extractive/In-situ Analyzer بررسی شد.

## اصول رعایت‌شده
- همه صفحات بالای ۱۵۰۰ کلمه هستند.
- تصاویر واقع‌گرایانه، تک‌محصولی/تک‌سیستمی، بدون لوگو/متن/واترمارک و کم‌حجم هستند.
- Product Schema، FAQ Schema و Breadcrumb Schema وجود دارد.
- CTA موبایلی سریع و لینک RFQ همان محصول وجود دارد.
- صفحات در هاب محصولات قابل جستجو و فیلتر هستند.

## QA
```text
product_pages=59
qa_errors=0
sitemap URLs=576
لینک شکسته عمومی=0
JSON-LD parse error=0
```

`python3 _tools/audit.py` اجرا شد. تنها خطای باقی‌مانده خارج از حوزه سئو است: `release-docs: window.VER در crm/index.html پیدا نشد`.

طبق دستور، CRM تغییر داده نشد.

## ابزار اضافه‌شده
- `_tools/create_new_product_pages_phase7.py`
