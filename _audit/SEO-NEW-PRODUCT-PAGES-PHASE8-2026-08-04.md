# گزارش فاز هشتم تولید صفحات محصول جدید
**تاریخ:** ۲۰۲۶-۰۸-۰۴  
**دامنه:** سایت عمومی؛ بدون تغییر در `crm/` و `api/`

## صفحات جدید ایجادشده
| صفحه | محصول | تصویر کم‌حجم |
|---|---|---|
| `services/products/fire-tube-boiler.html` | بویلر فایرتیوب صنعتی | `assets/images/products/generated/fire-tube-boiler-realistic.jpg` |
| `services/products/water-tube-boiler.html` | بویلر واترتیوب صنعتی | `assets/images/products/generated/water-tube-boiler-realistic.jpg` |
| `services/products/industrial-burner.html` | مشعل صنعتی و Burner Management | `assets/images/products/generated/industrial-burner-realistic.jpg` |
| `services/products/deaerator-feedwater-system.html` | دی‌اریاتور و سیستم آب تغذیه بویلر | `assets/images/products/generated/deaerator-feedwater-system-realistic.jpg` |

## تحقیق اولیه خارجی
- Fire-tube Boiler: ASME Section I/IV، Cleaver-Brooks و استانداردهای ایمنی بویلر بررسی شد.
- Water-tube Boiler: Water-tube boiler، ASME Section I، Babcock & Wilcox و طراحی بخار فشار/ظرفیت بالا بررسی شد.
- Industrial Burner: برندهای Weishaupt، Riello، Oilon، Honeywell Maxon/Eclipse و مفاهیم NFPA 85/86 و BMS بررسی شد.
- Deaerator/Feedwater: Spray/Tray Deaerator، Cleaver-Brooks SprayMaster/TrayMaster، حذف اکسیژن و سیستم Feedwater بررسی شد.

## اصول رعایت‌شده
- همه صفحات بالای ۱۵۰۰ کلمه هستند.
- تصاویر واقع‌گرایانه، تک‌محصولی/تک‌سیستمی، بدون لوگو/متن/واترمارک و کم‌حجم هستند.
- Product Schema، FAQ Schema و Breadcrumb Schema وجود دارد.
- CTA موبایلی سریع و لینک RFQ همان محصول وجود دارد.
- صفحات در هاب محصولات قابل جستجو و فیلتر هستند.

## QA
```text
product_pages=63
qa_errors=0
sitemap URLs=580
لینک شکسته عمومی=0
JSON-LD parse error=0
```

`python3 _tools/audit.py` اجرا شد. تنها خطای باقی‌مانده خارج از حوزه سئو است: `release-docs: window.VER در crm/index.html پیدا نشد`.

طبق دستور، CRM تغییر داده نشد.

## ابزار اضافه‌شده
- `_tools/create_new_product_pages_phase8.py`
