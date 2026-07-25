# Release Notes — v31.7.82

## عنوان ریلیز
**ADV-CV-VENDOR-DATA-VALIDATION-001**

## RCA / دلیل دقیق
در v31.7.81 ماتریس validation مهندسی به گزارش نهایی اضافه شد، اما هنوز داده‌های vendor مانند برند، سری/مدل، rated Cv، FL، Xt و leakage به‌صورت جداگانه و قابل ردیابی در final gate و گزارش نهایی validate نمی‌شدند. برای نزدیک‌تر شدن گزارش به مسیر انتخاب واقعی کنترل ولو، Vendor Data Validation Matrix اضافه شد.

## تغییرات اصلی

### 1) Vendor Data Validation در API
تابع جدید:

```php
tools_build_vendor_validation($payload)
```

schema جدید:

```text
ADV-CV-VENDOR-VALIDATION-v1
```

وضعیت‌های خروجی:

```text
vendor_data_sufficient_for_screening
vendor_data_incomplete
vendor_certified_required
```

### 2) موارد validate شده
- Preferred brand
- Preferred series/model
- Leakage class
- Rated / candidate Cv
- FL
- Fd
- Xt برای Gas/Steam
- MW/SG، Z و k برای Gas/Steam
- Vendor certified sheet requirement برای سرویس‌های compressible/choked

### 3) اتصال به Final Gate
Final gate اکنون `vendorValidation` را برمی‌گرداند و warningهای missing/TBD و certification required را ثبت می‌کند.

### 4) اتصال به گزارش نهایی
گزارش نهایی HTML اکنون بخش جدید دارد:

```text
Vendor Data Validation Matrix
```

### 5) CRM UI
CRM اکنون vendor status و vendor missing count را در detail/gate/final modal نمایش می‌دهد.

## محدودیت‌ها
- این ماتریس به معنی vendor-certified بودن خروجی نیست؛ فقط داده‌های vendor و نیاز به certificate را شفاف و traceable می‌کند.
- پرداخت آنلاین همچنان فعال نشده است.
- PDF باینری سمت سرور همچنان فعال نشده است.

## تست
- تست جدید `tester256-advanced-cv-vendor-data-validation.js` اضافه شد.
- regression کامل و audit باید قبل از ZIP اجرا شود.
