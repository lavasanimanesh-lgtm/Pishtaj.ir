# Release Notes — v31.7.67

**تاریخ:** ۱۴۰۵/۰۴/۳۰ (2026-07-21)  
**نسخه:** `v31.7.67`  
**نوع:** ADV-CV-REPORT-QUOTA-DRY-RUN-001 — Dry-run مصرف quota گزارش برای Advanced Control Valve

---

## هدف ریلیز

ادامه تکمیل workflow اولین ابزار پیشرفته، بدون فعال‌سازی PDF یا پرداخت آنلاین. در این نسخه، برای draftهای گزارش Advanced Control Valve یک **dry-run مصرف quota** اضافه شد تا قبل از فعال‌سازی گزارش نهایی، رفتار مصرف سهمیه لایسنس را بدون کم کردن واقعی quota تست کنیم.

این مرحله همچنان قفل است:

```text
No actual quota decrement
No PDF
No download
No final report number
No online payment
```

---

## RCA / دلیل دقیق

1. تا v31.7.66 مسیر draft گزارش، review، final gate و locked HTML داخلی آماده شده بود.
2. اما قبل از فعال کردن گزارش نهایی، باید مطمئن شویم منطق quota لایسنس درست کار می‌کند.
3. کم کردن واقعی quota در این مرحله زود است، چون هنوز PDF/report final فعال نشده است.
4. بنابراین dry-run اضافه شد: سیستم بررسی می‌کند اگر قرار بود گزارش نهایی تولید شود آیا quota کافی وجود دارد یا نه، اما مقدار `usedReports` را تغییر نمی‌دهد.

---

## کارهای انجام‌شده

### 1) Endpoint جدید در `api/tools.php`

اضافه شد:

```text
admin_report_quota_dry_run
```

این endpoint فقط برای نقش‌های زیر مجاز است:

```text
admin
chairman
```

---

### 2) تابع dry-run سروری

اضافه شد:

```php
tools_build_quota_dry_run()
```

این تابع بررسی می‌کند:

```text
Final readiness gate pass شده باشد
license record وجود داشته باشد
license فعال باشد
license منقضی نشده باشد
remainingReports > 0 باشد
```

---

### 3) بدون کم کردن quota

خروجی dry-run صریحاً این را دارد:

```php
'quotaConsumed' => false
```

و مقدارهای قبل و بعد برابرند:

```text
quotaBefore.usedReports = quotaAfter.usedReports
quotaBefore.remainingReports = quotaAfter.remainingReports
```

---

### 4) ذخیره نتیجه dry-run روی draft

در draft ذخیره می‌شود:

```text
quotaDryRun
quotaDryRunHistory[]
```

---

### 5) UI در CRM

در `crm/tool-report-drafts.js` اضافه شد:

```text
Quota dry-run
```

در جدول هم ستون جدید اضافه شد:

```text
Quota Dry-run
```

در modal نتیجه dry-run، این موارد دیده می‌شود:

```text
wouldConsume
quotaConsumed=false
usedBefore
remainingBefore
usedAfter
remainingAfter
reportCost
blockers
warnings
```

---

## مواردی که همچنان قفل هستند

```text
کم کردن واقعی usedReports
PDF export
Download report
Final report number
Server-side final report rendering
Online payment
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
_tools/uat/tester244-tools-report-quota-dry-run.js
RELEASE-NOTES-v31.7.67.md
REGRESSION-REPORT-v31.7.67.md
```

---

## تست اضافه‌شده

```text
_tools/uat/tester244-tools-report-quota-dry-run.js
```

پوشش:

- وجود `admin_report_quota_dry_run`.
- محافظت endpoint با `tools_admin_require`.
- وجود `tools_build_quota_dry_run`.
- وابستگی dry-run به final gate.
- بررسی license و remaining quota.
- عدم کم کردن quota.
- ذخیره `quotaDryRun` و history.
- وجود UI و ستون Quota Dry-run.
- modal quota before/after.
- نبود print/PDF/download/export.

نتیجه مستقیم:

```text
tester244-tools-report-quota-dry-run: 14 PASS / 0 FAIL
```

---

## Impact Analysis

| بخش | اثر | ریسک |
|---|---|---|
| API tools | quota dry-run اضافه شد | متوسط/کنترل‌شده |
| CRM Draft Inbox | ستون و دکمه Quota dry-run اضافه شد | کم/متوسط |
| Runtime data | quotaDryRun/history روی draft ذخیره می‌شود | کم |
| License quota | فقط شبیه‌سازی؛ usedReports تغییر نمی‌کند | کم |
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

1. یک draft گزارش Advanced Control Valve ثبت کنید.
2. در CRM آن را به وضعیت زیر ببرید:

```text
Approved for final phase
```

3. Final gate را اجرا کنید.
4. روی دکمه زیر بزنید:

```text
Quota dry-run
```

5. باید ببینید:

```text
wouldConsume = true/false
quotaConsumed = false
usedBefore = usedAfter
remainingBefore = remainingAfter
```

6. اگر لایسنس quota نداشته باشد یا gate آماده نباشد، blockers نمایش داده می‌شود.
7. هیچ PDF یا دانلودی نباید تولید شود.

---

## نتیجه

اکنون قبل از فعال‌سازی واقعی PDF/report، سیستم می‌تواند مصرف quota را شبیه‌سازی و اعتبارسنجی کند، بدون اینکه سهمیه واقعی کم شود. این گام مسیر را برای مصرف واقعی quota در آینده آماده می‌کند، اما همچنان خروجی نهایی قفل است.