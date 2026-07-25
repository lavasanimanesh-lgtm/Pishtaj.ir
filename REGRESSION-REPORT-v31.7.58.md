# گزارش رگرسیون v31.7.58

**تاریخ:** ۱۴۰۵/۰۴/۳۰ (2026-07-21)  
**نسخه:** `v31.7.58`  
**موضوع:** ADV-CV-ACTUATOR-SHELL-001 — Actuator sizing shell مقدماتی برای Advanced Control Valve

---

## نتیجه نهایی

| معیار | مقدار | وضعیت |
|---|---:|---|
| تعداد تسترها | **213** | — |
| فایل‌های PASS | **213** | PASS |
| فایل‌های FAIL | **0** | PASS |
| مجموع چک‌های PASS | **4563** | PASS |
| مجموع چک‌های FAIL | **0** | PASS |
| تستر جدید Actuator Shell | `tester235-advanced-cv-actuator-shell.js` | 15/15 |

خروجی کامل runner:

```json
{
  "date": "2026-07-21T12:38:46.398Z",
  "version": "v31.7.58",
  "testers_total": 213,
  "files_pass": 213,
  "files_fail": 0,
  "checks_pass": 4563,
  "checks_fail": 0,
  "prebroken": [],
  "failed": [],
  "hung": [],
  "soft": []
}
```

---

## تستر جدید

### `_tools/uat/tester235-advanced-cv-actuator-shell.js`

پوشش:

1. وجود `ADV-CV-ACTUATOR-SHELL-001`.
2. وجود فیلدهای actuator در `FIELD_IDS` و UI.
3. وجود تابع `actuatorShell` و خروجی `Actuator sizing shell`.
4. وجود فرمول‌های seat area / fluid force / required thrust / equivalent diaphragm diameter.
5. نبود fetch/PDF/print/export.
6. محاسبه عددی seat=50mm، shutoff=10bar، packing=200N، safety=1.5، supply=4.5barg.
7. رفتار incomplete در نبود seat.
8. fallback از max operating ΔP در نبود shutoff.
9. هشدار rotary torque sizing.

نتیجه مستقیم:

```text
tester235-advanced-cv-actuator-shell: 15 PASS / 0 FAIL
```

---

## تست‌های محافظ مرتبط

```text
tester224-advanced-cv-schema-ui: 12 PASS / 0 FAIL
tester225-advanced-cv-draft-input: 13 PASS / 0 FAIL
tester226-advanced-cv-prelim-calc: 18 PASS / 0 FAIL
tester232-advanced-cv-liquid-multicase: 14 PASS / 0 FAIL
tester233-advanced-cv-velocity-reducer: 16 PASS / 0 FAIL
tester234-advanced-cv-cavitation-severity: 11 PASS / 0 FAIL
tester235-advanced-cv-actuator-shell: 15 PASS / 0 FAIL
```

---

## فایل‌های تغییر یافته/درگیر در تست

```text
tools/advanced-tools-ui.js
crm/index.html
crm/sw.js
crm/clear-cache.html
ADV-CV-INPUT-SCHEMA-v1.md
PTF-MASTER-HANDOVER.md
_tools/uat/tester227-storage-quota-foundation.js
_tools/uat/tester228-storage-idb-volatile-migration.js
_tools/uat/tester229-storage-idb-module-primary.js
_tools/uat/tester230-public-cache-idb.js
_tools/uat/tester231-tools-license-admin.js
_tools/uat/tester235-advanced-cv-actuator-shell.js
_tools/last-regression.json
REGRESSION-REPORT-v21.3.md  (auto-updated by regression runner)
RELEASE-NOTES-v31.7.58.md
REGRESSION-REPORT-v31.7.58.md
```

---

## دستورهای اجراشده

```bash
node --check tools/advanced-tools-ui.js
node _tools/uat/tester224-advanced-cv-schema-ui.js
node _tools/uat/tester225-advanced-cv-draft-input.js
node _tools/uat/tester226-advanced-cv-prelim-calc.js
node _tools/uat/tester232-advanced-cv-liquid-multicase.js
node _tools/uat/tester233-advanced-cv-velocity-reducer.js
node _tools/uat/tester234-advanced-cv-cavitation-severity.js
node _tools/uat/tester235-advanced-cv-actuator-shell.js
for f in assets/js/*.js crm/*.js tools/*.js _tools/uat/tester23*.js _tools/uat/tester235-advanced-cv-actuator-shell.js; do node --check "$f"; done
node _tools/run-full-regression.js
```

---

## نتیجه نسبت به گیت هنداور

رگرسیون کامل PASS شد:

- 213/213 فایل تستر PASS
- 4563/4563 چک PASS
- 0 FAIL
- 0 prebroken
- 0 hung

`python3 _tools/audit.py` نیز اجرا شد و نتیجه PASS بود:

```text
✅ همه بررسی‌ها PASS شدند.
```
