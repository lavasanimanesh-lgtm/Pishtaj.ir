# Release Notes — v31.7.80

## عنوان ریلیز
**ADV-CV-FINAL-REPORT-PRODUCTIZATION-001**

## علت / RCA
در نسخه‌های قبلی، ابزار Advanced Control Valve از نظر محاسبه و draft/payload پیشرفته شده بود، اما هنوز به محصول قابل گزارش‌دهی تبدیل نشده بود؛ یعنی گزارش نهایی شماره‌دار، مصرف quota واقعی، مسیر صدور از CRM و خروجی قابل چاپ/دانلود وجود نداشت. بنابراین برای پاسخ به نیاز کارفرما، یوزر استوری‌های باقی‌مانده اولویت‌بندی و یک مسیر نهایی‌سازی مرحله‌ای پیاده‌سازی شد.

## تغییرات اصلی

### 1) QA داخلی Gas/Steam
- اضافه شدن سناریوهای:
  - `gas_non_choked`
  - `gas_choked`
  - `steam_non_choked`
  - `steam_choked`
- QA داخلی اکنون ۸ سناریو Liquid/Gas/Steam را اجرا می‌کند.
- جدول QA شامل phase، choked، `x`، `xChoked` و `Actual Q` شد.

### 2) Final Report Workflow در API
- اکشن‌های جدید:
  - `admin_report_final_issue`
  - `admin_report_final_get`
- شماره گزارش نهایی:
  - `PTF-CV-YYYYMMDD-NNN`
- schema گزارش نهایی:
  - `ADV-CV-FINAL-REPORT-v1`
- گزارش نهایی شامل checksum و history است.

### 3) مصرف quota واقعی
- dry-run همچنان quota را کم نمی‌کند.
- quota فقط در `admin_report_final_issue` مصرف می‌شود.
- لایسنس `staff_internal` برای پرسنل شرکت quota-exempt است.

### 4) موتور گزارش نهایی HTML
- خروجی final HTML انگلیسی و immutable اضافه شد.
- شامل:
  - cover/report metadata
  - design basis
  - min/normal/max calculation table
  - risk/noise/actuator summary
  - formula trace
  - warnings/recommendations
  - چارت SVG داخلی برای Cv و opening%
  - limitations شفاف
- HTML نهایی قابل بازکردن و Print / Save as PDF در مرورگر است.

### 5) CRM UI
- ستون Final Report به کارتابل draftها اضافه شد.
- عملیات جدید:
  - Issue final
  - Final report
  - Download final HTML
  - Open/print final HTML

## فایل‌های تغییرکرده
- `tools/advanced-tools-ui.js`
- `tools/advanced-report-ui.js`
- `api/tools.php`
- `crm/tool-report-drafts.js`
- `crm/index.html`
- `crm/sw.js`
- `crm/clear-cache.html`
- `_tools/uat/tester239-advanced-cv-server-report-scaffold.js`
- `_tools/uat/tester240-tools-report-draft-crm-inbox.js`
- `_tools/uat/tester241-tools-report-review-actions.js`
- `_tools/uat/tester242-tools-final-readiness-gate.js`
- `_tools/uat/tester243-tools-report-engine-locked.js`
- `_tools/uat/tester244-tools-report-quota-dry-run.js`
- `_tools/uat/tester247-advanced-cv-internal-scenario-qa.js`
- `_tools/uat/tester252-advanced-cv-final-report-productization.js`
- `_tools/uat/tester253-advanced-cv-gas-steam-qa-scenarios.js`
- `_tools/uat/tester254-advanced-cv-finalization-backlog-doc.js`
- `ADV-CV-FINALIZATION-BACKLOG-v31.7.80.md`
- `PTF-MASTER-HANDOVER.md`

## محدودیت‌های شفاف
- PDF باینری سمت سرور هنوز تولید نمی‌شود؛ خروجی HTML در مرورگر با Print / Save as PDF قابل PDF گرفتن است.
- خروجی نهایی این نسخه vendor-certified نیست؛ برای انتخاب قطعی برند/مدل و محاسبات vendor acoustic/IEC نهایی باید داده سازنده و مسئول مهندسی بررسی کند.
- پرداخت آنلاین فعال نشده است.

## اثرات
- کاربران عمومی همچنان به ابزار پیشرفته دسترسی آزاد ندارند.
- کاربر دارای لایسنس می‌تواند draft را ثبت کند.
- ادمین/Chairman می‌تواند پس از approval/gate/quota گزارش نهایی صادر کند.
- Free tools هنوز PDF تولید نمی‌کنند.

## تست
- `node --check` برای JSهای اصلی و تست‌های جدید PASS شد.
- `python3 _tools/audit.py` پس از ایجاد اسناد انتشار باید PASS شود.
- `node _tools/run-full-regression.js` باید قبل از ZIP نهایی اجرا شود.
- PHP CLI در sandbox نصب نیست؛ روی سرور اجرا شود:
  - `php -l api/tools.php`
  - `php -l api/crm.php`
