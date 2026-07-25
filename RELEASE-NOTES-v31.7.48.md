# Release Notes — v31.7.48

**تاریخ:** ۱۴۰۵/۰۴/۳۰ (2026-07-21)  
**نسخه:** `v31.7.48`  
**نوع:** 🟢 ADV-CV-DRAFT-INPUT-001 — ورود Draft داده‌های Control Valve برای کاربر دارای لایسنس

---

## 🎯 هدف ریلیز

ادامه توسعه ابزار پیشرفته Control Valve بدون باز کردن محاسبه نهایی برای عموم. در این مرحله، فرم ورودی پیشرفته فقط برای کاربر دارای grant/language فعال می‌شود تا بتواند داده‌ها را به‌صورت draft وارد کند، completeness را ببیند و draft را محلی ذخیره کند.

---

## ✅ کارهای انجام‌شده

### 1) Draft input mode برای کاربر فعال‌شده

در `tools/advanced-tools-ui.js` اگر کاربر grant معتبر داشته باشد:

```js
ptfToolsHasGrant('control_valve_advanced') === true
```

فیلدهای فرم قفل‌شده به حالت قابل ورود تبدیل می‌شوند.

اگر grant وجود نداشته باشد، همان locked preview باقی می‌ماند.

---

### 2) جمع‌آوری داده‌های draft

تابع جدید:

```js
ptfAdvCvCollectDraft()
```

این تابع همه ورودی‌های فرم Control Valve Advanced را جمع می‌کند و object draft می‌سازد.

---

### 3) چک کامل بودن داده‌ها

تابع جدید:

```js
ptfAdvCvCheckCompleteness()
```

این تابع بر اساس phase سیال، فیلدهای اجباری را بررسی می‌کند.

برای Liquid:

```text
Project
Tag
Service
Normal Flow
Normal P1/P2/Temp
Fluid phase
Fluid name
FL
SG / density
Pv
Pc
Viscosity
```

برای Gas/Steam:

```text
Project
Tag
Service
Normal Flow
Normal P1/P2/Temp
Fluid phase
Fluid name
FL
MW
Z
k
Xt
```

خروجی:

```text
Completeness score
Missing data list
```

---

### 4) ذخیره draft محلی

تابع جدید:

```js
ptfAdvCvSaveDraft()
```

برای کاربر دارای grant، draft در localStorage ذخیره می‌شود:

```text
ptf_adv_cv_drafts
```

این مرحله هنوز server-side نیست و هیچ گزارش نهایی تولید نمی‌کند.

---

## 🔒 محدوده قفل فعلی

در این ریلیز همچنان موارد زیر فعال نیستند:

```text
محاسبه نهایی Cv/Kv
انتخاب برند/مدل
نمودارها
گزارش PDF
گزارش انگلیسی نهایی
ذخیره server-side report
```

این فاز فقط draft input و completeness است.

---

## 📁 فایل‌های تغییر یافته

```text
tools/advanced-tools-ui.js
crm/index.html
crm/sw.js
crm/clear-cache.html
PTF-MASTER-HANDOVER.md
_tools/uat/tester225-advanced-cv-draft-input.js
RELEASE-NOTES-v31.7.48.md
REGRESSION-REPORT-v31.7.48.md
```

---

## 🧪 تست اضافه‌شده

### `_tools/uat/tester225-advanced-cv-draft-input.js`

پوشش:

- وجود draft key و version.
- خواندن وضعیت unlock از `ptfToolsHasGrant`.
- conditional disabled بودن فیلدها.
- وجود `ptfAdvCvCollectDraft`, `ptfAdvCvCheckCompleteness`, `ptfAdvCvSaveDraft`.
- ذخیره draft در localStorage نه سرور.
- قواعد completeness برای Liquid و Gas/Steam.
- عدم فراخوانی محاسبه نهایی یا PDF.
- حفظ دکمه ورود به فرم قفل‌شده.

نتیجه مستقیم:

```text
tester225-advanced-cv-draft-input: 13 PASS / 0 FAIL
```

---

## ⚠️ Impact Analysis

| بخش | اثر | ریسک |
|---|---|---|
| Advanced CV modal | برای grant معتبر قابل ورود draft شد | کم/متوسط |
| Public users | همچنان locked preview | کم |
| localStorage | کلید draft محلی اضافه شد | کم |
| محاسبات/PDF | هنوز فعال نیست | صفر |
| API/CRM/Auth/Finance/Sync | دست‌نخورده | صفر |

---

## 📋 راستی‌آزمایی کارفرما

1. بدون کد فعال‌سازی وارد `/tools/` شوید.
2. فرم ورودی قفل‌شده را باز کنید؛ فیلدها باید disabled باشند.
3. با کد فعال‌سازی معتبر، paywall را unlock کنید.
4. دوباره فرم ورودی را باز کنید؛ فیلدها باید قابل ورود باشند.
5. چند فیلد را پر کنید.
6. روی `Check completeness` بزنید.
7. باید درصد کامل بودن و missing fields دیده شود.
8. روی `Save draft locally` بزنید.
9. draft باید در همین مرورگر ذخیره شود.

---

## 🚦 نتیجه

مرحله ورود draft داده‌های Control Valve Advanced برای کاربران فعال‌شده آماده شد. گام بعدی می‌تواند اجرای محاسبه deterministic اولیه فقط روی همین draft باشد، اما هنوز بدون PDF نهایی.
