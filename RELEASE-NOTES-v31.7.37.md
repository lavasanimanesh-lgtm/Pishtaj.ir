# Release Notes — v31.7.37

**تاریخ:** ۱۴۰۵/۰۴/۳۰ (2026-07-21)  
**نسخه:** `v31.7.37`  
**نوع:** 🟠 ADV-TOOLS-LICENSE-001 — لایسنس دستی ابزارهای پولی

---

## 🎯 هدف ریلیز

ادامه مسیر پولی‌سازی ابزارهای مهندسی با یک گام سبک و کنترل‌شده:

- افزودن API ساده برای بررسی کد فعال‌سازی دستی.
- افزودن مسیر unlock در paywall ابزارها.
- حفظ حالت رایگان برای محاسبه اولیه.
- بدون اتصال درگاه پرداخت.
- بدون تغییر محاسبات پیشرفته یا CRM.

---

## ✅ کارهای انجام‌شده

### 1) API جدید ابزارها

فایل جدید:

```text
api/tools.php
```

Actions:

```text
status
license_check
grant_verify
```

ویژگی‌ها:

- raw license code سمت سرور ذخیره نمی‌شود.
- کد لایسنس با HMAC و secret سمت سرور hash می‌شود.
- `license_check` در صورت موفقیت grant کوتاه‌مدت ۲ ساعته برمی‌گرداند.
- `grant_verify` امکان اعتبارسنجی grant را دارد.
- rate-limit پایه برای `license_check` وجود دارد.
- cross-origin ساده block می‌شود.

---

### 2) فایل نمونه لایسنس

فایل نمونه اضافه شد:

```text
api/tool-licenses.sample.json
```

این فایل فقط نمونه ساختار است و کد واقعی ندارد. لایسنس واقعی باید در runtime server data نگهداری شود:

```text
crm/data/tool_licenses.json
```

این فایل در release وجود ندارد و نباید در ZIP با داده واقعی قرار بگیرد.

---

### 3) whitelist API

در `api/.htaccess` endpoint جدید `tools.php` به whitelist اضافه شد.

---

### 4) UI فعال‌سازی در paywall ابزارها

در `tools/tools-ui.js` موارد زیر اضافه شد:

- ورودی کد فعال‌سازی در paywall.
- دکمه «بررسی و فعال‌سازی».
- فراخوانی `api/tools.php?action=license_check`.
- ذخیره grant در `sessionStorage` همین نشست مرورگر.
- در صورت grant معتبر، گزارش PDF فعال‌شده تولید می‌شود.
- گزارش پولی با برچسب `LICENSED REPORT` مشخص می‌شود.

---

## ⚠️ مرز امنیتی این فاز

این فاز هنوز گزارش PDF را بعد از unlock در client تولید می‌کند. این برای فاز دستی/کم‌ریسک قابل قبول است، اما برای paywall مقاوم‌تر باید در فاز بعدی:

```text
report_create / report_download server-side
```

پیاده‌سازی شود تا گزارش کامل فقط سمت سرور تولید و دانلود شود.

---

## 🧪 تست اضافه‌شده

### `_tools/uat/tester214-tools-manual-license.js`

پوشش:

- وجود `api/tools.php` و actionهای `license_check` و `grant_verify`.
- whitelist شدن `tools.php` در `api/.htaccess`.
- hash شدن license با HMAC و secret سمت سرور.
- وجود rate limit.
- وجود فایل sample بدون کد خام واقعی.
- وجود مسیر client برای `ptfToolsCheckLicense`.
- وجود ورودی کد فعال‌سازی در paywall.
- exportPdf فقط با grant معتبر `exportPdfPaid` اجرا می‌کند.
- بدون grant همچنان paywall باز می‌شود.

نتیجه مستقیم:

```text
tester214-tools-manual-license: 14 PASS / 0 FAIL
```

---

## ⚠️ Impact Analysis

| بخش | اثر | ریسک |
|---|---|---|
| Tools UI | ورود کد فعال‌سازی و report unlock اضافه شد | متوسط کنترل‌شده |
| API public | endpoint جدید `api/tools.php` اضافه شد | متوسط، با rate-limit و same-origin |
| PDF ابزارها | فقط پس از grant معتبر تولید می‌شود | کم |
| پرداخت | همچنان دستی؛ درگاه اضافه نشده | صفر |
| CRM/Auth/Finance/Sync | دست‌نخورده | صفر |
| RFQ/Tracking | دست‌نخورده | صفر |

---

## 📋 راه‌اندازی دستی لایسنس در سرور

در Production باید ادمین سرور فایل زیر را خارج از release و در runtime data بسازد:

```text
crm/data/tool_licenses.json
```

ساختار نمونه در:

```text
api/tool-licenses.sample.json
```

برای تولید `tokenHash` باید HMAC-SHA256 کد لایسنس با secret زیر محاسبه شود:

```text
tools_license_key
```

این secret باید در `ptf-secrets.php` خارج از webroot تعریف شود.

---

## 📋 راستی‌آزمایی کارفرما

1. صفحه `/tools/` را باز کنید.
2. یک محاسبه انجام دهید.
3. روی «گزارش PDF کامل 🔒» کلیک کنید.
4. بدون کد فعال‌سازی، PDF نباید تولید شود.
5. کد فعال‌سازی معتبر را وارد کنید.
6. پس از تایید، گزارش PDF با برچسب `LICENSED REPORT` باز شود.

---

## 🚦 نتیجه

مسیر فعال‌سازی دستی ابزارهای پولی آماده شد. گام بعدی پیشنهادی برای امنیت واقعی paywall:

```text
ADV-TOOLS-REPORT-SERVER-001
```

یعنی تولید و دانلود گزارش کامل به‌صورت server-side.
