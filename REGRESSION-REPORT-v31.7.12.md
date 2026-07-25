# 📊 گزارش رگرسیون v31.7.12

**تاریخ:** ۱۴۰۵/۰۴/۲۸ (2026-07-19)
**نسخه:** v31.7.12
**ابزار:** `_tools/run-full-regression.js` + `python3 _tools/audit.py` (۱۰ بخش)

## ✅ نتیجه نهایی

| معیار | مقدار | وضعیت |
|--------|-------|--------|
| تعداد تسترها | **۱۶۵** (+۱: tester187-offer-refprice) | — |
| فایل‌های PASS | **۱۶۵** | ✅ ۱۰۰٪ |
| چک‌های PASS | **۳,۸۷۷** (+۲۰) | ✅ ۱۰۰٪ |
| چک‌های FAIL | **۰** | ✅ صفر |
| audit.py (۱۰ بخش) | **PASS** | ✅ |
| `node --check` (`offers.js`, `offerlock.js`) | **PASS** | ✅ |

## 🆕 پوشش تست جدید (tester187)

- **فوکوس:** ref/margin دیگر `offRenderItems()` صدا نمی‌زنند؛ helper فیلد فعال (`activeElement`) را دست نمی‌زند؛ id ردیفی در هر دو رندر (offers.js + offerlock.js)
- **اولویت دست کاربر:** `refPriceEdited` بر نرخ کاتالوگ در رندر مقدم
- **رفتاری write-back:** کالای P-1001 از 500,000 به 750,000 با history و refPriceSrc
- **رفتاری ثبت خودکار:** کالای دستی غیرتکراری با کد سرور + `srcRef` (شماره پیشنهاد/درخواست/زمان/کاربر) + قفل ردیف
- **Idempotency:** ذخیره مجدد → نه کالای تکراری، نه history اضافی
- **گاردها:** ptfCheckDup برای تکرار، رد کد TMP (سازگار با CODEGEN-OFFER-SERVER)

## 📁 فایل‌های تغییریافته

`crm/offers.js`، `crm/offerlock.js`، `crm/index.html` (bump)، `crm/sw.js`، `crm/clear-cache.html`، `_tools/uat/tester187-offer-refprice.js` (جدید)

## 🚦 وضعیت گیت‌ها

- **گیت فنی: سبز** ✅
- **گیت انسانی: معوق** ⏳ — ۴ سناریوی «راستی‌آزمایی توسط کارفرما» در RELEASE-NOTES باید در مرورگر واقعی اجرا شود (به‌ویژه سناریوی ۱ فوکوس و سناریوی ۴ عدم تکرار در ذخیره مجدد).
