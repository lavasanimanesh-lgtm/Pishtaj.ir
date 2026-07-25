# Release Notes — v31.7.50

**تاریخ:** ۱۴۰۵/۰۴/۳۰ (2026-07-21)  
**نسخه:** `v31.7.50`  
**نوع:** STORAGE-QUOTA-FOUNDATION-001 — محافظ فوری حافظه محلی CRM

---

## هدف ریلیز

به دلیل گزارش پرشدگی حدود **۸۵٪** حافظه محلی CRM، این ریلیز با اولویت بالا برای کاهش ریسک `QuotaExceededError`، شفاف‌سازی مصرف localStorage و آماده‌سازی مسیر مهاجرت کنترل‌شده به IndexedDB/Server-first انجام شد.

---

## RCA / دلیل دقیق

1. پنل قبلی مصرف حافظه را نسبت به سقف محافظه‌کارانه حدود ۵MB نشان می‌داد و اکنون به محدوده خطر ۸۵٪ رسیده بود.
2. این سقف از طرف مرورگر و برای `localStorage` است؛ سایت نمی‌تواند مستقیم آن را مثلاً به ۵۰MB افزایش دهد.
3. CRM رشد کرده و داده‌هایی مانند اعلان‌ها، audit، صف‌ها، draftها، historyهای AI، backupهای محلی و cacheها می‌توانند localStorage را پر کنند.
4. پر شدن localStorage می‌تواند باعث ذخیره‌نشدن رکورد، خطای خام JS، sync ناقص یا رفتارهای غیرقابل پیش‌بینی شود.
5. راه امن، ابتدا ایجاد guard/monitor/cleanup و سپس مهاجرت مرحله‌ای داده‌های حجیم به IndexedDB و سرور است؛ نه تغییر سنگین و یکباره کل storage.

---

## کارهای انجام‌شده

### 1) فایل جدید محافظ حافظه

فایل جدید:

```text
crm/storage-quota.js
```

این فایل قبل از ماژول‌های عملیاتی CRM لود می‌شود و APIهای زیر را اضافه می‌کند:

```js
ptfStorageLocalUsage()
ptfStorageHealthSync()
ptfStorageTopKeys(n)
ptfStorageFormatBytes(n)
ptfStorageSafeSetItem(key, value, opts)
ptfStorageEmergencyCompact(opts)
ptfStorageRequestPersistent()
ptfStorageShowLargeKeys()
ptfStorageIdbSet(id, value, cb)
ptfStorageIdbGet(id, cb)
ptfStorageFailedWrites()
```

---

### 2) اندازه‌گیری و نمایش دقیق‌تر localStorage

در تنظیمات CRM، بخش Storage Health اکنون نشان می‌دهد:

```text
درصد مصرف localStorage
حجم مصرف‌شده
سقف محافظه‌کارانه ۵MB
بزرگ‌ترین keyهای localStorage
توضیح اینکه ۵MB محدودیت مرورگر است
تفاوت Browser storage estimate با localStorage
```

---

### 3) fail-safe برای setItem

`localStorage.setItem` با guard جدید wrap شد. اگر مرورگر خطای quota بدهد:

1. پاک‌سازی اضطراری volatileها اجرا می‌شود.
2. ذخیره مجدداً تلاش می‌شود.
3. اگر همچنان نشد، هشدار visible در CRM نمایش داده می‌شود.
4. خطا در `ptfStorageFailedWrites()` ثبت می‌شود.
5. برای backup/prerestore حجیم، مسیر IndexedDB فعال می‌شود.

---

### 4) setData مرکزی CRM محافظت شد

تابع مرکزی:

```js
setData(k, d)
```

اکنون در صورت وجود guard از این مسیر استفاده می‌کند:

```js
ptfStorageSafeSetItem(k, JSON.stringify(d))
```

---

### 5) پاک‌سازی امن فوری

در تنظیمات CRM دکمه «پاک‌سازی امن فوری» اضافه/تقویت شد. این پاک‌سازی فقط داده‌های volatile/کم‌ریسک را compact می‌کند:

```text
ptf_crm_notifs       اعلان‌های خوانده‌شده/قدیمی
ptf_crm_sendqueue    آیتم‌های sent
ptf_crm_audit        محدود به ۱۰۰۰ رکورد اخیر/مهم
ptf_web_events_v2    محدود به ۱۵۰ رویداد آخر
ptf_chat_history     محدود به ۴۰ مورد آخر
ptf_draft_forms      محدود به ۱۰ draft اخیر
ptf_ai_cache*        cacheهای AI قابل بازسازی
ptf_ai_hist_*        historyهای AI کوتاه‌تر
```

