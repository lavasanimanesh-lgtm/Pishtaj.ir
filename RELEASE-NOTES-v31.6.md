# ریلیزنوت v31.6 — گردش کار فاکتور سپیدار vs مودیان (US-437)

## درخواست
- برخی مشتریان اول فاکتور سپیدار می‌خواهند، بعد از تایید در مودیان رد نشود
- برخی مستقیم مودیان می‌خواهند

## فیکس
| فایل | تغییر |
|---|---|
| crm/salesfiles.js | sfInvoiceRefCommit: پارامتر invoiceType + دیالوگ انتخاب نوع فاکتور درخواستی مشتری (1=سپیدار اول، 2=مستقیم مودیان) + ذخیره در invRef.invoiceType |
| crm/rbac.js | saveInv: خواندن invoiceType از offer.invRef + فیلدهای sepidarStatus و modianStatus + نمایش در پرونده |
| crm/index.html | VER v31.6 |
| crm/sw.js | CACHE v31.6 |

## تست
1. پرونده فروش با تحویل کارفرما → ارجاع فاکتور به حسابدار → باید دیالوگ نوع فاکتور بیاید: 1 یا 2
2. اگر 1 (سپیدار اول) بزنی → در offer.invRef.invoiceType=sepidar_first
3. حسابدار فاکتور ثبت کند → باید sepidarStatus=waiting_approval، modianStatus=waiting_sepidar
4. اگر 2 (مستقیم مودیان) → modianStatus=pending

## نسخه
- VER v31.6
