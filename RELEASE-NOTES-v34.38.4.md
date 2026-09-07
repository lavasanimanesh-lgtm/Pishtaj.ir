# یادداشت انتشار — v34.38.4

**تاریخ:** ۲۰۲۶-۰۹-۰۷ (۱۴۰۵/۰۶/۱۶) · **پایه:** v34.38.3
**گیت CI:** tester611 (قفل CONTACT-WIPE-EXT) + tester604 (ضد رگرسیون زنجیرهٔ اصلی) + سوئیت کامل گیت

---

## ① «حوزهٔ کاری مشتری هم پاک می‌شود» — مسدودسازی کامل مسیرهای حذفِ خواندنِ کهنه

- **ریشه (همان خانوادهٔ CONTACT-WIPE، حلقهٔ ①):** روتر `ptfEntitySaveCollection` برای هر `cd` غایب از `nextArr` نسبت به `base` یک `entity_delete` واقعی صادر می‌کند. سپر انبوه فقط «حذفِ >۳» و «فهرستِ تهی‌شده» را می‌گیرد؛ یک حذفِ تک‌رکوردی (امضای «یک cd غایب از خواندن کهنه») از زیر آن عبور می‌کرد. نویسندگانِ کل‌دفتر که هیچ قصد حذفی ندارند ولی `reason` آن‌ها در `AUTO_NO_DELETE_REASONS` نبود، این حفره را باز نگه داشته بودند — و پس از حذف، `ptfHealMissingCustomersFromRfqs` مشتری را به‌صورت stub بازسازی می‌کرد که حوزهٔ کاری (`ind`) را نداشت → «حوزهٔ کاری مشتری پاک شد».
- **اصلاح:**
  - `crm/sales-domain-v2.js`: فهرست `AUTO_NO_DELETE_REASONS` با reasonهای کل‌دفترِ بدون قصد حذف تکمیل شد: `lead-convert`, `ai-bizcard`, `ai-letterhead`, `ai-buyer`, `coen-fill` (مشتریان) و `site-approve`, `site-merge`, `cheque-origin`, `supspec`, `supspec-migrate`, `supspec-learn` (تامین‌کنندگان). حالا `cd` غایبِ این مسیرها `mergedKeep` برمی‌گرداند و فقط upsert صادر می‌شود — همان قرارداد `offer-cust`/`offer-sup`/`phonefmt-mig`.
  - `crm/offers.js`: `ptfHealMissingCustomersFromRfqs` حوزهٔ کاری را از حوزهٔ درخواست (`ca`/`category` با نگاشت site-parity) بازسازی می‌کند: پایپینگ/شیرآلات/برق/ابزار دقیق → «نفت و گاز»، سایر → «سایر». رابط/شماره مثل قبل حفظ می‌شود.
  - `crm/custmerge.js`: حذفِ عمدیِ تک‌رکوردی ادغام با `allowDeletes: true` صریح شد (در فهرست AUTO نیست و تصادفاً هم وارد آن نمی‌شود).

## ② چرا حوزهٔ کاری (ind) جدا از تماس‌ها پاک می‌شد

- فیلد `ind` فقط در فرم مشتری (`nC2Ind`) و stubهای `rfqSiteEnsureCustomer`/AI ثبت می‌شود؛ stub بازسازیِ heal هیچ `ind` نداشت. وقتی حلقهٔ ① رکورد واقعی را حذف می‌کرد، heal مشتری را بدون `ind` برمی‌گرداند و «حوزهٔ کاری» در UI/خروجی خالی می‌ماند. بستن مسیر حذف (①) به‌تنهایی جلوی پاک‌شدن رکورد را می‌گیرد؛ بازسازی `ind` (②) باعث می‌شود حتی مشتریِ heal‌شدهٔ قدیمی هم حوزهٔ درست بگیرد.

---

## ③ فایل‌های تغییر یافته

- `crm/sales-domain-v2.js`: تکمیل `AUTO_NO_DELETE_REASONS` (11 reason جدید کل‌دفتر).
- `crm/offers.js`: بازسازی `ind` در `ptfHealMissingCustomersFromRfqs`.
- `crm/custmerge.js`: `allowDeletes: true` صریح برای حذف ادغام.
- `_tools/uat/tester611-v34.38.4-contact-wipe-ind-heal.js`: تستر قفل (جدید) + ثبت در `run-ci-gate.js`.
- `_tools/uat/run-ci-gate.js`: ثبت tester611 + افزودن `crm/custmerge.js` به فهرست SYNTAX.
- `VERSION.json`, `crm/sw.js`, `crm/manifest.json`, `crm/clear-cache.html`, `crm/shell.js`, `crm/cms.js`, `crm/index.html`, `api/sales-domain.php`, `supplier/index.html`: ارتقای هماهنگ نسخه به `v34.38.4`.