رکوردهای اصلی کسب‌وکاری مثل RFQ، Offer، Customers، Products و Finance به‌صورت خودکار حذف نمی‌شوند.

---

### 6) IndexedDB helper برای داده‌های حجیم اضطراری

برای جلوگیری از پرتر شدن localStorage، fallbackهای حجیم زیر به IndexedDB منتقل می‌شوند:

```text
ptf_backup_local
ptf_backup_prerestore
```

در localStorage فقط marker کوچک نگهداری می‌شود.

---

### 7) Persistent Storage

دکمه «درخواست Persistent Storage» اضافه شد. این قابلیت localStorage را بزرگ‌تر نمی‌کند، اما در مرورگرهای پشتیبانی‌کننده احتمال پاک‌شدن cache/IndexedDB توسط مرورگر را کاهش می‌دهد.

---

## محدودیت‌های آگاهانه این فاز

این ریلیز هنوز migration کامل همه رکوردهای CRM به IndexedDB نیست. دلیل: مهاجرت یکباره storage برای CRM پرریسک است.

مسیر امن:

```text
v31.7.50: monitor + guard + cleanup + IndexedDB helper
گام بعدی: انتقال cache/draft/historyهای بزرگ به IndexedDB
گام بعدتر: server-first کردن رکوردهای اصلی و کاهش وابستگی localStorage
```

---

## فایل‌های تغییر یافته

```text
crm/storage-quota.js
crm/backup.js
crm/index.html
crm/sw.js
crm/clear-cache.html
PTF-MASTER-HANDOVER.md
_tools/uat/tester227-storage-quota-foundation.js
RELEASE-NOTES-v31.7.50.md
REGRESSION-REPORT-v31.7.50.md
```

---

## تست اضافه‌شده

```text
_tools/uat/tester227-storage-quota-foundation.js
```

پوشش:

- لود شدن `storage-quota.js` قبل از codegen/backup.
- bump نسخه به v31.7.50.
- تعریف سقف محافظه‌کارانه ۵MB.
- وجود APIهای health/topKeys/safeSetItem/compact/IndexedDB.
- wrap شدن `Storage.prototype.setItem`.
- شناسایی `QuotaExceededError`.
- استفاده backup/settings از API جدید.
- انتقال fallbackهای حجیم backup/prerestore به IndexedDB.
- smoke runtime برای compact کردن audit و web events.

نتیجه مستقیم:

```text
tester227-storage-quota-foundation: 21 PASS / 0 FAIL
```

---

## Impact Analysis

| بخش | اثر | ریسک |
|---|---|---|
| CRM Settings | Storage Health کامل‌تر و عملیاتی‌تر شد | کم |
| localStorage writes | guard و هشدار اضافه شد | متوسط/کنترل‌شده |
| Data integrity | رکوردهای اصلی خودکار حذف نمی‌شوند | کم |
| Backup fallback | snapshot حجیم به IndexedDB منتقل می‌شود | متوسط/کنترل‌شده |
| Sync/API/Auth/Finance | تغییر API/Backend ندارد | کم |
| Performance | محاسبه usage فقط هنگام نیاز/تنظیمات و guard انجام می‌شود | کم |

---

## راستی‌آزمایی کارفرما

1. وارد CRM شوید.
2. به تنظیمات بروید.
3. بخش «حافظه محلی CRM — Storage Health» را بررسی کنید.
4. باید موارد زیر را ببینید:

```text
درصد مصرف
حجم مصرف‌شده
بزرگ‌ترین کلیدها
دکمه پاک‌سازی امن فوری
دکمه بک‌آپ سروری
دکمه نمایش کلیدهای بزرگ
دکمه درخواست Persistent Storage
```

5. ابتدا «بک‌آپ سروری» را بزنید.
6. سپس «پاک‌سازی امن فوری» را اجرا کنید.
7. بعد از برگشت به تنظیمات، درصد مصرف باید کمتر یا حداقل پایدارتر شود.

---

## نتیجه

ریسک فوری پرشدن localStorage با یک guard عملیاتی، نمایش دقیق‌تر و پاک‌سازی امن کنترل شد. این کار سقف ۵MB مرورگر را تغییر نمی‌دهد، اما CRM را در برابر پرشدگی ناگهانی مقاوم‌تر می‌کند و مسیر مهاجرت مرحله‌ای به IndexedDB/Server-first را آماده می‌سازد.
