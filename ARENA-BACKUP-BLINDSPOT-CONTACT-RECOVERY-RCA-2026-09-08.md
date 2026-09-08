# RCA — «دکمهٔ بازیابی تماس‌ها کار نمی‌کند» + وضعیت بسته‌شدن ریشهٔ حذف تماس

**تاریخ:** 2026-09-08 · **نسخهٔ اصلاح:** v34.38.9 · **تستر قفل:** `_tools/uat/tester616-v34.38.9-backup-blindspot-and-partial-recovery.js`

---

## ۰. گزارش کارفرما

> «در قسمت مشتریان دکمهٔ بازیابی تماس‌ها که باید بازیابی اطلاعات تماس‌های گم‌شده را انجام دهد کار نمی‌کند. بررسی کن ببین مشکل چیست. همچنین بررسی کن ببین ریشهٔ باگ بسته شده است که دیگر هیچ تماس مشتری جدیدی حذف و گم نشود یا نه.»

دو پرسش مستقل است و هرکدام جداگانه پاسخ داده می‌شود:

| پرسش | پاسخ کوتاه |
|---|---|
| چرا دکمهٔ «🛟 بازیابی تماس‌ها» چیزی برنمی‌گرداند؟ | **خودِ دکمه سالم بود؛ منبعش خالی بود.** بک‌آپ‌های چرخشی سرور از زمان فعال‌شدن فاز B «هیچ مشتری‌ای» نداشتند. علاوه بر آن ابزار فقط رکوردهای *کاملاً* تماس‌خالی را نامزد می‌کرد و شستشوهای جزئی را نمی‌دید. |
| آیا ریشهٔ «حذف/گم‌شدن تماس» بسته شده؟ | **مسیر نوشتن بله** (زنجیرهٔ v34.37.7 → v34.38.7، قفل‌شده با tester604/611/613/614). **ولی تور نجات باز بود**: بک‌آپ سالمی وجود نداشت تا اگر دوباره چیزی گم شد برگردد. همان شکاف در این نسخه بسته شد. |

---

## ۱. بخش اول — چرا دکمه «کار نمی‌کرد»

### ۱.۱ زنجیرهٔ کامل (چهار حلقه، هر چهار در سکوت)

**حلقهٔ ① (ریشهٔ قطعی) — `crm/backup.js` کور شده بود**

از `crm/client-server.js` v34.8.9 (STORAGE-INDEPENDENCE) و v33.20.0 (آینهٔ خالدار):

```js
window.ptfBMirror = function (k, str) {
  if (!window.ptfBMirrorActive()) return false;
  if (!heavyList(k, str)) return false;
  idbMem[k] = String(str);
  window.ptfStorageIdbSet(idbPrefix() + k, String(str), ...);
  try { if (localStorage.getItem(k) !== null) localStorage.removeItem(k); } catch (e) {}  // ← کلید از localStorage می‌رود
  return true;
};
```

و `ptfBOffloadBusinessKeysToIdb` هر کلید کسب‌وکاریِ **بزرگ‌تر از ۸KB** را از localStorage تخلیه می‌کند. `ptf_crm_customers` روی هر نصب واقعی خیلی بزرگ‌تر از این است. `getData` این را می‌داند (اول `ptfBRead` را می‌خواند)، اما `backup.js` نه:

```js
// قبل از اصلاح — backup.js
function collectBackup() {
  var data = {};
  DATA_KEYS.forEach(function (k) {
    var v = localStorage.getItem(k);   // ← روی دستگاه فاز B برابر null است
    if (v === null) return;            // ← کلید بی‌صدا از بک‌آپ حذف می‌شود
    data[k] = v;
  });
  ...
}
```

نتیجه: **هر `hourly-latest` / `daily-*` / `weekly-latest` / `monthly-latest` که پس از فعال‌شدن فاز B ساخته شده، صفر مشتری دارد.** پاسخ سرور همچنان `ok:true` بود، پس هیچ‌کس متوجه نشد.

**حلقهٔ ② — دلتای بک‌آپ، بک‌آپ پایه را هم مسموم می‌کرد**

```js
// قبل از اصلاح
window.ptfBackupDeltaCollect = function () {
  DATA_KEYS.forEach(function (k) {
    var v = localStorage.getItem(k);       // null
    if (sigs[k] !== hashString(v)) { delta[k] = v; changed.push(k); }   // delta[k] = null !
  });
};
```

سرور در `save_backup_delta`:

```php
foreach ($j['delta'] as $k => $v) { $ex['data'][$k] = $v; }   // data['ptf_crm_customers'] = null
```

