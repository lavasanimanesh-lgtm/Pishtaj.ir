# Release Notes — v31.7.93

## عنوان ریلیز
**ADV-CV-RICH-SAMPLE-BRAND-MATRIX-001**

## RCA / دلیل دقیق
کارفرما گزارش داد نمونه گزارش عمومی بسیار کوتاه است و برای جلب اعتماد مخاطب کافی نیست. همچنین پرسیده شد آیا خروجی واقعی گزارش همین‌قدر کوتاه است و آیا نمودار ندارد. بررسی نشان داد گزارش واقعی CRM در نسخه‌های قبل شامل چارت SVG برای Cv و Opening بوده، اما نمونه عمومی کوتاه و کم‌اثر بود. بنابراین در این نسخه نمونه گزارش عمومی به ساختاری نزدیک‌تر به گزارش واقعی ارتقا یافت و Brand / Series Candidate Matrix با لینک رسمی برندها به گزارش نهایی و نمونه گزارش اضافه شد.

## پاسخ شفاف محصول
- خروجی واقعی نهایی همان نمونه کوتاه قبلی نبود.
- گزارش واقعی Final HTML دارای جدول‌های کامل، نمودارهای SVG، formula trace، Engineering Validation Matrix و Vendor Data Validation Matrix بود.
- مشکل اصلی فقط این بود که **نمونه عمومی** کوتاه و کم‌اعتماد بود.

## تغییرات اصلی

### 1) نمونه گزارش عمومی غنی‌تر شد
تابع زیر بازنویسی شد:

```js
ptfAdvCvBuildPublicSampleFinalReportHtml()
```

نمونه گزارش اکنون شامل موارد زیر است:

- Project and Tag Data
- Design Basis
- Min / Normal / Max Calculation Results
- نمودار SVG برای Cv by operating case
- نمودار SVG برای Estimated opening by case
- Governing Result and Risk Summary
- Actuator Sizing Shell
- Brand / Series Candidate Matrix
- Engineering Validation Matrix
- Vendor Data Validation Matrix
- Formula Trace and Limitations

### 2) Brand / Series Candidate Matrix در گزارش نهایی واقعی
در `api/tools.php` اضافه شد:

```php
tools_brand_candidate_matrix($payload)
tools_brand_candidate_rows_html($matrix)
```

گزارش نهایی CRM اکنون بخش زیر را دارد:

```text
Brand / Series Candidate Matrix
```

### 3) برندها و مدل‌های نمونه
Matrix شامل candidate example برای برندها و خانواده‌های زیر است:

- Fisher / Emerson — easy-e ET/EZ, Cavitrol, Whisper trim, Vee-Ball, Control-Disk
- SAMSON — Type 3241 / 3251
- Baker Hughes Masoneilan — 21000 / 41005
- Flowserve / Valtek — Mark One
- Valmet / Neles — control valve packages

### 4) لینک رسمی برندها
برای هر برند، لینک رسمی vendor اضافه شد. این لینک‌ها برای اعتمادسازی و research کاربر هستند، نه به معنی تأیید یا نمایندگی رسمی.

### 5) محدودیت شفاف
Matrix فقط candidate example است و جای vendor-certified sizing sheet را نمی‌گیرد. انتخاب نهایی مدل باید با specification پروژه و vendor-certified sizing انجام شود.

## فایل‌های تغییرکرده

```text
api/tools.php
tools/advanced-tools-ui.js
crm/index.html
crm/sw.js
crm/clear-cache.html
_tools/uat/tester270-advanced-cv-rich-sample-report.js
_tools/uat/tester271-advanced-cv-brand-model-matrix-report.js
PTF-MASTER-HANDOVER.md
```

## تست
- تست rich sample report اضافه شد.
- تست brand/model candidate matrix اضافه شد.
- regression کامل و audit قبل از ZIP اجرا می‌شود.
