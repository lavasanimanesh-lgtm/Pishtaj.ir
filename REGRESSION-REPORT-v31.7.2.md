# گزارش regression نهایی — v31.7.2

**تاریخ اجرا:** 2026-07-18T09:38:18.700Z  
**نسخه کد:** `v31.7.2`

## نتیجه

- tester files: **161 PASS / 0 FAIL**؛
- checks: **3808 PASS / 0 FAIL**؛
- audit.py: **PASS، بدون warning**؛
- exit code: **0**؛
- prebroken/fail/hung/soft: **هیچ**.

## تست هدفمند

- `tester184-v329-startup-local-merge.js`: **6 PASS / 0 FAIL**؛
- `tester183-v328-duplicate-repair.js`: **9 PASS / 0 FAIL**؛
- `tester182-v327-codegen-server-integrity.js`: **6 PASS / 0 FAIL**؛
- sync/auth/role tests: PASS؛
- syntax codegen/sync/backup: PASS.

## نتیجه

v31.7.2 در startup merge دیگر RFQ/Offerهایی با کد یکسان اما payload متفاوت را collapse نمی‌کند. payloadهای متفاوت هر دو حفظ می‌شوند و duplicate repair کنترل‌شده بعداً آن‌ها را بررسی می‌کند.

## محدودیت recovery

رکوردی که در merge قبلی overwrite شده باشد فقط از backup قبل از sync قابل بازیابی است. این Release از حذف بیشتر جلوگیری می‌کند اما دادهٔ حذف‌شده را بدون backup بازسازی نمی‌کند.

## Production gate

Role-scoped sync، server codegen و repair داده قبل از Production نیازمند no-leak، codegen counter و dry-run repair روی staging مستقل هستند. PHP binary در sandbox موجود نیست؛ `php -l` محلی اجرا نشد.
