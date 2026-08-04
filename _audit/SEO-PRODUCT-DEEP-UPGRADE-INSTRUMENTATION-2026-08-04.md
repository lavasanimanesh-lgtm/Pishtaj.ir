# گزارش ارتقای عمیق بسته ابزار دقیق
**تاریخ:** ۲۰۲۶-۰۸-۰۴  
**دامنه:** سایت عمومی؛ بدون تغییر در `crm/` و `api/`

## هدف
ادامه اجرای پروتکل جدید محتوا برای صفحات محصول: هر صفحه باید برای کاربر واقعی، بهره‌بردار، تیم نگهداری، مهندس ابزار دقیق و کارشناس خرید قابل استفاده باشد. در این بسته، ۵ صفحه ابزار دقیق با تصویر واقع‌گرایانه تک‌محصولی کم‌حجم و محتوای فنی عمیق‌تر ارتقا یافتند.

## صفحات ارتقایافته

| صفحه | تصویر جدید | حجم تصویر | تعداد کلمه تقریبی بعد از ارتقا |
|---|---|---:|---:|
| `services/products/differential-pressure-transmitter.html` | `assets/images/products/generated/dp-transmitter-manifold-realistic.jpg` | حدود 31KB | ۱۹۸۴ |
| `services/products/magnetic-flowmeter.html` | `assets/images/products/generated/magnetic-flowmeter-flanged-realistic.jpg` | حدود 32KB | ۱۹۲۵ |
| `services/products/coriolis-flowmeter.html` | `assets/images/products/generated/coriolis-flowmeter-realistic.jpg` | حدود 27KB | ۱۹۲۹ |
| `services/products/vortex-flowmeter.html` | `assets/images/products/generated/vortex-flowmeter-realistic.jpg` | حدود 29KB | ۱۸۹۹ |
| `services/products/radar-level-transmitter.html` | `assets/images/products/generated/radar-level-transmitter-realistic.jpg` | حدود 21KB | ۱۹۲۸ |

## نکته درباره تصاویر
تصاویر ابتدا به‌صورت واقع‌گرایانه و تک‌محصولی تولید شدند، سپس به JPG با ابعاد و کیفیت بهینه تبدیل شدند تا حجم تا حد ممکن پایین بماند. هیچ‌کدام لوگو، متن خوانا یا واترمارک ندارند و به برند خاصی نسبت داده نشده‌اند.

## ارتقای محتوایی انجام‌شده

### DP Transmitter
- تفکیک کاربردهای دبی، سطح و فیلتر
- اهمیت Static Pressure، Range و کاربرد واقعی
- نقش 3-Valve و 5-Valve Manifold در کالیبراسیون و نگهداری
- مقایسه برندها بر اساس Stability، Turndown، Ex، Diagnostics و Manifold

### Magnetic Flowmeter
- توضیح شرط رسانایی و پر بودن کامل لوله
- انتخاب Liner و Electrode بر اساس خوردگی و سایش
- اهمیت Grounding Ring در لوله غیرفلزی یا lined pipe
- مقایسه برندها بر اساس Empty Pipe Detection، Diagnostics و پروتکل‌ها

### Coriolis Flowmeter
- تمرکز روی Mass Flow، Density و Batch
- خطاهای انتخاب سایز بر اساس Line Size به‌جای Mass Flow
- اثر ویسکوزیته، افت فشار، حباب و جریان دو فازی
- معیارهای مقایسه برند بر اساس Tube Material، Diagnostics و Calibration

### Vortex Flowmeter
- تمرکز روی بخار، گاز و Utility
- اهمیت Reynolds و دبی حداقل
- نیاز به جبران فشار/دما در بخار و گاز
- اثر طول مستقیم و نصب در نزدیکی زانویی یا Control Valve

### Radar Level Transmitter
- تمرکز روی واقعیت مخزن: نازل، Foam، بخار، مانع داخلی، Dielectric
- تفاوت Non-contact Radar و Guided Wave Radar
- انتخاب فرکانس و آنتن بر اساس Beam Angle و Dead Zone
- معیارهای برند بر اساس False Echo Mapping، SIL، Ex و Overfill Protection

## اعتبارسنجی
- لینک شکسته عمومی: ۰
- JSON-LD parse error: ۰
- sitemap sync: سالم، ۵۴۸ URL
- هشدار تصویر سنگین: ندارد
- اجرای `python3 _tools/audit.py`: فقط خطای خارج از حوزه سئو باقی است: `window.VER` در `crm/index.html` پیدا نشد.

## ابزار اضافه‌شده
`_tools/deep_upgrade_instrumentation_batch.py`

## گام بعدی پیشنهادی
ادامه همین مدل برای بسته برق صنعتی:
1. LV/MV Switchgear
2. VFD & Soft Starter
3. Industrial Circuit Breakers
4. Power Transformer

یا بسته پایپینگ:
1. Seamless Pipe
2. Welding Flanges
3. Butt Weld Fittings
4. Industrial Gaskets
