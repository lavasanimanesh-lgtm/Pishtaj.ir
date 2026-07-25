# گزارش رگرسیون v31.7.74

**تاریخ:** ۱۴۰۵/۰۴/۳۰ (2026-07-21)  
**نسخه:** `v31.7.74`  
**موضوع:** ADV-CV-GAS-STEAM-UX-REFINE-001 — اصلاح UX و راهنمای ورودی Gas/Steam برای Advanced Control Valve

---

## نتیجه نهایی

| معیار | مقدار | وضعیت |
|---|---:|---|
| تعداد تسترها | **229** | — |
| فایل‌های PASS | **229** | PASS |
| فایل‌های FAIL | **0** | PASS |
| مجموع چک‌های PASS | **4771** | PASS |
| مجموع چک‌های FAIL | **0** | PASS |
| تستر جدید Gas/Steam UX | `tester251-advanced-cv-gas-steam-ux-refine.js` | 12/12 |

خروجی کامل runner:

```json
{
  "date": "2026-07-21T20:33:31.664Z",
  "version": "v31.7.74",
  "testers_total": 229,
  "files_pass": 229,
  "files_fail": 0,
  "checks_pass": 4771,
  "checks_fail": 0,
  "prebroken": [],
  "failed": [],
  "hung": [],
  "soft": []
}
```

---

## تستر جدید

### `_tools/uat/tester251-advanced-cv-gas-steam-ux-refine.js`

پوشش:

1. وجود `ADV-CV-GAS-STEAM-UX-REFINE-001`.
2. وجود فیلد `adv_flow_basis`.
3. وجود phase/unit guide.
4. وجود راهنمای Liquid/Gas/Steam/Two-phase.
5. placeholder مبنای دبی.
6. وجود Flow basis و MW/Z/k/Xt در report preview.
7. readiness فاز Gas با SG به‌جای MW.
8. نگهداری flowBasis در payload.
9. عدم وجود PDF/download/print/fetch/export.

نتیجه مستقیم:

```text
tester251-advanced-cv-gas-steam-ux-refine: 12 PASS / 0 FAIL
```

---

## تست‌های محافظ مرتبط

```text
tester250-advanced-cv-gas-steam-prelim: 14 PASS / 0 FAIL
tester251-advanced-cv-gas-steam-ux-refine: 12 PASS / 0 FAIL
tester237-advanced-cv-report-preview: 11 PASS / 0 FAIL
tester238-advanced-cv-locked-report-data: 13 PASS / 0 FAIL
tester247-advanced-cv-internal-scenario-qa: 11 PASS / 0 FAIL
tester227-storage-quota-foundation: 21 PASS / 0 FAIL
```

---

## رگرسیون میانی و رفع آن

در اجرای اول، `tester227-storage-quota-foundation.js` یک FAIL نسخه‌ای داد. Regex نسخه‌های مجاز به v31.7.74 به‌روزرسانی شد و سپس full regression کامل PASS شد.

همچنین مسیر report draft frontend از `ptfAdvCvCalculateLiquidCases` به `ptfAdvCvCalculateAdvancedCases` مهاجرت کرده بود؛ تست scaffold قبلاً با این مسیر phase-aware هماهنگ شده است.

---

## فایل‌های تغییر یافته/درگیر در تست

```text
tools/advanced-tools-ui.js
tools/advanced-report-ui.js
crm/index.html
crm/sw.js
crm/clear-cache.html
PTF-MASTER-HANDOVER.md
_tools/uat/tester227-storage-quota-foundation.js
_tools/uat/tester239-advanced-cv-server-report-scaffold.js
_tools/uat/tester247-advanced-cv-internal-scenario-qa.js
_tools/uat/tester250-advanced-cv-gas-steam-prelim.js
_tools/uat/tester251-advanced-cv-gas-steam-ux-refine.js
_tools/last-regression.json
REGRESSION-REPORT-v21.3.md  (auto-updated by regression runner)
RELEASE-NOTES-v31.7.74.md
REGRESSION-REPORT-v31.7.74.md
```

---

## دستورهای اجراشده

```bash
node --check tools/advanced-tools-ui.js
node --check tools/advanced-report-ui.js
node _tools/uat/tester251-advanced-cv-gas-steam-ux-refine.js
node _tools/uat/tester250-advanced-cv-gas-steam-prelim.js
node _tools/uat/tester237-advanced-cv-report-preview.js
node _tools/uat/tester238-advanced-cv-locked-report-data.js
node _tools/uat/tester247-advanced-cv-internal-scenario-qa.js
node _tools/uat/tester227-storage-quota-foundation.js
node _tools/run-full-regression.js
```

---

## نتیجه نسبت به گیت هنداور

رگرسیون کامل PASS شد:

- 229/229 فایل تستر PASS
- 4771/4771 چک PASS
- 0 FAIL
- 0 prebroken
- 0 hung

`python3 _tools/audit.py` نیز اجرا شد و نتیجه PASS بود:

```text
✅ همه بررسی‌ها PASS شدند.
```
