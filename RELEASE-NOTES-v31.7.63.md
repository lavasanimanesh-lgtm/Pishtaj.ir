# Release Notes — v31.7.63

**تاریخ:** ۱۴۰۵/۰۴/۳۰ (2026-07-21)  
**نسخه:** `v31.7.63`  
**نوع:** ADV-CV-REPORT-DRAFT-CRM-INBOX-001 — کارتابل CRM برای draft گزارش ابزارهای مهندسی

---

## هدف ریلیز

ادامه تکمیل اولین ابزار پیشرفته پیش از فعال‌سازی پرداخت آنلاین. در نسخه v31.7.62، ابزار Advanced Control Valve می‌توانست payload قفل‌شده گزارش را در سرور به‌عنوان draft ذخیره کند. در این نسخه، برای اینکه تیم داخلی بتواند این draftها را ببیند و بررسی کند، کارتابل/لیست review داخل CRM اضافه شد.

این مرحله هنوز گزارش نهایی تولید نمی‌کند:

```text
No PDF
No download
No final report number
No quota consumption
No online payment
```

---

## RCA / دلیل دقیق

1. `report_draft_create` در نسخه قبلی draft قفل‌شده گزارش را در runtime ذخیره می‌کرد.
2. اما CRM هنوز راهی برای دیدن draftهای ثبت‌شده نداشت.
3. برای feedback داخلی و کنترل کیفیت قبل از report engine، ادمین/رییس باید بتواند draftهای ثبت‌شده را ببیند.
4. بنابراین endpointهای review و UI کارتابل داخل تنظیمات CRM اضافه شد.
5. اصل قفل گزارش حفظ شد: مشاهده فقط برای review است و هیچ PDF/گزارش نهایی تولید نمی‌شود.

---

## کارهای انجام‌شده

### 1) Endpointهای جدید review در `api/tools.php`

اضافه شد:

```text
admin_report_drafts
admin_report_draft_get
```

این endpointها فقط برای نقش‌های زیر مجاز هستند:

```text
admin
chairman
```

---

### 2) Summary امن draft گزارش

تابع جدید:

```php
tools_report_draft_summary()
```

خروجی summary شامل:

```text
draftId
tool
licenseId
checksum
status
createdAt
project/tag/rfq/service
casesCount
governingCv
recommendedCv
cavitationRisk
noiseRisk
actuatorOk
readiness
missingCount
pipeIssuesCount
final=false
pdf=false
download=false
```

---

### 3) Detail review برای payload قفل‌شده

Endpoint زیر برای دیدن جزئیات draft اضافه شد:

```text
admin_report_draft_get
```

این فقط برای review داخلی است و همچنان خروجی نهایی نیست.

---

### 4) فایل جدید CRM UI

اضافه شد:

```text
crm/tool-report-drafts.js
```

این فایل در Settings یک بخش جدید اضافه می‌کند:

```text
کارتابل draft گزارش ابزارهای مهندسی
```

امکانات:

```text
لیست draftها
نمایش Project/Tag
نمایش License/Checksum
نمایش Governing Cv
نمایش Cavitation/Noise Risk
نمایش Readiness
مشاهده جزئیات payload قفل‌شده
```

---

## مواردی که هنوز قفل هستند

```text
PDF export
Download report
Final report number
Server-side report rendering
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
RELEASE-NOTES-v31.7.63.md
REGRESSION-REPORT-v31.7.63.md
```

---

## تست اضافه‌شده

```text
_tools/uat/tester240-tools-report-draft-crm-inbox.js
```

پوشش:

- وجود `admin_report_drafts` و `admin_report_draft_get`.
- محافظت endpointها با `tools_admin_require`.
- summary بدون PDF/final/download.
- وجود project/readiness/risk/gov در summary.
- لود شدن `crm/tool-report-drafts.js`.
- نمایش فقط برای admin/chairman.
- تزریق به Settings.
- ارسال JWT با `X-CRM-Token`.
- جدول draftها و modal جزئیات.
- نبود print/PDF/download/export.

نتیجه مستقیم:

```text
tester240-tools-report-draft-crm-inbox: 14 PASS / 0 FAIL
```

---

## Impact Analysis

| بخش | اثر | ریسک |
|---|---|---|
| CRM Settings | کارتابل review draft گزارش اضافه شد | کم/متوسط |
| API tools | endpointهای admin review اضافه شد | متوسط/کنترل‌شده |
| Runtime data | خواندن `tool_report_drafts.json` | کم |
| Security | فقط admin/chairman با JWT | مثبت |
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

1. با لایسنس معتبر در `/tools/` یک draft گزارش سروری ثبت کنید.
2. وارد CRM با نقش admin یا chairman شوید.
3. به تنظیمات بروید.
4. بخش زیر را پیدا کنید:

```text
کارتابل draft گزارش ابزارهای مهندسی
```

5. روی «بازخوانی draftها» بزنید.
6. باید draft ثبت‌شده را با `draftId`, `checksum`, `tag`, `risk`, `readiness` ببینید.
7. روی «مشاهده» بزنید.
8. جزئیات payload قفل‌شده باید باز شود.
9. هیچ PDF یا دانلودی نباید تولید شود.

---

## نتیجه

اکنون مسیر draft گزارش Advanced Control Valve کامل‌تر شد: ابزار payload را می‌سازد، سرور آن را به‌عنوان draft قفل‌شده ذخیره می‌کند و CRM امکان مشاهده/review آن را دارد. هنوز final report engine و PDF عمداً فعال نشده‌اند.