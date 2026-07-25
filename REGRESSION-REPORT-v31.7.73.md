# گزارش رگرسیون v31.7.73

**تاریخ:** ۱۴۰۵/۰۴/۳۰ (2026-07-21)  
**نسخه:** `v31.7.73`  
**موضوع:** ADV-CV-GAS-STEAM-PRELIM-001 — محاسبه مقدماتی Gas / Steam برای Advanced Control Valve

---

## نتیجه نهایی

| معیار | مقدار | وضعیت |
|---|---:|---|
| تعداد تسترها | **228** | — |
| فایل‌های PASS | **228** | PASS |
| فایل‌های FAIL | **0** | PASS |
| مجموع چک‌های PASS | **4759** | PASS |
| مجموع چک‌های FAIL | **0** | PASS |
| تستر جدید Gas/Steam | `tester250-advanced-cv-gas-steam-prelim.js` | 14/14 |

خروجی کامل runner:

```json
{
  "date": "2026-07-21T20:10:19.520Z",
  "version": "v31.7.73",
  "testers_total": 228,
  "files_pass": 228,
  "files_fail": 0,
  "checks_pass": 4759,
  "checks_fail": 0,
  "prebroken": [],
  "failed": [],
  "hung": [],
  "soft": []
}
```

---

## تستر جدید

### `_tools/uat/tester250-advanced-cv-gas-steam-prelim.js`

پوشش:

1. وجود `ADV-CV-GAS-STEAM-PRELIM-001`.
2. وجود توابع compressible/gas/steam.
3. وجود MW/Z/k/Xt در منطق.
4. وجود نمونه `gas_steam_screen`.
5. report preview از حالت Liquid-only خارج شده است.
6. نبود PDF/download/print/fetch/export.
7. runtime برای Gas.
8. runtime برای Steam.
9. حفظ block در تابع قدیمی Liquid-only.
10. fail-closed بدون grant.

نتیجه مستقیم:

```text
tester250-advanced-cv-gas-steam-prelim: 14 PASS / 0 FAIL
```

---

## رگرسیون میانی و رفع آن

در اجرای اول full regression، `tester239-advanced-cv-server-report-scaffold.js` یک FAIL داد چون frontend report draft از `ptfAdvCvCalculateLiquidCases` به مسیر عمومی `ptfAdvCvCalculateAdvancedCases` مهاجرت کرده بود. تست به‌روزرسانی شد تا مسیر phase-aware جدید را بپذیرد. سپس full regression کامل PASS شد.

---

## تست‌های محافظ مرتبط

```text
tester226-advanced-cv-prelim-calc: 18 PASS / 0 FAIL
tester232-advanced-cv-liquid-multicase: 14 PASS / 0 FAIL
tester237-advanced-cv-report-preview: 11 PASS / 0 FAIL
tester238-advanced-cv-locked-report-data: 13 PASS / 0 FAIL
tester247-advanced-cv-internal-scenario-qa: 11 PASS / 0 FAIL
tester250-advanced-cv-gas-steam-prelim: 14 PASS / 0 FAIL
tester227-storage-quota-foundation: 21 PASS / 0 FAIL
```

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
_tools/last-regression.json
REGRESSION-REPORT-v21.3.md  (auto-updated by regression runner)
RELEASE-NOTES-v31.7.73.md
REGRESSION-REPORT-v31.7.73.md
```

---

## دستورهای اجراشده

```bash
node --check tools/advanced-tools-ui.js
node --check tools/advanced-report-ui.js
node _tools/uat/tester250-advanced-cv-gas-steam-prelim.js
node _tools/uat/tester226-advanced-cv-prelim-calc.js
node _tools/uat/tester232-advanced-cv-liquid-multicase.js
node _tools/uat/tester237-advanced-cv-report-preview.js
node _tools/uat/tester238-advanced-cv-locked-report-data.js
node _tools/uat/tester247-advanced-cv-internal-scenario-qa.js
node _tools/uat/tester227-storage-quota-foundation.js
node _tools/run-full-regression.js
```

---

## نتیجه نسبت به گیت هنداور

رگرسیون کامل PASS شد:

- 228/228 فایل تستر PASS
- 4759/4759 چک PASS
- 0 FAIL
- 0 prebroken
- 0 hung

`python3 _tools/audit.py` نیز اجرا شد و نتیجه PASS بود:

```text
✅ همه بررسی‌ها PASS شدند.
```
