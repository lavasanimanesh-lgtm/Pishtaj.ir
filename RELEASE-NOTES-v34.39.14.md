# v34.39.14 — HOME-DEPLOY-HOTFIX

تاریخ: ۱۴۰۵/۰۶/۲۷ (2026-09-18)

## هدف

رفع شکست `CI gate` و توقف دیپلوی پس از ادغام PR #40، بدون حذف قابلیت‌های ظاهری نسخه‌های `v34.39.12` و `v34.39.13`.

## اصلاحات

- تفکیک نسخهٔ وب‌سایت عمومی (`site_public_version = v34.39.14`) از نسخهٔ بدون‌تغییر CRM (`crm_version = v34.39.11`).
- هم‌راستاسازی cache-bust فایل‌های `home.css`، `home-enhancements.css`، `ptf-motion.js` و `ptf-discover.js` روی `v34.39.14`.
- انتقال لایهٔ افزایشی صفحهٔ اول به `assets/css/home-enhancements.css`؛ فایل حیاتی `home.css` دوباره زیر سقف ۴۰٬۰۰۰ نویسه قرار گرفت.
- حفظ کلید تم در `#mainNav` برای شیت موبایل و انتقال واکنش‌گرای همان گره DOM به خوشهٔ `hdr-actions` در دسکتاپ؛ شناسه، listener و وضعیت ARIA تکرار نمی‌شوند.
- حفظ جست‌وجوی فقط‌آیکون، کارت‌های داینامیک سوابق، spotlight و جلوگیری از تزریق pill متنی «جستجو».
- افزودن `tester673` برای پوشش نسخه، cache-bust، بودجه‌های CSS/JS، رفتار واکنش‌گرا و قابلیت‌های PR #40.
- اصلاح طبقه‌بندی `tester656` در محیط‌های محلی فاقد PHP؛ تست رفتاری PHP در GitHub Actions همچنان اجرا می‌شود.

## اعتبارسنجی

- Architecture guard: `PASS`
- CI gate محلی: `286 PASS / 0 FAIL`
- تست اختصاصی hotfix: `15 PASS / 0 FAIL`
- Node syntax و HTML parser: `PASS`
- `git diff --check`: `PASS`
