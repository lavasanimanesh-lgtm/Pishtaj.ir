# گزارش regression — v31.6.27

**تاریخ اجرا:** 2026-07-18T07:58:37.182Z  
**نسخه کد:** `v31.6.27`

## نتیجه

- tester files: **159 PASS / 0 FAIL**؛
- checks: **3793 PASS / 0 FAIL**؛
- audit.py: **PASS، بدون warning**؛
- exit code: **0**؛
- prebroken/fail/hung/soft: **هیچ**.

## تست هدفمند

- `tester182-v327-codegen-server-integrity.js`: **6 PASS / 0 FAIL**؛
- `tester181-v326-sync-role-acl.js`: **9 PASS / 0 FAIL**؛
- `tester178-v323-sync-divergence.js`: **9 PASS / 0 FAIL**؛
- `tester179-v324-sync-auth-race.js`: **6 PASS / 0 FAIL**؛
- `tester180-v325-admin-token-bridge.js`: **4 PASS / 0 FAIL**؛
- `tester170-v3172-sync-auth.js`: **6 PASS / 0 FAIL**؛
- `node --check crm/codegen.js`: **PASS**؛
- `node --check crm/offers.js`: **PASS**؛
- `node --check crm/sync.js`: **PASS**.

## وضعیت تحویل

کد جلوگیری از صدور کد تکراری و role-scoped sync آمادهٔ verification است. duplicate audit فقط read-only است و کدهای موجود خودکار rename نمی‌شوند. به‌دلیل server-side RBAC و codegen counter، no-leak/duplicate verification روی staging مستقل پیش از Production لازم است؛ ZIP Production ساخته نشده است.
