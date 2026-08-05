# 🔒 ارزیابی امنیتی CRM پیشتاج — از دید هکر نیمه‌حرفه‌ای
### تاریخ: ۱۵ مرداد ۱۴۰۵ | نسخه: v34.1.0

---

## نتیجه‌گیری کلی

> **آیا نفوذ توسط هکر نیمه‌حرفه‌ای ممکن است؟**
>
> **خیر** — در حالت فعلی (با فرض راه‌اندازی صحیح `ptf-secrets.php`) نفوذ مستقیم **بسیار دشوار** است. لایه‌های امنیتی اصلی (JWT + HMAC، rate-limit، HTTPS، XSS-escape) به‌درستی پیاده‌سازی شده‌اند. ولی **۳ نقطه ضعف متوسط** وجود دارد که یک هکر باتجربه‌تر می‌تواند از آنها سوءاستفاده کند.

---

## ✅ نقاط قوت امنیتی (چیزهایی که درست انجام شده)

### ۱. احراز هویت سرور-محور (JWT + HMAC)
```
✅ توکن HMAC-SHA256 با nonce تصادفی 16 بایتی
✅ انقضای ۷ روزه + ذخیره سمت سرور (tokens.json)
✅ تأیید دوطرفه: signature + وجود در فایل سرور
✅ نقش کاربر از توکن سرور خوانده می‌شود (server-authoritative)
```

### ۲. محافظت در برابر XSS
```
✅ escP() برای HTML-escape
✅ ptfOnClickArg() برای JS-escape در هندلرهای inline (SEC-01)
✅ ۳۲۵+ هندلر onclick از ptfOnClickArg استفاده می‌کنند
```

### ۳. محافظت سرور
```
✅ HTTPS اجباری (301 redirect + HSTS)
✅ X-Content-Type-Options: nosniff
✅ X-Frame-Options: SAMEORIGIN (ضد clickjacking)
✅ Referrer-Policy: strict-origin-when-cross-origin
✅ Permissions-Policy: camera=(), microphone=(), geolocation=()
✅ Options -Indexes (فهرست دایرکتوری غیرفعال)
✅ فایل‌های .json/.log/.zip/.sql/.md از دسترسی مستقیم مسدود
```

### ۴. محافظت API
```
✅ Rate-limit سروری (IP+action — ساعتی 10-60 درخواست)
✅ CAPTCHA ریاضی + HMAC انقضادار برای فرم‌های عمومی
✅ حداکثر حجم POST: 20MB
✅ اکشن‌های حساس (delete_batch/purge_cloud/update_role) نیاز به HMAC اضافی دارند
✅ users_get: بدون توکن → فقط نام/نقش (بدون mobile/email/passhash)
```

### ۵. ذخیره‌سازی رمز
```
✅ SHA-256 هش (plaintext ذخیره نمی‌شود)
✅ کانفیگ حساس خارج از document root (ptf-secrets.php)
✅ secrets.php فقط از مسیرهای خارج webroot لود می‌کند
```

### ۶. قفل ورود
```
✅ ۵ تلاش ناموفق → ۶۰ ثانیه قفل
✅ ورود admin فقط از سرور (توکن سروری الزامی)
```

---

## 🟡 نقاط ضعف متوسط (قابل بهره‌برداری توسط هکر باتجربه)

### ⚠️ M1: هش ادمین در سورس کلاینت (ADMIN_HASH)

**مشکل:**
```javascript
// crm/index.html خط ۴۲۷
const ADMIN_HASH = 'f83b331362471ae55eeb42e54a2d46584dd9a1809dfc821fb2244c5b1b3ddabd';
```
هش SHA-256 رمز ادمین **در کد HTML قابل مشاهده** است. اگرچه ورود admin بدون توکن سرور ممکن نیست (v33.0.3)، ولی:
- هکر می‌تواند هش را در rainbow table یا hashcat بررسی کند
- اگر رمز ضعیف باشد (مثلاً `admin123`)، در ثانیه‌ها شکسته می‌شود
- حتی بدون شکستن، وجود هش → اطلاعات درباره سیستم احراز هویت

**ریسک:** 🟡 متوسط (ادمین بدون توکن سرور نمی‌تواند وارد شود)
**رفع:** حذف ADMIN_HASH از کلاینت — احراز هویت admin فقط سمت سرور

---

### ⚠️ M2: Content-Security-Policy (CSP) وجود ندارد

**مشکل:** هیچ هدر CSP تنظیم نشده. بدون CSP:
- اگر یک باگ XSS پیدا شود → هکر می‌تواند هر اسکریپت خارجی را اجرا کند
- `eval()` و inline scripts بدون محدودیت اجرا می‌شوند
- داده‌ها به سرور خارجی قابل ارسال هستند

**ریسک:** 🟡 متوسط (XSS-escape وجود دارد ولی CSP لایه دوم دفاعی است)
**رفع:** اضافه کردن CSP header:
```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://*.arvancloud.ir;
```

---

