# گزارش رگرسیون v31.7.56

**تاریخ:** ۱۴۰۵/۰۴/۳۰ (2026-07-21)  
**نسخه:** `v31.7.56`  
**موضوع:** ADV-CV-VELOCITY-REDUCER-001 — Pipe velocity و reducer preliminary checks برای Advanced Control Valve

---

## نتیجه نهایی

| معیار | مقدار | وضعیت |
|---|---:|---|
| تعداد تسترها | **211** | — |
| فایل‌های PASS | **211** | PASS |
| فایل‌های FAIL | **0** | PASS |
| مجموع چک‌های PASS | **4537** | PASS |
| مجموع چک‌های FAIL | **0** | PASS |
| تستر جدید Velocity/Reducer | `tester233-advanced-cv-velocity-reducer.js` | 16/16 |

خروجی کامل runner:

```json
{
  "date": "2026-07-21T12:20:37.586Z",
  "version": "v31.7.56",
  "testers_total": 211,
  "files_pass": 211,
  "files_fail": 0,
  "checks_pass": 4537,
  "checks_fail": 0,
  "prebroken": [],
  "failed": [],
  "hung": [],
  "soft": []
}
```

---

## تستر جدید

### `_tools/uat/tester233-advanced-cv-velocity-reducer.js`

پوشش:

1. وجود `ADV-CV-VELOCITY-REDUCER-001`.
2. وجود `parsePipeIdMm` و `NPS_ID_MM`.
3. وجود `velocityFromQ` و `pipeVelocityChecks`.
4. خروجی جدول شامل `Vin m/s`, `Vout m/s`, `Reducer ratio`.
5. هشدارهای `Fp/FLp` و velocity.
6. نبود fetch/PDF/print/export.
7. parse عددی `NPS 4`, `DN100`, `ID 102 mm`.
8. محاسبه سرعت ورودی normal حدود 3.38 m/s برای NPS 4 و Q=100.
9. هشدار سرعت خروجی بالا برای DN80.
10. هشدار reducer correction.

نتیجه مستقیم:

```text
tester233-advanced-cv-velocity-reducer: 16 PASS / 0 FAIL
```

---

## تست‌های محافظ مرتبط

```text
tester224-advanced-cv-schema-ui: 12 PASS / 0 FAIL
tester225-advanced-cv-draft-input: 13 PASS / 0 FAIL
tester226-advanced-cv-prelim-calc: 18 PASS / 0 FAIL
tester232-advanced-cv-liquid-multicase: 14 PASS / 0 FAIL
tester233-advanced-cv-velocity-reducer: 16 PASS / 0 FAIL
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
_tools/uat/tester232-advanced-cv-liquid-multicase.js
_tools/uat/tester233-advanced-cv-velocity-reducer.js
_tools/last-regression.json
REGRESSION-REPORT-v21.3.md  (auto-updated by regression runner)
RELEASE-NOTES-v31.7.56.md
REGRESSION-REPORT-v31.7.56.md
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
for f in assets/js/*.js crm/*.js tools/*.js _tools/uat/tester23*.js _tools/uat/tester233-advanced-cv-velocity-reducer.js; do node --check "$f"; done
node _tools/run-full-regression.js
```

---

## نتیجه نسبت به گیت هنداور

رگرسیون کامل PASS شد:

- 211/211 فایل تستر PASS
- 4537/4537 چک PASS
- 0 FAIL
- 0 prebroken
- 0 hung

`python3 _tools/audit.py` نیز اجرا شد و نتیجه PASS بود:

```text
✅ همه بررسی‌ها PASS شدند.
```
