# طراحی مرحلهٔ صفر، PoC امنیتی و Roadmap اصلاح Workflow مالی
## پاسخ به پیش‌نیازهای کارفرما پیش از اجرای FIN-WF-001 تا FIN-WF-005

**وضعیت:** سند طراحی و تصمیم‌گیری؛ هیچ تغییر کد/داده/مهاجرتی را مجاز نمی‌کند.  
**مبنای تحلیل:** سورس `v28.3`، گزارش `FINANCIAL-WORKFLOW-AUDIT-v28.3.md` و بک‌لاگ `BACKLOG-FINANCIAL-WORKFLOW-v28.3.md`.  
**واحد زمان:** نفر-روز مهندسی؛ برآورد، تعهد زمانی قراردادی نیست و پس از تأیید طراحی دقیق می‌شود.

---

## ۱. قواعد حاکم قبل از هر Sprint اجرایی

هیچ Sprint اصلاحی مالی نباید آغاز شود مگر اینکه این پنج خروجی آماده و تأیید شده باشند:

1. **Backup:** بک‌آپ قابل بازیابی از محیط عملیاتی، به‌علاوه export جدا از کلیدهای تحت اثر.
2. **Fixture:** دادهٔ ساختگی و بدون اطلاعات واقعی شامل نقش‌ها، مشتری، تأمین‌کننده، invoice، receipt، payment، cheque، fiscal period و conflict همزمان.
3. **Baseline تست:** خروجی تست‌های قبل از تغییر و hash/count دادهٔ fixture ثبت شود.
4. **Rollback:** روش برگشت مشخص، آزمایش‌شده و غیرمخرب باشد؛ rollback صرفاً «برگرداندن ZIP» نیست.
5. **UAT:** سناریوی مرحله‌ای با نقش و نتیجهٔ مورد انتظار از قبل تصویب شود.

### ممنوعیت‌ها
- migration خودکار دادهٔ چک شخصی یا supplier finance ممنوع است.
- hard-delete برای سند مالی در Sprintهای اصلاحی ممنوع است؛ فقط void/reversal یا archive قابل بررسی است.
- تغییر هم‌زمان schema و migration و UI در یک deployment بدون dry-run ممنوع است.
- PoC امنیتی فقط روی staging جداگانه با دادهٔ ساختگی انجام می‌شود؛ **هیچ request اثباتی روی production اجرا نمی‌شود.**

---

## ۲. مرحلهٔ صفر — مدل دادهٔ مالی مرجع (Design Only)

### ۲.۱ هدف
پیش از اصلاح، یک زبان مشترک برای سند، رویداد، reversal، مالکیت و سال مالی تصویب شود. این مدل در مرحلهٔ صفر فقط مرجع طراحی است و **کلید داده یا migration جدیدی ایجاد نمی‌کند**.

### ۲.۲ موجودیت‌های مرجع

| موجودیت | نقش در مدل مرجع | وضعیت مجاز | منبع فعلی / نگاشت اولیه |
|---|---|---|---|
| `Invoice` | تعهد مشتری یا تأمین‌کننده | draft, posted, void | مشتری: `ptf_crm_invoices`؛ تأمین: `supplier_finance.invoices` |
| `Receipt` | دریافت از مشتری | posted, void | اکنون رکورد بدون id در `invoice.payments[]` / `pays[]` |
| `Payment` | پرداخت به تأمین‌کننده/تنخواه | posted, void | تأمین: `supplier_finance.payments`؛ تنخواه: `petty_tx` |
| `Allocation` | اتصال Receipt/Payment به Invoice یا اعتبار | active, released | `allocations[]` تأمین؛ تخصیص receipt مشتری نیازمند مدل صریح‌تر |
| `Reversal` | خنثی‌سازی رویداد اصلی بدون حذف آن | posted | در برخی مسیرها status void وجود دارد، اما مدل مشترک ندارد |
| `Cheque` | ابزار پرداخت با مالکیت صریح | draft, open, cleared, void, transferred | `ptf_crm_cheques` |
| `Ownership` | محدودهٔ اثر/مشاهده چک | `company`, `personal`, `third_party` | اکنون در همهٔ سازندگان mandatory نیست |
| `AuditEvent` | ردپای append-only عملیات حساس | immutable | اکنون audit محلی/sync است؛ سمت سرور لازم است |
| `FiscalPeriod` | بازهٔ سال و وضعیت کنترل | open, locked, reopened | `ptf_crm_fiscal_snapshots` با چند نوع record |
| `OpeningBalance` | ماندهٔ پیش از مبنای سیستم | posted, void | adjustment تأمین و opening رسمی؛ نیازمند reconciliation |

