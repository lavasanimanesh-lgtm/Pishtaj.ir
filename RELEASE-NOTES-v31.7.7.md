# Release Notes — v31.7.7

**تاریخ:** ۱۴۰۵/۰۴/۲۸ (2026-07-19)  
**نسخه:** v31.7.7  
**نوع:** 🔴 Hotfix بحرانی (Production Recovery)

---

## 🚨 مسئله

پس از اعمال تغییرات امنیتی v31.7.4 (BUG-AUDIT-003)، سیستم دچار اختلال کامل شد:

1. **تمام endpointهای CRM به‌جز اکشن‌های عمومی با 401 Unauthorized مواجه می‌شدند**
2. **ورود کاربران عادی غیرممکن بود** (users_get بدون توکن 401 می‌گرفت)
3. **ادمین پس از ورود، داده‌ها را خالی می‌دید** (sync.js نمی‌توانست data_pull کند)
4. **صدها خطای 401 متوالی در console مرورگر** (data_pull, get_events, get_inbox)

## 🔍 علت ریشه‌ای (RCA)

### BUG-AUTH-001: ناسازگاری verify_request() با JWT

تابع `verify_request()` در v31.7.4 به مکانیزم HMAC مبتنی بر IP تغییر کرد:
```php
$expected = hash_hmac('sha256', $_SERVER['REMOTE_ADDR'], load_ptf_secret('hmac_key', ...));
if ($token !== $expected) { /* 401 */ }
```

ولی فرانت‌اند (sync.js و auth.php) توکن JWT (base64, per-user, انقضا‌دار) تولید و ارسال می‌کرد. **این دو مکانیزم ناسازگار بودند** — نتیجه: ۱۰۰٪ درخواست‌های احراز‌شده 401 می‌گرفتند.

### BUG-AUTH-002: users_get بدون توکن

`users_get` در لیست `public_actions` نبود، ولی در زمان ورود کاربر هنوز توکنی وجود ندارد → 401 → عدم دریافت لیست کاربران سرور → عدم ورود.

### BUG-AUTH-003: bridge.js بدون توکن

تابع `api()`, `pollEvents()`, `syncServerInbox()` در bridge.js هدر `X-CRM-Token` ارسال نمی‌کردند.

### BUG-AUTH-004: بازنویسی settings

تابع `saveSet()` در index.html تنظیمات را با آبجکت جدید جایگزین می‌کرد — `adminHash` از بین می‌رفت → ادمین بعد از تغییر تنظیمات قفل می‌شد.

### BUG-AUTH-005: ورود کاربر عادی بدون passhash

`users_get` (اصلاح v31.7.4 BUG-AUDIT-004) فیلد `passhash` را برنمی‌گرداند. ولی فرانت‌اند `doLogin()` انتظار `srvUser.passhash` را داشت → همیشه false → پیام «باید دوباره تعریف شود».

### BUG-AUTH-006: auth_login از sync directory نمی‌خواند

کاربرانی که فقط از طریق sync (`data_push`) همگام شده‌اند در `crm/data/sync/ptf_crm_users.json` ذخیره می‌شوند. `auth_login` فقط `crm/data/crm_users.json` را می‌خواند → کاربران sync‌شده پیدا نمی‌شوند.

---

## ✅ اصلاحات انجام‌شده

| # | فایل | تغییر | شدت |
|---|------|--------|-----|
| 1 | `api/crm.php` | `verify_request()` به JWT بازگشت + `users_get`/`sms_status`/`data_rev` به public | 🔴 P0 |
| 2 | `api/crm.php` | `auth_login` از sync directory هم کاربران را می‌خواند | 🔴 P0 |
| 3 | `api/crm.php` | `users_get` از sync directory هم کاربران را می‌خواند | 🔴 P0 |
| 4 | `crm/bridge.js` | تابع `api()` توکن JWT ارسال می‌کند | 🔴 P0 |
| 5 | `crm/bridge.js` | `pollEvents()` توکن JWT ارسال می‌کند | 🔴 P0 |
| 6 | `crm/bridge.js` | `syncServerInbox()` توکن JWT ارسال می‌کند | 🔴 P0 |
| 7 | `crm/index.html` | `saveSet()` تنظیمات را merge می‌کند نه overwrite | 🟡 P1 |
| 8 | `crm/index.html` | لاگین کاربر عادی از `auth_login` سرور استفاده می‌کند (چون `users_get` بدون passhash) | 🔴 P0 |
| 9 | `crm/index.html` | bump نسخه به v31.7.7 (71 cache-bust) | — |
| 10 | `crm/sw.js` | CACHE → `ptf-crm-v31.7.7` | — |

---

## 📁 فایل‌های تغییر‌یافته

### Backend (PHP)
- `api/crm.php` — verify_request() JWT-compatible + public_actions expanded + auth_login/users_get sync directory fallback

### Frontend (JavaScript)
- `crm/bridge.js` — api(), pollEvents(), syncServerInbox() token injection
- `crm/index.html` — saveSet() merge, server-side auth_login for user login, version bump to v31.7.7
- `crm/sw.js` — cache name to ptf-crm-v31.7.7

---

## ⚠️ Impact Analysis

| بخش | تأثیر | ریسک |
|------|--------|------|
| ورود ادمین | بدون تغییر — قبلاً کار می‌کرد | صفر |
| ورود کاربران عادی | ✅ رفع شد — users_get بدون توکن قابل دسترس | صفر |
| نمایش داده‌ها (ادمین) | ✅ رفع شد — data_pull با JWT کار می‌کند | صفر |
| خطاهای 401 | ✅ رفع شد — توکن معتبر JWT پذیرفته می‌شود | صفر |
| امنیت | بهبود — JWT per-user با انقضا ۷ روزه | مثبت |
| داده‌ها | دست‌نخورده — هیچ migration یا حذفی | صفر |
| مالی | دست‌نخورده — FIN-WF-001 تا FIN-WF-016 | صفر |
| سینک | دست‌نخورده — role-scoped sync | صفر |

---

## 🔒 ملاحظات امنیتی

1. **`users_get` عمومی شد:** این endpoint از v31.7.4 فقط فیلدهای امن (`username`, `name`, `nameEn`, `roleId`, `mobile`, `email`) را برمی‌گرداند. فیلد `passhash` هرگز ارسال نمی‌شود.

2. **`data_rev` عمومی شد:** فقط شماره revision سرور را برمی‌گرداند (عدد صحیح) — بدون داده.

3. **JWT انقضا ۷ روزه:** توکن‌ها بعد از ۷ روز منقضی می‌شوند و کاربر باید دوباره وارد شود.

4. **HMAC استاتیک حذف شد:** مکانیزم `hash_hmac('sha256', IP, secret)` ناسازگار بود و هیچ‌گاه توسط فرانت‌اند تولید نمی‌شد.

---

## 📋 مراحل استقرار

1. **بک‌آپ:** از فایل‌های فعلی `api/crm.php`, `crm/bridge.js`, `crm/index.html`, `crm/sw.js` بک‌آپ بگیرید
2. **آپلود:** فایل‌های تغییر‌یافته را extract-overwrite کنید (حذف پوشه ممنوع)
3. **پاکسازی کش:** کاربران `Ctrl+Shift+Delete` یا دکمه «🔄 رفع مشکل ورود» بزنند
4. **تست:** طبق چک‌لیست تست سریع زیر

---

*توسعه‌دهنده: PTF Development Team*  
*تاریخ: 2026-07-19*
