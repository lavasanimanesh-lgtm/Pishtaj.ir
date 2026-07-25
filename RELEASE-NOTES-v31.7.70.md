# Release Notes — v31.7.70

**تاریخ:** ۱۴۰۵/۰۴/۳۰ (2026-07-21)  
**نسخه:** `v31.7.70`  
**نوع:** ADV-CV-INTERNAL-SCENARIO-QA-001 — QA داخلی سناریوهای Advanced Control Valve

---

## هدف ریلیز

ادامه تکمیل ابزار پیشرفته با تست داخلی، چون فعلاً tester بیرونی نداریم. در این نسخه، بسته feedback قبلی به یک **QA داخلی سناریوها** ارتقا یافت تا سه سناریوی built-in به‌صورت یکجا اجرا و با هم مقایسه شوند.

---

## RCA / دلیل دقیق

1. در v31.7.69 سه سناریوی نمونه و قالب feedback اضافه شد.
2. اما برای بررسی سریع کیفیت ابزار، لازم بود فقط با یک دکمه همه سناریوها اجرا شوند و خروجی‌ها در یک جدول مقایسه شوند.
3. هدف این است که پیش از PDF/پرداخت آنلاین، خودمان بتوانیم regression مهندسی داخلی داشته باشیم.
4. این QA هیچ PDF، دانلود، fetch یا گزارش نهایی تولید نمی‌کند.

---

## کارهای انجام‌شده

### 1) تابع QA داخلی

در `tools/advanced-tools-ui.js` اضافه شد:

```js
ptfAdvCvRunInternalScenarioQa()
```

این تابع سه سناریوی زیر را اجرا می‌کند:

```text
baseline_water
cavitation_noise
reducer_velocity
```

---

### 2) جدول مقایسه QA

برای هر سناریو این موارد نمایش داده می‌شود:

```text
Scenario
QA status
Governing case
Governing Cv
Cavitation risk
Noise risk
Vmax
Actuator thrust
Readiness
Checksum
Warnings count
```

---

### 3) Summary داخلی

خروجی QA شامل summary است:

```text
Total
Pass
Review
Failed
```

---

### 4) دکمه جدید UI

در بخش feedback pack دکمه زیر اضافه شد:

```text
اجرای QA داخلی سناریوها
```

---

## قفل‌های حفظ‌شده

```text
PDF export
Download report
Final report number
Server-side final report rendering
Paid report quota consumption
Online payment
```

---

## فایل‌های تغییر یافته

```text
tools/advanced-tools-ui.js
crm/index.html
crm/sw.js
crm/clear-cache.html
PTF-MASTER-HANDOVER.md
_tools/uat/tester227-storage-quota-foundation.js
_tools/uat/tester245-mobile-login-user-merge.js
_tools/uat/tester246-advanced-cv-feedback-pack.js
_tools/uat/tester247-advanced-cv-internal-scenario-qa.js
RELEASE-NOTES-v31.7.70.md
REGRESSION-REPORT-v31.7.70.md
```

---

## تست اضافه‌شده

```text
_tools/uat/tester247-advanced-cv-internal-scenario-qa.js
```

پوشش:

- وجود `ADV-CV-INTERNAL-SCENARIO-QA-001`.
- وجود `ptfAdvCvRunInternalScenarioQa`.
- اجرای سه سناریوی baseline/cavitation/reducer.
- وجود ستون‌های QA مهم.
- عدم وجود PDF/download/print/fetch/export.
- runtime اجرای سه سناریو.
- نمایش جدول QA در UI.
- fail-closed بدون grant.

نتیجه مستقیم:

```text
tester247-advanced-cv-internal-scenario-qa: 11 PASS / 0 FAIL
```

---

## رگرسیون میانی و رفع آن

در اجرای اول full regression، `tester227-storage-quota-foundation.js` به‌دلیل assert نسخه cache-bust قدیمی یک FAIL داد. تست با نسخه جدید `v31.7.70` هم‌راستا شد و full regression دوباره کامل PASS شد.

---

## Impact Analysis

| بخش | اثر | ریسک |
|---|---|---|
| Advanced Control Valve | QA داخلی سناریوها اضافه شد | کم |
| Licensed users | می‌توانند sanity check داخلی بگیرند | مثبت |
| Public users | همچنان locked/paywall | کم |
| محاسبات موجود | الگوریتم اصلی تغییر نکرد | کم |
| PDF/payment/final report | همچنان قفل | بدون تغییر |

---

## راستی‌آزمایی کارفرما

1. Advanced Control Valve را با لایسنس unlock کنید.
2. دکمه «بسته تست و feedback» را بزنید.
3. روی «اجرای QA داخلی سناریوها» بزنید.
4. باید جدول سه سناریو با ستون‌های ریسک، Cv، readiness و checksum دیده شود.
5. هیچ PDF یا دانلودی نباید تولید شود.

---

## نتیجه

اکنون ابزار Advanced Control Valve یک benchmark داخلی برای سناریوهای نمونه دارد و بدون تست‌کننده بیرونی می‌توانیم sanity/regression مهندسی اولیه بگیریم.