# ADV-CV Finalization Backlog — v31.7.80

## هدف
تبدیل ابزار Advanced Control Valve از یک پیش‌نمایش/محاسبه مقدماتی به یک مسیر محصولی قابل گزارش‌دهی، بدون فعال‌سازی پرداخت آنلاین در این فاز.

## تعریف «قابل گزارش‌دهی» در این نسخه
- کاربر دارای لایسنس، داده‌ها را در ابزار وارد می‌کند و draft قفل‌شده گزارش را در سرور ثبت می‌کند.
- ادمین/Chairman در CRM draft را review می‌کند.
- پس از وضعیت `approved_for_final_phase`، final gate اجرا می‌شود.
- اگر gate آماده بود، CRM گزارش نهایی انگلیسی HTML صادر می‌کند.
- برای لایسنس غیرکارمندی، quota گزارش در زمان `Issue final` مصرف می‌شود.
- برای لایسنس `staff_internal`، صدور گزارش بدون مصرف quota پولی انجام می‌شود.
- خروجی final یک HTML انگلیسی immutable و قابل چاپ/Save as PDF در مرورگر است.
- PDF باینری سمت سرور هنوز فعال نیست و برای فاز بعدی نیاز به کتابخانه معتبر PDF مانند Dompdf/wkhtmltopdf دارد.

## User Stories اولویت‌بندی‌شده

| اولویت | User Story | وضعیت v31.7.80 | توضیح |
|---:|---|---|---|
| P0 | به‌عنوان کاربر دارای لایسنس، بتوانم داده کامل ابزار را به سرور به‌صورت draft قفل‌شده ثبت کنم. | انجام شده | `report_draft_create` + checksum |
| P0 | به‌عنوان ادمین، بتوانم draftها را در CRM ببینم و وضعیت review بدهم. | انجام شده | `admin_report_drafts/get/update` |
| P0 | به‌عنوان ادمین، قبل از final report یک readiness gate سخت داشته باشم. | انجام شده | `admin_report_final_gate` |
| P0 | به‌عنوان ادمین، بتوانم quota را قبل از صدور نهایی dry-run کنم. | انجام شده | `admin_report_quota_dry_run` |
| P0 | به‌عنوان ادمین، بتوانم گزارش نهایی شماره‌دار صادر کنم. | انجام شده | `admin_report_final_issue` |
| P0 | به‌عنوان سیستم، گزارش نهایی باید شماره گزارش، checksum و history داشته باشد. | انجام شده | `ADV-CV-FINAL-REPORT-v1` |
| P0 | به‌عنوان سیستم، quota باید فقط در Issue final مصرف شود نه در draft/gate/dry-run. | انجام شده | مصرف در `admin_report_final_issue` |
| P0 | به‌عنوان کارمند شرکت، بتوانم با لایسنس داخلی رایگان گزارش بگیرم. | انجام شده | `staff_internal` → quota exempt |
| P0 | به‌عنوان reviewer، خروجی نهایی باید انگلیسی و شامل جدول/چارت/هشدار/فرمول/محدودیت باشد. | انجام شده | HTML نهایی با چارت SVG داخلی |
| P1 | PDF باینری سمت سرور تولید شود. | باقی‌مانده | نیازمند کتابخانه PDF روی سرور |
| P1 | محاسبات Gas/Steam به IEC/ISA و vendor acoustic final ارتقا یابد. | باقی‌مانده | نیازمند validation/vendor data |
| P1 | انتخاب نهایی برند/مدل actuator/trim با matrix vendor انجام شود. | باقی‌مانده | نیازمند دیتابیس vendor |
| P2 | پرداخت آنلاین و صدور خودکار لایسنس پس از پرداخت فعال شود. | تعمداً عقب افتاده | طبق تصمیم کارفرما بعد از feedback ابزار |

## Sprintهای اجراشده در v31.7.80

1. **ADV-CV-GAS-STEAM-QA-SCENARIOS-001**
   - اضافه شدن سناریوهای Gas/Steam non-choked/choked.
   - QA داخلی اکنون ۸ سناریو را اجرا می‌کند.
2. **ADV-CV-FINAL-REPORT-GATE-OPEN-001**
   - final gate از حالت صرفاً مسدودکننده به gate صدور نهایی تبدیل شد.
3. **ADV-CV-FINAL-REPORT-HTML-001**
   - موتور گزارش نهایی HTML انگلیسی با شماره گزارش، جدول‌ها، چارت‌ها و limitations اضافه شد.
4. **ADV-CV-REPORT-QUOTA-CONSUME-001**
   - مصرف quota واقعی فقط در زمان Issue final فعال شد.
5. **ADV-CV-CRM-FINAL-ISSUE-UI-001**
   - CRM به Issue final، Final report view، دانلود HTML و بازکردن گزارش چاپ‌پذیر مجهز شد.

