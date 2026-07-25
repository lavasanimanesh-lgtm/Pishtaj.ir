# Release Notes — v31.7.51

**تاریخ:** ۱۴۰۵/۰۴/۳۰ (2026-07-21)  
**نسخه:** `v31.7.51`  
**نوع:** STORAGE-IDB-VOLATILE-MIGRATION-001 — مهاجرت امن cache/draft/history به IndexedDB

---

## هدف ریلیز

ادامه فاز کنترل حافظه بعد از v31.7.50. در v31.7.50 guard، health meter و پاک‌سازی امن اضافه شد؛ در این گام، برای کاهش فشار واقعی روی `localStorage`، داده‌های **volatile/cache** قبل از compact شدن در **IndexedDB** آرشیو می‌شوند و سپس نسخه سبک‌تر در `localStorage` می‌ماند.

---

## RCA / دلیل دقیق

1. پرشدگی localStorage به ۸۵٪ رسیده بود و v31.7.50 جلوی crash و خطای خام quota را گرفت.
2. اما compact ساده بدون آرشیو کامل، برای برخی داده‌های کم‌ریسک مثل draft/cache/history ممکن بود از نظر کاربر حس «حذف» ایجاد کند.
3. راه امن‌تر این است که قبل از کوتاه‌سازی localStorage، snapshot کامل keyهای volatile در IndexedDB ذخیره شود.
4. IndexedDB ظرفیت عملی بیشتری از localStorage دارد و برای داده‌های حجیم مرورگر مناسب‌تر است.
5. رکوردهای اصلی کسب‌وکاری هنوز نباید در این فاز خودکار migrate یا حذف شوند، چون نیازمند migration server-first جداگانه هستند.

---

## کارهای انجام‌شده

### 1) مهاجرت امن volatile/cache به IndexedDB

در `crm/storage-quota.js` API جدید اضافه شد:

```js
ptfStorageMigrateVolatileToIdb(opts, cb)
```

این API ابتدا مقدار کامل keyهای هدف را در IndexedDB با شناسه زیر ذخیره می‌کند:

```text
archive:<localStorageKey>:latest
```

سپس localStorage را compact می‌کند.

---

### 2) Archive Index

برای مشاهده آرشیوهای ایجادشده، index سبک زیر در localStorage نگهداری می‌شود:

```text
ptf_storage_archive_index
```

APIهای جدید:

```js
ptfStorageArchiveIndex()
ptfStorageShowArchiveIndex()
```

---

### 3) کلیدهای هدف migration

کلیدهای کم‌ریسک/volatile زیر پوشش داده شدند:

```text
ptf_web_events_v2
ptf_chat_history
ptf_draft_forms
ptf_crm_notifs
ptf_crm_sendqueue
ptf_crm_audit
ptf_backup_local
ptf_backup_prerestore
ptf_ai_hist_*
ptf_ai_cache*
```

قواعد compact پس از آرشیو:

```text
web events       → 100 رویداد آخر
chat history     → 30 پیام آخر
draft forms      → 8 پیش‌نویس اخیر
AI history       → 4 مورد اخیر
AI cache         → حذف از localStorage بعد از archive
audit            → 900 رکورد
sendqueue        → حذف sentها
notifications    → نگه‌داشتن unreadها و recentها
backup fallback  → marker کوچک localStorage + payload در IndexedDB
```

---

## مواردی که عمداً migrate نمی‌شوند

برای جلوگیری از ریسک داده‌ای، رکوردهای اصلی کسب‌وکاری در این فاز دست‌نخورده می‌مانند:

```text
ptf_crm_rfqs
ptf_crm_offers
ptf_crm_customers
ptf_crm_suppliers
ptf_crm_products
ptf_crm_finance
ptf_crm_projects
ptf_crm_contracts
```

این‌ها باید در فاز جداگانه و با migration server-first انجام شوند.

---

## تغییرات UI در تنظیمات CRM

در بخش Storage Health دو دکمه اضافه شد:

```text
مهاجرت cache/draft به IndexedDB
آرشیوهای IndexedDB
```

همچنین دکمه «پاک‌سازی امن فوری» اکنون اگر IndexedDB در دسترس باشد، ابتدا migration/archiving را انجام می‌دهد و بعد compact می‌کند.

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
_tools/uat/tester228-storage-idb-volatile-migration.js
RELEASE-NOTES-v31.7.51.md
REGRESSION-REPORT-v31.7.51.md
```

---

## تست اضافه‌شده

```text
_tools/uat/tester228-storage-idb-volatile-migration.js
```

پوشش:

- وجود API مهاجرت `ptfStorageMigrateVolatileToIdb`.
- وجود archive index و نمایش آرشیوها.
- اضافه شدن دکمه‌های UI.
- اینکه کلیدهای volatile هدف migration هستند نه رکوردهای اصلی.
- runtime smoke با IndexedDB fake:
  - archive شدن keyها.
  - کوچک‌تر شدن localStorage.
  - compact شدن web/chat/audit/AI history.
  - حذف AI cache از localStorage پس از archive.
  - تبدیل backup local به marker IndexedDB.

نتیجه مستقیم:

```text
tester228-storage-idb-volatile-migration: 12 PASS / 0 FAIL
```

---

## Impact Analysis

| بخش | اثر | ریسک |
|---|---|---|
| Storage Health | دکمه migration و archive index اضافه شد | کم |
| localStorage مصرفی | کاهش فشار با archive+compact داده‌های volatile | مثبت |
| IndexedDB | برای آرشیو keyهای کم‌ریسک استفاده می‌شود | متوسط/کنترل‌شده |
| رکوردهای اصلی CRM | دست‌نخورده | کم |
| Backup fallback | همچنان marker کوچک localStorage + payload در IndexedDB | کم |
| Sync/API/Auth/Finance | بدون تغییر backend/API | کم |

---

## راستی‌آزمایی کارفرما

1. وارد CRM شوید.
2. به تنظیمات بروید.
3. ابتدا «بک‌آپ سروری» را اجرا کنید.
4. سپس روی «مهاجرت cache/draft به IndexedDB» بزنید.
5. بعد از پیام موفقیت، روی «آرشیوهای IndexedDB» بزنید.
6. باید keyهایی مثل `ptf_web_events_v2`, `ptf_draft_forms`, `ptf_ai_hist_*`, `ptf_backup_local` یا موارد مشابه را در archive index ببینید.
7. سپس درصد Storage Health را بررسی کنید؛ باید کمتر یا پایدارتر شده باشد.

---

## نتیجه

اکنون CRM فقط guard ندارد؛ بلکه برای داده‌های cache/draft/history، قبل از سبک‌سازی localStorage، نسخه کامل را در IndexedDB آرشیو می‌کند. این گام ریسک ۸۵٪ پرشدگی را کاهش می‌دهد بدون اینکه رکوردهای اصلی کسب‌وکاری وارد migration پرریسک شوند.
