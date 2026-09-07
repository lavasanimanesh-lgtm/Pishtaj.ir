# یادداشت انتشار — v34.38.3

**تاریخ:** ۲۰۲۶-۰۹-۰۷ (۱۴۰۵/۰۶/۱۶) · **پایه:** v34.38.2
**گیت CI:** tester610 (قفل PRJ-COST-RESURRECTION) + سوئیت کامل گیت

---

## ① حذف هزینهٔ بایگانی دیگر با رفرش/sync برنمی‌گردد (PRJ-COST-RESURRECTION)

- **ریشه:** `prjPostCostDel` (حذف هزینهٔ گارانتی/پسابایگانی در بایگانی) فقط از آرایهٔ `postArchiveCosts`/`costEvents` همان دستگاه پاک می‌کرد و هیچ سنگ‌قبری نمی‌نوشت؛ merge بین‌دستگاهی (`ptfMergeArrayUnique` با امضای کامل-JSON) نسخهٔ کهنهٔ دستگاه دیگر را دوباره union می‌کرد و هزینهٔ حذف‌شده برمی‌گشت — همان خانوادهٔ باگ v34.38.2 برای پرونده‌های فروش.
- **اصلاح:**
  - `crm/projects.js`: `prjPostCostDel` اکنون سنگ‌قبر `pp._costTomb[costCd] = faDateTime()` می‌نویسد (cd با `genCode` یکتاست)؛ `prjAllCosts` هزینهٔ tombstoneشده را از فهرست/جمع نمایشی فیلتر می‌کند (و در نتیجه `prjCostTotal`، ویرایش و پیوست‌گذاری هم آن را نمی‌بینند).
  - `crm/sync.js`: بلوک merge جدید برای `ptf_crm_projects` — اجتماع `_costTomb` محلی/سروری + ددوب cd (نسخهٔ جدیدتر برنده) روی `costEvents` و `postArchiveCosts` (هم‌سنخ COST-EVENT-TOMB پرونده‌ها).
  - `crm/finance-write-guard.js`: `ptfProjectsApplyCostTombstones` — مسیر «جایگزینی مستقیم» pull برای پروژه‌ها، اجتماع سنگ‌قبر محلی/سروری را روی نسخهٔ سرور اعمال می‌کند (فقط همین دو فیلد دست می‌خورد؛ خطا = برگرداندن سرور).
  - `crm/sync.js`: pull مستقیم `ptf_crm_projects` پیش از `wr` از همین تابع عبور می‌کند.
  - `crm/salesfiles.js`: `sfArchive` دانش حذف هزینه (`_costTomb`) را به رکورد بایگانی منتقل می‌کند تا پروندهٔ مختومه تاریخچهٔ حذفش را خودش حمل کند.

## ② گزارش سال مالی هزینهٔ حذف‌شده/پیش‌پرداخت را نمی‌شمارد

- **ریشه:** `fiscalDirectProjectCosts` هزینه‌های مستقیم را از `costEvents`/`postArchiveCosts` خام جمع می‌کرد — هزینهٔ حذف‌شده (tombstone) باز شمرده می‌شد و پیش‌پرداخت/advance هم به‌عنوان هزینهٔ مستقیم از سود کسر می‌شد؛ ناهمسان با منبع واحد v34.38.2 (`ptfDealCostSumIRR`/`dealTotalCosts`).
- **اصلاح (`crm/fiscal.js`):** هر منبع هزینه به سنگ‌قبر خودش گره خورد (پرونده ← `deal._costTomb`، بایگانی ← `project._costTomb`)؛ پیش‌پرداخت/advance رد می‌شود؛ منطق «ضد دوباره‌شماری فاکتور خرید» (v34.5.38) دست‌نخورده ماند.

---

## ③ فایل‌های تغییر یافته

- `crm/projects.js`: سنگ‌قبر در `prjPostCostDel` + فیلتر tombstone در `prjAllCosts`.
- `crm/sync.js`: بلوک merge `ptf_crm_projects` + اعمال `ptfProjectsApplyCostTombstones` پیش از `wr` در pull.
- `crm/finance-write-guard.js`: `ptfProjectsApplyCostTombstones`.
- `crm/salesfiles.js`: انتقال `_costTomb` در `sfArchive`.
- `crm/fiscal.js`: `fiscalDirectProjectCosts` tombstone-aware + حذف advance.
- `_tools/uat/tester610-v34.38.3-prj-cost-resurrection.js`: تستر قفل (جدید) + ثبت در `run-ci-gate.js`.
- `VERSION.json`, `crm/sw.js`, `crm/manifest.json`, `crm/clear-cache.html`, `crm/shell.js`, `crm/cms.js`, `crm/index.html`, `api/sales-domain.php`, `supplier/index.html`: ارتقای هماهنگ نسخه به `v34.38.3`.
