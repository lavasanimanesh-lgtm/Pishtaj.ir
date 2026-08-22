# RELEASE NOTES — v34.7.85 (۱۴۰۵/۰۵/۳۱ — 2026-08-22)

## ادامه بهینه‌سازی ماژول تامین‌کنندگان (SUP-PERF-003 / SUP-PERF-004)

### SUP-PERF-003 — Lazy-load مالی تامین‌کنندگان

- `crm/supplier-finance.js`:
  - باکس «🧾 فاکتور، حساب و پرداخت تأمین‌کنندگان» هنگام ساخت پنل فقط قاب با placeholder
    (`slBoxBody` + «در حال محاسبه…») می‌سازد.
  - محاسبهٔ سنگین `balance()`ها در `slBoxRows()` جدا شد و پس از رندر پنل توسط
    `ptfSlBoxLazy()` یک‌بار اجرا می‌شود.
  - ظاهر (`<details id="slBox" open>` + `<summary>`) و رفتار قبلی بدون تغییر؛ فقط
    محاسبه از مسیر synchronous ساخت پنل خارج شد.

### SUP-PERF-004 — صفحه‌بندی اختیاری صندوق سایت (get_inbox)

- `api/crm.php → get_inbox`:
  - پارامترهای اختیاری `limit` و `offset` اضافه شد.
  - بدون پارامتر، رفتار قبلی (همه‌ی suppliers + rfqs سایت) حفظ می‌شود.
  - با `limit>0`، فقط صفحهٔ خواسته‌شده از `suppliers` برمی‌گردد و فیلدهای
    `limit/offset/supTotal/rfqTotal` در پاسخ اضافه می‌شود.
  - gzip/fresh قبلی (v34.7.81) دست‌نخورده است.

### تست

- `_tools/uat/tester487-v34.7.85-supplier-perf-followups.js` در گیت CI.
- گیت CI: **103 PASS / 0 FAIL**.
