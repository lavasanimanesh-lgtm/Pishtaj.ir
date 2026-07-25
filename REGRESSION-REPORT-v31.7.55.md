# گزارش رگرسیون v31.7.55

**تاریخ:** ۱۴۰۵/۰۴/۳۰ (2026-07-21)  
**نسخه:** `v31.7.55`  
**موضوع:** ADV-CV-LIQUID-MULTICASE-001 — محاسبه مقدماتی Min/Normal/Max برای Advanced Control Valve

---

## نتیجه نهایی

| معیار | مقدار | وضعیت |
|---|---:|---|
| تعداد تسترها | **210** | — |
| فایل‌های PASS | **210** | PASS |
| فایل‌های FAIL | **0** | PASS |
| مجموع چک‌های PASS | **4521** | PASS |
| مجموع چک‌های FAIL | **0** | PASS |
| تستر جدید Advanced CV Multi-case | `tester232-advanced-cv-liquid-multicase.js` | 14/14 |

خروجی کامل runner:

```json
{
  "date": "2026-07-21T12:07:20.948Z",
  "version": "v31.7.55",
  "testers_total": 210,
  "files_pass": 210,
  "files_fail": 0,
  "checks_pass": 4521,
  "checks_fail": 0,
  "prebroken": [],
  "failed": [],
  "hung": [],
  "soft": []
}
```

---

## تستر جدید

### `_tools/uat/tester232-advanced-cv-liquid-multicase.js`

پوشش:

1. وجود `ptfAdvCvCalculateLiquidCases`.
2. وجود `adv_rated_cv` برای محاسبه opening%.
3. scope/final/pdf صریح برای خروجی مقدماتی.
4. نبود `fetch`, `window.print`, `document.write`, `exportPdf` در advanced UI.
5. محاسبه runtime سه case Min/Normal/Max.
6. حفظ مقدار Normal Cv حدود 57.8 برای نمونه رگرسیونی قبلی.
7. انتخاب governing case با بالاترین Cv.
8. محاسبه `recommendedCv = governingCv × 1.10`.
9. محاسبه opening% از rated Cv.
10. حفظ سازگاری `ptfAdvCvCalculatePrelim` با scope قبلی.
11. fail-closed بدون grant.
12. block بودن Gas/Steam در این فاز.

نتیجه مستقیم:

```text
tester232-advanced-cv-liquid-multicase: 14 PASS / 0 FAIL
```

---

## تست‌های محافظ مرتبط

```text
tester224-advanced-cv-schema-ui: 12 PASS / 0 FAIL
tester225-advanced-cv-draft-input: 13 PASS / 0 FAIL
tester226-advanced-cv-prelim-calc: 18 PASS / 0 FAIL
tester232-advanced-cv-liquid-multicase: 14 PASS / 0 FAIL
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
_tools/last-regression.json
REGRESSION-REPORT-v21.3.md  (auto-updated by regression runner)
RELEASE-NOTES-v31.7.55.md
REGRESSION-REPORT-v31.7.55.md
```

---

## دستورهای اجراشده

```bash
node --check tools/advanced-tools-ui.js
node _tools/uat/tester224-advanced-cv-schema-ui.js
node _tools/uat/tester225-advanced-cv-draft-input.js
node _tools/uat/tester226-advanced-cv-prelim-calc.js
node _tools/uat/tester232-advanced-cv-liquid-multicase.js
for f in assets/js/*.js crm/*.js tools/*.js _tools/uat/tester23*.js _tools/uat/tester232-advanced-cv-liquid-multicase.js; do node --check "$f"; done
node _tools/run-full-regression.js
```

---

## نتیجه نسبت به گیت هنداور

رگرسیون کامل PASS شد:

- 210/210 فایل تستر PASS
- 4521/4521 چک PASS
- 0 FAIL
- 0 prebroken
- 0 hung

`python3 _tools/audit.py` نیز اجرا شد و نتیجه PASS بود:

```text
✅ همه بررسی‌ها PASS شدند.
```
