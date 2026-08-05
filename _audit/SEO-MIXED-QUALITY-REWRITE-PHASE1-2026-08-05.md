# گزارش فاز ترکیبی بازنویسی صفحات پرریسک محصول/برند — ۲۰۲۶-۰۸-۰۵

## دامنه فاز
این فاز فقط روی وب‌سایت عمومی انجام شد و هیچ تغییری در `crm/` یا `api/` انجام نشد. هدف، ادامه مسیر کیفیت‌محور برای کاهش ریسک‌های گزارش محتوایی و حذف پاراگراف‌های تکراری از صفحات صدر اولویت بود.

## صفحات اصلاح‌شده

| صفحه | نوع | وضعیت قبلی | وضعیت جدید |
|---|---|---|---|
| `services/products/thermal-mass-flowmeter.html` | محصول | `LOW_DEPTH_REVIEW`, `REPEATED_PARAGRAPH_INSIDE`, `DUPLICATE_PARAGRAPH_ACROSS_PAGES` | `OK` — ۱۸۲۳ کلمه |
| `brands/kitz-valves.html` | برند | `LOW_DEPTH_REVIEW`, `REPEATED_PARAGRAPH_INSIDE`, `DUPLICATE_PARAGRAPH_ACROSS_PAGES` | `OK` — ۱۸۰۵ کلمه |
| `brands/eaton-crouse-hinds.html` | برند | `LOW_DEPTH_REVIEW`, `REPEATED_PARAGRAPH_INSIDE`, `DUPLICATE_PARAGRAPH_ACROSS_PAGES` | `OK` — ۱۸۴۶ کلمه |
| `services/products/motor-control-center-mcc.html` | محصول | `LOW_DEPTH_REVIEW`, `REPEATED_PARAGRAPH_INSIDE`, `DUPLICATE_PARAGRAPH_ACROSS_PAGES` | `OK` — ۱۹۰۶ کلمه |
| `brands/vallourec-pipes.html` | برند | `LOW_DEPTH_REVIEW`, `REPEATED_PARAGRAPH_INSIDE`, `DUPLICATE_PARAGRAPH_ACROSS_PAGES` | `OK` — ۱۸۰۱ کلمه |

## نوع ارتقا

### Thermal Mass Flowmeter
- حذف پاراگراف‌های تکراری عمومی پس از FAQ.
- افزودن محتوای اختصاصی درباره انتخاب برای گاز واقعی، air/nitrogen/natural gas، inline/insertion، gas composition، محل نصب، profile جریان، آلودگی سنسور، کالیبراسیون و معیار پذیرش در سایت.

### MCC — Motor Control Center
- حذف پاراگراف‌های تکراری عمومی.
- افزودن محتوای فنی درباره MCC به عنوان سیستم کنترل و حفاظت موتور، fixed/withdrawable/intelligent MCC، busbar، protection، signal list، communication، FAT، setting sheet و Data Book.

### KITZ Valves
- حذف پاراگراف‌های تکراری برندمحور.
- افزودن محتوای اختصاصی درباره کاربرد KITZ در ball/gate/globe/check/butterfly، سرویس بخار/آب/هیدروکربن، line class، تست، قطعات یدکی، face-to-face و کنترل تحویل.

### Eaton / Crouse-Hinds
- حذف پاراگراف‌های تکراری برندمحور.
- افزودن محتوای اختصاصی درباره تجهیزات Ex، area classification، lighting، junction box، cable entry، control station، certificate، نصب Ex، corrosion و hazardous equipment register.

### Vallourec Pipes
- حذف پاراگراف‌های تکراری برندمحور.
- افزودن محتوای اختصاصی درباره لوله‌های seamless، API/ASTM، MTC، Heat Number، traceability، دمای بالا/پایین، sour service، حمل، انبار، spool fabrication و Data Book.

## نتیجه ممیزی کیفیت محتوا
پس از اجرای `python3 _tools/seo_content_quality_audit.py`:

- صفحات محصول بررسی‌شده: ۷۷
- صفحات برند بررسی‌شده: ۲۰
- صفحات `OK`: از ۴۱ به ۴۶ افزایش یافت.
- صفحات پرریسک کل: از ۵۶ به ۵۱ کاهش یافت.
- `LOW_DEPTH_REVIEW`: از ۵۶ به ۵۱ کاهش یافت.
- `DUPLICATE_PARAGRAPH_ACROSS_PAGES`: از ۴۸ به ۴۳ کاهش یافت.
- `REPEATED_PARAGRAPH_INSIDE`: از ۳۷ به ۳۲ کاهش یافت.
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
- ممیزی عمومی همچنان فقط یک خطای خارج از حوزه سئو نشان می‌دهد:
  - `release-docs: window.VER در crm/index.html پیدا نشد`

این خطا مربوط به CRM است و طبق دستور کاربر در این فاز اصلاح نشد.

## اولویت پیشنهادی بعدی
ادامه همین روند کیفیت‌محور روی صفحات صدر گزارش فعلی:
1. `brands/abb-industrial.html`
2. `brands/yokogawa-industrial.html`
3. `services/products/ultrasonic-flowmeter.html`
4. `brands/grundfos-pumps.html`
5. `services/products/deaerator-feedwater-system.html`
