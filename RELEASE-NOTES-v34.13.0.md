# RELEASE NOTES — v34.13.0 (S2-id + پاکسازی باگ‌های سئو + سخت‌گیری زیرمنوی «مدیریت سایت»)

**تاریخ:** ۲۰۲۶-۰۹-۰۱ · **کمیت:** تستر558 (۲۸ سنجه) · **گیت:** 174 PASS / 0 FAIL · **PHP-لینت:** php-parser ✓ · **تستر:** node --check همهٔ ماژول‌های دست‌خورده ✓

---

## ۱) S2-id — مولد صفحهٔ عمومی (خواستهٔ مستقیم مالک)

### سرور — `api/cms.php` → اکشن `page_create`
- انتشار صفحهٔ عمومی در سه بخش سایت: **`services/` | `industries/` | `comparisons/`** → `<folder>/<slug>.html`
- قالب: اسکلت `knowledge-center/astm-a105.html` (هم‌شکل سایت: نوار والد، CTA تأمین، فوتر) با انکرهای تزریق امن (`<body>`، سکشن تیره، `kc-supply-cta`، `<footer`)
- **اسکیما (JSON-LD):**
  - `services/` → **Service** (provider=Pishtaj, areaServed=IR, serviceType)
  - `industries/` و `comparisons/` → **Article** (headline, description, datePublished)
  - هر دو + **BreadcrumbList** با والدِ بخش (Home → بخش → صفحه)
- **SEO سرصفحه:** title/description/canonical/OG (og:title/og:description/og:type=website/og:image در صورت تصویر)
- **امنیت:** slug فقط `[a-z0-9-]`؛ body حداقل ۲۰۰ کاراکتر؛ `strip_tags` با لیست سفید (`h2 h3 h4 p ul ol li strong em a table thead tbody tr th td img blockquote`)؛ حذف `onclick/on*/javascript:` از HTML ورودی؛ پوشهٔ مقصد فقط از لیست مجاز (ضد path-traversal)
- **ایمنی انتشار:** بک‌آپ خودکار (`cms_backup`) پیش از بازنویسی؛ خطای `exists` → کلاینت confirm → `overwrite=1`
- **نقشه‌ها:** `sitemap_add` خودکار — services→`sitemap-services.xml`، industries→`sitemap-industries.xml`، comparisons→`sitemap-misc.xml`
- خطاهای فارسی: «پوشهٔ مقصد نامعتبر است» / «حداقل ۲۰۰ کاراکتر لازم دارد» / «صفحه از قبل وجود دارد»

### کلاینت — `crm/cms.js` → تب «📄 صفحهٔ جدید»
- فرم: بخش (سه‌گزینه‌ای) / عنوان* / نامک (پیشنهاد خودکار از عنوان، تمیزشده) / H1 / متا-توضیح / تصویر / بدنه* + **پیش‌نویس ماندگار** (ptfDevKv، اصل A10 — مثل محصولات و مرکز دانش)
- «🤖 تولید با AI» → `cmsLLM('seo_article')`؛ **قانون: فقط فیلدهای خالی پر می‌شوند** (متن دستی کاربر دست‌نخورده می‌ماند)
- **دروازهٔ انتشار:** تیک «بازبینی انسانی انجام شد» الزامی — بدون آن انتشار نمی‌شود
- پس از انتشار: `cmsSitemapAfterPublish()` (ثبت/خوانش نقشه‌ها) + لینک بازکردن صفحهٔ تازه

---

## ۲) پاکسازی باگ‌های توسعه‌ای سئو (فرمان کاربر: «کلیه باگ‌های قبلی سئو»)

| # | باگ | ریشه | فیکس |
|---|-----|------|------|
| ۱ | دکمهٔ «💡 لینک‌سازی» (صفحات یتیم) در برخی مرورگرها/ماژول‌ها کار نمی‌کرد | `cmsSeoLinkSuggest` به `event` سراسریِ ضمنی تکیه می‌کرد (در strict/ماژول‌ها undefined) | امضا `(i, ev)` + پاس‌دادن صریح `event` در onclick + fallback `window.event` |
| ۲ | زیرمنوی «مدیریت سایت» با هر رفرش می‌بست | وضعیت فقط در حافظهٔ صفحه بود | ماندگاری در `ptfDevKv('cms.sitemod.open')` — آگاه از موبایل (CSS همیشه‌باز محفوظ، matchMedia 900px) |
| ۳ | وقتی فرزند زیرمنو (سایت/سرچ کنسول/فرصت شغلی) فعال است، والد هیچ نشانه‌ای ندارد؛ کاربر گم می‌شود | نبود sync بین کلاس act فرزند و والد | `syncSiteModActive`: هایلایت نارنجی والد (`.sm-h.act`) + بازشدن یک‌بارهٔ گروه + delegation کلیک (بدون interval) |

- بازبینی کامل gsc.js و careers.js برای الگوی مشابه (event ضمنی): **تمیز** — فقط هندلرهای inline امن و closureهای `function(e)`.
- `no_click` در gsc.js با قرارداد سرور هم‌خوان (`.no_click || []`).

---

## ۳) بهداشت و معماری

- اصل **A10** پابرجا: هیچ `localStorage.` مستقیمی در cms.js اضافه نشد (همه از `ptfDevKv`).
- CSS هایلایت والد در index.html (دسکتاپ) — موبایل بدون تغییر (زیرمنو همیشه باز).
- انکرهای تسترها بدون نسخه → مقاوم به جاروی bump (تلهٔ شناخته‌شده رفع شد).

## ۴) فایل‌های کلیدی

- `api/cms.php` — case `page_create` (پیش از product_list)
- `crm/cms.js` — تب page + renderCmsPageNew + cmsPageAi + cmsPagePublish + syncSiteModActive + toggleSiteMod پایدار
- `crm/index.html` — CSS `.sm-h.act` + بست ۱۰۹تایی `?v=34.13.0`
- `_tools/uat/tester558-v34.13.0-seo-s2id-sitemenu.js` — ۲۸ سنجه
- `SEO-CMS-AI-ROADMAP-2026-08-31.md` — ✅ S2-id

## ۵) بعدی — S4 (کیفیت و مقیاس)

انتشار زمان‌بندی‌شده، diff/rollback UI برای صفحات، داشبورد هزینهٔ AI، PageSpeed/CWV.
