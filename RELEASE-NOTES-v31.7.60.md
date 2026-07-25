# Release Notes — v31.7.60

**تاریخ:** ۱۴۰۵/۰۴/۳۰ (2026-07-21)  
**نسخه:** `v31.7.60`  
**نوع:** ADV-CV-REPORT-PREVIEW-001 — پیش‌نمایش گزارش انگلیسی روی صفحه برای Advanced Control Valve

---

## هدف ریلیز

ادامه تکمیل اولین ابزار پیشرفته پیش از فعال‌سازی پرداخت آنلاین. در این نسخه، ابزار **Advanced Control Valve** یک پیش‌نمایش گزارش استاندارد انگلیسی روی صفحه دریافت کرد تا قبل از PDF نهایی و پرداخت آنلاین، بتوان از مهندسان feedback گرفت.

این preview فقط on-screen است و هیچ PDF، دانلود یا report number رسمی تولید نمی‌کند.

---

## RCA / دلیل دقیق

1. ابزار اکنون محاسبات مقدماتی قابل توجهی دارد: Cv/Kv، Min/Normal/Max، velocity/reducer، cavitation/flashing severity، actuator shell و noise risk.
2. برای گرفتن feedback مهندسی، خروجی پراکنده روی صفحه کافی نیست؛ کاربر باید ساختار گزارش انگلیسی را ببیند.
3. اما PDF نهایی و گزارش قابل دانلود هنوز نباید باز شود، چون report engine، quota مصرف گزارش و تایید نهایی محاسبات کامل نشده‌اند.
4. بنابراین یک **English report preview** اضافه شد که محاسبات فعلی را در قالب گزارش نشان می‌دهد، ولی صریحاً `PREVIEW ONLY — NOT A FINAL REPORT` است.

---

## کارهای انجام‌شده

### 1) توابع جدید report preview

در `tools/advanced-tools-ui.js` اضافه شد:

```js
ptfAdvCvBuildEnglishReportPreview(draft, result)
ptfAdvCvShowReportPreview()
```

---

### 2) دکمه جدید در ابزار

برای کاربر دارای grant، دکمه جدید اضافه شد:

```text
پیش‌نمایش گزارش انگلیسی
```

---

### 3) ساختار گزارش انگلیسی روی صفحه

Preview شامل این بخش‌هاست:

```text
1. Project and Tag Data
2. Design Basis
3. Preliminary Liquid Sizing Results
4. Governing Result
5. Actuator Sizing Shell
6. Preliminary Warnings
7. Risk Review Recommendations
8. Formula Trace — Governing Case
9. Missing / Incomplete Data
10. Assumptions and Limitations
```

---

### 4) هشدارهای صریح عدم نهایی بودن

در preview نمایش داده می‌شود:

```text
PREVIEW ONLY — NOT A FINAL REPORT
```

و در بخش limitations نیز تصریح شده است:

```text
No PDF, downloadable report or final report number is generated in this phase.
```

---

## مواردی که هنوز عمداً قفل هستند

```text
PDF export
Download report
Final report number
Server-side report generation
Paid report consume/quota
Final IEC/ISA noise/cavitation calculation
Final actuator/vendor selection
Online payment
```

---

## فایل‌های تغییر یافته

```text
tools/advanced-tools-ui.js
crm/index.html
crm/sw.js
crm/clear-cache.html
ADV-CV-INPUT-SCHEMA-v1.md
PTF-MASTER-HANDOVER.md
_tools/uat/tester227-storage-quota-foundation.js
_tools/uat/tester228-storage-idb-volatile-migration.js
_tools/uat/tester229-storage-idb-module-primary.js
_tools/uat/tester230-public-cache-idb.js
_tools/uat/tester231-tools-license-admin.js
_tools/uat/tester237-advanced-cv-report-preview.js
RELEASE-NOTES-v31.7.60.md
REGRESSION-REPORT-v31.7.60.md
```

---

## تست اضافه‌شده

```text
_tools/uat/tester237-advanced-cv-report-preview.js
```

پوشش:

- وجود `ADV-CV-REPORT-PREVIEW-001`.
- وجود توابع report preview.
- وجود متن `PREVIEW ONLY — NOT A FINAL REPORT`.
- وجود سکشن‌های استاندارد انگلیسی.
- وجود دکمه پیش‌نمایش گزارش انگلیسی.
- نبود fetch/PDF/print/export/download link.
- runtime تولید preview با project/tag/case/gov/risk/actuator/noise.
- fail-closed بودن بدون grant.

نتیجه مستقیم:

```text
tester237-advanced-cv-report-preview: 11 PASS / 0 FAIL
```

---

## Impact Analysis

| بخش | اثر | ریسک |
|---|---|---|
| Advanced Control Valve | ساختار report preview اضافه شد | متوسط/کنترل‌شده |
| Licensed users | خروجی قابل feedback و شبیه گزارش می‌بینند | مثبت |
| Public users | همچنان locked preview | کم |
| PDF/final report | همچنان قفل | بدون تغییر |
| Payment | همچنان غیرفعال | بدون تغییر |

---

## راستی‌آزمایی کارفرما

1. وارد `/tools/` شوید.
2. Advanced Control Valve را با لایسنس unlock کنید.
3. داده‌های Liquid، caseها، pipe، actuator را وارد کنید.
4. محاسبه مقدماتی را اجرا کنید.
5. روی دکمه زیر بزنید:

```text
پیش‌نمایش گزارش انگلیسی
```

6. باید گزارش انگلیسی روی صفحه ببینید.
7. مطمئن شوید هیچ PDF یا دانلودی تولید نمی‌شود.

---

## نتیجه

Advanced Control Valve اکنون علاوه بر محاسبات مقدماتی، پیش‌نمایش گزارش انگلیسی هم دارد. این مرحله ابزار را برای گرفتن feedback مهندسی آماده‌تر می‌کند، بدون اینکه هنوز report engine یا پرداخت آنلاین باز شده باشد.