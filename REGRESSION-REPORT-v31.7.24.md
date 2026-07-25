# 📊 گزارش رگرسیون v31.7.24

**تاریخ:** ۱۴۰۵/۰۴/۲۹ (2026-07-20)
**نسخه:** v31.7.24
**ابزار:** `_tools/run-full-regression.js` + `python3 _tools/audit.py` (۱۰ بخش)

## ✅ نتیجه نهایی

| معیار | مقدار | وضعیت |
|--------|-------|--------|
| تعداد تسترها | **۱۷۷** (+۱: tester199-offer-vanish) | — |
| فایل‌های PASS | **۱۷۷** | ✅ ۱۰۰٪ |
| چک‌های FAIL | **۰** | ✅ صفر |
| audit.py (۱۰ بخش) | **PASS** | ✅ |
| `php -l api/codegen.php` + `node --check crm/offers.js` | **PASS** | ✅ |

## 🆕 پوشش تست جدید (tester199 + E2E)

- **E2E سرور PHP واقعی:** آفر `PTF-CO-1405-0112` فقط در sync → قبل از fix رزرو `0100` (برخورد)؛ بعد از fix `0113` ✅
- بازتولید رفتاری شکایت: پیشنهاد جدید با شماره تکراری → regen به `0113`، افزوده‌شدن به فهرست، آفر قدیمی دست‌نخورده
- بدترین حالت: همه regen ها تکراری → block صریح، صفر overwrite
- رگرسیون: مسیر revision (editMode) سالم؛ رفع v31.7.20 برای keys_map سالم

## 📌 وضعیت TECHDEBT-DATA-DIR-AUDIT

این **مصداق چهارم** شکاف `data/` vs `data/sync/` بود (auth v31.7.7، users v31.7.14، codegen-keys v31.7.20، اکنون codegen-offers). ممیزی انجام‌شده در این ریلیز: `grep` کامل `api/*.php` — نقاط باقیمانده خواندن از `crm/data` بدون sync: `save_backup` (طراحی عمدی — بک‌آپ از خود sync می‌خواند)، `data-health-check` (هر دو را می‌بیند). **آیتم TECHDEBT-DATA-DIR-AUDIT اکنون قابل بستن است** مگر فایل سروری جدیدی اضافه شود؛ قاعده در Master Handover ثبت شد.

## 📁 فایل‌های تغییریافته

`api/codegen.php`، `crm/offers.js`، `crm/index.html` (bump)، `crm/sw.js`، `crm/clear-cache.html`، `_tools/uat/tester199` (جدید)

## 🚦 وضعیت گیت‌ها

- **گیت فنی: سبز** ✅
- **گیت انسانی: معوق** ⏳ — ثبت دو CO متوالی روی سرور واقعی + راستی‌آزمایی با کاربر شاکی + بررسی بک‌آپ برای آفرهای بازنویسی‌شده احتمالی.
