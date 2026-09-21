# RCA — v34.39.20 (RESTORE-TOMBSTONE-REKILL) — ناپدید شدن کامل پرونده پس از «به جریان انداختن» از بایگانی

**تاریخ:** ۲۰۲۶-۰۹-۲۱ | **شدت:** بحرانی (حذف بی‌صدای داده) | **وضعیت:** ریشه‌کنی + قفل قرارداد با `tester674-v34.39.20-restore-tombstone-rekill.js` (۳۳ سنجه، از قرمز به سبز)

---

## ۱) گزارش کارفرما (دقیقاً مطابق شکایت)

> پرونده‌ای را بایگانی کردم؛ بعداً آن را به جریان انداختم و پرونده به «پرونده‌های فروش» منتقل شد. اما **بعد از مدتی** پیشنهاد آن پرونده به‌عنوان «پیشنهاد بدون پرونده» نمایش داده شد و دیدم **کلاً پرونده از داده‌ها پاک شده** است.

علامت‌های قطعی: `orphan_won` فقط وقتی گزارش می‌شود که هم `casesForOffer` و هم `archivedCaseForOffer` خالی باشند (sales-domain-v2.js) — یعنی پرونده از **هر دو** مجموعهٔ `ptf_crm_deals` و `ptf_crm_projects` محو شده بود.

## ۲) ریشهٔ قطعی (زنجیرهٔ مرگ — با اجرای کد واقعی + پورت وفادار `sync_apply_tombstones` سرور اثبات شد)

**بذر باگ (بایگانی):** `sfArchive` از روتر فرمان `entity_delete('ptf_crm_deals', dealCd)` می‌گذرد؛ سرور (api/sales-domain.php) یک **سنگ‌قبر فعال** در `ptf_crm_deleted_archive` می‌نویسد:

```php
['_id'=>sd_uuid('DEL'), 'kind'=>'archive_purge', 'collection'=>'ptf_crm_deals', 'id'=>$id, 'cd'=>$id,
 'aliases'=>[$id], 'identities'=>['ptf_crm_deals'=>[$id]], 'deletedAt'=>sd_now()]
```

**گام‌های مرگ (به جریان انداختن):**

1. **بازگشت بدون تاریخ ساخت قابل‌اثبات.** `ptfSalesfileRestoreFromArchive` رکورد فروش را فقط با `t`/`restoredAt` **فارسی** (`faDateTime()`) می‌ساخت. `sync_row_created_epoch` فقط ISO می‌خواند ⇒ `createdEpoch=0` ⇒ `sync_tombstone_outranks_row` همیشه `true` — رکورد در برابر هر سنگ‌قبری **بازندهٔ مطلق** است.
2. **خنثی‌سازی سنگ‌قبر هرگز به سرور نمی‌رسید.** `sfNeutralizeDealTombstones` محلی `kind` را به `restored:…` تغییر می‌داد و کل آرشیو را از روتر `ptfEntitySaveCollection` ذخیره می‌کرد؛ اما دیف روتر با `cd` هویت‌یابی می‌کرد (بدون `cd` ⇒ `legacyFallback('records-without-cd')`) در حالی که `idField` سرور برای آرشیو حذف `_id` است. آرشیو حذف واقعی همیشه ردیف‌های کهنهٔ **بی‌cd** دارد (سازندگان `offers.js`، `guards.js`، `listclean.js`، `letters.js`، `custmerge.js` …) ⇒ **هر** ذخیرهٔ آرشیو به `setData` محلی تنزل می‌یافت؛ فرمان خنثی‌سازی سمت سرور هم اصلاً وجود نداشت ⇒ **سنگ‌قبر T1 برای همیشه روی سرور فعال می‌ماند.**
3. **ضربهٔ نهایی با اولین `data_push` توده‌ای.** با `failDirty` پس از upsert ناموفق (آفلاین/۴۰۱/۴۰۹ expectCreate — یا هر legacyFallback دیگر)، کلید `ptf_crm_deals` با ردیفِ **بدون createdAt** dirty می‌شود. `data_push` روی payload با `sync_apply_tombstones($k,$v,$serverArchiveJson,…)` (سنگ‌قبر فعال T1) همان ردیف را **قبل از نوشتن** می‌تراشد و `sync_key_write` آرایهٔ کشتارشده را می‌نویسد — **حذف قطعی از سرور**. پاسخ همان push/pull بعدی، نسخهٔ محلی را هم جایگزین می‌کند — **پرونده از هر دو سو محو می‌شود؛ هیچ رد حذف تازه‌ای نمی‌ماند** (چون رکورد بایگانی هم در گام بازگشت حذف شده) ⇒ «کلاً پاک شده» + `orphan_won` = «پیشنهاد بدون پرونده».
   - *«بعد از مدتی»* = تا اولین چرخهٔ dirty بعدی (ثانیه‌ها تا روزها بعد — upsert معطل صف/کلیک بعدی/بوت بعدی).
   - مسیر دوم مرگ: `pull` بوت (`sync_apply_tombstones` با T1 فعال) روی هر ردیفِ محلی/سروری بدون تاریخ ساخت.
