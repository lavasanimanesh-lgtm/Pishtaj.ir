# ریلیزنوت v24.9 — تقویت دریافت نرخ سنا از ice.ir + TGJU

## مشکل
نرخ سنا در نوار ارز نمایش داده نمی‌شد (usd_sana_*/eur_sana_* خالی).

## راهکار
1. **ice.ir تقویت شد:** چند host/path/mode، UA مرورگر، Referer، پارس JSON/برچسب/عدد
2. **TGJU به‌عنوان fallback سنا/ICE:** کلیدهای `sana_buy_usd`, `ice_usd`, و مشابه برای یورو
3. HTTP client پایدارتر برای sanarate/ice/tgju

## محدودیت واقعی
اگر هاست خارج ایران باشد، ice.ir ممکن است صفحه «فقط در داخل ایران» بدهد — در آن حالت TGJU/isat مسیر جایگزین‌اند.
هاست باید outbound به `ice.ir` و `*.tgju.org` و `sanarate.ir` داشته باشد.

## Verify
- داشبورد: دلار/یورو سنا یا حداقل «سنا: منبع…»
- admin → تست منبع: JSON با usd_sana_buy/sell
