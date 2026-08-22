# REVERT — بازگردانی تغییرات UI هاب مالی (v34.7.97 → v34.7.101)

**تاریخ:** 2026-08-22 (۱۴۰۵/۰۵/۳۱)  
**دستور کارفرما:** «برگردون به حالت قبل از تغییرات رابط کاربری»  
**نسخهٔ فعلی پس از revert:** `v34.7.96`

## آنچه بازگردانی شد

پنج نسخه‌ی UI به‌طور کامل حذف شدند:

- **v34.7.101** — کاشی‌های KPI (کف 24px، سقف 34px)
- **v34.7.100** — اعداد درشت‌تر در دسکتاپ (سقف 28px)
- **v34.7.99** — اعداد کارت‌ها درشت‌تر (سقف 22px)
- **v34.7.98** — اعداد کامل ریالی + تب‌های افقی
- **v34.7.97** — فاز A هاب مالی UX (فرمت فشرده «میلیون/میلیارد» + گرید تب دسکتاپ)

## آنچه به حالت v34.7.96 برگشت

### فایل‌های کد
| فایل | حالت v34.7.96 |
|---|---|
| `crm/index.html` | CSS `.sc b`: `clamp(17px, 1.8vw, 24px)` + `white-space:normal` + `direction:rtl` (اصلی) |
| `crm/index.html` | CSS `.sr`: `minmax(150px, 1fr)` (اصلی) |
| `crm/index.html` | بدون `@media(min-width:900px)` برای نوار تب — نوار تب flex-wrap ساده |
| `crm/index.html` | CSS موبایل `#panels .sc b` بدون override (فقط `MOB-036` نوار تب) |
| `crm/moneyx.js` | بدون `ptfMoneyCompact` و `ptfMoneyCompactHtml` |
| `crm/fiscal.js` | بدون `moneyCard()` — همه از `money(v)` قدیمی |
| `crm/working-capital.js` | `card()` از `money(value)` — بدون `ptfMoneyCompactHtml` |
| `crm/ledger-report.js` | `block()` از `money(value)` — بدون `ptfMoneyCompactHtml` |
| `crm/treasury.js` | KPIها از `money(...)` قدیمی |
| `crm/supplier-finance.js` | `slLiquidity` با `minmax(150px)` و `money(...)` (بدون IRR در label برگشت) |

### فایل‌های تست
- `_tools/uat/tester498-v34.7.97-finhub-ux-phase-a.js` **حذف شد**
- `_tools/uat/run-ci-gate.js` به حالت v34.7.96 (بدون ثبت tester498)
- ۵۰ تستر دیگر: پین‌های نسخه به `v34.7.96` برگشت (طبق convention)

### فایل‌های نسخه
- `VERSION.json`: `crm_version: "v34.7.96"`
- ۷ نقطهٔ رسمی (index.html، sw.js، manifest.json، clear-cache.html، shell.js، sales-domain.php) همه به v34.7.96

### فایل‌های نوت انتشار حذف‌شده
- `RELEASE-NOTES-v34.7.97.md`
- `RELEASE-NOTES-v34.7.98.md`
- `RELEASE-NOTES-v34.7.99.md`
- `RELEASE-NOTES-v34.7.100.md`
- `RELEASE-NOTES-v34.7.101.md`

## آنچه نگه داشته شد (کارهای غیر UI که قبل از UI انجام شد)

این‌ها هیچ ارتباطی با UI نداشتند و حفظ شدند:

- **v34.7.94** — UAT پایانی VAT فصلی (tester496 با ۱۱ خانوادهٔ سناریو) + رفع تخلف A7 در `ptfSupFilesOpen`
- **v34.7.95** — RCA کلید ابری + فاز A ابزار «صف آپلود مجدد» ردهٔ E (tester497)
- **v34.7.96** — رفع باگ خاموش VAT در `seasonOfInv` (validation regex `^(13|14)\d{2}$`) + گارد نقش `ptfReuploadQueueExportCsv` + بازنویسی tester496 E2

### اسناد نگه داشته شده
- `UAT-VAT-QUARTERLY-FINAL-2026-08-22.md` — گزارش UAT VAT
- `RCA-CLOUD-KEYS-DEVIATION-2026-08-22.md` — تحلیل ۷ فرضیه انحراف کلید ابری
- `SELF-AUDIT-2026-08-22.md` — ممیزی اول
- `SELF-AUDIT-DEEP-2026-08-22.md` — ممیزی عمیق (۵ یافته)
- `UX-ASSESSMENT-FINANCE-HUB-2026-08-22.md` — **ارزیابی UX هاب مالی** (تحلیل صرف، بدون کد؛ برای مرجع آینده حفظ شد؛ اگر بخواهید حذف شود بگویید)

## اعتبارسنجی

- **گیت CI:** ۱۱۳ PASS / ۰ FAIL ✅ (از ۱۱۴ که با tester498 بود، به ۱۱۳ برگشت)
- **نگهبان معماری:** PASS ✅
- **VERSION.json:** v34.7.96
- **همه ۷ نقطهٔ رسمی:** v34.7.96 هم‌روز
- **کامنت‌های تاریخی** (v34.7.93 SUP-UX-002، v34.7.95 RE-UPLOAD-QUEUE-001، v34.7.96 VAT-LEDGER-004، v34.7.96 RE-UPLOAD-QUEUE-002) دست‌نخورده باقی ماندند.

## روش بازگردانی

به‌جای revert چند commit پیچیده (که conflict می‌داد چون همه یک قسمت را عوض کرده بودند)، فایل‌های آسیب‌دیده مستقیم از commit `a28f736` (v34.7.96) چک‌اوت شدند — تمیزترین راه.

## گام بعد

اگر تغییر UI جدید بخواهید، سند `UX-ASSESSMENT-FINANCE-HUB-2026-08-22.md` ۱۹ یافتهٔ کاربردی دارد که می‌تواند مبنای پیشنهاد بعدی باشد — با رویکردی متفاوت (مثلاً یک صفحهٔ آزمایشی جدا برای پیش‌نمایش قبل از merge).
