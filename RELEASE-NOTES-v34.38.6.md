# یادداشت انتشار v34.38.6 — NTF-LIFECYCLE + CONTACT-WIPE R2–R4 + OPEX-DUP-GUARD

**تاریخ:** 2026-09-08
**بازوی تغییر:** Arena Agent
**کانال:** CRM (اعلان‌ها / داده / مالی)

## دستور کارفرما
> «حالا تمام اصلاحات را روی یافته‌هایی که الان یا درقبل داشتی انجام بده.»

اعمال کامل یافته‌های RCAهای قبلی — بدون هیچ تغییری خارج از قرارداد پروژه (بامپ نسخه + RELEASE-NOTES + تستر قفل در `run-ci-gate`).

---

## ۱. نوتیفیکیشن (از `ARENA-NOTIFICATIONS-RESURRECTION-RCA-2026-09-08.md`)

### ۱.۱ نشانهٔ ۳ — پروندهٔ تسویه‌شده دیگر هشدار «تحویل تعهدی» نمی‌گیرد (P1، باگ قطعی)
- `crm/salesfiles.js` · `ptfSfDueState`: گارد چرخهٔ عمر `sfStageOf(r) >= 11` (تسویه‌شده/مختومه یا بایگانی) علاوه بر `st==='archived'`. پروندهٔ تسویه‌شده‌ای که هنوز بایگانی نشده (مرحلهٔ ۱۱، رکوردش هنوز در `ptf_crm_deals`) دیگر بج قرمز/نارنجی تحویل نمی‌گیرد.
- `crm/salesfiles.js` · `sfArchive`: هنگام مختومه/بایگانی، `ntfResolveByRef(r.cd)` صدا می‌زند — کارت‌های `deal-due` / `qc-ncr` / `delivery-next` برای **همهٔ** گیرندگان بسته می‌شوند.

### ۱.۲ نشانهٔ ۱ و ۲ — کارت‌های بدون گارد حل، بسته می‌شوند (P2)
- `crm/rbac.js`: تابع جدید `ntfResolveByDkey(dkey)` + helper `ntfCommitRemoval`.
- `crm/bridge.js` · `checkRfqDue` / `checkDealDue`: وقتی پنجرهٔ هشدار بسته شد (درخواست پاسخ/بسته شد، پرونده تسویه/بایگانی/تعهد حذف شد)، کارت `rfq-due-…`/`deal-due-…` با `ntfResolveByDkey` برای همه حذف می‌شود — نه‌فقط بایگانیِ صریح.
- `crm/leads.js` · `remSnooze`: تعویق، کارت `rem-due` قبلی (با تاریخ قدیم) را می‌بندد تا دوباره‌آمدنِ سررسید کارتِ تازه با readBy خالی نسازد.

### ۱.۳ حذف انبوه اعلان دیگر به union-key برنمی‌خورد (ریشهٔ «رفرش برمی‌گردد»)
- `crm/rbac.js`: `ptfPruneStaleNotifs` / `ntfResolveByRef` / `ntfResolveByDkey` حذف را از مسیر **فرمان تک‌رکوردی `ptfEntityDelete`** می‌برند، نه SaveCollection کل مجموعه. ریشهٔ مشکل: حذفِ >۴۰ در روتر `legacyFallback('too-many-ops')` می‌شد و چون `ptf_crm_notifs` یک union-key است، legacy-push فقط union می‌کرد و هیچ‌چیز روی سرور حذف نمی‌شد — کارت‌ها با رفرش برمی‌گشتند.

---

## ۲. تماس (از `ARENA-CONTACT-WIPE-CUSTOMER-CONTACT-INFO-RCA-2026-09-07.md`)

### R2 (P3) — مهاجرت دفترچه تماس
- `crm/offers.js` · `migrateContacts`: گارد truncation (آرایهٔ خالی/کوتاه‌تر از `_ptfEntityLastKnown` بازنویسی نمی‌شود) + عبور از روتر با reason `contact-mig`.
- `crm/sales-domain-v2.js`: `contact-mig` به `AUTO_NO_DELETE_REASONS` اضافه شد (بدون قصد حذف).

