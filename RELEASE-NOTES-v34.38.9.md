# یادداشت انتشار v34.38.9 — BACKUP-BLIND-SPOT + CONTACT-RECOVERY-PARTIAL

**تاریخ:** 2026-09-08
**بازوی تغییر:** Arena Agent
**کانال:** CRM (بک‌آپ سرور / دادهٔ تماس مشتریان)
**سند ریشه‌یابی:** `ARENA-BACKUP-BLINDSPOT-CONTACT-RECOVERY-RCA-2026-09-08.md`

## گزارش کارفرما
> «در قسمت مشتریان دکمهٔ بازیابی تماس‌ها که بازیابی اطلاعات تماس‌های گم‌شده را باید انجام دهد کار نمی‌کند. بررسی کن ببین مشکل چیه. همچنین بررسی کن ببین ریشهٔ باگ بسته شده است که دیگر هیچ تماس مشتری جدیدی حذف و گم نشود یا نه.»

## یافتهٔ اصلی — دکمه سالم بود، **منبعش خالی بود**

از فاز B (`crm/client-server.js` v34.8.9 STORAGE-INDEPENDENCE) هر کلید کسب‌وکاریِ بزرگ‌تر از ۸KB به IndexedDB منتقل و **از localStorage حذف** می‌شود (`localStorage.removeItem` داخل `window.ptfBMirror`). `getData` این را می‌داند و اول از آینه می‌خواند — ولی `crm/backup.js` همچنان مستقیماً `localStorage.getItem(k)` می‌خواند. نتیجه:

1. **`collectBackup`:** `if (v === null) return;` → `ptf_crm_customers` (و همهٔ کلیدهای سنگین دیگر) اصلاً وارد payload نمی‌شد → **هر بک‌آپ چرخشیِ سرور پس از فعال‌شدن فاز B «صفر مشتری» داشت**. `ptfContactRecoverScan` همه را رد می‌کرد و plan خالی می‌داد = «دکمه کار نمی‌کند».
2. **`ptfBackupDeltaCollect`:** همان کلید را با مقدار `null` می‌فرستاد و سرور `$ex['data'][$k] = null` می‌کرد → آخرین بک‌آپ کاملِ پایه هم مسموم می‌شد. تنها سپر ضدِ آب‌رفتنِ `ptf_rotate_backup` جلوی فاجعهٔ کامل را گرفت — با قرنطینهٔ دائمی (`suspect-*`) و توقف عملی چرخش بک‌آپ.
3. **`backupSignature`:** برای کلیدهای offloadشده همیشه مقدار ثابت می‌گرفت → بک‌آپ خودکار ساعتی می‌گفت «چیزی عوض نشده».
4. **`restore-contacts.js`:** نامزدی در سطح **رکورد** (`hasContacts`) بود، پس «شستشوی جزئی» (ph مانده ولی اشخاص رابط رفته / people بدون هیچ کانال تماس) هرگز در پیش‌نمایش نمی‌آمد.

هر چهار حلقه **در سکوت** بودند: پاسخ سرور همیشه `ok:true`.

### بازتولید با کد واقعی (vm)
```
قبل: keys in backup: ptf_crm_settings          | delta.ptf_crm_customers = null
بعد: keys in backup: ptf_crm_customers, ptf_crm_settings | delta.ptf_crm_customers = "[{...۰۹۱۲۱...}]"
```

## اصلاح‌ها

### `crm/backup.js`
- **`bkRead(k)`** تازه: **آینهٔ فاز B (`ptfBRead`) → localStorage → `getData`**. جایگزین تمام خوانش‌های جمع‌آوری در `collectBackup`، `backupSignature`، `ptfBackupDeltaCollect`، `deltaSaveSentKeys`. export: `window.ptfBackupReadKey`.
- **دلتا هرگز `null` نمی‌فرستد.** کلیدهای بی‌داده در فهرست `missing` گزارش می‌شوند. «نبودِ کلید» = «چیزی برای گفتن ندارم»، نه «پاکش کن».
- **تعویق تا آب‌رسانی آینه** (`ptfBackupMirrorPending`): در پنجرهٔ `ptfBMirrorActive() && !ptfBIdbHydrated` هیچ بک‌آپی (کامل یا دلتا) ارسال نمی‌شود.
- **سپر پوشش** (`ptfBackupCoverageGap`): اگر کلید حیاتی (`customers/suppliers/rfqs/offers/invoices`) روی دستگاه داده دارد ولی در تصویر نیست، ارسال متوقف، در audit ثبت و به کاربر گزارش می‌شود — بک‌آپ ناقص هرگز جای بک‌آپ سالم را نمی‌گیرد.