### ۲.۳ invariants پیشنهادی

1. هر Receipt/Payment/Reversal شناسهٔ یکتا، `effectiveAtISO`، actor، reason و status دارد.
2. هیچ receipt/payment posted حذف فیزیکی نمی‌شود؛ فقط void/reversal می‌شود.
3. `Reversal.originalEventCd` اجباری و یک‌به‌یک است.
4. هر cheque دارای ownership صریح و immutable-after-posting است؛ تغییر مالکیت فقط با event اصلاحی یا workflow تایید.
5. period locked، هر mutation موثر بر آن period را رد یا به amendment/reversal جاری هدایت می‌کند.
6. invoice، payment و receipt فقط از یک تاریخ canonical ISO برای grouping مالی استفاده می‌کنند.
7. audit مالی از هویت معتبر سمت سرور می‌آید، نه localStorage یا header قابل جعل.
8. merge برای هر aggregate object باید type-aware باشد؛ LWW کل object برای زیر‌دفتر مالی ممنوع است.

### ۲.۴ خروجی قابل تصویب مرحلهٔ صفر
- ERD/روابط مفهومی، بدون پیاده‌سازی
- جدول mapping کامل منابع فعلی به مدل مرجع
- سیاست ownership چک شخصی: `local-only` یا `private encrypted sync`
- سیاست reversal برای receipt/payment/auto-settle
- policy قفل سال و amendment
- policy هزینهٔ linked-deal در برابر opex
- ماتریس نقش UI / function / API

### ۲.۵ برآورد مرحلهٔ صفر
**۴ تا ۶ نفر-روز** شامل جلسهٔ تصمیم، تهیهٔ mapping، fixture design و تصویب UAT.  
**Rollback:** ندارد؛ خروجی فقط سند است.

---

## ۳. FIN-WF-001 — احراز هویت و RBAC مالی سمت سرور

### فایل‌ها و توابع درگیر

| فایل | نقطهٔ درگیر |
|---|---|
| `api/crm.php` | `verify_request()` خط 10، `$client_role` خط 226، `role_guard()` خط 227، `data_push` خط 748، `users_sync/users_get` خطوط 830+ |
| `crm/index.html` | `doLogin()` خطوط 538-624؛ session فعلی در localStorage ساخته می‌شود |
| `crm/rbac.js` | `curSession()` و `curRole()` خطوط 23-31 |
| `crm/sync.js` | `pushDirty()`، `pullCheck()` و header `X-CRM-Role` |
| `crm/backup.js` | restore/backup requestها و header نقش |
| **جدید، مشروط به تایید طراحی** | endpoint/session middleware سمت سرور و تست integration |

### میزان تغییر
**زیاد / معماری امنیتی.** به علت اینکه login فعلی سمت مرورگر است و `users_get` حتی hash کاربران را برای client برمی‌گرداند، راهکار امنیتی واقعی نیازمند server-side session و عدم اتکا به نقش محلی است.

### ریسک Regression
- ورود کاربران جدید/قدیمی و حالت آفلاین.
- sync اولیه و دستگاه دوم.
- restore/backup و کاربران سروری.
- endpointهای عمومی سایت که نباید session مالی بخواهند.
- احتمال خروج همهٔ کاربران در زمان فعال‌سازی enforcement.

### برآورد
- PoC و طراحی: **۱٫۵ تا ۲٫۵ نفر-روز**
- پیاده‌سازی session/RBAC: **۳ تا ۵ نفر-روز**
- integration/E2E/regression: **۲ تا ۳ نفر-روز**
- **جمع: ۶٫۵ تا ۱۰٫۵ نفر-روز**

