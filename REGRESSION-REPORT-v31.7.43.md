# 📊 گزارش رگرسیون v31.7.43

**تاریخ:** ۱۴۰۵/۰۴/۳۰ (2026-07-21)  
**نسخه:** `v31.7.43`  
**موضوع:** Public Interactions Operational Audit — حذف fake-success در RFQ/Supplier و پوشش همه تعاملات عمومی

---

## ✅ نتیجه نهایی

| معیار | مقدار | وضعیت |
|---|---:|---|
| تعداد تسترها | **198** | — |
| فایل‌های PASS | **198** | ✅ |
| فایل‌های FAIL | **0** | ✅ |
| مجموع چک‌های PASS | **4356** | ✅ |
| مجموع چک‌های FAIL | **0** | ✅ |
| تستر جدید Public Interactions | `tester220-public-interactions-operational.js` | ✅ 15/15 |

خروجی کامل runner:

```json
{
  "date": "2026-07-21T07:59:11.099Z",
  "version": "v31.7.43",
  "testers_total": 198,
  "files_pass": 198,
  "files_fail": 0,
  "checks_pass": 4356,
  "checks_fail": 0,
  "prebroken": [],
  "failed": [],
  "hung": [],
  "soft": []
}
```

---

## 🆕 تستر جدید

### `_tools/uat/tester220-public-interactions-operational.js`

پوشش:

1. Home quick RFQ به `add_rfq_site` وصل است، کد تصادفی نمی‌سازد و fail-closed است.
2. Smart RFQ به `add_rfq_site` وصل است و دیگر `PTF-RFQ-TMP` نمی‌سازد.
3. درخواست فعال‌سازی ابزار داخل RFQ قابل مشاهده است.
4. لینک‌های Tools دارای `activation=tools` هستند.
5. Tools paywall ورودی license و لینک RFQ activation دارد.
6. Supplier form به `add_supplier` وصل است و دیگر `PTF-VEN-TMP` نمی‌سازد.
7. Supplier OTP degraded fallback وجود دارد.
8. Tracking از API عمومی `track` استفاده می‌کند و backend rate-limit دارد.

نتیجه مستقیم:

```text
tester220-public-interactions-operational: 15 PASS / 0 FAIL
```

---

## 📁 فایل‌های تغییر یافته

```text
rfq/index.html
supplier/index.html
crm/index.html
crm/sw.js
crm/clear-cache.html
PTF-MASTER-HANDOVER.md
_tools/last-regression.json
_tools/uat/tester220-public-interactions-operational.js
RELEASE-NOTES-v31.7.43.md
REGRESSION-REPORT-v31.7.43.md
```

---

## 🚦 وضعیت گیت‌ها

- تستر اختصاصی تعاملات عمومی: ✅ PASS
- رگرسیون کامل UAT: ✅ PASS
- فایل FAIL: ✅ صفر
- چک FAIL: ✅ صفر
- audit.py: ✅ PASS
- PHP syntax: ⏳ در sandbox فعلی PHP نصب نیست؛ این ریلیز PHP جدید ندارد اما چون زنجیره public به API وابسته است، تست staging توصیه می‌شود.

---

## راستی‌آزمایی پیشنهادی کارفرما

1. Home quick RFQ را ثبت کنید؛ فقط با پاسخ سرور کد واقعی بگیرید.
2. `/rfq/` را ثبت کنید؛ اگر سرور خطا بدهد، نباید کد موقت ببینید.
3. `/tools/` → درخواست فعال‌سازی → `/rfq/` را تست کنید؛ بنر فعال‌سازی باید دیده شود.
4. `/supplier/` را تست کنید؛ اگر سرور خطا بدهد، نباید کد موقت یا صفحه موفقیت fake ببینید.
5. `/tracking/` را با یک کد واقعی تست کنید.
