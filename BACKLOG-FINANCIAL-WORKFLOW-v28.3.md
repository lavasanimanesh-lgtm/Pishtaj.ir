# بک‌لاگ رسمی اصلاح گردش‌کار مالی
## مبنا: ممیزی کامل فقط‌خواندنی سورس `v28.3`

**وضعیت سند:** پیشنهادی برای تصویب کارفرما — هیچ آیتمی با ایجاد این سند اجرا نشده است.  
**پیش‌نیاز شروع هر آیتم:** backup معتبر، fixture آزمایشی، سناریوی rollback، و تأیید دامنه توسط کارفرما.  
**قاعدهٔ اصلی:** هیچ migration یا حذف دادهٔ مالی/چک/فاکتور بدون dry-run، گزارش اثر، backup و تأیید صریح اجرا نمی‌شود.

---

## ۱. گیت توقف توسعه

تا بسته‌شدن آیتم‌های **P0** زیر، شروع «گردش بانک و صندوق»، ثبت بانکی، تطبیق بانک یا هر منبع مالی جدید **متوقف** بماند.

علت: افزودن bank/cash قبل از تثبیت RBAC، چک، سال مالی و sync، سطح دوباره‌شماری و تعارض را افزایش می‌دهد.

---

## ۲. بک‌لاگ اولویت صفر (P0)

### FIN-WF-001 — احراز هویت و RBAC مالی سمت سرور
- **شدت:** بحرانی
- **یافتهٔ ممیزی:** FW-C05
- **ریشه:** `api/crm.php` نقش را از header ارسالی مرورگر می‌گیرد و `data_push` ACL per-key مالی ندارد؛ `verify_request()` در وضعیت سورس، enforcement واقعی ندارد.
- **دامنه:** همهٔ کلیدهای مالی sync‌شونده و audit.
- **کار اصلاحی پیشنهادی:** session/auth واقعی سمت سرور، نقش استخراج‌شده از session، ACL per-action/per-key و منع data push غیرمجاز.
- **معیار پذیرش:**
  1. تغییر header مرورگر نتواند نقش مالی را ارتقا دهد.
  2. نقش فاقد مجوز نتواند `ptf_crm_supplier_finance`، `ptf_crm_cheques`، `ptf_crm_fiscal_snapshots` یا `ptf_crm_petty*` را push کند.
  3. audit سمت سرور، actor معتبر و request id ثبت کند.
- **تست لازم:** API integration test با نقش buyer/accountant/sales/chairman و کوشش جعل header.
- **وابستگی:** تصمیم معماری احراز هویت؛ نیازمند تأیید پیش از refactor.

### FIN-WF-002 — مدل ownership چک و migration غیرمخرب چک شخصی
- **شدت:** بحرانی
- **یافتهٔ ممیزی:** FW-C01, FW-H04
- **ریشه:** `chAll()` global و personal را مخلوط می‌کند و `chSave()` فقط personal کاربر جاری را نگه می‌دارد؛ key شخصی نیز در sync/backup استاندارد نیست.
- **کار اصلاحی پیشنهادی:** accessor واحد چک با scope صریح `company` / `personal-current-user` / `third-party`، نگهداری مالک و owner immutable، migration فقط با dry-run.
- **معیار پذیرش:**
  1. کاربر B هیچ personal cheque کاربر A را در چک‌ها، My Day، reminder یا گزارش نمی‌بیند.
  2. ذخیرهٔ چک توسط کاربر B هیچ personal cheque کاربر A را حذف نمی‌کند.
  3. رفتار personal cheque در مرورگر دوم و backup به‌صورت مصوب و مستند تعیین شود.
  4. دادهٔ legacy با ownership نامشخص بدون inference خودکار به گزارش شرکت وارد نشود.
- **تست لازم:** دو کاربر، دو مرورگر، personal legacy، edit/save همزمان و restore sandbox.
- **وابستگی:** تصمیم کارفرما دربارهٔ local-only یا encrypted private sync برای چک شخصی.

### FIN-WF-003 — enforce صدور چک شرکت و workflow تایید
- **شدت:** بحرانی
- **یافتهٔ ممیزی:** FW-C02, FW-H03
- **ریشه:** فرم عمومی چک، batch، AI و supplier payment مالکیت را یکدست/role-gated نمی‌کنند.
- **کار اصلاحی پیشنهادی:** chairman-only برای صدور نهایی چک شرکت؛ برای سایر نقش‌ها فقط draft/request با تایید chairman. `ownership` باید mandatory باشد.
- **معیار پذیرش:**
  1. buyer/sales/accountant نتواند company cheque نهایی ثبت کند.
  2. batch و AI بدون ownership صریح commit نشوند.
  3. چک ثالث همیشه `third_party/transferred/reminderDisabled` باشد.
  4. چک شخصی هرگز به `ptf_crm_cheques` شرکت وارد نشود.
