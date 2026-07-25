# Release Notes — v31.7.90

## عنوان ریلیز
**ADV-CV-TRIPLE-SEO-ARTICLE-001**

## RCA / دلیل دقیق
کارفرما تأکید کرد که مقاله پیشنهادی بعدی به همراه دو مقاله بعدی در یک ریلیز منتشر شود و اصول SEO فراموش نشود؛ به‌ویژه هیچ مقاله‌ای نباید کمتر از ۱۵۰۰ کلمه باشد. بنابراین در این ریلیز سه مقاله پشتیبان جدید برای خوشه SEO کنترل ولو منتشر شد و تست UAT برای هر سه مقاله، حداقل ۱۵۰۰ کلمه را enforce می‌کند.

## مقالات منتشرشده

### 1) سایزینگ کنترل ولو بخار
```text
knowledge-center/steam-control-valve-sizing-guide.html
```
موضوعات:
- Steam Control Valve Sizing
- دبی kg/h
- فشار مطلق
- choked flow
- noise و outlet velocity
- low-noise / multi-stage trim
- Xt و vendor-certified sizing sheet

### 2) سایزینگ کنترل ولو گاز
```text
knowledge-center/gas-control-valve-sizing-guide.html
```
موضوعات:
- Gas Control Valve Sizing
- Nm³/h / Sm³/h / actual flow
- pressure ratio
- MW/SG، Z، k، Xt
- choked flow
- noise و outlet velocity
- Vendor Data Validation Matrix

### 3) انتخاب اکچویتور کنترل ولو
```text
knowledge-center/control-valve-actuator-selection-guide.html
```
موضوعات:
- انتخاب اکچویتور کنترل ولو
- Fail Close / Fail Open / Fail Last
- shutoff ΔP
- required thrust
- air supply
- positioner و accessories
- تفاوت linear thrust و rotary torque

## قانون SEO اجباری
- هر سه مقاله حداقل ۱۵۰۰ کلمه دارند.
- تست جدید `tester267-control-valve-triple-seo-articles.js` این شرط را برای هر مقاله بررسی می‌کند.
- هر مقاله title/meta/canonical، JSON-LD Article/FAQPage/BreadcrumbList، لینک داخلی به ابزار، نمونه گزارش و فرم feedback دارد.

## لینک‌دهی داخلی
- `knowledge-center/index.html` هر سه مقاله را در cluster شیرآلات نمایش می‌دهد.
- `tools/control-valve-sizing/index.html` به هر سه مقاله لینک می‌دهد.
- `sitemap.xml` هر سه URL را با priority 0.85 دارد.

## اقدام خارج از کد
بعد از deploy، در Google Search Console این URLها request indexing شوند:

```text
https://pishtaj.ir/knowledge-center/steam-control-valve-sizing-guide.html
https://pishtaj.ir/knowledge-center/gas-control-valve-sizing-guide.html
https://pishtaj.ir/knowledge-center/control-valve-actuator-selection-guide.html
```

## فایل‌های تغییرکرده

```text
knowledge-center/steam-control-valve-sizing-guide.html
knowledge-center/gas-control-valve-sizing-guide.html
knowledge-center/control-valve-actuator-selection-guide.html
knowledge-center/index.html
tools/control-valve-sizing/index.html
sitemap.xml
crm/index.html
crm/sw.js
crm/clear-cache.html
api/tools.php
tools/advanced-tools-ui.js
_tools/uat/tester267-control-valve-triple-seo-articles.js
PTF-MASTER-HANDOVER.md
```

## تست
- تست جدید `tester267-control-valve-triple-seo-articles.js` اضافه شد.
- regression کامل و audit قبل از ZIP اجرا می‌شود.
