# رودمپ باقی‌ماندهٔ نازک‌سازی کلاینت — فازبندی R1..R6

**تاریخ:** ۲۰۲۶-۰۸-۲۹ | **مبنای کد:** `main@90ccfab` (پس از merge پرِ#13 — v34.8.38)
> ### ✅ تصمیم ثبت‌شدهٔ کارفرما (۲۰۲۶-۰۸-۲۹)
> ۱) شماره‌گذاری تا پایان نازک‌سازی با همان روال جاری (v34.8.x) ادامه می‌یابد.
> ۲) **نسخهٔ نهاییِ تکمیل‌شده = v34.9.0** — همان نسخه روی **پروداکشن** دیپلوی می‌شود.
> ۳) تا آن زمان merge به main/دیپلوی پروداکشن انجام نمی‌شود.

**نسبت با اسناد قبل:** ادامهٔ عملیاتی `ROADMAP-THIN-CLIENT-MAXIMAL-2026-08-27.md` (T0..T7) و
`ARENA-THIN-CLIENT-STATUS-AUDIT-2026-08-28.md`؛ وضعیت همهٔ ردیف‌ها امروز **با شاهد کدی** دوباره
راستی‌آزمایی شده است (نه نقل از اسناد قبلی).

---

## ۱) وضعیت تأییدشده تا امروز (خلاصهٔ انجام‌شده‌ها)

| فاز رودمپ T | وضعیت | شاهد |
|---|---|---|
| T0-1/2/5 (A10/A11 + رجیستری کلید) | ✅ v34.8.34 | arch-guard: A10=261/261 در baseline، A11=0 |
| T0-3/4/6 (گیت CI در workflow + هش پس از استقرار + no-cache استیجینگ) | ✅ v34.8.35 | tester536؛ گیت Quality Gate و Deploy روی هر PR/push به main |
| T1-1 (نشت PII users_get) | ✅ | `api/crm.php:2366` — گیت `$authenticated` |
| T1-2 (پیام خطای فرمان دقیق) | ✅ v34.8.16 | `ptfEntityCommandMessage` (۴۰۳/۴۰۱/uncertain/آفلاین) |
| T2/W1..W4 (مهاجرت فرمانی همهٔ موجودیت‌ها ~۴۱ کلید) | ✅ v34.8.22–27 | `PTF_ENTITY_CMD_ENABLED` = `sd_entity_registry()` |
| T3-1 (collection_query) | ✅ v34.8.31 | endpoint + مصرف در ماژول کالا |
| T3-2 (رفع ریس سردبوت) | ✅/🟡 v34.8.28 | رندر پس از preload |
| T3-3 (صف آفلاین IDB) | ✅ v34.8.23 | `ptf_b_queue` در IDB |
| T4-1a (کوکی HttpOnly) / T4-2 (TTL نشست) / T4-3a (چک‌پرینت→S3) | ✅ v34.8.28 | tester530 |
| T5-1 (حذف fallbackهای مردهٔ LS) | ✅ v34.8.35 | codegen.js:393 / treasury.js:471 — فقط مسیر فرمان |
| T5-2a (personal_cheques → کلید سینک‌شونده) | ✅ v34.8.29 | + رفع نوار زرد v34.8.36–38 (RBAC parity + FORBIDDEN-DROP + ROUTER-CB + PULL-EQUAL-ACK + COMMAND-ACK-DIRTY-CLEAR) |

**گیت‌های امروز:** `run-ci-gate` = 154 PASS / 0 FAIL · `arch-guard` = PASS (روی main@90ccfab).

---

## ۲) باقی‌ماندهٔ تأییدشده با شاهد کدی (اسکن ۲۰۲۶-۰۸-۲۹)

