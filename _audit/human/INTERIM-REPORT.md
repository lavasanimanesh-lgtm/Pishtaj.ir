# 📋 گزارش میانی فاز ۱ و ۲ ممیزی

**تاریخ:** ۱۴۰۵/۰۴/۲۸ (July 2026)

## یافته‌های فاز ۱: تحلیل ایستا
- ۲۳,۹۷۶ خط کد در ۶۲ ماژول
- ۱,۰۷۶ نام تعریف‌شده (۷۹۰ در window)
- ۶۲/۶۲ ماژول در sandbox قابل لود
- ۰ خطای لود بحرانی (matchMedia/MutationObserver توسط jsdom رفع شد)

## یافته‌های فاز ۲: تست‌های رفتاری
از ۳۵۰ تست رفتاری اجرا شده:

### تست‌های قطعی GREEN (تأیید کارکرد):
- ✅ PTF_RFQ_STATUSES (12 وضعیت)
- ✅ ptfRfqSetStatus (US-367)
- ✅ ptfRfqCascadeDelete (US-444)
- ✅ ptfSF_ensure, sfClose, sfCloseAudit (US-437)
- ✅ ptfInqAliases (US-386)
- ✅ ptfSupplierScore, ptfCustomerScore
- ✅ ptfProjectProfitIRR (موتور سود)
- ✅ ptfPettyBalance, ptfShareholderBalance
- ✅ ptfMoney (ریال و ارز)
- ✅ aiWB_quotaLimit (400/50)
- ✅ ptfBrandCanon (زیمنس → Siemens)
- ✅ ptfNum ("1,000,000" → 1000000)
- ✅ ptfPhoneNorm (0912... → +98...)
- ✅ offRowIsEmpty, offSmartInsert
- ✅ ptfAdvanceOpen, ptfAdvanceNormalize
- ✅ all salesfiles, buycompare, scoring, petty, shareholders
- ✅ checkMustChangePass, smsBookRecover (BUG-018)

### تست‌های نیازمند بررسی بیشتر (False Positives):
- ⚠️ بیشتر `false` ها به دلیل استفاده از `new Function()` به جای `vm.runInContext` است. توابع به صورت محلی تعریف شده‌اند ولی به window صادر نشده‌اند.

### تست‌های واقعی معتبر که نیاز به بررسی دارند:
- 🔍 `sfStageOf` فقط با `wonOffer` مرحله > 0 برمی‌گرداند (این منطق درست است)
- 🔍 `sfShipSeqCheck` نیاز به آرگومان‌های کامل دارد

## برنامه فاز ۳
- بررسی یکپارچگی واقعی با `vm.runInContext`
- کیس‌های استادی end-to-end
- بررسی ۱۰ سناریوی تجاری واقعی
- بررسی race conditions

## برنامه فاز ۴
- کیس‌های استادی R12 (پرونده فروش کامل)
- کیس‌های استادی R9 (مالی کامل)
- کیس‌های استادی R14 (یکپارچگی)

## برنامه فاز ۵
- ثبت بک‌لاگ نهایی با اولویت‌بندی
- گزارش به کارفرما
