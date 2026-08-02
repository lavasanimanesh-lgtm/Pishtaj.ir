# REGRESSION-REPORT — v33.21.1 (۱۴۰۵/۰۸/۱۱)

اجرا: `node _tools/run-full-regression.js` روی کد نهایی v33.21.1 (پس از گذارندهٔ tester178: امضای pullCheck سه‌پارامتری شد → چک source-pinned به regex `/function pullCheck\(done, forceFull(, opts)?\)/` بازنویسی شد؛ اجرای نهایی = اعداد زیر).

## نتیجهٔ نهایی

| شاخص | مقدار | مقایسه |
|---|---|---|
| تسترها | ۲۹۵ | همان v33.21.0 |
| فایل PASS / FAIL | **۲۳۹ / ۵۶** | baseline ۵۶ فایل FAIL بایت‌به‌بایت برابر — صفر شکست جدید |
| چک PASS / FAIL | **۵۳۹۱ / ۸۴** | baseline ۵۳۶۶/۸۴ + tester300 جدید ۲۵/۰ |

## تغییرات tester300 در این نسخه (۲۲ → ۲۵ چک)
- سورس: گارد تب به خطوط جدید (۱۸۰/۱۲۰ثانیه + `opts.instant`) به‌روز شد + چک جدید پینگ بین‌تبی (pingTabs ×۲ + listener storage + مقایسهٔ rev + حد نرخ ۵ثانیه)
- runtime: تب مخفی با خط آهسته (اول آزاد، دومی دفع) + پینگ instant حتی در مخفی پول می‌دهد + اعمال پول موفق پینگ با rev می‌نویسد
- زنجیرهٔ نسخه‌گذاری منعطف به v33.21\.x شد

## gateها
- `python3 _tools/audit.py` → ✅ ۰ خطا — zip: ۵۵۸ ورودی یکسان بازسازی شد (`crm-update.zip`)
