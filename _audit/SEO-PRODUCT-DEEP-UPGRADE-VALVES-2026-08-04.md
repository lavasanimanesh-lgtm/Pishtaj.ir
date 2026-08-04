# گزارش ارتقای عمیق بسته شیرآلات و کنترل ولو
**تاریخ:** ۲۰۲۶-۰۸-۰۴  
**دامنه:** سایت عمومی؛ بدون تغییر در `crm/` و `api/`

## هدف
ادامه پروتکل جدید تولید محتوای محصول: محتوای هر صفحه باید برای کاربر واقعی، تیم بهره‌برداری، تعمیرات، مهندسی و خرید مفید باشد؛ نه فقط یک متن سفارش‌گیری. در این بسته، ۵ صفحه شیرآلات/کنترل ولو با تصویر واقع‌گرایانه تک‌محصولی و محتوای فنی عمیق‌تر ارتقا یافتند.

## صفحات ارتقایافته

| صفحه | تصویر جدید | تعداد کلمه تقریبی بعد از ارتقا |
|---|---|---:|
| `services/products/gate-valve.html` | `assets/images/products/generated/gate-valve-api600-realistic.jpg` | ۲۰۹۱ |
| `services/products/globe-valve.html` | `assets/images/products/generated/globe-valve-api623-realistic.jpg` | ۲۰۶۵ |
| `services/products/check-valve.html` | `assets/images/products/generated/check-valve-dual-plate-realistic.jpg` | ۲۰۳۷ |
| `services/products/butterfly-valve.html` | `assets/images/products/generated/butterfly-valve-triple-offset-realistic.jpg` | ۲۰۱۴ |
| `services/products/control-valve.html` | `assets/images/products/generated/control-valve-pneumatic-positioner-realistic.jpg` | ۲۰۳۴ |

## نوع ارتقای محتوایی

### Gate Valve
- تمرکز روی استفاده صحیح به‌عنوان ایزولاسیون کامل، نه Throttling
- تفاوت Solid Wedge و Flexible Wedge
- Bolted Bonnet در برابر Pressure Seal Bonnet
- نکات بازرسی Backseat، Stem، Face-to-Face و Gearbox
- مقایسه برندها بر اساس Wedge Type، Bonnet، Trim و مدارک تست

### Globe Valve
- توضیح کاربرد واقعی در افت فشار، جهت جریان و سرویس بخار
- تفاوت T Pattern، Y Pattern و Angle Pattern
- اهمیت Packing و Trim در دمای بالا
- ریسک Wire Drawing در استفاده تنظیمی مکرر
- معیارهای مقایسه برندها بر اساس Disc، Stem، Seat و تست نشتی

### Check Valve
- تمرکز روی Slam، Water Hammer و حداقل سرعت جریان
- مقایسه Swing، Dual Plate و Nozzle Check
- نکات نصب در خروجی پمپ
- نیاز به Curve افت فشار و حداقل Flow در سرویس‌های حساس
- کنترل Spring، Hinge Pin، Seat و نصب افقی/عمودی

### Butterfly Valve
- تفاوت کاربردی Concentric، Double Offset و Triple Offset
- ریسک استفاده از Rubber Lined در دما/سرویس نامناسب
- اهمیت Torque Data برای Gearbox و Actuator
- اثر هم‌محوری فلنج و نصب روی آب‌بندی
- بررسی API 609، Seat، Disc، Shaft و Fire Safe/NACE در پیشنهادها

### Control Valve
- تمرکز روی پایداری حلقه کنترل و Vendor Sizing Sheet
- بررسی Min/Normal/Max Flow و درصد بازشدگی
- Cavitation، Flashing، Noise و Choked Flow
- انتخاب Actuator، Positioner، Fail Action و پروتکل کنترلی
- مقایسه برندها بر اساس Trim Code، Leakage Class، Actuator و Ex/SIL

## تصاویر
تمام تصاویر این بسته به‌صورت واقع‌گرایانه و بدون لوگو/متن تولید شدند تا:
- ریسک کپی‌رایت نداشته باشند.
- به برند خاصی نسبت داده نشوند.
- شکل واقعی همان گروه محصول را نشان دهند.
- از تصاویر عمومی و نامرتبط قبلی بهتر باشند.

همه تصاویر پس از تولید به JPG بهینه تبدیل شدند و زیر حد هشدار audit قرار دارند.

## اعتبارسنجی
- لینک شکسته عمومی: ۰
- JSON-LD parse error: ۰
- sitemap sync: سالم، ۵۴۸ URL
- تصاویر سنگین: هشدار ندارد
- اجرای `python3 _tools/audit.py`: فقط خطای خارج از حوزه سئو باقی است: `window.VER` در `crm/index.html` پیدا نشد.

## ابزار اضافه‌شده
`_tools/deep_upgrade_valves_batch.py`

## گام بعدی پیشنهادی
ادامه همین مدل برای بسته ابزار دقیق تکمیلی:
1. DP Transmitter
2. Magnetic Flowmeter
3. Coriolis Flowmeter
4. Vortex Flowmeter
5. Radar Level Transmitter