### روش Rollback
1. اجرای اولیه در حالت **observe-only**: session ساخته می‌شود ولی requestهای قدیمی فقط log می‌شوند.
2. feature flag سروری `PTF_SERVER_AUTH_ENFORCE=false/true`، خارج از client و قابل rollback فوری.
3. پیش از enforce، export کاربران سروری و backup metadata session.
4. در rollback فقط enforcement خاموش می‌شود؛ دادهٔ مالی revert نمی‌شود.
5. لاگ درخواست‌های denied حفظ می‌شود تا دلیل شکست ورود/sync بررسی شود.

### معیار خروج
- نقش HTTP header به‌تنهایی اثر ندارد.
- `data_push` برای کلیدهای مالی با هویت/role سروری کنترل می‌شود.
- سناریوی login، offline، sync و restore با نقش‌های fixture سبز است.

---

## ۴. PoC غیرمخرب FIN-WF-001 — جعل Role Header و راهکار

### ۴.۱ اثبات استاتیک فعلی

| گام | شواهد سورس | نتیجه |
|---|---|---|
| 1 | `doLogin()` در `index.html` session شامل `roleId` را در localStorage می‌نویسد | نقش فعلی client-side است. |
| 2 | `curRole()` در `rbac.js` همان localStorage را می‌خواند | UI نقش را از مرورگر دریافت می‌کند. |
| 3 | `sync.js` در push header `X-CRM-Role: curRole()` می‌فرستد | نقش از client به سرور اعلام می‌شود. |
| 4 | `api/crm.php` مقدار `$client_role` را از همان header می‌گیرد | server identity مستقل ندارد. |
| 5 | `data_push` گارد `role_guard` per-key مالی ندارد | کلیدهای مالی allowlist شده می‌توانند بدون ACL تخصصی ذخیره شوند. |
| 6 | enforcement در `verify_request()` در سورس کامنت است | تا وقتی production configuration کنترل مستقل نداشته باشد، کنترل قابل اتکا نیست. |

### ۴.۲ اجرای فعال PoC — فقط staging

**پیش‌نیازهای قطعی:**
- clone جدا از production؛
- دادهٔ ساختگی؛
- backup از staging؛
- یک کلید فداشونده مثل snapshot با شناسه `POC-FSY-001`؛
- ثبت hash فایل sync پیش و پس از آزمایش؛
- مجوز کتبی اجرای PoC روی staging.

**گام آزمایشی A — رفتار فعلی مورد انتظار در سورس:**
1. با یک کاربر fixture نقش `sales` وارد staging شوید.
2. درخواست `data_push` با header `X-CRM-Role: sales` و فقط کلید مالی ساختگی `ptf_crm_fiscal_snapshots` ارسال شود.
3. payload فقط یک snapshot ساختگی POC را اضافه/به‌روزرسانی کند؛ هیچ دادهٔ واقعی استفاده نشود.
4. پاسخ، meta revision و hash فایل staging ثبت شود.

**معیار آسیب‌پذیری:** اگر پاسخ `ok:true/saved:1` باشد و snapshot ساختگی ذخیره شود، data push برای مالی بدون ACL server-authoritative پذیرفته شده است.

**گام آزمایشی B — جعل header:** همان درخواست با `X-CRM-Role: chairman` ارسال و فقط تفاوت response ثبت شود. اگر هر دو پذیرفته شوند، header نقش کنترل قطعی نیست.

> این مراحل عمداً command اجرایی یا URL عملیاتی ندارند تا روی production قابل کپی/اجرا نباشند. اجرای آن فقط توسط تیم مجاز روی staging انجام می‌شود.

### ۴.۳ PoC راهکار پیشنهادی

**معماری پیشنهادی:**
- login موفق، یک session سروری با cookie `HttpOnly`, `Secure`, `SameSite=Lax` ایجاد می‌کند.
- server `userId` و `roleId` را از session معتبر می‌خواند؛ `X-CRM-Role` حذف یا فقط diagnostic می‌شود.
- `data_push` بر اساس allowlist مالی server-side و role واقعی کنترل می‌شود.
- CSRF token برای mutationهای same-origin اضافه می‌شود.

