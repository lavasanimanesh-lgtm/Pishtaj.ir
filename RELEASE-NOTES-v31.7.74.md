# Release Notes — v31.7.74

**تاریخ:** ۱۴۰۵/۰۴/۳۰ (2026-07-21)  
**نسخه:** `v31.7.74`  
**نوع:** ADV-CV-GAS-STEAM-UX-REFINE-001 — اصلاح UX و راهنمای ورودی Gas/Steam برای Advanced Control Valve

---

## هدف ریلیز

پس از فعال شدن محاسبه مقدماتی Gas/Steam در Advanced Control Valve، لازم بود فرم و report preview برای این دو فاز شفاف‌تر شود. در این ریلیز، راهنمای واحدها، مبنای دبی و readiness برای Gas/Steam اصلاح شد تا کاربر بداند دقیقاً چه واحدی و چه داده‌ای باید وارد کند.

---

## RCA / دلیل دقیق

1. در v31.7.73 محاسبه مقدماتی Gas/Steam اضافه شد.
2. اما UI هنوز بیشتر بر Liquid متمرکز بود و مبنای دبی Gas/Steam را واضح نمی‌کرد.
3. report preview نیز هنوز برخی توضیحات Liquid-only داشت.
4. strict readiness برای Gas به‌صورت سخت‌گیرانه MW را می‌خواست، در حالی که برای گاز می‌توان از MW یا SG استفاده کرد.
5. بنابراین این گام، UI و readiness را phase-aware کرد، بدون تغییر در قفل PDF/گزارش نهایی.

---

## کارهای انجام‌شده

### 1) فیلد جدید مبنای دبی

به فرم اضافه شد:

```text
adv_flow_basis
```

با راهنمای واحد:

```text
Liquid: m³/h
Gas: Nm³/h
Steam: kg/h
```

---

### 2) راهنمای فاز و واحد

تابع جدید:

```js
ptfAdvCvPhaseGuideHtml()
```

در فرم، بخش راهنما نمایش می‌دهد:

```text
Liquid flow basis
Gas flow basis
Steam flow basis
Pressure basis
Vendor coefficients
Two-phase limitation
```

---

### 3) Placeholderهای Gas/Steam واضح‌تر شد

برای فیلدهای زیر توضیح دقیق‌تر اضافه شد:

```text
MW
Z
k
Xt
flow basis
```

---

### 4) Report preview اصلاح شد

در Design Basis گزارش، موارد زیر اضافه شد:

```text
Flow basis
MW
Z
k
Xt
```

و فرض قبلی Liquid-only اصلاح شد:

```text
Liquid, gas and steam preliminary screening are available; two-phase services are excluded from this phase.
```

---

### 5) Readiness phase-aware شد

برای Gas:

```text
MW یا SG کافی است
Z / k / Xt / flow basis لازم است
```

برای Steam:

```text
flow basis / k / Xt لازم است
```

برای Liquid:

```text
SG / viscosity / Pv / Pc لازم است
```

---

## مواردی که همچنان قفل است

```text
Gas/Steam final IEC/ISA sizing
Vendor-specific gas/steam correction
Final noise calculation
Final actuator/brand selection
PDF export
Download report
Final report number
Paid report quota consumption
Online payment
```

---

## فایل‌های تغییر یافته

```text
tools/advanced-tools-ui.js
tools/advanced-report-ui.js
crm/index.html
crm/sw.js
crm/clear-cache.html
PTF-MASTER-HANDOVER.md
_tools/uat/tester227-storage-quota-foundation.js
_tools/uat/tester239-advanced-cv-server-report-scaffold.js
_tools/uat/tester247-advanced-cv-internal-scenario-qa.js
_tools/uat/tester250-advanced-cv-gas-steam-prelim.js
_tools/uat/tester251-advanced-cv-gas-steam-ux-refine.js
RELEASE-NOTES-v31.7.74.md
REGRESSION-REPORT-v31.7.74.md
```

---

## تست اضافه‌شده

```text
_tools/uat/tester251-advanced-cv-gas-steam-ux-refine.js
```

پوشش:

- وجود `ADV-CV-GAS-STEAM-UX-REFINE-001`.
- وجود `adv_flow_basis`.
- وجود phase/unit guide.
- وجود راهنمای Liquid/Gas/Steam/Two-phase.
- وجود Flow basis در report preview/payload.
- readiness گاز با SG و بدون MW.
- عدم وجود PDF/download/print/fetch/export.

نتیجه مستقیم:

```text
tester251-advanced-cv-gas-steam-ux-refine: 12 PASS / 0 FAIL
```

---

## Impact Analysis

| بخش | اثر | ریسک |
|---|---|---|
| Advanced CV form | ورودی‌های Gas/Steam واضح‌تر شد | کم |
| Readiness | phase-aware شد | متوسط/کنترل‌شده |
| Report preview/payload | Flow basis و ضرایب Gas/Steam اضافه شد | مثبت |
| Liquid path | حفظ شد | کم |
| PDF/payment/final report | همچنان قفل | بدون تغییر |

---

## راستی‌آزمایی کارفرما

1. Advanced Control Valve را با لایسنس باز کنید.
2. فاز را روی Gas یا Steam بگذارید.
3. بخش راهنمای واحد را بررسی کنید.
4. برای Gas مقدارهای زیر را وارد کنید:

```text
Flow basis = Nm3/h
SG یا MW
Z
k
Xt
```

5. برای Steam:

```text
Flow basis = kg/h
k
Xt
```

6. report preview را ببینید؛ باید Flow basis و ضرایب Gas/Steam در Design Basis دیده شود.

---

## نتیجه

مسیر Gas/Steam اکنون فقط محاسبه خام نیست؛ UI و readiness آن هم شفاف‌تر و قابل استفاده‌تر شد. ابزار هنوز نهایی/PDF نیست، اما برای ادامه تکمیل فنی Gas/Steam آماده‌تر است.
