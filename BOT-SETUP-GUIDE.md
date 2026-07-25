# راهنمای راه‌اندازی بات PTF

## هشدار امنیتی
توکن Telegram/Bale، chat id خصوصی و secretها را هرگز داخل ZIP، repository یا چت قرار ندهید. **هرگز در چت token یا secret ارسال نکنید.**

## فایل کانفیگ
فایل `bot-config.php` را خارج از `public_html` بسازید. ساختار نمونه:

```php
<?php
return [
  'telegram_token' => 'REPLACE_WITH_SECRET',
  'telegram_chat_id' => 'REPLACE_WITH_CHAT_ID',
  'bale_token' => '',
  'bale_chat_id' => ''
];
```

مقدارهای نمونه باید پیش از Production با secret واقعی جایگزین شوند و فایل permission محدود داشته باشد.

## تست اتصال

1. فایل کانفیگ را در مسیر خارج از webroot قرار دهید.
2. در تنظیمات CRM، وضعیت اتصال بات را بررسی کنید.
3. یک پیام آزمایشی غیرمحرمانه ارسال کنید.
4. response مربوط به status و send را بررسی کنید.
5. پس از تست، متن آزمایشی را از logها و صف‌های موقت پاک کنید.

## جفت‌سازی کاربر

1. کاربر از CRM کد جفت‌سازی دریافت می‌کند.
2. کد را در گفت‌وگوی خصوصی بات ارسال می‌کند.
3. endpoint `pair` فقط chat خصوصی را جستجو می‌کند.
4. chat id فقط پس از بررسی نام کاربر ذخیره شود.

## APK

ساخت APK با Bubblewrap و JDK 17 طبق `_tools/apk/APK-BUILD-GUIDE.md` انجام می‌شود. keystore باید جداگانه backup شود. پس از build واقعی، fingerprint certificate در `/.well-known/assetlinks.json` ثبت می‌شود.

## ممنوع

- ارسال token در پیام‌رسان یا چت؛
- commit کردن `bot-config.php`؛
- قرار دادن secret در JavaScript؛
- استفاده از credential Production در staging؛
- قراردادن fingerprint ساختگی در assetlinks.
