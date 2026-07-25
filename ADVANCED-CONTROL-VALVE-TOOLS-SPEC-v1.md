# Advanced Control Valve Tools — Product & Technical Specification v1

**تاریخ:** ۱۴۰۵/۰۴/۳۰ — 2026-07-21  
**وضعیت:** Specification + phased implementation — v31.7.49 includes licensed preliminary liquid calculation  
**دامنه:** ابزار پیشرفته و غیررایگان سایزینگ Control Valve + مدل paywall + مسیر گزارش کامل  
**تصمیم‌های تاییدشده توسط کارفرما:**  
- مدل درآمدی: **Hybrid** — پرداخت تک‌گزارش + اشتراک/لایسنس سازمانی  
- فاز اول پرداخت: **دستی / فاکتور / فعال‌سازی لایسنس**  
- اولین ابزار پیشرفته: **Control Valve Sizing**  
- موتور تولید مقاله خودکار: **فعلاً اجرا نشود**  

---

## 1) هدف محصول

هدف این ماژول تبدیل بخش ابزارهای سایت از چند محاسبه رایگان ساده به یک **محصول مهندسی غیررایگان و قابل گزارش** است؛ به‌گونه‌ای که کاربر عمومی بتواند یک preview محدود بگیرد، اما برای خروجی حرفه‌ای، PDF، نمودار، تحلیل جزئی، انتخاب برند/مدل و گزارش قابل استفاده در پروژه، پرداخت یا لایسنس لازم باشد.

چشم‌انداز نهایی:

```text
کاربر فنی / EPC / خریدار
→ ورود داده‌های فرآیندی دقیق
→ محاسبه deterministic کنترل ولو
→ تحلیل engineering warnings
→ پیشنهاد خانواده/برند/مدل بر اساس داده vendor-approved
→ نمودارها و operating envelope
→ گزارش PDF/DOCX غیررایگان با شماره گزارش
→ امکان تبدیل مستقیم به RFQ واقعی در CRM
```

---

## 2) اصل حاکم معماری

### 2.1 LLM نباید محاسبه مهندسی انجام دهد

محاسبات کنترل ولو باید توسط **موتور deterministic** انجام شود، نه LLM.

LLM در آینده فقط می‌تواند برای این موارد استفاده شود:

- توضیح متنی نتیجه به زبان ساده‌تر
- کمک به تکمیل checklist ورودی‌ها
- تولید draft narrative برای گزارش
- پیشنهاد سوال‌های تکمیلی از کاربر

اما LLM نباید:

- Cv/Kv نهایی حساب کند
- مقدار فرضی بسازد
- برند/مدل قطعی پیشنهاد دهد بدون داده vendor
- PDF نهایی را بدون داده محاسباتی قابل trace تولید کند

---

## 3) تفکیک ابزار رایگان و ابزار غیررایگان

## 3.1 ابزار رایگان فعلی / Free Tier

هدف: جذب lead و کمک اولیه، نه ارائه گزارش مهندسی کامل.

قابلیت‌ها:

- ورودی‌های محدود
- محاسبه ساده Cv/Kv
- نمایش نتیجه روی صفحه
- هشدارهای پایه
- CTA به RFQ

محدودیت‌های لازم از این مرحله به بعد:

| قابلیت | Free |
|---|---|
| محاسبه ساده | ✅ |
| نمایش Cv/Kv پایه | ✅ |
| هشدار عمومی | ✅ |
| ذخیره محاسبه | ❌ |
| PDF / Print report | ❌ |
| نمودار حرفه‌ای | ❌ |
| انتخاب برند/مدل | ❌ |
| تحلیل cavitation/noise کامل | ❌ |
| actuator sizing کامل | ❌ |
| report number | ❌ |
| export DOCX/PDF | ❌ |

**قاعده:** ابزار رایگان نباید PDF یا گزارش قابل چاپ حرفه‌ای تولید کند. اگر کاربر روی خروجی PDF کلیک کند، باید وارد paywall شود.

---

## 3.2 ابزار پیشرفته غیررایگان / Non-free Advanced Tool

قابلیت‌ها:

