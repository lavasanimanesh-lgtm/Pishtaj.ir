# 📲 راهنمای ساخت APK — US-334 (TWA/Bubblewrap)
**یک بار ساخت؛ آپدیت‌های CRM بدون نصب مجدد از سایت می‌آیند.**

## پیش‌نیاز (یک بار روی یک کامپیوتر — ویندوز/مک/لینوکس)
1. Node.js نسخه 18+ → nodejs.org
2. JDK 17 → adoptium.net
3. نصب Bubblewrap: `npm i -g @bubblewrap/cli`

## گام‌های ساخت
```bash
# 1) پوشه کاری
mkdir ptf-apk && cd ptf-apk
# کانفیگ آماده این مخزن را کنار خود بگذارید:
#   twa-manifest.json (از پوشه _tools/apk همین بسته)

# 2) مقداردهی (بار اول سوالاتی می‌پرسد — پیش‌فرض‌ها OK؛ JDK/SDK را خودش دانلود می‌کند)
bubblewrap init --manifest https://pishtaj.ir/crm/manifest.json
#   یا با کانفیگ آماده: فایل twa-manifest.json را در پوشه بگذارید و init را رد کنید

# 3) ساخت keystore (فقط بار اول — رمز را در جای امن نگه دارید!)
#    bubblewrap خودش موقع build می‌سازد اگر نباشد

# 4) ساخت APK
bubblewrap build
# خروجی: app-release-signed.apk  ← قابل نصب مستقیم روی هر اندروید
```

## اتصال دامنه (حذف نوار آدرس مرورگر در اپ)
1. اثر انگشت keystore را بگیرید:
   `keytool -list -v -keystore ptf-keystore.jks -alias ptfcrm | grep SHA256`
2. مقدار SHA256 (با دو نقطه‌ها) را در فایل `/.well-known/assetlinks.json` روی هاست جایگزین `REPLACE_AFTER_BUILD_WITH_KEYSTORE_FINGERPRINT` کنید.
   - فایل آماده در همین بسته هست: پوشه `.well-known/` را در ریشه public_html آپلود کنید.
3. تست: `https://pishtaj.ir/.well-known/assetlinks.json` باید در مرورگر JSON را نشان دهد.

## توزیع
- ارسال مستقیم APK به کاربران (نصب با «منابع ناشناس») ✅ ساده‌ترین
- انتشار در مایکت / کافه‌بازار (بدون نیاز به گوگل‌پلی) ✅
- آپدیت‌های CRM نیازی به APK جدید ندارند؛ APK جدید فقط وقتی لازم است که آیکون/نام/دامنه عوض شود.

## نکات
- `appVersionCode` را با هر build جدید +۱ کنید.
- keystore گم شود = امکان آپدیت همان اپ از بین می‌رود؛ از `ptf-keystore.jks` بک‌آپ بگیرید.
- اگر ساخت در سیستم شما مقدور نبود: محیط Node+JDK هر سیستمی کافی است (حتی لپ‌تاپ همکار فنی)؛ کل فرآیند ~۱۵ دقیقه.
