# Release Notes — v31.7.47

**تاریخ:** ۱۴۰۵/۰۴/۳۰ (2026-07-21)  
**نسخه:** `v31.7.47`  
**نوع:** 🟢 ADV-CV-SCHEMA-UI-001 — فرم ورودی قفل‌شده Control Valve Advanced

---

## 🎯 هدف ریلیز

ادامه توسعه ابزار پیشرفته Control Valve با ساخت یک فرم واقعی اما قفل‌شده برای نمایش ساختار ورودی‌ها. در این مرحله هنوز محاسبه کامل، انتخاب برند، نمودار و گزارش PDF برای عموم فعال نشده است.

---

## ✅ کارهای انجام‌شده

### 1) فایل UI جدید

فایل جدید اضافه شد:

```text
tools/advanced-tools-ui.js
```

این فایل تابع زیر را ارائه می‌کند:

```js
ptfAdvCvOpenSchema()
```

که modal قفل‌شده فرم ورودی Control Valve را باز می‌کند.

---

### 2) دکمه مشاهده فرم ورودی قفل‌شده

در صفحه `/tools/` داخل بخش Advanced Control Valve دکمه جدید اضافه شد:

```text
مشاهده فرم ورودی قفل‌شده
```

---

### 3) گروه‌های ورودی داخل modal

فرم قفل‌شده شامل این گروه‌هاست:

```text
Project and tag data
Operating cases
Fluid data
Piping and valve data
Actuator and brand data
Completeness checklist
English paid report outline
```

---

### 4) داده‌های ورودی نمونه/قفل‌شده

فیلدهای modal همگی `disabled` هستند. یعنی ابزار هنوز برای ورود اطلاعات و محاسبه آزاد نشده و فقط schema را نشان می‌دهد.

---

### 5) مسیر فعال‌سازی

در انتهای modal مسیر فعال‌سازی به RFQ هوشمند وجود دارد:

```text
/rfq/?activation=tools&tool=control_valve_advanced&item=Advanced Control Valve Sizing Input Schema
```

---

## 🧪 تست اضافه‌شده

### `_tools/uat/tester224-advanced-cv-schema-ui.js`

پوشش:

- فایل `advanced-tools-ui.js` در صفحه Tools لود می‌شود.
- دکمه مشاهده فرم ورودی قفل‌شده وجود دارد.
- `ptfAdvCvOpenSchema` تعریف شده است.
- گروه‌های Project, Operating Cases, Fluid, Piping, Valve, Actuator وجود دارند.
- همه فیلدها disabled هستند.
- Completeness checklist وجود دارد.
- English report outline وجود دارد.
- مسیر فعال‌سازی به RFQ با `activation=tools` وصل است.

نتیجه مستقیم:

```text
tester224-advanced-cv-schema-ui: 12 PASS / 0 FAIL
```

---

## ⚠️ Impact Analysis

| بخش | اثر | ریسک |
|---|---|---|
| Tools page | دکمه و modal schema قفل‌شده اضافه شد | کم |
| Advanced Control Valve | فقط preview UI، بدون محاسبه | کم |
| Free tools | دست‌نخورده | صفر |
| License/paywall | دست‌نخورده | صفر |
| CRM/Auth/Finance/Sync | دست‌نخورده | صفر |

---

## 📋 راستی‌آزمایی کارفرما

1. صفحه `/tools/` را باز کنید.
2. در بخش Advanced Control Valve روی «مشاهده فرم ورودی قفل‌شده» کلیک کنید.
3. باید modal فرم ورودی باز شود.
4. فیلدهای Project/Tag، Operating Cases، Fluid Data، Piping/Valve، Actuator و Brand را ببینید.
5. همه فیلدها باید قفل/disabled باشند.
6. هیچ محاسبه یا PDF عمومی نباید تولید شود.

---

## 🚦 نتیجه

مرحله UI schema برای Control Valve Advanced آماده شد، اما ابزار همچنان قفل و غیرقابل استفاده عمومی باقی مانده است.
