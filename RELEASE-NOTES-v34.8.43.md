# یادداشت‌های انتشار — v34.8.43 (R5-گام ۱)

**موضوع:** خروج توکن و نشست از localStorage (T4-1b) — «کلاینت بدون توکنِ در LS».
**تاریخ:** ۲۰۲۶-۰۸-۲۹ · **تستر قفل‌کننده:** `tester544-v34.8.43-r5g1-session-out-of-ls.js` (۴۵ سنجه · سبز) · **گیت:** run-ci-gate + arch-guard + node --check

## چه چیزی عوض شد

### معماری نشست (پیش از این → پس از این)
| | قبل | بعد (v34.8.43) |
|---|---|---|
| توکن (راز) | localStorage (برای همهٔ تب‌ها و هر JS روی دامنه، دائمی) | **sessionStorage** (فقط همین تب) + **کوکی HttpOnly** `ptf_token` (از v34.8.28؛ مشترک همهٔ تب‌ها؛ JS هرگز نمی‌خواندش) |
| نشست UI | localStorage | sessionStorage (تبِ تازه از سرور بازسازی می‌کند) |
| سهم LS | ۳ کلید SESS | **صفر** — LS فقط منبع مهاجرت یک‌بارهٔ بوت است |

- سرور از v34.8.28 در نبود هدر `X-CRM-Token` کوکی را می‌پذیرد (`auth_get_header_token`) — این نسخه روی همان پایه ساخت.

### ۱) کلاینت — لایهٔ `ptfAuth` (crm/rbac.js)
- `ptfAuthToken` (SS + **مهاجرت یک‌بارهٔ LS→SS سپس حذف LS**)، `ptfAuthCookieOk` (نشانگر غیرمحرم `ptf_token_flag=1`)، `ptfAuthOk`، `ptfAuthHeaders`، `ptfAuthSession(Store)`، `ptfAuthLoginWrite`، `ptfAuthClear`، `ptfAuthSessionRestore`.
- **جاروی ۲۹ خواننده در ۱۹ فایل** → `ptfAuthToken()` گاردشده (backup/bridge/careers/client-server/cms/codegen/golive/inqreader/projects/sales-domain-v2/salesfiles/sms/storage/sync/tool-*/ui-kit).
- `curSession` ابتدا SS؛ `hasSyncToken` و گیت `collectionQuery` کوکی را هم نشست می‌شمارند؛ `refreshAuthToken` و مسیر 401 اینکدر هر دو مخزن را پاک می‌کنند.
- **بوت تبِ تازه:** `showCrm` اگر نشست JS نداشت ولی کوکی داشت → `role_verify` → بازسازی نشست. حلقهٔ بوت sync (تلاش ۴۰۰ms تا ۲۴s) به‌طور طبیعی این بازسازی را تحمل می‌کند.

### ۲) index.html
- هر سهٔ مسیر ورود → `ptfAuthLoginWrite` (SS؛ صفر نوشتن LS توکن). `doLogout` همیشه POST می‌زند (کوکی هم توکن سرور را ابطال می‌کند) + پاک‌سازی دو مخزن. `ptfSafeReset`/`ptfInvalidateSession` → `ptfAuthClear`.

### ۳) سرور (api/crm.php)
- `auth_login`: نشانگر غیرمحرم `ptf_token_flag=1` (HttpOnly=false، SameSite=Strict، همان TTL) — JS فقط «نشست سروری هست/نیست» را می‌فهمد.
- `auth_logout`: نشانگر هم پاک می‌شود (وگرنه کلاینت به‌کذب «نشست دارم» می‌دید).
- `role_verify`: `user` + `name` هم برمی‌گرداند (بازسازی نشست؛ نام از `crm_users`؛ فقط-خواندنی).

### ۴) اثرهای جانبی مثبت
- **بک‌آپ‌های LS دیگر توکن ندارند** (توکن در LS نیست) — نشت توکن از فایل‌های بک‌آپ بسته شد.
- XSSِ خواندن LS دائمی دیگر راز باارزشی پیدا نمی‌کند؛ سطح حملهٔ توکن مسروقه محدود به تب/کوکی HttpOnly شد.

## سازگاری
- تب‌های بازِ قبل از ارتقا: با اولین خواندن، توکن به SS منتقل و از LS حذف می‌شود — رفرش بعدی همان تب با SS کار می‌کند؛ تبِ دیگر با کوکی.
- ابزارهای ریکاوری HTML (بدون تغییر): هدر نمی‌فرستند → سرور از کوکی می‌پذیرد.
- `ptf_login_lock` و `ptf_crm_users` (هش محلی برای شتاب ورود) دست‌نخورده — خارج از دامنهٔ این گام.

## تست دستی پیشنهادی روی استیجینگ
1. ورود → DevTools → Application: در **Local Storage** هیچ `ptf_crm_token` نیست؛ در **Session Storage** هر سه کلید هستند؛ کوکی `ptf_token` (HttpOnly) و `ptf_token_flag=1` تنظیم‌اند.
2. رفرش همان تب → بدون لاگین برمی‌گردد. **تب جدید → همان URL** → بدون لاگین وارد می‌شود (بازسازی نشست با کوکی؛ یک درخواست `role_verify` در Network).
3. خروج → تب جدید → صفحهٔ ورود (کوکی‌ها پاک شده‌اند).
4. سینک/نوار وضعیت در تب جدید سبز است؛ پنل‌ها داده می‌گیرند.

## گیت‌ها
- `run-ci-gate`: ۱۶۰ تستر (tester544 جدید) — سبز؛ قرارداد دو تستر تاریخی (486/512) به قرارداد جدید به‌روز شد.
- `arch-guard`: تخلف‌های جدید = گاردهای عمدی fail-open → طبق روال، baseline رتچت.
- تغییرناپذیرها: ۴ ابزار ریکاوری HTML (R6)، backup.js، پروداکشن v34.8.12.

## گام‌های بعدی
- **R5-گام ۲ (v34.8.44):** `ptf_crm_avatars` → آروان S3 (T4-3b، الگوی چک‌پرینت v34.8.28).
- **R4-گام ۲ (v34.8.45):** حذف موتور legacy سینک — پس از پنجرهٔ ≥۷روزهٔ سبز (win7 ≈ 0 + صفر R4-GATE-BYPASS).
- R6 (v34.9.0): سخت‌گیری بانکی + ابزارهای ریکاوری IDB-aware.
