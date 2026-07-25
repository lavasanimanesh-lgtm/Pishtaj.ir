# 📊 گزارش رگرسیون v31.7.44

**تاریخ:** ۱۴۰۵/۰۴/۳۰ (2026-07-21)  
**نسخه:** `v31.7.44`  
**موضوع:** BUG-INQ-ITEMS-001 — افزودن/ویرایش اقلام درخواست بعد از ثبت، دستی یا Excel راهنمادار

---

## ✅ نتیجه نهایی

| معیار | مقدار | وضعیت |
|---|---:|---|
| تعداد تسترها | **199** | — |
| فایل‌های PASS | **199** | ✅ |
| فایل‌های FAIL | **0** | ✅ |
| مجموع چک‌های PASS | **4368** | ✅ |
| مجموع چک‌های FAIL | **0** | ✅ |
| تستر جدید RFQ Items | `tester221-rfq-items-late-entry.js` | ✅ 12/12 |
| تستر تعاملات عمومی | `tester220-public-interactions-operational.js` | ✅ 15/15 |

خروجی کامل runner:

```json
{
  "date": "2026-07-21T08:13:27.691Z",
  "version": "v31.7.44",
  "testers_total": 199,
  "files_pass": 199,
  "files_fail": 0,
  "checks_pass": 4368,
  "checks_fail": 0,
  "prebroken": [],
  "failed": [],
  "hung": [],
  "soft": []
}
```

---

## 🆕 تستر جدید

### `_tools/uat/tester221-rfq-items-late-entry.js`

پوشش:

1. مشاهده درخواست دکمه «افزودن/ویرایش اقلام» دارد.
2. در حالت بدون قلم، پیام راهنمای fallback بعد از شکست AI دیده می‌شود.
3. نمونه CSV قابل دانلود است.
4. راهنمای Excel نوع `INQ` در modal عمومی اضافه شده است.
5. full editor ورود Excel با راهنما دارد.
6. read-file modal نیز ورود Excel با راهنما دارد.
7. Excel parser از helper مشترک `irXlsRowToItem` استفاده می‌کند.
8. ستون‌های Description / Spec / Qty / Unit / Type / Brand / Model پشتیبانی می‌شوند.
9. ورود دستی ستون‌های نوع/برند/مدل را دارد.
10. ذخیره همچنان `ptf_crm_inqitems` و `r.items` را به‌روزرسانی می‌کند.
11. snapshot خوانش AI قدیمی هنگام ذخیره پاک می‌شود.

نتیجه مستقیم:

```text
tester221-rfq-items-late-entry: 12 PASS / 0 FAIL
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
_tools/uat/tester221-rfq-items-late-entry.js
RELEASE-NOTES-v31.7.44.md
REGRESSION-REPORT-v31.7.44.md
```

---

## 🚦 وضعیت گیت‌ها

- تستر اختصاصی RFQ Items: ✅ PASS
- رگرسیون کامل UAT: ✅ PASS
- فایل FAIL: ✅ صفر
- چک FAIL: ✅ صفر
- audit.py: ✅ PASS

---

## راستی‌آزمایی پیشنهادی کارفرما

1. یک درخواست بدون قلم را در CRM باز کنید.
2. روی «مشاهده» بزنید.
3. در بخش اقلام، دکمه «افزودن/ویرایش اقلام» و «نمونه اکسل» باید دیده شود.
4. روی «افزودن/ویرایش اقلام» بزنید.
5. دستی چند ردیف اضافه کنید و ذخیره کنید.
6. دوباره درخواست را باز کنید؛ اقلام باید در جدول دیده شوند.
7. همین مسیر را با فایل Excel/CSV قالب INQ تست کنید.