- **تست لازم:** matrix همهٔ نقش‌ها × ثبت تکی/batch/AI/پرداخت تأمین.

### FIN-WF-004 — قفل مرکزی سال مالی برای تمام mutationهای مالی
- **شدت:** بحرانی
- **یافتهٔ ممیزی:** FW-C03, FW-H02
- **ریشه:** wrapperهای پراکنده فقط بخشی از save/voidهای supplier را پوشانده‌اند؛ edit/deleteهای متأخر، مشتری، opex، petty، shareholder و برخی حذف‌ها بیرون هستند.
- **کار اصلاحی پیشنهادی:** helper مرکزی `assertFiscalWritable(date, operation)` و فراخوانی قبل از هر mutation مالی؛ سند اصلاحی event-based برای سال بسته.
- **معیار پذیرش:**
  1. در سال قفل‌شده هیچ create/edit/delete/void مالی بدون سند اصلاحی ممکن نباشد.
  2. هر blocked operation دلیل و سال مربوط را نشان دهد.
  3. unlock فقط با policy مصوب و audit عمل کند.
  4. تست همهٔ مسیرهای مشتری، تأمین، چک، opex، petty، shareholder و project-cost سبز باشد.
- **تست لازم:** تست ماتریسی mutation × سال باز/قفل × نقش.

### FIN-WF-005 — merge نوع‌دار و conflict-safe برای زیر‌دفتر تأمین
- **شدت:** بحرانی
- **یافتهٔ ممیزی:** FW-C04
- **ریشه:** `ptf_crm_supplier_finance` object است اما merge عمومی برای non-array نسخهٔ remote را می‌پذیرد.
- **کار اصلاحی پیشنهادی:** merge schema-aware per `invoices/payments/adjustments` با `cd` و revision/timestamp ISO، conflict report و عدم overwrite silent.
- **معیار پذیرش:**
  1. ثبت همزمان invoice و payment در دو دستگاه هر دو رکورد را حفظ کند.
  2. edit همزمان یک رکورد conflict قابل مشاهده بسازد، نه overwrite خاموش.
  3. void در برابر edit، ترتیب رویداد و status نهایی قابل پیش‌بینی داشته باشد.
- **تست لازم:** browser E2E دو دستگاه، offline/reconnect، conflict fixture.

---

## ۳. بک‌لاگ اولویت یک (P1)

### FIN-WF-006 — reversal استاندارد وصولی مشتری
- **شدت:** زیاد
- **یافتهٔ ممیزی:** FW-H01
- **ریشه:** `savePay()` فقط append می‌کند؛ edit/void/delete event-based برای وصولی مشتری وجود ندارد.
- **کار اصلاحی پیشنهادی:** receipt event با شناسه، void/reversal reason، actor، تاریخ و منع delete فیزیکی.
- **معیار پذیرش:** اشتباه وصولی بدون backup اصلاح شود، مانده/گزارش/چک ثالث همزمان درست به‌روز شود و تاریخچه باقی بماند.

### FIN-WF-007 — یکپارچه‌سازی تاریخ مالی و سال‌بندی
- **شدت:** زیاد
- **یافتهٔ ممیزی:** FW-H05
- **ریشه:** برخی موتورهای fiscal سال را با regex ASCII می‌خوانند، درحالی‌که رویدادهای UI تاریخ فارسی دارند.
- **کار اصلاحی پیشنهادی:** ISO canonical برای همهٔ eventهای مالی و converter واحد Jalali↔ISO؛ تاریخ نمایشی هرگز مبنای grouping نباشد.
- **معیار پذیرش:** یک سند با تاریخ فارسی، لاتین و ISO در سال مالی/گزارش رسمی یکسان طبقه‌بندی شود.

