# Sprint 1 — Stage-0 Readiness Deliverable

**نسخهٔ مبنا:** `v31.6.26`  
**نوع خروجی:** بستهٔ آمادگی دلیورابل برای Stage 0، بدون mutation روی Production  
**وضعیت:** آماده برای review کارفرما؛ ورود به PoC فعال هنوز به دو تصمیم بیرونی وابسته است.

## هدف Sprint

ساخت یک بستهٔ قابل تحویل و قابل راستی‌آزمایی برای شروع امن FIN-WF-001، به‌جای اجرای شتاب‌زدهٔ تغییر auth/مالی روی Production.

## خروجی‌های این Sprint

1. `BACKLOG-PRIORITIZED-CURRENT-v31.6.26.md`
   - backlog یکپارچه؛
   - خانواده‌بندی؛
   - شدت P0 تا P3؛
   - وضعیت واقعی بر اساس source و regression.
2. `STAGE-0-FIXTURE-SPEC-v31.6.26.json`
   - کاربران و دادهٔ مصنوعی؛
   - بدون secret و دادهٔ واقعی.
3. `STAGE-0-BASELINE-MANIFEST-v31.6.26.txt`
   - SHA-256 فایل‌های حساس baseline.
4. `REGRESSION-REPORT-CURRENT-v31.6.26.md`
   - نتیجهٔ واقعی audit و regression پس از hardening فروش مازاد.
5. این سند، به‌عنوان قرارداد خروج Sprint و checklist ورود به PoC.

## شواهد baseline فعلی

- version marker کد: `v31.6.26`
- `audit.py`: همه بررسی‌ها PASS؛ بدون warning
- regression پس از hardening integrity فروش مازاد:
  - tester files PASS: 158
  - tester files FAIL: 0
  - checks PASS: 3787
  - checks FAIL: 0
  - exit code: 0
- `tester127-v211`: `49 PASS / 0 FAIL`
- `tester161-v287`: PASS
- `tester162-v287`: PASS
- `tester171-v3173-surplus-light`: `7 PASS / 0 FAIL`
- `tester172-v3174-surplus-sale-integrity`: `10 PASS / 0 FAIL`
- `tester173-v318-backup-coverage`: `6 PASS / 0 FAIL`
- `tester174-v319-golive-coverage`: `6 PASS / 0 FAIL`
- `tester175-v320-salesfile-postaward-guards`: `9 PASS / 0 FAIL`
- `tester176-v321-procurement-profit-integrity`: `10 PASS / 0 FAIL`
- `tester177-v322-codegen-fallbacks`: `7 PASS / 0 FAIL`
- `tester178-v323-sync-divergence`: `7 PASS / 0 FAIL`
- `node --check crm/oppo.js`, `salesfiles.js`, `offers.js`, `procurement-link.js`, `surplus.js`, `backup.js`, `golive.js`, `salesfiles.js`, `fx.js`, `procurement-link.js`, `supplier-finance.js`, `ai-workbench.js`, `storage.js`, `sync.js`: PASS

## محدودهٔ مجاز Sprint

- fixture و مستندات؛
- hash baseline؛
- inventory endpointها و role paths؛
- آماده‌سازی PoC-A/B؛
- طراحی reset/rollback؛
- تست غیرمخرب روی staging پس از فراهم‌شدن staging و مجوز.

## خارج از محدوده

- تغییر auth روی Production؛
- migration؛
- حذف داده؛
- mutation PoC روی Production؛
- US-437؛
- ساخت `v31.7`؛
- تغییر workflow مالی بدون policy و approval.

## گیت‌های خروج Sprint

| گیت | وضعیت |
|---|---|
| fixture مصنوعی | آماده |
| baseline hash | آماده |
| backlog خانواده‌بندی‌شده | آماده |
| regression evidence | PASS — ۱۵۷ فایل، ۳۷۷۸ چک، صفر FAIL |
| policy چک شخصی | BLOCKED — تصمیم کارفرما لازم است |
| staging مستقل | BLOCKED — محیط/دسترسی/backup لازم است |
| PoC-A/B | NOT RUN — عمداً تا رفع blockerها |
| production config review | NOT RUN |
| production deploy | NOT REQUESTED |

## تصمیم‌های لازم برای ورود به Sprint 1 فعال FIN-WF-001

1. انتخاب policy چک شخصی:
   - `local-only`
   - `private encrypted sync`
2. فراهم‌کردن staging:
   - subdomain مستقل؛
   - webroot جدا؛
   - HTTPS؛
   - fixture و backup جدا؛
   - secret/token جدا؛
   - S3 prefix جدا یا storage mock.

