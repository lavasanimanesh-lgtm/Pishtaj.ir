# Release Notes — v31.7.57

**تاریخ:** ۱۴۰۵/۰۴/۳۰ (2026-07-21)  
**نسخه:** `v31.7.57`  
**نوع:** ADV-CV-CAVITATION-SEVERITY-001 — سطح‌بندی مقدماتی Cavitation / Flashing برای Advanced Control Valve

---

## هدف ریلیز

ادامه تکمیل اولین ابزار پیشرفته پیش از رفتن سراغ بخش‌های دیگر وبسایت. در این گام، ابزار **Advanced Control Valve** علاوه بر Cv/Kv، Min/Normal/Max، pipe velocity و reducer checks، اکنون سطح‌بندی مقدماتی ریسک **cavitation / flashing** را برای هر case نمایش می‌دهد.

این مرحله همچنان فقط برای کاربر دارای لایسنس/grant فعال است و هیچ PDF/گزارش نهایی تولید نمی‌کند.

---

## RCA / دلیل دقیق

1. در نسخه v31.7.56 ابزار می‌توانست سرعت خط و reducer ratio را نشان دهد، اما cavitation/flashing هنوز فقط به هشدار ساده محدود بود.
2. برای feedback مهندسی واقعی‌تر، کاربر باید بتواند ببیند کدام case از نظر cavitation/flashing پرریسک‌تر است.
3. محاسبه نهایی IEC/ISA برای cavitation/noise به داده vendor و ضرایب تکمیلی نیاز دارد؛ بنابراین در این فاز فقط سطح‌بندی مقدماتی و recommendation نمایش داده شد.
4. اصل قفل تجاری حفظ شد: گزارش نهایی، PDF، noise نهایی و انتخاب برند/مدل هنوز غیرفعال است.

---

## کارهای انجام‌شده

### 1) سطح‌بندی ریسک برای هر case

برای هر case مایع، risk class محاسبه می‌شود:

```text
Low
Watch
Medium risk
High cavitation risk
Choked / severe
Flashing likely
```

---

### 2) ستون جدید در جدول خروجی

به جدول Min/Normal/Max ستون زیر اضافه شد:

```text
Cavitation risk
```

---

### 3) Overall cavitation risk

در خلاصه خروجی، بالاترین سطح ریسک کل caseها نمایش داده می‌شود:

```text
Overall cavitation risk
```

---

### 4) پیشنهادهای مقدماتی

برای caseهای پرریسک، سیستم پیشنهادهای مقدماتی نمایش می‌دهد:

```text
anti-cavitation trim review
staged pressure drop review
flashing service review
downstream pressure / ΔP mitigation
vendor data check for FL / Fp / FLp / noise limits
```

---

## منطق فنی مقدماتی

بر اساس همین داده‌های موجود:

```text
cavitation margin = P2 - Pv
severity = ΔP / ΔP_choked
choked = ΔP >= ΔP_choked
```

قاعده کلی:

```text
P2 <= Pv              → Flashing likely
choked or severity>=1 → Choked / severe
severity>=0.85        → High cavitation risk
severity>=0.70        → Medium risk
severity>=0.55        → Watch
else                  → Low
```

---

## مواردی که هنوز عمداً قفل هستند

```text
محاسبه نهایی IEC/ISA cavitation/noise
محاسبه عددی xFz یا ضرایب vendor-specific
اعمال نهایی Fp/FLp
Actuator sizing
Gas/Steam sizing
Two-phase sizing
Brand/model final selection
Charts نهایی
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
_tools/uat/tester234-advanced-cv-cavitation-severity.js
RELEASE-NOTES-v31.7.57.md
REGRESSION-REPORT-v31.7.57.md
```

---

## تست اضافه‌شده

```text
_tools/uat/tester234-advanced-cv-cavitation-severity.js
```

پوشش:

- وجود `ADV-CV-CAVITATION-SEVERITY-001`.
- وجود `cavitationRisk` و `riskSummary`.
- وجود Risk badge و ستون `Cavitation risk`.
- وجود سطوح flashing/choked/high/medium/watch.
- وجود recommendationهای anti-cavitation / Fp / FLp / vendor data.
- نبود fetch/PDF/print/export.
- runtime برای low risk، choked/severe و flashing likely.

نتیجه مستقیم:

```text
tester234-advanced-cv-cavitation-severity: 11 PASS / 0 FAIL
```

---

## Impact Analysis

| بخش | اثر | ریسک |
|---|---|---|
| Advanced Control Valve | risk classification برای cavitation/flashing اضافه شد | متوسط/کنترل‌شده |
| Licensed users | خروجی مهندسی‌تر و قابل feedback می‌گیرند | مثبت |
| Public users | همچنان locked preview | کم |
| Final report/PDF/payment | همچنان غیرفعال | بدون تغییر |
| محاسبات نهایی vendor | هنوز اعمال نمی‌شود | کنترل‌شده |

---

## راستی‌آزمایی کارفرما

1. وارد `/tools/` شوید.
2. Advanced Control Valve را با لایسنس unlock کنید.
3. داده‌های Liquid و caseهای Min/Normal/Max را وارد کنید.
4. روی محاسبه مقدماتی بزنید.
5. در جدول باید ستون زیر را ببینید:

```text
Cavitation risk
```

6. در خلاصه باید ببینید:

```text
Overall cavitation risk
```

7. اگر `P2 <= Pv` باشد، باید risk به `Flashing likely` برسد.
8. اگر severity نزدیک یا بالاتر از choked باشد، باید `Choked / severe` یا `High cavitation risk` نمایش داده شود.

---

## نتیجه

Advanced Control Valve اکنون یک قدم دیگر به ابزار قابل feedback نزدیک شد: خروجی دیگر فقط Cv نیست، بلکه ریسک cavitation/flashing هر case را نیز سطح‌بندی می‌کند. گام بعدی پیشنهادی برای همین ابزار: `ADV-CV-ACTUATOR-SHELL-001` یا `ADV-CV-NOISE-DETAIL-001`، همچنان بدون PDF نهایی تا تثبیت محاسبات.