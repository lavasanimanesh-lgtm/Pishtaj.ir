# Release Notes — v31.7.45

**تاریخ:** ۱۴۰۵/۰۴/۳۰ (2026-07-21)  
**نسخه:** `v31.7.45`  
**نوع:** 🟢 ADV-CV-INPUT-SCHEMA-001 — پیش‌نمایش قفل‌شده schema ورودی کنترل ولو پیشرفته

---

## 🎯 هدف ریلیز

ادامه توسعه ابزار پیشرفته Control Valve بدون باز کردن محاسبه عمومی. این ریلیز ساختار دقیق ورودی‌ها و چارچوب گزارش انگلیسی استاندارد را به‌صورت locked preview در صفحه Tools نمایش می‌دهد.

---

## ✅ کارهای انجام‌شده

### 1) پیش‌نمایش schema ورودی Control Valve

در بخش `Advanced Control Valve Sizing` صفحه `/tools/` گروه‌های ورودی زیر اضافه شد:

```text
Project & Tag
Operating Cases
Fluid Data
Piping Data
Valve Data
Actuator Data
Brand Library
Compliance
```

### 2) Completeness checklist

چک‌لیست کامل بودن داده‌ها اضافه شد:

```text
Required: flow + P1/P2 for all cases
Required: fluid phase and temperature
Liquid: SG/density, Pv, Pc, viscosity
Gas/Steam: MW, Z, k and flow basis
Recommended: pipe IDs and reducers
For actuator: shutoff ΔP and seat/plug data
```

### 3) English standard report outline

چارچوب گزارش انگلیسی آینده گسترش یافت:

```text
Cover page + Report ID + Revision
Design Basis and Input Summary
Min/Normal/Max Calculation Tables
Cv/Kv, choked flow and cavitation/flashing checks
Formula Trace and Unit Conversion Notes
Flow vs Cv, Opening% and Risk Indicator Charts
Brand / Series Candidate Matrix
Assumptions, Missing Data and Engineering Warnings
Paid PDF report with report number
```

### 4) سند فنی schema

فایل جدید اضافه شد:

```text
ADV-CV-INPUT-SCHEMA-v1.md
```

این سند ورودی‌های موردنیاز، completeness rule، برندهای اولیه و ساختار گزارش آینده را تعریف می‌کند.

---

## 🔒 وضعیت قفل

این ریلیز فقط preview است:

```text
Full calculation and report generation remain disabled.
```

ابزار هنوز برای عموم اجرا نمی‌شود و گزارش PDF تولید نمی‌کند.

---

## 🧪 تست اضافه‌شده

### `_tools/uat/tester222-advanced-cv-input-schema.js`

پوشش:

- وجود schema preview.
- وجود گروه‌های اصلی ورودی.
- وجود completeness checklist.
- پوشش داده‌های Liquid/Gas/Steam.
- locked بودن ابزار.
- وجود report outline انگلیسی.
- وجود سند فنی schema.
- وجود برندهای اولیه.

نتیجه مستقیم:

```text
tester222-advanced-cv-input-schema: 12 PASS / 0 FAIL
```

---

## ⚠️ Impact Analysis

| بخش | اثر | ریسک |
|---|---|---|
| Tools page | پیش‌نمایش schema کامل‌تر شد | کم |
| Advanced CV | هنوز locked preview است | کم |
| Free tools | دست‌نخورده | صفر |
| License/paywall | دست‌نخورده | صفر |
| CRM/Auth/Finance/Sync | دست‌نخورده | صفر |

---

## 📋 راستی‌آزمایی کارفرما

1. صفحه `/tools/` را باز کنید.
2. بخش `Advanced Control Valve Sizing` را ببینید.
3. باید گروه‌های ورودی Project, Operating Cases, Fluid Data, Valve Data و غیره دیده شوند.
4. completeness checklist باید دیده شود.
5. گزارش انگلیسی آینده باید شامل report ID، tables، charts و formula trace باشد.
6. ابزار همچنان نباید برای عموم محاسبه کامل انجام دهد.

---

## 🚦 نتیجه

این گام پیش‌نیاز پیاده‌سازی واقعی ابزار Control Valve Advanced را کامل‌تر کرد، بدون باز کردن دسترسی عمومی یا ورود به محاسبات سنگین.
