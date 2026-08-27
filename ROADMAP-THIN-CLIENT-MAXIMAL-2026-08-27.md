# رودمپ نازک‌سازی حداکثری سمت کلاینت — قطع کامل وابستگی به localStorage

**تاریخ:** ۲۰۲۶-۰۸-۲۷ | **نسخهٔ سند:** 1.0 | **مبنای کد:** v34.8.12 (مین، پس از همگام‌سازی استیجینگ با مین)
**وضعیت:** طراحی برای تأیید کارفرما — هیچ تنظیمی بدون تأیید بخش ۹ اعمال نمی‌شود.

**نسبت با اسناد موجود:** این سند **ابرمجموعهٔ** `PHASE-C-THIN-CLIENT-ROADMAP.md` (فازهای C1-C6 «عین بانک») است؛ فازهای C همان T2/T3/T7 اینجا هستند و چیزهایی که فاز C پوشش نمی‌داد (نشست/توکن، رسانه، بایپس‌های مستقیم، کلیدهای فقط-دستگاه، گیت‌های CI، صحت استقرار، صف آفلاین IDB) اینجا کامل شده‌اند. مبناها: `ARENA-STORAGE-INDEPENDENCE-RCA-2026-08-26.md`، `ASSESSMENT-STORAGE-INDEPENDENCE-THIN-CLIENT-2026-08-27.md`، `ASSESSMENT-STAGING-REVIEW-2026-08-27.md`، `PHASE-C1-HOT-COLLECTIONS.md`.

---

## ۱) تعریف «نازک حداکثری» — وضعیت پایانی (End-State)

کلاینت مثل **اپ بانک** رفتار می‌کند؛ این ۷ اصل به‌صورت قابل‌اندازه‌گیری تعریف می‌شوند:

| # | اصل | سنجهٔ قطعی (DoD) |
|---|---|---|
| E1 | سرور تنها منبع حقیقتِ دادهٔ کسب‌وکار است | صفر مسیر نوشتن کسب‌وکار به‌جز فرمان/push سروری (تأیید arch-guard) |
| E2 | هیچ نوشتنی از لایهٔ داده عبور نمی‌کند | صفر `localStorage.setItem` بیرون از لایهٔ داده (قاعدهٔ A8 = ۰ تخلف) |
| E3 | localStorage فقط «سبکِ قابل‌از-دست‌رفتن» نگه می‌دارد | مجموع کلیدهای غیر-نشست در LS < **۲۰KB** در یک هفته کاری واقعی |
| E4 | پاک‌کردن حافظهٔ مرورگر = صفر خطا و صفر از-دست‌رفتن داده | تست «purge و بوت» سبز؛ همهٔ داده‌ها بعد از re-pull برمی‌گردند |
| E5 | حادثهٔ «۱۰۰٪ localStorage» ساختاراً ناممکن | کلیدهای سنگین (۱۰۰٪ دادهٔ >۸KB) فقط IDB؛ نگهبان سهمیه بدون استثنا |
| E6 | آفلاین = outbox محدود، نه دیتاست محلی | صف رکوردی در IDB با سقف؛ آفلاین طولانی = read-only با پیام شفاف |
| E7 | یک موتور همگام‌سازی، نه دو | sync.js legacy بازنشسته؛ فقط مسیر فرمان + pull دلتا (فاز C5) |

**خیرِ نهایی به کاربر:** دستگاه جدید/تازه در < چند ثانیه کار می‌کند (بدون دانلود کل دیتاست)، هیچ‌وقت پیام «حافظه پر» نمی‌بیند، و از دست دادن گوشی = از دست رفتن هیچ داده‌ای.

---

## ۲) معماری هدف

```
┌─ مرورگر (کلاینت حداکثری نازک) ─────────────────────────────┐
│ UI ماژول‌ها (دست‌نخورده — قرارداد گاردها)                    │
│      │ فقط از طریق                                          │
│ DataLayer واحد (getData/setData = تنها دروازه، هوک‌شده)      │
│      ├── CommandBus → فرمان اتمیک سروری (entity_upsert/     │
│      │      delete/… + idempotencyKey + journal/WAL)        │
│      ├── QueryClient → collection_query (فیلتر/صفحهٔ سروری) │
│      ├── ProjectionStore → حافظهٔ نشست + IndexedDB (کش)     │
│      ├── Outbox → صف رکوردی IDB (آفلاین، idempotent)        │
│      └── SessionStore → کوکی HttpOnly (+ تنظیمات UI سبک LS) │
│ localStorage فقط: نشستِ فرعی/UI/پرچم‌های سبک (<۲۰KB)        │
└─────────────────────────────────────────────────────────────┘
                     │ HTTPS (توکن در کوکی HttpOnly)
┌─ سرور (منبع حقیقت) ────────────────────────────────────────┐
│ MySQL (مقصد نهایی) / فروشگاه JSON+meta rev (گذار)           │
│ entity registry واحد (سمت سرور مرجع؛ کلاینت فقط mirror)     │
│ role-guard + validation + journal رسیدها + push_stats       │
│ رسانه = آروان S3 (api/storage.php موجود)                    │
└─────────────────────────────────────────────────────────────┘
```

