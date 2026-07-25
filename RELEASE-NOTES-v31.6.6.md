# ریلیزنوت v31.6.6 — تاریخ مالی canonical و guard سال (FIN-WF-007)

## دامنه

- افزودن `ptfFiscalYearOf()` برای استخراج سال از تاریخ لاتین، فارسی و عربی؛
- استفادهٔ fiscal report از helper canonical؛
- استفادهٔ orphan purge از helper مشترک؛
- استفادهٔ guard فاکتور/وصولی از helper مشترک؛
- سازگاری mutationهای سال مالی قفل‌شده با تاریخ‌های Persian/Arabic digit؛
- بدون migration خودکار و بدون تغییر دادهٔ legacy.

## فایل‌های تغییرکرده

- `crm/fiscal.js`
- `crm/bridge.js`
- `crm/rbac.js`
- `crm/shareholders.js`
- `crm/index.html`
- `crm/sw.js`
- `_tools/uat/tester165-v3166-fiscal-date-canonical.js`

## تست

- `tester163-v3164-invoice-pay-void.js`: PASS
- `tester164-v3165-fiscal-guards.js`: PASS
- `tester165-v3166-fiscal-date-canonical.js`: 9 PASS / 0 FAIL
- regression کامل پس از bump نسخه: ۱۴۲ فایل PASS / ۰ FAIL، ۳۶۷۲ چک PASS / ۰ FAIL
- audit بدون error؛ هشدار تصاویر حجیم باقی است.

## محدودیت

FIN-WF-001، policy چک شخصی و staging در این release تغییر نکرده‌اند.

## نسخه

- `VER v31.6.6`
- `CACHE ptf-crm-v31.6.6`
