# 📊 گزارش رگرسیون v31.7.38

**تاریخ:** ۱۴۰۵/۰۴/۳۰ (2026-07-21)  
**نسخه:** `v31.7.38`  
**موضوع:** BUG-DUP-GROW-001 + BUG-MYDAY-DISMISS-001 — توقف رشد duplicateهای RFQ/Offer و حذف‌پذیری آیتم‌های «روز من»

---

## ✅ نتیجه نهایی

| معیار | مقدار | وضعیت |
|---|---:|---|
| تعداد تسترها | **193** | — |
| فایل‌های PASS | **193** | ✅ |
| فایل‌های FAIL | **0** | ✅ |
| مجموع چک‌های PASS | **4306** | ✅ |
| مجموع چک‌های FAIL | **0** | ✅ |
| تستر جدید Duplicate/MyDay | `tester215-duplicate-growth-myday-dismiss.js` | ✅ 11/11 |
| تستر MyDay قبلی | `tester203-myday-dedup.js` | ✅ PASS |
| تستر Avatar Merge اصلاح‌شده | `tester186-avatar-delete-sync.js` | ✅ PASS |
| تستر MyDay تاریخی اصلاح‌شده | `tester81-v163.js` | ✅ PASS |

خروجی کامل runner:

```json
{
  "date": "2026-07-21T01:40:58.819Z",
  "version": "v31.7.38",
  "testers_total": 193,
  "files_pass": 193,
  "files_fail": 0,
  "checks_pass": 4306,
  "checks_fail": 0,
  "prebroken": [],
  "failed": [],
  "hung": [],
  "soft": []
}
```

---

## 🆕 تستر جدید

### `_tools/uat/tester215-duplicate-growth-myday-dismiss.js`

پوشش:

1. `sync.js` دارای canonical merge برای RFQ/Offer است.
2. `ptfSmartMerge` برای `ptf_crm_rfqs` و `ptf_crm_offers` دیگر از no-collapse استفاده نمی‌کند.
3. تابع cleanup عمومی `ptfCollapseDuplicateBusinessRecords` وجود دارد.
4. cleanup با `setData` وارد sync می‌شود و audit ثبت می‌کند.
5. `codegen.js` قبل از هشدار duplicate، cleanup canonical را اجرا می‌کند.
6. `myday.js` دارای fingerprint و dismiss map است.
7. آیتم‌های dismissed از خروجی «روز من» حذف می‌شوند.
8. هر ردیف «روز من» دکمه حذف `×` دارد.
9. دکمه «🧹 پاکسازی تکراری‌ها» وجود دارد.
10. امکان نمایش دوباره حذف‌شده‌ها وجود دارد.
11. رفتار canonical merge ساده‌شده شبیه‌سازی شد.

نتیجه مستقیم:

```text
tester215-duplicate-growth-myday-dismiss: 11 PASS / 0 FAIL
```

---

## 🔁 تست‌های محافظ به‌روزرسانی‌شده

### `tester81-v163.js`

به‌روزرسانی شد تا بپذیرد «روز من» همچنان اسناد کسب‌وکاری را تغییر نمی‌دهد، اما برای dismiss آیتم‌ها، `ptf_crm_settings` را sync می‌کند.

### `tester186-avatar-delete-sync.js`

به‌روزرسانی شد تا بررسی order گارد آواتار داخل خود `ptfSmartMerge` انجام شود، نه در کل فایل؛ چون helperهای canonical merge جدید قبل از `ptfSmartMerge` اضافه شده‌اند.

---

## 📁 فایل‌های تغییر یافته

```text
crm/sync.js
crm/codegen.js
crm/myday.js
crm/index.html
crm/sw.js
crm/clear-cache.html
PTF-MASTER-HANDOVER.md
_tools/uat/tester81-v163.js
_tools/uat/tester186-avatar-delete-sync.js
_tools/uat/tester215-duplicate-growth-myday-dismiss.js
_tools/last-regression.json
RELEASE-NOTES-v31.7.38.md
REGRESSION-REPORT-v31.7.38.md
```

---

## 🚦 وضعیت گیت‌ها

- تستر اختصاصی Duplicate/MyDay: ✅ PASS
- رگرسیون کامل UAT: ✅ PASS
- فایل FAIL: ✅ صفر
- چک FAIL: ✅ صفر
- audit.py: ✅ PASS
- node --check: ✅ PASS

---

## راستی‌آزمایی پیشنهادی کارفرما

1. وارد CRM شوید.
2. داشبورد / «روز من» را باز کنید.
3. اگر آیتم چندرکوردی مثل `×10 رکورد هم‌کد` دیده شد، روی «🧹 پاکسازی تکراری‌ها» کلیک کنید.
4. صفحه را refresh کنید و اجازه دهید sync انجام شود.
5. انتظار: duplicateها دوباره زیاد نشوند.
6. روی `×` کنار یک آیتم روز من کلیک کنید.
7. انتظار: آیتم از «روز من» پنهان شود، ولی سند اصلی حذف نشود.
8. اگر خواستید موارد حذف‌شده را برگردانید، روی «نمایش حذف‌شده‌ها» کلیک کنید.
