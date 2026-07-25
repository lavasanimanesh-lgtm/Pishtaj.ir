# Release Notes — v31.7.92

## عنوان ریلیز
**PRIVACY-METRICS-SERVER-SYNC-001**

## RCA / دلیل دقیق
داشبورد KPI v31.7.91 فقط داده‌های server-side موجود مانند feedback، draft، final report و license را می‌دید. برای کامل‌تر شدن قیف جذب کاربر ابزار کنترل ولو، نیاز بود page view و کلیک‌های مهم مثل مشاهده نمونه گزارش و باز شدن فرم feedback نیز به‌صورت امن و privacy-aware به سرور برسند. نسخه قبلی metrics کاملاً local/privacy-first بود و هیچ sync سروری نداشت؛ بنابراین قیف کامل نبود.

## تغییرات اصلی

### 1) Server-side aggregate metrics
اکشن عمومی جدید:

```text
metrics_ingest
```

Runtime file:

```text
crm/data/tool_metrics.json
```

داده‌ها فقط aggregate ذخیره می‌شوند:

- event
- path بدون query string
- day
- source محدودشده
- eventPath aggregate

ذخیره نمی‌شود:

- sid
- title
- label
- href
- query string
- اطلاعات شخصی

### 2) Admin metrics summary
اکشن admin جدید:

```text
admin_metrics_summary
```

خروجی شامل:

- byEvent
- byPath
- bySource
- byEventPath
- funnel:
  - toolsPageViews
  - controlValveLandingViews
  - sampleReportOpens
  - feedbackOpens
  - feedbackSubmits
  - rfqClicks
  - toolActivationClicks

### 3) Client metrics sync
`assets/js/ptf-metrics.js` اکنون فقط payload sanitized می‌فرستد:

```js
{ event, path, t, utm_source }
```

و هیچ sid/title/label/href ارسال نمی‌کند.

### 4) KPI dashboard upgrade
داشبورد KPI در CRM اکنون `admin_metrics_summary` را هم می‌خواند و کارت‌های زیر را بهتر نشان می‌دهد:

- Landing views
- Sample clicks
- Feedback opens
- Metrics path breakdown
- Metrics event breakdown

## محدودیت‌ها
- این sync فقط aggregate است و برای تحلیل رفتاری فردی طراحی نشده است.
- ارسال اطلاعات شخصی عمداً انجام نمی‌شود.
- اگر در آینده analytics دقیق‌تر لازم شد، باید با سیاست privacy و consent جداگانه طراحی شود.

## فایل‌های تغییرکرده

```text
api/tools.php
assets/js/ptf-metrics.js
crm/tool-feedback.js
crm/index.html
crm/sw.js
crm/clear-cache.html
tools/advanced-tools-ui.js
tools/advanced-feedback-ui.js
_tools/uat/tester269-privacy-metrics-server-sync.js
PTF-MASTER-HANDOVER.md
```

## تست
- تست جدید `tester269-privacy-metrics-server-sync.js` اضافه شد.
- تست‌های metrics قدیمی برای سیاست جدید privacy-aware aggregate sync به‌روزرسانی شدند.
- regression کامل و audit قبل از ZIP اجرا می‌شود.
