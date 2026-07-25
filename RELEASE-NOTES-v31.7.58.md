# Release Notes — v31.7.58

**تاریخ:** ۱۴۰۵/۰۴/۳۰ (2026-07-21)  
**نسخه:** `v31.7.58`  
**نوع:** ADV-CV-ACTUATOR-SHELL-001 — Actuator sizing shell مقدماتی برای Advanced Control Valve

---

## هدف ریلیز

ادامه تکمیل اولین ابزار پیشرفته پیش از فعال‌سازی پرداخت آنلاین و پیش از رفتن سراغ بخش‌های دیگر وبسایت. در این نسخه، ابزار **Advanced Control Valve** یک shell مقدماتی برای برآورد نیروی اکچویتور دریافت کرد.

این مرحله همچنان فقط برای کاربر دارای لایسنس/grant فعال است و هیچ PDF/گزارش نهایی تولید نمی‌کند.

---

## RCA / دلیل دقیق

1. ابزار تا نسخه قبلی می‌توانست Cv/Kv، operating envelope، velocity/reducer و cavitation/flashing severity را نشان دهد.
2. برای feedback مهندسی کنترل ولو، بخش اکچویتور هم بسیار مهم است؛ مخصوصاً fail action، shutoff ΔP و seat diameter.
3. انتخاب نهایی actuator نیازمند دیتای سازنده، spring range، bench set، torque/thrust curve و friction واقعی است؛ بنابراین نباید در این مرحله انتخاب قطعی انجام شود.
4. راه کم‌ریسک، اضافه کردن **actuator sizing shell** است: برآورد preliminary thrust و نمایش اینکه چه داده‌هایی برای انتخاب نهایی کم است.

---

## کارهای انجام‌شده

### 1) فیلدهای جدید actuator

به فرم Advanced Control Valve اضافه شد:

```text
نوع اکچویتور مقدماتی
فشار هوای ابزار دقیق
ضریب اطمینان اکچویتور
اختلاف فشار Shutoff
قطر seat / plug
نیروی packing / friction
Fail action
```

---

### 2) محاسبه مقدماتی thrust

فرمول‌های shell:

```text
seat area = π × d² / 4
fluid force = ΔP_shutoff × 0.1 × seat area
required thrust = (fluid force + packing/friction) × safety factor
equivalent pneumatic area = required thrust / (supply barg × 0.1)
equivalent diaphragm diameter = sqrt(4 × area / π)
```

واحدها:

```text
ΔP_shutoff: bar
seat diameter: mm
force: N
required thrust: N / kgf
supply: bar(g)
```

---

### 3) fallback کنترل‌شده

اگر `shutoff ΔP` وارد نشده باشد، سیستم از بیشترین ΔP عملیاتی به‌عنوان fallback استفاده می‌کند و هشدار می‌دهد:

```text
fallback: max operating ΔP
```

اگر `seat / plug diameter` وارد نشده باشد، محاسبه اصلی valve fail نمی‌شود، اما actuator shell به‌صورت incomplete نمایش داده می‌شود.

---

### 4) هشدارهای actuator

اضافه شد:

```text
supply pressure پایین
safety factor کم
rotary valve → این shell thrust-equivalent است، torque sizing نهایی نیست
Fail Close / Fail Open → جهت spring/air action و shutoff direction باید با سازنده کنترل شود
```

---

## مواردی که هنوز عمداً قفل هستند

```text
انتخاب قطعی actuator model
spring sizing / bench set
torque sizing برای rotary valves
friction model نهایی
seat load / leakage class force نهایی
vendor actuator curve
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
_tools/uat/tester235-advanced-cv-actuator-shell.js
RELEASE-NOTES-v31.7.58.md
REGRESSION-REPORT-v31.7.58.md
```

---

## تست اضافه‌شده

```text
_tools/uat/tester235-advanced-cv-actuator-shell.js
```

پوشش:

- وجود `ADV-CV-ACTUATOR-SHELL-001`.
- وجود فیلدهای actuator.
- وجود تابع `actuatorShell`.
- وجود فرمول‌های seat area / fluid force / required thrust / diaphragm diameter.
- محاسبه عددی نمونه:
  - seat = 50 mm
  - shutoff = 10 bar
  - packing = 200 N
  - safety = 1.5
  - supply = 4.5 barg
- رفتار incomplete در نبود seat.
- fallback در نبود shutoff.
- هشدار rotary torque.
- نبود fetch/PDF/print/export.

نتیجه مستقیم:

```text
tester235-advanced-cv-actuator-shell: 15 PASS / 0 FAIL
```

---

## Impact Analysis

| بخش | اثر | ریسک |
|---|---|---|
| Advanced Control Valve | actuator shell اضافه شد | متوسط/کنترل‌شده |
| Licensed users | داده مهم دیگری برای feedback می‌گیرند | مثبت |
| Public users | همچنان locked preview | کم |
| Final actuator selection | همچنان انجام نمی‌شود | کنترل‌شده |
| PDF/payment | همچنان غیرفعال | بدون تغییر |

---

## راستی‌آزمایی کارفرما

1. وارد `/tools/` شوید.
2. Advanced Control Valve را با لایسنس unlock کنید.
3. داده‌های Liquid و Normal/Min/Max را وارد کنید.
4. فیلدهای actuator را وارد کنید:

```text
Fail action
Shutoff ΔP
Seat / plug diameter
Supply pressure
Safety factor
Packing / friction force
```

5. روی محاسبه مقدماتی بزنید.
6. باید بخش زیر را ببینید:

```text
Actuator sizing shell — preliminary only
```

7. خروجی باید شامل موارد زیر باشد:

```text
Fluid force
Required thrust N
Required thrust kgf
Equivalent diaphragm diameter
```

---

## نتیجه

Advanced Control Valve اکنون علاوه بر محاسبات فرآیندی، یک shell مقدماتی actuator هم دارد. گام بعدی پیشنهادی برای همین ابزار: `ADV-CV-NOISE-DETAIL-001` یا شروع آماده‌سازی ساختار English report preview، همچنان بدون PDF نهایی تا وقتی محاسبات کامل‌تر شوند.
