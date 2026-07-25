# 📊 گزارش رگرسیون v31.7.42

**تاریخ:** ۱۴۰۵/۰۴/۳۰ (2026-07-21)  
**نسخه:** `v31.7.42`  
**موضوع:** BUG-SUP-OTP-001 — رفع بن‌بست OTP پیامکی فرم تامین‌کنندگان

---

## ✅ نتیجه نهایی

| معیار | مقدار | وضعیت |
|---|---:|---|
| تعداد تسترها | **197** | — |
| فایل‌های PASS | **197** | ✅ |
| فایل‌های FAIL | **0** | ✅ |
| مجموع چک‌های PASS | **4341** | ✅ |
| مجموع چک‌های FAIL | **0** | ✅ |
| تستر جدید Supplier OTP | `tester219-supplier-otp-degraded.js` | ✅ 9/9 |

خروجی کامل runner:

```json
{
  "date": "2026-07-21T07:49:54.790Z",
  "version": "v31.7.42",
  "testers_total": 197,
  "files_pass": 197,
  "files_fail": 0,
  "checks_pass": 4341,
  "checks_fail": 0,
  "prebroken": [],
  "failed": [],
  "hung": [],
  "soft": []
}
```

---

## 🆕 تستر جدید

### `_tools/uat/tester219-supplier-otp-degraded.js`

پوشش:

1. وجود `BUG-SUP-OTP-001` در API.
2. اگر `sms_send` fail شود، `otp_send` توکن degraded امضاشده می‌دهد.
3. پیام degraded به بررسی تلفنی بازرگانی اشاره دارد.
4. `add_supplier` همچنان وقتی SMS فعال است توکن معتبر می‌خواهد.
5. `ptf-guard` پاسخ degraded را verified می‌کند و token را نگه می‌دارد.
6. فرم تامین‌کننده token را هنگام submit ارسال می‌کند.
7. فیلد شماره تماس صریحاً موبایل `09` برای تایید پیامکی می‌خواهد.

نتیجه مستقیم:

```text
tester219-supplier-otp-degraded: 9 PASS / 0 FAIL
```

---

## 📁 فایل‌های تغییر یافته

```text
api/crm.php
assets/js/ptf-guard.js
supplier/index.html
crm/index.html
crm/sw.js
crm/clear-cache.html
PTF-MASTER-HANDOVER.md
_tools/last-regression.json
_tools/uat/tester219-supplier-otp-degraded.js
RELEASE-NOTES-v31.7.42.md
REGRESSION-REPORT-v31.7.42.md
```

---

## 🚦 وضعیت گیت‌ها

- تستر اختصاصی Supplier OTP: ✅ PASS
- رگرسیون کامل UAT: ✅ PASS
- فایل FAIL: ✅ صفر
- چک FAIL: ✅ صفر
- audit.py: ✅ PASS
- PHP syntax: ⏳ در sandbox فعلی PHP نصب نیست؛ چون `api/crm.php` تغییر کرده، روی staging/سرور اجرای `php -l api/crm.php` الزامی است.

---

## راستی‌آزمایی پیشنهادی کارفرما

1. صفحه `/supplier/` را باز کنید.
2. شماره موبایل `09xxxxxxxxx` وارد کنید.
3. کپچا را تکمیل کنید.
4. روی «ارسال رمز تایید» بزنید.
5. اگر SMS سالم باشد، رمز باید بیاید و verify شود.
6. اگر SMS provider مشکل داشته باشد، فرم نباید بن‌بست شود و باید پیام ادامه با بررسی تلفنی نشان دهد.
7. ثبت فرم باید کد `PTF-VEN-...` بدهد.