یعنی نه‌تنها بک‌آپ تازه خالی بود، بلکه **آخرین بک‌آپ کاملِ پایه هم کلید مشتریان را از دست می‌داد**. تنها چیزی که مانع فاجعهٔ کامل شد، سپر ضدِ آب‌رفتنِ `ptf_rotate_backup` بود که چنین نسخه‌ای را `suspect-*` قرنطینه می‌کند و `hourly-latest` را دست‌نخورده می‌گذارد — ولی همین یعنی **چرخش بک‌آپ عملاً برای همیشه متوقف شده بود** و کاربر هیچ هشداری نمی‌دید (پاسخ قرنطینه هم `ok:true` است).

**حلقهٔ ③ — امضای «تغییری نکرده»**

`backupSignature()` هم از localStorage می‌خواند. برای کلیدهای offloadشده همیشه همان مقدار ثابت (`h = h*33 + 999`) را می‌گرفت؛ یعنی هر تغییری در مشتریان/پیشنهادها **در امضا دیده نمی‌شد** و بک‌آپ خودکار ساعتی می‌گفت «چیزی عوض نشده».

**حلقهٔ ④ — ابزار بازیابی فقط شستشوی کامل را می‌دید**

```js
// restore-contacts.js v34.38.8
if (!c || !c.cd || hasContacts(c)) return;   // ← نامزدی در سطح «رکورد»
```

`hasContacts` اگر **هر** نشانهٔ تماسی (حتی فقط `ph`) ببیند رکورد را کنار می‌گذارد. اما امضای واقعی گزارش‌های میدانی «شستشوی جزئی» است: `ph` مانده ولی همهٔ اشخاص رابط و موبایل‌ها رفته‌اند، یا `people` هست ولی `tels/mobs/mails` همه‌شان خالی شده. آن رکوردها **هرگز در پیش‌نمایش نمی‌آمدند**.

### ۱.۲ بازتولید (کد واقعی، vm)

هارنس `/tmp/diag/repro.js` ماژول واقعی `crm/backup.js` را در vm بوت می‌کند با دستگاهی که `ptf_crm_customers` در IndexedDB و `ptf_crm_settings` در localStorage دارد:

```
--- قبل از اصلاح ---
delta.ptf_crm_customers = null
keys in backup: ptf_crm_settings
has ptf_crm_customers ? *** NO — backups contain zero customers ***

--- بعد از اصلاح ---
delta.ptf_crm_customers = "[{\"cd\":\"CUST-1\",...\"mobs\":[{\"n\":\"۰۹۱۲۱\"}]...}]"
keys in backup: ptf_crm_customers, ptf_crm_settings
has ptf_crm_customers ? YES
```

### ۱.۳ اصلاح‌ها

| # | فایل | تغییر |
|---|------|-------|
| A1 | `crm/backup.js` | `bkRead(k)` تازه: **آینهٔ فاز B (`ptfBRead`) → localStorage → `getData`**. جایگزین همهٔ `localStorage.getItem(k)`های جمع‌آوری در `collectBackup`، `backupSignature`، `ptfBackupDeltaCollect`، `deltaSaveSentKeys`. export: `window.ptfBackupReadKey` |
| A2 | `crm/backup.js` | دلتا **هرگز `null` نمی‌فرستد**؛ کلیدهای بی‌داده در `missing` گزارش می‌شوند. «نبودِ کلید» یعنی «چیزی برای گفتن ندارم»، نه «پاکش کن» |
| A3 | `crm/backup.js` | **تعویق تا آب‌رسانی آینه**: اگر `ptfBMirrorActive() && !ptfBIdbHydrated` باشد، هیچ بک‌آپی (کامل یا دلتا) ارسال نمی‌شود — پنجرهٔ «تصویر کور» بسته شد |
| A4 | `crm/backup.js` | **سپر پوشش** `ptfBackupCoverageGap`: اگر کلید حیاتی (`customers/suppliers/rfqs/offers/invoices`) روی دستگاه داده دارد ولی در تصویر نیست، ارسال متوقف و در audit ثبت می‌شود — «بک‌آپ ناقص هرگز جای بک‌آپ سالم را نمی‌گیرد» |
| A5 | `crm/golive.js` | بک‌آپ pre-golive هم از `ptfBackupReadKey` می‌خواند |
| B1 | `crm/restore-contacts.js` | **بازیابی فیلد-به-فیلد**: `restorableEmpty(field, v)` جای گیتِ رکوردی. `people` با نام ولی بدون هیچ کانال تماس = «خالی». S2 (عدم بازنویسی مقدار سالم) دقیقاً روی همان فیلد اعمال می‌شود، هم در `buildPlan` هم دوباره در `applyPlan` |
| B2 | `crm/restore-contacts.js` | **تشخیص** `ptfContactRecoverDiagnose`: هر بک‌آپ بی‌فایده با دلیل (`no_customers_key` / `server_error` / `unparsable` / `fetch_error`) در مودال گزارش می‌شود. اسکنِ بی‌نتیجه دیگر در سکوت تمام نمی‌شود |
| B3 | `crm/restore-contacts.js` | **منابع اضافی**: بک‌آپ اضطراری همین دستگاه (IndexedDB `ptf_backup_local`) + امکان افزودن فایل بک‌آپ دانلودشدهٔ کاربر (`ptfContactRecoverAddSource` / ورودی فایل در مودال). همهٔ منابع بر اساس مهر زمان جدید→قدیم مرتب می‌شوند |
| B4 | `crm/restore-contacts.js` | `maxOps` به روتر پاس داده می‌شود. سقف پیش‌فرض ۴۰ عملیات باعث می‌شد **بازیابی انبوه — یعنی دقیقاً سناریوی این حادثه — بی‌صدا به مسیر legacy تنزل کند** |