| # | بند | کار باقی‌مانده | شاهد کدی امروز | ریسک |
|---|---|---|---|---|
| 1 | **T5-2b** | تشخیصی‌های فرمان (`ptf_sales_command_uncertain_/not_committed_/recovered_`، `ptf_offer_post_ack_warning_`) هنوز مستقیم در LS نوشته می‌شوند | sales-domain-v2.js: `persistCommandDiagnostic`، `ptfRecoverUncertainSalesCommands`، `saveOfferAckWarning` — ۸ نقطهٔ `localStorage.*` | کم (فقط تشخیصی، بدون خوانندهٔ سنکرون حیاتی) |
| 2 | **T5-2c** | پیش‌نویس‌ها و صف کدینگ (`ptf_autodraft_offer_/award_revision_`، `sigRecovery_*`، `ptf_code_tmp_queue/plan/ack`) در LS | offers.js:837 (خواندن سنکرون هنگام باز کردن فرم)، codegen.js:235..445 | متوسط (جریان UX فرم/کدینگ باید async شود) |
| 3 | **T3-4** | ✅ انجام شد در v34.8.41 (لایهٔ `ptfCache` روی IDB + TTL؛ صفر نوشتن جدید LS) | storage-quota.js / bridge.js / fx.js / storage.js / buycompare.js / archive.js | — |
| 4 | **T3-5** | موکول به پنجرهٔ R4 — پروتکل pull مرکزی است؛ بدون تست دستگاه واقعی ریسکی. پایهٔ hydration کلید-به-کلید از v34.8.41 موجود است | client-server.js:150-190 | متوسط |
| 5 | **T6/C5** | دو موتور سینک زنده‌اند؛ `pushDirty`/`pullCheck` بازنشسته نشده‌اند (~۲۰۰۰ خط) | sync.js:937 (`pushDirty`)، sync.js:1191 (`pullCheck`) | **بالا** — نیازمند پایش sync_stats و پرچم خاموشی |
| 6 | **T4-1b** | توکن `ptf_crm_token` هنوز در LS خوانده می‌شود (ده‌ها نقطه) | grep: backup/bridge/careers/client-server/cms/codegen/golive/inqreader/… | متوسط (پس از چرخش دستگاه‌ها) |
| 7 | **T4-3b** | `ptf_crm_avatars` هنوز بلاب سینک است؛ باید به S3 برود | key-registry.js: «تا T4-3 → S3» | متوسط |
| 8 | **T7** | 2FA نقش‌های مالی، bulk-revoke نشست، rate-limit فرمان‌ها، ابزارهای ریکاوری IDB-aware | crm/{clear-cache,force-restore,recover,sync-diagnostics}.html → صفر ارجاع indexedDB | کم‌ریسک فنی، نیاز به تأیید کارفرما (S جدول ۹ رودمپ) |
| 9 | **بدهی A10** | ۲۶۱ عملیات مستقیم LS به‌عنوان baseline پذیرفته شده — باید پله‌ای صفر شود | arch-baseline.json | — |
| 10 | **معلق مالک** | پچ هاردنینگ گیت دیپلوی (رفع false-red) هنوز push نشده | `_tools/PENDING-workflow-integrity-hardening-v34.8.37.patch` | — |

---

## ۳) فازبندی ادامهٔ کار (R1..R6)

اصل تقسیم: **هر فاز = یک نسخهٔ v34.8.x + تستر قفل‌کننده + PR فوری به main** (تنظیم S10 تأییدشده)؛
هیچ فازی بدون سبز بودن فاز قبل شروع نمی‌شود.

### R1 — تشخیصی‌های فرمان → IDB «Dev-KV» (T5-2b) — v34.8.39 ✅ انجام شد (PR#14)
- نمای واحد `ptfDevKv` روی IDB موجود لایهٔ ذخیره‌سازی (کلیدهای `devkv:`)؛ fallback به LS فقط وقتی IDB نباشد (قرارداد رودمپ).
- مهاجرت ۸ نقطهٔ sales-domain-v2.js + تبدیل اسکن‌ها به async + پر کردن async دیالوگ «بررسی رسید فرمان».
- مهاجرت یک‌بارهٔ LS→IDB برای پیشوندهای `ptf_sales_command_` و `ptf_offer_post_ack_warning_`.
- **DoD:** صفر `localStorage.*` برای این پیشوندها در sales-domain-v2.js (رatchet baseline A10 کاهش یابد) + tester539 سبز.

### R2 — پیش‌نویس‌ها و صف کدینگ → IDB (T5-2c) — v34.8.40 ✅ انجام شد (پیش‌نویس پیشنهاد/بازنگری + آینهٔ امضا + صف/پلن/ack کدینگ + رجیستری دقیق؛ baseline A10: 253→234)
- `ptf_autodraft_offer_*` / `ptf_autodraft_award_revision_*`: ذخیره از طریق Dev-KV؛ بازیابی در `offerNew` async (confirm بازیابی پس از بارگذاری)، حذف پس از ثبت.
- `sigRecovery_*` (letters) و `ptf_backup_local/prerestore` → Dev-KV.
- `ptf_code_tmp_queue/plan/ack`: صف کدینگ با الگوی امن (بکاپ → نوشتن IDB → ACK → حذف LS).
- **DoD:** دستهٔ DEV در key-registry فقط از طریق Dev-KV نوشته شود؛ تستر رفتاری بازیابی پیش‌نویس سبز.

