# گزارش رگرسیون v31.7.64

**تاریخ:** ۱۴۰۵/۰۴/۳۰ (2026-07-21)  
**نسخه:** `v31.7.64`  
**موضوع:** ADV-CV-REPORT-REVIEW-ACTIONS-001 — وضعیت‌های review داخلی برای draft گزارش ابزارهای مهندسی

---

## نتیجه نهایی

| معیار | مقدار | وضعیت |
|---|---:|---|
| تعداد تسترها | **219** | — |
| فایل‌های PASS | **219** | PASS |
| فایل‌های FAIL | **0** | PASS |
| مجموع چک‌های PASS | **4641** | PASS |
| مجموع چک‌های FAIL | **0** | PASS |
| تستر جدید Review Actions | `tester241-tools-report-review-actions.js` | 14/14 |

خروجی کامل runner:

```json
{
  "date": "2026-07-21T14:59:22.190Z",
  "version": "v31.7.64",
  "testers_total": 219,
  "files_pass": 219,
  "files_fail": 0,
  "checks_pass": 4641,
  "checks_fail": 0,
  "prebroken": [],
  "failed": [],
  "hung": [],
  "soft": []
}
```

---

## تستر جدید

### `_tools/uat/tester241-tools-report-review-actions.js`

پوشش:

1. وجود `admin_report_draft_update`.
2. محافظت endpoint با `tools_admin_require`.
3. statusهای مجاز review.
4. ذخیره review history کوتاه.
5. ذخیره review note/by/at.
6. عدم تولید final/PDF/download.
7. لود UI با نسخه `v31.7.64`.
8. وجود دکمه‌های Reviewed / Needs data / Approved / Rejected / Duplicate.
9. گرفتن note با prompt.
10. نمایش ستون Review و badge وضعیت.
11. نمایش reviewStatus/reviewNote/reviewedBy/reviewedAt در modal.
12. نبود print/PDF/download/export.

نتیجه مستقیم:

```text
tester241-tools-report-review-actions: 14 PASS / 0 FAIL
```

---

## تست‌های محافظ مرتبط

```text
tester231-tools-license-admin: 17 PASS / 0 FAIL
tester239-advanced-cv-server-report-scaffold: 15 PASS / 0 FAIL
tester240-tools-report-draft-crm-inbox: 14 PASS / 0 FAIL
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
_tools/last-regression.json
REGRESSION-REPORT-v21.3.md  (auto-updated by regression runner)
RELEASE-NOTES-v31.7.64.md
REGRESSION-REPORT-v31.7.64.md
```

---

## دستورهای اجراشده

```bash
node --check crm/tool-report-drafts.js
node _tools/uat/tester240-tools-report-draft-crm-inbox.js
node _tools/uat/tester241-tools-report-review-actions.js
node _tools/uat/tester239-advanced-cv-server-report-scaffold.js
node _tools/uat/tester231-tools-license-admin.js
node _tools/uat/tester227-storage-quota-foundation.js
for f in assets/js/*.js crm/*.js tools/*.js _tools/uat/tester24*.js _tools/uat/tester241-tools-report-review-actions.js; do node --check "$f"; done
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

- 219/219 فایل تستر PASS
- 4641/4641 چک PASS
- 0 FAIL
- 0 prebroken
- 0 hung

`python3 _tools/audit.py` نیز اجرا شد و نتیجه PASS بود:

```text
✅ همه بررسی‌ها PASS شدند.
```