سپرهای اصلی نسخهٔ ۳۴.۳۸.۸ دست‌نخورده‌اند: فقط `CONTACT_FIELDS` نوشته می‌شود (S1)، مقدار سالم بازنویسی نمی‌شود (S2)، هیچ رکوردی حذف/ایجاد نمی‌شود (S3)، تطبیق فقط با `cd` (S4)، فقط admin/chairman (S5).

### ۱.۴ کاری که کارفرما باید انجام دهد

1. پس از دیپلوی v34.38.9، روی هر دستگاه یک بار **تنظیمات → 🗄 بک‌آپ فوری** بزنید. از این لحظه بک‌آپ‌های سرور دوباره مشتری‌دار می‌شوند و دکمهٔ بازیابی منبع خواهد داشت.
2. اگر بک‌آپ‌های فعلی سرور همگی در دورهٔ باگ گرفته شده باشند، اسکن این را صریح می‌گوید («این فایل اصلاً کلید مشتریان را ندارد»). در همان مودال، هر **فایل بک‌آپ قدیمیِ دانلودشده** روی رایانه را می‌توان به‌عنوان منبع اضافه کرد.
3. فایل‌های `suspect-*.json.gz` روی سرور را نگه دارید — تحلیل بالا نشان می‌دهد اینها احتمالاً آخرین تصویرهای *پیش از* کوری بک‌آپ هستند و ابزار خودش آنها را هم اسکن می‌کند.

---

## ۲. بخش دوم — آیا ریشهٔ حذف/گم‌شدن تماس بسته شده است؟

### ۲.۱ مسیر نوشتن: بله، بسته است

| حلقه | وضعیت در v34.38.9 | قفل |
|---|---|---|
| روتر collection-diff: هر `cd` غایب از خواندنِ کهنه → `entity_delete` واقعی | **بسته** — `AUTO_NO_DELETE_REASONS` اکنون ۲۴ reason دارد (شامل `lead-convert`, `ai-bizcard`, `ai-letterhead`, `ai-buyer`, `coen-fill`, `contact-mig`, `site-approve`, `site-merge`, `supspec*`) و رکوردهای غایب با `mergedKeep` برمی‌گردند | tester604 ۱.۲–۱.۴ |
| سرور `entity_upsert` = replace | **بسته** — merge semantics از v34.8.34؛ کلید غایب یعنی «تغییر نکرده» | — |
| پاک‌سازی آرایه‌های تودرتو (`people[].tels/mobs/mails`) در sanitize سرور | **بسته** — v34.29.7 | — |
| `saveCust2/saveSup2` با `phones=[]` / `coTels` تک‌خطی | **بسته** — v34.37.7 + `ptfMergeExtraCoTels` | tester611 |
| `phonefmt.migrateOnce` بازنویسی کل دفتر از خواندن کهنه | **بسته** — `skipEmptyOrTruncated` | tester604 |
| `cbCollect` شخص بی‌نامِ دارای شماره را دور می‌ریخت | **بسته** — `cbPersonHasContact` | tester604 |
| stub خالیِ `rfq-cust-heal` که `people:[]` می‌فرستاد | **بسته** — v34.38.7؛ کلید تهی وارد payload نمی‌شود | tester614 |
| `retryWithFreshCode` که در برخورد 409 «مشتری روحِ بدون تماس» می‌ساخت | **بسته** — v34.38.7 `NO_RECREATE_ON_CONFLICT_REASONS` + `dropLocalShadowStub` | tester614 |
| `migrateContacts` که برای رکورد بدون `con/ph` هم `people:[]` می‌ساخت | **بسته** — v34.38.7 + گارد truncation + عبور از روتر با `reason:'contact-mig'` | tester613/614 |
| dedup-by-phone سایت با ارقام فارسی | **بسته** — `ptfToEnDigits` پیش از `/\D/g` در `bridge.js` | tester614 |
| حقوقی→حقیقی که `people/coTels` را صفر می‌کرد | **بسته** — `ptfPreserveLegalContactsAsPhones` (v34.38.6) | tester611 |

