# گزارش فاز دهم تولید صفحات محصول جدید
**تاریخ:** ۲۰۲۶-۰۸-۰۴  
**دامنه:** سایت عمومی؛ بدون تغییر در `crm/` و `api/`

## صفحات جدید ایجادشده
| صفحه | محصول | تصویر کم‌حجم |
|---|---|---|
| `services/products/motor-control-center-mcc.html` | تابلو MCC مرکز کنترل موتور | `assets/images/products/generated/motor-control-center-mcc-realistic.jpg` |
| `services/products/ultrasonic-flowmeter.html` | فلومتر التراسونیک Clamp-on و Inline | `assets/images/products/generated/ultrasonic-flowmeter-clamp-on-realistic.jpg` |
| `services/products/thermal-mass-flowmeter.html` | فلومتر جرمی حرارتی گاز و هوای فشرده | `assets/images/products/generated/thermal-mass-flowmeter-realistic.jpg` |
| `services/products/online-water-quality-analyzer.html` | آنالایزر آنلاین کیفیت آب | `assets/images/products/generated/water-quality-analyzer-realistic.jpg` |

## تحقیق اولیه خارجی
- MCC: IEC 61439، NEMA ICS 18، PLC/Starter/VFD integration و برندهایی مثل Siemens، Schneider، ABB، Eaton و Rockwell بررسی شد.
- Ultrasonic Flowmeter: Transit-time، Doppler، Clamp-on، FLEXIM، KROHNE، Siemens، Endress+Hauser و Yokogawa بررسی شد.
- Thermal Mass Flowmeter: کاربرد در compressed air/gas، Sierra، Kurz، Sage، Endress+Hauser، Fox Thermal، FCI و ABB بررسی شد.
- Online Water Quality Analyzer: pH، Conductivity، Turbidity، DO، Chlorine و برندهایی مثل Hach، Endress+Hauser، Yokogawa، Mettler Toledo و ABB بررسی شد.

## اصول رعایت‌شده
- همه صفحات بالای ۱۵۰۰ کلمه هستند.
- تصاویر واقع‌گرایانه، تک‌محصولی/تک‌سیستمی، بدون لوگو/متن/واترمارک و کم‌حجم هستند.
- Product Schema، FAQ Schema و Breadcrumb Schema وجود دارد.
- CTA موبایلی سریع و لینک RFQ همان محصول وجود دارد.
- صفحات در هاب محصولات قابل جستجو و فیلتر هستند.

## QA
```text
product_pages=69
qa_errors=0
sitemap URLs=586
لینک شکسته عمومی=0
JSON-LD parse error=0
```

`python3 _tools/audit.py` اجرا شد. تنها خطای باقی‌مانده خارج از حوزه سئو است: `release-docs: window.VER در crm/index.html پیدا نشد`.

طبق دستور، CRM تغییر داده نشد.

## ابزار اضافه‌شده
- `_tools/create_new_product_pages_phase10.py`