**قانون طلایی عبور:** «UI هیچ‌وقت مستقیم به storage دست نمی‌زند؛ DataLayer هیچ‌وقت بی‌ACK حذف نمی‌کند؛ سرور هیچ‌وقت بی‌journal تغییر نمی‌دهد.»

---

## ۳) طبقه‌بندی داده‌ها — قرارداد هفت‌دسته‌ای

هر کلید دقیقاً یک دسته و یک مقصد دارد (فهرست کامل ۷۶ موردی در پیوست الف):

| دسته | تعریف | مقصد نهایی | نمونه |
|---|---|---|---|
| **REC** | موجودیت کسب‌وکار (رکورد-محور) | فرمان سروری + projection | invoices، leads، reminders |
| **BLOB** | دادهٔ کسب‌وکار کم‌تغییر/آرشیوی | push/pull بلاب (موقت) → بعداً REC | packinglists، smsbook |
| **SESS** | نشست/احراز هویت | کوکی HttpOnly + سرور | ptf_crm_token/session/token_role |
| **Q** | صف/وضعیت همگام‌سازی | IndexedDB (صف) / LS سبک (rev) | ptf_b_queue، ptf_sync_krevs |
| **CACHE** | کش فقط-خواندنی سرور | read-through + TTL، قابل‌تخلیه | ptf_site_suppliers، ptf_fx_live_cache |
| **UI** | ترجیحات و وضعیت رابط | LS (سبک) یا settings سروری | ptf_theme، ptf_nav_open، ptf_offer_tpl |
| **DEV** | فقط-دستگاه عملیاتی (draft/ops) | IDB یا حذف؛ هرگز حقیقت | ptf_autodraft_offer_، ptf_code_tmp_queue |

---

## ۴) فازهای اجرا (T0..T7) — هر فاز مستقل، قابل‌بازگشت، با معیار خروج

### T0 — تثبیت بستر و گیت‌ها (۱-۲ روز) — پیش‌نیاز همه
| کار | شرح | فایل |
|---|---|---|
| T0-1 | قاعدهٔ **A8** در arch-guard: منع `localStorage.*` بیرون از فهرست‌سفید (client-server/storage-quota/sync/storage/backup/rbac + ابزارهای html)؛ baseline فعلی = بدهی، افزایش = شکست | `_tools/arch/arch-guard.js` |
| T0-2 | قاعدهٔ **A10**: تطابق `PTF_ENTITY_CMD_ENABLED` (کلاینت) با `sd_entity_registry()` (سرور) از سورس استخراج و مقایسه شود | همان |
| T0-3 | **گیت CI قبل از FTP**: `run-ci-gate.js` + arch-guard در `deploy-staging.yml` و `deploy-production.yml` (جایگزین پچ‌های PENDING معلق) | `.github/workflows/*` |
| T0-4 | **گیت بعد از FTP (post-deploy hash check)**: هش ۵ فایل کلیدی زنده (index.html، sw.js، sales-domain-v2.js، leads.js، sales-domain.php) با کامیت مقایسه شود؛ نابرابر = شکست با پیام واضح (باگ «نسخهٔ مخلوط» همین امروز با این گرفته می‌شد) | همان |
| T0-5 | **فهرست واحد کلیدها**: `PTF_KEY_REGISTRY` (دسته‌بندی بخش ۳) که sync.js، client-server.js و arch-guard از آن بخوانند — پایان سه نسخهٔ موازی (SYNC_KEYS / bKeysFallback / IDB_KEYS) | جدید `crm/key-registry.js` |
| T0-6 | هدر کش استیجینگ: js/html = `no-cache` فقط روی staging (`.htaccess` شرطی) | `.htaccess` |
| **معیار خروج** | گیت‌ها در CI سبز روی یک PR نمونه؛ تخلف جدید A8 مسدود | |

