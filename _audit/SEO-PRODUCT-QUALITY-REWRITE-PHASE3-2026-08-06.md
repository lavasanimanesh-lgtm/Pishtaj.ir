# گزارش فاز سوم بازنویسی عمیق صفحات محصول پرریسک — ۲۰۲۶-۰۸-۰۶

## دامنه فاز
این فاز فقط روی صفحات محصول عمومی انجام شد و هیچ تغییری در `crm/` یا `api/` انجام نشد. هدف، ادامه کاهش ریسک‌های گزارش کیفیت محتوا، حذف پاراگراف‌های تکراری و رساندن صفحات صدر اولویت به وضعیت پایدارتر بود.

## صفحات بازنویسی‌شده

| صفحه | وضعیت قبلی | وضعیت جدید |
|---|---|---|
| `services/products/thermowell.html` | `LOW_DEPTH_REVIEW`, `REPEATED_PARAGRAPH_INSIDE`, `DUPLICATE_PARAGRAPH_ACROSS_PAGES` | `OK` — ۱۸۰۶ کلمه |
| `services/products/fire-tube-boiler.html` | `LOW_DEPTH_REVIEW`, `REPEATED_PARAGRAPH_INSIDE`, `DUPLICATE_PARAGRAPH_ACROSS_PAGES` | `OK` — ۱۸۰۱ کلمه |
| `services/products/hazardous-area-cctv-access-control.html` | `LOW_DEPTH_REVIEW`, `REPEATED_PARAGRAPH_INSIDE`, `DUPLICATE_PARAGRAPH_ACROSS_PAGES` | `OK` — ۱۸۲۴ کلمه |
| `services/products/chemical-injection-package.html` | `LOW_DEPTH_REVIEW`, `REPEATED_PARAGRAPH_INSIDE`, `DUPLICATE_PARAGRAPH_ACROSS_PAGES` | `OK` — ۱۸۳۲ کلمه |
| `services/products/pipe-supports-spring-hangers.html` | `LOW_DEPTH_REVIEW`, `REPEATED_PARAGRAPH_INSIDE`, `DUPLICATE_PARAGRAPH_ACROSS_PAGES` | `OK` — ۱۸۰۰ کلمه |

## نوع ارتقا

### Thermowell
- افزودن محتوای اختصاصی درباره wake frequency، ASME PTC 19.3 TW، متریال، insertion length، bore/sensor fit، NDT/PMI و معیار پذیرش.
- تاکید بر اینکه ترموول یک قطعه مکانیکی ساده نیست و باید با سنسور، سرعت جریان، فشار/دما و محل نصب هماهنگ باشد.

### Fire Tube Boiler
- افزودن محتوای اختصاصی درباره ظرفیت واقعی بخار، burner، احتراق، راندمان، water treatment، blowdown، safety interlock، مدارک pressure parts و commissioning.
- تاکید بر اینکه بویلر بدون پکیج‌های جانبی و مدارک ایمنی، خرید کامل محسوب نمی‌شود.

### Hazardous Area CCTV & Access Control
- افزودن محتوای اختصاصی درباره CCTV در محیط Ex، camera housing، lens/FOV، VMS/NVR، cybersecurity، access control، fire release و SAT.
- تاکید بر اینکه هدف هر دوربین باید از ابتدا مشخص باشد و تجهیزات محیط خطرناک باید با certificate و نصب صحیح کنترل شوند.

### Chemical Injection Package
- افزودن محتوای اختصاصی درباره dosing pump، MSDS، سازگاری متریال، calibration pot، relief/back pressure valve، injection quill، safety و commissioning.
- تاکید بر اینکه پکیج تزریق بدون accessoryهای صحیح و کنترل ایمنی، در سایت دقت و پایداری لازم ندارد.

### Pipe Supports & Spring Hangers
- افزودن محتوای اختصاصی درباره stress analysis، thermal expansion، spring hanger، cold/hot load، guide/anchor، slide plate، lock pin، walkdown و As-built.
- تاکید بر اینکه ساپورت پایپینگ بخشی از رفتار مکانیکی خط است، نه فقط قطعه نگهدارنده.

## نتیجه ممیزی کیفیت محتوا
پس از اجرای `python3 _tools/seo_content_quality_audit.py`:

- صفحات محصول بررسی‌شده: ۷۷
- صفحات برند بررسی‌شده: ۲۰
- صفحات `OK`: از ۵۶ به ۶۱ افزایش یافت.
- صفحات پرریسک کل: از ۴۱ به ۳۶ کاهش یافت.
- `LOW_DEPTH_REVIEW`: از ۴۱ به ۳۶ کاهش یافت.
- `DUPLICATE_PARAGRAPH_ACROSS_PAGES`: از ۳۲ به ۲۷ کاهش یافت.
- `REPEATED_PARAGRAPH_INSIDE`: از ۲۲ به ۱۷ کاهش یافت.
- هر ۵ صفحه این فاز اکنون بدون تکرار داخلی و بدون تکرار بین‌صفحه‌ای هستند.

## اجرای کنترل فنی
دستورات اجراشده:

```bash
python3 _tools/seo_content_quality_audit.py
python3 _tools/product_ux_polish_and_qa.py
python3 _tools/build_sitemap.py
python3 _tools/audit.py || true
```

نتیجه:
- `product_pages=77`
- `qa_errors=0`
- `sitemap.xml` بازسازی شد: ۶۱۷ URL عمومی
- ممیزی عمومی سایت: `PASS`

## اولویت پیشنهادی بعدی
ادامه همین روند کیفیت‌محور روی صفحات صدر گزارش فعلی:
1. `services/products/expansion-joints-flexible-hose.html`
2. `services/products/ansi-process-pump.html`
3. `services/products/vertical-multistage-pump.html`
4. `services/products/pressure-gauge.html`
5. `services/products/reciprocating-compressor.html`
