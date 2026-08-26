# یادداشت انتشار CRM v34.8.10

تاریخ: ۱۴۰۵/۰۶/۴ (۲۰۲۶-۰۸-۲۶)

## نجات تعارض کلیدهای مالی محافظت‌شده در مسیر فاز B

### RCA (گزارش کارفرما: نوار زرد رئیس هیات مدیره رفت؛ مدیر بازرگانی هنوز ۲ کلید — ptf_crm_opex و جفتش — همگرا نمی‌شوند)
`ptf_crm_opex`/`ptf_crm_sharetx`/`ptf_crm_shareholders` کلیدهای **محافظت‌شدهٔ مالی**‌اند: سرور در data_push همیشه merge محافظت‌شدهٔ canonical تولید می‌کند و اگر امضای آن با snapshot خام مرورگر فرق کند، `protectedConflict` + دادهٔ merge برمی‌گرداند. مسیر legacy این پاسخ را با `ptfMergeProtectedFinanceConflict` اعمال و مجدد ارسال می‌کرد؛ اما نجات تعارض فاز B (v34.8.7) عمداً کلیدهای محافظت‌شده را skip می‌کرد تا «مسیر اختصاصی خودشان» بماند — و چنین مسیری در فاز B وجود نداشت. نتیجه: چرخهٔ ابدی push→conflict→pending برای دقیقاً همین دو کلید.

### رفع
- `sync.js`: حل‌کنندهٔ جدید `ptfSyncResolveProtectedConflictFromServer(k, serverStr, submittedStr)` — همان منطق US-384 با `ptfMergeProtectedFinanceConflict` (merge سه‌طرفه: محلی فعلی + snapshot ارسالی + canonical سرور)، سپس tombstones، dirty مجدد.
- `client-server.js`: نجات flush فاز B حالا کلیدهای محافظت‌شده را با حل‌کنندهٔ مخصوص (و snapshot ارسالی همان دسته) صدا می‌زند؛ کلیدهای عادی مانند قبل از حل‌کنندهٔ عمومی. سقف retry (۳ نوبت) و ترتیب watermark مانند قبل.
- آستانهٔ تخلیهٔ IDB از ۲۴KB به **۸KB** کاهش یافت (بازخورد «حافظه هنوز نسبتاً پر است») — کلیدهای بیشترِ کسب‌وکار به IndexedDB می‌روند و localStorage سبک‌تر می‌ماند.

### کنترل کیفیت
- tester515 با شبیه‌سازی امضای canonical (ریشهٔ conflict، بن‌بست قدیمی، همگرایی پس از اعمال merge).
- گیت CI: ۱۳۱ PASS / 0 FAIL.