### FIN-WF-008 — جلوگیری از دوباره‌شماری opex مرتبط با پرونده
- **شدت:** زیاد
- **یافتهٔ جدید:** هزینه جاری دارای `dealRef` هم به `ptf_crm_opex` وارد می‌شود و هم به `deal.costEvents`; سود پروژه هزینه‌های `costEvents` را کسر می‌کند و fiscal همهٔ opex را نیز دوباره کم می‌کند.
- **شواهد:** `opex.js:107-118` و `buycompare.js:739-766` در کنار `fiscal.js:68-84`.
- **کار اصلاحی پیشنهادی:** تعیین یک policy: هزینه linked-deal یا فقط در سود پروژه کسر شود یا فقط در opex سال، نه هر دو؛ گزارش reconciliation لازم است.
- **معیار پذیرش:** یک هزینه linked-deal در سود خالص سال دقیقاً یک‌بار اثر کند.

### FIN-WF-009 — تنخواه: ابطال به‌جای حذف و freeze دوره‌های ثبت‌شده
- **شدت:** زیاد
- **یافتهٔ جدید:** `pettyDel()` رکورد را hard-delete می‌کند حتی اگر settled باشد، اما transaction `settle` و period snapshot باقی می‌ماند.
- **شواهد:** `petty.js:219-236` در مقابل `268-278` و `290-333`.
- **کار اصلاحی پیشنهادی:** reversal transaction، منع edit/delete پس از `referred/registered`، بازگشایی دوره با reason و audit.
- **معیار پذیرش:** حذف/ابطال هزینه settled، موجودی، transaction، دوره و گزارش را سازگار نگه دارد.

### FIN-WF-010 — ایمن‌سازی حذف‌های مالی زنجیره‌ای
- **شدت:** زیاد
- **یافتهٔ جدید:** پاکسازی orphan می‌تواند `invoices` و `payables` را hard-delete کند؛ opex و advance payment نیز مسیر delete فیزیکی دارند.
- **شواهد:** `bridge.js:650-672`، `opex.js:128-149`، `petty.js:268-278`، `petty.js:617-625`.
- **کار اصلاحی پیشنهادی:** financial retention policy، soft void/archive، preview اثر، reason و role محدود.
- **معیار پذیرش:** هیچ سند مالی دارای اثر گزارش بدون preview، backup و audit قابل حذف فیزیکی نباشد.

### FIN-WF-011 — consolidation زیر‌دفتر تأمین
- **شدت:** زیاد
- **یافتهٔ ممیزی:** FW-M02
- **ریشه:** overrideهای متوالی برای `slOpenLedger`, `slLedgerPrint`, save/void/edit/delete.
- **کار اصلاحی پیشنهادی:** یک renderer، یک command layer، یک fiscal guard؛ حذف wrapperهای لایه‌ای فقط با regression suite.
- **معیار پذیرش:** هر عملیات فقط یک entrypoint نهایی داشته باشد و source test شمار overrideها را کنترل کند.

### FIN-WF-012 — reconcile افتتاحیه/adjustment تأمین با گزارش رسمی
- **شدت:** زیاد
- **یافتهٔ ممیزی:** FW-M03
- **کار اصلاحی پیشنهادی:** report per supplier/year که supplier opening adjustment و official opening را نشان دهد و duplicate را block/warn کند.
- **معیار پذیرش:** یک مانده افتتاحیه نتواند بدون هشدار در دو سرفصل ثبت و دوبار شمارش شود.

### FIN-WF-013 — اصلاح lifecycle «مختومه با تسویه خودکار»
- **شدت:** زیاد
- **یافتهٔ جدید:** در بسته‌شدن پرونده، `sfCloseSettledCommit(..., settleOpen)` با انتخاب کاربر یک receipt با عنوان `autoSettle` می‌سازد؛ reversal استاندارد receipt موجود نیست.
- **شواهد:** `salesfiles.js:833-854` و فقدان receipt reversal در `rbac.js`.
- **کار اصلاحی پیشنهادی:** الزام سند/دلیل تسویه، confirmation با مبلغ هر فاکتور و reversal event.
- **معیار پذیرش:** auto-settlement بدون سند/دلیل نهایی نشود و قابل reversal کامل باشد.

---

## ۴. بک‌لاگ اولویت دو (P2)

### FIN-WF-014 — سیاست نقش‌های مالی واحد
- **شدت:** متوسط
- **یافته:** `ceo/commercial` در RBAC finance دارند ولی هاب مالی فقط admin/chairman است؛ supplier/opex رفتار دیگری دارد.
- **خروجی:** policy matrix مصوب و تست role matrix UI/function/API.

