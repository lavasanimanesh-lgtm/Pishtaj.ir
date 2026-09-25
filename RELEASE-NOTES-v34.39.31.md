# v34.39.31 — ادغام شاخهٔ جلوتر از main (US-IRR2FX، CONTACT-SYNC-DIAG، CONTACT-ROOTS R7، GSC-AI-REPORT) (۲۰۲۶-۰۹-۲۵)

> شاخهٔ `arena/01a0cb49-pishtaj-ir` چهار نسخه از `main` جلوتر بود (`v34.39.28` تا `v34.39.31`). این یادداشت حاصل ادغام آن شاخه در `arena/01a0d7cb-pishtaj-ir` است، با حفظ فیکس‌های PR #51 که روی `main` نشسته بودند.

## چه چیزی وارد شد

- **v34.39.28 — US-IRR2FX:** تبدیل پیشنهاد ریالی به نسخهٔ ارزی همراه (مستقل، بدون دوباره‌شماری). UI در فهرست، کانبان و پروندهٔ فروش؛ نرخ و ارز مقصد. ماژول `crm/offer-fx-convert.js`.
- **v34.39.29 — CONTACT-SYNC-DIAG:** تشخیص سینک تماس مشتری — خواندن مستقیم از سرور، مقایسه با کش/صف آفلاین، و ثبت سریع admin. ماژول `crm/contact-sync-diag.js`.
- **v34.39.30 — CONTACT-ROOTS R7:** اتحاد رکوردبه‌رکورد فیلدهای تماس در `data_push` از کتابخانهٔ مشترک `api/contact-merge-lib.php` (جانشین `sync_contact_fields_fill`). شمارهٔ فقط-سرور با payload کهنه پاک نمی‌شود. هات‌فیکس syntax خط جدول پیشنهادها هم در همین نسخه بود.
- **v34.39.31 — GSC-AI-REPORT:** گزارش هوشمند سئو در تب سرچ کنسول. یک کلیک = جمع‌آوری دادهٔ گوگل + مقایسه با دورهٔ قبل + تحلیل ساختاریافته (`seo_gsc_report` از مسیر مقاوم `llm_call_json`) + خروجی مارک‌داون خودکفا.

## چه چیزی از main حفظ شد

- رفع SyntaxError دکمهٔ «بستن دستی مغایرت» در `crm/data-quality.js` (PR #51).
- دو رگرسیون CI که با `ad7a21a` وارد شده بودند (`tester675` و `crm/restore-contacts.js`).
- قرارداد REALBUY-OPTIONAL (خرید واقعی پیش‌فرض فقط اطلاع‌رسانی).

## هم‌راستاسازی ادغام

- نقاط رسمی نسخه روی `v34.39.31` یکدست شد (A6): `VERSION.json`، `PTF_CRM_RELEASE`، `sw.js` (`RELEASE` / `ASSET_VERSION` / `CACHE`)، `manifest.json`، `clear-cache.html`، `shell.js`، `cms.js`، `device-reconnect.html`، `SD_SERVICE_VERSION`.
- پین تسترها با `bump-version-pins.js` از `34.39.27` به `34.39.31` به‌روز شد.
- نگهبان معماری روی کد تازه‌وارد: مقایسهٔ شمارهٔ پیشنهاد خالی در تبدیل ارزی گارد شد؛ خواندن `ptf_sync_krevs` از `window.ptfSyncKrevs` (لایهٔ `sync.js`) به‌جای `localStorage` مستقیم؛ ذخیرهٔ شرایط ارزی بدون پنجرهٔ باز، بی‌صدا برنمی‌گردد.
- قرارداد تسترها با کد جدید هم‌خوان شد: شمار اکشن سئو روی `llm_call_json` از ۹ به ۱۰ (`seo_gsc_report`)؛ سیم‌کشی تماس در `tester676` به `sync_contact_records_merge` / `cm_contact_merge_record`.
