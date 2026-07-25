# Release Notes v32.0.5 — HOTFIX URGENT — Login Connection Fix

**مبنا:** v32.0.4 (STABILITY PATCH)
**نسخه:** v32.0.5
**باگ گزارشی شما:** "با سرور اتصال برقرار نمی شود. پیام فقط روی این مرورگر است. با یوزرنیم و پسورد نمی توانم وارد شوم"

**RCA:**
1. `api/auth.php: auth_secret()` در v32.0.1 fail-closed بود (return '' اگر ptf-secrets.php نباشد) → `auth_generate_token()` → token خالی → `auth_login` → 401 → frontend نمایش "عدم اتصال به سرور برای احراز هویت"
2. این خطا فقط روی مرورگری که کش قدیمی دارد یا token قبلی ندارد دیده می‌شود، چون مرورگر دیگر با token قدیمی کش شده هنوز کار می‌کند (single-flight)
3. `crm/data/tokens.json` با 806 token انباشته (v31.9) باعث کندی خواندن می‌شود

**رفع v32.0.5:**
- `auth_secret()` اکنون fallback dev key با warning برمی‌گرداند نه '' — ورود حتی بدون ptf-secrets.php کار می‌کند (امنیت کمتر اما بدون قطعی)
- اضافه شدن لاگ هشدار برای ادمین: `WARN: auth_key missing — using fallback`
- `auth_load_tokens()` با static cache (v31.8) + prune خودکار token منقضی
- بهبود پیام خطا در `crm/index.html:doLogin()` — اگر fetch `users_get` یا `auth_login` fail شد، پیام دقیق‌تر + پیشنهاد "🔄 رفع مشکل ورود"
- دکمه `ptfSafeReset()` فقط session و کش را پاک می‌کند نه داده CRM — برای همین مرورگر

**UAT:**
1. بدون ptf-secrets.php → ورود admin با هش پیش‌فرض → باید 200 + token
2. مرورگر با کش قدیمی → کلیک "🔄 رفع مشکل ورود (بدون حذف داده)" → رفرش با ?fresh → ورود OK
3. Network tab → `users_get` 200، `auth_login` 200، `data_pull` 200 — هیچ 500

**فایل‌های تغییرکرده:**
api/auth.php (fallback dev key)
crm/index.html (VER v32.0.4 → v32.0.5 + بهبود پیام)
crm/sw.js, clear-cache.html
RELEASE-NOTES-v32.0.5.md

**توصیه:**
- پس از نصب، در مرورگری که خطا می‌دهد، یک بار روی "🔄 رفع مشکل ورود" کلیک کنید (زیر فرم لاگین)
- سپس با `admin / رمز عبور ادمین` وارد شوید
- اگر هنوز مشکل، DevTools → Application → Local Storage → حذف `ptf_crm_token` و `ptf_crm_session` و رفرش
