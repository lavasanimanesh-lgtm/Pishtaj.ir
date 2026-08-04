# گزارش فاز دوم تولید صفحات محصول جدید
**تاریخ:** ۲۰۲۶-۰۸-۰۴  
**دامنه:** سایت عمومی؛ بدون تغییر در `crm/` و `api/`

## صفحات جدید ایجادشده
| صفحه | محصول | تصویر کم‌حجم |
|---|---|---|
| `services/products/alloy-steel-pipe-a335.html` | لوله آلیاژی ASTM A335 P11/P22/P91 | `assets/images/products/generated/alloy-steel-pipe-a335-realistic.jpg` |
| `services/products/a333-low-temperature-pipe.html` | لوله دمای پایین ASTM A333 Gr.6 | `assets/images/products/generated/a333-low-temperature-pipe-realistic.jpg` |
| `services/products/orifice-plate-flowmeter.html` | Orifice Plate Flowmeter | `assets/images/products/generated/orifice-plate-flowmeter-realistic.jpg` |
| `services/products/fixed-gas-detector.html` | دتکتور گاز ثابت صنعتی | `assets/images/products/generated/fixed-gas-detector-realistic.jpg` |

## منابع تحقیق خارجی استفاده‌شده
- ASTM A335 و برندهایی مانند Vallourec، Tenaris، Sumitomo و JFE در منابع فنی بررسی شد.
- ASTM A333 Gr.6 برای سرویس دمای پایین و سازندگان/تأمین‌کنندگان رایج بررسی شد.
- Orifice Plate بر اساس ISO 5167، ASME MFC-3M و راهکارهای Rosemount/Emerson بررسی شد.
- Fixed Gas Detector و برندهایی مثل Honeywell، Dräger، MSA، Teledyne و Crowcon بررسی شد.

## اصول رعایت‌شده
- همه صفحات بالای ۱۵۰۰ کلمه هستند.
- تصاویر تک‌محصولی، واقع‌گرایانه، بدون لوگو/متن/واترمارک و کم‌حجم هستند.
- Product Schema، FAQ Schema و Breadcrumb Schema وجود دارد.
- CTA موبایلی سریع و لینک RFQ همان محصول وجود دارد.
- صفحات در هاب محصولات قابل جستجو و فیلتر هستند.

## QA
```text
product_pages=39
qa_errors=0
sitemap URLs=556
لینک شکسته عمومی=0
JSON-LD parse error=0
```

`python3 _tools/audit.py` اجرا شد. تنها خطای باقی‌مانده خارج از حوزه سئو است: `release-docs: window.VER در crm/index.html پیدا نشد`.
