# بک‌لاگ اولویت‌بندی‌شدهٔ فعلی پروژه PTF

**نسخهٔ مبنا:** `v31.6.11`  
**تاریخ تهیه:** ۱۴۰۵/۰۴/۲۶ — 2026-07-17  
**هدف:** یکپارچه‌کردن backlogهای قبلی، failureهای regression، بدهی‌های فنی، US-435/436/437 و گیت Stage 0 در یک فهرست اولویت‌بندی‌شده.

> این فایل وضعیت جاری را برای برنامه‌ریزی تکمیل می‌کند. تاریخچهٔ release noteها حذف نشده است. هر موردی که قبلاً «حل‌شده» اعلام شده اما کد فعلی آن را تأیید نمی‌کند، با وضعیت `Partial / Needs verification` ثبت شده است.

## قواعد اولویت

- **P0 — بحرانی:** امنیت، تمامیت دادهٔ مالی، خرابی runtime، backup/recovery، یا خطایی که تصمیم خرید/سود را غیرقابل‌اعتماد می‌کند.
- **P1 — زیاد:** workflow اصلی فروش/تأمین/مالی، چاپ رسمی، پیوست‌ها و کیفیت داده که بهره‌برداری روزمره را مختل می‌کند.
- **P2 — متوسط:** UX، AI، parser، واژه‌نامه و بدهی‌های فنی با اثر محدودتر.
- **P3 — نگهداری تست/بسته:** assertion قدیمی، fixture یا مستندات/پکیج ناقص؛ نباید با تغییر بی‌دلیل کد محصول حل شود.

## Family 1 — امنیت و آمادگی مالی

| اولویت | شناسه | وضعیت جاری | اقدام بعدی |
|---|---|---|---|
| P0 | `FIN-WF-001 / TECHDEBT-001` | ناقص؛ token برای data push/pull هست، اما session server-side، حذف اعتماد legacy و sanitization کامل نیست | تصمیم policy و staging، سپس PoC-A/B و evidence |
| P0 | `STAGE0-POLICY-001` | تصمیم local-only/private-encrypted-sync برای چک شخصی معلق است | تصمیم رسمی کارفرما |
| P0 | `STAGE0-ENV-001` | staging جدا با دادهٔ fixture و backup فراهم نشده | subdomain/webroot مستقل |
| P0 | `FIN-WF-002` | migration و جداسازی local چک شخصی وجود دارد، اما policy و چنددستگاهی نهایی نیست | پس از انتخاب policy، تست دو دستگاه |
| P0 | `FIN-WF-003` | guard کلاینتی چک شرکتی وجود دارد؛ server/API ownership workflow کامل نیست | server-side authorization و role matrix |
| P0 | `FIN-WF-004` | guard سال مالی برای invoice، receipt، shareholder و salary در `v31.6.5` تکمیل شد؛ سایر mutationها guard قبلی دارند | UAT ماتریسی و بازبینی مسیرهای باقی‌مانده |
| P1 | `FIN-WF-006` | در hotfix بعدی `v31.6.4` هستهٔ ابطال وصولی با reversal منفی، دلیل، audit و گارد سال مالی اضافه شد | UAT مالی و بررسی گزارش مانده پس از deploy |
| P1 | `FIN-WF-007` | grouping سال مالی هنوز به parser محدود تاریخ وابسته است | canonical ISO/Jalali adapter |
| P1 | `FIN-WF-009` | مسیر settled به void و transaction معکوس وجود دارد؛ regression/UAT کامل فعلی سبز نیست | verification مالی تکمیلی |
| P1 | `FIN-WF-010` | orphan purge در سال قفل‌شده را skip می‌کند، اما retention/preview کامل نیست | حذف امن، preview و retention |
| P1 | `FIN-WF-011` | چند override در supplier finance باقی است | consolidation با regression |
| P1 | `FIN-WF-012` | reconciliation افتتاحیهٔ تأمین با گزارش رسمی کامل نیست | گزارش مغایرت و منع دوباره‌شماری |
| P1 | `FIN-WF-013` | `autoSettle` در مختومه‌سازی وجود دارد و reversal کامل ندارد | lifecycle قابل برگشت |
| P2 | `FIN-WF-014` | policy واحد نقش‌های مالی پیدا نشد | matrix نقش × عملیات |
| P2 | `FIN-WF-015` | quality dashboard و classification legacy کامل نیست | گزارش فقط‌خواندنی کیفیت داده |
| P2 | `FIN-WF-016` | policy رسمی recognition پیدا نشد | سند recognition و reconciliation |
| P2 | `FIN-WF-017` | Bank/Cash طبق گیت P0/P1 متوقف است | فقط پس از عبور از گیت‌ها |
| P2 | `FIN-WF-018` | audit مالی هنوز local/sync-based است | append-only server audit |

**آیتم‌های code-level که در source فعلی وجود دارند و فعلاً در فهرست باز اصلی نیستند:** `FIN-WF-005` merge نوع‌دار تأمین، `FIN-WF-008` جلوگیری دوباره‌شماری opex لینک‌دار، `FIN-WF-009` void تنخواه settled، `FIN-EX-01/02` کنترل تکراری فاکتور/صیادی. این‌ها همچنان نیازمند verification جاری‌اند.