## معیار تحویل به کارفرما

این Sprint یک **Readiness Product** تحویل می‌دهد، نه ادعای تغییر Production. کارفرما باید بتواند:

1. baseline فایل‌ها را با manifest تطبیق دهد؛
2. fixture را در staging reset کند؛
3. دامنهٔ PoC-A/B را مرور کند؛
4. بداند کدام اقدام مجاز و کدام ممنوع است؛
5. تصمیم policy و staging را به‌صورت صریح ثبت کند.

## الحاقیه hardening US-436 light

- رزرو مازاد با `offerNo` به CO متصل می‌شود؛
- برد CO با guard رزرو ناکافی متوقف و با رزرو کافی به `soldQty` commit می‌شود؛
- commit تکراری idempotent است؛
- باخت رزرو متصل را آزاد می‌کند؛
- انبار کامل و US-437 همچنان خارج از scope هستند.

## الحاقیه hardening backup v31.6.26

- `ptf_crm_trash` به قرارداد backup اضافه شد؛
- پوشش sync/API/backup با tester173 کنترل می‌شود؛
- restore واقعی فقط روی staging مستقل مجاز است.

## الحاقیه hardening Go-Live reset v31.6.26

- `ptf_crm_payables` و `ptf_crm_surplus` به reset تراکنشی اضافه شدند؛
- کلیدهای حفاظت‌شدهٔ کاربران/تنظیمات/مجوزها در wipe باقی نمی‌مانند؛
- tester174 قرارداد backup پیشینی و `allow_wipe` را کنترل می‌کند؛
- اجرای واقعی reset فقط روی staging مستقل مجاز است.

## الحاقیه Release 1 — guardهای post-award پرونده فروش

- QC و ارسال/تحویل پیش از `wonOffer` در هسته رد می‌شوند؛
- مسیر پرونده برنده بدون تغییر رفتاری باقی می‌ماند؛
- tester175 رفتار قبل/بعد از برد را کنترل می‌کند؛
- UAT مرورگر و Production verification هنوز لازم است.

## الحاقیه Release 2 — procurement/profit integrity

- residualهای index mapping در FX و ledger شناسایی و حذف شدند؛
- legacy بدون provenance عمداً وارد سود نمی‌شود؛
- tester176 reorder، ambiguous و legacy را پوشش می‌دهد؛
- golden print/CO/TC و UAT مرورگر در دامنهٔ بعدی Release 2 باقی است.

## الحاقیه hardening codegen/AI/storage v31.6.26

- fallbackهای random عملیاتی از AI Workbench و storage حذف شدند؛
- تولید کد AI، شماره پیشنهاد/نامه و شناسه upload به مسیر مرکزی متصل است؛
- tester177 و tester169 قرارداد را کنترل می‌کنند؛
- UAT ساخت رکورد از AI و storage واقعی همچنان لازم است.

## الحاقیه hotfix بحرانی BUG-SYNC-DIVERGENCE

- startup sync دیگر cached global revision را به‌عنوان حقیقت نمی‌پذیرد؛
- با server revision مثبت، full pull با `since=0` انجام می‌شود؛
- browser/deviceهای متفاوت باید قبل از bootstrapped شدن به snapshot مشترک server برسند؛
- هیچ reset یا migration داده انجام نشده است.

## الحاقیه hotfix BUG-SYNC-AUTH-RACE

- token stale/expired دیگر startup را bootstrapped نمی‌کند؛
- token با session/passhash refresh می‌شود؛
- data_pull پس از refresh دوباره و در startup با full snapshot اجرا می‌شود؛
- tester179 race را کنترل می‌کند.

## الحاقیه hotfix BUG-SYNC-ADMIN-TOKEN

- admin برای token bootstrap به `ptf_crm_users` وابسته نیست؛
- `ADMIN_HASH/settings.adminHash` در showCrm و sync refresh پشتیبانی می‌شود؛
- بعد از auth موفق، full pull startup اجرا می‌شود؛
- tester180 مسیر را کنترل می‌کند.

## الحاقیه P0 BUG-SYNC-ROLE-ACL

- sync transport از finance ACL جدا شد؛
- سرور key-level allowlist برای نقش‌ها اعمال می‌کند؛
- senior roles full sync، accountant و نقش‌های عادی allowlist محدود دارند؛
- forbidden key در client و server silent نیست؛
- Production rollout فقط پس از staging no-leak و role matrix مجاز است.

## قانون توقف

پس از تحویل این بسته، کار متوقف می‌شود. Sprint فعال PoC یا هر تغییر کد بعدی فقط پس از تأیید همین گیت‌ها آغاز می‌شود.
