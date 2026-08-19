# یادداشت انتشار v34.7.40 — نگهبان معماری پایدار

**تاریخ:** 2026-08-19

## نتیجه

نگهبان معماری H1 نسبت به جابه‌جایی خط پایدار و نسبت به افزودن finding تکراری حساس شد. دو بدهی واقعی A2/A9 نیز به‌جای پذیرفته‌شدن در baseline رفع شدند.

تغییرات پیشنهادی workflowهای GitHub در این release منتشر نمی‌شوند: GitHub App عامل مجوز `Workflows: write` ندارد. workflow موجود `Deploy to Staging` همچنان pushهای `arena/**` را خودکار deploy می‌کند؛ گیت تقویت‌شدهٔ پیش از FTP تا اعطای مجوز یا اعمال دستی workflowها باز می‌ماند. هیچ تغییری در workflow پروداکشن از این شاخه منتشر نشده است.

## تغییرات محصول و نگهبان

- debt swap تازهٔ A2 در مالک ضمیمهٔ فاکتور با تبدیل `cd || _id` به `_id || cd` رفع شد و وارد baseline نشد.
- تعریف تکراری واقعی `window.ptfSetInvoiceDue` حذف شد.
- امضای A2/A3 در architecture guard از شمارهٔ خط به hash محتوای نرمال‌شده تغییر کرد.
- مقایسهٔ baseline به multiset تبدیل شد تا تکرار یک signature همچنان بدهی جدید محسوب شود.
- self-test نگهبان و regression سرتاسری `tester443` به گیت کانونی افزوده شد.

## مهاجرت کنترل‌شدهٔ baseline

پیش از بازتولید baseline، نگهبان جدید روی snapshot دقیق commit ثبت مبنای `v34.7.31` نیز اجرا شد و multiset امضاهای محتوایی آن با وضعیت جاری مقایسه شد. A3 و همهٔ قواعد دیگر به‌جز A2/A9 بدون جابه‌جایی signature یکسان بودند. بررسی A2 یک debt swap را آشکار کرد: finding قدیمی `sync.js` رفع شده بود، اما finding تازه‌ای در `customer-finance.js` با ترتیب `cd || _id` آمده بود؛ این مورد نیز به `_id || cd` اصلاح شد و وارد baseline نشد. duplicate واقعی A9 هم حذف شد.

| قاعده | baseline پایدار v34.7.31 | پیش از اصلاح H1 | baseline نهایی |
|---|---:|---:|---:|
| A1 | 5 | 5 | 5 |
| A2 | 1 | 1 (signature متفاوت) | 0 |
| A3 | 105 | 105 | 105 |
| A4 | 0 | 0 | 0 |
| A5 | 0 | 0 | 0 |
| A6 | 0 | 0 | 0 |
| A7 | 36 | 36 | 36 |
| A8 | 0 | 0 | 0 |
| A9 | 24 | 25 | 24 |

بنابراین baseline برای پنهان‌کردن بدهی جدید refresh نشده است: debt swap قاعدهٔ A2 و duplicate قاعدهٔ A9 هر دو رفع شدند و فقط identity یافته‌های A2/A3 از شمارهٔ خط به signature پایدار مهاجرت کرد.

## راستی‌آزمایی محلی

- `tester436`: **11 PASS / 0 FAIL**
- `tester431`: **20 PASS / 0 FAIL**
- `tester442`: **PASS**
- `tester443`: **PASS**
- `arch-guard --self-test`: **PASS**
- `arch-guard`: **PASS**
- گیت کامل release: **55 PASS / 0 FAIL**
- syntax همهٔ JSهای `crm/` به‌جز vendor minified: **PASS**

PHP CLI در محیط محلی عامل موجود نبود. lint واقعی PHP باید در GitHub Actions نهایی، پس از امکان انتشار workflow اصلاح‌شده، فعال شود.
