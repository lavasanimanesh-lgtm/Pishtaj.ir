# ریلیزنوت v31.6.7 — پاکسازی امن زنجیره‌های یتیم (FIN-WF-010)

## دامنه

- افزودن preview fingerprint قبل از purge؛
- ردکردن purge بدون preview معتبر؛
- بررسی تغییر زنجیره بین preview و اجرا؛
- حذف فیزیکی فقط رکوردهای عملیاتی غیرمالی؛
- قرنطینه‌کردن فاکتور و بستانکاری orphan به‌جای حذف فیزیکی؛
- نگهداری `orphanedAt`, `orphanedBy`, `orphanReason`؛
- حفظ skip برای اسناد مربوط به سال قفل‌شده؛
- audit تعداد حذف‌شده، قرنطینه‌شده و کلیدهای زنجیره؛
- UI با عنوان «پیش‌نمایش و پاکسازی امن».

## فایل‌های تغییرکرده

- `crm/bridge.js`
- `crm/index.html`
- `crm/sw.js`
- `_tools/uat/tester114-v198.js`

## رفتار امن

- chainهای دارای بایگانی مختومه همچنان محفوظ می‌مانند؛
- فاکتور و payable orphan حذف نمی‌شوند و قرنطینه می‌شوند؛
- purge بدون fingerprint preview اجرا نمی‌شود؛
- schema جدید ایجاد نشده است؛ metadata روی همان رکورد مالی ذخیره می‌شود.

## تست

- `tester114-v198.js`: 20 PASS / 0 FAIL
- regression کامل پس از bump نسخه: ۱۴۲ فایل PASS / ۰ FAIL، ۳۶۷۳ چک PASS / ۰ FAIL
- audit بدون error؛ هشدار تصاویر حجیم باقی است.

## محدودیت

FIN-WF-001، policy چک شخصی و staging در این release تغییر نکرده‌اند.

## نسخه

- `VER v31.6.7`
- `CACHE ptf-crm-v31.6.7`
