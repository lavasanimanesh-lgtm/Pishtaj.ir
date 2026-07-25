# 📊 گزارش رگرسیون v31.7.39

**تاریخ:** ۱۴۰۵/۰۴/۳۰ (2026-07-21)  
**نسخه:** `v31.7.39`  
**موضوع:** Fix My Day dismiss click + Minimal Icon Policy

---

## ✅ نتیجه نهایی

| معیار | مقدار | وضعیت |
|---|---:|---|
| تعداد تسترها | **194** | — |
| فایل‌های PASS | **194** | ✅ |
| فایل‌های FAIL | **0** | ✅ |
| مجموع چک‌های PASS | **4314** | ✅ |
| مجموع چک‌های FAIL | **0** | ✅ |
| تستر جدید Minimal Icons | `tester216-minimal-icons-policy.js` | ✅ 8/8 |
| تستر Duplicate/MyDay | `tester215-duplicate-growth-myday-dismiss.js` | ✅ 11/11 |
| تستر Tools Paywall | `tester213-tools-free-pdf-paywall.js` | ✅ 12/12 |
| تستر Home Journey | `tester210-home-journey-cro.js` | ✅ 7/7 |

خروجی کامل runner:

```json
{
  "date": "2026-07-21T02:03:58.486Z",
  "version": "v31.7.39",
  "testers_total": 194,
  "files_pass": 194,
  "files_fail": 0,
  "checks_pass": 4314,
  "checks_fail": 0,
  "prebroken": [],
  "failed": [],
  "hung": [],
  "soft": []
}
```

---

## 🆕 تستر جدید

### `_tools/uat/tester216-minimal-icons-policy.js`

پوشش:

1. سکشن Home Journey وجود دارد.
2. emojiهای بزرگ مسیر سریع حذف شده‌اند.
3. badgeهای عددی مینیمال 01 تا 04 وجود دارند.
4. رویدادهای journey حفظ شده‌اند.
5. دکمه PDF ابزارها بدون emoji lock است.
6. پیام‌های فعال‌سازی ابزارها بدون emoji check/error جدید هستند.
7. دکمه پاکسازی تکراری‌ها در MyDay بدون emoji broom است.
8. حذف MyDay با `×` مینیمال باقی مانده است.

نتیجه مستقیم:

```text
tester216-minimal-icons-policy: 8 PASS / 0 FAIL
```

---

## 🔁 تست‌های مرتبط

```text
tester215-duplicate-growth-myday-dismiss: 11 PASS / 0 FAIL
tester213-tools-free-pdf-paywall: 12 PASS / 0 FAIL
tester210-home-journey-cro: 7 PASS / 0 FAIL
```

---

## 📁 فایل‌های تغییر یافته

```text
crm/myday.js
index.html
tools/tools-ui.js
_tools/uat/tester213-tools-free-pdf-paywall.js
_tools/uat/tester215-duplicate-growth-myday-dismiss.js
_tools/uat/tester216-minimal-icons-policy.js
crm/index.html
crm/sw.js
crm/clear-cache.html
PTF-MASTER-HANDOVER.md
_tools/last-regression.json
RELEASE-NOTES-v31.7.39.md
REGRESSION-REPORT-v31.7.39.md
```

---

## 🚦 وضعیت گیت‌ها

- تستر اختصاصی Minimal Icons: ✅ PASS
- تستر dismiss/duplicate: ✅ PASS
- رگرسیون کامل UAT: ✅ PASS
- فایل FAIL: ✅ صفر
- چک FAIL: ✅ صفر
- audit.py: ✅ PASS
- node --check: ✅ PASS

---

## راستی‌آزمایی پیشنهادی کارفرما

1. در CRM، داشبورد / «روز من» را باز کنید.
2. روی `×` کنار یک آیتم کلیک کنید.
3. انتظار: همان آیتم فوراً از لیست حذف/پنهان شود.
4. روی «نمایش حذف‌شده‌ها» کلیک کنید.
5. انتظار: آیتم‌های پنهان‌شده برگردند.
6. صفحه اصلی سایت را باز کنید.
7. انتظار: در بخش مسیر سریع، badgeهای مینیمال 01 تا 04 دیده شوند و emojiهای بزرگ قبلی نباشند.
