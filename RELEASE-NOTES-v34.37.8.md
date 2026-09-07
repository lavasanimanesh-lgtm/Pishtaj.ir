# یادداشت انتشار — v34.37.8

**تاریخ:** ۲۰۲۶-۰۹-۰۷ (۱۴۰۵/۰۶/۱۶) · **پایه:** v34.37.7
**گیت CI:** tester605 (UNINV-CUSTOM-LINES & DEALS-TOMBSTONE-SYNC) + ۲۱۹ تستر جامع گیت CI

درخواست‌های کارفرما:
1. در پنجره مودال فاکتور غیررسمی، افزودن قلم سفارشی: امکان تغییر و ویرایش نام قلم سفارشی و واحد آن.
2. بررسی و حل مشکل بازگشت برخی رکوردهای حذف‌شده در پرونده فروش پس از رفرش (کنترل کیفیت، ارسال/تحویل، و اسناد متفرقه).
3. شفاف‌سازی فرآیند و زمان‌های ارتقای نسخه (Version Bump) در سیستم.

---

## ① ارزیابی ریشه‌ای و تحلیل معماری

### ۱. اقلام سفارشی در فاکتور غیررسمی (`crm/unofficial-invoice.js`)
- **ریشه:** هنگام افزودن سطر سفارشی، فیلد نام در DOM مقدار پیش‌فرض «قلم سفارشی» داشت اما ویرایش فوری واحد امکان‌پذیر نبود و در صورتی که کاربر قبل از خارج کردن فوکوس (blur) دکمهٔ صدور را می‌زد، مقادیر ویرایش‌شدهٔ درون inputها در آبجکت داخلی `_unInvState.lines` بازتاب پیدا نمی‌کرد.
- **اصلاح:**
  - فیلد نام (`input[data-fld="name"]`) و شرح (`input[data-fld="desc"]`) کاملاً باز و قابل ویرایش شدند.
  - برای اقلام سفارشی (`custom: true`) فیلد اختصاصی واحد (`input[data-fld="unit"]`) اضافه شد.
  - بلافاصله پس از کلیک روی «➕ افزودن قلم سفارشی»، فوکوس و انتخاب خودکار متن (`focus()` + `select()`) روی فیلد نام سطر جدید اعمال می‌شود تا کاربر بدون نیاز به کلیک مجدد شروع به تایپ نام مورد نظر خود کند.
  - متد `unofficialInvoiceBuilderSubmit` در لحظهٔ اجرا ابتدا متد `unofficialInvoiceBuilderRecalc()` را صدا می‌زند تا حتی در صورت عدم رخداد رویداد blur، آخرین مقادیر تایپ‌شدهٔ DOM فوراً در وضعیت برنامه ثبت شوند.

### ۲. پایداری حذف‌های پرونده فروش (`crm/salesfiles.js` & `crm/sync.js`)
- **ریشه:** در هنگام همگام‌سازی کلاینت با سرور یا کش محلی (`ptfSmartMerge` روی `ptf_crm_deals`)، متد ادغام اشیاء (`ptfMergePlainObject`) آرایه‌های تودرتوی `qcEvents`، `shipEvents` و `docs` را با استراتژی اجتماع یکتای JSON (`ptfMergeArrayUnique`) ترکیب می‌کرد. در غیاب سنگ‌قبر اختصاصی، هر نسخهٔ کش‌شده از سرور یا رفرش مرورگر، رکوردهای حذف‌شده را مجدداً وارد آرایه می‌کرد (رستاخیز رکوردهای حذف‌شده). همچنین متد `sfSave` از `setData` مستقیم استفاده می‌کرد و اعلان‌های لایهٔ داده را کامل فعال نمی‌کرد.
- **اصلاح:**
  - ثبت سنگ‌قبر در متدهای حذف پرونده:
    - `sfQcDeleteCommit`: ثبت `r._qcTomb[eventCd] = ISOString` و اضافه به `r._deletedFileKeys`.
    - `sfShipDeleteCommit`: ثبت `r._shipTomb[eventCd] = ISOString` و اضافه به `r._deletedFileKeys`.
    - `sfDelMiscCommit`: ثبت `r._docTomb` بر اساس `key` / `_id` / `name` و اضافه به `r._deletedFileKeys`.
    - `sfEventFileDeleteCommit`: ثبت شناسه در `r._deletedFileKeys`.
    - `sfSave`: هدایت از طریق `ptfEntitySaveCollection` با شناسهٔ امن `reason: 'w2'`.
  - در موتور همگام‌سازی `crm/sync.js` (بخش `ptfMergeBusinessRecord` برای `ptf_crm_deals`):
    - اجتماع و حفظ سنگ‌قبرهای `_qcTomb`، `_shipTomb`، `_docTomb` و `_deletedFileKeys` از هر دو نسخه.
    - فیلتر و حذف قطعی رکوردهای سنگ‌قبردار در تمام سطوح.
    - حذف موارد تکراری و ادغام بر اساس آخرین نسخهٔ معتبر `cd`.

---

## ② فایل‌های تغییر یافته
- `crm/unofficial-invoice.js`: پشتیبانی کامل از ویرایش نام و واحد اقلام سفارشی، فوکوس خودکار، و همگام‌سازی DOM هنگام ثبت.
- `crm/salesfiles.js`: ثبت سنگ‌قبرهای `_qcTomb`، `_shipTomb`، `_docTomb`، `_deletedFileKeys` و ارتقای `sfSave` به `ptfEntitySaveCollection`.
- `crm/sync.js`: پیاده‌سازی مکانیزم Tombstone Merging & Deduplication برای رویدادهای QC، حمل و مدارک در پرونده‌های فروش.
- `VERSION.json`, `crm/index.html`, `crm/sw.js`, `crm/manifest.json`, `crm/clear-cache.html`, `crm/shell.js`, `crm/cms.js`, `api/sales-domain.php`: ارتقای هماهنگ نسخه به `v34.37.8`.
- `_tools/uat/tester605-v34.37.8-custom-lines-and-tombstone-sync.js`: ایجاد تستر اختصاصی رفتاری.
- `_tools/uat/run-ci-gate.js`: ثبت تستر در گیت سراسری.

---

## ③ وضعیت آزمون‌ها و گیت CI
- اجرای کامل گیت سراسری با `node _tools/uat/run-ci-gate.js`: **۲۲۰ آزمون سبز / ۰ شکست (100% Pass)**.
- نگهبان معماری (Arch Guard): **PASS**.
- سازگاری کامل و بدون اثر جانبی روی سایر بخش‌های سیستم.
