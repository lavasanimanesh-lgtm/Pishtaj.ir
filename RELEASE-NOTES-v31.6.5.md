# ریلیزنوت v31.6.5 — تکمیل guard سال مالی (FIN-WF-004)

## دامنه

- guard ثبت فاکتور مشتری در سال مالی قفل‌شده؛
- guard ثبت وصولی مشتری در سال مالی قفل‌شده؛
- guard ثبت/ویرایش سهامدار و حقوق موظف در سال قفل‌شده؛
- guard ثبت برداشت/علی‌الحساب سهامدار در سال قفل‌شده؛
- helper مشترک خواندن snapshot قفل‌شده؛
- مسیر سند اصلاحی سال قفل‌شده دست‌نخورده باقی مانده است.

## فایل‌های تغییرکرده

- `crm/fiscal.js`
- `crm/rbac.js`
- `crm/shareholders.js`
- `crm/index.html`
- `crm/sw.js`
- `_tools/uat/tester164-v3165-fiscal-guards.js`

## رفتار

در صورت تلاش برای mutation مالی در سال قفل‌شده:

- عملیات رد می‌شود؛
- پیام سال قفل‌شده نمایش داده می‌شود؛
- دادهٔ اصلی تغییر نمی‌کند؛
- برای اصلاح باید از مسیر سند اصلاحی استفاده شود.

## تست

- `tester163-v3164-invoice-pay-void.js`: 14 PASS / 0 FAIL
- `tester164-v3165-fiscal-guards.js`: 6 PASS / 0 FAIL
- regression کامل پس از bump نسخه: 141 فایل PASS / 0 FAIL، 3663 چک PASS / 0 FAIL
- audit بدون error؛ هشدار تصاویر حجیم باقی است.

## محدودیت

FIN-WF-001، policy چک شخصی و staging در این release تغییر نکرده‌اند.

## نسخه

- `VER v31.6.5`
- `CACHE ptf-crm-v31.6.5`
