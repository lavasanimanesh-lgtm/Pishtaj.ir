# گزارش اجرای سئو فازهای ۲ تا ۵ — ۵۰ کلمه کلیدی

**تاریخ:** ۲۰۲۶-۰۸-۱۶ | **دامنه:** pishtaj.ir | **وضعیت:** اجرا کامل شد (بدون وقفه)

---

## جمع‌بندی اجرا

| آیتم | نتیجه |
|---|---|
| صفحات فرود جدید (فاز ۲) | **۱۰ صفحه** ساخته شد |
| صفحات محصول بهینه‌سازی/لینک‌شده | **۷۷ صفحه** |
| مقالات وبلاگ لینک‌شده | **۲۱ مقاله** |
| مقالات پایگاه دانش لینک‌شده (نوبت قبل) | **۴۴۸ مقاله** |
| صفحات برند/اعتبار بهینه‌شده | rfq، quality + تأیید سایر |
| URL ثبت‌شده در نقشه سایت | **۶۳۱ URL** (کل) |
| اعتبارسنجی JSON-LD | ✅ همه معتبر |

---

## فاز ۲ — توسعه تجاری (۱۰ کلمه → ۱۰ صفحه فرود جدید)

همه صفحات در `/suppliers/` با Schema کامل (Organization + Breadcrumb + Service + FAQPage)، تایتل keyword-first و محتوای تجاری ساخته شدند:

| # | کلمه کلیدی | صفحه ساخته‌شده |
|---|---|---|
| 1 | تامین‌کننده شیرآلات صنعتی | `suppliers/valve-supplier.html` |
| 2 | تامین‌کننده تجهیزات برق صنعتی | `suppliers/electrical-supplier.html` |
| 3 | تامین‌کننده تجهیزات نیروگاهی | `suppliers/power-plant-supplier.html` |
| 4 | تامین‌کننده تجهیزات پالایشگاهی | `suppliers/refinery-supplier.html` |
| 5 | تامین‌کننده تجهیزات صنایع فولاد | `suppliers/steel-supplier.html` |
| 6 | تامین‌کننده تجهیزات صنایع سیمان | `suppliers/cement-supplier.html` |
| 7 | تامین‌کننده پمپ صنعتی | `suppliers/pump-supplier.html` |
| 8 | تامین‌کننده کمپرسور صنعتی | `suppliers/compressor-supplier.html` |
| 9 | واردات تجهیزات صنعتی | `suppliers/industrial-import.html` |
| 10 | تامین کالای پروژه EPC | `suppliers/epc-project-supply.html` |

علاوه بر این: هاب `suppliers/index.html` بازسازی شد (۱۳ کارت + ItemList Schema با ۱۳ آیتم)، لینک از صفحه اصلی و صفحات خدمات (`valves-supply`، `electrical-supply`) به صفحات جدید اضافه شد.

---

## فاز ۳ — لانگ‌تیل اطلاعاتی (۱۰ کلمه → بهینه‌سازی + لینک صفحات موجود)

هر صفحه اطلاعاتی به صفحه تجاری مرتبط متصل شد (لینک داخلی موضوعی):

| # | کلمه کلیدی | صفحه | اقدام |
|---|---|---|---|
| 1 | تفاوت لوله A106 و A333 | `blog/a106-vs-a333-pipes.html` | لینک → تامین‌کننده پایپینگ |
| 2 | استاندارد API 600 | `knowledge-center/api-600-gate-valve-standard.html` | لینک → شیرآلات |
| 3 | گواهی MTC EN 10204 | `blog/mtc-tpi-inspection-guide.html` | لینک → هاب تامین‌کننده |
| 4 | تست غیرمخرب NDT | `knowledge-center/kc-ndt-method-selection-by-defect-type.html` | لینک → پایپینگ |
| 5 | پروتکل HART | `knowledge-center/kc-hart-*.html` | لینک → ابزار دقیق |
| 6 | اینکوترمز FOB و CIF | `knowledge-center/kc-incoterms-fob-cif-risk-transfer-comparison.html` | لینک → هاب |
| 7 | پمپ سانتریفیوژ API 610 | `knowledge-center/kc-api-610.html` | لینک → پمپ/دوار |
| 8 | سایزینگ کنترل ولو | `tools/control-valve-sizing/` | موجود و بهینه |
| 9 | گاز دتکتور | `blog/gas-detection.html` | لینک → ابزار دقیق |
| 10 | فلومتر کوریولیس | `services/products/coriolis-flowmeter.html` | لینک → ابزار دقیق |

---

## فاز ۴ — برند و اتوریته (۱۰ کلمه)

