# ریلیزنوت v31.6.10 — داشبورد کیفیت دادهٔ مالی (FIN-WF-015)

## دامنه

- ماژول read-only کیفیت دادهٔ مالی؛
- شناسایی فاکتور بدون سال مالی/ارتباط؛
- تعهد ارزی بدون نرخ تسعیر؛
- تعهد legacy بدون تاریخ؛
- چک باز بدون مالکیت یا تاریخ؛
- تطبیق خرید/استعلام مبهم از گزارش procurement؛
- نمایش summary و نمونه شناسه‌ها در هاب مالی؛
- بدون اصلاح، حذف، migration یا persistence جدید.

## فایل‌های تغییرکرده

- `crm/data-quality.js`
- `crm/financehub.js`
- `crm/index.html`
- `crm/sw.js`
- `_tools/uat/tester168-v3170-data-quality.js`

## تست

- `tester168-v3170-data-quality.js`: 7 PASS / 0 FAIL
- regression کامل پس از bump نسخه: ۱۴۵ فایل PASS / ۰ FAIL، ۳۶۹۲ چک PASS / ۰ FAIL
- audit بدون error؛ هشدار تصاویر حجیم باقی است.

## محدودیت

FIN-WF-001، policy چک شخصی و staging در این release تغییر نکرده‌اند.

## نسخه

- `VER v31.6.10`
- `CACHE ptf-crm-v31.6.10`
