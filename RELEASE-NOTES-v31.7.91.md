# Release Notes — v31.7.91

## عنوان ریلیز
**TOOLS-FUNNEL-KPI-DASHBOARD-001**

## RCA / دلیل دقیق
بعد از ساخت صفحه اختصاصی کنترل ولو، مسیر feedback و چند مقاله پشتیبان SEO، نیاز بود بتوانیم داخل CRM اثر این مسیر را بسنجیم. بدون KPI مشخص نمی‌توان فهمید چند feedback ثبت شده، چند مورد پیگیری شده، چند feedback به lead/converted تبدیل شده، چند draft و final report صادر شده و آیا کاربران نمونه گزارش را دیده‌اند یا نه.

## تغییرات اصلی

### 1) داشبورد KPI قیف ابزار کنترل ولو در CRM
در `crm/tool-feedback.js` بخش جدید اضافه شد:

```text
داشبورد KPI قیف ابزار کنترل ولو
```

توابع جدید:

```js
ptfToolFunnelKpiHtml()
ptfToolFunnelKpiLoad()
```

### 2) منابع داده KPI
داشبورد فعلاً از داده‌های server-side موجود استفاده می‌کند:

```text
admin_feedback_list
admin_report_drafts
admin_list
```

یعنی:
- feedbackهای ابزار
- draftهای گزارش ابزار
- final reportهای صادرشده
- لایسنس‌های صادرشده

### 3) KPIهای نمایش داده‌شده
- Feedback total
- Average rating
- Sample viewed
- Contacted / Converted
- Draft reports
- Final reports
- Active licenses
- Feedback → Draft ratio
- Breakdown بر اساس source
- Breakdown بر اساس status
- Next actions پیشنهادی

### 4) محدودیت شفاف
بازدید خام صفحات و کلیک‌ها هنوز privacy-first و عمدتاً در مرورگر/localStorage هستند؛ این داشبورد فقط داده‌های server-side مثل feedback/draft/license را تجمیع می‌کند. برای analytics کامل‌تر، در فاز بعدی باید تصمیم جداگانه برای ارسال امن و privacy-aware metrics به سرور گرفته شود.

## فایل‌های تغییرکرده

```text
crm/tool-feedback.js
crm/index.html
crm/sw.js
crm/clear-cache.html
api/tools.php
tools/advanced-tools-ui.js
_tools/uat/tester268-tools-funnel-kpi-dashboard.js
PTF-MASTER-HANDOVER.md
ADV-CV-FINALIZATION-BACKLOG-v31.7.91.md
ADV-CV-GTM-FEEDBACK-SALES-PLAN-v31.7.91.md
```

## تست
- تست جدید `tester268-tools-funnel-kpi-dashboard.js` اضافه شد.
- regression کامل و audit قبل از ZIP اجرا می‌شود.
