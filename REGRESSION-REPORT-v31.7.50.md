# گزارش رگرسیون v31.7.50

**تاریخ:** ۱۴۰۵/۰۴/۳۰ (2026-07-21)  
**نسخه:** `v31.7.50`  
**موضوع:** STORAGE-QUOTA-FOUNDATION-001 — محافظ فوری حافظه محلی CRM

---

## نتیجه نهایی

| معیار | مقدار | وضعیت |
|---|---:|---|
| تعداد تسترها | **205** | — |
| فایل‌های PASS | **205** | PASS |
| فایل‌های FAIL | **0** | PASS |
| مجموع چک‌های PASS | **4452** | PASS |
| مجموع چک‌های FAIL | **0** | PASS |
| تستر جدید Storage Quota | `tester227-storage-quota-foundation.js` | 21/21 |

خروجی کامل runner:

```json
{
  "date": "2026-07-21T10:38:31.015Z",
  "version": "v31.7.50",
  "testers_total": 205,
  "files_pass": 205,
  "files_fail": 0,
  "checks_pass": 4452,
  "checks_fail": 0,
  "prebroken": [],
  "failed": [],
  "hung": [],
  "soft": []
}
```

---

## تستر جدید

### `_tools/uat/tester227-storage-quota-foundation.js`

پوشش:

1. لود شدن `crm/storage-quota.js?v=31.7.50` قبل از `codegen.js` و `backup.js`.
2. bump نسخه CRM و service worker به `v31.7.50`.
3. تعریف سقف محافظه‌کارانه ۵MB برای localStorage.
4. وجود APIهای usage/health/topKeys/format.
5. وجود `ptfStorageSafeSetItem` و `ptfStorageFailedWrites`.
6. wrap شدن `Storage.prototype.setItem`.
7. شناسایی `QuotaExceededError` و اجرای emergency compact.
8. compact شدن volatileها: notifications, sendqueue, audit, web events, chat history, drafts, AI cache/history.
9. وجود helperهای IndexedDB برای backup/prerestore حجیم.
10. اتصال پنل تنظیمات/backup به API جدید.
11. smoke runtime برای کاهش audit به ۱۰۰۰ و web events به ۱۵۰.

نتیجه مستقیم:

```text
tester227-storage-quota-foundation: 21 PASS / 0 FAIL
```

---

## نکته رگرسیون میانی و رفع آن

در اجرای اول پس از تغییرات، `tester8-sprint71.js` یک FAIL داد:

```text
باکس بک‌آپ به تنظیمات اضافه شد
```

علت دقیق: هنگام جایگزینی بلوک Storage Health در `crm/backup.js`، hook قدیمی تزریق `backupBoxHtml() + ptfStorageMeterHtml()` به `buildSettings()` موقتاً حذف شده بود.

رفع: hook تنظیمات دوباره اضافه شد:

```js
var _buildSettings = window.buildSettings;
if (_buildSettings) {
  window.buildSettings = function () {
    return _buildSettings() + '<div style="max-width:620px">' + backupBoxHtml() + ptfStorageMeterHtml() + '</div>';
  };
}
```

پس از رفع، `tester8-sprint71.js` نتیجه داد:

```text
TESTER-8 (Sprint71): 61 PASS / 0 FAIL
```

و سپس رگرسیون کامل دوباره اجرا شد و کامل PASS شد.

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
_tools/last-regression.json
REGRESSION-REPORT-v21.3.md  (auto-updated by regression runner)
RELEASE-NOTES-v31.7.50.md
REGRESSION-REPORT-v31.7.50.md
```

---

## دستورهای اجراشده

```bash
node --check crm/storage-quota.js
node --check crm/backup.js
for f in assets/js/*.js crm/*.js tools/*.js _tools/uat/tester22*.js; do node --check "$f"; done
node _tools/uat/tester8-sprint71.js
node _tools/uat/tester14-sprint77.js
node _tools/uat/tester216-minimal-icons-policy.js
node _tools/uat/tester227-storage-quota-foundation.js
node _tools/run-full-regression.js
```

---

## نتیجه نسبت به گیت هنداور

رگرسیون کامل PASS شد:

- 205/205 فایل تستر PASS
- 4452/4452 چک PASS
- 0 FAIL
- 0 prebroken
- 0 hung

`python3 _tools/audit.py` نیز اجرا شد و نتیجه PASS بود:

```text
✅ همه بررسی‌ها PASS شدند.
```
