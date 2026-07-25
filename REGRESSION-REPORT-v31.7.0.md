# گزارش regression نهایی — v31.7.0

**تاریخ اجرا:** 2026-07-18T08:36:04.197Z  
**نسخه کد:** `v31.7.0`

## نتیجه

- tester files: **160 PASS / 0 FAIL**؛
- checks: **3801 PASS / 0 FAIL**؛
- audit.py: **PASS، بدون warning**؛
- exit code: **0**؛
- prebroken/fail/hung/soft: **هیچ**.

## تست هدفمند

- `tester181-v326-sync-role-acl.js`: **9 PASS / 0 FAIL**؛
- `tester182-v327-codegen-server-integrity.js`: **6 PASS / 0 FAIL**؛
- `tester183-v328-duplicate-repair.js`: **8 PASS / 0 FAIL**؛
- `tester178-v323-sync-divergence.js`: **9 PASS / 0 FAIL**؛
- `tester179-v324-sync-auth-race.js`: **6 PASS / 0 FAIL**؛
- `tester180-v325-admin-token-bridge.js`: **4 PASS / 0 FAIL**؛
- `tester170-v3172-sync-auth.js`: **6 PASS / 0 FAIL**؛
- syntax codegen/sync/offers/bridge: **PASS**.

## تصمیم تحویل

کد v31.7.0 شامل role-scoped sync، server-backed codegen و duplicate repair امن است. duplicateهای بدون reference قابل repair خودکار هستند؛ duplicateهای دارای reference مبهم قرنطینه می‌شوند و بدون حدس rename نمی‌شوند.

## گیت Production

این Release شامل server-side RBAC، key-level financial filtering، codegen counter و repair داده است. قبل از Production باید no-leak role matrix، codegen counter و dry-run repair روی staging مستقل اجرا و تأیید شوند. بنابراین این بسته از نظر کد و regression آماده است، اما Production deployment نهایی بدون این evidence مجاز نیست.

PHP binary در sandbox موجود نیست؛ `php -l` محلی اجرا نشد.
