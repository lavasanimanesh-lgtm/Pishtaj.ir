# یادداشت انتشار CRM v34.8.35 — نازک‌سازی T0: گیت‌ها را به CI وصل می‌کند

**تاریخ:** ۲۰۲۶-۰۸-۲۸ | **نسخهٔ قبلی:** v34.8.34 | **مبنای کار:** `ARENA-THIN-CLIENT-STATUS-AUDIT-2026-08-28.md` (یافته‌های F-1 تا F-7) و `ROADMAP-THIN-CLIENT-MAXIMAL-2026-08-27.md` (بندهای T0-3، T0-4، T0-6، T5-1)
**نوع:** فنی/زیرساختی — بدون تغییر رفتار UI برای کاربر

---

## ۱) T0-3 — گیت CI بالاخره در CI اجرا می‌شود (یافتهٔ F-1)

تا v34.8.34، `run-ci-gate.js` (۱۵۰ تستر قرارداد + arch-guard) **فقط دستی/محلی** اجرا می‌شد؛ هیچ
workflow آن را صدا نمی‌زد. از این نسخه:

- پوستهٔ `_tools/ci/ci-gate-step.sh` اضافه شد: گیت را اجرا می‌کند، خط جمع‌بندی
  `=== CI gate: N PASS / M FAIL ===` را **الزام** می‌کند (نبودش = شکست، نه سبزِ جعلی)،
  و سیاست `block` (پیش‌فرض، توقف استقرار) یا `warn` (هشدار و ادامه) را از متغیر Actions
  `CI_GATE_POLICY` می‌خواند.
- خودآزمون ۷ سناریو دارد (`bash _tools/ci/ci-gate-step.sh --self-test`) از جمله «exit 0 ولی
  شمارش FAIL>0» — همان الگویی که باعث پاسِ گمراه‌کننده می‌شد.
- `tester431` که ادعای «نگهبان به گیت CI وصل است» را فقط با خواندن متن `run-ci-gate.js`
  اثبات می‌کرد، حالا از سورس درست می‌پرسد (`_tools/uat/lib-deploy-gates.js`).
- **اعمال در workflow:** به دلیل نداشتن مجوز `workflows` توسط GitHub App، تغییر سه فایل
  `.github/workflows/*` به‌صورت پچ + راهنما آمده است → `WORKFLOW-T0-GATES-APPLY-GUIDE-2026-08-28.md`
  و `_tools/PENDING-workflow-t0-gates-v34.8.35.patch`. تا اعمال نشدن، `tester536` presence
  پچِ **اعمال‌شدنی** را الزام می‌کند تا گیت‌ها بی‌صدا گم نشوند.

## ۲) T0-4 — «فایل زنده == همین کامیت» بعد از FTP

- `_tools/ci/post-deploy-hash-check.sh`: هش فایل‌های حیاتی زنده (staging/production) را با
  working tree مقایسه می‌کند؛ با کش‌شکن (`?ptfcb=`)، تلاش مجدد (پیش‌فرض ۶×) و گزارش «اولین بایت
  متفاوت» برای تشخیص سریع. خودآزمون ۱۳ سناریو با سرور محلی دارد.
- `api/deploy-probe.php` (جدید): فایل‌های PHP را نمی‌توان روی HTTP هش خام گرفت (اجرا/مسدود
  می‌شوند)، پس پروب، SHA-1 و اندازهٔ **فقط یک فهرست ثابت** از فایل‌های نسخه‌ای را روی سرور
  محاسبه می‌کند. دادهٔ کسب‌وکار، مسیر مطلق و mtime بیرون نمی‌رود. `deploy-probe` به allowlist
  `api/.htaccess` اضافه شد.
- نگاشت مسیر|یوآرآی پشتیبانی می‌شود (مثلاً `crm/index.html|/crm/`) چون canonicalize،
  `/crm/index.html` را به `/crm/` ریدایرکت می‌کند.

## ۳) T0-6 — لغو کش استیجینگ، بدون ریسک روی پروداکشن

پچ پیشنهادی ۲۰۲۶-۰۸-۲۷ می‌خواست در زمان دیپلوی یک heredoc به `crm/.htaccess` تزریق کند؛
**آن پچ اعمال نشد** (شناسهٔ پایان heredoc داخل بدنهٔ YAML تورفتگی دارد و گام استیجینگ را
می‌سوزاند). به‌جای آن، در خودِ مخزن:

- `.htaccess` و `crm/.htaccess`: با `RewriteCond %{HTTP_HOST} ^(?:staging|test)\.` متغیر
  `PTF_STAGING` ست می‌شود و فقط با `env=PTF_STAGING` روی js/html/css هدر
  `Cache-Control: no-store, no-cache, must-revalidate` می‌نشیند و `Expires` حذف می‌شود.
