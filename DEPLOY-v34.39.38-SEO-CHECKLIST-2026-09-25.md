# چک‌لیست استقرار SEO v34.39.38 (فلنج/لوله/شیرآلات) + گام‌های گوگل سرچ کنسول — ۲۰۲۶-۰۹-۲۵

> کامیت: `96aa6de` (push شده روی `main` از طریق شاخهٔ سشن). **پوشِ گیت سایتِ لایو را آپدیت نمی‌کند** — فایل‌ها باید دستی روی هاست (cPanel → public_html) آپلود شوند. ۲۶ فایلِ محتوایی این نسخه را دارد.

---

## گام ۱ — آپلود ۲۶ فایل روی هاست (ساختار مسیر = همان مخزن)

### صفحات هدف (۴)
- [ ] `suppliers/flange-supplier.html`
- [ ] `suppliers/pipe-supplier.html`
- [ ] `suppliers/petrochemical-valve-supplier.html`
- [ ] `services/valves-supply.html`

### رفع FAQPage تکراری از sprint قبلی (۲)
- [ ] `suppliers/piping-supplier.html`
- [ ] `suppliers/instrumentation-supplier.html`

### مقالات لینک‌دار (۱۷) — همه در `knowledge-center/`
- [ ] flange-types-complete-guide.html
- [ ] flange-material-selection-guide.html
- [ ] wn-vs-so-flange-comparison.html
- [ ] asme-b16-5.html
- [ ] astm-a105.html
- [ ] flange-bolting-guide.html
- [ ] seamless-pipe-complete-guide.html
- [ ] a106-api-5l.html
- [ ] api-5l-pipe-guide.html
- [ ] seamless-vs-erw-pipe-difference.html
- [ ] a53-pipe-specifications.html
- [ ] hydrostatic-test-pipe-guide.html
- [ ] pe-pipe-hydrostatic-test-guide.html
- [ ] cryogenic-valve-lng.html
- [ ] industrial-valve-standards-guide.html
- [ ] valve-testing-guide.html
- [ ] fire-test-api-607.html

### نقشه‌های سایت (۳)
- [ ] `sitemap-knowledge-center.xml`
- [ ] `sitemap-misc.xml`
- [ ] `sitemap-services.xml`

> `SEO-COMPETITOR-FLANGE-PIPE-VALVE-2026-09-25.md` سند داخلی است — نیازی به آپلود ندارد.

## گام ۲ — تأیید زنده‌بودن (قبل از هر کاری در GSC!)

روی هر صفحهٔ هدف: `Ctrl+U` (view-source) و جستجوی عبارت:

| صفحه | نشانگر در سورس |
|---|---|
| flange-supplier | «۷ معیار کلیدی» + `"@type": "FAQPage"` |
| pipe-supplier | «۷ معیار پروژه‌ای» |
| petrochemical-valve-supplier | «قابلیت SIL» |
| valves-supply | «۷ معیار فنی» + «تامین‌کننده شیرآلات صنعتی» در اینترو |

**اگر نشانگر نبود = هنوز نسخهٔ قدیمی روی هاست است؛ ریکویست ایندکسینگ نزنید** (گوگل نسخهٔ قدیمی را می‌خواند و فرصت تازه‌خوانی هدر می‌رود).

## گام ۳ — گوگل سرچ کنسول: Request Indexing فقط برای ۴ صفحهٔ هدف

مسیر: GSC → URL Inspection (نوار بالای صفحه) → پیست URL → **Request Indexing**

1. `https://pishtaj.ir/suppliers/flange-supplier.html`
2. `https://pishtaj.ir/suppliers/pipe-supplier.html`
3. `https://pishtaj.ir/suppliers/petrochemical-valve-supplier.html`
4. `https://pishtaj.ir/services/valves-supply.html`

- **سهمیهٔ روزانه ~۱۰ عدد است** → همین ۴ تا کافی؛ ۱۷ مقاله را مصرف نکنید.
- اختیاری (اگر سهمیه ماند): دو صفحهٔ dedupe پایپینگ/ابزار دقیق هم رفرش شوند.
- ⚠️ **API گوگل «Request Indexing» ندارد** — این کار فقط از خود UI سرچ کنسول ممکن است. پنل CRM داخل سایت فقط «بررسی ایندکس» (خواندن وضعیت) و «ثبت نقشه» می‌تواند.

### ۱۷ مقالهٔ KC: ریکویست لازم ندارد
این‌ها فقط یک لینک داخلی + lastmod گرفته‌اند؛ گوگل از طریق نقشهٔ سایت (lastmod → 2026-09-25) ظرف چند روز تا چند هفته خودش دوباره می‌خواند. ریکویست دستی ارزش افزودهٔ محسوسی ندارد.

## گام ۴ — اختیاری: ثبت مجدد نقشه‌ها

GSC → Sitemaps → سه نقشهٔ `sitemap-knowledge-center.xml` / `sitemap-misc.xml` / `sitemap-services.xml` را دوبمهٔ Submit رفرش کنید (یا از پنل CRM: «📤 ثبت نقشه» — نیازمند سرویس‌اکانت با سطح **Full**، نه Restricted). اگر نقشه‌ها از قبل ثبت‌اند، گوگل خودش بازخوانی می‌کند؛ این فقط سرعت را کمی بالا می‌برد.

## گام ۵ — پایش

- ۲–۵ روز: وضعیت ایندکس ۴ صفحه از دکمهٔ «بررسی ایندکس» در پنل CRM (پس از استقرار — این همان readback است که قبلاً روی deploy گره خورده بود).
- ۴–۸ هفته: انتظار ورود صفحهٔ ۱–۲ برای «تامین‌کننده فلنج»، «تامین‌کننده لوله»، «تامین‌کننده شیرآلات صنعتی/پتروشیمی» طبق سند `SEO-COMPETITOR-FLANGE-PIPE-VALVE-2026-09-25.md`.
- ریکویست تکراری نزنید — یک بار برای هر URL کافی است.
