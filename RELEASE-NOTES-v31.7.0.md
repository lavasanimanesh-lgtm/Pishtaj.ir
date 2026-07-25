# ریلیزنوت نهایی v31.7.0 — همگرایی داده و کدگذاری server-authoritative

## دامنهٔ نهایی Release

این Release سه ریشهٔ اصلی مشکل را هم‌زمان پوشش می‌دهد:

1. sync نقش‌محور بدون افشای مالی؛
2. صدور کد رسمی RFQ/TO/CO/TC از server؛
3. تشخیص و repair امن duplicateهای موجود.

## ۱) RCA

### واگرایی sync
`data_pull` و `data_push` به finance ACL متصل بودند و نقش‌های عادی CRM به sync دسترسی نداشتند. همچنین startup به revision محلی و token stale اعتماد می‌کرد.

### کد تکراری
`offerSerial()` و fallbackهای `ptfUnifiedCode()` از localStorage و max+1 استفاده می‌کردند. server codegen نیز existing offers را در counter scan نمی‌کرد و reserve به‌صورت asynchronous بود.

### duplicate legacy
کد نمایشی به‌عنوان identity رکورد استفاده می‌شد و duplicateهای موجود بدون provenance کافی بودند؛ بنابراین repair کورکورانه می‌توانست invoice/deal/project را به رکورد اشتباه وصل کند.

## ۲) اصلاحات اصلی

### Sync

- `sync_read` و `sync_write` مستقل از finance ACL؛
- full sync برای admin/chairman/ceo/commercial؛
- allowlist محدود برای accountant/sales/buyer/collector؛
- server-side filtering در `data_pull`؛
- رد کلیدهای غیرمجاز در `data_push`؛
- نمایش forbidden به‌جای سکوت؛
- full pull با `since=0` در startup؛
- refresh token برای token stale/expired؛
- fallback `ADMIN_HASH/settings.adminHash` برای admin؛
- جلوگیری از bootstrapped‌شدن local stale پس از 401.

### Codegen

- `offerSerial()` به unified codegen وصل شد؛
- RFQ/TO/CO/TC بدون server reservation رسمی ذخیره نمی‌شوند؛
- local max برای کد رسمی حذف شد؛
- server existing offers را در counter scan می‌کند؛
- reserve با lock اتمیک انجام می‌شود؛
- `TMP-*` به‌عنوان کد رسمی ذخیره نمی‌شود؛
- duplicate audit read-only اضافه شد.

### Duplicate repair

- `ptfScanDuplicateCodes()`؛
- `ptfBuildDuplicateRepairPlan()`؛
- repair فقط برای duplicate امن و بدون reference؛
- رکورد جدیدتر کد server جدید می‌گیرد؛
- duplicate دارای reference مبهم تغییر نمی‌کند و قرنطینه می‌شود؛
- apply نیازمند confirmation داخلی و audit است؛
- repair idempotent طراحی شده است.

## ۳) فایل‌های اصلی تغییرکرده

- `api/crm.php`
- `api/codegen.php`
- `crm/sync.js`
- `crm/codegen.js`
- `crm/offers.js`
- `crm/index.html`
- `crm/bridge.js`
- `crm/sw.js`
- `_tools/uat/tester181-v326-sync-role-acl.js`
- `_tools/uat/tester182-v327-codegen-server-integrity.js`
- `_tools/uat/tester183-v328-duplicate-repair.js`
- `_tools/uat/tester179-v324-sync-auth-race.js`
- `_tools/uat/tester180-v325-admin-token-bridge.js`
- `BACKLOG-PRIORITIZED-CURRENT-v31.7.0.md`
- `SPRINT-1-DELIVERABLE-STAGE0-v31.7.0.md`
- `STAGE-0-BASELINE-MANIFEST-v31.7.0.txt`
- `PTF-MASTER-HANDOVER.md`

## ۴) رفتار داده‌های موجود

- duplicate بدون reference: repair خودکار امن؛
- duplicate با invoice/deal/project/reference مبهم: قرنطینه و گزارش؛
- هیچ حذف یا rename کورکورانه انجام نمی‌شود؛
- قبل از repair، backup و dry-run اجباری است؛
- کدهای موجود به‌صورت خودکار بدون repair plan تغییر نمی‌کنند.

## ۵) regression و audit

پس از bump نسخه، نتیجهٔ نهایی در `REGRESSION-REPORT-v31.7.0.md` ثبت شده است:

```text
160 فایل PASS / 0 FAIL
3801 چک PASS / 0 FAIL
audit.py: PASS — بدون warning
```

دستورات اجراشده:

- full regression؛
- `python3 _tools/audit.py`؛
- syntax checks؛
- role matrix contract؛
- codegen counter contract؛
- safe/ambiguous duplicate repair contract.

PHP binary در sandbox موجود نیست؛ بنابراین `php -l` محلی اجرا نمی‌شود و verification endpointهای PHP روی staging لازم است.

## ۶) مراحل نصب/راستی‌آزمایی

1. قبل از هر repair، از server و همهٔ deviceهای دارای دادهٔ local backup بگیرید.
2. role matrix را روی fixture اجرا کنید.
3. codegen counter را با existing RFQ/offerهای fixture بررسی کنید.
4. duplicate scan و dry-run repair را اجرا کنید.
5. فقط safe repairها را apply کنید.
6. Chrome/Firefox و deviceهای مختلف را reload/logout/login کنید.
7. `auth_login`, `data_pull`, `data_push` و `codegen reserve` را در Network بررسی کنید.
8. duplicate audit را دوباره اجرا کنید.

## ۷) محدودیت Production

این Release شامل server-side RBAC، key-level financial sync و repair داده است. تا زمانی که no-leak role matrix، codegen counter و dry-run repair روی staging مستقل تأیید نشده‌اند، این بسته **برای Production deploy نهایی اعلام نمی‌شود**.

FIN-WF-001، US-437 و انبار کامل خارج از scope این Release هستند.

## نسخه

- `VER v31.7.0`
- `CACHE ptf-crm-v31.7.0`
