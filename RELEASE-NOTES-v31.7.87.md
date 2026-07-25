# Release Notes — v31.7.87

## عنوان ریلیز
**ADV-CV-FIRST-SEO-ARTICLE-001**

## RCA / دلیل دقیق
بعد از ساخت صفحه اختصاصی `/tools/control-valve-sizing/` و مسیر feedback، برای جذب ورودی ارگانیک از گوگل لازم بود اولین مقاله پشتیبان SEO ساخته شود. صفحه landing برای تبدیل کاربر مناسب است، اما برای رتبه گرفتن روی سوالات آموزشی مانند «محاسبه Cv کنترل ولو چیست؟» باید محتوای آموزشی عمیق و لینک‌دهی داخلی به ابزار وجود داشته باشد.

## تغییرات اصلی

### 1) مقاله آموزشی SEO جدید
فایل جدید:

```text
knowledge-center/control-valve-cv-calculation-guide.html
```

عنوان:

```text
محاسبه Cv کنترل ولو چیست؟ راهنمای مهندسی برای سایزینگ Control Valve
```

موضوعات پوشش‌داده‌شده:

- Cv و Kv چیست؟
- تفاوت Cv و Kv
- فرمول‌های پایه مایع
- choked flow و ΔP_choked
- Gas/Steam و x / xT
- داده‌های موردنیاز برای سایزینگ
- خطاهای رایج انتخاب کنترل ولو
- workflow پیشنهادی
- محدودیت vendor-certified و PDF باینری

### 2) لینک داخلی و conversion
مقاله به صفحه اختصاصی ابزار لینک می‌دهد:

```text
/tools/control-valve-sizing/
```

همچنین CTAهای زیر دارد:

- ورود به صفحه ابزار کنترل ولو
- مشاهده نمونه گزارش نهایی
- ثبت feedback کوتاه

### 3) لینک از landing و knowledge-center
- صفحه اختصاصی کنترل ولو به مقاله لینک داده شد.
- `knowledge-center/index.html` مقاله جدید را در cluster شیرآلات لینک می‌دهد.
- `sitemap.xml` مقاله جدید را با priority 0.85 دارد.

### 4) Structured Data
مقاله JSON-LD دارد:

```text
BreadcrumbList
Article
FAQPage
```

## اقدام خارج از کد
بعد از deploy، در Google Search Console این URL را request indexing کنید:

```text
https://pishtaj.ir/knowledge-center/control-valve-cv-calculation-guide.html
```

و بهتر است دوباره این URL هم request indexing شود:

```text
https://pishtaj.ir/tools/control-valve-sizing/
```

## فایل‌های تغییرکرده

```text
knowledge-center/control-valve-cv-calculation-guide.html
knowledge-center/index.html
tools/control-valve-sizing/index.html
sitemap.xml
crm/index.html
crm/sw.js
crm/clear-cache.html
api/tools.php
tools/advanced-tools-ui.js
_tools/uat/tester264-control-valve-first-seo-article.js
PTF-MASTER-HANDOVER.md
```

## تست
- تست جدید `tester264-control-valve-first-seo-article.js` اضافه شد.
- regression کامل و audit قبل از ZIP اجرا می‌شود.
