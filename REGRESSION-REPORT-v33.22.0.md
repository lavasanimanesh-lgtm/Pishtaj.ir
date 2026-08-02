# REGRESSION-REPORT — v33.22.0 (۱۴۰۵/۰۸/۱۱)

اجرا: `node _tools/run-full-regression.js` روی کد نهایی v33.22.0 (پس از دو اصلاح گذارندهٔ خود این نشست:
۱) جابه‌جایی هلپرهای sync_key_* از داخل switch به top-level (قانون تعریف شرطی PHP) با چک دائمی در tester301؛
۲) گِیت نسخهٔ tester300 منعطف شد (خواندن VER از index.html به‌جای رشتهٔ ثابت v33.21).

## نتیجهٔ نهایی

| شاخص | مقدار | مقایسه |
|---|---|---|
| تسترها | ۲۹۶ | ۲۹۵ + tester301 (جدید) |
| فایل PASS / FAIL | **۲۴۰ / ۵۶** | baseline ۵۶ فایل FAIL بایت‌به‌بایت برابر — صفر شکست جدید |
| چک PASS / FAIL | **۵۴۱۱ / ۸۴** | ۵۳۹۱ (v33.21.1) + ۲۰ (tester301) |

## tester301-mysql-sync-wire: ۲۰/۰
- هلپرها: sync_key_read/write + گزارش شکست DB در mysql + **top-level بودن (قبل از switch)**
- data_push: archive/offers/conflict/zero-shield از مسیر یکپارچه؛ نوشتن با rev+۱؛ dbWriteFailed → needRetry + آزادسازی قفل + بدون meta
- data_pull: مقدار کلید از مسیر یکپارچه + tombstone + آرشیو تنبَل
- db-lib: اتصال کش‌شده (static) ×۴+؛ write_rev (off→true)؛ کش کانفیگ + تازه‌سازی پس از save
- سازگاری legacy: رشته‌های pinned تسترهای tombstone/conflict پابرجا (tester274/297/170 … سبز)

## gateها
- `python3 _tools/audit.py` → ✅ ۰ خطا — zip: ۵۵۸ ورودی یکسان، با api/crm.php و api/db-lib.php به‌روز
