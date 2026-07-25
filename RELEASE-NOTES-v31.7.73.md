# Release Notes — v31.7.73

**تاریخ:** ۱۴۰۵/۰۴/۳۰ (2026-07-21)  
**نسخه:** `v31.7.73`  
**نوع:** ADV-CV-GAS-STEAM-PRELIM-001 — محاسبه مقدماتی Gas / Steam برای Advanced Control Valve

---

## هدف ریلیز

ادامه تکمیل اولین ابزار پیشرفته. در این نسخه، ابزار **Advanced Control Valve** از حالت Liquid-only خارج شد و مسیر مقدماتی برای **Gas** و **Steam** نیز اضافه شد؛ همچنان بدون PDF، بدون گزارش نهایی و بدون پرداخت آنلاین.

---

## RCA / دلیل دقیق

1. ابزار تا نسخه قبل برای Liquid بسیار کامل‌تر شده بود، اما برای Control Valve واقعی، فقط Liquid کافی نیست.
2. فیلدهای Gas/Steam مانند `MW`, `Z`, `k`, `Xt` در فرم وجود داشتند، اما مسیر محاسبه هنوز Gas/Steam را block می‌کرد.
3. برای کامل‌تر شدن ابزار، باید یک screening مقدماتی Gas/Steam اضافه می‌شد؛ اما محاسبه نهایی vendor/IEC هنوز زود است.
4. بنابراین یک مسیر preliminary و قفل‌شده اضافه شد که برای feedback و QA داخلی مناسب است، نه گزارش نهایی.

---

## کارهای انجام‌شده

### 1) تابع generic phase-aware

اضافه شد:

```js
ptfAdvCvCalculateAdvancedCases(input?)
```

این تابع بر اساس فاز سیال dispatch می‌کند:

```text
Liquid → ptfAdvCvCalculateLiquidCases
Gas    → ptfAdvCvCalculateCompressibleCases
Steam  → ptfAdvCvCalculateCompressibleCases
```

---

### 2) مسیر Gas preliminary

برای Gas از داده‌های زیر استفاده می‌شود:

```text
MW یا SG
Z
k
Xt
Q
P1/P2/T
```

محاسبات مقدماتی:

```text
x = ΔP / P1
x_choked ≈ Fγ × Xt
choked screening
Cv / Kv preliminary
estimated actual line flow for velocity screening
noise risk screening
```

---

### 3) مسیر Steam preliminary

برای Steam مسیر ساده‌شده choked / non-choked اضافه شد:

```text
non-choked steam Cv
choked steam Cv
estimated actual steam volume for velocity screening
```

---

### 4) Report preview و payload با مسیر generic

مسیرهای زیر از calculator عمومی phase-aware استفاده می‌کنند:

```text
report preview
locked report payload
server draft submission
```

یعنی اگر فاز Gas یا Steam باشد، preview/payload هم با همان محاسبه ساخته می‌شود.

---

### 5) سناریوی نمونه Gas

در feedback pack نمونه جدید اضافه شد:

```text
gas_steam_screen
```

برای screening مقدماتی Natural Gas.

---

## مواردی که هنوز عمداً قفل هستند

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
RELEASE-NOTES-v31.7.73.md
REGRESSION-REPORT-v31.7.73.md
```

---

## تست اضافه‌شده

```text
_tools/uat/tester250-advanced-cv-gas-steam-prelim.js
```

پوشش:

- وجود `ADV-CV-GAS-STEAM-PRELIM-001`.
- وجود توابع compressible/gas/steam.
- استفاده از MW/Z/k/Xt.
- وجود نمونه `gas_steam_screen`.
- عدم وجود PDF/download/print/fetch/export.
- runtime محاسبه Gas.
- runtime محاسبه Steam.
- حفظ block در تابع قدیمی Liquid-only.
- fail-closed بدون grant.

نتیجه مستقیم:

```text
tester250-advanced-cv-gas-steam-prelim: 14 PASS / 0 FAIL
```

---

## Impact Analysis

| بخش | اثر | ریسک |
|---|---|---|
| Advanced Control Valve | Gas/Steam preliminary اضافه شد | متوسط |
| Report preview/payload | phase-aware شد | متوسط/کنترل‌شده |
| Liquid path | حفظ شد و تست‌های قبلی PASS هستند | کم |
| PDF/final report/payment | همچنان قفل | بدون تغییر |

---

## راستی‌آزمایی کارفرما

1. Advanced Control Valve را با لایسنس باز کنید.
2. فاز سیال را روی Gas یا Steam بگذارید.
3. داده‌های لازم را وارد کنید:

```text
برای Gas: MW یا SG، Z، k، Xt، Q، P1، P2، T
برای Steam: Q kg/h، P1، P2، T
```

4. محاسبه مقدماتی را اجرا کنید.
5. باید case table و risk/noise screening برای Gas/Steam دیده شود.
6. هیچ PDF یا دانلودی نباید تولید شود.

---

## نتیجه

Advanced Control Valve اکنون فقط Liquid نیست و مسیر مقدماتی Gas/Steam هم دارد. این گام ابزار را به پوشش واقعی‌تر Control Valve نزدیک‌تر می‌کند، اما همچنان همه خروجی‌های نهایی و تجاری قفل هستند.
