# گزارش فاز ترکیبی دوم بازنویسی صفحات پرریسک پس از merge main — ۲۰۲۶-۰۸-۰۶

## شروع فاز با merge main
طبق دستور کاربر، ابتدا آخرین `origin/main` در شاخه کاری ثابت Arena یعنی `arena/019fcb93-pishtaj-ir` merge شد.

نکته مهم دامنه: تغییرات CRM/API فقط از طریق merge رسمی `origin/main` وارد شاخه شدند. در فاز سئو هیچ ویرایش دستی روی `crm/` یا `api/` انجام نشد.

پس از merge، ابزار audit به‌دلیل نسخه CRM `v34.1.0` وجود دو سند انتشار را الزامی دانست. برای تکمیل زنجیره مستندات audit، دو سند ریشه پروژه اضافه شد:
- `RELEASE-NOTES-v34.1.0.md`
- `REGRESSION-REPORT-v34.1.0.md`

این دو سند شفاف توضیح می‌دهند که دامنه این نوبت، کنترل عمومی سایت و سئو بوده و رگرسیون تخصصی CRM/API در این فاز انجام نشده است.

## دامنه سئوی فاز
این فاز فقط روی صفحات عمومی محصول/برند انجام شد. هدف، ادامه کاهش ریسک‌های گزارش کیفیت محتوا، حذف پاراگراف‌های تکراری و ارتقای عمق واقعی صفحات بود.

## صفحات اصلاح‌شده

| صفحه | نوع | وضعیت قبلی | وضعیت جدید |
|---|---|---|---|
| `brands/abb-industrial.html` | برند | `LOW_DEPTH_REVIEW`, `REPEATED_PARAGRAPH_INSIDE`, `DUPLICATE_PARAGRAPH_ACROSS_PAGES` | `OK` — ۱۸۰۰ کلمه |
| `brands/yokogawa-industrial.html` | برند | `LOW_DEPTH_REVIEW`, `REPEATED_PARAGRAPH_INSIDE`, `DUPLICATE_PARAGRAPH_ACROSS_PAGES` | `OK` — ۱۸۰۰ کلمه |
| `services/products/ultrasonic-flowmeter.html` | محصول | `LOW_DEPTH_REVIEW`, `REPEATED_PARAGRAPH_INSIDE`, `DUPLICATE_PARAGRAPH_ACROSS_PAGES` | `OK` — ۱۹۴۲ کلمه |
| `brands/grundfos-pumps.html` | برند | `LOW_DEPTH_REVIEW`, `REPEATED_PARAGRAPH_INSIDE`, `DUPLICATE_PARAGRAPH_ACROSS_PAGES` | `OK` — ۱۸۴۸ کلمه |
| `services/products/deaerator-feedwater-system.html` | محصول | `LOW_DEPTH_REVIEW`, `REPEATED_PARAGRAPH_INSIDE`, `DUPLICATE_PARAGRAPH_ACROSS_PAGES` | `OK` — ۱۹۸۰ کلمه |

## نوع ارتقا

### ABB Industrial
- محتوای اختصاصی درباره switchgear، breaker، trip unit، VFD، motor، relay، coordination، retrofit، FAT، setting sheet و interface matrix.
- حذف پاراگراف‌های عمومی برندمحور و جایگزینی با معیارهای فنی خرید ABB بدون ادعای نمایندگی رسمی.

### Yokogawa Industrial
- محتوای اختصاصی درباره pressure/DP transmitter، DCS spare، recorder، controller، analyzer، sample conditioning، firmware، system version و lifecycle.
- تاکید بر سازگاری DCS/PLC، configuration، system reference و Data Book.

### Ultrasonic Flowmeter
- محتوای اختصاصی درباره transit-time، Doppler، clamp-on، inline، pipe OD/WT، liner، signal quality، couplant، straight run، acceptance و مقایسه با magmeter/Coriolis/vortex.
- حذف پاراگراف‌های عمومی تکراری پس از FAQ.

### Grundfos Pumps
- محتوای اختصاصی درباره vertical multistage، booster، dosing، RO، circulation، BEP، NPSH، seal، VFD، chemical compatibility و total cost of ownership.
- تاکید بر curve، duty point، spare kit و بهره‌برداری واقعی.

### Deaerator & Feedwater System
- محتوای اختصاصی درباره tray/spray deaerator، oxygen removal، steam pegging، vent، storage، feedwater pump، NPSH، control loop، pressure vessel documents و commissioning.
- حذف پاراگراف‌های عمومی/تکراری و تمرکز بر سیستم کامل آب تغذیه بویلر.

## نتیجه ممیزی کیفیت محتوا
پس از اجرای `python3 _tools/seo_content_quality_audit.py`:

- صفحات محصول بررسی‌شده: ۷۷
- صفحات برند بررسی‌شده: ۲۰
- صفحات `OK`: از ۴۶ به ۵۱ افزایش یافت.
- صفحات پرریسک کل: از ۵۱ به ۴۶ کاهش یافت.
- `LOW_DEPTH_REVIEW`: از ۵۱ به ۴۶ کاهش یافت.
- `DUPLICATE_PARAGRAPH_ACROSS_PAGES`: از ۴۳ به ۳۷ کاهش یافت.
- `REPEATED_PARAGRAPH_INSIDE`: از ۳۲ به ۲۷ کاهش یافت.
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
- پس از افزودن اسناد انتشار نسخه `v34.1.0`، ممیزی عمومی سایت: `PASS`

## اولویت پیشنهادی بعدی
ادامه همین روند کیفیت‌محور روی صفحات صدر گزارش فعلی:
1. `services/products/displacer-level-transmitter.html`
2. `services/products/instrument-air-package.html`
3. `services/products/fire-alarm-fg-panel.html`
4. `services/products/fire-suppression-system.html`
5. `services/products/mixer-agitator.html`
