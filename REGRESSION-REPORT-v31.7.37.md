# 📊 گزارش رگرسیون v31.7.37

**تاریخ:** ۱۴۰۵/۰۴/۳۰ (2026-07-21)  
**نسخه:** `v31.7.37`  
**موضوع:** ADV-TOOLS-LICENSE-001 — لایسنس دستی ابزارهای پولی

---

## ✅ نتیجه نهایی

| معیار | مقدار | وضعیت |
|---|---:|---|
| تعداد تسترها | **192** | — |
| فایل‌های PASS | **192** | ✅ |
| فایل‌های FAIL | **0** | ✅ |
| مجموع چک‌های PASS | **4295** | ✅ |
| مجموع چک‌های FAIL | **0** | ✅ |
| تستر جدید License | `tester214-tools-manual-license.js` | ✅ 14/14 |
| تستر Paywall قبلی | `tester213-tools-free-pdf-paywall.js` | ✅ 12/12 |
| تستر SEO Meta | `tester211-seo-meta-foundation.js` | ✅ 25/25 |
| تستر Content Authority | `tester212-content-authority-schema.js` | ✅ 60/60 |

خروجی کامل runner:

```json
{
  "date": "2026-07-21T00:52:03.533Z",
  "version": "v31.7.37",
  "testers_total": 192,
  "files_pass": 192,
  "files_fail": 0,
  "checks_pass": 4295,
  "checks_fail": 0,
  "prebroken": [],
  "failed": [],
  "hung": [],
  "soft": []
}
```

---

## 🆕 تستر جدید

### `_tools/uat/tester214-tools-manual-license.js`

پوشش:

1. وجود `api/tools.php` و actionهای `status`, `license_check`, `grant_verify`.
2. whitelist شدن `tools.php` در `api/.htaccess`.
3. hash شدن license code با HMAC و secret سمت سرور.
4. خطای کنترل‌شده در نبود license store runtime.
5. صدور grant کوتاه‌مدت و عدم افشای tokenHash در خروجی safe.
6. rate-limit روی license_check.
7. فایل نمونه لایسنس بدون کد واقعی.
8. مسیر client-side برای ورود و بررسی کد فعال‌سازی.
9. export PDF فقط با grant معتبر.
10. paywall در حالت بدون grant حفظ شده است.

نتیجه مستقیم:

```text
tester214-tools-manual-license: 14 PASS / 0 FAIL
```

---

## 🔁 تست‌های محافظ قبلی

این گیت همچنین ثابت کرد اصلاحات قبلی ابزار و SEO هنوز سالم‌اند:

```text
tester211-seo-meta-foundation: PASS
tester212-content-authority-schema: PASS
tester213-tools-free-pdf-paywall: PASS
```

---

## 📁 فایل‌های تغییر یافته

```text
api/tools.php
api/.htaccess
api/tool-licenses.sample.json
tools/tools-ui.js
tools/index.html
ADVANCED-CONTROL-VALVE-TOOLS-SPEC-v1.md
PTF-MASTER-HANDOVER.md
crm/index.html
crm/sw.js
crm/clear-cache.html
_tools/last-regression.json
_tools/uat/tester211-seo-meta-foundation.js
_tools/uat/tester212-content-authority-schema.js
_tools/uat/tester213-tools-free-pdf-paywall.js
_tools/uat/tester214-tools-manual-license.js
RELEASE-NOTES-v31.7.37.md
REGRESSION-REPORT-v31.7.37.md
```

---

## 🚦 وضعیت گیت‌ها

- تستر اختصاصی Manual License: ✅ PASS
- رگرسیون کامل UAT: ✅ PASS
- فایل FAIL: ✅ صفر
- چک FAIL: ✅ صفر
- audit.py: ✅ PASS
- node --check: ✅ PASS
- PHP syntax: ⏳ در sandbox فعلی PHP نصب نیست؛ فایل PHP جدید باید روی staging/سرور با `php -l api/tools.php` بررسی شود.

---

## راستی‌آزمایی دستی پیشنهادی

1. روی staging فایل `crm/data/tool_licenses.json` را طبق نمونه بسازید.
2. secret `tools_license_key` را در `ptf-secrets.php` تنظیم کنید.
3. در `/tools/` یک محاسبه انجام دهید.
4. روی «گزارش PDF کامل 🔒» کلیک کنید.
5. کد فعال‌سازی معتبر را وارد کنید.
6. پس از تایید، گزارش با برچسب `LICENSED REPORT` باز شود.
