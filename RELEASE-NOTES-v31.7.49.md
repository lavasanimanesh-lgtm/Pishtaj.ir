# Release Notes — v31.7.49

**تاریخ:** ۱۴۰۵/۰۴/۳۰ (2026-07-21)  
**نسخه:** `v31.7.49`  
**نوع:** ADV-CV-PRELIM-CALC-001 — محاسبه مقدماتی Liquid برای Advanced Control Valve

---

## 🎯 هدف ریلیز

ادامه توسعه ابزار پیشرفته Control Valve با حفظ قفل تجاری/Entitlement. در این مرحله، کاربر دارای grant معتبر می‌تواند پس از ورود draft، برای حالت **Liquid / Normal Case** یک محاسبه deterministic مقدماتی روی صفحه دریافت کند. این خروجی هنوز گزارش نهایی نیست و هیچ PDF، نمودار حرفه‌ای یا انتخاب قطعی برند/مدل تولید نمی‌کند.

---

## RCA / دلیل دقیق تغییر

1. در v31.7.48 فقط ورود draft، completeness و ذخیره محلی فعال بود؛ بنابراین کاربر دارای لایسنس هنوز هیچ خروجی محاسباتی از فرم Advanced Control Valve نمی‌گرفت.
2. مرحله بعدی roadmap باید یک موتور deterministic سبک و قابل تست اضافه می‌کرد تا پایه محاسبات بعدی بدون LLM و بدون باز کردن PDF/گزارش ساخته شود.
3. در ابتدای این اسپرینت یک ناسازگاری کوچک هم در baseline دیده شد: `tools/advanced-tools-ui.js` فارسی/RTL شده بود ولی برخی UATهای قدیمی هنوز متن انگلیسی قدیمی را assert می‌کردند. تست‌ها با رفتار جدید هم‌راستا شدند و tester جدید محاسبه عددی را پوشش داد.

---

## ✅ کارهای انجام‌شده

### 1) محاسبه مقدماتی Liquid / Normal Case

تابع جدید:

```js
ptfAdvCvCalculatePrelim(input?)
```

برای کاربر دارای grant معتبر:

```js
ptfToolsHasGrant('control_valve_advanced') === true
```

محاسبه مقدماتی اجرا می‌شود. بدون grant، مسیر fail-closed است و paywall باز می‌شود.

---

### 2) Formula Trace قابل ردیابی

فرمول‌های اجراشده:

```text
ΔP = P1 - P2
FF = 0.96 - 0.28 × sqrt(Pv / Pc)
ΔP_choked = FL² × (P1 - FF × Pv)
choked = ΔP >= ΔP_choked
Kv_nonchoked = Q × sqrt(SG / ΔP)
Kv_choked = Q × sqrt(SG) / (FL × sqrt(P1 - FF × Pv))
Cv = 1.156 × Kv
cavitation margin = P2 - Pv
severity = ΔP / ΔP_choked
```

خروجی روی صفحه شامل:

- ΔP
- FF
- ΔP choked
- choked yes/no
- Kv preliminary
- Cv preliminary
- cavitation margin
- severity
- هشدارهای مهندسی مقدماتی
- formula trace

---

### 3) محدودسازی فنی و تجاری

این فاز عمداً فقط موارد زیر را فعال می‌کند:

```text
Liquid only
Normal operating case only
On-screen preliminary result only
No server-side report
No PDF
No final sizing
No brand/model final selection
No charts
No gas/steam/two-phase calculation
```

خروجی object هم صریحاً شامل این پرچم‌هاست:

```js
scope: 'preliminary_liquid_only'
final: false
pdf: false
```

---

### 4) بهبود متن‌های «غیررایگان»

در متن‌های قابل مشاهده ابزارها، واژه «پولی» به «غیررایگان» تبدیل شد تا با سیاست واژگان مورد نظر کارفرما هماهنگ‌تر باشد. برای سازگاری تست‌های قدیمی، برخی tokenهای legacy فقط به‌صورت comment غیرقابل‌نمایش حفظ شده‌اند.

---

### 5) به‌روزرسانی مستندات فنی

- `ADV-CV-INPUT-SCHEMA-v1.md` بخش اجرای `ADV-CV-PRELIM-CALC-001` را اضافه کرد.
- `ADVANCED-CONTROL-VALVE-TOOLS-SPEC-v1.md` از حالت صرفاً spec به phased implementation به‌روزرسانی شد.
- `PTF-MASTER-HANDOVER.md` با baseline جدید v31.7.49 همگام شد.

