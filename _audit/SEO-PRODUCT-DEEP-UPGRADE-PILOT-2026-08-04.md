# گزارش اجرای آزمایشی ارتقای عمیق صفحات محصول
**تاریخ:** ۲۰۲۶-۰۸-۰۴  
**دامنه:** سایت عمومی؛ بدون تغییر در `crm/` و `api/`

## هدف
بر اساس بازخورد کارفرما، کیفیت صفحات محصول باید از حالت «صفحه تجاری عمومی» به «راهنمای جامع، دقیق، فنی و قابل استفاده برای خریدار و کاربر محصول» ارتقا پیدا کند. همچنین تصویر هر صفحه باید عکس واقعی/واقع‌گرایانه تک‌محصولی باشد.

## صفحات ارتقایافته در این اجرای آزمایشی

### ۱) Ball Valve
صفحه:
`services/products/ball-valve.html`

تصویر جدید:
`assets/images/products/generated/ball-valve-api6d-trunnion-realistic.jpg`

بهبود محتوایی:
- تفاوت کاربردی Floating و Trunnion
- Full Bore در خطوط Pigging
- Fire Safe، Anti-static و Blow-out Proof Stem
- انتخاب Seat بین PTFE، RPTFE، PEEK و Metal Seat
- مقایسه برندها از نگاه Model، کشور ساخت، Torque Data و Test Report

تعداد کلمه بعد از ارتقا: حدود ۲۱۵۳

### ۲) Pressure Transmitter
صفحه:
`services/products/pressure-transmitter.html`

تصویر جدید:
`assets/images/products/generated/pressure-transmitter-industrial-realistic.jpg`

بهبود محتوایی:
- انتخاب Range بر اساس Span واقعی، نه فقط فشار طراحی
- تفاوت Gauge، Absolute و DP در بهره‌برداری
- انتخاب Wetted Parts مثل SS316L، Hastelloy، Monel یا Tantalum
- نقش Manifold در نگهداری و کالیبراسیون
- مقایسه برندها از نگاه Accuracy، Stability، Turndown، Ex و Diagnostics

تعداد کلمه بعد از ارتقا: حدود ۱۹۷۷

### ۳) API 5L Pipe
صفحه:
`services/products/api-5l-pipe.html`

تصویر جدید:
`assets/images/products/generated/api-5l-line-pipe-realistic.jpg`

بهبود محتوایی:
- تفاوت واقعی PSL1 و PSL2
- اثر روش ساخت Seamless، ERW/HFW، LSAW و SSAW
- کنترل MTC، Heat Number، Hydro Test و NDT
- مدارک Coating مثل 3LPE/FBE، Holiday Test و Adhesion
- مقایسه سازندگان از نگاه Vendor List، MTC، Lead Time و بسته‌بندی Bevel

تعداد کلمه بعد از ارتقا: حدود ۱۹۸۵

## تصاویر
در این مرحله از تصاویر تولیدشده واقع‌گرایانه استفاده شد، نه عکس‌های کپی‌شده از اینترنت. دلیل:
- جلوگیری از ریسک کپی‌رایت
- امکان ساخت تصویر تک‌محصولی بدون لوگو و بدون ادعای وابستگی به برند خاص
- انطباق بهتر با ظاهر واقعی محصول و مشخصات صنعتی

## ابزار اضافه‌شده
`_tools/pilot_deep_product_upgrade.py`

## گام بعدی پیشنهادی
ادامه همین مدل برای بسته بعدی ۳ تا ۵ صفحه‌ای، با اولویت:
1. Gate Valve
2. Globe Valve
3. Check Valve
4. Butterfly Valve
5. Control Valve

برای لوگوهای برندها، در فاز بعد باید از منابع رسمی/اینترنتی معتبر بررسی و در صورت امکان مجاز اضافه شوند؛ اگر اطمینان حقوقی/منبع رسمی نبود، برند به صورت متنی نمایش داده شود.
