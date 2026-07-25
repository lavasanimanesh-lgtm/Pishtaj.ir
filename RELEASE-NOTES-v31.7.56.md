# Release Notes — v31.7.56

**تاریخ:** ۱۴۰۵/۰۴/۳۰ (2026-07-21)  
**نسخه:** `v31.7.56`  
**نوع:** ADV-CV-VELOCITY-REDUCER-001 — Pipe velocity و reducer preliminary checks برای Advanced Control Valve

---

## هدف ریلیز

ادامه تکمیل اولین ابزار پیشرفته پیش از فعال‌سازی پرداخت آنلاین. در این گام، ابزار **Advanced Control Valve** علاوه بر محاسبه Min/Normal/Max برای Liquid، بررسی مقدماتی سرعت خط و اثر reducer/expander را نیز نمایش می‌دهد.

این مرحله همچنان فقط برای کاربر دارای لایسنس/grant فعال است و هیچ PDF/گزارش نهایی تولید نمی‌کند.

---

## RCA / دلیل دقیق

1. برای feedback مهندسی واقعی‌تر، فقط Cv/Kv کافی نیست؛ سرعت خطوط ورودی/خروجی و وجود reducer/expander روی sizing و noise/cavitation اثر دارد.
2. در نسخه v31.7.55، فیلدهای pipe size/ID وجود داشتند اما هنوز در محاسبه استفاده نمی‌شدند.
3. اعمال کامل correctionهای IEC/ISA مثل Fp/FLp به داده دقیق valve/pipe/reducer و vendor نیاز دارد و نباید فعلاً به‌صورت قطعی اعمال شود.
4. بنابراین در این گام، یک check مقدماتی کم‌ریسک اضافه شد: parse کردن سایز/ID لوله، محاسبه Vin/Vout و هشدار برای سرعت‌های غیرعادی و reducer ratio.

---

## کارهای انجام‌شده

### 1) Parse مقدماتی سایز/ID لوله

تابع جدید:

```js
ptfAdvCvParsePipeIdMm(text)
```

فرمت‌های قابل تشخیص:

```text
NPS 4
4 in
DN100
ID 102 mm
102
```

برای NPS از mapping تقریبی Sch.40 استفاده می‌شود؛ برای طراحی نهایی، ID واقعی pipe class باید وارد شود.

---

### 2) محاسبه سرعت خط

فرمول:

```text
v = (Q / 3600) / (π × (ID/1000)^2 / 4)
```

خروجی‌های جدید در جدول caseها:

```text
Vin m/s
Vout m/s
```

---

### 3) Reducer ratio

نمایش مقدار:

```text
reducer ratio = min(inlet ID, outlet ID) / max(inlet ID, outlet ID)
```

اگر مقدار کمتر از `0.8` باشد، هشدار داده می‌شود که در گزارش کامل correctionهای زیر لازم است:

```text
Fp
FLp
```

---

### 4) هشدارهای مهندسی مقدماتی

اضافه شد:

```text
velocity > 3 m/s → caution
velocity > 5 m/s → high
velocity < 0.3 m/s → rangeability/controllability review
reducer ratio < 0.8 → نیاز به Fp/FLp در گزارش کامل
```

---

## مواردی که هنوز عمداً قفل هستند

```text
اعمال عددی Fp/FLp
Noise calculation
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
_tools/uat/tester232-advanced-cv-liquid-multicase.js
_tools/uat/tester233-advanced-cv-velocity-reducer.js
RELEASE-NOTES-v31.7.56.md
REGRESSION-REPORT-v31.7.56.md
```

---

## تست اضافه‌شده

```text
_tools/uat/tester233-advanced-cv-velocity-reducer.js
```

پوشش:

- وجود `ADV-CV-VELOCITY-REDUCER-001`.
- وجود `parsePipeIdMm`, `NPS_ID_MM`, `pipeVelocityChecks`.
- parse شدن `NPS 4`, `DN100`, `ID 102 mm`.
- محاسبه Vin/Vout.
- محاسبه reducer ratio.
- هشدار Fp/FLp.
- هشدار velocity high/caution.
- عدم وجود مسیر fetch/PDF/print/export.

نتیجه مستقیم:

```text
tester233-advanced-cv-velocity-reducer: 16 PASS / 0 FAIL
```

---

## Impact Analysis

| بخش | اثر | ریسک |
|---|---|---|
| Advanced Control Valve | velocity و reducer checks اضافه شد | متوسط/کنترل‌شده |
| محاسبات مهندسی | فقط preliminary warning؛ final correction نیست | متوسط |
| Public users | همچنان locked preview | کم |
| Licensed users | خروجی فنی‌تر برای feedback می‌گیرند | مثبت |
| PDF/report/payment | همچنان غیرفعال | بدون تغییر |
| API/CRM license | بدون تغییر اجرایی | کم |

---

## راستی‌آزمایی کارفرما

1. در `/tools/` ابزار Advanced Control Valve را با لایسنس unlock کنید.
2. فرم را باز کنید.
3. برای Liquid، Min/Normal/Max را وارد کنید.
4. در فیلدهای pipe وارد کنید، مثلاً:

```text
Inlet pipe: NPS 4
Outlet pipe: DN80
```

5. روی «محاسبه مقدماتی مایع / سه‌حالته + سرعت خط» بزنید.
6. در جدول باید ستون‌های زیر دیده شود:

```text
Vin m/s
Vout m/s
```

7. در کارت خلاصه باید `Reducer ratio` دیده شود.
8. اگر velocity بالا باشد یا DN/NPS mismatch وجود داشته باشد، هشدارهای مربوط به سرعت و Fp/FLp دیده می‌شود.

---

## نتیجه

Advanced Control Valve اکنون از سطح Cv/Kv مقدماتی به سطح بررسی operating envelope + pipe sanity رسیده است. گام بعدی پیشنهادی برای تکمیل همین ابزار: افزودن actuator sizing shell یا cavitation/noise severity detail، همچنان بدون PDF نهایی تا زمانی که خروجی محاسباتی کافی برای feedback تثبیت شود.
