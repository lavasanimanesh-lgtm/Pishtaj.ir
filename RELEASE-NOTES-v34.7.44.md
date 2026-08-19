# یادداشت انتشار v34.7.44 — رفع regression دکمهٔ ذخیرهٔ پیشنهاد

**تاریخ:** 2026-08-19

**دامنهٔ استقرار:** فقط staging؛ استقرار production ممنوع است.

## گزارش و ریشهٔ مستقل

در مسیر واقعی مودال، دکمهٔ `#offSaveBtn` تابع جاری `window.offerSave()` را فراخوانی می‌کند. این تابع به‌ترتیب توسط چند ماژول wrap می‌شود و در انتها `sales-domain-v2.js` receipt تابع legacy را بررسی می‌کند تا فقط پس از validation فرمان اتمیک `register_offer` را بفرستد.

wrapper موجود در `crm/petty.js` تابع زیرین را اجرا می‌کرد، اما مقدار بازگشتی آن را برنمی‌گرداند. بنابراین:

1. validation و تابع legacy اجرا می‌شدند؛
2. receipt معتبر `{ ok: true, ... }` در wrapper به `undefined` تبدیل می‌شد؛
3. orchestrator ثبت اتمیک نتیجه را ناموفق تلقی و snapshot را rollback می‌کرد؛
4. هیچ فرمانی به سرور ارسال نمی‌شد و دکمه از دید کاربر «هیچ کاری نمی‌کرد».

فراخوانی مستقیم `offerSave` در harness قبلی این زنجیرهٔ واقعی wrapperها را پوشش نمی‌داد.

## اصلاح

- `crm/petty.js` receipt دقیق تابع زیرین را ذخیره و بدون تغییر برمی‌گرداند.
- `tester447-v34.7.44-offer-save-button-return.js` مسیر DOM تا قرارداد orchestrator را کنترل می‌کند و wrapper واقعی `petty.js` را رفتاری اجرا می‌کند.
- همان tester همهٔ wrapperهای شناخته‌شدهٔ `offerSave` را برای forward کردن نتیجه بررسی می‌کند.
- tester جدید به full CI gate افزوده شد.
- cache key همهٔ assetهای CRM و Service Worker به `v34.7.44` افزایش یافت تا مرورگر نسخهٔ ناسازگار قدیمی را نگه ندارد.

## قرارداد پذیرش

- هر کلیک معتبر دقیقاً یک بار زنجیرهٔ save را اجرا می‌کند.
- validation پیش از فرمان سرور باقی می‌ماند.
- receipt تا orchestrator بدون تغییر می‌رسد؛ `register_offer` فقط یک بار ارسال می‌شود.
- rejected به rollback قطعی، uncertain به نگهداری فرم/intent و ACK به projection هم‌خوان پیشنهاد و RFQ منتهی می‌شود.
- هیچ fallback محلی، duplicate command یا false success/failure اضافه نشده است.
