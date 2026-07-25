# 📊 گزارش رگرسیون v31.7.47

**تاریخ:** ۱۴۰۵/۰۴/۳۰ (2026-07-21)  
**نسخه:** `v31.7.47`  
**موضوع:** ADV-CV-SCHEMA-UI-001 — فرم ورودی قفل‌شده Control Valve Advanced

---

## ✅ نتیجه نهایی

| معیار | مقدار | وضعیت |
|---|---:|---|
| تعداد تسترها | **202** | — |
| فایل‌های PASS | **202** | ✅ |
| فایل‌های FAIL | **0** | ✅ |
| مجموع چک‌های PASS | **4400** | ✅ |
| مجموع چک‌های FAIL | **0** | ✅ |
| تستر جدید Advanced CV Schema UI | `tester224-advanced-cv-schema-ui.js` | ✅ 12/12 |
| تستر Advanced CV Input Schema | `tester222-advanced-cv-input-schema.js` | ✅ 12/12 |
| تستر Advanced Catalog | `tester217-advanced-tools-catalog-preview.js` | ✅ 9/9 |

خروجی کامل runner:

```json
{
  "date": "2026-07-21T09:12:18.520Z",
  "version": "v31.7.47",
  "testers_total": 202,
  "files_pass": 202,
  "files_fail": 0,
  "checks_pass": 4400,
  "checks_fail": 0,
  "prebroken": [],
  "failed": [],
  "hung": [],
  "soft": []
}
```

---

## 🆕 تستر جدید

### `_tools/uat/tester224-advanced-cv-schema-ui.js`

پوشش:

1. `tools/advanced-tools-ui.js` در صفحه Tools لود می‌شود.
2. دکمه «مشاهده فرم ورودی قفل‌شده» وجود دارد.
3. تابع `ptfAdvCvOpenSchema` تعریف شده است.
4. modal قفل‌شده Project & Tag، Min/Normal/Max cases، Fluid data، Piping/Valve/Actuator data دارد.
5. فیلدها disabled هستند و ابزار هنوز اجرا نمی‌شود.
6. Completeness checklist داخل modal وجود دارد.
7. English paid report outline داخل modal وجود دارد.
8. فعال‌سازی از modal به RFQ با `activation=tools` می‌رود.

نتیجه مستقیم:

```text
tester224-advanced-cv-schema-ui: 12 PASS / 0 FAIL
```

---

## 📁 فایل‌های تغییر یافته

```text
tools/index.html
tools/advanced-tools-ui.js
crm/index.html
crm/sw.js
crm/clear-cache.html
PTF-MASTER-HANDOVER.md
_tools/last-regression.json
_tools/uat/tester224-advanced-cv-schema-ui.js
RELEASE-NOTES-v31.7.47.md
REGRESSION-REPORT-v31.7.47.md
```

---

## 🚦 وضعیت گیت‌ها

- تستر اختصاصی Advanced CV Schema UI: ✅ PASS
- رگرسیون کامل UAT: ✅ PASS
- فایل FAIL: ✅ صفر
- چک FAIL: ✅ صفر
- audit.py: ✅ PASS

---

## راستی‌آزمایی پیشنهادی کارفرما

1. صفحه `/tools/` را باز کنید.
2. روی «مشاهده فرم ورودی قفل‌شده» در بخش Advanced Control Valve بزنید.
3. modal فرم ورودی باز شود.
4. فیلدهای Project, Tag, Min/Normal/Max, Fluid, Piping, Valve, Actuator, Brand را ببینید.
5. همه فیلدها باید disabled باشند.
6. هیچ محاسبه یا PDF عمومی نباید تولید شود.