## Family 2 — فروش و فرصت‌ها

| اولویت | شناسه | وضعیت جاری | اقدام بعدی |
|---|---|---|---|
| P0 | `BUG-OPPO-SYNTAX` | در source رفع شد؛ `node --check` و `tester127` سبز | نگه‌داشتن evidence؛ هنوز کل regression سبز نیست |
| P1 | `US-435` | اتصال UI و predicate فعال مشتری در `v31.6.11` انجام شد؛ full regression هنوز fail است | targeted UAT و رفع failureهای معتبر پیش از ZIP Production |
| P1 | `SALESFILE-REG-107/108/109` | failureهای مربوط به پرونده/QC/پیش‌پرداخت نیازمند triage واقعی | تحلیل مسیر مشترک salesfiles/rbac |
| P2 | `TECHDEBT-002` | ماژول‌های AI/خواندن سند موازی هنوز هم‌خانواده نشده‌اند | تصمیم ادغام |
| P2 | `TECHDEBT-006` | واژه‌های مشتری/کارفرما/خریدار/استعلام یکسان نشده‌اند | glossary و migration صرفاً UI |

**محدودیت:** US-435 در Sprint 1 فعلی کدنویسی نمی‌شود؛ ابتدا گیت Stage 0 و failureهای P0/P1 تثبیت می‌شوند.

## Family 3 — تطبیق خرید، استعلام و پیشنهاد

| اولویت | شناسه | وضعیت جاری | اقدام بعدی |
|---|---|---|---|
| P0 | `BUG-PROC-LINK-287 / FIN-WF-019` | resolver و لایهٔ انتخاب خرید واقعی با provenance پایدار در `v31.6.11` تکمیل شد؛ دادهٔ legacy بدون provenance عمداً انتخاب نمی‌شود | UAT و بررسی موارد legacy مبهم، بدون migration خودکار |
| P0 | `REG-103` | بخش index-based در Optimizer اصلاح شد؛ fixture provenanceدار و تست targeted سبز است، اما full regression هنوز failهای تاریخی/دیگر دارد | اجرای regression هدفمند و بررسی browser واقعی |
| P1 | `REG-112` | مرجع خرید، margin و money formatting چند failure دارد | تست golden برای CO/TC |
| P1 | `REG-11` | جدول قیمت/تحویل RFQ failure دارد | browser/UAT و بررسی renderer |
| P2 | `TECHDEBT-005` | موتور واحد codegen وجود دارد، اما fallbackهای random و duplicate generator باقی است | حذف fallbackهای عملیاتی و تست ID یکتایی |
| P2 | `TECHDEBT-004` | polling/setInterval در چند مسیر باقی است | مهاجرت event-hook، بدون تغییر هم‌زمان معماری اصلی |

## Family 4 — موجودی مازاد پروژه

| اولویت | شناسه | وضعیت جاری | اقدام بعدی |
|---|---|---|---|
| P1 | `US-436` | prototype در `crm/surplus.js`؛ load، route، sync، backup و اتصال salesfile ناقص | فعلاً parked؛ تصویب schema/lifecycle سپس sprint مستقل |
| P1 | `SURPLUS-DATA-001` | `ptf_crm_surplus` در sync/API/backup پیدا نشد | تصمیم shared/local و افزودن به همهٔ لایه‌ها |
| P1 | `SURPLUS-LIFECYCLE-001` | فقط `available/reserved` عملاً استفاده می‌شوند؛ sold/qty/release کامل نیست | مدل lifecycle و atomic commit |
| P2 | `SURPLUS-UI-001` | search فیلترشده render نمی‌شود؛ badge per-item نیست | تست UI و اتصال event-driven |

**محدودیت:** US-436 در Sprint 1 فعلی کدنویسی نمی‌شود؛ release note قبلی آن را انجام‌شده معرفی کرده، اما source فعلی فقط prototype را تأیید می‌کند.

## Family 5 — فاکتور سپیدار/مودیان

| اولویت | شناسه | وضعیت جاری | اقدام بعدی |
|---|---|---|---|
| P1 | `US-437` | در `v31.6.11` rollback شده؛ فقط مستندات/کیس‌استادی | parked تا approval مستقل و طراحی workflow |
| P1 | `INVOICE-WF-001` | `invoiceType`, `sepidarStatus`, `modianStatus` در source جاری پیدا نشد | تصمیم مدل رکورد/دو فایل/transitionها |

## Family 6 — گزارش، چاپ، پیوست و backup

