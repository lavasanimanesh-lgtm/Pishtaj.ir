# گزارش رگرسیون v31.7.51

**تاریخ:** ۱۴۰۵/۰۴/۳۰ (2026-07-21)  
**نسخه:** `v31.7.51`  
**موضوع:** STORAGE-IDB-VOLATILE-MIGRATION-001 — مهاجرت امن cache/draft/history به IndexedDB

---

## نتیجه نهایی

| معیار | مقدار | وضعیت |
|---|---:|---|
| تعداد تسترها | **206** | — |
| فایل‌های PASS | **206** | PASS |
| فایل‌های FAIL | **0** | PASS |
| مجموع چک‌های PASS | **4464** | PASS |
| مجموع چک‌های FAIL | **0** | PASS |
| تستر جدید IDB Migration | `tester228-storage-idb-volatile-migration.js` | 12/12 |
| تستر Storage Foundation | `tester227-storage-quota-foundation.js` | 21/21 |

خروجی کامل runner:

```json
{
  "date": "2026-07-21T10:49:49.376Z",
  "version": "v31.7.51",
  "testers_total": 206,
  "files_pass": 206,
  "files_fail": 0,
  "checks_pass": 4464,
  "checks_fail": 0,
  "prebroken": [],
  "failed": [],
  "hung": [],
  "soft": []
}
```

---

## تستر جدید

### `_tools/uat/tester228-storage-idb-volatile-migration.js`

پوشش:

1. وجود نسخه `v31.7.51-STORAGE-IDB-VOLATILE-MIGRATION-001` در `storage-quota.js`.
2. وجود `ptfStorageMigrateVolatileToIdb`.
3. وجود `ptfStorageArchiveIndex` و `ptfStorageShowArchiveIndex`.
4. هدف‌گیری keyهای volatile/cache و عدم migration رکوردهای اصلی.
5. وجود دکمه‌های «مهاجرت cache/draft به IndexedDB» و «آرشیوهای IndexedDB» در settings.
6. اجرای smoke با IndexedDB fake:
   - آرشیو شدن keyها.
   - کوچک‌تر شدن localStorage.
   - compact شدن web/chat/audit/AI history.
   - حذف AI cache از localStorage پس از archive.
   - تبدیل `ptf_backup_local` به marker IndexedDB.
   - ثبت sourceKeyها در archive index.

نتیجه مستقیم:

```text
tester228-storage-idb-volatile-migration: 12 PASS / 0 FAIL
```

---

## تست‌های محافظ قبلی

```text
tester8-sprint71: 61 PASS / 0 FAIL
tester14-sprint77: 8 PASS / 0 FAIL
tester227-storage-quota-foundation: 21 PASS / 0 FAIL
```

---

## فایل‌های تغییر یافته/درگیر در تست

```text
crm/storage-quota.js
crm/backup.js
crm/index.html
crm/sw.js
crm/clear-cache.html
PTF-MASTER-HANDOVER.md
_tools/uat/tester227-storage-quota-foundation.js
_tools/uat/tester228-storage-idb-volatile-migration.js
_tools/last-regression.json
REGRESSION-REPORT-v21.3.md  (auto-updated by regression runner)
RELEASE-NOTES-v31.7.51.md
REGRESSION-REPORT-v31.7.51.md
```

---

## دستورهای اجراشده

```bash
node --check crm/storage-quota.js
node --check crm/backup.js
node _tools/uat/tester8-sprint71.js
node _tools/uat/tester14-sprint77.js
node _tools/uat/tester227-storage-quota-foundation.js
node _tools/uat/tester228-storage-idb-volatile-migration.js
for f in assets/js/*.js crm/*.js tools/*.js _tools/uat/tester22*.js; do node --check "$f"; done
node _tools/run-full-regression.js
```

---

## نتیجه نسبت به گیت هنداور

رگرسیون کامل PASS شد:

- 206/206 فایل تستر PASS
- 4464/4464 چک PASS
- 0 FAIL
- 0 prebroken
- 0 hung

`python3 _tools/audit.py` نیز اجرا شد و نتیجه PASS بود:

```text
✅ همه بررسی‌ها PASS شدند.
```
