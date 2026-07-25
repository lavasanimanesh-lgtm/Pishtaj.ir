# Advanced Control Valve — GTM, Feedback and Fair Sales Plan — v31.7.84

## هدف
جذب کاربر واقعی برای ابزار سایزینگ کنترل ولو، دریافت feedback مهندسی، و تبدیل تدریجی ابزار به جریان درآمدی منصفانه بدون فعال‌سازی عجولانه پرداخت آنلاین.

## وضعیت محصول
ابزار از نظر مسیر قابل گزارش‌دهی آماده است:

- ورود داده‌ها و محاسبات Liquid / Gas / Steam
- ثبت draft سروری
- CRM review
- final gate
- Engineering Validation Matrix
- Vendor Data Validation Matrix
- صدور گزارش نهایی HTML انگلیسی
- شماره گزارش و checksum
- quota handling
- staff/internal license رایگان

محدودیت‌های شفاف:

- خروجی هنوز vendor-certified final sizing نیست.
- PDF باینری سمت سرور هنوز فعال نیست؛ HTML نهایی با مرورگر Print / Save as PDF می‌شود.
- پرداخت آنلاین هنوز فعال نیست.

## پیشنهاد جذب کاربران

### فاز ۱ — اعتمادسازی
1. نمایش نمونه گزارش نهایی در صفحه ابزار بدون نیاز به لایسنس.
2. انتشار ۵ محتوای آموزشی SEO:
   - سایزینگ کنترل ولو چیست؟
   - تفاوت Cv و Kv
   - سایزینگ کنترل ولو بخار
   - سایزینگ کنترل ولو گاز
   - کاویتاسیون و نویز در کنترل ولو
3. دعوت از ۱۰ مهندس ابزار دقیق/فرآیند/پایپینگ برای تست رایگان با staff/reviewer license.
4. گرفتن feedback با فرم کوتاه:
   - آیا ورودی‌ها واضح‌اند؟
   - آیا Cv/Kv منطقی است؟
   - آیا warnings کمک‌کننده‌اند؟
   - آیا گزارش انگلیسی قابل ارائه است؟
   - چه چیزی برای خرید لازم است؟

### فاز ۲ — فروش دستی کنترل‌شده
1. فعال‌سازی دستی با فاکتور.
2. صدور لایسنس از CRM.
3. پشتیبانی واتساپ/ایمیل برای اولین کاربران.
4. بررسی هر گزارش نهایی توسط ادمین/مهندس مسئول قبل از ارسال.

### فاز ۳ — اتوماسیون بعد از feedback
1. PDF باینری سمت سرور.
2. پرداخت آنلاین.
3. صدور خودکار لایسنس بعد از پرداخت.
4. داشبورد فروش و usage analytics.

## پلن فروش منصفانه پیشنهادی
اعداد زیر شروع آزمایشی هستند و بعد از ۲۰ تا ۳۰ feedback واقعی باید اصلاح شوند.

| پلن | مخاطب | پیشنهاد قیمت اولیه | توضیح |
|---|---|---:|---|
| Free Preview | همه کاربران | رایگان | مشاهده فرم، نمونه گزارش، محتوای آموزشی و محاسبات پایه رایگان |
| First Feedback Report | ۱۰ تا ۲۰ کاربر اول | رایگان یا ۷۰٪ تخفیف | در ازای feedback دقیق و اجازه استفاده از نظر کاربر بدون نام پروژه |
| Single Final Report | مهندس/شرکت کوچک | ۲ تا ۳.۵ میلیون تومان | یک گزارش نهایی HTML انگلیسی با شماره گزارش و validation matrices |
| 5-Report Pack | شرکت‌های EPC/بازرگانی | ۸ تا ۱۲ میلیون تومان | قیمت هر گزارش کمتر، مناسب چند tag |
| Monthly Engineering Access | تیم مهندسی | ۱۲ تا ۲۰ میلیون تومان / ماه | سقف گزارش مشخص، پشتیبانی محدود، مناسب شرکت‌ها |
| Enterprise / Internal Deployment | سازمانی | توافقی | برندینگ، محدودیت IP/user، آموزش، SLA و امکانات اختصاصی |
| Staff/Internal | پرسنل PTF | رایگان | quota-exempt برای استفاده داخلی و کنترل کیفیت |