### T1 — امنیت و صحت فوری (۱ روز) — مستقل از بقیه
| کار | شرح |
|---|---|
| T1-1 | **فیکس نشت PII** (تأیید زنده روی هر دو محیط): `$authenticated = !empty($client_role) && $client_role !== 'anonymous';` + تستر بدون-توکن (نبود mobile/email ادعا شود) — روی مین، چون پروداکشن را می‌بندد |
| T1-2 | پیام خطای فرمان دقیق: تفکیک ۴۰۳ نقش («دسترسی ندارید») از شبکه/صف («دوباره تلاش کنید») در cb مسیر entity |
| T1-3 | sanitizer نرم: سقف need/توضیحات ۲۰۰۰→۸۰۰۰ و hist ۵۰۰→۲۰۰۰ کاراکتر + شمارش «فیلد بریده/حذف‌شده» در پاسخ فرمان + فیلد null (مثل `link:null` یادآور) حفظ شود |
| T1-4 | پوشش تعارض push توده‌ای قدیمی برای دو کلید تازهٔ فرمانی (leads/reminders) با مسیر protected-conflict v34.8.11 |
| **معیار خروج** | پروب بدون-توکن PII نمی‌دهد (استیجینگ+پروداکشن)؛ tester517/518 + تسترهای جدید سبز |

### T2 — مهاجرت فرمانی همهٔ موجودیت‌ها (ادامهٔ C2/C3 — ۳-۵ هفته، موج‌بندی‌شده)
زیرساخت موجود (`entity_upsert/delete` + journal + tombstone) با **موج‌های** زیر تعمیم می‌یابد. ترتیب = رتبهٔ ایستای `PHASE-C1` + دادهٔ زندهٔ `sync_stats` (حداقل یک هفته تله‌متری قبل از قفل ترتیب):

| موج | مجموعه‌ها (تعداد مسیر نوشتن) | چرا این ترتیب |
|---|---|---|
| W1 (هفتهٔ ۱) | `customers`(۱۴)، `suppliers`(۱۳)، `products`(۲۲) | پرتکرار ولی کم‌ریسک مالی؛ duplicate-shield موجود |
| W2 (هفتهٔ ۲) | `rfqs`(۲۸)، `deals`(۲۸)، `projects`(۱۳)، `notifs`، `packlist/inqitems` | حجم بالای push؛ projection سروری deals از قبل نیمه‌کاره |
| W3 (هفتهٔ ۳-۴) | `invoices`(۲۹) + `case_receipts` + `receipt_allocations` | پرخطرترین مالی — بعد از تجربهٔ W1/W2 |
| W4 (هفتهٔ ۴-۵) | `offers`(۲۱ — سپر duplicate حذف می‌شود)، بقیهٔ سبک‌ها (letters، cheques، petty، opex-باقی، treasury_calls، bank_recon، tax_returns، …) | offers آخر طبق تصمیم فاز C (پرخطرترین) |
هر موج: پرچم per-collection (فعال/غیرفعال بدون ری‌دپلوی)، تستر اختصاصی، بازگشت یک‌خطی. **هیچ موجی بدون سبز بودن موج قبل شروع نمی‌شود.**

### T3 — خواندن سرور-محور و زیرساخت کش (۱-۲ هفته، هم‌زمان با W2/W3)
| کار | شرح |
|---|---|
| T3-1 | `collection_query` سروری (فیلتر/مرتب/صفحه) — فاز C4 سند موجود؛ endpoint روی فروشگاه JSON شروع، روی MySQL ادامه |
| T3-2 | رفع **ریس سردبوت**: آب‌رسانی IDB قبل از اولین رندر پنل داده‌ای (اسکلتون یا re-render قطعی پس از preload/pull) |
| T3-3 | **صف آفلاین → IDB**: `ptf_b_queue` به فروشگاه IDB با نوشتن همگام-حافظه‌ای + فلاش async؛ سقف پیشنهادی ۵۰۰ رکورد / ۷۲ ساعت؛ singleton چند-تبی (Web Locks) |
| T3-4 | کش‌های read-through با TTL: `ptf_site_*`، `ptf_fx_live_cache`، `ptf_cloud_usage` → قابل‌تخلیه خودکار، خارج از حساب سهمیهٔ LS |
| T3-5 | bootstrap دستگاه جدید = فقط صفحات موردنیاز (نه کل دیتاست) |

