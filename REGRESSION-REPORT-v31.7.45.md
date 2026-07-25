# 📊 گزارش رگرسیون v31.7.45

**تاریخ:** ۱۴۰۵/۰۴/۳۰ (2026-07-21)  
**نسخه:** `v31.7.45`  
**موضوع:** ADV-CV-INPUT-SCHEMA-001 — پیش‌نمایش قفل‌شده schema ورودی Control Valve Advanced

---

## ✅ نتیجه نهایی

| معیار | مقدار | وضعیت |
|---|---:|---|
| تعداد تسترها | **200** | — |
| فایل‌های PASS | **200** | ✅ |
| فایل‌های FAIL | **0** | ✅ |
| مجموع چک‌های PASS | **4380** | ✅ |
| مجموع چک‌های FAIL | **0** | ✅ |
| تستر جدید Advanced CV Input Schema | `tester222-advanced-cv-input-schema.js` | ✅ 12/12 |
| تستر Advanced Catalog | `tester217-advanced-tools-catalog-preview.js` | ✅ PASS |
| تستر Tools Paywall | `tester213-tools-free-pdf-paywall.js` | ✅ PASS |

خروجی کامل runner:

```json
{
  "date": "2026-07-21T08:33:31.945Z",
  "version": "v31.7.45",
  "testers_total": 200,
  "files_pass": 200,
  "files_fail": 0,
  "checks_pass": 4380,
  "checks_fail": 0,
  "prebroken": [],
  "failed": [],
  "hung": [],
  "soft": []
}
```

---

## 🆕 تستر جدید

### `_tools/uat/tester222-advanced-cv-input-schema.js`

پوشش:

1. وجود schema preview کنترل ولو پیشرفته.
2. وجود گروه‌های ورودی Project & Tag، Operating Cases، Fluid Data، Piping Data، Valve Data، Actuator Data، Brand Library، Compliance.
3. وجود completeness checklist.
4. پوشش داده‌های Liquid / Gas / Steam مثل Pv, Pc, viscosity, MW, Z, k.
5. locked بودن ابزار و عدم اجرای full calculation.
6. وجود outline گزارش انگلیسی شامل report ID، calculation tables، formula trace و charts.
7. وجود سند `ADV-CV-INPUT-SCHEMA-v1.md`.
8. وجود برندهای اولیه Fisher, Samson, Masoneilan, Flowserve, Neles.

نتیجه مستقیم:

```text
tester222-advanced-cv-input-schema: 12 PASS / 0 FAIL
```

---

## 📁 فایل‌های تغییر یافته

```text
tools/index.html
ADV-CV-INPUT-SCHEMA-v1.md
crm/index.html
crm/sw.js
crm/clear-cache.html
PTF-MASTER-HANDOVER.md
_tools/last-regression.json
_tools/uat/tester222-advanced-cv-input-schema.js
RELEASE-NOTES-v31.7.45.md
REGRESSION-REPORT-v31.7.45.md
```

---

## 🚦 وضعیت گیت‌ها

- تستر اختصاصی Advanced CV Input Schema: ✅ PASS
- رگرسیون کامل UAT: ✅ PASS
- فایل FAIL: ✅ صفر
- چک FAIL: ✅ صفر
- audit.py: ✅ PASS

---

## راستی‌آزمایی پیشنهادی کارفرما

1. صفحه `/tools/` را باز کنید.
2. بخش Advanced Control Valve Sizing را بررسی کنید.
3. باید گروه‌های ورودی، completeness checklist و report outline انگلیسی دیده شوند.
4. ابزار همچنان نباید محاسبه کامل یا گزارش عمومی تولید کند.
