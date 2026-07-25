# Release Notes — v31.7.65

**تاریخ:** ۱۴۰۵/۰۴/۳۰ (2026-07-21)  
**نسخه:** `v31.7.65`  
**نوع:** ADV-CV-FINAL-READINESS-GATE-001 — Final readiness gate برای draft گزارش Advanced Control Valve

---

## هدف ریلیز

ادامه تکمیل workflow اولین ابزار پیشرفته، بدون فعال‌سازی PDF یا پرداخت آنلاین. در این نسخه برای draftهای گزارش Advanced Control Valve یک **Final readiness gate** اضافه شد تا قبل از هرگونه گزارش نهایی آینده، شرایط لازم به‌صورت سخت‌گیرانه بررسی شود.

این gate فقط آمادگی را بررسی می‌کند و همچنان این موارد را فعال نمی‌کند:

```text
PDF
Download
Final report number
Quota consumption
Online payment
```

---

## RCA / دلیل دقیق

1. در نسخه‌های قبل، draft گزارش ابزار می‌توانست در سرور ذخیره شود و در CRM review بگیرد.
2. اما اگر یک draft به وضعیت `approved_for_final_phase` برسد، هنوز باید قبل از فاز گزارش نهایی، چند شرط حیاتی بررسی شود.
3. این شروط شامل وضعیت review، صحت checksum، کامل بودن readiness، وضعیت لایسنس، quota و قفل بودن payload است.
4. بنابراین یک gate سروری اضافه شد تا این بررسی‌ها را انجام دهد و نتیجه را در runtime ذخیره کند، اما هیچ گزارش نهایی نسازد.

---

## کارهای انجام‌شده

### 1) Endpoint جدید در `api/tools.php`

اضافه شد:

```text
admin_report_final_gate
```

این endpoint فقط برای نقش‌های زیر مجاز است:

```text
admin
chairman
```

---

### 2) تابع gate سروری

اضافه شد:

```php
tools_build_final_gate()
```

این تابع بررسی می‌کند:

```text
draft status = approved_for_final_phase
payload schema معتبر است
payload status = LOCKED_PREVIEW_PAYLOAD
checksum سمت سرور با payload یکی است
readiness کامل است
missing fields وجود ندارد
pipeIssues وجود ندارد
licenseId موجود است
license فعال است
license منقضی نشده است
license quota تمام نشده است
license برای control_valve_advanced یا all مجاز است
final/pdf/download/serverSideReport همچنان false هستند
```

---

### 3) ذخیره نتیجه gate

نتیجه در خود draft ذخیره می‌شود:

```text
finalGate
finalGateHistory[]
```

خروجی gate شامل:

```text
readyForFinalPhase
finalReportGenerationEnabled = false
pdfEnabled = false
downloadEnabled = false
quotaConsumed = false
serverChecksum
blockers[]
warnings[]
nextAllowedAction
```

---

### 4) UI در CRM

در `crm/tool-report-drafts.js` اضافه شد:

```text
Final gate
Final readiness gate
```

در جدول draftها ستون جدید اضافه شد:

```text
Final Gate
```

و در modal نتیجه gate، این موارد دیده می‌شود:

```text
readyForFinalPhase
finalReportGenerationEnabled=false
pdfEnabled=false
quotaConsumed=false
blockers
warnings
```

---

## مواردی که همچنان قفل هستند

حتی اگر gate آماده باشد:

```text
PDF export
Download report
Final report number
Server-side report rendering
Paid report quota consumption
Online payment
```

Gate فقط می‌گوید draft برای فاز نهایی آینده آماده است یا نه.

---

## فایل‌های تغییر یافته

```text
api/tools.php
crm/tool-report-drafts.js
crm/index.html
crm/sw.js
crm/clear-cache.html
PTF-MASTER-HANDOVER.md
_tools/uat/tester227-storage-quota-foundation.js
_tools/uat/tester228-storage-idb-volatile-migration.js
_tools/uat/tester229-storage-idb-module-primary.js
_tools/uat/tester230-public-cache-idb.js
_tools/uat/tester231-tools-license-admin.js
_tools/uat/tester239-advanced-cv-server-report-scaffold.js
_tools/uat/tester240-tools-report-draft-crm-inbox.js
_tools/uat/tester241-tools-report-review-actions.js
_tools/uat/tester242-tools-final-readiness-gate.js
RELEASE-NOTES-v31.7.65.md
REGRESSION-REPORT-v31.7.65.md
```

---

## تست اضافه‌شده

```text
_tools/uat/tester242-tools-final-readiness-gate.js
```

پوشش:

- وجود `admin_report_final_gate`.
- محافظت endpoint با `tools_admin_require`.
- وجود `tools_build_final_gate`.
- الزام status = `approved_for_final_phase`.
- بررسی checksum و locked flags.
- بررسی readiness/missing/pipeIssues.
- بررسی license active/expiry/quota/tool.
- ذخیره finalGate و finalGateHistory.
- حفظ final/PDF/quota false.
- وجود UI دکمه Final Gate.
- نبود print/PDF/download/export.

نتیجه مستقیم:

```text
tester242-tools-final-readiness-gate: 16 PASS / 0 FAIL
```

---

## Impact Analysis

| بخش | اثر | ریسک |
|---|---|---|
| API tools | final readiness gate اضافه شد | متوسط/کنترل‌شده |
| CRM Draft Inbox | ستون و دکمه Final Gate اضافه شد | کم/متوسط |
| Runtime data | finalGate/finalGateHistory ذخیره می‌شود | کم |
| License validation | active/expiry/quota/tool قبل از final phase بررسی می‌شود | مثبت |
| PDF/final report | همچنان قفل | بدون تغییر |
| Payment | همچنان غیرفعال | بدون تغییر |

---

## محدودیت تست PHP

در sandbox فعلی `php` نصب نیست، بنابراین `php -l api/tools.php` قابل اجرا نبود. پس از deploy روی هاست اجرا شود:

```bash
php -l api/tools.php
```

---

## راستی‌آزمایی کارفرما

1. یک draft گزارش از Advanced Control Valve ثبت کنید.
2. در CRM آن draft را پیدا کنید.
3. ابتدا وضعیت آن را به این حالت تغییر دهید:

```text
Approved for final phase
```

4. سپس روی دکمه زیر بزنید:

```text
Final gate
```

5. اگر همه شروط آماده باشند، باید ببینید:

```text
readyForFinalPhase = true
```

6. اگر داده‌ای ناقص باشد، لایسنس مشکل داشته باشد، checksum mismatch باشد یا status مناسب نباشد، لیست blockers باید نمایش داده شود.
7. هیچ PDF یا دانلودی نباید تولید شود.

---

## نتیجه

اکنون مسیر draft گزارش Advanced Control Valve یک gate نهایی قبل از report engine دارد. این gate بررسی می‌کند که آیا draft برای فاز نهایی آینده آماده است یا نه، اما هنوز هیچ گزارش نهایی، PDF یا پرداختی فعال نمی‌کند.