### R3 (P3) — تبدیل حقوقی→حقیقی دیگر تماس را پاک نمی‌کند
- `crm/offers.js`: تابع `ptfPreserveLegalContactsAsPhones` — هنگام toggle نوع به «حقیقی»، تلفن‌خانه (`coTels`) و اشخاص رابطِ رکورد قبلی به `phones` منتقل می‌شوند (با dedup بر شمارهٔ نرمال‌شده). در `saveCust2` و `saveSup2` اعمال شد.

### R4 (P3) — fallback هوک phonefmt — عمداً به تعویق افتاد
- در RCA «اختیاری/کم‌ریسک» بود و اصلاحِ پیشنهادی‌اش (عبور از روتر با reason `phonefmt`) با قراردادِ **قفل‌شدهٔ** `tester604` (هوک باید تک‌رکوردیِ `ptfEntityUpsert` باشد و `ptfEntitySaveCollection` در آن ممنوع است) می‌خواند. چون مسیر اصلی همواره تک‌رکوردی است و fallback فقط در هارنسِ legacyِ بدون فرمان اجرا می‌شود (جایی که سروری برای خراب‌شدن نیست)، این مورد بدون شکستن قرارداد رگرسیون اعمال نشد و به‌عنوان آیتم آینده در صورت تغییر قرارداد باقی ماند.

---

## ۳. هزینه (از `ARENA-OPEX-RECURRING-SALARY-DOUBLE-COUNT-ASSESSMENT-2026-09-07.md`)

### گام ۰ — آشکارساز read-only (صفر تغییر داده)
- `crm/opex.js` · `window.ptfOpexSuspectedDuplicates(month)`: ردیفِ دستی در کنار تکرارشونده/حقوقِ هم‌دسته+هم‌مبلغ+هم‌ماه؛ قالب‌های تکراری (هم cat+amt+desc)؛ هزینهٔ جاری و خروج تنخواهِ هم‌مبلغ. فقط گزارش می‌دهد.
- `crm/data-quality.js`: خروجی در تب کیفیت داده به‌عنوان «هزینه جاری مشکوک به دوباره‌شماری» نمایش داده می‌شود (با راهنمای تعیین‌تکلیف دستی).

### گام ۱ — هشدار نرم در ثبت دستی
- `crm/opex.js` · `ptfOpexAdd`: اگر برای همان ماه ردیفِ فعالِ هم‌دسته+هم‌مبلغ با `recurringKey`/`tplId` هست، `confirm` می‌گیرد (بدون بلوک داده — دو هزینهٔ واقعاً مجزا مجاز است).

### گام ۲ — هشدار نرم در قالب تکراری
- `crm/opex.js`: `opexTplDuplicateActive` + `confirm` هنگام ساخت قالب جدید و هنگام ویرایش قالب به مقداری که قالبِ فعالِ دیگری را تکرار کند.

> گام ۳ (ارجاع petty↔opex) و گام ۴ (ددوب در جمع) طبق خودِ ارزیابی، **پس از پاکسازی دستی داده‌های تاریخی** اعمال می‌شوند؛ فعلاً مستند و در انتظار تعیین‌تکلیف انسان هستند (تغییر جمع سود بدون آن پاکسازی، دادهٔ مالی تاریخی را بی‌صدا تغییر می‌دهد).

---

## تست قفل‌شده
- `_tools/uat/tester613-v34.38.6-ntf-lifecycle-and-findings.js` — **32 PASS / 0 FAIL**
  ۱) گارد تسویه در `ptfSfDueState` (رفتاری) + resolve در `sfArchive`.
  ۲) `ntfResolveByDkey` در `checkRfqDue`/`checkDealDue` + `remSnooze`.
  ۳) حذف انبوه (>۴۰) از مسیر فرمان تک‌رکوردی، بدون SaveCollection/union-key (رفتاری).
  ۴) گارد truncation + `contact-mig` + انتقال تماس حقوقی→حقیقی (رفتاری) + fallback phonefmt.
  ۵) آشکارساز دوباره‌شماری + هشدارهای نرم (رفتاری).
  ۶) نسخه (VERSION.json / UI / sw / SD_SERVICE_VERSION) و ثبت در گیت.
