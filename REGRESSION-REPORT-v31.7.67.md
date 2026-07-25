# گزارش رگرسیون v31.7.67

**تاریخ:** ۱۴۰۵/۰۴/۳۰ (2026-07-21)  
**نسخه:** `v31.7.67`  
**موضوع:** ADV-CV-REPORT-QUOTA-DRY-RUN-001 — Dry-run مصرف quota گزارش برای Advanced Control Valve

---

## نتیجه نهایی

| معیار | مقدار | وضعیت |
|---|---:|---|
| تعداد تسترها | **222** | — |
| فایل‌های PASS | **222** | PASS |
| فایل‌های FAIL | **0** | PASS |
| مجموع چک‌های PASS | **4686** | PASS |
| مجموع چک‌های FAIL | **0** | PASS |
| تستر جدید Quota Dry-run | `tester244-tools-report-quota-dry-run.js` | 14/14 |

خروجی کامل runner:

```json
{
  "date": "2026-07-21T16:03:21.924Z",
  "version": "v31.7.67",
  "testers_total": 222,
  "files_pass": 222,
  "files_fail": 0,
  "checks_pass": 4686,
  "checks_fail": 0,
  "prebroken": [],
  "failed": [],
  "hung": [],
  "soft": []
}
```

---

## تستر جدید

### `_tools/uat/tester244-tools-report-quota-dry-run.js`

پوشش:

1. وجود `admin_report_quota_dry_run`.
2. محافظت endpoint با `tools_admin_require`.
3. وجود `tools_build_quota_dry_run`.
4. وابستگی dry-run به final readiness gate.
5. بررسی license و remaining quota.
6. عدم کم کردن quota.
7. ذخیره `quotaDryRun` و `quotaDryRunHistory`.
8. نسخه API `v31.7.67`.
9. وجود UI و دکمه Quota dry-run.
10. وجود ستون Quota Dry-run.
11. modal quota before/after.
12. نبود print/PDF/download/export.

نتیجه مستقیم:

```text
tester244-tools-report-quota-dry-run: 14 PASS / 0 FAIL
```

---

## تست‌های محافظ مرتبط

```text
tester242-tools-final-readiness-gate: 16 PASS / 0 FAIL
tester243-tools-report-engine-locked: 15 PASS / 0 FAIL
tester244-tools-report-quota-dry-run: 14 PASS / 0 FAIL
tester241-tools-report-review-actions: 14 PASS / 0 FAIL
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
_tools/uat/tester243-tools-report-engine-locked.js
_tools/uat/tester244-tools-report-quota-dry-run.js
_tools/last-regression.json
REGRESSION-REPORT-v21.3.md  (auto-updated by regression runner)
RELEASE-NOTES-v31.7.67.md
REGRESSION-REPORT-v31.7.67.md
```

---

## دستورهای اجراشده

```bash
node --check crm/tool-report-drafts.js
node _tools/uat/tester242-tools-final-readiness-gate.js
node _tools/uat/tester243-tools-report-engine-locked.js
node _tools/uat/tester244-tools-report-quota-dry-run.js
node _tools/uat/tester241-tools-report-review-actions.js
node _tools/uat/tester227-storage-quota-foundation.js
for f in assets/js/*.js crm/*.js tools/*.js _tools/uat/tester24*.js _tools/uat/tester244-tools-report-quota-dry-run.js; do node --check "$f"; done
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

- 222/222 فایل تستر PASS
- 4686/4686 چک PASS
- 0 FAIL
- 0 prebroken
- 0 hung

`python3 _tools/audit.py` نیز اجرا شد و نتیجه PASS بود:

```text
✅ همه بررسی‌ها PASS شدند.
```
