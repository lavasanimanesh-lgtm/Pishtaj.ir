# گزارش رگرسیون v31.7.54

**تاریخ:** ۱۴۰۵/۰۴/۳۰ (2026-07-21)  
**نسخه:** `v31.7.54`  
**موضوع:** TOOLS-LICENSE-ADMIN-001 — پنل صدور و مدیریت لایسنس ابزارهای مهندسی

---

## نتیجه نهایی

| معیار | مقدار | وضعیت |
|---|---:|---|
| تعداد تسترها | **209** | — |
| فایل‌های PASS | **209** | PASS |
| فایل‌های FAIL | **0** | PASS |
| مجموع چک‌های PASS | **4507** | PASS |
| مجموع چک‌های FAIL | **0** | PASS |
| تستر جدید License Admin | `tester231-tools-license-admin.js` | 17/17 |

خروجی کامل runner:

```json
{
  "date": "2026-07-21T11:54:21.826Z",
  "version": "v31.7.54",
  "testers_total": 209,
  "files_pass": 209,
  "files_fail": 0,
  "checks_pass": 4507,
  "checks_fail": 0,
  "prebroken": [],
  "failed": [],
  "hung": [],
  "soft": []
}
```

---

## تستر جدید

### `_tools/uat/tester231-tools-license-admin.js`

پوشش:

1. وجود اکشن‌های `admin_list`, `admin_issue`, `admin_update`.
2. محافظت API با `auth.php` و JWT.
3. محدودیت نقش به `admin/chairman`.
4. تولید کد خام با `random_bytes`.
5. ذخیره فقط `tokenHash`.
6. عدم نمایش raw/tokenHash در safe output.
7. ذخیره runtime با wrapper `licenses`.
8. validate نوع/ابزار/وضعیت.
9. لود `crm/tool-licenses.js?v=31.7.54`.
10. تزریق پنل به Settings.
11. ارسال `X-CRM-Token`.
12. صدور staff license.
13. تغییر وضعیت active/suspended/revoked.

نتیجه مستقیم:

```text
tester231-tools-license-admin: 17 PASS / 0 FAIL
```

---

## تست‌های محافظ مرتبط

```text
tester214-tools-manual-license: 14 PASS / 0 FAIL
tester227-storage-quota-foundation: 21 PASS / 0 FAIL
tester230-public-cache-idb: 13 PASS / 0 FAIL
tester231-tools-license-admin: 17 PASS / 0 FAIL
```

---

## فایل‌های تغییر یافته/درگیر در تست

```text
api/tools.php
crm/tool-licenses.js
crm/index.html
crm/sw.js
crm/clear-cache.html
PTF-MASTER-HANDOVER.md
_tools/uat/tester227-storage-quota-foundation.js
_tools/uat/tester228-storage-idb-volatile-migration.js
_tools/uat/tester229-storage-idb-module-primary.js
_tools/uat/tester230-public-cache-idb.js
_tools/uat/tester231-tools-license-admin.js
_tools/last-regression.json
REGRESSION-REPORT-v21.3.md  (auto-updated by regression runner)
RELEASE-NOTES-v31.7.54.md
REGRESSION-REPORT-v31.7.54.md
```

---

## دستورهای اجراشده

```bash
node --check crm/tool-licenses.js
node _tools/uat/tester214-tools-manual-license.js
node _tools/uat/tester227-storage-quota-foundation.js
node _tools/uat/tester230-public-cache-idb.js
node _tools/uat/tester231-tools-license-admin.js
for f in assets/js/*.js crm/*.js tools/*.js _tools/uat/tester23*.js _tools/uat/tester231-tools-license-admin.js; do node --check "$f"; done
node _tools/run-full-regression.js
```

---

## نتیجه نسبت به گیت هنداور

رگرسیون کامل PASS شد:

- 209/209 فایل تستر PASS
- 4507/4507 چک PASS
- 0 FAIL
- 0 prebroken
- 0 hung

`python3 _tools/audit.py` نیز اجرا شد و نتیجه PASS بود:

```text
✅ همه بررسی‌ها PASS شدند.
```