### ⚠️ M3: localStorage به‌عنوان پایگاه داده — بدون رمزنگاری

**مشکل:** تمام داده‌های CRM (مشتریان، پیشنهادها، مالی، چک‌ها) در `localStorage` مرورگر ذخیره شده‌اند:
```
ptf_crm_customers, ptf_crm_offers, ptf_crm_petty,
ptf_crm_cheques, ptf_crm_invoices, ptf_crm_deals, ...
```
- هر extension مرورگر می‌تواند localStorage را بخواند
- اگر کاربر لپ‌تاپش را باز بگذارد → DevTools → Application → localStorage
- XSS (اگر موفق شود) → دسترسی به تمام داده‌ها

**ریسک:** 🟡 متوسط (نیاز به دسترسی فیزیکی یا XSS موفق دارد)
**رفع فوری:** رمزنگاری AES-GCM داده‌ها قبل از ذخیره در localStorage
**رفع کامل:** مهاجرت به MySQL (طبق plan موجود)

---

## 🟢 نقاط ضعف کم‌اهمیت

### L1: Offline Login Fallback
```javascript
// اگر سرور در دسترس نباشد → localStorage hash مقایسه می‌شود
```
در حالت آفلاین، هش‌های ذخیره‌شده در localStorage برای ورود استفاده می‌شوند. هکر با دسترسی فیزیکی می‌تواند هش را تغییر دهد و وارد شود. ولی بدون سرور، هیچ داده جدیدی sync نمی‌شود.

### L2: SHA-256 بدون Salt
رمزها با SHA-256 خام هش می‌شوند (بدون salt یا bcrypt). برای رمزهای ضعیف، rainbow table attack ممکن است. ولی:
- رمزها فقط در localStorage (نه سرور عمومی) هستند
- ورود آنلاین از سرور توکن می‌خواهد

### L3: Service Worker Cache
فایل‌های JS کش‌شده در Service Worker قابل تغییر نیستند (integrity check ندارند). ولی نیاز به دسترسی فیزیکی یا Man-in-the-Middle دارد و HTTPS این را سخت می‌کند.

---

## 📊 ماتریس حمله — از دید هکر نیمه‌حرفه‌ای

| بردار حمله | ممکن؟ | علت |
|-----------|-------|------|
| **Brute Force ورود** | ❌ | قفل ۶۰ ثانیه‌ای + توکن سرور الزامی |
| **SQL Injection** | ❌ | MySQL هنوز primary نیست — localStorage |
| **XSS ذخیره‌شده** | ❌ | ptfOnClickArg + escP در ۳۲۵+ نقطه |
| **XSS بازتابی** | ❌ | ورودی‌ها HTML-escape می‌شوند |
| **CSRF** | ❌ | توکن JWT الزامی + Same-Origin |
| **Clickjacking** | ❌ | X-Frame-Options: SAMEORIGIN |
| **Directory Traversal** | ❌ | FilesMatch + Options -Indexes |
| **API بدون احراز هویت** | ❌ | فقط ۵ اکشن عمومی (rate-limited) |
| **Man-in-the-Middle** | ❌ | HTTPS اجباری + HSTS |
| **Rainbow Table (admin)** | 🟡 | هش در سورس ← ولی بدون توکن بی‌فایده |
| **دسترسی فیزیکی** | 🟡 | localStorage بدون رمزنگاری |
| **Extension مخرب** | 🟡 | localStorage قابل خواندن |
| **tokens.json مستقیم** | ❌ | .json از htaccess مسدود |

---

## 🎯 توصیه‌های اولویت‌بندی‌شده

| # | اقدام | اولویت | زمان |
|---|-------|--------|------|
| 1 | حذف ADMIN_HASH از سورس کلاینت | 🔴 بالا | ۳۰ دقیقه |
| 2 | اضافه کردن CSP header | 🟡 متوسط | ۱ ساعت |
| 3 | رمزنگاری localStorage (AES-GCM) | 🟡 متوسط | ۱ روز |
| 4 | bcrypt/scrypt به‌جای SHA-256 خام | 🟢 کم | ۴ ساعت |
| 5 | Subresource Integrity روی SW | 🟢 کم | ۲ ساعت |

---

## 📝 نتیجه نهایی

سیستم CRM پیشتاج از نظر امنیتی **بالاتر از متوسط** قرار دارد:

- **۶ لایه دفاعی اصلی** به‌درستی پیاده‌سازی شده
- **هیچ آسیب‌پذیری بحرانی (Critical/P0)** یافت نشد
- **۳ نقطه ضعف متوسط** وجود دارد که هیچ‌کدام به‌تنهایی منجر به نفوذ نمی‌شوند
- یک هکر نیمه‌حرفه‌ای با ابزارهای استاندارد (Burp Suite, SQLMap, XSS Hunter) **نمی‌تواند** به سیستم نفوذ کند
- یک هکر حرفه‌ای با دسترسی فیزیکی به دستگاه کاربر **فقط** می‌تواند داده‌های localStorage را بخواند — و این با رمزنگاری قابل رفع است
