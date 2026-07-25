# ریلیزنوت v31.6.3 — هات‌فیکس Production برای manifest و session token

## مشکل Production

پس از deploy `v31.6.2` دو خطا در مرورگر مشاهده شد:

1. `crm/manifest.json` با HTTP 403 برمی‌گشت.
2. `api/crm.php?action=data_pull` با HTTP 401 برمی‌گشت و sync به‌صورت تکراری retry می‌کرد.

## ریشهٔ فنی

### manifest

قانون root `.htaccess` همهٔ فایل‌های JSON را مسدود می‌کرد و استثنای `crm/manifest.json` نداشت.

### auth_login

در `api/crm.php`، action `auth_login` در جدول `$SENSITIVE` با scope برابر `none` تعریف شده بود، اما شرط token enforcement صرفاً وجود action در جدول را بررسی می‌کرد. در نتیجه login اولیه نیز token می‌خواست؛ در حالی که وظیفهٔ `auth_login` دقیقاً صدور token است.

## اصلاح

- در `.htaccess`، `manifest.json` از rule مسدودسازی JSON مستثنی شد.
- در `api/crm.php`، token برای actionهایی با scope `none` اجباری نیست؛ `auth_login` می‌تواند بدون token احراز اولیه را انجام دهد و token صادر کند.
- دادهٔ مالی، schema و migration تغییر نکرد.

## تست

- اعتبار JSON manifest: PASS
- syntax JavaScript: PASS
- regression کامل: ۱۳۹ فایل PASS / ۰ FAIL، ۳۶۴۳ چک PASS / ۰ FAIL
- audit: بدون error؛ هشدار تصاویر حجیم باقی است

## استقرار

این نسخه hotfix مستقیم Production است و باید جایگزین `v31.6.2` شود. پس از deploy، hard refresh و ورود مجدد کاربر لازم است تا token جدید دریافت شود.

## نسخه

- `VER v31.6.3`
- `CACHE ptf-crm-v31.6.3`
