# گزارش رگرسیون v31.7.71

**تاریخ:** ۱۴۰۵/۰۴/۳۰ (2026-07-21)  
**نسخه:** `v31.7.71`  
**موضوع:** ADV-CV-UX-POLISH-001 — بازطراحی بصری و مرتب‌سازی RTL/LTR ابزار Advanced Control Valve

---

## نتیجه نهایی

| معیار | مقدار | وضعیت |
|---|---:|---|
| تعداد تسترها | **226** | — |
| فایل‌های PASS | **226** | PASS |
| فایل‌های FAIL | **0** | PASS |
| مجموع چک‌های PASS | **4733** | PASS |
| مجموع چک‌های FAIL | **0** | PASS |
| تستر جدید UX Polish | `tester248-advanced-cv-ux-polish.js` | 12/12 |

خروجی کامل runner:

```json
{
  "date": "2026-07-21T19:25:06.218Z",
  "version": "v31.7.71",
  "testers_total": 226,
  "files_pass": 226,
  "files_fail": 0,
  "checks_pass": 4733,
  "checks_fail": 0,
  "prebroken": [],
  "failed": [],
  "hung": [],
  "soft": []
}
```

---

## تستر جدید

### `_tools/uat/tester248-advanced-cv-ux-polish.js`

پوشش:

1. وجود `ADV-CV-UX-POLISH-001`.
2. وجود visual shell جدید با gradient و blur.
3. وجود header تیره sticky.
4. وجود stepper عددی 01..04.
5. وجود کنترل bidi و inputهای عددی LTR.
6. جدا شدن report outline انگلیسی در lane LTR.
7. sticky شدن action bar.
8. کارت‌بندی metrics/result.
9. حفظ دکمه‌های اصلی ابزار.
10. نبود PDF/download/print/fetch/export.
11. عدم افزودن emoji جدید در stepper/CTA.

نتیجه مستقیم:

```text
tester248-advanced-cv-ux-polish: 12 PASS / 0 FAIL
```

---

## تست‌های محافظ مرتبط

```text
tester224-advanced-cv-schema-ui: 12 PASS / 0 FAIL
tester246-advanced-cv-feedback-pack: 13 PASS / 0 FAIL
tester247-advanced-cv-internal-scenario-qa: 11 PASS / 0 FAIL
tester245-mobile-login-user-merge: 11 PASS / 0 FAIL
tester227-storage-quota-foundation: 21 PASS / 0 FAIL
tester248-advanced-cv-ux-polish: 12 PASS / 0 FAIL
```

---

## رگرسیون میانی و رفع آن

در اجرای quick test، `tester227-storage-quota-foundation.js` یک FAIL نسخه‌ای داد؛ علت این بود که regex نسخه‌های مجاز هنوز v31.7.71 را شامل نمی‌شد. تست به‌روزرسانی شد و سپس full regression کامل PASS شد.

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
_tools/uat/tester248-advanced-cv-ux-polish.js
_tools/last-regression.json
REGRESSION-REPORT-v21.3.md  (auto-updated by regression runner)
RELEASE-NOTES-v31.7.71.md
REGRESSION-REPORT-v31.7.71.md
```

---

## دستورهای اجراشده

```bash
node --check tools/advanced-tools-ui.js
node --check _tools/uat/tester248-advanced-cv-ux-polish.js
node _tools/uat/tester248-advanced-cv-ux-polish.js
node _tools/uat/tester224-advanced-cv-schema-ui.js
node _tools/uat/tester246-advanced-cv-feedback-pack.js
node _tools/uat/tester247-advanced-cv-internal-scenario-qa.js
node _tools/uat/tester245-mobile-login-user-merge.js
node _tools/uat/tester227-storage-quota-foundation.js
for f in assets/js/*.js crm/*.js tools/*.js _tools/uat/tester24*.js _tools/uat/tester248-advanced-cv-ux-polish.js; do node --check "$f"; done
node _tools/run-full-regression.js
```

---

## نتیجه نسبت به گیت هنداور

رگرسیون کامل PASS شد:

- 226/226 فایل تستر PASS
- 4733/4733 چک PASS
- 0 FAIL
- 0 prebroken
- 0 hung

`python3 _tools/audit.py` نیز اجرا شد و نتیجه PASS بود:

```text
✅ همه بررسی‌ها PASS شدند.
```
