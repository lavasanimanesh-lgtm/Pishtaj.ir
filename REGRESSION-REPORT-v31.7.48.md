# 📊 گزارش رگرسیون v31.7.48

**تاریخ:** ۱۴۰۵/۰۴/۳۰ (2026-07-21)  
**نسخه:** `v31.7.48`  
**موضوع:** ADV-CV-DRAFT-INPUT-001 — ورود draft داده‌های Control Valve برای کاربر دارای لایسنس

---

## ✅ نتیجه نهایی

| معیار | مقدار | وضعیت |
|---|---:|---|
| تعداد تسترها | **203** | — |
| فایل‌های PASS | **203** | ✅ |
| فایل‌های FAIL | **0** | ✅ |
| مجموع چک‌های PASS | **4413** | ✅ |
| مجموع چک‌های FAIL | **0** | ✅ |
| تستر جدید Advanced CV Draft Input | `tester225-advanced-cv-draft-input.js` | ✅ 13/13 |
| تستر Advanced CV Schema UI | `tester224-advanced-cv-schema-ui.js` | ✅ 12/12 |

خروجی کامل runner:

```json
{
  "date": "2026-07-21T09:21:15.665Z",
  "version": "v31.7.48",
  "testers_total": 203,
  "files_pass": 203,
  "files_fail": 0,
  "checks_pass": 4413,
  "checks_fail": 0,
  "prebroken": [],
  "failed": [],
  "hung": [],
  "soft": []
}
```

---

## 🆕 تستر جدید

### `_tools/uat/tester225-advanced-cv-draft-input.js`

پوشش:

1. وجود `DRAFT_KEY = ptf_adv_cv_drafts` و نسخه draft.
2. unlock از `ptfToolsHasGrant('control_valve_advanced')` خوانده می‌شود.
3. فیلدها به‌صورت شرطی disabled/enabled می‌شوند.
4. توابع `ptfAdvCvCollectDraft`, `ptfAdvCvCheckCompleteness`, `ptfAdvCvSaveDraft` وجود دارند.
5. draft در localStorage ذخیره می‌شود، نه سرور.
6. required fields برای Liquid و Gas/Steam بررسی می‌شود.
7. completeness score و missing list روی UI نمایش داده می‌شود.
8. هیچ محاسبه نهایی یا PDF/report تولید نمی‌شود.

نتیجه مستقیم:

```text
tester225-advanced-cv-draft-input: 13 PASS / 0 FAIL
```

---

## 📁 فایل‌های تغییر یافته

```text
tools/advanced-tools-ui.js
crm/index.html
crm/sw.js
crm/clear-cache.html
PTF-MASTER-HANDOVER.md
_tools/last-regression.json
_tools/uat/tester225-advanced-cv-draft-input.js
RELEASE-NOTES-v31.7.48.md
REGRESSION-REPORT-v31.7.48.md
```

---

## 🚦 وضعیت گیت‌ها

- تستر اختصاصی Draft Input: ✅ PASS
- رگرسیون کامل UAT: ✅ PASS
- فایل FAIL: ✅ صفر
- چک FAIL: ✅ صفر
- audit.py: ✅ PASS

---

## راستی‌آزمایی پیشنهادی کارفرما

1. بدون کد فعال‌سازی وارد `/tools/` شوید.
2. فرم Control Valve Advanced را باز کنید؛ فیلدها باید disabled باشند.
3. با کد فعال‌سازی معتبر، grant بگیرید.
4. دوباره فرم را باز کنید؛ فیلدها باید قابل ورود باشند.
5. چند فیلد را پر کنید.
6. روی `Check completeness` بزنید؛ score و missing fields نمایش داده شود.
7. روی `Save draft locally` بزنید؛ draft در مرورگر ذخیره شود.
8. محاسبه نهایی و PDF همچنان نباید تولید شود.
