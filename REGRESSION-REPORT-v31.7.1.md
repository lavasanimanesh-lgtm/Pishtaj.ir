# گزارش regression نهایی — v31.7.1

**تاریخ اجرا:** 2026-07-18T08:52:38.723Z  
**نسخه کد:** `v31.7.1`

## نتیجه

- tester files: **160 PASS / 0 FAIL**؛
- checks: **3802 PASS / 0 FAIL**؛
- audit.py: **PASS، بدون warning**؛
- exit code: **0**؛
- prebroken/fail/hung/soft: **هیچ**.

## تست هدفمند

- `tester183-v328-duplicate-repair.js`: **9 PASS / 0 FAIL**؛
- `tester181-v326-sync-role-acl.js`: **9 PASS / 0 FAIL**؛
- `tester182-v327-codegen-server-integrity.js`: **6 PASS / 0 FAIL**؛
- sync/auth tests: PASS؛
- syntax codegen/backup/sync/offers: PASS.

## وضعیت

v31.7.1 duplicateهای RFQ/Offer را پس از sync به‌صورت visible گزارش می‌کند. safe duplicate با server code جدید و confirmation داخلی repair می‌شود؛ duplicate دارای reference مبهم بدون حدس تغییر نمی‌کند.

## Production gate

Role-scoped sync، server codegen و repair داده قبل از Production نیازمند no-leak role matrix، codegen counter و dry-run repair روی staging مستقل هستند. PHP binary در sandbox موجود نیست؛ `php -l` محلی اجرا نشد.
