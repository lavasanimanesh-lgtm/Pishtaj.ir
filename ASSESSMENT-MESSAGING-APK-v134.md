# ارزیابی پیام‌رسان و APK — v134

## دامنه
این سند وضعیت US-332 تا US-334 را ثبت می‌کند و جایگزین secret/config واقعی نیست.

## استوری‌های پوشش‌داده‌شده

- US-332: deep-link و متن آمادهٔ پیام‌رسان‌ها (از جمله `wa.me`)؛
- US-333: بات اعلان Telegram/Bale؛
- US-334: بستهٔ APK/TWA با Bubblewrap.

## پیام‌رسان‌ها

ماژول `messengers.js` مسیرهای زیر را پشتیبانی می‌کند:

- WhatsApp؛
- Telegram؛
- Bale؛
- Eitaa؛
- Rubika.

شمارهٔ ایران به قالب بین‌المللی نرمال می‌شود. برای پیام‌رسان‌هایی که text parameter ندارند، متن آماده در clipboard قرار می‌گیرد.

## بات اعلان

`api/notify-bot.php` دو مسیر دارد:

- Telegram Bot API؛
- Bale Bot API.

کانفیگ باید در `bot-config.php` و خارج از `public_html` باشد. token یا chat id واقعی نباید در repository، ZIP عمومی یا چت قرار گیرد.

کنترل‌های موجود:

- same-origin check؛
- rate limit؛
- actionهای status/send/pair؛
- ارسال شخصی با chat id مجاز؛
- گزارش خطای سرویس.

## APK/TWA

تنظیمات پایه در `_tools/apk/twa-manifest.json` و راهنمای ساخت در `_tools/apk/APK-BUILD-GUIDE.md` قرار دارد.

- package id: `ir.pishtaj.crm`
- start URL: `/crm/index.html`
- ساخت با Bubblewrap؛
- نیازمند JDK 17 و Node.js؛
- keystore باید خارج از ZIP و با backup امن نگه‌داری شود.

## asset links

`assetlinks.json` فقط پس از build واقعی و استخراج SHA-256 certificate قابل تکمیل است. تا آن زمان نباید fingerprint ساختگی در بستهٔ Production قرار گیرد.
