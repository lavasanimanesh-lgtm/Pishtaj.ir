# گزارش رگرسیون v31.7.49

**تاریخ:** ۱۴۰۵/۰۴/۳۰ (2026-07-21)  
**نسخه:** `v31.7.49`  
**موضوع:** ADV-CV-PRELIM-CALC-001 — محاسبه مقدماتی Liquid برای Advanced Control Valve

---

## ✅ نتیجه نهایی

| معیار | مقدار | وضعیت |
|---|---:|---|
| تعداد تسترها | **204** | — |
| فایل‌های PASS | **204** | ✅ |
| فایل‌های FAIL | **0** | ✅ |
| مجموع چک‌های PASS | **4431** | ✅ |
| مجموع چک‌های FAIL | **0** | ✅ |
| تستر جدید Advanced CV Prelim Calc | `tester226-advanced-cv-prelim-calc.js` | ✅ 18/18 |
| تستر Advanced CV Draft Input | `tester225-advanced-cv-draft-input.js` | ✅ 13/13 |

خروجی کامل runner:

```json
{
  "date": "2026-07-21T10:13:15.960Z",
  "version": "v31.7.49",
  "testers_total": 204,
  "files_pass": 204,
  "files_fail": 0,
  "checks_pass": 4431,
  "checks_fail": 0,
  "prebroken": [],
  "failed": [],
  "hung": [],
  "soft": []
}
```

---

## 🆕 تستر جدید

### `_tools/uat/tester226-advanced-cv-prelim-calc.js`

پوشش:

1. وجود `ptfAdvCvCalculatePrelim`.
2. fail-closed بودن محاسبه بدون `ptfToolsHasGrant('control_valve_advanced')`.
3. ساخت دکمه «محاسبه مقدماتی مایع» فقط در شاخه unlocked.
4. وجود فرمول‌های deterministic: `FF`, `ΔP_choked`, `Kv_nonchoked`, `Kv_choked`, `Cv = 1.156 × Kv`.
5. صحت عددی نمونه Liquid:
   - `ΔP ≈ 4`
   - `FF ≈ 0.9567`
   - `ΔP_choked ≈ 8.08`
   - `Kv ≈ 50`
   - `Cv ≈ 57.8`
6. رد کردن Gas/Steam در این فاز.
7. خطای اعتبارسنجی برای `P1 <= P2`.
8. نبود هیچ مسیر `fetch`, `window.print`, `document.write`, `exportPdf` در advanced prelim.

---

## 🔁 تستر به‌روزرسانی‌شده

### `_tools/uat/tester225-advanced-cv-draft-input.js`

چک «عدم محاسبه» با واقعیت v31.7.49 به‌روزرسانی شد: محاسبه مقدماتی مجاز است، اما final report/PDF همچنان قفل و ممنوع است.

---

## فایل‌های تغییر یافته/درگیر در تست

```text
tools/advanced-tools-ui.js
tools/index.html
tools/tools-ui.js
crm/index.html
crm/sw.js
crm/clear-cache.html
ADV-CV-INPUT-SCHEMA-v1.md
ADVANCED-CONTROL-VALVE-TOOLS-SPEC-v1.md
PTF-MASTER-HANDOVER.md
_tools/uat/tester225-advanced-cv-draft-input.js
_tools/uat/tester226-advanced-cv-prelim-calc.js
_tools/last-regression.json
REGRESSION-REPORT-v21.3.md  (auto-updated by regression runner)
RELEASE-NOTES-v31.7.49.md
REGRESSION-REPORT-v31.7.49.md
```

---

## دستورهای اجراشده

```bash
for f in assets/js/*.js crm/*.js tools/*.js _tools/uat/tester22*.js; do node --check "$f"; done
node _tools/uat/tester213-tools-free-pdf-paywall.js
node _tools/uat/tester217-advanced-tools-catalog-preview.js
node _tools/uat/tester224-advanced-cv-schema-ui.js
node _tools/uat/tester225-advanced-cv-draft-input.js
node _tools/uat/tester226-advanced-cv-prelim-calc.js
node _tools/run-full-regression.js
```

---

## نتیجه‌گیری نسبت به قاعده هنداور

✅ گیت رگرسیون کامل PASS شد:

- 204/204 فایل تستر PASS
- 4431/4431 چک PASS
- 0 FAIL
- 0 prebroken
- 0 hung

`python3 _tools/audit.py` نیز اجرا شد و نتیجه آن PASS بود:

```text
✅ همه بررسی‌ها PASS شدند.
```
