# گزارش رگرسیون v31.7.63

**تاریخ:** ۱۴۰۵/۰۴/۳۰ (2026-07-21)  
**نسخه:** `v31.7.63`  
**موضوع:** ADV-CV-REPORT-DRAFT-CRM-INBOX-001 — کارتابل CRM برای draft گزارش ابزارهای مهندسی

---

## نتیجه نهایی

| معیار | مقدار | وضعیت |
|---|---:|---|
| تعداد تسترها | **218** | — |
| فایل‌های PASS | **218** | PASS |
| فایل‌های FAIL | **0** | PASS |
| مجموع چک‌های PASS | **4627** | PASS |
| مجموع چک‌های FAIL | **0** | PASS |
| تستر جدید CRM Draft Inbox | `tester240-tools-report-draft-crm-inbox.js` | 14/14 |

خروجی کامل runner:

```json
{
  "date": "2026-07-21T14:34:52.454Z",
  "version": "v31.7.63",
  "testers_total": 218,
  "files_pass": 218,
  "files_fail": 0,
  "checks_pass": 4627,
  "checks_fail": 0,
  "prebroken": [],
  "failed": [],
  "hung": [],
  "soft": []
}
```

---

## تستر جدید

### `_tools/uat/tester240-tools-report-draft-crm-inbox.js`

پوشش:

1. وجود `admin_report_drafts` و `admin_report_draft_get`.
2. محافظت endpointها با `tools_admin_require`.
3. summary بدون PDF/final/download.
4. وجود project/readiness/risk/gov در summary.
5. لود شدن `crm/tool-report-drafts.js?v=31.7.63`.
6. نمایش فقط برای admin/chairman.
7. تزریق به Settings.
8. فراخوانی admin_report_drafts/admin_report_draft_get.
9. ارسال `X-CRM-Token`.
10. جدول draftها با Draft ID / Project / License / Governing / Risk / Readiness.
11. modal مشاهده جزئیات payload قفل‌شده.
12. نبود print/PDF/download/export.

نتیجه مستقیم:

```text
tester240-tools-report-draft-crm-inbox: 14 PASS / 0 FAIL
```

---

## تست‌های محافظ مرتبط

```text
tester231-tools-license-admin: 17 PASS / 0 FAIL
tester239-advanced-cv-server-report-scaffold: 15 PASS / 0 FAIL
tester240-tools-report-draft-crm-inbox: 14 PASS / 0 FAIL
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
_tools/last-regression.json
REGRESSION-REPORT-v21.3.md  (auto-updated by regression runner)
RELEASE-NOTES-v31.7.63.md
REGRESSION-REPORT-v31.7.63.md
```

---

## دستورهای اجراشده

```bash
node --check crm/tool-report-drafts.js
node --check tools/advanced-report-ui.js
node --check tools/advanced-tools-ui.js
node _tools/uat/tester231-tools-license-admin.js
node _tools/uat/tester239-advanced-cv-server-report-scaffold.js
node _tools/uat/tester240-tools-report-draft-crm-inbox.js
node _tools/uat/tester227-storage-quota-foundation.js
for f in assets/js/*.js crm/*.js tools/*.js _tools/uat/tester24*.js _tools/uat/tester240-tools-report-draft-crm-inbox.js; do node --check "$f"; done
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

- 218/218 فایل تستر PASS
- 4627/4627 چک PASS
- 0 FAIL
- 0 prebroken
- 0 hung

`python3 _tools/audit.py` نیز اجرا شد و نتیجه PASS بود:

```text
✅ همه بررسی‌ها PASS شدند.
```
