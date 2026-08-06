# گزارش فاز دوم بازنویسی عمیق صفحات برند پرریسک — ۲۰۲۶-۰۸-۰۵

## دامنه فاز
این فاز فقط روی صفحات برند عمومی انجام شد و هیچ تغییری در `crm/` یا `api/` انجام نشد. هدف، ادامه کاهش ریسک‌های گزارش کیفیت محتوا، حذف پاراگراف‌های تکراری و ارتقای صفحات برندمحور از متن عمومی به محتوای فنی، محتاطانه و قابل استفاده برای خریدار صنعتی بود.

## صفحات بازنویسی‌شده

| صفحه | وضعیت قبلی | وضعیت جدید |
|---|---|---|
| `brands/krohne-instrumentation.html` | `LOW_DEPTH_REVIEW`, `REPEATED_PARAGRAPH_INSIDE`, `DUPLICATE_PARAGRAPH_ACROSS_PAGES` | `OK` — ۱۸۱۰ کلمه |
| `brands/spirax-sarco-steam.html` | `LOW_DEPTH_REVIEW`, `REPEATED_PARAGRAPH_INSIDE`, `DUPLICATE_PARAGRAPH_ACROSS_PAGES` | `OK` — ۱۸۰۹ کلمه |
| `brands/atlas-copco-compressed-air.html` | `LOW_DEPTH_REVIEW`, `REPEATED_PARAGRAPH_INSIDE`, `DUPLICATE_PARAGRAPH_ACROSS_PAGES` | `OK` — ۱۸۰۹ کلمه |
| `brands/endress-hauser.html` | `LOW_DEPTH_REVIEW`, `REPEATED_PARAGRAPH_INSIDE`, `DUPLICATE_PARAGRAPH_ACROSS_PAGES` | `OK` — ۱۸۰۹ کلمه |
| `brands/phoenix-contact.html` | `LOW_DEPTH_REVIEW`, `REPEATED_PARAGRAPH_INSIDE`, `DUPLICATE_PARAGRAPH_ACROSS_PAGES` | `OK` — ۱۸۳۹ کلمه |

## نوع ارتقا

### KROHNE
- افزودن محتوای اختصاصی درباره Magmeter، Coriolis، Vortex، Ultrasonic، Radar/TDR Level، Model Code، Ex Certificate، Calibration و جایگزینی در پروژه‌های brownfield.
- تأکید بر داده‌های RFQ مانند سیال، دبی، conductivity، lining، electrode، protocol و مدارک commissioning.

### Spirax Sarco
- افزودن محتوای فنی درباره steam trap، PRV station، control valve، condensate recovery، energy monitoring و نگهداری سیستم بخار.
- تبدیل صفحه از معرفی عمومی برند به راهنمای خرید سیستم بخار با معیارهای فشار، بار کندانس، back pressure، Cv، safety و مدارک.

### Atlas Copco
- افزودن محتوای تخصصی درباره کمپرسور oil-free/oil-injected، dryer، filter، ISO 8573، instrument air، redundancy، dew point و total cost of ownership.
- تاکید بر اینکه کمپرسور به‌تنهایی کافی نیست و کیفیت هوای فشرده به کل پکیج وابسته است.

### Endress+Hauser
- افزودن راهنمای فنی درباره pressure/DP، flow، level، analyzer، communication protocol، HART/fieldbus، commissioning و lifecycle.
- تمرکز بر Model Code کامل، Instrument Datasheet، Ex/SIL، کالیبراسیون و سازگاری با DCS/PLC.

### Phoenix Contact
- افزودن محتوای اختصاصی درباره terminal block، power supply، DC UPS، SPD، industrial Ethernet، relay/interface و اهمیت BOM کامل تابلو.
- تأکید بر part number دقیق، accessoryها، marker، jumper، derating، earthing و سازگاری با محیط صنعتی.

## قواعد رعایت‌شده
- هیچ ادعای نمایندگی رسمی، عاملیت فروش، موجودی دائمی یا واردکننده انحصاری مطرح نشد.
- از لوگوی برندها استفاده نشد.
- متن‌ها برندمحور و فنی هستند، نه تبلیغاتی یا عمومی.
- پاراگراف‌های تکراری قدیمی حذف شدند.
- هر صفحه به محصولات مرتبط و صفحه QA/QC لینک داخلی دارد.

## نتیجه ممیزی کیفیت محتوا
پس از اجرای `python3 _tools/seo_content_quality_audit.py`:

- صفحات محصول بررسی‌شده: ۷۷
- صفحات برند بررسی‌شده: ۲۰
- صفحات `OK`: از ۳۱ به ۳۶ افزایش یافت.
- صفحات پرریسک کل: از ۶۶ به ۶۱ کاهش یافت.
- `LOW_DEPTH_REVIEW`: از ۶۶ به ۶۱ کاهش یافت.
- `DUPLICATE_PARAGRAPH_ACROSS_PAGES`: از ۵۸/۵۳ قبلی به ۵۳ در گزارش فعلی رسیده و برای این ۵ صفحه صفر شد.
- `REPEATED_PARAGRAPH_INSIDE`: از ۴۷/۴۲ قبلی به ۴۲ در گزارش فعلی رسیده و برای این ۵ صفحه صفر شد.

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
ادامه همین روند روی صفحات صدر گزارش فعلی:
1. `brands/fisher-samson-control-valves.html`
2. `brands/wika-instrumentation.html`
3. `brands/emerson-rosemount.html`
4. `brands/schneider-electric.html`
5. `brands/omron-automation.html`