**آزمون پذیرش راهکار:**

| تست | انتظار پس از اصلاح |
|---|---|
| user `sales` با header جعلی `chairman` | `403`، بدون تغییر hash داده |
| user `buyer` با push supplier payment | مطابق policy مصوب؛ در صورت نداشتن مجوز `403` |
| chairman معتبر با cookie/session | عملیات مجاز با audit server-side |
| request بدون session | `401` یا `403` |
| endpoint عمومی RFQ/contact | همچنان تحت policy عمومی جداگانه کار کند، نه session مالی |

### ۴.۴ Rollback PoC
PoC روی staging تنها با بازگرداندن backup staging یا حذف snapshot `POC-FSY-001` انجام می‌شود. در production هیچ PoC فعال اجرا نمی‌شود.

---

## ۵. FIN-WF-002 — مدل ownership و حریم چک شخصی

### فایل‌ها و توابع درگیر
- `crm/cheques.js`: `chPersonalKey`, `chPersonalAll`, `chAll`, `chMine`, `chSave`, `chDailyNotify`, `chFormHtml`, `chCollectForm`, `chBatchCollect`, `chAiCommit`.
- `crm/myday.js`: فیلتر چک‌های نزدیک سررسید.
- `crm/sync.js`, `crm/backup.js`, `crm/golive.js`: سیاست sync/backup personal data.
- `crm/working-capital.js`, `crm/supplier-finance.js`: مصرف چک شرکتی در گزارش و پرداخت.

### میزان تغییر
**زیاد / داده‌حساس.** نیازمند تصمیم policy است؛ بدون تصمیم local-only یا private encrypted sync نباید شروع شود.

### ریسک Regression
- از دست رفتن personal legacy در partition.
- تغییر reminder و My Day.
- دسترسی چاپ چک، batch و AI.
- multi-device behavior و backup.

### برآورد
- طراحی و dry-run inventory: **۲ تا ۳ نفر-روز**
- implementation: **۳ تا ۵ نفر-روز**
- migration sandbox + UAT دوکاربر: **۳ تا ۴ نفر-روز**
- **جمع: ۸ تا ۱۲ نفر-روز**

### Rollback
- migration فقط copy/mark است، نه move/delete در مرحلهٔ اول.
- جدول mapping `oldCd → destination/owner/status` و گزارش تعداد/مبلغ قبل و بعد.
- feature flag برای خواندن legacy global تا زمان sign-off.
- restore فقط کلیدهای چک در محیط sandbox؛ نه full backup production.

### معیار خروج
- personal cheque یک کاربر نه دیده و نه حذف‌شده توسط کاربر دیگر؛ شرکت فقط چک company را می‌بیند؛ گزارش مالی هیچ personal/third-party را نمی‌شمارد.

---

## ۶. FIN-WF-003 — Workflow صدور و تایید چک شرکت

### فایل‌ها و توابع درگیر
- `crm/cheques.js`: فرم تک، batch، AI، save/clear/delete و reminder.
- `crm/supplier-finance.js`: `slChequeCreate`, `slPaymentSave`, payment methods.
- `crm/rbac.js`: role policy.
- `api/crm.php`: ACL سروری، پس از FIN-WF-001.

### میزان تغییر
**متوسط تا زیاد.** بدون migration گسترده، ولی وابسته به FIN-WF-001 و FIN-WF-002 است.

### ریسک Regression
- پرداخت تأمین با چک شرکت.
- چک ثالث منتقل‌شده.
- چاپ و reminder.
- چک‌های موجودِ ownership نامشخص.

### برآورد
**۴ تا ۶ نفر-روز** پس از بسته‌شدن FIN-WF-001/002.

### Rollback
- workflow جدید با feature flag و رکوردهای request/draft افزایشی.
- هیچ چک موجودی تغییر مالکیت نمی‌دهد؛ classification فقط با dry-run و تأیید جدا.
- rollback با خاموش‌کردن مسیر approval، بدون حذف draft/audit.