### T4 — نشست، توکن و رسانه (۱ هفته)
| کار | شرح |
|---|---|
| T4-1 | توکن → **کوکی HttpOnly/SameSite=Strict** (صدور در auth_login؛ مصرف سروری از `$_COOKIE`) + تمرکز ۴۹ ارجاع خواندن توکن کلاینت در ماژول واحد `ptfAuth`؛ حداقلِ جایگزین (اگر کوکی تأیید نشد): sessionStorage + تمرکز |
| T4-2 | TTL نشست: ۷ روز → ۲۴ ساعت (نقش‌های مالی ۸ ساعت) + refresh بی‌حساس — از C6 |
| T4-3 | رسانهٔ LS: `ptf_chqprint_bg` (base64!) و پروفایل/لی‌اوت چاپ چک → آروان S3؛ `ptf_crm_avatars` از بلاب sync جدا و به S3 |
| T4-4 | 2FA پیامکی نقش‌های مالی (زیرساخت SMS موجود) — از C6 |

### T5 — حذف بایپس‌ها و کلیدهای فقط-دستگاه (۱-۲ هفته)
| کار | شرح |
|---|---|
| T5-1 | ۵۹ نقطهٔ `setItem` مستقیم → DataLayer؛ اولویت: `finance-write-guard`(fin_events)، `inqreader`(products)، `index.html:3670`/`codegen`(settings)، حذف fallbackهای مردهٔ ۵ فایل |
| T5-2 | کلیدهای «فقط-دستگاه» — تک‌تک با جدول پیوست الف: `ptf_personal_cheques_*` → کلید سینک‌شونده + مهاجرت یک‌باره؛ صف کدینگ (`ptf_code_tmp_queue/plan/ack`) → سینک‌شونده؛ پیش‌نویس‌ها (`ptf_autodraft_offer_`، draftx) → IDB؛ `ptf_sales_command_*` تشخیصی → IDB |
| T5-3 | مهاجرت‌ها فقط با الگوی امن: بکاپ → push → ACK سرور → حذف محلی |
| **معیار خروج** | A8 = ۰ تخلف؛ پروب «purge و بوت» سبز |

### T6 — بازنشستگی موتور قدیمی و رکوردی‌شدن سرور (۱-۲ هفته)
- حذف pushDirty/pullCheck از sync.js پس از سبز بودن همهٔ موج‌ها (فاز C5) — ~۲۰۰۰ خط منطق تعارض بازنشسته می‌شود.
- ۵ موجودیت داغ (invoices، cheques_issued/received، offers، customers، fin_events) روی فروشگاه رکوردی (MySQL با `MIGRATION-MYSQL-SPEC`)؛ بلاب فقط آرشیو؛ `data_push` فقط legacy/آرشیو.
- صف آفلاین رکوردی idempotent (operationId) — الگوی sales موجود.

### T7 — سخت‌گیری بانکی و پاکسازی نهایی (۲-۳ روز)
- bulk revoke نشست‌ها (ادمین)، rate-limit فرمان‌ها per-user، حذف کلیدهای legacy باقیمانده، به‌روزرسانی ۴ ابزار ریکاوری HTML به IDB-aware.
- **DoD نهایی = جدول بخش ۱ (E1..E7) همگی قابل‌اثبات** + soak test یک هفته روی دستگاه قدیمی واقعی.

---

## ۵) سطح‌بندی سرویس آفلاین (قرارداد شفاف با کاربر)

| وضعیت | رفتار |
|---|---|
| آنلاین | بانکی کامل — فرمان + ACK + projection |
| آفلاین < ۷۲ ساعت (یا < ۵۰۰ رکورد در صف) | ثبت ادامه دارد → صف رکوردی IDB → flush خودکار؛ نوار وضعیت شفاف |
| آفلاین طولانی‌تر | read-only با پیام صریح؛ نوشتن مسدود (نه بی‌صدا) |
| تعارض پس از اتصال | سرور برنده + finding + اطلاع کاربر (هرگز از-دست‌رفتن بی‌صدا) |

---

## ۶) ماتریس ریسک و بازگشت

