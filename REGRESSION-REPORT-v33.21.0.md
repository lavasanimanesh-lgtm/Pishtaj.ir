# REGRESSION-REPORT — v33.21.0 (۱۴۰۵/۰۸/۱۱)

اجرا: `node _tools/run-full-regression.js` روی کد نهایی v33.21.0 (دوپیمایش: تفکیک علت‌مندی tester170 + اجرای نهایی تأیید).

## نتیجهٔ نهایی

| شاخص | مقدار | مقایسه با baseline |
|---|---|---|
| تسترها | ۲۹۵ | ۲۹۴ + tester300 (جدید) |
| فایل PASS / FAIL | **۲۳۹ / ۵۶** | baseline: ۲۳۸/۵۶ → دقیقاً +۱ (tester300 پس) |
| چک PASS / FAIL | **۵۳۸۸ / ۸۴** | baseline: ۵۳۶۶/۸۴ → دقیقاً +۲۲ پس (tester300) |

**فهرست ۵۶ فایل FAIL: بایت‌به‌بایت برابر baseline (بدهی قدیمی v15–v22 + عصر auth) — صفر شکست جدید.**

جزئیات گذارندهٔ موقت: در میانهٔ کار، tester170 یک چک source-pinned روی خط قدیمی fetch پول داشت که
با بازسازی URL به متغیر `pullUrl` شکست خورد؛ طبق الگوی مجرب (tester287/184/274) به چک regex
مقاوم-به-indirection بازنویسی شد (معنای چک حفظ: پول data_pull با هدر توکن + منطق pullSince).
بعد از آن اجرای نهاییٔ کامل = اعداد جدول بالا.

## تستر جدید tester300-delta-poll: ۲۲/۰

- سورس PHP (۴): krevs decode، فیلتر دلتا، سازگاری عقب، فلگ delta + آرشیو تنبَل
- سورس sync.js (۴): krevs در URL، forceFull بدون krevs، گارد تب (hidden/۱۲۰ثانیه)، listenerهای focus/visibilitychange
- runtime pullCheck در vm (۵): krevs واقعی در URL؛ تب مخفی بدون fetch؛ آهسته‌سازی غیرمتمرکز؛ forceFull since=0؛ اعمال دلتا (فقط کلیدهای تغییرکرده + به‌روزرسانی revها)
- سورس client-server (۲) + runtime sharedPull (۳): single-flight (۲ getData → ۱ پول با krevs)؛ به‌روزرسانی مرکزی کش/ذخیره + revها؛ تخلیهٔ تب مخفی
- **BUG-SYNC-RD-SCOPE-001 (۲)**: سورس (بدون `addFrom(rd(` + راهنمای خودکفا) + runtime (sandbox بدون rd → tombstone خطا نمی‌دهد و رکورد حذف‌شده فیلتر می‌شود)
- نسخه‌گذاری (۱)

## gateهای دیگر

- `python3 _tools/audit.py` → ✅ ۰ خطا
- sitemap: ۵۲۰ URL، بدون diff — zip: ۵۵۸ ورودی یکسان بازسازی شد (`crm-update.zip`)
