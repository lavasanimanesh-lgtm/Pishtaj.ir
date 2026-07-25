راهنمای آپلود و راه‌اندازی سایت شرکت پیشرو تجهیز فرتاک

دامنه: pishtaj.ir
ایمیل دریافت فرم: lavasani.manesh@gmail.com
رونوشت مخفی فرم: Info@pishrotajheez.ir

فایل‌های اصلی:
- index.html
- assets/css/style.css
- assets/js/main.js
- assets/images/...
- assets/fonts/...  فونت فارسی Vazirmatn به صورت محلی
- api/contact.php   پردازش فرم تماس در هاست PHP

روش آپلود در cPanel:
1) وارد cPanel شوید.
2) File Manager را باز کنید.
3) وارد public_html شوید.
4) محتوای داخل پوشه site را داخل public_html آپلود کنید.
   مهم: خود پوشه site را آپلود نکنید؛ فایل index.html باید مستقیم داخل public_html باشد.

ساختار صحیح:
public_html/index.html
public_html/assets/css/style.css
public_html/assets/js/main.js
public_html/assets/images/...
public_html/assets/fonts/...
public_html/api/contact.php

5) دامنه را باز کنید:
https://pishtaj.ir

تست فرم تماس:
1) یک درخواست تستی از فرم تماس سایت ارسال کنید.
2) اگر هاست تابع mail() را فعال کرده باشد، ایمیل به lavasani.manesh@gmail.com ارسال می‌شود و یک رونوشت مخفی به Info@pishrotajheez.ir می‌رود.
3) برای اطمینان، یک نسخه از درخواست‌ها در مسیر زیر ذخیره می‌شود:
public_html/api/logs/contacts.log
4) فایل‌های پیوست فرم در مسیر زیر ذخیره می‌شوند:
public_html/api/uploads/

نکات امنیتی فرم:
- فیلد Honeypot ضد اسپم دارد.
- فایل‌های پیوست فقط با فرمت‌های pdf, doc, docx, xls, xlsx, jpg, png, zip, rar پذیرفته می‌شوند.
- حداکثر حجم پیوست 10 مگابایت است.
- فایل .htaccess برای جلوگیری از نمایش لیست فایل‌ها اضافه شده است.

اگر ایمیل ارسال نشد:
- از پشتیبانی هاست بخواهید تابع PHP mail را فعال کند.
- بهتر است برای ارسال مطمئن، SMTP اختصاصی دامنه تنظیم شود. در صورت نیاز می‌توانیم نسخه SMTP با PHPMailer اضافه کنیم.

نکته درباره لوگوهای شرکت‌های ثالث:
در این نسخه برای جلوگیری از مشکل حقوقی و وابستگی به منابع بیرونی، نام برندها و شرکت‌ها به صورت تایپوگرافیک درج شده است. در صورت داشتن مجوز یا فایل لوگوی رسمی، می‌توان لوگوها را جایگزین کرد.
