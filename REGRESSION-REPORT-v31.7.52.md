# گزارش رگرسیون v31.7.52

**تاریخ:** ۱۴۰۵/۰۴/۳۰ (2026-07-21)  
**نسخه:** `v31.7.52`  
**موضوع:** STORAGE-IDB-MODULE-PRIMARY-001 — direct IndexedDB برای AI Workbench و draftx

---

## نتیجه نهایی

| معیار | مقدار | وضعیت |
|---|---:|---|
| تعداد تسترها | **207** | — |
| فایل‌های PASS | **207** | PASS |
| فایل‌های FAIL | **0** | PASS |
| مجموع چک‌های PASS | **4477** | PASS |
| مجموع چک‌های FAIL | **0** | PASS |
| تستر جدید Module Primary | `tester229-storage-idb-module-primary.js` | 13/13 |

خروجی کامل runner:

```json
{
  "date": "2026-07-21T11:25:13.309Z",
  "version": "v31.7.52",
  "testers_total": 207,
  "files_pass": 207,
  "files_fail": 0,
  "checks_pass": 4477,
  "checks_fail": 0,
  "prebroken": [],
  "failed": [],
  "hung": [],
  "soft": []
}
```

---

## تستر جدید

### `_tools/uat/tester229-storage-idb-module-primary.js`

پوشش:

1. نسخه و cache-bust `v31.7.52`.
2. full history برای AI Workbench در IndexedDB.
3. summary سبک AI در localStorage.
4. restore async از IndexedDB در صورت نبود data در summary.
5. full draft برای draftx در IndexedDB.
6. summary سبک ۸ پیش‌نویس اخیر در localStorage.
7. drop/restore از IndexedDB.
8. smoke runtime برای AI و draftx.

نتیجه مستقیم:

```text
tester229-storage-idb-module-primary: 13 PASS / 0 FAIL
```

---

## رگرسیون میانی و رفع آن

در اولین اجرای full regression یک FAIL در `tester177-v322-codegen-fallbacks.js` دیده شد:

```text
fallback random عملیاتی از AI Workbench حذف شده
```

علت دقیق: برای ساخت شناسه داخلی history جدید AI از `Math.random()` استفاده شده بود. هرچند این شناسه کسب‌وکاری نبود، ولی طبق policy قبلی AI Workbench نباید fallback random عملیاتی داشته باشد.

رفع:

```js
window._aiWBHistSeq = (window._aiWBHistSeq || 0) + 1;
var rec = { id: 'AIH-' + Date.now().toString(36) + '-' + window._aiWBHistSeq, ... };
```

بعد از رفع:

```text
tester177-v322-codegen-fallbacks: 7 PASS / 0 FAIL
```

سپس full regression دوباره اجرا شد و کامل PASS شد.

---

## تست‌های محافظ مرتبط

```text
tester64-v144: 57 PASS / 0 FAIL
tester177-v322-codegen-fallbacks: 7 PASS / 0 FAIL
tester198-draft-everywhere: 15 PASS / 0 FAIL
tester227-storage-quota-foundation: 21 PASS / 0 FAIL
tester228-storage-idb-volatile-migration: 12 PASS / 0 FAIL
tester229-storage-idb-module-primary: 13 PASS / 0 FAIL
```

---

## فایل‌های تغییر یافته/درگیر در تست

```text
crm/ai-workbench.js
crm/draftx.js
crm/storage-quota.js
crm/index.html
crm/sw.js
crm/clear-cache.html
PTF-MASTER-HANDOVER.md
_tools/uat/tester227-storage-quota-foundation.js
_tools/uat/tester228-storage-idb-volatile-migration.js
_tools/uat/tester229-storage-idb-module-primary.js
_tools/last-regression.json
REGRESSION-REPORT-v21.3.md  (auto-updated by regression runner)
RELEASE-NOTES-v31.7.52.md
REGRESSION-REPORT-v31.7.52.md
```

---

## دستورهای اجراشده

```bash
node --check crm/ai-workbench.js
node --check crm/draftx.js
node --check crm/storage-quota.js
node _tools/uat/tester64-v144.js
node _tools/uat/tester177-v322-codegen-fallbacks.js
node _tools/uat/tester198-draft-everywhere.js
node _tools/uat/tester227-storage-quota-foundation.js
node _tools/uat/tester228-storage-idb-volatile-migration.js
node _tools/uat/tester229-storage-idb-module-primary.js
for f in assets/js/*.js crm/*.js tools/*.js _tools/uat/tester22*.js; do node --check "$f"; done
node _tools/run-full-regression.js
```

---

## نتیجه نسبت به گیت هنداور

رگرسیون کامل PASS شد:

- 207/207 فایل تستر PASS
- 4477/4477 چک PASS
- 0 FAIL
- 0 prebroken
- 0 hung

`python3 _tools/audit.py` نیز اجرا شد و نتیجه PASS بود:

```text
✅ همه بررسی‌ها PASS شدند.
```