| ریسک | فاز | کنترل / Rollback |
|---|---|---|
| گم‌شدن داده در مهاجرت کلید فقط-دستگاه | T5 | بکاپ قبل + ACK قبل از حذف + تستر رفتاری هر کلید |
| رگرسیون نقش‌های محدود | T2 | ماتریس نقش تسترها + role-guard سروری per-collection |
| مرورگر بی‌IDB (حالت خصوصی/قدیمی) | T3/T5 | گارد idbUsable در همهٔ مسیرهای جدید؛ fallback = وضعیت امروز |
| دو تب همزمان | T3 | Web Locks leader + تست دو-تبی |
| کندی پول با رشد داده | T3/T6 | collection_query + پول دلتا + پایش sync_stats |
| دیپلوی ناقص/مخلوط | همه | post-deploy hash check (T0-4) + staging no-cache (T0-6) |
| بازگشت عادت setItem مستقیم | همه | A8 در CI — مسدودکنندهٔ merge |

---

## ۷) تقویم و ترتیب (با ریتم ایجنت، موازی‌پذیر)

```
هفته ۱:  T0 (گیت‌ها) + T1 (امنیت) + شروع تله‌متری sync_stats (در حال اجرا از v34.8.12)
هفته ۲:  W1 مهاجرت فرمانی (customers/suppliers/products) + T3-2/T3-3 (سردبوت + صف IDB)
هفته ۳:  W2 (rfqs/deals/projects) + T3-1 (collection_query) + T4 (نشست/رسانه)
هفته ۴:  W3 (invoices/receipts) + T5 (بایپس‌ها)
هفته ۵:  W4 (offers + سبک‌ها) + T6 (بازنشستگی legacy + رکوردی‌سازی سرور)
هفته ۶:  T7 + DoD + soak + مرج نهایی به مین و دیپلوی پروداکشن
```
ارزش از هفتهٔ اول محسوس است (نوار زرد و تعارض برای هر موج برای همیشه حذف می‌شود).

---

## ۸) KPIهای پایش‌شدنی

- `sync_stats`: روند نزولی push توده‌ای هر کلید → صفر برای کلیدهای REC (هدف هر موج).
- storage-quota: درصد اشغال LS → پایدار زیر ۲۰٪ روی دستگاه‌های قدیمی.
- تعداد تخلف A8/A10 = ۰ در هر run CI.
- زمان بوت سرد دستگاه جدید (لوگ sync) → < ۵ ثانیه تا اولین پنل.
- حوادث «۱۰۰٪ localStorage» = ۰ (پس از T3).

---

## ۹) ⚙️ تنظیمات نیازمند تأیید کارفرما (بدون تأیید اعمال نمی‌شوند)

| # | تنظیم | گزینه‌ها | پیشنهاد |
|---|---|---|---|
| S1 | فیکس نشت PII users_get | فوری روی مین / با بستهٔ T1 | **فوری (T1-1)** — نشتی زندهٔ پروداکشن |
| S2 | گیت‌های CI (A8+A10+run-ci-gate+post-deploy hash) | الزامی / گزارشی | **الزامی** روی staging و production |
| S3 | کش استیجینگ js/html | no-cache / وضع موجود | **no-cache فقط staging** |
| S4 | توکن نشست | کوکی HttpOnly / sessionStorage (وضع) | **کوکی HttpOnly** |
| S5 | TTL نشست | ۷ روز (وضع) / ۲۴س+۸س مالی | **۲۴ ساعت (مالی ۸ ساعت)** |
| S6 | موج اول مهاجرت فرمانی (W1) | customers+suppliers+products / invoices اول / صبر برای تله‌متری | **customers+suppliers+products** بعد از ۱ هفته دادهٔ sync_stats |
| S7 | صف آفلاین | IDB سقف ۵۰۰رکورد/۷۲س / وضع (LS بی‌سقف) | **IDB با سقف** |
| S8 | سقف sanitizer فرمان | ۸۰۰۰/۲۰۰۰ (پیشنهاد) / وضع ۲۰۰۰/۵۰۰ | **۸۰۰۰/۲۰۰۰ + حفظ null + شمارش برش** |
| S9 | krevs/rev maps | بماند LS / برود IDB | **بماند LS** (کوچک و حیاتی بوت) |
| S10 | نسخه‌گذاری و انتشار | هر فاز = یک v34.8.x + PR به مین / تجمیعی | **هر فاز یک نسخه، PR فوری به مین** (پایان الگوی «استیجینگ جلوتر») |

---

## پیوست الف — فهرست کامل کلیدهای localStorage و مقصد نهایی (اسکن کد، ۶۹ کلید + ۷ پیشوند)

### SESS → کوکی HttpOnly/سرور
`ptf_crm_token` (۴۹ ارجاع) · `ptf_crm_token_role` · `ptf_crm_session` · `ptf_login_lock` · `ptf_crm_offline_login` · `ptf_device_id` · `ptf_crm_device_tag` · `ptf_last_activity`

