# Release Notes — v31.7.62

**تاریخ:** ۱۴۰۵/۰۴/۳۰ (2026-07-21)  
**نسخه:** `v31.7.62`  
**نوع:** ADV-CV-SERVER-REPORT-SCAFFOLD-001 — Scaffold سروری draft گزارش Advanced Control Valve

---

## هدف ریلیز

ادامه تکمیل اولین ابزار پیشرفته پیش از فعال‌سازی پرداخت آنلاین. پس از ساخت payload قفل‌شده گزارش در v31.7.61، در این نسخه scaffold سروری اضافه شد تا payload پس از اعتبارسنجی grant و checksum به‌صورت draft قفل‌شده روی سرور ذخیره شود.

این مرحله هنوز گزارش نهایی تولید نمی‌کند:

```text
No PDF
No download
No final report number
No paid report quota consumption
No online payment
```

---

## RCA / دلیل دقیق

1. ابزار اکنون payload ساختاریافته `ADV-CV-REPORT-PAYLOAD-v1` تولید می‌کند.
2. برای report engine آینده، payload باید بتواند به سرور ارسال و به‌صورت draft ذخیره شود.
3. اما report engine، PDF، quota مصرف گزارش و پرداخت آنلاین هنوز فعال نیستند.
4. بنابراین در این گام، فقط scaffold سروری ذخیره draft قفل‌شده اضافه شد؛ نه PDF و نه گزارش نهایی.
5. سرور payload را با grant ابزار و checksum validate می‌کند تا draft قابل ردیابی و آماده فازهای بعد باشد.

---

## کارهای انجام‌شده

### 1) Endpoint جدید در `api/tools.php`

اضافه شد:

```text
report_draft_create
```

این endpoint:

```text
grant را verify می‌کند
payload schema را بررسی می‌کند
locked status را بررسی می‌کند
checksum را server-side دوباره محاسبه می‌کند
draft را در runtime data ذخیره می‌کند
safe metadata برمی‌گرداند
```

---

### 2) فایل runtime جدید

Draftهای گزارش در فایل runtime زیر ذخیره می‌شوند:

```text
crm/data/tool_report_drafts.json
```

این فایل داخل ZIP قرار نمی‌گیرد، چون runtime data است.

---

### 3) اعتبارسنجی checksum در سرور

در `api/tools.php` اضافه شد:

```php
tools_stable_json()
tools_checksum32()
tools_validate_report_payload()
```

سرور مقدار checksum را از payload حذف می‌کند، stable JSON می‌سازد و checksum را دوباره محاسبه می‌کند.

---

### 4) فایل frontend جدید

اضافه شد:

```text
tools/advanced-report-ui.js
```

این فایل تابع زیر را فراهم می‌کند:

```js
ptfAdvCvSubmitReportDraft()
```

---

### 5) دکمه جدید در ابزار

برای کاربر دارای grant معتبر، دکمه زیر اضافه شد:

```text
ثبت draft گزارش در سرور
```

این دکمه payload قفل‌شده را می‌سازد و به سرور می‌فرستد.

---

## قفل‌های حفظ‌شده

حتی پس از ثبت draft سروری:

```js
final = false
pdf = false
download = false
serverSideReport = false
```

و پاسخ سرور نیز فقط draft metadata برمی‌گرداند:

```text
draftId
checksum
status
createdAt
```

---

## مواردی که هنوز عمداً قفل هستند

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
tools/advanced-report-ui.js
tools/advanced-tools-ui.js
tools/index.html
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
_tools/uat/tester239-advanced-cv-server-report-scaffold.js
RELEASE-NOTES-v31.7.62.md
REGRESSION-REPORT-v31.7.62.md
```

---

## تست اضافه‌شده

```text
_tools/uat/tester239-advanced-cv-server-report-scaffold.js
```

پوشش:

- وجود `report_draft_create`.
- verify شدن grant.
- validate شدن schema/checksum.
- وجود stable JSON و checksum32 سمت سرور.
- ذخیره runtime در `tool_report_drafts.json`.
- safe output بدون PDF/final/download.
- لود شدن `advanced-report-ui.js` بعد از `advanced-tools-ui.js`.
- ارسال payload و grant به API.
- نبود PDF/print/download/export.

نتیجه مستقیم:

```text
tester239-advanced-cv-server-report-scaffold: 15 PASS / 0 FAIL
```

---

## Impact Analysis

| بخش | اثر | ریسک |
|---|---|---|
| Advanced CV report path | server draft scaffold اضافه شد | متوسط/کنترل‌شده |
| API tools | endpoint جدید runtime اضافه شد | متوسط |
| License security | grant verify لازم است | مثبت |
| PDF/final report | همچنان قفل | بدون تغییر |
| Payment | همچنان غیرفعال | بدون تغییر |
| Runtime data | `crm/data/tool_report_drafts.json` ساخته می‌شود | متوسط |

---

## محدودیت تست PHP

در sandbox فعلی `php` نصب نیست، بنابراین `php -l api/tools.php` قابل اجرا نبود. کنترل‌های static و full regression انجام شد. بعد از deploy، روی هاست بهتر است اجرا شود:

```bash
php -l api/tools.php
```

---

## راستی‌آزمایی کارفرما

1. ابزار Advanced Control Valve را با لایسنس unlock کنید.
2. داده‌ها را وارد و محاسبه را اجرا کنید.
3. ابتدا «آماده‌سازی داده گزارش قفل‌شده» را بزنید.
4. سپس «ثبت draft گزارش در سرور» را بزنید.
5. باید پیام ثبت draft ببینید:

```text
draftId
checksum
status: draft_locked
final=false | pdf=false | download=false
```

6. هیچ PDF یا دانلودی نباید تولید شود.

---

## نتیجه

اکنون ابزار Advanced Control Valve نه‌تنها payload قفل‌شده می‌سازد، بلکه می‌تواند آن را پس از validation در سرور به‌عنوان draft ذخیره کند. این پایه فاز آینده report engine است، اما همچنان نهایی‌سازی، PDF و پرداخت آنلاین قفل هستند.
