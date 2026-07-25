# Release Notes — v31.7.71

**تاریخ:** ۱۴۰۵/۰۴/۳۰ (2026-07-21)  
**نسخه:** `v31.7.71`  
**نوع:** ADV-CV-UX-POLISH-001 — بازطراحی بصری و مرتب‌سازی RTL/LTR ابزار Advanced Control Valve

---

## هدف ریلیز

به درخواست کارفرما، ظاهر بخش Advanced Control Valve بازطراحی شد تا شلوغی ناشی از ترکیب کلمات فارسی و انگلیسی، راست‌چین/چپ‌چین و ورودی‌های فنی کاهش پیدا کند و رابط کاربری ابزار حرفه‌ای‌تر، تمیزتر و جذاب‌تر شود.

---

## RCA / دلیل دقیق

1. ابزار Advanced Control Valve به‌سرعت از preview ساده به یک ابزار چندبخشی تبدیل شد.
2. در نتیجه، متن‌های فارسی، اصطلاحات انگلیسی، واحدها، جدول‌ها و گزارش انگلیسی در یک modal کنار هم قرار گرفتند.
3. این موضوع باعث حس شلوغی و ناهمگونی بصری می‌شد، حتی اگر محاسبات درست باشند.
4. چون ابزار قرار است محصول غیررایگان و تخصصی باشد، UI آن باید حس premium و قابل اعتماد داشته باشد.
5. بنابراین بدون تغییر منطق محاسبات و بدون باز کردن PDF، فقط لایه UI/UX و گرافیک modal بازطراحی شد.

---

## کارهای انجام‌شده

### 1) بازطراحی visual shell مودال

به modal پیشرفته اضافه شد:

```text
backdrop blur
پس‌زمینه radial gradient
کارت اصلی با gradient روشن
border و shadow حرفه‌ای‌تر
header تیره و sticky
```

---

### 2) Stepper عددی مینیمال

برای کاهش شلوغی و هدایت کاربر، stepper عددی اضافه شد:

```text
01 ورودی‌ها و داده‌های پروژه
02 محاسبه مایع و ریسک‌ها
03 اکچویتور و گزارش
04 تست داخلی و feedback
```

بدون emoji و مطابق سیاست آیکون‌های مینیمال.

---

### 3) بهبود کنترل RTL/LTR

برای ورودی‌ها و متن‌های فنی:

```text
inputهای عمومی: RTL + unicode-bidi: plaintext
inputهای عددی: LTR + monospace
report outline انگلیسی: lane جداگانه LTR
labelها: RTL و تمیزتر
```

---

### 4) کارت‌بندی سکشن‌ها

سکشن‌ها اکنون کارت‌بندی حرفه‌ای‌تری دارند:

```text
background سفید/ملایم
border نرم
shadow سبک
نشانگر مینیمال در عنوان سکشن
فاصله‌گذاری بهتر
```

---

### 5) Action bar sticky

دکمه‌های عملیاتی پایین فرم sticky شدند تا در modal بلند، کاربر گم نشود.

---

### 6) Report outline انگلیسی جدا شد

بخش ساختار گزارش انگلیسی اکنون در lane چپ‌چین جدا نمایش داده می‌شود تا با متن فارسی قاطی نشود.

---

## مواردی که تغییر نکردند

```text
منطق محاسبات
لایسنس و paywall
قفل PDF و گزارش نهایی
Server draft / review workflow
Quota dry-run
سناریوهای feedback
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
_tools/uat/tester248-advanced-cv-ux-polish.js
RELEASE-NOTES-v31.7.71.md
REGRESSION-REPORT-v31.7.71.md
```

---

## تست اضافه‌شده

```text
_tools/uat/tester248-advanced-cv-ux-polish.js
```

پوشش:

- وجود `ADV-CV-UX-POLISH-001`.
- وجود visual shell جدید.
- وجود header تیره sticky.
- وجود stepper عددی 01..04.
- وجود کلاس‌های RTL/LTR و bidi.
- جدا شدن report outline انگلیسی.
- sticky شدن action bar.
- حفظ دکمه‌های اصلی ابزار.
- عدم وجود PDF/download/print/fetch/export.
- عدم افزودن emoji جدید در stepper/CTA.

نتیجه مستقیم:

```text
tester248-advanced-cv-ux-polish: 12 PASS / 0 FAIL
```

---

## Impact Analysis

| بخش | اثر | ریسک |
|---|---|---|
| Advanced CV modal | ظاهر حرفه‌ای‌تر و خواناتر شد | کم |
| RTL/LTR | جداسازی بهتر فارسی/انگلیسی | مثبت |
| محاسبات | بدون تغییر | صفر |
| PDF/report/payment | همچنان قفل | بدون تغییر |
| تست‌های قبلی | حفظ شدند | کم |

---

## راستی‌آزمایی کارفرما

1. وارد `/tools/` شوید.
2. Advanced Control Valve را با لایسنس unlock کنید.
3. فرم را باز کنید.
4. بررسی کنید:

```text
header تیره و مرتب است
stepper عددی 01..04 دیده می‌شود
سکشن‌ها کارت‌بندی شده‌اند
ورودی‌های عددی چپ‌چین و فنی هستند
متن‌های فارسی راست‌چین و خوانا هستند
report outline انگلیسی قاطی متن فارسی نیست
دکمه‌ها پایین modal sticky هستند
```

---

## نتیجه

این ریلیز منطق ابزار را تغییر نداد، اما ظاهر بخش Advanced Control Valve را به سطح حرفه‌ای‌تری رساند تا برای محصول غیررایگان و feedback مهندسی قابل ارائه‌تر باشد.