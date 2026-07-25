# Release Notes — v31.7.86

## عنوان ریلیز
**TOOLS-FEEDBACK-CRM-INBOX-001**

## RCA / دلیل دقیق
پس از آماده شدن ابزار کنترل ولو برای گزارش‌دهی و ساخت صفحه اختصاصی SEO، قدم بعدی برای جذب کاربران واقعی، دریافت feedback ساختاری و قابل پیگیری بود. تا قبل از این نسخه، کاربر می‌توانست درخواست فعال‌سازی یا RFQ ثبت کند، اما feedback محصولی ابزارها به‌صورت مستقل در CRM ذخیره و مدیریت نمی‌شد.

## تغییرات اصلی

### 1) API ثبت feedback
اکشن عمومی جدید:

```text
feedback_create
```

Runtime file:

```text
crm/data/tool_feedback.json
```

فیلدهای ذخیره‌شده:

- tool
- source
- rating
- role
- company
- contact
- message
- sampleReportViewed
- pageUrl
- context: tag/service/phase
- licenseId اختیاری از grant معتبر
- status/history برای CRM

### 2) CRM Feedback Inbox
اکشن‌های admin:

```text
admin_feedback_list
admin_feedback_update
```

Statusها:

```text
new
reviewed
contacted
converted
needs_followup
spam
archived
```

فایل جدید CRM:

```text
crm/tool-feedback.js
```

### 3) Public Feedback UI
فایل جدید:

```text
tools/advanced-feedback-ui.js
```

تابع‌ها:

```js
ptfAdvCvOpenFeedbackForm(source)
ptfAdvCvSubmitFeedback(source)
```

نقاط دسترسی:

- `/tools/`
- `/tools/control-valve-sizing/`
- modal ابزار Advanced Control Valve

### 4) بدون پرداخت / بدون quota
ثبت feedback:

- لایسنس صادر نمی‌کند.
- quota مصرف نمی‌کند.
- پرداخت آنلاین فعال نمی‌کند.
- فقط lead/product-feedback را در CRM ثبت می‌کند.

## فایل‌های تغییرکرده

```text
api/tools.php
tools/advanced-feedback-ui.js
tools/advanced-tools-ui.js
tools/index.html
tools/control-valve-sizing/index.html
crm/tool-feedback.js
crm/index.html
crm/sw.js
crm/clear-cache.html
PTF-MASTER-HANDOVER.md
_tools/uat/tester263-tools-feedback-crm-inbox.js
```

## اثرات
- مسیر واقعی feedback کاربران ابزار کنترل ولو ایجاد شد.
- تیم CRM می‌تواند feedbackها را پیگیری و به lead فروش یا نیاز محصول تبدیل کند.
- مرحله بعدی می‌تواند تولید اولین مقاله SEO پشتیبان یا توسعه PDF/OCR parser باشد.

## تست
- تست جدید `tester263-tools-feedback-crm-inbox.js` اضافه شد.
- regression کامل و audit قبل از ZIP اجرا می‌شود.
