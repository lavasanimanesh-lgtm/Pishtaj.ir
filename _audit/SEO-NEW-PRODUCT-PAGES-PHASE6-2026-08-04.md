# گزارش فاز ششم تولید صفحات محصول جدید
**تاریخ:** ۲۰۲۶-۰۸-۰۴  
**دامنه:** سایت عمومی؛ بدون تغییر در `crm/` و `api/`

## صفحات جدید ایجادشده
| صفحه | محصول | تصویر کم‌حجم |
|---|---|---|
| `services/products/plc-control-panel.html` | تابلو کنترل PLC و اتوماسیون صنعتی | `assets/images/products/generated/plc-control-panel-realistic.jpg` |
| `services/products/fire-alarm-fg-panel.html` | پنل اعلام حریق و Fire & Gas صنعتی | `assets/images/products/generated/fire-alarm-fg-panel-realistic.jpg` |
| `services/products/hazardous-area-cctv-access-control.html` | CCTV ضدانفجار و Access Control صنعتی | `assets/images/products/generated/explosion-proof-cctv-camera-realistic.jpg` |
| `services/products/industrial-hvac-pressurization.html` | HVAC صنعتی و Pressurization اتاق کنترل | `assets/images/products/generated/industrial-hvac-pressurization-unit-realistic.jpg` |

## تحقیق اولیه خارجی
- PLC/Automation: IEC 61131-3، Siemens S7، Rockwell ControlLogix، Schneider Modicon و زبان‌های PLC بررسی شد.
- Fire Alarm/F&G: EN 54، NFPA 72، Honeywell/Notifier، Siemens، Bosch و F&G Controllerها بررسی شد.
- Hazardous CCTV/Access Control: ATEX/IECEx، Axis، Bosch، Hikvision Industrial و Tecnovideo بررسی شد.
- HVAC/Pressurization: برندهای صنعتی HVAC و منطق Pressurization اتاق کنترل/اتاق برق بررسی شد.

## اصول رعایت‌شده
- همه صفحات بالای ۱۵۰۰ کلمه هستند.
- تصاویر واقع‌گرایانه، تک‌محصولی، بدون لوگو/متن/واترمارک و کم‌حجم هستند.
- Product Schema، FAQ Schema و Breadcrumb Schema وجود دارد.
- CTA موبایلی سریع و لینک RFQ همان محصول وجود دارد.
- صفحات در هاب محصولات قابل جستجو و فیلتر هستند.

## QA
```text
product_pages=55
qa_errors=0
sitemap URLs=572
لینک شکسته عمومی=0
JSON-LD parse error=0
```

`python3 _tools/audit.py` اجرا شد. تنها خطای باقی‌مانده خارج از حوزه سئو است: `release-docs: window.VER در crm/index.html پیدا نشد`.

طبق دستور، CRM تغییر داده نشد.

## ابزار اضافه‌شده
- `_tools/create_new_product_pages_phase6.py`
