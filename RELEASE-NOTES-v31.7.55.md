# Release Notes — v31.7.55

**تاریخ:** ۱۴۰۵/۰۴/۳۰ (2026-07-21)  
**نسخه:** `v31.7.55`  
**نوع:** ADV-CV-LIQUID-MULTICASE-001 — توسعه Advanced Control Valve به محاسبه مقدماتی Min/Normal/Max برای Liquid

---

## هدف ریلیز

مطابق تصمیم کارفرما، پرداخت آنلاین فعلاً عقب گذاشته شد تا ابتدا یک ابزار پیشرفته، یعنی **Advanced Control Valve**، به سطح قابل دریافت feedback نزدیک‌تر شود.

در این نسخه، ابزار Control Valve Advanced از محاسبه فقط حالت Normal به محاسبه مقدماتی سه‌حالته برای Liquid توسعه پیدا کرد:

```text
Minimum case
Normal case
Maximum case
```

این قابلیت فقط برای کاربر دارای grant/lLicense معتبر فعال است و همچنان PDF/گزارش نهایی تولید نمی‌کند.

---

## RCA / دلیل دقیق

1. کارفرما ترجیح داد پیش از فعال‌سازی درگاه پرداخت آنلاین، حداقل یک ابزار پیشرفته تا حد قابل تست و feedback تکمیل‌تر شود.
2. نسخه قبلی Advanced Control Valve فقط draft، completeness و محاسبه مقدماتی Liquid/Normal Case داشت.
3. برای استفاده مهندسی واقعی‌تر، کنترل ولو باید operating envelope داشته باشد؛ یعنی فقط Normal کافی نیست و Min/Max هم باید دیده شود.
4. تکمیل فوری report/PDF/brand selection هنوز پرریسک است؛ بنابراین این گام به محاسبه deterministic و on-screen محدود شد.
5. اصل قفل تجاری حفظ شد: کاربر عمومی همچنان preview قفل‌شده می‌بیند.

---

## کارهای انجام‌شده

### 1) API جدید frontend برای محاسبه چندحالته

در `tools/advanced-tools-ui.js` تابع جدید اضافه شد:

```js
ptfAdvCvCalculateLiquidCases(input?)
```

این تابع برای Liquid، caseهای زیر را محاسبه می‌کند:

```text
Min
Normal
Max
```

Normal همچنان الزامی است؛ Min/Max اگر پر شوند محاسبه می‌شوند.

---

### 2) خروجی جدولی caseها

برای هر case این مقادیر نمایش داده می‌شود:

```text
Q
P1
P2
ΔP
ΔP_choked
Choked?
Kv
Cv
Severity
Opening%
```

`Opening%` در صورتی محاسبه می‌شود که کاربر مقدار `Cv نامی ولو کاندید` را وارد کند.

---

### 3) Governing case و Cv پیشنهادی مقدماتی

سیستم بیشترین Cv را به‌عنوان governing case انتخاب می‌کند:

```text
Governing case = case with maximum calculated Cv
```

سپس مقدار مقدماتی زیر را نمایش می‌دهد:

```text
Preliminary selected Cv = Governing Cv × 1.10
```

این فقط پیشنهاد مقدماتی برای ادامه بررسی است و final sizing نیست.

---

### 4) Formula trace برای governing case

فرمول‌های trace برای governing case نمایش داده می‌شود:

```text
ΔP = P1 - P2
FF = 0.96 - 0.28 × sqrt(Pv / Pc)
ΔP_choked = FL² × (P1 - FF × Pv)
Kv branch based on choked/non-choked
Cv = 1.156 × Kv
Cavitation margin = P2 - Pv
Severity = ΔP / ΔP_choked
```

---

### 5) حفظ سازگاری تابع قدیمی

تابع قبلی:

```js
ptfAdvCvCalculatePrelim()
```

همچنان وجود دارد و برای تست‌ها/رفتار قبلی scope قبلی را نگه می‌دارد:

```js
scope: 'preliminary_liquid_only'
```

اما در پشت صحنه از محاسبه چندحالته استفاده می‌کند و این مقدار را هم دارد:

```js
multicaseScope: 'preliminary_liquid_multicase'
```

---

## مواردی که عمداً هنوز فعال نیستند

```text
Gas sizing
Steam sizing
Two-phase sizing
Viscosity correction کامل
Reducer / pipe velocity correction
Noise calculation
Actuator sizing
Brand/model final selection
Charts نهایی
English PDF report
Server-side paid report generation
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
RELEASE-NOTES-v31.7.55.md
REGRESSION-REPORT-v31.7.55.md
```

---

## تست اضافه‌شده

```text
_tools/uat/tester232-advanced-cv-liquid-multicase.js
```

پوشش:

- وجود API جدید `ptfAdvCvCalculateLiquidCases`.
- وجود فیلد `adv_rated_cv` برای opening%.
- scope/final/pdf صریح.
- عدم وجود fetch/PDF/print/export.
- محاسبه سه case برای نمونه عددی.
- حفظ Cv حالت Normal حدود 57.8 برای رگرسیون قبلی.
- انتخاب governing case.
- محاسبه `recommendedCv = governingCv × 1.10`.
- محاسبه opening%.
- fail-closed بدون grant.
- block بودن Gas/Steam در این فاز.

نتیجه مستقیم:

```text
tester232-advanced-cv-liquid-multicase: 14 PASS / 0 FAIL
```

---

## تست‌های محافظ مرتبط

```text
tester224-advanced-cv-schema-ui: 12 PASS / 0 FAIL
tester225-advanced-cv-draft-input: 13 PASS / 0 FAIL
tester226-advanced-cv-prelim-calc: 18 PASS / 0 FAIL
tester232-advanced-cv-liquid-multicase: 14 PASS / 0 FAIL
```

---

## Impact Analysis

| بخش | اثر | ریسک |
|---|---|---|
| Advanced Control Valve | محاسبه Liquid سه‌حالته اضافه شد | متوسط/کنترل‌شده |
| Public users | همچنان locked preview | کم |
| Licensed users | جدول caseها و governing Cv می‌بینند | مثبت |
| PDF/report/payment | همچنان غیرفعال | بدون تغییر |
| API/CRM license admin | دست‌نخورده | کم |
| محاسبات مهندسی | مقدماتی و قابل feedback؛ final نیست | متوسط |

---

## راستی‌آزمایی کارفرما

1. وارد `/tools/` شوید.
2. با لایسنس معتبر Advanced Control Valve را unlock کنید.
3. فرم Control Valve Advanced را باز کنید.
4. برای Liquid، Normal را حتماً و Min/Max را هم وارد کنید.
5. مقدارهای پایه را وارد کنید:

```text
SG
Pv
Pc
FL
```

6. اگر Cv یک ولو کاندید را دارید، در فیلد `Cv نامی ولو کاندید` وارد کنید.
7. روی «محاسبه مقدماتی مایع / سه‌حالته» بزنید.
8. باید جدول Min/Normal/Max، governing case، governing Cv، selected Cv +10% و Formula Trace دیده شود.
9. دقت کنید PDF/گزارش نهایی تولید نمی‌شود.

---

## نتیجه

یک قدم مهم برای تکمیل اولین ابزار پیشرفته برداشته شد. Advanced Control Valve اکنون از یک محاسبه ساده Normal به یک تحلیل مقدماتی operating envelope برای Liquid رسیده است. گام بعدی پیشنهادی برای همین ابزار: افزودن velocity/reducer correction و سپس actuator/noise/brand-matrix به‌ترتیب کم‌ریسک.