## محدودیت‌های شفاف
- این نسخه «Final HTML Engineering Screening Report» تولید می‌کند، نه vendor-certified sizing report.
- PDF باینری مستقیم از سرور تولید نمی‌شود؛ خروجی HTML در مرورگر با Print/Save as PDF قابل PDF گرفتن است.
- آنلاین پرداخت فعال نشده است.
- محاسبات Gas/Steam هنوز باید برای نسخه vendor-certified با IEC/ISA و داده سازنده اعتبارسنجی شود.

## تکمیل تکمیلی v31.7.81

### ADV-CV-ENGINEERING-VALIDATION-MATRIX-001
برای نزدیک‌تر شدن گزارش نهایی به استاندارد review مهندسی، یک Engineering Validation Matrix اضافه شد که موارد زیر را قبل از صدور نهایی و داخل final report شفاف می‌کند:

- Gas/Steam compressible service نیازمند vendor confirmation
- Choked / critical flow
- Cavitation / pressure risk
- Noise risk
- Reducer correction / attached fittings
- Line velocity
- Opening / rangeability
- Actuator shell completeness

این ماتریس خروجی را vendor-certified نمی‌کند، اما ریسک‌های مهندسی را در final gate و گزارش نهایی قابل ردیابی می‌کند.


## تکمیل تکمیلی v31.7.82

### ADV-CV-VENDOR-DATA-VALIDATION-001
Vendor Data Validation Matrix برای بررسی brand، series/model، leakage class، rated Cv، FL/Fd/Xt و نیاز به vendor certified sheet به final gate و final report اضافه شد.


## تکمیل تکمیلی v31.7.83

### TOOLS-STAFF-LICENSE-PERSISTENCE-001
Grant پرسنل داخلی اکنون ۳۰ روزه و persistent است و در localStorage بدون ذخیره raw license code نگهداری می‌شود. `staff_internal` در `license_check` نیز quota-exempt شد.

### ADV-CV-SEO-FOUNDATION-001
بخش محتوایی و JSON-LD برای کلیدواژه‌های سایزینگ کنترل ولو، محاسبه Cv/Kv، control valve sizing، Gas/Steam و FAQ در `/tools/` اضافه شد.


## تکمیل تکمیلی v31.7.84

### ADV-CV-DEMO-REPORT-DATASHEET-ASSIST-001
نمونه عمومی گزارش نهایی و Datasheet Assist فاز ۱ اضافه شد. دیتاشیت‌های متنی، TXT، CSV و JSON می‌توانند بخشی از فرم را خودکار پر کنند. PDF/OCR در roadmap فاز بعدی باقی ماند.


## تکمیل تکمیلی v31.7.85

### ADV-CV-DEDICATED-LANDING-SEO-001
صفحه اختصاصی `/tools/control-valve-sizing/` برای کلیدواژه‌های سایزینگ کنترل ولو، محاسبه Cv/Kv، control valve sizing، Liquid/Gas/Steam و نمونه گزارش نهایی اضافه شد. این URL باید بعد از deploy در Google Search Console request indexing شود.


## تکمیل تکمیلی v31.7.86

### TOOLS-FEEDBACK-CRM-INBOX-001
مسیر ثبت feedback عمومی و کارتابل CRM برای پیگیری lead/product feedback اضافه شد. feedback هیچ quota، پرداخت یا لایسنس ایجاد نمی‌کند.


## تکمیل تکمیلی v31.7.87

### ADV-CV-FIRST-SEO-ARTICLE-001
اولین مقاله پشتیبان SEO با عنوان «محاسبه Cv کنترل ولو چیست؟» ساخته شد و به landing page ابزار، نمونه گزارش و فرم feedback لینک داده شد.


## تکمیل تکمیلی v31.7.88

### ADV-CV-CAVITATION-SEO-ARTICLE-001
مقاله پشتیبان SEO درباره کاویتاسیون در کنترل ولو، flashing، ΔP_choked، anti-cavitation trim و vendor-certified sizing sheet ساخته شد و به landing ابزار لینک داده شد.


## تکمیل تکمیلی v31.7.89

### ADV-CV-CV-KV-DIFFERENCE-SEO-ARTICLE-001
مقاله پشتیبان SEO درباره تفاوت Cv و Kv در کنترل ولو ساخته شد. طبق سیاست جدید محتوایی، حداقل ۱۵۰۰ کلمه با UAT enforce شد.


## تکمیل تکمیلی v31.7.90

### ADV-CV-TRIPLE-SEO-ARTICLE-001
سه مقاله ۱۵۰۰+ کلمه‌ای درباره سایزینگ کنترل ولو بخار، سایزینگ کنترل ولو گاز و انتخاب اکچویتور کنترل ولو منتشر شد. لینک‌دهی داخلی، sitemap و UAT حداقل کلمه تکمیل شد.


## تکمیل تکمیلی v31.7.91

### TOOLS-FUNNEL-KPI-DASHBOARD-001
داشبورد KPI قیف ابزار کنترل ولو در CRM اضافه شد تا feedback، rating، sample viewed، contacted/converted، draft reports، final reports و active licenses در یک نگاه دیده شوند.