| # | کلمه کلیدی | صفحه | اقدام |
|---|---|---|---|
| 1 | پیشرو تجهیز فرتاک | `index.html` | تایتل/اسکیما حاوی برند (تأیید) |
| 2 | Pishro Tajhiz Fartak | `en/index.html` | تایتل انگلیسی (تأیید) |
| 3 | تامین‌کننده تجهیزات صنعتی ایران | `suppliers/` | هاب (تأیید) |
| 4 | شرکت تامین تجهیزات نفت و گاز | `industries/oil-gas/` | تأیید |
| 5 | بهترین تامین‌کننده تجهیزات صنعتی | `about/why-ptf/` | تأیید |
| 6 | تامین‌کننده تجهیزات پروژه‌های صنعتی | `suppliers/` | تأیید |
| 7 | استعلام قیمت تجهیزات صنعتی | `rfq/` | **تایتل ارتقا یافت** (+«قیمت») |
| 8 | دریافت پیش‌فاکتور تجهیزات صنعتی | `rfq/` | **متا-دسکریپشن ارتقا یافت** (+«پیش‌فاکتور») |
| 9 | مرکز دانش تجهیزات صنعتی | `knowledge-center/` | تأیید |
| 10 | گارانتی و اصالت کالای صنعتی | `quality/` | **متا-دسکریپشن ارتقا یافت** (+«ضمانت اصالت کالا») |

---

## فاز ۵ — تجاری تکمیلی (۱۰ کلمه → بهینه‌سازی صفحات محصول موجود)

صفحات محصول از قبل تایتل «خرید و تامین X» و Schema کامل داشتند؛ لینک داخلی به صفحه تامین‌کننده مرتبط اضافه شد:

| # | کلمه کلیدی | صفحه محصول | لینک به |
|---|---|---|---|
| 1 | تامین شیرآلات پتروشیمی | `services/products/ball-valve.html` و هم‌خانواده | تامین‌کننده شیرآلات |
| 2 | تامین لوله استینلس استیل | `services/products/stainless-steel-pipe.html` | تامین‌کننده پایپینگ |
| 3 | تامین تجهیزات ابزار دقیق پتروشیمی | (خانواده ابزار دقیق) | تامین‌کننده ابزار دقیق |
| 4 | تامین گسکت صنعتی | `services/products/industrial-gaskets.html` | تامین‌کننده پایپینگ |
| 5 | تامین ترانسمیتر فشار | `services/products/pressure-transmitter.html` | تامین‌کننده ابزار دقیق |
| 6 | تامین تابلو برق صنعتی | `services/products/lv-mv-switchgear.html` | تامین‌کننده برق صنعتی |
| 7 | تامین کابل صنعتی | `services/products/industrial-power-instrument-cable.html` | تامین‌کننده برق صنعتی |
| 8 | تامین پمپ گریز از مرکز | `services/products/api-610-centrifugal-pump.html` | تامین‌کننده پمپ |
| 9 | تامین فلومتر صنعتی | `services/products/flowmeter.html` | تامین‌کننده ابزار دقیق |
| 10 | تامین شیر اطمینان PSV | `services/products/psv-prv-safety-valve.html` | تامین‌کننده شیرآلات |

> مجموعاً **۷۷ صفحه محصول** بر اساس دسته‌بندی موضوعی به صفحه تامین‌کننده مرتبط متصل شدند.

---

## ساختار لینک‌سازی داخلی نهایی

```
صفحه اصلی ──► suppliers/ (هاب، ۱۳ کارت)
                 ├── piping-supplier      ← ۵۲ مقاله پایگاه دانش + ۱۳ صفحه محصول + ۴ وبلاگ
                 ├── instrumentation-supplier ← ۳۸ + ۱۸ + ۴
                 ├── petrochemical-supplier   ← ۲۴ + ۸ + ۱
                 ├── valve-supplier           ← ۱۱ + ۳ + (مقالات شیرآلات)
                 ├── electrical-supplier      ← ۱۰ + ۲
                 ├── power-plant-supplier     ← ۵ + ۱
                 ├── refinery / steel / cement / pump / compressor / import / epc
                 └── ...
```

---

## اقدامات عملیاتی باقی‌مانده (خارج از سورس)

1. **دیپلوی** روی سرور + ثبت `sitemap-index.xml` در Search Console + Request Indexing برای ۱۰ صفحه جدید.
2. **بک‌لینک و برند آفلاین:** Google Business Profile، دایرکتوری‌های صنعتی، رپورتاژ معتبر.
3. **رصد هفتگی رتبه** کلمات ۵۰گانه + اصلاح CTR.

---

> **نکته:** اسکریپت‌های مولد در `_tools/seo_supplier_generator.py` و `_tools/seo_phase2_data.py` برای تکرارپذیری و توسعه فازهای بعد نگهداری شده‌اند.
