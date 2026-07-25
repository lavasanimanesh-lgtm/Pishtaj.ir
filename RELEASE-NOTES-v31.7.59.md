# Release Notes — v31.7.59

**تاریخ:** ۱۴۰۵/۰۴/۳۰ (2026-07-21)  
**نسخه:** `v31.7.59`  
**نوع:** ADV-CV-NOISE-DETAIL-001 — Preliminary noise risk detail برای Advanced Control Valve

---

## هدف ریلیز

ادامه تکمیل اولین ابزار پیشرفته پیش از فعال‌سازی پرداخت آنلاین و پیش از رفتن سراغ بخش‌های دیگر وبسایت. در این نسخه، ابزار **Advanced Control Valve** یک لایه مقدماتی برای screening ریسک noise دریافت کرد.

این مرحله همچنان فقط برای کاربر دارای لایسنس/grant فعال است و هیچ PDF/گزارش نهایی تولید نمی‌کند.

---

## RCA / دلیل دقیق

1. ابزار تا نسخه قبل می‌توانست Cv/Kv، Min/Normal/Max، pipe velocity، reducer warning، cavitation/flashing severity و actuator shell را نمایش دهد.
2. در کنترل ولو، noise یکی از معیارهای مهم engineering review است و به‌خصوص با ΔP بالا، choked/cavitation و velocity زیاد مهم می‌شود.
3. محاسبه نهایی dBA طبق IEC 60534-8 نیازمند داده‌های دقیق vendor، acoustic efficiency، pipe schedule، insulation، فاصله observer و شرایط نصب است.
4. بنابراین در این گام، فقط **preliminary noise risk index** و risk class اضافه شد، نه dBA نهایی.

---

## کارهای انجام‌شده

### 1) Noise risk index مقدماتی

برای هر case مایع، یک شاخص مقدماتی noise محاسبه می‌شود. این شاخص dBA نهایی نیست و فقط برای screening و feedback است.

عوامل در نظر گرفته‌شده:

```text
Q
ΔP
severity = ΔP / ΔP_choked
choked flag
max(Vin, Vout)
cavitation/flashing risk
```

---

### 2) سطح‌بندی noise risk

سطوح جدید:

```text
Low noise risk
Watch noise
Medium noise risk
High noise risk
Severe noise risk
```

---

### 3) ستون جدید در جدول خروجی

به جدول caseها اضافه شد:

```text
Noise risk
```

---

### 4) Overall noise risk

در کارت summary اضافه شد:

```text
Overall noise risk
```

---

### 5) پیشنهادهای مقدماتی noise

برای ریسک‌های بالاتر، پیشنهادهای زیر نمایش داده می‌شود:

```text
low-noise trim review
multi-stage trim / staged pressure drop review
outlet velocity and pipe size review
IEC 60534-8 detailed noise calculation
vendor acoustic data check
```

---

## مواردی که هنوز عمداً قفل هستند

```text
dBA نهایی
IEC 60534-8 final acoustic calculation
acoustic efficiency vendor data
pipe wall / insulation / observer distance calculation
silencer / diffuser final selection
English PDF report
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
_tools/uat/tester236-advanced-cv-noise-detail.js
RELEASE-NOTES-v31.7.59.md
REGRESSION-REPORT-v31.7.59.md
```

---

## تست اضافه‌شده

```text
_tools/uat/tester236-advanced-cv-noise-detail.js
```

پوشش:

- وجود `ADV-CV-NOISE-DETAIL-001`.
- وجود `noiseRisk` و `noiseSummary`.
- وجود ستون `Noise risk` و کارت `Overall noise risk`.
- وجود سطوح low/watch/medium/high/severe.
- وجود recommendationهای low-noise trim، IEC 60534-8 و vendor data.
- نبود fetch/PDF/print/export.
- runtime برای نمونه low/watch.
- runtime برای نمونه high/severe.
- وجود formula trace برای noise index.

نتیجه مستقیم:

```text
tester236-advanced-cv-noise-detail: 11 PASS / 0 FAIL
```

---

## Impact Analysis

| بخش | اثر | ریسک |
|---|---|---|
| Advanced Control Valve | preliminary noise screening اضافه شد | متوسط/کنترل‌شده |
| Licensed users | خروجی مهندسی‌تر برای feedback می‌گیرند | مثبت |
| Public users | همچنان locked preview | کم |
| Final dBA/noise report | همچنان انجام نمی‌شود | کنترل‌شده |
| PDF/payment | همچنان غیرفعال | بدون تغییر |

---

## راستی‌آزمایی کارفرما

1. وارد `/tools/` شوید.
2. Advanced Control Valve را با لایسنس unlock کنید.
3. داده‌های Liquid و caseهای Min/Normal/Max را وارد کنید.
4. pipe sizes و داده‌های fluid را وارد کنید.
5. روی محاسبه مقدماتی بزنید.
6. در جدول باید ستون زیر را ببینید:

```text
Noise risk
```

7. در summary باید ببینید:

```text
Overall noise risk
```

8. برای caseهای Q/ΔP/velocity بالا، باید High یا Severe noise risk و پیشنهاد low-noise/detail دیده شود.

---

## نتیجه

Advanced Control Valve اکنون علاوه بر محاسبات Cv/Kv و ریسک cavitation/flashing، یک screening مقدماتی noise هم دارد. گام بعدی پیشنهادی: `ADV-CV-REPORT-PREVIEW-001`، یعنی ساخت report preview انگلیسی روی صفحه، بدون PDF و بدون دانلود، تا ابزار برای feedback مهندسان قابل ارائه‌تر شود.