| قابلیت | Paid |
|---|---|
| liquid/gas/steam advanced sizing | ✅ |
| min/normal/max operating cases | ✅ |
| choked flow check | ✅ |
| cavitation/flashing check | ✅ |
| velocity checks | ✅ |
| preliminary noise check | ✅ |
| trim / characteristic recommendation | ✅ |
| actuator sizing shell | ✅ |
| انتخاب برند/سری/مدل بر اساس دیتابیس vendor | ✅ |
| charts | ✅ |
| PDF report | ✅ |
| report number | ✅ |
| ذخیره run history | ✅ |
| تبدیل به RFQ | ✅ |
| سازمان/اشتراک | ✅ |

---

## 4) مدل درآمدی و دسترسی

## 4.1 مدل Hybrid

دو نوع دسترسی پیشنهاد می‌شود:

### A) پرداخت تک‌گزارش

کاربر برای هر گزارش کامل پرداخت می‌کند.

```text
Control Valve Advanced Report — single run/report
```

خروجی:

- یک گزارش PDF
- یک report number
- لینک دانلود محدود
- امکان تبدیل همان run به RFQ

### B) اشتراک / لایسنس سازمانی

برای شرکت‌ها یا کاربران تکرارشونده:

```text
Monthly / Quarterly / Enterprise license
```

سطوح پیشنهادی:

| سطح | امکانات |
|---|---|
| Basic | تعداد محدود گزارش در ماه |
| Pro | گزارش بیشتر + charts + vendor comparison |
| Enterprise | چند کاربر + history + export + support |

---

## 4.2 فاز اول پرداخت دستی / Manual Invoice

برای کاهش ریسک فنی، فاز اول بدون اتصال درگاه شروع شود.

جریان پیشنهادی:

```text
کاربر محاسبه پیشرفته را شروع می‌کند
→ سیستم preview محدود نشان می‌دهد
→ برای گزارش کامل، فرم درخواست فعال‌سازی نمایش داده می‌شود
→ کاربر نام، شرکت، موبایل، ایمیل، نوع گزارش را ارسال می‌کند
→ واحد فروش/ادمین فاکتور یا لینک پرداخت دستی می‌دهد
→ پس از پرداخت، ادمین license / unlock code صادر می‌کند
→ کاربر کد را وارد می‌کند و گزارش کامل را می‌گیرد
```

مزیت:

- بدون ریسک درگاه پرداخت در شروع
- مناسب فروش B2B
- امکان مذاکره قیمت با شرکت‌ها
- امکان کنترل abuse

---

## 5) معماری فنی پیشنهادی

## 5.1 لایه‌ها

### 5.1.1 فاز اجراشده v31.7.49 — محاسبه مقدماتی Liquid

در این فاز، فقط برای کاربر دارای grant معتبر، محاسبه deterministic مقدماتی برای Liquid/Normal Case فعال شده است. خروجی صرفاً روی صفحه است و موارد زیر همچنان قفل می‌مانند:

- گزارش نهایی انگلیسی
- PDF / DOCX
- نمودارهای حرفه‌ای
- انتخاب قطعی برند/مدل
- ذخیره server-side report
- gas/steam/two-phase sizing

فرمول‌های اجراشده همان trace پایه `ADV-CV-PRELIM-CALC-001` هستند: ΔP، FF، ΔP_choked، choked branch، Kv، Cv، cavitation margin و severity.


```text
Public Tools UI
  ├── Free Calculator UI
  ├── Advanced Calculator UI Locked
  ├── Paywall / License Input
  └── RFQ Conversion CTA

Server APIs
  ├── license_check
  ├── advanced_cv_run
  ├── advanced_report_create
  ├── report_download
  └── admin_license_issue

Data Layer
  ├── tool licenses
  ├── tool runs
  ├── report metadata
  ├── payment/manual invoice status
  └── audit log

Storage Layer
  ├── generated reports PDF/DOCX
  └── optional user input snapshots
```

---

## 5.2 چرا محاسبه غیررایگان نباید فقط client-side باشد؟

اگر ابزار پیشرفته و PDF فقط در JavaScript کلاینت باشد، کاربر می‌تواند:

- JS را inspect کند
- paywall را bypass کند
- report را با دستکاری DOM چاپ کند
- license check را دور بزند

بنابراین:

```text
Free preview می‌تواند client-side باشد.
Paid full calculation/report باید server-authoritative باشد.
```

---

## 5.3 API پیشنهادی