4. **ردّ حذف هم سوخته می‌شد (بی‌اثر شدن حذف).** فیلتر alias آرشیو حذف (`strpos` زیررشته‌ای) در **هر دو** `api/crm.php` و `crm/sync.js` به‌جای «پاک‌سازی گراف» (سنگ‌قبر بدون `collection` — قرارداد v34.37.0 ③)، alias سنگ‌قبرهای **تک‌رکوردی** (خود T1 با `aliases:['DEAL-1']`) را هم جمع می‌کرد و هر ردیف حاوی کد را می‌سوخت: ردیف `recycle` (سطل بازیافت!)، ردیف `restored:` (خنثی‌شده) و ردیف‌های کهنه — در همان push اول. نتیجه: نه deal، نه tombstone خنثی‌شده، نه recycle؛ حذف کامل بی‌اثر + نابودی سطل بازیافت.
5. **تقویت‌کننده (جاروی یکتایی):** `ptfSalesfileUniquenessSweep` هر deal منطبق با رکورد بایگانیِ دوقلو را حذف قطعی می‌کرد. با رستاخیز رکورد بایگانی از دستگاه stale (push کهنه)، پروندهٔ به‌جریان‌افتاده برای همیشه می‌مرد.
6. **پیوند پیشنهاد (نمایش «بدون پرونده»):** restore فقط `wonOffer`/`offerNo` می‌نوشت (برخلاف `sfArchive` که `offerNos`/`linkedOffers`/`rootOfferId` را نگه می‌دارد) و `caseBelongsToOffer` فقط `wonOffer/offerNo/rootOfferId` را می‌دید ⇒ برای آرشیوهای قدیمی با `wonOffer` خالی، `orphan_won` کاذب.

## ۳) رفع ریشه‌ای (v34.39.20)

