# گزارش رگرسیون v31.7.53

**تاریخ:** ۱۴۰۵/۰۴/۳۰ (2026-07-21)  
**نسخه:** `v31.7.53`  
**موضوع:** STORAGE-IDB-PUBLIC-CACHE-001 — انتقال public metrics/chat cache به IndexedDB

---

## نتیجه نهایی

| معیار | مقدار | وضعیت |
|---|---:|---|
| تعداد تسترها | **208** | — |
| فایل‌های PASS | **208** | PASS |
| فایل‌های FAIL | **0** | PASS |
| مجموع چک‌های PASS | **4490** | PASS |
| مجموع چک‌های FAIL | **0** | PASS |
| تستر جدید Public Cache IDB | `tester230-public-cache-idb.js` | 13/13 |

خروجی کامل runner:

```json
{
  "date": "2026-07-21T11:37:32.350Z",
  "version": "v31.7.53",
  "testers_total": 208,
  "files_pass": 208,
  "files_fail": 0,
  "checks_pass": 4490,
  "checks_fail": 0,
  "prebroken": [],
  "failed": [],
  "hung": [],
  "soft": []
}
```

---

## تستر جدید

### `_tools/uat/tester230-public-cache-idb.js`

پوشش:

1. نسخه `v31.7.53`.
2. `ptf-metrics.js` با full queue در IndexedDB و summary در localStorage.
3. metrics همچنان بدون `fetch`, `sendBeacon`, `XMLHttpRequest`.
4. `ptf-chat.js` با full history در IndexedDB و summary در localStorage.
5. حفظ loader مرکزی metrics در chat.
6. smoke runtime metrics:
   - ۱۴۰ event ثبت‌شده.
   - localStorage فقط ۸۰ summary.
   - IndexedDB full queue بزرگ‌تر.
7. smoke runtime chat:
   - ۲۵ پیام ارسال‌شده.
   - localStorage فقط ۱۶ summary.
   - IndexedDB full history بزرگ‌تر.

نتیجه مستقیم:

```text
tester230-public-cache-idb: 13 PASS / 0 FAIL
```

---

## تست‌های محافظ مرتبط

```text
tester209-web-metrics-foundation: 9 PASS / 0 FAIL
tester227-storage-quota-foundation: 21 PASS / 0 FAIL
tester228-storage-idb-volatile-migration: 12 PASS / 0 FAIL
tester229-storage-idb-module-primary: 13 PASS / 0 FAIL
tester230-public-cache-idb: 13 PASS / 0 FAIL
```

---

## فایل‌های تغییر یافته/درگیر در تست

```text
assets/js/ptf-metrics.js
assets/js/ptf-chat.js
crm/index.html
crm/sw.js
crm/clear-cache.html
PTF-MASTER-HANDOVER.md
_tools/uat/tester227-storage-quota-foundation.js
_tools/uat/tester228-storage-idb-volatile-migration.js
_tools/uat/tester229-storage-idb-module-primary.js
_tools/uat/tester230-public-cache-idb.js
_tools/last-regression.json
REGRESSION-REPORT-v21.3.md  (auto-updated by regression runner)
RELEASE-NOTES-v31.7.53.md
REGRESSION-REPORT-v31.7.53.md
```

---

## دستورهای اجراشده

```bash
node --check assets/js/ptf-metrics.js
node --check assets/js/ptf-chat.js
node _tools/uat/tester209-web-metrics-foundation.js
node _tools/uat/tester227-storage-quota-foundation.js
node _tools/uat/tester228-storage-idb-volatile-migration.js
node _tools/uat/tester229-storage-idb-module-primary.js
node _tools/uat/tester230-public-cache-idb.js
for f in assets/js/*.js crm/*.js tools/*.js _tools/uat/tester22*.js _tools/uat/tester230-public-cache-idb.js; do node --check "$f"; done
node _tools/run-full-regression.js
```

---

## نتیجه نسبت به گیت هنداور

رگرسیون کامل PASS شد:

- 208/208 فایل تستر PASS
- 4490/4490 چک PASS
- 0 FAIL
- 0 prebroken
- 0 hung

`python3 _tools/audit.py` نیز اجرا شد و نتیجه PASS بود:

```text
✅ همه بررسی‌ها PASS شدند.
```
