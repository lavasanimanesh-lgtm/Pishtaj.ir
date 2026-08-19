# گزارش اجرا — کلمات گرانولی تامین‌کننده + فهرست ایندکس سرچ کنسول

**تاریخ:** ۲۰۲۶-۰۸-۱۶ | **دامنه:** pishtaj.ir

---

## ۱) کلمات درخواستی و نتیجه

| کلمه کلیدی | نتیجه | صفحه |
|---|---|---|
| تامین‌کننده فلنج | ✅ صفحه جدید | `suppliers/flange-supplier.html` |
| تامین‌کننده لوله | ✅ صفحه جدید | `suppliers/pipe-supplier.html` |
| تامین‌کننده اتصالات | ✅ صفحه جدید | `suppliers/fittings-supplier.html` |
| تامین‌کننده گسکت | ✅ صفحه جدید | `suppliers/gasket-supplier.html` |
| تامین‌کننده شیرآلات پتروشیمی | ✅ صفحه جدید | `suppliers/petrochemical-valve-supplier.html` |
| تامین‌کننده وکیوم سیرکت بریکر | ✅ صفحه جدید | `suppliers/vcb-supplier.html` |
| تامین‌کننده پروژه‌های صنعتی | ✅ صفحه جدید | `suppliers/industrial-projects-supplier.html` |
| تامین‌کننده پمپ | ✅ از قبل موجود | `suppliers/pump-supplier.html` |
| تامین‌کننده شیرآلات صنعتی | ✅ از قبل موجود | `suppliers/valve-supplier.html` |
| تامین‌کننده تجهیزات فولاد | ✅ بهینه‌سازی شد (عبارت دقیق) | `suppliers/steel-supplier.html` |
| تامین‌کننده برق صنعتی | ✅ بهینه‌سازی شد (عبارت دقیق) | `suppliers/electrical-supplier.html` |

> **۷ صفحه جدید** ساخته شد + **۴ صفحه موجود** تأیید/بهینه شد. حالا سایت **۲۱ صفحه تامین‌کننده** دارد.

---

## ۲) ساختار سیلو (Silo) لینک داخلی ساخته‌شده

```
تامین‌کننده پایپینگ (پدر)
   ├── تامین‌کننده لوله
   ├── تامین‌کننده فلنج
   ├── تامین‌کننده اتصالات
   └── تامین‌کننده گسکت

تامین‌کننده تجهیزات برق صنعتی (پدر)
   └── تامین‌کننده وکیوم سیرکت بریکر (VCB)

تامین‌کننده شیرآلات صنعتی (پدر)
   └── تامین‌کننده شیرآلات پتروشیمی
```

هر صفحه فرزند به صفحه پدر لینک دارد و بالعکس (لینک متقابل + از صفحه اصلی و هاب).

---

## ۳) فهرست کامل صفحات برای ایندکس در سرچ کنسول

### روش اصلی (یک‌بار، توصیه‌شده):
در **Google Search Console → Sitemaps**، آدرس زیر را ثبت کن:
```
https://pishtaj.ir/sitemap-index.xml
```
این ایندکس همه‌ی ۶۳۸ URL را پوشش می‌دهد (شامل تمام صفحات تامین‌کننده، خدمات، صنایع، محصولات، وبلاگ و پایگاه دانش).

### صفحات اولویت‌دار برای «Request Indexing» دستی (اختیاری برای سرعت بیشتر):

پس از دیپلوی، این ۲۱ صفحهٔ تامین‌کننده را یکی‌یکی در **URL Inspection** وارد و «Request Indexing» بزن:

| # | آدرس |
|---|---|
| 1 | `https://pishtaj.ir/suppliers/` |
| 2 | `https://pishtaj.ir/suppliers/piping-supplier.html` |
| 3 | `https://pishtaj.ir/suppliers/pipe-supplier.html` |
| 4 | `https://pishtaj.ir/suppliers/flange-supplier.html` |
| 5 | `https://pishtaj.ir/suppliers/fittings-supplier.html` |
| 6 | `https://pishtaj.ir/suppliers/gasket-supplier.html` |
| 7 | `https://pishtaj.ir/suppliers/instrumentation-supplier.html` |
| 8 | `https://pishtaj.ir/suppliers/electrical-supplier.html` |
| 9 | `https://pishtaj.ir/suppliers/vcb-supplier.html` |
| 10 | `https://pishtaj.ir/suppliers/valve-supplier.html` |
| 11 | `https://pishtaj.ir/suppliers/petrochemical-valve-supplier.html` |
| 12 | `https://pishtaj.ir/suppliers/pump-supplier.html` |
| 13 | `https://pishtaj.ir/suppliers/compressor-supplier.html` |
| 14 | `https://pishtaj.ir/suppliers/petrochemical-equipment-supplier.html` |
| 15 | `https://pishtaj.ir/suppliers/refinery-supplier.html` |
| 16 | `https://pishtaj.ir/suppliers/power-plant-supplier.html` |
| 17 | `https://pishtaj.ir/suppliers/steel-supplier.html` |
| 18 | `https://pishtaj.ir/suppliers/cement-supplier.html` |
| 19 | `https://pishtaj.ir/suppliers/industrial-projects-supplier.html` |
| 20 | `https://pishtaj.ir/suppliers/epc-project-supply.html` |
| 21 | `https://pishtaj.ir/suppliers/industrial-import.html` |

---

## ۴) نکات مهم برای ایندکس سریع‌تر

1. **اول دیپلوی کن** (فایلها روی سرور بروند)، بعد در سرچ کنسول ایندکس بزن — Request Indexing روی URLای که هنوز لایو نیست خطا می‌دهد.
2. **`robots.txt` را چک کن** که `Sitemap: https://pishtaj.ir/sitemap-index.xml` باشد (الان روی سورس درست شده).
3. **هشدار Cannibalization:** چون حالا چند صفحهٔ هم‌خانواده داری (پایپینگ ← لوله/فلنج/اتصالات/گسکت)، در گزارش Coverage سرچ کنسول اگر دو صفحه برای یک کوئری رقابت کرد، صفحهٔ گرانولی (فرزند) را برای کوئری خاص تقویت کن و صفحهٔ پدر را برای کوئری عمومی — این ساختار از قبل طوری طراحی شده که هر کدام کلمهٔ خودش را هدف بگیرد.
4. **بک‌لینک/برند آفلاین** هنوز مهم‌ترین عامل برای «اول شدن» است: Google Business Profile + دایرکتوری صنعتی + رپورتاژ معتبر را موازی پیش ببر.

---

## ۵) اعداد نهایی

| شاخص | مقدار |
|---|---|
| کل صفحات تامین‌کننده | **۲۱** |
| صفحات جدید این نوبت | **۷** |
| کل URL در نقشه سایت | **۶۳۸** |
| اعتبارسنجی JSON-LD | ✅ همه معتبر |
| اعتبارسنجی لینک داخلی | ✅ بدون لینک شکسته |