### معیار خروج
- فقط chairman می‌تواند company cheque را final-post کند؛ سایر نقش‌ها request/draft دارند؛ ownership در تک/batch/AI/payment mandatory است.

---

## ۷. FIN-WF-004 — قفل مرکزی سال مالی

### فایل‌ها و توابع درگیر
- `crm/fiscal.js`: lock/unlock/amendment/snapshot.
- `crm/supplier-finance.js`: invoice/payment/edit/delete/void/adjustment/opening.
- `crm/rbac.js`: customer invoice, receipt, due-date mutation.
- `crm/opex.js`: add/delete/template.
- `crm/petty.js`: add/direct/charge/settle/edit/delete/period.
- `crm/shareholders.js`: salary/draw/edit/transactions.
- `crm/salesfiles.js`: auto-settle at close.
- `crm/bridge.js`: orphan purge؛ `crm/projects.js` و `buycompare.js` برای cost events.
- **جدید، مشروط به تایید:** یک guard مرکزی کوچک، نه wrapperهای پراکنده.

### میزان تغییر
**زیاد / cross-cutting.** بهتر است در دو Sprint اجرا شود: ابتدا guard + observe mode، سپس enforcement تمام mutationها.

### ریسک Regression
- جلوگیری ناخواسته از عملیات روز جاری به دلیل تبدیل تاریخ.
- سندهای legacy بدون تاریخ.
- workflow closing پرونده و period close.
- عملکرد amendment/reversal.

### برآورد
- inventory mutation + fixture: **۲ تا ۳ نفر-روز**
- guard مرکزی/observe mode: **۳ تا ４ نفر-روز**
- اتصال همه mutationها + UAT: **۵ تا ۸ نفر-روز**
- **جمع: ۱۰ تا ۱۵ نفر-روز**

### Rollback
- guard در ابتدا `observe` است و فقط log می‌دهد.
- enforce per-module feature flag دارد تا در خطای عملیاتی فقط همان module به observe برگردد.
- mutationهای blocked هرگز data را تغییر نمی‌دهند؛ rollback داده لازم نیست.

### معیار خروج
- ماتریس همه mutationهای مالی × open/locked period پاس شود؛ هیچ edit/delete مستقیم در سال قفل‌شده باقی نماند.

---

## ۸. FIN-WF-005 — Merge امن زیر‌دفتر تأمین

### فایل‌ها و توابع درگیر
- `crm/sync.js`: `ptfSmartMerge`, `pushDirty`, `pullCheck`, conflict handling.
- `crm/supplier-finance.js`: schema object، invoice/payment/adjustment write path.
- `crm/backup.js`: fixture restore و evidence.
- `api/crm.php`: conflict response/meta؛ احتمالاً تغییر محدود یا بدون تغییر، بسته به نتیجهٔ PoC.

### میزان تغییر
**متوسط تا زیاد.** تغییر schema عملیاتی لازم نیست، اما merge object باید type-aware شود.

### ریسک Regression
- duplicate record در reconnect.
- edit مقابل void.
- allocation divergence.
- objectهای قدیمی بدون timestamp استاندارد.

### برآورد
- fixture conflict matrix: **۱٫۵ تا ۲ نفر-روز**
- merge type-aware + conflict UI/log: **۳ تا ۴ نفر-روز**
- browser E2E دو دستگاه: **۲ تا ۳ نفر-روز**
- **جمع: ۶٫۵ تا ۹ نفر-روز**

### Rollback
- قبل از merge، هر دو نسخه local/server در conflict audit نگه‌داری می‌شوند.
- feature flag per-key فقط برای `ptf_crm_supplier_finance`.
- در fallback، conflict auto-merge خاموش و درخواست manual resolution نمایش داده می‌شود؛ داده حذف نمی‌شود.

### معیار خروج
- invoice و payment همزمان هر دو باقی بمانند؛ conflict edit/void قابل مشاهده و قابل حل باشد؛ هیچ object کامل بدون گزارش جایگزین نشود.

---

## ۹. Roadmap پیشنهادی Sprintها

> شمارهٔ رسمی نسخه در صورت تصویب مطابق قاعدهٔ پروژه خواهد بود. تا پیش از تأیید این roadmap، هیچ Sprint اجرایی شروع نمی‌شود.

