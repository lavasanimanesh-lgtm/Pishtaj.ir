# گزارش رگرسیون v31.7.69

**تاریخ:** ۱۴۰۵/۰۴/۳۰ (2026-07-21)  
**نسخه:** `v31.7.69`  
**موضوع:** ADV-CV-FEEDBACK-PACK-001 — بسته تست و feedback مهندسی برای Advanced Control Valve

---

## نتیجه نهایی

| معیار | مقدار | وضعیت |
|---|---:|---|
| تعداد تسترها | **224** | — |
| فایل‌های PASS | **224** | PASS |
| فایل‌های FAIL | **0** | PASS |
| مجموع چک‌های PASS | **4710** | PASS |
| مجموع چک‌های FAIL | **0** | PASS |
| تستر جدید Feedback Pack | `tester246-advanced-cv-feedback-pack.js` | 13/13 |

خروجی کامل runner:

```json
{
  "date": "2026-07-21T17:36:22.338Z",
  "version": "v31.7.69",
  "testers_total": 224,
  "files_pass": 224,
  "files_fail": 0,
  "checks_pass": 4710,
  "checks_fail": 0,
  "prebroken": [],
  "failed": [],
  "hung": [],
  "soft": []
}
```

---

## تستر جدید

### `_tools/uat/tester246-advanced-cv-feedback-pack.js`

پوشش:

1. وجود `ADV-CV-FEEDBACK-PACK-001`.
2. وجود سه سناریوی نمونه.
3. وجود توابع feedback pack.
4. وجود دکمه UI.
5. وجود قالب feedback مهندسی.
6. نبود PDF/download/print/fetch/export.
7. runtime بارگذاری sample baseline.
8. runtime محاسبه بعد از بارگذاری sample.
9. runtime sample high ΔP برای cavitation/noise.
10. کپی قالب feedback.
11. fail-closed بدون grant.

نتیجه مستقیم:

```text
tester246-advanced-cv-feedback-pack: 13 PASS / 0 FAIL
```

---

## تست‌های محافظ مرتبط

```text
tester224-advanced-cv-schema-ui: 12 PASS / 0 FAIL
tester237-advanced-cv-report-preview: 11 PASS / 0 FAIL
tester238-advanced-cv-locked-report-data: 13 PASS / 0 FAIL
tester245-mobile-login-user-merge: 11 PASS / 0 FAIL
tester246-advanced-cv-feedback-pack: 13 PASS / 0 FAIL
tester227-storage-quota-foundation: 21 PASS / 0 FAIL
```

---

## فایل‌های تغییر یافته/درگیر در تست

```text
tools/advanced-tools-ui.js
crm/index.html
crm/sw.js
crm/clear-cache.html
PTF-MASTER-HANDOVER.md
_tools/uat/tester227-storage-quota-foundation.js
_tools/uat/tester245-mobile-login-user-merge.js
_tools/uat/tester246-advanced-cv-feedback-pack.js
_tools/last-regression.json
REGRESSION-REPORT-v21.3.md  (auto-updated by regression runner)
RELEASE-NOTES-v31.7.69.md
REGRESSION-REPORT-v31.7.69.md
```

---

## دستورهای اجراشده

```bash
node _tools/uat/tester224-advanced-cv-schema-ui.js
node _tools/uat/tester237-advanced-cv-report-preview.js
node _tools/uat/tester238-advanced-cv-locked-report-data.js
node _tools/uat/tester245-mobile-login-user-merge.js
node _tools/uat/tester246-advanced-cv-feedback-pack.js
node _tools/uat/tester227-storage-quota-foundation.js
for f in assets/js/*.js crm/*.js tools/*.js _tools/uat/tester24*.js _tools/uat/tester246-advanced-cv-feedback-pack.js; do node --check "$f"; done
node _tools/run-full-regression.js
```

---

## نتیجه نسبت به گیت هنداور

رگرسیون کامل PASS شد:

- 224/224 فایل تستر PASS
- 4710/4710 چک PASS
- 0 FAIL
- 0 prebroken
- 0 hung

`python3 _tools/audit.py` نیز اجرا شد و نتیجه PASS بود:

```text
✅ همه بررسی‌ها PASS شدند.
```
