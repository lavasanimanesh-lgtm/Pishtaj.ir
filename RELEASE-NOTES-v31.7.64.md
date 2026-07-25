# Release Notes — v31.7.64

**تاریخ:** ۱۴۰۵/۰۴/۳۰ (2026-07-21)  
**نسخه:** `v31.7.64`  
**نوع:** ADV-CV-REPORT-REVIEW-ACTIONS-001 — وضعیت‌های review داخلی برای draft گزارش ابزارهای مهندسی

---

## هدف ریلیز

ادامه تکمیل workflow اولین ابزار پیشرفته، پیش از فعال‌سازی PDF نهایی و پرداخت آنلاین. در نسخه قبل، CRM می‌توانست draftهای گزارش Advanced Control Valve را ببیند. در این نسخه، برای تیم داخلی امکان ثبت وضعیت review روی هر draft اضافه شد.

این مرحله همچنان فقط review داخلی است و هیچ گزارش نهایی تولید نمی‌کند:

```text
No PDF
No download
No final report number
No quota consumption
No online payment
```

---

## RCA / دلیل دقیق

1. در v31.7.63 کارتابل draft گزارش ابزارها اضافه شد.
2. اما draftها فقط قابل مشاهده بودند و تیم داخلی نمی‌توانست وضعیت بررسی را ثبت کند.
3. برای آماده‌سازی مسیر report engine، لازم است draftها وضعیت مشخص داشته باشند:
   - بررسی‌شده
   - نیازمند داده بیشتر
   - آماده برای فاز گزارش نهایی
   - رد شده یا تکراری
4. بنابراین endpoint و UI برای review actions اضافه شد، بدون فعال‌سازی PDF یا report final.

---

## کارهای انجام‌شده

### 1) Endpoint جدید review update

در `api/tools.php` اضافه شد:

```text
admin_report_draft_update
```

این endpoint فقط برای نقش‌های زیر مجاز است:

```text
admin
chairman
```

---

### 2) وضعیت‌های مجاز review

اضافه شد:

```text
draft_locked
reviewed
needs_data
approved_for_final_phase
rejected
duplicate
```

---

### 3) ثبت یادداشت و history

در هر تغییر وضعیت، این موارد ذخیره می‌شود:

```text
reviewNote
reviewedAt
reviewedBy
reviewHistory[]
```

history حداکثر ۳۰ رویداد آخر را نگه می‌دارد.

---

### 4) UI اکشن‌ها در CRM

در `crm/tool-report-drafts.js` به جدول و modal جزئیات دکمه‌های زیر اضافه شد:

```text
Reviewed
Needs data
Approved for final phase
Rejected
Duplicate
```

برای هر تغییر وضعیت، یک note اختیاری با prompt گرفته می‌شود.

---

## قفل‌های حفظ‌شده

حتی اگر draft به وضعیت `approved_for_final_phase` برسد:

```text
PDF تولید نمی‌شود
گزارش نهایی تولید نمی‌شود
quota مصرف نمی‌شود
پرداخت آنلاین فعال نمی‌شود
```

این وضعیت فقط برای آماده‌سازی داخلی فاز بعدی است.

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
RELEASE-NOTES-v31.7.64.md
REGRESSION-REPORT-v31.7.64.md
```

---

## تست اضافه‌شده

```text
_tools/uat/tester241-tools-report-review-actions.js
```

پوشش:

- وجود `admin_report_draft_update`.
- محافظت با `tools_admin_require`.
- وجود statusهای مجاز.
- ذخیره review note/by/at/history.
- عدم تولید PDF/final/download.
- وجود دکمه‌های Review در CRM.
- ارسال `admin_report_draft_update` از UI.
- نمایش review status/note/by/at در modal.
- نبود print/PDF/download/export.

نتیجه مستقیم:

```text
tester241-tools-report-review-actions: 14 PASS / 0 FAIL
```

---

## Impact Analysis

| بخش | اثر | ریسک |
|---|---|---|
| CRM Draft Inbox | اکشن‌های review اضافه شد | کم/متوسط |
| API tools | endpoint update اضافه شد | متوسط/کنترل‌شده |
| Runtime data | status/note/history روی draft ذخیره می‌شود | کم |
| Security | admin/chairman only | مثبت |
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

1. یک draft گزارش از ابزار Advanced Control Valve ثبت کنید.
2. وارد CRM با نقش admin یا chairman شوید.
3. به Settings بروید.
4. بخش «کارتابل draft گزارش ابزارهای مهندسی» را بازخوانی کنید.
5. برای یک draft، یکی از وضعیت‌ها را بزنید:

```text
Reviewed
Needs data
Approved for final phase
Rejected
Duplicate
```

6. یک note اختیاری وارد کنید.
7. draft باید با وضعیت جدید در لیست نمایش داده شود.
8. در modal مشاهده، reviewStatus / reviewNote / reviewedBy / reviewedAt باید دیده شود.
9. هیچ PDF یا دانلودی نباید تولید شود.

---

## نتیجه

اکنون draftهای گزارش ابزارها در CRM فقط قابل مشاهده نیستند؛ بلکه می‌توانند فرآیند review داخلی داشته باشند. این مرحله پایه لازم برای فاز بعدی report engine و final approval flow است، بدون باز کردن PDF یا پرداخت آنلاین.