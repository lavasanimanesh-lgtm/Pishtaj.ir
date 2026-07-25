# گزارش رگرسیون v31.7.60

**تاریخ:** ۱۴۰۵/۰۴/۳۰ (2026-07-21)  
**نسخه:** `v31.7.60`  
**موضوع:** ADV-CV-REPORT-PREVIEW-001 — پیش‌نمایش گزارش انگلیسی روی صفحه برای Advanced Control Valve

---

## نتیجه نهایی

| معیار | مقدار | وضعیت |
|---|---:|---|
| تعداد تسترها | **215** | — |
| فایل‌های PASS | **215** | PASS |
| فایل‌های FAIL | **0** | PASS |
| مجموع چک‌های PASS | **4585** | PASS |
| مجموع چک‌های FAIL | **0** | PASS |
| تستر جدید Report Preview | `tester237-advanced-cv-report-preview.js` | 11/11 |

خروجی کامل runner:

```json
{
  "date": "2026-07-21T13:04:17.554Z",
  "version": "v31.7.60",
  "testers_total": 215,
  "files_pass": 215,
  "files_fail": 0,
  "checks_pass": 4585,
  "checks_fail": 0,
  "prebroken": [],
  "failed": [],
  "hung": [],
  "soft": []
}
```

---

## تستر جدید

### `_tools/uat/tester237-advanced-cv-report-preview.js`

پوشش:

1. وجود `ADV-CV-REPORT-PREVIEW-001`.
2. وجود `ptfAdvCvBuildEnglishReportPreview` و `ptfAdvCvShowReportPreview`.
3. وجود `PREVIEW ONLY — NOT A FINAL REPORT`.
4. وجود سکشن‌های استاندارد انگلیسی.
5. دکمه «پیش‌نمایش گزارش انگلیسی».
6. نبود fetch/PDF/print/export/download link.
7. runtime report preview با Project/Tag/Results/Governing/Actuator/Risk/Noise.
8. محدودیت‌ها و عدم PDF/final در preview.
9. fail-closed بدون grant.

نتیجه مستقیم:

```text
tester237-advanced-cv-report-preview: 11 PASS / 0 FAIL
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
tester237-advanced-cv-report-preview: 11 PASS / 0 FAIL
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
_tools/uat/tester237-advanced-cv-report-preview.js
_tools/last-regression.json
REGRESSION-REPORT-v21.3.md  (auto-updated by regression runner)
RELEASE-NOTES-v31.7.60.md
REGRESSION-REPORT-v31.7.60.md
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
node _tools/uat/tester237-advanced-cv-report-preview.js
for f in assets/js/*.js crm/*.js tools/*.js _tools/uat/tester23*.js _tools/uat/tester237-advanced-cv-report-preview.js; do node --check "$f"; done
node _tools/run-full-regression.js
```

---

## نتیجه نسبت به گیت هنداور

رگرسیون کامل PASS شد:

- 215/215 فایل تستر PASS
- 4585/4585 چک PASS
- 0 FAIL
- 0 prebroken
- 0 hung

`python3 _tools/audit.py` نیز اجرا شد و نتیجه PASS بود:

```text
✅ همه بررسی‌ها PASS شدند.
```
