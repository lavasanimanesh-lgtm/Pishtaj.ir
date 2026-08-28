# یادداشت انتشار CRM v34.8.36

تاریخ: ۱۴۰۵/۰۶/۰۶ (۲۰۲۶-۰۸-۲۸)

## SYNC-RBAC-PARITY — پایان نوار زرد پایدار «[personal_cheques]»

**علامت (استیجینگ):** بنر زرد «۱ تغییر هنوز به سرور نرسیده — … [personal_cheques]»
با وجود نسخهٔ ۳۵ و ارتباط سالم، هرگز سبز نمی‌شد.

### ریشه (RCA کامل: `ARENA-RCA-YELLOW-BAR-PERSONAL-CHEQUES-2026-08-28.md`)
ماتریس RBAC سینکِ سرور (`sync_allowed_keys_for_role` در `api/crm.php`) برای نقش‌های
**sales/buyer/collector** کلید `ptf_crm_personal_cheques` را نداشت، درحالی‌که ماتریس
کلاینت (`SYNC_ROLE_KEYS` در `crm/sync.js`) و رجیستری فرمانی سرور
(`sd_entity_registry`) هر دو آن را برای **هر ۸ نقش** مجاز کرده بودند (از v34.8.29).

نتیجه: push مسیر فاز B → `data_push` → `$forbidden_keys[]` → کلاینت کلید forbidden
را دوباره dirty می‌کرد → **حلقهٔ بن‌بست ابدی**؛ نوار هیچ‌وقت سبز نمی‌شد. خودِ داده از
مسیر فرمانی (`entity_upsert`) رسیده بود — فقط ACK مسیر whole-array صادر نمی‌شد.

### تغییرها
1. **api/crm.php** — افزودن `ptf_crm_personal_cheques` به `$crm` (پوشش sales/buyer)
   و `$collector`. حالا ماتریس سرور = ماتریس کلاینت = رجیستری فرمانی (تأیید
   ست‌به‌ست با tester537 برای هر ۵ سطح نقش؛ دیفرنس قبلی فقط همین یک کلید بود).
2. **crm/sync.js + crm/client-server.js (FORBIDDEN-DROP)** — قرارداد مسیر legacy به
   فاز B آمد: کلیدِ forbidden دیگر در صف IDB و dirty ابدی نمی‌ماند؛ از صف حذف، dirty
   پاک، خطا در `ptf_sync_last_error` ثبت و نشانگر 🟠 می‌شود. rejected/conflicts/
   skipped قابل‌تلاش باقی می‌مانند (رفتار قبلی).
3. **crm/sales-domain-v2.js (ROUTER-CB)** — `ptfEntitySaveCollection` حالا قرارداد
   `opts.cb` را رعایت می‌کند: جمع‌بندی وضعیت همهٔ فرمان‌ها و یک فراخوانی در پایان
   (acked فقط اگر همه ACK شوند). ریشهٔ باگ: مهاجرت cheques.js پاک‌سازی کلیدهای
   legacy را فقط در cb انجام می‌داد ولی cb هرگز صدا زده نمی‌شد → مهاجرت هر بوت
   تکرار و `ptf_personal_cheques_<user>`ها تا ابد روی دستگاه می‌ماندند.
4. **tester537** — گیت جدید «برابری ماتریس RBAC سینک کلاینت↔سرور»: تجزیهٔ
   `SYNC_ROLE_KEYS`/`SYNC_KEYS` و `$crm`/`$accountant`/`$collector`/buyer-merge و
   مقایسهٔ ست‌به‌ست + دو تست رفتاری (FORBIDDEN-DROP و ROUTER-CB با vm).
   کور‌اسپاتی که tester531 ندید (چکِ «ماتریس کامل» فقط با انتهای آرایهٔ
   accountant پاس می‌شد) بسته شد.

### کنترل
گیت کامل **153 PASS / 0 FAIL** (۱۵۲ قبلی + tester537)، arch-guard PASS (A10/A11 بدون
تخلف جدید)، node --check ماژول‌های تغییرکرده OK.

### پین نسخه
VERSION.json + `crm/index.html` + `crm/sw.js` + `crm/manifest.json` +
`crm/clear-cache.html` + `crm/shell.js` + `SD_SERVICE_VERSION` + bump-pins تسترها.

### پس از استقرار (پذیرش)
- با کاربر sales/buyer/collector: نوار زرد personal_cheques حداکثر تا اولین flush پاک
  می‌شود (forbidden دیگر dirty نمی‌سازد) و ثبت/ویرایش چک شخصی → 🟢.
- در تنظیمات → تشخیص همگام‌سازی، در صورت بروز هر forbidden آینده، «آخرین خطا» علت را
  نشان می‌دهد (قبلاً بی‌صدا بود).
