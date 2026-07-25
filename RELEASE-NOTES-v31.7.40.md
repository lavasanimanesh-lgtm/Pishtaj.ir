# Release Notes — v31.7.40

**تاریخ:** ۱۴۰۵/۰۴/۳۰ (2026-07-21)  
**نسخه:** `v31.7.40`  
**نوع:** 🟢 ADV-TOOLS-CATALOG-001 — کاتالوگ قفل‌شده ابزارهای پیشرفته

---

## 🎯 هدف ریلیز

ادامه توسعه ابزارهای پیشرفته بدون باز کردن دسترسی عمومی و بدون پیاده‌سازی سنگین محاسبات نهایی. این ریلیز ابزارهای پیشرفته را به‌صورت roadmap/preview قفل‌شده در صفحه Tools نمایش می‌دهد و سیاست استفاده رایگان پرسنل شرکت با کد داخلی را ثبت می‌کند.

---

## ✅ کارهای انجام‌شده

### 1) کاتالوگ ابزارهای پیشرفته در `/tools/`

بخش جدید اضافه شد:

```text
Advanced Engineering Tools — Locked Preview
```

خانواده‌های ابزار:

```text
Control Valve Advanced
Piping Advanced
Pump Selection
Flow Meter / Orifice
Electrical Engineering
Instrumentation
```

همه این ابزارها فعلاً visible but locked هستند؛ یعنی برای کاربر قابل مشاهده‌اند ولی استفاده کامل/گزارش کامل نیازمند فعال‌سازی است.

---

### 2) Preview جزئی‌تر برای Advanced Control Valve

بخش Control Valve پیشرفته گسترش یافت و اکنون به این موارد اشاره می‌کند:

```text
Process Cases
Fluid Properties
Valve Data
Brand Library
Fisher / Samson / Masoneilan / Flowserve / Neles
English Standard Report
Calculation Tables + Formula Trace
Paid PDF report with report number
```

این هنوز محاسبه پیشرفته اجرا نمی‌کند؛ فقط preview قفل‌شده و مسیر محصول است.

---

### 3) استفاده رایگان پرسنل شرکت

در UI و نمونه لایسنس مشخص شد که پرسنل شرکت می‌توانند با کد داخلی رایگان وارد شوند.

در `api/tool-licenses.sample.json` نمونه زیر اضافه شد:

```text
LIC-PTF-STAFF-SAMPLE
type: staff_internal
tool: all
maxReports: 9999
```

---

### 4) سند کاتالوگ ابزارهای پیشرفته

فایل جدید:

```text
ADVANCED-TOOLS-CATALOG-SPEC-v1.md
```

این سند خانواده‌های ابزار آینده، scope هر حوزه، استاندارد گزارش انگلیسی و قاعده lock/unlock را مشخص می‌کند.

---

## 🧪 تست اضافه‌شده

### `_tools/uat/tester217-advanced-tools-catalog-preview.js`

پوشش:

- وجود catalog ابزارهای پیشرفته.
- وجود خانواده‌های Control Valve, Piping, Pump, Flowmeter, Electrical, Instrumentation.
- locked/planned بودن ابزارها.
- ذکر استفاده رایگان پرسنل با کد داخلی.
- وجود detail preview برای Control Valve.
- ذکر برندهای نمونه.
- ذکر English Standard Report و Paid PDF report.
- وجود نمونه staff_internal license.
- وجود spec رسمی کاتالوگ.

نتیجه مستقیم:

```text
tester217-advanced-tools-catalog-preview: 9 PASS / 0 FAIL
```

---

## ⚠️ Impact Analysis

| بخش | اثر | ریسک |
|---|---|---|
| `/tools/` | نمایش کاتالوگ ابزارهای پیشرفته قفل‌شده | کم |
| ابزارهای رایگان | دست‌نخورده؛ محاسبه اولیه باقی است | کم |
| License API | فقط نمونه staff license اضافه شد | کم |
| Payment/Gateway | هنوز اضافه نشده | صفر |
| CRM/Auth/Finance/Sync | دست‌نخورده | صفر |
| SEO | متن tools کمی غنی‌تر شد | کم |

---

## 📋 راستی‌آزمایی کارفرما

1. صفحه `/tools/` را باز کنید.
2. بخش `Advanced Engineering Tools — Locked Preview` را ببینید.
3. خانواده‌های ابزار باید نمایش داده شوند.
4. Advanced Control Valve باید جزئیات ورودی‌ها، برندها و گزارش انگلیسی استاندارد را نشان دهد.
5. هیچ ابزار پیشرفته‌ای نباید برای عموم اجرا شود؛ فقط درخواست فعال‌سازی یا paywall دیده شود.

---

## 🚦 نتیجه

ابزارهای پیشرفته اکنون به‌صورت roadmap تجاری/فنی در سایت قابل مشاهده‌اند، اما تا زمان فعال‌سازی/درگاه قفل هستند. این گام پایه توسعه مرحله‌ای Control Valve Advanced و ابزارهای بعدی را آماده کرد.
