# گزارش بازنویسی عمیق صفحات برند پرریسک — فاز ۱
**تاریخ:** ۲۰۲۶-۰۸-۰۵  
**دامنه:** صفحات برندمحور سایت عمومی؛ بدون تغییر در `crm/` و `api/`

## دلیل اجرا
گزارش کیفیت محتوا نشان داد چند صفحه برندمحور نزدیک به حداقل ۱۵۰۰ کلمه و دارای پاراگراف‌های تکراری بودند. در این فاز به‌جای تولید صفحه جدید، چهار صفحه پرریسک اول بازنویسی شدند.

## صفحات بازنویسی‌شده
| صفحه | اقدام |
|---|---|
| `brands/galperti-flanges.html` | افزودن تحلیل عمیق فلنج، Facing، Bore، Orifice Flange، MTC، PMI و ریسک Vendor List |
| `brands/siemens-industrial.html` | افزودن تحلیل MLFB، Firmware، TIA Portal، SINAMICS، HMI، Switchgear و Obsolescence |
| `brands/flexitallic-gaskets.html` | افزودن تحلیل Style، Filler، Thermiculite، Kammprofile، RTJ، Bolt Load و Batch Traceability |
| `brands/tenaris-pipes.html` | افزودن تحلیل OCTG در برابر Line Pipe، PSL، Sour Service، Coating، Traceability و حمل |

## نتیجه ممیزی کیفیت بعد از بازنویسی
- `UNDER_1500_CRITICAL`: صفر
- `REPEATED_PARAGRAPH_INSIDE`: از ۵۴ به ۵۱ کاهش یافت
- چهار صفحه بازنویسی‌شده از صدر اولویت‌های اصلاح خارج شدند

## نکته مهم
این فاز همه مشکلات کیفیت محتوا را حل نکرد؛ فقط اولین بسته اصلاح کیفی بود. فازهای بعدی باید به ترتیب گزارش کیفیت ادامه پیدا کنند.

## اعتبارسنجی فنی
- `sitemap.xml` بازسازی شد و ۶۱۶ URL عمومی دارد.
- `python3 _tools/audit.py` اجرا شد.
- تنها خطای باقی‌مانده خارج از حوزه سئو است: `release-docs: window.VER در crm/index.html پیدا نشد`.

طبق دستور، CRM تغییر داده نشد.
