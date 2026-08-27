# یادداشت انتشار CRM v34.8.26

تاریخ: ۱۴۰۵/۰۶/۰۵ (۲۰۲۶-۰۸-۲۷)

## W3 — مهاجرت فرمانی موج سوم (حساس‌ترین مالی، ۶ کلید، ۳۵ نقطه، ۷ فایل)
invoices / case_receipts / receipt_allocations / corrections / fin_findings / sales_returns

- ثبت‌های اصلی از قبل فرمان اختصاصی داشتند (register_invoice / register_unofficial_invoice /
  correct_invoice / void_receipt با نقش‌های FIN_ROLES) — این موج **ویرایش‌ها، تکمیل‌ها و
  حذف‌های UI** را از روتر فرمانی عبور می‌دهد
- حذف آبشاری فاکتور (پاک‌سازی زنجیرهٔ پیشنهاد) = فرمان tombstone بازیافت‌پذیر
- رجیستری: نقش‌ها فقط ارشد + accountant (مالی — sales/buyer/collector این کلیدها را
  در ماتریس legacy ندارند؛ تناسب کامل حفظ شد)
- maxFields: invoices=200؛ sortIso با fallback فیلدهای مالی (iso/updatedAtISO/issueDate/invDate/t)
- عمداً legacy: مسیرهای rollback (کنترل جریان خطا) و fallbackهای else

### کنترل
tester528 (۱۵ قرارداد: صفر بایپس، رجیستری، A11 با ۱۷ کلید).
