# گزارش فاز دوم بازنویسی عمیق صفحات محصول پرریسک — ۲۰۲۶-۰۸-۰۶

## دامنه فاز
این فاز فقط روی صفحات محصول عمومی انجام شد و هیچ تغییری در `crm/` یا `api/` انجام نشد. هدف، ادامه کاهش ریسک‌های گزارش کیفیت محتوا و حذف پاراگراف‌های تکراری از صفحات صدر اولویت بود.

## صفحات بازنویسی‌شده

| صفحه | وضعیت قبلی | وضعیت جدید |
|---|---|---|
| `services/products/displacer-level-transmitter.html` | `LOW_DEPTH_REVIEW`, `REPEATED_PARAGRAPH_INSIDE`, `DUPLICATE_PARAGRAPH_ACROSS_PAGES` | `OK` — ۱۸۰۷ کلمه |
| `services/products/instrument-air-package.html` | `LOW_DEPTH_REVIEW`, `REPEATED_PARAGRAPH_INSIDE`, `DUPLICATE_PARAGRAPH_ACROSS_PAGES` | `OK` — ۱۸۳۰ کلمه |
| `services/products/fire-alarm-fg-panel.html` | `LOW_DEPTH_REVIEW`, `REPEATED_PARAGRAPH_INSIDE`, `DUPLICATE_PARAGRAPH_ACROSS_PAGES` | `OK` — ۱۸۲۵ کلمه |
| `services/products/fire-suppression-system.html` | `LOW_DEPTH_REVIEW`, `REPEATED_PARAGRAPH_INSIDE`, `DUPLICATE_PARAGRAPH_ACROSS_PAGES` | `OK` — ۱۸۱۷ کلمه |
| `services/products/mixer-agitator.html` | `LOW_DEPTH_REVIEW`, `REPEATED_PARAGRAPH_INSIDE`, `DUPLICATE_PARAGRAPH_ACROSS_PAGES` | `OK` — ۱۸۱۸ کلمه |

## نوع ارتقا

### Displacer Level Transmitter
- افزودن محتوای اختصاصی درباره buoyancy، density، interface، chamber/cage، torque tube، calibration، نصب، flushing و proof test.
- حذف پاراگراف‌های عمومی تکراری و جایگزینی با معیارهای پذیرش واقعی در سایت.

### Instrument Air Package
- افزودن محتوای تخصصی درباره ISO 8573، dew point، compressor، dryer، filter، drain، receiver، N+1 redundancy، DCS alarm و FAT/SAT.
- تاکید بر اینکه کیفیت هوای ابزار دقیق به کل پکیج وابسته است، نه فقط ظرفیت کمپرسور.

### Fire Alarm & Fire/Gas Panel
- افزودن محتوای فنی درباره detector layout، fire & gas mapping، cause & effect، voting، battery autonomy، interface با ESD/HVAC/suppression، FAT/SAT و برنامه تست دوره‌ای.
- تمرکز بر منطق ایمنی و مستندسازی detectorها و tagها.

### Fire Suppression System
- افزودن محتوای اختصاصی درباره clean agent، CO2، foam، water mist، design concentration، room integrity، releasing logic، interlock، discharge safety و نگهداری.
- تاکید بر انتخاب عامل اطفا بر اساس hazard واقعی و ایمنی نفرات.

### Mixer & Agitator
- افزودن محتوای فنی درباره rheology، viscosity، impeller، top/side/high-shear، scale-up، shaft/seal/nozzle load، slurry، baffle، gearbox و run test.
- تاکید بر اینکه توان موتور به‌تنهایی معیار انتخاب میکسر نیست.

## نتیجه ممیزی کیفیت محتوا
پس از اجرای `python3 _tools/seo_content_quality_audit.py`:

- صفحات محصول بررسی‌شده: ۷۷
- صفحات برند بررسی‌شده: ۲۰
- صفحات `OK`: از ۵۱ به ۵۶ افزایش یافت.
- صفحات پرریسک کل: از ۴۶ به ۴۱ کاهش یافت.
- `LOW_DEPTH_REVIEW`: از ۴۶ به ۴۱ کاهش یافت.
- `DUPLICATE_PARAGRAPH_ACROSS_PAGES`: از ۳۷ به ۳۲ کاهش یافت.
- `REPEATED_PARAGRAPH_INSIDE`: از ۲۷ به ۲۲ کاهش یافت.
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
1. `services/products/thermowell.html`
2. `services/products/fire-tube-boiler.html`
3. `services/products/hazardous-area-cctv-access-control.html`
4. `services/products/chemical-injection-package.html`
5. `services/products/pipe-supports-spring-hangers.html`
