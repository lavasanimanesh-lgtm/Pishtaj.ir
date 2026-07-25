# 📊 گزارش رگرسیون v31.7.46

**تاریخ:** ۱۴۰۵/۰۴/۳۰ (2026-07-21)  
**نسخه:** `v31.7.46`  
**موضوع:** BUG-INQ-EDIT-LOCK-001 — رفع قفل کاذب ویرایش اقلام درخواست

---

## ✅ نتیجه نهایی

| معیار | مقدار | وضعیت |
|---|---:|---|
| تعداد تسترها | **201** | — |
| فایل‌های PASS | **201** | ✅ |
| فایل‌های FAIL | **0** | ✅ |
| مجموع چک‌های PASS | **4388** | ✅ |
| مجموع چک‌های FAIL | **0** | ✅ |
| تستر جدید RFQ Item Editor Lock | `tester223-rfq-item-editor-lock.js` | ✅ 8/8 |
| تستر RFQ Items قبلی | `tester221-rfq-items-late-entry.js` | ✅ 12/12 |

خروجی کامل runner:

```json
{
  "date": "2026-07-21T08:48:36.968Z",
  "version": "v31.7.46",
  "testers_total": 201,
  "files_pass": 201,
  "files_fail": 0,
  "checks_pass": 4388,
  "checks_fail": 0,
  "prebroken": [],
  "failed": [],
  "hung": [],
  "soft": []
}
```

---

## 🆕 تستر جدید

### `_tools/uat/tester223-rfq-item-editor-lock.js`

پوشش:

1. وجود bug marker.
2. گارد ویرایش اقلام از aliasهای غیرخالی استفاده می‌کند.
3. الگوی قدیمی `o.inqNo === cd || o.inqNo === r.inqNo` حذف شده است.
4. شبیه‌سازی نشان می‌دهد گارد قدیمی در حالت `undefined` false-positive می‌داد.
5. گارد جدید بدون پیشنهاد واقعی قفل نمی‌کند.
6. گارد جدید در صورت پیشنهاد واقعی همچنان قفل می‌کند.
7. alias شماره درخواست کارفرما نیز پشتیبانی می‌شود.

نتیجه مستقیم:

```text
tester223-rfq-item-editor-lock: 8 PASS / 0 FAIL
```

---

## 📁 فایل‌های تغییر یافته

```text
crm/inqreader.js
crm/index.html
crm/sw.js
crm/clear-cache.html
PTF-MASTER-HANDOVER.md
_tools/last-regression.json
_tools/uat/tester223-rfq-item-editor-lock.js
RELEASE-NOTES-v31.7.46.md
REGRESSION-REPORT-v31.7.46.md
```

---

## 🚦 وضعیت گیت‌ها

- تستر اختصاصی قفل ویرایش اقلام: ✅ PASS
- تستر قبلی ورود اقلام بعد از ثبت: ✅ PASS
- رگرسیون کامل UAT: ✅ PASS
- فایل FAIL: ✅ صفر
- چک FAIL: ✅ صفر
- audit.py: ✅ PASS

---

## راستی‌آزمایی پیشنهادی کارفرما

1. درخواست بدون پیشنهاد صادرشده را باز کنید.
2. روی «مشاهده» → «افزودن/ویرایش اقلام» بزنید.
3. انتظار: editor اقلام باز شود و پیام قفل نمایش داده نشود.
4. برای درخواستی که واقعاً پیشنهاد دارد تست کنید.
5. انتظار: گارد قفل در مورد واقعی همچنان عمل کند.
