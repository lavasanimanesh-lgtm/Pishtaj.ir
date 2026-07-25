# Release Notes — v31.7.66

**تاریخ:** ۱۴۰۵/۰۴/۳۰ (2026-07-21)  
**نسخه:** `v31.7.66`  
**نوع:** ADV-CV-REPORT-ENGINE-LOCKED-001 — رندر HTML داخلی و قفل‌شده گزارش Advanced Control Valve

---

## هدف ریلیز

ادامه تکمیل اولین ابزار پیشرفته، بدون فعال‌سازی PDF یا پرداخت آنلاین. در نسخه قبل، Final Readiness Gate مشخص می‌کرد draft گزارش آماده فاز نهایی آینده هست یا نه. در این نسخه، اگر gate آماده باشد، سرور می‌تواند یک **HTML report preview قفل‌شده داخلی** بسازد تا تیم داخلی خروجی نهایی احتمالی را review کند.

این خروجی همچنان نهایی نیست:

```text
No PDF
No download
No final report number
No quota consumption
No online payment
```

---

## RCA / دلیل دقیق

1. پس از v31.7.65، draft می‌توانست final readiness gate بگیرد.
2. اما حتی اگر gate آماده بود، هنوز خروجی report engine سمت سرور برای review داخلی وجود نداشت.
3. برای نزدیک شدن به report engine، لازم بود سرور بتواند از payload قفل‌شده، HTML داخلی بسازد.
4. این HTML باید watermark و قفل‌های واضح داشته باشد تا با گزارش نهایی اشتباه نشود.
5. بنابراین `admin_report_render_locked` اضافه شد: فقط بعد از pass شدن gate، HTML داخلی قفل‌شده می‌سازد و metadata رندر را ذخیره می‌کند.

---

## کارهای انجام‌شده

### 1) Endpoint جدید در `api/tools.php`

اضافه شد:

```text
admin_report_render_locked
```

این endpoint فقط برای نقش‌های زیر مجاز است:

```text
admin
chairman
```

---

### 2) تابع رندر HTML قفل‌شده

اضافه شد:

```php
tools_render_locked_report_html()
```

این تابع از payload draft، یک HTML internal preview می‌سازد که شامل بخش‌های زیر است:

```text
Project and Tag Data
Design Basis
Preliminary Liquid Sizing Results
Governing and Risk Summary
Actuator Sizing Shell
Warnings and Recommendations
Final Readiness Gate
```

---

### 3) Gate قبل از render

قبل از تولید HTML، سرور دوباره gate را اجرا می‌کند:

```php
tools_build_final_gate()
```

اگر gate آماده نباشد، پاسخ با خطای زیر برمی‌گردد:

```text
final_gate_blocked
```

و blockers نمایش داده می‌شوند.

---

### 4) Watermark صریح

HTML خروجی با watermark زیر ساخته می‌شود:

```text
LOCKED INTERNAL HTML PREVIEW — NOT A FINAL REPORT — NO PDF GENERATED
```

---

### 5) ذخیره metadata رندر

در draft ذخیره می‌شود:

```text
lockedHtmlRender.status = locked_html_preview
lockedHtmlRender.renderedAt
lockedHtmlRender.renderedBy
lockedHtmlRender.htmlChecksum
final=false
pdf=false
download=false
```

---

### 6) UI در CRM

در `crm/tool-report-drafts.js` دکمه‌های زیر اضافه شد:

```text
Locked HTML
Locked HTML render
```

در modal، خروجی HTML داخلی در پنجره review نمایش داده می‌شود.

---

## مواردی که همچنان قفل هستند

```text
PDF export
Download report
Final report number
Server-side PDF rendering
Paid report quota consumption
Online payment
Final vendor validation
```

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
_tools/uat/tester243-tools-report-engine-locked.js
RELEASE-NOTES-v31.7.66.md
REGRESSION-REPORT-v31.7.66.md
```

---

## تست اضافه‌شده

```text
_tools/uat/tester243-tools-report-engine-locked.js
```

پوشش:

- وجود `admin_report_render_locked`.
- محافظت endpoint با `tools_admin_require`.
- اجرای gate قبل از render.
- وجود `tools_render_locked_report_html`.
- وجود watermark قفل‌شده.
- ذخیره `lockedHtmlRender` و `htmlChecksum`.
- حفظ final/PDF/download false.
- UI دکمه Locked HTML.
- modal HTML داخلی.
- نبود print/PDF/download/export.

نتیجه مستقیم:

```text
tester243-tools-report-engine-locked: 15 PASS / 0 FAIL
```

---

## Impact Analysis

| بخش | اثر | ریسک |
|---|---|---|
| API tools | render locked HTML اضافه شد | متوسط/کنترل‌شده |
| CRM Draft Inbox | مشاهده HTML داخلی قفل‌شده اضافه شد | کم/متوسط |
| Runtime data | lockedHtmlRender metadata ذخیره می‌شود | کم |
| PDF/final report | همچنان قفل | بدون تغییر |
| Payment/quota | همچنان غیرفعال | بدون تغییر |

---

## محدودیت تست PHP

در sandbox فعلی `php` نصب نیست، بنابراین `php -l api/tools.php` قابل اجرا نبود. پس از deploy روی هاست اجرا شود:

```bash
php -l api/tools.php
```

---

## راستی‌آزمایی کارفرما

1. یک draft گزارش Advanced Control Valve ثبت کنید.
2. در CRM آن draft را به وضعیت زیر ببرید:

```text
Approved for final phase
```

3. Final gate را اجرا کنید تا آماده شود.
4. روی دکمه زیر بزنید:

```text
Locked HTML
```

5. اگر gate آماده باشد، HTML داخلی با watermark نمایش داده می‌شود.
6. اگر gate آماده نباشد، blockers نمایش داده می‌شوند.
7. هیچ PDF یا دانلودی نباید تولید شود.

---

## نتیجه

اکنون مسیر report engine قفل‌شده برای Advanced Control Valve فعال شد: draft پس از gate می‌تواند HTML داخلی review بگیرد، اما همچنان PDF، final report، quota و payment قفل هستند.