| اولویت | شناسه | وضعیت جاری | اقدام بعدی |
|---|---|---|---|
| P0 | `BACKUP-REG-095` | حفظ کلیدهای backup در regression fail | بررسی contract backup و restore |
| P1 | `REG-121` | تاریخ/چک در سند و دادهٔ داخلی failure دارد | canonical date test |
| P1 | `REG-128` | گیرندهٔ TO در چاپ fail است | targeted print test |
| P1 | `REG-62` | بلوک To/legacy/terms در قالب‌ها fail است | print matrix |
| P1 | `REG-67` | attachment display/path fail است | storage/attachment verification |
| P1 | `REG-75` | TC/CO/FX print و persistence fail است | test golden قالب‌ها |
| P1 | `BUG-PRINT-PAGING` | در اسناد باز و بدون closure معتبر | نمونه PDF واقعی و تأیید بصری |
| P1 | `FX-CONFIG-001` | whitelist `fx-rates` در `api/.htaccess` نیست | اصلاح package/config با تست deploy |
| P2 | `REG-87` | `ptfFxDiag` failure دارد | بررسی proxy diagnostic |
| P2 | `REG-111` | functionality وجود دارد، label مورد انتظار tester drift دارد | update assertion یا تصمیم label |

## Family 7 — AI، ورودی و UX

| اولویت | شناسه | وضعیت جاری | اقدام بعدی |
|---|---|---|---|
| P1 | `REG-41` | پاک‌سازی Markdown خام LLM fail است | parser hardening |
| P1 | `REG-3` | malformed data rejection fail است | abuse/validation test |
| P2 | `REG-35` | brand optional در TC fail است | تصمیم workflow TC |
| P2 | `REG-57` | phone normalization و modal placement failure دارد | targeted browser test |
| P2 | `REG-88` | brand و offerSave validation hook failure دارد | triage با regression v170 |
| P2 | `BUG-033 / REG-117/118` | failure تکرارشوندهٔ modal/AI | owner و reproduction مستقل |
| P3 | `REG-116`, `REG-43` | style نقطهٔ بنفش دستیار | UI cleanup |
| P2 | `REG-60` | سقف‌های log/notif قدیمی fail است | retention policy |

## Family 8 — کیفیت تست، پکیج و مستندات

| اولویت | شناسه | وضعیت جاری | اقدام بعدی |
|---|---|---|---|
| P0 | `REG-RUNNER-149/150/151` | هر سه تست واقعاً PASS هستند، اما parser runner خروجی `PASS n FAIL 0` را نمی‌خواند | اصلاح runner، نه محصول |
| P0 | `REG-127` | syntax failure با fix فعلی رفع شد | تبدیل به regression syntax gate |
| P2 | `TECHDEBT-003` | closure معتبر برای fallback دستیار پیدا نشد | design/host evidence |
| P3 | `REG-136/137` | assertion دقیق v22.0 | version-free tester |
| P3 | `REG-138/139/140/141/142/143/144/146/147/148` | assertion دقیق v26.7 یا نام/ترتیب قدیمی | version-free tester و assertion capability-based |
| P3 | `REG-40` | مستند `ASSESSMENT-MOBILE-UX-v122.md` در بسته نیست | restore doc یا حذف assertion تاریخی |
| P3 | `REG-44` | assertion برای note نسخهٔ قدیمی | update tester |
| P3 | `REG-45` | تستر API قدیمی `uc()` در برابر `ptfUnifiedCode` | update harness |
| P3 | `REG-53` | wording قدیمی با functionality موجود | update assertion |
| P3 | `REG-54` | assessment messaging/APK در package نیست | package hygiene |
| P3 | `REG-55` | bot guide/.well-known/package artifacts ناقص | package hygiene |
| P3 | `REG-65` | artifact `BACKLOG-CORRECTIONS-R3.md` و assertion قدیمی | package/test cleanup |
| P3 | `REG-7/63` | dependency در eval تستر فراهم نشده؛ تابع در offers.js وجود دارد | harness isolation fix |
| P3 | `REG-124` | dependency داخلی cheques در eval تستر فراهم نشده | harness isolation fix |
| P3 | `REG-126` | assertion source قدیمی؛ رفتار runtime PASS است | update assertion |
| P3 | `REG-145` | یک assertion source شکننده + نسخهٔ قدیمی | update capability-based tester |
| P3 | `REG-8` | `.htaccess` ریشه و artifactهای قدیمی package نیستند | release package hygiene |
| P3 | `REG-99` | fixture قفل‌کردن سال جاری با policy جدید v29.4 ناسازگار است | update fixture/policy assertion |

## اولویت اجرایی خانواده‌ها

1. **P0 — Stage 0 / FIN-WF-001 / policy / staging / regression gate**
2. **P0 — procurement mapping و data integrity**
3. **P0/P1 — salesfiles و پرونده‌های فروش**
4. **P0/P1 — backup، FX config و چاپ مالی**
5. **P1 — RFQ و گزارش‌های مالی**
6. **P1 — US-435 پس از تثبیت runtime و approval scope**
7. **P1 — US-436 پس از تصویب schema/lifecycle و تکمیل Stage 0**
8. **P1 — US-437 فقط بعد از approval مستقل؛ فعلاً parked**
9. **P2 — AI/UX/terminology**
10. **P3 — پاک‌سازی تسترها و artifactهای release**

## وضعیت پذیرش

تا زمانی که گیت `audit.py` و regression کامل با `checks_fail=0` و بدون failure معتبر سبز نشود، هیچ موردی صرفاً به‌دلیل وجود کد یا release note به `Done/Fixed` منتقل نمی‌شود.