**جمع‌بندی:** هیچ مسیر شناخته‌شده‌ای که *در نوشتن* تماس مشتری را پاک کند باز نمانده است. حذف واقعیِ عمدی کاربر (تک‌به‌تک، و `custmerge` با `allowDeletes:true` صریح) عمداً سالم مانده است.

### ۲.۲ اما تور نجات باز بود — و همین در این نسخه بسته شد

بستن مسیر نوشتن، «۱۰۰٪ هرگز» نیست؛ سیستم به یک بک‌آپ سالم به‌عنوان لایهٔ دوم نیاز دارد. تحلیل بالا نشان داد آن لایه از زمان فاز B **وجود نداشت**: بک‌آپ‌های سرور مشتری نداشتند، دلتا بک‌آپ پایه را می‌شست، و چرخش بک‌آپ به‌احتمال زیاد ماه‌ها در حالت قرنطینه گیر کرده بود — همه بدون یک پیام خطا. با v34.38.9:

- بک‌آپ دوباره کامل است (تست ۱.۴/۱.۵ tester616)؛
- بک‌آپ ناقص **ارسال نمی‌شود** و در audit ثبت می‌گردد (سپر پوشش، تست ۳.۲)؛
- در پنجرهٔ آب‌رسانی آینه بک‌آپ به تعویق می‌افتد (تست ۳.۰/۳.۱)؛
- دلتا هرگز کلید را با `null` نمی‌شوید (تست ۲.۱).

### ۲.۳ نکات باز (اولویت پایین، برای نسخهٔ بعد)

| # | مورد | شدت | توضیح |
|---|---|---|---|
| O1 | `list_backups` در `api/crm.php` فقط `verify_request()` دارد و `role_guard('users_write')` ندارد (برخلاف `get_backup`) | P3 | فقط فهرست نام/اندازه/تاریخ لو می‌رود؛ محتوا امن است. تغییرش می‌تواند جعبهٔ بک‌آپِ تنظیمات را برای نقش‌های غیرادمین بشکند، پس عمداً در این نسخه لمس نشد. |
| O2 | نگه‌داشت بک‌آپ کوتاه است: `hourly-latest` (۱)، `daily-*` (۳ روز)، `weekly-latest` (۱)، `monthly-latest` (۱) | P2 | پنجرهٔ بازیابی عملاً ~۱ ماه است. پیشنهاد: `daily` را به ۱۴ و `monthly` را به ۳ نسخهٔ چرخشی برسانیم. |
| O3 | `doRestore` مستقیم روی localStorage می‌نویسد (نه آینه) ولی بلافاصله `data_push` با `restore:true` و `location.reload()` می‌زند | P3 | عملاً درست کار می‌کند؛ فقط از نظر معماری بهتر است از همان لایهٔ آینه بگذرد. |
| O4 | هیچ پایش «سلامت بک‌آپ» در داشبورد نیست | P2 | با `ptfBackupCoverageGap` حالا شمارش کلیدهای حیاتیِ هر بک‌آپ ارزان است؛ یک نشانگر در تنظیمات جلوی تکرار «کوری بی‌صدا» را می‌گیرد. |

---

## ۳. شواهد کیفیت‌بخشی

- `_tools/uat/tester616-v34.38.9-backup-blindspot-and-partial-recovery.js` — بوت واقعی `crm/backup.js` و `crm/restore-contacts.js` در vm با آینهٔ فاز B شبیه‌سازی‌شده.
- `_tools/uat/tester615-v34.38.8-contact-recovery-oneclick.js` — قرارداد قبلی ماژول بازیابی، همچنان سبز (بازیابی فیلد-به-فیلد سازگار با عقب است).
- زنجیرهٔ رگرسیون تماس (`tester604`, `tester611`, `tester613`, `tester614`) دست‌نخورده و در گیت.
- `run-ci-gate.js` با ثبت tester616.