| # | رفع | فایل |
|---|-----|------|
| ① | فرمان اتمیک سروری **`entity_tombstones_neutralize`** — قرینهٔ گام ② `entity_restore` (kind→`restored:<kind>` + `restoredAt` + identities/aliases/id) | `api/sales-domain.php` |
| ② | `sfNeutralizeDealTombstones`: خنثی‌سازی **سطری per-row روی `_id`** (مستقل از diff روتر) + ارسال فرمان سروری + fallback dirty در شکست | `crm/salesfiles.js` |
| ③ | رکورد به‌جریان‌افتاده **`createdAt`/`createdAtISO`/`updatedAt` ISO** می‌گیرد (هم‌سان `sd_now()` سرور) — گارد تاریخ حتی در برابر سنگ‌قبر خنثی‌نشده نجاتش می‌دهد | `crm/salesfiles.js` |
| ④ | diff روتر برای `ptf_crm_deleted_archive` با کلید **`_id` (fallback cd/id)** + تخصیص `_id` به ردیف‌های هویت‌دارِ بدون `_id` | `crm/sales-domain-v2.js` |
| ⑤ | جاروی یکتایی: deal دارای `restoredFrom` منطبق با رکورد بایگانی **زنده می‌ماند** و رکورد بایگانی زامبی حذف می‌شود (`removedArchived`) — رفتار قبلی (قرارداد U3) فقط برای دوقلوهای بدون `restoredFrom` | `crm/salesfiles.js` |
| ⑥ | `restore` فهرست `offerNos`/`linkedOffers`/`rootOfferId` را حمل می‌کند و `caseBelongsToOffer` به `offerNos` هم نگاه می‌کند | `crm/salesfiles.js` + `crm/sales-domain-v2.js` |
| ⑦ | فیلتر alias آرشیو حذف **فقط برای پاک‌سازی گراف** (`archive_purge` بدون `collection`) + نگهبان صریح `restored:`/`recycle`/خود سنگ‌قبرها — در هر دو سمت سرور و کلاینت (هم‌راستا با قرارداد v34.37.0 ③) | `api/crm.php` + `crm/sync.js` |

## ۴) قراردادهای قفل‌شده (tester674 — ۳۳ سنجه)

- **R1)** رکورد «به جریان افتاده» createdAt/createdAtISO قابل‌اثبات دارد.
- **R2)** خنثی‌سازی = فرمان سروری `entity_tombstones_neutralize` + ذخیرهٔ سطری روی `_id`.
- **R3)** push/pull پس از بازگشت (حتی با upsert ناموفق) پرونده را نمی‌کشد — در هر دو مجموعه می‌ماند (سناریوی B1 = بازتولید دقیق باگ گزارش‌شده).
- **R4)** جارو در برخورد با رکورد بایگانی زامبی از پروندهٔ دارای `restoredFrom` محافظت می‌کند؛ قرارداد قبلی U3 برای بدون-`restoredFrom` حفظ است.
- **R5)** پیوند پیشنهاد↔پرونده با `offerNos` برقرار است؛ «پیشنهاد بدون پرونده» کاذب ممنوع.
- **R6)** فیلتر alias فقط پاک‌سازی گراف بدون `collection`؛ `restored:`/`recycle` نمی‌سوزند (هر دو سمت).
- گارد تاریخ‌نگاری (بدون تاریخ = بازنده؛ با تاریخ ISO تازه‌تر = نجات) + پین‌های انتشار.

**وضعیت تست:** `tester674` ۳۳/۳۳ PASS (پس از رفع؛ پیش از رفع ۲۲ FAIL شامل بازتولید کامل مرگ B1/B2/B3)، `tester621` سبز، و نمونهٔ پرشمار از همسایه‌ها سبز: 517 (26/26)، 525 (26/26)، 476 (18/18)، 446، 465 (10/10)، 583 (39/39)، 588 (90/90)، 604 (45/45)، 605 (22/22)، 610 (19/19)، 619/620/623، 663 (30/30)، 673 (15/15).

## ۵) پیشنهاد ترمیم دادهٔ آسیب‌دیده (محیط عملیاتی)

پرونده‌هایی که پیش از این نسخه با این زنجیره محو شده‌اند: با ستون زمانی `audit`/`ptf_crm_sales_commands` (عملیات `sf-archive`/`sf-restore` با شمارهٔ بایگانی `ARC-…`) قابل شناسایی‌اند؛ بازگردانی از `ptf_crm_deleted_archive` (ردیف‌های `recycle` باقی‌مانده روی دستگاه‌هایی که هنوز push نشده‌اند) یا از بکاپ/نسخهٔ سرورِ پیش از `data_push` کشنده. `entity_tombstones_neutralize` برای هر بازگردانیِ دستی کافی است تا دوباره کشته نشود.
