# ریلیزنوت v31.6.4 — اصلاح استاندارد وصولی مشتری (FIN-WF-006 / FIN-EX-03)

## دامنه

- افزودن ابطال وصولی مشتری بدون حذف فاکتور؛
- ثبت دلیل اجباری؛
- ثبت رویداد reversal با مبلغ منفی؛
- نگهداری رکورد وصولی اصلی، زمان، کاربر و دلیل؛
- audit قابل استناد؛
- جلوگیری از ابطال مجدد؛
- جلوگیری از ابطال در سال مالی قفل‌شده؛
- محدودسازی عملیات به نقش‌های ارشد، حسابدار و تحصیلدار؛
- افزودن شناسهٔ یکتا به وصولی‌های جدید؛
- نمایش دکمهٔ ابطال در فهرست وصولی‌ها با وضعیت روشن.

## فایل‌های تغییرکرده

- `crm/rbac.js`
- `crm/index.html`
- `crm/sw.js`
- `crm/opex.js` و سایر اصلاحات حفظ‌شده از `v31.6.3`
- `_tools/uat/tester163-v3164-invoice-pay-void.js`

## قرارداد داده

ابطال فاکتور را حذف نمی‌کند. برای وصولی اصلی:

- `voided: true`
- `voidedAt`
- `voidedBy`
- `voidReason`
- `reversalCd`

و یک payment معکوس اضافه می‌شود:

- `status: reversal`
- `amt: -originalAmount`
- `voidRef`
- `voidReason`

## تست

- `tester163-v3164-invoice-pay-void.js`: 14 PASS / 0 FAIL
- regression کامل: 140 فایل PASS / 0 FAIL، 3657 چک PASS / 0 FAIL
- audit بدون error؛ هشدار تصاویر حجیم باقی است

## محدودیت

FIN-WF-001، policy چک شخصی و staging در این release تغییر نکرده‌اند.

## نسخه

- `VER v31.6.4`
- `CACHE ptf-crm-v31.6.4`
