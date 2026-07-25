# Release Notes — v31.7.68

**تاریخ:** ۱۴۰۵/۰۴/۳۰ (2026-07-21)  
**نسخه:** `v31.7.68`  
**نوع:** BUG-AUTH-MOBILE-USER-001 — رفع ورود کاربر موجود از موبایل

---

## هدف ریلیز

کار توسعه ابزارهای پیشرفته طبق دستور کارفرما متوقف شد و یک باگ فوری ورود کاربران بررسی و اصلاح شد: کاربری که روی دسکتاپ می‌توانست وارد CRM شود، روی موبایل پیام زیر می‌گرفت:

```text
کاربری با این نام نه در مرورگر نه سرور یافت نشد
```

---

## RCA / دلیل دقیق

دو علت هم‌زمان وجود داشت:

### 1) منبع کاربران سمت سرور split/stale بود

در `api/crm.php` مسیرهای `auth_login` و `users_get` از اولین منبع non-empty استفاده می‌کردند:

```text
users
یا crm_users
یا sync/ptf_crm_users.json
```

اگر یک منبع قدیمی یا ناقص وجود داشت ولی کاربر در منبع دیگر بود، کاربر روی موبایل پیدا نمی‌شد.

### 2) کلاینت قبل از user-not-found مستقیم auth_login را امتحان نمی‌کرد

در مرورگر تازه موبایل، localStorage خالی است. `doLogin()` ابتدا `users_get` را می‌گرفت و فقط اگر کاربر در همان لیست دیده می‌شد، `auth_login` را صدا می‌زد. اگر `users_get` کاربر را به‌دلیل stale/split بودن منابع نشان نمی‌داد، پیام user-not-found نمایش داده می‌شد؛ حتی اگر `auth_login` مستقیم می‌توانست کاربر را authenticate کند.

---

## اصلاحات انجام‌شده

### 1) Merge همه منابع کاربران در سرور

در `api/crm.php` تابع جدید اضافه شد:

```php
load_all_crm_users_sources()
```

این تابع کاربران را از همه منابع زیر merge می‌کند:

```text
crm/data/users.json
crm/data/crm_users.json
crm/data/sync/ptf_crm_users.json
```

و هنگام merge، اگر یک رکورد safe/stale بدون `passhash` باشد ولی منبع دیگر passhash داشته باشد، passhash حفظ می‌شود.

---

### 2) `auth_login` از منبع merged استفاده می‌کند

قبلاً ممکن بود `auth_login` کاربر را به‌دلیل توقف روی اولین منبع non-empty پیدا نکند. اکنون از `load_all_crm_users_sources()` استفاده می‌کند.

---

### 3) `users_get` از منبع merged استفاده می‌کند

`users_get` همچنان safe است و passhash برنمی‌گرداند، اما فهرست کاربران را از همه منابع merged می‌سازد.

---

### 4) `users_sync` برای بازیابی هش از همه منابع کمک می‌گیرد

برای جلوگیری از حذف کاربران بی‌هش/safe، `users_sync` اکنون برای بازیابی passhash موجود از همه منابع server-side کمک می‌گیرد.

---

### 5) fallback مستقیم `auth_login` در کلاینت موبایل

در `crm/index.html` اگر کاربر در `users_get` دیده نشود، کلاینت قبل از نمایش user-not-found، مستقیم این مسیر را امتحان می‌کند:

```text
api/crm.php?action=auth_login
```

اگر موفق شود:

```text
session ساخته می‌شود
token ذخیره می‌شود
کاربر در localStorage موبایل seed می‌شود
CRM باز می‌شود
```

---

## فایل‌های تغییر یافته

```text
api/crm.php
crm/index.html
crm/sw.js
crm/clear-cache.html
PTF-MASTER-HANDOVER.md
_tools/uat/tester15-sprint78.js
_tools/uat/tester189-users-vanish.js
_tools/uat/tester227-storage-quota-foundation.js
_tools/uat/tester245-mobile-login-user-merge.js
RELEASE-NOTES-v31.7.68.md
REGRESSION-REPORT-v31.7.68.md
```

---

## تست اضافه‌شده

```text
_tools/uat/tester245-mobile-login-user-merge.js
```

پوشش:

- وجود `load_all_crm_users_sources()`.
- merge منابع `users`, `crm_users`, `sync/ptf_crm_users.json`.
- حفظ passhash هنگام merge با رکورد safe/stale.
- استفاده `auth_login` از منبع merged.
- استفاده `users_get` از منبع merged بدون افشای passhash.
- استفاده `users_sync` از منبع merged برای بازیابی passhash.
- fallback مستقیم `auth_login` در `doLogin()` وقتی `users_get` کاربر را نشان نمی‌دهد.
- حذف پیام خطای قدیمی قبل از احراز هویت مستقیم.

نتیجه مستقیم:

```text
tester245-mobile-login-user-merge: 11 PASS / 0 FAIL
```

---

## تست‌های محافظ مرتبط

```text
tester15-sprint78: 17 PASS / 0 FAIL
tester184-auth-contract-e2e: 7 PASS / 0 FAIL
tester189-users-vanish: 10 PASS / 0 FAIL
tester200-sms-auth-token: 12 PASS / 0 FAIL
tester245-mobile-login-user-merge: 11 PASS / 0 FAIL
```

---

## Impact Analysis

| بخش | اثر | ریسک |
|---|---|---|
| Login موبایل | false user-not-found کاهش یافت | مثبت |
| auth_login | منابع کاربران merge می‌شوند | متوسط/کنترل‌شده |
| users_get | فهرست safe کامل‌تر می‌شود | مثبت |
| users_sync | passhash از همه منابع قابل بازیابی است | مثبت |
| Security | passhash همچنان در users_get برنمی‌گردد | کم |
| Advanced tools | تغییری ندارد | صفر |

---

## محدودیت تست PHP

در sandbox فعلی `php` نصب نیست، بنابراین E2E واقعی PHP و `php -l` اجرا نشد. پس از deploy روی هاست اجرا شود:

```bash
php -l api/crm.php
```

---

## راستی‌آزمایی کارفرما

1. نسخه v31.7.68 را deploy کنید.
2. روی موبایل صفحه CRM را hard refresh یا clear cache کنید.
3. با همان username/password کاربر وارد شوید.
4. اگر کاربر در یکی از منابع سرور وجود داشته باشد، نباید پیام user-not-found قدیمی دیده شود.
5. اگر باز هم ورود انجام نشد، از دسکتاپ/admin یک‌بار `usersSyncToServer` یا ذخیره/همگام‌سازی کاربران را اجرا کنید تا کاربری که فقط محلی بوده به سرور منتقل شود.

---

## نتیجه

مسیر ورود موبایل دیگر فقط به خروجی `users_get` وابسته نیست و سرور نیز کاربران را از همه منابع موجود merge می‌کند. این باگ فوری بدون ادامه کار روی ابزارها اصلاح شد.
