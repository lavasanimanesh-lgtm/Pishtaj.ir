# Release Notes — v31.7.89

## عنوان ریلیز
**ADV-CV-CV-KV-DIFFERENCE-SEO-ARTICLE-001**

## RCA / دلیل دقیق
کارفرما تأکید کرد که اصول SEO در مقالات باید رعایت شود و هیچ مقاله‌ای نباید کمتر از ۱۵۰۰ کلمه باشد. برای ادامه خوشه SEO کنترل ولو، مقاله سوم باید هم از نظر حجم محتوا و هم از نظر ساختار SEO استاندارد باشد. موضوع انتخاب‌شده «تفاوت Cv و Kv در کنترل ولو» است؛ چون یکی از پرسش‌های پرتکرار مهندسان و خریداران فنی است و مستقیماً به ابزار سایزینگ کنترل ولو لینک می‌شود.

## تغییرات اصلی

### 1) مقاله آموزشی SEO جدید
فایل جدید:

```text
knowledge-center/control-valve-cv-kv-difference.html
```

عنوان:

```text
تفاوت Cv و Kv در کنترل ولو چیست؟ فرمول تبدیل و کاربرد در سایزینگ
```

### 2) رعایت حداقل ۱۵۰۰ کلمه
تست UAT جدید بررسی می‌کند که مقاله کمتر از ۱۵۰۰ کلمه نباشد.

### 3) موضوعات پوشش‌داده‌شده
- تعریف Cv و Kv
- فرمول تبدیل:
  - `Cv ≈ 1.156 × Kv`
  - `Kv ≈ 0.865 × Cv`
- کاربرد در سایزینگ کنترل ولو
- خطاهای رایج تبدیل Cv/Kv
- ارتباط با FL و Xt
- خواندن دیتاشیت vendor
- workflow پیشنهادی
- FAQ

### 4) لینک‌دهی داخلی
- مقاله به landing ابزار کنترل ولو لینک می‌دهد:

```text
/tools/control-valve-sizing/
```

- مقاله‌های قبلی Cv و کاویتاسیون به این مقاله لینک داده شدند.
- صفحه landing کنترل ولو به این مقاله لینک داده شد.
- `knowledge-center/index.html` مقاله را در cluster شیرآلات نشان می‌دهد.
- `sitemap.xml` مقاله را با priority 0.85 دارد.

### 5) Structured Data
مقاله JSON-LD دارد:

```text
BreadcrumbList
Article
FAQPage
```

## اقدام خارج از کد
بعد از deploy، در Google Search Console این URL را request indexing کنید:

```text
https://pishtaj.ir/knowledge-center/control-valve-cv-kv-difference.html
```

## فایل‌های تغییرکرده

```text
knowledge-center/control-valve-cv-kv-difference.html
knowledge-center/control-valve-cv-calculation-guide.html
knowledge-center/control-valve-cavitation-guide.html
knowledge-center/index.html
tools/control-valve-sizing/index.html
sitemap.xml
crm/index.html
crm/sw.js
crm/clear-cache.html
api/tools.php
tools/advanced-tools-ui.js
_tools/uat/tester266-control-valve-cv-kv-difference-seo-article.js
PTF-MASTER-HANDOVER.md
```

## تست
- تست جدید `tester266-control-valve-cv-kv-difference-seo-article.js` اضافه شد.
- این تست حداقل ۱۵۰۰ کلمه را enforce می‌کند.
- regression کامل و audit قبل از ZIP اجرا می‌شود.
