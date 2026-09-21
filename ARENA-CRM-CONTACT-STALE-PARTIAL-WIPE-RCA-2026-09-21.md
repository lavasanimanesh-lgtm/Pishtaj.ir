# RCA — شستشوی جزئی شماره تماس مشتری بین دو کاربر (CONTACT-STALE-PARTIAL-WIPE)

**تاریخ:** 2026-09-21  
**نسخهٔ اصلاح:** v34.39.12  
**وضعیت:** اصلاح پیاده‌سازی و آزمایش واحد منطق (۵ سناریو)  
**گزارش کارفرما:**  
> «شماره تماس مشتری‌هایی که یک کاربر ثبت می‌کند برای کاربر دیگر پاک می‌شود؛  
> برای خودِ ثبت‌کننده سالم می‌ماند.»

---

## ۱. ریشه (مکانیزم دقیق)

مسیر فرمان `entity_upsert` (`api/sales-domain.php`) برای هر کلید **حاضر** در payload،
مقدار را **دربست جایگزین** می‌کند (کلید غایب = حفظ prev).  
نویسنده‌های مشتری — از مودال ویرایش (`saveCust2`) تا تک‌فیلدی‌ها
(`vendorlist` / `coen-fill` / `cheque-origin` / …) — رکورد را از **کش محلی کهنه**
(`getData` + `_cbState` زمان بازشدن مودال) می‌سازند و همیشه
`people` / `coTels` / `phones` / `ph` را در payload می‌فرستند.

گارد v34.38.25 (`CONTACT-WIPE-INVARIANT`) فقط وقتی فعال می‌شود که
**همهٔ** کلیدهای تماسیِ حاضر خالی باشند. در سناریوی واقعی payload کهنه
دست‌کم یک شمارهٔ خودِ ویرایشگر را دارد ⇒ گارد عبور می‌کند و شماره‌هایی که
کاربر دیگر **بعد از آخرین pull/بازشدن مودال** ثبت کرده از سرور حذف می‌شوند.

چون هر دستگاه از کش خودش می‌خواند:

| نقش | آنچه می‌بیند |
|---|---|
| ویرایشگرِ آخر (پاک‌کننده) | شماره‌های خودش — «برای من مانده» |
| ثبت‌کنندهٔ اول (قربانی) | پس از pull، نسخهٔ شسته‌شده — «شماره‌های من پاک شد» |

---

## ۲. زنجیرهٔ اثبات (کد HEAD پیش از اصلاح)

1. `crm/offers.js` `showCustModal` → فقط `getData`؛ بدون pull اجباری.  
2. `saveCust2` → `people=cbCollect()` از `_cbState` کهنه؛ `coTels=ptfMergeExtraCoTels(oldRecPre,…)`.  
3. `ptfEntitySaveCollection(..., {reason:'offer-cust'|'vendorlist'|…})` → کل رکورد upsert.  
4. `api/sales-domain.php` `entity_upsert` → per-key LWW، بدون base-rev.  
5. `sd_contact_wipe_guard` → سوراخ partial-wipe.  
6. `ptfSmartMerge` (مسیر legacy) → مشتریان `iso/ts/t/date` ندارند ⇒ remote همیشه برنده (بردار ثانویه، جهت مخالف).

---

## ۳. اصلاح v34.39.12 (چهار لایه)

### A. سرور — اتحاد تماس به‌جای جایگزینی wholesale
`api/sales-domain.php`:
- `sd_contact_stale_merge` پس از wipe-guard:
  - `people` = اتحاد اشخاص (کلید نام یا کانال) + اتحاد `tels/mobs/mails`
  - `coTels` / `phones` = اتحاد بر رقم نرمال‌شده (فا/ع/لاتین)
  - `ph` خالیِ حاضر، prev پر را نمی‌شوید
- اگر `_ccClear=1` ⇒ اتحاد اعمال نمی‌شود (پاک‌سازی عمدی).
- اگر `_ccBaseAt === prev.updatedAt|updatedAtISO` ⇒ مودال تازه است؛
  حذف آگاهانهٔ شخص/شماره با LWW عادی محترم است (`contactsFreshEdit`).
- آمار: `sanitize.contactsStaleMerged` / `contactsFreshEdit`.

### B. کلاینت روتر — strip کلید تماس از writerهای غیرتماسی
`crm/sales-domain-v2.js` `ptfEntitySaveCollection`:
- برای `ptf_crm_customers` / `ptf_crm_suppliers` و reasonهایی که در
  `CONTACT_TOUCH_REASONS` نیستند (`vendorlist`, `coen-fill`, `cheque-origin`,
  `supspec*`, `ai-letterhead`, `site-approve`, …):
  پیش از upsert، `people/coTels/phones/ph` از payload حذف می‌شوند.
