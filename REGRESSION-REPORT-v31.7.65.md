# گزارش رگرسیون v31.7.65

**تاریخ:** ۱۴۰۵/۰۴/۳۰ (2026-07-21)  
**نسخه:** `v31.7.65`  
**موضوع:** ADV-CV-FINAL-READINESS-GATE-001 — Final readiness gate برای draft گزارش Advanced Control Valve

---

## نتیجه نهایی

| معیار | مقدار | وضعیت |
|---|---:|---|
| تعداد تسترها | **220** | — |
| فایل‌های PASS | **220** | PASS |
| فایل‌های FAIL | **0** | PASS |
| مجموع چک‌های PASS | **4657** | PASS |
| مجموع چک‌های FAIL | **0** | PASS |
| تستر جدید Final Readiness Gate | `tester242-tools-final-readiness-gate.js` | 16/16 |

خروجی کامل runner:

```json
{
  "date": "2026-07-21T15:15:37.478Z",
  "version": "v31.7.65",
  "testers_total": 220,
  "files_pass": 220,
  "files_fail": 0,
  "checks_pass": 4657,
  "checks_fail": 0,
  "prebroken": [],
  "failed": [],
  "hung": [],
  "soft": []
}
```

---

## تستر جدید

### `_tools/uat/tester242-tools-final-readiness-gate.js`

پوشش:

1. وجود `admin_report_final_gate`.
2. محافظت endpoint با `tools_admin_require`.
3. وجود `tools_build_final_gate`.
4. الزام `approved_for_final_phase`.
5. بررسی checksum و locked flags.
6. بررسی readiness/missing/pipeIssues.
7. بررسی license active/expiry/quota/tool.
8. ذخیره finalGate و finalGateHistory.
9. حفظ final/PDF/quota false.
10. وجود UI Final Gate در CRM.
11. modal blockers/warnings.
12. نبود print/PDF/download/export.

نتیجه مستقیم:

```text
tester242-tools-final-readiness-gate: 16 PASS / 0 FAIL
```

---

## تست‌های محافظ مرتبط

```text
tester231-tools-license-admin: 17 PASS / 0 FAIL
tester239-advanced-cv-server-report-scaffold: 15 PASS / 0 FAIL
tester240-tools-report-draft-crm-inbox: 14 PASS / 0 FAIL
tester241-tools-report-review-actions: 14 PASS / 0 FAIL
tester242-tools-final-readiness-gate: 16 PASS / 0 FAIL
tester227-storage-quota-foundation: 21 PASS / 0 FAIL
```

---

## فایل‌های تغییر یافته/درگیر در تست

```text
api/tools.php
crm/tool-report-drafts.js
crm/index.html
crm/sw.js
crm/clear-cache.html
PTF-MASTER-HANDOVER.md
_tools/uat/tester227-storage-quota-foundation.js
_tools/uat/tester228-storage-idb-volatile-migration.js
_tools/uat/tester229-storage-idb-module-primary.js
_tools/uat/tester230-public-cache-idb.js
_tools/uat/tester231-tools-license-admin.js
_tools/uat/tester239-advanced-cv-server-report-scaffold.js
_tools/uat/tester240-tools-report-draft-crm-inbox.js
_tools/uat/tester241-tools-report-review-actions.js
_tools/uat/tester242-tools-final-readiness-gate.js
_tools/last-regression.json
REGRESSION-REPORT-v21.3.md  (auto-updated by regression runner)
RELEASE-NOTES-v31.7.65.md
REGRESSION-REPORT-v31.7.65.md
```

---

## دستورهای اجراشده

```bash
node --check crm/tool-report-drafts.js
node _tools/uat/tester231-tools-license-admin.js
node _tools/uat/tester239-advanced-cv-server-report-scaffold.js
node _tools/uat/tester240-tools-report-draft-crm-inbox.js
node _tools/uat/tester241-tools-report-review-actions.js
node _tools/uat/tester242-tools-final-readiness-gate.js
node _tools/uat/tester227-storage-quota-foundation.js
for f in assets/js/*.js crm/*.js tools/*.js _tools/uat/tester24*.js _tools/uat/tester242-tools-final-readiness-gate.js; do node --check "$f"; done
node _tools/run-full-regression.js
```

---

## محدودیت تست PHP

در sandbox فعلی `php` نصب نیست، پس syntax check مستقیم PHP اجرا نشد. پس از deploy روی هاست اجرا شود:

```bash
php -l api/tools.php
```

---

## نتیجه نسبت به گیت هنداور

رگرسیون کامل PASS شد:

- 220/220 فایل تستر PASS
- 4657/4657 چک PASS
- 0 FAIL
- 0 prebroken
- 0 hung

`python3 _tools/audit.py` نیز اجرا شد و نتیجه PASS بود:

```text
✅ همه بررسی‌ها PASS شدند.
```
