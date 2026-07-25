# Sprint 1 — Stage-0 Readiness Deliverable

**نسخهٔ مبنا:** `v31.6.15`  
**نوع خروجی:** بستهٔ آمادگی دلیورابل برای Stage 0، بدون mutation روی Production  
**وضعیت:** آماده برای review کارفرما؛ ورود به PoC فعال هنوز به دو تصمیم بیرونی وابسته است.

## هدف Sprint

ساخت یک بستهٔ قابل تحویل و قابل راستی‌آزمایی برای شروع امن FIN-WF-001، به‌جای اجرای شتاب‌زدهٔ تغییر auth/مالی روی Production.

## خروجی‌های این Sprint

1. `BACKLOG-PRIORITIZED-CURRENT-v31.6.15.md`
   - backlog یکپارچه؛
   - خانواده‌بندی؛
   - شدت P0 تا P3؛
   - وضعیت واقعی بر اساس source و regression.
2. `STAGE-0-FIXTURE-SPEC-v31.6.15.json`
   - کاربران و دادهٔ مصنوعی؛
   - بدون secret و دادهٔ واقعی.
3. `STAGE-0-BASELINE-MANIFEST-v31.6.15.txt`
   - SHA-256 فایل‌های حساس baseline.
4. `REGRESSION-REPORT-CURRENT-v31.6.15.md`
   - نتیجهٔ واقعی audit و regression پس از fix `oppo.js`.
5. این سند، به‌عنوان قرارداد خروج Sprint و checklist ورود به PoC.

## شواهد baseline فعلی

- version marker کد: `v31.6.15`
- `audit.py`: بدون error؛ یک warning برای تصاویر حجیم
- regression پس از fix SyntaxError، اتصال US-435 و اصلاح تسترهای capability-based:
  - tester files PASS: 139
  - tester files FAIL: 0
  - checks PASS: 3643
  - checks FAIL: 0
  - exit code: 0
- `tester127-v211`: `49 PASS / 0 FAIL`
- `tester161-v287`: PASS
- `tester162-v287`: PASS
- `node --check crm/oppo.js`, `salesfiles.js`, `offers.js`, `procurement-link.js`: PASS

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
- US-436؛
- US-437؛
- ساخت `v31.7`؛
- تغییر workflow مالی بدون policy و approval.

## گیت‌های خروج Sprint

| گیت | وضعیت |
|---|---|
| fixture مصنوعی | آماده |
| baseline hash | آماده |
| backlog خانواده‌بندی‌شده | آماده |
| regression evidence | ثبت شد؛ کلی هنوز FAIL است |
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

## قانون توقف

پس از تحویل این بسته، کار متوقف می‌شود. Sprint فعال PoC یا هر تغییر کد بعدی فقط پس از تأیید همین گیت‌ها آغاز می‌شود.
