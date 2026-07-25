# Release Notes — v31.7.88

## عنوان ریلیز
**ADV-CV-CAVITATION-SEO-ARTICLE-001**

## RCA / دلیل دقیق
پس از انتشار اولین مقاله پشتیبان درباره محاسبه Cv کنترل ولو، برای تکمیل خوشه SEO و جذب کاربران فنی، مقاله دوم باید روی یکی از دردهای واقعی مهندسان تمرکز می‌کرد: کاویتاسیون در کنترل ولو. این موضوع هم از نظر جستجوی گوگل مهم است و هم مستقیم به ارزش ابزار PTF در بررسی cavitation/noise/validation مرتبط است.

## تغییرات اصلی

### 1) مقاله آموزشی SEO جدید
فایل جدید:

```text
knowledge-center/control-valve-cavitation-guide.html
```

عنوان:

```text
کاویتاسیون در کنترل ولو چیست؟ روش تشخیص و جلوگیری
```

موضوعات پوشش‌داده‌شده:

- کاویتاسیون در کنترل ولو
- تفاوت cavitation و flashing
- نقش FL، Pv، Pc و ΔP_choked
- شاخص severity
- نشانه‌ها و پیامدهای کاویتاسیون
- روش‌های جلوگیری: anti-cavitation trim، staged pressure drop، افزایش فشار پایین‌دست و کنترل velocity
- محدودیت vendor-certified و ضرورت vendor sizing sheet

### 2) لینک‌دهی داخلی
- مقاله جدید به صفحه ابزار کنترل ولو لینک می‌دهد:

```text
/tools/control-valve-sizing/
```

- مقاله قبلی Cv calculation به مقاله کاویتاسیون لینک داده شد.
- صفحه landing کنترل ولو به مقاله کاویتاسیون لینک داده شد.
- `knowledge-center/index.html` مقاله را در cluster شیرآلات نمایش می‌دهد.
- `sitemap.xml` مقاله را با priority 0.85 دارد.

### 3) Structured Data
مقاله JSON-LD دارد:

```text
BreadcrumbList
Article
FAQPage
```

## اقدام خارج از کد
بعد از deploy، در Google Search Console این URL را request indexing کنید:

```text
https://pishtaj.ir/knowledge-center/control-valve-cavitation-guide.html
```

## فایل‌های تغییرکرده

```text
knowledge-center/control-valve-cavitation-guide.html
knowledge-center/control-valve-cv-calculation-guide.html
knowledge-center/index.html
tools/control-valve-sizing/index.html
sitemap.xml
crm/index.html
crm/sw.js
crm/clear-cache.html
api/tools.php
tools/advanced-tools-ui.js
_tools/uat/tester265-control-valve-cavitation-seo-article.js
PTF-MASTER-HANDOVER.md
```

## تست
- تست جدید `tester265-control-valve-cavitation-seo-article.js` اضافه شد.
- regression کامل و audit قبل از ZIP اجرا می‌شود.
