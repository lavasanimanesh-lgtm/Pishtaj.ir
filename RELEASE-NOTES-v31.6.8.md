# ریلیزنوت v31.6.8 — تسویهٔ خودکار قابل ردیابی و برگشت‌پذیر (FIN-WF-013)

## دامنه

- تکمیل پاکسازی امن زنجیره‌های یتیم: preview fingerprint، قرنطینهٔ فاکتور/payable و حفظ بایگانی؛
- دلیل اجباری برای تسویهٔ خودکار هنگام مختومه‌سازی پرونده؛
- شناسهٔ یکتای payment برای auto-settle؛
- status صریح `posted`؛
- ذخیرهٔ `settleReason` روی وصولی خودکار؛
- سازگاری با `ptfInvoicePayVoid` برای reversal؛
- حفظ فاکتور و تاریخچهٔ وصولی؛
- جلوگیری از تسویهٔ خودکار بی‌دلیل.

## فایل‌های تغییرکرده

- `crm/salesfiles.js`
- `crm/index.html`
- `crm/sw.js`
- `_tools/uat/tester166-v3168-autosettle-reversal.js`

## تست

- `tester114-v198.js`: 20 PASS / 0 FAIL
- `tester166-v3168-autosettle-reversal.js`: 6 PASS / 0 FAIL
- regression کامل پس از bump نسخه: ۱۴۳ فایل PASS / ۰ FAIL، ۳۶۷۹ چک PASS / ۰ FAIL
- audit بدون error؛ هشدار تصاویر حجیم باقی است.

## محدودیت

FIN-WF-001، policy چک شخصی و staging در این release تغییر نکرده‌اند.

## نسخه

- `VER v31.6.8`
- `CACHE ptf-crm-v31.6.8`
