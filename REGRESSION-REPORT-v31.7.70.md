# گزارش رگرسیون v31.7.70

**تاریخ:** ۱۴۰۵/۰۴/۳۰ (2026-07-21)  
**نسخه:** `v31.7.70`  
**موضوع:** ADV-CV-INTERNAL-SCENARIO-QA-001 — QA داخلی سناریوهای Advanced Control Valve

---

## نتیجه نهایی

| معیار | مقدار | وضعیت |
|---|---:|---|
| تعداد تسترها | **225** | — |
| فایل‌های PASS | **225** | PASS |
| فایل‌های FAIL | **0** | PASS |
| مجموع چک‌های PASS | **4721** | PASS |
| مجموع چک‌های FAIL | **0** | PASS |
| تستر جدید Internal Scenario QA | `tester247-advanced-cv-internal-scenario-qa.js` | 11/11 |

خروجی کامل runner:

```json
{
  "date": "2026-07-21T18:18:18.496Z",
  "version": "v31.7.70",
  "testers_total": 225,
  "files_pass": 225,
  "files_fail": 0,
  "checks_pass": 4721,
  "checks_fail": 0,
  "prebroken": [],
  "failed": [],
  "hung": [],
  "soft": []
}
```

---

## تستر جدید

### `_tools/uat/tester247-advanced-cv-internal-scenario-qa.js`

پوشش:

1. وجود `ADV-CV-INTERNAL-SCENARIO-QA-001`.
2. وجود `ptfAdvCvRunInternalScenarioQa`.
3. اجرای سه سناریوی baseline/cavitation/reducer.
4. وجود ستون‌های Governing / Cavitation / Noise / Vmax / Actuator / Readiness / Checksum.
5. عدم وجود PDF/download/print/fetch/export.
6. runtime اجرای سه سناریو.
7. fail-closed بدون grant.

نتیجه مستقیم:

```text
tester247-advanced-cv-internal-scenario-qa: 11 PASS / 0 FAIL
```

---

## تست‌های محافظ مرتبط

```text
tester246-advanced-cv-feedback-pack: 13 PASS / 0 FAIL
tester247-advanced-cv-internal-scenario-qa: 11 PASS / 0 FAIL
tester245-mobile-login-user-merge: 11 PASS / 0 FAIL
tester227-storage-quota-foundation: 21 PASS / 0 FAIL
```

---

## رگرسیون میانی و رفع آن

در اجرای اول full regression، `tester227-storage-quota-foundation.js` یک FAIL نسخه‌ای داد. علت، assert cache-bust نسخه قدیمی بود. تست به نسخه v31.7.70 به‌روزرسانی شد و full regression دوباره کامل PASS شد.

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
_tools/uat/tester247-advanced-cv-internal-scenario-qa.js
_tools/last-regression.json
REGRESSION-REPORT-v21.3.md  (auto-updated by regression runner)
RELEASE-NOTES-v31.7.70.md
REGRESSION-REPORT-v31.7.70.md
```

---

## دستورهای اجراشده

```bash
node _tools/uat/tester246-advanced-cv-feedback-pack.js
node _tools/uat/tester247-advanced-cv-internal-scenario-qa.js
node _tools/uat/tester245-mobile-login-user-merge.js
node _tools/uat/tester227-storage-quota-foundation.js
for f in assets/js/*.js crm/*.js tools/*.js _tools/uat/tester24*.js _tools/uat/tester247-advanced-cv-internal-scenario-qa.js; do node --check "$f"; done
node _tools/run-full-regression.js
```

---

## نتیجه نسبت به گیت هنداور

رگرسیون کامل PASS شد:

- 225/225 فایل تستر PASS
- 4721/4721 چک PASS
- 0 FAIL
- 0 prebroken
- 0 hung

`python3 _tools/audit.py` نیز اجرا شد و نتیجه PASS بود:

```text
✅ همه بررسی‌ها PASS شدند.
```