### R3 — کش read-through با TTL (T3-4) — v34.8.41 ✅ انجام شد (PR#14)
- لایهٔ `ptfCache` در storage-quota.js: Write/Read/ReadSync/ReadStale/ReadRec/Drop/Hydrate/Sweep؛ پوشنهٔ `{v,at,ttl}` در ردیف `cache:<key>` IDB؛ پس از ثبت موفق، کپی LS حذف می‌شود؛ بدون IDB → همان پوشنه در LS (رفتار امروز).
- قرارداد خواندن: رندر سنکرون از `ptfCacheReadSync` (حافظه + legacy LS تا مهاجرت)؛ async با TTL؛ `ReadStale` تا ۷ روز به‌عنوان fallback خطا؛ sweep بوت ردیف‌های >۷روز منقضی را حذف و معتبرها را به حافظه می‌آورد؛ legacy خام LS → rec با at=0 (بدون شکستن کش دستگاه‌های موجود).
- مهاجرت کامل مصرف‌کنندگان: bridge.js (صندوق سایت `ptf_site_*` TTL ۲۴س + `inbox_sig` بی-TTL + hydrate ۴ کلید)، fx.js (TTL ۶س + آب‌رسانی تیکر)، storage.js (`ptf_cloud_usage` TTL ۶۰۰ث؛ `ReadStale` جای `_backup`)، buycompare.js (دو خوانندهٔ سنکرون)، archive.js (۴ ابطال → `ptfCacheDrop`).
- **T3-5 (بوت صفحه‌ای) به پنجرهٔ R4 موکول شد** — پروتکل pull مرکزی است و بدون تست دستگاه واقعی ریسکی؛ hydration کلید-به-کلید از این نسخه موجود است.
- **DoD:** صفر نوشتنِ جدید LS برای دستهٔ CACHE؛ tester542 (۳۵ سنجه) سبز؛ baseline A10 رتچت شد.

### R4 — بازنشستگی موتور legacy سینک (T6/C5) — v34.8.42/43 (دو گام)
- **گام ۱ (v34.8.42):** پرچم per-key `PTF_LEGACY_PUSH_OFF` (پیش‌فرض روشنِ فعلی) + داشبورد تصمیم از `sync_stats` (شرط: پنجرهٔ ≥۷ روز با push توده‌ای ≈ صفر برای کلیدهای REC) + تله‌متری گیت.
- **گام ۲ (v34.8.43):** حذف `pushDirty`/`pullCheck` و ~۲۰۰۰ خط منطق تعارض؛ `ptfSyncNotifyDirty` فقط صف فاز B را تغذیه می‌کند.
- **DoD:** اصل E7 «یک موتور» اثبات‌پذیر؛ archive تعارض‌ها همچنان بازیافت‌پذیر.

### R5 — نشست و رسانهٔ نهایی (T4-1b/T4-3b) — v34.8.44
- حذف `ptf_crm_token` از LS پس از چرخش دستگاه‌ها (تمرکز خواندن در `ptfAuth` → سپس حذف LS).
- `ptf_crm_avatars` → آروان S3 (الگوی چک‌پرینت v34.8.28).
- **DoD:** SESS در LS = صفر؛ تستر purge-boot سبز.

### R6 — سخت‌گیری بانکی و DoD نهایی (T7) — v34.9.0
- 2FA پیامکی نقش‌های مالی، bulk-revoke نشست‌ها (ادمین)، rate-limit فرمان‌ها per-user.
- چهار ابزار ریکاوری HTML → IDB-aware.
- soak test یک هفته روی دستگاه قدیمی واقعی + اثبات E1..E7 + کاهش baseline A10 به صفرِ باقیمانده.

### موازی و معلق (بدون نسخهٔ جدید تا تأیید)
- **اقدام مالک (یک خط):** `git apply _tools/PENDING-workflow-integrity-hardening-v34.8.37.patch && git add -A && git commit -m "ci: هاردنینگ گیت post-deploy" && git push` — پایان false-red گیت استقرار.

---

## ۴) سنجهٔ پذیرش هر PR (مثلث ثابت)

1. `node _tools/arch/arch-guard.js` → PASS (و baseline اگر کاهش یافته، re-record شود).
2. `node _tools/uat/run-ci-gate.js` → صفر FAIL با تستر جدید ثبت‌شده.
3. `node --check` روی فایل‌های دست‌خورده + `php -l` روی api (فقط اگر تغییر سروری باشد).
4. هم‌نسخگی ۷ نقطهٔ رسمی (VERSION.json / index / sw / manifest / SD_SERVICE_VERSION / clear-cache / تسترها).
