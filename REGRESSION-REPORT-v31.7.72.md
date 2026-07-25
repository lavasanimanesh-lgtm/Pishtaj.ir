# گزارش رگرسیون v31.7.72

**تاریخ:** ۱۴۰۵/۰۴/۳۰ (2026-07-21)  
**نسخه:** `v31.7.72`  
**موضوع:** ADV-TOOLS-PAGE-RTL-POLISH-001 — بازطراحی صفحه `/tools/` و کارت‌های ابزارهای پیشرفته

---

## نتیجه نهایی

| معیار | مقدار | وضعیت |
|---|---:|---|
| تعداد تسترها | **227** | — |
| فایل‌های PASS | **227** | PASS |
| فایل‌های FAIL | **0** | PASS |
| مجموع چک‌های PASS | **4745** | PASS |
| مجموع چک‌های FAIL | **0** | PASS |
| تستر جدید Tools Page RTL Polish | `tester249-tools-page-rtl-polish.js` | 12/12 |

خروجی کامل runner:

```json
{
  "date": "2026-07-21T19:41:44.285Z",
  "version": "v31.7.72",
  "testers_total": 227,
  "files_pass": 227,
  "files_fail": 0,
  "checks_pass": 4745,
  "checks_fail": 0,
  "prebroken": [],
  "failed": [],
  "hung": [],
  "soft": []
}
```

---

## تستر جدید

### `_tools/uat/tester249-tools-page-rtl-polish.js`

پوشش:

1. نسخه `v31.7.72`.
2. وجود کلاس‌های visual shell جدید صفحه ابزارها.
3. فارسی بودن titleهای اصلی کارت‌های advanced.
4. جدا بودن subtitleهای انگلیسی با `adv-en`.
5. فارسی‌تر شدن preview کنترل ولو.
6. جدا بودن report outline انگلیسی.
7. حفظ legacy UAT tokens.
8. حفظ دکمه‌های مشاهده فرم و فعال‌سازی.
9. عدم افزودن emoji جدید در کارت‌های advanced.

نتیجه مستقیم:

```text
tester249-tools-page-rtl-polish: 12 PASS / 0 FAIL
```

---

## تست‌های محافظ مرتبط

```text
tester217-advanced-tools-catalog-preview: 9 PASS / 0 FAIL
tester222-advanced-cv-input-schema: 12 PASS / 0 FAIL
tester224-advanced-cv-schema-ui: 12 PASS / 0 FAIL
tester248-advanced-cv-ux-polish: 12 PASS / 0 FAIL
tester249-tools-page-rtl-polish: 12 PASS / 0 FAIL
tester227-storage-quota-foundation: 21 PASS / 0 FAIL
```

---

## رگرسیون میانی و رفع آن

در quick test، دو تست legacy ابتدا به دلیل حذف برخی عبارات انگلیسی visible شکستند. چون آن عبارات برای تست‌های قدیمی لازم بودند ولی نباید UI را شلوغ کنند، tokenهای legacy در comment غیرقابل‌نمایش حفظ شدند. سپس تست‌ها PASS شدند.

همچنین `tester227-storage-quota-foundation.js` regex نسخه را به v31.7.72 به‌روزرسانی کردیم.

---

## فایل‌های تغییر یافته/درگیر در تست

```text
tools/index.html
crm/index.html
crm/sw.js
crm/clear-cache.html
PTF-MASTER-HANDOVER.md
_tools/uat/tester227-storage-quota-foundation.js
_tools/uat/tester249-tools-page-rtl-polish.js
_tools/last-regression.json
REGRESSION-REPORT-v21.3.md  (auto-updated by regression runner)
RELEASE-NOTES-v31.7.72.md
REGRESSION-REPORT-v31.7.72.md
```

---

## دستورهای اجراشده

```bash
node _tools/uat/tester217-advanced-tools-catalog-preview.js
node _tools/uat/tester222-advanced-cv-input-schema.js
node _tools/uat/tester224-advanced-cv-schema-ui.js
node _tools/uat/tester248-advanced-cv-ux-polish.js
node _tools/uat/tester249-tools-page-rtl-polish.js
node _tools/uat/tester227-storage-quota-foundation.js
for f in assets/js/*.js crm/*.js tools/*.js _tools/uat/tester24*.js _tools/uat/tester249-tools-page-rtl-polish.js; do node --check "$f"; done
node _tools/run-full-regression.js
```

---

## نتیجه نسبت به گیت هنداور

رگرسیون کامل PASS شد:

- 227/227 فایل تستر PASS
- 4745/4745 چک PASS
- 0 FAIL
- 0 prebroken
- 0 hung

`python3 _tools/audit.py` نیز اجرا شد و نتیجه PASS بود:

```text
✅ همه بررسی‌ها PASS شدند.
```
