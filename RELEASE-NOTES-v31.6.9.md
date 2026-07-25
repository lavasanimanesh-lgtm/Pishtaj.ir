# ریلیزنوت v31.6.9 — تطبیق افتتاحیه و فاکتور تأمین (FIN-WF-012)

## دامنه

- ارتقای گزارش read-only `slReconcileOpen`؛
- نمایش مجموع فاکتورهای رسمی؛
- نمایش مجموع خرید legacy لینک‌شده؛
- نمایش افتتاحیه و adjustmentهای تأمین؛
- نمایش تعداد و مبلغ تعهدهای legacy بدون لینک؛
- نمایش مغایرت per invoice؛
- عدم migration، اصلاح خودکار یا تغییر مبلغ در مسیر گزارش.

## فایل‌های تغییرکرده

- `crm/supplier-finance.js`
- `crm/index.html`
- `crm/sw.js`
- `_tools/uat/tester167-v3169-supplier-reconcile.js`

## تست

- `tester167-v3169-supplier-reconcile.js`: 7 PASS / 0 FAIL
- regression کامل پس از bump نسخه: ۱۴۴ فایل PASS / ۰ FAIL، ۳۶۸۶ چک PASS / ۰ FAIL
- audit بدون error؛ هشدار تصاویر حجیم باقی است.

## محدودیت

FIN-WF-001، policy چک شخصی و staging در این release تغییر نکرده‌اند.

## نسخه

- `VER v31.6.9`
- `CACHE ptf-crm-v31.6.9`
