# گزارش فاز بازنویسی عمیق صفحات محصول پرریسک — ۲۰۲۶-۰۸-۰۵

## دامنه فاز
این فاز فقط روی وب‌سایت عمومی و صفحات محصول انجام شد. هیچ تغییری در `crm/` یا `api/` انجام نشد.

هدف، ادامه مسیر کیفیت‌محور پس از گزارش گوگل و ممیزی داخلی بود: به‌جای تولید صفحه جدید، چهار صفحه محصول دارای ریسک تکرار پاراگراف و عمق کم بازنویسی شدند تا محتوای قابل استفاده، فنی و غیرکلیشه‌ای برای جستجوهای مهندسی ایجاد شود.

## صفحات بازنویسی‌شده

| صفحه | وضعیت قبلی | وضعیت جدید |
|---|---|---|
| `services/products/cable-accessories.html` | `LOW_DEPTH_REVIEW`, `REPEATED_PARAGRAPH_INSIDE`, `DUPLICATE_PARAGRAPH_ACROSS_PAGES` | `OK` — ۱۸۹۰ کلمه |
| `services/products/industrial-strainer-filter.html` | `LOW_DEPTH_REVIEW`, `REPEATED_PARAGRAPH_INSIDE`, `DUPLICATE_PARAGRAPH_ACROSS_PAGES` | `OK` — ۱۸۲۴ کلمه |
| `services/products/earthing-lightning-protection.html` | `LOW_DEPTH_REVIEW`, `REPEATED_PARAGRAPH_INSIDE`, `DUPLICATE_PARAGRAPH_ACROSS_PAGES` | `OK` — ۱۸۱۵ کلمه |
| `services/products/stud-bolts-nuts.html` | `LOW_DEPTH_REVIEW`, `REPEATED_PARAGRAPH_INSIDE`, `DUPLICATE_PARAGRAPH_ACROSS_PAGES` | `OK` — ۱۹۱۴ کلمه |

## نوع ارتقا

### متعلقات کابل صنعتی
- افزودن محتوای اختصاصی درباره Cable Gland، نوع آرمور، Thread، Ex/IECEx/ATEX، Cable Lug، Ferrule، MV termination، Cable Tray/Ladder و استانداردهای IEC.
- حذف پاراگراف‌های تکراری عمومی و جایگزینی با چک‌لیست اجرایی RFQ، کنترل تحویل، اقلام جانبی و نکات نصب.

### Y Strainer، Basket Strainer و فیلتر صنعتی
- افزودن تفاوت کاربردی Strainer و Filter، انتخاب mesh/perforation، افت فشار، DP monitoring، drain/vent، temporary strainer و ملاحظات commissioning.
- تاکید بر متریال، MTC، hydrotest، GA drawing، spare basket/gasket و دسترسی اپراتور برای سرویس.

### سیستم ارتینگ و حفاظت صاعقه
- افزودن توضیح فنی درباره IEEE 80، IEC 62305، IEC 62561، IEC 61643، soil resistivity، step/touch voltage، exothermic welding، bonding و SPD coordination.
- اصلاح نگاه تک‌عددی به مقاومت زمین و تمرکز بر طراحی یکپارچه، ایمنی نفرات و عملکرد ابزار دقیق.

### استادبولت و مهره صنعتی
- افزودن محتوای فنی درباره ASTM A193/A194/A320، B7/B7M/B8/B8M، A194 2H/2HM، پوشش‌ها، nut factor، bolting procedure، MTC، hardness، PMI و کنترل رزوه.
- اتصال محتوایی به گسکت، فلنج، کلاس پایپینگ و ریسک نشتی در سرویس‌های حساس.

## نتیجه ممیزی کیفیت محتوا
پس از اجرای `python3 _tools/seo_content_quality_audit.py`:

- صفحات محصول بررسی‌شده: ۷۷
- صفحات برند بررسی‌شده: ۲۰
- صفحات `OK`: از ۲۷ به ۳۱ افزایش یافت.
- صفحات پرریسک کل: از ۷۰ به ۶۶ کاهش یافت.
- `LOW_DEPTH_REVIEW`: از ۷۰ به ۶۶ کاهش یافت.
- `DUPLICATE_PARAGRAPH_ACROSS_PAGES`: از ۶۲ به ۵۸ کاهش یافت.
- `REPEATED_PARAGRAPH_INSIDE`: از ۵۱ به ۴۷ کاهش یافت.
- چهار صفحه این فاز اکنون بدون پاراگراف تکراری داخلی و بدون پاراگراف تکراری بین‌صفحه‌ای هستند.

## اجرای QA و ممیزی عمومی

دستورات اجراشده:

```bash
python3 _tools/product_ux_polish_and_qa.py
python3 _tools/build_sitemap.py
python3 _tools/audit.py || true
```

نتیجه:
- `product_pages=77`
- `qa_errors=0`
- `sitemap.xml` بازسازی شد: ۶۱۶ URL عمومی
- ممیزی عمومی همچنان فقط یک خطای خارج از حوزه سئو نشان می‌دهد:
  - `release-docs: window.VER در crm/index.html پیدا نشد`

این خطا طبق دستور کاربر و محدوده پروژه، مربوط به CRM است و در این فاز عمداً اصلاح نشد.

## پیشنهاد فاز بعدی
فاز بعدی باید ادامه همین الگوی کیفیت‌محور باشد؛ یعنی بازنویسی عمیق صفحات صدر گزارش فعلی، به‌خصوص:

1. `brands/krohne-instrumentation.html`
2. `brands/spirax-sarco-steam.html`
3. `brands/atlas-copco-compressed-air.html`
4. `brands/endress-hauser.html`
5. `brands/phoenix-contact.html`

تولید صفحه جدید تا زمانی که ریسک‌های محتوایی فعلی کاهش معنادار پیدا نکرده، پیشنهاد نمی‌شود.
