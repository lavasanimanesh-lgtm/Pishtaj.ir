# گزارش فاز سوم بازنویسی عمیق صفحات برند پرریسک — ۲۰۲۶-۰۸-۰۵

## دامنه فاز
این فاز فقط روی صفحات برند عمومی انجام شد و هیچ تغییری در `crm/` یا `api/` انجام نشد. هدف، ادامه کاهش ریسک‌های گزارش کیفیت محتوا و تبدیل صفحات برندمحور از متن تکراری به راهنمای فنی قابل استفاده برای خرید صنعتی بود.

## صفحات بازنویسی‌شده

| صفحه | وضعیت قبلی | وضعیت جدید |
|---|---|---|
| `brands/fisher-samson-control-valves.html` | `LOW_DEPTH_REVIEW`, `REPEATED_PARAGRAPH_INSIDE`, `DUPLICATE_PARAGRAPH_ACROSS_PAGES` | `OK` — ۱۸۷۲ کلمه |
| `brands/wika-instrumentation.html` | `LOW_DEPTH_REVIEW`, `REPEATED_PARAGRAPH_INSIDE`, `DUPLICATE_PARAGRAPH_ACROSS_PAGES` | `OK` — ۱۸۳۴ کلمه |
| `brands/emerson-rosemount.html` | `LOW_DEPTH_REVIEW`, `REPEATED_PARAGRAPH_INSIDE`, `DUPLICATE_PARAGRAPH_ACROSS_PAGES` | `OK` — ۱۸۰۰ کلمه |
| `brands/schneider-electric.html` | `LOW_DEPTH_REVIEW`, `REPEATED_PARAGRAPH_INSIDE`, `DUPLICATE_PARAGRAPH_ACROSS_PAGES` | `OK` — ۱۸۰۸ کلمه |
| `brands/omron-automation.html` | `LOW_DEPTH_REVIEW`, `REPEATED_PARAGRAPH_INSIDE`, `DUPLICATE_PARAGRAPH_ACROSS_PAGES` | `OK` — ۱۸۳۸ کلمه |

## نوع ارتقا

### Fisher / SAMSON
- محتوای اختصاصی درباره کنترل ولو، sizing، Cv/Kv، trim، actuator، positioner، regulator، leakage class، cavitation، noise و پروژه‌های اورهال.
- تمرکز بر اینکه کنترل ولو نباید صرفاً بر اساس سایز خط خریداری شود و باید با دیتاشیت و calculation sheet ارزیابی گردد.

### WIKA
- محتوای اختصاصی درباره pressure gauge، pressure transmitter، diaphragm seal، thermowell، RTD/TC، کالیبراسیون و traceability.
- تاکید بر سرویس‌های خاص مانند oxygen service، سیالات خورنده، sanitary، لرزش و فشار پالسی.

### Emerson / Rosemount
- محتوای اختصاصی درباره Rosemount 3051، pressure/DP، radar level، flow، HART/Fieldbus، DD file، firmware، calibration و configuration.
- تاکید بر Model Code کامل، option code، pre-configuration، سازگاری با DCS/PLC و کنترل serial/certificate.

### Schneider Electric
- محتوای اختصاصی درباره MCCB/ACB، trip unit، coordination، VFD، soft starter، PLC/HMI، IEC 61439، SLD، accessory و retrofit.
- تاکید بر اینکه آمپر یا توان به‌تنهایی برای خرید تجهیزات برق کافی نیست.

### Omron Automation
- محتوای اختصاصی درباره PLC، HMI، sensor، encoder، temperature controller، relay، timer، safety relay و light curtain.
- تاکید بر Part Number کامل، suffix، PNP/NPN، software/firmware compatibility، backup برنامه و spare strategy.

## قواعد رعایت‌شده
- هیچ ادعای نمایندگی رسمی، عاملیت فروش، موجودی دائمی یا واردکننده انحصاری مطرح نشد.
- از لوگوی برندها استفاده نشد.
- محتوای تکراری عمومی حذف شد.
- هر صفحه به محصولات مرتبط و صفحه QA/QC لینک داخلی دارد.
- متن‌ها فنی، محتاطانه و مناسب خریدار/مهندس/بازرس صنعتی نوشته شدند.

## نتیجه ممیزی کیفیت محتوا
پس از اجرای `python3 _tools/seo_content_quality_audit.py`:

- صفحات محصول بررسی‌شده: ۷۷
- صفحات برند بررسی‌شده: ۲۰
- صفحات `OK`: از ۳۶ به ۴۱ افزایش یافت.
- صفحات پرریسک کل: از ۶۱ به ۵۶ کاهش یافت.
- `LOW_DEPTH_REVIEW`: از ۶۱ به ۵۶ کاهش یافت.
- `DUPLICATE_PARAGRAPH_ACROSS_PAGES`: از ۵۳ به ۴۸ کاهش یافت.
- `REPEATED_PARAGRAPH_INSIDE`: از ۴۲ به ۳۷ کاهش یافت.
- هر ۵ صفحه این فاز اکنون `OK` هستند و تکرار داخلی/بین‌صفحه‌ای ندارند.

## اجرای کنترل فنی
دستورات اجراشده:

```bash
python3 _tools/seo_content_quality_audit.py
python3 _tools/build_sitemap.py
python3 _tools/audit.py || true
```

نتیجه:
- `sitemap.xml` بازسازی شد: ۶۱۷ URL عمومی
- ممیزی عمومی همچنان فقط یک خطای خارج از حوزه سئو نشان می‌دهد:
  - `release-docs: window.VER در crm/index.html پیدا نشد`

این خطا مربوط به CRM است و طبق دستور کاربر در این فاز اصلاح نشد.

## اولویت پیشنهادی بعدی
ادامه همین روند کیفیت‌محور روی صفحات صدر گزارش فعلی، به‌خصوص:
1. `services/products/thermal-mass-flowmeter.html`
2. `brands/kitz-valves.html`
3. `brands/eaton-crouse-hinds.html`
4. `services/products/motor-control-center-mcc.html`
5. `brands/vallourec-pipes.html`
