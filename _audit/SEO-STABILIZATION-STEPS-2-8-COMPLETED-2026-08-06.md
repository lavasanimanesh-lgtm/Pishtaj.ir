# گزارش تکمیل گام‌های ۲ تا ۸ پایدارسازی کیفیت محتوا — ۲۰۲۶-۰۸-۰۶

## خلاصه اجرایی
طبق برنامه کاربر، پس از گام اول، هفت گام بعدی بدون توقف انجام شد. در این ۷ گام، تمام صفحات باقی‌مانده دارای ریسک کیفیت در گزارش محصول/برند اصلاح شدند و گیت کیفیت محتوا برای ۹۷ صفحه محصول/برند به وضعیت کامل `OK` رسید.

دامنه کار فقط سایت عمومی بود. هیچ ویرایش دستی روی `crm/` یا `api/` انجام نشد.

## وضعیت نهایی ممیزی کیفیت محصول/برند
پس از اجرای `python3 _tools/seo_content_quality_audit.py`:

- صفحات محصول بررسی‌شده: ۷۷
- صفحات برند بررسی‌شده: ۲۰
- کل صفحات محصول/برند بررسی‌شده: ۹۷
- `OK`: ۹۷
- `UNDER_1500_CRITICAL`: ۰
- `LOW_DEPTH_REVIEW`: ۰
- `DUPLICATE_PARAGRAPH_ACROSS_PAGES`: ۰
- `REPEATED_PARAGRAPH_INSIDE`: ۰
- صفحات پرریسک: ۰

## گام‌های انجام‌شده

### گام ۲ از ۸
- `services/products/expansion-joints-flexible-hose.html`
- `services/products/ansi-process-pump.html`
- `services/products/vertical-multistage-pump.html`
- `services/products/pressure-gauge.html`
- `services/products/reciprocating-compressor.html`

### گام ۳ از ۸
- `services/products/slurry-pump.html`
- `services/products/industrial-fan-blower.html`
- `services/products/water-tube-boiler.html`
- `services/products/industrial-hvac-pressurization.html`
- `services/products/temperature-transmitter.html`

### گام ۴ از ۸
- `services/products/process-gas-analyzer-system.html`
- `services/products/positive-displacement-pump.html`
- `services/products/diaphragm-seal.html`
- `services/products/online-water-quality-analyzer.html`
- `services/products/industrial-burner.html`

### گام ۵ از ۸
- `services/products/plc-control-panel.html`
- `brands/siemens-industrial.html`
- `services/products/a333-low-temperature-pipe.html`
- `brands/galperti-flanges.html`
- `brands/flexitallic-gaskets.html`

### گام ۶ از ۸
- `brands/tenaris-pipes.html`
- `services/products/fixed-gas-detector.html`
- `services/products/orifice-plate-flowmeter.html`
- `services/products/air-cooler-fin-fan.html`
- `services/products/plate-heat-exchanger.html`

### گام ۷ از ۸
- `services/products/mechanical-seal.html`
- `services/products/alloy-steel-pipe-a335.html`
- `services/products/explosion-proof-lighting.html`
- `services/products/industrial-power-instrument-cable.html`
- `services/products/industrial-ups-battery-charger.html`

### گام ۸ از ۸
- `services/products/forged-fittings.html`
- `services/products/stainless-steel-pipe.html`
- `services/products/rosemount-3051.html`
- `services/products/valve-actuator.html`
- `services/products/flowmeter.html`
- `services/products/psv-prv-safety-valve.html`

## نوع اصلاحات انجام‌شده
- حذف پاراگراف‌های عمومی و تکراری.
- حذف تکرارهای داخلی و بین‌صفحه‌ای.
- افزودن محتوای اختصاصی برای هر محصول/برند درباره:
  - معیار انتخاب فنی
  - داده‌های لازم برای RFQ
  - مدارک قابل قبول مانند datasheet، MTC، COC، test report، calibration و Data Book
  - الزامات نصب و راه‌اندازی
  - ریسک‌های بهره‌برداری و نگهداری
  - قطعات یدکی، TBE، SAT/FAT و معیار پذیرش
- حفظ ادبیات محتاطانه برای صفحات برند: بدون ادعای نمایندگی رسمی، موجودی دائمی یا واردکنندگی انحصاری.

## جمع‌بندی ثبات
از نظر گیت کیفیت محتوا، مجموعه صفحات محصول و برند اکنون به وضعیت پایدار رسیده‌اند:

> ۹۷ صفحه بررسی‌شده، ۹۷ صفحه OK، صفر صفحه پرریسک.

با این حال، پیشنهاد می‌شود پس از merge مجدد `origin/main`، همین ممیزی دوباره اجرا شود تا مطمئن شویم تغییرات جدید main ریسک تازه‌ای ایجاد نکرده است.
