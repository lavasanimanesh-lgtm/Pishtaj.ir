# Release Notes — v31.7.61

**تاریخ:** ۱۴۰۵/۰۴/۳۰ (2026-07-21)  
**نسخه:** `v31.7.61`  
**نوع:** ADV-CV-REPORT-DATA-LOCK-001 — داده ساختاریافته و قفل‌شده گزارش برای Advanced Control Valve

---

## هدف ریلیز

ادامه تکمیل اولین ابزار پیشرفته پیش از فعال‌سازی پرداخت آنلاین. پس از ساخت report preview انگلیسی در v31.7.60، در این نسخه یک **structured locked report payload** اضافه شد تا ابزار برای فاز آینده server-side report generation آماده شود؛ بدون اینکه هنوز PDF، دانلود یا گزارش نهایی فعال شود.

---

## RCA / دلیل دقیق

1. Advanced Control Valve اکنون محاسبات مقدماتی زیادی دارد: Cv/Kv، Min/Normal/Max، velocity/reducer، cavitation/flashing severity، noise risk، actuator shell و report preview.
2. برای تولید گزارش نهایی در آینده، خروجی‌ها باید فقط HTML پراکنده نباشند؛ باید به یک payload ساختاریافته، قابل checksum و قابل ارسال به report engine تبدیل شوند.
3. اما چون report engine، quota مصرف گزارش و PDF server-side هنوز آماده نیستند، نباید هیچ گزارش نهایی یا فایل قابل دانلود تولید شود.
4. بنابراین در این فاز فقط داده گزارش قفل‌شده در memory نشست ساخته می‌شود و با readiness سخت‌گیرانه بررسی می‌شود.

---

## کارهای انجام‌شده

### 1) Schema جدید payload

در `tools/advanced-tools-ui.js` اضافه شد:

```text
ADV-CV-REPORT-PAYLOAD-v1
```

---

### 2) توابع جدید payload

```js
ptfAdvCvStableJson()
ptfAdvCvChecksum32()
ptfAdvCvStrictReportReadiness()
ptfAdvCvBuildLockedReportPayload()
ptfAdvCvShowLockedReportData()
```

---

### 3) محتوای payload

Payload شامل این بخش‌هاست:

```text
reportMeta
entitlement
project
inputs
calculations
readiness
limitations
checksum
```

زیرمجموعه calculations شامل:

```text
cases
governing
recommendedCv
riskSummary
noiseSummary
actuator
formulaTrace
warnings
riskRecommendations
noiseRecommendations
```

---

### 4) Checksum پایدار

برای payload یک checksum سبک و deterministic تولید می‌شود:

```text
checksum32(stableJson(payloadWithoutChecksum))
```

این برای تشخیص تغییر payload و آماده‌سازی فاز report engine است، نه امضای امنیتی نهایی.

---

### 5) Readiness سخت‌گیرانه‌تر

`ptfAdvCvStrictReportReadiness()` نسبت به محاسبه مقدماتی سخت‌گیرانه‌تر است و این موارد را بررسی می‌کند:

```text
Project / Tag / Service
Min / Normal / Max flow/P1/P2/temp
Fluid data
Valve data
Piping data and parseable pipe IDs
Actuator data
Rated / candidate Cv
```

حتی اگر محاسبه مقدماتی با داده کمتر اجرا شود، readiness گزارش آینده ممکن است incomplete باشد.

---

### 6) قفل‌های صریح نهایی

Payload صریحاً این وضعیت را دارد:

```js
final: false
pdf: false
download: false
serverSideReport: false
```

و blocked reasons شامل:

```text
Server-side final report engine is not enabled
PDF/download generation is locked
Paid report quota consumption is not implemented yet
Final vendor validation is required
```

---

## مواردی که هنوز عمداً قفل هستند

```text
ارسال payload به سرور
report number رسمی
PDF export
Download report
Paid report consume/quota
Server-side report generation
Final vendor validation
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
_tools/uat/tester238-advanced-cv-locked-report-data.js
RELEASE-NOTES-v31.7.61.md
REGRESSION-REPORT-v31.7.61.md
```

---

## تست اضافه‌شده

```text
_tools/uat/tester238-advanced-cv-locked-report-data.js
```

پوشش:

- وجود `ADV-CV-REPORT-DATA-LOCK-001`.
- وجود توابع stableJson/checksum/readiness/payload.
- وجود schema و status قفل‌شده.
- وجود قفل‌های final/pdf/server/quota.
- وجود UI برای آماده‌سازی داده گزارش قفل‌شده.
- نبود fetch/PDF/print/export/download link.
- runtime payload generation.
- checksum قابل بازتولید با stableJson.
- readiness کامل و ناقص.
- نگهداری payload در memory نشست.
- fail-closed بدون grant.

نتیجه مستقیم:

```text
tester238-advanced-cv-locked-report-data: 13 PASS / 0 FAIL
```

---

## Impact Analysis

| بخش | اثر | ریسک |
|---|---|---|
| Advanced Control Valve | payload ساختاریافته گزارش اضافه شد | متوسط/کنترل‌شده |
| Licensed users | می‌توانند readiness/checksum payload را ببینند | مثبت |
| Public users | همچنان locked preview | کم |
| PDF/final report | همچنان قفل | بدون تغییر |
| Server/API | هیچ fetch/API جدیدی اضافه نشده | کم |
| Payment | همچنان غیرفعال | بدون تغییر |

---

## راستی‌آزمایی کارفرما

1. وارد `/tools/` شوید.
2. Advanced Control Valve را با لایسنس unlock کنید.
3. داده‌های پروژه، caseها، pipe، valve، actuator را وارد کنید.
4. محاسبه مقدماتی را اجرا کنید.
5. روی دکمه زیر بزنید:

```text
آماده‌سازی داده گزارش قفل‌شده
```

6. باید ببینید:

```text
schema: ADV-CV-REPORT-PAYLOAD-v1
checksum: XXXXXXXX
status: LOCKED_PREVIEW_PAYLOAD
final: false | pdf: false | download: false
```

7. اگر داده‌ها برای گزارش آینده ناقص باشند، لیست missing/pipe issues باید نمایش داده شود.
8. مطمئن شوید هیچ PDF، دانلود یا ارسال سروری انجام نمی‌شود.

---

## نتیجه

Advanced Control Valve اکنون علاوه بر preview انگلیسی، داده ساختاریافته و checksumدار برای فاز آینده report engine دارد، اما همچنان گزارش نهایی و PDF قفل هستند. این گام پایه لازم برای server-side report generation و quota consume آینده را آماده کرد.