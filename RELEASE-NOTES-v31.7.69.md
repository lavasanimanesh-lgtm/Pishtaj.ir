# Release Notes — v31.7.69

**تاریخ:** ۱۴۰۵/۰۴/۳۰ (2026-07-21)  
**نسخه:** `v31.7.69`  
**نوع:** ADV-CV-FEEDBACK-PACK-001 — بسته تست و feedback مهندسی برای Advanced Control Valve

---

## هدف ریلیز

پس از رفع باگ ورود موبایل، توسعه ابزار پیشرفته ادامه داده شد. در این نسخه، برای گرفتن feedback مهندسی پیش از فعال‌سازی PDF/پرداخت آنلاین، یک بسته تست و feedback برای **Advanced Control Valve** اضافه شد.

این بسته به مهندس یا کاربر دارای لایسنس اجازه می‌دهد چند سناریوی نمونه را سریع داخل فرم بارگذاری کند، محاسبات و previewها را ببیند و feedback ساختاریافته بدهد.

---

## RCA / دلیل دقیق

1. ابزار Advanced Control Valve اکنون قابلیت‌های زیادی دارد، اما برای تکمیل نهایی باید با داده‌های نمونه و feedback مهندسان تست شود.
2. وارد کردن همه داده‌ها برای هر تست زمان‌بر است و باعث کندی دریافت feedback می‌شود.
3. لازم بود چند سناریوی نمونه استاندارد، قابل تکرار و قابل مقایسه داخل ابزار باشد.
4. همچنین feedback باید ساختارمند باشد تا مشخص شود مشکل از input labels، محاسبه Cv، velocity/reducer، cavitation/noise، actuator shell یا report preview است.
5. این مرحله هیچ PDF/گزارش نهایی/پرداختی را باز نمی‌کند؛ فقط فرآیند تست و بازخورد را سریع‌تر می‌کند.

---

## کارهای انجام‌شده

### 1) سناریوهای نمونه قابل بارگذاری

در `tools/advanced-tools-ui.js` سه سناریوی نمونه اضافه شد:

```text
baseline_water
cavitation_noise
reducer_velocity
```

توضیح:

```text
baseline_water      سرویس نرمال آب برای کنترل baseline
cavitation_noise    افت فشار بالا برای بررسی cavitation/noise
reducer_velocity    سناریوی velocity و reducer / line size review
```

---

### 2) تابع بارگذاری sample

تابع جدید:

```js
ptfAdvCvApplyFeedbackSample(sampleId)
```

این تابع فقط برای کاربر دارای grant معتبر فعال است. بدون grant، مسیر paywall باز می‌شود.

---

### 3) بسته feedback روی UI

تابع جدید:

```js
ptfAdvCvOpenFeedbackPack()
```

در فرم Advanced Control Valve دکمه جدید اضافه شد:

```text
بسته تست و feedback
```

---

### 4) قالب feedback قابل کپی

توابع جدید:

```js
ptfAdvCvFeedbackText()
ptfAdvCvCopyFeedbackText()
```

قالب feedback شامل این محورهای بررسی است:

```text
input labels / units
Cv/Kv and governing case
velocity / reducer warnings
cavitation / flashing risk
noise risk
actuator shell
English report preview
missing items before final report
```

---

## مواردی که همچنان قفل هستند

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
RELEASE-NOTES-v31.7.69.md
REGRESSION-REPORT-v31.7.69.md
```

---

## تست اضافه‌شده

```text
_tools/uat/tester246-advanced-cv-feedback-pack.js
```

پوشش:

- وجود `ADV-CV-FEEDBACK-PACK-001`.
- وجود سه سناریوی نمونه.
- وجود توابع feedback pack.
- وجود دکمه UI.
- وجود قالب feedback مهندسی.
- عدم وجود PDF/download/print/fetch/export.
- runtime بارگذاری sample baseline.
- runtime اجرای محاسبه پس از sample.
- runtime sample high ΔP برای cavitation/noise.
- کپی قالب feedback.
- fail-closed بدون grant.

نتیجه مستقیم:

```text
tester246-advanced-cv-feedback-pack: 13 PASS / 0 FAIL
```

---

## Impact Analysis

| بخش | اثر | ریسک |
|---|---|---|
| Advanced Control Valve | تست و feedback سریع‌تر شد | کم |
| Licensed users | می‌توانند سناریوهای نمونه را load کنند | مثبت |
| Public users | همچنان locked/paywall | کم |
| PDF/payment/final report | همچنان قفل | بدون تغییر |
| محاسبات موجود | تغییر الگوریتم اصلی ندارد | کم |

---

## راستی‌آزمایی کارفرما

1. وارد `/tools/` شوید.
2. Advanced Control Valve را با لایسنس unlock کنید.
3. فرم را باز کنید.
4. روی دکمه زیر بزنید:

```text
بسته تست و feedback
```

5. یکی از نمونه‌ها را بارگذاری کنید:

```text
نمونه ۱: سرویس نرمال آب
نمونه ۲: ΔP بالا / کاویتاسیون
نمونه ۳: سرعت خط / reducer
```

6. محاسبه مقدماتی و report preview را اجرا کنید.
7. روی «کپی قالب feedback» بزنید و feedback مهندسی را ثبت کنید.

---

## نتیجه

ابزار Advanced Control Valve اکنون برای چرخه feedback مهندسی آماده‌تر است. سناریوهای نمونه و قالب feedback کمک می‌کنند قبل از ورود به PDF نهایی یا پرداخت آنلاین، کیفیت محاسبات و UX ابزار با داده‌های قابل تکرار بررسی شود.