| فاز | نام / نسخه پیشنهادی | دامنه | تست‌های اجباری | معیار خروج |
|---|---|---|---|---|
| Stage 0 | بدون release | تصویب مدل داده مرجع، policy ownership، policy reversal، role matrix، fixture design | مرور طراحی + sign-off کارفرما | سند model و UAT matrix تایید شده؛ migration ممنوع تا تصمیم صریح |
| Sprint 1 | PoC امنیتی روی staging، بدون production release | FIN-WF-001 PoC غیرمخرب؛ baseline hash، header spoof، session design | PoC-A/B و PoC راهکار، هیچ داده production | آسیب‌پذیری/عدم آسیب‌پذیری با evidence مشخص؛ معماری session تایید شده |
| Sprint 2 | Sprint 288 / `v28.8` پیشنهادی | FIN-WF-001 implementation: server auth/RBAC در observe mode | login/offline/sync/role API tests | نقش سروری قابل خواندن است؛ observe logs بدون اختلال عملیاتی |
| Sprint 3 | Sprint 289 / `v28.9` پیشنهادی | FIN-WF-001 enforcement محدود + FIN-WF-002 inventory/dry-run | header forgery=403، inventory personal cheques، backup/restore sandbox | ACL مالی enforce شده؛ migration report بدون تغییر داده تایید شده |
| Sprint 4 | Sprint 290 / `v29.0` پیشنهادی | FIN-WF-002 partition/privacy implementation | دوکاربر/دودستگاه/personal legacy/reminder/My Day | personal isolation و عدم حذف داده تایید شده |
| Sprint 5 | Sprint 291 / `v29.1` پیشنهادی | FIN-WF-003 company cheque approval | role matrix × single/batch/AI/supplier payment | فقط chairman final-post؛ ownership mandatory |
| Sprint 6 | Sprint 292 / `v29.2` پیشنهادی | FIN-WF-004 fiscal guard observe + inventory mutation | تمام mutationها در observe mode log شوند | coverage 100٪ mutation inventory، false positive پذیرفته‌شده صفر یا مستند |
| Sprint 7 | Sprint 293 / `v29.3` پیشنهادی | FIN-WF-004 enforcement + FIN-WF-005 conflict merge | locked-year matrix + two-device conflict matrix | قفل سراسری و merge supplier finance UAT pass |
| Sprint 8 | Sprint 294 / `v29.4` پیشنهادی | P1: receipt reversal، opex double-count، petty reversal | end-to-end customer/supplier/opex/petty/report | گزارش‌های اصلی سازگار و regression suite سبز |
| Sprint 9 | Sprint 295 / `v29.5` پیشنهادی | P1/P2 reconciliation، safe deletion، date canonical | fiscal dates, opening reconciliation, orphan safety | readiness review برای bank/cash |
| Sprint 10 | Sprint 296 / `v29.6` پیشنهادی | فقط پس از گیت‌های قبل: bank/cash design & pilot | bank fixture، reconciliation pilot | تصمیم go/no-go برای اجرای بانک/صندوق |

### معیار خروج مشترک هر Sprint

1. همه تست‌های unit/fixture مربوطه PASS.
2. یک UAT browser با نقش‌های واقعی و checklist امضاشده انجام شده باشد.
3. backup پیش از deploy و evidence rollback ثبت شده باشد.
4. تغییر migration یا schema در گزارش release note، Handover و backlog ثبت شده باشد.
5. هیچ یافتهٔ P0 بازِ مربوط به دامنهٔ Sprint باقی نماند.

---

## ۱۰. تصمیم موردنیاز کارفرما

برای شروع Stage 0 فقط این موارد باید تایید شود:

1. مدل مرجع صرفاً طراحی شود و هنوز migration انجام نشود.
2. PoC FIN-WF-001 فقط روی staging مجاز است.
3. سیاست چک شخصی انتخاب شود: `local-only` یا `private encrypted sync`.
4. Sprint 1 با PoC امنیتی، نه با تغییر production، آغاز شود.
