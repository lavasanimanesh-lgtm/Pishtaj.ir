# v34.39.41 — مشتریان، نسخه ارزی، تب‌های ارجاع درخواست، اعلان ثبت از سایت (۲۰۲۶-۰۹-۲۹)

## ۱) مشتری جدید در صدر فهرست
- ریشه: فهرست واقعی از `renderCustomers2` (`crm/offers.js`) رندر می‌شد که مرتب‌سازی نداشت.
- اصلاح: `ptfCustSortNewest` در همان رندر اعمال شد؛ کلید مرتب‌سازی = سال + شمارهٔ کد (نزولی)، سپس زمان ثبت.

## ۲) کادر نسخه ارزی (تبدیل ریالی → ارزی)
- کادر سبز زیر پیشنهاد ریالی با دکمه‌های نمایش / چاپ-PDF / شرایط برای هر نسخه ارزی (هم‌ارز کادر نسخه ریالی).
- `ptfFxCompanionsOf` نسخه‌هایی را که `fxOf` را در همگام‌سازی از دست داده‌اند از `fxConvert.from` بازمی‌یابد.
- برچسب «ارزی از …» در کشوی پرونده فروش.

## ۳) تب‌های «👤 ارجاع به من» و «📌 با مسئول» در درخواست‌ها
- ریشه: select پنهان `#rOfferFlt` فقط گزینه‌های `''/none/has` را داشت؛ مقداردهی `mine`/`assigned` نادیده گرفته می‌شد و مقدار به `''` برمی‌گشت ⇒ فیلتر «همه».
- اصلاح: دو گزینه به select اضافه شد؛ `ptfRfqIsAssignedToMe` برای ارجاع‌های قدیمی (رشته یا فقط نام) هم مقاوم شد.

## ۴) اعلان ثبت استعلام / تامین‌کننده از سایت
- `api/crm.php` (`add_rfq_site`، `add_supplier`): پیامک به 09126473290 (قابل تغییر با `site_alert_mobiles` در `sms-config.php`) + پیام بات در گروه شرکت (`bot-config.php`، تلگرام/بله). ارسال پس از پاسخ به کاربر؛ خطا فقط لاگ می‌شود.

## ۵) سایر
- حذف فوتر تماس از صفحات CRM (به‌جز قالب سربرگ).

## بامپ نسخه
- `VERSION.json`، `PTF_CRM_RELEASE`، `crm/sw.js` (RELEASE/ASSET_VERSION/CACHE)، `crm/manifest.json`، پین‌های `?v=` در صفحات CRM، `clear-cache.html`، `device-reconnect.html`، `shell.js`، `cms.js`، `SD_SERVICE_VERSION` ⇒ **v34.39.41**؛ پین تسترها با `_tools/uat/bump-version-pins.js 34.39.40`.

## تست و رگرسیون
- `_tools/uat/tester681-v34.39.41-session-fixes.js` — **84 PASS / 0 FAIL** (در گیت CI ثبت شد). کد واقعی اجرا می‌شود: `renderCustomers2`، `ptfOfferFxConvertCommit` + `renderOffers`، `ptfRfqOfferFlt/filterRfq` با select شبیه‌سازی‌شدهٔ رفتار مرورگر.
  - آزمون جهش: با بازگرداندن کد قبل از اصلاح، ۱۷ مورد قرمز می‌شود (ریشه‌ها واقعاً پوشش داده شده‌اند).
- `_tools/uat/e2e-site-alert-v34.39.41.js` — **26 PASS / 0 FAIL** روی خودِ `api/crm.php` با PHP 8.4 واقعی (php-wasm): کپچا/OTP واقعی، ذخیره، پیامک (گیرنده/متن/خط)، بات تلگرام و بله، کپچای نامعتبر، شماره نامعتبر، گیرندگان سفارشی، خرابی سرویس‌ها، نبود کانفیگ.
  - اجرا: `mkdir -p /tmp/phpw && cd /tmp/phpw && npm i php-wasm` سپس `NODE_PATH=/tmp/phpw/node_modules node _tools/uat/e2e-site-alert-v34.39.41.js`
- گیت کامل CI: **294 PASS / 0 FAIL**. کامپایل `crm.php`، `sales-domain.php`، `notify-bot.php`، `contact.php` با PHP واقعی سالم.
- یافتهٔ تست: اعلان‌ها اکنون صف + `ptf_site_alert_flush()` یک‌بارمصرف دارند (shutdown همان را صدا می‌زند) — قابل تست و بدون ارسال تکراری.
- یافتهٔ تست فوتر: در بازهٔ ۷۹۱–۸۵۰px قاعدهٔ قدیمی `style.css` تک‌ستونه بود؛ اکنون سه‌ستونه (هر ستون ≥ ۲۰۰px).
