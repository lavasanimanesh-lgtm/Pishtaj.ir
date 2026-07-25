# ریلیزنوت v31.6.12 — یکپارچه‌سازی codegen در AI Workbench (TECHDEBT-005)

## دامنه

- حذف generator محلی موازی از `ai-workbench.js`؛
- استفاده از `genCode`/`ptfUnifiedCode` مرکزی CRM؛
- حذف fallback random از تعریف generator محلی؛
- حفظ رفتار codegen سروری و شناسه‌های قبلی؛
- بدون migration و بدون تغییر دادهٔ موجود.

## فایل‌های تغییرکرده

- `crm/ai-workbench.js`
- `crm/index.html`
- `crm/sw.js`
- `_tools/uat/tester169-v3171-codegen-unification.js`

## تست

- `tester169-v3171-codegen-unification.js`: 5 PASS / 0 FAIL
- regression کامل پس از bump نسخه: ۱۴۶ فایل PASS / ۰ FAIL، ۳۶۹۷ چک PASS / ۰ FAIL
- audit بدون error؛ هشدار تصاویر حجیم باقی است.

## محدودیت

FIN-WF-001، policy چک شخصی، staging و refactorهای معماری گسترده در این release تغییر نکرده‌اند.

## نسخه

- `VER v31.6.12`
- `CACHE ptf-crm-v31.6.12`