- نتیجه: merge سرور «کلید غایب = حفظ prev» ⇒ تماس‌ها دست‌نخورده می‌مانند.
- reasonهای واقعی تماس (`offer-cust`, `offer-sup`, `site-rfq`, `lead-convert`,
  `ai-buyer`, `ai-bizcard`, `custmerge`, `contact-mig`, `phonefmt*`, …) و
  ساخت جدید (`newCds`) و `opts.touchContacts` مستثنی‌اند.

### C. کلاینت فرم — مهر نسخه + اتحاد با کش زنده
`crm/offers.js` `saveCust2` / `saveSup2`:
- `_ccEdit=1` + `_ccBaseAt` از `oldRecPre.updatedAt|updatedAtISO`
- `updatedAtISO = now` (برای SmartMerge و هر pull-with-dirty)
- اگر کش زنده از `oldRecPre` تازه‌تر باشد ⇒ `ptfMergeCustContactsFromLive`
  (هم‌سنگ منطق سرور) پیش از upsert.

### D. SmartMerge — timestamp واقعی + اتحاد تماس
`crm/sync.js` `ptfSmartMerge` شاخهٔ عمومی:
- مقایسه با `updatedAtISO/updatedAt/crAtISO/...` (نه فقط `iso/ts/t/date`)
- برای customers/suppliers: برندهٔ فیلدهای غیرتماسی = timestamp؛
  تماس‌ها = اتحاد دوطرفه (`ptfMergeCustContactsFromLive`).

---

## ۴. سناریوهای آزمایش‌شده (منطق واحد)

| # | سناریو | نتیجه |
|---|---|---|
| 1 | `vendorlist` روی کش کهنه (باگ اصلی) | `people` سرور حفظ + `venSt` به‌روز |
| 2 | `saveCust2` صنعت‌ alone با مودال کهنه (`_ccBaseAt≠server`) | اتحاد Reza را نگه می‌دارد |
| 3 | حذف آگاهانهٔ شخص با مودال تازه (`_ccBaseAt===server`) | فقط Ali می‌ماند |
| 4 | `_ccClear=1` | همهٔ تماس‌ها پاک (عمدی) |
| 5 | `ai-buyer` افزودن رابط | Buyer اضافه + Reza سرور حفظ |

---

## ۵. فایل‌های تغییر یافته

| فایل | نقش |
|---|---|
| `api/sales-domain.php` | `sd_contact_stale_merge` + helpers + فراخوانی در `entity_upsert` |
| `crm/sales-domain-v2.js` | strip کلید تماس برای reasonهای غیرتماسی |
| `crm/offers.js` | helpers ادغام + `_ccEdit/_ccBaseAt/updatedAtISO` در saveCust2/saveSup2 |
| `crm/sync.js` | SmartMerge timestamp + اتحاد تماس cust/sup |
| `crm/index.html`, `crm/manifest.json` | bump `v34.39.11` → `v34.39.12` |

---

## ۶. آنچه عمداً انجام نشد

- قفل خوش‌بینانهٔ کامل (409 روی هر base-rev mismatch) برای همهٔ entityها —
  خارج از محدودهٔ این RCA؛ `_ccBaseAt` فقط مسیر اتحاد تماس را هدایت می‌کند.
- تغییر UI مودال (pull اجباری پیش از بازشدن) — دفاع در عمق سرور/روتر کافی است؛
  می‌تواند follow-up UX باشد.
- بازنویسی writers تک‌فیلدی به patch سطح-فیلد — strip در روتر همان اثر را
  بدون دست زدن به هر caller می‌دهد.

---

## ۷. پیامد عملی برای کاربر

پس از deploy v34.39.12:

1. ویرایش وندور/نام انگلیسی/… دیگر شماره‌های همکار را پاک نمی‌کند.  
2. ویرایش مودال کهنه، شماره‌های ثبت‌شده روی سرور را با اتحاد حفظ می‌کند.  
3. حذف عمدی شخص/شماره از مودال تازه همچنان کار می‌کند.  
4. پاک‌سازی کامل تماس‌ها همچنان با خالی‌کردن همه + مهر `_ccClear` ممکن است.  
5. شماره‌های ازدست‌رفتهٔ قبلی با دکمهٔ «🛟 بازیابی تماس‌ها» قابل برگشت‌اند
   (همان ابزار v34.38.9 — فقط فیلدهای خالی را پر می‌کند).