فایل پیشنهادی آینده:

```text
api/tools.php
```

Actions:

```text
action=license_check
action=cv_preview
action=cv_advanced_run
action=report_create
action=report_download
action=admin_license_issue
```

### Public actions محدود

```text
cv_preview
license_check
```

### Protected actions

```text
cv_advanced_run
report_create
report_download
admin_license_issue
```

حتی اگر کاربر public باشد، برای protected actions باید license token معتبر داشته باشد.

---

## 6) مدل داده پیشنهادی

در فاز flat-file فعلی:

```text
crm/data/tools/licenses.json
crm/data/tools/runs.json
crm/data/tools/reports.json
crm/data/tools/audit.json
```

یا برای سازگاری با ساختار فعلی:

```text
crm/data/tool_licenses.json
crm/data/tool_runs.json
crm/data/tool_reports.json
crm/data/tool_audit.json
```

### License object

```json
{
  "licenseId": "LIC-CV-1405-0001",
  "type": "single_report | subscription | enterprise",
  "status": "active | used | expired | revoked",
  "issuedTo": {
    "name": "",
    "company": "",
    "mobileHash": "",
    "emailHash": ""
  },
  "tool": "control_valve_advanced",
  "maxRuns": 3,
  "maxReports": 1,
  "usedRuns": 0,
  "usedReports": 0,
  "expiresAt": "2026-08-21T00:00:00+03:30",
  "createdBy": "admin",
  "createdAt": "...",
  "tokenHash": "..."
}
```

### Run object

```json
{
  "runId": "CVRUN-1405-0001",
  "licenseId": "LIC-CV-1405-0001",
  "tool": "control_valve_advanced",
  "version": "PTF-CV-ADV-v1",
  "inputs": {},
  "normalizedInputs": {},
  "outputs": {},
  "warnings": [],
  "charts": [],
  "formulas": [],
  "createdAt": "...",
  "clientIpHash": "...",
  "status": "draft | report_created | rfq_converted"
}
```

### Report object

```json
{
  "reportId": "PTF-CVR-1405-0001",
  "runId": "CVRUN-1405-0001",
  "licenseId": "LIC-CV-1405-0001",
  "pdfKey": "tools/reports/2026-07/PTF-CVR-1405-0001.pdf",
  "docxKey": "",
  "createdAt": "...",
  "downloadExpiresAt": "...",
  "downloadCount": 0,
  "checksum": "sha256..."
}
```

---

## 7) ورودی‌های ابزار پیشرفته Control Valve

## 7.1 General

```text
Project / RFQ title
Company name
Tag number
Service description
Valve quantity
Unit system
Calculation case: min / normal / max
Fluid type: liquid / gas / steam / two-phase flag
```

## 7.2 Process data

### Liquid

```text
Flow min/normal/max
Flow unit: m3/h, l/min, kg/h
P1 upstream pressure
P2 downstream pressure
Pressure unit: bara/barg/kPa/psi
Temperature
Density or specific gravity
Viscosity
Vapor pressure Pv
Critical pressure Pc
Fluid name
```

### Gas / Steam

```text
Molecular weight
Compressibility Z
Specific heat ratio k
Inlet temperature
Flow basis: actual/standard
Steam condition: saturated/superheated
```

## 7.3 Piping and installation

```text
Inlet pipe size
Outlet pipe size
Pipe schedule / ID
Reducer/expander present
Allowable velocity limit
Installed orientation
```

## 7.4 Valve construction

```text
Valve type: globe / rotary / ball segment / butterfly
Body size candidate
Pressure class
End connection
Body material
Trim material
Flow direction
Characteristic: linear / equal percentage / quick opening
Rangeability
Leakage class
Seat type
```

## 7.5 Vendor / Brand selection

فاز اول نباید ادعای مدل قطعی بدون دیتای vendor کند. باید vendor database داشته باشیم.

برندهای قابل پشتیبانی پیشنهادی:

```text
Fisher / Emerson
Samson
Masoneilan / Baker Hughes
Flowserve Valtek
Spirax Sarco
Koso
Metso / Neles
ARCA
```

برای هر برند باید داده زیر ثبت شود:

```json
{
  "brand": "Fisher",
  "series": "ET",
  "valveType": "globe",
  "sizeRange": ["1", "1.5", "2", "3", "4"],
  "classRange": [150, 300, 600],
  "cvTable": [],
  "flTable": [],
  "xtTable": [],
  "characteristics": ["linear", "equal_percentage"],
  "notes": "vendor-data-required"
}
```

تا وقتی جدول vendor واقعی وارد نشده، خروجی باید بگوید:

```text
Recommended family / candidate brand only — exact model requires vendor data confirmation.
```

---

## 8) محاسبات و خروجی‌ها

## 8.1 خروجی‌های اصلی

```text
Cv required min/normal/max
Kv required min/normal/max
Selected Cv
Valve opening percent min/normal/max
Recommended valve size
Recommended characteristic
Choked flow status
Cavitation / flashing risk
Pressure recovery warning
Velocity inlet/outlet/port
Preliminary noise warning
Trim recommendation
Actuator required force / torque shell
Fail action check
```

## 8.2 Warnings

```text
P2 <= Pv → flashing risk
High pressure drop ratio
Valve opening too low/high
Oversized valve
High velocity
Missing vapor pressure
Missing Pc
Missing viscosity
Brand model not verified
Noise check incomplete
Actuator data incomplete
```

## 8.3 Formula trace

گزارش باید تمام formulas را ذخیره کند:

```json
{
  "key": "Cv_required",
  "formula": "Cv = ...",
  "inputs": {"Q": 100, "SG": 1, "dP": 2.5},
  "output": 73.2,
  "unit": "Cv",
  "standardBasis": "IEC 60534 / ISA-style internal adapter"
}
```

---

## 9) نمودارهای ابزار پیشرفته

PDF غیررایگان باید شامل نمودارهای زیر باشد:

1. **Flow vs Required Cv**
2. **Valve Opening % across min/normal/max**
3. **Pressure Drop / Choked Threshold**
4. **Cavitation / Flashing Risk Indicator**
5. **Operating Envelope**
6. **Candidate Brand/Series Comparison** — فقط وقتی vendor data موجود باشد
7. **Actuator Force Margin** — وقتی actuator data کامل باشد

در فاز اول می‌توان نمودارها را با SVG داخلی ساخت تا وابستگی خارجی نداشته باشد.

---

## 10) گزارش PDF غیررایگان

## 10.1 ساختار گزارش

```text
Cover
Report metadata
Input summary
Process data table
Sizing basis
Calculation results min/normal/max
Formula trace
Warnings and engineering notes
Cavitation/flashing analysis
Velocity checks
Brand/model candidate table
Charts
Assumptions and missing data
Disclaimer
PTF contact / RFQ CTA
```

## 10.2 شماره گزارش

```text
PTF-CVR-1405-0001
```

## 10.3 Watermark

برای گزارش preview یا unpaid:

```text
PREVIEW — NOT FOR ENGINEERING USE
```

برای paid:

```text
PAID ENGINEERING CALCULATION REPORT
```

ولی حتی paid هم باید disclaimer داشته باشد:

```text
This report is an engineering sizing aid. Final selection must be verified against vendor certified data and project specifications.
```

---

## 11) Paywall و جلوگیری از دور زدن

## 11.1 Free tier

- نتیجه روی صفحه
- بدون PDF
- اگر کاربر PDF بزند:

```text
برای دریافت گزارش کامل PDF، درخواست فعال‌سازی ارسال کنید.
```

## 11.2 Paid tier

- license token لازم است
- token سمت سرور hash می‌شود
- full report فقط بعد از check موفق ساخته می‌شود
- download link محدود و زمان‌دار است

## 11.3 امنیت

- License token در query string طولانی‌مدت قرار نگیرد.
- Token خام ذخیره نشود؛ hash ذخیره شود.
- Rate-limit روی license_check و report_create.
- IP hash برای abuse detection.
- Report download با signed token کوتاه‌مدت.
- Full report data قبل از entitlement به client ارسال نشود.

---

## 12) UI پیشنهادی

## 12.1 صفحه Tools فعلی

بخش رایگان حفظ شود ولی متن تغییر کند:

```text
ابزارهای رایگان — نتایج اولیه و بدون PDF
```

PDF button رایگان باید به paywall تبدیل شود.

## 12.2 بخش جدید

```text
ابزارهای پیشرفته مهندسی — غیررایگان
```

Card اول:

```text
Advanced Control Valve Sizing
- Liquid / Gas / Steam
- Cv/Kv advanced
- Cavitation / Flashing
- Brand candidate
- Charts
- PDF report
[درخواست فعال‌سازی] [ورود کد لایسنس]
```

---

## 13) مسیر تبدیل به RFQ

بعد از report:

```text
Create RFQ from this calculation
```

باید اطلاعات زیر به RFQ منتقل شود:

```text
Tag number
Fluid
Flow cases
Pressure cases
Temperature
Cv required
Recommended valve family
Warnings
Generated report ID
```

---

## 14) تست‌های لازم در پیاده‌سازی

### Functional

```text
free tool no PDF
paid license unlock
invalid license rejected
expired license rejected
single report license consumed once
subscription license usage count works
report ID unique
```

### Calculation

```text
liquid normal case
liquid choked case
gas case
steam case
missing Pv/Pc warning
velocity warning
actuator incomplete warning
unit conversion tests
```

### Security

```text
report_create without license → 403
report_download expired token → 403
license_check rate-limit
no raw license token stored
no full report in free response
```

### Regression

```text
existing free tools still work
RFQ link still works
metrics still work
sitemap unchanged
```

---

## 15) مراحل پیاده‌سازی پیشنهادی

## Phase A — سبک / کم‌ریسک

```text
A1. تغییر متن ابزار رایگان: بدون PDF رایگان
A2. مخفی/قفل کردن PDF button پشت paywall
A3. اضافه کردن UI کارت Advanced Control Valve
A4. فرم درخواست فعال‌سازی دستی
A5. تست UAT برای no-free-PDF
```

زمان تخمینی: 1 تا 2 روز

## Phase B — License دستی

```text
B1. api/tools.php
B2. tool_licenses.json
B3. license_check
B4. admin/manual license seed file
B5. unlock advanced form
```

زمان تخمینی: 3 تا 5 روز

## Phase C — Advanced deterministic engine v1

```text
C1. input schema
C2. unit conversion
C3. liquid service advanced
C4. min/normal/max cases
C5. warnings
C6. formula trace
```

زمان تخمینی: 1 تا 2 هفته

## Phase D — Report engine

```text
D1. report HTML template
D2. SVG charts
D3. PDF/print controlled output
D4. report number
D5. download gating
```

زمان تخمینی: 1 هفته

## Phase E — Vendor data

```text
E1. vendor data schema
E2. manual data entry for 2-3 brands
E3. brand candidate comparison
E4. disclaimer and confidence level
```

زمان تخمینی: وابسته به داده vendor

---

## 16) موتور تولید مقاله خودکار — پاسخ فنی

امکان طراحی موتور خودکار تولید مقاله وجود دارد، اما **فعلاً توصیه به auto-publish نمی‌شود**.

معماری صحیح آینده:

```text
Topic planner
→ keyword clustering
→ article outline
→ draft generation
→ source/evidence checklist
→ SEO validation
→ technical review
→ human approval
→ publish to knowledge-center
```

قواعد اجباری:

- انتشار خودکار مستقیم ممنوع
- هر مقاله باید human-reviewed باشد
- LLM نباید ادعای استانداردی بدون منبع بسازد
- مقاله باید unique و عمیق باشد، نه template تکراری
- باید تست duplicate/thin content داشته باشد

با توجه به تصمیم فعلی کارفرما:

```text
فعلاً موتور تولید مقاله اجرا نمی‌شود؛ ابتدا مقالات مهم موجود عمیق‌تر شوند.
```

---

## 17) پیشنهاد گام بعدی پس از این Spec

برای Sprint بعدی سبک:

```text
ADV-TOOLS-FREE-GATE-001
```

Scope محدود:

1. متن صفحه ابزارها از «رایگان با PDF» به «رایگان بدون PDF» اصلاح شود.
2. دکمه PDF ابزار رایگان به paywall/درخواست فعال‌سازی تبدیل شود.
3. کارت Advanced Control Valve اضافه شود.
4. هیچ API پرداختی هنوز پیاده‌سازی نشود.
5. تست UAT اضافه شود که PDF رایگان تولید نمی‌شود.

این گام کم‌ریسک است و پایه درآمدزایی را بدون درگیر شدن با محاسبات سنگین می‌سازد.
