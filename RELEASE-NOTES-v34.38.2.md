# یادداشت انتشار — v34.38.2

**تاریخ:** ۲۰۲۶-۰۹-۰۷ (۱۴۰۵/۰۶/۱۶) · **پایه:** v34.38.1
**گیت CI:** tester609 (قفل COST-SUM + COST-RESURRECTION) + سوئیت کامل گیت (223 PASS / 0 FAIL)

---

## ① جمع کل هزینه‌های مستقیم پرونده فروش از منبع واحد (COST-SUM)

- **ریشه:** سه جمع ناهمسان عددهای متفاوتی می‌ساختند — نوار مالی پرونده فقط `costEvents` را خام جمع می‌زد (بی‌خبر از هزینه‌های زندهٔ تنخواه)، `dealTotalCosts` منابع دیگر را هم می‌گرفت، و هوک سود خرید/مقایسه با `Math.max(dealCosts, archCosts)` عملاً یکی از دو منبع را دور می‌انداخت؛ هیچ‌کدام advance/پیش‌پرداخت را رد نمی‌کرد و تکرار هم‌کد (cd) در برخی مسیرها دو بار شمرده می‌شد.
- **اصلاح (`crm/finance-write-guard.js`):** منبع واحد خواندن/جمع — `ptfDealVisibleCosts` (لیست قابل‌نمایش)، `ptfDealCostSumIRR` (جمع پرونده)، `ptfCostListSumIRR` (جمع تک‌لیستی/آرشیو). هر سه هزینهٔ حذف‌شده (`_costTomb`) را رد می‌کنند، پیش‌پرداخت/advance را نمی‌شمارند و بر اساس cd ددوب می‌کنند.
- **نقاط مصرف یکسان‌سازی شد:** نوار مالی پرونده و فهرست عملیات کشو (`crm/salesfiles.js`) از `ptfDealCostSumIRR` / `ptfDealVisibleCosts` می‌خوانند؛ هوک سود (`crm/buycompare.js`) جمع می‌کند (نه `Math.max`) — سمت پروندهٔ زنده از `ptfDealCostSumIRR` و سمت آرشیو از `ptfCostListSumIRR`؛ `dealTotalCosts` در هر دو `crm/finance-helpers.js` و `crm/finance-core.js` هم‌قاعده شد (tombstone + حذف advance + ددوب cd).

## ② هزینهٔ حذف‌شده (به‌ویژه لینک‌شده به تنخواه) دیگر با رفرش برنمی‌گردد (COST-RESURRECTION)

- **ریشه:** سنگ‌قبر `_costTomb` (v34.29.8) فقط در مسیر merge اعمال می‌شد؛ پروجکشن زندهٔ تنخواه در کشوی پرونده و مسیر «جایگزینی مستقیم» pull (`wr(k, newStr)`) آن را نمی‌دیدند. پس هزینه‌ای که حذف شده بود، از روی نسخهٔ کهنهٔ سرور (یا پروجکشن تنخواه با `dealRef` کهنه) دوباره ظاهر می‌شد.
- **اصلاح:**
  - `crm/salesfiles.js`: پروجکشن زندهٔ تنخواه حالا اگر `_costTomb` روی cd تنخواه بنشیند، آن را بازسازی نمی‌کند.
  - `crm/sync.js`: pull مستقیم `ptf_crm_deals` قبل از `wr`، اجتماع `_costTomb` محلی/سروری را از طریق `ptfDealsApplyCostTombstones` روی `costEvents` سرور اعمال می‌کند؛ نسخهٔ کهنهٔ سرور دیگر حذف‌شده را برنمی‌گرداند (الگوی قفل‌شدهٔ tester538 حفظ شد).
  - `crm/salesfiles.js`: جاروب تعمیر `ptfDealCostRepairSweep` نسخه‌دار شد (`cost_repair_v1` با `v:2`) تا برگشته‌های پیشینِ هر دستگاه یک‌بار پاک شوند و گارد skip واقعاً کار کند.

---

## ③ فایل‌های تغییر یافته

- `crm/finance-write-guard.js`: چهار منبع واحد — `ptfDealVisibleCosts` / `ptfDealCostSumIRR` / `ptfCostListSumIRR` / `ptfDealsApplyCostTombstones`.
- `crm/salesfiles.js`: نوار مالی + فهرست عملیات از منبع واحد + گارد `_costTomb` در پروجکشن تنخواه + جاروب نسخه‌دار `cost_repair_v1` (v:2).
- `crm/sync.js`: اعمال `_costTomb` سروری قبل از `wr` در pull مستقیم `ptf_crm_deals`.
- `crm/buycompare.js`: هوک سود از `Math.max` به جمع با ددوب و احترام به tombstone.
- `crm/finance-helpers.js`, `crm/finance-core.js`: هم‌قاعده‌سازی `dealTotalCosts` (tombstone + advance + ددوب cd).
- `_tools/uat/tester609-v34.38.2-cost-sum-and-resurrection.js`: تستر قفل (جدید) + ثبت در `run-ci-gate.js`.
- `VERSION.json`, `crm/sw.js`, `crm/manifest.json`, `crm/clear-cache.html`, `crm/shell.js`, `crm/cms.js`, `crm/index.html`, `api/sales-domain.php`, `supplier/index.html`: ارتقای هماهنگ نسخه به `v34.38.2`.
