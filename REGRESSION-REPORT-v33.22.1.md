# REGRESSION-REPORT — v33.22.1 (۱۴۰۵/۰۸/۱۱)

اجرا: `node _tools/run-full-regression.js` روی کد نهایی v33.22.1 (پس از اصلاح گذارندهٔ این نشست:
بازگرداندن رشتهٔ legacy `فایل migrate.php → حذف` در پیام guard — tester297 دوباره سبز شد).

## نتیجهٔ نهایی

| شاخص | مقدار | مقایسه |
|---|---|---|
| تسترها | ۲۹۷ | ۲۹۶ (v33.22.0) + tester302 (جدید) |
| فایل PASS / FAIL | **۲۴۱ / ۵۶** | baseline ۵۶ فایل FAIL بایت‌به‌بایت برابر — **صفر شکست جدید** |
| چک PASS / FAIL | **۵۴۲۱ / ۸۴** | ۵۴۱۱ (v33.22.0) + ۱۰ (tester302) |

* Run میانی (پیش از اصلاح رشتهٔ legacy): ۲۴۰/۵۷ فایل — تنها شکست جدید tester297 (/۱) بود که با
  بازگرداندن رشتهٔ pinned در همان اجرا اصلاح و با ران هدفمند tester297/301/302 تأیید شد (۱۹/۰، ۲۰/۰، ۱۰/۰).

## tester302-migrate-reset-opcache: ۱۰/۰ (جدید)
- db-lib: قبل از `require` کانفیگ → `@clearstatcache(true, $p)` + `opcache_invalidate` (محافظت‌شده)
- db-lib: پس از ذخیرهٔ کانفیگ → کش request تازه + OPcache باطل (×۲)
- migrate: بلوک `$step === 'reset_mode'` **قبل** از گارد `mode === 'mysql'`
- بازنشانی: فقط در mode=mysql؛ `require_token` + تایپ دقیق «بازنشانی»
- فقط `$cfg['mode'] = 'off'` + `reset_at` — بقیهٔ کانفیگ (db_name/user/pass) دست‌نخورده
- صفحهٔ قفل: فرم reset_mode (با mig_token پنهان + confirm_word) + تشخیص‌گر (mode + filemtime کانفیگ)
- راهنمای ادامهٔ مراحل ۱–۶ پس از بازنشانی

## تسترهای مرتبط (ران هدفمند پس از اصلاح نهایی)
- tester297-mysql-migration: **۱۹/۰** (گارد + پیام حذف legacy پابرجا)
- tester301-mysql-sync-wire: **۲۰/۰** (گیت نسخهٔ انعطاف‌یافته: VER از index خوانده می‌شود)
- tester300-delta-poll: سبز (در رگرسیون کامل بالا)
