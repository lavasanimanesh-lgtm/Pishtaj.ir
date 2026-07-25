# Release Notes — v31.7.84

## عنوان ریلیز
**ADV-CV-DEMO-REPORT-DATASHEET-ASSIST-001**

## RCA / دلیل دقیق
کارفرما دو نیاز مهم مطرح کرد:

1. برای جلب اعتماد کاربران، قبل از خرید/فعال‌سازی باید نمونه خروجی نهایی ابزار کنترل ولو قابل مشاهده باشد.
2. برای کاهش زحمت ورود اطلاعات، باید بررسی شود آیا می‌توان با بارگذاری دیتاشیت ولو یا vendor sheet بخشی از فرم را خودکار پر کرد.

همچنین مشکل لایسنس پرسنل داخلی که در v31.7.83 اصلاح شد، در این ریلیز حفظ و تست شد.

## تغییرات اصلی

### 1) نمونه گزارش نهایی عمومی
در صفحه ابزارها دکمه جدید اضافه شد:

```text
مشاهده نمونه گزارش نهایی
```

تابع‌های جدید:

```js
ptfAdvCvBuildPublicSampleFinalReportHtml()
ptfAdvCvOpenSampleFinalReport()
```

این نمونه:
- عمومی است.
- نیاز به لایسنس ندارد.
- quota مصرف نمی‌کند.
- فقط ساختار نهایی گزارش را برای اعتمادسازی نشان می‌دهد.

### 2) Datasheet Assist / Auto-fill فاز ۱
در فرم Advanced Control Valve بخش جدید اضافه شد:

```text
ورود سریع از دیتاشیت / Vendor sheet
```

تابع‌های جدید:

```js
ptfAdvCvExtractDatasheetText(text)
ptfAdvCvApplyDatasheetExtract()
ptfAdvCvReadDatasheetFile()
```

پشتیبانی فاز فعلی:
- copy/paste متن دیتاشیت
- TXT
- CSV
- JSON

فیلدهای قابل استخراج:
- Tag
- Service
- Fluid / Phase
- Flow / P1 / P2 / Temperature
- SG / Viscosity / Pv / Pc
- MW / Z / k
- FL / Fd / Xt
- Rated Cv
- Inlet / Outlet pipe
- Class / Body / Trim
- Brand / Series / Leakage
- Fail action / Shutoff / Seat

محدودیت شفاف:
- PDF و تصویر اسکن‌شده در این فاز parse مستقیم نمی‌شوند.
- برای PDF/OCR باید در فاز بعدی server-side parser اضافه شود.

### 3) GTM / Feedback / Sales Plan
سند جدید اضافه شد:

```text
ADV-CV-GTM-FEEDBACK-SALES-PLAN-v31.7.84.md
```

شامل:
- پلن جذب کاربر
- پلن feedback
- پلن فروش منصفانه
- KPIها
- roadmap دیتاشیت upload / PDF / OCR / LLM extraction
- اقدام Google Search Console

## وضعیت ابزار کنترل ولو
ابزار از نظر محصول قابل گزارش‌دهی آماده است:

```text
draft → CRM review → final gate → final HTML report → quota handling
```

اما این موارد هنوز فاز بعدی هستند:

```text
server-side binary PDF
online payment
automatic license after payment
vendor-certified final sizing
PDF/OCR datasheet parser
```

## فایل‌های تغییرکرده

```text
tools/advanced-tools-ui.js
tools/index.html
tools/tools-ui.js
tools/advanced-report-ui.js
api/tools.php
crm/index.html
crm/sw.js
crm/clear-cache.html
crm/tool-report-drafts.js
ADV-CV-GTM-FEEDBACK-SALES-PLAN-v31.7.84.md
_tools/uat/tester259-advanced-cv-public-sample-report.js
_tools/uat/tester260-advanced-cv-datasheet-assist.js
_tools/uat/tester261-advanced-cv-gtm-sales-plan.js
PTF-MASTER-HANDOVER.md
```

## تست
- تست نمونه گزارش عمومی اضافه شد.
- تست datasheet assist اضافه شد.
- تست GTM/sales plan اضافه شد.
- regression کامل و audit قبل از ZIP اجرا می‌شود.
