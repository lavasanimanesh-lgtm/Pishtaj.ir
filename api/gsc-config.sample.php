<?php
/**
 * نمونهٔ تنظیماتِ اتصال به Google Search Console
 * =============================================
 * این فایل را با نام gsc-config.php کپی و مقادیر را پر کنید.
 * ⚠️ فایلِ gsc-config.php هرگز نباید در گیت کامیت شود (در .gitignore هست).
 *
 * مراحل ساخت Service Account (یک‌بار، ~۵ دقیقه):
 *   ۱) به https://console.cloud.google.com بروید و یک پروژه بسازید (یا همین پروژه را انتخاب کنید).
 *   ۲) APIs & Services → Library → «Search Console API» را Enable کنید.
 *   ۳) APIs & Services → Credentials → Create credentials → Service account
 *      نام: ptf-gsc | نقش نیاز نیست (دسترسی از خودِ سرچ کنسول داده می‌شود).
 *   ۴) روی سرویس‌اکانت → Keys → Add key → Create new key → JSON
 *      فایل JSON دانلود می‌شود؛ دو مقدار زیر از آن برداشته می‌شود:
 *        client_email  و  private_key
 *   ۵) ایمیلِ client_email را در Search Console → Settings → Users and permissions
 *      با سطح «Restricted» (یا Full برای siteUrlها) اضافه کنید.
 *      ⚠️ بدون این مرحله، API خطای 403 Forbidden می‌دهد.
 *   ۶) مقادیر را اینجا بگذارید و فایل را روی هاست کنار api/ قرار دهید.
 *
 * نکته: برای Domain property از 'sc-domain:pishtaj.ir' استفاده کنید؛
 * در غیر این صورت همان 'https://pishtaj.ir/' درست است.
 */
return [
    'client_email' => 'ptf-gsc@YOUR-PROJECT.iam.gserviceaccount.com',

    /* کلید خصوصی را دقیقاً همان‌طور که در فایل JSON آمده کپی کنید
       (با \nها — داخل " دوتایی تا PHP آن‌ها را به خط جدید تبدیل کند) */
    'private_key'  => "-----BEGIN PRIVATE KEY-----\nMIIE...YOUR-KEY...\n-----END PRIVATE KEY-----\n",

    'site_url'     => 'https://pishtaj.ir/',
];