### FIN-WF-015 — گزارش کیفیت داده مالی و legacy classification
- **شدت:** متوسط
- **دامنه:** چک بدون ownership، سند بی‌تاریخ، نرخ ارزی ناقص، payable با supplier-name matching، linked legacy mismatch.
- **خروجی:** dashboard فقط‌خواندنی + export + مسئول تعیین تکلیف؛ بدون اصلاح خودکار.

### FIN-WF-016 — مرزبندی سود پروژه، بدهی تأمین و گزارش قانونی
- **شدت:** متوسط
- **یافته:** سود پروژه از real-buy/cost-event می‌آید، بدهی تأمین از invoice/payable؛ این دو لزوماً یک مبنای recognition ندارند.
- **خروجی:** سند سیاست recognition و report reconciliation؛ جلوگیری از کم‌کردن مجدد بدهی تأمین از سود پروژه.

### FIN-WF-017 — گزارش رسمی bank/cash پس از گیت P0/P1
- **شدت:** متوسط
- **پیش‌نیاز:** FIN-WF-001 تا FIN-WF-013.
- **دامنه:** دفتر گردش بانک/صندوق، receipt/payment link، bank statement attachment، reconciliation و cash position.

### FIN-WF-018 — غیرقابل‌دستکاری کردن audit مالی
- **شدت:** متوسط
- **یافته:** audit در localStorage و sync عادی نگه‌داری می‌شود و retention محدود دارد.
- **خروجی:** append-only server audit برای عملیات مالی حساس، hash/request id و retention policy.

---

## ۵. سناریوهای پذیرش سراسری (گیت خروج هر Sprint)

1. **دوکاربر/دو دستگاه:** invoice و payment تأمین همزمان؛ هر دو پس از reconnect باقی بمانند.
2. **چک شخصی:** کاربر A ثبت کند؛ کاربر B هیچ‌جا نبیند و با save خود آن را حذف نکند.
3. **چک شرکت:** فقط chairman قادر به صدور نهایی باشد؛ سایر نقش‌ها صرفاً draft/request داشته باشند.
4. **سال قفل‌شده:** همهٔ mutationها برای مشتری، تأمین، opex، petty، shareholder و cheque مسدود یا به amendment/reversal هدایت شوند.
5. **سال باز:** invoice/payment/void/reversal هر دو طرف، گزارش و مانده‌ها را سازگار نگه دارند.
6. **هزینه linked-deal:** سود پروژه و سود سال یک بار اثر را نشان دهند.
7. **تنخواه settled:** void/reversal موجودی و دوره را هم‌زمان اصلاح کند.
8. **تاریخ فارسی/ISO:** طبقه‌بندی fiscal و گزارش رسمی یک نتیجه دهند.
9. **چک ثالث:** دریافت مشتری، پرداخت تأمین، reminder، My Day و گزارش رسمی بدون دوباره‌شماری باشند.
10. **API:** جعل role header برای عملیات مالی با پاسخ 403 و audit امنیتی مواجه شود.

---

## ۶. وضعیت اجرایی

| وضعیت | تعداد |
|---|---:|
| P0 پیشنهادی | 5 |
| P1 پیشنهادی | 8 |
| P2 پیشنهادی | 5 |
| اجراشده در این سند | 0 |

**گام بعد فقط پس از تصویب:** تعیین اینکه کدام P0 به عنوان نخستین اسپرینت اصلاحی انجام شود. پیشنهاد ممیزی: ابتدا `FIN-WF-001` و `FIN-WF-002`، سپس `FIN-WF-003` تا `FIN-WF-005`.


### FIN-WF-019 — هویت پایدار قلم بین CO، استعلام و خرید واقعی
- **شدت:** زیاد / ایمنی داده
- **یافته:** BUG-PROC-LINK-287؛ Optimizer و چند مسیر مرجع، قلم را با شماره ردیف آرایه مرتبط می‌کردند.
- **ریسک:** قیمت/خرید قلم دیگر در ماتریس سود، تصمیم خرید و نمایش مرجع دیده می‌شد.
- **اقدام اضطراری مجازشده توسط کارفرما:** v28.7 resolver یکتا، حذف fallback اندیسی، provenance برای خرید جدید و گزارش فقط‌خواندنی تطبیق سراسری.
- **وضعیت:** پیاده‌سازی اولیه در انتظار UAT؛ migration legacy ممنوع است.
- **کار باقی‌مانده:** بررسی سراسری داده‌های legacy با گزارش تطبیق و تصمیم کاربر برای هر مورد مبهم.