### REC → فرمان سروری (موج‌های T2)
SYNC_KEYS ~۷۰ کلید: `rfqs, suppliers, customers, products, catalog_reviews, catalog_merges, surplus, offers, leads✅, reminders✅, buyquotes, invoices, notifs, sendqueue, audit, inqitems, deals, projects, packinglists, letters, contracts, sigprofiles, smsbook, rfqsmart, settings*, finance*, order_prices, payables, supplier_finance✅, opex✅, shareholders✅, sharetx✅, fiscal_snapshots, techcases, calc_runs, techproposals, leadfinder_jobs, leadfinder_sources, management_actions, management_reports, commission_records, notifprefs, trash, petty, petty_tx, petty_periods, perms, buycmp, cheques_issued, cheques_received, cheque_books, msgtpls, tax_returns, sales_returns, fin_events*, bank_recon, treasury_calls, case_receipts, receipt_allocations, fin_attachments, corrections, fin_findings, deleted_archive, avatars*→S3(T4-3), inqreads, sales_commands`
`*` = استثنا: `settings` بخش UI سبکش در LS بماند؛ `fin_events` نوشتن مستقیم فعلی (finance-write-guard:237) باید T5-1 شود؛ `avatars` رسانه است.

### Q → صف/rev
`ptf_b_queue` → **IDB (T3-3)** · `ptf_sync_dirty` → با صف به IDB · `ptf_sync_krevs`/`ptf_sync_rev` → LS (S9) · `ptf_sync_ping`/`ptf_sync_last_error`/`ptf_guard_counts`/`ptf_evt_last`/`ptf_bridge_last_error`/`ptf_b_offload_last` → LS سبک یا حذف

### CACHE → read-through + TTL (T3-4)
`ptf_site_suppliers` · `ptf_site_suppliers_total` · `ptf_site_rfqs` · `ptf_site_inbox_sig` · `ptf_fx_live_cache` · `ptf_cloud_usage` · `ptf_cloud_usage_backup` · `ptf_crm_users` (کش users_get)

### UI → LS سبک (مجاز)
`ptf_theme` · `ptf_crm_theme_vars` · `ptf_nav_open` · `ptf_tour_done_*` · `ptf_tour_mnv_done_*` · `ptf_crm_prefs_*` · `ptf_offer_tpl` · `ptf_off_cust_filter` · `ptf_bot_enabled` · `ptf_phonefmt_mig` · `ptf_app_ver` · `ptf_profit_incomplete_notified` · `ptf_storage_mode`/`ptf_storage_warned`/`ptf_crm_mode`/`ptf_crm_sync_enabled` (پرچم‌های زیرساخت — LS می‌مانند)

### DEV → IDB یا سینک‌شونده (T5-2)
`ptf_autodraft_offer_*` → IDB · `ptf_code_tmp_queue`/`ptf_code_duplicate_plan`/`ptf_code_duplicate_ack` → سینک‌شونده · `ptf_sales_command_not_committed_*`/`ptf_sales_command_recovered_*`/`ptf_offer_post_ack_warning_*` → IDB (تشخیصی) · `ptf_personal_cheques_<user>` → **سینک‌شونده** (دادهٔ شرکت) · `sigRecovery_*` (letters) → IDB · `ptf_backup_local`/`ptf_backup_prerestore` → IDB · `ptf_backup_last`/`ptf_backup_sig`/`ptf_backup_delta_sig`/`ptf_last_backup_time` → LS سبک

### M → رسانه S3 (T4-3)
`ptf_chqprint_bg` (base64) · `ptf_crm_avatars`

### پیشوندهای داینامیک
`ptf_tour_done_`، `ptf_tour_mnv_done_`، `ptf_crm_prefs_`، `ptf_autodraft_offer_`، `ptf_sales_command_*`، `ptf_offer_post_ack_warning_`، `ptf_personal_cheques_`

---

## پیوست ب — پیوند با وضعیت استقرار (امروز)
- استیجینگ امروز با پوش برنچ session به **محتوای مین (v34.8.12)** همگام شد (دیپلوی کامل از state تازه؛ رفع نسخهٔ مخلوط). کد v34.8.13-15 روی برنچ `arena/01a03ab4-pishtaj-ir` محفوظ است و مبنای W1 می‌شود.
- شرط شروع T1/W1: سبز بودن post-deploy check روی استیجینگِ تازه همگام‌شده.