## سیاست منصفانه
- محاسبه پایه و آموزش رایگان باقی بماند.
- کاربر قبل از خرید، نمونه گزارش نهایی را ببیند.
- اگر داده کاربر ناقص باشد و گزارش قابل صدور نباشد، quota مصرف نشود.
- اگر final gate مسدود شد، گزارش فروخته‌شده محسوب نشود.
- در نسخه فعلی باید واضح نوشته شود: vendor-certified نیست مگر vendor sheet تایید شود.

## Datasheet Upload / Auto-fill Roadmap

### فاز ۱ — انجام‌شده در v31.7.84
- کاربر می‌تواند متن دیتاشیت یا فایل TXT/CSV/JSON را وارد کند.
- سیستم فیلدهای رایج مثل Tag, Service, Fluid, Flow, P1, P2, Temperature, SG, FL, Xt, Rated Cv, Brand, Series را استخراج و فرم را پر می‌کند.

### فاز ۲ — پیشنهاد بعدی
- PDF text extraction سمت سرور.
- استخراج جدول‌های vendor datasheet.
- mapping چند vendor معروف.

### فاز ۳ — پیشرفته
- OCR برای PDF اسکن‌شده یا عکس.
- LLM-assisted extraction با review انسانی.
- ذخیره templateهای vendor.
- مقایسه چند datasheet / چند valve با هم.

## KPIهای پیشنهادی
- تعداد بازدید صفحه ابزار کنترل ولو
- تعداد کلیک روی نمونه گزارش
- تعداد درخواست فعال‌سازی
- تعداد لایسنس صادرشده
- تعداد draft ثبت‌شده
- تعداد final report صادرشده
- تعداد feedback کامل دریافت‌شده
- نرخ تبدیل preview به request
- تعداد keywordهایی که در Google Search Console impression می‌گیرند

## اقدام ضروری خارج از کد
بعد از deploy، در Google Search Console این URLها request indexing شوند:

```text
https://pishtaj.ir/tools/
https://pishtaj.ir/tools/#control-valve-sizing-seo
```

در فاز بعدی بهتر است صفحه اختصاصی ساخته شود:

```text
https://pishtaj.ir/tools/control-valve-sizing/
```


## تکمیل اجرایی v31.7.86

فرم feedback واقعی در tools و landing page اضافه شد و feedbackها در CRM قابل review/contact/convert هستند.


## تکمیل اجرایی v31.7.87

اولین مقاله SEO پشتیبان منتشر شد. KPI پیشنهادی: impression/click این مقاله در Search Console و نرخ کلیک آن به `/tools/control-valve-sizing/`.


## تکمیل اجرایی v31.7.88

دومین مقاله SEO پشتیبان منتشر شد. KPI پیشنهادی: impression/click برای عبارت‌های «کاویتاسیون کنترل ولو»، «anti-cavitation trim» و نرخ کلیک به landing page.


## تکمیل اجرایی v31.7.89

سومین مقاله SEO پشتیبان منتشر شد. KPI پیشنهادی: impression/click برای عبارت‌های «تفاوت Cv و Kv»، «فرمول تبدیل Cv به Kv» و نرخ کلیک به landing page.


## تکمیل اجرایی v31.7.90

سه مقاله پشتیبان جدید برای کنترل ولو منتشر شد. KPI پیشنهادی: impression/click برای steam control valve sizing، gas control valve sizing و control valve actuator.


## تکمیل اجرایی v31.7.92

Privacy-aware metrics server sync اضافه شد. KPI قیف حالا علاوه بر feedback/draft/license، landing views، sample report opens و feedback opens/submits را به‌صورت aggregate نشان می‌دهد.


## تکمیل اجرایی v31.7.93

نمونه گزارش عمومی برای اعتمادسازی تقویت شد و حالا با chart و brand/model candidate matrix قابل نمایش است. KPI پیشنهادی: تغییر نرخ sample report open به feedback submit بعد از این اصلاح.


## تکمیل نگهداری v31.7.94

برای پایداری CRM و اعتماد کاربر داخلی، باگ تکرار اقلام پیشنهاد رفع شد و منوی Settings به accordion مرتب تبدیل شد.


## تکمیل نگهداری v31.7.95

برای حفظ اعتماد کاربران داخلی CRM، مغایرت گزارش رسمی مالی با حساب تأمین‌کنندگان و مشکلات خوانایی UI اصلاح شد.


## تکمیل نگهداری v31.7.96

پایداری sync حذف و شفافیت فرصت‌های بازنده اصلاح شد. نمونه/گزارش کنترل ولو به نمودارهای خطی نزدیک‌تر به خروجی‌های مهندسی مجهز شد.
