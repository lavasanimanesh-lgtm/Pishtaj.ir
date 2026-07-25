# 🚀 Release Notes v32.0.4 — STABILITY PATCH — Sprint 1

**نوع:** Patch Release — پایداری و جلوگیری از Data Loss  
**مبنا:** v32.0.3 (HOTFIX captcha)  
**نسخه:** v32.0.4  
**وضعیت:** آماده Production Deploy — ریسک کم  
**حجم:** ZIP کامل 25M — 1685 files / 188 images

## بک‌لاگ Sprint 1 (5 US)

### US-444 FILE-MIME-VALIDATE
**مشکل:** آپلود فقط با extension چک می‌شد — `shell.php.pdf` با محتوای PHP می‌توانست به S3 برود.
**رفع:**
- `api/storage-lib.php`: `finfo_open(FILEINFO_MIME_TYPE)` + لیست مجاز `application/pdf`, `image/jpeg` etc + بلاک `text/x-php`, `text/html`, `application/x-sh` + اسکن 2KB اول برای `<?php`
- `api/contact.php`: همین چک + `application/x-rar` و غیره + بلاک محتوای PHP
**تست:** آپلود فایل `test.php.pdf` با `<?php` داخل → باید 422 `فایل حاوی کد PHP`

### US-445 RACE-LOST-UPDATE-FIX
**مشکل:** `load_data` بدون flock → خواندن ناقص حین write، `save_data` با `LOCK_EX` اما بدون temp file atomic.
**رفع:**
- `load_data()`: `fopen r` + `flock LOCK_SH` + fread loop + `LOCK_UN`
- `save_data()`: نوشتن به `*.tmp.uniqid` + `fopen c` + `LOCK_EX` + `rename` (atomic)
**تست:** 10 درخواست همزمان `save_data('test')` → هیچ data loss

### US-446 QUOTA-GUARD
**مشکل:** `setData(k,v)` در `sync.js` و `ai-*.js` بدون try/catch — اگر localStorage 5MB پر شود، `QuotaExceededError` و کرش.
**رفع:**
- `crm/sync.js`: `try { _setData } catch(e) { if QuotaExceeded → حذف `ptf_draft_forms`, `ptf_ai_hist_*` و تلاش مجدد + toast هشدار`
- `ai-tech-assistant.js`, `ai-workbench.js`: همین guard
**تست:** پر کردن localStorage تا 5MB سپس ذخیره مشتری جدید → باید toast زرد "حافظه پر بود — پیش‌نویس پاک شد" نه کرش

### US-447 CONTACT-LOG-ROTATE
**مشکل:** `contacts.log` با `FILE_APPEND` بی‌نهایت رشد — دیسک پر می‌شود.
**رفع:**
- اگر `filesize >5MB` → rename به `contacts-YYYY-MM-DD-His.log`
- نگه‌داری فقط 10 فایل قدیمی، بقیه حذف
- `.htaccess Deny from all` برای پوشه logs
**تست:** ایجاد فایل 6MB سپس ارسال فرم جدید → باید rotate + فایل جدید 0KB

### US-448 FIN-MARGIN-SERVER-SIDE
**مشکل:** حاشیه سود فقط کلاینت `ptfOfferOverallMargin()` — کاربر می‌تواند DOM دستکاری کند.
**رفع:**
- تابع جدید `calc_margin_server($items)` در `api/crm.php` — محاسبه `totalBuy`, `totalSell`, `marginPct = (sell-buy)/sell*100`, `coverage`
- اکشن جدید `?action=calc_margin` POST `{"items":[...]}` → `{"ok":true,"margin":{...}}`
- کلاینت می‌تواند قبل از ذخیره پیشنهاد، margin را از سرور بگیرد (trusted)
**تست:** POST 2 قلم با buy 100/sell 150 → margin 33.3%

## عمداً تغییر نکرده

- 48 کلید sync دست‌نخورده
- 16 آیکون یکتای مرکز دانش دست‌نخورده
- 6 فیکس امنیتی v32.0.1/v32.0.3 دست‌نخورده
- فرمول سود قبلی کلاینت حفظ — سرور فقط مرجع اضافه

## UAT Sprint 1 (15 دقیقه)

1. آپلود `shell.php` با محتوای `<?php` → باید 422
2. دو تب باز + ویرایش همزمان مشتری → بدون از دست رفتن
3. پر کردن localStorage (می‌توان با `for(i=0;i<1000;i++) localStorage.setItem('test'+i,'x'.repeat(5000))`) سپس ذخیره → toast زرد
4. `contacts.log` 6MB بساز → فرم جدید → rotate
5. `curl -X POST -d '{"items":[{"buyPrice":100,"price":150,"qty":2}]}' ...?action=calc_margin` → margin 33.3%

## فایل‌های تغییرکرده

```
api/storage-lib.php (US-444 MIME)
api/contact.php (US-444 MIME + US-447 rotate)
api/crm.php (US-445 flock + US-448 calc_margin + US-440-fix retained)
crm/sync.js (US-446 quota guard)
crm/ai-tech-assistant.js (US-446)
crm/ai-workbench.js (US-446)
crm/index.html (VER v32.0.3 → v32.0.4)
crm/sw.js (CACHE v32.0.3 → v32.0.4)
RELEASE-NOTES-v32.0.4.md (این فایل)
REGRESSION-REPORT-v32.0.4.md
FILES-CHANGED-v32.0.4.txt
```

## نسخه بعدی

- v32.1 → US-449..451 (Performance: GZIP/WEBP, Virtual Scroll, Empty State)
- v33 → US-452..454 (Pipeline Kanban)

