# نتایج تست ادغام گام ۴ — ۱۴۰۵/۰۵/۲۶ (۲۰۲۶-۰۸-۱۷)

**هدف:** تأیید یکپارچگی کامل توابع ارائه\u200cشده در گام\u200cهای ۱، ۲، ۳ بدون هیچ تغییر کدی جدید.

**روش:** بارگذاری کامل `crm/unofficial-invoice.js` در یک sandbox VM در محیط Node با mock‌های:
- localStorage در حافظه (`STORE`)
- توابع DOM (window.open, document.write, ...)
- توابع سیستمی (ptfSalesFileOffers, ptfLedgerOfOpex, sfStageOf و ...)
- داده\u200cهای مصنوعی (offers, deals, customers, invoices, receipts, allocations, cheques, returns)

**نتیجه کلی:** ✅ ۴۳ / ۴۳ تست قبول (۱۰۰٪)

## سناریوهای تست

| # | سناریو | ادعا | تأیید |
|---|---|---|---|
| **T1** | صدور تک‌پیشنهاد + ویرایش قیمت | `invoiceKind=single`، `sourceOfferNo` صحیح، `overridedFromOffer=true`، مبلغ = `3×1200=3600`، `qtyOrig`/`priceOrig` حفظ، ویرایش در items | ✅ ۱۱/۱۱ |
| **T2** | صدور تجمیعی (۲ پیشنهاد) | `invoiceKind=consolidated`، کد با پیشوند `UN-INV-CONSOLIDATED`، `consolidatedFromOffers` آرایه، مبلغ = ۳۰۰۰ | ✅ ۵/۵ |
| **T3** | collector پیشنهادهای متصل | تشخیص ۲ پیشنهاد مرتبط (CO + TC) با `hasFinancialOffer=true`، `priceSourceOffer` = اولین CO | ✅ ۳/۳ |
| **T4** | ابطال ریشه\u200cکن + cascade | `void ok=true`، rکورد void، وصولی حفظ، چک فقط audit، تخصیص‌ها برگشت، `freedCreditAmount=6000`، receipt'ها `creditRemainIRR` بازسازی، timeline اضافه | ✅ ۱۱/۱۱ |
| **T5** | حفاظت وصولی‌های مندرج (الزام ۵) | ۲ پرداخت در `inv.payments` پس از ابطال حفظ می‌شوند + `preservedPayments=2` | ✅ ۲/۲ |
| **T6** | snapshot preserves | `qtyOrig`/`priceOrig` حفظ، `qty`/`price` قابل ویرایش | ✅ ۴/۴ |
| **T7** | guard های ابطال | cd نامعتبر، فاکتور رسمی، قبلاً void → هر سه `ok=false` | ✅ ۳/۳ |
| **T8** | guard نقش | نقش sales مسدود می‌شود (alert) | ✅ ۱/۱ |
| **T9** | اتصال به دفتر مشتری | `customerId`/`caseId` صحیح، مبلغ در `ptf_crm_invoices` | ✅ ۳/۳ |

## دستاوردهای تأیید شده

1. **الزام ۱ (ویرایش قیمت):** سلول\u200cهای `qty`/`price` در جدول اقلام، مستقل از `qtyOrig`/`priceOrig` عمل می\u200cکنند و در `linesSnapshot` رکورد فاکتور ذخیره می\u200cشوند. مبلغ نهایی (`inv.amount`) از روی مقادیر WIDTHسنه\u200cشده محاسبه می\u200cشود.
2. **الزام ۲ (مبنای مطالبات):** `inv.amount` = `Σ qty × price` از `linesSnapshot` (نه از CO). پایهٔ مطالبات = فاکتور صادره.
3. **الزام ۳ (تجمیع):** کلید `UN-INV-CONSOLIDATED-<deal>-<ts>`، `consolidatedFromOffers[]`، ادغام اقلام با حذف تکراری (dedup by `pcode||name||desc`).
4. **الزام ۴ (ریشه\u200cکن):** cascade پنج مرحله\u200cای کامل، چک‌ها فقط audit، تخصیص‌ها برگشت + بستانکاری‌سازی، مرجوعی‌ها void.
5. **الزام ۵ (حفاظت وصولی):** پرداخت\u200cهای مندرج + پیش\u200cپرداخت + رکوردهای مرتبط حفظ + audit log.

## فایل تست

- مسیر: `/tmp/step4_test.js` (Node.js VM-based)
- اجرا: `node /tmp/step4_test.js`
- نیازمندی: Node.js v18+، دسترسی به `/home/user/Pishtaj.ir/crm/unofficial-invoice.js`
- هیچ وابستگی خارجی به ماژول\u200cهای دیگر CRM ندارد (مستقل اجرا می\u200cشود)

## محدودیت\u200cهای تست

- **mock ها ساده شده\u200cاند**: تنها منطق‌های پایه شبیه\u200cسازی شده؛ رفتار واقعی در مرورگر ممکن است edge case\u200cهای بیشتری داشته باشد (به\u200cخصوص رندر DOM و پرینتر).
- **V2 server sync تنها network path است که آزمایش نشد** (TODO در انتهای `unofficialInvoicePrintCases`).
- **تست تکی روی VM نه روی مرورگر واقعی** — برای تأیید نهایی، یک تست دستی در CRM واقعی با پروندهٔ واقعی توصیه می\u200cشود.

---

## گام بعد: ۵ (مستندسازی)

طبق برنامهٔ تأییدشده، گام ۵ شامل افزودن بند کوتاه به `financial-user-guide.html` با عنوان «صورتحساب پرداخت غیررسمی در پرونده» است. این گام اختیاری ولی برای پذیرش کاربر نهایی مهم است.
