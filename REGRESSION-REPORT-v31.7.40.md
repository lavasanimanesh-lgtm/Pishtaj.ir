# 📊 گزارش رگرسیون v31.7.40

**تاریخ:** ۱۴۰۵/۰۴/۳۰ (2026-07-21)  
**نسخه:** `v31.7.40`  
**موضوع:** ADV-TOOLS-CATALOG-001 — کاتالوگ قفل‌شده ابزارهای پیشرفته

---

## ✅ نتیجه نهایی

| معیار | مقدار | وضعیت |
|---|---:|---|
| تعداد تسترها | **195** | — |
| فایل‌های PASS | **195** | ✅ |
| فایل‌های FAIL | **0** | ✅ |
| مجموع چک‌های PASS | **4323** | ✅ |
| مجموع چک‌های FAIL | **0** | ✅ |
| تستر جدید Advanced Catalog | `tester217-advanced-tools-catalog-preview.js` | ✅ 9/9 |
| تستر Tools Paywall | `tester213-tools-free-pdf-paywall.js` | ✅ 12/12 |
| تستر Minimal Icons | `tester216-minimal-icons-policy.js` | ✅ 8/8 |

خروجی کامل runner:

```json
{
  "date": "2026-07-21T02:14:07.289Z",
  "version": "v31.7.40",
  "testers_total": 195,
  "files_pass": 195,
  "files_fail": 0,
  "checks_pass": 4323,
  "checks_fail": 0,
  "prebroken": [],
  "failed": [],
  "hung": [],
  "soft": []
}
```

---

## 🆕 تستر جدید

### `_tools/uat/tester217-advanced-tools-catalog-preview.js`

پوشش:

1. وجود کاتالوگ ابزارهای پیشرفته در صفحه Tools.
2. وجود خانواده‌های اصلی: Control Valve, Piping, Pump, Flowmeter, Electrical, Instrumentation.
3. ابزارها فعلاً locked/planned هستند نه اجرای آزاد.
4. استفاده رایگان پرسنل با کد داخلی ذکر شده است.
5. Advanced Control Valve detail preview وجود دارد.
6. برندهای نمونه Fisher, Samson, Masoneilan, Flowserve, Neles ذکر شده‌اند.
7. English Standard Report و Paid PDF report ذکر شده‌اند.
8. نمونه staff_internal license وجود دارد.
9. سند کاتالوگ ابزارهای پیشرفته وجود دارد.

نتیجه مستقیم:

```text
tester217-advanced-tools-catalog-preview: 9 PASS / 0 FAIL
```

---

## 📁 فایل‌های تغییر یافته

```text
tools/index.html
api/tool-licenses.sample.json
ADVANCED-TOOLS-CATALOG-SPEC-v1.md
crm/index.html
crm/sw.js
crm/clear-cache.html
PTF-MASTER-HANDOVER.md
_tools/last-regression.json
_tools/uat/tester217-advanced-tools-catalog-preview.js
RELEASE-NOTES-v31.7.40.md
REGRESSION-REPORT-v31.7.40.md
```

---

## 🚦 وضعیت گیت‌ها

- تستر اختصاصی Advanced Catalog: ✅ PASS
- رگرسیون کامل UAT: ✅ PASS
- فایل FAIL: ✅ صفر
- چک FAIL: ✅ صفر
- گیت انسانی: ⏳ بررسی UI صفحه `/tools/` در مرورگر واقعی

---

## راستی‌آزمایی پیشنهادی کارفرما

1. صفحه `/tools/` را باز کنید.
2. بخش `Advanced Engineering Tools — Locked Preview` را بررسی کنید.
3. خانواده‌های ابزار پیشرفته باید دیده شوند.
4. Advanced Control Valve باید جزئیات Process Cases، Fluid Properties، Valve Data، Brand Library و English Report را نشان دهد.
5. هیچ ابزار پیشرفته‌ای نباید برای عموم اجرا شود؛ فقط preview و مسیر فعال‌سازی دیده شود.