- بلوک **بعد از** کش ۳۰ روزهٔ سراسری قرار گرفته تا overwrite درست باشد؛ ETag/Last-Modified
  عمداً مانده‌اند تا revalidate با ۳۰۴ ارزان بماند. روی `pishtaj.ir` هیچ هدری عوض نمی‌شود.

## ۴) T5-1 — شش fallback مردهٔ نوشتن مستقیم به localStorage حذف شد

`crm/codegen.js` (ptf_crm_settings)، `crm/treasury.js` (ptf_crm_shareholders)،
`crm/case-revision.js` (تهاتر مرجوعی خرید)، `crm/surplus.js` (موجودی انبار)،
`crm/treasury-call.js` (فراخوان خزانه)، `crm/finance-write-guard.js` (ptf_crm_fin_events).
همه اولویت را به روتر فرمان/`setData` می‌دهند و در نبودِ لایهٔ داده **پیام ثبت می‌کنند و
نتیجهٔ ناموفق برمی‌گردانند** — نه نوشتن در پناه لایهٔ داده (اصل E2 + قاعدهٔ A10).

`_tools/arch/arch-baseline.json` بازسازی شد: بدهی A10 از **263 → 257** کاهش یافت (نه فقط
«عبور از گیت»)، و `tester536` امضاهای حذف‌شده را در مبنا رد می‌کند تا بازنگردند.

## ۵) ابزار جدید نسخه‌گذاری

`_tools/uat/bump-version.js` — یک‌جا هم‌سنجی ۷ نقطهٔ رسمی + مُهر تسترها؛
`--check` (بدون نوشتن)، `--dry`، `--rebaseline`. مُهر فقط خطوط assert را عوض می‌کند و
برچسب‌های تاریخی تسترها را حفظ می‌کند تا «هر تستر در کدام ریلیز متولد شده» گم نشود.

---

## کنترل و نتیجهٔ اجرا

| سنجه | نتیجه |
|---|---|
| گیت CI (`bash _tools/ci/ci-gate-step.sh`) | **۱۵۱ PASS / ۰ FAIL** (tester536 تازه در SUITE ثبت شد) |
| arch-guard | PASS — A6/A10/A11 صفر تخلف جدید، بدهی A10 = 257 |
| خودآزمون `ci-gate-step.sh` | ۷/۷ PASS |
| خودآزمون `post-deploy-hash-check.sh` | ۱۳/۱۳ PASS (از جمله «بدون هدر نسخه ⇒ شکست») |
| tester536 | ۴۹ PASS / ۰ FAIL |
| `node --check` روی ۱۰۸ فایل `crm/*.js` | همه سالم |
| lint فایل PHP جدید | با `php-parser` بررسی شد (مخزن/sandbox باینری php ندارد؛ در CI با `php -l` هم گیت می‌شود) |

## چه چیزی **هنوز** باقی است

1. اعمال پچ workflow (T0-3/T0-4) — تنها گام باز؛ راهنما و پچ آماده است.
2. T4-1b حذف توکن `ptf_crm_token` از localStorage، و نوشتن‌های کسب‌وکاری `crm/index.html`
   (`ptf_crm_settings:3830`، `ptf_crm_order_prices:4082`، `ptf_crm_finance:4098`، `ptf_crm_users`×۴).
3. T6/C5 بازنشستگی موتور سینک legacy؛ T5-2 کلیدهای DEV؛ T3-4 کش‌های read-through؛
   T4-3 آواتارها به S3؛ T7 ابزارهای ریکاوری IDB-aware. (جزئیات و ریسک‌ها در
   `ARENA-THIN-CLIENT-T0-GATES-2026-08-28.md`.)

**ضمیمه — فایل‌های تغییریافته:** `.htaccess` · `crm/.htaccess` · `api/.htaccess` · `api/deploy-probe.php` (جدید) ·
`crm/{codegen,treasury,treasury-call,case-revision,surplus,finance-write-guard}.js` ·
`_tools/ci/ci-gate-step.sh` (جدید) · `_tools/ci/post-deploy-hash-check.sh` (جدید) ·
`_tools/uat/{lib-deploy-gates.js,tester536-*.js,bump-version.js}` (جدید) ·
`_tools/uat/{run-ci-gate.js,tester431-*}` · `_tools/arch/arch-baseline.json` ·
`VERSION.json` + نقاط رسمی نسخه · `_tools/PENDING-workflow-t0-gates-v34.8.35.patch` (جدید) ·
`WORKFLOW-T0-GATES-APPLY-GUIDE-2026-08-28.md` (جدید)
