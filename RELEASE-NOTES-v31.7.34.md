# Release Notes — v31.7.34

**تاریخ:** ۱۴۰۵/۰۴/۳۰ (2026-07-21)  
**نسخه:** `v31.7.34`  
**نوع:** 🟢 WEB-SEO-002 — Meta & SERP Foundation

---

## 🎯 هدف ریلیز

اجرای گام بعدی رودمپ وب‌سایت با تمرکز بر اصلاح بنیادین metadata صفحات عمومی و بهبود کیفیت نمایش در نتایج جستجو.

اهداف:

1. حذف meta descriptionهای خیلی کوتاه و generic.
2. حذف descriptionهای تکراری در صفحات public.
3. بهینه‌سازی title و description صفحات استراتژیک تجاری.
4. تثبیت کیفیت metadata با تست خودکار.

---

## 1) مشکل قبل از اصلاح

در ممیزی پنل وب‌سایت مشخص شده بود:

```text
meta description کوتاه‌تر از 70 کاراکتر: 146 صفحه
descriptionهای تکراری بزرگ: 6 گروه
نمونه descriptionهای generic:
  لوله و پایپینگ
  شیرآلات صنعتی
  ابزار دقیق
  برق صنعتی
  تامین و کیفیت
  کاربردهای صنعتی
```

این وضعیت از نظر SEO و CTR مناسب نبود، چون صفحات تخصصی مرکز دانش در SERP توضیح اختصاصی نداشتند و موتور جستجو نمی‌توانست تفاوت ارزش هر صفحه را به‌خوبی ببیند.

---

## 2) اصلاح انجام‌شده

### 2.1 اصلاح گسترده meta descriptionها

برای صفحات public که description کوتاه یا generic داشتند، description اختصاصی بر اساس H1 همان صفحه تولید شد.

الگوی جدید:

```text
{عنوان/موضوع صفحه}؛ کاربردها، استانداردهای کلیدی، نکات انتخاب فنی و خرید برای پروژه‌های صنعتی و EPC.
```

نتیجه:

```text
صفحات public با description کوتاه‌تر از 70 کاراکتر: 0
گروه‌های description تکراری: 0
```

### 2.2 اصلاح صفحات استراتژیک

برای صفحات کلیدی زیر title و description بهینه شد:

```text
index.html
rfq/index.html
tracking/index.html
supplier/index.html
knowledge-center/index.html
tools/index.html
services/pumps/index.html
services/piping-equipment/index.html
services/instrumentation-equipment/index.html
services/electrical-equipment/index.html
industries/oil-gas/index.html
```

### 2.3 حفظ ریسک کنترل‌شده

این ریلیز تغییر محتوای body، فرم‌ها، APIها، CRM، RFQ، tracking یا finance ندارد. تغییر صرفاً روی metadata و تعدادی title استراتژیک است.

---

## 📊 وضعیت بعد از اصلاح

```text
Short descriptions < 70: 0
Generic category descriptions: 0
Duplicate description groups: 0
Strategic page title/description tests: PASS
```

نکته شفاف: هنوز بخشی از titleهای طولانی در صفحات غیر اولویت‌دار باقی مانده‌اند و در گام‌های بعدی SEO بهینه‌سازی خواهند شد. این ریلیز عمداً روی description و صفحات استراتژیک تمرکز دارد.

---

## 📁 فایل‌های تغییر یافته

```text
index.html
rfq/index.html
tracking/index.html
supplier/index.html
knowledge-center/index.html
tools/index.html
services/pumps/index.html
services/piping-equipment/index.html
services/instrumentation-equipment/index.html
services/electrical-equipment/index.html
industries/oil-gas/index.html
knowledge-center/*.html  (صفحات دارای description کوتاه/generic)
crm/index.html
crm/sw.js
crm/clear-cache.html
PTF-MASTER-HANDOVER.md
_tools/uat/tester211-seo-meta-foundation.js
RELEASE-NOTES-v31.7.34.md
REGRESSION-REPORT-v31.7.34.md
```

---

## 🧪 تست اضافه‌شده

### `_tools/uat/tester211-seo-meta-foundation.js`

پوشش:

- هیچ صفحه public description کوتاه‌تر از 70 کاراکتر ندارد.
- descriptionهای generic دسته‌ای حذف شده‌اند.
- هیچ description تکراری بین صفحات public وجود ندارد.
- صفحات استراتژیک title و description کنترل‌شده دارند.
- نمونه صفحات مرکز دانش که قبلاً generic بودند، description اختصاصی دارند.

---

## ⚠️ Impact Analysis

| بخش | اثر | ریسک |
|---|---|---|
| SEO metadata | بهبود SERP/CTR و حذف تکرار | کم |
| صفحات public | فقط head metadata/title تغییر کرده | کم |
| sitemap | دست‌نخورده نسبت به v31.7.33 | صفر |
| Home RFQ | دست‌نخورده و اصلاح v31.7.32 حفظ شد | صفر |
| Metrics | دست‌نخورده و اصلاح v31.7.33 حفظ شد | صفر |
| CRM/Auth/Finance/Sync | دست‌نخورده | صفر |

---

## 📋 اقدام پیشنهادی کارفرما در Search Console

پس از deploy نسخه v31.7.34 روی Production:

1. در Google Search Console وارد property دامنه شوید.
2. از بخش **Sitemaps** دوباره این sitemap را submit کنید:

```text
https://pishtaj.ir/sitemap.xml
```

3. برای URLهای کلیدی زیر از URL Inspection گزینه **Request Indexing** را بزنید:

```text
https://pishtaj.ir/
https://pishtaj.ir/rfq/
https://pishtaj.ir/tracking/
https://pishtaj.ir/supplier/
https://pishtaj.ir/knowledge-center/
https://pishtaj.ir/tools/
https://pishtaj.ir/services/piping-equipment/
https://pishtaj.ir/services/instrumentation-equipment/
https://pishtaj.ir/services/electrical-equipment/
https://pishtaj.ir/services/pumps/
https://pishtaj.ir/industries/oil-gas/
```

4. برای همه 100+ صفحه مرکز دانش نیازی به درخواست دستی فوری نیست؛ بعد از submit sitemap، Google به‌مرور crawl می‌کند. اگر صفحه‌ای برای کسب‌وکار بسیار مهم است، می‌توان آن را هم دستی request indexing کرد.

---

## 🚦 نتیجه

WEB-SEO-002 foundation تکمیل شد: دیگر descriptionهای کوتاه/generic/tكراری در صفحات public وجود ندارد و صفحات استراتژیک SERP-friendlyتر شدند.
