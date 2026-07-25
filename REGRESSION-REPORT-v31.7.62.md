# گزارش رگرسیون v31.7.62

**تاریخ:** ۱۴۰۵/۰۴/۳۰ (2026-07-21)  
**نسخه:** `v31.7.62`  
**موضوع:** ADV-CV-SERVER-REPORT-SCAFFOLD-001 — scaffold سروری draft گزارش Advanced Control Valve

---

## نتیجه نهایی

| معیار | مقدار | وضعیت |
|---|---:|---|
| تعداد تسترها | **217** | — |
| فایل‌های PASS | **217** | PASS |
| فایل‌های FAIL | **0** | PASS |
| مجموع چک‌های PASS | **4613** | PASS |
| مجموع چک‌های FAIL | **0** | PASS |
| تستر جدید Server Report Scaffold | `tester239-advanced-cv-server-report-scaffold.js` | 15/15 |

خروجی کامل runner:

```json
{
  "date": "2026-07-21T14:06:57.928Z",
  "version": "v31.7.62",
  "testers_total": 217,
  "files_pass": 217,
  "files_fail": 0,
  "checks_pass": 4613,
  "checks_fail": 0,
  "prebroken": [],
  "failed": [],
  "hung": [],
  "soft": []
}
```

---

## تستر جدید

### `_tools/uat/tester239-advanced-cv-server-report-scaffold.js`

پوشش:

1. وجود `report_draft_create` در `api/tools.php`.
2. verify شدن grant.
3. validate شدن payload schema و checksum.
4. وجود stable JSON و checksum سمت سرور.
5. ذخیره runtime در `tool_report_drafts.json`.
6. safe output بدون PDF/final/download.
7. لود شدن `advanced-report-ui.js` بعد از `advanced-tools-ui.js`.
8. وجود `ptfAdvCvSubmitReportDraft`.
9. ارسال grant و payload به `report_draft_create`.
10. نبود PDF/print/export/download link.
11. نسخه CRM `v31.7.62`.

نتیجه مستقیم:

```text
tester239-advanced-cv-server-report-scaffold: 15 PASS / 0 FAIL
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
tester238-advanced-cv-locked-report-data: 13 PASS / 0 FAIL
tester239-advanced-cv-server-report-scaffold: 15 PASS / 0 FAIL
```

---

## فایل‌های تغییر یافته/درگیر در تست

```text
api/tools.php
tools/advanced-report-ui.js
tools/advanced-tools-ui.js
tools/index.html
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
_tools/uat/tester239-advanced-cv-server-report-scaffold.js
_tools/last-regression.json
REGRESSION-REPORT-v21.3.md  (auto-updated by regression runner)
RELEASE-NOTES-v31.7.62.md
REGRESSION-REPORT-v31.7.62.md
```

---

## دستورهای اجراشده

```bash
node --check tools/advanced-tools-ui.js
node --check tools/advanced-report-ui.js
node _tools/uat/tester237-advanced-cv-report-preview.js
node _tools/uat/tester238-advanced-cv-locked-report-data.js
node _tools/uat/tester239-advanced-cv-server-report-scaffold.js
node _tools/uat/tester231-tools-license-admin.js
node _tools/uat/tester227-storage-quota-foundation.js
for f in assets/js/*.js crm/*.js tools/*.js _tools/uat/tester23*.js _tools/uat/tester239-advanced-cv-server-report-scaffold.js; do node --check "$f"; done
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

- 217/217 فایل تستر PASS
- 4613/4613 چک PASS
- 0 FAIL
- 0 prebroken
- 0 hung

`python3 _tools/audit.py` نیز اجرا شد و نتیجه PASS بود:

```text
✅ همه بررسی‌ها PASS شدند.
```
