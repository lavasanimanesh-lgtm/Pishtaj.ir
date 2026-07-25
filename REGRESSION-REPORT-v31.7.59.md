# گزارش رگرسیون v31.7.59

**تاریخ:** ۱۴۰۵/۰۴/۳۰ (2026-07-21)  
**نسخه:** `v31.7.59`  
**موضوع:** ADV-CV-NOISE-DETAIL-001 — Preliminary noise risk detail برای Advanced Control Valve

---

## نتیجه نهایی

| معیار | مقدار | وضعیت |
|---|---:|---|
| تعداد تسترها | **214** | — |
| فایل‌های PASS | **214** | PASS |
| فایل‌های FAIL | **0** | PASS |
| مجموع چک‌های PASS | **4574** | PASS |
| مجموع چک‌های FAIL | **0** | PASS |
| تستر جدید Noise Detail | `tester236-advanced-cv-noise-detail.js` | 11/11 |

خروجی کامل runner:

```json
{
  "date": "2026-07-21T12:52:28.573Z",
  "version": "v31.7.59",
  "testers_total": 214,
  "files_pass": 214,
  "files_fail": 0,
  "checks_pass": 4574,
  "checks_fail": 0,
  "prebroken": [],
  "failed": [],
  "hung": [],
  "soft": []
}
```

---

## تستر جدید

### `_tools/uat/tester236-advanced-cv-noise-detail.js`

پوشش:

1. وجود `ADV-CV-NOISE-DETAIL-001`.
2. وجود `noiseRisk` و `noiseSummary`.
3. وجود ستون `Noise risk` و کارت `Overall noise risk`.
4. وجود سطوح Low/Watch/Medium/High/Severe.
5. وجود recommendationهای low-noise trim، IEC 60534-8 و vendor data.
6. نبود fetch/PDF/print/export.
7. runtime برای نمونه low/watch.
8. runtime برای نمونه high/severe.
9. وجود formula trace برای preliminary noise index.

نتیجه مستقیم:

```text
tester236-advanced-cv-noise-detail: 11 PASS / 0 FAIL
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
tester236-advanced-cv-noise-detail: 11 PASS / 0 FAIL
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
_tools/uat/tester236-advanced-cv-noise-detail.js
_tools/last-regression.json
REGRESSION-REPORT-v21.3.md  (auto-updated by regression runner)
RELEASE-NOTES-v31.7.59.md
REGRESSION-REPORT-v31.7.59.md
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
node _tools/uat/tester236-advanced-cv-noise-detail.js
for f in assets/js/*.js crm/*.js tools/*.js _tools/uat/tester23*.js _tools/uat/tester236-advanced-cv-noise-detail.js; do node --check "$f"; done
node _tools/run-full-regression.js
```

---

## نتیجه نسبت به گیت هنداور

رگرسیون کامل PASS شد:

- 214/214 فایل تستر PASS
- 4574/4574 چک PASS
- 0 FAIL
- 0 prebroken
- 0 hung

`python3 _tools/audit.py` نیز اجرا شد و نتیجه PASS بود:

```text
✅ همه بررسی‌ها PASS شدند.
```
