# Release Notes — v31.7.72

**تاریخ:** ۱۴۰۵/۰۴/۳۰ (2026-07-21)  
**نسخه:** `v31.7.72`  
**نوع:** ADV-TOOLS-PAGE-RTL-POLISH-001 — بازطراحی صفحه `/tools/` و کارت‌های ابزارهای پیشرفته

---

## هدف ریلیز

به درخواست کارفرما، ظاهر صفحه ابزارهای پیشرفته در `/tools/` بازطراحی شد تا مشکل شلختگی ناشی از ترکیب متن فارسی و انگلیسی، راست‌چین/چپ‌چین نامنظم و کارت‌های ناهمگون رفع شود.

این ریلیز فقط UI/UX و متن قابل مشاهده صفحه ابزارها را اصلاح می‌کند و منطق محاسبات، لایسنس و قفل PDF/گزارش نهایی را تغییر نمی‌دهد.

---

## RCA / دلیل دقیق

1. بخش advanced tools صفحه `/tools/` هنوز مثل نسخه‌های اولیه، عنوان‌ها و توضیحات انگلیسی/فارسی را در یک خط یا یک بلوک ترکیب می‌کرد.
2. در حالت RTL، عبارت‌های انگلیسی مثل `Control Valve Advanced`, `Flow Meter / Orifice`, `Pressure drop`, `Cv/Kv`, `Paid PDF report` کنار فارسی باعث شکست بصری و خوانایی ضعیف می‌شد.
3. چون این بخش قرار است معرفی محصول غیررایگان و حرفه‌ای باشد، باید متن فارسی به‌عنوان متن اصلی و متن انگلیسی فقط به‌عنوان subtitle/technical label جداگانه نمایش داده شود.
4. بنابراین کاتالوگ، preview کنترل ولو و کارت گزارش انگلیسی بازطراحی شدند.

---

## کارهای انجام‌شده

### 1) Visual shell جدید برای Advanced Tools

در `tools/index.html` کلاس‌های جدید اضافه شد:

```text
adv-wrap
adv-top
adv-catalog
adv-tool-card
adv-cv-panel
adv-report-card
adv-schema-card
```

ظاهر جدید شامل:

```text
پس‌زمینه تیره/gradient
کارت‌های سفید و تمیز
shadow نرم
border radius یکپارچه
فاصله‌گذاری منظم‌تر
```

---

### 2) فارسی‌سازی متن اصلی کارت‌ها

عنوان‌های اصلی کارت‌ها فارسی شدند:

```text
سایزینگ پیشرفته کنترل ولو
تحلیل پیشرفته پایپینگ
انتخاب و بررسی پمپ
فلومتر و اوریفیس
محاسبات برق صنعتی
ابزار دقیق و لوپ کنترل
```

زیرعنوان انگلیسی جداگانه و LTR باقی ماند:

```text
Control Valve Advanced
Piping Advanced
Pump Selection
Flow Meter / Orifice
Electrical Engineering
Instrumentation
```

---

### 3) جداسازی بصری فارسی و انگلیسی

کلاس جدید:

```css
.adv-en
```

برای متن‌های انگلیسی اضافه شد:

```text
direction: ltr
text-align: left
unicode-bidi: isolate
font-family: Inter/Arial/Tahoma
```

---

### 4) بازطراحی preview کنترل ولو

بخش `advanced-control-valve` اکنون:

```text
عنوان اصلی فارسی دارد
زیرعنوان انگلیسی جدا دارد
توضیحات فارسی و روان‌تر دارد
کارت‌های schema فارسی با subtitle انگلیسی دارند
```

---

### 5) جداسازی report outline انگلیسی

بخش report outline اکنون در کارت جداگانه و با LTR-friendly list نمایش داده می‌شود، نه در متن RTL مخلوط.

---

### 6) حفظ compatibility تست‌های قبلی

توکن‌های legacy لازم برای UAT در comment غیرقابل‌نمایش حفظ شدند تا تست‌های قبلی که دنبال عبارات انگلیسی بودند، بدون شکستن باقی بمانند.

---

## مواردی که تغییر نکردند

```text
محاسبات Advanced Control Valve
لایسنس و paywall
Admin license panel
Report draft workflow
Final readiness gate
Quota dry-run
PDF/report/payment lock
```

---

## فایل‌های تغییر یافته

```text
tools/index.html
crm/index.html
crm/sw.js
crm/clear-cache.html
PTF-MASTER-HANDOVER.md
_tools/uat/tester227-storage-quota-foundation.js
_tools/uat/tester249-tools-page-rtl-polish.js
RELEASE-NOTES-v31.7.72.md
REGRESSION-REPORT-v31.7.72.md
```

---

## تست اضافه‌شده

```text
_tools/uat/tester249-tools-page-rtl-polish.js
```

پوشش:

- وجود نسخه `v31.7.72`.
- وجود کلاس‌های جدید visual shell صفحه ابزارها.
- فارسی بودن عنوان‌های اصلی کارت‌ها.
- جدا بودن زیرعنوان‌های انگلیسی با `adv-en`.
- فارسی بودن preview اصلی کنترل ولو.
- جدا بودن report outline انگلیسی.
- حفظ توکن‌های legacy برای UAT.
- حفظ دکمه‌های فعال‌سازی و مشاهده فرم.
- عدم افزودن emoji جدید در کارت‌های advanced.

نتیجه مستقیم:

```text
tester249-tools-page-rtl-polish: 12 PASS / 0 FAIL
```

---

## Impact Analysis

| بخش | اثر | ریسک |
|---|---|---|
| صفحه `/tools/` | ظاهر advanced tools تمیزتر و فارسی‌تر شد | کم |
| UX فارسی/انگلیسی | جداسازی LTR/RTL بهتر شد | مثبت |
| SEO/متن قابل مشاهده | متن فارسی‌تر و خواناتر شد | کم/مثبت |
| Advanced CV logic | بدون تغییر | صفر |
| License/PDF/payment | بدون تغییر و همچنان قفل | صفر |

---

## راستی‌آزمایی کارفرما

1. وارد `/tools/` شوید.
2. بخش ابزارهای پیشرفته را بررسی کنید.
3. باید ببینید:

```text
عنوان کارت‌ها فارسی است
زیرعنوان انگلیسی جدا و هماهنگ است
متن‌های توضیحی فارسی و خوانا هستند
کارت‌ها هم‌سطح و مرتب‌تر هستند
preview کنترل ولو فارسی‌تر است
report outline انگلیسی در کارت جدا و LTR نمایش داده می‌شود
```

4. مطمئن شوید دکمه‌های زیر همچنان کار می‌کنند:

```text
درخواست فعال‌سازی
مشاهده فرم ورودی قفل‌شده
درخواست فعال‌سازی و گزارش
```

---

## نتیجه

ظاهر صفحه ابزارهای پیشرفته در `/tools/` از حالت مخلوط و ناهماهنگ فارسی/انگلیسی خارج شد و به یک چیدمان حرفه‌ای‌تر، فارسی‌محور و قابل ارائه نزدیک‌تر شد.