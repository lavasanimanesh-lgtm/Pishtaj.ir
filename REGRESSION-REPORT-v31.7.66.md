# گزارش رگرسیون v31.7.66

**تاریخ:** ۱۴۰۵/۰۴/۳۰ (2026-07-21)  
**نسخه:** `v31.7.66`  
**موضوع:** ADV-CV-REPORT-ENGINE-LOCKED-001 — رندر HTML داخلی و قفل‌شده گزارش Advanced Control Valve

---

## نتیجه نهایی

| معیار | مقدار | وضعیت |
|---|---:|---|
| تعداد تسترها | **221** | — |
| فایل‌های PASS | **221** | PASS |
| فایل‌های FAIL | **0** | PASS |
| مجموع چک‌های PASS | **4672** | PASS |
| مجموع چک‌های FAIL | **0** | PASS |
| تستر جدید Locked Report Engine | `tester243-tools-report-engine-locked.js` | 15/15 |

خروجی کامل runner:

```json
{
  "date": "2026-07-21T15:43:36.404Z",
  "version": "v31.7.66",
  "testers_total": 221,
  "files_pass": 221,
  "files_fail": 0,
  "checks_pass": 4672,
  "checks_fail": 0,
  "prebroken": [],
  "failed": [],
  "hung": [],
  "soft": []
}
```

---

## تستر جدید

### `_tools/uat/tester243-tools-report-engine-locked.js`

پوشش:

1. وجود `admin_report_render_locked`.
2. محافظت endpoint با `tools_admin_require`.
3. اجرای final readiness gate قبل از render.
4. وجود `tools_render_locked_report_html`.
5. وجود watermark `LOCKED INTERNAL HTML PREVIEW`.
6. ذخیره `lockedHtmlRender` و `htmlChecksum`.
7. حفظ final/PDF/download false.
8. وجود UI دکمه Locked HTML.
9. modal HTML داخلی قفل‌شده.
10. نبود print/PDF/download/export.

نتیجه مستقیم:

```text
tester243-tools-report-engine-locked: 15 PASS / 0 FAIL
```

---

## تست‌های محافظ مرتبط

```text
tester242-tools-final-readiness-gate: 16 PASS / 0 FAIL
tester243-tools-report-engine-locked: 15 PASS / 0 FAIL
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
_tools/last-regression.json
REGRESSION-REPORT-v21.3.md  (auto-updated by regression runner)
RELEASE-NOTES-v31.7.66.md
REGRESSION-REPORT-v31.7.66.md
```

---

## دستورهای اجراشده

```bash
node --check crm/tool-report-drafts.js
node _tools/uat/tester242-tools-final-readiness-gate.js
node _tools/uat/tester243-tools-report-engine-locked.js
node _tools/uat/tester241-tools-report-review-actions.js
node _tools/uat/tester227-storage-quota-foundation.js
for f in assets/js/*.js crm/*.js tools/*.js _tools/uat/tester24*.js _tools/uat/tester243-tools-report-engine-locked.js; do node --check "$f"; done
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

- 221/221 فایل تستر PASS
- 4672/4672 چک PASS
- 0 FAIL
- 0 prebroken
- 0 hung

`python3 _tools/audit.py` نیز اجرا شد و نتیجه PASS بود:

```text
✅ همه بررسی‌ها PASS شدند.
```
