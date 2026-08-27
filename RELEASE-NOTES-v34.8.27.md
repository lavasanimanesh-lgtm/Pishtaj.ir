# یادداشت انتشار CRM v34.8.27

تاریخ: ۱۴۰۵/۰۶/۰۵ (۲۰۲۶-۰۸-۲۷)

## W4 — تکمیل مهاجرت فرمانی: ۴۱ کلید، پایان مسیرهای مستقیم
(ROADMAP-THIN-CLIENT فاز T2 — موج چهارم و پایانی)

- **~۱۳۵ نقطهٔ این نوبت** در ۳۰ فایل به روتر فرمانی منتقل شد؛ جمع کل نقاط روترشده در crm از ۲۰۰ گذشت
- کلیدهای جدید: offers(فرعی)، rfqsmart، payables، letters، sendqueue، deleted_archive،
  buycmp، **settings (فقط ارشد)**، **audit**، **users (فقط ارشد)**، supplier_finance،
  cheques، contracts، buyquotes، smsbook، sigprofiles، petty، inqreads، avatars،
  catalog_merges، vat_settlements، purchase_returns، perms، catalog_reviews، **shareholders**
- حذف‌ها (حذف کاربر، جاروها، ادغام‌ها) = فرمان tombstone بازیافت‌پذیر
- عمداً legacy: ۳ مقایسهٔ برگشت `=== false` + fallbackهای else/rollback

## نتیجهٔ معماری (اصل E1/E2 رودمپ)
**هیچ کلید کسب‌وکاری دیگر مسیر مستقیم setData ندارد** — همهٔ نوشتن‌ها از روتر فرمانی
(فرمان اتمیک + projection + تور نجات dirty در شکست) عبور می‌کنند. موتور پوش انبوه
sync.js فقط برای fallback/بازیابی باقی است (بازنشستگی نهایی = فاز C5).

### کنترل
tester529 (۳۱ قرارداد: صفر بایپس سراسری، رجیستری ۴۲تایی، نقش‌های ارشد-فقط برای
settings/users). گیت کامل **۱۴۵/۰**، arch-guard PASS.
