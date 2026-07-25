# ریلیزنوت v31.6.26 — role-scoped sync بدون افشای مالی

## ۱) RCA
در `api/crm.php`، `data_pull` به `finance_read` و `data_push` به `finance_write` متصل بود. ACL مالی فقط admin/chairman/ceo را می‌پذیرفت؛ در نتیجه sales/buyer/accountant/collector برای sync عمومی CRM احتمالاً 403 می‌گرفتند. افزودن کورکورانهٔ همهٔ نقش‌ها به finance ACL خطر افشای invoices/payables/cheques داشت.

## ۲) فایل‌های تغییرکرده

- `api/crm.php`
- `crm/sync.js`
- `crm/index.html`
- `crm/sw.js`
- `_tools/uat/tester181-v326-sync-role-acl.js`
- `RELEASE-NOTES-v31.6.26.md`
- `REGRESSION-REPORT-v31.6.26.md`
- `BACKLOG-PRIORITIZED-CURRENT-v31.6.26.md`
- `SPRINT-1-DELIVERABLE-STAGE0-v31.6.26.md`
- `STAGE-0-BASELINE-MANIFEST-v31.6.26.txt`
- `INSTALL-GUIDE.md`
- `PTF-MASTER-HANDOVER.md`

## ۳) تغییر و دامنهٔ اثر

- `sync_read` و `sync_write` از finance ACL جدا شدند؛
- senior roles (`admin`, `chairman`, `ceo`, `commercial`) full company sync دارند؛
- sales/buyer/collector CRM allowlist محدود دارند؛
- accountant فقط allowlist مالی/عملیاتی موردنیاز را دارد؛
- `data_pull` server-side فقط کلیدهای مجاز role را برمی‌گرداند؛
- `data_push` کلیدهای غیرمجاز را ذخیره نمی‌کند و `forbidden` برمی‌گرداند؛
- client کلیدهای خارج از allowlist را قبل از push حذف و badge/ audit می‌کند؛
- هیچ نقش عادی با افزودن به finance ACL به کل دادهٔ مالی دسترسی نمی‌گیرد.

## ۴) regression و audit

- `tester181-v326-sync-role-acl.js`: **۹ PASS / ۰ FAIL**؛
- `tester170-v3172-sync-auth.js`: **۶ PASS / ۰ FAIL**؛
- `tester178-v323-sync-divergence.js`: **۹ PASS / ۰ FAIL**؛
- `tester179-v324-sync-auth-race.js`: **۶ PASS / ۰ FAIL**؛
- `tester180-v325-admin-token-bridge.js`: **۴ PASS / ۰ FAIL**؛
- full regression: **۱۵۸ فایل PASS / ۰ FAIL، ۳۷۸۷ چک PASS / ۰ FAIL**؛
- `python3 _tools/audit.py`: **PASS، بدون warning**؛
- جزئیات در `REGRESSION-REPORT-v31.6.26.md` ثبت شده است؛
- PHP syntax محلی اجرا نشد چون binary `php` در sandbox موجود نیست.

## ۵) Evidence قابل استناد

tester181 کنترل می‌کند:

1. جداشدن sync transport از finance ACL؛
2. full sync برای senior roles؛
3. allowlist مستقل sales/buyer/accountant/collector؛
4. عدم ذخیرهٔ forbidden keys در data_push؛
5. فیلتر server-side در data_pull؛
6. اعلام forbidden/role در response؛
7. feedback کلاینت به‌جای سکوت.

## ۶) مراحل verification کارفرما

برای هر نقش، روی fixture مستقل این ماتریس را اجرا کنید:

| نقش | data_pull | data_push | کلیدهای مالی غیرمجاز |
|---|---|---|---|
| admin/chairman/ceo/commercial | 200/full | 200/full | ندارد |
| accountant | 200/allowlist | 200/allowlist | باید فیلتر شود |
| sales | 200/CRM-only | 200/CRM-only | باید فیلتر شود |
| buyer | 200/buyer-CRM | 200/buyer-CRM | باید فیلتر شود |
| collector | 200/collector-allowlist | 200/collector-allowlist | باید فیلتر شود |

در Network برای هر نقش، response `role`, `forbidden`, `data` و `meta` ذخیره شود. هیچ تست Production با دادهٔ واقعی انجام نشود.

## ۷) approval و محدودیت

این تغییر server-side RBAC و key-level financial sync است؛ برای Production نیازمند role matrix نهایی، fixture و no-leak verification روی staging مستقل است. بدون این گیت، ZIP نباید روی Production نصب شود. migration داده انجام نشده است.

## نسخه

- `VER v31.6.26`
- `CACHE ptf-crm-v31.6.26`
