# ریلیزنوت v31.6.2 — اتصال نمای فرصت‌های فروش بر اساس مشتری (US-435)

## دامنه
- رفع SyntaxError قبلی در `crm/oppo.js` که مانع load شدن ماژول فرصت‌ها می‌شد.
- اتصال نمای جدید فرصت‌ها به پرونده‌های فروش با دو view:
  - بر اساس درخواست؛
  - بر اساس مشتری.
- افزودن toggle داخل تب «فرصت‌های فعال».
- گروه‌بندی CO/TCهای فعال بر اساس `buyerCd`.
- حذف پیشنهادهای won/lost/archived و درخواست‌هایی که قبلاً ابلاغ برنده شده‌اند از نمای فرصت مشتری.
- مرتب‌سازی پیشنهادهای هر مشتری بر اساس تاریخ موجود.
- تکمیل لایهٔ دوم ایمنی `BUG-PROC-LINK-287`: انتخاب خرید واقعی دیگر از `purchase.idx` انجام نمی‌شود و فقط provenance پایدار (`sourceItemKey/sourcePcode`) پذیرفته می‌شود.
- اولویت مرجع قیمت پیشنهاد: best-buy قطعی استعلام، سپس مرجع دستی/کاتالوگ؛ تطبیق مبهم عدد را خودکار انتخاب نمی‌کند.
- فیلد قیمت CO/TC در rendererهای اصلی با money input و `ptfNum` هم‌راستا شد و حاشیهٔ فعلی ردیف نمایش داده می‌شود.
- متن واحد قدیمی در ویرایش هزینه جاری به wording ریالی غیرمبهم تبدیل شد.
- به‌روزرسانی fixture تست Optimizer برای قرارداد provenance خرید واقعی.

## فایل‌های تغییرکرده
- `crm/oppo.js`
- `crm/salesfiles.js`
- `crm/offers.js`
- `crm/offerlock.js`
- `crm/opex.js`
- `crm/procurement-link.js`
- `tester162-v287-optimizer-safe-mapping.js`
- `crm/index.html`
- `crm/sw.js`

## وضعیت
- تغییر داده یا schema جدید ایجاد نشده است.
- US-436 و US-437 در این release تغییر نکرده‌اند.
- گیت regression کامل: `139 files PASS / 0 FAIL` و `3643 checks PASS / 0 FAIL`.
- `audit.py` بدون error اجرا شد؛ فقط هشدار تصاویر حجیم باقی است.
- این release برای ساخت بستهٔ Production-ready آماده است؛ هشدار تصاویر باید در backlog باقی بماند.

## تست
- `python3 _tools/audit.py`
- `node _tools/run-full-regression.js`
- `node --check` فایل‌های تغییرکرده
- `tester127-v211.js`
- `tester161-v287-procurement-line-integrity.js`
- `tester162-v287-optimizer-safe-mapping.js`
- تست گروه‌بندی و renderer بر اساس مشتری
- نتیجه: `139 files PASS / 0 FAIL` و `3643 checks PASS / 0 FAIL`

## نسخه
- `VER v31.6.2`
- `CACHE ptf-crm-v31.6.2`
