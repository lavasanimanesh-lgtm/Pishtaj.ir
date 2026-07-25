# گزارش رگرسیون v31.7.57

**تاریخ:** ۱۴۰۵/۰۴/۳۰ (2026-07-21)  
**نسخه:** `v31.7.57`  
**موضوع:** ADV-CV-CAVITATION-SEVERITY-001 — سطح‌بندی مقدماتی Cavitation / Flashing برای Advanced Control Valve

---

## نتیجه نهایی

| معیار | مقدار | وضعیت |
|---|---:|---|
| تعداد تسترها | **212** | — |
| فایل‌های PASS | **212** | PASS |
| فایل‌های FAIL | **0** | PASS |
| مجموع چک‌های PASS | **4548** | PASS |
| مجموع چک‌های FAIL | **0** | PASS |
| تستر جدید Cavitation Severity | `tester234-advanced-cv-cavitation-severity.js` | 11/11 |

خروجی کامل runner:

```json
{
  "date": "2026-07-21T12:30:11.691Z",
  "version": "v31.7.57",
  "testers_total": 212,
  "files_pass": 212,
  "files_fail": 0,
  "checks_pass": 4548,
  "checks_fail": 0,
  "prebroken": [],
  "failed": [],
  "hung": [],
  "soft": []
}
```

---

## تستر جدید

### `_tools/uat/tester234-advanced-cv-cavitation-severity.js`

پوشش:

1. وجود `ADV-CV-CAVITATION-SEVERITY-001`.
2. وجود `cavitationRisk` و `riskSummary`.
3. وجود Risk badge و ستون `Cavitation risk`.
4. وجود سطوح flashing/choked/high/medium/watch.
5. وجود recommendationهای anti-cavitation / Fp / FLp / vendor data.
6. نبود fetch/PDF/print/export.
7. runtime برای low risk.
8. runtime برای choked/severe.
9. runtime برای flashing likely.
10. وجود overall summary و per-case risk.

نتیجه مستقیم:

```text
tester234-advanced-cv-cavitation-severity: 11 PASS / 0 FAIL
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
_tools/uat/tester234-advanced-cv-cavitation-severity.js
_tools/last-regression.json
REGRESSION-REPORT-v21.3.md  (auto-updated by regression runner)
RELEASE-NOTES-v31.7.57.md
REGRESSION-REPORT-v31.7.57.md
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
for f in assets/js/*.js crm/*.js tools/*.js _tools/uat/tester23*.js _tools/uat/tester234-advanced-cv-cavitation-severity.js; do node --check "$f"; done
node _tools/run-full-regression.js
```

---

## نتیجه نسبت به گیت هنداور

رگرسیون کامل PASS شد:

- 212/212 فایل تستر PASS
- 4548/4548 چک PASS
- 0 FAIL
- 0 prebroken
- 0 hung

`python3 _tools/audit.py` نیز اجرا شد و نتیجه PASS بود:

```text
✅ همه بررسی‌ها PASS شدند.
```
