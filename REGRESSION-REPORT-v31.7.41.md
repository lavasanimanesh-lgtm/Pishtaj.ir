# 📊 گزارش رگرسیون v31.7.41

**تاریخ:** ۱۴۰۵/۰۴/۳۰ (2026-07-21)  
**نسخه:** `v31.7.41`  
**موضوع:** ADV-TOOLS-RFQ-ACTIVATION-001 — نمایش واضح درخواست فعال‌سازی ابزار در RFQ هوشمند

---

## ✅ نتیجه نهایی

| معیار | مقدار | وضعیت |
|---|---:|---|
| تعداد تسترها | **196** | — |
| فایل‌های PASS | **196** | ✅ |
| فایل‌های FAIL | **0** | ✅ |
| مجموع چک‌های PASS | **4332** | ✅ |
| مجموع چک‌های FAIL | **0** | ✅ |
| تستر جدید RFQ Activation | `tester218-rfq-tool-activation-visible.js` | ✅ 9/9 |
| تستر Home RFQ | `tester207-home-rfq-real-chain.js` | ✅ PASS |
| تستر Advanced Catalog | `tester217-advanced-tools-catalog-preview.js` | ✅ PASS |

خروجی کامل runner:

```json
{
  "date": "2026-07-21T02:32:43.583Z",
  "version": "v31.7.41",
  "testers_total": 196,
  "files_pass": 196,
  "files_fail": 0,
  "checks_pass": 4332,
  "checks_fail": 0,
  "prebroken": [],
  "failed": [],
  "hung": [],
  "soft": []
}
```

---

## 🆕 تستر جدید

### `_tools/uat/tester218-rfq-tool-activation-visible.js`

پوشش:

1. RFQ پارامترهای `activation`, `tool`, `item` را می‌خواند.
2. بنر «درخواست فعال‌سازی ابزارهای پیشرفته» در RFQ نمایش داده می‌شود.
3. category مخفی به «فعال‌سازی ابزارهای پیشرفته مهندسی» تغییر می‌کند.
4. subject اختصاصی «درخواست فعال‌سازی ابزارهای پیشرفته PTF» ساخته و انتخاب می‌شود.
5. فیلدهای technical/vendor/message با متن درخواست لایسنس پر می‌شوند.
6. دسته‌های کالایی در activation mode قفل می‌شوند.
7. لینک اصلی فعال‌سازی ابزارها دارای `activation=tools` است.
8. لینک RFQ داخل paywall ابزارها نیز دارای `activation=tools` است.

نتیجه مستقیم:

```text
tester218-rfq-tool-activation-visible: 9 PASS / 0 FAIL
```

---

## 📁 فایل‌های تغییر یافته

```text
rfq/index.html
tools/index.html
tools/tools-ui.js
crm/index.html
crm/sw.js
crm/clear-cache.html
PTF-MASTER-HANDOVER.md
_tools/last-regression.json
_tools/uat/tester218-rfq-tool-activation-visible.js
RELEASE-NOTES-v31.7.41.md
REGRESSION-REPORT-v31.7.41.md
```

---

## 🚦 وضعیت گیت‌ها

- تستر اختصاصی RFQ Activation: ✅ PASS
- رگرسیون کامل UAT: ✅ PASS
- فایل FAIL: ✅ صفر
- چک FAIL: ✅ صفر
- گیت انسانی: ⏳ تست مرورگر واقعی لینک فعال‌سازی از `/tools/` به `/rfq/`

---

## راستی‌آزمایی پیشنهادی کارفرما

1. در `/tools/` روی «درخواست فعال‌سازی» کلیک کنید.
2. وارد `/rfq/` شوید.
3. انتظار: در مرحله اول RFQ بنر «درخواست فعال‌سازی ابزارهای پیشرفته» دیده شود.
4. subject باید «درخواست فعال‌سازی ابزارهای پیشرفته PTF» باشد.
5. در مرحله مشخصات، متن درخواست لایسنس پر شده باشد.
6. با ارسال فرم، کد رهگیری واقعی سرور دریافت شود.
