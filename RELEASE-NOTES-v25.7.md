# ریلیزنوت v25.7 — خوانایی سراسری حالت شب (Dark Mode Contrast Guard)

## باگ گزارش‌شده
در حالت شب، بخشی از متن‌ها در زمینه‌های تیره یا روشن خوانایی ناکافی داشتند. مسئله محدود به یک پنل نبود و در مودال‌ها، فرم‌ها، جدول‌ها، badgeها، کارت‌ها و خروجی‌های HTML پویا دیده می‌شد.

## Root Cause
- تم شب پیشین فقط چند selector و سه رنگ متن/سطح رایج را override می‌کرد.
- ماژول‌های CRM تعداد زیادی `style` inline با رنگ‌های hard-coded تولید می‌کنند؛ این عناصر از تم پایه ارث‌بری نمی‌کردند.
- رنگ‌های معنایی روشن (هشدار، خطا، موفقیت، اطلاع‌رسانی و وضعیت workflow) در زمینهٔ شب palette معادل و قابل‌خواندن نداشتند.

## اصلاح انجام‌شده
- فایل جدید `crm/theme-contrast.js` به‌عنوان آخرین لایهٔ UI اضافه شد.
- برای سطح‌ها، متن اصلی/ثانویه، مرزها، inputها، جدول‌ها، مودال‌ها، دکمه‌ها و status badgeهای پایه، توکن و CSS اختصاصی dark-mode تعریف شد.
- styleهای inline موجود و محتوای HTML که پس از render ساخته می‌شود، با `MutationObserver` و بدون polling شناخته و به کلاس‌های semantic سازگار با تم شب متصل می‌شوند.
- paletteهای جداگانهٔ info/success/warning/danger/purple/pink و actionها با نسبت contrast مناسب اضافه شد.
- کنترل‌های native form با `color-scheme: dark` و placeholderهای خوانا پوشش داده شدند.
- ابزار تشخیصی مرورگر `ptfThemeContrastAudit()` برای QA دستی اضافه شد؛ در dark mode فهرست موارد زیر 4.5:1 را برمی‌گرداند.
- فایل جدید به Service Worker shell اضافه و نسخهٔ CRM/cache به `v25.7` هماهنگ شد.

## فایل‌های تغییرکرده
- `crm/theme-contrast.js` — جدید: guard سراسری contrast و audit helper
- `crm/index.html` — بارگذاری guard و همگام‌سازی version query/`window.VER` به v25.7
- `crm/sw.js` — cache v25.7 و pre-cache فایل guard
- `_tools/uat/tester138-v257.js` — تست regression منبع و contrast palette
- `INSTALL-GUIDE.md` و `PTF-MASTER-HANDOVER.md` — مستندات نسخه و Handover

## نتایج تست
- Syntax تمام 64 اسکریپت production-loaded CRM با `node --check`: **PASS (0 failure)**
- `node _tools/uat/tester138-v257.js`: **21 PASS / 0 FAIL**
- نسبت contrast برای متن اصلی/ثانویه، info، success، warning، danger، purple، pink و actionهای حساس در تست منبع: **حداقل WCAG AA (4.5:1)**
- `python3 _tools/audit.py`: **بدون error**؛ فقط هشدار قدیمی تصاویر سنگین سایت باقی است.

## تست دستی کارفرما
1. در CRM به تنظیمات بروید و «حالت شب» را فعال کنید؛ سپس dashboard، فروش، تأمین، مالی و تنظیمات را باز کنید.
2. یک مودال دارای فرم باز کنید؛ label، input، select، textarea، placeholder، دکمهٔ اصلی و دکمهٔ خطی باید خوانا باشند.
3. جدول‌های مشتریان/پیشنهادها/درخواست‌ها را باز کنید؛ سرستون، سلول، hover و badgeهای وضعیت باید خوانا باشند.
4. در هر ماژول یک عملیات ایجاد/ویرایش را باز کنید تا HTML پویا رندر شود؛ کارت‌های اطلاع‌رسانی، موفقیت، هشدار و خطا را بررسی کنید.
5. حالت روز و سپس حالت خودکار را نیز امتحان کنید؛ ظاهر روشن و داده‌ها نباید تغییر کنند.
6. برای بررسی تکمیلی در console مرورگر، در dark mode اجرا کنید: `ptfThemeContrastAudit()`.

## نکته
این release فقط لایهٔ نمایش و cache نسخه را تغییر می‌دهد؛ به کلیدهای CRM، sync، دیتابیس محلی، داده‌های مالی یا APIها دست نزده است.
