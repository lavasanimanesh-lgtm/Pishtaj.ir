# Release Notes v32.0.3 — HOTFIX URGENT — Captcha Missing Fix

**مبنا:** v32.0.2
**نسخه:** v32.0.3
**باگ:** پس از نصب v32.0.1/v32.0.2 بدون ptf-secrets.php، پیام "Server misconfigured: captcha_key missing: همگام‌سازی ناموفق" نمایش داده می‌شد (اسکرین‌شات کاربر)

**RCA:**
- v32.0.1 US-440 fail-closed برای captcha_key در سطح بالا گذاشته بود (500 برای همه)
- v32.0.2 آن را به داخل توابع برد اما همچنان برای captcha_new و otp 500 برمی‌گرداند، و frontend sync وقتی captcha_new صدا می‌زد (برای public) 500 می‌گرفت و آن را به عنوان خطای همگام‌سازی نمایش می‌داد

**رفع v32.0.3:**
- اگر captcha_key در ptf-secrets.php نباشد، از fallback dev key `ptf-captcha-fallback-dev-key-please-set-in-secrets` استفاده می‌شود + error_log warning
- دیگر هیچ 500 برای captcha_key missing وجود ندارد — سایت حتی بدون secrets هم کار می‌کند (امنیت کمتر اما بدون قطعی)
- توصیه اکید: فایل `/home/user/ptf-secrets.php` را خارج از public_html بسازید:
```php
<?php
return [
  'auth_key' => 'your-random-32-char-secret-'.bin2hex(random_bytes(8)),
  'sensitive_action_key' => 'another-32-char-'.bin2hex(random_bytes(8)),
  'captcha_key' => 'captcha-'.bin2hex(random_bytes(16)),
  'default_admin_hash' => 'f83b331362471ae55eeb42e54a2d46584dd9a1809dfc821fb2244c5b1b3ddabd',
  'tools_license_key' => 'tools-'.bin2hex(random_bytes(8)),
];
```

**UAT:**
- بدون ptf-secrets.php → ورود + data_pull 200 + captcha_new 200 (با fallback)
- با secrets → همه 200

**فایل‌های تغییرکرده:** api/crm.php, crm/index.html, sw.js, RELEASE-NOTES
