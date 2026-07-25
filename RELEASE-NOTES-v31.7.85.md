# Release Notes — v31.7.85

## عنوان ریلیز
**ADV-CV-DEDICATED-LANDING-SEO-001**

## RCA / دلیل دقیق
پس از اضافه شدن نمونه گزارش نهایی، Datasheet Assist و پایه SEO در `/tools/`، برای رقابت جدی‌تر روی کلیدواژه‌های «سایزینگ کنترل ولو»، «محاسبه Cv کنترل ولو» و `control valve sizing` لازم بود یک صفحه اختصاصی قابل ایندکس با canonical مستقل، محتوای تخصصی، FAQ، schema و لینک داخلی ساخته شود. صفحه عمومی `/tools/` برای همه ابزارهاست و برای رتبه گرفتن روی یک موضوع تخصصی کافی نیست.

## تغییرات اصلی

### 1) صفحه اختصاصی SEO برای کنترل ولو
صفحه جدید اضافه شد:

```text
tools/control-valve-sizing/index.html
```

URL هدف:

```text
https://pishtaj.ir/tools/control-valve-sizing/
```

### 2) محتوای تخصصی
صفحه شامل محتوای هدفمند درباره:

- سایزینگ کنترل ولو
- محاسبه Cv و Kv
- Liquid / Gas / Steam
- choked flow
- cavitation / noise
- actuator sizing shell
- Engineering Validation Matrix
- Vendor Data Validation Matrix
- Datasheet Assist
- محدودیت vendor-certified / PDF / OCR

### 3) Structured Data
JSON-LD اضافه شد برای:

```text
BreadcrumbList
SoftwareApplication
FAQPage
TechArticle
```

### 4) لینک داخلی و sitemap
- از `/tools/` به صفحه اختصاصی لینک اضافه شد.
- `sitemap.xml` شامل URL جدید شد.

## اثرات
- مسیر جذب کاربر برای کلیدواژه‌های دقیق‌تر کنترل ولو قوی‌تر شد.
- صفحه اختصاصی می‌تواند در Google Search Console جداگانه request indexing شود.
- نمونه گزارش نهایی و درخواست feedback در landing page قابل دسترس است.

## اقدام خارج از کد
بعد از deploy در Google Search Console این URL را request indexing کنید:

```text
https://pishtaj.ir/tools/control-valve-sizing/
```

## فایل‌های تغییرکرده

```text
tools/control-valve-sizing/index.html
tools/index.html
sitemap.xml
crm/index.html
crm/sw.js
crm/clear-cache.html
tools/advanced-tools-ui.js
api/tools.php
_tools/uat/tester262-control-valve-dedicated-seo-landing.js
PTF-MASTER-HANDOVER.md
```

## تست
- تست جدید `tester262-control-valve-dedicated-seo-landing.js` اضافه شد.
- regression کامل و audit قبل از ZIP اجرا می‌شود.
