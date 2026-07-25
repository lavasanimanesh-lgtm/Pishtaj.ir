# گزارش regression — v31.6.26

**تاریخ اجرا:** 2026-07-18T07:36:59.705Z  
**نسخه کد:** `v31.6.26`

## نتیجه

- tester files: **158 PASS / 0 FAIL**؛
- checks: **3787 PASS / 0 FAIL**؛
- audit.py: **PASS، بدون warning**؛
- exit code: **0**؛
- prebroken/fail/hung/soft: **هیچ**.

## تست هدفمند

- `tester181-v326-sync-role-acl.js`: **9 PASS / 0 FAIL**؛
- `tester173-v318-backup-coverage.js`: **6 PASS / 0 FAIL**؛
- `tester170-v3172-sync-auth.js`: **6 PASS / 0 FAIL**؛
- `tester178-v323-sync-divergence.js`: **9 PASS / 0 FAIL**؛
- `tester179-v324-sync-auth-race.js`: **6 PASS / 0 FAIL**؛
- `tester180-v325-admin-token-bridge.js`: **4 PASS / 0 FAIL**؛
- `node --check crm/sync.js`: **PASS**.

## وضعیت تحویل

کد role-scoped sync و contract test آماده است، اما این تغییر server-side RBAC و key-level financial sync است. قبل از هر Production deploy باید روی staging مستقل role matrix و no-leak verification اجرا شود. بنابراین در این مرحله ZIP Production ساخته نشده است.
