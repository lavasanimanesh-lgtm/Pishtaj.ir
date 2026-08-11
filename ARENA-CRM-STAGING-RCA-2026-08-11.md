# RCA نهایی CRM — اختلاف استیجینگ با main و اصلاح v34.4.34

**تاریخ:** 2026-08-11

**مبنای main/پروداکشن:** `77d02b7` — CRM `v34.4.29`

**آخرین مبنای مستقر روی staging پیش از این اصلاح:** `2254f63` (کد مؤثر تا `3b603ec`) — CRM `v34.4.33`

## نتیجهٔ بازبینی

گزارش قبلی که تغییرات `v34.4.30..33` را «کاملاً صحیح و بدون باگ» اعلام کرده بود درست نبود. تست‌های قبلی عمدتاً وجود رشته‌ها و توابع را بررسی می‌کردند و مسیرهای واقعی race، dirty sync، خطای S3 و پاسخ ناموفق حذف را شبیه‌سازی نکرده بودند.

استیجینگ پنج commit از main جلو بود (چهار commit کد و یک commit مستندات)، اما رفع CHQ-DOC/CLOUD در چند مسیر اصلی ناقص بود.

## علت‌های ریشه‌ای قطعی

1. **`ptfSyncPullNow` الزاماً pull نمی‌کرد.** اگر push در جریان بود callback فوراً اجرا می‌شد؛ اگر dirty key وجود داشت push غیرهمزمان شروع می‌شد ولی callback پیش از پایان push و بدون pull اجرا می‌شد. بنابراین مودال before/after یکسان می‌دید و ضمیمهٔ تازه نمایش داده نمی‌شد.
2. **merge سینک در سطح رکورد بود، نه فایل.** افزودن فایل timestamp رکورد چک/تنخواه/پرداخت را به‌روز نمی‌کرد. در conflict نسخهٔ بدون فایل می‌توانست برنده شود؛ حذف فایل هم در conflict دوباره زنده می‌شد.
3. **حذف فایل optimistic و کاذب بود.** UI ابتدا metadata را پاک می‌کرد، پاسخ 403/شبکه/S3 را نادیده می‌گرفت و پیام موفقیت می‌داد. در ویرایش چک حتی object ابری اصلاً حذف نمی‌شد.
4. **اصلاح CORS قابل اجرا نبود.** endpoint صرفاً deploy شده بود و خودکار فراخوانی نمی‌شد؛ علاوه بر آن canonical query در امضای SigV4 به‌صورت `cors` ساخته شده بود، درحالی‌که subresource بدون مقدار باید `cors=` امضا شود. نتیجه می‌توانست `SignatureDoesNotMatch` باشد.
5. **fallback آپلود لبه‌های خطا را درست مدیریت نمی‌کرد.** onerror/timeout امکان آغاز تکراری fallback داشت، موفقیت proxy با علامت «در انتظار» نمایش داده می‌شد، سقف واقعی server نادیده گرفته می‌شد و خطاهای `upload_max_filesize` قابل تشخیص نبودند.
6. **دسته‌چک فقط localStorage بود.** `ptf_crm_cheque_books` در allowlist سینک کلاینت/سرور، mirror و backup نبود؛ بنابراین «ذخیره شد» فقط روی همان مرورگر صادق بود.

## اصلاح اعمال‌شده در v34.4.34

- صف و coalescing برای pull فوری؛ انتظار برای عملیات sync جاری و انجام pull واقعی با merge امن dirty data.
- جلوگیری از fetchهای pull هم‌زمان با `pullRequesting` و callback نتیجه‌دار.
- merge فایل‌ها بر اساس `key` برای چک، تنخواه، فاکتور و پرداخت تأمین‌کننده.
- tombstone سطح فایل (`_deletedFileKeys`) برای جلوگیری از بازگشت فایل حذف‌شده.
- timestamp واقعی `updatedAtISO` در افزودن/حذف/ویرایش ضمیمه.
- حذف ابری تأییدشده: metadata فقط پس از پاسخ موفق S3 حذف می‌شود؛ خطای نقش/شبکه شفاف است.
- اصلاح SigV4 CORS به `cors=`، الزام POST برای mutation و افزودن دکمهٔ مدیریتی اعمال CORS در CRM.
- سخت‌سازی fallback proxy: callback یک‌باره، خطای دقیق PHP upload، سقف سرور، مسیر پوشهٔ امن و حفظ hierarchy.
- افزودن `ptf_crm_cheque_books` به sync، ACL حسابدار، backup و client-server mirror.
- یکدست‌سازی نسخه و cache-busting روی `v34.4.34` در VERSION/index/sw/manifest/clear-cache/shell و همهٔ script queryها.

## راستی‌آزمایی

- `_tools/uat/tester329-v34.4.34-staging-rca.js` — PASS
  - dirty-state pull واقعی
  - merge هم‌زمان ضمیمه‌ها
  - tombstone حذف
  - merge پرداخت تأمین‌کننده
  - قرارداد CORS، حذف تأییدشده، sync دسته‌چک و version hygiene
- `_tools/uat/tester312-v34.0.16-alpha-cheque-book-attach.js` — **19 PASS / 0 FAIL**
- `tester178-v34.4.30-cheque-doc-view-fix.js` — PASS
- `tester179-v34.4.31-attachment-modal-stale-sync-fix.js` — PASS
- `node --check` برای تمام فایل‌های JS تغییرکرده — PASS
- قرارداد نسخه: 92 ورودی script همگی `?v=34.4.34` — PASS
- `git diff --check` — PASS

## محدودیت محیط بررسی

در sandbox حاضر PHP CLI نصب نبود؛ بنابراین lint اجرایی PHP انجام نشد. قراردادهای PHP به‌صورت static بررسی شدند و تست عملی endpointهای S3/CORS باید بعد از deploy استیجینگ با توکن نقش مجاز و تنظیمات واقعی آروان اجرا شود.
