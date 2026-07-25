# Release Notes v32.0.6 — HOTFIX — User Sync Token Fix — ریشه‌یابی عمیق

**مبنا:** v32.0.5 (Login Fix)
**نسخه:** v32.0.6
**باگ گزارشی شما (اسکرین‌شات دوم):** حتی پس از پاکسازی دستی کلیدها، پیام نارنجی `سرور در دسترس نیست — کاربر فعلاً فقط در این مرورگر است` همچنان می‌آید. کاربر فقط در این مرورگر دیده می‌شود.

**RCA عمیق (ریشه کنی):**

1. در `crm/rbac.js:324` تابع `usersSyncToServer()` فقط هدر `X-CRM-Role` می‌فرستاد:
   ```js
   fetch('../api/crm.php?action=users_sync', { headers: { 'X-CRM-Role': curRole() } })
   ```
2. پس از US-438 (SEC-ROLE-SPOOF-FIX) در v32.0.1، سرور در `api/cms.php` و `api/crm.php` دیگر `X-CRM-Role` را به تنهایی نمی‌پذیرد — حتماً باید `X-CRM-Token` (JWT) معتبر باشد + نقش از توکن خوانده شود.
3. در نتیجه `users_sync` با 401 برمی‌گشت → catch → `ptfToast('سرور در دسترس نیست — کاربر فقط در این مرورگر است')`
4. این فقط روی مرورگری که کاربر جدید در آن ساخته شده بود دیده می‌شد، چون مرورگرهای دیگر قبلاً users را sync کرده بودند و نیازی به `users_sync` نداشتند. مرورگر جدید که کاربر را local ساخته، سعی می‌کند به سرور push کند و fail می‌شود → کاربر فقط در همان مرورگر می‌ماند.
5. همین الگو در 8 فایل دیگر هم بود: `backup.js`, `bridge.js`, `cms.js`, `golive.js`, `sms.js` که فقط Role می‌فرستادند.

**رفع v32.0.6 (ریشه‌کنی):**

- `crm/rbac.js:324` — اضافه شدن `X-CRM-Token`:
  ```js
  var hdrs = {};
  try { hdrs['X-CRM-Role'] = curRole(); var tk = localStorage.getItem('ptf_crm_token'); if(tk) hdrs['X-CRM-Token']=tk; } catch(e){}
  fetch(..., {headers: hdrs})
  ```
- `crm/rbac.js:365` `usersPullFromServer` هم token می‌فرستد (هرچند users_get public است)
- `crm/backup.js`, `bridge.js`, `cms.js`, `golive.js`, `sms.js`, `sync.js` — تمام جاهایی که فقط `X-CRM-Role` بود، به IIFE تبدیل شد که هم Role و هم Token می‌فرستد:
  ```js
  headers: (function(){ var h={'X-CRM-Role':curRole()}; try{var t=localStorage.getItem('ptf_crm_token'); if(t) h['X-CRM-Token']=t;}catch(e){} return h; })()
  ```
- `api/auth.php` fallback dev key (v32.0.5) حفظ شد تا بدون secrets هم login کار کند

**UAT:**
1. در Chrome جدید → ورود admin → تعریف کاربر جدید `testuser` → باید toast سبز `کاربران با سرور همگام شدند (n)` نه نارنجی
2. در Firefox (مرورگر دوم) → ورود admin → باید `testuser` در لیست کاربران دیده شود (چون از سرور sync شده)
3. دستی کلیدها را پاک کردن → ورود admin → دیگر پیام نارنجی "سرور در دسترس نیست — کاربر فقط در این مرورگر" نباید بیاید (چون users_sync با token موفق می‌شود)

**فایل‌های تغییرکرده:**
```
crm/rbac.js (US-438-fix — send X-CRM-Token in users_sync)
crm/backup.js, bridge.js, cms.js, golive.js, sms.js, sync.js (token header added)
crm/index.html, sw.js, clear-cache.html (VER v32.0.5 → v32.0.6)
RELEASE-NOTES-v32.0.6.md
REGRESSION-REPORT-v32.0.6.md
FILES-CHANGED-v32.0.6.txt
```

**نسخه بعدی:** v32.1 Performance