### `crm/restore-contacts.js`
- **بازیابی فیلد-به-فیلد** (`restorableEmpty`): شستشوی جزئی هم پوشش داده می‌شود. `people` با نام ولی بدون هیچ `tels/mobs/mails` = «خالی» و نسخهٔ تماس‌دارِ بک‌آپ می‌نشیند. S2 دقیقاً روی همان فیلد اعمال می‌شود (هم در `buildPlan` هم دوباره در `applyPlan`).
- **تشخیص** (`ptfContactRecoverDiagnose`): هر بک‌آپ بی‌فایده با دلیل انسانی گزارش می‌شود (`no_customers_key` / `server_error` / `unparsable` / `fetch_error`). اسکنِ بی‌نتیجه دیگر در سکوت تمام نمی‌شود.
- **منابع اضافی:** بک‌آپ اضطراری همین دستگاه (IndexedDB `ptf_backup_local`) + امکان افزودن فایل بک‌آپ دانلودشدهٔ کاربر از داخل مودال. همهٔ منابع بر اساس مهر زمان جدید→قدیم مرتب می‌شوند.
- **`maxOps`** به روتر پاس داده می‌شود: سقف پیش‌فرض ۴۰ عملیات باعث می‌شد بازیابی انبوه — یعنی دقیقاً سناریوی این حادثه — بی‌صدا به مسیر legacy تنزل کند.

### `crm/golive.js`
- بک‌آپ pre-golive هم از `ptfBackupReadKey` می‌خواند (baseline نگهبان معماری با همان یک تخلفِ از پیش پذیرفته‌شده به‌روز شد — بدون افزایش بدهی).

## سپرهای v34.38.8 دست‌نخورده
S1 فقط `CONTACT_FIELDS` · S2 عدم بازنویسی مقدار سالم · S3 بدون حذف/ایجاد (تعداد رکورد ثابت) · S4 تطبیق فقط با `cd` · S5 فقط `admin/chairman` · ذخیره با `reason: 'offer-cust'` از روتر merge-safe.

## پاسخ به پرسش دوم — آیا ریشهٔ حذف تماس بسته است؟
**مسیر نوشتن: بله.** ده حلقهٔ شناخته‌شده (روتر collection-diff + `AUTO_NO_DELETE_REASONS` ۲۴تایی، merge سرور، sanitize آرایه‌های تودرتو، `saveCust2/saveSup2`، `phonefmt.migrateOnce`، `cbCollect`، stub خالیِ heal، `retryWithFreshCode`/مشتری روح، `migrateContacts`، dedup ارقام فارسی، حقوقی→حقیقی) همگی بسته و با tester604/611/613/614 قفل‌اند.

**اما تور نجات باز بود** و همین نسخه آن را بست: بک‌آپ سالمی وجود نداشت تا اگر دوباره چیزی گم شد برگردد. جزئیات + نکات باز (نگه‌داشت کوتاه بک‌آپ، role_guard روی `list_backups`، پایش سلامت بک‌آپ) در سند RCA.

## اقدام لازم پس از دیپلوی
1. روی هر دستگاه یک بار **تنظیمات → 🗄 بک‌آپ فوری** بزنید تا بک‌آپ سرور دوباره مشتری‌دار شود.
2. اگر همهٔ بک‌آپ‌های فعلی در دورهٔ باگ گرفته شده‌اند، اسکن صریح می‌گوید «این فایل اصلاً کلید مشتریان را ندارد» — در همان مودال فایل بک‌آپ قدیمیِ دانلودشده را به‌عنوان منبع اضافه کنید.
3. فایل‌های `suspect-*.json.gz` روی سرور را نگه دارید؛ احتمالاً آخرین تصویرهای *پیش از* کوری بک‌آپ‌اند و ابزار خودش آنها را اسکن می‌کند.

## سطح انتشار نسخه
`VERSION.json → v34.38.9`؛ `crm/index.html`؛ `crm/sw.js`؛ `crm/manifest.json`؛ `crm/clear-cache.html`؛ `crm/shell.js`؛ `crm/cms.js`؛ `api/sales-domain.php` (`SD_SERVICE_VERSION = '34.38.9'`). پین‌بندی‌های تستری (فرم ساده و فرم Regex) هم‌مهاجرت شدند؛ نام فایل تسترهای موجود دست‌نخورده.

## تست‌ها
- **قفل جدید:** `_tools/uat/tester616-v34.38.9-backup-blindspot-and-partial-recovery.js` — ۴۳ سنجه (بوت واقعی `backup.js` و `restore-contacts.js` در vm با آینهٔ فاز B شبیه‌سازی‌شده؛ پوشش هر چهار حلقه + سپرهای تازه + تشخیص + منابع دستی).
- **رگرسیون:** tester615 (۳۴/۳۴)، زنجیرهٔ tester604/611/613/614 سبز.
- **گیت کامل:** `run-ci-gate.js` → **232 PASS / 0 FAIL**.
