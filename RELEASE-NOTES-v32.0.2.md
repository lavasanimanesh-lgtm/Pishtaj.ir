# 🚀 Release Notes v32.0.2 — HOTFIX — Captcha Guard Fix

**نوع:** Patch Release — هات‌فیکس فوری برای باگ `captcha_key missing`
**مبنا:** v32.0.1 (HOTFIX SECURITY)
**نسخه:** v32.0.2
**وضعیت:** فوری — رفع رگرسیون ناشی از US-440
**حجم:** ZIP کامل 25M

## باگ گزارش شده (اسکرین‌شات شما)

پیام نارنجی: `Server misconfigured: captcha_key missing: همگام‌سازی کاربران با سرور ناموفق`

**رابطه:** پس از نصب v32.0.1، تمام درخواست‌های `data_pull`, `data_push`, `auth_login` با 500 خطا مواجه می‌شدند چون `captcha_key` در `crm.php:99` به صورت unconditional چک می‌شد، حتی برای actionهایی که به captcha نیازی ندارند (مثل همگام‌سازی).

## RCA

- در v32.0.1 US-440 ما `load_ptf_secret('captcha_key','')` + `if(empty) { 500 }` را در سطح بالای فایل گذاشتیم تا fail-closed باشد.
- اما `captcha_key` فقط برای `captcha_new`, `add_rfq_site`, `add_supplier`, `otp_token_make` لازم است، نه برای `data_pull/push/auth_login/users_get`.
- در نتیجه، سرور بدون `ptf-secrets.php` حتی login هم نمی‌کرد.

## رفع v32.0.2

- حذف چک unconditional در خط 99 — جایگزین با کامنت `// v32.0.2 fix: only enforce when needed`
- اضافه شدن چک fail-closed فقط داخل توابعی که واقعاً captcha/otp استفاده می‌کنند:
  - `captcha_token()` → 500 اگر secret missing (چون تولید captcha بدون secret ناامن است)
  - `captcha_ok()` → return false + error_log (بجای 500 برای کل request)
  - `otp_token_make()` → 500
  - `otp_token_ok()` → false
- `data_pull`, `data_push`, `auth_login`, `users_get`, `data_rev`, `track` اکنون بدون `captcha_key` هم کار می‌کنند (همگام‌سازی موفق)

## عمداً تغییر نکرده

- 6 فیکس امنیتی P0 از v32.0.1 دست‌نخورده (role spoof, token header only, hashed storage, XSS guard, codegen flock)
- 16 آیکون یکتای مرکز دانش دست‌نخورده
- 48 کلید sync دست‌نخورده

## UAT فوری v32.0.2 (2 دقیقه)

1. بدون `ptf-secrets.php` → باز کردن CRM → ورود admin → `data_pull` باید 200 (قبل 500)
2. با `ptf-secrets.php` کامل → `?action=captcha_new` → 200 و token برمی‌گردد
3. بدون secret → `?action=captcha_new` → 500 `captcha_key missing — cannot generate captcha` (fail-closed درست)
4. همگام‌سازی باید بدون پیام نارنجی کار کند

## Rollback

ZIP v32.0.1 را بازگردانید — اما v32.0.1 همان باگ را دارد، پس توصیه Rollback به v32 (25M) است.

## فایل‌های تغییرکرده

```
api/crm.php (US-440-fix — captcha_key guard moved to functions only)
RELEASE-NOTES-v32.0.2.md (این فایل)
REGRESSION-REPORT-v32.0.2.md
FILES-CHANGED-v32.0.2.txt
crm/index.html (VER v32.0.1 → v32.0.2)
crm/sw.js (CACHE v32.0.1 → v32.0.2)
```

## نسخه بعدی

- v32.0.3 → US-444..448 (Stability)
