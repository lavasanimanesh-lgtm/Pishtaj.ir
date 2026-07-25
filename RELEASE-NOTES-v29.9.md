# ریلیزنوت v29.9 — مرج نوع‌دار تأمین (FIN-WF-005 / FW-C04)

## مشکل
- ptf_crm_supplier_finance آبجکت {invoices,payments,adjustments} است
- ptfSmartMerge قدیم فقط آرایه را مرج می‌کرد، برای آبجکت remote را overwrite می‌کرد → اگر کاربر A فاکتور و کاربر B همزمان پرداخت بزند، یکی گم می‌شود

## فیکس
| فایل | تغییر |
|---|---|
| crm/sync.js | افزودن شاخه خاص برای ptf_crm_supplier_finance: merge per-key (invoices/payments/adjustments) بر اساس cd و timestamp جدیدتر - هر دو فاکتور حفظ می‌شود |
| crm/index.html | VER v29.9 |
| crm/sw.js | CACHE v29.9 |

## تست فرضی مدیریتی
1. 2 مرورگر باز کن: buyer1 و commercial
2. هر دو همزمان به یک تأمین‌کننده فاکتور بزنند: یکی 100M یکی 200M بدون رفرش
3. 20 ثانیه صبر (sync) → رفرش هر دو → آیا هر دو فاکتور هست؟ قبلاً یکی گم می‌شد، الان هر دو هست
4. یکی پرداخت 50M بزند، دیگری همزمان پرداخت 70M → هر دو پرداخت بماند

## نسخه
- VER v29.9, CACHE ptf-crm-v29.9
