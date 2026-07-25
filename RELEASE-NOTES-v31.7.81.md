# Release Notes — v31.7.81

## عنوان ریلیز
**ADV-CV-ENGINEERING-VALIDATION-MATRIX-001**

## RCA / دلیل دقیق
در v31.7.80 مسیر صدور گزارش نهایی HTML و مصرف quota تکمیل شد، اما برای نزدیک‌تر شدن گزارش به استاندارد مهندسی، لازم بود قبل از صدور نهایی و داخل گزارش، یک ماتریس validation مهندسی وجود داشته باشد تا ریسک‌های critical/review مثل choked flow، Gas/Steam preliminary، cavitation/noise، reducer correction، velocity و rangeability شفاف شوند.

## تغییرات اصلی

### 1) Engineering Validation Matrix در API
تابع جدید:

```php
tools_build_engineering_validation($payload)
```

schema جدید:

```text
ADV-CV-ENGINEERING-VALIDATION-v1
```

وضعیت‌های خروجی:

```text
acceptable_for_screening
engineering_review_required
requires_vendor_validation
```

### 2) پوشش validation
ماتریس جدید موارد زیر را بررسی می‌کند:

- Compressible service / Gas / Steam
- Choked / critical flow
- Cavitation / pressure risk
- Noise risk
- Reducer / attached fittings correction
- Line velocity
- Valve opening / rangeability
- Actuator shell completeness

### 3) اتصال به Final Gate
`admin_report_final_gate` اکنون `engineeringValidation` را در gate برمی‌گرداند و warningهای مهندسی را ثبت می‌کند.

### 4) اتصال به گزارش نهایی
گزارش نهایی HTML اکنون بخش جدید دارد:

```text
Engineering Validation Matrix
```

این بخش شامل area، status، severity، note و required action است.

### 5) CRM UI
کارتابل گزارش‌ها اکنون engineering status و critical count را در list/detail/gate/final modal نمایش می‌دهد.

## فایل‌های تغییرکرده

```text
api/tools.php
crm/tool-report-drafts.js
crm/index.html
crm/sw.js
crm/clear-cache.html
tools/advanced-tools-ui.js
tools/advanced-report-ui.js
_tools/uat/tester255-advanced-cv-engineering-validation-matrix.js
PTF-MASTER-HANDOVER.md
RELEASE-NOTES-v31.7.81.md
REGRESSION-REPORT-v31.7.81.md
```

## اثرات
- گزارش نهایی از نظر شفافیت engineering risk قوی‌تر شد.
- صدور گزارش همچنان ممکن است، اما اگر critical/review وجود داشته باشد، در final gate و final report صریح نمایش داده می‌شود.
- پرداخت آنلاین همچنان فعال نشده است.
- PDF باینری سمت سرور همچنان فعال نشده است؛ خروجی final HTML با مرورگر Print / Save as PDF می‌شود.

## تست
- تست جدید `tester255-advanced-cv-engineering-validation-matrix.js` اضافه شد.
- regression کامل باید قبل از ZIP نهایی اجرا شود.
- PHP CLI در sandbox موجود نیست؛ روی سرور اجرا شود:

```bash
php -l api/tools.php
php -l api/crm.php
```