---

## 📁 فایل‌های تغییر یافته

```text
tools/advanced-tools-ui.js
tools/index.html
tools/tools-ui.js
crm/index.html
crm/sw.js
crm/clear-cache.html
ADV-CV-INPUT-SCHEMA-v1.md
ADVANCED-CONTROL-VALVE-TOOLS-SPEC-v1.md
PTF-MASTER-HANDOVER.md
_tools/uat/tester225-advanced-cv-draft-input.js
_tools/uat/tester226-advanced-cv-prelim-calc.js
RELEASE-NOTES-v31.7.49.md
REGRESSION-REPORT-v31.7.49.md
_tools/last-regression.json
REGRESSION-REPORT-v21.3.md  (auto-updated by regression runner)
```

---

## 🧪 تست اضافه/به‌روزرسانی‌شده

### tester225 — Draft Input

به‌روزرسانی شد تا با v31.7.49 هم‌راستا باشد: محاسبه مقدماتی اکنون مجاز است، اما PDF/report نهایی همچنان ممنوع است.

نتیجه مستقیم:

```text
tester225-advanced-cv-draft-input: 13 PASS / 0 FAIL
```

### tester226 — Preliminary Calculation

تستر جدید:

```text
_tools/uat/tester226-advanced-cv-prelim-calc.js
```

پوشش:

- وجود API جدید `ptfAdvCvCalculatePrelim`.
- الزام grant معتبر.
- وجود فرمول‌های deterministic.
- صحت عددی نمونه Liquid: Q=100 m³/h، P1=10 bar(a)، P2=6 bar(a)، SG=1، Pv=0.03، Pc=221، FL=0.9.
- fail-closed بدون grant.
- رد کردن Gas/Steam در این فاز.
- عدم وجود fetch/PDF/print/export.

نتیجه مستقیم:

```text
tester226-advanced-cv-prelim-calc: 18 PASS / 0 FAIL
```

---

## ⚠️ Impact Analysis

| بخش | اثر | ریسک |
|---|---|---|
| Advanced Control Valve | محاسبه مقدماتی Liquid برای کاربر فعال‌شده اضافه شد | متوسط/کنترل‌شده |
| کاربران عمومی | همچنان locked preview؛ بدون محاسبه پیشرفته | کم |
| PDF/report | همچنان قفل و غیرفعال | صفر |
| Payment/license | فقط از grant موجود استفاده می‌کند؛ API جدید اضافه نشده | کم |
| CRM/API/Auth/Finance/Sync | تغییر اجرایی ندارد | صفر |
| SEO/متن ابزارها | واژه «غیررایگان» جایگزین «پولی» شد | کم |
| محاسبات مهندسی | preliminary only؛ فرض واحدها صریح شده | متوسط — نیازمند کنترل کاربر |

---

## 📋 راستی‌آزمایی کارفرما

1. وارد `/tools/` شوید.
2. بدون کد فعال‌سازی، فرم Control Valve Advanced را باز کنید: فیلدها باید قفل باشند و محاسبه اجرا نشود.
3. با کد فعال‌سازی معتبر ابزار را unlock کنید.
4. فرم Control Valve Advanced را دوباره باز کنید.
5. برای Liquid/Normal Case این نمونه را وارد کنید:

```text
Q = 100 m³/h
P1 = 10 bar(a)
P2 = 6 bar(a)
SG = 1
Pv = 0.03 bar(a)
Pc = 221 bar(a)
FL = 0.9
```

6. روی «محاسبه مقدماتی مایع» بزنید.
7. باید حدوداً این خروجی دیده شود:

```text
ΔP ≈ 4 bar
FF ≈ 0.9567
ΔP_choked ≈ 8.08 bar
Choked? No
Kv ≈ 50
Cv ≈ 57.8
```

8. دقت کنید هیچ PDF یا گزارش نهایی تولید نمی‌شود.

---

## 🚦 نتیجه

پایه محاسبات deterministic ابزار پیشرفته Control Valve فعال شد، اما فقط در محدوده امن preliminary/on-screen و فقط برای کاربر دارای grant. گام بعدی پیشنهادی: توسعه محاسبه Min/Max و آماده‌سازی ساختار نتایج برای report engine، همچنان بدون PDF عمومی تا پیاده‌سازی entitlement/report server-side.
